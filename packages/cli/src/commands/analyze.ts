import * as fs from 'fs-extra';
import * as fsReal from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as zlib from 'zlib';
import fg from 'fast-glob';
import { execSync } from 'child_process';
import { findMonorepoRoot } from '../utils/monorepo';
import { analyzeWorkspace, discoverPackages, ANALYSIS_TYPES, SEVERITY_ORDER, isAnalysisType } from '../analyze';
import type { AnalysisEngineResult, Finding, Severity } from '../analyze';
import { findCredentialInLine } from '../analyze/checks';
import { jsonSuccess, jsonError, enableJsonMode } from '../utils/json-output';
import { ProgressSpinner } from '../utils/spinner';

/**
 * Options for configuring the project analysis command
 */
interface AnalyzeOptions {
  spinner?: ProgressSpinner;
  verbose?: boolean;
  json?: boolean;
  workspace?: string;
  type?: 'bundle' | 'dependencies' | 'performance' | 'security' | 'scalability' | 'architecture' | 'all';
  output?: string;
  /** Exit non-zero when a finding at or above this severity exists. */
  failOn?: Severity;
}

const LEGACY_TYPES = ['bundle', 'dependencies', 'performance', 'security'] as const;
const VALID_TYPES = [...new Set<string>([...LEGACY_TYPES, ...ANALYSIS_TYPES, 'all'])];

/**
 * Results of a bundle size analysis for a workspace
 */
interface BundleAnalysis {
  workspace: string;
  size: {
    total: string;
    gzipped: string;
    assets: { name: string; size: string; rawBytes: number; type: string }[];
  };
  chunks: { name: string; size: string; modules: number }[];
  treeshaking: {
    unusedExports: string[];
    deadCode: number;
  };
}

/**
 * Results of a dependency analysis for a workspace
 */
interface DependencyAnalysis {
  workspace: string;
  total: number;
  production: number;
  development: number;
  outdated: { name: string; current: string; wanted: string; latest: string }[];
  duplicates: { name: string; versions: string[]; locations: string[] }[];
  vulnerabilities: { severity: string; count: number }[];
  licenses: { license: string; packages: string[] }[];
}

/**
 * Results of a performance analysis for a workspace
 */
interface PerformanceAnalysis {
  workspace: string;
  buildTime: number;
  bundleSize: string;
  suggestions: string[];
}

/**
 * Runs project analysis across one or more workspaces in a Re-Shell monorepo
 *
 * @param options - Configuration options for the analysis (type, output, workspace, etc.)
 * @returns Promise that resolves when analysis is complete and results are displayed
 */
