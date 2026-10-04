import { BackendTemplate } from '../types';

export const luckyCrTemplate: BackendTemplate = {
  id: 'lucky-cr',
  name: 'lucky-cr',
  displayName: 'Lucky (Crystal)',
  description: 'Full-stack Rails-like web framework for Crystal with ORM, authentication, and testing',
  language: 'crystal',
  framework: 'lucky',
  version: '1.0.0',
  tags: ['crystal', 'lucky', 'full-stack', 'database', 'authentication', 'mvc'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'database', 'rest-api', 'testing', 'docker'],

  // A Lucky API app (the layout `lucky init --api` produces) plus a Product resource.
  files: {
    '.gitattributes': `*.cr text eol=lf`,

    '.gitignore': `/docs/
/lib/
/bin/
/.shards/
*.dwarf
*.local.cr
.env
/tmp`,

    'config/application.cr': `# This file may be used for custom Application configurations.
# It will be loaded before other config files.
#
# Read more on configuration:
#   https://luckyframework.org/guides/getting-started/configuration#configuring-your-own-code

# Use this code as an example:
#
# \`\`\`
# module Application
#   Habitat.create do
#     setting support_email : String
#     setting lock_with_basic_auth : Bool
#   end
# end
#
# Application.configure do |settings|
#   settings.support_email = "support@myapp.io"
#   settings.lock_with_basic_auth = LuckyEnv.staging?
# end
#
# # In your application, call
# # \`Application.settings.support_email\` anywhere you need it.
# \`\`\`
`,

    'config/authentic.cr': `require "./server"

Authentic.configure do |settings|
  settings.secret_key = Lucky::Server.settings.secret_key_base

  unless LuckyEnv.production?
    # This value can be between 4 and 31
    fastest_encryption_possible = 4
    settings.encryption_cost = fastest_encryption_possible
  end
end
`,

    'config/colors.cr': `# This enables the color output when in development or test
# Check out the Colorize docs for more information
# https://crystal-lang.org/api/Colorize.html
Colorize.enabled = LuckyEnv.development? || LuckyEnv.test?
`,

    'config/cookies.cr': `require "./server"

Lucky::Session.configure do |settings|
  settings.key = "_{{projectName}}_session"
end

Lucky::CookieJar.configure do |settings|
  settings.on_set = ->(cookie : HTTP::Cookie) {
    # If ForceSSLHandler is enabled, only send cookies over HTTPS
    cookie.secure(Lucky::ForceSSLHandler.settings.enabled)

    # By default, don't allow reading cookies with JavaScript
    cookie.http_only(true)

    # Restrict cookies to a first-party or same-site context
    cookie.samesite(:lax)

    # Set all cookies to the root path by default
    cookie.path("/")

    # You can set other defaults for cookies here. For example:
    #
    #    cookie.expires(1.year.from_now).domain("mydomain.com")
  }
end
`,

    'config/database.cr': `# Avram does not quote database names, so keep only letters, digits and underscores.
database_name = "#{"{{projectName}}".gsub(/\\W/, "_")}_#{LuckyEnv.environment}"

AppDatabase.configure do |settings|
  if LuckyEnv.production?
    settings.credentials = Avram::Credentials.parse(ENV["DATABASE_URL"])
  else
    settings.credentials = Avram::Credentials.parse?(ENV["DATABASE_URL"]?) || Avram::Credentials.new(
      database: database_name,
      hostname: ENV["DB_HOST"]? || "localhost",
      port: ENV["DB_PORT"]?.try(&.to_i) || 5432,
      # Some common usernames are "postgres", "root", or your system username (run 'whoami')
      username: ENV["DB_USERNAME"]? || "postgres",
      # Some Postgres installations require no password. Use "" if that is the case.
      password: ENV["DB_PASSWORD"]? || "postgres"
    )
  end
end

Avram.configure do |settings|
  settings.database_to_migrate = AppDatabase

  # In production, allow lazy loading (N+1).
  # In development and test, raise an error if you forget to preload associations
  settings.lazy_load_enabled = LuckyEnv.production?

  # Always parse \`Time\` values with these specific formats.
  # Used for both database values, and datetime input fields.
  # settings.time_formats << "%F"
end
`,

    'config/email.cr': `require "carbon_sendgrid_adapter"

BaseEmail.configure do |settings|
  if LuckyEnv.production?
    # If you don't need to send emails, set the adapter to DevAdapter instead:
    #
    #   settings.adapter = Carbon::DevAdapter.new
    #
    # If you do need emails, get a key from SendGrid and set an ENV variable
    send_grid_key = send_grid_key_from_env
    settings.adapter = Carbon::SendGridAdapter.new(api_key: send_grid_key)
  elsif LuckyEnv.development?
    settings.adapter = Carbon::DevAdapter.new(print_emails: true)
  else
    settings.adapter = Carbon::DevAdapter.new
  end
end

private def send_grid_key_from_env
  ENV["SEND_GRID_KEY"]? || raise_missing_key_message
end

private def raise_missing_key_message
  puts "Missing SEND_GRID_KEY. Set the SEND_GRID_KEY env variable to 'unused' if not sending emails, or set the SEND_GRID_KEY ENV var.".colorize.red
  exit(1)
end
`,

    'config/env.cr': `# Environments are managed using \`LuckyEnv\`. By default, development, production
# and test are supported. See
# https://luckyframework.org/guides/getting-started/configuration for details.
#
# The default environment is development unless the environment variable
# LUCKY_ENV is set.
#
# Example:
# \`\`\`
# LuckyEnv.environment  # => "development"
# LuckyEnv.development? # => true
# LuckyEnv.production?  # => false
# LuckyEnv.test?        # => false
# \`\`\`
#
# New environments can be added using the \`LuckyEnv.add_env\` macro.
#
# Example:
# \`\`\`
# LuckyEnv.add_env :staging
# LuckyEnv.staging? # => false
# \`\`\`
#
# To determine whether or not a \`LuckyTask\` is currently running, you can use
# the \`LuckyEnv.task?\` predicate.
#
# Example:
# \`\`\`
# LuckyEnv.task? # => false
# \`\`\`

# Add a staging environment.
# LuckyEnv.add_env :staging
`,

    'config/error_handler.cr': `Lucky::ErrorHandler.configure do |settings|
  settings.show_debug_output = !LuckyEnv.production?
end
`,

    'config/log.cr': `require "file_utils"

if LuckyEnv.test?
  # Logs to \`tmp/test.log\` so you can see what's happening without having
  # a bunch of log output in your spec results.
  FileUtils.mkdir_p("tmp")

  backend = Log::IOBackend.new(File.new("tmp/test.log", mode: "w"))
  backend.formatter = Lucky::PrettyLogFormatter.proc
  Log.dexter.configure(:debug, backend)
elsif LuckyEnv.production?
  # Lucky uses JSON in production so logs can be searched more easily
  #
  # If you want logs like in development use 'Lucky::PrettyLogFormatter.proc'.
  backend = Log::IOBackend.new
  backend.formatter = Dexter::JSONLogFormatter.proc
  Log.dexter.configure(:info, backend)
else
  # Use a pretty formatter printing to STDOUT in development
  backend = Log::IOBackend.new
  backend.formatter = Lucky::PrettyLogFormatter.proc
  Log.dexter.configure(:debug, backend)
  DB::Log.level = :info
end

# Lucky only logs when before/after pipes halt by redirecting, or rendering a
# response. Pipes that run without halting are not logged.
#
# If you want to log every pipe that runs, set the log level to ':info'
Lucky::ContinuedPipeLog.dexter.configure(:none)

# Lucky only logs failed queries by default.
#
# Set the log to ':info' to log all queries
Avram::QueryLog.dexter.configure(:none)

# Subscribe to Pulsar events to log when queries are made,
# queries fail, or save operations fail. Remove this to
# disable these log events without disabling all logging.
Avram.initialize_logging

# Skip logging static assets requests in development
Lucky::LogHandler.configure do |settings|
  if LuckyEnv.development?
    settings.skip_if = ->(context : HTTP::Server::Context) {
      context.request.method.downcase == "get" &&
      context.request.resource.starts_with?(/\\/css\\/|\\/js\\/|\\/assets\\/|\\/favicon\\.ico/)
    }
  end
end
`,

    'config/route_helper.cr': `# This is used when generating URLs for your application
Lucky::RouteHelper.configure do |settings|
  if LuckyEnv.production?
    # Example: https://my_app.com
    settings.base_uri = ENV.fetch("APP_DOMAIN")
  else
    # Set domain to the default host/port in development/test
    settings.base_uri = "http://localhost:#{Lucky::ServerSettings.port}"
  end
end
`,

    'config/server.cr': `# Here is where you configure the Lucky server
#
# Look at config/route_helper.cr if you want to change the domain used when
# generating links with \`Action.url\`.
Lucky::Server.configure do |settings|
  if LuckyEnv.production?
    settings.secret_key_base = secret_key_from_env
    settings.host = "0.0.0.0"
    settings.port = ENV["PORT"].to_i
    settings.gzip_enabled = true
    # By default certain content types will be gzipped.
    # For a full list look in
    # https://github.com/luckyframework/lucky/blob/main/src/lucky/server.cr
    # To add additional extensions do something like this:
    # settings.gzip_content_types << "content/type"
  else
    settings.secret_key_base = "RRxUo73yzX8tSiSSmfTy3q5jXNnF/l2+qwqGEsRIsko="
    # Change host/port in config/watch.yml
    # Alternatively, you can set the DEV_PORT env to set the port for local development
    settings.host = Lucky::ServerSettings.host
    settings.port = Lucky::ServerSettings.port
  end

  # Configure asset host
  if LuckyEnv.development?
    # In development, assets are served from the dev server
    settings.asset_host = ""
  elsif LuckyEnv.production?
    # In production, Lucky serves the built assets
    # You could also use a CDN here:
    # settings.asset_host = "https://mycdnhost.com"
    settings.asset_host = ""
  else
    settings.asset_host = ""
  end
end

Lucky::ForceSSLHandler.configure do |settings|
  # To force SSL in production, uncomment the lines below.
  # This will cause http requests to be redirected to https:
  #
  #    settings.enabled = LuckyEnv.production?
  #    settings.strict_transport_security = {max_age: 1.year, include_subdomains: true}
  #
  # Or, leave it disabled:
  settings.enabled = false
end

# Set a unique ID for each HTTP request.
# To enable the request ID, uncomment the lines below.
# You can set your own custom String, or use a random UUID.
# Lucky::RequestIdHandler.configure do |settings|
#   settings.set_request_id = ->(context : HTTP::Server::Context) {
#     UUID.random.to_s
#   }
# end

private def secret_key_from_env
  ENV["SECRET_KEY_BASE"]? || raise_missing_secret_key_in_production
end

private def raise_missing_secret_key_in_production
  puts "Please set the SECRET_KEY_BASE environment variable. You can generate a secret key with 'lucky gen.secret_key'".colorize.red
  exit(1)
end
`,

    'config/watch.yml': `host: 127.0.0.1
port: 3000
reload_port: 3001
`,

    'db/migrations/00000000000001_create_users.cr': `class CreateUsers::V00000000000001 < Avram::Migrator::Migration::V1
  def migrate
    enable_extension "citext"

    create table_for(User) do
      primary_key id : Int64
      add_timestamps
      add email : String, unique: true, case_sensitive: false
      add encrypted_password : String
    end
  end

  def rollback
    drop table_for(User)
    disable_extension "citext"
  end
end
`,

    'db/migrations/00000000000002_create_products.cr': `class CreateProducts::V00000000000002 < Avram::Migrator::Migration::V1
  def migrate
    create table_for(Product) do
      primary_key id : Int64
      add_timestamps
      add name : String
      add description : String?
      add price_cents : Int32
      add stock : Int32, default: 0
    end
  end

  def rollback
    drop table_for(Product)
  end
end
`,

    'docker/dev_entrypoint.sh': `#!/bin/bash

set -euo pipefail

# This is the entrypoint script used for development docker workflows.
# By default it will:
#  - Install dependencies.
#  - Run migrations.
#  - Start the dev server.
# It also accepts any commands to be run instead.


warnfail () {
  echo "$@" >&2
  exit 1
}

case \${1:-} in
  "") # If no arguments are provided, start lucky dev server.
    ;;

  *) # If any arguments are provided, execute them instead.
    exec "$@"
esac

if ! [ -d bin ] ; then
  echo 'Creating bin directory'
  mkdir bin
fi
if ! shards check ; then
  echo 'Installing shards...'
  shards install
fi

echo 'Waiting for postgres to be available...'
bash ./docker/wait-for-it.sh -q postgres:5432

if ! psql -d "$DATABASE_URL" -c '\\d migrations' > /dev/null ; then
  echo 'Finishing database setup...'
  lucky db.migrate
fi

echo 'Starting lucky dev server...'
exec lucky dev
`,

    'docker/development.dockerfile': `FROM crystallang/crystal:1.18.2

# Install utilities required to make this Dockerfile run
RUN apt-get update && \\
    apt-get install -y wget curl unzip

# Apt installs:
# - Postgres cli tools are required for lucky-cli.
RUN apt-get update && \\
    apt-get install -y postgresql-client && \\
    rm -rf /var/lib/apt/lists/*


# Install lucky cli
WORKDIR /lucky/cli
RUN git clone https://github.com/luckyframework/lucky_cli . && \\
    git checkout v1.5.0 && \\
    shards build --without-development && \\
    cp bin/lucky /usr/bin

WORKDIR /app
ENV DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/postgres
EXPOSE 3000
EXPOSE 3001
`,

    'docker/wait-for-it.sh': `#!/usr/bin/bash
#
# Pulled from https://github.com/vishnubob/wait-for-it on 2022-02-28.
# Licensed under the MIT license as of 81b1373f.
#
# Below this line, wait-for-it is the original work of the author.
#
# Use this script to test if a given TCP host/port are available

WAITFORIT_cmdname=\${0##*/}

echoerr() { if [[ $WAITFORIT_QUIET -ne 1 ]]; then echo "$@" 1>&2; fi }

usage()
{
    cat << USAGE >&2
Usage:
    $WAITFORIT_cmdname host:port [-s] [-t timeout] [-- command args]
    -h HOST | --host=HOST       Host or IP under test
    -p PORT | --port=PORT       TCP port under test
                                Alternatively, you specify the host and port as host:port
    -s | --strict               Only execute subcommand if the test succeeds
    -q | --quiet                Don't output any status messages
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for()
{
    if [[ $WAITFORIT_TIMEOUT -gt 0 ]]; then
        echoerr "$WAITFORIT_cmdname: waiting $WAITFORIT_TIMEOUT seconds for $WAITFORIT_HOST:$WAITFORIT_PORT"
    else
        echoerr "$WAITFORIT_cmdname: waiting for $WAITFORIT_HOST:$WAITFORIT_PORT without a timeout"
    fi
    WAITFORIT_start_ts=$(date +%s)
    while :
    do
        if [[ $WAITFORIT_ISBUSY -eq 1 ]]; then
            nc -z $WAITFORIT_HOST $WAITFORIT_PORT
            WAITFORIT_result=$?
        else
            (echo -n > /dev/tcp/$WAITFORIT_HOST/$WAITFORIT_PORT) >/dev/null 2>&1
            WAITFORIT_result=$?
        fi
        if [[ $WAITFORIT_result -eq 0 ]]; then
            WAITFORIT_end_ts=$(date +%s)
            echoerr "$WAITFORIT_cmdname: $WAITFORIT_HOST:$WAITFORIT_PORT is available after $((WAITFORIT_end_ts - WAITFORIT_start_ts)) seconds"
            break
        fi
        sleep 1
    done
    return $WAITFORIT_result
}

wait_for_wrapper()
{
    # In order to support SIGINT during timeout: http://unix.stackexchange.com/a/57692
    if [[ $WAITFORIT_QUIET -eq 1 ]]; then
        timeout $WAITFORIT_BUSYTIMEFLAG $WAITFORIT_TIMEOUT $0 --quiet --child --host=$WAITFORIT_HOST --port=$WAITFORIT_PORT --timeout=$WAITFORIT_TIMEOUT &
    else
        timeout $WAITFORIT_BUSYTIMEFLAG $WAITFORIT_TIMEOUT $0 --child --host=$WAITFORIT_HOST --port=$WAITFORIT_PORT --timeout=$WAITFORIT_TIMEOUT &
    fi
    WAITFORIT_PID=$!
    trap "kill -INT -$WAITFORIT_PID" INT
    wait $WAITFORIT_PID
    WAITFORIT_RESULT=$?
    if [[ $WAITFORIT_RESULT -ne 0 ]]; then
        echoerr "$WAITFORIT_cmdname: timeout occurred after waiting $WAITFORIT_TIMEOUT seconds for $WAITFORIT_HOST:$WAITFORIT_PORT"
    fi
    return $WAITFORIT_RESULT
}

# process arguments
while [[ $# -gt 0 ]]
do
    case "$1" in
        *:* )
        WAITFORIT_hostport=(\${1//:/ })
        WAITFORIT_HOST=\${WAITFORIT_hostport[0]}
        WAITFORIT_PORT=\${WAITFORIT_hostport[1]}
        shift 1
        ;;
        --child)
        WAITFORIT_CHILD=1
        shift 1
        ;;
        -q | --quiet)
        WAITFORIT_QUIET=1
        shift 1
        ;;
        -s | --strict)
        WAITFORIT_STRICT=1
        shift 1
        ;;
        -h)
        WAITFORIT_HOST="$2"
        if [[ $WAITFORIT_HOST == "" ]]; then break; fi
        shift 2
        ;;
        --host=*)
        WAITFORIT_HOST="\${1#*=}"
        shift 1
        ;;
        -p)
        WAITFORIT_PORT="$2"
        if [[ $WAITFORIT_PORT == "" ]]; then break; fi
        shift 2
        ;;
        --port=*)
        WAITFORIT_PORT="\${1#*=}"
        shift 1
        ;;
        -t)
        WAITFORIT_TIMEOUT="$2"
        if [[ $WAITFORIT_TIMEOUT == "" ]]; then break; fi
        shift 2
        ;;
        --timeout=*)
        WAITFORIT_TIMEOUT="\${1#*=}"
        shift 1
        ;;
        --)
        shift
        WAITFORIT_CLI=("$@")
        break
        ;;
        --help)
        usage
        ;;
        *)
        echoerr "Unknown argument: $1"
        usage
        ;;
    esac
done

if [[ "$WAITFORIT_HOST" == "" || "$WAITFORIT_PORT" == "" ]]; then
    echoerr "Error: you need to provide a host and port to test."
    usage
fi

WAITFORIT_TIMEOUT=\${WAITFORIT_TIMEOUT:-15}
WAITFORIT_STRICT=\${WAITFORIT_STRICT:-0}
WAITFORIT_CHILD=\${WAITFORIT_CHILD:-0}
WAITFORIT_QUIET=\${WAITFORIT_QUIET:-0}

# Check to see if timeout is from busybox?
WAITFORIT_TIMEOUT_PATH=$(type -p timeout)
WAITFORIT_TIMEOUT_PATH=$(realpath $WAITFORIT_TIMEOUT_PATH 2>/dev/null || readlink -f $WAITFORIT_TIMEOUT_PATH)

WAITFORIT_BUSYTIMEFLAG=""
if [[ $WAITFORIT_TIMEOUT_PATH =~ "busybox" ]]; then
    WAITFORIT_ISBUSY=1
    # Check if busybox timeout uses -t flag
    # (recent Alpine versions don't support -t anymore)
    if timeout &>/dev/stdout | grep -q -e '-t '; then
        WAITFORIT_BUSYTIMEFLAG="-t"
    fi
else
    WAITFORIT_ISBUSY=0
fi

if [[ $WAITFORIT_CHILD -gt 0 ]]; then
    wait_for
    WAITFORIT_RESULT=$?
    exit $WAITFORIT_RESULT
else
    if [[ $WAITFORIT_TIMEOUT -gt 0 ]]; then
        wait_for_wrapper
        WAITFORIT_RESULT=$?
    else
        wait_for
        WAITFORIT_RESULT=$?
    fi
fi

if [[ $WAITFORIT_CLI != "" ]]; then
    if [[ $WAITFORIT_RESULT -ne 0 && $WAITFORIT_STRICT -eq 1 ]]; then
        echoerr "$WAITFORIT_cmdname: strict mode, refusing to execute subprocess"
        exit $WAITFORIT_RESULT
    fi
    exec "\${WAITFORIT_CLI[@]}"
else
    exit $WAITFORIT_RESULT
fi

`,

    'docker-compose.yml': `services:
  lucky:
    build:
      context: .
      dockerfile: docker/development.dockerfile
    environment:
      DATABASE_URL: postgres://lucky:password@postgres:5432/lucky
      DEV_HOST: "0.0.0.0"
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - shards_lib:/app/lib
      - app_bin:/app/bin
      - build_cache:/root/.cache
    depends_on:
      - postgres
    ports:
      - 3000:3000 # This is the Lucky Server port
      - 3001:3001 # This is the Lucky watcher reload port

    entrypoint: ["bash", "docker/dev_entrypoint.sh"]

  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: lucky
      POSTGRES_PASSWORD: password
      POSTGRES_DB: lucky
    volumes:
      - postgres_data:/var/lib/postgresql
    ports:
      # The postgres database container is exposed on the host at port 6543 to
      # allow connecting directly to it with postgres clients. The port differs
      # from the postgres default to avoid conflict with existing postgres
      # servers. Connect to a running postgres container with:
      # postgres://lucky:password@localhost:6543/lucky
      - 6543:5432

volumes:
  postgres_data:
  node_modules:
  shards_lib:
  app_bin:
  build_cache:
`,

    'Procfile': `web: bin/{{projectName}}
release: lucky db.migrate
`,

    'Procfile.dev': `system_check: crystal script/system_check.cr
web: lucky watch
`,

    'README.md': `# {{projectName}}

{{description}}

A JSON API built with [Lucky](https://luckyframework.org) (Crystal) and its Avram ORM on PostgreSQL.
It was laid out the way \`lucky init --api\` does and then extended with a \`Product\` resource,
so the standard Lucky guides and generators apply.

## What is included

- JWT sign up and sign in (\`/api/sign_ups\`, \`/api/sign_ins\`, \`/api/me\`) using Authentic
- A \`Product\` model with migration, validations, serializer, pagination and CRUD actions
- Request specs against a real database (\`spec/requests\`)
- Lucky tasks (\`tasks.cr\`) for migrations and seeds

## Requirements

- Crystal >= 1.16.3 and \`shards\`
- PostgreSQL (see \`config/database.cr\`, or set \`DATABASE_URL\`)
- The [Lucky CLI](https://luckyframework.org/guides/getting-started/installing) is optional:
  \`lucky dev\` gives live reload, and \`lucky db.migrate\` and friends are also reachable
  through the compiled tasks binary shown below

## Getting started

\`\`\`bash
shards install
crystal build tasks.cr -o bin/lucky_tasks
bin/lucky_tasks db.create
bin/lucky_tasks db.migrate
crystal run src/start_server.cr           # http://localhost:3000
\`\`\`

With the Lucky CLI installed, \`crystal script/setup.cr\` does the same and \`lucky dev\` starts
a watching server. Set \`SECRET_KEY_BASE\` (\`lucky gen.secret_key\`) and \`DATABASE_URL\` in production.

Or use Docker: \`docker compose up\` (see \`docker-compose.yml\`).

## API

| Method | Path | Auth |
| --- | --- | --- |
| GET | \`/\` | no |
| GET | \`/api/health\` | no |
| POST | \`/api/sign_ups\` with \`{"user": {"email", "password", "password_confirmation"}}\` | no |
| POST | \`/api/sign_ins\` with \`{"user": {"email", "password"}}\` | no |
| GET | \`/api/me\` | bearer token |
| GET | \`/api/products?page=1\` | no |
| GET | \`/api/products/:product_id\` | no |
| POST | \`/api/products\` with \`{"product": {"name", "price_cents", "stock"}}\` | bearer token |
| PUT | \`/api/products/:product_id\` | bearer token |
| DELETE | \`/api/products/:product_id\` | bearer token |

Send the token as \`Authorization: Bearer <token>\`.

## Tests

The specs need PostgreSQL (\`LUCKY_ENV=test\` is set by \`spec/spec_helper.cr\`):

\`\`\`bash
crystal spec
\`\`\`

## License

MIT
`,

    'script/helpers/function_helpers.cr': `require "colorize"

# These are helper methods provided to help keep your code
# clean. Add new methods, or alter these as needed.

def notice(message : String) : Nil
  puts "\\n▸ #{message}"
end

def print_done : Nil
  puts "✔ Done"
end

def print_error(message : String) : Nil
  puts "There is a problem with your system setup:\\n".colorize.red.bold
  puts "#{message}\\n".colorize.red.bold
  Process.exit(1)
end

def command_not_found(command : String) : Bool
  Process.find_executable(command).nil?
end

def command_not_running(command : String, *args) : Bool
  output = IO::Memory.new
  code = Process.run(command, args, output: output).exit_code
  code > 0
end

def run_command(command : String, *args) : Nil
  Process.run(command, args, output: STDOUT, error: STDERR, input: STDIN)
end
`,

    'script/setup.cr': `require "./helpers/*"

notice "Running System Check"

require "./system_check"

print_done

notice "Installing shards"
run_command "shards", "install"

print_done


if !File.exists?(".env")
  notice "No .env found. Creating one."
  File.touch ".env"
  print_done
end

notice "Setting up the database"

run_command "lucky", "db.setup"

notice "Seeding the database with required and sample records"
run_command "lucky", "db.seed.required_data"
run_command "lucky", "db.seed.sample_data"

print_done
notice "Run 'lucky dev' to start the app"
`,

    'script/system_check.cr': `require "./helpers/*"

# Use this script to check the system for required tools and process that your app needs.
# A few helper functions are provided to keep the code simple. See the
# script/helpers/function_helpers.cr file for more examples.
#
# A few examples you might use here:
#   * 'lucky db.verify_connection' to test postgres can be connected
#   * Checking that elasticsearch, redis, or postgres is installed and/or booted
#   * Note: Booting additional processes for things like mail, background jobs, etc...
#     should go in your Procfile.dev.


# CUSTOM PRE-BOOT CHECKS
# example:
# if command_not_running "redis-cli", "ping"
#   print_error "Redis is not running."
# end
`,

    'shard.yml': `name: {{projectName}}
version: 0.1.0

targets:
  {{projectName}}:
    main: src/start_server.cr

crystal: ">= 1.16.3"

license: MIT

dependencies:
  lucky:
    github: luckyframework/lucky
    version: ~> 1.5.0
  avram:
    github: luckyframework/avram
    version: ~> 1.5.0
  carbon:
    github: luckyframework/carbon
    version: ~> 0.6.0
  carbon_sendgrid_adapter:
    github: luckyframework/carbon_sendgrid_adapter
    version: ~> 0.6.0
  lucky_env:
    github: luckyframework/lucky_env
    version: ~> 0.3.0
  lucky_task:
    github: luckyframework/lucky_task
    version: ~> 0.3.0
  authentic:
    github: luckyframework/authentic
    version: ">= 1.0.2, < 2.0.0"
  jwt:
    github: crystal-community/jwt
    version: ~> 1.6.1

development_dependencies: {}
`,

    'spec/requests/api/health/show_spec.cr': `require "../../../spec_helper"

describe Api::Health::Show do
  it "reports healthy without authentication" do
    response = ApiClient.exec(Api::Health::Show)

    response.should send_json(200, {status: "healthy"})
  end
end
`,

    'spec/requests/api/me/show_spec.cr': `require "../../../spec_helper"

describe Api::Me::Show do
  it "returns the signed in user" do
    user = UserFactory.create

    response = ApiClient.auth(user).exec(Api::Me::Show)

    response.should send_json(200, email: user.email)
  end

  it "fails if not authenticated" do
    response = ApiClient.exec(Api::Me::Show)

    response.status_code.should eq(401)
  end
end
`,

    'spec/requests/api/products/products_spec.cr': `require "../../../spec_helper"

describe "Api::Products" do
  it "lists products with pagination info" do
    ProductFactory.create &.name("First")
    ProductFactory.create &.name("Second")

    response = ApiClient.exec(Api::Products::Index)

    response.status_code.should eq(200)
    body = JSON.parse(response.body)
    body["items"].as_a.map(&.["name"].as_s).should eq(["First", "Second"])
    body["pagination"]["total_items"].as_i.should eq(2)
  end

  it "shows a product" do
    product = ProductFactory.create &.name("Widget")

    response = ApiClient.exec(Api::Products::Show.with(product_id: product.id))

    response.should send_json(200, name: "Widget", in_stock: true)
  end

  it "returns 404 for an unknown product" do
    response = ApiClient.exec(Api::Products::Show.with(product_id: 0))

    response.status_code.should eq(404)
  end

  it "requires authentication to create a product" do
    response = ApiClient.exec(Api::Products::Create, product: {name: "Nope", price_cents: 100})

    response.status_code.should eq(401)
  end

  it "creates a product for a signed in user" do
    user = UserFactory.create

    response = ApiClient.auth(user).exec(Api::Products::Create, product: {name: "Gadget", price_cents: 2500, stock: 3})

    response.should send_json(201, name: "Gadget", price_cents: 2500, stock: 3)
    ProductQuery.new.select_count.should eq(1)
  end

  it "rejects an invalid product" do
    user = UserFactory.create

    response = ApiClient.auth(user).exec(Api::Products::Create, product: {name: "Free?", price_cents: -1})

    response.status_code.should eq(400)
    ProductQuery.new.select_count.should eq(0)
  end

  it "updates a product" do
    user = UserFactory.create
    product = ProductFactory.create &.stock(1)

    response = ApiClient.auth(user).exec(Api::Products::Update.with(product_id: product.id), product: {stock: 0})

    response.should send_json(200, stock: 0, in_stock: false)
  end

  it "deletes a product" do
    user = UserFactory.create
    product = ProductFactory.create

    response = ApiClient.auth(user).exec(Api::Products::Delete.with(product_id: product.id))

    response.status_code.should eq(204)
    ProductQuery.new.select_count.should eq(0)
  end
end
`,

    'spec/requests/api/sign_ins/create_spec.cr': `require "../../../spec_helper"

describe Api::SignIns::Create do
  it "returns a token" do
    UserToken.stub_token("fake-token") do
      user = UserFactory.create

      response = ApiClient.exec(Api::SignIns::Create, user: valid_params(user))

      response.should send_json(200, token: "fake-token")
    end
  end

  it "returns an error if credentials are invalid" do
    user = UserFactory.create
    invalid_params = valid_params(user).merge(password: "incorrect")

    response = ApiClient.exec(Api::SignIns::Create, user: invalid_params)

    response.should send_json(
      400,
      param: "password",
      details: "password is wrong"
    )
  end
end

private def valid_params(user : User)
  {
    email:    user.email,
    password: "password",
  }
end
`,

    'spec/requests/api/sign_ups/create_spec.cr': `require "../../../spec_helper"

describe Api::SignUps::Create do
  it "creates user on sign up" do
    UserToken.stub_token("fake-token") do
      response = ApiClient.exec(Api::SignUps::Create, user: valid_params)

      response.should send_json(200, token: "fake-token")
      new_user = UserQuery.first
      new_user.email.should eq(valid_params[:email])
    end
  end

  it "returns error for invalid params" do
    invalid_params = valid_params.merge(password_confirmation: "wrong")

    response = ApiClient.exec(Api::SignUps::Create, user: invalid_params)

    UserQuery.new.select_count.should eq(0)
    response.should send_json(
      400,
      param: "password_confirmation",
      details: "password_confirmation must match"
    )
  end
end

private def valid_params
  {
    email:                 "test@email.com",
    password:              "password",
    password_confirmation: "password",
  }
end
`,

    'spec/setup/clean_database.cr': `Spec.before_each do
  AppDatabase.truncate
end
`,

    'spec/setup/reset_emails.cr': `Spec.before_each do
  Carbon::DevAdapter.reset
end
`,

    'spec/setup/setup_database.cr': `Db::Create.new(quiet: true).call
Db::Migrate.new(quiet: true).call
`,

    'spec/setup/start_app_server.cr': `app_server = AppServer.new

spawn do
  app_server.listen
end

Spec.after_suite do
  app_server.close
end
`,

    'spec/spec_helper.cr': `ENV["LUCKY_ENV"] = "test"
ENV["DEV_PORT"] = "5001"
require "spec"
require "../src/app"
require "./support/**"
require "../db/migrations/**"

# Add/modify files in spec/setup to start/configure programs or run hooks
#
# By default there are scripts for setting up and cleaning the database,
# configuring LuckyFlow, starting the app server, etc.
require "./setup/**"

include Carbon::Expectations
include Lucky::RequestExpectations

Avram::Migrator::Runner.new.ensure_migrated!
Avram::SchemaEnforcer.ensure_correct_column_mappings!
Habitat.raise_if_missing_settings!
`,

    'spec/support/api_client.cr': `class ApiClient < Lucky::BaseHTTPClient
  app AppServer.new

  def initialize
    super
    headers("Content-Type": "application/json")
  end

  def self.auth(user : User)
    new.headers("Authorization": UserToken.generate(user))
  end
end
`,

    'spec/support/factories/product_factory.cr': `class ProductFactory < Avram::Factory
  def initialize
    name "Product #{sequence("product")}"
    description "A product"
    price_cents 1999
    stock 10
  end
end
`,

    'spec/support/factories/user_factory.cr': `class UserFactory < Avram::Factory
  def initialize
    email "#{sequence("test-email")}@example.com"
    encrypted_password Authentic.generate_encrypted_password("password")
  end
end
`,

    'src/actions/api/health/show.cr': `class Api::Health::Show < ApiAction
  include Api::Auth::SkipRequireAuthToken

  get "/api/health" do
    json({status: "healthy", timestamp: Time.utc.to_rfc3339})
  end
end
`,

    'src/actions/api/me/show.cr': `class Api::Me::Show < ApiAction
  get "/api/me" do
    json UserSerializer.new(current_user)
  end
end
`,

    'src/actions/api/products/create.cr': `class Api::Products::Create < ApiAction
  post "/api/products" do
    product = SaveProduct.create!(params)

    json ProductSerializer.new(product), HTTP::Status::CREATED
  end
end
`,

    'src/actions/api/products/delete.cr': `class Api::Products::Delete < ApiAction
  delete "/api/products/:product_id" do
    ProductQuery.find(product_id).delete

    head HTTP::Status::NO_CONTENT
  end
end
`,

    'src/actions/api/products/index.cr': `class Api::Products::Index < ApiAction
  include Api::Auth::SkipRequireAuthToken

  get "/api/products" do
    pages, products = paginate(ProductQuery.new.id.asc_order)

    json ProductSerializer.for_collection(products, pages)
  end
end
`,

    'src/actions/api/products/show.cr': `class Api::Products::Show < ApiAction
  include Api::Auth::SkipRequireAuthToken

  get "/api/products/:product_id" do
    json ProductSerializer.new(ProductQuery.find(product_id))
  end
end
`,

    'src/actions/api/products/update.cr': `class Api::Products::Update < ApiAction
  put "/api/products/:product_id" do
    product = SaveProduct.update!(ProductQuery.find(product_id), params)

    json ProductSerializer.new(product)
  end
end
`,

    'src/actions/api/sign_ins/create.cr': `class Api::SignIns::Create < ApiAction
  include Api::Auth::SkipRequireAuthToken

  post "/api/sign_ins" do
    SignInUser.run(params) do |operation, user|
      if user
        json({token: UserToken.generate(user)})
      else
        raise Avram::InvalidOperationError.new(operation)
      end
    end
  end
end
`,

    'src/actions/api/sign_ups/create.cr': `class Api::SignUps::Create < ApiAction
  include Api::Auth::SkipRequireAuthToken

  post "/api/sign_ups" do
    user = SignUpUser.create!(params)
    json({token: UserToken.generate(user)})
  end
end
`,

    'src/actions/api_action.cr': `# Include modules and add methods that are for all API requests
abstract class ApiAction < Lucky::Action
  # APIs typically do not need to send cookie/session data.
  # Remove this line if you want to send cookies in the response header.
  disable_cookies
  accepted_formats [:json]

  include Api::Auth::Helpers

  # Adds \`paginate(query)\` for list endpoints (reads the \`page\` param).
  include Lucky::Paginator::BackendHelpers

  # By default all actions require sign in.
  # Add 'include Api::Auth::SkipRequireAuthToken' to your actions to allow all requests.
  include Api::Auth::RequireAuthToken

  # By default all actions are required to use underscores to separate words.
  # Add 'include Lucky::SkipRouteStyleCheck' to your actions if you wish to ignore this check for specific routes.
  include Lucky::EnforceUnderscoredRoute
end
`,

    'src/actions/errors/show.cr': `# This class handles error responses and reporting.
#
# https://luckyframework.org/guides/http-and-routing/error-handling
class Errors::Show < Lucky::ErrorAction
  DEFAULT_MESSAGE = "Something went wrong."
  default_format :json
  dont_report [Lucky::RouteNotFoundError, Avram::RecordNotFoundError]

  def render(error : Lucky::RouteNotFoundError | Avram::RecordNotFoundError)
    error_json "Not found", status: 404
  end

  # When an InvalidOperationError is raised, show a helpful error with the
  # param that is invalid, and what was wrong with it.
  def render(error : Avram::InvalidOperationError)
    error_json \\
      message: error.renderable_message,
      details: error.renderable_details,
      param: error.invalid_attribute_name,
      status: 400
  end

  # Always keep this below other 'render' methods or it may override your
  # custom 'render' methods.
  def render(error : Lucky::RenderableError)
    error_json error.renderable_message, status: error.renderable_status
  end

  # If none of the 'render' methods return a response for the raised Exception,
  # Lucky will use this method.
  def default_render(error : Exception) : Lucky::Response
    error_json DEFAULT_MESSAGE, status: 500
  end

  private def error_json(message : String, status : Int, details = nil, param = nil)
    json ErrorSerializer.new(message: message, details: details, param: param), status: status
  end

  private def report(error : Exception) : Nil
    # Send to Rollbar, send an email, etc.
  end
end
`,

    'src/actions/home/index.cr': `class Home::Index < ApiAction
  include Api::Auth::SkipRequireAuthToken

  get "/" do
    json({hello: "Hello World from Home::Index"})
  end
end
`,

    'src/actions/mixins/api/auth/helpers.cr': `module Api::Auth::Helpers
  # The 'memoize' macro makes sure only one query is issued to find the user
  memoize def current_user? : User?
    auth_token.try do |value|
      user_from_auth_token(value)
    end
  end

  private def auth_token : String?
    bearer_token || token_param
  end

  private def bearer_token : String?
    context.request.headers["Authorization"]?
      .try(&.gsub("Bearer", ""))
      .try(&.strip)
  end

  private def token_param : String?
    params.get?(:auth_token)
  end

  private def user_from_auth_token(token : String) : User?
    UserToken.decode_user_id(token).try do |user_id|
      UserQuery.new.id(user_id).first?
    end
  end
end
`,

    'src/actions/mixins/api/auth/require_auth_token.cr': `module Api::Auth::RequireAuthToken
  macro included
    before require_auth_token
  end

  private def require_auth_token
    if current_user?
      continue
    else
      json auth_error_json, 401
    end
  end

  private def auth_error_json
    ErrorSerializer.new(
      message: "Not authenticated.",
      details: auth_error_details
    )
  end

  private def auth_error_details : String
    if auth_token
      "The provided authentication token was incorrect."
    else
      "An authentication token is required. Please include a token in an 'auth_token' param or 'Authorization' header."
    end
  end

  # Tells the compiler that the current_user is not nil since we have checked
  # that the user is signed in
  private def current_user : User
    current_user?.as(User)
  end
end
`,

    'src/actions/mixins/api/auth/skip_require_auth_token.cr': `module Api::Auth::SkipRequireAuthToken
  macro included
    skip require_auth_token
  end

  # Since sign in is not required, current_user might be nil
  def current_user : User?
    current_user?
  end
end
`,

    'src/app_database.cr': `class AppDatabase < Avram::Database
end
`,

    'src/app_server.cr': `class AppServer < Lucky::BaseAppServer
  # Learn about middleware with HTTP::Handlers:
  # https://luckyframework.org/guides/http-and-routing/http-handlers
  def middleware : Array(HTTP::Handler)
    [
      Lucky::RequestIdHandler.new,
      Lucky::ForceSSLHandler.new,
      Lucky::HttpMethodOverrideHandler.new,
      Lucky::LogHandler.new,
      Lucky::ErrorHandler.new(action: Errors::Show),
      Lucky::RemoteIpHandler.new,
      Lucky::RouteHandler.new,

      # Disabled in API mode:
      # Lucky::StaticCompressionHandler.new("./public", file_ext: "gz", content_encoding: "gzip"),
      # Lucky::StaticFileHandler.new("./public", fallthrough: false, directory_listing: false),
      Lucky::RouteNotFoundHandler.new,
    ] of HTTP::Handler
  end

  def protocol
    "http"
  end

  def listen
    server.listen(host, port, reuse_port: false)
  end
end
`,

    'src/app.cr': `require "./shards"

require "../config/server"
require "./app_database"
require "../config/**"
require "./models/base_model"
require "./models/**"
require "./queries/**"
require "./operations/mixins/**"
require "./operations/**"
require "./serializers/base_serializer"
require "./serializers/**"
require "./emails/base_email"
require "./emails/**"
require "./actions/mixins/**"
require "./actions/**"
require "../db/migrations/**"
require "./app_server"
`,

    'src/emails/base_email.cr': `# Learn about sending emails
# https://luckyframework.org/guides/emails/sending-emails-with-carbon
abstract class BaseEmail < Carbon::Email
  # You can add defaults using the 'inherited' hook
  #
  # Example:
  #
  #   macro inherited
  #     from default_from
  #   end
  #
  #   def default_from
  #     Carbon::Address.new("support@app.com")
  #   end
end
`,

    'src/models/base_model.cr': `abstract class BaseModel < Avram::Model
  def self.database : Avram::Database.class
    AppDatabase
  end
end
`,

    'src/models/product.cr': `class Product < BaseModel
  table do
    column name : String
    column description : String?
    column price_cents : Int32
    column stock : Int32
  end

  def in_stock? : Bool
    stock > 0
  end
end
`,

    'src/models/user_token.cr': `# Generates and decodes JSON Web Tokens for Authenticating users.
class UserToken
  Habitat.create { setting stubbed_token : String? }
  ALGORITHM = JWT::Algorithm::HS256

  def self.generate(user : User) : String
    payload = {"user_id" => user.id}

    settings.stubbed_token || create_token(payload)
  end

  def self.create_token(payload)
    JWT.encode(payload, Lucky::Server.settings.secret_key_base, ALGORITHM)
  end

  def self.decode_user_id(token : String) : Int64?
    payload, _header = JWT.decode(token, Lucky::Server.settings.secret_key_base, ALGORITHM)
    payload["user_id"].to_s.to_i64
  rescue e : JWT::Error
    Lucky::Log.dexter.error { {jwt_decode_error: e.message} }
    nil
  end

  # Used in tests to return a fake token to test against.
  def self.stub_token(token : String, &)
    temp_config(stubbed_token: token) do
      yield
    end
  end
end
`,

    'src/models/user.cr': `class User < BaseModel
  include Carbon::Emailable
  include Authentic::PasswordAuthenticatable

  table do
    column email : String
    column encrypted_password : String
  end

  def emailable : Carbon::Address
    Carbon::Address.new(email)
  end
end
`,

    'src/operations/mixins/password_validations.cr': `module PasswordValidations
  macro included
    before_save run_password_validations
  end

  private def run_password_validations
    validate_required password, password_confirmation
    validate_confirmation_of password, with: password_confirmation
    # 72 is a limitation of BCrypt
    validate_size_of password, min: 6, max: 72
  end
end
`,

    'src/operations/mixins/user_from_email.cr': `module UserFromEmail
  private def user_from_email : User?
    email.value.try do |value|
      UserQuery.new.email(value).first?
    end
  end
end
`,

    'src/operations/request_password_reset.cr': `class RequestPasswordReset < Avram::Operation
  # You can modify this in src/operations/mixins/user_from_email.cr
  include UserFromEmail

  attribute email : String

  # Run validations and yield the operation and the user if valid
  def run
    user = user_from_email
    validate(user)

    if valid?
      user
    else
      nil
    end
  end

  def validate(user : User?)
    validate_required email
    if user.nil?
      email.add_error "is not in our system"
    end
  end
end
`,

    'src/operations/reset_password.cr': `class ResetPassword < User::SaveOperation
  # Change password validations in src/operations/mixins/password_validations.cr
  include PasswordValidations

  attribute password : String
  attribute password_confirmation : String

  before_save do
    Authentic.copy_and_encrypt password, to: encrypted_password
  end
end
`,

    'src/operations/save_product.cr': `class SaveProduct < Product::SaveOperation
  permit_columns name, description, price_cents, stock

  before_save do
    stock.value = 0 if stock.value.nil?

    validate_required name, price_cents
    validate_size_of name, max: 200
    validate_numeric price_cents, at_least: 0
    validate_numeric stock, at_least: 0
  end
end
`,

    'src/operations/sign_in_user.cr': `class SignInUser < Avram::Operation
  param_key :user
  # You can modify this in src/operations/mixins/user_from_email.cr
  include UserFromEmail

  attribute email : String
  attribute password : String

  # Run validations and yields the operation and the user if valid
  def run
    user = user_from_email
    validate_credentials(user)

    if valid?
      user
    else
      nil
    end
  end

  # \`validate_credentials\` determines if a user can sign in.
  #
  # If desired, you can add additional checks in this method, e.g.
  #
  #    if user.locked?
  #      email.add_error "is locked out"
  #    end
  private def validate_credentials(user)
    if user
      unless Authentic.correct_password?(user, password.value.to_s)
        password.add_error "is wrong"
      end
    else
      # Usually ok to say that an email is not in the system:
      # https://kev.inburke.com/kevin/invalid-username-or-password-useless/
      # https://github.com/luckyframework/lucky_cli/issues/192
      email.add_error "is not in our system"
    end
  end
end
`,

    'src/operations/sign_up_user.cr': `class SignUpUser < User::SaveOperation
  param_key :user
  # Change password validations in src/operations/mixins/password_validations.cr
  include PasswordValidations

  permit_columns email
  attribute password : String
  attribute password_confirmation : String

  before_save do
    validate_uniqueness_of email
    Authentic.copy_and_encrypt(password, to: encrypted_password) if password.valid?
  end
end
`,

    'src/queries/product_query.cr': `class ProductQuery < Product::BaseQuery
end
`,

    'src/queries/user_query.cr': `class UserQuery < User::BaseQuery
end
`,

    'src/serializers/base_serializer.cr': `abstract class BaseSerializer
  include Lucky::Serializable

  def self.for_collection(collection : Enumerable, *args, **named_args) : Array(self)
    collection.map do |object|
      new(object, *args, **named_args)
    end
  end

  def self.for_collection(collection : Enumerable, pages : Lucky::Paginator, *args, **named_args)
    {
      "items" => collection.map do |object|
        new(object, *args, **named_args)
      end,
      "pagination" => PaginationSerializer.new(pages),
    }
  end
end
`,

    'src/serializers/error_serializer.cr': `# This is the default error serializer generated by Lucky.
# Feel free to customize it in any way you like.
class ErrorSerializer < BaseSerializer
  def initialize(
    @message : String,
    @details : String? = nil,
    @param : String? = nil, # so you can track which param (if any) caused the problem
  )
  end

  def render
    {message: @message, param: @param, details: @details}
  end
end
`,

    'src/serializers/pagination_serializer.cr': `# This is the default pagination serializer generated by Lucky.
# Feel free to customize it in any way you like.
class PaginationSerializer < BaseSerializer
  def initialize(@pages : Lucky::Paginator)
  end

  def render
    {
      next_page:     @pages.path_to_next,
      previous_page: @pages.path_to_previous,
      total_items:   @pages.item_count,
      total_pages:   @pages.total,
    }
  end
end
`,

    'src/serializers/product_serializer.cr': `class ProductSerializer < BaseSerializer
  def initialize(@product : Product)
  end

  def render
    {
      id:          @product.id,
      name:        @product.name,
      description: @product.description,
      price_cents: @product.price_cents,
      stock:       @product.stock,
      in_stock:    @product.in_stock?,
    }
  end
end
`,

    'src/serializers/user_serializer.cr': `class UserSerializer < BaseSerializer
  def initialize(@user : User)
  end

  def render
    {email: @user.email}
  end
end
`,

    'src/shards.cr': `# Load .env file before any other config or app code
require "lucky_env"
LuckyEnv.load?(".env")

# Require your shards here
require "lucky"
require "avram/lucky"
require "carbon"
require "authentic"
require "jwt"
`,

    'src/start_server.cr': `require "./app"

Habitat.raise_if_missing_settings!

if LuckyEnv.development?
  Avram::Migrator::Runner.new.ensure_migrated!
  Avram::SchemaEnforcer.ensure_correct_column_mappings!
end

app_server = AppServer.new
puts "Listening on http://#{app_server.host}:#{app_server.port}"

Signal::INT.trap do
  app_server.close
end

app_server.listen
`,

    'tasks/db/seed/required_data.cr': `require "../../../spec/support/factories/**"

# Add seeds here that are *required* for your app to work.
# For example, you might need at least one admin user or you might need at least
# one category for your blog posts for the app to work.
#
# Use \`Db::Seed::SampleData\` if your only want to add sample data helpful for
# development.
class Db::Seed::RequiredData < LuckyTask::Task
  summary "Add database records required for the app to work"

  def call
    # Using a Avram::Factory:
    #
    # Use the defaults, but override just the email
    # UserFactory.create &.email("me@example.com")

    # Using a SaveOperation:
    #
    # SaveUser.create!(email: "me@example.com", name: "Jane")
    #
    # You likely want to be able to run this file more than once. To do that,
    # only create the record if it doesn't exist yet:
    #
    # unless UserQuery.new.email("me@example.com").first?
    #  SaveUser.create!(email: "me@example.com", name: "Jane")
    # end
    puts "Done adding required data"
  end
end
`,

    'tasks/db/seed/sample_data.cr': `require "../../../spec/support/factories/**"

# Add sample data helpful for development, e.g. (fake users, blog posts, etc.)
#
# Use \`Db::Seed::RequiredData\` if you need to create data *required* for your
# app to work.
class Db::Seed::SampleData < LuckyTask::Task
  summary "Add sample database records helpful for development"

  def call
    # Using an Avram::Factory:
    #
    # Use the defaults, but override just the email
    # UserFactory.create &.email("me@example.com")

    # Using a SaveOperation:
    # \`\`\`
    # SignUpUser.create!(email: "me@example.com", password: "test123", password_confirmation: "test123")
    # \`\`\`
    #
    # You likely want to be able to run this file more than once. To do that,
    # only create the record if it doesn't exist yet:
    # \`\`\`
    # if UserQuery.new.email("me@example.com").none?
    #   SignUpUser.create!(email: "me@example.com", password: "test123", password_confirmation: "test123")
    # end
    # \`\`\`
    puts "Done adding sample data"
  end
end
`,

    'tasks.cr': `# This file loads your app and all your tasks when running 'lucky'
#
# Run 'lucky --help' to see all available tasks.
#
# Learn to create your own tasks:
# https://luckyframework.org/guides/command-line-tasks/custom-tasks

# See \`LuckyEnv#task?\`
ENV["LUCKY_TASK"] = "true"

# Load Lucky and the app (actions, models, etc.)
require "./src/app"
require "lucky_task"

# You can add your own tasks here in the ./tasks folder
require "./tasks/**"

# Load migrations
require "./db/migrations/**"

# Load Lucky tasks (dev, routes, etc.)
require "lucky/tasks/**"
require "avram/lucky/tasks"

LuckyTask::Runner.run
`,
  }
};
