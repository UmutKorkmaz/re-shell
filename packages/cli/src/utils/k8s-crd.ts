// ReShellWorkspace CustomResourceDefinition generation (P9-D4).
//
// The CRD's `spec` schema is DERIVED from the canonical workspace v2 JSON
// Schema (workspace-v2.schema.json), not hand-written: the draft-07 document is
// translated into a Kubernetes *structural* schema so a workspace file can be
// applied to a cluster as the `spec` of a ReShellWorkspace and validated by the
// API server. A sample CR is derived from the actual workspace config.
//
// Structural-schema rules the translation enforces (apiextensions.k8s.io/v1):
//   - every node has a `type` (except int-or-string / preserve-unknown nodes)
//   - no `$ref`, `$schema`, `definitions`, `title`, `format` (inlined / dropped)
//   - no `oneOf`/`anyOf` carrying types: scalar int|string unions become
//     `x-kubernetes-int-or-string`; other unions become
//     `x-kubernetes-preserve-unknown-fields` (the shape is documented in the
//     description; CEL cannot guard untyped nodes)
//   - `properties` and `additionalProperties` are mutually exclusive
//   - free-form objects keep their content via `x-kubernetes-preserve-unknown-fields`

import * as yaml from 'js-yaml';

import workspaceSchema from '../schemas/workspace-v2.schema.json';
import { loadWorkspace } from './k8s-config';
import type { WorkspaceConfig } from '../parsers/workspace-parser';

/** Default API group of the generated CRD. */
export const DEFAULT_CRD_GROUP = 're-shell.io';
/** Default served/storage version of the generated CRD. */
export const DEFAULT_CRD_VERSION = 'v1alpha1';
/** Kind of the generated custom resource. */
export const CRD_KIND = 'ReShellWorkspace';
/** Plural resource name. */
export const CRD_PLURAL = 'reshellworkspaces';
/** Singular resource name. */
export const CRD_SINGULAR = 'reshellworkspace';
/** kubectl short name. */
export const CRD_SHORT_NAME = 'rsw';

/** JSON-Schema-ish node used while translating (draft-07 in, structural out). */
type SchemaNode = Record<string, unknown>;

/** Identity of a generated CRD. */
export interface CrdIdentity {
  /** `<plural>.<group>`, the metadata.name of the CRD. */
  name: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  singular: string;
  scope: 'Namespaced';
}

/** Options for {@link buildCrd}. */
export interface BuildCrdOptions {
  /** API group (default `re-shell.io`). */
  group?: string;
  /** API version (default `v1alpha1`). */
  version?: string;
}

/** A CRD plus its identity. */
export interface BuiltCrd {
  identity: CrdIdentity;
  /** The CustomResourceDefinition object. */
  crd: SchemaNode;
}

// Keys copied verbatim from the source schema when present.
const PASS_THROUGH = [
  'description',
  'enum',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'uniqueItems',
  'multipleOf',
  'minProperties',
  'maxProperties',
  'default',
  'nullable',
] as const;

function isObject(value: unknown): value is SchemaNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolve a local `#/definitions/<name>` reference against the root schema. */
function resolveRef(ref: string, root: SchemaNode): SchemaNode {
  const prefix = '#/definitions/';
  if (!ref.startsWith(prefix)) {
    throw new Error(`Unsupported $ref "${ref}" (only #/definitions/* is supported)`);
  }
  const definitions = root.definitions;
  const target = isObject(definitions) ? definitions[ref.slice(prefix.length)] : undefined;
  if (!isObject(target)) throw new Error(`Unresolvable $ref "${ref}"`);
  return target;
}

/** Infer a structural `type` from a literal's JS type. */
function typeOfLiteral(value: unknown): string | undefined {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return undefined;
}

/**
 * Translate one draft-07 schema node into a structural-schema node.
 *
 * @param node - The source node.
 * @param root - The root document (for `$ref` resolution).
 * @param stack - `$ref` names currently being expanded (cycle detection).
 * @returns The structural node.
 * @throws Error for an unsupported/cyclic `$ref`.
 */
