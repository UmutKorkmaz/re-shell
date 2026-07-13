import * as fs from 'fs-extra';
import * as path from 'path';
import { ValidationError } from './error-handler';
import type { PermissionShorthand, LicenseType } from './plugin-wizard';
export type { PluginScaffoldConfig } from './plugin-wizard';

// --- Types ---

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface ScaffoldResult {
  pluginDir: string;
  files: ScaffoldFile[];
  dryRun: boolean;
}

export interface ScaffoldOptions {
  dryRun?: boolean;
  force?: boolean;
}

// --- Utilities ---

export function toFunctionName(name: string): string {
  const parts = name.split(/[:\-]/);
  return parts
    .map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

export function permissionToObject(perm: PermissionShorthand): {
  type: string;
  access: string;
  description: string;
} {
  if (perm.includes(':')) {
    const [type, access] = perm.split(':');
    return {
      type,
      access,
      description: `${access.charAt(0).toUpperCase() + access.slice(1)} access to ${type}`,
    };
  }
  return {
    type: perm,
    access: 'full',
    description: `Full ${perm} access`,
  };
}

// --- License Text ---

const LICENSE_TEXTS: Record<LicenseType, (author: string, year: number) => string> = {
  MIT: (author, year) =>
    `MIT License\n\nCopyright (c) ${year} ${author}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  'Apache-2.0': (author, year) =>
    `Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/\n\nCopyright (c) ${year} ${author}\n\nLicensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at\n\n    http://www.apache.org/licenses/LICENSE-2.0\n\nUnless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.`,
  ISC: (author, year) =>
    `ISC License\n\nCopyright (c) ${year} ${author}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
  Unlicense: (_author, _year) =>
    `This is free and unencumbered software released into the public domain.\n\nAnyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.\n\nFor more information, please refer to <http://unlicense.org>`,
};

// --- File Generators ---

function generateTypesTs(): string {
  return `// Minimal type declarations for re-shell plugin development.
// This is a simplified subset of @re-shell/cli's plugin-system.ts interfaces.
// Extend with additional fields (hooks, utils, dataPath, etc.) as needed.

export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface PluginContext {
  cli: { version: string; rootPath: string; configPath: string };
  plugin: { name: string; version: string; config: Record<string, unknown> };
  logger: PluginLogger;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main: string;
}

export interface Plugin {
  manifest: PluginManifest;
  activate(context: PluginContext): Promise<void> | void;
  deactivate?(context: PluginContext): Promise<void> | void;
}
`;
}

function generateIndexTs(config: PluginScaffoldConfig): string {
  return `import type { Plugin, PluginContext } from './types';

export const plugin: Plugin = {
  manifest: {
    name: '${config.name}',
    version: '0.1.0',
    description: '${config.description.replace(/'/g, "\\'")}',
    main: 'src/index.ts',
  },

  async activate(context: PluginContext) {
    context.logger.info('${config.name} activated');
  },

  async deactivate(context: PluginContext) {
    context.logger.info('${config.name} deactivated');
  },
};
`;
}

function generateHooksTs(config: PluginScaffoldConfig): string | null {
  if (config.hooks.length === 0) return null;
  const stubs = config.hooks.map(hook => {
    const fnName = toFunctionName(hook);
    return `export async function ${fnName}(context: PluginContext, data: unknown) {
  context.logger.debug('${hook} hook executed');
}`;
  }).join('\n\n');

  return `import type { PluginContext } from './types';

${stubs}
`;
}

function generateCommandsTs(config: PluginScaffoldConfig): string | null {
  if (config.commands.length === 0) return null;
  const usedNames = new Map<string, number>();
  const stubs = config.commands.map(cmd => {
    let fnName = toFunctionName(cmd);
    if (usedNames.has(fnName)) {
      const count = usedNames.get(fnName)! + 1;
      usedNames.set(fnName, count);
      fnName = `${fnName}${count}`;
    } else {
      usedNames.set(fnName, 1);
    }
    return `export async function ${fnName}(context: PluginContext, args: string[]) {
  context.logger.info('Running ${cmd} command');
}`;
  }).join('\n\n');

  return `import type { PluginContext } from './types';

${stubs}
`;
}

function generatePackageJson(config: PluginScaffoldConfig): string {
  const pkg: Record<string, unknown> = {
    name: config.name,
    version: '0.1.0',
    description: config.description,
    main: 'src/index.ts',
    keywords: ['reshell-plugin'],
    engines: { node: '>=18.0.0', 'reshell-cli': '>=0.30.0' },
    scripts: {
      build: 'tsc',
      test: 'vitest run',
      prepublishOnly: 're-shell plugin validate-publish',
    },
    author: config.author,
    license: config.license,
    reshell: {
      frameworkTarget: config.frameworkTarget,
    },
  };

  const reshell = pkg.reshell as Record<string, unknown>;
  if (config.hooks.length > 0) reshell.hooks = config.hooks;
  if (config.commands.length > 0) reshell.commands = config.commands;
  if (config.permissions.length > 0) {
    reshell.permissions = config.permissions.map(p => permissionToObject(p));
  }

  return JSON.stringify(pkg, null, 2);
}

function generateTsconfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      declaration: true,
      strict: false,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: 'dist',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'tests'],
  }, null, 2);
}

