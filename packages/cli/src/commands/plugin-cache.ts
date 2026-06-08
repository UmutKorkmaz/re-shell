import chalk from 'chalk';
import { Command } from 'commander';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import {
  createCommandCacheManager,
  PluginCommandCacheManager,
  CacheConfiguration,
  CacheStorageStrategy,
  CacheInvalidationStrategy,
  PerformanceMonitoringLevel,
  formatCacheSize,
  formatCacheHitRate,
  formatExecutionTime
} from '../utils/plugin-command-cache';
import { createPluginCommandRegistry } from '../utils/plugin-command-registry';

interface CacheCommandOptions {
  verbose?: boolean;
  json?: boolean;
  strategy?: CacheStorageStrategy;
  size?: number;
  ttl?: number;
  command?: string;
  tags?: string;
  force?: boolean;
  includeErrors?: boolean;
}

// Show cache statistics
export async function showCacheStats(
  options: CacheCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const cacheManager = createCommandCacheManager();
    const stats = cacheManager.getCacheStats();
    const metrics = cacheManager.getMetrics();
    const config = cacheManager.getConfiguration();

    if (json) {
      console.log(JSON.stringify({
        stats,
        metrics,
        config
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('📊 Command Cache Statistics\n'));

    // Cache Overview
    console.log(chalk.yellow('Cache Overview:'));
    console.log(`  Status: ${config.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
    console.log(`  Strategy: ${config.strategy}`);
    console.log(`  Size: ${stats.size} entries`);
    console.log(`  Memory usage: ${formatCacheSize(stats.memoryUsage)}`);
    console.log(`  Hit rate: ${formatCacheHitRate(stats.hitRate)}`);

    // Performance Metrics
    console.log(chalk.yellow('\nPerformance Metrics:'));
    console.log(`  Total executions: ${metrics.totalExecutions}`);
    console.log(`  Cache hits: ${chalk.green(metrics.cacheHits)}`);
    console.log(`  Cache misses: ${chalk.red(metrics.cacheMisses)}`);
    console.log(`  Average execution time: ${formatExecutionTime(metrics.averageExecutionTime)}`);
    console.log(`  Average cached time: ${formatExecutionTime(metrics.averageCachedExecutionTime)}`);
    console.log(`  Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);

    if (verbose) {
      // Configuration Details
      console.log(chalk.yellow('\nConfiguration:'));
      console.log(`  Max size: ${config.maxSize} entries`);
      console.log(`  Max memory: ${formatCacheSize(config.maxMemoryUsage)}`);
      console.log(`  Default TTL: ${formatExecutionTime(config.defaultTTL)}`);
      console.log(`  Cleanup interval: ${formatExecutionTime(config.cleanupInterval)}`);
      console.log(`  Invalidation strategy: ${config.invalidationStrategy}`);
      console.log(`  Compression: ${config.compressionEnabled ? 'Yes' : 'No'}`);
      console.log(`  Encryption: ${config.encryptionEnabled ? 'Yes' : 'No'}`);
      console.log(`  Persist to disk: ${config.persistToDisk ? 'Yes' : 'No'}`);

      // Cache Entry Details
      if (stats.oldestEntry) {
        console.log(chalk.yellow('\nCache Entries:'));
        console.log(`  Oldest: ${new Date(stats.oldestEntry.createdAt).toLocaleString()}`);
        console.log(`  Newest: ${new Date(stats.newestEntry?.createdAt || 0).toLocaleString()}`);
        console.log(`  Most accessed: ${stats.mostAccessedEntry?.accessCount || 0} times`);
        console.log(`  Largest: ${formatCacheSize(stats.largestEntry?.size || 0)}`);
      }

      // Last cleanup
      console.log(chalk.yellow('\nMaintenance:'));
      console.log(`  Last cleanup: ${new Date(metrics.lastCleanupAt).toLocaleString()}`);
    }

    // Performance recommendations
    if (stats.hitRate < 0.5) {
      console.log(chalk.red('\n⚠️  Low cache hit rate detected'));
      console.log(chalk.blue('💡 Consider increasing TTL or adjusting invalidation strategy'));
    }

    if (stats.memoryUsage > config.maxMemoryUsage * 0.8) {
      console.log(chalk.yellow('\n⚠️  High memory usage detected'));
      console.log(chalk.blue('💡 Consider increasing max memory or enabling compression'));
    }

    await cacheManager.destroy();

  } catch (error) {
    throw new ValidationError(
      `Failed to show cache statistics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Configure cache settings
export async function configureCacheSettings(
  setting: string,
  value: string,
  options: CacheCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    const cacheManager = createCommandCacheManager();
    const currentConfig = cacheManager.getConfiguration();

    // Validate setting
    const validSettings = [
      'enabled', 'strategy', 'maxSize', 'maxMemoryUsage', 'defaultTTL',
      'cleanupInterval', 'compressionEnabled', 'encryptionEnabled',
      'persistToDisk', 'performanceMonitoring'
    ];

    if (!validSettings.includes(setting)) {
      throw new ValidationError(`Invalid setting '${setting}'. Valid options: ${validSettings.join(', ')}`);
    }

    // Parse value based on setting type
    let parsedValue: any = value;
    
    switch (setting) {
      case 'enabled':
      case 'compressionEnabled':
      case 'encryptionEnabled':
      case 'persistToDisk':
        parsedValue = value.toLowerCase() === 'true';
        break;
      
      case 'maxSize':
      case 'cleanupInterval':
        parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue) || parsedValue < 0) {
          throw new ValidationError(`${setting} must be a positive number`);
        }
        break;
      
      case 'maxMemoryUsage':
      case 'defaultTTL':
        parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue) || parsedValue <= 0) {
          throw new ValidationError(`${setting} must be a positive number`);
        }
        break;
      
      case 'strategy':
        if (!Object.values(CacheStorageStrategy).includes(value as CacheStorageStrategy)) {
          throw new ValidationError(`Invalid strategy. Valid options: ${Object.values(CacheStorageStrategy).join(', ')}`);
        }
        parsedValue = value as CacheStorageStrategy;
        break;
      
      case 'performanceMonitoring':
        if (!Object.values(PerformanceMonitoringLevel).includes(value as PerformanceMonitoringLevel)) {
          throw new ValidationError(`Invalid monitoring level. Valid options: ${Object.values(PerformanceMonitoringLevel).join(', ')}`);
        }
        parsedValue = value as PerformanceMonitoringLevel;
        break;
    }

    // Update configuration
    const updates: Partial<CacheConfiguration> = { [setting]: parsedValue };
    cacheManager.updateConfiguration(updates);

    console.log(chalk.green(`✓ Updated cache configuration: ${setting} = ${parsedValue}`));

    if (verbose) {
      console.log(chalk.yellow('\nCurrent Configuration:'));
      const newConfig = cacheManager.getConfiguration();
      Object.entries(newConfig).forEach(([key, val]) => {
        const isChanged = key === setting;
        const color = isChanged ? 'cyan' : 'gray';
        const colorFn = (chalk as any)[color];
        console.log(`  ${colorFn(key)}: ${val}`);
      });
    }

    await cacheManager.destroy();

  } catch (error) {
    throw new ValidationError(
      `Failed to configure cache settings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Clear cache
export async function clearCache(
  options: CacheCommandOptions = {}
): Promise<void> {
  const { verbose = false, command, tags, force = false } = options;

  if (!force) {
    console.log(chalk.yellow('⚠️  This will clear cached command results'));
    console.log(chalk.blue('Use --force to confirm the operation'));
    return;
  }

  try {
    const cacheManager = createCommandCacheManager();
    const spinner = createSpinner('Clearing cache...');
    spinner.start();

    let clearedCount = 0;

    if (command) {
      // Clear specific command cache
      clearedCount = await cacheManager.invalidateByCommand(command);
      spinner.stop();
      console.log(chalk.green(`✓ Cleared cache for command '${command}' (${clearedCount} entries)`));
      
    } else if (tags) {
      // Clear by tags
      const tagList = tags.split(',').map(tag => tag.trim());
      clearedCount = await cacheManager.invalidateByTags(tagList);
      spinner.stop();
      console.log(chalk.green(`✓ Cleared cache for tags: ${tagList.join(', ')} (${clearedCount} entries)`));
      
    } else {
      // Clear all cache
      const statsBefore = cacheManager.getCacheStats();
      await cacheManager.clearAll();
      clearedCount = statsBefore.size;
      spinner.stop();
      console.log(chalk.green(`✓ Cleared all cache (${clearedCount} entries)`));
    }

    if (verbose && clearedCount > 0) {
      console.log(chalk.yellow('\nCache cleared successfully'));
      console.log(`  Entries removed: ${clearedCount}`);
      console.log(`  Memory freed: ${formatCacheSize(0)}`); // Would calculate actual freed memory
    }

    await cacheManager.destroy();

  } catch (error) {
    throw new ValidationError(
      `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Test cache performance
export async function testCachePerformance(
  iterations: string,
  options: CacheCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const iterationCount = parseInt(iterations, 10);
    if (isNaN(iterationCount) || iterationCount <= 0) {
      throw new ValidationError('Iterations must be a positive number');
    }


    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const cacheManager = createCommandCacheManager({
      enabled: true,
      strategy: CacheStorageStrategy.MEMORY,
      maxSize: 1000,
      defaultTTL: 60000
    });

    console.log(chalk.cyan(`🧪 Testing Cache Performance (${iterationCount} iterations)\n`));

    const spinner = createSpinner('Running performance test...');
    spinner.start();

    const results = {
      totalIterations: iterationCount,
      executionTimes: [] as number[],
      cacheHitTimes: [] as number[],
      cacheMissTimes: [] as number[],
      hitCount: 0,
      missCount: 0
    };

    // Mock command execution function
    const mockCommandExecution = async (): Promise<string> => {
      // Simulate command execution time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      return `Mock result ${Date.now()}`;
    };

    // Create mock context
    const mockContext = {
      command: { name: 'test-command' },
      plugin: { manifest: { name: 'test-plugin' } },
      cli: { program: tempProgram, rootPath: process.cwd(), configPath: '', version: '1.0.0' },
      logger: {
        debug: () => { /* noop */ },
        info: () => { /* noop */ },
        warn: () => { /* noop */ },
        error: () => { /* noop */ }
      },
      utils: { path: require('path'), chalk, spinner: null }
    } as any;

    for (let i = 0; i < iterationCount; i++) {
      const startTime = performance.now();
      
      const result = await cacheManager.executeWithCache(
        'test-command',
        { iteration: i % 10 }, // Repeat args to test cache hits
        { flag: true },
        mockContext,
        mockCommandExecution
      );

      const executionTime = performance.now() - startTime;
      results.executionTimes.push(executionTime);

      if (result.hit) {
        results.cacheHitTimes.push(executionTime);
        results.hitCount++;
      } else {
        results.cacheMissTimes.push(executionTime);
        results.missCount++;
      }
    }

    spinner.stop();

    const averageExecutionTime = results.executionTimes.reduce((sum, time) => sum + time, 0) / results.executionTimes.length;
    const averageHitTime = results.cacheHitTimes.length > 0 
      ? results.cacheHitTimes.reduce((sum, time) => sum + time, 0) / results.cacheHitTimes.length 
      : 0;
    const averageMissTime = results.cacheMissTimes.length > 0 
      ? results.cacheMissTimes.reduce((sum, time) => sum + time, 0) / results.cacheMissTimes.length 
      : 0;

    const hitRate = results.hitCount / iterationCount;
    const performanceGain = averageMissTime > 0 ? ((averageMissTime - averageHitTime) / averageMissTime) * 100 : 0;

    if (json) {
      console.log(JSON.stringify({
        ...results,
        averageExecutionTime,
        averageHitTime,
        averageMissTime,
        hitRate,
        performanceGain
      }, null, 2));
      
      await cacheManager.destroy();
      return;
    }

    console.log(chalk.green('✓ Performance test completed\n'));

    console.log(chalk.yellow('Results:'));
    console.log(`  Total iterations: ${iterationCount}`);
    console.log(`  Cache hits: ${chalk.green(results.hitCount)}`);
    console.log(`  Cache misses: ${chalk.red(results.missCount)}`);
    console.log(`  Hit rate: ${formatCacheHitRate(hitRate)}`);

    console.log(chalk.yellow('\nPerformance:'));
    console.log(`  Average execution time: ${formatExecutionTime(averageExecutionTime)}`);
    console.log(`  Average hit time: ${formatExecutionTime(averageHitTime)}`);
    console.log(`  Average miss time: ${formatExecutionTime(averageMissTime)}`);
    console.log(`  Performance gain: ${performanceGain.toFixed(1)}%`);

    if (verbose) {
      console.log(chalk.yellow('\nCache Statistics:'));
      const stats = cacheManager.getCacheStats();
      console.log(`  Cache size: ${stats.size} entries`);
      console.log(`  Memory usage: ${formatCacheSize(stats.memoryUsage)}`);

      console.log(chalk.yellow('\nRecommendations:'));
      if (hitRate < 0.3) {
        console.log(chalk.red('  • Low hit rate - consider increasing TTL'));
      }
      if (performanceGain > 50) {
        console.log(chalk.green('  • Excellent performance gain from caching'));
      } else if (performanceGain < 20) {
        console.log(chalk.yellow('  • Moderate performance gain - cache may not be necessary'));
      }
    }

    await cacheManager.destroy();

  } catch (error) {
    throw new ValidationError(
      `Failed to test cache performance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Optimize cache
export async function optimizeCache(
  options: CacheCommandOptions = {}
): Promise<void> {
  const { verbose = false, force = false } = options;

  if (!force) {
    console.log(chalk.yellow('⚠️  This will analyze and optimize cache configuration'));
    console.log(chalk.blue('Use --force to apply optimizations automatically'));
  }

  try {
    const cacheManager = createCommandCacheManager();
    const stats = cacheManager.getCacheStats();
    const metrics = cacheManager.getMetrics();
    const config = cacheManager.getConfiguration();

    console.log(chalk.cyan('🔧 Cache Optimization Analysis\n'));

    const recommendations: Array<{
      issue: string;
      recommendation: string;
      setting?: string;
      newValue?: any;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Analyze hit rate
    if (stats.hitRate < 0.3) {
      recommendations.push({
        issue: 'Low cache hit rate',
        recommendation: 'Increase default TTL to keep entries longer',
        setting: 'defaultTTL',
        newValue: config.defaultTTL * 2,
        priority: 'high'
      });
    }

    // Analyze memory usage
    if (stats.memoryUsage > config.maxMemoryUsage * 0.8) {
      recommendations.push({
        issue: 'High memory usage',
        recommendation: 'Enable compression to reduce memory footprint',
        setting: 'compressionEnabled',
        newValue: true,
        priority: 'medium'
      });
    }

    // Analyze cache size
    if (stats.size > config.maxSize * 0.9) {
      recommendations.push({
        issue: 'Cache near capacity',
        recommendation: 'Increase max cache size',
        setting: 'maxSize',
        newValue: Math.floor(config.maxSize * 1.5),
        priority: 'medium'
      });
    }

    // Analyze error rate
    if (metrics.errorRate > 0.1) {
      recommendations.push({
        issue: 'High error rate',
        recommendation: 'Errors are not cached but tracked - consider investigating command failures',
        priority: 'high'
      });
    }

    // Analyze performance
    if (metrics.averageExecutionTime > 5000) {
      recommendations.push({
        issue: 'Slow command execution',
        recommendation: 'Commands are slow - caching provides significant benefit',
        priority: 'low'
      });
    }

    // Display recommendations
    if (recommendations.length === 0) {
      console.log(chalk.green('✓ Cache is already optimally configured'));
      await cacheManager.destroy();
      return;
    }

    console.log(chalk.yellow('Optimization Recommendations:\n'));

    recommendations.forEach((rec, index) => {
      const priorityColor = rec.priority === 'high' ? 'red' : 
                          rec.priority === 'medium' ? 'yellow' : 'blue';
      const priorityIcon = rec.priority === 'high' ? '🔴' : 
                          rec.priority === 'medium' ? '🟡' : '🔵';
      
      console.log(`${index + 1}. ${priorityIcon} ${rec.issue}`);
      console.log(`   ${rec.recommendation}`);
      
      if (rec.setting && rec.newValue !== undefined) {
        console.log(`   ${chalk.gray(`Suggested: ${rec.setting} = ${rec.newValue}`)}`);
      }
      
      console.log('');
    });

    // Apply optimizations if forced
    if (force) {
      const spinner = createSpinner('Applying optimizations...');
      spinner.start();

      const updates: Partial<CacheConfiguration> = {};
      let appliedCount = 0;

      for (const rec of recommendations) {
        if (rec.setting && rec.newValue !== undefined) {
          (updates as any)[rec.setting] = rec.newValue;
          appliedCount++;
        }
      }

      if (appliedCount > 0) {
        cacheManager.updateConfiguration(updates);
        spinner.stop();
        console.log(chalk.green(`✓ Applied ${appliedCount} optimization(s)`));
        
        if (verbose) {
          console.log(chalk.yellow('\nUpdated Configuration:'));
          const newConfig = cacheManager.getConfiguration();
          Object.entries(updates).forEach(([key, value]) => {
            console.log(`  ${chalk.cyan(key)}: ${value}`);
          });
        }
      } else {
        spinner.stop();
        console.log(chalk.yellow('No configuration changes to apply'));
      }
    } else {
      console.log(chalk.blue('💡 Use --force to apply these optimizations automatically'));
    }

    await cacheManager.destroy();

  } catch (error) {
    throw new ValidationError(
      `Failed to optimize cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// List cached commands
export async function listCachedCommands(
  options: CacheCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, includeErrors = false } = options;

  try {
    const cacheManager = createCommandCacheManager();
    const stats = cacheManager.getCacheStats();

    // Mock getting cache entries (would be implemented in real cache manager)
    const mockEntries = [
      {
        key: 'abc123',
        command: 'build',
        args: { target: 'production' },
        createdAt: Date.now() - 300000,
        lastAccessedAt: Date.now() - 60000,
        accessCount: 5,
        size: 2048,
        success: true
      },
      {
        key: 'def456',
        command: 'test',
        args: { coverage: true },
        createdAt: Date.now() - 180000,
        lastAccessedAt: Date.now() - 30000,
        accessCount: 3,
        size: 1024,
        success: true
      }
    ];

    if (json) {
      console.log(JSON.stringify(mockEntries, null, 2));
      await cacheManager.destroy();
      return;
    }

    console.log(chalk.cyan('📋 Cached Commands\n'));

    if (mockEntries.length === 0) {
      console.log(chalk.yellow('No cached commands found.'));
      await cacheManager.destroy();
      return;
    }

    console.log(chalk.yellow('Cache Overview:'));
    console.log(`  Total entries: ${stats.size}`);
    console.log(`  Memory usage: ${formatCacheSize(stats.memoryUsage)}`);
    console.log('');

    mockEntries.forEach((entry, index) => {
      const successIcon = entry.success ? chalk.green('✓') : chalk.red('✗');
      const timeAgo = Math.round((Date.now() - entry.lastAccessedAt) / 1000 / 60);
      
      console.log(`${index + 1}. ${successIcon} ${chalk.cyan(entry.command)}`);
      console.log(`   ${chalk.gray('Args:')} ${JSON.stringify(entry.args)}`);
      console.log(`   ${chalk.gray('Size:')} ${formatCacheSize(entry.size)}`);
      console.log(`   ${chalk.gray('Access count:')} ${entry.accessCount}`);
      console.log(`   ${chalk.gray('Last accessed:')} ${timeAgo}m ago`);
      
      if (verbose) {
        console.log(`   ${chalk.gray('Key:')} ${entry.key}`);
        console.log(`   ${chalk.gray('Created:')} ${new Date(entry.createdAt).toLocaleString()}`);
      }
      
      console.log('');
    });

    await cacheManager.destroy();

  } catch (error) {
    throw new ValidationError(
      `Failed to list cached commands: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}