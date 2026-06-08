import { BackendTemplate } from '../types';

export const kongPluginTemplate: BackendTemplate = {
  id: 'kong-plugin',
  name: 'kong-plugin',
  displayName: 'Kong Plugin',
  description: 'Kong API Gateway plugin template for creating custom plugins with authentication, rate limiting, and transformation capabilities',
  language: 'lua',
  framework: 'kong',
  version: '3.5.0',
  tags: ['lua', 'kong', 'api-gateway', 'plugin', 'microservices', 'middleware'],
  port: 8000,
  dependencies: {},
  features: ['authentication', 'rate-limiting', 'logging', 'caching', 'validation', 'testing', 'docker'],
  
  files: {
    // Plugin rockspec
    'kong-plugin-myplugin-0.1.0-1.rockspec': `package = "kong-plugin-myplugin"
version = "0.1.0-1"

source = {
  url = "git://github.com/yourusername/kong-plugin-myplugin",
  tag = "0.1.0"
}

description = {
  summary = "Kong plugin for custom API gateway functionality",
  detailed = [[
    This plugin provides custom middleware functionality for Kong API Gateway,
    including request/response transformation, authentication, and rate limiting.
  ]],
  homepage = "https://github.com/yourusername/kong-plugin-myplugin",
  license = "MIT"
}

dependencies = {
  "lua >= 5.1",
  "kong >= 3.5.0"
}

build = {
  type = "builtin",
  modules = {
    ["kong.plugins.myplugin.handler"] = "kong/plugins/myplugin/handler.lua",
    ["kong.plugins.myplugin.schema"] = "kong/plugins/myplugin/schema.lua",
    ["kong.plugins.myplugin.api"] = "kong/plugins/myplugin/api.lua",
    ["kong.plugins.myplugin.daos"] = "kong/plugins/myplugin/daos.lua",
    ["kong.plugins.myplugin.migrations.init"] = "kong/plugins/myplugin/migrations/init.lua",
    ["kong.plugins.myplugin.migrations.000_base"] = "kong/plugins/myplugin/migrations/000_base.lua",
    ["kong.plugins.myplugin.migrations.001_add_ttl"] = "kong/plugins/myplugin/migrations/001_add_ttl.lua"}
}
`,

    // Main plugin handler
    'kong/plugins/myplugin/handler.lua': `local kong = kong
local ngx = ngx
local cjson = require "cjson"

local MyPlugin = {
  PRIORITY = 1000, -- Plugin execution priority
  VERSION = "0.1.0"}

-- Constructor
function MyPlugin:new()
  MyPlugin.super.new(self, "myplugin")
end

-- Executed for every request from a client and before it is proxied to the upstream service
function MyPlugin:access(conf)
  kong.log.debug("MyPlugin access phase")
  
  -- Rate limiting check
  if conf.enable_rate_limiting then
    local identifier = kong.client.get_forwarded_ip()
    local current_timestamp = ngx.now()
    local window_start = current_timestamp - conf.rate_limit_window
    
    -- Get current request count from cache
    local cache_key = "rl:" .. identifier .. ":" .. math.floor(current_timestamp / conf.rate_limit_window)
    local current_usage, err = kong.cache:get(cache_key, nil, function()
      return 0
    end)
    
    if err then
      kong.log.err("Error accessing cache: ", err)
      return
    end
    
    -- Check rate limit
    if current_usage >= conf.rate_limit_max then
      return kong.response.exit(429, {
        message = "Rate limit exceeded",
        retry_after = conf.rate_limit_window
      })
    end
    
    -- Increment counter
    local ttl = conf.rate_limit_window
    kong.cache:safe_set(cache_key, current_usage + 1, ttl)
  end
  
  -- Header injection
  if conf.add_headers then
    for header_name, header_value in pairs(conf.add_headers) do
      kong.service.request.set_header(header_name, header_value)
    end
  end
  
  -- Request transformation
  if conf.enable_request_transform then
    local body, err = kong.request.get_body()
    if body and not err then
      -- Transform request body
      if conf.request_transform_template then
        body = self:transform_body(body, conf.request_transform_template)
        kong.service.request.set_raw_body(cjson.encode(body))
      end
    end
  end
  
  -- Custom authentication
  if conf.enable_custom_auth then
    local auth_header = kong.request.get_header("Authorization")
    if not auth_header then
      return kong.response.exit(401, { message = "Missing authorization header" })
    end
    
    -- Validate token
    local is_valid = self:validate_token(auth_header, conf)
    if not is_valid then
      return kong.response.exit(401, { message = "Invalid authorization token" })
    end
  end
end

-- Executed when Kong receives a response from the upstream service but before it is sent to the client
function MyPlugin:body_filter(conf)
  kong.log.debug("MyPlugin body_filter phase")
  
  if conf.enable_response_transform then
    local body = kong.response.get_raw_body()
    if body then
      local ok, json_body = pcall(cjson.decode, body)
      if ok then
        -- Transform response body
        if conf.response_transform_add_field then
          json_body[conf.response_transform_add_field] = ngx.now()
        end
        
        kong.response.set_raw_body(cjson.encode(json_body))
      end
    end
  end
end

-- Executed after the response has been sent to the client
function MyPlugin:log(conf)
  kong.log.debug("MyPlugin log phase")
  
  if conf.enable_logging then
    -- Custom logging logic
    local log_data = {
      request_id = kong.request.get_header("X-Request-ID") or kong.request.get_id(),
      method = kong.request.get_method(),
      path = kong.request.get_path(),
      status = kong.response.get_status(),
      latency = kong.ctx.shared.request_time or 0,
      client_ip = kong.client.get_forwarded_ip(),
      timestamp = ngx.now()
    }
    
    -- Send to logging service or store in database
    if conf.log_to_redis then
      self:log_to_redis(log_data, conf)
    end
  end
end

-- Helper: Transform body based on template
function MyPlugin:transform_body(body, template)
  -- Simple transformation example
  if template.add_timestamp then
    body.timestamp = ngx.now()
  end
  
  if template.add_request_id then
    body.request_id = kong.request.get_id()
  end
  
  return body
end

-- Helper: Validate authentication token
function MyPlugin:validate_token(auth_header, conf)
  local token = auth_header:match("Bearer%s+(.+)")
  if not token then
    return false
  end
  
  -- Check token in cache first
  local cache_key = "token:" .. token
  local cached_result, err = kong.cache:get(cache_key, nil, function()
    -- Validate token against external service or database
    -- This is a simplified example
    if token == conf.valid_token then
      return { valid = true, user_id = "user123" }
    end
    return { valid = false }
  end)
  
  if err then
    kong.log.err("Error validating token: ", err)
    return false
  end
  
  return cached_result and cached_result.valid
end

-- Helper: Log to Redis
function MyPlugin:log_to_redis(log_data, conf)
  local redis = require "resty.redis"
  local red = redis:new()
  
  red:set_timeout(1000) -- 1 second
  
  local ok, err = red:connect(conf.redis_host or "localhost", conf.redis_port or 6379)
  if not ok then
    kong.log.err("Failed to connect to Redis: ", err)
    return
  end
  
  -- Store log entry
  local key = "logs:" .. os.date("%Y%m%d")
  red:rpush(key, cjson.encode(log_data))
  red:expire(key, 86400 * 7) -- Keep logs for 7 days
  
  -- Return connection to pool
  local ok, err = red:set_keepalive(10000, 100)
  if not ok then
    kong.log.err("Failed to set Redis keepalive: ", err)
  end
end

return MyPlugin
`,

    // Plugin schema
    'kong/plugins/myplugin/schema.lua': `local typedefs = require "kong.db.schema.typedefs"

return {
  name = "myplugin",
  fields = {
    { consumer = typedefs.no_consumer }, -- This plugin cannot be configured on a consumer
    { protocols = typedefs.protocols_http },
    { config = {
        type = "record",
        fields = {
          -- Rate limiting configuration
          { enable_rate_limiting = { type = "boolean", default = false } },
          { rate_limit_max = { type = "number", default = 100 } },
          { rate_limit_window = { type = "number", default = 60 } },
          
          -- Header manipulation
          { add_headers = {
              type = "map",
              keys = { type = "string" },
              values = { type = "string" },
              default = {}
          }},
          
          -- Request transformation
          { enable_request_transform = { type = "boolean", default = false } },
          { request_transform_template = {
              type = "record",
              fields = {
                { add_timestamp = { type = "boolean", default = false } },
                { add_request_id = { type = "boolean", default = false } }}
          }},
          
          -- Response transformation
          { enable_response_transform = { type = "boolean", default = false } },
          { response_transform_add_field = { type = "string" } },
          
          -- Custom authentication
          { enable_custom_auth = { type = "boolean", default = false } },
          { valid_token = { type = "string", referenceable = true } },
          
          -- Logging configuration
          { enable_logging = { type = "boolean", default = true } },
          { log_to_redis = { type = "boolean", default = false } },
          { redis_host = { type = "string", default = "localhost" } },
          { redis_port = { type = "number", default = 6379 } }},
        entity_checks = {
          -- Custom validation logic
          { conditional = {
              if_field = "enable_rate_limiting",
              if_match = { eq = true },
              then_field = "rate_limit_max",
              then_match = { gt = 0 }
          }},
          { conditional = {
              if_field = "log_to_redis",
              if_match = { eq = true },
              then_field = "redis_host",
              then_match = { required = true }
          }}}
    }}}}
`,

    // Plugin API endpoints
    'kong/plugins/myplugin/api.lua': `local crud = require "kong.api.endpoints"
local utils = require "kong.tools.utils"

return {
  ["/myplugin/stats"] = {
    GET = function(self, db)
      -- Return plugin statistics
      local stats = {
        total_requests = 0,
        rate_limited_requests = 0,
        authenticated_requests = 0,
        transformed_requests = 0
      }
      
      -- Get stats from cache or database
      local cache_key = "myplugin:stats"
      local cached_stats, err = kong.cache:get(cache_key, nil, function()
        -- Fetch from database if needed
        return stats
      end)
      
      if err then
        return kong.response.exit(500, { message = "Error fetching stats" })
      end
      
      return kong.response.exit(200, cached_stats)
    end
  },
  
  ["/myplugin/cache/clear"] = {
    POST = function(self, db)
      -- Clear plugin cache
      kong.cache:invalidate("myplugin:*")
      return kong.response.exit(200, { message = "Cache cleared" })
    end
  },
  
  ["/myplugin/tokens"] = {
    GET = function(self, db)
      -- List valid tokens (admin only)
      local tokens = {}
      -- Fetch from database
      return kong.response.exit(200, { tokens = tokens })
    end,
    
    POST = function(self, db)
      -- Create new token
      local body = kong.request.get_body()
      if not body or not body.user_id then
        return kong.response.exit(400, { message = "user_id required" })
      end
      
      local token = utils.uuid()
      -- Store in database
      
      return kong.response.exit(201, { token = token })
    end
  }
}
`,

    // Plugin DAOs
    'kong/plugins/myplugin/daos.lua': `local typedefs = require "kong.db.schema.typedefs"

return {
  myplugin_credentials = {
    name = "myplugin_credentials",
    primary_key = { "id" },
    cache_key = { "token" },
    fields = {
      { id = typedefs.uuid },
      { created_at = typedefs.auto_timestamp_s },
      { consumer = { type = "foreign", reference = "consumers", required = true, on_delete = "cascade" } },
      { token = { type = "string", required = true, unique = true, auto = true } },
      { description = { type = "string" } },
      { ttl = { type = "number", default = 3600 } }}},
  
  myplugin_logs = {
    name = "myplugin_logs",
    primary_key = { "id" },
    ttl = true,
    fields = {
      { id = typedefs.uuid },
      { created_at = typedefs.auto_timestamp_s },
      { request_id = { type = "string", required = true } },
      { consumer = { type = "foreign", reference = "consumers", on_delete = "cascade" } },
      { route = { type = "foreign", reference = "routes", on_delete = "cascade" } },
      { service = { type = "foreign", reference = "services", on_delete = "cascade" } },
      { method = { type = "string" } },
      { path = { type = "string" } },
      { status = { type = "number" } },
      { latency = { type = "number" } },
      { client_ip = { type = "string" } },
      { ttl = { type = "number", default = 604800 } }, -- 7 days
    }}}
`,

    // Migrations
    'kong/plugins/myplugin/migrations/init.lua': `return {
  "000_base",
  "001_add_ttl"}
`,

    'kong/plugins/myplugin/migrations/000_base.lua': `return {
  postgres = {
    up = [[
      CREATE TABLE IF NOT EXISTS myplugin_credentials(
        id uuid,
        created_at timestamp,
        consumer_id uuid REFERENCES consumers(id) ON DELETE CASCADE,
        token text UNIQUE,
        description text,
        PRIMARY KEY (id)
      );
      
      CREATE INDEX IF NOT EXISTS myplugin_credentials_token_idx ON myplugin_credentials(token);
      CREATE INDEX IF NOT EXISTS myplugin_credentials_consumer_idx ON myplugin_credentials(consumer_id);
      
      CREATE TABLE IF NOT EXISTS myplugin_logs(
        id uuid,
        created_at timestamp,
        request_id text,
        consumer_id uuid REFERENCES consumers(id) ON DELETE CASCADE,
        route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
        service_id uuid REFERENCES services(id) ON DELETE CASCADE,
        method text,
        path text,
        status integer,
        latency integer,
        client_ip text,
        PRIMARY KEY (id)
      );
      
      CREATE INDEX IF NOT EXISTS myplugin_logs_request_id_idx ON myplugin_logs(request_id);
      CREATE INDEX IF NOT EXISTS myplugin_logs_created_at_idx ON myplugin_logs(created_at);
    ]]},
  
  cassandra = {
    up = [[
      CREATE TABLE IF NOT EXISTS myplugin_credentials(
        id uuid,
        created_at timestamp,
        consumer_id uuid,
        token text,
        description text,
        PRIMARY KEY (id)
      );
      
      CREATE INDEX IF NOT EXISTS ON myplugin_credentials(token);
      CREATE INDEX IF NOT EXISTS ON myplugin_credentials(consumer_id);
      
      CREATE TABLE IF NOT EXISTS myplugin_logs(
        id uuid,
        created_at timestamp,
        request_id text,
        consumer_id uuid,
        route_id uuid,
        service_id uuid,
        method text,
        path text,
        status int,
        latency int,
        client_ip text,
        PRIMARY KEY (id)
      );
      
      CREATE INDEX IF NOT EXISTS ON myplugin_logs(request_id);
    ]]}}
`,

    'kong/plugins/myplugin/migrations/001_add_ttl.lua': `return {
  postgres = {
    up = [[
      ALTER TABLE myplugin_credentials ADD COLUMN IF NOT EXISTS ttl integer DEFAULT 3600;
      ALTER TABLE myplugin_logs ADD COLUMN IF NOT EXISTS ttl integer DEFAULT 604800;
    ]]},
  
  cassandra = {
    up = [[
      ALTER TABLE myplugin_credentials ADD ttl int;
      ALTER TABLE myplugin_logs ADD ttl int;
    ]]}}
`,

    // Test specs
    'spec/myplugin/01-unit_spec.lua': `local PLUGIN_NAME = "myplugin"

describe(PLUGIN_NAME .. ": (unit)", function()
  local plugin_handler
  
  setup(function()
    plugin_handler = require("kong.plugins." .. PLUGIN_NAME .. ".handler")
  end)
  
  describe("constructor", function()
    it("creates plugin instance", function()
      local instance = plugin_handler:new()
      assert.equal(PLUGIN_NAME, instance.name)
    end)
  end)
  
  describe("priority", function()
    it("has correct priority", function()
      assert.equal(1000, plugin_handler.PRIORITY)
    end)
  end)
  
  describe("transform_body", function()
    it("adds timestamp when configured", function()
      local instance = plugin_handler:new()
      local body = { data = "test" }
      local template = { add_timestamp = true }
      
      local result = instance:transform_body(body, template)
      
      assert.is_not_nil(result.timestamp)
      assert.equal("test", result.data)
    end)
  end)
  
  describe("validate_token", function()
    it("validates correct token", function()
      local instance = plugin_handler:new()
      local conf = { valid_token = "secret123" }
      
      -- Mock kong.cache
      _G.kong = {
        cache = {
          get = function(self, key, ttl, cb)
            return cb()
          end
        },
        log = { err = function() end }
      }
      
      local result = instance:validate_token("Bearer secret123", conf)
      assert.is_true(result)
    end)
    
    it("rejects invalid token", function()
      local instance = plugin_handler:new()
      local conf = { valid_token = "secret123" }
      
      local result = instance:validate_token("Bearer wrong", conf)
      assert.is_false(result)
    end)
  end)
end)
`,

    'spec/myplugin/02-schema_spec.lua': `local PLUGIN_NAME = "myplugin"
local schema_def = require("kong.plugins." .. PLUGIN_NAME .. ".schema")
local v = require("spec.helpers").validate_plugin_config_schema

describe(PLUGIN_NAME .. ": (schema)", function()
  it("accepts valid configuration", function()
    local ok, err = v({
      enable_rate_limiting = true,
      rate_limit_max = 100,
      rate_limit_window = 60,
      enable_logging = true
    }, schema_def)
    
    assert.is_nil(err)
    assert.is_truthy(ok)
  end)
  
  it("validates rate limit configuration", function()
    local ok, err = v({
      enable_rate_limiting = true,
      rate_limit_max = 0
    }, schema_def)
    
    assert.is_not_nil(err)
  end)
  
  it("validates Redis configuration when logging enabled", function()
    local ok, err = v({
      enable_logging = true,
      log_to_redis = true,
      redis_host = nil
    }, schema_def)
    
    assert.is_not_nil(err)
  end)
end)
`,

    'spec/myplugin/03-integration_spec.lua': `local helpers = require "spec.helpers"
local PLUGIN_NAME = "myplugin"

for _, strategy in helpers.each_strategy() do
  describe(PLUGIN_NAME .. ": (integration) [#" .. strategy .. "]", function()
    local client
    local bp = helpers.get_db_utils(strategy, {
      "routes",
      "services",
      "microservices"})
    
    setup(function()
      -- Create test route and service
      local service = bp.services:insert({
        protocol = "http",
        port = 80,
        host = "httpbin.org"})
      
      local route = bp.routes:insert({
        protocols = { "http" },
        paths = { "/test" },
        service = { id = service.id }})
      
      -- Add plugin to route
      bp.plugins:insert({
        name = PLUGIN_NAME,
        route = { id = route.id },
        config = {
          enable_rate_limiting = true,
          rate_limit_max = 5,
          rate_limit_window = 60,
          add_headers = {
            ["X-MyPlugin"] = "enabled"
          }
        }})
      
      assert(helpers.start_kong({
        database = strategy,
        nginx_conf = "spec/fixtures/custom_nginx.template",
        plugins = "bundled," .. PLUGIN_NAME}))
    end)
    
    teardown(function()
      helpers.stop_kong()
    end)
    
    before_each(function()
      client = helpers.proxy_client()
    end)
    
    after_each(function()
      if client then client:close() end
    end)
    
    describe("request handling", function()
      it("adds configured headers", function()
        local res = assert(client:send({
          method = "GET",
          path = "/test"}))
        
        assert.response(res).has.status(200)
        assert.request(res).has.header("X-MyPlugin", "enabled")
      end)
      
      it("enforces rate limiting", function()
        -- Send requests up to limit
        for i = 1, 5 do
          local res = assert(client:send({
            method = "GET",
            path = "/test"}))
          assert.response(res).has.status(200)
        end
        
        -- Next request should be rate limited
        local res = assert(client:send({
          method = "GET",
          path = "/test"}))
        assert.response(res).has.status(429)
        local body = assert.response(res).has.jsonbody()
        assert.equal("Rate limit exceeded", body.message)
      end)
    end)
  end)
end
`,

    // Configuration files
    '.busted': `return {
  default = {
    verbose = true,
    coverage = false,
    output = "gtest"}}
`,

    '.luacheckrc': `std = "ngx_lua"
unused_args = false
redefined = false
max_line_length = false

globals = {
  "kong",
  "ngx.config",
  "ngx.location",
  "ngx.socket",
  "ngx.req",
  "ngx.ctx"}

not_globals = {
  "string.len",
  "table.getn"}

ignore = {
  "6.", -- ignore whitespace warnings
}

exclude_files = {
  "spec/fixtures/**/*.lua",
  ".luarocks/**/*.lua"}
`,

    'Makefile': `.PHONY: install test lint clean package deploy

PLUGIN_NAME = myplugin
VERSION = 0.1.0

# Install dependencies
install:
	@echo "Installing dependencies..."
	luarocks install kong 3.5.0
	luarocks install busted
	luarocks install luacheck

# Run tests
test:
	@echo "Running tests..."
	bin/busted -v

# Run linter
lint:
	@echo "Running linter..."
	luacheck -q .

# Clean
clean:
	@echo "Cleaning..."
	rm -f *.rock
	rm -rf .luarocks

# Package plugin
package:
	@echo "Building rock package..."
	luarocks make

# Deploy to Kong
deploy: package
	@echo "Installing plugin to Kong..."
	luarocks install kong-plugin-$(PLUGIN_NAME)-$(VERSION)-1.rock

# Development Kong
dev-env:
	@echo "Starting Kong in development mode..."
	kong migrations bootstrap
	kong start -c kong.conf

# Stop Kong
stop:
	@echo "Stopping Kong..."
	kong stop
`,

    'kong.conf': `# Kong configuration for plugin development

prefix = servroot
log_level = debug
proxy_access_log = logs/access.log
proxy_error_log = logs/error.log
admin_access_log = logs/admin_access.log
admin_error_log = logs/admin_error.log

plugins = bundled,myplugin
lua_package_path = ./?.lua;./?/init.lua;;

database = postgres
pg_host = 127.0.0.1
pg_port = 5432
pg_timeout = 5000
pg_user = kong
pg_password = kong
pg_database = kong

admin_listen = 127.0.0.1:8001
proxy_listen = 127.0.0.1:8000

nginx_worker_processes = 1
nginx_daemon = off
mem_cache_size = 128m

# Enable plugin development mode
lua_code_cache = off
`,

    'README.md': `# Kong Plugin - MyPlugin

Custom Kong plugin for API gateway functionality including rate limiting, request/response transformation, and custom authentication.

## Features

- 🚦 Rate limiting per client IP
- 🔄 Request/response transformation
- 🔐 Custom authentication with token validation
- 📝 Detailed request logging
- 💾 Redis integration for caching and logging
- 🎯 Configurable per route/service
- 🧪 Comprehensive test suite

## Installation

### From LuaRocks
\`\`\`bash
luarocks install kong-plugin-myplugin
\`\`\`

### From Source
\`\`\`bash
git clone https://github.com/yourusername/kong-plugin-myplugin
cd kong-plugin-myplugin
luarocks make
\`\`\`

## Configuration

Enable the plugin on a service or route:

\`\`\`bash
curl -X POST http://localhost:8001/services/{service}/plugins \\
  --data "name=myplugin" \\
  --data "config.enable_rate_limiting=true" \\
  --data "config.rate_limit_max=100" \\
  --data "config.rate_limit_window=60"
\`\`\`

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| enable_rate_limiting | boolean | false | Enable rate limiting |
| rate_limit_max | number | 100 | Maximum requests per window |
| rate_limit_window | number | 60 | Time window in seconds |
| add_headers | map | {} | Headers to add to requests |
| enable_request_transform | boolean | false | Enable request transformation |
| enable_response_transform | boolean | false | Enable response transformation |
| enable_custom_auth | boolean | false | Enable custom authentication |
| valid_token | string | - | Valid authentication token |
| enable_logging | boolean | true | Enable request logging |
| log_to_redis | boolean | false | Log to Redis instead of default |

## Development

### Setup Development Environment

1. Install Kong and PostgreSQL:
\`\`\`bash
# Install Kong
curl -Lo kong.tar.gz https://download.konghq.com/gateway-3.x-ubuntu-$(lsb_release -sc)/pool/all/k/kong/kong_3.5.0_amd64.deb
sudo apt install ./kong.tar.gz

# Setup PostgreSQL
sudo -u postgres createuser kong
sudo -u postgres createdb kong
\`\`\`

2. Initialize Kong:
\`\`\`bash
kong migrations bootstrap -c kong.conf
kong start -c kong.conf
\`\`\`

3. Run tests:
\`\`\`bash
make test
\`\`\`

### Project Structure

\`\`\`
.
├── kong/
│   └── plugins/
│       └── myplugin/
│           ├── handler.lua       # Main plugin logic
│           ├── schema.lua        # Configuration schema
│           ├── api.lua          # Admin API endpoints
│           ├── daos.lua         # Database entities
│           └── migrations/      # Database migrations
├── spec/                        # Test specifications
├── kong.conf                    # Kong configuration
└── rockspec                     # LuaRocks specification
\`\`\`

## Testing

Run unit tests:
\`\`\`bash
bin/busted spec/myplugin/01-unit_spec.lua
\`\`\`

Run integration tests:
\`\`\`bash
bin/busted spec/myplugin/03-integration_spec.lua
\`\`\`

## API Endpoints

The plugin adds the following Admin API endpoints:

- \`GET /myplugin/stats\` - Get plugin statistics
- \`POST /myplugin/cache/clear\` - Clear plugin cache
- \`GET /myplugin/tokens\` - List valid tokens
- \`POST /myplugin/tokens\` - Create new token

## Rate Limiting

Rate limiting is performed per client IP address. When the limit is exceeded, the plugin returns:

\`\`\`json
{
  "message": "Rate limit exceeded",
  "retry_after": 60
}
\`\`\`

## Request Transformation

When enabled, the plugin can transform requests by:
- Adding timestamp
- Adding request ID
- Custom transformations via template

## Custom Authentication

The plugin supports custom token-based authentication. Tokens are cached for performance.

## Logging

Logs can be sent to:
- Kong's default logging
- Redis for centralized logging
- Custom endpoints via API

## Performance Considerations

- Token validation results are cached
- Rate limit counters use in-memory storage
- Database queries are minimized
- Connection pooling for Redis

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License
`,

    '.gitignore': `# Lua
*.lua.compiled
*.rock
.luarocks/

# Kong
servroot/
*.pid
logs/

# Testing
*.log
luacov.*.out
.busted

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Environment
.env
kong.conf.local
`
  }
};