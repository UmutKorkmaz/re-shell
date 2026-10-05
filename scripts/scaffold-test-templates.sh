#!/bin/bash
# CI job: scaffold a representative set of backend templates and verify each one
# really builds with its own language toolchain. Catches the class of bugs where
# a template's generated code references services/deps/files that don't exist
# (the #76 express bug).
#
#   Node / TypeScript / Bun   pnpm install, then tsc --noEmit
#   Python                    venv, pip install, compileall, import the app
#   Go                        go mod tidy, go build ./...
#   Rust                      cargo check
#   PHP                       php -l on every file, composer install; Laravel apps also
#                             boot (artisan route:list) and run their PHPUnit suite
#   Ruby                      ruby -c on every file, bundle install
#   Java (Maven)              mvn -DskipTests package
#   Kotlin / Java (Gradle)    gradle build -x test
#   Scala (sbt)               sbt Test/compile
#   C# / F# (.NET)            dotnet build, every project file (tests included)
#   Perl                      perl -c on every module, script and test
#   Lua                       luac -p on every file (syntax only: LuaRocks is not
#                             reachable from every CI network, so dependencies are
#                             not resolved)
#   C++ (CMake)               cmake configure + build
#   C++ (Crow)                cmake configure (fetches Crow) + build + ctest
#   Zig                       zig build, plus zig build test when build.zig has a test
#                             step; an unpinned URL dependency is fetched and hashed first
#   Plain JavaScript          pnpm install, node --check, and every import/require
#                             must resolve (scripts/check-js-imports.mjs)
#   ReScript                  pnpm install, rescript build, the generated and hand-written
#                             JavaScript must parse and resolve its imports, then the
#                             app's own tests (npm test)
#   Dart                      dart pub get, dart analyze (errors and warnings fail)
#   Haskell (Cabal)           cabal build all (tests included), cabal test
#   Deno (Oak, Fresh, Aleph)  deno check on every module, deno task build when the app has
#                             one, deno test; dependencies come from JSR and npm
#   Elixir (Plug, Nerves,     mix deps.get, mix compile, mix test (Phoenix: compile only,
#     Phoenix)                its tests need a database); Nerves builds for the host
#   Gleam (Wisp)              gleam deps download, gleam build, gleam test
#   Swift (SwiftPM)           swift build --build-tests, swift test (Vapor: swift build)
#   Julia (Genie, Oxygen)     Pkg.instantiate, Pkg.precompile, Pkg.test
#   Nim (Jester, Prologue,    nimble install --depsOnly, nimble build, nimble test
#     HappyX)
#   Crystal (Kemal, Lucky,    shards install, shards build, crystal spec (type-checked only
#     Amber)                  when the specs need PostgreSQL and none is running)
#   OCaml (Dream, Opium)      opam install --deps-only, dune build, dune runtest
#   Clojure (Leiningen)       lein deps, lein check, lein test
#   V (veb, vex)              v fmt -verify, v build, v test
#   Odin (odin-http)          odin build, odin test
#   Pony (Jennet)             corral fetch, ponyc (app and tests), run the tests
#   Ballerina                 bal build, bal test
#   Grain                     grain compile + run, then the compiled test program
#   Unison                    ucm transcript: typecheck, add, run the self-test
#   Mojo                      mojo build, the Mojo test programs, boot the server; FastAPI +
#                             Mojo: build the extension module, pytest, boot the server
#   Red                       red -r (tests and server), run the tests, boot the server
#   Configuration-only        every YAML file must parse (scripts/check-yaml.mjs)
#
# A template is only SKIPped when its language toolchain is genuinely missing
# from the machine; the reason is printed next to the SKIP and repeated in the
# summary. Nothing is ever reported as passed without being checked with its
# own toolchain; a pass that checked less than a full build (Lua and
# configuration templates: syntax only) prints a NOTE saying so.
#
# Usage: bash scripts/scaffold-test-templates.sh [template ...]
#        bash scripts/scaffold-test-templates.sh --group core|jvm|dotnet|native|node|config|haskell|deno|swift|julia|nim|crystal|ocaml|clojure|beam|systems|exotic|exoticb ...
# Runs from the repo root after `pnpm -r build`.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_BIN="$REPO_ROOT/packages/cli/dist/index.js"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Every backend template that builds with a toolchain available in CI. The
# list is split into groups so CI can run them as parallel jobs (each group
# needs a different set of toolchains); with no arguments every group runs.
# Templates that cannot be built here (broken as shipped, or their toolchain or
# dependency registry is unavailable) are deliberately not listed rather than
# listed and skipped (the sweep commit message records each exclusion and why).
GROUP_CORE=(
  express fastify nestjs koa hono
  fastapi flask django
  gin echo fiber
  actix-web rocket axum
  spring-boot quarkus
  laravel rails-api
  phoenix vapor
  elysia-bun bun-serve trpc-bun
  zig-http std-http-zig zap-zig
)
# JVM: Maven, Gradle (Kotlin) and sbt (Scala)
GROUP_JVM=(
  vertx micronaut
  ktor spring-boot-kotlin micronaut-kotlin http4k
  akka-http http4s-scala play-scala
)
# C# / F#: dotnet build of every project file
GROUP_DOTNET=(
  aspnet-core-webapi aspnet-core-minimal blazor-server grpc-service
  aspnet-dapper aspnet-automapper aspnet-xunit aspnet-efcore aspnet-hotreload
  giraffe aspnet-jwt aspnet-swagger aspnet-serilog saturn-fs suave-fs
)
# Go, Rust, Python, Ruby, PHP, Perl, Lua, C++ (CMake; Drogon, cpp-httplib, Boost.Beast and Pistache from the distribution packages;
# Crow fetched from GitHub at a pinned tag), Dart
GROUP_NATIVE=(
  chi go-sqlx grpc-go
  shelf angel3 conduit
  warp
  starlette sanic-py tornado-py django-enhanced
  sinatra grape
  slim symfony codeigniter
  mojolicious dancer2 catalyst
  openresty lapis lua-http kong-plugin
  drogon cpp-httplib beast pistache crow
)
# Node / TypeScript / plain JavaScript / ReScript (pnpm install + tsc, node --check, or rescript build)
GROUP_NODE=(
  hapi-ts apollo-server meteorjs graphql-codegen enterprise-sso
  compression-optimization universal-state-management unified-dev-environment
  actionherojs feathersjs sailsjs thinkjs totaljs
  api-caching api-contract-testing api-deprecation api-security-scan
  bottleneck-detection compliance-audit-logging couchdb-config
  cross-framework-component-sharing database-migration database-optimization-orm
  database-pooling disaster-recovery distributed-error-handling
  elasticsearch-config enterprise-monitoring global-cdn-integration
  graphql-federation influxdb-config load-testing-automation message-queue
  microfrontend-orchestration mongodb-config multi-tenant-architecture
  mysql-config neo4j-config performance-monitoring postgres-config pwa-features
  rate-limit-config redis-integration resource-loading-optimization
  security-scanning service-communication-optimization shared-config-server
  websocket-api-docs websocket-realtime
  loopback adonisjs restify polka middy hyper-express foalts tinyhttp marblejs eggjs
  graphql-yoga opentelemetry-tracing distributed-caching frontend-service-mesh-client
  moleculer tsed comprehensive-auth-service realtime-data-sync strapi
  rescript-express rescript-fastify rescript-react-server rescript-graphql
)

