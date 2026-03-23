import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as semver from 'semver';
import { execSync } from 'child_process';

export interface Dependency {
  name: string;
  version: string;
  resolved?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  source?: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
  parent?: string;
  depth?: number;
}

export interface DependencyConflict {
  name: string;
  type: ConflictType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  packages: ConflictingPackage[];
  description: string;
  impact: string[];
  resolutions: Resolution[];
  autoResolvable: boolean;
}

export enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',
  PEER_DEPENDENCY_UNMET = 'peer_dependency_unmet',
  DUPLICATE_PACKAGE = 'duplicate_package',
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  INCOMPATIBLE_ENGINES = 'incompatible_engines',
  LICENSE_CONFLICT = 'license_conflict',
  SECURITY_VULNERABILITY = 'security_vulnerability',
  DEPRECATED_PACKAGE = 'deprecated_package'
}

export interface ConflictingPackage {
  name: string;
  version: string;
  requiredBy: string[];
  location?: string;
  constraints?: string[];
}

export interface Resolution {
  type: 'upgrade' | 'downgrade' | 'override' | 'alias' | 'remove' | 'replace';
  description: string;
  command?: string;
  config?: any;
  risk: 'low' | 'medium' | 'high';
  automated: boolean;
  steps?: string[];
}

export interface DependencyTree {
  name: string;
  version: string;
  dependencies: Map<string, DependencyTree>;
  parent?: DependencyTree;
  conflicts?: DependencyConflict[];
}

export interface ConflictDetectionOptions {
  checkPeerDependencies?: boolean;
  checkEngines?: boolean;
  checkLicenses?: boolean;
  checkSecurity?: boolean;
  checkCircular?: boolean;
  maxDepth?: number;
  includeDevDependencies?: boolean;
  includeOptionalDependencies?: boolean;
  strictVersioning?: boolean;
}

export interface ConflictReport {
  conflicts: DependencyConflict[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoResolvable: number;
  };
  dependencyTree?: DependencyTree;
  recommendations: string[];
  healthScore: number; // 0-100
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  engines?: Record<string, string>;
  license?: string;
  deprecated?: boolean;
  repository?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export class DependencyConflictDetector extends EventEmitter {
  private packageCache: Map<string, PackageInfo> = new Map();
  private dependencyTree?: DependencyTree;
  private visitedPackages: Set<string> = new Set();
  private licenseCompatibility: Map<string, string[]> = new Map();
  
  private readonly defaultOptions: ConflictDetectionOptions = {
    checkPeerDependencies: true,
    checkEngines: true,
    checkLicenses: true,
    checkSecurity: true,
    checkCircular: true,
    maxDepth: 10,
    includeDevDependencies: false,
    includeOptionalDependencies: false,
    strictVersioning: false
  };

  constructor() {
    super();
    this.initializeLicenseCompatibility();
  }

  private initializeLicenseCompatibility(): void {
    // Define license compatibility rules
    this.licenseCompatibility.set('MIT', ['MIT', 'ISC', 'BSD', 'Apache-2.0', 'CC0-1.0']);
    this.licenseCompatibility.set('Apache-2.0', ['MIT', 'ISC', 'BSD', 'Apache-2.0']);
    this.licenseCompatibility.set('GPL-3.0', ['GPL-3.0', 'AGPL-3.0']);
    this.licenseCompatibility.set('ISC', ['MIT', 'ISC', 'BSD', 'Apache-2.0']);
    this.licenseCompatibility.set('BSD', ['MIT', 'ISC', 'BSD', 'Apache-2.0']);
  }

  async detectConflicts(
    projectPath: string,
    options: ConflictDetectionOptions = {}
  ): Promise<ConflictReport> {
    this.emit('detection:start', { projectPath, options });

    const opts = { ...this.defaultOptions, ...options };
    const conflicts: DependencyConflict[] = [];
    
    try {
      // Load package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (!await fs.pathExists(packageJsonPath)) {
        throw new Error('No package.json found in project');
      }

      const packageJson = await fs.readJson(packageJsonPath);
      
      // Build dependency tree
      this.dependencyTree = await this.buildDependencyTree(projectPath, packageJson, opts);
      
      // Detect various types of conflicts
      if (opts.checkPeerDependencies) {
        const peerConflicts = await this.detectPeerDependencyConflicts(this.dependencyTree, opts);
        conflicts.push(...peerConflicts);
      }

      const versionConflicts = await this.detectVersionConflicts(this.dependencyTree, opts);
      conflicts.push(...versionConflicts);

      const duplicates = await this.detectDuplicatePackages(this.dependencyTree, opts);
      conflicts.push(...duplicates);

      if (opts.checkCircular) {
        const circular = await this.detectCircularDependencies(this.dependencyTree, opts);
        conflicts.push(...circular);
      }

      if (opts.checkEngines) {
        const engineConflicts = await this.detectEngineConflicts(this.dependencyTree, opts);
        conflicts.push(...engineConflicts);
      }

      if (opts.checkLicenses) {
        const licenseConflicts = await this.detectLicenseConflicts(this.dependencyTree, opts);
        conflicts.push(...licenseConflicts);
      }

      if (opts.checkSecurity) {
        const securityIssues = await this.detectSecurityVulnerabilities(projectPath, opts);
        conflicts.push(...securityIssues);
      }

      // Generate report
      const report = this.generateReport(conflicts, this.dependencyTree);
      
      this.emit('detection:complete', report);
      return report;

    } catch (error) {
      this.emit('detection:error', error);
      throw error;
    }
  }

