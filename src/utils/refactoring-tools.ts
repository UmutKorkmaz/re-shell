/**
 * Cross-Language Refactoring Tools with Safety Checks
 *
 * Generates refactoring utilities with:
 * - Impact analysis before refactoring
 * - Safety checks and validation
 * - Cross-reference tracking
 * - Automated refactoring with undo capability
 * - Multi-language support (TypeScript, Python)
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type RefactoringLanguage = 'typescript' | 'python';

export interface RefactoringConfig {
  projectName: string;
  language: RefactoringLanguage;
  outputDir: string;
  enableSafetyChecks: boolean;
  enableBackup: boolean;
  enableUndoStack: boolean;
}

export interface RefactoringOperation {
  type: 'rename' | 'extract' | 'move' | 'inline' | 'change-signature';
  target: string;
  details: Record<string, any>;
  timestamp: number;
}

// TypeScript Refactoring Tools
export function generateTypeScriptRefactoring(config: RefactoringConfig): string {
  return `// Auto-generated Refactoring Tools for ${config.projectName}
// Generated at: ${new Date().toISOString()}

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface Impact {
  file: string;
  line: number;
  type: 'usage' | 'definition' | 'import' | 'type-reference';
  confidence: number;
}

interface RefactoringPlan {
  operation: RefactoringOperation;
  impacts: Impact[];
  risks: string[];
  estimatedChanges: number;
}

interface RefactoringOperation {
  type: 'rename' | 'extract' | 'move' | 'inline' | 'change-signature';
  target: string;
  details: Record<string, any>;
  timestamp: number;
}

class RefactoringTools {
  private projectRoot: string;
  private enableSafetyChecks: boolean;
  private enableBackup: boolean;
  private enableUndoStack: boolean;
  private undoStack: RefactoringOperation[];
  private backupDir: string;

  constructor(options: any = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.enableSafetyChecks = options.enableSafetyChecks !== false;
    this.enableBackup = options.enableBackup !== false;
    this.enableUndoStack = options.enableUndoStack !== false;
    this.undoStack = [];
    this.backupDir = path.join(this.projectRoot, '.refactor-backup');
  }

  // Analyze impact of a refactoring operation
  async analyzeImpact(target: string, operation: string): Promise<RefactoringPlan> {
    const impacts: Impact[] = await this.findUsages(target);
    const risks = this.assessRisks(impacts, operation);

    return {
      operation: {
        type: operation as any,
        target,
        details: {},
        timestamp: Date.now(),
      },
      impacts,
      risks,
      estimatedChanges: impacts.length,
    };
  }

  // Find all usages of a symbol
  async findUsages(symbol: string): Promise<Impact[]> {
    const impacts: Impact[] = [];
    const files = await this.getSourceFiles();

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\\n');

      lines.forEach((line, index) => {
        // Check for various usage patterns
        const patterns = [
          { regex: new RegExp('\\\\b' + symbol + '\\\\b'), type: 'usage' as const },
          { regex: new RegExp('(function|class|const|let|var)\\\\s+' + symbol + '\\\\b'), type: 'definition' as const },
          { regex: new RegExp('import.*\\\\b' + symbol + '\\\\b'), type: 'import' as const },
          { regex: new RegExp(':\\\\s*' + symbol + '\\\\b'), type: 'type-reference' as const },
        ];

        patterns.forEach(pattern => {
          if (pattern.regex.test(line)) {
            impacts.push({
              file: path.relative(this.projectRoot, file),
              line: index + 1,
              type: pattern.type,
              confidence: this.calculateConfidence(line, pattern.type),
            });
          }
        });
      });
    }

    return impacts;
  }

  private calculateConfidence(line: string, type: string): number {
    // Simple confidence calculation
    if (type === 'definition') return 1.0;
    if (type === 'import') return 1.0;
    if (line.includes('//')) return 0.7; // Might be commented
    return 0.9;
  }

  // Assess risks of refactoring
  assessRisks(impacts: Impact[], operation: string): string[] {
    const risks: string[] = [];
    const impactCount = impacts.length;

    if (impactCount > 100) {
      risks.push(\`Large impact: \${impactCount} files will be modified\`);
    }

    const hasExternalUsages = impacts.some(i => i.file.includes('node_modules'));
    if (hasExternalUsages) {
      risks.push('External dependencies may be affected');
    }

    const hasTestImpacts = impacts.some(i => i.file.includes('.test.') || i.file.includes('.spec.'));
    if (hasTestImpacts) {
      risks.push('Test files will be modified - ensure tests are updated');
    }

    return risks;
  }

  // Perform rename refactoring
  async rename(oldName: string, newName: string): Promise<void> {
    console.log(\`[Refactor] Renaming \${oldName} to \${newName}\`);

    // Safety check
    if (this.enableSafetyChecks) {
      const plan = await this.analyzeImpact(oldName, 'rename');
      if (plan.risks.length > 0) {
        console.warn('[Refactor] Risks detected:', plan.risks);
        const proceed = await this.confirmOperation('Rename anyway?');
        if (!proceed) return;
      }
    }

    // Create backup
    if (this.enableBackup) {
      await this.createBackup();
    }

    // Find and replace
    const files = await this.getSourceFiles();
    let changeCount = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const regex = new RegExp('\\\\b' + oldName + '\\\\b', 'g');
      const newContent = content.replace(regex, newName);

      if (content !== newContent) {
        fs.writeFileSync(file, newContent);
        changeCount++;
      }
    }

    // Add to undo stack
    if (this.enableUndoStack) {
      this.undoStack.push({
        type: 'rename',
        target: newName,
        details: { oldName },
        timestamp: Date.now(),
      });
    }

    console.log(\`[Refactor] Renamed in \${changeCount} files\`);
  }

  // Extract method/function
  async extractFunction(file: string, startLine: number, endLine: number, name: string): Promise<void> {
    console.log('[Refactor] Extracting function ' + name + ' from ' + file + ' lines ' + startLine + '-' + endLine);

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\\n');

    // Validate line range
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      throw new Error('Invalid line range');
    }

    // Extract code
    const extractedCode = lines.slice(startLine - 1, endLine).join('\\n');

    // Remove extracted code
    lines.splice(startLine - 1, endLine - startLine + 1);

    // Add function call
    lines[startLine - 1] = 'const result = ' + name + '();';

    // Add function definition at appropriate location
    const indent = '  ';
    const functionCode = [
      'function ' + name + '() {',
      ...extractedCode.split('\\n').map((l: string) => indent + l),
      '}',
      '',
    ].join('\\n');

    lines.splice(0, 0, functionCode);

    // Write back
    fs.writeFileSync(file, lines.join('\\n'));
    console.log('[Refactor] Function ' + name + ' extracted');
  }

  // Move file to new location
  async moveFile(oldPath: string, newPath: string): Promise<void> {
    console.log('[Refactor] Moving ' + oldPath + ' to ' + newPath);

    const absoluteOldPath = path.join(this.projectRoot, oldPath);
    const absoluteNewPath = path.join(this.projectRoot, newPath);

    if (!fs.existsSync(absoluteOldPath)) {
      throw new Error('File not found: ' + oldPath);
    }

    // Safety check: find imports
    if (this.enableSafetyChecks) {
      const importers = await this.findImporters(oldPath);
      if (importers.length > 0) {
        console.warn('[Refactor] ' + importers.length + ' files import ' + oldPath);
        console.warn('[Refactor] You will need to update import statements manually');
      }
    }

    // Create backup
    if (this.enableBackup) {
      await this.createBackup();
    }

    // Move file
    fs.ensureDirSync(path.dirname(absoluteNewPath));
    fs.renameSync(absoluteOldPath, absoluteNewPath);

    // Add to undo stack
    if (this.enableUndoStack) {
      this.undoStack.push({
        type: 'move',
        target: newPath,
        details: { oldPath },
        timestamp: Date.now(),
      });
    }

    console.log('[Refactor] File moved');
  }

  // Find files that import a given file
  async findImporters(targetFile: string): Promise<string[]> {
    const importers: string[] = [];
    const files = await this.getSourceFiles();

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(path.dirname(file), targetFile).replace(/\\\\/g, '/');

      if (content.includes(relativePath) || content.includes(targetFile)) {
        importers.push(file);
      }
    }

    return importers;
  }

  // Undo last refactoring
  async undo(): Promise<void> {
    if (!this.enableUndoStack || this.undoStack.length === 0) {
      console.log('[Refactor] Nothing to undo');
      return;
    }

    const lastOp = this.undoStack.pop();
    if (!lastOp) return;

    console.log('[Refactor] Undoing ' + lastOp.type + ' operation');

    // Restore from backup
    if (this.enableBackup) {
      await this.restoreBackup();
    }

    console.log('[Refactor] Undo complete');
  }

  // Get all source files
  private async getSourceFiles(): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matched = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.refactor-backup/**'],
      });
      files.push(...matched.map(f => path.join(this.projectRoot, f)));
    }

    return files;
  }

  // Create backup before refactoring
  private async createBackup(): Promise<void> {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const timestamp = Date.now();
    const backupPath = path.join(this.backupDir, timestamp.toString());

    // Copy project files
    const files = await this.getSourceFiles();
    for (const file of files) {
      const relativePath = path.relative(this.projectRoot, file);
      const backupFile = path.join(backupPath, relativePath);
      fs.ensureDirSync(path.dirname(backupFile));
      fs.copyFileSync(file, backupFile);
    }

    console.log(\`[Refactor] Backup created at \${backupPath}\`);
  }

  // Restore from backup
  private async restoreBackup(): Promise<void> {
    const backups = fs.readdirSync(this.backupDir).sort().reverse();
    if (backups.length === 0) {
      console.log('[Refactor] No backups found');
      return;
    }

    const latestBackup = path.join(this.backupDir, backups[0]);

    // Restore files
    const files = await this.getSourceFiles(latestBackup);
    for (const file of files) {
      const relativePath = path.relative(latestBackup, file);
      const targetFile = path.join(this.projectRoot, relativePath);
      fs.copyFileSync(file, targetFile);
    }

    console.log('[Refactor] Restored from backup');
  }

  // Confirm operation with user
  private async confirmOperation(message: string): Promise<boolean> {
    // In automated mode, return true
    // In interactive mode, you would prompt the user
    return true;
  }
}

const refactoringTools = new RefactoringTools({
  enableSafetyChecks: ${config.enableSafetyChecks},
  enableBackup: ${config.enableBackup},
  enableUndoStack: ${config.enableUndoStack},
});

export default refactoringTools;
export { RefactoringTools, RefactoringPlan, RefactoringOperation, Impact };
`;
}

// Python Refactoring Tools
export function generatePythonRefactoring(config: RefactoringConfig): string {
  return `# Auto-generated Refactoring Tools for ${config.projectName}
# Generated at: ${new Date().toISOString()}

import os
import re
import shutil
import glob
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Impact:
    file: str
    line: int
    type: str
    confidence: float

@dataclass
class RefactoringPlan:
    operation: Dict[str, Any]
    impacts: List[Impact]
    risks: List[str]
    estimated_changes: int

class RefactoringTools:
    def __init__(self, project_root: str = None, enable_safety_checks: bool = True,
                 enable_backup: bool = True, enable_undo_stack: bool = True):
        self.project_root = Path(project_root or os.getcwd())
        self.enable_safety_checks = enable_safety_checks
        self.enable_backup = enable_backup
        self.enable_undo_stack = enable_undo_stack
        self.undo_stack: List[Dict] = []
        self.backup_dir = self.project_root / '.refactor-backup'

    async def analyze_impact(self, target: str, operation: str) -> RefactoringPlan:
        """Analyze impact of refactoring operation."""
        impacts = await self.find_usages(target)
        risks = self.assess_risks(impacts, operation)

        return RefactoringPlan(
            operation={
                'type': operation,
                'target': target,
                'details': {},
                'timestamp': datetime.now().timestamp(),
            },
            impacts=impacts,
            risks=risks,
            estimated_changes=len(impacts),
        )

    async def find_usages(self, symbol: str) -> List[Impact]:
        """Find all usages of a symbol."""
        impacts = []
        files = self.get_source_files()

        for file_path in files:
            with open(file_path, 'r') as f:
                lines = f.readlines()

            for idx, line in enumerate(lines):
                patterns = [
                    (re.compile(r'\\\\b' + re.escape(symbol) + r'\\\\b'), 'usage'),
                    (re.compile(r'(def|class)\\\\s+' + re.escape(symbol) + r'\\\\b'), 'definition'),
                    (re.compile(r'import.*\\\\b' + re.escape(symbol) + r'\\\\b'), 'import'),
                    (re.compile(r':\\\\s*' + re.escape(symbol) + r'\\\\b'), 'type-reference'),
                ]

                for pattern, type_ in patterns:
                    if pattern.search(line):
                        impacts.append(Impact(
                            file=str(file_path.relative_to(self.project_root)),
                            line=idx + 1,
                            type=type_,
                            confidence=self.calculate_confidence(line, type_),
                        ))

        return impacts

    def calculate_confidence(self, line: str, type_: str) -> float:
        """Calculate confidence score for a match."""
        if type_ in ['definition', 'import']:
            return 1.0
        if '#' in line:
            return 0.7
        return 0.9

    def assess_risks(self, impacts: List[Impact], operation: str) -> List[str]:
        """Assess risks of refactoring."""
        risks = []

        if len(impacts) > 100:
            risks.append(f'Large impact: {len(impacts)} files will be modified')

        has_external = any('site-packages' in i.file for i in impacts)
        if has_external:
            risks.append('External dependencies may be affected')

        has_tests = any('test' in i.file for i in impacts)
        if has_tests:
            risks.append('Test files will be modified - ensure tests are updated')

        return risks

    async def rename(self, old_name: str, new_name: str) -> None:
        """Perform rename refactoring."""
        print(f'[Refactor] Renaming {old_name} to {new_name}')

        if self.enable_safety_checks:
            plan = await self.analyze_impact(old_name, 'rename')
            if plan.risks:
                print('[Refactor] Risks detected:', plan.risks)

        if self.enable_backup:
            await self.create_backup()

        files = self.get_source_files()
        change_count = 0

        for file_path in files:
            with open(file_path, 'r') as f:
                content = f.read()

            new_content = re.sub(r'\\\\b' + re.escape(old_name) + r'\\\\b', new_name, content)

            if content != new_content:
                with open(file_path, 'w') as f:
                    f.write(new_content)
                change_count += 1

        if self.enable_undo_stack:
            self.undo_stack.append({
                'type': 'rename',
                'target': new_name,
                'details': {'old_name': old_name},
                'timestamp': datetime.now().timestamp(),
            })

        print(f'[Refactor] Renamed in {change_count} files')

    async def extract_function(self, file: str, start_line: int, end_line: int, name: str) -> None:
        """Extract function/method."""
        print(f'[Refactor] Extracting function {name} from {file}')

        file_path = self.project_root / file
        with open(file_path, 'r') as f:
            lines = f.readlines()

        if start_line < 1 or end_line > len(lines) or start_line > end_line:
            raise ValueError('Invalid line range')

        extracted_code = ''.join(lines[start_line - 1:end_line])

        del lines[start_line - 1:end_line]
        lines[start_line - 1] = f'result = {name}()\\n'

        function_code = [
            f'def {name}():\\n',
            *[f'    {line}' for line in extracted_code.split('\\n')],
            '\\n',
        ]

        lines[0:0] = function_code

        with open(file_path, 'w') as f:
            f.writelines(lines)

        print(f'[Refactor] Function {name} extracted')

    async def move_file(self, old_path: str, new_path: str) -> None:
        """Move file to new location."""
        print(f'[Refactor] Moving {old_path} to {new_path}')

        absolute_old = self.project_root / old_path
        absolute_new = self.project_root / new_path

        if not absolute_old.exists():
            raise FileNotFoundError(f'File not found: {old_path}')

        if self.enable_backup:
            await self.create_backup()

        absolute_new.parent.mkdir(parents=True, exist_ok=True)
        absolute_old.rename(absolute_new)

        if self.enable_undo_stack:
            self.undo_stack.append({
                'type': 'move',
                'target': new_path,
                'details': {'old_path': old_path},
                'timestamp': datetime.now().timestamp(),
            })

        print('[Refactor] File moved')

    async def undo(self) -> None:
        """Undo last refactoring."""
        if not self.enable_undo_stack or not self.undo_stack:
            print('[Refactor] Nothing to undo')
            return

        last_op = self.undo_stack.pop()
        print(f"[Refactor] Undoing {last_op['type']} operation")

        if self.enable_backup:
            await self.restore_backup()

        print('[Refactor] Undo complete')

    def get_source_files(self) -> List[Path]:
        """Get all source files."""
        patterns = ['**/*.py', '**/*.pyi']
        files = []

        for pattern in patterns:
            for file_path in self.project_root.glob(pattern):
                if 'site-packages' not in str(file_path):
                    files.append(file_path)

        return files

    async def create_backup(self) -> None:
        """Create backup before refactoring."""
        self.backup_dir.mkdir(exist_ok=True)

        timestamp = str(int(datetime.now().timestamp()))
        backup_path = self.backup_dir / timestamp

        for file_path in self.get_source_files():
            relative_path = file_path.relative_to(self.project_root)
            backup_file = backup_path / relative_path
            backup_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, backup_file)

        print(f'[Refactor] Backup created at {backup_path}')

    async def restore_backup(self) -> None:
        """Restore from backup."""
        backups = sorted(self.backup_dir.iterdir(), reverse=True)
        if not backups:
            print('[Refactor] No backups found')
            return

        latest_backup = backups[0]
        for file_path in latest_backup.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(latest_backup)
                target_file = self.project_root / relative_path
                shutil.copy2(file_path, target_file)

        print('[Refactor] Restored from backup')

refactoring_tools = RefactoringTools(
    enable_safety_checks=${config.enableSafetyChecks},
    enable_backup=${config.enableBackup},
    enable_undo_stack=${config.enableUndoStack},
)
`;
}

// Display configuration
export function displayRefactoringConfig(config: RefactoringConfig): void {
  console.log(chalk.cyan('\n✨ Cross-Language Refactoring Tools\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Safety Checks:'), chalk.white(config.enableSafetyChecks ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Backup:'), chalk.white(config.enableBackup ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Undo Stack:'), chalk.white(config.enableUndoStack ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Impact analysis before refactoring',
    'Safety checks and risk assessment',
    'Cross-reference tracking',
    'Automated refactoring with undo',
    'Backup and restore capability',
    'Multi-language support',
  ];

  features.slice(0, 5).forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  if (features.length > 5) {
    console.log('  ' + chalk.gray('... and ' + (features.length - 5) + ' more'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: RefactoringConfig): string {
  let content = '# Cross-Language Refactoring Tools for ' + config.projectName + '\n\n';
  content += 'Safe refactoring with impact analysis for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Safety Checks**: ' + (config.enableSafetyChecks ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Backup**: ' + (config.enableBackup ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Undo Stack**: ' + (config.enableUndoStack ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 💻 Usage\n\n';

  if (config.language === 'typescript') {
    content += '```typescript\n';
    content += 'import refactoringTools from \'./refactoring-tools\';\n\n';
    content += '// Analyze impact before renaming\n';
    content += 'const plan = await refactoringTools.analyzeImpact(\'oldName\', \'rename\');\n';
    content += 'console.log(\'Impacts:\', plan.impacts.length);\n';
    content += 'console.log(\'Risks:\', plan.risks);\n\n';
    content += '// Perform rename\n';
    content += 'await refactoringTools.rename(\'oldName\', \'newName\');\n\n';
    content += '// Extract function\n';
    content += 'await refactoringTools.extractFunction(\'src/service.ts\', 10, 25, \'newFunction\');\n\n';
    content += '// Move file\n';
    content += 'await refactoringTools.moveFile(\'src/old.ts\', \'src/new/old.ts\');\n\n';
    content += '// Undo if needed\n';
    content += 'await refactoringTools.undo();\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```python\n';
    content += 'from refactoring_tools import refactoring_tools\n\n';
    content += '# Analyze impact\n';
    content += 'plan = await refactoring_tools.analyze_impact(\'old_name\', \'rename\')\n';
    content += 'print(f"Impacts: {len(plan.impacts)}")\n';
    content += 'print(f"Risks: {plan.risks}")\n\n';
    content += '# Perform rename\n';
    content += 'await refactoring_tools.rename(\'old_name\', \'new_name\')\n\n';
    content += '# Extract function\n';
    content += 'await refactoring_tools.extract_function(\'src/service.py\', 10, 25, \'new_function\')\n\n';
    content += '# Move file\n';
    content += 'await refactoring_tools.move_file(\'src/old.py\', \'src/new/old.py\')\n\n';
    content += '# Undo if needed\n';
    content += 'await refactoring_tools.undo()\n';
    content += '```\n\n';
  }

  content += '## 📚 Features\n\n';
  content += '- **Impact Analysis**: See all files affected before refactoring\n';
  content += '- **Safety Checks**: Risk assessment and warnings\n';
  content += '- **Backup**: Automatic backups before changes\n';
  content += '- **Undo**: Easy rollback of refactoring operations\n';
  content += '- **Cross-Reference**: Find all usages automatically\n';
  content += '- **Multi-Language**: Support for TypeScript and Python\n\n';

  return content;
}

// Write files
export async function writeRefactoringFiles(
  config: RefactoringConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'refactoring-tools.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptRefactoring(config);
  } else if (config.language === 'python') {
    content = generatePythonRefactoring(config);
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
      name: config.projectName.toLowerCase() + '-refactoring-tools',
      version: '1.0.0',
      description: 'Refactoring tools for ' + config.projectName,
      types: fileName,
      dependencies: {
        glob: '^10.0.0',
      },
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
    await fs.writeFile(path.join(output, 'requirements.txt'), '');
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  const refactoringConfig = {
    projectName: config.projectName,
    language: config.language,
    enableSafetyChecks: config.enableSafetyChecks,
    enableBackup: config.enableBackup,
    enableUndoStack: config.enableUndoStack,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'refactoring-config.json'),
    JSON.stringify(refactoringConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: refactoring-config.json'));
}
