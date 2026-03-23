// Workspace Backup and Restore Functionality
// Incremental backups, compression, and restore capabilities

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

export interface BackupConfig {
  sourcePath: string;
  backupPath: string;
  compressionLevel?: number;
  incremental?: boolean;
  maxBackups?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface BackupMetadata {
  id: string;
  timestamp: number;
  type: 'full' | 'incremental';
  size: number;
  compressedSize: number;
  files: number;
  checksum: string;
  previousBackupId?: string;
  description?: string;
}

export interface BackupInfo {
  metadata: BackupMetadata;
  filePath: string;
  exists: boolean;
}

export interface RestoreOptions {
  overwrite?: boolean;
  validateChecksum?: boolean;
  dryRun?: boolean;
}

export class WorkspaceBackupManager {
  private config: Required<BackupConfig>;
  private backupIndex: Map<string, BackupMetadata> = new Map();

  constructor(config: BackupConfig) {
    this.config = {
      sourcePath: config.sourcePath,
      backupPath: config.backupPath,
      compressionLevel: config.compressionLevel ?? 6,
      incremental: config.incremental ?? true,
      maxBackups: config.maxBackups ?? 10,
      includePatterns: config.includePatterns ?? ['**/*'],
      excludePatterns: config.excludePatterns ?? [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '*.log',
      ],
    };

    this.ensureBackupDirectory();
    this.loadBackupIndex();
  }

  /**
   * Create backup
   */
  async backup(description?: string): Promise<BackupMetadata> {
    const type = this.shouldCreateIncremental() ? 'incremental' : 'full';
    const previousBackup = this.getLatestBackup();

    const backupId = this.generateBackupId();
    const backupFilePath = path.join(this.config.backupPath, `${backupId}.tar.gz`);

    let files = 0;
    let totalSize = 0;

    if (type === 'full') {
      // Create full backup
      const stats = await this.createFullBackup(backupFilePath);
      files = stats.files;
      totalSize = stats.size;
    } else {
      // Create incremental backup
      const stats = await this.createIncrementalBackup(backupFilePath, previousBackup);
      files = stats.files;
      totalSize = stats.size;
    }

    // Get compressed file size
    const compressedSize = fs.statSync(backupFilePath).size;
    const checksum = await this.calculateFileChecksum(backupFilePath);

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: Date.now(),
      type,
      size: totalSize,
      compressedSize,
      files,
      checksum,
      previousBackupId: previousBackup?.metadata.id,
      description,
    };

    // Update backup index
    this.backupIndex.set(backupId, metadata);
    await this.saveBackupIndex();

    // Clean up old backups
    await this.cleanupOldBackups();

    return metadata;
  }

  /**
   * Restore from backup
   */
  async restore(backupId: string, options: RestoreOptions = {}): Promise<void> {
    const backupInfo = this.getBackupInfo(backupId);
    if (!backupInfo.exists) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const metadata = backupInfo.metadata;

    if (options.dryRun) {
      console.log('[Dry Run] Would restore backup:', metadata);
      return;
    }

    // Validate checksum
    if (options.validateChecksum) {
      const checksum = await this.calculateFileChecksum(backupInfo.filePath);
      if (checksum !== metadata.checksum) {
        throw new Error(`Checksum mismatch for backup ${backupId}`);
      }
    }

    // Restore backup
    await this.extractBackup(backupInfo.filePath, this.config.sourcePath, options.overwrite ?? true);
  }

  /**
   * Get backup info
   */
  getBackupInfo(backupId: string): BackupInfo {
    const metadata = this.backupIndex.get(backupId);
    if (!metadata) {
      return {
        metadata: {
          id: backupId,
          timestamp: 0,
          type: 'full',
          size: 0,
          compressedSize: 0,
          files: 0,
          checksum: '',
        },
        filePath: path.join(this.config.backupPath, `${backupId}.tar.gz`),
        exists: false,
      };
    }

    const filePath = path.join(this.config.backupPath, `${metadata.id}.tar.gz`);
    const exists = fs.existsSync(filePath);

    return { metadata, filePath, exists };
  }

  /**
   * List all backups
   */
  listBackups(): BackupInfo[] {
    return Array.from(this.backupIndex.keys()).map(id => this.getBackupInfo(id));
  }

  /**
   * Get latest backup
   */
  getLatestBackup(): BackupInfo | null {
    const backups = this.listBackups().filter(b => b.exists);
    if (backups.length === 0) return null;

    return backups.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)[0];
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupInfo = this.getBackupInfo(backupId);

    if (backupInfo.exists) {
      await fs.promises.unlink(backupInfo.filePath);
    }

