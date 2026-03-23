import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  ChangeDetector,
  ChangeDetectionResult,
  ChangeDetectionOptions,
  FileChangeEvent,
  createChangeDetector,
  detectChanges,
  hasFileChanged
} from '../utils/change-detector';
import { createSpinner, ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface ChangeDetectorCommandOptions {
  scan?: boolean;
  status?: boolean;
  stats?: boolean;
  check?: string;
  clear?: boolean;
  watch?: boolean;
  compare?: boolean;
  interactive?: boolean;
  
  // Detection options
  path?: string;
  useHashing?: boolean;
  metadataOnly?: boolean;
  trackMoves?: boolean;
  maxDepth?: number;
  maxFileSize?: number;
  
  // Hashing options
  algorithm?: string;
  skipBinary?: boolean;
  chunkSize?: number;
  
  // Cache options
  enableCache?: boolean;
  cacheLocation?: string;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  detailed?: boolean;
  
  spinner?: ProgressSpinner;
}

export async function manageChangeDetector(options: ChangeDetectorCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.scan) {
      await scanForChanges(options, spinner);
      return;
    }

    if (options.status) {
      await showDetectorStatus(options, spinner);
      return;
    }

    if (options.stats) {
      await showDetectorStats(options, spinner);
      return;
    }

    if (options.check) {
      await checkFileChanges(options, spinner);
      return;
    }

    if (options.clear) {
      await clearCache(options, spinner);
      return;
    }

    if (options.watch) {
      await watchForChanges(options, spinner);
      return;
    }

    if (options.compare) {
      await compareChanges(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveChangeDetection(options, spinner);
      return;
    }

    // Default: perform a scan
    await scanForChanges(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Change detection operation failed'));
    throw error;
  }
}

async function scanForChanges(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const targetPath = options.path || process.cwd();
  
  if (!(await fs.pathExists(targetPath))) {
    throw new ValidationError(`Path does not exist: ${targetPath}`);
  }

  if (spinner) spinner.setText('Scanning for changes...');

  try {
    const detectionOptions: ChangeDetectionOptions = {
      useContentHashing: options.useHashing ?? true,
      useMetadataOnly: options.metadataOnly ?? false,
      trackMoves: options.trackMoves ?? true,
      recursiveDepth: options.maxDepth ?? 10,
      enableCache: options.enableCache ?? true,
      cacheLocation: options.cacheLocation ?? path.join(targetPath, '.re-shell', 'change-cache.json'),
      hashingOptions: {
        algorithm: options.algorithm ?? 'sha256',
        skipBinary: options.skipBinary ?? false,
        chunkSize: options.chunkSize ?? 64 * 1024,
        maxFileSize: options.maxFileSize ?? 50 * 1024 * 1024
      }
    };

    const result = await detectChanges(targetPath, detectionOptions);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n🔍 Change Detection Results'));
    console.log(chalk.gray('═'.repeat(50)));

    if (result.totalChanges === 0) {
      console.log(chalk.green('✅ No changes detected'));
      console.log(chalk.gray('All files are up to date.'));
    } else {
      console.log(`Total changes: ${chalk.blue(result.totalChanges)}`);
      
      if (result.added.length > 0) {
        console.log(`\\n${chalk.green('➕ Added files:')} (${result.added.length})`);
        for (const file of result.added.slice(0, 10)) {
          console.log(`  + ${file}`);
        }
        if (result.added.length > 10) {
          console.log(`  ... and ${result.added.length - 10} more`);
        }
      }

      if (result.modified.length > 0) {
        console.log(`\\n${chalk.yellow('📝 Modified files:')} (${result.modified.length})`);
        for (const file of result.modified.slice(0, 10)) {
          console.log(`  ~ ${file}`);
        }
        if (result.modified.length > 10) {
          console.log(`  ... and ${result.modified.length - 10} more`);
        }
      }

      if (result.deleted.length > 0) {
        console.log(`\\n${chalk.red('➖ Deleted files:')} (${result.deleted.length})`);
        for (const file of result.deleted.slice(0, 10)) {
          console.log(`  - ${file}`);
        }
        if (result.deleted.length > 10) {
          console.log(`  ... and ${result.deleted.length - 10} more`);
        }
      }

      if (result.moved.length > 0) {
        console.log(`\\n${chalk.blue('🔄 Moved files:')} (${result.moved.length})`);
        for (const move of result.moved.slice(0, 5)) {
          console.log(`  ${move.from} → ${move.to}`);
        }
        if (result.moved.length > 5) {
          console.log(`  ... and ${result.moved.length - 5} more`);
        }
      }
    }

    // Performance metrics
    console.log(chalk.cyan('\\n⚡ Performance:'));
    console.log(`  Scan time: ${chalk.blue(formatDuration(result.scanTime / 1000))}`);
    console.log(`  Hashing time: ${chalk.blue(formatDuration(result.hashingTime / 1000))}`);
    
    if (options.verbose) {
      const efficiency = result.scanTime > 0 ? ((result.hashingTime / result.scanTime) * 100).toFixed(1) : '0';
      console.log(`  Hashing efficiency: ${chalk.blue(efficiency)}%`);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to scan for changes'));
    throw error;
  }
}

async function showDetectorStatus(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const targetPath = options.path || process.cwd();

  if (spinner) spinner.setText('Checking detector status...');

  try {
    const detector = await createChangeDetector(targetPath, {
      enableCache: options.enableCache ?? true,
      cacheLocation: options.cacheLocation
    });

    const stats = detector.getCacheStats();
    
    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        path: targetPath,
        cacheEnabled: options.enableCache ?? true,
        stats
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n📊 Change Detector Status'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`Target path: ${chalk.blue(targetPath)}`);
    console.log(`Cache enabled: ${chalk.blue(options.enableCache ?? true ? 'Yes' : 'No')}`);
    console.log(`Cached files: ${chalk.blue(stats.cacheSize)}`);
    console.log(`Total tracked: ${chalk.blue(stats.totalFiles)}`);
    console.log(`Memory usage: ${chalk.blue(stats.memoryUsage)}`);
    console.log(`Cache hit rate: ${chalk.blue(stats.hitRate.toFixed(1))}%`);

    if (options.verbose) {
      const cacheFile = options.cacheLocation || path.join(targetPath, '.re-shell', 'change-cache.json');
      console.log(`\\nCache location: ${chalk.gray(cacheFile)}`);
      
      if (await fs.pathExists(cacheFile)) {
        const cacheStats = await fs.stat(cacheFile);
        console.log(`Cache file size: ${chalk.gray(formatBytes(cacheStats.size))}`);
        console.log(`Last updated: ${chalk.gray(cacheStats.mtime.toLocaleString())}`);
      } else {
        console.log(`Cache file: ${chalk.gray('Not created yet')}`);
      }
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to get detector status'));
    throw error;
  }
}

async function showDetectorStats(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const targetPath = options.path || process.cwd();

  if (spinner) spinner.setText('Gathering detection statistics...');

  try {
    const detector = await createChangeDetector(targetPath, {
      enableCache: options.enableCache ?? true,
      cacheLocation: options.cacheLocation
    });

    const stats = detector.getCacheStats();
    
    // Perform a quick scan to get more detailed stats
    const result = await detector.detectChanges();
    
    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        cacheStats: stats,
        lastScan: result
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n📈 Change Detection Statistics'));
    console.log(chalk.gray('═'.repeat(50)));

    // Cache statistics
    console.log(chalk.cyan('\\nCache Performance:'));
    console.log(`  Cached entries: ${chalk.blue(stats.cacheSize)}`);
    console.log(`  Total files tracked: ${chalk.blue(stats.totalFiles)}`);
    console.log(`  Memory usage: ${chalk.blue(stats.memoryUsage)}`);
    console.log(`  Hit rate: ${chalk.blue(stats.hitRate.toFixed(1))}%`);

    // Last scan results
    console.log(chalk.cyan('\\nLast Scan Results:'));
    console.log(`  Total changes: ${chalk.blue(result.totalChanges)}`);
    console.log(`  Added files: ${chalk.green(result.added.length)}`);
    console.log(`  Modified files: ${chalk.yellow(result.modified.length)}`);
    console.log(`  Deleted files: ${chalk.red(result.deleted.length)}`);
    console.log(`  Moved files: ${chalk.blue(result.moved.length)}`);

    // Performance metrics
    console.log(chalk.cyan('\\nPerformance Metrics:'));
    console.log(`  Scan time: ${chalk.blue(formatDuration(result.scanTime / 1000))}`);
    console.log(`  Hashing time: ${chalk.blue(formatDuration(result.hashingTime / 1000))}`);
    console.log(`  Files/second: ${chalk.blue(calculateFilesPerSecond(stats.totalFiles, result.scanTime))}`);

    if (result.scanTime > 0) {
      const efficiency = ((result.hashingTime / result.scanTime) * 100).toFixed(1);
      console.log(`  Hashing efficiency: ${chalk.blue(efficiency)}%`);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to get detection statistics'));
    throw error;
  }
}

async function checkFileChanges(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.check) {
    throw new ValidationError('File path is required for checking changes');
  }

  const targetPath = options.path || process.cwd();
  const filePath = options.check;

  if (spinner) spinner.setText(`Checking changes for ${filePath}...`);

  try {
    const detector = await createChangeDetector(targetPath, {
      enableCache: options.enableCache ?? true,
      useContentHashing: options.useHashing ?? true
    });

    const hasChanged = await detector.hasFileChanged(filePath);
    const changes = await detector.getFileChanges(filePath);
    const fileHash = await detector.getFileHash(filePath);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        file: filePath,
        hasChanged,
        changes,
        currentHash: fileHash
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n🔍 File Change Analysis'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`File: ${chalk.blue(filePath)}`);
    console.log(`Changed: ${hasChanged ? chalk.red('Yes') : chalk.green('No')}`);

    if (fileHash) {
      console.log(`Current hash: ${chalk.gray(fileHash.hash.substring(0, 16) + '...')}`);
      console.log(`Size: ${chalk.blue(formatBytes(fileHash.size))}`);
      console.log(`Modified: ${chalk.gray(new Date(fileHash.mtime).toLocaleString())}`);
    }

    if (changes) {
      console.log(`\\nChange type: ${getChangeTypeIcon(changes.type)} ${chalk.blue(changes.type)}`);
      
      if (changes.oldHash && changes.hash) {
        console.log(`Hash changed: ${chalk.red(changes.oldHash.substring(0, 16) + '...')} → ${chalk.green(changes.hash.substring(0, 16) + '...')}`);
      }
      
      if (changes.metadata) {
        console.log(`Timestamp: ${chalk.gray(new Date(changes.timestamp).toLocaleString())}`);
      }
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to check file changes'));
    throw error;
  }
}

async function clearCache(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const targetPath = options.path || process.cwd();

  if (spinner) spinner.setText('Clearing change detection cache...');

  try {
    const detector = await createChangeDetector(targetPath, {
      enableCache: options.enableCache ?? true,
      cacheLocation: options.cacheLocation
    });

    await detector.clearCache();

    if (spinner) spinner.stop();

    console.log(chalk.green('\\n✅ Change detection cache cleared successfully!'));
    console.log(chalk.gray('Next scan will rebuild the entire cache.'));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to clear cache'));
    throw error;
  }
}

async function watchForChanges(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const targetPath = options.path || process.cwd();

  if (spinner) spinner.setText('Starting change monitoring...');

  try {
    const detector = await createChangeDetector(targetPath, {
      useContentHashing: options.useHashing ?? true,
      trackMoves: options.trackMoves ?? true,
      enableCache: options.enableCache ?? true
    });

    if (spinner) spinner.stop();

    console.log(chalk.cyan('\\n👀 Watching for changes... (Press Ctrl+C to stop)'));
    console.log(chalk.gray(`Monitoring: ${targetPath}`));
    console.log(chalk.gray('═'.repeat(50)));

    let scanCount = 0;
    const startTime = Date.now();

    const watchInterval = setInterval(async () => {
      try {
        const result = await detector.detectChanges();
        scanCount++;
        
        if (result.totalChanges > 0) {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`\\n${chalk.blue('🔄')} ${chalk.gray(timestamp)} Changes detected: ${chalk.blue(result.totalChanges)}`);
          
          for (const file of result.added.slice(0, 3)) {
            console.log(`  ${chalk.green('+')} ${file}`);
          }
          
          for (const file of result.modified.slice(0, 3)) {
            console.log(`  ${chalk.yellow('~')} ${file}`);
          }
          
          for (const file of result.deleted.slice(0, 3)) {
            console.log(`  ${chalk.red('-')} ${file}`);
          }
          
          if (result.totalChanges > 6) {
            console.log(`  ... and ${result.totalChanges - 6} more changes`);
          }
        } else if (options.verbose) {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`${chalk.gray(timestamp)} No changes`);
        }
      } catch (error) {
        console.error(chalk.red(`Watch error: ${error}`));
      }
    }, 5000); // Check every 5 seconds

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(watchInterval);
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.yellow('\\n\\n⏹️  Change monitoring stopped'));
      console.log(chalk.gray(`Duration: ${formatDuration(duration)}`));
      console.log(chalk.gray(`Scans performed: ${scanCount}`));
      process.exit(0);
    });

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to start change monitoring'));
    throw error;
  }
}

