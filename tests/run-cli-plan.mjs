#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const glob = require('glob');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const cliPath = path.join(packageRoot, 'dist', 'index.js');

function parseSuite() {
  const suiteArg = process.argv.find(arg => arg.startsWith('--suite='));
  return suiteArg ? suiteArg.split('=')[1] : 'all';
}

function runCli(args, options = {}) {
  const env = {
    ...process.env,
    HOME: options.home || process.env.HOME,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    ...(options.env || {}),
  };
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'undefined') {
      delete env[key];
    }
  }

  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || packageRoot,
    encoding: 'utf8',
    timeout: options.timeout || 40000,
    env,
  });

  return {
    args,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function commandInventory() {
  const files = [
    'src/index.ts',
    'src/aliases.ts',
    ...glob.sync('src/groups/*.ts', { cwd: packageRoot }).filter(file => !path.basename(file).startsWith('_')),
  ].map(file => path.join(packageRoot, file));

  const vars = new Map();
  const exprCommands = [];
  const addLinks = [];

  const key = (file, name) => `${file}::${name}`;
  const stripQuotes = node =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
  const getVar = expr => (ts.isIdentifier(expr) ? expr.text : null);

  function unwindCall(expr) {
    let current = expr;
    while (ts.isCallExpression(current)) {
      if (ts.isPropertyAccessExpression(current.expression)) {
        if (current.expression.name.text === 'command') {
          return { kind: 'command', call: current };
        }
        if (current.expression.name.text === 'addCommand') {
          return { kind: 'addCommand', call: current };
        }
        current = current.expression.expression;
        continue;
      }
      break;
    }
    if (ts.isNewExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === 'Command') {
      return { kind: 'newCommand', call: current };
    }
    return null;
  }

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
        const info = unwindCall(node.initializer);
        if (info?.kind === 'newCommand') {
          const commandName = info.call.arguments?.[0] && stripQuotes(info.call.arguments[0]);
          if (commandName) {
            vars.set(key(file, node.name.text), {
              file,
              name: node.name.text,
              literal: commandName,
              parentVar: null,
              path: [commandName],
            });
          }
        } else if (info?.kind === 'command') {
          const parentVar = getVar(info.call.expression.expression);
          const commandName = info.call.arguments[0] && stripQuotes(info.call.arguments[0]);
          if (parentVar && commandName) {
            vars.set(key(file, node.name.text), {
              file,
              name: node.name.text,
              literal: commandName,
              parentVar,
              path: null,
            });
          }
        }
      }

      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        const info = unwindCall(node.expression);
        if (info?.kind === 'command') {
          const parentVar = getVar(info.call.expression.expression);
          const commandName = info.call.arguments[0] && stripQuotes(info.call.arguments[0]);
          if (parentVar && commandName) {
            exprCommands.push({ file, parentVar, commandName });
          }
        } else if (info?.kind === 'addCommand') {
          const parentVar = getVar(info.call.expression.expression);
          const childVar = getVar(info.call.arguments[0]);
          if (parentVar && childVar) {
            addLinks.push({ file, parentVar, childVar });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(source);
  }

  for (const file of files) {
    vars.set(key(file, 'program'), {
      file,
      name: 'program',
      literal: 're-shell',
      parentVar: null,
      path: [],
    });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of vars.values()) {
      if (!item.path && item.parentVar) {
        const parent = vars.get(key(item.file, item.parentVar));
        if (parent?.path) {
          item.path = [...parent.path, item.literal];
          changed = true;
        }
      }
    }
    for (const link of addLinks) {
      const parent = vars.get(key(link.file, link.parentVar));
      const child = vars.get(key(link.file, link.childVar));
      if (parent?.path && child) {
        const desired = [...parent.path, child.literal];
        if (!child.path || child.path.join(' ') !== desired.join(' ')) {
          child.path = desired;
          changed = true;
        }
      }
    }
  }

  const commands = new Set();
  for (const item of vars.values()) {
    if (item.name !== 'program' && item.path) {
      commands.add(normalizeCommandPath(item.path.join(' ')));
    }
  }
  for (const item of exprCommands) {
    const parent = vars.get(key(item.file, item.parentVar));
    if (parent?.path) {
      commands.add(normalizeCommandPath([...parent.path, item.commandName].join(' ')));
    }
  }

  return [...commands].sort();
}

