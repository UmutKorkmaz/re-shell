import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Dry-run capability with detailed change preview and impact analysis
 * Shows what would happen without making actual changes
 */

export interface FileChange {
  path: string;
  action: 'create' | 'update' | 'delete' | 'skip';
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  linesAdded?: number;
  linesRemoved?: number;
  changes?: string[];
}

export interface DryRunResult {
  summary: {
    totalChanges: number;
    filesCreated: number;
    filesUpdated: number;
    filesDeleted: number;
    filesSkipped: number;
    totalSize: number;
  };
  changes: FileChange[];
  impact: ImpactAnalysis;
  warnings: string[];
  conflicts: string[];
}

export interface ImpactAnalysis {
  dependencies: {
    added: string[];
    removed: string[];
    updated: string[];
  };
  scripts: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  configuration: {
    modified: string[];
    added: string[];
  };
  environment: string[];
  performance: {
    estimatedBuildTime?: string;
    estimatedBundleSize?: string;
    optimizationImpact?: string;
  };
}

export interface DryRunOptions {
  verbose?: boolean;
  showDiff?: boolean;
  analyzeImpact?: boolean;
  json?: boolean;
  includeContent?: boolean;
}

/**
 * Perform a dry run of a project generation operation
 */
export async function performDryRun(
  operations: {
    type: 'create' | 'update' | 'delete';
    path: string;
    content?: string;
    existingContent?: string;
  }[],
  options: DryRunOptions = {}
): Promise<DryRunResult> {
  const changes: FileChange[] = [];
  const warnings: string[] = [];
  const conflicts: string[] = [];

  let totalSize = 0;
  let filesCreated = 0;
  let filesUpdated = 0;
  let filesDeleted = 0;
  let filesSkipped = 0;

  console.log(chalk.cyan.bold('\n🔍 Dry Run Mode - Preview of Changes\n'));
  console.log(chalk.gray('Analyzing ' + operations.length + ' operation(s)...\n'));

  for (const op of operations) {
    const change = await analyzeOperation(op, options);
    changes.push(change);

    switch (change.action) {
      case 'create':
        filesCreated++;
        totalSize += change.size || 0;
        break;
      case 'update':
        filesUpdated++;
        totalSize += (change.size || 0) - (change.size || 0); // Net change
        break;
      case 'delete':
        filesDeleted++;
        break;
      case 'skip':
        filesSkipped++;
        warnings.push(`Skipped: ${change.path} - ${change.changes?.join(', ')}`);
        break;
    }

    // Check for conflicts
    if (op.type === 'create' && op.existingContent) {
      conflicts.push(`File already exists: ${op.path}`);
    }
  }

  // Analyze impact
  const impact = options.analyzeImpact ? await analyzeImpact(operations) : {
    dependencies: { added: [], removed: [], updated: [] },
    scripts: { added: [], removed: [], modified: [] },
    configuration: { modified: [], added: [] },
    environment: [],
    performance: {},
  };

  const result: DryRunResult = {
    summary: {
      totalChanges: filesCreated + filesUpdated + filesDeleted,
      filesCreated,
      filesUpdated,
      filesDeleted,
      filesSkipped,
      totalSize,
    },
    changes,
    impact,
    warnings,
    conflicts,
  };

  return result;
}

/**
 * Display dry run results
 */
