import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';
import {
  loadEnvVault,
  addEnvVariable,
  getEnvVariable,
  listEnvVariables,
  removeEnvVariable,
  exportEnvVariables,
  validateRequiredEnvVars,
  migrateToEncryptedStorage,
  type EnvVault,
} from '../../src/commands/profile-env';

// Covers src/commands/profile-env.ts (508 lines) — the encrypted env vault
// behind `profile env`. AES-256-GCM crypto and the on-disk vault are exercised
// for real against a temp root (process.cwd spy); only the prompts library is
// mocked for the migration confirm step.

const mocks = vi.hoisted(() => ({
  prompts: vi.fn(),
}));

vi.mock('prompts', () => ({ default: mocks.prompts }));

const TMP = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-penv-'));
const VAULT = path.join(TMP, '.re-shell', 'env-vault.json');

let logSpy: ReturnType<typeof vi.spyOn>;
let cwdSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prompts.mockResolvedValue({ value: false });
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(TMP);
  // loadEnvVault's writeFile does not create parent directories; the profile
  // command group normally scaffolds .re-shell/ before this runs
  fsReal.mkdirSync(path.join(TMP, '.re-shell'), { recursive: true });
});

afterEach(() => {
  logSpy.mockRestore();
  cwdSpy.mockRestore();
  fsReal.rmSync(path.join(TMP, '.re-shell'), { recursive: true, force: true });
  fsReal.rmSync(path.join(TMP, '.env'), { recursive: true, force: true });
  fsReal.rmSync(path.join(TMP, '.env.backup'), { recursive: true, force: true });
  fsReal.rmSync(path.join(TMP, 'custom.env'), { recursive: true, force: true });
});

afterAll(() => {
  fsReal.rmSync(TMP, { recursive: true, force: true });
});

function readVault(): EnvVault {
  return JSON.parse(fsReal.readFileSync(VAULT, 'utf8'));
}

describe('loadEnvVault', () => {
  it('creates an empty vault file when none exists', async () => {
    const vault = await loadEnvVault();
    expect(vault).toEqual({ version: '1.0.0', profiles: {} });
    const onDisk = readVault();
    expect(onDisk.version).toBe('1.0.0');
    expect(onDisk.profiles).toEqual({});
  });

  it('round-trips a persisted vault', async () => {
    await addEnvVariable('prod', 'API_KEY', 'secret-value');
    const vault = await loadEnvVault();
    expect(vault.profiles['prod'].environment).toBe('custom');
    expect(vault.profiles['prod'].variables.API_KEY.encrypted).toBe(true);
  });
});

describe('addEnvVariable', () => {
  it('encrypts values at rest with AES-256-GCM by default', async () => {
    await addEnvVariable('prod', 'API_KEY', 'hunter2');

    const stored = readVault().profiles['prod'].variables.API_KEY;
    expect(stored.value).not.toBe('hunter2');
    expect(stored.encrypted).toBe(true);
    expect(stored.iv).toMatch(/^[0-9a-f]{32}$/);
    expect(stored.authTag).toMatch(/^[0-9a-f]+$/);
  });

  it('stores plaintext when encryption is disabled', async () => {
    await addEnvVariable('dev', 'LOG_LEVEL', 'debug', { encrypt: false });

    const stored = readVault().profiles['dev'].variables.LOG_LEVEL;
    expect(stored.value).toBe('debug');
    expect(stored.encrypted).toBe(false);
    expect(stored.iv).toBeUndefined();
  });

  it('round-trips encrypted values through getEnvVariable', async () => {
    await addEnvVariable('prod', 'API_KEY', 'hunter2');
    const decrypted = await getEnvVariable('prod', 'API_KEY');
    expect(decrypted).toBe('hunter2');
  });

  it('round-trips plaintext values without touching crypto', async () => {
    await addEnvVariable('dev', 'LOG_LEVEL', 'debug', { encrypt: false });
    expect(await getEnvVariable('dev', 'LOG_LEVEL')).toBe('debug');
  });

  it('persists description and required metadata', async () => {
    await addEnvVariable('prod', 'DB_URL', 'postgres://x', {
      description: 'primary database',
      required: true,
    });

    const stored = readVault().profiles['prod'].variables.DB_URL;
    expect(stored.description).toBe('primary database');
    expect(stored.required).toBe(true);
  });

  it('reuses an existing profile instead of resetting it', async () => {
    await addEnvVariable('prod', 'A', '1');
    await addEnvVariable('prod', 'B', '2');

    const profile = readVault().profiles['prod'];
    expect(Object.keys(profile.variables)).toEqual(['A', 'B']);
  });

  it('confirms the addition in the output', async () => {
    await addEnvVariable('prod', 'API_KEY', 'x');
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('added to profile "prod"');
    expect(out).toContain('(encrypted)');
  });
});

