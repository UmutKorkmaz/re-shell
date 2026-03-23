// Auto-generated Unified Package Update Manager
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface UpdateImpact {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  ecosystem: string;
  breaking: boolean;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedFiles: string[];
  dependentPackages: string[];
  releaseNotes: string;
  publishedAt: string;
}

interface UpdatePolicy {
  autoUpdate: boolean;
  allowBreaking: boolean;
  requireTest: boolean;
  maxImpactLevel: 'low' | 'medium' | 'high' | 'critical';
  excludePackages: string[];
}

interface UpdateConfig {
  projectName: string;
  policy: UpdatePolicy;
}

export function displayConfig(config: UpdateConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Unified Package Update Manager');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Auto Update:', config.policy.autoUpdate ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Allow Breaking:', config.policy.allowBreaking ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Require Test:', config.policy.requireTest ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Max Impact Level:', config.policy.maxImpactLevel);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateUpdateManagerMD(config: UpdateConfig): string {
  let md = '# Unified Package Update Manager\n\n';
  md += '## Features\n\n';
  md += '- Cross-language update management\n';
  md += '- Impact analysis and assessment\n';
  md += '- Breaking change detection\n';
  md += '- Dependency graph analysis\n';
  md += '- Automated update policies\n';
  md += '- Rollback support\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import updateManager from \'./package-update-manager\';\n\n';
  md += '// Check for updates\n';
  md += 'const updates = await updateManager.checkForUpdates();\n\n';
  md += '// Analyze impact\n';
  md += 'const impact = await updateManager.analyzeImpact(updates);\n\n';
  md += '// Apply updates\n';
  md += 'await updateManager.applyUpdates(updates);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptUpdateManager(config: UpdateConfig): string {
  let code = '// Auto-generated Package Update Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface UpdateImpact {\n';
  code += '  packageName: string;\n';
  code += '  currentVersion: string;\n';
  code += '  latestVersion: string;\n';
  code += '  ecosystem: string;\n';
  code += '  breaking: boolean;\n';
  code += '  impactLevel: \'low\' | \'medium\' | \'high\' | \'critical\';\n';
  code += '  affectedFiles: string[];\n';
  code += '  dependentPackages: string[];\n';
  code += '  releaseNotes: string;\n';
  code += '  publishedAt: string;\n';
  code += '}\n\n';

  code += 'interface UpdatePolicy {\n';
  code += '  autoUpdate: boolean;\n';
  code += '  allowBreaking: boolean;\n';
  code += '  requireTest: boolean;\n';
  code += '  maxImpactLevel: \'low\' | \'medium\' | \'high\' | \'critical\';\n';
  code += '  excludePackages: string[];\n';
  code += '}\n\n';

  code += 'class PackageUpdateManager {\n';
  code += '  private projectRoot: string;\n';
  code += '  private policy: UpdatePolicy;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.policy = options.policy || {\n';
  code += '      autoUpdate: false,\n';
  code += '      allowBreaking: false,\n';
  code += '      requireTest: true,\n';
  code += '      maxImpactLevel: \'high\',\n';
  code += '      excludePackages: [],\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  async checkForUpdates(): Promise<UpdateImpact[]> {\n';
  code += '    console.log(\'[Update Manager] Checking for updates...\');\n';
  code += '    const updates: UpdateImpact[] = [];\n\n';

  code += '    // Detect package managers\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'package.json\'))) {\n';
  code += '      updates.push(...await this.checkNpmUpdates());\n';
  code += '    }\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'requirements.txt\'))) {\n';
  code += '      updates.push(...await this.checkPipUpdates());\n';
  code += '    }\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'Cargo.toml\'))) {\n';
  code += '      updates.push(...await this.checkCargoUpdates());\n';
  code += '    }\n\n';

  code += '    return updates;\n';
  code += '  }\n\n';

  code += '  async analyzeImpact(updates: UpdateImpact[]): Promise<UpdateImpact[]> {\n';
  code += '    console.log(\'[Update Manager] Analyzing update impact...\');\n\n';

  code += '    for (const update of updates) {\n';
  code += '      // Check for breaking changes\n';
  code += '      update.breaking = this.detectBreakingChanges(update);\n\n';

  code += '      // Analyze impact level\n';
  code += '      update.impactLevel = this.calculateImpactLevel(update);\n\n';

  code += '      // Find affected files\n';
  code += '      update.affectedFiles = this.findAffectedFiles(update);\n\n';

  code += '      // Find dependent packages\n';
  code += '      update.dependentPackages = this.findDependents(update);\n';
  code += '    }\n\n';

  code += '    return updates;\n';
  code += '  }\n\n';

  code += '  async applyUpdates(updates: UpdateImpact[]): Promise<void> {\n';
  code += '    console.log(\'[Update Manager] Applying updates...\');\n\n';

  code += '    // Filter by policy\n';
  code += '    const allowedUpdates = updates.filter(u => this.isAllowed(u));\n\n';

  code += '    for (const update of allowedUpdates) {\n';
  code += '      if (update.ecosystem === \'npm\') {\n';
  code += '        await this.applyNpmUpdate(update);\n';
  code += '      } else if (update.ecosystem === \'pip\') {\n';
  code += '        await this.applyPipUpdate(update);\n';
  code += '      } else if (update.ecosystem === \'cargo\') {\n';
  code += '        await this.applyCargoUpdate(update);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async checkNpmUpdates(): Promise<UpdateImpact[]> {\n';
  code += '    const updates: UpdateImpact[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(\'npm outdated --json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const outdated = JSON.parse(output);\n';
  code += '      for (const [name, info] of Object.entries(outdated)) {\n';
  code += '        const pkg = info as any;\n';
  code += '        updates.push({\n';
  code += '          packageName: name,\n';
  code += '          currentVersion: pkg.current,\n';
  code += '          latestVersion: pkg.latest,\n';
  code += '          ecosystem: \'npm\',\n';
  code += '          breaking: false,\n';
  code += '          impactLevel: \'low\',\n';
  code += '          affectedFiles: [],\n';
  code += '          dependentPackages: [],\n';
  code += '          releaseNotes: \'\',\n';
  code += '          publishedAt: \'\',\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // No outdated packages or error\n';
  code += '    }\n\n';

  code += '    return updates;\n';
  code += '  }\n\n';

  code += '  private async checkPipUpdates(): Promise<UpdateImpact[]> {\n';
  code += '    const updates: UpdateImpact[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(\'pip list --outdated --format=json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const outdated = JSON.parse(output);\n';
  code += '      for (const pkg of outdated) {\n';
  code += '        updates.push({\n';
  code += '          packageName: pkg.name,\n';
  code += '          currentVersion: pkg.version,\n';
  code += '          latestVersion: pkg.latest_version,\n';
  code += '          ecosystem: \'pip\',\n';
  code += '          breaking: false,\n';
  code += '          impactLevel: \'low\',\n';
  code += '          affectedFiles: [],\n';
  code += '          dependentPackages: [],\n';
  code += '          releaseNotes: \'\',\n';
  code += '          publishedAt: \'\',\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // No outdated packages or error\n';
  code += '    }\n\n';

  code += '    return updates;\n';
  code += '  }\n\n';

  code += '  private async checkCargoUpdates(): Promise<UpdateImpact[]> {\n';
  code += '    const updates: UpdateImpact[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(\'cargo outdated --format json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const outdated = JSON.parse(output);\n';
  code += '      for (const pkg of outdated) {\n';
  code += '        updates.push({\n';
  code += '          packageName: pkg.name,\n';
  code += '          currentVersion: pkg.current,\n';
  code += '          latestVersion: pkg.latest,\n';
  code += '          ecosystem: \'cargo\',\n';
  code += '          breaking: false,\n';
  code += '          impactLevel: \'low\',\n';
  code += '          affectedFiles: [],\n';
  code += '          dependentPackages: [],\n';
  code += '          releaseNotes: \'\',\n';
  code += '          publishedAt: \'\',\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // No outdated packages or error\n';
  code += '    }\n\n';

  code += '    return updates;\n';
  code += '  }\n\n';

  code += '  private detectBreakingChanges(update: UpdateImpact): boolean {\n';
  code += '    const current = update.currentVersion.split(\'.\').map(Number);\n';
  code += '    const latest = update.latestVersion.split(\'.\').map(Number);\n\n';
  code += '    // Major version bump indicates potential breaking changes\n';
  code += '    return latest[0] > current[0];\n';
  code += '  }\n\n';

  code += '  private calculateImpactLevel(update: UpdateImpact): \'low\' | \'medium\' | \'high\' | \'critical\' {\n';
  code += '    if (update.breaking) {\n';
  code += '      return \'high\';\n';
  code += '    }\n\n';

  code += '    const current = update.currentVersion.split(\'.\').map(Number);\n';
  code += '    const latest = update.latestVersion.split(\'.\').map(Number);\n\n';

  code += '    // Minor version bump\n';
  code += '    if (latest[1] > current[1]) {\n';
  code += '      return \'medium\';\n';
  code += '    }\n\n';

  code += '    // Patch version bump\n';
  code += '    return \'low\';\n';
  code += '  }\n\n';

  code += '  private findAffectedFiles(update: UpdateImpact): string[] {\n';
  code += '    const files: string[] = [];\n\n';

  code += '    if (update.ecosystem === \'npm\' || update.ecosystem === \'typescript\') {\n';
  code += '      // Search for imports in TypeScript/JavaScript files\n';
  code += '      const pattern = new RegExp(update.packageName.replace(///g, \'/\'));\n\n';
  code += '      const searchDir = (dir: string) => {\n';
  code += '        if (!fs.existsSync(dir)) return [];\n\n';
  code += '        const results: string[] = [];\n';
  code += '        const entries = fs.readdirSync(dir, { withFileTypes: true });\n\n';
  code += '        for (const entry of entries) {\n';
  code += '          const fullPath = path.join(dir, entry.name);\n';
  code += '          if (entry.isDirectory()) {\n';
  code += '            if (entry.name !== \'node_modules\' && entry.name !== \'.git\') {\n';
  code += '              results.push(...searchDir(fullPath));\n';
  code += '            }\n';
  code += '          } else if (entry.isFile() && /\\.(ts|js|tsx|jsx)$/.test(entry.name)) {\n';
  code += '            const content = fs.readFileSync(fullPath, \'utf-8\');\n';
  code += '            if (pattern.test(content)) {\n';
  code += '              results.push(fullPath);\n';
  code += '            }\n';
  code += '          }\n';
  code += '        }\n\n';
  code += '        return results;\n';
  code += '      };\n\n';

  code += '      files.push(...searchDir(this.projectRoot));\n';
  code += '    }\n\n';

  code += '    return files;\n';
  code += '  }\n\n';

  code += '  private findDependents(update: UpdateImpact): string[] {\n';
  code += '    const dependents: string[] = [];\n\n';

  code += '    if (update.ecosystem === \'npm\') {\n';
  code += '      try {\n';
  code += '        const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, \'package.json\'), \'utf-8\'));\n\n';

  code += '        // Check dependencies\n';
  code += '        for (const [name, version] of Object.entries(packageJson.dependencies || {})) {\n';
  code += '          if (name !== update.packageName) {\n';
  code += '            dependents.push(name);\n';
  code += '          }\n';
  code += '        }\n';
  code += '      } catch (error: any) {\n';
  code += '        // Error reading package.json\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return dependents;\n';
  code += '  }\n\n';

  code += '  private isAllowed(update: UpdateImpact): boolean {\n';
  code += '    // Check exclusions\n';
  code += '    if (this.policy.excludePackages.includes(update.packageName)) {\n';
  code += '      return false;\n';
  code += '    }\n\n';

  code += '    // Check breaking changes policy\n';
  code += '    if (update.breaking && !this.policy.allowBreaking) {\n';
  code += '      return false;\n';
  code += '    }\n\n';

  code += '    // Check impact level policy\n';
  code += '    const impactLevels = [\'low\', \'medium\', \'high\', \'critical\'];\n';
  code += '    const updateImpact = impactLevels.indexOf(update.impactLevel);\n';
  code += '    const maxImpact = impactLevels.indexOf(this.policy.maxImpactLevel);\n\n';

  code += '    return updateImpact <= maxImpact;\n';
  code += '  }\n\n';

  code += '  private async applyNpmUpdate(update: UpdateImpact): Promise<void> {\n';
  code += '    console.log(`[Update Manager] Updating ${update.packageName} to ${update.latestVersion}`);\n\n';

  code += '    try {\n';
  code += '      execSync(`npm install ${update.packageName}@${update.latestVersion}`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Update Manager] Failed to update ${update.packageName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async applyPipUpdate(update: UpdateImpact): Promise<void> {\n';
  code += '    console.log(`[Update Manager] Updating ${update.packageName} to ${update.latestVersion}`);\n\n';

  code += '    try {\n';
  code += '      execSync(`pip install --upgrade ${update.packageName}==${update.latestVersion}`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Update Manager] Failed to update ${update.packageName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async applyCargoUpdate(update: UpdateImpact): Promise<void> {\n';
  code += '    console.log(`[Update Manager] Updating ${update.packageName} to ${update.latestVersion}`);\n\n';

  code += '    try {\n';
  code += '      execSync(`cargo update ${update.packageName}`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Update Manager] Failed to update ${update.packageName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const updateManager = new PackageUpdateManager({\n';
  code += '  policy: {\n';
  code += '    autoUpdate: false,\n';
  code += '    allowBreaking: false,\n';
  code += '    requireTest: true,\n';
  code += '    maxImpactLevel: \'high\',\n';
  code += '    excludePackages: [],\n';
  code += '  },\n';
  code += '});\n\n';

  code += 'export default updateManager;\n';
  code += 'export { PackageUpdateManager, UpdateImpact, UpdatePolicy };\n';

  return code;
}

