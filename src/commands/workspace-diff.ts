// Workspace Configuration Diff Utility
// Compare workspace configurations and show changes

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { WorkspaceConfig, ServiceConfig } from '../parsers/workspace-parser';

export interface WorkspaceDiffOptions {
  from?: string;
  to?: string;
  format?: 'text' | 'json' | 'markdown';
  verbose?: boolean;
}

interface ConfigChange {
  type: 'added' | 'removed' | 'modified';
  path: string;
  oldValue?: any;
  newValue?: any;
}

interface ServiceChange {
  type: 'added' | 'removed' | 'modified';
  serviceId: string;
  changes: ConfigChange[];
}

interface WorkspaceDiff {
  metadata: {
    from: string;
    to: string;
    timestamp: string;
  };
  changes: {
    metadata?: ConfigChange[];
    services?: ServiceChange[];
    dependencies?: ConfigChange[];
  };
  summary: {
    added: number;
    removed: number;
    modified: number;
  };
}

/**
 * Compare two workspace configurations
 */
export async function diffWorkspace(options: WorkspaceDiffOptions = {}): Promise<void> {
  const { from, to, format = 'text', verbose = false } = options;

  console.log(chalk.cyan.bold('\n🔍 Workspace Configuration Diff\n'));

  const cwd = process.cwd();
  const fromPath = from || path.join(cwd, 're-shell.workspaces.yaml');
  const toPath = to || path.join(cwd, 're-shell.workspaces.yaml');

  // If both paths are the same, show usage
  if (fromPath === toPath) {
    console.log(chalk.yellow('⚠ No comparison target specified'));
    console.log(chalk.gray('Usage: re-shell workspace diff --from <old.yaml> --to <new.yaml>\n'));
    console.log(chalk.gray('Or use git to compare with previous version:\n'));
    console.log(chalk.gray('  git show HEAD~1:re-shell.workspaces.yaml > /tmp/old.yaml\n'));
    console.log(chalk.gray('  re-shell workspace diff --from /tmp/old.yaml\n'));
    return;
  }

  try {
    // Parse both configurations
    const fromConfig = await parseWorkspaceConfig(fromPath);
    const toConfig = await parseWorkspaceConfig(toPath);

    if (!fromConfig) {
      console.log(chalk.red('✗ Cannot read from configuration: ' + fromPath));
      return;
    }

    if (!toConfig) {
      console.log(chalk.red('✗ Cannot read to configuration: ' + toPath));
      return;
    }

    console.log(chalk.gray('Comparing:'));
    console.log(chalk.gray('  From: ' + fromPath));
    console.log(chalk.gray('  To:   ' + toPath + '\n'));

    // Compute diff
    const diff = computeDiff(fromConfig, toConfig, fromPath, toPath);

    // Display results
    switch (format) {
      case 'json':
        console.log(JSON.stringify(diff, null, 2));
        break;
      case 'markdown':
        displayMarkdownDiff(diff);
        break;
      case 'text':
      default:
        displayTextDiff(diff, verbose);
    }

    console.log();
  } catch (error: any) {
    console.log(chalk.red('✗ Error computing diff: ' + error.message));
  }
}

/**
 * Parse workspace configuration from file
 */
async function parseWorkspaceConfig(filePath: string): Promise<WorkspaceConfig | null> {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const { workspaceParser } = await import('../parsers/workspace-parser');
    const result = workspaceParser.parse(filePath);

    if (!result.valid || !result.config) {
      return null;
    }

    return result.config;
  } catch (error) {
    return null;
  }
}

/**
 * Compute diff between two workspace configurations
 */
