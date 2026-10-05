import { BackendTemplate } from '../types';

export const zapZigTemplate: BackendTemplate = {
  id: 'zap-zig',
  name: 'zap-zig',
  displayName: 'Zap (Zig)',
  description: 'HTTP API for Zig 0.13 on the Zap framework with JWT auth, products CRUD and a GraphQL endpoint',
  language: 'zig',
  framework: 'zap',
  version: '1.0.0',
  tags: ['zig', 'zap', 'high-performance', 'rest', 'jwt'],
  port: 3000,
  dependencies: {
    zap: 'https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz'
  },
  features: ['authentication', 'validation', 'cors', 'testing', 'graphql'],

  files: {
    'build.zig': `const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Zap is fetched from build.zig.zon, which pins its release URL and content hash.
    const zap = b.dependency("zap", .{
        .target = target,
        .optimize = optimize,
        .openssl = false, // set to true to enable TLS support
    });

    const exe = b.addExecutable(.{
        .name = "{{projectName}}",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    exe.root_module.addImport("zap", zap.module("zap"));
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // Unit tests cover the modules that do not depend on Zap (auth, store, GraphQL).
    const unit_tests = b.addTest(.{
        .root_source_file = b.path("src/tests.zig"),
        .target = target,
        .optimize = optimize,
    });
    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
`,

    'build.zig.zon': `.{
    .name = "{{projectName}}",
    .version = "0.1.0",
    .dependencies = .{
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz",
            .hash = "12209936c3333b53b53edcf453b1670babb9ae8c2197b1ca627c01e72670e20c1a21",
        },
    },
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
    },
}
`,

    'src/main.zig': `const std = @import("std");
const zap = @import("zap");
const auth = @import("auth.zig");
const handlers = @import("handlers.zig");
const store = @import("store.zig");

pub fn main() !void {
    const allocator = std.heap.page_allocator;

    if (std.process.getEnvVarOwned(allocator, "JWT_SECRET")) |value| {
        auth.secret = value;
    } else |_| {
        std.log.warn("JWT_SECRET is not set; using the insecure development secret", .{});
    }

    var port: usize = 3000;
    if (std.process.getEnvVarOwned(allocator, "PORT")) |value| {
        port = std.fmt.parseInt(usize, value, 10) catch port;
    } else |_| {}

    handlers.db = store.Store.init(allocator);

    // Seed data for local development: change or remove before deploying.
    _ = try handlers.createUser("admin@example.com", "Admin User", "admin123", true);
    _ = try handlers.db.addProduct("Sample Product 1", "This is a sample product", 29.99, 100);
    _ = try handlers.db.addProduct("Sample Product 2", "Another sample product", 49.99, 50);

    var listener = zap.HttpListener.init(.{
        .port = port,
        .on_request = handlers.onRequest,
        .log = true,
        .max_clients = 100000,
    });
    try listener.listen();

    std.debug.print("{{projectName}} listening on http://localhost:{d}\\n", .{port});
    std.debug.print("Seed admin: admin@example.com / admin123\\n", .{});

    // One thread and one worker: the in-memory store is not synchronised.
    zap.start(.{ .threads = 1, .workers = 1 });
}
`,

    'src/handlers.zig': `const std = @import("std");
const zap = @import("zap");
const auth = @import("auth.zig");
const graphql = @import("graphql.zig");
const store = @import("store.zig");

/// The application's data; main.zig initialises it before the server starts.
pub var db: store.Store = undefined;

const api_prefix = "/api/v1";

/// Zap request callback: routes the request, answering 500 if a handler fails.
pub fn onRequest(r: zap.Request) void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    route(arena.allocator(), r) catch |err| {
        std.log.err("request failed: {s}", .{@errorName(err)});
        sendError(arena.allocator(), r, .internal_server_error, "internal server error");
    };
}

fn route(a: std.mem.Allocator, r: zap.Request) !void {
    const method = r.method orelse "";
    const path = r.path orelse "/";

    // CORS: allow browser clients; tighten the origin for production.
    r.setHeader("Access-Control-Allow-Origin", "*") catch {};
    r.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS") catch {};
    r.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization") catch {};
    if (std.mem.eql(u8, method, "OPTIONS")) {
        r.setStatus(.no_content);
        try r.sendBody("");
        return;
    }

    if (std.mem.eql(u8, path, "/")) return home(r);
    if (std.mem.eql(u8, path, "/graphql")) return graphqlEndpoint(a, r, method);
    if (std.mem.eql(u8, path, api_prefix ++ "/health")) return health(a, r);
    if (std.mem.eql(u8, path, api_prefix ++ "/auth/register")) return register(a, r, method);
    if (std.mem.eql(u8, path, api_prefix ++ "/auth/login")) return login(a, r, method);
    if (std.mem.eql(u8, path, api_prefix ++ "/products")) return products(a, r, method);

    const product_prefix = api_prefix ++ "/products/";
    if (std.mem.startsWith(u8, path, product_prefix)) {
        const id = std.fmt.parseInt(u32, path[product_prefix.len..], 10) catch
            return sendError(a, r, .bad_request, "product id must be a number");
        return product(a, r, method, id);
    }

    sendError(a, r, .not_found, "not found");
}

fn home(r: zap.Request) !void {
    r.setHeader("Content-Type", "text/html; charset=utf-8") catch {};
    try r.sendBody(
        \\\\<!DOCTYPE html>
        \\\\<html>
        \\\\  <head><title>{{projectName}}</title></head>
        \\\\  <body>
        \\\\    <h1>{{projectName}}</h1>
        \\\\    <p>HTTP API built with Zig and Zap.</p>
        \\\\    <p>Try <a href="/api/v1/health">/api/v1/health</a>.</p>
        \\\\  </body>
        \\\\</html>
    );
}

fn health(a: std.mem.Allocator, r: zap.Request) !void {
    try sendJson(a, r, .ok, .{
        .status = "healthy",
        .timestamp = std.time.timestamp(),
        .version = "1.0.0",
    });
}

fn graphqlEndpoint(a: std.mem.Allocator, r: zap.Request, method: []const u8) !void {
    if (!std.mem.eql(u8, method, "POST")) return methodNotAllowed(a, r);
    const body = r.body orelse return sendError(a, r, .bad_request, "request body required");
    const response = try graphql.execute(a, body);
    r.setStatus(.ok);
    try r.sendJson(response);
}

// ----------------------------------------------------------------- auth

const Credentials = struct {
    email: []const u8,
    password: []const u8,
    name: []const u8 = "",
};

const PublicUser = struct {
    id: u32,
    email: []const u8,
    name: []const u8,
    role: []const u8,
};

fn publicUser(user: *const store.User) PublicUser {
    return .{
        .id = user.id,
        .email = user.email,
        .name = user.name,
        .role = if (user.is_admin) "admin" else "user",
    };
}

fn sendSession(a: std.mem.Allocator, r: zap.Request, status: anytype, user: *const store.User) !void {
    const token = try auth.issueToken(a, user.id, user.is_admin, std.time.timestamp());
    try sendJson(a, r, status, .{ .token = token, .user = publicUser(user) });
}

fn parseBody(comptime T: type, a: std.mem.Allocator, r: zap.Request) ?T {
    const body = r.body orelse return null;
    const parsed = std.json.parseFromSlice(T, a, body, .{ .ignore_unknown_fields = true }) catch return null;
    return parsed.value;
}

/// Creates a user and stores its bcrypt hash; used by registration and by main.zig for the seed admin.
pub fn createUser(email: []const u8, name: []const u8, password: []const u8, is_admin: bool) !*store.User {
    var buf: [auth.hash_buf_len]u8 = undefined;
    const hash = try auth.hashPassword(password, &buf);
    return db.addUser(email, name, hash, is_admin);
}

fn register(a: std.mem.Allocator, r: zap.Request, method: []const u8) !void {
    if (!std.mem.eql(u8, method, "POST")) return methodNotAllowed(a, r);
    const creds = parseBody(Credentials, a, r) orelse
        return sendError(a, r, .bad_request, "expected JSON with email, password and optional name");
    if (creds.email.len == 0 or creds.password.len < 8) {
        return sendError(a, r, .bad_request, "email is required and password needs at least 8 characters");
    }
    if (db.findUserByEmail(creds.email) != null) {
        return sendError(a, r, .conflict, "email already registered");
    }
    const user = try createUser(creds.email, creds.name, creds.password, false);
    try sendSession(a, r, .created, user);
}

fn login(a: std.mem.Allocator, r: zap.Request, method: []const u8) !void {
    if (!std.mem.eql(u8, method, "POST")) return methodNotAllowed(a, r);
    const creds = parseBody(Credentials, a, r) orelse
        return sendError(a, r, .bad_request, "expected JSON with email and password");
    const user = db.findUserByEmail(creds.email) orelse
        return sendError(a, r, .unauthorized, "invalid credentials");
    if (!auth.verifyPassword(user.password_hash, creds.password)) {
        return sendError(a, r, .unauthorized, "invalid credentials");
    }
    try sendSession(a, r, .ok, user);
}

/// Returns the caller's claims, or answers 401 and returns null.
fn requireAuth(a: std.mem.Allocator, r: zap.Request) ?auth.Claims {
    const token = auth.bearerToken(r.getHeader("authorization"));
    if (token) |value| {
        if (auth.verifyToken(a, value, std.time.timestamp())) |claims| return claims;
    }
    sendError(a, r, .unauthorized, "a valid bearer token is required");
    return null;
}

// ------------------------------------------------------------- products

const ProductInput = struct {
    name: []const u8,
    description: []const u8 = "",
    price: f64,
    stock: u32 = 0,
};

const ProductPatch = struct {
    name: ?[]const u8 = null,
    description: ?[]const u8 = null,
    price: ?f64 = null,
    stock: ?u32 = null,
};

fn products(a: std.mem.Allocator, r: zap.Request, method: []const u8) !void {
    if (std.mem.eql(u8, method, "GET")) {
        return sendJson(a, r, .ok, .{ .products = db.products.items, .count = db.products.items.len });
    }
    if (std.mem.eql(u8, method, "POST")) {
        _ = requireAuth(a, r) orelse return;
        const input = parseBody(ProductInput, a, r) orelse
            return sendError(a, r, .bad_request, "expected JSON with name, price and optional description, stock");
        if (input.name.len == 0 or input.price < 0) {
            return sendError(a, r, .bad_request, "name is required and price must not be negative");
        }
        const created = try db.addProduct(input.name, input.description, input.price, input.stock);
        return sendJson(a, r, .created, .{ .product = created.* });
    }
    return methodNotAllowed(a, r);
}

fn product(a: std.mem.Allocator, r: zap.Request, method: []const u8, id: u32) !void {
    if (std.mem.eql(u8, method, "GET")) {
        const found = db.getProduct(id) orelse return sendError(a, r, .not_found, "product not found");
        return sendJson(a, r, .ok, .{ .product = found.* });
    }
    if (std.mem.eql(u8, method, "PUT")) {
        _ = requireAuth(a, r) orelse return;
        const patch = parseBody(ProductPatch, a, r) orelse
            return sendError(a, r, .bad_request, "expected a JSON object with the fields to change");
        if (patch.price) |price| {
            if (price < 0) return sendError(a, r, .bad_request, "price must not be negative");
        }
        const updated = (try db.updateProduct(id, patch.name, patch.description, patch.price, patch.stock)) orelse
            return sendError(a, r, .not_found, "product not found");
        return sendJson(a, r, .ok, .{ .product = updated.* });
    }
    if (std.mem.eql(u8, method, "DELETE")) {
        const claims = requireAuth(a, r) orelse return;
        if (!claims.is_admin) return sendError(a, r, .forbidden, "admin role required");
        if (!db.deleteProduct(id)) return sendError(a, r, .not_found, "product not found");
        r.setStatus(.no_content);
        return r.sendBody("");
    }
    return methodNotAllowed(a, r);
}

// -------------------------------------------------------------- helpers

fn methodNotAllowed(a: std.mem.Allocator, r: zap.Request) void {
    sendError(a, r, .method_not_allowed, "method not allowed");
}

/// Serialises \`value\` as JSON and sends it with the given status (an enum literal such as \`.ok\`).
fn sendJson(a: std.mem.Allocator, r: zap.Request, status: anytype, value: anytype) !void {
    const body = try std.json.stringifyAlloc(a, value, .{});
    r.setStatus(status);
    try r.sendJson(body);
}

fn sendError(a: std.mem.Allocator, r: zap.Request, status: anytype, message: []const u8) void {
    sendJson(a, r, status, .{ .@"error" = message }) catch {
        r.setStatus(status);
        r.sendBody(message) catch {};
    };
}
`,

    'src/auth.zig': `//! Password hashing (bcrypt) and HS256 JSON Web Tokens, built on std.crypto only.
const std = @import("std");

const HmacSha256 = std.crypto.auth.hmac.sha2.HmacSha256;
const bcrypt = std.crypto.pwhash.bcrypt;
const b64 = std.base64.url_safe_no_pad;

/// Signing secret. main.zig replaces it with $JWT_SECRET when that is set.
pub var secret: []const u8 = "change-me-in-production";

/// Token lifetime in seconds.
pub const token_ttl_seconds: i64 = 24 * 60 * 60;

pub const Claims = struct {
    user_id: u32,
    is_admin: bool,
};

pub const hash_buf_len = bcrypt.hash_length;

/// Hashes \`password\` into \`buf\` (bcrypt, crypt encoding) and returns the used slice.
pub fn hashPassword(password: []const u8, buf: *[hash_buf_len]u8) ![]const u8 {
    return bcrypt.strHash(password, .{
        .params = .{ .rounds_log = 10 },
        .encoding = .crypt,
    }, buf);
}

pub fn verifyPassword(hash: []const u8, password: []const u8) bool {
    bcrypt.strVerify(hash, password, .{}) catch return false;
    return true;
}

fn encode(allocator: std.mem.Allocator, bytes: []const u8) ![]u8 {
    const out = try allocator.alloc(u8, b64.Encoder.calcSize(bytes.len));
    return @constCast(b64.Encoder.encode(out, bytes));
}

fn sign(message: []const u8) [HmacSha256.mac_length]u8 {
    var mac: [HmacSha256.mac_length]u8 = undefined;
    HmacSha256.create(&mac, message, secret);
    return mac;
}

/// Issues a signed token valid for \`token_ttl_seconds\` from \`now\` (unix seconds).
pub fn issueToken(allocator: std.mem.Allocator, user_id: u32, is_admin: bool, now: i64) ![]u8 {
    const header = try encode(allocator, "{\\"alg\\":\\"HS256\\",\\"typ\\":\\"JWT\\"}");
    const payload_json = try std.fmt.allocPrint(
        allocator,
        "{{\\"sub\\":{d},\\"admin\\":{},\\"exp\\":{d}}}",
        .{ user_id, is_admin, now + token_ttl_seconds },
    );
    const payload = try encode(allocator, payload_json);
    const signing_input = try std.fmt.allocPrint(allocator, "{s}.{s}", .{ header, payload });
    const mac = sign(signing_input);
    const signature = try encode(allocator, &mac);
    return std.fmt.allocPrint(allocator, "{s}.{s}", .{ signing_input, signature });
}

const Payload = struct {
    sub: u32,
    admin: bool = false,
    exp: i64,
};

/// Verifies signature and expiry; returns the claims or null.
pub fn verifyToken(allocator: std.mem.Allocator, token: []const u8, now: i64) ?Claims {
    const last_dot = std.mem.lastIndexOfScalar(u8, token, '.') orelse return null;
    const signing_input = token[0..last_dot];
    const signature = token[last_dot + 1 ..];

    const expected = sign(signing_input);
    var provided: [HmacSha256.mac_length]u8 = undefined;
    const signature_len = b64.Decoder.calcSizeForSlice(signature) catch return null;
    if (signature_len != provided.len) return null;
    b64.Decoder.decode(&provided, signature) catch return null;
    if (!std.crypto.utils.timingSafeEql([HmacSha256.mac_length]u8, expected, provided)) return null;

    const first_dot = std.mem.indexOfScalar(u8, signing_input, '.') orelse return null;
    const payload_b64 = signing_input[first_dot + 1 ..];
    const payload_len = b64.Decoder.calcSizeForSlice(payload_b64) catch return null;
    const payload_json = allocator.alloc(u8, payload_len) catch return null;
    b64.Decoder.decode(payload_json, payload_b64) catch return null;

    const parsed = std.json.parseFromSlice(Payload, allocator, payload_json, .{
        .ignore_unknown_fields = true,
    }) catch return null;
    defer parsed.deinit();
    if (parsed.value.exp <= now) return null;
    return .{ .user_id = parsed.value.sub, .is_admin = parsed.value.admin };
}

/// Extracts the token from an \`Authorization: Bearer <token>\` header value.
pub fn bearerToken(header: ?[]const u8) ?[]const u8 {
    const value = header orelse return null;
    const prefix = "Bearer ";
    if (!std.mem.startsWith(u8, value, prefix)) return null;
    const token = std.mem.trim(u8, value[prefix.len..], " ");
    return if (token.len == 0) null else token;
}

test "password hashes verify only the right password" {
    var buf: [hash_buf_len]u8 = undefined;
    const hash = try hashPassword("admin123", &buf);
    try std.testing.expect(verifyPassword(hash, "admin123"));
    try std.testing.expect(!verifyPassword(hash, "wrong"));
}

test "tokens round-trip and reject tampering or expiry" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    const token = try issueToken(a, 7, true, 1_000);
    const claims = verifyToken(a, token, 1_001) orelse return error.TestUnexpectedResult;
    try std.testing.expectEqual(@as(u32, 7), claims.user_id);
    try std.testing.expect(claims.is_admin);

    try std.testing.expect(verifyToken(a, token, 1_000 + token_ttl_seconds + 1) == null);

    const tampered = try a.dupe(u8, token);
    tampered[tampered.len - 1] = if (tampered[tampered.len - 1] == 'A') 'B' else 'A';
    try std.testing.expect(verifyToken(a, tampered, 1_001) == null);
    try std.testing.expect(verifyToken(a, "not-a-token", 1_001) == null);
}

test "bearer header parsing" {
    try std.testing.expectEqualStrings("abc", bearerToken("Bearer abc").?);
    try std.testing.expect(bearerToken("Basic abc") == null);
    try std.testing.expect(bearerToken(null) == null);
    try std.testing.expect(bearerToken("Bearer ") == null);
}
`,

    'src/store.zig': `//! In-memory users and products. Replace with a real database for production.
//! Zap is started with a single worker thread and a single thread, so the store
//! needs no locking; add a mutex before raising \`threads\` in main.zig.
const std = @import("std");

pub const User = struct {
    id: u32,
    email: []const u8,
    name: []const u8,
    password_hash: []const u8,
    is_admin: bool,
};

pub const Product = struct {
    id: u32,
    name: []const u8,
    description: []const u8,
    price: f64,
    stock: u32,
};

pub const Store = struct {
    allocator: std.mem.Allocator,
    users: std.ArrayList(User),
    products: std.ArrayList(Product),
    next_user_id: u32 = 1,
    next_product_id: u32 = 1,

    pub fn init(allocator: std.mem.Allocator) Store {
        return .{
            .allocator = allocator,
            .users = std.ArrayList(User).init(allocator),
            .products = std.ArrayList(Product).init(allocator),
        };
    }

    pub fn deinit(self: *Store) void {
        for (self.users.items) |user| {
            self.allocator.free(user.email);
            self.allocator.free(user.name);
            self.allocator.free(user.password_hash);
        }
        for (self.products.items) |product| {
            self.allocator.free(product.name);
            self.allocator.free(product.description);
        }
        self.users.deinit();
        self.products.deinit();
    }

    pub fn findUserByEmail(self: *Store, email: []const u8) ?*User {
        for (self.users.items) |*user| {
            if (std.ascii.eqlIgnoreCase(user.email, email)) return user;
        }
        return null;
    }

    pub fn findUserById(self: *Store, id: u32) ?*User {
        for (self.users.items) |*user| {
            if (user.id == id) return user;
        }
        return null;
    }

    pub fn addUser(
        self: *Store,
        email: []const u8,
        name: []const u8,
        password_hash: []const u8,
        is_admin: bool,
    ) !*User {
        const email_copy = try self.allocator.dupe(u8, email);
        errdefer self.allocator.free(email_copy);
        const name_copy = try self.allocator.dupe(u8, name);
        errdefer self.allocator.free(name_copy);
        const hash_copy = try self.allocator.dupe(u8, password_hash);
        errdefer self.allocator.free(hash_copy);

        try self.users.append(.{
            .id = self.next_user_id,
            .email = email_copy,
            .name = name_copy,
            .password_hash = hash_copy,
            .is_admin = is_admin,
        });
        self.next_user_id += 1;
        return &self.users.items[self.users.items.len - 1];
    }

    pub fn addProduct(
        self: *Store,
        name: []const u8,
        description: []const u8,
        price: f64,
        stock: u32,
    ) !*Product {
        const name_copy = try self.allocator.dupe(u8, name);
        errdefer self.allocator.free(name_copy);
        const description_copy = try self.allocator.dupe(u8, description);
        errdefer self.allocator.free(description_copy);

        try self.products.append(.{
            .id = self.next_product_id,
            .name = name_copy,
            .description = description_copy,
            .price = price,
            .stock = stock,
        });
        self.next_product_id += 1;
        return &self.products.items[self.products.items.len - 1];
    }

    pub fn getProduct(self: *Store, id: u32) ?*Product {
        for (self.products.items) |*product| {
            if (product.id == id) return product;
        }
        return null;
    }

    /// Applies the provided fields; returns null when the product does not exist.
    pub fn updateProduct(
        self: *Store,
        id: u32,
        name: ?[]const u8,
        description: ?[]const u8,
        price: ?f64,
        stock: ?u32,
    ) !?*Product {
        const product = self.getProduct(id) orelse return null;
        if (name) |value| {
            const copy = try self.allocator.dupe(u8, value);
            self.allocator.free(product.name);
            product.name = copy;
        }
        if (description) |value| {
            const copy = try self.allocator.dupe(u8, value);
            self.allocator.free(product.description);
            product.description = copy;
        }
        if (price) |value| product.price = value;
        if (stock) |value| product.stock = value;
        return product;
    }

    pub fn deleteProduct(self: *Store, id: u32) bool {
        for (self.products.items, 0..) |product, index| {
            if (product.id == id) {
                self.allocator.free(product.name);
                self.allocator.free(product.description);
                _ = self.products.orderedRemove(index);
                return true;
            }
        }
        return false;
    }
};

test "products can be created, updated and deleted" {
    var store = Store.init(std.testing.allocator);
    defer store.deinit();

    const created = try store.addProduct("Widget", "A widget", 9.5, 3);
    try std.testing.expectEqual(@as(u32, 1), created.id);

    const updated = (try store.updateProduct(1, "Gadget", null, null, 10)) orelse
        return error.TestUnexpectedResult;
    try std.testing.expectEqualStrings("Gadget", updated.name);
    try std.testing.expectEqualStrings("A widget", updated.description);
    try std.testing.expectEqual(@as(u32, 10), updated.stock);

    try std.testing.expect((try store.updateProduct(99, null, null, null, null)) == null);
    try std.testing.expect(store.deleteProduct(1));
    try std.testing.expect(!store.deleteProduct(1));
    try std.testing.expect(store.getProduct(1) == null);
}

test "users are found by email regardless of case" {
    var store = Store.init(std.testing.allocator);
    defer store.deinit();

    _ = try store.addUser("Admin@Example.com", "Admin", "hash", true);
    try std.testing.expect(store.findUserByEmail("admin@example.com") != null);
    try std.testing.expect(store.findUserByEmail("other@example.com") == null);
    try std.testing.expect(store.findUserById(1) != null);
    try std.testing.expect(store.findUserById(2) == null);
}
`,

    'src/graphql.zig': `//! A deliberately small GraphQL endpoint: \`{ hello health }\` queries only.
//! For full schemas put a GraphQL engine in front of the REST handlers.
const std = @import("std");

pub const schema_sdl =
    \\\\type Query {
    \\\\  hello: String!
    \\\\  health: String!
    \\\\}
;

const Request = struct {
    query: []const u8 = "",
};

const Data = struct {
    hello: ?[]const u8 = null,
    health: ?[]const u8 = null,
};

const ErrorItem = struct {
    message: []const u8,
};

const Response = struct {
    data: ?Data = null,
    errors: ?[]const ErrorItem = null,
};

fn render(allocator: std.mem.Allocator, response: Response) ![]u8 {
    return std.json.stringifyAlloc(allocator, response, .{ .emit_null_optional_fields = false });
}

fn errorResponse(allocator: std.mem.Allocator, message: []const u8) ![]u8 {
    const items = [_]ErrorItem{.{ .message = message }};
    return render(allocator, .{ .errors = &items });
}

/// Executes a GraphQL request body (\`{"query": "{ hello }"}\`) and returns the JSON response.
pub fn execute(allocator: std.mem.Allocator, body: []const u8) ![]u8 {
    const parsed = std.json.parseFromSlice(Request, allocator, body, .{
        .ignore_unknown_fields = true,
    }) catch return errorResponse(allocator, "request body must be JSON with a query field");
    defer parsed.deinit();

    const query = parsed.value.query;
    const wants_hello = std.mem.indexOf(u8, query, "hello") != null;
    const wants_health = std.mem.indexOf(u8, query, "health") != null;
    if (!wants_hello and !wants_health) {
        return errorResponse(allocator, "unknown field: only hello and health are available");
    }

    return render(allocator, .{ .data = .{
        .hello = if (wants_hello) "Hello from Zap GraphQL!" else null,
        .health = if (wants_health) "healthy" else null,
    } });
}

test "selects only the requested fields" {
    const a = std.testing.allocator;

    const both = try execute(a, "{\\"query\\":\\"{ hello health }\\"}");
    defer a.free(both);
    try std.testing.expectEqualStrings(
        "{\\"data\\":{\\"hello\\":\\"Hello from Zap GraphQL!\\",\\"health\\":\\"healthy\\"}}",
        both,
    );

    const only_health = try execute(a, "{\\"query\\":\\"{ health }\\"}");
    defer a.free(only_health);
    try std.testing.expectEqualStrings("{\\"data\\":{\\"health\\":\\"healthy\\"}}", only_health);
}

test "reports unknown fields and malformed bodies" {
    const a = std.testing.allocator;

    const unknown = try execute(a, "{\\"query\\":\\"{ nope }\\"}");
    defer a.free(unknown);
    try std.testing.expect(std.mem.indexOf(u8, unknown, "errors") != null);

    const malformed = try execute(a, "not json");
    defer a.free(malformed);
    try std.testing.expect(std.mem.indexOf(u8, malformed, "errors") != null);
}
`,

    'src/tests.zig': `// Test root: pulls in every module that does not import Zap.
test {
    _ = @import("auth.zig");
    _ = @import("store.zig");
    _ = @import("graphql.zig");
}
`,

    '.gitignore': `zig-out/
.zig-cache/
zig-cache/
`,

    'Dockerfile': `# Build stage: Zig 0.13 from the official release tarball
FROM debian:bookworm-slim AS builder

ARG ZIG_VERSION=0.13.0
RUN apt-get update \\
    && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \\
    && rm -rf /var/lib/apt/lists/* \\
    && curl -fsSL "https://ziglang.org/download/\${ZIG_VERSION}/zig-linux-$(uname -m)-\${ZIG_VERSION}.tar.xz" \\
       | tar -xJ -C /opt \\
    && ln -s "/opt/zig-linux-$(uname -m)-\${ZIG_VERSION}/zig" /usr/local/bin/zig

WORKDIR /app
COPY build.zig build.zig.zon ./
COPY src ./src

# build.zig.zon pins Zap's hash; only record it if an edit removed the pin (see README).
RUN grep -q '\\.hash = ' build.zig.zon \\
    || zig fetch --save=zap https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz

# Baseline CPU features, so the image runs on hosts other than the one that built it.
RUN zig build -Doptimize=ReleaseSafe -Dcpu=baseline

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update \\
    && apt-get install -y --no-install-recommends curl \\
    && rm -rf /var/lib/apt/lists/* \\
    && useradd --system --uid 1000 appuser

WORKDIR /app
COPY --from=builder /app/zig-out/bin/{{projectName}} /app/{{projectName}}
USER appuser

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -fsS http://localhost:3000/api/v1/health || exit 1

CMD ["/app/{{projectName}}"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      PORT: "3000"
      JWT_SECRET: \${JWT_SECRET:?set JWT_SECRET}
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

HTTP API built with [Zig](https://ziglang.org) 0.13 and the [Zap](https://github.com/zigzap/zap) web framework.

## Features

- REST API: health check, registration/login, products CRUD
- Bcrypt password hashes and HS256 JSON Web Tokens (std.crypto, no extra packages)
- Bearer-token protection for product writes (delete requires the admin role)
- CORS headers and a small GraphQL endpoint (\`{ hello health }\`)
- In-memory store, unit tests and a Dockerfile

## Requirements

- Zig 0.13.0 (Zap v0.8.0 targets this release)

## Zap dependency pin

\`build.zig.zon\` pins Zap by URL (release v0.8.0) and by content hash, so \`zig build\` fetches
exactly that archive. To move to another Zap release, replace the URL and let Zig record the
new hash:

\`\`\`bash
zig fetch --save=zap https://github.com/zigzap/zap/archive/refs/tags/<tag>.tar.gz
\`\`\`

If the \`.hash\` line is ever removed, \`zig build\` stops with "dependency is missing hash
field"; the same command restores it. The Dockerfile runs it when the hash is missing.

## Quick start

\`\`\`bash
zig build            # build
zig build run        # run on http://localhost:3000 (PORT overrides the port)
zig build test       # unit tests (auth, store, GraphQL)
\`\`\`

Set \`JWT_SECRET\` before running anywhere but your laptop. A development admin is
seeded at start-up (\`admin@example.com\` / \`admin123\`); remove it in \`src/main.zig\`.

## API

- \`GET /\` - home page
- \`GET /api/v1/health\` - health check
- \`POST /api/v1/auth/register\` - body \`{"email","password","name"}\`, returns a token
- \`POST /api/v1/auth/login\` - body \`{"email","password"}\`, returns a token
- \`GET /api/v1/products\` and \`GET /api/v1/products/:id\`
- \`POST /api/v1/products\` and \`PUT /api/v1/products/:id\` - need \`Authorization: Bearer <token>\`
- \`DELETE /api/v1/products/:id\` - admin token required
- \`POST /graphql\` - body \`{"query":"{ hello health }"}\`

\`\`\`bash
TOKEN=$(curl -s localhost:3000/api/v1/auth/login -d '{"email":"admin@example.com","password":"admin123"}' | jq -r .token)
curl -s localhost:3000/api/v1/products -H "Authorization: Bearer $TOKEN" -d '{"name":"Widget","price":9.5}'
\`\`\`

## Project structure

\`\`\`
src/
  main.zig       # entry point: configuration, seed data, Zap listener
  handlers.zig   # routing and request handlers
  auth.zig       # bcrypt + HS256 tokens
  store.zig      # in-memory users and products
  graphql.zig    # minimal GraphQL endpoint
  tests.zig      # test root
\`\`\`

The store is not synchronised, so Zap runs with one thread and one worker; add a mutex
before raising those numbers in \`src/main.zig\`.

## License

MIT
`
  }
};