function generateGitignore(): string {
  return `node_modules/\ndist/\n.env\n*.log\n`;
}

function generateNpmignore(): string {
  return `src/\ntests/\n.github/\ntsconfig.json\n`;
}

function generateLicense(config: PluginScaffoldConfig): string {
  const year = new Date().getFullYear();
  return LICENSE_TEXTS[config.license](config.author, year);
}

function generateReadme(config: PluginScaffoldConfig): string {
  const hooksSection = config.hooks.length > 0
    ? `\n## Hooks\n\n${config.hooks.map(h => `- \`${h}\``).join('\n')}\n`
    : '';
  const commandsSection = config.commands.length > 0
    ? `\n## Commands\n\n${config.commands.map(c => `- \`${c}\``).join('\n')}\n`
    : '';

  return `# ${config.displayName}

${config.description}

## Installation

\`\`\`bash
re-shell plugin install ${config.name}
\`\`\`
${hooksSection}${commandsSection}
## License

${config.license}
`;
}

function generateTestFile(config: PluginScaffoldConfig): string {
  return `import { describe, expect, it } from 'vitest';
import { plugin } from '../src/index';

describe('${config.name}', () => {
  it('should export a valid plugin manifest', () => {
    expect(plugin.manifest.name).toBe('${config.name}');
    expect(plugin.manifest.version).toBeDefined();
  });

  it('should have activate function', () => {
    expect(typeof plugin.activate).toBe('function');
  });

  it('should have deactivate function', () => {
    expect(typeof plugin.deactivate).toBe('function');
  });
});
`;
}

function generateCI(): string {
  return `name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
      - run: npx re-shell plugin validate-publish
`;
}

// --- Main scaffold function ---

import type { PluginScaffoldConfig } from './plugin-wizard';

export async function scaffold(
  config: PluginScaffoldConfig,
  targetPath: string,
  options: ScaffoldOptions = {}
): Promise<ScaffoldResult> {
  const { dryRun = false, force = false } = options;
  const pluginDir = path.join(targetPath, config.name);

  // Check existing directory
  if (!dryRun && await fs.pathExists(pluginDir) && !force) {
    throw new ValidationError(
      `Directory '${config.name}' already exists. Use --force to overwrite.`
    );
  }

  // Build file list
  const files: ScaffoldFile[] = [];

  files.push({ path: 'package.json', content: generatePackageJson(config) });
  files.push({ path: 'src/index.ts', content: generateIndexTs(config) });
  files.push({ path: 'src/types.ts', content: generateTypesTs() });

  const hooksContent = generateHooksTs(config);
  if (hooksContent) files.push({ path: 'src/hooks.ts', content: hooksContent });

  const commandsContent = generateCommandsTs(config);
  if (commandsContent) files.push({ path: 'src/commands.ts', content: commandsContent });

  files.push({ path: 'tsconfig.json', content: generateTsconfig() });
  files.push({ path: '.gitignore', content: generateGitignore() });
  files.push({ path: '.npmignore', content: generateNpmignore() });
  files.push({ path: 'README.md', content: generateReadme(config) });
  files.push({ path: 'LICENSE', content: generateLicense(config) });

  if (config.includeTests) {
    files.push({ path: 'tests/index.test.ts', content: generateTestFile(config) });
  }

  if (config.includeCI) {
    files.push({ path: '.github/workflows/ci.yml', content: generateCI() });
  }

  // Write files (unless dry run)
  if (!dryRun) {
    if (force && await fs.pathExists(pluginDir)) {
      await fs.remove(pluginDir);
    }
    for (const file of files) {
      const fullPath = path.join(pluginDir, file.path);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, 'utf8');
    }
  }

  return { pluginDir, files, dryRun };
}
