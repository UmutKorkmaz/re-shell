import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { PluginManifest, PluginRegistration } from './plugin-system';
import { 
  PluginCommandDefinition, 
  RegisteredCommand,
  PluginCommandArgument,
  PluginCommandOption,
  PluginCommandContext
} from './plugin-command-registry';

// Documentation formats
export enum DocumentationFormat {
  MARKDOWN = 'markdown',
  HTML = 'html',
  JSON = 'json',
  PLAIN_TEXT = 'plain-text',
  MAN_PAGE = 'man-page',
  PDF = 'pdf'
}

// Documentation sections
export enum DocumentationSection {
  SYNOPSIS = 'synopsis',
  DESCRIPTION = 'description',
  ARGUMENTS = 'arguments',
  OPTIONS = 'options',
  EXAMPLES = 'examples',
  SEE_ALSO = 'see-also',
  AUTHOR = 'author',
  VERSION = 'version',
  ENVIRONMENT = 'environment',
  EXIT_CODES = 'exit-codes'
}

// Help display modes
export enum HelpDisplayMode {
  COMPACT = 'compact',
  DETAILED = 'detailed',
  INTERACTIVE = 'interactive',
  HIERARCHICAL = 'hierarchical',
  SEARCHABLE = 'searchable'
}

// Documentation template
export interface DocumentationTemplate {
  name: string;
  format: DocumentationFormat;
  sections: DocumentationSection[];
  customSections?: Record<string, string>;
  styles?: DocumentationStyles;
  metadata?: Record<string, any>;
}

// Documentation styles
export interface DocumentationStyles {
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
    warning: string;
    error: string;
    success: string;
  };
  typography?: {
    heading1: string;
    heading2: string;
    heading3: string;
    body: string;
    code: string;
    emphasis: string;
  };
  layout?: {
    width: number;
    indent: number;
    lineSpacing: number;
  };
}

// Generated documentation
export interface GeneratedDocumentation {
  command: string;
  format: DocumentationFormat;
  content: string;
  metadata: {
    generatedAt: number;
    version: string;
    template: string;
    wordCount: number;
    estimatedReadingTime: number;
  };
  sections: Record<DocumentationSection, string>;
  examples: CommandExample[];
  relatedCommands: string[];
}

// Command example
export interface CommandExample {
  title: string;
  description: string;
  command: string;
  output?: string;
  explanation?: string;
  complexity: 'basic' | 'intermediate' | 'advanced';
  tags: string[];
}

// Help configuration
export interface HelpConfiguration {
  displayMode: HelpDisplayMode;
  maxWidth: number;
  showExamples: boolean;
  showRelatedCommands: boolean;
  enableSearch: boolean;
  enableFiltering: boolean;
  sortBy: 'alphabetical' | 'category' | 'usage' | 'priority';
  groupBy: 'plugin' | 'category' | 'type' | 'none';
  includeHidden: boolean;
  verbosityLevel: 'minimal' | 'normal' | 'verbose' | 'debug';
}

// Documentation generation options
export interface DocumentationGenerationOptions {
  format: DocumentationFormat;
  template?: string;
  outputDir?: string;
  includePrivate?: boolean;
  includeDeprecated?: boolean;
  includeExamples?: boolean;
  generateIndex?: boolean;
  enableCrossReferences?: boolean;
  validateContent?: boolean;
  minifyOutput?: boolean;
}

// Documentation index entry
export interface DocumentationIndexEntry {
  command: string;
  title: string;
  description: string;
  category: string;
  plugin: string;
  tags: string[];
  complexity: string;
  lastModified: number;
  filePath: string;
  searchTerms: string[];
}

// Plugin command documentation generator
export class PluginCommandDocumentationGenerator extends EventEmitter {
  private commands: Map<string, RegisteredCommand> = new Map();
  private templates: Map<string, DocumentationTemplate> = new Map();
  private generatedDocs: Map<string, GeneratedDocumentation> = new Map();
  private helpConfig: HelpConfiguration;
  private documentationIndex: Map<string, DocumentationIndexEntry> = new Map();

