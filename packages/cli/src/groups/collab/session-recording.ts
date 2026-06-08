import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab session-recording` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerSessionRecording(collab: Command): void {
  collab
  .command('session-recording')
  .description('Generate session recording and replay capabilities for training and debugging')
  .argument('<name>', 'Name of the session recording setup')
  .option('--format <format>', 'Recording format (json, mp4, webm, gif)', 'json')
  .option('--storage <backend>', 'Storage backend (s3, azure-blob, gcs, local)', 's3')
  .option('--compression <level>', 'Compression level (none, low, medium, high)', 'medium')
  .option('--quality <number>', 'Recording quality (1-100)', '90')
  .option('--fps <number>', 'Frames per second', '30')
  .option('--enable-auto-recording', 'Enable automatic recording')
  .option('--enable-privacy-mode', 'Enable privacy mode for sensitive data')
  .option('--enable-search', 'Enable search across sessions')
  .option('--enable-playback', 'Enable playback features')
  .option('--enable-speed-control', 'Enable playback speed control')
  .option('--enable-annotations', 'Enable annotation during replay')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './session-recording')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/session-recording.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      recording: {
        enabled: true,
        format: options.format as ('json' | 'mp4' | 'webm' | 'gif'),
        storage: options.storage as ('s3' | 'azure-blob' | 'gcs' | 'local'),
        compression: options.compression as ('none' | 'low' | 'medium' | 'high'),
        quality: parseInt(options.quality),
        fps: parseInt(options.fps),
      },
      metadata: {
        captureUser: true,
        captureTimestamp: true,
        captureEnvironment: true,
        captureTerminalSize: true,
        addMarkers: true,
      },
      replay: {
        enablePlayback: options.enablePlayback || false,
        enableSpeedControl: options.enableSpeedControl || false,
        enableStepThrough: true,
        enableAnnotations: options.enableAnnotations || false,
        enableExport: true,
      },
      enableAutoRecording: options.enableAutoRecording || false,
      enablePrivacyMode: options.enablePrivacyMode || false,
      enableSearch: options.enableSearch || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating session recording configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: session-recording.tf`));
      console.log(chalk.green(`✅ Generated: session-recording-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: SESSION_RECORDING.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: session-recording-config.json\n`));

      console.log(chalk.green('✓ Session recording configuration generated successfully!'));
    }, 30000);
  }));

// Voice/video integration commands
}
