// Workspace Documentation Generator
// Generate markdown documentation from workspace configuration

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { WorkspaceConfig, ServiceConfig } from '../parsers/workspace-parser';

export interface DocsGenerationOptions {
  output?: string;
  format?: 'markdown' | 'json' | 'html';
  includeDiagrams?: boolean;
  includeEnv?: boolean;
  includeDependencies?: boolean;
  verbose?: boolean;
  watch?: boolean;
}

/**
 * Generate workspace documentation
 */
export async function generateWorkspaceDocs(options: DocsGenerationOptions = {}): Promise<void> {
  const {
    output = 'WORKSPACE.md',
    format = 'markdown',
    includeDiagrams = true,
    includeEnv = true,
    includeDependencies = true,
    verbose = false,
    watch = false,
  } = options;

  console.log(chalk.cyan.bold('\n📚 Generating Workspace Documentation\n'));

  const cwd = process.cwd();
  const configPath = path.join(cwd, 're-shell.workspaces.yaml');

  // Check if config exists
  if (!fs.existsSync(configPath)) {
    console.log(chalk.red('✗ No workspace configuration found'));
    console.log(chalk.gray('Expected file: re-shell.workspaces.yaml'));
    console.log(chalk.gray('\nTip: Run "re-shell workspace init" to create one\n'));
    return;
  }

  // Watch mode for auto-updating documentation
  if (watch) {
    return watchAndUpdateDocs(configPath, output, format, {
      includeDiagrams,
      includeEnv,
      includeDependencies,
      verbose,
    });
  }

  try {
    // Parse workspace configuration
    const { workspaceParser } = await import('../parsers/workspace-parser');
    const result = workspaceParser.parse(configPath);

    if (!result.valid || !result.config) {
      console.log(chalk.red('✗ Invalid workspace configuration'));
      console.log(chalk.gray('Please fix errors before generating documentation\n'));
      return;
    }

    const config = result.config;

    console.log(chalk.gray('Generating documentation...'));

    // Generate documentation based on format
    let content: string;
    switch (format) {
      case 'markdown':
        content = generateMarkdownDocs(config, {
          includeDiagrams,
          includeEnv,
          includeDependencies,
        });
        break;
      case 'json':
        content = generateJsonDocs(config);
        break;
      case 'html':
        content = generateHtmlDocs(config, {
          includeDiagrams,
          includeEnv,
          includeDependencies,
        });
        break;
      default:
        console.log(chalk.red('✗ Unsupported format: ' + format));
        return;
    }

    // Write documentation to file
    const outputPath = path.join(cwd, output);
    await fs.writeFile(outputPath, content);

    console.log(chalk.green('\n✓ Documentation generated successfully!'));
    console.log(chalk.gray('Output: ' + outputPath));
    console.log();

  } catch (error: any) {
    console.log(chalk.red('✗ Error generating documentation: ' + error.message));
    if (verbose) {
      console.error(error);
    }
  }
}

/**
 * Generate markdown documentation
 */
