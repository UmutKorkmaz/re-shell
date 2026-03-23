import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Template Versioning and Update Management
 *
 * Manages template versions, updates, and migration paths
 */

export interface TemplateVersion {
  templateId: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  changelog: string[];
  breakingChanges: boolean;
  deprecated: boolean;
}

export interface Migration {
  fromVersion: string;
  toVersion: string;
  steps: MigrationStep[];
  breaking: boolean;
  automated: boolean;
}

export interface MigrationStep {
  action: string;
  description: string;
  filePath?: string;
  search?: string;
  replace?: string;
  command?: string;
  automated: boolean;
}

export interface TemplateUpdate {
  templateId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  migrations: Migration[];
  estimatedTime: number;
}

export interface TemplateRegistry {
  templates: Record<string, TemplateVersion>;
  lastUpdated: string;
}

/**
 * Get template version
 */
export async function getTemplateVersion(
  templateId: string,
  projectPath: string = process.cwd()
): Promise<TemplateVersion | null> {
  const versionFilePath = path.join(projectPath, '.re-shell', 'template-versions.json');

  if (!(await fs.pathExists(versionFilePath))) {
    return null;
  }

  const registry: TemplateRegistry = await fs.readJson(versionFilePath);
  return registry.templates[templateId] || null;
}

/**
 * Set template version
 */
export async function setTemplateVersion(
  templateId: string,
  version: string,
  projectPath: string = process.cwd()
): Promise<void> {
  const versionDir = path.join(projectPath, '.re-shell');
  const versionFilePath = path.join(versionDir, 'template-versions.json');

  await fs.ensureDir(versionDir);

  let registry: TemplateRegistry = { templates: {}, lastUpdated: new Date().toISOString() };

  if (await fs.pathExists(versionFilePath)) {
    registry = await fs.readJson(versionFilePath);
  }

  if (!registry.templates[templateId]) {
    // New template
    registry.templates[templateId] = {
      templateId,
      version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      changelog: [`Initial version ${version}`],
      breakingChanges: false,
      deprecated: false,
    };
  } else {
    // Update existing template
    registry.templates[templateId].version = version;
    registry.templates[templateId].updatedAt = new Date().toISOString();
    registry.templates[templateId].changelog.push(`Updated to version ${version}`);
  }

  registry.lastUpdated = new Date().toISOString();

  await fs.writeJson(versionFilePath, registry, { spaces: 2 });
}

/**
 * Get available migrations
 */
export async function getMigrations(
  templateId: string,
  fromVersion: string,
  toVersion: string
): Promise<Migration[]> {
  // Define migration paths for common templates
  const migrations: Record<string, Migration[]> = {
    'react-ts': [
      {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        breaking: true,
        automated: true,
        steps: [
          {
            action: 'update-dependencies',
            description: 'Update React to v18 and TypeScript to v5',
            filePath: 'package.json',
            search: '"react": "^17.0.0"',
            replace: '"react": "^18.2.0"',
            automated: true,
          },
          {
            action: 'update-typescript',
            description: 'Update TypeScript configuration',
            filePath: 'tsconfig.json',
            search: '"target": "es5"',
            replace: '"target": "es2020"',
            automated: true,
          },
          {
            action: 'migrate-create-root',
            description: 'Remove ReactDOM.render() and use createRoot()',
            filePath: 'src/main.tsx',
            search: 'ReactDOM.render(',
            replace: 'const root = ReactDOM.createRoot(',
            automated: true,
          },
        ],
      },
    ],
    'nestjs': [
      {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        breaking: true,
        automated: true,
        steps: [
          {
            action: 'update-nestjs',
            description: 'Update NestJS to v10',
            filePath: 'package.json',
            search: '"@nestjs/core": "^9.0.0"',
            replace: '"@nestjs/core": "^10.0.0"',
            automated: true,
          },
          {
            action: 'update-platform',
            description: 'Update platform usage',
            filePath: 'src/main.ts',
            search: 'app.enableCors()',
            replace: 'app.enableCors({ origin: true })',
            automated: true,
          },
        ],
      },
    ],
    'express-ts': [
      {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        breaking: true,
        automated: true,
        steps: [
          {
            action: 'update-express',
            description: 'Update Express to v5',
            filePath: 'package.json',
            search: '"express": "^4.18.0"',
            replace: '"express": "^5.0.0"',
            automated: true,
          },
          {
            action: 'add-types',
            description: 'Add Express types',
            filePath: 'package.json',
            search: '"@types/express"',
            replace: '"@types/express": "^5.0.0"',
            automated: true,
          },
        ],
      },
    ],
  };

  return migrations[templateId] || [];
}

