// Auto-generated Architecture Design Utility
// Generated at: 2026-01-13T13:20:00.000Z

import chalk from 'chalk';
type DiagramType = 'sequence' | 'flowchart' | 'component' | 'deployment' | 'c4' | 'erd';
type ExportFormat = 'png' | 'svg' | 'pdf' | 'mermaid' | 'plantuml';
type VersionControl = 'git' | 'github' | 'gitlab' | 'bitbucket';

interface DiagramConfig {
  type: DiagramType;
  format: ExportFormat;
  autoLayout: boolean;
  theme: string;
}

interface DesignElement {
  id: string;
  type: 'component' | 'service' | 'database' | 'queue' | 'cache';
  name: string;
  description: string;
  properties: { [key: string]: any };
}

interface CollaborationConfig {
  enableComments: boolean;
  enableVersioning: boolean;
  enableReview: boolean;
  maxCollaborators: number;
}

interface ArchitectureDesignConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  diagram: DiagramConfig;
  elements: DesignElement[];
  collaboration: CollaborationConfig;
  versionControl: VersionControl;
  enableAutoSave: boolean;
  enableTemplates: boolean;
}

/**
 * Prints a human-readable summary of the architecture design configuration to the console.
 * Uses colored output (via chalk) to highlight labels and values such as project name,
 * providers, diagram settings, collaboration options, and feature toggles.
 *
 * @param config - The architecture design configuration to display.
 */
export function displayConfig(config: ArchitectureDesignConfig): void {
  console.log(chalk.cyan('🏗️  Collaborative Architecture Design and Planning Tools'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Diagram Type:'), config.diagram.type);
  console.log(chalk.yellow('Export Format:'), config.diagram.format);
  console.log(chalk.yellow('Elements:'), config.elements.length);
  console.log(chalk.yellow('Version Control:'), config.versionControl);
  console.log(chalk.yellow('Comments:'), config.collaboration.enableComments ? 'Yes' : 'No');
  console.log(chalk.yellow('Versioning:'), config.collaboration.enableVersioning ? 'Yes' : 'No');
  console.log(chalk.yellow('Review:'), config.collaboration.enableReview ? 'Yes' : 'No');
  console.log(chalk.yellow('Auto Save:'), config.enableAutoSave ? 'Yes' : 'No');
  console.log(chalk.yellow('Templates:'), config.enableTemplates ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown document describing the collaborative architecture design
 * feature set, including supported diagram types, export formats, collaboration
 * capabilities, and template system.
 *
 * @param config - The architecture design configuration used to scope the document.
 * @returns A Markdown string summarizing the architecture design features.
 */
export function generateArchitectureDesignMD(config: ArchitectureDesignConfig): string {
  let md = '# Collaborative Architecture Design and Planning\n\n';
  md += '## Features\n\n';
  md += '- Multiple diagram types (sequence, flowchart, component, deployment, C4, ERD)\n';
  md += '- Export formats (PNG, SVG, PDF, Mermaid, PlantUML)\n';
  md += '- Auto-layout and theming\n';
  md += '- Collaborative editing with comments\n';
  md += '- Version control integration\n';
  md += '- Review and approval workflows\n';
  md += '- Design element library\n';
  md += '- Auto-save functionality\n';
  md += '- Template system\n';
  md += '- Multi-user collaboration\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header block for the architecture design of the given project.
 * The output includes the project name and a timestamp marking when it was generated.
 *
 * @param config - The architecture design configuration containing the project name.
 * @returns A Terraform-formatted string with a generated header comment.
 */
export function generateTerraformArchitectureDesign(config: ArchitectureDesignConfig): string {
  let code = '# Auto-generated Architecture Design Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates TypeScript source code defining an `ArchitectureDesignManager` class
 * that extends `EventEmitter`, along with a default exported instance. The output
 * is prefixed with the project name and a generation timestamp.
 *
 * @param config - The architecture design configuration containing the project name.
 * @returns TypeScript source code as a string.
 */
export function generateTypeScriptArchitectureDesign(config: ArchitectureDesignConfig): string {
  let code = '// Auto-generated Architecture Design Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class ArchitectureDesignManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const architectureDesignManager = new ArchitectureDesignManager();\n';
  code += 'export default architectureDesignManager;\n';
  return code;
}

/**
 * Generates Python source code defining an `ArchitectureDesignManager` class
 * along with a module-level instance. The output includes the project name
 * (embedded in the constructor default) and a generation timestamp.
 *
 * @param config - The architecture design configuration containing the project name.
 * @returns Python source code as a string.
 */
export function generatePythonArchitectureDesign(config: ArchitectureDesignConfig): string {
  let code = '# Auto-generated Architecture Design Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class ArchitectureDesignManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'architecture_design_manager = ArchitectureDesignManager()\n';
  return code;
}

/**
 * Writes the architecture design artifacts to the specified output directory.
 *
 * Depending on the chosen `language`, this function writes:
 * - `architecture-design.tf`: Terraform header for the design.
 * - For TypeScript: `architecture-design-manager.ts` and `package.json`.
 * - For other languages (treated as Python): `architecture_design_manager.py` and `requirements.txt`.
 * - `ARCHITECTURE_DESIGN.md`: Markdown documentation of the feature set.
 * - `architecture-design-config.json`: The resolved configuration as JSON.
 *
 * @param config - The architecture design configuration to materialize into files.
 * @param outputDir - The target directory; created if it does not exist.
 * @param language - The implementation language, e.g. `'typescript'` (otherwise Python is assumed).
 * @returns A promise that resolves once all files have been written.
 * @throws {Error} If directory creation or any file write fails.
 */
export async function writeFiles(config: ArchitectureDesignConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformArchitectureDesign(config);
  await fs.writeFile(path.join(outputDir, 'architecture-design.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptArchitectureDesign(config);
    await fs.writeFile(path.join(outputDir, 'architecture-design-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-architecture-design',
      version: '1.0.0',
      description: 'Collaborative Architecture Design and Planning',
      main: 'architecture-design-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonArchitectureDesign(config);
    await fs.writeFile(path.join(outputDir, 'architecture_design_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'graphviz>=0.20.0', 'plantuml>=0.3.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateArchitectureDesignMD(config);
  await fs.writeFile(path.join(outputDir, 'ARCHITECTURE_DESIGN.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    diagram: config.diagram,
    elements: config.elements,
    collaboration: config.collaboration,
    versionControl: config.versionControl,
    enableAutoSave: config.enableAutoSave,
    enableTemplates: config.enableTemplates,
  };
  await fs.writeFile(path.join(outputDir, 'architecture-design-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided architecture design configuration unchanged.
 * Acts as an identity passthrough/normalization entry point for the design config.
 *
 * @param config - The architecture design configuration to return.
 * @returns The same `ArchitectureDesignConfig` instance that was passed in.
 */
export function architectureDesign(config: ArchitectureDesignConfig): ArchitectureDesignConfig {
  return config;
}
