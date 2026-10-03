// Service-mesh manifest generation from the workspace v2 config (P9-D4).
//
// Istio:   Namespace (istio-injection label), PeerAuthentication (STRICT mTLS),
//          and per service a DestinationRule + VirtualService.
// Linkerd: Namespace (inject annotation + default inbound policy) and per
//          service a ServiceProfile.
//
// A README (sidecar injection, verification, multi-cluster notes) is generated
// next to the manifests. Everything is derived from the workspace's services
// (names, ports, health path, declared routes); nothing is hardcoded to a demo.

import * as fs from 'fs';
import * as path from 'path';

import {
  loadWorkspace,
  resolveK8sWorkspace,
  type ResolvedK8sService,
} from './k8s-config';
import { dumpYaml } from './k8s-crd';

/** Supported service meshes. */
export type MeshKind = 'istio' | 'linkerd';

/** One rendered mesh manifest. */
export interface MeshManifest {
  kind: string;
  name: string;
  /** Path relative to the output directory. */
  path: string;
  yaml: string;
}

/** A generated documentation file. */
export interface MeshDoc {
  path: string;
  content: string;
}

/** Options for {@link generateMesh}. */
export interface GenerateMeshOptions {
  /** Mesh to target (default `istio`). */
  mesh?: MeshKind;
  cwd?: string;
  configPath?: string;
  /** Namespace the workloads run in (default `default`). */
  namespace?: string;
  /** Enforce mTLS (default true). Istio: STRICT vs PERMISSIVE; Linkerd: default inbound policy. */
  mtls?: boolean;
  /** Generate per-service traffic-management resources (default true). */
  trafficManagement?: boolean;
  /**
   * Restrict generation to these services; each entry is `name` or `name:port`
   * (the port overrides the workspace port).
   */
  services?: string[];
  /** Cluster DNS domain (default `cluster.local`). */
  clusterDomain?: string;
  out?: string;
  dryRun?: boolean;
}

/** Result of {@link generateMesh}. */
export interface GenerateMeshResult {
  mesh: MeshKind;
  namespace: string;
  mtls: boolean;
  trafficManagement: boolean;
  manifests: MeshManifest[];
  docs: MeshDoc[];
  written: string[];
  warnings: string[];
}

interface MeshObject {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace?: string } & Record<string, unknown>;
  spec?: Record<string, unknown>;
}

/** Per-service timeout/retry defaults applied by both meshes. */
const REQUEST_TIMEOUT = '15s';
const PER_TRY_TIMEOUT = '5s';
const RETRY_ATTEMPTS = 3;

/** Label on every generated mesh resource; lets uninstall target them without touching workloads. */
const MANAGED_LABELS = { 'app.kubernetes.io/managed-by': 're-shell' };

function render(dir: string, obj: MeshObject): MeshManifest {
  return {
    kind: obj.kind,
    name: obj.metadata.name,
    path: `${dir}/${obj.kind.toLowerCase()}-${obj.metadata.name}.yaml`,
    yaml: dumpYaml(obj),
  };
}

function fqdn(service: string, namespace: string, domain: string): string {
  return `${service}.${namespace}.svc.${domain}`;
}

