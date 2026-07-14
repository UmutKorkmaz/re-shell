import * as fs from 'fs-extra';
import * as path from 'path';

// --- Types ---

export interface PublishCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning';
}

export interface PublishValidationResult {
  valid: boolean;
  checks: PublishCheck[];
  errors: PublishCheck[];
  warnings: PublishCheck[];
}

// --- Constants ---

const VALID_HOOK_TYPES = new Set([
  'cli:init', 'cli:exit', 'cli:error',
  'command:before', 'command:after', 'command:error', 'command:register',
  'workspace:create', 'workspace:update', 'workspace:delete', 'workspace:build',
  'file:change', 'file:create', 'file:delete', 'file:watch',
  'build:start', 'build:end', 'build:error', 'build:success',
  'plugin:load', 'plugin:activate', 'plugin:deactivate',
  'config:load', 'config:save', 'config:validate',
  'custom',
]);

const VALID_PERMISSION_TYPES = new Set(['filesystem', 'network', 'process', 'environment', 'workspace']);
const VALID_ACCESS_TYPES = new Set(['read', 'write', 'execute', 'full']);

const NAME_REGEX = /^(@[a-z0-9][a-z0-9-._]*\/)?[a-z0-9][a-z0-9-._]*$/;

// --- Implementation ---

export async function validatePluginForPublish(
  pluginPath: string = process.cwd()
): Promise<PublishValidationResult> {
  const checks: PublishCheck[] = [];

  // 1. Read package.json
  const manifestPath = path.join(pluginPath, 'package.json');
  let manifest: Record<string, unknown> | null = null;

  if (await fs.pathExists(manifestPath)) {
    try {
      manifest = await fs.readJSON(manifestPath);
    } catch {
      manifest = null;
    }
  }

  if (!manifest) {
    checks.push({
      name: 'manifest:found',
      passed: false,
      message: 'No package.json found in plugin directory',
      severity: 'error',
    });
    return buildResult(checks);
  }

  // 2. Name validation
  const name = manifest.name as string | undefined;
  checks.push({
    name: 'manifest:name-valid',
    passed: typeof name === 'string' && NAME_REGEX.test(name),
    message: typeof name === 'string' && NAME_REGEX.test(name)
      ? `Name "${name}" is valid`
      : `Plugin name "${name}" does not match npm naming rules`,
    severity: 'error',
  });

  // 3. Keyword check
  const keywords = Array.isArray(manifest.keywords) ? manifest.keywords : [];
  const hasKeyword = keywords.includes('reshell-plugin');
  checks.push({
    name: 'manifest:keyword',
    passed: hasKeyword,
    message: hasKeyword
      ? 'Keywords include "reshell-plugin"'
      : 'Keywords must include "reshell-plugin"',
    severity: 'error',
  });

  // 4. Entry point exists
  const main = manifest.main as string | undefined;
  let mainExists = false;
  if (main) {
    const mainPath = path.join(pluginPath, main);
    mainExists = await fs.pathExists(mainPath);
  }
  checks.push({
    name: 'entry:exists',
    passed: mainExists,
    message: mainExists
      ? `Entry point "${main}" exists`
      : `Entry point "${main ?? 'undefined'}" not found`,
    severity: 'error',
  });

  // 5. Entry point exports activate
  let hasActivate = false;
  if (mainExists && main) {
    const mainPath = path.join(pluginPath, main);
    try {
      const content = await fs.readFile(mainPath, 'utf8');
      hasActivate = /activate\s*[\(:]/.test(content);
    } catch {
      hasActivate = false;
    }
  }
  checks.push({
    name: 'entry:activate',
    passed: hasActivate,
    message: hasActivate
      ? 'Entry point exports activate()'
      : 'Entry point must export an activate() function',
    severity: 'error',
  });

  // 6. Hook validation
  const reshell = manifest.reshell as Record<string, unknown> | undefined;
  const hooks = Array.isArray(reshell?.hooks) ? reshell!.hooks as string[] : [];
  if (hooks.length > 0) {
    const invalidHooks = hooks.filter(h => !VALID_HOOK_TYPES.has(h));
    checks.push({
      name: 'hooks:valid',
      passed: invalidHooks.length === 0,
      message: invalidHooks.length === 0
        ? 'All hook names are valid'
        : `Invalid hook names: ${invalidHooks.join(', ')}`,
      severity: 'error',
    });
  }

  // 7. Permission validation
  const permissions = Array.isArray(reshell?.permissions) ? reshell!.permissions as Record<string, unknown>[] : [];
  if (permissions.length > 0) {
    const invalidPerms = permissions.filter(p => {
      const type = p.type as string;
      const access = p.access as string;
      return !VALID_PERMISSION_TYPES.has(type) || !VALID_ACCESS_TYPES.has(access);
    });
    checks.push({
      name: 'permissions:valid',
      passed: invalidPerms.length === 0,
      message: invalidPerms.length === 0
        ? 'All permissions are valid'
        : `Invalid permission objects: ${invalidPerms.length} found`,
      severity: 'error',
    });
  }

  // 8. engines.reshell-cli
  const engines = manifest.engines as Record<string, unknown> | undefined;
  const hasCliEngine = engines && typeof engines['reshell-cli'] === 'string';
  checks.push({
    name: 'engines:reshell-cli',
    passed: !!hasCliEngine,
    message: hasCliEngine
      ? 'engines.reshell-cli constraint present'
      : 'Missing engines.reshell-cli version constraint',
    severity: 'error',
  });

  // 9. Description non-empty
  const description = manifest.description as string | undefined;
  checks.push({
    name: 'manifest:description',
    passed: typeof description === 'string' && description.trim().length > 0,
    message: typeof description === 'string' && description.trim().length > 0
      ? 'Description is present'
      : 'Description must be non-empty',
    severity: 'error',
  });

  // 10. (warning) LICENSE file
  const licenseExists = await fs.pathExists(path.join(pluginPath, 'LICENSE'));
  checks.push({
    name: 'files:license',
    passed: licenseExists,
    message: licenseExists
      ? 'LICENSE file present'
      : 'LICENSE file not found (recommended for npm publish)',
    severity: 'warning',
  });

  // 11. (warning) README.md file
  const readmeExists = await fs.pathExists(path.join(pluginPath, 'README.md'));
  checks.push({
    name: 'files:readme',
    passed: readmeExists,
    message: readmeExists
      ? 'README.md present'
      : 'README.md not found (recommended for npm publish)',
    severity: 'warning',
  });

  return buildResult(checks);
}

function buildResult(checks: PublishCheck[]): PublishValidationResult {
  const errors = checks.filter(c => c.severity === 'error' && !c.passed);
  const warnings = checks.filter(c => c.severity === 'warning' && !c.passed);
  return {
    valid: errors.length === 0,
    checks,
    errors,
    warnings,
  };
}
