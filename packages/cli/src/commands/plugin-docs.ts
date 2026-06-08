import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { 
  createDocumentationGenerator,
  PluginCommandDocumentationGenerator,
  DocumentationFormat,
  HelpDisplayMode,
  DocumentationGenerationOptions,
  HelpConfiguration,
  estimateReadingTime,
  formatDocumentationSize
} from '../utils/plugin-command-docs';
import { createPluginCommandRegistry } from '../utils/plugin-command-registry';

interface DocsCommandOptions {
  verbose?: boolean;
  json?: boolean;
  format?: DocumentationFormat;
  output?: string;
  template?: string;
  includePrivate?: boolean;
  includeDeprecated?: boolean;
  includeExamples?: boolean;
  generateIndex?: boolean;
  mode?: HelpDisplayMode;
  search?: string;
  plugin?: string;
  category?: string;
  complexity?: string;
}

// Generate documentation for plugin commands
export async function generatePluginDocumentation(
  commands: string[] = [],
  options: DocsCommandOptions = {}
): Promise<void> {
  const { 
    verbose = false, 
    json = false, 
    format = DocumentationFormat.MARKDOWN,
    output,
    template = 'markdown',
    includePrivate = false,
    includeDeprecated = false,
    includeExamples = true,
    generateIndex = true
  } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const documentationGenerator = createDocumentationGenerator();
    const registeredCommands = commandRegistry.getCommands();
    documentationGenerator.registerCommands(registeredCommands);

    const generationOptions: DocumentationGenerationOptions = {
      format,
      template,
      outputDir: output,
      includePrivate,
      includeDeprecated,
      includeExamples,
      generateIndex
    };

    const commandIds = commands.length > 0 
      ? commands.map(cmd => registeredCommands.find(c => c.definition.name === cmd)?.id).filter(id => id !== undefined)
      : [];

    const spinner = createSpinner('Generating documentation...');
    spinner.start();

    const docs = await documentationGenerator.generateDocumentation(commandIds as string[], generationOptions);

    spinner.stop();

    if (json) {
      console.log(JSON.stringify(docs, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Generated documentation for ${docs.length} command(s)`));

    if (verbose) {
      console.log(chalk.yellow('\nDocumentation Details:'));
      console.log(`  Format: ${format}`);
      console.log(`  Template: ${template}`);
      console.log(`  Total size: ${formatDocumentationSize(docs)}`);
      console.log(`  Average reading time: ${Math.round(docs.reduce((sum, doc) => sum + doc.metadata.estimatedReadingTime, 0) / docs.length || 0)} minutes`);
      
      if (output) {
        console.log(`  Output directory: ${output}`);
      }
    }

    // Display sample documentation if no output directory specified
    if (!output && docs.length > 0) {
      console.log(chalk.cyan('\nSample Documentation:'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(docs[0].content.split('\n').slice(0, 20).join('\n'));
      if (docs[0].content.split('\n').length > 20) {
        console.log(chalk.gray('... (truncated)'));
      }
      console.log(chalk.gray('─'.repeat(80)));
      
      if (docs.length > 1) {
        console.log(chalk.blue(`\n💡 Use --output <dir> to save all ${docs.length} documentation files`));
      }
    }

    // Save documentation files if output directory specified
    if (output) {
      await fs.ensureDir(output);
      
      for (const doc of docs) {
        const extension = format === DocumentationFormat.MARKDOWN ? '.md' : 
                         format === DocumentationFormat.HTML ? '.html' :
                         format === DocumentationFormat.JSON ? '.json' : '.txt';
        
        const filename = `${doc.command}${extension}`;
        const filepath = path.join(output, filename);
        
        await fs.writeFile(filepath, doc.content);
      }
      
      console.log(chalk.blue(`\n📁 Documentation saved to: ${output}`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show help for a specific command
export async function showCommandHelp(
  commandName: string,
  options: DocsCommandOptions = {}
): Promise<void> {
  const { 
    verbose = false, 
    json = false,
    mode = HelpDisplayMode.DETAILED
  } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const documentationGenerator = createDocumentationGenerator({ displayMode: mode });
    const registeredCommands = commandRegistry.getCommands();
    documentationGenerator.registerCommands(registeredCommands);

    const command = registeredCommands.find(cmd => 
      cmd.definition.name === commandName || 
      (cmd.definition.aliases && cmd.definition.aliases.includes(commandName))
    );

    if (!command) {
      throw new ValidationError(`Command '${commandName}' not found`);
    }

    const helpText = documentationGenerator.generateHelpText(command.id, { verbosityLevel: verbose ? 'verbose' : 'normal' });

    if (json) {
      const helpData = {
        command: command.definition.name,
        description: command.definition.description,
        arguments: command.definition.arguments,
        options: command.definition.options,
        examples: command.definition.examples,
        aliases: command.definition.aliases,
        plugin: command.pluginName,
        category: command.definition.category,
        deprecated: command.definition.deprecated,
        hidden: command.definition.hidden
      };
      console.log(JSON.stringify(helpData, null, 2));
      return;
    }

    console.log(helpText);

  } catch (error) {
    throw new ValidationError(
      `Failed to show command help: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// List all documented commands
export async function listDocumentedCommands(
  options: DocsCommandOptions = {}
): Promise<void> {
  const { 
    verbose = false, 
    json = false,
    plugin,
    category,
    complexity
  } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const documentationGenerator = createDocumentationGenerator();
    const registeredCommands = commandRegistry.getCommands();
    documentationGenerator.registerCommands(registeredCommands);

    let commands = registeredCommands;

    // Apply filters
    if (plugin) {
      commands = commands.filter(cmd => cmd.pluginName === plugin);
    }

    if (category) {
      commands = commands.filter(cmd => cmd.definition.category === category);
    }

    if (json) {
      const commandData = commands.map(cmd => ({
        name: cmd.definition.name,
        description: cmd.definition.description,
        plugin: cmd.pluginName,
        category: cmd.definition.category,
        complexity: complexity, // Would be calculated
        aliases: cmd.definition.aliases,
        deprecated: cmd.definition.deprecated,
        hidden: cmd.definition.hidden,
        registeredAt: cmd.registeredAt,
        usageCount: cmd.usageCount
      }));
      console.log(JSON.stringify(commandData, null, 2));
      return;
    }

    console.log(chalk.cyan('📖 Available Documented Commands\n'));

    if (commands.length === 0) {
      console.log(chalk.yellow('No commands found matching criteria.'));
      return;
    }

    // Group by plugin
    const commandsByPlugin = commands.reduce((acc, cmd) => {
      if (!acc[cmd.pluginName]) {
        acc[cmd.pluginName] = [];
      }
      acc[cmd.pluginName].push(cmd);
      return acc;
    }, {} as Record<string, typeof commands>);

    Object.entries(commandsByPlugin).forEach(([pluginName, pluginCommands]) => {
      console.log(chalk.yellow(`${pluginName} (${pluginCommands.length} commands):`));
      
      pluginCommands.forEach(cmd => {
        const name = cmd.definition.name;
        const description = cmd.definition.description || 'No description';
        const aliasText = cmd.definition.aliases && cmd.definition.aliases.length > 0 
          ? chalk.gray(` (${cmd.definition.aliases.join(', ')})`) 
          : '';
        const deprecatedText = cmd.definition.deprecated ? chalk.red(' [DEPRECATED]') : '';
        const hiddenText = cmd.definition.hidden ? chalk.gray(' [HIDDEN]') : '';
        
        console.log(`  ${chalk.cyan(name)}${aliasText}${deprecatedText}${hiddenText}`);
        console.log(`    ${chalk.gray(description)}`);
        
        if (verbose) {
          console.log(`    ${chalk.gray('Category:')} ${cmd.definition.category || 'general'}`);
          console.log(`    ${chalk.gray('Usage:')} ${cmd.usageCount}`);
          console.log(`    ${chalk.gray('Registered:')} ${new Date(cmd.registeredAt).toLocaleDateString()}`);
        }
        
        console.log('');
      });
    });

    console.log(chalk.yellow(`Total: ${commands.length} command(s)`));

  } catch (error) {
    throw new ValidationError(
      `Failed to list documented commands: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Search documentation
export async function searchDocumentation(
  query: string,
  options: DocsCommandOptions = {}
): Promise<void> {
  const { 
    verbose = false, 
    json = false,
    plugin,
    category,
    complexity
  } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const documentationGenerator = createDocumentationGenerator();
    const registeredCommands = commandRegistry.getCommands();
    documentationGenerator.registerCommands(registeredCommands);

    const filters = { plugin, category, complexity };
    const results = documentationGenerator.searchDocumentation(query, filters);

    if (json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    console.log(chalk.cyan(`🔍 Search Results for "${query}"\n`));

    if (results.length === 0) {
      console.log(chalk.yellow('No matching documentation found.'));
      
      // Suggest similar commands
      const allCommands = registeredCommands.map(cmd => cmd.definition.name);
      const suggestions = allCommands.filter(name => 
        name.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(name.toLowerCase())
      ).slice(0, 3);
      
      if (suggestions.length > 0) {
        console.log(chalk.blue('\n💡 Did you mean:'));
        suggestions.forEach(suggestion => {
          console.log(`  ${chalk.cyan(suggestion)}`);
        });
      }
      
      return;
    }

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${chalk.cyan(result.command)}`);
      console.log(`   ${chalk.gray(result.description)}`);
      console.log(`   ${chalk.yellow('Plugin:')} ${result.plugin}`);
      console.log(`   ${chalk.yellow('Category:')} ${result.category}`);
      console.log(`   ${chalk.yellow('Complexity:')} ${result.complexity}`);
      
      if (verbose) {
        console.log(`   ${chalk.yellow('Tags:')} ${result.tags.join(', ')}`);
        console.log(`   ${chalk.yellow('Last modified:')} ${new Date(result.lastModified).toLocaleDateString()}`);
      }
      
      console.log('');
    });

    console.log(chalk.yellow(`Found ${results.length} result(s)`));

  } catch (error) {
    throw new ValidationError(
      `Failed to search documentation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show documentation statistics
export async function showDocumentationStats(
  options: DocsCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const documentationGenerator = createDocumentationGenerator();
    const registeredCommands = commandRegistry.getCommands();
    documentationGenerator.registerCommands(registeredCommands);

    const stats = documentationGenerator.getDocumentationStats();

    if (json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('📊 Documentation Statistics\n'));

    // Overview
    console.log(chalk.yellow('Overview:'));
    console.log(`  Total commands: ${stats.totalCommands}`);
    console.log(`  Documented commands: ${stats.documentedCommands}`);
    console.log(`  Coverage: ${Math.round(stats.documentationCoverage * 100)}%`);
    console.log(`  Average word count: ${Math.round(stats.averageWordCount)}`);
    console.log(`  Average reading time: ${Math.round(stats.averageReadingTime)} minutes`);

    // Format distribution
    console.log(chalk.yellow('\nFormat Distribution:'));
    Object.entries(stats.formatDistribution).forEach(([format, count]) => {
      console.log(`  ${format}: ${count}`);
    });

    // Complexity distribution
    console.log(chalk.yellow('\nComplexity Distribution:'));
    Object.entries(stats.complexityDistribution).forEach(([complexity, count]) => {
      const color = complexity === 'basic' ? 'green' : 
                   complexity === 'intermediate' ? 'yellow' : 'red';
      const colorFn = (chalk as any)[color];
      console.log(`  ${colorFn(complexity)}: ${count}`);
    });

    // Plugin distribution
    console.log(chalk.yellow('\nPlugin Distribution:'));
    Object.entries(stats.pluginDistribution).forEach(([plugin, count]) => {
      console.log(`  ${plugin}: ${count}`);
    });

    if (verbose) {
      console.log(chalk.yellow('\nRecommendations:'));
      
      if (stats.documentationCoverage < 0.8) {
        console.log(chalk.red('  • Improve documentation coverage (currently < 80%)'));
      }
      
      if (stats.averageWordCount < 50) {
        console.log(chalk.yellow('  • Consider adding more detailed descriptions'));
      }
      
      if (Object.keys(stats.formatDistribution).length === 1) {
        console.log(chalk.blue('  • Consider generating documentation in multiple formats'));
      }
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show documentation statistics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Configure help system
export async function configureHelpSystem(
  setting: string,
  value: string,
  options: DocsCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    const documentationGenerator = createDocumentationGenerator();
    const currentConfig = documentationGenerator.getHelpConfiguration();

    // Validate setting
    const validSettings = [
      'displayMode', 'maxWidth', 'showExamples', 'showRelatedCommands',
      'enableSearch', 'enableFiltering', 'sortBy', 'groupBy',
      'includeHidden', 'verbosityLevel'
    ];

    if (!validSettings.includes(setting)) {
      throw new ValidationError(`Invalid setting '${setting}'. Valid options: ${validSettings.join(', ')}`);
    }

    // Parse value based on setting type
    let parsedValue: any = value;
    
    if (setting === 'maxWidth') {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue) || parsedValue < 40 || parsedValue > 200) {
        throw new ValidationError('maxWidth must be a number between 40 and 200');
      }
    } else if (['showExamples', 'showRelatedCommands', 'enableSearch', 'enableFiltering', 'includeHidden'].includes(setting)) {
      parsedValue = value.toLowerCase() === 'true';
    } else if (setting === 'displayMode') {
      if (!Object.values(HelpDisplayMode).includes(value as HelpDisplayMode)) {
        throw new ValidationError(`Invalid display mode. Valid options: ${Object.values(HelpDisplayMode).join(', ')}`);
      }
      parsedValue = value as HelpDisplayMode;
    }

    // Update configuration
    const updates: Partial<HelpConfiguration> = { [setting]: parsedValue };
    documentationGenerator.updateHelpConfiguration(updates);

    console.log(chalk.green(`✓ Updated help configuration: ${setting} = ${parsedValue}`));

    if (verbose) {
      console.log(chalk.yellow('\nCurrent Configuration:'));
      const newConfig = documentationGenerator.getHelpConfiguration();
      Object.entries(newConfig).forEach(([key, val]) => {
        const isChanged = key === setting;
        const color = isChanged ? 'cyan' : 'gray';
        const colorFn = (chalk as any)[color];
        console.log(`  ${colorFn(key)}: ${val}`);
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to configure help system: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show available documentation templates
export async function showDocumentationTemplates(
  options: DocsCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const documentationGenerator = createDocumentationGenerator();
    const templates = documentationGenerator.getAvailableTemplates();

    if (json) {
      console.log(JSON.stringify(templates, null, 2));
      return;
    }

    console.log(chalk.cyan('📄 Available Documentation Templates\n'));

    templates.forEach(template => {
      console.log(chalk.yellow(template.name));
      console.log(`  Format: ${template.format}`);
      console.log(`  Sections: ${template.sections.length}`);
      
      if (verbose) {
        console.log(`  Section types: ${template.sections.join(', ')}`);
        
        if (template.styles) {
          console.log(`  Styled: Yes`);
        }
        
        if (template.metadata) {
          console.log(`  Metadata fields: ${Object.keys(template.metadata).length}`);
        }
      }
      
      console.log('');
    });

    console.log(chalk.gray(`Total: ${templates.length} template(s)`));

  } catch (error) {
    throw new ValidationError(
      `Failed to show documentation templates: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}