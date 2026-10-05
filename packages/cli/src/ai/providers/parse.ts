import {
  AiProviderError,
  type AiProviderName,
  type ProposalOutcome,
  type RawAlternative,
  type RawProposal,
} from '../types';

/**
 * Parsing of raw model output into a {@link RawProposal}.
 *
 * Models (especially small local ones) do not always return clean JSON: they
 * wrap it in code fences, prepend `<think>` blocks, or add commentary. These
 * helpers recover the JSON object when it is unambiguously there, and otherwise
 * fail with a `malformed` {@link AiProviderError} — a failure the caller turns
 * into an offline fallback. They never "repair" a proposal's content.
 */

const OUTCOMES: readonly ProposalOutcome[] = ['command', 'clarify', 'unsupported'];

/**
 * Extract the first balanced top-level JSON object from free text.
 *
 * @param text - Model output.
 * @returns The parsed value.
 * @throws {SyntaxError} When no parseable JSON object is present.
 */
export function extractJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/```(?:json)?/gi, ' ')
    .trim();

  // Fast path: the whole thing is JSON.
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through to scanning */
  }

  const start = cleaned.indexOf('{');
  if (start === -1) throw new SyntaxError('no JSON object found in model output');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new SyntaxError('unterminated JSON object in model output');
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every(v => typeof v === 'string')) return undefined;
  return value as string[];
}

function clamp01(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Check the SHAPE of a parsed model response and normalise it into a
 * {@link RawProposal}. This validates structure only; whether the argv is a
 * real, allowed command is decided later against the live catalogue.
 *
 * @param value - Parsed JSON from the model.
 * @param provider - Provider name, for error attribution.
 * @returns The normalised proposal.
 * @throws {AiProviderError} `malformed` when the shape is wrong.
 */
export function parseRawProposal(value: unknown, provider: AiProviderName): RawProposal {
  const malformed = (why: string): AiProviderError =>
    new AiProviderError(provider, 'malformed', `model returned an invalid proposal: ${why}`);

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw malformed('not a JSON object');
  }
  const v = value as Record<string, unknown>;

  const outcome = v.outcome;
  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome as ProposalOutcome)) {
    throw malformed('"outcome" must be command, clarify or unsupported');
  }

  const argv = v.argv === undefined ? [] : asStringArray(v.argv);
  if (argv === undefined) throw malformed('"argv" must be an array of strings');
  if (outcome === 'command' && argv.length === 0) {
    throw malformed('outcome "command" requires a non-empty "argv"');
  }

  const alternatives: RawAlternative[] = [];
  if (v.alternatives !== undefined) {
    if (!Array.isArray(v.alternatives)) throw malformed('"alternatives" must be an array');
    for (const alt of v.alternatives.slice(0, 6)) {
      if (!alt || typeof alt !== 'object') continue;
      const altArgv = asStringArray((alt as Record<string, unknown>).argv);
      if (!altArgv || altArgv.length === 0) continue;
      alternatives.push({
        argv: altArgv,
        confidence: clamp01((alt as Record<string, unknown>).confidence),
      });
    }
  }

  return {
    outcome: outcome as ProposalOutcome,
    argv,
    confidence: clamp01(v.confidence),
    rationale: typeof v.rationale === 'string' ? v.rationale.slice(0, 500) : '',
    question: typeof v.question === 'string' ? v.question.slice(0, 300) : '',
    alternatives,
  };
}

/**
 * Parse model text into a proposal (extract JSON, then check shape).
 *
 * @param text - Raw model text.
 * @param provider - Provider name, for error attribution.
 * @returns The normalised proposal.
 * @throws {AiProviderError} `malformed` when the text is not a valid proposal.
 */
export function parseProposalText(text: string, provider: AiProviderName): RawProposal {
  let json: unknown;
  try {
    json = extractJsonObject(text);
  } catch (error) {
    throw new AiProviderError(
      provider,
      'malformed',
      `model output was not valid JSON (${error instanceof Error ? error.message : 'parse error'})`
    );
  }
  return parseRawProposal(json, provider);
}
