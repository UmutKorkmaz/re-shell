#!/usr/bin/env node
/**
 * Optimized CLI entry point with lazy loading and performance improvements
 */

// Start profiling immediately
const startTime = Date.now();

// Minimal imports for startup
import { profiler } from './utils/performance-profiler';
profiler.start(process.argv.slice(2).join(' '));
profiler.mark('imports-start');

// Core imports only - defer everything else
import { program } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

profiler.mark('core-imports-done');

// Read package.json once
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

profiler.mark('package-json-loaded');

// Lazy load utilities
const lazyLoad = {
  checkUpdate: null as any,
  spinner: null as any,
  chalk: null as any,
  detectFramework: null as any,
  env: null as any
};

// Configure program
program
  .name('re-shell')
  .description('Re-Shell CLI - Universal Full-Stack Development Platform')
  .enablePositionalOptions()
  .version(packageJson.version, '-v, --version')
  .option('-d, --debug', 'Enable debug mode')
  .option('--no-update-check', 'Skip update check')
  .option('--profile', 'Enable performance profiling')
  .hook('preAction', async (thisCommand, actionCommand) => {
    // Enable profiling if requested
    if (thisCommand.opts().profile || process.env.RESHELL_PROFILE === 'true') {
      process.env.RESHELL_PROFILE = 'true';
    }
    
    // Skip update check for performance-critical commands
    const skipUpdateCommands = ['--version', '-v', 'help', 'completion'];
    const shouldCheckUpdate = 
      !thisCommand.opts().noUpdateCheck && 
      !skipUpdateCommands.includes(actionCommand.name());
    
    if (shouldCheckUpdate) {
      profiler.mark('update-check-start');
      lazyLoad.checkUpdate = lazyLoad.checkUpdate || (await import('./utils/checkUpdate')).checkForUpdates;
      await lazyLoad.checkUpdate();
      profiler.mark('update-check-done');
    }
  });

profiler.mark('program-configured');

// Command loaders with lazy imports
const commandLoaders = {
  'init': () => import('./commands/init'),
  'add': () => import('./commands/add'),
  'serve': () => import('./commands/serve'),
  'build': () => import('./commands/build'),
  'list': () => import('./commands/list'),
  'remove': () => import('./commands/remove'),
  'update': () => import('./commands/plugin').then(m => ({ updatePlugins: m.updatePlugins })),
  'analyze': () => import('./commands/analyze'),
  'doctor': () => import('./commands/doctor'),
  'workspace': () => import('./commands/workspace'),
  'config': () => import('./commands/config'),
  'plugin': () => import('./commands/plugin'),
  'create': () => import('./commands/create'),
  'generate': () => import('./commands/generate'),
  'migrate': () => import('./commands/migrate'),
  'validate': () => import('./commands/validate'),
  'template': () => import('./commands/template'),
  'backup': () => import('./commands/backup'),
  'cicd': () => import('./commands/cicd'),
  'environment': () => import('./commands/environment'),
  'submodule': () => import('./commands/submodule'),
  'migration': () => import('./commands/migration'),
  'project-config': () => import('./commands/project-config'),
  'dev-mode': () => import('./commands/dev-mode'),
  'workspace-config': () => import('./commands/workspace-config'),
  'workspace-definition': () => import('./commands/workspace-definition'),
  'workspace-template': () => import('./commands/workspace-template'),
  'workspace-backup': () => import('./commands/workspace-backup'),
  'workspace-migration': () => import('./commands/workspace-migration'),
  'workspace-conflict': () => import('./commands/workspace-conflict'),
  'workspace-graph': () => import('./commands/workspace-graph'),
  'workspace-health': () => import('./commands/workspace-health'),
  'workspace-state': () => import('./commands/workspace-state'),
  'file-watcher': () => import('./commands/file-watcher'),
  'change-detector': () => import('./commands/change-detector'),
  'change-impact': () => import('./commands/change-impact'),
  'incremental-build': () => import('./commands/incremental-build'),
  'platform-test': () => import('./commands/platform-test'),
  'plugin-dependency': () => import('./commands/plugin-dependency'),
  'plugin-marketplace': () => import('./commands/plugin-marketplace'),
  'plugin-security': () => import('./commands/plugin-security'),
  'plugin-command': () => import('./commands/plugin-command'),
  'plugin-middleware': () => import('./commands/plugin-middleware'),
  'plugin-conflicts': () => import('./commands/plugin-conflicts'),
  'plugin-docs': () => import('./commands/plugin-docs'),
  'plugin-validation': () => import('./commands/plugin-validation'),
  'plugin-cache': () => import('./commands/plugin-cache'),
  'config-diff': () => import('./commands/config-diff')
};

