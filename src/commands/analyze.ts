import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { findMonorepoRoot } from '../utils/monorepo';

interface AnalyzeOptions {
  spinner?: any;
  verbose?: boolean;
  json?: boolean;
  workspace?: string;
  type?: 'bundle' | 'dependencies' | 'performance' | 'security' | 'all';
  output?: string;
}

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

interface PerformanceAnalysis {
  workspace: string;
  buildTime: number;
  bundleSize: string;
  loadTime: {
    ttfb: number;
    fcp: number;
    lcp: number;
  };
  suggestions: string[];
}

export async function analyzeProject(options: AnalyzeOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo. Run this command from within a monorepo.');
    }

    if (options.spinner) {
      options.spinner.text = 'Starting analysis...';
    }

    const workspaces = options.workspace 
      ? [options.workspace]
      : await getWorkspaces(monorepoRoot);

    const results = {
      timestamp: new Date().toISOString(),
      monorepo: path.basename(monorepoRoot),
      workspaces: workspaces.length,
      analysis: {} as any
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
          options.spinner.text = `Analyzing ${workspace} (${analysisType})...`;
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

    // Save results if output specified
    if (options.output) {
      await fs.writeJson(options.output, results, { spaces: 2 });
      console.log(chalk.green(`Analysis results saved to: ${options.output}`));
    }

    return displayAnalysisResults(results, options);

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Analysis failed'));
    }
    throw error;
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
        gzipped: formatBytes(Math.floor(totalSize * 0.3)), // Estimate
        assets
      },
      chunks,
      treeshaking
    };

  } catch (error: any) {
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
      outdated = Object.entries(outdatedData).map(([name, info]: [string, any]) => ({
        name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest
      }));
    } catch (error: any) {
      // npm outdated exits with code 1 when packages are outdated
      if (error.stdout) {
        try {
          const outdatedData = JSON.parse(error.stdout);
          outdated = Object.entries(outdatedData).map(([name, info]: [string, any]) => ({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest
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
    const licenses = await analyzeLicenses(deps, devDeps);

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

    if (await fs.pathExists(distPath)) {
      bundleSize = await getDirectorySize(distPath);
    } else if (await fs.pathExists(buildPath)) {
      bundleSize = await getDirectorySize(buildPath);
    }

    // Performance suggestions based on analysis
    const suggestions = generatePerformanceSuggestions(packageJson, bundleSize, buildTime);

    return {
      workspace,
      buildTime,
      bundleSize,
      loadTime: {
        ttfb: 0, // Would need actual measurement
        fcp: 0,
        lcp: 0
      },
      suggestions
    };

  } catch (error) {
    return {
      workspace,
      buildTime: -1,
      bundleSize: 'Error',
      loadTime: { ttfb: 0, fcp: 0, lcp: 0 },
      suggestions: [`Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

async function analyzeSecurityIssues(workspacePath: string, workspace: string, options: AnalyzeOptions): Promise<any> {
  try {
    // Run security audit
    let auditResults = {};
    try {
      const auditOutput = execSync('npm audit --json', { cwd: workspacePath, stdio: 'pipe', encoding: 'utf8' });
      auditResults = JSON.parse(auditOutput);
    } catch (error: any) {
      if (error.stdout) {
        try {
          auditResults = JSON.parse(error.stdout);
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
      recommendations: generateSecurityRecommendations(auditResults, sensitiveFiles, secretPatterns)
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
    const packageJsonPath = path.join(monorepoRoot, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    if (packageJson.workspaces) {
      if (Array.isArray(packageJson.workspaces)) {
        return packageJson.workspaces;
      } else if (packageJson.workspaces.packages) {
        return packageJson.workspaces.packages;
      }
    }
    
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

function extractChunksFromStats(stats: any): { name: string; size: string; modules: number }[] {
  try {
    if (stats.chunks) {
      return stats.chunks.map((chunk: any) => ({
        name: chunk.names?.[0] || chunk.id,
        size: formatBytes(chunk.size || 0),
        modules: chunk.modules?.length || 0
      }));
    }
    return [];
  } catch (error) {
    return [];
  }
}

function extractTreeshakingInfo(stats: any): { unusedExports: string[]; deadCode: number } {
  try {
    const unusedExports = [];
    let deadCode = 0;
    
    if (stats.modules) {
      for (const module of stats.modules) {
        if (module.usedExports === false) {
          unusedExports.push(module.name);
        }
        if (module.providedExports && module.usedExports) {
          deadCode += module.providedExports.length - module.usedExports.length;
        }
      }
    }
    
    return { unusedExports: unusedExports.slice(0, 10), deadCode };
  } catch (error) {
    return { unusedExports: [], deadCode: 0 };
  }
}

async function analyzeLicenses(deps: any, devDeps: any): Promise<{ license: string; packages: string[] }[]> {
  // Simplified license analysis - would need actual package resolution
  const commonLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'GPL-3.0'];
  return commonLicenses.map(license => ({
    license,
    packages: []
  }));
}

function findDuplicateDependencies(packageJson: any): { name: string; versions: string[]; locations: string[] }[] {
  // Simplified duplicate detection
  return [];
}

async function getDirectorySize(dirPath: string): Promise<string> {
  try {
    let totalSize = 0;
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items.slice(0, 20)) { // Limit for performance
      if (item.isFile()) {
        const stats = await fs.stat(path.join(dirPath, item.name));
        totalSize += stats.size;
      }
    }
    
    return formatBytes(totalSize);
  } catch (error) {
    return 'Unknown';
  }
}

function generatePerformanceSuggestions(packageJson: any, bundleSize: string, buildTime: number): string[] {
  const suggestions = [];
  
  if (buildTime > 30000) {
    suggestions.push('Consider using faster build tools like esbuild or swc');
  }
  
  if (bundleSize && parseInt(bundleSize) > 1000000) {
    suggestions.push('Bundle size is large, consider code splitting');
  }
  
  const deps = packageJson.dependencies || {};
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
  // Basic secret pattern detection
  const secretPatterns: string[] = [];
  const patterns = [
    /api[_-]?key/i,
    /secret[_-]?key/i,
    /password/i,
    /token/i
  ];
  
  try {
    const srcPath = path.join(workspacePath, 'src');
    if (await fs.pathExists(srcPath)) {
      // This would need more sophisticated scanning in a real implementation
      // For now, just return empty array
    }
  } catch (error) {
    // Ignore errors
  }
  
  return secretPatterns;
}

function generateSecurityRecommendations(audit: any, sensitiveFiles: string[], secrets: string[]): string[] {
  const recommendations = [];
  
  if (sensitiveFiles.length > 0) {
    recommendations.push('Add sensitive files to .gitignore');
  }
  
  if (secrets.length > 0) {
    recommendations.push('Use environment variables for sensitive data');
  }
  
  if (audit.metadata?.vulnerabilities?.total > 0) {
    recommendations.push('Run npm audit fix to address vulnerabilities');
  }
  
  recommendations.push('Enable dependabot for automatic security updates');
  recommendations.push('Use npm audit in CI/CD pipeline');
  
  return recommendations;
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

function displayAnalysisResults(results: any, options: AnalyzeOptions) {
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (options.spinner) {
    options.spinner.stop();
  }

  console.log('\n' + chalk.bold('📊 Re-Shell Project Analysis\n'));

  console.log(chalk.bold('Summary:'));
  console.log(`  Monorepo: ${results.monorepo}`);
  console.log(`  Workspaces analyzed: ${results.workspaces}`);
  console.log(`  Generated: ${new Date(results.timestamp).toLocaleString()}`);
  console.log();

  // Display results for each workspace
  for (const [workspace, analysis] of Object.entries(results.analysis)) {
    const workspaceAnalysis = analysis as any;
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
      console.log(`    Vulnerabilities: ${workspaceAnalysis.dependencies.vulnerabilities.reduce((sum: number, v: any) => sum + v.count, 0)}`);
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

  console.log(chalk.dim('Use --verbose for detailed breakdown'));
  console.log(chalk.dim('Use --output <file> to save results'));
}