import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import { ValidationError } from './error-handler';
import { ChangeDetector } from './change-detector';
import { ChangeImpactAnalyzer } from './change-impact-analyzer';

export interface BuildTarget {
  name: string;
  path: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  buildScript: string;
  testScript?: string;
  dependencies: string[];
  outputs: string[];
  inputs: string[];
  lastBuildTime?: number;
  buildHash?: string;
}

export interface BuildPlan {
  targets: BuildTarget[];
  buildOrder: string[];
  parallelGroups: string[][];
  totalEstimatedTime: number;
  optimizations: string[];
}

export interface BuildResult {
  target: string;
  success: boolean;
  duration: number;
  output: string;
  error?: string;
  outputSize?: number;
  cacheHit?: boolean;
}

export interface IncrementalBuildOptions {
  maxParallelBuilds: number;
  enableCache: boolean;
  cacheLocation: string;
  cleanBuild: boolean;
  dryRun: boolean;
  verbose: boolean;
  skipTests: boolean;
  failFast: boolean;
  buildTimeout: number;
}

export interface BuildCache {
  version: string;
  builds: Record<string, {
    hash: string;
    timestamp: number;
    duration: number;
    success: boolean;
    outputSize: number;
  }>;
}

// Incremental build optimizer
export class IncrementalBuilder {
  private rootPath: string;
  private changeDetector: ChangeDetector;
  private impactAnalyzer: ChangeImpactAnalyzer;
  private buildCache: BuildCache;
  private options: IncrementalBuildOptions;

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

  // Initialize the incremental builder
  async initialize(): Promise<void> {
    await this.changeDetector.initialize();
    await this.impactAnalyzer.initialize();
    await this.loadBuildCache();
  }

  // Create optimized build plan based on changes
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

  // Execute incremental build plan
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

  // Build a specific target
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

  // Get build statistics
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

  // Clear build cache
  async clearCache(): Promise<void> {
    this.buildCache = { version: '1.0', builds: {} };
    
    if (await fs.pathExists(this.options.cacheLocation)) {
      await fs.remove(this.options.cacheLocation);
    }
  }
}

// Utility functions
export async function createIncrementalBuilder(rootPath: string, options?: Partial<IncrementalBuildOptions>): Promise<IncrementalBuilder> {
  const builder = new IncrementalBuilder(rootPath, options);
  await builder.initialize();
  return builder;
}

export async function runIncrementalBuild(rootPath: string, changedFiles?: string[], options?: Partial<IncrementalBuildOptions>): Promise<BuildResult[]> {
  const builder = await createIncrementalBuilder(rootPath, options);
  const plan = await builder.createBuildPlan(changedFiles);
  return await builder.executeBuildPlan(plan);
}