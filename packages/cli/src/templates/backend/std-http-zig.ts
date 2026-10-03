import { BackendTemplate } from '../types';

export const stdHttpZigTemplate: BackendTemplate = {
  id: 'std-http-zig',
  name: 'std-http-zig',
  displayName: 'Zig std.http server',
  description: 'REST API on Zig\'s standard library only (std.http.Server and std.json), with no dependencies',
  language: 'zig',
  framework: 'zig-std-http',
  version: '1.0.0',
  tags: ['zig', 'http', 'std', 'api', 'rest', 'no-dependencies'],
  port: 3000,
  dependencies: {},
  features: ['docker', 'json', 'rest-api', 'routing', 'testing'],

  files: {
    'build.zig': `const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "{{projectName}}",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| run_cmd.addArgs(args);
    const run_step = b.step("run", "Run the server");
    run_step.dependOn(&run_cmd.step);

    const unit_tests = b.addTest(.{
        .root_source_file = b.path("src/routes.zig"),
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
    // The sources use the 0.13 standard library (std.http.Server, std.Build).
    .minimum_zig_version = "0.13.0",
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
    },
}
`,

    '.gitignore': `.zig-cache/
zig-cache/
zig-out/
`,

    'src/main.zig': `const std = @import("std");
const http = std.http;
const routes = @import("routes.zig");

const log = std.log.scoped(.server);

fn onSignal(_: c_int) callconv(.C) void {
    // The server holds no state that needs flushing, so exit cleanly right away.
    std.process.exit(0);
}

fn portFromEnv(allocator: std.mem.Allocator) u16 {
    const value = std.process.getEnvVarOwned(allocator, "PORT") catch return 3000;
    defer allocator.free(value);
    return std.fmt.parseInt(u16, value, 10) catch 3000;
}

fn serve(allocator: std.mem.Allocator, store: *routes.Store, connection: std.net.Server.Connection) !void {
    defer connection.stream.close();

    var read_buffer: [8192]u8 = undefined;
    var server = http.Server.init(connection, &read_buffer);
    while (server.state == .ready) {
        var request = server.receiveHead() catch |err| switch (err) {
            error.HttpConnectionClosing => return,
            else => return err,
        };
        try routes.handle(allocator, store, &request);
    }
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const action = std.posix.Sigaction{
        .handler = .{ .handler = onSignal },
        .mask = std.posix.empty_sigset,
        .flags = 0,
    };
    try std.posix.sigaction(std.posix.SIG.TERM, &action, null);
    try std.posix.sigaction(std.posix.SIG.INT, &action, null);

    const port = portFromEnv(allocator);
    const address = try std.net.Address.parseIp("0.0.0.0", port);
    var listener = try address.listen(.{ .reuse_address = true });
    defer listener.deinit();

    var store = routes.Store.init(allocator);
    defer store.deinit();

    log.info("{{projectName}} listening on http://0.0.0.0:{d}", .{port});

    // One connection at a time. For concurrency, accept in a loop and hand each
    // connection to std.Thread.spawn (guard the Store with a std.Thread.Mutex).
    while (true) {
        const connection = listener.accept() catch |err| {
            log.err("accept failed: {}", .{err});
            continue;
        };
        serve(allocator, &store, connection) catch |err| {
            log.err("connection failed: {}", .{err});
        };
    }
}
`,

    'src/routes.zig': `const std = @import("std");
const http = std.http;

const json_headers = [_]http.Header{.{ .name = "content-type", .value = "application/json" }};

pub const Note = struct {
    id: u32,
    text: []const u8,
};

/// In-memory notes. Replace with a database in a real service.
pub const Store = struct {
    allocator: std.mem.Allocator,
    notes: std.ArrayList(Note),
    next_id: u32 = 1,

    pub fn init(allocator: std.mem.Allocator) Store {
        return .{ .allocator = allocator, .notes = std.ArrayList(Note).init(allocator) };
    }

    pub fn deinit(self: *Store) void {
        for (self.notes.items) |note| self.allocator.free(note.text);
        self.notes.deinit();
    }

    pub fn add(self: *Store, text: []const u8) !Note {
        const copy = try self.allocator.dupe(u8, text);
        errdefer self.allocator.free(copy);
        const note = Note{ .id = self.next_id, .text = copy };
        try self.notes.append(note);
        self.next_id += 1;
        return note;
    }
};

/// Returns the raw value of \`key\` in a query string such as "name=zig&x=1".
pub fn queryParam(query: []const u8, key: []const u8) ?[]const u8 {
    var pairs = std.mem.splitScalar(u8, query, '&');
    while (pairs.next()) |pair| {
        const eq = std.mem.indexOfScalar(u8, pair, '=') orelse continue;
        if (std.mem.eql(u8, pair[0..eq], key)) return pair[eq + 1 ..];
    }
    return null;
}

fn respondJson(request: *http.Server.Request, status: http.Status, body: []const u8) !void {
    try request.respond(body, .{ .status = status, .extra_headers = &json_headers });
}

fn respondValue(allocator: std.mem.Allocator, request: *http.Server.Request, status: http.Status, value: anytype) !void {
    const body = try std.json.stringifyAlloc(allocator, value, .{});
    defer allocator.free(body);
    try respondJson(request, status, body);
}

pub fn handle(allocator: std.mem.Allocator, store: *Store, request: *http.Server.Request) !void {
    const target = request.head.target;
    const split = std.mem.indexOfScalar(u8, target, '?');
    const path = if (split) |i| target[0..i] else target;
    const query = if (split) |i| target[i + 1 ..] else "";
    const method = request.head.method;

    if (std.mem.eql(u8, path, "/health")) {
        return respondJson(request, .ok, "{\\"status\\":\\"healthy\\"}");
    }

    if (std.mem.eql(u8, path, "/api/v1/hello")) {
        const name = queryParam(query, "name") orelse "world";
        return respondValue(allocator, request, .ok, .{ .message = "Hello", .name = name });
    }

    if (std.mem.eql(u8, path, "/api/v1/notes")) {
        switch (method) {
            .GET => return respondValue(allocator, request, .ok, .{ .data = store.notes.items }),
            .POST => return createNote(allocator, store, request),
            else => return respondJson(request, .method_not_allowed, "{\\"error\\":\\"method not allowed\\"}"),
        }
    }

    return respondJson(request, .not_found, "{\\"error\\":\\"not found\\"}");
}

fn createNote(allocator: std.mem.Allocator, store: *Store, request: *http.Server.Request) !void {
    const reader = try request.reader();
    const raw = try reader.readAllAlloc(allocator, 64 * 1024);
    defer allocator.free(raw);

    const Input = struct { text: []const u8 };
    const parsed = std.json.parseFromSlice(Input, allocator, raw, .{ .ignore_unknown_fields = true }) catch {
        return respondJson(request, .bad_request, "{\\"error\\":\\"body must be JSON like {\\\\\\"text\\\\\\":\\\\\\"...\\\\\\"}\\"}");
    };
    defer parsed.deinit();

    const text = std.mem.trim(u8, parsed.value.text, " \\t\\r\\n");
    if (text.len == 0 or text.len > 500) {
        return respondJson(request, .bad_request, "{\\"error\\":\\"text is required (max 500 characters)\\"}");
    }

    const note = try store.add(text);
    try respondValue(allocator, request, .created, .{ .data = note });
}

test "queryParam finds a value" {
    try std.testing.expectEqualStrings("zig", queryParam("name=zig&x=1", "name").?);
    try std.testing.expectEqualStrings("1", queryParam("name=zig&x=1", "x").?);
    try std.testing.expect(queryParam("name=zig", "missing") == null);
    try std.testing.expect(queryParam("", "name") == null);
}

test "store assigns increasing ids and owns its text" {
    var store = Store.init(std.testing.allocator);
    defer store.deinit();

    var buffer = [_]u8{ 'h', 'i' };
    const first = try store.add(&buffer);
    buffer[0] = 'x'; // the store copied the text
    const second = try store.add("there");

    try std.testing.expectEqual(@as(u32, 1), first.id);
    try std.testing.expectEqual(@as(u32, 2), second.id);
    try std.testing.expectEqualStrings("hi", store.notes.items[0].text);
    try std.testing.expectEqual(@as(usize, 2), store.notes.items.len);
}
`,

    'Dockerfile': `FROM debian:bookworm-slim AS build

ARG ZIG_VERSION=0.13.0
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \\
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://ziglang.org/download/\${ZIG_VERSION}/zig-linux-x86_64-\${ZIG_VERSION}.tar.xz" \\
    | tar -xJ -C /opt \\
    && ln -s "/opt/zig-linux-x86_64-\${ZIG_VERSION}/zig" /usr/local/bin/zig

WORKDIR /app
COPY . .
RUN zig build -Doptimize=ReleaseSafe

FROM debian:bookworm-slim
COPY --from=build /app/zig-out/bin/{{projectName}} /usr/local/bin/server
ENV PORT=3000
EXPOSE 3000
USER nobody
CMD ["server"]
`,

    'README.md': `# {{projectName}}

A small REST API written against Zig's standard library only (\`std.http.Server\`, \`std.json\`): no dependencies to fetch, no C code to build.

## Requirements

- Zig 0.13.0. The Zig standard library changes between releases, so use this version (or update the sources when you move to a newer one).

## Quick start

\`\`\`bash
zig build run          # PORT defaults to 3000
zig build test         # unit tests
zig build -Doptimize=ReleaseSafe
\`\`\`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | \`/health\` | Liveness probe |
| GET | \`/api/v1/hello?name=zig\` | Greeting |
| GET | \`/api/v1/notes\` | List notes |
| POST | \`/api/v1/notes\` | \`{"text": "..."}\` creates a note (in memory) |

\`\`\`bash
curl -s localhost:3000/api/v1/notes -H 'content-type: application/json' -d '{"text":"remember the milk"}'
curl -s localhost:3000/api/v1/notes
\`\`\`

## How it works

\`src/main.zig\` accepts connections and serves them one at a time; \`src/routes.zig\` holds the router, the handlers and the in-memory store. SIGTERM and SIGINT stop the server immediately with exit status 0. To serve connections concurrently, hand each accepted connection to \`std.Thread.spawn\` and guard the store with a \`std.Thread.Mutex\`.

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

## License

MIT
`
  }
};