describe('getEnvVariable', () => {
  it('returns null for a missing profile', async () => {
    expect(await getEnvVariable('ghost', 'X')).toBeNull();
  });

  it('returns null for a missing variable', async () => {
    await addEnvVariable('prod', 'A', '1');
    expect(await getEnvVariable('prod', 'GHOST')).toBeNull();
  });

  it('throws when encrypted metadata is incomplete', async () => {
    await addEnvVariable('prod', 'A', '1');
    const vault = readVault();
    delete vault.profiles['prod'].variables.A.iv;
    fsReal.writeFileSync(VAULT, JSON.stringify(vault));

    await expect(getEnvVariable('prod', 'A')).rejects.toThrow(
      'Missing encryption data for variable "A"'
    );
  });
});

describe('listEnvVariables', () => {
  it('warns when the profile has no variables', async () => {
    await listEnvVariables('ghost');
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('No environment variables found for profile "ghost"');
  });

  it('renders badges and masks encrypted values', async () => {
    await addEnvVariable('prod', 'API_KEY', 'hunter2', {
      description: 'upstream token',
      required: true,
    });
    await addEnvVariable('prod', 'LOG_LEVEL', 'debug', { encrypt: false });

    await listEnvVariables('prod');

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Environment Variables for Profile: prod');
    expect(out).toContain('[encrypted]');
    expect(out).toContain('[required]');
    expect(out).toContain('upstream token');
    expect(out).toContain('Value: ***');
    // plaintext variable renders its real value
    expect(out).toContain('Value: debug');
  });
});

describe('removeEnvVariable', () => {
  it('warns when the profile does not exist', async () => {
    await removeEnvVariable('ghost', 'X');
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Profile "ghost" has no environment variables');
  });

  it('warns when the variable does not exist', async () => {
    await addEnvVariable('prod', 'A', '1');
    await removeEnvVariable('prod', 'GHOST');
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('not found in profile "prod"');
  });

  it('deletes the variable and persists the vault', async () => {
    await addEnvVariable('prod', 'A', '1');
    await removeEnvVariable('prod', 'A');

    expect(readVault().profiles['prod'].variables).toEqual({});
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('removed from profile "prod"');
  });
});

describe('exportEnvVariables', () => {
  it('writes a .env file with decrypted values and metadata comments', async () => {
    await addEnvVariable('prod', 'API_KEY', 'hunter2', {
      description: 'upstream token',
      required: true,
    });
    await addEnvVariable('prod', 'LOG_LEVEL', 'debug', { encrypt: false });

    await exportEnvVariables('prod');

    const content = fsReal.readFileSync(path.join(TMP, '.env'), 'utf8');
    expect(content).toContain('# Generated by Re-Shell profile: prod');
    expect(content).toContain('# upstream token');
    expect(content).toContain('# Required');
    expect(content).toContain('API_KEY=hunter2');
    expect(content).toContain('LOG_LEVEL=debug');
  });

  it('writes ciphertext verbatim when decrypt is disabled', async () => {
    await addEnvVariable('prod', 'API_KEY', 'hunter2');
    await exportEnvVariables('prod', { decrypt: false });

    const content = fsReal.readFileSync(path.join(TMP, '.env'), 'utf8');
    expect(content).not.toContain('hunter2');
    expect(content).toContain('API_KEY=');
  });

  it('honours a custom output path', async () => {
    await addEnvVariable('prod', 'A', '1');
    await exportEnvVariables('prod', { outputPath: 'custom.env' });

    expect(fsReal.existsSync(path.join(TMP, 'custom.env'))).toBe(true);
  });

  it('warns when there is nothing to export', async () => {
    await exportEnvVariables('ghost');
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('No environment variables found for profile "ghost"');
  });

  it('reports the encrypted fraction of the export', async () => {
    await addEnvVariable('prod', 'A', '1');
    await addEnvVariable('prod', 'B', '2', { encrypt: false });
    await exportEnvVariables('prod');

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Exported 2 variables to .env');
    expect(out).toContain('Encrypted: 1 / 2');
  });
});

