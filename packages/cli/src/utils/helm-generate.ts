// Helm chart generation from a workspace.yaml v2 config (W9c-2, P9-D2).
//
// Given the parsed workspace v2 services, emit a single Helm chart:
//   Chart.yaml, values.yaml, templates/_helpers.tpl, templates/deployment.yaml,
//   templates/service.yaml, templates/hpa.yaml, templates/ingress.yaml (+ TLS).
//
// Chart.yaml and values.yaml are plain YAML (rendered via js-yaml, parseable).
// The four manifest templates are Go-templated (they contain `{{ ... }}`
// directives) so they are NOT plain YAML — callers verify them by asserting the
// presence of required directives / kinds rather than yaml-parsing them.
//
// These are GENERATION artifacts: correctness is verified by parsing the plain
// YAML files and structurally asserting the templates, or by `helm lint` when
// helm is present — never by deploying to a live cluster.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { WorkspaceParser, type ServiceConfig } from '../parsers/workspace-parser';
import { resolveWorkspaceConfigPath } from './k8s-generate';

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
const DEFAULT_REPLICAS = 2;
const DEFAULT_PORT = 8080;

// Per-service resource defaults surfaced in values.yaml.
const DEFAULT_RESOURCES = {
  requests: { cpu: '100m', memory: '128Mi' },
  limits: { cpu: '500m', memory: '512Mi' },
} as const;

const HPA_MIN_REPLICAS = 2;
const HPA_MAX_REPLICAS = 10;
const HPA_CPU_TARGET_UTILIZATION = 70;

/** Shape of a single service's entry under `.Values.services`. */
interface ServiceValues {
  image: { repository: string; tag: string; pullPolicy: string };
  replicas: number;
  port: number;
  env: Record<string, string>;
  resources: typeof DEFAULT_RESOURCES;
  autoscaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilizationPercentage: number;
  };
  ingress: {
    enabled: boolean;
    host: string;
    path: string;
    pathType: string;
  };
}

/** Build the per-service values block from a parsed service config. */
function buildServiceValues(service: ServiceConfig, serviceName: string): ServiceValues {
  const port = service.port ?? DEFAULT_PORT;
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(service.env ?? {})) {
    env[key] = String(value);
  }
  return {
    image: { repository: serviceName, tag: 'latest', pullPolicy: 'IfNotPresent' },
    replicas: DEFAULT_REPLICAS,
    port,
    env,
    resources: DEFAULT_RESOURCES,
    autoscaling: {
      enabled: true,
      minReplicas: HPA_MIN_REPLICAS,
      maxReplicas: HPA_MAX_REPLICAS,
      targetCPUUtilizationPercentage: HPA_CPU_TARGET_UTILIZATION,
    },
    ingress: {
      enabled: true,
      host: `${serviceName}.example.com`,
      path: '/',
      pathType: 'Prefix',
    },
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
    },
    { lineWidth: 120, noRefs: true }
  );
}

/** Build values.yaml content with a per-service map + global ingress/TLS toggles. */
function buildValuesYaml(
  services: Record<string, ServiceValues>
): string {
  return yaml.dump(
    {
      // Global ingress controller + cert-manager TLS settings consumed by
      // templates/ingress.yaml.
      ingress: {
        className: 'nginx',
        tls: {
          enabled: true,
          // cert-manager ClusterIssuer used for ACME / TLS automation.
          clusterIssuer: 'letsencrypt-prod',
        },
        annotations: {
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
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
`;
}

/**
 * templates/deployment.yaml — a Deployment per service, ranged over
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
  selector:
    matchLabels:
      app: {{ $name }}
  template:
    metadata:
      labels:
        {{- include "${chartName}.selectorLabels" (dict "svc" $name "root" $) | nindent 8 }}
    spec:
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
    # cert-manager issues + renews the TLS certificate for the secret below.
    cert-manager.io/cluster-issuer: {{ $.Values.ingress.tls.clusterIssuer | quote }}
    {{- toYaml $.Values.ingress.annotations | nindent 4 }}
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
 * Reads + validates the config via {@link WorkspaceParser}, then assembles the
 * chart files. When `out` is set and `dryRun` is not, files are written under
 * `<out>/<chartName>/...`.
 *
 * @throws Error when the config cannot be found, fails to parse, or defines no
 *   services. The command layer maps these to a `HELM_GENERATE_ERROR` envelope.
 */
export function generateChart(
  options: GenerateChartOptions = {}
): GenerateChartResult {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolveWorkspaceConfigPath(cwd, options.configPath);

  if (!configPath) {
    throw new Error(
      `No workspace v2 config found in ${cwd}`
    );
  }

  const parser = new WorkspaceParser();
  const parsed = parser.parse(configPath);

  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid workspace config: ${detail || 'unknown error'}`);
  }

  const services = parsed.config.services ?? {};
  const serviceNames = Object.keys(services);
  if (serviceNames.length === 0) {
    throw new Error('Workspace config defines no services to generate a chart for');
  }

  const chartName = parsed.config.name || 'app';
  const description =
    parsed.config.description || `Helm chart for ${chartName} (generated by re-shell)`;

  const serviceValues: Record<string, ServiceValues> = {};
  for (const serviceName of serviceNames) {
    serviceValues[serviceName] = buildServiceValues(services[serviceName], serviceName);
  }

  const files: ChartFile[] = [
    { path: 'Chart.yaml', content: buildChartYaml(chartName, description) },
    { path: 'values.yaml', content: buildValuesYaml(serviceValues) },
    { path: 'templates/_helpers.tpl', content: buildHelpersTpl(chartName) },
    { path: 'templates/deployment.yaml', content: buildDeploymentTpl(chartName) },
    { path: 'templates/service.yaml', content: buildServiceTpl(chartName) },
    { path: 'templates/hpa.yaml', content: buildHpaTpl(chartName) },
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

  return { chart: { name: chartName, files }, written };
}