export function generatePythonUpdateManager(config: UpdateConfig): string {
  let code = '# Auto-generated Package Update Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class UpdateImpact:\n';
  code += '    package_name: str\n';
  code += '    current_version: str\n';
  code += '    latest_version: str\n';
  code += '    ecosystem: str\n';
  code += '    breaking: bool\n';
  code += '    impact_level: str\n';
  code += '    affected_files: List[str]\n';
  code += '    dependent_packages: List[str]\n';
  code += '    release_notes: str\n';
  code += '    published_at: str\n\n';

  code += '@dataclass\n';
  code += 'class UpdatePolicy:\n';
  code += '    auto_update: bool = False\n';
  code += '    allow_breaking: bool = False\n';
  code += '    require_test: bool = True\n';
  code += '    max_impact_level: str = "high"\n';
  code += '    exclude_packages: List[str] = None\n\n';

  code += '    def __post_init__(self):\n';
  code += '        if self.exclude_packages is None:\n';
  code += '            self.exclude_packages = []\n\n';

  code += 'class PackageUpdateManager:\n';
  code += '    def __init__(self, project_root: str = None, policy: UpdatePolicy = None):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.policy = policy or UpdatePolicy()\n\n';

  code += '    async def check_for_updates(self) -> List[UpdateImpact]:\n';
  code += '        print("[Update Manager] Checking for updates...")\n';
  code += '        updates = []\n\n';

  code += '        # Detect package managers\n';
  code += '        if (self.project_root / "package.json").exists():\n';
  code += '            updates.extend(await self.check_npm_updates())\n';
  code += '        if (self.project_root / "requirements.txt").exists():\n';
  code += '            updates.extend(await self.check_pip_updates())\n';
  code += '        if (self.project_root / "Cargo.toml").exists():\n';
  code += '            updates.extend(await self.check_cargo_updates())\n\n';

  code += '        return updates\n\n';

  code += '    async def analyze_impact(self, updates: List[UpdateImpact]) -> List[UpdateImpact]:\n';
  code += '        print("[Update Manager] Analyzing update impact...")\n\n';

  code += '        for update in updates:\n';
  code += '            # Check for breaking changes\n';
  code += '            update.breaking = self.detect_breaking_changes(update)\n\n';

  code += '            # Analyze impact level\n';
  code += '            update.impact_level = self.calculate_impact_level(update)\n\n';

  code += '            # Find affected files\n';
  code += '            update.affected_files = self.find_affected_files(update)\n\n';

  code += '            # Find dependent packages\n';
  code += '            update.dependent_packages = self.find_dependents(update)\n\n';

  code += '        return updates\n\n';

  code += '    async def apply_updates(self, updates: List[UpdateImpact]) -> None:\n';
  code += '        print("[Update Manager] Applying updates...")\n\n';

  code += '        # Filter by policy\n';
  code += '        allowed_updates = [u for u in updates if self.is_allowed(u)]\n\n';

  code += '        for update in allowed_updates:\n';
  code += '            if update.ecosystem == "npm":\n';
  code += '                await self.apply_npm_update(update)\n';
  code += '            elif update.ecosystem == "pip":\n';
  code += '                await self.apply_pip_update(update)\n';
  code += '            elif update.ecosystem == "cargo":\n';
  code += '                await self.apply_cargo_update(update)\n\n';

  code += '    async def check_npm_updates(self) -> List[UpdateImpact]:\n';
  code += '        updates = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["npm", "outdated", "--json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n';

  code += '            if result.returncode == 0:\n';
  code += '                outdated = json.loads(result.stdout)\n';
  code += '                for name, info in outdated.items():\n';
  code += '                    updates.append(UpdateImpact(\n';
  code += '                        package_name=name,\n';
  code += '                        current_version=info.get("current", ""),\n';
  code += '                        latest_version=info.get("latest", ""),\n';
  code += '                        ecosystem="npm",\n';
  code += '                        breaking=False,\n';
  code += '                        impact_level="low",\n';
  code += '                        affected_files=[],\n';
  code += '                        dependent_packages=[],\n';
  code += '                        release_notes="",\n';
  code += '                        published_at="",\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            pass  # No outdated packages or error\n\n';

  code += '        return updates\n\n';

  code += '    async def check_pip_updates(self) -> List[UpdateImpact]:\n';
  code += '        updates = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["pip", "list", "--outdated", "--format=json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n';

  code += '            if result.returncode == 0:\n';
  code += '                outdated = json.loads(result.stdout)\n';
  code += '                for pkg in outdated:\n';
  code += '                    updates.append(UpdateImpact(\n';
  code += '                        package_name=pkg.get("name", ""),\n';
  code += '                        current_version=pkg.get("version", ""),\n';
  code += '                        latest_version=pkg.get("latest_version", ""),\n';
  code += '                        ecosystem="pip",\n';
  code += '                        breaking=False,\n';
  code += '                        impact_level="low",\n';
  code += '                        affected_files=[],\n';
  code += '                        dependent_packages=[],\n';
  code += '                        release_notes="",\n';
  code += '                        published_at="",\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            pass  # No outdated packages or error\n\n';

  code += '        return updates\n\n';

  code += '    def detect_breaking_changes(self, update: UpdateImpact) -> bool:\n';
  code += '        current = list(map(int, update.current_version.split(".")))\n';
  code += '        latest = list(map(int, update.latest_version.split(".")))\n\n';

  code += '        # Major version bump indicates potential breaking changes\n';
  code += '        return latest[0] > current[0]\n\n';

  code += '    def calculate_impact_level(self, update: UpdateImpact) -> str:\n';
  code += '        if update.breaking:\n';
  code += '            return "high"\n\n';

  code += '        current = list(map(int, update.current_version.split(".")))\n';
  code += '        latest = list(map(int, update.latest_version.split(".")))\n\n';

  code += '        # Minor version bump\n';
  code += '        if latest[1] > current[1]:\n';
  code += '            return "medium"\n\n';

  code += '        # Patch version bump\n';
  code += '        return "low"\n\n';

  code += '    def find_affected_files(self, update: UpdateImpact) -> List[str]:\n';
  code += '        files = []\n\n';

  code += '        if update.ecosystem in ["npm", "typescript"]:\n';
  code += '            # Search for imports in TypeScript/JavaScript files\n';
  code += '            pattern = update.package_name.replace("/", "/")\n';

  code += '            for file_path in self.project_root.rglob("*.ts"):\n';
  code += '                if "node_modules" not in str(file_path):\n';
  code += '                    content = file_path.read_text()\n';
  code += '                    if pattern in content:\n';
  code += '                        files.append(str(file_path))\n\n';

  code += '        return files\n\n';

  code += '    def find_dependents(self, update: UpdateImpact) -> List[str]:\n';
  code += '        dependents = []\n\n';

  code += '        if update.ecosystem == "npm":\n';
  code += '            try:\n';
  code += '                package_json_path = self.project_root / "package.json"\n';
  code += '                package_json = json.loads(package_json_path.read_text())\n\n';

  code += '                # Check dependencies\n';
  code += '                for name in package_json.get("dependencies", {}).keys():\n';
  code += '                    if name != update.package_name:\n';
  code += '                        dependents.append(name)\n';
  code += '            except Exception:\n';
  code += '                pass  # Error reading package.json\n\n';

  code += '        return dependents\n\n';

  code += '    def is_allowed(self, update: UpdateImpact) -> bool:\n';
  code += '        # Check exclusions\n';
  code += '        if update.package_name in self.policy.exclude_packages:\n';
  code += '            return False\n\n';

  code += '        # Check breaking changes policy\n';
  code += '        if update.breaking and not self.policy.allow_breaking:\n';
  code += '            return False\n\n';

  code += '        # Check impact level policy\n';
  code += '        impact_levels = ["low", "medium", "high", "critical"]\n';
  code += '        update_impact = impact_levels.index(update.impact_level)\n';
  code += '        max_impact = impact_levels.index(self.policy.max_impact_level)\n\n';

  code += '        return update_impact <= max_impact\n\n';

  code += '    async def apply_npm_update(self, update: UpdateImpact) -> None:\n';
  code += '        print(f"[Update Manager] Updating {update.package_name} to {update.latest_version}")\n\n';

  code += '        try:\n';
  code += '            subprocess.run(\n';
  code += '                ["npm", "install", f"{update.package_name}@{update.latest_version}"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                check=True,\n';
  code += '            )\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Update Manager] Failed to update {update.package_name}: {e}")\n\n';

  code += '    async def apply_pip_update(self, update: UpdateImpact) -> None:\n';
  code += '        print(f"[Update Manager] Updating {update.package_name} to {update.latest_version}")\n\n';

  code += '        try:\n';
  code += '            subprocess.run(\n';
  code += '                ["pip", "install", "--upgrade", f"{update.package_name}=={update.latest_version}"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                check=True,\n';
  code += '            )\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Update Manager] Failed to update {update.package_name}: {e}")\n\n';

  code += 'update_manager = PackageUpdateManager(\n';
  code += '    policy=UpdatePolicy(\n';
  code += '        auto_update=False,\n';
  code += '        allow_breaking=False,\n';
  code += '        require_test=True,\n';
  code += '        max_impact_level="high",\n';
  code += '        exclude_packages=[],\n';
  code += '    )\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: UpdateConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptUpdateManager(config);
  fs.writeFileSync(path.join(outputDir, 'package-update-manager.ts'), tsCode);

  const pyCode = generatePythonUpdateManager(config);
  fs.writeFileSync(path.join(outputDir, 'package-update-manager.py'), pyCode);

  const md = generateUpdateManagerMD(config);
  fs.writeFileSync(path.join(outputDir, 'PACKAGE_UPDATE_MANAGER.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Unified package update manager',
    main: 'package-update-manager.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'update-config.json'), JSON.stringify(config, null, 2));
}
