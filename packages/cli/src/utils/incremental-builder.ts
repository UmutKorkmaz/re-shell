import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import { ValidationError } from './error-handler';
import { ChangeDetector } from './change-detector';
import { ChangeImpactAnalyzer } from './change-impact-analyzer';

/**
 * Represents a single buildable unit within the project (an app, package,
 * library, or tool). Contains the metadata required to schedule, execute,
 * cache, and validate builds for the unit.
 */
export interface BuildTarget {
  /** Logical name of the target, typically the workspace or package name. */
  name: string;
  /** Absolute or root-relative filesystem path to the target directory. */
  path: string;
  /** Category of the target used for build-time heuristics and ordering. */
  type: 'app' | 'package' | 'lib' | 'tool';
  /** Shell command (as declared in the target's package.json) used to build. */
  buildScript: string;
  /** Optional shell command used to run tests for the target. */
  testScript?: string;
  /** Names of other build targets that must be built before this one. */
  dependencies: string[];
  /** Relative paths of directories or files produced by the build. */
  outputs: string[];
  /** Relative paths of source and config files consumed by the build. */
  inputs: string[];
  /** Timestamp of the most recent successful build, if known. */
  lastBuildTime?: number;
  /** Hash of the target's inputs used for cache validation. */
  buildHash?: string;
}

/**
 * Describes the optimized execution plan produced for a single incremental
 * build run, including which targets to build, in what order, grouped for
 * parallel execution, and any optimization notes.
 */
export interface BuildPlan {
  /** Targets that need to be rebuilt for this plan. */
  targets: BuildTarget[];
  /** Target names ordered to respect inter-target dependencies. */
  buildOrder: string[];
  /** Groups of target names that can be built concurrently within each step. */
  parallelGroups: string[][];
  /** Rough estimate of total wall-clock time, in milliseconds. */
  totalEstimatedTime: number;
  /** Human-readable optimization suggestions applied to the plan. */
  optimizations: string[];
}

/**
 * Represents the outcome of building a single target, including timing,
 * success status, captured output, and cache information.
 */
export interface BuildResult {
  /** Name of the target this result refers to. */
  target: string;
  /** Whether the build script completed successfully. */
  success: boolean;
  /** Duration of the build in milliseconds. */
  duration: number;
  /** Combined stdout/stderr output captured from the build process. */
  output: string;
  /** Error message if the build failed, otherwise undefined. */
  error?: string;
  /** Total size in bytes of the produced build output, if computed. */
  outputSize?: number;
  /** Whether the result came from a valid cache entry instead of a real build. */
  cacheHit?: boolean;
}

/**
 * Configuration options that control the behavior of an incremental build run,
 * including parallelism, caching, timeouts, and reporting verbosity.
 */
export interface IncrementalBuildOptions {
  /** Maximum number of targets that may be built concurrently. */
  maxParallelBuilds: number;
  /** Whether to use and update the persistent build cache. */
  enableCache: boolean;
  /** Filesystem path where the build cache JSON file is stored. */
  cacheLocation: string;
  /** When true, all targets are rebuilt regardless of cache validity. */
  cleanBuild: boolean;
  /** When true, the plan is computed and printed but no build is executed. */
  dryRun: boolean;
  /** When true, detailed progress information is printed to the console. */
  verbose: boolean;
  /** When true, test scripts are skipped during the build. */
  skipTests: boolean;
  /** When true, the build aborts on the first failing target group. */
  failFast: boolean;
  /** Maximum time in milliseconds a single build script may run before timing out. */
  buildTimeout: number;
}

/**
 * Shape of the persisted build cache. Stores a versioned map of per-target
 * build metadata used to skip unchanged work on subsequent runs.
 */
export interface BuildCache {
  /** Schema version of the cache file format. */
  version: string;
  /** Map of target name to its cached build metadata. */
  builds: Record<string, {
    /** Content hash of the target's inputs at the time of the cached build. */
    hash: string;
    /** Epoch timestamp (ms) when the cached build completed. */
    timestamp: number;
    /** Duration of the cached build in milliseconds. */
    duration: number;
    /** Whether the cached build was successful. */
    success: boolean;
    /** Total size in bytes of the output produced by the cached build. */
    outputSize: number;
  }>;
}

