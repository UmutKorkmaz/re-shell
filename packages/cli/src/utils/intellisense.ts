/**
 * Cross-Language Code Completion and IntelliSense Integration
 * Generates LSP configuration and IntelliSense settings for all supported languages
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Language server configuration
export interface LanguageServerConfig {
  language: string;
  fileExtensions: string[];
  serverName: string;
  command: string;
  args: string[];
  settings?: Record<string, unknown>;
  env?: Record<string, string>;
  requiresInstall?: boolean;
  installCommand?: string;
  configFiles?: string[];
}

// IntelliSense configuration
export interface IntelliSenseConfig {
  languages: string[];
  languageServers: LanguageServerConfig[];
  vscodeSettings: Record<string, unknown>;
  jetbrainsSettings: Record<string, unknown>;
  vimSettings: string;
  emacsSettings: string;
}

// Project type for IntelliSense setup
export interface ProjectType {
  name: string;
  languages: string[];
  frameworks: string[];
  recommendedExtensions: string[];
  languageServers: LanguageServerConfig[];
  additionalFiles: Record<string, string>;
}

// Language server definitions
const LANGUAGE_SERVERS: Record<string, LanguageServerConfig> = {
  // TypeScript/JavaScript
  typescript: {
    language: 'TypeScript',
    fileExtensions: ['ts', 'tsx', 'mts'],
    serverName: 'typescript-language-server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    settings: {
      'typescript.preferences.quoteStyle': 'single',
      'typescript.format.enable': true,
      'typescript.suggest.autoImports': true,
      'typescript.suggest.completeFunctionCalls': true,
    },
    requiresInstall: true,
    installCommand: 'npm install -g typescript typescript-language-server',
    configFiles: ['tsconfig.json'],
  },
  javascript: {
    language: 'JavaScript',
    fileExtensions: ['js', 'jsx', 'mjs', 'cjs'],
    serverName: 'typescript-language-server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    settings: {
      'javascript.preferences.quoteStyle': 'single',
      'javascript.format.enable': true,
      'javascript.suggest.autoImports': true,
    },
    requiresInstall: true,
    installCommand: 'npm install -g typescript-language-server',
  },
  python: {
    language: 'Python',
    fileExtensions: ['py', 'pyi'],
    serverName: 'pyright',
    command: 'pyright-langserver',
    args: ['--stdio'],
    settings: {
      'python.languageServer': 'Pylance',
      'python.analysis.typeCheckingMode': 'basic',
      'python.analysis.autoImportCompletions': true,
    },
    requiresInstall: true,
    installCommand: 'npm install -g pyright; pip install pylance',
    configFiles: ['.python-version', 'pyproject.toml'],
  },
  go: {
    language: 'Go',
    fileExtensions: ['go'],
    serverName: 'gopls',
    command: 'gopls',
    args: ['serve'],
    settings: {
      'gopls': {
        'ui.semanticTokens': true,
        'ui.completion.usePlaceholders': true,
        'ui.diagnostic.analyses': {
          'unusedparams': true,
          'shadow': true,
        },
      },
    },
    requiresInstall: true,
    installCommand: 'go install golang.org/x/tools/gopls@latest',
    configFiles: ['go.mod', 'go.sum'],
  },
  rust: {
    language: 'Rust',
    fileExtensions: ['rs'],
    serverName: 'rust-analyzer',
    command: 'rust-analyzer',
    args: [],
    settings: {
      'rust-analyzer': {
        'checkOnSave.command': 'clippy',
        'cargo.loadOutDirsFromCheck': true,
        'procMacro.enable': true,
      },
    },
    requiresInstall: true,
    installCommand: 'rustup component add rust-analyzer',
    configFiles: ['Cargo.toml', 'Cargo.lock'],
  },
  java: {
    language: 'Java',
    fileExtensions: ['java'],
    serverName: 'jdtls',
    command: 'jdtls',
    args: [],
    settings: {
      'java.configuration.updateBuildConfiguration': 'automatic',
      'java.completion.importOrder': ['java', 'javax', 'org', 'com'],
    },
    requiresInstall: true,
    installCommand: 'Install Eclipse JDT LS via VS Code extension',
    configFiles: ['pom.xml', 'build.gradle'],
  },
  'csharp': {
    language: 'C#',
    fileExtensions: ['cs'],
    serverName: 'omnisharp',
    command: 'OmniSharp',
    args: ['--languageserver'],
    settings: {
      'omnisharp.enableRoslynAnalyzers': true,
      'omnisharp.enableImportCompletion': true,
    },
    requiresInstall: true,
    installCommand: 'Install .NET SDK and OmniSharp',
    configFiles: ['*.csproj'],
  },
  ruby: {
    language: 'Ruby',
    fileExtensions: ['rb'],
    serverName: 'solargraph',
    command: 'solargraph',
    args: ['stdio'],
    settings: {
      'ruby.useLanguageServer': true,
      'ruby.lint': {
        'rubocop': {
          'lint': true,
          'rails': true,
        },
      },
    },
    requiresInstall: true,
    installCommand: 'gem install solargraph',
    configFiles: ['Gemfile'],
  },
  php: {
    language: 'PHP',
    fileExtensions: ['php'],
    serverName: 'intelephense',
    command: 'intelephense',
    args: ['--stdio'],
    settings: {
      'intelephense.files.exclude': [
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/CVS/**',
        '**/.DS_Store/**',
        '**/node_modules/**',
        '**/bower_components/**',
        '**/vendor/**/{Test,test,Tests,tests}/**',
      ],
      'intelephense.completion.insertUseDeclaration': true,
    },
    requiresInstall: true,
    installCommand: 'Install via VS Code extension',
    configFiles: ['composer.json'],
  },
  'c++': {
    language: 'C++',
    fileExtensions: ['cpp', 'cc', 'cxx', 'hpp', 'h', 'hxx'],
    serverName: 'clangd',
    command: 'clangd',
    args: ['--background-index'],
    settings: {
      'clangd.arguments': [
        '--background-index',
        '--clang-tidy',
        '--header-insertion=iwyu',
        '--completion-style=detailed',
        '--function-arg-placeholders',
        '--fallback-style=llvm',
      ],
    },
    requiresInstall: true,
    installCommand: 'Install LLVM/clang or via VS Code extension',
    configFiles: ['.clangd', 'compile_commands.json', 'CMakeLists.txt'],
  },
  kotlin: {
    language: 'Kotlin',
    fileExtensions: ['kt', 'kts'],
    serverName: 'kotlin-language-server',
    command: 'kotlin-language-server',
    args: [],
    settings: {
      'kotlin.languageServer.enabled': true,
    },
    requiresInstall: true,
    installCommand: 'Install via VS Code extension',
    configFiles: ['build.gradle.kts'],
  },
  scala: {
    language: 'Scala',
    fileExtensions: ['scala'],
    serverName: 'metals',
    command: 'metals',
    args: [],
    settings: {
      'metals.enableIndeterminateExtensionLoading': true,
    },
    requiresInstall: true,
    installCommand: 'Install via coursier or VS Code extension',
    configFiles: ['build.sbt'],
  },
  lua: {
    language: 'Lua',
    fileExtensions: ['lua'],
    serverName: 'lua-language-server',
    command: 'lua-language-server',
    args: [],
    settings: {
      'Lua.diagnostics.enable': true,
      'Lua.completion.enable': true,
    },
    requiresInstall: true,
    installCommand: 'Install via VS Code extension',
  },
  swift: {
    language: 'Swift',
    fileExtensions: ['swift'],
    serverName: 'sourcekit-lsp',
    command: 'sourcekit-lsp',
    args: [],
    settings: {},
    requiresInstall: true,
    installCommand: 'Install Xcode command line tools',
  },
  vue: {
    language: 'Vue',
    fileExtensions: ['vue'],
    serverName: 'vue-language-server',
    command: 'vue-language-server',
    args: ['--stdio'],
    settings: {
      'volar.autoCompleteRefs': true,
      'volar.codeLens.pugTools': true,
    },
    requiresInstall: true,
    installCommand: 'npm install -g @vue/language-server',
    configFiles: ['vue.config.js'],
  },
  svelte: {
    language: 'Svelte',
    fileExtensions: ['svelte'],
    serverName: 'svelte-language-server',
    command: 'svelteserver',
    args: ['--stdio'],
    settings: {
      'svelte.enable-ts-plugin': true,
    },
    requiresInstall: true,
    installCommand: 'npm install -g svelte-language-server',
  },
};

// IntelliSense generator class
export class IntelliSenseGenerator {
  private projectPath: string;
  private projectType?: string;
  private languages: Set<string> = new Set();

  constructor(projectPath: string, projectType?: string) {
    this.projectPath = projectPath;
    this.projectType = projectType;
  }

  // Detect languages used in the project
  async detectLanguages(): Promise<string[]> {
    const extensions: Record<string, number> = {};

    // Scan project directory for file extensions
    const scanDir = async (dir: string) => {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);

          if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            await scanDir(filePath);
          } else if (stat.isFile()) {
            const ext = path.extname(file).slice(1);
            if (ext) {
              const currentCount = typeof extensions[ext] === 'number' ? extensions[ext] : 0;
              extensions[ext] = currentCount + 1;
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    await scanDir(this.projectPath);

    // Map extensions to languages
    const langMap: Record<string, string[]> = {
      'ts': ['typescript'],
      'tsx': ['typescript', 'vue'],
      'js': ['javascript'],
      'jsx': ['javascript'],
      'py': ['python'],
      'go': ['go'],
      'rs': ['rust'],
      'java': ['java'],
      'cs': ['csharp'],
      'rb': ['ruby'],
      'php': ['php'],
      'cpp': ['c++'],
      'cc': ['c++'],
      'cxx': ['c++'],
      'h': ['c++'],
      'hpp': ['c++'],
      'kt': ['kotlin'],
      'scala': ['scala'],
      'lua': ['lua'],
      'swift': ['swift'],
      'vue': ['vue'],
      'svelte': ['svelte'],
    };

    const detected = new Set<string>();
    for (const [ext, langs] of Object.entries(langMap)) {
      if (extensions[ext]) {
        langs.forEach(l => detected.add(l));
      }
    }

    return Array.from(detected);
  }

  // Setup IntelliSense for detected languages
  async setupIntelliSense(languages?: string[]): Promise<IntelliSenseConfig> {
    const detectedLanguages = languages || await this.detectLanguages();
    detectedLanguages.forEach(l => this.languages.add(l));

    const languageServers: LanguageServerConfig[] = [];
    const vscodeSettings: Record<string, unknown> = {};
    const recommendedExtensions: string[] = [];

    for (const lang of detectedLanguages) {
      const serverConfig = LANGUAGE_SERVERS[lang.toLowerCase()];
      if (serverConfig) {
        languageServers.push(serverConfig);
        Object.assign(vscodeSettings, serverConfig.settings);

        // Add recommended extensions
        const extMap: Record<string, string> = {
          'typescript': 'vscode.typescript-language-features',
          'javascript': 'vscode.typescript-language-features',
          'python': 'ms-python.python',
          'python-pylance': 'ms-python.pylance',
          'go': 'golang.go',
          'rust': 'rust-lang.rust-analyzer',
          'java': 'redhat.java',
          'csharp': 'ms-dotnettools.csdevkit',
          'ruby': 'rebornix.ruby',
          'php': 'felixfbecker.php-intellisense',
          'c++': 'ms-vscode.cpptools',
          'vue': 'Vue.volar',
          'svelte': 'svelte.svelte-vscode',
        };

        const ext = extMap[lang.toLowerCase()];
        if (ext && !recommendedExtensions.includes(ext)) {
          recommendedExtensions.push(ext);
        }
      }
    }

    return {
      languages: detectedLanguages,
      languageServers,
      vscodeSettings,
      jetbrainsSettings: {},
      vimSettings: this.generateVimConfig(languageServers),
      emacsSettings: this.generateEmacsConfig(languageServers),
    };
  }

  // Generate VS Code settings
  async generateVSCodeSettings(config: IntelliSenseConfig): Promise<void> {
    const vscodeDir = path.join(this.projectPath, '.vscode');
    await fs.ensureDir(vscodeDir);

    // Generate settings.json
    const settingsPath = path.join(vscodeDir, 'settings.json');
    const settings = {
      ...config.vscodeSettings,
      'files.exclude': {
        '**/.git': true,
        '**/.svn': true,
        '**/.hg': true,
        '**/CVS': true,
        '**/.DS_Store': true,
        '**/node_modules': true,
      },
      'search.exclude': {
        '**/node_modules': true,
        '**/bower_components': true,
        '**/dist': true,
        '**/build': true,
      },
    };

    await fs.writeJson(settingsPath, settings, { spaces: 2 });

    // Generate extensions.json
    const extensionsPath = path.join(vscodeDir, 'extensions.json');
    const recommended: string[] = [];

    for (const lang of config.languages) {
      const extMap: Record<string, string> = {
        'typescript': 'vscode.typescript-language-features',
        'javascript': 'vscode.typescript-language-features',
        'python': 'ms-python.python',
        'go': 'golang.go',
        'rust': 'rust-lang.rust-analyzer',
        'java': 'redhat.java',
        'csharp': 'ms-dotnettools.csdevkit',
        'ruby': 'rebornix.ruby',
        'php': 'felixfbecker.php-intellisense',
        'c++': 'ms-vscode.cpptools',
        'vue': 'Vue.volar',
        'svelte': 'svelte.svelte-vscode',
      };

      const ext = extMap[lang.toLowerCase()];
      if (ext) {
        recommended.push(ext);
      }
    }

    // Add common extensions
    recommended.push(
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
      'ms-vscode.vscode-json'
    );

    await fs.writeJson(extensionsPath, { recommendations: recommended }, { spaces: 2 });
  }

  // Generate Vim/Neovim LSP config
  generateVimConfig(servers: LanguageServerConfig[]): string {
    const lines: string[] = [];
    lines.push('" LSP Configuration for Neovim');
    lines.push('lua << EOF');

    for (const server of servers) {
      lines.push(`-- ${server.language}`);
      lines.push(`require('lspconfig').${server.serverName}.setup{`);
      lines.push(`  cmd = {${server.command}${server.args.map(a => `, '${a}'`).join('')}},`);
      if (server.settings && Object.keys(server.settings).length > 0) {
        lines.push(`  settings = ${JSON.stringify(server.settings, null, 2)},`);
      }
      lines.push('}');
    }

    lines.push('EOF');
    return lines.join('\n');
  }

  // Generate Emacs LSP config
  generateEmacsConfig(servers: LanguageServerConfig[]): string {
    const lines: string[] = [];
    lines.push(';; LSP Configuration for Emacs');
    lines.push('(require \'lsp-mode)');

    for (const server of servers) {
      lines.push(`;; ${server.language}`);
      lines.push(`(lsp-register-custom-settings`);
      if (server.settings) {
        for (const [key, value] of Object.entries(server.settings)) {
          lines.push(`  '("${key}" . ${JSON.stringify(value)})`);
        }
      }
      lines.push(')');
    }

    return lines.join('\n');
  }

  // Generate .clangd for C/C++
  async generateClangdConfig(): Promise<void> {
    const configPath = path.join(this.projectPath, '.clangd');
    const config = {
      CompileFlags: {
        Add: ['-Wall', '-Wextra', '-std=c++17'],
      },
      Diagnostics: {
        UnusedIncludes: 'Strict',
        MissingIncludes: 'Strict',
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('yaml');
    await fs.writeFile(configPath, yaml.stringify(config), 'utf-8');
  }

  // Generate pyrightconfig.json for Python
  async generatePyrightConfig(): Promise<void> {
    const configPath = path.join(this.projectPath, 'pyrightconfig.json');
    const config = {
      include: ['src', 'app'],
      exclude: ['**/node_modules', '**/__pycache__', '**/migrations'],
      reportMissingImports: true,
      reportMissingTypeStubs: false,
      pythonVersion: '3.10',
      pythonPlatform: 'Linux',
    };

    await fs.writeJson(configPath, config, { spaces: 2 });
  }

  // Generate go.mod if needed
  async generateGoMod(): Promise<void> {
    const goModPath = path.join(this.projectPath, 'go.mod');
    if (!(await fs.pathExists(goModPath))) {
      const content = `module ${path.basename(this.projectPath)}\n\ngo 1.21\n`;
      await fs.writeFile(goModPath, content, 'utf-8');
    }
  }

  // Write all IntelliSense configurations
  async writeAll(): Promise<void> {
    const config = await this.setupIntelliSense();
    await this.generateVSCodeSettings(config);

    // Language-specific configs
    if (config.languages.includes('python')) {
      await this.generatePyrightConfig();
    }
    if (config.languages.includes('c++')) {
      await this.generateClangdConfig();
    }
    if (config.languages.includes('go')) {
      await this.generateGoMod();
    }
  }

  // Get language server info
  getLanguageServers(): LanguageServerConfig[] {
    return Object.values(LANGUAGE_SERVERS);
  }

  // Get language server for a specific language
  getLanguageServer(language: string): LanguageServerConfig | undefined {
    return LANGUAGE_SERVERS[language.toLowerCase()];
  }

  // Get supported languages
  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_SERVERS);
  }
}

