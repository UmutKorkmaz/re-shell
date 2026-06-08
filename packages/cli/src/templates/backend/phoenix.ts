import { BackendTemplate } from '../types';

export const phoenixTemplate: BackendTemplate = {
  id: 'phoenix',
  name: 'phoenix',
  displayName: 'Phoenix Framework',
  description: 'Productive Elixir web framework for reliable, fast applications',
  language: 'elixir',
  framework: 'phoenix',
  version: '1.7.10',
  tags: ['elixir', 'phoenix', 'functional', 'api', 'rest', 'realtime', 'fault-tolerant'],
  port: 4000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'channels'],

  files: {
    // Mix project file
    'mix.exs': `defmodule {{ProjectName}}.MixProject do
  use Mix.Project

  def project do
    [
      app: :{{projectName}},
      version: "0.1.0",
      elixir: "~> 1.15",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  def application do
    [
      mod: {{{ProjectName}}.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:phoenix, "~> 1.7.10"},
      {:phoenix_ecto, "~> 4.4"},
      {:ecto_sql, "~> 3.10"},
      {:postgrex, ">= 0.0.0"},
      {:phoenix_live_dashboard, "~> 0.8.2"},
      {:swoosh, "~> 1.3"},
      {:finch, "~> 0.13"},
      {:telemetry_metrics, "~> 0.6"},
      {:telemetry_poller, "~> 1.0"},
      {:gettext, "~> 0.20"},
      {:jason, "~> 1.2"},
      {:plug_cowboy, "~> 2.5"},
      {:cors_plug, "~> 3.0"},
      {:guardian, "~> 2.3"},
      {:bcrypt_elixir, "~> 3.0"},
      {:open_api_spex, "~> 3.18"},
      {:hammer, "~> 6.1"},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev], runtime: false},
      {:ex_doc, "~> 0.31", only: :dev, runtime: false}
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "ecto.setup"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"]
    ]
  end
end
`,

    // Application
    'lib/{{projectName}}/application.ex': `defmodule {{ProjectName}}.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {{ProjectName}}Web.Telemetry,
      {{ProjectName}}.Repo,
      {Phoenix.PubSub, name: {{ProjectName}}.PubSub},
      {Finch, name: {{ProjectName}}.Finch},
      {{ProjectName}}Web.Endpoint
    ]

    opts = [strategy: :one_for_one, name: {{ProjectName}}.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    {{ProjectName}}Web.Endpoint.config_change(changed, removed)
    :ok
  end
end
`,

    // Repo
    'lib/{{projectName}}/repo.ex': `defmodule {{ProjectName}}.Repo do
  use Ecto.Repo,
    otp_app: :{{projectName}},
    adapter: Ecto.Adapters.Postgres
end
`,

    // User schema
    'lib/{{projectName}}/accounts/user.ex': `defmodule {{ProjectName}}.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
    field :email, :string
    field :password, :string, virtual: true, redact: true
    field :hashed_password, :string, redact: true
    field :name, :string
    field :role, :string, default: "user"
    field :active, :boolean, default: true

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :role, :active])
    |> validate_required([:email, :name])
    |> validate_format(:email, ~r/^[^\\s]+@[^\\s]+$/, message: "must be a valid email")
    |> unique_constraint(:email)
  end

  @doc false
  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password, :name])
    |> validate_required([:email, :password, :name])
    |> validate_format(:email, ~r/^[^\\s]+@[^\\s]+$/, message: "must be a valid email")
    |> validate_length(:password, min: 6, message: "must be at least 6 characters")
    |> validate_length(:name, min: 2, message: "must be at least 2 characters")
    |> unique_constraint(:email)
    |> hash_password()
  end

  defp hash_password(changeset) do
    case changeset do
      %Ecto.Changeset{valid?: true, changes: %{password: password}} ->
        put_change(changeset, :hashed_password, Bcrypt.hash_pwd_salt(password))
      _ ->
        changeset
    end
  end

  def valid_password?(%__MODULE__{hashed_password: hashed_password}, password)
      when is_binary(hashed_password) and byte_size(password) > 0 do
    Bcrypt.verify_pass(password, hashed_password)
  end

  def valid_password?(_, _), do: Bcrypt.no_user_verify()
end
`,

    // Accounts context
    'lib/{{projectName}}/accounts.ex': `defmodule {{ProjectName}}.Accounts do
  @moduledoc """
  The Accounts context.
  """

  import Ecto.Query, warn: false
  alias {{ProjectName}}.Repo
  alias {{ProjectName}}.Accounts.User

  def list_users do
    Repo.all(User)
  end

  def get_user!(id), do: Repo.get!(User, id)

  def get_user(id), do: Repo.get(User, id)

  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end

  def create_user(attrs \\\\ %{}) do
    %User{}
    |> User.registration_changeset(attrs)
    |> Repo.insert()
  end

  def update_user(%User{} = user, attrs) do
    user
    |> User.changeset(attrs)
    |> Repo.update()
  end

  def delete_user(%User{} = user) do
    Repo.delete(user)
  end

  def authenticate_user(email, password) do
    user = get_user_by_email(email)

    cond do
      user && User.valid_password?(user, password) && user.active ->
        {:ok, user}
      user && !user.active ->
        {:error, :account_disabled}
      true ->
        Bcrypt.no_user_verify()
        {:error, :invalid_credentials}
    end
  end
end
`,

    // Product schema
    'lib/{{projectName}}/catalog/product.ex': `defmodule {{ProjectName}}.Catalog.Product do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "products" do
    field :name, :string
    field :description, :string
    field :price, :decimal
    field :stock, :integer, default: 0
    field :active, :boolean, default: true

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(product, attrs) do
    product
    |> cast(attrs, [:name, :description, :price, :stock, :active])
    |> validate_required([:name, :price])
    |> validate_length(:name, min: 1, max: 200)
    |> validate_number(:price, greater_than_or_equal_to: 0)
    |> validate_number(:stock, greater_than_or_equal_to: 0)
  end
end
`,

    // Catalog context
    'lib/{{projectName}}/catalog.ex': `defmodule {{ProjectName}}.Catalog do
  @moduledoc """
  The Catalog context.
  """

  import Ecto.Query, warn: false
  alias {{ProjectName}}.Repo
  alias {{ProjectName}}.Catalog.Product

  def list_products(params \\\\ %{}) do
    page = Map.get(params, "page", 1) |> to_integer(1)
    limit = Map.get(params, "limit", 10) |> to_integer(10)
    offset = (page - 1) * limit

    query = from p in Product, where: p.active == true

    total = Repo.aggregate(query, :count)
    products = query |> limit(^limit) |> offset(^offset) |> Repo.all()

    %{data: products, total: total, page: page, limit: limit}
  end

  defp to_integer(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> default
    end
  end
  defp to_integer(value, _default) when is_integer(value), do: value
  defp to_integer(_, default), do: default

  def get_product!(id), do: Repo.get!(Product, id)

  def get_product(id), do: Repo.get(Product, id)

  def create_product(attrs \\\\ %{}) do
    %Product{}
    |> Product.changeset(attrs)
    |> Repo.insert()
  end

  def update_product(%Product{} = product, attrs) do
    product
    |> Product.changeset(attrs)
    |> Repo.update()
  end

  def delete_product(%Product{} = product) do
    Repo.delete(product)
  end
end
`,

    // Guardian config
    'lib/{{projectName}}_web/auth/guardian.ex': `defmodule {{ProjectName}}Web.Auth.Guardian do
  use Guardian, otp_app: :{{projectName}}

  alias {{ProjectName}}.Accounts

  def subject_for_token(%{id: id}, _claims) do
    {:ok, to_string(id)}
  end

  def resource_from_claims(%{"sub" => id}) do
    case Accounts.get_user(id) do
      nil -> {:error, :resource_not_found}
      user -> {:ok, user}
    end
  end
end
`,

    // Auth pipeline
    'lib/{{projectName}}_web/auth/pipeline.ex': `defmodule {{ProjectName}}Web.Auth.Pipeline do
  use Guardian.Plug.Pipeline,
    otp_app: :{{projectName}},
    module: {{ProjectName}}Web.Auth.Guardian,
    error_handler: {{ProjectName}}Web.Auth.ErrorHandler

  plug Guardian.Plug.VerifyHeader, scheme: "Bearer"
  plug Guardian.Plug.EnsureAuthenticated
  plug Guardian.Plug.LoadResource
end
`,

    // Auth error handler
    'lib/{{projectName}}_web/auth/error_handler.ex': `defmodule {{ProjectName}}Web.Auth.ErrorHandler do
  import Plug.Conn
  import Phoenix.Controller

  @behaviour Guardian.Plug.ErrorHandler

  @impl Guardian.Plug.ErrorHandler
  def auth_error(conn, {type, _reason}, _opts) do
    message = case type do
      :unauthenticated -> "Authentication required"
      :invalid_token -> "Invalid or expired token"
      _ -> "Authentication error"
    end

    conn
    |> put_status(:unauthorized)
    |> json(%{error: message})
    |> halt()
  end
end
`,

    // Endpoint
    'lib/{{projectName}}_web/endpoint.ex': `defmodule {{ProjectName}}Web.Endpoint do
  use Phoenix.Endpoint, otp_app: :{{projectName}}

  @session_options [
    store: :cookie,
    key: "_{{projectName}}_key",
    signing_salt: "changeme",
    same_site: "Lax"
  ]

  socket "/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session_options]]

  plug Plug.Static,
    at: "/",
    from: :{{projectName}},
    gzip: false,
    only: {{ProjectName}}Web.static_paths()

  if code_reloading? do
    plug Phoenix.CodeReloader
    plug Phoenix.Ecto.CheckRepoStatus, otp_app: :{{projectName}}
  end

  plug Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options
  plug CORSPlug
  plug {{ProjectName}}Web.Router
end
`,

    // Router
    'lib/{{projectName}}_web/router.ex': `defmodule {{ProjectName}}Web.Router do
  use {{ProjectName}}Web, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug {{ProjectName}}Web.Plugs.RateLimit
  end

  pipeline :authenticated do
    plug {{ProjectName}}Web.Auth.Pipeline
  end

  # Health check
  scope "/", {{ProjectName}}Web do
    pipe_through :api

    get "/health", HealthController, :index
  end

  # API routes
  scope "/api/v1", {{ProjectName}}Web do
    pipe_through :api

    # Auth routes (public)
    scope "/auth" do
      post "/register", AuthController, :register
      post "/login", AuthController, :login
    end

    # Product routes (public read, authenticated write)
    get "/products", ProductController, :index
    get "/products/:id", ProductController, :show
  end

  # Authenticated API routes
  scope "/api/v1", {{ProjectName}}Web do
    pipe_through [:api, :authenticated]

    # User routes
    get "/users/me", UserController, :me
    put "/users/me", UserController, :update_me
    get "/users", UserController, :index
    get "/users/:id", UserController, :show
    delete "/users/:id", UserController, :delete

    # Product routes (admin)
    post "/products", ProductController, :create
    put "/products/:id", ProductController, :update
    delete "/products/:id", ProductController, :delete
  end

  # Live Dashboard (dev only)
  if Mix.env() in [:dev, :test] do
    import Phoenix.LiveDashboard.Router

    scope "/" do
      pipe_through [:fetch_session, :protect_from_forgery]
      live_dashboard "/dashboard", metrics: {{ProjectName}}Web.Telemetry
    end
  end
end
`,

    // Rate limit plug
    'lib/{{projectName}}_web/plugs/rate_limit.ex': `defmodule {{ProjectName}}Web.Plugs.RateLimit do
  import Plug.Conn
  import Phoenix.Controller

  def init(opts), do: opts

  def call(conn, _opts) do
    case check_rate_limit(conn) do
      {:ok, remaining} ->
        conn
        |> put_resp_header("x-ratelimit-limit", "100")
        |> put_resp_header("x-ratelimit-remaining", to_string(remaining))

      {:error, _count} ->
        conn
        |> put_status(:too_many_requests)
        |> json(%{error: "Rate limit exceeded"})
        |> halt()
    end
  end

  defp check_rate_limit(conn) do
    ip = get_ip(conn)
    bucket = "api_rate_limit:#{ip}"

    case Hammer.check_rate(bucket, 60_000, 100) do
      {:allow, count} -> {:ok, 100 - count}
      {:deny, count} -> {:error, count}
    end
  end

  defp get_ip(conn) do
    case get_req_header(conn, "x-forwarded-for") do
      [ip | _] -> ip
      [] -> to_string(:inet.ntoa(conn.remote_ip))
    end
  end
end
`,

    // Admin role plug
    'lib/{{projectName}}_web/plugs/require_admin.ex': `defmodule {{ProjectName}}Web.Plugs.RequireAdmin do
  import Plug.Conn
  import Phoenix.Controller

  def init(opts), do: opts

  def call(conn, _opts) do
    user = Guardian.Plug.current_resource(conn)

    if user && user.role == "admin" do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Admin access required"})
      |> halt()
    end
  end
end
`,

    // Health controller
    'lib/{{projectName}}_web/controllers/health_controller.ex': `defmodule {{ProjectName}}Web.HealthController do
  use {{ProjectName}}Web, :controller

  def index(conn, _params) do
    json(conn, %{
      status: "healthy",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end
end
`,

    // Auth controller
    'lib/{{projectName}}_web/controllers/auth_controller.ex': `defmodule {{ProjectName}}Web.AuthController do
  use {{ProjectName}}Web, :controller

  alias {{ProjectName}}.Accounts
  alias {{ProjectName}}Web.Auth.Guardian

  def register(conn, %{"email" => _, "password" => _, "name" => _} = params) do
    case Accounts.create_user(params) do
      {:ok, user} ->
        conn
        |> put_status(:created)
        |> render(:user, user: user)

      {:error, changeset} ->
        errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)

        conn
        |> put_status(:bad_request)
        |> json(%{error: "Validation error", details: errors})
    end
  end

  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate_user(email, password) do
      {:ok, user} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(user)

        conn
        |> put_status(:ok)
        |> render(:auth, token: token, user: user)

      {:error, :account_disabled} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Account is disabled"})

      {:error, :invalid_credentials} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid credentials"})
    end
  end
end
`,

    // User controller
    'lib/{{projectName}}_web/controllers/user_controller.ex': `defmodule {{ProjectName}}Web.UserController do
  use {{ProjectName}}Web, :controller

  alias {{ProjectName}}.Accounts

  plug {{ProjectName}}Web.Plugs.RequireAdmin when action in [:index, :delete]

  def me(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    render(conn, :user, user: user)
  end

  def update_me(conn, params) do
    user = Guardian.Plug.current_resource(conn)

    # Only allow updating name
    allowed_params = Map.take(params, ["name"])

    case Accounts.update_user(user, allowed_params) do
      {:ok, updated_user} ->
        render(conn, :user, user: updated_user)

      {:error, changeset} ->
        errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)

        conn
        |> put_status(:bad_request)
        |> json(%{error: "Validation error", details: errors})
    end
  end

  def index(conn, _params) do
    users = Accounts.list_users()
    render(conn, :users, users: users)
  end

  def show(conn, %{"id" => id}) do
    case Accounts.get_user(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "User not found"})

      user ->
        render(conn, :user, user: user)
    end
  end

  def delete(conn, %{"id" => id}) do
    case Accounts.get_user(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "User not found"})

      user ->
        {:ok, _} = Accounts.delete_user(user)
        send_resp(conn, :no_content, "")
    end
  end
end
`,

    // Product controller
    'lib/{{projectName}}_web/controllers/product_controller.ex': `defmodule {{ProjectName}}Web.ProductController do
  use {{ProjectName}}Web, :controller

  alias {{ProjectName}}.Catalog

  plug {{ProjectName}}Web.Plugs.RequireAdmin when action in [:create, :update, :delete]

  def index(conn, params) do
    result = Catalog.list_products(params)
    render(conn, :paginated, data: result.data, total: result.total, page: result.page, limit: result.limit)
  end

  def show(conn, %{"id" => id}) do
    case Catalog.get_product(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Product not found"})

      product ->
        render(conn, :product, product: product)
    end
  end

  def create(conn, params) do
    case Catalog.create_product(params) do
      {:ok, product} ->
        conn
        |> put_status(:created)
        |> render(:product, product: product)

      {:error, changeset} ->
        errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)

        conn
        |> put_status(:bad_request)
        |> json(%{error: "Validation error", details: errors})
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Catalog.get_product(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Product not found"})

      product ->
        case Catalog.update_product(product, params) do
          {:ok, updated_product} ->
            render(conn, :product, product: updated_product)

          {:error, changeset} ->
            errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)

            conn
            |> put_status(:bad_request)
            |> json(%{error: "Validation error", details: errors})
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Catalog.get_product(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Product not found"})

      product ->
        {:ok, _} = Catalog.delete_product(product)
        send_resp(conn, :no_content, "")
    end
  end
end
`,

    // Auth JSON view
    'lib/{{projectName}}_web/controllers/auth_json.ex': `defmodule {{ProjectName}}Web.AuthJSON do
  alias {{ProjectName}}.Accounts.User

  def user(%{user: user}) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      created_at: user.inserted_at
    }
  end

  def auth(%{token: token, user: user}) do
    %{
      token: token,
      user: user(%{user: user})
    }
  end
end
`,

    // User JSON view
    'lib/{{projectName}}_web/controllers/user_json.ex': `defmodule {{ProjectName}}Web.UserJSON do
  alias {{ProjectName}}.Accounts.User

  def user(%{user: user}) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      created_at: user.inserted_at
    }
  end

  def users(%{users: users}) do
    Enum.map(users, fn user -> user(%{user: user}) end)
  end
end
`,

    // Product JSON view
    'lib/{{projectName}}_web/controllers/product_json.ex': `defmodule {{ProjectName}}Web.ProductJSON do
  alias {{ProjectName}}.Catalog.Product

  def product(%{product: product}) do
    %{
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      active: product.active,
      created_at: product.inserted_at,
      updated_at: product.updated_at
    }
  end

  def paginated(%{data: products, total: total, page: page, limit: limit}) do
    %{
      data: Enum.map(products, fn p -> product(%{product: p}) end),
      total: total,
      page: page,
      limit: limit
    }
  end
end
`,

    // Web module
    'lib/{{projectName}}_web.ex': `defmodule {{ProjectName}}Web do
  def static_paths, do: ~w(assets fonts images favicon.ico robots.txt)

  def router do
    quote do
      use Phoenix.Router, helpers: false

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def controller do
    quote do
      use Phoenix.Controller,
        formats: [:json]

      import Plug.Conn
      import {{ProjectName}}Web.Gettext
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: {{ProjectName}}Web.Endpoint,
        router: {{ProjectName}}Web.Router,
        statics: {{ProjectName}}Web.static_paths()
    end
  end

  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
`,

    // Telemetry
    'lib/{{projectName}}_web/telemetry.ex': `defmodule {{ProjectName}}Web.Telemetry do
  use Supervisor
  import Telemetry.Metrics

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children = [
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      summary("phoenix.endpoint.start.system_time", unit: {:native, :millisecond}),
      summary("phoenix.endpoint.stop.duration", unit: {:native, :millisecond}),
      summary("phoenix.router_dispatch.stop.duration", unit: {:native, :millisecond}),
      summary("{{projectName}}.repo.query.total_time", unit: {:native, :millisecond}),
      summary("{{projectName}}.repo.query.queue_time", unit: {:native, :millisecond})
    ]
  end

  defp periodic_measurements do
    []
  end
end
`,

    // Gettext
    'lib/{{projectName}}_web/gettext.ex': `defmodule {{ProjectName}}Web.Gettext do
  use Gettext, otp_app: :{{projectName}}
end
`,

    // Config
    'config/config.exs': `import Config

config :{{projectName}},
  ecto_repos: [{{ProjectName}}.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

config :{{projectName}}, {{ProjectName}}Web.Endpoint,
  url: [host: "localhost"],
  adapter: Phoenix.Endpoint.Cowboy2Adapter,
  render_errors: [
    formats: [json: {{ProjectName}}Web.ErrorJSON],
    layout: false
  ],
  pubsub_server: {{ProjectName}}.PubSub,
  live_view: [signing_salt: "changeme"]

config :{{projectName}}, {{ProjectName}}Web.Auth.Guardian,
  issuer: "{{projectName}}",
  secret_key: "your-secret-key-change-in-production"

config :logger, :console,
  format: "$time $metadata[$level] $message\\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

config :hammer,
  backend: {Hammer.Backend.ETS, [expiry_ms: 60_000 * 60, cleanup_interval_ms: 60_000 * 10]}

import_config "#{config_env()}.exs"
`,

    // Dev config
    'config/dev.exs': `import Config

config :{{projectName}}, {{ProjectName}}.Repo,
  username: "postgres",
  password: "password",
  hostname: "localhost",
  database: "{{projectName}}_dev",
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :{{projectName}}, {{ProjectName}}Web.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev-secret-key-change-in-production-dev-secret-key-change-in-production",
  watchers: []

config :{{projectName}}, dev_routes: true

config :logger, :console, format: "[$level] $message\\n"

config :phoenix, :stacktrace_depth, 20

config :phoenix, :plug_init_mode, :runtime
`,

    // Prod config
    'config/prod.exs': `import Config

config :{{projectName}}, {{ProjectName}}Web.Endpoint,
  cache_static_manifest: "priv/static/cache_manifest.json"

config :logger, level: :info
`,

    // Runtime config
    'config/runtime.exs': `import Config

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      """

  config :{{projectName}}, {{ProjectName}}.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    socket_options: [:inet6]

  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      """

  host = System.get_env("PHX_HOST") || "example.com"
  port = String.to_integer(System.get_env("PORT") || "4000")

  config :{{projectName}}, {{ProjectName}}Web.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base

  jwt_secret =
    System.get_env("JWT_SECRET") ||
      raise """
      environment variable JWT_SECRET is missing.
      """

  config :{{projectName}}, {{ProjectName}}Web.Auth.Guardian,
    secret_key: jwt_secret
end
`,

    // Test config
    'config/test.exs': `import Config

config :{{projectName}}, {{ProjectName}}.Repo,
  username: "postgres",
  password: "password",
  hostname: "localhost",
  database: "{{projectName}}_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: 10

config :{{projectName}}, {{ProjectName}}Web.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "test-secret-key-test-secret-key-test-secret-key-test-secret-key",
  server: false

config :logger, level: :warning

config :phoenix, :plug_init_mode, :runtime
`,

    // Migration
    'priv/repo/migrations/20240101000000_create_users.exs': `defmodule {{ProjectName}}.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :email, :string, null: false
      add :hashed_password, :string, null: false
      add :name, :string, null: false
      add :role, :string, default: "user"
      add :active, :boolean, default: true

      timestamps(type: :utc_datetime)
    end

    create unique_index(:users, [:email])
  end
end
`,

    // Products migration
    'priv/repo/migrations/20240101000001_create_products.exs': `defmodule {{ProjectName}}.Repo.Migrations.CreateProducts do
  use Ecto.Migration

  def change do
    create table(:products, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :description, :text
      add :price, :decimal, precision: 10, scale: 2, null: false
      add :stock, :integer, default: 0
      add :active, :boolean, default: true

      timestamps(type: :utc_datetime)
    end
  end
end
`,

    // Seeds
    'priv/repo/seeds.exs': `# Script for populating the database. You can run it as:
#     mix run priv/repo/seeds.exs

alias {{ProjectName}}.Accounts
alias {{ProjectName}}.Catalog

# Create admin user
{:ok, _admin} = Accounts.create_user(%{
  email: "admin@example.com",
  password: "admin123",
  name: "Admin User",
  role: "admin"
})

# Create some sample products
for i <- 1..5 do
  Catalog.create_product(%{
    name: "Product #{i}",
    description: "Description for product #{i}",
    price: Decimal.new("9.99"),
    stock: 100
  })
end

IO.puts("Seeds completed!")
`,

    // Dockerfile
    'Dockerfile': `# Build stage
FROM elixir:1.15-alpine AS builder

RUN apk add --no-cache build-base git

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod

COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
RUN mix deps.compile

COPY config config
COPY lib lib
COPY priv priv

RUN mix compile
RUN mix release

# Runtime stage
FROM alpine:3.18

RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /app

COPY --from=builder /app/_build/prod/rel/{{projectName}} ./

ENV HOME=/app

# Create non-root user
RUN addgroup -S -g 1000 appgroup && \\
    adduser -S -u 1000 -G appgroup -h /app appuser

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:4000/health || exit 1

CMD ["bin/{{projectName}}", "start"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=ecto://postgres:password@postgres:5432/{{projectName}}
      - SECRET_KEY_BASE=your-secret-key-base-at-least-64-chars-long-change-this
      - JWT_SECRET=your-jwt-secret-change-this
      - PHX_HOST=localhost
      - PORT=4000
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`,

    // README
    'README.md': `# {{ProjectName}}

A fault-tolerant REST API built with Phoenix Framework in Elixir.

## Features

- **Phoenix Framework**: Fast, reliable web framework
- **Ecto**: Database wrapper and query generator
- **Guardian**: JWT authentication
- **Bcrypt**: Secure password hashing
- **Rate Limiting**: Request throttling with Hammer
- **Live Dashboard**: Real-time monitoring
- **Docker Support**: Containerized deployment

## Requirements

- Elixir 1.15+
- Erlang/OTP 26+
- PostgreSQL
- Docker (optional)

## Quick Start

1. Install dependencies:
   \`\`\`bash
   mix deps.get
   \`\`\`

2. Create and migrate database:
   \`\`\`bash
   mix ecto.setup
   \`\`\`

3. Start the server:
   \`\`\`bash
   mix phx.server
   \`\`\`

4. Or run with Docker:
   \`\`\`bash
   docker-compose up
   \`\`\`

## Available Commands

\`\`\`bash
mix phx.server      # Start server
mix test            # Run tests
mix credo           # Static analysis
mix dialyzer        # Type checking
mix format          # Format code
mix ecto.migrate    # Run migrations
mix ecto.rollback   # Rollback migration
\`\`\`

## API Endpoints

- \`GET /health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/users/me\` - Current user
- \`GET /api/v1/products\` - List products
- And more...

## Project Structure

\`\`\`
lib/
├── {{projectName}}/           # Business logic
│   ├── accounts/              # User management
│   ├── catalog/               # Product management
│   └── repo.ex                # Database repo
└── {{projectName}}_web/       # Web layer
    ├── auth/                  # Authentication
    ├── controllers/           # Controllers
    ├── plugs/                 # Middleware
    └── router.ex              # Routes
\`\`\`
`
  }
};
