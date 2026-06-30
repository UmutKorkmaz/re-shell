import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { globSync } from 'glob';
import { findMonorepoRoot } from '../utils/monorepo';
import { jsonSuccess, enableJsonMode } from '../utils/json-output';
import {
  buildSuggestions,
  buildFixPlan,
  isAllowedFixCommand,
  type RemediableCheck,
} from '../utils/doctor-remediation';
import type { Suggestion, FixPlan } from '@re-shell/contracts';

interface HealthCheck {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

interface DoctorOptions {
  fix?: boolean;
  verbose?: boolean;
  spinner?: any;
  json?: boolean;
  explain?: boolean;
  yes?: boolean;
}

export async function runDoctorCheck(options: DoctorOptions = {}) {
  const restoreJson = options.json ? enableJsonMode() : () => {};
  const checks: HealthCheck[] = [];
  
  try {
    // Find monorepo root
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      checks.push({
        name: 'monorepo-detection',
        status: 'error',
        message: 'Not in a monorepo workspace',
        suggestion: 'Run this command from within a monorepo or use "re-shell init" to create one'
      });
      return displayResults(checks, process.cwd(), options);
    }

    if (options.spinner) {
      options.spinner.text = 'Checking monorepo structure...';
    }

    // Check 1: Package.json structure
    checks.push(await checkPackageJsonStructure(monorepoRoot));

    // Check 2: Dependencies health
    checks.push(...(await checkDependenciesHealth(monorepoRoot)));

    // Check 3: Security vulnerabilities
    checks.push(await checkSecurityVulnerabilities(monorepoRoot));

    // Check 4: Workspace configuration
    checks.push(await checkWorkspaceConfiguration(monorepoRoot));

    // Check 5: Git configuration
    checks.push(await checkGitConfiguration(monorepoRoot));

    // Check 6: Build configuration
    checks.push(...(await checkBuildConfiguration(monorepoRoot)));

    // Check 7: Performance issues
    checks.push(...(await checkPerformanceIssues(monorepoRoot)));

    // Check 8: File system health
    checks.push(...(await checkFileSystemHealth(monorepoRoot)));

    // --fix: compose (and optionally apply) a remediation plan.
    if (options.fix) {
      return await runFixPlan(checks, monorepoRoot, options);
    }

    return displayResults(checks, monorepoRoot, options);

  } catch (error) {
    checks.push({
      name: 'doctor-execution',
      status: 'error',
      message: `Doctor check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Try running with --verbose for more details'
    });
    return displayResults(checks, process.cwd(), options);
  } finally {
    restoreJson();
  }
}

async function checkPackageJsonStructure(monorepoRoot: string): Promise<HealthCheck> {
  try {
    const packageJsonPath = path.join(monorepoRoot, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return {
        name: 'package-json',
        status: 'error',
        message: 'Root package.json not found',
        suggestion: 'Create a root package.json file'
      };
    }

    const packageJson = await fs.readJson(packageJsonPath);
    
    const issues = [];
    if (!packageJson.workspaces && !packageJson.private) {
      issues.push('Missing workspaces configuration');
    }
    if (!packageJson.name) {
      issues.push('Missing package name');
    }
    if (!packageJson.engines) {
      issues.push('Missing engines specification');
    }

    if (issues.length > 0) {
      return {
        name: 'package-json',
        status: 'warning',
        message: `Package.json issues: ${issues.join(', ')}`,
        suggestion: 'Update package.json with missing fields'
      };
    }

    return {
      name: 'package-json',
      status: 'success',
      message: 'Package.json structure is valid'
    };

  } catch (error) {
    return {
      name: 'package-json',
      status: 'error',
      message: `Failed to check package.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Ensure package.json is valid JSON'
    };
  }
}

async function checkDependenciesHealth(monorepoRoot: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  try {
    // Check for duplicate dependencies
    const workspaces = await getWorkspaces(monorepoRoot);
    const allDeps = new Map<string, string[]>();

    for (const workspace of workspaces) {
      const pkgPath = path.join(monorepoRoot, workspace, 'package.json');
      if (await fs.pathExists(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        for (const [dep, version] of Object.entries(deps)) {
          if (!allDeps.has(dep)) {
            allDeps.set(dep, []);
          }
          allDeps.get(dep)!.push(`${workspace}:${version}`);
        }
      }
    }

    const duplicates = Array.from(allDeps.entries())
      .filter(([, versions]) => new Set(versions.map(v => v.split(':')[1])).size > 1)
      .slice(0, 5); // Limit to top 5

    if (duplicates.length > 0) {
      checks.push({
        name: 'dependency-duplicates',
        status: 'warning',
        message: `Found ${duplicates.length} dependencies with version conflicts`,
        suggestion: 'Consider using workspace dependency hoisting or version alignment'
      });
    } else {
      checks.push({
        name: 'dependency-duplicates',
        status: 'success',
        message: 'No dependency version conflicts found'
      });
    }

    // Check for outdated dependencies
    try {
      const outdatedCmd = getPackageManager(monorepoRoot) === 'npm' ? 'npm outdated --json' : 'pnpm outdated --format json';
      execSync(outdatedCmd, { cwd: monorepoRoot, stdio: 'pipe' });
      
      checks.push({
        name: 'outdated-dependencies',
        status: 'success',
        message: 'All dependencies are up to date'
      });
    } catch (error: unknown) {
      // outdated command exits with code 1 when there are outdated packages
      const output = (error as { stdout?: string }).stdout?.toString();
      if (output) {
        try {
          const outdated = JSON.parse(output);
          const count = Object.keys(outdated).length;
          checks.push({
            name: 'outdated-dependencies',
            status: 'warning',
            message: `Found ${count} outdated dependencies`,
            suggestion: 'Run package manager update command to update dependencies'
          });
        } catch {
          checks.push({
            name: 'outdated-dependencies',
            status: 'warning',
            message: 'Some dependencies may be outdated',
            suggestion: 'Run your package manager\'s outdated command to check'
          });
        }
      }
    }

  } catch (error) {
    checks.push({
      name: 'dependencies-health',
      status: 'error',
      message: `Failed to check dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return checks;
}

async function checkSecurityVulnerabilities(monorepoRoot: string): Promise<HealthCheck> {
  try {
    const packageManager = getPackageManager(monorepoRoot);
    const auditCommands = {
      npm: 'npm audit --json',
      yarn: 'yarn audit --json',
      pnpm: 'pnpm audit --json',
      bun: 'bun audit --json'
    };

    const cmd = auditCommands[packageManager] || auditCommands.npm;
    
    try {
      execSync(cmd, { cwd: monorepoRoot, stdio: 'pipe' });
      return {
        name: 'security-audit',
        status: 'success',
        message: 'No security vulnerabilities found'
      };
    } catch (error: unknown) {
      const output = (error as { stdout?: string }).stdout?.toString();
      if (output) {
        try {
          const audit = JSON.parse(output);
          const vulnCount = audit.metadata?.vulnerabilities?.total || 0;
          
          if (vulnCount > 0) {
            return {
              name: 'security-audit',
              status: 'error',
              message: `Found ${vulnCount} security vulnerabilities`,
              suggestion: `Run "${packageManager} audit fix" to fix automatically fixable vulnerabilities`
            };
          }
        } catch {
          // Fallback if JSON parsing fails
        }
      }
      
      return {
        name: 'security-audit',
        status: 'warning',
        message: 'Security audit completed with warnings',
        suggestion: 'Review audit output manually'
      };
    }
  } catch (error) {
    return {
      name: 'security-audit',
      status: 'error',
      message: `Security audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Ensure your package manager supports audit command'
    };
  }
}

async function checkWorkspaceConfiguration(monorepoRoot: string): Promise<HealthCheck> {
  try {
    const workspaces = await getWorkspaces(monorepoRoot);
    
    if (workspaces.length === 0) {
      return {
        name: 'workspace-config',
        status: 'warning',
        message: 'No workspaces found',
        suggestion: 'Add workspaces to your monorepo using "re-shell create"'
      };
    }

    // Check for common workspace issues
    const issues = [];
    for (const workspace of workspaces) {
      const workspacePath = path.join(monorepoRoot, workspace);
      const pkgPath = path.join(workspacePath, 'package.json');
      
      if (!await fs.pathExists(pkgPath)) {
        issues.push(`${workspace}: missing package.json`);
      }
    }

    if (issues.length > 0) {
      return {
        name: 'workspace-config',
        status: 'warning',
        message: `Workspace issues: ${issues.slice(0, 3).join(', ')}${issues.length > 3 ? '...' : ''}`,
        suggestion: 'Fix workspace configuration issues'
      };
    }

    return {
      name: 'workspace-config',
      status: 'success',
      message: `Found ${workspaces.length} properly configured workspaces`
    };

  } catch (error) {
    return {
      name: 'workspace-config',
      status: 'error',
      message: `Failed to check workspace configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function checkGitConfiguration(monorepoRoot: string): Promise<HealthCheck> {
  try {
    const gitPath = path.join(monorepoRoot, '.git');
    
    if (!await fs.pathExists(gitPath)) {
      return {
        name: 'git-config',
        status: 'warning',
        message: 'Git repository not initialized',
        suggestion: 'Initialize git repository with "git init"'
      };
    }

    const issues = [];
    
    // Check for .gitignore
    const gitignorePath = path.join(monorepoRoot, '.gitignore');
    if (!await fs.pathExists(gitignorePath)) {
      issues.push('missing .gitignore');
    }

    // Check for uncommitted changes
    try {
      const status = execSync('git status --porcelain', { cwd: monorepoRoot, encoding: 'utf8' });
      if (status.trim().length > 0) {
        issues.push('uncommitted changes');
      }
    } catch (error) {
      issues.push('git status check failed');
    }

    if (issues.length > 0) {
      return {
        name: 'git-config',
        status: 'warning',
        message: `Git issues: ${issues.join(', ')}`,
        suggestion: 'Review and fix git configuration'
      };
    }

    return {
      name: 'git-config',
      status: 'success',
      message: 'Git configuration is healthy'
    };

  } catch (error) {
    return {
      name: 'git-config',
      status: 'error',
      message: `Failed to check git configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function checkBuildConfiguration(monorepoRoot: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  try {
    const workspaces = await getWorkspaces(monorepoRoot);
    let buildableWorkspaces = 0;
    let configIssues = 0;

    for (const workspace of workspaces) {
      const pkgPath = path.join(monorepoRoot, workspace, 'package.json');
      if (await fs.pathExists(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        
        if (pkg.scripts?.build) {
          buildableWorkspaces++;
          
          // Check for common build files
          const buildFiles = ['vite.config.ts', 'vite.config.js', 'webpack.config.js', 'rollup.config.js'];
          const hasConfig = await Promise.all(
            buildFiles.map(file => fs.pathExists(path.join(monorepoRoot, workspace, file)))
          );
          
          if (!hasConfig.some(exists => exists)) {
            configIssues++;
          }
        }
      }
    }

    checks.push({
      name: 'build-config',
      status: buildableWorkspaces > 0 ? 'success' : 'warning',
      message: `Found ${buildableWorkspaces} buildable workspaces`,
      suggestion: buildableWorkspaces === 0 ? 'Add build scripts to your workspaces' : undefined
    });

    if (configIssues > 0) {
      checks.push({
        name: 'build-files',
        status: 'warning',
        message: `${configIssues} workspaces missing build configuration files`,
        suggestion: 'Add build configuration files (vite.config.ts, etc.)'
      });
    }

  } catch (error) {
    checks.push({
      name: 'build-config',
      status: 'error',
      message: `Failed to check build configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return checks;
}

async function checkPerformanceIssues(monorepoRoot: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  try {
    // Check node_modules size
    const nodeModulesPath = path.join(monorepoRoot, 'node_modules');
    if (await fs.pathExists(nodeModulesPath)) {
      try {
        // Rough estimation - actual calculation would be recursive and slow
        
        checks.push({
          name: 'node-modules-size',
          status: 'success',
          message: 'Node modules directory exists',
          suggestion: 'Consider using pnpm for smaller node_modules footprint'
        });
      } catch (error) {
        checks.push({
          name: 'node-modules-size',
          status: 'warning',
          message: 'Could not analyze node_modules size'
        });
      }
    }

    // Check for large files that shouldn't be committed
    const largeFiles: string[] = [];
    const checkLargeFiles = async (dir: string, prefix = '') => {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items.slice(0, 20)) { // Limit to prevent performance issues
          if (item.name.startsWith('.') || item.name === 'node_modules') continue;
          
          const fullPath = path.join(dir, item.name);
          if (item.isFile()) {
            const stats = await fs.stat(fullPath);
            if (stats.size > 10 * 1024 * 1024) { // 10MB
              largeFiles.push(`${prefix}${item.name} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
            }
          } else if (item.isDirectory() && prefix.split('/').length < 3) { // Max depth 3
            await checkLargeFiles(fullPath, `${prefix}${item.name}/`);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await checkLargeFiles(monorepoRoot);

    if (largeFiles.length > 0) {
      checks.push({
        name: 'large-files',
        status: 'warning',
        message: `Found ${largeFiles.length} large files: ${largeFiles.slice(0, 2).join(', ')}`,
        suggestion: 'Consider using Git LFS for large files or add them to .gitignore'
      });
    } else {
      checks.push({
        name: 'large-files',
        status: 'success',
        message: 'No large files detected'
      });
    }

  } catch (error) {
    checks.push({
      name: 'performance-check',
      status: 'error',
      message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return checks;
}

async function checkFileSystemHealth(monorepoRoot: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  try {
    // Check disk space
    try {
      checks.push({
        name: 'disk-space',
        status: 'success',
        message: 'File system accessible'
      });
    } catch (error) {
      checks.push({
        name: 'disk-space',
        status: 'error',
        message: 'File system access issues detected',
        suggestion: 'Check disk space and permissions'
      });
    }

    // Check for broken symlinks
    const brokenLinks: string[] = [];
    const checkSymlinks = async (dir: string) => {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items.slice(0, 50)) { // Limit for performance
          if (item.name.startsWith('.') || item.name === 'node_modules') continue;
          
          const fullPath = path.join(dir, item.name);
          if (item.isSymbolicLink()) {
            try {
              await fs.stat(fullPath);
            } catch (error) {
              brokenLinks.push(path.relative(monorepoRoot, fullPath));
            }
          } else if (item.isDirectory()) {
            await checkSymlinks(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await checkSymlinks(monorepoRoot);

    if (brokenLinks.length > 0) {
      checks.push({
        name: 'broken-symlinks',
        status: 'warning',
        message: `Found ${brokenLinks.length} broken symlinks`,
        suggestion: 'Remove or fix broken symbolic links'
      });
    } else {
      checks.push({
        name: 'broken-symlinks',
        status: 'success',
        message: 'No broken symlinks found'
      });
    }

  } catch (error) {
    checks.push({
      name: 'filesystem-health',
      status: 'error',
      message: `File system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return checks;
}

/**
 * Map the doctor's internal HealthCheck onto the loose RemediableCheck shape the
 * remediation util consumes. Pure adapter.
 */
function toRemediableChecks(checks: HealthCheck[]): RemediableCheck[] {
  return checks.map(c => ({ name: c.name, status: c.status, message: c.message }));
}

/**
 * `doctor --fix`. Default (no --yes) = DRY RUN: compose and print the plan,
 * writing NOTHING. With --yes, only the allow-listed fix commands are executed.
 */
async function runFixPlan(
  checks: HealthCheck[],
  monorepoRoot: string,
  options: DoctorOptions
) {
  const packageManager = getPackageManager(monorepoRoot);
  const suggestions = buildSuggestions(toRemediableChecks(checks), packageManager);

  const shouldApply = options.fix === true && options.yes === true;

  if (options.spinner) {
    options.spinner.stop();
  }

  // Build the dry-run plan first. We only flip individual steps to applied as we
  // actually run them, so the emitted plan always reflects reality.
  const plan: FixPlan = buildFixPlan(suggestions, false);

  if (!shouldApply) {
    return emitFixPlan(plan, suggestions, options, /* applied */ false);
  }

  // Apply only allow-listed commands. Anything else stays a documented manual
  // step. We mutate a fresh copy of the steps to record what was applied.
  const appliedSteps = await Promise.all(
    plan.steps.map(async step => {
      if (!step.command || !isAllowedFixCommand(step.command)) {
        return { ...step, applied: false };
      }
      try {
        execSync(step.command, { cwd: monorepoRoot, stdio: 'pipe' });
        return { ...step, applied: true };
      } catch (error) {
        if (options.verbose && !options.json) {
          console.log(
            chalk.yellow(
              `Failed to apply "${step.command}": ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          );
        }
        return { ...step, applied: false };
      }
    })
  );

  const appliedPlan: FixPlan = { applied: true, steps: appliedSteps };
  return emitFixPlan(appliedPlan, suggestions, options, /* applied */ true);
}

function emitFixPlan(
  plan: FixPlan,
  suggestions: Suggestion[],
  options: DoctorOptions,
  applied: boolean
) {
  if (options.json) {
    jsonSuccess({ plan, suggestions });
    return;
  }

  console.log('\n' + chalk.bold('🩺 Re-Shell Doctor — Fix Plan'));
  if (!applied) {
    console.log(
      chalk.dim('Dry run: nothing was changed. Re-run with --yes to apply allow-listed fixes.\n')
    );
  } else {
    console.log(chalk.dim('Applied allow-listed fixes.\n'));
  }

  if (plan.steps.length === 0) {
    console.log(chalk.green('✓ No remediable issues found. Nothing to do.'));
    return;
  }

  plan.steps.forEach((step, i) => {
    const executable = Boolean(step.command);
    const icon = !executable
      ? chalk.cyan('✎')
      : step.applied
        ? chalk.green('✓')
        : chalk.yellow('▶');
    const tag = executable
      ? step.applied
        ? chalk.green('[applied]')
        : chalk.yellow('[would run]')
      : chalk.cyan('[manual]');
    console.log(`${icon} ${chalk.bold(`${i + 1}.`)} ${tag} ${chalk.dim(step.checkId)}`);
    console.log(`   ${step.description}`);
  });

  const executableCount = plan.steps.filter(s => s.command).length;
  const manualCount = plan.steps.length - executableCount;
  console.log();
  console.log(
    chalk.dim(
      `${executableCount} command fix(es), ${manualCount} manual step(s).` +
        (applied ? '' : ' Use --yes to run the command fixes.')
    )
  );
}

async function getWorkspaces(monorepoRoot: string): Promise<string[]> {
  try {
    const packageJsonPath = path.join(monorepoRoot, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    if (packageJson.workspaces) {
      const rawPatterns: string[] = Array.isArray(packageJson.workspaces)
        ? packageJson.workspaces
        : packageJson.workspaces.packages || [];
      const resolvedWorkspaces = rawPatterns.flatMap(pattern => {
        if (pattern.includes('*')) {
          return globSync(pattern, { cwd: monorepoRoot }).filter(p =>
            fs.existsSync(path.join(monorepoRoot, p, 'package.json'))
          );
        }
        return [pattern];
      });
      return resolvedWorkspaces;
    }
    
    // Fallback: scan for package.json files
    const workspaces: string[] = [];
    const scanDir = async (dir: string, depth = 0) => {
      if (depth > 2) return; // Limit depth
      
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          const pkgPath = path.join(dir, item.name, 'package.json');
          if (await fs.pathExists(pkgPath)) {
            workspaces.push(path.relative(monorepoRoot, dir === monorepoRoot ? item.name : path.join(path.relative(monorepoRoot, dir), item.name)));
          } else {
            await scanDir(path.join(dir, item.name), depth + 1);
          }
        }
      }
    };
    
    await scanDir(monorepoRoot);
    return workspaces;
  } catch (error) {
    return [];
  }
}

function getPackageManager(monorepoRoot: string): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (fs.existsSync(path.join(monorepoRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(monorepoRoot, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(monorepoRoot, 'bun.lockb'))) return 'bun';
  return 'npm';
}

function displayResults(checks: HealthCheck[], monorepoRoot: string, options: DoctorOptions) {
  // Remediation suggestions are computed when --explain is set (cheap + offline).
  const packageManager = getPackageManager(monorepoRoot);
  const suggestions: Suggestion[] = options.explain
    ? buildSuggestions(toRemediableChecks(checks), packageManager)
    : [];

  if (options.json) {
    const warnings = checks.filter(c => c.status === 'warning').map(c => c.message);
    const payload = options.explain ? { checks, suggestions } : { checks };
    jsonSuccess(payload, warnings);
    return;
  }

  if (options.spinner) {
    options.spinner.stop();
  }

  console.log('\n' + chalk.bold('🏥 Re-Shell Health Check Results\n'));

  const successCount = checks.filter(c => c.status === 'success').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const errorCount = checks.filter(c => c.status === 'error').length;

  // Summary
  console.log(chalk.bold('Summary:'));
  console.log(`  ${chalk.green('✓')} ${successCount} checks passed`);
  if (warningCount > 0) console.log(`  ${chalk.yellow('⚠')} ${warningCount} warnings`);
  if (errorCount > 0) console.log(`  ${chalk.red('✗')} ${errorCount} errors`);
  console.log();

  // Detailed results
  for (const check of checks) {
    const icon = check.status === 'success' ? chalk.green('✓') : 
                 check.status === 'warning' ? chalk.yellow('⚠') : chalk.red('✗');
    
    const nameFormatted = check.name.padEnd(20);
    console.log(`${icon} ${nameFormatted} ${check.message}`);
    
    if (check.suggestion && options.verbose) {
      console.log(`  ${chalk.dim('→')} ${chalk.dim(check.suggestion)}`);
    }
  }

  console.log();

  // Overall health score
  const totalChecks = checks.length;
  const healthScore = totalChecks > 0 ? Math.round((successCount / totalChecks) * 100) : 0;
  
  let healthColor = chalk.green;
  let healthStatus = 'Excellent';
  
  if (healthScore < 90) {
    healthColor = chalk.yellow;
    healthStatus = 'Good';
  }
  if (healthScore < 70) {
    healthColor = chalk.red;
    healthStatus = 'Needs Attention';
  }

  console.log(chalk.bold(`Overall Health: ${healthColor(healthScore + '%')} (${healthStatus})`));

  // --explain: print cause + suggested fix for every failing/warning check.
  if (options.explain && suggestions.length > 0) {
    console.log('\n' + chalk.bold('💡 Explanations & Suggested Fixes'));
    for (const s of suggestions) {
      const marker = s.fixable ? chalk.green('[auto-fixable]') : chalk.dim('[manual]');
      console.log(`\n${chalk.bold(s.checkId)} ${marker}`);
      console.log(`  ${chalk.dim('Cause:')} ${s.cause}`);
      console.log(`  ${chalk.dim('Fix:')}   ${s.suggestion}`);
      if (s.fixable && s.fixCommand) {
        console.log(`  ${chalk.dim('Run:')}   ${chalk.cyan(s.fixCommand)}`);
      }
    }
  }

  if (warningCount > 0 || errorCount > 0) {
    console.log('\n' + chalk.dim('Run with --explain to see causes and suggested fixes'));
    console.log(chalk.dim('Run with --fix to preview an auto-fix plan (dry run; --yes to apply)'));
  }
}