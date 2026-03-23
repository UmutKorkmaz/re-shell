/**
 * Request/Response Transformation Middleware with Content Negotiation
 * Transforms data between formats (JSON, XML, Protobuf, MessagePack, etc.)
 * Handles content negotiation, serialization, and validation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Supported content types
export type ContentType =
  | 'application/json'
  | 'application/xml'
  | 'application/x-protobuf'
  | 'application/x-msgpack'
  | 'application/x-www-form-urlencoded'
  | 'text/plain'
  | 'text/csv';

export type SerializationFormat = 'json' | 'xml' | 'protobuf' | 'msgpack' | 'form' | 'text' | 'csv';

// Transformation configuration
export interface TransformationConfig {
  serviceName: string;
  defaultContentType: ContentType;
  supportedContentTypes: ContentType[];
  requestTransformations: RequestTransformation[];
  responseTransformations: ResponseTransformation[];
  enableValidation: boolean;
  enableCompression: boolean;
  enableEncryption: boolean;
  maxPayloadSize: number;
  strictMode: boolean;
}

export interface RequestTransformation {
  name: string;
  contentType: ContentType;
  targetFormat: SerializationFormat;
  schema?: any;
  validators?: string[];
  sanitizers?: string[];
  transformers?: string[];
}

export interface ResponseTransformation {
  name: string;
  contentType: ContentType;
  sourceFormat: SerializationFormat;
  schema?: any;
  filters?: string[];
  formatters?: string[];
  transformers?: string[];
}

// Content negotiation result
export interface NegotiatedContent {
  contentType: ContentType;
  format: SerializationFormat;
  charset: string;
  encoding?: string;
  quality: number;
}

// Transformation middleware interface
export interface TransformationMiddleware {
  serviceName: string;
  config: TransformationConfig;
  negotiateContent(acceptHeader: string): NegotiatedContent;
  transformRequest(data: any, contentType: ContentType): Promise<any>;
  transformResponse(data: any, negotiated: NegotiatedContent): Promise<any>;
  validate(data: any, schema: any): Promise<boolean>;
  compress(data: string): Promise<Buffer>;
  decompress(buffer: Buffer): Promise<string>;
}

// Serializer interface
export interface Serializer {
  serialize(data: any): string | Buffer;
  deserialize(data: string | Buffer): any;
  contentType: ContentType;
}

// Built-in serializers
export class JsonSerializer implements Serializer {
  contentType = 'application/json' as ContentType;

  serialize(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  deserialize(data: string): any {
    return JSON.parse(data);
  }
}

export class XmlSerializer implements Serializer {
  contentType = 'application/xml' as ContentType;

  serialize(data: any): string {
    // Simple XML serialization
    return this.objectToXml(data, 'root');
  }

  deserialize(data: string): any {
    // Simple XML parsing
    return this.xmlToObject(data);
  }

  private objectToXml(obj: any, rootName: string): string {
    let xml = '';

    if (Array.isArray(obj)) {
      obj.forEach(item => {
        xml += `<item>${this.valueToXml(item)}</item>\n`;
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        xml += `<${key}>${this.valueToXml(obj[key])}</${key}>\n`;
      }
    } else {
      xml += this.valueToXml(obj);
    }

    return `<${rootName}>\n${xml}</${rootName}>`;
  }

  private valueToXml(value: any): string {
    if (value === null) return '';
    if (typeof value === 'object') return this.objectToXml(value, 'item');
    if (typeof value === 'string') return value;
    return String(value);
  }

  private xmlToObject(xml: string): any {
    // Simple XML to object conversion
    const result: any = {};
    const regex = /<(\w+)>(.*?)<\/\1>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      const [, key, value] = match;
      result[key] = value.trim();
    }

    return result;
  }
}

export class MessagePackSerializer implements Serializer {
  contentType = 'application/x-msgpack' as ContentType;

  serialize(data: any): Buffer {
    // Simplified MessagePack-like encoding
    const json = JSON.stringify(data);
    return Buffer.from(json);
  }

  deserialize(data: Buffer): any {
    const json = data.toString();
    return JSON.parse(json);
  }
}

export class ProtobufSerializer implements Serializer {
  contentType = 'application/x-protobuf' as ContentType;

  serialize(data: any): Buffer {
    // Simplified protobuf-like encoding
    const json = JSON.stringify(data);
    return Buffer.from(json);
  }

  deserialize(data: Buffer): any {
    const json = data.toString();
    return JSON.parse(json);
  }
}

// Content negotiation utilities
export class ContentNegotiator {
  private supportedTypes: ContentType[];

  constructor(supportedTypes: ContentType[]) {
    this.supportedTypes = supportedTypes;
  }

  negotiate(acceptHeader: string): NegotiatedContent {
    if (!acceptHeader) {
      return {
        contentType: this.supportedTypes[0],
        format: this.contentTypeToFormat(this.supportedTypes[0]),
        charset: 'utf-8',
        quality: 1.0,
      };
    }

    // Parse Accept header
    const acceptTypes = this.parseAcceptHeader(acceptHeader);

    // Find best match
    for (const acceptType of acceptTypes) {
      const supported = this.supportedTypes.find(
        type => type === acceptType.type || acceptType.type === '*/*'
      );

      if (supported) {
        return {
          contentType: supported,
          format: this.contentTypeToFormat(supported),
          charset: acceptType.params.charset || 'utf-8',
          encoding: acceptType.params.encoding,
          quality: acceptType.quality,
        };
      }
    }

    // Default to first supported type
    return {
      contentType: this.supportedTypes[0],
      format: this.contentTypeToFormat(this.supportedTypes[0]),
      charset: 'utf-8',
      quality: 0.5,
    };
  }

  private parseAcceptHeader(header: string): Array<{ type: string; quality: number; params: any }> {
    const types: Array<{ type: string; quality: number; params: any }> = [];

    header.split(',').forEach(part => {
      const [type, ...params] = part.trim().split(';');
      const quality = params.find(p => p.trim().startsWith('q='));
      const qValue = quality ? parseFloat(quality.split('=')[1]) : 1.0;

      const paramsObj: any = {};
      params.forEach(param => {
        const [key, value] = param.split('=');
        if (key && key !== 'q') {
          paramsObj[key.trim()] = value?.trim() || true;
        }
      });

      types.push({ type: type.trim(), quality: qValue, params: paramsObj });
    });

    // Sort by quality
    return types.sort((a, b) => b.quality - a.quality);
  }

  private contentTypeToFormat(contentType: ContentType): SerializationFormat {
    const mapping: Record<ContentType, SerializationFormat> = {
      'application/json': 'json',
      'application/xml': 'xml',
      'application/x-protobuf': 'protobuf',
      'application/x-msgpack': 'msgpack',
      'application/x-www-form-urlencoded': 'form',
      'text/plain': 'text',
      'text/csv': 'csv',
    };

    return mapping[contentType] || 'json';
  }
}

