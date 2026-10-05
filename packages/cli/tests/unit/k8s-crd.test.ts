import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import { jsonResponseSchema, k8sCrdResponseSchema } from '@re-shell/contracts';

import workspaceSchema from '../../src/schemas/workspace-v2.schema.json';
import {
  buildCrd,
  generateCrd,
  toStructural,
  CRD_KIND,
  DEFAULT_CRD_GROUP,
  DEFAULT_CRD_VERSION,
} from '../../src/utils/k8s-crd';
import { runK8sCrd } from '../../src/commands/k8s-crd';
import { captureEnvelope, inTmp, workspaceInTmp } from '../helpers/k8s-test-utils';

type Node = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The structural-schema rules of apiextensions.k8s.io/v1, checked over a whole schema. */
function structuralViolations(node: Node, where = '$'): string[] {
  const problems: string[] = [];
  const specialType =
    node['x-kubernetes-int-or-string'] === true || node['x-kubernetes-preserve-unknown-fields'] === true;
  if (!node.type && !specialType) problems.push(`${where}: missing type`);
  for (const forbidden of ['$ref', '$schema', '$id', 'definitions', 'title', 'oneOf', 'anyOf', 'allOf', 'not', 'format_']) {
    if (forbidden in node) problems.push(`${where}: forbidden keyword ${forbidden}`);
  }
  if (node.properties && node.additionalProperties && typeof node.additionalProperties === 'object') {
    problems.push(`${where}: properties and additionalProperties together`);
  }
  // The root `metadata` is the one free-form object structural schemas allow.
  if (
    node.type === 'object' &&
    !node.properties &&
    !node.additionalProperties &&
    !specialType &&
    where !== '$.metadata'
  ) {
    problems.push(`${where}: free-form object without x-kubernetes-preserve-unknown-fields`);
  }
  for (const [name, child] of Object.entries<Node>(node.properties ?? {})) {
    problems.push(...structuralViolations(child, `${where}.${name}`));
  }
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    problems.push(...structuralViolations(node.additionalProperties, `${where}.*`));
  }
  if (node.items) problems.push(...structuralViolations(node.items, `${where}[]`));
  for (const req of node.required ?? []) {
    if (!(node.properties && req in node.properties)) problems.push(`${where}: required "${req}" is not a property`);
  }
  return problems;
}

describe('k8s-crd: schema translation (workspace-v2 -> structural)', () => {
  const root = workspaceSchema as unknown as Node;

  it('translates the entire workspace schema into a structural schema', () => {
    const { crd } = buildCrd();
    const schema = crd.spec.versions[0].schema.openAPIV3Schema as Node;
    expect(structuralViolations(schema)).toEqual([]);
  });

  it('inlines $ref definitions (service, deployment, kubernetesConfig, ...)', () => {
    const spec = buildCrd().crd.spec.versions[0].schema.openAPIV3Schema.properties.spec as Node;
    const service = spec.properties.services.additionalProperties as Node;
    expect(service.type).toBe('object');
    expect(service.required).toEqual(['name', 'language', 'framework']);
    expect(service.properties.language.enum).toContain('typescript');
    expect(service.properties.kubernetes.properties.securityContext.properties.readOnlyRootFilesystem).toEqual({
      type: 'boolean',
    });
    expect(service.properties.healthCheck.properties.path.type).toBe('string');
    expect(JSON.stringify(spec)).not.toContain('$ref');
  });

  it('is DERIVED: every property of the workspace schema appears under spec, with its constraints', () => {
    const spec = buildCrd().crd.spec.versions[0].schema.openAPIV3Schema.properties.spec as Node;
    expect(Object.keys(spec.properties).sort()).toEqual(Object.keys(root.properties).sort());
    expect(spec.required).toEqual(root.required);
    expect(spec.properties.name.pattern).toBe((root.properties as Node).name.pattern);
    expect(spec.properties.version.pattern).toBe((root.properties as Node).version.pattern);
    const port = spec.properties.services.additionalProperties.properties.port;
    expect(port).toMatchObject({ type: 'integer', minimum: 1024, maximum: 65535 });
  });

  it('maps int-or-string unions (maxSurge/minAvailable) to x-kubernetes-int-or-string', () => {
    const k8s = buildCrd().crd.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.kubernetes as Node;
    expect(k8s.properties.strategy.properties.maxSurge['x-kubernetes-int-or-string']).toBe(true);
    expect(k8s.properties.strategy.properties.maxSurge.type).toBeUndefined();
    expect(k8s.properties.pdb.properties.minAvailable['x-kubernetes-int-or-string']).toBe(true);
  });

  it('keeps mixed-type unions (framework: string | object) and free-form objects as preserve-unknown-fields', () => {
    const spec = buildCrd().crd.spec.versions[0].schema.openAPIV3Schema.properties.spec as Node;
    const framework = spec.properties.services.additionalProperties.properties.framework as Node;
    expect(framework['x-kubernetes-preserve-unknown-fields']).toBe(true);
    expect(framework.description).toMatch(/string \| object/);
    expect(spec.properties.variables.additionalProperties['x-kubernetes-preserve-unknown-fields']).toBe(true);
  });

  it('infers a type for enum-only nodes (monitoring alert severity)', () => {
    const spec = buildCrd().crd.spec.versions[0].schema.openAPIV3Schema.properties.spec as Node;
    const severity = spec.properties.monitoring.properties.alerts.items.properties.severity as Node;
    expect(severity).toEqual({ type: 'string', enum: ['info', 'warning', 'critical'] });
  });

  it('drops additionalProperties:false and format, which structural schemas cannot carry', () => {
    const out = toStructural(
      {
        type: 'object',
        properties: { uri: { type: 'string', format: 'uri' } },
        additionalProperties: false,
      },
      {}
    );
    expect(out).toEqual({ type: 'object', properties: { uri: { type: 'string' } } });
  });

  it('refuses cyclic references instead of looping', () => {
    const cyclic = { definitions: { a: { $ref: '#/definitions/b' }, b: { $ref: '#/definitions/a' } } };
    expect(() => toStructural({ $ref: '#/definitions/a' }, cyclic)).toThrow(/Cyclic \$ref/);
    expect(() => toStructural({ $ref: '#/definitions/missing' }, cyclic)).toThrow(/Unresolvable/);
    expect(() => toStructural({ $ref: 'http://x/y.json' }, cyclic)).toThrow(/Unsupported \$ref/);
  });
});

