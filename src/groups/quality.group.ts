import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import * as path from 'path';

export function registerQualityGroup(program: Command): void {
  const quality = new Command('quality')
    .description('Code quality, testing, and IDE integration tools');

  // quality test - Universal testing commands
  const testGroup = quality.command('test').alias('ut')
    .description('Universal testing across all frameworks and languages');

  testGroup
    .command('run [path]')
    .description('Run tests with auto-detected framework')
    .option('-p, --pattern <pattern>', 'Test file pattern filter')
    .option('-c, --coverage', 'Generate coverage report')
    .option('-w, --watch', 'Watch mode')
    .option('-v, --verbose', 'Verbose output')
    .option('--parallel', 'Run tests in parallel')
    .option('--max-workers <n>', 'Maximum number of parallel workers')
    .option('-u, --update-snapshot', 'Update snapshots')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { runTests, formatTestResult } = await import('../utils/universal-test');
        const { createSpinner } = await import('../utils/spinner');

        const pathToTest = projectPath || process.cwd();
        const spinner = createSpinner('Detecting test framework...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const testOptions = {
            pattern: options.pattern,
            coverage: options.coverage,
            watch: options.watch,
            verbose: options.verbose,
            parallel: options.parallel,
            maxWorkers: options.maxWorkers ? parseInt(options.maxWorkers) : undefined,
            updateSnapshot: options.updateSnapshot,
          };

          spinner.setText('Running tests...');

          const result = await runTests(pathToTest, testOptions);

          spinner.stop();

          console.log(formatTestResult(result));

          if (result.failed > 0) {
            process.exit(1);
          }

        } catch (error) {
          spinner.fail(chalk.red('Test execution failed'));
          const errorMessage = (error as Error).message;
          if (errorMessage.includes('No test framework detected')) {
            console.log(chalk.yellow('\n⚠️  No test framework detected in this project.'));
            console.log(chalk.gray('Supported frameworks: jest, vitest, mocha, pytest, unittest, go test, cargo test, junit, rspec, phpunit, and more.'));
          } else {
            throw error;
          }
        }
      })
    );

  testGroup
    .command('list [path]')
    .description('List test files')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { createTestRunner } = await import('../utils/universal-test');
        const { createSpinner } = await import('../utils/spinner');

        const pathToList = projectPath || process.cwd();
        const spinner = createSpinner('Scanning for test files...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const runner = await createTestRunner(pathToList);
          const testFiles = await runner.listTestFiles();
          const info = await runner.getTestInfo();

          spinner.stop();

          console.log(chalk.cyan('\n📋 Test Configuration'));
          console.log(chalk.gray('═'.repeat(50)));
          console.log(`\nFrameworks: ${chalk.blue(info.frameworks.join(', ') || 'none detected')}`);
          console.log(`Test files: ${chalk.blue(String(info.testFileCount))}`);
          console.log(`Command: ${chalk.gray(info.testCommand)}`);

          if (testFiles.length > 0) {
            console.log(chalk.gray('\nTest files:'));
            for (const file of testFiles.slice(0, 20)) {
              console.log(`  • ${chalk.gray(file)}`);
            }
            if (testFiles.length > 20) {
              console.log(`  ... and ${testFiles.length - 20} more`);
            }
          }

        } catch (error) {
          spinner.fail(chalk.red('Failed to list test files'));
          throw error;
        }
      })
    );

  testGroup
    .command('frameworks')
    .description('List all supported test frameworks')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const { getSupportedTestFrameworks } = await import('../utils/universal-test');
        const frameworks = getSupportedTestFrameworks();

        if (options.json) {
          console.log(JSON.stringify(frameworks, null, 2));
          return;
        }

        console.log(chalk.cyan('\n🧪 Supported Test Frameworks'));
        console.log(chalk.gray('═'.repeat(70)));

        const byLanguage: Record<string, typeof frameworks> = {};
        for (const f of frameworks) {
          if (!byLanguage[f.language]) {
            byLanguage[f.language] = [];
          }
          byLanguage[f.language].push(f);
        }

        for (const [language, langFrameworks] of Object.entries(byLanguage).sort()) {
          console.log(chalk.cyan(`\n${language.charAt(0).toUpperCase() + language.slice(1)}:`));
          for (const f of langFrameworks) {
            console.log(`  ${chalk.blue(f.name.padEnd(15))} ${chalk.gray(f.frameworks.join(', '))}`);
          }
        }

        console.log(chalk.gray(`\n${'═'.repeat(70)}`));
      })
    );

  testGroup
    .command('info [path]')
    .description('Show test configuration info')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { createTestRunner } = await import('../utils/universal-test');
        const { createSpinner } = await import('../utils/spinner');

        const pathToInfo = projectPath || process.cwd();
        const spinner = createSpinner('Getting test info...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const runner = await createTestRunner(pathToInfo);
          const info = await runner.getTestInfo();

          spinner.stop();

          console.log(chalk.cyan('\n📊 Test Information'));
          console.log(chalk.gray('═'.repeat(50)));

          console.log(`\nDetected Frameworks:`);
          if (info.frameworks.length === 0) {
            console.log(chalk.yellow('  No test framework detected'));
            console.log(chalk.gray('  Run `re-shell test frameworks` to see supported frameworks'));
          } else {
            for (const f of info.frameworks) {
              console.log(`  • ${chalk.blue(f)}`);
            }
          }

          console.log(`\nTest Files Found: ${chalk.blue(String(info.testFileCount))}`);
          console.log(`\nTest Command: ${chalk.gray(info.testCommand)}`);

        } catch (error) {
          spinner.fail(chalk.red('Failed to get test info'));
          throw error;
        }
      })
    );

  // quality intellisense - IntelliSense and code completion commands
  const intellisenseGroup = quality.command('intellisense').alias('lsp')
    .description('Setup code completion and LSP integration');

  intellisenseGroup
    .command('setup [path]')
    .description('Setup IntelliSense for project')
    .option('-l, --languages <languages...>', 'Specific languages to setup')
    .option('-t, --type <type>', 'Project type')
    .option('--dry-run', 'Preview without writing files')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { createIntelliSenseGenerator, getAllLanguageServers } = await import('../utils/intellisense');
        const { createSpinner } = await import('../utils/spinner');

        const pathToSetup = projectPath || process.cwd();
        const spinner = createSpinner('Detecting languages...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const generator = await createIntelliSenseGenerator(pathToSetup, options.type);
          const detectedLanguages = await generator.detectLanguages();

          spinner.succeed(chalk.green(`Detected ${detectedLanguages.length} languages`));

          if (options.dryRun) {
            console.log(chalk.cyan('\n📋 Dry-run IntelliSense setup:'));
            console.log(`  Path: ${chalk.blue(pathToSetup)}`);
            console.log(`  Languages: ${chalk.blue(detectedLanguages.join(', ') || 'none')}`);
            if (options.languages) {
              console.log(`  Override: ${chalk.blue(options.languages.join(', '))}`);
            }
            return;
          }

          spinner.setText('Setting up IntelliSense...');
          spinner.start();

          const languages = options.languages || detectedLanguages;
          await generator.setupIntelliSense(languages);

          spinner.stop();

          console.log(chalk.green('\n✅ IntelliSense setup complete!'));
          console.log(chalk.gray('═'.repeat(50)));
          console.log(`\nConfigured for: ${chalk.blue(languages.join(', ') || 'generic')}`);
          console.log(chalk.gray('\nGenerated files:'));
          console.log(`  • ${chalk.blue('.vscode/settings.json')}`);
          console.log(`  • ${chalk.blue('.vscode/extensions.json')}`);

          const langSpecificFiles: Record<string, string> = {
            'python': 'pyrightconfig.json',
            'c++': '.clangd',
            'go': 'go.mod',
          };

          for (const lang of languages) {
            const file = langSpecificFiles[lang.toLowerCase()];
            if (file) {
              console.log(`  • ${chalk.blue(file)}`);
            }
          }

          console.log(chalk.gray('\nRestart your IDE for IntelliSense to take effect.'));

        } catch (error) {
          spinner.fail(chalk.red('IntelliSense setup failed'));
          throw error;
        }
      })
    );

  intellisenseGroup
    .command('list-languages')
    .description('List all supported languages')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const { getAllLanguageServers } = await import('../utils/intellisense');
        const servers = getAllLanguageServers();

        if (options.json) {
          console.log(JSON.stringify(servers, null, 2));
          return;
        }

        console.log(chalk.cyan('\n🔡 Supported Languages for IntelliSense'));
        console.log(chalk.gray('═'.repeat(70)));

        for (const [key, server] of Object.entries(servers)) {
          console.log(`\n${chalk.blue(server.language.padEnd(15))} [${chalk.gray(key)}]`);
          console.log(`  Extensions: ${chalk.gray(server.fileExtensions.join(', '))}`);
          console.log(`  Server: ${chalk.gray(server.serverName)}`);
          if (server.requiresInstall) {
            console.log(`  Install: ${chalk.yellow(server.installCommand || 'See language server docs')}`);
          }
        }

        console.log(chalk.gray(`\n${'═'.repeat(70)}`));
      })
    );

  intellisenseGroup
    .command('extensions <language>')
    .description('Get recommended extensions for a language')
    .action(
      createAsyncCommand(async (language, options) => {
        const { getRecommendedExtensions, getAllLanguageServers } = await import('../utils/intellisense');

        const servers = getAllLanguageServers();
        const serverKey = language.toLowerCase();
        const server = servers[serverKey];

        if (!server) {
          console.log(chalk.yellow(`\n⚠️  Language not found: ${language}`));
          console.log(chalk.gray('Run `re-shell intellisense list-languages` to see supported languages.'));
          return;
        }

        const extensions = getRecommendedExtensions(language);

        console.log(chalk.cyan(`\n📦 Recommended Extensions for ${chalk.blue(server.language)}`));
        console.log(chalk.gray('═'.repeat(60)));

        if (extensions.length === 0) {
          console.log(chalk.yellow('No specific extensions recommended'));
        } else {
          for (const ext of extensions) {
            console.log(`  • ${chalk.blue(ext)}`);
          }
        }

        console.log(chalk.gray('\n═'.repeat(60)));
        console.log(chalk.gray(`Language Server: ${server.serverName}`));
        if (server.requiresInstall) {
          console.log(chalk.gray(`Install: ${server.installCommand}`));
        }
      })
    );

  intellisenseGroup
    .command('vim-config [path]')
    .description('Generate Neovim LSP configuration')
    .option('-o, --output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { createIntelliSenseGenerator } = await import('../utils/intellisense');
        const { createSpinner } = await import('../utils/spinner');

        const pathToSetup = projectPath || process.cwd();
        const spinner = createSpinner('Generating Neovim config...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const generator = await createIntelliSenseGenerator(pathToSetup);
          const languages = await generator.detectLanguages();
          const config = await generator.setupIntelliSense(languages);

          const outputPath = options.output || path.join(pathToSetup, '.nvim.lsp.lua');
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          await require('fs-extra').writeFile(outputPath, config.vimSettings, 'utf-8');

          spinner.succeed(chalk.green('Neovim config generated'));
          console.log(`  Output: ${chalk.blue(outputPath)}`);

        } catch (error) {
          spinner.fail(chalk.red('Config generation failed'));
          throw error;
        }
      })
    );

  intellisenseGroup
    .command('emacs-config [path]')
    .description('Generate Emacs LSP configuration')
    .option('-o, --output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { createIntelliSenseGenerator } = await import('../utils/intellisense');
        const { createSpinner } = await import('../utils/spinner');

        const pathToSetup = projectPath || process.cwd();
        const spinner = createSpinner('Generating Emacs config...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const generator = await createIntelliSenseGenerator(pathToSetup);
          const languages = await generator.detectLanguages();
          const config = await generator.setupIntelliSense(languages);

          const outputPath = options.output || path.join(pathToSetup, '.lsp-config.el');
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          await require('fs-extra').writeFile(outputPath, config.emacsSettings, 'utf-8');

          spinner.succeed(chalk.green('Emacs config generated'));
          console.log(`  Output: ${chalk.blue(outputPath)}`);

        } catch (error) {
          spinner.fail(chalk.red('Config generation failed'));
          throw error;
        }
      })
    );

  program.addCommand(quality);
}
