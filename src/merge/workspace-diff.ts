// Workspace Diff and Merge Capabilities
// Compare, diff, and merge workspace configurations

import * as fs from 'fs';

export interface DiffChange {
  type: 'added' | 'removed' | 'modified' | 'moved';
  path: string;
  oldValue?: any;
  newValue?: any;
  oldPath?: string;
}

export interface WorkspaceDiff {
  changes: DiffChange[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    moved: number;
  };
}

export interface MergeResult {
  success: boolean;
  merged: any;
  conflicts: MergeConflict[];
}

export interface MergeConflict {
  path: string;
  type: 'value' | 'structure' | 'array';
  ours: any;
  theirs: any;
  base?: any;
}

export interface MergeOptions {
  strategy?: 'ours' | 'theirs' | 'manual';
  conflictResolver?: (conflict: MergeConflict) => any;
}

export class WorkspaceDiffMerge {
  /**
   * Calculate diff between two workspace configs
   */
  diff(oldConfig: any, newConfig: any): WorkspaceDiff {
    const changes: DiffChange[] = [];
    const result = this.deepDiff(oldConfig, newConfig, '');

    // Convert result to changes
    for (const change of result) {
      changes.push(change);
    }

    // Calculate summary
    const summary = {
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      modified: changes.filter(c => c.type === 'modified').length,
      moved: changes.filter(c => c.type === 'moved').length,
    };

    return { changes, summary };
  }

  /**
   * Deep diff two objects
   */
  private deepDiff(oldObj: any, newObj: any, path: string): DiffChange[] {
    const changes: DiffChange[] = [];

    // Handle null/undefined
    if (!oldObj || !newObj) {
      if (oldObj !== newObj) {
        changes.push({
          type: 'modified',
          path,
          oldValue: oldObj,
          newValue: newObj,
        });
      }
      return changes;
    }

    // Handle primitives
    if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
      if (oldObj !== newObj) {
        changes.push({
          type: 'modified',
          path,
          oldValue: oldObj,
          newValue: newObj,
        });
      }
      return changes;
    }

    // Handle arrays
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      const maxLength = Math.max(oldObj.length, newObj.length);

      for (let i = 0; i < maxLength; i++) {
        const itemPath = path ? `${path}[${i}]` : `[${i}]`;

        if (i >= oldObj.length) {
          changes.push({
            type: 'added',
            path: itemPath,
            newValue: newObj[i],
          });
        } else if (i >= newObj.length) {
          changes.push({
            type: 'removed',
            path: itemPath,
            oldValue: oldObj[i],
          });
        } else {
          changes.push(...this.deepDiff(oldObj[i], newObj[i], itemPath));
        }
      }

