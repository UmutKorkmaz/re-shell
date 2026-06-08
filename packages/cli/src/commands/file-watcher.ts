import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  FileWatcher,
  FileWatchEvent,
  PropagationEvent,
  WatchOptions,
  ChangePropagationRule,
  WatcherStats,
  createFileWatcher,
  startWorkspaceWatcher
} from '../utils/file-watcher';
import { createSpinner, ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface FileWatcherCommandOptions {
  start?: boolean;
  stop?: boolean;
  status?: boolean;
  stats?: boolean;
  rules?: boolean;
  addRule?: boolean;
  removeRule?: string;
  interactive?: boolean;
  
  // Watch options
  workspaceFile?: string;
  usePolling?: boolean;
  interval?: number;
  ignored?: string[];
  depth?: number;
  persistent?: boolean;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  follow?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';
let globalWatcher: FileWatcher | null = null;

export async function manageFileWatcher(options: FileWatcherCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.start) {
      await startFileWatcher(options, spinner);
      return;
    }

    if (options.stop) {
      await stopFileWatcher(options, spinner);
      return;
    }

    if (options.status) {
      await showWatcherStatus(options, spinner);
      return;
    }

    if (options.stats) {
      await showWatcherStats(options, spinner);
      return;
    }

    if (options.rules) {
      await showPropagationRules(options, spinner);
      return;
    }

    if (options.addRule) {
      await addPropagationRule(options, spinner);
      return;
    }

    if (options.removeRule) {
      await removePropagationRule(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveFileWatcher(options, spinner);
      return;
    }

    // Default: show status
    await showWatcherStatus(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('File watcher operation failed'));
    throw error;
  }
}

async function startFileWatcher(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  if (!(await fs.pathExists(workspaceFile))) {
    throw new ValidationError(`Workspace file not found: ${workspaceFile}`);
  }

  if (globalWatcher && globalWatcher.isWatching()) {
    throw new ValidationError('File watcher is already running. Stop it first with --stop');
  }

  if (spinner) spinner.setText('Starting file watcher...');

  try {
    const watchOptions: WatchOptions = {
      usePolling: options.usePolling,
      interval: options.interval || 1000,
      depth: options.depth,
      persistent: options.persistent ?? true,
      ignored: options.ignored || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.re-shell/**'
      ]
    };

    globalWatcher = await startWorkspaceWatcher(workspaceFile, watchOptions);

    // Set up event handlers
    setupWatcherEventHandlers(globalWatcher, options);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        status: 'started',
        timestamp: Date.now(),
        stats: globalWatcher.getStats()
      }, null, 2));
      return;
    }

    console.log(chalk.green('\\n✅ File watcher started successfully!'));
    console.log(chalk.gray('═'.repeat(50)));

    const stats = globalWatcher.getStats();
    console.log(`Watching: ${chalk.blue(stats.watchedPaths.length)} paths`);
    console.log(`Active rules: ${chalk.blue(stats.activeRules)}`);

    if (options.verbose) {
      console.log(chalk.cyan('\\n📁 Watched paths:'));
      for (const watchPath of stats.watchedPaths) {
        console.log(`  • ${watchPath}`);
      }
    }

    if (options.follow) {
      console.log(chalk.cyan('\\n👀 Watching for changes... (Press Ctrl+C to stop)'));
      
      // Keep the process alive and show events
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\\n\\n⏹️  Stopping file watcher...'));
        if (globalWatcher) {
          await globalWatcher.stopWatching();
        }
        process.exit(0);
      });

      // Prevent the process from exiting
      setInterval(() => { /* keep alive */ }, 1000);
    } else {
      console.log(chalk.cyan('\\n🛠️  Commands:'));
      console.log('  • Show status: re-shell file-watcher status');
      console.log('  • Show stats: re-shell file-watcher stats');
      console.log('  • Stop watching: re-shell file-watcher stop');
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to start file watcher'));
    throw error;
  }
}

async function stopFileWatcher(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!globalWatcher || !globalWatcher.isWatching()) {
    throw new ValidationError('No active file watcher found');
  }

  if (spinner) spinner.setText('Stopping file watcher...');

  try {
    await globalWatcher.stopWatching();
    const finalStats = globalWatcher.getStats();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        status: 'stopped',
        timestamp: Date.now(),
        finalStats
      }, null, 2));
      return;
    }

    console.log(chalk.green('\\n✅ File watcher stopped successfully!'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`Uptime: ${formatDuration(finalStats.uptime / 1000)}`);
    console.log(`Total events: ${chalk.blue(finalStats.totalEvents)}`);
    console.log(`Propagated events: ${chalk.blue(finalStats.propagatedEvents)}`);

    if (options.verbose) {
      console.log(chalk.cyan('\\n📊 Event breakdown:'));
      for (const [type, count] of Object.entries(finalStats.eventsByType)) {
        if (count > 0) {
          console.log(`  • ${type}: ${count}`);
        }
      }
    }

    globalWatcher = null;

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to stop file watcher'));
    throw error;
  }
}

