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
  dependencies: {
    'plug': '~> 1.16',
    'plug_cowboy': '~> 2.7',
    'plug_crypto': '~> 2.0',
    'jason': '~> 1.4',
    'pbkdf2_elixir': '~> 2.2',
    'absinthe': '~> 1.7',
    'absinthe_plug': '~> 1.5'
  },
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'middleware', 'graphql'],

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
      mod: {{{projectNamePascal}}.Application, []}
    ]
  end

  defp deps do
    [
      {:plug, "~> 1.16"},
      {:plug_cowboy, "~> 2.7"},
      {:plug_crypto, "~> 2.0"},
      {:jason, "~> 1.4"},
      {:pbkdf2_elixir, "~> 2.2"},
      {:absinthe, "~> 1.7"},
      {:absinthe_plug, "~> 1.5"}
    ]
  end
end
`,

    '.formatter.exs': `[
  inputs: ["{mix,.formatter}.exs", "{config,lib,test}/**/*.{ex,exs}"]
]
`,

    '.gitignore': `/_build/
/deps/
/doc/
erl_crash.dump
*.ez
.elixir_ls/
`,

    // Application: the supervision tree starts the data store and the HTTP server
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

    Logger.info("{{projectName}} listening on http://localhost:#{port}")

    opts = [strategy: :one_for_one, name: {{projectNamePascal}}.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
`,

    // CORS plug (answers pre-flight requests itself)
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
      |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
      |> put_resp_header("access-control-allow-headers", "content-type, authorization")

    if conn.method == "OPTIONS" do
      conn |> send_resp(204, "") |> halt()
    else
      conn
    end
  end
