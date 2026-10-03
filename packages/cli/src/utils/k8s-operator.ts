// ReShellWorkspace operator scaffold generation (P9-D4).
//
// Emits a complete Go (controller-runtime) operator project that reconciles the
// ReShellWorkspace CRD (see ./k8s-crd) into per-service Deployments, Services
// and PodDisruptionBudgets using the same hardened defaults as
// `re-shell k8s generate`:
//
//   go.mod, constants.go, types.go, builders.go, reconciler.go, main.go,
//   Dockerfile, Makefile, README.md,
//   config/crd/*.yaml, config/samples/*.yaml,
//   config/rbac/{service_account,role,role_binding}.yaml,
//   config/manager/{namespace,manager}.yaml
//
// `verifyOperatorBuild` runs the real `go mod tidy && go build ./...` on a
// written scaffold; nothing here pretends a build happened.

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  buildCrd,
  buildSampleResource,
  dumpYaml,
  type CrdIdentity,
} from './k8s-crd';
import { loadWorkspace } from './k8s-config';
import {
  BUILDERS_GO,
  DOCKERFILE,
  GITIGNORE,
  MAIN_GO,
  OPERATOR_DEPENDENCIES,
  RECONCILER_GO,
  TYPES_GO,
  constantsGo,
  goMod,
  makefile,
} from './k8s-operator-templates';

/** Namespace the operator itself is deployed into. */
export const OPERATOR_NAMESPACE = 'reshell-operator-system';
const OPERATOR_NAME = 'reshell-operator';

/** One generated file (relative path + content). */
export interface OperatorFile {
  path: string;
  content: string;
}

/** Options for {@link generateOperator}. */
export interface GenerateOperatorOptions {
  cwd?: string;
  configPath?: string;
  /** Go module path (default `<group>/operator`). */
  module?: string;
  /** Operator container image referenced by config/manager/manager.yaml. */
  image?: string;
  /** API group of the CRD the operator reconciles (default `re-shell.io`). */
  group?: string;
  /** API version of the CRD (default `v1alpha1`). */
  version?: string;
  /** Namespace of the sample CR (default `default`). */
  namespace?: string;
  /** Output directory to write into; omitted/dry-run writes nothing. */
  out?: string;
  dryRun?: boolean;
}

/** Result of {@link generateOperator}. */
export interface GenerateOperatorResult {
  module: string;
  identity: CrdIdentity;
  files: OperatorFile[];
  written: string[];
  warnings: string[];
}

function role(group: string, plural: string): string {
  return dumpYaml({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: { name: `${OPERATOR_NAME}-role` },
    rules: [
      { apiGroups: [group], resources: [plural], verbs: ['get', 'list', 'watch'] },
      {
        apiGroups: [group],
        resources: [`${plural}/status`],
        verbs: ['get', 'update', 'patch'],
      },
      {
        apiGroups: ['apps'],
        resources: ['deployments'],
        verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
      },
      {
        apiGroups: [''],
        resources: ['services'],
        verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
      },
      {
        apiGroups: ['policy'],
        resources: ['poddisruptionbudgets'],
        verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
      },
      {
        apiGroups: ['coordination.k8s.io'],
        resources: ['leases'],
        verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
      },
      { apiGroups: [''], resources: ['events'], verbs: ['create', 'patch'] },
    ],
  });
}

