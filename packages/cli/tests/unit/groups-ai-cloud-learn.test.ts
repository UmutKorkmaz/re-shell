import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { EventEmitter } from 'events';

// Covers the last-but-two slice of src/groups/*.group.ts:
//  - ai.group.ts (422 lines) — `ai <prompt>` offline intent resolver +
//    `ai create` dry-run-by-default scaffold planner. Prompt text is DATA:
//    execution only happens via the vetted argv spawned WITHOUT a shell after
//    an explicit confirmation.
//  - cloud.group.ts (1291 lines) — 13 cloud generators (aws/azure/gcp/multi/
//    db/serverless/storage/iac/dr/cost/hybrid/resources/network).
//  - learn.group.ts (1634 lines) — 6 learning generators that pipe the config
//    through a transform factory (interactiveTutorials(config) etc.) before
//    displayConfig/writeFiles, so their mocks return the argument (identity).
//
// Per-generator utils are mocked via their dynamic-import specifiers so each
// test asserts provider resolution, option coercion (int parsing, comma
// splits), config forwarding to writeFiles, output/language passthrough, and
// the success rendering.

// --- ai.group collaborators (statically imported by the group) -----------
vi.mock('../../src/utils/ai-intent', () => ({
  createOfflineBackend: vi.fn(),
  explainCandidate: vi.fn(),
}));
vi.mock('../../src/utils/ai-plan', () => ({
  planScaffold: vi.fn(),
  sanitizeProposedIntent: vi.fn(),
  composePlan: vi.fn(),
  plannerFromEnv: vi.fn(),
}));
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(function (this: any) { return this; }),
    stop: vi.fn(function (this: any) { return this; }),
    setText: vi.fn(function (this: any) { return this; }),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
  flushOutput: vi.fn(),
}));
vi.mock('prompts', () => ({ default: vi.fn() }));
vi.mock('child_process', () => ({ spawn: vi.fn() }));

// --- cloud.group generators (dynamic imports, source specifiers mirrored) -
vi.mock('../../src/utils/aws-cloud', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/azure-cloud', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/gcp-cloud', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/multicloud-deployment', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/cloud-database', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/serverless-functions', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/cloud-storage', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/infrastructure-as-code', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/disaster-recovery', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/cost-optimization', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/hybrid-cloud.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/resource-lifecycle.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/multi-cloud-networking.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));

// --- learn.group generators (transform-style: factory returns its input) --
vi.mock('../../src/utils/interactive-tutorials.js', () => ({
  interactiveTutorials: vi.fn((c: unknown) => c),
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/skill-assessment-tracking.js', () => ({
  skillAssessment: vi.fn((c: unknown) => c),
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/mentorship-matching.js', () => ({
  mentorship: vi.fn((c: unknown) => c),
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/code-quality-coaching.js', () => ({
  codeQualityCoaching: vi.fn((c: unknown) => c),
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/best-practices-sharing.js', () => ({
  bestPractices: vi.fn((c: unknown) => c),
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/technical-documentation.js', () => ({
  technicalDocumentation: vi.fn((c: unknown) => c),
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));

const { registerAiGroup } = await import('../../src/groups/ai.group');
const { registerCloudGroup } = await import('../../src/groups/cloud.group');
const { registerLearnGroup } = await import('../../src/groups/learn.group');

const aiIntent = await import('../../src/utils/ai-intent');
const aiPlan = await import('../../src/utils/ai-plan');
const prompts = (await import('prompts')).default;
const { spawn } = await import('child_process');

const awsCloud = await import('../../src/utils/aws-cloud');
const azureCloud = await import('../../src/utils/azure-cloud');
const gcpCloud = await import('../../src/utils/gcp-cloud');
const multicloud = await import('../../src/utils/multicloud-deployment');
const cloudDb = await import('../../src/utils/cloud-database');
const serverless = await import('../../src/utils/serverless-functions');
const cloudStorage = await import('../../src/utils/cloud-storage');
const iac = await import('../../src/utils/infrastructure-as-code');
const disaster = await import('../../src/utils/disaster-recovery');
const costOpt = await import('../../src/utils/cost-optimization');
const hybrid = await import('../../src/utils/hybrid-cloud.js');
const lifecycle = await import('../../src/utils/resource-lifecycle.js');
const networking = await import('../../src/utils/multi-cloud-networking.js');

const tutorials = await import('../../src/utils/interactive-tutorials.js');
const skillAssess = await import('../../src/utils/skill-assessment-tracking.js');
const mentorshipMatching = await import('../../src/utils/mentorship-matching.js');
const coaching = await import('../../src/utils/code-quality-coaching.js');
const bestPractices = await import('../../src/utils/best-practices-sharing.js');
const techDocs = await import('../../src/utils/technical-documentation.js');

/** A catalogue-shaped candidate for the offline intent parser mock. */
function candidate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    path: 'templates list',
    description: 'List workspace templates',
    argv: ['templates', 'list'],
    confidence: 0.72,
    destructive: false,
    supportsJson: true,
    supportsDryRun: false,
    ...overrides,
  };
}

