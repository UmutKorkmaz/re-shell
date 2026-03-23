import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface IDEConfig {
  editor: 'vscode' | 'intellij' | 'vim' | 'sublime' | 'atom';
  projectType?: 'node' | 'python' | 'java' | 'go' | 'rust' | 'php' | 'ruby' | 'dotnet';
  features?: IDEFeature[];
  customSettings?: any;
  includeRecommendedExtensions?: boolean;
  includeDebugConfig?: boolean;
  includeTasks?: boolean;
  includeFormatting?: boolean;
}

export interface IDEFeature {
  name: string;
  enabled: boolean;
  config?: any;
}

export interface ProjectContext {
  name: string;
  path: string;
  type?: string;
  language?: string;
  framework?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  hasTypeScript?: boolean;
  hasESLint?: boolean;
  hasPrettier?: boolean;
  hasJest?: boolean;
  hasTesting?: boolean;
  gitEnabled?: boolean;
}

export interface GenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors?: string[];
  warnings?: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export class IDEConfigGenerator extends EventEmitter {
  private projectContext: ProjectContext;

  constructor(projectContext: ProjectContext) {
    super();
    this.projectContext = projectContext;
  }

  async generate(config: IDEConfig): Promise<GenerationResult> {
    this.emit('generation:start', config);

    const result: GenerationResult = {
      success: false,
      files: [],
      errors: [],
      warnings: []
    };

    try {
      switch (config.editor) {
        case 'vscode':
          await this.generateVSCodeConfig(config, result);
          break;
        case 'intellij':
          await this.generateIntelliJConfig(config, result);
          break;
        case 'vim':
          await this.generateVimConfig(config, result);
          break;
        case 'sublime':
          await this.generateSublimeConfig(config, result);
          break;
        case 'atom':
          await this.generateAtomConfig(config, result);
          break;
        default:
          result.errors?.push(`Unsupported editor: ${config.editor}`);
      }

      result.success = result.files.length > 0 && (!result.errors || result.errors.length === 0);
      this.emit('generation:complete', result);
      return result;

    } catch (error: any) {
      result.errors?.push(error.message);
      this.emit('generation:error', error);
      return result;
    }
  }

  private async generateVSCodeConfig(config: IDEConfig, result: GenerationResult): Promise<void> {
    const vscodeDir = path.join(this.projectContext.path, '.vscode');
    await fs.ensureDir(vscodeDir);

    // Settings
    if (config.includeFormatting !== false) {
      const settings = this.generateVSCodeSettings(config);
      result.files.push({
        path: path.join(vscodeDir, 'settings.json'),
        content: JSON.stringify(settings, null, 2),
        description: 'VSCode workspace settings'
      });
    }

    // Extensions
    if (config.includeRecommendedExtensions !== false) {
      const extensions = this.generateVSCodeExtensions(config);
      result.files.push({
        path: path.join(vscodeDir, 'extensions.json'),
        content: JSON.stringify(extensions, null, 2),
        description: 'Recommended VSCode extensions'
      });
    }

    // Launch configuration
    if (config.includeDebugConfig !== false) {
      const launch = this.generateVSCodeLaunch(config);
      if (launch) {
        result.files.push({
          path: path.join(vscodeDir, 'launch.json'),
          content: JSON.stringify(launch, null, 2),
          description: 'VSCode debug configurations'
        });
      }
    }

    // Tasks
    if (config.includeTasks !== false) {
      const tasks = this.generateVSCodeTasks(config);
      if (tasks) {
        result.files.push({
          path: path.join(vscodeDir, 'tasks.json'),
          content: JSON.stringify(tasks, null, 2),
          description: 'VSCode task configurations'
        });
      }
    }
  }

  private generateVSCodeSettings(config: IDEConfig): any {
    const settings: any = {
      // Editor settings
      "editor.formatOnSave": true,
      "editor.codeActionsOnSave": {
        "source.fixAll": true,
        "source.organizeImports": true
      },
      "editor.rulers": [80, 120],
      "editor.tabSize": 2,
      "editor.insertSpaces": true,
      "editor.trimAutoWhitespace": true,
      "files.trimTrailingWhitespace": true,
      "files.insertFinalNewline": true,
      "files.eol": "\n",
      
      // Search excludes
      "search.exclude": {
        "**/node_modules": true,
        "**/bower_components": true,
        "**/dist": true,
        "**/build": true,
        "**/.git": true,
        "**/.svn": true,
        "**/.hg": true,
        "**/CVS": true,
        "**/.DS_Store": true,
        "**/Thumbs.db": true
      },

      // File associations
      "files.associations": {
        "*.re-shell": "yaml",
        ".re-shellrc": "json"
      }
    };

    // Language-specific settings
    if (this.projectContext.hasTypeScript) {
      Object.assign(settings, {
        "typescript.updateImportsOnFileMove.enabled": "always",
        "typescript.preferences.importModuleSpecifier": "relative",
        "typescript.preferences.quoteStyle": "single",
        "typescript.format.semicolons": "insert",
        "[typescript]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode"
        },
        "[typescriptreact]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode"
        }
      });
    }

    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      Object.assign(settings, {
        "javascript.updateImportsOnFileMove.enabled": "always",
        "javascript.preferences.importModuleSpecifier": "relative",
        "javascript.preferences.quoteStyle": "single",
        "javascript.format.semicolons": "insert",
        "[javascript]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode"
        },
        "[javascriptreact]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode"
        }
      });
    }

    if (this.projectContext.hasESLint) {
      Object.assign(settings, {
        "eslint.enable": true,
        "eslint.validate": [
          "javascript",
          "javascriptreact",
          "typescript",
          "typescriptreact"
        ],
        "eslint.run": "onType",
        "eslint.autoFixOnSave": true
      });
    }

    if (this.projectContext.hasPrettier) {
      Object.assign(settings, {
        "prettier.singleQuote": true,
        "prettier.trailingComma": "es5",
        "prettier.tabWidth": 2,
        "prettier.semi": true,
        "prettier.printWidth": 100
      });
    }

    if (this.projectContext.language === 'python') {
      Object.assign(settings, {
        "python.linting.enabled": true,
        "python.linting.pylintEnabled": true,
        "python.formatting.provider": "black",
        "python.formatting.blackArgs": ["--line-length", "88"],
        "[python]": {
          "editor.formatOnSave": true,
          "editor.codeActionsOnSave": {
            "source.organizeImports": true
          }
        }
      });
    }

    if (this.projectContext.language === 'go') {
      Object.assign(settings, {
        "go.useLanguageServer": true,
        "go.lintOnSave": "workspace",
        "go.formatTool": "goimports",
        "go.formatFlags": ["-local", "github.com/your-org"],
        "[go]": {
          "editor.formatOnSave": true,
          "editor.codeActionsOnSave": {
            "source.organizeImports": true
          }
        }
      });
    }

    if (this.projectContext.language === 'java') {
      Object.assign(settings, {
        "java.configuration.updateBuildConfiguration": "automatic",
        "java.format.settings.profile": "GoogleStyle",
        "java.saveActions.organizeImports": true,
        "[java]": {
          "editor.defaultFormatter": "redhat.java"
        }
      });
    }

    if (this.projectContext.language === 'rust') {
      Object.assign(settings, {
        "rust-analyzer.cargo.watch.enable": true,
        "rust-analyzer.checkOnSave.command": "clippy",
        "[rust]": {
          "editor.defaultFormatter": "rust-lang.rust-analyzer",
          "editor.formatOnSave": true
        }
      });
    }

    // Merge custom settings
    if (config.customSettings?.vscode) {
      Object.assign(settings, config.customSettings.vscode);
    }

    return settings;
  }

  private generateVSCodeExtensions(config: IDEConfig): any {
    const recommendations: string[] = [
      // General
      "editorconfig.editorconfig",
      "streetsidesoftware.code-spell-checker",
      "wayou.vscode-todo-highlight",
      "gruntfuggly.todo-tree",
      "eamodio.gitlens",
      "usernamehw.errorlens"
    ];

    // Language-specific extensions
    if (this.projectContext.hasTypeScript || this.projectContext.language === 'javascript') {
      recommendations.push(
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "christian-kohler.path-intellisense",
        "formulahendry.auto-rename-tag",
        "steoates.autoimport",
        "wix.vscode-import-cost"
      );
    }

    if (this.projectContext.hasTypeScript) {
      recommendations.push(
        "ms-vscode.vscode-typescript-next",
        "jpoissonnier.vscode-styled-components"
      );
    }

    if (this.projectContext.framework === 'react') {
      recommendations.push(
        "dsznajder.es7-react-js-snippets",
        "burkeholland.simple-react-snippets",
        "jpoissonnier.vscode-styled-components"
      );
    }

    if (this.projectContext.framework === 'vue') {
      recommendations.push(
        "octref.vetur",
        "johnsoncodehk.volar",
        "sdras.vue-vscode-snippets"
      );
    }

    if (this.projectContext.framework === 'angular') {
      recommendations.push(
        "angular.ng-template",
        "johnpapa.angular2",
        "cyrilletuzi.angular-schematics"
      );
    }

    if (this.projectContext.language === 'python') {
      recommendations.push(
        "ms-python.python",
        "ms-python.vscode-pylance",
        "ms-python.black-formatter",
        "charliermarsh.ruff"
      );
    }

    if (this.projectContext.language === 'go') {
      recommendations.push(
        "golang.go"
      );
    }

    if (this.projectContext.language === 'java') {
      recommendations.push(
        "redhat.java",
        "vscjava.vscode-java-debug",
        "vscjava.vscode-java-test",
        "vscjava.vscode-maven",
        "vscjava.vscode-spring-initializr"
      );
    }

    if (this.projectContext.language === 'rust') {
      recommendations.push(
        "rust-lang.rust-analyzer",
        "bungcip.better-toml",
        "serayuzgur.crates"
      );
    }

    if (this.projectContext.language === 'php') {
      recommendations.push(
        "bmewburn.vscode-intelephense-client",
        "neilbrayfield.php-docblocker",
        "wongjn.php-sniffer"
      );
    }

    if (this.projectContext.language === 'ruby') {
      recommendations.push(
        "rebornix.ruby",
        "castwide.solargraph",
        "kaiwood.endwise"
      );
    }

    if (this.projectContext.hasJest || this.projectContext.hasTesting) {
      recommendations.push(
        "orta.vscode-jest",
        "kavod-io.vscode-jest-test-adapter",
        "hbenl.vscode-test-explorer"
      );
    }

    if (this.projectContext.gitEnabled) {
      recommendations.push(
        "mhutchie.git-graph",
        "donjayamanne.githistory"
      );
    }

    return { recommendations };
  }

  private generateVSCodeLaunch(config: IDEConfig): any | null {
    const configurations: any[] = [];

    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      // Node.js debugging
      configurations.push({
        type: "node",
        request: "launch",
        name: "Launch Program",
        skipFiles: ["<node_internals>/**"],
        program: "${workspaceFolder}/src/index.js",
        preLaunchTask: "npm: build",
        outFiles: ["${workspaceFolder}/dist/**/*.js"],
        env: {
          "NODE_ENV": "development"
        }
      });

      // Jest debugging
      if (this.projectContext.hasJest) {
        configurations.push({
          type: "node",
          request: "launch",
          name: "Jest: Current File",
          program: "${workspaceFolder}/node_modules/.bin/jest",
          args: [
            "--runInBand",
            "--no-coverage",
            "${relativeFile}"
          ],
          console: "integratedTerminal",
          internalConsoleOptions: "neverOpen"
        });
      }

      // NPM script debugging
      configurations.push({
        type: "node",
        request: "launch",
        name: "npm run dev",
        runtimeExecutable: "npm",
        runtimeArgs: ["run", "dev"],
        skipFiles: ["<node_internals>/**"],
        console: "integratedTerminal"
      });
    }

    if (this.projectContext.language === 'python') {
      configurations.push({
        name: "Python: Current File",
        type: "python",
        request: "launch",
        program: "${file}",
        console: "integratedTerminal",
        justMyCode: true
      });

      configurations.push({
        name: "Python: Module",
        type: "python",
        request: "launch",
        module: this.projectContext.name,
        justMyCode: true
      });

      configurations.push({
        name: "Python: Django",
        type: "python",
        request: "launch",
        program: "${workspaceFolder}/manage.py",
        args: ["runserver"],
        django: true,
        justMyCode: true
      });
    }

    if (this.projectContext.language === 'go') {
      configurations.push({
        name: "Launch Package",
        type: "go",
        request: "launch",
        mode: "auto",
        program: "${fileDirname}"
      });

      configurations.push({
        name: "Launch Test",
        type: "go",
        request: "launch",
        mode: "test",
        program: "${fileDirname}"
      });
    }

    if (this.projectContext.language === 'java') {
      configurations.push({
        type: "java",
        name: "Launch Current File",
        request: "launch",
        mainClass: "${file}"
      });

      configurations.push({
        type: "java",
        name: "Launch Application",
        request: "launch",
        mainClass: `com.example.${this.projectContext.name}.Application`,
        projectName: this.projectContext.name
      });
    }

    if (this.projectContext.language === 'rust') {
      configurations.push({
        type: "lldb",
        request: "launch",
        name: "Debug executable",
        cargo: {
          args: ["build", "--bin=${workspaceRootFolderName}", "--package=${workspaceRootFolderName}"],
          filter: {
            name: this.projectContext.name,
            kind: "bin"
          }
        },
        args: [],
        cwd: "${workspaceFolder}"
      });

      configurations.push({
        type: "lldb",
        request: "launch",
        name: "Debug unit tests",
        cargo: {
          args: ["test", "--no-run", "--bin=${workspaceRootFolderName}", "--package=${workspaceRootFolderName}"],
          filter: {
            name: this.projectContext.name,
            kind: "bin"
          }
        },
        args: [],
        cwd: "${workspaceFolder}"
      });
    }

    if (configurations.length === 0) {
      return null;
    }

    return {
      version: "0.2.0",
      configurations
    };
  }

  private generateVSCodeTasks(config: IDEConfig): any | null {
    const tasks: any[] = [];

    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      // Build task
      tasks.push({
        label: "npm: build",
        type: "npm",
        script: "build",
        group: {
          kind: "build",
          isDefault: true
        },
        problemMatcher: ["$tsc"],
        presentation: {
          reveal: "silent"
        }
      });

      // Test task
      tasks.push({
        label: "npm: test",
        type: "npm",
        script: "test",
        group: {
          kind: "test",
          isDefault: true
        },
        problemMatcher: [],
        presentation: {
          reveal: "always"
        }
      });

      // Lint task
      tasks.push({
        label: "npm: lint",
        type: "npm",
        script: "lint",
        problemMatcher: ["$eslint-stylish"],
        presentation: {
          reveal: "silent"
        }
      });
    }

    if (this.projectContext.language === 'python') {
      tasks.push({
        label: "pytest",
        type: "shell",
        command: "pytest",
        args: ["-v"],
        group: {
          kind: "test",
          isDefault: true
        },
        presentation: {
          reveal: "always",
          panel: "new"
        }
      });

      tasks.push({
        label: "pylint",
        type: "shell",
        command: "pylint",
        args: ["${workspaceFolder}/${workspaceFolderBasename}"],
        problemMatcher: [],
        presentation: {
          reveal: "always",
          panel: "new"
        }
      });
    }

    if (this.projectContext.language === 'go') {
      tasks.push({
        label: "go: build",
        type: "shell",
        command: "go",
        args: ["build", "-v", "./..."],
        group: {
          kind: "build",
          isDefault: true
        },
        problemMatcher: ["$go"]
      });

      tasks.push({
        label: "go: test",
        type: "shell",
        command: "go",
        args: ["test", "-v", "./..."],
        group: {
          kind: "test",
          isDefault: true
        },
        problemMatcher: ["$go"]
      });
    }

    if (this.projectContext.language === 'rust') {
      tasks.push({
        label: "cargo build",
        type: "cargo",
        command: "build",
        problemMatcher: ["$rustc"],
        group: {
          kind: "build",
          isDefault: true
        }
      });

      tasks.push({
        label: "cargo test",
        type: "cargo",
        command: "test",
        problemMatcher: ["$rustc"],
        group: {
          kind: "test",
          isDefault: true
        }
      });

      tasks.push({
        label: "cargo check",
        type: "cargo",
        command: "check",
        problemMatcher: ["$rustc"]
      });
    }

    if (tasks.length === 0) {
      return null;
    }

    return {
      version: "2.0.0",
      tasks
    };
  }

  private async generateIntelliJConfig(config: IDEConfig, result: GenerationResult): Promise<void> {
    const ideaDir = path.join(this.projectContext.path, '.idea');
    await fs.ensureDir(ideaDir);

    // Project structure
    const modules = this.generateIntelliJModules(config);
    result.files.push({
      path: path.join(ideaDir, 'modules.xml'),
      content: modules,
      description: 'IntelliJ project modules configuration'
    });

    // Code style
    const codeStyle = this.generateIntelliJCodeStyle(config);
    const codeStyleDir = path.join(ideaDir, 'codeStyles');
    await fs.ensureDir(codeStyleDir);
    
    result.files.push({
      path: path.join(codeStyleDir, 'Project.xml'),
      content: codeStyle,
      description: 'IntelliJ code style settings'
    });

    result.files.push({
      path: path.join(codeStyleDir, 'codeStyleConfig.xml'),
      content: `<component name="ProjectCodeStyleConfiguration">
  <state>
    <option name="USE_PER_PROJECT_SETTINGS" value="true" />
  </state>
</component>`,
      description: 'IntelliJ code style configuration'
    });

    // Run configurations
    if (config.includeDebugConfig !== false) {
      const runConfigsDir = path.join(ideaDir, 'runConfigurations');
      await fs.ensureDir(runConfigsDir);
      
      const runConfigs = this.generateIntelliJRunConfigs(config);
      for (const runConfig of runConfigs) {
        result.files.push({
          path: path.join(runConfigsDir, runConfig.filename),
          content: runConfig.content,
          description: runConfig.description
        });
      }
    }

    // VCS configuration
    if (this.projectContext.gitEnabled) {
      result.files.push({
        path: path.join(ideaDir, 'vcs.xml'),
        content: `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="VcsDirectoryMappings">
    <mapping directory="$PROJECT_DIR$" vcs="Git" />
  </component>
</project>`,
        description: 'IntelliJ VCS configuration'
      });
    }
  }

  private generateIntelliJModules(config: IDEConfig): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectModuleManager">
    <modules>
      <module fileurl="file://$PROJECT_DIR$/.idea/${this.projectContext.name}.iml" filepath="$PROJECT_DIR$/.idea/${this.projectContext.name}.iml" />
    </modules>
  </component>