end
`,

    // Router: REST API + GraphQL endpoint
    'lib/{{projectNameSnake}}/router.ex': `defmodule {{projectNamePascal}}.Router do
  use Plug.Router

  alias {{projectNamePascal}}.{Auth, Products}

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
      version: "1.0.0"
    })
  end

  post "/api/v1/auth/register" do
    case conn.body_params do
      %{"email" => email, "password" => password, "name" => name}
      when is_binary(email) and is_binary(password) and is_binary(name) ->
        case Auth.register(email, password, name) do
          {:ok, user} ->
            json(conn, 201, %{token: Auth.generate_token(user), user: Auth.public_user(user)})

          {:error, :exists} ->
            json(conn, 409, %{error: "Email already registered"})

          {:error, :invalid} ->
            json(conn, 422, %{error: "Email, name and a password of at least 8 characters are required"})
        end

      _ ->
        json(conn, 400, %{error: "Invalid request"})
    end
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

  get "/api/v1/products" do
    products = Products.list()
    json(conn, 200, %{products: products, count: length(products)})
  end

  get "/api/v1/products/:id" do
    with {:ok, id} <- parse_id(id),
         {:ok, product} <- Products.get(id) do
      json(conn, 200, %{product: product})
    else
      _ -> json(conn, 404, %{error: "Product not found"})
    end
  end

  post "/api/v1/products" do
    with {:ok, _user} <- authenticate(conn) do
      case Products.create(conn.body_params) do
        {:ok, product} -> json(conn, 201, %{product: product})
        {:error, :invalid} -> json(conn, 422, %{error: "Failed to create product"})
      end
    else
      :error -> json(conn, 401, %{error: "Authentication required"})
    end
  end

  put "/api/v1/products/:id" do
    with {:ok, _user} <- authenticate(conn) do
      with {:ok, id} <- parse_id(id),
           {:ok, product} <- Products.update(id, conn.body_params) do
        json(conn, 200, %{product: product})
      else
        {:error, :invalid} -> json(conn, 422, %{error: "Failed to update product"})
        _ -> json(conn, 404, %{error: "Product not found"})
      end
    else
      :error -> json(conn, 401, %{error: "Authentication required"})
    end
  end

  delete "/api/v1/products/:id" do
    with {:ok, _user} <- authenticate(conn) do
      with {:ok, id} <- parse_id(id),
           :ok <- Products.delete(id) do
        send_resp(conn, 204, "")
      else
        _ -> json(conn, 404, %{error: "Product not found"})
      end
    else
      :error -> json(conn, 401, %{error: "Authentication required"})
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

  defp parse_id(id) do
    case Integer.parse(id) do
      {int, ""} -> {:ok, int}
      _ -> :error
    end
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

    // In-memory data store (an Agent). Swap for Ecto + a database in a real app.
    'lib/{{projectNameSnake}}/repo.ex': `defmodule {{projectNamePascal}}.Repo do
  @moduledoc """
  In-memory data store backed by an Agent. All reads and writes go through the
  agent process, so \`transaction/1\` is atomic.
  """

  use Agent

  def start_link(_opts) do
    Agent.start_link(&initial_state/0, name: __MODULE__)
  end

  @doc "Returns a snapshot of the whole state."
  def get_state, do: Agent.get(__MODULE__, & &1)

  @doc """
  Runs \`fun\` against the state atomically. \`fun\` must return
  \`{result, new_state}\`.
  """
  def transaction(fun) when is_function(fun, 1) do
    Agent.get_and_update(__MODULE__, fun)
  end

  defp initial_state do
    %{
      users: seed_users(),
      products: %{
        1 => %{id: 1, name: "Sample Product 1", description: "This is a sample product", price: 29.99, stock: 100},
        2 => %{id: 2, name: "Sample Product 2", description: "Another sample product", price: 49.99, stock: 50}
      },
      user_id: 2,
      product_id: 3
    }
  end

  # The demo admin account only exists in development and test (see config/).
  defp seed_users do
    case Application.get_env(:{{projectNameSnake}}, :seed_admin) do
      %{email: email, password: password} ->
        %{
          1 => %{
            id: 1,
            email: email,
            password_hash: Pbkdf2.hash_pwd_salt(password),
            name: "Admin User",
            role: "admin"
          }
        }

      _ ->
        %{}
    end
  end
end
`,

    // Auth
    'lib/{{projectNameSnake}}/auth.ex': `defmodule {{projectNamePascal}}.Auth do
  @moduledoc "User registration, login and signed bearer tokens."

  alias {{projectNamePascal}}.Repo

  @token_salt "user auth"
  # Tokens are valid for one day.
  @token_max_age 86_400

  def register(email, password, name) do
    if valid_registration?(email, password, name) do
      # Hash outside the agent so the store is not blocked while PBKDF2 runs.
      password_hash = Pbkdf2.hash_pwd_salt(password)

      Repo.transaction(fn state ->
        if Enum.any?(state.users, fn {_, user} -> user.email == email end) do
          {{:error, :exists}, state}
        else
          user = %{
            id: state.user_id,
            email: email,
            password_hash: password_hash,
            name: name,
            role: "user"
          }

          {{:ok, user}, %{state | users: Map.put(state.users, user.id, user), user_id: state.user_id + 1}}
        end
      end)
    else
      {:error, :invalid}
    end
  end

  def login(email, password) do
    user =
      Repo.get_state().users
      |> Map.values()
      |> Enum.find(&(&1.email == email))

    cond do
      user && Pbkdf2.verify_pass(password, user.password_hash) ->
        {:ok, user}

      user ->
        {:error, :unauthorized}

      true ->
        # Burn the same time as a real check so unknown emails are not detectable.
        Pbkdf2.no_user_verify()
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

  @doc "The user without its password hash, safe to return from the API."
  def public_user(user), do: Map.take(user, [:id, :email, :name, :role])

  defp valid_registration?(email, password, name) do
    String.contains?(email, "@") and String.length(password) >= 8 and String.trim(name) != ""
  end

  defp secret_key_base do
    Application.fetch_env!(:{{projectNameSnake}}, :secret_key_base)
  end
end
`,

    // Products
    'lib/{{projectNameSnake}}/products.ex': `defmodule {{projectNamePascal}}.Products do
  @moduledoc "Product catalogue stored in the in-memory repo."

  alias {{projectNamePascal}}.Repo

  def list do
    Repo.get_state().products |> Map.values() |> Enum.sort_by(& &1.id)
  end

  def get(id) do
    case Map.get(Repo.get_state().products, id) do
      nil -> {:error, :not_found}
      product -> {:ok, product}
    end
  end

  def create(params) when is_map(params) do
    with {:ok, attrs} <- cast(params, %{description: "", stock: 0}) do
      Repo.transaction(fn state ->
        product = Map.put(attrs, :id, state.product_id)

        {{:ok, product},
         %{state | products: Map.put(state.products, product.id, product), product_id: state.product_id + 1}}
      end)
    end
  end

  def update(id, params) when is_map(params) do
    case get(id) do
      {:ok, product} ->
        with {:ok, attrs} <- cast(params, product) do
          Repo.transaction(fn state ->
            updated = Map.put(attrs, :id, id)
            {{:ok, updated}, %{state | products: Map.put(state.products, id, updated)}}
          end)
        end

      {:error, :not_found} = error ->
        error
    end
  end

  def delete(id) do
    Repo.transaction(fn state ->
      if Map.has_key?(state.products, id) do
        {:ok, %{state | products: Map.delete(state.products, id)}}
      else
        {{:error, :not_found}, state}
      end
    end)
  end

  # Validates the incoming JSON; missing fields fall back to \`defaults\`.
  defp cast(params, defaults) do
    name = Map.get(params, "name", Map.get(defaults, :name))
    description = Map.get(params, "description", Map.get(defaults, :description))
    price = Map.get(params, "price", Map.get(defaults, :price))
    stock = Map.get(params, "stock", Map.get(defaults, :stock))

    if is_binary(name) and String.trim(name) != "" and is_binary(description) and is_number(price) and
         price >= 0 and is_integer(stock) and stock >= 0 do
      {:ok, %{name: name, description: description, price: price * 1.0, stock: stock}}
    else
      {:error, :invalid}
    end
  end
end
`,

    // GraphQL schema (Absinthe)
    'lib/{{projectNameSnake}}/schema.ex': `defmodule {{projectNamePascal}}.Schema do
  use Absinthe.Schema

  object :product do
    field :id, non_null(:id)
    field :name, non_null(:string)
    field :description, :string
    field :price, non_null(:float)
    field :stock, non_null(:integer)
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

    field :products, non_null(list_of(non_null(:product))) do
      resolve fn _parent, _args, _resolution ->
        {:ok, {{projectNamePascal}}.Products.list()}
      end
    end
  end
end
`,

    // Config
    'config/config.exs': `import Config

config :{{projectNameSnake}},
  port: 4000,
  seed_admin: nil

import_config "#{config_env()}.exs"
`,

    'config/dev.exs': `import Config

config :{{projectNameSnake}},
  secret_key_base: "dev-only-secret-key-base-change-me-in-production-0123456789abcdef",
  seed_admin: %{email: "admin@example.com", password: "admin123"}

config :logger, level: :debug
`,

    'config/test.exs': `import Config

config :{{projectNameSnake}},
  port: 4002,
  secret_key_base: "test-only-secret-key-base-0123456789abcdef0123456789abcdef",
  seed_admin: %{email: "admin@example.com", password: "admin123"}

# Cheap password hashing keeps the test suite fast.
config :pbkdf2_elixir, rounds: 1

config :logger, level: :warning
`,

    'config/prod.exs': `import Config

config :logger, level: :info
`,

    'config/runtime.exs': `import Config

if config_env() != :test do
  config :{{projectNameSnake}}, port: String.to_integer(System.get_env("PORT", "4000"))
end

if config_env() == :prod do
  config :{{projectNameSnake}},
    secret_key_base:
      System.get_env("SECRET_KEY_BASE") ||
        raise("environment variable SECRET_KEY_BASE is missing (generate one with: openssl rand -base64 48)")
end
`,

    // Dockerfile
    'Dockerfile': `FROM elixir:1.17-alpine AS build
ENV MIX_ENV=prod
WORKDIR /app
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock* ./
COPY config config
RUN mix deps.get --only prod && mix deps.compile
COPY lib lib
RUN mix release

FROM alpine:3.20
RUN apk add --no-cache libstdc++ openssl ncurses-libs
WORKDIR /app
COPY --from=build /app/_build/prod/rel/{{projectNameSnake}} ./
ENV PORT=4000
EXPOSE 4000
CMD ["bin/{{projectNameSnake}}", "start"]
`,

    // Docker Compose
    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - SECRET_KEY_BASE=\${SECRET_KEY_BASE:?set SECRET_KEY_BASE}
    restart: unless-stopped
