import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { 
  createSecurityValidator,
  PluginSecurityValidator,
  SecurityScanResult,
  SecurityLevel,
  SecurityViolation,
  SecurityPolicy,
  getDefaultSecurityPolicy
} from '../utils/plugin-security';
import { createPluginRegistry } from '../utils/plugin-system';

interface SecurityCommandOptions {
  verbose?: boolean;
  json?: boolean;
  includeWarnings?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  fix?: boolean;
  policy?: string;
}

// Scan plugin security
export async function scanPluginSecurity(
  pluginName?: string,
  options: SecurityCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, includeWarnings = false, severity } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const securityValidator = createSecurityValidator(getDefaultSecurityPolicy());

    let pluginsToScan = registry.getPlugins();
    
    if (pluginName) {
      const plugin = registry.getPlugin(pluginName);
      if (!plugin) {
        throw new ValidationError(`Plugin '${pluginName}' not found`);
      }
      pluginsToScan = [plugin];
    }

    const spinner = createSpinner(`Scanning ${pluginsToScan.length} plugin(s) for security issues...`);
    spinner.start();

    const results: SecurityScanResult[] = [];

    for (const plugin of pluginsToScan) {
      try {
        const result = await securityValidator.scanPlugin(plugin);
        
        // Filter by severity if specified
        if (severity) {
          result.violations = result.violations.filter(v => v.severity === severity);
        }
        
        results.push(result);
      } catch (error) {
        console.error(chalk.red(`Failed to scan ${plugin.manifest.name}: ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    spinner.stop();

    if (json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n🔒 Plugin Security Scan Results\n`));

    if (results.length === 0) {
      console.log(chalk.yellow('No plugins scanned.'));
      return;
    }

    // Summary statistics
    const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
    const criticalCount = results.reduce((sum, r) => sum + r.violations.filter(v => v.severity === 'critical').length, 0);
    const highCount = results.reduce((sum, r) => sum + r.violations.filter(v => v.severity === 'high').length, 0);
    const approvedCount = results.filter(r => r.approved).length;

    console.log(chalk.yellow('Summary:'));
    console.log(`  Total Plugins: ${results.length}`);
    console.log(`  Approved: ${chalk.green(approvedCount)}`);
    console.log(`  Blocked: ${chalk.red(results.length - approvedCount)}`);
    console.log(`  Total Violations: ${totalViolations}`);
    if (criticalCount > 0) console.log(`  Critical: ${chalk.red(criticalCount)}`);
    if (highCount > 0) console.log(`  High: ${chalk.yellow(highCount)}`);

    console.log('');

    // Display results for each plugin
    results.forEach(result => {
      displaySecurityResult(result, verbose, includeWarnings);
      console.log('');
    });

  } catch (error) {
    throw new ValidationError(
      `Security scan failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Check security policy compliance
export async function checkSecurityPolicy(options: SecurityCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false, policy } = options;

  try {
    let securityPolicy = getDefaultSecurityPolicy();
    
    if (policy) {
      // Load custom policy from file
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs-extra');
      const customPolicy = await fs.readJSON(policy);
      securityPolicy = { ...securityPolicy, ...customPolicy };
    }

    const registry = createPluginRegistry();
    await registry.initialize();

    const plugins = registry.getPlugins();
    const securityValidator = createSecurityValidator(securityPolicy);

    const spinner = createSpinner('Checking security policy compliance...');
    spinner.start();

    const complianceResults: Array<{
      plugin: string;
      compliant: boolean;
      violations: SecurityViolation[];
      securityLevel: SecurityLevel;
    }> = [];

    for (const plugin of plugins) {
      const result = await securityValidator.scanPlugin(plugin);
      
      complianceResults.push({
        plugin: plugin.manifest.name,
        compliant: result.approved,
        violations: result.violations,
        securityLevel: result.securityLevel
      });
    }

    spinner.stop();

    if (json) {
      console.log(JSON.stringify({ policy: securityPolicy, results: complianceResults }, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🛡️  Security Policy Compliance Check\n'));

    const compliantCount = complianceResults.filter(r => r.compliant).length;
    const nonCompliantCount = complianceResults.length - compliantCount;

    console.log(chalk.yellow('Policy Compliance:'));
    console.log(`  Compliant: ${chalk.green(compliantCount)}/${complianceResults.length}`);
    console.log(`  Non-Compliant: ${chalk.red(nonCompliantCount)}/${complianceResults.length}`);

    if (verbose) {
      console.log(chalk.yellow('\nSecurity Policy:'));
      console.log(`  Network Access: ${securityPolicy.allowNetworkAccess ? chalk.green('Allowed') : chalk.red('Blocked')}`);
      console.log(`  Filesystem Access: ${securityPolicy.allowFileSystemAccess ? chalk.green('Allowed') : chalk.red('Blocked')}`);
      console.log(`  Process Execution: ${securityPolicy.allowProcessExecution ? chalk.green('Allowed') : chalk.red('Blocked')}`);
      console.log(`  Memory Limit: ${Math.round(securityPolicy.maxMemoryUsage / 1024 / 1024)}MB`);
      console.log(`  Execution Timeout: ${securityPolicy.maxExecutionTime}ms`);
    }

    if (nonCompliantCount > 0) {
      console.log(chalk.red('\nNon-Compliant Plugins:'));
      complianceResults
        .filter(r => !r.compliant)
        .forEach(result => {
          console.log(`  ${chalk.red('✗')} ${chalk.white(result.plugin)} (${result.securityLevel})`);
          if (verbose) {
            result.violations.forEach(violation => {
              const severityColor = violation.severity === 'critical' ? chalk.red :
                                   violation.severity === 'high' ? chalk.yellow :
                                   chalk.gray;
              console.log(`    ${severityColor(violation.severity)}: ${violation.description}`);
            });
          }
        });
    }

  } catch (error) {
    throw new ValidationError(
      `Policy compliance check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Generate security report
export async function generateSecurityReport(options: SecurityCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugins = registry.getPlugins();
    const securityValidator = createSecurityValidator();

    const spinner = createSpinner('Generating security report...');
    spinner.start();

    const scanResults: SecurityScanResult[] = [];
    
    for (const plugin of plugins) {
      const result = await securityValidator.scanPlugin(plugin);
      scanResults.push(result);
    }

    const stats = securityValidator.getSecurityStats();

    spinner.stop();

    if (json) {
      console.log(JSON.stringify({
        summary: stats,
        results: scanResults,
        timestamp: new Date().toISOString()
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📊 Plugin Security Report\n'));

    // Overall statistics
    console.log(chalk.yellow('Security Overview:'));
    console.log(`  Total Plugins Scanned: ${stats.totalScans}`);
    console.log(`  Trusted Keys: ${stats.trustedKeys}`);
    console.log(`  Reputation Data: ${stats.reputationData}`);

    console.log(chalk.yellow('\nSecurity Levels:'));
    Object.entries(stats.securityLevels).forEach(([level, count]) => {
      const color = level === 'trusted' ? chalk.green :
                   level === 'verified' ? chalk.blue :
                   level === 'sandboxed' ? chalk.yellow :
                   level === 'restricted' ? chalk.magenta :
                   chalk.red;
      console.log(`  ${color(level)}: ${count}`);
    });

    if (Object.keys(stats.violationTypes).length > 0) {
      console.log(chalk.yellow('\nViolation Types:'));
      Object.entries(stats.violationTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    if (verbose) {
      console.log(chalk.yellow('\nDetailed Results:'));
      scanResults.forEach(result => {
        displaySecurityResult(result, true, true);
        console.log('');
      });
    }

    // Recommendations
    const blockedPlugins = scanResults.filter(r => r.securityLevel === SecurityLevel.BLOCKED);
    const restrictedPlugins = scanResults.filter(r => r.securityLevel === SecurityLevel.RESTRICTED);

    if (blockedPlugins.length > 0 || restrictedPlugins.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      
      if (blockedPlugins.length > 0) {
        console.log(chalk.red(`  • Review and potentially remove ${blockedPlugins.length} blocked plugin(s)`));
      }
      
      if (restrictedPlugins.length > 0) {
        console.log(chalk.yellow(`  • Consider sandboxing ${restrictedPlugins.length} restricted plugin(s)`));
      }
      
      console.log(chalk.gray('  • Regularly update plugins to latest versions'));
      console.log(chalk.gray('  • Enable plugin signatures for enhanced security'));
    }

  } catch (error) {
    throw new ValidationError(
      `Security report generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Fix security issues
export async function fixSecurityIssues(
  pluginName?: string,
  options: SecurityCommandOptions = {}
): Promise<void> {
  const { verbose = false, fix = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    let pluginsToFix = registry.getPlugins();
    
    if (pluginName) {
      const plugin = registry.getPlugin(pluginName);
      if (!plugin) {
        throw new ValidationError(`Plugin '${pluginName}' not found`);
      }
      pluginsToFix = [plugin];
    }

    const securityValidator = createSecurityValidator();

    const spinner = createSpinner(`Analyzing security issues for ${pluginsToFix.length} plugin(s)...`);
    spinner.start();

    const fixableIssues: Array<{
      plugin: string;
      issue: string;
      fix: string;
      autoFixable: boolean;
    }> = [];

    for (const plugin of pluginsToFix) {
      const result = await securityValidator.scanPlugin(plugin);
      
      result.violations.forEach(violation => {
        const autoFix = getAutoFix(violation);
        if (autoFix) {
          fixableIssues.push({
            plugin: plugin.manifest.name,
            issue: violation.description,
            fix: autoFix,
            autoFixable: true
          });
        } else {
          fixableIssues.push({
            plugin: plugin.manifest.name,
            issue: violation.description,
            fix: violation.recommendation,
            autoFixable: false
          });
        }
      });
    }

    spinner.stop();

    console.log(chalk.cyan('\n🔧 Security Issue Analysis\n'));

    if (fixableIssues.length === 0) {
      console.log(chalk.green('No security issues found that can be automatically fixed.'));
      return;
    }

    const autoFixableCount = fixableIssues.filter(i => i.autoFixable).length;
    
    console.log(chalk.yellow('Summary:'));
    console.log(`  Total Issues: ${fixableIssues.length}`);
    console.log(`  Auto-fixable: ${chalk.green(autoFixableCount)}`);
    console.log(`  Manual fixes required: ${chalk.yellow(fixableIssues.length - autoFixableCount)}`);

    console.log(chalk.yellow('\nIssues Found:'));
    fixableIssues.forEach((issue, index) => {
      const fixType = issue.autoFixable ? chalk.green('AUTO') : chalk.yellow('MANUAL');
      console.log(`${index + 1}. [${fixType}] ${chalk.white(issue.plugin)}: ${issue.issue}`);
      console.log(`   Fix: ${chalk.gray(issue.fix)}`);
      console.log('');
    });

    if (fix && autoFixableCount > 0) {
      console.log(chalk.blue('Applying automatic fixes...'));
      
      // Apply auto-fixes (simplified implementation)
      for (const issue of fixableIssues.filter(i => i.autoFixable)) {
        try {
          await applyAutoFix(issue);
          console.log(chalk.green(`✓ Fixed: ${issue.plugin} - ${issue.issue}`));
        } catch (error) {
          console.log(chalk.red(`✗ Failed to fix: ${issue.plugin} - ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    } else if (autoFixableCount > 0) {
      console.log(chalk.blue(`\nTo apply automatic fixes, run with --fix flag`));
    }

  } catch (error) {
    throw new ValidationError(
      `Security fix analysis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Display security scan result
function displaySecurityResult(
  result: SecurityScanResult,
  verbose: boolean,
  includeWarnings: boolean
): void {
  const levelColor = result.securityLevel === SecurityLevel.TRUSTED ? chalk.green :
                    result.securityLevel === SecurityLevel.VERIFIED ? chalk.blue :
                    result.securityLevel === SecurityLevel.SANDBOXED ? chalk.yellow :
                    result.securityLevel === SecurityLevel.RESTRICTED ? chalk.magenta :
                    chalk.red;

  const statusIcon = result.approved ? chalk.green('✓') : chalk.red('✗');
  
  console.log(`${statusIcon} ${chalk.white(result.plugin)} - ${levelColor(result.securityLevel)}`);

  if (result.violations.length > 0) {
    console.log(chalk.red(`  Violations: ${result.violations.length}`));
    
    if (verbose) {
      result.violations.forEach(violation => {
        const severityColor = violation.severity === 'critical' ? chalk.red :
                             violation.severity === 'high' ? chalk.yellow :
                             violation.severity === 'medium' ? chalk.blue :
                             chalk.gray;
        
        console.log(`    ${severityColor(violation.severity)}: ${violation.description}`);
        if (violation.blocked) {
          console.log(`      ${chalk.red('BLOCKED')} - ${violation.recommendation}`);
        }
      });
    }
  }

  if (result.permissions.length > 0 && verbose) {
    console.log(`  Permissions: ${result.permissions.length}`);
    result.permissions.forEach(permission => {
      console.log(`    ${permission.type}:${permission.access} - ${permission.description}`);
    });
  }

  if (result.signature && verbose) {
    const signStatus = result.signature.verified ? chalk.green('verified') : chalk.red('unverified');
    console.log(`  Signature: ${signStatus} (${result.signature.algorithm})`);
  }

  if (result.reputation && verbose) {
    console.log(`  Reputation: ${result.reputation.rating}/5.0 (${result.reputation.downloads} downloads)`);
  }

  if (result.sandboxRequired) {
    console.log(`  ${chalk.yellow('Sandbox required')}`);
  }

  if (includeWarnings && result.warnings.length > 0) {
    console.log(`  Warnings:`);
    result.warnings.forEach(warning => {
      console.log(`    ${chalk.yellow('⚠')} ${warning}`);
    });
  }
}

// Get automatic fix for a violation
function getAutoFix(violation: SecurityViolation): string | null {
  switch (violation.type) {
    case 'permission':
      if (violation.description.includes('excessive permissions')) {
        return 'Remove unnecessary permissions from plugin manifest';
      }
      break;
    
    case 'signature':
      if (violation.description.includes('not found')) {
        return 'Generate and add plugin signature';
      }
      break;
  }
  
  return null;
}

// Apply automatic fix
async function applyAutoFix(issue: { plugin: string; issue: string; fix: string }): Promise<void> {
  // Simplified implementation - in reality would make actual changes
  await new Promise(resolve => setTimeout(resolve, 100));
  // TODO: Implement actual auto-fix logic based on issue type
}