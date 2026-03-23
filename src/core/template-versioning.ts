import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as semver from 'semver';
import * as crypto from 'crypto';
import { Template } from './template-engine';

export interface TemplateVersion {
  version: string;
  releaseDate: Date;
  changelog: string;
  breaking: boolean;
  deprecated?: boolean;
  minimumCliVersion?: string;
  maximumCliVersion?: string;
  checksum: string;
  size: number;
  downloads?: number;
}

export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  versions: TemplateVersion[];
  repository?: string;
  homepage?: string;
  issues?: string;
  updateChannel: 'stable' | 'beta' | 'edge';
  autoUpdate: boolean;
  lastChecked?: Date;
  installedVersion?: string;
  installedPath?: string;
}

export interface UpdateCheckResult {
  id: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  isBreaking: boolean;
  changelog?: string;
  installCommand?: string;
  updateUrl?: string;
}

export interface UpdateOptions {
  prerelease?: boolean;
  force?: boolean;
  backup?: boolean;
  dryRun?: boolean;
  channel?: 'stable' | 'beta' | 'edge';
}

export interface MigrationScript {
  fromVersion: string;
  toVersion: string;
  description: string;
  automatic: boolean;
  script: (template: Template, context: any) => Promise<Template>;
  rollback?: (template: Template, context: any) => Promise<Template>;
}

export interface VersioningConfig {
  registryUrl?: string;
  checkInterval?: number; // milliseconds
  autoCheck?: boolean;
  autoUpdate?: boolean;
  backupBeforeUpdate?: boolean;
  maxBackups?: number;
  cacheDirectory?: string;
}

export class TemplateVersionManager extends EventEmitter {
  private manifests: Map<string, TemplateManifest> = new Map();
  private migrations: Map<string, MigrationScript[]> = new Map();
  private updateCheckInterval?: NodeJS.Timeout;
  private cacheDir: string;

  private defaultConfig: VersioningConfig = {
    registryUrl: 'https://registry.re-shell.dev/templates',
    checkInterval: 24 * 60 * 60 * 1000, // 24 hours
    autoCheck: true,
    autoUpdate: false,
    backupBeforeUpdate: true,
    maxBackups: 5
  };

  constructor(
    private templatesDir: string,
    private config: VersioningConfig = {}
  ) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.cacheDir = this.config.cacheDirectory || path.join(templatesDir, '.cache');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await fs.ensureDir(this.cacheDir);
    await this.loadManifests();
    
