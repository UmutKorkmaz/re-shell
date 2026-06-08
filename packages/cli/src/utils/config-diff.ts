import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import { ValidationError } from './error-handler';

// Diff operation types
export type DiffOperation = 'add' | 'remove' | 'change' | 'move' | 'no-change';

// Diff entry representing a single change
export interface DiffEntry {
  operation: DiffOperation;
  path: string;
  oldValue?: any;
  newValue?: any;
  type?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'structure' | 'value' | 'type' | 'metadata';
}

// Diff result containing all changes
export interface ConfigDiff {
  summary: {
    total: number;
    added: number;
    removed: number;
    changed: number;
    moved: number;
    unchanged: number;
  };
  changes: DiffEntry[];
  metadata: {
    comparedAt: string;
    leftSource: string;
    rightSource: string;
    algorithm: string;
  };
}

// Merge strategy options
export interface MergeStrategy {
  arrayMerge: 'replace' | 'concat' | 'union' | 'intersect' | 'custom';
  conflictResolution: 'left' | 'right' | 'interactive' | 'custom';
  preserveComments: boolean;
  preserveOrder: boolean;
  customResolver?: (left: any, right: any, path: string) => any;
}

// Merge result
export interface MergeResult {
  merged: any;
  conflicts: ConflictEntry[];
  warnings: string[];
  metadata: {
    mergedAt: string;
    strategy: MergeStrategy;
    leftSource: string;
    rightSource: string;
  };
}

// Conflict entry for merge operations
export interface ConflictEntry {
  path: string;
  leftValue: any;
  rightValue: any;
  resolution: 'left' | 'right' | 'custom' | 'unresolved';
  resolvedValue?: any;
  reason: string;
}

// Configuration differ and merger
export class ConfigDiffer {
  private readonly options: {
    ignoreOrder?: boolean;
    ignorePaths?: string[];
    includeMetadata?: boolean;
    deepComparison?: boolean;
  };

  constructor(options: {
    ignoreOrder?: boolean;
    ignorePaths?: string[];
    includeMetadata?: boolean;
    deepComparison?: boolean;
  } = {}) {
    this.options = {
      ignoreOrder: false,
      ignorePaths: [],
      includeMetadata: true,
      deepComparison: true,
      ...options
    };
  }

  // Compare two configuration objects
  async diff(
    left: any, 
    right: any,
    leftSource = 'left',
    rightSource = 'right'
  ): Promise<ConfigDiff> {
    const changes: DiffEntry[] = [];
    const startTime = new Date().toISOString();

    // Perform deep comparison
    this.deepDiff(left, right, '', changes);

    // Calculate summary
    const summary = this.calculateSummary(changes);

    return {
      summary,
      changes,
      metadata: {
        comparedAt: startTime,
        leftSource,
        rightSource,
        algorithm: 'deep-recursive'
      }
    };
  }

  // Compare configuration files
  async diffFiles(leftPath: string, rightPath: string): Promise<ConfigDiff> {
    try {
      const leftContent = await fs.readFile(leftPath, 'utf8');
      const rightContent = await fs.readFile(rightPath, 'utf8');

      const left = yaml.parse(leftContent);
      const right = yaml.parse(rightContent);

      return this.diff(left, right, leftPath, rightPath);
    } catch (error) {
      throw new ValidationError(`Failed to diff files: ${(error as Error).message}`);
    }
  }

  // Merge two configuration objects
  async merge(
    left: any,
    right: any,
    strategy: MergeStrategy,
    leftSource = 'left',
    rightSource = 'right'
  ): Promise<MergeResult> {
    const conflicts: ConflictEntry[] = [];
    const warnings: string[] = [];
    const startTime = new Date().toISOString();

    const merged = this.deepMerge(left, right, '', strategy, conflicts, warnings);

    return {
      merged,
      conflicts,
      warnings,
      metadata: {
        mergedAt: startTime,
        strategy,
        leftSource,
        rightSource
      }
    };
  }