async function showWatcherStatus(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Checking watcher status...');

  try {
    const isActive = globalWatcher && globalWatcher.isWatching();
    
    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        active: isActive,
        stats: isActive ? globalWatcher!.getStats() : null,
        timestamp: Date.now()
      }, null, 2));
      return;
    }

    if (!isActive) {
      console.log(chalk.yellow('\\n⏸️  File watcher is not running'));
      console.log(chalk.gray('Start it with: re-shell file-watcher start'));
      return;
    }

    const stats = globalWatcher!.getStats();
    console.log(chalk.green('\\n✅ File watcher is active'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`Status: ${chalk.green('Running')}`);
    console.log(`Uptime: ${formatDuration((Date.now() - stats.startTime) / 1000)}`);
    console.log(`Watched paths: ${chalk.blue(stats.watchedPaths.length)}`);
    console.log(`Active rules: ${chalk.blue(stats.activeRules)}`);
    console.log(`Total events: ${chalk.blue(stats.totalEvents)}`);
    console.log(`Propagated events: ${chalk.blue(stats.propagatedEvents)}`);

    if (options.verbose && stats.watchedPaths.length > 0) {
      console.log(chalk.cyan('\\n📁 Watched paths:'));
      for (const watchPath of stats.watchedPaths) {
        console.log(`  • ${watchPath}`);
      }
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to get watcher status'));
    throw error;
  }
}

async function showWatcherStats(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!globalWatcher || !globalWatcher.isWatching()) {
    throw new ValidationError('No active file watcher found');
  }

  if (spinner) spinner.setText('Gathering statistics...');

  try {
    const stats = globalWatcher.getStats();
    
    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n📊 File Watcher Statistics'));
    console.log(chalk.gray('═'.repeat(50)));

    // Overview
    console.log(chalk.cyan('\\nOverview:'));
    console.log(`  Total events: ${chalk.blue(stats.totalEvents)}`);
    console.log(`  Propagated events: ${chalk.blue(stats.propagatedEvents)}`);
    console.log(`  Watched paths: ${chalk.blue(stats.watchedPaths.length)}`);
    console.log(`  Active rules: ${chalk.blue(stats.activeRules)}`);
    console.log(`  Uptime: ${formatDuration(stats.uptime / 1000)}`);

    // Events by type
    if (stats.totalEvents > 0) {
      console.log(chalk.cyan('\\nEvents by type:'));
      for (const [type, count] of Object.entries(stats.eventsByType)) {
        if (count > 0) {
          const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
          console.log(`  • ${type}: ${chalk.blue(count)} (${percentage}%)`);
        }
      }
    }

    // Events by workspace
    if (Object.keys(stats.eventsByWorkspace).length > 0) {
      console.log(chalk.cyan('\\nEvents by workspace:'));
      const sortedWorkspaces = Object.entries(stats.eventsByWorkspace)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10

      for (const [workspace, count] of sortedWorkspaces) {
        const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
        console.log(`  • ${workspace}: ${chalk.blue(count)} (${percentage}%)`);
      }

      if (Object.keys(stats.eventsByWorkspace).length > 10) {
        console.log(`  ... and ${Object.keys(stats.eventsByWorkspace).length - 10} more`);
      }
    }

    // Performance metrics
    if (stats.totalEvents > 0 && stats.uptime > 0) {
      const eventsPerSecond = (stats.totalEvents / (stats.uptime / 1000)).toFixed(2);
      const propagationRate = ((stats.propagatedEvents / stats.totalEvents) * 100).toFixed(1);
      
      console.log(chalk.cyan('\\nPerformance:'));
      console.log(`  Events/second: ${chalk.blue(eventsPerSecond)}`);
      console.log(`  Propagation rate: ${chalk.blue(propagationRate)}%`);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to get watcher statistics'));
    throw error;
  }
}

