import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generateCompressionStrategyConfig,
  generateTypeScriptCompressionStrategy,
  generatePythonCompressionStrategy,
  generateGoCompressionStrategy,
  writeCompressionStrategyFiles,
  displayCompressionStrategyConfig,
} from '../../src/utils/large-payload-compression';

/**
 * large-payload-compression is a code-gen utility that emits adaptive
 * compression/chunking strategies in TypeScript, Python and Go, driven by a
 * CompressionStrategyConfig. Every generator returns `{ files, dependencies }`
 * with a single source file plus a service-specific class name. We assert on
 * the deterministic string output of each generator and on the on-disk bundle
 * written by writeCompressionStrategyFiles.
 */

const SERVICE = 'api-gateway';
const CLASS_NAME = 'ApiGatewayLargePayloadCompression';

/** Strip ANSI escape codes so display assertions match the plain text. */
const stripAnsi = (s: string): string => s.replace(/\[[0-9;]*m/g, '');

describe('generateCompressionStrategyConfig', () => {
  it('produces sensible defaults for a service', async () => {
    const config = await generateCompressionStrategyConfig(SERVICE);
    expect(config.serviceName).toBe(SERVICE);
    expect(config.defaultEncoding).toBe('base64');
    expect(config.defaultChunking).toBe('adaptive');
    expect(config.enableAdaptive).toBe(true);
    expect(config.parallelProcessing).toBe(true);
    expect(config.maxMemoryUsage).toBe(100 * 1024 * 1024);
  });

  it('honours a custom default encoding', async () => {
    const config = await generateCompressionStrategyConfig(SERVICE, 'hex');
    expect(config.defaultEncoding).toBe('hex');
    expect(config.defaultChunking).toBe('adaptive');
  });

  it('honours a custom default chunking strategy', async () => {
    const config = await generateCompressionStrategyConfig(SERVICE, 'utf8', 'line-based');
    expect(config.defaultEncoding).toBe('utf8');
    expect(config.defaultChunking).toBe('line-based');
  });

  it('kebab/hyphenated service names round-trip unchanged into the config', async () => {
    const config = await generateCompressionStrategyConfig('data-pipeline');
    expect(config.serviceName).toBe('data-pipeline');
  });
});

describe('generateTypeScriptCompressionStrategy', () => {
  const result = generateCompressionStrategyConfig(SERVICE).then((cfg) =>
    generateTypeScriptCompressionStrategy(cfg)
  );

  it('returns a single file plus the zlib/crypto/stream dependencies', async () => {
    const { files, dependencies } = await result;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(`${SERVICE}-large-payload-compression.ts`);
    expect(dependencies).toEqual(['zlib', 'crypto', 'stream']);
  });

  it('emits the header banner and the service-specific class', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`// Large Payload Compression and Encoding Strategies for ${SERVICE}`);
    expect(content).toContain(`export class ${CLASS_NAME} {`);
  });

  it('declares the encoding/chunking/compression/adaptive type unions', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('export type EncodingStrategy =');
    expect(content).toContain("'base64'");
    expect(content).toContain("'hex'");
    expect(content).toContain("'utf8'");
    expect(content).toContain("'ascii'");
    expect(content).toContain("'binary'");
    expect(content).toContain("'none'");
    expect(content).toContain('export type ChunkingStrategy =');
    expect(content).toContain("'fixed-size'");
    expect(content).toContain("'record-based'");
    expect(content).toContain("export type CompressionMode = 'streaming' | 'batch' | 'hybrid';");
    expect(content).toContain(
      "export type AdaptiveStrategy = 'entropy-based' | 'speed-priority' | 'size-priority' | 'heuristic';"
    );
  });

  it('declares the full chunking + adaptive + encode/decode surface', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('async processPayload(');
    expect(content).toContain('private async chunkData(');
    expect(content).toContain('private fixedSizeChunking(');
    expect(content).toContain('private adaptiveChunking(');
    expect(content).toContain('private contentBasedChunking(');
    expect(content).toContain('private lineBasedChunking(');
    expect(content).toContain('private recordBasedChunking(');
    expect(content).toContain('private selectCompressionAlgorithm(');
    expect(content).toContain('private async compressChunk(');
    expect(content).toContain('reassembleChunks(chunks: ChunkResult[]): Buffer {');
    expect(content).toContain('encode(data: Buffer, encoding: EncodingStrategy): string {');
    expect(content).toContain('decode(data: string, encoding: EncodingStrategy): Buffer {');
    expect(content).toContain('async *processStream(');
  });

  it('exports the factory and a runnable main example', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('export function createLargePayloadCompression(config: any) {');
    expect(content).toContain('async function main() {');
    expect(content).toContain(`serviceName: '${SERVICE}',`);
    expect(content).toContain('const testData = Buffer.alloc(10 * 1024 * 1024);');
    expect(content).toContain('if (require.main === module) {');
  });
});

