import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

/**
 * Rollback support for failed generations with cleanup and recovery
 * Provides transaction-like safety for project generation operations
 */

export interface RollbackSnapshot {
  id: string;
  timestamp: string;
  operation: string;
  statePath: string;
  filesCreated: string[];
  filesModified: string[];
  backupPath: string;
  metadata: {
    projectName?: string;
    framework?: string;
    template?: string;
    [key: string]: any;
  };
}

export interface RollbackOptions {
  createBackup?: boolean;
  keepBackup?: boolean;
  force?: boolean;
  verbose?: boolean;
}

const SNAPSHOT_DIR = '.re-shell/rollback-snapshots';
const BACKUP_DIR = '.re-shell/backups';

/**
 * Create a rollback snapshot before making changes
 */
export async function createSnapshot(
  operation: string,
  options: RollbackOptions = {}
): Promise<string> {
  const snapshotId = `${operation}-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const snapshotPath = path.join(process.cwd(), SNAPSHOT_DIR, snapshotId);

  await fs.ensureDir(snapshotPath);

  // Capture current state
  const snapshot: RollbackSnapshot = {
    id: snapshotId,
    timestamp,
    operation,
    statePath: process.cwd(),
    filesCreated: [],
    filesModified: [],
    backupPath: path.join(process.cwd(), BACKUP_DIR, snapshotId),
    metadata: options,
  };

  // Create backup of existing files if requested
  if (options.createBackup) {
    await createBackup(snapshot.backupPath, options.verbose);
  }

  // Save snapshot metadata
  await fs.writeJson(
    path.join(snapshotPath, 'snapshot.json'),
    snapshot,
    { spaces: 2 }
  );

  if (options.verbose) {
    console.log(chalk.gray(`  Created rollback snapshot: ${snapshotId}`));
  }

  return snapshotId;
}

/**
 * Track file creation during generation
 */
export async function trackFileCreation(
  snapshotId: string,
  filePath: string
): Promise<void> {
  const snapshotPath = path.join(process.cwd(), SNAPSHOT_DIR, snapshotId);
  const snapshotFile = path.join(snapshotPath, 'snapshot.json');

  if (!(await fs.pathExists(snapshotFile))) {
    return;
  }

  const snapshot: RollbackSnapshot = await fs.readJson(snapshotFile);
  snapshot.filesCreated.push(filePath);

  await fs.writeJson(snapshotFile, snapshot, { spaces: 2 });
}

/**
 * Track file modification during generation
 */
export async function trackFileModification(
  snapshotId: string,
  filePath: string
): Promise<void> {
  const snapshotPath = path.join(process.cwd(), SNAPSHOT_DIR, snapshotId);
  const snapshotFile = path.join(snapshotPath, 'snapshot.json');

  if (!(await fs.pathExists(snapshotFile))) {
    return;
  }

  const snapshot: RollbackSnapshot = await fs.readJson(snapshotFile);
  snapshot.filesModified.push(filePath);

  await fs.writeJson(snapshotFile, snapshot, { spaces: 2 });
}

/**
 * Rollback a failed operation
 */
export async function rollbackOperation(
  snapshotId: string,
  options: RollbackOptions = {}
): Promise<boolean> {
  const snapshotPath = path.join(process.cwd(), SNAPSHOT_DIR, snapshotId);
  const snapshotFile = path.join(snapshotPath, 'snapshot.json');

  if (!(await fs.pathExists(snapshotFile))) {
    console.log(chalk.red(`\n✗ Snapshot not found: ${snapshotId}\n`));
    return false;
  }

  const snapshot: RollbackSnapshot = await fs.readJson(snapshotFile);

  console.log(chalk.yellow.bold(`\n🔄 Rolling back operation: ${snapshot.operation}\n`));
  console.log(chalk.gray(`Snapshot ID: ${snapshotId}`));
  console.log(chalk.gray(`Created: ${formatDate(snapshot.timestamp)}\n`));

  let deleted = 0;
  let restored = 0;
  let errors = 0;

  // Delete files that were created
  console.log(chalk.cyan('Removing created files...'));
  for (const filePath of snapshot.filesCreated) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.log(chalk.green(`  ✓ Removed: ${filePath}`));
        deleted++;
      }
    } catch (error: any) {
      console.log(chalk.red(`  ✗ Failed to remove: ${filePath}`));
      console.log(chalk.gray(`    Error: ${error.message}`));
      errors++;
    }
  }

  // Restore modified files from backup
  if (await fs.pathExists(snapshot.backupPath)) {
    console.log(chalk.cyan('\nRestoring modified files...'));
    const backupFiles = await fs.readdir(snapshot.backupPath);

    for (const backupFile of backupFiles) {
      try {
        const sourcePath = path.join(snapshot.backupPath, backupFile);
        const targetPath = path.join(process.cwd(), backupFile);

        await fs.copy(sourcePath, targetPath, { overwrite: true });
        console.log(chalk.green(`  ✓ Restored: ${backupFile}`));
        restored++;
      } catch (error: any) {
        console.log(chalk.red(`  ✗ Failed to restore: ${backupFile}`));
        console.log(chalk.gray(`    Error: ${error.message}`));
        errors++;
      }
    }
  }

  console.log(chalk.cyan.bold('\n📊 Rollback Summary\n'));
  console.log(chalk.green(`  Files removed: ${deleted}`));
  console.log(chalk.blue(`  Files restored: ${restored}`));
  if (errors > 0) {
    console.log(chalk.red(`  Errors: ${errors}`));
  }

  // Clean up snapshot
  if (!options.keepBackup) {
    console.log(chalk.gray('\nCleaning up snapshot...'));
    await fs.remove(snapshotPath);
    await fs.remove(snapshot.backupPath);
  }

  console.log(chalk.green('\n✓ Rollback completed\n'));

  return errors === 0;
}

/**
 * Clean up old snapshots
 */
export async function cleanupSnapshots(keepCount = 5): Promise<void> {
  const snapshotsDir = path.join(process.cwd(), SNAPSHOT_DIR);

  if (!(await fs.pathExists(snapshotsDir))) {
    return;
  }

  const snapshotDirs = await fs.readdir(snapshotsDir);

  // Sort by creation time (oldest first)
  const snapshotTimes: Array<{ id: string; time: number }> = [];

  for (const dir of snapshotDirs) {
    const snapshotPath = path.join(snapshotsDir, dir);
    const snapshotFile = path.join(snapshotPath, 'snapshot.json');

    if (await fs.pathExists(snapshotFile)) {
      const stat = await fs.stat(snapshotPath);
      snapshotTimes.push({ id: dir, time: stat.birthtimeMs });
    }
  }

  snapshotTimes.sort((a, b) => a.time - b.time);

  // Remove old snapshots
  const toRemove = snapshotTimes.slice(0, -keepCount);
  let removed = 0;

  for (const { id } of toRemove) {
    try {
      const snapshotPath = path.join(snapshotsDir, id);
      await fs.remove(snapshotPath);
      removed++;
    } catch (error) {
      // Skip if removal fails
    }
  }

  if (removed > 0) {
    console.log(chalk.gray(`\n✓ Cleaned up ${removed} old snapshot(s)\n`));
  }
}

/**
 * Execute an operation with automatic rollback on failure
 */
export async function executeWithRollback<T>(
  operation: string,
  fn: (snapshotId: string) => Promise<T>,
  options: RollbackOptions = {}
): Promise<T> {
  const snapshotId = await createSnapshot(operation, {
    ...options,
    createBackup: true,
  });

  try {
    console.log(chalk.cyan(`\n🔧 Executing: ${operation}\n`));

    const result = await fn(snapshotId);

    // Success - clean up snapshot unless keeping backups
    if (!options.keepBackup) {
      const snapshotPath = path.join(process.cwd(), SNAPSHOT_DIR, snapshotId);
      await fs.remove(snapshotPath);
      await fs.remove(path.join(process.cwd(), BACKUP_DIR, snapshotId));
    }

    console.log(chalk.green(`\n✓ Operation completed successfully\n`));

    return result;
  } catch (error: any) {
    console.log(chalk.red(`\n✗ Operation failed: ${error.message}\n`));

    // Rollback on failure
    const rollbackSuccess = await rollbackOperation(snapshotId, options);

    if (!rollbackSuccess) {
      console.log(chalk.yellow('\n⚠️  Rollback completed with errors\n'));
      console.log(chalk.yellow('Manual cleanup may be required\n'));
    }

    throw error;
  }
}

/**
 * Show available snapshots
 */
export async function listSnapshots(): Promise<void> {
  const snapshotsDir = path.join(process.cwd(), SNAPSHOT_DIR);

  if (!(await fs.pathExists(snapshotsDir))) {
    console.log(chalk.gray('\n✓ No rollback snapshots found\n'));
    return;
  }

  const snapshotDirs = await fs.readdir(snapshotsDir);

  if (snapshotDirs.length === 0) {
    console.log(chalk.gray('\n✓ No rollback snapshots found\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n📜 Available Rollback Snapshots\n'));

  for (const dir of snapshotDirs) {
    const snapshotPath = path.join(snapshotsDir, dir);
    const snapshotFile = path.join(snapshotPath, 'snapshot.json');

    if (await fs.pathExists(snapshotFile)) {
      const snapshot: RollbackSnapshot = await fs.readJson(snapshotFile);

      console.log(chalk.white(`ID: ${snapshot.id}`));
      console.log(chalk.gray(`  Operation: ${snapshot.operation}`));
      console.log(chalk.gray(`  Created: ${formatDate(snapshot.timestamp)}`));
      console.log(chalk.gray(`  Files created: ${snapshot.filesCreated.length}`));
      console.log(chalk.gray(`  Files modified: ${snapshot.filesModified.length}`));

      if (snapshot.metadata.projectName) {
        console.log(chalk.gray(`  Project: ${snapshot.metadata.projectName}`));
      }

      console.log('');
    }
  }
}

/**
 * Create backup of existing files
 */
async function createBackup(
  backupPath: string,
  verbose = false
): Promise<void> {
  await fs.ensureDir(backupPath);

  // Backup common config files
  const filesToBackup = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'tsconfig.json',
    '.gitignore',
    're-shell.workspaces.yaml',
  ];

  let backedUp = 0;

  for (const file of filesToBackup) {
    if (await fs.pathExists(path.join(process.cwd(), file))) {
      try {
        await fs.copy(
          path.join(process.cwd(), file),
          path.join(backupPath, file),
          { overwrite: true }
        );
        backedUp++;
      } catch (error) {
        // Skip files that can't be backed up
      }
    }
  }

  if (verbose && backedUp > 0) {
    console.log(chalk.gray(`  Backed up ${backedUp} file(s)`));
  }
}

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Recover from a specific snapshot
 */
export async function recoverFromSnapshot(
  snapshotId: string
): Promise<boolean> {
  const snapshotPath = path.join(process.cwd(), SNAPSHOT_DIR, snapshotId);
  const snapshotFile = path.join(snapshotPath, 'snapshot.json');

  if (!(await fs.pathExists(snapshotFile))) {
    console.log(chalk.red(`\n✗ Snapshot not found: ${snapshotId}\n`));
    return false;
  }

  const snapshot: RollbackSnapshot = await fs.readJson(snapshotFile);

  console.log(chalk.cyan.bold(`\n♻️  Recovering from snapshot\n`));
  console.log(chalk.gray(`Operation: ${snapshot.operation}`));
  console.log(chalk.gray(`Created: ${formatDate(snapshot.timestamp)}\n`));

  const { value: confirmed } = await import('prompts').then(prompts => prompts.default({
    type: 'confirm',
    name: 'value',
    message: 'Restore files from this snapshot?',
    initial: false,
  }));

  if (!confirmed) {
    console.log(chalk.yellow('\n✖ Recovery cancelled\n'));
    return false;
  }

  return await rollbackOperation(snapshotId, { keepBackup: true });
}
