import { BackendTemplate } from '../types';

export const luaHttpTemplate: BackendTemplate = {
  id: 'lua-http',
  name: 'lua-http',
  displayName: 'lua-http',
  description: 'Pure Lua HTTP server and client library with async support and HTTP/2 capabilities',
  language: 'lua',
  framework: 'lua-http',
  version: '0.4',
  tags: ['lua', 'http', 'http2', 'websockets', 'coroutines', 'pure-lua'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'websockets', 'logging', 'validation', 'testing', 'docker'],
  
  files: {
    // Main server file
    'server.lua': `#!/usr/bin/env lua

local http_server = require "http.server"
local http_headers = require "http.headers"
local websocket = require "http.websocket"
local cqueues = require "cqueues"
local json = require "json"
local router = require "router"
local middleware = require "middleware"
local config = require "config"

-- Create main loop
local cq = cqueues.new()

-- Create server
local server = assert(http_server.listen {
    host = config.host;
    port = config.port;
    onstream = function(server, stream)
        -- Handle the request in a coroutine
        cq:wrap(function()
            local req_headers = assert(stream:get_headers())
            local req_method = req_headers:get(":method")
            local req_path = req_headers:get(":path")
            
            -- Apply middleware
            local ctx = {
                stream = stream,
                headers = req_headers,
                method = req_method,
                path = req_path,
                params = {},
                body = nil
            }
            
            -- CORS middleware
            local cors_result = middleware.cors(ctx)
            if cors_result then
                return
            end
            
            -- Rate limiting
            local rate_limit_result = middleware.rate_limit(ctx)
            if rate_limit_result then
                return
            end
            
            -- Parse body if needed
            if req_method == "POST" or req_method == "PUT" or req_method == "PATCH" then
                local body = assert(stream:get_body_as_string())
                if body and #body > 0 then
                    local content_type = req_headers:get("content-type") or ""
                    if content_type:match("application/json") then
                        ctx.body = json.decode(body)
                    else
                        ctx.body = body
                    end
                end
            end
            
            -- Route request
            router.dispatch(ctx)
        end)
    end;
    onerror = function(server, context, op, err, errno)
        local msg = op .. " on " .. tostring(context) .. " failed"
        if err then
            msg = msg .. ": " .. tostring(err)
        end
        io.stderr:write(msg, "\\n")
    end;
})

-- Add WebSocket support
server:add_socket_wrapper(function(socket)
    return websocket.new_from_socket(socket)
end)

print(string.format("Server listening on http://%s:%d", config.host, config.port))

-- Add server to main loop
cq:wrap(function()
    assert(server:loop())
end)

-- Health check endpoint
cq:wrap(function()
    while true do
        -- This could be used for periodic health checks
        cqueues.sleep(60)
    end
end)

-- Run main loop
assert(cq:loop())
`,

    // Configuration
    'config.lua': `local M = {}

-- Server configuration
M.host = os.getenv("HOST") or "127.0.0.1"
M.port = tonumber(os.getenv("PORT")) or 8080

-- Database configuration
M.database = {
    driver = "postgres",
    host = os.getenv("DB_HOST") or "localhost",
    port = tonumber(os.getenv("DB_PORT")) or 5432,
    database = os.getenv("DB_NAME") or "myapp_development",
    user = os.getenv("DB_USER") or "postgres",
    password = os.getenv("DB_PASSWORD") or "postgres"
}

-- Security
M.jwt_secret = os.getenv("JWT_SECRET") or "change-this-in-production"
M.jwt_expiration = tonumber(os.getenv("JWT_EXPIRATION")) or 3600

-- Rate limiting
M.rate_limit = {
    requests = tonumber(os.getenv("RATE_LIMIT_REQUESTS")) or 100,
    window = tonumber(os.getenv("RATE_LIMIT_WINDOW")) or 60
}

-- Logging
M.log_level = os.getenv("LOG_LEVEL") or "info"

return M
`,

    // Router
    'router.lua': `local http_headers = require "http.headers"
local json = require "json"
local auth = require "routes.auth"
local users = require "routes.users"
local products = require "routes.products"
local health = require "routes.health"
local ws = require "routes.websocket"

local M = {}

-- Route definitions
local routes = {
    -- Health check
    ["GET /health"] = health.check,
    
    -- WebSocket
    ["GET /ws"] = ws.handle,
    
    -- Auth routes
    ["POST /api/auth/login"] = auth.login,
    ["POST /api/auth/register"] = auth.register,
    ["POST /api/auth/refresh"] = auth.refresh,
    ["GET /api/auth/profile"] = auth.profile,
    
    -- User routes
    ["GET /api/users"] = users.list,
    ["GET /api/users/:id"] = users.get,
    ["POST /api/users"] = users.create,
    ["PUT /api/users/:id"] = users.update,
    ["DELETE /api/users/:id"] = users.delete,
    
    -- Product routes
    ["GET /api/products"] = products.list,
    ["GET /api/products/:id"] = products.get,
    ["POST /api/products"] = products.create,
    ["PUT /api/products/:id"] = products.update,
    ["DELETE /api/products/:id"] = products.delete}

-- Pattern matching for routes
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
            -- Convert :param to captures
            local regex_pattern = path_pattern:gsub(":(%w+)", "([^/]+)")
            regex_pattern = "^" .. regex_pattern .. "$"
            
            local matches = {path:match(regex_pattern)}
            if #matches > 0 then
                local params = {}
                local param_names = {}
                
                -- Extract parameter names
                for param_name in path_pattern:gmatch(":(%w+)") do
                    table.insert(param_names, param_name)
                end
                
                -- Map values to parameter names
                for i, value in ipairs(matches) do
                    params[param_names[i]] = value
                end
                
                return handler, params
            end
        end
    end
    
    return nil, {}
end

-- Send JSON response
local function send_json(ctx, status, data)
    local response_headers = http_headers.new()
    response_headers:append(":status", tostring(status))
    response_headers:append("content-type", "application/json")
    
    assert(ctx.stream:write_headers(response_headers, false))
    assert(ctx.stream:write_body_from_string(json.encode(data)))
end

-- Send error response
local function send_error(ctx, status, message)
    send_json(ctx, status, {error = message})
end

-- Dispatch request
function M.dispatch(ctx)
    local handler, params = match_route(ctx.method, ctx.path)
    
    if not handler then
        send_error(ctx, 404, "Not found")
        return
    end
    
    -- Add params to context
    ctx.params = params
    ctx.send_json = send_json
    ctx.send_error = send_error
    
    -- Call handler
    local ok, err = pcall(handler, ctx)
    if not ok then
        io.stderr:write("Handler error: ", err, "\\n")
        send_error(ctx, 500, "Internal server error")
    end
end

return M
`,

    // Middleware
    'middleware.lua': `local http_headers = require "http.headers"
local json = require "json"
local jwt = require "lib.jwt"
local config = require "config"

local M = {}

-- Rate limiting storage
local rate_limit_store = {}

-- CORS middleware
function M.cors(ctx)
    local res_headers = http_headers.new()
    res_headers:append("access-control-allow-origin", "*")
    res_headers:append("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
    res_headers:append("access-control-allow-headers", "Content-Type, Authorization")
    
    if ctx.method == "OPTIONS" then
        res_headers:append(":status", "204")
        res_headers:append("access-control-max-age", "86400")
        assert(ctx.stream:write_headers(res_headers, true))
        return true
    end
    
    -- Add CORS headers to response
    ctx.cors_headers = res_headers
    return false
end

-- Rate limiting middleware
function M.rate_limit(ctx)
    local client_ip = ctx.headers:get("x-forwarded-for") or "unknown"
    local now = os.time()
    local key = "rate:" .. client_ip
    
    -- Clean old entries
    local window_start = now - config.rate_limit.window
    if rate_limit_store[key] then
        local new_requests = {}
        for _, timestamp in ipairs(rate_limit_store[key]) do
            if timestamp > window_start then
                table.insert(new_requests, timestamp)
            end
        end
        rate_limit_store[key] = new_requests
    else
        rate_limit_store[key] = {}
    end
    
    -- Check rate limit
    if #rate_limit_store[key] >= config.rate_limit.requests then
        local res_headers = http_headers.new()
        res_headers:append(":status", "429")
        res_headers:append("content-type", "application/json")
        res_headers:append("retry-after", tostring(config.rate_limit.window))
        
        assert(ctx.stream:write_headers(res_headers, false))
        assert(ctx.stream:write_body_from_string(json.encode({
            error = "Rate limit exceeded"
        })))
        return true
    end
    
    -- Add current request
    table.insert(rate_limit_store[key], now)
    return false
end

-- Authentication middleware
function M.require_auth(ctx)
    local auth_header = ctx.headers:get("authorization")
    if not auth_header then
        ctx.send_error(ctx, 401, "No authorization header")
        return true
    end
    
    local token = auth_header:match("Bearer%s+(.+)")
    if not token then
        ctx.send_error(ctx, 401, "Invalid authorization format")
        return true
    end
    
    local payload, err = jwt.verify(token)
    if not payload then
        ctx.send_error(ctx, 401, err or "Invalid token")
        return true
    end
    
    ctx.user = payload
    return false
end

-- Admin required middleware
function M.require_admin(ctx)
    if M.require_auth(ctx) then
        return true
    end
    
    if ctx.user.role ~= "admin" then
        ctx.send_error(ctx, 403, "Admin access required")
        return true
    end
    
    return false
end

return M
`,

    // JWT library
    'lib/jwt.lua': `local json = require "json"
local base64 = require "base64"
local hmac = require "openssl.hmac"
local config = require "config"

local M = {}

-- Base64 URL encoding
local function base64_url_encode(str)
    local b64 = base64.encode(str)
    b64 = b64:gsub("+", "-"):gsub("/", "_"):gsub("=", "")
    return b64
end

-- Base64 URL decoding
local function base64_url_decode(str)
    str = str:gsub("-", "+"):gsub("_", "/")
    local padding = 4 - (#str % 4)
    if padding ~= 4 then
        str = str .. string.rep("=", padding)
    end
    return base64.decode(str)
end

-- Generate JWT token
function M.generate(payload)
    payload.exp = os.time() + config.jwt_expiration
    payload.iat = os.time()
    
    local header = {
        typ = "JWT",
        alg = "HS256"
    }
    
    local header_encoded = base64_url_encode(json.encode(header))
    local payload_encoded = base64_url_encode(json.encode(payload))
    
    local message = header_encoded .. "." .. payload_encoded
    local signature = hmac.new(config.jwt_secret, "sha256"):final(message)
    local signature_encoded = base64_url_encode(signature)
    
    return message .. "." .. signature_encoded
end

-- Generate refresh token
function M.generate_refresh(user_id)
    local payload = {
        user_id = user_id,
        type = "refresh",
        exp = os.time() + (7 * 24 * 60 * 60), -- 7 days
        iat = os.time()
    }
    
    return M.generate(payload)
end

-- Verify JWT token
function M.verify(token)
    local parts = {}
    for part in token:gmatch("[^.]+") do
        table.insert(parts, part)
    end
    
    if #parts ~= 3 then
        return nil, "Invalid token format"
    end
    
    local header_encoded, payload_encoded, signature_encoded = parts[1], parts[2], parts[3]
    
    -- Verify signature
    local message = header_encoded .. "." .. payload_encoded
    local expected_signature = hmac.new(config.jwt_secret, "sha256"):final(message)
    local expected_signature_encoded = base64_url_encode(expected_signature)
    
    if signature_encoded ~= expected_signature_encoded then
        return nil, "Invalid signature"
    end
    
    -- Decode payload
    local payload = json.decode(base64_url_decode(payload_encoded))
    
    -- Check expiration
    if payload.exp and payload.exp < os.time() then
        return nil, "Token expired"
    end
    
    return payload
end

return M
`,

    // Base64 library
    'lib/base64.lua': `-- Simple base64 encoding/decoding
local M = {}

local b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function M.encode(data)
    return ((data:gsub('.', function(x) 
        local r,b='',x:byte()
        for i=8,1,-1 do r=r..(b%2^i-b%2^(i-1)>0 and '1' or '0') end
        return r;
    end)..'0000'):gsub('%d%d%d?%d?%d?%d?', function(x)
        if (#x < 6) then return '' end
        local c=0
        for i=1,6 do c=c+(x:sub(i,i)=='1' and 2^(6-i) or 0) end
        return b64chars:sub(c+1,c+1)
    end)..({ '', '==', '=' })[#data%3+1])
end

function M.decode(data)
    data = string.gsub(data, '[^'..b64chars..'=]', '')
    return (data:gsub('.', function(x)
        if (x == '=') then return '' end
        local r,f='',(b64chars:find(x)-1)
        for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
        return r;
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if (#x ~= 8) then return '' end
        local c=0
        for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
        return string.char(c)
    end))
end

return M
`,

    // Database module
    'lib/db.lua': `local pgmoon = require "pgmoon"
local config = require "config"

local M = {}

-- Connection pool
local connections = {}
local max_connections = 10

-- Get connection
function M.get_connection()
    -- Try to reuse existing connection
    for i, conn in ipairs(connections) do
        if conn.available then
            conn.available = false
            return conn.pg
        end
    end
    
    -- Create new connection if pool not full
    if #connections < max_connections then
        local pg = pgmoon.new(config.database)
        local ok, err = pg:connect()
        if not ok then
            return nil, err
        end
        
        table.insert(connections, {
            pg = pg,
            available = false
        })
        
        return pg
    end
    
    return nil, "Connection pool exhausted"
end

-- Release connection
function M.release_connection(pg)
    for i, conn in ipairs(connections) do
        if conn.pg == pg then
            conn.available = true
            return
        end
    end
end

-- Execute query
function M.query(sql, ...)
    local pg, err = M.get_connection()
    if not pg then
        return nil, err
    end
    
    local res, err = pg:query(sql, ...)
    M.release_connection(pg)
    
    return res, err
end

-- Execute in transaction
function M.transaction(callback)
    local pg, err = M.get_connection()
    if not pg then
        return nil, err
    end
    
    pg:query("BEGIN")
    
    local ok, result = pcall(callback, pg)
    
    if ok then
        pg:query("COMMIT")
        M.release_connection(pg)
        return result
    else
        pg:query("ROLLBACK")
        M.release_connection(pg)
        return nil, result
    end
end

return M
`,

    // Password hashing
    'lib/password.lua': `local bcrypt = require "bcrypt"

local M = {}

function M.hash(password)
    return bcrypt.digest(password, 10)
end

function M.verify(password, hash)
    return bcrypt.verify(password, hash)
end

return M
`,

    // Routes - Health
    'routes/health.lua': `local json = require "json"
local db = require "lib.db"

local M = {}

function M.check(ctx)
    local health = {
        status = "healthy",
        timestamp = os.time(),
        services = {}
    }
    
    -- Check database
    local db_ok = false
    local res, err = db.query("SELECT 1 as test")
    if res and res[1] and res[1].test == 1 then
        db_ok = true
    end
    
    health.services.database = {
        status = db_ok and "healthy" or "unhealthy",
        error = not db_ok and err or nil
    }
    
    -- Overall status
    if not db_ok then
        health.status = "degraded"
        ctx.send_json(ctx, 503, health)
    else
        ctx.send_json(ctx, 200, health)
    end
end

return M
`,

    // Routes - Auth
    'routes/auth.lua': `local json = require "json"
local db = require "lib.db"
local jwt = require "lib.jwt"
local password = require "lib.password"
local middleware = require "middleware"

local M = {}

function M.login(ctx)
    if not ctx.body or not ctx.body.email or not ctx.body.password then
        ctx.send_error(ctx, 400, "Email and password required")
        return
    end
    
    -- Find user
    local res, err = db.query(
        "SELECT id, email, password_hash, name, role FROM users WHERE email = $1",
        ctx.body.email
    )
    
    if not res or #res == 0 then
        ctx.send_error(ctx, 401, "Invalid credentials")
        return
    end
    
    local user = res[1]
    
    -- Verify password
    if not password.verify(ctx.body.password, user.password_hash) then
        ctx.send_error(ctx, 401, "Invalid credentials")
        return
    end
    
    -- Generate tokens
    local access_token = jwt.generate({
        user_id = user.id,
        email = user.email,
        role = user.role
    })
    
    local refresh_token = jwt.generate_refresh(user.id)
    
    ctx.send_json(ctx, 200, {
        access_token = access_token,
        refresh_token = refresh_token,
        user = {
            id = user.id,
            email = user.email,
            name = user.name,
            role = user.role
        }
    })
end

function M.register(ctx)
    if not ctx.body or not ctx.body.email or not ctx.body.password then
        ctx.send_error(ctx, 400, "Email and password required")
        return
    end
    
    -- Check if user exists
    local existing = db.query(
        "SELECT id FROM users WHERE email = $1",
        ctx.body.email
    )
    
    if existing and #existing > 0 then
        ctx.send_error(ctx, 409, "User already exists")
        return
    end
    
    -- Hash password
    local password_hash = password.hash(ctx.body.password)
    
    -- Create user
    local res, err = db.query(
        "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id",
        ctx.body.email,
        password_hash,
        ctx.body.name or "",
        "user"
    )
    
    if not res then
        ctx.send_error(ctx, 500, "Failed to create user")
        return
    end
    
    local user_id = res[1].id
    
    -- Generate tokens
    local access_token = jwt.generate({
        user_id = user_id,
        email = ctx.body.email,
        role = "user"
    })
    
    local refresh_token = jwt.generate_refresh(user_id)
    
    ctx.send_json(ctx, 201, {
        access_token = access_token,
        refresh_token = refresh_token,
        user = {
            id = user_id,
            email = ctx.body.email,
            name = ctx.body.name,
            role = "user"
        }
    })
end

function M.refresh(ctx)
    if not ctx.body or not ctx.body.refresh_token then
        ctx.send_error(ctx, 400, "Refresh token required")
        return
    end
    
    -- Verify refresh token
    local payload, err = jwt.verify(ctx.body.refresh_token)
    
    if not payload or payload.type ~= "refresh" then
        ctx.send_error(ctx, 401, "Invalid refresh token")
        return
    end
    
    -- Get user
    local res = db.query(
        "SELECT id, email, role FROM users WHERE id = $1",
        payload.user_id
    )
    
    if not res or #res == 0 then
        ctx.send_error(ctx, 401, "User not found")
        return
    end
    
    local user = res[1]
    
    -- Generate new access token
    local access_token = jwt.generate({
        user_id = user.id,
        email = user.email,
        role = user.role
    })
    
    ctx.send_json(ctx, 200, {
        access_token = access_token
    })
end

function M.profile(ctx)
    if middleware.require_auth(ctx) then
        return
    end
    
    local res = db.query(
        "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
        ctx.user.user_id
    )
    
    if not res or #res == 0 then
        ctx.send_error(ctx, 404, "User not found")
        return
    end
    
    ctx.send_json(ctx, 200, res[1])
end

return M
`,

    // Routes - Users
    'routes/users.lua': `local json = require "json"
local db = require "lib.db"
local middleware = require "middleware"

local M = {}

function M.list(ctx)
    if middleware.require_auth(ctx) then
        return
    end
    
    local page = tonumber(ctx.params.page) or 1
    local per_page = tonumber(ctx.params.per_page) or 20
    local offset = (page - 1) * per_page
    
    -- Get total count
    local count_res = db.query("SELECT COUNT(*) as total FROM users")
    local total = count_res[1].total
    
    -- Get users
    local res = db.query(
        "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        per_page,
        offset
    )
    
    ctx.send_json(ctx, 200, {
        users = res,
        page = page,
        per_page = per_page,
        total = total
    })
end

function M.get(ctx)
    if middleware.require_auth(ctx) then
        return
    end
    
    local res = db.query(
        "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
        ctx.params.id
    )
    
    if not res or #res == 0 then
        ctx.send_error(ctx, 404, "User not found")
        return
    end
    
    ctx.send_json(ctx, 200, res[1])
end

function M.create(ctx)
    if middleware.require_admin(ctx) then
        return
    end
    
    if not ctx.body or not ctx.body.email then
        ctx.send_error(ctx, 400, "Email required")
        return
    end
    
    -- Create user with temporary password
    local temp_password = "temp123456"
    local password_hash = require("lib.password").hash(temp_password)
    
    local res = db.query(
        "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id",
        ctx.body.email,
        password_hash,
        ctx.body.name or "",
        ctx.body.role or "user"
    )
    
    if not res then
        ctx.send_error(ctx, 500, "Failed to create user")
        return
    end
    
    ctx.send_json(ctx, 201, {
        id = res[1].id,
        email = ctx.body.email,
        name = ctx.body.name,
        role = ctx.body.role or "user"
    })
end

function M.update(ctx)
    if middleware.require_auth(ctx) then
        return
    end
    
    -- Check authorization
    if ctx.user.user_id ~= tonumber(ctx.params.id) and ctx.user.role ~= "admin" then
        ctx.send_error(ctx, 403, "Forbidden")
        return
    end
    
    if not ctx.body then
        ctx.send_error(ctx, 400, "No data to update")
        return
    end
    
    -- Build update query
    local updates = {}
    local values = {}
    
    if ctx.body.name then
        table.insert(updates, "name = $" .. (#values + 1))
        table.insert(values, ctx.body.name)
    end
    
    if ctx.body.email then
        table.insert(updates, "email = $" .. (#values + 1))
        table.insert(values, ctx.body.email)
    end
    
    if #updates == 0 then
        ctx.send_error(ctx, 400, "No valid fields to update")
        return
    end
    
    table.insert(values, ctx.params.id)
    local sql = "UPDATE users SET " .. table.concat(updates, ", ") .. " WHERE id = $" .. #values
    
    local res = db.query(sql, table.unpack(values))
    
    if not res then
        ctx.send_error(ctx, 500, "Failed to update user")
        return
    end
    
    ctx.send_json(ctx, 200, {message = "User updated"})
end

function M.delete(ctx)
    if middleware.require_admin(ctx) then
        return
    end
    
    local res = db.query("DELETE FROM users WHERE id = $1", ctx.params.id)
    
    if not res then
        ctx.send_error(ctx, 500, "Failed to delete user")
        return
    end
    
    ctx.send_json(ctx, 204, {})
end

return M
`,

    // Routes - Products (stub)
    'routes/products.lua': `local json = require "json"
local db = require "lib.db"
local middleware = require "middleware"

local M = {}

function M.list(ctx)
    ctx.send_json(ctx, 200, {products = {}})
end

function M.get(ctx)
    ctx.send_json(ctx, 200, {
        id = ctx.params.id,
        name = "Sample Product",
        price = 99.99
    })
end

function M.create(ctx)
    if middleware.require_admin(ctx) then
        return
    end
    
    ctx.send_json(ctx, 201, {message = "Product created"})
end

function M.update(ctx)
    if middleware.require_admin(ctx) then
        return
    end
    
    ctx.send_json(ctx, 200, {message = "Product updated"})
end

function M.delete(ctx)
    if middleware.require_admin(ctx) then
        return
    end
    
    ctx.send_json(ctx, 204, {})
end

return M
`,

    // WebSocket handler
    'routes/websocket.lua': `local websocket = require "http.websocket"
local json = require "json"
local middleware = require "middleware"

local M = {}

-- Active connections
local connections = {}

function M.handle(ctx)
    -- Upgrade to WebSocket
    local ws = websocket.new_from_stream(ctx.stream, ctx.headers)
    
    if not ws then
        ctx.send_error(ctx, 400, "WebSocket upgrade failed")
        return
    end
    
    -- Accept the connection
    assert(ws:accept())
    
    -- Add to connections
    local conn_id = tostring(ws)
    connections[conn_id] = ws
    
    -- Send welcome message
    ws:send(json.encode({
        type = "welcome",
        message = "Connected to WebSocket"
    }))
    
    -- Handle messages
    while true do
        local data, err = ws:receive()
        
        if not data then
            break
        end
        
        -- Parse message
        local ok, msg = pcall(json.decode, data)
        if ok and msg then
            -- Handle different message types
            if msg.type == "ping" then
                ws:send(json.encode({
                    type = "pong",
                    timestamp = os.time()
                }))
            elseif msg.type == "broadcast" then
                -- Broadcast to all connections
                for id, conn in pairs(connections) do
                    if id ~= conn_id then
                        pcall(function()
                            conn:send(json.encode({
                                type = "message",
                                from = conn_id,
                                data = msg.data
                            }))
                        end)
                    end
                end
            else
                -- Echo back
                ws:send(json.encode({
                    type = "echo",
                    data = msg
                }))
            end
        end
    end
    
    -- Remove from connections
    connections[conn_id] = nil
    ws:close()
end

return M
`,

    // Database schema
    'schema.sql': `-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
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
`,

    // Test spec
    'spec/server_spec.lua': `local http_client = require "http.client"
local json = require "json"

describe("HTTP Server", function()
    local base_url = "http://localhost:8080"
    
    it("should respond to health check", function()
        local client = http_client.new()
        local headers, stream = client:request("GET", base_url .. "/health")
        
        assert.truthy(headers)
        assert.equals("200", headers:get(":status"))
        
        local body = stream:get_body_as_string()
        local data = json.decode(body)
        
        assert.equals("healthy", data.status)
    end)
    
    it("should handle 404", function()
        local client = http_client.new()
        local headers, stream = client:request("GET", base_url .. "/not-found")
        
        assert.equals("404", headers:get(":status"))
    end)
end)

describe("Authentication", function()
    local base_url = "http://localhost:8080"
    
    it("should register new user", function()
        local client = http_client.new()
        local req_headers = http_headers.new()
        req_headers:append(":method", "POST")
        req_headers:append(":path", "/api/auth/register")
        req_headers:append("content-type", "application/json")
        
        local body = json.encode({
            email = "test@example.com",
            password = "password123",
            name = "Test User"
        })
        
        local headers, stream = client:request(req_headers)
        stream:write_body_from_string(body)
        
        assert.equals("201", headers:get(":status"))
        
        local response = json.decode(stream:get_body_as_string())
        assert.truthy(response.access_token)
        assert.truthy(response.refresh_token)
    end)
end)
`,

    // Dockerfile
    'Dockerfile': `FROM alpine:3.19

# Install Lua and dependencies
RUN apk add --no-cache \\
    lua5.4 \\
    lua5.4-dev \\
    luarocks5.4 \\
    build-base \\
    openssl-dev \\
    postgresql-dev \\
    git \\
    curl

# Install Lua dependencies
RUN luarocks-5.4 install lua-http && \\
    luarocks-5.4 install cqueues && \\
    luarocks-5.4 install lpeg && \\
    luarocks-5.4 install basexx && \\
    luarocks-5.4 install lua-cjson && \\
    luarocks-5.4 install pgmoon && \\
    luarocks-5.4 install bcrypt && \\
    luarocks-5.4 install luaossl && \\
    luarocks-5.4 install busted

# Create app directory
WORKDIR /app

# Copy application files
COPY . .

# Create non-root user
RUN addgroup -g 1000 -S app && \\
    adduser -u 1000 -S app -G app && \\
    chown -R app:app /app

USER app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run server
CMD ["lua5.4", "server.lua"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - HOST=0.0.0.0
      - PORT=8080
      - DB_HOST=postgres
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=myapp_development
      - JWT_SECRET=development-secret
    depends_on:
      - postgres
    volumes:
      - ./:/app

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

volumes:
  postgres_data:
`,

    // Makefile
    'Makefile': `.PHONY: install test run dev migrate clean

# Install dependencies
install:
	@echo "Installing Lua dependencies..."
	luarocks install lua-http
	luarocks install cqueues
	luarocks install lpeg
	luarocks install basexx
	luarocks install lua-cjson
	luarocks install pgmoon
	luarocks install bcrypt
	luarocks install luaossl
	luarocks install busted

# Run tests
test:
	@echo "Running tests..."
	busted spec/

# Run development server
dev:
	@echo "Starting development server..."
	lua server.lua

# Run production server
run:
	@echo "Starting production server..."
	LUA_ENV=production lua server.lua

# Run database migrations
migrate:
	@echo "Running database migrations..."
	psql -h localhost -U postgres -d myapp_development -f schema.sql

# Clean
clean:
	@echo "Cleaning..."
	rm -f *.log

# Docker commands
docker-build:
	docker-compose build

docker-up:
	docker-compose up

docker-down:
	docker-compose down
`,

    // README
    'README.md': `# lua-http Server

Pure Lua HTTP server built with lua-http library supporting HTTP/2 and WebSockets.

## Features

- 🚀 Pure Lua implementation with async support
- 🌐 HTTP/1.1 and HTTP/2 support
- 🔌 WebSocket support
- 🔐 JWT authentication
- 🗄️ PostgreSQL integration
- ⚡ Coroutine-based async handling
- 🧪 Testing with Busted
- 🐳 Docker support
- 📝 RESTful API design

## Prerequisites

- Lua 5.3+ or LuaJIT
- PostgreSQL 14+
- LuaRocks

## Installation

1. Install dependencies:
\`\`\`bash
make install
\`\`\`

2. Create database:
\`\`\`bash
createdb myapp_development
\`\`\`

3. Run migrations:
\`\`\`bash
make migrate
\`\`\`

4. Set environment variables:
\`\`\`bash
export JWT_SECRET=your-secret-key
export DB_PASSWORD=your-db-password
\`\`\`

## Running the Server

### Development
\`\`\`bash
make dev
\`\`\`

### Production
\`\`\`bash
make run
\`\`\`

### Docker
\`\`\`bash
make docker-up
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

### WebSocket
- \`WS /ws\` - WebSocket endpoint

### Health
- \`GET /health\` - Health check

## WebSocket Usage

Connect to \`ws://localhost:8080/ws\` and send JSON messages:

\`\`\`json
{
  "type": "ping"
}

{
  "type": "broadcast",
  "data": "Hello everyone!"
}
\`\`\`

## Testing

Run tests:
\`\`\`bash
make test
\`\`\`

## Performance

lua-http is designed for high performance with:
- Coroutine-based concurrency
- HTTP/2 multiplexing
- Minimal overhead
- Efficient memory usage

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
*.log

# Environment
.env
.env.*

# Lua
*.so
*.rock
luarocks/
lua_modules/

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

# Test
.busted
luacov.*.out
`,

    // .env.example
    '.env.example': `# Server
HOST=127.0.0.1
PORT=8080

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp_development
DB_USER=postgres
DB_PASSWORD=postgres

# Security
JWT_SECRET=change-this-in-production
JWT_EXPIRATION=3600

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# Logging
LOG_LEVEL=info
`
  }
};