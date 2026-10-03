#!/usr/bin/env bash
# k3s-docker.sh - a throwaway single-node Kubernetes cluster (k3s) in Docker, for
# running scripts/k8s-live-check.sh on a machine that has Docker but no cluster.
#
#   scripts/k8s-live/k3s-docker.sh up     # start + wait until the node and coredns are Ready
#   scripts/k8s-live/k3s-docker.sh down   # remove the container
#   scripts/k8s-live/k3s-docker.sh env    # print the exports for k8s-live-check.sh
#
#   export KUBECONFIG=$PWD/k3s-kubeconfig.yaml K3S_CONTAINER=reshell-k3s
#   scripts/k8s-live-check.sh
#
# This is a real cluster (real kubelet and API server), unlike envtest, and works
# where `kind create cluster` cannot (sandboxes whose kubeadm wait-control-plane
# step fails). On GitHub Actions use helm/kind-action instead (see
# .github/workflows/k8s-live.yml).
#
# Workarounds for restricted hosts, all harmless on a normal Docker host:
#   * K3S_CA_BUNDLE=<file>  trust an extra CA bundle inside k3s (registries reached
#                           through a TLS-intercepting proxy)
#   * containerd `restrict_oom_score_adj = true`  containers that lack
#                           CAP_SYS_RESOURCE cannot lower oom_score_adj, which makes runc
#                           fail with "can't get final child's PID from pipe: EOF"
#   * relaxed kubelet eviction thresholds (500Mi absolute): a thin-provisioned disk reporting a
#                           small free percentage makes the node DiskPressure-tainted and
#                           unschedulable
#
# Environment: K3S_CONTAINER (reshell-k3s), K3S_IMAGE (rancher/k3s:v1.31.5-k3s1),
# K3S_API_PORT (6443), K3S_KUBECONFIG (./k3s-kubeconfig.yaml), K3S_CA_BUNDLE (none).

set -euo pipefail

NAME="${K3S_CONTAINER:-reshell-k3s}"
IMAGE="${K3S_IMAGE:-rancher/k3s:v1.31.5-k3s1}"
PORT="${K3S_API_PORT:-6443}"
KUBECONFIG_OUT="${K3S_KUBECONFIG:-$PWD/k3s-kubeconfig.yaml}"
CA_BUNDLE="${K3S_CA_BUNDLE:-}"

die() { echo "k3s-docker: $*" >&2; exit 1; }

kubectl_in() { docker exec "$NAME" kubectl "$@"; }

wait_for() { # <description> <attempts> <cmd...>
  local what="$1" attempts="$2" n=0
  shift 2
  until "$@" >/dev/null 2>&1; do
    n=$((n + 1))
    [[ "$n" -ge "$attempts" ]] && die "timed out waiting for $what (docker logs $NAME)"
    sleep 3
  done
}

node_ready() { kubectl_in get nodes 2>/dev/null | grep -q ' Ready'; }
coredns_ready() { kubectl_in -n kube-system get deploy coredns -o jsonpath='{.status.readyReplicas}' 2>/dev/null | grep -q '^[1-9]'; }

up() {
  command -v docker >/dev/null 2>&1 || die "docker is required"
  docker rm -f "$NAME" >/dev/null 2>&1 || true

  local ca_args=()
  if [[ -n "$CA_BUNDLE" ]]; then
    [[ -f "$CA_BUNDLE" ]] || die "K3S_CA_BUNDLE=$CA_BUNDLE does not exist"
    ca_args=(-e SSL_CERT_FILE=/ca.crt -v "$CA_BUNDLE:/ca.crt:ro")
  fi

  docker run -d --privileged --name "$NAME" --hostname "$NAME" \
    -p "$PORT:6443" -e K3S_KUBECONFIG_MODE=644 "${ca_args[@]}" \
    "$IMAGE" server --disable traefik --disable metrics-server \
    --kubelet-arg=cgroups-per-qos=false --kubelet-arg=enforce-node-allocatable= \
    '--kubelet-arg=eviction-hard=imagefs.available<500Mi,nodefs.available<500Mi,nodefs.inodesFree<1%' \
    >/dev/null || die "could not start $IMAGE"

  # k3s renders containerd's config on first start; extend it and restart once.
  wait_for "containerd config" 60 docker exec "$NAME" test -f /var/lib/rancher/k3s/agent/etc/containerd/config.toml
  docker exec -i "$NAME" sh -s <<'EOS' || die "could not extend the containerd config"
set -e
d=/var/lib/rancher/k3s/agent/etc/containerd
cp "$d/config.toml" "$d/config.toml.tmpl"
sed -i 's/^\[plugins."io.containerd.grpc.v1.cri"\]$/[plugins."io.containerd.grpc.v1.cri"]\n  restrict_oom_score_adj = true/' "$d/config.toml.tmpl"
grep -q restrict_oom_score_adj "$d/config.toml.tmpl"
EOS
  docker restart "$NAME" >/dev/null

  wait_for "the Kubernetes API" 60 kubectl_in get --raw=/readyz
  wait_for "the node to be Ready" 60 node_ready
  wait_for "coredns" 100 coredns_ready

  umask 077
  docker exec "$NAME" cat /etc/rancher/k3s/k3s.yaml | sed "s#https://127.0.0.1:6443#https://127.0.0.1:$PORT#" >"$KUBECONFIG_OUT"
  echo "k3s is ready."
  env_hint
}

env_hint() {
  echo "export KUBECONFIG=$KUBECONFIG_OUT K3S_CONTAINER=$NAME"
}

case "${1:-}" in
  up) up ;;
  down) docker rm -f "$NAME" >/dev/null 2>&1 || true; echo "removed $NAME" ;;
  env) env_hint ;;
  *) die "usage: $0 up|down|env" ;;
esac
