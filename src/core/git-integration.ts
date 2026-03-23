import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitConfig {
  userName?: string;
  userEmail?: string;
  defaultBranch?: string;
  remoteUrl?: string;
  gitignoreTemplate?: string;
  commitMessage?: string;
  signCommits?: boolean;
  hooks?: GitHook[];
}

export interface GitHook {
  name: string;
  script: string;
  description?: string;
}

export interface GitStatus {
  initialized: boolean;
  hasRemote: boolean;
  currentBranch: string;
  clean: boolean;
  ahead: number;
  behind: number;
  untracked: string[];
  modified: string[];
  staged: string[];
  conflicts: string[];
}

export interface BranchConfig {
  name: string;
  type: 'feature' | 'bugfix' | 'hotfix' | 'release' | 'custom';
  baseBranch?: string;
  checkout?: boolean;
  push?: boolean;
}

export interface CommitOptions {
  message: string;
  description?: string;
  stage?: 'all' | 'modified' | 'specific';
  files?: string[];
  amend?: boolean;
  noVerify?: boolean;
  signoff?: boolean;
}

export interface GitFlowConfig {
  masterBranch: string;
  developBranch: string;
  featurePrefix: string;
  bugfixPrefix: string;
  releasePrefix: string;
  hotfixPrefix: string;
  tagPrefix: string;
}

export interface InitializationResult {
  success: boolean;
  repoPath: string;
  initialCommit?: string;
  branch: string;
  remote?: string;
  errors?: string[];
  warnings?: string[];
}

export class GitIntegration extends EventEmitter {
  private defaultGitFlow: GitFlowConfig = {
    masterBranch: 'main',
    developBranch: 'develop',
    featurePrefix: 'feature/',
    bugfixPrefix: 'bugfix/',
    releasePrefix: 'release/',
    hotfixPrefix: 'hotfix/',
    tagPrefix: 'v'
  };

  private defaultGitignore = `# Dependencies
node_modules/
bower_components/
vendor/

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.cache/

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Test coverage
coverage/
.nyc_output/
*.lcov

# Temporary files
tmp/
temp/
.tmp/
.temp/

# Package manager files
.npm/
.yarn/
.pnpm/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Re-Shell specific
.re-shell/
*.re-shell.cache
.re-shell-backup/`;

  constructor() {
    super();
  }

  async initializeRepository(
    projectPath: string,
    config: GitConfig = {}
  ): Promise<InitializationResult> {
    this.emit('init:start', { projectPath, config });

    const result: InitializationResult = {
      success: false,
      repoPath: projectPath,
      branch: config.defaultBranch || 'main',
      errors: [],
      warnings: []
    };

    try {
      // Check if already a git repository
      const isRepo = await this.isGitRepository(projectPath);
      if (isRepo) {
        result.warnings?.push('Directory is already a Git repository');
        const status = await this.getStatus(projectPath);
        result.branch = status.currentBranch;
        result.success = true;
        return result;
      }

      // Initialize repository
      await this.runGitCommand('init', projectPath);
      this.emit('init:initialized', projectPath);

      // Set default branch name
      if (config.defaultBranch && config.defaultBranch !== 'master') {
        try {
          await this.runGitCommand(`branch -M ${config.defaultBranch}`, projectPath);
          result.branch = config.defaultBranch;
        } catch (error) {
          result.warnings?.push(`Failed to rename default branch: ${error}`);
        }
      }

      // Configure user if provided
      if (config.userName || config.userEmail) {
        await this.configureUser(projectPath, config.userName, config.userEmail);
      }

      // Create .gitignore
      const gitignorePath = path.join(projectPath, '.gitignore');
      if (!await fs.pathExists(gitignorePath)) {
        const gitignoreContent = config.gitignoreTemplate || this.defaultGitignore;
        await fs.writeFile(gitignorePath, gitignoreContent);
        this.emit('init:gitignore_created', gitignorePath);
      }

      // Create README if it doesn't exist
      const readmePath = path.join(projectPath, 'README.md');
      if (!await fs.pathExists(readmePath)) {
        const readmeContent = this.generateReadme(projectPath, config);
        await fs.writeFile(readmePath, readmeContent);
        this.emit('init:readme_created', readmePath);
      }

      // Setup git hooks if provided
      if (config.hooks && config.hooks.length > 0) {
        await this.setupHooks(projectPath, config.hooks);
      }

      // Create initial commit
      const commitResult = await this.createInitialCommit(projectPath, config);
      if (commitResult.success) {
        result.initialCommit = commitResult.commitHash;
      } else {
        result.errors?.push('Failed to create initial commit');
      }

      // Setup remote if provided
      if (config.remoteUrl) {
        try {
          await this.addRemote(projectPath, 'origin', config.remoteUrl);
          result.remote = config.remoteUrl;
          this.emit('init:remote_added', config.remoteUrl);
        } catch (error: any) {
          result.warnings?.push(`Failed to add remote: ${error.message}`);
        }
      }

      result.success = true;
      this.emit('init:complete', result);
      return result;

    } catch (error: any) {
      result.errors?.push(error.message);
      this.emit('init:error', error);
      return result;
    }
  }