export async function runProjectAnalysis(options: AnalyzeOptions = {}) {
  const restoreJson = options.json ? enableJsonMode() : () => {};
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      if (options.json) {
        jsonError('NOT_IN_MONOREPO', 'Not in a Re-Shell monorepo. Run this command from within a monorepo.');
        return;
      }
      throw new Error('Not in a Re-Shell monorepo. Run this command from within a monorepo.');
    }

    if (options.type && !VALID_TYPES.includes(options.type)) {
      const message = `Unknown analysis type "${options.type}". Supported: ${VALID_TYPES.join(', ')}.`;
      if (options.json) {
        jsonError('ANALYZE_ERROR', message);
        return;
      }
      throw new Error(message);
    }
    if (options.failOn && !(options.failOn in SEVERITY_ORDER)) {
      const message = `Unknown --fail-on severity "${options.failOn}". Supported: ${Object.keys(SEVERITY_ORDER).join(', ')}.`;
      if (options.json) {
        jsonError('ANALYZE_ERROR', message);
        return;
      }
      throw new Error(message);
    }

    if (options.spinner) {
      options.spinner.setText('Starting analysis...');
    }

    const workspaces = options.workspace 
      ? [options.workspace]
      : await getWorkspaces(monorepoRoot);

    const results = {
      timestamp: new Date().toISOString(),
      monorepo: path.basename(monorepoRoot),
      workspaces: workspaces.length,
      analysis: {} as Record<string, Record<string, any>>,
      types: [] as string[],
      graph: { packages: 0, edges: 0, services: 0 },
      findings: [] as Finding[],
      summary: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<string, number>,
        byType: { security: 0, performance: 0, scalability: 0, architecture: 0 } as Record<string, number>,
      },
    };

    // Run different types of analysis based on options
    const analysisTypes = options.type === 'all' ? ['bundle', 'dependencies', 'performance', 'security'] : [options.type || 'all'];

    for (const workspace of workspaces) {
      const workspacePath = path.join(monorepoRoot, workspace);
      
      if (!await fs.pathExists(path.join(workspacePath, 'package.json'))) {
        continue;
      }

      results.analysis[workspace] = {};

      for (const analysisType of analysisTypes) {
        if (options.spinner) {
          options.spinner.setText(`Analyzing ${workspace} (${analysisType})...`);
        }

        switch (analysisType) {
          case 'bundle':
            results.analysis[workspace].bundle = await analyzeBundleSize(workspacePath, workspace, options);
            break;
          case 'dependencies':
            results.analysis[workspace].dependencies = await analyzeDependencies(workspacePath, workspace, options);
            break;
          case 'performance':
            results.analysis[workspace].performance = await analyzePerformance(workspacePath, workspace, options);
            break;
          case 'security':
            results.analysis[workspace].security = await analyzeSecurityIssues(workspacePath, workspace, options);
            break;
          case 'all':
            results.analysis[workspace].bundle = await analyzeBundleSize(workspacePath, workspace, options);
            results.analysis[workspace].dependencies = await analyzeDependencies(workspacePath, workspace, options);
            results.analysis[workspace].performance = await analyzePerformance(workspacePath, workspace, options);
            results.analysis[workspace].security = await analyzeSecurityIssues(workspacePath, workspace, options);
            break;
        }
      }
    }

    // Workspace-graph / file heuristics (cycles, layering, hotspots, secrets, services, ...).
    // Runs for the four finding-based types, and for the default `all`.
    const requested = !options.type || options.type === 'all' ? [...ANALYSIS_TYPES] : isAnalysisType(options.type) ? [options.type] : [];
    if (requested.length > 0) {
      if (options.spinner) options.spinner.setText(`Analyzing workspace graph (${requested.join(', ')})...`);
      const engine: AnalysisEngineResult = analyzeWorkspace(monorepoRoot, { types: requested, workspace: options.workspace });
      results.types = engine.types;
      results.graph = engine.graph;
      results.findings = engine.findings;
      results.summary = engine.summary;
    }

    // Save results if output specified
    if (options.output) {
      await fs.writeJson(options.output, results, { spaces: 2 });
      console.log(chalk.green(`Analysis results saved to: ${options.output}`));
    }

    const shown = displayAnalysisResults(results, options);
    if (options.failOn) {
      const threshold = SEVERITY_ORDER[options.failOn];
      if (results.findings.some(f => SEVERITY_ORDER[f.severity] <= threshold)) process.exitCode = 1;
    }
    return shown;

  } catch (error) {
    if (options.json) {
      jsonError('ANALYZE_ERROR', error instanceof Error ? error.message : 'Analysis failed');
      return;
    }
    if (options.spinner) {
      options.spinner.fail(chalk.red('Analysis failed'));
    }
    throw error;
  } finally {
    restoreJson();
  }
}

