import { afterEach, describe, expect, it } from 'vitest';
import prompts from 'prompts';
import {
  CreateError,
  DEFAULT_BACKEND,
  DEFAULT_FRONTEND,
  assertBackend,
  assertFrontend,
  isNonInteractive,
  levenshtein,
  parseNameFrameworkList,
  resolveCreateRequest,
  suggestMatches,
} from '../../src/utils/create-request';
import { listFrontendTemplateIds } from '../../src/templates/frontend/registry';
import { SUPPORTED_FRAMEWORKS } from '../../src/utils/framework';

const defaults = { fillDefaults: true };
const interactive = { fillDefaults: false };

function errorOf(fn: () => unknown): CreateError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CreateError);
    return error as CreateError;
  }
  throw new Error('expected the call to throw');
}

describe('levenshtein / suggestMatches', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('suggests candidates that are contained in the input first', () => {
    expect(suggestMatches('go-gin', ['express', 'gin', 'fiber', 'go-react'])[0]).toBe('gin');
  });

  it('suggests close misspellings', () => {
    expect(suggestMatches('expres', ['express', 'fastify', 'koa'])).toContain('express');
    expect(suggestMatches('fastapi-x', ['fastapi', 'flask'])).toContain('fastapi');
  });

  it('suggests nothing when nothing is close', () => {
    expect(suggestMatches('zzzzzzzz', ['express', 'fastify', 'koa'])).toEqual([]);
  });

  it('caps and de-duplicates suggestions', () => {
    const many = Array.from({ length: 20 }, (_, i) => `react-${i}`);
    const out = suggestMatches('react', [...many, ...many], 5);
    expect(out).toHaveLength(5);
    expect(new Set(out).size).toBe(5);
  });
});

describe('isNonInteractive', () => {
  const original = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

  afterEach(() => {
    if (original) Object.defineProperty(process.stdin, 'isTTY', original);
    else delete (process.stdin as { isTTY?: boolean }).isTTY;
    delete (prompts as unknown as { _injected?: unknown })._injected;
  });

  function setTTY(value: boolean | undefined): void {
    Object.defineProperty(process.stdin, 'isTTY', { value, configurable: true, writable: true });
  }

  it('is true under --yes even on a TTY', () => {
    setTTY(true);
    expect(isNonInteractive({ yes: true })).toBe(true);
  });

  it('is true when stdin is not a TTY (closed or piped stdin)', () => {
    setTTY(undefined);
    expect(isNonInteractive({})).toBe(true);
    setTTY(false);
    expect(isNonInteractive({})).toBe(true);
  });

  it('is false on a TTY without --yes', () => {
    setTTY(true);
    expect(isNonInteractive({})).toBe(false);
  });

  it('stays interactive when a test harness injected prompt answers', () => {
    setTTY(false);
    (prompts as unknown as { _injected?: unknown[] })._injected = [{ any: 'answer' }];
    expect(isNonInteractive({})).toBe(false);
  });
});

describe('assertFrontend / assertBackend', () => {
  it('accepts registered ids', () => {
    expect(assertFrontend('react-ts')).toBe('react-ts');
    expect(assertBackend('express')).toBe('express');
  });

  it('rejects unknown ids with TEMPLATE_NOT_FOUND and close matches', () => {
    const frontend = errorOf(() => assertFrontend('react-tsx'));
    expect(frontend.code).toBe('TEMPLATE_NOT_FOUND');
    expect(frontend.message).toContain('Unknown frontend framework "react-tsx"');
    expect(frontend.message).toContain('Did you mean');
    expect(frontend.details?.suggestions).toContain('react-ts');

    const backend = errorOf(() => assertBackend('exprss'));
    expect(backend.code).toBe('TEMPLATE_NOT_FOUND');
    expect(backend.message).toContain('Unknown backend template "exprss"');
    expect(backend.details?.suggestions).toContain('express');
  });

  it('does not treat Object.prototype keys as templates', () => {
    expect(() => assertBackend('constructor')).toThrow(CreateError);
    expect(() => assertBackend('toString')).toThrow(CreateError);
    expect(() => assertFrontend('__proto__')).toThrow(CreateError);
  });
});

