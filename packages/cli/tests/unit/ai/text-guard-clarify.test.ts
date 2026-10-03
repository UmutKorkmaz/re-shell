import { describe, expect, it } from 'vitest';
import {
  comparePrompts,
  editDistance,
  normalizeText,
  stem,
  tokenCosine,
  trigramDice,
  words,
} from '../../../src/ai/text';
import { indexCatalog, isSafeArgValue, vetArgv } from '../../../src/ai/argv-guard';
import { interpretAnswer } from '../../../src/ai/clarify';
import type { IntentCandidate } from '../../../src/utils/ai-intent';
import { fixtureCatalog } from './helpers';

describe('text normalisation', () => {
  it('lower-cases, strips punctuation (including shell metacharacters) and stop-words', () => {
    expect(normalizeText('Please, BUILD the Payments-Service!!').tokens).toEqual([
      'build',
      'payment',
      'servic',
    ]);
    expect(words('list; rm -rf ~ $(whoami)')).toEqual(['list', 'rm', 'rf', 'whoami']);
  });

  it('stems plurals and verb forms consistently', () => {
    for (const group of [
      ['create', 'creating', 'created', 'creates'],
      ['build', 'building', 'builds', 'built'],
      ['template', 'templates'],
      ['run', 'running', 'runs', 'ran'],
      ['service', 'services'],
    ]) {
      expect(new Set(group.map(stem)).size).toBe(1);
    }
  });

  it('maps synonyms to one canonical form', () => {
    expect(normalizeText('make a service').key).toBe(normalizeText('create a service').key);
    expect(normalizeText('delete service').key).toBe(normalizeText('remove services').key);
    expect(normalizeText('show templates as machine-readable json').tokens).toContain('json');
  });

  it('keeps negations, which change meaning', () => {
    expect(normalizeText('do not delete the api').tokens).toContain('not');
    expect(normalizeText('delete the api').key).not.toBe(normalizeText('do not delete the api').key);
  });

  it('computes edit distance (with transpositions) and similarity primitives', () => {
    expect(editDistance('build', 'build')).toBe(0);
    expect(editDistance('build', 'biuld')).toBe(1);
    expect(editDistance('build', 'buid')).toBe(1);
    expect(editDistance('abc', 'xyz', 1)).toBe(2);
    expect(trigramDice('payments', 'payments')).toBe(1);
    expect(trigramDice('payments', 'paymnets')).toBeGreaterThan(0.4);
    expect(tokenCosine(['a', 'b'], ['a', 'b'])).toBeCloseTo(1);
    expect(tokenCosine(['a'], ['b'])).toBe(0);
    expect(tokenCosine([], ['b'])).toBe(0);
  });
});

describe('comparePrompts (the cache equivalence guard)', () => {
  const cmp = (a: string, b: string, protectedTokens = new Set<string>()) =>
    comparePrompts(normalizeText(a), normalizeText(b), protectedTokens);

  it('treats case, punctuation, stop-words and word order as equivalent', () => {
    expect(cmp('Build the payments service', 'please build payments service!').equivalent).toBe(true);
    expect(cmp('build payments service', 'payments service build').equivalent).toBe(true);
  });

  it('treats synonyms and stems as equivalent', () => {
    expect(cmp('make a new service', 'create new services').equivalent).toBe(true);
  });

  it('tolerates a typo in an out-of-vocabulary word', () => {
    expect(cmp('deploy the checkout service', 'deploy the chekout service').equivalent).toBe(true);
  });

  it('does NOT merge different identifiers, even in long prompts', () => {
    expect(
      cmp(
        'create a react app called alpha with typescript routing and tests',
        'create a react app called beta with typescript routing and tests'
      ).equivalent
    ).toBe(false);
    expect(cmp('create service orders', 'create service payments').equivalent).toBe(false);
  });

  it('does NOT merge a verb change or a negation', () => {
    expect(cmp('delete the payments service', 'build the payments service').equivalent).toBe(false);
    expect(cmp('delete the api', 'do not delete the api').equivalent).toBe(false);
  });

  it('never fuzzes protected identity tokens (a one-letter service name difference)', () => {
    const protectedTokens = new Set(normalizeText('payroll').tokens);
    expect(cmp('deploy payroll', 'deploy payrol', protectedTokens).equivalent).toBe(false);
    expect(cmp('deploy payroll', 'deploy payrol').equivalent).toBe(true);
  });

  it('does not fuzz two canonical command words (list vs lint)', () => {
    expect(cmp('lint the api', 'list the api').equivalent).toBe(false);
  });

  it('does not fuzz short words or tokens containing digits', () => {
    expect(cmp('open the text', 'open the test').equivalent).toBe(false);
    expect(cmp('deploy v1', 'deploy v2').equivalent).toBe(false);
  });

  it('empty prompts are never equivalent', () => {
    expect(cmp('the a of', 'the a of').equivalent).toBe(false);
  });
});

