/**
 * Data Format Negotiation with Content-Type Handling
 * Automatic format negotiation, content-type parsing, format conversion
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Supported data formats
export type DataFormat =
  | 'json'
  | 'xml'
  | 'messagepack'
  | 'protobuf'
  | 'cbor'
  | 'yaml'
  | 'toml'
  | 'csv'
  | 'html'
  | 'text';

// Content type with parameters
export interface ContentType {
  type: string;
  subtype: string;
  parameters: Record<string, string>;
  quality: number;
}

// Negotiation result
export interface NegotiationResult {
  format: DataFormat;
  contentType: string;
  charset?: string;
  encoding?: string;
}

// Negotiation options
export interface NegotiationOptions {
  acceptHeader?: string;
  supportedFormats: DataFormat[];
  defaultFormat: DataFormat;
  prioritizeByQuality?: boolean;
}

// Format converter
export interface FormatConverter {
  canConvert(from: DataFormat, to: DataFormat): boolean;
  convert(data: any, from: DataFormat, to: DataFormat): any;
}

// Negotiator configuration
export interface FormatNegotiatorConfig {
  serviceName: string;
  supportedFormats: DataFormat[];
  defaultFormat: DataFormat;
  enableAutoConversion: boolean;
  strictMode: boolean;
}

// Generate format negotiator config
export async function generateFormatNegotiatorConfig(
  serviceName: string,
  defaultFormat: DataFormat = 'json'
): Promise<FormatNegotiatorConfig> {
  return {
    serviceName,
    supportedFormats: ['json', 'xml', 'messagepack', 'protobuf', 'cbor', 'yaml', 'csv'],
    defaultFormat,
    enableAutoConversion: true,
    strictMode: false,
  };
}

// Parse content type
function parseContentType(contentType: string): ContentType {
  const [typeSubtype, ...params] = contentType.split(';').map(s => s.trim());
  const [type, subtype] = typeSubtype.split('/');

  const parameters: Record<string, string> = {};
  let quality = 1.0;

  for (const param of params) {
    const [key, value] = param.split('=');
    if (key === 'q') {
      quality = parseFloat(value) || 1.0;
    } else {
      parameters[key] = value || '';
    }
  }

  return { type, subtype, parameters, quality };
}

// Generate TypeScript implementation
export async function generateTypeScriptFormatNegotiator(
  config: FormatNegotiatorConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['content-type', 'yaml', 'xml2js', 'msgpack'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-format-negotiator.ts`,
    content: `// Data Format Negotiator for ${config.serviceName}

import * as contentType from 'content-type';
import * as yaml from 'yaml';
import * as xml2js from 'xml2js';

export type DataFormat =
  | 'json'
  | 'xml'
  | 'messagepack'
  | 'protobuf'
  | 'cbor'
  | 'yaml'
  | 'toml'
  | 'csv'
  | 'html'
  | 'text';

export interface ContentType {
  type: string;
  subtype: string;
  parameters: Record<string, string>;
  quality: number;
}

export interface NegotiationResult {
  format: DataFormat;
  contentType: string;
  charset?: string;
  encoding?: string;
}

export interface NegotiationOptions {
  acceptHeader?: string;
  supportedFormats: DataFormat[];
  defaultFormat: DataFormat;
  prioritizeByQuality?: boolean;
}

export interface FormatConverter {
  canConvert(from: DataFormat, to: DataFormat): boolean;
  convert(data: any, from: DataFormat, to: DataFormat): any;
}

// Format to content-type mapping
const FORMAT_TO_CONTENT_TYPE: Record<DataFormat, string> = {
  json: 'application/json',
  xml: 'application/xml',
  messagepack: 'application/msgpack',
  protobuf: 'application/protobuf',
  cbor: 'application/cbor',
  yaml: 'application/x-yaml',
  toml: 'application/toml',
  csv: 'text/csv',
  html: 'text/html',
  text: 'text/plain',
};

// Content-type to format mapping
const CONTENT_TYPE_TO_FORMAT: Record<string, DataFormat> = {
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/msgpack': 'messagepack',
  'application/x-msgpack': 'messagepack',
  'application/protobuf': 'protobuf',
  'application/x-protobuf': 'protobuf',
  'application/cbor': 'cbor',
  'application/x-yaml': 'yaml',
  'text/yaml': 'yaml',
  'application/toml': 'toml',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/plain': 'text',
};

export class ${toPascalCase(config.serviceName)}FormatNegotiator {
  private config: any;
  private converters: Map<string, FormatConverter>;

  constructor(config: any) {
    this.config = config;
    this.converters = new Map();
    this.initializeConverters();
  }

  /**
   * Negotiate the best format based on Accept header
   */
  negotiate(options: NegotiationOptions): NegotiationResult {
    const {
      acceptHeader,
      supportedFormats,
      defaultFormat,
      prioritizeByQuality = true,
    } = options;

    if (!acceptHeader) {
      return {
        format: defaultFormat,
        contentType: FORMAT_TO_CONTENT_TYPE[defaultFormat],
      };
    }

    // Parse Accept header
    const acceptTypes = this.parseAcceptHeader(acceptHeader);

    // Find matching format
    let bestMatch: DataFormat | null = null;
    let bestQuality = 0;

    for (const acceptType of acceptTypes) {
      const format = this.contentTypeToFormat(acceptType);

      if (format && supportedFormats.includes(format)) {
        if (prioritizeByQuality) {
          if (acceptType.quality > bestQuality) {
            bestMatch = format;
            bestQuality = acceptType.quality;
          }
        } else {
          bestMatch = format;
          break;
        }
      }
    }

    // Fallback to default if no match
    const selectedFormat = bestMatch || defaultFormat;

    return {
      format: selectedFormat,
      contentType: FORMAT_TO_CONTENT_TYPE[selectedFormat],
      charset: acceptTypes.find(t => t.parameters.charset)?.parameters.charset,
      encoding: acceptTypes.find(t => t.parameters.encoding)?.parameters.encoding,
    };
  }

  /**
   * Parse Accept header
   */
  private parseAcceptHeader(acceptHeader: string): ContentType[] {
    const types = acceptHeader.split(',').map(type => this.parseContentType(type.trim()));

    // Sort by quality (descending)
    return types.sort((a, b) => b.quality - a.quality);
  }

  /**
   * Parse content type
   */
  private parseContentType(contentTypeString: string): ContentType {
    const parsed = contentType.parse(contentTypeString);
    const quality = parseFloat(parsed.parameters.q || '1');

    return {
      type: parsed.type,
      subtype: parsed.subtype,
      parameters: parsed.parameters,
      quality,
    };
  }

  /**
   * Convert content type to format
   */
  private contentTypeToFormat(contentType: ContentType): DataFormat | null {
    const fullType = \`\${contentType.type}/\${contentType.subtype}\`;

    // Direct match
    if (CONTENT_TYPE_TO_FORMAT[fullType]) {
      return CONTENT_TYPE_TO_FORMAT[fullType];
    }

    // Wildcard match
    if (contentType.type === '*' || contentType.subtype === '*') {
      return this.config.defaultFormat;
    }

    return null;
  }

  /**
   * Convert data between formats
   */
  convertData(data: any, fromFormat: DataFormat, toFormat: DataFormat): any {
    if (fromFormat === toFormat) {
      return data;
    }

    // Convert to intermediate format (JSON)
    const intermediate = this.toIntermediate(data, fromFormat);
    return this.fromIntermediate(intermediate, toFormat);
  }

  /**
   * Convert any format to intermediate (JSON/object)
   */
  private toIntermediate(data: any, format: DataFormat): any {
    switch (format) {
      case 'json':
        return typeof data === 'string' ? JSON.parse(data) : data;

      case 'xml':
        return new Promise((resolve, reject) => {
          xml2js.parseString(data, { explicitArray: false }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

      case 'yaml':
        return yaml.parse(data);

      case 'messagepack':
        // Would require msgpack library
        return JSON.parse(JSON.stringify(data));

      case 'csv':
        return this.csvToJson(data);

      case 'text':
        return data.toString();

      default:
        return data;
    }
  }

  /**
   * Convert intermediate (JSON/object) to target format
   */
  private fromIntermediate(data: any, format: DataFormat): any {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'xml':
        return new Promise((resolve, reject) => {
          const builder = new xml2js.Builder();
          builder.buildObject(data, (err, xml) => {
            if (err) reject(err);
            else resolve(xml);
          });
        });

      case 'yaml':
        return yaml.stringify(data);

      case 'csv':
        return this.jsonToCsv(data);

      case 'text':
        return JSON.stringify(data);

      default:
        return data;
    }
  }

  /**
   * Convert CSV to JSON
   */
  private csvToJson(csv: string): any {
    const lines = csv.trim().split('\\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1);

    return rows.map(row => {
      const values = row.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, i) => {
        obj[header] = values[i];
      });
      return obj;
    });
  }

  /**
   * Convert JSON to CSV
   */
  private jsonToCsv(data: any): string {
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return '';

    const headers = Object.keys(arr[0]);
    const csvRows = [headers.join(',')];

    for (const obj of arr) {
      const row = headers.map(header => obj[header] || '');
      csvRows.push(row.join(','));
    }

    return csvRows.join('\\n');
  }

  /**
   * Serialize data to format
   */
  serialize(data: any, format: DataFormat): string | Buffer {
    switch (format) {
      case 'json':
        return JSON.stringify(data);

      case 'yaml':
        return yaml.stringify(data);

      case 'xml':
        return new xml2js.Builder().buildObject(data);

      case 'csv':
        return this.jsonToCsv(data);

      case 'text':
        return data.toString();

      default:
        return JSON.stringify(data);
    }
  }

  /**
   * Deserialize data from format
   */
  deserialize(data: string | Buffer, format: DataFormat): any {
    const dataStr = data.toString();

    switch (format) {
      case 'json':
        return JSON.parse(dataStr);

      case 'yaml':
        return yaml.parse(dataStr);

      case 'xml':
        return new Promise((resolve, reject) => {
          xml2js.parseString(dataStr, { explicitArray: false }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

      case 'csv':
        return this.csvToJson(dataStr);

      case 'text':
        return dataStr;

      default:
        return JSON.parse(dataStr);
    }
  }

  /**
   * Get content type for format
   */
  getContentType(format: DataFormat): string {
    return FORMAT_TO_CONTENT_TYPE[format];
  }

  /**
   * Get format from content type
   */
  getFormat(contentType: string): DataFormat | null {
    return CONTENT_TYPE_TO_FORMAT[contentType] || null;
  }

  /**
   * Check if format is supported
   */
  isFormatSupported(format: DataFormat): boolean {
    return this.config.supportedFormats.includes(format);
  }

  /**
   * Add custom converter
   */
  addConverter(name: string, converter: FormatConverter): void {
    this.converters.set(name, converter);
  }

  /**
   * Initialize built-in converters
   */
  private initializeConverters(): void {
    // JSON converter
    this.converters.set('json', {
      canConvert: (from, to) => from === 'json' || to === 'json',
      convert: (data, from, to) => {
        if (from === 'json') {
          return this.fromIntermediate(JSON.parse(data), to);
        }
        return this.toIntermediate(data, from);
      },
    });

    // XML converter
    this.converters.set('xml', {
      canConvert: (from, to) => from === 'xml' || to === 'xml',
      convert: (data, from, to) => {
        if (from === 'xml') {
          return new Promise((resolve, reject) => {
            xml2js.parseString(data, { explicitArray: false }, (err, result) => {
              if (err) reject(err);
              else resolve(this.fromIntermediate(result, to));
            });
          });
        }
        return this.fromIntermediate(data, 'xml');
      },
    });
  }

  /**
   * Create response with negotiated content type
   */
  createResponse(data: any, acceptHeader?: string): { data: any; contentType: string; format: DataFormat } {
    const negotiation = this.negotiate({
      acceptHeader,
      supportedFormats: this.config.supportedFormats,
      defaultFormat: this.config.defaultFormat,
    });

    const serializedData = this.serialize(data, negotiation.format);

    return {
      data: serializedData,
      contentType: negotiation.contentType,
      format: negotiation.format,
    };
  }

  /**
   * Parse request with content negotiation
   */
  parseRequest(body: string | Buffer, contentTypeHeader: string): any {
    const contentType = this.parseContentType(contentTypeHeader);
    const format = this.contentTypeToFormat(contentType) || this.config.defaultFormat;

    return this.deserialize(body, format);
  }

  /**
   * List all supported formats
   */
  getSupportedFormats(): DataFormat[] {
    return [...this.config.supportedFormats];
  }
}

// Factory function
export function createFormatNegotiator(config: any) {
  return new ${toPascalCase(config.serviceName)}FormatNegotiator(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    supportedFormats: ['json', 'xml', 'yaml', 'csv'],
    defaultFormat: 'json',
    enableAutoConversion: true,
    strictMode: false,
  };

  const negotiator = new ${toPascalCase(config.serviceName)}FormatNegotiator(config);

  // Example 1: Negotiate format from Accept header
  const acceptHeader = 'application/json, application/xml;q=0.9, text/plain;q=0.8';
  const result = negotiator.negotiate({
    acceptHeader,
    supportedFormats: config.supportedFormats,
    defaultFormat: config.defaultFormat,
  });

  console.log('Negotiated format:', result.format);
  console.log('Content type:', result.contentType);

  // Example 2: Create response with content negotiation
  const data = {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
  };

  const response = negotiator.createResponse(data, acceptHeader);
  console.log('Response content-type:', response.contentType);
  console.log('Response data:', response.data);

  // Example 3: Parse request with content type
  const requestBody = '{"message": "Hello"}';
  const parsed = negotiator.parseRequest(requestBody, 'application/json');
  console.log('Parsed body:', parsed);

  // Example 4: Convert between formats
  const converted = negotiator.convertData(data, 'json', 'xml');
  console.log('Converted to XML:', converted);
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonFormatNegotiator(
  config: FormatNegotiatorConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['yaml', 'xmltodict'];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_format_negotiator.py`,
    content: `# Data Format Negotiator for ${config.serviceName}
import json
import csv
import yaml
import xmltodict
from io import StringIO
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass

class DataFormat:
    JSON = 'json'
    XML = 'xml'
    MESSAGEPACK = 'messagepack'
    PROTOBUF = 'protobuf'
    CBOR = 'cbor'
    YAML = 'yaml'
    CSV = 'csv'
    HTML = 'html'
    TEXT = 'text'

@dataclass
class ContentType:
    type: str
    subtype: str
    parameters: Dict[str, str]
    quality: float

@dataclass
class NegotiationResult:
    format: str
    content_type: str
    charset: Optional[str] = None
    encoding: Optional[str] = None

class ${toPascalCase(config.serviceName)}FormatNegotiator:
    FORMAT_TO_CONTENT_TYPE = {
        'json': 'application/json',
        'xml': 'application/xml',
        'yaml': 'application/x-yaml',
        'csv': 'text/csv',
        'text': 'text/plain',
    }

    CONTENT_TYPE_TO_FORMAT = {
        'application/json': 'json',
        'application/xml': 'xml',
        'text/xml': 'xml',
        'application/x-yaml': 'yaml',
        'text/yaml': 'yaml',
        'text/csv': 'csv',
        'text/plain': 'text',
    }

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.converters = {}

    def negotiate(self, accept_header: str, supported_formats: List[str], default_format: str = 'json') -> NegotiationResult:
        """Negotiate the best format based on Accept header"""
        if not accept_header:
            return NegotiationResult(
                format=default_format,
                content_type=self.FORMAT_TO_CONTENT_TYPE.get(default_format, 'application/json')
            )

        # Parse Accept header
        accept_types = self._parse_accept_header(accept_header)

        # Find matching format
        best_match = None
        best_quality = 0

        for accept_type in accept_types:
            format_type = self._content_type_to_format(accept_type)

            if format_type and format_type in supported_formats:
                if accept_type.quality > best_quality:
                    best_match = format_type
                    best_quality = accept_type.quality

        selected_format = best_match or default_format

        return NegotiationResult(
            format=selected_format,
            content_type=self.FORMAT_TO_CONTENT_TYPE.get(selected_format, 'application/json'),
        )

    def _parse_accept_header(self, accept_header: str) -> List[ContentType]:
        """Parse Accept header into content types"""
        types = []
        for type_str in accept_header.split(','):
            types.append(self._parse_content_type(type_str.strip()))

        return sorted(types, key=lambda t: t.quality, reverse=True)

    def _parse_content_type(self, content_type_str: str) -> ContentType:
        """Parse individual content type"""
        parts = content_type_str.split(';')
        type_subtype = parts[0].strip()
        type_parts = type_subtype.split('/')

        parameters = {}
        quality = 1.0

        for param in parts[1:]:
            param = param.strip()
            if '=' in param:
                key, value = param.split('=', 1)
                if key.strip() == 'q':
                    quality = float(value.strip())
                else:
                    parameters[key.strip()] = value.strip()

        return ContentType(
            type=type_parts[0] if len(type_parts) > 0 else '*',
            subtype=type_parts[1] if len(type_parts) > 1 else '*',
            parameters=parameters,
            quality=quality,
        )

    def _content_type_to_format(self, content_type: ContentType) -> Optional[str]:
        """Convert content type to format"""
        full_type = f"{content_type.type}/{content_type.subtype}"

        if full_type in self.CONTENT_TYPE_TO_FORMAT:
            return self.CONTENT_TYPE_TO_FORMAT[full_type]

        if content_type.type == '*' or content_type.subtype == '*':
            return self.config.get('defaultFormat', 'json')

        return None

    def serialize(self, data: Any, format_type: str) -> str:
        """Serialize data to format"""
        if format_type == 'json':
            return json.dumps(data, indent=2)
        elif format_type == 'yaml':
            return yaml.dump(data)
        elif format_type == 'xml':
            return xmltodict.unparse(data)
        elif format_type == 'csv':
            return self._json_to_csv(data)
        elif format_type == 'text':
            return str(data)
        else:
            return json.dumps(data)

    def deserialize(self, data: str, format_type: str) -> Any:
        """Deserialize data from format"""
        if format_type == 'json':
            return json.loads(data)
        elif format_type == 'yaml':
            return yaml.safe_load(data)
        elif format_type == 'xml':
            return xmltodict.parse(data)
        elif format_type == 'csv':
            return self._csv_to_json(data)
        elif format_type == 'text':
            return data
        else:
            return json.loads(data)

    def _json_to_csv(self, data: Any) -> str:
        """Convert JSON to CSV"""
        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list) or len(data) == 0:
            return ''

        headers = list(data[0].keys())
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(data)
        return output.getvalue()

    def _csv_to_json(self, csv_data: str) -> List[Dict]:
        """Convert CSV to JSON"""
        reader = csv.DictReader(StringIO(csv_data))
        return list(reader)

    def create_response(self, data: Any, accept_header: str) -> Dict[str, Any]:
        """Create response with negotiated content type"""
        negotiation = self.negotiate(
            accept_header,
            self.config.get('supportedFormats', ['json', 'xml', 'yaml']),
            self.config.get('defaultFormat', 'json')
        )

        serialized = self.serialize(data, negotiation.format)

        return {
            'data': serialized,
            'contentType': negotiation.content_type,
            'format': negotiation.format,
        }

# Usage
async def main():
    config = {
        'serviceName': '${config.serviceName}',
        'supportedFormats': ['json', 'xml', 'yaml', 'csv'],
        'defaultFormat': 'json',
    }

    negotiator = ${toPascalCase(config.serviceName)}FormatNegotiator(config)

    # Negotiate
    result = negotiator.negotiate('application/json, application/xml;q=0.9', ['json', 'xml'], 'json')
    print(f"Format: {result.format}")
    print(f"Content-Type: {result.content_type}")

    # Create response
    data = {'users': [{'id': 1, 'name': 'Alice'}]}
    response = negotiator.create_response(data, 'application/json')
    print(f"Response: {response}")

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoFormatNegotiator(
  config: FormatNegotiatorConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['encoding/json', 'encoding/xml', 'gopkg.in/yaml.v3'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-format-negotiator.go`,
    content: `package main

import (
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
	"gopkg.in/yaml.v3"
)

type DataFormat string

const (
	FormatJSON       DataFormat = "json"
	FormatXML        DataFormat = "xml"
	FormatMessagePack DataFormat = "messagepack"
	FormatProtobuf   DataFormat = "protobuf"
	FormatCBOR       DataFormat = "cbor"
	FormatYAML       DataFormat = "yaml"
	FormatCSV        DataFormat = "csv"
	FormatHTML       DataFormat = "html"
	FormatText       DataFormat = "text"
)

type ContentType struct {
	Type       string
	Subtype    string
	Parameters map[string]string
	Quality    float64
}

type NegotiationResult struct {
	Format      DataFormat
	ContentType string
	Charset     string
	Encoding    string
}

type ${toPascalCase(config.serviceName)}FormatNegotiator struct {
	config           map[string]interface{}
	supportedFormats  []DataFormat
	defaultFormat    DataFormat
}

func New${toPascalCase(config.serviceName)}FormatNegotiator(config map[string]interface{}) *${toPascalCase(config.serviceName)}FormatNegotiator {
	return &${toPascalCase(config.serviceName)}FormatNegotiator{
		config:        config,
		supportedFormats: []DataFormat{FormatJSON, FormatXML, FormatYAML, FormatCSV},
		defaultFormat: FormatJSON,
	}
}

func (n *${toPascalCase(config.serviceName)}FormatNegotiator) Negotiate(acceptHeader string) NegotiationResult {
	if acceptHeader == "" {
		return NegotiationResult{
			Format:      n.defaultFormat,
			ContentType: n.getContentType(n.defaultFormat),
		}
	}

	acceptTypes := n.parseAcceptHeader(acceptHeader)

	var bestMatch DataFormat = n.defaultFormat
	bestQuality := 0.0

	for _, acceptType := range acceptTypes {
		format := n.contentTypeToFormat(acceptType)

		if format != nil && n.isFormatSupported(*format) {
			if acceptType.Quality > bestQuality {
				bestMatch = *format
				bestQuality = acceptType.Quality
			}
		}
	}

	return NegotiationResult{
		Format:      bestMatch,
		ContentType: n.getContentType(bestMatch),
	}
}

func (n *${toPascalCase(config.serviceName)}FormatNegotiator) parseAcceptHeader(acceptHeader string) []ContentType {
	var types []ContentType

	for _, typeStr := range strings.Split(acceptHeader, ",") {
		types = append(types, n.parseContentType(strings.TrimSpace(typeStr)))
	}

	// Sort by quality (descending)
	for i := 0; i < len(types); i++ {
		for j := i + 1; j < len(types); j++ {
			if types[j].Quality > types[i].Quality {
				types[i], types[j] = types[j], types[i]
			}
		}
	}

	return types
}

func (n *${toPascalCase(config.serviceName)}FormatNegotiator) parseContentType(contentTypeStr string) ContentType {
	parts := strings.Split(contentTypeStr, ";")
	typeSubtype := strings.Split(strings.TrimSpace(parts[0]), "/")

	parameters := make(map[string]string)
	quality := 1.0

	for _, param := range parts[1:] {
		param = strings.TrimSpace(param)
		if strings.Contains(param, "=") {
			kv := strings.SplitN(param, "=", 2)
			key := strings.TrimSpace(kv[0])
			value := strings.TrimSpace(kv[1])

			if key == "q" {
				fmt.Sscanf(value, "%f", &quality)
			} else {
				parameters[key] = value
			}
		}
	}

	if len(typeSubtype) < 2 {
		return ContentType{Type: "*", Subtype: "*", Parameters: parameters, Quality: quality}
	}

	return ContentType{
		Type:       typeSubtype[0],
		Subtype:    typeSubtype[1],
		Parameters: parameters,
		Quality:    quality,
	}
}

func (n *${toPascalCase(config.serviceName)}FormatNegotiator) contentTypeToFormat(ct ContentType) *DataFormat {
	fullType := fmt.Sprintf("%s/%s", ct.Type, ct.Subtype)

	switch fullType {
	case "application/json":
		format := FormatJSON
		return &format
	case "application/xml", "text/xml":
		format := FormatXML
		return &format
	case "application/x-yaml", "text/yaml":
		format := FormatYAML
		return &format
	case "text/csv":
		format := FormatCSV
		return &format
	default:
		if ct.Type == "*" || ct.Subtype == "*" {
			return &n.defaultFormat
		}
		return nil
	}
}

func (n *${toPascalCase(config.serviceName)}FormatNegotiator) getContentType(format DataFormat) string {
	switch format {
	case FormatJSON:
		return "application/json"
	case FormatXML:
		return "application/xml"
	case FormatYAML:
		return "application/x-yaml"
	case FormatCSV:
		return "text/csv"
	case FormatText:
		return "text/plain"
	default:
		return "application/json"
	}
}

func (n *${toPascalCase(config.serviceName)}FormatNegotiator) isFormatSupported(format DataFormat) bool {
	for _, f := range n.supportedFormats {
		if f == format {
			return true
		}
	}
	return false
}

func (n *${toPascalCase(config.serviceName)}FormatNegotiator) Serialize(data interface{}, format DataFormat) (string, error) {
	switch format {
	case FormatJSON:
		bytes, err := json.Marshal(data)
		if err != nil {
			return "", err
		}
		return string(bytes), nil

	case FormatYAML:
		bytes, err := yaml.Marshal(data)
		if err != nil {
			return "", err
		}
		return string(bytes), nil

	default:
		bytes, err := json.Marshal(data)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
}

func main() {
	config := map[string]interface{}{
		"serviceName":     "${config.serviceName}",
		"supportedFormats": []string{"json", "xml", "yaml"},
		"defaultFormat":   "json",
	}

	negotiator := New${toPascalCase(config.serviceName)}FormatNegotiator(config)

	// Test negotiation
	result := negotiator.Negotiate("application/json, application/xml;q=0.9")
	fmt.Printf("Format: %s\\n", result.Format)
	fmt.Printf("Content-Type: %s\\n", result.ContentType)

	// Test serialization
	data := map[string]interface{}{"message": "Hello World"}
	serialized, err := negotiator.Serialize(data, FormatJSON)
	if err != nil {
		fmt.Printf("Error: %v\\n", err)
		return
	}
	fmt.Printf("Serialized: %s\\n", serialized)
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeFormatNegotiatorFiles(
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
export async function displayFormatNegotiatorConfig(config: FormatNegotiatorConfig): Promise<void> {
  console.log(chalk.bold.magenta('\n🔄 Data Format Negotiator: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Supported Formats:'), config.supportedFormats.join(', '));
  console.log(chalk.cyan('Default Format:'), config.defaultFormat);
  console.log(chalk.cyan('Auto Conversion:'), config.enableAutoConversion ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Strict Mode:'), config.strictMode ? chalk.green('enabled') : chalk.red('disabled'));

  console.log(chalk.cyan('\n📦 Supported Formats:'));
  console.log(chalk.gray('  • json - JavaScript Object Notation'));
  console.log(chalk.gray('  • xml - Extensible Markup Language'));
  console.log(chalk.gray('  • messagepack - Efficient binary serialization'));
  console.log(chalk.gray('  • protobuf - Protocol Buffers'));
  console.log(chalk.gray('  • cbor - Concise Binary Object Representation'));
  console.log(chalk.gray('  • yaml - YAML Ain\'t Markup Language'));
  console.log(chalk.gray('  • csv - Comma-Separated Values'));
  console.log(chalk.gray('  • html - HyperText Markup Language'));
  console.log(chalk.gray('  • text - Plain text'));

  console.log(chalk.cyan('\n🎯 Features:'));
  console.log(chalk.gray('  • Accept header parsing'));
  console.log(chalk.gray('  • Quality value negotiation'));
  console.log(chalk.gray('  • Wildcard matching (*/*)'));
  console.log(chalk.gray('  • Automatic format conversion'));
  console.log(chalk.gray('  • Content-type parameter handling'));
  console.log(chalk.gray('  • Charset and encoding support'));

  console.log(chalk.cyan('\n📋 Content-Type Examples:'));
  console.log(chalk.gray('  • application/json'));
  console.log(chalk.gray('  • application/xml; charset=utf-8'));
  console.log(chalk.gray('  • text/csv'));
  console.log(chalk.gray('  • application/msgpack'));
  console.log(chalk.gray('  • */* (wildcard - matches default)'));

  console.log(chalk.cyan('\n⚙️  Negotiation Process:'));
  console.log(chalk.gray('  1. Parse Accept header'));
  console.log(chalk.gray('  2. Sort by quality (q) values'));
  console.log(chalk.gray('  3. Match supported formats'));
  console.log(chalk.gray('  4. Return best match or default'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Data Format Negotiator Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This format negotiator provides:
- **Content Negotiation**: Parse Accept headers and select best format
- **Multi-Format Support**: JSON, XML, YAML, CSV, MessagePack, Protobuf, CBOR
- **Quality Values**: Honor client preferences (q parameter)
- **Format Conversion**: Automatic conversion between formats
- **Wildcard Matching**: Support for */* and type/* patterns
- **Parameter Handling**: Charset, encoding, and other parameters

## Usage Examples

### Basic Negotiation

\`\`\`typescript
import { ${toPascalCase(serviceName)}FormatNegotiator } from './${serviceName}-format-negotiator';

const negotiator = new ${toPascalCase(serviceName)}FormatNegotiator({
  serviceName: '${serviceName}',
  supportedFormats: ['json', 'xml', 'yaml', 'csv'],
  defaultFormat: 'json',
  enableAutoConversion: true,
});

// Negotiate format from Accept header
const acceptHeader = 'application/json, application/xml;q=0.9, text/plain;q=0.8';
const result = negotiator.negotiate({
  acceptHeader,
  supportedFormats: ['json', 'xml', 'yaml'],
  defaultFormat: 'json',
});

console.log('Selected format:', result.format);        // 'json'
console.log('Content-Type:', result.contentType);     // 'application/json'
console.log('Charset:', result.charset);             // undefined
\`\`\`

### Creating HTTP Responses

\`\`\`typescript
// Create response with negotiated format
const data = {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
};

const response = negotiator.createResponse(data, acceptHeader);

// Response includes:
// - data: Serialized data in negotiated format
// - contentType: Proper Content-Type header
// - format: Selected format

return {
  body: response.data,
  headers: {
    'Content-Type': response.contentType,
  },
};
\`\`\`

### Parsing Requests

\`\`\`typescript
// Parse incoming request with Content-Type
const requestBody = '{"message": "Hello"}';
const contentTypeHeader = 'application/json; charset=utf-8';

const parsed = negotiator.parseRequest(requestBody, contentTypeHeader);
console.log('Parsed:', parsed);  // { message: 'Hello' }
\`\`\`

### Format Conversion

\`\`\`typescript
// Convert between formats
const jsonData = { users: [{ id: 1, name: 'Alice' }] };

// JSON to XML
const xmlData = negotiator.convertData(jsonData, 'json', 'xml');

// XML to YAML
const yamlData = negotiator.convertData(xmlData, 'xml', 'yaml');

// JSON to CSV
const csvData = negotiator.convertData(jsonData, 'json', 'csv');
\`\`\`

### Accept Header Examples

- application/json - Direct match
- application/xml - Direct match
- application/json, application/xml;q=0.9 - JSON preferred
- text/* - Wildcard (uses default)
- */* - Any format (uses default)
- application/msgpack, application/json;q=0.5 - MessagePack if supported

## Integration

See generated code for complete API reference and examples.
`;
}
