import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab voice-video-integration` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerVoiceVideoIntegration(collab: Command): void {
  collab
  .command('voice-video-integration')
  .description('Generate voice/video integration for remote collaboration with noise cancellation')
  .argument('<name>', 'Name of the voice/video integration setup')
  .option('--audio-codec <codec>', 'Audio codec (opus, aac, pcmu, pcma)', 'opus')
  .option('--video-codec <codec>', 'Video codec (vp8, vp9, h264, av1)', 'vp9')
  .option('--noise-cancellation <level>', 'Noise cancellation (none, basic, ml-enhanced, ai-powered)', 'ai-powered')
  .option('--echo-cancellation <level>', 'Echo cancellation (none, basic, advanced)', 'advanced')
  .option('--resolution <res>', 'Video resolution', '1280x720')
  .option('--framerate <fps>', 'Video frame rate', '30')
  .option('--max-participants <number>', 'Maximum participants', '50')
  .option('--enable-screen-sharing', 'Enable screen sharing')
  .option('--enable-recording', 'Enable recording')
  .option('--enable-transcription', 'Enable real-time transcription')
  .option('--enable-translation', 'Enable live translation')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './voice-video-integration')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/voice-video-integration.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      audio: {
        enabled: true,
        codec: options.audioCodec as ('opus' | 'aac' | 'pcmu' | 'pcma'),
        bitrate: 128,
        sampleRate: 48000,
        noiseCancellation: options.noiseCancellation as ('none' | 'basic' | 'ml-enhanced' | 'ai-powered'),
        echoCancellation: options.echoCancellation as ('none' | 'basic' | 'advanced'),
        autoGainControl: true,
      },
      video: {
        enabled: true,
        codec: options.videoCodec as ('vp8' | 'vp9' | 'h264' | 'av1'),
        resolution: options.resolution,
        framerate: parseInt(options.framerate),
        bitrate: 2000,
        enableHd: true,
      },
      collaboration: {
        maxParticipants: parseInt(options.maxParticipants),
        screenSharing: options.enableScreenSharing || false,
        recordingEnabled: options.enableRecording || false,
        chatEnabled: true,
        reactionEmoji: true,
      },
      enableTranscription: options.enableTranscription || false,
      enableTranslation: options.enableTranslation || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating voice/video integration configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: voice-video-integration.tf`));
      console.log(chalk.green(`✅ Generated: voice-video-integration-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: VOICE_VIDEO_INTEGRATION.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: voice-video-integration-config.json\n`));

      console.log(chalk.green('✓ Voice/video integration configuration generated successfully!'));
    }, 30000);
  }));

// Collaborative debugging commands
}