function managerDeployment(image: string): string {
  const labels = { app: OPERATOR_NAME, 'app.kubernetes.io/name': OPERATOR_NAME };
  return dumpYaml({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: OPERATOR_NAME, namespace: OPERATOR_NAMESPACE, labels },
    spec: {
      replicas: 1,
      revisionHistoryLimit: 5,
      selector: { matchLabels: { app: OPERATOR_NAME } },
      template: {
        metadata: { labels },
        spec: {
          serviceAccountName: OPERATOR_NAME,
          securityContext: {
            runAsNonRoot: true,
            seccompProfile: { type: 'RuntimeDefault' },
          },
          terminationGracePeriodSeconds: 10,
          containers: [
            {
              name: 'manager',
              image,
              imagePullPolicy: 'IfNotPresent',
              args: ['--leader-elect', '--health-probe-bind-address=:8081'],
              ports: [{ name: 'metrics', containerPort: 8080 }],
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: { drop: ['ALL'] },
              },
              livenessProbe: {
                httpGet: { path: '/healthz', port: 8081 },
                initialDelaySeconds: 15,
                periodSeconds: 20,
              },
              readinessProbe: {
                httpGet: { path: '/readyz', port: 8081 },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              resources: {
                requests: { cpu: '50m', memory: '64Mi' },
                limits: { cpu: '500m', memory: '256Mi' },
              },
            },
          ],
        },
      },
    },
  });
}

function readme(
  workspaceName: string,
  identity: CrdIdentity,
  modulePath: string,
  image: string
): string {
  const crdFile = `config/crd/${identity.plural}.${identity.group}.yaml`;
  return `# ${workspaceName} operator

Generated by \`re-shell k8s operator\`. A controller-runtime operator that
reconciles a \`${identity.kind}\` (\`${identity.group}/${identity.version}\`) into one
**Deployment**, **Service** and **PodDisruptionBudget** per entry under
\`spec.services\`.

The CRD's \`spec\` schema is derived from \`workspace-v2.schema.json\`, so a
workspace v2 document is the \`spec\` of the custom resource:

\`\`\`yaml
apiVersion: ${identity.group}/${identity.version}
kind: ${identity.kind}
metadata:
  name: ${workspaceName}
spec:
  name: ${workspaceName}
  version: 2.0.0
  services:
    api: { name: api, language: typescript, framework: express, port: 3000 }
\`\`\`

Services get the same hardened defaults as \`re-shell k8s generate\`: Pod Security
Standards *restricted* security contexts (non-root, read-only root filesystem with
an emptyDir on /tmp, all capabilities dropped, RuntimeDefault seccomp), resource
requests/limits, probes from \`healthCheck.path\` (tcpSocket otherwise), a
RollingUpdate strategy with \`revisionHistoryLimit\` for rollbacks, and a PDB. Every
default can be overridden with the \`kubernetes\` block of the workspace or of a
service. HorizontalPodAutoscalers and NetworkPolicies are *not* reconciled by this
operator; generate them with \`re-shell k8s generate\`.

## Build and run

Requires Go ${OPERATOR_DEPENDENCIES.go}+.

\`\`\`sh
go mod tidy                 # resolves dependencies and writes go.sum
go build -o bin/manager .   # or: make build

make install                # kubectl apply --server-side -f ${crdFile}
make run                    # run the controller against the cluster in $KUBECONFIG
kubectl apply -f config/samples/
kubectl get ${identity.plural} -w
\`\`\`

## Deploy in-cluster

\`\`\`sh
make docker-build IMG=${image}
# push/load the image so the cluster can pull it, then:
make deploy
\`\`\`

\`make deploy\` installs the CRD, the \`${OPERATOR_NAMESPACE}\` namespace, RBAC
(\`config/rbac\`) and the manager Deployment (\`config/manager\`).

## Status

\`status.phase\` is \`Ready\` once every service Deployment is available,
\`Progressing\` while a rollout is in flight and \`Degraded\` when the spec cannot be
rendered (see \`status.conditions\`). \`status.services\` lists per-service replica
counts.

Module: \`${modulePath}\`.
`;
}

/**
 * Generate the operator scaffold from the workspace config.
 *
 * @throws Error when the workspace config cannot be loaded/validated.
 */
