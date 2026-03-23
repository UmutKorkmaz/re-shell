import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  preferences: UserPreferences;
  metadata: {
    created: Date;
    lastUpdated: Date;
    version: string;
  };
}

export interface UserPreferences {
  // CLI Behavior
  cli: {
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'auto';
    defaultFramework: 'react' | 'vue' | 'svelte' | 'angular' | 'vanilla';
    typescript: boolean;
    skipConfirmations: boolean;
    verboseOutput: boolean;
    colorOutput: boolean;
    autoUpdate: boolean;
    telemetry: boolean;
  };

  // Development
  development: {
    defaultTemplate: string;
    autoInstallDependencies: boolean;
    generateDocumentation: boolean;
    setupTesting: boolean;
    setupLinting: boolean;
    setupFormatting: boolean;
    gitInitialization: boolean;
    dockerConfiguration: boolean;
  };

  // Editor
  editor: {
    preferred: 'vscode' | 'webstorm' | 'atom' | 'sublime' | 'vim' | 'none';
    generateConfig: boolean;
    installExtensions: boolean;
    formatOnSave: boolean;
  };

  // Project Structure
  project: {
    workspaceLayout: 'nested' | 'flat' | 'monorepo';
    namingConvention: 'camelCase' | 'kebab-case' | 'snake_case' | 'PascalCase';
    fileOrganization: 'feature' | 'type' | 'domain';
    testLocation: 'colocated' | 'separate' | '__tests__';
  };

  // Build & Deploy
  build: {
    bundler: 'webpack' | 'vite' | 'rollup' | 'parcel' | 'auto';
    target: 'es2015' | 'es2018' | 'es2020' | 'esnext';
    optimization: 'development' | 'production' | 'auto';
    sourceMaps: boolean;
    minification: boolean;
    treeshaking: boolean;
  };

  // UI/UX
  ui: {
    theme: 'auto' | 'light' | 'dark';
    animations: boolean;
    progressIndicators: boolean;
    sounds: boolean;
    notifications: boolean;
  };

  // Performance
  performance: {
    monitoring: boolean;
    profiling: boolean;
    caching: boolean;
    parallelBuilds: boolean;
    memoryLimit: number;
  };

  // Plugins
  plugins: {
    autoInstall: boolean;
    autoUpdate: boolean;
    allowBeta: boolean;
    marketplaceUrl: string;
    trustedPublishers: string[];
  };

  // Custom
  custom: Record<string, any>;
}

export interface PreferenceSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    default: any;
    description: string;
    choices?: any[];
    min?: number;
    max?: number;
    validator?: (value: any) => boolean | string;
    category: string;
    advanced?: boolean;
  };
}

export interface PreferenceUpdate {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  source: 'user' | 'migration' | 'import' | 'reset';
}

export class UserPreferenceManager extends EventEmitter {
  private globalConfigPath: string;
  private userProfilesPath: string;
  private currentProfile?: UserProfile;
  private schema: PreferenceSchema;
  private updateHistory: PreferenceUpdate[] = [];

  constructor() {
    super();
    
    const configDir = path.join(os.homedir(), '.re-shell');
    this.globalConfigPath = path.join(configDir, 'preferences.json');
    this.userProfilesPath = path.join(configDir, 'profiles');
    
    this.schema = this.createSchema();
    this.loadOrCreateProfile();
  }