/** Resolve all writeFiles mocks (each action awaits them). */
function resolveWrites() {
  for (const mod of [
    awsCloud, azureCloud, gcpCloud, multicloud, cloudDb, serverless,
    cloudStorage, iac, disaster, costOpt, hybrid, lifecycle, networking,
    tutorials, skillAssess, mentorshipMatching, coaching, bestPractices,
    techDocs,
  ]) {
    vi.mocked(mod.writeFiles).mockResolvedValue(undefined);
  }
}

describe('groups — ai / cloud / learn registration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBefore: string | number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resolveWrites();
    exitCodeBefore = process.exitCode;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((() => true) as never);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
    process.exitCode = exitCodeBefore;
    vi.restoreAllMocks();
  });

  function output(): string {
    return logSpy.mock.calls.map(call => call.join(' ')).join('\n');
  }

  /**
   * The single JSON envelope emitted on stdout under --json. Only bytes that
   * pass the emit gate (ok/fail envelopes) reach the spied write, so the last
   * parseable chunk is the envelope.
   */
  function jsonPayload(): any {
    const chunks = stdoutSpy.mock.calls
      .map(call => String(call[0]))
      .filter(chunk => chunk.trim().startsWith('{'));
    expect(chunks.length).toBeGreaterThan(0);
    return JSON.parse(chunks[chunks.length - 1]);
  }

  /**
   * Fake child for spawn(): emits `close` with the given code on a microtask,
   * after the caller has attached its listeners.
   */
  function spawnExitCodes(codes: number[]): void {
    vi.mocked(spawn).mockImplementation((() => {
      const child = new EventEmitter();
      const code = codes.length > 0 ? codes.shift() : 0;
      queueMicrotask(() => child.emit('close', code));
      return child;
    }) as never);
  }

  function spawnErrors(): void {
    vi.mocked(spawn).mockImplementation((() => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('error', new Error('spawn ENOENT')));
      return child;
    }) as never);
  }

  /** Program with one group registered (groups are independent registrars). */
  function programWith(register: (p: Command) => void): Command {
    const program = new Command();
    program.exitOverride();
    register(program);
    return program;
  }

  // ========================================================================
  // ai.group.ts
  // ========================================================================
  describe('ai group', () => {
    function backendWith(parseResult: unknown, entry: unknown = undefined) {
      const backend = {
        parse:
          parseResult instanceof Error
            ? vi.fn(() => { throw parseResult; })
            : vi.fn().mockReturnValue(parseResult),
        entryFor: vi.fn().mockReturnValue(entry),
      };
      vi.mocked(aiIntent.createOfflineBackend).mockReturnValue(backend as never);
      return backend;
    }

    it('registers `ai` with the `create` subcommand', () => {
      const program = programWith(registerAiGroup);
      const ai = program.commands.find(c => c.name() === 'ai');
      expect(ai).toBeDefined();
      expect(ai?.description()).toContain('offline, never auto-runs');
      expect(ai?.commands.map(c => c.name())).toEqual(['create']);
    });

    it('joins multi-word prompts and resolves to the vetted command (dry, never runs)', async () => {
      const backend = backendWith({
        needsClarification: false,
        candidate: candidate(),
        alternatives: [],
        explanation: 'Lists templates',
      });
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'show', 'me', 'templates']);

      expect(backend.parse).toHaveBeenCalledWith('show me templates');
      expect(output()).toContain('🧠 Resolved command');
      expect(output()).toContain('re-shell templates list');
      expect(output()).toContain('72%');
      expect(output()).toContain('List workspace templates');
      expect(output()).toContain('Not executed. Re-run with');
      expect(spawn).not.toHaveBeenCalled();
    });

    it('lists ranked alternatives with a destructive badge', async () => {
      backendWith({
        needsClarification: false,
        candidate: candidate(),
        alternatives: [
          candidate({ argv: ['workspace', 'remove', 'old'], path: 'workspace remove', destructive: true, confidence: 0.4 }),
        ],
        explanation: '',
      });
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'remove a workspace']);

      expect(output()).toContain('Alternatives:');
      expect(output()).toContain('re-shell workspace remove old');
      expect(output()).toContain('[destructive]');
      expect(output()).toContain('40%');
    });

    it('explains via the catalogue entry with --explain', async () => {
      const entry = { name: 'templates list' };
      vi.mocked(aiIntent.explainCandidate).mockReturnValue(
        'Lists every template in the registry with metadata'
      );
      const backend = backendWith(
        { needsClarification: false, candidate: candidate(), alternatives: [], explanation: 'fallback' },
        entry
      );
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'list templates', '--explain']);

      expect(backend.entryFor).toHaveBeenCalledWith('templates list');
      expect(aiIntent.explainCandidate).toHaveBeenCalledWith(expect.anything(), entry);
      expect(output()).toContain('Explanation:');
      expect(output()).toContain('Lists every template in the registry');
    });

    it('falls back to the parser explanation when the catalogue entry is missing', async () => {
      vi.mocked(aiIntent.explainCandidate).mockReturnValue('never called');
      backendWith(
        { needsClarification: false, candidate: candidate(), alternatives: [], explanation: 'parser-side explanation' },
        undefined
      );
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'list templates', '--explain']);

      expect(aiIntent.explainCandidate).not.toHaveBeenCalled();
      expect(output()).toContain('parser-side explanation');
    });

    it('asks for clarification instead of guessing (never executes)', async () => {
      backendWith({
        needsClarification: true,
        reason: 'ambiguous',
        question: 'Did you mean list or apply?',
        candidates: [candidate(), candidate({ argv: ['templates', 'apply'], path: 'templates apply' })],
      });
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'templates', '--run']);

      expect(output()).toContain('🤔 Need clarification');
      expect(output()).toContain('Did you mean list or apply?');
      expect(output()).toContain('re-shell templates apply');
      // Clarification must never execute, even with --run.
      expect(spawn).not.toHaveBeenCalled();
    });

    it('emits the resolved JSON envelope with executed: false', async () => {
      backendWith({
        needsClarification: false,
        candidate: candidate({ confidence: 0.9 }),
        alternatives: [],
        explanation: 'Lists templates',
      });
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'list templates', '--json']);

      const payload = jsonPayload();
      expect(payload.ok).toBe(true);
      expect(payload.data.needsClarification).toBe(false);
      expect(payload.data.resolved.argv).toEqual(['templates', 'list']);
      expect(payload.data.confidence).toBe(0.9);
      expect(payload.data.executed).toBe(false);
      expect(payload.data.explanation).toBeUndefined();
    });

    it('includes the explanation in --json --explain', async () => {
      vi.mocked(aiIntent.explainCandidate).mockReturnValue('entry-based explanation');
      backendWith(
        { needsClarification: false, candidate: candidate(), alternatives: [], explanation: 'fallback' },
        { name: 'templates list' }
      );
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'list templates', '--json', '--explain']);

      expect(jsonPayload().data.explanation).toBe('entry-based explanation');
    });

    it('emits a clarification envelope in --json', async () => {
      backendWith({
        needsClarification: true,
        reason: 'ambiguous',
        question: 'Which one?',
        candidates: [candidate()],
      });
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'templates', '--json']);

      const payload = jsonPayload();
      expect(payload.data.needsClarification).toBe(true);
      expect(payload.data.question).toBe('Which one?');
      expect(payload.data.candidates).toHaveLength(1);
    });

    it('wraps parser failures in AI_INTENT_ERROR and exits 1', async () => {
      backendWith(new Error('parser exploded'));
      const program = programWith(registerAiGroup);
      await program.parseAsync(['node', 're-shell', 'ai', 'gibberish', '--json']);

      const payload = jsonPayload();
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe('AI_INTENT_ERROR');
      expect(payload.error.message).toContain('parser exploded');
      expect(process.exitCode).toBe(1);
    });

    describe('--run confirmation flow', () => {
      it('aborts without spawning when the confirmation is declined', async () => {
        backendWith({
          needsClarification: false,
          candidate: candidate(),
          alternatives: [],
          explanation: '',
        });
        vi.mocked(prompts).mockResolvedValue({ confirmed: false } as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'list templates', '--run']);

        expect(prompts).toHaveBeenCalled();
        expect(output()).toContain('Aborted. Nothing was executed.');
        expect(spawn).not.toHaveBeenCalled();
      });

      it('spawns the vetted argv without a shell after confirmation', async () => {
        backendWith({
          needsClarification: false,
          candidate: candidate({ argv: ['templates', 'list', '--json'] }),
          alternatives: [],
          explanation: '',
        });
        vi.mocked(prompts).mockResolvedValue({ confirmed: true } as never);
        spawnExitCodes([0]);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'list templates', '--run']);

        expect(spawn).toHaveBeenCalledWith(
          're-shell',
          ['templates', 'list', '--json'],
          expect.objectContaining({ shell: false })
        );
      });

      it('warns before confirming a destructive candidate', async () => {
        backendWith({
          needsClarification: false,
          candidate: candidate({ argv: ['workspace', 'remove', 'old'], destructive: true }),
          alternatives: [],
          explanation: '',
        });
        vi.mocked(prompts).mockResolvedValue({ confirmed: false } as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'nuke it', '--run']);

        expect(output()).toContain('destructive');
        expect(spawn).not.toHaveBeenCalled();
      });

      it('surfaces spawn failures on stderr and exits 1', async () => {
        backendWith({
          needsClarification: false,
          candidate: candidate(),
          alternatives: [],
          explanation: '',
        });
        vi.mocked(prompts).mockResolvedValue({ confirmed: true } as never);
        spawnErrors();
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'list templates', '--run']);

        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to execute'));
        expect(process.exitCode).toBe(1);
      });
    });

    describe('ai create', () => {
      function planWith(steps: any[], resolved: string[] = ['react-ts-project']) {
        return {
          intent: { description: 'a project', projectName: 'a-project' },
          plan: { resolved, steps, applied: false },
        };
      }

      it('prints a dry-run plan and writes nothing by default', async () => {
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(null);
        vi.mocked(aiPlan.planScaffold).mockResolvedValue(planWith([
          { command: ['create', 'web'], description: 'Scaffold the web app', why: 'react' },
        ]) as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'react app with api']);

        expect(aiPlan.planScaffold).toHaveBeenCalledWith('react app with api');
        expect(output()).toContain('🧩 Scaffold plan (dry-run)');
        expect(output()).toContain('re-shell create web');
        expect(output()).toContain('Nothing was written. Re-run with');
        expect(spawn).not.toHaveBeenCalled();
      });

      it('hints at vocabulary when nothing resolves', async () => {
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(null);
        vi.mocked(aiPlan.planScaffold).mockResolvedValue(planWith([]) as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'a thing']);

        expect(output()).toContain('🤔 Nothing to plan');
        expect(output()).toContain('Try naming a frontend framework');
        expect(spawn).not.toHaveBeenCalled();
      });

      // REGRESSION NOTE (pinned): the parent `ai` command declares `--json`,
      // and commander@11.1.0 swallows the child `create --json` at the parent
      // level — the child action receives options.json = undefined and renders
      // HUMAN output. Same bug class as `catalog sync --json` (groups-small
      // suite). The ok()/fail() JSON branches of `ai create` are therefore
      // unreachable from the CLI today; these tests pin that behaviour so a
      // commander upgrade that fixes it shows up as a diff.
      it('BUG (pinned): `ai create --json` falls through to the human render', async () => {
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(null);
        vi.mocked(aiPlan.planScaffold).mockResolvedValue(planWith([
          { command: ['init'], description: 'init', why: '' },
        ]) as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'x', '--json']);

        expect(stdoutSpy.mock.calls.filter(c => String(c[0]).trim().startsWith('{'))).toHaveLength(0);
        expect(output()).toContain('🧩 Scaffold plan (dry-run)');
      });

      it('BUG (pinned): `ai create --json` renders the human nothing-to-plan notice', async () => {
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(null);
        vi.mocked(aiPlan.planScaffold).mockResolvedValue(planWith([]) as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'x', '--json']);

        expect(stdoutSpy.mock.calls.filter(c => String(c[0]).trim().startsWith('{'))).toHaveLength(0);
        expect(output()).toContain('🤔 Nothing to plan');
      });

      it('executes the steps in order with --yes and marks them applied', async () => {
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(null);
        vi.mocked(aiPlan.planScaffold).mockResolvedValue(planWith([
          { command: ['create', 'web'], description: 'web', why: '' },
          { command: ['workspace', 'init'], description: 'init', why: '' },
        ]) as never);
        spawnExitCodes([0, 0]);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'x', '--yes']);

        expect(spawn).toHaveBeenCalledTimes(2);
        expect(output()).toContain('✅ Executed scaffold plan');
        expect(output()).toContain('✓ re-shell create web');
      });

      it('stops the pipeline on the first failing step and exits 1', async () => {
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(null);
        vi.mocked(aiPlan.planScaffold).mockResolvedValue(planWith([
          { command: ['create', 'web'], description: 'web', why: '' },
          { command: ['workspace', 'init'], description: 'init', why: '' },
        ]) as never);
        spawnExitCodes([1]);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'x', '--yes']);

        // First failure aborts: the second step never spawns and stays un-applied.
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(process.exitCode).toBe(1);
        expect(output()).toContain('re-shell workspace init');
        expect(output()).not.toContain('✓ re-shell workspace init');
      });

      it('sanitises a configured planner back to real ids', async () => {
        const provider = { propose: vi.fn().mockResolvedValue({ description: 'proposed', components: [] }) };
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(provider as never);
        vi.mocked(aiPlan.sanitizeProposedIntent).mockReturnValue({ description: 'sanitised' } as never);
        vi.mocked(aiPlan.composePlan).mockReturnValue({
          resolved: ['react-ts-project'],
          steps: [{ command: ['create', 'web'], description: 'web' }],
          applied: false,
        } as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'blog']);

        expect(provider.propose).toHaveBeenCalledWith('blog');
        expect(aiPlan.sanitizeProposedIntent).toHaveBeenCalledWith({ description: 'proposed', components: [] });
        expect(aiPlan.composePlan).toHaveBeenCalledWith({ description: 'sanitised' });
        expect(output()).toContain('re-shell create web');
        expect(aiPlan.planScaffold).not.toHaveBeenCalled();
      });

      it('falls back to the offline planner when the provider throws', async () => {
        const provider = { propose: vi.fn().mockRejectedValue(new Error('LLM down')) };
        vi.mocked(aiPlan.plannerFromEnv).mockReturnValue(provider as never);
        vi.mocked(aiPlan.planScaffold).mockResolvedValue(planWith([
          { command: ['init'], description: 'init' },
        ]) as never);
        const program = programWith(registerAiGroup);
        await program.parseAsync(['node', 're-shell', 'ai', 'create', 'blog']);

        expect(aiPlan.sanitizeProposedIntent).not.toHaveBeenCalled();
        expect(aiPlan.planScaffold).toHaveBeenCalledWith('blog');
        expect(output()).toContain('re-shell init');
      });
    });
  });

  // ========================================================================
  // cloud.group.ts
  // ========================================================================
  describe('cloud group', () => {
    it('registers all 13 cloud generators', () => {
      const program = programWith(registerCloudGroup);
      const cloud = program.commands.find(c => c.name() === 'cloud');
      expect(cloud?.commands.map(c => c.name())).toEqual([
        'aws', 'azure', 'gcp', 'multi', 'db', 'serverless', 'storage',
        'iac', 'dr', 'cost', 'hybrid', 'resources', 'network',
      ]);
    });

    it('aws coerces scaling ints and forwards the ECS/EKS config', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'aws', 'shop',
        '--region', 'eu-west-1', '--min-capacity', '2', '--max-capacity', '6',
        '--target-cpu', '55', '--target-memory', '65', '--enable-spot',
        '--output', '/tmp/aws-out', '--language', 'python',
      ]);
      const config = vi.mocked(awsCloud.displayConfig).mock.calls[0][0] as any;
      expect(config.projectName).toBe('shop');
      expect(config.eksConfig.clusterName).toBe('shop-eks-cluster');
      expect(config.ecsConfig.desiredCount).toBe(2);
      expect(config.autoScaling).toMatchObject({ minCapacity: 2, maxCapacity: 6, targetCPU: 55, targetMemory: 65 });
      expect(config.costOptimization.enableSpotInstances).toBe(true);
      expect(config.costOptimization.spotInstancePercentage).toBe(50);
      expect(awsCloud.writeFiles).toHaveBeenCalledWith(config, '/tmp/aws-out', 'python');
      expect(output()).toContain('aws-cloud-stack.py');
    });

    it('aws keeps monitoring on by default and disables it with --no-monitoring', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync(['node', 're-shell', 'cloud', 'aws', 'shop']);
      expect((vi.mocked(awsCloud.displayConfig).mock.calls[0][0] as any).enableMonitoring).toBe(true);

      // Fresh program: commander keeps option values across parseAsync calls on
      // the same instance, so a second invocation must re-register.
      vi.clearAllMocks();
      resolveWrites();
      await programWith(registerCloudGroup).parseAsync([
        'node', 're-shell', 'cloud', 'aws', 'shop', '--no-monitoring',
      ]);
      expect((vi.mocked(awsCloud.displayConfig).mock.calls[0][0] as any).enableMonitoring).toBe(false);
    });

    it('azure derives resource group and cluster names and reads the subscription from env', async () => {
      process.env.AZURE_SUBSCRIPTION_ID = 'sub-123';
      try {
        const program = programWith(registerCloudGroup);
        await program.parseAsync([
          'node', 're-shell', 'cloud', 'azure', 'shop',
          '--node-count', '5', '--enable-autoscale', '--min-count', '2', '--max-count', '9',
        ]);
        const config = vi.mocked(azureCloud.displayConfig).mock.calls[0][0] as any;
        expect(config.aksConfig.clusterName).toBe('shop-aks');
        expect(config.aksConfig.resourceGroupName).toBe('shop-rg');
        expect(config.subscriptionId).toBe('sub-123');
        expect(config.aksConfig.nodeCount).toBe(5);
        expect(config.aksConfig.enableAutoScaling).toBe(true);
        expect(config.aksConfig.minCount).toBe(2);
        expect(config.aksConfig.maxCount).toBe(9);
        expect(config.enableACR).toBe(true);
        expect(azureCloud.writeFiles).toHaveBeenCalledWith(config, '/tmp/azure-cloud', 'typescript');
        expect(output()).toContain('main.bicep');
      } finally {
        delete process.env.AZURE_SUBSCRIPTION_ID;
      }
    });

    it('gcp reads the project id from env and maps the ML toggles', async () => {
      process.env.GCP_PROJECT_ID = 'proj-9';
      try {
        const program = programWith(registerCloudGroup);
        await program.parseAsync([
          'node', 're-shell', 'cloud', 'gcp', 'shop',
          '--machine-type', 'n1-standard-2', '--enable-vertex-ai', '--enable-tpu',
          '--enable-autopilot', '--node-count', '4',
        ]);
        const config = vi.mocked(gcpCloud.displayConfig).mock.calls[0][0] as any;
        expect(config.projectId).toBe('proj-9');
        expect(config.gkeConfig.clusterName).toBe('shop-gke');
        expect(config.gkeConfig.machineType).toBe('n1-standard-2');
        expect(config.gkeConfig.nodeCount).toBe(4);
        expect(config.gkeConfig.enableAutopilot).toBe(true);
        expect(config.mlConfig).toMatchObject({ enableVertexAI: true, enableTPU: true, enableMLOps: true });
        expect(gcpCloud.writeFiles).toHaveBeenCalledWith(config, '/tmp/gcp-cloud', 'typescript');
        expect(output()).toContain('cluster.jinja');
      } finally {
        delete process.env.GCP_PROJECT_ID;
      }
    });

    it('multi defaults to all providers with typed credentials and strategy', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'multi', 'shop',
        '--strategy', 'blue-green', '--failover', '--health-check',
      ]);
      const config = vi.mocked(multicloud.displayConfig).mock.calls[0][0] as any;
      expect(config.providers.map((p: any) => p.name)).toEqual(['aws', 'azure', 'gcp']);
      expect(config.providers[0]).toMatchObject({ priority: 1, region: 'us-east-1' });
      expect(config.providers[1].credentials.envVar).toBe('AZURE_CLIENT_ID');
      expect(config.providers[2].credentials.envVar).toBe('GOOGLE_APPLICATION_CREDENTIALS');
      expect(config.deploymentStrategy.type).toBe('blue-green');
      expect(config.deploymentStrategy.failover).toBe(true);
      expect(config.deploymentStrategy.healthCheck.enabled).toBe(true);
      expect(multicloud.writeFiles).toHaveBeenCalledWith(config, '/tmp/multicloud-deployment', 'typescript');
      expect(output()).toContain('multicloud-manager.ts');
    });

    it('db builds the provider sections and derives DR semantics', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'db', 'shopdb',
        '--multi-az', '--enable-dr',
      ]);
      const config = vi.mocked(cloudDb.displayConfig).mock.calls[0][0] as any;
      // NOTE: --enable-* default-true flags are not negatable in commander, so
      // all three providers are always on from the CLI.
      expect(config.providers).toEqual(['aws', 'azure', 'gcp']);
      expect(config.aws.multiAZ).toBe(true);
      expect(config.gcp.availabilityType).toBe('REGIONAL');
      expect(config.disasterRecovery.enabled).toBe(true);
      expect(config.disasterRecovery.failoverStrategy).toBe('automatic');

      vi.clearAllMocks();
      resolveWrites();
      await programWith(registerCloudGroup).parseAsync(['node', 're-shell', 'cloud', 'db', 'shopdb']);
      const zonal = vi.mocked(cloudDb.displayConfig).mock.calls[0][0] as any;
      expect(zonal.gcp.availabilityType).toBe('ZONAL');
      expect(zonal.disasterRecovery.failoverStrategy).toBe('manual');
      expect(output()).toContain('database.tf');
    });

    it('serverless defaults to an HTTP trigger and stacks explicit triggers', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'serverless', 'fn',
        '--memory', '512', '--timeout', '10', '--trigger-scheduled', 'cron(0 * * * ? *)',
        '--arm64', '--provisioned', '3',
      ]);
      const config = vi.mocked(serverless.displayConfig).mock.calls[0][0] as any;
      // Explicit triggers replace the default: only the scheduled one is set.
      expect(config.triggers).toEqual([
        { type: 'scheduled', scheduleExpression: 'cron(0 * * * ? *)' },
      ]);
      expect(config.aws.memorySize).toBe(512);
      expect(config.aws.timeout).toBe(10);
      expect(config.aws.architecture).toBe('arm64');
      expect(config.aws.provisionedConcurrency).toBe(3);
      expect(config.gcp.timeout).toBe('10s');
      expect(serverless.writeFiles).toHaveBeenCalledWith(config, '/tmp/serverless', 'typescript');
    });

    it('serverless maps the runtime to the azure worker runtime and defaults the trigger', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync(['node', 're-shell', 'cloud', 'serverless', 'fn', '--runtime', 'python3.11']);
      const config = vi.mocked(serverless.displayConfig).mock.calls[0][0] as any;
      expect(config.azure.runtime).toBe('python');
      expect(config.gcp.memoryMB).toBe(256);
      // No explicit trigger flags → the HTTP default kicks in.
      expect(config.triggers).toEqual([
        { type: 'http', httpPath: '/api', httpMethod: 'POST' },
      ]);
    });

    it('storage parses compliance standards and sanitises the azure account name', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'storage', 'shop-data',
        '--compliance', 'GDPR, HIPAA ,SOC2', '--enable-audit', '--enable-pipeline',
      ]);
      const config = vi.mocked(cloudStorage.displayConfig).mock.calls[0][0] as any;
      expect(config.governance.compliance.standards).toEqual(['GDPR', 'HIPAA', 'SOC2']);
      expect(config.azure.accountName).toBe('shopdatastorage');
      expect(config.aws.logging.enabled).toBe(true);
      expect(config.aws.replication.enabled).toBe(false);
      expect(config.dataPipeline.enabled).toBe(true);
      expect(cloudStorage.writeFiles).toHaveBeenCalledWith(config, '/tmp/cloud-storage', 'typescript');
      expect(output()).toContain('storage.tf');
    });

    it('iac builds the terraform backend per --backend and the pulumi branch', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'iac', 'infra', '--backend', 'gcs',
        '--state-encryption', '--enable-drift-detection',
      ]);
      const config = vi.mocked(iac.displayConfig).mock.calls[0][0] as any;
      expect(config.terraform.backend.type).toBe('gcs');
      expect(config.terraform.backend.config.bucket).toBe('infra-terraform-state');
      expect(config.pulumi).toBeUndefined();
      expect(config.stateManagement.encryption).toBe(true);
      expect(config.enableDriftDetection).toBe(true);

      vi.clearAllMocks();
      resolveWrites();
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'iac', 'infra', '--provider', 'pulumi', '--language', 'python',
      ]);
      const pulumi = vi.mocked(iac.displayConfig).mock.calls[0][0] as any;
      expect(pulumi.terraform).toBeUndefined();
      expect(pulumi.pulumi.runtime).toBe('python');
      expect(output()).toContain('PulumiProgram.py');
    });

    it('dr parses rto/rpo ints and forwards failover + testing toggles', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'dr', 'shopdr',
        '--strategy', 'pilot-light', '--rto', '60', '--rpo', '5',
        '--enable-testing', '--enable-dns-failover', '--enable-backup',
      ]);
      const config = vi.mocked(disaster.displayConfig).mock.calls[0][0] as any;
      expect(config.rto).toBe(60);
      expect(config.rpo).toBe(5);
      expect(config.failover.strategy).toBe('pilot-light');
      expect(config.failover.dnsFailover).toBe(true);
      expect(config.testing.enabled).toBe(true);
      expect(config.backup.enabled).toBe(true);
      expect(disaster.writeFiles).toHaveBeenCalledWith(config, '/tmp/disaster-recovery', 'typescript');
      expect(output()).toContain('dr.tf');
    });

    it('cost parses budgets and forwards the optimisation toggles', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'cost', 'shopcost',
        '--monthly-budget', '2500', '--daily-budget', '80',
        '--enable-spot', '--enable-anomaly',
      ]);
      const config = vi.mocked(costOpt.displayConfig).mock.calls[0][0] as any;
      expect(config.budgets.monthly).toBe(2500);
      expect(config.budgets.daily).toBe(80);
      expect(config.budgets.alerts).toHaveLength(2);
      expect(config.optimizations.enableSpotInstances).toBe(true);
      expect(config.anomalyDetection.enabled).toBe(true);
      expect(costOpt.writeFiles).toHaveBeenCalledWith(config, '/tmp/cost-optimization', 'typescript');
    });

    it('hybrid splits comma lists and coerces the numeric options', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'hybrid', 'hy',
        '--primary-cloud', 'gcp', '--secondary-clouds', ' AWS , azure ',
        '--enable-edge', '--edge-locations', 'iot,fog', '--device-count', '250',
        '--bandwidth', '5000', '--sync-mode', 'event-driven' as never,
        '--conflict-resolution', 'last-write-wins',
      ]);
      const config = vi.mocked(hybrid.displayConfig).mock.calls[0][0] as any;
      expect(config.primaryCloud).toBe('gcp');
      expect(config.secondaryClouds).toEqual(['aws', 'azure']);
      expect(config.edgeCompute.enabled).toBe(true);
      expect(config.edgeCompute.locations).toEqual(['iot', 'fog']);
      expect(config.edgeCompute.deviceCount).toBe(250);
      expect(config.connectivity.bandwidthMbps).toBe(5000);
      expect(config.dataSync.conflictResolution).toBe('last-write-wins');
      expect(hybrid.writeFiles).toHaveBeenCalledWith(config, './hybrid-cloud', 'typescript');
      expect(output()).toContain('hybrid-cloud.tf');
    });

    it('resources builds the tag policy from the tag options', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'resources', 'shopres',
        '--tag-environment', 'staging', '--tag-owner', 'platform',
        '--tag-cost-center', 'infra', '--retention-days', '30',
        '--auto-remediate', '--slack-webhook', 'https://hooks',
      ]);
      const config = vi.mocked(lifecycle.displayConfig).mock.calls[0][0] as any;
      expect(config.providers).toEqual(['aws', 'azure', 'gcp']);
      const tags = Object.fromEntries(
        config.tagPolicy.requiredTags.map((t: any) => [t.key, t.value])
      );
      expect(tags).toMatchObject({
        Environment: 'staging',
        Owner: 'platform',
        CostCenter: 'infra',
        Project: 'shopres',
      });
      expect(config.tagPolicy.autoRemediation).toBe(true);
      expect(config.lifecycleRules[0].retentionPeriodDays).toBe(30);
      expect(config.notifications.endpoints).toEqual(['https://hooks']);
      expect(lifecycle.writeFiles).toHaveBeenCalledWith(config, './resource-lifecycle', 'typescript');
    });

    it('network derives one endpoint per provider and the connection types', async () => {
      const program = programWith(registerCloudGroup);
      await program.parseAsync([
        'node', 're-shell', 'cloud', 'network', 'shopnet',
        '--routing-strategy', 'geo-based',
        '--load-balancer', 'least-connections', '--enable-cdn',
      ]);
      const config = vi.mocked(networking.displayConfig).mock.calls[0][0] as any;
      // Default-true --enable-* flags are not negatable → all three providers.
      expect(config.providers).toEqual(['aws', 'azure', 'gcp']);
      expect(config.endpoints.map((e: any) => e.id)).toEqual([
        'shopnet-aws', 'shopnet-azure', 'shopnet-gcp',
      ]);
      expect(config.connections['aws-azure'].type).toBe('direct-link');
      expect(config.connections['aws-gcp'].type).toBe('interconnect');
      expect(config.connections['azure-gcp'].type).toBe('express-route');
      expect(config.routingStrategy).toBe('geo-based');
      expect(config.loadBalancer.algorithm).toBe('least-connections');
      expect(config.performance.enableCDN).toBe(true);
      expect(networking.writeFiles).toHaveBeenCalledWith(config, './multi-cloud-networking', 'typescript');
    });
  });

  // ========================================================================
  // learn.group.ts
  // ========================================================================
  describe('learn group', () => {
    it('registers all 6 learning generators', () => {
      const program = programWith(registerLearnGroup);
      const learn = program.commands.find(c => c.name() === 'learn');
      expect(learn?.commands.map(c => c.name())).toEqual([
        'interactive-tutorials', 'skill-assessment', 'mentorship',
        'code-quality-coaching', 'best-practices', 'technical-docs',
      ]);
    });

    it('interactive-tutorials defaults to all providers and coerces ints', async () => {
      const program = programWith(registerLearnGroup);
      await program.parseAsync([
        'node', 're-shell', 'learn', 'interactive-tutorials', 'onb',
        '--max-retries', '5', '--passing-score', '85',
        '--default-learning-style', 'kinesthetic',
        '--output', '/tmp/tut-out', '--language', 'python',
      ]);
      const config = vi.mocked(tutorials.displayConfig).mock.calls[0][0] as any;
      expect(config.projectName).toBe('onb');
      expect(config.providers).toEqual(['aws', 'azure', 'gcp']);
      expect(config.maxRetries).toBe(5);
      expect(config.passingScoreThreshold).toBe(85);
      expect(config.defaultLearningStyle).toBe('kinesthetic');
      // Transform-style generator: the factory output is what gets written.
      expect(vi.mocked(tutorials.interactiveTutorials)).toHaveBeenCalledWith(config);
      expect(tutorials.writeFiles).toHaveBeenCalledWith(config, '/tmp/tut-out', 'python');
      expect(output()).toContain('Files generated successfully in: /tmp/tut-out');
      expect(output()).toContain('interactive_tutorials_manager.py');
    });

    it('skill-assessment forwards the tracking toggles', async () => {
      const program = programWith(registerLearnGroup);
      await program.parseAsync([
        'node', 're-shell', 'learn', 'skill-assessment', 'skills',
        '--enable-automated-assessments', '--enable-skill-gap-analysis',
        '--assessment-frequency', '3', '--certification-expiry-alert', '45',
        '--enable-azure',
      ]);
      const config = vi.mocked(skillAssess.displayConfig).mock.calls[0][0] as any;
      expect(config.providers).toEqual(['azure']);
      expect(config.enableAutomatedAssessments).toBe(true);
      expect(config.enableSkillGapAnalysis).toBe(true);
      expect(config.assessmentFrequency).toBe(3);
      expect(config.certificationExpiryAlert).toBe(45);
      expect(output()).toContain('skill-assessment-manager.ts');
    });

    it('mentorship coerces the match threshold and reminder hours', async () => {
      const program = programWith(registerLearnGroup);
      await program.parseAsync([
        'node', 're-shell', 'learn', 'mentorship', 'grow',
        '--match-threshold', '80', '--session-reminder-hours', '12',
        '--enable-auto-matching',
      ]);
      const config = vi.mocked(mentorshipMatching.displayConfig).mock.calls[0][0] as any;
      expect(config.matchThreshold).toBe(80);
      expect(config.sessionReminderHours).toBe(12);
      expect(config.enableAutoMatching).toBe(true);
      expect(mentorshipMatching.writeFiles).toHaveBeenCalledWith(config, './mentorship-output', 'typescript');
      expect(output()).toContain('mentorship.tf');
    });

    it('code-quality-coaching forwards style, format, and threshold options', async () => {
      const program = programWith(registerLearnGroup);
      await program.parseAsync([
        'node', 're-shell', 'learn', 'code-quality-coaching', 'cqc',
        '--coaching-style', 'socratic', '--feedback-format', 'inline',
        '--severity-threshold', 'minor', '--review-frequency', '14',
      ]);
      const config = vi.mocked(coaching.displayConfig).mock.calls[0][0] as any;
      expect(config.defaultCoachingStyle).toBe('socratic');
      expect(config.feedbackFormat).toBe('inline');
      expect(config.severityThreshold).toBe('minor');
      expect(config.reviewFrequency).toBe(14);
      expect(output()).toContain('code-quality-coaching.tf');
    });

    it('best-practices coerces the voting threshold and visibility', async () => {
      const program = programWith(registerLearnGroup);
      await program.parseAsync([
        'node', 're-shell', 'learn', 'best-practices', 'bp',
        '--voting-threshold', '10', '--visibility', 'team',
        '--reputation-system', '--moderation-required',
      ]);
      const config = vi.mocked(bestPractices.displayConfig).mock.calls[0][0] as any;
      expect(config.votingThreshold).toBe(10);
      expect(config.practiceVisibility).toBe('team');
      expect(config.reputationSystem).toBe(true);
      expect(config.moderationRequired).toBe(true);
      expect(output()).toContain('best-practices-output');
    });

    it('technical-docs maps the AI provider and versioning strategy', async () => {
      const program = programWith(registerLearnGroup);
      await program.parseAsync([
        'node', 're-shell', 'learn', 'technical-docs', 'docs',
        '--ai-provider', 'openai', '--ai-model', 'gpt-4o',
        '--enable-content-generation', '--enable-versioning',
        '--versioning-strategy', 'date-based',
      ]);
      const config = vi.mocked(techDocs.displayConfig).mock.calls[0][0] as any;
      expect(config.aiConfig.provider).toBe('openai');
      expect(config.aiConfig.model).toBe('gpt-4o');
      expect(config.aiConfig.enableContentGeneration).toBe(true);
      expect(config.versioning.enabled).toBe(true);
      expect(config.versioning.strategy).toBe('date-based');
      expect(techDocs.writeFiles).toHaveBeenCalledWith(config, './technical-docs-output', 'typescript');
      expect(output()).toContain('technical-documentation-manager.ts');
    });
  });
});
