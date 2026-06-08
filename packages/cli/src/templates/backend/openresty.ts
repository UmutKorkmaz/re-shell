import { BackendTemplate } from '../types';

export const openrestyTemplate: BackendTemplate = {
  id: 'openresty',
  name: 'openresty',
  displayName: 'OpenResty',
  description: 'High-performance web platform based on NGINX and LuaJIT for building scalable web applications',
  language: 'lua',
  framework: 'openresty',
  version: '1.25.3.1',
  tags: ['lua', 'openresty', 'nginx', 'api', 'high-performance', 'microservices', 'luajit'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'database', 'caching', 'logging', 'rate-limiting', 'cors', 'docker', 'testing'],
  
  files: {
    // Nginx configuration
    'nginx.conf': `worker_processes auto;
error_log logs/error.log warn;
pid logs/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                   '$status $body_bytes_sent "$http_referer" '
                   '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log logs/access.log main;
    
    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    
    # Lua settings
    lua_package_path "$prefix/lua/?.lua;$prefix/lua/lib/?.lua;;";
    lua_code_cache on;
    lua_shared_dict jwt_cache 10m;
    lua_shared_dict rate_limit 10m;
    lua_shared_dict app_cache 50m;
    
    # Initialize Lua modules
    init_by_lua_block {
        require "resty.core"
        
        -- Load configuration
        config = require "config"
        
        -- Initialize database connection pool
        db = require "db"
        db.init()
        
        -- Initialize Redis connection pool
        redis_client = require "redis_client"
        redis_client.init()
    }
    
    # Upstream servers (if needed)
    upstream backend {
        server 127.0.0.1:3000;
        keepalive 32;
    }
    
    server {
        listen 8080;
        server_name localhost;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        
        # Handle OPTIONS requests
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        # Health check endpoint
        location = /health {
            content_by_lua_block {
                local health = require "routes.health"
                health.check()
            }
        }
        
        # API routes
        location /api {
            # Rate limiting
            access_by_lua_block {
                local rate_limiter = require "middleware.rate_limiter"
                rate_limiter.limit()
            }
            
            # Main routing
            content_by_lua_block {
                local router = require "router"
                router.dispatch()
            }
        }
        
        # Static files
        location /static {
            alias html/static;
            expires 1d;
            add_header Cache-Control "public, immutable";
        }
        
        # Error pages
        error_page 404 /404.json;
        location = /404.json {
            default_type application/json;
            return 404 '{"error": "Not Found", "status": 404}';
        }
        
        error_page 500 502 503 504 /50x.json;
        location = /50x.json {
            default_type application/json;
            return 500 '{"error": "Internal Server Error", "status": 500}';
        }
    }
}
`,

    // Main router
    'lua/router.lua': `local cjson = require "cjson"
local auth_routes = require "routes.auth"
local user_routes = require "routes.users"
local product_routes = require "routes.products"
local order_routes = require "routes.orders"

local _M = {}

-- Route definitions
local routes = {
    -- Auth routes
    ["POST /api/auth/login"] = auth_routes.login,
    ["POST /api/auth/register"] = auth_routes.register,
    ["POST /api/auth/refresh"] = auth_routes.refresh,
    ["GET /api/auth/profile"] = auth_routes.profile,
    
    -- User routes
    ["GET /api/users"] = user_routes.list,
    ["GET /api/users/:id"] = user_routes.get,
    ["POST /api/users"] = user_routes.create,
    ["PUT /api/users/:id"] = user_routes.update,
    ["DELETE /api/users/:id"] = user_routes.delete,
    
    -- Product routes
    ["GET /api/products"] = product_routes.list,
    ["GET /api/products/:id"] = product_routes.get,
    ["POST /api/products"] = product_routes.create,
    ["PUT /api/products/:id"] = product_routes.update,
    ["DELETE /api/products/:id"] = product_routes.delete,
    
    -- Order routes
    ["GET /api/orders"] = order_routes.list,
    ["GET /api/orders/:id"] = order_routes.get,
    ["POST /api/orders"] = order_routes.create,
    ["PUT /api/orders/:id"] = order_routes.update,
    ["DELETE /api/orders/:id"] = order_routes.delete}

-- Pattern matching for dynamic routes
local function match_route(method, path)
    local route_key = method .. " " .. path
    
    -- Direct match
    if routes[route_key] then
        return routes[route_key], {}
    end
    
    -- Pattern matching for dynamic segments
    for pattern, handler in pairs(routes) do
        local method_pattern, path_pattern = pattern:match("^(%S+)%s+(.+)$")
        if method == method_pattern then
            local params = {}
            local regex_pattern = path_pattern:gsub(":(%w+)", function(param_name)
                return "([^/]+)"
            end)
            regex_pattern = "^" .. regex_pattern .. "$"
            
            local matches = {path:match(regex_pattern)}
            if #matches > 0 then
                local param_names = {}
                for param_name in path_pattern:gmatch(":(%w+)") do
                    table.insert(param_names, param_name)
                end
                
                for i, value in ipairs(matches) do
                    params[param_names[i]] = value
                end
                
                return handler, params
            end
        end
    end
    
    return nil, {}
end

-- Main dispatch function
function _M.dispatch()
    local method = ngx.req.get_method()
    local path = ngx.var.uri
    
    -- Find matching route
    local handler, params = match_route(method, path)
    
    if not handler then
        ngx.status = 404
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Route not found", status = 404}))
        return
    end
    
    -- Set params in ngx.ctx
    ngx.ctx.params = params
    
    -- Call handler
    local ok, err = pcall(handler)
    if not ok then
        ngx.log(ngx.ERR, "Route handler error: ", err)
        ngx.status = 500
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Internal server error", status = 500}))
    end
end

return _M
`,

    // Configuration
    'lua/config.lua': `local _M = {}

-- Database configuration
_M.database = {
    host = os.getenv("DB_HOST") or "localhost",
    port = tonumber(os.getenv("DB_PORT")) or 5432,
    database = os.getenv("DB_NAME") or "myapp_development",
    user = os.getenv("DB_USER") or "postgres",
    password = os.getenv("DB_PASSWORD") or "postgres",
    pool_size = tonumber(os.getenv("DB_POOL_SIZE")) or 10,
    idle_timeout = tonumber(os.getenv("DB_IDLE_TIMEOUT")) or 10000}

-- Redis configuration
_M.redis = {
    host = os.getenv("REDIS_HOST") or "localhost",
    port = tonumber(os.getenv("REDIS_PORT")) or 6379,
    database = tonumber(os.getenv("REDIS_DB")) or 0,
    password = os.getenv("REDIS_PASSWORD"),
    pool_size = tonumber(os.getenv("REDIS_POOL_SIZE")) or 10,
    keepalive_timeout = tonumber(os.getenv("REDIS_KEEPALIVE_TIMEOUT")) or 60000}

-- JWT configuration
_M.jwt = {
    secret = os.getenv("JWT_SECRET") or "your-secret-key-change-in-production",
    expiration = tonumber(os.getenv("JWT_EXPIRATION")) or 3600, -- 1 hour
    refresh_expiration = tonumber(os.getenv("JWT_REFRESH_EXPIRATION")) or 604800, -- 7 days
}

-- Rate limiting configuration
_M.rate_limit = {
    rate = tonumber(os.getenv("RATE_LIMIT_RATE")) or 100, -- requests per window
    window = tonumber(os.getenv("RATE_LIMIT_WINDOW")) or 60, -- window in seconds
}

-- Application settings
_M.app = {
    env = os.getenv("APP_ENV") or "development",
    debug = os.getenv("APP_DEBUG") == "true",
    log_level = os.getenv("LOG_LEVEL") or "info"}

return _M
`,

    // Database module
    'lua/db.lua': `local pgmoon = require "pgmoon"
local config = require "config"

local _M = {}
local pool = {}

-- Initialize connection pool
function _M.init()
    -- Pool is managed per worker
end

-- Get connection from pool
function _M.get_connection()
    local pg = pgmoon.new(config.database)
    
    local ok, err = pg:connect()
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to database: ", err)
        return nil, err
    end
    
    return pg
end

-- Release connection back to pool
function _M.release_connection(pg)
    if pg then
        pg:keepalive(config.database.idle_timeout, config.database.pool_size)
    end
end

-- Execute query with automatic connection management
function _M.query(sql, params)
    local pg, err = _M.get_connection()
    if not pg then
        return nil, err
    end
    
    local res, err = pg:query(sql, params)
    _M.release_connection(pg)
    
    return res, err
end

-- Execute transaction
function _M.transaction(callback)
    local pg, err = _M.get_connection()
    if not pg then
        return nil, err
    end
    
    local ok, err = pg:query("BEGIN")
    if not ok then
        _M.release_connection(pg)
        return nil, err
    end
    
    local success, result = pcall(callback, pg)
    
    if success then
        pg:query("COMMIT")
        _M.release_connection(pg)
        return result
    else
        pg:query("ROLLBACK")
        _M.release_connection(pg)
        return nil, result
    end
end

return _M
`,

    // Redis client
    'lua/redis_client.lua': `local redis = require "resty.redis"
local config = require "config"

local _M = {}

-- Initialize Redis
function _M.init()
    -- Connection pool is managed per request
end

-- Get Redis connection
function _M.get_connection()
    local red = redis:new()
    red:set_timeout(1000) -- 1 second
    
    local ok, err = red:connect(config.redis.host, config.redis.port)
    if not ok then
        ngx.log(ngx.ERR, "Failed to connect to Redis: ", err)
        return nil, err
    end
    
    if config.redis.password then
        local ok, err = red:auth(config.redis.password)
        if not ok then
            ngx.log(ngx.ERR, "Failed to authenticate with Redis: ", err)
            return nil, err
        end
    end
    
    red:select(config.redis.database)
    
    return red
end

-- Release connection back to pool
function _M.release_connection(red)
    if red then
        local ok, err = red:set_keepalive(
            config.redis.keepalive_timeout,
            config.redis.pool_size
        )
        if not ok then
            ngx.log(ngx.ERR, "Failed to set Redis keepalive: ", err)
        end
    end
end

-- Get value
function _M.get(key)
    local red, err = _M.get_connection()
    if not red then
        return nil, err
    end
    
    local res, err = red:get(key)
    _M.release_connection(red)
    
    if res == ngx.null then
        return nil
    end
    
    return res, err
end

-- Set value with optional expiration
function _M.set(key, value, expiration)
    local red, err = _M.get_connection()
    if not red then
        return nil, err
    end
    
    local res, err
    if expiration then
        res, err = red:setex(key, expiration, value)
    else
        res, err = red:set(key, value)
    end
    
    _M.release_connection(red)
    return res, err
end

-- Delete key
function _M.delete(key)
    local red, err = _M.get_connection()
    if not red then
        return nil, err
    end
    
    local res, err = red:del(key)
    _M.release_connection(red)
    
    return res, err
end

return _M
`,

    // JWT authentication module
    'lua/lib/jwt.lua': `local cjson = require "cjson"
local resty_jwt = require "resty.jwt"
local config = require "config"

local _M = {}

-- Generate JWT token
function _M.generate(payload)
    payload.exp = ngx.time() + config.jwt.expiration
    payload.iat = ngx.time()
    
    local jwt_token = resty_jwt:sign(
        config.jwt.secret,
        {
            header = {typ = "JWT", alg = "HS256"},
            payload = payload
        }
    )
    
    return jwt_token
end

-- Generate refresh token
function _M.generate_refresh(user_id)
    local payload = {
        user_id = user_id,
        type = "refresh",
        exp = ngx.time() + config.jwt.refresh_expiration,
        iat = ngx.time()
    }
    
    local jwt_token = resty_jwt:sign(
        config.jwt.secret,
        {
            header = {typ = "JWT", alg = "HS256"},
            payload = payload
        }
    )
    
    return jwt_token
end

-- Verify JWT token
function _M.verify(token)
    if not token then
        return nil, "No token provided"
    end
    
    -- Check cache first
    local cache_key = "jwt:" .. token
    local cached = ngx.shared.jwt_cache:get(cache_key)
    if cached then
        return cjson.decode(cached)
    end
    
    local jwt_obj = resty_jwt:verify(config.jwt.secret, token)
    
    if not jwt_obj.verified then
        return nil, jwt_obj.reason
    end
    
    -- Cache valid token
    ngx.shared.jwt_cache:set(cache_key, cjson.encode(jwt_obj.payload), 300) -- 5 minutes
    
    return jwt_obj.payload
end

-- Extract token from Authorization header
function _M.get_token_from_header()
    local auth_header = ngx.req.get_headers()["Authorization"]
    if not auth_header then
        return nil
    end
    
    local token = auth_header:match("Bearer%s+(.+)")
    return token
end

return _M
`,

    // Password hashing module
    'lua/lib/password.lua': `local bcrypt = require "bcrypt"

local _M = {}

-- Hash password
function _M.hash(password)
    local rounds = 10
    return bcrypt.digest(password, rounds)
end

-- Verify password
function _M.verify(password, hash)
    return bcrypt.verify(password, hash)
end

return _M
`,

    // Rate limiter middleware
    'lua/middleware/rate_limiter.lua': `local config = require "config"

local _M = {}

function _M.limit()
    local limit_dict = ngx.shared.rate_limit
    local key = ngx.var.remote_addr
    local rate = config.rate_limit.rate
    local window = config.rate_limit.window
    
    local current = limit_dict:get(key)
    if not current then
        limit_dict:set(key, 1, window)
        return
    end
    
    if current >= rate then
        ngx.status = 429
        ngx.header["Content-Type"] = "application/json"
        ngx.header["Retry-After"] = window
        ngx.say('{"error": "Rate limit exceeded", "status": 429}')
        ngx.exit(429)
    end
    
    limit_dict:incr(key, 1)
end

return _M
`,

    // Auth middleware
    'lua/middleware/auth.lua': `local jwt = require "lib.jwt"
local cjson = require "cjson"

local _M = {}

function _M.require_auth()
    local token = jwt.get_token_from_header()
    
    if not token then
        ngx.status = 401
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "No token provided", status = 401}))
        ngx.exit(401)
    end
    
    local payload, err = jwt.verify(token)
    
    if not payload then
        ngx.status = 401
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = err or "Invalid token", status = 401}))
        ngx.exit(401)
    end
    
    -- Set user context
    ngx.ctx.user = payload
end

function _M.require_admin()
    _M.require_auth()
    
    if ngx.ctx.user.role ~= "admin" then
        ngx.status = 403
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Admin access required", status = 403}))
        ngx.exit(403)
    end
end

return _M
`,

    // Health check route
    'lua/routes/health.lua': `local cjson = require "cjson"
local db = require "db"
local redis_client = require "redis_client"

local _M = {}

function _M.check()
    local health = {
        status = "ok",
        timestamp = ngx.time(),
        services = {}
    }
    
    -- Check database
    local pg_ok = false
    local pg, err = db.get_connection()
    if pg then
        local res = pg:query("SELECT 1")
        if res then
            pg_ok = true
        end
        db.release_connection(pg)
    end
    
    health.services.database = {
        status = pg_ok and "healthy" or "unhealthy",
        error = not pg_ok and err or nil
    }
    
    -- Check Redis
    local redis_ok = false
    local red, err = redis_client.get_connection()
    if red then
        local res = red:ping()
        if res then
            redis_ok = true
        end
        redis_client.release_connection(red)
    end
    
    health.services.redis = {
        status = redis_ok and "healthy" or "unhealthy",
        error = not redis_ok and err or nil
    }
    
    -- Overall status
    if not pg_ok or not redis_ok then
        health.status = "degraded"
        ngx.status = 503
    end
    
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode(health))
end

return _M
`,

    // Auth routes
    'lua/routes/auth.lua': `local cjson = require "cjson"
local db = require "db"
local jwt = require "lib.jwt"
local password = require "lib.password"
local validation = require "lib.validation"
local auth_middleware = require "middleware.auth"

local _M = {}

-- Login
function _M.login()
    ngx.req.read_body()
    local body = ngx.req.get_body_data()
    local data = cjson.decode(body)
    
    -- Validate input
    local rules = {
        email = {required = true, email = true},
        password = {required = true, min_length = 6}
    }
    
    local valid, errors = validation.validate(data, rules)
    if not valid then
        ngx.status = 400
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Validation failed", errors = errors}))
        return
    end
    
    -- Find user
    local res, err = db.query(
        "SELECT id, email, password_hash, name, role FROM users WHERE email = $1",
        {data.email}
    )
    
    if not res or #res == 0 then
        ngx.status = 401
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Invalid credentials"}))
        return
    end
    
    local user = res[1]
    
    -- Verify password
    if not password.verify(data.password, user.password_hash) then
        ngx.status = 401
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Invalid credentials"}))
        return
    end
    
    -- Generate tokens
    local access_token = jwt.generate({
        user_id = user.id,
        email = user.email,
        role = user.role
    })
    
    local refresh_token = jwt.generate_refresh(user.id)
    
    -- Return response
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({
        access_token = access_token,
        refresh_token = refresh_token,
        user = {
            id = user.id,
            email = user.email,
            name = user.name,
            role = user.role
        }
    }))
end

-- Register
function _M.register()
    ngx.req.read_body()
    local body = ngx.req.get_body_data()
    local data = cjson.decode(body)
    
    -- Validate input
    local rules = {
        email = {required = true, email = true},
        password = {required = true, min_length = 6},
        name = {required = true, min_length = 2}
    }
    
    local valid, errors = validation.validate(data, rules)
    if not valid then
        ngx.status = 400
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Validation failed", errors = errors}))
        return
    end
    
    -- Check if user exists
    local existing, err = db.query(
        "SELECT id FROM users WHERE email = $1",
        {data.email}
    )
    
    if existing and #existing > 0 then
        ngx.status = 409
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "User already exists"}))
        return
    end
    
    -- Hash password
    local password_hash = password.hash(data.password)
    
    -- Create user
    local res, err = db.query(
        "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id",
        {data.email, password_hash, data.name, "user"}
    )
    
    if not res then
        ngx.log(ngx.ERR, "Failed to create user: ", err)
        ngx.status = 500
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Failed to create user"}))
        return
    end
    
    local user_id = res[1].id
    
    -- Generate tokens
    local access_token = jwt.generate({
        user_id = user_id,
        email = data.email,
        role = "user"
    })
    
    local refresh_token = jwt.generate_refresh(user_id)
    
    -- Return response
    ngx.status = 201
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({
        access_token = access_token,
        refresh_token = refresh_token,
        user = {
            id = user_id,
            email = data.email,
            name = data.name,
            role = "user"
        }
    }))
end

-- Refresh token
function _M.refresh()
    ngx.req.read_body()
    local body = ngx.req.get_body_data()
    local data = cjson.decode(body)
    
    if not data.refresh_token then
        ngx.status = 400
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Refresh token required"}))
        return
    end
    
    -- Verify refresh token
    local payload, err = jwt.verify(data.refresh_token)
    
    if not payload or payload.type ~= "refresh" then
        ngx.status = 401
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Invalid refresh token"}))
        return
    end
    
    -- Get user
    local res, err = db.query(
        "SELECT id, email, role FROM users WHERE id = $1",
        {payload.user_id}
    )
    
    if not res or #res == 0 then
        ngx.status = 401
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "User not found"}))
        return
    end
    
    local user = res[1]
    
    -- Generate new access token
    local access_token = jwt.generate({
        user_id = user.id,
        email = user.email,
        role = user.role
    })
    
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({
        access_token = access_token
    }))
end

-- Get profile
function _M.profile()
    auth_middleware.require_auth()
    
    local user_id = ngx.ctx.user.user_id
    
    local res, err = db.query(
        "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
        {user_id}
    )
    
    if not res or #res == 0 then
        ngx.status = 404
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "User not found"}))
        return
    end
    
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode(res[1]))
end

return _M
`,

    // Validation library
    'lua/lib/validation.lua': `local _M = {}

-- Email validation pattern
local email_pattern = "^[A-Za-z0-9%.%%%+%-]+@[A-Za-z0-9%.%%%+%-]+%.%w%w%w?%w?$"

-- Validation rules
local validators = {
    required = function(value, param)
        if value == nil or value == "" then
            return false, "is required"
        end
        return true
    end,
    
    email = function(value, param)
        if not value or not value:match(email_pattern) then
            return false, "must be a valid email"
        end
        return true
    end,
    
    min_length = function(value, length)
        if not value or #value < length then
            return false, "must be at least " .. length .. " characters"
        end
        return true
    end,
    
    max_length = function(value, length)
        if value and #value > length then
            return false, "must be at most " .. length .. " characters"
        end
        return true
    end,
    
    numeric = function(value, param)
        if not tonumber(value) then
            return false, "must be a number"
        end
        return true
    end,
    
    min = function(value, min_val)
        local num = tonumber(value)
        if not num or num < min_val then
            return false, "must be at least " .. min_val
        end
        return true
    end,
    
    max = function(value, max_val)
        local num = tonumber(value)
        if not num or num > max_val then
            return false, "must be at most " .. max_val
        end
        return true
    end
}

-- Validate data against rules
function _M.validate(data, rules)
    local errors = {}
    local valid = true
    
    for field, field_rules in pairs(rules) do
        local value = data[field]
        local field_errors = {}
        
        for rule_name, rule_param in pairs(field_rules) do
            local validator = validators[rule_name]
            if validator then
                local ok, err = validator(value, rule_param)
                if not ok then
                    table.insert(field_errors, err)
                    valid = false
                end
            end
        end
        
        if #field_errors > 0 then
            errors[field] = field_errors
        end
    end
    
    return valid, errors
end

return _M
`,

    // User routes (example CRUD)
    'lua/routes/users.lua': `local cjson = require "cjson"
local db = require "db"
local auth_middleware = require "middleware.auth"
local validation = require "lib.validation"

local _M = {}

-- List users
function _M.list()
    auth_middleware.require_auth()
    
    -- Pagination
    local page = tonumber(ngx.var.arg_page) or 1
    local per_page = tonumber(ngx.var.arg_per_page) or 20
    local offset = (page - 1) * per_page
    
    -- Get total count
    local count_res = db.query("SELECT COUNT(*) as total FROM users")
    local total = count_res[1].total
    
    -- Get users
    local res, err = db.query(
        "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        {per_page, offset}
    )
    
    if not res then
        ngx.log(ngx.ERR, "Failed to get users: ", err)
        ngx.status = 500
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Failed to get users"}))
        return
    end
    
    ngx.header["Content-Type"] = "application/json"
    ngx.header["X-Total-Count"] = total
    ngx.header["X-Page"] = page
    ngx.header["X-Per-Page"] = per_page
    ngx.say(cjson.encode(res))
end

-- Get user by ID
function _M.get()
    auth_middleware.require_auth()
    
    local user_id = ngx.ctx.params.id
    
    local res, err = db.query(
        "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
        {user_id}
    )
    
    if not res or #res == 0 then
        ngx.status = 404
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "User not found"}))
        return
    end
    
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode(res[1]))
end

-- Create user (admin only)
function _M.create()
    auth_middleware.require_admin()
    
    ngx.req.read_body()
    local body = ngx.req.get_body_data()
    local data = cjson.decode(body)
    
    -- Validate input
    local rules = {
        email = {required = true, email = true},
        name = {required = true, min_length = 2},
        role = {required = true}
    }
    
    local valid, errors = validation.validate(data, rules)
    if not valid then
        ngx.status = 400
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Validation failed", errors = errors}))
        return
    end
    
    -- Create user with random password
    local temp_password = ngx.encode_base64(ngx.sha1_bin(ngx.time() .. math.random()))
    
    local res, err = db.query(
        "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id",
        {data.email, temp_password, data.name, data.role}
    )
    
    if not res then
        ngx.log(ngx.ERR, "Failed to create user: ", err)
        ngx.status = 500
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Failed to create user"}))
        return
    end
    
    ngx.status = 201
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({
        id = res[1].id,
        email = data.email,
        name = data.name,
        role = data.role
    }))
end

-- Update user
function _M.update()
    auth_middleware.require_auth()
    
    local user_id = ngx.ctx.params.id
    
    -- Check authorization
    if ngx.ctx.user.user_id ~= tonumber(user_id) and ngx.ctx.user.role ~= "admin" then
        ngx.status = 403
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Forbidden"}))
        return
    end
    
    ngx.req.read_body()
    local body = ngx.req.get_body_data()
    local data = cjson.decode(body)
    
    -- Build update query
    local updates = {}
    local values = {}
    local index = 1
    
    if data.name then
        table.insert(updates, "name = $" .. index)
        table.insert(values, data.name)
        index = index + 1
    end
    
    if data.email then
        table.insert(updates, "email = $" .. index)
        table.insert(values, data.email)
        index = index + 1
    end
    
    if #updates == 0 then
        ngx.status = 400
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "No fields to update"}))
        return
    end
    
    table.insert(values, user_id)
    
    local sql = "UPDATE users SET " .. table.concat(updates, ", ") .. " WHERE id = $" .. index
    
    local res, err = db.query(sql, values)
    
    if not res then
        ngx.log(ngx.ERR, "Failed to update user: ", err)
        ngx.status = 500
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Failed to update user"}))
        return
    end
    
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({message = "User updated successfully"}))
end

-- Delete user (admin only)
function _M.delete()
    auth_middleware.require_admin()
    
    local user_id = ngx.ctx.params.id
    
    local res, err = db.query("DELETE FROM users WHERE id = $1", {user_id})
    
    if not res then
        ngx.log(ngx.ERR, "Failed to delete user: ", err)
        ngx.status = 500
        ngx.header["Content-Type"] = "application/json"
        ngx.say(cjson.encode({error = "Failed to delete user"}))
        return
    end
    
    ngx.status = 204
end

return _M
`,

    // Product routes stub
    'lua/routes/products.lua': `local cjson = require "cjson"
local db = require "db"
local auth_middleware = require "middleware.auth"

local _M = {}

function _M.list()
    -- Implementation here
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({products = {}}))
end

function _M.get()
    local product_id = ngx.ctx.params.id
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({id = product_id, name = "Sample Product"}))
end

function _M.create()
    auth_middleware.require_auth()
    ngx.status = 201
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({message = "Product created"}))
end

function _M.update()
    auth_middleware.require_auth()
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({message = "Product updated"}))
end

function _M.delete()
    auth_middleware.require_admin()
    ngx.status = 204
end

return _M
`,

    // Order routes stub
    'lua/routes/orders.lua': `local cjson = require "cjson"
local db = require "db"
local auth_middleware = require "middleware.auth"

local _M = {}

function _M.list()
    auth_middleware.require_auth()
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({orders = {}}))
end

function _M.get()
    auth_middleware.require_auth()
    local order_id = ngx.ctx.params.id
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({id = order_id, status = "pending"}))
end

function _M.create()
    auth_middleware.require_auth()
    ngx.status = 201
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({message = "Order created"}))
end

function _M.update()
    auth_middleware.require_auth()
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({message = "Order updated"}))
end

function _M.delete()
    auth_middleware.require_admin()
    ngx.status = 204
end

return _M
`,

    // Database schema
    'schema.sql': `-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_name ON products(name);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
`,

    // Environment configuration
    '.env.example': `# Application
APP_ENV=development
APP_DEBUG=true
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp_development
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT=10000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
REDIS_POOL_SIZE=10
REDIS_KEEPALIVE_TIMEOUT=60000

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# Rate Limiting
RATE_LIMIT_RATE=100
RATE_LIMIT_WINDOW=60
`,

    // LuaRocks configuration
    'luarocks-config.lua': `-- LuaRocks configuration for OpenResty
rocks_trees = {
   { name = "user", root = home .. "/.luarocks" },
   { name = "system", root = "/usr/local" }}

variables = {
   LUA_DIR = "/usr/local/openresty/luajit",
   LUA_INCDIR = "/usr/local/openresty/luajit/include/luajit-2.1",
   LUA_BINDIR = "/usr/local/openresty/luajit/bin",
   LUA_VERSION = "5.1",
   LUA = "/usr/local/openresty/luajit/bin/luajit"}
`,

    // Makefile
    'Makefile': `.PHONY: install test run dev build clean migrate

# Install dependencies
install:
	@echo "Installing LuaRocks dependencies..."
	luarocks install lua-resty-jwt
	luarocks install pgmoon
	luarocks install bcrypt
	luarocks install busted
	luarocks install luacov

# Run tests
test:
	@echo "Running tests..."
	busted spec/

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	busted --coverage spec/
	luacov
	@echo "Coverage report generated in luacov.report.out"

# Run development server
dev:
	@echo "Starting development server..."
	openresty -p . -c nginx.conf -g 'daemon off;'

# Run production server
run:
	@echo "Starting production server..."
	openresty -p . -c nginx.conf

# Stop server
stop:
	@echo "Stopping server..."
	openresty -p . -s stop

# Reload configuration
reload:
	@echo "Reloading configuration..."
	openresty -p . -s reload

# Run database migrations
migrate:
	@echo "Running database migrations..."
	psql -h localhost -U postgres -d myapp_development -f schema.sql

# Clean logs and temp files
clean:
	@echo "Cleaning up..."
	rm -rf logs/*.log
	rm -rf logs/*.pid
	rm -f luacov.*.out

# Format Lua code
format:
	@echo "Formatting Lua code..."
	find lua -name "*.lua" -exec lua-format -i {} \\;

# Lint Lua code
lint:
	@echo "Linting Lua code..."
	luacheck lua/
`,

    // Test spec example
    'spec/auth_spec.lua': `describe("Authentication", function()
    local jwt = require "lib.jwt"
    local password = require "lib.password"
    
    describe("JWT", function()
        it("should generate valid token", function()
            local payload = {user_id = 1, email = "test@example.com"}
            local token = jwt.generate(payload)
            
            assert.is_string(token)
            assert.is_true(#token > 0)
        end)
        
        it("should verify valid token", function()
            local payload = {user_id = 1, email = "test@example.com"}
            local token = jwt.generate(payload)
            
            local verified, err = jwt.verify(token)
            assert.is_nil(err)
            assert.are.equal(verified.user_id, 1)
            assert.are.equal(verified.email, "test@example.com")
        end)
        
        it("should reject invalid token", function()
            local verified, err = jwt.verify("invalid.token.here")
            assert.is_nil(verified)
            assert.is_string(err)
        end)
    end)
    
    describe("Password", function()
        it("should hash password", function()
            local hash = password.hash("mypassword")
            assert.is_string(hash)
            assert.is_true(#hash > 0)
        end)
        
        it("should verify correct password", function()
            local hash = password.hash("mypassword")
            local valid = password.verify("mypassword", hash)
            assert.is_true(valid)
        end)
        
        it("should reject incorrect password", function()
            local hash = password.hash("mypassword")
            local valid = password.verify("wrongpassword", hash)
            assert.is_false(valid)
        end)
    end)
end)
`,

    // Docker configuration
    'Dockerfile': `FROM openresty/openresty:1.25.3.1-alpine

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \\
    gcc \\
    musl-dev \\
    make \\
    git \\
    postgresql-dev \\
    && apk add --no-cache \\
    postgresql-client \\
    bash \\
    curl

# Install LuaRocks
RUN wget https://luarocks.org/releases/luarocks-3.9.2.tar.gz && \\
    tar zxpf luarocks-3.9.2.tar.gz && \\
    cd luarocks-3.9.2 && \\
    ./configure --prefix=/usr/local/openresty/luajit \\
        --with-lua=/usr/local/openresty/luajit \\
        --lua-suffix=jit \\
        --with-lua-include=/usr/local/openresty/luajit/include/luajit-2.1 && \\
    make && \\
    make install && \\
    cd .. && \\
    rm -rf luarocks-3.9.2*

# Set up paths
ENV PATH="/usr/local/openresty/luajit/bin:$PATH"

# Create app directory
WORKDIR /app

# Copy configuration files
COPY luarocks-config.lua /etc/luarocks/config.lua
COPY Makefile ./

# Install Lua dependencies
RUN luarocks install lua-resty-jwt && \\
    luarocks install pgmoon && \\
    luarocks install bcrypt && \\
    luarocks install lua-cjson

# Copy application files
COPY nginx.conf ./
COPY lua ./lua
COPY schema.sql ./

# Create required directories
RUN mkdir -p logs html/static

# Clean up build dependencies
RUN apk del .build-deps

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run OpenResty
CMD ["openresty", "-p", "/app", "-c", "nginx.conf", "-g", "daemon off;"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - APP_ENV=development
      - DB_HOST=postgres
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=myapp_development
      - REDIS_HOST=redis
      - JWT_SECRET=development-secret-key
    depends_on:
      - postgres
      - redis
    volumes:
      - ./lua:/app/lua
      - ./nginx.conf:/app/nginx.conf:ro
      - ./logs:/app/logs
    command: ["openresty", "-p", "/app", "-c", "nginx.conf", "-g", "daemon off;"]

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=myapp_development
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/01-schema.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`,

    // README
    'README.md': `# OpenResty Application

High-performance web application built with OpenResty (NGINX + LuaJIT).

## Features

- 🚀 High-performance web server based on NGINX
- 💨 LuaJIT for fast script execution
- 🔐 JWT authentication with refresh tokens
- 🗄️ PostgreSQL integration with pgmoon
- 🔄 Redis caching and session storage
- ⚡ Rate limiting per IP
- 🧪 Testing with Busted framework
- 🐳 Docker support
- 📝 RESTful API design
- 🛡️ CORS support

## Prerequisites

- OpenResty 1.25.3.1+
- PostgreSQL 14+
- Redis 6+
- LuaRocks 3.9+
- Docker & Docker Compose (optional)

## Installation

### Local Development

1. Install OpenResty:
\`\`\`bash
# macOS
brew install openresty

# Ubuntu/Debian
wget -O - https://openresty.org/package/pubkey.gpg | sudo apt-key add -
echo "deb http://openresty.org/package/ubuntu $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/openresty.list
sudo apt-get update
sudo apt-get install openresty

# From source
wget https://openresty.org/download/openresty-1.25.3.1.tar.gz
tar -xzvf openresty-1.25.3.1.tar.gz
cd openresty-1.25.3.1
./configure --with-pcre-jit --with-ipv6
make
sudo make install
\`\`\`

2. Install dependencies:
\`\`\`bash
make install
\`\`\`

3. Set up environment:
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

4. Run database migrations:
\`\`\`bash
make migrate
\`\`\`

### Docker Development

\`\`\`bash
docker-compose up
\`\`\`

## Running the Application

### Development Mode
\`\`\`bash
make dev
\`\`\`

### Production Mode
\`\`\`bash
make run
\`\`\`

### Stop Server
\`\`\`bash
make stop
\`\`\`

### Reload Configuration
\`\`\`bash
make reload
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

### Health Check
- \`GET /health\` - Application health status

## Testing

Run tests:
\`\`\`bash
make test
\`\`\`

Run tests with coverage:
\`\`\`bash
make test-coverage
\`\`\`

## Performance Tuning

1. **Worker Processes**: Set to number of CPU cores
2. **Worker Connections**: Increase based on expected load
3. **Lua Code Cache**: Keep enabled in production
4. **Shared Memory**: Adjust sizes based on usage
5. **Connection Pooling**: Configure for database and Redis

## Security Considerations

1. Change JWT secret in production
2. Use HTTPS in production
3. Configure proper CORS origins
4. Implement request validation
5. Use prepared statements for SQL
6. Rate limit sensitive endpoints

## Monitoring

- Access logs: \`logs/access.log\`
- Error logs: \`logs/error.log\`
- Monitor shared memory usage
- Track response times
- Watch connection pool usage

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

# Environment
.env
.env.*
!.env.example

# LuaRocks
.luarocks/
luarocks/

# Coverage
luacov.*.out
luacov.report.out

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Build artifacts
*.rock

# nginx
*.pid
client_body_temp/
fastcgi_temp/
proxy_temp/
scgi_temp/
uwsgi_temp/

# Test artifacts
.busted
`,

    // LuaCheck configuration
    '.luacheckrc': `return {
    globals = {
        "ngx",
        "ndk"},
    ignore = {
        "212", -- Unused argument
        "213", -- Unused loop variable
    },
    files = {
        ["spec/*.lua"] = {
            globals = {
                "describe",
                "it",
                "before_each",
                "after_each",
                "assert",
                "spy",
                "stub",
                "mock"}}}}
`
  }
};