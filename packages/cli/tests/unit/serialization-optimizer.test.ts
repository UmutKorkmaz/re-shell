import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generateOptimizerConfig,
  generateTypeScriptOptimizer,
  generatePythonOptimizer,
  generateGoOptimizer,
  writeOptimizerFiles,
  displayOptimizerConfig,
} from '../../src/utils/serialization-optimizer';

/**
 * serialization-optimizer is a code-gen utility that emits multi-format
 * serialization + 7-algorithm compression optimizers in TypeScript, Python and
 * Go, driven by an OptimizerConfig. Every generator returns { files,
 * dependencies } with a single source file plus a service-specific class name.
 * We assert on the deterministic string output of each generator and on the
 * on-disk bundle written by writeOptimizerFiles.
 */

const SERVICE = 'api-gateway';
const CLASS_NAME = 'ApiGatewaySerializationOptimizer';

/** Strip ANSI escape codes so display assertions match the plain text. */
const stripAnsi = (s: string): string => s.replace(/\[[0-9;]*m/g, '');

describe('generateOptimizerConfig', () => {
  it('produces sensible defaults for a service', async () => {
    const config = await generateOptimizerConfig(SERVICE);
    expect(config.serviceName).toBe(SERVICE);
    expect(config.defaultFormat).toBe('json');
    expect(config.defaultCompression).toBe('gzip');
    expect(config.defaultStrategy).toBe('balanced');
    expect(config.enableAdaptiveCompression).toBe(true);
    expect(config.enableCompression).toBe(true);
    expect(config.minSizeForCompression).toBe(1024);
  });

  it('honours a custom default format', async () => {
    const config = await generateOptimizerConfig(SERVICE, 'msgpack');
    expect(config.defaultFormat).toBe('msgpack');
    expect(config.defaultCompression).toBe('gzip');
  });

  it('honours a custom default compression algorithm', async () => {
    const config = await generateOptimizerConfig(SERVICE, 'cbor', 'brotli');
    expect(config.defaultFormat).toBe('cbor');
    expect(config.defaultCompression).toBe('brotli');
  });

  it('passes the service name through unchanged', async () => {
    const config = await generateOptimizerConfig('data-pipeline');
    expect(config.serviceName).toBe('data-pipeline');
  });
});

describe('generateTypeScriptOptimizer', () => {
  const result = generateOptimizerConfig(SERVICE).then((cfg) =>
    generateTypeScriptOptimizer(cfg)
  );

  it('returns a single file plus the zlib/stream dependencies', async () => {
    const { files, dependencies } = await result;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(`${SERVICE}-serialization-optimizer.ts`);
    expect(dependencies).toEqual(['zlib', 'stream']);
  });

  it('emits the header banner and the service-specific class', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`// Data Serialization Optimizer for ${SERVICE}`);
    expect(content).toContain(`export class ${CLASS_NAME} {`);
  });

  it('declares the compression/format/strategy/level type unions', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('export type CompressionType =');
    expect(content).toContain("'none'");
    expect(content).toContain("'gzip'");
    expect(content).toContain("'brotli'");
    expect(content).toContain("'zstd'");
    expect(content).toContain("'lz4'");
    expect(content).toContain("'snappy'");
    expect(content).toContain("'adaptive'");
    expect(content).toContain('export type SerializationFormat =');
    expect(content).toContain("'protobuf'");
    expect(content).toContain("'msgpack'");
    expect(content).toContain("export type OptimizationStrategy = 'speed' | 'size' | 'balanced' | 'adaptive';");
    expect(content).toContain('export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;');
  });

  it('declares the full serialize/deserialize + compress surface', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('async serialize(');
    expect(content).toContain('async deserialize(');
    expect(content).toContain('private async performSerialization(');
    expect(content).toContain('private async performDeserialization(');
    expect(content).toContain('private async compress(');
    expect(content).toContain('private async decompress(');
    expect(content).toContain('private promisifyZlib(');
    expect(content).toContain('getCompressionLevel(strategy: OptimizationStrategy): CompressionLevel {');
    expect(content).toContain('getBestCompressionAlgorithm(dataType: string): CompressionType {');
    expect(content).toContain('estimateCompressionRatio(data: Buffer): number {');
    expect(content).toContain('async *serializeStream(');
    expect(content).toContain('getCompressionStats():');
  });

  it('exports the factory and a runnable main example', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('export function createSerializationOptimizer(config: any) {');
    expect(content).toContain('async function main() {');
    expect(content).toContain(`serviceName: '${SERVICE}',`);
    expect(content).toContain('user${i}@example.com');
    expect(content).toContain('if (require.main === module) {');
  });
});

