// Auto-generated Session Recording Utility
// Generated at: 2026-01-13T13:00:00.000Z

import chalk from 'chalk';

/**
 * Supported output formats for a session recording.
 */
type RecordingFormat = 'json' | 'mp4' | 'webm' | 'gif';

/**
 * Identifiers for the storage backends that can persist session recordings.
 */
type StorageBackend = 's3' | 'azure-blob' | 'gcs' | 'local';

/**
 * Compression levels available when storing session recordings.
 */
type CompressionLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Configuration for the recording capture itself.
 */
interface RecordingConfig {
  /** Whether recording capture is enabled. */
  enabled: boolean;
  /** Output container/format used for the recording. */
  format: RecordingFormat;
  /** Backend used to persist the finished recording. */
  storage: StorageBackend;
  /** Compression level applied to the recording. */
  compression: CompressionLevel;
  /** Numeric quality value for the recording (0-100 typical). */
  quality: number;
  /** Frames per second to capture. */
  fps: number;
}

/**
 * Controls which metadata fields are captured alongside a recording.
 */
interface MetadataConfig {
  /** Whether to record the executing user. */
  captureUser: boolean;
  /** Whether to record timestamps for events. */
  captureTimestamp: boolean;
  /** Whether to capture environment variables/state. */
  captureEnvironment: boolean;
  /** Whether to capture the terminal dimensions. */
  captureTerminalSize: boolean;
  /** Whether to allow manual markers during recording. */
  addMarkers: boolean;
}

/**
 * Controls the available replay/playback features for a recording.
 */
interface ReplayConfig {
  /** Whether basic playback is enabled. */
  enablePlayback: boolean;
  /** Whether playback speed can be adjusted. */
  enableSpeedControl: boolean;
  /** Whether step-through (frame-by-frame) playback is enabled. */
  enableStepThrough: boolean;
  /** Whether user annotations can be added during replay. */
  enableAnnotations: boolean;
  /** Whether the recording can be exported to other formats. */
  enableExport: boolean;
}

/**
 * Top-level configuration object describing a session recording setup.
 */
interface SessionRecordingConfig {
  /** Name of the project this recording configuration belongs to. */
  projectName: string;
  /** Cloud providers targeted by the recording pipeline. */
  providers: ('aws' | 'azure' | 'gcp')[];
  /** Recording capture settings. */
  recording: RecordingConfig;
  /** Metadata capture settings. */
  metadata: MetadataConfig;
  /** Replay feature flags. */
  replay: ReplayConfig;
  /** Whether to start recording automatically on session start. */
  enableAutoRecording: boolean;
  /** Whether privacy mode (masking sensitive data) is enabled. */
  enablePrivacyMode: boolean;
  /** Whether full-text search across recordings is enabled. */
  enableSearch: boolean;
}

/**
 * Pretty-prints a session recording configuration to the console using chalk styling.
 *
 * @param config - The session recording configuration to display.
 * @returns Nothing; output is written to stdout.
 */