# Haskell: needs GHC and cabal-install (the dependency trees are large, so these
# build in their own CI job).
GROUP_HASKELL=(
  servant scotty-hs spock-hs yesod-hs
)

# Deno: needs the deno binary; the dependencies are JSR and npm packages (the
# deno.land/x and esm.sh registries are not used, so these build wherever
# jsr.io and registry.npmjs.org are reachable).
GROUP_DENO=(
  oak-deno fresh-deno aleph-deno
)

# Swift (SwiftPM, Swift 6.2 or newer): Hummingbird 2 and Kitura 3. Vapor builds in
# core.
GROUP_SWIFT=(
  hummingbird kitura
)

# Julia: packages come from the General registry.
GROUP_JULIA=(
  genie-jl oxygen-jl
)

# Nim 2.x with nimble (packages from the Nim package index and GitHub).
GROUP_NIM=(
  jester prologue-nim happyx-nim
)

# Crystal with shards; the Lucky and Amber specs use a local PostgreSQL.
GROUP_CRYSTAL=(
  kemal lucky-cr amber-cr
)

# OCaml (opam switch with dune); the frameworks come from the opam repository.
GROUP_OCAML=(
  dream-ocaml opium-ocaml
)

# Clojure (Leiningen); the libraries come from Maven Central and Clojars.
GROUP_CLOJURE=(
  compojure luminus-clj reitit-clj pedestal-clj
)

# BEAM: Elixir (Plug, Nerves built for the host) and Gleam (Wisp). Phoenix builds in core.
GROUP_BEAM=(
  plug-ex nerves-ex wisp
)

# Systems languages: V (veb, vex), Odin (odin-http) and Pony (Jennet), each with a
# pinned compiler.
GROUP_SYSTEMS=(
  vweb vex-v odin-http jennet-pony
)

# Grain, Ballerina and Unison.
GROUP_EXOTIC=(
  grain ballerina unison
)

# Mojo (compiler from PyPI) and Red (32-bit toolchain).
GROUP_EXOTICB=(
  mojo mojo-fastapi red-http
)

# Configuration-only templates: no toolchain, YAML syntax is checked (see
# verify_config); the TypeScript snippets some of them ship are not compiled.
GROUP_CONFIG=(
  docker-compose-microservices service-discovery
  istio-service-mesh linkerd-service-mesh envoy-proxy nginx-ingress
  traefik-proxy haproxy-lb volume-management secrets-management
  deployment-strategies
  service-auth service-observability api-gateway cors-config
  circuit-breaker service-dependencies service-communication
)

TEMPLATES=()
if [ "$#" -gt 0 ] && [ "$1" = "--group" ]; then
  # --group core|jvm|dotnet|native|node|config|haskell|deno|swift|julia|nim|crystal|ocaml|clojure|beam|systems|exotic|exoticb [...]: run whole groups
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      core) TEMPLATES+=("${GROUP_CORE[@]}") ;;
      jvm) TEMPLATES+=("${GROUP_JVM[@]}") ;;
      dotnet) TEMPLATES+=("${GROUP_DOTNET[@]}") ;;
      native) TEMPLATES+=("${GROUP_NATIVE[@]}") ;;
      node) TEMPLATES+=("${GROUP_NODE[@]}") ;;
      config) TEMPLATES+=("${GROUP_CONFIG[@]}") ;;
      haskell) TEMPLATES+=("${GROUP_HASKELL[@]}") ;;
      deno) TEMPLATES+=("${GROUP_DENO[@]}") ;;
      swift) TEMPLATES+=("${GROUP_SWIFT[@]}") ;;
      julia) TEMPLATES+=("${GROUP_JULIA[@]}") ;;
      nim) TEMPLATES+=("${GROUP_NIM[@]}") ;;
      crystal) TEMPLATES+=("${GROUP_CRYSTAL[@]}") ;;
      ocaml) TEMPLATES+=("${GROUP_OCAML[@]}") ;;
      clojure) TEMPLATES+=("${GROUP_CLOJURE[@]}") ;;
      beam) TEMPLATES+=("${GROUP_BEAM[@]}") ;;
      systems) TEMPLATES+=("${GROUP_SYSTEMS[@]}") ;;
      exotic) TEMPLATES+=("${GROUP_EXOTIC[@]}") ;;
      exoticb) TEMPLATES+=("${GROUP_EXOTICB[@]}") ;;
      *) echo "unknown group: $1 (core|jvm|dotnet|native|node|config|haskell|deno|swift|julia|nim|crystal|ocaml|clojure|beam|systems|exotic|exoticb)" >&2; exit 2 ;;
    esac
    shift
  done
elif [ "$#" -gt 0 ]; then
  TEMPLATES=("$@")
else
  TEMPLATES=("${GROUP_CORE[@]}" "${GROUP_JVM[@]}" "${GROUP_DOTNET[@]}" "${GROUP_NATIVE[@]}" "${GROUP_NODE[@]}" "${GROUP_CONFIG[@]}" "${GROUP_HASKELL[@]}" "${GROUP_DENO[@]}"
    "${GROUP_SWIFT[@]}" "${GROUP_JULIA[@]}" "${GROUP_NIM[@]}" "${GROUP_CRYSTAL[@]}" "${GROUP_OCAML[@]}" "${GROUP_CLOJURE[@]}"
    "${GROUP_BEAM[@]}" "${GROUP_SYSTEMS[@]}" "${GROUP_EXOTIC[@]}" "${GROUP_EXOTICB[@]}")
fi

PASS=0
FAIL=0
SKIP=0
FAILED_TEMPLATES=()
SKIPPED_TEMPLATES=()

fail_template() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
  FAILED_TEMPLATES+=("$TPL ($1)")
}

skip_template() {
  echo "  SKIP: $1"
  SKIP=$((SKIP + 1))
  SKIPPED_TEMPLATES+=("$TPL ($1)")
}

# Remove a scaffolded project. A build tool can leave a background process
# writing into it for a moment (sbt's server keeps writing target/ after
# `sbt -batch` returns), so retry briefly and never abort the run over cleanup.
remove_project() {
  local i
  for i in 1 2 3 4 5; do
    rm -rf "$1" 2>/dev/null && return 0
    sleep 1
  done
  echo "  NOTE: could not fully remove $1 (a build process may still be writing to it)"
  return 0
}