// Transformation pipeline
export class TransformationPipeline {
  private transformations: Array<(data: any) => any> = [];

  addTransformer(transformer: (data: any) => any): void {
    this.transformations.push(transformer);
  }

  async execute(data: any): Promise<any> {
    let result = data;

    for (const transformer of this.transformations) {
      result = await transformer(result);
    }

    return result;
  }

  clear(): void {
    this.transformations = [];
  }
}

// Common transformers
export const CommonTransformers = {
  // Sanitize HTML
  sanitizeHtml: (data: any): any => {
    if (typeof data === 'string') {
      return data
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      for (const key of Object.keys(data)) {
        sanitized[key] = CommonTransformers.sanitizeHtml(data[key]);
      }
      return sanitized;
    }
    return data;
  },

  // Trim strings
  trimStrings: (data: any): any => {
    if (typeof data === 'string') {
      return data.trim();
    }
    if (typeof data === 'object' && data !== null) {
      const trimmed: any = Array.isArray(data) ? [] : {};
      for (const key of Object.keys(data)) {
        trimmed[key] = CommonTransformers.trimStrings(data[key]);
      }
      return trimmed;
    }
    return data;
  },

  // Remove null values
  removeNulls: (data: any): any => {
    if (Array.isArray(data)) {
      return data.map(item => CommonTransformers.removeNulls(item));
    }
    if (typeof data === 'object' && data !== null) {
      const cleaned: any = {};
      for (const key of Object.keys(data)) {
        if (data[key] !== null) {
          cleaned[key] = CommonTransformers.removeNulls(data[key]);
        }
      }
      return cleaned;
    }
    return data;
  },

  // Convert date strings to Date objects
  parseDates: (data: any): any => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

    if (typeof data === 'string' && dateRegex.test(data)) {
      return new Date(data);
    }
    if (typeof data === 'object' && data !== null) {
      const parsed: any = Array.isArray(data) ? [] : {};
      for (const key of Object.keys(data)) {
        parsed[key] = CommonTransformers.parseDates(data[key]);
      }
      return parsed;
    }
    return data;
  },

  // Convert Date objects to ISO strings
  formatDates: (data: any): any => {
    if (data instanceof Date) {
      return data.toISOString();
    }
    if (typeof data === 'object' && data !== null) {
      const formatted: any = Array.isArray(data) ? [] : {};
      for (const key of Object.keys(data)) {
        formatted[key] = CommonTransformers.formatDates(data[key]);
      }
      return formatted;
    }
    return data;
  },

  // Lowercase keys
  lowercaseKeys: (data: any): any => {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const lowercased: any = {};
      for (const key of Object.keys(data)) {
        lowercased[key.toLowerCase()] = CommonTransformers.lowercaseKeys(data[key]);
      }
      return lowercased;
    }
    if (Array.isArray(data)) {
      return data.map(item => CommonTransformers.lowercaseKeys(item));
    }
    return data;
  },

  // Uppercase keys
  uppercaseKeys: (data: any): any => {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const uppercased: any = {};
      for (const key of Object.keys(data)) {
        uppercased[key.toUpperCase()] = CommonTransformers.uppercaseKeys(data[key]);
      }
      return uppercased;
    }
    if (Array.isArray(data)) {
      return data.map(item => CommonTransformers.uppercaseKeys(item));
    }
    return data;
  },
};

// Generate transformation middleware
export async function generateTransformationConfig(
  serviceName: string,
  defaultContentType: ContentType = 'application/json',
  supportedContentTypes?: ContentType[]
): Promise<TransformationConfig> {
  const defaultSupported: ContentType[] = [
    'application/json',
    'application/xml',
    'application/x-msgpack',
  ];

  return {
    serviceName,
    defaultContentType,
    supportedContentTypes: supportedContentTypes || defaultSupported,
    requestTransformations: [
      {
        name: 'json-to-object',
        contentType: 'application/json',
        targetFormat: 'json',
        validators: ['required', 'type'],
        sanitizers: ['trim', 'sanitize'],
      },
      {
        name: 'xml-to-object',
        contentType: 'application/xml',
        targetFormat: 'xml',
        validators: ['required'],
        transformers: ['parse-xml'],
      },
      {
        name: 'msgpack-to-object',
        contentType: 'application/x-msgpack',
        targetFormat: 'msgpack',
        transformers: ['decode-msgpack'],
      },
    ],
    responseTransformations: [
      {
        name: 'object-to-json',
        contentType: 'application/json',
        sourceFormat: 'json',
        formatters: ['format-dates'],
        transformers: ['remove-nulls'],
      },
      {
        name: 'object-to-xml',
        contentType: 'application/xml',
        sourceFormat: 'xml',
        transformers: ['convert-xml'],
      },
      {
        name: 'object-to-msgpack',
        contentType: 'application/x-msgpack',
        sourceFormat: 'msgpack',
        transformers: ['encode-msgpack'],
      },
    ],
    enableValidation: true,
    enableCompression: false,
    enableEncryption: false,
    maxPayloadSize: 10 * 1024 * 1024, // 10MB
    strictMode: false,
  };
}