  private async buildDependencyTree(
    projectPath: string,
    packageJson: any,
    options: ConflictDetectionOptions,
    parent?: DependencyTree,
    depth = 0
  ): Promise<DependencyTree> {
    if (depth > (options.maxDepth || 10)) {
      return {
        name: packageJson.name,
        version: packageJson.version,
        dependencies: new Map(),
        parent
      };
    }

    const tree: DependencyTree = {
      name: packageJson.name,
      version: packageJson.version,
      dependencies: new Map(),
      parent
    };

    // Collect all dependencies
    const allDeps: Record<string, string> = {
      ...packageJson.dependencies,
      ...(options.includeDevDependencies ? packageJson.devDependencies : {}),
      ...(options.includeOptionalDependencies ? packageJson.optionalDependencies : {})
    };

    // Process each dependency
    for (const [depName, depVersion] of Object.entries(allDeps)) {
      const key = `${depName}@${depVersion}`;
      
      // Avoid circular references
      if (this.visitedPackages.has(key)) {
        continue;
      }
      
      this.visitedPackages.add(key);

      try {
        const depInfo = await this.getPackageInfo(depName, depVersion as string, projectPath);
        if (depInfo) {
          const subTree = await this.buildDependencyTree(
            projectPath,
            depInfo,
            options,
            tree,
            depth + 1
          );
          tree.dependencies.set(depName, subTree);
        }
      } catch (error) {
        // Package not found or error loading
        this.emit('dependency:error', { name: depName, version: depVersion, error });
      }
    }

    return tree;
  }

