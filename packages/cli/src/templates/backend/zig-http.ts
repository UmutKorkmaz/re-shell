import { BackendTemplate } from '../types';

export const zigHttpTemplate: BackendTemplate = {
  id: 'zig-http',
  name: 'Zig HTTP Server',
  description: 'High-performance HTTP server using Zig standard library',
  version: '1.0.0',
  framework: 'zig-std',
  displayName: 'Zig HTTP Server',
  language: 'zig',
  port: 3000,
  tags: ['zig', 'http', 'web', 'api', 'fast', 'low-level'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors'],
  dependencies: {},
  devDependencies: {},
  files: {
    'build.zig': `const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "{{projectName}}",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize});

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the HTTP server");
    run_step.dependOn(&run_cmd.step);

    const unit_tests = b.addTest(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize});

    const run_unit_tests = b.addRunArtifact(unit_tests);

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
`,

    'src/main.zig': `const std = @import("std");
const http = @import("http.zig");
const router = @import("router.zig");
const handlers = @import("handlers.zig");
const middleware = @import("middleware.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Initialize router
    var app_router = router.Router.init(allocator);
    defer app_router.deinit();

    // Register routes
    try app_router.get("/", handlers.handleRoot);
    try app_router.get("/health", handlers.handleHealth);
    try app_router.get("/api/info", handlers.handleApiInfo);
    try app_router.post("/api/users", handlers.handleCreateUser);
    try app_router.get("/api/users", handlers.handleGetUsers);
    try app_router.get("/api/users/:id", handlers.handleGetUser);
    try app_router.delete("/api/users/:id", handlers.handleDeleteUser);

    // Create server
    var server = http.Server.init(allocator, &app_router);
    defer server.deinit();

    // Add middleware
    try server.use(middleware.corsMiddleware);
    try server.use(middleware.loggingMiddleware);

    const port: u16 = getPort();
    std.debug.print("🚀 {{projectName}} server starting on http://localhost:{d}\\n", .{port});

    try server.listen(port);
}

fn getPort() u16 {
    const port_str = std.posix.getenv("PORT") orelse "3000";
    return std.fmt.parseInt(u16, port_str, 10) catch 3000;
}

test "basic test" {
    const allocator = std.testing.allocator;
    _ = allocator;
    try std.testing.expect(true);
}
`,

    'src/http.zig': `const std = @import("std");
const net = std.net;
const router = @import("router.zig");

pub const Method = enum {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    OPTIONS,
    HEAD,

    pub fn fromString(method: []const u8) ?Method {
        const methods = std.StaticStringMap(Method).initComptime(.{
            .{ "GET", .GET },
            .{ "POST", .POST },
            .{ "PUT", .PUT },
            .{ "DELETE", .DELETE },
            .{ "PATCH", .PATCH },
            .{ "OPTIONS", .OPTIONS },
            .{ "HEAD", .HEAD }});
        return methods.get(method);
    }
};

pub const Request = struct {
    method: Method,
    path: []const u8,
    headers: std.StringHashMap([]const u8),
    body: []const u8,
    params: std.StringHashMap([]const u8),
    query: std.StringHashMap([]const u8),
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) Request {
        return Request{
            .method = .GET,
            .path = "/",
            .headers = std.StringHashMap([]const u8).init(allocator),
            .body = "",
            .params = std.StringHashMap([]const u8).init(allocator),
            .query = std.StringHashMap([]const u8).init(allocator),
            .allocator = allocator};
    }

    pub fn deinit(self: *Request) void {
        self.headers.deinit();
        self.params.deinit();
        self.query.deinit();
    }
};

pub const Response = struct {
    status_code: u16,
    headers: std.StringHashMap([]const u8),
    body: std.ArrayList(u8),
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) Response {
        var response = Response{
            .status_code = 200,
            .headers = std.StringHashMap([]const u8).init(allocator),
            .body = std.ArrayList(u8).init(allocator),
            .allocator = allocator};
        response.headers.put("Content-Type", "application/json") catch {};
        return response;
    }

    pub fn deinit(self: *Response) void {
        self.headers.deinit();
        self.body.deinit();
    }

    pub fn json(self: *Response, data: []const u8) void {
        self.body.appendSlice(data) catch {};
    }

    pub fn setStatus(self: *Response, code: u16) void {
        self.status_code = code;
    }

    pub fn setHeader(self: *Response, key: []const u8, value: []const u8) void {
        self.headers.put(key, value) catch {};
    }
};

pub const MiddlewareFn = *const fn (*Request, *Response) bool;

pub const Server = struct {
    allocator: std.mem.Allocator,
    router: *router.Router,
    middleware: std.ArrayList(MiddlewareFn),

    pub fn init(allocator: std.mem.Allocator, app_router: *router.Router) Server {
        return Server{
            .allocator = allocator,
            .router = app_router,
            .middleware = std.ArrayList(MiddlewareFn).init(allocator)};
    }

    pub fn deinit(self: *Server) void {
        self.middleware.deinit();
    }

    pub fn use(self: *Server, mw: MiddlewareFn) !void {
        try self.middleware.append(mw);
    }

    pub fn listen(self: *Server, port: u16) !void {
        const address = net.Address.initIp4(.{ 0, 0, 0, 0 }, port);
        var server = try address.listen(.{
            .reuse_address = true});
        defer server.deinit();

        while (true) {
            const connection = server.accept() catch |err| {
                std.debug.print("Connection error: {}\\n", .{err});
                continue;
            };
            defer connection.stream.close();

            self.handleConnection(connection) catch |err| {
                std.debug.print("Request error: {}\\n", .{err});
            };
        }
    }

    fn handleConnection(self: *Server, connection: net.Server.Connection) !void {
        var buffer: [4096]u8 = undefined;
        const bytes_read = try connection.stream.read(&buffer);
        if (bytes_read == 0) return;

        var request = Request.init(self.allocator);
        defer request.deinit();

        var response = Response.init(self.allocator);
        defer response.deinit();

        // Parse request
        try parseRequest(&request, buffer[0..bytes_read]);

        // Run middleware
        for (self.middleware.items) |mw| {
            if (!mw(&request, &response)) {
                try sendResponse(connection.stream, &response);
                return;
            }
        }

        // Route request
        self.router.handle(&request, &response);

        // Send response
        try sendResponse(connection.stream, &response);
    }

    fn parseRequest(request: *Request, data: []const u8) !void {
        var lines = std.mem.splitSequence(u8, data, "\\r\\n");
        const request_line = lines.next() orelse return;

        var parts = std.mem.splitScalar(u8, request_line, ' ');
        const method_str = parts.next() orelse return;
        const path = parts.next() orelse return;

        request.method = Method.fromString(method_str) orelse .GET;
        request.path = path;

        // Parse headers
        while (lines.next()) |line| {
            if (line.len == 0) break;
            if (std.mem.indexOf(u8, line, ": ")) |idx| {
                const key = line[0..idx];
                const value = line[idx + 2 ..];
                request.headers.put(key, value) catch {};
            }
        }

        // Get body (remaining data after headers)
        if (lines.next()) |body| {
            request.body = body;
        }
    }

    fn sendResponse(stream: net.Stream, response: *Response) !void {
        var writer = stream.writer();

        // Status line
        const status_text = getStatusText(response.status_code);
        try writer.print("HTTP/1.1 {d} {s}\\r\\n", .{ response.status_code, status_text });

        // Headers
        var header_iter = response.headers.iterator();
        while (header_iter.next()) |entry| {
            try writer.print("{s}: {s}\\r\\n", .{ entry.key_ptr.*, entry.value_ptr.* });
        }

        // Content-Length
        try writer.print("Content-Length: {d}\\r\\n", .{response.body.items.len});
        try writer.writeAll("\\r\\n");

        // Body
        try writer.writeAll(response.body.items);
    }

    fn getStatusText(code: u16) []const u8 {
        return switch (code) {
            200 => "OK",
            201 => "Created",
            204 => "No Content",
            400 => "Bad Request",
            401 => "Unauthorized",
            403 => "Forbidden",
            404 => "Not Found",
            500 => "Internal Server Error",
            else => "Unknown"};
    }
};
`,

    'src/router.zig': `const std = @import("std");
const http = @import("http.zig");

pub const HandlerFn = *const fn (*http.Request, *http.Response) void;

const Route = struct {
    method: http.Method,
    pattern: []const u8,
    handler: HandlerFn};

pub const Router = struct {
    allocator: std.mem.Allocator,
    routes: std.ArrayList(Route),

    pub fn init(allocator: std.mem.Allocator) Router {
        return Router{
            .allocator = allocator,
            .routes = std.ArrayList(Route).init(allocator)};
    }

    pub fn deinit(self: *Router) void {
        self.routes.deinit();
    }

    pub fn get(self: *Router, pattern: []const u8, handler: HandlerFn) !void {
        try self.routes.append(Route{ .method = .GET, .pattern = pattern, .handler = handler });
    }

    pub fn post(self: *Router, pattern: []const u8, handler: HandlerFn) !void {
        try self.routes.append(Route{ .method = .POST, .pattern = pattern, .handler = handler });
    }

    pub fn put(self: *Router, pattern: []const u8, handler: HandlerFn) !void {
        try self.routes.append(Route{ .method = .PUT, .pattern = pattern, .handler = handler });
    }

    pub fn delete(self: *Router, pattern: []const u8, handler: HandlerFn) !void {
        try self.routes.append(Route{ .method = .DELETE, .pattern = pattern, .handler = handler });
    }

    pub fn handle(self: *Router, request: *http.Request, response: *http.Response) void {
        for (self.routes.items) |route| {
            if (route.method == request.method and matchPattern(route.pattern, request.path, request)) {
                route.handler(request, response);
                return;
            }
        }

        // 404 Not Found
        response.setStatus(404);
        response.json("{\\"error\\": \\"not_found\\", \\"message\\": \\"Resource not found\\"}");
    }

    fn matchPattern(pattern: []const u8, path: []const u8, request: *http.Request) bool {
        var pattern_parts = std.mem.splitScalar(u8, pattern, '/');
        var path_parts = std.mem.splitScalar(u8, path, '/');

        while (true) {
            const pat = pattern_parts.next();
            const pth = path_parts.next();

            if (pat == null and pth == null) return true;
            if (pat == null or pth == null) return false;

            if (pat.?.len > 0 and pat.?[0] == ':') {
                // URL parameter
                const param_name = pat.?[1..];
                request.params.put(param_name, pth.?) catch {};
            } else if (!std.mem.eql(u8, pat.?, pth.?)) {
                return false;
            }
        }
    }
};
`,

    'src/handlers.zig': `const std = @import("std");
const http = @import("http.zig");
const json = @import("json.zig");

// In-memory storage
var users: [100]?User = [_]?User{null} ** 100;
var user_count: usize = 0;
var next_id: u32 = 1;

const User = struct {
    id: u32,
    name: []const u8,
    email: []const u8};

pub fn handleRoot(_: *http.Request, response: *http.Response) void {
    response.json(
        \\\\{"name": "{{projectName}}", "version": "1.0.0", "framework": "Zig HTTP", "language": "Zig"}
    );
}

pub fn handleHealth(_: *http.Request, response: *http.Response) void {
    response.json(
        \\\\{"status": "healthy", "uptime": "running"}
    );
}

pub fn handleApiInfo(_: *http.Request, response: *http.Response) void {
    response.json(
        \\\\{"endpoints": ["/", "/health", "/api/info", "/api/users"]}
    );
}

pub fn handleCreateUser(request: *http.Request, response: *http.Response) void {
    if (user_count >= 100) {
        response.setStatus(500);
        response.json(
            \\\\{"error": "storage_full", "message": "User storage is full"}
        );
        return;
    }

    // Parse JSON body (simplified)
    const name = json.extractString(request.body, "name") orelse "Unknown";
    const email = json.extractString(request.body, "email") orelse "unknown@example.com";

    const user = User{
        .id = next_id,
        .name = name,
        .email = email};

    users[user_count] = user;
    user_count += 1;
    next_id += 1;

    response.setStatus(201);

    var buffer: [256]u8 = undefined;
    const result = std.fmt.bufPrint(&buffer, "{{\\"id\\": {d}, \\"name\\": \\"{s}\\", \\"email\\": \\"{s}\\"}}", .{
        user.id,
        user.name,
        user.email}) catch {
        response.json(
            \\\\{"error": "internal_error"}
        );
        return;
    };
    response.json(result);
}

pub fn handleGetUsers(_: *http.Request, response: *http.Response) void {
    var buffer: [4096]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buffer);
    const writer = fbs.writer();

    writer.writeAll("[") catch return;

    var first = true;
    for (users[0..user_count]) |maybe_user| {
        if (maybe_user) |user| {
            if (!first) writer.writeAll(",") catch return;
            first = false;
            std.fmt.format(writer, "{{\\"id\\": {d}, \\"name\\": \\"{s}\\", \\"email\\": \\"{s}\\"}}", .{
                user.id,
                user.name,
                user.email}) catch return;
        }
    }

    writer.writeAll("]") catch return;
    response.json(fbs.getWritten());
}

pub fn handleGetUser(request: *http.Request, response: *http.Response) void {
    const id_str = request.params.get("id") orelse {
        response.setStatus(400);
        response.json(
            \\\\{"error": "bad_request", "message": "Missing user ID"}
        );
        return;
    };

    const id = std.fmt.parseInt(u32, id_str, 10) catch {
        response.setStatus(400);
        response.json(
            \\\\{"error": "bad_request", "message": "Invalid user ID"}
        );
        return;
    };

    for (users[0..user_count]) |maybe_user| {
        if (maybe_user) |user| {
            if (user.id == id) {
                var buffer: [256]u8 = undefined;
                const result = std.fmt.bufPrint(&buffer, "{{\\"id\\": {d}, \\"name\\": \\"{s}\\", \\"email\\": \\"{s}\\"}}", .{
                    user.id,
                    user.name,
                    user.email}) catch return;
                response.json(result);
                return;
            }
        }
    }

    response.setStatus(404);
    response.json(
        \\\\{"error": "not_found", "message": "User not found"}
    );
}

pub fn handleDeleteUser(request: *http.Request, response: *http.Response) void {
    const id_str = request.params.get("id") orelse {
        response.setStatus(400);
        response.json(
            \\\\{"error": "bad_request", "message": "Missing user ID"}
        );
        return;
    };

    const id = std.fmt.parseInt(u32, id_str, 10) catch {
        response.setStatus(400);
        response.json(
            \\\\{"error": "bad_request", "message": "Invalid user ID"}
        );
        return;
    };

    for (users[0..user_count], 0..) |maybe_user, i| {
        if (maybe_user) |user| {
            if (user.id == id) {
                users[i] = null;
                response.setStatus(204);
                return;
            }
        }
    }

    response.setStatus(404);
    response.json(
        \\\\{"error": "not_found", "message": "User not found"}
    );
}
`,

    'src/middleware.zig': `const std = @import("std");
const http = @import("http.zig");

pub fn loggingMiddleware(request: *http.Request, _: *http.Response) bool {
    const method = @tagName(request.method);
    std.debug.print("[{s}] {s}\\n", .{ method, request.path });
    return true;
}

pub fn corsMiddleware(_: *http.Request, response: *http.Response) bool {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return true;
}

pub fn authMiddleware(request: *http.Request, response: *http.Response) bool {
    const auth = request.headers.get("Authorization") orelse {
        response.setStatus(401);
        response.json(
            \\\\{"error": "unauthorized", "message": "Missing authorization header"}
        );
        return false;
    };

    // Simple Bearer token check (implement proper JWT validation in production)
    if (!std.mem.startsWith(u8, auth, "Bearer ")) {
        response.setStatus(401);
        response.json(
            \\\\{"error": "unauthorized", "message": "Invalid authorization format"}
        );
        return false;
    }

    return true;
}
`,

    'src/json.zig': `const std = @import("std");

// Simple JSON string extraction (for demo purposes)
// In production, use a proper JSON library like std.json
pub fn extractString(json_str: []const u8, key: []const u8) ?[]const u8 {
    // Look for "key": "value" pattern
    var search_pattern: [64]u8 = undefined;
    const pattern = std.fmt.bufPrint(&search_pattern, "\\"{s}\\": \\"", .{key}) catch return null;

    const start_idx = std.mem.indexOf(u8, json_str, pattern) orelse return null;
    const value_start = start_idx + pattern.len;

    const value_end = std.mem.indexOfPos(u8, json_str, value_start, "\\"") orelse return null;

    return json_str[value_start..value_end];
}

pub fn extractNumber(json_str: []const u8, key: []const u8) ?i64 {
    var search_pattern: [64]u8 = undefined;
    const pattern = std.fmt.bufPrint(&search_pattern, "\\"{s}\\": ", .{key}) catch return null;

    const start_idx = std.mem.indexOf(u8, json_str, pattern) orelse return null;
    const value_start = start_idx + pattern.len;

    var end_idx = value_start;
    while (end_idx < json_str.len) : (end_idx += 1) {
        const c = json_str[end_idx];
        if (c != '-' and (c < '0' or c > '9')) break;
    }

    const num_str = json_str[value_start..end_idx];
    return std.fmt.parseInt(i64, num_str, 10) catch null;
}

test "extract string" {
    const json = "{\\"name\\": \\"John\\", \\"age\\": 30}";
    try std.testing.expectEqualStrings("John", extractString(json, "name").?);
}

test "extract number" {
    const json = "{\\"name\\": \\"John\\", \\"age\\": 30}";
    try std.testing.expectEqual(@as(i64, 30), extractNumber(json, "age").?);
}
`,

    '.gitignore': `# Zig build artifacts
zig-cache/
zig-out/
*.o
*.a

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean release

all: build

# Build debug version
build:
	zig build

# Build release version
release:
	zig build -Doptimize=ReleaseFast

# Run the server
run:
	zig build run

# Run tests
test:
	zig build test

# Clean build artifacts
clean:
	rm -rf zig-cache zig-out

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 3000:3000 {{projectName}}
`,

    'Dockerfile': `# Build stage
FROM alpine:3.18 AS builder

# Install Zig
RUN apk add --no-cache zig

WORKDIR /app

# Copy source
COPY . .

# Build release
RUN zig build -Doptimize=ReleaseFast

# Runtime stage
FROM alpine:3.18

WORKDIR /app

# Copy binary
COPY --from=builder /app/zig-out/bin/{{projectName}} ./{{projectName}}

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 3000

ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

CMD ["./{{projectName}}"]
`,

    'README.md': `# {{projectName}}

{{description}}

A high-performance HTTP server built with Zig.

## Features

- 🚀 Blazing fast performance with zero-cost abstractions
- 🔧 Custom HTTP server implementation
- 📝 REST API with routing
- 🛡️ Middleware support (CORS, logging, auth)
- 🧪 Built-in testing
- 🐳 Docker support

## Requirements

- Zig >= 0.11.0

## Installation

\`\`\`bash
# Build the project
zig build

# Run the server
zig build run
\`\`\`

## Development

\`\`\`bash
# Build debug version
make build

# Build release version
make release

# Run tests
make test

# Run the server
make run
\`\`\`

## API Endpoints

- \`GET /\` - API info
- \`GET /health\` - Health check
- \`GET /api/info\` - API endpoints info
- \`GET /api/users\` - List all users
- \`POST /api/users\` - Create new user
- \`GET /api/users/:id\` - Get user by ID
- \`DELETE /api/users/:id\` - Delete user

## Docker

\`\`\`bash
# Build image
docker build -t {{projectName}} .

# Run container
docker run -p 3000:3000 {{projectName}}
\`\`\`

## License

MIT
`},
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-zig-server'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A high-performance HTTP server built with Zig'}],
  postInstall: [
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: zig build run"']};