  // Merge configuration files
  async mergeFiles(
    leftPath: string,
    rightPath: string,
    outputPath: string,
    strategy: MergeStrategy
  ): Promise<MergeResult> {
    try {
      const leftContent = await fs.readFile(leftPath, 'utf8');
      const rightContent = await fs.readFile(rightPath, 'utf8');

      const left = yaml.parse(leftContent);
      const right = yaml.parse(rightContent);

      const result = await this.merge(left, right, strategy, leftPath, rightPath);

      // Write merged result
      await fs.ensureDir(path.dirname(outputPath));
      const mergedContent = yaml.stringify(result.merged);
      await fs.writeFile(outputPath, mergedContent, 'utf8');

      return result;
    } catch (error) {
      throw new ValidationError(`Failed to merge files: ${(error as Error).message}`);
    }
  }

  // Apply a diff to a configuration
  async applyDiff(base: any, diff: ConfigDiff): Promise<any> {
    const result = JSON.parse(JSON.stringify(base)); // Deep clone

    for (const change of diff.changes) {
      switch (change.operation) {
        case 'add':
          this.setValueAtPath(result, change.path, change.newValue);
          break;
        case 'remove':
          this.removeValueAtPath(result, change.path);
          break;
        case 'change':
          this.setValueAtPath(result, change.path, change.newValue);
          break;
        // Note: 'move' operations would require more complex handling
      }
    }

    return result;
  }

