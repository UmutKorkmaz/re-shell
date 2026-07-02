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
} from './plugin-command-registry';

/**
 * Supported output formats for generated plugin command documentation.
 */
export enum DocumentationFormat {
  MARKDOWN = 'markdown',
  HTML = 'html',
  JSON = 'json',
  PLAIN_TEXT = 'plain-text',
  MAN_PAGE = 'man-page',
  PDF = 'pdf'
}

/**
 * Logical sections that can be included in generated documentation.
 */
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

/**
 * Modes controlling how command help is displayed to the user.
 */
export enum HelpDisplayMode {
  COMPACT = 'compact',
  DETAILED = 'detailed',
  INTERACTIVE = 'interactive',
  HIERARCHICAL = 'hierarchical',
  SEARCHABLE = 'searchable'
}

/**
 * Defines a template used to generate plugin command documentation.
 */
export interface DocumentationTemplate {
  /** Human-readable template name. */
  name: string;
  /** Output format produced by this template. */
  format: DocumentationFormat;
  /** Ordered list of sections to include in the generated documentation. */
  sections: DocumentationSection[];
  /** Optional map of custom section names to their content. */
  customSections?: Record<string, string>;
  /** Optional styling configuration for the generated output. */
  styles?: DocumentationStyles;
  /** Optional arbitrary metadata attached to the template. */
  metadata?: Record<string, unknown>;
}

/**
 * Styling configuration for generated documentation output.
 */
export interface DocumentationStyles {
  /** Optional color palette used for colorized output formats. */
  colors?: {
    /** Primary color used for headings and emphasis. */
    primary: string;
    /** Secondary color used for supporting text. */
    secondary: string;
    /** Accent color for highlights. */
    accent: string;
    /** Color used for warning indicators. */
    warning: string;
    /** Color used for error indicators. */
    error: string;
    /** Color used for success indicators. */
    success: string;
  };
  /** Optional typography markers for different text levels. */
  typography?: {
    /** Prefix/marker for level-1 headings. */
    heading1: string;
    /** Prefix/marker for level-2 headings. */
    heading2: string;
    /** Prefix/marker for level-3 headings. */
    heading3: string;
    /** Marker for body text. */
    body: string;
    /** Delimiter for inline code. */
    code: string;
    /** Delimiter for emphasized text. */
    emphasis: string;
  };
  /** Optional layout dimensions for the rendered output. */
  layout?: {
    /** Maximum line width in characters. */
    width: number;
    /** Indentation size in characters. */
    indent: number;
    /** Number of blank lines between blocks. */
    lineSpacing: number;
  };
}

/**
 * Represents the full result of generating documentation for a command.
 */
export interface GeneratedDocumentation {
  /** Name of the documented command. */
  command: string;
  /** Format used to generate the documentation. */
  format: DocumentationFormat;
  /** Full rendered documentation content as a single string. */
  content: string;
  /** Metadata about the generated documentation. */
  metadata: {
    /** Timestamp at which the documentation was generated. */
    generatedAt: number;
    /** Version of the documentation generator output. */
    version: string;
    /** Name of the template used. */
    template: string;
    /** Total word count of the generated content. */
    wordCount: number;
    /** Estimated reading time in minutes. */
    estimatedReadingTime: number;
  };
  /** Mapping of section type to its rendered content. */
  sections: Record<DocumentationSection, string>;
  /** Examples included with the command. */
  examples: CommandExample[];
  /** Names of related commands. */
  relatedCommands: string[];
}

/**
 * Represents a single usage example for a command.
 */
export interface CommandExample {
  /** Short title describing the example. */
  title: string;
  /** Human-readable description of what the example demonstrates. */
  description: string;
  /** The example command invocation. */
  command: string;
  /** Optional expected output of the command. */
  output?: string;
  /** Optional explanation of how the command works. */
  explanation?: string;
  /** Difficulty level of the example. */
  complexity: 'basic' | 'intermediate' | 'advanced';
  /** Tags used to categorize the example. */
  tags: string[];
}

/**
 * Configuration controlling how command help is displayed and organized.
 */
export interface HelpConfiguration {
  /** How the help output should be presented. */
  displayMode: HelpDisplayMode;
  /** Maximum line width of the help output. */
  maxWidth: number;
  /** Whether to include examples in help output. */
  showExamples: boolean;
  /** Whether to include related commands in help output. */
  showRelatedCommands: boolean;
  /** Whether search functionality is enabled. */
  enableSearch: boolean;
  /** Whether filtering of commands is enabled. */
  enableFiltering: boolean;
  /** Strategy used to sort commands in help output. */
  sortBy: 'alphabetical' | 'category' | 'usage' | 'priority';
  /** Strategy used to group commands in help output. */
  groupBy: 'plugin' | 'category' | 'type' | 'none';
  /** Whether hidden commands should be included. */
  includeHidden: boolean;
  /** Verbosity level of the help output. */
  verbosityLevel: 'minimal' | 'normal' | 'verbose' | 'debug';
}

