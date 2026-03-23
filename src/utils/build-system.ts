/**
 * Unified Build System for Polyglot Applications with Parallel Execution
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type BuildLanguage = 'typescript' | 'python';

export interface BuildConfig {
  projectName: string;
  language: BuildLanguage;
  outputDir: string;
  enableParallel: boolean;
  enableCaching: boolean;
  enableWatch: boolean;
  maxWorkers: number;
}

// TypeScript Build System (Simplified)
export function generateTypeScriptBuild(config: BuildConfig): string {
  let code = '// Auto-generated Unified Build System for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync, spawn } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface BuildTask {\n';
  code += '  name: string;\n';
  code += '  command: string;\n';
  code += '  args: string[];\n';
  code += '  cwd: string;\n';
  code += '  dependencies: string[];\n';
  code += '  cacheKey?: string;\n';
  code += '}\n\n';

  code += 'interface BuildResult {\n';
  code += '  task: string;\n';
  code += '  success: boolean;\n';
  code += '  duration: number;\n';
  code += '  output?: string;\n';
  code += '  error?: string;\n';
  code += '}\n\n';

  code += 'class UnifiedBuildSystem {\n';
  code += '  private projectRoot: string;\n';
  code += '  private enableParallel: boolean;\n';
  code += '  private enableCaching: boolean;\n';
  code += '  private enableWatch: boolean;\n';
  code += '  private maxWorkers: number;\n';
  code += '  private cache: Map<string, BuildResult>;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.enableParallel = options.enableParallel !== false;\n';
  code += '    this.enableCaching = options.enableCaching !== false;\n';
  code += '    this.enableWatch = options.enableWatch !== false;\n';
  code += '    this.maxWorkers = options.maxWorkers || 4;\n';
  code += '    this.cache = new Map();\n';
  code += '  }\n\n';

  code += '  async build(tasks: BuildTask[]): Promise<BuildResult[]> {\n';
  code += '    console.log(\'[Build] Starting build with \' + tasks.length + \' tasks...\');\n';
  code += '    const startTime = Date.now();\n\n';

  code += '    const results: BuildResult[] = [];\n\n';

  code += '    if (this.enableParallel) {\n';
  code += '      results.push(...await this.buildParallel(tasks));\n';
  code += '    } else {\n';
  code += '      results.push(...await this.buildSequential(tasks));\n';
  code += '    }\n\n';

  code += '    const duration = Date.now() - startTime;\n';
  code += '    console.log(\'[Build] Completed in \' + (duration / 1000).toFixed(2) + \'s\');\n\n';

  code += '    return results;\n';
  code += '  }\n\n';

  code += '  private async buildParallel(tasks: BuildTask[]): Promise<BuildResult[]> {\n';
  code += '    console.log(\'[Build] Using parallel execution with \' + this.maxWorkers + \' workers\');\n';
  code += '    const results: BuildResult[] = [];\n';
  code += '    const completed = new Set<string>();\n';
  code += '    const queue = this.resolveDependencies(tasks);\n\n';

  code += '    const runTask = async (task: BuildTask): Promise<void> => {\n';
  code += '      if (completed.has(task.name)) return;\n\n';

  code += '      const result = await this.executeTask(task);\n';
  code += '      results.push(result);\n';
  code += '      completed.add(task.name);\n';
  code += '    };\n\n';

  code += '    const workers: Promise<void>[] = [];\n';
  code += '    for (const task of queue) {\n';
  code += '      if (workers.length >= this.maxWorkers) {\n';
  code += '        await Promise.race(workers);\n';
  code += '        // Remove completed worker\n';
  code += '        const completedWorker = workers.findIndex(p => {\n';
  code += '          // Check if promise resolved\n';
  code += '          return false;\n';
  code += '        });\n';
  code += '        if (completedWorker !== -1) workers.splice(completedWorker, 1);\n';
  code += '      }\n\n';

  code += '      const worker = runTask(task);\n';
  code += '      workers.push(worker);\n';
  code += '    }\n\n';

  code += '    await Promise.all(workers);\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  private async buildSequential(tasks: BuildTask[]): Promise<BuildResult[]> {\n';
  code += '    console.log(\'[Build] Using sequential execution\');\n';
  code += '    const results: BuildResult[] = [];\n\n';

  code += '    for (const task of tasks) {\n';
  code += '      const result = await this.executeTask(task);\n';
  code += '      results.push(result);\n';
  code += '    }\n\n';

  code += '    return results;\n';
  code += '  }\n\n';

  code += '  private async executeTask(task: BuildTask): Promise<BuildResult> {\n';
  code += '    const startTime = Date.now();\n\n';

  code += '    // Check cache\n';
  code += '    if (this.enableCaching && task.cacheKey && this.cache.has(task.cacheKey)) {\n';
  code += '      console.log(\'[Build] Cache hit for\', task.name);\n';
  code += '      return this.cache.get(task.cacheKey)!;\n';
  code += '    }\n\n';

  code += '    console.log(\'[Build] Executing:\', task.name);\n\n';

  code += '    try {\n';
  code += '      const output = execSync(task.command + \' \' + task.args.join(\' \'), {\n';
  code += '        cwd: path.resolve(this.projectRoot, task.cwd),\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n\n';

  code += '      const result: BuildResult = {\n';
  code += '        task: task.name,\n';
  code += '        success: true,\n';
  code += '        duration: Date.now() - startTime,\n';
  code += '        output,\n';
  code += '      };\n\n';

  code += '      if (task.cacheKey && this.enableCaching) {\n';
  code += '        this.cache.set(task.cacheKey, result);\n';
  code += '      }\n\n';

  code += '      return result;\n';
  code += '    } catch (error: any) {\n';
  code += '      const result: BuildResult = {\n';
  code += '        task: task.name,\n';
  code += '        success: false,\n';
  code += '        duration: Date.now() - startTime,\n';
  code += '        error: error.message,\n';
  code += '      };\n\n';

  code += '      return result;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private resolveDependencies(tasks: BuildTask[]): BuildTask[] {\n';
  code += '    const resolved: BuildTask[] = [];\n';
  code += '    const built = new Set<string>();\n\n';

  code += '    const addTask = (task: BuildTask) => {\n';
  code += '      if (built.has(task.name)) return;\n';
  code += '      built.add(task.name);\n';
  code += '      resolved.push(task);\n\n';

  code += '      for (const dep of task.dependencies) {\n';
  code += '        const depTask = tasks.find(t => t.name === dep);\n';
  code += '        if (depTask) addTask(depTask);\n';
  code += '      }\n';
  code += '    };\n\n';

  code += '    for (const task of tasks) {\n';
  code += '      addTask(task);\n';
  code += '    }\n\n';

  code += '    return resolved;\n';
  code += '  }\n\n';

  code += '  watch(tasks: BuildTask[]): void {\n';
  code += '    if (!this.enableWatch) {\n';
  code += '      console.warn(\'[Build] Watch mode is disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    console.log(\'[Build] Watching for changes...\');\n';
  code += '    // TODO: Implement file watching\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const buildSystem = new UnifiedBuildSystem({\n';
  code += '  enableParallel: ' + config.enableParallel + ',\n';
  code += '  enableCaching: ' + config.enableCaching + ',\n';
  code += '  enableWatch: ' + config.enableWatch + ',\n';
  code += '  maxWorkers: ' + config.maxWorkers + ',\n';
  code += '});\n\n';

  code += 'export default buildSystem;\n';
  code += 'export { UnifiedBuildSystem, BuildTask, BuildResult };\n';

  return code;
}

// Python Build System (Simplified)
export function generatePythonBuild(config: BuildConfig): string {
  let code = '# Auto-generated Unified Build System for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional\n';
  code += 'from dataclasses import dataclass, field\n';
  code += 'import asyncio\n';
  code += 'from concurrent.futures import ThreadPoolExecutor\n\n';

  code += '@dataclass\n';
  code += 'class BuildTask:\n';
  code += '    name: str\n';
  code += '    command: str\n';
  code += '    args: List[str]\n';
  code += '    cwd: str\n';
  code += '    dependencies: List[str] = field(default_factory=list)\n';
  code += '    cache_key: Optional[str] = None\n\n';

  code += '@dataclass\n';
  code += 'class BuildResult:\n';
  code += '    task: str\n';
  code += '    success: bool\n';
  code += '    duration: float\n';
  code += '    output: Optional[str] = None\n';
  code += '    error: Optional[str] = None\n\n';

  code += 'class UnifiedBuildSystem:\n';
  code += '    def __init__(self, project_root: str = None, enable_parallel: bool = True, enable_caching: bool = True, enable_watch: bool = True, max_workers: int = 4):\n';
  code += '        self.project_root = Path(project_root or \'.\')\n';
  code += '        self.enable_parallel = enable_parallel\n';
  code += '        self.enable_caching = enable_caching\n';
  code += '        self.enable_watch = enable_watch\n';
  code += '        self.max_workers = max_workers\n';
  code += '        self.cache: Dict[str, BuildResult] = {}\n\n';

  code += '    async def build(self, tasks: List[BuildTask]) -> List[BuildResult]:\n';
  code += '        print(f\'[Build] Starting build with {len(tasks)} tasks...\')\n';
  code += '        start_time = asyncio.get_event_loop().time()\n\n';

  code += '        if self.enable_parallel:\n';
  code += '            results = await self.build_parallel(tasks)\n';
  code += '        else:\n';
  code += '            results = await self.build_sequential(tasks)\n\n';

  code += '        duration = asyncio.get_event_loop().time() - start_time\n';
  code += '        print(f\'[Build] Completed in {duration:.2f}s\')\n\n';

  code += '        return results\n\n';

  code += '    async def build_parallel(self, tasks: List[BuildTask]) -> List[BuildResult]:\n';
  code += '        print(f\'[Build] Using parallel execution with {self.max_workers} workers\')\n';
  code += '        results = []\n';
  code += '        completed = set()\n';
  code += '        queue = self.resolve_dependencies(tasks)\n\n';

  code += '        def run_task(task: BuildTask) -> BuildResult:\n';
  code += '            if task.name in completed:\n';
  code += '                return None\n\n';
  code += '            result = asyncio.run(self.execute_task(task))\n';
  code += '            results.append(result)\n';
  code += '            completed.add(task.name)\n';
  code += '            return result\n\n';

  code += '        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:\n';
  code += '            list(executor.map(run_task, queue))\n\n';

  code += '        return results\n\n';

  code += '    async def build_sequential(self, tasks: List[BuildTask]) -> List[BuildResult]:\n';
  code += '        print(\'[Build] Using sequential execution\')\n';
  code += '        results = []\n\n';

  code += '        for task in tasks:\n';
  code += '            result = await self.execute_task(task)\n';
  code += '            results.append(result)\n\n';

  code += '        return results\n\n';

  code += '    async def execute_task(self, task: BuildTask) -> BuildResult:\n';
  code += '        import time\n';
  code += '        start_time = time.time()\n\n';

  code += '        # Check cache\n';
  code += '        if self.enable_caching and task.cache_key and task.cache_key in self.cache:\n';
  code += '            print(f\'[Build] Cache hit for {task.name}\')\n';
  code += '            return self.cache[task.cache_key]\n\n';

  code += '        print(f\'[Build] Executing: {task.name}\')\n\n';

  code += '        try:\n';
  code += '            cmd = [task.command] + task.args\n';
  code += '            result = subprocess.run(cmd, cwd=self.project_root / task.cwd, capture_output=True, text=True, check=True)\n\n';

  code += '            build_result = BuildResult(\n';
  code += '                task=task.name,\n';
  code += '                success=True,\n';
  code += '                duration=time.time() - start_time,\n';
  code += '                output=result.stdout,\n';
  code += '            )\n\n';

  code += '            if task.cache_key and self.enable_caching:\n';
  code += '                self.cache[task.cache_key] = build_result\n\n';

  code += '            return build_result\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            return BuildResult(\n';
  code += '                task=task.name,\n';
  code += '                success=False,\n';
  code += '                duration=time.time() - start_time,\n';
  code += '                error=str(e),\n';
  code += '            )\n\n';

  code += '    def resolve_dependencies(self, tasks: List[BuildTask]) -> List[BuildTask]:\n';
  code += '        resolved = []\n';
  code += '        built = set()\n\n';

  code += '        def add_task(task: BuildTask):\n';
  code += '            if task.name in built:\n';
  code += '                return\n';
  code += '            built.add(task.name)\n';
  code += '            resolved.append(task)\n\n';

  code += '            for dep in task.dependencies:\n';
  code += '                dep_task = next((t for t in tasks if t.name == dep), None)\n';
  code += '                if dep_task:\n';
  code += '                    add_task(dep_task)\n\n';

  code += '        for task in tasks:\n';
  code += '            add_task(task)\n\n';

  code += '        return resolved\n\n';

  code += '    def watch(self, tasks: List[BuildTask]) -> None:\n';
  code += '        if not self.enable_watch:\n';
  code += '            print(\'[Build] Watch mode is disabled\')\n';
  code += '            return\n\n';

  code += '        print(\'[Build] Watching for changes...\')\n';
  code += '        # TODO: Implement file watching\n\n';

  code += 'build_system = UnifiedBuildSystem(\n';
  code += '    enable_parallel=' + (config.enableParallel ? 'True' : 'False') + ',\n';
  code += '    enable_caching=' + (config.enableCaching ? 'True' : 'False') + ',\n';
  code += '    enable_watch=' + (config.enableWatch ? 'True' : 'False') + ',\n';
  code += '    max_workers=' + config.maxWorkers + ',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displayBuildConfig(config: BuildConfig): void {
  console.log(chalk.cyan('\n✨ Unified Build System with Parallel Execution\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Parallel Execution:'), chalk.white(config.enableParallel ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Caching:'), chalk.white(config.enableCaching ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Watch Mode:'), chalk.white(config.enableWatch ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Max Workers:'), chalk.white(config.maxWorkers));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Parallel build execution',
    'Build caching and optimization',
    'Dependency resolution',
    'Watch mode for development',
    'Multi-language support',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: BuildConfig): string {
  let content = '# Unified Build System for ' + config.projectName + '\n\n';
  content += 'Unified build system with parallel execution for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Parallel Execution**: ' + (config.enableParallel ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Caching**: ' + (config.enableCaching ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Watch Mode**: ' + (config.enableWatch ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Max Workers**: ' + config.maxWorkers + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import buildSystem from \'./build-system\';\n\n';
  content += 'const tasks = [\n';
  content += '  {\n';
  content += '    name: \'build-frontend\',\n';
  content += '    command: \'npm\',\n';
  content += '    args: [\'run\', \'build\'],\n';
  content += '    cwd: \'apps/frontend\',\n';
  content += '    dependencies: [],\n';
  content += '  },\n';
  content += '  {\n';
  content += '    name: \'build-backend\',\n';
  content += '    command: \'npm\',\n';
  content += '    args: [\'run\', \'build\'],\n';
  content += '    cwd: \'apps/backend\',\n';
  content += '    dependencies: [\'build-frontend\'],\n';
  content += '  },\n';
  content += '];\n\n';
  content += '// Build all tasks\n';
  content += 'const results = await buildSystem.build(tasks);\n';
  content += 'console.log(results);\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from build_system import build_system\n\n';
  content += 'tasks = [\n';
  content += '    BuildTask(\n';
  content += '        name=\'build-api\',\n';
  content += '        command=\'python\',\n';
  content += '        args=[\'-m\', \'build\'],\n';
  content += '        cwd=\'api\'),\n';
  content += '    ]\n\n';
  content += '# Build all tasks\n';
  content += 'results = await build_system.build(tasks)\n';
  content += 'print(results)\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **Parallel Execution**: Build multiple projects concurrently\n';
  content += '- **Dependency Resolution**: Automatic task ordering\n';
  content += '- **Build Caching**: Skip unchanged tasks\n';
  content += '- **Watch Mode**: Rebuild on file changes\n';
  content += '- **Multi-Language**: Support for TypeScript, Python, Go, and more\n\n';

  return content;
}

// Write files
export async function writeBuildFiles(
  config: BuildConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'build-system.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptBuild(config);
  } else if (config.language === 'python') {
    content = generatePythonBuild(config);
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
      name: config.projectName.toLowerCase() + '-build-system',
      version: '1.0.0',
      description: 'Unified build system for ' + config.projectName,
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

  const buildConfig = {
    projectName: config.projectName,
    language: config.language,
    enableParallel: config.enableParallel,
    enableCaching: config.enableCaching,
    enableWatch: config.enableWatch,
    maxWorkers: config.maxWorkers,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'build-config.json'),
    JSON.stringify(buildConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: build-config.json'));
}
