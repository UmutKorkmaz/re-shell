import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab architecture-design` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerArchitectureDesign(collab: Command): void {
  collab
  .command('architecture-design')
  .description('Generate collaborative architecture design and planning tools with version control')
  .argument('<name>', 'Name of the architecture design setup')
  .option('--diagram-type <type>', 'Diagram type (sequence, flowchart, component, deployment, c4, erd)', 'component')
  .option('--format <format>', 'Export format (png, svg, pdf, mermaid, plantuml)', 'svg')
  .option('--version-control <vc>', 'Version control (git, github, gitlab, bitbucket)', 'github')
  .option('--enable-comments', 'Enable commenting')
  .option('--enable-versioning', 'Enable diagram versioning')
  .option('--enable-review', 'Enable review workflows')
  .option('--enable-auto-save', 'Enable auto-save')
  .option('--enable-templates', 'Enable template system')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './architecture-design')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/architecture-design.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      diagram: {
        type: options.diagramType as ('sequence' | 'flowchart' | 'component' | 'deployment' | 'c4' | 'erd'),
        format: options.format as ('png' | 'svg' | 'pdf' | 'mermaid' | 'plantuml'),
        autoLayout: true,
        theme: 'default',
      },
      elements: [
        { id: 'el1', type: 'service' as const, name: 'API Gateway', description: 'Main API entry point', properties: { port: 8080 } },
        { id: 'el2', type: 'service' as const, name: 'Auth Service', description: 'Authentication service', properties: { port: 3000 } },
        { id: 'el3', type: 'database' as const, name: 'Users DB', description: 'User database', properties: { type: 'PostgreSQL' } },
        { id: 'el4', type: 'cache' as const, name: 'Redis Cache', description: 'Caching layer', properties: { ttl: 3600 } },
      ],
      collaboration: {
        enableComments: options.enableComments || false,
        enableVersioning: options.enableVersioning || false,
        enableReview: options.enableReview || false,
        maxCollaborators: 10,
      },
      versionControl: options.versionControl as ('git' | 'github' | 'gitlab' | 'bitbucket'),
      enableAutoSave: options.enableAutoSave || false,
      enableTemplates: options.enableTemplates || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating architecture design configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: architecture-design.tf`));
      console.log(chalk.green(`✅ Generated: architecture-design-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: ARCHITECTURE_DESIGN.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: architecture-design-config.json\n`));

      console.log(chalk.green('✓ Architecture design configuration generated successfully!'));
    }, 30000);
  }));

// Team coding sessions commands
}
