import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { registerProfileSubgroups } from './profile-subgroups';

/**
 * Renders a profile inheritance tree to stdout. Module-level helper used by the
 * `config profile tree` command (carried over verbatim from config.group.ts).
 */
interface TreeNode {
  name: string;
  children?: TreeNode[];
}

function printTree(node: TreeNode, depth: number): void {
  const indent = '  '.repeat(depth);
  const connector = depth > 0 ? '└─ ' : '';
  console.log(`${indent}${connector}${node.name}`);

  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => printTree(child, depth + 1));
  }
}

/**
 * Registers the `config profile` section. The env/template subgroups live in
 * ./profile-subgroups to keep this module under the 800-line limit.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerProfileGroup(config: Command): void {
  // --- config profile ---
  const profileGroup = config.command('profile')
    .description('Manage environment-specific configuration profiles');

  profileGroup
    .command('list')
    .description('List all available profiles')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading profiles...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { manageProfiles } = await import('../../commands/profile');
          await manageProfiles({ ...options, spinner });
        }, 10000);

        spinner.stop();
      })
    );

  profileGroup
    .command('create')
    .description('Create a new environment profile')
    .option('--framework <framework>', 'Framework to create profile for')
    .option('--interactive', 'Interactive profile creation')
    .action(
      createAsyncCommand(async (options) => {
        const { manageProfiles } = await import('../../commands/profile');
        await manageProfiles({ ...options, create: true });
      })
    );

  profileGroup
    .command('activate <name>')
    .description('Activate a profile')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Activating profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { manageProfiles } = await import('../../commands/profile');
          await manageProfiles({ ...options, activate: name, spinner });
        }, 10000);

        spinner.stop();
      })
    );

  profileGroup
    .command('show <name>')
    .description('Show profile details')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Loading profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { manageProfiles } = await import('../../commands/profile');
          await manageProfiles({ ...options, show: name, spinner });
        }, 10000);

        spinner.stop();
      })
    );

  profileGroup
    .command('delete <name>')
    .description('Delete a profile')
    .action(
      createAsyncCommand(async (name, options) => {
        const { manageProfiles } = await import('../../commands/profile');
        await manageProfiles({ ...options, delete: name });
      })
    );

  profileGroup
    .command('validate <name>')
    .description('Validate profile inheritance and check for conflicts')
    .option('--cross-language', 'Enable cross-language validation')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Validating profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateProfileCrossLanguage } = await import('../../commands/profile');
          const result = await validateProfileCrossLanguage(name);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n🔍 Profile Validation: ${name}\n`));

          if (result.language) {
            console.log(chalk.gray(`Language: ${result.language}`));
            console.log('');
          }

          if (result.valid) {
            console.log(chalk.green(`✓ Profile is valid\n`));
          } else {
            console.log(chalk.red(`✗ Profile has validation errors\n`));
          }

          if (result.errors.length > 0) {
            console.log(chalk.red('Errors:'));
            result.errors.forEach(error => {
              console.log(chalk.red(`  ✗ ${error}`));
            });
            console.log('');
          }

          if (result.warnings.length > 0) {
            console.log(chalk.yellow('Warnings:'));
            result.warnings.forEach(warning => {
              console.log(chalk.gray(`  ⚠ ${warning}`));
            });
            console.log('');
          }

          if (result.suggestions.length > 0) {
            console.log(chalk.cyan('Suggestions:'));
            result.suggestions.forEach(suggestion => {
              console.log(chalk.gray(`  → ${suggestion}`));
            });
            console.log('');
          }
        }, 10000);
      })
    );

  profileGroup
    .command('validate-all')
    .description('Validate all profiles for cross-language compatibility')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating all profiles...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateAllProfiles } = await import('../../commands/profile');
          const { profiles, summary } = await validateAllProfiles();

          spinner.stop();

          console.log(chalk.cyan.bold('\n🔍 Profile Validation Summary\n'));
          console.log(chalk.gray(`Total: ${summary.total} | Valid: ${summary.valid} | Invalid: ${summary.invalid}\n`));

          if (Object.keys(summary.byLanguage).length > 0) {
            console.log(chalk.gray('Profiles by Language:'));
            Object.entries(summary.byLanguage).forEach(([lang, count]) => {
              console.log(chalk.gray(`  ${lang}: ${count}`));
            });
            console.log('');
          }

          Object.entries(profiles).forEach(([name, result]) => {
            const status = result.valid ? chalk.green('✓') : chalk.red('✗');
            const lang = result.language ? chalk.gray(`(${result.language})`) : '';
            console.log(`${status} ${name} ${lang}`);

            if (!result.valid && result.errors.length > 0) {
              result.errors.slice(0, 2).forEach(error => {
                console.log(chalk.red(`    ✗ ${error}`));
              });
              if (result.errors.length > 2) {
                console.log(chalk.gray(`    ... and ${result.errors.length - 2} more errors`));
              }
            }

            if (result.warnings.length > 0) {
              result.warnings.slice(0, 1).forEach(warning => {
                console.log(chalk.yellow(`    ⚠ ${warning}`));
              });
              if (result.warnings.length > 1) {
                console.log(chalk.gray(`    ... and ${result.warnings.length - 1} more warnings`));
              }
            }
          });
          console.log('');
        }, 15000);
      })
    );

  profileGroup
    .command('tree <name>')
    .description('Show profile inheritance tree')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Loading profile tree...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { getProfileTree } = await import('../../commands/profile');
          const tree = await getProfileTree(name);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n🌳 Profile Inheritance Tree: ${name}\n`));
          printTree(tree as TreeNode, 0);
          console.log('');
        }, 10000);
      })
    );

  profileGroup
    .command('export <name>')
    .description('Export profile with all inherited properties resolved')
    .option('--output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Exporting profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { exportProfile } = await import('../../commands/profile');
          const exported = await exportProfile(name);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n📤 Exported Profile: ${name}\n`));
          console.log(chalk.gray(`Inherits from: ${exported.inheritedFrom.join(', ') || 'None'}\n`));
          console.log(chalk.gray('Final Configuration:'));
          console.log(chalk.gray(JSON.stringify(exported.finalConfig, null, 2)));
          console.log('');

          if (options.output) {
            const fsExtra = await import('fs-extra');
            const pathMod = await import('path');
            const outputPath = pathMod.join(process.cwd(), options.output);
            await fsExtra.writeFile(outputPath, JSON.stringify(exported, null, 2), 'utf8');
            console.log(chalk.green(`✓ Exported to: ${outputPath}\n`));
          }
        }, 10000);
      })
    );

  profileGroup
    .command('status')
    .description('Show current active profile and context status')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking profile status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { getActiveProfileWithContext, validateCurrentContext } = await import('../../commands/profile');
          const { profile, context } = await getActiveProfileWithContext();
          const validation = await validateCurrentContext();

          spinner.stop();

          if (!profile) {
            console.log(chalk.yellow('\n⚠ No active profile\n'));
            return;
          }

          console.log(chalk.cyan.bold('\n📌 Active Profile Status\n'));
          console.log(chalk.white(`Profile: ${profile.name}`));
          console.log(chalk.gray(`Environment: ${profile.environment}`));
          if (profile.framework) {
            console.log(chalk.gray(`Framework: ${profile.framework}`));
          }

          if (context) {
            console.log(chalk.gray(`Activated: ${new Date(context.activatedAt).toLocaleString()}`));
            console.log(chalk.gray(`Validated: ${context.validated ? 'Yes' : 'No'}`));
          }

          console.log('');
          console.log(chalk.gray('Validation:'));
          if (validation.valid) {
            console.log(chalk.green('  ✓ Profile context is valid'));
          } else {
            console.log(chalk.red('  ✗ Profile context has issues'));
          }

          if (validation.warnings.length > 0) {
            validation.warnings.forEach(w => {
              console.log(chalk.yellow(`  ⚠ ${w}`));
            });
          }
          console.log('');
        }, 10000);
      })
    );

  profileGroup
    .command('deactivate')
    .description('Deactivate current profile and restore workspace state')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Deactivating profile...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { getActiveProfileWithContext, deactivateProfile } = await import('../../commands/profile');
          const { profile, context } = await getActiveProfileWithContext();

          if (!profile || !context) {
            if (spinner) spinner.stop();
            console.log(chalk.yellow('\n⚠ No active profile to deactivate\n'));
            return;
          }

          await deactivateProfile(profile.name);

          spinner.succeed(chalk.green(`Deactivated profile "${profile.name}"`));
          console.log(chalk.gray('\nWorkspace state restored to pre-profile activation\n'));
        }, 10000);
      })
    );


  // env + template subgroups (split into ./profile-subgroups)
  registerProfileSubgroups(profileGroup);


  // --- config profile clone/customize ---
  profileGroup
    .command('clone <source> <name>')
    .description('Clone an existing profile')
    .option('-d, --description <description>', 'Description for the cloned profile')
    .option('--extend <profiles...>', 'Profiles to extend (comma-separated)')
    .option('--priority <number>', 'Priority for inheritance order')
    .action(async (source, name, options) => {
      const { cloneProfile } = await import('../../commands/profile');
      await cloneProfile(source, name, {
        description: options.description,
        extends: options.extend ? options.extend.split(',') : undefined,
        priority: options.priority ? parseInt(options.priority) : undefined,
      });
    });

  profileGroup
    .command('customize <name>')
    .description('Customize an existing profile (interactive mode)')
    .option('-d, --description <description>', 'New description')
    .option('-f, --framework <framework>', 'Framework')
    .option('-e, --environment <environment>', 'Environment (development|staging|production|custom)')
    .option('--build-target <target>', 'Build target (esnext|es2020|es2015)')
    .option('--build-optimize <boolean>', 'Enable build optimization')
    .option('--build-sourcemap <boolean>', 'Enable sourcemaps')
    .option('--build-minify <boolean>', 'Minify output')
    .option('--dev-port <port>', 'Development server port')
    .option('--dev-host <host>', 'Development server host')
    .option('--dev-hmr <boolean>', 'Enable Hot Module Replacement')
    .option('--dev-cors <boolean>', 'Enable CORS')
    .option('--add-env <vars...>', 'Add environment variables (KEY=VALUE)')
    .option('--remove-env <vars...>', 'Remove environment variables')
    .option('--add-script <scripts...>', 'Add scripts (NAME=COMMAND)')
    .option('--add-dependency <deps...>', 'Add dependencies (name@version)')
    .option('--extend-add <profiles...>', 'Add profiles to extend')
    .option('--extend-remove <profiles...>', 'Remove profiles from extends')
    .option('--priority <number>', 'Priority for inheritance order')
    .action(async (name, options) => {
      const { customizeProfile } = await import('../../commands/profile');

      const addEnv: Record<string, string> = {};
      if (options.addEnv) {
        for (const envVar of options.addEnv) {
          const [key, ...valueParts] = envVar.split('=');
          if (key && valueParts.length > 0) {
            addEnv[key] = valueParts.join('=');
          }
        }
      }

      const addScript: Record<string, string> = {};
      if (options.addScript) {
        for (const script of options.addScript) {
          const [key, ...valueParts] = script.split('=');
          if (key && valueParts.length > 0) {
            addScript[key] = valueParts.join('=');
          }
        }
      }

      const addDependency: Record<string, string> = {};
      if (options.addDependency) {
        for (const dep of options.addDependency) {
          const match = dep.match(/^(@?[^@]+)@(.+)$/);
          if (match) {
            addDependency[match[1]] = match[2];
          }
        }
      }

      await customizeProfile(name, {
        description: options.description,
        framework: options.framework,
        environment: options.environment,
        buildTarget: options.buildTarget,
        buildOptimize: options.buildOptimize !== undefined ? options.buildOptimize === 'true' : undefined,
        buildSourcemap: options.buildSourcemap !== undefined ? options.buildSourcemap === 'true' : undefined,
        buildMinify: options.buildMinify !== undefined ? options.buildMinify === 'true' : undefined,
        devPort: options.devPort ? parseInt(options.devPort) : undefined,
        devHost: options.devHost,
        devHmr: options.devHmr !== undefined ? options.devHmr === 'true' : undefined,
        devCors: options.devCors !== undefined ? options.devCors === 'true' : undefined,
        addEnv: Object.keys(addEnv).length > 0 ? addEnv : undefined,
        removeEnv: options.removeEnv,
        addScript: Object.keys(addScript).length > 0 ? addScript : undefined,
        addDependency: Object.keys(addDependency).length > 0 ? addDependency : undefined,
        extendAdd: options.extendAdd,
        extendRemove: options.extendRemove,
        priority: options.priority ? parseInt(options.priority) : undefined,
      });
    });

  // --- config profile sync ---
  profileGroup
    .command('sync')
    .description('Synchronize profiles with team via Git or local storage')
    .option('-m, --method <method>', 'Sync method (git|cloud|local)', 'local')
    .option('-r, --remote <remote>', 'Git remote name', 'origin')
    .option('-b, --branch <branch>', 'Git branch name', 'main')
    .option('--force', 'Force overwrite remote changes')
    .option('--strategy <strategy>', 'Conflict resolution strategy (local|remote|merge|manual)', 'merge')
    .action(async (options) => {
      const { syncProfilesGit, syncProfilesLocal } = await import('../../commands/profile-sync');

      if (options.method === 'git') {
        await syncProfilesGit({
          method: 'git',
          remote: options.remote,
          branch: options.branch,
          force: options.force,
          strategy: options.strategy,
        });
      } else {
        await syncProfilesLocal({
          method: 'local',
          strategy: options.strategy,
        });
      }
    });

  profileGroup
    .command('export-profiles [profiles...]')
    .description('Export profiles to sync directory')
    .option('-o, --output <path>', 'Output directory path')
    .option('--include-metadata', 'Include export metadata')
    .action(async (profiles, options) => {
      const { exportProfiles } = await import('../../commands/profile-sync');
      await exportProfiles(profiles, {
        outputPath: options.output,
        includeMetadata: options.includeMetadata,
      });
    });

  profileGroup
    .command('import [source]')
    .description('Import profiles from sync directory')
    .option('--overwrite', 'Overwrite existing profiles')
    .option('--merge', 'Merge with existing profiles')
    .option('--strategy <strategy>', 'Conflict resolution strategy (local|remote|merge|manual)', 'manual')
    .action(async (source, options) => {
      const { importProfiles } = await import('../../commands/profile-sync');
      await importProfiles(source, {
        overwrite: options.overwrite,
        merge: options.merge,
        strategy: options.strategy,
      });
    });

  profileGroup
    .command('sync-status')
    .description('Show profile synchronization status')
    .action(async () => {
      const { showSyncStatus } = await import('../../commands/profile-sync');
      await showSyncStatus();
    });

  profileGroup
    .command('resolve-conflicts')
    .description('Interactively resolve profile synchronization conflicts')
    .action(async () => {
      const { resolveConflicts } = await import('../../commands/profile-sync');
      await resolveConflicts();
    });

  // --- config profile analytics ---
  profileGroup
    .command('analytics [profile]')
    .description('Show profile analytics dashboard with insights')
    .option('--json', 'Output as JSON')
    .action(async (profile, options) => {
      const { showAnalyticsDashboard } = await import('../../commands/profile-analytics');
      await showAnalyticsDashboard(profile);
    });

  profileGroup
    .command('stats')
    .description('Show profile usage statistics')
    .option('--sort <field>', 'Sort by field (name|usage|duration)', 'usage')
    .option('--limit <number>', 'Limit number of results', '10')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .action(async (options) => {
      const { showUsageStatistics } = await import('../../commands/profile-analytics');
      await showUsageStatistics({
        sortBy: options.sort,
        limit: parseInt(options.limit),
        format: options.format,
      });
    });

  profileGroup
    .command('clean-analytics')
    .description('Clean old analytics data')
    .option('--days <number>', 'Days to keep', '90')
    .action(async (options) => {
      const { cleanAnalyticsData } = await import('../../commands/profile-analytics');
      await cleanAnalyticsData(parseInt(options.days));
    });

  profileGroup
    .command('insights [profile]')
    .description('Generate insights and recommendations for profiles')
    .action(async (profile) => {
      const { generateProfileInsights } = await import('../../commands/profile-analytics');
      const insights = await generateProfileInsights(profile);

      if (insights.length === 0) {
        console.log(chalk.cyan('\n✨ No insights to share\n'));
        return;
      }

      console.log(chalk.cyan.bold('\n💡 Insights & Recommendations\n'));

      for (const insight of insights) {
        const severityColor = {
          info: chalk.blue,
          suggestion: chalk.cyan,
          warning: chalk.yellow,
          critical: chalk.red,
        }[insight.severity];

        const icon = {
          info: 'ℹ️',
          suggestion: '💡',
          warning: '⚠️',
          critical: '🔴',
        }[insight.severity];

        console.log(severityColor(`${icon} ${insight.title}`));
        console.log(chalk.gray(`   ${insight.description}`));

        if (insight.recommendation) {
          console.log(chalk.gray(`   → ${insight.recommendation}`));
        }

        if (insight.impact) {
          console.log(chalk.gray(`   Impact: ${insight.impact}`));
        }

        console.log('');
      }
    });

  // --- config profile versioning ---
  profileGroup
    .command('snapshot <profile>')
    .description('Create a snapshot/version of a profile')
    .option('-m, --message <message>', 'Snapshot message')
    .option('-t, --tags <tags...>', 'Tags for the snapshot')
    .action(async (profile, options) => {
      const { createProfileVersion } = await import('../../commands/profile-version');
      await createProfileVersion(profile, {
        message: options.message,
        tags: options.tags,
      });
    });

  profileGroup
    .command('history <profile>')
    .description('Show version history of a profile')
    .action(async (profile) => {
      const { listProfileVersions } = await import('../../commands/profile-version');
      await listProfileVersions(profile);
    });

  profileGroup
    .command('rollback <profile> <version>')
    .description('Rollback profile to a specific version')
    .option('-f, --force', 'Skip confirmation')
    .option('--no-backup', 'Don\'t create backup before rollback')
    .action(async (profile, version, options) => {
      const { rollbackProfile } = await import('../../commands/profile-version');
      await rollbackProfile(profile, version, {
        force: options.force,
        createBackup: options.backup,
      });
    });

  profileGroup
    .command('diff <profile> <version1> [version2]')
    .description('Compare two versions of a profile')
    .action(async (profile, version1, version2) => {
      const { compareProfileVersions } = await import('../../commands/profile-version');
      await compareProfileVersions(profile, version1, version2);
    });

  profileGroup
    .command('cleanup-versions [profile]')
    .description('Clean up old profile versions')
    .option('--keep <number>', 'Number of versions to keep', '10')
    .option('--before <date>', 'Delete versions before this date (ISO format)')
    .option('--auto-only', 'Only delete auto-generated snapshots')
    .action(async (profile, options) => {
      const { cleanupOldVersions } = await import('../../commands/profile-version');
      await cleanupOldVersions(profile, {
        keep: parseInt(options.keep),
        before: options.before,
        autoOnly: options.autoOnly,
      });
    });

  // --- config profile optimize ---
  profileGroup
    .command('optimize <profile>')
    .description('Generate optimization recommendations for a profile')
    .option('--apply <ids...>', 'Apply specific recommendations by ID')
    .option('--auto', 'Auto-apply safe optimizations')
    .action(async (profile, options) => {
      const { showOptimizationReport, applyOptimizations, autoOptimizeProfile } = await import('../../commands/profile-optimize');

      if (options.auto) {
        await autoOptimizeProfile(profile);
      } else if (options.apply) {
        await applyOptimizations(profile, options.apply);
      } else {
        await showOptimizationReport(profile);
      }
    });
}
