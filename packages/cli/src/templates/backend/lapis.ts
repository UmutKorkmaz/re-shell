import { BackendTemplate } from '../types';

export const lapisTemplate: BackendTemplate = {
  id: 'lapis',
  name: 'lapis',
  displayName: 'Lapis Framework',
  description: 'Web framework for Lua and MoonScript built on OpenResty with database ORM and templating',
  language: 'lua',
  framework: 'lapis',
  version: '1.16.0',
  tags: ['lua', 'lapis', 'moonscript', 'api', 'web', 'database', 'openresty'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'database', 'caching', 'logging', 'validation', 'testing', 'docker'],
  
  files: {
    // Nginx configuration
    'nginx.conf': `worker_processes \${{NUM_WORKERS}};
error_log stderr notice;
daemon off;
pid logs/nginx.pid;

events {
  worker_connections 1024;
}

http {
  include mime.types;

  lua_package_path "$prefix/?.lua;$prefix/?/init.lua;;";
  lua_code_cache \${{CODE_CACHE}};

  server {
    listen \${{PORT}};
    lua_code_cache \${{CODE_CACHE}};

    location / {
      default_type text/html;
      content_by_lua_file "app.lua";
    }

    location /static/ {
      alias static/;
    }

    location /favicon.ico {
      alias static/favicon.ico;
    }

    location = /robots.txt {
      alias static/robots.txt;
    }
  }
}
`,

    // Main application file
    'app.lua': `local lapis = require("lapis")
local app = lapis.Application()
local respond_to = require("lapis.application").respond_to
local json_params = require("lapis.application").json_params
local capture_errors = require("lapis.application").capture_errors
local yield_error = require("lapis.application").yield_error
local config = require("lapis.config").get()

-- Load middleware
app:before_filter(require("middleware.cors"))
app:before_filter(require("middleware.rate_limit"))

-- Load routes
local auth_routes = require("routes.auth")
local user_routes = require("routes.users")
local product_routes = require("routes.products")
local order_routes = require("routes.orders")

-- Enable etlua templates
app.layout = require("views.layout")

-- Health check
app:get("/health", function(self)
  local db = require("lapis.db")
  local redis = require("resty.redis")
  
  local health = {
    status = "healthy",
    timestamp = os.time(),
    services = {}
  }
  
  -- Check database
  local db_ok = pcall(function()
    db.query("SELECT 1")
  end)
  
  health.services.database = {
    status = db_ok and "healthy" or "unhealthy"
  }
  
  -- Check Redis
  local red = redis:new()
  red:set_timeout(1000)
  local redis_ok = red:connect(config.redis_host or "127.0.0.1", config.redis_port or 6379)
  
  health.services.redis = {
    status = redis_ok and "healthy" or "unhealthy"
  }
  
  if redis_ok then
    red:set_keepalive(10000, 100)
  end
  
  if not db_ok or not redis_ok then
    health.status = "degraded"
    self.status = 503
  end
  
  return { json = health }
end)

-- API routes group
app:group("/api", function()
  -- Auth routes
  app:match("/auth/login", auth_routes.login)
  app:match("/auth/register", auth_routes.register)
  app:match("/auth/refresh", auth_routes.refresh)
  app:match("/auth/profile", auth_routes.profile)
  
  -- User routes
  app:match("/users", user_routes.index)
  app:match("/users/:id", user_routes.show)
  app:match("/users", user_routes.create)
  app:match("/users/:id", user_routes.update)
  app:match("/users/:id", user_routes.destroy)
  
  -- Product routes
  app:match("/products", product_routes.index)
  app:match("/products/:id", product_routes.show)
  app:match("/products", product_routes.create)
  app:match("/products/:id", product_routes.update)
  app:match("/products/:id", product_routes.destroy)
  
  -- Order routes
  app:match("/orders", order_routes.index)
  app:match("/orders/:id", order_routes.show)
  app:match("/orders", order_routes.create)
  app:match("/orders/:id", order_routes.update)
  app:match("/orders/:id", order_routes.destroy)
end)

-- Error handling
app.handle_error = function(self, err, trace)
  if config.print_errors then
    ngx.log(ngx.ERR, err, "\\n", trace)
  end
  
  return { 
    status = 500,
    json = { 
      error = "Internal server error",
      message = config._name == "development" and err or nil
    }
  }
end

-- 404 handler
app.default_route = function(self)
  return { 
    status = 404,
    json = { error = "Not found" }
  }
end

return app
`,

    // Configuration
    'config.lua': `local config = require("lapis.config")

config({"development", "test"}, {
  port = 8080,
  num_workers = 1,
  code_cache = "off",
  
  -- Database
  postgres = {
    host = "127.0.0.1",
    port = 5432,
    user = "postgres",
    password = "postgres",
    database = "lapis_development"
  },
  
  -- Redis
  redis_host = "127.0.0.1",
  redis_port = 6379,
  
  -- Security
  secret = "change-this-secret-in-production",
  session_name = "lapis_session",
  
  -- Features
  print_errors = true,
  measure_performance = true})

config("production", {
  port = os.getenv("PORT") or 8080,
  num_workers = os.getenv("NUM_WORKERS") or 4,
  code_cache = "on",
  
  -- Database
  postgres = {
    host = os.getenv("DB_HOST"),
    port = os.getenv("DB_PORT"),
    user = os.getenv("DB_USER"),
    password = os.getenv("DB_PASSWORD"),
    database = os.getenv("DB_NAME")
  },
  
  -- Redis
  redis_host = os.getenv("REDIS_HOST"),
  redis_port = os.getenv("REDIS_PORT"),
  
  -- Security
  secret = os.getenv("SECRET_KEY"),
  
  -- Features
  print_errors = false,
  measure_performance = false})
`,

    // Database models
    'models/init.lua': `local autoload = require("lapis.util").autoload
return autoload("models")
`,

    'models/users.lua': `local Model = require("lapis.db.model").Model
local bcrypt = require("bcrypt")
local schema = require("lapis.db.schema")

local Users = Model:extend("users", {
  timestamp = true,
  
  relations = {
    {"orders", has_many = "Orders"}
  },
  
  constraints = {
    email = function(self, value)
      if not value or not value:match("^[^@]+@[^@]+%.[^@]+$") then
        return "Invalid email format"
      end
      
      local existing = Users:find({ email = value })
      if existing and existing.id ~= self.id then
        return "Email already exists"
      end
    end,
    
    password = function(self, value)
      if self.id then return end -- Skip on update
      if not value or #value < 6 then
        return "Password must be at least 6 characters"
      end
    end
  }
})

-- Hash password before create
Users:before_create(function(self)
  if self.password then
    self.password_digest = bcrypt.digest(self.password, 10)
    self.password = nil
  end
  
  self.role = self.role or "user"
end)

-- Verify password
function Users:verify_password(password)
  return bcrypt.verify(password, self.password_digest)
end

-- Find by email
function Users:find_by_email(email)
  return self:find({ email = email })
end

-- Create schema
function Users:create_table()
  schema.create_table("users", {
    {"id", schema.types.serial},
    {"email", schema.types.varchar, unique = true},
    {"password_digest", schema.types.varchar},
    {"name", schema.types.varchar},
    {"role", schema.types.varchar, default = "user"},
    {"created_at", schema.types.timestamp},
    {"updated_at", schema.types.timestamp},
    
    "PRIMARY KEY (id)"
  })
  
  schema.create_index("users", "email")
  schema.create_index("users", "role")
end

return Users
`,

    'models/products.lua': `local Model = require("lapis.db.model").Model
local schema = require("lapis.db.schema")

local Products = Model:extend("products", {
  timestamp = true,
  
  relations = {
    {"order_items", has_many = "OrderItems"}
  },
  
  constraints = {
    name = function(self, value)
      if not value or #value < 1 then
        return "Name is required"
      end
    end,
    
    price = function(self, value)
      if not value or value < 0 then
        return "Price must be positive"
      end
    end,
    
    stock = function(self, value)
      if value and value < 0 then
        return "Stock cannot be negative"
      end
    end
  }
})

-- Create schema
function Products:create_table()
  schema.create_table("products", {
    {"id", schema.types.serial},
    {"name", schema.types.varchar},
    {"description", schema.types.text, null = true},
    {"price", schema.types.numeric},
    {"stock", schema.types.integer, default = 0},
    {"created_at", schema.types.timestamp},
    {"updated_at", schema.types.timestamp},
    
    "PRIMARY KEY (id)"
  })
  
  schema.create_index("products", "name")
end

return Products
`,

    'models/orders.lua': `local Model = require("lapis.db.model").Model
local schema = require("lapis.db.schema")

local Orders = Model:extend("orders", {
  timestamp = true,
  
  relations = {
    {"user", belongs_to = "Users"},
    {"order_items", has_many = "OrderItems"}
  },
  
  constraints = {
    user_id = function(self, value)
      if not value then
        return "User is required"
      end
    end
  }
})

-- Calculate total before save
Orders:before_create(function(self)
  self.status = self.status or "pending"
  self.total = self.total or 0
end)

-- Create schema
function Orders:create_table()
  schema.create_table("orders", {
    {"id", schema.types.serial},
    {"user_id", schema.types.foreign_key},
    {"total", schema.types.numeric},
    {"status", schema.types.varchar, default = "pending"},
    {"created_at", schema.types.timestamp},
    {"updated_at", schema.types.timestamp},
    
    "PRIMARY KEY (id)",
    "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
  })
  
  schema.create_index("orders", "user_id")
  schema.create_index("orders", "status")
end

return Orders
`,

    'models/order_items.lua': `local Model = require("lapis.db.model").Model
local schema = require("lapis.db.schema")

local OrderItems = Model:extend("order_items", {
  timestamp = true,
  
  relations = {
    {"order", belongs_to = "Orders"},
    {"product", belongs_to = "Products"}
  }
})

-- Create schema
function OrderItems:create_table()
  schema.create_table("order_items", {
    {"id", schema.types.serial},
    {"order_id", schema.types.foreign_key},
    {"product_id", schema.types.foreign_key},
    {"quantity", schema.types.integer},
    {"price", schema.types.numeric},
    {"created_at", schema.types.timestamp},
    {"updated_at", schema.types.timestamp},
    
    "PRIMARY KEY (id)",
    "FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE",
    "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE"
  })
  
  schema.create_index("order_items", "order_id")
  schema.create_index("order_items", "product_id")
end

return OrderItems
`,

    // Middleware
    'middleware/cors.lua': `return function(self)
  self.res.headers["Access-Control-Allow-Origin"] = "*"
  self.res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
  self.res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
  
  if self.req.method == "OPTIONS" then
    self.res.headers["Access-Control-Max-Age"] = "86400"
    return { layout = false, status = 204 }
  end
end
`,

    'middleware/rate_limit.lua': `local redis = require("resty.redis")
local config = require("lapis.config").get()

return function(self)
  local red = redis:new()
  red:set_timeout(1000)
  
  local ok, err = red:connect(config.redis_host or "127.0.0.1", config.redis_port or 6379)
  if not ok then
    ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
    return
  end
  
  local key = "rate_limit:" .. ngx.var.remote_addr
  local limit = 100
  local window = 60
  
  local current, err = red:incr(key)
  if not current then
    ngx.log(ngx.ERR, "Failed to increment rate limit: ", err)
    red:set_keepalive(10000, 100)
    return
  end
  
  if current == 1 then
    red:expire(key, window)
  end
  
  red:set_keepalive(10000, 100)
  
  if current > limit then
    self.res.headers["Retry-After"] = window
    return {
      status = 429,
      json = { error = "Rate limit exceeded" }
    }
  end
  
  self.res.headers["X-RateLimit-Limit"] = limit
  self.res.headers["X-RateLimit-Remaining"] = math.max(0, limit - current)
  self.res.headers["X-RateLimit-Reset"] = ngx.time() + window
end
`,

    'middleware/auth.lua': `local jwt = require("lib.jwt")
local Users = require("models.users")

local M = {}

function M.require_login(self)
  local auth_header = self.req.headers["authorization"]
  if not auth_header then
    return {
      status = 401,
      json = { error = "No authorization header" }
    }
  end
  
  local token = auth_header:match("Bearer%s+(.+)")
  if not token then
    return {
      status = 401,
      json = { error = "Invalid authorization format" }
    }
  end
  
  local payload, err = jwt.verify(token)
  if not payload then
    return {
      status = 401,
      json = { error = err or "Invalid token" }
    }
  end
  
  local user = Users:find(payload.user_id)
  if not user then
    return {
      status = 401,
      json = { error = "User not found" }
    }
  end
  
  self.current_user = user
end

function M.require_admin(self)
  local result = M.require_login(self)
  if result then
    return result
  end
  
  if self.current_user.role ~= "admin" then
    return {
      status = 403,
      json = { error = "Admin access required" }
    }
  end
end

return M
`,

    // JWT library
    'lib/jwt.lua': `local jwt = require("resty.jwt")
local config = require("lapis.config").get()

local M = {}

function M.generate(payload)
  payload.exp = ngx.time() + (60 * 60) -- 1 hour
  payload.iat = ngx.time()
  
  local token = jwt:sign(
    config.secret,
    {
      header = { typ = "JWT", alg = "HS256" },
      payload = payload
    }
  )
  
  return token
end

function M.generate_refresh(user_id)
  local payload = {
    user_id = user_id,
    type = "refresh",
    exp = ngx.time() + (60 * 60 * 24 * 7), -- 7 days
    iat = ngx.time()
  }
  
  local token = jwt:sign(
    config.secret,
    {
      header = { typ = "JWT", alg = "HS256" },
      payload = payload
    }
  )
  
  return token
end

function M.verify(token)
  local verified = jwt:verify(config.secret, token)
  
  if not verified.verified then
    return nil, verified.reason
  end
  
  return verified.payload
end

return M
`,

    // Routes
    'routes/auth.lua': `local respond_to = require("lapis.application").respond_to
local json_params = require("lapis.application").json_params
local capture_errors = require("lapis.application").capture_errors
local Users = require("models.users")
local jwt = require("lib.jwt")

local M = {}

M.login = respond_to({
  POST = json_params(capture_errors(function(self)
    local user = Users:find_by_email(self.params.email)
    
    if not user or not user:verify_password(self.params.password) then
      return {
        status = 401,
        json = { error = "Invalid credentials" }
      }
    end
    
    local access_token = jwt.generate({
      user_id = user.id,
      email = user.email,
      role = user.role
    })
    
    local refresh_token = jwt.generate_refresh(user.id)
    
    return {
      json = {
        access_token = access_token,
        refresh_token = refresh_token,
        user = {
          id = user.id,
          email = user.email,
          name = user.name,
          role = user.role
        }
      }
    }
  end))
})

M.register = respond_to({
  POST = json_params(capture_errors(function(self)
    local user = Users:create({
      email = self.params.email,
      password = self.params.password,
      name = self.params.name
    })
    
    if not user then
      return {
        status = 422,
        json = { error = "Failed to create user" }
      }
    end
    
    local access_token = jwt.generate({
      user_id = user.id,
      email = user.email,
      role = user.role
    })
    
    local refresh_token = jwt.generate_refresh(user.id)
    
    return {
      status = 201,
      json = {
        access_token = access_token,
        refresh_token = refresh_token,
        user = {
          id = user.id,
          email = user.email,
          name = user.name,
          role = user.role
        }
      }
    }
  end))
})

M.refresh = respond_to({
  POST = json_params(capture_errors(function(self)
    local payload, err = jwt.verify(self.params.refresh_token)
    
    if not payload or payload.type ~= "refresh" then
      return {
        status = 401,
        json = { error = "Invalid refresh token" }
      }
    end
    
    local user = Users:find(payload.user_id)
    if not user then
      return {
        status = 401,
        json = { error = "User not found" }
      }
    end
    
    local access_token = jwt.generate({
      user_id = user.id,
      email = user.email,
      role = user.role
    })
    
    return {
      json = { access_token = access_token }
    }
  end))
})

M.profile = respond_to({
  before = require("middleware.auth").require_login,
  GET = function(self)
    return {
      json = {
        id = self.current_user.id,
        email = self.current_user.email,
        name = self.current_user.name,
        role = self.current_user.role,
        created_at = self.current_user.created_at
      }
    }
  end
})

return M
`,

    'routes/users.lua': `local respond_to = require("lapis.application").respond_to
local json_params = require("lapis.application").json_params
local capture_errors = require("lapis.application").capture_errors
local Users = require("models.users")
local auth = require("middleware.auth")

local M = {}

M.index = respond_to({
  before = auth.require_login,
  GET = function(self)
    local page = tonumber(self.params.page) or 1
    local per_page = tonumber(self.params.per_page) or 20
    
    local paginated = Users:paginated("ORDER BY created_at DESC", {
      per_page = per_page,
      prepare_results = function(users)
        for _, user in ipairs(users) do
          user.password_digest = nil
        end
        return users
      end
    })
    
    local users = paginated:get_page(page)
    
    return {
      json = {
        users = users,
        page = page,
        per_page = per_page,
        total = paginated:total_items()
      }
    }
  end
})

M.show = respond_to({
  before = auth.require_login,
  GET = function(self)
    local user = Users:find(self.params.id)
    
    if not user then
      return { status = 404, json = { error = "User not found" } }
    end
    
    user.password_digest = nil
    
    return { json = user }
  end
})

M.create = respond_to({
  before = auth.require_admin,
  POST = json_params(capture_errors(function(self)
    local user = Users:create({
      email = self.params.email,
      password = self.params.password or "temp123456",
      name = self.params.name,
      role = self.params.role or "user"
    })
    
    user.password_digest = nil
    
    return {
      status = 201,
      json = user
    }
  end))
})

M.update = respond_to({
  before = auth.require_login,
  PUT = json_params(capture_errors(function(self)
    local user = Users:find(self.params.id)
    
    if not user then
      return { status = 404, json = { error = "User not found" } }
    end
    
    -- Check authorization
    if self.current_user.id ~= user.id and self.current_user.role ~= "admin" then
      return { status = 403, json = { error = "Forbidden" } }
    end
    
    user:update({
      name = self.params.name,
      email = self.params.email
    })
    
    user.password_digest = nil
    
    return { json = user }
  end))
})

M.destroy = respond_to({
  before = auth.require_admin,
  DELETE = function(self)
    local user = Users:find(self.params.id)
    
    if not user then
      return { status = 404, json = { error = "User not found" } }
    end
    
    user:delete()
    
    return { status = 204 }
  end
})

return M
`,

    'routes/products.lua': `local respond_to = require("lapis.application").respond_to
local json_params = require("lapis.application").json_params
local capture_errors = require("lapis.application").capture_errors
local Products = require("models.products")
local auth = require("middleware.auth")

local M = {}

M.index = respond_to({
  GET = function(self)
    local page = tonumber(self.params.page) or 1
    local per_page = tonumber(self.params.per_page) or 20
    
    local paginated = Products:paginated("ORDER BY created_at DESC", {
      per_page = per_page
    })
    
    local products = paginated:get_page(page)
    
    return {
      json = {
        products = products,
        page = page,
        per_page = per_page,
        total = paginated:total_items()
      }
    }
  end
})

M.show = respond_to({
  GET = function(self)
    local product = Products:find(self.params.id)
    
    if not product then
      return { status = 404, json = { error = "Product not found" } }
    end
    
    return { json = product }
  end
})

M.create = respond_to({
  before = auth.require_admin,
  POST = json_params(capture_errors(function(self)
    local product = Products:create({
      name = self.params.name,
      description = self.params.description,
      price = self.params.price,
      stock = self.params.stock or 0
    })
    
    return {
      status = 201,
      json = product
    }
  end))
})

M.update = respond_to({
  before = auth.require_admin,
  PUT = json_params(capture_errors(function(self)
    local product = Products:find(self.params.id)
    
    if not product then
      return { status = 404, json = { error = "Product not found" } }
    end
    
    product:update({
      name = self.params.name,
      description = self.params.description,
      price = self.params.price,
      stock = self.params.stock
    })
    
    return { json = product }
  end))
})

M.destroy = respond_to({
  before = auth.require_admin,
  DELETE = function(self)
    local product = Products:find(self.params.id)
    
    if not product then
      return { status = 404, json = { error = "Product not found" } }
    end
    
    product:delete()
    
    return { status = 204 }
  end
})

return M
`,

    'routes/orders.lua': `local respond_to = require("lapis.application").respond_to
local json_params = require("lapis.application").json_params
local capture_errors = require("lapis.application").capture_errors
local Orders = require("models.orders")
local OrderItems = require("models.order_items")
local Products = require("models.products")
local auth = require("middleware.auth")

local M = {}

M.index = respond_to({
  before = auth.require_login,
  GET = function(self)
    local page = tonumber(self.params.page) or 1
    local per_page = tonumber(self.params.per_page) or 20
    
    local where = self.current_user.role == "admin" and {} or { user_id = self.current_user.id }
    
    local paginated = Orders:paginated("WHERE " .. table.concat(where, " AND ") .. " ORDER BY created_at DESC", {
      per_page = per_page
    })
    
    local orders = paginated:get_page(page)
    
    return {
      json = {
        orders = orders,
        page = page,
        per_page = per_page,
        total = paginated:total_items()
      }
    }
  end
})

M.show = respond_to({
  before = auth.require_login,
  GET = function(self)
    local order = Orders:find(self.params.id)
    
    if not order then
      return { status = 404, json = { error = "Order not found" } }
    end
    
    -- Check authorization
    if order.user_id ~= self.current_user.id and self.current_user.role ~= "admin" then
      return { status = 403, json = { error = "Forbidden" } }
    end
    
    -- Include order items
    order.items = OrderItems:select("WHERE order_id = ?", order.id)
    
    return { json = order }
  end
})

M.create = respond_to({
  before = auth.require_login,
  POST = json_params(capture_errors(function(self)
    local db = require("lapis.db")
    
    -- Start transaction
    db.begin()
    
    local order = Orders:create({
      user_id = self.current_user.id,
      total = 0
    })
    
    local total = 0
    
    -- Add order items
    for _, item in ipairs(self.params.items or {}) do
      local product = Products:find(item.product_id)
      
      if not product then
        db.rollback()
        return { status = 422, json = { error = "Product not found: " .. item.product_id } }
      end
      
      if product.stock < item.quantity then
        db.rollback()
        return { status = 422, json = { error = "Insufficient stock for: " .. product.name } }
      end
      
      OrderItems:create({
        order_id = order.id,
        product_id = product.id,
        quantity = item.quantity,
        price = product.price
      })
      
      -- Update stock
      product:update({ stock = product.stock - item.quantity })
      
      total = total + (product.price * item.quantity)
    end
    
    -- Update order total
    order:update({ total = total })
    
    db.commit()
    
    return {
      status = 201,
      json = order
    }
  end))
})

M.update = respond_to({
  before = auth.require_login,
  PUT = json_params(capture_errors(function(self)
    local order = Orders:find(self.params.id)
    
    if not order then
      return { status = 404, json = { error = "Order not found" } }
    end
    
    -- Check authorization
    if order.user_id ~= self.current_user.id and self.current_user.role ~= "admin" then
      return { status = 403, json = { error = "Forbidden" } }
    end
    
    -- Only admin can update status
    if self.params.status and self.current_user.role ~= "admin" then
      return { status = 403, json = { error = "Only admin can update order status" } }
    end
    
    order:update({
      status = self.params.status
    })
    
    return { json = order }
  end))
})

M.destroy = respond_to({
  before = auth.require_admin,
  DELETE = function(self)
    local order = Orders:find(self.params.id)
    
    if not order then
      return { status = 404, json = { error = "Order not found" } }
    end
    
    order:delete()
    
    return { status = 204 }
  end
})

return M
`,

    // Views (optional HTML templates)
    'views/layout.etlua': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= page_title or "Lapis Application" %></title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <% content_for("inner") %>
</body>
</html>
`,

    // Static files
    'static/style.css': `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 20px;
  background: #f5f5f5;
}
`,

    'static/robots.txt': `User-agent: *
Disallow: /api/
`,

    // Migrations
    'migrations.lua': `local schema = require("lapis.db.schema")
local types = schema.types

return {
  [1] = function()
    -- Create users table
    schema.create_table("users", {
      {"id", types.serial},
      {"email", types.varchar, unique = true},
      {"password_digest", types.varchar},
      {"name", types.varchar},
      {"role", types.varchar, default = "user"},
      {"created_at", types.timestamp},
      {"updated_at", types.timestamp},
      
      "PRIMARY KEY (id)"
    })
    
    schema.create_index("users", "email")
    schema.create_index("users", "role")
    
    -- Create products table
    schema.create_table("products", {
      {"id", types.serial},
      {"name", types.varchar},
      {"description", types.text, null = true},
      {"price", types.numeric},
      {"stock", types.integer, default = 0},
      {"created_at", types.timestamp},
      {"updated_at", types.timestamp},
      
      "PRIMARY KEY (id)"
    })
    
    schema.create_index("products", "name")
    
    -- Create orders table
    schema.create_table("orders", {
      {"id", types.serial},
      {"user_id", types.foreign_key},
      {"total", types.numeric},
      {"status", types.varchar, default = "pending"},
      {"created_at", types.timestamp},
      {"updated_at", types.timestamp},
      
      "PRIMARY KEY (id)",
      "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
    })
    
    schema.create_index("orders", "user_id")
    schema.create_index("orders", "status")
    
    -- Create order_items table
    schema.create_table("order_items", {
      {"id", types.serial},
      {"order_id", types.foreign_key},
      {"product_id", types.foreign_key},
      {"quantity", types.integer},
      {"price", types.numeric},
      {"created_at", types.timestamp},
      {"updated_at", types.timestamp},
      
      "PRIMARY KEY (id)",
      "FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE",
      "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE"
    })
    
    schema.create_index("order_items", "order_id")
    schema.create_index("order_items", "product_id")
  end
}
`,

    // Test specs
    'spec/spec_helper.lua': `-- Load Lapis environment
require("lapis.spec")

-- Configure test database
local config = require("lapis.config")
config("test", {
  postgres = {
    database = "lapis_test"
  }
})

-- Helper functions
local helpers = {}

function helpers.mock_login(user)
  local jwt = require("lib.jwt")
  local token = jwt.generate({
    user_id = user.id,
    email = user.email,
    role = user.role
  })
  
  return {
    ["Authorization"] = "Bearer " .. token
  }
end

return helpers
`,

    'spec/models/users_spec.lua': `local Users = require("models.users")

describe("Users", function()
  it("should create a user with hashed password", function()
    local user = Users:create({
      email = "test@example.com",
      password = "password123",
      name = "Test User"
    })
    
    assert.truthy(user)
    assert.equals("test@example.com", user.email)
    assert.equals("Test User", user.name)
    assert.equals("user", user.role)
    assert.truthy(user.password_digest)
    assert.falsy(user.password)
  end)
  
  it("should verify password", function()
    local user = Users:create({
      email = "verify@example.com",
      password = "secret123",
      name = "Verify User"
    })
    
    assert.true(user:verify_password("secret123"))
    assert.false(user:verify_password("wrongpassword"))
  end)
  
  it("should find by email", function()
    local user = Users:create({
      email = "find@example.com",
      password = "password",
      name = "Find User"
    })
    
    local found = Users:find_by_email("find@example.com")
    assert.truthy(found)
    assert.equals(user.id, found.id)
  end)
  
  it("should validate email uniqueness", function()
    Users:create({
      email = "unique@example.com",
      password = "password",
      name = "First User"
    })
    
    local user2 = Users:build({
      email = "unique@example.com",
      password = "password",
      name = "Second User"
    })
    
    local errors = user2:validate()
    assert.truthy(errors)
    assert.truthy(errors.email)
  end)
end)
`,

    'spec/routes/auth_spec.lua': `local helpers = require("spec.spec_helper")
local Users = require("models.users")

describe("Auth routes", function()
  local request
  
  before_each(function()
    request = require("lapis.spec").request
  end)
  
  describe("POST /api/auth/register", function()
    it("should create a new user", function()
      local status, body, headers = request("/api/auth/register", {
        method = "POST",
        headers = {
          ["Content-Type"] = "application/json"
        },
        body = {
          email = "newuser@example.com",
          password = "password123",
          name = "New User"
        }
      })
      
      assert.equals(201, status)
      assert.truthy(body.access_token)
      assert.truthy(body.refresh_token)
      assert.equals("newuser@example.com", body.user.email)
    end)
  end)
  
  describe("POST /api/auth/login", function()
    it("should login with valid credentials", function()
      local user = Users:create({
        email = "login@example.com",
        password = "password123",
        name = "Login User"
      })
      
      local status, body = request("/api/auth/login", {
        method = "POST",
        headers = {
          ["Content-Type"] = "application/json"
        },
        body = {
          email = "login@example.com",
          password = "password123"
        }
      })
      
      assert.equals(200, status)
      assert.truthy(body.access_token)
      assert.truthy(body.refresh_token)
    end)
    
    it("should fail with invalid credentials", function()
      local status, body = request("/api/auth/login", {
        method = "POST",
        headers = {
          ["Content-Type"] = "application/json"
        },
        body = {
          email = "wrong@example.com",
          password = "wrongpassword"
        }
      })
      
      assert.equals(401, status)
      assert.equals("Invalid credentials", body.error)
    end)
  end)
  
  describe("GET /api/auth/profile", function()
    it("should return user profile when authenticated", function()
      local user = Users:create({
        email = "profile@example.com",
        password = "password",
        name = "Profile User"
      })
      
      local headers = helpers.mock_login(user)
      
      local status, body = request("/api/auth/profile", {
        method = "GET",
        headers = headers
      })
      
      assert.equals(200, status)
      assert.equals(user.id, body.id)
      assert.equals(user.email, body.email)
    end)
    
    it("should fail without authentication", function()
      local status, body = request("/api/auth/profile", {
        method = "GET"
      })
      
      assert.equals(401, status)
    end)
  end)
end)
`,

    // Environment configuration
    '.env.example': `# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lapis_development
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
SECRET_KEY=change-this-in-production

# Server
PORT=8080
NUM_WORKERS=1
`,

    // Package configuration
    '.luarocks': `-- Local LuaRocks configuration
rocks_trees = {
   { name = "user", root = home .. "/.luarocks" },
   { name = "project", root = "./lua_modules" }}
`,

    // Makefile
    'Makefile': `.PHONY: install test migrate server dev build clean

# Install dependencies
install:
	@echo "Installing dependencies..."
	luarocks install lapis
	luarocks install bcrypt
	luarocks install luaossl
	luarocks install lua-resty-jwt
	luarocks install busted
	luarocks install moonscript

# Run tests
test:
	@echo "Running tests..."
	busted spec/

# Run migrations
migrate:
	@echo "Running migrations..."
	lapis migrate

# Start development server
dev:
	@echo "Starting development server..."
	lapis server development

# Start production server
server:
	@echo "Starting production server..."
	lapis server production

# Build for production
build:
	@echo "Building for production..."
	moonc .
	lapis build production

# Create new migration
new-migration:
	@echo "Creating new migration..."
	lapis new migration

# Clean
clean:
	@echo "Cleaning..."
	rm -rf logs/*
	rm -rf lua_modules
	rm -f *.lua

# Console
console:
	@echo "Starting Lapis console..."
	lapis console

# Database commands
db-create:
	@echo "Creating database..."
	createdb lapis_development
	createdb lapis_test

db-drop:
	@echo "Dropping database..."
	dropdb lapis_development
	dropdb lapis_test

db-reset: db-drop db-create migrate
`,

    // Docker configuration
    'Dockerfile': `FROM openresty/openresty:1.25.3.1-alpine

# Install dependencies
RUN apk add --no-cache \\
    postgresql-client \\
    build-base \\
    git \\
    curl \\
    openssl-dev \\
    postgresql-dev

# Install LuaRocks
RUN cd /tmp && \\
    wget https://luarocks.org/releases/luarocks-3.9.2.tar.gz && \\
    tar zxpf luarocks-3.9.2.tar.gz && \\
    cd luarocks-3.9.2 && \\
    ./configure --prefix=/usr/local/openresty/luajit \\
        --with-lua=/usr/local/openresty/luajit \\
        --lua-suffix=jit \\
        --with-lua-include=/usr/local/openresty/luajit/include/luajit-2.1 && \\
    make && \\
    make install && \\
    cd / && \\
    rm -rf /tmp/luarocks-3.9.2*

# Set paths
ENV PATH="/usr/local/openresty/luajit/bin:$PATH"
ENV LUA_PATH="/app/?.lua;/app/?/init.lua;;"
ENV LUA_CPATH="/app/?.so;;"

# Create app directory
WORKDIR /app

# Copy and install dependencies
COPY .luarocks ./
COPY Makefile ./
RUN make install

# Copy application
COPY . .

# Create required directories
RUN mkdir -p logs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run application
CMD ["lapis", "server", "production"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - LAPIS_ENVIRONMENT=development
      - DB_HOST=postgres
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=lapis_development
      - REDIS_HOST=redis
      - SECRET_KEY=development-secret
    depends_on:
      - postgres
      - redis
    volumes:
      - ./:/app
      - lua_modules:/app/lua_modules
    command: ["lapis", "server", "development"]

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=lapis_development
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
  lua_modules:
`,

    // README
    'README.md': `# Lapis Application

Web application built with Lapis framework for Lua/MoonScript.

## Features

- 🌙 Lapis web framework with MoonScript support
- 🗄️ PostgreSQL database with migrations and ORM
- 🔐 JWT authentication with refresh tokens
- 🔄 Redis caching and session storage
- ⚡ Rate limiting middleware
- 🧪 Testing with Busted framework
- 🐳 Docker support
- 📝 RESTful API design
- 🎨 Optional HTML templating with etlua

## Prerequisites

- OpenResty or LuaJIT
- PostgreSQL 14+
- Redis 6+
- LuaRocks
- MoonScript (optional)

## Installation

1. Install dependencies:
\`\`\`bash
make install
\`\`\`

2. Create databases:
\`\`\`bash
make db-create
\`\`\`

3. Run migrations:
\`\`\`bash
make migrate
\`\`\`

4. Set up environment:
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

## Running the Application

### Development
\`\`\`bash
make dev
\`\`\`

### Production
\`\`\`bash
make server
\`\`\`

### Docker
\`\`\`bash
docker-compose up
\`\`\`

## Testing

Run tests:
\`\`\`bash
make test
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/auth/login\` - User login
- \`POST /api/auth/register\` - User registration
- \`POST /api/auth/refresh\` - Refresh access token
- \`GET /api/auth/profile\` - Get current user profile

### Users
- \`GET /api/users\` - List users
- \`GET /api/users/:id\` - Get user details
- \`POST /api/users\` - Create user (admin)
- \`PUT /api/users/:id\` - Update user
- \`DELETE /api/users/:id\` - Delete user (admin)

### Products
- \`GET /api/products\` - List products
- \`GET /api/products/:id\` - Get product details
- \`POST /api/products\` - Create product (admin)
- \`PUT /api/products/:id\` - Update product (admin)
- \`DELETE /api/products/:id\` - Delete product (admin)

### Orders
- \`GET /api/orders\` - List orders
- \`GET /api/orders/:id\` - Get order details
- \`POST /api/orders\` - Create order
- \`PUT /api/orders/:id\` - Update order
- \`DELETE /api/orders/:id\` - Delete order (admin)

## MoonScript Support

Lapis supports MoonScript out of the box. To write in MoonScript:

1. Create \`.moon\` files instead of \`.lua\`
2. Compile with: \`moonc .\`
3. Or use auto-compilation in development

## Console

Interactive console:
\`\`\`bash
make console
\`\`\`

## Migrations

Create new migration:
\`\`\`bash
make new-migration
\`\`\`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License
`,

    // .gitignore
    '.gitignore': `# Logs
logs/
*.log
nginx.pid

# Environment
.env
.env.*
!.env.example

# Lua
lua_modules/
*.lua.compiled
*.moon.compiled

# Database
*.sql
!schema.sql

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Test artifacts
.busted
luacov.*.out
`
  }
};