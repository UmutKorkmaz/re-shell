import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { IntentCandidate } from '../utils/ai-intent';
import { ensureStateDir, readJsonSafe, writeJsonAtomic } from './store';
import type { HistoryTurn } from './types';

/**
 * Multi-turn session memory (`.re-shell/ai/sessions/<id>.json`).
 *
 * A session records each prompt and how it was answered, and — crucially — a
 * PENDING clarification: when a prompt was ambiguous the candidates and the
 * question are stored, so the next turn ("the second one", "payments") can
 * answer it instead of starting from scratch.
 *
 * Session ids are validated against a strict charset before they ever touch the
 * filesystem, so an id can never escape the sessions directory.
 */

/** Valid session id. */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Turns kept per session (oldest are dropped). */
export const MAX_SESSION_TURNS = 50;

const MAX_STORED_PROMPT = 500;

/** How a turn was answered. */
export type TurnKind = 'resolved' | 'clarify' | 'cancelled';

/** One recorded turn. */
export interface SessionTurn {
  at: string;
  prompt: string;
  kind: TurnKind;
  /** Resolved argv (for `resolved`). */
  argv?: string[];
  confidence?: number;
  /** The question asked (for `clarify`). */
  question?: string;
  /** Candidate argvs offered (for `clarify`). */
  candidates?: Array<{ argv: string[]; confidence: number }>;
  provider: string;
  /** offline | llm | cache | clarification */
  source: string;
}

/** A clarification awaiting the user's answer. */
export interface PendingClarification {
  question: string;
  reason: string;
  candidates: IntentCandidate[];
  /** The prompt that caused the clarification. */
  originalPrompt: string;
  askedAt: string;
}

/** A persisted session. */
export interface AiSession {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  workspaceFingerprint: string;
  turns: SessionTurn[];
  pending?: PendingClarification;
}

/** Summary row for `ai session list`. */
export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  turns: number;
  pending: boolean;
  lastPrompt?: string;
}

