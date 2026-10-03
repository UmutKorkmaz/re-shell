import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import {
  backendTemplates,
  getBackendTemplate,
  listBackendTemplates,
  toTemplateSummary,
} from '../../src/templates/backend/index';
import { buildTemplateMatrix } from '../../src/utils/template-matrix';
import { registerTemplatesGroup } from '../../src/groups/templates.group';

/**
 * Template ids per runtime/language group that the registry promises to keep at
 * three or more working templates ("working" = scaffolds and builds; see
 * scripts/scaffold-test-templates.sh and scripts/boot-test-templates.mjs).
 */
const PARITY_GROUPS: Record<string, string[]> = {
  deno: ['oak-deno', 'fresh-deno', 'aleph-deno'],
  bun: ['elysia-bun', 'hono', 'bun-serve', 'trpc-bun'],
  kotlin: ['ktor', 'http4k', 'spring-boot-kotlin', 'micronaut-kotlin'],
  scala: ['akka-http', 'play-scala', 'http4s-scala'],
  crystal: ['kemal', 'lucky-cr', 'amber-cr'],
  zig: ['zig-http', 'zap-zig', 'std-http-zig'],
  elixir: ['phoenix', 'plug-ex', 'nerves-ex'],
  nim: ['jester', 'prologue-nim', 'happyx-nim'],
};

const NEW_TEMPLATES = ['bun-serve', 'trpc-bun', 'std-http-zig'];

