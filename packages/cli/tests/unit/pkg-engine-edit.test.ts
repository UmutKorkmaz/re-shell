import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  editGradleAdd,
  editGradleRemove,
  editPomAdd,
  editPomRemove,
  editRequirementsAdd,
  editRequirementsRemove,
} from '../../src/pkg/manifest-edit';
import { parsePomXml, parseGradleBuild, parseRequirementsTxt } from '../../src/pkg/manifests';
import { runPkgOperation as realRun, type PkgRunInput } from '../../src/pkg/engine';
import type { ExecResult, Executor } from '../../src/pkg/exec';
import { PkgError } from '../../src/pkg/types';
import { pkgResponseSchema } from '@re-shell/contracts';


// Fake toolchains: empty executables on a private PATH so these tests do not
// depend on which package managers happen to be installed on the machine.
let shimDir = '';
beforeAll(() => {
  shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-pkg-shims-'));
  for (const tool of ['npm', 'go', 'mvn', 'bundle', 'cargo', 'python3', 'python', 'gradle']) {
    const f = path.join(shimDir, tool);
    fs.writeFileSync(f, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(f, 0o755);
  }
});
afterAll(() => fs.rmSync(shimDir, { recursive: true, force: true }));
const runPkgOperation = (input: PkgRunInput) => realRun({ env: { PATH: shimDir }, ...input });

const FIX = path.resolve(__dirname, '..', 'fixtures', 'pkg');

function copyFixture(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rs-pkg-${name}-`));
  fs.cpSync(path.join(FIX, name), dir, { recursive: true });
  return dir;
}

const ok = (stdout = ''): ExecResult => ({ exitCode: 0, stdout, stderr: '', durationMs: 1 });

/** Executor that records calls and returns scripted results. */
function scripted(results: Array<ExecResult | ((argv: string[]) => ExecResult)> = []): {
  executor: Executor;
  calls: string[][];
} {
  const calls: string[][] = [];
  let i = 0;
  const executor: Executor = async cmd => {
    calls.push(cmd.argv);
    const r = results[Math.min(i++, results.length - 1)] ?? ok();
    return typeof r === 'function' ? r(cmd.argv) : r;
  };
  return { executor, calls };
}

describe('requirements.txt edits', () => {
  it('appends new, replaces existing by normalized name, preserves comments', () => {
    const src = '# deps\nFlask_SQLAlchemy==2.0\nrequests==1.0\n';
    const r = editRequirementsAdd(src, ['flask-sqlalchemy==3.1', 'six']);
    expect(r.changed).toBe(true);
    expect(r.content).toBe('# deps\nflask-sqlalchemy==3.1\nrequests==1.0\nsix\n');
  });

  it('is a no-op when the identical spec exists', () => {
    expect(editRequirementsAdd('six==1.0\n', ['six==1.0']).changed).toBe(false);
  });

  it('creates content from nothing', () => {
    expect(editRequirementsAdd('', ['a==1']).content).toBe('a==1\n');
  });

  it('rejects an invalid requirement', () => {
    expect(() => editRequirementsAdd('', ['!!!'])).toThrow(PkgError);
  });

  it('removes by name regardless of version/case/separator', () => {
    const r = editRequirementsRemove('# c\nFoo_Bar==1\nbaz\n-r other.txt\n', ['foo-bar', 'qux']);
    expect(r.changed).toBe(true);
    expect(r.content).toBe('# c\nbaz\n-r other.txt\n');
  });
});

describe('pom.xml edits', () => {
  const pom = fs.readFileSync(path.join(FIX, 'maven', 'pom.xml'), 'utf8');

  it('adds a dependency into the project-level <dependencies> (not plugin/management)', () => {
    const r = editPomAdd(pom, ['org.apache.commons:commons-lang3:3.14.0'], false);
    expect(r.changed).toBe(true);
    const names = parsePomXml(r.content).map(d => d.name);
    expect(names).toContain('org.apache.commons:commons-lang3');
    expect(names).toContain('com.google.guava:guava');
    // management + plugin dependencies untouched
    expect(r.content).toContain('<artifactId>managed</artifactId>');
    expect(r.content).toContain('<groupId>plugin.only</groupId>');
    expect((r.content.match(/<artifactId>commons-lang3<\/artifactId>/g) ?? []).length).toBe(1);
  });

  it('adds with test scope when dev', () => {
    const r = editPomAdd(pom, ['org.mockito:mockito-core:5.11.0'], true);
    const dep = parsePomXml(r.content).find(d => d.name === 'org.mockito:mockito-core');
    expect(dep).toMatchObject({ requested: '5.11.0', kind: 'dev' });
  });

  it('updates the version of an existing dependency instead of duplicating it', () => {
    const r = editPomAdd(pom, ['com.google.guava:guava:33.2.0-jre'], false);
    const guava = parsePomXml(r.content).filter(d => d.name === 'com.google.guava:guava');
    expect(guava).toHaveLength(1);
    expect(guava[0].requested).toBe('33.2.0-jre');
  });

  it('is a no-op for an identical existing dependency', () => {
    expect(editPomAdd(pom, ['com.google.guava:guava:33.0.0-jre'], false).changed).toBe(false);
  });

  it('creates a <dependencies> block when the pom has none', () => {
    const bare = '<project>\n  <modelVersion>4.0.0</modelVersion>\n</project>\n';
    const r = editPomAdd(bare, ['a:b:1'], false);
    expect(parsePomXml(r.content)).toEqual([
      { name: 'a:b', requested: '1', kind: 'prod', ecosystem: 'maven', manifest: 'pom.xml' },
    ]);
    expect(r.content.trim().endsWith('</project>')).toBe(true);
  });

  it('matches the existing indentation unit', () => {
    const bare = '<project>\n  <modelVersion>4.0.0</modelVersion>\n  <dependencies>\n  </dependencies>\n</project>\n';
    const r = editPomAdd(bare, ['a:b:1'], false);
    expect(r.content).toContain('\n    <dependency>\n      <groupId>a</groupId>');
  });

  it('requires a version for add', () => {
    expect(() => editPomAdd(pom, ['org.x:y'], false)).toThrow(/version is required/);
    expect(() => editPomAdd(pom, ['nonsense'], false)).toThrow(/groupId:artifactId/);
  });

  it('removes a dependency and leaves valid XML with the others intact', () => {
    const r = editPomRemove(pom, ['com.google.guava:guava']);
    expect(r.changed).toBe(true);
    const names = parsePomXml(r.content).map(d => d.name);
    expect(names).not.toContain('com.google.guava:guava');
    expect(names).toContain('org.slf4j:slf4j-api');
    expect(r.content).toContain('<groupId>plugin.only</groupId>');
  });

  it('remove of a missing dependency is a no-op; plugin-only deps are not removable', () => {
    expect(editPomRemove(pom, ['no.such:thing']).changed).toBe(false);
    expect(editPomRemove(pom, ['plugin.only:dep']).changed).toBe(false);
  });
});

describe('gradle edits', () => {
  const groovy = fs.readFileSync(path.join(FIX, 'gradle', 'build.gradle'), 'utf8');
  const kts = fs.readFileSync(path.join(FIX, 'gradle-kts', 'build.gradle.kts'), 'utf8');

  it('adds into the dependencies block (groovy)', () => {
    const r = editGradleAdd(groovy, ['org.slf4j:slf4j-api:2.0.12'], false, false);
    expect(r.content).toContain("    implementation 'org.slf4j:slf4j-api:2.0.12'\n}");
    expect(parseGradleBuild(r.content).map(d => d.name)).toContain('org.slf4j:slf4j-api');
  });

  it('adds testImplementation for dev (kotlin dsl)', () => {
    const r = editGradleAdd(kts, ['org.assertj:assertj-core:3.25.3'], true, true);
    expect(r.content).toContain('    testImplementation("org.assertj:assertj-core:3.25.3")');
    const dep = parseGradleBuild(r.content, 'build.gradle.kts').find(d => d.name === 'org.assertj:assertj-core');
    expect(dep?.kind).toBe('dev');
  });

  it('replaces an existing declaration with a new version', () => {
    const r = editGradleAdd(groovy, ['com.google.guava:guava:33.2.0-jre'], false, false);
    expect(r.content).toContain("implementation 'com.google.guava:guava:33.2.0-jre'");
    expect(r.content).not.toContain('33.0.0-jre');
  });

  it('appends a dependencies block when absent', () => {
    const r = editGradleAdd("plugins { id 'java' }\n", ['a:b:1'], false, false);
    expect(r.content).toContain("dependencies {\n    implementation 'a:b:1'\n}");
  });

  it('removes declarations by group:artifact', () => {
    const r = editGradleRemove(groovy, ['com.google.guava:guava']);
    expect(r.changed).toBe(true);
    expect(r.content).not.toContain('guava');
    expect(r.content).toContain('commons-lang3');
    expect(editGradleRemove(groovy, ['no:such']).changed).toBe(false);
  });
});

describe('runPkgOperation (injected executor)', () => {
  it('dry-run executes nothing and reports commands + planned edits', async () => {
    const dir = copyFixture('maven');
    const { executor, calls } = scripted();
    const res = await runPkgOperation({
      operation: 'add',
      packages: ['org.mockito:mockito-core:5.11.0'],
      dir,
      dev: true,
      dryRun: true,
      executor,
    });
    expect(calls).toEqual([]);
    expect(res.dryRun).toBe(true);
    expect(res.commands).toEqual([
      expect.objectContaining({ argv: ['mvn', '-B', 'dependency:resolve'], executed: false, exitCode: null }),
    ]);
    expect(res.manifestEdits).toEqual([expect.objectContaining({ applied: false, changed: true })]);
    // file untouched
    expect(fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8')).not.toContain('mockito');
    expect(pkgResponseSchema.safeParse(res).success).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('missing toolchain is an explicit PKG_TOOLCHAIN_MISSING error before anything runs', async () => {
    const dir = copyFixture('dotnet');
    const { executor, calls } = scripted();
    await expect(
      runPkgOperation({ operation: 'add', packages: ['Serilog'], dir, executor, env: { PATH: '/nonexistent-dir' } })
    ).rejects.toMatchObject({ code: 'PKG_TOOLCHAIN_MISSING', details: { tool: 'dotnet', ecosystem: 'dotnet' } });
    expect(calls).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('missing toolchain does not touch manifests (maven edit is deferred behind the check)', async () => {
    const dir = copyFixture('maven');
    const before = fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8');
    await expect(
      runPkgOperation({ operation: 'add', packages: ['a:b:1'], dir, env: { PATH: '/nonexistent-dir' } })
    ).rejects.toMatchObject({ code: 'PKG_TOOLCHAIN_MISSING' });
    expect(fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8')).toBe(before);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('a failing native command becomes PKG_COMMAND_FAILED with argv/exit/stderr details', async () => {
    const dir = copyFixture('go');
    const { executor } = scripted([{ exitCode: 3, stdout: '', stderr: 'go: boom', durationMs: 1 }]);
    await expect(
      runPkgOperation({ operation: 'add', packages: ['example.com/x@v1'], dir, executor })
    ).rejects.toMatchObject({
      code: 'PKG_COMMAND_FAILED',
      details: { argv: ['go', 'get', 'example.com/x@v1'], exitCode: 3, stderr: 'go: boom' },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rolls back a maven pom edit when the follow-up resolve fails', async () => {
    const dir = copyFixture('maven');
    const before = fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8');
    const { executor } = scripted([{ exitCode: 1, stdout: '', stderr: 'could not resolve', durationMs: 1 }]);
    await expect(
      runPkgOperation({ operation: 'add', packages: ['no.such:artifact:9.9.9'], dir, executor })
    ).rejects.toMatchObject({ code: 'PKG_COMMAND_FAILED' });
    expect(fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8')).toBe(before);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('maven add keeps the edit when resolve succeeds', async () => {
    const dir = copyFixture('maven');
    const { executor, calls } = scripted([ok()]);
    const res = await runPkgOperation({ operation: 'add', packages: ['org.apache.commons:commons-lang3:3.14.0'], dir, executor });
    expect(calls).toEqual([['mvn', '-B', 'dependency:resolve']]);
    expect(res.manifestEdits[0]).toMatchObject({ applied: true, changed: true });
    expect(fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8')).toContain('commons-lang3');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('pip records requirements only after the install succeeded', async () => {
    const dir = copyFixture('pip');
    const failing = scripted([{ exitCode: 1, stdout: '', stderr: 'ERROR: No matching distribution', durationMs: 1 }]);
    await expect(runPkgOperation({ operation: 'add', packages: ['nosuchpkg'], dir, executor: failing.executor })).rejects.toMatchObject({
      code: 'PKG_COMMAND_FAILED',
    });
    expect(fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf8')).not.toContain('nosuchpkg');

    const good = scripted([ok()]);
    const res = await runPkgOperation({ operation: 'add', packages: ['six==1.16.0'], dir, executor: good.executor });
    expect(fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf8')).toContain('six==1.16.0');
    expect(res.warnings.join(' ')).toMatch(/global interpreter/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('pip: invalid requirement is rejected before pip runs', async () => {
    const dir = copyFixture('pip');
    const { executor, calls } = scripted();
    await expect(runPkgOperation({ operation: 'add', packages: ['!!bad'], dir, executor })).rejects.toBeInstanceOf(PkgError);
    expect(calls).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('"No module named pip" maps to PKG_TOOLCHAIN_MISSING', async () => {
    const dir = copyFixture('pip');
    const { executor } = scripted([{ exitCode: 1, stdout: '', stderr: '/usr/bin/python3: No module named pip', durationMs: 1 }]);
    await expect(runPkgOperation({ operation: 'outdated', dir, executor })).rejects.toMatchObject({
      code: 'PKG_TOOLCHAIN_MISSING',
      details: { tool: 'pip' },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cargo outdated without the plugin maps to PKG_TOOLCHAIN_MISSING with an install hint', async () => {
    const dir = copyFixture('cargo');
    const { executor } = scripted([{ exitCode: 101, stdout: '', stderr: "error: no such command: `outdated`", durationMs: 1 }]);
    await expect(runPkgOperation({ operation: 'outdated', dir, executor })).rejects.toMatchObject({
      code: 'PKG_TOOLCHAIN_MISSING',
      details: { tool: 'cargo-outdated', hint: expect.stringContaining('cargo install cargo-outdated') },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('outdated: exit code 1 is success for npm-style tools; output is normalized and enriched with manifest kinds', async () => {
    const dir = copyFixture('npm');
    const { executor } = scripted([
      {
        exitCode: 1,
        stdout: JSON.stringify({
          typescript: { current: '5.4.0', wanted: '5.4.5', latest: '5.9.0' },
          express: { current: '4.18.2', wanted: '4.21.0', latest: '5.0.0' },
        }),
        stderr: '',
        durationMs: 1,
      },
    ]);
    const res = await runPkgOperation({ operation: 'outdated', dir, executor });
    expect(res.outdated.map(o => [o.name, o.kind])).toEqual([
      ['typescript', 'dev'],
      ['express', 'prod'],
    ]);
    expect(pkgResponseSchema.safeParse(res).success).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('outdated: exit code outside okExitCodes (npm exit 2) is a failure', async () => {
    const dir = copyFixture('npm');
    const { executor } = scripted([{ exitCode: 2, stdout: '', stderr: 'registry down', durationMs: 1 }]);
    await expect(runPkgOperation({ operation: 'outdated', dir, executor })).rejects.toMatchObject({ code: 'PKG_COMMAND_FAILED' });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('outdated: unparseable tool output is a PKG_ERROR, never an empty "up to date" report', async () => {
    const dir = copyFixture('npm');
    const { executor } = scripted([ok('<html>proxy error</html>')]);
    await expect(runPkgOperation({ operation: 'outdated', dir, executor })).rejects.toMatchObject({ code: 'PKG_ERROR' });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('pip/uv outdated is restricted to direct dependencies from the manifest', async () => {
    const dir = copyFixture('pip');
    const { executor } = scripted([
      ok(JSON.stringify([
        { name: 'requests', version: '2.31.0', latest_version: '2.32.3' },
        { name: 'urllib3', version: '1.0', latest_version: '2.0' },
      ])),
    ]);
    const res = await runPkgOperation({ operation: 'outdated', dir, executor });
    expect(res.outdated.map(o => o.name)).toEqual(['requests']);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('list reads manifests without spawning anything', async () => {
    const dir = copyFixture('cargo');
    const { executor, calls } = scripted();
    const res = await runPkgOperation({ operation: 'list', dir, executor });
    expect(calls).toEqual([]);
    expect(res.dependencies.map(d => d.name)).toContain('serde');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs multiple commands in order and stops at the first failure', async () => {
    const dir = copyFixture('bundler');
    const { executor, calls } = scripted([ok(), { exitCode: 7, stdout: '', stderr: 'nope', durationMs: 1 }, ok()]);
    await expect(
      runPkgOperation({ operation: 'add', packages: ['a', 'b', 'c'], dir, executor })
    ).rejects.toMatchObject({ code: 'PKG_COMMAND_FAILED', details: { exitCode: 7 } });
    expect(calls.map(c => c[2])).toEqual(['a', 'b']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('gradle resolve failure detection', () => {
  it('treats FAILED in `gradle dependencies` output as a failure even with exit 0 and rolls the edit back', async () => {
    const dir = copyFixture('gradle');
    const before = fs.readFileSync(path.join(dir, 'build.gradle'), 'utf8');
    const { executor } = scripted([ok('testCompileClasspath\n\\--- no.such:artifact:1.0 FAILED\n')]);
    await expect(
      runPkgOperation({ operation: 'add', packages: ['no.such:artifact:1.0'], dir, executor })
    ).rejects.toMatchObject({ code: 'PKG_COMMAND_FAILED', message: expect.stringContaining('unresolved dependencies') });
    expect(fs.readFileSync(path.join(dir, 'build.gradle'), 'utf8')).toBe(before);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the edit when resolution is clean', async () => {
    const dir = copyFixture('gradle');
    const { executor } = scripted([ok('testCompileClasspath\n+--- junit:junit:4.13.2\n')]);
    await runPkgOperation({ operation: 'add', packages: ['junit:junit:4.13.2'], dir, executor });
    expect(fs.readFileSync(path.join(dir, 'build.gradle'), 'utf8')).toContain('junit:junit:4.13.2');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('requirements parsing roundtrip', () => {
  it('parseRequirementsTxt sees what editRequirementsAdd wrote', () => {
    const r = editRequirementsAdd('', ['flask>=2', 'requests[socks]==2.0']);
    expect(parseRequirementsTxt(r.content, 'prod').map(d => [d.name, d.requested])).toEqual([
      ['flask', '>=2'],
      ['requests', '==2.0'],
    ]);
  });
});