async function analyzeBundleSize(workspacePath: string, workspace: string, options: AnalyzeOptions): Promise<BundleAnalysis> {
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    // Check if workspace has build script
    if (!packageJson.scripts?.build) {
      return {
        workspace,
        size: { total: 'N/A', gzipped: 'N/A', assets: [] },
        chunks: [],
        treeshaking: { unusedExports: [], deadCode: 0 }
      };
    }

    // Try to build and analyze
    const distPath = path.join(workspacePath, 'dist');
    const buildPath = path.join(workspacePath, 'build');
    
    let outputPath = distPath;
    if (await fs.pathExists(buildPath)) {
      outputPath = buildPath;
    } else if (!await fs.pathExists(distPath)) {
      // Try to build first
      try {
        execSync('npm run build', { cwd: workspacePath, stdio: 'pipe' });
      } catch (error) {
        // Build failed, return empty analysis
        return {
          workspace,
          size: { total: 'Build failed', gzipped: 'N/A', assets: [] },
          chunks: [],
          treeshaking: { unusedExports: [], deadCode: 0 }
        };
      }
    }

    // Analyze build output
    const assets = await analyzeBuildAssets(outputPath);
    const totalSize = assets.reduce((sum, asset) => sum + asset.rawBytes, 0);

    // Try to detect webpack/vite stats
    const statsPath = path.join(workspacePath, 'stats.json');
    const webpackStatsPath = path.join(workspacePath, 'webpack-stats.json');
    
    let chunks: { name: string; size: string; modules: number }[] = [];
    let treeshaking: { unusedExports: string[]; deadCode: number } = { unusedExports: [], deadCode: 0 };

    if (await fs.pathExists(statsPath)) {
      const stats = await fs.readJson(statsPath);
      chunks = extractChunksFromStats(stats);
      treeshaking = extractTreeshakingInfo(stats);
    } else if (await fs.pathExists(webpackStatsPath)) {
      const stats = await fs.readJson(webpackStatsPath);
      chunks = extractChunksFromStats(stats);
      treeshaking = extractTreeshakingInfo(stats);
    }

    return {
      workspace,
      size: {
        total: formatBytes(totalSize),
        gzipped: formatBytes(await measureGzipBytes(outputPath, assets)),
        assets
      },
      chunks,
      treeshaking
    };

  } catch (error: unknown) {
    return {
      workspace,
      size: { total: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, gzipped: 'N/A', assets: [] },
      chunks: [],
      treeshaking: { unusedExports: [], deadCode: 0 }
    };
  }
}

async function analyzeDependencies(workspacePath: string, workspace: string, options: AnalyzeOptions): Promise<DependencyAnalysis> {
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};

    // Get outdated packages
    let outdated: { name: string; current: string; wanted: string; latest: string }[] = [];
    try {
      const outdatedOutput = execSync('npm outdated --json', { cwd: workspacePath, stdio: 'pipe', encoding: 'utf8' });
      const outdatedData = JSON.parse(outdatedOutput);
      outdated = Object.entries(outdatedData).map(([name, info]: [string, Record<string, unknown>]) => ({
        name,
        current: String(info.current ?? ''),
        wanted: String(info.wanted ?? ''),
        latest: String(info.latest ?? '')
      }));
    } catch (error: unknown) {
      // npm outdated exits with code 1 when packages are outdated
      if ((error as { stdout?: string }).stdout) {
        try {
          const outdatedData = JSON.parse((error as { stdout?: string }).stdout);
          outdated = Object.entries(outdatedData).map(([name, info]: [string, Record<string, unknown>]) => ({
            name,
            current: String(info.current ?? ''),
            wanted: String(info.wanted ?? ''),
            latest: String(info.latest ?? '')
          }));
        } catch {
          // Ignore parsing errors
        }
      }
    }

    // Check for vulnerabilities
    let vulnerabilities: { severity: string; count: number }[] = [];
    try {
      const auditOutput = execSync('npm audit --json', { cwd: workspacePath, stdio: 'pipe', encoding: 'utf8' });
      const auditData = JSON.parse(auditOutput);
      
      if (auditData.metadata?.vulnerabilities) {
        vulnerabilities = Object.entries(auditData.metadata.vulnerabilities)
          .filter(([key]) => key !== 'total')
          .map(([severity, count]) => ({ severity, count: count as number }));
      }
    } catch (error) {
      // Audit might fail, continue without vulnerability data
    }

    // Analyze licenses (simplified)
    const licenses = await analyzeLicenses(deps, devDeps, workspacePath);

    // Find duplicates (simplified check)
    const duplicates = findDuplicateDependencies(packageJson);

    return {
      workspace,
      total: Object.keys(deps).length + Object.keys(devDeps).length,
      production: Object.keys(deps).length,
      development: Object.keys(devDeps).length,
      outdated: outdated.slice(0, 10), // Limit to top 10
      duplicates,
      vulnerabilities,
      licenses
    };

  } catch (error) {
    return {
      workspace,
      total: 0,
      production: 0,
      development: 0,
      outdated: [],
      duplicates: [],
      vulnerabilities: [],
      licenses: []
    };
  }
}

