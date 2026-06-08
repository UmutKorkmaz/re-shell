/**
 * Best-effort redaction of obvious secrets in job output before it is shown.
 *
 * This is a display-safety pass, not a security boundary: the hub already
 * controls what runs. It exists so an accidental token echoed by a CLI command
 * is not rendered verbatim into the live job log in the dashboard.
 */

const REDACTED = '[REDACTED]';

/**
 * Patterns for values that look like secrets. Each replaces the sensitive
 * portion with {@link REDACTED} while keeping surrounding context readable.
 */
const SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // key=value / key: value for secret-ish keys (token, secret, password, api key, auth).
  {
    pattern:
      /\b((?:[A-Za-z0-9_-]*(?:token|secret|password|passwd|apikey|api[_-]?key|auth|credential|private[_-]?key))[A-Za-z0-9_-]*)(\s*[=:]\s*)("?)([^\s"']+)("?)/gi,
    replacement: `$1$2$3${REDACTED}$5`,
  },
  // Authorization: Bearer <token>
  {
    pattern: /\b(Bearer\s+)([A-Za-z0-9._~+/-]+=*)/gi,
    replacement: `$1${REDACTED}`,
  },
  // Common provider key prefixes (OpenAI/Anthropic/GitHub/Slack/etc.).
  {
    pattern: /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/gi,
    replacement: REDACTED,
  },
  {
    pattern: /\bghp_[A-Za-z0-9]{20,}\b/g,
    replacement: REDACTED,
  },
  {
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gi,
    replacement: REDACTED,
  },
  // AWS access key id.
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: REDACTED,
  },
  // Long JWT-shaped strings (three base64url segments).
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: REDACTED,
  },
];

/**
 * Redact obvious secrets from a single line of output. Returns a new string;
 * the input is never mutated. Lines with no matches are returned unchanged.
 */
export function redactSecrets(line: string): string {
  let result = line;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