function computeDiff(from: WorkspaceConfig, to: WorkspaceConfig, fromPath: string, toPath: string): WorkspaceDiff {
  const diff: WorkspaceDiff = {
    metadata: {
      from: fromPath,
      to: toPath,
      timestamp: new Date().toISOString(),
    },
    changes: {},
    summary: {
      added: 0,
      removed: 0,
      modified: 0,
    },
  };

  // Compare metadata
  diff.changes.metadata = compareValues(from, to, '');

  // Compare services
  diff.changes.services = compareServices(from.services || {}, to.services || {});

  // Compare dependencies
  if (from.dependencies || to.dependencies) {
    diff.changes.dependencies = compareValues(
      from.dependencies || {},
      to.dependencies || {},
      'dependencies'
    );
  }

  // Calculate summary
  for (const change of diff.changes.metadata || []) {
    if (change.type === 'added') diff.summary.added++;
    else if (change.type === 'removed') diff.summary.removed++;
    else if (change.type === 'modified') diff.summary.modified++;
  }

  for (const serviceChange of diff.changes.services || []) {
    if (serviceChange.type === 'added') diff.summary.added++;
    else if (serviceChange.type === 'removed') diff.summary.removed++;
    else if (serviceChange.type === 'modified') diff.summary.modified++;
  }

  return diff;
}

/**
 * Compare services between two configurations
 */
function compareServices(fromServices: Record<string, any>, toServices: Record<string, any>): ServiceChange[] {
  const changes: ServiceChange[] = [];
  const fromIds = new Set(Object.keys(fromServices));
  const toIds = new Set(Object.keys(toServices));

  // Find added services
  for (const id of toIds) {
    if (!fromIds.has(id)) {
      changes.push({
        type: 'added',
        serviceId: id,
        changes: [{ type: 'added', path: 'services.' + id, newValue: toServices[id] }],
      });
    }
  }

  // Find removed services
  for (const id of fromIds) {
    if (!toIds.has(id)) {
      changes.push({
        type: 'removed',
        serviceId: id,
        changes: [{ type: 'removed', path: 'services.' + id, oldValue: fromServices[id] }],
      });
    }
  }

  // Find modified services
  for (const id of fromIds) {
    if (toIds.has(id)) {
      const serviceChanges = compareValues(fromServices[id], toServices[id], 'services.' + id);
      if (serviceChanges.length > 0) {
        changes.push({
          type: 'modified',
          serviceId: id,
          changes: serviceChanges,
        });
      }
    }
  }

  return changes;
}

/**
 * Recursively compare two values and return changes
 */
function compareValues(from: any, to: any, basePath: string): ConfigChange[] {
  const changes: ConfigChange[] = [];

  // Handle null/undefined
  if (from === null || from === undefined) {
    if (to !== null && to !== undefined) {
      changes.push({ type: 'added', path: basePath, newValue: to });
    }
    return changes;
  }

  if (to === null || to === undefined) {
    changes.push({ type: 'removed', path: basePath, oldValue: from });
    return changes;
  }

  // Handle primitive types
  if (typeof from !== 'object' || typeof to !== 'object') {
    if (from !== to) {
      changes.push({ type: 'modified', path: basePath, oldValue: from, newValue: to });
    }
    return changes;
  }

  // Handle arrays
  if (Array.isArray(from) || Array.isArray(to)) {
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ type: 'modified', path: basePath, oldValue: from, newValue: to });
    }
    return changes;
  }

  // Handle objects
  const fromKeys = new Set(Object.keys(from));
  const toKeys = new Set(Object.keys(to));

  // Added keys
  for (const key of toKeys) {
    if (!fromKeys.has(key)) {
      changes.push({ type: 'added', path: basePath + '.' + key, newValue: to[key] });
    }
  }

  // Removed keys
  for (const key of fromKeys) {
    if (!toKeys.has(key)) {
      changes.push({ type: 'removed', path: basePath + '.' + key, oldValue: from[key] });
    }
  }

  // Modified keys
  for (const key of fromKeys) {
    if (toKeys.has(key)) {
      const nestedChanges = compareValues(from[key], to[key], basePath + '.' + key);
      changes.push(...nestedChanges);
    }
  }

  return changes;
}

/**
 * Display diff in text format
 */