/**
 * Options passed when generating documentation for one or more commands.
 */
export interface DocumentationGenerationOptions {
  /** Desired output format for the generated documentation. */
  format: DocumentationFormat;
  /** Name of the template to use, if not the default. */
  template?: string;
  /** Directory where generated documentation files should be written. */
  outputDir?: string;
  /** Whether to include private (hidden) commands. */
  includePrivate?: boolean;
  /** Whether to include deprecated commands. */
  includeDeprecated?: boolean;
  /** Whether to include usage examples. */
  includeExamples?: boolean;
  /** Whether to generate an index file alongside the documentation. */
  generateIndex?: boolean;
  /** Whether to enable cross-references between commands. */
  enableCrossReferences?: boolean;
  /** Whether to validate generated content. */
  validateContent?: boolean;
  /** Whether to minify the generated output. */
  minifyOutput?: boolean;
}

/**
 * A single entry in the searchable documentation index.
 */
export interface DocumentationIndexEntry {
  /** Name of the command. */
  command: string;
  /** Display title of the command. */
  title: string;
  /** Short description of the command. */
  description: string;
  /** Category the command belongs to. */
  category: string;
  /** Name of the plugin providing the command. */
  plugin: string;
  /** Tags associated with the command. */
  tags: string[];
  /** Complexity level of the command. */
  complexity: string;
  /** Timestamp of the command's last modification. */
  lastModified: number;
  /** Path to the generated documentation file, if any. */
  filePath: string;
  /** Terms used when searching the index. */
  searchTerms: string[];
}

/**
 * Generates, formats, and manages documentation for plugin commands.
 * Emits events when commands are registered, documentation is generated,
 * templates change, and configuration is updated.
 */
export class PluginCommandDocumentationGenerator extends EventEmitter {
  private commands: Map<string, RegisteredCommand> = new Map();
  private templates: Map<string, DocumentationTemplate> = new Map();
  private generatedDocs: Map<string, GeneratedDocumentation> = new Map();
  private helpConfig: HelpConfiguration;
  private documentationIndex: Map<string, DocumentationIndexEntry> = new Map();

  /**
   * Creates a new documentation generator.
   *
   * @param helpConfig - Optional partial help configuration overrides.
   */
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

  /**
   * Populates the template map with the built-in default templates
   * (markdown, plain-text, and man-page).
   */
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

  /**
   * Registers a set of commands to be available for documentation generation.
   * Clears any previously registered commands and updates the documentation index.
   *
   * @param commands - The commands to register.
   */
  registerCommands(commands: RegisteredCommand[]): void {
    this.commands.clear();
    commands.forEach(cmd => {
      this.commands.set(cmd.id, cmd);
      this.updateDocumentationIndex(cmd);
    });
    
    this.emit('commands-registered', { count: commands.length });
  }

  /**
   * Creates or refreshes the documentation index entry for a command.
   *
   * @param command - The command whose index entry should be updated.
   */
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

  /**
   * Computes a complexity label based on the number of arguments, options,
   * and subcommands defined on a command.
   *
   * @param definition - The command definition to evaluate.
   * @returns One of `basic`, `intermediate`, or `advanced`.
   */
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

  /**
   * Generates formatted help text for a single registered command.
   *
   * @param commandId - The unique identifier of the command.
   * @param options - Optional partial help configuration overrides.
   * @returns The rendered help text.
   * @throws {ValidationError} When the command id is not registered.
   */
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

  /**
   * Formats the header (name, aliases, deprecation, description) of a command.
   *
   * @param definition - The command definition.
   * @param config - The active help configuration.
   * @returns The formatted header text.
   */
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

  /**
   * Formats the synopsis (usage line) section of a command.
   *
   * @param definition - The command definition.
   * @param config - The active help configuration.
   * @returns The formatted synopsis text.
   */
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

  /**
   * Formats the arguments section listing each command argument.
   *
   * @param args - The command arguments.
   * @param config - The active help configuration.
   * @returns The formatted arguments text.
   */
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

  /**
   * Formats the options section listing each command option.
   *
   * @param options - The command options.
   * @param config - The active help configuration.
   * @returns The formatted options text.
   */
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

  /**
   * Formats the examples section listing enumerated usage examples.
   *
   * @param examples - The example command strings.
   * @param config - The active help configuration.
   * @returns The formatted examples text.
   */
  private formatExamples(examples: string[], config: HelpConfiguration): string {
    let section = this.formatSectionHeader('EXAMPLES', config);
    
    examples.forEach((example, index) => {
      section += `  ${index + 1}. ${chalk.cyan(example)}\n`;
    });
    
    return section + '\n';
  }

