#!/usr/bin/env bash
# k8s-live-check.sh - validate the re-shell Kubernetes generators against a REAL cluster.
#
# Uses whatever cluster $KUBECONFIG points at (kind, k3s, a cloud dev cluster ...).
# Every step runs real tools and aborts the script (non-zero exit) on the first
# failure; nothing is simulated. The final summary lists which steps RAN and
# which were SKIPPED (with the reason), so a green run can be read honestly.
#
# Steps
#   1  generate   k8s generate / helm generate / gitops generate / crd / mesh / operator
#                 from a fixture workspace (scripts/k8s-live/workspace)
#   2  helm       helm lint --strict + helm template
#   3  kubeconform  strict schema validation of every generated manifest
#   4  apply      kubectl apply the raw manifests into a namespace enforcing the
#                 Pod Security Standard "restricted" (so the API server itself
#                 proves the securityContexts), wait for rollout, HTTP check
#   5  rollback   upgrade to a broken image, detect the failed rollout, run
#                 `re-shell k8s rollback` (kubectl rollout undo), verify recovery
#   6  helm release  the same flow for a Helm release (helm rollback)
#   7  crd        install the ReShellWorkspace CRD, server-side validate good and
#                 bad custom resources, apply the sample CR
#   8  operator   (K8S_LIVE_OPERATOR=1) build the generated Go operator, run it
#                 against the cluster and watch it reconcile / scale / prune / GC
#   9  gitops     (K8S_LIVE_GITOPS=flux) install Flux, sync the generated
#                 HelmRelease from a git repo, push a broken release and verify
#                 Flux remediates it with a Helm rollback
#
# Environment
#   KUBECONFIG                 cluster to use (required)
#   RESHELL_CLI                CLI command (default: node <repo>/packages/cli/dist/index.js)
#   K8S_LIVE_OPERATOR          1 = run step 8 (needs go + module proxy access); default 0
#   K8S_LIVE_GITOPS            flux = run step 9 (needs github.com/ghcr.io access); default none
#   K8S_LIVE_IMAGE_LOADER      kind | k3s-docker | none (default: auto-detect from the kube context)
#   K8S_LIVE_KIND_CLUSTER      kind cluster name (default: derived from the kube context kind-<name>)
#   K3S_CONTAINER              docker container running k3s (for the k3s-docker loader)
#   K8S_LIVE_SKIP_KUBECONFORM  1 = skip step 3 (reported as SKIPPED)
#   K8S_LIVE_GIT_HOST          address the cluster uses to reach this machine (step 9; auto-detected)
#   K8S_LIVE_GIT_PORT          port of the throwaway git server (default 18080)
#   K8S_LIVE_FLUX_VERSION      Flux release to install (default v2.4.0)
#   K8S_LIVE_KEEP              1 = keep namespaces/work dir after the run
#   K8S_LIVE_WORKDIR           work directory (default: mktemp -d)
#
# Exit status: 0 only when every step that was not skipped passed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/scripts/k8s-live"
WORKSPACE_DIR="$FIXTURE/workspace"

if [[ -n "${RESHELL_CLI:-}" ]]; then
  read -r -a CLI <<<"$RESHELL_CLI"
else
  CLI=(node "$ROOT/packages/cli/dist/index.js")
fi

WORK="${K8S_LIVE_WORKDIR:-$(mktemp -d "${TMPDIR:-/tmp}/k8s-live.XXXXXX")}"
mkdir -p "$WORK"

NS_RAW=reshell-live-raw
NS_HELM=reshell-live-helm
NS_OP=reshell-live-op
NS_FLUX=reshell-live-flux
IMG=reshell-live-app
CRD_CATALOG='https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'

RESULTS=()
BG_PIDS=()
STEP_NAME=""

# ------------------------------------------------------------------ helpers
log() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
die() {
  printf '\n\033[1;31mFAIL [%s]: %s\033[0m\n' "${STEP_NAME:-setup}" "$*" >&2
  RESULTS+=("${STEP_NAME:-setup}|FAILED|$*")
  summary
  exit 1
}
step() { STEP_NAME="$1"; log "$1"; }
passed() { RESULTS+=("$STEP_NAME|RAN|$*"); info "ok: $*"; }
skipped() { RESULTS+=("$1|SKIPPED|$2"); printf '\n\033[1;33mSKIP %s: %s\033[0m\n' "$1" "$2"; }

summary() {
  printf '\n\033[1m== summary ==\033[0m\n'
  local row name status detail
  for row in "${RESULTS[@]:-}"; do
    [[ -z "$row" ]] && continue
    IFS='|' read -r name status detail <<<"$row"
    printf '  %-34s %-8s %s\n' "$name" "$status" "$detail"
  done
}

need() { command -v "$1" >/dev/null 2>&1 || die "required tool not found on PATH: $1"; }

# json_check <file> <js-expression-over-j> <description>: assert a property of a JSON envelope.
json_check() {
  local file="$1" expr="$2" what="$3"
  node -e '
    const fs = require("fs");
    const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!(eval(process.argv[2]))) {
      console.error("assertion failed: " + process.argv[3]);
      console.error(JSON.stringify(j, null, 2).slice(0, 4000));
      process.exit(1);
    }' "$file" "$expr" "$what" || die "$what"
}