  private createSchema(): PreferenceSchema {
    return {
      'cli.packageManager': {
        type: 'string',
        default: 'auto',
        description: 'Default package manager for new projects',
        choices: ['npm', 'yarn', 'pnpm', 'bun', 'auto'],
        category: 'CLI Behavior'
      },
      'cli.defaultFramework': {
        type: 'string',
        default: 'react',
        description: 'Default framework for new microfrontends',
        choices: ['react', 'vue', 'svelte', 'angular', 'vanilla'],
        category: 'CLI Behavior'
      },
      'cli.typescript': {
        type: 'boolean',
        default: true,
        description: 'Use TypeScript by default',
        category: 'CLI Behavior'
      },
      'cli.skipConfirmations': {
        type: 'boolean',
        default: false,
        description: 'Skip confirmation prompts when possible',
        category: 'CLI Behavior'
      },
      'cli.verboseOutput': {
        type: 'boolean',
        default: false,
        description: 'Enable verbose output by default',
        category: 'CLI Behavior'
      },
      'cli.colorOutput': {
        type: 'boolean',
        default: true,
        description: 'Enable colored terminal output',
        category: 'CLI Behavior'
      },
      'cli.autoUpdate': {
        type: 'boolean',
        default: true,
        description: 'Automatically check for CLI updates',
        category: 'CLI Behavior'
      },
      'cli.telemetry': {
        type: 'boolean',
        default: true,
        description: 'Allow anonymous usage telemetry',
        category: 'CLI Behavior'
      },
      'development.defaultTemplate': {
        type: 'string',
        default: 'basic',
        description: 'Default project template',
        choices: ['basic', 'ecommerce', 'dashboard', 'saas', 'blog'],
        category: 'Development'
      },
      'development.autoInstallDependencies': {
        type: 'boolean',
        default: true,
        description: 'Automatically install dependencies after project creation',
        category: 'Development'
      },
      'development.generateDocumentation': {
        type: 'boolean',
        default: true,
        description: 'Generate README and documentation files',
        category: 'Development'
      },
      'development.setupTesting': {
        type: 'boolean',
        default: true,
        description: 'Set up testing framework and files',
        category: 'Development'
      },
      'development.setupLinting': {
        type: 'boolean',
        default: true,
        description: 'Configure ESLint and code quality tools',
        category: 'Development'
      },
      'development.setupFormatting': {
        type: 'boolean',
        default: true,
        description: 'Configure Prettier and code formatting',
        category: 'Development'
      },
      'development.gitInitialization': {
        type: 'boolean',
        default: true,
        description: 'Initialize Git repository for new projects',
        category: 'Development'
      },
      'development.dockerConfiguration': {
        type: 'boolean',
        default: false,
        description: 'Generate Docker configuration files',
        category: 'Development'
      },
      'editor.preferred': {
        type: 'string',
        default: 'vscode',
        description: 'Preferred code editor',
        choices: ['vscode', 'webstorm', 'atom', 'sublime', 'vim', 'none'],
        category: 'Editor'
      },
      'editor.generateConfig': {
        type: 'boolean',
        default: true,
        description: 'Generate editor-specific configuration files',
        category: 'Editor'
      },
      'editor.installExtensions': {
        type: 'boolean',
        default: false,
        description: 'Suggest installing recommended extensions',
        category: 'Editor',
        advanced: true
      },
      'project.workspaceLayout': {
        type: 'string',
        default: 'monorepo',
        description: 'Default workspace layout structure',
        choices: ['nested', 'flat', 'monorepo'],
        category: 'Project Structure'
      },
      'project.namingConvention': {
        type: 'string',
        default: 'kebab-case',
        description: 'File and directory naming convention',
        choices: ['camelCase', 'kebab-case', 'snake_case', 'PascalCase'],
        category: 'Project Structure'
      },
      'build.bundler': {
        type: 'string',
        default: 'auto',
        description: 'Preferred build tool',
        choices: ['webpack', 'vite', 'rollup', 'parcel', 'auto'],
        category: 'Build & Deploy'
      },
      'build.target': {
        type: 'string',
        default: 'es2020',
        description: 'JavaScript target version',
        choices: ['es2015', 'es2018', 'es2020', 'esnext'],
        category: 'Build & Deploy'
      },
      'performance.monitoring': {
        type: 'boolean',
        default: false,
        description: 'Enable performance monitoring',
        category: 'Performance',
        advanced: true
      },
      'performance.caching': {
        type: 'boolean',
        default: true,
        description: 'Enable build and operation caching',
        category: 'Performance'
      },
      'performance.memoryLimit': {
        type: 'number',
        default: 2048,
        description: 'Memory limit for build processes (MB)',
        min: 512,
        max: 8192,
        category: 'Performance',
        advanced: true
      },
      'plugins.autoInstall': {
        type: 'boolean',
        default: false,
        description: 'Automatically install recommended plugins',
        category: 'Plugins',
        advanced: true
      },
      'plugins.autoUpdate': {
        type: 'boolean',
        default: true,
        description: 'Automatically update installed plugins',
        category: 'Plugins'
      },
      'ui.theme': {
        type: 'string',
        default: 'auto',
        description: 'CLI output theme',
        choices: ['auto', 'light', 'dark'],
        category: 'UI/UX'
      },
      'ui.animations': {
        type: 'boolean',
        default: true,
        description: 'Enable loading animations and spinners',
        category: 'UI/UX'
      }
    };
  }