      return changes;
    }

    // Handle objects
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;

      if (!(key in oldObj)) {
        changes.push({
          type: 'added',
          path: keyPath,
          newValue: newObj[key],
        });
      } else if (!(key in newObj)) {
        changes.push({
          type: 'removed',
          path: keyPath,
          oldValue: oldObj[key],
        });
      } else {
        changes.push(...this.deepDiff(oldObj[key], newObj[key], keyPath));
      }
    }

    return changes;
  }

  /**
   * Format diff as human-readable text
   */
  formatDiff(diff: WorkspaceDiff): string {
    let output = '';

    if (diff.summary.added > 0) {
      output += `\nAdded (${diff.summary.added}):\n`;
      for (const change of diff.changes.filter(c => c.type === 'added')) {
        output += `  + ${change.path}: ${JSON.stringify(change.newValue)}\n`;
      }
    }

    if (diff.summary.removed > 0) {
      output += `\nRemoved (${diff.summary.removed}):\n`;
      for (const change of diff.changes.filter(c => c.type === 'removed')) {
        output += `  - ${change.path}: ${JSON.stringify(change.oldValue)}\n`;
      }
    }

    if (diff.summary.modified > 0) {
      output += `\nModified (${diff.summary.modified}):\n`;
      for (const change of diff.changes.filter(c => c.type === 'modified')) {
        output += `  ~ ${change.path}:\n`;
        output += `    old: ${JSON.stringify(change.oldValue)}\n`;
        output += `    new: ${JSON.stringify(change.newValue)}\n`;
      }
    }

    return output || 'No changes';
  }

  /**
   * Apply diff to a config
   */
  applyDiff(config: any, diff: WorkspaceDiff): any {
    const result = this.deepClone(config);

    for (const change of diff.changes) {
      switch (change.type) {
        case 'added':
          this.setNestedValue(result, change.path, change.newValue);
          break;

        case 'removed':
          this.deleteNestedValue(result, change.path);
          break;

        case 'modified':
          this.setNestedValue(result, change.path, change.newValue);
          break;
      }
    }

    return result;
  }

  /**
   * Merge two configs with conflict detection
   */
  merge(base: any, ours: any, theirs: any, options: MergeOptions = {}): MergeResult {
    const conflicts: MergeConflict[] = [];
    const merged = this.deepClone(base);

    // Recursive merge
    this.deepMerge(merged, ours, theirs, '', conflicts);

    // Resolve conflicts
    if (conflicts.length > 0) {
      if (options.strategy === 'ours') {
        for (const conflict of conflicts) {
          this.setNestedValue(merged, conflict.path, conflict.ours);
        }
        conflicts.length = 0;
      } else if (options.strategy === 'theirs') {
        for (const conflict of conflicts) {
          this.setNestedValue(merged, conflict.path, conflict.theirs);
        }
        conflicts.length = 0;
      } else if (options.conflictResolver) {
        for (const conflict of conflicts) {
          const resolved = options.conflictResolver(conflict);
          this.setNestedValue(merged, conflict.path, resolved);
        }
        conflicts.length = 0;
      }
    }

    return {
      success: conflicts.length === 0,
      merged,
      conflicts,
    };
  }

  /**
   * Deep merge with conflict detection
   */
  private deepMerge(
    result: any,
    ours: any,
    theirs: any,
    path: string,
    conflicts: MergeConflict[]
  ): void {
    // Handle primitives
    if (typeof ours !== 'object' || typeof theirs !== 'object') {
      if (ours !== theirs) {
        conflicts.push({
          path,
          type: 'value',
          ours,
          theirs,
          base: result,
        });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(ours) && Array.isArray(theirs)) {
      // Array merge strategy: concatenate and remove duplicates
      const merged = [...new Set([...result, ...ours, ...theirs])];
      this.setNestedValue(result, path, merged);
      return;
    }

    // Handle objects
    const allKeys = new Set([...Object.keys(ours), ...Object.keys(theirs)]);

    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;

      const hasOurs = key in ours;
      const hasTheirs = key in theirs;

      if (hasOurs && hasTheirs) {
        const oursValue = ours[key];
        const theirsValue = theirs[key];
        const resultValue = result?.[key];

        if (JSON.stringify(oursValue) !== JSON.stringify(theirsValue)) {
          if (typeof oursValue === 'object' && typeof theirsValue === 'object') {
            this.deepMerge(resultValue, oursValue, theirsValue, keyPath, conflicts);
          } else {
            conflicts.push({
              path: keyPath,
              type: 'value',
              ours: oursValue,
              theirs: theirsValue,
              base: resultValue,
            });
          }
        }
      } else if (hasOurs) {
        result[key] = ours[key];
      } else if (hasTheirs) {
        result[key] = theirs[key];
      }
    }
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Delete nested value from object
   */
  private deleteNestedValue(obj: any, path: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return;
      }
    }

    if (current && typeof current === 'object') {
      delete current[keys[keys.length - 1]];
    }
  }

  /**
   * Deep clone object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Export diff to file
   */
  async exportDiff(diff: WorkspaceDiff, filePath: string): Promise<void> {
    const content = JSON.stringify(diff, null, 2);
    await fs.promises.writeFile(filePath, content);
  }

  /**
   * Import diff from file
   */
  async importDiff(filePath: string): Promise<WorkspaceDiff> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Generate patch file
   */
  generatePatch(oldConfig: any, newConfig: any): string {
    const diff = this.diff(oldConfig, newConfig);
    return JSON.stringify(diff, null, 2);
  }

  /**
   * Apply patch file
   */
  applyPatch(config: any, patchContent: string): any {
    const diff: WorkspaceDiff = JSON.parse(patchContent);
    return this.applyDiff(config, diff);
  }
}

export const workspaceDiffMerge = new WorkspaceDiffMerge();