  /**
   * Formats the "SEE ALSO" section listing related commands.
   *
   * @param relatedCommands - The related commands to display.
   * @param config - The active help configuration.
   * @returns The formatted related-commands text.
   */
  private formatRelatedCommands(relatedCommands: RegisteredCommand[], config: HelpConfiguration): string {
    let section = this.formatSectionHeader('SEE ALSO', config);
    
    relatedCommands.forEach(cmd => {
      section += `  ${chalk.cyan(cmd.definition.name)} - ${cmd.definition.description}\n`;
    });
    
    return section + '\n';
  }

  /**
   * Formats a bold, underlined section header.
   *
   * @param title - The section title.
   * @param config - The active help configuration.
   * @returns The formatted section header.
   */
  private formatSectionHeader(title: string, config: HelpConfiguration): string {
    return chalk.bold.underline(title) + '\n';
  }

  /**
   * Formats a generic titled section with wrapped content.
   *
   * @param title - The section title.
   * @param content - The section body text.
   * @param config - The active help configuration.
   * @returns The formatted section text.
   */
  private formatSection(title: string, content: string, config: HelpConfiguration): string {
    let section = this.formatSectionHeader(title, config);
    section += this.wrapText(content, config.maxWidth - 2, '  ') + '\n\n';
    return section;
  }

  /**
   * Word-wraps the given text to the specified width with optional indentation.
   *
   * @param text - The text to wrap.
   * @param width - Maximum line width.
   * @param indent - Optional indentation prefix prepended to each line.
   * @returns The wrapped text.
   */
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

  /**
   * Finds commands related to the given command, based on shared plugin,
   * shared category, or name similarity. Limited to at most 5 results.
   *
   * @param command - The reference command.
   * @returns Related commands.
   */
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

  /**
   * Determines whether two dash-separated command names are similar
   * based on substring matches between their constituent words.
   *
   * @param name1 - First command name.
   * @param name2 - Second command name.
   * @returns True when the names are considered similar.
   */
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

  /**
   * Generates documentation for the specified commands (or all registered commands).
   *
   * @param commandIds - Optional list of command ids to document; defaults to all registered commands.
   * @param options - Options controlling the documentation generation.
   * @returns An array of generated documentation objects.
   * @throws {ValidationError} When the requested template is not found.
   */
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

  /**
   * Generates documentation for a single command using the supplied template.
   *
   * @param command - The command to document.
   * @param template - The documentation template to apply.
   * @param options - Options controlling the documentation generation.
   * @returns The generated documentation object.
   */
  private async generateCommandDocumentation(
    command: RegisteredCommand,
    template: DocumentationTemplate,
    options: DocumentationGenerationOptions
  ): Promise<GeneratedDocumentation> {
    const sections = {} as Record<DocumentationSection, string>;
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

  /**
   * Generates the content for a single documentation section type.
   *
   * @param command - The command being documented.
   * @param sectionType - The section to generate.
   * @param template - The active documentation template.
   * @returns The rendered section content.
   */
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

  /**
   * Generates the synopsis section according to the template format.
   *
   * @param definition - The command definition.
   * @param template - The active documentation template.
   * @returns The rendered synopsis section.
   */
  private generateSynopsisSection(definition: PluginCommandDefinition, template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Synopsis\n\n\`${definition.name}\``;
    }
    return `SYNOPSIS\n${definition.name}`;
  }