  private loadOrCreateProfile(): void {
    try {
      if (fs.existsSync(this.globalConfigPath)) {
        const data = fs.readJsonSync(this.globalConfigPath);
        this.currentProfile = this.migrateProfile(data);
      } else {
        this.currentProfile = this.createDefaultProfile();
        this.saveProfile();
      }
    } catch (error) {
      console.warn('Failed to load user preferences, using defaults:', error);
      this.currentProfile = this.createDefaultProfile();
    }
  }

  private createDefaultProfile(): UserProfile {
    const preferences = this.createDefaultPreferences();
    
    return {
      id: this.generateProfileId(),
      name: 'Default',
      preferences,
      metadata: {
        created: new Date(),
        lastUpdated: new Date(),
        version: '1.0.0'
      }
    };
  }

  private createDefaultPreferences(): UserPreferences {
    const preferences: any = {
      cli: {},
      development: {},
      editor: {},
      project: {},
      build: {},
      ui: {},
      performance: {},
      plugins: {},
      custom: {}
    };

    // Apply schema defaults
    for (const [key, config] of Object.entries(this.schema)) {
      this.setNestedValue(preferences, key, config.default);
    }

    return preferences as UserPreferences;
  }

  private migrateProfile(data: any): UserProfile {
    // Handle migration from older versions
    if (!data.metadata) {
      data.metadata = {
        created: new Date(),
        lastUpdated: new Date(),
        version: '1.0.0'
      };
    }

    if (!data.preferences) {
      data.preferences = this.createDefaultPreferences();
    }

    // Merge with defaults to ensure all properties exist
    const defaultPrefs = this.createDefaultPreferences();
    data.preferences = this.mergeDeep(defaultPrefs, data.preferences);

    return data;
  }

  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private mergeDeep(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  get<T = any>(key: string, defaultValue?: T): T {
    if (!this.currentProfile) {
      return defaultValue as T;
    }

    const value = this.getNestedValue(this.currentProfile.preferences, key);
    return value !== undefined ? value : defaultValue;
  }

  set(key: string, value: any, source: 'user' | 'migration' | 'import' | 'reset' = 'user'): void {
    if (!this.currentProfile) {
      throw new Error('No active profile');
    }

    // Validate against schema
    const schemaConfig = this.schema[key];
    if (schemaConfig) {
      const validation = this.validateValue(value, schemaConfig);
      if (validation !== true) {
        throw new Error(`Invalid value for ${key}: ${validation}`);
      }
    }

    const oldValue = this.getNestedValue(this.currentProfile.preferences, key);
    this.setNestedValue(this.currentProfile.preferences, key, value);
    
    // Record update
    const update: PreferenceUpdate = {
      key,
      oldValue,
      newValue: value,
      timestamp: new Date(),
      source
    };
    
    this.updateHistory.push(update);
    
    // Keep only last 100 updates
    if (this.updateHistory.length > 100) {
      this.updateHistory = this.updateHistory.slice(-100);
    }

    // Update metadata
    this.currentProfile.metadata.lastUpdated = new Date();
    
    // Save and emit
    this.saveProfile();
    this.emit('preference:changed', update);
  }

  private validateValue(value: any, config: any): boolean | string {
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== config.type) {
      return `Expected ${config.type}, got ${actualType}`;
    }

    // Choice validation
    if (config.choices && !config.choices.includes(value)) {
      return `Must be one of: ${config.choices.join(', ')}`;
    }

    // Range validation
    if (config.type === 'number') {
      if (config.min !== undefined && value < config.min) {
        return `Must be at least ${config.min}`;
      }
      if (config.max !== undefined && value > config.max) {
        return `Must be at most ${config.max}`;
      }
    }

    // Custom validation
    if (config.validator) {
      const result = config.validator(value);
      if (result !== true) {
        return result;
      }
    }

    return true;
  }

