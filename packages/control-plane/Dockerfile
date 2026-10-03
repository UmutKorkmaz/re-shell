# syntax=docker/dockerfile:1.7
#
# Re-Shell hosted control plane — multi-stage image.
#
# Build from the REPOSITORY ROOT (the build needs the pnpm workspace):
#
#   docker build -f packages/control-plane/Dockerfile --target control-plane \
#     -t re-shell/control-plane .
#   docker build -f packages/control-plane/Dockerfile --target worker \
#     -t re-shell/control-plane-worker .
#
# Behind a TLS-intercepting proxy, pass its CA bundle as a build secret (it is
# never stored in an image layer):
#
#   docker build --secret id=cacert,src=/path/to/ca-bundle.crt ...
#
# Targets
#   control-plane  the HTTP/SSE server (+ the `issue-token`/`gen-key`/`migrate` tools)
#   worker         an execution worker: control-plane bin + the re-shell CLI
#
# All configuration is read from CONTROL_PLANE_* environment variables at run
# time; nothing secret is baked into an image.

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# build: install the workspace subset, compile, and `pnpm deploy` two
# self-contained production trees (no dev dependencies, no source).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG PNPM_VERSION=9.15.9
# Lifecycle scripts are skipped: the build only needs `tsc`, and the workspace
# contains native dev-only modules (node-pty, cpu-features) that would need a
# C++ toolchain. The production trees below contain no native addons — the
# control plane uses Node's built-in node:sqlite.
ENV CI=true \
    npm_config_ignore_scripts=true
WORKDIR /repo

RUN --mount=type=secret,id=cacert,required=false \
    if [ -f /run/secrets/cacert ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; fi; \
    npm install --global --no-audit --no-fund "pnpm@${PNPM_VERSION}"

# Build context is filtered by Dockerfile.dockerignore (no node_modules, dist, site, ...).
COPY . .

RUN --mount=type=secret,id=cacert,required=false \
    --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    if [ -f /run/secrets/cacert ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; fi; \
    pnpm install --frozen-lockfile \
      --filter "@re-shell/control-plane..." \
      --filter "@re-shell/cli..."

RUN pnpm --filter @re-shell/contracts run build \
 && pnpm --filter @re-shell/control-plane run build \
 && pnpm --filter @re-shell/cli run build

# `pnpm deploy` runs a production install into the target directory (it still
# resolves package metadata), so it needs the CA secret too when one is in use.
RUN --mount=type=secret,id=cacert,required=false \
    --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    if [ -f /run/secrets/cacert ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; fi; \
    pnpm --filter @re-shell/control-plane --prod deploy /out/control-plane \
 && pnpm --filter @re-shell/cli --prod deploy /out/re-shell-cli

# WORKAROUND: packages/cli imports `zod` (utils/policy-engine.js) but does not
# declare it in its dependencies; it only resolves in the monorepo through
# hoisting. Expose the zod copy that @re-shell/contracts brings along so the
# deployed CLI can load. Fails the build if no zod is present. Remove once the
# CLI declares the dependency.
RUN ZOD_DIR="$(find /out/re-shell-cli/node_modules/.pnpm -maxdepth 4 -type d -path '*/node_modules/zod' | head -1)" \
 && test -n "$ZOD_DIR" \
 && ln -s "${ZOD_DIR#/out/re-shell-cli/node_modules/}" /out/re-shell-cli/node_modules/zod \
 && node -e "require('/out/re-shell-cli/node_modules/zod')"

# ---------------------------------------------------------------------------
# control-plane: the server image.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS control-plane
ENV NODE_ENV=production \
    CONTROL_PLANE_HOST=0.0.0.0 \
    CONTROL_PLANE_PORT=8787 \
    CONTROL_PLANE_DB=/data/control-plane.db
WORKDIR /app
COPY --from=build --chown=node:node /out/control-plane/ /app/
# The SQLite database lives on a volume owned by the unprivileged user.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.CONTROL_PLANE_PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["node", "/app/dist/bin.js"]
CMD ["serve"]

# ---------------------------------------------------------------------------
# worker: control-plane bin (worker mode) + the re-shell CLI it executes.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS worker
# Extra OS packages the CLI commands you allow may need, e.g.
#   --build-arg WORKER_APT_PACKAGES="git"
ARG WORKER_APT_PACKAGES=""
RUN if [ -n "${WORKER_APT_PACKAGES}" ]; then \
      apt-get update \
   && apt-get install -y --no-install-recommends ${WORKER_APT_PACKAGES} \
   && rm -rf /var/lib/apt/lists/*; \
    fi
ENV NODE_ENV=production \
    RE_SHELL_CLI_BIN=/opt/re-shell/dist/index.js \
    CONTROL_PLANE_WORKSPACE_ROOT=/workspaces
WORKDIR /app
COPY --from=build --chown=node:node /out/control-plane/ /app/
COPY --from=build --chown=node:node /out/re-shell-cli/ /opt/re-shell/
# Workspaces are mounted (or cloned) under /workspaces/<workspaceId>.
RUN mkdir -p /workspaces && chown node:node /workspaces
VOLUME ["/workspaces"]
USER node
ENTRYPOINT ["node", "/app/dist/bin.js"]
CMD ["worker"]
