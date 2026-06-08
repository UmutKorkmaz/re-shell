import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { IncrementalBuilder, createIncrementalBuilder, BuildResult, BuildPlan } from '../utils/incremental-builder';

export interface IncrementalBuildCommandOptions {
  targets?: string[];
  changedFiles?: string[];
  maxParallelBuilds?: number;
  enableCache?: boolean;
  cacheLocation?: string;
  cleanBuild?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  skipTests?: boolean;
  failFast?: boolean;
  buildTimeout?: number;
  output?: string;
  format?: 'text' | 'json';
  plan?: boolean;
  stats?: boolean;
  clearCache?: boolean;
}

// Main command handler for incremental building
export async function manageIncrementalBuild(options: IncrementalBuildCommandOptions = {}): Promise<void> {
  const spinner = new ProgressSpinner({ text: 'Initializing incremental builder...' });
  
  try {
    const rootPath = process.cwd();
    
    // Validate that we're in a Re-Shell project
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) {
      throw new ValidationError('Not in a valid project directory (package.json not found)');
    }

    spinner.start();
    
    const builder = await createIncrementalBuilder(rootPath, {
      maxParallelBuilds: options.maxParallelBuilds,
      enableCache: options.enableCache !== false,
      cacheLocation: options.cacheLocation,
      cleanBuild: options.cleanBuild || false,
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      skipTests: options.skipTests || false,
      failFast: options.failFast !== false,
      buildTimeout: options.buildTimeout
    });

    spinner.stop();

    // Handle different command modes
    if (options.clearCache) {
      await handleClearCache(builder);
    } else if (options.stats) {
      await handleShowStats(builder, options);
    } else if (options.plan) {
      await handleShowPlan(builder, options);
    } else {
      await handleBuild(builder, options);
    }

  } catch (error) {
    spinner.stop();
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Incremental build failed: ${error}`);
  }
}

// Handle build execution
async function handleBuild(builder: IncrementalBuilder, options: IncrementalBuildCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n🚀 Incremental Build'));
  console.log(chalk.gray('='.repeat(25)));

  const plan = await builder.createBuildPlan(options.changedFiles);
  
  if (plan.targets.length === 0) {
    console.log(chalk.green('✅ No targets need rebuilding - all builds are up to date!'));
    return;
  }

  // Show plan summary
  console.log(`\n📋 Build Plan:`);
  console.log(`  • Targets to build: ${chalk.yellow(plan.targets.length)}`);
  console.log(`  • Estimated time: ${chalk.yellow(Math.round(plan.totalEstimatedTime / 1000))}s`);
  console.log(`  • Parallel groups: ${chalk.yellow(plan.parallelGroups.length)}`);

  if (options.verbose && plan.optimizations.length > 0) {
    console.log(`\n💡 Optimizations:`);
    plan.optimizations.forEach(opt => console.log(`  • ${opt}`));
  }

  // Execute build
  const results = await builder.executeBuildPlan(plan);

  // Output results
  if (options.format === 'json') {
    const output = {
      plan,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        totalTime: results.reduce((sum, r) => sum + r.duration, 0),
        cacheHits: results.filter(r => r.cacheHit).length
      }
    };

    if (options.output) {
      await fs.writeJson(options.output, output, { spaces: 2 });
      console.log(chalk.green(`✓ Build results saved to ${options.output}`));
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
  } else {
    await outputBuildResults(results, options.verbose || false);
  }
}

// Handle showing build plan without execution
async function handleShowPlan(builder: IncrementalBuilder, options: IncrementalBuildCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n📋 Build Plan Analysis'));
  console.log(chalk.gray('='.repeat(30)));

  const plan = await builder.createBuildPlan(options.changedFiles);

  if (plan.targets.length === 0) {
    console.log(chalk.green('✅ No targets need rebuilding - all builds are up to date!'));
    return;
  }

  // Show detailed plan
  console.log(`\n📊 Summary:`);
  console.log(`  • Targets to build: ${chalk.yellow(plan.targets.length)}`);
  console.log(`  • Build order: ${plan.buildOrder.join(' → ')}`);
  console.log(`  • Parallel groups: ${chalk.yellow(plan.parallelGroups.length)}`);
  console.log(`  • Estimated time: ${chalk.yellow(Math.round(plan.totalEstimatedTime / 1000))}s`);

  console.log(`\n🏗️  Targets:`);
  plan.targets.forEach((target, index) => {
    const typeColor = getTargetTypeColor(target.type);
    console.log(`  ${chalk.yellow(index + 1)}. ${typeColor(target.name)} (${target.type})`);
    
    if (options.verbose) {
      console.log(`     Path: ${chalk.gray(target.path)}`);
      console.log(`     Build: ${chalk.gray(target.buildScript)}`);
      if (target.dependencies.length > 0) {
        console.log(`     Dependencies: ${chalk.gray(target.dependencies.join(', '))}`);
      }
    }
  });

  console.log(`\n🔀 Parallel Execution Groups:`);
  plan.parallelGroups.forEach((group, index) => {
    console.log(`  Group ${chalk.yellow(index + 1)}: ${group.join(', ')}`);
  });

  if (plan.optimizations.length > 0) {
    console.log(`\n💡 Optimizations:`);
    plan.optimizations.forEach(opt => console.log(`  • ${opt}`));
  }

  // Output to file if requested
  if (options.output) {
    if (options.format === 'json') {
      await fs.writeJson(options.output, plan, { spaces: 2 });
    } else {
      const planText = `Build Plan\n${JSON.stringify(plan, null, 2)}`;
      await fs.writeFile(options.output, planText);
    }
    console.log(chalk.green(`\n✓ Build plan saved to ${options.output}`));
  }
}

// Handle showing build statistics
async function handleShowStats(builder: IncrementalBuilder, options: IncrementalBuildCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n📊 Build Statistics'));
  console.log(chalk.gray('='.repeat(25)));

  const stats = builder.getBuildStats();

  console.log(`\n📈 Cache Performance:`);
  console.log(`  • Total builds: ${chalk.yellow(stats.totalBuilds)}`);
  console.log(`  • Cache hit rate: ${chalk.yellow(Math.round(stats.cacheHitRate))}%`);
  console.log(`  • Average build time: ${chalk.yellow(Math.round(stats.averageBuildTime / 1000))}s`);
  console.log(`  • Total cache size: ${chalk.yellow(formatBytes(stats.totalCacheSize))}`);

  // Performance recommendations
  console.log(`\n💡 Recommendations:`);
  if (stats.cacheHitRate < 50) {
    console.log(`  • Consider enabling build caching for better performance`);
  }
  if (stats.averageBuildTime > 60000) {
    console.log(`  • Consider optimizing build scripts or increasing parallel builds`);
  }
  if (stats.totalCacheSize > 1000000000) { // 1GB
    console.log(`  • Consider clearing old cache entries to save disk space`);
  }

  // Output to file if requested
  if (options.output) {
    if (options.format === 'json') {
      await fs.writeJson(options.output, stats, { spaces: 2 });
    } else {
      const statsText = `Build Statistics\n${JSON.stringify(stats, null, 2)}`;
      await fs.writeFile(options.output, statsText);
    }
    console.log(chalk.green(`\n✓ Statistics saved to ${options.output}`));
  }
}

// Handle clearing build cache
async function handleClearCache(builder: IncrementalBuilder): Promise<void> {
  console.log(chalk.cyan('\n🧹 Clearing Build Cache'));
  console.log(chalk.gray('='.repeat(30)));

  await builder.clearCache();
  console.log(chalk.green('✅ Build cache cleared successfully!'));
}

// Output build results in text format
async function outputBuildResults(results: BuildResult[], verbose: boolean): Promise<void> {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const cacheHits = results.filter(r => r.cacheHit);

  console.log(`\n📊 Build Results:`);
  console.log(`  • Total: ${chalk.yellow(results.length)}`);
  console.log(`  • Successful: ${chalk.green(successful.length)}`);
  console.log(`  • Failed: ${failed.length > 0 ? chalk.red(failed.length) : chalk.gray('0')}`);
  console.log(`  • Cache hits: ${chalk.cyan(cacheHits.length)}`);

  if (successful.length > 0) {
    console.log(`\n✅ Successful Builds:`);
    successful.forEach(result => {
      const durationText = result.cacheHit ? 'cached' : `${Math.round(result.duration / 1000)}s`;
      const sizeText = result.outputSize ? ` (${formatBytes(result.outputSize)})` : '';
      console.log(`  • ${result.target}: ${chalk.green(durationText)}${sizeText}`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed Builds:`);
    failed.forEach(result => {
      console.log(`  • ${result.target}: ${chalk.red('failed')}`);
      if (verbose && result.error) {
        console.log(`    Error: ${chalk.gray(result.error)}`);
      }
    });
  }

  // Performance summary
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const averageTime = results.length > 0 ? totalTime / results.length : 0;
  
  console.log(`\n⏱️  Performance:`);
  console.log(`  • Total time: ${chalk.yellow(Math.round(totalTime / 1000))}s`);
  console.log(`  • Average per target: ${chalk.yellow(Math.round(averageTime / 1000))}s`);
  
  if (cacheHits.length > 0) {
    const timeSaved = cacheHits.length * averageTime;
    console.log(`  • Time saved by cache: ${chalk.green(Math.round(timeSaved / 1000))}s`);
  }
}

