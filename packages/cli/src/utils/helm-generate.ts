// Helm chart generation from a workspace.yaml v2 config (W9c-2, P9-D2).
//
// Given the parsed workspace v2 services, emit a single Helm chart:
//   Chart.yaml, values.yaml, templates/_helpers.tpl, templates/deployment.yaml,
//   templates/service.yaml, templates/hpa.yaml, templates/pdb.yaml,
//   templates/networkpolicy.yaml, templates/ingress.yaml (+ TLS).
//
// Chart.yaml and values.yaml are plain YAML (rendered via js-yaml, parseable).
// The manifest templates are Go-templated (they contain `{{ ... }}` directives)
// so they are NOT plain YAML — callers verify them by asserting the presence of
// required directives / kinds, or by `helm lint` / `helm template` when helm is
// present.
//
// Every setting (security contexts, probes, rollout strategy, PDB, autoscaling,
// network policy) comes from the same resolver as the raw manifests
// (./k8s-config) and is surfaced in values.yaml so it can be overridden per
// environment with `-f values-prod.yaml` / `--set`.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {
  loadWorkspace,
  resolveK8sWorkspace,
  type ResolvedIngressDefaults,
  type ResolvedK8sService,
} from './k8s-config';

/** A single rendered chart file (relative path + content). */
export interface ChartFile {
  /** Path relative to the chart root, e.g. "templates/deployment.yaml". */
  path: string;
  content: string;
}

/** Result of a Helm chart-generation run. */
export interface GenerateChartResult {
  chart: {
    name: string;
    files: ChartFile[];
  };
  /** Files written to disk (absolute paths); empty for dry-run / no out. */
  written: string[];
  /** Non-fatal notes surfaced while resolving the workspace. */
  warnings: string[];
}

/**
 * Options accepted by {@link generateChart}. All fields are optional; when no
 * config can be resolved and `out` is unset the call is treated as a dry run.
 */
export interface GenerateChartOptions {
  /** Directory containing the workspace v2 config (default: cwd). */
  cwd?: string;
  /** Explicit path to the workspace yaml; overrides cwd discovery. */
  configPath?: string;
  /** Output directory to write the chart into; omitted/dry-run writes nothing. */
  out?: string;
  /** When true, do not write files regardless of `out`. */
  dryRun?: boolean;
}

const CHART_API_VERSION = 'v2';
const CHART_VERSION = '0.1.0';

/** Build the per-service values block from a resolved service. */
function buildServiceValues(svc: ResolvedK8sService): Record<string, unknown> {
  return {
    image: { ...svc.image },
    replicas: svc.replicas,
    port: svc.port,
    env: svc.env,
    resources: svc.resources,
    podSecurityContext: svc.podSecurityContext,
    securityContext: svc.securityContext,
    writablePaths: svc.writablePaths,
    automountServiceAccountToken: svc.automountServiceAccountToken,
    ...(svc.livenessProbe ? { livenessProbe: svc.livenessProbe } : {}),
    ...(svc.readinessProbe ? { readinessProbe: svc.readinessProbe } : {}),
    ...(svc.startupProbe ? { startupProbe: svc.startupProbe } : {}),
    strategy: svc.strategy,
    revisionHistoryLimit: svc.revisionHistoryLimit,
    progressDeadlineSeconds: svc.progressDeadlineSeconds,
    minReadySeconds: svc.minReadySeconds,
    ...(svc.terminationGracePeriodSeconds !== undefined
      ? { terminationGracePeriodSeconds: svc.terminationGracePeriodSeconds }
      : {}),
    pdb: svc.pdb,
    autoscaling: svc.autoscaling,
    networkPolicy: svc.networkPolicy,
    ingress: { ...svc.ingress },
  };
}

/** Build Chart.yaml content. */
function buildChartYaml(chartName: string, description: string): string {
  return yaml.dump(
    {
      apiVersion: CHART_API_VERSION,
      name: chartName,
      description,
      type: 'application',
      version: CHART_VERSION,
      appVersion: '1.0.0',
      // No `kubeVersion` constraint on purpose: `helm template`/`helm lint`
      // default to Kubernetes v1.20.0 when offline, which would reject the
      // chart even though it targets autoscaling/v2 (1.23+) and policy/v1 (1.21+).
    },
    { lineWidth: 120, noRefs: true }
  );
}

/** Build values.yaml content with a per-service map + global ingress/TLS toggles. */
function buildValuesYaml(
  ingress: ResolvedIngressDefaults,
  services: Record<string, Record<string, unknown>>
): string {
  return yaml.dump(
    {
      // Global ingress controller + cert-manager TLS settings consumed by
      // templates/ingress.yaml.
      ingress: {
        className: ingress.className,
        tls: {
          enabled: ingress.tlsEnabled,
          // cert-manager ClusterIssuer used for ACME / TLS automation.
          clusterIssuer: ingress.clusterIssuer,
        },
        // Extra Ingress annotations. The cert-manager issuer annotation is NOT
        // listed here: templates/ingress.yaml derives it from tls.clusterIssuer
        // (listing it twice produced a duplicated YAML key).
        annotations: {
          'nginx.ingress.kubernetes.io/ssl-redirect': String(ingress.tlsEnabled),
        },
      },
      services,
    },
    { lineWidth: 120, noRefs: true }
  );
}

