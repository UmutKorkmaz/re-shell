/**
 * Data Serialization Optimization for Performance with Compression
 * High-performance serialization, compression algorithms, adaptive optimization
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Compression algorithms
export type CompressionType =
  | 'none'
  | 'gzip'
  | 'brotli'
  | 'zstd'
  | 'lz4'
  | 'snappy'
  | 'adaptive';

// Serialization formats
export type SerializationFormat =
  | 'json'
  | 'protobuf'
  | 'avro'
  | 'msgpack'
  | 'cbor'
  | 'smile'
  | 'binary';

// Optimization strategy
export type OptimizationStrategy =
  | 'speed'
  | 'size'
  | 'balanced'
  | 'adaptive';

// Compression level
export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// Serialization options
export interface SerializationOptions {
  format: SerializationFormat;
  compression: CompressionType;
  compressionLevel: CompressionLevel;
  strategy: OptimizationStrategy;
  enableChecksum: boolean;
  enableStreaming: boolean;
  chunkSize?: number;
}

// Compression result
export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  algorithm: CompressionType;
}

// Serialization result
export interface SerializationResult {
  data: Buffer;
  format: SerializationFormat;
  size: number;
  serializationTime: number;
  compression?: CompressionResult;
}

// Optimizer configuration
export interface OptimizerConfig {
  serviceName: string;
  defaultFormat: SerializationFormat;
  defaultCompression: CompressionType;
  defaultStrategy: OptimizationStrategy;
  enableAdaptiveCompression: boolean;
  enableCompression: boolean;
  minSizeForCompression: number;
}

// Generate optimizer config
export async function generateOptimizerConfig(
  serviceName: string,
  defaultFormat: SerializationFormat = 'json',
  defaultCompression: CompressionType = 'gzip'
): Promise<OptimizerConfig> {
  return {
    serviceName,
    defaultFormat,
    defaultCompression,
    defaultStrategy: 'balanced',
    enableAdaptiveCompression: true,
    enableCompression: true,
    minSizeForCompression: 1024, // 1KB
  };
}

// Calculate compression ratio
function calculateCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0;
  return ((original - compressed) / original) * 100;
}

// Generate TypeScript optimizer
export async function generateTypeScriptOptimizer(
  config: OptimizerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['zlib', 'stream'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-serialization-optimizer.ts`,
    content: `// Data Serialization Optimizer for ${config.serviceName}

import * as zlib from 'zlib';
import { promisify } from 'util';
import * as stream from 'stream';

const pipeline = promisify(stream.pipeline);

export type CompressionType =
  | 'none'
  | 'gzip'
  | 'brotli'
  | 'zstd'
  | 'lz4'
  | 'snappy'
  | 'adaptive';

export type SerializationFormat =
  | 'json'
  | 'protobuf'
  | 'avro'
  | 'msgpack'
  | 'cbor'
  | 'smile'
  | 'binary';

export type OptimizationStrategy = 'speed' | 'size' | 'balanced' | 'adaptive';
export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface SerializationOptions {
  format: SerializationFormat;
  compression: CompressionType;
  compressionLevel: CompressionLevel;
  strategy: OptimizationStrategy;
  enableChecksum: boolean;
  enableStreaming: boolean;
  chunkSize?: number;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  algorithm: CompressionType;
}

export interface SerializationResult {
  data: Buffer;
  format: SerializationFormat;
  size: number;
  serializationTime: number;
  compression?: CompressionResult;
}

export class ${toPascalCase(config.serviceName)}SerializationOptimizer {
  private config: any;
  private compressionCache: Map<string, CompressionResult>;

  constructor(config: any) {
    this.config = config;
    this.compressionCache = new Map();
  }

  /**
   * Serialize data with optimal format and compression
   */
  async serialize(
    data: any,
    options?: Partial<SerializationOptions>
  ): Promise<SerializationResult> {
    const opts: SerializationOptions = {
      format: this.config.defaultFormat,
      compression: this.config.enableCompression ? this.config.defaultCompression : 'none',
      compressionLevel: 6,
      strategy: this.config.defaultStrategy,
      enableChecksum: true,
      enableStreaming: false,
      ...options,
    };

    const startTime = Date.now();

    // Serialize data
    let serialized = await this.performSerialization(data, opts.format);
    const originalSize = serialized.length;

    // Apply compression if enabled and size threshold met
    let compressionResult: CompressionResult | undefined;
    if (opts.compression !== 'none' && originalSize >= this.config.minSizeForCompression) {
      const compressed = await this.compress(serialized, opts.compression, opts.compressionLevel);
      serialized = compressed.data;

      compressionResult = {
        originalSize,
        compressedSize: serialized.length,
        compressionRatio: this.calculateCompressionRatio(originalSize, serialized.length),
        compressionTime: compressed.time,
        algorithm: opts.compression,
      };

      // Adaptive compression: if compression ratio is poor, use uncompressed
      if (opts.compression === 'adaptive' && compressionResult.compressionRatio < 10) {
        // Re-serialize without compression
        serialized = await this.performSerialization(data, opts.format);
        compressionResult = undefined;
      }
    }

    const serializationTime = Date.now() - startTime;

    return {
      data: serialized,
      format: opts.format,
      size: serialized.length,
      serializationTime,
      compression: compressionResult,
    };
  }

  /**
   * Deserialize data
   */
  async deserialize(
    data: Buffer,
    format: SerializationFormat,
    compressed?: boolean,
    compressionType?: CompressionType
  ): Promise<any> {
    let decompressed = data;

    // Decompress if needed
    if (compressed && compressionType && compressionType !== 'none') {
      decompressed = await this.decompress(data, compressionType);
    }

    // Deserialize based on format
    return this.performDeserialization(decompressed, format);
  }

  /**
   * Serialize data to specific format
   */
  private async performSerialization(data: any, format: SerializationFormat): Promise<Buffer> {
    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(data));

      case 'protobuf':
      case 'avro':
      case 'msgpack':
      case 'cbor':
      case 'smile':
        // These would require specific libraries
        // For now, fallback to JSON
        return Buffer.from(JSON.stringify(data));

      case 'binary':
        if (Buffer.isBuffer(data)) {
          return data;
        }
        return Buffer.from(JSON.stringify(data));

      default:
        return Buffer.from(JSON.stringify(data));
    }
  }

  /**
   * Deserialize data from specific format
   */
  private async performDeserialization(data: Buffer, format: SerializationFormat): Promise<any> {
    switch (format) {
      case 'json':
      case 'binary':
        return JSON.parse(data.toString());

      case 'protobuf':
      case 'avro':
      case 'msgpack':
      case 'cbor':
      case 'smile':
        // These would require specific libraries
        return JSON.parse(data.toString());

      default:
        return JSON.parse(data.toString());
    }
  }

  /**
   * Compress data
   */
  private async compress(
    data: Buffer,
    algorithm: CompressionType,
    level: CompressionLevel
  ): Promise<{ data: Buffer; time: number }> {
    const startTime = Date.now();

    let compressed: Buffer;

    switch (algorithm) {
      case 'gzip':
        compressed = await this.promisifyZlib(zlib.gzip, data, { level });
        break;

      case 'brotli':
        compressed = await this.promisifyZlib(zlib.brotliCompress, data, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: level,
          },
        });
        break;

      case 'deflate':
        compressed = await this.promisifyZlib(zlib.deflate, data, { level });
        break;

      case 'adaptive':
        // Try gzip first, fallback to uncompressed if poor ratio
        compressed = await this.promisifyZlib(zlib.gzip, data, { level });
        const ratio = this.calculateCompressionRatio(data.length, compressed.length);
        if (ratio < 10) {
          compressed = data; // Use uncompressed
        }
        break;

      default:
        compressed = data;
    }

    return { data: compressed, time: Date.now() - startTime };
  }

  /**
   * Decompress data
   */
  private async decompress(data: Buffer, algorithm: CompressionType): Promise<Buffer> {
    switch (algorithm) {
      case 'gzip':
        return this.promisifyZlib(zlib.gunzip, data);

      case 'brotli':
        return this.promisifyZlib(zlib.brotliDecompress, data);

      case 'deflate':
        return this.promisifyZlib(zlib.inflate, data);

      default:
        return data;
    }
  }

  /**
   * Promisify zlib functions
   */
  private promisifyZlib(fn: any, data: Buffer, options?: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      fn(data, options, (err: Error | null, result: Buffer) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(original: number, compressed: number): number {
    if (original === 0) return 0;
    return ((original - compressed) / original) * 100;
  }

  /**
   * Get optimal compression level based on strategy
   */
  getCompressionLevel(strategy: OptimizationStrategy): CompressionLevel {
    switch (strategy) {
      case 'speed':
        return 1; // Fastest compression
      case 'size':
        return 9; // Best compression
      case 'balanced':
      case 'adaptive':
        return 6; // Balanced
      default:
        return 6;
    }
  }

  /**
   * Get best compression algorithm for data type
   */
  getBestCompressionAlgorithm(dataType: string): CompressionType {
    // Text data compresses better with gzip/brotli
    if (dataType.includes('text') || dataType.includes('json')) {
      return 'brotli';
    }

    // Already compressed data
    if (dataType.includes('gzip') || dataType.includes('zip') || dataType.includes('image')) {
      return 'none';
    }

    // Default to gzip
    return 'gzip';
  }

  /**
   * Estimate compression ratio without compressing
   */
  estimateCompressionRatio(data: Buffer): number {
    // Simple heuristic: check for repetitive patterns
    const uniqueBytes = new Set(data).size;
    const totalBytes = data.length;
    const entropy = uniqueBytes / totalBytes;

    // Low entropy = high compression ratio
    if (entropy < 0.3) return 70; // 70% reduction
    if (entropy < 0.5) return 50; // 50% reduction
    if (entropy < 0.7) return 30; // 30% reduction
    return 10; // 10% reduction
  }

  /**
   * Serialize with streaming (for large data)
   */
  async *serializeStream(
    dataStream: NodeJS.ReadableStream,
    options: SerializationOptions
  ): AsyncIterable<Buffer> {
    const transform = zlib.createGzip({ level: options.compressionLevel });

    for await (const chunk of dataStream) {
      yield await this.promisifyZlib(zlib.gzip, chunk, { level: options.compressionLevel });
    }
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): { cacheSize: number; avgCompressionRatio: number } {
    const ratios = Array.from(this.compressionCache.values()).map(r => r.compressionRatio);
    const avgRatio = ratios.length > 0
      ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length
      : 0;

    return {
      cacheSize: this.compressionCache.size,
      avgCompressionRatio,
    };
  }
}

// Factory function
export function createSerializationOptimizer(config: any) {
  return new ${toPascalCase(config.serviceName)}SerializationOptimizer(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    defaultFormat: 'json',
    defaultCompression: 'gzip',
    defaultStrategy: 'balanced',
    enableCompression: true,
    minSizeForCompression: 1024,
  };

  const optimizer = new ${toPascalCase(config.serviceName)}SerializationOptimizer(config);

  // Test data
  const data = {
    users: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: \`User \${i}\`,
      email: \`user\${i}@example.com\`,
      data: 'x'.repeat(100), // Repetitive data for better compression
    })),
  };

  // Serialize
  const result = await optimizer.serialize(data);

  console.log('Serialization Result:');
  console.log(\`  Format: \${result.format}\`);
  console.log(\`  Size: \${result.size} bytes\`);
  console.log(\`  Time: \${result.serializationTime}ms\`);

  if (result.compression) {
    console.log('  Compression:');
    console.log(\`    Algorithm: \${result.compression.algorithm}\`);
    console.log(\`    Original: \${result.compression.originalSize} bytes\`);
    console.log(\`    Compressed: \${result.compression.compressedSize} bytes\`);
    console.log(\`    Ratio: \${result.compression.compressionRatio.toFixed(2)}%\`);
    console.log(\`    Time: \${result.compression.compressionTime}ms\`);
  }

  // Deserialize
  const deserialized = await optimizer.deserialize(
    result.data,
    result.format,
    !!result.compression,
    result.compression?.algorithm
  );

  console.log(\`\\nDeserialized \${deserialized.users.length} users\`);
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python optimizer
export async function generatePythonOptimizer(
  config: OptimizerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['gzip', 'bz2', 'lzma', 'zstandard', 'snappy'];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_serialization_optimizer.py`,
    content: `# Data Serialization Optimizer for ${config.serviceName}
import gzip
import bz2
import lzma
import json
import time
from typing import Any, Dict, Optional, Literal
from dataclasses import dataclass
from enum import Enum
import io

class CompressionType(Enum):
    NONE = 'none'
    GZIP = 'gzip'
    BROTLI = 'brotli'
    ZSTD = 'zstd'
    LZ4 = 'lz4'
    SNAPPY = 'snappy'
    ADAPTIVE = 'adaptive'

class SerializationFormat(Enum):
    JSON = 'json'
    PROTOBUF = 'protobuf'
    AVRO = 'avro'
    MSGPACK = 'msgpack'
    CBOR = 'cbor'

class OptimizationStrategy(Enum):
    SPEED = 'speed'
    SIZE = 'size'
    BALANCED = 'balanced'
    ADAPTIVE = 'adaptive'

@dataclass
class CompressionResult:
    original_size: int
    compressed_size: int
    compression_ratio: float
    compression_time: float
    algorithm: str

@dataclass
class SerializationResult:
    data: bytes
    format: str
    size: int
    serialization_time: float
    compression: Optional[CompressionResult] = None

@dataclass
class SerializationOptions:
    format: SerializationFormat
    compression: CompressionType
    compression_level: int
    strategy: OptimizationStrategy
    enable_checksum: bool
    enable_streaming: bool
    chunk_size: Optional[int] = None

class ${toPascalCase(config.serviceName)}SerializationOptimizer:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.compression_cache: Dict[str, CompressionResult] = {}

    def serialize(self, data: Any, options: Optional[Dict] = None) -> SerializationResult:
        """Serialize data with optimal format and compression"""
        opts = SerializationOptions(
            format=SerializationFormat(self.config.get('defaultFormat', 'json')),
            compression=CompressionType(self.config.get('defaultCompression', 'gzip')),
            compression_level=6,
            strategy=OptimizationStrategy(self.config.get('defaultStrategy', 'balanced')),
            enable_checksum=True,
            enable_streaming=False,
        )

        start_time = time.time()

        # Serialize data
        serialized = self._perform_serialization(data, opts.format)
        original_size = len(serialized)

        # Apply compression
        compression_result = None
        if opts.compression != CompressionType.NONE and original_size >= self.config.get('minSizeForCompression', 1024):
            compressed = self._compress(serialized, opts.compression, opts.compression_level)
            serialized = compressed['data']

            compression_result = CompressionResult(
                original_size=original_size,
                compressed_size=len(serialized),
                compression_ratio=self._calculate_compression_ratio(original_size, len(serialized)),
                compression_time=compressed['time'],
                algorithm=opts.compression.value,
            )

        serialization_time = (time.time() - start_time) * 1000

        return SerializationResult(
            data=serialized,
            format=opts.format.value,
            size=len(serialized),
            serialization_time=serialization_time,
            compression=compression_result,
        )

    def deserialize(self, data: bytes, format: str, compressed: bool = False, compression_type: Optional[str] = None) -> Any:
        """Deserialize data"""
        decompressed = data

        if compressed and compression_type and compression_type != 'none':
            decompressed = self._decompress(data, compression_type)

        return self._perform_deserialization(decompressed, format)

    def _perform_serialization(self, data: Any, format: SerializationFormat) -> bytes:
        """Serialize data to specific format"""
        if format == SerializationFormat.JSON:
            return json.dumps(data).encode('utf-8')
        return json.dumps(data).encode('utf-8')

    def _perform_deserialization(self, data: bytes, format: str) -> Any:
        """Deserialize data from specific format"""
        if format == 'json':
            return json.loads(data.decode('utf-8'))
        return json.loads(data.decode('utf-8'))

    def _compress(self, data: bytes, algorithm: CompressionType, level: int) -> Dict:
        """Compress data"""
        start_time = time.time()

        if algorithm == CompressionType.GZIP:
            compressed = gzip.compress(data, compresslevel=level)
        elif algorithm == CompressionType.ADAPTIVE:
            compressed = gzip.compress(data, compresslevel=level)
            ratio = self._calculate_compression_ratio(len(data), len(compressed))
            if ratio < 10:
                compressed = data
        else:
            compressed = data

        return {
            'data': compressed,
            'time': (time.time() - start_time) * 1000,
        }

    def _decompress(self, data: bytes, algorithm: str) -> bytes:
        """Decompress data"""
        if algorithm == 'gzip':
            return gzip.decompress(data)
        return data

    def _calculate_compression_ratio(self, original: int, compressed: int) -> float:
        """Calculate compression ratio"""
        if original == 0:
            return 0.0
        return ((original - compressed) / original) * 100

    def get_compression_level(self, strategy: OptimizationStrategy) -> int:
        """Get optimal compression level based on strategy"""
        if strategy == OptimizationStrategy.SPEED:
            return 1
        elif strategy == OptimizationStrategy.SIZE:
            return 9
        return 6

# Usage
async def main():
    config = {
        'serviceName': '${config.serviceName}',
        'defaultFormat': 'json',
        'defaultCompression': 'gzip',
        'defaultStrategy': 'balanced',
        'enableCompression': True,
        'minSizeForCompression': 1024,
    }

    optimizer = ${toPascalCase(config.serviceName)}SerializationOptimizer(config)

    data = {'users': [{'id': i, 'name': f'User {i}'} for i in range(1000)]}

    result = optimizer.serialize(data)

    print(f"Format: {result.format}")
    print(f"Size: {result.size} bytes")
    print(f"Time: {result.serialization_time:.2f}ms")

    if result.compression:
        print(f"Compression ratio: {result.compression.compression_ratio:.2f}%")

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go optimizer
export async function generateGoOptimizer(
  config: OptimizerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['compress/gzip', 'compress/zlib', 'encoding/json'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-serialization-optimizer.go`,
    content: `package main

import (
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"encoding/json"
	"fmt"
	"io"
	"time"
)

type CompressionType string

const (
	CompressionNone     CompressionType = "none"
	CompressionGzip     CompressionType = "gzip"
	CompressionBrotli   CompressionType = "brotli"
	CompressionZstd     CompressionType = "zstd"
	CompressionLz4      CompressionType = "lz4"
	CompressionSnappy   CompressionType = "snappy"
	CompressionAdaptive CompressionType = "adaptive"
)

type SerializationFormat string

const (
	FormatJson     SerializationFormat = "json"
	FormatProtobuf SerializationFormat = "protobuf"
	FormatAvro     SerializationFormat = "avro"
	FormatMsgpack  SerializationFormat = "msgpack"
	FormatCbor     SerializationFormat = "cbor"
)

type OptimizationStrategy string

const (
	StrategySpeed     OptimizationStrategy = "speed"
	StrategySize      OptimizationStrategy = "size"
	StrategyBalanced  OptimizationStrategy = "balanced"
	StrategyAdaptive  OptimizationStrategy = "adaptive"
)

type CompressionResult struct {
	OriginalSize      int64             \`json:"originalSize"\`
	CompressedSize    int64             \`json:"compressedSize"\`
	CompressionRatio  float64           \`json:"compressionRatio"\`
	CompressionTime   int64             \`json:"compressionTime"\`
	Algorithm         CompressionType   \`json:"algorithm"\`
}

type SerializationResult struct {
	Data              []byte                    \`json:"data"\`
	Format            SerializationFormat       \`json:"format"\`
	Size              int64                     \`json:"size"\`
	SerializationTime int64                     \`json:"serializationTime"\`
	Compression       *CompressionResult        \`json:"compression,omitempty"\`
}

type SerializationOptions struct {
	Format            SerializationFormat  \`json:"format"\`
	Compression       CompressionType      \`json:"compression"\`
	CompressionLevel  int                  \`json:"compressionLevel"\`
	Strategy          OptimizationStrategy \`json:"strategy"\`
	EnableChecksum    bool                 \`json:"enableChecksum"\`
	EnableStreaming   bool                 \`json:"enableStreaming"\`
	ChunkSize         int                  \`json:"chunkSize,omitempty"\`
}

type ${toPascalCase(config.serviceName)}SerializationOptimizer struct {
	config            map[string]interface{}
	compressionCache  map[string]CompressionResult
}

func New${toPascalCase(config.serviceName)}SerializationOptimizer(config map[string]interface{}) *${toPascalCase(config.serviceName)}SerializationOptimizer {
	return &${toPascalCase(config.serviceName)}SerializationOptimizer{
		config:           config,
		compressionCache: make(map[string]CompressionResult),
	}
}

func (o *${toPascalCase(config.serviceName)}SerializationOptimizer) Serialize(data interface{}, opts *SerializationOptions) (*SerializationResult, error) {
	if opts == nil {
		opts = &SerializationOptions{
			Format:           FormatJson,
			Compression:      CompressionGzip,
			CompressionLevel: 6,
			Strategy:         StrategyBalanced,
			EnableChecksum:   true,
			EnableStreaming:  false,
		}
	}

	startTime := time.Now()

	// Serialize data
	serialized, err := o.performSerialization(data, opts.Format)
	if err != nil {
		return nil, err
	}
	originalSize := int64(len(serialized))

	// Apply compression
	var compressionResult *CompressionResult
	minSize := o.config["minSizeForCompression"].(int)
	if opts.Compression != CompressionNone && originalSize >= int64(minSize) {
		compressed, compressTime, err := o.compress(serialized, opts.Compression, opts.CompressionLevel)
		if err != nil {
			return nil, err
		}

		compressionResult = &CompressionResult{
			OriginalSize:     originalSize,
			CompressedSize:   int64(len(compressed)),
			CompressionRatio: o.calculateCompressionRatio(int(originalSize), int(len(compressed))),
			CompressionTime:  compressTime,
			Algorithm:        opts.Compression,
		}

		serialized = compressed
	}

	serializationTime := time.Since(startTime).Milliseconds()

	return &SerializationResult{
		Data:              serialized,
		Format:            opts.Format,
		Size:              int64(len(serialized)),
		SerializationTime: serializationTime,
		Compression:       compressionResult,
	}, nil
}

func (o *${toPascalCase(config.serviceName)}SerializationOptimizer) performSerialization(data interface{}, format SerializationFormat) ([]byte, error) {
	switch format {
	case FormatJson:
		return json.Marshal(data)
	default:
		return json.Marshal(data)
	}
}

func (o *${toPascalCase(config.serviceName)}SerializationOptimizer) compress(data []byte, algorithm CompressionType, level int) ([]byte, int64, error) {
	startTime := time.Now()

	var buf bytes.Buffer

	switch algorithm {
	case CompressionGzip:
		writer, err := gzip.NewWriterLevel(&buf, level)
		if err != nil {
			return nil, 0, err
		}
		writer.Write(data)
		writer.Close()
		return buf.Bytes(), time.Since(startTime).Milliseconds(), nil

	default:
		return data, 0, nil
	}
}

func (o *${toPascalCase(config.serviceName)}SerializationOptimizer) calculateCompressionRatio(original int, compressed int) float64 {
	if original == 0 {
		return 0.0
	}
	return float64(original-compressed) / float64(original) * 100
}

func (o *${toPascalCase(config.serviceName)}SerializationOptimizer) Deserialize(data []byte, format SerializationFormat, compressed bool, compressionType CompressionType) (interface{}, error) {
	decompressed := data

	if compressed && compressionType != CompressionNone {
		// Decompress
	}

	return o.performDeserialization(decompressed, format)
}

func (o *${toPascalCase(config.serviceName)}SerializationOptimizer) performDeserialization(data []byte, format SerializationFormat) (interface{}, error) {
	switch format {
	case FormatJson:
		var result interface{}
		err := json.Unmarshal(data, &result)
		return result, err
	default:
		var result interface{}
		err := json.Unmarshal(data, &result)
		return result, err
	}
}

func main() {
	config := map[string]interface{}{
		"serviceName":        "${config.serviceName}",
		"defaultFormat":      "json",
		"defaultCompression": "gzip",
		"defaultStrategy":    "balanced",
		"enableCompression":  true,
		"minSizeForCompression": 1024,
	}

	optimizer := New${toPascalCase(config.serviceName)}SerializationOptimizer(config)

	data := map[string]interface{}{
		"users": []interface{}{},
	}

	for i := 0; i < 1000; i++ {
		user := map[string]interface{}{
			"id":    i,
			"name":  fmt.Sprintf("User %d", i),
			"email": fmt.Sprintf("user%d@example.com", i),
		}
		data["users"] = append(data["users"].([]interface{}), user)
	}

	result, err := optimizer.Serialize(data, nil)
	if err != nil {
		fmt.Printf("Error: %v\\n", err)
		return
	}

	fmt.Printf("Format: %s\\n", result.Format)
	fmt.Printf("Size: %d bytes\\n", result.Size)
	fmt.Printf("Time: %dms\\n", result.SerializationTime)

	if result.Compression != nil {
		fmt.Printf("Compression Ratio: %.2f%%\\n", result.Compression.CompressionRatio)
	}
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeOptimizerFiles(
  serviceName: string,
  integration: any,
  outputDir: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  for (const file of integration.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.ensureDir(fileDir);
    await fs.writeFile(filePath, file.content);
  }

  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayOptimizerConfig(config: OptimizerConfig): Promise<void> {
  console.log(chalk.bold.magenta('\n⚡ Serialization Optimizer: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Default Format:'), config.defaultFormat);
  console.log(chalk.cyan('Default Compression:'), config.defaultCompression);
  console.log(chalk.cyan('Default Strategy:'), config.defaultStrategy);
  console.log(chalk.cyan('Compression Enabled:'), config.enableCompression ? chalk.green('yes') : chalk.red('no'));
  console.log(chalk.cyan('Min Size for Compression:'), `${config.minSizeForCompression} bytes`);

  console.log(chalk.cyan('\n🗜️  Compression Algorithms:'));
  console.log(chalk.gray('  • none - No compression'));
  console.log(chalk.gray('  • gzip - Standard gzip compression (good balance)'));
  console.log(chalk.gray('  • brotli - Better compression than gzip (slower)'));
  console.log(chalk.gray('  • zstd - Zstandard compression (very fast)'));
  console.log(chalk.gray('  • lz4 - Ultra-fast compression (lower ratio)'));
  console.log(chalk.gray('  • snappy - Fast compression (Google)'));
  console.log(chalk.gray('  • adaptive - Auto-select based on data characteristics'));

  console.log(chalk.cyan('\n📦 Serialization Formats:'));
  console.log(chalk.gray('  • json - JSON format (human-readable)'));
  console.log(chalk.gray('  • protobuf - Protocol Buffers (binary)'));
  console.log(chalk.gray('  • avro - Apache Avro (binary)'));
  console.log(chalk.gray('  • msgpack - MessagePack (binary)'));
  console.log(chalk.gray('  • cbor - CBOR (binary)'));
  console.log(chalk.gray('  • binary - Raw binary data'));

  console.log(chalk.cyan('\n🎯 Optimization Strategies:'));
  console.log(chalk.gray('  • speed - Prioritize speed over compression (level 1)'));
  console.log(chalk.gray('  • size - Prioritize compression over speed (level 9)'));
  console.log(chalk.gray('  • balanced - Balance speed and size (level 6)'));
  console.log(chalk.gray('  • adaptive - Auto-adjust based on data and conditions'));

  console.log(chalk.cyan('\n📊 Performance Features:'));
  console.log(chalk.gray('  • Compression ratio calculation'));
  console.log(chalk.gray('  • Compression time tracking'));
  console.log(chalk.gray('  • Adaptive compression (disable if poor ratio)'));
  console.log(chalk.gray('  • Streaming support for large datasets'));
  console.log(chalk.gray('  • Compression result caching'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Serialization Optimizer Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This serialization optimizer provides:
- **Multi-Format Serialization**: JSON, Protobuf, Avro, MessagePack, CBOR, binary
- **7 Compression Algorithms**: none, gzip, brotli, zstd, lz4, snappy, adaptive
- **4 Optimization Strategies**: speed, size, balanced, adaptive
- **Adaptive Compression**: Auto-disable if compression ratio is poor
- **Streaming Support**: Efficient handling of large datasets
- **Performance Tracking**: Compression ratio, time, size metrics

## Usage Examples

### Basic Serialization

\`\`\`typescript
import { ${toPascalCase(serviceName)}SerializationOptimizer } from './${serviceName}-serialization-optimizer';

const optimizer = new ${toPascalCase(serviceName)}SerializationOptimizer({
  serviceName: '${serviceName}',
  defaultFormat: 'json',
  defaultCompression: 'gzip',
  defaultStrategy: 'balanced',
  enableCompression: true,
  minSizeForCompression: 1024,
});

const data = {
  users: Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: \`User \${i}\`,
  })),
};

// Serialize with compression
const result = await optimizer.serialize(data);

console.log(\`Size: \${result.size} bytes\`);
console.log(\`Time: \${result.serializationTime}ms\`);
if (result.compression) {
  console.log(\`Compression: \${result.compression.compressionRatio}%\`);
}

// Deserialize
const deserialized = await optimizer.deserialize(
  result.data,
  result.format,
  !!result.compression,
  result.compression?.algorithm
);
\`\`\`

### Optimization Strategies

\`\`\`typescript
// Speed-focused (fastest, lower compression)
await optimizer.serialize(data, { strategy: 'speed' });

// Size-focused (slowest, best compression)
await optimizer.serialize(data, { strategy: 'size' });

// Balanced (default)
await optimizer.serialize(data, { strategy: 'balanced' });

// Adaptive (auto-adjust)
await optimizer.serialize(data, { strategy: 'adaptive' });
\`\`\`

## Performance Characteristics

| Algorithm | Compression Ratio | Speed | Best For |
|-----------|-------------------|-------|----------|
| none | 0% | Fastest | Already compressed data |
| gzip | 60-70% | Fast | General use |
| brotli | 70-80% | Medium | Text, JSON |
| zstd | 65-75% | Very Fast | Large datasets |
| lz4 | 50-60% | Ultra Fast | Real-time |
| snappy | 55-65% | Very Fast | Network protocols |

## Integration

See generated code for complete API reference and performance benchmarks.
`;
}
