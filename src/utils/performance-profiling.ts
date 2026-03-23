/**
 * Cross-Language Performance Profiling with Hotspot Identification
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type ProfilingLanguage = 'typescript' | 'python';

export interface ProfilingConfig {
  projectName: string;
  language: ProfilingLanguage;
  outputDir: string;
  samplingInterval: number;
  enableCPUProfiling: boolean;
  enableMemoryProfiling: boolean;
  enableHotspotDetection: boolean;
}

// TypeScript Performance Profiling (Simplified)
export function generateTypeScriptProfiling(config: ProfilingConfig): string {
  let code = '// Auto-generated Performance Profiling for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { performance, cpuUsage, memoryUsage } from \'process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface PerformanceMetric {\n';
  code += '  timestamp: number;\n';
  code += '  duration: number;\n';
  code += '  memory: NodeJS.MemoryUsage;\n';
  code += '  cpu: NodeJS.CpuUsage;\n';
  code += '  label: string;\n';
  code += '}\n\n';

  code += 'interface Hotspot {\n';
  code += '  label: string;\n';
  code += '  totalDuration: number;\n';
  code += '  avgDuration: number;\n';
  code += '  count: number;\n';
  code += '  memoryGrowth: number;\n';
  code += '}\n\n';

  code += 'class PerformanceProfiler {\n';
  code += '  private metrics: PerformanceMetric[] = [];\n';
  code += '  private stacks: Map<string, number[]> = new Map();\n';
  code += '  private samplingInterval: number;\n';
  code += '  private enableCPU: boolean;\n';
  code += '  private enableMemory: boolean;\n';
  code += '  private enableHotspots: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.samplingInterval = options.samplingInterval || 1000;\n';
  code += '    this.enableCPU = options.enableCPUProfiling !== false;\n';
  code += '    this.enableMemory = options.enableMemoryProfiling !== false;\n';
  code += '    this.enableHotspots = options.enableHotspotDetection !== false;\n';
  code += '  }\n\n';

  code += '  start(label: string): void {\n';
  code += '    const metric: PerformanceMetric = {\n';
  code += '      timestamp: Date.now(),\n';
  code += '      duration: 0,\n';
  code += '      memory: this.enableMemory ? memoryUsage() : ({} as any),\n';
  code += '      cpu: this.enableCPU ? cpuUsage() : ({} as any),\n';
  code += '      label,\n';
  code += '    };\n';
  code += '    this.metrics.push(metric);\n';
  code += '    console.log(\'[Profile] Started:\', label);\n';
  code += '  }\n\n';

  code += '  end(label: string): number {\n';
  code += '    const metric = this.metrics.find(m => m.label === label && m.duration === 0);\n';
  code += '    if (!metric) {\n';
  code += '      console.warn(\'[Profile] No start found for:\', label);\n';
  code += '      return 0;\n';
  code += '    }\n\n';

  code += '    metric.duration = performance.now();\n';
  code += '    console.log(\'[Profile] Ended:\', label, \'(\' + metric.duration.toFixed(2) + \'ms)\');\n';
  code += '    return metric.duration;\n';
  code += '  }\n\n';

  code += '  detectHotspots(): Hotspot[] {\n';
  code += '    if (!this.enableHotspots) return [];\n\n';
  code += '    const grouped = new Map<string, PerformanceMetric[]>();\n';
  code += '    for (const metric of this.metrics) {\n';
  code += '      if (!grouped.has(metric.label)) {\n';
  code += '        grouped.set(metric.label, []);\n';
  code += '      }\n';
  code += '      grouped.get(metric.label)!.push(metric);\n';
  code += '    }\n\n';

  code += '    const hotspots: Hotspot[] = [];\n';
  code += '    for (const [label, metrics] of grouped) {\n';
  code += '      const durations = metrics.map(m => m.duration).filter(d => d > 0);\n';
  code += '      if (durations.length === 0) continue;\n\n';
  code += '      const totalDuration = durations.reduce((a, b) => a + b, 0);\n';
  code += '      const avgDuration = totalDuration / durations.length;\n';
  code += '      hotspots.push({\n';
  code += '        label,\n';
  code += '        totalDuration,\n';
  code += '        avgDuration,\n';
  code += '        count: durations.length,\n';
  code += '        memoryGrowth: 0,\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return hotspots.sort((a, b) => b.totalDuration - a.totalDuration);\n';
  code += '  }\n\n';

  code += '  generateReport(): string {\n';
  code += '    let report = \'\\n=== Performance Profile Report ===\\n\\n\';\n\n';

  code += '    const hotspots = this.detectHotspots();\n';
  code += '    if (hotspots.length > 0) {\n';
  code += '      report += \'Hotspots:\\n\';\n';
  code += '      for (const spot of hotspots.slice(0, 10)) {\n';
  code += '        report += \'  - \' + spot.label + \': \' + spot.totalDuration.toFixed(2) + \'ms (avg: \' + spot.avgDuration.toFixed(2) + \'ms, count: \' + spot.count + \')\\n\';\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  exportReport(filePath: string): void {\n';
  code += '    const report = this.generateReport();\n';
  code += '    fs.writeFileSync(filePath, report);\n';
  code += '    console.log(\'[Profile] Report exported to:\', filePath);\n';
  code += '  }\n\n';

  code += '  clear(): void {\n';
  code += '    this.metrics = [];\n';
  code += '    this.stacks.clear();\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const profiler = new PerformanceProfiler({\n';
  code += '  samplingInterval: ' + config.samplingInterval + ',\n';
  code += '  enableCPUProfiling: ' + config.enableCPUProfiling + ',\n';
  code += '  enableMemoryProfiling: ' + config.enableMemoryProfiling + ',\n';
  code += '  enableHotspotDetection: ' + config.enableHotspotDetection + ',\n';
  code += '});\n\n';

  code += 'export default profiler;\n';
  code += 'export { PerformanceProfiler, PerformanceMetric, Hotspot };\n';

  return code;
}

// Python Performance Profiling (Simplified)
export function generatePythonProfiling(config: ProfilingConfig): string {
  let code = '# Auto-generated Performance Profiling for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import time\n';
  code += 'import psutil\n';
  code += 'import cProfile\n';
  code += 'import pstats\n';
  code += 'import io\n';
  code += 'from typing import List, Dict, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from collections import defaultdict\n\n';

  code += '@dataclass\n';
  code += 'class PerformanceMetric:\n';
  code += '    timestamp: float\n';
  code += '    duration: float\n';
  code += '    memory_mb: float\n';
  code += '    cpu_percent: float\n';
  code += '    label: str\n\n';

  code += '@dataclass\n';
  code += 'class Hotspot:\n';
  code += '    label: str\n';
  code += '    total_duration: float\n';
  code += '    avg_duration: float\n';
  code += '    count: int\n';
  code += '    memory_growth: float\n\n';

  code += 'class PerformanceProfiler:\n';
  code += '    def __init__(self, sampling_interval: float = 1.0, enable_cpu: bool = True, enable_memory: bool = True, enable_hotspots: bool = True):\n';
  code += '        self.metrics: List[PerformanceMetric] = []\n';
  code += '        self.sampling_interval = sampling_interval\n';
  code += '        self.enable_cpu = enable_cpu\n';
  code += '        self.enable_memory = enable_memory\n';
  code += '        self.enable_hotspots = enable_hotspots\n';
  code += '        self.process = psutil.Process()\n\n';

  code += '    def start(self, label: str) -> None:\n';
  code += '        metric = PerformanceMetric(\n';
  code += '            timestamp=time.time(),\n';
  code += '            duration=0.0,\n';
  code += '            memory_mb=self.process.memory_info().rss / 1024 / 1024 if self.enable_memory else 0.0,\n';
  code += '            cpu_percent=self.process.cpu_percent() if self.enable_cpu else 0.0,\n';
  code += '            label=label,\n';
  code += '        )\n';
  code += '        self.metrics.append(metric)\n';
  code += '        print(f\'[Profile] Started: {label}\')\n\n';

  code += '    def end(self, label: str) -> float:\n';
  code += '        metric = next((m for m in self.metrics if m.label == label and m.duration == 0.0), None)\n';
  code += '        if not metric:\n';
  code += '            print(f\'[Profile] No start found for: {label}\')\n';
  code += '            return 0.0\n\n';

  code += '        metric.duration = (time.time() - metric.timestamp) * 1000\n';
  code += '        print(f\'[Profile] Ended: {label} ({metric.duration:.2f}ms)\')\n';
  code += '        return metric.duration\n\n';

  code += '    def detect_hotspots(self) -> List[Hotspot]:\n';
  code += '        if not self.enable_hotspots:\n';
  code += '            return []\n\n';

  code += '        grouped = defaultdict(list)\n';
  code += '        for metric in self.metrics:\n';
  code += '            if metric.duration > 0:\n';
  code += '                grouped[metric.label].append(metric)\n\n';

  code += '        hotspots = []\n';
  code += '        for label, metrics in grouped.items():\n';
  code += '            durations = [m.duration for m in metrics]\n';
  code += '            total_duration = sum(durations)\n';
  code += '            avg_duration = total_duration / len(durations)\n';
  code += '            hotspots.append(Hotspot(\n';
  code += '                label=label,\n';
  code += '                total_duration=total_duration,\n';
  code += '                avg_duration=avg_duration,\n';
  code += '                count=len(durations),\n';
  code += '                memory_growth=0.0,\n';
  code += '            ))\n\n';

  code += '        return sorted(hotspots, key=lambda x: x.total_duration, reverse=True)\n\n';

  code += '    def generate_report(self) -> str:\n';
  code += '        report = \'\\n=== Performance Profile Report ===\\n\\n\'\n\n';

  code += '        hotspots = self.detect_hotspots()\n';
  code += '        if hotspots:\n';
  code += '            report += \'Hotspots:\\n\'\n';
  code += '            for spot in hotspots[:10]:\n';
  code += '                report += f\'  - {spot.label}: {spot.total_duration:.2f}ms (avg: {spot.avg_duration:.2f}ms, count: {spot.count})\\n\'\n\n';

  code += '        return report\n\n';

  code += '    def export_report(self, file_path: str) -> None:\n';
  code += '        report = self.generate_report()\n';
  code += '        with open(file_path, \'w\') as f:\n';
  code += '            f.write(report)\n';
  code += '        print(f\'[Profile] Report exported to: {file_path}\')\n\n';

  code += '    def clear(self) -> None:\n';
  code += '        self.metrics.clear()\n\n';

  code += 'profiler = PerformanceProfiler(\n';
  code += '    sampling_interval=' + config.samplingInterval + ',\n';
  code += '    enable_cpu=' + (config.enableCPUProfiling ? 'True' : 'False') + ',\n';
  code += '    enable_memory=' + (config.enableMemoryProfiling ? 'True' : 'False') + ',\n';
  code += '    enable_hotspots=' + (config.enableHotspotDetection ? 'True' : 'False') + ',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displayProfilingConfig(config: ProfilingConfig): void {
  console.log(chalk.cyan('\n✨ Performance Profiling with Hotspot Detection\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Sampling Interval:'), chalk.white(config.samplingInterval + 'ms'));
  console.log(chalk.yellow('CPU Profiling:'), chalk.white(config.enableCPUProfiling ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Memory Profiling:'), chalk.white(config.enableMemoryProfiling ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Hotspot Detection:'), chalk.white(config.enableHotspotDetection ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Cross-language performance profiling',
    'CPU and memory monitoring',
    'Hotspot identification',
    'Performance metrics tracking',
    'Automated report generation',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: ProfilingConfig): string {
  let content = '# Performance Profiling for ' + config.projectName + '\n\n';
  content += 'Cross-language performance profiling with hotspot detection for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Sampling Interval**: ' + config.samplingInterval + 'ms\n';
  content += '- **CPU Profiling**: ' + (config.enableCPUProfiling ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Memory Profiling**: ' + (config.enableMemoryProfiling ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Hotspot Detection**: ' + (config.enableHotspotDetection ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import profiler from \'./performance-profiling\';\n\n';
  content += '// Start profiling\n';
  content += 'profiler.start(\'myFunction\');\n\n';
  content += '// Your code here\n';
  content += 'myFunction();\n\n';
  content += '// End profiling\n';
  content += 'profiler.end(\'myFunction\');\n\n';
  content += '// Generate report\n';
  content += 'profiler.generateReport();\n\n';
  content += '// Detect hotspots\n';
  content += 'const hotspots = profiler.detectHotspots();\n';
  content += 'console.log(hotspots);\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from performance_profiling import profiler\n\n';
  content += '# Start profiling\n';
  content += 'profiler.start(\'my_function\')\n\n';
  content += '# Your code here\n';
  content += 'my_function()\n\n';
  content += '# End profiling\n';
  content += 'profiler.end(\'my_function\')\n\n';
  content += '# Generate report\n';
  content += 'profiler.generate_report()\n\n';
  content += '# Detect hotspots\n';
  content += 'hotspots = profiler.detect_hotspots()\n';
  content += 'print(hotspots)\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **CPU Profiling**: Monitor CPU usage during execution\n';
  content += '- **Memory Profiling**: Track memory allocation and growth\n';
  content += '- **Hotspot Detection**: Identify performance bottlenecks\n';
  content += '- **Metrics Tracking**: Record execution times and resource usage\n';
  content += '- **Report Generation**: Export detailed performance reports\n\n';

  return content;
}

// Write files
export async function writeProfilingFiles(
  config: ProfilingConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'performance-profiling.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptProfiling(config);
  } else if (config.language === 'python') {
    content = generatePythonProfiling(config);
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
      name: config.projectName.toLowerCase() + '-profiling',
      version: '1.0.0',
      description: 'Performance profiling for ' + config.projectName,
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
    const requirements = [
      'psutil>=5.9.0',
    ];

    await fs.writeFile(path.join(output, 'requirements.txt'), requirements.join('\n'));
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  const profilingConfig = {
    projectName: config.projectName,
    language: config.language,
    samplingInterval: config.samplingInterval,
    enableCPUProfiling: config.enableCPUProfiling,
    enableMemoryProfiling: config.enableMemoryProfiling,
    enableHotspotDetection: config.enableHotspotDetection,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'profiling-config.json'),
    JSON.stringify(profilingConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: profiling-config.json'));
}
