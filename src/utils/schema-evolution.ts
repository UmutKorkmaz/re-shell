/**
 * Schema Evolution and Backwards Compatibility Management
 * Version tracking for schemas, migration tools, compatibility checking
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Schema types
export type SchemaType = 'avro' | 'protobuf' | 'json-schema' | 'openapi' | 'graphql' | 'sql';

// Evolution types
export type EvolutionType = 'add_field' | 'remove_field' | 'rename_field' | 'change_type' | 'add_default' | 'breaking';

// Compatibility level
export type CompatibilityLevel = 'full' | 'forward' | 'backward' | 'none' | 'unknown';

// Schema version
export interface SchemaVersion {
  version: string;
  schema: any;
  type: SchemaType;
  createdAt: Date;
  compatibleFrom?: string[];
  compatibleTo?: string[];
  breakingChanges: string[];
  migrations: Migration[];
}

// Migration definition
export interface Migration {
  fromVersion: string;
  toVersion: string;
  type: EvolutionType;
  field?: string;
  oldType?: string;
  newType?: string;
  defaultValue?: any;
  transformation?: string;
  description: string;
}

// Schema registry
export interface SchemaRegistry {
  schemas: Map<string, SchemaVersion[]>;
  currentVersion: Map<string, string>;
}

// Evolution configuration
export interface EvolutionConfig {
  serviceName: string;
  schemaType: SchemaType;
  enableAutoMigration: boolean;
  requireCompatibility: boolean;
  breakingChangePolicy: 'allow' | 'warn' | 'block';
}

// Generate evolution config
export async function generateEvolutionConfig(
  serviceName: string,
  schemaType: SchemaType = 'avro'
): Promise<EvolutionConfig> {
  return {
    serviceName,
    schemaType,
    enableAutoMigration: true,
    requireCompatibility: true,
    breakingChangePolicy: 'warn',
  };
}

// Check compatibility between schema versions
export function checkCompatibility(
  oldSchema: SchemaVersion,
  newSchema: SchemaVersion
): CompatibilityLevel {
  const hasBreaking = newSchema.breakingChanges.length > 0;
  const hasForwardCompatible = newSchema.compatibleFrom?.includes(oldSchema.version);
  const hasBackwardCompatible = newSchema.compatibleTo?.includes(oldSchema.version);

  if (!hasBreaking && hasForwardCompatible && hasBackwardCompatible) {
    return 'full';
  }

  if (!hasBreaking && hasBackwardCompatible) {
    return 'backward';
  }

  if (!hasBreaking && hasForwardCompatible) {
    return 'forward';
  }

  if (hasBreaking) {
    return 'none';
  }

  return 'unknown';
}

// Generate TypeScript implementation
export async function generateTypeScriptEvolution(
  config: EvolutionConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-schema-evolution.ts`,
    content: `// Schema Evolution and Backwards Compatibility Management

export type SchemaType = 'avro' | 'protobuf' | 'json-schema' | 'openapi' | 'graphql' | 'sql';
export type CompatibilityLevel = 'full' | 'forward' | 'backward' | 'none' | 'unknown';
export type EvolutionType = 'add_field' | 'remove_field' | 'rename_field' | 'change_type' | 'add_default' | 'breaking';

export interface SchemaVersion {
  version: string;
  schema: any;
  type: SchemaType;
  createdAt: Date;
  compatibleFrom?: string[];
  compatibleTo?: string[];
  breakingChanges: string[];
  migrations: Migration[];
}

export interface Migration {
  fromVersion: string;
  toVersion: string;
  type: EvolutionType;
  field?: string;
  oldType?: string;
  newType?: string;
  defaultValue?: any;
  transformation?: string;
  description: string;
}

export class ${toPascalCase(config.serviceName)}SchemaEvolution {
  private registry: Map<string, SchemaVersion[]>;
  private currentVersion: Map<string, string>;
  private config: any;

  constructor(config: any) {
    this.registry = new Map();
    this.currentVersion = new Map();
    this.config = config;
  }

  /**
   * Register a new schema version
   */
  registerVersion(schemaName: string, schema: any, version: string): SchemaVersion {
    const versions = this.registry.get(schemaName) || [];

    const schemaVersion: SchemaVersion = {
      version,
      schema,
      type: this.config.schemaType,
      createdAt: new Date(),
      compatibleFrom: [],
      compatibleTo: [],
      breakingChanges: [],
      migrations: [],
    };

    // Analyze compatibility with previous version
    if (versions.length > 0) {
      const previousVersion = versions[versions.length - 1];
      const compatibility = this.analyzeCompatibility(previousVersion, schemaVersion);

      schemaVersion.compatibleFrom = compatibility.backward ? [previousVersion.version] : undefined;
      schemaVersion.compatibleTo = compatibility.forward ? [previousVersion.version] : undefined;
      schemaVersion.breakingChanges = compatibility.breakingChanges;
      schemaVersion.migrations = this.generateMigrations(previousVersion, schemaVersion);
    }

    versions.push(schemaVersion);
    this.registry.set(schemaName, versions);
    this.currentVersion.set(schemaName, version);

    return schemaVersion;
  }

  /**
   * Analyze compatibility between two schema versions
   */
  private analyzeCompatibility(
    oldSchema: SchemaVersion,
    newSchema: SchemaVersion
  ): {
    forward: boolean;
    backward: boolean;
    breakingChanges: string[];
  } {
    const breakingChanges: string[] = [];
    let forward = true;
    let backward = true;

    // Check for added fields (backward compatible)
    const oldFields = new Set(Object.keys(oldSchema.schema.fields || {}));
    const newFields = new Set(Object.keys(newSchema.schema.fields || {}));

    for (const field of newFields) {
      if (!oldFields.has(field)) {
        // New field - check if it has a default value
        const fieldDef = newSchema.schema.fields[field];
        if (fieldDef.default === undefined && fieldDef.required) {
          breakingChanges.push(\`Required field '\${field}' added without default value\`);
          backward = false;
        }
      }
    }

    // Check for removed fields (breaking change)
    for (const field of oldFields) {
      if (!newFields.has(field)) {
        breakingChanges.push(\`Field '\${field}' was removed\`);
        forward = false;
        backward = false;
      }
    }

    // Check for type changes
    for (const field of oldFields) {
      if (newFields.has(field)) {
        const oldField = oldSchema.schema.fields[field];
        const newField = newSchema.schema.fields[field];

        if (oldField.type !== newField.type) {
          breakingChanges.push(\`Field '\${field}' type changed from \${oldField.type} to \${newField.type}\`);
          backward = false;
        }
      }
    }

    return { forward, backward, breakingChanges };
  }

  /**
   * Generate migrations between schema versions
   */
  private generateMigrations(
    oldSchema: SchemaVersion,
    newSchema: SchemaVersion
  ): Migration[] {
    const migrations: Migration[] = [];
    const oldFields = new Set(Object.keys(oldSchema.schema.fields || {}));
    const newFields = new Set(Object.keys(newSchema.schema.fields || {}));

    // Detect added fields
    for (const field of newFields) {
      if (!oldFields.has(field)) {
        const fieldDef = newSchema.schema.fields[field];
        migrations.push({
          fromVersion: oldSchema.version,
          toVersion: newSchema.version,
          type: 'add_field',
          field,
          newType: fieldDef.type,
          defaultValue: fieldDef.default,
          description: \`Added field '\${field}' of type \${fieldDef.type}\`,
        });
      }
    }

    // Detect removed fields
    for (const field of oldFields) {
      if (!newFields.has(field)) {
        migrations.push({
          fromVersion: oldSchema.version,
          toVersion: newSchema.version,
          type: 'remove_field',
          field,
          description: \`Removed field '\${field}'\`,
        });
      }
    }

    return migrations;
  }

  /**
   * Get schema version
   */
  getVersion(schemaName: string, version: string): SchemaVersion | undefined {
    const versions = this.registry.get(schemaName);
    return versions?.find(v => v.version === version);
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(schemaName: string): SchemaVersion | undefined {
    const version = this.currentVersion.get(schemaName);
    return version ? this.getVersion(schemaName, version) : undefined;
  }

  /**
   * Check if migration is needed
   */
  needsMigration(schemaName: string, fromVersion: string, toVersion: string): boolean {
    const from = this.getVersion(schemaName, fromVersion);
    const to = this.getVersion(schemaName, toVersion);

    if (!from || !to) {
      return false;
    }

    const compatibility = checkCompatibility(from, to);
    return compatibility === 'none' || compatibility === 'forward';
  }

  /**
   * Apply migration to data
   */
  applyMigration(data: any, migration: Migration): any {
    const result = { ...data };

    switch (migration.type) {
      case 'add_field':
        if (migration.defaultValue !== undefined) {
          result[migration.field!] = migration.defaultValue;
        }
        break;

      case 'remove_field':
        delete result[migration.field!];
        break;

      case 'rename_field':
        // Implementation depends on specific migration
        break;

      case 'change_type':
        // Type conversion logic here
        break;
    }

    return result;
  }

  /**
   * Get migration path between versions
   */
  getMigrationPath(schemaName: string, fromVersion: string, toVersion: string): Migration[] {
    const versions = this.registry.get(schemaName) || [];
    const path: Migration[] = [];

    let current = fromVersion;
    let found = false;

    for (const version of versions) {
      if (version.version === current) {
        current = version.version;

        if (current === toVersion) {
          found = true;
          break;
        }

        // Add migrations to next version
        const nextVersion = versions.find(v => v.version === this.getNextVersion(versions, current));
        if (nextVersion) {
          path.push(...nextVersion.migrations.filter(m => m.fromVersion === current && m.toVersion === nextVersion.version));
          current = nextVersion.version;
        }
      }
    }

    return found ? path : [];
  }

  private getNextVersion(versions: SchemaVersion[], currentVersion: string): string {
    const idx = versions.findIndex(v => v.version === currentVersion);
    return idx >= 0 && idx < versions.length - 1 ? versions[idx + 1].version : '';
  }

  /**
   * Export schema to format
   */
  exportSchema(schemaName: string, version: string, format: SchemaType): string {
    const schemaVersion = this.getVersion(schemaName, version);

    if (!schemaVersion) {
      throw new Error(\`Schema \${schemaName} version \${version} not found\`);
    }

    switch (format) {
      case 'avro':
        return JSON.stringify(schemaVersion.schema, null, 2);

      case 'json-schema':
        return JSON.stringify(this.convertToJsonSchema(schemaVersion.schema), null, 2);

      default:
        return JSON.stringify(schemaVersion.schema, null, 2);
    }
  }

  private convertToJsonSchema(schema: any): any {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: schema.fields || {},
      required: Object.entries(schema.fields || {})
        .filter(([_, def]: any) => def.required)
        .map(([name]: any) => name),
    };
  }
}

// Factory function
export function createSchemaEvolution(config: any) {
  return new ${toPascalCase(config.serviceName)}SchemaEvolution(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    schemaType: '${config.schemaType}',
    breakingChangePolicy: 'warn',
  };

  const evolution = new ${toPascalCase(config.serviceName)}SchemaEvolution(config);

  // Register initial schema
  evolution.registerVersion('User', {
    type: 'record',
    name: 'User',
    fields: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
    },
  }, '1.0.0');

  // Register evolved schema
  const v2 = evolution.registerVersion('User', {
    type: 'record',
    name: 'User',
    fields: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      age: { type: 'int', default: 0 }, // New field with default
    },
  }, '2.0.0');

  console.log('Schema v2:', v2);
  console.log('Breaking changes:', v2.breakingChanges);
  console.log('Migrations:', v2.migrations);
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation (simplified)
export async function generatePythonEvolution(
  config: EvolutionConfig
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
    path: `${config.serviceName}_schema_evolution.py`,
    content: `# Schema Evolution for ${config.serviceName}
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
import json

class SchemaType(Enum):
    AVRO = 'avro'
    PROTOBUF = 'protobuf'
    JSON_SCHEMA = 'json-schema'

@dataclass
class SchemaVersion:
    version: str
    schema: Dict[str, Any]
    type: SchemaType
    created_at: str
    compatible_from: List[str] = None
    compatible_to: List[str] = None
    breaking_changes: List[str] = None
    migrations: List[Dict] = None

class ${toPascalCase(config.serviceName)}SchemaEvolution:
    def __init__(self, config: Dict[str, Any]):
        self.registry: Dict[str, List[SchemaVersion]] = {}
        self.current_version: Dict[str, str] = {}
        self.config = config

    def register_version(self, schema_name: str, schema: Dict, version: str) -> SchemaVersion:
        versions = self.registry.get(schema_name, [])

        schema_version = SchemaVersion(
            version=version,
            schema=schema,
            type=SchemaType.AVRO,
            created_at=str(datetime.utcnow()),
            compatible_from=[],
            compatible_to=[],
            breaking_changes=[],
            migrations=[],
        )

        versions.append(schema_version)
        self.registry[schema_name] = versions
        self.current_version[schema_name] = version

        return schema_version

# Usage
async def main():
    from datetime import datetime
    config = {'serviceName': '${config.serviceName}', 'schemaType': 'avro'}
    evolution = ${toPascalCase(config.serviceName)}SchemaEvolution(config)

    schema = {
        'type': 'record',
        'name': 'User',
        'fields': {
            'id': {'type': 'string'},
            'name': {'type': 'string'},
        }
    }

    v1 = evolution.register_version('User', schema, '1.0.0')
    print('Schema v1:', v1)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation (simplified)
export async function generateGoEvolution(
  config: EvolutionConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-schema-evolution.go`,
    content: `package main

import (
	"encoding/json"
	"fmt"
	"time"
)

type SchemaType string

const (
	SchemaTypeAvro    SchemaType = "avro"
	SchemaTypeProtobuf SchemaType = "protobuf"
)

type SchemaVersion struct {
	Version          string
	Schema           interface{}
	Type             SchemaType
	CreatedAt        time.Time
	CompatibleFrom   []string
	CompatibleTo     []string
	BreakingChanges  []string
	Migrations       []Migration
}

type Migration struct {
	FromVersion string
	ToVersion   string
	Type        string
	Field       string
	Description string
}

type ${toPascalCase(config.serviceName)}SchemaEvolution struct {
	registry       map[string][]SchemaVersion
	currentVersion map[string]string
	config         map[string]interface{}
}

func New${toPascalCase(config.serviceName)}SchemaEvolution(config map[string]interface{}) *${toPascalCase(config.serviceName)}SchemaEvolution {
	return &${toPascalCase(config.serviceName)}SchemaEvolution{
		registry:       make(map[string][]SchemaVersion),
		currentVersion: make(map[string]string),
		config:         config,
	}
}

func (se *${toPascalCase(config.serviceName)}SchemaEvolution) RegisterVersion(schemaName string, schema interface{}, version string) SchemaVersion {
	versions := se.registry[schemaName]

	schemaVersion := SchemaVersion{
		Version:     version,
		Schema:      schema,
		Type:        SchemaTypeAvro,
		CreatedAt:   time.Now(),
		Migrations:  []Migration{},
	}

	se.registry[schemaName] = append(versions, schemaVersion)
	se.currentVersion[schemaName] = version

	return schemaVersion
}

func main() {
	config := map[string]interface{}{"serviceName": "${config.serviceName}"}
	evolution := New${toPascalCase(config.serviceName)}SchemaEvolution(config)

	schema := map[string]interface{}{
		"type":   "record",
		"name":   "User",
		"fields": map[string]interface{}{
			"id":   map[string]string{"type": "string"},
			"name": map[string]string{"type": "string"},
		},
	}

	v1 := evolution.RegisterVersion("User", schema, "1.0.0")
	fmt.Printf("Schema v1: %+v\\n", v1)
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeEvolutionFiles(
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
export async function displayEvolutionConfig(config: EvolutionConfig): Promise<void> {
  console.log(chalk.bold.magenta('\n📊 Schema Evolution: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Schema Type:'), config.schemaType);
  console.log(chalk.cyan('Auto Migration:'), config.enableAutoMigration ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Require Compatibility:'), config.requireCompatibility ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Breaking Change Policy:'), config.breakingChangePolicy);

  console.log(chalk.cyan('\n📋 Compatibility Levels:'));
  console.log(chalk.gray('  • full - Both forward and backward compatible'));
  console.log(chalk.gray('  • forward - Can read old data (new → old works)'));
  console.log(chalk.gray('  • backward - Old consumers can read new data (old → new works)'));
  console.log(chalk.gray('  • none - Breaking change, migration required'));

  console.log(chalk.cyan('\n🔄 Migration Types:'));
  console.log(chalk.gray('  • add_field - Add new field (with default = backward compatible)'));
  console.log(chalk.gray('  • remove_field - Remove field (breaking)'));
  console.log(chalk.gray('  • rename_field - Rename field (breaking)'));
  console.log(chalk.gray('  • change_type - Change field type (usually breaking)'));
  console.log(chalk.gray('  • add_default - Add default value (backward compatible)'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  return `# Schema Evolution Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This schema evolution system provides:
- **Version Tracking**: Track multiple versions of schemas
- **Compatibility Checking**: Automatic detection of breaking changes
- **Migration Generation**: Auto-generate migration scripts
- **Backwards Compatibility**: Ensure smooth upgrades

## Usage

See generated code for usage examples with schema registration and migration.
`;
}
