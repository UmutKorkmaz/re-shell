// Auto-generated Operational Transform Utility
// Generated at: 2026-01-13T12:55:00.000Z

import chalk from 'chalk';

/**
 * Supported Operational Transform algorithms.
 *
 * - `'ot0'` - Basic OT0 algorithm
 * - `'cactus'` - Cactus algorithm
 * - `'juggee'` - Juggee algorithm
 * - `'google-wave'` - Google Wave algorithm
 */
type OtAlgorithm = 'ot0' | 'cactus' | 'juggee' | 'google-wave';

/**
 * Supported conflict resolution strategies.
 *
 * - `'last-write-wins'` - Most recent change takes precedence
 * - `'operational-transform'` - Transform concurrent operations to merge cleanly
 * - `'crdt'` - Conflict-free Replicated Data Type strategy
 */
type ConflictStrategy = 'last-write-wins' | 'operational-transform' | 'crdt';

/**
 * Supported real-time synchronization protocols.
 *
 * - `'websocket'` - Bidirectional WebSocket connection
 * - `'webrtc'` - Peer-to-peer WebRTC connection
 * - `'http-long-polling'` - HTTP long polling fallback
 */
type SyncProtocol = 'websocket' | 'webrtc' | 'http-long-polling';

/**
 * Configuration options for the Operational Transform engine.
 */
interface TransformConfig {
  /** Whether the Operational Transform engine is enabled. */
  enabled: boolean;
  /** The OT algorithm to use for conflict resolution. */
  algorithm: OtAlgorithm;
  /** The strategy used to resolve conflicting concurrent edits. */
  conflictStrategy: ConflictStrategy;
  /** The real-time sync protocol used between collaborators. */
  syncProtocol: SyncProtocol;
  /** Whether operations should be broadcast to other participants. */
  broadcast: boolean;
  /** Artificial network/processing delay in milliseconds (useful for testing). */
  delay: number;
}

/**
 * Represents the current state of a shared document.
 */
interface DocumentState {
  /** Monotonically increasing version number of the document. */
  version: number;
  /** Hash of the current document content, used for integrity checks. */
  hash: string;
  /** List of participant identifiers currently in the session. */
  participants: string[];
  /** Map of resource keys to the participant ID that currently holds a lock. */
  locks: { [key: string]: string };
}

/**
 * A single edit operation applied to the document.
 */
interface Operation {
  /** The kind of edit operation being performed. */
  type: 'insert' | 'delete' | 'retain';
  /** The zero-based character offset where the operation applies. */
  position: number;
  /** Text content to insert (required when `type` is `'insert'`). */
  content?: string;
  /** Number of characters affected (required for `'delete'` and `'retain'`). */
  length?: number;
  /** Optional attribute overrides applied to the affected range. */
  attributes?: { [key: string]: any };
}

/**
 * Toggles for optional collaboration features.
 */
interface CollaborativeFeatures {
  /** Whether live participant presence indicators are enabled. */
  presence: boolean;
  /** Whether remote cursor positions are shared. */
  cursors: boolean;
  /** Whether text selections are shared between participants. */
  selections: boolean;
  /** Whether inline commenting is enabled. */
  comments: boolean;
  /** Whether suggestion/review mode is enabled. */
  suggestions: boolean;
}

/**
 * Top-level configuration for an Operational Transform setup, including
 * infrastructure providers, runtime settings, and collaboration features.
 */
interface OperationalTransformConfig {
  /** Human-readable name of the project. */
  projectName: string;
  /** Cloud providers targeted by the generated infrastructure code. */
  providers: ('aws' | 'azure' | 'gcp')[];
  /** Core Operational Transform engine configuration. */
  transform: TransformConfig;
  /** Initial state of the shared document. */
  documentState: DocumentState;
  /** Optional collaboration features to enable. */
  features: CollaborativeFeatures;
  /** Whether operation replay/history is enabled. */
  enableReplay: boolean;
  /** Whether automatic conflict detection is enabled. */
  enableConflictDetection: boolean;
  /** Whether automatic merging of conflicts is enabled. */
  enableAutoMerge: boolean;
}

/**
 * Prints a human-readable summary of the Operational Transform configuration
 * to the console, including project metadata, algorithm settings, sync
 * protocol, and enabled collaboration features.
 *
 * @param config - The Operational Transform configuration to display.
 * @returns Nothing; output is written to `console.log`.
 */
