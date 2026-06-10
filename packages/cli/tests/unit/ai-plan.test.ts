import { describe, expect, it } from 'vitest';
import {
  planScaffold,
  extractIntent,
  composePlan,
  buildBackendCorpus,
  buildFrontendCorpus,
  deriveProjectName,
  sanitizeProposedIntent,
  plannerFromEnv,
  type PlannerProvider,
} from '../../src/utils/ai-plan';
import { aiPlanResponseSchema, scaffoldPlanSchema } from '@re-shell/contracts';
import type { ScaffoldIntent } from '@re-shell/contracts';

const ACCEPTANCE =
  'a react shell + fastapi auth service + postgres, on k8s';

describe('corpora', () => {
  it('builds a frontend corpus of real framework ids', () => {
    const corpus = buildFrontendCorpus();
    expect(corpus.length).toBeGreaterThan(10);
    expect(corpus.every(d => d.type === 'template')).toBe(true);
    expect(corpus.some(d => d.id === 'react')).toBe(true);
  });

  it('builds a backend corpus of real template ids', () => {
    const corpus = buildBackendCorpus();
    expect(corpus.length).toBeGreaterThan(100);
    expect(corpus.some(d => d.id === 'fastapi')).toBe(true);
    expect(corpus.some(d => d.id === 'postgres-config')).toBe(true);
  });
});

describe('deriveProjectName', () => {
  it('produces a safe, lower-case, dash-joined slug', () => {
    expect(deriveProjectName(ACCEPTANCE)).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it('strips shell metacharacters (injection text never reaches a name)', () => {
    const name = deriveProjectName('foo; rm -rf / && echo $(whoami)');
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(name).not.toContain(';');
    expect(name).not.toContain('$');
  });

  it('falls back to a default when nothing safe can be derived', () => {
    expect(deriveProjectName('the a of with')).toBe('app');
  });
});

describe('extractIntent', () => {
  it('extracts frontend, backends, datastores, and infra for the acceptance prompt', () => {
    const intent = extractIntent(ACCEPTANCE);
    expect(intent.frontend?.id).toBe('react');
    expect(intent.backends.map(b => b.id)).toContain('fastapi');
    expect(intent.datastores.map(d => d.id)).toContain('postgres-config');
    expect(intent.infra.map(i => i.id)).toContain('k8s');
  });

  it('resolves every slot to a REAL template/framework id', () => {
    const intent = extractIntent(ACCEPTANCE);
    const frontendIds = new Set(buildFrontendCorpus().map(d => d.id));
    const backendIds = new Set(buildBackendCorpus().map(d => d.id));
    if (intent.frontend) expect(frontendIds.has(intent.frontend.id)).toBe(true);
    for (const b of intent.backends) expect(backendIds.has(b.id)).toBe(true);
    for (const d of intent.datastores) expect(backendIds.has(d.id)).toBe(true);
  });

  it('drops unknown mentions rather than fabricating ids', () => {
    const intent = extractIntent('a wibbleframework shell with frobnosticate db');
    expect(intent.frontend).toBeUndefined();
    expect(intent.backends).toEqual([]);
    expect(intent.datastores).toEqual([]);
  });

  it('is deterministic across repeated calls', () => {
    expect(extractIntent(ACCEPTANCE)).toEqual(extractIntent(ACCEPTANCE));
  });
});

describe('sample descriptions map to expected REAL ids/commands', () => {
  it('"react + express + postgres" resolves the shell, service, and datastore', () => {
    const { intent, plan } = planScaffold('a react shell + express api + postgres');
    expect(intent.frontend?.id).toBe('react');
    expect(intent.backends.map(b => b.id)).toContain('express');
    expect(intent.datastores.map(d => d.id)).toContain('postgres-config');

    const commands = plan.steps.map(s => s.command.join(' '));
    expect(commands).toContain('create react-shell-express --template react');
    expect(commands).toContain('generate backend express-service --framework express');
    expect(commands).toContain(
      'generate backend postgres-config --framework postgres-config'
    );
  });

  it('"svelte static site" resolves a single svelte create step', () => {
    const { intent, plan } = planScaffold('a svelte static site');
    expect(intent.frontend?.id).toBe('svelte');
    expect(intent.backends).toEqual([]);
    expect(intent.datastores).toEqual([]);
    expect(intent.infra).toEqual([]);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].command).toEqual(['create', 'svelte-static-site', '--template', 'svelte']);
  });

  it('"go grpc microservice on k8s" resolves a grpc backend + k8s generate, no frontend', () => {
    const { intent, plan } = planScaffold('a go grpc microservice on k8s');
    expect(intent.frontend).toBeUndefined();
    expect(intent.backends.map(b => b.id)).toContain('grpc-service');
    expect(intent.infra.map(i => i.id)).toContain('k8s');

    const commands = plan.steps.map(s => s.command.join(' '));
    expect(commands).toContain('generate backend grpc-service --framework grpc-service');
    expect(commands).toContain('k8s generate');
    // No shell-app create step when no frontend is named.
    expect(commands.some(c => c.startsWith('create '))).toBe(false);
  });
});

