import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import {
  OfflineIntentBackend,
  LlmIntentBackendStub,
  tokenize,
  IntentResult,
} from '../../src/utils/ai-intent';
import { CommandCatalogEntry } from '../../src/utils/command-catalog';

/**
 * A small, fixed catalogue that mirrors the real one's shape for the commands
 * the phrase-set exercises. Using a hand-built catalogue keeps the tests
 * deterministic and independent of the full live command tree, while the
 * parser code under test is exactly the production code path.
 */
function fixtureCatalog(): CommandCatalogEntry[] {
  const jsonFlag = {
    name: '--json',
    description: 'Output as JSON',
    takesValue: false,
  };
  return [
    {
      path: 'templates list',
      aliases: [],
      description: 'List available framework templates',
      args: [],
      flags: [jsonFlag],
      supportsJson: true,
      supportsDryRun: false,
      destructive: false,
    },
    {
      path: 'templates show',
      aliases: [],
      description: 'Show details for a single framework template',
      args: [{ name: 'id', required: true }],
      flags: [jsonFlag],
      supportsJson: true,
      supportsDryRun: false,
      destructive: false,
    },
    {
      path: 'workspace health',
      aliases: [],
      description: 'Run workspace health checks',
      args: [],
      flags: [jsonFlag],
      supportsJson: true,
      supportsDryRun: false,
      destructive: false,
    },
    {
      path: 'workspace summary',
      aliases: [],
      description: 'Summarize the workspace',
      args: [],
      flags: [jsonFlag],
      supportsJson: true,
      supportsDryRun: false,
      destructive: false,
    },
    {
      path: 'workspace graph',
      aliases: [],
      description: 'Generate the workspace dependency graph',
      args: [],
      flags: [jsonFlag],
      supportsJson: true,
      supportsDryRun: false,
      destructive: false,
    },
    {
      path: 'create',
      aliases: [],
      description: 'Create a new Re-Shell project with shell application',
      args: [{ name: 'name', required: true }],
      flags: [
        { name: '--template', description: 'Template to use', takesValue: true },
        { name: '--framework', description: 'Frontend framework', takesValue: true },
        jsonFlag,
      ],
      supportsJson: true,
      supportsDryRun: true,
      destructive: false,
    },
    {
      path: 'commands list',
      aliases: [],
      description: 'List all available commands as a machine-readable catalog',
      args: [],
      flags: [jsonFlag],
      supportsJson: true,
      supportsDryRun: false,
      destructive: false,
    },
    {
      path: 'doctor',
      aliases: [],
      description: 'Diagnose common environment issues',
      args: [],
      flags: [jsonFlag],
      supportsJson: true,
      supportsDryRun: false,
      destructive: false,
    },
  ];
}

function backend(): OfflineIntentBackend {
  return new OfflineIntentBackend(fixtureCatalog());
}

/** Narrowing helper: assert a result resolved (not a clarification). */
function expectResolved(result: IntentResult): Extract<
  IntentResult,
  { needsClarification: false }
> {
  expect(result.needsClarification).toBe(false);
  if (result.needsClarification) {
    throw new Error('expected a resolved intent');
  }
  return result;
}

describe('tokenize', () => {
  it('treats shell metacharacters as delimiters, never as tokens', () => {
    const tokens = tokenize('list templates; rm -rf ~');
    // Metacharacters (`;`, `~`) and the standalone dash are gone.
    expect(tokens).not.toContain(';');
    expect(tokens).not.toContain('~');
    expect(tokens).toContain('list');
    expect(tokens).toContain('templates');
    // "rm" and "rf" survive only as harmless words — they are scored, not run.
    expect(tokens).toContain('rm');
  });
});

describe('OfflineIntentBackend — fixed phrase set', () => {
  const cases: Array<{ phrase: string; argv: string[] }> = [
    { phrase: 'list all templates as json', argv: ['templates', 'list', '--json'] },
    { phrase: 'list templates', argv: ['templates', 'list'] },
    { phrase: 'check workspace health', argv: ['workspace', 'health'] },
    {
      phrase: 'check workspace health as json',
      argv: ['workspace', 'health', '--json'],
    },
    {
      phrase: 'make a new express service called api',
      argv: ['create', 'api', '--template', 'express'],
    },
    { phrase: 'show the workspace dependency graph', argv: ['workspace', 'graph'] },
    {
      phrase: 'list available commands as json',
      argv: ['commands', 'list', '--json'],
    },
  ];

  for (const { phrase, argv } of cases) {
    it(`maps "${phrase}" -> re-shell ${argv.join(' ')}`, () => {
      const result = backend().parse(phrase);
      const resolved = expectResolved(result);
      expect(resolved.candidate.argv).toEqual(argv);
      expect(resolved.candidate.confidence).toBeGreaterThan(0);
    });
  }

  it('emits --json only when the prompt asks for it and the command supports it', () => {
    const withJson = expectResolved(backend().parse('list templates as json'));
    expect(withJson.candidate.argv).toContain('--json');

    const withoutJson = expectResolved(backend().parse('list templates'));
    expect(withoutJson.candidate.argv).not.toContain('--json');
  });
});