async function compareChanges(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const targetPath = options.path || process.cwd();

  if (spinner) spinner.setText('Comparing changes...');

  try {
    const detector = await createChangeDetector(targetPath, {
      useContentHashing: options.useHashing ?? true,
      trackMoves: options.trackMoves ?? true
    });

    // Perform two scans with a small delay to capture any changes
    const firstScan = await detector.detectChanges();
    
    console.log(chalk.yellow('\\n⏱️  Waiting 2 seconds for changes...'));
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const secondScan = await detector.detectChanges();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        firstScan,
        secondScan,
        comparison: {
          changesInSecondScan: secondScan.totalChanges,
          timeWindow: '2 seconds'
        }
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n📊 Change Comparison'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`First scan changes: ${chalk.blue(firstScan.totalChanges)}`);
    console.log(`Second scan changes: ${chalk.blue(secondScan.totalChanges)}`);
    
    if (secondScan.totalChanges > 0) {
      console.log(chalk.yellow('\\n⚠️  Changes detected during comparison window:'));
      
      for (const file of secondScan.added) {
        console.log(`  ${chalk.green('+')} ${file}`);
      }
      
      for (const file of secondScan.modified) {
        console.log(`  ${chalk.yellow('~')} ${file}`);
      }
      
      for (const file of secondScan.deleted) {
        console.log(`  ${chalk.red('-')} ${file}`);
      }
    } else {
      console.log(chalk.green('\\n✅ No additional changes detected'));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to compare changes'));
    throw error;
  }
}

async function interactiveChangeDetection(options: ChangeDetectorCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '🔍 Scan for changes', value: 'scan' },
        { title: '📊 Show status', value: 'status' },
        { title: '📈 Show statistics', value: 'stats' },
        { title: '🔎 Check specific file', value: 'check' },
        { title: '👀 Watch for changes', value: 'watch' },
        { title: '📋 Compare changes', value: 'compare' },
        { title: '🗑️  Clear cache', value: 'clear' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'scan':
      await scanInteractive(options);
      break;
    case 'status':
      await showDetectorStatus({ ...options, interactive: false });
      break;
    case 'stats':
      await showDetectorStats({ ...options, interactive: false });
      break;
    case 'check':
      await checkFileInteractive(options);
      break;
    case 'watch':
      await watchInteractive(options);
      break;
    case 'compare':
      await compareChanges({ ...options, interactive: false });
      break;
    case 'clear':
      await clearCacheInteractive(options);
      break;
  }
}