/**
 * templates/_helpers.tpl — standard naming + label helpers used by every
 * template. Go-templated, not plain YAML.
 */
function buildHelpersTpl(chartName: string): string {
  return `{{/*
Expand the chart name.
*/}}
{{- define "${chartName}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels applied to every resource.
*/}}
{{- define "${chartName}.labels" -}}
app.kubernetes.io/name: {{ include "${chartName}.name" . }}
app.kubernetes.io/managed-by: re-shell
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/*
Selector labels for a given service. Pass a dict {svc, root}.
*/}}
{{- define "${chartName}.selectorLabels" -}}
app: {{ .svc }}
app.kubernetes.io/name: {{ .svc }}
{{- end -}}

{{/*
emptyDir volume name for a writable path ("/var/cache" -> "var-cache").
*/}}
{{- define "${chartName}.volumeName" -}}
{{- $n := regexReplaceAll "[^a-zA-Z0-9]+" (trimAll "/" .) "-" | lower | trunc 63 | trimSuffix "-" -}}
{{- default "root" $n -}}
{{- end -}}
`;
}

/**
 * templates/deployment.yaml — a hardened Deployment per service, ranged over
 * `.Values.services`. Go-templated.
 */
function buildDeploymentTpl(chartName: string): string {
  return `{{- range $name, $svc := .Values.services }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $name }}
  labels:
    {{- include "${chartName}.selectorLabels" (dict "svc" $name "root" $) | nindent 4 }}
spec:
  replicas: {{ $svc.replicas }}
  revisionHistoryLimit: {{ $svc.revisionHistoryLimit }}
  progressDeadlineSeconds: {{ $svc.progressDeadlineSeconds }}
  minReadySeconds: {{ $svc.minReadySeconds }}
  strategy:
    {{- toYaml $svc.strategy | nindent 4 }}
  selector:
    matchLabels:
      app: {{ $name }}
  template:
    metadata:
      labels:
        {{- include "${chartName}.selectorLabels" (dict "svc" $name "root" $) | nindent 8 }}
    spec:
      automountServiceAccountToken: {{ $svc.automountServiceAccountToken }}
      securityContext:
        {{- toYaml $svc.podSecurityContext | nindent 8 }}
      {{- if $svc.terminationGracePeriodSeconds }}
      terminationGracePeriodSeconds: {{ $svc.terminationGracePeriodSeconds }}
      {{- end }}
      containers:
        - name: {{ $name }}
          image: "{{ $svc.image.repository }}:{{ $svc.image.tag }}"
          imagePullPolicy: {{ $svc.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ $svc.port }}
          {{- if $svc.env }}
          env:
            {{- range $key, $value := $svc.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          {{- end }}
          resources:
            {{- toYaml $svc.resources | nindent 12 }}
          securityContext:
            {{- toYaml $svc.securityContext | nindent 12 }}
          {{- with $svc.livenessProbe }}
          livenessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with $svc.readinessProbe }}
          readinessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with $svc.startupProbe }}
          startupProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- if $svc.writablePaths }}
          volumeMounts:
            {{- range $svc.writablePaths }}
            - name: {{ include "${chartName}.volumeName" . }}
              mountPath: {{ . }}
            {{- end }}
          {{- end }}
      {{- if $svc.writablePaths }}
      volumes:
        {{- range $svc.writablePaths }}
        - name: {{ include "${chartName}.volumeName" . }}
          emptyDir: {}
        {{- end }}
      {{- end }}
{{- end }}
`;
}

/** templates/service.yaml — a ClusterIP Service per service. Go-templated. */
function buildServiceTpl(chartName: string): string {
  return `{{- range $name, $svc := .Values.services }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ $name }}
  labels:
    {{- include "${chartName}.selectorLabels" (dict "svc" $name "root" $) | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    app: {{ $name }}
  ports:
    - name: http
      protocol: TCP
      port: {{ $svc.port }}
      targetPort: {{ $svc.port }}
{{- end }}
`;
}

/** templates/hpa.yaml — an HPA per service when autoscaling is enabled. */
function buildHpaTpl(_chartName: string): string {
  return `{{- range $name, $svc := .Values.services }}
{{- if $svc.autoscaling.enabled }}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ $name }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ $name }}
  minReplicas: {{ $svc.autoscaling.minReplicas }}
  maxReplicas: {{ $svc.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ $svc.autoscaling.targetCPUUtilizationPercentage }}
    {{- if $svc.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ $svc.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
    {{- if $svc.autoscaling.customMetric.enabled }}
    # Custom metric: needs a metrics adapter (e.g. Prometheus Adapter) in-cluster.
    - type: Pods
      pods:
        metric:
          name: {{ $svc.autoscaling.customMetric.name }}
        target:
          type: AverageValue
          averageValue: {{ $svc.autoscaling.customMetric.averageValue | quote }}
    {{- end }}
{{- end }}
{{- end }}
`;
}