describe('OfflineIntentBackend — clarification', () => {
  it('asks for clarification on a vague/ambiguous prompt', () => {
    // "check" alone maps to health/validate/doctor — genuinely ambiguous.
    const result = backend().parse('check');
    expect(result.needsClarification).toBe(true);
    if (result.needsClarification) {
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.question).toBeTruthy();
    }
  });

  it('asks for clarification when nothing matches', () => {
    const result = backend().parse('xyzzy frobnicate the quux');
    expect(result.needsClarification).toBe(true);
    if (result.needsClarification) {
      expect(result.reason).toBe('no-match');
      expect(result.candidates).toEqual([]);
    }
  });

  it('asks for clarification on pure noise / empty-ish prompt', () => {
    const result = backend().parse('the a of to');
    expect(result.needsClarification).toBe(true);
  });
});

describe('OfflineIntentBackend — injection safety', () => {
  it('treats injection text as data and never yields a shell string', () => {
    const result = backend().parse('list templates; rm -rf ~');

    if (result.needsClarification) {
      // Acceptable safe outcome: ask the user instead of guessing.
      for (const c of result.candidates) {
        assertSafeArgv(c.argv);
      }
      return;
    }

    // Resolved outcome: must be the safe templates-list spec, no injection.
    expect(result.candidate.path).toBe('templates list');
    assertSafeArgv(result.candidate.argv);
    // Crucially: argv is an array of vetted tokens, not a shell string.
    expect(Array.isArray(result.candidate.argv)).toBe(true);
    expect(result.candidate.argv.join(' ')).not.toContain(';');
    expect(result.candidate.argv.join(' ')).not.toContain('rm');
    expect(result.candidate.argv.join(' ')).not.toContain('~');
  });

  it('never splices raw injection tokens into a create name slot', () => {
    // A malicious "name" with shell metacharacters must not become argv.
    const result = backend().parse('create a service called foo;rm');
    if (!result.needsClarification) {
      // "foo;rm" tokenizes to ["foo","rm"]; "rm" is not a valid trigger value,
      // and "foo" is the only safe candidate — never the metacharacter form.
      assertSafeArgv(result.candidate.argv);
      expect(result.candidate.argv.join(' ')).not.toContain(';');
    }
  });

  /** Every argv token must be a known flag, a path segment, or a safe value. */
  function assertSafeArgv(argv: string[]): void {
    const safeToken = /^(--?[a-z][a-z-]*|[A-Za-z0-9][A-Za-z0-9._-]*)$/;
    for (const token of argv) {
      expect(token).toMatch(safeToken);
    }
  }
});

describe('OfflineIntentBackend — explanations', () => {
  it('explains the resolved command from catalogue metadata', () => {
    const resolved = expectResolved(backend().parse('list templates as json'));
    const entry = backend().entryFor('templates list');
    expect(entry).toBeDefined();
    expect(resolved.explanation).toContain('re-shell templates list');
    expect(resolved.explanation.toLowerCase()).toContain('template');
  });
});

describe('LlmIntentBackendStub', () => {
  it('is inert — parsing throws, so it can never run silently in CI', () => {
    const stub = new LlmIntentBackendStub();
    expect(stub.name).toBe('llm-stub');
    expect(() => stub.parse('anything')).toThrowError(/stub/i);
  });
});

describe('OfflineIntentBackend — wired to the live program', () => {
  it('resolves against the real command catalogue', async () => {
    // Smoke test: build a tiny program with the same shapes the CLI registers,
    // proving the parser works off a live commander tree, not just a fixture.
    const program = new Command();
    const templates = program.command('templates').description('Templates');
    templates
      .command('list')
      .description('List available framework templates')
      .option('--json', 'Output as JSON')
      .action(() => {});
    program
      .command('create')
      .description('Create a new Re-Shell project')
      .argument('<name>')
      .option('--template <t>', 'Template to use')
      .action(() => {});

    const { createOfflineBackend } = await import('../../src/utils/ai-intent');
    const be = createOfflineBackend(program);
    const result = be.parse('list templates as json');
    const resolved = expectResolved(result);
    expect(resolved.candidate.argv).toEqual(['templates', 'list', '--json']);
  });
});
