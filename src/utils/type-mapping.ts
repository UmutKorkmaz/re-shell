/**
 * Cross-Language Data Type Mapping and Serialization
 * Provides type mappings between TypeScript and other programming languages
 * for API communication, serialization, and data exchange
 */

// Type mapping from TypeScript to target languages
export interface TypeMapping {
  typescript: string;
  jsonSchema?: string;
  python?: string;
  java?: string;
  go?: string;
  rust?: string;
  csharp?: string;
  php?: string;
  ruby?: string;
  kotlin?: string;
  swift?: string;
  description?: string;
  serializationNotes?: string;
}

/**
 * Type mappings for common data types
 */
export const TYPE_MAPPINGS: TypeMapping[] = [
  // Primitives
  {
    typescript: 'string',
    jsonSchema: 'string',
    python: 'str',
    java: 'String',
    go: 'string',
    rust: 'String',
    csharp: 'string',
    php: 'string',
    ruby: 'String',
    kotlin: 'String',
    swift: 'String',
    description: 'UTF-8 encoded string',
    serializationNotes: 'Serialized as UTF-8 JSON string'
  },
  {
    typescript: 'number',
    jsonSchema: 'number',
    python: 'float',
    java: 'Double',
    go: 'float64',
    rust: 'f64',
    csharp: 'double',
    php: 'float',
    ruby: 'Float',
    kotlin: 'Double',
    swift: 'Double',
    description: '64-bit floating point number',
    serializationNotes: 'Use for general numeric values, may lose precision for large integers'
  },
  {
    typescript: 'number',
    jsonSchema: 'integer',
    python: 'int',
    java: 'Long',
    go: 'int64',
    rust: 'i64',
    csharp: 'long',
    php: 'int',
    ruby: 'Integer',
    kotlin: 'Long',
    swift: 'Int',
    description: '64-bit signed integer',
    serializationNotes: 'Use for ID fields and counters, JSON numbers are parsed as integers'
  },
  {
    typescript: 'boolean',
    jsonSchema: 'boolean',
    python: 'bool',
    java: 'Boolean',
    go: 'bool',
    rust: 'bool',
    csharp: 'bool',
    php: 'bool',
    ruby: 'TrueClass/FalseClass',
    kotlin: 'Boolean',
    swift: 'Bool',
    description: 'Boolean true/false value',
    serializationNotes: 'Serialized as JSON true/false'
  },
  // Date/Time
  {
    typescript: 'Date',
    jsonSchema: 'string-format-date-time',
    python: 'datetime.datetime',
    java: 'Instant',
    go: 'time.Time',
    rust: 'chrono::DateTime<UTC>',
    csharp: 'DateTimeOffset',
    php: 'DateTime',
    ruby: 'Time',
    kotlin: 'Instant',
    swift: 'Date',
    description: 'ISO 8601 date-time string',
    serializationNotes: 'Serialize as ISO 8601 string (e.g., "2024-01-15T10:30:00Z")'
  },
  {
    typescript: 'string',
    jsonSchema: 'string-format-date',
    python: 'datetime.date',
    java: 'LocalDate',
    go: 'time.Time', // Use custom type for date only
    rust: 'chrono::NaiveDate',
    csharp: 'DateTime',
    php: 'DateTime (format Y-m-d)',
    ruby: 'Date',
    kotlin: 'LocalDate',
    swift: 'Date',
    description: 'ISO 8601 date string (YYYY-MM-DD)',
    serializationNotes: 'Serialize as ISO 8601 date string without time component'
  },
  // Collections
  {
    typescript: 'Array<T>',
    jsonSchema: 'array',
    python: 'list[T]',
    java: 'List<T>',
    go: '[]T',
    rust: 'Vec<T>',
    csharp: 'List<T>',
    php: 'array',
    ruby: 'Array',
    kotlin: 'List<T>',
    swift: 'Array<T>',
    description: 'Ordered collection of items',
    serializationNotes: 'Serialized as JSON array'
  },
  {
    typescript: 'Record<string, T>',
    jsonSchema: 'object',
    python: 'dict[str, T]',
    java: 'Map<String, T>',
    go: 'map[string]T',
    rust: 'std::collections::HashMap<String, T>',
    csharp: 'Dictionary<string, T>',
    php: 'array', // PHP arrays are maps
    ruby: 'Hash',
    kotlin: 'Map<String, T>',
    swift: 'Dictionary<String, T>',
    description: 'Key-value mapping',
    serializationNotes: 'Serialized as JSON object with string keys'
  },
  // Nullable
  {
    typescript: 'T | null',
    jsonSchema: 'oneOf [type, null]',
    python: 'Optional[T]',
    java: 'T | null',
    go: '*T', // Pointer for nullability
    rust: 'Option<T>',
    csharp: 'T?',
    php: '?T',
    ruby: 'T | nil',
    kotlin: 'T?',
    swift: 'T?',
    description: 'Nullable value',
    serializationNotes: 'Serialized as JSON null'
  },
  // Special types
  {
    typescript: 'Buffer',
    jsonSchema: 'string-format-base64',
    python: 'bytes',
    java: 'byte[]',
    go: '[]byte',
    rust: 'Vec<u8>',
    csharp: 'byte[]',
    php: 'string (base64 encoded)',
    ruby: 'String (base64 encoded)',
    kotlin: 'ByteArray',
    swift: 'Data',
    description: 'Binary data',
    serializationNotes: 'Serialize as base64 encoded string'
  },
  {
    typescript: 'bigint',
    jsonSchema: 'string', // Use string for precision
    python: 'int',
    java: 'BigInteger',
    go: 'big.Int',
    rust: 'num::BigInt',
    csharp: 'BigInteger',
    php: 'int', // May overflow
    ruby: 'Integer',
    kotlin: 'BigInteger',
    swift: 'Int (or custom BigInt)',
    description: 'Arbitrary precision integer',
    serializationNotes: 'Serialize as string to preserve precision'
  }
];