/** Thrown for malformed ids and missing sessions. */
export class SessionError extends Error {
  constructor(
    public readonly code: 'invalid-id' | 'not-found',
    message: string
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

/** Whether a string is a usable session id. */
export function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}

/** Generate a fresh, unguessable-enough, sortable session id. */
export function newSessionId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `s-${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

/** The session store. */
export class SessionStore {
  private readonly dir: string;
  private readonly stateRoot: string;

  /**
   * @param stateDir - The AI state directory (`<root>/.re-shell/ai`).
   */
  constructor(stateDir: string) {
    this.stateRoot = stateDir;
    this.dir = path.join(stateDir, 'sessions');
  }

  /** Directory holding the session files. */
  get directory(): string {
    return this.dir;
  }

  private fileFor(id: string): string {
    if (!isValidSessionId(id)) {
      throw new SessionError(
        'invalid-id',
        'session ids may contain letters, digits, "-" and "_" (max 64 chars, no leading dash)'
      );
    }
    return path.join(this.dir, `${id}.json`);
  }

  /** Create an in-memory session (not persisted until {@link save}). */
  create(id: string | undefined, workspaceFingerprint: string, now: Date = new Date()): AiSession {
    const sessionId = id ?? newSessionId(now);
    this.fileFor(sessionId); // validates
    const at = now.toISOString();
    return {
      version: 1,
      id: sessionId,
      createdAt: at,
      updatedAt: at,
      workspaceFingerprint,
      turns: [],
    };
  }

  /** Whether a session exists on disk. */
  exists(id: string): boolean {
    return fs.existsSync(this.fileFor(id));
  }

  /**
   * Load a session.
   *
   * @throws {SessionError} `invalid-id` or `not-found`.
   */
  load(id: string): AiSession {
    const file = this.fileFor(id);
    const data = readJsonSafe<AiSession>(file);
    if (!data || data.version !== 1 || data.id !== id || !Array.isArray(data.turns)) {
      throw new SessionError('not-found', `no session "${id}" in this workspace`);
    }
    return data;
  }

  /** Persist a session (bumps `updatedAt`, trims old turns). */
  save(session: AiSession, now: Date = new Date()): void {
    ensureStateDir(this.dir, this.stateRoot);
    session.updatedAt = now.toISOString();
    if (session.turns.length > MAX_SESSION_TURNS) {
      session.turns = session.turns.slice(-MAX_SESSION_TURNS);
    }
    writeJsonAtomic(this.fileFor(session.id), session);
  }

  /** All sessions, most recently updated first. Corrupt files are skipped. */
  list(): SessionSummary[] {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return [];
    }
    const out: SessionSummary[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const id = name.slice(0, -'.json'.length);
      if (!isValidSessionId(id)) continue;
      const s = readJsonSafe<AiSession>(path.join(this.dir, name));
      if (!s || s.version !== 1 || s.id !== id || !Array.isArray(s.turns)) continue;
      out.push({
        id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        turns: s.turns.length,
        pending: s.pending !== undefined,
        lastPrompt: s.turns[s.turns.length - 1]?.prompt,
      });
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }

  /** The most recently updated session id, if any. */
  latestId(): string | undefined {
    return this.list()[0]?.id;
  }

  /**
   * Delete one session.
   *
   * @returns Whether a session was removed.
   */
  remove(id: string): boolean {
    const file = this.fileFor(id);
    if (!fs.existsSync(file)) return false;
    fs.rmSync(file, { force: true });
    return true;
  }

  /** Delete every session; returns how many were removed. */
  removeAll(): number {
    const ids = this.list().map(s => s.id);
    for (const id of ids) fs.rmSync(this.fileFor(id), { force: true });
    return ids.length;
  }
}

/** Trim a prompt for storage. */
export function storablePrompt(prompt: string): string {
  // eslint-disable-next-line no-control-regex
  return prompt.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_STORED_PROMPT);
}

/**
 * Project a session onto the conversational history handed to an LLM, so
 * follow-ups like "do the same for orders" can be understood.
 *
 * @param session - The session.
 * @param limit - Maximum turns to include (most recent).
 * @returns Prompt/answer pairs, oldest first.
 */
export function historyForModel(session: AiSession | undefined, limit = 6): HistoryTurn[] {
  if (!session) return [];
  return session.turns
    .filter(t => t.kind !== 'cancelled')
    .slice(-limit)
    .map(t => ({
      prompt: t.prompt,
      answer:
        t.kind === 'resolved'
          ? JSON.stringify({
              outcome: 'command',
              argv: t.argv ?? [],
              confidence: t.confidence ?? 0,
              rationale: '',
              question: '',
              alternatives: [],
            })
          : JSON.stringify({
              outcome: 'clarify',
              argv: [],
              confidence: 0,
              rationale: '',
              question: t.question ?? '',
              alternatives: (t.candidates ?? []).map(c => ({ argv: c.argv, confidence: c.confidence })),
            }),
    }));
}

/** A previously resolved prompt, for autocomplete. */
export interface ResolvedHistoryEntry {
  prompt: string;
  argv: string[];
}

/**
 * Collect resolved prompts across the most recent sessions (newest first,
 * de-duplicated by argv) for autocomplete.
 *
 * @param store - The session store.
 * @param maxSessions - How many recent sessions to read.
 * @returns Resolved prompt/argv pairs.
 */
export function collectResolvedHistory(store: SessionStore, maxSessions = 20): ResolvedHistoryEntry[] {
  const seen = new Set<string>();
  const out: ResolvedHistoryEntry[] = [];
  for (const summary of store.list().slice(0, maxSessions)) {
    let session: AiSession;
    try {
      session = store.load(summary.id);
    } catch {
      continue;
    }
    for (const turn of [...session.turns].reverse()) {
      if (turn.kind !== 'resolved' || !turn.argv || turn.argv.length === 0) continue;
      const key = turn.argv.join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ prompt: turn.prompt, argv: turn.argv });
    }
  }
  return out;
}
