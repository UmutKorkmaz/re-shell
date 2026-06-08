import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab webrtc-sharing` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerWebrtcSharing(collab: Command): void {
  collab
  .command('webrtc-sharing')
  .description('Generate WebRTC-based code sharing and pair programming with low latency')
  .argument('<name>', 'Name of the WebRTC sharing setup')
  .option('--signaling-url <url>', 'Signaling server URL', 'wss://signaling.example.com')
  .option('--codec <codec>', 'Video codec (vp8, vp9, h264, av1)', 'vp9')
  .option('--max-bitrate <kbps>', 'Maximum bitrate in kbps', '3000')
  .option('--max-participants <number>', 'Maximum participants', '10')
  .option('--enable-screen-sharing', 'Enable screen sharing')
  .option('--enable-file-transfer', 'Enable file transfer')
  .option('--enable-cursor-tracking', 'Enable cursor tracking')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './webrtc-sharing')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/webrtc-sharing.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      webrtc: {
        enabled: true,
        signalingUrl: options.signalingUrl,
        stunServers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        turnServers: [],
        iceTransportPolicy: 'all' as const,
        codec: options.codec as ('vp8' | 'vp9' | 'h264' | 'av1'),
        maxBitrate: parseInt(options.maxBitrate),
      },
      session: {
        name: name + '-session',
        maxParticipants: parseInt(options.maxParticipants),
        recordingEnabled: true,
        chatEnabled: true,
        audioEnabled: true,
        videoEnabled: true,
      },
      accessControl: {
        authentication: true,
        authorization: ['admin', 'developer', 'viewer'],
        encryption: true,
        allowedIPs: [],
      },
      enableScreenSharing: options.enableScreenSharing || false,
      enableFileTransfer: options.enableFileTransfer || false,
      enableCursorTracking: options.enableCursorTracking || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating WebRTC sharing configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: webrtc-sharing.tf`));
      console.log(chalk.green(`✅ Generated: webrtc-sharing-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: WEBRTC_SHARING.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: webrtc-sharing-config.json\n`));

      console.log(chalk.green('✓ WebRTC sharing configuration generated successfully!'));
    }, 30000);
  }));

// Terminal broadcasting commands
}