describe('validateRequiredEnvVars', () => {
  it('treats an unknown profile as valid', async () => {
    const result = await validateRequiredEnvVars('ghost');
    expect(result).toEqual({ valid: true, missing: [], present: [] });
  });

  it('reports missing and present required variables', async () => {
    await addEnvVariable('prod', 'MISSING_VAR', 'x', { required: true });
    await addEnvVariable('prod', 'PRESENT_VAR', 'y', { required: true });
    process.env.PRESENT_VAR = 'set';

    try {
      const result = await validateRequiredEnvVars('prod');
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['MISSING_VAR']);
      expect(result.present).toEqual(['PRESENT_VAR']);
    } finally {
      delete process.env.PRESENT_VAR;
    }
  });

  it('ignores non-required variables', async () => {
    await addEnvVariable('prod', 'OPTIONAL', 'x', { required: false });
    const result = await validateRequiredEnvVars('prod');
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe('migrateToEncryptedStorage', () => {
  it('warns when the source file is missing', async () => {
    await migrateToEncryptedStorage('nope.env');
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Source file "nope.env" not found');
  });

  it('migrates sensitive variables encrypted and others as plaintext', async () => {
    fsReal.writeFileSync(
      path.join(TMP, '.env'),
      [
        '# comment line',
        '',
        'API_SECRET=topsecret',
        'DB_PASSWORD=pw',
        'AUTH_TOKEN=tok',
        'SIGNING_KEY=key1',
        'API_HOST=localhost',
        'LOG_LEVEL=info',
      ].join('\n')
    );

    await migrateToEncryptedStorage();

    const vault = readVault();
    const vars = vault.profiles['production'].variables;
    expect(vars.API_SECRET.encrypted).toBe(true);
    expect(vars.DB_PASSWORD.encrypted).toBe(true);
    expect(vars.AUTH_TOKEN.encrypted).toBe(true);
    expect(vars.SIGNING_KEY.encrypted).toBe(true);
    expect(vars.API_HOST.encrypted).toBe(true); // 'api' substring
    expect(vars.LOG_LEVEL.encrypted).toBe(false);

    // round-trip one encrypted entry
    expect(await getEnvVariable('production', 'API_SECRET')).toBe('topsecret');

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Migrated 6 variables');
  });

  it('skips malformed lines', async () => {
    fsReal.writeFileSync(path.join(TMP, '.env'), 'not-a-pair\nGOOD=1\n');
    await migrateToEncryptedStorage();

    const vault = readVault();
    expect(vault.profiles['production'].variables).toHaveProperty('GOOD');
    expect(vault.profiles['production'].variables).not.toHaveProperty('not-a-pair');
  });

  it('keeps the source file when the confirm prompt is declined', async () => {
    fsReal.writeFileSync(path.join(TMP, '.env'), 'A=1\n');
    mocks.prompts.mockResolvedValue({ value: false });

    await migrateToEncryptedStorage();

    expect(fsReal.existsSync(path.join(TMP, '.env'))).toBe(true);
    expect(fsReal.existsSync(path.join(TMP, '.env.backup'))).toBe(false);
  });

  it('backs up and removes the source file when confirmed', async () => {
    fsReal.writeFileSync(path.join(TMP, '.env'), 'A=1\n');
    mocks.prompts.mockResolvedValue({ value: true });

    await migrateToEncryptedStorage();

    expect(fsReal.existsSync(path.join(TMP, '.env'))).toBe(false);
    expect(fsReal.existsSync(path.join(TMP, '.env.backup'))).toBe(true);
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Created backup');
    expect(out).toContain('Removed original file');
  });

  it('supports a custom source file and target profile', async () => {
    fsReal.writeFileSync(path.join(TMP, 'custom.env'), 'A=1\n');
    await migrateToEncryptedStorage('custom.env', 'staging');

    expect(readVault().profiles).toHaveProperty('staging');
  });
});