/**
 * Incremental build optimizer that discovers build targets in a monorepo,
 * determines which targets are affected by a set of changes, computes an
 * optimal (possibly parallel) build order, executes the build, and maintains
 * a persistent cache to skip redundant work on subsequent runs.
 */
export class IncrementalBuilder {
  private rootPath: string;
  private changeDetector: ChangeDetector;
  private impactAnalyzer: ChangeImpactAnalyzer;
  private buildCache: BuildCache;
  private options: IncrementalBuildOptions;

  /**
   * Creates a new IncrementalBuilder rooted at the given path.
   *
   * @param rootPath - Absolute or relative path to the project root.
   * @param options - Partial overrides for the default build options.
   */
  constructor(rootPath: string, options: Partial<IncrementalBuildOptions> = {}) {
    this.rootPath = path.resolve(rootPath);
    this.changeDetector = new ChangeDetector(rootPath);
    this.impactAnalyzer = new ChangeImpactAnalyzer(rootPath);
    this.buildCache = {
      version: '1.0',
      builds: {}
    };
    this.options = {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      maxParallelBuilds: Math.max(1, Math.floor(require('os').cpus().length / 2)),
      enableCache: true,
      cacheLocation: path.join(rootPath, '.re-shell', 'build-cache.json'),
      cleanBuild: false,
      dryRun: false,
      verbose: false,
      skipTests: false,
      failFast: true,
      buildTimeout: 300000, // 5 minutes
      ...options
    };
  }

  /**
   * Initializes the builder by initializing the change detector, impact
   * analyzer, and loading the persistent build cache from disk.
   *
   * @returns A promise that resolves once initialization is complete.
   */
  async initialize(): Promise<void> {
    await this.changeDetector.initialize();
    await this.impactAnalyzer.initialize();
    await this.loadBuildCache();
  }

  /**
   * Creates an optimized build plan for the project, taking into account the
   * provided or detected file changes, inter-target dependencies, cache
   * validity, and the configured build options.
   *
   * @param changedFiles - Optional explicit list of changed files. If omitted,
   *   changes are detected automatically via the change detector.
   * @returns A BuildPlan describing which targets to build and how.
   * @throws {ValidationError} If a circular dependency is detected while
   *   computing the build order.
   */
  async createBuildPlan(changedFiles?: string[]): Promise<BuildPlan> {
    const targets = await this.discoverBuildTargets();
    
    // Get changed files if not provided
    let files = changedFiles;
    if (!files) {
      const changeResult = await this.changeDetector.detectChanges();
      files = [...changeResult.added, ...changeResult.modified];
    }

    // Analyze impact to determine which targets need rebuilding
    const impact = await this.impactAnalyzer.analyzeChangeImpact(files);
    const affectedTargets = new Set(impact.affectedWorkspaces.map(ws => ws.name));

    // Filter targets that need rebuilding
    const targetsToRebuild = targets.filter(target => {
      // Always rebuild if clean build is requested
      if (this.options.cleanBuild) {
        return true;
      }

      // Rebuild if target is affected by changes
      if (affectedTargets.has(target.name)) {
        return true;
      }

      // Rebuild if cache is invalid
      if (!this.isCacheValid(target)) {
        return true;
      }

      return false;
    });

    // Calculate build order considering dependencies
    const buildOrder = this.calculateOptimalBuildOrder(targetsToRebuild);
    
    // Group targets for parallel execution
    const parallelGroups = this.createParallelGroups(targetsToRebuild, buildOrder);

    // Estimate build time
    const totalEstimatedTime = this.estimateBuildTime(targetsToRebuild);

    // Generate optimization suggestions
    const optimizations = this.generateOptimizations(targetsToRebuild, impact);

    return {
      targets: targetsToRebuild,
      buildOrder,
      parallelGroups,
      totalEstimatedTime,
      optimizations
    };
  }

