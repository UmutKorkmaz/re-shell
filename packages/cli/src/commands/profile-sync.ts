import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import chalk from 'chalk';
import prompts from 'prompts';
import { execSync } from 'child_process';
import { EnvironmentProfile, loadProfileConfig, saveProfileConfig } from './profile';

/**
 * Profile sharing and team synchronization
 * Supports Git-based and cloud-based synchronization with conflict resolution
 */

const SYNC_DIR = '.re-shell/sync';
const SYNC_LOCK_FILE = '.re-shell/sync.lock';
const SYNC_METADATA_FILE = '.re-shell/sync-metadata.json';

export interface SyncMetadata {
  lastSync: string;
  lastSyncBy: string;
  profileHashes: Record<string, string>;
  conflicts: Record<string, ConflictInfo>;
}

export interface ConflictInfo {
  localProfile: EnvironmentProfile;
  remoteProfile: EnvironmentProfile;
  conflictType: 'modified' | 'deleted' | 'created';
  detectedAt: string;
}

export interface SyncOptions {
  method?: 'git' | 'cloud' | 'local';
  remote?: string;
  branch?: string;
  force?: boolean;
  strategy?: 'local' | 'remote' | 'merge' | 'manual';
  json?: boolean;
}

/**
 * Export profiles to a sync directory
 */
