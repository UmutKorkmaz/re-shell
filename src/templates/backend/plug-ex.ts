import { BackendTemplate } from '../types';

export const plugExTemplate: BackendTemplate = {
  id: 'plug-ex',
  name: 'plug-ex',
  displayName: 'Plug (Elixir)',
  description: 'Composable web application library for Elixir with connection adapters and middleware',
  language: 'elixir',
  framework: 'plug',
  version: '1.0.0',
  tags: ['elixir', 'plug', 'composable', 'middleware', 'router', 'cowboy'],
  port: 4000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'middleware'],

  files: {
    // Mix configuration
    'mix.exs': `defmodule {{projectNamePascal}}.MixProject do
  use Mix.Project

  def project do
    [
      app: :{{projectNameSnake}},
      version: "0.1.0",
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {{ {{projectNamePascal}}.Application, [] }
    ]
  end

  defp deps do
    [
      {:plug, "~> 1.14"},
      {:plug_cowboy, "~> 2.6"},
      {:jason, "~> 1.4"},
      {:guardian, "~> 2.3"},
      {:comeonin, "~> 5.4"},
      {:pbkdf2_elixir, "~> 2.0"}
    ]
  end
end
`,

    // Application
    'lib/{{projectNameSnake}}_application.ex': `defmodule {{projectNamePascal}}.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {{projectNamePascal}}.Repo
    ]

    opts = [strategy: :one_for_one, name: {{projectNamePascal}}.Supervisor]
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
      version: "1.0.0"
    }))
  end

  post "/api/v1/auth/register" do
    {:ok, body, conn} = Plug.Conn.read_body(conn)

    case Jason.decode(body) do
      {:ok, %{"email" => email, "password" => password, "name" => name}} ->
        case {{projectNamePascal}}.Auth.register(email, password, name) do
          {:ok, user} ->
            token = {{projectNamePascal}}.Auth.generate_token(user)

            conn
            |> put_resp_content_type("application/json")
            |> send_resp(201, Jason.encode!(%{
              token: token,
              user: %{
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
              }
            }))

          {:error, :exists} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(409, Jason.encode!(%{error: "Email already registered"}))
        end

      _error ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(400, Jason.encode!(%{error: "Invalid request"}))
    end
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
              user: %{
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
              }
            }))

          {:error, :unauthorized} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(401, Jason.encode!(%{error: "Invalid credentials"}))
        end

      _error ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(400, Jason.encode!(%{error: "Invalid request"}))
    end
  end

  get "/api/v1/products" do
    products = {{projectNamePascal}}.Products.list()

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(%{
      products: products,
      count: length(products)
    }))
  end

  get "/api/v1/products/:id" do
    id = String.to_integer(conn.params["id"])

    case {{projectNamePascal}}.Products.get(id) do
      {:ok, product} ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(200, Jason.encode!(%{product: product}))

      {:error, :not_found} ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(404, Jason.encode!(%{error: "Product not found"}))
    end
  end

  post "/api/v1/products" do
    {:ok, body, conn} = Plug.Conn.read_body(conn)

    case Jason.decode(body) do
      {:ok, params} ->
        case {{projectNamePascal}}.Products.create(params) do
          {:ok, product} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(201, Jason.encode!(%{product: product}))

          {:error, _changeset} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(422, Jason.encode!(%{error: "Failed to create product"}))
        end

      _error ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(400, Jason.encode!(%{error: "Invalid request"}))
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
    Agent.start_link(fn -> init() end, name: __MODULE__)
  end

  defp init do
    IO.puts("📦 Database initialized")
    IO.puts("👤 Default admin: admin@example.com / admin123")

    %{
      users: %{
        1 => %{
          id: 1,
          email: "admin@example.com",
          password: Pbkdf2.hash_pwd_salt("admin123"),
          name: "Admin User",
          role: "admin"
        }
      },
      products: %{
        1 => %{
          id: 1,
          name: "Sample Product 1",
          description: "This is a sample product",
          price: 29.99,
          stock: 100
        },
        2 => %{
          id: 2,
          name: "Sample Product 2",
          description: "Another sample product",
          price: 49.99,
          stock: 50
        }
      },
      user_id: 2,
      product_id: 3
    }
  end

  def get_state do
    Agent.get(__MODULE__, & &1)
  end

  def update_state(state) do
    Agent.update(__MODULE__, fn _ -> state end)
  end
end
`,

    // Auth
    'lib/{{projectNameSnake}}/auth.ex': `defmodule {{projectNamePascal}}.Auth do
  alias {{projectNamePascal}}.Repo

  def register(email, password, name) do
    state = Repo.get_state()

    if Enum.any?(state.users, fn {_, user} -> user.email == email end) do
      {:error, :exists}
    else
      user_id = state.user_id
      user = %{
        id: user_id,
        email: email,
        password: Pbkdf2.hash_pwd_salt(password),
        name: name,
        role: "user"
      }

      new_state = put_in(state.users[user_id], user)
      new_state = %{new_state | user_id: user_id + 1}
      Repo.update_state(new_state)

      {:ok, user}
    end
  end

  def login(email, password) do
    state = Repo.get_state()

    user = Enum.find(state.users, fn {_, user} ->
      user.email == email && Pbkdf2.verify_pass(password, user.password)
    end)

    case user do
      {_, user} -> {:ok, user}
      nil -> {:error, :unauthorized}
    end
  end

  def generate_token(user) do
    # In production, use Guardian
    "jwt-token-for-#{user.id}"
  end
end
`,

    // Products
    'lib/{{projectNameSnake}}/products.ex': `defmodule {{projectNamePascal}}.Products do
  alias {{projectNamePascal}}.Repo

  def list do
    state = Repo.get_state()
    Map.values(state.products)
  end

  def get(id) do
    state = Repo.get_state()

    case Map.get(state.products, id) do
      nil -> {:error, :not_found}
      product -> {:ok, product}
    end
  end

  def create(params) do
    state = Repo.get_state()
    product_id = state.product_id

    product = %{
      id: product_id,
      name: params["name"],
      description: params["description"],
      price: params["price"],
      stock: params["stock"]
    }

    new_state = put_in(state.products[product_id], product)
    new_state = %{new_state | product_id: product_id + 1}
    Repo.update_state(new_state)

    {:ok, product}
  end

  def update(id, params) do
    state = Repo.get_state()

    case Map.get(state.products, id) do
      nil ->
        {:error, :not_found}

      product ->
        updated = %{
          product |
          name: Map.get(params, "name", product.name),
          description: Map.get(params, "description", product.description),
          price: Map.get(params, "price", product.price),
          stock: Map.get(params, "stock", product.stock)
        }

        new_state = put_in(state.products[id], updated)
        Repo.update_state(new_state)

        {:ok, updated}
    end
  end

  def delete(id) do
    state = Repo.get_state()

    case Map.get(state.products, id) do
      nil -> {:error, :not_found}
      _product ->
        new_state = %{state | products: Map.delete(state.products, id)}
        Repo.update_state(new_state)
        :ok
    end
  end
end
`,

    // Endpoint
    'lib/{{projectNameSnake}}_endpoint.ex': `defmodule {{projectNamePascal}}.Endpoint do
  use Plug.Router

  plug Plug.Logger
  plug Plug.Static,
    at: "/",
    from: :{{projectNameSnake}}
  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  forward "/api", to: {{projectNamePascal}}.Router

  match _ do
    send_resp(conn, 404, "Not found")
  end
end
`,

    // Server
    'lib/{{projectNameSnake}}_server.ex': `defmodule {{projectNamePascal}}.Server do
  use Plug.Router

  def start do
    IO.puts("🚀 Server running at http://localhost:4000")
    IO.puts("📚 API docs: http://localhost:4000/api/v1/health")

    Plug.Cowboy.http(
      {{projectNamePascal}}.Endpoint,
      [],
      port: 4000
    )
  end
end
`,

    // Config
    'config/config.exs': `import Config

config :{{projectNameSnake}},
  ecto_repos: [{{projectNamePascal}}.Repo]

import_config "#{config_env()}.exs"
`,

    'config/dev.exs': `import Config

config :{{projectNameSnake}},
  jwt_secret: "change-this-secret-in-production"

config :logger,
  level: :debug
`,

    'config/prod.exs': `import Config

config :logger,
  level: :info
`,

    // Dockerfile
    'Dockerfile': `FROM elixir:1.15-alpine
WORKDIR /app
COPY mix.exs mix.lock ./
RUN mix local.hex --force && mix local.rebar --force
RUN mix deps.get --only prod
COPY ./
RUN mix release
EXPOSE 4000
CMD ["_build/prod/rel/{{projectNameSnake}}/bin/{{projectNameSnake}}", "start"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "4000:4000"
    restart: unless-stopped
`,

    // Tests
    'test/{{projectNameSnake}}_test.exs': `defmodule {{projectNamePascal}}Test do
  use ExUnit.Case
  doctest {{projectNamePascal}}

  test "greets the world" do
    assert {{projectNamePascal}}.hello() == :world
  end
end
`,

    'test/test_helper.exs': `ExUnit.start()
`,

    // README
    'README.md': `# {{projectName}}

Composable REST API built with Plug for Elixir.

## Features

- **Plug**: Composable web application library
- **Cowboy**: HTTP server
- **Guardian**: JWT authentication
- **Jason**: JSON encoding/decoding
- **Comeonin**: Password hashing

## Requirements

- Elixir 1.15+
- Erlang/OTP 26+

## Quick Start

\`\`\`bash
mix deps.get
iex -S mix
{{projectNamePascal}}.Server.start
\`\`\`

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## License

MIT
`
  }
};
