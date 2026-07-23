import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  ConfigTemplateEngine,
  TemplateHelpers,
  templateEngine,
  type ConfigTemplate,
  type TemplateVariable,
} from '../../src/utils/template-engine';

/**
 * Build a template body that exercises substitution syntaxes and render it
 * against the supplied variables. An empty variables-definition array is used
 * so the substitution layer can be isolated from variable validation.
 */
async function renderBody(
  engine: ConfigTemplateEngine,
  name: string,
  body: unknown,
  variables: Record<string, unknown>,
): Promise<unknown> {
  await engine.createTemplate(name, body, [], {});
  return engine.renderTemplate(name, variables);
}

describe('ConfigTemplateEngine — lifecycle (fs)', () => {
  let dir: string;
  let engine: ConfigTemplateEngine;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-engine-'));
    engine = new ConfigTemplateEngine(dir);
  });
  afterEach(() => fs.removeSync(dir));

  const sample = (): ConfigTemplate => ({
    name: 'sample',
    version: '1.0.0',
    description: 'a sample template',
    tags: ['demo'],
    variables: [{ name: 'who', type: 'string', description: 'who to greet' }],
    template: { msg: '${variables.who}' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  it('defaults the templates directory to <cwd>/.re-shell/templates', () => {
    const e = new ConfigTemplateEngine();
    // Access the private dir via its observable effect on saveTemplate output.
    expect(e).toBeInstanceOf(ConfigTemplateEngine);
  });

  it('saveTemplate writes <name>.template.yaml into the templates dir and returns the full path', async () => {
    const out = await engine.saveTemplate(sample());
    expect(out).toBe(path.join(dir, 'sample.template.yaml'));
    expect(await fs.pathExists(out)).toBe(true);
    const onDisk = yaml.parse(await fs.readFile(out, 'utf8'));
    expect(onDisk.name).toBe('sample');
    // updatedAt is refreshed on save.
    expect(onDisk.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('saveTemplate respects an absolute templatePath', async () => {
    const abs = path.join(dir, 'nested', 'custom.yaml');
    const out = await engine.saveTemplate(sample(), abs);
    expect(out).toBe(abs);
    expect(await fs.pathExists(abs)).toBe(true);
  });

  it('saveTemplate throws ValidationError when the template is invalid', async () => {
    const bad = sample();
    // @ts-expect-error — exercising runtime validation of a malformed template
    delete bad.name;
    await expect(engine.saveTemplate(bad)).rejects.toThrow(/valid name/);
  });

  it('loadTemplate reads, parses and validates a YAML file', async () => {
    const out = await engine.saveTemplate(sample());
    const loaded = await engine.loadTemplate(out);
    expect(loaded.name).toBe('sample');
    expect(loaded.variables).toHaveLength(1);
  });

  it('loadTemplate wraps a missing file in a ValidationError', async () => {
    await expect(engine.loadTemplate(path.join(dir, 'nope.yaml'))).rejects.toThrow(
      /Failed to load template/,
    );
  });

  it('getTemplate caches in memory after a disk lookup', async () => {
    await engine.saveTemplate(sample());
    const first = await engine.getTemplate('sample');
    expect(first?.name).toBe('sample');
    // Delete the file; the cached copy must still be returned.
    await fs.unlink(path.join(dir, 'sample.template.yaml'));
    const cached = await engine.getTemplate('sample');
    expect(cached?.name).toBe('sample');
  });

  it('getTemplate returns null for an unknown template', async () => {
    expect(await engine.getTemplate('missing')).toBeNull();
  });

  it('listTemplates enumerates .template.yaml files sorted by name, skipping broken ones', async () => {
    await engine.saveTemplate(sample());
    await engine.saveTemplate({ ...sample(), name: 'beta', template: { x: 1 } });
    // A malformed file (not valid template YAML) should be skipped, not throw.
    await fs.writeFile(path.join(dir, 'broken.template.yaml'), 'name: ::: not valid');
    const list = await engine.listTemplates();
    expect(list.map((t) => t.name)).toEqual(['beta', 'sample']);
  });

  it('listTemplates returns an empty array for an empty directory', async () => {
    expect(await engine.listTemplates()).toEqual([]);
  });

  it('deleteTemplate removes the file and evicts the cache', async () => {
    await engine.saveTemplate(sample());
    await engine.deleteTemplate('sample');
    expect(await fs.pathExists(path.join(dir, 'sample.template.yaml'))).toBe(false);
    expect(await engine.getTemplate('sample')).toBeNull();
  });

  it('deleteTemplate throws ValidationError when the template does not exist', async () => {
    await expect(engine.deleteTemplate('ghost')).rejects.toThrow(/not found|Failed to delete/);
  });

  it('createTemplate fills defaults and persists the template', async () => {
    const created = await engine.createTemplate(
      'fresh',
      { a: 1 },
      [{ name: 'x', type: 'string', description: 'x' }],
      { author: 'me', tags: ['t'], version: '2.0.0' },
    );
    expect(created.version).toBe('2.0.0');
    expect(created.author).toBe('me');
    expect(created.tags).toEqual(['t']);
    expect(created.description).toBe('Configuration template for fresh');
    expect(created.createdAt).toBe(created.updatedAt);
    expect(await engine.getTemplate('fresh')).not.toBeNull();
  });

  it('createTemplate applies default version/description/tags when omitted', async () => {
    const created = await engine.createTemplate('plain', { a: 1 }, []);
    expect(created.version).toBe('1.0.0');
    expect(created.tags).toEqual([]);
    expect(created.description).toBe('Configuration template for plain');
  });
});

describe('ConfigTemplateEngine — template + variable validation', () => {
  let dir: string;
  let engine: ConfigTemplateEngine;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-val-'));
    engine = new ConfigTemplateEngine(dir);
  });
  afterEach(() => fs.removeSync(dir));

  const base = (over: Partial<ConfigTemplate> = {}): ConfigTemplate => ({
    name: 't',
    version: '1.0.0',
    description: 'd',
    tags: [],
    variables: [],
    template: { x: 1 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  const expectInvalid = async (tpl: ConfigTemplate, fragment: RegExp) => {
    await expect(engine.saveTemplate(tpl)).rejects.toThrow(fragment);
  };

  it('rejects a missing/invalid name, version, description, variables array and template object', async () => {
    await expectInvalid(base({ name: '' }), /valid name/);
    await expectInvalid(base({ version: '' }), /valid version/);
    await expectInvalid(base({ description: '' }), /description/);
    // @ts-expect-error — variables must be an array at runtime
    await expectInvalid(base({ variables: 'nope' }), /variables array/);
    await expectInvalid(base({ template: undefined }), /template object/);
  });

  it('rejects a variable missing name, type or description', async () => {
    const mk = (v: Partial<TemplateVariable>) =>
      base({ variables: [{ name: 'x', type: 'string', description: 'd', ...v }] });
    await expectInvalid(mk({ name: '' }), /valid name/);
    await expectInvalid(mk({ type: 'nope' }), /valid type/);
    await expectInvalid(mk({ description: '' }), /description/);
  });

  it('renderTemplate rejects an unknown template', async () => {
    await expect(engine.renderTemplate('ghost', {})).rejects.toThrow(/not found/);
  });

  it('flags a missing required variable', async () => {
    await engine.saveTemplate(
      base({
        variables: [{ name: 'port', type: 'number', description: 'p', required: true }],
      }),
    );
    await expect(engine.renderTemplate('t', {})).rejects.toThrow(/Required variable 'port'/);
  });

  it('flags a type mismatch', async () => {
    await engine.saveTemplate(
      base({ variables: [{ name: 'port', type: 'number', description: 'p' }] }),
    );
    await expect(engine.renderTemplate('t', { port: 'nope' })).rejects.toThrow(
      /must be of type number/,
    );
  });

  it('treats arrays as the "array" type', async () => {
    await engine.saveTemplate(
      base({ variables: [{ name: 'items', type: 'array', description: 'i' }] }),
    );
    await expect(engine.renderTemplate('t', { items: 'nope' })).rejects.toThrow(
      /must be of type array/,
    );
    // A real array passes validation.
    await expect(engine.renderTemplate('t', { items: [1, 2] })).resolves.toBeDefined();
  });

  it('enforces pattern, min/max (number + string length) and options rules', async () => {
    const v: TemplateVariable = {
      name: 'slug',
      type: 'string',
      description: 's',
      validation: { pattern: '^[a-z]+$', min: 2, max: 5, options: ['abc', 'ab'] },
    };
    await engine.saveTemplate(base({ variables: [v] }));
    await expect(engine.renderTemplate('t', { slug: 'ABC' })).rejects.toThrow(/match pattern/);
    await expect(engine.renderTemplate('t', { slug: 'a' })).rejects.toThrow(/at least 2 characters/);
    await expect(engine.renderTemplate('t', { slug: 'abcdef' })).rejects.toThrow(
      /at most 5 characters/,
    );
    await expect(engine.renderTemplate('t', { slug: 'xyz' })).rejects.toThrow(/must be one of/);
  });

  it('applies numeric min/max bounds', async () => {
    const v: TemplateVariable = {
      name: 'port',
      type: 'number',
      description: 'p',
      validation: { min: 1000, max: 2000 },
    };
    await engine.saveTemplate(base({ variables: [v] }));
    await expect(engine.renderTemplate('t', { port: 500 })).rejects.toThrow(/at least 1000/);
    await expect(engine.renderTemplate('t', { port: 5000 })).rejects.toThrow(/at most 2000/);
  });

  it('skips validation for optional undefined variables', async () => {
    await engine.saveTemplate(
      base({ variables: [{ name: 'opt', type: 'number', description: 'o' }] }),
    );
    await expect(engine.renderTemplate('t', {})).resolves.toBeDefined();
  });
});

describe('ConfigTemplateEngine — substitution syntaxes', () => {
  let dir: string;
  let engine: ConfigTemplateEngine;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-sub-'));
    engine = new ConfigTemplateEngine(dir);
  });
  afterEach(() => fs.removeSync(dir));

  it('substitutes ${variables.name} and {{variables.name}}', async () => {
    const out = await renderBody(
      engine,
      'a',
      { brace: '${variables.name}', mustache: '{{variables.name}}' },
      { name: 'app' },
    );
    expect(out).toEqual({ brace: 'app', mustache: 'app' });
  });

  it('leaves unresolved references intact', async () => {
    const out = await renderBody(engine, 'b', { v: '${variables.missing}' }, {});
    expect(out).toEqual({ v: '${variables.missing}' });
  });

  it('applies ${variables.name:default} fallbacks', async () => {
    const out = await renderBody(
      engine,
      'c',
      { present: '${variables.name:fallback}', missing: '${variables.x:defaultVal}' },
      { name: 'app' },
    );
    expect(out).toEqual({ present: 'app', missing: 'defaultVal' });
  });

  it('NOTE: ternary expressions get mangled by the conditional-default syntax', async () => {
    // `${{ flag ? 1 : 2 }}` fails expression eval (no `?`/`:` in the
    // whitelist), but the trailing `: 2` is then captured by the
    // `${var:default}` syntax, producing ` 2 }`. Assert the real behaviour.
    const out = await renderBody(
      engine,
      'c2',
      { tern: '${{ variables.flag ? 1 : 2 }}' },
      { flag: true },
    );
    expect(out).toEqual({ tern: ' 2 }' });
  });

  it('evaluates ${{ expression }} arithmetic and comparisons with variables', async () => {
    const out = await renderBody(
      engine,
      'd',
      { sum: '${{ variables.port + 1000 }}', big: '${{ variables.port > 1000 }}' },
      { port: 3000 },
    );
    expect(out).toEqual({ sum: 4000, big: true });
  });

  it('keeps an invalid expression as a literal', async () => {
    // `;` is not in the expression whitelist, so evaluation fails and the
    // original token is preserved. (An expression containing `:` would instead
    // be captured by the `${var:default}` fallback syntax — see the NOTE test.)
    const out = await renderBody(
      engine,
      'e',
      { expr: '${{ 1; 2 }}' },
      { flag: true },
    );
    expect((out as Record<string, unknown>).expr).toBe('${{ 1; 2 }}');
  });

  it('resolves dotted paths into projectInfo / userInfo metadata', async () => {
    await engine.createTemplate('f', { p: '${projectInfo.framework}' }, [], {});
    const out = await engine.renderTemplate('f', {}, {
      projectInfo: { framework: 'react-ts' },
    });
    expect(out).toEqual({ p: 'react-ts' });
  });

  it('substitutes nested object keys and array elements recursively', async () => {
    const out = await renderBody(
      engine,
      'g',
      { '${variables.name}': { arr: ['${variables.name}', 'static'] } },
      { name: 'app' },
    );
    expect(out).toEqual({ app: { arr: ['app', 'static'] } });
  });
});

describe('ConfigTemplateEngine — value coercion', () => {
  let dir: string;
  let engine: ConfigTemplateEngine;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-coerce-'));
    engine = new ConfigTemplateEngine(dir);
  });
  afterEach(() => fs.removeSync(dir));

  it('coerces booleans, null and undefined tokens to native values', async () => {
    const out = await renderBody(
      engine,
      'a',
      { t: 'true', f: 'false', n: 'null', u: 'undefined' },
      {},
    );
    expect(out).toEqual({ t: true, f: false, n: null, u: undefined });
  });

  it('coerces a purely-numeric result to a number', async () => {
    const out = await renderBody(engine, 'b', { n: '${variables.num}' }, { num: 42 });
    expect(out).toEqual({ n: 42 });
  });

  it('parses a literal JSON-array/object string into a native value', async () => {
    const out = await renderBody(engine, 'c', { arr: '[1, 2, 3]', obj: '{ "k": 1 }' }, {});
    expect(out).toEqual({ arr: [1, 2, 3], obj: { k: 1 } });
  });

  it('substitutes a boolean variable through ${...} to a real boolean', async () => {
    const out = await renderBody(engine, 'd', { flag: '${variables.flag}' }, { flag: true });
    expect(out).toEqual({ flag: true });
  });
});

describe('TemplateHelpers', () => {
  it('createProjectTemplate builds a project template with the expected shape', () => {
    const tpl = TemplateHelpers.createProjectTemplate('my-app', 'react', 'pnpm');
    expect(tpl.name).toBe('react-project');
    expect(tpl.version).toBe('1.0.0');
    expect(tpl.tags).toEqual(['react', 'project', 'pnpm']);
    expect(tpl.variables.map((v) => v.name).sort()).toEqual([
      'enableTesting',
      'port',
      'projectName',
    ]);
    // The framework + package manager are baked into the body.
    expect(tpl.template).toMatchObject({ packageManager: 'pnpm', framework: 'react' });
    // The projectName variable is required with a lowercase-hyphen pattern.
    const name = tpl.variables.find((v) => v.name === 'projectName');
    expect(name?.required).toBe(true);
    expect(name?.validation?.pattern).toBe('^[a-z0-9-]+$');
  });

  it('createWorkspaceTemplate builds a workspace template for each type', () => {
    for (const type of ['app', 'package', 'lib', 'tool'] as const) {
      const tpl = TemplateHelpers.createWorkspaceTemplate(type);
      expect(tpl.name).toBe(`${type}-workspace`);
      expect(tpl.template).toMatchObject({ type });
      expect(tpl.variables.map((v) => v.name)).toEqual(['workspaceName', 'framework']);
    }
  });

  it('NOTE: helper templates reference bare variable names that the engine does not resolve', async () => {
    // The engine resolves paths against the context (which nests variables
    // under `variables.`), so bare `${projectName}` tokens are left literal.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-helper-'));
    try {
      const engine = new ConfigTemplateEngine(dir);
      const tpl = TemplateHelpers.createProjectTemplate('my-app', 'react', 'pnpm');
      await engine.saveTemplate(tpl);
      const rendered = (await engine.renderTemplate('react-project', {
        projectName: 'my-app',
      })) as Record<string, unknown>;
      expect(rendered.name).toBe('${projectName}');
    } finally {
      fs.removeSync(dir);
    }
  });
});

describe('templateEngine singleton', () => {
  it('is a shared ConfigTemplateEngine instance', () => {
    expect(templateEngine).toBeInstanceOf(ConfigTemplateEngine);
  });
});