function normalizeCommandPath(command) {
  return command
    .split(/\s+/)
    .filter(token => token && !token.startsWith('<') && !token.startsWith('['))
    .join(' ');
}

function expectJsonStdout(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${result.stdout.slice(0, 600)}`);
  }
}

function expectNoStderr(result, label) {
  assert(result.stderr.trim() === '', `${label} emitted stderr: ${result.stderr.slice(0, 400)}`);
}

function runHelpSuite() {
  const commands = commandInventory();
  const failures = [];

  for (const command of commands) {
    const result = runCli([...command.split(' '), '--help'], { timeout: 10000 });
    if (result.status !== 0) {
      failures.push({
        test: `${command} --help`,
        status: result.status,
        output: (result.stdout + result.stderr).slice(0, 800),
      });
    }
  }

  return {
    suite: 'help',
    total: commands.length,
    failures,
  };
}

function runBehaviorSuite() {
  const tmpRoot = path.join(os.tmpdir(), 're-shell-cli-plan');
  const homeRoot = path.join(os.tmpdir(), 're-shell-cli-plan-home');
  const apiRoot = path.join(tmpRoot, 'api');
  const infraRoot = path.join(tmpRoot, 'infra');
  const workspaceRoot = path.join(tmpRoot, 'workspace');
  const homeDir = path.join(homeRoot, 'isolated-home');
  const failures = [];
  const aliases = [
    'workspace-health',
    'workspace-graph',
    'workspace-def',
    'workspace-state',
    'workspace-template',
    'workspace-backup',
    'workspace-migration',
    'workspace-conflict',
    'workspace-config',
    'file-watcher',
    'change-detector',
    'openapi',
    'swagger',
    'versioning',
    'validation',
    'gateway',
    'analytics',
    'client',
    'api-test',
    'docs',
    'env',
    'uconfig',
    'config-migrate',
    'config-diff',
    'validate',
    'project-config',
    'template',
    'test',
    'intellisense',
    'cicd',
    'debug',
    'devenv',
    'hotreload',
    'dev',
    'services',
    'backup',
    'migrate',
  ];

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(homeRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.mkdirSync(homeDir, { recursive: true });

  function record(test, fn) {
    try {
      fn();
    } catch (error) {
      failures.push({ test, error: error.message });
    }
  }

  function runInWorkspace(args, timeout = 50000) {
    return runCli(args, { cwd: workspaceRoot, home: homeDir, timeout });
  }

  function runInApi(args, timeout = 40000) {
    return runCli(args, { cwd: apiRoot, home: homeDir, timeout });
  }

  function runInInfra(args, timeout = 40000) {
    return runCli(args, { cwd: infraRoot, home: homeDir, timeout });
  }

  record('init templates', () => {
    const templates = {
      blank: ['package.json', 'pnpm-workspace.yaml', 'turbo.json'],
      saas: ['apps/shell', 'apps/auth', 'apps/billing', 'apps/admin'],
      ecommerce: ['apps/shell', 'apps/product-catalog', 'apps/checkout'],
      dashboard: ['apps/shell', 'apps/analytics', 'apps/user-management'],
    };

    for (const [template, expected] of Object.entries(templates)) {
      const result = runCli(
        ['init', `init-${template}`, '--template', template, '--skip-install', '--no-git', '-y'],
        { cwd: tmpRoot, home: homeDir }
      );
      assert(result.status === 0, `${template} init failed: ${result.stderr || result.stdout}`);
      for (const relPath of expected) {
        assert(
          fs.existsSync(path.join(tmpRoot, `init-${template}`, relPath)),
          `${template} init missing ${relPath}`
        );
      }
    }
  });

  record('workspace bootstrap', () => {
    const initResult = runCli(['init', 'workspace', '--skip-install', '--no-git', '-y'], {
      cwd: tmpRoot,
      home: homeDir,
    });
    assert(initResult.status === 0, `workspace init failed: ${initResult.stderr || initResult.stdout}`);
    const configResult = runCli(['workspace', 'init', '--yes'], {
      cwd: workspaceRoot,
      home: homeDir,
    });
    assert(configResult.status === 0, `workspace config init failed: ${configResult.stderr || configResult.stdout}`);
    assert(fs.existsSync(path.join(workspaceRoot, 're-shell.workspaces.yaml')), 'workspace config missing');
  });

  record('core create and remove', () => {
    let result = runInWorkspace(['create', 'my-react', '--framework', 'react-ts', '--route', '/my-react', '--port', '4100']);
    assert(result.status === 0, `create my-react failed: ${result.stderr || result.stdout}`);
    assert(fs.existsSync(path.join(workspaceRoot, 'apps', 'my-react', 'index.html')), 'create my-react missing root index.html');
    assert(fs.existsSync(path.join(workspaceRoot, 'apps', 'my-react', 'src', 'main.tsx')), 'create my-react missing src/main.tsx');
    assert(!fs.existsSync(path.join(workspaceRoot, 'apps', 'my-react', 'public', 'index.html')), 'create my-react should not generate public/index.html');
    result = runInWorkspace(['create', 'fs-app', '--fullstack', '--framework', 'react-ts', '--backend', 'express', '--route', '/fs-app']);
    assert(result.status === 0, `create fs-app failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['create', 'dry-run-app', '--framework', 'react-ts', '--route', '/dry-run-app', '--dry-run', '--verbose']);
    assert(result.status === 0, `dry run failed: ${result.stderr || result.stdout}`);
    assert(!fs.existsSync(path.join(workspaceRoot, 'apps', 'dry-run-app')), 'dry-run created files');
    result = runInWorkspace(['add', 'extra-app', '--template', 'react-ts', '--route', '/extra', '--port', '5200']);
    assert(result.status === 0, `add extra-app failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['list', '--json']);
    assert(result.status === 0, `list --json failed: ${result.stderr || result.stdout}`);
    expectJsonStdout(result, 'list --json');
    result = runCli(['list', '--json'], {
      cwd: workspaceRoot,
      home: homeDir,
      env: { FORCE_COLOR: undefined },
    });
    assert(result.status === 0, `list --json with NO_COLOR failed: ${result.stderr || result.stdout}`);
    expectJsonStdout(result, 'list --json with NO_COLOR');
    expectNoStderr(result, 'list --json with NO_COLOR');
    result = runInWorkspace(['remove', 'extra-app', '--force']);
    assert(result.status === 0, `remove extra-app failed: ${result.stderr || result.stdout}`);
    for (const args of [['build', '--help'], ['serve', '--help'], ['tui', '--help']]) {
      result = runInWorkspace(args, 15000);
      assert(result.status === 0, `${args.join(' ')} failed`);
    }
  });

  record('workspace command behavior', () => {
    let result = runInWorkspace(['workspace', 'list']);
    assert(result.status === 0, `workspace list failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'health', '--json']);
    assert(result.status === 0, `workspace health --json failed: ${result.stderr || result.stdout}`);
    expectJsonStdout(result, 'workspace health --json');
    result = runCli(['workspace', 'health', '--json'], {
      cwd: workspaceRoot,
      home: homeDir,
      env: { FORCE_COLOR: undefined },
    });
    assert(result.status === 0, `workspace health --json with NO_COLOR failed: ${result.stderr || result.stdout}`);
    expectJsonStdout(result, 'workspace health --json with NO_COLOR');
    expectNoStderr(result, 'workspace health --json with NO_COLOR');
    result = runInWorkspace(['workspace', 'validate']);
    assert(result.status === 0, `workspace validate failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'optimize', '--json']);
    assert(result.status === 0, `workspace optimize --json failed: ${result.stderr || result.stdout}`);
    expectJsonStdout(result, 'workspace optimize --json');
    result = runCli(['workspace', 'optimize', '--json'], {
      cwd: workspaceRoot,
      home: homeDir,
      env: { FORCE_COLOR: undefined },
    });
    assert(result.status === 0, `workspace optimize --json with NO_COLOR failed: ${result.stderr || result.stdout}`);
    expectJsonStdout(result, 'workspace optimize --json with NO_COLOR');
    expectNoStderr(result, 'workspace optimize --json with NO_COLOR');
    result = runInWorkspace(['workspace', 'docs']);
    assert(result.status === 0, `workspace docs failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'diff', '--from', 're-shell.workspaces.yaml', '--to', 're-shell.workspaces.yaml']);
    assert(result.status === 0, `workspace diff failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'template', 'list']);
    assert(result.status === 0, `workspace template list failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'state', 'status']);
    assert(result.status === 0, `workspace state status failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'watch', 'status']);
    assert(result.status === 0, `workspace watch status failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'changes', 'scan']);
    assert(result.status === 0, `workspace changes scan failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'impact', 'analyze']);
    assert(result.status === 0, `workspace impact analyze failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['workspace', 'ibuild', 'plan']);
    assert(result.status === 0, `workspace ibuild plan failed: ${result.stderr || result.stdout}`);

    result = runInWorkspace(['workspace', 'diagnostics', 'quick']);
    assert(result.status === 1, 'workspace diagnostics quick should surface unhealthy state with exit 1');
    assert(result.stdout.includes('Quick Health Check'), 'workspace diagnostics quick missing summary');
    assert(result.stdout.includes('Score:') || result.stdout.includes('📊 Score:'), 'workspace diagnostics quick missing score');
    assert(!result.stdout.includes('\\n'), 'workspace diagnostics quick rendered escaped newlines');

    result = runInWorkspace(['workspace', 'conflict', 'detect']);
    assert(result.status === 1, 'workspace conflict detect should fail cleanly without workspace definition');
    assert(
      result.stdout.includes('Workspace conflict commands require a workspace definition'),
      'workspace conflict detect missing guidance'
    );
  });

  record('config command behavior', () => {
    let result = runInWorkspace(['config', 'show']);
    assert(result.status === 0, `config show failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['config', 'set', 'test-key', 'hello']);
    assert(result.status === 0, `config set failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['config', 'get', 'test-key']);
    assert(result.status === 0 && result.stdout.includes('hello'), `config get failed: ${result.stderr || result.stdout}`);
    for (const args of [
      ['config', 'backup'],
      ['config', 'env', 'list'],
      ['config', 'env', 'create', 'qa'],
      ['config', 'env', 'generate', 'qa'],
      ['config', 'env', 'delete', 'qa'],
      ['config', 'validate', 'all'],
      ['config', 'template', 'list'],
      ['config', 'profile', 'list'],
      ['config', 'unified', 'layers'],
    ]) {
      result = runInWorkspace(args);
      assert(result.status === 0, `${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
  });

  record('generate command behavior', () => {
    let result = runInWorkspace(['generate', 'component', 'Button', '--framework', 'react']);
    assert(result.status === 0, `generate component failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['generate', 'hook', 'useAuth']);
    assert(result.status === 0, `generate hook failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['generate', 'service', 'UserService']);
    assert(result.status === 0, `generate service failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['generate', 'backend', 'auth-svc', '--framework', 'express', '--language', 'typescript']);
    assert(result.status === 0, `generate backend failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['generate', 'docs']);
    assert(result.status === 0, `generate docs failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['generate', 'feature', `user-management-${Date.now().toString(36)}`, '--type', 'crud']);
    assert(result.status === 0, `generate feature failed: ${result.stderr || result.stdout}`);
    result = runInWorkspace(['generate', 'test', 'apps/my-react']);
    assert(result.status === 0, `generate test failed: ${result.stderr || result.stdout}`);
  });

  record('quality command behavior', () => {
    for (const args of [
      ['quality', 'intellisense', 'list-languages'],
      ['quality', 'intellisense', 'extensions', 'typescript'],
      ['quality', 'intellisense', 'vim-config'],
      ['quality', 'intellisense', 'emacs-config'],
    ]) {
      const result = runInWorkspace(args);
      assert(result.status === 0, `${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }

    let result = runInWorkspace(['quality', 'test', 'frameworks']);
    assert(result.status === 0, `quality test frameworks failed: ${result.stderr || result.stdout}`);
    assert(!result.stdout.includes('\n═\n═'), 'quality test frameworks rendered a broken divider');

    result = runInWorkspace(['quality', 'test', 'info']);
    assert(result.status === 0, `quality test info failed: ${result.stderr || result.stdout}`);
  });

  record('api command behavior', () => {
    fs.mkdirSync(apiRoot, { recursive: true });
    let result = runInApi([
      'api',
      'openapi',
      'generate',
      '--output',
      './openapi.yaml',
      '--format',
      'yaml',
      '--title',
      'Manual Test API',
      '--version',
      '0.25.1',
    ]);
    assert(result.status === 0, `api openapi generate failed: ${result.stderr || result.stdout}`);
    assert(fs.existsSync(path.join(apiRoot, 'openapi.yaml')), 'openapi.yaml missing');
    for (const args of [
      ['api', 'openapi', 'discover'],
      ['api', 'swagger', 'generate'],
      ['api', 'versioning', 'init'],
      ['api', 'validation', 'list-frameworks'],
      ['api', 'test', 'list-frameworks'],
      ['api', 'docs', 'themes'],
      ['api', 'gateway', 'list'],
      ['api', 'analytics', 'list-providers'],
      ['api', 'client', 'validate', './openapi.yaml'],
    ]) {
      result = runInApi(args);
      assert(result.status === 0, `${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
  });

  record('service and tools behavior', () => {
    for (const args of [
      ['service', 'polyglot', 'list'],
      ['service', 'run', 'health'],
      ['service', 'run', 'logs'],
      ['tools', 'detect'],
      ['tools', 'snapshots'],
      ['tools', 'cleanup-snapshots'],
      ['tools', 'dev', 'status'],
      ['tools', 'hotreload', 'list'],
      ['tools', 'devenv', 'detect'],
      ['tools', 'debug', 'generate'],
    ]) {
      const result = runInWorkspace(args);
      assert(result.status === 0, `${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
  });

  record('infrastructure generator behavior', () => {
    fs.mkdirSync(infraRoot, { recursive: true });
    for (const args of [
      ['k8s', 'manifests', 'test-app'],
      ['cloud', 'aws', 'test-app', '--region', 'us-east-1'],
      ['observe', 'metrics', 'test-app'],
      ['security', 'vulnerability-scan', 'test-app'],
      ['data', 'convert', 'test-app'],
    ]) {
      const result = runInInfra(args);
      assert(result.status === 0, `${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
  });

  record('deprecated aliases', () => {
    for (const alias of aliases) {
      const result = runCli([alias], { cwd: tmpRoot, home: homeDir, timeout: 10000 });
      assert(result.status === 1, `${alias} exited with ${result.status}`);
      assert(
        (result.stderr || result.stdout).includes('[deprecated]'),
        `${alias} did not print a deprecation warning`
      );
    }
  });

  return {
    suite: 'behavior',
    total: 10 + aliases.length,
    failures,
  };
}

function summarize(results) {
  return {
    suites: results.map(result => ({
      suite: result.suite,
      total: result.total,
      failed: result.failures.length,
    })),
    totalFailures: results.reduce((sum, result) => sum + result.failures.length, 0),
    failures: results.flatMap(result =>
      result.failures.map(failure => ({ suite: result.suite, ...failure }))
    ),
  };
}

function main() {
  const suite = parseSuite();
  const results = [];

  if (suite === 'help' || suite === 'all') {
    results.push(runHelpSuite());
  }
  if (suite === 'behavior' || suite === 'all') {
    results.push(runBehaviorSuite());
  }

  if (results.length === 0) {
    console.error('Unknown suite. Use --suite=help, --suite=behavior, or --suite=all.');
    process.exit(1);
  }

  const summary = summarize(results);
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.totalFailures > 0 ? 1 : 0);
}

main();