# json_get <file> <js-expression-over-j>: print a value from a JSON file.
json_get() {
  node -e '
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const v = eval(process.argv[2]);
    process.stdout.write(v === undefined || v === null ? "" : String(v));' "$1" "$2"
}

# retry <attempts> <sleep> <cmd...>
retry() {
  local attempts="$1" delay="$2" n=0
  shift 2
  until "$@"; do
    n=$((n + 1))
    [[ "$n" -ge "$attempts" ]] && return 1
    sleep "$delay"
  done
}

cleanup() {
  local rc=$?
  trap - EXIT
  for pid in "${BG_PIDS[@]:-}"; do
    [[ -n "$pid" ]] && kill "$pid" >/dev/null 2>&1 || true
  done
  if [[ "${K8S_LIVE_KEEP:-0}" != "1" ]]; then
    if command -v kubectl >/dev/null 2>&1 && [[ -n "${KUBECONFIG:-}" ]]; then
      kubectl delete rsw --all -A --wait=false >/dev/null 2>&1 || true
      helm uninstall live -n "$NS_HELM" >/dev/null 2>&1 || true
      kubectl delete namespace "$NS_RAW" "$NS_HELM" "$NS_OP" "$NS_FLUX" --wait=false >/dev/null 2>&1 || true
      kubectl delete crd reshellworkspaces.re-shell.io --wait=false >/dev/null 2>&1 || true
      if [[ -f "$WORK/flux-installed" ]]; then
        kubectl delete -f "$WORK/flux-install.yaml" --wait=false >/dev/null 2>&1 || true
      fi
    fi
    [[ "$WORK" == "${K8S_LIVE_WORKDIR:-}" ]] || rm -rf "$WORK"
  else
    info "keeping work dir: $WORK"
  fi
  exit "$rc"
}
trap cleanup EXIT

# ----------------------------------------------------------------- preflight
step "preflight"
[[ -n "${KUBECONFIG:-}" ]] || die "KUBECONFIG is not set (point it at the cluster to test)"
for tool in kubectl helm node curl go docker; do
  if [[ "$tool" == "go" || "$tool" == "docker" ]]; then
    command -v "$tool" >/dev/null 2>&1 || die "required tool not found on PATH: $tool (needed to build/load the fixture app image)"
  else
    need "$tool"
  fi
done
[[ -f "$ROOT/packages/cli/dist/index.js" || -n "${RESHELL_CLI:-}" ]] ||
  die "the CLI is not built (run: pnpm --filter @re-shell/cli build)"
kubectl cluster-info >/dev/null 2>&1 || die "cannot reach the cluster in KUBECONFIG=$KUBECONFIG"
SERVER_VERSION="$(kubectl version -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s).serverVersion;process.stdout.write(v.major+"."+String(v.minor).replace(/\D.*/,""))})')"
KUBE_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
info "cluster: context=${KUBE_CONTEXT:-?} server=v$SERVER_VERSION"
info "helm: $(helm version --short)   kubectl: $(kubectl version --client -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).clientVersion.gitVersion))')"
passed "cluster reachable (v$SERVER_VERSION)"

# --------------------------------------------------- fixture image build + load
IMAGE_LOADER="${K8S_LIVE_IMAGE_LOADER:-}"
KIND_CLUSTER="${K8S_LIVE_KIND_CLUSTER:-}"
if [[ -z "$IMAGE_LOADER" ]]; then
  if [[ "$KUBE_CONTEXT" == kind-* ]]; then
    IMAGE_LOADER=kind
    KIND_CLUSTER="${KIND_CLUSTER:-${KUBE_CONTEXT#kind-}}"
  elif [[ -n "${K3S_CONTAINER:-}" ]]; then
    IMAGE_LOADER=k3s-docker
  else
    IMAGE_LOADER=none
  fi
fi

step "fixture app image"
BUILD_DIR="$WORK/image"
mkdir -p "$BUILD_DIR/v1" "$BUILD_DIR/broken"
GOARCH_TARGET="$(go env GOARCH)"
(cd "$FIXTURE/app" &&
  CGO_ENABLED=0 GOOS=linux GOARCH="$GOARCH_TARGET" go build -trimpath -ldflags "-s -w -X main.version=v1" -o "$BUILD_DIR/v1/app" . &&
  CGO_ENABLED=0 GOOS=linux GOARCH="$GOARCH_TARGET" go build -trimpath -ldflags "-s -w -X main.version=v2-broken -X main.mode=broken" -o "$BUILD_DIR/broken/app" .) ||
  die "go build of the fixture app failed"
cp "$FIXTURE/app/Dockerfile" "$BUILD_DIR/v1/Dockerfile"
cp "$FIXTURE/app/Dockerfile" "$BUILD_DIR/broken/Dockerfile"
docker build -q -t "$IMG:v1" "$BUILD_DIR/v1" >/dev/null || die "docker build $IMG:v1 failed"
docker build -q -t "$IMG:v2-broken" "$BUILD_DIR/broken" >/dev/null || die "docker build $IMG:v2-broken failed"

