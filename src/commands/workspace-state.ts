import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  WorkspaceStateManager,
  WorkspaceCacheManager,
  createWorkspaceStateManager,
  createWorkspaceCacheManager,
  initializeWorkspaceStorage
} from '../utils/workspace-state';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceStateCommandOptions {
  status?: boolean;
  clear?: boolean;
  backup?: boolean;
  restore?: boolean;
  cache?: boolean;
  optimize?: boolean;
  interactive?: boolean;
  
  // File options
  file?: string;
  output?: string;
  
  // Cache options
  pattern?: string;
  
  // State options
  workspace?: string;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceState(options: WorkspaceStateCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.status) {
      await showStateStatus(options, spinner);
      return;
    }

    if (options.clear) {
      await clearWorkspaceState(options, spinner);
      return;
    }

    if (options.backup) {
      await backupWorkspaceState(options, spinner);
      return;
    }

    if (options.restore) {
      await restoreWorkspaceState(options, spinner);
      return;
    }

    if (options.cache) {
      await manageCacheOperations(options, spinner);
      return;
    }

    if (options.optimize) {
      await optimizeWorkspaceStorage(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveStateManagement(options, spinner);
      return;
    }

    // Default: show state status
    await showStateStatus(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Workspace state operation failed'));
    throw error;
  }
}

async function showStateStatus(options: WorkspaceStateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading workspace state information...');

  try {
    const { stateManager, cacheManager } = await initializeWorkspaceStorage();
    
    const stateStats = stateManager.getStateStatistics();
    const cacheStats = cacheManager.getCacheStatistics();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        state: stateStats,
        cache: cacheStats
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\n💾 Workspace State & Cache Status'));
    console.log(chalk.gray('═'.repeat(50)));

    // State information
    console.log(chalk.cyan('\n📊 State Information:'));
    console.log(`  Workspaces tracked: ${chalk.green(stateStats.workspaceCount)}`);
    console.log(`  Last modified: ${chalk.gray(new Date(stateStats.lastModified).toLocaleString())}`);
    console.log(`  State file size: ${chalk.yellow(formatBytes(stateStats.stateFileSize))}`);
    
    if (stateStats.oldestWorkspace && stateStats.newestWorkspace) {
      console.log(`  Oldest workspace: ${chalk.gray(stateStats.oldestWorkspace)}`);
      console.log(`  Newest workspace: ${chalk.gray(stateStats.newestWorkspace)}`);
    }

    // Cache information
    console.log(chalk.cyan('\n🗄️  Cache Information:'));
    console.log(`  Total entries: ${chalk.green(cacheStats.totalEntries)}`);
    console.log(`  Memory entries: ${chalk.yellow(cacheStats.memoryEntries)}`);
    console.log(`  Total size: ${chalk.yellow(formatBytes(cacheStats.totalSize))}`);
    console.log(`  Hit rate: ${getHitRateColor(cacheStats.hitRate)}${(cacheStats.hitRate * 100).toFixed(1)}%${chalk.reset()}`);
    console.log(`  Last optimized: ${chalk.gray(new Date(cacheStats.lastOptimized).toLocaleString())}`);

    // Usage suggestions
    console.log(chalk.cyan('\n🛠️  Available Commands:'));
    console.log('  • re-shell workspace-state clear');
    console.log('  • re-shell workspace-state backup');
    console.log('  • re-shell workspace-state cache clear');
    console.log('  • re-shell workspace-state optimize');
    console.log('  • re-shell workspace-state interactive');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to load state information'));
    throw error;
  }
}

async function clearWorkspaceState(options: WorkspaceStateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Clearing workspace state...');

  try {
    const stateManager = await createWorkspaceStateManager();
    await stateManager.clearState();

    if (spinner) spinner.stop();

    console.log(chalk.green('✅ Workspace state cleared successfully'));
    console.log(chalk.gray('All workspace tracking data has been reset'));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to clear workspace state'));
    throw error;
  }
}

async function backupWorkspaceState(options: WorkspaceStateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Creating workspace state backup...');

  try {
    const stateManager = await createWorkspaceStateManager();
    const backupPath = await stateManager.backupState(options.output);

    if (spinner) spinner.stop();

    console.log(chalk.green('✅ Workspace state backup created'));
    console.log(chalk.gray(`Backup saved to: ${backupPath}`));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to create state backup'));
    throw error;
  }
}

async function restoreWorkspaceState(options: WorkspaceStateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.file) {
    throw new ValidationError('Backup file path is required for restore operation');
  }

  if (spinner) spinner.setText(`Restoring workspace state from ${options.file}...`);

  try {
    const stateManager = await createWorkspaceStateManager();
    await stateManager.restoreState(options.file);

    if (spinner) spinner.stop();

    console.log(chalk.green('✅ Workspace state restored successfully'));
    console.log(chalk.gray(`Restored from: ${options.file}`));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to restore workspace state'));
    throw error;
  }
}

