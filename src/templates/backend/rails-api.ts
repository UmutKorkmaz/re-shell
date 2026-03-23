import { BackendTemplate } from '../types';

export const railsApiTemplate: BackendTemplate = {
  id: 'rails-api',
  name: 'rails-api',
  displayName: 'Ruby on Rails API',
  description: 'RESTful API with Rails, Active Record, JWT authentication, and comprehensive testing',
  language: 'ruby',
  framework: 'rails',
  version: '7.1.2',
  tags: ['ruby', 'rails', 'api', 'rest', 'active-record', 'jwt', 'postgresql'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'documentation', 'testing'],
  
  files: {
    // Gemfile
    'Gemfile': `source "https://rubygems.org"

ruby "3.3.0"

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 7.1.2"

# Use postgresql as the database for Active Record
gem "pg", "~> 1.1"

# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"

# Build JSON APIs with ease [https://github.com/rails/jbuilder]
# gem "jbuilder"

# Use Redis adapter to run Action Cable in production
gem "caching", ">= 4.0.1"

# Use Kredis to get higher-level data types in Redis [https://github.com/rails/kredis]
# gem "kredis"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
gem "bcrypt", "~> 3.1.7"

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
# gem "image_processing", "~> 1.2"

# Use Rack CORS for handling Cross-Origin Resource Sharing (CORS), making cross-origin Ajax possible
gem "rack-cors"

# JWT authentication
gem "authentication"

# Pagination
gem "kaminari"

# Serialization
gem "active_model_serializers", "~> 0.10.0"

# API documentation
gem "rswag-api"
gem "rswag-ui"

# Background jobs
gem "sidekiq", "~> 7.2"

# Environment variables
gem "dotenv-rails"

# Request throttling
gem "rack-attack"

# Health checks
gem "rails-healthcheck"

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri windows ]
  
  # Testing framework
  gem "rspec-rails", "~> 6.1.0"
  gem "factory_bot_rails"
  gem "faker"
  
  # Code quality
  gem "rubocop", require: false
  gem "rubocop-rails", require: false
  gem "rubocop-rspec", require: false
end

group :development do
  # Speed up commands on slow machines / big apps [https://github.com/rails/spring]
  # gem "spring"
  
  # Auto-testing
  gem "guard"
  gem "guard-rspec", require: false
  
  # Better error pages
  gem "better_errors"
  gem "binding_of_caller"
  
  # Performance monitoring
  gem "bullet"
  gem "rack-mini-profiler"
end

group :test do
  # Code coverage
  gem "simplecov", require: false
  
  # API testing
  gem "shoulda-matchers", "~> 5.0"
  gem "database_cleaner-active_record"
  
  # Time manipulation
  gem "timecop"
  
  # HTTP mocking
  gem "webmock"
  gem "vcr"
end
`,

    // Ruby version
    '.ruby-version': `3.3.0
`,

    // Database configuration
    'config/database.yml': `# PostgreSQL. Versions 9.3 and up are supported.
#
# Install the pg driver:
#   gem install pg
# On macOS with Homebrew:
#   gem install pg -- --with-pg-config=/usr/local/bin/pg_config
# On Windows:
#   gem install pg
#       Choose the win32 build.
#       Install PostgreSQL and put its /bin directory on your path.
#
# Configure Using Gemfile
# gem "pg"
#
default: &default
  adapter: postgresql
  encoding: unicode
  # For details on connection pooling, see Rails configuration guide
  # https://guides.rubyonrails.org/configuring.html#database-pooling
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: {{projectName}}_development
  username: <%= ENV.fetch("DATABASE_USERNAME", "postgres") %>
  password: <%= ENV.fetch("DATABASE_PASSWORD", "") %>
  host: <%= ENV.fetch("DATABASE_HOST", "localhost") %>
  port: <%= ENV.fetch("DATABASE_PORT", 5432) %>

  # The specified database role being used to connect to PostgreSQL.
  # To create additional roles in PostgreSQL see \`$ createuser --help\`.
  # When left blank, PostgreSQL will use the default role. This is
  # the same name as the operating system user running Rails.
  #username: {{projectName}}

  # The password associated with the PostgreSQL role (username).
  #password:

  # Connect on a TCP socket. Omitted by default since the client uses a
  # domain socket that doesn't need configuration. Windows does not have
  # domain sockets, so uncomment these lines.
  #host: localhost

  # The TCP port the server listens on. Defaults to 5432.
  # If your server runs on a different port number, change accordingly.
  #port: 5432

  # Schema search path. The server defaults to $user,public
  #schema_search_path: myapp,sharedapp,public

  # Minimum log levels, in increasing order:
  #   debug5, debug4, debug3, debug2, debug1,
  #   log, notice, warning, error, fatal, and panic
  # Defaults to warning.
  #min_messages: notice

# Warning: The database defined as "test" will be erased and
# re-generated from your development database when you run "rake".
# Do not set this db to the same as development or production.
test:
  <<: *default
  database: {{projectName}}_test
  username: <%= ENV.fetch("DATABASE_USERNAME", "postgres") %>
  password: <%= ENV.fetch("DATABASE_PASSWORD", "") %>
  host: <%= ENV.fetch("DATABASE_HOST", "localhost") %>
  port: <%= ENV.fetch("DATABASE_PORT", 5432) %>

# As with config/credentials.yml, you never want to store sensitive information,
# like your database password, in your source code. If your source code is
# ever seen by anyone, they now have access to your database.
#
# Instead, provide the password or a full connection URL as an environment
# variable when you boot the app. For example:
#
#   DATABASE_URL="postgres://myuser:mypass@localhost/somedatabase"
#
# If the connection URL is provided in the special DATABASE_URL environment
# variable, Rails will automatically merge its configuration values on top of
# the values provided in this file. Alternatively, you can specify a connection
# URL environment variable explicitly:
#
#   production:
#     url: <%= ENV["MY_APP_DATABASE_URL"] %>
#
# Read https://guides.rubyonrails.org/configuring.html#configuring-a-database
# for a full overview on how database connection configuration can be specified.
#
production:
  <<: *default
  database: {{projectName}}_production
  username: {{projectName}}
  password: <%= ENV["{{projectName}}_DATABASE_PASSWORD"] %>
`,

    // Application configuration
    'config/application.rb': `require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_mailbox/engine"
require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module {{projectName}}
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 7.1

    # Please, add to the \`ignore\` list any other \`lib\` subdirectories that do
    # not contain \`.rb\` files, or that should not be reloaded or eager loaded.
    # Common ones are \`templates\`, \`generators\`, or \`middleware\`, for example.
    config.autoload_lib(ignore: %w(assets tasks))

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # Middleware
    config.middleware.use Rack::Attack
    
    # CORS configuration
    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins ENV.fetch('CORS_ORIGINS', '*').split(',')
        resource '*',
          headers: :any,
          methods: [:get, :post, :put, :patch, :delete, :options, :head],
          expose: ['X-Total-Count', 'X-Total-Pages', 'X-Current-Page', 'X-Next-Page', 'X-Prev-Page'],
          credentials: true
      end
    end

    # Active Job configuration
    config.active_job.queue_adapter = :sidekiq

    # Timezone
    config.time_zone = 'UTC'
    config.active_record.default_timezone = :utc
  end
end
`,

    // Routes
    'config/routes.rb': `Rails.application.routes.draw do
  mount Rswag::Ui::Engine => '/api-docs'
  mount Rswag::Api::Engine => '/api-docs'
  
  # Health check
  get '/health', to: 'health#show'
  
  # API routes
  namespace :api do
    namespace :v1 do
      # Authentication
      post 'auth/register', to: 'auth#register'
      post 'auth/login', to: 'auth#login'
      post 'auth/refresh', to: 'auth#refresh'
      delete 'auth/logout', to: 'auth#logout'
      
      # Users
      resources :users do
        member do
          patch 'activate'
          patch 'deactivate'
        end
      end
      
      # Products
      resources :products do
        collection do
          get 'search'
        end
      end
      
      # Orders
      resources :orders do
        member do
          patch 'cancel'
          patch 'complete'
        end
      end
    end
  end
  
  # Sidekiq Web UI (in production, add authentication)
  if Rails.env.development?
    require 'sidekiq/web'
    mount Sidekiq::Web => '/sidekiq'
  end
  
  # Catch all route for 404s
  match '*unmatched', to: 'application#route_not_found', via: :all
end
`,

    // Application controller
    'app/controllers/application_controller.rb': `class ApplicationController < ActionController::API
  include JsonWebToken
  
  before_action :authenticate_request
  
  rescue_from ActiveRecord::RecordNotFound, with: :record_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :record_invalid
  rescue_from ActionController::ParameterMissing, with: :parameter_missing
  
  private
  
  def authenticate_request
    header = request.headers['Authorization']
    header = header.split(' ').last if header
    
    begin
      decoded = jwt_decode(header)
      @current_user = User.find(decoded[:user_id])
    rescue JWT::DecodeError => e
      render json: { error: 'Invalid token' }, status: :unauthorized
    rescue ActiveRecord::RecordNotFound
      render json: { error: 'User not found' }, status: :unauthorized
    end
  end
  
  def current_user
    @current_user
  end
  
  def record_not_found(error)
    render json: { error: error.message }, status: :not_found
  end
  
  def record_invalid(error)
    render json: { errors: error.record.errors.full_messages }, status: :unprocessable_entity
  end
  
  def parameter_missing(error)
    render json: { error: error.message }, status: :bad_request
  end
  
  def route_not_found
    render json: { error: 'Route not found' }, status: :not_found
  end
end
`,

    // JWT concern
    'app/controllers/concerns/json_web_token.rb': `module JsonWebToken
  extend ActiveSupport::Concern
  
  SECRET_KEY = Rails.application.credentials.secret_key_base || ENV['SECRET_KEY_BASE']
  
  def jwt_encode(payload, exp = 24.hours.from_now)
    payload[:exp] = exp.to_i
    JWT.encode(payload, SECRET_KEY)
  end
  
  def jwt_decode(token)
    decoded = JWT.decode(token, SECRET_KEY)[0]
    HashWithIndifferentAccess.new decoded
  end
end
`,

    // Health controller
    'app/controllers/health_controller.rb': `class HealthController < ApplicationController
  skip_before_action :authenticate_request
  
  def show
    render json: {
      status: 'ok',
      timestamp: Time.current,
      database: database_healthy?,
      redis: redis_healthy?,
      version: Rails.application.config.version || '1.0.0'
    }
  end
  
  private
  
  def database_healthy?
    ActiveRecord::Base.connection.active?
  rescue StandardError
    false
  end
  
  def redis_healthy?
    Redis.new.ping == 'PONG'
  rescue StandardError
    false
  end
end
`,

    // Auth controller
    'app/controllers/api/v1/auth_controller.rb': `module Api
  module V1
    class AuthController < ApplicationController
      skip_before_action :authenticate_request, only: [:register, :login, :refresh]
      
      # POST /api/v1/auth/register
      def register
        @user = User.new(user_params)
        
        if @user.save
          token = jwt_encode(user_id: @user.id)
          refresh_token = jwt_encode({ user_id: @user.id, type: 'refresh' }, 7.days.from_now)
          
          render json: {
            user: UserSerializer.new(@user),
            access_token: token,
            refresh_token: refresh_token
          }, status: :created
        else
          render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
        end
      end
      
      # POST /api/v1/auth/login
      def login
        @user = User.find_by(email: params[:email])
        
        if @user&.authenticate(params[:password])
          if @user.active?
            token = jwt_encode(user_id: @user.id)
            refresh_token = jwt_encode({ user_id: @user.id, type: 'refresh' }, 7.days.from_now)
            
            render json: {
              user: UserSerializer.new(@user),
              access_token: token,
              refresh_token: refresh_token
            }
          else
            render json: { error: 'Account is inactive' }, status: :forbidden
          end
        else
          render json: { error: 'Invalid credentials' }, status: :unauthorized
        end
      end
      
      # POST /api/v1/auth/refresh
      def refresh
        header = request.headers['Authorization']
        header = header.split(' ').last if header
        
        begin
          decoded = jwt_decode(header)
          
          if decoded[:type] == 'refresh'
            @user = User.find(decoded[:user_id])
            token = jwt_encode(user_id: @user.id)
            
            render json: {
              access_token: token
            }
          else
            render json: { error: 'Invalid token type' }, status: :unauthorized
          end
        rescue JWT::DecodeError => e
          render json: { error: 'Invalid token' }, status: :unauthorized
        rescue ActiveRecord::RecordNotFound
          render json: { error: 'User not found' }, status: :unauthorized
        end
      end
      
      # DELETE /api/v1/auth/logout
      def logout
        # In a real app, you might want to blacklist the token
        render json: { message: 'Logged out successfully' }
      end
      
      private
      
      def user_params
        params.permit(:email, :password, :name)
      end
    end
  end
end
`,

    // Users controller
    'app/controllers/api/v1/users_controller.rb': `module Api
  module V1
    class UsersController < ApplicationController
      before_action :set_user, only: [:show, :update, :destroy, :activate, :deactivate]
      
      # GET /api/v1/users
      def index
        @users = User.all
        @users = @users.where('name ILIKE ? OR email ILIKE ?', "%#{params[:search]}%", "%#{params[:search]}%") if params[:search].present?
        @users = @users.where(role: params[:role]) if params[:role].present?
        @users = @users.page(params[:page]).per(params[:per_page] || 20)
        
        render json: @users, 
               each_serializer: UserSerializer,
               meta: pagination_meta(@users)
      end
      
      # GET /api/v1/users/:id
      def show
        render json: @user, serializer: UserSerializer
      end
      
      # PATCH/PUT /api/v1/users/:id
      def update
        if @user.update(user_params)
          render json: @user, serializer: UserSerializer
        else
          render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
        end
      end
      
      # DELETE /api/v1/users/:id
      def destroy
        @user.destroy
        head :no_content
      end
      
      # PATCH /api/v1/users/:id/activate
      def activate
        @user.update(active: true)
        render json: @user, serializer: UserSerializer
      end
      
      # PATCH /api/v1/users/:id/deactivate
      def deactivate
        @user.update(active: false)
        render json: @user, serializer: UserSerializer
      end
      
      private
      
      def set_user
        @user = User.find(params[:id])
      end
      
      def user_params
        params.permit(:email, :name, :role)
      end
      
      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          next_page: collection.next_page,
          prev_page: collection.prev_page,
          total_pages: collection.total_pages,
          total_count: collection.total_count
        }
      end
    end
  end
end
`,

    // Products controller
    'app/controllers/api/v1/products_controller.rb': `module Api
  module V1
    class ProductsController < ApplicationController
      skip_before_action :authenticate_request, only: [:index, :show, :search]
      before_action :set_product, only: [:show, :update, :destroy]
      
      # GET /api/v1/products
      def index
        @products = Product.active
        @products = @products.where(category: params[:category]) if params[:category].present?
        @products = @products.where('price >= ?', params[:min_price]) if params[:min_price].present?
        @products = @products.where('price <= ?', params[:max_price]) if params[:max_price].present?
        @products = @products.order(params[:sort] || 'created_at DESC')
        @products = @products.page(params[:page]).per(params[:per_page] || 20)
        
        render json: @products,
               each_serializer: ProductSerializer,
               meta: pagination_meta(@products)
      end
      
      # GET /api/v1/products/:id
      def show
        render json: @product, serializer: ProductSerializer
      end
      
      # GET /api/v1/products/search
      def search
        @products = Product.active.search(params[:q])
        @products = @products.page(params[:page]).per(params[:per_page] || 20)
        
        render json: @products,
               each_serializer: ProductSerializer,
               meta: pagination_meta(@products)
      end
      
      # POST /api/v1/products
      def create
        @product = Product.new(product_params)
        
        if @product.save
          render json: @product, serializer: ProductSerializer, status: :created
        else
          render json: { errors: @product.errors.full_messages }, status: :unprocessable_entity
        end
      end
      
      # PATCH/PUT /api/v1/products/:id
      def update
        if @product.update(product_params)
          render json: @product, serializer: ProductSerializer
        else
          render json: { errors: @product.errors.full_messages }, status: :unprocessable_entity
        end
      end
      
      # DELETE /api/v1/products/:id
      def destroy
        @product.destroy
        head :no_content
      end
      
      private
      
      def set_product
        @product = Product.find(params[:id])
      end
      
      def product_params
        params.permit(:name, :description, :price, :stock, :category, :sku, :active)
      end
      
      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          next_page: collection.next_page,
          prev_page: collection.prev_page,
          total_pages: collection.total_pages,
          total_count: collection.total_count
        }
      end
    end
  end
end
`,

    // User model
    'app/models/user.rb': `class User < ApplicationRecord
  has_secure_password
  
  # Associations
  has_many :orders, dependent: :destroy
  
  # Validations
  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, if: :password_required?
  validates :role, inclusion: { in: %w[user admin moderator] }
  
  # Scopes
  scope :active, -> { where(active: true) }
  scope :admins, -> { where(role: 'admin') }
  scope :recent, -> { order(created_at: :desc) }
  
  # Callbacks
  before_validation :downcase_email
  after_initialize :set_defaults
  
  private
  
  def downcase_email
    self.email = email&.downcase
  end
  
  def set_defaults
    self.role ||= 'user'
    self.active = true if active.nil?
  end
  
  def password_required?
    new_record? || password.present?
  end
end
`,

    // Product model
    'app/models/product.rb': `class Product < ApplicationRecord
  # Associations
  has_many :order_items
  has_many :orders, through: :order_items
  
  # Validations
  validates :name, presence: true
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :stock, presence: true, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :sku, presence: true, uniqueness: true
  validates :category, presence: true
  
  # Scopes
  scope :active, -> { where(active: true) }
  scope :in_stock, -> { where('stock > 0') }
  scope :by_category, ->(category) { where(category: category) }
  scope :price_range, ->(min, max) { where(price: min..max) }
  
  # Callbacks
  before_validation :generate_sku, on: :create
  after_initialize :set_defaults
  
  # Class methods
  def self.search(query)
    where('name ILIKE ? OR description ILIKE ?', "%#{query}%", "%#{query}%")
  end
  
  # Instance methods
  def in_stock?
    stock > 0
  end
  
  def update_stock!(quantity)
    with_lock do
      if stock >= quantity
        update!(stock: stock - quantity)
        true
      else
        errors.add(:stock, 'insufficient stock')
        false
      end
    end
  end
  
  private
  
  def generate_sku
    self.sku ||= "SKU-#{SecureRandom.hex(4).upcase}"
  end
  
  def set_defaults
    self.active = true if active.nil?
  end
end
`,

    // Order model
    'app/models/order.rb': `class Order < ApplicationRecord
  # Associations
  belongs_to :user
  has_many :order_items, dependent: :destroy
  has_many :products, through: :order_items
  
  # Validations
  validates :status, inclusion: { in: %w[pending processing shipped delivered cancelled] }
  validates :total_amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  
  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_status, ->(status) { where(status: status) }
  scope :completed, -> { where(status: %w[shipped delivered]) }
  
  # Callbacks
  after_initialize :set_defaults
  before_save :calculate_total
  
  # State machine
  def cancel!
    return false unless can_cancel?
    
    transaction do
      order_items.each do |item|
        item.product.update!(stock: item.product.stock + item.quantity)
      end
      update!(status: 'cancelled')
    end
  end
  
  def complete!
    return false unless status == 'processing'
    update!(status: 'shipped')
  end
  
  def can_cancel?
    %w[pending processing].include?(status)
  end
  
  private
  
  def set_defaults
    self.status ||= 'pending'
    self.total_amount ||= 0
  end
  
  def calculate_total
    self.total_amount = order_items.sum { |item| item.quantity * item.price }
  end
end
`,

    // Order item model
    'app/models/order_item.rb': `class OrderItem < ApplicationRecord
  # Associations
  belongs_to :order
  belongs_to :product
  
  # Validations
  validates :quantity, presence: true, numericality: { greater_than: 0, only_integer: true }
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  
  # Callbacks
  before_validation :set_price
  
  # Instance methods
  def subtotal
    quantity * price
  end
  
  private
  
  def set_price
    self.price ||= product&.price
  end
end
`,

    // User serializer
    'app/serializers/user_serializer.rb': `class UserSerializer < ActiveModel::Serializer
  attributes :id, :email, :name, :role, :active, :created_at, :updated_at
end
`,

    // Product serializer
    'app/serializers/product_serializer.rb': `class ProductSerializer < ActiveModel::Serializer
  attributes :id, :name, :description, :price, :stock, :category, :sku, :active, :in_stock, :created_at, :updated_at
  
  def in_stock
    object.in_stock?
  end
end
`,

    // Order serializer
    'app/serializers/order_serializer.rb': `class OrderSerializer < ActiveModel::Serializer
  attributes :id, :status, :total_amount, :created_at, :updated_at
  
  belongs_to :user
  has_many :order_items
end
`,

    // Migrations
    'db/migrate/001_create_users.rb': `class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :name, null: false
      t.string :role, null: false, default: 'user'
      t.boolean :active, null: false, default: true
      
      t.timestamps
    end
    
    add_index :users, :email, unique: true
    add_index :users, :role
    add_index :users, :active
  end
end
`,

    'db/migrate/002_create_products.rb': `class CreateProducts < ActiveRecord::Migration[7.1]
  def change
    create_table :products do |t|
      t.string :name, null: false
      t.text :description
      t.decimal :price, precision: 10, scale: 2, null: false
      t.integer :stock, null: false, default: 0
      t.string :category, null: false
      t.string :sku, null: false
      t.boolean :active, null: false, default: true
      
      t.timestamps
    end
    
    add_index :products, :sku, unique: true
    add_index :products, :category
    add_index :products, :active
    add_index :products, [:name, :description], using: :gin
  end
end
`,

    'db/migrate/003_create_orders.rb': `class CreateOrders < ActiveRecord::Migration[7.1]
  def change
    create_table :orders do |t|
      t.references :user, null: false, foreign_key: true
      t.string :status, null: false, default: 'pending'
      t.decimal :total_amount, precision: 10, scale: 2, null: false, default: 0
      
      t.timestamps
    end
    
    add_index :orders, :status
    add_index :orders, :created_at
  end
end
`,

    'db/migrate/004_create_order_items.rb': `class CreateOrderItems < ActiveRecord::Migration[7.1]
  def change
    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: true
      t.integer :quantity, null: false
      t.decimal :price, precision: 10, scale: 2, null: false
      
      t.timestamps
    end
  end
end
`,

    // Seeds
    'db/seeds.rb': `# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Create admin user
admin = User.find_or_create_by!(email: 'admin@example.com') do |user|
  user.password = 'password123'
  user.name = 'Admin User'
  user.role = 'admin'
end

# Create regular users
5.times do |i|
  User.find_or_create_by!(email: "user#{i+1}@example.com") do |user|
    user.password = 'password123'
    user.name = Faker::Name.name
    user.role = 'user'
  end
end

# Create categories
categories = ['Electronics', 'Books', 'Clothing', 'Home & Garden', 'Sports']

# Create products
categories.each do |category|
  10.times do
    Product.create!(
      name: Faker::Commerce.product_name,
      description: Faker::Lorem.paragraph(sentence_count: 3),
      price: Faker::Commerce.price(range: 10.0..500.0),
      stock: rand(0..100),
      category: category,
      sku: "SKU-#{SecureRandom.hex(4).upcase}",
      active: [true, true, true, false].sample
    )
  end
end

puts "Seeded #{User.count} users and #{Product.count} products"
`,

    // RSpec configuration
    '.rspec': `--require spec_helper
--format documentation
--color
`,

    'spec/spec_helper.rb': `# This file was generated by the \`rails generate rspec:install\` command. Conventionally, all
# specs live under a \`spec\` directory, which RSpec adds to the \`$LOAD_PATH\`.
# The generated \`.rspec\` file contains \`--require spec_helper\` which will cause
# this file to always be loaded, without a need to explicitly require it in any
# files.

require 'simplecov'
SimpleCov.start 'rails' do
  add_filter '/bin/'
  add_filter '/db/'
  add_filter '/spec/'
  add_filter '/test/'
end

# See https://rubydoc.info/gems/rspec-core/RSpec/Core/Configuration
RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.example_status_persistence_file_path = "spec/examples.txt"
  config.disable_monkey_patching!
  config.default_formatter = "doc" if config.files_to_run.one?
  config.profile_examples = 10
  config.order = :random
  Kernel.srand config.seed
end
`,

    'spec/rails_helper.rb': `# This file is copied to spec/ when you run 'rails generate rspec:install'
require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
# Prevent database truncation if the environment is production
abort("The Rails environment is running in production mode!") if Rails.env.production?
require 'rspec/rails'
# Add additional requires below this line. Rails is not loaded until this point!

# Requires supporting ruby files with custom matchers and macros, etc, in
# spec/support/ and its subdirectories. Files matching \`spec/**/*_spec.rb\` are
# run as spec files by default. This means that files in spec/support that end
# in _spec.rb will both be required and run as specs, causing the specs to be
# run twice. It is recommended that you do not name files matching this glob to
# end with _spec.rb. You can configure this pattern with the --pattern
# option on the command line or in ~/.rspec, .rspec or \`.rspec-local\`.
Dir[Rails.root.join('spec', 'support', '**', '*.rb')].sort.each { |f| require f }

# Checks for pending migrations and applies them before tests are run.
# If you are not using ActiveRecord, you can remove these lines.
begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  # Remove this line if you're not using ActiveRecord or ActiveRecord fixtures
  config.fixture_path = Rails.root.join('spec/fixtures')

  # If you're not using ActiveRecord, or you'd prefer not to run each of your
  # examples within a transaction, remove the following line or assign false
  # instead of true.
  config.use_transactional_fixtures = false

  # You can uncomment this line to turn off ActiveRecord support entirely.
  # config.use_active_record = false

  # RSpec Rails can automatically mix in different behaviours to your tests
  # based on their file location, for example enabling you to call \`get\` and
  # \`post\` in specs under \`spec/controllers\`.
  config.infer_spec_type_from_file_location!

  # Filter lines from Rails gems in backtraces.
  config.filter_rails_from_backtrace!
  # arbitrary gems may also be filtered via:
  # config.filter_gems_from_backtrace("gem name")

  # Include FactoryBot methods
  config.include FactoryBot::Syntax::Methods

  # Database cleaner
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before(:each) do
    DatabaseCleaner.strategy = :transaction
  end

  config.before(:each, js: true) do
    DatabaseCleaner.strategy = :truncation
  end

  config.before(:each) do
    DatabaseCleaner.start
  end

  config.after(:each) do
    DatabaseCleaner.clean
  end

  # Include request spec helpers
  config.include RequestSpecHelper, type: :request
  config.include AuthHelper, type: :request
end

# Configure Shoulda Matchers
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end
`,

    // Request spec helper
    'spec/support/request_spec_helper.rb': `module RequestSpecHelper
  def json
    JSON.parse(response.body)
  end
  
  def auth_headers(user)
    token = JsonWebToken.encode(user_id: user.id)
    {
      'Authorization' => "Bearer #{token}",
      'Content-Type' => 'application/json'
    }
  end
end
`,

    // Auth helper
    'spec/support/auth_helper.rb': `module AuthHelper
  def sign_in(user)
    token = JsonWebToken.encode(user_id: user.id)
    request.headers['Authorization'] = "Bearer #{token}"
  end
end
`,

    // User factory
    'spec/factories/users.rb': `FactoryBot.define do
  factory :user do
    email { Faker::Internet.unique.email }
    password { 'password123' }
    name { Faker::Name.name }
    role { 'user' }
    active { true }
    
    trait :admin do
      role { 'admin' }
    end
    
    trait :inactive do
      active { false }
    end
  end
end
`,

    // Product factory
    'spec/factories/products.rb': `FactoryBot.define do
  factory :product do
    name { Faker::Commerce.product_name }
    description { Faker::Lorem.paragraph(sentence_count: 3) }
    price { Faker::Commerce.price(range: 10.0..500.0) }
    stock { rand(10..100) }
    category { %w[Electronics Books Clothing Home Sports].sample }
    sku { "SKU-#{SecureRandom.hex(4).upcase}" }
    active { true }
    
    trait :out_of_stock do
      stock { 0 }
    end
    
    trait :inactive do
      active { false }
    end
  end
end
`,

    // User model spec
    'spec/models/user_spec.rb': `require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'associations' do
    it { should have_many(:orders).dependent(:destroy) }
  end
  
  describe 'validations' do
    subject { build(:user) }
    
    it { should validate_presence_of(:email) }
    it { should validate_uniqueness_of(:email).case_insensitive }
    it { should allow_value('user@example.com').for(:email) }
    it { should_not allow_value('invalid').for(:email) }
    it { should validate_presence_of(:name) }
    it { should validate_length_of(:password).is_at_least(8) }
    it { should validate_inclusion_of(:role).in_array(%w[user admin moderator]) }
  end
  
  describe 'callbacks' do
    it 'downcases email before validation' do
      user = build(:user, email: 'USER@EXAMPLE.COM')
      user.valid?
      expect(user.email).to eq('user@example.com')
    end
    
    it 'sets default values' do
      user = User.new
      expect(user.role).to eq('user')
      expect(user.active).to be(true)
    end
  end
  
  describe 'secure password' do
    it { should have_secure_password }
  end
  
  describe 'scopes' do
    let!(:active_user) { create(:user) }
    let!(:inactive_user) { create(:user, :inactive) }
    let!(:admin_user) { create(:user, :admin) }
    
    it '.active returns only active users' do
      expect(User.active).to include(active_user, admin_user)
      expect(User.active).not_to include(inactive_user)
    end
    
    it '.admins returns only admin users' do
      expect(User.admins).to include(admin_user)
      expect(User.admins).not_to include(active_user, inactive_user)
    end
  end
end
`,

    // Auth controller spec
    'spec/requests/api/v1/auth_spec.rb': `require 'rails_helper'

RSpec.describe 'Api::V1::Auth', type: :request do
  describe 'POST /api/v1/auth/register' do
    let(:valid_params) do
      {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User'
      }
    end
    
    context 'with valid parameters' do
      it 'creates a new user' do
        expect {
          post '/api/v1/auth/register', params: valid_params
        }.to change(User, :count).by(1)
      end
      
      it 'returns user data with tokens' do
        post '/api/v1/auth/register', params: valid_params
        
        expect(response).to have_http_status(:created)
        expect(json['user']['email']).to eq('newuser@example.com')
        expect(json['access_token']).to be_present
        expect(json['refresh_token']).to be_present
      end
    end
    
    context 'with invalid parameters' do
      it 'returns error for missing email' do
        post '/api/v1/auth/register', params: valid_params.except(:email)
        
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json['errors']).to include("Email can't be blank")
      end
      
      it 'returns error for duplicate email' do
        create(:user, email: 'newuser@example.com')
        post '/api/v1/auth/register', params: valid_params
        
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json['errors']).to include("Email has already been taken")
      end
    end
  end
  
  describe 'POST /api/v1/auth/login' do
    let!(:user) { create(:user, email: 'user@example.com', password: 'password123') }
    
    context 'with valid credentials' do
      it 'returns user data with tokens' do
        post '/api/v1/auth/login', params: { email: 'user@example.com', password: 'password123' }
        
        expect(response).to have_http_status(:ok)
        expect(json['user']['email']).to eq('user@example.com')
        expect(json['access_token']).to be_present
        expect(json['refresh_token']).to be_present
      end
    end
    
    context 'with invalid credentials' do
      it 'returns error for wrong password' do
        post '/api/v1/auth/login', params: { email: 'user@example.com', password: 'wrongpassword' }
        
        expect(response).to have_http_status(:unauthorized)
        expect(json['error']).to eq('Invalid credentials')
      end
      
      it 'returns error for inactive account' do
        user.update(active: false)
        post '/api/v1/auth/login', params: { email: 'user@example.com', password: 'password123' }
        
        expect(response).to have_http_status(:forbidden)
        expect(json['error']).to eq('Account is inactive')
      end
    end
  end
end
`,

    // Docker configuration
    'Dockerfile': `FROM ruby:3.3.0-alpine

# Install dependencies
RUN apk add --no-cache \
    build-base \
    postgresql-dev \
    nodejs \
    yarn \
    tzdata \
    git \
    curl

# Set working directory
WORKDIR /app

# Install bundler
RUN gem install bundler:2.5.3

# Copy Gemfile
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install --jobs 4 --retry 3

# Copy application code
COPY . .

# Precompile assets (if needed for API docs)
RUN bundle exec rails assets:precompile RAILS_ENV=production

# Create non-root user
RUN addgroup -g 1000 -S app && \
    adduser -u 1000 -S app -G app && \
    chown -R app:app /app

# Switch to non-root user
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

# Start server
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - RAILS_ENV=development
      - DATABASE_HOST=postgres
      - DATABASE_USERNAME=postgres
      - DATABASE_PASSWORD=password
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app
      - bundle:/usr/local/bundle
    command: >
      sh -c "bundle exec rails db:create &&
             bundle exec rails db:migrate &&
             bundle exec rails db:seed &&
             bundle exec rails server -b 0.0.0.0"

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  sidekiq:
    build: .
    depends_on:
      - postgres
      - redis
    environment:
      - RAILS_ENV=development
      - DATABASE_HOST=postgres
      - DATABASE_USERNAME=postgres
      - DATABASE_PASSWORD=password
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/app
      - bundle:/usr/local/bundle
    command: bundle exec sidekiq

volumes:
  postgres_data:
  bundle:
`,

    '.dockerignore': `# Ruby
*.gem
*.rbc
.config
coverage
InstalledFiles
lib/bundler/man
pkg
spec/reports
spec/examples.txt
test/tmp
test/version_tmp
tmp

# Yarn artifacts
.yarn-integrity

# Database
*.sqlite
*.sqlite3

# Logs
log/*.log

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Git
.git/
.gitignore

# Docker
docker-compose.yml
Dockerfile`,

    // Environment configuration
    '.env.example': `# Rails
RAILS_ENV=development
SECRET_KEY_BASE=your-secret-key-base

# Database
DATABASE_HOST=localhost
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=
DATABASE_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# CORS
CORS_ORIGINS=http://localhost:3001,http://localhost:3002

# JWT
JWT_SECRET=your-jwt-secret

# Monitoring
RAILS_LOG_TO_STDOUT=true
`,

    '.gitignore': `# See https://help.github.com/articles/ignoring-files for more about ignoring files.
#
# If you find yourself ignoring temporary files generated by your text editor
# or operating system, you probably want to add a global ignore instead:
#   git config --global core.excludesfile '~/.gitignore_global'

# Ignore bundler config.
/.bundle

# Ignore all environment files.
/.env*
!/.env.example

# Ignore all logfiles and tempfiles.
/log/*
/tmp/*
!/log/.keep
!/tmp/.keep

# Ignore pidfiles, but keep the directory.
/tmp/pids/*
!/tmp/pids/
!/tmp/pids/.keep

# Ignore uploaded files in development.
/storage/*
!/storage/.keep
/tmp/storage/*
!/tmp/storage/
!/tmp/storage/.keep

# Ignore master key for decrypting credentials and more.
/config/master.key

# Ignore test coverage
/coverage

# Ignore node_modules
/node_modules

# Ignore yard documentation
.yardoc
doc/

# Ignore RSpec examples status
spec/examples.txt

# macOS
.DS_Store
`,

    'README.md': `# {{projectName}}

RESTful API built with Ruby on Rails, featuring JWT authentication, comprehensive testing, and production-ready configurations.

## Features

- RESTful API with Rails API-only mode
- JWT authentication with refresh tokens
- PostgreSQL database with Active Record
- Comprehensive validation and error handling
- API documentation with Swagger/OpenAPI
- Background job processing with Sidekiq
- Request throttling with Rack::Attack
- Pagination with Kaminari
- Testing with RSpec and FactoryBot
- Code quality with RuboCop
- Docker and Docker Compose setup
- Health check endpoints

## Prerequisites

- Ruby 3.3.0
- PostgreSQL 14+
- Redis 7+
- Docker and Docker Compose (optional)

## Quick Start

### Using Docker

1. Clone the repository:
   \`\`\`bash
   git clone <repository-url>
   cd {{projectName}}
   \`\`\`

2. Copy environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Start with Docker Compose:
   \`\`\`bash
   docker-compose up
   \`\`\`

The API will be available at http://localhost:3000.

### Local Development

1. Install dependencies:
   \`\`\`bash
   bundle install
   \`\`\`

2. Setup database:
   \`\`\`bash
   rails db:create
   rails db:migrate
   rails db:seed
   \`\`\`

3. Start the server:
   \`\`\`bash
   rails server
   \`\`\`

## API Documentation

After starting the server, visit:
- Swagger UI: http://localhost:3000/api-docs

## Testing

Run the test suite:
\`\`\`bash
bundle exec rspec
\`\`\`

With coverage:
\`\`\`bash
COVERAGE=true bundle exec rspec
\`\`\`

## Code Quality

Run RuboCop:
\`\`\`bash
bundle exec rubocop
\`\`\`

Auto-fix issues:
\`\`\`bash
bundle exec rubocop -a
\`\`\`

## Background Jobs

Start Sidekiq:
\`\`\`bash
bundle exec sidekiq
\`\`\`

Monitor jobs at: http://localhost:3000/sidekiq (in development)

## API Endpoints

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login
- \`POST /api/v1/auth/refresh\` - Refresh token
- \`DELETE /api/v1/auth/logout\` - Logout

### Users
- \`GET /api/v1/users\` - List users
- \`GET /api/v1/users/:id\` - Get user
- \`PATCH /api/v1/users/:id\` - Update user
- \`DELETE /api/v1/users/:id\` - Delete user
- \`PATCH /api/v1/users/:id/activate\` - Activate user
- \`PATCH /api/v1/users/:id/deactivate\` - Deactivate user

### Products
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product
- \`GET /api/v1/products/search\` - Search products
- \`POST /api/v1/products\` - Create product
- \`PATCH /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

### Orders
- \`GET /api/v1/orders\` - List orders
- \`GET /api/v1/orders/:id\` - Get order
- \`POST /api/v1/orders\` - Create order
- \`PATCH /api/v1/orders/:id/cancel\` - Cancel order
- \`PATCH /api/v1/orders/:id/complete\` - Complete order

## License

[Your License]
`
  }
};