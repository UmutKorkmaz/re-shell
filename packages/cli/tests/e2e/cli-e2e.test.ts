import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  runCliCommand,
  cleanupTestDirectory,
  verifyProjectStructure,
  verifyMicrofrontendStructure,
  getCliPath
} from '../utils/cli-test-utils';

// These full end-to-end tests scaffold real projects and shell out to the built
// CLI, so they are opt-in: set RUN_E2E=1 to run them (e.g. in a dedicated CI
// job). They stay skipped by default to keep the quick test loop fast.
describe.skipIf(!process.env.RUN_E2E)('CLI End-to-End Tests', () => {
  // Scaffold OUTSIDE the repo. `re-shell create` detects an enclosing
  // pnpm/monorepo workspace and, when it finds one, switches to an interactive
  // "add an app to this workspace" flow that blocks on a prompt. A directory
  // under os.tmpdir() is never inside a workspace, so `create` always takes the
  // non-interactive "new project" path the tests assert on.
  // Created in beforeAll (not at collection time) so a skipped suite never
  // leaves an empty temp directory behind.
  let testBaseDir = '';
  const cliPath = getCliPath();
  
  // Generate unique test IDs for each test run
  const testId = uuidv4().substring(0, 8);
  const testProjectName = `test-project-${testId}`;
  const testMfName = `test-mf-${testId}`;
  
  // Setup test directory and build CLI
  beforeAll(() => {
    // The CLI is built exactly once by vitest's globalSetup (tests/global-setup.ts)
    // before any worker starts. Rebuilding it here would race with sibling test
    // files that spawn the same dist/index.js, so only assert it is present.
    expect(fs.existsSync(cliPath)).toBe(true);
    
    // Create the scratch directory outside the repo.
    testBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-cli-e2e-'));
  });
  
  // Clean up test directory after all tests
  afterAll(() => {
    if (testBaseDir) {
      cleanupTestDirectory(testBaseDir);
    }
  });
  
  // Clean up project directory after each test
  afterEach(() => {
    const projectDir = path.join(testBaseDir, testProjectName);
    cleanupTestDirectory(projectDir);
  });
  
  describe('Project Creation and Setup', () => {
    it('should create a complete project and add microfrontends', () => {
      const projectDir = path.join(testBaseDir, testProjectName);
      
      // Step 1: Create a new, empty project
      const createResult = runCliCommand(
        `node ${cliPath} create ${testProjectName} --template blank --package-manager npm`,
        testBaseDir
      );
      
      expect(createResult.stderr).toBe('');
      expect(createResult.stdout).toContain(`Re-Shell project "${testProjectName}" created successfully`);
      
      // Verify project structure
      const projectStructure = verifyProjectStructure(projectDir);
      expect(projectStructure.exists).toBe(true);
      expect(projectStructure.hasPackageJson).toBe(true);
      expect(projectStructure.hasAppsDir).toBe(true);
      expect(projectStructure.hasPackagesDir).toBe(true);
      // `--template blank` scaffolds an empty workspace (apps/ + packages/; a plain
      // `create` adds a react-ts app); the shell/remotes layout only exists for
      // `create --microfrontend`. The root package.json declares the standard
      // workspace globs, including services/* where `generate backend` writes.
      expect(projectStructure.hasShellApp).toBe(false);
      const rootPackageJson = fs.readJsonSync(path.join(projectDir, 'package.json'));
      expect(rootPackageJson.name).toBe(testProjectName);
      expect(rootPackageJson.workspaces).toEqual(['apps/*', 'packages/*', 'libs/*', 'tools/*', 'services/*']);
      
      // Step 2: Add a microfrontend
      const addResult = runCliCommand(
        `node ${cliPath} add ${testMfName} --template react-ts --route /${testMfName}`,
        projectDir
      );
      
      expect(addResult.stderr).toBe('');
      expect(addResult.stdout).toContain(`Microfrontend "${testMfName}" added successfully`);
      
      // Verify microfrontend structure
      const mfStructure = verifyMicrofrontendStructure(projectDir, testMfName);
      expect(mfStructure.exists).toBe(true);
      expect(mfStructure.hasPackageJson).toBe(true);
      expect(mfStructure.hasSrcDir).toBe(true);
      expect(mfStructure.hasViteConfig).toBe(true);
      expect(mfStructure.packageJson?.name).toBe(`@re-shell/${testMfName}`);
      expect(mfStructure.packageJson?.reshell?.route).toBe(`/${testMfName}`);
      
      // Step 3: Add another microfrontend
      const addResult2 = runCliCommand(
        `node ${cliPath} add ${testMfName}-2 --template react-ts --route /${testMfName}-2`,
        projectDir
      );
      
      expect(addResult2.stderr).toBe('');
      expect(addResult2.stdout).toContain(`Microfrontend "${testMfName}-2" added successfully`);
      
      // Step 4: List microfrontends
      const listResult = runCliCommand(
        `node ${cliPath} list`,
        projectDir
      );
      
      expect(listResult.stderr).toBe('');
      // `testMfName` is a prefix of `${testMfName}-2`, so match whole list
      // entries ("- <name>" on its own line) rather than substrings.
      expect(listResult.stdout).toMatch(new RegExp(`^- ${testMfName}$`, 'm'));
      expect(listResult.stdout).toMatch(new RegExp(`^- ${testMfName}-2$`, 'm'));
      
      // Step 5: Remove a microfrontend
      const removeResult = runCliCommand(
        `node ${cliPath} remove ${testMfName} --force`,
        projectDir
      );
      
      expect(removeResult.stderr).toBe('');
      expect(removeResult.stdout).toContain(`Microfrontend "${testMfName}" removed successfully`);
      
      // Verify microfrontend is removed
      expect(fs.existsSync(path.join(projectDir, 'apps', testMfName))).toBe(false);
      
      // Step 6: List microfrontends again to verify removal
      const listResult2 = runCliCommand(
        `node ${cliPath} list`,
        projectDir
      );
      
      expect(listResult2.stderr).toBe('');
      expect(listResult2.stdout).not.toMatch(new RegExp(`^- ${testMfName}$`, 'm'));
      expect(listResult2.stdout).toMatch(new RegExp(`^- ${testMfName}-2$`, 'm'));

      // The machine-readable listing must agree with the human one.
      const listJson = runCliCommand(`node ${cliPath} list --json`, projectDir);
      expect(listJson.stderr).toBe('');
      const parsed = JSON.parse(listJson.stdout.trim());
      expect(parsed.ok).toBe(true);
      expect(parsed.data.microfrontends.map((mf: { name: string }) => mf.name)).toEqual([
        `${testMfName}-2`
      ]);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', () => {
      // Run an invalid command
      const result = runCliCommand(
        `node ${cliPath} invalid-command`,
        testBaseDir
      );
      
      // Check error output
      expect(result.stderr).toContain('error: unknown command');
    });
    
    it('should handle missing required arguments', () => {
      // Run create command without project name
      const result = runCliCommand(
        `node ${cliPath} create`,
        testBaseDir
      );
      
      // Check error output
      expect(result.stderr).toContain('error: missing required argument');
    });
  });
  
  describe('Command Options', () => {
    it('should respect custom options when creating a project', () => {
      const projectDir = path.join(testBaseDir, testProjectName);
      
      // Create project with custom options
      const result = runCliCommand(
        `node ${cliPath} create ${testProjectName} --team "Test Team" --org custom-org --description "Custom project description" --package-manager yarn`,
        testBaseDir
      );
      
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain(`Re-Shell project "${testProjectName}" created successfully`);
      
      // Verify package.json has custom values
      const packageJsonPath = path.join(projectDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = fs.readJsonSync(packageJsonPath);
      expect(packageJson.description).toBe('Custom project description');
      expect(packageJson.author).toBe('Test Team');
    });
    
    it('should respect custom options when adding a microfrontend', () => {
      const projectDir = path.join(testBaseDir, testProjectName);
      
      // First create a project
      runCliCommand(
        `node ${cliPath} create ${testProjectName} --package-manager npm`,
        testBaseDir
      );
      
      // Add microfrontend with custom options
      const result = runCliCommand(
        `node ${cliPath} add ${testMfName} --team "Test Team" --org custom-org --description "Custom MF description" --template react-ts --route /custom-route --port 8080`,
        projectDir
      );
      
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain(`Microfrontend "${testMfName}" added successfully`);
      
      // Verify package.json has custom values
      const packageJsonPath = path.join(projectDir, 'apps', testMfName, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = fs.readJsonSync(packageJsonPath);
      expect(packageJson.name).toBe(`@custom-org/${testMfName}`);
      expect(packageJson.description).toBe('Custom MF description');
      expect(packageJson.reshell.route).toBe('/custom-route');
      
      // Verify vite.config.ts has custom port
      const viteConfigPath = path.join(projectDir, 'apps', testMfName, 'vite.config.ts');
      expect(fs.existsSync(viteConfigPath)).toBe(true);
      
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
      expect(viteConfig).toContain('port: 8080');
    });
  });
});