</project>`;
  }

  private generateIntelliJCodeStyle(config: IDEConfig): string {
    const indent = "  ";
    return `<component name="ProjectCodeStyleConfiguration">
  <code_scheme name="Project" version="173">
    <option name="LINE_SEPARATOR" value="&#10;" />
    <option name="RIGHT_MARGIN" value="120" />
    <option name="WRAP_WHEN_TYPING_REACHES_RIGHT_MARGIN" value="true" />
    <option name="SOFT_MARGINS" value="80,100" />
    ${this.projectContext.hasTypeScript || this.projectContext.language === 'javascript' ? `
    <TypeScriptCodeStyleSettings version="0">
      <option name="FORCE_SEMICOLON_STYLE" value="true" />
      <option name="USE_DOUBLE_QUOTES" value="false" />
      <option name="FORCE_QUOTE_STYlE" value="true" />
      <option name="SPACE_BEFORE_FUNCTION_LEFT_PARENTH" value="false" />
      <option name="SPACES_WITHIN_OBJECT_LITERAL_BRACES" value="true" />
      <option name="SPACES_WITHIN_IMPORTS" value="true" />
    </TypeScriptCodeStyleSettings>
    <JavaScriptCodeStyleSettings version="0">
      <option name="FORCE_SEMICOLON_STYLE" value="true" />
      <option name="USE_DOUBLE_QUOTES" value="false" />
      <option name="FORCE_QUOTE_STYlE" value="true" />
      <option name="SPACE_BEFORE_FUNCTION_LEFT_PARENTH" value="false" />
      <option name="SPACES_WITHIN_OBJECT_LITERAL_BRACES" value="true" />
      <option name="SPACES_WITHIN_IMPORTS" value="true" />
    </JavaScriptCodeStyleSettings>` : ''}
    ${this.projectContext.language === 'java' ? `
    <JavaCodeStyleSettings>
      <option name="CLASS_COUNT_TO_USE_IMPORT_ON_DEMAND" value="99" />
      <option name="NAMES_COUNT_TO_USE_IMPORT_ON_DEMAND" value="99" />
      <option name="PACKAGES_TO_USE_IMPORT_ON_DEMAND">
        <value />
      </option>
      <option name="IMPORT_LAYOUT_TABLE">
        <value>
          <package name="java" withSubpackages="true" static="false" />
          <package name="javax" withSubpackages="true" static="false" />
          <emptyLine />
          <package name="" withSubpackages="true" static="false" />
          <emptyLine />
          <package name="" withSubpackages="true" static="true" />
        </value>
      </option>
    </JavaCodeStyleSettings>` : ''}
    <codeStyleSettings language="TypeScript">
      <option name="RIGHT_MARGIN" value="100" />
      <option name="KEEP_BLANK_LINES_IN_CODE" value="1" />
      <option name="BLANK_LINES_AROUND_METHOD" value="1" />
      <option name="BLANK_LINES_AROUND_METHOD_IN_INTERFACE" value="1" />
      <indentOptions>
        <option name="INDENT_SIZE" value="2" />
        <option name="CONTINUATION_INDENT_SIZE" value="2" />
        <option name="TAB_SIZE" value="2" />
      </indentOptions>
    </codeStyleSettings>
    <codeStyleSettings language="JavaScript">
      <option name="RIGHT_MARGIN" value="100" />
      <option name="KEEP_BLANK_LINES_IN_CODE" value="1" />
      <option name="BLANK_LINES_AROUND_METHOD" value="1" />
      <option name="BLANK_LINES_AROUND_METHOD_IN_INTERFACE" value="1" />
      <indentOptions>
        <option name="INDENT_SIZE" value="2" />
        <option name="CONTINUATION_INDENT_SIZE" value="2" />
        <option name="TAB_SIZE" value="2" />
      </indentOptions>
    </codeStyleSettings>
  </code_scheme>