have() {
  command -v "$1" >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# Native (non-Node) verification.
#
# verify_native <template> <app dir>
#   returns 0  verified: built with its own toolchain
#           1  build/verification failed; NATIVE_REASON says which step
#           2  toolchain missing; NATIVE_REASON says which one
#   NATIVE_NOTE is set when a pass verified less than usual (printed, not hidden).
# Step output goes to $TMP_DIR/<template>-<step>.txt.
# ---------------------------------------------------------------------------
NATIVE_REASON=""
NATIVE_NOTE=""

# step <name> <command...>: run in the current directory, log, remember failure.
step() {
  local name="$1"
  shift
  local log="$TMP_DIR/$TPL-$name.txt"
  if "$@" >"$log" 2>&1; then
    echo "  ✓ $name"
    return 0
  fi
  echo "  ✗ $name failed"
  tail -n 15 "$log" | sed 's/^/    | /'
  NATIVE_REASON="$name failed"
  return 1
}

# Every file under the app (minus vendored/build output) with the given suffix.
list_files() {
  find . \( -path ./node_modules -o -path ./vendor -o -path ./.venv -o -path ./target -o -path ./.bundle \) -prune -o -type f -name "$1" -print
}

# Run a syntax checker over every matching file; stop at the first bad one.
check_each() {
  local label="$1" pattern="$2"
  shift 2
  local log="$TMP_DIR/$TPL-$label.txt"
  local count=0 file
  : >"$log"
  while IFS= read -r file; do
    count=$((count + 1))
    if ! "$@" "$file" >>"$log" 2>&1; then
      echo "  ✗ $label failed on $file"
      tail -n 10 "$log" | sed 's/^/    | /'
      NATIVE_REASON="$label failed on $file"
      return 1
    fi
  done < <(list_files "$pattern")
  if [ "$count" -eq 0 ]; then
    echo "  ✗ $label found no $pattern files"
    NATIVE_REASON="$label found no $pattern files"
    return 1
  fi
  echo "  ✓ $label ($count files)"
}

verify_python() {
  have python3 || { NATIVE_REASON="python3 is not installed"; return 2; }
  step venv python3 -m venv .venv || return 1
  local py="$PWD/.venv/bin/python"
  if [ -f requirements.txt ]; then
    step install "$py" -m pip install --quiet --disable-pip-version-check -r requirements.txt || return 1
  elif [ -f pyproject.toml ]; then
    step install "$py" -m pip install --quiet --disable-pip-version-check . || return 1
  else
    echo "  ✗ no requirements.txt or pyproject.toml"
    NATIVE_REASON="no requirements.txt or pyproject.toml"
    return 1
  fi
  step compile "$py" -m compileall -q -x '/\.venv/' . || return 1
  # Import the application module. Only generic settings are supplied here; a
  # template must otherwise boot from its own development defaults.
  export SECRET_KEY="${SECRET_KEY:-template-health-check-secret}"
  if [ -f manage.py ]; then
    step import "$py" manage.py check || return 1
  elif [ -f main.py ]; then
    step import "$py" -c 'import main; assert hasattr(main, "app"), "main.app missing"' || return 1
  elif [ -f run.py ]; then
    step import "$py" -c 'import run; assert hasattr(run, "app"), "run.app missing"' || return 1
  elif [ -f fastapi_app.py ]; then
    step import "$py" -c 'import fastapi_app; assert hasattr(fastapi_app, "app"), "fastapi_app.app missing"' || return 1
  elif [ -f src/main.py ]; then
    step import env PYTHONPATH=src "$py" -c 'import main; assert hasattr(main, "app"), "main.app missing"' || return 1
  else
    NATIVE_REASON="no manage.py, main.py, run.py, fastapi_app.py or src/main.py entry point to import"
    echo "  ✗ $NATIVE_REASON"
    return 1
  fi
}

verify_go() {
  have go || { NATIVE_REASON="go is not installed"; return 2; }
  # go.sum is not shipped (it can't be); tidy resolves and records the modules.
  step tidy go mod tidy || return 1
  step build go build ./... || return 1
}

verify_rust() {
  have cargo || { NATIVE_REASON="cargo is not installed"; return 2; }
  # Share one target dir so the dependency tree compiles once per run.
  export CARGO_TARGET_DIR="$TMP_DIR/cargo-target"
  step check cargo check || return 1
}

verify_php() {
  have php || { NATIVE_REASON="php is not installed"; return 2; }
  check_each lint '*.php' php -l || return 1
  if have composer; then
    if [ "${TEMPLATE_HEALTH_COMPOSER_RESOLVE_ONLY:-0}" = "1" ]; then
      # For networks that cannot download GitHub dist archives: resolve the full
      # dependency tree (versions, conflicts) without installing it.
      step composer-resolve composer update --dry-run --no-interaction --no-progress --no-scripts || return 1
      NATIVE_NOTE="composer dependencies were resolved but not downloaded (TEMPLATE_HEALTH_COMPOSER_RESOLVE_ONLY=1)"
    else
      step composer-install composer install --no-interaction --no-progress --no-scripts || return 1
      # Laravel apps: boot the application (every route must resolve to a controller)
      # and run its own PHPUnit suite (phpunit.xml supplies APP_KEY, JWT_SECRET and
      # in-memory SQLite, so no database or Redis is needed).
      if [ -f artisan ] && [ -f phpunit.xml ]; then
        if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi
        step artisan-routes php artisan route:list || return 1
        step phpunit php artisan test || return 1
      fi
    fi
  else
    NATIVE_NOTE="syntax only: composer is not installed, dependencies were not installed"
  fi
}

verify_ruby() {
  have ruby || { NATIVE_REASON="ruby is not installed"; return 2; }
  check_each syntax '*.rb' ruby -c || return 1
  if have bundle; then
    step bundle-install env BUNDLE_PATH=vendor/bundle bundle install --quiet || return 1
    # Load the Rails application (initializers, middleware, routes) without a database.
    if [ -f bin/rails ]; then
      step load env BUNDLE_PATH=vendor/bundle bundle exec ruby bin/rails routes || return 1
    fi
  else
    NATIVE_NOTE="syntax only: bundler is not installed, gems were not installed"
  fi
}

verify_java() {
  have mvn || { NATIVE_REASON="mvn (Maven) is not installed"; return 2; }
  have java || { NATIVE_REASON="java is not installed"; return 2; }
  step package mvn -B -q -DskipTests package || return 1
}

verify_gradle() {
  have gradle || { NATIVE_REASON="gradle is not installed"; return 2; }
  have java || { NATIVE_REASON="java is not installed"; return 2; }
  step build gradle --no-daemon -q build -x test || return 1
}

verify_sbt() {
  have sbt || { NATIVE_REASON="sbt is not installed"; return 2; }
  have java || { NATIVE_REASON="java is not installed"; return 2; }
  # Compiles main and test sources (and resolves the Play/sbt plugins).
  step compile sbt -batch Test/compile || return 1
}

verify_dotnet() {
  have dotnet || { NATIVE_REASON="dotnet (.NET SDK) is not installed"; return 2; }
  export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
  # Build every project file: a template can ship a separate test project.
  local proj count=0
  while IFS= read -r proj; do
    count=$((count + 1))
    step "build-${proj##*/}" dotnet build "$proj" --nologo -v q || return 1
  done < <(find . \( -path ./obj -o -path ./bin \) -prune -o \( -name '*.csproj' -o -name '*.fsproj' \) -print | awk '{ print length($0) " " $0 }' | sort -n | cut -d' ' -f2-)
  if [ "$count" -eq 0 ]; then
    NATIVE_REASON="no .csproj/.fsproj found"
    return 1
  fi
}

verify_perl() {
  have perl || { NATIVE_REASON="perl is not installed"; return 2; }
  # Every module, script and test must compile against the framework installed
  # from the distribution packages (Mojolicious, Dancer2, Catalyst, ...).
  local file count=0 log="$TMP_DIR/$TPL-perl.txt"
  : >"$log"
  while IFS= read -r file; do
    count=$((count + 1))
    if ! perl -Ilib -c "$file" >>"$log" 2>&1; then
      echo "  ✗ perl -c failed on $file"
      tail -n 10 "$log" | sed 's/^/    | /'
      NATIVE_REASON="perl -c failed on $file"
      return 1
    fi
  done < <(find . \( -name '*.pm' -o -name '*.pl' -o -path './script/*' -o -name '*.t' \) -type f)
  if [ "$count" -eq 0 ]; then
    NATIVE_REASON="no Perl files found"
    return 1
  fi
  echo "  ✓ perl -c ($count files)"
}

verify_lua() {
  local luac=""
  if have luac5.4; then luac=luac5.4; elif have luac; then luac=luac; elif have luac5.3; then luac=luac5.3; fi
  [ -n "$luac" ] || { NATIVE_REASON="luac (Lua compiler) is not installed"; return 2; }
  check_each syntax '*.lua' "$luac" -p || return 1
  NATIVE_NOTE="syntax only (luac -p): LuaRocks dependencies were not resolved"
}

# C++ (CMake): configure and build every target, tests included.
verify_cmake() {
  have cmake || { NATIVE_REASON="cmake is not installed"; return 2; }
  have g++ || have c++ || have clang++ || { NATIVE_REASON="no C++ compiler is installed"; return 2; }
  step configure cmake -S . -B build -DCMAKE_BUILD_TYPE=Release || return 1
  step build cmake --build build -j "$(nproc 2>/dev/null || echo 2)" || return 1
}

# True when asio.hpp is in a directory CMake searches: CMAKE_INCLUDE_PATH, then the system ones.
asio_installed() {
  local dir dirs=()
  IFS=: read -r -a dirs <<<"${CMAKE_INCLUDE_PATH:-}"
  for dir in "${dirs[@]}" /usr/include /usr/local/include; do
    [ -n "$dir" ] && [ -f "$dir/asio.hpp" ] && return 0
  done
  return 1
}

# C++ (Crow): configure (CMake fetches Crow v1.2.0 from GitHub), build every target, run the
# GoogleTest suites. Crow needs the standalone Asio headers (libasio-dev).
verify_crow() {
  have cmake || { NATIVE_REASON="cmake is not installed"; return 2; }
  have g++ || have c++ || have clang++ || { NATIVE_REASON="no C++ compiler is installed"; return 2; }
  have git || { NATIVE_REASON="git is not installed (CMake fetches Crow from GitHub)"; return 2; }
  asio_installed || { NATIVE_REASON="Asio headers are not installed (apt install libasio-dev)"; return 2; }
  step configure cmake -S . -B build -DCMAKE_BUILD_TYPE=Release || return 1
  step build cmake --build build -j "$(nproc 2>/dev/null || echo 2)" || return 1
  step test ctest --test-dir build --output-on-failure || return 1
}

# Configuration-only templates (service meshes, proxies, compose bundles, ...)
# have nothing to compile: every YAML file must at least parse.
verify_config() {
  have node || { NATIVE_REASON="node is not installed"; return 2; }
  step yaml node "$REPO_ROOT/scripts/check-yaml.mjs" . || return 1
  NATIVE_NOTE="configuration template: YAML syntax only (other config formats and any TypeScript snippets are not compiled)"
}

# Zig: build, then run the unit tests when build.zig defines a test step. Templates pin
# their URL dependencies' hashes in build.zig.zon (zap-zig does). A URL dependency that
# ships without a .hash is fetched first and its hash written in, as `zig fetch --save`
# would do; the hash is printed so it can be pinned in the template.
verify_zig() {
  have zig || { NATIVE_REASON="zig is not installed"; return 2; }
  if [ -f build.zig.zon ] && grep -q '^ *\.url = ' build.zig.zon && ! grep -q '^ *\.hash = ' build.zig.zon; then
    local url hash fetched=""
    while IFS= read -r url; do
      step fetch zig fetch "$url" || return 1
      # Zig 0.13 prints the package hash (1220 + 64 hex digits) on its own line.
      hash="$(grep -E '^1220[0-9a-f]{64}$' "$TMP_DIR/$TPL-fetch.txt" | tail -n 1)"
      if [ -z "$hash" ]; then
        echo "  ✗ zig fetch printed no package hash for $url"
        NATIVE_REASON="zig fetch printed no package hash for $url"
        return 1
      fi
      sed -i "s|^\( *\)\(\.url = \"$url\",\)\$|\1\2\n\1.hash = \"$hash\",|" build.zig.zon
      echo "    hash: $hash ($url)"
      fetched="$fetched $url=$hash"
    done < <(sed -n 's/^ *\.url = "\([^"]*\)",$/\1/p' build.zig.zon)
    if grep -q '^ *\.url = ' build.zig.zon && ! grep -q '^ *\.hash = ' build.zig.zon; then
      echo "  ✗ could not write the fetched hash into build.zig.zon"
      NATIVE_REASON="could not write the fetched hash into build.zig.zon"
      return 1
    fi
    NATIVE_NOTE="dependency hash computed during the run, not pinned in the template:$fetched"
  fi
  step build zig build || return 1
  if grep -q 'b\.step("test"' build.zig; then
    step test zig build test || return 1
  fi
}

# Haskell (Servant, Scotty, Spock, Yesod): build the library, executable and test suite, then run the tests.
verify_haskell() {
  have ghc || { NATIVE_REASON="ghc is not installed"; return 2; }
  have cabal || { NATIVE_REASON="cabal (cabal-install) is not installed"; return 2; }
  step build cabal build all --enable-tests || return 1
  step test cabal test all || return 1
}

# Deno (Oak, Fresh): type-check every module, build the production bundle when the
# app defines a build task (Fresh), then run the tests. Dependencies are JSR and npm
# packages that deno resolves itself.
verify_deno() {
  have deno || { NATIVE_REASON="deno is not installed"; return 2; }
  export DENO_NO_UPDATE_CHECK=1 NO_COLOR=1
  step check deno check || return 1
  if grep -q '"build"' deno.json 2>/dev/null; then
    step build deno task build || return 1
  fi
  step test deno test -A || return 1
}

# Dart (shelf, Angel3, Conduit): resolve the packages and type-check every library, bin and test.
verify_dart() {
  have dart || { NATIVE_REASON="dart is not installed"; return 2; }
  export DART_SUPPRESS_ANALYTICS=true
  step pub-get dart pub get || return 1
  step analyze dart analyze || return 1
  NATIVE_NOTE="static analysis only (dart analyze): the app's tests were not run"
}

# Swift (SwiftPM: Hummingbird, Kitura): resolve the packages, build the app together with its test
# target, then run the tests. Hummingbird 2 needs Swift 6.2 or newer (an older toolchain fails
# dependency resolution, which is reported as a failure); Kitura links the system OpenSSL 3 and zlib
# (libssl-dev, zlib1g-dev). Vapor is built without its tests (see verify_native).
verify_swift() {
  have swift || { NATIVE_REASON="swift is not installed"; return 2; }
  step build swift build --build-tests || return 1
  step test swift test --skip-build || return 1
}

# Julia (Genie, Oxygen): resolve the Project.toml dependencies from the General registry,
# precompile them and the app package, then run the app's test suite (handler unit tests
# plus a live server on a local port; its requests carry their own timeouts). Precompilation
# is kept out of instantiate so a compile error is reported by the precompile step.
verify_julia() {
  have julia || { NATIVE_REASON="julia is not installed"; return 2; }
  step instantiate env JULIA_PKG_PRECOMPILE_AUTO=0 julia --startup-file=no --project=. -e 'using Pkg; Pkg.instantiate()' || return 1
  step precompile julia --startup-file=no --project=. -e 'using Pkg; Pkg.precompile()' || return 1
  step test julia --startup-file=no --project=. -e 'using Pkg; Pkg.test()' || return 1
}

# Nim (Jester, Prologue, HappyX): nimble resolves the dependencies from the Nim
# package index and GitHub, builds the server binary and runs the unit tests
# (tests/t*.nim).
verify_nim() {
  have nim || { NATIVE_REASON="nim is not installed"; return 2; }
  have nimble || { NATIVE_REASON="nimble is not installed"; return 2; }
  step deps nimble install -y --depsOnly || return 1
  step build nimble build -y || return 1
  step test nimble test -y || return 1
}

# True when a local PostgreSQL accepts postgres/postgres (what Lucky's and Amber's test settings use).
postgres_ready() {
  have psql || return 1
  PGPASSWORD=postgres psql -h localhost -U postgres -tAc 'select 1' >/dev/null 2>&1
}

# Crystal (Kemal, Lucky, Amber): install the shards, build every target, then run the specs.
# Lucky (Avram) and Amber (Granite) specs need PostgreSQL: they run when a server answers on
# localhost with postgres/postgres, otherwise they are only type-checked.
verify_crystal() {
  have crystal || { NATIVE_REASON="crystal is not installed"; return 2; }
  have shards || { NATIVE_REASON="shards is not installed"; return 2; }
  step install shards install || return 1
  step build shards build || return 1
  if [ -f tasks.cr ]; then
    # Lucky's task runner (db.migrate, db.seed.*, ...)
    step tasks crystal build --no-codegen tasks.cr || return 1
  fi
  [ -d spec ] || return 0
  if grep -qE '^[[:space:]]+(avram|granite):' shard.yml; then
    if postgres_ready; then
      if [ -f .amber.yml ]; then
        # A fresh test database each run (the drop is allowed to fail when none exists yet).
        step db-create bash -c 'AMBER_ENV=test bin/amber db drop >/dev/null 2>&1; AMBER_ENV=test bin/amber db create' || return 1
      fi
      step spec crystal spec || return 1
    elif [ "${TEMPLATE_HEALTH_REQUIRE_POSTGRES:-0}" = 1 ]; then
      echo "  PostgreSQL (postgres/postgres on localhost) is required here (TEMPLATE_HEALTH_REQUIRE_POSTGRES=1) but does not answer"
      return 1
    else
      # `crystal spec` has no type-check-only mode: compile every spec file without code generation.
      printf 'require "./spec/**"\n' >.spec_typecheck.cr
      local rc=0
      step spec-typecheck crystal build --no-codegen .spec_typecheck.cr || rc=1
      rm -f .spec_typecheck.cr
      [ "$rc" -eq 0 ] || return 1
      NATIVE_NOTE="the specs need PostgreSQL (postgres/postgres on localhost); they were type-checked, not run"
    fi
  else
    step spec crystal spec || return 1
  fi
}

# OCaml (Dream, Opium): install the dependencies declared in <name>.opam (the web
# framework included) from the opam repository into the selected switch, then build
# every target (library, server, tests) and run the Alcotest suite.
verify_ocaml() {
  have opam || { NATIVE_REASON="opam (OCaml package manager) is not installed"; return 2; }
  opam switch show >/dev/null 2>&1 || { NATIVE_REASON="opam has no switch selected (create one, or set OPAMSWITCH)"; return 2; }
  step deps opam install --yes --deps-only . || return 1
  step build opam exec -- dune build --root . || return 1
  step test opam exec -- dune runtest --root . || return 1
}

# Clojure (Compojure, Luminus, Reitit, Pedestal): Leiningen resolves the dependencies from
# Maven Central and Clojars, loads every namespace, then runs the app's clojure.test suite.
verify_clojure() {
  have lein || { NATIVE_REASON="lein (Leiningen) is not installed"; return 2; }
  have java || { NATIVE_REASON="java is not installed"; return 2; }
  export LEIN_ROOT=1
  step deps lein deps || return 1
  # Loads every namespace on the source paths (plus the dev profile's user.clj),
  # so unresolved vars, missing namespaces and malformed forms fail here.
  step check lein check || return 1
  step test lein test || return 1
}

# BEAM: Elixir (Plug, Nerves, Phoenix) and Gleam (Wisp).
#   Gleam   download the packages, build, run the gleeunit tests (Gleam compiles
#           the Erlang dependencies, e.g. Mist's hpack_erl, with rebar3).
#   Elixir  the Nerves bootstrap archive when mix.exs requires it, deps.get, compile,
#           then the app's tests unless they need a database (Ecto: Phoenix).
#           Nerves projects build for the host (MIX_TARGET=host): no board system
#           or cross-compiler is downloaded, but nerves_uevent (a C port pulled in by
#           nerves_runtime) still compiles on the host and needs libmnl-dev installed.
verify_beam() {
  if [ -f gleam.toml ]; then
    have gleam || { NATIVE_REASON="gleam is not installed"; return 2; }
    have erl || { NATIVE_REASON="erlang (erl) is not installed"; return 2; }
    have rebar3 || { NATIVE_REASON="rebar3 is not installed (gleam needs it for Erlang dependencies)"; return 2; }
    step deps gleam deps download || return 1
    step build gleam build || return 1
    step test gleam test || return 1
  else
    have mix || { NATIVE_REASON="elixir (mix) is not installed"; return 2; }
    export MIX_TARGET=host
    if grep -q 'nerves_bootstrap' mix.exs; then
      step bootstrap mix archive.install hex nerves_bootstrap --force || return 1
    fi
    step deps mix deps.get || return 1
    step compile mix compile || return 1
    if grep -q ':ecto_sql' mix.exs; then
      NATIVE_NOTE="compiled only: the app's tests need a database (Ecto)"
    else
      step test mix test || return 1
    fi
  fi
}

# V (veb, vex): format check, build, tests. The tests start their own server on a loopback port.
# vex-v fetches vex from GitHub with git at a pinned commit.
verify_v() {
  have v || { NATIVE_REASON="v (the V compiler) is not installed"; return 2; }
  have gcc || { NATIVE_REASON="gcc is not installed (V compiles to C, built here with -cc gcc)"; return 2; }
  if [ -f scripts/setup-vex.sh ]; then
    have git || { NATIVE_REASON="git is not installed (it fetches vex)"; return 2; }
    step vex-deps sh scripts/setup-vex.sh || return 1
  fi
  step fmt v fmt -verify src/*.v || return 1
  step build v -cc gcc -o "$TMP_DIR/$TPL-bin" src || return 1
  step test v -cc gcc test src/*_test.v || return 1
}

# Odin (odin-http): the library is fetched into deps/ with git; build and run `odin test`.
verify_odin() {
  have odin || { NATIVE_REASON="odin (the Odin compiler) is not installed"; return 2; }
  have git || { NATIVE_REASON="git is not installed (it fetches odin-http)"; return 2; }
  step deps sh scripts/setup-deps.sh || return 1
  step build odin build src -collection:deps=./deps -out:"$TMP_DIR/$TPL-bin" || return 1
  step test odin test src -collection:deps=./deps -out:"$TMP_DIR/$TPL-test" || return 1
}

# Pony (Jennet): needs ponyc 0.61.0 (Jennet and http_server use the `net` package replaced in
# ponyc 0.72.0, and from 0.61.1 the stdlib `json` shadows the json dependency). corral fetches
# the packages, ponyc builds the app and the test program, which is then run.
verify_pony() {
  have ponyc || { NATIVE_REASON="ponyc (the Pony compiler) is not installed"; return 2; }
  have corral || { NATIVE_REASON="corral (the Pony dependency manager) is not installed"; return 2; }
  local out="$TMP_DIR/$TPL-build"
  mkdir -p "$out"
  # shellcheck disable=SC2016 # the version is read by the inner shell
  step ponyc-version sh -c 'v=$(ponyc --version | head -n 1); echo "found ponyc $v, jennet-pony needs 0.61.0"; case "$v" in 0.61.0*) exit 0 ;; esac; exit 1' || return 1
  step fetch corral fetch || return 1
  step build corral run -- ponyc -V1 -Dopenssl_3.0.x -o "$out" --bin-name=app . || return 1
  step test-build corral run -- ponyc -V1 -Dopenssl_3.0.x -o "$out" --bin-name=app-test test || return 1
  step test "$out/app-test" || return 1
}

# Systems languages (vweb and vex-v: V; odin-http: Odin; jennet-pony: Pony), told apart by manifest.
verify_systems() {
  if [ -f v.mod ]; then
    verify_v
  elif [ -f ols.json ]; then
    verify_odin
  else
    verify_pony
  fi
}

# Grain, Ballerina and Unison: each is built with its own toolchain, told apart by its manifest.
verify_exotic() {
  if [ -f Ballerina.toml ]; then
    have bal || { NATIVE_REASON="bal (Ballerina) is not installed"; return 2; }
    # Resolves ballerina/http, graphql and log (Ballerina Central), compiles the package and builds
    # the jar. bal build does not run the tests, so bal test runs them; they start the module's
    # listeners on 8080 and 9090.
    step build bal build || return 1
    step test bal test || return 1
  elif [ -f src/main.gr ]; then
    have grain || { NATIVE_REASON="grain (the Grain compiler) is not installed"; return 2; }
    mkdir -p build
    step compile grain compile src/main.gr -o build/main.wasm || return 1
    step run grain run build/main.wasm || return 1
    # A failed assert throws AssertionError, which makes grain run exit non-zero.
    step compile-tests grain compile tests/router_test.gr -o build/router_test.wasm || return 1
    step test grain run build/router_test.wasm || return 1
  else
    have ucm || { NATIVE_REASON="ucm (Unison Codebase Manager) is not installed"; return 2; }
    # Unison has no source build: main.u is typechecked against @unison/base, added to a fresh
    # codebase and run (selfTest, then appMain) by a UCM transcript, which exits non-zero when a
    # stanza fails (a type error, or a bug/exception raised by run).
    local transcript="$TMP_DIR/$TPL-transcript.md" output
    {
      printf '%s\n' '```ucm' 'scratch/main> lib.install @unison/base' '```' '' '```unison'
      cat main.u
      printf '%s\n' '```' '' '```ucm' 'scratch/main> add' 'scratch/main> run selfTest' 'scratch/main> run appMain' '```'
    } >"$transcript"
    if ! step transcript ucm transcript "$transcript"; then
      # step shows only the last 15 lines, which cut off the start of a type error (the failing
      # line and the type ucm expected), so print the error again from its beginning.
      sed -n '/The transcript failed/,$p' "$TMP_DIR/$TPL-transcript.txt" | head -n 80 | sed 's/^/    | /' || true
      return 1
    fi
    output="${transcript%.md}.output.md"
    if [ -f "$output" ] && grep -qE 'unhandled exception|💥' "$output"; then
      echo "  ✗ the transcript reported a failed run"
      grep -E 'unhandled exception|💥' "$output" | head -n 5 | sed 's/^/    | /'
      NATIVE_REASON="the Unison self-test run failed"
      return 1
    fi
    NATIVE_NOTE="Unison has no separate compile step: main.u was typechecked, added and run (selfTest, appMain) in a ucm transcript"
  fi
}

# boot_check <port> <path> <expected text> <command...>: start the server command with
# PORT=<port>, wait up to 20 s for GET <path> to answer with <expected text>, then stop it.
boot_check() {
  have curl || { NATIVE_REASON="curl is not installed (needed for the boot check)"; return 2; }
  local port="$1" path="$2" expect="$3" pid ok=1 tries=0
  shift 3
  local log="$TMP_DIR/$TPL-server.txt" body="$TMP_DIR/$TPL-boot.txt"
  PORT="$port" "$@" >"$log" 2>&1 &
  pid=$!
  while [ "$tries" -lt 20 ]; do
    if curl -fsS "http://127.0.0.1:$port$path" >"$body" 2>&1 && grep -qF -- "$expect" "$body"; then
      ok=0
      break
    fi
    kill -0 "$pid" 2>/dev/null || break
    tries=$((tries + 1))
    sleep 1
  done
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  if [ "$ok" -ne 0 ]; then
    echo "  ✗ boot failed (GET $path)"
    tail -n 15 "$log" | sed 's/^/    | /'
    tail -n 3 "$body" 2>/dev/null | awk '{ print "    | " $0 }'
    NATIVE_REASON="boot failed (GET $path did not answer with $expect)"
    return 1
  fi
  echo "  ✓ boot (GET $path)"
}

# Mojo (mojo, mojo-fastapi): compile with the Mojo compiler, run the tests, then boot the app.
verify_mojo() {
  have mojo || { NATIVE_REASON="mojo is not installed (pip install mojo)"; return 2; }
  export MODULAR_CRASH_REPORTING_ENABLED=false
  local f name
  if [ -f mojo_bindings.mojo ]; then
    # FastAPI + Mojo: build the Mojo kernels as a Python extension module, then run the
    # tests and the server against it (the pure-Python fallback must not be the one used).
    have python3 || { NATIVE_REASON="python3 is not installed"; return 2; }
    step build-extension mojo build mojo_bindings.mojo --emit shared-lib -o mojo_bindings.so || return 1
    step venv python3 -m venv .venv || return 1
    local py="$PWD/.venv/bin/python"
    step install "$py" -m pip install --quiet --disable-pip-version-check -r requirements-test.txt || return 1
    step engine "$py" -c 'import engine; assert engine.engine_name() == "mojo", "mojo_bindings was not loaded"' || return 1
    step tests "$py" -m pytest -q -p no:cacheprovider || return 1
    boot_check 18080 /api/v1/health '"engine":"mojo"' "$py" fastapi_app.py || return $?
    return 0
  fi
  mkdir -p bin
  step build mojo build main.mojo -I . -o bin/server || return 1
  for f in tests/*.mojo; do
    name="${f##*/}"
    step "test-${name%.mojo}" mojo run -I . "$f" || return 1
  done
  step examples mojo run -I . examples/simd_examples.mojo || return 1
  step benchmark-build mojo build benchmarks/bench_simd.mojo -I . -o bin/bench || return 1
  # The socket transport is Python interop, only exercised at run time: boot the server.
  boot_check 18080 /api/v1/products/1 '"Sample Product 1"' ./bin/server || return $?
}