/**
 * Get the equivalent type in target language for a TypeScript type
 */
export function mapType(sourceType: string, targetLanguage: string): string | null {
  // Find matching type mapping
  const mapping = TYPE_MAPPINGS.find(m => m.typescript === sourceType);
  if (!mapping) return null;

  // Get the target language type
  const key = targetLanguage.toLowerCase() as keyof TypeMapping;
  if (key in mapping && mapping[key]) {
    return mapping[key] as string;
  }

  return null;
}

/**
 * Generate serialization code for a TypeScript type to target language
 */
export function generateSerializationCode(
  sourceType: string,
  targetLanguage: string,
  variableName = 'value'
): string {
  const templates: Record<string, string> = {
    python: `json.dumps(${variableName}.isoformat()) if isinstance(${variableName}, datetime.datetime) else ${variableName}`,
    java: `objectMapper.writeValueAsString(${variableName})`,
    go: `json.Marshal(${variableName})`,
    rust: `serde_json::to_string(&${variableName}).unwrap()`,
    csharp: `JsonSerializer.Serialize(${variableName})`,
    php: `json_encode(${variableName})`,
    ruby: `(${variableName}.respond_to?(:to_json) ? ${variableName}.to_json : JSON.generate(${variableName}))`,
    kotlin: `jacksonObjectMapper.writeValueAsString(${variableName})`,
    swift: `String(data: try? JSONEncoder().encode(${variableName}))`
  };

  return templates[targetLanguage.toLowerCase()] || `JSON.stringify(${variableName})`;
}

/**
 * Generate deserialization code for a JSON value to target language type
 */