function generateMarkdownDocs(
  config: WorkspaceConfig,
  options: { includeDiagrams: boolean; includeEnv: boolean; includeDependencies: boolean }
): string {
  const { includeDiagrams, includeEnv, includeDependencies } = options;
  let md = '';

  // Title and metadata
  md += `# ${config.name}\n\n`;
  if (config.description) {
    md += `${config.description}\n\n`;
  }
  md += `**Version:** ${config.version}  \n`;
  if (config.metadata) {
    Object.entries(config.metadata).forEach(([key, value]) => {
      md += `**${key}:** ${value}  \n`;
    });
  }
  md += '\n---\n\n';

  // Table of Contents
  md += '## Table of Contents\n\n';
  md += '- [Overview](#overview)\n';
  md += '- [Services](#services)\n';
  if (includeDependencies) {
    md += '- [Dependencies](#dependencies)\n';
  }
  if (includeEnv) {
    md += '- [Environment Variables](#environment-variables)\n';
  }
  if (includeDiagrams) {
    md += '- [Architecture](#architecture)\n';
  }
  md += '\n---\n\n';

  // Overview
  md += '## Overview\n\n';
  md += 'This workspace contains the following services:\n\n';
  md += '| Service | Type | Language | Framework | Port |\n';
  md += '|---------|------|----------|-----------|------|\n';

  for (const [serviceId, service] of Object.entries(config.services)) {
    const port = service.port || '-';
    md += `| ${serviceId} | ${service.type || 'worker'} | ${service.language} | ${formatFramework(service.framework)} | ${port} |\n`;
  }
  md += '\n';

  // Services details
  md += '## Services\n\n';

  for (const [serviceId, service] of Object.entries(config.services)) {
    md += `### ${serviceId}\n\n`;
    md += `**Name:** ${service.name}\n\n`;
    if (service.displayName) {
      md += `**Display Name:** ${service.displayName}\n\n`;
    }
    if (service.description) {
      md += `**Description:** ${service.description}\n\n`;
    }
    md += `**Type:** ${service.type || 'worker'}\n\n`;
    md += `**Language:** ${service.language}\n\n`;
    md += `**Framework:** ${formatFramework(service.framework)}\n\n`;

    if (service.port) {
      md += `**Port:** ${service.port}\n\n`;
    }

    if (service.path) {
      md += `**Path:** \`${service.path}\`\n\n`;
    }

    // Scripts
    if (service.scripts && Object.keys(service.scripts).length > 0) {
      md += '#### Scripts\n\n';
      md += '| Command | Script |\n';
      md += '|---------|--------|\n';
      for (const [name, script] of Object.entries(service.scripts)) {
        md += `| \`${name}\` | \`${script}\` |\n`;
      }
      md += '\n';
    }

    // Environment variables
    if (includeEnv && service.env && Object.keys(service.env).length > 0) {
      md += '#### Environment Variables\n\n';
      for (const [key, value] of Object.entries(service.env)) {
        md += `- \`${key}\`: ${value}\n`;
      }
      md += '\n';
    }

    // Dependencies
    if (includeDependencies && service.dependencies) {
      if (service.dependencies.production && Object.keys(service.dependencies.production).length > 0) {
        md += '#### Production Dependencies\n\n';
        for (const [dep, version] of Object.entries(service.dependencies.production)) {
          md += `- \`${dep}\`: ${version}\n`;
        }
        md += '\n';
      }

      if (service.dependencies.development && Object.keys(service.dependencies.development).length > 0) {
        md += '#### Development Dependencies\n\n';
        for (const [dep, version] of Object.entries(service.dependencies.development)) {
          md += `- \`${dep}\`: ${version}\n`;
        }
        md += '\n';
      }
    }

    md += '---\n\n';
  }

  // Global Dependencies
  if (includeDependencies && config.dependencies) {
    md += '## Dependencies\n\n';

    if (config.dependencies.databases && config.dependencies.databases.length > 0) {
      md += '### Databases\n\n';
      for (const db of config.dependencies.databases) {
        md += `- ${JSON.stringify(db)}\n`;
      }
      md += '\n';
    }

    if (config.dependencies.caches && config.dependencies.caches.length > 0) {
      md += '### Caches\n\n';
      for (const cache of config.dependencies.caches) {
        md += `- ${JSON.stringify(cache)}\n`;
      }
      md += '\n';
    }

    if (config.dependencies.queues && config.dependencies.queues.length > 0) {
      md += '### Message Queues\n\n';
      for (const queue of config.dependencies.queues) {
        md += `- ${JSON.stringify(queue)}\n`;
      }
      md += '\n';
    }
  }

  // Architecture diagram
  if (includeDiagrams) {
    md += '## Architecture\n\n';
    md += generateArchitectureDiagram(config);
    md += '\n';

    // Service graph
    md += '### Service Graph\n\n';
    md += '```mermaid\n';
    md += generateMermaidGraph(config);
    md += '```\n\n';
  }

  return md;
}

/**
 * Generate JSON documentation
 */