  async isGitRepository(projectPath: string): Promise<boolean> {
    try {
      await this.runGitCommand('rev-parse --git-dir', projectPath);
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(projectPath: string): Promise<GitStatus> {
    const status: GitStatus = {
      initialized: false,
      hasRemote: false,
      currentBranch: '',
      clean: true,
      ahead: 0,
      behind: 0,
      untracked: [],
      modified: [],
      staged: [],
      conflicts: []
    };

    try {
      // Check if initialized
      status.initialized = await this.isGitRepository(projectPath);
      if (!status.initialized) return status;

      // Get current branch
      try {
        status.currentBranch = (await this.runGitCommand('rev-parse --abbrev-ref HEAD', projectPath)).trim();
      } catch {
        status.currentBranch = 'unknown';
      }

      // Check for remote
      try {
        const remotes = await this.runGitCommand('remote -v', projectPath);
        status.hasRemote = remotes.trim().length > 0;
      } catch {
        status.hasRemote = false;
      }

      // Get status porcelain
      const porcelain = await this.runGitCommand('status --porcelain=v1', projectPath);
      const lines = porcelain.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const code = line.substring(0, 2);
        const file = line.substring(3);

        if (code === '??') {
          status.untracked.push(file);
        } else if (code === 'UU' || code === 'AA' || code === 'DD') {
          status.conflicts.push(file);
        } else {
          if (code[0] !== ' ' && code[0] !== '?') {
            status.staged.push(file);
          }
          if (code[1] !== ' ' && code[1] !== '?') {
            status.modified.push(file);
          }
        }
      }

      status.clean = lines.length === 0;

      // Get ahead/behind if has remote
      if (status.hasRemote && status.currentBranch !== 'unknown') {
        try {
          const upstream = await this.runGitCommand(
            `rev-list --left-right --count @{upstream}...HEAD`,
            projectPath
          );
          const [behind, ahead] = upstream.trim().split(/\s+/).map(n => parseInt(n, 10));
          status.behind = behind || 0;
          status.ahead = ahead || 0;
        } catch {
          // No upstream branch
        }
      }

      return status;

    } catch (error: any) {
      this.emit('status:error', error);
      return status;
    }
  }

  async createBranch(
    projectPath: string,
    config: BranchConfig
  ): Promise<{ success: boolean; branch: string; error?: string }> {
    try {
      // Validate branch name
      if (!this.isValidBranchName(config.name)) {
        throw new Error(`Invalid branch name: ${config.name}`);
      }

      // Determine base branch
      const baseBranch = config.baseBranch || await this.getCurrentBranch(projectPath);

      // Create branch
      await this.runGitCommand(`checkout -b ${config.name} ${baseBranch}`, projectPath);
      this.emit('branch:created', { name: config.name, base: baseBranch });

      // Push to remote if requested
      if (config.push) {
        try {
          await this.runGitCommand(`push -u origin ${config.name}`, projectPath);
          this.emit('branch:pushed', config.name);
        } catch (error: any) {
          this.emit('branch:push_failed', { branch: config.name, error });
        }
      }

      return { success: true, branch: config.name };

    } catch (error: any) {
      return { success: false, branch: '', error: error.message };
    }
  }

  async createFeatureBranch(
    projectPath: string,
    featureName: string,
    gitFlow?: Partial<GitFlowConfig>
  ): Promise<{ success: boolean; branch: string; error?: string }> {
    const flow = { ...this.defaultGitFlow, ...gitFlow };
    const branchName = `${flow.featurePrefix}${featureName}`;

    return this.createBranch(projectPath, {
      name: branchName,
      type: 'feature',
      baseBranch: flow.developBranch,
      checkout: true
    });
  }

  async commit(
    projectPath: string,
    options: CommitOptions
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      // Stage files
      if (options.stage === 'all') {
        await this.runGitCommand('add -A', projectPath);
      } else if (options.stage === 'modified') {
        await this.runGitCommand('add -u', projectPath);
      } else if (options.stage === 'specific' && options.files) {
        for (const file of options.files) {
          await this.runGitCommand(`add "${file}"`, projectPath);
        }
      }

      // Build commit command
      let commitCmd = 'commit';
      
      if (options.amend) commitCmd += ' --amend';
      if (options.noVerify) commitCmd += ' --no-verify';
      if (options.signoff) commitCmd += ' --signoff';

      // Add message
      commitCmd += ` -m "${options.message.replace(/"/g, '\\"')}"`;
      
      if (options.description) {
        commitCmd += ` -m "${options.description.replace(/"/g, '\\"')}"`;
      }

      // Execute commit
      const output = await this.runGitCommand(commitCmd, projectPath);
      
      // Extract commit hash
      const hashMatch = output.match(/\[[\w\s-]+\s+([a-f0-9]+)\]/);
      const commitHash = hashMatch ? hashMatch[1] : undefined;

      this.emit('commit:created', { hash: commitHash, message: options.message });
      return { success: true, commitHash };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async createInitialCommit(
    projectPath: string,
    config: GitConfig
  ): Promise<{ success: boolean; commitHash?: string }> {
    const message = config.commitMessage || 'Initial commit';
    
    return this.commit(projectPath, {
      message,
      description: 'Project initialized with Re-Shell CLI',
      stage: 'all',
      signoff: config.signCommits
    });
  }

  async setupGitFlow(
    projectPath: string,
    config?: Partial<GitFlowConfig>
  ): Promise<{ success: boolean; errors?: string[] }> {
    const flow = { ...this.defaultGitFlow, ...config };
    const errors: string[] = [];

    try {
      // Ensure we're on the main branch
      await this.runGitCommand(`checkout ${flow.masterBranch}`, projectPath);

      // Create develop branch if it doesn't exist
      try {
        await this.runGitCommand(`checkout -b ${flow.developBranch}`, projectPath);
        this.emit('gitflow:branch_created', flow.developBranch);
      } catch {
        // Branch might already exist
        await this.runGitCommand(`checkout ${flow.developBranch}`, projectPath);
      }

      // Push develop branch
      try {
        await this.runGitCommand(`push -u origin ${flow.developBranch}`, projectPath);
      } catch (error: any) {
        errors.push(`Failed to push develop branch: ${error.message}`);
      }

      // Create .gitflow config file
      const gitflowConfig = {
        gitflow: {
          branch: {
            master: flow.masterBranch,
            develop: flow.developBranch
          },
          prefix: {
            feature: flow.featurePrefix,
            bugfix: flow.bugfixPrefix,
            release: flow.releasePrefix,
            hotfix: flow.hotfixPrefix,
            support: 'support/',
            versiontag: flow.tagPrefix
          }
        }
      };

      const configPath = path.join(projectPath, '.gitflow');
      await fs.writeJson(configPath, gitflowConfig, { spaces: 2 });

      this.emit('gitflow:setup_complete', flow);
      return { success: true, errors: errors.length > 0 ? errors : undefined };

    } catch (error: any) {
      errors.push(error.message);
      return { success: false, errors };
    }
  }

  async addRemote(
    projectPath: string,
    name: string,
    url: string
  ): Promise<void> {
    await this.runGitCommand(`remote add ${name} ${url}`, projectPath);
  }

  async push(
    projectPath: string,
    options: {
      remote?: string;
      branch?: string;
      force?: boolean;
      tags?: boolean;
      setUpstream?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const remote = options.remote || 'origin';
      const branch = options.branch || await this.getCurrentBranch(projectPath);
      
      let pushCmd = `push`;
      
      if (options.force) pushCmd += ' --force';
      if (options.tags) pushCmd += ' --tags';
      if (options.setUpstream) pushCmd += ' -u';
      
      pushCmd += ` ${remote} ${branch}`;
      
      await this.runGitCommand(pushCmd, projectPath);
      this.emit('push:complete', { remote, branch });
      
      return { success: true };
      
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async pull(
    projectPath: string,
    options: {
      remote?: string;
      branch?: string;
      rebase?: boolean;
      noCommit?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const remote = options.remote || 'origin';
      const branch = options.branch || await this.getCurrentBranch(projectPath);
      
      let pullCmd = `pull`;
      
      if (options.rebase) pullCmd += ' --rebase';
      if (options.noCommit) pullCmd += ' --no-commit';
      
      pullCmd += ` ${remote} ${branch}`;
      
      await this.runGitCommand(pullCmd, projectPath);
      this.emit('pull:complete', { remote, branch });
      
      return { success: true };
      
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async tag(
    projectPath: string,
    tagName: string,
    options: {
      message?: string;
      annotated?: boolean;
      force?: boolean;
      sign?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let tagCmd = 'tag';
      
      if (options.annotated || options.message) tagCmd += ' -a';
      if (options.force) tagCmd += ' -f';
      if (options.sign) tagCmd += ' -s';
      if (options.message) tagCmd += ` -m "${options.message.replace(/"/g, '\\"')}"`;
      
      tagCmd += ` ${tagName}`;
      
      await this.runGitCommand(tagCmd, projectPath);
      this.emit('tag:created', tagName);
      
      return { success: true };
      
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async stash(
    projectPath: string,
    options: {
      message?: string;
      includeUntracked?: boolean;
      keepIndex?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let stashCmd = 'stash push';
      
      if (options.includeUntracked) stashCmd += ' --include-untracked';
      if (options.keepIndex) stashCmd += ' --keep-index';
      if (options.message) stashCmd += ` -m "${options.message.replace(/"/g, '\\"')}"`;
      
      await this.runGitCommand(stashCmd, projectPath);
      this.emit('stash:created');
      
      return { success: true };
      
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getLog(
    projectPath: string,
    options: {
      limit?: number;
      oneline?: boolean;
      graph?: boolean;
      author?: string;
      since?: string;
      until?: string;
    } = {}
  ): Promise<string[]> {
    let logCmd = 'log';
    
    if (options.limit) logCmd += ` -n ${options.limit}`;
    if (options.oneline) logCmd += ' --oneline';
    if (options.graph) logCmd += ' --graph';
    if (options.author) logCmd += ` --author="${options.author}"`;
    if (options.since) logCmd += ` --since="${options.since}"`;
    if (options.until) logCmd += ` --until="${options.until}"`;
    
    const output = await this.runGitCommand(logCmd, projectPath);
    return output.trim().split('\n').filter(line => line);
  }

  async getDiff(
    projectPath: string,
    options: {
      staged?: boolean;
      nameOnly?: boolean;
      stat?: boolean;
      commit?: string;
    } = {}
  ): Promise<string> {
    let diffCmd = 'diff';
    
    if (options.staged) diffCmd += ' --staged';
    if (options.nameOnly) diffCmd += ' --name-only';
    if (options.stat) diffCmd += ' --stat';
    if (options.commit) diffCmd += ` ${options.commit}`;
    
    return await this.runGitCommand(diffCmd, projectPath);
  }

  async setupHooks(projectPath: string, hooks: GitHook[]): Promise<void> {
    const hooksDir = path.join(projectPath, '.git', 'hooks');
    await fs.ensureDir(hooksDir);

    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook.name);
      const hookContent = `#!/bin/sh
# ${hook.description || `${hook.name} hook`}
# Generated by Re-Shell CLI

${hook.script}
`;
      
      await fs.writeFile(hookPath, hookContent);
      await fs.chmod(hookPath, '755');
      
      this.emit('hook:created', hook.name);
    }
  }

  async configureUser(
    projectPath: string,
    userName?: string,
    userEmail?: string
  ): Promise<void> {
    if (userName) {
      await this.runGitCommand(`config user.name "${userName}"`, projectPath);
    }
    
    if (userEmail) {
      await this.runGitCommand(`config user.email "${userEmail}"`, projectPath);
    }
  }

  async getConfig(
    projectPath: string,
    key: string,
    options: { global?: boolean } = {}
  ): Promise<string | null> {
    try {
      let cmd = `config`;
      if (options.global) cmd += ' --global';
      cmd += ` --get ${key}`;
      
      const value = await this.runGitCommand(cmd, projectPath);
      return value.trim();
    } catch {
      return null;
    }
  }

  async setConfig(
    projectPath: string,
    key: string,
    value: string,
    options: { global?: boolean } = {}
  ): Promise<void> {
    let cmd = `config`;
    if (options.global) cmd += ' --global';
    cmd += ` ${key} "${value}"`;
    
    await this.runGitCommand(cmd, projectPath);
  }

  private async getCurrentBranch(projectPath: string): Promise<string> {
    return (await this.runGitCommand('rev-parse --abbrev-ref HEAD', projectPath)).trim();
  }

  private isValidBranchName(name: string): boolean {
    // Git branch name validation rules
    const invalidPatterns = [
      /^-/,           // Cannot start with dash
      /\.$/,          // Cannot end with dot
      /\.lock$/,      // Cannot end with .lock
      /[\s~^:?*[\\]/, // Invalid characters
      /\.\./,         // Cannot contain ..
      /@\{/,          // Cannot contain @{
      /\/\//          // Cannot contain //
    ];

    return !invalidPatterns.some(pattern => pattern.test(name));
  }

  private generateReadme(projectPath: string, config: GitConfig): string {
    const projectName = path.basename(projectPath);
    
    return `# ${projectName}

This project was initialized with [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli).

## Getting Started

### Prerequisites

- Node.js >= 16.0.0
- npm, yarn, or pnpm

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

### Building

\`\`\`bash
npm run build
\`\`\`

### Testing

\`\`\`bash
npm test
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── src/          # Source code
├── tests/        # Test files
├── dist/         # Build output
└── README.md     # This file
\`\`\`

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
`;
  }

  private async runGitCommand(command: string, cwd: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(`git ${command}`, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      
      if (stderr && !stderr.includes('warning:')) {
        this.emit('git:warning', stderr);
      }
      
      return stdout;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Git is not installed or not in PATH');
      }
      throw new Error(error.stderr || error.message);
    }
  }

  // Utility methods
  async ensureGitInstalled(): Promise<boolean> {
    try {
      execSync('git --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getGitVersion(): Promise<string | null> {
    try {
      const output = execSync('git --version', { encoding: 'utf8' });
      const match = output.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  generateGitignore(projectType: string): string {
    const templates: Record<string, string> = {
      node: this.defaultGitignore,
      python: `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST
pip-log.txt
pip-delete-this-directory.txt
.pytest_cache/
.coverage
.tox/
.mypy_cache/
.dmypy.json
dmypy.json
.pyre/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db`,
      java: `# Java
*.class
*.jar
*.war
*.ear
*.nar
hs_err_pid*
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
pom.xml.next
release.properties
dependency-reduced-pom.xml
buildNumber.properties
.mvn/timing.properties
.mvn/wrapper/maven-wrapper.jar

# Gradle
.gradle/
build/
!gradle-wrapper.jar

# IDE
.idea/
*.iml
*.iws
*.ipr
.project
.classpath
.settings/
bin/

# OS
.DS_Store
Thumbs.db`,
      go: `# Go
*.exe
*.exe~
*.dll
*.so
*.dylib
*.test
*.out
vendor/
go.sum

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db`
    };

    return templates[projectType] || this.defaultGitignore;
  }
}

// Global instance
let globalGitIntegration: GitIntegration | null = null;

export function getGitIntegration(): GitIntegration {
  if (!globalGitIntegration) {
    globalGitIntegration = new GitIntegration();
  }
  return globalGitIntegration;
}

export async function initializeGitRepository(
  projectPath: string,
  config?: GitConfig
): Promise<InitializationResult> {
  const git = getGitIntegration();
  return git.initializeRepository(projectPath, config);
}

export async function getGitStatus(projectPath: string): Promise<GitStatus> {
  const git = getGitIntegration();
  return git.getStatus(projectPath);
}