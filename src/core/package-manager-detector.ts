import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

export enum PackageManager {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  BUN = 'bun',
  DENO = 'deno',
  CARGO = 'cargo',
  PIP = 'pip',
  POETRY = 'poetry',
  BUNDLER = 'bundler',
  COMPOSER = 'composer',
  MAVEN = 'maven',
  GRADLE = 'gradle',
  GO = 'go',
  DOTNET = 'dotnet',
  UNKNOWN = 'unknown'
}

export interface PackageManagerInfo {
  name: PackageManager;
  version: string;
  path: string;
  isInstalled: boolean;
  performance: PerformanceMetrics;
  features: ManagerFeatures;
  commands: ManagerCommands;
}

export interface PerformanceMetrics {
  installSpeed: 'fast' | 'medium' | 'slow';
  cacheEfficiency: 'high' | 'medium' | 'low';
  parallelism: boolean;
  diskUsage: 'low' | 'medium' | 'high';
  memoryUsage: 'low' | 'medium' | 'high';
  startupTime: number; // milliseconds
}

export interface ManagerFeatures {
  workspaces: boolean;
  lockfiles: boolean;
  peerDependencies: boolean;
  patchSupport: boolean;
  offlineMode: boolean;
  securityAudit: boolean;
  autoInstall: boolean;
  deterministicInstalls: boolean;
  pluginSystem: boolean;
}

export interface ManagerCommands {
  install: string;
  add: string;
  remove: string;
  update: string;
  run: string;
  test: string;
  build: string;
  publish: string;
  audit: string;
  cache: string;
}

export interface DetectionResult {
  detected: PackageManager;
  confidence: number;
  reason: string;
  alternatives: Array<{
    manager: PackageManager;
    confidence: number;
    reason: string;
  }>;
  recommendation?: PackageManager;
  performanceAnalysis?: PerformanceComparison;
}

export interface PerformanceComparison {
  fastest: PackageManager;
  mostEfficient: PackageManager;
  recommended: PackageManager;
  analysis: Record<PackageManager, {
    score: number;
    pros: string[];
    cons: string[];
  }>;
}

export interface ProjectContext {
  projectPath: string;
  projectType?: 'node' | 'python' | 'ruby' | 'java' | 'go' | 'rust' | 'php' | 'dotnet' | 'unknown';
  size?: 'small' | 'medium' | 'large';
  isMonorepo?: boolean;
  hasWorkspaces?: boolean;
  dependencies?: number;
  devDependencies?: number;
}

export class PackageManagerDetector extends EventEmitter {
  private static managerInfo: Map<PackageManager, PackageManagerInfo> = new Map();
  private static initialized = false;
  private static performanceCache: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (PackageManagerDetector.initialized) return;