async function showPropagationRules(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!globalWatcher) {
    throw new ValidationError('No file watcher instance available');
  }

  if (spinner) spinner.setText('Loading propagation rules...');

  try {
    // Access private propagationRules through reflection (for demo purposes)
    // In production, you'd add a public getter method
    const rules = Array.from((globalWatcher as any).propagationRules.values()) as ChangePropagationRule[];
    
    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(rules, null, 2));
      return;
    }

    if (rules.length === 0) {
      console.log(chalk.yellow('\\n📋 No propagation rules configured'));
      console.log(chalk.gray('Add rules with: re-shell file-watcher add-rule'));
      return;
    }

    console.log(chalk.cyan('\\n📋 Change Propagation Rules'));
    console.log(chalk.gray('═'.repeat(50)));

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      console.log(`\\n${i + 1}. ${chalk.bold(rule.name)}`);
      console.log(`   ID: ${chalk.gray(rule.id)}`);
      console.log(`   Pattern: ${chalk.blue(rule.sourcePattern.toString())}`);
      console.log(`   Action: ${chalk.green(rule.actionType)}`);
      console.log(`   Targets: ${formatTargetWorkspaces(rule.targetWorkspaces)}`);
      
      if (rule.debounceMs) {
        console.log(`   Debounce: ${chalk.yellow(rule.debounceMs)}ms`);
      }
      
      if (options.verbose) {
        console.log(`   Description: ${chalk.gray(rule.description)}`);
      }
    }

    console.log(chalk.cyan('\\n🛠️  Commands:'));
    console.log('  • Add rule: re-shell file-watcher add-rule');
    console.log('  • Remove rule: re-shell file-watcher remove-rule <id>');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to load propagation rules'));
    throw error;
  }
}

async function addPropagationRule(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!globalWatcher) {
    throw new ValidationError('No file watcher instance available');
  }

  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Rule ID:',
      validate: (value: string) => value.length > 0 ? true : 'ID is required'
    },
    {
      type: 'text',
      name: 'name',
      message: 'Rule name:',
      validate: (value: string) => value.length > 0 ? true : 'Name is required'
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description:'
    },
    {
      type: 'text',
      name: 'pattern',
      message: 'Source pattern (regex or string):',
      validate: (value: string) => value.length > 0 ? true : 'Pattern is required'
    },
    {
      type: 'select',
      name: 'actionType',
      message: 'Action type:',
      choices: [
        { title: 'Rebuild', value: 'rebuild' },
        { title: 'Restart dev server', value: 'restart-dev' },
        { title: 'Run tests', value: 'run-tests' },
        { title: 'Invalidate cache', value: 'invalidate-cache' },
        { title: 'Notify only', value: 'notify' },
        { title: 'Custom', value: 'custom' }
      ]
    },
    {
      type: 'select',
      name: 'targetType',
      message: 'Target workspaces:',
      choices: [
        { title: 'All workspaces', value: 'all' },
        { title: 'Specific workspaces', value: 'specific' },
        { title: 'By condition', value: 'condition' }
      ]
    },
    {
      type: prev => prev === 'specific' ? 'text' : null,
      name: 'targetWorkspaces',
      message: 'Workspace names (comma-separated):'
    },
    {
      type: 'number',
      name: 'debounceMs',
      message: 'Debounce time (ms):',
      initial: 1000,
      min: 0
    }
  ]);

  if (!response.id || !response.name || !response.pattern) return;

  try {
    // Parse pattern as regex if it looks like one
    let sourcePattern: RegExp | string = response.pattern;
    if (response.pattern.startsWith('/') && response.pattern.endsWith('/')) {
      sourcePattern = new RegExp(response.pattern.slice(1, -1));
    } else if (response.pattern.includes('\\\\')) {
      try {
        sourcePattern = new RegExp(response.pattern);
      } catch {
        // Keep as string if regex parsing fails
      }
    }

    // Resolve target workspaces
    let targetWorkspaces: any = 'all';
    if (response.targetType === 'specific' && response.targetWorkspaces) {
      targetWorkspaces = response.targetWorkspaces.split(',').map((s: string) => s.trim());
    } else if (response.targetType === 'condition') {
      targetWorkspaces = () => true; // Simple condition for demo
    }

    const rule: ChangePropagationRule = {
      id: response.id,
      name: response.name,
      description: response.description || '',
      sourcePattern,
      targetWorkspaces,
      actionType: response.actionType,
      debounceMs: response.debounceMs > 0 ? response.debounceMs : undefined
    };

    globalWatcher.addPropagationRule(rule);

    console.log(chalk.green('\\n✅ Propagation rule added successfully!'));
    console.log(`Rule ID: ${chalk.blue(rule.id)}`);

  } catch (error) {
    throw new ValidationError(`Failed to add propagation rule: ${(error as Error).message}`);
  }
}