describe('generatePythonOptimizer', () => {
  const result = generateOptimizerConfig(SERVICE).then((cfg) =>
    generatePythonOptimizer(cfg)
  );

  it('returns a single python file plus the gzip/bz2/lzma deps', async () => {
    const { files, dependencies } = await result;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(`${SERVICE}_serialization_optimizer.py`);
    expect(dependencies).toEqual(['gzip', 'bz2', 'lzma', 'zstandard', 'snappy']);
  });

  it('emits imports, enums and the dataclass models', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`# Data Serialization Optimizer for ${SERVICE}`);
    expect(content).toContain('import gzip');
    expect(content).toContain('import bz2');
    expect(content).toContain('import lzma');
    expect(content).toContain('import json');
    expect(content).toContain('from typing import Any, Dict, Optional, Literal');
    expect(content).toContain('from dataclasses import dataclass');
    expect(content).toContain('from enum import Enum');
    expect(content).toContain('import io');
    expect(content).toContain('class CompressionType(Enum):');
    expect(content).toContain('class SerializationFormat(Enum):');
    expect(content).toContain('class OptimizationStrategy(Enum):');
    expect(content).toContain('@dataclass\nclass CompressionResult:');
    expect(content).toContain('@dataclass\nclass SerializationResult:');
    expect(content).toContain('@dataclass\nclass SerializationOptions:');
  });

  it('declares the manager class and its private methods', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`class ${CLASS_NAME}:`);
    expect(content).toContain('def __init__(self, config: Dict[str, Any]):');
    expect(content).toContain('def serialize(self, data: Any, options: Optional[Dict] = None) -> SerializationResult:');
    expect(content).toContain(
      'def deserialize(self, data: bytes, format: str, compressed: bool = False, compression_type: Optional[str] = None) -> Any:'
    );
    expect(content).toContain('def _perform_serialization(self, data: Any, format: SerializationFormat) -> bytes:');
    expect(content).toContain('def _perform_deserialization(self, data: bytes, format: str) -> Any:');
    expect(content).toContain('def _compress(self, data: bytes, algorithm: CompressionType, level: int) -> Dict:');
    expect(content).toContain('def _decompress(self, data: bytes, algorithm: str) -> bytes:');
    expect(content).toContain('def _calculate_compression_ratio(self, original: int, compressed: int) -> float:');
    expect(content).toContain('def get_compression_level(self, strategy: OptimizationStrategy) -> int:');
  });

  it('appends a usage example keyed to the service', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('async def main():');
    expect(content).toContain(`'serviceName': '${SERVICE}',`);
    expect(content).toContain("if __name__ == '__main__':");
  });
});

describe('generateGoOptimizer', () => {
  const result = generateOptimizerConfig(SERVICE).then((cfg) =>
    generateGoOptimizer(cfg)
  );

  it('returns a single go file plus the compress/encoding deps', async () => {
    const { files, dependencies } = await result;
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(`${SERVICE}-serialization-optimizer.go`);
    expect(dependencies).toEqual(['compress/gzip', 'compress/zlib', 'encoding/json']);
  });

  it('declares package main and the required imports', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('package main');
    expect(content).toContain('"compress/gzip"');
    expect(content).toContain('"compress/zlib"');
    expect(content).toContain('"encoding/json"');
    expect(content).toContain('"bytes"');
    expect(content).toContain('"fmt"');
    expect(content).toContain('"time"');
  });

  it('declares the type aliases, constants and result structs', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain('type CompressionType string');
    expect(content).toContain('CompressionNone     CompressionType = "none"');
    expect(content).toContain('CompressionGzip     CompressionType = "gzip"');
    expect(content).toContain('CompressionAdaptive CompressionType = "adaptive"');
    expect(content).toContain('type SerializationFormat string');
    expect(content).toContain('FormatJson     SerializationFormat = "json"');
    expect(content).toContain('type OptimizationStrategy string');
    expect(content).toContain('StrategySpeed     OptimizationStrategy = "speed"');
    expect(content).toContain('StrategyBalanced  OptimizationStrategy = "balanced"');
    expect(content).toContain('type CompressionResult struct {');
    expect(content).toContain('type SerializationResult struct {');
    expect(content).toContain('type SerializationOptions struct {');
  });

  it('declares the constructor and the receiver methods + main', async () => {
    const content = (await result).files[0].content;
    expect(content).toContain(`type ${CLASS_NAME} struct {`);
    expect(content).toContain(
      `func New${CLASS_NAME}(config map[string]interface{}) *${CLASS_NAME} {`
    );
    expect(content).toContain(
      `func (o *${CLASS_NAME}) Serialize(data interface{}, opts *SerializationOptions) (*SerializationResult, error) {`
    );
    expect(content).toContain(
      `func (o *${CLASS_NAME}) performSerialization(data interface{}, format SerializationFormat) ([]byte, error) {`
    );
    expect(content).toContain(
      `func (o *${CLASS_NAME}) compress(data []byte, algorithm CompressionType, level int) ([]byte, int64, error) {`
    );
    expect(content).toContain(
      `func (o *${CLASS_NAME}) Deserialize(data []byte, format SerializationFormat, compressed bool, compressionType CompressionType) (interface{}, error) {`
    );
    expect(content).toContain(`func main() {`);
    expect(content).toContain(`fmt.Sprintf("User %d", i)`);
    expect(content).toContain(`"serviceName":        "${SERVICE}",`);
  });
});

