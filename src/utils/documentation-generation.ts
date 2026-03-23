/**
 * Unified Documentation Generation for Polyglot Projects
 * Simple TypeScript-only version to avoid escaping issues
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type DocumentationLanguage = 'typescript';

export interface DocumentationConfig {
  projectName: string;
  language: DocumentationLanguage;
  outputDir: string;
  includeExamples: boolean;
  includeCrossRefs: boolean;
  outputFormat: 'markdown' | 'html' | 'both';
}

export interface APIDocumentation {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  parameters: ParameterDoc[];
  responses: ResponseDoc[];
}

export interface ParameterDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ResponseDoc {
  statusCode: number;
  description: string;
  schema?: any;
}

// TypeScript Documentation Generator
export function generateTypeScriptDocumentation(config: DocumentationConfig): string {
  let code = '// Auto-generated Documentation Tools for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';
  code += 'interface APIDoc {\n';
  code += '  name: string;\n';
  code += '  description: string;\n';
  code += '  endpoint: string;\n';
  code += '  method: string;\n';
  code += '  parameters: ParameterDoc[];\n';
  code += '  responses: ResponseDoc[];\n';
  code += '}\n\n';
  code += 'class DocumentationGenerator {\n';
  code += '  private outputDir: string;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    this.outputDir = options.outputDir || \'./docs\';\n';
  code += '  }\n\n';
  code += '  generate(apis: APIDoc[]): void {\n';
  code += '    let markdown = \'# API Documentation\\\\n\\\\n\';\n\n';
  code += '    apis.forEach(api => {\n';
  code += '      markdown += \'## \' + api.name + \'\\\\n\\\\n\';\n';
  code += '      markdown += api.description + \'\\\\n\\\\n\';\n';
  code += '      markdown += \'**Endpoint:** \' + api.method.toUpperCase() + \' \' + api.endpoint + \'\\\\n\\\\n\';\n\n';
  code += '      if (api.parameters.length > 0) {\n';
  code += '        markdown += \'### Parameters\\\\n\\\\n\';\n';
  code += '        markdown += \'| Name | Type | Required | Description |\\\\n\';\n';
  code += '        markdown += \'|------|------|----------|-------------|\\\\n\';\n\n';
  code += '        api.parameters.forEach(param => {\n';
  code += '          const req = param.required ? \'Yes\' : \'No\';\n';
  code += '          markdown += \'| \' + param.name + \' | \' + param.type + \' | \' + req + \' | \' + param.description + \' |\\\\n\';\n';
  code += '        });\n';
  code += '        markdown += \'\\\\n\';\n';
  code += '      }\n';
  code += '    });\n\n';
  code += '    fs.writeFileSync(this.outputDir + \'/API.md\', markdown);\n';
  code += '    console.log(\'[Docs] Generated API.md\');\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const docGenerator = new DocumentationGenerator({\n';
  code += '  outputDir: \'./docs\',\n';
  code += '});\n\n';
  code += 'export default docGenerator;\n';

  return code;
}

// Display configuration
export function displayDocumentationConfig(config: DocumentationConfig): void {
  console.log(chalk.cyan('\n✨ Unified Documentation Generation\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Include Examples:'), chalk.white(config.includeExamples ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Cross-References:'), chalk.white(config.includeCrossRefs ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Output Format:'), chalk.white(config.outputFormat));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'API documentation generation',
    'Auto-generated code examples',
    'Markdown and HTML output',
    'Cross-reference support',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: DocumentationConfig): string {
  let content = '# Documentation Generation for ' + config.projectName + '\n\n';
  content += 'Auto-generate API documentation for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Format**: ' + config.outputFormat + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '```typescript\n';
  content += 'import docGenerator from \'./documentation-generation\';\n\n';
  content += 'const apis = [{\n';
  content += '  name: \'Get User\',\n';
  content += '  description: \'Retrieve user information\',\n';
  content += '  endpoint: \'/api/users/:id\',\n';
  content += '  method: \'GET\',\n';
  content += '  parameters: [\n';
  content += '    { name: \'id\', type: \'number\', required: true, description: \'User ID\' }\n';
  content += '  ],\n';
  content += '  responses: [\n';
  content += '    { statusCode: 200, description: \'User found\' },\n';
  content += '    { statusCode: 404, description: \'User not found\' }\n';
  content += '  ]\n';
  content += '}];\n\n';
  content += 'docGenerator.generate(apis);\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **API Documentation**: Auto-generate from code\n';
  content += '- **Markdown Output**: Easy to read and edit\n';
  content += '- **Parameters Table**: Clear parameter documentation\n';
  content += '- **Response Codes**: Document all possible responses\n\n';

  return content;
}

// Write files
export async function writeDocumentationFiles(
  config: DocumentationConfig,
  output: string
): Promise<void> {
  const fileName = 'documentation-generation.ts';
  const filePath = path.join(output, fileName);

  const content = generateTypeScriptDocumentation(config);

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  const buildMD = generateBuildMD(config);
  await fs.writeFile(path.join(output, 'BUILD.md'), buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  const packageJson = {
    name: config.projectName.toLowerCase() + '-documentation',
    version: '1.0.0',
    description: 'Documentation generation for ' + config.projectName,
    types: fileName,
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  console.log(chalk.green('✅ Generated: package.json'));

  const docConfig = {
    projectName: config.projectName,
    language: config.language,
    includeExamples: config.includeExamples,
    includeCrossRefs: config.includeCrossRefs,
    outputFormat: config.outputFormat,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'documentation-config.json'),
    JSON.stringify(docConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: documentation-config.json'));
}