async function scanInteractive(options: ChangeDetectorCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'path',
      message: 'Path to scan:',
      initial: process.cwd()
    },
    {
      type: 'confirm',
      name: 'useHashing',
      message: 'Use content hashing?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'trackMoves',
      message: 'Track file moves?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'skipBinary',
      message: 'Skip binary files?',
      initial: false
    },
    {
      type: 'number',
      name: 'maxDepth',
      message: 'Maximum scan depth:',
      initial: 10,
      min: 1,
      max: 50
    }
  ]);

  if (!response.path) return;

  await scanForChanges({
    ...options,
    ...response,
    interactive: false
  });
}

async function checkFileInteractive(options: ChangeDetectorCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'check',
      message: 'File path to check:',
      validate: (value: string) => value.length > 0 ? true : 'File path is required'
    },
    {
      type: 'text',
      name: 'path',
      message: 'Root directory:',
      initial: process.cwd()
    },
    {
      type: 'confirm',
      name: 'useHashing',
      message: 'Use content hashing?',
      initial: true
    }
  ]);

  if (!response.check) return;

  await checkFileChanges({
    ...options,
    ...response,
    interactive: false
  });
}

async function watchInteractive(options: ChangeDetectorCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'path',
      message: 'Path to watch:',
      initial: process.cwd()
    },
    {
      type: 'confirm',
      name: 'useHashing',
      message: 'Use content hashing?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Show verbose output?',
      initial: false
    }
  ]);

  await watchForChanges({
    ...options,
    ...response,
    interactive: false
  });
}

async function clearCacheInteractive(options: ChangeDetectorCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'path',
      message: 'Root directory:',
      initial: process.cwd()
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to clear the cache?',
      initial: false
    }
  ]);

  if (!response.confirm) {
    console.log(chalk.yellow('Cache clear cancelled'));
    return;
  }

  await clearCache({
    ...options,
    ...response,
    interactive: false
  });
}

// Utility functions
function formatDuration(seconds: number): string {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function calculateFilesPerSecond(fileCount: number, timeMs: number): string {
  if (timeMs === 0) return '∞';
  const filesPerSecond = (fileCount / (timeMs / 1000));
  return filesPerSecond < 1 ? '< 1' : filesPerSecond.toFixed(0);
}

function getChangeTypeIcon(type: string): string {
  switch (type) {
    case 'added': return '➕';
    case 'modified': return '📝';
    case 'deleted': return '➖';
    case 'moved': return '🔄';
    default: return '📄';
  }
}