// Factory functions

/**
 * Create IntelliSense generator
 */
export async function createIntelliSenseGenerator(projectPath: string, projectType?: string): Promise<IntelliSenseGenerator> {
  const generator = new IntelliSenseGenerator(projectPath, projectType);
  return generator;
}

/**
 * Setup IntelliSense for a project
 */
export async function setupIntelliSense(projectPath: string, languages?: string[]): Promise<IntelliSenseConfig> {
  const generator = await createIntelliSenseGenerator(projectPath);
  const config = await generator.setupIntelliSense(languages);
  await generator.writeAll();
  return config;
}

/**
 * Get recommended extensions for a language
 */
export function getRecommendedExtensions(language: string): string[] {
  const extMap: Record<string, string[]> = {
    'typescript': [
      'vscode.typescript-language-features',
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
    ],
    'javascript': [
      'vscode.typescript-language-features',
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
    ],
    'python': [
      'ms-python.python',
      'ms-python.pylance',
      'ms-python.black-formatter',
    ],
    'go': [
      'golang.go',
      'golang.vscode-go',
    ],
    'rust': [
      'rust-lang.rust-analyzer',
      'serayuzgur.crates',
    ],
    'java': [
      'redhat.java',
      'vscjava.vscode-java-debug',
      'vscjava.vscode-java-test',
    ],
    'csharp': [
      'ms-dotnettools.csdevkit',
      'ms-dotnettools.blazorwasm-companion',
    ],
    'ruby': [
      'rebornix.ruby',
      'misogi.ruby-rubocop',
    ],
    'php': [
      'felixfbecker.php-intellisense',
      'bmewburn.vscode-intelephense-client',
    ],
    'c++': [
      'ms-vscode.cpptools',
      'ms-vscode.cmake-tools',
    ],
    'vue': [
      'Vue.volar',
      'Vue.vscode-typescript-vue-plugin',
    ],
    'svelte': [
      'svelte.svelte-vscode',
      'svelte.svelte-vscode',
    ],
  };

  return extMap[language.toLowerCase()] || [];
}

/**
 * Get all supported language servers
 */
export function getAllLanguageServers(): Record<string, LanguageServerConfig> {
  return LANGUAGE_SERVERS;
}