case "$IMAGE_LOADER" in
  kind)
    need kind
    kind load docker-image --name "$KIND_CLUSTER" "$IMG:v1" "$IMG:v2-broken" >/dev/null || die "kind load docker-image failed"
    ;;
  k3s-docker)
    [[ -n "${K3S_CONTAINER:-}" ]] || die "K3S_CONTAINER must name the docker container running k3s"
    for tag in v1 v2-broken; do
      docker save "$IMG:$tag" | docker exec -i "$K3S_CONTAINER" ctr -n k8s.io images import - >/dev/null ||
        die "importing $IMG:$tag into $K3S_CONTAINER failed"
    done
    ;;
  none) info "image loader: none (assuming the cluster can resolve $IMG:v1 and $IMG:v2-broken)" ;;
  *) die "unknown K8S_LIVE_IMAGE_LOADER '$IMAGE_LOADER' (kind|k3s-docker|none)" ;;
esac
passed "built and loaded $IMG:v1 + $IMG:v2-broken (loader: $IMAGE_LOADER)"

# ------------------------------------------------------------- 1. generation
step "1 generate"
cd "$WORKSPACE_DIR"
"${CLI[@]}" k8s generate --namespace "$NS_RAW" --out "$WORK/raw" --json >"$WORK/gen-raw.json" || die "k8s generate failed"
json_check "$WORK/gen-raw.json" 'j.ok === true && j.data.manifests.length === 10 && j.data.written.length === 10' "k8s generate emitted 10 manifests"
json_check "$WORK/gen-raw.json" 'j.data.kubectl.ran === true && j.data.kubectl.ok === true' "kubectl client dry-run validated the manifests"

"${CLI[@]}" k8s helm generate --out "$WORK/chart" --json >"$WORK/gen-chart.json" || die "k8s helm generate failed"
json_check "$WORK/gen-chart.json" 'j.ok === true && j.data.chart.files.length === 9 && j.data.helm.ran === true && j.data.helm.ok === true' "helm generate emitted a chart that helm lint accepts"
CHART="$WORK/chart/reshell-live"

"${CLI[@]}" k8s gitops generate --tool argocd --namespace "$NS_RAW" --out "$WORK/gitops-argocd" --json >"$WORK/gen-argocd.json" || die "k8s gitops generate (argocd) failed"
"${CLI[@]}" k8s gitops generate --tool flux --namespace "$NS_RAW" --out "$WORK/gitops-flux-preview" --json >"$WORK/gen-flux.json" || die "k8s gitops generate (flux) failed"
json_check "$WORK/gen-argocd.json" 'j.ok === true && j.data.manifests.map(m => m.kind).join() === "Application,Ingress"' "argocd output is Application + Ingress"
json_check "$WORK/gen-flux.json" 'j.ok === true && j.data.manifests.map(m => m.kind).join() === "GitRepository,HelmRelease,Ingress"' "flux output is GitRepository + HelmRelease + Ingress"

"${CLI[@]}" k8s crd --namespace "$NS_OP" --out "$WORK/crd" --json >"$WORK/gen-crd.json" || die "k8s crd failed"
json_check "$WORK/gen-crd.json" 'j.ok === true && j.data.crd.name === "reshellworkspaces.re-shell.io"' "k8s crd emitted the ReShellWorkspace CRD"
"${CLI[@]}" k8s mesh --mesh istio --namespace "$NS_RAW" --out "$WORK/mesh" --json >"$WORK/gen-istio.json" || die "k8s mesh istio failed"
"${CLI[@]}" k8s mesh --mesh linkerd --namespace "$NS_RAW" --out "$WORK/mesh" --json >"$WORK/gen-linkerd.json" || die "k8s mesh linkerd failed"
json_check "$WORK/gen-istio.json" 'j.ok === true && j.data.manifests.some(m => m.kind === "PeerAuthentication")' "istio mesh output has a PeerAuthentication"
json_check "$WORK/gen-linkerd.json" 'j.ok === true && j.data.manifests.some(m => m.kind === "ServiceProfile")' "linkerd mesh output has ServiceProfiles"
passed "all generators produced output from the fixture workspace"

# ------------------------------------------------------------------ 2. helm
step "2 helm lint + template"
helm lint --strict "$CHART" >"$WORK/helm-lint.txt" 2>&1 || { cat "$WORK/helm-lint.txt"; die "helm lint --strict failed"; }
helm template live "$CHART" -n "$NS_HELM" >"$WORK/rendered.yaml" || die "helm template failed"
grep -q 'kind: PodDisruptionBudget' "$WORK/rendered.yaml" || die "rendered chart has no PodDisruptionBudget"
passed "helm lint --strict + helm template ($(grep -c '^kind:' "$WORK/rendered.yaml") resources rendered)"

# ----------------------------------------------------------- 3. kubeconform
if [[ "${K8S_LIVE_SKIP_KUBECONFORM:-0}" == "1" ]]; then
  skipped "3 kubeconform" "K8S_LIVE_SKIP_KUBECONFORM=1"