async function manageCacheOperations(options: WorkspaceStateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  try {
    const cacheManager = await createWorkspaceCacheManager();

    if (options.clear) {
      if (spinner) spinner.setText('Clearing workspace cache...');
      await cacheManager.clear();
      if (spinner) spinner.stop();
      console.log(chalk.green('✅ Workspace cache cleared successfully'));
      return;
    }

    if (options.pattern) {
      if (spinner) spinner.setText(`Invalidating cache entries matching: ${options.pattern}...`);
      const invalidated = await cacheManager.invalidatePattern(options.pattern);
      if (spinner) spinner.stop();
      console.log(chalk.green(`✅ Invalidated ${invalidated} cache entries`));
      return;
    }

    // Default: show cache status
    const stats = cacheManager.getCacheStatistics();
    
    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🗄️  Cache Statistics'));
    console.log(chalk.gray('═'.repeat(40)));
    console.log(`Total entries: ${chalk.green(stats.totalEntries)}`);
    console.log(`Memory entries: ${chalk.yellow(stats.memoryEntries)}`);
    console.log(`Total size: ${chalk.yellow(formatBytes(stats.totalSize))}`);
    console.log(`Hit rate: ${getHitRateColor(stats.hitRate)}${(stats.hitRate * 100).toFixed(1)}%${chalk.reset()}`);
    console.log(`Miss rate: ${chalk.red((stats.missRate * 100).toFixed(1))}%`);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Cache operation failed'));
    throw error;
  }
}

async function optimizeWorkspaceStorage(options: WorkspaceStateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Optimizing workspace storage...');

  try {
    const cacheManager = await createWorkspaceCacheManager();
    const result = await cacheManager.optimize();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.green('✅ Workspace storage optimized'));
    console.log(`Removed entries: ${chalk.yellow(result.removedEntries)}`);
    console.log(`Freed space: ${chalk.yellow(formatBytes(result.freedSpace))}`);

    if (result.removedEntries === 0) {
      console.log(chalk.gray('No expired entries found to remove'));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Storage optimization failed'));
    throw error;
  }
}