describe('writeOptimizerFiles', () => {
  let out: string;

  beforeEach(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-seropt-'));
  });

  afterEach(async () => {
    await fs.remove(out);
  });

  it('writes the TypeScript source and a TYPESCRIPT BUILD.md', async () => {
    const config = await generateOptimizerConfig(SERVICE);
    const integration = await generateTypeScriptOptimizer(config);
    await writeOptimizerFiles(SERVICE, integration, out, 'typescript');

    expect(await fs.pathExists(path.join(out, `${SERVICE}-serialization-optimizer.ts`))).toBe(true);
    const build = await fs.readFile(path.join(out, 'BUILD.md'), 'utf8');
    expect(build).toContain('# Serialization Optimizer Build Instructions for api-gateway');
    expect(build).toContain('## Language: TYPESCRIPT');
    expect(build).toContain(CLASS_NAME);
    // The written source matches the generator output exactly.
    const written = await fs.readFile(
      path.join(out, `${SERVICE}-serialization-optimizer.ts`),
      'utf8'
    );
    expect(written).toBe(integration.files[0].content);
  });

  it('writes the Python source and a PYTHON BUILD.md', async () => {
    const config = await generateOptimizerConfig(SERVICE);
    const integration = await generatePythonOptimizer(config);
    await writeOptimizerFiles(SERVICE, integration, out, 'python');

    expect(await fs.pathExists(path.join(out, `${SERVICE}_serialization_optimizer.py`))).toBe(true);
    const build = await fs.readFile(path.join(out, 'BUILD.md'), 'utf8');
    expect(build).toContain('## Language: PYTHON');
    expect(build).toContain(SERVICE);
  });

  it('writes the Go source and a GO BUILD.md', async () => {
    const config = await generateOptimizerConfig(SERVICE);
    const integration = await generateGoOptimizer(config);
    await writeOptimizerFiles(SERVICE, integration, out, 'go');

    expect(await fs.pathExists(path.join(out, `${SERVICE}-serialization-optimizer.go`))).toBe(true);
    const build = await fs.readFile(path.join(out, 'BUILD.md'), 'utf8');
    expect(build).toContain('## Language: GO');
    expect(build).toContain(CLASS_NAME);
  });

  it('ensures a nested output directory is created before writing', async () => {
    const config = await generateOptimizerConfig(SERVICE);
    const integration = await generateTypeScriptOptimizer(config);
    const nested = path.join(out, 'nested', 'deep');
    await writeOptimizerFiles(SERVICE, integration, nested, 'typescript');
    expect(await fs.pathExists(path.join(nested, `${SERVICE}-serialization-optimizer.ts`))).toBe(true);
    expect(await fs.pathExists(path.join(nested, 'BUILD.md'))).toBe(true);
  });
});

describe('displayOptimizerConfig', () => {
  it('prints the service, defaults, min-size and the algorithm catalog when enabled', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const config = await generateOptimizerConfig(SERVICE);
      await displayOptimizerConfig(config);
      const out = stripAnsi(spy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n'));
      expect(out).toContain(`Serialization Optimizer: ${SERVICE}`);
      expect(out).toContain('Default Format: json');
      expect(out).toContain('Default Compression: gzip');
      expect(out).toContain('Default Strategy: balanced');
      expect(out).toContain('Compression Enabled: yes');
      expect(out).toContain('Min Size for Compression: 1024 bytes');
      expect(out).toContain('Compression Algorithms:');
      expect(out).toContain('none - No compression');
      expect(out).toContain('gzip - Standard gzip compression (good balance)');
      expect(out).toContain('adaptive - Auto-select based on data characteristics');
      expect(out).toContain('Serialization Formats:');
      expect(out).toContain('json - JSON format (human-readable)');
      expect(out).toContain('Optimization Strategies:');
      expect(out).toContain('speed - Prioritize speed over compression (level 1)');
      expect(out).toContain('Performance Features:');
      expect(out).toContain('Compression ratio calculation');
    } finally {
      spy.mockRestore();
    }
  });

  it('shows the disabled state when compression is toggled off', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const config = await generateOptimizerConfig(SERVICE);
      config.enableCompression = false;
      await displayOptimizerConfig(config);
      const out = stripAnsi(spy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n'));
      expect(out).toContain('Compression Enabled: no');
      expect(out).not.toContain('Compression Enabled: yes');
    } finally {
      spy.mockRestore();
    }
  });
});
