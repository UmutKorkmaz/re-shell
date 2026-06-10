/**
 * Optional LLM-backed resolver, behind an interface and OFF by default.
 *
 * The deterministic {@link resolveCommand} matcher is the only thing on the
 * default dashboard path — no network, no model. This module exists so a future
 * provider adapter can be plugged in WITHOUT widening the security surface:
 *
 *  - The adapter only ever proposes a command id; it can never produce argv or a
 *    new exec path.
 *  - Its proposal is filtered back to the supplied allow-list here ({@link
 *    applyLlmResolver}), so a misbehaving or hallucinating model can only ever
 *    select a command that already exists in the registry — or be rejected.
 *
 * Nothing in the dashboard constructs or calls a resolver by default, so the
 * offline guarantee holds regardless of this interface's existence.
 */

import type { AllowedCommand, ResolveCommandResult } from './resolve-command';

/**
 * A proposal from an LLM adapter: a candidate command id plus an optional
 * confidence. Intentionally minimal — no argv, no params builder, no free text
 * that could become a command.
 */
export interface LlmCommandProposal {
  readonly commandId: string;
  readonly confidence?: number;
}

/**
 * Pluggable contract for an LLM resolver. Receives the user query and the SAME
 * allow-list the deterministic resolver sees, and proposes at most one command
 * id (or null to abstain). May be async (a provider call) — but is never invoked
 * on the default path.
 */
export interface LlmResolver {
  readonly name: string;
  propose(
    query: string,
    allowed: readonly AllowedCommand[]
  ): Promise<LlmCommandProposal | null>;
}

/**
 * Apply an LLM resolver defensively. The adapter's proposed id MUST be present in
 * `allowed` to be honoured; anything else (a hallucinated id, an abstention)
 * collapses to a `no-match` so the UI refuses. The returned `commandId` is
 * therefore always one of the supplied allow-list ids — never fabricated.
 */
export async function applyLlmResolver(
  resolver: LlmResolver,
  query: string,
  allowed: readonly AllowedCommand[]
): Promise<ResolveCommandResult> {
  const allowedIds = new Set(allowed.map((c) => c.id));
  const proposal = await resolver.propose(query, allowed);

  if (proposal === null || !allowedIds.has(proposal.commandId)) {
    return { kind: 'no-match', reason: 'below-threshold' };
  }

  const confidence =
    typeof proposal.confidence === 'number'
      ? Math.min(1, Math.max(0, proposal.confidence))
      : 1;

  return {
    kind: 'match',
    commandId: proposal.commandId,
    confidence,
    matched: [],
  };
}