    await this.loadManagerDefinitions();
    await this.detectInstalledManagers();
    PackageManagerDetector.initialized = true;
  }

  private async loadManagerDefinitions(): Promise<void> {
    // Node.js Package Managers
    PackageManagerDetector.managerInfo.set(PackageManager.NPM, {
      name: PackageManager.NPM,
      version: '',
      path: '',
      isInstalled: false,
      performance: {
        installSpeed: 'medium',
        cacheEfficiency: 'medium',
        parallelism: true,
        diskUsage: 'medium',
        memoryUsage: 'medium',
        startupTime: 500
      },
      features: {
        workspaces: true,
        lockfiles: true,
        peerDependencies: true,
        patchSupport: false,
        offlineMode: true,
        securityAudit: true,
        autoInstall: false,
        deterministicInstalls: true,
        pluginSystem: false
      },
      commands: {
        install: 'npm install',
        add: 'npm install',
        remove: 'npm uninstall',
        update: 'npm update',
        run: 'npm run',
        test: 'npm test',
        build: 'npm run build',
        publish: 'npm publish',
        audit: 'npm audit',
        cache: 'npm cache'
      }
    });

    PackageManagerDetector.managerInfo.set(PackageManager.YARN, {
      name: PackageManager.YARN,
      version: '',
      path: '',
      isInstalled: false,
      performance: {
        installSpeed: 'fast',
        cacheEfficiency: 'high',
        parallelism: true,
        diskUsage: 'low',
        memoryUsage: 'medium',
        startupTime: 300
      },
      features: {
        workspaces: true,
        lockfiles: true,
        peerDependencies: true,
        patchSupport: true,
        offlineMode: true,
        securityAudit: true,
        autoInstall: true,
        deterministicInstalls: true,
        pluginSystem: true
      },
      commands: {
        install: 'yarn install',
        add: 'yarn add',
        remove: 'yarn remove',
        update: 'yarn upgrade',
        run: 'yarn',
        test: 'yarn test',
        build: 'yarn build',
        publish: 'yarn publish',
        audit: 'yarn audit',
        cache: 'yarn cache'
      }
    });

    PackageManagerDetector.managerInfo.set(PackageManager.PNPM, {
      name: PackageManager.PNPM,
      version: '',
      path: '',
      isInstalled: false,
      performance: {
        installSpeed: 'fast',
        cacheEfficiency: 'high',
        parallelism: true,
        diskUsage: 'low',
        memoryUsage: 'low',
        startupTime: 200
      },
      features: {
        workspaces: true,
        lockfiles: true,
        peerDependencies: true,
        patchSupport: true,
        offlineMode: true,
        securityAudit: true,
        autoInstall: false,
        deterministicInstalls: true,
        pluginSystem: false
      },
      commands: {
        install: 'pnpm install',
        add: 'pnpm add',
        remove: 'pnpm remove',
        update: 'pnpm update',
        run: 'pnpm',
        test: 'pnpm test',
        build: 'pnpm build',
        publish: 'pnpm publish',
        audit: 'pnpm audit',
        cache: 'pnpm store'
      }
    });

    PackageManagerDetector.managerInfo.set(PackageManager.BUN, {
      name: PackageManager.BUN,
      version: '',
      path: '',
      isInstalled: false,
      performance: {
        installSpeed: 'fast',
        cacheEfficiency: 'high',
        parallelism: true,
        diskUsage: 'low',
        memoryUsage: 'low',
        startupTime: 100
      },
      features: {
        workspaces: true,
        lockfiles: true,
        peerDependencies: true,
        patchSupport: false,
        offlineMode: true,
        securityAudit: false,
        autoInstall: true,
        deterministicInstalls: true,
        pluginSystem: false
      },
      commands: {
        install: 'bun install',
        add: 'bun add',
        remove: 'bun remove',
        update: 'bun update',
        run: 'bun run',
        test: 'bun test',
        build: 'bun build',
        publish: 'bun publish',
        audit: '',
        cache: ''
      }
    });

    // Other Language Package Managers
    PackageManagerDetector.managerInfo.set(PackageManager.PIP, {
      name: PackageManager.PIP,
      version: '',
      path: '',
      isInstalled: false,
      performance: {
        installSpeed: 'medium',
        cacheEfficiency: 'medium',
        parallelism: false,
        diskUsage: 'medium',
        memoryUsage: 'low',
        startupTime: 400
      },
      features: {
        workspaces: false,
        lockfiles: false,
        peerDependencies: false,
        patchSupport: false,
        offlineMode: true,
        securityAudit: false,
        autoInstall: false,
        deterministicInstalls: false,
        pluginSystem: false
      },
      commands: {
        install: 'pip install',
        add: 'pip install',
        remove: 'pip uninstall',
        update: 'pip install --upgrade',
        run: 'python',
        test: 'pytest',
        build: 'python setup.py build',
        publish: 'python setup.py upload',
        audit: '',
        cache: 'pip cache'
      }
    });

    PackageManagerDetector.managerInfo.set(PackageManager.POETRY, {
      name: PackageManager.POETRY,
      version: '',
      path: '',
      isInstalled: false,
      performance: {
        installSpeed: 'medium',
        cacheEfficiency: 'high',
        parallelism: true,
        diskUsage: 'low',
        memoryUsage: 'medium',
        startupTime: 600
      },
      features: {
        workspaces: false,
        lockfiles: true,
        peerDependencies: false,
        patchSupport: false,
        offlineMode: true,
        securityAudit: true,
        autoInstall: false,
        deterministicInstalls: true,
        pluginSystem: true
      },
      commands: {
        install: 'poetry install',
        add: 'poetry add',
        remove: 'poetry remove',
        update: 'poetry update',
        run: 'poetry run',
        test: 'poetry run pytest',
        build: 'poetry build',
        publish: 'poetry publish',
        audit: 'poetry check',
        cache: 'poetry cache'
      }
    });

    // Add more package managers as needed...
  }

  private async detectInstalledManagers(): Promise<void> {
    for (const [manager, info] of PackageManagerDetector.managerInfo) {
      try {
        const result = await this.checkManagerInstallation(manager);
        if (result.isInstalled) {
          info.isInstalled = true;
          info.version = result.version;
          info.path = result.path;
        }
      } catch (error) {
        // Manager not installed
        info.isInstalled = false;
      }
    }
  }

  private async checkManagerInstallation(manager: PackageManager): Promise<{
    isInstalled: boolean;
    version: string;
    path: string;
  }> {
    const commands: Record<PackageManager, string> = {
      [PackageManager.NPM]: 'npm --version',
      [PackageManager.YARN]: 'yarn --version',
      [PackageManager.PNPM]: 'pnpm --version',
      [PackageManager.BUN]: 'bun --version',
      [PackageManager.DENO]: 'deno --version',
      [PackageManager.CARGO]: 'cargo --version',
      [PackageManager.PIP]: 'pip --version',
      [PackageManager.POETRY]: 'poetry --version',
      [PackageManager.BUNDLER]: 'bundle --version',
      [PackageManager.COMPOSER]: 'composer --version',
      [PackageManager.MAVEN]: 'mvn --version',
      [PackageManager.GRADLE]: 'gradle --version',
      [PackageManager.GO]: 'go version',
      [PackageManager.DOTNET]: 'dotnet --version',
      [PackageManager.UNKNOWN]: ''
    };

    const command = commands[manager];
    if (!command) {
      return { isInstalled: false, version: '', path: '' };
    }

    try {
      const version = execSync(command, { encoding: 'utf8' }).trim();
      const pathCommand = process.platform === 'win32' ? 'where' : 'which';
      const path = execSync(`${pathCommand} ${manager}`, { encoding: 'utf8' }).trim().split('\n')[0];
      
      return { isInstalled: true, version, path };
    } catch {
      return { isInstalled: false, version: '', path: '' };
    }
  }

  async detect(context: ProjectContext): Promise<DetectionResult> {
    this.emit('detection:start', context);

    const detectionMethods = [
      this.detectByLockFile.bind(this),
      this.detectByConfigFile.bind(this),
      this.detectByProjectType.bind(this),
      this.detectByEnvironment.bind(this),
      this.detectByUserPreference.bind(this)
    ];

    const results: Array<{
      manager: PackageManager;
      confidence: number;
      reason: string;
    }> = [];

    for (const method of detectionMethods) {
      const result = await method(context);
      if (result) {
        results.push(result);
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length === 0) {
      return {
        detected: PackageManager.UNKNOWN,
        confidence: 0,
        reason: 'No package manager detected',
        alternatives: []
      };
    }

    const detected = results[0];
    const alternatives = results.slice(1);

    // Performance analysis
    const performanceAnalysis = await this.analyzePerformance(context, results.map(r => r.manager));

    const result: DetectionResult = {
      detected: detected.manager,
      confidence: detected.confidence,
      reason: detected.reason,
      alternatives,
      recommendation: performanceAnalysis.recommended,
      performanceAnalysis
    };

    this.emit('detection:complete', result);
    return result;
  }

  private async detectByLockFile(context: ProjectContext): Promise<{
    manager: PackageManager;
    confidence: number;
    reason: string;
  } | null> {
    const lockFiles: Array<{ file: string; manager: PackageManager }> = [
      { file: 'package-lock.json', manager: PackageManager.NPM },
      { file: 'yarn.lock', manager: PackageManager.YARN },
      { file: 'pnpm-lock.yaml', manager: PackageManager.PNPM },
      { file: 'bun.lockb', manager: PackageManager.BUN },
      { file: 'Pipfile.lock', manager: PackageManager.PIP },
      { file: 'poetry.lock', manager: PackageManager.POETRY },
      { file: 'Gemfile.lock', manager: PackageManager.BUNDLER },
      { file: 'composer.lock', manager: PackageManager.COMPOSER },
      { file: 'Cargo.lock', manager: PackageManager.CARGO },
      { file: 'go.sum', manager: PackageManager.GO }
    ];

    for (const { file, manager } of lockFiles) {
      const lockPath = path.join(context.projectPath, file);
      if (await fs.pathExists(lockPath)) {
        return {
          manager,
          confidence: 100,
          reason: `Found ${file} lock file`
        };
      }
    }

    return null;
  }

  private async detectByConfigFile(context: ProjectContext): Promise<{
    manager: PackageManager;
    confidence: number;
    reason: string;
  } | null> {
    // Check package.json for specific fields
    const packageJsonPath = path.join(context.projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Check for packageManager field (corepack)
        if (packageJson.packageManager) {
          const manager = packageJson.packageManager.split('@')[0];
          return {
            manager: manager as PackageManager,
            confidence: 95,
            reason: 'Specified in package.json packageManager field'
          };
        }

        // Check for workspace configuration
        if (packageJson.workspaces) {
          if (packageJson.workspaces.packages) {
            return {
              manager: PackageManager.YARN,
              confidence: 80,
              reason: 'Yarn workspaces configuration detected'
            };
          }
        }

        // Check for pnpm workspace
        const pnpmWorkspacePath = path.join(context.projectPath, 'pnpm-workspace.yaml');
        if (await fs.pathExists(pnpmWorkspacePath)) {
          return {
            manager: PackageManager.PNPM,
            confidence: 90,
            reason: 'PNPM workspace configuration detected'
          };
        }
      } catch (error) {
        // Invalid package.json
      }
    }

    // Check for other config files
    const configFiles: Array<{ file: string; manager: PackageManager }> = [
      { file: '.yarnrc.yml', manager: PackageManager.YARN },
      { file: '.npmrc', manager: PackageManager.NPM },
      { file: '.pnpmfile.cjs', manager: PackageManager.PNPM },
      { file: 'pyproject.toml', manager: PackageManager.POETRY },
      { file: 'Pipfile', manager: PackageManager.PIP },
      { file: 'requirements.txt', manager: PackageManager.PIP },
      { file: 'Gemfile', manager: PackageManager.BUNDLER },
      { file: 'composer.json', manager: PackageManager.COMPOSER },
      { file: 'Cargo.toml', manager: PackageManager.CARGO },
      { file: 'go.mod', manager: PackageManager.GO },
      { file: 'pom.xml', manager: PackageManager.MAVEN },
      { file: 'build.gradle', manager: PackageManager.GRADLE }
    ];

    for (const { file, manager } of configFiles) {
      const configPath = path.join(context.projectPath, file);
      if (await fs.pathExists(configPath)) {
        return {
          manager,
          confidence: 70,
          reason: `Found ${file} configuration file`
        };
      }
    }

    return null;
  }

  private async detectByProjectType(context: ProjectContext): Promise<{
    manager: PackageManager;
    confidence: number;
    reason: string;
  } | null> {
    if (!context.projectType || context.projectType === 'unknown') {
      return null;
    }

    const typeManagers: Record<string, PackageManager> = {
      node: PackageManager.NPM,
      python: PackageManager.PIP,
      ruby: PackageManager.BUNDLER,
      java: PackageManager.MAVEN,
      go: PackageManager.GO,
      rust: PackageManager.CARGO,
      php: PackageManager.COMPOSER,
      dotnet: PackageManager.DOTNET
    };

    const manager = typeManagers[context.projectType];
    if (manager) {
      return {
        manager,
        confidence: 50,
        reason: `Default for ${context.projectType} projects`
      };
    }

    return null;
  }

  private async detectByEnvironment(context: ProjectContext): Promise<{
    manager: PackageManager;
    confidence: number;
    reason: string;
  } | null> {
    // Check environment variables
    const envManagers: Array<{ env: string; manager: PackageManager }> = [
      { env: 'npm_config_user_agent', manager: PackageManager.NPM },
      { env: 'YARN_VERSION', manager: PackageManager.YARN },
      { env: 'PNPM_HOME', manager: PackageManager.PNPM },
      { env: 'BUN_INSTALL', manager: PackageManager.BUN }
    ];

    for (const { env, manager } of envManagers) {
      if (process.env[env]) {
        return {
          manager,
          confidence: 60,
          reason: `${env} environment variable detected`
        };
      }
    }

    // Check which managers are installed
    const installed = Array.from(PackageManagerDetector.managerInfo.values())
      .filter(info => info.isInstalled);

    if (installed.length === 1) {
      return {
        manager: installed[0].name,
        confidence: 40,
        reason: 'Only package manager installed on system'
      };
    }

    return null;
  }

  private async detectByUserPreference(context: ProjectContext): Promise<{
    manager: PackageManager;
    confidence: number;
    reason: string;
  } | null> {
    // Check user's global configuration
    const userConfig = path.join(os.homedir(), '.re-shell', 'config.yaml');
    if (await fs.pathExists(userConfig)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yaml = require('js-yaml');
        const config = yaml.load(await fs.readFile(userConfig, 'utf8'));
        if (config.defaultPackageManager) {
          return {
            manager: config.defaultPackageManager as PackageManager,
            confidence: 30,
            reason: 'User preference in global configuration'
          };
        }
      } catch (error) {
        // Invalid config
      }
    }

    return null;
  }

  private async analyzePerformance(
    context: ProjectContext,
    managers: PackageManager[]
  ): Promise<PerformanceComparison> {
    const analysis: Record<PackageManager, {
      score: number;
      pros: string[];
      cons: string[];
    }> = {} as any;

    for (const manager of managers) {
      const info = PackageManagerDetector.managerInfo.get(manager);
      if (!info || !info.isInstalled) continue;

      const score = this.calculatePerformanceScore(info, context);
      const { pros, cons } = this.analyzeManagerProsAndCons(info, context);

      analysis[manager] = { score, pros, cons };
    }

    // Determine winners
    const entries = Object.entries(analysis);
    const fastest = entries.reduce((a, b) => 
      a[1].score > b[1].score ? a : b
    )[0] as PackageManager;

    const mostEfficient = this.determineMostEfficient(analysis, context);
    const recommended = this.determineRecommended(analysis, context);

    return {
      fastest,
      mostEfficient,
      recommended,
      analysis
    };
  }

  private calculatePerformanceScore(
    info: PackageManagerInfo,
    context: ProjectContext
  ): number {
    let score = 0;

    // Speed scoring
    switch (info.performance.installSpeed) {
      case 'fast': score += 30; break;
      case 'medium': score += 20; break;
      case 'slow': score += 10; break;
    }

    // Cache efficiency
    switch (info.performance.cacheEfficiency) {
      case 'high': score += 20; break;
      case 'medium': score += 10; break;
      case 'low': score += 5; break;
    }

    // Parallelism bonus
    if (info.performance.parallelism) score += 15;

    // Disk usage (inverse scoring)
    switch (info.performance.diskUsage) {
      case 'low': score += 15; break;
      case 'medium': score += 10; break;
      case 'high': score += 5; break;
    }

    // Memory usage (inverse scoring)
    switch (info.performance.memoryUsage) {
      case 'low': score += 10; break;
      case 'medium': score += 5; break;
      case 'high': score += 0; break;
    }

    // Startup time (inverse scoring)
    if (info.performance.startupTime < 200) score += 10;
    else if (info.performance.startupTime < 500) score += 5;

    // Context-specific bonuses
    if (context.isMonorepo && info.features.workspaces) score += 20;
    if (context.size === 'large' && info.performance.cacheEfficiency === 'high') score += 15;

    return score;
  }

  private analyzeManagerProsAndCons(
    info: PackageManagerInfo,
    context: ProjectContext
  ): { pros: string[]; cons: string[] } {
    const pros: string[] = [];
    const cons: string[] = [];

    // Performance pros/cons
    if (info.performance.installSpeed === 'fast') {
      pros.push('Fast installation speed');
    } else if (info.performance.installSpeed === 'slow') {
      cons.push('Slow installation speed');
    }

    if (info.performance.cacheEfficiency === 'high') {
      pros.push('Excellent cache efficiency');
    }

    if (info.performance.parallelism) {
      pros.push('Parallel package installation');
    } else {
      cons.push('No parallel installation support');
    }

    if (info.performance.diskUsage === 'low') {
      pros.push('Low disk usage');
    } else if (info.performance.diskUsage === 'high') {
      cons.push('High disk usage');
    }

    // Feature pros/cons
    if (info.features.workspaces) {
      pros.push('Native workspace support');
    } else if (context.isMonorepo) {
      cons.push('No workspace support for monorepos');
    }

    if (info.features.lockfiles) {
      pros.push('Deterministic installs with lockfiles');
    } else {
      cons.push('No lockfile support');
    }

    if (info.features.securityAudit) {
      pros.push('Built-in security auditing');
    }

    if (info.features.offlineMode) {
      pros.push('Offline mode support');
    }

    if (info.features.patchSupport) {
      pros.push('Package patching support');
    }

    return { pros, cons };
  }

  private determineMostEfficient(
    analysis: Record<PackageManager, { score: number; pros: string[]; cons: string[] }>,
    context: ProjectContext
  ): PackageManager {
    // Consider cache efficiency and disk usage
    let bestManager = PackageManager.UNKNOWN;
    let bestScore = 0;

    for (const [manager, data] of Object.entries(analysis)) {
      const info = PackageManagerDetector.managerInfo.get(manager as PackageManager);
      if (!info) continue;

      let efficiencyScore = data.score;
      
      // Weight cache efficiency highly
      if (info.performance.cacheEfficiency === 'high') efficiencyScore += 20;
      
      // Weight disk usage
      if (info.performance.diskUsage === 'low') efficiencyScore += 15;
      
      // Consider memory usage for large projects
      if (context.size === 'large' && info.performance.memoryUsage === 'low') {
        efficiencyScore += 10;
      }

      if (efficiencyScore > bestScore) {
        bestScore = efficiencyScore;
        bestManager = manager as PackageManager;
      }
    }

    return bestManager;
  }

  private determineRecommended(
    analysis: Record<PackageManager, { score: number; pros: string[]; cons: string[] }>,
    context: ProjectContext
  ): PackageManager {
    // Holistic recommendation based on context
    const recommendations: Array<{ manager: PackageManager; score: number }> = [];

    for (const [manager, data] of Object.entries(analysis)) {
      const info = PackageManagerDetector.managerInfo.get(manager as PackageManager);
      if (!info) continue;

      let recommendationScore = data.score;

      // Context-specific adjustments
      if (context.isMonorepo) {
        if (manager === PackageManager.PNPM) recommendationScore += 30; // PNPM excels at monorepos
        if (manager === PackageManager.YARN) recommendationScore += 20; // Yarn also good for monorepos
      }

      if (context.size === 'large') {
        if (info.performance.cacheEfficiency === 'high') recommendationScore += 20;
        if (info.performance.parallelism) recommendationScore += 15;
      }

      if (context.projectType === 'node') {
        // Prefer Node.js-specific managers
        if ([PackageManager.PNPM, PackageManager.YARN, PackageManager.BUN].includes(manager as PackageManager)) {
          recommendationScore += 10;
        }
      }

      recommendations.push({ manager: manager as PackageManager, score: recommendationScore });
    }

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations[0]?.manager || PackageManager.NPM;
  }

  async benchmark(context: ProjectContext, managers?: PackageManager[]): Promise<Map<PackageManager, {
    installTime: number;
    cacheHitTime: number;
    diskUsage: number;
    memoryPeak: number;
  }>> {
    this.emit('benchmark:start', { context, managers });

    const results = new Map();
    const managersToTest = managers || Array.from(PackageManagerDetector.managerInfo.keys())
      .filter(m => PackageManagerDetector.managerInfo.get(m)?.isInstalled);

    for (const manager of managersToTest) {
      try {
        const result = await this.runBenchmark(manager, context);
        results.set(manager, result);
        this.emit('benchmark:progress', { manager, result });
      } catch (error) {
        this.emit('benchmark:error', { manager, error });
      }
    }

    this.emit('benchmark:complete', results);
    return results;
  }

  private async runBenchmark(manager: PackageManager, context: ProjectContext): Promise<{
    installTime: number;
    cacheHitTime: number;
    diskUsage: number;
    memoryPeak: number;
  }> {
    // This is a placeholder for actual benchmarking
    // In a real implementation, this would:
    // 1. Create a temporary test project
    // 2. Run install commands and measure time
    // 3. Clear cache and re-run to measure cache performance
    // 4. Monitor disk and memory usage

    const info = PackageManagerDetector.managerInfo.get(manager);
    if (!info) {
      throw new Error(`Manager ${manager} not found`);
    }

    // Simulated benchmark results based on known characteristics
    const baseInstallTime = info.performance.startupTime;
    const installTime = baseInstallTime + Math.random() * 1000;
    const cacheHitTime = installTime * 0.3;
    const diskUsage = info.performance.diskUsage === 'low' ? 50 : 
                      info.performance.diskUsage === 'medium' ? 100 : 200;
    const memoryPeak = info.performance.memoryUsage === 'low' ? 128 :
                       info.performance.memoryUsage === 'medium' ? 256 : 512;

    return {
      installTime,
      cacheHitTime,
      diskUsage,
      memoryPeak
    };
  }

  getInstalledManagers(): PackageManager[] {
    return Array.from(PackageManagerDetector.managerInfo.entries())
      .filter(([_, info]) => info.isInstalled)
      .map(([manager, _]) => manager);
  }

  getManagerInfo(manager: PackageManager): PackageManagerInfo | undefined {
    return PackageManagerDetector.managerInfo.get(manager);
  }

  async getRecommendedManager(context: ProjectContext): Promise<PackageManager> {
    const result = await this.detect(context);
    return result.recommendation || result.detected;
  }

  async ensureManagerInstalled(manager: PackageManager): Promise<boolean> {
    const info = PackageManagerDetector.managerInfo.get(manager);
    if (!info || !info.isInstalled) {
      this.emit('manager:not_installed', manager);
      return false;
    }
    return true;
  }
}

// Global instance
let globalDetector: PackageManagerDetector | null = null;

export function getPackageManagerDetector(): PackageManagerDetector {
  if (!globalDetector) {
    globalDetector = new PackageManagerDetector();
  }
  return globalDetector;
}

export async function detectPackageManager(context: ProjectContext): Promise<DetectionResult> {
  const detector = getPackageManagerDetector();
  return detector.detect(context);
}

export async function getRecommendedPackageManager(context: ProjectContext): Promise<PackageManager> {
  const result = await detectPackageManager(context);
  return result.recommendation || result.detected;
}