export function displayConfig(config: SessionRecordingConfig): void {
  console.log(chalk.cyan('🎬 Session Recording and Replay Capabilities'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Format:'), config.recording.format);
  console.log(chalk.yellow('Storage:'), config.recording.storage);
  console.log(chalk.yellow('Compression:'), config.recording.compression);
  console.log(chalk.yellow('Quality:'), config.recording.quality);
  console.log(chalk.yellow('FPS:'), config.recording.fps);
  console.log(chalk.yellow('Auto Recording:'), config.enableAutoRecording ? 'Yes' : 'No');
  console.log(chalk.yellow('Privacy Mode:'), config.enablePrivacyMode ? 'Yes' : 'No');
  console.log(chalk.yellow('Search:'), config.enableSearch ? 'Yes' : 'No');
  console.log(chalk.yellow('Playback:'), config.replay.enablePlayback ? 'Yes' : 'No');
  console.log(chalk.yellow('Speed Control:'), config.replay.enableSpeedControl ? 'Yes' : 'No');
  console.log(chalk.yellow('Annotations:'), config.replay.enableAnnotations ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Builds a Markdown document summarizing the session recording capabilities
 * described by the provided configuration.
 *
 * @param config - The session recording configuration to document.
 * @returns A Markdown string representing the feature overview.
 */
export function generateSessionRecordingMD(config: SessionRecordingConfig): string {
  let md = '# Session Recording and Replay\n\n';
  md += '## Features\n\n';
  md += '- Session recording in multiple formats (JSON, MP4, WebM, GIF)\n';
  md += '- Cloud storage backends (S3, Azure Blob, GCS, local)\n';
  md += '- Configurable quality and FPS\n';
  md += '- Compression for storage optimization\n';
  md += '- Rich metadata capture (user, timestamp, environment)\n';
  md += '- Privacy mode for sensitive data\n';
  md += '- Advanced replay features (speed control, step-through)\n';
  md += '- Annotation and marking during replay\n';
  md += '- Export and sharing capabilities\n';
  md += '- Search across recorded sessions\n';
  md += '- Auto-recording with triggers\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header stub for provisioning session recording resources
 * for the project named in the configuration.
 *
 * @param config - The session recording configuration to provision for.
 * @returns A string containing Terraform code with the project name and timestamp.
 */
export function generateTerraformSessionRecording(config: SessionRecordingConfig): string {
  let code = '# Auto-generated Session Recording Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript `SessionRecordingManager` class stub based on the
 * provided configuration.
 *
 * @param config - The session recording configuration used to template the manager.
 * @returns A string containing TypeScript source code for the manager.
 */
export function generateTypeScriptSessionRecording(config: SessionRecordingConfig): string {
  let code = '// Auto-generated Session Recording Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class SessionRecordingManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const sessionRecordingManager = new SessionRecordingManager();\n';
  code += 'export default sessionRecordingManager;\n';
  return code;
}

/**
 * Generates a Python `SessionRecordingManager` class stub based on the
 * provided configuration.
 *
 * @param config - The session recording configuration used to template the manager.
 * @returns A string containing Python source code for the manager.
 */
export function generatePythonSessionRecording(config: SessionRecordingConfig): string {
  let code = '# Auto-generated Session Recording Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class SessionRecordingManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'session_recording_manager = SessionRecordingManager()\n';
  return code;
}

/**
 * Writes the generated session recording assets (Terraform, source code, docs and
 * configuration) to the specified output directory.
 *
 * @param config - The session recording configuration to materialize.
 * @param outputDir - Absolute or relative path of the directory to write into.
 * @param language - Target language; either `'typescript'` or `'python'`.
 * @returns A promise that resolves once all files have been written.
 */
export async function writeFiles(config: SessionRecordingConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformSessionRecording(config);
  await fs.writeFile(path.join(outputDir, 'session-recording.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptSessionRecording(config);
    await fs.writeFile(path.join(outputDir, 'session-recording-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-session-recording',
      version: '1.0.0',
      description: 'Session Recording and Replay',
      main: 'session-recording-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonSessionRecording(config);
    await fs.writeFile(path.join(outputDir, 'session_recording_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'boto3>=1.26.0', 'opencv-python>=4.5.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateSessionRecordingMD(config);
  await fs.writeFile(path.join(outputDir, 'SESSION_RECORDING.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    recording: config.recording,
    metadata: config.metadata,
    replay: config.replay,
    enableAutoRecording: config.enableAutoRecording,
    enablePrivacyMode: config.enablePrivacyMode,
    enableSearch: config.enableSearch,
  };
  await fs.writeFile(path.join(outputDir, 'session-recording-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided session recording configuration unchanged.
 *
 * Useful as a pass-through/normalization hook for callers that want a single
 * point of indirection when constructing a configuration object.
 *
 * @param config - The session recording configuration to return.
 * @returns The same `SessionRecordingConfig` instance that was provided.
 */
export function sessionRecording(config: SessionRecordingConfig): SessionRecordingConfig {
  return config;
}