else
  step "3 kubeconform"
  need kubeconform
  KC_CACHE="$WORK/kubeconform-cache"
  mkdir -p "$KC_CACHE"
  KC=(kubeconform -strict -summary -kubernetes-version "$SERVER_VERSION.0" -cache "$KC_CACHE"
    -schema-location default -schema-location "$CRD_CATALOG")
  "${KC[@]}" "$WORK/raw" || die "kubeconform rejected the raw manifests"
  "${KC[@]}" "$WORK/rendered.yaml" || die "kubeconform rejected the rendered chart"
  "${KC[@]}" "$WORK/gitops-argocd" "$WORK/gitops-flux-preview" || die "kubeconform rejected the GitOps manifests"
  "${KC[@]}" "$WORK/mesh" || die "kubeconform rejected the service-mesh manifests"
  # (The CRD itself has no kubeconform schema; the API server validates it in step 7.)
  passed "raw, chart, argocd, flux, istio and linkerd manifests are schema-valid (k8s $SERVER_VERSION.0)"
fi

# ------------------------------------------------- namespaces (PSS restricted)
make_namespace() {
  kubectl create namespace "$1" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  kubectl label namespace "$1" --overwrite \
    pod-security.kubernetes.io/enforce=restricted \
    pod-security.kubernetes.io/enforce-version=latest >/dev/null
}

# http_check <namespace> <service> <port>: GET /healthz through a port-forward.
http_check() {
  local ns="$1" svc="$2" port="$3" local_port="$4" pf_pid body
  kubectl -n "$ns" port-forward "svc/$svc" "$local_port:$port" >/dev/null 2>&1 &
  pf_pid=$!
  if retry 20 1 curl -fsS --max-time 3 "http://127.0.0.1:$local_port/healthz" >"$WORK/http-$svc.out" 2>/dev/null; then
    body="$(curl -fsS --max-time 3 "http://127.0.0.1:$local_port/" 2>/dev/null || true)"
    kill "$pf_pid" >/dev/null 2>&1 || true
    wait "$pf_pid" 2>/dev/null || true
    printf '%s' "$body"
    return 0
  fi
  kill "$pf_pid" >/dev/null 2>&1 || true
  wait "$pf_pid" 2>/dev/null || true
  return 1
}

deploy_image() { kubectl -n "$1" get deployment "$2" -o jsonpath='{.spec.template.spec.containers[0].image}'; }
available_replicas() { kubectl -n "$1" get deployment "$2" -o jsonpath='{.status.availableReplicas}' 2>/dev/null; }

# Predicates for `retry` (each returns 0 when the condition holds).
has_available() { [[ "$(available_replicas "$1" "$2")" == "$3" ]]; }          # <ns> <deployment> <n>
is_gone() { ! kubectl -n "$1" get "$2" "$3" >/dev/null 2>&1; }                # <ns> <kind> <name>
pod_count_is() { [[ "$(kubectl -n "$1" get pods -l "$2" --no-headers 2>/dev/null | grep -c .)" == "$3" ]]; }  # <ns> <selector> <n>
serving_image() {                                                              # <ns> <deployment> <image> <available>
  [[ "$(deploy_image "$1" "$2")" == "$3" && "$(available_replicas "$1" "$2")" == "$4" ]]
}
helm_has_rollback() {                                                          # <ns> <release>
  helm history "$2" -n "$1" -o json 2>/dev/null |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.exit(JSON.parse(s).some(r=>/Rollback to/.test(r.description))?0:1)}catch(e){process.exit(1)}})'
}

# ------------------------------------------------- 4. apply raw + rollout
step "4 apply raw manifests"
make_namespace "$NS_RAW"
kubectl apply -f "$WORK/raw" >"$WORK/apply-raw.txt" || { cat "$WORK/apply-raw.txt"; die "kubectl apply of the raw manifests failed"; }
for svc in web worker; do
  kubectl -n "$NS_RAW" rollout status "deployment/$svc" --timeout=180s || die "deployment/$svc did not roll out (see events: kubectl -n $NS_RAW get events)"
done
[[ "$(kubectl -n "$NS_RAW" get deployment web -o jsonpath='{.status.availableReplicas}')" == "2" ]] || die "web should have 2 available replicas"
[[ "$(kubectl -n "$NS_RAW" get deployment worker -o jsonpath='{.status.availableReplicas}')" == "1" ]] || die "worker should have 1 available replica"
kubectl -n "$NS_RAW" get pdb web worker >/dev/null || die "PodDisruptionBudgets were not created"
[[ "$(kubectl -n "$NS_RAW" get pdb web -o jsonpath='{.spec.minAvailable}')" == "1" ]] || die "web PDB should keep 1 pod available"
[[ "$(kubectl -n "$NS_RAW" get pdb worker -o jsonpath='{.spec.maxUnavailable}')" == "1" ]] || die "single-replica worker PDB should use maxUnavailable"
kubectl -n "$NS_RAW" get hpa web >/dev/null || die "HorizontalPodAutoscaler was not created"
[[ "$(kubectl -n "$NS_RAW" get hpa web -o jsonpath='{.spec.metrics[*].type}')" == *Pods* ]] || die "HPA lacks the Pods custom metric"
kubectl -n "$NS_RAW" get networkpolicy web-default-deny-allow-intra >/dev/null || die "NetworkPolicy was not created"
# The API server enforced PSS "restricted" at admission: the pods exist, so the securityContexts conform.
[[ "$(kubectl -n "$NS_RAW" get pods -l app=web -o jsonpath='{.items[0].spec.containers[0].securityContext.readOnlyRootFilesystem}')" == "true" ]] ||
  die "running pod lacks readOnlyRootFilesystem"