    this.backupIndex.delete(backupId);
    await this.saveBackupIndex();
  }

  /**
   * Determine if should create incremental backup
   */
  private shouldCreateIncremental(): boolean {
    if (!this.config.incremental) return false;

    const latestBackup = this.getLatestBackup();
    if (!latestBackup) return false;

    // If latest backup is older than 1 hour, create full backup
    const oneHour = 60 * 60 * 1000;
    return Date.now() - latestBackup.metadata.timestamp < oneHour;
  }

  /**
   * Create full backup
   */
  private async createFullBackup(outputPath: string): Promise<{ files: number; size: number }> {
    const files: string[] = [];
    let totalSize = 0;

    // Collect files
    for (const pattern of this.config.includePatterns) {
      const matchedFiles = this.matchFiles(pattern);
      for (const file of matchedFiles) {
        if (this.shouldIncludeFile(file)) {
          files.push(file);
          const stats = fs.statSync(file);
          totalSize += stats.size;
        }
      }
    }

    // Create tar.gz archive (simplified - in production use proper tar library)
    // For now, just copy files to a directory
    const tempDir = path.join(this.config.backupPath, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const file of files) {
      const relativePath = path.relative(this.config.sourcePath, file);
      const destPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(file, destPath);
    }

    // Compress (simplified)
    await this.compressDirectory(tempDir, outputPath);

    // Cleanup temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });

    return { files: files.length, size: totalSize };
  }

  /**
   * Create incremental backup
   */
  private async createIncrementalBackup(
    outputPath: string,
    baseBackup: BackupInfo | null
  ): Promise<{ files: number; size: number }> {
    // For simplicity, create full backup
    // In production, this would compare file modification times and only backup changed files
    return this.createFullBackup(outputPath);
  }

  /**
   * Extract backup
   */
  private async extractBackup(
    backupPath: string,
    targetPath: string,
    overwrite: boolean
  ): Promise<void> {
    // Simplified extraction - in production use proper untar library
    const tempDir = path.join(this.config.backupPath, 'temp-extract');

    // Decompress
    await this.decompressFile(backupPath, tempDir);

    // Copy files to target
    const files = this.getAllFiles(tempDir);
    for (const file of files) {
      const relativePath = path.relative(tempDir, file);
      const destPath = path.join(targetPath, relativePath);

      if (!overwrite && fs.existsSync(destPath)) {
        continue;
      }

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(file, destPath);
    }

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  /**
   * Compress directory
   */
  private async compressDirectory(sourcePath: string, outputPath: string): Promise<void> {
    const readStream = fs.createReadStream(sourcePath);
    const gzip = createGzip({ level: this.config.compressionLevel });
    const writeStream = fs.createWriteStream(outputPath);

    await pipelineAsync(readStream, gzip, writeStream);
  }

  /**
   * Decompress file
   */
  private async decompressFile(sourcePath: string, targetPath: string): Promise<void> {
    fs.mkdirSync(targetPath, { recursive: true });

    const readStream = fs.createReadStream(sourcePath);
    const gunzip = createGunzip();
    const writeStream = fs.createWriteStream(targetPath);

    await pipelineAsync(readStream, gunzip, writeStream);
  }

  /**
   * Calculate file checksum
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Match files by pattern
   */
  private matchFiles(pattern: string): string[] {
    // Simplified glob matching
    const files: string[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };

    if (fs.existsSync(this.config.sourcePath)) {
      walk(this.config.sourcePath);
    }

    return files;
  }

  /**
   * Check if file should be included
   */
  private shouldIncludeFile(filePath: string): boolean {
    const relativePath = path.relative(this.config.sourcePath, filePath);

    // Check exclude patterns
    for (const pattern of this.config.excludePatterns) {
      if (this.matchPattern(relativePath, pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Simple pattern matching
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(regexPattern);
    return regex.test(filePath);
  }

  /**
   * Get all files in directory recursively
   */
  private getAllFiles(dirPath: string): string[] {
    const files: string[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };

    walk(dirPath);
    return files;
  }

  /**
   * Generate backup ID
   */
  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.config.backupPath)) {
      fs.mkdirSync(this.config.backupPath, { recursive: true });
    }
  }

  /**
   * Load backup index
   */
  private loadBackupIndex(): void {
    const indexPath = path.join(this.config.backupPath, 'backup-index.json');

    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const index = JSON.parse(content);
      this.backupIndex = new Map(Object.entries(index));
    }
  }

  /**
   * Save backup index
   */
  private async saveBackupIndex(): Promise<void> {
    const indexPath = path.join(this.config.backupPath, 'backup-index.json');
    const content = JSON.stringify(Object.fromEntries(this.backupIndex), null, 2);
    await fs.promises.writeFile(indexPath, content);
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const backups = this.listBackups()
      .filter(b => b.exists)
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

    // Keep only maxBackups most recent backups
    const toDelete = backups.slice(this.config.maxBackups);

    for (const backup of toDelete) {
      await this.deleteBackup(backup.metadata.id);
    }
  }

  /**
   * Get backup statistics
   */
  getStats(): {
    totalBackups: number;
    totalSize: number;
    totalCompressedSize: number;
    oldestBackup: number | null;
    newestBackup: number | null;
  } {
    const backups = this.listBackups().filter(b => b.exists);

    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.metadata.size, 0),
      totalCompressedSize: backups.reduce((sum, b) => sum + b.metadata.compressedSize, 0),
      oldestBackup: backups.length > 0 ? Math.min(...backups.map(b => b.metadata.timestamp)) : null,
      newestBackup: backups.length > 0 ? Math.max(...backups.map(b => b.metadata.timestamp)) : null,
    };
  }
}