</component>`;
  }

  private generateIntelliJRunConfigs(config: IDEConfig): Array<{
    filename: string;
    content: string;
    description: string;
  }> {
    const configs: Array<{ filename: string; content: string; description: string }> = [];

    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      // npm scripts
      configs.push({
        filename: 'npm_dev.xml',
        content: `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="npm dev" type="js.build_tools.npm">
    <package-json value="$PROJECT_DIR$/package.json" />
    <command value="run" />
    <scripts>
      <script value="dev" />
    </scripts>
    <node-interpreter value="project" />
    <envs />
    <method v="2" />
  </configuration>
</component>`,
        description: 'npm dev script configuration'
      });

      configs.push({
        filename: 'npm_test.xml',
        content: `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="npm test" type="js.build_tools.npm">
    <package-json value="$PROJECT_DIR$/package.json" />
    <command value="test" />
    <node-interpreter value="project" />
    <envs />
    <method v="2" />
  </configuration>
</component>`,
        description: 'npm test script configuration'
      });

      configs.push({
        filename: 'npm_build.xml',
        content: `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="npm build" type="js.build_tools.npm">
    <package-json value="$PROJECT_DIR$/package.json" />
    <command value="run" />
    <scripts>
      <script value="build" />
    </scripts>
    <node-interpreter value="project" />
    <envs />
    <method v="2" />
  </configuration>