`,

    // Tests
    'test/test_helper.exs': `ExUnit.start()
`,

    'test/{{projectNameSnake}}_test.exs': `defmodule {{projectNamePascal}}.RouterTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias {{projectNamePascal}}.Router

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

  test "health check" do
    conn = request(:get, "/api/v1/health")
    assert conn.status == 200
    assert %{"status" => "healthy"} = decode(conn)
  end

  test "unknown routes return 404" do
    assert request(:get, "/nope").status == 404
  end

  test "lists the seeded products" do
    conn = request(:get, "/api/v1/products")
    assert conn.status == 200
    assert %{"count" => count} = decode(conn)
    assert count >= 2
  end

  test "register, login and create a product with the issued token" do
    email = "user-#{System.unique_integer([:positive])}@example.com"
    credentials = %{"email" => email, "password" => "s3cret-pass", "name" => "Test User"}

    conn = request(:post, "/api/v1/auth/register", credentials)
    assert conn.status == 201
    assert %{"token" => token, "user" => %{"email" => ^email}} = decode(conn)
    refute Map.has_key?(decode(conn)["user"], "password_hash")

    assert request(:post, "/api/v1/auth/register", credentials).status == 409
    assert request(:post, "/api/v1/auth/login", %{"email" => email, "password" => "wrong-pass"}).status == 401
    assert request(:post, "/api/v1/auth/login", Map.take(credentials, ["email", "password"])).status == 200

    assert request(:post, "/api/v1/products", %{"name" => "Widget", "price" => 9.5}).status == 401

    conn = request(:post, "/api/v1/products", %{"name" => "Widget", "price" => 9.5, "stock" => 3}, token)
    assert conn.status == 201
    assert %{"product" => %{"id" => id, "name" => "Widget"}} = decode(conn)

    assert request(:get, "/api/v1/products/#{id}").status == 200
    assert request(:put, "/api/v1/products/#{id}", %{"stock" => 7}, token).status == 200
    assert request(:delete, "/api/v1/products/#{id}", nil, token).status == 204
    assert request(:get, "/api/v1/products/#{id}").status == 404
  end

  test "rejects invalid products" do
    conn = request(:post, "/api/v1/auth/login", %{"email" => "admin@example.com", "password" => "admin123"})
    assert %{"token" => token} = decode(conn)
    assert request(:post, "/api/v1/products", %{"name" => "", "price" => -1}, token).status == 422
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