export function generateDeserializationCode(
  sourceType: string,
  targetLanguage: string,
  variableName = 'json'
): string {
  const templates: Record<string, string> = {
    python: `json.loads(${variableName})`,
    java: `objectMapper.readValue(${variableName}, type.class)`,
    go: `var result Type; json.Unmarshal([]byte(${variableName}), &result); return &result`,
    rust: `serde_json::from_str::<Type>(&${variableName}).unwrap()`,
    csharp: `JsonSerializer.Deserialize<Type>(${variableName})`,
    php: `json_decode(${variableName}, true)`,
    ruby: `JSON.parse(${variableName})`,
    kotlin: `jacksonObjectMapper.readValue(${variableName}, type.class)`,
    swift: `JSONDecoder().decode(Type.self, from: ${variableName}.data(using: .utf8)!)`
  };

  return templates[targetLanguage.toLowerCase()] || `JSON.parse(${variableName})`;
}

/**
 * Get JSON Schema type for a TypeScript type
 */
export function getJsonSchemaType(typescriptType: string): string {
  const mapping = TYPE_MAPPINGS.find(m => m.typescript === typescriptType);
  return mapping?.jsonSchema || 'string';
}

/**
 * Format validation regex patterns for different data types
 */
export const VALIDATION_PATTERNS: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  url: /^https?:\/\/.+/,
  phoneNumber: /^\+?[1-9]\d{1,14}$/,
  iso8601DateTime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
  iso8601Date: /^\d{4}-\d{2}-\d{2}$/,
  base64: /^[A-Za-z0-9+/]*={0,2}$/,
  latitude: /^-?([1-8]?\d(\.\d+)?|90(\.0+)?)$/,
  longitude: /^-?([1]?\d{1,2}(\.\d+)?|180(\.0+)?)$/
};

/**
 * Serialize value to JSON with proper type handling
 */
export function serializeValue(value: unknown, type: string): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  switch (type) {
    case 'Date':
      return `"${new Date(value as string).toISOString()}"`;
    case 'Buffer':
      return `"${(value as Buffer).toString('base64')}"`;
    case 'bigint':
      return `"${value}"`; // Serialize as string for precision
    default:
      return JSON.stringify(value);
  }
}

/**
 * Deserialize JSON value to proper type
 */
export function deserializeValue(value: unknown, type: string): unknown {
  if (value === null) return null;

  switch (type) {
    case 'Date':
      return new Date(value as string);
    case 'Buffer':
      return Buffer.from(value as string, 'base64');
    case 'bigint':
      return BigInt(value as string);
    default:
      return value;
  }
}

/**
 * Generate type definition file for target language
 */
export function generateTypeDefinition(
  typeName: string,
  properties: Record<string, { type: string; required: boolean; description?: string }>,
  targetLanguage: string
): string {
  const lines: string[] = [];

  switch (targetLanguage.toLowerCase()) {
    case 'python':
      lines.push('from typing import Optional');
      lines.push('from datetime import datetime');
      lines.push('from dataclasses import dataclass');
      lines.push('');
      lines.push(`@dataclass`);
      lines.push(`class ${typeName}:`);
      Object.entries(properties).forEach(([name, info]) => {
        const pyType = mapType(info.type, 'python') || 'Any';
        const optional = !info.required ? ' = None' : '';
        lines.push(`    ${name}: Optional[${pyType}]${optional}`);
      });
      break;

    case 'java':
      lines.push('import com.fasterxml.jackson.annotation.*;');
      lines.push('import java.time.Instant;');
      lines.push('');
      lines.push(`public class ${typeName} {`);
      Object.entries(properties).forEach(([name, info]) => {
        const javaType = mapType(info.type, 'java') || 'Object';
        lines.push(`  private ${javaType} ${name};`);
      });
      lines.push('');
      // Add getters/setters
      Object.entries(properties).forEach(([name, info]) => {
        const javaType = mapType(info.type, 'java') || 'Object';
        lines.push(`  public ${javaType} get${capitalize(name)}() { return ${name}; }`);
        lines.push(`  public void set${capitalize(name)}(${javaType} ${name}) { this.${name} = ${name}; }`);
      });
      lines.push('}');
      break;

    case 'go':
      lines.push('package main');
      lines.push('');
      lines.push(`type ${typeName} struct {`);
      Object.entries(properties).forEach(([name, info]) => {
        const goType = mapType(info.type, 'go') || 'interface{}';
        const jsonTag = info.required ? `\\"${name}\\"` : `\\"${name}\\",\\"omitempty\\"`;
        lines.push(`  ${capitalize(name)} ${goType} \` ` + jsonTag + '`');
      });
      lines.push('}');
      break;

    default:
      lines.push(`// Type definition for ${typeName} in ${targetLanguage}`);
  }

  return lines.join('\n');
}

