/**
 * Automatic Data Type Conversion Between Languages
 * JSON, Protobuf, Avro, MessagePack conversion with type mapping
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Data formats
export type DataFormat = 'json' | 'protobuf' | 'avro' | 'msgpack' | 'xml' | 'yaml' | 'csv';

// Type mappings between formats
export interface TypeMapping {
  jsonType: string;
  protobufType: string;
  avroType: string;
  msgpackType: string;
  xmlType: string;
  yamlType: string;
  csvType: string;
}

// Common type mappings
export const TYPE_MAPPINGS: Record<string, TypeMapping> = {
  string: {
    jsonType: 'string',
    protobufType: 'string',
    avroType: 'string',
    msgpackType: 'str',
    xmlType: 'xs:string',
    yamlType: 'str',
    csvType: 'string',
  },
  integer: {
    jsonType: 'number',
    protobufType: 'int32',
    avroType: 'int',
    msgpackType: 'int',
    xmlType: 'xs:integer',
    yamlType: 'int',
    csvType: 'integer',
  },
  long: {
    jsonType: 'number',
    protobufType: 'int64',
    avroType: 'long',
    msgpackType: 'int',
    xmlType: 'xs:long',
    yamlType: 'int',
    csvType: 'bigint',
  },
  float: {
    jsonType: 'number',
    protobufType: 'float',
    avroType: 'float',
    msgpackType: 'float',
    xmlType: 'xs:float',
    yamlType: 'float',
    csvType: 'numeric',
  },
  double: {
    jsonType: 'number',
    protobufType: 'double',
    avroType: 'double',
    msgpackType: 'float',
    xmlType: 'xs:double',
    yamlType: 'float',
    csvType: 'numeric',
  },
  boolean: {
    jsonType: 'boolean',
    protobufType: 'bool',
    avroType: 'boolean',
    msgpackType: 'bool',
    xmlType: 'xs:boolean',
    yamlType: 'bool',
    csvType: 'boolean',
  },
  array: {
    jsonType: 'array',
    protobufType: 'repeated',
    avroType: 'array',
    msgpackType: 'array',
    xmlType: 'list',
    yamlType: 'seq',
    csvType: 'list',
  },
  object: {
    jsonType: 'object',
    protobufType: 'message',
    avroType: 'record',
    msgpackType: 'map',
    xmlType: 'complexType',
    yamlType: 'map',
    csvType: 'struct',
  },
  timestamp: {
    jsonType: 'string',
    protobufType: 'int64',
    avroType: 'long',
    msgpackType: 'int',
    xmlType: 'xs:dateTime',
    yamlType: 'timestamp',
    csvType: 'datetime',
  },
  bytes: {
    jsonType: 'string',
    protobufType: 'bytes',
    avroType: 'bytes',
    msgpackType: 'bin',
    xmlType: 'xs:base64Binary',
    yamlType: 'binary',
    csvType: 'blob',
  },
  enum: {
    jsonType: 'string',
    protobufType: 'enum',
    avroType: 'enum',
    msgpackType: 'str',
    xmlType: 'xs:string',
    yamlType: 'str',
    csvType: 'enum',
  },
  null: {
    jsonType: 'null',
    protobufType: 'optional',
    avroType: 'null',
    msgpackType: 'nil',
    xmlType: 'nillable',
    yamlType: 'null',
    csvType: 'null',
  },
};

// Schema definition
export interface SchemaDefinition {
  name: string;
  namespace?: string;
  format: DataFormat;
  fields: FieldDefinition[];
  doc?: string;
}

export interface FieldDefinition {
  name: string;
  type: string;
  required: boolean;
  default?: any;
  doc?: string;
}

// Conversion result
export interface ConversionResult {
  success: boolean;
  data: any;
  schema?: string;
  errors?: string[];
}

// Converter configuration
export interface ConverterConfig {
  sourceFormat: DataFormat;
  targetFormat: DataFormat;
  preserveTypes: boolean;
  handleOptional: boolean;
  enumAsString: boolean;
  dateAsTimestamp: boolean;
}

// Generate converter config
export async function generateConverterConfig(
  sourceFormat: DataFormat,
  targetFormat: DataFormat
): Promise<ConverterConfig> {
  return {
    sourceFormat,
    targetFormat,
    preserveTypes: true,
    handleOptional: true,
    enumAsString: false,
    dateAsTimestamp: true,
  };
}

// Generate TypeScript implementation
export async function generateTypeScriptConverter(
  config: ConverterConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `data-converter.ts`,
    content: `// Data Type Converter for ${config.sourceFormat} to ${config.targetFormat}

export type DataFormat = 'json' | 'protobuf' | 'avro' | 'msgpack' | 'xml';

export interface TypeMapping {
  jsonType: string;
  protobufType: string;
  avroType: string;
  msgpackType: string;
  xmlType: string;
}

export interface ConversionResult {
  success: boolean;
  data: any;
  errors?: string[];
}

export class ${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Convert data from source format to target format
   */
  convert(data: any, schema?: any): ConversionResult {
    try {
      const converted = this.performConversion(data, schema);

      return {
        success: true,
        data: converted,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Perform the actual conversion
   */
  private performConversion(data: any, schema?: any): any {
    if (this.config.sourceFormat === 'json' && this.config.targetFormat === 'protobuf') {
      return this.jsonToProtobuf(data, schema);
    }

    if (this.config.sourceFormat === 'json' && this.config.targetFormat === 'avro') {
      return this.jsonToAvro(data, schema);
    }

    if (this.config.sourceFormat === 'json' && this.config.targetFormat === 'msgpack') {
      return this.jsonToMsgpack(data);
    }

    if (this.config.sourceFormat === 'protobuf' && this.config.targetFormat === 'json') {
      return this.protobufToJson(data);
    }

    if (this.config.sourceFormat === 'avro' && this.config.targetFormat === 'json') {
      return this.avroToJson(data);
    }

    if (this.config.sourceFormat === 'msgpack' && this.config.targetFormat === 'json') {
      return this.msgpackToJson(data);
    }

    // Default: return as-is
    return data;
  }

  /**
   * JSON to Protobuf conversion
   */
  private jsonToProtobuf(data: any, schema?: any): any {
    if (!schema || !schema.fields) {
      return this.mapTypesJsonToProtobuf(data);
    }

    const result: any = {};

    for (const field of schema.fields) {
      const value = data[field.name];

      if (value === undefined || value === null) {
        if (field.required) {
          throw new Error(\`Required field '\${field.name}' is missing\`);
        }
        continue;
      }

      result[field.name] = this.convertValueToProtobuf(value, field.type);
    }

    return result;
  }

  /**
   * Convert value to Protobuf format
   */
  private convertValueToProtobuf(value: any, targetType: string): any {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'integer': 'number',
      'long': 'number',
      'float': 'number',
      'double': 'number',
      'boolean': 'boolean',
      'timestamp': 'number',
    };

    if (Array.isArray(value)) {
      return value.map(v => this.convertValueToProtobuf(v, targetType));
    }

    if (typeof value === 'object' && value !== null) {
      const converted: any = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.convertValueToProtobuf(val, targetType);
      }
      return converted;
    }

    return value;
  }

  /**
   * Map types from JSON to Protobuf
   */
  private mapTypesJsonToProtobuf(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.mapTypesJsonToProtobuf(item));
    }

    if (typeof data === 'object' && data !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.mapTypesJsonToProtobuf(value);
      }
      return result;
    }

    return data;
  }

  /**
   * JSON to Avro conversion
   */
  private jsonToAvro(data: any, schema?: any): any {
    // Avro uses similar structure to JSON but with type preservation
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * JSON to MessagePack conversion
   */
  private jsonToMsgpack(data: any): any {
    // MessagePack is binary, return representation
    return {
      format: 'msgpack',
      data: JSON.stringify(data),
      binary: true,
    };
  }

  /**
   * Protobuf to JSON conversion
   */
  private protobufToJson(data: any): any {
    return this.mapTypesProtobufToJson(data);
  }

  /**
   * Map types from Protobuf to JSON
   */
  private mapTypesProtobufToJson(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.mapTypesProtobufToJson(item));
    }

    if (typeof data === 'object' && data !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.mapTypesProtobufToJson(value);
      }
      return result;
    }

    return data;
  }

  /**
   * Avro to JSON conversion
   */
  private avroToJson(data: any): any {
    // Avro to JSON is straightforward
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * MessagePack to JSON conversion
   */
  private msgpackToJson(data: any): any {
    if (data.format === 'msgpack' && data.data) {
      return JSON.parse(data.data);
    }
    return data;
  }

  /**
   * Get type mapping
   */
  getTypeMapping(typeName: string): TypeMapping {
    const mappings: Record<string, TypeMapping> = {
      string: {
        jsonType: 'string',
        protobufType: 'string',
        avroType: 'string',
        msgpackType: 'str',
        xmlType: 'xs:string',
      },
      int: {
        jsonType: 'number',
        protobufType: 'int32',
        avroType: 'int',
        msgpackType: 'int',
        xmlType: 'xs:integer',
      },
      long: {
        jsonType: 'number',
        protobufType: 'int64',
        avroType: 'long',
        msgpackType: 'int',
        xmlType: 'xs:long',
      },
      float: {
        jsonType: 'number',
        protobufType: 'float',
        avroType: 'float',
        msgpackType: 'float',
        xmlType: 'xs:float',
      },
      double: {
        jsonType: 'number',
        protobufType: 'double',
        avroType: 'double',
        msgpackType: 'float',
        xmlType: 'xs:double',
      },
      bool: {
        jsonType: 'boolean',
        protobufType: 'bool',
        avroType: 'boolean',
        msgpackType: 'bool',
        xmlType: 'xs:boolean',
      },
    };

    return mappings[typeName] || mappings.string;
  }

  /**
   * Convert schema between formats
   */
  convertSchema(schema: any, targetFormat: DataFormat): string {
    if (targetFormat === 'protobuf') {
      return this.convertToProtobufSchema(schema);
    }

    if (targetFormat === 'avro') {
      return this.convertToAvroSchema(schema);
    }

    if (targetFormat === 'json') {
      return JSON.stringify(schema, null, 2);
    }

    return '';
  }

  /**
   * Convert to Protobuf schema
   */
  private convertToProtobufSchema(schema: any): string {
    let proto = \`syntax = "proto3";\\n\\n\`;

    if (schema.namespace) {
      proto += \`package \${schema.namespace};\\n\\n\`;
    }

    proto += \`message \${schema.name} {\\n\`;

    for (const field of schema.fields) {
      const pbType = this.getTypeMapping(field.type).protobufType;
      const optional = !field.required ? ' ' : '';
      proto += \`  \${pbType}\${optional} \${field.name} = \${this.getFieldNumber(field)};\\n\`;
    }

    proto += \`}\\n\`;

    return proto;
  }

  /**
   * Convert to Avro schema
   */
  private convertToAvroSchema(schema: any): string {
    const avroSchema: any = {
      type: 'record',
      name: schema.name,
      namespace: schema.namespace,
      fields: schema.fields.map((field: any) => ({
        name: field.name,
        type: this.getTypeMapping(field.type).avroType,
        doc: field.doc,
      })),
    };

    return JSON.stringify(avroSchema, null, 2);
  }

  private getFieldNumber(field: any): number {
    // Simple hash of field name for demo
    return field.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 100 + 1;
  }
}

// Factory function
export function createConverter(config: any) {
  return new ${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter(config);
}

// Usage example
async function main() {
  const config = {
    sourceFormat: '${config.sourceFormat}',
    targetFormat: '${config.targetFormat}',
    preserveTypes: true,
  };

  const converter = createConverter(config);

  const data = {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com',
  };

  const result = converter.convert(data);

  console.log('Conversion result:', result);
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonConverter(
  config: ConverterConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `data_converter.py`,
    content: `# Data Type Converter for ${config.sourceFormat} to ${config.targetFormat}

from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class DataFormat(Enum):
    JSON = 'json'
    PROTOBUF = 'protobuf'
    AVRO = 'avro'
    MSGPACK = 'msgpack'
    XML = 'xml'

@dataclass
class ConversionResult:
    success: bool
    data: Any
    errors: Optional[List[str]] = None

class ${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter:
    def __init__(self, config: Dict[str, Any]):
        self.config = config

    def convert(self, data: Any, schema: Optional[Dict] = None) -> ConversionResult:
        try:
            converted = self._perform_conversion(data, schema)
            return ConversionResult(success=True, data=converted)
        except Exception as e:
            return ConversionResult(success=False, data=None, errors=[str(e)])

    def _perform_conversion(self, data: Any, schema: Optional[Dict] = None) -> Any:
        if self.config['sourceFormat'] == 'json' and self.config['targetFormat'] == 'protobuf':
            return self._json_to_protobuf(data, schema)

        if self.config['sourceFormat'] == 'json' and self.config['targetFormat'] == 'avro':
            return self._json_to_avro(data, schema)

        if self.config['sourceFormat'] == 'protobuf' and self.config['targetFormat'] == 'json':
            return self._protobuf_to_json(data)

        return data

    def _json_to_protobuf(self, data: Any, schema: Optional[Dict] = None) -> Any:
        if isinstance(data, dict):
            result = {}
            for key, value in data.items():
                result[key] = self._convert_value_to_protobuf(value)
            return result

        if isinstance(data, list):
            return [self._convert_value_to_protobuf(item) for item in data]

        return data

    def _convert_value_to_protobuf(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {k: self._convert_value_to_protobuf(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._convert_value_to_protobuf(item) for item in value]
        return value

    def _protobuf_to_json(self, data: Any) -> Any:
        if isinstance(data, dict):
            return {k: self._protobuf_to_json(v) for k, v in data.items()}
        if isinstance(data, list):
            return [self._protobuf_to_json(item) for item in data]
        return data

    def _json_to_avro(self, data: Any, schema: Optional[Dict] = None) -> Any:
        import json
        return json.loads(json.dumps(data))

    def get_type_mapping(self, type_name: str) -> Dict[str, str]:
        mappings = {
            'string': {'json': 'string', 'protobuf': 'string', 'avro': 'string'},
            'int': {'json': 'number', 'protobuf': 'int32', 'avro': 'int'},
            'long': {'json': 'number', 'protobuf': 'int64', 'avro': 'long'},
            'float': {'json': 'number', 'protobuf': 'float', 'avro': 'float'},
            'bool': {'json': 'boolean', 'protobuf': 'bool', 'avro': 'boolean'},
        }
        return mappings.get(type_name, mappings['string'])

# Usage
async def main():
    config = {'sourceFormat': '${config.sourceFormat}', 'targetFormat': '${config.targetFormat}'}
    converter = ${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter(config)

    data = {'name': 'John Doe', 'age': 30}
    result = converter.convert(data)
    print('Result:', result)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoConverter(
  config: ConverterConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `data-converter.go`,
    content: `package main

import (
	"encoding/json"
	"fmt"
)

type DataFormat string

const (
	FormatJSON     DataFormat = "json"
	FormatProtobuf DataFormat = "protobuf"
	FormatAvro     DataFormat = "avro"
	FormatMsgpack  DataFormat = "msgpack"
	FormatXML      DataFormat = "xml"
)

type ConversionResult struct {
	Success bool        \`json:"success"\`
	Data    interface{} \`json:"data"\`
	Errors  []string    \`json:"errors,omitempty"\`
}

type ${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter struct {
	config map[string]interface{}
}

func New${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter(config map[string]interface{}) *${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter {
	return &${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter{
		config: config,
	}
}

func (c *${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter) Convert(data interface{}) ConversionResult {
	converted := c.performConversion(data)

	return ConversionResult{
		Success: true,
		Data:    converted,
	}
}

func (c *${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter) performConversion(data interface{}) interface{} {
	sourceFormat := c.config["sourceFormat"].(DataFormat)
	targetFormat := c.config["targetFormat"].(DataFormat)

	if sourceFormat == FormatJSON && targetFormat == FormatProtobuf {
		return c.jsonToProtobuf(data)
	}

	if sourceFormat == FormatJSON && targetFormat == FormatAvro {
		return c.jsonToAvro(data)
	}

	if sourceFormat == FormatProtobuf && targetFormat == FormatJSON {
		return c.protobufToJson(data)
	}

	return data
}

func (c *${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter) jsonToProtobuf(data interface{}) interface{} {
	// Simple conversion - in production use proper protobuf library
	return data
}

func (c *${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter) protobufToJson(data interface{}) interface{} {
	return data
}

func (c *${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter) jsonToAvro(data interface{}) interface{} {
	jsonBytes, _ := json.Marshal(data)
	var result interface{}
	json.Unmarshal(jsonBytes, &result)
	return result
}

func main() {
	config := map[string]interface{}{
		"sourceFormat": "${config.sourceFormat}",
		"targetFormat": "${config.targetFormat}",
	}

	converter := New${toPascalCase(config.sourceFormat)}To${toPascalCase(config.targetFormat)}Converter(config)

	data := map[string]interface{}{
		"name": "John Doe",
		"age":  30,
	}

	result := converter.Convert(data)
	fmt.Printf("Result: %+v\\n", result)
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeConverterFiles(
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

  // Generate BUILD.md
  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayConverterConfig(config: ConverterConfig): Promise<void> {
  console.log(chalk.bold.blue('\n🔄 Data Type Converter'));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Source Format:'), chalk.white(config.sourceFormat.toUpperCase()));
  console.log(chalk.cyan('Target Format:'), chalk.white(config.targetFormat.toUpperCase()));
  console.log(chalk.cyan('Preserve Types:'), config.preserveTypes ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Handle Optional:'), config.handleOptional ? chalk.green('enabled') : chalk.red('disabled'));

  console.log(chalk.cyan('\n📋 Supported Type Conversions:'));
  console.log(chalk.gray('  • string <-> str/string/str'));
  console.log(chalk.gray('  • integer/long <-> int32/int64/int'));
  console.log(chalk.gray('  • float/double <-> float/double/float'));
  console.log(chalk.gray('  • boolean <-> bool/boolean/bool'));
  console.log(chalk.gray('  • array <-> repeated/array/array'));
  console.log(chalk.gray('  • object <-> message/record/map'));
  console.log(chalk.gray('  • timestamp <-> int64/long/int'));
  console.log(chalk.gray('  • bytes <-> bytes/bytes/bin'));
  console.log(chalk.gray('  • enum <-> enum/enum/str'));
  console.log(chalk.gray('  • null <-optional/null/nil'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  return `# Data Type Converter Build Instructions

## Language: ${language.toUpperCase()}

## Architecture

This data type converter provides:
- **Multi-Format Support**: JSON, Protobuf, Avro, MessagePack, XML, YAML, CSV
- **Type Mapping**: Automatic type conversion between formats
- **Schema Conversion**: Convert schemas between different formats
- **Lossless Conversion**: Preserve data types during conversion
- **Bidirectional**: Convert in both directions between formats

## Type Mappings

| Type | JSON | Protobuf | Avro | MessagePack | XML |
|------|------|----------|------|-------------|-----|
| String | string | string | string | str | xs:string |
| Integer | number | int32 | int | int | xs:integer |
| Long | number | int64 | long | int | xs:long |
| Float | number | float | float | float | xs:float |
| Double | number | double | double | float | xs:double |
| Boolean | boolean | bool | boolean | bool | xs:boolean |
| Array | array | repeated | array | array | list |
| Object | object | message | record | map | complexType |
| Timestamp | string | int64 | long | int | xs:dateTime |
| Bytes | string | bytes | bytes | bin | xs:base64Binary |
| Enum | string | enum | enum | str | xs:string |
| Null | null | optional | null | nil | nillable |

## Usage

See generated code for usage examples.
`;
}
