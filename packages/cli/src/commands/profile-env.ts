import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import chalk from 'chalk';
import prompts from 'prompts';

/**
 * Encrypted environment variable storage
 * Uses AES-256-GCM encryption for secure storage
 */

const ENCRYPTION_KEY_LENGTH = 32; // 256 bits
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENV_VAULT_PATH = '.re-shell/env-vault.json';


/**
 * Represents a single environment variable entry, optionally encrypted at rest.
 *
 * Encrypted entries store the ciphertext value together with the AES-256-GCM
 * initialization vector and authentication tag required for decryption.
 */
export interface EncryptedEnvVar {
  /** The environment variable name (e.g. `DATABASE_URL`). */
  name: string;
  /** The variable value. When `encrypted` is true this is the ciphertext (hex). */
  value: string;
  /** Whether the `value` is encrypted at rest. */
  encrypted: boolean;
  /** Initialization vector used for AES-256-GCM encryption (hex), present when `encrypted` is true. */
  iv?: string; // Initialization vector
  /** Authentication tag produced by AES-256-GCM (hex), present when `encrypted` is true. */
  authTag?: string; // Authentication tag
  /** Optional human-readable description of the variable's purpose. */
  description?: string;
  /** Whether the variable must be present in the runtime environment. */
  required?: boolean;
}

/**
 * On-disk schema for the encrypted environment variable vault (`.re-shell/env-vault.json`).
 *
 * The vault holds a set of named profiles, each with its own environment,
 * variable map, and key identifier.
 */
export interface EnvVault {
  /** Schema version of the vault file. */
  version: string;
  /** Map of profile name to profile-specific environment configuration. */
  profiles: Record<string, {
    /** Logical environment label associated with the profile (e.g. `production`). */
    environment: string;
    /** Map of variable name to {@link EncryptedEnvVar} entry. */
    variables: Record<string, EncryptedEnvVar>;
    /** Identifier of the encryption key used for the profile (not the actual key). */
    encryptionKey: string; // Key identifier (not the actual key)
  }>;
}

/**
 * Generate encryption key from system info
 * In production, this should use a secure key management system
 */
function generateEncryptionKey(): Buffer {
  // For demo purposes, using a simple key derivation
  // In production, use proper key management (AWS KMS, HashiCorp Vault, etc.)
  const keyMaterial = process.env.RE_SHELL_ENCRYPTION_KEY || 'default-key-change-in-production';
  return crypto.scryptSync(keyMaterial, 'salt', ENCRYPTION_KEY_LENGTH);
}

/**
 * Encrypt a value using AES-256-GCM
 */
function encryptValue(value: string, key: Buffer): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt a value using AES-256-GCM
 */
