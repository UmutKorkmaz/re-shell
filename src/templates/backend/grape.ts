import { BackendTemplate } from '../types';

export const grapeTemplate: BackendTemplate = {
  id: 'grape',
  name: 'grape',
  displayName: 'Grape Framework',
  description: 'REST-like API framework for Ruby with advanced routing, parameter validation, and automatic documentation',
  language: 'ruby',
  framework: 'grape',
  version: '2.0.0',
  tags: ['ruby', 'grape', 'api', 'rest', 'microservices', 'json', 'swagger'],
  port: 9292,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'documentation', 'testing'],
  
  files: {
    // Gemfile
    'Gemfile': `source 'https://rubygems.org'

ruby '3.3.0'

# API framework
gem 'grape', '~> 2.0'
gem 'grape-entity', '~> 1.0'
gem 'grape-swagger', '~> 2.0'
gem 'grape-swagger-entity', '~> 0.5'

# Web server
gem 'puma', '~> 6.4'
gem 'rack', '~> 3.0'

# Database
gem 'activerecord', '~> 7.1.2'
gem 'pg', '~> 1.5'
gem 'rake', '~> 13.1'

# Authentication
gem 'bcrypt', '~> 3.1.19'
gem 'jwt', '~> 2.7'
gem 'rack-jwt', '~> 0.4'

# JSON
gem 'json', '~> 2.7'
gem 'multi_json', '~> 1.15'
gem 'oj', '~> 3.16'

# Validation
gem 'dry-validation', '~> 1.10'
gem 'dry-types', '~> 1.7'

# Environment
gem 'dotenv', '~> 2.8'

# Logging
gem 'grape_logging', '~> 1.8'
gem 'logger', '~> 1.6'

# CORS
gem 'rack-cors', '~> 2.0'

# Rate limiting
gem 'rack-attack', '~> 6.7'

# Redis
gem 'redis', '~> 5.0'
gem 'hiredis', '~> 0.6'
gem 'connection_pool', '~> 2.4'

# Background jobs
gem 'sidekiq', '~> 7.2'

# Pagination
gem 'grape-kaminari', '~> 0.4'
gem 'kaminari', '~> 1.2'

# Caching
gem 'grape-cache', '~> 0.1'
gem 'redis-rack-cache', '~> 2.2'

# Health checks
gem 'health_check', '~> 3.1'

# Error tracking
gem 'grape-sentry', '~> 0.4'

group :development do
  gem 'rerun', '~> 0.14'
  gem 'grape-reload', '~> 0.1'
end

group :test do
  gem 'rspec', '~> 3.12'
  gem 'rack-test', '~> 2.1'
  gem 'factory_bot', '~> 6.4'
  gem 'faker', '~> 3.2'
  gem 'database_cleaner-active_record', '~> 2.1'
  gem 'simplecov', '~> 0.22', require: false
  gem 'shoulda-matchers', '~> 5.3'
  gem 'timecop', '~> 0.9'
  gem 'webmock', '~> 3.19'
  gem 'vcr', '~> 6.2'
end

group :development, :test do
  gem 'pry', '~> 0.14'
  gem 'rubocop', '~> 1.59', require: false
  gem 'rubocop-rspec', '~> 2.25', require: false
  gem 'rubocop-grape', '~> 0.1', require: false
end
`,

    // Ruby version
    '.ruby-version': `3.3.0
`,

    // Rakefile
    'Rakefile': `require 'bundler/setup'
require 'rake'
require 'active_record'

# Load all rake tasks
Dir.glob('lib/tasks/*.rake').each { |r| import r }

# Default task
task default: :spec

# Load environment
task :environment do
  require_relative 'config/environment'
end

# Database tasks
namespace :db do
  desc "Create the database"
  task create: :environment do
    ActiveRecord::Base.establish_connection(DATABASE_CONFIG.merge('database' => 'postgres'))
    ActiveRecord::Base.connection.create_database(DATABASE_CONFIG['database'])
    puts "Database created."
  end

  desc "Drop the database"
  task drop: :environment do
    ActiveRecord::Base.establish_connection(DATABASE_CONFIG.merge('database' => 'postgres'))
    ActiveRecord::Base.connection.drop_database(DATABASE_CONFIG['database'])
    puts "Database dropped."
  end

  desc "Migrate the database"
  task migrate: :environment do
    ActiveRecord::MigrationContext.new('db/migrate').migrate
    Rake::Task["db:schema:dump"].invoke
    puts "Database migrated."
  end

  desc "Rollback the database"
  task rollback: :environment do
    ActiveRecord::MigrationContext.new('db/migrate').rollback
    Rake::Task["db:schema:dump"].invoke
    puts "Database rolled back."
  end

  namespace :schema do
    desc "Create a db/schema.rb file"
    task dump: :environment do
      require 'active_record/schema_dumper'
      File.open('db/schema.rb', 'w:utf-8') do |file|
        ActiveRecord::SchemaDumper.dump(ActiveRecord::Base.connection, file)
      end
    end
  end

  desc "Reset the database"
  task reset: [:drop, :create, :migrate]
end

# Test tasks
begin
  require 'rspec/core/rake_task'
  RSpec::Core::RakeTask.new(:spec)
rescue LoadError
  # RSpec not available in production
end
`,

    // config.ru
    'config.ru': `require_relative 'config/environment'

# Middleware stack
use Rack::Cors do
  allow do
    origins '*'
    resource '*', 
      headers: :any, 
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ['X-Total-Count', 'X-Page', 'X-Per-Page']
  end
end

use Rack::Attack
use ActiveRecord::ConnectionAdapters::ConnectionManagement

# Health check endpoint
map '/health' do
  run lambda { |env| [200, {'Content-Type' => 'text/plain'}, ['OK']] }
end

# API endpoints
map '/api' do
  run API::Root
end

# Swagger documentation
map '/swagger' do
  run Rack::Cascade.new([
    API::SwaggerUI,
    API::Root
  ])
end

# Sidekiq Web UI (development only)
if ENV['RACK_ENV'] == 'development'
  require 'sidekiq/web'
  map '/sidekiq' do
    run Sidekiq::Web
  end
end
`,

    // config/environment.rb
    'config/environment.rb': `ENV['RACK_ENV'] ||= 'development'

require 'bundler/setup'
Bundler.require(:default, ENV['RACK_ENV'])

# Load environment variables
Dotenv.load(".env.\${ENV['RACK_ENV']}", '.env')

# Require all Ruby files
Dir[File.expand_path('../lib/**/*.rb', __dir__)].sort.each { |f| require f }
Dir[File.expand_path('../app/**/*.rb', __dir__)].sort.each { |f| require f }

# Configure database
DATABASE_CONFIG = YAML.load_file('config/database.yml')[ENV['RACK_ENV']]
ActiveRecord::Base.establish_connection(DATABASE_CONFIG)
ActiveRecord::Base.logger = Logger.new(STDOUT) if ENV['RACK_ENV'] == 'development'

# Configure Redis
REDIS_CONFIG = {
  url: ENV['REDIS_URL'] || 'redis://localhost:6379/0',
  driver: :hiredis
}

$redis = ConnectionPool::Wrapper.new(size: 10, timeout: 3) do
  Redis.new(REDIS_CONFIG)
end

# Configure Sidekiq
Sidekiq.configure_server do |config|
  config.redis = REDIS_CONFIG
end

Sidekiq.configure_client do |config|
  config.redis = REDIS_CONFIG
end

# Configure Rack::Attack
Rack::Attack.cache.store = ActiveSupport::Cache::RedisStore.new(REDIS_CONFIG[:url])

# Throttle configuration
Rack::Attack.throttle('api/ip', limit: 300, period: 5.minutes) do |req|
  req.ip if req.path.start_with?('/api')
end

Rack::Attack.throttle('api/aggressive', limit: 5, period: 1.minute) do |req|
  req.ip if req.path.start_with?('/api') && req.post?
end

# Configure OJ for JSON parsing
Oj.default_options = {
  mode: :compat,
  time_format: :ruby,
  use_to_json: true
}

MultiJson.use :oj
`,

    // config/database.yml
    'config/database.yml': `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("DATABASE_POOL") { 5 } %>
  timeout: 5000

development:
  <<: *default
  database: <%= ENV['DATABASE_NAME'] || 'myapp_development' %>
  username: <%= ENV['DATABASE_USER'] || 'postgres' %>
  password: <%= ENV['DATABASE_PASSWORD'] %>
  host: <%= ENV['DATABASE_HOST'] || 'localhost' %>
  port: <%= ENV['DATABASE_PORT'] || 5432 %>

test:
  <<: *default
  database: <%= ENV['DATABASE_NAME'] || 'myapp_test' %>
  username: <%= ENV['DATABASE_USER'] || 'postgres' %>
  password: <%= ENV['DATABASE_PASSWORD'] %>
  host: <%= ENV['DATABASE_HOST'] || 'localhost' %>
  port: <%= ENV['DATABASE_PORT'] || 5432 %>

production:
  <<: *default
  database: <%= ENV['DATABASE_NAME'] %>
  username: <%= ENV['DATABASE_USER'] %>
  password: <%= ENV['DATABASE_PASSWORD'] %>
  host: <%= ENV['DATABASE_HOST'] %>
  port: <%= ENV['DATABASE_PORT'] || 5432 %>
`,

    // app/api/root.rb
    'app/api/root.rb': `module API
  class Root < Grape::API
    format :json
    prefix :v1
    
    # Global exception handling
    rescue_from :all do |e|
      if ENV['RACK_ENV'] == 'development'
        error!({ error: e.message, backtrace: e.backtrace }, 500)
      else
        error!({ error: 'Internal Server Error' }, 500)
      end
    end

    rescue_from ActiveRecord::RecordNotFound do |e|
      error!({ error: 'Record not found' }, 404)
    end

    rescue_from Grape::Exceptions::ValidationErrors do |e|
      error!({ error: e.full_messages }, 400)
    end

    # Helpers
    helpers AuthHelpers
    helpers PaginationHelpers

    # Mount APIs
    mount API::Auth
    mount API::Users
    mount API::Products
    mount API::Orders
    mount API::Health

    # Swagger documentation
    add_swagger_documentation(
      api_version: 'v1',
      hide_documentation_path: true,
      mount_path: '/swagger_doc',
      info: {
        title: 'My API',
        description: 'API documentation for My Application',
        contact_name: 'API Support',
        contact_email: 'api@example.com',
        license: 'MIT',
        license_url: 'https://opensource.org/licenses/MIT'
      }
    )
  end

  # Swagger UI for development
  class SwaggerUI < Grape::API
    format :html
    
    get '/' do
      content_type 'text/html'
      <<-HTML
        <!DOCTYPE html>
        <html>
        <head>
          <title>API Documentation</title>
          <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css">
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js"></script>
          <script>
            window.onload = function() {
              SwaggerUIBundle({
                url: "/api/v1/swagger_doc",
                dom_id: '#swagger-ui',
                presets: [SwaggerUIBundle.presets.apis],
                layout: "BaseLayout"
              });
            }
          </script>
        </body>
        </html>
      HTML
    end
  end
end
`,

    // app/api/auth.rb
    'app/api/auth.rb': `module API
  class Auth < Grape::API
    resource :auth do
      desc 'User login' do
        detail 'Authenticate user and return JWT token'
        tags ['Authentication']
      end
      params do
        requires :email, type: String, desc: 'User email'
        requires :password, type: String, desc: 'User password'
      end
      post :login do
        user = User.find_by(email: params[:email])
        
        if user&.authenticate(params[:password])
          token = JWT.encode(
            {
              user_id: user.id,
              email: user.email,
              exp: 24.hours.from_now.to_i
            },
            ENV['JWT_SECRET'] || 'secret',
            'HS256'
          )
          
          { token: token, user: UserEntity.new(user) }
        else
          error!({ error: 'Invalid credentials' }, 401)
        end
      end

      desc 'User registration' do
        detail 'Create a new user account'
        tags ['Authentication']
      end
      params do
        requires :email, type: String, desc: 'User email'
        requires :password, type: String, desc: 'User password'
        requires :password_confirmation, type: String, desc: 'Password confirmation'
        optional :name, type: String, desc: 'User name'
      end
      post :register do
        user = User.new(declared(params))
        
        if user.save
          token = JWT.encode(
            {
              user_id: user.id,
              email: user.email,
              exp: 24.hours.from_now.to_i
            },
            ENV['JWT_SECRET'] || 'secret',
            'HS256'
          )
          
          { token: token, user: UserEntity.new(user) }
        else
          error!({ errors: user.errors.full_messages }, 422)
        end
      end

      desc 'Refresh token' do
        detail 'Get a new JWT token'
        tags ['Authentication']
      end
      get :refresh do
        authenticate!
        
        token = JWT.encode(
          {
            user_id: current_user.id,
            email: current_user.email,
            exp: 24.hours.from_now.to_i
          },
          ENV['JWT_SECRET'] || 'secret',
          'HS256'
        )
        
        { token: token }
      end

      desc 'User profile' do
        detail 'Get current user profile'
        tags ['Authentication']
      end
      get :profile do
        authenticate!
        UserEntity.new(current_user)
      end
    end
  end
end
`,

    // app/api/users.rb
    'app/api/users.rb': `module API
  class Users < Grape::API
    before { authenticate! }
    
    resource :users do
      desc 'List all users' do
        detail 'Get paginated list of users'
        tags ['Users']
        paginate per_page: 20, max_per_page: 100
      end
      params do
        optional :search, type: String, desc: 'Search by name or email'
        optional :role, type: String, values: User::ROLES, desc: 'Filter by role'
        use :pagination
      end
      get do
        users = User.all
        users = users.search(params[:search]) if params[:search]
        users = users.where(role: params[:role]) if params[:role]
        
        paginate(users, UserEntity)
      end

      desc 'Get a user' do
        detail 'Get user by ID'
        tags ['Users']
      end
      params do
        requires :id, type: Integer, desc: 'User ID'
      end
      get ':id' do
        user = User.find(params[:id])
        UserEntity.new(user)
      end

      desc 'Create a user' do
        detail 'Create a new user (admin only)'
        tags ['Users']
      end
      params do
        requires :email, type: String, desc: 'User email'
        requires :password, type: String, desc: 'User password'
        optional :name, type: String, desc: 'User name'
        optional :role, type: String, values: User::ROLES, desc: 'User role'
      end
      post do
        authorize_admin!
        
        user = User.new(declared(params))
        if user.save
          UserEntity.new(user)
        else
          error!({ errors: user.errors.full_messages }, 422)
        end
      end

      desc 'Update a user' do
        detail 'Update user details'
        tags ['Users']
      end
      params do
        requires :id, type: Integer, desc: 'User ID'
        optional :name, type: String, desc: 'User name'
        optional :email, type: String, desc: 'User email'
        optional :role, type: String, values: User::ROLES, desc: 'User role'
      end
      patch ':id' do
        user = User.find(params[:id])
        authorize_user!(user)
        
        if user.update(declared(params, include_missing: false))
          UserEntity.new(user)
        else
          error!({ errors: user.errors.full_messages }, 422)
        end
      end

      desc 'Delete a user' do
        detail 'Delete a user (admin only)'
        tags ['Users']
      end
      params do
        requires :id, type: Integer, desc: 'User ID'
      end
      delete ':id' do
        authorize_admin!
        
        user = User.find(params[:id])
        user.destroy
        status 204
      end
    end
  end
end
`,

    // app/helpers/auth_helpers.rb
    'app/helpers/auth_helpers.rb': `module AuthHelpers
  def authenticate!
    error!('Unauthorized', 401) unless current_user
  end

  def current_user
    return @current_user if defined?(@current_user)
    
    token = headers['Authorization']&.split(' ')&.last
    return @current_user = nil unless token
    
    begin
      payload = JWT.decode(
        token,
        ENV['JWT_SECRET'] || 'secret',
        true,
        algorithm: 'HS256'
      ).first
      
      @current_user = User.find_by(id: payload['user_id'])
    rescue JWT::DecodeError
      @current_user = nil
    end
  end

  def authorize_admin!
    error!('Forbidden', 403) unless current_user&.admin?
  end

  def authorize_user!(user)
    error!('Forbidden', 403) unless current_user&.admin? || current_user == user
  end
end
`,

    // app/helpers/pagination_helpers.rb
    'app/helpers/pagination_helpers.rb': `module PaginationHelpers
  extend Grape::API::Helpers

  params :pagination do
    optional :page, type: Integer, default: 1, desc: 'Page number'
    optional :per_page, type: Integer, default: 20, desc: 'Items per page'
  end

  def paginate(collection, entity_class)
    collection = collection.page(params[:page]).per(params[:per_page])
    
    header 'X-Total-Count', collection.total_count.to_s
    header 'X-Page', collection.current_page.to_s
    header 'X-Per-Page', collection.limit_value.to_s
    header 'X-Total-Pages', collection.total_pages.to_s
    
    present collection, with: entity_class
  end
end
`,

    // app/models/user.rb
    'app/models/user.rb': `class User < ActiveRecord::Base
  has_secure_password
  
  ROLES = %w[user admin moderator].freeze
  
  # Associations
  has_many :orders, dependent: :destroy
  
  # Validations
  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, length: { minimum: 6 }, if: :password_required?
  validates :role, inclusion: { in: ROLES }
  
  # Scopes
  scope :search, ->(query) { where('name ILIKE ? OR email ILIKE ?', "%#{query}%", "%#{query}%") }
  scope :admins, -> { where(role: 'admin') }
  scope :active, -> { where(active: true) }
  
  # Callbacks
  before_validation :normalize_email
  before_create :set_default_role
  
  # Methods
  def admin?
    role == 'admin'
  end
  
  def moderator?
    role == 'moderator'
  end
  
  private
  
  def normalize_email
    self.email = email&.downcase&.strip
  end
  
  def set_default_role
    self.role ||= 'user'
  end
  
  def password_required?
    new_record? || password.present?
  end
end
`,

    // app/entities/user_entity.rb
    'app/entities/user_entity.rb': `class UserEntity < Grape::Entity
  expose :id
  expose :email
  expose :name
  expose :role
  expose :active
  expose :created_at
  expose :updated_at
  
  # Conditional exposures
  expose :admin?, as: :is_admin, if: lambda { |user, options| options[:current_user]&.admin? }
  expose :orders_count, if: lambda { |user, options| options[:include_stats] } do |user|
    user.orders.count
  end
end
`,

    // db/migrate/001_create_users.rb
    'db/migrate/001_create_users.rb': `class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :name
      t.string :role, default: 'user'
      t.boolean :active, default: true
      
      t.timestamps
    end
    
    add_index :users, :email, unique: true
    add_index :users, :role
    add_index :users, :active
  end
end
`,

    // spec/spec_helper.rb
    'spec/spec_helper.rb': `ENV['RACK_ENV'] = 'test'

require_relative '../config/environment'
require 'rspec'
require 'rack/test'
require 'factory_bot'
require 'faker'
require 'database_cleaner/active_record'

# Configure RSpec
RSpec.configure do |config|
  config.include Rack::Test::Methods
  config.include FactoryBot::Syntax::Methods
  
  config.before(:suite) do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation)
    FactoryBot.find_definitions
  end
  
  config.around(:each) do |example|
    DatabaseCleaner.cleaning do
      example.run
    end
  end
  
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
  config.warnings = true
  
  if config.files_to_run.one?
    config.default_formatter = "doc"
  end
  
  config.order = :random
  Kernel.srand config.seed
end

# Helper method for API testing
def app
  API::Root
end

# Helper for authentication
def auth_headers(user)
  token = JWT.encode(
    { user_id: user.id, email: user.email, exp: 1.hour.from_now.to_i },
    ENV['JWT_SECRET'] || 'secret',
    'HS256'
  )
  { 'Authorization' => "Bearer #{token}" }
end
`,

    // spec/api/auth_spec.rb
    'spec/api/auth_spec.rb': `require 'spec_helper'

RSpec.describe API::Auth do
  describe 'POST /api/v1/auth/login' do
    let!(:user) { create(:user, email: 'test@example.com', password: 'password123') }
    
    context 'with valid credentials' do
      it 'returns JWT token' do
        post '/api/v1/auth/login', email: 'test@example.com', password: 'password123'
        
        expect(last_response.status).to eq(201)
        expect(JSON.parse(last_response.body)).to have_key('token')
        expect(JSON.parse(last_response.body)).to have_key('user')
      end
    end
    
    context 'with invalid credentials' do
      it 'returns 401' do
        post '/api/v1/auth/login', email: 'test@example.com', password: 'wrong'
        
        expect(last_response.status).to eq(401)
        expect(JSON.parse(last_response.body)).to have_key('error')
      end
    end
  end
  
  describe 'POST /api/v1/auth/register' do
    context 'with valid data' do
      it 'creates user and returns token' do
        post '/api/v1/auth/register', {
          email: 'new@example.com',
          password: 'password123',
          password_confirmation: 'password123',
          name: 'New User'
        }
        
        expect(last_response.status).to eq(201)
        expect(JSON.parse(last_response.body)).to have_key('token')
        expect(User.find_by(email: 'new@example.com')).to be_present
      end
    end
    
    context 'with invalid data' do
      it 'returns validation errors' do
        post '/api/v1/auth/register', {
          email: 'invalid',
          password: 'short',
          password_confirmation: 'different'
        }
        
        expect(last_response.status).to eq(422)
        expect(JSON.parse(last_response.body)).to have_key('errors')
      end
    end
  end
  
  describe 'GET /api/v1/auth/profile' do
    let(:user) { create(:user) }
    
    context 'with valid token' do
      it 'returns user profile' do
        header 'Authorization', "Bearer #{auth_headers(user)['Authorization']}"
        get '/api/v1/auth/profile'
        
        expect(last_response.status).to eq(200)
        expect(JSON.parse(last_response.body)['email']).to eq(user.email)
      end
    end
    
    context 'without token' do
      it 'returns 401' do
        get '/api/v1/auth/profile'
        
        expect(last_response.status).to eq(401)
      end
    end
  end
end
`,

    // spec/factories/users.rb
    'spec/factories/users.rb': `FactoryBot.define do
  factory :user do
    email { Faker::Internet.email }
    password { 'password123' }
    name { Faker::Name.name }
    role { 'user' }
    active { true }
    
    trait :admin do
      role { 'admin' }
    end
    
    trait :moderator do
      role { 'moderator' }
    end
    
    trait :inactive do
      active { false }
    end
  end
end
`,

    // .env.example
    '.env.example': `# Application
RACK_ENV=development
PORT=9292

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=
DATABASE_NAME=myapp_development

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET=your-secret-key-here

# Logging
LOG_LEVEL=debug

# External APIs
SENTRY_DSN=

# Sidekiq
SIDEKIQ_CONCURRENCY=10
`,

    // Dockerfile
    'Dockerfile': `FROM ruby:3.3.0-alpine

# Install dependencies
RUN apk add --no-cache \\
    build-base \\
    postgresql-dev \\
    tzdata \\
    git

# Set working directory
WORKDIR /app

# Install gems
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local deployment 'true' && \\
    bundle config set --local without 'development test' && \\
    bundle install --jobs 4 --retry 3

# Copy application
COPY . .

# Create non-root user
RUN addgroup -g 1000 -S app && \\
    adduser -u 1000 -S app -G app && \\
    chown -R app:app /app

USER app

# Expose port
EXPOSE 9292

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
  CMD curl -f http://localhost:9292/health || exit 1

# Run the application
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
`,

    // docker-compose.yml
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "9292:9292"
    environment:
      - RACK_ENV=development
      - DATABASE_HOST=db
      - DATABASE_USER=postgres
      - DATABASE_PASSWORD=postgres
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    volumes:
      - .:/app
      - bundle:/usr/local/bundle
    command: bundle exec rerun 'rackup -p 9292 -o 0.0.0.0'

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=myapp_development
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  sidekiq:
    build: .
    depends_on:
      - db
      - redis
    environment:
      - RACK_ENV=development
      - DATABASE_HOST=db
      - DATABASE_USER=postgres
      - DATABASE_PASSWORD=postgres
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/app
      - bundle:/usr/local/bundle
    command: bundle exec sidekiq

volumes:
  postgres_data:
  redis_data:
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

    // README.md
    'README.md': `# Grape API Application

A RESTful API built with Grape framework for Ruby.

## Features

- 🍇 Grape framework for API development
- 🔐 JWT authentication
- 📝 Swagger API documentation
- 🗄️ PostgreSQL with ActiveRecord
- 🔄 Background jobs with Sidekiq
- ✅ RSpec testing suite
- 🐳 Docker support
- 📊 Request rate limiting
- 🌐 CORS support
- 📄 Pagination with headers

## Prerequisites

- Ruby 3.3.0
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

## Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd <project-directory>
\`\`\`

2. Install dependencies:
\`\`\`bash
bundle install
\`\`\`

3. Setup environment:
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

4. Setup database:
\`\`\`bash
bundle exec rake db:create
bundle exec rake db:migrate
\`\`\`

## Running the Application

### Development

\`\`\`bash
# Run with auto-reload
bundle exec rerun 'rackup -p 9292'

# Or without auto-reload
bundle exec rackup -p 9292
\`\`\`

### Production

\`\`\`bash
bundle exec puma -C config/puma.rb
\`\`\`

### Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

When running in development, Swagger documentation is available at:
http://localhost:9292/swagger

## Testing

\`\`\`bash
# Run all tests
bundle exec rspec

# Run with coverage
COVERAGE=true bundle exec rspec

# Run specific test
bundle exec rspec spec/api/users_spec.rb
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/v1/auth/login\` - User login
- \`POST /api/v1/auth/register\` - User registration
- \`GET /api/v1/auth/refresh\` - Refresh JWT token
- \`GET /api/v1/auth/profile\` - Get current user profile

### Users
- \`GET /api/v1/users\` - List users (paginated)
- \`GET /api/v1/users/:id\` - Get user details
- \`POST /api/v1/users\` - Create user (admin only)
- \`PATCH /api/v1/users/:id\` - Update user
- \`DELETE /api/v1/users/:id\` - Delete user (admin only)

## Background Jobs

Run Sidekiq worker:
\`\`\`bash
bundle exec sidekiq
\`\`\`

## Code Quality

\`\`\`bash
# Run RuboCop
bundle exec rubocop

# Auto-correct offenses
bundle exec rubocop -A
\`\`\`

## Deployment

1. Set production environment variables
2. Precompile assets (if any)
3. Run database migrations
4. Start the application with Puma

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License
`,

    // config/puma.rb
    'config/puma.rb': `# Puma configuration file

# Threads
threads_count = ENV.fetch("RAILS_MAX_THREADS", 5)
threads threads_count, threads_count

# Port
port ENV.fetch("PORT", 9292)

# Environment
environment ENV.fetch("RACK_ENV", "development")

# Workers (in production)
workers ENV.fetch("WEB_CONCURRENCY", 2) if ENV["RACK_ENV"] == "production"

# Preload app for performance
preload_app! if ENV["RACK_ENV"] == "production"

# Allow puma to be restarted by \`rails restart\` command
plugin :tmp_restart

on_worker_boot do
  # Reconnect to database
  ActiveRecord::Base.establish_connection if defined?(ActiveRecord)
  
  # Reconnect to Redis
  $redis.client.reconnect if defined?($redis)
end
`,

    // .rubocop.yml
    '.rubocop.yml': `require:
  - rubocop-rspec
  - rubocop-grape

AllCops:
  NewCops: enable
  TargetRubyVersion: 3.3
  Exclude:
    - 'db/schema.rb'
    - 'vendor/**/*'
    - 'bin/**/*'

Style/Documentation:
  Enabled: false

Style/FrozenStringLiteralComment:
  Enabled: false

Metrics/BlockLength:
  Exclude:
    - 'spec/**/*'
    - 'app/api/**/*'

Metrics/MethodLength:
  Max: 20

Metrics/ClassLength:
  Max: 200

Layout/LineLength:
  Max: 120

RSpec/ExampleLength:
  Max: 20

RSpec/MultipleExpectations:
  Max: 5
`,

    // .gitignore
    '.gitignore': `# Ruby
*.gem
*.rbc
/.config
/coverage/
/InstalledFiles
/pkg/
/spec/reports/
/spec/examples.txt
/test/tmp/
/test/version_tmp/
/tmp/

# Bundler
/.bundle/
/vendor/bundle
/lib/bundler/man/

# Environment
.env
.env.*
!.env.example

# Database
/db/*.sqlite3
/db/*.sqlite3-journal
/db/*.sqlite3-*

# Logs
/log/*
!/log/.keep
*.log

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# Testing
/coverage/
.rspec_status

# Docker
.dockerignore
docker-compose.override.yml
`
  }
};