Composable REST + GraphQL API built with Plug for Elixir.

## Features

- **Plug.Router**: routing, request logging and JSON body parsing
- **Cowboy** (via \`plug_cowboy\`): HTTP server, supervised by the application
- **Signed bearer tokens**: issued by \`Plug.Crypto\` (expire after 24 hours)
- **Pbkdf2**: password hashing (\`pbkdf2_elixir\`)
- **CORS** plug and request validation
- **Absinthe**: GraphQL endpoint at \`/graphql\`
- **In-memory store**: an Agent; replace it with Ecto and a database for real data

## Requirements

- Elixir 1.15+
- Erlang/OTP 26+

## Quick Start

\`\`\`bash
mix deps.get
mix test
iex -S mix   # serves http://localhost:4000
\`\`\`

In development the demo admin \`admin@example.com\` / \`admin123\` is seeded; in
production set \`SECRET_KEY_BASE\` (and optionally \`PORT\`) and register users via the API.

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register (\`email\`, \`password\` of 8+ characters, \`name\`)
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get a product
- \`POST /api/v1/products\`, \`PUT /api/v1/products/:id\`, \`DELETE /api/v1/products/:id\` - Manage products (bearer token required)
- \`POST /graphql\` - GraphQL (\`hello\`, \`health\`, \`products\`)

## License

MIT
`
  }
};