/** Escape a literal for use inside a Linkerd pathRegex. */
function regexEscape(literal: string): string {
  return literal.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse `name` / `name:port` filters and apply them to the resolved services. */
function selectServices(
  all: ResolvedK8sService[],
  filters: string[] | undefined
): ResolvedK8sService[] {
  if (!filters || filters.length === 0) return all;
  const selected: ResolvedK8sService[] = [];
  for (const raw of filters) {
    const [name, portText] = raw.split(':');
    const svc = all.find(s => s.name === name.trim());
    if (!svc) {
      throw new Error(
        `Unknown service "${name}" (workspace services: ${all.map(s => s.name).join(', ')})`
      );
    }
    let port = svc.port;
    if (portText !== undefined && portText.trim() !== '') {
      port = Number(portText);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid port "${portText}" for service "${name}"`);
      }
    }
    selected.push({ ...svc, port });
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Istio
// ---------------------------------------------------------------------------

function istioManifests(
  namespace: string,
  services: ResolvedK8sService[],
  mtls: boolean,
  traffic: boolean,
  domain: string
): MeshManifest[] {
  const out: MeshManifest[] = [];
  const dir = 'istio';

  out.push(
    render(dir, {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: namespace, labels: { 'istio-injection': 'enabled' } },
    })
  );
  out.push(
    render(dir, {
      apiVersion: 'security.istio.io/v1',
      kind: 'PeerAuthentication',
      metadata: { name: 'default', namespace, labels: MANAGED_LABELS },
      spec: { mtls: { mode: mtls ? 'STRICT' : 'PERMISSIVE' } },
    })
  );

  if (!traffic) return out;
  for (const svc of services) {
    const host = fqdn(svc.name, namespace, domain);
    out.push(
      render(dir, {
        apiVersion: 'networking.istio.io/v1',
        kind: 'DestinationRule',
        metadata: { name: svc.name, namespace, labels: MANAGED_LABELS },
        spec: {
          host,
          trafficPolicy: {
            ...(mtls ? { tls: { mode: 'ISTIO_MUTUAL' } } : {}),
            connectionPool: {
              tcp: { maxConnections: 100 },
              http: { http1MaxPendingRequests: 64, http2MaxRequests: 1000 },
            },
            // Eject endpoints that keep failing so retries land on healthy pods.
            outlierDetection: {
              consecutive5xxErrors: 5,
              interval: '30s',
              baseEjectionTime: '30s',
              maxEjectionPercent: 50,
            },
          },
        },
      })
    );

    const destination = [{ destination: { host, port: { number: svc.port } } }];
    const common = {
      route: destination,
      timeout: REQUEST_TIMEOUT,
      retries: {
        attempts: RETRY_ATTEMPTS,
        perTryTimeout: PER_TRY_TIMEOUT,
        retryOn: '5xx,reset,connect-failure',
      },
    };
    const http: Array<Record<string, unknown>> = svc.routes.map(r => ({
      name: `${r.method ?? 'ANY'} ${r.path}`,
      match: [
        {
          uri: { prefix: r.path },
          ...(r.method ? { method: { exact: r.method } } : {}),
        },
      ],
      ...common,
    }));
    // Catch-all so undeclared paths still reach the service.
    http.push({ name: 'default', ...common });

    out.push(
      render(dir, {
        apiVersion: 'networking.istio.io/v1',
        kind: 'VirtualService',
        metadata: { name: svc.name, namespace, labels: MANAGED_LABELS },
        spec: { hosts: [host], http },
      })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Linkerd
// ---------------------------------------------------------------------------

function linkerdManifests(
  namespace: string,
  services: ResolvedK8sService[],
  mtls: boolean,
  traffic: boolean,
  domain: string
): MeshManifest[] {
  const out: MeshManifest[] = [];
  const dir = 'linkerd';

  out.push(
    render(dir, {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
        annotations: {
          'linkerd.io/inject': 'enabled',
          // all-authenticated: only mTLS-authenticated clients may connect
          // (the Linkerd analogue of Istio STRICT).
          'config.linkerd.io/default-inbound-policy': mtls
            ? 'all-authenticated'
            : 'all-unauthenticated',
        },
      },
    })
  );

  if (!traffic) return out;
  for (const svc of services) {
    const routes: Array<Record<string, unknown>> = [];
    if (svc.healthPath) {
      routes.push({
        name: `GET ${svc.healthPath}`,
        condition: { method: 'GET', pathRegex: regexEscape(svc.healthPath) },
        isRetryable: true,
        timeout: '5s',
      });
    }
    for (const r of svc.routes) {
      const method = r.method;
      routes.push({
        name: `${method ?? 'ANY'} ${r.path}`,
        condition: {
          ...(method ? { method } : {}),
          pathRegex: `${regexEscape(r.path.replace(/\/+$/, '').replace(/\/?\*$/, ''))}(/.*)?`,
        },
        // Only idempotent reads are safe to retry automatically.
        isRetryable: method === 'GET' || method === 'HEAD',
        timeout: REQUEST_TIMEOUT,
      });
    }
    routes.push({
      name: 'default',
      condition: { pathRegex: '/.*' },
      isRetryable: false,
      timeout: REQUEST_TIMEOUT,
    });

    out.push(
      render(dir, {
        apiVersion: 'linkerd.io/v1alpha2',
        kind: 'ServiceProfile',
        // A ServiceProfile is named after the service FQDN it describes.
        metadata: {
          name: fqdn(svc.name, namespace, domain),
          namespace,
          labels: MANAGED_LABELS,
        },
        spec: {
          routes,
          retryBudget: { retryRatio: 0.2, minRetriesPerSecond: 10, ttl: '10s' },
        },
      })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

function istioReadme(
  workspaceName: string,
  namespace: string,
  files: MeshManifest[],
  mtls: boolean,
  traffic: boolean
): string {
  const list = files.map(f => `- \`${f.path}\` (${f.kind}/${f.name})`).join('\n');
  return `# ${workspaceName}: Istio service mesh

Generated by \`re-shell k8s mesh --mesh istio\`.

${list}

## Apply

\`\`\`sh
# Prerequisite: Istio is installed (istioctl install, or the istio/base + istiod Helm charts).
kubectl apply -f istio/namespace-${namespace}.yaml
kubectl apply -f istio/
\`\`\`

## Sidecar injection

Injection is **namespace-wide**: \`istio-injection: enabled\` on the \`${namespace}\`
Namespace makes Istio's mutating webhook add an \`istio-proxy\` sidecar to every pod
**created after the label is set**. Existing pods are not touched; restart them:

\`\`\`sh
kubectl rollout restart deployment -n ${namespace}
kubectl get pods -n ${namespace}        # READY should show 2/2 (app + istio-proxy)
\`\`\`

- Opt a single workload out with the pod label \`sidecar.istio.io/inject: "false"\`.
- Revision-based installs use \`istio.io/rev=<revision>\` on the Namespace instead of
  \`istio-injection\` (do not set both).
- Hardened pods (\`re-shell k8s generate\` defaults: non-root, read-only root filesystem,
  all capabilities dropped) work with the sidecar. The \`istio-init\` container needs
  \`NET_ADMIN\`/\`NET_RAW\`, which the *restricted* Pod Security Standard forbids: on
  a namespace enforcing *restricted*, install the **Istio CNI plugin**
  (\`istioctl install --set components.cni.enabled=true\`) so no privileged init
  container is injected.
- The default NetworkPolicy allows ingress from the workspace namespace only; add the
  \`istio-system\` namespace to \`kubernetes.networkPolicy.allowFromNamespaces\` if
  gateways or the control plane must reach the pods.

## Security

\`PeerAuthentication/default\` sets mTLS mode **${mtls ? 'STRICT' : 'PERMISSIVE'}** for the namespace${
    mtls
      ? ': plaintext traffic from non-mesh clients is rejected. Make sure every client is injected (or exempt a port with `portLevelMtls`).'
      : ' (plaintext and mTLS are both accepted; regenerate without `--no-mtls` to enforce STRICT).'
  }
${
  traffic
    ? `
## Traffic management

Per service: a \`DestinationRule\` (${mtls ? 'ISTIO_MUTUAL client TLS, ' : ''}connection pool limits, outlier
detection) and a \`VirtualService\` (3 retries on 5xx/reset/connect-failure, 15s request timeout,
a match per route declared in the workspace and a catch-all).
`
    : ''
}
## Verify

\`\`\`sh
istioctl analyze -n ${namespace}
istioctl proxy-status
istioctl x describe pod <pod> -n ${namespace}     # shows the effective mTLS mode
\`\`\`

## Multi-cluster

Pick a topology from the Istio docs (<https://istio.io/latest/docs/setup/install/multicluster/>):

1. **Same network, multi-primary** (pods can route to each other directly). Give every cluster
   the same \`meshID\`, a unique \`clusterName\` and the same \`network\` in its IstioOperator /
   Helm values, then exchange remote secrets so each control plane discovers the other
   cluster's endpoints:
   \`\`\`sh
   istioctl create-remote-secret --context=<east> --name=east | kubectl apply -f - --context=<west>
   istioctl create-remote-secret --context=<west> --name=west | kubectl apply -f - --context=<east>
   \`\`\`
2. **Different networks**: label the \`istio-system\` namespace in each cluster with
   \`topology.istio.io/network=<network>\` and install an **east-west gateway** per cluster so
   cross-network traffic is tunnelled over mTLS.
3. **Primary-remote**: one control plane serves several clusters; use when remote clusters
   should not run istiod.

Requirements that apply to all topologies:

- **Shared root of trust**: plug in the same root CA (\`cacerts\` secret in \`istio-system\`)
  in every cluster, otherwise cross-cluster mTLS handshakes fail.
- The workloads and this namespace must exist in **every** cluster ("namespace sameness"):
  apply these manifests with \`kubectl --context <cluster>\` to each. Services are then
  reachable as \`<svc>.${namespace}.svc.cluster.local\` and Istio load-balances across clusters.
- Use \`DestinationRule.trafficPolicy.loadBalancer.localityLbSetting\` for locality-aware
  failover between clusters.

## Uninstall / rollback

\`\`\`sh
# Remove the mesh policy (labelled by re-shell). Do NOT \`kubectl delete -f istio/\`:
# that directory contains the Namespace manifest and would delete every workload in it.
kubectl delete peerauthentication,destinationrule,virtualservice -n ${namespace} -l app.kubernetes.io/managed-by=re-shell
kubectl label namespace ${namespace} istio-injection-
kubectl rollout restart deployment -n ${namespace}  # drops the sidecars
\`\`\`
`;
}

function linkerdReadme(
  workspaceName: string,
  namespace: string,
  files: MeshManifest[],
  mtls: boolean,
  traffic: boolean
): string {
  const list = files.map(f => `- \`${f.path}\` (${f.kind}/${f.name})`).join('\n');
  return `# ${workspaceName}: Linkerd service mesh

Generated by \`re-shell k8s mesh --mesh linkerd\`.

${list}

## Apply

\`\`\`sh
# Prerequisite: Linkerd is installed (linkerd install --crds | kubectl apply -f -; linkerd install | kubectl apply -f -).
kubectl apply -f linkerd/
\`\`\`

## Sidecar injection

Injection is **namespace-wide**: the annotation \`linkerd.io/inject: enabled\` on the
\`${namespace}\` Namespace makes Linkerd's proxy-injector add a \`linkerd-proxy\` sidecar to
every pod **created after the annotation is set**. Existing pods are not touched; restart
them:

\`\`\`sh
kubectl rollout restart deployment -n ${namespace}
kubectl get pods -n ${namespace}        # READY should show 2/2 (app + linkerd-proxy)
\`\`\`

- Opt a single workload in or out with the pod-template annotation
  \`linkerd.io/inject: enabled|disabled\` (\`spec.template.metadata.annotations\`).
- The \`linkerd-init\` container needs \`NET_ADMIN\`/\`NET_RAW\`, which the *restricted* Pod
  Security Standard forbids; on namespaces enforcing *restricted* install the
  **Linkerd CNI plugin** (\`linkerd install-cni\`) so no privileged init container is injected.
- Hardened pods (\`re-shell k8s generate\` defaults: non-root, read-only root filesystem, all
  capabilities dropped) work with the sidecar.
- The default NetworkPolicy allows ingress from the workspace namespace only; add \`linkerd\`
  (and \`linkerd-viz\`) to \`kubernetes.networkPolicy.allowFromNamespaces\` if the control
  plane or dashboard must reach the pods.

## Security

Linkerd enables mTLS between meshed pods automatically and cannot turn it off.
\`config.linkerd.io/default-inbound-policy: ${mtls ? 'all-authenticated' : 'all-unauthenticated'}\`
on the Namespace ${
    mtls
      ? 'makes meshed pods accept only mTLS-authenticated connections (the analogue of Istio STRICT); kubelet probes stay authorized.'
      : 'leaves the default policy open to unauthenticated clients (regenerate without `--no-mtls` to require mTLS).'
  }
${
  traffic
    ? `
## Traffic management

Per service a \`ServiceProfile\` (named \`<svc>.${namespace}.svc.cluster.local\`) lists the
routes known from the workspace (health path, declared routes, a catch-all) with timeouts, a
retry budget, and retries enabled only for idempotent GET/HEAD routes.
`
    : ''
}
## Verify

\`\`\`sh
linkerd check
linkerd check --proxy -n ${namespace}
linkerd viz edges deployment -n ${namespace}     # SECURED column shows mTLS
linkerd viz routes deploy/<svc> -n ${namespace}  # per-route metrics from the ServiceProfile
\`\`\`

## Multi-cluster

Linkerd links clusters by mirroring exported services (<https://linkerd.io/2/features/multicluster/>).
Both clusters need the **same trust anchor** (root CA) so mTLS spans clusters.

\`\`\`sh
# On each cluster that will receive traffic:
linkerd --context=<east> multicluster install | kubectl --context=<east> apply -f -
# On the cluster that will call it, link to the target:
linkerd --context=<east> multicluster link --cluster-name east | kubectl --context=<west> apply -f -
linkerd --context=<west> multicluster check
\`\`\`

- Export a service by labelling it \`mirror.linkerd.io/exported=true\`; it appears in the
  other cluster as \`<svc>-east\` and is called through the cluster gateway (or pod-to-pod
  with \`--gateway=false\` on a flat network, Linkerd 2.14+).
- Apply these manifests to every cluster (\`kubectl --context <cluster> apply -f linkerd/\`)
  so both sides inject and use the same policy.

## Uninstall / rollback

\`\`\`sh
# Do NOT \`kubectl delete -f linkerd/\`: that directory contains the Namespace manifest and
# would delete every workload in it.
kubectl delete serviceprofile -n ${namespace} -l app.kubernetes.io/managed-by=re-shell
kubectl annotate namespace ${namespace} linkerd.io/inject- config.linkerd.io/default-inbound-policy-
kubectl rollout restart deployment -n ${namespace}   # drops the sidecars
\`\`\`
`;
}

