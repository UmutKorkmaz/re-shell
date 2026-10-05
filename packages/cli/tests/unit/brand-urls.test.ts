import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  DOCS_URL,
  ISSUES_URL,
  RELEASES_URL,
  REPO_URL,
  SCHEMA_URL,
  SITE_BASE_PATH,
  SITE_ORIGIN,
  SITE_URL,
  WORKSPACE_FILE_NAMES,
  docsUrl,
} from '../../src/constants/brand';
import canonicalSchema from '../../src/schemas/workspace-v2.schema.json';
import { SCHEMA_ID, getIdeSchema } from '../../src/utils/schema-generator';

const CLI_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(CLI_ROOT, '..', '..');
const SRC = path.join(CLI_ROOT, 'src');

/** Recursively list every file under `dir`. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Files under src/ whose content matches `pattern`, as repo-relative paths. */
function filesMatching(pattern: RegExp, exclude: string[] = []): string[] {
  return walk(SRC)
    .filter(file => !exclude.includes(path.relative(SRC, file)))
    .filter(file => pattern.test(fs.readFileSync(file, 'utf8')))
    .map(file => path.relative(CLI_ROOT, file));
}

describe('brand constants', () => {
  it('points at the GitHub Pages site and the real repository', () => {
    expect(SITE_ORIGIN).toBe('https://umutkorkmaz.github.io');
    expect(SITE_BASE_PATH).toBe('/re-shell');
    expect(SITE_URL).toBe('https://umutkorkmaz.github.io/re-shell');
    expect(DOCS_URL).toBe(SITE_URL);
    expect(REPO_URL).toBe('https://github.com/UmutKorkmaz/re-shell');
    expect(ISSUES_URL).toBe(`${REPO_URL}/issues`);
    expect(RELEASES_URL).toBe(`${REPO_URL}/releases`);
  });

  it('serves the schema from the site at a stable, https URL', () => {
    expect(SCHEMA_URL).toBe('https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json');
    const url = new URL(SCHEMA_URL);
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toBe(`${SITE_BASE_PATH}/schemas/workspace-v2.json`);
  });

  it('builds docs page URLs with a single trailing slash', () => {
    expect(docsUrl('cli/workspace')).toBe(`${SITE_URL}/cli/workspace/`);
    expect(docsUrl('/cli/workspace/')).toBe(`${SITE_URL}/cli/workspace/`);
    expect(docsUrl('')).toBe(`${SITE_URL}/`);
  });

  it('lists the workspace file names the CLI loads', () => {
    expect([...WORKSPACE_FILE_NAMES]).toEqual(['re-shell.workspaces.yaml', 're-shell.workspaces.yml']);
  });
});

describe('schema $id', () => {
  it('the canonical schema $id is the hosted SCHEMA_URL', () => {
    expect(canonicalSchema.$id).toBe(SCHEMA_URL);
  });

  it('the IDE schema and the SCHEMA_ID alias use the same URL', () => {
    expect(SCHEMA_ID).toBe(SCHEMA_URL);
    expect(getIdeSchema().$id).toBe(SCHEMA_URL);
  });
});

describe('docs site publishes the schema from the single source', () => {
  it('astro.config.mjs takes site/base/repo from the brand constants (no retyped URLs)', () => {
    const config = fs.readFileSync(path.join(REPO_ROOT, 'site', 'astro.config.mjs'), 'utf8');
    expect(config).toContain("from '../packages/cli/src/constants/brand.ts'");
    expect(config).toMatch(/site:\s*SITE_ORIGIN/);
    expect(config).toMatch(/base:\s*SITE_BASE_PATH/);
    expect(config).not.toMatch(/umutkorkmaz\.github\.io/i);
  });

  it('the schema endpoint serves the canonical schema, identical apart from the pinned $id', async () => {
    // Import the real Astro endpoint and call it, exactly as `astro build` does.
    const endpointPath = path.join(REPO_ROOT, 'site', 'src', 'pages', 'schemas', 'workspace-v2.json.ts');
    expect(fs.existsSync(endpointPath)).toBe(true);
    const { GET } = (await import(endpointPath)) as { GET: () => Response };

    const res = GET();
    expect(res.headers.get('content-type')).toContain('json');
    const body = JSON.parse(await res.text()) as Record<string, unknown>;

    expect(body.$id).toBe(SCHEMA_URL);
    expect(body).toEqual({ ...canonicalSchema, $id: SCHEMA_URL });
    // ...and it is exactly what `config schema publish` writes to disk.
    expect(body).toEqual(getIdeSchema());
  });
});

describe('no stale brand URLs in the CLI source', () => {
  it('has no re-shell.dev (or schemas.umutkorkmaz.dev) URL anywhere in packages/cli/src', () => {
    expect(filesMatching(/re-shell\.dev|umutkorkmaz\.dev/i)).toEqual([]);
  });

  it('has no github.com/<owner>/re-shell-cli URL anywhere in packages/cli/src', () => {
    expect(filesMatching(/github\.com\/[^/\s]+\/re-shell-cli/i)).toEqual([]);
  });

  it('retypes the site and repo URLs only in constants/brand.ts (and the schema $id)', () => {
    const offenders = filesMatching(
      /umutkorkmaz\.github\.io|github\.com\/umutkorkmaz\/re-shell(?![\w-])/i,
      [path.join('constants', 'brand.ts'), path.join('schemas', 'workspace-v2.schema.json')]
    );
    expect(offenders).toEqual([]);
  });

  it('README.md carries no re-shell.dev or re-shell-cli GitHub URLs', () => {
    for (const file of ['README.md']) {
      const content = fs.readFileSync(path.join(CLI_ROOT, file), 'utf8');
      expect(content, file).not.toMatch(/re-shell\.dev/i);
      expect(content, file).not.toMatch(/github\.com\/[^/\s)]+\/re-shell-cli/i);
      expect(content, file).not.toMatch(/shields\.io\/[^\s)]*re-shell-cli/i);
    }
  });
});