describe('generatePythonCompressionStrategy', () => {
  const result = generateCompressionStrategyConfig(SERVICE).then((cfg) =>
    generatePythonCompressionStrategy(cfg)
  );

  it('returns a single python file plus the zlib/hashlib/base64 dependencies', async () => {
    const { files, dependencies } = await result;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(`${SERVICE}_large_payload_compression.py`);
    expect(dependencies).toEqual(['zlib', 'hashlib', 'base64', 'typing']);
  });

  it('emits imports, enums and the dataclass models', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`# Large Payload Compression and Encoding for ${SERVICE}`);
    expect(content).toContain('import zlib');
    expect(content).toContain('import hashlib');
    expect(content).toContain('import base64');
    expect(content).toContain('from typing import List, Dict, Any, Optional, Literal');
    expect(content).toContain('from dataclasses import dataclass');
    expect(content).toContain('from enum import Enum');
    expect(content).toContain('class EncodingStrategy(Enum):');
    expect(content).toContain('class ChunkingStrategy(Enum):');
    expect(content).toContain('class CompressionMode(Enum):');
    expect(content).toContain('class AdaptiveStrategy(Enum):');
    expect(content).toContain('@dataclass\nclass ChunkMetadata:');
    expect(content).toContain('@dataclass\nclass ChunkResult:');
    expect(content).toContain('@dataclass\nclass PayloadProcessingResult:');
  });

  it('declares the manager class and its private methods', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`class ${CLASS_NAME}:`);
    expect(content).toContain('def __init__(self, config: Dict[str, Any]):');
    expect(content).toContain(
      'def process_payload(self, data: bytes, options: Optional[Dict] = None) -> PayloadProcessingResult:'
    );
    expect(content).toContain('def _chunk_data(self, data: bytes, strategy: str, chunk_size: int)');
    expect(content).toContain('def _fixed_size_chunking(self, data: bytes, size: int)');
    expect(content).toContain('def _adaptive_chunking(self, data: bytes, base_size: int)');
    expect(content).toContain('def _select_compression_algorithm(self, chunk: bytes, strategy: str)');
    expect(content).toContain('def _compress_chunk(self, chunk: bytes, algorithm: str, level: int)');
    expect(content).toContain('def _calculate_checksum(self, data: bytes) -> str:');
    expect(content).toContain('def _estimate_entropy(self, data: bytes) -> float:');
    expect(content).toContain('def _calculate_compression_ratio(self, original: int, compressed: int)');
  });

  it('appends a usage example keyed to the service', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('async def main():');
    expect(content).toContain(`'serviceName': '${SERVICE}',`);
    expect(content).toContain("if __name__ == '__main__':");
  });
});

describe('generateGoCompressionStrategy', () => {
  const result = generateCompressionStrategyConfig(SERVICE).then((cfg) =>
    generateGoCompressionStrategy(cfg)
  );

  it('returns a single go file plus the std-lib compression/crypto deps', async () => {
    const { files, dependencies } = await result;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(`${SERVICE}-large-payload-compression.go`);
    expect(dependencies).toEqual([
      'compress/gzip',
      'compress/zlib',
      'crypto/sha256',
      'encoding/base64',
      'encoding/hex',
    ]);
  });

  it('declares package main and the required imports', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('package main');
    expect(content).toContain('"compress/gzip"');
    expect(content).toContain('"compress/zlib"');
    expect(content).toContain('"crypto/sha256"');
    expect(content).toContain('"encoding/base64"');
    expect(content).toContain('"encoding/hex"');
    expect(content).toContain('"bytes"');
    expect(content).toContain('"fmt"');
    expect(content).toContain('"math"');
    expect(content).toContain('"time"');
  });

  it('declares the strategy type aliases, constants and result structs', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('type EncodingStrategy string');
    expect(content).toContain('EncodingBase64 EncodingStrategy = "base64"');
    expect(content).toContain('type ChunkingStrategy string');
    expect(content).toContain('ChunkingFixedSize     ChunkingStrategy = "fixed-size"');
    expect(content).toContain('type CompressionMode string');
    expect(content).toContain('type AdaptiveStrategy string');
    expect(content).toContain('AdaptiveEntropyBased  AdaptiveStrategy = "entropy-based"');
    expect(content).toContain('type ChunkMetadata struct {');
    expect(content).toContain('type ChunkResult struct {');
    expect(content).toContain('type PayloadProcessingResult struct {');
  });

  it('declares the constructor and the receiver methods + main', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`type ${CLASS_NAME} struct {`);
    expect(content).toContain(
      `func New${CLASS_NAME}(config map[string]interface{}) *${CLASS_NAME} {`
    );
    expect(content).toContain(
      `func (c *${CLASS_NAME}) ProcessPayload(data []byte) (*PayloadProcessingResult, error) {`
    );
    expect(content).toContain(`func (c *${CLASS_NAME}) fixedSizeChunking(data []byte, size int) [][]byte {`);
    expect(content).toContain(
      `func (c *${CLASS_NAME}) selectCompressionAlgorithm(chunk []byte, strategy AdaptiveStrategy) string {`
    );
    expect(content).toContain(`func (c *${CLASS_NAME}) compressChunk(chunk []byte, algorithm string) []byte {`);
    expect(content).toContain(`func (c *${CLASS_NAME}) estimateEntropy(data []byte) float64 {`);
    expect(content).toContain(`func main() {`);
    expect(content).toContain(`"serviceName":        "${SERVICE}",`);
  });
});