export function toStructural(
  node: SchemaNode,
  root: SchemaNode,
  stack: string[] = []
): SchemaNode {
  // $ref: inline (structural schemas forbid references).
  if (typeof node.$ref === 'string') {
    if (stack.includes(node.$ref)) {
      throw new Error(`Cyclic $ref ${[...stack, node.$ref].join(' -> ')} cannot be inlined`);
    }
    const target = resolveRef(node.$ref, root);
    // Sibling keywords of $ref (e.g. description) override the target's.
    const { $ref: _ref, ...siblings } = node;
    return toStructural({ ...target, ...siblings }, root, [...stack, node.$ref]);
  }

  const out: SchemaNode = {};
  for (const key of PASS_THROUGH) {
    if (node[key] !== undefined) out[key] = node[key];
  }

  // Unions.
  const union = (node.oneOf ?? node.anyOf) as unknown;
  if (Array.isArray(union)) {
    const branches = union.map(b =>
      toStructural(isObject(b) ? b : {}, root, stack)
    );
    const types = branches.map(b => b.type).filter((t): t is string => typeof t === 'string');
    const isIntOrString =
      types.length === 2 && types.includes('integer') && types.includes('string');
    if (isIntOrString) {
      out['x-kubernetes-int-or-string'] = true;
    } else {
      // Mixed-type unions (e.g. string | object) cannot be expressed
      // structurally and CEL cannot guard untyped nodes, so the value is kept
      // as-is; the workspace parser / operator validate its shape.
      out['x-kubernetes-preserve-unknown-fields'] = true;
      out.description = [out.description, `One of: ${types.join(' | ')}.`]
        .filter(Boolean)
        .join(' ');
    }
    delete out.type;
    return out;
  }

  // type
  let type = typeof node.type === 'string' ? node.type : undefined;
  if (!type && Array.isArray(node.enum) && node.enum.length > 0) {
    type = typeOfLiteral(node.enum[0]);
  }
  if (!type && isObject(node.properties)) type = 'object';
  if (!type && node.items !== undefined) type = 'array';
  if (type) out.type = type;

  // object
  if (type === 'object' || isObject(node.properties)) {
    const props = isObject(node.properties) ? node.properties : undefined;
    if (props && Object.keys(props).length > 0) {
      const translated: SchemaNode = {};
      for (const [name, child] of Object.entries(props)) {
        translated[name] = toStructural(isObject(child) ? child : {}, root, stack);
      }
      out.properties = translated;
      if (Array.isArray(node.required)) {
        const required = (node.required as string[]).filter(name => name in translated);
        if (required.length > 0) out.required = required;
      }
      // `additionalProperties` alongside `properties` is not structural; unknown
      // fields are pruned instead.
    } else if (isObject(node.additionalProperties)) {
      out.additionalProperties = toStructural(node.additionalProperties, root, stack);
    } else {
      // Free-form object: keep arbitrary content.
      out['x-kubernetes-preserve-unknown-fields'] = true;
    }
  }

  // array
  if (type === 'array') {
    out.items = toStructural(isObject(node.items) ? node.items : {}, root, stack);
  }

  return out;
}

/** Hand-written `status` subresource schema populated by the operator. */
function statusSchema(): SchemaNode {
  return {
    type: 'object',
    description: 'Observed state written by the re-shell operator.',
    properties: {
      observedGeneration: { type: 'integer', format: 'int64' },
      phase: {
        type: 'string',
        description: 'Ready when every service Deployment is available.',
        enum: ['Pending', 'Progressing', 'Ready', 'Degraded'],
      },
      services: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            desiredReplicas: { type: 'integer', format: 'int32' },
            readyReplicas: { type: 'integer', format: 'int32' },
            available: { type: 'boolean' },
          },
        },
      },
      conditions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'status'],
          properties: {
            type: { type: 'string' },
            status: { type: 'string', enum: ['True', 'False', 'Unknown'] },
            reason: { type: 'string' },
            message: { type: 'string' },
            lastTransitionTime: { type: 'string', format: 'date-time' },
            observedGeneration: { type: 'integer', format: 'int64' },
          },
        },
      },
    },
  };
}

/**
 * Build the ReShellWorkspace CRD, deriving `spec` from workspace-v2.schema.json.
 *
 * @param options - API group/version overrides.
 * @returns The CRD object and its identity.
 */