async function removePropagationRule(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!globalWatcher) {
    throw new ValidationError('No file watcher instance available');
  }

  if (!options.removeRule) {
    throw new ValidationError('Rule ID is required for removal');
  }

  if (spinner) spinner.setText('Removing propagation rule...');

  try {
    const removed = globalWatcher.removePropagationRule(options.removeRule);
    
    if (spinner) spinner.stop();

    if (removed) {
      console.log(chalk.green('\\n✅ Propagation rule removed successfully!'));
      console.log(`Removed rule: ${chalk.blue(options.removeRule)}`);
    } else {
      console.log(chalk.yellow('\\n⚠️  Rule not found'));
      console.log(`Rule ID: ${chalk.blue(options.removeRule)}`);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to remove propagation rule'));
    throw error;
  }
}

async function interactiveFileWatcher(options: FileWatcherCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '▶️  Start file watcher', value: 'start' },
        { title: '⏹️  Stop file watcher', value: 'stop' },
        { title: '📊 Show status', value: 'status' },
        { title: '📈 Show statistics', value: 'stats' },
        { title: '📋 Show propagation rules', value: 'rules' },
        { title: '➕ Add propagation rule', value: 'add-rule' },
        { title: '➖ Remove propagation rule', value: 'remove-rule' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'start':
      await startInteractive(options);
      break;
    case 'stop':
      await stopFileWatcher({ ...options, interactive: false });
      break;
    case 'status':
      await showWatcherStatus({ ...options, interactive: false });
      break;
    case 'stats':
      await showWatcherStats({ ...options, interactive: false });
      break;
    case 'rules':
      await showPropagationRules({ ...options, interactive: false });
      break;
    case 'add-rule':
      await addPropagationRule({ ...options, interactive: false });
      break;
    case 'remove-rule':
      await removeRuleInteractive(options);
      break;
  }
}

async function startInteractive(options: FileWatcherCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'workspaceFile',
      message: 'Workspace file:',
      initial: 're-shell.workspaces.yaml'
    },
    {
      type: 'confirm',
      name: 'usePolling',
      message: 'Use polling (for network drives)?',
      initial: false
    },
    {
      type: prev => prev ? 'number' : null,
      name: 'interval',
      message: 'Polling interval (ms):',
      initial: 1000,
      min: 100
    },
    {
      type: 'confirm',
      name: 'follow',
      message: 'Follow changes in real-time?',
      initial: true
    }
  ]);

  if (!response.workspaceFile) return;

  await startFileWatcher({
    ...options,
    ...response,
    interactive: false
  });
}

async function removeRuleInteractive(options: FileWatcherCommandOptions): Promise<void> {
  if (!globalWatcher) {
    throw new ValidationError('No file watcher instance available');
  }

  const rules = Array.from((globalWatcher as any).propagationRules.values()) as ChangePropagationRule[];

  if (rules.length === 0) {
    console.log(chalk.yellow('\\n📋 No propagation rules to remove'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'ruleId',
      message: 'Select rule to remove:',
      choices: rules.map(rule => ({
        title: `${rule.name} (${rule.id})`,
        value: rule.id,
        description: rule.description
      }))
    }
  ]);

  if (!response.ruleId) return;

  await removePropagationRule({
    ...options,
    removeRule: response.ruleId,
    interactive: false
  });
}

// Set up event handlers for the watcher
function setupWatcherEventHandlers(watcher: FileWatcher, options: FileWatcherCommandOptions): void {
  watcher.on('file-event', (event: FileWatchEvent) => {
    if (options.verbose || options.follow) {
      const icon = getEventIcon(event.type);
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      console.log(`${icon} ${chalk.gray(timestamp)} ${chalk.blue(event.workspace)} ${event.path}`);
    }
  });

  watcher.on('propagate', (event: PropagationEvent) => {
    if (options.verbose || options.follow) {
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      console.log(`🔄 ${chalk.gray(timestamp)} ${chalk.green(event.actionType)} → ${event.targetWorkspaces.join(', ')}`);
    }
  });

  watcher.on('error', (error: Error) => {
    console.error(chalk.red(`❌ Watcher error: ${error.message}`));
  });

  watcher.on('warning', (message: string) => {
    if (options.verbose) {
      console.warn(chalk.yellow(`⚠️  ${message}`));
    }
  });
}

// Utility functions
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function formatTargetWorkspaces(target: any): string {
  if (target === 'all') {
    return chalk.blue('all');
  } else if (Array.isArray(target)) {
    return chalk.blue(target.join(', '));
  } else if (typeof target === 'function') {
    return chalk.blue('conditional');
  }
  return chalk.gray('unknown');
}

function getEventIcon(type: string): string {
  switch (type) {
    case 'add': return '➕';
    case 'change': return '📝';
    case 'unlink': return '➖';
    case 'addDir': return '📁';
    case 'unlinkDir': return '🗂️';
    default: return '📄';
  }
}