describe('writeCompressionStrategyFiles', () => {
  let out: string;

  beforeEach(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-lpc-'));
  });

  afterEach(async () => {
    await fs.remove(out);
  });

  it('writes the TypeScript source and a TYPESCRIPT BUILD.md', async () => {
    const config = await generateCompressionStrategyConfig(SERVICE);
    const integration = await generateTypeScriptCompressionStrategy(config);
    await writeCompressionStrategyFiles(SERVICE, integration, out, 'typescript');

    expect(await fs.pathExists(path.join(out, `${SERVICE}-large-payload-compression.ts`))).toBe(true);
    const build = await fs.readFile(path.join(out, 'BUILD.md'), 'utf8');
    expect(build).toContain('# Large Payload Compression Build Instructions for api-gateway');
    expect(build).toContain('## Language: TYPESCRIPT');
    expect(build).toContain(CLASS_NAME);
    // The written source matches the generator output exactly.
    const written = await fs.readFile(
      path.join(out, `${SERVICE}-large-payload-compression.ts`),
      'utf8'
    );
    expect(written).toBe(integration.files[0].content);
  });

  it('writes the Python source and a PYTHON BUILD.md', async () => {
    const config = await generateCompressionStrategyConfig(SERVICE);
    const integration = await generatePythonCompressionStrategy(config);
    await writeCompressionStrategyFiles(SERVICE, integration, out, 'python');

    expect(await fs.pathExists(path.join(out, `${SERVICE}_large_payload_compression.py`))).toBe(true);
    const build = await fs.readFile(path.join(out, 'BUILD.md'), 'utf8');
    expect(build).toContain('## Language: PYTHON');
    expect(build).toContain(SERVICE);
  });

  it('writes the Go source and a GO BUILD.md', async () => {
    const config = await generateCompressionStrategyConfig(SERVICE);
    const integration = await generateGoCompressionStrategy(config);
    await writeCompressionStrategyFiles(SERVICE, integration, out, 'go');

    expect(await fs.pathExists(path.join(out, `${SERVICE}-large-payload-compression.go`))).toBe(true);
    const build = await fs.readFile(path.join(out, 'BUILD.md'), 'utf8');
    expect(build).toContain('## Language: GO');
    expect(build).toContain(CLASS_NAME);
  });

  it('ensures the output directory exists before writing', async () => {
    const config = await generateCompressionStrategyConfig(SERVICE);
    const integration = await generateTypeScriptCompressionStrategy(config);
    const nested = path.join(out, 'nested', 'deep');
    await writeCompressionStrategyFiles(SERVICE, integration, nested, 'typescript');
    expect(await fs.pathExists(path.join(nested, `${SERVICE}-large-payload-compression.ts`))).toBe(true);
    expect(await fs.pathExists(path.join(nested, 'BUILD.md'))).toBe(true);
  });
});

describe('displayCompressionStrategyConfig', () => {
  it('prints the service, defaults, memory and the strategy catalog when enabled', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const config = await generateCompressionStrategyConfig(SERVICE);
      await displayCompressionStrategyConfig(config);
      const out = stripAnsi(spy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n'));
      expect(out).toContain(`Large Payload Compression: ${SERVICE}`);
      expect(out).toContain('Default Encoding: base64');
      expect(out).toContain('Default Chunking: adaptive');
      expect(out).toContain('Adaptive Compression: enabled');
      expect(out).toContain('Max Memory Usage: 100MB');
      expect(out).toContain('Parallel Processing: enabled');
      expect(out).toContain('Chunking Strategies:');
      expect(out).toContain('fixed-size - Uniform chunk sizes');
      expect(out).toContain('adaptive - Size based on data entropy');
      expect(out).toContain('Encoding Strategies:');
      expect(out).toContain('base64 - Base64 encoding (safe for text)');
      expect(out).toContain('Adaptive Algorithms:');
      expect(out).toContain('entropy-based - Analyze data entropy');
      expect(out).toContain('Performance Features:');
      expect(out).toContain('Memory-efficient streaming');
    } finally {
      spy.mockRestore();
    }
  });

  it('shows disabled state for adaptive and parallel when toggled off', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const config = await generateCompressionStrategyConfig(SERVICE);
      config.enableAdaptive = false;
      config.parallelProcessing = false;
      await displayCompressionStrategyConfig(config);
      const out = stripAnsi(spy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n'));
      expect(out).toContain('Adaptive Compression: disabled');
      expect(out).toContain('Parallel Processing: disabled');
      expect(out).not.toContain('Adaptive Compression: enabled');
    } finally {
      spy.mockRestore();
    }
  });
});
