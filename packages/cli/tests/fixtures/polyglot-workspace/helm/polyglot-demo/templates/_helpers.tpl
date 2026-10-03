{{/*
Expand the chart name.
*/}}
{{- define "polyglot-demo.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels applied to every resource.
*/}}
{{- define "polyglot-demo.labels" -}}
app.kubernetes.io/name: {{ include "polyglot-demo.name" . }}
app.kubernetes.io/managed-by: re-shell
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/*
Selector labels for a given service. Pass a dict {svc, root}.
*/}}
{{- define "polyglot-demo.selectorLabels" -}}
app: {{ .svc }}
app.kubernetes.io/name: {{ .svc }}
{{- end -}}