    if (this.config.autoCheck) {
      this.startUpdateChecking();
    }
  }

  private async loadManifests(): Promise<void> {
    const manifestPath = path.join(this.cacheDir, 'manifests.json');
    
    if (await fs.pathExists(manifestPath)) {
      try {
        const data = await fs.readJson(manifestPath);
        for (const [id, manifest] of Object.entries(data)) {
          this.manifests.set(id, manifest as TemplateManifest);
        }
      } catch (error) {
        this.emit('error', { type: 'manifest_load', error });
      }
    }
  }

  private async saveManifests(): Promise<void> {
    const manifestPath = path.join(this.cacheDir, 'manifests.json');
    const data: Record<string, TemplateManifest> = {};
    
    for (const [id, manifest] of this.manifests) {
      data[id] = manifest;
    }
    
    await fs.writeJson(manifestPath, data, { spaces: 2 });
  }

  private startUpdateChecking(): void {
    // Initial check
    this.checkAllUpdates().catch(error => {
      this.emit('error', { type: 'update_check', error });
    });

    // Periodic checks
    if (this.config.checkInterval) {
      this.updateCheckInterval = setInterval(() => {
        this.checkAllUpdates().catch(error => {
          this.emit('error', { type: 'update_check', error });
        });
      }, this.config.checkInterval);
    }
  }

  async registerTemplate(template: Template, localPath: string): Promise<TemplateManifest> {
    const manifest: TemplateManifest = {
      id: template.id,
      name: template.name,
      description: template.description,
      latestVersion: template.version,
      versions: [{
        version: template.version,
        releaseDate: new Date(),
        changelog: 'Initial version',
        breaking: false,
        checksum: await this.calculateChecksum(localPath),
        size: await this.calculateSize(localPath)
      }],
      repository: template.repository,
      updateChannel: 'stable',
      autoUpdate: false,
      installedVersion: template.version,
      installedPath: localPath
    };

    this.manifests.set(template.id, manifest);
    await this.saveManifests();
    
    this.emit('template:registered', manifest);
    return manifest;
  }

  async checkUpdate(templateId: string): Promise<UpdateCheckResult | null> {
    const manifest = this.manifests.get(templateId);
    if (!manifest || !manifest.installedVersion) {
      return null;
    }

    try {
      // Fetch latest manifest from registry
      const latestManifest = await this.fetchManifestFromRegistry(templateId);
      if (!latestManifest) {
        return null;
      }

      // Update local manifest with remote data
      manifest.latestVersion = latestManifest.latestVersion;
      manifest.versions = latestManifest.versions;
      manifest.lastChecked = new Date();
      
      await this.saveManifests();

      // Compare versions
      const updateAvailable = semver.gt(
        latestManifest.latestVersion,
        manifest.installedVersion
      );

      if (!updateAvailable) {
        return {
          id: templateId,
          currentVersion: manifest.installedVersion,
          latestVersion: manifest.latestVersion,
          updateAvailable: false,
          isBreaking: false
        };
      }

      // Check for breaking changes
      const isBreaking = semver.major(latestManifest.latestVersion) > 
                        semver.major(manifest.installedVersion);

      // Get changelog
      const changelog = this.getChangelogBetweenVersions(
        manifest.installedVersion,
        latestManifest.latestVersion,
        latestManifest.versions
      );

      const result: UpdateCheckResult = {
        id: templateId,
        currentVersion: manifest.installedVersion,
        latestVersion: latestManifest.latestVersion,
        updateAvailable: true,
        isBreaking,
        changelog,
        installCommand: `re-shell template update ${templateId}`,
        updateUrl: manifest.repository
      };

      this.emit('update:available', result);
      return result;

    } catch (error) {
      this.emit('error', { type: 'update_check', templateId, error });
      return null;
    }
  }

  async checkAllUpdates(): Promise<UpdateCheckResult[]> {
    const results: UpdateCheckResult[] = [];
    
    for (const [templateId, manifest] of this.manifests) {
      if (manifest.installedVersion) {
        const result = await this.checkUpdate(templateId);
        if (result && result.updateAvailable) {
          results.push(result);
        }
      }
    }
    
    return results;
  }

  async updateTemplate(
    templateId: string,
    targetVersion?: string,
    options: UpdateOptions = {}
  ): Promise<boolean> {
    const manifest = this.manifests.get(templateId);
    if (!manifest || !manifest.installedVersion || !manifest.installedPath) {
      throw new Error(`Template ${templateId} not found or not installed`);
    }

    try {
      this.emit('update:start', { templateId, currentVersion: manifest.installedVersion });

      // Determine target version
      const version = targetVersion || manifest.latestVersion;
      
      // Validate version
      if (!semver.valid(version)) {
        throw new Error(`Invalid version: ${version}`);
      }

      // Check if version is available
      const versionInfo = manifest.versions.find(v => v.version === version);
      if (!versionInfo) {
        throw new Error(`Version ${version} not found`);
      }

      // Check if already at target version
      if (manifest.installedVersion === version) {
        this.emit('update:skipped', { templateId, version, reason: 'Already at target version' });
        return true;
      }

      // Backup current version if requested
      if (options.backup !== false && this.config.backupBeforeUpdate) {
        await this.backupTemplate(templateId, manifest.installedVersion);
      }

      // Dry run mode
      if (options.dryRun) {
        this.emit('update:dry_run', {
          templateId,
          fromVersion: manifest.installedVersion,
          toVersion: version,
          breaking: semver.major(version) > semver.major(manifest.installedVersion)
        });
        return true;
      }

      // Download new version
      const downloadPath = await this.downloadTemplateVersion(templateId, version);
      
      // Load and validate new template
      const newTemplate = await this.loadTemplateFromPath(downloadPath);
      
      // Run migrations if needed
      const migrated = await this.runMigrations(
        templateId,
        manifest.installedVersion,
        version,
        newTemplate
      );

      // Replace old version with new
      await fs.remove(manifest.installedPath);
      await fs.copy(downloadPath, manifest.installedPath);
      
      // Update manifest
      manifest.installedVersion = version;
      await this.saveManifests();

      // Cleanup download
      await fs.remove(downloadPath);

      this.emit('update:complete', {
        templateId,
        version,
        previousVersion: manifest.installedVersion
      });

      return true;

    } catch (error) {
      this.emit('update:error', { templateId, error });
      
      // Attempt rollback if update failed
      if (options.backup !== false && this.config.backupBeforeUpdate) {
        try {
          await this.rollbackTemplate(templateId, manifest.installedVersion);
          this.emit('update:rolled_back', { templateId, version: manifest.installedVersion });
        } catch (rollbackError) {
          this.emit('error', { type: 'rollback', templateId, error: rollbackError });
        }
      }
      
      throw error;
    }
  }

  async rollbackTemplate(templateId: string, version: string): Promise<void> {
    const backupPath = this.getBackupPath(templateId, version);
    const manifest = this.manifests.get(templateId);
    
    if (!manifest || !manifest.installedPath) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup not found for version ${version}`);
    }
    
    // Restore from backup
    await fs.remove(manifest.installedPath);
    await fs.copy(backupPath, manifest.installedPath);
    
    // Update manifest
    manifest.installedVersion = version;
    await this.saveManifests();
  }

  registerMigration(templateId: string, migration: MigrationScript): void {
    if (!this.migrations.has(templateId)) {
      this.migrations.set(templateId, []);
    }
    
    const migrations = this.migrations.get(templateId)!;
    migrations.push(migration);
    
    // Sort by version
    migrations.sort((a, b) => semver.compare(a.fromVersion, b.fromVersion));
  }

  private async runMigrations(
    templateId: string,
    fromVersion: string,
    toVersion: string,
    template: Template
  ): Promise<Template> {
    const migrations = this.migrations.get(templateId) || [];
    const applicableMigrations = migrations.filter(m => 
      semver.gte(m.fromVersion, fromVersion) &&
      semver.lte(m.toVersion, toVersion)
    );

    if (applicableMigrations.length === 0) {
      return template;
    }

    this.emit('migration:start', {
      templateId,
      fromVersion,
      toVersion,
      migrations: applicableMigrations.length
    });

    let migratedTemplate = template;
    const context = {
      fromVersion,
      toVersion,
      templateId
    };

    for (const migration of applicableMigrations) {
      try {
        this.emit('migration:step', {
          templateId,
          migration: migration.description,
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion
        });

        if (migration.automatic) {
          migratedTemplate = await migration.script(migratedTemplate, context);
        } else {
          // Manual migration required
          this.emit('migration:manual', {
            templateId,
            migration: migration.description,
            instructions: `Manual migration required from ${migration.fromVersion} to ${migration.toVersion}`
          });
        }
      } catch (error) {
        this.emit('migration:error', { templateId, migration, error });
        throw error;
      }
    }

    this.emit('migration:complete', { templateId, fromVersion, toVersion });
    return migratedTemplate;
  }

  private async fetchManifestFromRegistry(templateId: string): Promise<TemplateManifest | null> {
    if (!this.config.registryUrl) {
      return null;
    }

    try {
      const url = `${this.config.registryUrl}/${templateId}/manifest.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      this.emit('error', { type: 'registry_fetch', templateId, error });
      return null;
    }
  }

  private async downloadTemplateVersion(templateId: string, version: string): Promise<string> {
    if (!this.config.registryUrl) {
      throw new Error('No registry URL configured');
    }

    const url = `${this.config.registryUrl}/${templateId}/${version}.tar.gz`;
    const downloadPath = path.join(this.cacheDir, 'downloads', `${templateId}-${version}`);
    await fs.ensureDir(path.dirname(downloadPath));

    // Download template archive
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const archivePath = `${downloadPath}.tar.gz`;
    await fs.writeFile(archivePath, Buffer.from(buffer));

    // Extract archive
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tar = require('tar');
    await tar.extract({
      file: archivePath,
      cwd: downloadPath
    });

    // Cleanup archive
    await fs.remove(archivePath);

    return downloadPath;
  }

  private async loadTemplateFromPath(templatePath: string): Promise<Template> {
    const manifestPath = path.join(templatePath, 'template.yaml');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yamlLib = require('js-yaml');
    const content = await fs.readFile(manifestPath, 'utf8');
    return yamlLib.load(content) as Template;
  }

  private async backupTemplate(templateId: string, version: string): Promise<void> {
    const manifest = this.manifests.get(templateId);
    if (!manifest || !manifest.installedPath) {
      return;
    }

    const backupPath = this.getBackupPath(templateId, version);
    await fs.ensureDir(path.dirname(backupPath));
    await fs.copy(manifest.installedPath, backupPath);

    // Cleanup old backups
    await this.cleanupOldBackups(templateId);
    
    this.emit('backup:created', { templateId, version, path: backupPath });
  }

  private async cleanupOldBackups(templateId: string): Promise<void> {
    if (!this.config.maxBackups) return;

    const backupDir = path.join(this.cacheDir, 'backups', templateId);
    if (!await fs.pathExists(backupDir)) return;

    const backups = await fs.readdir(backupDir);
    if (backups.length <= this.config.maxBackups) return;

    // Sort by version
    backups.sort((a, b) => semver.compare(a, b));

    // Remove oldest backups
    const toRemove = backups.slice(0, backups.length - this.config.maxBackups);
    for (const backup of toRemove) {
      await fs.remove(path.join(backupDir, backup));
    }
  }

  private getBackupPath(templateId: string, version: string): string {
    return path.join(this.cacheDir, 'backups', templateId, version);
  }

  private getChangelogBetweenVersions(
    fromVersion: string,
    toVersion: string,
    versions: TemplateVersion[]
  ): string {
    const relevantVersions = versions.filter(v => 
      semver.gt(v.version, fromVersion) &&
      semver.lte(v.version, toVersion)
    );

    const changelog: string[] = [];
    
    for (const version of relevantVersions) {
      changelog.push(`## ${version.version} (${version.releaseDate})`);
      if (version.breaking) {
        changelog.push('**BREAKING CHANGES**');
      }
      changelog.push(version.changelog);
      changelog.push('');
    }

    return changelog.join('\n');
  }

  private async calculateChecksum(templatePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const files = await this.getAllFiles(templatePath);
    
    for (const file of files.sort()) {
      const content = await fs.readFile(file);
      hash.update(content);
    }
    
    return hash.digest('hex');
  }

  private async calculateSize(templatePath: string): Promise<number> {
    const files = await this.getAllFiles(templatePath);
    let totalSize = 0;
    
    for (const file of files) {
      const stats = await fs.stat(file);
      totalSize += stats.size;
    }
    
    return totalSize;
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  // Query methods
  getManifest(templateId: string): TemplateManifest | undefined {
    return this.manifests.get(templateId);
  }

  getAllManifests(): TemplateManifest[] {
    return Array.from(this.manifests.values());
  }

  getInstalledTemplates(): TemplateManifest[] {
    return Array.from(this.manifests.values())
      .filter(m => m.installedVersion && m.installedPath);
  }

  getOutdatedTemplates(): TemplateManifest[] {
    return this.getInstalledTemplates()
      .filter(m => semver.lt(m.installedVersion!, m.latestVersion));
  }

  getBackups(templateId: string): string[] {
    const backupDir = path.join(this.cacheDir, 'backups', templateId);
    
    try {
      if (fs.existsSync(backupDir)) {
        return fs.readdirSync(backupDir).sort(semver.rcompare);
      }
    } catch {
      // Ignore errors
    }
    
    return [];
  }

  // Configuration
  updateConfig(config: Partial<VersioningConfig>): void {
    Object.assign(this.config, config);
    
    // Restart update checking if interval changed
    if (config.checkInterval !== undefined || config.autoCheck !== undefined) {
      if (this.updateCheckInterval) {
        clearInterval(this.updateCheckInterval);
        this.updateCheckInterval = undefined;
      }
      
      if (this.config.autoCheck) {
        this.startUpdateChecking();
      }
    }
  }

  stop(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = undefined;
    }
  }
}

// Global version manager
let globalVersionManager: TemplateVersionManager | null = null;

export function createTemplateVersionManager(
  templatesDir: string,
  config?: VersioningConfig
): TemplateVersionManager {
  return new TemplateVersionManager(templatesDir, config);
}

export function getGlobalTemplateVersionManager(): TemplateVersionManager {
  if (!globalVersionManager) {
    const templatesDir = path.join(process.cwd(), 'templates');
    globalVersionManager = new TemplateVersionManager(templatesDir);
  }
  return globalVersionManager;
}

export function setGlobalTemplateVersionManager(manager: TemplateVersionManager): void {
  globalVersionManager = manager;
}