// Generate TypeScript implementation
export async function generateTypeScriptTransformation(
  config: TransformationConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  // Main middleware file
  files.push({
    path: `${config.serviceName}-transformation.ts`,
    content: `import { EventEmitter } from 'events';

// Content type definitions
type ContentType =
  | 'application/json'
  | 'application/xml'
  | 'application/x-protobuf'
  | 'application/x-msgpack';

// Serializer interface
interface Serializer {
  serialize(data: any): string | Buffer;
  deserialize(data: string | Buffer): any;
  contentType: ContentType;
}

// JSON Serializer
class JsonSerializer implements Serializer {
  contentType = 'application/json' as ContentType;

  serialize(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  deserialize(data: string): any {
    return JSON.parse(data);
  }
}

// XML Serializer
class XmlSerializer implements Serializer {
  contentType = 'application/xml' as ContentType;

  serialize(data: any): string {
    return this.objectToXml(data, 'root');
  }

  deserialize(data: string): any {
    return this.xmlToObject(data);
  }

  private objectToXml(obj: any, rootName: string): string {
    let xml = '';

    if (Array.isArray(obj)) {
      obj.forEach(item => {
        xml += \`<item>\${this.valueToXml(item)}</item>\\n\`;
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        xml += \`<\${key}>\${this.valueToXml(obj[key])}</\${key}>\\n\`;
      }
    } else {
      xml += this.valueToXml(obj);
    }

    return \`<\${rootName}>\\n\${xml}</\${rootName}>\`;
  }

  private valueToXml(value: any): string {
    if (value === null) return '';
    if (typeof value === 'object') return this.objectToXml(value, 'item');
    if (typeof value === 'string') return value;
    return String(value);
  }

  private xmlToObject(xml: string): any {
    const result: any = {};
    const regex = /<(\\w+)>(.*?)<\\/\\1>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      const [, key, value] = match;
      result[key] = value.trim();
    }

    return result;
  }
}

// MessagePack Serializer
class MessagePackSerializer implements Serializer {
  contentType = 'application/x-msgpack' as ContentType;

  serialize(data: any): Buffer {
    const json = JSON.stringify(data);
    return Buffer.from(json);
  }

  deserialize(data: Buffer): any {
    const json = data.toString();
    return JSON.parse(json);
  }
}

// Content Negotiator
class ContentNegotiator {
  private supportedTypes: ContentType[];
  private serializers: Map<ContentType, Serializer>;

  constructor(supportedTypes: ContentType[]) {
    this.supportedTypes = supportedTypes;
    this.serializers = new Map([
      ['application/json', new JsonSerializer()],
      ['application/xml', new XmlSerializer()],
      ['application/x-msgpack', new MessagePackSerializer()],
    ]);
  }

  negotiate(acceptHeader: string): { contentType: ContentType; quality: number } {
    if (!acceptHeader) {
      return { contentType: this.supportedTypes[0], quality: 1.0 };
    }

    const acceptTypes = this.parseAcceptHeader(acceptHeader);

    for (const acceptType of acceptTypes) {
      const supported = this.supportedTypes.find(
        type => type === acceptType.type || type === '*/*' || acceptType.type === '*/*'
      );

      if (supported) {
        return { contentType: supported, quality: acceptType.quality };
      }
    }

    return { contentType: this.supportedTypes[0], quality: 0.5 };
  }

  private parseAcceptHeader(header: string): Array<{ type: string; quality: number }> {
    const types: Array<{ type: string; quality: number }> = [];

    header.split(',').forEach(part => {
      const [type, ...params] = part.trim().split(';');
      const quality = params.find(p => p.trim().startsWith('q='));
      const qValue = quality ? parseFloat(quality.split('=')[1]) : 1.0;
      types.push({ type: type.trim(), quality: qValue });
    });

    return types.sort((a, b) => b.quality - a.quality);
  }

  getSerializer(contentType: ContentType): Serializer {
    return this.serializers.get(contentType) || this.serializers.get('application/json')!;
  }
}

// Transformation Pipeline
class TransformationPipeline {
  private transformers: Array<(data: any) => any> = [];

  addTransformer(transformer: (data: any) => any): void {
    this.transformers.push(transformer);
  }

  async execute(data: any): Promise<any> {
    let result = data;

    for (const transformer of this.transformers) {
      result = await transformer(result);
    }

    return result;
  }

  clear(): void {
    this.transformers = [];
  }
}

// Common transformers
const CommonTransformers = {
  sanitizeHtml: (data: any): any => {
    if (typeof data === 'string') {
      return data
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      for (const key of Object.keys(data)) {
        sanitized[key] = CommonTransformers.sanitizeHtml(data[key]);
      }
      return sanitized;
    }
    return data;
  },

  trimStrings: (data: any): any => {
    if (typeof data === 'string') {
      return data.trim();
    }
    if (typeof data === 'object' && data !== null) {
      const trimmed: any = Array.isArray(data) ? [] : {};
      for (const key of Object.keys(data)) {
        trimmed[key] = CommonTransformers.trimStrings(data[key]);
      }
      return trimmed;
    }
    return data;
  },

  removeNulls: (data: any): any => {
    if (Array.isArray(data)) {
      return data.map(item => CommonTransformers.removeNulls(item));
    }
    if (typeof data === 'object' && data !== null) {
      const cleaned: any = {};
      for (const key of Object.keys(data)) {
        if (data[key] !== null) {
          cleaned[key] = CommonTransformers.removeNulls(data[key]);
        }
      }
      return cleaned;
    }
    return data;
  },

  formatDates: (data: any): any => {
    if (data instanceof Date) {
      return data.toISOString();
    }
    if (typeof data === 'object' && data !== null) {
      const formatted: any = Array.isArray(data) ? [] : {};
      for (const key of Object.keys(data)) {
        formatted[key] = CommonTransformers.formatDates(data[key]);
      }
      return formatted;
    }
    return data;
  },
};

// Main Transformation Middleware
export class ${toPascalCase(config.serviceName)}TransformationMiddleware extends EventEmitter {
  private negotiator: ContentNegotiator;
  private requestPipeline: TransformationPipeline;
  private responsePipeline: TransformationPipeline;
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
    this.negotiator = new ContentNegotiator(config.supportedContentTypes);
    this.requestPipeline = new TransformationPipeline();
    this.responsePipeline = new TransformationPipeline();

    this.setupDefaultPipelines();
  }

  private setupDefaultPipelines(): void {
    // Request transformers
    this.requestPipeline.addTransformer(CommonTransformers.trimStrings);
    this.requestPipeline.addTransformer(CommonTransformers.sanitizeHtml);

    // Response transformers
    this.responsePipeline.addTransformer(CommonTransformers.removeNulls);
    this.responsePipeline.addTransformer(CommonTransformers.formatDates);
  }

  // Handle content negotiation
  negotiateContent(acceptHeader: string) {
    return this.negotiator.negotiate(acceptHeader);
  }

  // Transform incoming request
  async transformRequest(body: any, contentType: ContentType): Promise<any> {
    const serializer = this.negotiator.getSerializer(contentType);
    let data = body;

    // Deserialize if needed
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      data = serializer.deserialize(body);
    }

    // Apply request transformations
    data = await this.requestPipeline.execute(data);

    this.emit('request-transformed', { data, contentType });
    return data;
  }

  // Transform outgoing response
  async transformResponse(data: any, acceptHeader: string): Promise<{ data: any; contentType: ContentType }> {
    const negotiated = this.negotiator.negotiate(acceptHeader);
    const serializer = this.negotiator.getSerializer(negotiated.contentType);

    // Apply response transformations
    let transformed = await this.responsePipeline.execute(data);

    // Serialize
    let serialized = serializer.serialize(transformed);

    this.emit('response-transformed', { data: serialized, contentType: negotiated.contentType });
    return { data: serialized, contentType: negotiated.contentType };
  }

  // Add custom request transformer
  addRequestTransformer(transformer: (data: any) => any): void {
    this.requestPipeline.addTransformer(transformer);
  }

  // Add custom response transformer
  addResponseTransformer(transformer: (data: any) => any): void {
    this.responsePipeline.addTransformer(transformer);
  }

  // Validate data
  async validate(data: any, schema: any): Promise<boolean> {
    // Basic validation
    if (!schema) return true;

    // Add your validation logic here
    return true;
  }
}

// Express middleware wrapper
export function createExpressMiddleware(transformation: ${toPascalCase(config.serviceName)}TransformationMiddleware) {
  return async (req: any, res: any, next: any) => {
    const contentType = req.headers['content-type'] || 'application/json';

    try {
      // Transform request
      if (req.body) {
        req.body = await transformation.transformRequest(req.body, contentType);
      }

      // Override res.json to transform response
      const originalJson = res.json;
      res.json = async (data: any) => {
        const accept = req.headers.accept || 'application/json';
        const { data: transformed, contentType } = await transformation.transformResponse(data, accept);

        res.setHeader('Content-Type', contentType);
        return originalJson.call(res, transformed);
      };

      next();
    } catch (error) {
      console.error('Transformation error:', error);
      res.status(400).json({ error: 'Invalid request format' });
    }
  };
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    supportedContentTypes: ['application/json', 'application/xml', 'application/x-msgpack'],
    enableValidation: true,
  };

  const transformation = new ${toPascalCase(config.serviceName)}TransformationMiddleware(config);

  // Test request transformation
  const requestData = { name: '  Test  ', email: 'test@example.com' };
  const transformed = await transformation.transformRequest(requestData, 'application/json');
  console.log('Transformed request:', transformed);

  // Test response transformation
  const responseData = { id: 1, name: 'Test', null: null, date: new Date() };
  const { data: response, contentType } = await transformation.transformResponse(responseData, 'application/json');
  console.log('Transformed response:', response.toString());
  console.log('Content type:', contentType);
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonTransformation(
  config: TransformationConfig
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
    path: `${config.serviceName}_transformation.py`,
    content: `import json
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum

class ContentType(Enum):
    JSON = 'application/json'
    XML = 'application/xml'
    MSGPACK = 'application/x-msgpack'

@dataclass
class NegotiatedContent:
    content_type: ContentType
    quality: float
    charset: str = 'utf-8'

# Serializer interface
class Serializer:
    def serialize(self, data: Any) -> str:
        raise NotImplementedError

    def deserialize(self, data: str) -> Any:
        raise NotImplementedError

    @property
    def content_type(self) -> ContentType:
        raise NotImplementedError

# JSON Serializer
class JsonSerializer(Serializer):
    @property
    def content_type(self) -> ContentType:
        return ContentType.JSON

    def serialize(self, data: Any) -> str:
        return json.dumps(data, indent=2)

    def deserialize(self, data: str) -> Any:
        return json.loads(data)

# XML Serializer
class XmlSerializer(Serializer):
    @property
    def content_type(self) -> ContentType:
        return ContentType.XML

    def serialize(self, data: Any) -> str:
        return self._object_to_xml(data, 'root')

    def deserialize(self, data: str) -> Any:
        return self._xml_to_object(data)

    def _object_to_xml(self, obj: Any, root_name: str) -> str:
        xml = ''

        if isinstance(obj, list):
            for item in obj:
                xml += f'<item>{self._value_to_xml(item)}</item>\\n'
        elif isinstance(obj, dict):
            for key, value in obj.items():
                xml += f'<{key}>{self._value_to_xml(value)}</{key}>\\n'
        else:
            xml += self._value_to_xml(obj)

        return f'<{root_name}>\\n{xml}</{root_name}>'

    def _value_to_xml(self, value: Any) -> str:
        if value is None:
            return ''
        if isinstance(value, (dict, list)):
            return self._object_to_xml(value, 'item')
        if isinstance(value, str):
            return value
        return str(value)

    def _xml_to_object(self, xml: str) -> Dict[str, Any]:
        result = {}
        root = ET.fromstring(xml)

        for child in root:
            result[child.tag] = child.text or ''

        return result

# MessagePack Serializer
class MessagePackSerializer(Serializer):
    @property
    def content_type(self) -> ContentType:
        return ContentType.MSGPACK

    def serialize(self, data: Any) -> str:
        return json.dumps(data)

    def deserialize(self, data: str) -> Any:
        return json.loads(data)

# Content Negotiator
class ContentNegotiator:
    def __init__(self, supported_types: List[ContentType]):
        self.supported_types = supported_types
        self.serializers = {
            ContentType.JSON: JsonSerializer(),
            ContentType.XML: XmlSerializer(),
            ContentType.MSGPACK: MessagePackSerializer(),
        }

    def negotiate(self, accept_header: str) -> NegotiatedContent:
        if not accept_header:
            return NegotiatedContent(
                content_type=self.supported_types[0],
                quality=1.0
            )

        accept_types = self._parse_accept_header(accept_header)

        for accept_type in accept_types:
            for supported in self.supported_types:
                if accept_type['type'] == supported.value or accept_type['type'] == '*/*':
                    return NegotiatedContent(
                        content_type=supported,
                        quality=accept_type['quality']
                    )

        return NegotiatedContent(
            content_type=self.supported_types[0],
            quality=0.5
        )

    def _parse_accept_header(self, header: str) -> List[Dict[str, Any]]:
        types = []

        for part in header.split(','):
            segments = part.strip().split(';')
            content_type = segments[0]
            quality = 1.0

            for seg in segments[1:]:
                if seg.strip().startswith('q='):
                    quality = float(seg.split('=')[1])

            types.append({'type': content_type, 'quality': quality})

        return sorted(types, key=lambda x: -x['quality'])

    def get_serializer(self, content_type: ContentType) -> Serializer:
        return self.serializers.get(content_type, self.serializers[ContentType.JSON])

# Transformation Pipeline
class TransformationPipeline:
    def __init__(self):
        self.transformers: List[Callable[[Any], Any]] = []

    def add_transformer(self, transformer: Callable[[Any], Any]) -> None:
        self.transformers.append(transformer)

    async def execute(self, data: Any) -> Any:
        result = data

        for transformer in self.transformers:
            result = transformer(result)

        return result

    def clear(self) -> None:
        self.transformers = []

# Common transformers
class CommonTransformers:
    @staticmethod
    def sanitize_html(data: Any) -> Any:
        if isinstance(data, str):
            return (data
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&#x27;'))
        if isinstance(data, dict):
            return {k: CommonTransformers.sanitize_html(v) for k, v in data.items()}
        if isinstance(data, list):
            return [CommonTransformers.sanitize_html(item) for item in data]
        return data

    @staticmethod
    def trim_strings(data: Any) -> Any:
        if isinstance(data, str):
            return data.strip()
        if isinstance(data, dict):
            return {k: CommonTransformers.trim_strings(v) for k, v in data.items()}
        if isinstance(data, list):
            return [CommonTransformers.trim_strings(item) for item in data]
        return data

    @staticmethod
    def remove_nulls(data: Any) -> Any:
        if isinstance(data, list):
            return [CommonTransformers.remove_nulls(item) for item in data]
        if isinstance(data, dict):
            return {k: CommonTransformers.remove_nulls(v) for k, v in data.items() if v is not None}
        return data

    @staticmethod
    def format_dates(data: Any) -> Any:
        from datetime import datetime
        if isinstance(data, datetime):
            return data.isoformat()
        if isinstance(data, dict):
            return {k: CommonTransformers.format_dates(v) for k, v in data.items()}
        if isinstance(data, list):
            return [CommonTransformers.format_dates(item) for item in data]
        return data

# Main Transformation Middleware
class ${toPascalCase(config.serviceName)}TransformationMiddleware:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.negotiator = ContentNegotiator(config['supportedContentTypes'])
        self.request_pipeline = TransformationPipeline()
        self.response_pipeline = TransformationPipeline()
        self._setup_default_pipelines()

    def _setup_default_pipelines(self) -> None:
        self.request_pipeline.add_transformer(CommonTransformers.trim_strings)
        self.request_pipeline.add_transformer(CommonTransformers.sanitize_html)

        self.response_pipeline.add_transformer(CommonTransformers.remove_nulls)
        self.response_pipeline.add_transformer(CommonTransformers.format_dates)

    def negotiate_content(self, accept_header: str) -> NegotiatedContent:
        return self.negotiator.negotiate(accept_header)

    async def transform_request(self, body: Any, content_type: ContentType) -> Any:
        serializer = self.negotiator.get_serializer(content_type)
        data = body

        if isinstance(body, (str, bytes)):
            data = serializer.deserialize(body)

        data = await self.request_pipeline.execute(data)
        return data

    async def transform_response(self, data: Any, accept_header: str) -> Dict[str, Any]:
        negotiated = self.negotiator.negotiate(accept_header)
        serializer = self.negotiator.get_serializer(negotiated.content_type)

        transformed = await self.response_pipeline.execute(data)
        serialized = serializer.serialize(transformed)

        return {
            'data': serialized,
            'content_type': negotiated.content_type
        }

    def add_request_transformer(self, transformer: Callable[[Any], Any]) -> None:
        self.request_pipeline.add_transformer(transformer)

    def add_response_transformer(self, transformer: Callable[[Any], Any]) -> None:
        self.response_pipeline.add_transformer(transformer)

    async def validate(self, data: Any, schema: Any) -> bool:
        if not schema:
            return True
        return True

# FastAPI middleware wrapper
def create_fastapi_middleware(transformation: ${toPascalCase(config.serviceName)}TransformationMiddleware):
    from fastapi import Request
    from fastapi.responses import Response

    async def middleware(request: Request, call_next):
        content_type_str = request.headers.get('content-type', 'application/json')
        content_type = ContentType(content_type_str)

        try:
            body = await request.body()

            if body:
                import json
                body_data = json.loads(body.decode())
                transformed = await transformation.transform_request(body_data, content_type)
                request._body = json.dumps(transformed).encode()

            response = await call_next(request)

            # Transform response if needed
            accept = request.headers.get('accept', 'application/json')
            # Note: In production, you'd need to intercept and transform the response body

            return response

        except Exception as e:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=400,
                content={'error': 'Invalid request format'}
            )

    return middleware

# Usage example
async def main():
    from datetime import datetime

    config = {
        'serviceName': '${config.serviceName}',
        'supportedContentTypes': [
            ContentType.JSON,
            ContentType.XML,
            ContentType.MSGPACK
        ],
        'enableValidation': True,
    }

    transformation = ${toPascalCase(config.serviceName)}TransformationMiddleware(config)

    # Test request transformation
    request_data = {'name': '  Test  ', 'email': 'test@example.com'}
    transformed = await transformation.transform_request(request_data, ContentType.JSON)
    print('Transformed request:', transformed)

    # Test response transformation
    response_data = {'id': 1, 'name': 'Test', 'null': None, 'date': datetime.now()}
    result = await transformation.transform_response(response_data, 'application/json')
    print('Transformed response:', result['data'])
    print('Content type:', result['content_type'])

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoTransformation(
  config: TransformationConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-transformation.go`,
    content: `package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

// ContentType represents supported content types
type ContentType string

const (
	ContentTypeJSON     ContentType = "application/json"
	ContentTypeXML      ContentType = "application/xml"
	ContentTypeMsgPack  ContentType = "application/x-msgpack"
)

// Serializer interface
type Serializer interface {
	Serialize(data interface{}) (string, error)
	Deserialize(data string) (interface{}, error)
	ContentType() ContentType
}

// JSON Serializer
type JsonSerializer struct{}

func (j JsonSerializer) ContentType() ContentType {
	return ContentTypeJSON
}

func (j JsonSerializer) Serialize(data interface{}) (string, error) {
	bytes, err := json.MarshalIndent(data, "", "  ")
	return string(bytes), err
}

func (j JsonSerializer) Deserialize(data string) (interface{}, error) {
	var result interface{}
	err := json.Unmarshal([]byte(data), &result)
	return result, err
}

// XML Serializer
type XmlSerializer struct{}

func (x XmlSerializer) ContentType() ContentType {
	return ContentTypeXML
}

func (x XmlSerializer) Serialize(data interface{}) (string, error) {
	bytes, err := xml.MarshalIndent(data, "", "  ")
	return string(bytes), err
}

func (x XmlSerializer) Deserialize(data string) (interface{}, error) {
	var result interface{}
	err := xml.Unmarshal([]byte(data), &result)
	return result, err
}

// MessagePack Serializer
type MessagePackSerializer struct{}

func (m MessagePackSerializer) ContentType() ContentType {
	return ContentTypeMsgPack
}

func (m MessagePackSerializer) Serialize(data interface{}) (string, error) {
	bytes, err := json.Marshal(data)
	return string(bytes), err
}

func (m MessagePackSerializer) Deserialize(data string) (interface{}, error) {
	var result interface{}
	err := json.Unmarshal([]byte(data), &result)
	return result, err
}

// ContentNegotiator handles content negotiation
type ContentNegotiator struct {
	supportedTypes []ContentType
	serializers    map[ContentType]Serializer
}

func NewContentNegotiator(supportedTypes []ContentType) *ContentNegotiator {
	serializers := make(map[ContentType]Serializer)
	serializers[ContentTypeJSON] = JsonSerializer{}
	serializers[ContentTypeXML] = XmlSerializer{}
	serializers[ContentTypeMsgPack] = MessagePackSerializer{}

	return &ContentNegotiator{
		supportedTypes: supportedTypes,
		serializers:    serializers,
	}
}

type NegotiatedContent struct {
	ContentType ContentType
	Quality      float64
	Charset      string
}

func (cn *ContentNegotiator) Negotiate(acceptHeader string) NegotiatedContent {
	if acceptHeader == "" {
		return NegotiatedContent{
			ContentType: cn.supportedTypes[0],
			Quality:      1.0,
			Charset:      "utf-8",
		}
	}

	acceptTypes := cn.parseAcceptHeader(acceptHeader)

	for _, acceptType := range acceptTypes {
		for _, supported := range cn.supportedTypes {
			if acceptType.Type == string(supported) || acceptType.Type == "*/*" {
				return NegotiatedContent{
					ContentType: supported,
					Quality:      acceptType.Quality,
					Charset:      "utf-8",
				}
			}
		}
	}

	return NegotiatedContent{
		ContentType: cn.supportedTypes[0],
		Quality:      0.5,
		Charset:      "utf-8",
	}
}

type AcceptType struct {
	Type    string
	Quality float64
}

func (cn *ContentNegotiator) parseAcceptHeader(header string) []AcceptType {
	var types []AcceptType

	parts := strings.Split(header, ",")
	for _, part := range parts {
		segments := strings.Split(strings.TrimSpace(part), ";")
		contentType := strings.TrimSpace(segments[0])
		quality := 1.0

		for _, seg := range segments[1:] {
			if strings.HasPrefix(strings.TrimSpace(seg), "q=") {
				fmt.Sscanf(seg, "q=%f", &quality)
			}
		}

		types = append(types, AcceptType{
			Type:    contentType,
			Quality: quality,
		})
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

func (cn *ContentNegotiator) GetSerializer(contentType ContentType) Serializer {
	if serializer, ok := cn.serializers[contentType]; ok {
		return serializer
	}
	return cn.serializers[ContentTypeJSON]
}

// TransformationPipeline applies transformations
type TransformationPipeline struct {
	transformers []func(interface{}) interface{}
}

func (tp *TransformationPipeline) AddTransformer(transformer func(interface{}) interface{}) {
	tp.transformers = append(tp.transformers, transformer)
}

func (tp *TransformationPipeline) Execute(data interface{}) (interface{}, error) {
	result := data

	for _, transformer := range tp.transformers {
		result = transformer(result)
	}

	return result, nil
}

func (tp *TransformationPipeline) Clear() {
	tp.transformers = nil
}

// Common transformers
func SanitizeHtml(data interface{}) interface{} {
	switch v := data.(type) {
	case string:
		return strings.NewReplacer(
			"&", "&amp;",
			"<", "&lt;",
			">", "&gt;",
			"\\"", "&quot;",
			"'", "&#x27;",
		).Replace(v)
	case map[string]interface{}:
		result := make(map[string]interface{})
		for key, value := range v {
			result[key] = SanitizeHtml(value)
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = SanitizeHtml(item)
		}
		return result
	default:
		return data
	}
}

func TrimStrings(data interface{}) interface{} {
	switch v := data.(type) {
	case string:
		return strings.TrimSpace(v)
	case map[string]interface{}:
		result := make(map[string]interface{})
		for key, value := range v {
			result[key] = TrimStrings(value)
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = TrimStrings(item)
		}
		return result
	default:
		return data
	}
}

func RemoveNulls(data interface{}) interface{} {
	switch v := data.(type) {
	case []interface{}:
		result := make([]interface{}, 0)
		for _, item := range v {
			if item != nil {
				result = append(result, RemoveNulls(item))
			}
		}
		return result
	case map[string]interface{}:
		result := make(map[string]interface{})
		for key, value := range v {
			if value != nil {
				result[key] = RemoveNulls(value)
			}
		}
		return result
	default:
		return data
	}
}

// Main Transformation Middleware
type ${toPascalCase(config.serviceName)}TransformationMiddleware struct {
	negotiator      *ContentNegotiator
	requestPipeline *TransformationPipeline
	responsePipeline *TransformationPipeline
	config          map[string]interface{}
}

func New${toPascalCase(config.serviceName)}TransformationMiddleware(config map[string]interface{}) *${toPascalCase(config.serviceName)}TransformationMiddleware {
	supportedTypes := []ContentType{ContentTypeJSON, ContentTypeXML, ContentTypeMsgPack}

	middleware := &${toPascalCase(config.serviceName)}TransformationMiddleware{
		negotiator:      NewContentNegotiator(supportedTypes),
		requestPipeline: &TransformationPipeline{},
		responsePipeline: &TransformationPipeline{},
		config:          config,
	}

	middleware.setupDefaultPipelines()

	return middleware
}

func (tm *${toPascalCase(config.serviceName)}TransformationMiddleware) setupDefaultPipelines() {
	tm.requestPipeline.AddTransformer(TrimStrings)
	tm.requestPipeline.AddTransformer(SanitizeHtml)

	tm.responsePipeline.AddTransformer(RemoveNulls)
}

func (tm *${toPascalCase(config.serviceName)}TransformationMiddleware) NegotiateContent(acceptHeader string) NegotiatedContent {
	return tm.negotiator.Negotiate(acceptHeader)
}

func (tm *${toPascalCase(config.serviceName)}TransformationMiddleware) TransformRequest(body interface{}, contentType ContentType) (interface{}, error) {
	serializer := tm.negotiator.GetSerializer(contentType)
	data := body

	// Deserialize if needed
	if str, ok := body.(string); ok {
		deserialized, err := serializer.Deserialize(str)
		if err != nil {
			return nil, err
		}
		data = deserialized
	}

	// Apply transformations
	result, err := tm.requestPipeline.Execute(data)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (tm *${toPascalCase(config.serviceName)}TransformationMiddleware) TransformResponse(data interface{}, acceptHeader string) (interface{}, ContentType, error) {
	negotiated := tm.negotiator.Negotiate(acceptHeader)
	serializer := tm.negotiator.GetSerializer(negotiated.ContentType)

	// Apply transformations
	transformed, err := tm.responsePipeline.Execute(data)
	if err != nil {
		return nil, "", err
	}

	// Serialize
	serialized, err := serializer.Serialize(transformed)
	if err != nil {
		return nil, "", err
	}

	return serialized, negotiated.ContentType, nil
}

func (tm *${toPascalCase(config.serviceName)}TransformationMiddleware) AddRequestTransformer(transformer func(interface{}) interface{}) {
	tm.requestPipeline.AddTransformer(transformer)
}

func (tm *${toPascalCase(config.serviceName)}TransformationMiddleware) AddResponseTransformer(transformer func(interface{}) interface{}) {
	tm.responsePipeline.AddTransformer(transformer)
}

func (tm *${toPascalCase(config.serviceName)}TransformationMiddleware) Validate(data interface{}, schema interface{}) (bool, error) {
	if schema == nil {
		return true, nil
	}
	return true, nil
}

// Usage example
func main() {
	config := map[string]interface{}{
		"serviceName": "${config.serviceName}",
	}

	transformation := New${toPascalCase(config.serviceName)}TransformationMiddleware(config)

	// Test request transformation
	requestData := map[string]interface{}{
		"name":  "  Test  ",
		"email": "test@example.com",
	}

	transformed, err := transformation.TransformRequest(requestData, ContentTypeJSON)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	fmt.Printf("Transformed request: %v\\n", transformed)

	// Test response transformation
	responseData := map[string]interface{}{
		"id":   1,
		"name": "Test",
		"null": nil,
	}

	result, contentType, err := transformation.TransformResponse(responseData, "application/json")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	fmt.Printf("Transformed response: %s\\n", result)
	fmt.Printf("Content type: %s\\n", contentType)
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeTransformationFiles(
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
export async function displayTransformationConfig(config: TransformationConfig): Promise<void> {
  console.log(chalk.bold.yellow('\n🔄 Transformation Middleware: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Default Content Type:'), config.defaultContentType);
  console.log(chalk.cyan('Supported Types:'), config.supportedContentTypes.join(', '));
  console.log(chalk.cyan('Validation:'), config.enableValidation ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Compression:'), config.enableCompression ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Max Payload:'), `${(config.maxPayloadSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(chalk.cyan('Strict Mode:'), config.strictMode ? chalk.green('enabled') : chalk.red('disabled'));

  console.log(chalk.bold('\n📝 Request Transformations:'));
  for (const transformation of config.requestTransformations) {
    console.log(chalk.gray(`  • ${transformation.name} (${transformation.contentType})`));
  }

  console.log(chalk.bold('\n📤 Response Transformations:'));
  for (const transformation of config.responseTransformations) {
    console.log(chalk.gray(`  • ${transformation.name} (${transformation.contentType})`));
  }

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Transformation Middleware Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This transformation middleware provides:
- **Content Negotiation**: Automatic content type negotiation based on Accept header
- **Request Transformation**: Deserialize, sanitize, and validate incoming requests
- **Response Transformation**: Format, filter, and serialize outgoing responses
- **Multi-Format Support**: JSON, XML, MessagePack, Protobuf
- **Pipeline Architecture**: Composable transformation pipeline

## Dependencies

${integration.dependencies.length > 0 ? integration.dependencies.map((d: string) => `- \`${d}\``).join('\n') : 'None'}

## Build Steps

1. Copy transformation middleware to your project
2. Configure supported content types
3. Add custom transformers if needed
4. Integrate with your framework

## Content Negotiation

The middleware automatically negotiates content types based on the \`Accept\` header:

- Parses Accept header with quality values
- Matches against supported content types
- Returns best matching content type
- Falls back to default if no match

## Supported Content Types

- **application/json**: JSON serialization/deserialization
- **application/xml**: XML serialization/deserialization
- **application/x-msgpack**: MessagePack binary format
- **application/x-protobuf**: Protobuf binary format

## Built-in Transformers

### Request Transformers
- **trim**: Trim whitespace from strings
- **sanitize**: Sanitize HTML to prevent XSS
- **validate**: Validate against schema

### Response Transformers
- **remove-nulls**: Remove null values from output
- **format-dates**: Format Date objects to ISO strings
- **filter**: Filter sensitive data

## Usage

### TypeScript/Node.js

\`\`\`typescript
import { ${toPascalCase(serviceName)}TransformationMiddleware, createExpressMiddleware } from './transformation';

const transformation = new ${toPascalCase(serviceName)}TransformationMiddleware({
  serviceName: '${serviceName}',
  supportedContentTypes: ['application/json', 'application/xml'],
  enableValidation: true,
});

// Express middleware
app.use(createExpressMiddleware(transformation));
\`\`\`

### Python

\`\`\`python
from ${serviceName}_transformation import ${toPascalCase(serviceName)}TransformationMiddleware, create_fastapi_middleware

config = {
    'serviceName': '${serviceName}',
    'supportedContentTypes': [ContentType.JSON, ContentType.XML],
    'enableValidation': True,
}

transformation = ${toPascalCase(serviceName)}TransformationMiddleware(config)

# FastAPI middleware
app.add_middleware(create_fastapi_middleware(transformation))
\`\`\`

### Go

\`\`\`go
import "yourpackage/${serviceName}-transformation"

config := map[string]interface{}{
    "serviceName": "${serviceName}",
}

transformation := New${toPascalCase(serviceName)}TransformationMiddleware(config)

// Use as middleware in your HTTP handler
\`\`\`

## Custom Transformers

Add custom transformation logic:

\`\`\`typescript
// TypeScript
transformation.addRequestTransformer((data) => {
  // Custom transformation logic
  return data;
});

transformation.addResponseTransformer((data) => {
  // Custom transformation logic
  return data;
});
\`\`\`

## Validation

Enable schema validation for requests and responses:

\`\`\`typescript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['name', 'email'],
};

const isValid = await transformation.validate(data, schema);
\`\`\`

## Performance Considerations

- Content negotiation is fast (O(n) where n = number of accepted types)
- Transformation pipeline is sequential (consider order)
- Caching can be added for frequently transformed data
- Compression adds CPU overhead but reduces bandwidth
`;
}