describe('resolveCreateRequest: mode', () => {
  it('defaults a bare request to a react-ts frontend and says so', () => {
    const r = resolveCreateRequest({}, defaults);
    expect(r.mode).toBe('frontend');
    expect(r.frontend).toBe(DEFAULT_FRONTEND);
    expect(r.backend).toBeUndefined();
    expect(r.notes.join(' ')).toContain('defaulting');
  });

  it('leaves choices unset for the interactive wizard to ask', () => {
    const r = resolveCreateRequest({}, interactive);
    expect(r.mode).toBe('frontend');
    expect(r.frontend).toBeUndefined();
    expect(r.notes).toEqual([]);
  });

  it('treats --frontend and --framework as aliases', () => {
    expect(resolveCreateRequest({ frontend: 'vue' }, defaults).frontend).toBe('vue');
    expect(resolveCreateRequest({ framework: 'vue-ts' }, defaults).frontend).toBe('vue-ts');
    expect(resolveCreateRequest({ framework: 'vue', frontend: 'vue' }, defaults).frontend).toBe('vue');
    expect(errorOf(() => resolveCreateRequest({ framework: 'vue', frontend: 'svelte' }, defaults)).code).toBe(
      'CREATE_INVALID_OPTIONS'
    );
  });

  it('classifies --backend alone as backend-only (no frontend appears)', () => {
    const r = resolveCreateRequest({ backend: 'express' }, defaults);
    expect(r.mode).toBe('backend');
    expect(r.backend).toBe('express');
    expect(r.frontend).toBeUndefined();
  });

  it('does not let a default --template turn backend-only into fullstack', () => {
    // The CLI no longer defaults --template to react-ts; an absent template adds no frontend.
    expect(resolveCreateRequest({ backend: 'fastify', template: undefined }, defaults).mode).toBe('backend');
  });

  it('classifies a backend plus a frontend as fullstack', () => {
    const r = resolveCreateRequest({ backend: 'express', frontend: 'vue-ts' }, defaults);
    expect(r).toMatchObject({ mode: 'fullstack', backend: 'express', frontend: 'vue-ts' });
  });

  it('defaults --fullstack to the express backend and react-ts frontend with notes', () => {
    const r = resolveCreateRequest({ fullstack: true }, defaults);
    expect(r).toMatchObject({ mode: 'fullstack', backend: DEFAULT_BACKEND, frontend: DEFAULT_FRONTEND });
    expect(r.notes).toHaveLength(2);
    expect(r.notes[0]).toContain(`default backend "${DEFAULT_BACKEND}"`);
  });

  it('keeps --fullstack choices unset for the wizard when interactive', () => {
    const r = resolveCreateRequest({ fullstack: true }, interactive);
    expect(r.mode).toBe('fullstack');
    expect(r.backend).toBeUndefined();
    expect(r.frontend).toBeUndefined();
  });

  it('selects polyglot and microfrontend and carries the frontend / shell', () => {
    expect(resolveCreateRequest({ polyglot: true }, defaults).mode).toBe('polyglot');
    const mf = resolveCreateRequest({ microfrontend: true, framework: 'vue' }, defaults);
    expect(mf.mode).toBe('microfrontend');
    expect(mf.frontend).toBe('vue');
  });

  it('selects an empty skeleton with --template blank', () => {
    const r = resolveCreateRequest({ template: 'blank' }, defaults);
    expect(r.mode).toBe('skeleton');
    expect(r.frontend).toBeUndefined();
    expect(r.backend).toBeUndefined();
  });
});