# Red (red-http): the toolchain and the programs it builds are 32-bit x86 and link the i386
# libc, libcurl and libgdk_pixbuf (the image! datatype), so a binary that cannot load fails with a
# shared-library error before its first test. main.red has Red/System routines, so everything is
# compiled in release mode (-r), not with libRedRT (-c).
verify_red() {
  have red || { NATIVE_REASON="red (the 32-bit Red toolchain, red-toolchain-NNN) is not installed"; return 2; }
  mkdir -p bin
  step build-tests red -r -o bin/test-app tests/test-app.red || return 1
  step tests ./bin/test-app || return 1
  step build red -r -o bin/server main.red || return 1
  boot_check 18081 /api/v1/products/1 '"Sample Product 1"' ./bin/server || return $?
}

verify_native() {
  local tpl="$1" dir="$2"
  NATIVE_REASON=""
  NATIVE_NOTE=""
  cd "$dir"
  # Mojo first: mojo-fastapi also ships requirements.txt, which would send it to verify_python
  # (that path never builds the Mojo extension module).
  if [ -f pixi.toml ]; then
    verify_mojo
  elif [ -f manage.py ] || [ -f requirements.txt ] || [ -f pyproject.toml ]; then
    verify_python
  elif [ -f go.mod ]; then
    verify_go
  elif [ -f Cargo.toml ]; then
    verify_rust
  elif [ -f composer.json ]; then
    verify_php
  elif [ -f Gemfile ]; then
    verify_ruby
  elif [ -f pom.xml ]; then
    verify_java
  elif [ -f build.gradle.kts ] || [ -f build.gradle ]; then
    verify_gradle
  elif [ -f build.sbt ]; then
    verify_sbt
  elif [ -f deno.json ] || [ -f deno.jsonc ]; then
    verify_deno
  elif compgen -G "*.cabal" >/dev/null; then
    verify_haskell
  elif compgen -G "*.csproj" >/dev/null || compgen -G "*.fsproj" >/dev/null; then
    verify_dotnet
  elif [ -f cpanfile ] || [ -f Makefile.PL ]; then
    verify_perl
  elif [ -f build.zig ]; then
    verify_zig
  elif [ -f pubspec.yaml ]; then
    verify_dart
  elif [ -f mix.exs ] || [ -f gleam.toml ]; then
    verify_beam
  elif [ -f Package.swift ]; then
    if [ "$tpl" = vapor ]; then
      # Vapor (core group) is built without its XCTVapor test target, which CI has not compiled yet.
      have swift || { NATIVE_REASON="swift is not installed"; return 2; }
      step build swift build || return 1
      NATIVE_NOTE="swift build only: the XCTVapor test target is neither built nor run"
    else
      verify_swift
    fi
  elif [ -f Project.toml ]; then
    verify_julia
  elif compgen -G "*.nimble" >/dev/null; then
    verify_nim
  elif [ -f shard.yml ]; then
    verify_crystal
  elif [ -f dune-project ]; then
    verify_ocaml
  elif [ -f project.clj ]; then
    verify_clojure
  elif [ -f v.mod ] || [ -f ols.json ] || [ -f corral.json ]; then
    verify_systems
  elif [ -f Ballerina.toml ] || [ -f src/main.gr ] || [ -f main.u ]; then
    verify_exotic
  elif [ -f main.red ]; then
    verify_red
  # Before the generic CMake branch, and before the *.lua and YAML fallbacks below (most of these
  # apps also ship a docker-compose.yml).
  elif [ -f CMakeLists.txt ] && grep -q 'CrowCpp/Crow' CMakeLists.txt; then
    verify_crow
  elif [ -n "$(find . -type f -name '*.lua' -print -quit)" ]; then
    verify_lua
  elif [ -f CMakeLists.txt ]; then
    verify_cmake
  elif [ -n "$(find . -type f \( -name '*.yaml' -o -name '*.yml' \) -print -quit)" ]; then
    verify_config
  else
    echo "  ✗ no recognised build manifest in the generated app"
    NATIVE_REASON="no recognised build manifest (package.json, go.mod, Cargo.toml, deno.json, pubspec.yaml, pom.xml, build.gradle(.kts), build.sbt, *.cabal, *.csproj, *.fsproj, composer.json, Gemfile, requirements.txt, cpanfile, CMakeLists.txt, build.zig, mix.exs, gleam.toml, Package.swift, Project.toml, *.nimble, shard.yml, dune-project, project.clj, v.mod, ols.json, corral.json, Ballerina.toml, src/main.gr, main.u, pixi.toml, main.red, *.lua, *.yaml)"
    return 1
  fi
}