// Utility functions
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate enum mapping between languages
 */
export function generateEnumMapping(
  enumName: string,
  values: string[],
  targetLanguage: string
): string {
  const lines: string[] = [];

  switch (targetLanguage.toLowerCase()) {
    case 'python':
      lines.push(`from enum import Enum`);
      lines.push('');
      lines.push(`class ${enumName}(Enum):`);
      values.forEach((value, i) => {
        lines.push(`    ${value.toUpperCase()} = "${value}"`);
      });
      break;

    case 'java':
      lines.push(`public enum ${enumName} {`);
      values.forEach((value, i) => {
        lines.push(`  ${value.toUpperCase()}("${value}")${i < values.length - 1 ? ',' : ''};`);
      });
      lines.push('}');
      break;

    case 'go':
      lines.push(`type ${enumName} string`);
      lines.push('');
      lines.push(`const (`);
      values.forEach((value, i) => {
        lines.push(`  ${enumName}${capitalize(value)} ${enumName} = "${value}"${i < values.length - 1 ? '' : ','}`);
      });
      lines.push(`)`);
      break;

    default:
      lines.push(`// Enum ${enumName} for ${targetLanguage}`);
  }

  return lines.join('\n');
}

/**
 * Get serialization notes for a TypeScript type
 */
export function getSerializationNotes(typescriptType: string): string {
  const mapping = TYPE_MAPPINGS.find(m => m.typescript === typescriptType);
  return mapping?.serializationNotes || 'No specific notes for this type';
}

/**
 * Type coercion helpers for cross-language communication
 */
export const COERCION_HELPERS: Record<string, string> = {
  'string->number': 'parseFloat(value) || 0',
  'string->boolean': 'value.toLowerCase() === "true"',
  'string->Date': 'new Date(value)',
  'number->boolean': 'value !== 0',
  'boolean->string': 'String(value)',
  'Date->string': 'value.toISOString()',
  'Array->string': 'JSON.stringify(value)',
  'Object->string': 'JSON.stringify(value)'
};

/**
 * Generate type adapter for cross-language communication
 */
export function generateTypeAdapter(
  sourceType: string,
  targetType: string,
  adapterName: string
): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Type adapter: ${sourceType} -> ${targetType}`);
  lines.push(` * Generated automatically`);
  lines.push(` */`);
  lines.push(`export class ${adapterName} {`);
  lines.push('');
  lines.push(`  /**`);
  lines.push(`   * Convert ${sourceType} to ${targetType}`);
  lines.push(`   */`);
  lines.push(`  static toTarget(value: ${sourceType}): ${targetType} {`);
  lines.push(`    return ${COERCION_HELPERS[`${sourceType}->${targetType}`] || 'value'};`);
  lines.push(`  }`);
  lines.push('');
  lines.push(`  /**`);
  lines.push(`   * Convert ${targetType} to ${sourceType}`);
  lines.push(`   */`);
  lines.push(`  static fromTarget(value: ${targetType}): ${sourceType} {`);
  lines.push(`    return ${COERCION_HELPERS[`${targetType}->${sourceType}`] || 'value'};`);
  lines.push(`  }`);
  lines.push(`}`);

  return lines.join('\n');
}

// Re-exports
export { toCamelCase, capitalize } from '../utils/typescript-client';