  constructor(helpConfig?: Partial<HelpConfiguration>) {
    super();
    
    this.helpConfig = {
      displayMode: HelpDisplayMode.DETAILED,
      maxWidth: 120,
      showExamples: true,
      showRelatedCommands: true,
      enableSearch: true,
      enableFiltering: true,
      sortBy: 'alphabetical',
      groupBy: 'plugin',
      includeHidden: false,
      verbosityLevel: 'normal',
      ...helpConfig
    };

    this.initializeDefaultTemplates();
  }

  // Initialize default documentation templates
  private initializeDefaultTemplates(): void {
    // Markdown template
    this.templates.set('markdown', {
      name: 'Standard Markdown',
      format: DocumentationFormat.MARKDOWN,
      sections: [
        DocumentationSection.SYNOPSIS,
        DocumentationSection.DESCRIPTION,
        DocumentationSection.ARGUMENTS,
        DocumentationSection.OPTIONS,
        DocumentationSection.EXAMPLES,
        DocumentationSection.SEE_ALSO
      ],
      styles: {
        colors: {
          primary: 'blue',
          secondary: 'gray',
          accent: 'cyan',
          warning: 'yellow',
          error: 'red',
          success: 'green'
        },
        typography: {
          heading1: '# ',
          heading2: '## ',
          heading3: '### ',
          body: '',
          code: '`',
          emphasis: '*'
        },
        layout: {
          width: 80,
          indent: 2,
          lineSpacing: 1
        }
      }
    });

    // Plain text template
    this.templates.set('plain-text', {
      name: 'Plain Text',
      format: DocumentationFormat.PLAIN_TEXT,
      sections: [
        DocumentationSection.SYNOPSIS,
        DocumentationSection.DESCRIPTION,
        DocumentationSection.ARGUMENTS,
        DocumentationSection.OPTIONS,
        DocumentationSection.EXAMPLES
      ],
      styles: {
        layout: {
          width: 80,
          indent: 4,
          lineSpacing: 1
        }
      }
    });

    // Man page template
    this.templates.set('man-page', {
      name: 'Manual Page',
      format: DocumentationFormat.MAN_PAGE,
      sections: [
        DocumentationSection.SYNOPSIS,
        DocumentationSection.DESCRIPTION,
        DocumentationSection.ARGUMENTS,
        DocumentationSection.OPTIONS,
        DocumentationSection.EXAMPLES,
        DocumentationSection.ENVIRONMENT,
        DocumentationSection.EXIT_CODES,
        DocumentationSection.SEE_ALSO,
        DocumentationSection.AUTHOR
      ]
    });
  }

  // Register commands for documentation generation
  registerCommands(commands: RegisteredCommand[]): void {
    this.commands.clear();
    commands.forEach(cmd => {
      this.commands.set(cmd.id, cmd);
      this.updateDocumentationIndex(cmd);
    });
    
    this.emit('commands-registered', { count: commands.length });
  }

  // Update documentation index
  private updateDocumentationIndex(command: RegisteredCommand): void {
    const searchTerms = [
      command.definition.name,
      ...(command.definition.aliases || []),
      command.pluginName,
      command.definition.category || '',
      command.definition.description,
      ...(command.definition.examples || [])
    ].filter(term => term && typeof term === 'string');

    const indexEntry: DocumentationIndexEntry = {
      command: command.definition.name,
      title: command.definition.name,
      description: command.definition.description,
      category: command.definition.category || 'general',
      plugin: command.pluginName,
      tags: [command.pluginName, command.definition.category || 'general'],
      complexity: this.determineComplexity(command.definition),
      lastModified: command.registeredAt,
      filePath: '', // Would be set when documentation is generated
      searchTerms
    };

    this.documentationIndex.set(command.id, indexEntry);
  }

  // Determine command complexity
  private determineComplexity(definition: PluginCommandDefinition): string {
    let complexity = 0;
    
    // Arguments complexity
    if (definition.arguments) {
      complexity += definition.arguments.length;
      complexity += definition.arguments.filter(arg => arg.required).length;
    }
    
    // Options complexity
    if (definition.options) {
      complexity += definition.options.length;
      complexity += definition.options.filter(opt => opt.required).length;
    }
    
    // Subcommands complexity
    if (definition.subcommands) {
      complexity += definition.subcommands.length * 2;
    }
    
    if (complexity <= 3) return 'basic';
    if (complexity <= 8) return 'intermediate';
    return 'advanced';
  }

