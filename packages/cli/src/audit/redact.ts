/**
 * Secret redaction for audit-log arguments.
 *
 * The audit log is committed evidence, so it must never contain credentials.
 * Redaction is deliberately conservative: when a flag or key NAME looks like it
 * carries a secret, the VALUE is replaced, and independently any value that
 * LOOKS like a well-known credential format is replaced wherever it appears.
 */

export const REDACTED = '[REDACTED]';

/** Words that mark a flag / key name as carrying a secret value. */
const SECRET_NAME =
  /(token|secret|passw(?:or)?d|passwd|pwd|api[-_]?key|apikey|access[-_]?key|private[-_]?key|secret[-_]?key|(?:^|[-_.])auth(?:orization)?(?:$|[-_.])|credential|bearer|session[-_]?id|(?:^|[-_.])key(?:$|[-_.]))/i;

/** Well-known credential formats, matched anywhere inside a value. */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{16,}\b/g, // GitLab
  /\bnpm_[A-Za-z0-9]{30,}\b/g, // npm
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bASIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
  /\bsk-[A-Za-z0-9_-]{20,}\b/g, // OpenAI/Anthropic style
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
];

/** `scheme://user:password@host` -> keep user, mask password. */
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)([^\s/@]+)(@)/gi;

/** Subcommands whose positional args are `<key> <value>` pairs (e.g. `config set`). */
const KEY_VALUE_VERBS = new Set(['set', 'add', 'put', 'store', 'export', 'update']);

/** Redact secret-looking substrings inside a single value. */
export function redactValue(value: string): string {
  let out = value.replace(URL_CREDENTIALS, `$1${REDACTED}$3`);
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/** Whether a flag/key NAME (without leading dashes) suggests a secret value. */
export function isSecretName(name: string): boolean {
  return SECRET_NAME.test(name);
}

const MAX_ARG_LENGTH = 512;
const MAX_ARGS = 100;

function clip(value: string): string {
  return value.length > MAX_ARG_LENGTH ? `${value.slice(0, MAX_ARG_LENGTH)}...[truncated]` : value;
}

/**
 * Redact an argv-style list (everything after the command path).
 *
 * Handles:
 *  - `--api-token VALUE`, `--password VALUE` (next token, unless it is another flag)
 *  - `--api-token=VALUE`, `--password=VALUE`
 *  - `NAME=VALUE` positionals where NAME looks secret (e.g. `API_KEY=abc`)
 *  - `<verb> <secret-name> <value>` for set-like verbs (`config set apiToken abc`)
 *  - credential-shaped values anywhere (GitHub/AWS/Slack/npm/JWT/URL passwords)
 */
export function redactArgs(args: readonly string[], commandPath: readonly string[] = []): string[] {
  const verb = commandPath[commandPath.length - 1] ?? '';
  const keyValueVerb = KEY_VALUE_VERBS.has(verb);
  const out: string[] = [];
  let redactNext = false;
  let positionalIndex = 0;
  let secretKeyPositional = false;

  for (const raw of args.slice(0, MAX_ARGS)) {
    if (redactNext) {
      redactNext = false;
      // A following flag means the secret flag was a boolean; do not eat it.
      if (!raw.startsWith('-')) {
        out.push(REDACTED);
        continue;
      }
    }

    if (raw.startsWith('--') && raw.length > 2) {
      const eq = raw.indexOf('=');
      const name = (eq === -1 ? raw : raw.slice(0, eq)).replace(/^--/, '');
      if (isSecretName(name)) {
        if (eq === -1) {
          redactNext = true;
          out.push(raw);
        } else {
          out.push(`${raw.slice(0, eq)}=${REDACTED}`);
        }
        continue;
      }
      out.push(clip(redactValue(raw)));
      continue;
    }

    if (raw.startsWith('-') && raw.length > 1) {
      // Short flags (-p, -t ...) carry no name we can classify; only mask
      // credential-shaped content.
      out.push(clip(redactValue(raw)));
      continue;
    }

    // Positional
    const eq = raw.indexOf('=');
    if (eq > 0 && isSecretName(raw.slice(0, eq))) {
      out.push(`${raw.slice(0, eq)}=${REDACTED}`);
      positionalIndex += 1;
      continue;
    }
    if (keyValueVerb && secretKeyPositional) {
      secretKeyPositional = false;
      out.push(REDACTED);
      positionalIndex += 1;
      continue;
    }
    if (keyValueVerb && positionalIndex === 0 && isSecretName(raw)) {
      secretKeyPositional = true;
    }
    positionalIndex += 1;
    out.push(clip(redactValue(raw)));
  }

  if (args.length > MAX_ARGS) out.push(`...[${args.length - MAX_ARGS} more args truncated]`);
  return out;
}