// Register commands with lazy loading
Object.entries(commandLoaders).forEach(([name, loader]) => {
  const cmd = program.command(name);
  
  // Set up command metadata without loading the module
  switch (name) {
    case 'init':
      cmd.description('Initialize a new Re-Shell project')
         .action(async (...args) => {
           profiler.mark(`${name}-load-start`);
           const module = await loader();
           profiler.mark(`${name}-load-done`);
           // Execute the function directly
           if ('initMonorepo' in module && typeof module.initMonorepo === 'function') {
             await (module as any).initMonorepo(...args);
           }
         });
      break;
    
    case 'add':
      cmd.description('Add a new microfrontend or service')
         .action(async (...args) => {
           profiler.mark(`${name}-load-start`);
           const module = await loader();
           profiler.mark(`${name}-load-done`);
           // Execute the function directly
           if ('addMicrofrontend' in module && typeof module.addMicrofrontend === 'function') {
             await (module as any).addMicrofrontend(...args);
           }
         });
      break;
    
    // Add other commands similarly...
    default:
      cmd.description(`${name} command`)
         .action(async (...args) => {
           profiler.mark(`${name}-load-start`);
           const module = await loader();
           profiler.mark(`${name}-load-done`);
           const setupFn = module[`setup${name.charAt(0).toUpperCase() + name.slice(1)}Command`];
           if (setupFn) {
             setupFn(program);
             await program.parseAsync(process.argv);
           }
         });
  }
});

profiler.mark('commands-registered');

// Fast path for version check
const versionArgs = process.argv.slice(2);
if (versionArgs.length === 1 && ['--version', '-v', '-V'].includes(versionArgs[0])) {
  // Display version immediately without loading anything else
  if (!lazyLoad.chalk) {
    lazyLoad.chalk = require('chalk');
  }
  const chalk = lazyLoad.chalk;
  
  console.log(chalk.cyan(`
██████╗ ███████╗           ███████╗██╗  ██╗███████╗██╗     ██╗
██╔══██╗██╔════╝           ██╔════╝██║  ██║██╔════╝██║     ██║
██████╔╝█████╗  ████████╗  ███████╗███████║█████╗  ██║     ██║
██╔══██╗██╔══╝  ╚═══════╝  ╚════██║██╔══██║██╔══╝  ██║     ██║
██║  ██║███████╗           ███████║██║  ██║███████╗███████╗███████╗
╚═╝  ╚═╝╚══════╝           ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
                                v${packageJson.version}
`));
  console.log(packageJson.version);
  
  profiler.mark('version-displayed');
  profiler.end();
  
  // Exit quickly
  process.exit(0);
}

// Parse commands
profiler.mark('parse-start');
program.parse(process.argv);
profiler.mark('parse-done');

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// End profiling
const report = profiler.end();

// In debug mode, show startup time
if (process.env.DEBUG === 'true' && report) {
  console.log(`\nStartup time: ${report.totalDuration.toFixed(2)}ms`);
  
  const bottlenecks = profiler.analyzeBottlenecks();
  if (bottlenecks.length > 0) {
    console.log('\nTop bottlenecks:');
    bottlenecks.slice(0, 5).forEach(b => {
      console.log(`  ${b.phase}: ${b.duration.toFixed(2)}ms (${b.percentage.toFixed(1)}%)`);
    });
  }
}
