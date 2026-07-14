// Auto-generated Knowledge Sharing Utility
// Generated at: 2026-01-13T13:40:00.000Z

import chalk from 'chalk';

/**
 * Supported documentation categories for knowledge-sharing documents.
 */
type DocType = 'guide' | 'tutorial' | 'api-reference' | 'faq' | 'runbook' | 'architecture-decision-record';

/**
 * Available full-text search provider identifiers.
 */
type SearchProvider = 'elasticsearch' | 'algolia' | 'lunrjs' | 'meilisearch' | 'typesense';

/**
 * Supported source content formats for documents.
 */
type ContentType = 'markdown' | 'asciidoc' | 'restructuredtext' | 'html' | 'wiki';

/**
 * Configuration options for the document search subsystem.
 */
interface SearchConfig {
  /** Search backend provider to use for indexing and querying. */
  provider: SearchProvider;
  /** Whether automatic indexing of documents is enabled. */
  indexing: boolean;
  /** Whether fuzzy (typo-tolerant) search is enabled. */
  fuzzySearch: boolean;
  /** Whether query result highlighting is enabled. */
  highlighting: boolean;
}

/**
 * Represents a single knowledge-sharing document entry.
 */
interface Document {
  /** Unique identifier for the document. */
  id: string;
  /** Human-readable document title. */
  title: string;
  /** Category of the document. */
  type: DocType;
  /** Raw text content of the document body. */
  content: string;
  /** Tags used for categorization and discovery. */
  tags: string[];
  /** Name of the original author of the document. */
  author: string;
  /** List of users who have contributed to the document. */
  contributors: string[];
  /** Creation timestamp in milliseconds since epoch. */
  createdAt: number;
  /** Last update timestamp in milliseconds since epoch. */
  updatedAt: number;
  /** Number of times the document has been viewed. */
  views: number;
  /** Average user rating for the document. */
  rating: number;
}

/**
 * Represents a comment attached to a document for discussion.
 */
interface Comment {
  /** Unique identifier for the comment. */
  id: string;
  /** Identifier of the document the comment belongs to. */
  documentId: string;
  /** Identifier of the user who authored the comment. */
  userId: string;
  /** Display name of the commenting user. */
  userName: string;
  /** Text body of the comment. */
  content: string;
  /** Timestamp the comment was created, in milliseconds since epoch. */
  timestamp: number;
  /** Whether the comment has been marked as resolved. */
  resolved: boolean;
}

/**
 * Configuration options controlling collaboration features.
 */
interface CollaborationConfig {
  /** Whether real-time collaborative editing is enabled. */
  enableRealTimeEditing: boolean;
  /** Whether commenting on documents is enabled. */
  enableComments: boolean;
  /** Whether suggestion/proposal workflows are enabled. */
  enableSuggestions: boolean;
  /** Whether version history tracking is enabled. */
  enableVersionHistory: boolean;
  /** Maximum number of contributors allowed per document. */
  maxContributors: number;
}

/**
 * Top-level configuration object for the knowledge-sharing module.
 */
interface KnowledgeSharingConfig {
  /** Name of the project this configuration belongs to. */
  projectName: string;
  /** Cloud providers targeted by the generated infrastructure. */
  providers: ('aws' | 'azure' | 'gcp')[];
  /** Documents managed by the knowledge-sharing system. */
  documents: Document[];
  /** Comments associated with documents. */
  comments: Comment[];
  /** Search subsystem configuration. */
  search: SearchConfig;
  /** Collaboration feature configuration. */
  collaboration: CollaborationConfig;
  /** Whether analytics and insights collection is enabled. */
  enableAnalytics: boolean;
  /** Whether update notifications are enabled. */
  enableNotifications: boolean;
}

/**
 * Prints a formatted summary of the knowledge-sharing configuration to the console.
 *
 * @param config - The knowledge-sharing configuration to display.
 * @returns No return value; output is written to stdout.
 */