[[ "$(kubectl -n "$NS_RAW" get pods -l app=web -o jsonpath='{.items[0].spec.securityContext.runAsNonRoot}')" == "true" ]] || die "running pod lacks runAsNonRoot"
BODY="$(http_check "$NS_RAW" web 8080 18081)" || die "web did not answer /healthz through the Service"
[[ "$BODY" == *"service=web version=v1"* ]] || die "unexpected web response: $BODY"
passed "deployments rolled out under PSS restricted; PDB/HPA/NetworkPolicy present; /healthz OK ($BODY)"

# ------------------------------------------------- 5. broken upgrade + rollback
step "5 broken upgrade -> detect -> rollback (kubectl)"
REV_BEFORE="$(kubectl -n "$NS_RAW" get deployment web -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')"
kubectl -n "$NS_RAW" set image deployment/web "web=$IMG:v2-broken" >/dev/null || die "could not set the broken image"
if kubectl -n "$NS_RAW" rollout status deployment/web --timeout=90s >"$WORK/rollout-broken.txt" 2>&1; then
  die "the broken image unexpectedly rolled out; failure detection did not trigger"
fi
info "failed rollout detected: $(tail -1 "$WORK/rollout-broken.txt")"
# maxUnavailable: 0 keeps the old pods serving while the new ReplicaSet crash-loops.
BODY="$(http_check "$NS_RAW" web 8080 18082)" || die "web stopped serving during the failed rollout (zero-downtime strategy broken)"
[[ "$BODY" == *"version=v1"* ]] || die "expected the old pods to keep serving v1, got: $BODY"

"${CLI[@]}" k8s rollback web --namespace "$NS_RAW" --dry-run --json >"$WORK/rollback-dry.json" || die "k8s rollback --dry-run failed"
json_check "$WORK/rollback-dry.json" 'j.ok === true && j.data.dryRun === true && j.data.rolledBack === false && j.data.method === "kubectl"' "rollback --dry-run planned a kubectl rollback"
[[ "$(deploy_image "$NS_RAW" web)" == "$IMG:v2-broken" ]] || die "--dry-run must not change the cluster"

"${CLI[@]}" k8s rollback web --namespace "$NS_RAW" --timeout 120 --json >"$WORK/rollback.json" || { cat "$WORK/rollback.json"; die "k8s rollback failed"; }
json_check "$WORK/rollback.json" 'j.ok === true && j.data.method === "kubectl" && j.data.rolledBack === true && j.data.toRevision === '"$REV_BEFORE" "rollback returned to revision $REV_BEFORE"
[[ "$(deploy_image "$NS_RAW" web)" == "$IMG:v1" ]] || die "web image was not restored to v1"
kubectl -n "$NS_RAW" rollout status deployment/web --timeout=120s || die "web is not healthy after the rollback"
retry 30 2 pod_count_is "$NS_RAW" app=web 2 || die "stale pods of the broken ReplicaSet were not cleaned up"
BODY="$(http_check "$NS_RAW" web 8080 18083)" || die "web does not answer after the rollback"
[[ "$BODY" == *"version=v1"* ]] || die "web is not serving v1 after the rollback: $BODY"

"${CLI[@]}" k8s rollback does-not-exist --namespace "$NS_RAW" --json >"$WORK/rollback-missing.json" && die "rolling back a missing service must exit non-zero"
json_check "$WORK/rollback-missing.json" 'j.ok === false && j.error.code === "K8S_ROLLBACK_ERROR" && j.error.details.reason === "NOT_FOUND"' "missing service reports NOT_FOUND"
passed "broken rollout detected, rolled back (rev $REV_BEFORE), web healthy again; --dry-run and error exit codes verified"

# --------------------------------------------------------- 6. helm release
step "6 helm release: install -> broken upgrade -> rollback (helm)"
make_namespace "$NS_HELM"
helm upgrade --install live "$CHART" -n "$NS_HELM" --wait --timeout 180s >"$WORK/helm-install.txt" 2>&1 || { cat "$WORK/helm-install.txt"; die "helm install failed"; }
[[ "$(kubectl -n "$NS_HELM" get deployment web -o jsonpath='{.status.availableReplicas}')" == "2" ]] || die "helm release: web should have 2 available replicas"
if helm upgrade live "$CHART" -n "$NS_HELM" --reuse-values --set services.web.image.tag=v2-broken --wait --timeout 75s >"$WORK/helm-broken.txt" 2>&1; then
  die "helm upgrade to the broken image unexpectedly succeeded"
