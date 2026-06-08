import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab terminal-broadcasting` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerTerminalBroadcasting(collab: Command): void {
  collab
  .command('terminal-broadcasting')
  .description('Generate terminal broadcasting with encryption and access control')
  .argument('<name>', 'Name of the terminal broadcasting setup')
  .option('--encryption <type>', 'Encryption type (aes-256-gcm, chacha20-poly1305, none)', 'aes-256-gcm')
  .option('--auth <method>', 'Authentication method (password, certificate, jwt, oauth2)', 'jwt')
  .option('--max-viewers <number>', 'Maximum viewers', '50')
  .option('--latency-target <ms>', 'Target latency in milliseconds', '100')
  .option('--compression <type>', 'Compression type (gzip, zlib, none)', 'gzip')
  .option('--enable-interactive', 'Enable interactive mode')
  .option('--enable-recording', 'Enable session recording')
  .option('--enable-chat', 'Enable chat functionality')
  .option('--enable-voice-overlay', 'Enable voice overlay')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './terminal-broadcasting')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/terminal-broadcasting.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      broadcast: {
        enabled: true,
        maxViewers: parseInt(options.maxViewers),
        recordingEnabled: options.enableRecording || false,
        interactiveMode: options.enableInteractive || false,
        encryption: options.encryption as ('aes-256-gcm' | 'chacha20-poly1305' | 'none'),
        compression: options.compression as ('gzip' | 'zlib' | 'none'),
        latencyTarget: parseInt(options.latencyTarget),
      },
      accessControl: {
        authentication: options.auth as ('password' | 'certificate' | 'jwt' | 'oauth2'),
        authorizedUsers: ['admin', 'developer', 'viewer'],
        allowedIPs: [],
        sessionTimeout: 3600,
      },
      features: {
        colors: true,
        unicode: true,
        cursor: true,
        resize: true,
        copyPaste: true,
      },
      enableChat: options.enableChat || false,
      enableVoiceOverlay: options.enableVoiceOverlay || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating terminal broadcasting configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: terminal-broadcasting.tf`));
      console.log(chalk.green(`✅ Generated: terminal-broadcasting-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: TERMINAL_BROADCASTING.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: terminal-broadcasting-config.json\n`));

      console.log(chalk.green('✓ Terminal broadcasting configuration generated successfully!'));
    }, 30000);
  }));

// Operational transform commands
}
