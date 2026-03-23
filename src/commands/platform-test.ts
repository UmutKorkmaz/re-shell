import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { 
  testPlatformWatching, 
  getPlatformCapabilities,
  createCrossPlatformWatcher 
} from '../utils/file-watcher';
import { 
  createPlatformWatcher,
  PlatformTestResult,
  PlatformCapabilities 
} from '../utils/platform-watcher';

interface PlatformTestOptions {
  verbose?: boolean;
  json?: boolean;
  test?: boolean;
  capabilities?: boolean;
  all?: boolean;
}

// Test platform file watching capabilities
export async function testPlatformCapabilities(options: PlatformTestOptions = {}): Promise<void> {
  const { verbose = false, json = false, test = false, capabilities = false, all = false } = options;

  try {
    if (all || capabilities) {
      const spinner = createSpinner('Detecting platform capabilities...');
      spinner.start();

      const platformCapabilities = getPlatformCapabilities();
      
      spinner.stop();

      if (json) {
        console.log(JSON.stringify(platformCapabilities, null, 2));
        return;
      }

      console.log(chalk.cyan('\n🔍 Platform File Watching Capabilities\n'));
      
      displayPlatformCapabilities(platformCapabilities, verbose);
    }

    if (all || test) {
      const spinner = createSpinner('Testing file watching methods...');
      spinner.start();

      const testResults = await testPlatformWatching();
      
      spinner.stop();

      if (json && !capabilities && !all) {
        console.log(JSON.stringify(testResults, null, 2));
        return;
      }

      console.log(chalk.cyan('\n🧪 File Watching Method Tests\n'));
      
      displayTestResults(testResults, verbose);
    }

    if (all) {
      console.log(chalk.cyan('\n🚀 Platform Optimization Test\n'));
      
      const spinner = createSpinner('Testing cross-platform watcher...');
      spinner.start();

      const watcher = await createCrossPlatformWatcher();
      const stats = watcher.getStats();
      
      await watcher.stopWatching();
      spinner.stop();

      console.log(chalk.green('✅ Cross-platform watcher created successfully'));
      console.log(chalk.gray(`   Platform: ${stats.platformCapabilities.platform}`));
      console.log(chalk.gray(`   Recommended method: ${stats.platformCapabilities.recommendedWatchMethod}`));
      console.log(chalk.gray(`   Max watched files: ${stats.platformCapabilities.maxWatchedFiles.toLocaleString()}`));
    }

    if (!test && !capabilities && !all) {
      // Default: show basic capabilities
      const platformCapabilities = getPlatformCapabilities();
      displayPlatformCapabilities(platformCapabilities, false);
    }

  } catch (error) {
    throw new ValidationError(
      `Platform test failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Display platform capabilities in formatted output
function displayPlatformCapabilities(capabilities: PlatformCapabilities, verbose: boolean): void {
  console.log(chalk.yellow('Platform Information:'));
  console.log(`  OS: ${chalk.white(capabilities.platform)} (${capabilities.architecture})`);
  console.log(`  Recommended method: ${chalk.green(capabilities.recommendedWatchMethod)}`);
  console.log(`  Max watched files: ${chalk.white(capabilities.maxWatchedFiles.toLocaleString())}`);
  
  console.log(chalk.yellow('\nSupported Methods:'));
  console.log(`  Native watching: ${capabilities.supportsNativeWatching ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Polling: ${capabilities.supportsPolling ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  FSEvents (macOS): ${capabilities.supportsFSEvents ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  inotify (Linux): ${capabilities.supportsInotify ? chalk.green('✓') : chalk.red('✗')}`);
  
  console.log(chalk.yellow('\\nFallback Methods:'));
  capabilities.fallbackMethods.forEach((method, index) => {
    console.log(`  ${index + 1}. ${chalk.white(method)}`);
  });
  
  if (capabilities.limitations.length > 0) {
    console.log(chalk.yellow('\\nKnown Limitations:'));
    capabilities.limitations.forEach((limitation, index) => {
      console.log(`  ${index + 1}. ${chalk.gray(limitation)}`);
    });
  }

  if (verbose) {
    console.log(chalk.yellow('\\nDetailed Information:'));
    console.log(`  Architecture: ${capabilities.architecture}`);
    console.log(`  Platform: ${capabilities.platform}`);
    console.log(`  Native support: ${capabilities.supportsNativeWatching}`);
    console.log(`  Polling support: ${capabilities.supportsPolling}`);
    console.log(`  FSEvents support: ${capabilities.supportsFSEvents}`);
    console.log(`  inotify support: ${capabilities.supportsInotify}`);
  }
}

// Display test results in formatted output
function displayTestResults(results: PlatformTestResult, verbose: boolean): void {
  console.log(chalk.yellow('Test Results:'));
  console.log(`  Platform: ${chalk.white(results.platform)}`);
  console.log(`  Native watching: ${results.nativeWatching ? chalk.green('✓ PASS') : chalk.red('✗ FAIL')}`);
  console.log(`  Polling: ${results.polling ? chalk.green('✓ PASS') : chalk.red('✗ FAIL')}`);
  
  if (results.platform === 'darwin') {
    console.log(`  FSEvents: ${results.fsevents ? chalk.green('✓ PASS') : chalk.red('✗ FAIL')}`);
  }
  
  if (results.platform === 'linux') {
    console.log(`  inotify: ${results.inotify ? chalk.green('✓ PASS') : chalk.red('✗ FAIL')}`);
  }
  
  console.log(`  Max watched files: ${chalk.white(results.maxWatchedFiles.toLocaleString())}`);
  
  if (results.recommendations.length > 0) {
    console.log(chalk.yellow('\\nRecommendations:'));
    results.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${chalk.cyan(rec)}`);
    });
  }

  if (verbose) {
    console.log(chalk.yellow('\\nDetailed Test Results:'));
    console.log(JSON.stringify(results, null, 2));
  }
}

// Run comprehensive platform diagnostics
export async function runPlatformDiagnostics(options: PlatformTestOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const spinner = createSpinner('Running comprehensive platform diagnostics...');
    spinner.start();

    // Get capabilities
    const capabilities = getPlatformCapabilities();
    
    // Run tests
    const testResults = await testPlatformWatching();
    
    // Test cross-platform watcher
    const watcher = await createCrossPlatformWatcher();
    const watcherStats = watcher.getStats();
    await watcher.stopWatching();

    spinner.stop();

    const diagnostics = {
      timestamp: new Date().toISOString(),
      capabilities,
      testResults,
      watcherStats: {
        platformCapabilities: watcherStats.platformCapabilities,
        activeWatchers: watcherStats.activeWatchers,
        watcherFailures: watcherStats.watcherFailures
      },
      recommendations: generateRecommendations(capabilities, testResults)
    };

    if (json) {
      console.log(JSON.stringify(diagnostics, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n🔍 Platform File Watching Diagnostics\\n'));
    
    displayPlatformCapabilities(capabilities, verbose);
    console.log('');
    displayTestResults(testResults, verbose);
    
    console.log(chalk.cyan('\\n💡 Recommendations\\n'));
    diagnostics.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${chalk.white(rec)}`);
    });

  } catch (error) {
    throw new ValidationError(
      `Platform diagnostics failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Generate platform-specific recommendations
function generateRecommendations(
  capabilities: PlatformCapabilities, 
  testResults: PlatformTestResult
): string[] {
  const recommendations: string[] = [];

  // Basic functionality checks
  if (!testResults.nativeWatching && testResults.polling) {
    recommendations.push('Use polling-based file watching for reliability on this platform');
  }

  if (!testResults.polling) {
    recommendations.push('⚠️  Critical: Polling is not working - file watching may not function properly');
  }

  // Platform-specific recommendations
  switch (capabilities.platform) {
    case 'linux':
      if (capabilities.maxWatchedFiles < 65536) {
        recommendations.push('Consider increasing inotify limits: echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf');
      }
      if (!testResults.inotify) {
        recommendations.push('inotify is not working - check kernel configuration and permissions');
      }
      break;

    case 'darwin':
      if (!testResults.fsevents) {
        recommendations.push('FSEvents is not working - check macOS permissions and disk access');
      }
      recommendations.push('Enable full disk access for your terminal app in System Preferences > Security & Privacy');
      break;

    case 'win32':
      recommendations.push('Enable Developer Mode in Windows Settings for better file watching performance');
      if (capabilities.maxWatchedFiles < 16384) {
        recommendations.push('Consider increasing Windows file watching limits in the registry');
      }
      break;

    default:
      recommendations.push('Unknown platform - use polling for maximum compatibility');
      break;
  }

  // Performance recommendations
  if (capabilities.maxWatchedFiles < 8192) {
    recommendations.push('Low file watching limits detected - consider using selective watching for large projects');
  }

  // General recommendations
  recommendations.push('Use .gitignore patterns to exclude unnecessary files from watching');
  recommendations.push('Consider using workspace-level watching instead of repository-wide watching for better performance');

  return recommendations;
}

// Quick platform check
export async function quickPlatformCheck(): Promise<boolean> {
  try {
    const capabilities = getPlatformCapabilities();
    const testResults = await testPlatformWatching();
    
    // Basic health check
    const isHealthy = testResults.polling || testResults.nativeWatching;
    
    if (!isHealthy) {
      console.log(chalk.red('⚠️  Platform file watching may not work properly'));
      console.log(chalk.gray('   Run: re-shell platform-test --all for detailed diagnostics'));
    }
    
    return isHealthy;
  } catch (error) {
    console.log(chalk.red('⚠️  Failed to check platform file watching capabilities'));
    return false;
  }
}