fi
info "failed helm upgrade detected: $(tail -1 "$WORK/helm-broken.txt")"
"${CLI[@]}" k8s rollback web --namespace "$NS_HELM" --timeout 150 --json >"$WORK/rollback-helm.json" || { cat "$WORK/rollback-helm.json"; die "k8s rollback (helm) failed"; }
json_check "$WORK/rollback-helm.json" 'j.ok === true && j.data.method === "helm" && j.data.release === "live" && j.data.rolledBack === true && j.data.toRevision === 1' "rollback used helm rollback to revision 1"
[[ "$(deploy_image "$NS_HELM" web)" == "$IMG:v1" ]] || die "helm release: web image was not restored to v1"
[[ "$(helm status live -n "$NS_HELM" -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).info.status))')" == "deployed" ]] ||
  die "helm release is not in the deployed state after the rollback"
kubectl -n "$NS_HELM" rollout status deployment/web --timeout=120s || die "helm release: web is not healthy after the rollback"
BODY="$(http_check "$NS_HELM" web 8080 18084)" || die "helm release: web does not answer after the rollback"
[[ "$BODY" == *"version=v1"* ]] || die "helm release: web is not serving v1: $BODY"
passed "helm upgrade failed, 're-shell k8s rollback' ran helm rollback to revision 1, release deployed and serving v1"

# ----------------------------------------------------------------- 7. CRD
step "7 CRD install + custom resources"
kubectl apply --server-side -f "$WORK/crd/crd/reshellworkspaces.re-shell.io.yaml" >/dev/null || die "installing the CRD failed"
kubectl wait --for=condition=Established crd/reshellworkspaces.re-shell.io --timeout=60s >/dev/null || die "CRD did not become Established"
make_namespace "$NS_OP"
SAMPLE="$WORK/crd/samples/reshell-live.yaml"
kubectl apply --dry-run=server -f "$SAMPLE" >/dev/null || die "the sample CR was rejected by the API server"
# The derived schema really validates: a bad language and a mismatched service name must be rejected.
sed 's/language: go/language: cobol/' "$SAMPLE" >"$WORK/bad-language.yaml"
if kubectl apply --dry-run=server -f "$WORK/bad-language.yaml" >"$WORK/bad-language.txt" 2>&1; then die "an invalid language was accepted"; fi
grep -q 'Unsupported value: "cobol"' "$WORK/bad-language.txt" || { cat "$WORK/bad-language.txt"; die "unexpected rejection message for an invalid language"; }
sed '0,/^      name: web$/s//      name: webx/' "$SAMPLE" >"$WORK/bad-name.yaml"
if kubectl apply --dry-run=server -f "$WORK/bad-name.yaml" >"$WORK/bad-name.txt" 2>&1; then die "a service whose name differs from its key was accepted"; fi
grep -q 'each service name must match its key' "$WORK/bad-name.txt" || { cat "$WORK/bad-name.txt"; die "unexpected rejection message for a mismatched service name"; }
kubectl get crd reshellworkspaces.re-shell.io -o jsonpath='{.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.services.additionalProperties.properties.kubernetes.properties.securityContext.properties.readOnlyRootFilesystem.type}' | grep -q boolean ||
  die "the installed CRD does not carry the derived kubernetes.securityContext schema"
passed "CRD Established; sample CR accepted; invalid language and mismatched service name rejected by the API server"

# -------------------------------------------------------------- 8. operator
if [[ "${K8S_LIVE_OPERATOR:-0}" != "1" ]]; then
  skipped "8 operator" "K8S_LIVE_OPERATOR is not 1 (set it to build and run the generated Go operator)"
  kubectl apply -f "$SAMPLE" >/dev/null || die "applying the sample CR failed"
  passed "sample CR applied (no operator running)"