/**
 * Check for template updates
 */
export async function checkTemplateUpdates(
  projectPath: string = process.cwd()
): Promise<TemplateUpdate[]> {
  const updates: TemplateUpdate[] = [];
  const versionFilePath = path.join(projectPath, '.re-shell', 'template-versions.json');

  if (!(await fs.pathExists(versionFilePath))) {
    return updates;
  }

  const registry: TemplateRegistry = await fs.readJson(versionFilePath);

  // Latest versions (in real implementation, would fetch from remote registry)
  const latestVersions: Record<string, string> = {
    'react-ts': '2.0.0',
    'nestjs': '2.0.0',
    'express-ts': '2.0.0',
    'vue-ts': '1.5.0',
  };

  for (const [templateId, version] of Object.entries(registry.templates)) {
    const latestVersion = latestVersions[templateId] || version.version;
    const hasUpdate = latestVersion !== version.version;

    if (hasUpdate) {
      const migrations = await getMigrations(templateId, version.version, latestVersion);
      const estimatedTime = migrations.reduce((acc, m) => acc + m.steps.length * 5, 0);

      updates.push({
        templateId,
        currentVersion: version.version,
        latestVersion,
        hasUpdate: true,
        migrations,
        estimatedTime,
      });
    }
  }

  return updates;
}

/**
 * Apply migration
 */
export async function applyMigration(
  migration: Migration,
  projectPath: string = process.cwd()
): Promise<void> {
  console.log(chalk.cyan(`\nApplying migration: ${migration.fromVersion} → ${migration.toVersion}\n`));

  for (const step of migration.steps) {
    console.log(chalk.yellow(`Step: ${step.description}`));

    if (step.automated) {
      if (step.filePath && step.search && step.replace) {
        const filePath = path.join(projectPath, step.filePath);

        if (await fs.pathExists(filePath)) {
          let content = await fs.readFile(filePath, 'utf-8');

          if (content.includes(step.search)) {
            content = content.replace(step.search, step.replace);
            await fs.writeFile(filePath, content);
            console.log(chalk.green(`  ✓ Updated ${step.filePath}`));
          } else {
            console.log(chalk.yellow(`  ⚠ Pattern not found in ${step.filePath}`));
          }
        } else {
          console.log(chalk.red(`  ✗ File not found: ${step.filePath}`));
        }
      } else if (step.command) {
        console.log(chalk.gray(`  Command: ${step.command}`));
        console.log(chalk.gray(`  (Not executed - manual action required)`));
      }
    } else {
      console.log(chalk.gray(`  Manual action required`));
    }
  }

  console.log(chalk.green(`\n✓ Migration ${migration.fromVersion} → ${migration.toVersion} completed!\n`));
}

/**
 * Display template updates
 */
export async function displayTemplateUpdates(updates: TemplateUpdate[]): Promise<void> {
  if (updates.length === 0) {
    console.log(chalk.green('\n✓ All templates are up to date!\n'));
    return;
  }

  console.log(chalk.bold('\n📦 Template Updates Available\n'));

  for (const update of updates) {
    console.log(chalk.cyan(`${update.templateId}`));
    console.log(chalk.gray(`  Current: ${update.currentVersion}`));
    console.log(chalk.green(`  Latest:  ${update.latestVersion}`));

    if (update.migrations.length > 0) {
      console.log(chalk.yellow(`\n  Migrations:`));

      for (const migration of update.migrations) {
        const breaking = migration.breaking ? chalk.red(' [BREAKING]') : '';
        console.log(`    ${migration.fromVersion} → ${migration.toVersion}${breaking}`);

        if (migration.automated) {
          console.log(chalk.gray(`      ${migration.steps.length} automated steps`));
        } else {
          console.log(chalk.gray(`      Manual migration required`));
        }
      }
    }

    console.log(chalk.gray(`  Estimated time: ${update.estimatedTime} minutes\n`));
  }
}