export async function displayDryRunResults(result: DryRunResult, options: DryRunOptions = {}): Promise<void> {
  // JSON output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Summary section
  console.log(chalk.cyan.bold('📊 Summary\n'));
  console.log(chalk.white('Total Changes: ' + result.summary.totalChanges));
  console.log(chalk.green('  Files to create: ' + result.summary.filesCreated));
  console.log(chalk.yellow('  Files to update: ' + result.summary.filesUpdated));
  console.log(chalk.red('  Files to delete: ' + result.summary.filesDeleted));

  if (result.summary.filesSkipped > 0) {
    console.log(chalk.gray('  Files to skip: ' + result.summary.filesSkipped));
  }

  if (result.summary.totalSize > 0) {
    console.log(chalk.gray('  Total size: ' + formatBytes(result.summary.totalSize)));
  }

  console.log('');

  // Warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow.bold('⚠️  Warnings\n'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow('  ' + warning));
    }
    console.log('');
  }

  // Conflicts
  if (result.conflicts.length > 0) {
    console.log(chalk.red.bold('🔴 Conflicts\n'));
    for (const conflict of result.conflicts) {
      console.log(chalk.red('  ' + conflict));
    }
    console.log('');
  }

  // Detailed changes
  if (options.verbose && result.changes.length > 0) {
    console.log(chalk.cyan.bold('📁 File Changes\n'));

    for (const change of result.changes) {
      const icon = {
        create: chalk.green('✓'),
        update: chalk.yellow('→'),
        delete: chalk.red('✗'),
        skip: chalk.gray('○'),
      }[change.action];

      console.log(`${icon} ${change.action.toUpperCase()}: ${change.path}`);

      if (change.size !== undefined) {
        console.log(chalk.gray(`    Size: ${formatBytes(change.size)}`));
      }

      if (change.linesAdded !== undefined || change.linesRemoved !== undefined) {
        const added = change.linesAdded || 0;
        const removed = change.linesRemoved || 0;
        console.log(chalk.gray(`    Lines: +${added} -${removed}`));
      }

      if (change.changes && change.changes.length > 0) {
        console.log(chalk.gray(`    Details: ${change.changes.join(', ')}`));
      }

      console.log('');
    }
  }

  // Impact analysis
  if (options.analyzeImpact) {
    displayImpactAnalysis(result.impact);
  }
}

/**
 * Analyze potential impact of changes
 */
async function analyzeImpact(
  operations: {
    type: 'create' | 'update' | 'delete';
    path: string;
    content?: string;
  }[]
): Promise<ImpactAnalysis> {
  const impact: ImpactAnalysis = {
    dependencies: { added: [], removed: [], updated: [] },
    scripts: { added: [], removed: [], modified: [] },
    configuration: { modified: [], added: [] },
    environment: [],
    performance: {},
  };

  for (const op of operations) {
    if (!op.content) continue;

    // Check for package.json changes
    if (op.path.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(op.content);

        // Dependencies
        if (pkg.dependencies) {
          impact.dependencies.added.push(...Object.keys(pkg.dependencies));
        }

        if (pkg.devDependencies) {
          impact.dependencies.added.push(...Object.keys(pkg.devDependencies));
        }

        // Scripts
        if (pkg.scripts) {
          impact.scripts.added.push(...Object.keys(pkg.scripts));
        }
      } catch (error) {
        // Invalid JSON, skip
      }
    }

    // Check for environment variable files
    if (op.path.endsWith('.env') || op.path.endsWith('.env.example')) {
      const envVars = op.content.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split('=')[0]);

      impact.environment.push(...envVars);
    }

    // Check for config files
    if (op.path.includes('config') || op.path.endsWith('.config.js') || op.path.endsWith('.config.ts')) {
      impact.configuration.modified.push(op.path);
    }
  }

  // Performance impact estimation
  const hasTypeScript = operations.some(op => op.path.endsWith('.ts') || op.path.endsWith('.tsx'));
  const hasBuildTool = operations.some(op => op.content?.includes('vite') || op.content?.includes('webpack'));

  if (hasBuildTool) {
    if (hasTypeScript) {
      impact.performance.optimizationImpact = 'TypeScript + build tool: optimal performance';
      impact.performance.estimatedBuildTime = '2-5s initial, <1s incremental';
    } else {
      impact.performance.optimizationImpact = 'Build tool configured: improved performance';
      impact.performance.estimatedBuildTime = '1-3s initial, <500ms incremental';
    }
  }

  return impact;
}

/**
 * Display impact analysis
 */