  /**
   * Executes the given build plan, running each parallel group in sequence and
   * the targets within a group concurrently. Updates the build cache after a
   * successful run. In dry-run mode, only prints what would be built.
   *
   * @param plan - The BuildPlan to execute.
   * @returns An array of BuildResult entries, one per built target.
   * @throws {ValidationError} If fail-fast is enabled and one or more targets
   *   in a group fail to build.
   */
  async executeBuildPlan(plan: BuildPlan): Promise<BuildResult[]> {
    if (this.options.dryRun) {
      console.log('🔍 Dry run - showing what would be built:');
      plan.targets.forEach(target => {
        console.log(`  • ${target.name} (${target.type})`);
      });
      return [];
    }

    const results: BuildResult[] = [];
    const startTime = Date.now();

    console.log(`🚀 Starting incremental build (${plan.targets.length} targets)`);
    console.log(`📊 Estimated time: ${Math.round(plan.totalEstimatedTime / 1000)}s`);
    
    if (plan.optimizations.length > 0) {
      console.log('💡 Optimizations applied:');
      plan.optimizations.forEach(opt => console.log(`  • ${opt}`));
    }

    // Execute parallel groups sequentially
    for (let i = 0; i < plan.parallelGroups.length; i++) {
      const group = plan.parallelGroups[i];
      console.log(`\n📦 Building group ${i + 1}/${plan.parallelGroups.length} (${group.length} targets)`);
      
      // Build targets in parallel within the group
      const groupPromises = group.map(async (targetName) => {
        const target = plan.targets.find(t => t.name === targetName)!;
        return await this.buildTarget(target);
      });

      const groupResults = await Promise.all(groupPromises);
      results.push(...groupResults);

      // Check for failures if fail-fast is enabled
      if (this.options.failFast) {
        const failures = groupResults.filter(r => !r.success);
        if (failures.length > 0) {
          console.log(`❌ Build failed (fail-fast enabled)`);
          throw new ValidationError(`Build failed for targets: ${failures.map(f => f.target).join(', ')}`);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log(`\n✅ Build completed in ${Math.round(totalTime / 1000)}s`);
    console.log(`📊 Results: ${successful} successful, ${failed} failed`);

    // Update build cache
    if (this.options.enableCache) {
      await this.updateBuildCache(results);
    }

    return results;
  }

  /**
   * Builds a single target, returning the cached result if the cache is valid,
   * otherwise executing the target's build script and computing the output size.
   *
   * @param target - The BuildTarget to build.
   * @returns A BuildResult describing the outcome of the build.
   */
  async buildTarget(target: BuildTarget): Promise<BuildResult> {
    const startTime = Date.now();
    
    // Check cache first
    if (this.options.enableCache && this.isCacheValid(target)) {
      if (this.options.verbose) {
        console.log(`🎯 ${target.name}: Using cached build`);
      }
      return {
        target: target.name,
        success: true,
        duration: 0,
        output: 'Cached build',
        cacheHit: true
      };
    }

    if (this.options.verbose) {
      console.log(`🔨 Building ${target.name}...`);
    }

    try {
      const buildResult = await this.executeBuildScript(target);
      const duration = Date.now() - startTime;

      // Calculate output size
      const outputSize = await this.calculateOutputSize(target);

      const result: BuildResult = {
        target: target.name,
        success: buildResult.success,
        duration,
        output: buildResult.output,
        error: buildResult.error,
        outputSize,
        cacheHit: false
      };

      if (result.success && this.options.verbose) {
        console.log(`✅ ${target.name}: Built in ${Math.round(duration / 1000)}s`);
      } else if (!result.success) {
        console.log(`❌ ${target.name}: Build failed`);
        if (this.options.verbose && result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        target: target.name,
        success: false,
        duration,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Execute build script for a target
  private async executeBuildScript(target: BuildTarget): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      const cwd = target.path;
      const command = target.buildScript;
      
      // Detect package manager
      const packageManager = this.detectPackageManager(target.path);
      const [cmd, ...args] = command.split(' ');
      
      const fullCommand = packageManager === 'npm' ? `npm run ${cmd}` : 
                         packageManager === 'yarn' ? `yarn ${cmd}` :
                         packageManager === 'pnpm' ? `pnpm run ${cmd}` :
                         command;

      const [finalCmd, ...finalArgs] = fullCommand.split(' ');

      const child = spawn(finalCmd, finalArgs, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let error = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        error += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output,
          error: `Build timeout after ${this.options.buildTimeout}ms`
        });
      }, this.options.buildTimeout);

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? error : undefined
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          output,
          error: err.message
        });
      });
    });
  }

  // Discover all build targets in the project
  private async discoverBuildTargets(): Promise<BuildTarget[]> {
    const targets: BuildTarget[] = [];
    const workspaces = this.impactAnalyzer.getAllWorkspaces();

    for (const workspace of workspaces) {
      const packageJsonPath = path.join(workspace.path, 'package.json');
      
      if (await fs.pathExists(packageJsonPath)) {
        try {
          const packageJson = await fs.readJson(packageJsonPath);
          const scripts = packageJson.scripts || {};
          
          if (scripts.build) {
            const target: BuildTarget = {
              name: workspace.name,
              path: workspace.path,
              type: workspace.type,
              buildScript: scripts.build,
              testScript: scripts.test,
              dependencies: workspace.dependencies,
              outputs: await this.detectOutputPaths(workspace.path),
              inputs: await this.detectInputPaths(workspace.path),
              lastBuildTime: await this.getLastBuildTime(workspace.path),
              buildHash: await this.calculateBuildHash(workspace.path)
            };
            
            targets.push(target);
          }
        } catch (error) {
          console.warn(`Failed to process ${workspace.name}: ${error}`);
        }
      }
    }

    return targets;
  }

  // Calculate optimal build order
  private calculateOptimalBuildOrder(targets: BuildTarget[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];
    const targetMap = new Map(targets.map(t => [t.name, t]));

    const visit = (targetName: string) => {
      if (visiting.has(targetName)) {
        throw new ValidationError(`Circular dependency detected involving ${targetName}`);
      }
      if (visited.has(targetName)) {
        return;
      }

      const target = targetMap.get(targetName);
      if (!target) return;

      visiting.add(targetName);
      
      // Visit dependencies first
      for (const dep of target.dependencies) {
        if (targetMap.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(targetName);
      visited.add(targetName);
      result.push(targetName);
    };

    for (const target of targets) {
      if (!visited.has(target.name)) {
        visit(target.name);
      }
    }

    return result;
  }

  // Create parallel execution groups
  private createParallelGroups(targets: BuildTarget[], buildOrder: string[]): string[][] {
    const groups: string[][] = [];
    const targetMap = new Map(targets.map(t => [t.name, t]));
    const built = new Set<string>();

    for (const targetName of buildOrder) {
      const target = targetMap.get(targetName);
      if (!target) continue;

      // Check if all dependencies are built
      const dependenciesBuilt = target.dependencies.every(dep => 
        !targetMap.has(dep) || built.has(dep)
      );

      if (dependenciesBuilt) {
        // Add to existing group or create new one
        let addedToGroup = false;
        
        for (const group of groups) {
          if (group.length < this.options.maxParallelBuilds) {
            // Check if this target can be built in parallel with group members
            const canParallelize = group.every(groupMember => {
              const groupTarget = targetMap.get(groupMember);
              return groupTarget && 
                     !target.dependencies.includes(groupMember) &&
                     !groupTarget.dependencies.includes(targetName);
            });

            if (canParallelize) {
              group.push(targetName);
              addedToGroup = true;
              break;
            }
          }
        }

        if (!addedToGroup) {
          groups.push([targetName]);
        }

        built.add(targetName);
      }
    }

    return groups;
  }

  // Estimate total build time
  private estimateBuildTime(targets: BuildTarget[]): number {
    let totalTime = 0;
    
    for (const target of targets) {
      // Use historical data if available
      const cacheEntry = this.buildCache.builds[target.name];
      if (cacheEntry) {
        totalTime += cacheEntry.duration;
      } else {
        // Estimate based on target type and size
        const estimatedTime = this.estimateTargetBuildTime(target);
        totalTime += estimatedTime;
      }
    }

    // Account for parallelization
    const parallelizationFactor = Math.min(this.options.maxParallelBuilds, targets.length);
    return Math.ceil(totalTime / parallelizationFactor);
  }

  // Estimate build time for a single target
  private estimateTargetBuildTime(target: BuildTarget): number {
    // Base estimates in milliseconds
    const baseTime = {
      app: 60000,      // 1 minute
      package: 30000,  // 30 seconds
      lib: 20000,      // 20 seconds
      tool: 10000      // 10 seconds
    };

    let estimate = baseTime[target.type] || 30000;

    // Adjust based on input size
    const inputCount = target.inputs.length;
    if (inputCount > 100) {
      estimate *= 1.5;
    } else if (inputCount > 50) {
      estimate *= 1.2;
    }

    return estimate;
  }

  // Generate optimization suggestions
  private generateOptimizations(targets: BuildTarget[], impact: any): string[] {
    const optimizations: string[] = [];

    if (targets.length === 0) {
      optimizations.push('No targets need rebuilding - all caches are valid');
      return optimizations;
    }

    // Cache optimizations
    const cacheHits = targets.filter(t => this.isCacheValid(t)).length;
    if (cacheHits > 0) {
      optimizations.push(`${cacheHits} targets using cached builds`);
    }

    // Parallel build optimization
    if (this.options.maxParallelBuilds > 1) {
      optimizations.push(`Parallel builds enabled (max ${this.options.maxParallelBuilds})`);
    }

    // Change-based optimization
    if (impact.totalImpact < targets.length) {
      optimizations.push(`Smart rebuilds: only ${impact.totalImpact} of ${targets.length} workspaces affected`);
    }

    // Type-based optimization
    const typeGroups = targets.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (typeGroups.package && typeGroups.app) {
      optimizations.push('Building packages before apps for optimal dependency resolution');
    }

    return optimizations;
  }

  // Check if build cache is valid for target
  private isCacheValid(target: BuildTarget): boolean {
    if (!this.options.enableCache) {
      return false;
    }

    const cacheEntry = this.buildCache.builds[target.name];
    if (!cacheEntry) {
      return false;
    }

    // Check if hash matches
    if (cacheEntry.hash !== target.buildHash) {
      return false;
    }

    // Check if outputs exist
    return target.outputs.every(output => {
      const outputPath = path.resolve(target.path, output);
      return fs.existsSync(outputPath);
    });
  }

  // Detect package manager for target
  private detectPackageManager(targetPath: string): string {
    if (fs.existsSync(path.join(targetPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(targetPath, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }

  // Detect output paths for target
  private async detectOutputPaths(targetPath: string): Promise<string[]> {
    const commonOutputs = ['dist', 'build', 'lib', 'out'];
    const outputs: string[] = [];

    for (const output of commonOutputs) {
      const outputPath = path.join(targetPath, output);
      if (await fs.pathExists(outputPath)) {
        outputs.push(output);
      }
    }

    return outputs.length > 0 ? outputs : ['dist']; // Default to dist
  }

  // Detect input paths for target
  private async detectInputPaths(targetPath: string): Promise<string[]> {
    const inputs: string[] = [];
    const srcPath = path.join(targetPath, 'src');
    
    if (await fs.pathExists(srcPath)) {
      const srcFiles = await this.getFilesRecursive(srcPath);
      inputs.push(...srcFiles.map(f => path.relative(targetPath, f)));
    }

    // Add package.json and config files
    const configFiles = ['package.json', 'tsconfig.json', 'vite.config.ts', 'webpack.config.js'];
    for (const configFile of configFiles) {
      const configPath = path.join(targetPath, configFile);
      if (await fs.pathExists(configPath)) {
        inputs.push(configFile);
      }
    }

    return inputs;
  }

  // Get files recursively from directory
  private async getFilesRecursive(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          files.push(...await this.getFilesRecursive(fullPath));
        }
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  // Get last build time for target
  private async getLastBuildTime(targetPath: string): Promise<number | undefined> {
    const outputDirs = ['dist', 'build', 'lib'];
    
    for (const outputDir of outputDirs) {
      const outputPath = path.join(targetPath, outputDir);
      if (await fs.pathExists(outputPath)) {
        const stats = await fs.stat(outputPath);
        return stats.mtime.getTime();
      }
    }
    
    return undefined;
  }

  // Calculate build hash for target
  private async calculateBuildHash(targetPath: string): Promise<string> {
    const inputs = await this.detectInputPaths(targetPath);
    const hashes: string[] = [];
    
    for (const input of inputs) {
      const inputPath = path.join(targetPath, input);
      if (await fs.pathExists(inputPath)) {
        const fileHash = await this.changeDetector.getFileHash(input);
        if (fileHash) {
          hashes.push(fileHash.hash);
        }
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('crypto').createHash('md5').update(hashes.join('')).digest('hex');
  }

  // Calculate output size for target
  private async calculateOutputSize(target: BuildTarget): Promise<number> {
    let totalSize = 0;
    
    for (const output of target.outputs) {
      const outputPath = path.resolve(target.path, output);
      if (await fs.pathExists(outputPath)) {
        const stats = await fs.stat(outputPath);
        if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(outputPath);
        } else {
          totalSize += stats.size;
        }
      }
    }
    
    return totalSize;
  }

  // Get directory size recursively
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        totalSize += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }

  // Load build cache from disk
  private async loadBuildCache(): Promise<void> {
    if (!this.options.enableCache) {
      return;
    }

    try {
      if (await fs.pathExists(this.options.cacheLocation)) {
        this.buildCache = await fs.readJson(this.options.cacheLocation);
      }
    } catch (error) {
      console.warn(`Failed to load build cache: ${error}`);
      this.buildCache = { version: '1.0', builds: {} };
    }
  }

  // Save build cache to disk
  private async saveBuildCache(): Promise<void> {
    if (!this.options.enableCache) {
      return;
    }

    try {
      await fs.ensureDir(path.dirname(this.options.cacheLocation));
      await fs.writeJson(this.options.cacheLocation, this.buildCache, { spaces: 2 });
    } catch (error) {
      console.warn(`Failed to save build cache: ${error}`);
    }
  }

  // Update build cache with results
  private async updateBuildCache(results: BuildResult[]): Promise<void> {
    for (const result of results) {
      if (result.success && !result.cacheHit) {
        const target = (await this.discoverBuildTargets()).find(t => t.name === result.target);
        if (target) {
          this.buildCache.builds[result.target] = {
            hash: target.buildHash!,
            timestamp: Date.now(),
            duration: result.duration,
            success: result.success,
            outputSize: result.outputSize || 0
          };
        }
      }
    }

    await this.saveBuildCache();
  }

  /**
   * Returns summary statistics derived from the current build cache, including
   * total number of cached builds, cache hit rate, average build time, and the
   * cumulative size of cached outputs.
   *
   * @returns An object with totalBuilds, cacheHitRate, averageBuildTime, and
   *   totalCacheSize fields.
   */
  getBuildStats(): {
    totalBuilds: number;
    cacheHitRate: number;
    averageBuildTime: number;
    totalCacheSize: number;
  } {
    const builds = Object.values(this.buildCache.builds);
    const totalBuilds = builds.length;
    const successfulBuilds = builds.filter(b => b.success);
    
    const averageBuildTime = successfulBuilds.length > 0 
      ? successfulBuilds.reduce((sum, b) => sum + b.duration, 0) / successfulBuilds.length
      : 0;

    const totalCacheSize = builds.reduce((sum, b) => sum + b.outputSize, 0);

    return {
      totalBuilds,
      cacheHitRate: totalBuilds > 0 ? (successfulBuilds.length / totalBuilds) * 100 : 0,
      averageBuildTime,
      totalCacheSize
    };
  }

  /**
   * Clears the in-memory build cache and removes the persistent cache file
   * from disk if it exists.
   *
   * @returns A promise that resolves once the cache has been cleared.
   */
  async clearCache(): Promise<void> {
    this.buildCache = { version: '1.0', builds: {} };
    
    if (await fs.pathExists(this.options.cacheLocation)) {
      await fs.remove(this.options.cacheLocation);
    }
  }
}

/**
 * Convenience factory that constructs an IncrementalBuilder for the given root
 * path, initializes it, and returns the ready-to-use instance.
 *
 * @param rootPath - Absolute or relative path to the project root.
 * @param options - Optional partial overrides for the default build options.
 * @returns A promise that resolves to an initialized IncrementalBuilder.
 */
export async function createIncrementalBuilder(rootPath: string, options?: Partial<IncrementalBuildOptions>): Promise<IncrementalBuilder> {
  const builder = new IncrementalBuilder(rootPath, options);
  await builder.initialize();
  return builder;
}

/**
 * Convenience helper that runs a full incremental build for the given project
 * root: it creates the builder, computes a build plan for the changed files,
 * and executes that plan.
 *
 * @param rootPath - Absolute or relative path to the project root.
 * @param changedFiles - Optional explicit list of changed files. If omitted,
 *   changes are detected automatically.
 * @param options - Optional partial overrides for the default build options.
 * @returns A promise that resolves to the BuildResult entries produced by the
 *   build.
 */
export async function runIncrementalBuild(rootPath: string, changedFiles?: string[], options?: Partial<IncrementalBuildOptions>): Promise<BuildResult[]> {
  const builder = await createIncrementalBuilder(rootPath, options);
  const plan = await builder.createBuildPlan(changedFiles);
  return await builder.executeBuildPlan(plan);
}