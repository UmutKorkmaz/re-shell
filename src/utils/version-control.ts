/**
 * Unified Version Control Integration for Polyglot Repos with Merge Strategies
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type VCLanguage = 'typescript' | 'python';

export interface VCConfig {
  projectName: string;
  language: VCLanguage;
  outputDir: string;
  enableAutoMerge: boolean;
  enableConflictResolution: boolean;
  enableBranchStrategies: boolean;
  defaultBranch: string;
}

// TypeScript Version Control Integration (Simplified)
export function generateTypeScriptVC(config: VCConfig): string {
  let code = '// Auto-generated Version Control Integration for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface MergeStrategy {\n';
  code += '  name: string;\n';
  code += '  description: string;\n';
  code += '  priority: number;\n';
  code += '  autoMerge: boolean;\n';
  code += '}\n\n';

  code += 'interface Conflict {\n';
  code += '  file: string;\n';
  code += '  line: number;\n';
  code += '  ours: string;\n';
  code += '  theirs: string;\n';
  code += '  base?: string;\n';
  code += '}\n\n';

  code += 'interface BranchInfo {\n';
  code += '  name: string;\n';
  code += '  isDefault: boolean;\n';
  code += '  status: string;\n';
  code += '  ahead: number;\n';
  code += '  behind: number;\n';
  code += '}\n\n';

  code += 'class VersionControlManager {\n';
  code += '  private projectRoot: string;\n';
  code += '  private enableAutoMerge: boolean;\n';
  code += '  private enableConflictResolution: boolean;\n';
  code += '  private enableBranchStrategies: boolean;\n';
  code += '  private defaultBranch: string;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.enableAutoMerge = options.enableAutoMerge !== false;\n';
  code += '    this.enableConflictResolution = options.enableConflictResolution !== false;\n';
  code += '    this.enableBranchStrategies = options.enableBranchStrategies !== false;\n';
  code += '    this.defaultBranch = options.defaultBranch || \'main\';\n';
  code += '  }\n\n';

  code += '  getStatus(): string {\n';
  code += '    try {\n';
  code += '      return execSync(\'git status --porcelain\', { cwd: this.projectRoot, encoding: \'utf-8\' });\n';
  code += '    } catch (error: any) {\n';
  code += '      return \'\';\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  getCurrentBranch(): string {\n';
  code += '    try {\n';
  code += '      return execSync(\'git rev-parse --abbrev-ref HEAD\', { cwd: this.projectRoot, encoding: \'utf-8\' }).trim();\n';
  code += '    } catch (error: any) {\n';
  code += '      return \'unknown\';\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  getBranchInfo(): BranchInfo[] {\n';
  code += '    const branches: BranchInfo[] = [];\n';
  code += '    const current = this.getCurrentBranch();\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'git branch -vv\', { cwd: this.projectRoot, encoding: \'utf-8\' });\n';
  code += '      const lines = output.split(\'\\n\');\n\n';

  code += '      for (const line of lines) {\n';
  code += '        const isCurrent = line.startsWith(\'*\');\n';
  code += '        const name = line.replace(/^[*\\s]+/, \' \').split(/\\s+/)[0];\n';
  code += '        branches.push({\n';
  code += '          name,\n';
  code += '          isDefault: name === this.defaultBranch,\n';
  code += '          status: isCurrent ? \'current\' : \'remote\',\n';
  code += '          ahead: 0,\n';
  code += '          behind: 0,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // Ignore error\n';
  code += '    }\n\n';

  code += '    return branches;\n';
  code += '  }\n\n';

  code += '  async merge(branch: string, strategy?: string): Promise<boolean> {\n';
  code += '    console.log(\'[VC] Merging\', branch, \'into\', this.getCurrentBranch());\n\n';

  code += '    try {\n';
  code += '      if (strategy) {\n';
  code += '        execSync(`git merge --strategy=${strategy} ${branch}`, { cwd: this.projectRoot, stdio: \'inherit\' });\n';
  code += '      } else {\n';
  code += '        execSync(`git merge ${branch}`, { cwd: this.projectRoot, stdio: \'inherit\' });\n';
  code += '      }\n';
  code += '      return true;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[VC] Merge failed:\', error.message);\n';
  code += '      return false;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  detectConflicts(): Conflict[] {\n';
  code += '    const conflicts: Conflict[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'git diff --name-only --diff-filter=U\', { cwd: this.projectRoot, encoding: \'utf-8\' });\n';
  code += '      const files = output.trim().split(\'\\n\').filter(f => f);\n\n';

  code += '      for (const file of files) {\n';
  code += '        conflicts.push({\n';
  code += '          file,\n';
  code += '          line: 0,\n';
  code += '          ours: \'\',\n';
  code += '          theirs: \'\',\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // No conflicts or git error\n';
  code += '    }\n\n';

  code += '    return conflicts;\n';
  code += '  }\n\n';

  code += '  resolveConflict(file: string, resolution: \'ours\' | \'theirs\' | \'manual\'): void {\n';
  code += '    if (!this.enableConflictResolution) {\n';
  code += '      console.warn(\'[VC] Conflict resolution is disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    console.log(\'[VC] Resolving conflict in\', file, \'with\', resolution);\n\n';

  code += '    if (resolution === \'ours\') {\n';
  code += '      execSync(`git checkout --ours ${file}`, { cwd: this.projectRoot });\n';
  code += '      execSync(`git add ${file}`, { cwd: this.projectRoot });\n';
  code += '    } else if (resolution === \'theirs\') {\n';
  code += '      execSync(`git checkout --theirs ${file}`, { cwd: this.projectRoot });\n';
  code += '      execSync(`git add ${file}`, { cwd: this.projectRoot });\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async createBranch(name: string, fromBranch?: string): Promise<void> {\n';
  code += '    console.log(\'[VC] Creating branch\', name);\n\n';

  code += '    if (fromBranch) {\n';
  code += '      execSync(`git checkout -b ${name} ${fromBranch}`, { cwd: this.projectRoot, stdio: \'inherit\' });\n';
  code += '    } else {\n';
  code += '      execSync(`git checkout -b ${name}`, { cwd: this.projectRoot, stdio: \'inherit\' });\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async switchBranch(name: string): Promise<void> {\n';
  code += '    console.log(\'[VC] Switching to branch\', name);\n';
  code += '    execSync(`git checkout ${name}`, { cwd: this.projectRoot, stdio: \'inherit\' });\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const vcManager = new VersionControlManager({\n';
  code += '  enableAutoMerge: ' + config.enableAutoMerge + ',\n';
  code += '  enableConflictResolution: ' + config.enableConflictResolution + ',\n';
  code += '  enableBranchStrategies: ' + config.enableBranchStrategies + ',\n';
  code += '  defaultBranch: \'' + config.defaultBranch + '\',\n';
  code += '});\n\n';

  code += 'export default vcManager;\n';
  code += 'export { VersionControlManager, MergeStrategy, Conflict, BranchInfo };\n';

  return code;
}

// Python Version Control Integration (Simplified)
export function generatePythonVC(config: VCConfig): string {
  let code = '# Auto-generated Version Control Integration for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class MergeStrategy:\n';
  code += '    name: str\n';
  code += '    description: str\n';
  code += '    priority: int\n';
  code += '    auto_merge: bool\n\n';

  code += '@dataclass\n';
  code += 'class Conflict:\n';
  code += '    file: str\n';
  code += '    line: int\n';
  code += '    ours: str\n';
  code += '    theirs: str\n';
  code += '    base: Optional[str] = None\n\n';

  code += '@dataclass\n';
  code += 'class BranchInfo:\n';
  code += '    name: str\n';
  code += '    is_default: bool\n';
  code += '    status: str\n';
  code += '    ahead: int\n';
  code += '    behind: int\n\n';

  code += 'class VersionControlManager:\n';
  code += '    def __init__(self, project_root: str = None, enable_auto_merge: bool = True, enable_conflict_resolution: bool = True, enable_branch_strategies: bool = True, default_branch: str = "main"):\n';
  code += '        self.project_root = Path(project_root or \'.\')\n';
  code += '        self.enable_auto_merge = enable_auto_merge\n';
  code += '        self.enable_conflict_resolution = enable_conflict_resolution\n';
  code += '        self.enable_branch_strategies = enable_branch_strategies\n';
  code += '        self.default_branch = default_branch\n\n';

  code += '    def get_status(self) -> str:\n';
  code += '        try:\n';
  code += '            return subprocess.run([\'git\', \'status\', \'--porcelain\'], cwd=self.project_root, capture_output=True, text=True).stdout\n';
  code += '        except subprocess.CalledProcessError:\n';
  code += '            return ""\n\n';

  code += '    def get_current_branch(self) -> str:\n';
  code += '        try:\n';
  code += '            return subprocess.run([\'git\', \'rev-parse\', \'--abbrev-ref\', \'HEAD\'], cwd=self.project_root, capture_output=True, text=True).stdout.strip()\n';
  code += '        except subprocess.CalledProcessError:\n';
  code += '            return "unknown"\n\n';

  code += '    def get_branch_info(self) -> List[BranchInfo]:\n';
  code += '        branches = []\n';
  code += '        current = self.get_current_branch()\n\n';

  code += '        try:\n';
  code += '            output = subprocess.run([\'git\', \'branch\', \'-vv\'], cwd=self.project_root, capture_output=True, text=True).stdout\n';
  code += '            lines = output.strip().split("\\n")\n\n';

  code += '            for line in lines:\n';
  code += '                is_current = line.startswith(\'*\')\n';
  code += '                name = line.lstrip("*\\s").split()[0]\n';
  code += '                branches.append(BranchInfo(\n';
  code += '                    name=name,\n';
  code += '                    is_default=(name == self.default_branch),\n';
  code += '                    status="current" if is_current else "remote",\n';
  code += '                    ahead=0,\n';
  code += '                    behind=0,\n';
  code += '                ))\n';
  code += '        except subprocess.CalledProcessError:\n';
  code += '            pass\n\n';

  code += '        return branches\n\n';

  code += '    async def merge(self, branch: str, strategy: str = None) -> bool:\n';
  code += '        print(f\'[VC] Merging {branch} into {self.get_current_branch()}\')\n\n';

  code += '        try:\n';
  code += '            if strategy:\n';
  code += '                subprocess.run([\'git\', \'merge\', \'--strategy=\' + strategy + "\', branch], cwd=self.project_root, check=True)\n';
  code += '            else:\n';
  code += '                subprocess.run([\'git\', \'merge\', branch], cwd=self.project_root, check=True)\n';
  code += '            return True\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f\'[VC] Merge failed: {e}\')\n';
  code += '            return False\n\n';

  code += '    def detect_conflicts(self) -> List[Conflict]:\n';
  code += '        conflicts = []\n\n';

  code += '        try:\n';
  code += '            output = subprocess.run([\'git\', \'diff\', \'--name-only\', \'--diff-filter=U\'], cwd=self.project_root, capture_output=True, text=True).stdout\n';
  code += '            files = output.strip().split("\\n")\n';
  code += '            files = [f for f in files if f]\n\n';

  code += '            for file in files:\n';
  code += '                conflicts.append(Conflict(\n';
  code += '                    file=file,\n';
  code += '                    line=0,\n';
  code += '                    ours="",\n';
  code += '                    theirs="",\n';
  code += '                ))\n';
  code += '        except subprocess.CalledProcessError:\n';
  code += '            pass\n\n';

  code += '        return conflicts\n\n';

  code += '    def resolve_conflict(self, file: str, resolution: str) -> None:\n';
  code += '        if not self.enable_conflict_resolution:\n';
  code += '            print(\'[VC] Conflict resolution is disabled\')\n';
  code += '            return\n\n';

  code += '        print(f\'[VC] Resolving conflict in {file} with {resolution}\')\n\n';

  code += '        if resolution == "ours":\n';
  code += '            subprocess.run([\'git\', \'checkout\', \'--ours\', file], cwd=self.project_root)\n';
  code += '            subprocess.run([\'git\', \'add\', file], cwd=self.project_root)\n';
  code += '        elif resolution == "theirs":\n';
  code += '            subprocess.run([\'git\', \'checkout\', \'--theirs\', file], cwd=self.project_root)\n';
  code += '            subprocess.run([\'git\', \'add\', file], cwd=self.project_root)\n\n';

  code += '    async def create_branch(self, name: str, from_branch: str = None) -> None:\n';
  code += '        print(f\'[VC] Creating branch {name}\')\n\n';

  code += '        if from_branch:\n';
  code += '            subprocess.run([\'git\', \'checkout\', \'-b\', name, from_branch], cwd=self.project_root, check=True)\n';
  code += '        else:\n';
  code += '            subprocess.run([\'git\', \'checkout\', \'-b\', name], cwd=self.project_root, check=True)\n\n';

  code += '    async def switch_branch(self, name: str) -> None:\n';
  code += '        print(f\'[VC] Switching to branch {name}\')\n';
  code += '        subprocess.run([\'git\', \'checkout\', name], cwd=self.project_root, check=True)\n\n';

  code += 'vc_manager = VersionControlManager(\n';
  code += '    enable_auto_merge=' + (config.enableAutoMerge ? 'True' : 'False') + ',\n';
  code += '    enable_conflict_resolution=' + (config.enableConflictResolution ? 'True' : 'False') + ',\n';
  code += '    enable_branch_strategies=' + (config.enableBranchStrategies ? 'True' : 'False') + ',\n';
  code += '    default_branch=\'' + config.defaultBranch + '\',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displayVCConfig(config: VCConfig): void {
  console.log(chalk.cyan('\n✨ Unified Version Control Integration with Merge Strategies\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Auto Merge:'), chalk.white(config.enableAutoMerge ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Conflict Resolution:'), chalk.white(config.enableConflictResolution ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Branch Strategies:'), chalk.white(config.enableBranchStrategies ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Default Branch:'), chalk.white(config.defaultBranch));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Git integration and automation',
    'Branch management and strategies',
    'Merge conflict detection and resolution',
    'Auto-merge capabilities',
    'Multi-language repository support',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: VCConfig): string {
  let content = '# Unified Version Control Integration for ' + config.projectName + '\n\n';
  content += 'Unified version control integration with merge strategies for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Auto Merge**: ' + (config.enableAutoMerge ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Conflict Resolution**: ' + (config.enableConflictResolution ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Branch Strategies**: ' + (config.enableBranchStrategies ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Default Branch**: ' + config.defaultBranch + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import vcManager from \'./version-control\';\n\n';
  content += '// Get current branch\n';
  content += 'const branch = vcManager.getCurrentBranch();\n';
  content += 'console.log(branch);\n\n';
  content += '// Merge a branch\n';
  content += 'const success = await vcManager.merge(\'feature-branch\');\n\n';
  content += '// Detect conflicts\n';
  content += 'const conflicts = vcManager.detectConflicts();\n';
  content += 'console.log(conflicts);\n\n';
  content += '// Resolve conflict\n';
  content += 'vcManager.resolveConflict(\'src/file.ts\', \'ours\');\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from version_control import vc_manager\n\n';
  content += '# Get current branch\n';
  content += 'branch = vc_manager.get_current_branch()\n';
  content += 'print(branch)\n\n';
  content += '# Merge a branch\n';
  content += 'success = await vc_manager.merge(\'feature-branch\')\n\n';
  content += '# Detect conflicts\n';
  content += 'conflicts = vc_manager.detect_conflicts()\n';
  content += 'print(conflicts)\n\n';
  content += '# Resolve conflict\n';
  content += 'vc_manager.resolve_conflict(\'src/file.py\', \'ours\')\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **Git Integration**: Automate Git operations across languages\n';
  content += '- **Branch Management**: Create, switch, and manage branches\n';
  content += '- **Merge Strategies**: Configurable merge approaches\n';
  content += '- **Conflict Resolution**: Automatic and manual conflict resolution\n';
  content += '- **Status Tracking**: Monitor repository and branch status\n\n';

  return content;
}

// Write files
export async function writeVCFiles(
  config: VCConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'version-control.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptVC(config);
  } else if (config.language === 'python') {
    content = generatePythonVC(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  const buildMD = generateBuildMD(config);
  await fs.writeFile(path.join(output, 'BUILD.md'), buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  if (config.language === 'typescript') {
    const packageJson = {
      name: config.projectName.toLowerCase() + '-version-control',
      version: '1.0.0',
      description: 'Version control integration for ' + config.projectName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    await fs.writeFile(
      path.join(output, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    console.log(chalk.green('✅ Generated: package.json'));
  }

  if (config.language === 'python') {
    const requirements = [];

    await fs.writeFile(path.join(output, 'requirements.txt'), requirements.join('\n') || '# No dependencies\n');
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  const vcConfig = {
    projectName: config.projectName,
    language: config.language,
    enableAutoMerge: config.enableAutoMerge,
    enableConflictResolution: config.enableConflictResolution,
    enableBranchStrategies: config.enableBranchStrategies,
    defaultBranch: config.defaultBranch,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'vc-config.json'),
    JSON.stringify(vcConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: vc-config.json'));
}