function displayImpactAnalysis(impact: ImpactAnalysis): void {
  console.log(chalk.cyan.bold('💡 Impact Analysis\n'));

  // Dependencies
  if (impact.dependencies.added.length > 0) {
    console.log(chalk.white('Dependencies to add:'));
    console.log(chalk.gray('  ' + impact.dependencies.added.slice(0, 10).join(', ')));
    if (impact.dependencies.added.length > 10) {
      console.log(chalk.gray(`  ... and ${impact.dependencies.added.length - 10} more`));
    }
    console.log('');
  }

  // Scripts
  if (impact.scripts.added.length > 0) {
    console.log(chalk.white('Scripts to add:'));
    for (const script of impact.scripts.added.slice(0, 5)) {
      console.log(chalk.gray(`  ${script}`));
    }
    if (impact.scripts.added.length > 5) {
      console.log(chalk.gray(`  ... and ${impact.scripts.added.length - 5} more`));
    }
    console.log('');
  }

  // Environment variables
  if (impact.environment.length > 0) {
    console.log(chalk.white('Environment variables:'));
    for (const envVar of impact.environment.slice(0, 5)) {
      console.log(chalk.gray(`  ${envVar}`));
    }
    if (impact.environment.length > 5) {
      console.log(chalk.gray(`  ... and ${impact.environment.length - 5} more`));
    }
    console.log('');
  }

  // Performance
  if (impact.performance.estimatedBuildTime || impact.performance.optimizationImpact) {
    console.log(chalk.white('Performance impact:'));
    if (impact.performance.estimatedBuildTime) {
      console.log(chalk.gray(`  Build time: ${impact.performance.estimatedBuildTime}`));
    }
    if (impact.performance.optimizationImpact) {
      console.log(chalk.gray(`  ${impact.performance.optimizationImpact}`));
    }
    console.log('');
  }
}

/**
 * Analyze a single operation
 */
async function analyzeOperation(
  op: {
    type: 'create' | 'update' | 'delete';
    path: string;
    content?: string;
    existingContent?: string;
  },
  options: DryRunOptions
): Promise<FileChange> {
  const change: FileChange = {
    path: op.path,
    action: 'create',
    type: 'file',
  };

  if (op.type === 'delete') {
    change.action = 'delete';
    return change;
  }

  // Check if file exists
  const exists = await fs.pathExists(op.path);

  if (op.type === 'create') {
    if (exists && !op.existingContent) {
      // File exists and will be overwritten
      change.action = 'update';
    } else if (exists && op.existingContent) {
      // Skip if content is same
      if (op.content === op.existingContent) {
        change.action = 'skip';
        change.changes = ['No changes - content identical'];
        return change;
      }
    }

    // Calculate size
    if (op.content) {
      change.size = op.content.length;
    }

    // Calculate line changes
    if (op.existingContent && op.content) {
      const oldLines = op.existingContent.split('\n').length;
      const newLines = op.content.split('\n').length;
      change.linesRemoved = oldLines;
      change.linesAdded = newLines;

      // Detect what changed
      const changes: string[] = [];
      if (oldLines !== newLines) {
        changes.push(`Line count: ${oldLines} → ${newLines}`);
      }
      if (op.existingContent.length !== op.content.length) {
        const sizeDiff = op.content.length - op.existingContent.length;
        changes.push(`Size: ${formatBytes(Math.abs(sizeDiff))} ${sizeDiff > 0 ? 'increase' : 'decrease'}`);
      }
      change.changes = changes;
    }
  }

  return change;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Confirm before applying changes
 */
export async function confirmDryRun(result: DryRunResult): Promise<boolean> {
  console.log(chalk.cyan.bold('\n❓ Confirm Changes\n'));
  console.log(chalk.gray(`About to make ${result.summary.totalChanges} change(s).\n`));

  if (result.conflicts.length > 0) {
    console.log(chalk.red.bold('⚠️  Conflicts detected!'));
    console.log(chalk.yellow('Review conflicts above before proceeding.\n'));
  }

  const prompts = await import('prompts');
  const { value } = await prompts.default({
    type: 'confirm',
    name: 'value',
    message: 'Apply these changes?',
    initial: false,
  });

  return value;
}