async function analyzePerformance(workspacePath: string, workspace: string, options: AnalyzeOptions): Promise<PerformanceAnalysis> {
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    // Measure build time
    let buildTime = 0;
    if (packageJson.scripts?.build) {
      const startTime = Date.now();
      try {
        execSync('npm run build', { cwd: workspacePath, stdio: 'pipe' });
        buildTime = Date.now() - startTime;
      } catch (error) {
        buildTime = -1; // Build failed
      }
    }

    // Get bundle size
    const distPath = path.join(workspacePath, 'dist');
    const buildPath = path.join(workspacePath, 'build');
    let bundleSize = 'N/A';

    let bundleBytes = 0;
    if (await fs.pathExists(distPath)) {
      bundleBytes = await getDirectoryBytes(distPath);
      bundleSize = formatBytes(bundleBytes);
    } else if (await fs.pathExists(buildPath)) {
      bundleBytes = await getDirectoryBytes(buildPath);
      bundleSize = formatBytes(bundleBytes);
    }

    // Performance suggestions based on analysis
    const suggestions = generatePerformanceSuggestions(packageJson, bundleBytes, buildTime);

    return {
      workspace,
      buildTime,
      bundleSize,
      suggestions
    };

  } catch (error) {
    return {
      workspace,
      buildTime: -1,
      bundleSize: 'Error',
      suggestions: [`Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

async function analyzeSecurityIssues(workspacePath: string, workspace: string, options: AnalyzeOptions): Promise<unknown> {
  try {
    // Run security audit
    let auditResults = {};
    try {
      const auditOutput = execSync('npm audit --json', { cwd: workspacePath, stdio: 'pipe', encoding: 'utf8' });
      auditResults = JSON.parse(auditOutput);
    } catch (error: unknown) {
      if ((error as { stdout?: string }).stdout) {
        try {
          auditResults = JSON.parse((error as { stdout?: string }).stdout);
        } catch {
          // Ignore parsing errors
        }
      }
    }

    // Check for sensitive files
    const sensitiveFiles = await checkSensitiveFiles(workspacePath);

    // Check for hardcoded secrets (basic patterns)
    const secretPatterns = await scanForSecrets(workspacePath);

    return {
      workspace,
      audit: auditResults,
      sensitiveFiles,
      secretPatterns,
      recommendations: generateSecurityRecommendations(auditResults, sensitiveFiles, secretPatterns, workspacePath)
    };

  } catch (error) {
    return {
      workspace,
      audit: {},
      sensitiveFiles: [],
      secretPatterns: [],
      recommendations: [`Security analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

// Helper functions

async function getWorkspaces(monorepoRoot: string): Promise<string[]> {
  try {
    // Declared workspace globs (package.json `workspaces`, pnpm-workspace.yaml) or the
    // conventional apps/ packages/ libs/ services/ tools/ layout, expanded to real packages.
    const discovered = discoverPackages(monorepoRoot).map(p => p.rel);
    if (discovered.length > 0) return discovered;

    // Fallback: scan for package.json files
    const workspaces: string[] = [];
    const scanDir = async (dir: string, depth = 0) => {
      if (depth > 2) return;

      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          const pkgPath = path.join(dir, item.name, 'package.json');
          if (await fs.pathExists(pkgPath)) {
            workspaces.push(path.relative(monorepoRoot, path.join(dir, item.name)));
          } else {
            await scanDir(path.join(dir, item.name), depth + 1);
          }
        }
      }
    };

    await scanDir(monorepoRoot);
    return workspaces;
  } catch (error) {
    return [];
  }
}

async function analyzeBuildAssets(outputPath: string): Promise<{ name: string; size: string; rawBytes: number; type: string }[]> {
  try {
    const assets = [];
    const items = await fs.readdir(outputPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile()) {
        const filePath = path.join(outputPath, item.name);
        const stats = await fs.stat(filePath);
        const ext = path.extname(item.name);

        assets.push({
          name: item.name,
          size: formatBytes(stats.size),
          rawBytes: stats.size,
          type: getFileType(ext)
        });
      }
    }

    return assets.sort((a, b) => b.rawBytes - a.rawBytes);
  } catch (error) {
    return [];
  }
}