export function generateOperator(
  options: GenerateOperatorOptions = {}
): GenerateOperatorResult {
  const { config, warnings } = loadWorkspace({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  const { identity, crd } = buildCrd({ group: options.group, version: options.version });
  const modulePath = options.module ?? `${identity.group}/operator`;
  const image = options.image ?? `${OPERATOR_NAME}:latest`;
  const crdFile = `config/crd/${identity.plural}.${identity.group}.yaml`;
  const sample = buildSampleResource(config, identity, options.namespace ?? 'default');

  const files: OperatorFile[] = [
    { path: 'go.mod', content: goMod(modulePath) },
    { path: 'constants.go', content: constantsGo(identity) },
    { path: 'types.go', content: TYPES_GO },
    { path: 'builders.go', content: BUILDERS_GO },
    { path: 'reconciler.go', content: RECONCILER_GO },
    { path: 'main.go', content: MAIN_GO },
    { path: 'Dockerfile', content: DOCKERFILE },
    { path: 'Makefile', content: makefile(crdFile) },
    { path: '.gitignore', content: GITIGNORE },
    { path: 'README.md', content: readme(config.name, identity, modulePath, image) },
    { path: crdFile, content: dumpYaml(crd) },
    { path: `config/samples/${config.name}.yaml`, content: dumpYaml(sample) },
    {
      path: 'config/manager/namespace.yaml',
      content: dumpYaml({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: OPERATOR_NAMESPACE,
          labels: { 'pod-security.kubernetes.io/enforce': 'restricted' },
        },
      }),
    },
    { path: 'config/manager/manager.yaml', content: managerDeployment(image) },
    {
      path: 'config/rbac/service_account.yaml',
      content: dumpYaml({
        apiVersion: 'v1',
        kind: 'ServiceAccount',
        metadata: { name: OPERATOR_NAME, namespace: OPERATOR_NAMESPACE },
      }),
    },
    { path: 'config/rbac/role.yaml', content: role(identity.group, identity.plural) },
    {
      path: 'config/rbac/role_binding.yaml',
      content: dumpYaml({
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: { name: `${OPERATOR_NAME}-rolebinding` },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: `${OPERATOR_NAME}-role`,
        },
        subjects: [
          { kind: 'ServiceAccount', name: OPERATOR_NAME, namespace: OPERATOR_NAMESPACE },
        ],
      }),
    },
  ];

  const written: string[] = [];
  if (options.out && options.dryRun !== true) {
    for (const file of files) {
      const target = path.join(options.out, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content);
      written.push(target);
    }
  }

  return { module: modulePath, identity, files, written, warnings };
}

/** Outcome of a real `go build` of a generated operator. */
export interface OperatorBuildResult {
  /** True only when `go` actually ran. */
  ran: boolean;
  /** Build outcome when `ran` is true. */
  ok?: boolean;
  /** Why go was skipped, or go's output. */
  detail?: string;
}

/**
 * Build a written operator scaffold with the real Go toolchain
 * (`go mod tidy`, `go build ./...`, then `go vet ./...`).
 *
 * @param dir - Directory the scaffold was written to.
 * @param timeoutMs - Per-command timeout (default 10 minutes: tidy downloads modules).
 * @returns `ran:false` when go is not installed; otherwise the build outcome.
 */
export function verifyOperatorBuild(dir: string, timeoutMs = 600_000): OperatorBuildResult {
  const probe = spawnSync('go', ['version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    return { ran: false, detail: 'go not found on PATH' };
  }
  const steps: Array<{ args: string[]; label: string }> = [
    { args: ['mod', 'tidy'], label: 'go mod tidy' },
    { args: ['build', './...'], label: 'go build ./...' },
    { args: ['vet', './...'], label: 'go vet ./...' },
  ];
  for (const step of steps) {
    const result = spawnSync('go', step.args, {
      cwd: dir,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      const output = [result.stdout, result.stderr, result.error?.message]
        .filter(Boolean)
        .join('\n')
        .trim();
      return { ran: true, ok: false, detail: `${step.label} failed: ${output}` };
    }
  }
  return { ran: true, ok: true, detail: probe.stdout.trim() };
}