  /**
   * Generates the description section according to the template format.
   *
   * @param definition - The command definition.
   * @param template - The active documentation template.
   * @returns The rendered description section.
   */
  private generateDescriptionSection(definition: PluginCommandDefinition, template: DocumentationTemplate): string {
    if (!definition.description) return '';
    
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Description\n\n${definition.description}`;
    }
    return `DESCRIPTION\n${definition.description}`;
  }

  /**
   * Generates the arguments section according to the template format.
   *
   * @param args - The command arguments.
   * @param template - The active documentation template.
   * @returns The rendered arguments section.
   */
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

  /**
   * Generates the options section according to the template format.
   *
   * @param options - The command options.
   * @param template - The active documentation template.
   * @returns The rendered options section.
   */
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

  /**
   * Generates the examples section according to the template format.
   *
   * @param examples - The example command strings.
   * @param template - The active documentation template.
   * @returns The rendered examples section.
   */
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

  /**
   * Generates the "see also" section listing related commands.
   *
   * @param related - Related commands.
   * @param template - The active documentation template.
   * @returns The rendered see-also section.
   */
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

  /**
   * Generates the author section naming the contributing plugin.
   *
   * @param command - The command being documented.
   * @param template - The active documentation template.
   * @returns The rendered author section.
   */
  private generateAuthorSection(command: RegisteredCommand, template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Author\n\nPlugin: ${command.pluginName}`;
    }
    return `AUTHOR\nPlugin: ${command.pluginName}`;
  }

  /**
   * Generates the version section showing when the command was registered.
   *
   * @param command - The command being documented.
   * @param template - The active documentation template.
   * @returns The rendered version section.
   */
  private generateVersionSection(command: RegisteredCommand, template: DocumentationTemplate): string {
    if (template.format === DocumentationFormat.MARKDOWN) {
      return `## Version\n\nRegistered: ${new Date(command.registeredAt).toLocaleDateString()}`;
    }
    return `VERSION\nRegistered: ${new Date(command.registeredAt).toLocaleDateString()}`;
  }

  /**
   * Builds structured {@link CommandExample} objects from a command's
   * raw example strings.
   *
   * @param command - The command whose examples should be generated.
   * @returns The generated command examples.
   */
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

  /**
   * Generates and optionally writes an index file summarizing the
   * generated documentation.
   *
   * @param docs - The generated documentation entries to index.
   * @param options - Options controlling generation; index is written when `outputDir` is set.
   * @returns Resolves once the index has been generated.
   */
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

  /**
   * Searches the documentation index for entries matching the query, with
   * optional filters. Results are ranked by relevance score.
   *
   * @param query - The free-text search query.
   * @param filters - Optional filters by plugin, category, complexity, or format.
   * @returns Matching index entries sorted by relevance.
   */
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

  /**
   * Calculates a relevance score for a set of search terms against the
   * indexed search terms. Exact matches score higher than partial matches.
   *
   * @param queryTerms - Lowercase query terms to match.
   * @param searchTerms - Indexed search terms for a command.
   * @returns The numeric relevance score.
   */
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

  /**
   * Returns summary statistics about registered commands and generated documentation.
   *
   * @returns An object describing coverage, word counts, reading time, and distributions.
   */
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

  /**
   * Returns a copy of the current help configuration.
   *
   * @returns The active help configuration.
   */
  getHelpConfiguration(): HelpConfiguration {
    return { ...this.helpConfig };
  }

  /**
   * Updates the help configuration by merging the given partial updates.
   *
   * @param updates - Partial configuration values to apply.
   */
  updateHelpConfiguration(updates: Partial<HelpConfiguration>): void {
    this.helpConfig = { ...this.helpConfig, ...updates };
    this.emit('help-configuration-updated', this.helpConfig);
  }

  /**
   * Registers a custom documentation template.
   *
   * @param name - The key under which to store the template.
   * @param template - The template definition.
   */
  addDocumentationTemplate(name: string, template: DocumentationTemplate): void {
    this.templates.set(name, template);
    this.emit('template-added', { name, template });
  }

  /**
   * Removes a documentation template by name.
   *
   * @param name - The name of the template to remove.
   * @returns True if a template was removed.
   */
  removeDocumentationTemplate(name: string): boolean {
    const deleted = this.templates.delete(name);
    if (deleted) {
      this.emit('template-removed', { name });
    }
    return deleted;
  }

  /**
   * Returns all currently registered documentation templates.
   *
   * @returns Array of documentation templates.
   */
  getAvailableTemplates(): DocumentationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Clears all generated documentation and the documentation index.
   */
  clearGeneratedDocumentation(): void {
    this.generatedDocs.clear();
    this.documentationIndex.clear();
    this.emit('documentation-cleared');
  }
}

/**
 * Creates a new {@link PluginCommandDocumentationGenerator} instance.
 *
 * @param helpConfig - Optional partial help configuration overrides.
 * @returns A new documentation generator.
 */
export function createDocumentationGenerator(
  helpConfig?: Partial<HelpConfiguration>
): PluginCommandDocumentationGenerator {
  return new PluginCommandDocumentationGenerator(helpConfig);
}

/**
 * Estimates the reading time for a body of text.
 *
 * @param text - The text to read.
 * @param wordsPerMinute - Average reading speed in words per minute (default 200).
 * @returns Estimated reading time in minutes, rounded up.
 */
export function estimateReadingTime(text: string, wordsPerMinute = 200): number {
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Computes and formats a human-readable total size for a set of
 * generated documentation entries.
 *
 * @param docs - The generated documentation entries.
 * @returns A human-readable size string (bytes, KB, or MB).
 */
export function formatDocumentationSize(docs: GeneratedDocumentation[]): string {
  const totalSize = docs.reduce((sum, doc) => sum + doc.content.length, 0);
  
  if (totalSize < 1024) return `${totalSize} bytes`;
  if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
  return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates a documentation template and returns a list of validation errors.
 *
 * @param template - The template to validate.
 * @returns An array of error messages; empty when the template is valid.
 */
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