describe('vetArgv (allow-list / injection filter)', () => {
  const index = indexCatalog(fixtureCatalog());
  const vet = (argv: unknown) => vetArgv(argv, index, { excludePathPrefixes: ['ai'] });

  it('accepts a real command with declared flags and safe values', () => {
    const r = vet(['run', 'build', '--filter', '@acme/api', '--json']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.path).toBe('run');
      expect(r.positionals).toEqual(['build']);
      expect(r.flags).toEqual([{ name: '--filter', value: '@acme/api' }, { name: '--json' }]);
      expect(r.missingArgs).toEqual([]);
    }
  });

  it('picks the longest matching command path', () => {
    const r = vet(['service', 'run', 'restart', 'orders']);
    expect(r.ok && r.entry.path).toBe('service run restart');
  });

  it('normalises --flag=value into two tokens', () => {
    const r = vet(['run', 'build', '--filter=@acme/api']);
    expect(r.ok && r.argv).toEqual(['run', 'build', '--filter', '@acme/api']);
  });

  it('reports missing required arguments without rejecting', () => {
    const r = vet(['templates', 'show']);
    expect(r.ok && r.missingArgs).toEqual(['id']);
  });

  it.each([
    ['not an array', 'run build', 'not-array'],
    ['empty', [], 'empty'],
    ['unknown command', ['frobnicate'], 'unknown-command'],
    ['unknown flag', ['run', 'build', '--force-push'], 'unknown-flag'],
    ['short flag', ['run', 'build', '-f'], 'unknown-flag'],
    ['bare double dash', ['run', 'build', '--'], 'unknown-flag'],
    ['flag missing value', ['run', 'build', '--filter'], 'flag-value-missing'],
    ['flag value is a flag', ['run', 'build', '--filter', '--json'], 'flag-value-missing'],
    ['boolean flag with value', ['run', 'build', '--json=yes'], 'flag-takes-no-value'],
    ['too many positionals', ['run', 'build', 'test'], 'too-many-arguments'],
    ['excluded ai family', ['ai', 'something'], 'excluded-command'],
    ['excluded ai create', ['ai', 'create', 'x'], 'excluded-command'],
  ])('rejects %s', (_name, argv, code) => {
    const r = vet(argv);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe(code);
  });

  it.each([
    'a;b',
    'a b',
    '$(whoami)',
    '`id`',
    'a|b',
    'a&b',
    'a>b',
    '../../etc/passwd',
    '/etc/passwd',
    '~/x',
    "it's",
    '"x"',
    '-rf',
    'a\nb',
    '',
    'x'.repeat(300),
  ])('rejects the injection-style value %j in a flag value and a positional', value => {
    expect(isSafeArgValue(value)).toBe(false);
    expect(vet(['run', 'build', '--filter', value]).ok).toBe(false);
    expect(vet(['run', value]).ok).toBe(false);
  });

  it.each(['payments', '@acme/payments-service', 'packages/api', 'v1.2.3', 'a_b-c', 'x:y', 'a=b,c'])(
    'accepts the shell-inert value %j',
    value => {
      expect(isSafeArgValue(value)).toBe(true);
    }
  );

  it('rejects whitespace and non-string tokens anywhere in argv', () => {
    expect(vet(['run', 'build;rm']).ok).toBe(false);
    expect(vet(['run', 'build', 5 as any]).ok).toBe(false);
    expect(vet(['run build']).ok).toBe(false);
  });

  it('rejects an absurdly long argv', () => {
    expect(vet(['run', ...new Array(60).fill('x')]).ok).toBe(false);
  });
});

describe('interpretAnswer (clarification answers)', () => {
  const cand = (argv: string[], nodeName?: string): IntentCandidate => ({
    path: argv[0],
    description: 'd',
    argv,
    confidence: 0.6,
    destructive: false,
    supportsJson: false,
    supportsDryRun: false,
    ...(nodeName ? { nodes: [{ name: nodeName, path: `packages/${nodeName}`, kind: 'package' }] } : {}),
  });
  const candidates = [
    cand(['run', 'build', '--filter', '@acme/payments-db'], '@acme/payments-db'),
    cand(['run', 'build', '--filter', '@acme/payments-service'], '@acme/payments-service'),
    cand(['run', 'test', '--filter', '@acme/api'], '@acme/api'),
  ];

  it.each([
    ['the second one', 1],
    ['second', 1],
    ['2', 1],
    ['option 3', 2],
    ['#1', 0],
    ['go with the first', 0],
    ['number two', 1],
    ['the last one', 2],
    ['3rd', 2],
  ])('picks by ordinal: %j -> candidate %i', (answer, index) => {
    const r = interpretAnswer(answer as string, candidates);
    expect(r.kind).toBe('choice');
    if (r.kind === 'choice') {
      expect(r.index).toBe(index);
      expect(r.how).toBe('ordinal');
    }
  });

  it('picks by a name that distinguishes one candidate', () => {
    const r = interpretAnswer('the service one', candidates);
    expect(r.kind === 'choice' && r.index).toBe(1);
    const r2 = interpretAnswer('payments-db', candidates);
    expect(r2.kind === 'choice' && r2.index).toBe(0);
    const r3 = interpretAnswer('run the tests', candidates);
    expect(r3.kind === 'choice' && r3.index).toBe(2);
  });

  it('treats an answer carrying new information as a refinement, not a pick that drops it', () => {
    // "tests" is not in either build candidate: picking one would discard it.
    const builds = candidates.slice(0, 2);
    expect(interpretAnswer('run the tests for the service', builds).kind).toBe('refine');
    expect(interpretAnswer('the service one', builds).kind).toBe('choice');
  });

  it('does not guess when the answer matches several candidates', () => {
    expect(interpretAnswer('payments', candidates).kind).toBe('refine');
  });

  it('treats an out-of-range ordinal as a refinement, not a crash', () => {
    expect(interpretAnswer('7', candidates).kind).toBe('refine');
  });

  it('recognises cancellation', () => {
    for (const a of ['none', 'cancel', 'never mind', 'neither', 'forget it']) {
      expect(interpretAnswer(a, candidates).kind).toBe('cancel');
    }
  });

  it('treats anything else as a refinement', () => {
    expect(interpretAnswer('to the staging environment please', candidates).kind).toBe('refine');
    expect(interpretAnswer('', candidates).kind).toBe('refine');
    expect(interpretAnswer('anything', []).kind).toBe('refine');
  });
});