for TPL in "${TEMPLATES[@]}"; do
  echo ""
  echo "━━━ Testing template: $TPL ━━━"
  PROJ_DIR="$TMP_DIR/test-$TPL"

  # Scaffold from the temp dir, NOT the repo root: run inside the repo, the
  # CLI detects the monorepo and switches to the interactive in-monorepo
  # workspace flow (prompts despite --yes), which hangs without a TTY and
  # never prints "Scaffolded". Each iteration re-cds because the typecheck
  # path below returns to $REPO_ROOT.
  cd "$TMP_DIR"

  SCAFFOLD_LOG="$TMP_DIR/scaffold-$TPL.txt"
  if node "$CLI_BIN" create "test-$TPL" --backend "$TPL" --yes >"$SCAFFOLD_LOG" 2>&1 && grep -q "Scaffolded" "$SCAFFOLD_LOG"; then
    echo "  ✓ Scaffold produced"
  else
    fail_template "scaffold failed"
    head -5 "$SCAFFOLD_LOG"
    continue
  fi

  APP_DIR="$PROJ_DIR/apps/test-$TPL"
  [ -d "$PROJ_DIR/apps/test-$TPL-api" ] && APP_DIR="$PROJ_DIR/apps/test-$TPL-api"

  if [ ! -d "$APP_DIR" ]; then
    fail_template "no generated app directory"
    continue
  fi

  cd "$APP_DIR"

  # Non-Node templates are built with their own language toolchain.
  if [ ! -f "package.json" ]; then
    case "$TPL" in
      express|fastify|nestjs|koa|hono)
        fail_template "missing package.json"
        ;;
      *)
        NATIVE_RC=0
        verify_native "$TPL" "$APP_DIR" || NATIVE_RC=$?
        case "$NATIVE_RC" in
          0)
            echo "  ✓ Native build verified"
            [ -n "$NATIVE_NOTE" ] && echo "  NOTE: $NATIVE_NOTE"
            PASS=$((PASS + 1))
            ;;
          2)
            skip_template "toolchain missing: $NATIVE_REASON"
            ;;
          *)
            fail_template "native build: $NATIVE_REASON"
            ;;
        esac
        ;;
    esac
    cd "$REPO_ROOT"
    remove_project "$PROJ_DIR"
    continue
  fi

  if ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$APP_DIR/package.json" >"$TMP_DIR/package-json-$TPL.txt" 2>&1; then
    fail_template "invalid package.json"
    head -5 "$TMP_DIR/package-json-$TPL.txt"
    continue
  fi

  # Select the repository's pinned package manager before targeting the
  # generated app; running from the temporary app can select a global version.
  cd "$REPO_ROOT"
  if ! pnpm --dir "$APP_DIR" install --silent >"$TMP_DIR/install-$TPL.txt" 2>&1; then
    fail_template "dependency install failed"
    head -5 "$TMP_DIR/install-$TPL.txt"
    continue
  fi
  cd "$APP_DIR"

  # ReScript apps compile to JavaScript next to the sources: build them, check the
  # generated and hand-written JavaScript, then run the app's own tests.
  if [ -f "rescript.json" ] || [ -f "bsconfig.json" ]; then
    if ! pnpm exec rescript build >"$TMP_DIR/rescript-$TPL.txt" 2>&1; then
      grep -v '^rescript: \[' "$TMP_DIR/rescript-$TPL.txt" | head -20
      fail_template "ReScript build failed"
      continue
    fi
    echo "  ✓ ReScript build passed"
    RS_BAD=""
    while IFS= read -r RS_FILE; do
      if ! node --check "$RS_FILE" >"$TMP_DIR/js-check-$TPL.txt" 2>&1; then
        RS_BAD="$RS_FILE"
        break
      fi
    done < <(find . -path ./node_modules -prune -o -type f -name '*.js' -print)
    if [ -n "$RS_BAD" ]; then
      head -5 "$TMP_DIR/js-check-$TPL.txt"
      fail_template "JavaScript syntax error in $RS_BAD"
      continue
    fi
    if ! node "$REPO_ROOT/scripts/check-js-imports.mjs" "$APP_DIR" >"$TMP_DIR/js-imports-$TPL.txt" 2>&1; then
      head -8 "$TMP_DIR/js-imports-$TPL.txt"
      fail_template "unresolved imports"
      continue
    fi
    echo "  ✓ JavaScript syntax and imports verified"
    if ! pnpm run test >"$TMP_DIR/rescript-test-$TPL.txt" 2>&1; then
      grep -v '^rescript: \[' "$TMP_DIR/rescript-test-$TPL.txt" | tail -25
      fail_template "tests failed"
      continue
    fi
    echo "  ✓ Tests passed"
    PASS=$((PASS + 1))
    cd "$REPO_ROOT"
    remove_project "$PROJ_DIR"
    continue
  fi

  # Generate Prisma client if present
  if [ -f "prisma/schema.prisma" ]; then
    if ! npx --yes -p prisma@5 prisma generate >"$TMP_DIR/prisma-$TPL.txt" 2>&1; then
      fail_template "Prisma client generation failed"
      head -5 "$TMP_DIR/prisma-$TPL.txt"
      continue
    fi
  fi

  # Run typecheck — only for TypeScript-capable templates. tsc prints
  # diagnostics to STDOUT, so capture both streams (counting only stderr
  # made tsconfig-less runs report "FAILED (0 errors)").
  if [ ! -f "tsconfig.json" ]; then
    if [ -n "$(find . -path ./node_modules -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -print -quit)" ]; then
      fail_template "TypeScript sources but no tsconfig.json"
      continue
    fi
    # Plain JavaScript has no compiler: parse every file and make sure every
    # import / require resolves against the installed dependencies.
    JS_COUNT=0
    JS_BAD=""
    while IFS= read -r JS_FILE; do
      JS_COUNT=$((JS_COUNT + 1))
      if ! node --check "$JS_FILE" >"$TMP_DIR/js-check-$TPL.txt" 2>&1; then
        JS_BAD="$JS_FILE"
        break
      fi
    done < <(find . -path ./node_modules -prune -o -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print)
    if [ -n "$JS_BAD" ]; then
      echo "  ✗ syntax error in $JS_BAD"
      head -5 "$TMP_DIR/js-check-$TPL.txt"
      fail_template "JavaScript syntax error in $JS_BAD"
      continue
    fi
    if [ "$JS_COUNT" -eq 0 ]; then
      fail_template "no JavaScript or TypeScript sources to verify"
      continue
    fi
    if ! node "$REPO_ROOT/scripts/check-js-imports.mjs" "$APP_DIR" >"$TMP_DIR/js-imports-$TPL.txt" 2>&1; then
      head -8 "$TMP_DIR/js-imports-$TPL.txt"
      fail_template "unresolved imports"
      continue
    fi
    echo "  ✓ JavaScript syntax and imports verified ($JS_COUNT files)"
    PASS=$((PASS + 1))
    cd "$REPO_ROOT"
    remove_project "$PROJ_DIR"
    continue
  fi

  TSC_BIN="$APP_DIR/node_modules/.bin/tsc"
  if [ ! -x "$TSC_BIN" ]; then
    fail_template "missing TypeScript compiler"
    continue
  fi

  if "$TSC_BIN" --noEmit >"$TMP_DIR/tsc-err-$TPL.txt" 2>&1; then
    echo "  ✓ Typecheck passed"
    PASS=$((PASS + 1))
  else
    ERROR_COUNT=$(wc -l < "$TMP_DIR/tsc-err-$TPL.txt" | tr -d ' ')
    echo "  ✗ Typecheck FAILED ($ERROR_COUNT diagnostic lines)"
    head -5 "$TMP_DIR/tsc-err-$TPL.txt"
    fail_template "typecheck: $ERROR_COUNT diagnostic lines"
  fi

  cd "$REPO_ROOT"
  remove_project "$PROJ_DIR"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
if [ "$SKIP" -gt 0 ]; then
  echo "SKIPPED TEMPLATES (not verified; toolchain missing on this machine):"
  for st in "${SKIPPED_TEMPLATES[@]}"; do
    echo "  SKIP: $st"
  done
fi
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAILED TEMPLATES:"
  for ft in "${FAILED_TEMPLATES[@]}"; do
    echo "  ✗ $ft"
  done
  exit 1
fi
# Strict mode for CI groups whose toolchain install must work: a template that is
# skipped there means the install step did not put its toolchain on PATH, which
# must not look like a green run with nothing built.
if [ "${TEMPLATE_HEALTH_FAIL_ON_SKIP:-0}" = 1 ] && [ "$SKIP" -gt 0 ]; then
  echo ""
  echo "SKIPs are not allowed here (TEMPLATE_HEALTH_FAIL_ON_SKIP=1): $SKIP template(s) were not verified"
  exit 1
fi
if [ "$SKIP" -eq 0 ]; then
  echo "ALL TEMPLATES PASSED ✓"
else
  echo "All checked templates passed; skipped templates remain unverified (see reasons above)."
fi