function extractChunksFromStats(stats: Record<string, unknown>): { name: string; size: string; modules: number }[] {
  try {
    if (stats.chunks) {
      const chunks = stats.chunks as Array<Record<string, unknown>>;
      return chunks.map((chunk) => ({
        name: String((chunk.names as unknown[])?.[0] ?? chunk.id ?? ''),
        size: formatBytes(Number(chunk.size) || 0),
        modules: ((chunk.modules as unknown[])?.length) || 0
      }));
    }
    return [];
  } catch (error) {
    return [];
  }
}

function extractTreeshakingInfo(stats: Record<string, unknown>): { unusedExports: string[]; deadCode: number } {
  try {
    const unusedExports: string[] = [];
    let deadCode = 0;

    if (stats.modules) {
      const modules = stats.modules as Array<Record<string, unknown>>;
      for (const module of modules) {
        if (module.usedExports === false) {
          unusedExports.push(String(module.name));
        }
        const provided = module.providedExports as unknown[] | undefined;
        const used = module.usedExports as unknown[] | undefined;
        if (provided && used) {
          deadCode += provided.length - used.length;
        }
      }
    }

    return { unusedExports: unusedExports.slice(0, 10), deadCode };
  } catch (error) {
    return { unusedExports: [], deadCode: 0 };
  }
}