  private getNestedValue(obj: any, key: string): any {
    const keys = key.split('.');
    let current = obj;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private setNestedValue(obj: any, key: string, value: any): void {
    const keys = key.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    if (!this.currentProfile) return;

    const oldValue = this.getNestedValue(this.currentProfile.preferences, key);
    this.deleteNestedValue(this.currentProfile.preferences, key);
    
    const update: PreferenceUpdate = {
      key,
      oldValue,
      newValue: undefined,
      timestamp: new Date(),
      source: 'user'
    };
    
    this.updateHistory.push(update);
    this.currentProfile.metadata.lastUpdated = new Date();
    
    this.saveProfile();
    this.emit('preference:deleted', update);
  }

  private deleteNestedValue(obj: any, key: string): void {
    const keys = key.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        return;
      }
      current = current[k];
    }
    
    delete current[keys[keys.length - 1]];
  }

  reset(category?: string): void {
    if (!this.currentProfile) return;

    if (category) {
      // Reset specific category
      const defaultPrefs = this.createDefaultPreferences();
      const categoryDefaults = this.getNestedValue(defaultPrefs, category);
      
      if (categoryDefaults) {
        this.setNestedValue(this.currentProfile.preferences, category, categoryDefaults);
      }
    } else {
      // Reset all preferences
      this.currentProfile.preferences = this.createDefaultPreferences();
    }

    this.currentProfile.metadata.lastUpdated = new Date();
    this.saveProfile();
    this.emit('preferences:reset', { category });
  }

  getAll(): UserPreferences {
    return this.currentProfile ? { ...this.currentProfile.preferences } : this.createDefaultPreferences();
  }

  getCurrentProfile(): UserProfile | undefined {
    return this.currentProfile ? { ...this.currentProfile } : undefined;
  }

  createProfile(name: string, basedOn?: string): UserProfile {
    const baseProfile = basedOn ? this.loadProfile(basedOn) : this.currentProfile;
    const preferences = baseProfile ? { ...baseProfile.preferences } : this.createDefaultPreferences();
    
    const profile: UserProfile = {
      id: this.generateProfileId(),
      name,
      preferences,
      metadata: {
        created: new Date(),
        lastUpdated: new Date(),
        version: '1.0.0'
      }
    };

    this.saveProfileToFile(profile);
    return profile;
  }

  loadProfile(id: string): UserProfile | null {
    try {
      const profilePath = path.join(this.userProfilesPath, `${id}.json`);
      if (fs.existsSync(profilePath)) {
        return fs.readJsonSync(profilePath);
      }
    } catch (error) {
      console.warn(`Failed to load profile ${id}:`, error);
    }
    return null;
  }

  switchProfile(id: string): boolean {
    const profile = this.loadProfile(id);
    if (profile) {
      this.currentProfile = profile;
      this.saveProfile();
      this.emit('profile:switched', profile);
      return true;
    }
    return false;
  }

  listProfiles(): Array<{ id: string; name: string; lastUpdated: Date }> {
    try {
      if (!fs.existsSync(this.userProfilesPath)) {
        return [];
      }

      const files = fs.readdirSync(this.userProfilesPath)
        .filter(f => f.endsWith('.json'));

      const profiles = [];
      for (const file of files) {
        try {
          const profile = fs.readJsonSync(path.join(this.userProfilesPath, file));
          profiles.push({
            id: profile.id,
            name: profile.name,
            lastUpdated: new Date(profile.metadata.lastUpdated)
          });
        } catch {
          // Skip corrupted profiles
        }
      }

      return profiles.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    } catch {
      return [];
    }
  }

  deleteProfile(id: string): boolean {
    try {
      const profilePath = path.join(this.userProfilesPath, `${id}.json`);
      if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath);
        this.emit('profile:deleted', { id });
        return true;
      }
    } catch (error) {
      console.warn(`Failed to delete profile ${id}:`, error);
    }
    return false;
  }

  exportProfile(id?: string): string {
    const profile = id ? this.loadProfile(id) : this.currentProfile;
    if (!profile) {
      throw new Error('Profile not found');
    }
    return JSON.stringify(profile, null, 2);
  }

  importProfile(data: string): UserProfile {
    try {
      const profile = JSON.parse(data);
      
      // Validate and migrate
      const migrated = this.migrateProfile(profile);
      migrated.id = this.generateProfileId(); // Generate new ID
      migrated.metadata.lastUpdated = new Date();
      
      this.saveProfileToFile(migrated);
      this.emit('profile:imported', migrated);
      
      return migrated;
    } catch (error: any) {
      throw new Error(`Failed to import profile: ${error.message}`);
    }
  }

  private saveProfile(): void {
    if (!this.currentProfile) return;

    try {
      fs.ensureDirSync(path.dirname(this.globalConfigPath));
      fs.writeJsonSync(this.globalConfigPath, this.currentProfile, { spaces: 2 });
      this.saveProfileToFile(this.currentProfile);
    } catch (error) {
      console.warn('Failed to save user preferences:', error);
    }
  }

  private saveProfileToFile(profile: UserProfile): void {
    try {
      fs.ensureDirSync(this.userProfilesPath);
      const profilePath = path.join(this.userProfilesPath, `${profile.id}.json`);
      fs.writeJsonSync(profilePath, profile, { spaces: 2 });
    } catch (error) {
      console.warn(`Failed to save profile ${profile.id}:`, error);
    }
  }

  getSchema(): PreferenceSchema {
    return { ...this.schema };
  }

  getSchemaByCategory(category: string): PreferenceSchema {
    const filtered: PreferenceSchema = {};
    
    for (const [key, config] of Object.entries(this.schema)) {
      if (config.category === category) {
        filtered[key] = config;
      }
    }
    
    return filtered;
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    
    for (const config of Object.values(this.schema)) {
      categories.add(config.category);
    }
    
    return Array.from(categories).sort();
  }

  getUpdateHistory(): PreferenceUpdate[] {
    return [...this.updateHistory];
  }

  // Utility methods for common preferences
  getPackageManager(): string {
    return this.get('cli.packageManager', 'auto');
  }

  getDefaultFramework(): string {
    return this.get('cli.defaultFramework', 'react');
  }

  isTypescriptDefault(): boolean {
    return this.get('cli.typescript', true);
  }

  shouldSkipConfirmations(): boolean {
    return this.get('cli.skipConfirmations', false);
  }

  isVerboseOutput(): boolean {
    return this.get('cli.verboseOutput', false);
  }

  isColorOutputEnabled(): boolean {
    return this.get('cli.colorOutput', true);
  }

  isTelemetryEnabled(): boolean {
    return this.get('cli.telemetry', true);
  }

  getPreferredEditor(): string {
    return this.get('editor.preferred', 'vscode');
  }

  shouldAutoInstallDependencies(): boolean {
    return this.get('development.autoInstallDependencies', true);
  }
}

// Global user preference manager
let globalUserPreferences: UserPreferenceManager | null = null;

export function createUserPreferenceManager(): UserPreferenceManager {
  return new UserPreferenceManager();
}

export function getGlobalUserPreferences(): UserPreferenceManager {
  if (!globalUserPreferences) {
    globalUserPreferences = new UserPreferenceManager();
  }
  return globalUserPreferences;
}

export function setGlobalUserPreferences(preferences: UserPreferenceManager): void {
  globalUserPreferences = preferences;
}