  private async getPackageInfo(
    name: string,
    version: string,
    projectPath: string
  ): Promise<PackageInfo | null> {
    const cacheKey = `${name}@${version}`;
    
    if (this.packageCache.has(cacheKey)) {
      return this.packageCache.get(cacheKey)!;
    }

    try {
      // Try to load from node_modules
      const packagePath = path.join(projectPath, 'node_modules', name, 'package.json');
      if (await fs.pathExists(packagePath)) {
        const packageJson = await fs.readJson(packagePath);
        const info: PackageInfo = {
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          engines: packageJson.engines,
          license: packageJson.license,
          deprecated: packageJson.deprecated,
          repository: packageJson.repository,
          dependencies: packageJson.dependencies,
          peerDependencies: packageJson.peerDependencies,
          devDependencies: packageJson.devDependencies,
          optionalDependencies: packageJson.optionalDependencies
        };
        
        this.packageCache.set(cacheKey, info);
        return info;
      }

      // If not in node_modules, try npm view (slower)
      const npmInfo = await this.getNpmPackageInfo(name, version);
      if (npmInfo) {
        this.packageCache.set(cacheKey, npmInfo);
        return npmInfo;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async getNpmPackageInfo(name: string, version: string): Promise<PackageInfo | null> {
    try {
      const output = execSync(`npm view ${name}@${version} --json`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      
      const data = JSON.parse(output);
      return {
        name: data.name,
        version: data.version,
        description: data.description,
        engines: data.engines,
        license: data.license,
        deprecated: data.deprecated,
        repository: data.repository,
        dependencies: data.dependencies,
        peerDependencies: data.peerDependencies,
        devDependencies: data.devDependencies,
        optionalDependencies: data.optionalDependencies
      };
    } catch {
      return null;
    }
  }

  private async detectVersionConflicts(
    tree: DependencyTree,
    options: ConflictDetectionOptions
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const versionMap: Map<string, Array<{ version: string; requiredBy: string[] }>> = new Map();

    // Collect all versions of each package
    this.collectVersions(tree, versionMap);

    // Find conflicts
    for (const [packageName, versions] of versionMap) {
      if (versions.length <= 1) continue;

      // Check if versions are compatible
      const uniqueVersions = [...new Set(versions.map(v => v.version))];
      
      if (uniqueVersions.length > 1) {
        const incompatible = this.findIncompatibleVersions(uniqueVersions, options.strictVersioning);
        
        if (incompatible.length > 0) {
          const conflict: DependencyConflict = {
            name: packageName,
            type: ConflictType.VERSION_MISMATCH,
            severity: this.calculateVersionConflictSeverity(incompatible),
            packages: versions.map(v => ({
              name: packageName,
              version: v.version,
              requiredBy: v.requiredBy
            })),
            description: `Multiple incompatible versions of ${packageName} detected`,
            impact: [
              'May cause runtime errors',
              'Increased bundle size',
              'Unpredictable behavior'
            ],
            resolutions: this.generateVersionResolutions(packageName, versions, incompatible),
            autoResolvable: true
          };
          
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  private collectVersions(
    tree: DependencyTree,
    versionMap: Map<string, Array<{ version: string; requiredBy: string[] }>>,
    parentPath = ''
  ): void {
    const currentPath = parentPath ? `${parentPath} > ${tree.name}` : tree.name;

    for (const [depName, depTree] of tree.dependencies) {
      if (!versionMap.has(depName)) {
        versionMap.set(depName, []);
      }

      const versions = versionMap.get(depName)!;
      const existing = versions.find(v => v.version === depTree.version);
      
      if (existing) {
        existing.requiredBy.push(currentPath);
      } else {
        versions.push({
          version: depTree.version,
          requiredBy: [currentPath]
        });
      }

      // Recurse
      this.collectVersions(depTree, versionMap, currentPath);
    }
  }

  private findIncompatibleVersions(versions: string[], strict?: boolean): string[] {
    if (strict) {
      // In strict mode, all different versions are incompatible
      return versions.length > 1 ? versions : [];
    }

    const incompatible: string[] = [];
    
    for (let i = 0; i < versions.length; i++) {
      for (let j = i + 1; j < versions.length; j++) {
        if (!semver.intersects(versions[i], versions[j])) {
          if (!incompatible.includes(versions[i])) incompatible.push(versions[i]);
          if (!incompatible.includes(versions[j])) incompatible.push(versions[j]);
        }
      }
    }

    return incompatible;
  }

  private calculateVersionConflictSeverity(incompatibleVersions: string[]): 'critical' | 'high' | 'medium' | 'low' {
    if (incompatibleVersions.length > 3) return 'critical';
    
    // Check if major versions differ
    const majorVersions = incompatibleVersions.map(v => semver.major(v));
    const uniqueMajors = [...new Set(majorVersions)];
    
    if (uniqueMajors.length > 1) return 'high';
    
    // Check if minor versions differ significantly
    const minorVersions = incompatibleVersions.map(v => semver.minor(v));
    const minorDiff = Math.max(...minorVersions) - Math.min(...minorVersions);
    
    if (minorDiff > 5) return 'medium';
    
    return 'low';
  }

  private generateVersionResolutions(
    packageName: string,
    versions: Array<{ version: string; requiredBy: string[] }>,
    incompatible: string[]
  ): Resolution[] {
    const resolutions: Resolution[] = [];
    
    // Find the most recent compatible version
    const allVersions = versions.map(v => v.version);
    const latestVersion = allVersions.sort(semver.rcompare)[0];
    
    // Resolution 1: Upgrade all to latest
    resolutions.push({
      type: 'upgrade',
      description: `Upgrade all instances to ${latestVersion}`,
      command: `npm install ${packageName}@${latestVersion}`,
      risk: 'medium',
      automated: true,
      steps: [
        `Update package.json to use ${packageName}@${latestVersion}`,
        'Run npm install',
        'Test thoroughly for breaking changes'
      ]
    });

    // Resolution 2: Use resolutions/overrides
    resolutions.push({
      type: 'override',
      description: 'Force a single version using package manager overrides',
      config: {
        npm: {
          overrides: {
            [packageName]: latestVersion
          }
        },
        yarn: {
          resolutions: {
            [packageName]: latestVersion
          }
        },
        pnpm: {
          overrides: {
            [packageName]: latestVersion
          }
        }
      },
      risk: 'high',
      automated: true,
      steps: [
        'Add overrides/resolutions to package.json',
        'Delete node_modules and lock file',
        'Reinstall dependencies'
      ]
    });

    // Resolution 3: Find a compatible version range
    const compatibleRange = this.findCompatibleRange(allVersions);
    if (compatibleRange) {
      resolutions.push({
        type: 'downgrade',
        description: `Use compatible version range ${compatibleRange}`,
        command: `npm install ${packageName}@"${compatibleRange}"`,
        risk: 'low',
        automated: true
      });
    }

    return resolutions;
  }

  private findCompatibleRange(versions: string[]): string | null {
    // Try to find a version range that satisfies all
    for (const version of versions) {
      const range = `^${version}`;
      if (versions.every(v => semver.satisfies(v, range))) {
        return range;
      }
    }

    // Try with tilde
    for (const version of versions) {
      const range = `~${version}`;
      if (versions.every(v => semver.satisfies(v, range))) {
        return range;
      }
    }

    return null;
  }

  private async detectPeerDependencyConflicts(
    tree: DependencyTree,
    options: ConflictDetectionOptions
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const peerDeps: Map<string, Array<{ 
      package: string; 
      required: string; 
      requiredBy: string;
      installed?: string;
    }>> = new Map();

    // Collect all peer dependencies
    await this.collectPeerDependencies(tree, peerDeps);

    // Check if peer dependencies are satisfied
    for (const [depName, requirements] of peerDeps) {
      const installed = this.findInstalledVersion(tree, depName);
      const unmet = requirements.filter(req => {
        if (!installed) return true;
        return !semver.satisfies(installed, req.required);
      });

      if (unmet.length > 0) {
        const conflict: DependencyConflict = {
          name: depName,
          type: ConflictType.PEER_DEPENDENCY_UNMET,
          severity: 'high',
          packages: unmet.map(u => ({
            name: depName,
            version: u.required,
            requiredBy: [u.requiredBy],
            constraints: [u.required]
          })),
          description: `Peer dependency ${depName} is not satisfied`,
          impact: [
            'Package may not function correctly',
            'Runtime errors possible',
            'Feature incompatibility'
          ],
          resolutions: this.generatePeerDependencyResolutions(depName, unmet, installed),
          autoResolvable: true
        };

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  private async collectPeerDependencies(
    tree: DependencyTree,
    peerDeps: Map<string, Array<{ package: string; required: string; requiredBy: string }>>,
    path = ''
  ): Promise<void> {
    const currentPath = path ? `${path} > ${tree.name}` : tree.name;
    
    // Get package info from cache
    const packageInfo = this.packageCache.get(`${tree.name}@${tree.version}`);
    
    if (packageInfo?.peerDependencies) {
      for (const [depName, depVersion] of Object.entries(packageInfo.peerDependencies)) {
        if (!peerDeps.has(depName)) {
          peerDeps.set(depName, []);
        }
        
        peerDeps.get(depName)!.push({
          package: tree.name,
          required: depVersion,
          requiredBy: currentPath
        });
      }
    }

    // Recurse through dependencies
    for (const [_, depTree] of tree.dependencies) {
      await this.collectPeerDependencies(depTree, peerDeps, currentPath);
    }
  }

  private findInstalledVersion(tree: DependencyTree, packageName: string): string | null {
    // Check direct dependencies
    const directDep = tree.dependencies.get(packageName);
    if (directDep) {
      return directDep.version;
    }

    // Check nested dependencies
    for (const [_, depTree] of tree.dependencies) {
      const version = this.findInstalledVersion(depTree, packageName);
      if (version) return version;
    }

    return null;
  }

  private generatePeerDependencyResolutions(
    packageName: string,
    unmet: Array<{ package: string; required: string; requiredBy: string }>,
    installed: string | null
  ): Resolution[] {
    const resolutions: Resolution[] = [];

    // Find a version that satisfies all requirements
    const allConstraints = unmet.map(u => u.required);
    const satisfyingVersion = this.findSatisfyingVersion(allConstraints);

    if (satisfyingVersion) {
      resolutions.push({
        type: 'upgrade',
        description: `Install ${packageName}@${satisfyingVersion} to satisfy all peer dependencies`,
        command: `npm install ${packageName}@${satisfyingVersion}`,
        risk: 'low',
        automated: true
      });
    }

    // Add as direct dependency
    resolutions.push({
      type: 'upgrade',
      description: `Add ${packageName} as a direct dependency`,
      command: `npm install ${packageName}`,
      risk: 'medium',
      automated: true,
      steps: [
        'This will add the package to your dependencies',
        'May increase bundle size',
        'Ensures peer dependency is always available'
      ]
    });

    // Suggest updating the requiring packages
    const requiringPackages = [...new Set(unmet.map(u => u.package))];
    resolutions.push({
      type: 'upgrade',
      description: `Update packages that require ${packageName}`,
      command: requiringPackages.map(p => `npm update ${p}`).join(' && '),
      risk: 'medium',
      automated: false,
      steps: [
        'Check for updates to requiring packages',
        'They may have relaxed peer dependency requirements',
        'Test thoroughly after updates'
      ]
    });

    return resolutions;
  }

  private findSatisfyingVersion(constraints: string[]): string | null {
    // This is a simplified version finder
    // In production, you'd query npm registry for available versions
    try {
      // Find intersection of all constraints
      let range = constraints[0];
      for (let i = 1; i < constraints.length; i++) {
        const intersection = semver.intersects(range, constraints[i]);
        if (!intersection) return null;
        // This is simplified - in reality, you'd compute the actual intersection
        range = constraints[i];
      }
      
      // Return a version that satisfies the range
      return semver.minVersion(range)?.format() || null;
    } catch {
      return null;
    }
  }

  private async detectDuplicatePackages(
    tree: DependencyTree,
    options: ConflictDetectionOptions
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const packageLocations: Map<string, Array<{
      version: string;
      path: string;
      size?: number;
    }>> = new Map();

    // Collect all package instances
    this.collectPackageLocations(tree, packageLocations);

    // Find duplicates
    for (const [packageName, locations] of packageLocations) {
      if (locations.length <= 1) continue;

      const uniqueVersions = [...new Set(locations.map(l => l.version))];
      
      // Only consider it a duplicate if same version appears multiple times
      if (uniqueVersions.length < locations.length) {
        const conflict: DependencyConflict = {
          name: packageName,
          type: ConflictType.DUPLICATE_PACKAGE,
          severity: 'medium',
          packages: locations.map(l => ({
            name: packageName,
            version: l.version,
            requiredBy: [l.path],
            location: l.path
          })),
          description: `Package ${packageName} is duplicated in multiple locations`,
          impact: [
            'Increased bundle size',
            'Longer install times',
            'Potential version conflicts'
          ],
          resolutions: this.generateDuplicationResolutions(packageName, locations),
          autoResolvable: true
        };

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  private collectPackageLocations(
    tree: DependencyTree,
    locations: Map<string, Array<{ version: string; path: string }>>,
    path = ''
  ): void {
    const currentPath = path ? `${path}/${tree.name}` : tree.name;

    for (const [depName, depTree] of tree.dependencies) {
      if (!locations.has(depName)) {
        locations.set(depName, []);
      }

      locations.get(depName)!.push({
        version: depTree.version,
        path: `${currentPath}/${depName}`
      });

      this.collectPackageLocations(depTree, locations, currentPath);
    }
  }

  private generateDuplicationResolutions(
    packageName: string,
    locations: Array<{ version: string; path: string }>
  ): Resolution[] {
    const resolutions: Resolution[] = [];

    // Deduplicate using npm/yarn
    resolutions.push({
      type: 'upgrade',
      description: 'Deduplicate packages using package manager',
      command: 'npm dedupe',
      risk: 'low',
      automated: true,
      steps: [
        'Runs package manager deduplication',
        'Moves packages to highest common location',
        'Reduces node_modules size'
      ]
    });

    // Use pnpm for better deduplication
    resolutions.push({
      type: 'replace',
      description: 'Switch to pnpm for automatic deduplication',
      command: 'npm install -g pnpm && pnpm import && pnpm install',
      risk: 'medium',
      automated: false,
      steps: [
        'pnpm uses a content-addressable store',
        'Automatically deduplicates packages',
        'Significantly reduces disk usage'
      ]
    });

    return resolutions;
  }

  private async detectCircularDependencies(
    tree: DependencyTree,
    options: ConflictDetectionOptions
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    // DFS to detect cycles
    this.detectCycles(tree, visited, recursionStack, [], cycles);

    // Convert cycles to conflicts
    for (const cycle of cycles) {
      const conflict: DependencyConflict = {
        name: cycle.join(' → '),
        type: ConflictType.CIRCULAR_DEPENDENCY,
        severity: 'high',
        packages: cycle.map(pkg => ({
          name: pkg,
          version: '',
          requiredBy: []
        })),
        description: `Circular dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
        impact: [
          'Can cause initialization issues',
          'Makes code harder to maintain',
          'May prevent proper module loading',
          'Complicates testing'
        ],
        resolutions: this.generateCircularDependencyResolutions(cycle),
        autoResolvable: false
      };

      conflicts.push(conflict);
    }

    return conflicts;
  }

  private detectCycles(
    tree: DependencyTree,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    const nodeId = `${tree.name}@${tree.version}`;
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(tree.name);

    for (const [depName, depTree] of tree.dependencies) {
      const depId = `${depTree.name}@${depTree.version}`;
      
      if (!visited.has(depId)) {
        this.detectCycles(depTree, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(depId)) {
        // Found a cycle
        const cycleStart = path.indexOf(depTree.name);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        }
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
  }

  private generateCircularDependencyResolutions(cycle: string[]): Resolution[] {
    return [
      {
        type: 'remove',
        description: 'Refactor code to break circular dependency',
        risk: 'high',
        automated: false,
        steps: [
          'Identify the coupling between modules',
          'Extract shared code to a separate module',
          'Use dependency injection or events',
          'Consider restructuring module boundaries'
        ]
      },
      {
        type: 'replace',
        description: 'Use dynamic imports to break the cycle',
        risk: 'medium',
        automated: false,
        steps: [
          'Convert static imports to dynamic imports',
          'Load modules on-demand',
          'May impact performance and type safety'
        ]
      }
    ];
  }

  private async detectEngineConflicts(
    tree: DependencyTree,
    options: ConflictDetectionOptions
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const currentNode = process.version;
    const currentNpm = await this.getNpmVersion();

    const engineRequirements: Array<{
      package: string;
      engines: Record<string, string>;
      path: string;
    }> = [];

    // Collect all engine requirements
    this.collectEngineRequirements(tree, engineRequirements);

    // Check Node.js version conflicts
    const nodeConflicts = engineRequirements.filter(req => {
      if (!req.engines.node) return false;
      return !semver.satisfies(currentNode, req.engines.node);
    });

    if (nodeConflicts.length > 0) {
      conflicts.push({
        name: 'Node.js version',
        type: ConflictType.INCOMPATIBLE_ENGINES,
        severity: 'critical',
        packages: nodeConflicts.map(c => ({
          name: c.package,
          version: '',
          requiredBy: [c.path],
          constraints: [`node ${c.engines.node}`]
        })),
        description: `Current Node.js version (${currentNode}) incompatible with package requirements`,
        impact: [
          'Packages may not work correctly',
          'Build failures possible',
          'Runtime errors likely'
        ],
        resolutions: this.generateEngineResolutions('node', currentNode, nodeConflicts),
        autoResolvable: false
      });
    }

    // Check npm version conflicts
    const npmConflicts = engineRequirements.filter(req => {
      if (!req.engines.npm || !currentNpm) return false;
      return !semver.satisfies(currentNpm, req.engines.npm);
    });

    if (npmConflicts.length > 0) {
      conflicts.push({
        name: 'npm version',
        type: ConflictType.INCOMPATIBLE_ENGINES,
        severity: 'high',
        packages: npmConflicts.map(c => ({
          name: c.package,
          version: '',
          requiredBy: [c.path],
          constraints: [`npm ${c.engines.npm}`]
        })),
        description: `Current npm version (${currentNpm}) incompatible with package requirements`,
        impact: [
          'Installation may fail',
          'Package scripts may not work'
        ],
        resolutions: this.generateEngineResolutions('npm', currentNpm || '', npmConflicts),
        autoResolvable: true
      });
    }

    return conflicts;
  }

  private collectEngineRequirements(
    tree: DependencyTree,
    requirements: Array<{ package: string; engines: Record<string, string>; path: string }>,
    path = ''
  ): void {
    const currentPath = path ? `${path} > ${tree.name}` : tree.name;
    const packageInfo = this.packageCache.get(`${tree.name}@${tree.version}`);

    if (packageInfo?.engines) {
      requirements.push({
        package: tree.name,
        engines: packageInfo.engines,
        path: currentPath
      });
    }

    for (const [_, depTree] of tree.dependencies) {
      this.collectEngineRequirements(depTree, requirements, currentPath);
    }
  }

  private async getNpmVersion(): Promise<string | null> {
    try {
      return execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  private generateEngineResolutions(
    engine: string,
    current: string,
    conflicts: Array<{ engines: Record<string, string> }>
  ): Resolution[] {
    const resolutions: Resolution[] = [];

    // Find compatible version
    const requirements = conflicts.map(c => c.engines[engine]).filter(Boolean);
    const compatibleVersion = this.findSatisfyingVersion(requirements);

    if (engine === 'node') {
      resolutions.push({
        type: 'upgrade',
        description: `Use nvm to install Node.js ${compatibleVersion || 'LTS'}`,
        command: `nvm install ${compatibleVersion || 'lts/*'} && nvm use ${compatibleVersion || 'lts/*'}`,
        risk: 'medium',
        automated: false,
        steps: [
          'Install nvm if not already installed',
          'Install compatible Node.js version',
          'Switch to the compatible version',
          'Update .nvmrc file in project'
        ]
      });

      resolutions.push({
        type: 'replace',
        description: 'Use Docker to ensure consistent environment',
        risk: 'low',
        automated: false,
        steps: [
          'Create Dockerfile with compatible Node.js version',
          'Use Docker for development and deployment',
          'Ensures environment consistency'
        ]
      });
    } else if (engine === 'npm') {
      resolutions.push({
        type: 'upgrade',
        description: `Update npm to ${compatibleVersion || 'latest'}`,
        command: `npm install -g npm@${compatibleVersion || 'latest'}`,
        risk: 'low',
        automated: true
      });
    }

    return resolutions;
  }

  private async detectLicenseConflicts(
    tree: DependencyTree,
    options: ConflictDetectionOptions
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const projectLicense = tree.name; // Should get from package.json
    
    const licenses: Map<string, Array<{
      package: string;
      license: string;
      path: string;
    }>> = new Map();

    // Collect all licenses
    this.collectLicenses(tree, licenses);

    // Check for incompatible licenses
    const incompatibleLicenses = this.findIncompatibleLicenses(licenses);

    for (const [licenseType, packages] of incompatibleLicenses) {
      conflicts.push({
        name: `${licenseType} license`,
        type: ConflictType.LICENSE_CONFLICT,
        severity: 'high',
        packages: packages.map(p => ({
          name: p.package,
          version: '',
          requiredBy: [p.path]
        })),
        description: `Potentially incompatible ${licenseType} license detected`,
        impact: [
          'Legal compliance issues',
          'May restrict commercial use',
          'Could require source code disclosure'
        ],
        resolutions: this.generateLicenseResolutions(licenseType, packages),
        autoResolvable: false
      });
    }

    return conflicts;
  }

  private collectLicenses(
    tree: DependencyTree,
    licenses: Map<string, Array<{ package: string; license: string; path: string }>>,
    path = ''
  ): void {
    const currentPath = path ? `${path} > ${tree.name}` : tree.name;
    const packageInfo = this.packageCache.get(`${tree.name}@${tree.version}`);

    if (packageInfo?.license) {
      const licenseType = this.normalizeLicense(packageInfo.license);
      
      if (!licenses.has(licenseType)) {
        licenses.set(licenseType, []);
      }
      
      licenses.get(licenseType)!.push({
        package: tree.name,
        license: packageInfo.license,
        path: currentPath
      });
    }

    for (const [_, depTree] of tree.dependencies) {
      this.collectLicenses(depTree, licenses, currentPath);
    }
  }

  private normalizeLicense(license: string): string {
    // Normalize common license variations
    const normalized = license.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    const mapping: Record<string, string> = {
      'MIT': 'MIT',
      'MITLICENSE': 'MIT',
      'APACHE2': 'Apache-2.0',
      'APACHE20': 'Apache-2.0',
      'GPL3': 'GPL-3.0',
      'GPL30': 'GPL-3.0',
      'BSD': 'BSD',
      'BSD3CLAUSE': 'BSD',
      'ISC': 'ISC'
    };

    return mapping[normalized] || license;
  }

  private findIncompatibleLicenses(
    licenses: Map<string, Array<{ package: string; license: string; path: string }>>
  ): Map<string, Array<{ package: string; license: string; path: string }>> {
    const incompatible = new Map();

    // Check for GPL in non-GPL project
    if (licenses.has('GPL-3.0') || licenses.has('AGPL-3.0')) {
      const gplPackages = [
        ...(licenses.get('GPL-3.0') || []),
        ...(licenses.get('AGPL-3.0') || [])
      ];
      
      if (gplPackages.length > 0) {
        incompatible.set('GPL', gplPackages);
      }
    }

    return incompatible;
  }

  private generateLicenseResolutions(
    licenseType: string,
    packages: Array<{ package: string; license: string; path: string }>
  ): Resolution[] {
    const resolutions: Resolution[] = [];

    resolutions.push({
      type: 'replace',
      description: 'Find alternative packages with compatible licenses',
      risk: 'medium',
      automated: false,
      steps: [
        'Research alternative packages',
        'Check license compatibility',
        'Test replacement packages',
        'Update dependencies'
      ]
    });

    resolutions.push({
      type: 'remove',
      description: 'Remove packages with incompatible licenses',
      command: packages.map(p => `npm uninstall ${p.package}`).join(' && '),
      risk: 'high',
      automated: false,
      steps: [
        'Assess impact of removing packages',
        'Find alternative implementations',
        'Remove and test thoroughly'
      ]
    });

    return resolutions;
  }

  private async detectSecurityVulnerabilities(
    projectPath: string,
    options: ConflictDetectionOptions
  ): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];

    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const audit = JSON.parse(auditOutput);
      
      if (audit.vulnerabilities) {
        for (const [packageName, vuln] of Object.entries(audit.vulnerabilities)) {
          const vulnData = vuln as any;
          
          conflicts.push({
            name: packageName,
            type: ConflictType.SECURITY_VULNERABILITY,
            severity: this.mapAuditSeverity(vulnData.severity),
            packages: [{
              name: packageName,
              version: vulnData.range,
              requiredBy: vulnData.via.map((v: any) => 
                typeof v === 'string' ? v : v.name
              )
            }],
            description: vulnData.title || `Security vulnerability in ${packageName}`,
            impact: [
              'Security risk to application',
              'Potential data breach',
              'Compliance issues'
            ],
            resolutions: this.generateSecurityResolutions(packageName, vulnData),
            autoResolvable: vulnData.fixAvailable
          });
        }
      }
    } catch (error) {
      // npm audit failed - not critical
      this.emit('security:check:failed', error);
    }

    return conflicts;
  }

  private mapAuditSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private generateSecurityResolutions(packageName: string, vulnData: any): Resolution[] {
    const resolutions: Resolution[] = [];

    if (vulnData.fixAvailable) {
      resolutions.push({
        type: 'upgrade',
        description: 'Apply automated security fix',
        command: 'npm audit fix',
        risk: 'low',
        automated: true
      });

      resolutions.push({
        type: 'upgrade',
        description: 'Force security updates (may include breaking changes)',
        command: 'npm audit fix --force',
        risk: 'high',
        automated: true,
        steps: [
          'This may update to semver-major versions',
          'Test thoroughly after update',
          'May require code changes'
        ]
      });
    }

    resolutions.push({
      type: 'upgrade',
      description: `Update ${packageName} to patched version`,
      command: `npm update ${packageName}`,
      risk: 'medium',
      automated: true
    });

    return resolutions;
  }

  private generateReport(conflicts: DependencyConflict[], tree?: DependencyTree): ConflictReport {
    const summary = {
      total: conflicts.length,
      critical: conflicts.filter(c => c.severity === 'critical').length,
      high: conflicts.filter(c => c.severity === 'high').length,
      medium: conflicts.filter(c => c.severity === 'medium').length,
      low: conflicts.filter(c => c.severity === 'low').length,
      autoResolvable: conflicts.filter(c => c.autoResolvable).length
    };

    const recommendations = this.generateRecommendations(conflicts);
    const healthScore = this.calculateHealthScore(conflicts);

    return {
      conflicts,
      summary,
      dependencyTree: tree,
      recommendations,
      healthScore
    };
  }

  private generateRecommendations(conflicts: DependencyConflict[]): string[] {
    const recommendations: string[] = [];

    if (conflicts.some(c => c.type === ConflictType.VERSION_MISMATCH)) {
      recommendations.push('Consider using a single package manager with strict versioning');
      recommendations.push('Use lockfiles to ensure consistent installations');
    }

    if (conflicts.some(c => c.type === ConflictType.DUPLICATE_PACKAGE)) {
      recommendations.push('Run deduplication regularly to optimize node_modules');
      recommendations.push('Consider using pnpm for automatic deduplication');
    }

    if (conflicts.some(c => c.type === ConflictType.SECURITY_VULNERABILITY)) {
      recommendations.push('Set up automated security scanning in CI/CD');
      recommendations.push('Regularly update dependencies to patch vulnerabilities');
    }

    if (conflicts.some(c => c.type === ConflictType.CIRCULAR_DEPENDENCY)) {
      recommendations.push('Review module architecture to minimize coupling');
      recommendations.push('Use dependency injection patterns');
    }

    return recommendations;
  }

  private calculateHealthScore(conflicts: DependencyConflict[]): number {
    let score = 100;

    // Deduct points based on severity
    score -= conflicts.filter(c => c.severity === 'critical').length * 20;
    score -= conflicts.filter(c => c.severity === 'high').length * 10;
    score -= conflicts.filter(c => c.severity === 'medium').length * 5;
    score -= conflicts.filter(c => c.severity === 'low').length * 2;

    // Bonus points for auto-resolvable conflicts
    const autoResolvableRatio = conflicts.length > 0 
      ? conflicts.filter(c => c.autoResolvable).length / conflicts.length 
      : 1;
    
    score += autoResolvableRatio * 10;

    return Math.max(0, Math.min(100, score));
  }

  async resolveConflicts(
    conflicts: DependencyConflict[],
    options: {
      autoOnly?: boolean;
      interactive?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<{
    resolved: string[];
    failed: string[];
    skipped: string[];
  }> {
    const resolved: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    for (const conflict of conflicts) {
      if (options.autoOnly && !conflict.autoResolvable) {
        skipped.push(conflict.name);
        continue;
      }

      // Find automated resolutions
      const autoResolutions = conflict.resolutions.filter(r => r.automated);
      
      if (autoResolutions.length === 0) {
        skipped.push(conflict.name);
        continue;
      }

      // Use the lowest risk automated resolution
      const resolution = autoResolutions.sort((a, b) => {
        const riskScore = { low: 1, medium: 2, high: 3 };
        return riskScore[a.risk] - riskScore[b.risk];
      })[0];

      try {
        if (!options.dryRun && resolution.command) {
          this.emit('resolution:start', { conflict: conflict.name, resolution });
          execSync(resolution.command, { stdio: 'inherit' });
          resolved.push(conflict.name);
          this.emit('resolution:success', { conflict: conflict.name });
        } else if (options.dryRun) {
          console.log(`Would run: ${resolution.command}`);
          resolved.push(conflict.name);
        }
      } catch (error) {
        failed.push(conflict.name);
        this.emit('resolution:failed', { conflict: conflict.name, error });
      }
    }

    return { resolved, failed, skipped };
  }

  exportReport(report: ConflictReport, format: 'json' | 'markdown' = 'markdown'): string {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // Markdown format
    const lines: string[] = [];
    
    lines.push('# Dependency Conflict Report');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    lines.push('## Summary');
    lines.push(`- Total Conflicts: ${report.summary.total}`);
    lines.push(`- Critical: ${report.summary.critical}`);
    lines.push(`- High: ${report.summary.high}`);
    lines.push(`- Medium: ${report.summary.medium}`);
    lines.push(`- Low: ${report.summary.low}`);
    lines.push(`- Auto-resolvable: ${report.summary.autoResolvable}`);
    lines.push(`- Health Score: ${report.healthScore}/100`);
    lines.push('');

    if (report.conflicts.length > 0) {
      lines.push('## Conflicts');
      
      for (const conflict of report.conflicts) {
        lines.push(`### ${conflict.severity.toUpperCase()}: ${conflict.name}`);
        lines.push(`**Type**: ${conflict.type.replace(/_/g, ' ')}`);
        lines.push(`**Description**: ${conflict.description}`);
        
        if (conflict.impact.length > 0) {
          lines.push('**Impact**:');
          for (const impact of conflict.impact) {
            lines.push(`- ${impact}`);
          }
        }

        if (conflict.resolutions.length > 0) {
          lines.push('**Resolutions**:');
          for (const resolution of conflict.resolutions) {
            lines.push(`- ${resolution.description} (Risk: ${resolution.risk})`);
            if (resolution.command) {
              lines.push(`  \`${resolution.command}\``);
            }
          }
        }
        
        lines.push('');
      }
    }

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      for (const rec of report.recommendations) {
        lines.push(`- ${rec}`);
      }
    }

    return lines.join('\n');
  }
}

// Global instance
let globalDetector: DependencyConflictDetector | null = null;

export function getDependencyConflictDetector(): DependencyConflictDetector {
  if (!globalDetector) {
    globalDetector = new DependencyConflictDetector();
  }
  return globalDetector;
}

export async function detectDependencyConflicts(
  projectPath: string,
  options?: ConflictDetectionOptions
): Promise<ConflictReport> {
  const detector = getDependencyConflictDetector();
  return detector.detectConflicts(projectPath, options);
}