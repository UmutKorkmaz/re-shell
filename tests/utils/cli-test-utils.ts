import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Utility functions for CLI testing
 */

/**
 * Run a CLI command and return the result
 * 
 * @param command - The command to run
 * @param cwd - The working directory to run the command in
 * @returns Object containing stdout and stderr
 */
export function runCliCommand(command: string, cwd?: string): { stdout: string; stderr: string } {
  try {
    const stdout = execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();
    return { stdout, stderr: '' };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message
    };
  }
}

/**
 * Create a temporary test directory
 * 
 * @param basePath - Base path for the test directory
 * @param dirName - Name of the directory to create
 * @returns Path to the created directory
 */
export function createTestDirectory(basePath: string, dirName: string): string {
  const dirPath = path.join(basePath, dirName);
  fs.ensureDirSync(dirPath);
  return dirPath;
}

/**
 * Clean up a test directory
 * 
 * @param dirPath - Path to the directory to clean up
 */
export function cleanupTestDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.removeSync(dirPath);
  }
}

/**
 * Verify a project structure
 * 
 * @param projectDir - Path to the project directory
 * @returns Object with verification results
 */
export function verifyProjectStructure(projectDir: string): {
  exists: boolean;
  hasPackageJson: boolean;
  hasAppsDir: boolean;
  hasShellApp: boolean;
  hasPackagesDir: boolean;
} {
  return {
    exists: fs.existsSync(projectDir),
    hasPackageJson: fs.existsSync(path.join(projectDir, 'package.json')),
    hasAppsDir: fs.existsSync(path.join(projectDir, 'apps')),
    hasShellApp: fs.existsSync(path.join(projectDir, 'apps/shell')),
    hasPackagesDir: fs.existsSync(path.join(projectDir, 'packages'))
  };
}

/**
 * Verify a microfrontend structure
 * 
 * @param projectDir - Path to the project directory
 * @param mfName - Name of the microfrontend
 * @returns Object with verification results
 */
export function verifyMicrofrontendStructure(projectDir: string, mfName: string): {
  exists: boolean;
  hasPackageJson: boolean;
  hasSrcDir: boolean;
  hasViteConfig: boolean;
  packageJson: any | null;
} {
  const mfDir = path.join(projectDir, 'apps', mfName);
  let packageJson = null;
  
  if (fs.existsSync(path.join(mfDir, 'package.json'))) {
    try {
      packageJson = fs.readJsonSync(path.join(mfDir, 'package.json'));
    } catch (error) {
      // Ignore error
    }
  }
  
  return {
    exists: fs.existsSync(mfDir),
    hasPackageJson: fs.existsSync(path.join(mfDir, 'package.json')),
    hasSrcDir: fs.existsSync(path.join(mfDir, 'src')),
    hasViteConfig: fs.existsSync(path.join(mfDir, 'vite.config.ts')),
    packageJson
  };
}

/**
 * Get the path to the CLI executable
 * 
 * @returns Path to the CLI executable
 */
export function getCliPath(): string {
  return path.join(process.cwd(), 'dist/index.js');
}

/**
 * Build the CLI
 * 
 * @returns True if build was successful, false otherwise
 */
export function buildCli(): boolean {
  try {
    execSync('npm run build', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('Failed to build CLI:', error);
    return false;
  }
}
