import { ValidationError } from './error-handler';

// --- Types ---

export type PluginType = 'hooks' | 'commands' | 'both';
export type LicenseType = 'MIT' | 'Apache-2.0' | 'ISC' | 'Unlicense';

export type WizardHookType =
  | 'cli:init' | 'cli:exit' | 'cli:error'
  | 'command:before' | 'command:after' | 'command:error'
  | 'workspace:create' | 'workspace:update' | 'workspace:delete' | 'workspace:build'
  | 'file:change' | 'file:create' | 'file:delete'
  | 'build:start' | 'build:end' | 'build:error' | 'build:success'
  | 'plugin:load' | 'plugin:activate' | 'plugin:deactivate'
  | 'config:load' | 'config:save' | 'config:validate';

export type PermissionShorthand =
  | 'filesystem:read' | 'filesystem:write'
  | 'network'
  | 'process:execute'
  | 'environment:read';

export interface PluginScaffoldConfig {
  name: string;
  displayName: string;
  description: string;
  author: string;
  license: LicenseType;
  pluginType: PluginType;
  hooks: WizardHookType[];
  commands: string[];
  permissions: PermissionShorthand[];
  frameworkTarget: 'universal' | string;
  includeTests: boolean;
  includeCI: boolean;
}

// --- Constants ---

export const VALID_HOOK_TYPES: WizardHookType[] = [
  'cli:init', 'cli:exit', 'cli:error',
  'command:before', 'command:after', 'command:error',
  'workspace:create', 'workspace:update', 'workspace:delete', 'workspace:build',
  'file:change', 'file:create', 'file:delete',
  'build:start', 'build:end', 'build:error', 'build:success',
  'plugin:load', 'plugin:activate', 'plugin:deactivate',
  'config:load', 'config:save', 'config:validate',
];

export const VALID_PERMISSIONS: PermissionShorthand[] = [
  'filesystem:read', 'filesystem:write',
  'network',
  'process:execute',
  'environment:read',
];

const VALID_LICENSES: LicenseType[] = ['MIT', 'Apache-2.0', 'ISC', 'Unlicense'];
const VALID_TYPES: PluginType[] = ['hooks', 'commands', 'both'];

// --- Utilities ---

export function isValidPluginName(name: string): boolean {
  return /^(@[a-z0-9][a-z0-9-._]*\/)?[a-z0-9][a-z0-9-._]*$/.test(name) && name.length > 0;
}

export function parseList(input: string): string[] {
  if (!input || !input.trim()) return [];
  return input.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

// --- Non-interactive config builder ---

export interface WizardFlags {
  name: string;
  description: string;
  author: string;
  license: string | undefined;
  type: string | undefined;
  hooks: string | undefined;
  commands: string | undefined;
  permissions: string | undefined;
  framework: string | undefined;
  includeTests: boolean | undefined;
  includeCI: boolean | undefined;
}

export function buildConfigFromFlags(flags: WizardFlags): PluginScaffoldConfig {
  if (!isValidPluginName(flags.name)) {
    throw new ValidationError(`Invalid plugin name: "${flags.name}". Must be lowercase, alphanumeric with hyphens`);
  }
  if (!flags.description || !flags.description.trim()) {
    throw new ValidationError('Missing required field: description. Use --description flag');
  }

  const license = (flags.license ?? 'MIT') as LicenseType;
  if (!VALID_LICENSES.includes(license)) {
    throw new ValidationError(`Invalid license '${license}'. Supported: ${VALID_LICENSES.join(', ')}`);
  }

  const pluginType = (flags.type ?? 'both') as PluginType;
  if (!VALID_TYPES.includes(pluginType)) {
    throw new ValidationError(`Invalid type '${flags.type}'. Supported: ${VALID_TYPES.join(', ')}`);
  }

  const hooks = parseList(flags.hooks ?? '');
  for (const h of hooks) {
    if (!VALID_HOOK_TYPES.includes(h as WizardHookType)) {
      throw new ValidationError(`Invalid hook '${h}'. See HookType enum for valid values`);
    }
  }

  const commands = parseList(flags.commands ?? '');

  const permissions = parseList(flags.permissions ?? '');
  for (const p of permissions) {
    if (!VALID_PERMISSIONS.includes(p as PermissionShorthand)) {
      throw new ValidationError(`Invalid permission '${p}'. Supported: ${VALID_PERMISSIONS.join(', ')}`);
    }
  }

  return {
    name: flags.name,
    displayName: flags.name,
    description: flags.description,
    author: flags.author,
    license,
    pluginType,
    hooks: hooks as WizardHookType[],
    commands,
    permissions: permissions as PermissionShorthand[],
    frameworkTarget: flags.framework ?? 'universal',
    includeTests: flags.includeTests ?? true,
    includeCI: flags.includeCI ?? true,
  };
}