/**
 * Create migration guide
 */
export async function createMigrationGuide(
  templateId: string,
  fromVersion: string,
  toVersion: string,
  outputPath: string
): Promise<void> {
  const migrations = await getMigrations(templateId, fromVersion, toVersion);

  let guide = `# Migration Guide: ${templateId} ${fromVersion} → ${toVersion}\n\n`;
  guide += `## Overview\n\n`;
  guide += `This guide will help you migrate from ${fromVersion} to ${toVersion}.\n\n`;

  const breakingMigrations = migrations.filter(m => m.breaking);

  if (breakingMigrations.length > 0) {
    guide += `⚠️ **Breaking Changes**: This migration contains breaking changes.\n\n`;
  }

  guide += `## Migration Steps\n\n`;

  for (const migration of migrations) {
    guide += `### ${migration.fromVersion} → ${migration.toVersion}\n\n`;

    if (migration.breaking) {
      guide += `**Breaking Changes**: Yes\n\n`;
    }

    if (migration.automated) {
      guide += `**Automated**: Yes - Run \`re-shell template-migrate ${templateId} ${fromVersion} ${toVersion}\`\n\n`;
    }

    guide += `#### Manual Steps\n\n`;

    for (const step of migration.steps) {
      guide += `- ${step.description}\n`;

      if (step.filePath) {
        guide += `  - File: \`${step.filePath}\`\n`;
      }

      if (step.command) {
        guide += `  - Command: \`${step.command}\`\n`;
      }

      if (!step.automated) {
        guide += `  - **Manual action required**\n`;
      }

      guide += `\n`;
    }
  }

  guide += `## Rollback\n\n`;
  guide += `If you need to rollback, you can:\n`;
  guide += `1. Revert your changes using git\n`;
  guide += `2. Or restore from backup\n\n`;

  guide += `## Support\n\n`;
  guide += `If you encounter issues:\n`;
  guide += `- Check the documentation: https://re-shell.dev/docs\n`;
  guide += `- Open an issue: https://github.com/re-shell/re-shell/issues\n`;
  guide += `- Join our Discord: https://discord.gg/re-shell\n`;

  await fs.writeFile(outputPath, guide);
  console.log(chalk.green(`\n✓ Migration guide written to ${outputPath}\n`));
}

/**
 * Display template versions
 */
export async function displayTemplateVersions(projectPath: string = process.cwd()): Promise<void> {
  const versionFilePath = path.join(projectPath, '.re-shell', 'template-versions.json');

  if (!(await fs.pathExists(versionFilePath))) {
    console.log(chalk.yellow('\nNo template versions found. Run re-shell create to initialize a project.\n'));
    return;
  }

  const registry: TemplateRegistry = await fs.readJson(versionFilePath);

  console.log(chalk.bold('\n📋 Template Versions\n'));

  for (const [templateId, version] of Object.entries(registry.templates)) {
    const status = version.deprecated ? chalk.red('[DEPRECATED]') : '';
    const breaking = version.breakingChanges ? chalk.yellow('[BREAKING]') : '';

    console.log(chalk.cyan(`${templateId} ${status} ${breaking}`));
    console.log(chalk.gray(`  Version: ${version.version}`));
    console.log(chalk.gray(`  Created: ${new Date(version.createdAt).toLocaleDateString()}`));
    console.log(chalk.gray(`  Updated: ${new Date(version.updatedAt).toLocaleDateString()}`));

    if (version.changelog.length > 0) {
      const recentChanges = version.changelog.slice(-3);
      console.log(chalk.gray('  Recent changes:'));
      for (const change of recentChanges) {
        console.log(chalk.gray(`    - ${change}`));
      }
    }

    console.log('');
  }

  console.log(chalk.gray(`Last checked: ${new Date(registry.lastUpdated).toLocaleString()}\n`));
}