describe('k8s-crd: ReShellWorkspace CRD', () => {
  it('has the expected identity, subresources and printer columns', () => {
    const { identity, crd } = buildCrd();
    expect(identity).toMatchObject({
      name: 'reshellworkspaces.re-shell.io',
      group: DEFAULT_CRD_GROUP,
      version: DEFAULT_CRD_VERSION,
      kind: CRD_KIND,
      plural: 'reshellworkspaces',
      scope: 'Namespaced',
    });
    expect(crd.apiVersion).toBe('apiextensions.k8s.io/v1');
    expect(crd.kind).toBe('CustomResourceDefinition');
    expect(crd.metadata.name).toBe(identity.name);
    const version = crd.spec.versions[0] as Node;
    expect(version).toMatchObject({ name: 'v1alpha1', served: true, storage: true, subresources: { status: {} } });
    expect(version.additionalPrinterColumns.map((c: Node) => c.name)).toEqual(['Version', 'Phase', 'Age']);
    expect(crd.spec.names).toMatchObject({ kind: 'ReShellWorkspace', shortNames: ['rsw'] });
  });

  it('group and version are configurable', () => {
    const { identity, crd } = buildCrd({ group: 'example.com', version: 'v1beta1' });
    expect(identity.name).toBe('reshellworkspaces.example.com');
    expect(crd.spec.group).toBe('example.com');
    expect(crd.spec.versions[0].name).toBe('v1beta1');
  });

  it('carries the CEL rule that mirrors the parser (service name must match its key)', () => {
    const spec = buildCrd().crd.spec.versions[0].schema.openAPIV3Schema.properties.spec as Node;
    expect(spec['x-kubernetes-validations']).toEqual([
      {
        rule: 'self.services.all(k, self.services[k].name == k)',
        message: 'each service name must match its key under services',
      },
    ]);
    expect(spec.properties.services.maxProperties).toBe(256);
    expect(spec.properties.services.additionalProperties.properties.name.maxLength).toBe(63);
  });

  it('defines a status schema the operator populates', () => {
    const status = buildCrd().crd.spec.versions[0].schema.openAPIV3Schema.properties.status as Node;
    expect(Object.keys(status.properties)).toEqual(['observedGeneration', 'phase', 'services', 'conditions']);
    expect(status.properties.phase.enum).toEqual(['Pending', 'Progressing', 'Ready', 'Degraded']);
  });

  it('stays well below the 256KiB limit of the last-applied annotation', () => {
    expect(yaml.dump(buildCrd().crd).length).toBeLessThan(200 * 1024);
  });
});

