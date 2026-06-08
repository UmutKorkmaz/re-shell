import { BackendTemplate } from '../types';

export const sinatraTemplate: BackendTemplate = {
  id: 'sinatra',
  name: 'sinatra',
  displayName: 'Sinatra',
  description: 'Lightweight Ruby web framework for building APIs and microservices with minimal overhead',
  language: 'ruby',
  framework: 'sinatra',
  version: '3.1.0',
  tags: ['ruby', 'sinatra', 'api', 'microservices', 'lightweight', 'rest', 'minimal'],
  port: 4567,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'documentation', 'testing'],
  
  files: {
    // Gemfile
    'Gemfile': `source 'https://rubygems.org'

ruby '3.3.0'

# Web framework
gem 'sinatra', '~> 3.1.0'
gem 'sinatra-contrib', '~> 3.1.0'
gem 'puma', '~> 6.4'

# Database
gem 'activerecord', '~> 7.1.2'
gem 'sinatra-activerecord', '~> 2.0'
gem 'pg', '~> 1.5'
gem 'rake', '~> 13.1'

# Authentication
gem 'bcrypt', '~> 3.1.19'
gem 'jwt', '~> 2.7'

# JSON
gem 'json', '~> 2.7'
gem 'multi_json', '~> 1.15'

# Validation
gem 'sinatra-param', '~> 1.6'

# Environment
gem 'dotenv', '~> 2.8'

# Logging
gem 'sinatra-logger', '~> 0.3'

# CORS
gem 'sinatra-cross_origin', '~> 0.4'

# Redis
gem 'redis', '~> 5.0'
gem 'hiredis', '~> 0.6'

# Background jobs
gem 'sidekiq', '~> 7.2'
gem 'sinatra-sidekiq', '~> 1.0'

# Pagination
gem 'will_paginate', '~> 4.0'
gem 'will_paginate-sinatra', '~> 1.0'

# API Documentation
gem 'sinatra-swagger-exposer', '~> 0.5'

# Rate limiting
gem 'rack-throttle', '~> 0.7'

# Health checks
gem 'health_check', '~> 3.1'

group :development do
  gem 'rerun', '~> 0.14'
  gem 'tux', '~> 0.3'
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
end
`,

    // Ruby version
    '.ruby-version': `3.3.0
`,

    // Main application file
    'app.rb': `require 'sinatra/base'
require 'sinatra/json'
require 'sinatra/activerecord'
require 'sinatra/namespace'
require 'sinatra/cross_origin'
require 'sinatra/custom_logger'
require 'sinatra/param'
require 'sinatra/swagger-exposer/swagger-exposer'
require 'bcrypt'
require 'jwt'
require 'json'
require 'logger'
require 'redis'

# Load environment variables
require 'dotenv/load'

# Load application files
Dir['./config/*.rb'].sort.each { |file| require file }
Dir['./app/models/*.rb'].sort.each { |file| require file }
Dir['./app/helpers/*.rb'].sort.each { |file| require file }
Dir['./app/controllers/*.rb'].sort.each { |file| require file }

class {{projectName}}App < Sinatra::Base
  register Sinatra::ActiveRecordExtension
  register Sinatra::Namespace
  register Sinatra::CrossOrigin
  register Sinatra::Swagger::Exposer
  
  helpers Sinatra::Param
  helpers Sinatra::CustomLogger
  helpers AuthHelper
  helpers JsonHelper
  
  # Configuration
  configure do
    set :app_name, '{{projectName}}'
    set :server, :puma
    set :database_file, 'config/database.yml'
    set :show_exceptions, false
    set :raise_errors, false
    set :dump_errors, true
    set :logging, true
    
    # Logger
    logger = Logger.new(STDOUT)
    logger.level = Logger::INFO
    set :logger, logger
    
    # CORS
    enable :cross_origin
    set :allow_origin, ENV.fetch('CORS_ORIGINS', '*').split(',')
    set :allow_methods, [:get, :post, :put, :patch, :delete, :options]
    set :allow_headers, ['Content-Type', 'Authorization', 'X-Requested-With']
    set :expose_headers, ['X-Total-Count', 'X-Total-Pages', 'X-Current-Page']
    
    # JSON
    set :json_encoder, :to_json
    
    # Redis
    set :redis, Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/0'))
  end
  
  configure :development do
    set :show_exceptions, true
    logger.level = Logger::DEBUG
  end
  
  configure :production do
    logger.level = Logger::INFO
  end
  
  # Swagger documentation
  general_info(
    info: {
      version: '1.0.0',
      title: '{{projectName}} API',
      description: 'Lightweight API built with Sinatra'
    }
  )
  
  # Error handling
  error ActiveRecord::RecordNotFound do
    error_response(404, 'Record not found')
  end
  
  error ActiveRecord::RecordInvalid do |e|
    error_response(422, 'Validation failed', errors: e.record.errors.full_messages)
  end
  
  error Sinatra::Param::InvalidParameterError do |e|
    error_response(400, 'Invalid parameter', error: e.message)
  end
  
  error JWT::DecodeError do
    error_response(401, 'Invalid token')
  end
  
  error do |e|
    logger.error "#{e.class}: #{e.message}"
    logger.error e.backtrace.join("\\n")
    error_response(500, 'Internal server error')
  end
  
  # Middleware
  use Rack::Deflater
  use Rack::Throttle::Minute, max: 60, cache: settings.redis, key_prefix: :throttle
  
  # Before filters
  before do
    content_type :json
    
    # Log request
    logger.info "#{request.request_method} #{request.path_info} - #{request.ip}"
  end
  
  # Root endpoint
  get '/' do
    json(
      name: settings.app_name,
      version: '1.0.0',
      status: 'running',
      timestamp: Time.now.iso8601
    )
  end
  
  # Health check
  get '/health' do
    health = {
      status: 'ok',
      timestamp: Time.now.iso8601,
      database: database_healthy?,
      redis: redis_healthy?,
      version: '1.0.0'
    }
    
    status health[:database] && health[:redis] ? 200 : 503
    json health
  end
  
  # Mount controllers
  use AuthController
  use UsersController
  use ProductsController
  use OrdersController
  
  private
  
  def database_healthy?
    ActiveRecord::Base.connection.active?
  rescue StandardError
    false
  end
  
  def redis_healthy?
    settings.redis.ping == 'PONG'
  rescue StandardError
    false
  end
  
  def error_response(status_code, message, additional = {})
    halt status_code, json({ error: message }.merge(additional))
  end
end
`,

    // Config files
    'config.ru': `require './app'

run {{projectName}}App
`,

    'Rakefile': `require 'sinatra/activerecord'
require 'sinatra/activerecord/rake'
require './app'

namespace :db do
  task :load_config do
    require './app'
  end
end

desc "Run the application"
task :run do
  exec "bundle exec puma"
end

desc "Run the console"
task :console do
  require 'pry'
  require './app'
  Pry.start
end

desc "Run tests"
task :test do
  exec "bundle exec rspec"
end

desc "Run linter"
task :lint do
  exec "bundle exec rubocop"
end
`,

    'config/database.yml': `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  timeout: 5000

development:
  <<: *default
  database: {{projectName}}_development
  username: <%= ENV.fetch("DATABASE_USERNAME", "postgres") %>
  password: <%= ENV.fetch("DATABASE_PASSWORD", "") %>
  host: <%= ENV.fetch("DATABASE_HOST", "localhost") %>
  port: <%= ENV.fetch("DATABASE_PORT", 5432) %>

test:
  <<: *default
  database: {{projectName}}_test
  username: <%= ENV.fetch("DATABASE_USERNAME", "postgres") %>
  password: <%= ENV.fetch("DATABASE_PASSWORD", "") %>
  host: <%= ENV.fetch("DATABASE_HOST", "localhost") %>
  port: <%= ENV.fetch("DATABASE_PORT", 5432) %>

production:
  <<: *default
  database: {{projectName}}_production
  username: {{projectName}}
  password: <%= ENV["{{projectName}}_DATABASE_PASSWORD"] %>
  url: <%= ENV["DATABASE_URL"] %>
`,

    'config/puma.rb': `# Puma configuration file

max_threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
min_threads_count = ENV.fetch("RAILS_MIN_THREADS") { max_threads_count }
threads min_threads_count, max_threads_count

worker_timeout 3600 if ENV.fetch("RAILS_ENV", "development") == "development"

port ENV.fetch("PORT") { 4567 }

environment ENV.fetch("RACK_ENV") { "development" }

pidfile ENV.fetch("PIDFILE") { "tmp/pids/server.pid" }

workers ENV.fetch("WEB_CONCURRENCY") { 2 }

preload_app!

plugin :tmp_restart
`,

    // Helpers
    'app/helpers/auth_helper.rb': `module AuthHelper
  def jwt_encode(payload, exp = 24.hours.from_now)
    payload[:exp] = exp.to_i
    JWT.encode(payload, jwt_secret)
  end
  
  def jwt_decode(token)
    JWT.decode(token, jwt_secret)[0]
  rescue JWT::DecodeError
    nil
  end
  
  def jwt_secret
    ENV.fetch('JWT_SECRET', 'your-secret-key')
  end
  
  def authenticate!
    token = extract_token
    return halt_unauthorized unless token
    
    payload = jwt_decode(token)
    return halt_unauthorized unless payload
    
    @current_user = User.find_by(id: payload['user_id'])
    return halt_unauthorized unless @current_user && @current_user.active?
    
    @current_user
  rescue StandardError
    halt_unauthorized
  end
  
  def current_user
    @current_user
  end
  
  def extract_token
    auth_header = request.env['HTTP_AUTHORIZATION']
    return nil unless auth_header
    
    auth_header.split(' ').last
  end
  
  def halt_unauthorized
    halt 401, json(error: 'Unauthorized')
  end
  
  def admin_only!
    authenticate!
    halt 403, json(error: 'Forbidden') unless current_user.admin?
  end
end
`,

    'app/helpers/json_helper.rb': `module JsonHelper
  def json(data, status = 200)
    content_type :json
    status status
    
    if data.respond_to?(:to_json)
      data.to_json
    else
      JSON.generate(data)
    end
  end
  
  def parse_json_body
    request.body.rewind
    JSON.parse(request.body.read, symbolize_names: true)
  rescue JSON::ParserError
    halt 400, json(error: 'Invalid JSON')
  end
  
  def paginate(collection, page = 1, per_page = 20)
    page = [page.to_i, 1].max
    per_page = [[per_page.to_i, 100].min, 1].max
    
    total = collection.count
    collection = collection.limit(per_page).offset((page - 1) * per_page)
    
    headers['X-Total-Count'] = total.to_s
    headers['X-Total-Pages'] = ((total.to_f / per_page).ceil).to_s
    headers['X-Current-Page'] = page.to_s
    headers['X-Next-Page'] = (page < (total.to_f / per_page).ceil ? page + 1 : nil).to_s
    headers['X-Prev-Page'] = (page > 1 ? page - 1 : nil).to_s
    
    collection
  end
end
`,

    // Models
    'app/models/user.rb': `class User < ActiveRecord::Base
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
  before_create :set_defaults
  
  def admin?
    role == 'admin'
  end
  
  def moderator?
    role == 'moderator'
  end
  
  def as_json(options = {})
    super(options.merge(except: [:password_digest]))
  end
  
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

    'app/models/product.rb': `class Product < ActiveRecord::Base
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
  scope :search, ->(query) { where('name ILIKE ? OR description ILIKE ?', "%#{query}%", "%#{query}%") }
  
  # Callbacks
  before_validation :generate_sku, on: :create
  before_create :set_defaults
  
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

    'app/models/order.rb': `class Order < ActiveRecord::Base
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
  before_create :set_defaults
  before_save :calculate_total
  
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

    'app/models/order_item.rb': `class OrderItem < ActiveRecord::Base
  # Associations
  belongs_to :order
  belongs_to :product
  
  # Validations
  validates :quantity, presence: true, numericality: { greater_than: 0, only_integer: true }
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  
  # Callbacks
  before_validation :set_price
  
  def subtotal
    quantity * price
  end
  
  private
  
  def set_price
    self.price ||= product&.price
  end
end
`,

    // Controllers
    'app/controllers/application_controller.rb': `class ApplicationController < Sinatra::Base
  helpers AuthHelper
  helpers JsonHelper
  
  configure do
    set :show_exceptions, false
    set :raise_errors, false
  end
  
  before do
    content_type :json
  end
  
  error ActiveRecord::RecordNotFound do
    halt 404, json(error: 'Record not found')
  end
  
  error ActiveRecord::RecordInvalid do |e|
    halt 422, json(errors: e.record.errors.full_messages)
  end
end
`,

    'app/controllers/auth_controller.rb': `class AuthController < ApplicationController
  post '/api/v1/auth/register' do
    param :email, String, required: true, format: URI::MailTo::EMAIL_REGEXP
    param :password, String, required: true, min_length: 8
    param :name, String, required: true
    
    user = User.new(
      email: params[:email],
      password: params[:password],
      name: params[:name]
    )
    
    if user.save
      token = jwt_encode(user_id: user.id)
      refresh_token = jwt_encode({ user_id: user.id, type: 'refresh' }, 7.days.from_now)
      
      status 201
      json(
        user: user,
        access_token: token,
        refresh_token: refresh_token
      )
    else
      halt 422, json(errors: user.errors.full_messages)
    end
  end
  
  post '/api/v1/auth/login' do
    param :email, String, required: true
    param :password, String, required: true
    
    user = User.find_by(email: params[:email])
    
    if user&.authenticate(params[:password])
      if user.active?
        token = jwt_encode(user_id: user.id)
        refresh_token = jwt_encode({ user_id: user.id, type: 'refresh' }, 7.days.from_now)
        
        json(
          user: user,
          access_token: token,
          refresh_token: refresh_token
        )
      else
        halt 403, json(error: 'Account is inactive')
      end
    else
      halt 401, json(error: 'Invalid credentials')
    end
  end
  
  post '/api/v1/auth/refresh' do
    token = extract_token
    halt 401, json(error: 'Missing token') unless token
    
    payload = jwt_decode(token)
    halt 401, json(error: 'Invalid token') unless payload && payload['type'] == 'refresh'
    
    user = User.find_by(id: payload['user_id'])
    halt 401, json(error: 'User not found') unless user
    
    new_token = jwt_encode(user_id: user.id)
    json(access_token: new_token)
  end
  
  delete '/api/v1/auth/logout' do
    authenticate!
    # In a real app, you might want to blacklist the token
    json(message: 'Logged out successfully')
  end
end
`,

    'app/controllers/users_controller.rb': `class UsersController < ApplicationController
  before '/api/v1/users*' do
    authenticate!
  end
  
  get '/api/v1/users' do
    param :search, String
    param :role, String, in: %w[user admin moderator]
    param :page, Integer, default: 1, min: 1
    param :per_page, Integer, default: 20, min: 1, max: 100
    
    users = User.all
    users = users.where('name ILIKE ? OR email ILIKE ?', "%#{params[:search]}%", "%#{params[:search]}%") if params[:search]
    users = users.where(role: params[:role]) if params[:role]
    users = paginate(users, params[:page], params[:per_page])
    
    json(users: users)
  end
  
  get '/api/v1/users/:id' do
    user = User.find(params[:id])
    json(user)
  end
  
  put '/api/v1/users/:id' do
    user = User.find(params[:id])
    
    param :email, String, format: URI::MailTo::EMAIL_REGEXP
    param :name, String
    param :role, String, in: %w[user admin moderator]
    param :active, Boolean
    
    update_params = {}
    update_params[:email] = params[:email] if params.key?(:email)
    update_params[:name] = params[:name] if params.key?(:name)
    update_params[:role] = params[:role] if params.key?(:role)
    update_params[:active] = params[:active] if params.key?(:active)
    
    if user.update(update_params)
      json(user)
    else
      halt 422, json(errors: user.errors.full_messages)
    end
  end
  
  delete '/api/v1/users/:id' do
    user = User.find(params[:id])
    user.destroy
    status 204
  end
  
  patch '/api/v1/users/:id/activate' do
    user = User.find(params[:id])
    user.update(active: true)
    json(user)
  end
  
  patch '/api/v1/users/:id/deactivate' do
    user = User.find(params[:id])
    user.update(active: false)
    json(user)
  end
end
`,

    'app/controllers/products_controller.rb': `class ProductsController < ApplicationController
  before '/api/v1/products*' do
    authenticate! unless %w[GET].include?(request.request_method)
  end
  
  get '/api/v1/products' do
    param :search, String
    param :category, String
    param :min_price, Float, min: 0
    param :max_price, Float, min: 0
    param :page, Integer, default: 1, min: 1
    param :per_page, Integer, default: 20, min: 1, max: 100
    
    products = Product.active
    products = products.search(params[:search]) if params[:search]
    products = products.by_category(params[:category]) if params[:category]
    products = products.where('price >= ?', params[:min_price]) if params[:min_price]
    products = products.where('price <= ?', params[:max_price]) if params[:max_price]
    products = paginate(products, params[:page], params[:per_page])
    
    json(products: products)
  end
  
  get '/api/v1/products/:id' do
    product = Product.find(params[:id])
    json(product)
  end
  
  post '/api/v1/products' do
    param :name, String, required: true
    param :description, String
    param :price, Float, required: true, min: 0
    param :stock, Integer, required: true, min: 0
    param :category, String, required: true
    param :sku, String
    
    product = Product.new(
      name: params[:name],
      description: params[:description],
      price: params[:price],
      stock: params[:stock],
      category: params[:category],
      sku: params[:sku]
    )
    
    if product.save
      status 201
      json(product)
    else
      halt 422, json(errors: product.errors.full_messages)
    end
  end
  
  put '/api/v1/products/:id' do
    product = Product.find(params[:id])
    
    param :name, String
    param :description, String
    param :price, Float, min: 0
    param :stock, Integer, min: 0
    param :category, String
    param :sku, String
    param :active, Boolean
    
    update_params = {}
    %i[name description price stock category sku active].each do |attr|
      update_params[attr] = params[attr] if params.key?(attr)
    end
    
    if product.update(update_params)
      json(product)
    else
      halt 422, json(errors: product.errors.full_messages)
    end
  end
  
  delete '/api/v1/products/:id' do
    product = Product.find(params[:id])
    product.destroy
    status 204
  end
end
`,

    'app/controllers/orders_controller.rb': `class OrdersController < ApplicationController
  before '/api/v1/orders*' do
    authenticate!
  end
  
  get '/api/v1/orders' do
    param :status, String, in: %w[pending processing shipped delivered cancelled]
    param :page, Integer, default: 1, min: 1
    param :per_page, Integer, default: 20, min: 1, max: 100
    
    orders = current_user.orders
    orders = orders.by_status(params[:status]) if params[:status]
    orders = orders.recent
    orders = paginate(orders, params[:page], params[:per_page])
    
    json(orders: orders.map { |o| order_with_items(o) })
  end
  
  get '/api/v1/orders/:id' do
    order = current_user.orders.find(params[:id])
    json(order_with_items(order))
  end
  
  post '/api/v1/orders' do
    param :items, Array, required: true do |items|
      items.each do |item|
        item.param :product_id, Integer, required: true
        item.param :quantity, Integer, required: true, min: 1
      end
    end
    
    order = current_user.orders.build
    
    ActiveRecord::Base.transaction do
      order.save!
      
      params[:items].each do |item|
        product = Product.find(item[:product_id])
        
        unless product.update_stock!(item[:quantity])
          raise ActiveRecord::Rollback
        end
        
        order.order_items.create!(
          product: product,
          quantity: item[:quantity],
          price: product.price
        )
      end
      
      order.reload
    end
    
    status 201
    json(order_with_items(order))
  rescue ActiveRecord::Rollback
    halt 422, json(error: 'Insufficient stock for one or more products')
  end
  
  patch '/api/v1/orders/:id/cancel' do
    order = current_user.orders.find(params[:id])
    
    if order.cancel!
      json(order_with_items(order))
    else
      halt 422, json(error: 'Order cannot be cancelled')
    end
  end
  
  patch '/api/v1/orders/:id/complete' do
    admin_only!
    order = Order.find(params[:id])
    
    if order.complete!
      json(order_with_items(order))
    else
      halt 422, json(error: 'Order cannot be completed')
    end
  end
  
  private
  
  def order_with_items(order)
    order.as_json.merge(
      items: order.order_items.map do |item|
        item.as_json.merge(product: item.product)
      end
    )
  end
end
`,

    // Database migrations
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
    'db/seeds.rb': `require 'faker'

# Clear existing data
OrderItem.destroy_all
Order.destroy_all
Product.destroy_all
User.destroy_all

# Create admin user
admin = User.create!(
  email: 'admin@example.com',
  password: 'password123',
  name: 'Admin User',
  role: 'admin'
)

# Create regular users
5.times do |i|
  User.create!(
    email: "user#{i+1}@example.com",
    password: 'password123',
    name: Faker::Name.name,
    role: 'user'
  )
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

    // Test setup
    '.rspec': `--require spec_helper
--format documentation
--color
`,

    'spec/spec_helper.rb': `ENV['RACK_ENV'] = 'test'

require 'simplecov'
SimpleCov.start

require File.expand_path '../app.rb', __dir__
require 'rspec'
require 'rack/test'
require 'factory_bot'
require 'faker'
require 'database_cleaner/active_record'
require 'shoulda/matchers'
require 'timecop'
require 'webmock/rspec'
require 'vcr'

# Include test helpers
Dir['./spec/support/**/*.rb'].sort.each { |f| require f }

RSpec.configure do |config|
  config.include Rack::Test::Methods
  config.include FactoryBot::Syntax::Methods
  config.include RequestHelpers
  
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
  config.order = :random
  Kernel.srand config.seed
  
  # Database cleaner
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before(:each) do
    DatabaseCleaner.strategy = :transaction
  end

  config.before(:each) do
    DatabaseCleaner.start
  end

  config.after(:each) do
    DatabaseCleaner.clean
  end
end

# Configure Shoulda Matchers
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
  end
end

# Configure VCR
VCR.configure do |config|
  config.cassette_library_dir = "spec/vcr_cassettes"
  config.hook_into :webmock
  config.configure_rspec_metadata!
end

def app
  {{projectName}}App
end
`,

    'spec/support/request_helpers.rb': `module RequestHelpers
  def json_response
    JSON.parse(last_response.body, symbolize_names: true)
  end
  
  def auth_headers(user)
    token = JWT.encode({ user_id: user.id }, ENV.fetch('JWT_SECRET', 'your-secret-key'))
    { 'HTTP_AUTHORIZATION' => "Bearer #{token}" }
  end
  
  def post_json(path, data = {}, headers = {})
    post path, data.to_json, headers.merge('CONTENT_TYPE' => 'application/json')
  end
  
  def put_json(path, data = {}, headers = {})
    put path, data.to_json, headers.merge('CONTENT_TYPE' => 'application/json')
  end
  
  def patch_json(path, data = {}, headers = {})
    patch path, data.to_json, headers.merge('CONTENT_TYPE' => 'application/json')
  end
end
`,

    // Factories
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

    // Sample spec
    'spec/api/auth_spec.rb': `require 'spec_helper'

RSpec.describe 'Authentication API' do
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
          post_json '/api/v1/auth/register', valid_params
        }.to change(User, :count).by(1)
        
        expect(last_response.status).to eq(201)
        expect(json_response[:user][:email]).to eq('newuser@example.com')
        expect(json_response[:access_token]).to be_present
        expect(json_response[:refresh_token]).to be_present
      end
    end
    
    context 'with invalid parameters' do
      it 'returns error for missing email' do
        post_json '/api/v1/auth/register', valid_params.except(:email)
        
        expect(last_response.status).to eq(400)
        expect(json_response[:error]).to include('email')
      end
      
      it 'returns error for duplicate email' do
        create(:user, email: 'newuser@example.com')
        post_json '/api/v1/auth/register', valid_params
        
        expect(last_response.status).to eq(422)
        expect(json_response[:errors]).to include('Email has already been taken')
      end
    end
  end
  
  describe 'POST /api/v1/auth/login' do
    let!(:user) { create(:user, email: 'user@example.com', password: 'password123') }
    
    context 'with valid credentials' do
      it 'returns user data with tokens' do
        post_json '/api/v1/auth/login', { email: 'user@example.com', password: 'password123' }
        
        expect(last_response.status).to eq(200)
        expect(json_response[:user][:email]).to eq('user@example.com')
        expect(json_response[:access_token]).to be_present
        expect(json_response[:refresh_token]).to be_present
      end
    end
    
    context 'with invalid credentials' do
      it 'returns error for wrong password' do
        post_json '/api/v1/auth/login', { email: 'user@example.com', password: 'wrongpassword' }
        
        expect(last_response.status).to eq(401)
        expect(json_response[:error]).to eq('Invalid credentials')
      end
      
      it 'returns error for inactive account' do
        user.update(active: false)
        post_json '/api/v1/auth/login', { email: 'user@example.com', password: 'password123' }
        
        expect(last_response.status).to eq(403)
        expect(json_response[:error]).to eq('Account is inactive')
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

# Create non-root user
RUN addgroup -g 1000 -S app && \
    adduser -u 1000 -S app -G app && \
    chown -R app:app /app

# Switch to non-root user
USER app

# Expose port
EXPOSE 4567

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:4567/health || exit 1

# Start server
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "4567:4567"
    environment:
      - RACK_ENV=development
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
    command: bundle exec rerun 'puma -C config/puma.rb'

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{projectName}}_development
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
      - RACK_ENV=development
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
    '.env.example': `# Environment
RACK_ENV=development

# Server
PORT=4567

# Database
DATABASE_HOST=localhost
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=
DATABASE_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET=your-jwt-secret

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
`,

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

# Documentation
/.yardoc/
/_yardoc/
/doc/
/rdoc/

# Environment
/.bundle/
/vendor/bundle
/lib/bundler/man/
.env
.env.*

# Database
*.sqlite3
*.sqlite3-journal

# Logs
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Test coverage
/coverage/
`,

    'README.md': `# {{projectName}}

Lightweight Ruby web API built with Sinatra, featuring JWT authentication, ActiveRecord ORM, and comprehensive testing.

## Features

- Lightweight Sinatra framework
- JWT authentication with refresh tokens
- ActiveRecord ORM with PostgreSQL
- Request parameter validation
- API documentation with Swagger
- Background job processing with Sidekiq
- Rate limiting with Rack::Throttle
- Comprehensive testing with RSpec
- Docker and Docker Compose setup
- Auto-reloading in development

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

The API will be available at http://localhost:4567.

### Local Development

1. Install dependencies:
   \`\`\`bash
   bundle install
   \`\`\`

2. Setup database:
   \`\`\`bash
   bundle exec rake db:create
   bundle exec rake db:migrate
   bundle exec rake db:seed
   \`\`\`

3. Start the server:
   \`\`\`bash
   bundle exec rerun 'puma'
   \`\`\`

## Testing

Run the test suite:
\`\`\`bash
bundle exec rspec
\`\`\`

With coverage:
\`\`\`bash
COVERAGE=true bundle exec rspec
\`\`\`

## API Documentation

The API follows RESTful conventions. Swagger documentation can be accessed at the API endpoints.

## API Endpoints

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login
- \`POST /api/v1/auth/refresh\` - Refresh token
- \`DELETE /api/v1/auth/logout\` - Logout

### Users
- \`GET /api/v1/users\` - List users
- \`GET /api/v1/users/:id\` - Get user
- \`PUT /api/v1/users/:id\` - Update user
- \`DELETE /api/v1/users/:id\` - Delete user
- \`PATCH /api/v1/users/:id/activate\` - Activate user
- \`PATCH /api/v1/users/:id/deactivate\` - Deactivate user

### Products
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

### Orders
- \`GET /api/v1/orders\` - List orders
- \`GET /api/v1/orders/:id\` - Get order
- \`POST /api/v1/orders\` - Create order
- \`PATCH /api/v1/orders/:id/cancel\` - Cancel order
- \`PATCH /api/v1/orders/:id/complete\` - Complete order

## Development

### Console

Access the Ruby console with loaded application:
\`\`\`bash
bundle exec rake console
\`\`\`

### Linting

Run RuboCop:
\`\`\`bash
bundle exec rubocop
\`\`\`

### Database Tasks

Create database:
\`\`\`bash
bundle exec rake db:create
\`\`\`

Run migrations:
\`\`\`bash
bundle exec rake db:migrate
\`\`\`

Rollback migration:
\`\`\`bash
bundle exec rake db:rollback
\`\`\`

## License

[Your License]
`
  }
};