</component>`,
        description: 'npm build script configuration'
      });
    }

    if (this.projectContext.language === 'java') {
      configs.push({
        filename: 'Application.xml',
        content: `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="Application" type="Application" factoryName="Application">
    <option name="MAIN_CLASS_NAME" value="com.example.${this.projectContext.name}.Application" />
    <module name="${this.projectContext.name}" />
    <option name="VM_PARAMETERS" value="-Xmx512m -Xms256m" />
    <option name="PROGRAM_PARAMETERS" value="" />
    <option name="WORKING_DIRECTORY" value="$PROJECT_DIR$" />
    <method v="2">
      <option name="Make" enabled="true" />
    </method>
  </configuration>
</component>`,
        description: 'Java application run configuration'
      });
    }

    return configs;
  }

  private async generateVimConfig(config: IDEConfig, result: GenerationResult): Promise<void> {
    // .vimrc or init.vim
    const vimConfig = this.generateVimConfiguration(config);
    result.files.push({
      path: path.join(this.projectContext.path, '.vimrc'),
      content: vimConfig,
      description: 'Vim configuration file'
    });

    // .editorconfig
    const editorConfig = this.generateEditorConfig(config);
    result.files.push({
      path: path.join(this.projectContext.path, '.editorconfig'),
      content: editorConfig,
      description: 'EditorConfig for consistent coding styles'
    });

    // coc-settings.json for CoC.nvim
    if (config.features?.some(f => f.name === 'coc' && f.enabled)) {
      const cocSettings = this.generateCocSettings(config);
      result.files.push({
        path: path.join(this.projectContext.path, '.vim', 'coc-settings.json'),
        content: JSON.stringify(cocSettings, null, 2),
        description: 'CoC.nvim settings'
      });
    }
  }

  private generateVimConfiguration(config: IDEConfig): string {
    const lines: string[] = [
      '" Re-Shell CLI generated Vim configuration',
      '" Generated for project: ' + this.projectContext.name,
      '',
      '" Basic settings',
      'set nocompatible',
      'set encoding=utf-8',
      'set fileencoding=utf-8',
      'set fileencodings=utf-8',
      'set ttyfast',
      '',
      '" Visual settings',
      'syntax enable',
      'set ruler',
      'set number',
      'set relativenumber',
      'set cursorline',
      'set colorcolumn=80,120',
      'set showmatch',
      'set list',
      'set listchars=tab:→\\ ,trail:·,extends:»,precedes:«,nbsp:+',
      '',
      '" Indentation',
      'set tabstop=2',
      'set softtabstop=2',
      'set shiftwidth=2',
      'set expandtab',
      'set autoindent',
      'set smartindent',
      '',
      '" Search',
      'set hlsearch',
      'set incsearch',
      'set ignorecase',
      'set smartcase',
      '',
      '" File handling',
      'set autoread',
      'set autowrite',
      'set nobackup',
      'set noswapfile',
      'set hidden',
      '',
      '" Completion',
      'set wildmenu',
      'set wildmode=list:longest,full',
      'set wildignore+=*/node_modules/*,*/dist/*,*/build/*,*/.git/*',
      ''
    ];

    // Language-specific settings
    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      lines.push(
        '" JavaScript/TypeScript settings',
        'autocmd FileType javascript,typescript,typescriptreact,javascriptreact setlocal shiftwidth=2 tabstop=2 softtabstop=2',
        'autocmd FileType json setlocal shiftwidth=2 tabstop=2 softtabstop=2',
        ''
      );
    }

    if (this.projectContext.language === 'python') {
      lines.push(
        '" Python settings',
        'autocmd FileType python setlocal shiftwidth=4 tabstop=4 softtabstop=4',
        'autocmd FileType python setlocal textwidth=88',
        'autocmd FileType python setlocal colorcolumn=88',
        'let g:python_highlight_all = 1',
        ''
      );
    }

    if (this.projectContext.language === 'go') {
      lines.push(
        '" Go settings',
        'autocmd FileType go setlocal noexpandtab',
        'autocmd FileType go setlocal shiftwidth=4 tabstop=4 softtabstop=4',
        'autocmd BufWritePre *.go :silent! !gofmt -w %',
        ''
      );
    }

    // Plugin recommendations
    lines.push(
      '" Plugin recommendations (requires plugin manager like vim-plug)',
      '" Plug \'tpope/vim-fugitive\'          " Git integration',
      '" Plug \'airblade/vim-gitgutter\'      " Git diff in gutter',
      '" Plug \'preservim/nerdtree\'          " File explorer',
      '" Plug \'junegunn/fzf.vim\'            " Fuzzy finder',
      '" Plug \'neoclide/coc.nvim\'           " LSP support',
      '" Plug \'vim-airline/vim-airline\'     " Status line',
      '" Plug \'morhetz/gruvbox\'             " Color scheme',
      ''
    );

    // Language-specific plugins
    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      lines.push(
        '" JavaScript/TypeScript plugins',
        '" Plug \'pangloss/vim-javascript\'',
        '" Plug \'leafgarland/typescript-vim\'',
        '" Plug \'maxmellon/vim-jsx-pretty\'',
        '" Plug \'styled-components/vim-styled-components\'',
        ''
      );
    }

    if (this.projectContext.language === 'python') {
      lines.push(
        '" Python plugins',
        '" Plug \'vim-python/python-syntax\'',
        '" Plug \'psf/black\', { \'branch\': \'stable\' }',
        '" Plug \'fisadev/vim-isort\'',
        ''
      );
    }

    if (this.projectContext.language === 'go') {
      lines.push(
        '" Go plugins',
        '" Plug \'fatih/vim-go\', { \'do\': \':GoUpdateBinaries\' }',
        ''
      );
    }

    // Key mappings
    lines.push(
      '" Key mappings',
      'let mapleader = ","',
      'nnoremap <leader>w :w<CR>',
      'nnoremap <leader>q :q<CR>',
      'nnoremap <leader>e :NERDTreeToggle<CR>',
      'nnoremap <leader>f :Files<CR>',
      'nnoremap <leader>b :Buffers<CR>',
      'nnoremap <leader>g :GitGutterToggle<CR>',
      '',
      '" Clear search highlight',
      'nnoremap <leader><space> :nohlsearch<CR>',
      '',
      '" Navigate between splits',
      'nnoremap <C-h> <C-w>h',
      'nnoremap <C-j> <C-w>j',
      'nnoremap <C-k> <C-w>k',
      'nnoremap <C-l> <C-w>l'
    );

    return lines.join('\n');
  }

  private generateCocSettings(config: IDEConfig): any {
    const settings: any = {
      "suggest.enablePreview": true,
      "suggest.enablePreselect": true,
      "suggest.noselect": false,
      "diagnostic.errorSign": "✗",
      "diagnostic.warningSign": "⚠",
      "diagnostic.infoSign": "ℹ",
      "diagnostic.hintSign": "➤"
    };

    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      Object.assign(settings, {
        "tsserver.enable": true,
        "eslint.enable": true,
        "eslint.autoFixOnSave": true,
        "prettier.enable": true,
        "prettier.formatOnSave": true
      });
    }

    if (this.projectContext.language === 'python') {
      Object.assign(settings, {
        "python.linting.enabled": true,
        "python.linting.pylintEnabled": true,
        "python.formatting.provider": "black",
        "python.formatting.blackPath": "black",
        "python.sortImports.path": "isort"
      });
    }

    if (this.projectContext.language === 'go') {
      Object.assign(settings, {
        "go.goplsOptions": {
          "completeUnimported": true,
          "usePlaceholders": true
        }
      });
    }

    return settings;
  }

  private async generateSublimeConfig(config: IDEConfig, result: GenerationResult): Promise<void> {
    // Project file
    const projectConfig = this.generateSublimeProject(config);
    result.files.push({
      path: path.join(this.projectContext.path, `${this.projectContext.name}.sublime-project`),
      content: JSON.stringify(projectConfig, null, 2),
      description: 'Sublime Text project configuration'
    });

    // Settings
    const settings = this.generateSublimeSettings(config);
    result.files.push({
      path: path.join(this.projectContext.path, '.sublime', 'settings.json'),
      content: JSON.stringify(settings, null, 2),
      description: 'Sublime Text settings'
    });
  }

  private generateSublimeProject(config: IDEConfig): any {
    const project: any = {
      folders: [
        {
          path: ".",
          folder_exclude_patterns: [
            "node_modules",
            "dist",
            "build",
            ".git",
            "__pycache__",
            ".pytest_cache"
          ],
          file_exclude_patterns: [
            "*.pyc",
            "*.pyo",
            ".DS_Store",
            "*.sublime-workspace"
          ]
        }
      ],
      settings: {
        tab_size: 2,
        translate_tabs_to_spaces: true,
        trim_trailing_white_space_on_save: true,
        ensure_newline_at_eof_on_save: true,
        rulers: [80, 120]
      }
    };

    // Build systems
    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      project.build_systems = [
        {
          name: "npm test",
          cmd: ["npm", "test"],
          working_dir: "$project_path"
        },
        {
          name: "npm build",
          cmd: ["npm", "run", "build"],
          working_dir: "$project_path"
        }
      ];
    }

    return project;
  }

  private generateSublimeSettings(config: IDEConfig): any {
    return {
      // Editor settings
      font_size: 12,
      line_numbers: true,
      gutter: true,
      margin: 4,
      fold_buttons: true,
      fade_fold_buttons: false,
      
      // Indentation
      tab_size: 2,
      translate_tabs_to_spaces: true,
      use_tab_stops: true,
      detect_indentation: true,
      auto_indent: true,
      smart_indent: true,
      
      // Visual
      rulers: [80, 120],
      draw_white_space: "all",
      draw_indent_guides: true,
      indent_guide_options: ["draw_active"],
      
      // Behavior
      trim_trailing_white_space_on_save: true,
      ensure_newline_at_eof_on_save: true,
      save_on_focus_lost: true,
      
      // Search
      show_definitions: true,
      auto_complete: true,
      auto_complete_delay: 50,
      auto_complete_triggers: [
        {
          selector: "source.js",
          characters: "."
        }
      ]
    };
  }

  private async generateAtomConfig(config: IDEConfig, result: GenerationResult): Promise<void> {
    const atomConfig = this.generateAtomConfiguration(config);
    
    result.files.push({
      path: path.join(this.projectContext.path, '.atom', 'config.cson'),
      content: atomConfig,
      description: 'Atom editor configuration'
    });
  }

  private generateAtomConfiguration(config: IDEConfig): string {
    const lines: string[] = [
      '"*":',
      '  core:',
      '    telemetryConsent: "no"',
      '    themes: [',
      '      "one-dark-ui"',
      '      "one-dark-syntax"',
      '    ]',
      '  editor:',
      '    fontSize: 14',
      '    showIndentGuide: true',
      '    showInvisibles: true',
      '    softTabs: true',
      '    tabLength: 2',
      '    tabType: "soft"',
      '  "exception-reporting":',
      '    userId: "re-shell-cli-user"',
      '  welcome:',
      '    showOnStartup: false'
    ];

    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      lines.push(
        '  "linter-eslint":',
        '    autofix:',
        '      fixOnSave: true',
        '  prettier:',
        '    formatOnSave: true',
        '    singleQuote: true',
        '    trailingComma: "es5"'
      );
    }

    return lines.join('\n');
  }

  private generateEditorConfig(config: IDEConfig): string {
    const lines: string[] = [
      '# EditorConfig is awesome: https://EditorConfig.org',
      '# Generated by Re-Shell CLI',
      '',
      '# top-most EditorConfig file',
      'root = true',
      '',
      '# Unix-style newlines with a newline ending every file',
      '[*]',
      'end_of_line = lf',
      'insert_final_newline = true',
      'trim_trailing_whitespace = true',
      'charset = utf-8',
      '',
      '# Default indentation',
      'indent_style = space',
      'indent_size = 2',
      ''
    ];

    // Language-specific settings
    if (this.projectContext.language === 'javascript' || this.projectContext.hasTypeScript) {
      lines.push(
        '# JavaScript/TypeScript files',
        '[*.{js,jsx,ts,tsx,json}]',
        'indent_size = 2',
        ''
      );
    }

    if (this.projectContext.language === 'python') {
      lines.push(
        '# Python files',
        '[*.py]',
        'indent_size = 4',
        'max_line_length = 88',
        ''
      );
    }

    if (this.projectContext.language === 'go') {
      lines.push(
        '# Go files',
        '[*.go]',
        'indent_style = tab',
        'indent_size = 4',
        ''
      );
    }

    if (this.projectContext.language === 'java') {
      lines.push(
        '# Java files',
        '[*.java]',
        'indent_size = 4',
        'continuation_indent_size = 8',
        ''
      );
    }

    lines.push(
      '# Markdown files',
      '[*.md]',
      'trim_trailing_whitespace = false',
      '',
      '# YAML files',
      '[*.{yml,yaml}]',
      'indent_size = 2',
      '',
      '# Makefile',
      '[Makefile]',
      'indent_style = tab'
    );

    return lines.join('\n');
  }

  async writeFiles(files: GeneratedFile[]): Promise<{ written: string[]; errors: string[] }> {
    const written: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        await fs.ensureDir(path.dirname(file.path));
        await fs.writeFile(file.path, file.content);
        written.push(file.path);
        this.emit('file:written', file.path);
      } catch (error: any) {
        errors.push(`Failed to write ${file.path}: ${error.message}`);
        this.emit('file:error', { path: file.path, error });
      }
    }

    return { written, errors };
  }
}

// Helper functions
export async function generateIDEConfig(
  projectPath: string,
  editor: IDEConfig['editor'],
  options: Partial<IDEConfig> = {}
): Promise<GenerationResult> {
  // Auto-detect project context
  const context = await detectProjectContext(projectPath);
  
  const generator = new IDEConfigGenerator(context);
  const config: IDEConfig = {
    editor,
    ...options
  };

  return generator.generate(config);
}

export async function detectProjectContext(projectPath: string): Promise<ProjectContext> {
  const context: ProjectContext = {
    name: path.basename(projectPath),
    path: projectPath
  };

  // Check for package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      context.name = packageJson.name || context.name;
      
      // Detect TypeScript
      if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
        context.hasTypeScript = true;
      }

      // Detect ESLint
      if (packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint) {
        context.hasESLint = true;
      }

      // Detect Prettier
      if (packageJson.devDependencies?.prettier || packageJson.dependencies?.prettier) {
        context.hasPrettier = true;
      }

      // Detect Jest
      if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
        context.hasJest = true;
        context.hasTesting = true;
      }

      // Detect framework
      if (packageJson.dependencies?.react || packageJson.dependencies?.['react-dom']) {
        context.framework = 'react';
      } else if (packageJson.dependencies?.vue) {
        context.framework = 'vue';
      } else if (packageJson.dependencies?.['@angular/core']) {
        context.framework = 'angular';
      }

      context.language = 'javascript';
    } catch (error) {
      // Invalid package.json
    }
  }

  // Check for other language files
  const files = await fs.readdir(projectPath);
  
  if (files.some(f => f.endsWith('.py'))) {
    context.language = 'python';
  } else if (files.some(f => f.endsWith('.go') || f === 'go.mod')) {
    context.language = 'go';
  } else if (files.some(f => f.endsWith('.java'))) {
    context.language = 'java';
  } else if (files.some(f => f.endsWith('.rs') || f === 'Cargo.toml')) {
    context.language = 'rust';
  } else if (files.some(f => f.endsWith('.php'))) {
    context.language = 'php';
  } else if (files.some(f => f.endsWith('.rb') || f === 'Gemfile')) {
    context.language = 'ruby';
  } else if (files.some(f => f.endsWith('.cs') || f.endsWith('.csproj'))) {
    context.language = 'dotnet';
  }

  // Check for git
  if (await fs.pathExists(path.join(projectPath, '.git'))) {
    context.gitEnabled = true;
  }

  // Detect package manager
  if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
    context.packageManager = 'pnpm';
  } else if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
    context.packageManager = 'yarn';
  } else if (await fs.pathExists(path.join(projectPath, 'package-lock.json'))) {
    context.packageManager = 'npm';
  } else if (await fs.pathExists(path.join(projectPath, 'bun.lockb'))) {
    context.packageManager = 'bun';
  }

  return context;
}