describe('backend template registry', () => {
  it('keys every template by its own id', () => {
    for (const [key, template] of Object.entries(backendTemplates)) {
      expect(template.id, key).toBe(key);
    }
  });

  it('gives every template at least one file and the metadata consumers read', () => {
    for (const template of listBackendTemplates()) {
      expect(Object.keys(template.files).length, template.id).toBeGreaterThan(0);
      expect(template.displayName, template.id).toBeTruthy();
      expect(template.description, template.id).toBeTruthy();
      expect(template.framework, template.id).toBeTruthy();
      expect(template.language, template.id).toBeTruthy();
    }
  });

  describe.each(Object.entries(PARITY_GROUPS))('%s', (group, ids) => {
    it('has at least three templates, all registered', () => {
      expect(ids.length).toBeGreaterThanOrEqual(3);
      for (const id of ids) {
        expect(getBackendTemplate(id), `${group}: ${id} is not registered`).toBeDefined();
      }
    });

    it('tags every template with its runtime', () => {
      const runtimeTag: Record<string, string> = {
        deno: 'deno',
        bun: 'bun',
        kotlin: 'kotlin',
        scala: 'scala',
        crystal: 'crystal',
        zig: 'zig',
        elixir: 'elixir',
        nim: 'nim',
      };
      for (const id of ids) {
        const template = getBackendTemplate(id)!;
        const signals = [template.language, template.framework, ...(template.tags ?? [])].map((s) =>
          String(s).toLowerCase(),
        );
        const hit = signals.some((s) => s.includes(runtimeTag[group]));
        // Frameworks such as phoenix/plug/jester carry their language as `language`
        // or a tag; a few (akka-http, http4s) are Scala by `language` only.
        expect(hit || template.language === group, `${id} does not identify as ${group}`).toBe(true);
      }
    });
  });

  describe('the templates added for runtime parity', () => {
    it('scaffold real, non-empty projects', () => {
      const expected: Record<string, string[]> = {
        'bun-serve': ['package.json', 'tsconfig.json', 'src/index.ts', 'src/server.ts', 'src/server.test.ts'],
        'trpc-bun': ['package.json', 'tsconfig.json', 'src/index.ts', 'src/router.ts', 'src/server.test.ts'],
        'std-http-zig': ['build.zig', 'build.zig.zon', 'src/main.zig', 'src/routes.zig'],
      };
      for (const id of NEW_TEMPLATES) {
        const files = backendTemplates[id].files as Record<string, string>;
        for (const path of expected[id]) {
          expect(files[path], `${id}/${path}`).toBeTruthy();
          expect(files[path].length, `${id}/${path}`).toBeGreaterThan(20);
        }
      }
    });

    it('only use placeholders the create flow substitutes', () => {
      const supported = new Set(['projectName', 'name', 'normalizedName', 'port', 'org', 'team', 'description']);
      for (const id of NEW_TEMPLATES) {
        for (const [path, content] of Object.entries(backendTemplates[id].files as Record<string, string>)) {
          expect(path, `${id} path`).not.toMatch(/\{\{/);
          for (const match of content.matchAll(/\{\{([A-Za-z_]+)\}\}/g)) {
            expect(supported.has(match[1]), `${id}/${path}: {{${match[1]}}}`).toBe(true);
          }
        }
      }
    });

    it('declare package.json as strict JSON with a typecheck script (bun templates)', () => {
      for (const id of ['bun-serve', 'trpc-bun']) {
        const raw = (backendTemplates[id].files as Record<string, string>)['package.json'];
        const manifest = JSON.parse(raw.replace(/\{\{projectName\}\}/g, 'registry-test'));
        expect(manifest.name).toBe('registry-test');
        expect(manifest.scripts.typecheck).toBe('tsc --noEmit');
        expect(manifest.scripts.start).toMatch(/^bun /);
        expect(manifest.scripts.test).toBe('bun test');
      }
    });

    it('pin the Zig version the sources are written for', () => {
      const files = backendTemplates['std-http-zig'].files as Record<string, string>;
      expect(files['build.zig.zon']).toContain('.minimum_zig_version = "0.13.0"');
      expect(files['README.md']).toContain('Zig 0.13.0');
    });
  });

  describe('generated content', () => {
    const flatten = (entries: Record<string, unknown>, prefix = ''): Array<[string, string]> =>
      Object.entries(entries).flatMap(([key, value]) =>
        value !== null && typeof value === 'object'
          ? flatten(value as Record<string, unknown>, prefix + (key.endsWith('/') ? key : key + '/'))
          : [[prefix + key, String(value ?? '')] as [string, string]],
      );

    // The create flow substitutes exactly these placeholders (commands/create.ts,
    // createBackendTemplate). Anything else would land in the project verbatim.
    const SUPPORTED = new Set(['projectName', 'name', 'normalizedName', 'port', 'org', 'team', 'description']);
    // Deployment manifests intentionally keep {{UPPER_CASE}} slots for the deploy tooling.
    const RUNTIME_SLOT = /^[A-Z][A-Z0-9_]*$/;

    const VERIFIED = [
      'express', 'fastify', 'nestjs', 'koa', 'hono',
      'fastapi', 'flask', 'django', 'gin', 'echo', 'fiber',
      'actix-web', 'rocket', 'axum', 'spring-boot', 'quarkus',
      'laravel', 'rails-api', 'phoenix', 'bun-serve', 'trpc-bun', 'std-http-zig',
    ];

    it.each(VERIFIED)('%s uses only placeholders the create flow substitutes', (id) => {
      for (const [path, content] of flatten(backendTemplates[id].files as Record<string, unknown>)) {
        expect(path, `${id}: file path`).not.toMatch(/\{\{/);
        for (const match of content.matchAll(/\{\{([A-Za-z_]+)\}\}/g)) {
          const token = match[1];
          expect(SUPPORTED.has(token) || RUNTIME_SLOT.test(token), `${id}/${path}: {{${token}}}`).toBe(true);
        }
      }
    });

    it('no template tells users to install or import an unpublished @re-shell package', () => {
      for (const template of listBackendTemplates()) {
        for (const [path, content] of flatten(template.files as Record<string, unknown>)) {
          expect(content, `${template.id}/${path}`).not.toMatch(/@re-shell\/[a-z-]+/);
        }
      }
    });

    it('NestJS ships every file its own relative imports point at', () => {
      const files = flatten(backendTemplates.nestjs.files as Record<string, unknown>);
      const paths = new Set(files.map(([path]) => path));
      for (const [path, content] of files.filter(([p]) => p.endsWith('.ts'))) {
        for (const match of content.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
          const base = path.split('/').slice(0, -1);
          for (const part of match[1].split('/')) {
            if (part === '..') base.pop();
            else if (part !== '.') base.push(part);
          }
          const target = base.join('/');
          expect(paths.has(target + '.ts') || paths.has(target + '/index.ts'), `${path} imports ${match[1]}`).toBe(true);
        }
      }
    });
  });

  describe('templates list / matrix', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // ok()/fail() write envelopes on stdout; keep the test output clean.
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
      logSpy.mockRestore();
    });

    const run = async (...args: string[]) => {
      const program = new Command();
      program.exitOverride();
      registerTemplatesGroup(program);
      await program.parseAsync(['node', 're-shell', 'templates', ...args, '--json']);
      const envelopes = stdoutSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((text) => text.trim().startsWith('{'));
      return JSON.parse(envelopes[envelopes.length - 1].trim());
    };

    it('`templates list --json` includes every parity template', async () => {
      const result = await run('list');
      expect(result.ok).toBe(true);
      const ids = new Set((result.data as Array<{ id: string }>).map((t) => t.id));
      for (const group of Object.values(PARITY_GROUPS)) {
        for (const id of group) expect(ids.has(id), id).toBe(true);
      }
      const bunServe = (result.data as Array<{ id: string; language: string; port: number }>).find(
        (t) => t.id === 'bun-serve',
      );
      expect(bunServe).toMatchObject({ language: 'typescript', port: 3000 });
    });

    it('`templates matrix --json` has a row for every parity template', async () => {
      const result = await run('matrix');
      expect(result.ok).toBe(true);
      const rows = result.data.matrix as Array<{ id: string; language: string; databases: string[] }>;
      for (const group of Object.values(PARITY_GROUPS)) {
        for (const id of group) expect(rows.some((row) => row.id === id), id).toBe(true);
      }
      expect(rows.find((row) => row.id === 'std-http-zig')?.language).toBe('zig');
      expect(rows.find((row) => row.id === 'bun-serve')?.databases).toContain('sqlite');
    });

    it('keeps the matrix and the list in step with the registry', () => {
      const { matrix } = buildTemplateMatrix();
      expect(matrix.length).toBe(listBackendTemplates().length);
      expect(listBackendTemplates().map(toTemplateSummary).map((t) => t.id)).toContain('trpc-bun');
    });
  });
});