/** templates/pdb.yaml — a PodDisruptionBudget per service when enabled. */
function buildPdbTpl(chartName: string): string {
  return `{{- range $name, $svc := .Values.services }}
{{- if $svc.pdb.enabled }}
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ $name }}
  labels:
    {{- include "${chartName}.selectorLabels" (dict "svc" $name "root" $) | nindent 4 }}
spec:
  {{- if hasKey $svc.pdb "minAvailable" }}
  minAvailable: {{ $svc.pdb.minAvailable }}
  {{- else if hasKey $svc.pdb "maxUnavailable" }}
  maxUnavailable: {{ $svc.pdb.maxUnavailable }}
  {{- end }}
  selector:
    matchLabels:
      app: {{ $name }}
{{- end }}
{{- end }}
`;
}

/**
 * templates/networkpolicy.yaml — default-deny ingress + allow same-namespace
 * (and any extra allowed namespaces) per service when enabled.
 */
function buildNetworkPolicyTpl(chartName: string): string {
  return `{{- range $name, $svc := .Values.services }}
{{- if $svc.networkPolicy.enabled }}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ $name }}-default-deny-allow-intra
  labels:
    {{- include "${chartName}.selectorLabels" (dict "svc" $name "root" $) | nindent 4 }}
spec:
  podSelector:
    matchLabels:
      app: {{ $name }}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: {{ $.Release.Namespace }}
        {{- range $svc.networkPolicy.allowFromNamespaces }}
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: {{ . }}
        {{- end }}
{{- end }}
{{- end }}
`;
}

/**
 * templates/ingress.yaml — an Ingress per service when ingress is enabled,
 * wired for cert-manager TLS via the global ingress values. Go-templated.
 */
function buildIngressTpl(_chartName: string): string {
  return `{{- range $name, $svc := .Values.services }}
{{- if $svc.ingress.enabled }}
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ $name }}
  annotations:
    {{- if $.Values.ingress.tls.enabled }}
    # cert-manager issues + renews the TLS certificate for the secret below.
    cert-manager.io/cluster-issuer: {{ $.Values.ingress.tls.clusterIssuer | quote }}
    {{- end }}
    {{- with $.Values.ingress.annotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
spec:
  ingressClassName: {{ $.Values.ingress.className }}
  {{- if $.Values.ingress.tls.enabled }}
  tls:
    - hosts:
        - {{ $svc.ingress.host | quote }}
      secretName: {{ $name }}-tls
  {{- end }}
  rules:
    - host: {{ $svc.ingress.host | quote }}
      http:
        paths:
          - path: {{ $svc.ingress.path }}
            pathType: {{ $svc.ingress.pathType }}
            backend:
              service:
                name: {{ $name }}
                port:
                  number: {{ $svc.port }}
{{- end }}
{{- end }}
`;
}

/**
 * Generate the full Helm chart from a workspace v2 config.
 *
 * Reads + validates the config, resolves the Kubernetes settings, then
 * assembles the chart files. When `out` is set and `dryRun` is not, files are
 * written under `<out>/<chartName>/...`.
 *
 * @throws Error when the config cannot be found, fails to parse, defines no
 *   services, or has contradictory Kubernetes settings. The command layer maps
 *   these to a `HELM_GENERATE_ERROR` envelope.
 */
export function generateChart(
  options: GenerateChartOptions = {}
): GenerateChartResult {
  const { config } = loadWorkspace({ cwd: options.cwd, configPath: options.configPath });
  const resolved = resolveK8sWorkspace(config);

  const chartName = resolved.name;
  const serviceValues: Record<string, Record<string, unknown>> = {};
  for (const svc of resolved.services) {
    serviceValues[svc.name] = buildServiceValues(svc);
  }

  const files: ChartFile[] = [
    { path: 'Chart.yaml', content: buildChartYaml(chartName, resolved.description) },
    { path: 'values.yaml', content: buildValuesYaml(resolved.ingress, serviceValues) },
    { path: 'templates/_helpers.tpl', content: buildHelpersTpl(chartName) },
    { path: 'templates/deployment.yaml', content: buildDeploymentTpl(chartName) },
    { path: 'templates/service.yaml', content: buildServiceTpl(chartName) },
    { path: 'templates/hpa.yaml', content: buildHpaTpl(chartName) },
    { path: 'templates/pdb.yaml', content: buildPdbTpl(chartName) },
    { path: 'templates/networkpolicy.yaml', content: buildNetworkPolicyTpl(chartName) },
    { path: 'templates/ingress.yaml', content: buildIngressTpl(chartName) },
  ];

  const written: string[] = [];
  const shouldWrite = Boolean(options.out) && options.dryRun !== true;
  if (shouldWrite && options.out) {
    const chartRoot = path.join(options.out, chartName);
    for (const file of files) {
      const filePath = path.join(chartRoot, file.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
      written.push(filePath);
    }
  }

  return { chart: { name: chartName, files }, written, warnings: resolved.warnings };
}