// Get color for target type
function getTargetTypeColor(type: string): (text: string) => string {
  switch (type) {
    case 'app': return chalk.blue;
    case 'package': return chalk.green;
    case 'lib': return chalk.magenta;
    case 'tool': return chalk.cyan;
    default: return chalk.white;
  }
}

// Format bytes for display
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Register incremental build commands
export function registerIncrementalBuildCommands(program: Command): void {
  const incrementalBuild = program
    .command('incremental-build')
    .alias('ibuild')
    .description('Intelligent incremental building with change detection');

  incrementalBuild
    .command('build')
    .description('Run incremental build')
    .option('--targets <targets...>', 'Specific targets to build')
    .option('--changed-files <files...>', 'Specific changed files to analyze')
    .option('--max-parallel <num>', 'Maximum parallel builds', '4')
    .option('--no-cache', 'Disable build caching')
    .option('--cache-location <path>', 'Build cache location')
    .option('--clean', 'Clean build (ignore cache)')
    .option('--dry-run', 'Show what would be built without building')
    .option('--verbose', 'Show detailed information')
    .option('--skip-tests', 'Skip test execution')
    .option('--no-fail-fast', 'Continue building after failures')
    .option('--build-timeout <ms>', 'Build timeout in milliseconds', '300000')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(async (options) => {
      await manageIncrementalBuild({
        ...options,
        maxParallelBuilds: parseInt(options.maxParallel),
        buildTimeout: parseInt(options.buildTimeout),
        enableCache: options.cache !== false,
        cleanBuild: options.clean,
        dryRun: options.dryRun,
        failFast: options.failFast !== false
      });
    });

  incrementalBuild
    .command('plan')
    .description('Show build plan without executing')
    .option('--changed-files <files...>', 'Specific changed files to analyze')
    .option('--verbose', 'Show detailed information')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(async (options) => {
      await manageIncrementalBuild({
        ...options,
        plan: true
      });
    });

  incrementalBuild
    .command('stats')
    .description('Show build statistics and performance metrics')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(async (options) => {
      await manageIncrementalBuild({
        ...options,
        stats: true
      });
    });

  incrementalBuild
    .command('clear-cache')
    .description('Clear build cache')
    .action(async () => {
      await manageIncrementalBuild({
        clearCache: true
      });
    });
}