export function buildCrd(options: BuildCrdOptions = {}): BuiltCrd {
  const group = options.group ?? DEFAULT_CRD_GROUP;
  const version = options.version ?? DEFAULT_CRD_VERSION;
  const root = workspaceSchema as unknown as SchemaNode;

  const spec = toStructural(
    {
      type: 'object',
      description:
        'A re-shell workspace v2 document (workspace-v2.schema.json) reconciled into Deployments and Services.',
      required: root.required,
      properties: root.properties,
    },
    root
  );

  // Mirror the parser's custom rule: a service's `name` must equal its map key.
  spec['x-kubernetes-validations'] = [
    {
      rule: 'self.services.all(k, self.services[k].name == k)',
      message: 'each service name must match its key under services',
    },
  ];
  // Bound the map so the CEL cost estimator can accept the rule.
  const services = (spec.properties as SchemaNode | undefined)?.services as SchemaNode | undefined;
  if (services) {
    services.maxProperties = 256;
    const item = services.additionalProperties as SchemaNode | undefined;
    const itemName = (item?.properties as SchemaNode | undefined)?.name as SchemaNode | undefined;
    if (itemName) itemName.maxLength = 63;
  }

  const identity: CrdIdentity = {
    name: `${CRD_PLURAL}.${group}`,
    group,
    version,
    kind: CRD_KIND,
    plural: CRD_PLURAL,
    singular: CRD_SINGULAR,
    scope: 'Namespaced',
  };

  const crd: SchemaNode = {
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    metadata: {
      name: identity.name,
      labels: { 'app.kubernetes.io/managed-by': 're-shell' },
    },
    spec: {
      group,
      scope: identity.scope,
      names: {
        kind: identity.kind,
        listKind: `${identity.kind}List`,
        plural: identity.plural,
        singular: identity.singular,
        shortNames: [CRD_SHORT_NAME],
        categories: ['re-shell'],
      },
      versions: [
        {
          name: version,
          served: true,
          storage: true,
          subresources: { status: {} },
          additionalPrinterColumns: [
            { name: 'Version', type: 'string', jsonPath: '.spec.version' },
            { name: 'Phase', type: 'string', jsonPath: '.status.phase' },
            { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp' },
          ],
          schema: {
            openAPIV3Schema: {
              type: 'object',
              description:
                'ReShellWorkspace declares a re-shell workspace; the operator reconciles its services into Deployments and Services.',
              required: ['spec'],
              properties: {
                apiVersion: { type: 'string' },
                kind: { type: 'string' },
                metadata: { type: 'object' },
                spec,
                status: statusSchema(),
              },
            },
          },
        },
      ],
    },
  };

  return { identity, crd };
}

/** Serialize a CRD/CR object to YAML. */
export function dumpYaml(doc: unknown): string {
  return yaml.dump(doc, { lineWidth: 120, noRefs: true });
}

/**
 * Derive a sample ReShellWorkspace custom resource from a real workspace config:
 * the config itself becomes the CR `spec`.
 *
 * @param config - The validated workspace config.
 * @param identity - Identity of the CRD the CR belongs to.
 * @param namespace - Namespace of the CR.
 * @returns The CR object.
 */
export function buildSampleResource(
  config: WorkspaceConfig,
  identity: CrdIdentity,
  namespace: string
): SchemaNode {
  return {
    apiVersion: `${identity.group}/${identity.version}`,
    kind: identity.kind,
    metadata: { name: config.name, namespace },
    spec: JSON.parse(JSON.stringify(config)) as SchemaNode,
  };
}

/** One file of the CRD output. */
export interface CrdFile {
  /** Path relative to the output directory. */
  path: string;
  kind: string;
  name: string;
  yaml: string;
}

/** Result of {@link generateCrd}. */
export interface GenerateCrdResult {
  identity: CrdIdentity;
  /** The CRD and the sample CR. */
  files: CrdFile[];
  /** The CRD object (for in-process consumers such as the operator scaffold). */
  crd: SchemaNode;
  warnings: string[];
}

/** Options for {@link generateCrd}. */
export interface GenerateCrdOptions extends BuildCrdOptions {
  cwd?: string;
  configPath?: string;
  /** Namespace of the sample CR (default `default`). */
  namespace?: string;
}

/**
 * Generate the ReShellWorkspace CRD and a sample CR from the workspace config.
 *
 * @throws Error when the workspace config cannot be loaded/validated.
 */
export function generateCrd(options: GenerateCrdOptions = {}): GenerateCrdResult {
  const { config, warnings } = loadWorkspace({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  const { identity, crd } = buildCrd(options);
  const sample = buildSampleResource(config, identity, options.namespace ?? 'default');
  return {
    identity,
    crd,
    warnings,
    files: [
      {
        path: `crd/${identity.plural}.${identity.group}.yaml`,
        kind: 'CustomResourceDefinition',
        name: identity.name,
        yaml: dumpYaml(crd),
      },
      {
        path: `samples/${config.name}.yaml`,
        kind: identity.kind,
        name: config.name,
        yaml: dumpYaml(sample),
      },
    ],
  };
}