describe('composePlan', () => {
  it('composes only real commands/flags and references only real ids', () => {
    const { plan } = planScaffold(ACCEPTANCE);
    expect(plan.applied).toBe(false);
    expect(plan.steps.length).toBeGreaterThan(0);

    const allowedHeads = new Set(['create', 'generate', 'k8s']);
    for (const step of plan.steps) {
      expect(allowedHeads.has(step.command[0])).toBe(true);
      // Only catalogue flags appear (no fabricated flags).
      const flags = step.command.filter(t => t.startsWith('--'));
      for (const flag of flags) {
        expect(['--template', '--framework']).toContain(flag);
      }
    }
  });

  it('emits create/generate/k8s steps in order for the acceptance prompt', () => {
    const { plan } = planScaffold(ACCEPTANCE);
    // The shell-app create step always comes first when a frontend is resolved.
    expect(plan.steps[0].command[0]).toBe('create');
    const heads = plan.steps.map(s => s.command.slice(0, 2).join(' '));
    expect(heads).toContain('generate backend');
    expect(heads).toContain('k8s generate');
  });

  it('avoids a doubled -service-service suffix', () => {
    const { plan } = planScaffold('an express auth service');
    const names = plan.steps
      .filter(s => s.command[0] === 'generate')
      .map(s => s.command[2]);
    for (const n of names) expect(n).not.toMatch(/-service-service/);
  });

  it('produces a payload that validates against aiPlanResponseSchema', () => {
    const { intent, plan } = planScaffold(ACCEPTANCE);
    const parsed = aiPlanResponseSchema.safeParse({ intent, plan });
    expect(parsed.success).toBe(true);
  });

  it('produces a plan that validates against scaffoldPlanSchema', () => {
    const { plan } = planScaffold('a vue app with redis');
    expect(scaffoldPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('returns an empty plan for an unresolvable description', () => {
    const { plan } = planScaffold('the quick brown fox');
    expect(plan.steps).toEqual([]);
    expect(plan.resolved).toEqual([]);
  });
});

describe('sanitizeProposedIntent (defensive LLM hook)', () => {
  it('drops slots whose ids are not real registry ids', () => {
    const proposed: ScaffoldIntent = {
      description: 'react + fake',
      projectName: 'demo',
      frontend: { kind: 'frontend', term: 'fake', id: 'not-a-real-fw', title: 'x', score: 1, matched: [] },
      backends: [
        { kind: 'backend', term: 'fastapi', id: 'fastapi', title: 'FastAPI', score: 1, matched: [] },
        { kind: 'backend', term: 'evil', id: 'rm-rf-slash', title: 'x', score: 1, matched: [] },
      ],
      datastores: [
        { kind: 'datastore', term: 'pg', id: 'postgres-config', title: 'pg', score: 1, matched: [] },
        { kind: 'datastore', term: 'bad', id: 'fabricated-db', title: 'x', score: 1, matched: [] },
      ],
      infra: [
        { kind: 'infra', term: 'k8s', id: 'k8s', title: 'k8s', score: 1, matched: [] },
        { kind: 'infra', term: 'bad', id: 'made-up-infra', title: 'x', score: 1, matched: [] },
      ],
    };
    const safe = sanitizeProposedIntent(proposed);
    expect(safe.frontend).toBeUndefined();
    expect(safe.backends.map(b => b.id)).toEqual(['fastapi']);
    expect(safe.datastores.map(d => d.id)).toEqual(['postgres-config']);
    expect(safe.infra.map(i => i.id)).toEqual(['k8s']);
  });

  it('composes a plan from a sanitised proposal that references only real ids', () => {
    const proposed: ScaffoldIntent = {
      description: 'fastapi service',
      projectName: 'demo',
      backends: [
        { kind: 'backend', term: 'fastapi', id: 'fastapi', title: 'FastAPI', score: 1, matched: [] },
      ],
      datastores: [],
      infra: [],
    };
    const plan = composePlan(sanitizeProposedIntent(proposed));
    expect(plan.resolved).toEqual(['fastapi']);
  });

  it('filters a MOCKED PlannerProvider proposal down to only real ids', async () => {
    // A misbehaving provider that proposes a mix of real and fabricated ids,
    // exactly the threat model the sanitiser exists for.
    const mockProvider: PlannerProvider = {
      name: 'mock-llm',
      async propose(description: string): Promise<ScaffoldIntent> {
        return {
          description,
          projectName: 'demo',
          frontend: {
            kind: 'frontend',
            term: 'react',
            id: 'react',
            title: 'React',
            score: 1,
            matched: [],
          },
          backends: [
            { kind: 'backend', term: 'fastapi', id: 'fastapi', title: 'FastAPI', score: 1, matched: [] },
            { kind: 'backend', term: 'evil', id: 'totally-made-up-backend', title: 'x', score: 1, matched: [] },
          ],
          datastores: [
            { kind: 'datastore', term: 'pg', id: 'postgres-config', title: 'pg', score: 1, matched: [] },
          ],
          infra: [
            { kind: 'infra', term: 'k8s', id: 'k8s', title: 'k8s', score: 1, matched: [] },
            { kind: 'infra', term: 'bad', id: 'fabricated-infra', title: 'x', score: 1, matched: [] },
          ],
        };
      },
    };

    const proposed = await mockProvider.propose('react + fastapi + postgres on k8s');
    const safe = sanitizeProposedIntent(proposed);
    const plan = composePlan(safe);

    // The fabricated backend + infra ids are dropped; only real ids survive.
    expect(safe.frontend?.id).toBe('react');
    expect(safe.backends.map(b => b.id)).toEqual(['fastapi']);
    expect(safe.datastores.map(d => d.id)).toEqual(['postgres-config']);
    expect(safe.infra.map(i => i.id)).toEqual(['k8s']);

    // The composed plan therefore references only real ids, and validates.
    const frontendIds = new Set(buildFrontendCorpus().map(d => d.id));
    const backendIds = new Set(buildBackendCorpus().map(d => d.id));
    for (const step of plan.steps) {
      if (step.template) {
        expect(frontendIds.has(step.template) || backendIds.has(step.template)).toBe(true);
      }
    }
    expect(aiPlanResponseSchema.safeParse({ intent: safe, plan }).success).toBe(true);
    expect(plan.resolved).not.toContain('totally-made-up-backend');
    expect(plan.resolved).not.toContain('fabricated-infra');
  });
});

describe('offline guarantee', () => {
  it('does not construct a planner provider on the default path', () => {
    expect(plannerFromEnv()).toBeUndefined();
  });
});