function displayTextDiff(diff: WorkspaceDiff, verbose: boolean): void {
  console.log(chalk.bold('Summary:\n'));
  console.log('  Added: ' + chalk.green('+') + diff.summary.added);
  console.log('  Removed: ' + chalk.red('-') + diff.summary.removed);
  console.log('  Modified: ' + chalk.yellow('~') + diff.summary.modified + '\n');

  // Show service changes
  if (diff.changes.services && diff.changes.services.length > 0) {
    console.log(chalk.bold('Service Changes:\n'));

    for (const serviceChange of diff.changes.services) {
      const icon = serviceChange.type === 'added' ? chalk.green('+') :
                   serviceChange.type === 'removed' ? chalk.red('-') :
                   chalk.yellow('~');

      console.log(icon + ' ' + serviceChange.serviceId + ' (' + serviceChange.type + ')');

      if (verbose || serviceChange.type !== 'modified') {
        for (const change of serviceChange.changes) {
          if (change.type === 'added') {
            console.log(chalk.green('    + ' + change.path));
            if (verbose && change.newValue !== undefined) {
              console.log(chalk.gray('      ' + JSON.stringify(change.newValue).substring(0, 100)));
            }
          } else if (change.type === 'removed') {
            console.log(chalk.red('    - ' + change.path));
            if (verbose && change.oldValue !== undefined) {
              console.log(chalk.gray('      ' + JSON.stringify(change.oldValue).substring(0, 100)));
            }
          } else if (change.type === 'modified' && verbose) {
            console.log(chalk.yellow('    ~ ' + change.path));
            console.log(chalk.red('      - ' + JSON.stringify(change.oldValue)));
            console.log(chalk.green('      + ' + JSON.stringify(change.newValue)));
          }
        }
      }
      console.log();
    }
  }

  // Show metadata changes
  if (diff.changes.metadata && diff.changes.metadata.length > 0 && verbose) {
    console.log(chalk.bold('Metadata Changes:\n'));
    for (const change of diff.changes.metadata) {
      const icon = change.type === 'added' ? chalk.green('+') :
                   change.type === 'removed' ? chalk.red('-') :
                   chalk.yellow('~');
      console.log(icon + ' ' + change.path);
    }
    console.log();
  }

  // Show dependency changes
  if (diff.changes.dependencies && diff.changes.dependencies.length > 0 && verbose) {
    console.log(chalk.bold('Dependency Changes:\n'));
    for (const change of diff.changes.dependencies) {
      const icon = change.type === 'added' ? chalk.green('+') :
                   change.type === 'removed' ? chalk.red('-') :
                   chalk.yellow('~');
      console.log(icon + ' ' + change.path);
    }
    console.log();
  }

  if (diff.summary.added === 0 && diff.summary.removed === 0 && diff.summary.modified === 0) {
    console.log(chalk.gray('No changes detected.\n'));
  }
}

/**
 * Display diff in markdown format
 */
function displayMarkdownDiff(diff: WorkspaceDiff): void {
  let md = '# Workspace Configuration Diff\n\n';
  md += '**From:** ' + diff.metadata.from + '\n';
  md += '**To:** ' + diff.metadata.to + '\n';
  md += '**Timestamp:** ' + diff.metadata.timestamp + '\n\n';

  md += '## Summary\n\n';
  md += '- Added: ' + diff.summary.added + '\n';
  md += '- Removed: ' + diff.summary.removed + '\n';
  md += '- Modified: ' + diff.summary.modified + '\n\n';

  if (diff.changes.services && diff.changes.services.length > 0) {
    md += '## Service Changes\n\n';

    for (const serviceChange of diff.changes.services) {
      md += '### ' + serviceChange.serviceId + ' (' + serviceChange.type + ')\n\n';

      for (const change of serviceChange.changes) {
        if (change.type === 'added') {
          md += '- **Added:** ' + change.path + '\n';
          if (change.newValue !== undefined) {
            md += '  Value: `' + JSON.stringify(change.newValue) + '`\n';
          }
        } else if (change.type === 'removed') {
          md += '- **Removed:** ' + change.path + '\n';
          if (change.oldValue !== undefined) {
            md += '  Value: `' + JSON.stringify(change.oldValue) + '`\n';
          }
        } else if (change.type === 'modified') {
          md += '- **Modified:** ' + change.path + '\n';
          md += '  - Old: `' + JSON.stringify(change.oldValue) + '`\n';
          md += '  + New: `' + JSON.stringify(change.newValue) + '`\n';
        }
      }
      md += '\n';
    }
  }

  console.log(md);
}
