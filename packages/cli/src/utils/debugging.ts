// Debugging Configuration Generator
// Provides framework-specific debugging configurations for various IDEs

import * as path from 'path';
import * as fs from 'fs/promises';
import chalk from 'chalk';

/**
 * Represents a single VS Code launch configuration entry used inside
 * `.vscode/launch.json`. Each configuration describes how a debug session
 * should be started (program to run, runtime arguments, environment
 * variables, source map settings, etc.).
 */
export interface VSCodeLaunchConfig {
  name: string;
  type: string;
  request: string;
  program?: string;
  args?: string[];
  cwd?: string;
  runtimeExecutable?: string;
  runtimeArgs?: string[];
  env?: Record<string, string>;
  console?: 'integratedTerminal' | 'internalConsole';
  internalConsoleOptions?: 'neverOpen' | 'openOnSessionStart';
  skipFiles?: string[];
  sourceMaps?: boolean;
  outFiles?: string[];
  rootPath?: string;
  url?: string;
  webRoot?: string;
}

/**
 * Represents a JetBrains (IntelliJ, PyCharm, WebStorm, GoLand, etc.)
 * run/debug configuration entry. These map to the XML run configurations
 * stored under the `.idea/runConfigurations/` directory of a project.
 */
export interface JetBrainsRunConfig {
  name: string;
  type: string;
  workingDirectory?: string;
  filePath?: string;
  file?: string;
  programParameters?: string[];
  env?: Record<string, string>;
  url?: string;
  usePty?: boolean;
  browser?: string;
  port?: number;
  kind?: string;
  module?: string;
  command?: string;
  interpreterId?: string;
}

/**
 * The result of generating debug configurations for a project. Each result
 * is targeted at a specific IDE and contains both the structured config
 * object and the list of files (with their content) that should be written
 * to disk.
 */
export interface DebugConfigResult {
  ide: 'vscode' | 'jetbrains' | 'chrome';
  config: any;
  files: { path: string; content: string }[];
}

/**
 * Describes the project for which debug configurations should be generated.
 * Contains metadata such as the framework, language, entry point, port and
 * optional environment file that drive the generated debug setup.
 */
export interface ProjectDebugInfo {
  name: string;
  type: 'backend' | 'frontend' | 'fullstack';
  framework: string;
  language: string;
  entryPoint?: string;
  port?: number;
  envFile?: string;
}

/**
 * Generate one or more VS Code launch configurations for the given project.
 *
 * The generated configurations adapt to the project's language and framework,
 * producing appropriate Node.js, Chrome, Python (debugpy), Go, Rust (lldb),
 * Java, .NET (coreclr), Ruby, PHP (Xdebug) and C++ (cppdbg) launch entries.
 * When the environment is not explicitly supported, a generic Node.js
 * fallback configuration is emitted. A Jest/pytest/test runner debug
 * configuration is also included where applicable.
 *
 * @param project - Metadata describing the project to generate configs for.
 * @returns An array of VS Code launch configuration objects ready to be
 *   serialized into a `launch.json` file.
 */