async function analyzeLicenses(
  deps: Record<string, unknown>,
  devDeps: Record<string, unknown>,
  workspacePath?: string
): Promise<{ license: string; packages: string[] }[]> {
  // Read the license each declared dependency actually ships with from its installed
  // package.json (node_modules in the workspace or any ancestor). Packages that are not
  // installed are reported under "UNKNOWN (not installed)" instead of being guessed.
  const byLicense = new Map<string, string[]>();
  const names = [...new Set([...Object.keys(deps), ...Object.keys(devDeps)])].sort();
  for (const name of names) {
    let license = 'UNKNOWN (not installed)';
    if (workspacePath) {
      let dir = path.resolve(workspacePath);
      for (let depth = 0; depth < 8; depth++) {
        const manifest = path.join(dir, 'node_modules', name, 'package.json');
        if (await fs.pathExists(manifest)) {
          try {
            const pkg = await fs.readJson(manifest);
            const raw = pkg.license ?? (Array.isArray(pkg.licenses) ? pkg.licenses.map((l: { type?: string }) => l.type).join(' OR ') : undefined);
            license = typeof raw === 'string' ? raw : raw && typeof raw === 'object' && raw.type ? String(raw.type) : 'UNKNOWN (no license field)';
          } catch {
            license = 'UNKNOWN (unreadable package.json)';
          }
          break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
    byLicense.set(license, [...(byLicense.get(license) ?? []), name]);
  }
  return [...byLicense.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([license, packages]) => ({ license, packages }));
}

function findDuplicateDependencies(packageJson: Record<string, unknown>): { name: string; versions: string[]; locations: string[] }[] {
  // A dependency declared in several sections of the same package.json at different ranges.
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;
  const seen = new Map<string, { versions: Set<string>; locations: string[] }>();
  for (const section of sections) {
    const block = (packageJson[section] ?? {}) as Record<string, string>;
    for (const [name, range] of Object.entries(block)) {
      const entry = seen.get(name) ?? { versions: new Set<string>(), locations: [] };
      entry.versions.add(String(range));
      entry.locations.push(section);
      seen.set(name, entry);
    }
  }
  return [...seen.entries()]
    .filter(([, e]) => e.locations.length > 1 && e.versions.size > 1)
    .map(([name, e]) => ({ name, versions: [...e.versions], locations: e.locations }));
}

/** Real gzip size of the build output (top-level files, capped at 20 files / 5MB each for speed). */
async function measureGzipBytes(outputPath: string, assets: { name: string; rawBytes: number }[]): Promise<number> {
  let total = 0;
  for (const asset of assets.slice(0, 20)) {
    if (asset.rawBytes > 5 * 1024 * 1024) {
      total += asset.rawBytes; // too large to compress synchronously here; count it uncompressed
      continue;
    }
    try {
      total += zlib.gzipSync(await fs.readFile(path.join(outputPath, asset.name))).length;
    } catch {
      total += asset.rawBytes;
    }
  }
  return total;
}

async function getDirectoryBytes(dirPath: string): Promise<number> {
  try {
    let totalSize = 0;
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items.slice(0, 20)) { // Limit for performance
      if (item.isFile()) {
        const stats = await fs.stat(path.join(dirPath, item.name));
        totalSize += stats.size;
      }
    }

    return totalSize;
  } catch (error) {
    return 0;
  }
}

function generatePerformanceSuggestions(packageJson: Record<string, unknown>, bundleBytes: number, buildTime: number): string[] {
  const suggestions = [];
  
  if (buildTime > 30000) {
    suggestions.push('Consider using faster build tools like esbuild or swc');
  }
  
  if (bundleBytes > 1000000) {
    suggestions.push('Bundle size is large, consider code splitting');
  }
  
  const deps = (packageJson.dependencies || {}) as Record<string, unknown>;
  if (deps.lodash) {
    suggestions.push('Consider using lodash-es for better tree shaking');
  }
  
  if (!packageJson.type || packageJson.type !== 'module') {
    suggestions.push('Consider using ES modules for better tree shaking');
  }
  
  return suggestions;
}

async function checkSensitiveFiles(workspacePath: string): Promise<string[]> {
  const sensitivePatterns = ['.env', '.env.local', '.env.production', 'secrets.json', 'private.key'];
  const sensitiveFiles = [];
  
  for (const pattern of sensitivePatterns) {
    const filePath = path.join(workspacePath, pattern);
    if (await fs.pathExists(filePath)) {
      sensitiveFiles.push(pattern);
    }
  }
  
  return sensitiveFiles;
}

async function scanForSecrets(workspacePath: string): Promise<string[]> {
  // Real scan: well-known credential formats (cloud keys, tokens, private keys, JWTs)
  // in the workspace's source and config files. Returns "file:line (masked match)" entries;
  // the secret itself is never echoed.
  const found: string[] = [];
  try {
    const files = await fg(['**/*.{ts,tsx,js,jsx,mjs,cjs,json,yml,yaml,py,go,rb,java,properties,toml,ini,sh,tf}'], {
      cwd: workspacePath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**', '**/*.min.js', '**/package-lock.json', '**/pnpm-lock.yaml'],
      onlyFiles: true,
      deep: 8,
    });
    for (const file of files.sort().slice(0, 2000)) {
      const full = path.join(workspacePath, file);
      const stat = await fs.stat(full);
      if (stat.size > 300_000) continue;
      const lines = (await fs.readFile(full, 'utf8')).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const hit = findCredentialInLine(lines[i]);
        if (hit) found.push(`${file}:${i + 1} (${hit.slice(0, 4)}${'*'.repeat(8)})`);
      }
    }
  } catch (error) {
    // Unreadable tree: report what was found so far
  }
  return found;
}

function generateSecurityRecommendations(audit: Record<string, unknown>, sensitiveFiles: string[], secrets: string[], workspacePath?: string): string[] {
  const recommendations = [];

  if (sensitiveFiles.length > 0) {
    recommendations.push('Add sensitive files to .gitignore');
  }

  if (secrets.length > 0) {
    recommendations.push('Use environment variables for sensitive data');
  }

  const total = (audit.metadata as Record<string, unknown> | undefined)?.vulnerabilities as Record<string, unknown> | undefined;
  if (total && Number(total.total) > 0) {
    recommendations.push('Run npm audit fix to address vulnerabilities');
  }

  // Only recommend automation that is not already configured in this repository.
  if (!hasDependencyUpdateAutomation(workspacePath)) {
    recommendations.push('Enable dependabot for automatic security updates');
  }
  if (!hasAuditInCi(workspacePath)) {
    recommendations.push('Use npm audit in CI/CD pipeline');
  }

  return recommendations;
}

/** Walk up from the workspace looking for dependabot/renovate configuration. */
function hasDependencyUpdateAutomation(workspacePath?: string): boolean {
  return ancestorsOf(workspacePath).some(dir =>
    ['.github/dependabot.yml', '.github/dependabot.yaml', 'renovate.json', '.renovaterc', '.renovaterc.json', '.github/renovate.json'].some(f => fsReal.existsSync(path.join(dir, f)))
  );
}

/** True when a CI workflow in an ancestor directory runs a dependency audit. */
function hasAuditInCi(workspacePath?: string): boolean {
  for (const dir of ancestorsOf(workspacePath)) {
    const workflows = path.join(dir, '.github', 'workflows');
    try {
      for (const file of fsReal.readdirSync(workflows)) {
        if (/\.ya?ml$/.test(file) && /(npm|pnpm|yarn)\s+audit|audit-ci|osv-scanner|snyk\s+test/.test(fsReal.readFileSync(path.join(workflows, file), 'utf8'))) return true;
      }
    } catch {
      /* no workflows here */
    }
  }
  return false;
}

function ancestorsOf(start?: string): string[] {
  if (!start) return [];
  const out: string[] = [];
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i++) {
    out.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(ext: string): string {
  const types = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.css': 'Stylesheet',
    '.html': 'HTML',
    '.json': 'JSON',
    '.png': 'Image',
    '.jpg': 'Image',
    '.svg': 'SVG',
    '.woff': 'Font',
    '.woff2': 'Font'
  };
  
  return (types as Record<string, string>)[ext] || 'Other';
}

function displayAnalysisResults(results: Record<string, unknown>, options: AnalyzeOptions) {
  if (options.json) {
    jsonSuccess(results);
    return;
  }

  if (options.spinner) {
    options.spinner.stop();
  }

  console.log('\n' + chalk.bold('📊 Re-Shell Project Analysis\n'));

  console.log(chalk.bold('Summary:'));
  console.log(`  Monorepo: ${results.monorepo}`);
  console.log(`  Workspaces analyzed: ${results.workspaces}`);
  console.log(`  Generated: ${new Date(results.timestamp as string).toLocaleString()}`);
  console.log();

  // Display results for each workspace
  for (const [workspace, analysis] of Object.entries(results.analysis)) {
    const workspaceAnalysis = analysis as Record<string, any>;
    console.log(chalk.bold(`📦 ${workspace}`));
    
    if (workspaceAnalysis.bundle) {
      console.log(chalk.blue('  Bundle Analysis:'));
      console.log(`    Total size: ${workspaceAnalysis.bundle.size.total}`);
      console.log(`    Assets: ${workspaceAnalysis.bundle.size.assets.length}`);
      console.log(`    Chunks: ${workspaceAnalysis.bundle.chunks.length}`);
    }
    
    if (workspaceAnalysis.dependencies) {
      console.log(chalk.blue('  Dependencies:'));
      console.log(`    Total: ${workspaceAnalysis.dependencies.total}`);
      console.log(`    Outdated: ${workspaceAnalysis.dependencies.outdated.length}`);
      console.log(`    Vulnerabilities: ${(workspaceAnalysis.dependencies.vulnerabilities as { severity: string; count: number }[]).reduce((sum: number, v) => sum + v.count, 0)}`);
    }
    
    if (workspaceAnalysis.performance) {
      console.log(chalk.blue('  Performance:'));
      console.log(`    Build time: ${workspaceAnalysis.performance.buildTime > 0 ? workspaceAnalysis.performance.buildTime + 'ms' : 'N/A'}`);
      console.log(`    Bundle size: ${workspaceAnalysis.performance.bundleSize}`);
      console.log(`    Suggestions: ${workspaceAnalysis.performance.suggestions.length}`);
    }
    
    if (workspaceAnalysis.security) {
      console.log(chalk.blue('  Security:'));
      console.log(`    Sensitive files: ${workspaceAnalysis.security.sensitiveFiles.length}`);
      console.log(`    Recommendations: ${workspaceAnalysis.security.recommendations.length}`);
    }
    
    console.log();
  }

  renderFindings((results.findings ?? []) as Finding[], (results.summary ?? undefined) as FindingsSummary | undefined, (results.graph ?? undefined) as { packages: number; edges: number; services: number } | undefined, options);

  console.log(chalk.dim('Use --verbose for detailed breakdown'));
  console.log(chalk.dim('Use --output <file> to save results'));
}

interface FindingsSummary {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

const SEVERITY_COLOR: Record<string, (t: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
  info: chalk.gray,
};

function renderFindings(
  findings: Finding[],
  summary: FindingsSummary | undefined,
  graph: { packages: number; edges: number; services: number } | undefined,
  options: AnalyzeOptions
): void {
  if (!summary) return;
  if (graph && (graph.packages > 0 || graph.services > 0)) {
    console.log(chalk.bold('Workspace graph:'));
    console.log(`  ${graph.packages} package(s), ${graph.edges} internal dependency edge(s), ${graph.services} service(s)`);
    console.log();
  }
  if (findings.length === 0) {
    if (graph) console.log(chalk.green('No findings from the workspace analysis.\n'));
    return;
  }

  const counts = (['critical', 'high', 'medium', 'low', 'info'] as const)
    .filter(sev => summary.bySeverity[sev] > 0)
    .map(sev => SEVERITY_COLOR[sev](`${summary.bySeverity[sev]} ${sev}`))
    .join(', ');
  console.log(chalk.bold(`Findings (${findings.length}): `) + counts + '\n');

  for (const f of findings) {
    console.log(`${SEVERITY_COLOR[f.severity](`[${f.severity}]`)} ${chalk.bold(f.title)} ${chalk.dim(`(${f.ruleId})`)}`);
    if (options.verbose) console.log(`  ${f.message}`);
    const shown = options.verbose ? f.evidence : f.evidence.slice(0, 2);
    for (const e of shown) {
      const where = e.file ? `${e.file}${e.line ? `:${e.line}` : ''}` : e.path ? e.path.join(' -> ') : e.kind;
      console.log(chalk.dim(`  evidence: ${where}  ${e.detail}`));
    }
    if (!options.verbose && f.evidence.length > shown.length) {
      console.log(chalk.dim(`  ... ${f.evidence.length - shown.length} more evidence item(s) (--verbose)`));
    }
    console.log(chalk.cyan(`  -> ${f.recommendation}`));
    console.log();
  }
}