async function interactiveStateManagement(options: WorkspaceStateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '📊 Show state & cache status', value: 'status' },
        { title: '🗑️  Clear workspace state', value: 'clear-state' },
        { title: '🗑️  Clear cache', value: 'clear-cache' },
        { title: '💾 Backup state', value: 'backup' },
        { title: '📂 Restore state', value: 'restore' },
        { title: '🧹 Optimize storage', value: 'optimize' },
        { title: '🔍 Cache pattern cleanup', value: 'pattern-cleanup' },
        { title: '📈 Detailed statistics', value: 'detailed-stats' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'status':
      await showStateStatus({ ...options, interactive: false });
      break;
    case 'clear-state':
      await clearWorkspaceState({ ...options, interactive: false });
      break;
    case 'clear-cache':
      await manageCacheOperations({ ...options, interactive: false, cache: true, clear: true });
      break;
    case 'backup':
      await backupWorkspaceState({ ...options, interactive: false });
      break;
    case 'restore':
      {
      const restoreResponse = await prompts({
        type: 'text',
        name: 'file',
        message: 'Enter backup file path:'
      });
      if (restoreResponse.file) {
        await restoreWorkspaceState({ ...options, interactive: false, file: restoreResponse.file });
      }
      break;
      }
    case 'optimize':
      await optimizeWorkspaceStorage({ ...options, interactive: false });
      break;
    case 'pattern-cleanup':
      {
      const patternResponse = await prompts({
        type: 'text',
        name: 'pattern',
        message: 'Enter pattern to match (regex supported):'
      });
      if (patternResponse.pattern) {
        await manageCacheOperations({ 
          ...options, 
          interactive: false, 
          cache: true, 
          pattern: patternResponse.pattern 
        });
      }
      break;
      }
    case 'detailed-stats':
      await showDetailedStatistics(options);
      break;
  }
}

async function showDetailedStatistics(options: WorkspaceStateCommandOptions): Promise<void> {
  try {
    const { stateManager, cacheManager } = await initializeWorkspaceStorage();
    
    const stateStats = stateManager.getStateStatistics();
    const cacheStats = cacheManager.getCacheStatistics();

    console.log(chalk.cyan('\n📊 Detailed Workspace Storage Statistics'));
    console.log(chalk.gray('═'.repeat(60)));

    // State details
    console.log(chalk.cyan('\n💾 State Management:'));
    console.log(`  Workspaces tracked: ${chalk.green(stateStats.workspaceCount)}`);
    console.log(`  State file size: ${chalk.yellow(formatBytes(stateStats.stateFileSize))}`);
    console.log(`  Last modified: ${chalk.gray(new Date(stateStats.lastModified).toLocaleString())}`);

    // Cache details
    console.log(chalk.cyan('\n🗄️  Cache Performance:'));
    console.log(`  Total entries: ${chalk.green(cacheStats.totalEntries)}`);
    console.log(`  Memory entries: ${chalk.yellow(cacheStats.memoryEntries)}`);
    console.log(`  Disk entries: ${chalk.gray(cacheStats.totalEntries - cacheStats.memoryEntries)}`);
    console.log(`  Total size: ${chalk.yellow(formatBytes(cacheStats.totalSize))}`);
    console.log(`  Hit rate: ${getHitRateColor(cacheStats.hitRate)}${(cacheStats.hitRate * 100).toFixed(2)}%${chalk.reset()}`);
    console.log(`  Miss rate: ${chalk.red((cacheStats.missRate * 100).toFixed(2))}%`);
    console.log(`  Last optimized: ${chalk.gray(new Date(cacheStats.lastOptimized).toLocaleString())}`);

    // Performance recommendations
    console.log(chalk.cyan('\n💡 Performance Recommendations:'));
    
    if (cacheStats.hitRate < 0.7) {
      console.log(chalk.yellow('  • Consider increasing cache TTL values'));
    }
    
    if (cacheStats.totalSize > 100 * 1024 * 1024) { // 100MB
      console.log(chalk.yellow('  • Cache is getting large, consider optimization'));
    }
    
    if (cacheStats.memoryEntries / Math.max(cacheStats.totalEntries, 1) < 0.1) {
      console.log(chalk.yellow('  • Low memory cache usage, may need tuning'));
    }
    
    console.log(chalk.green('  • Regular optimization helps maintain performance'));

  } catch (error) {
    console.error(chalk.red('Failed to load detailed statistics'));
    throw error;
  }
}

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

function getHitRateColor(rate: number): typeof chalk.green {
  if (rate >= 0.8) return chalk.green;
  if (rate >= 0.6) return chalk.yellow;
  return chalk.red;
}