else
  step "8 operator: build, run, reconcile"
  "${CLI[@]}" k8s operator --out "$WORK/operator" --namespace "$NS_OP" --verify --json >"$WORK/gen-operator.json" || { cat "$WORK/gen-operator.json"; die "generated operator failed to build"; }
  json_check "$WORK/gen-operator.json" 'j.ok === true && j.data.build.ran === true && j.data.build.ok === true' "go mod tidy + go build + go vet passed"
  (cd "$WORK/operator" && go build -o "$WORK/manager" .) || die "go build of the operator failed"
  "$WORK/manager" --metrics-bind-address=0 --health-probe-bind-address=:18091 >"$WORK/operator.log" 2>&1 &
  BG_PIDS+=("$!")
  retry 30 1 curl -fsS "http://127.0.0.1:18091/healthz" >/dev/null || { tail -30 "$WORK/operator.log"; die "the operator did not become healthy"; }
  kubectl apply -f "$SAMPLE" >/dev/null || die "applying the sample CR failed"
  kubectl -n "$NS_OP" wait "rsw/reshell-live" --for=jsonpath='{.status.phase}'=Ready --timeout=240s || {
    tail -30 "$WORK/operator.log"
    kubectl -n "$NS_OP" get rsw reshell-live -o yaml | tail -40
    kubectl -n "$NS_OP" get events | tail -20
    die "the ReShellWorkspace did not become Ready"
  }
  for svc in web worker; do
    [[ "$(kubectl -n "$NS_OP" get deployment "$svc" -o jsonpath='{.metadata.ownerReferences[0].kind}')" == "ReShellWorkspace" ]] || die "$svc Deployment is not owned by the ReShellWorkspace"
    kubectl -n "$NS_OP" get service "$svc" >/dev/null || die "operator did not create Service/$svc"
  done
  [[ "$(deploy_image "$NS_OP" web)" == "$IMG:v1" ]] || die "operator-created web Deployment has the wrong image"
  [[ "$(kubectl -n "$NS_OP" get deployment web -o jsonpath='{.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem}')" == "true" ]] || die "operator-created Deployment is not hardened"
  [[ "$(kubectl -n "$NS_OP" get deployment web -o jsonpath='{.status.availableReplicas}')" == "2" ]] || die "operator-created web should have 2 available replicas"
  kubectl -n "$NS_OP" get pdb web >/dev/null || die "operator did not create the PodDisruptionBudget"
  BODY="$(http_check "$NS_OP" web 8080 18085)" || die "operator-created web does not answer"
  # Reconcile a spec change: scale web through scaling.min.
  kubectl -n "$NS_OP" patch rsw reshell-live --type=json -p '[{"op":"replace","path":"/spec/services/web/scaling/min","value":3}]' >/dev/null || die "patching the CR failed"
  retry 60 2 has_available "$NS_OP" web 3 || { tail -20 "$WORK/operator.log"; die "operator did not scale web to 3 replicas"; }
  # Prune a removed service.
  kubectl -n "$NS_OP" patch rsw reshell-live --type=json -p '[{"op":"remove","path":"/spec/services/worker"}]' >/dev/null || die "removing the worker service failed"
  retry 60 2 is_gone "$NS_OP" deployment worker || die "operator did not prune the removed worker Deployment"
  retry 30 2 is_gone "$NS_OP" service worker || die "operator did not prune the removed worker Service"
  # Deleting the CR garbage-collects everything it owns.
  kubectl -n "$NS_OP" delete rsw reshell-live --wait=true --timeout=60s >/dev/null || die "deleting the CR failed"
  retry 60 2 is_gone "$NS_OP" deployment web || die "owned Deployment was not garbage-collected"
  passed "operator built (go build/vet), reconciled the CR to Ready, scaled web 2->3, pruned worker, garbage-collected on delete"
fi

