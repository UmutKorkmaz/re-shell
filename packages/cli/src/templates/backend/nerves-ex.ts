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
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'microservices'],

  files: {
    // Mix configuration
    'mix.exs': `defmodule {{projectNamePascal}}.MixProject do
  use Mix.Project

  def project do
    [
      app: :{{projectNameSnake}},
      version: "0.1.0",
      elixir: "~> 1.15",
      archives: [nerves_bootstrap: "~> 1.13"],
      start_permanent: Mix.env() == :prod,
      build_embedded: true,
      deps: deps(),
      releases: [{0, {0, :nerves}}]
    ]
  end

  def application do
    [
      mod: {{ {{projectNamePascal}}.Application, [] },
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  defp deps do
    [
      {:nerves, "~> 1.10", runtime: false},
      {:shoehorn, "~> 0.9"},
      {:ring_logger, "~> 0.11"},
      {:plug, "~> 1.14"},
      {:plug_cowboy, "~> 2.6"},
      {:jason, "~> 1.4"},
      {:nerves_runtime, "~> 0.13"},
      {:nerves_pack, "~> 0.7"}
    ]
  end
end
`,

    // Application
    'lib/{{projectNameSnake}}_application.ex': `defmodule {{projectNamePascal}}.Application do
  @moduledoc false

  use Application

  def start(_type, _args) do
    # Initialize database
    {{projectNamePascal}}.Repo.init()

    children = [
      {Plug.Cowboy, scheme: :http, plug: {{projectNamePascal}}.Router, options: [port: 4000]},
      {{projectNamePascal}}.Repo
    ]

    opts = [strategy: :one_for_one, name: {{projectNamePascal}}.Supervisor]

    Logger.info("🚀 {{projectName}} starting on port 4000")
    Logger.info("📚 API: http://localhost:4000/api/v1/health")

    Supervisor.start_link(children, opts)
  end
end
`,

    // Router
    'lib/{{projectNameSnake}}_router.ex': `defmodule {{projectNamePascal}}.Router do
  use Plug.Router

  plug Plug.Logger
  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  get "/api/v1/health" do
    send_resp(conn, 200, Jason.encode!(%{
      status: "healthy",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
      version: "1.0.0",
      platform: "Nerves"
    }))
  end

  post "/api/v1/auth/login" do
    {:ok, body, conn} = Plug.Conn.read_body(conn)

    case Jason.decode(body) do
      {:ok, %{"email" => email, "password" => password}} ->
        case {{projectNamePascal}}.Auth.login(email, password) do
          {:ok, user} ->
            token = {{projectNamePascal}}.Auth.generate_token(user)

            conn
            |> put_resp_content_type("application/json")
            |> send_resp(200, Jason.encode!(%{
              token: token,
              user: %{id: user.id, email: user.email, name: user.name, role: user.role}
            }))

          {:error, :unauthorized} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(401, Jason.encode!(%{error: "Invalid credentials"}))
        end

      _error ->
        send_resp(conn, 400, Jason.encode!(%{error: "Invalid request"}))
    end
  end

  get "/api/v1/sensors" do
    sensors = {{projectNamePascal}}.Sensors.list()

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(%{sensors: sensors}))
  end

  post "/api/v1/sensors/:id/read" do
    sensor_id = conn.params["id"]

    case {{projectNamePascal}}.Sensors.read(sensor_id) do
      {:ok, reading} ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(200, Jason.encode!(%{reading: reading}))

      {:error, :not_found} ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(404, Jason.encode!(%{error: "Sensor not found"}))
    end
  end

  match _ do
    send_resp(conn, 404, Jason.encode!(%{error: "Not found"}))
  end
end
`,

    // Repo
    'lib/{{projectNameSnake}}/repo.ex': `defmodule {{projectNamePascal}}.Repo do
  use Agent

  def start_link(_opts) do
    Agent.start_link(fn -> %{} end, name: __MODULE__)
  end

  def init do
    Logger.info("📦 Database initialized")

    state = %{
      users: %{
        1 => %{
          id: 1,
          email: "admin@nerves.local",
          password: :crypto.hash(:sha256, "admin123") |> Base.encode16(),
          name: "Admin User",
          role: "admin"
        }
      },
      sensors: %{
        "temperature" => %{id: "temperature", name: "Temperature Sensor", type: "analog", value: 20.5},
        "humidity" => %{id: "humidity", name: "Humidity Sensor", type: "digital", value: 45.0}
      }
    }

    Agent.update(__MODULE__, fn _ -> state end)

    Logger.info("👤 Default admin: admin@nerves.local / admin123")
  end

  def get(key) do
    Agent.get(__MODULE__, fn state -> Map.get(state, key) end)
  end

  def update(key, value) do
    Agent.update(__MODULE__, fn state -> Map.put(state, key, value) end)
  end
end
`,

    // Auth
    'lib/{{projectNameSnake}}/auth.ex': `defmodule {{projectNamePascal}}.Auth do
  alias {{projectNamePascal}}.Repo

  def login(email, password) do
    users = Repo.get(:users)

    user = Enum.find(users, fn {_, u} ->
      u.email == email && u.password == :crypto.hash(:sha256, password) |> Base.encode16()
    end)

    case user do
      {_, user} -> {:ok, user}
      nil -> {:error, :unauthorized}
    end
  end

  def generate_token(user) do
    "nerves-jwt-#{user.id}"
  end
end
`,

    // Sensors
    'lib/{{projectNameSnake}}/sensors.ex': `defmodule {{projectNamePascal}}.Sensors do
  alias {{projectNamePascal}}.Repo

  def list do
    sensors = Repo.get(:sensors)
    Map.values(sensors)
  end

  def read(sensor_id) do
    sensors = Repo.get(:sensors)

    case Map.get(sensors, sensor_id) do
      nil -> {:error, :not_found}
      sensor -> {:ok, read_sensor_value(sensor)}
    end
  end

  defp read_sensor_value(sensor) do
    # Simulate sensor reading
    value =
      case sensor.type do
        "analog" ->
          # Simulate analog sensor with random fluctuation
          base = sensor.value || 0
          base + (:rand.uniform() * 2 - 1)

        "digital" ->
          # Simulate digital sensor
          base = sensor.value || 0
          base + :rand.uniform() - 0.5

        _ ->
          0
      end

    %{sensor | value: Float.round(value, 2)}
  end
end
`,

    // Firmware configuration
    'config/target.exs': `import Config

config :shoehorn,
  init: [:nerves_runtime, :nerves_pack],
  overlay: [
    ["/usr/share/iex/lib/iex.ex", "/usr/lib/iex/lib/iex.ex"]
  ]

config :nerves_runtime,
  kernel: [init: ["/usr/lib/iex/bin/iex", "--", "/usr/lib/iex/bin/iex", "--", "erl.init"]]

config :logger, backends: [RingLogger]
`,

    'config/config.exs': `import Config

config :logger, level: :debug

config :{{projectNameSnake}},
  target: Mix.Project.config()[:target]

import_config "#{config_target()}.exs"
`,

    'config/rpi0.exs': `import Config

config :{{projectNameSnake}}, :leds, [:green]

import_config "target.exs"
`,

    // Firmware build configuration
    'rel/config.exs': `import Config

config :{{projectNameSnake}},
  devs: [
    {"rpi0", "bbb"}
  ]
`,

    'rel/vm.args.eex': `## Name of the node
-name {{projectNameSnake}}@127.0.0.1

## Cookie for distributed erlang
-setcookie {{projectNameSnake}}
`,

    // Dockerfile
    'Dockerfile': `FROM elixir:1.15-alpine
WORKDIR /app
COPY mix.exs mix.lock ./
RUN mix local.hex --force && mix local.rebar --force
RUN mix deps.get
COPY ./
RUN mix firmware
EXPOSE 4000
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "4000:4000"
    privileged: true
    restart: unless-stopped
`,

    // Tests
    'test/{{projectNameSnake}}_test.exs': `defmodule {{projectNamePascal}}Test do
  use ExUnit.Case

  test "auth login" do
    assert {{projectNamePascal}}.Auth.login("admin@nerves.local", "admin123") != {:error, :unauthorized}
  end
end
`,

    'test/test_helper.exs': `ExUnit.start()
`,

    // README
    'README.md': `# {{projectName}}

Nerves firmware for embedded devices with REST API.

## Features

- **Nerves**: Embedded Elixir framework
- **Shoehorn**: Minimal init system
- **Plug**: HTTP server on device
- **RingLogger**: System logging
- **Sensors**: Hardware sensor integration
- **Firmware**: OTA updates

## Requirements

- Nerves system (Raspberry Pi, BeagleBone, etc.)
- Elixir 1.15+
- Erlang/OTP 26+

## Quick Start

\`\`\`bash
# Install Nerves
mix local.hex --force
mix archive.install hex nerves_bootstrap --force

# Setup environment
export MIX_TARGET=rpi0
mix deps.get

# Build firmware
mix firmware

# Burn to SD card
mix firmware.burn
\`\`\`

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/sensors\` - List sensors
- \`POST /api/v1/sensors/:id/read\` - Read sensor

## License

MIT
`
  }
};
