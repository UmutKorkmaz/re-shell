/**
 * Command tree shaking and dead code elimination
 */
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

interface CommandMetadata {
  name: string;
  description: string;
  aliases?: string[];
  options?: string[];
  dependencies?: string[];
  size?: number;
  loadTime?: number;
  usage?: number;
}

interface CommandRegistry {
  commands: Map<string, CommandMetadata>;
  dependencies: Map<string, Set<string>>;
  usage: Map<string, number>;
}

export class CommandTreeShaker {
  private static instance: CommandTreeShaker;
  private registry: CommandRegistry = {
    commands: new Map(),
    dependencies: new Map(),
    usage: new Map()
  };
  
  private constructor() {
    this.loadUsageStats();
  }
  
  static getInstance(): CommandTreeShaker {
    if (!CommandTreeShaker.instance) {
      CommandTreeShaker.instance = new CommandTreeShaker();
    }
    return CommandTreeShaker.instance;
  }
  
  /**
   * Register a command with its metadata
   */
  registerCommand(metadata: CommandMetadata): void {
    this.registry.commands.set(metadata.name, metadata);
    
    // Track dependencies
    if (metadata.dependencies) {
      this.registry.dependencies.set(
        metadata.name,
        new Set(metadata.dependencies)
      );
    }
  }
  
  /**
   * Get commands that should be loaded immediately
   */
  getCriticalCommands(): string[] {
    const criticalCommands = [
      'init',
      'add',
      'serve',
      'build',
      'help',
      '--version'
    ];
    
    // Add frequently used commands based on usage stats
    const frequentCommands = Array.from(this.registry.usage.entries())
      .filter(([_, count]) => count > 10)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([cmd]) => cmd);
    
    return [...new Set([...criticalCommands, ...frequentCommands])];
  }
  
  /**
   * Get commands that can be lazy loaded
   */
  getLazyCommands(): string[] {
    const critical = new Set(this.getCriticalCommands());
    return Array.from(this.registry.commands.keys())
      .filter(cmd => !critical.has(cmd));
  }
  
  /**
   * Track command usage
   */
  trackUsage(command: string): void {
    const count = this.registry.usage.get(command) || 0;
    this.registry.usage.set(command, count + 1);
    this.saveUsageStats();
  }
  
  /**
   * Analyze command dependencies
   */
  analyzeDependencies(command: string): Set<string> {
    const visited = new Set<string>();
    const queue = [command];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      visited.add(current);
      const deps = this.registry.dependencies.get(current);
      
      if (deps) {
        deps.forEach(dep => {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        });
      }
    }
    
    return visited;
  }
  
  /**
   * Generate optimized command loader
   */
  generateOptimizedLoader(): string {
    const critical = this.getCriticalCommands();
    const lazy = this.getLazyCommands();
    
    return `
// Auto-generated optimized command loader
// Critical commands loaded immediately
const criticalCommands = {
${critical.map(cmd => `  '${cmd}': () => require('./commands/${cmd}')`).join(',\n')}
};

// Lazy-loaded commands
const lazyCommands = {
${lazy.map(cmd => `  '${cmd}': () => import('./commands/${cmd}')`).join(',\n')}
};

export function loadCommand(name: string): any {
  if (criticalCommands[name]) {
    return criticalCommands[name]();
  }
  if (lazyCommands[name]) {
    return lazyCommands[name]();
  }
  throw new Error(\`Unknown command: \${name}\`);
}
`;
  }
  
  /**
   * Optimize command imports
   */
  optimizeImports(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Replace static imports with dynamic imports for non-critical modules
    const optimized = content
      // Convert heavy library imports to dynamic
      .replace(
        /import\s+(\w+)\s+from\s+['"](?:chalk|ora|inquirer|globby|fs-extra)['"]/g,
        'const $1 = await import(\'$2\').then(m => m.default || m)'
      )
      // Convert unused imports to comments
      .replace(
        /import\s+{\s*([^}]+)\s*}\s+from\s+['"][^'"]+['"]\s*;?\s*\/\/\s*unused/gi,
        '// $&'
      );
    
    return optimized;
  }
  
  /**
   * Analyze command size
   */
  async analyzeCommandSize(commandPath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(commandPath);
      return stats.size;
    } catch {
      return 0;
    }
  }
  
  /**
   * Generate command manifest
   */
  async generateManifest(): Promise<void> {
    const manifest: Record<string, CommandMetadata> = {};
    
    for (const [name, metadata] of this.registry.commands) {
      const commandPath = path.join(__dirname, '..', 'commands', `${name}.ts`);
      const size = await this.analyzeCommandSize(commandPath);
      
      manifest[name] = {
        ...metadata,
        size,
        usage: this.registry.usage.get(name) || 0
      };
    }
    
    const manifestPath = path.join(__dirname, '..', '..', 'command-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  
  /**
   * Load usage statistics
   */
  private loadUsageStats(): void {
    try {
      const statsPath = path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        '.re-shell',
        'usage-stats.json'
      );
      
      if (fs.existsSync(statsPath)) {
        const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
        Object.entries(stats).forEach(([cmd, count]) => {
          this.registry.usage.set(cmd, count as number);
        });
      }
    } catch {
      // Ignore errors
    }
  }
  
  /**
   * Save usage statistics
   */
  private saveUsageStats(): void {
    try {
      const statsDir = path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        '.re-shell'
      );
      
      if (!fs.existsSync(statsDir)) {
        fs.mkdirSync(statsDir, { recursive: true });
      }
      
      const statsPath = path.join(statsDir, 'usage-stats.json');
      const stats: Record<string, number> = {};
      
      this.registry.usage.forEach((count, cmd) => {
        stats[cmd] = count;
      });
      
      fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch {
      // Ignore errors
    }
  }
}

export const commandTreeShaker = CommandTreeShaker.getInstance();