export async function exportProfiles(
  profileNames?: string[],
  options: {
    outputPath?: string;
    includeMetadata?: boolean;
  } = {}
): Promise<void> {
  const config = await loadProfileConfig();
  const profilesToExport = profileNames || Object.keys(config.profiles);

  if (profilesToExport.length === 0) {
    console.log(chalk.yellow('\n⚠ No profiles to export\n'));
    return;
  }

  const outputPath = options.outputPath || path.join(process.cwd(), SYNC_DIR, 'profiles');
  await fs.ensureDir(outputPath);

  console.log(chalk.cyan.bold(`\n📤 Exporting ${profilesToExport.length} profile(s)\n`));

  let exported = 0;
  for (const profileName of profilesToExport) {
    const profile = config.profiles[profileName];

    if (!profile) {
      console.log(chalk.yellow(`⚠ Profile "${profileName}" not found, skipping`));
      continue;
    }

    const profilePath = path.join(outputPath, `${profileName}.yaml`);

    // Check for conflicts
    if (await fs.pathExists(profilePath)) {
      const existingHash = await hashFile(profilePath);
      const currentProfile = JSON.stringify(profile);
      const currentHash = crypto.createHash('sha256').update(currentProfile).digest('hex');

      if (existingHash !== currentHash) {
        console.log(chalk.yellow(`⚠ Profile "${profileName}" has local changes`));

        if (!options.includeMetadata) {
          const { value: overwrite } = await prompts({
            type: 'confirm',
            name: 'value',
            message: `Overwrite existing "${profileName}"?`,
            initial: false,
          });

          if (!overwrite) {
            console.log(chalk.gray(`  Skipped ${profileName}\n`));
            continue;
          }
        }
      }
    }

    const yaml = await import('yaml');
    await fs.writeFile(profilePath, yaml.stringify(profile), 'utf8');

    if (options.includeMetadata) {
      const metadataPath = path.join(outputPath, `${profileName}.meta.json`);
      const metadata = {
        exportedAt: new Date().toISOString(),
        exportedBy: process.env.USER || 'unknown',
        profileHash: crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
        profileName: profile.name,
        environment: profile.environment,
        framework: profile.framework,
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    }

    console.log(chalk.green(`✓ Exported ${profileName}`));
    exported++;
  }

  console.log(chalk.green(`\n✓ Successfully exported ${exported}/${profilesToExport.length} profile(s)\n`));
  console.log(chalk.gray(`Location: ${outputPath}\n`));
}

/**
 * Import profiles from a sync directory
 */
export async function importProfiles(
  sourcePath?: string,
  options: {
    overwrite?: boolean;
    merge?: boolean;
    strategy?: 'local' | 'remote' | 'merge' | 'manual';
  } = {}
): Promise<void> {
  const importPath = sourcePath || path.join(process.cwd(), SYNC_DIR, 'profiles');

  if (!(await fs.pathExists(importPath))) {
    console.log(chalk.red(`\n✗ Source directory not found: ${importPath}\n`));
    return;
  }

  const files = await fs.readdir(importPath);
  const profileFiles = files.filter(f => f.endsWith('.yaml') && !f.endsWith('.meta.yaml'));

  if (profileFiles.length === 0) {
    console.log(chalk.yellow('\n⚠ No profile files found to import\n'));
    return;
  }

  console.log(chalk.cyan.bold(`\n📥 Importing ${profileFiles.length} profile(s)\n`));

  const config = await loadProfileConfig();
  let imported = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (const file of profileFiles) {
    const filePath = path.join(importPath, file);
    const content = await fs.readFile(filePath, 'utf8');
    const yaml = await import('yaml');
    const importedProfile = yaml.parse(content) as EnvironmentProfile;
    const profileName = importedProfile.name;

    // Check for conflicts
    if (config.profiles[profileName]) {
      const existingProfile = config.profiles[profileName];
      const existingHash = crypto.createHash('sha256').update(JSON.stringify(existingProfile)).digest('hex');
      const importedHash = crypto.createHash('sha256').update(JSON.stringify(importedProfile)).digest('hex');

      if (existingHash !== importedHash) {
        conflicts.push(profileName);

        // Handle conflict based on strategy
        if (!options.strategy || options.strategy === 'manual') {
          console.log(chalk.yellow(`\n⚠ Conflict detected for profile "${profileName}"`));

          const { value: action } = await prompts({
            type: 'select',
            name: 'value',
            message: `How to resolve conflict for "${profileName}"?`,
            choices: [
              { title: 'Keep local (existing)', value: 'local' },
              { title: 'Use remote (imported)', value: 'remote' },
              { title: 'Merge both', value: 'merge' },
              { title: 'Skip', value: 'skip' },
            ],
            initial: 0,
          });

          if (action === 'skip') {
            console.log(chalk.gray(`  Skipped ${profileName}`));
            skipped++;
            continue;
          }

          if (action === 'remote') {
            config.profiles[profileName] = importedProfile;
            console.log(chalk.green(`  ✓ Imported ${profileName} (remote)`));
            imported++;
            continue;
          }

          if (action === 'merge') {
            config.profiles[profileName] = deepMergeProfiles(existingProfile, importedProfile);
            console.log(chalk.green(`  ✓ Merged ${profileName}`));
            imported++;
            continue;
          }

          // local - keep existing
          console.log(chalk.gray(`  Kept local ${profileName}`));
          skipped++;
          continue;
        }

        if (options.strategy === 'local') {
          console.log(chalk.gray(`  Kept local ${profileName}`));
          skipped++;
          continue;
        }

        if (options.strategy === 'remote') {
          config.profiles[profileName] = importedProfile;
          console.log(chalk.green(`  ✓ Imported ${profileName} (remote)`));
          imported++;
          continue;
        }

        if (options.strategy === 'merge') {
          config.profiles[profileName] = deepMergeProfiles(existingProfile, importedProfile);
          console.log(chalk.green(`  ✓ Merged ${profileName}`));
          imported++;
          continue;
        }
      }
    }

    // No conflict or overwrite enabled
    config.profiles[profileName] = importedProfile;
    console.log(chalk.green(`  ✓ Imported ${profileName}`));
    imported++;
  }

  await saveProfileConfig(config);

  console.log(chalk.green(`\n✓ Import complete: ${imported} imported, ${skipped} skipped`));
  if (conflicts.length > 0) {
    console.log(chalk.yellow(`  Conflicts resolved: ${conflicts.length}`));
  }
  console.log('');
}

/**
 * Sync profiles via Git
 */
export async function syncProfilesGit(options: SyncOptions = {}): Promise<void> {
  const syncPath = path.join(process.cwd(), SYNC_DIR);
  const remote = options.remote || 'origin';
  const branch = options.branch || 'main';

  console.log(chalk.cyan.bold('\n🔄 Syncing profiles via Git\n'));

  // Initialize sync directory if needed
  if (!(await fs.pathExists(syncPath))) {
    console.log(chalk.gray('Initializing sync directory...'));
    await fs.ensureDir(syncPath);

    // Initialize git repo
    try {
      execSync('git init', { cwd: syncPath, stdio: 'pipe' });
      console.log(chalk.green('✓ Git repository initialized'));
    } catch (error) {
      console.log(chalk.yellow('⚠ Git not available, using local sync only'));
    }
  }

  // Export current profiles
  await exportProfiles(undefined, { outputPath: path.join(syncPath, 'profiles') });

  // Try to sync with remote if git is available
  try {
    // Check if remote exists
    execSync(`git remote get-url ${remote}`, { cwd: syncPath, stdio: 'pipe' });

    // Pull changes
    console.log(chalk.gray('Pulling remote changes...'));
    try {
      execSync(`git pull ${remote} ${branch}`, { cwd: syncPath, stdio: 'pipe' });
      console.log(chalk.green('✓ Pulled remote changes'));
    } catch (error) {
      console.log(chalk.yellow('⚠ No remote changes or connection failed'));
    }

    // Check for conflicts
    const status = execSync('git status --porcelain', { cwd: syncPath, encoding: 'utf-8' });

    if (status.trim() && !options.force) {
      console.log(chalk.yellow('\n⚠ Remote changes detected, conflict resolution needed\n'));

      const { value: action } = await prompts({
        type: 'select',
        name: 'value',
        message: 'How to handle conflicts?',
        choices: [
          { title: 'Merge manually', value: 'manual' },
          { title: 'Force local changes', value: 'local' },
          { title: 'Force remote changes', value: 'remote' },
          { title: 'Cancel', value: 'cancel' },
        ],
        initial: 0,
      });

      if (action === 'cancel') {
        console.log(chalk.yellow('\n✖ Sync cancelled\n'));
        return;
      }

      if (action === 'local') {
        execSync(`git push ${remote} ${branch} --force`, { cwd: syncPath, stdio: 'pipe' });
        console.log(chalk.green('✓ Pushed local changes'));
      } else if (action === 'remote') {
        execSync(`git reset --hard ${remote}/${branch}`, { cwd: syncPath, stdio: 'pipe' });
        await importProfiles(path.join(syncPath, 'profiles'), { strategy: 'remote' });
      }
    } else if (options.force) {
      execSync(`git push ${remote} ${branch} --force`, { cwd: syncPath, stdio: 'pipe' });
      console.log(chalk.green('✓ Force pushed local changes'));
    }

    // Commit and push changes
    try {
      execSync('git add .', { cwd: syncPath, stdio: 'pipe' });
      execSync('git commit -m "Update profiles"', { cwd: syncPath, stdio: 'pipe' });
      execSync(`git push ${remote} ${branch}`, { cwd: syncPath, stdio: 'pipe' });
      console.log(chalk.green('✓ Pushed local changes'));
    } catch (error) {
      // Nothing to commit or push
      console.log(chalk.gray('No changes to push'));
    }

    // Update sync metadata
    await updateSyncMetadata(syncPath);

    console.log(chalk.green('\n✓ Sync completed successfully\n'));

  } catch (error) {
    console.log(chalk.yellow('⚠ Git remote not configured, using local sync only'));
    console.log(chalk.gray(`To enable remote sync, run:`));
    console.log(chalk.gray(`  cd ${syncPath}`));
    console.log(chalk.gray(`  git remote add origin <your-repo-url>\n`));
  }
}

/**
 * Sync profiles to local directory
 */
export async function syncProfilesLocal(options: SyncOptions = {}): Promise<void> {
  const syncPath = path.join(process.cwd(), SYNC_DIR, 'profiles');

  console.log(chalk.cyan.bold('\n🔄 Syncing profiles locally\n'));

  await fs.ensureDir(syncPath);

  // Export current profiles
  await exportProfiles(undefined, { outputPath: syncPath });

  // Import any new profiles
  await importProfiles(syncPath, {
    strategy: (options.strategy as any) || 'merge',
  });

  console.log(chalk.green('✓ Local sync completed\n'));
}

/**
 * Show sync status
 */
export async function showSyncStatus(): Promise<void> {
  const syncPath = path.join(process.cwd(), SYNC_DIR);
  const metadataPath = path.join(process.cwd(), SYNC_METADATA_FILE);

  console.log(chalk.cyan.bold('\n📊 Profile Sync Status\n'));

  // Check sync directory
  if (await fs.pathExists(syncPath)) {
    const profilePath = path.join(syncPath, 'profiles');
    if (await fs.pathExists(profilePath)) {
      const files = await fs.readdir(profilePath);
      const profileFiles = files.filter(f => f.endsWith('.yaml') && !f.endsWith('.meta.yaml'));
      console.log(chalk.white(`Synced profiles: ${profileFiles.length}`));
      console.log(chalk.gray(`Location: ${profilePath}\n`));
    }
  } else {
    console.log(chalk.yellow('No sync directory found\n'));
  }

  // Check metadata
  if (await fs.pathExists(metadataPath)) {
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as SyncMetadata;
    console.log(chalk.white('Last sync:'));
    console.log(chalk.gray(`  Time: ${metadata.lastSync}`));
    console.log(chalk.gray(`  By: ${metadata.lastSyncBy}\n`));

    if (Object.keys(metadata.conflicts).length > 0) {
      console.log(chalk.yellow(`Pending conflicts: ${Object.keys(metadata.conflicts).length}\n`));
    }
  }

  // Check git status if available
  try {
    const gitPath = path.join(syncPath, '.git');
    if (await fs.pathExists(gitPath)) {
      const status = execSync('git status --short', { cwd: syncPath, encoding: 'utf-8' });
      if (status.trim()) {
        console.log(chalk.yellow('Uncommitted changes:\n'));
        console.log(chalk.gray(status));
      } else {
        console.log(chalk.green('✓ No uncommitted changes\n'));
      }
    }
  } catch (error) {
    // Git not available
  }
}

/**
 * Resolve conflicts interactively
 */
export async function resolveConflicts(): Promise<void> {
  const metadataPath = path.join(process.cwd(), SYNC_METADATA_FILE);

  if (!(await fs.pathExists(metadataPath))) {
    console.log(chalk.yellow('\n⚠ No conflicts to resolve\n'));
    return;
  }

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as SyncMetadata;
  const conflicts = Object.entries(metadata.conflicts);

  if (conflicts.length === 0) {
    console.log(chalk.yellow('\n⚠ No conflicts to resolve\n'));
    return;
  }

  console.log(chalk.cyan.bold(`\n🔧 Resolving ${conflicts.length} conflict(s)\n`));

  for (const [profileName, conflict] of conflicts) {
    console.log(chalk.white(`Profile: ${profileName}`));
    console.log(chalk.gray(`Type: ${conflict.conflictType}`));
    console.log(chalk.gray(`Detected: ${conflict.detectedAt}\n`));

    const { value: action } = await prompts({
      type: 'select',
      name: 'value',
      message: `Resolve conflict for "${profileName}"?`,
      choices: [
        { title: 'Keep local version', value: 'local' },
        { title: 'Keep remote version', value: 'remote' },
        { title: 'Merge both', value: 'merge' },
        { title: 'Skip', value: 'skip' },
      ],
      initial: 0,
    });

    const config = await loadProfileConfig();

    if (action === 'local') {
      config.profiles[profileName] = conflict.localProfile;
    } else if (action === 'remote') {
      config.profiles[profileName] = conflict.remoteProfile;
    } else if (action === 'merge') {
      config.profiles[profileName] = deepMergeProfiles(conflict.localProfile, conflict.remoteProfile);
    }

    // Remove from conflicts
    delete metadata.conflicts[profileName];
    await saveProfileConfig(config);
  }

  // Save updated metadata
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  console.log(chalk.green('\n✓ Conflicts resolved\n'));
}

/**
 * Helper functions
 */

async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function updateSyncMetadata(syncPath: string): Promise<void> {
  const metadata: SyncMetadata = {
    lastSync: new Date().toISOString(),
    lastSyncBy: process.env.USER || 'unknown',
    profileHashes: {},
    conflicts: {},
  };

  // Hash all profiles
  const config = await loadProfileConfig();
  for (const [name, profile] of Object.entries(config.profiles)) {
    metadata.profileHashes[name] = crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex');
  }

  const metadataPath = path.join(process.cwd(), SYNC_METADATA_FILE);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
}

function deepMergeProfiles(base: EnvironmentProfile, override: Partial<EnvironmentProfile>): EnvironmentProfile {
  const merged = { ...base };

  if (override.description) merged.description = override.description;
  if (override.framework) merged.framework = override.framework;
  if (override.environment) merged.environment = override.environment;
  if (override.priority !== undefined) merged.priority = override.priority;

  if (override.config) {
    merged.config = { ...base.config, ...override.config };

    if (override.config.build) {
      merged.config.build = { ...base.config.build, ...override.config.build };
    }

    if (override.config.dev) {
      merged.config.dev = { ...base.config.dev, ...override.config.dev };
    }

    if (override.config.test) {
      merged.config.test = { ...base.config.test, ...override.config.test };
    }

    if (override.config.env) {
      merged.config.env = { ...base.config.env, ...override.config.env };
    }

    if (override.config.scripts) {
      merged.config.scripts = { ...base.config.scripts, ...override.config.scripts };
    }

    if (override.config.dependencies) {
      merged.config.dependencies = { ...base.config.dependencies, ...override.config.dependencies };
    }

    if (override.config.services) {
      merged.config.services = [...(base.config.services || []), ...override.config.services];
    }
  }

  if (override.extends) {
    merged.extends = [...new Set([...(base.extends || []), ...override.extends])];
  }

  return merged;
}