function generateJsonDocs(config: WorkspaceConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Generate HTML documentation
 */
function generateHtmlDocs(
  config: WorkspaceConfig,
  options: { includeDiagrams: boolean; includeEnv: boolean; includeDependencies: boolean }
): string {
  const { includeDiagrams, includeEnv, includeDependencies } = options;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.name} - Workspace Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #007acc; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    pre { background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    code { background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    .service-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .tag { display: inline-block; background-color: #007acc; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin: 2px; }
  </style>
</head>
<body>
  <h1>${config.name}</h1>
`;

  if (config.description) {
    html += `  <p>${config.description}</p>`;
  }

  html += `  <p><strong>Version:</strong> ${config.version}</p>`;

  // Services table
  html += `  <h2>Services Overview</h2>
  <table>
    <tr>
      <th>Service</th>
      <th>Type</th>
      <th>Language</th>
      <th>Framework</th>
      <th>Port</th>
    </tr>`;

  for (const [serviceId, service] of Object.entries(config.services)) {
    const port = service.port || '-';
    html += `
    <tr>
      <td><strong>${serviceId}</strong></td>
      <td><span class="tag">${service.type || 'worker'}</span></td>
      <td>${service.language}</td>
      <td>${formatFramework(service.framework)}</td>
      <td>${port}</td>
    </tr>`;
  }

  html += `  </table>`;

  // Service details
  html += `  <h2>Service Details</h2>`;

  for (const [serviceId, service] of Object.entries(config.services)) {
    html += `  <div class="service-card">
    <h3>${serviceId}</h3>
    <p><strong>Name:</strong> ${service.name}</p>
    ${service.description ? `<p><strong>Description:</strong> ${service.description}</p>` : ''}
    <p><strong>Type:</strong> ${service.type || 'worker'}</p>
    <p><strong>Language:</strong> ${service.language}</p>
    <p><strong>Framework:</strong> ${formatFramework(service.framework)}</p>
    ${service.port ? `<p><strong>Port:</strong> ${service.port}</p>` : ''}
    ${service.path ? `<p><strong>Path:</strong> <code>${service.path}</code></p>` : ''}
  </div>`;
  }

  html += `</body>
</html>`;

  return html;
}

/**
 * Generate ASCII architecture diagram
 */
function generateArchitectureDiagram(config: WorkspaceConfig): string {
  let diagram = '```\n';

  const services = Object.values(config.services);
  const frontends = services.filter(s => s.type === 'frontend');
  const backends = services.filter(s => s.type === 'backend');
  const workers = services.filter(s => s.type === 'worker');
  const hasServices = frontends.length > 0 || backends.length > 0 || workers.length > 0;

  if (hasServices) {
    diagram += '                    ┌─────────────────┐\n';
    diagram += '                    │   Client/Browser │\n';
    diagram += '                    └────────┬────────┘\n';
    diagram += '                             │\n';
    diagram += '                             ▼\n';
  }

  if (frontends.length > 0) {
    diagram += '              ┌─────────────────────┐\n';
    diagram += '              │    Frontend Layer    │\n';
    diagram += '              ├─────────────────────┤\n';
    frontends.forEach((service) => {
      const line = `● ${service.name}`;
      const padding = ' '.repeat(21 - line.length);
      diagram += `              │ ${line}${padding}│\n`;
    });
    diagram += '              └──────────┬──────────┘\n';
    diagram += '                         │\n';
    diagram += '                         ▼\n';
  }

  if (backends.length > 0) {
    diagram += '              ┌─────────────────────┐\n';
    diagram += '              │    Backend Layer     │\n';
    diagram += '              ├─────────────────────┤\n';
    backends.forEach((service) => {
      const line = `● ${service.name}`;
      const padding = ' '.repeat(21 - line.length);
      diagram += `              │ ${line}${padding}│\n`;
    });
    diagram += '              └──────────┬──────────┘\n';
    diagram += '                         │\n';
    diagram += '                         ▼\n';
  }

  if (workers.length > 0) {
    diagram += '              ┌─────────────────────┐\n';
    diagram += '              │    Worker Layer      │\n';
    diagram += '              ├─────────────────────┤\n';
    workers.forEach((service) => {
      const line = `● ${service.name}`;
      const padding = ' '.repeat(21 - line.length);
      diagram += `              │ ${line}${padding}│\n`;
    });
    diagram += '              └─────────────────────┘\n';
  }

  diagram += '```' + '\n';

  return diagram;
}