export function generateVSCodeLaunchConfig(project: ProjectDebugInfo): VSCodeLaunchConfig[] {
  const configs: VSCodeLaunchConfig[] = [];
  const { name, framework, language, entryPoint, port, envFile } = project;

  // Common base configuration
  const baseConfig: Partial<VSCodeLaunchConfig> = {
    cwd: '${workspaceFolder}',
    console: 'integratedTerminal',
    skipFiles: ['<node_internals>/**'],
  };

  if (envFile) {
    baseConfig.env = {
      ...loadEnvFile(envFile),
    };
  }

  // Node.js / TypeScript backend configurations
  if (language === 'typescript' || language === 'javascript') {
    if (framework === 'express' || framework === 'fastify' || framework === 'nestjs') {
      const tsConfig = language === 'typescript';
      const scriptPath = entryPoint || (tsConfig ? 'src/index.ts' : 'src/index.js');

      configs.push({
        ...baseConfig,
        name: `${name}: Debug Server`,
        type: 'node',
        request: 'launch',
        runtimeExecutable: tsConfig ? 'node' : undefined,
        runtimeArgs: tsConfig ? ['-r', 'ts-node/register', scriptPath] : undefined,
        program: tsConfig ? undefined : scriptPath,
        env: {
          NODE_ENV: 'development',
          ...baseConfig.env,
        },
        sourceMaps: tsConfig,
        outFiles: tsConfig ? ['${workspaceFolder}/dist/**/*.js'] : undefined,
      } as VSCodeLaunchConfig);

      // Add Jest debug config
      configs.push({
        ...baseConfig,
        name: `${name}: Debug Jest Tests`,
        type: 'node',
        request: 'launch',
        runtimeArgs: [
          '--inspect-brk',
          '${workspaceFolder}/node_modules/.bin/jest',
          '--runInBand',
          '--no-cache',
        ],
        console: 'integratedTerminal',
        internalConsoleOptions: 'neverOpen',
      } as VSCodeLaunchConfig);
    }

    // Next.js configuration
    if (framework === 'next' || framework === 'nextjs') {
      configs.push({
        ...baseConfig,
        name: `${name}: Debug Next.js`,
        type: 'node',
        request: 'launch',
        runtimeExecutable: 'node',
        runtimeArgs: ['--inspect'],
        program: '${workspaceFolder}/node_modules/.bin/next',
        args: ['dev'],
        console: 'integratedTerminal',
        env: {
          NODE_ENV: 'development',
          ...baseConfig.env,
        },
      } as VSCodeLaunchConfig);

      configs.push({
        ...baseConfig,
        name: `${name}: Debug Next.js Client`,
        type: 'chrome',
        request: 'launch',
        url: `http://localhost:${port || 3000}`,
        webRoot: '${workspaceFolder}',
      } as VSCodeLaunchConfig);
    }

    // React / Vite configuration
    if (framework === 'react' || framework === 'vite' || framework === 'vue' || framework === 'svelte') {
      const devPort = port || (framework === 'vite' ? 5173 : 3000);

      configs.push({
        ...baseConfig,
        name: `${name}: Debug Vite Dev Server`,
        type: 'node',
        request: 'launch',
        program: '${workspaceFolder}/node_modules/.bin/vite',
        args: ['--debug', '--host'],
        console: 'integratedTerminal',
        env: {
          ...baseConfig.env,
        },
      } as VSCodeLaunchConfig);

      configs.push({
        ...baseConfig,
        name: `${name}: Debug Client (Chrome)`,
        type: 'chrome',
        request: 'launch',
        url: `http://localhost:${devPort}`,
        webRoot: '${workspaceFolder}',
        sourceMaps: true,
      } as VSCodeLaunchConfig);
    }
  }

  // Python configurations
  if (language === 'python') {
    const scriptPath = entryPoint || 'src/main.py';

    configs.push({
      ...baseConfig,
      name: `${name}: Debug Python`,
      type: 'debugpy',
      request: 'launch',
      program: scriptPath,
      console: 'integratedTerminal',
      env: {
        PYTHONPATH: '${workspaceFolder}',
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);

    // Add pytest debug config
    configs.push({
      ...baseConfig,
      name: `${name}: Debug Pytest`,
      type: 'debugpy',
      request: 'launch',
      module: 'pytest',
      args: ['tests', '-v'],
      console: 'integratedTerminal',
      env: {
        PYTHONPATH: '${workspaceFolder}',
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);
  }

  // Go configurations
  if (language === 'go') {
    const modulePath = entryPoint || 'cmd/server/main.go';

    configs.push({
      ...baseConfig,
      name: `${name}: Debug Go`,
      type: 'go',
      request: 'launch',
      mode: 'auto',
      program: modulePath,
      env: {
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);

    // Go test debug
    configs.push({
      ...baseConfig,
      name: `${name}: Debug Go Tests`,
      type: 'go',
      request: 'launch',
      mode: 'test',
      program: '${workspaceFolder}',
      env: {
        ...baseConfig.env,
      },
      args: ['-test.v'],
    } as VSCodeLaunchConfig);
  }

  // Rust configurations
  if (language === 'rust') {
    const binaryName = name.toLowerCase().replace(/-/g, '_');

    configs.push({
      ...baseConfig,
      name: `${name}: Debug Rust`,
      type: 'lldb',
      request: 'launch',
      program: `\${workspaceFolder}/target/debug/${binaryName}`,
      args: [],
      cwd: '${workspaceFolder}',
      preLaunchTask: 'cargo build',
      env: {
        RUST_LOG: 'debug',
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);

    // Rust test debug
    configs.push({
      ...baseConfig,
      name: `${name}: Debug Rust Tests`,
      type: 'lldb',
      request: 'launch',
      program: `\${workspaceFolder}/target/debug/${binaryName}`,
      args: ['--nocapture', '--test-threads=1'],
      cwd: '${workspaceFolder}',
      preLaunchTask: 'cargo test --no-run',
      env: {
        RUST_TEST_THREADS: '1',
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);
  }

  // Java / Spring Boot configurations
  if (language === 'java' || framework === 'spring-boot') {
    configs.push({
      ...baseConfig,
      name: `${name}: Debug Java`,
      type: 'java',
      request: 'attach',
      hostName: 'localhost',
      port: 5005,
      env: {
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);
  }

  // .NET / C# configurations
  if (language === 'csharp' || framework === 'aspdotnet') {
    configs.push({
      ...baseConfig,
      name: `${name}: Debug .NET`,
      type: 'coreclr',
      request: 'launch',
      preLaunchTask: 'build',
      program: entryPoint || `\${workspaceFolder}/bin/Debug/net8.0/${name}.dll`,
      args: [],
      cwd: '${workspaceFolder}',
      stopAtEntry: false,
      console: 'integratedTerminal',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);
  }

  // Ruby / Rails configurations
  if (language === 'ruby' || framework === 'rails') {

    configs.push({
      ...baseConfig,
      name: `${name}: Debug Rails`,
      type: 'Ruby LSP',
      request: 'attach',
      remoteHost: 'localhost',
      remotePort: 1234,
      localPort: 1234,
      remoteWorkspaceRoot: '/workdir/${workspaceFolderBasename}',
      localWorkspaceRoot: '${workspaceFolder}',
      env: {
        RAILS_ENV: 'development',
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);
  }

  // PHP configurations
  if (language === 'php' || framework === 'laravel') {
    const scriptPath = entryPoint || 'artisan';

    configs.push({
      ...baseConfig,
      name: `${name}: Listen for Xdebug`,
      type: 'php',
      request: 'launch',
      port: 9003,
      pathMappings: {
        '${workspaceFolder}': '${workspaceFolder}',
      },
      env: {
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);

    configs.push({
      ...baseConfig,
      name: `${name}: Debug Current Script (PHP FPM)`,
      type: 'php',
      request: 'launch',
      program: scriptPath,
      cwd: '${workspaceFolder}/public',
      runtimeArgs: ['serve', 'localhost:8000'],
      port: 9003,
      env: {
        ...baseConfig.env,
      },
    } as VSCodeLaunchConfig);
  }

  // C++ configurations
  if (language === 'cpp') {
    const targetName = entryPoint || `build/${name}`;

    configs.push({
      ...baseConfig,
      name: `${name}: Debug C++`,
      type: 'cppdbg',
      request: 'launch',
      program: targetName,
      args: [],
      stopAtEntry: false,
      cwd: '${workspaceFolder}',
      environment: [],
      externalConsole: false,
      MIMode: 'gdb',
      setupCommands: [
        {
          description: 'Enable pretty-printing for gdb',
          text: '-enable-pretty-printing',
          ignoreFailures: true,
        },
      ],
    } as VSCodeLaunchConfig);
  }

  // Fallback configuration for unsupported languages
  if (configs.length === 0) {
    configs.push({
      ...baseConfig,
      name: `${name}: Debug`,
      type: 'node',
      request: 'launch',
      program: entryPoint || 'src/index.js',
      console: 'integratedTerminal',
    } as VSCodeLaunchConfig);
  }

  return configs;
}

/**
 * Generate JetBrains IDE run/debug configurations for the given project.
 *
 * The returned configurations adapt to the project's language and framework,
 * producing entries for Node.js (Express/Fastify, Next.js), Python
 * (FastAPI/Django/Flask), Go, Rust (Cargo), Java/Spring Boot, Ruby/Rails and
 * PHP/Laravel projects.
 *
 * @param project - Metadata describing the project to generate configs for.
 * @returns An array of JetBrains run configuration objects suitable for
 *   serialization into `.idea/runConfigurations/` XML files.
 */
export function generateJetbrainsRunConfig(project: ProjectDebugInfo): JetBrainsRunConfig[] {
  const configs: JetBrainsRunConfig[] = [];
  const { name, framework, language, entryPoint, port } = project;

  const workspace = '$PROJECT_DIR$';

  // Node.js configurations
  if (language === 'typescript' || language === 'javascript') {
    if (framework === 'express' || framework === 'fastify') {
      configs.push({
        name: `${name}: Debug Server`,
        type: 'NodeJS',
        workingDirectory: workspace,
        filePath: entryPoint || 'src/index.js',
        env: {
          NODE_ENV: 'development',
        },
        usePty: true,
      });
    }

    if (framework === 'next' || framework === 'nextjs') {
      configs.push({
        name: `${name}: Debug Next.js`,
        type: 'NodeJS',
        workingDirectory: workspace,
        programParameters: ['node_modules/.bin/next', 'dev'],
        env: {
          NODE_ENV: 'development',
        },
        usePty: true,
      });

      configs.push({
        name: `${name}: Debug Chrome`,
        type: 'JavaScriptDebug',
        url: `http://localhost:${port || 3000}`,
        usePty: true,
      });
    }
  }

  // Python configurations
  if (language === 'python') {
    if (framework === 'fastapi' || framework === 'django' || framework === 'flask') {
      const type = framework === 'django' ? 'PythonDjangoServer' : 'Python';
      const kind = framework === 'django' ? 'Django server' : 'file';
      const djangoModule = framework === 'django' ? 'settings' : undefined;
      const djangoSettings = framework === 'django' ? 'src.settings' : undefined;

      configs.push({
        name: `${name}: Debug Python`,
        type,
        workingDirectory: workspace,
        kind,
        file: entryPoint || 'src/main.py',
        ...(djangoModule ? { module: djangoModule } : {}),
        env: {
          PYTHONUNBUFFERED: '1',
          ...(djangoSettings ? { DJANGO_SETTINGS_MODULE: djangoSettings } : {}),
        },
      });
    }
  }

  // Go configurations
  if (language === 'go') {
    configs.push({
      name: `${name}: Debug Go`,
      type: 'Go Application',
      workingDirectory: workspace,
      filePath: entryPoint || 'cmd/server/main.go',
      env: {},
    });
  }

  // Rust configurations
  if (language === 'rust') {
    configs.push({
      name: `${name}: Debug Rust`,
      type: 'CargoCommand',
      workingDirectory: workspace,
      command: 'run',
      env: {
        RUST_LOG: 'debug',
      },
    });
  }

  // Java configurations
  if (language === 'java' || framework === 'spring-boot') {
    configs.push({
      name: `${name}: Debug Spring Boot`,
      type: 'SpringBoot',
      workingDirectory: workspace,
      env: {
        SPRING_PROFILES_ACTIVE: 'dev',
      },
    });
  }

  // Ruby configurations
  if (language === 'ruby' || framework === 'rails') {
    configs.push({
      name: `${name}: Debug Rails`,
      type: 'RailsRunner',
      workingDirectory: workspace,
      env: {
        RAILS_ENV: 'development',
      },
    });
  }

  // PHP configurations
  if (language === 'php' || framework === 'laravel') {
    configs.push({
      name: `${name}: Debug PHP Script`,
      type: 'PhpLocalRunConfiguration',
      workingDirectory: workspace,
      filePath: entryPoint || 'artisan',
      interpreterId: 'remote',
    });
  }

  return configs;
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile(envPath: string): Record<string, string> {
  // Placeholder - in real implementation, read and parse .env file
  return {};
}

/**
 * Generate the full set of debug configuration files for a project.
 *
 * Produces VS Code configuration artifacts: the `launch.json` debug
 * configurations, an `extensions.json` with recommended extensions for the
 * project's stack, and a `tasks.json` containing build/run tasks. Each
 * returned entry includes the target file path and its serialized content.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param project - Metadata describing the project to generate configs for.
 * @returns An array of {@link DebugConfigResult} objects, each representing
 *   a group of files to be written for a specific IDE.
 */
export async function generateDebugConfigs(
  projectPath: string,
  project: ProjectDebugInfo
): Promise<DebugConfigResult[]> {
  const results: DebugConfigResult[] = [];

  // Generate VS Code configurations
  const vscodeDir = path.join(projectPath, '.vscode');
  const vscodeLaunchPath = path.join(vscodeDir, 'launch.json');

  const launchConfigs = generateVSCodeLaunchConfig(project);

  const vscodeContent = JSON.stringify(
    {
      version: '0.2.0',
      configurations: launchConfigs,
    },
    null,
    2
  );

  results.push({
    ide: 'vscode',
    config: launchConfigs,
    files: [
      {
        path: vscodeLaunchPath,
        content: vscodeContent,
      },
    ],
  });

  // Generate VS Code extensions.json for recommended extensions
  const vscodeExtensionsPath = path.join(vscodeDir, 'extensions.json');
  const recommendedExtensions = getRecommendedExtensions(project);
  results.push({
    ide: 'vscode',
    config: recommendedExtensions,
    files: [
      {
        path: vscodeExtensionsPath,
        content: JSON.stringify({ recommendations: recommendedExtensions }, null, 2),
      },
    ],
  });

  // Generate tasks.json for build tasks
  const vscodeTasksPath = path.join(vscodeDir, 'tasks.json');
  const buildTasks = generateBuildTasks(project);
  results.push({
    ide: 'vscode',
    config: buildTasks,
    files: [
      {
        path: vscodeTasksPath,
        content: JSON.stringify({ version: '2.0.0', tasks: buildTasks }, null, 2),
      },
    ],
  });

  return results;
}

/**
 * Get recommended VS Code extensions for a project
 */
function getRecommendedExtensions(project: ProjectDebugInfo): string[] {
  const { language, framework } = project;
  const extensions: string[] = [];

  // Language server extensions
  const languageExtensions: Record<string, string[]> = {
    typescript: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode', 'ms-vscode.vscode-typescript-next'],
    javascript: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'],
    python: ['ms-python.python', 'ms-python.debugpy', 'ms-python.pylint', 'ms-python.isort'],
    go: ['golang.go', 'golang.go-nightly', 'ms-vscode.makefile-tools'],
    rust: ['rust-lang.rust-analyzer', 'tamasfe.even-better-toml', 'serayuzengc.vue-3-snippets'],
    java: ['redhat.java', 'vscjava.vscode-java-pack', 'vscjava.vscode-java-debug'],
    csharp: ['ms-dotnettools.csdevkit', 'ms-dotnettools.blazorwasm-companion', 'k--kato.dic'],
    ruby: ['shopify.ruby-lsp', 'misogi.ruby-rubocop'],
    php: ['xdebug.php-debug', 'felixfbecker.php-pack'],
    cpp: ['ms-vscode.cpptools', 'ms-vscode.cmake-tools'],
  };

  if (languageExtensions[language]) {
    extensions.push(...languageExtensions[language]);
  }

  // Framework-specific extensions
  const frameworkExtensions: Record<string, string[]> = {
    nestjs: ['firsttris.vscode-jest-runner'],
    next: ['vercel.vscode-nextjs'],
    react: ['dsznajder.es7-react-js-snippets'],
    vue: ['vue.volar', 'Vue.volar'],
    django: ['batisteo.vscode-django'],
    rails: ['wingrunr25.vscode-rails'],
    laravel: ['amiralizi.vscode-laravel-extra-intellisense'],
    spring: ['pivotal.vscode-boot-dev-pack'],
  };

  if (frameworkExtensions[framework]) {
    extensions.push(...frameworkExtensions[framework]);
  }

  // Docker extension (useful for most backend projects)
  extensions.push('ms-azuretools.vscode-docker');

  // Git extensions
  extensions.push('eamodio.gitlens');

  return extensions;
}

/**
 * Generate VS Code build tasks
 */
function generateBuildTasks(project: ProjectDebugInfo): any[] {
  const { language } = project;
  const tasks: any[] = [];

  // Common tasks
  tasks.push({
    label: 'npm: install',
    type: 'shell',
    command: 'npm install',
    problemMatcher: [],
  });

  if (language === 'typescript' || language === 'javascript') {
    tasks.push({
      label: 'npm: dev',
      type: 'shell',
      command: 'npm run dev',
      isBackground: true,
      problemMatcher: [],
    });

    tasks.push({
      label: 'npm: build',
      type: 'shell',
      command: 'npm run build',
      problemMatcher: ['$tsc'],
    });

    tasks.push({
      label: 'npm: test',
      type: 'shell',
      command: 'npm test',
      problemMatcher: [],
    });
  }

  if (language === 'python') {
    tasks.push({
      label: 'python: install',
      type: 'shell',
      command: 'pip install -e .',
      problemMatcher: [],
    });

    tasks.push({
      label: 'python: run',
      type: 'shell',
      command: 'python src/main.py',
      isBackground: true,
      problemMatcher: [],
    });
  }

  if (language === 'go') {
    tasks.push({
      label: 'go: mod tidy',
      type: 'shell',
      command: 'go mod tidy',
      problemMatcher: [],
    });

    tasks.push({
      label: 'go: run',
      type: 'shell',
      command: 'go run cmd/server/main.go',
      isBackground: true,
      problemMatcher: [],
    });
  }

  if (language === 'rust') {
    tasks.push({
      label: 'cargo: build',
      type: 'shell',
      command: 'cargo build',
      problemMatcher: ['$rustc'],
    });

    tasks.push({
      label: 'cargo: run',
      type: 'shell',
      command: 'cargo run',
      isBackground: true,
      problemMatcher: [],
    });
  }

  return tasks;
}

/**
 * Write the generated debug configuration files into the project directory.
 *
 * Internally calls {@link generateDebugConfigs} and persists each produced
 * file to disk, creating any required parent directories. Existing files are
 * skipped unless the `force` option is set, and progress can be logged when
 * the `verbose` option is enabled.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param project - Metadata describing the project to generate configs for.
 * @param options - Optional behavior switches:
 *   - `force`: overwrite existing files when `true`. Defaults to `false`.
 *   - `verbose`: log each created/skipped file path when `true`. Defaults to `false`.
 * @returns A promise that resolves once all files have been written.
 */
export async function writeDebugConfigs(
  projectPath: string,
  project: ProjectDebugInfo,
  options: {
    force?: boolean;
    verbose?: boolean;
  } = {}
): Promise<void> {
  const { force = false, verbose = false } = options;

  const results = await generateDebugConfigs(projectPath, project);

  for (const result of results) {
    for (const file of result.files) {
      const filePath = file.path;

      // Check if file exists
      const exists = await fs.access(filePath).then(() => true, () => false);

      if (exists && !force) {
        console.log(chalk.yellow(`  Skipping ${filePath} (already exists)`));
        continue;
      }

      // Create directory if needed
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write file
      await fs.writeFile(filePath, file.content, 'utf-8');

      if (verbose) {
        console.log(chalk.gray(`  Created ${filePath}`));
      }
    }
  }
}

/**
 * Print a human-readable summary of the debug configuration for a project.
 *
 * Logs the project's framework, language and type, lists every VS Code
 * launch configuration that would be generated, and groups the recommended
 * VS Code extensions by publisher. Output is written to the console using
 * colored formatting.
 *
 * @param project - Metadata describing the project to summarize.
 */
export function displayDebugConfigInfo(project: ProjectDebugInfo): void {
  console.log(chalk.bold(`\n🐛 Debug Configuration for ${project.name}\n`));

  console.log(chalk.gray('Framework:'), chalk.cyan(project.framework));
  console.log(chalk.gray('Language:'), chalk.cyan(project.language));
  console.log(chalk.gray('Type:'), chalk.cyan(project.type));

  const configs = generateVSCodeLaunchConfig(project);
  console.log(chalk.gray('\nAvailable Debug Configurations:'));
  console.log(chalk.gray('VS Code Launch Configurations:'), chalk.yellow(configs.length.toString()));

  for (const config of configs) {
    console.log(chalk.gray('  •'), chalk.cyan(config.name));
  }

  const extensions = getRecommendedExtensions(project);
  console.log(chalk.gray('\nRecommended VS Code Extensions:'), chalk.yellow(extensions.length.toString()));

  const extCategories: Record<string, string[]> = {};
  for (const ext of extensions) {
    const category = ext.split('.')[0];
    if (!extCategories[category]) {
      extCategories[category] = [];
    }
    extCategories[category].push(ext);
  }

  for (const [category, exts] of Object.entries(extCategories)) {
    console.log(chalk.gray(`\n  ${category}:`));
    for (const ext of exts) {
      console.log(chalk.gray(`    • ${ext}`));
    }
  }

  console.log('');
}