  // Generate help text for a command
  generateHelpText(commandId: string, options: Partial<HelpConfiguration> = {}): string {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new ValidationError(`Command '${commandId}' not found`);
    }

    const config = { ...this.helpConfig, ...options };
    const definition = command.definition;

    let helpText = '';

    // Command header
    helpText += this.formatCommandHeader(definition, config);

    // Synopsis
    helpText += this.formatSynopsis(definition, config);

    // Description
    if (definition.description) {
      helpText += this.formatSection('DESCRIPTION', definition.description, config);
    }

    // Arguments
    if (definition.arguments && definition.arguments.length > 0) {
      helpText += this.formatArguments(definition.arguments, config);
    }

    // Options
    if (definition.options && definition.options.length > 0) {
      helpText += this.formatOptions(definition.options, config);
    }

    // Examples
    if (config.showExamples && definition.examples && definition.examples.length > 0) {
      helpText += this.formatExamples(definition.examples, config);
    }

    // Related commands
    if (config.showRelatedCommands) {
      const relatedCommands = this.findRelatedCommands(command);
      if (relatedCommands.length > 0) {
        helpText += this.formatRelatedCommands(relatedCommands, config);
      }
    }

    return helpText;
  }

  // Format command header
  private formatCommandHeader(definition: PluginCommandDefinition, config: HelpConfiguration): string {
    let header = '';
    
    header += chalk.cyan.bold(definition.name);
    
    if (definition.aliases && definition.aliases.length > 0) {
      header += chalk.gray(` (${definition.aliases.join(', ')})`);
    }
    
    if (definition.deprecated) {
      header += chalk.red.bold(' [DEPRECATED]');
    }
    
    header += '\n';
    
    if (definition.description) {
      header += chalk.gray(definition.description) + '\n';
    }
    
    return header + '\n';
  }

  // Format synopsis section
  private formatSynopsis(definition: PluginCommandDefinition, config: HelpConfiguration): string {
    let synopsis = this.formatSectionHeader('SYNOPSIS', config);
    
    let usage = definition.name;
    
    // Add arguments
    if (definition.arguments) {
      definition.arguments.forEach(arg => {
        const argStr = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
        usage += ` ${argStr}`;
      });
    }
    
    // Add options indicator
    if (definition.options && definition.options.length > 0) {
      usage += ' [options]';
    }
    
    synopsis += '  ' + usage + '\n\n';
    
    return synopsis;
  }

  // Format arguments section
  private formatArguments(args: PluginCommandArgument[], config: HelpConfiguration): string {
    let section = this.formatSectionHeader('ARGUMENTS', config);
    
    const maxNameLength = Math.max(...args.map(arg => arg.name.length));
    
    args.forEach(arg => {
      const name = arg.name.padEnd(maxNameLength);
      const required = arg.required ? chalk.red('*') : ' ';
      const type = arg.type ? chalk.blue(`[${arg.type}]`) : '';
      const description = arg.description || '';
      
      section += `  ${required} ${chalk.green(name)} ${type} ${description}\n`;
      
      if (arg.choices) {
        section += `    ${chalk.gray('Choices:')} ${arg.choices.join(', ')}\n`;
      }
      
      if (arg.defaultValue !== undefined) {
        section += `    ${chalk.gray('Default:')} ${arg.defaultValue}\n`;
      }
    });
    
    return section + '\n';
  }

  // Format options section
  private formatOptions(options: PluginCommandOption[], config: HelpConfiguration): string {
    let section = this.formatSectionHeader('OPTIONS', config);
    
    const maxFlagLength = Math.max(...options.map(opt => opt.flag.length));
    
    options.forEach(opt => {
      const flag = opt.flag.padEnd(maxFlagLength);
      const required = opt.required ? chalk.red('*') : ' ';
      const type = opt.type ? chalk.blue(`[${opt.type}]`) : '';
      const description = opt.description || '';
      
      section += `  ${required} ${chalk.yellow(flag)} ${type} ${description}\n`;
      
      if (opt.choices) {
        section += `    ${chalk.gray('Choices:')} ${opt.choices.join(', ')}\n`;
      }
      
      if (opt.defaultValue !== undefined) {
        section += `    ${chalk.gray('Default:')} ${opt.defaultValue}\n`;
      }
      
      if (opt.conflicts) {
        section += `    ${chalk.gray('Conflicts with:')} ${opt.conflicts.join(', ')}\n`;
      }
      
      if (opt.implies) {
        section += `    ${chalk.gray('Requires:')} ${opt.implies.join(', ')}\n`;
      }
    });
    
    return section + '\n';
  }

  // Format examples section
  private formatExamples(examples: string[], config: HelpConfiguration): string {
    let section = this.formatSectionHeader('EXAMPLES', config);
    
    examples.forEach((example, index) => {
      section += `  ${index + 1}. ${chalk.cyan(example)}\n`;
    });
    
    return section + '\n';
  }

  // Format related commands section
  private formatRelatedCommands(relatedCommands: RegisteredCommand[], config: HelpConfiguration): string {
    let section = this.formatSectionHeader('SEE ALSO', config);
    
    relatedCommands.forEach(cmd => {
      section += `  ${chalk.cyan(cmd.definition.name)} - ${cmd.definition.description}\n`;
    });
    
    return section + '\n';
  }

  // Format section header
  private formatSectionHeader(title: string, config: HelpConfiguration): string {
    return chalk.bold.underline(title) + '\n';
  }

  // Format generic section
  private formatSection(title: string, content: string, config: HelpConfiguration): string {
    let section = this.formatSectionHeader(title, config);
    section += this.wrapText(content, config.maxWidth - 2, '  ') + '\n\n';
    return section;
  }

  // Wrap text to specified width
  private wrapText(text: string, width: number, indent = ''): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = indent;
    
    words.forEach(word => {
      if (currentLine.length + word.length + 1 > width) {
        lines.push(currentLine);
        currentLine = indent + word;
      } else {
        currentLine += (currentLine === indent ? '' : ' ') + word;
      }
    });
    
    if (currentLine.length > indent.length) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  }

  // Find related commands
  private findRelatedCommands(command: RegisteredCommand): RegisteredCommand[] {
    const related: RegisteredCommand[] = [];
    
    Array.from(this.commands.values()).forEach(cmd => {
      if (cmd.id === command.id) return;
      
      // Same plugin
      if (cmd.pluginName === command.pluginName) {
        related.push(cmd);
        return;
      }
      
      // Same category
      if (cmd.definition.category && cmd.definition.category === command.definition.category) {
        related.push(cmd);
        return;
      }
      
      // Similar name
      if (this.isNameSimilar(cmd.definition.name, command.definition.name)) {
        related.push(cmd);
      }
    });
    
    return related.slice(0, 5); // Limit to 5 related commands
  }

  // Check if command names are similar
  private isNameSimilar(name1: string, name2: string): boolean {
    // Simple similarity check - could be enhanced with more sophisticated algorithms
    const words1 = name1.split('-');
    const words2 = name2.split('-');
    
    return words1.some(word1 => 
      words2.some(word2 => 
        word1.includes(word2) || word2.includes(word1)
      )
    );
  }

  // Generate comprehensive documentation
  async generateDocumentation(
    commandIds: string[] = [],
    options: DocumentationGenerationOptions
  ): Promise<GeneratedDocumentation[]> {
    const commandsToDocument = commandIds.length > 0 
      ? commandIds.map(id => this.commands.get(id)).filter(cmd => cmd !== undefined)
      : Array.from(this.commands.values());

    const template = this.templates.get(options.template || 'markdown');
    if (!template) {
      throw new ValidationError(`Documentation template '${options.template}' not found`);
    }

    const generatedDocs: GeneratedDocumentation[] = [];

    for (const command of commandsToDocument as RegisteredCommand[]) {
      if (!options.includePrivate && command.definition.hidden) continue;
      if (!options.includeDeprecated && command.definition.deprecated) continue;

      const documentation = await this.generateCommandDocumentation(command, template, options);
      generatedDocs.push(documentation);
    }

    if (options.generateIndex) {
      await this.generateDocumentationIndex(generatedDocs, options);
    }

    this.emit('documentation-generated', { 
      count: generatedDocs.length, 
      format: options.format 
    });

    return generatedDocs;
  }

  // Generate documentation for a single command
  private async generateCommandDocumentation(
    command: RegisteredCommand,
    template: DocumentationTemplate,
    options: DocumentationGenerationOptions
  ): Promise<GeneratedDocumentation> {
    const sections: Record<DocumentationSection, string> = {} as any;
    let content = '';

    // Generate each section
    template.sections.forEach(sectionType => {
      const sectionContent = this.generateDocumentationSection(command, sectionType, template);
      sections[sectionType] = sectionContent;
      content += sectionContent + '\n';
    });

    // Generate examples
    const examples = this.generateCommandExamples(command);

    // Find related commands
    const relatedCommands = this.findRelatedCommands(command)
      .map(cmd => cmd.definition.name);

    const documentation: GeneratedDocumentation = {
      command: command.definition.name,
      format: template.format,
      content,
      metadata: {
        generatedAt: Date.now(),
        version: '1.0.0',
        template: template.name,
        wordCount: content.split(/\s+/).length,
        estimatedReadingTime: Math.ceil(content.split(/\s+/).length / 200) // 200 words per minute
      },
      sections,
      examples,
      relatedCommands
    };

    this.generatedDocs.set(command.id, documentation);
    return documentation;
  }

  // Generate documentation section
  private generateDocumentationSection(
    command: RegisteredCommand,
    sectionType: DocumentationSection,
    template: DocumentationTemplate
  ): string {
    const definition = command.definition;

    switch (sectionType) {
      case DocumentationSection.SYNOPSIS:
        return this.generateSynopsisSection(definition, template);
      
      case DocumentationSection.DESCRIPTION:
        return this.generateDescriptionSection(definition, template);
      
      case DocumentationSection.ARGUMENTS:
        return definition.arguments ? this.generateArgumentsSection(definition.arguments, template) : '';
      
      case DocumentationSection.OPTIONS:
        return definition.options ? this.generateOptionsSection(definition.options, template) : '';
      
      case DocumentationSection.EXAMPLES:
        return definition.examples ? this.generateExamplesSection(definition.examples, template) : '';
      
      case DocumentationSection.SEE_ALSO:
        {
        const related = this.findRelatedCommands(command);
        return related.length > 0 ? this.generateSeeAlsoSection(related, template) : '';
      
        }
      case DocumentationSection.AUTHOR:
        return this.generateAuthorSection(command, template);
      
      case DocumentationSection.VERSION:
        return this.generateVersionSection(command, template);
      
      default:
        return '';
    }
  }

  // Generate synopsis section for documentation
  private generateSynopsisSection(definition: PluginCommandDefinition, template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Synopsis\n\n\`${definition.name}\``;
    }
    return `SYNOPSIS\n${definition.name}`;
  }

  // Generate description section for documentation
  private generateDescriptionSection(definition: PluginCommandDefinition, template: DocumentationTemplate): string {
    if (!definition.description) return '';
    
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Description\n\n${definition.description}`;
    }
    return `DESCRIPTION\n${definition.description}`;
  }

  // Generate arguments section for documentation
  private generateArgumentsSection(args: PluginCommandArgument[], template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      let section = '## Arguments\n\n';
      args.forEach(arg => {
        section += `### ${arg.name}\n\n`;
        section += `${arg.description}\n\n`;
        if (arg.required) section += '**Required**\n\n';
        if (arg.type) section += `**Type:** ${arg.type}\n\n`;
        if (arg.choices) section += `**Choices:** ${arg.choices.join(', ')}\n\n`;
        if (arg.defaultValue !== undefined) section += `**Default:** ${arg.defaultValue}\n\n`;
      });
      return section;
    }
    
    let section = 'ARGUMENTS\n';
    args.forEach(arg => {
      section += `  ${arg.name} - ${arg.description}\n`;
    });
    return section;
  }

  // Generate options section for documentation
  private generateOptionsSection(options: PluginCommandOption[], template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      let section = '## Options\n\n';
      options.forEach(opt => {
        section += `### ${opt.flag}\n\n`;
        section += `${opt.description}\n\n`;
        if (opt.required) section += '**Required**\n\n';
        if (opt.type) section += `**Type:** ${opt.type}\n\n`;
        if (opt.choices) section += `**Choices:** ${opt.choices.join(', ')}\n\n`;
        if (opt.defaultValue !== undefined) section += `**Default:** ${opt.defaultValue}\n\n`;
      });
      return section;
    }
    
    let section = 'OPTIONS\n';
    options.forEach(opt => {
      section += `  ${opt.flag} - ${opt.description}\n`;
    });
    return section;
  }

  // Generate examples section for documentation
  private generateExamplesSection(examples: string[], template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      let section = '## Examples\n\n';
      examples.forEach((example, index) => {
        section += `### Example ${index + 1}\n\n`;
        section += `\`\`\`bash\n${example}\n\`\`\`\n\n`;
      });
      return section;
    }
    
    let section = 'EXAMPLES\n';
    examples.forEach((example, index) => {
      section += `  ${index + 1}. ${example}\n`;
    });
    return section;
  }

  // Generate see also section for documentation
  private generateSeeAlsoSection(related: RegisteredCommand[], template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      let section = '## See Also\n\n';
      related.forEach(cmd => {
        section += `- [${cmd.definition.name}](#${cmd.definition.name.toLowerCase()}) - ${cmd.definition.description}\n`;
      });
      return section;
    }
    
    let section = 'SEE ALSO\n';
    related.forEach(cmd => {
      section += `  ${cmd.definition.name} - ${cmd.definition.description}\n`;
    });
    return section;
  }

  // Generate author section for documentation
  private generateAuthorSection(command: RegisteredCommand, template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Author\n\nPlugin: ${command.pluginName}`;
    }
    return `AUTHOR\nPlugin: ${command.pluginName}`;
  }

  // Generate version section for documentation
  private generateVersionSection(command: RegisteredCommand, template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Version\n\nRegistered: ${new Date(command.registeredAt).toLocaleDateString()}`;
    }
    return `VERSION\nRegistered: ${new Date(command.registeredAt).toLocaleDateString()}`;
  }

  // Generate command examples
  private generateCommandExamples(command: RegisteredCommand): CommandExample[] {
    const examples: CommandExample[] = [];
    
    if (command.definition.examples) {
      command.definition.examples.forEach((example, index) => {
        examples.push({
          title: `Example ${index + 1}`,
          description: `Basic usage of ${command.definition.name}`,
          command: example,
          complexity: 'basic',
          tags: [command.pluginName, command.definition.category || 'general']
        });
      });
    }
    
    return examples;
  }

  // Generate documentation index
  private async generateDocumentationIndex(
    docs: GeneratedDocumentation[],
    options: DocumentationGenerationOptions
  ): Promise<void> {
    const indexContent = {
      generated: new Date().toISOString(),
      totalCommands: docs.length,
      commands: docs.map(doc => ({
        name: doc.command,
        format: doc.format,
        sections: Object.keys(doc.sections),
        examples: doc.examples.length,
        relatedCommands: doc.relatedCommands.length,
        wordCount: doc.metadata.wordCount,
        estimatedReadingTime: doc.metadata.estimatedReadingTime
      }))
    };

    if (options.outputDir) {
      const indexPath = path.join(options.outputDir, 'index.json');
      await fs.writeFile(indexPath, JSON.stringify(indexContent, null, 2));
    }
  }

  // Search documentation
  searchDocumentation(query: string, filters: {
    plugin?: string;
    category?: string;
    complexity?: string;
    format?: DocumentationFormat;
  } = {}): DocumentationIndexEntry[] {
    const results: DocumentationIndexEntry[] = [];
    const searchTerms = query.toLowerCase().split(/\s+/);

    this.documentationIndex.forEach(entry => {
      // Apply filters
      if (filters.plugin && entry.plugin !== filters.plugin) return;
      if (filters.category && entry.category !== filters.category) return;
      if (filters.complexity && entry.complexity !== filters.complexity) return;

      // Search in terms
      const matchScore = this.calculateSearchScore(searchTerms, entry.searchTerms);
      if (matchScore > 0) {
        results.push(entry);
      }
    });

    return results.sort((a, b) => 
      this.calculateSearchScore(searchTerms, b.searchTerms) - 
      this.calculateSearchScore(searchTerms, a.searchTerms)
    );
  }

  // Calculate search score
  private calculateSearchScore(queryTerms: string[], searchTerms: string[]): number {
    let score = 0;
    const lowerSearchTerms = searchTerms.map(term => term.toLowerCase());

    queryTerms.forEach(queryTerm => {
      lowerSearchTerms.forEach(searchTerm => {
        if (searchTerm.includes(queryTerm)) {
          score += searchTerm === queryTerm ? 10 : 5; // Exact match vs partial match
        }
      });
    });

    return score;
  }

  // Get documentation statistics
  getDocumentationStats(): any {
    const commands = Array.from(this.commands.values());
    const docs = Array.from(this.generatedDocs.values());

    return {
      totalCommands: commands.length,
      documentedCommands: docs.length,
      documentationCoverage: commands.length > 0 ? docs.length / commands.length : 0,
      averageWordCount: docs.length > 0 ? docs.reduce((sum, doc) => sum + doc.metadata.wordCount, 0) / docs.length : 0,
      averageReadingTime: docs.length > 0 ? docs.reduce((sum, doc) => sum + doc.metadata.estimatedReadingTime, 0) / docs.length : 0,
      formatDistribution: docs.reduce((acc, doc) => {
        acc[doc.format] = (acc[doc.format] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      complexityDistribution: Array.from(this.documentationIndex.values()).reduce((acc, entry) => {
        acc[entry.complexity] = (acc[entry.complexity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      pluginDistribution: Array.from(this.documentationIndex.values()).reduce((acc, entry) => {
        acc[entry.plugin] = (acc[entry.plugin] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  // Get help configuration
  getHelpConfiguration(): HelpConfiguration {
    return { ...this.helpConfig };
  }

  // Update help configuration
  updateHelpConfiguration(updates: Partial<HelpConfiguration>): void {
    this.helpConfig = { ...this.helpConfig, ...updates };
    this.emit('help-configuration-updated', this.helpConfig);
  }

  // Add custom documentation template
  addDocumentationTemplate(name: string, template: DocumentationTemplate): void {
    this.templates.set(name, template);
    this.emit('template-added', { name, template });
  }

  // Remove documentation template
  removeDocumentationTemplate(name: string): boolean {
    const deleted = this.templates.delete(name);
    if (deleted) {
      this.emit('template-removed', { name });
    }
    return deleted;
  }

  // Get available templates
  getAvailableTemplates(): DocumentationTemplate[] {
    return Array.from(this.templates.values());
  }

  // Clear generated documentation
  clearGeneratedDocumentation(): void {
    this.generatedDocs.clear();
    this.documentationIndex.clear();
    this.emit('documentation-cleared');
  }
}

// Utility functions
export function createDocumentationGenerator(
  helpConfig?: Partial<HelpConfiguration>
): PluginCommandDocumentationGenerator {
  return new PluginCommandDocumentationGenerator(helpConfig);
}

export function estimateReadingTime(text: string, wordsPerMinute = 200): number {
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

export function formatDocumentationSize(docs: GeneratedDocumentation[]): string {
  const totalSize = docs.reduce((sum, doc) => sum + doc.content.length, 0);
  
  if (totalSize < 1024) return `${totalSize} bytes`;
  if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
  return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateDocumentationTemplate(template: DocumentationTemplate): string[] {
  const errors: string[] = [];
  
  if (!template.name) {
    errors.push('Template name is required');
  }
  
  if (!template.format) {
    errors.push('Template format is required');
  }
  
  if (!template.sections || template.sections.length === 0) {
    errors.push('Template must include at least one section');
  }
  
  return errors;
}