# ---------------------------------------------------------------- 9. gitops
case "${K8S_LIVE_GITOPS:-none}" in
  flux)
    step "9 gitops: Flux install + sync + broken release remediation"
    need git
    need python3
    FLUX_VERSION="${K8S_LIVE_FLUX_VERSION:-v2.4.0}"
    curl -fsSL "https://github.com/fluxcd/flux2/releases/download/$FLUX_VERSION/install.yaml" -o "$WORK/flux-install.yaml" || die "could not download the Flux $FLUX_VERSION install manifest"
    kubectl apply --server-side --force-conflicts -f "$WORK/flux-install.yaml" >/dev/null || die "installing Flux failed"
    : >"$WORK/flux-installed"
    # Only the source and helm controllers are needed for GitRepository + HelmRelease.
    for d in kustomize-controller notification-controller image-reflector-controller image-automation-controller; do
      kubectl -n flux-system scale deployment "$d" --replicas=0 >/dev/null 2>&1 || true
    done
    for d in source-controller helm-controller; do
      kubectl -n flux-system rollout status "deployment/$d" --timeout=300s || die "Flux $d did not become ready"
    done

    # A throwaway git server so the in-cluster controller can clone a repo that only exists here.
    GIT_PORT="${K8S_LIVE_GIT_PORT:-18080}"
    GIT_HOST="${K8S_LIVE_GIT_HOST:-}"
    if [[ -z "$GIT_HOST" ]]; then
      case "$IMAGE_LOADER" in
        kind) GIT_HOST="$(docker network inspect kind -f '{{range .IPAM.Config}}{{.Gateway}} {{end}}' | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)" ;;
        k3s-docker) GIT_HOST="$(docker network inspect "$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$K3S_CONTAINER" | awk '{print $1}')" -f '{{range .IPAM.Config}}{{.Gateway}} {{end}}' | awk '{print $1}')" ;;
      esac
    fi
    [[ -n "$GIT_HOST" ]] || die "cannot determine the address the cluster uses to reach this machine; set K8S_LIVE_GIT_HOST"
    mkdir -p "$WORK/git" "$WORK/gitwork"
    git init -q --bare -b main "$WORK/git/app.git"
    git -C "$WORK/git/app.git" config http.receivepack false
    python3 "$FIXTURE/git-http-server.py" "$WORK/git" "$GIT_PORT" 0.0.0.0 >"$WORK/git-server.log" 2>&1 &
    BG_PIDS+=("$!")
    retry 20 1 curl -fsS "http://127.0.0.1:$GIT_PORT/app.git/info/refs?service=git-upload-pack" -o /dev/null || { cat "$WORK/git-server.log"; die "the git HTTP server did not start (git http-backend available?)"; }

    git init -q -b main "$WORK/gitwork"
    mkdir -p "$WORK/gitwork/charts"
    cp -r "$CHART" "$WORK/gitwork/charts/reshell-live"
    git -C "$WORK/gitwork" add -A
    git -C "$WORK/gitwork" -c user.name=reshell-live -c user.email=live@reshell.invalid commit -q -m "release v1"
    git -C "$WORK/gitwork" push -q "$WORK/git/app.git" main || die "seeding the git repository failed"

    "${CLI[@]}" k8s gitops generate --tool flux --namespace "$NS_FLUX" \
      --repo-url "http://$GIT_HOST:$GIT_PORT/app.git" --revision main --chart-path charts/reshell-live \
      --out "$WORK/gitops-flux" --json >"$WORK/gen-flux-live.json" || die "k8s gitops generate (flux) failed"
    make_namespace "$NS_FLUX"
    kubectl apply -f "$WORK/gitops-flux" >/dev/null || die "applying the generated Flux manifests failed"
    # Speed-up for the test only: shorten the Helm wait so a bad release fails in a minute instead of five.
    kubectl -n flux-system patch helmrelease reshell-live --type merge -p '{"spec":{"timeout":"60s"}}' >/dev/null || die "patching the HelmRelease timeout failed"
    kubectl -n flux-system wait helmrelease/reshell-live --for=condition=Ready --timeout=300s || {
      kubectl -n flux-system get gitrepository,helmrelease -o wide
      kubectl -n flux-system describe helmrelease reshell-live | tail -30
      die "Flux did not install the chart from the generated GitRepository + HelmRelease"
    }
    [[ "$(deploy_image "$NS_FLUX" web)" == "$IMG:v1" ]] || die "Flux-installed web has the wrong image"
    kubectl -n "$NS_FLUX" get ingress reshell-live >/dev/null || die "the generated Ingress was not applied"
    [[ "$(kubectl -n "$NS_FLUX" get ingress reshell-live -o jsonpath='{.metadata.annotations.cert-manager\.io/cluster-issuer}')" == "letsencrypt-staging" ]] || die "Ingress lacks the cert-manager issuer annotation"
    [[ "$(kubectl -n "$NS_FLUX" get ingress reshell-live -o jsonpath='{.spec.tls[0].secretName}')" == "reshell-live-tls" ]] || die "Ingress lacks the TLS secret"
    [[ "$(kubectl -n "$NS_FLUX" get ingress -o name | grep -c .)" == "1" ]] || die "expected exactly one Ingress (the chart ingresses must be switched off)"
    info "Flux installed the chart: HelmRelease Ready, web serving v1"

    # Push a broken release; Flux must try it, fail, and roll back to the last good revision.
    sed -i "s/tag: v1/tag: v2-broken/" "$WORK/gitwork/charts/reshell-live/values.yaml"
    git -C "$WORK/gitwork" -c user.name=reshell-live -c user.email=live@reshell.invalid commit -q -am "release v2 (broken)"
    git -C "$WORK/gitwork" push -q "$WORK/git/app.git" main || die "pushing the broken release failed"
    retry 90 5 helm_has_rollback "$NS_FLUX" reshell-live || {
      kubectl -n flux-system describe helmrelease reshell-live | tail -40
      helm history reshell-live -n "$NS_FLUX" || true
      die "Flux did not roll the failed upgrade back (no 'Rollback to' entry in the Helm history)"
    }
    HR_REASONS="$(kubectl -n flux-system get helmrelease reshell-live -o jsonpath='{range .status.conditions[*]}{.type}={.status}/{.reason} {end}')"
    info "HelmRelease conditions: $HR_REASONS"
    kubectl -n flux-system get helmrelease reshell-live -o jsonpath='{.status.upgradeFailures}' | grep -Eq '^[1-9]' || die "HelmRelease did not record an upgrade failure"
    retry 90 5 serving_image "$NS_FLUX" web "$IMG:v1" 2 ||
      die "web is not back on v1 with 2 available replicas after Flux's remediation"
    BODY="$(http_check "$NS_FLUX" web 8080 18086)" || die "web does not answer after Flux's remediation"
    [[ "$BODY" == *"version=v1"* ]] || die "web is not serving v1 after Flux's remediation: $BODY"
    passed "Flux installed the generated HelmRelease, a broken release failed to upgrade and was rolled back (Helm history 'Rollback to'), web serving v1"
    ;;
  none | "") skipped "9 gitops" "K8S_LIVE_GITOPS is not set (set it to 'flux' to install Flux and sync the generated GitOps manifests)" ;;
  *) die "unsupported K8S_LIVE_GITOPS '${K8S_LIVE_GITOPS}' (supported: flux)" ;;
esac

STEP_NAME="done"
summary
printf '\n\033[1;32mk8s-live-check: all executed steps passed\033[0m\n'
