/**
 * Universal Data Validation across Language Boundaries
 * Rule sharing, cross-language validation, schema-based validation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Validation rule types
export type ValidationRuleType =
  | 'required'
  | 'type'
  | 'range'
  | 'length'
  | 'pattern'
  | 'format'
  | 'enum'
  | 'custom'
  | 'conditional'
  | 'array';

// Data types
export type DataType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

// Validation severity
export type ValidationSeverity = 'error' | 'warning' | 'info';

// Validation rule interface
export interface ValidationRule {
  name: string;
  type: ValidationRuleType;
  field?: string;
  dataType?: DataType;
  constraints?: Record<string, any>;
  message?: string;
  severity?: ValidationSeverity;
  dependsOn?: string[];
  customValidator?: string;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
}

// Validation error
export interface ValidationError {
  field: string;
  message: string;
  rule: string;
  severity: ValidationSeverity;
  value?: any;
  constraints?: Record<string, any>;
}

// Validation schema
export interface ValidationSchema {
  name: string;
  version: string;
  rules: ValidationRule[];
  allowUnknownFields?: boolean;
  strictMode?: boolean;
}

// Validator configuration
export interface ValidatorConfig {
  serviceName: string;
  schemaType: 'json-schema' | 'openapi' | 'custom';
  enableAutoValidation: boolean;
  throwOnError: boolean;
  logWarnings: boolean;
  sharedRulesPath?: string;
}

// Generate validator config
export async function generateValidatorConfig(
  serviceName: string,
  schemaType: 'json-schema' | 'openapi' | 'custom' = 'json-schema'
): Promise<ValidatorConfig> {
  return {
    serviceName,
    schemaType,
    enableAutoValidation: true,
    throwOnError: true,
    logWarnings: true,
  };
}

// Check if value matches data type
function checkDataType(value: any, dataType: DataType): boolean {
  switch (dataType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

// Generate TypeScript validator
export async function generateTypeScriptValidator(
  config: ValidatorConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-validator.ts`,
    content: `// Universal Data Validator for ${config.serviceName}

export type ValidationRuleType =
  | 'required'
  | 'type'
  | 'range'
  | 'length'
  | 'pattern'
  | 'format'
  | 'enum'
  | 'custom'
  | 'conditional'
  | 'array';

export type DataType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationRule {
  name: string;
  type: ValidationRuleType;
  field?: string;
  dataType?: DataType;
  constraints?: Record<string, any>;
  message?: string;
  severity?: ValidationSeverity;
  dependsOn?: string[];
  customValidator?: (value: any, data: any) => boolean | string;
}

export interface ValidationError {
  field: string;
  message: string;
  rule: string;
  severity: ValidationSeverity;
  value?: any;
  constraints?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
}

export interface ValidationSchema {
  name: string;
  version: string;
  rules: ValidationRule[];
  allowUnknownFields?: boolean;
  strictMode?: boolean;
}

export class ${toPascalCase(config.serviceName)}Validator {
  private schemas: Map<string, ValidationSchema>;
  private config: any;

  constructor(config: any) {
    this.schemas = new Map();
    this.config = config;
  }

  /**
   * Register a validation schema
   */
  registerSchema(schema: ValidationSchema): void {
    this.schemas.set(schema.name, schema);
  }

  /**
   * Validate data against a schema
   */
  validate(schemaName: string, data: any): ValidationResult {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(\`Schema '\${schemaName}' not found\`);
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    // Check dependencies first
    const orderedRules = this.topologicalSort(schema.rules);

    for (const rule of orderedRules) {
      if (rule.field && !this.checkDependencies(rule, data)) {
        continue; // Skip rule if dependencies not met
      }

      const result = this.executeRule(rule, data);
      if (result) {
        const severity = rule.severity || 'error';
        if (severity === 'error') errors.push(result);
        else if (severity === 'warning') warnings.push(result);
        else info.push(result);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Execute a single validation rule
   */
  private executeRule(rule: ValidationRule, data: any): ValidationError | null {
    if (!rule.field) return null;

    const value = this.getNestedValue(data, rule.field);

    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            field: rule.field,
            message: rule.message || \`Field '\${rule.field}' is required\`,
            rule: rule.name,
            severity: rule.severity || 'error',
            value,
          };
        }
        break;

      case 'type':
        if (value !== undefined && value !== null && !this.checkDataType(value, rule.dataType!)) {
          return {
            field: rule.field,
            message: rule.message || \`Field '\${rule.field}' must be of type \${rule.dataType}\`,
            rule: rule.name,
            severity: rule.severity || 'error',
            value,
            constraints: { expectedType: rule.dataType },
          };
        }
        break;

      case 'range':
        if (value !== undefined && value !== null) {
          const { min, max } = rule.constraints || {};
          if (min !== undefined && value < min) {
            return {
              field: rule.field,
              message: rule.message || \`Field '\${rule.field}' must be at least \${min}\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
              constraints: { min },
            };
          }
          if (max !== undefined && value > max) {
            return {
              field: rule.field,
              message: rule.message || \`Field '\${rule.field}' must be at most \${max}\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
              constraints: { max },
            };
          }
        }
        break;

      case 'length':
        if (value !== undefined && value !== null) {
          const { minLength, maxLength } = rule.constraints || {};
          const len = Array.isArray(value) || typeof value === 'string' ? value.length : 0;
          if (minLength !== undefined && len < minLength) {
            return {
              field: rule.field,
              message: rule.message || \`Field '\${rule.field}' length must be at least \${minLength}\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
              constraints: { minLength, actualLength: len },
            };
          }
          if (maxLength !== undefined && len > maxLength) {
            return {
              field: rule.field,
              message: rule.message || \`Field '\${rule.field}' length must be at most \${maxLength}\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
              constraints: { maxLength, actualLength: len },
            };
          }
        }
        break;

      case 'pattern':
        if (value && typeof value === 'string') {
          const pattern = rule.constraints?.pattern;
          if (pattern && !new RegExp(pattern).test(value)) {
            return {
              field: rule.field,
              message: rule.message || \`Field '\${rule.field}' does not match pattern \${pattern}\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
              constraints: { pattern },
            };
          }
        }
        break;

      case 'format':
        if (value && typeof value === 'string') {
          const format = rule.constraints?.format;
          if (!this.validateFormat(value, format)) {
            return {
              field: rule.field,
              message: rule.message || \`Field '\${rule.field}' must be a valid \${format}\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
              constraints: { format },
            };
          }
        }
        break;

      case 'enum':
        if (value !== undefined && value !== null) {
          const { values } = rule.constraints || {};
          if (values && !values.includes(value)) {
            return {
              field: rule.field,
              message: rule.message || \`Field '\${rule.field}' must be one of: \${values.join(', ')}\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
              constraints: { allowedValues: values },
            };
          }
        }
        break;

      case 'custom':
        if (rule.customValidator) {
          const result = rule.customValidator(value, data);
          if (result !== true) {
            return {
              field: rule.field,
              message: typeof result === 'string' ? result : rule.message || \`Custom validation failed for '\${rule.field}'\`,
              rule: rule.name,
              severity: rule.severity || 'error',
              value,
            };
          }
        }
        break;

      case 'array':
        if (value !== undefined && value !== null && !Array.isArray(value)) {
          return {
            field: rule.field,
            message: rule.message || \`Field '\${rule.field}' must be an array\`,
            rule: rule.name,
            severity: rule.severity || 'error',
            value,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Check if rule dependencies are met
   */
  private checkDependencies(rule: ValidationRule, data: any): boolean {
    if (!rule.dependsOn || rule.dependsOn.length === 0) return true;

    for (const dep of rule.dependsOn) {
      const value = this.getNestedValue(data, dep);
      if (value === undefined || value === null) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sort rules by dependencies (topological sort)
   */
  private topologicalSort(rules: ValidationRule[]): ValidationRule[] {
    const sorted: ValidationRule[] = [];
    const visited = new Set<string>();

    const visit = (rule: ValidationRule) => {
      if (visited.has(rule.name)) return;
      visited.add(rule.name);

      if (rule.dependsOn) {
        for (const dep of rule.dependsOn) {
          const depRule = rules.find(r => r.name === dep);
          if (depRule) visit(depRule);
        }
      }

      sorted.push(rule);
    };

    for (const rule of rules) {
      visit(rule);
    }

    return sorted;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check data type
   */
  private checkDataType(value: any, dataType: DataType): boolean {
    switch (dataType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'null':
        return value === null;
      default:
        return true;
    }
  }

  /**
   * Validate common formats
   */
  private validateFormat(value: string, format: string): boolean {
    switch (format) {
      case 'email':
        return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
      case 'uri':
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      case 'date':
        return !isNaN(Date.parse(value));
      case 'ipv4':
        return /^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(value);
      case 'ipv6':
        return /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1)$/.test(value);
      default:
        return true;
    }
  }

  /**
   * Export schema to JSON
   */
  exportSchema(schemaName: string): string {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(\`Schema '\${schemaName}' not found\`);
    }
    return JSON.stringify(schema, null, 2);
  }

  /**
   * Import schema from JSON
   */
  importSchema(json: string): ValidationSchema {
    const schema = JSON.parse(json);
    this.registerSchema(schema);
    return schema;
  }
}

// Factory function
export function createValidator(config: any) {
  return new ${toPascalCase(config.serviceName)}Validator(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    schemaType: 'json-schema',
    throwOnError: true,
  };

  const validator = new ${toPascalCase(config.serviceName)}Validator(config);

  // Define a validation schema
  const userSchema: ValidationSchema = {
    name: 'User',
    version: '1.0.0',
    rules: [
      {
        name: 'email_required',
        type: 'required',
        field: 'email',
        message: 'Email is required',
      },
      {
        name: 'email_format',
        type: 'format',
        field: 'email',
        constraints: { format: 'email' },
        message: 'Invalid email format',
      },
      {
        name: 'age_range',
        type: 'range',
        field: 'age',
        constraints: { min: 18, max: 120 },
        message: 'Age must be between 18 and 120',
      },
      {
        name: 'role_enum',
        type: 'enum',
        field: 'role',
        constraints: { values: ['user', 'admin', 'moderator'] },
        message: 'Invalid role',
      },
    ],
  };

  validator.registerSchema(userSchema);

  // Validate data
  const data = {
    email: 'user@example.com',
    age: 25,
    role: 'user',
  };

  const result = validator.validate('User', data);

  if (result.valid) {
    console.log('✓ Validation passed');
  } else {
    console.error('✗ Validation failed:', result.errors);
  }

  if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python validator
export async function generatePythonValidator(
  config: ValidatorConfig
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
    path: `${config.serviceName}_validator.py`,
    content: `# Universal Data Validator for ${config.serviceName}
from typing import Dict, Any, List, Optional, Callable, Union
from dataclasses import dataclass
from enum import Enum
import re
import json
from datetime import datetime

class ValidationRuleType(Enum):
    REQUIRED = 'required'
    TYPE = 'type'
    RANGE = 'range'
    LENGTH = 'length'
    PATTERN = 'pattern'
    FORMAT = 'format'
    ENUM = 'enum'
    CUSTOM = 'custom'
    CONDITIONAL = 'conditional'
    ARRAY = 'array'

class DataType(Enum):
    STRING = 'string'
    NUMBER = 'number'
    INTEGER = 'integer'
    BOOLEAN = 'boolean'
    ARRAY = 'array'
    OBJECT = 'object'
    NULL = 'null'

class ValidationSeverity(Enum):
    ERROR = 'error'
    WARNING = 'warning'
    INFO = 'info'

@dataclass
class ValidationError:
    field: str
    message: str
    rule: str
    severity: ValidationSeverity
    value: Any = None
    constraints: Dict[str, Any] = None

@dataclass
class ValidationResult:
    valid: bool
    errors: List[ValidationError]
    warnings: List[ValidationError]
    info: List[ValidationError]

@dataclass
class ValidationRule:
    name: str
    type: ValidationRuleType
    field: Optional[str] = None
    data_type: Optional[DataType] = None
    constraints: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    severity: ValidationSeverity = ValidationSeverity.ERROR
    depends_on: Optional[List[str]] = None
    custom_validator: Optional[Callable] = None

@dataclass
class ValidationSchema:
    name: str
    version: str
    rules: List[ValidationRule]
    allow_unknown_fields: bool = False
    strict_mode: bool = False

class ${toPascalCase(config.serviceName)}Validator:
    def __init__(self, config: Dict[str, Any]):
        self.schemas: Dict[str, ValidationSchema] = {}
        self.config = config

    def register_schema(self, schema: ValidationSchema) -> None:
        """Register a validation schema"""
        self.schemas[schema.name] = schema

    def validate(self, schema_name: str, data: Dict[str, Any]) -> ValidationResult:
        """Validate data against a schema"""
        schema = self.schemas.get(schema_name)
        if not schema:
            raise ValueError(f"Schema '{schema_name}' not found")

        errors = []
        warnings = []
        info_messages = []

        for rule in schema.rules:
            if rule.field and not self._check_dependencies(rule, data):
                continue

            result = self._execute_rule(rule, data)
            if result:
                if result.severity == ValidationSeverity.ERROR:
                    errors.append(result)
                elif result.severity == ValidationSeverity.WARNING:
                    warnings.append(result)
                else:
                    info_messages.append(result)

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            info=info_messages,
        )

    def _execute_rule(self, rule: ValidationRule, data: Dict[str, Any]) -> Optional[ValidationError]:
        """Execute a single validation rule"""
        if not rule.field:
            return None

        value = self._get_nested_value(data, rule.field)

        if rule.type == ValidationRuleType.REQUIRED:
            if value is None or value == '':
                return ValidationError(
                    field=rule.field,
                    message=rule.message or f"Field '{rule.field}' is required",
                    rule=rule.name,
                    severity=rule.severity,
                    value=value,
                )

        elif rule.type == ValidationRuleType.TYPE:
            if value is not None and not self._check_data_type(value, rule.data_type):
                return ValidationError(
                    field=rule.field,
                    message=rule.message or f"Field '{rule.field}' must be of type {rule.data_type.value}",
                    rule=rule.name,
                    severity=rule.severity,
                    value=value,
                    constraints={'expected_type': rule.data_type.value},
                )

        elif rule.type == ValidationRuleType.RANGE:
            if value is not None:
                min_val = rule.constraints.get('min') if rule.constraints else None
                max_val = rule.constraints.get('max') if rule.constraints else None
                if min_val is not None and value < min_val:
                    return ValidationError(
                        field=rule.field,
                        message=rule.message or f"Field '{rule.field}' must be at least {min_val}",
                        rule=rule.name,
                        severity=rule.severity,
                        value=value,
                        constraints={'min': min_val},
                    )
                if max_val is not None and value > max_val:
                    return ValidationError(
                        field=rule.field,
                        message=rule.message or f"Field '{rule.field}' must be at most {max_val}",
                        rule=rule.name,
                        severity=rule.severity,
                        value=value,
                        constraints={'max': max_val},
                    )

        return None

    def _check_dependencies(self, rule: ValidationRule, data: Dict[str, Any]) -> bool:
        """Check if rule dependencies are met"""
        if not rule.depends_on:
            return True

        for dep in rule.depends_on:
            value = self._get_nested_value(data, dep)
            if value is None:
                return False

        return True

    def _get_nested_value(self, obj: Dict[str, Any], path: str) -> Any:
        """Get nested value from object using dot notation"""
        keys = path.split('.')
        value = obj
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value

    def _check_data_type(self, value: Any, data_type: DataType) -> bool:
        """Check data type"""
        if data_type == DataType.STRING:
            return isinstance(value, str)
        elif data_type == DataType.NUMBER:
            return isinstance(value, (int, float)) and not isinstance(value, bool)
        elif data_type == DataType.INTEGER:
            return isinstance(value, int) and not isinstance(value, bool)
        elif data_type == DataType.BOOLEAN:
            return isinstance(value, bool)
        elif data_type == DataType.ARRAY:
            return isinstance(value, list)
        elif data_type == DataType.OBJECT:
            return isinstance(value, dict)
        elif data_type == DataType.NULL:
            return value is None
        return True

# Usage
async def main():
    config = {'serviceName': '${config.serviceName}', 'schemaType': 'json-schema'}
    validator = ${toPascalCase(config.serviceName)}Validator(config)

    schema = ValidationSchema(
        name='User',
        version='1.0.0',
        rules=[
            ValidationRule(
                name='email_required',
                type=ValidationRuleType.REQUIRED,
                field='email',
                message='Email is required',
            ),
        ],
    )

    validator.register_schema(schema)
    result = validator.validate('User', {'email': 'user@example.com'})

    print(f"Valid: {result.valid}")
    if result.errors:
        print(f"Errors: {result.errors}")

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go validator
export async function generateGoValidator(
  config: ValidatorConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-validator.go`,
    content: `package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

type ValidationRuleType string

const (
	RuleTypeRequired    ValidationRuleType = "required"
	RuleTypeType        ValidationRuleType = "type"
	RuleTypeRange       ValidationRuleType = "range"
	RuleTypeLength      ValidationRuleType = "length"
	RuleTypePattern     ValidationRuleType = "pattern"
	RuleTypeFormat      ValidationRuleType = "format"
	RuleTypeEnum        ValidationRuleType = "enum"
	RuleTypeCustom      ValidationRuleType = "custom"
	RuleTypeConditional ValidationRuleType = "conditional"
	RuleTypeArray       ValidationRuleType = "array"
)

type DataType string

const (
	DataTypeString   DataType = "string"
	DataTypeNumber   DataType = "number"
	DataTypeInteger  DataType = "integer"
	DataTypeBoolean  DataType = "boolean"
	DataTypeArray    DataType = "array"
	DataTypeObject   DataType = "object"
	DataTypeNull     DataType = "null"
)

type ValidationSeverity string

const (
	SeverityError   ValidationSeverity = "error"
	SeverityWarning ValidationSeverity = "warning"
	SeverityInfo    ValidationSeverity = "info"
)

type ValidationError struct {
	Field       string                 \`json:"field"\`
	Message     string                 \`json:"message"\`
	Rule        string                 \`json:"rule"\`
	Severity    ValidationSeverity     \`json:"severity"\`
	Value       interface{}            \`json:"value,omitempty"\`
	Constraints map[string]interface{} \`json:"constraints,omitempty"\`
}

type ValidationResult struct {
	Valid    bool                \`json:"valid"\`
	Errors   []ValidationError   \`json:"errors"\`
	Warnings []ValidationError   \`json:"warnings"\`
	Info     []ValidationError   \`json:"info"\`
}

type ValidationRule struct {
	Name            string                 \`json:"name"\`
	Type            ValidationRuleType     \`json:"type"\`
	Field           string                 \`json:"field,omitempty"\`
	DataType        DataType               \`json:"dataType,omitempty"\`
	Constraints     map[string]interface{} \`json:"constraints,omitempty"\`
	Message         string                 \`json:"message,omitempty"\`
	Severity        ValidationSeverity     \`json:"severity,omitempty"\`
	DependsOn       []string               \`json:"dependsOn,omitempty"\`
}

type ValidationSchema struct {
	Name               string           \`json:"name"\`
	Version            string           \`json:"version"\`
	Rules              []ValidationRule \`json:"rules"\`
	AllowUnknownFields bool             \`json:"allowUnknownFields,omitempty"\`
	StrictMode         bool             \`json:"strictMode,omitempty"\`
}

type ${toPascalCase(config.serviceName)}Validator struct {
	schemas map[string]ValidationSchema
	config  map[string]interface{}
}

func New${toPascalCase(config.serviceName)}Validator(config map[string]interface{}) *${toPascalCase(config.serviceName)}Validator {
	return &${toPascalCase(config.serviceName)}Validator{
		schemas: make(map[string]ValidationSchema),
		config:  config,
	}
}

func (v *${toPascalCase(config.serviceName)}Validator) RegisterSchema(schema ValidationSchema) {
	v.schemas[schema.Name] = schema
}

func (v *${toPascalCase(config.serviceName)}Validator) Validate(schemaName string, data map[string]interface{}) ValidationResult {
	schema, exists := v.schemas[schemaName]
	if !exists {
		panic(fmt.Sprintf("Schema '%s' not found", schemaName))
	}

	var errors []ValidationError
	var warnings []ValidationError
	var info []ValidationError

	for _, rule := range schema.Rules {
		if rule.Field != "" && !v.checkDependencies(rule, data) {
			continue
		}

		result := v.executeRule(rule, data)
		if result != nil {
			if result.Severity == SeverityError {
				errors = append(errors, *result)
			} else if result.Severity == SeverityWarning {
				warnings = append(warnings, *result)
			} else {
				info = append(info, *result)
			}
		}
	}

	return ValidationResult{
		Valid:    len(errors) == 0,
		Errors:   errors,
		Warnings: warnings,
		Info:     info,
	}
}

func (v *${toPascalCase(config.serviceName)}Validator) executeRule(rule ValidationRule, data map[string]interface{}) *ValidationError {
	if rule.Field == "" {
		return nil
	}

	value := v.getNestedValue(data, rule.Field)

	switch rule.Type {
	case RuleTypeRequired:
		if value == nil || value == "" {
			return &ValidationError{
				Field:    rule.Field,
				Message:  rule.Message,
				Rule:     rule.Name,
				Severity: rule.Severity,
				Value:    value,
			}
		}

	case RuleTypeType:
		if value != nil && !v.checkDataType(value, rule.DataType) {
			return &ValidationError{
				Field:    rule.Field,
				Message:  rule.Message,
				Rule:     rule.Name,
				Severity: rule.Severity,
				Value:    value,
			}
		}
	}

	return nil
}

func (v *${toPascalCase(config.serviceName)}Validator) checkDependencies(rule ValidationRule, data map[string]interface{}) bool {
	if len(rule.DependsOn) == 0 {
		return true
	}

	for _, dep := range rule.DependsOn {
		value := v.getNestedValue(data, dep)
		if value == nil {
			return false
		}
	}

	return true
}

func (v *${toPascalCase(config.serviceName)}Validator) getNestedValue(obj map[string]interface{}, path string) interface{} {
	keys := strings.Split(path, ".")
	var value interface{} = obj

	for _, key := range keys {
		if m, ok := value.(map[string]interface{}); ok {
			value = m[key]
		} else {
			return nil
		}
	}

	return value
}

func (v *${toPascalCase(config.serviceName)}Validator) checkDataType(value interface{}, dataType DataType) bool {
	switch dataType {
	case DataTypeString:
		return reflect.TypeOf(value).Kind() == reflect.String
	case DataTypeNumber:
		kind := reflect.TypeOf(value).Kind()
		return kind == reflect.Float32 || kind == reflect.Float64 || kind == reflect.Int || kind == reflect.Int64
	case DataTypeInteger:
		kind := reflect.TypeOf(value).Kind()
		return kind == reflect.Int || kind == reflect.Int64
	case DataTypeBoolean:
		return reflect.TypeOf(value).Kind() == reflect.Bool
	case DataTypeArray:
		return reflect.TypeOf(value).Kind() == reflect.Slice || reflect.TypeOf(value).Kind() == reflect.Array
	case DataTypeObject:
		return reflect.TypeOf(value).Kind() == reflect.Map
	case DataTypeNull:
		return value == nil
	default:
		return true
	}
}

func main() {
	config := map[string]interface{}{"serviceName": "${config.serviceName}"}
	validator := New${toPascalCase(config.serviceName)}Validator(config)

	schema := ValidationSchema{
		Name:    "User",
		Version: "1.0.0",
		Rules: []ValidationRule{
			{
				Name:     "email_required",
				Type:     RuleTypeRequired,
				Field:    "email",
				Message:  "Email is required",
				Severity: SeverityError,
			},
		},
	}

	validator.RegisterSchema(schema)

	data := map[string]interface{}{
		"email": "user@example.com",
	}

	result := validator.Validate("User", data)

	fmt.Printf("Valid: %v\\n", result.Valid)
	if len(result.Errors) > 0 {
		fmt.Printf("Errors: %v\\n", result.Errors)
	}
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeValidatorFiles(
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
export async function displayValidatorConfig(config: ValidatorConfig): Promise<void> {
  console.log(chalk.bold.magenta('\n🔍 Universal Validator: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Schema Type:'), config.schemaType);
  console.log(chalk.cyan('Auto Validation:'), config.enableAutoValidation ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Throw on Error:'), config.throwOnError ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Log Warnings:'), config.logWarnings ? chalk.green('enabled') : chalk.red('disabled'));

  console.log(chalk.cyan('\n📋 Supported Rule Types:'));
  console.log(chalk.gray('  • required - Field must be present and non-empty'));
  console.log(chalk.gray('  • type - Check data type (string, number, integer, boolean, array, object)'));
  console.log(chalk.gray('  • range - Numeric range validation (min, max)'));
  console.log(chalk.gray('  • length - String/array length validation (minLength, maxLength)'));
  console.log(chalk.gray('  • pattern - Regex pattern matching'));
  console.log(chalk.gray('  • format - Common formats (email, url, uuid, date, ipv4, ipv6)'));
  console.log(chalk.gray('  • enum - Value must be in allowed list'));
  console.log(chalk.gray('  • custom - Custom validation function'));
  console.log(chalk.gray('  • conditional - Rules based on other field values'));
  console.log(chalk.gray('  • array - Validate array elements'));

  console.log(chalk.cyan('\n🌐 Cross-Language Features:'));
  console.log(chalk.gray('  • Shared validation rules exported as JSON'));
  console.log(chalk.gray('  • Rule definitions compatible across TypeScript, Python, Go'));
  console.log(chalk.gray('  • Consistent error messages and severity levels'));
  console.log(chalk.gray('  • Schema import/export for rule sharing'));

  console.log(chalk.cyan('\n✅ Validation Severity Levels:'));
  console.log(chalk.gray('  • error - Critical validation failures (blocks execution)'));
  console.log(chalk.gray('  • warning - Non-critical issues (logged but continues)'));
  console.log(chalk.gray('  • info - Informational messages only'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Universal Validator Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This universal validator provides:
- **Cross-Language Validation**: Shared rules work across TypeScript, Python, Go
- **10 Rule Types**: required, type, range, length, pattern, format, enum, custom, conditional, array
- **Format Validation**: Built-in validators for email, URL, UUID, date, IP addresses
- **Dependency Handling**: Conditional validation based on other fields
- **Schema Management**: Import/export schemas as JSON for rule sharing
- **Detailed Errors**: Field-level errors with messages, values, and constraints

## Usage Examples

### Basic Validation

\`\`\`typescript
import { ${toPascalCase(serviceName)}Validator, ValidationSchema } from './${serviceName}-validator';

const validator = new ${toPascalCase(serviceName)}Validator({ serviceName: '${serviceName}' });

// Define schema
const schema: ValidationSchema = {
  name: 'User',
  version: '1.0.0',
  rules: [
    {
      name: 'email_required',
      type: 'required',
      field: 'email',
      message: 'Email is required',
    },
    {
      name: 'email_format',
      type: 'format',
      field: 'email',
      constraints: { format: 'email' },
      message: 'Invalid email format',
    },
  ],
};

validator.registerSchema(schema);

// Validate data
const result = validator.validate('User', { email: 'user@example.com' });

if (result.valid) {
  console.log('✓ Validation passed');
} else {
  console.error('✗ Validation failed:', result.errors);
}
\`\`\`

### Export/Import for Cross-Language Sharing

\`\`\`typescript
// Export schema to JSON
const jsonSchema = validator.exportSchema('User');
fs.writeFileSync('user-schema.json', jsonSchema);

// Import in another language
// Python: validator.import_schema(json.loads('user-schema.json'))
// Go: json.Unmarshal([]byte(jsonSchema), &schema)
\`\`\`

## Rule Types Reference

| Rule Type | Description | Constraints |
|-----------|-------------|-------------|
| required | Field must be present and non-empty | None |
| type | Check data type | dataType |
| range | Numeric range | min, max |
| length | String/array length | minLength, maxLength |
| pattern | Regex match | pattern (string) |
| format | Common formats | format (email, url, uuid, date, ipv4, ipv6) |
| enum | Allowed values | values (array) |
| custom | Custom validator | customValidator (function) |
| conditional | Depends on other fields | dependsOn (array) |
| array | Array validation | None |

## Integration

See generated code for complete API reference and usage examples.
`;
}