/**
 * Generate Mermaid graph
 */
function generateMermaidGraph(config: WorkspaceConfig): string {
  let graph = 'graph TD\n';

  // Group services by type
  const frontends = Object.entries(config.services).filter(([_, s]) => s.type === 'frontend');
  const backends = Object.entries(config.services).filter(([_, s]) => s.type === 'backend');
  const workers = Object.entries(config.services).filter(([_, s]) => s.type === 'worker');

  // Add subgraphs for each type
  if (frontends.length > 0) {
    graph += '  subgraph Frontend\n';
    frontends.forEach(([id, service]) => {
      graph += `    ${id}[${service.name}]\\n`;
    });
    graph += '  end\n';
  }

  if (backends.length > 0) {
    graph += '  subgraph Backend\n';
    backends.forEach(([id, service]) => {
      graph += `    ${id}[${service.name}]\\n`;
    });
    graph += '  end\n';
  }

  if (workers.length > 0) {
    graph += '  subgraph Workers\n';
    workers.forEach(([id, service]) => {
      graph += `    ${id}[${service.name}]\\n`;
    });
    graph += '  end\n';
  }

  // Add connections (simple example - could be enhanced with actual dependency info)
  if (frontends.length > 0 && backends.length > 0) {
    frontends.forEach(([frontendId]) => {
      backends.forEach(([backendId]) => {
        graph += `  ${frontendId} --> ${backendId}\\n`;
      });
    });
  }

  return graph;
}

/**
 * Format framework for display
 */
function formatFramework(framework: string | { name: string; version?: string }): string {
  if (typeof framework === 'string') {
    return framework;
  }
  return framework.version ? `${framework.name} ${framework.version}` : framework.name;
}

/**
 * Watch workspace config and auto-update documentation
 */
async function watchAndUpdateDocs(
  configPath: string,
  outputPath: string,
  format: string,
  options: {
    includeDiagrams: boolean;
    includeEnv: boolean;
    includeDependencies: boolean;
    verbose: boolean;
  }
): Promise<void> {
  const cwd = process.cwd();
  const fullOutputPath = path.join(cwd, outputPath);

  console.log(chalk.cyan('👀 Watching for changes...\n'));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));
  console.log(chalk.gray('Config: ' + configPath));
  console.log(chalk.gray('Output: ' + outputPath + '\n'));

  // Initial generation
  await generateOnce(configPath, fullOutputPath, format, options);

  // Watch for file changes
  const watcher = fs.watch(configPath, async (eventType, filename) => {
    if (eventType === 'change') {
      // Wait a bit for file to be fully written
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(chalk.gray('\n' + new Date().toLocaleTimeString() + ' - Configuration changed, regenerating documentation...\n'));

      await generateOnce(configPath, fullOutputPath, format, options);

      console.log(chalk.green('✓ Documentation updated\n'));
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\nStopped watching\n'));
    watcher.close();
    process.exit(0);
  });
}

/**
 * Generate documentation once
 */
async function generateOnce(
  configPath: string,
  outputPath: string,
  format: string,
  options: {
    includeDiagrams: boolean;
    includeEnv: boolean;
    includeDependencies: boolean;
    verbose: boolean;
  }
): Promise<void> {
  try {
    // Parse workspace configuration
    const { workspaceParser } = await import('../parsers/workspace-parser');
    const result = workspaceParser.parse(configPath);

    if (!result.valid || !result.config) {
      console.log(chalk.red('✗ Invalid workspace configuration - skipping documentation generation\n'));
      return;
    }

    const config = result.config;

    // Generate documentation based on format
    let content: string;
    switch (format) {
      case 'markdown':
        content = generateMarkdownDocs(config, options);
        break;
      case 'json':
        content = generateJsonDocs(config);
        break;
      case 'html':
        content = generateHtmlDocs(config, options);
        break;
      default:
        console.log(chalk.red('✗ Unsupported format: ' + format));
        return;
    }

    // Write documentation to file
    await fs.writeFile(outputPath, content);

    console.log(chalk.gray('Documentation updated: ' + outputPath));
  } catch (error: any) {
    console.log(chalk.red('✗ Error generating documentation: ' + error.message));
  }
}
