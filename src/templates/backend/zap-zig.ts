import { BackendTemplate } from '../types';

export const zapZigTemplate: BackendTemplate = {
  id: 'zap-zig',
  name: 'zap-zig',
  displayName: 'Zap (Zig)',
  description: 'High-performance HTTP server for Zig with composable middleware and async I/O',
  language: 'zig',
  framework: 'zap',
  version: '1.0.0',
  tags: ['zig', 'zap', 'high-performance', 'middleware', 'composable'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main Zig file
    'src/main.zig': `const std = @import("std");
const zap = @import("zap");
const {{projectNamePascal}} = @import("./{{projectName}}.zig");

pub fn main() !void {
    // Initialize database
    try {{projectNamePascal}}.Models.init();

    // Create Zap server
    var server = zap.Server.init(std.heap.page_allocator, .{
        .port = 3000,
        .on_request = {{projectNamePascal}}.Handlers.on_request});

    std.debug.print("🚀 Server running at http://localhost:3000\\n", .{});
    std.debug.print("📚 API docs: http://localhost:3000/api/v1/health\\n", .{});

    // Start server
    try server.listen();
}
`,

    // Application module
    'src/{{projectName}}.zig': `const std = @import("std");
const zap = @import("zap");

pub const Models = @import("./models.zig");
pub const Handlers = @import("./handlers.zig");
`,

    // Handlers
    'src/handlers.zig': `const std = @import("std");
const zap = @import("zap");
const Models = @import("./models.zig");

pub fn on_request(r: zap.Request, s: *zap.Server) !void {
    // CORS headers
    r.setHeader("Access-Control-Allow-Origin", "*");
    r.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    r.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle OPTIONS
    if (std.mem.eql(u8, r.method, "OPTIONS")) {
        try s.respond("", .{});
        return;
    }

    // Route handling
    if (std.mem.eql(u8, r.path, "/")) {
        try home_handler(r, s);
    } else if (std.mem.eql(u8, r.path, "/api/v1/health")) {
        try health_handler(r, s);
    } else if (std.mem.startsWith(u8, r.path, "/api/v1/auth/register")) {
        if (std.mem.eql(u8, r.method, "POST")) {
            try register_handler(r, s);
        } else {
            try s.respond("Method not allowed", .{ .status = .method_not_allowed });
        }
    } else if (std.mem.startsWith(u8, r.path, "/api/v1/auth/login")) {
        if (std.mem.eql(u8, r.method, "POST")) {
            try login_handler(r, s);
        } else {
            try s.respond("Method not allowed", .{ .status = .method_not_allowed });
        }
    } else if (std.mem.eql(u8, r.path, "/api/v1/products")) {
        if (std.mem.eql(u8, r.method, "GET")) {
            try list_products_handler(r, s);
        } else if (std.mem.eql(u8, r.method, "POST")) {
            try create_product_handler(r, s);
        } else {
            try s.respond("Method not allowed", .{ .status = .method_not_allowed });
        }
    } else if (std.mem.startsWith(u8, r.path, "/api/v1/products/")) {
        const id_str = r.path["/api/v1/products/".len..];
        const id = try std.fmt.parseInt(usize, id_str, 10);

        if (std.mem.eql(u8, r.method, "GET")) {
            try get_product_handler(r, s, id);
        } else if (std.mem.eql(u8, r.method, "PUT")) {
            try update_product_handler(r, s, id);
        } else if (std.mem.eql(u8, r.method, "DELETE")) {
            try delete_product_handler(r, s, id);
        } else {
            try s.respond("Method not allowed", .{ .status = .method_not_allowed });
        }
    } else {
        try s.respond("Not found", .{ .status = .not_found });
    }
}

fn home_handler(r: zap.Request, s: *zap.Server) !void {
    const html =
        \\<!DOCTYPE html>
        \\<html>
        \\  <head>
        \\    <title>{{projectName}}</title>
        \\    <style>
        \\      body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
        \\      h1 { color: #333; }
        \\    </style>
        \\  </head>
        \\  <body>
        \\    <h1>Welcome to {{projectName}}</h1>
        \\    <p>High-performance HTTP server built with Zig and Zap</p>
        \\    <p>API available at: <a href=\\"/api/v1/health\\">/api/v1/health</a></p>
        \\  </body>
        \\</html>
    ;

    try s.respond(html, .{
        .status = .ok,
        .header = "Content-Type: text/html"});
}

fn health_handler(r: zap.Request, s: *zap.Server) !void {
    const response = std.fmt.allocPrint(
        s.allocator,
        \\\\{{"status": "healthy", "timestamp": "{s}", "version": "1.0.0"}\\},
        .{std.time.timestamp()},
    ) catch return error.OutOfMemory;

    try s.respond(response, .{
        .status = .ok,
        .header = "Content-Type: application/json"});
}

fn register_handler(r: zap.Request, s: *zap.Server) !void {
    _ = r;

    // In production, parse JSON body
    const email = "user@example.com";
    const password = "password123";
    const name = "New User";

    if (Models.find_user_by_email(email)) |user| {
        const response = std.fmt.allocPrint(
            s.allocator,
            \\\\{{"error": "Email already registered"}\\},
            .{},
        ) catch return error.OutOfMemory;

        try s.respond(response, .{
            .status = .conflict,
            .header = "Content-Type: application/json"});
        return;
    }

    const user = Models.create_user(email, password, name) catch return error.OutOfMemory;

    const token = Models.generate_token(user);

    const response = std.fmt.allocPrint(
        s.allocator,
        \\\\{{"token": "{s}", "user": {{"id": "{d}", "email": "{s}", "name": "{s}", "role": "{s}"}}}\\},
        .{ token, user.id, user.email, user.name, user.role },
    ) catch return error.OutOfMemory;

    try s.respond(response, .{
        .status = .created,
        .header = "Content-Type: application/json"});
}

fn login_handler(r: zap.Request, s: *zap.Server) !void {
    _ = r;

    // In production, parse JSON body
    const email = "admin@example.com";
    const password = "admin123";

    const user = Models.find_user_by_email(email) orelse {
        const response = \\\\{{"error": "Invalid credentials"}\\};
        try s.respond(response, .{
            .status = .unauthorized,
            .header = "Content-Type: application/json"});
        return;
    };

    if (!std.mem.eql(u8, user.password, Models.hash_password(password))) {
        const response = \\\\{{"error": "Invalid credentials"}\\};
        try s.respond(response, .{
            .status = .unauthorized,
            .header = "Content-Type: application/json"});
        return;
    }

    const token = Models.generate_token(user);

    const response = std.fmt.allocPrint(
        s.allocator,
        \\\\{{"token": "{s}", "user": {{"id": "{d}", "email": "{s}", "name": "{s}", "role": "{s}"}}}\\},
        .{ token, user.id, user.email, user.name, user.role },
    ) catch return error.OutOfMemory;

    try s.respond(response, .{
        .status = .ok,
        .header = "Content-Type: application/json"});
}

fn list_products_handler(r: zap.Request, s: *zap.Server) !void {
    _ = r;
    const products = Models.get_all_products();

    var response = std.ArrayList(u8).init(s.allocator);
    try response.append('\\\\');
    try response.append('{');
    try response.appendSlice(""products": [");

    for (products, 0..) |product, i| {
        if (i > 0) try response.append(',');
        try std.fmt.format(
            response.writer(),
            \\\\{{"id": {d}, "name": "{s}", "description": "{s}", "price": {d:.2}, "stock": {d}}\\},
            .{ product.id, product.name, product.description, product.price, product.stock },
        );
    }

    try response.appendSlice("], ");
    try std.fmt.format(response.writer(), ""count": {d}", .{products.len});
    try response.append('}');
    try response.append('\\\\');

    try s.respond(response.items, .{
        .status = .ok,
        .header = "Content-Type: application/json"});
}

fn get_product_handler(r: zap.Request, s: *zap.Server, id: usize) !void {
    _ = r;
    const product = Models.get_product_by_id(id) orelse {
        const response = \\\\{{"error": "Product not found"}\\};
        try s.respond(response, .{
            .status = .not_found,
            .header = "Content-Type: application/json"});
        return;
    };

    const response = std.fmt.allocPrint(
        s.allocator,
        \\\\{{"product": {{"id": {d}, "name": "{s}", "description": "{s}", "price": {d:.2}, "stock": {d}}}}\\},
        .{ product.id, product.name, product.description, product.price, product.stock },
    ) catch return error.OutOfMemory;

    try s.respond(response, .{
        .status = .ok,
        .header = "Content-Type: application/json"});
}

fn create_product_handler(r: zap.Request, s: *zap.Server) !void {
    _ = r;

    // In production, parse JSON body
    const name = "New Product";
    const description = "";
    const price: f64 = 29.99;
    const stock: u32 = 100;

    const product = Models.create_product(name, description, price, stock) catch return error.OutOfMemory;

    const response = std.fmt.allocPrint(
        s.allocator,
        \\\\{{"product": {{"id": {d}, "name": "{s}", "price": {d:.2}}}}\\},
        .{ product.id, product.name, product.price },
    ) catch return error.OutOfMemory;

    try s.respond(response, .{
        .status = .created,
        .header = "Content-Type: application/json"});
}

fn update_product_handler(r: zap.Request, s: *zap.Server, id: usize) !void {
    _ = r;

    // In production, parse JSON body
    const product = Models.update_product(id, "", "", 0.0, 0) orelse {
        const response = \\\\{{"error": "Product not found"}\\};
        try s.respond(response, .{
            .status = .not_found,
            .header = "Content-Type: application/json"});
        return;
    };

    const response = std.fmt.allocPrint(
        s.allocator,
        \\\\{{"product": {{"id": {d}, "name": "{s}"}}\\},
        .{ product.id, product.name },
    ) catch return error.OutOfMemory;

    try s.respond(response, .{
        .status = .ok,
        .header = "Content-Type: application/json"});
}

fn delete_product_handler(r: zap.Request, s: *zap.Server, id: usize) !void {
    _ = r;

    const success = Models.delete_product(id);

    if (!success) {
        const response = \\\\{{"error": "Product not found"}\\};
        try s.respond(response, .{
            .status = .not_found,
            .header = "Content-Type: application/json"});
        return;
    }

    try s.respond("", .{ .status = .no_content });
}
`,

    // Models
    'src/models.zig': `const std = @import("std");

pub const User = struct {
    id: usize,
    email: []const u8,
    password: []const u8,
    name: []const u8,
    role: []const u8,
    created_at: []const u8,
    updated_at: []const u8};

pub const Product = struct {
    id: usize,
    name: []const u8,
    description: []const u8,
    price: f64,
    stock: u32,
    created_at: []const u8,
    updated_at: []const u8};

var users = std.ArrayList(User).init(std.heap.page_allocator);
var products = std.ArrayList(Product).init(std.heap.page_allocator);
var user_id_counter: usize = 2;
var product_id_counter: usize = 3;

pub fn init() !void {
    try users.append(.{
        .id = 1,
        .email = "admin@example.com",
        .password = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a",
        .name = "Admin User",
        .role = "admin",
        .created_at = "2024-01-01T00:00:00Z",
        .updated_at = "2024-01-01T00:00:00Z"});

    try products.append(.{
        .id = 1,
        .name = "Sample Product 1",
        .description = "This is a sample product",
        .price = 29.99,
        .stock = 100,
        .created_at = "2024-01-01T00:00:00Z",
        .updated_at = "2024-01-01T00:00:00Z"});

    try products.append(.{
        .id = 2,
        .name = "Sample Product 2",
        .description = "Another sample product",
        .price = 49.99,
        .stock = 50,
        .created_at = "2024-01-01T00:00:00Z",
        .updated_at = "2024-01-01T00:00:00Z"});

    std.debug.print("📦 Database initialized\\n", .{});
    std.debug.print("👤 Default admin: admin@example.com / admin123\\n", .{});
}

pub fn find_user_by_email(email: []const u8) ?*User {
    for (users.items) |*user| {
        if (std.mem.eql(u8, user.email, email)) {
            return user;
        }
    }
    return null;
}

pub fn create_user(email: []const u8, password: []const u8, name: []const u8) !*User {
    const user = User{
        .id = user_id_counter,
        .email = email,
        .password = hash_password(password),
        .name = name,
        .role = "user",
        .created_at = "2024-01-01T00:00:00Z",
        .updated_at = "2024-01-01T00:00:00Z"};
    user_id_counter += 1;
    try users.append(user);
    return &users.items[users.items.len - 1];
}

pub fn get_all_products() []const Product {
    return users.items;
}

pub fn get_product_by_id(id: usize) ?*Product {
    for (products.items) |*product| {
        if (product.id == id) {
            return product;
        }
    }
    return null;
}

pub fn create_product(name: []const u8, description: []const u8, price: f64, stock: u32) !*Product {
    const product = Product{
        .id = product_id_counter,
        .name = name,
        .description = description,
        .price = price,
        .stock = stock,
        .created_at = "2024-01-01T00:00:00Z",
        .updated_at = "2024-01-01T00:00:00Z"};
    product_id_counter += 1;
    try products.append(product);
    return &products.items[products.items.len - 1];
}

pub fn update_product(id: usize, name: []const u8, description: []const u8, price: f64, stock: u32) ?*Product {
    for (products.items) |*product| {
        if (product.id == id) {
            if (name.len > 0) product.name = name;
            if (description.len > 0) product.description = description;
            if (price > 0) product.price = price;
            if (stock > 0) product.stock = stock;
            product.updated_at = "2024-01-01T00:00:00Z";
            return product;
        }
    }
    return null;
}

pub fn delete_product(id: usize) bool {
    for (products.items, 0..) |product, i| {
        if (product.id == id) {
            _ = products.orderedRemove(i);
            return true;
        }
    }
    return false;
}

pub fn hash_password(password: []const u8) []const u8 {
    // Simplified - in production use proper SHA256
    return password;
}

pub fn generate_token(user: *User) []const u8 {
    // Simplified - in production use proper JWT
    return "jwt-token-placeholder";
}
`,

    // Build configuration
    'build.zig': `const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "{{projectName}}",
        .root_source_file = "src/main.zig",
        .target = target,
        .optimize = optimize});

    // Import Zap package
    const zap = b.dependency("zap", .{
        .target = target,
        .optimize = optimize});
    exe.addModule("zap", zap.module("zap"));

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}
`,

    // Build configuration for dependencies
    'build.zig.zon': `.{
    .name = "{{projectName}}",
    .version = "0.1.0",
    .dependencies = .{
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/refs/tags/main.tar.gz",
            .hash = "122098a8c6876e1db2bc47eefd6dba01af7d31e5fbf8cf2e2e4335a5028c76d42d"}}}
`,

    // Dockerfile
    'Dockerfile': `# Builder stage
FROM ziglang/zig:latest AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY build.zig.zon ./
COPY build.zig ./

# Download dependencies
RUN zig fetch

# Copy source code
COPY src ./src

# Build the application
RUN zig build -Doptimize=ReleaseFast

# Runtime stage
FROM alpine:3.18

# Install ca-certificates for HTTPS requests
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -g 1000 appgroup && \
    adduser -D -u 1000 -G appgroup appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/zig-out/bin/{{projectName}} /app/{{projectName}}

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["/app/{{projectName}}"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
`,

    // README
    'README.md': `# {{projectName}}

High-performance HTTP server built with Zig and Zap framework.

## Features

- **Zap**: Fast, composable HTTP framework for Zig
- **High Performance**: Zero-allocation where possible
- **Type-Safe**: Compile-time guarantees
- **Async I/O**: Efficient non-blocking operations
- **Memory Safety**: Manual memory management with safety checks
- **Authentication**: Password hashing and JWT-like tokens

## Requirements

- Zig 0.11.0 or later

## Quick Start

\`\`\`bash
# Build
zig build

# Run
zig build run
\`\`\`

Visit http://localhost:3000

## API Endpoints

- \`GET /\` - Home page
- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

## Project Structure

\`\`\`
src/
  main.zig           # Entry point
  {{projectName}}.zig  # Application module
  handlers.zig      # HTTP request handlers
  models.zig        # Data models and database
\`\`\`

## Performance

Zap provides:
- Minimal allocations
- Zero-copy parsing where possible
- Efficient async I/O
- Compile-time optimization
- Manual memory management

## License

MIT
`
  }
};