describe('k8s-crd: sample resource derived from the workspace', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('the CR spec IS the workspace document, named after it', async () => {
    tmpDir = await inTmp();
    const result = generateCrd({ cwd: tmpDir, namespace: 'apps' });
    const sample = yaml.load(result.files.find(f => f.kind === CRD_KIND)!.yaml) as Node;
    expect(sample.apiVersion).toBe('re-shell.io/v1alpha1');
    expect(sample.kind).toBe('ReShellWorkspace');
    expect(sample.metadata).toEqual({ name: 'k8s-demo', namespace: 'apps' });
    expect(sample.spec.name).toBe('k8s-demo');
    expect(Object.keys(sample.spec.services)).toEqual(['api', 'worker']);
    expect(sample.spec.services.api.port).toBe(3000);
  });

  // The structural schema is plain OpenAPI v3, so ajv can validate CRs against it.
  function compile(): ReturnType<Ajv['compile']> {
    const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    return ajv.compile(buildCrd().crd.spec.versions[0].schema.openAPIV3Schema);
  }

  it('validates against the derived CRD schema', async () => {
    tmpDir = await inTmp();
    const result = generateCrd({ cwd: tmpDir });
    const sample = yaml.load(result.files.find(f => f.kind === CRD_KIND)!.yaml);
    const validate = compile();
    expect(validate(sample), JSON.stringify(validate.errors)).toBe(true);
  });

  it('the repository live-check workspace (every kubernetes setting) validates too', async () => {
    const live = path.resolve(__dirname, '../../../../scripts/k8s-live/workspace');
    const result = generateCrd({ cwd: live });
    const validate = compile();
    expect(validate(yaml.load(result.files.find(f => f.kind === CRD_KIND)!.yaml))).toBe(true);
  });

  it('rejects documents the workspace schema rejects (bad language, bad port, bad kubernetes setting)', async () => {
    tmpDir = await inTmp();
    const sample = yaml.load(
      generateCrd({ cwd: tmpDir }).files.find(f => f.kind === CRD_KIND)!.yaml
    ) as Node;
    const validate = compile();

    const badLanguage = JSON.parse(JSON.stringify(sample));
    badLanguage.spec.services.api.language = 'cobol';
    expect(validate(badLanguage)).toBe(false);

    const badPort = JSON.parse(JSON.stringify(sample));
    badPort.spec.services.api.port = 80;
    expect(validate(badPort)).toBe(false);

    const badStrategy = JSON.parse(JSON.stringify(sample));
    badStrategy.spec.services.api.kubernetes = { strategy: { type: 'BlueGreen' } };
    expect(validate(badStrategy)).toBe(false);

    const missingServices = JSON.parse(JSON.stringify(sample));
    delete missingServices.spec.services;
    expect(validate(missingServices)).toBe(false);
  });

  it('accepts the kubernetes block overrides (probes, securityContext, int-or-string)', async () => {
    tmpDir = await workspaceInTmp(`name: k
version: 2.0.0
kubernetes:
  securityContext: { runAsUser: 2000 }
services:
  api:
    name: api
    language: go
    framework: gin
    port: 8080
    kubernetes:
      strategy: { maxSurge: "25%", maxUnavailable: 0 }
      probes: { liveness: { path: /live, periodSeconds: 5 } }
      pdb: { minAvailable: "50%" }
`);
    const sample = yaml.load(generateCrd({ cwd: tmpDir }).files.find(f => f.kind === CRD_KIND)!.yaml);
    const validate = compile();
    expect(validate(sample), JSON.stringify(validate.errors)).toBe(true);
  });

  it('throws when there is no workspace config', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crd-empty-'));
    expect(() => generateCrd({ cwd: tmpDir })).toThrow(/No workspace v2 config/);
  });
});

// kubeconform has no schema for apiextensions.k8s.io CustomResourceDefinition (neither
// the core nor the CRD catalogue ships one), so the CRD itself is validated by a real
// API server in scripts/k8s-live-check.sh (kubectl apply --server-side + CEL rule checks).
// Offline, the structural-schema invariants above are the guard.

describe('k8s-crd: command layer', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  const envelopeSchema = jsonResponseSchema(k8sCrdResponseSchema);

  it('--json emits an ok envelope matching the contract; nothing is written without --out', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{ ok: boolean; data: { crd: Node; manifests: Node[]; written: string[]; kubectl: Node } }>(
      () => runK8sCrd({ json: true, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(envelopeSchema.safeParse(env).success).toBe(true);
    expect(env.data.crd.name).toBe('reshellworkspaces.re-shell.io');
    expect(env.data.manifests.map(m => m.kind)).toEqual(['CustomResourceDefinition', 'ReShellWorkspace']);
    expect(env.data.written).toEqual([]);
    expect(typeof env.data.kubectl.ran).toBe('boolean');
  });

  it('--out writes the CRD and the sample; --dry-run writes nothing', async () => {
    tmpDir = await inTmp();
    const out = path.join(tmpDir, 'out');
    const dry = await captureEnvelope<{ ok: boolean; data: { written: string[] } }>(() =>
      runK8sCrd({ json: true, cwd: tmpDir, out, dryRun: true })
    );
    expect(dry.data.written).toEqual([]);
    expect(fs.existsSync(out)).toBe(false);

    const real = await captureEnvelope<{ ok: boolean; data: { written: string[] } }>(() =>
      runK8sCrd({ json: true, cwd: tmpDir, out, namespace: 'apps' })
    );
    expect(real.data.written.map(f => path.relative(out, f)).sort()).toEqual([
      'crd/reshellworkspaces.re-shell.io.yaml',
      'samples/k8s-demo.yaml',
    ]);
    const written = yaml.load(fs.readFileSync(real.data.written.find(f => f.includes('samples'))!, 'utf8')) as Node;
    expect(written.metadata.namespace).toBe('apps');
  });

  it('--json on a config-less dir emits K8S_CRD_ERROR and exit 1', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crd-empty-'));
    const env = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
      runK8sCrd({ json: true, cwd: tmpDir })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('K8S_CRD_ERROR');
    expect(process.exitCode).toBe(1);
  });
});