export function displayConfig(config: KnowledgeSharingConfig): void {
  console.log(chalk.cyan('📚 Team Knowledge Sharing and Documentation Collaboration'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Documents:'), config.documents.length);
  console.log(chalk.yellow('Comments:'), config.comments.length);
  console.log(chalk.yellow('Search Provider:'), config.search.provider);
  console.log(chalk.yellow('Indexing:'), config.search.indexing ? 'Yes' : 'No');
  console.log(chalk.yellow('Fuzzy Search:'), config.search.fuzzySearch ? 'Yes' : 'No');
  console.log(chalk.yellow('Real-time Editing:'), config.collaboration.enableRealTimeEditing ? 'Yes' : 'No');
  console.log(chalk.yellow('Comments:'), config.collaboration.enableComments ? 'Yes' : 'No');
  console.log(chalk.yellow('Version History:'), config.collaboration.enableVersionHistory ? 'Yes' : 'No');
  console.log(chalk.yellow('Max Contributors:'), config.collaboration.maxContributors);
  console.log(chalk.yellow('Analytics:'), config.enableAnalytics ? 'Yes' : 'No');
  console.log(chalk.yellow('Notifications:'), config.enableNotifications ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown overview describing the knowledge-sharing feature set.
 *
 * @param config - The knowledge-sharing configuration used to drive generation.
 * @returns A Markdown string summarizing the available features.
 */
export function generateKnowledgeSharingMD(config: KnowledgeSharingConfig): string {
  let md = '# Team Knowledge Sharing and Documentation Collaboration\n\n';
  md += '## Features\n\n';
  md += '- Document types: guides, tutorials, API references, FAQs, runbooks, ADRs\n';
  md += '- Search providers: Elasticsearch, Algolia, Lunr.js, Meilisearch, Typesense\n';
  md += '- Full-text search with fuzzy matching\n';
  md += '- Real-time collaborative editing\n';
  md += '- Comment system for discussions\n';
  md += '- Suggestions and proposals\n';
  md += '- Version history and rollback\n';
  md += '- Document tagging and categorization\n';
  md += '- Author and contributor tracking\n';
  md += '- View count and ratings\n';
  md += '- Analytics and insights\n';
  md += '- Notifications for updates\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header stub for provisioning knowledge-sharing infrastructure.
 *
 * @param config - The knowledge-sharing configuration providing the project name.
 * @returns A Terraform-formatted string with a header for the project.
 */
export function generateTerraformKnowledgeSharing(config: KnowledgeSharingConfig): string {
  let code = '# Auto-generated Knowledge Sharing Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript skeleton for a `KnowledgeSharingManager` class.
 *
 * @param config - The knowledge-sharing configuration providing the project name.
 * @returns A TypeScript source string containing a stub manager class and default export.
 */
export function generateTypeScriptKnowledgeSharing(config: KnowledgeSharingConfig): string {
  let code = '// Auto-generated Knowledge Sharing Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class KnowledgeSharingManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const knowledgeSharingManager = new KnowledgeSharingManager();\n';
  code += 'export default knowledgeSharingManager;\n';
  return code;
}

/**
 * Generates a Python skeleton for a `KnowledgeSharingManager` class.
 *
 * @param config - The knowledge-sharing configuration providing the project name.
 * @returns A Python source string containing a stub manager class and instance.
 */
export function generatePythonKnowledgeSharing(config: KnowledgeSharingConfig): string {
  let code = '# Auto-generated Knowledge Sharing Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class KnowledgeSharingManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'knowledge_sharing_manager = KnowledgeSharingManager()\n';
  return code;
}

/**
 * Writes generated knowledge-sharing files to the specified output directory.
 *
 * Emits Terraform, code (TypeScript or Python), Markdown, and a JSON config file.
 *
 * @param config - The knowledge-sharing configuration to materialize.
 * @param outputDir - Absolute or relative path of the directory to write into.
 * @param language - Target implementation language; `"typescript"` produces TS files, anything else produces Python files.
 * @returns A promise that resolves once all files have been written.
 */
export async function writeFiles(config: KnowledgeSharingConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformKnowledgeSharing(config);
  await fs.writeFile(path.join(outputDir, 'knowledge-sharing.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptKnowledgeSharing(config);
    await fs.writeFile(path.join(outputDir, 'knowledge-sharing-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-knowledge-sharing',
      version: '1.0.0',
      description: 'Team Knowledge Sharing and Documentation Collaboration',
      main: 'knowledge-sharing-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonKnowledgeSharing(config);
    await fs.writeFile(path.join(outputDir, 'knowledge_sharing_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'elasticsearch>=8.0.0', 'meilisearch>=0.28.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateKnowledgeSharingMD(config);
  await fs.writeFile(path.join(outputDir, 'KNOWLEDGE_SHARING.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    documents: config.documents,
    comments: config.comments,
    search: config.search,
    collaboration: config.collaboration,
    enableAnalytics: config.enableAnalytics,
    enableNotifications: config.enableNotifications,
  };
  await fs.writeFile(path.join(outputDir, 'knowledge-sharing-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided knowledge-sharing configuration unchanged.
 *
 * Acts as an identity/normalization entry point for the configuration.
 *
 * @param config - The knowledge-sharing configuration to return.
 * @returns The same `KnowledgeSharingConfig` instance that was passed in.
 */
export function knowledgeSharing(config: KnowledgeSharingConfig): KnowledgeSharingConfig {
  return config;
}