describe('resolveCreateRequest: --template', () => {
  it('treats a backend template id as a backend', () => {
    expect(resolveCreateRequest({ template: 'express' }, defaults)).toMatchObject({
      mode: 'backend',
      backend: 'express',
    });
  });

  it('treats a frontend framework id as a frontend', () => {
    expect(resolveCreateRequest({ template: 'vue-ts' }, defaults)).toMatchObject({
      mode: 'frontend',
      frontend: 'vue-ts',
    });
  });

  it('combines a backend template with a --frontend into fullstack', () => {
    expect(resolveCreateRequest({ template: 'express', frontend: 'react-ts' }, defaults).mode).toBe('fullstack');
  });

  it('expands an architecture template into a fullstack stack', () => {
    const r = resolveCreateRequest({ template: 'mern' }, defaults);
    expect(r.mode).toBe('fullstack');
    expect(r.architectureTemplate?.id).toBe('mern');
    expect(r).toMatchObject({ backend: 'express', frontend: 'react', db: 'mongoose' });
  });

  it('lets explicit flags override the architecture template', () => {
    const r = resolveCreateRequest({ template: 'mern', backend: 'fastify', db: 'prisma' }, defaults);
    expect(r).toMatchObject({ backend: 'fastify', frontend: 'react', db: 'prisma' });
  });

  it('rejects an unknown template with TEMPLATE_NOT_FOUND and suggestions', () => {
    const error = errorOf(() => resolveCreateRequest({ template: 'go-gin' }, defaults));
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
    expect(error.message).toContain('Unknown template "go-gin"');
    expect(error.message).toContain('Did you mean');
    expect(error.details?.suggestions).toContain('gin');
  });

  it('rejects an architecture template whose stack names an unknown backend', () => {
    const error = errorOf(() => resolveCreateRequest({ template: 'dotnet-blazor' }, defaults));
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
    expect(error.message).toContain('dotnet-blazor');
  });

  it('rejects contradictory flags', () => {
    const cases = [
      { template: 'express', backend: 'fastify' },
      { template: 'vue', frontend: 'react' },
      { template: 'blank', backend: 'express' },
      { template: 'blank', fullstack: true },
      { template: 'express', polyglot: true },
      { template: 'mern', microfrontend: true },
      { polyglot: true, microfrontend: true },
      { polyglot: true, fullstack: true },
      { microfrontend: true, backend: 'express' },
      { polyglot: true, backend: 'express' },
    ];
    for (const input of cases) {
      expect(errorOf(() => resolveCreateRequest(input, defaults)).code, JSON.stringify(input)).toBe(
        'CREATE_INVALID_OPTIONS'
      );
    }
  });
});

describe('resolveCreateRequest: option validation', () => {
  it('validates --type, --db, --port and --route', () => {
    expect(errorOf(() => resolveCreateRequest({ type: 'full-stack' }, defaults)).code).toBe(
      'CREATE_INVALID_OPTIONS'
    );
    expect(errorOf(() => resolveCreateRequest({ db: 'oracle' }, defaults)).code).toBe('CREATE_INVALID_OPTIONS');
    expect(errorOf(() => resolveCreateRequest({ port: 'abc' }, defaults)).code).toBe('CREATE_INVALID_OPTIONS');
    expect(errorOf(() => resolveCreateRequest({ port: '70000' }, defaults)).code).toBe('CREATE_INVALID_OPTIONS');
    expect(errorOf(() => resolveCreateRequest({ route: 'no-slash' }, defaults)).code).toBe(
      'CREATE_INVALID_OPTIONS'
    );
    expect(() => resolveCreateRequest({ type: 'lib', db: 'prisma', port: '4000', route: '/x' }, defaults)).not.toThrow();
  });

  it('rejects an unknown --frontend / --backend before anything else runs', () => {
    expect(errorOf(() => resolveCreateRequest({ frontend: 'nope' }, defaults)).code).toBe('TEMPLATE_NOT_FOUND');
    expect(errorOf(() => resolveCreateRequest({ backend: 'nope-js' }, defaults)).code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('only accepts frontends that have a scaffold template', () => {
    // Registered as a framework config but with no template: must not silently scaffold React.
    const withoutTemplate = Object.keys(SUPPORTED_FRAMEWORKS).filter(
      id => !listFrontendTemplateIds().includes(id)
    );
    for (const id of withoutTemplate) {
      expect(errorOf(() => resolveCreateRequest({ frontend: id }, defaults)).code).toBe('TEMPLATE_NOT_FOUND');
    }
  });
});

describe('parseNameFrameworkList', () => {
  it('parses name and name:framework entries', () => {
    expect(parseNameFrameworkList('--services', 'users:fastapi, orders:express ,billing')).toEqual([
      { name: 'users', framework: 'fastapi' },
      { name: 'orders', framework: 'express' },
      { name: 'billing', framework: undefined },
    ]);
  });

  it('rejects empty, malformed, non-kebab and duplicate entries', () => {
    expect(errorOf(() => parseNameFrameworkList('--services', ' , ')).code).toBe('CREATE_INVALID_OPTIONS');
    expect(errorOf(() => parseNameFrameworkList('--services', 'a:b:c')).code).toBe('CREATE_INVALID_OPTIONS');
    expect(errorOf(() => parseNameFrameworkList('--services', 'Bad_Name:express')).code).toBe(
      'CREATE_INVALID_OPTIONS'
    );
    expect(errorOf(() => parseNameFrameworkList('--remotes', '1abc')).code).toBe('CREATE_INVALID_OPTIONS');
    expect(errorOf(() => parseNameFrameworkList('--remotes', 'a,a')).code).toBe('CREATE_INVALID_OPTIONS');
  });
});
