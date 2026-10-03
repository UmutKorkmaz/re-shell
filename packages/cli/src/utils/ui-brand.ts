import * as fs from 'fs';
import * as path from 'path';
import {
  WHITE_LABEL_FILES,
  WHITE_LABEL_FILE_ENV,
  resolveWhiteLabel,
  whiteLabelFromEnv,
  type ResolvedWhiteLabel
} from '@re-shell/contracts';

/**
 * White-label config for `re-shell ui` (static mode), resolved at SERVE time. This is the same
 * resolution the dashboard build's Vite plugin performs at BUILD time, so a prebuilt dashboard
 * can be re-branded without rebuilding it. Sources, highest priority first:
 *
 *   RE_SHELL_BRAND_NAME / _TAGLINE / _LOGO / _FAVICON / _ACCENT   environment
 *   RE_SHELL_WHITE_LABEL_FILE, else re-shell.whitelabel.json or .re-shell/whitelabel.json
 *   in the workspace directory
 */
export interface LoadedBrand {
  /** Resolved, validated brand (defaults when nothing is configured). */
  brand: ResolvedWhiteLabel;
  /** The config file that contributed, when there was one. */
  file: string | null;
  /** True when a file or an environment variable changed anything. */
  customised: boolean;
}

/** Thrown for an unreadable or invalid white-label config. The message lists every reason. */
export class WhiteLabelConfigError extends Error {
  constructor(
    message: string,
    readonly reasons: string[]
  ) {
    super(message);
    this.name = 'WhiteLabelConfigError';
  }
}

export function loadWhiteLabel(
  workspace: string,
  env: Readonly<Record<string, string | undefined>> = process.env
): LoadedBrand {
  const explicit = env[WHITE_LABEL_FILE_ENV];
  const candidates = explicit
    ? [path.resolve(workspace, explicit)]
    : WHITE_LABEL_FILES.map(name => path.resolve(workspace, name));
  const file = candidates.find(candidate => fs.existsSync(candidate)) ?? null;
  if (explicit && !file) {
    throw new WhiteLabelConfigError(`${WHITE_LABEL_FILE_ENV}=${explicit} does not exist`, [
      `${candidates[0]} not found`
    ]);
  }

  let fromFile: unknown;
  if (file) {
    try {
      fromFile = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      const reason = (error as Error).message;
      throw new WhiteLabelConfigError(`White-label config ${file} is not valid JSON: ${reason}`, [reason]);
    }
  }

  const fromEnv = whiteLabelFromEnv(env);
  const result = resolveWhiteLabel(fromFile, fromEnv);
  if (!result.ok) {
    // The CLI is compiled with strict:false, which does not narrow the union.
    const reasons = (result as { errors: readonly string[] }).errors.slice();
    throw new WhiteLabelConfigError(
      `Invalid white-label config${file ? ` (${file})` : ''}: ${reasons.join('; ')}`,
      reasons
    );
  }
  return {
    brand: result.config,
    file,
    customised: file !== null || Object.keys(fromEnv).length > 0
  };
}
