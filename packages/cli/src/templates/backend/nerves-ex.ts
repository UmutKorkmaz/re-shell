import { BackendTemplate } from '../types';

export const nervesExTemplate: BackendTemplate = {
  id: 'nerves-ex',
  name: 'nerves-ex',
  displayName: 'Nerves (Elixir)',
  description: 'Platform for building embedded and IoT software with Elixir',
  language: 'elixir',
  framework: 'nerves',
  version: '1.0.0',
  tags: ['elixir', 'nerves', 'iot', 'microservices', 'firmware', 'hardware'],
  port: 4000,
  dependencies: {
    'nerves': '~> 1.11',
    'shoehorn': '~> 0.9',
    'ring_logger': '~> 0.11',
    'nerves_runtime': '~> 0.13',
    'nerves_pack': '~> 0.7',
    'plug': '~> 1.16',
    'plug_cowboy': '~> 2.7',
    'plug_crypto': '~> 2.0',
    'jason': '~> 1.4',
    'absinthe': '~> 1.7',
    'absinthe_plug': '~> 1.5'
  },
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'microservices', 'graphql'],

  files: {
    // Mix configuration (a standard Nerves project: MIX_TARGET=host for development, a board target for firmware)
    'mix.exs': `defmodule {{projectNamePascal}}.MixProject do
  use Mix.Project

  @app :{{projectNameSnake}}
  @version "0.1.0"
  @all_targets [:rpi0, :rpi4]

  def project do
    [
      app: @app,
      version: @version,
      elixir: "~> 1.15",
      archives: [nerves_bootstrap: "~> 1.13"],
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      releases: [{@app, release()}],
      aliases: [loadconfig: [&bootstrap/1]]
    ]
  end

  # Starting nerves_bootstrap adds the required Nerves hooks to Mix
  defp bootstrap(args) do
    Application.start(:nerves_bootstrap)
    Mix.Task.run("loadconfig", args)
  end

  def application do
    [
      mod: {{{projectNamePascal}}.Application, []},
      extra_applications: [:logger, :runtime_tools, :crypto]
    ]
  end

  defp deps do
    [
      # Dependencies for all targets
      {:nerves, "~> 1.11", runtime: false},
      {:shoehorn, "~> 0.9"},
      {:ring_logger, "~> 0.11"},

      # Allows Nerves.Runtime to run on the host for development, testing and CI
      {:nerves_runtime, "~> 0.13"},

      # Dependencies for all targets except :host
      {:nerves_pack, "~> 0.7", targets: @all_targets},

      # Nerves systems (one per board)
      {:nerves_system_rpi0, "~> 2.1", runtime: false, targets: :rpi0},
      {:nerves_system_rpi4, "~> 2.1", runtime: false, targets: :rpi4},

      # HTTP API
      {:plug, "~> 1.16"},
      {:plug_cowboy, "~> 2.7"},
      {:plug_crypto, "~> 2.0"},
      {:jason, "~> 1.4"},
      {:absinthe, "~> 1.7"},
      {:absinthe_plug, "~> 1.5"}
    ]
  end

  def release do
    [
      overwrite: true,
      # Erlang distribution is not started automatically.
      # See https://hexdocs.pm/nerves_pack/readme.html#erlang-distribution
      cookie: "#{@app}_cookie",
      include_erts: &Nerves.Release.erts/0,
      steps: [&Nerves.Release.init/1, :assemble],
      strip_beams: Mix.env() == :prod or [keep: ["Docs"]]
    ]
  end
end
`,

    '.formatter.exs': `[
  inputs: ["*.{ex,exs}", "{config,lib,test}/**/*.{ex,exs}"]
]
`,

    '.gitignore': `/_build/
/deps/
/doc/
/.fetch
erl_crash.dump
*.ez
*.beam
/config/secrets.exs
.elixir_ls/
# Firmware images
/*.fw
/*.img
`,

    // Application: the HTTP API runs on the host and on the device
    'lib/{{projectNameSnake}}/application.ex': `defmodule {{projectNamePascal}}.Application do
  @moduledoc false

  use Application

  require Logger

  @impl true
  def start(_type, _args) do
    port = Application.get_env(:{{projectNameSnake}}, :port, 4000)

    children = [
      {{projectNamePascal}}.Repo,
      {Plug.Cowboy, scheme: :http, plug: {{projectNamePascal}}.Router, options: [port: port]}
    ]

    Logger.info("{{projectName}} listening on port #{port} (target: #{inspect(Application.get_env(:{{projectNameSnake}}, :target))})")

    opts = [strategy: :one_for_one, name: {{projectNamePascal}}.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
`,

    // CORS plug
    'lib/{{projectNameSnake}}/cors.ex': `defmodule {{projectNamePascal}}.CORS do
  @moduledoc """
  Minimal CORS plug. Adds the CORS headers to every response and answers
  pre-flight (OPTIONS) requests directly.
  """

  @behaviour Plug

  import Plug.Conn

  @impl true
  def init(opts), do: opts

  @impl true
  def call(conn, _opts) do
    conn =
      conn
      |> put_resp_header("access-control-allow-origin", "*")
      |> put_resp_header("access-control-allow-methods", "GET, POST, OPTIONS")
      |> put_resp_header("access-control-allow-headers", "content-type, authorization")

    if conn.method == "OPTIONS" do
      conn |> send_resp(204, "") |> halt()
    else
      conn
    end
  end
end
`,

    // Router
    'lib/{{projectNameSnake}}/router.ex': `defmodule {{projectNamePascal}}.Router do
  use Plug.Router

  alias {{projectNamePascal}}.{Auth, Sensors}

  plug Plug.Logger
  plug {{projectNamePascal}}.CORS
  plug :match

  plug Plug.Parsers,
    parsers: [:json],
    pass: ["*/*"],
    json_decoder: Jason

  plug :dispatch

  get "/api/v1/health" do
    json(conn, 200, %{
      status: "healthy",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
      version: "1.0.0",
      platform: "Nerves",
      target: inspect(Application.get_env(:{{projectNameSnake}}, :target))
    })
  end

  post "/api/v1/auth/login" do
    case conn.body_params do
      %{"email" => email, "password" => password} when is_binary(email) and is_binary(password) ->
        case Auth.login(email, password) do
          {:ok, user} ->
            json(conn, 200, %{token: Auth.generate_token(user), user: Auth.public_user(user)})

          {:error, :unauthorized} ->
            json(conn, 401, %{error: "Invalid credentials"})
        end

      _ ->
        json(conn, 400, %{error: "Invalid request"})
    end
  end

  get "/api/v1/sensors" do
    json(conn, 200, %{sensors: Sensors.list()})
  end

  # Taking a reading changes device state, so it needs a bearer token.
  post "/api/v1/sensors/:id/read" do
    case authenticate(conn) do
      {:ok, _user} ->
        case Sensors.read(id) do
          {:ok, reading} -> json(conn, 200, %{reading: reading})
          {:error, :not_found} -> json(conn, 404, %{error: "Sensor not found"})
        end

      :error ->
        json(conn, 401, %{error: "Authentication required"})
    end
  end

  forward "/graphql",
    to: Absinthe.Plug,
    init_opts: [schema: {{projectNamePascal}}.Schema]

  match _ do
    json(conn, 404, %{error: "Not found"})
  end

  defp json(conn, status, body) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, Jason.encode!(body))
  end

  defp authenticate(conn) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, user} <- Auth.verify_token(token) do
      {:ok, user}
    else
      _ -> :error
    end
  end
end
`,

    // GraphQL schema (Absinthe)
    'lib/{{projectNameSnake}}/schema.ex': `defmodule {{projectNamePascal}}.Schema do
  use Absinthe.Schema

  object :sensor do
    field :id, non_null(:id)
    field :name, non_null(:string)
    field :type, non_null(:string)
    field :value, non_null(:float)
  end

  query do
    field :hello, non_null(:string) do
      resolve fn _parent, _args, _resolution ->
        {:ok, "Hello, GraphQL!"}
      end
    end

    field :health, non_null(:string) do
      resolve fn _parent, _args, _resolution ->
        {:ok, "healthy"}
      end
    end

    field :sensors, non_null(list_of(non_null(:sensor))) do
      resolve fn _parent, _args, _resolution ->
        {:ok, {{projectNamePascal}}.Sensors.list()}
      end
    end
  end
end
`,

    // In-memory state (an Agent)
    'lib/{{projectNameSnake}}/repo.ex': `defmodule {{projectNamePascal}}.Repo do
  @moduledoc """
  In-memory device state (users and sensors) held by an Agent. Everything goes
  through \`transaction/1\`, so updates are atomic.
  """

  use Agent

  alias {{projectNamePascal}}.Auth

  def start_link(_opts) do
    Agent.start_link(&initial_state/0, name: __MODULE__)
  end

  def get_state, do: Agent.get(__MODULE__, & &1)

  @doc "Runs \`fun\` against the state; it must return \`{result, new_state}\`."
  def transaction(fun) when is_function(fun, 1) do
    Agent.get_and_update(__MODULE__, fun)
  end

  defp initial_state do
    %{
      users: seed_users(),
      sensors: %{
        "temperature" => %{id: "temperature", name: "Temperature Sensor", type: "analog", value: 20.5},
        "humidity" => %{id: "humidity", name: "Humidity Sensor", type: "digital", value: 45.0}
      }
    }
  end

  # The demo admin account only exists when config provides :seed_admin.
  defp seed_users do
    case Application.get_env(:{{projectNameSnake}}, :seed_admin) do
      %{email: email, password: password} ->
        %{1 => Auth.build_user(1, email, "Admin User", "admin", password)}

      _ ->
        %{}
    end
  end
end
`,

    // Auth
    'lib/{{projectNameSnake}}/auth.ex': `defmodule {{projectNamePascal}}.Auth do
  @moduledoc """
  Login and signed bearer tokens. Passwords are hashed with PBKDF2 from
  Erlang's :crypto, so the firmware needs no native password-hashing library.
  """

  alias {{projectNamePascal}}.Repo

  @token_salt "device auth"
  @token_max_age 86_400
  @iterations 10_000

  def build_user(id, email, name, role, password) do
    salt = :crypto.strong_rand_bytes(16)

    %{
      id: id,
      email: email,
      name: name,
      role: role,
      salt: salt,
      password_hash: hash_password(password, salt)
    }
  end

  def login(email, password) do
    user =
      Repo.get_state().users
      |> Map.values()
      |> Enum.find(&(&1.email == email))

    if user && Plug.Crypto.secure_compare(user.password_hash, hash_password(password, user.salt)) do
      {:ok, user}
    else
      {:error, :unauthorized}
    end
  end

  def generate_token(user) do
    Plug.Crypto.sign(secret_key_base(), @token_salt, user.id)
  end

  def verify_token(token) do
    with {:ok, user_id} <- Plug.Crypto.verify(secret_key_base(), @token_salt, token, max_age: @token_max_age),
         %{} = user <- Map.get(Repo.get_state().users, user_id) do
      {:ok, user}
    else
      _ -> :error
    end
  end

  def public_user(user), do: Map.take(user, [:id, :email, :name, :role])

  defp hash_password(password, salt) do
    :crypto.pbkdf2_hmac(:sha256, password, salt, @iterations, 32)
  end

  defp secret_key_base do
    Application.fetch_env!(:{{projectNameSnake}}, :secret_key_base)
  end
end
`,

    // Sensors
    'lib/{{projectNameSnake}}/sensors.ex': `defmodule {{projectNamePascal}}.Sensors do
  @moduledoc """
  Simulated sensors. Replace \`sample/1\` with real hardware access (for example
  with the Circuits.GPIO / Circuits.I2C libraries) when running on a device.
  """

  alias {{projectNamePascal}}.Repo

  def list do
    Repo.get_state().sensors |> Map.values() |> Enum.sort_by(& &1.id)
  end

  @doc "Takes a new reading, stores it and returns the updated sensor."
  def read(sensor_id) do
    Repo.transaction(fn state ->
      case Map.get(state.sensors, sensor_id) do
        nil ->
          {{:error, :not_found}, state}

        sensor ->
          updated = %{sensor | value: sample(sensor)}
          {{:ok, updated}, %{state | sensors: Map.put(state.sensors, sensor_id, updated)}}
      end
    end)
  end

  # Random walk around the previous value
  defp sample(%{value: value}) do
    Float.round(value + (:rand.uniform() - 0.5) * 2, 2)
  end
end
`,

    // Configuration
    'config/config.exs': `# This file is responsible for configuring your application and its
# dependencies. It is loaded for every MIX_TARGET (host and boards).
import Config

config :{{projectNameSnake}},
  target: Mix.target(),
  port: 4000,
  seed_admin: nil

# Customize non-Elixir parts of the firmware. See
# https://hexdocs.pm/nerves/advanced-configuration.html for details.
config :nerves, :firmware, rootfs_overlay: "rootfs_overlay"

# Set the SOURCE_DATE_EPOCH date for reproducible builds.
# See https://reproducible-builds.org/docs/source-date-epoch/ for more information
config :nerves, source_date_epoch: "1700000000"

if config_env() == :dev do
  config :{{projectNameSnake}},
    secret_key_base: "dev-only-secret-key-base-change-me-0123456789abcdef",
    seed_admin: %{email: "admin@nerves.local", password: "admin123"}
end

if config_env() == :test do
  config :{{projectNameSnake}},
    port: 4002,
    secret_key_base: "test-only-secret-key-base-0123456789abcdef0123456789abcdef",
    seed_admin: %{email: "admin@nerves.local", password: "admin123"}
end

if Mix.target() == :host do
  import_config "host.exs"
else
  import_config "target.exs"
end
`,

    'config/host.exs': `import Config

# Configuration that is only needed when running on the host (MIX_TARGET=host).
# The development secret and demo admin are set in config/config.exs.
`,

    'config/target.exs': `import Config

# Configuration that is only applied when building firmware for a board.

# Shoehorn starts these applications first and keeps the device usable if the
# application crashes. See https://hexdocs.pm/shoehorn/readme.html
config :shoehorn,
  init: [:nerves_runtime, :nerves_pack],
  app: Mix.Project.config()[:app]

# Use RingLogger as the logger backend and remove :console.
# See https://hexdocs.pm/ring_logger/readme.html
config :logger, backends: [RingLogger]

# Production firmware must set a real :secret_key_base; read it from
# config/secrets.exs (git-ignored) or provision it with your own mechanism.
if File.exists?(Path.join(__DIR__, "secrets.exs")), do: import_config("secrets.exs")
`,

    'rootfs_overlay/etc/{{projectNameSnake}}-release': `{{projectName}}
`,

    // Host simulation image (firmware itself is built with \`mix firmware\` for a board target)
    'Dockerfile': `# Runs the HTTP API with MIX_TARGET=host (no hardware). Firmware images are
# built with \`mix firmware\` for a board target, see README.md.
FROM elixir:1.17
ENV MIX_TARGET=host MIX_ENV=dev
WORKDIR /app
RUN mix local.hex --force && mix local.rebar --force && mix archive.install hex nerves_bootstrap --force
COPY . .
RUN mix deps.get && mix compile
EXPOSE 4000
CMD ["mix", "run", "--no-halt"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "4000:4000"
    restart: unless-stopped
`,

    // Tests (run on the host: MIX_TARGET=host mix test)
    'test/test_helper.exs': `ExUnit.start()
`,

    'test/{{projectNameSnake}}_test.exs': `defmodule {{projectNamePascal}}.RouterTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias {{projectNamePascal}}.{Auth, Router}

  @opts Router.init([])

  defp request(method, path, body \\\\ nil, token \\\\ nil) do
    conn =
      case body do
        nil -> conn(method, path)
        body -> conn(method, path, Jason.encode!(body)) |> put_req_header("content-type", "application/json")
      end

    conn = if token, do: put_req_header(conn, "authorization", "Bearer " <> token), else: conn
    Router.call(conn, @opts)
  end

  defp decode(conn), do: Jason.decode!(conn.resp_body)

  defp login_token do
    conn = request(:post, "/api/v1/auth/login", %{"email" => "admin@nerves.local", "password" => "admin123"})
    assert conn.status == 200
    decode(conn)["token"]
  end

  test "auth login" do
    assert {:ok, %{email: "admin@nerves.local"}} = Auth.login("admin@nerves.local", "admin123")
    assert {:error, :unauthorized} = Auth.login("admin@nerves.local", "wrong")
    assert {:error, :unauthorized} = Auth.login("nobody@nerves.local", "admin123")
  end

  test "health check" do
    conn = request(:get, "/api/v1/health")
    assert conn.status == 200
    assert %{"status" => "healthy", "platform" => "Nerves"} = decode(conn)
  end

  test "lists sensors" do
    conn = request(:get, "/api/v1/sensors")
    assert conn.status == 200
    assert %{"sensors" => [_ | _]} = decode(conn)
  end

  test "reading a sensor requires a token" do
    assert request(:post, "/api/v1/sensors/temperature/read").status == 401

    conn = request(:post, "/api/v1/sensors/temperature/read", nil, login_token())
    assert conn.status == 200
    assert %{"reading" => %{"id" => "temperature", "value" => value}} = decode(conn)
    assert is_float(value)

    assert request(:post, "/api/v1/sensors/missing/read", nil, login_token()).status == 404
  end

  test "rejects bad credentials" do
    assert request(:post, "/api/v1/auth/login", %{"email" => "admin@nerves.local", "password" => "nope"}).status == 401
  end

  test "graphql answers queries" do
    conn =
      conn(:post, "/graphql", Jason.encode!(%{"query" => "{ hello }"}))
      |> put_req_header("content-type", "application/json")
      |> Router.call(@opts)

    assert conn.status == 200
    assert %{"data" => %{"hello" => "Hello, GraphQL!"}} = decode(conn)
  end
end
`,

    // README
    'README.md': `# {{projectName}}

Nerves firmware for embedded devices with a REST + GraphQL API.

## Features

- **Nerves**: embedded Elixir framework (firmware for Raspberry Pi and other boards)
- **Shoehorn**: keeps the device reachable if the application crashes
- **Plug + Cowboy**: HTTP API running on the device
- **RingLogger**: in-memory logging on the device
- **Absinthe**: GraphQL endpoint at \`/graphql\`
- **Signed bearer tokens** for protected routes
- **Simulated sensors**: replace \`{{projectNamePascal}}.Sensors.sample/1\` with real hardware access

The project runs on your computer with \`MIX_TARGET=host\` (the default) and builds
firmware for the boards listed in \`mix.exs\` (\`:rpi0\`, \`:rpi4\`); add more targets by
adding their \`nerves_system_*\` dependency.

## Requirements

- Elixir 1.15+ and Erlang/OTP 26+
- The Nerves bootstrap archive and the host tools it needs, see the
  [Nerves installation guide](https://hexdocs.pm/nerves/installation.html)

## Quick Start (host)

\`\`\`bash
mix local.hex --force
mix archive.install hex nerves_bootstrap --force

mix deps.get
mix test
iex -S mix   # serves http://localhost:4000
\`\`\`

## Build firmware

\`\`\`bash
export MIX_TARGET=rpi0   # or rpi4
mix deps.get
mix firmware
mix burn     # write to an SD card (or: mix upload for over-the-network updates)
\`\`\`

Set a real \`:secret_key_base\` for firmware builds in \`config/secrets.exs\` (git-ignored)
and add \`:nerves_ssh\` / networking configuration for your device.

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/login\` - Login (the demo admin \`admin@nerves.local\` / \`admin123\` exists on the host in dev and test)
- \`GET /api/v1/sensors\` - List sensors
- \`POST /api/v1/sensors/:id/read\` - Take a reading (bearer token required)
- \`POST /graphql\` - GraphQL (\`hello\`, \`health\`, \`sensors\`)

## License

MIT
`
  }
};