/**
 * Generate the mesh manifests and README from the workspace config.
 *
 * @throws Error when the config cannot be loaded, the mesh is unknown, or a
 *   `services` filter names an unknown service/port.
 */
export function generateMesh(options: GenerateMeshOptions = {}): GenerateMeshResult {
  const mesh = options.mesh ?? 'istio';
  if (mesh !== 'istio' && mesh !== 'linkerd') {
    throw new Error(`Unknown mesh "${String(mesh)}" (expected istio|linkerd)`);
  }
  const { config } = loadWorkspace({ cwd: options.cwd, configPath: options.configPath });
  const resolved = resolveK8sWorkspace(config);
  const namespace = options.namespace ?? 'default';
  const mtls = options.mtls !== false;
  const traffic = options.trafficManagement !== false;
  const domain = options.clusterDomain ?? 'cluster.local';
  const services = selectServices(resolved.services, options.services);

  const warnings = [...resolved.warnings];
  if (mesh === 'linkerd' && !mtls) {
    warnings.push(
      'Linkerd always uses mTLS between meshed pods; --no-mtls only relaxes the default inbound policy'
    );
  }

  const manifests =
    mesh === 'istio'
      ? istioManifests(namespace, services, mtls, traffic, domain)
      : linkerdManifests(namespace, services, mtls, traffic, domain);
  const readmeContent =
    mesh === 'istio'
      ? istioReadme(config.name, namespace, manifests, mtls, traffic)
      : linkerdReadme(config.name, namespace, manifests, mtls, traffic);
  const docs: MeshDoc[] = [{ path: `${mesh}/README.md`, content: readmeContent }];

  const written: string[] = [];
  if (options.out && options.dryRun !== true) {
    for (const file of [
      ...manifests.map(m => ({ path: m.path, content: m.yaml })),
      ...docs,
    ]) {
      const target = path.join(options.out, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content);
      written.push(target);
    }
  }

  return { mesh, namespace, mtls, trafficManagement: traffic, manifests, docs, written, warnings };
}