  // Generate a human-readable diff report
  generateDiffReport(diff: ConfigDiff, format: 'text' | 'html' | 'json' = 'text'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(diff, null, 2);
      case 'html':
        return this.generateHtmlReport(diff);
      case 'text':
      default:
        return this.generateTextReport(diff);
    }
  }

  // Deep comparison implementation
  private deepDiff(left: any, right: any, currentPath: string, changes: DiffEntry[]): void {
    // Skip ignored paths
    if (this.options.ignorePaths?.some(ignorePath => currentPath.startsWith(ignorePath))) {
      return;
    }

    const leftType = this.getValueType(left);
    const rightType = this.getValueType(right);

    // Handle null/undefined cases
    if (left === undefined && right !== undefined) {
      changes.push({
        operation: 'add',
        path: currentPath,
        newValue: right,
        type: rightType,
        description: `Added ${rightType} value`,
        severity: 'medium',
        category: 'structure'
      });
      return;
    }

    if (left !== undefined && right === undefined) {
      changes.push({
        operation: 'remove',
        path: currentPath,
        oldValue: left,
        type: leftType,
        description: `Removed ${leftType} value`,
        severity: 'medium',
        category: 'structure'
      });
      return;
    }

    if (left === undefined && right === undefined) {
      return;
    }

    // Type change detection
    if (leftType !== rightType) {
      changes.push({
        operation: 'change',
        path: currentPath,
        oldValue: left,
        newValue: right,
        type: `${leftType} → ${rightType}`,
        description: `Type changed from ${leftType} to ${rightType}`,
        severity: 'high',
        category: 'type'
      });
      return;
    }

    // Handle different types
    if (leftType === 'object') {
      this.diffObjects(left, right, currentPath, changes);
    } else if (leftType === 'array') {
      this.diffArrays(left, right, currentPath, changes);
    } else {
      // Primitive comparison
      if (left !== right) {
        changes.push({
          operation: 'change',
          path: currentPath,
          oldValue: left,
          newValue: right,
          type: leftType,
          description: `Value changed from ${this.formatValue(left)} to ${this.formatValue(right)}`,
          severity: this.getSeverityForPath(currentPath),
          category: 'value'
        });
      }
    }
  }

  // Compare objects
  private diffObjects(left: any, right: any, currentPath: string, changes: DiffEntry[]): void {
    const leftKeys = new Set(Object.keys(left));
    const rightKeys = new Set(Object.keys(right));
    const allKeys = new Set([...leftKeys, ...rightKeys]);

    for (const key of allKeys) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      
      if (leftKeys.has(key) && rightKeys.has(key)) {
        // Key exists in both
        this.deepDiff(left[key], right[key], newPath, changes);
      } else if (leftKeys.has(key)) {
        // Key only in left (removed)
        changes.push({
          operation: 'remove',
          path: newPath,
          oldValue: left[key],
          type: this.getValueType(left[key]),
          description: `Removed property '${key}'`,
          severity: 'medium',
          category: 'structure'
        });
      } else {
        // Key only in right (added)
        changes.push({
          operation: 'add',
          path: newPath,
          newValue: right[key],
          type: this.getValueType(right[key]),
          description: `Added property '${key}'`,
          severity: 'medium',
          category: 'structure'
        });
      }
    }
  }

  // Compare arrays
  private diffArrays(left: any[], right: any[], currentPath: string, changes: DiffEntry[]): void {
    if (this.options.ignoreOrder) {
      // Order-independent comparison
      this.diffArraysIgnoreOrder(left, right, currentPath, changes);
    } else {
      // Order-dependent comparison
      this.diffArraysWithOrder(left, right, currentPath, changes);
    }
  }

  // Array comparison ignoring order
  private diffArraysIgnoreOrder(left: any[], right: any[], currentPath: string, changes: DiffEntry[]): void {
    const leftSet = new Set(left.map(item => JSON.stringify(item)));
    const rightSet = new Set(right.map(item => JSON.stringify(item)));

    // Find added items
    for (const item of right) {
      const itemStr = JSON.stringify(item);
      if (!leftSet.has(itemStr)) {
        changes.push({
          operation: 'add',
          path: `${currentPath}[*]`,
          newValue: item,
          type: this.getValueType(item),
          description: `Added array item`,
          severity: 'low',
          category: 'value'
        });
      }
    }

    // Find removed items
    for (const item of left) {
      const itemStr = JSON.stringify(item);
      if (!rightSet.has(itemStr)) {
        changes.push({
          operation: 'remove',
          path: `${currentPath}[*]`,
          oldValue: item,
          type: this.getValueType(item),
          description: `Removed array item`,
          severity: 'low',
          category: 'value'
        });
      }
    }
  }

  // Array comparison preserving order
  private diffArraysWithOrder(left: any[], right: any[], currentPath: string, changes: DiffEntry[]): void {
    const maxLength = Math.max(left.length, right.length);

    for (let i = 0; i < maxLength; i++) {
      const newPath = `${currentPath}[${i}]`;
      
      if (i < left.length && i < right.length) {
        // Both have element at index i
        this.deepDiff(left[i], right[i], newPath, changes);
      } else if (i < left.length) {
        // Left has more elements
        changes.push({
          operation: 'remove',
          path: newPath,
          oldValue: left[i],
          type: this.getValueType(left[i]),
          description: `Removed array element at index ${i}`,
          severity: 'low',
          category: 'structure'
        });
      } else {
        // Right has more elements
        changes.push({
          operation: 'add',
          path: newPath,
          newValue: right[i],
          type: this.getValueType(right[i]),
          description: `Added array element at index ${i}`,
          severity: 'low',
          category: 'structure'
        });
      }
    }
  }

  // Deep merge implementation
  private deepMerge(
    left: any,
    right: any,
    currentPath: string,
    strategy: MergeStrategy,
    conflicts: ConflictEntry[],
    warnings: string[]
  ): any {
    // Handle null/undefined cases
    if (left === undefined || left === null) return right;
    if (right === undefined || right === null) return left;

    const leftType = this.getValueType(left);
    const rightType = this.getValueType(right);

    // Type mismatch - create conflict
    if (leftType !== rightType) {
      const conflict: ConflictEntry = {
        path: currentPath,
        leftValue: left,
        rightValue: right,
        resolution: strategy.conflictResolution === 'interactive' ? 'unresolved' : strategy.conflictResolution,
        reason: `Type mismatch: ${leftType} vs ${rightType}`
      };

      if (strategy.conflictResolution === 'left') {
        conflict.resolvedValue = left;
      } else if (strategy.conflictResolution === 'right') {
        conflict.resolvedValue = right;
      } else if (strategy.customResolver) {
        conflict.resolvedValue = strategy.customResolver(left, right, currentPath);
        conflict.resolution = 'custom';
      }

      conflicts.push(conflict);
      return conflict.resolvedValue !== undefined ? conflict.resolvedValue : left;
    }

    // Handle different types
    if (leftType === 'object') {
      return this.mergeObjects(left, right, currentPath, strategy, conflicts, warnings);
    } else if (leftType === 'array') {
      return this.mergeArrays(left, right, currentPath, strategy, conflicts, warnings);
    } else {
      // Primitive values - check for conflicts
      if (left !== right) {
        const conflict: ConflictEntry = {
          path: currentPath,
          leftValue: left,
          rightValue: right,
          resolution: strategy.conflictResolution === 'interactive' ? 'unresolved' : strategy.conflictResolution,
          reason: 'Value conflict'
        };

        if (strategy.conflictResolution === 'left') {
          conflict.resolvedValue = left;
        } else if (strategy.conflictResolution === 'right') {
          conflict.resolvedValue = right;
        } else if (strategy.customResolver) {
          conflict.resolvedValue = strategy.customResolver(left, right, currentPath);
          conflict.resolution = 'custom';
        }

        conflicts.push(conflict);
        return conflict.resolvedValue !== undefined ? conflict.resolvedValue : right;
      }
      
      return left; // No conflict
    }
  }

  // Merge objects
  private mergeObjects(
    left: any,
    right: any,
    currentPath: string,
    strategy: MergeStrategy,
    conflicts: ConflictEntry[],
    warnings: string[]
  ): any {
    const result: any = { ...left };
    
    for (const [key, rightValue] of Object.entries(right)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      
      if (key in left) {
        result[key] = this.deepMerge(left[key], rightValue, newPath, strategy, conflicts, warnings);
      } else {
        result[key] = rightValue;
      }
    }

    return result;
  }

  // Merge arrays
  private mergeArrays(
    left: any[],
    right: any[],
    currentPath: string,
    strategy: MergeStrategy,
    conflicts: ConflictEntry[],
    warnings: string[]
  ): any[] {
    switch (strategy.arrayMerge) {
      case 'replace':
        return right;
      case 'concat':
        return [...left, ...right];
      case 'union':
        {
        const unionSet = new Set([...left, ...right].map(item => JSON.stringify(item)));
        return Array.from(unionSet).map(item => JSON.parse(item));
        }
      case 'intersect':
        {
        const leftSet = new Set(left.map(item => JSON.stringify(item)));
        return right.filter(item => leftSet.has(JSON.stringify(item)));
        }
      case 'custom':
        if (strategy.customResolver) {
          return strategy.customResolver(left, right, currentPath);
        }
        warnings.push(`Custom array merge resolver not provided for ${currentPath}, using concat`);
        return [...left, ...right];
      default:
        return right;
    }
  }

  // Utility methods
  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') return `"${value}"`;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    return String(value);
  }

  private getSeverityForPath(path: string): 'low' | 'medium' | 'high' | 'critical' {
    // Define critical paths that should have high severity
    const criticalPaths = ['name', 'version', 'packageManager'];
    const highPaths = ['framework', 'template', 'type'];
    const mediumPaths = ['build', 'dev', 'quality'];

    const pathParts = path.split('.');
    const firstPart = pathParts[0];

    if (criticalPaths.includes(firstPart)) return 'critical';
    if (highPaths.includes(firstPart)) return 'high';
    if (mediumPaths.includes(firstPart)) return 'medium';
    return 'low';
  }

  private calculateSummary(changes: DiffEntry[]): ConfigDiff['summary'] {
    const summary = {
      total: changes.length,
      added: 0,
      removed: 0,
      changed: 0,
      moved: 0,
      unchanged: 0
    };

    for (const change of changes) {
      switch (change.operation) {
        case 'add':
          summary.added++;
          break;
        case 'remove':
          summary.removed++;
          break;
        case 'change':
          summary.changed++;
          break;
        case 'move':
          summary.moved++;
          break;
        case 'no-change':
          summary.unchanged++;
          break;
      }
    }

    return summary;
  }

  private setValueAtPath(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = obj;
    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  private removeValueAtPath(obj: any, path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = obj;
    for (const key of keys) {
      if (!(key in current)) return;
      current = current[key];
    }
    
    delete current[lastKey];
  }

  private generateTextReport(diff: ConfigDiff): string {
    const lines: string[] = [];
    
    lines.push(chalk.cyan('Configuration Diff Report'));
    lines.push(chalk.gray('='.repeat(40)));
    lines.push('');
    
    lines.push(chalk.blue('Summary:'));
    lines.push(`  Total changes: ${diff.summary.total}`);
    lines.push(`  Added: ${chalk.green(diff.summary.added)}`);
    lines.push(`  Removed: ${chalk.red(diff.summary.removed)}`);
    lines.push(`  Changed: ${chalk.yellow(diff.summary.changed)}`);
    lines.push(`  Moved: ${chalk.blue(diff.summary.moved)}`);
    lines.push('');

    if (diff.changes.length > 0) {
      lines.push(chalk.blue('Changes:'));
      
      for (const change of diff.changes) {
        const severity = change.severity || 'low';
        const severityColor = {
          low: chalk.gray,
          medium: chalk.yellow,
          high: chalk.red,
          critical: chalk.bgRed.white
        }[severity];

        let symbol = '';
        let color = chalk.white;
        
        switch (change.operation) {
          case 'add':
            symbol = '+';
            color = chalk.green;
            break;
          case 'remove':
            symbol = '-';
            color = chalk.red;
            break;
          case 'change':
            symbol = '~';
            color = chalk.yellow;
            break;
          case 'move':
            symbol = '→';
            color = chalk.blue;
            break;
        }

        lines.push(`  ${color(symbol)} ${change.path} ${severityColor(`[${severity}]`)}`);
        if (change.description) {
          lines.push(`    ${chalk.gray(change.description)}`);
        }
        
        if (change.operation === 'change' && change.oldValue !== undefined && change.newValue !== undefined) {
          lines.push(`    ${chalk.red(`- ${this.formatValue(change.oldValue)}`)}`);
          lines.push(`    ${chalk.green(`+ ${this.formatValue(change.newValue)}`)}`);
        } else if (change.operation === 'add' && change.newValue !== undefined) {
          lines.push(`    ${chalk.green(`+ ${this.formatValue(change.newValue)}`)}`);
        } else if (change.operation === 'remove' && change.oldValue !== undefined) {
          lines.push(`    ${chalk.red(`- ${this.formatValue(change.oldValue)}`)}`);
        }
        
        lines.push('');
      }
    }

    lines.push(chalk.gray(`Generated at: ${diff.metadata.comparedAt}`));
    lines.push(chalk.gray(`Algorithm: ${diff.metadata.algorithm}`));
    
    return lines.join('\n');
  }

  private generateHtmlReport(diff: ConfigDiff): string {
    // Basic HTML report implementation
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Configuration Diff Report</title>
    <style>
        body { font-family: monospace; margin: 20px; }
        .summary { background: #f5f5f5; padding: 10px; margin: 10px 0; }
        .change { margin: 5px 0; padding: 5px; }
        .add { background: #e8f5e8; }
        .remove { background: #ffe8e8; }
        .change-op { background: #fff8e8; }
        .critical { border-left: 5px solid red; }
        .high { border-left: 5px solid orange; }
        .medium { border-left: 5px solid yellow; }
        .low { border-left: 5px solid gray; }
    </style>
</head>
<body>
    <h1>Configuration Diff Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total changes: ${diff.summary.total}</p>
        <p>Added: ${diff.summary.added}</p>
        <p>Removed: ${diff.summary.removed}</p>
        <p>Changed: ${diff.summary.changed}</p>
    </div>
    <div class="changes">
        <h2>Changes</h2>
        ${diff.changes.map(change => `
            <div class="change ${change.operation} ${change.severity || 'low'}">
                <strong>${change.path}</strong> - ${change.operation}
                <br><small>${change.description || ''}</small>
            </div>
        `).join('')}
    </div>
    <footer>
        <p>Generated at: ${diff.metadata.comparedAt}</p>
    </footer>
</body>
</html>`;
  }
}

// Default merge strategies
export const MergeStrategies = {
  // Prefer left (base) configuration
  leftWins: (): MergeStrategy => ({
    arrayMerge: 'replace',
    conflictResolution: 'left',
    preserveComments: true,
    preserveOrder: true
  }),

  // Prefer right (incoming) configuration
  rightWins: (): MergeStrategy => ({
    arrayMerge: 'replace',
    conflictResolution: 'right',
    preserveComments: true,
    preserveOrder: true
  }),

  // Smart merge with array concatenation
  smartMerge: (): MergeStrategy => ({
    arrayMerge: 'union',
    conflictResolution: 'right',
    preserveComments: true,
    preserveOrder: false
  }),

  // Conservative merge (preserve existing)
  conservative: (): MergeStrategy => ({
    arrayMerge: 'concat',
    conflictResolution: 'left',
    preserveComments: true,
    preserveOrder: true
  }),

  // Interactive merge (requires user input)
  interactive: (): MergeStrategy => ({
    arrayMerge: 'union',
    conflictResolution: 'interactive',
    preserveComments: true,
    preserveOrder: false
  })
};

// Export singleton instance
export const configDiffer = new ConfigDiffer();