function decryptValue(
  encrypted: string,
  iv: string,
  authTag: string,
  key: Buffer
): string {
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Load the environment vault from disk, creating an empty vault if it does not exist.
 *
 * @returns The loaded (or newly created) {@link EnvVault} instance.
 */
export async function loadEnvVault(): Promise<EnvVault> {
  const vaultPath = path.join(process.cwd(), ENV_VAULT_PATH);

  if (!(await fs.pathExists(vaultPath))) {
    const emptyVault: EnvVault = {
      version: '1.0.0',
      profiles: {},
    };
    await fs.writeFile(vaultPath, JSON.stringify(emptyVault, null, 2), 'utf8');
    return emptyVault;
  }

  const content = await fs.readFile(vaultPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Save environment vault
 */
async function saveEnvVault(vault: EnvVault): Promise<void> {
  const vaultPath = path.join(process.cwd(), ENV_VAULT_PATH);
  await fs.writeFile(vaultPath, JSON.stringify(vault, null, 2), 'utf8');
}

/**
 * Add an environment variable to a profile, encrypting it at rest when requested.
 *
 * If the profile does not yet exist in the vault it is initialized with a
 * `custom` environment label. When `options.encrypt` is true the value is
 * encrypted using AES-256-GCM before being persisted.
 *
 * @param profileName - Name of the target profile.
 * @param varName - Name of the environment variable.
 * @param value - Raw value of the variable (will be encrypted when `encrypt` is true).
 * @param options - Optional behavior flags.
 * @param options.encrypt - Whether to encrypt the value at rest (default `true`).
 * @param options.description - Optional human-readable description of the variable.
 * @param options.required - Whether the variable is required at runtime (default `false`).
 * @returns Resolves once the variable has been persisted to the vault.
 */
export async function addEnvVariable(
  profileName: string,
  varName: string,
  value: string,
  options: {
    encrypt?: boolean;
    description?: string;
    required?: boolean;
  } = {}
): Promise<void> {
  const { encrypt = true, description, required = false } = options;

  const vault = await loadEnvVault();

  // Initialize profile if not exists
  if (!vault.profiles[profileName]) {
    vault.profiles[profileName] = {
      environment: 'custom',
      variables: {},
      encryptionKey: 'default',
    };
  }

  const envVar: EncryptedEnvVar = {
    name: varName,
    value,
    encrypted: encrypt,
    description,
    required,
  };

  // Encrypt if requested
  if (encrypt) {
    const key = generateEncryptionKey();
    const encrypted = encryptValue(value, key);
    envVar.value = encrypted.encrypted;
    envVar.iv = encrypted.iv;
    envVar.authTag = encrypted.authTag;
  }

  vault.profiles[profileName].variables[varName] = envVar;
  await saveEnvVault(vault);

  console.log(chalk.green(`✓ Environment variable "${varName}" added to profile "${profileName}"`));
  if (encrypt) {
    console.log(chalk.gray('  (encrypted)'));
  }
}

/**
 * Retrieve the decrypted value of an environment variable from a profile.
 *
 * @param profileName - Name of the profile to read from.
 * @param varName - Name of the environment variable to retrieve.
 * @returns The decrypted (or plaintext) value, or `null` when the profile or variable does not exist.
 */
export async function getEnvVariable(
  profileName: string,
  varName: string
): Promise<string | null> {
  const vault = await loadEnvVault();

  if (!vault.profiles[profileName]) {
    return null;
  }

  const envVar = vault.profiles[profileName].variables[varName];
  if (!envVar) {
    return null;
  }

  // Return as-is if not encrypted
  if (!envVar.encrypted) {
    return envVar.value;
  }

  // Decrypt if encrypted
  const key = generateEncryptionKey();
  if (!envVar.iv || !envVar.authTag) {
    throw new Error(`Missing encryption data for variable "${varName}"`);
  }

  return decryptValue(envVar.value, envVar.iv, envVar.authTag, key);
}

/**
 * Print all environment variables belonging to a profile to the console.
 *
 * Variables are rendered with badges indicating encryption/required status and
 * a masked value for encrypted entries.
 *
 * @param profileName - Name of the profile whose variables should be listed.
 * @returns Resolves once the listing has been printed.
 */
export async function listEnvVariables(profileName: string): Promise<void> {
  const vault = await loadEnvVault();

  if (!vault.profiles[profileName]) {
    console.log(chalk.yellow(`\n⚠ No environment variables found for profile "${profileName}"\n`));
    return;
  }

  const profile = vault.profiles[profileName];
  const variables = Object.values(profile.variables);

  if (variables.length === 0) {
    console.log(chalk.yellow(`\n⚠ No environment variables found for profile "${profileName}"\n`));
    return;
  }

  console.log(chalk.cyan.bold(`\n🔐 Environment Variables for Profile: ${profileName}\n`));

  for (const envVar of variables) {
    const encryptedBadge = envVar.encrypted ? chalk.gray(' [encrypted]') : '';
    const requiredBadge = envVar.required ? chalk.red(' [required]') : '';
    const description = envVar.description ? ` - ${envVar.description}` : '';

    console.log(chalk.white(`${envVar.name}${encryptedBadge}${requiredBadge}${description}`));
    console.log(chalk.gray(`  Value: ${envVar.encrypted ? '***' : envVar.value}`));
  }

  console.log('');
}

/**
 * Remove an environment variable from a profile and persist the change.
 *
 * @param profileName - Name of the profile to remove the variable from.
 * @param varName - Name of the variable to remove.
 * @returns Resolves once the vault has been updated (or after warning that the profile/variable was missing).
 */
export async function removeEnvVariable(profileName: string, varName: string): Promise<void> {
  const vault = await loadEnvVault();

  if (!vault.profiles[profileName]) {
    console.log(chalk.yellow(`\n⚠ Profile "${profileName}" has no environment variables\n`));
    return;
  }

  if (!vault.profiles[profileName].variables[varName]) {
    console.log(chalk.yellow(`\n⚠ Environment variable "${varName}" not found in profile "${profileName}"\n`));
    return;
  }

  delete vault.profiles[profileName].variables[varName];
  await saveEnvVault(vault);

  console.log(chalk.green(`\n✓ Environment variable "${varName}" removed from profile "${profileName}"\n`));
}

/**
 * Export a profile's environment variables to a `.env`-style file.
 *
 * Encrypted variables are decrypted before being written when `options.decrypt`
 * is true; otherwise their ciphertext is written verbatim.
 *
 * @param profileName - Name of the profile to export.
 * @param options - Optional export configuration.
 * @param options.outputPath - Relative path of the output file (default `.env`).
 * @param options.decrypt - Whether to decrypt encrypted values before writing (default `true`).
 * @returns Resolves once the file has been written.
 */
export async function exportEnvVariables(
  profileName: string,
  options: {
    outputPath?: string;
    decrypt?: boolean;
  } = {}
): Promise<void> {
  const { outputPath = '.env', decrypt = true } = options;

  const vault = await loadEnvVault();

  if (!vault.profiles[profileName]) {
    console.log(chalk.yellow(`\n⚠ No environment variables found for profile "${profileName}"\n`));
    return;
  }

  const profile = vault.profiles[profileName];
  const variables = Object.values(profile.variables);

  if (variables.length === 0) {
    console.log(chalk.yellow(`\n⚠ No environment variables to export\n`));
    return;
  }

  // Build .env file content
  const lines: string[] = [];
  lines.push('# Generated by Re-Shell profile: ' + profileName);
  lines.push('# Timestamp: ' + new Date().toISOString());
  lines.push('# Do not edit manually, use "re-shell profile env" commands');
  lines.push('');

  for (const envVar of variables) {
    let value = envVar.value;

    // Decrypt if requested and encrypted
    if (decrypt && envVar.encrypted) {
      const key = generateEncryptionKey();
      if (envVar.iv && envVar.authTag) {
        value = decryptValue(envVar.value, envVar.iv, envVar.authTag, key);
      }
    }

    // Add description as comment
    if (envVar.description) {
      lines.push(`# ${envVar.description}`);
    }

    // Mark as required
    if (envVar.required) {
      lines.push(`# Required`);
    }

    lines.push(`${envVar.name}=${value}`);
    lines.push('');
  }

  // Write to file
  const filePath = path.join(process.cwd(), outputPath);
  await fs.writeFile(filePath, lines.join('\n'), 'utf8');

  console.log(chalk.green(`\n✓ Exported ${variables.length} variables to ${outputPath}\n`));
  console.log(chalk.gray(`Profile: ${profileName}`));
  console.log(chalk.gray(`Encrypted: ${variables.filter(v => v.encrypted).length} / ${variables.length}\n`));
}

/**
 * Validate that all required variables for a profile are present in the current
 * `process.env`.
 *
 * @param profileName - Name of the profile whose required variables should be checked.
 * @returns An object describing the validation result:
 *   - `valid` is `true` when no required variables are missing.
 *   - `missing` lists required variable names that are absent from `process.env`.
 *   - `present` lists required variable names that are available in `process.env`.
 */
export async function validateRequiredEnvVars(profileName: string): Promise<{
  valid: boolean;
  missing: string[];
  present: string[];
}> {
  const vault = await loadEnvVault();

  if (!vault.profiles[profileName]) {
    return { valid: true, missing: [], present: [] };
  }

  const profile = vault.profiles[profileName];
  const variables = Object.values(profile.variables);

  const required = variables.filter(v => v.required);
  const missing: string[] = [];
  const present: string[] = [];

  for (const envVar of required) {
    const value = process.env[envVar.name];
    if (value) {
      present.push(envVar.name);
    } else {
      missing.push(envVar.name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    present,
  };
}

/**
 * Migrate variables from a plaintext `.env` file into the encrypted vault.
 *
 * Variables whose names suggest they are sensitive (`secret`, `password`,
 * `key`, `token`, `api`) are stored encrypted; all others are stored as
 * plaintext. After the migration completes the user is prompted to back up and
 * remove the original source file.
 *
 * @param sourceFile - Path to the plaintext `.env` file to migrate (default `.env`).
 * @param targetProfile - Name of the profile to migrate the variables into (default `production`).
 * @returns Resolves once the migration (and optional backup) has completed.
 */
export async function migrateToEncryptedStorage(
  sourceFile = '.env',
  targetProfile = 'production'
): Promise<void> {
  const sourcePath = path.join(process.cwd(), sourceFile);

  if (!(await fs.pathExists(sourcePath))) {
    console.log(chalk.yellow(`\n⚠ Source file "${sourceFile}" not found\n`));
    return;
  }

  // Parse .env file
  const content = await fs.readFile(sourcePath, 'utf8');
  const lines = content.split('\n');

  let migrated = 0;
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, name, value] = match;

      // Detect sensitive variables
      const isSensitive =
        name.toLowerCase().includes('secret') ||
        name.toLowerCase().includes('password') ||
        name.toLowerCase().includes('key') ||
        name.toLowerCase().includes('token') ||
        name.toLowerCase().includes('api');

      await addEnvVariable(targetProfile, name, value, {
        encrypt: isSensitive,
        required: false,
      });

      migrated++;
    }
  }

  console.log(chalk.green(`\n✓ Migrated ${migrated} variables from "${sourceFile}" to profile "${targetProfile}"\n`));

  // Ask if user wants to backup and remove original file
  const { value: confirm } = await prompts({
    type: 'confirm',
    name: 'value',
    message: `Create backup and remove "${sourceFile}"?`,
    initial: false,
  });

  if (confirm) {
    const backupPath = sourcePath + '.backup';
    await fs.copy(sourcePath, backupPath);
    await fs.remove(sourcePath);
    console.log(chalk.green(`✓ Created backup: ${backupPath}`));
    console.log(chalk.green(`✓ Removed original file: ${sourceFile}\n`));
  }
}