export function displayConfig(config: OperationalTransformConfig): void {
  console.log(chalk.cyan('🔄 Operational Transform for Conflict Resolution in Shared Editing'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Algorithm:'), config.transform.algorithm);
  console.log(chalk.yellow('Conflict Strategy:'), config.transform.conflictStrategy);
  console.log(chalk.yellow('Sync Protocol:'), config.transform.syncProtocol);
  console.log(chalk.yellow('Presence:'), config.features.presence ? 'Yes' : 'No');
  console.log(chalk.yellow('Cursors:'), config.features.cursors ? 'Yes' : 'No');
  console.log(chalk.yellow('Selections:'), config.features.selections ? 'Yes' : 'No');
  console.log(chalk.yellow('Comments:'), config.features.comments ? 'Yes' : 'No');
  console.log(chalk.yellow('Suggestions:'), config.features.suggestions ? 'Yes' : 'No');
  console.log(chalk.yellow('Replay:'), config.enableReplay ? 'Yes' : 'No');
  console.log(chalk.yellow('Conflict Detection:'), config.enableConflictDetection ? 'Yes' : 'No');
  console.log(chalk.yellow('Auto Merge:'), config.enableAutoMerge ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown overview document describing the Operational Transform
 * features enabled for the project.
 *
 * @param config - The Operational Transform configuration to document.
 * @returns A Markdown string summarizing the available OT features.
 */
export function generateOperationalTransformMD(config: OperationalTransformConfig): string {
  let md = '# Operational Transform for Conflict Resolution\n\n';
  md += '## Features\n\n';
  md += '- Operational Transform algorithms (OT0, Cactus, Juggee, Google Wave)\n';
  md += '- Conflict resolution strategies (Last-Write-Wins, OT, CRDT)\n';
  md += '- Real-time synchronization (WebSocket, WebRTC, HTTP)\n';
  md += '- Presence awareness and cursor tracking\n';
  md += '- Selection sharing and commenting\n';
  md += '- Suggestion mode and review workflows\n';
  md += '- Operation replay and history\n';
  md += '- Automatic conflict detection\n';
  md += '- Auto-merge with manual override\n';
  md += '- Document versioning and hashing\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header snippet for provisioning the Operational
 * Transform infrastructure for the given project.
 *
 * @param config - The Operational Transform configuration containing project metadata.
 * @returns A Terraform-formatted string with a generated header.
 */
export function generateTerraformOperationalTransform(config: OperationalTransformConfig): string {
  let code = '# Auto-generated Operational Transform Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates TypeScript source code for an `OperationalTransformManager`
 * class scaffolded for the given project.
 *
 * @param config - The Operational Transform configuration containing project metadata.
 * @returns TypeScript source code as a string.
 */
export function generateTypeScriptOperationalTransform(config: OperationalTransformConfig): string {
  let code = '// Auto-generated Operational Transform Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class OperationalTransformManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const operationalTransformManager = new OperationalTransformManager();\n';
  code += 'export default operationalTransformManager;\n';
  return code;
}

/**
 * Generates Python source code for an `OperationalTransformManager`
 * class scaffolded for the given project.
 *
 * @param config - The Operational Transform configuration containing project metadata.
 * @returns Python source code as a string.
 */
export function generatePythonOperationalTransform(config: OperationalTransformConfig): string {
  let code = '# Auto-generated Operational Transform Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class OperationalTransformManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'operational_transform_manager = OperationalTransformManager()\n';
  return code;
}

/**
 * Writes the generated Operational Transform artifacts to disk.
 *
 * Depending on the chosen language, this emits a Terraform file, a
 * language-specific manager module (TypeScript or Python), dependency
 * metadata, a Markdown overview, and a JSON config snapshot.
 *
 * @param config - The Operational Transform configuration to materialize.
 * @param outputDir - Absolute or relative path of the directory to write into.
 * @param language - Target language; either `'typescript'` or `'python'`.
 * @returns A promise that resolves once all files have been written.
 */
export async function writeFiles(config: OperationalTransformConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformOperationalTransform(config);
  await fs.writeFile(path.join(outputDir, 'operational-transform.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptOperationalTransform(config);
    await fs.writeFile(path.join(outputDir, 'operational-transform-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-operational-transform',
      version: '1.0.0',
      description: 'Operational Transform for Conflict Resolution',
      main: 'operational-transform-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonOperationalTransform(config);
    await fs.writeFile(path.join(outputDir, 'operational_transform_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'jsonschema>=4.0.0', 'websockets>=10.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateOperationalTransformMD(config);
  await fs.writeFile(path.join(outputDir, 'OPERATIONAL_TRANSFORM.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    transform: config.transform,
    documentState: config.documentState,
    features: config.features,
    enableReplay: config.enableReplay,
    enableConflictDetection: config.enableConflictDetection,
    enableAutoMerge: config.enableAutoMerge,
  };
  await fs.writeFile(path.join(outputDir, 'operational-transform-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Identity-style helper that returns the provided Operational Transform
 * configuration unchanged. Useful as an entry point or for validating the
 * shape of the config object at runtime.
 *
 * @param config - The Operational Transform configuration to return.
 * @returns The same `OperationalTransformConfig` instance that was passed in.
 */
export function operationalTransform(config: OperationalTransformConfig): OperationalTransformConfig {
  return config;
}
