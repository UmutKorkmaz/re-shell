import { BackendTemplate } from '../types';
import { kituraVendorFiles } from './kitura-vendor';

export const kituraTemplate: BackendTemplate = {
  id: 'kitura',
  name: 'kitura',
  displayName: 'Kitura Framework',
  description: 'Swift web framework on SwiftNIO (Kitura 3, no longer actively developed) with routing, middleware and token authentication',
  language: 'swift',
  framework: 'kitura',
  version: '3.0.1',
  tags: ['swift', 'kitura', 'api', 'rest', 'swiftnio', 'docker'],
  port: 8080,
  dependencies: {
    'Kitura': '^3.0.1',
    'HeliumLogger': '^2.0.0',
    'LoggerAPI': '^2.0.0',
    'swift-crypto': '^3.0.0'
  },
  features: ['authentication', 'middleware', 'logging', 'cors', 'rest-api', 'testing', 'docker'],

  files: {
    // Patched Kitura and KituraContracts as local packages (neither compiles with Swift 6 on Linux upstream).
    ...kituraVendorFiles,

    'Package.swift': `// swift-tools-version:5.5
// Kitura 3.0.x is the last Kitura release (October 2022). It runs on SwiftNIO through Kitura-NIO and
// needs OpenSSL 3 and zlib development headers on Linux (libssl-dev, zlib1g-dev).
// Kitura and KituraContracts do not compile with Swift 6 on Linux as released (Foundation turned
// \`.formatted(DateFormatter)\` into a static function, so the \`case .formatted(let x)\` patterns fail), so
// patched copies live in Vendor/ and are used by path. See Vendor/Kitura/Package.swift.
import PackageDescription

let package = Package(
    name: "{{projectName}}",
    platforms: [.macOS(.v10_15)],
    products: [
        .executable(name: "{{projectName}}", targets: ["Run"])
    ],
    dependencies: [
        .package(path: "Vendor/Kitura"),
        .package(url: "https://github.com/Kitura/HeliumLogger.git", from: "2.0.0"),
        .package(url: "https://github.com/Kitura/LoggerAPI.git", from: "2.0.0"),
        .package(url: "https://github.com/apple/swift-crypto.git", "3.0.0"..<"5.0.0"),
    ],
    targets: [
        .target(
            name: "App",
            dependencies: [
                .product(name: "Kitura", package: "Kitura"),
                .product(name: "LoggerAPI", package: "LoggerAPI"),
                .product(name: "Crypto", package: "swift-crypto"),
            ]
        ),
        .executableTarget(
            name: "Run",
            dependencies: [
                "App",
                .product(name: "Kitura", package: "Kitura"),
                .product(name: "HeliumLogger", package: "HeliumLogger"),
                .product(name: "LoggerAPI", package: "LoggerAPI"),
            ]
        ),
        .testTarget(
            name: "AppTests",
            dependencies: ["App"]
        ),
    ]
)`,

    '.env.example': `# Port to bind
PORT={{PORT}}

# Value of the Access-Control-Allow-Origin header
CORS_ORIGIN=*`,

    '.gitignore': `.DS_Store
/.build
/.swiftpm
/Packages
*.xcodeproj
xcuserdata/
DerivedData/
Package.resolved

# Environment
.env
.env.local

# IDE
.vscode/
.idea/`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "{{PORT}}:{{PORT}}"
    environment:
      PORT: "{{PORT}}"
      CORS_ORIGIN: "*"
    restart: unless-stopped`,

    'Dockerfile': `# ================================
# Build image
# ================================
FROM swift:6.2-noble AS build

RUN apt-get update \\
    && apt-get install -y --no-install-recommends libssl-dev zlib1g-dev \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY Package.swift ./
COPY Vendor ./Vendor
COPY Sources ./Sources
COPY Tests ./Tests

RUN swift build -c release

# ================================
# Run image
# ================================
FROM swift:6.2-noble-slim

RUN apt-get update \\
    && apt-get install -y --no-install-recommends libssl3 zlib1g ca-certificates \\
    && rm -rf /var/lib/apt/lists/* \\
    && useradd --system --create-home --uid 1001 app

WORKDIR /app
COPY --from=build /build/.build/release/{{projectName}} /app/{{projectName}}

USER app
ENV PORT={{PORT}}
EXPOSE {{PORT}}

ENTRYPOINT ["/app/{{projectName}}"]`,

    'README.md': `# {{projectName}}

A small server-side Swift API built with [Kitura](https://github.com/Kitura/Kitura) 3.

> Kitura is no longer actively developed: the last release (3.0.1) dates from October 2022. It still runs on
> current Swift toolchains through Kitura-NIO and SwiftNIO, but for new long-lived services consider
> [Hummingbird](https://github.com/hummingbird-project/hummingbird) or Vapor, which have templates in Re-Shell too.
>
> Kitura and KituraContracts as released do not compile with Swift 6 on Linux (Foundation made
> \`.formatted(DateFormatter)\` a static function, so \`case .formatted(let formatter)\` patterns are rejected).
> Patched copies of both packages live in \`Vendor/\` and \`Package.swift\` depends on them by path. The changes are
> confined to the date-strategy switches that match \`.formatted\` (now guarded with \`#if canImport(Darwin)\`), and
> each patched file starts with a notice saying so. Their tests and default welcome page resources are not included.

## What is included

- Kitura routing with path parameters
- Middleware for request logging, CORS and bearer-token authentication
- Registration and login: passwords hashed with PBKDF2-HMAC-SHA256 (swift-crypto), random opaque bearer tokens
- A token-protected todo API (create, list, read, update, delete)
- HeliumLogger console logging
- XCTest unit tests for the stores and the password hasher

Users, todos and sessions live in memory (\`Sources/App/Stores.swift\`), so they are lost on restart. Replace the
stores with a database before production use.

## Requirements

- Swift 6.2 or newer
- macOS 10.15+ or Linux
- Linux packages: \`libssl-dev\` (OpenSSL 3) and \`zlib1g-dev\`

## Run

\`\`\`bash
swift run {{projectName}}
\`\`\`

The server listens on \`http://localhost:{{PORT}}\`.

| Variable      | Default | Meaning                              |
| ------------- | ------- | ------------------------------------ |
| \`PORT\`        | \`{{PORT}}\`  | Port to bind                         |
| \`CORS_ORIGIN\` | \`*\`     | Value of \`Access-Control-Allow-Origin\` |

## API

| Method | Path                 | Auth   | Description                  |
| ------ | -------------------- | ------ | ---------------------------- |
| GET    | \`/\`                  | no     | Service information          |
| GET    | \`/health\`            | no     | Health check                 |
| POST   | \`/api/auth/register\` | no     | \`{ "username", "password" }\` |
| POST   | \`/api/auth/login\`    | no     | Returns \`{ "token" }\`        |
| POST   | \`/api/auth/logout\`   | bearer | Revokes the token sent (204) |
| GET    | \`/api/todos\`         | bearer | \`{ "todos": [...] }\`         |
| POST   | \`/api/todos\`         | bearer | \`{ "title" }\`                |
| GET    | \`/api/todos/:id\`     | bearer | Read one todo                |
| PATCH  | \`/api/todos/:id\`     | bearer | \`{ "title"?, "completed"? }\` |
| DELETE | \`/api/todos/:id\`     | bearer | Delete a todo                |

\`\`\`bash
curl -X POST localhost:{{PORT}}/api/auth/register -H 'content-type: application/json' \\
  -d '{"username":"alice","password":"correct horse battery"}'
TOKEN=$(curl -s -X POST localhost:{{PORT}}/api/auth/login -H 'content-type: application/json' \\
  -d '{"username":"alice","password":"correct horse battery"}' | sed 's/.*"token":"\\([^"]*\\)".*/\\1/')
curl -X POST localhost:{{PORT}}/api/todos -H "authorization: Bearer $TOKEN" \\
  -H 'content-type: application/json' -d '{"title":"Write more tests"}'
\`\`\`

## Test

\`\`\`bash
swift test
\`\`\`

## Docker

\`\`\`bash
docker compose up --build
\`\`\``,

    'Sources/App/Helpers.swift': `import Foundation
import Kitura

extension RouterResponse {
    /// Send \`value\` as a JSON body with the given status code.
    func json<T: Encodable>(_ value: T, status: HTTPStatusCode = .OK) {
        do {
            let data = try JSONEncoder().encode(value)
            self.statusCode = status
            self.headers["Content-Type"] = "application/json; charset=utf-8"
            _ = self.send(data: data)
        } catch {
            self.statusCode = .internalServerError
            _ = self.send("Could not encode the response")
        }
    }

    /// Send \`{ "error": message }\` with the given status code.
    func fail(_ status: HTTPStatusCode, _ message: String) {
        json(ErrorResponse(error: message), status: status)
    }
}

extension RouterRequest {
    /// Decode the JSON request body, or nil when it is missing or malformed.
    func decodeJSON<T: Decodable>(_ type: T.Type) -> T? {
        var data = Data()
        guard (try? self.read(into: &data)) != nil, !data.isEmpty else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    /// The token from an \`Authorization: Bearer <token>\` header.
    var bearerToken: String? {
        let prefix = "Bearer "
        guard let header = self.headers["Authorization"], header.hasPrefix(prefix) else { return nil }
        return String(header.dropFirst(prefix.count))
    }

    /// The user stored by \`BearerAuthMiddleware\`.
    var authenticatedUserID: UUID? {
        guard let value = self.userInfo["userID"] as? String else { return nil }
        return UUID(uuidString: value)
    }
}`,

    'Sources/App/Middleware.swift': `import Foundation
import Kitura
import LoggerAPI

/// Logs every request.
final class RequestLogger: RouterMiddleware {
    func handle(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        Log.info("\\(request.method) \\(request.originalURL)")
        next()
    }
}

/// Adds CORS headers and answers pre-flight (OPTIONS) requests.
final class CORSMiddleware: RouterMiddleware {
    private let allowedOrigin: String

    init(allowedOrigin: String) {
        self.allowedOrigin = allowedOrigin
    }

    func handle(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        response.headers["Access-Control-Allow-Origin"] = allowedOrigin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Accept, Authorization, Content-Type, Origin"
        if request.method == .options {
            response.statusCode = .noContent
            try response.end()
            return
        }
        next()
    }
}

/// Rejects requests without a valid \`Authorization: Bearer <token>\` header and stores the user's id and
/// name in \`request.userInfo\` for the handlers that run afterwards.
final class BearerAuthMiddleware: RouterMiddleware {
    private let sessions: SessionStore

    init(sessions: SessionStore) {
        self.sessions = sessions
    }

    func handle(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let token = request.bearerToken, let session = sessions.lookup(token: token) else {
            response.fail(.unauthorized, "Authentication required")
            try response.end()
            return
        }
        request.userInfo["userID"] = session.userID.uuidString
        request.userInfo["username"] = session.username
        next()
    }
}`,

    'Sources/App/Models.swift': `import Foundation

// MARK: - Todos

struct Todo: Codable, Equatable {
    var id: UUID
    var title: String
    var completed: Bool
}

struct CreateTodoRequest: Codable {
    var title: String
}

struct UpdateTodoRequest: Codable {
    var title: String?
    var completed: Bool?
}

/// A list is wrapped in an object so the JSON response stays extensible.
struct TodoListResponse: Codable {
    var todos: [Todo]
}

// MARK: - Users and auth

struct User {
    let id: UUID
    let username: String
    let passwordHash: String
}

struct Credentials: Codable {
    var username: String
    var password: String
}

struct UserResponse: Codable {
    var id: UUID
    var username: String
}

struct TokenResponse: Codable {
    var token: String
}

// MARK: - Misc responses

struct InfoResponse: Codable {
    var name: String
    var framework: String
    var status: String
}

struct HealthResponse: Codable {
    var status: String
}

struct ErrorResponse: Codable {
    var error: String
}`,

    'Sources/App/PasswordHasher.swift': `import Crypto
import Foundation

/// Random bytes from the system's cryptographically secure generator.
enum SecureRandom {
    static func bytes(count: Int) -> [UInt8] {
        var generator = SystemRandomNumberGenerator()
        return (0..<count).map { _ in UInt8.random(in: UInt8.min...UInt8.max, using: &generator) }
    }

    static func hexString(byteCount: Int) -> String {
        Hex.encode(bytes(count: byteCount))
    }
}

enum Hex {
    static func encode(_ bytes: [UInt8]) -> String {
        bytes.map { String(format: "%02x", $0) }.joined()
    }

    static func decode(_ string: String) -> [UInt8]? {
        guard string.count % 2 == 0 else { return nil }
        var result: [UInt8] = []
        var index = string.startIndex
        while index < string.endIndex {
            let next = string.index(index, offsetBy: 2)
            guard let byte = UInt8(string[index..<next], radix: 16) else { return nil }
            result.append(byte)
            index = next
        }
        return result
    }
}

/// Password hashing with PBKDF2-HMAC-SHA256 (RFC 8018), the algorithm OWASP recommends when bcrypt,
/// scrypt and Argon2 are not available. Hashes look like \`pbkdf2-sha256$<iterations>$<salt>$<key>\`.
enum PasswordHasher {
    /// OWASP's 2023 minimum for PBKDF2-HMAC-SHA256 is 600,000 iterations; 210,000 keeps request latency
    /// moderate. Raise it when you can afford the CPU time. The count is stored in every hash.
    static let defaultIterations = 210_000

    static func hash(_ password: String, iterations: Int = defaultIterations) -> String {
        let salt = SecureRandom.bytes(count: 16)
        let key = pbkdf2(password: Array(password.utf8), salt: salt, iterations: iterations)
        return "pbkdf2-sha256$\\(iterations)$\\(Hex.encode(salt))$\\(Hex.encode(key))"
    }

    static func verify(_ password: String, hash: String) -> Bool {
        let parts = hash.split(separator: "$").map(String.init)
        guard parts.count == 4,
              parts[0] == "pbkdf2-sha256",
              let iterations = Int(parts[1]), iterations > 0,
              let salt = Hex.decode(parts[2]),
              let expected = Hex.decode(parts[3])
        else {
            return false
        }
        let actual = pbkdf2(password: Array(password.utf8), salt: salt, iterations: iterations)
        return constantTimeEqual(actual, expected)
    }

    /// PBKDF2 with a single 32-byte output block (the size of the SHA-256 digest).
    static func pbkdf2(password: [UInt8], salt: [UInt8], iterations: Int) -> [UInt8] {
        let key = SymmetricKey(data: password)
        var block = Array(HMAC<SHA256>.authenticationCode(for: salt + [0, 0, 0, 1], using: key))
        var result = block
        if iterations > 1 {
            for _ in 1..<iterations {
                block = Array(HMAC<SHA256>.authenticationCode(for: block, using: key))
                for index in 0..<result.count {
                    result[index] ^= block[index]
                }
            }
        }
        return result
    }

    private static func constantTimeEqual(_ lhs: [UInt8], _ rhs: [UInt8]) -> Bool {
        guard lhs.count == rhs.count else { return false }
        var difference: UInt8 = 0
        for index in 0..<lhs.count {
            difference |= lhs[index] ^ rhs[index]
        }
        return difference == 0
    }
}`,

    'Sources/App/Routes.swift': `import Dispatch
import Foundation
import Kitura
import LoggerAPI

/// Build the application's router. \`Run/main.swift\` serves it with \`Kitura.addHTTPServer\`.
public func makeRouter(allowedOrigin: String = "*") -> Router {
    buildRouter(
        users: UserStore(),
        todos: TodoStore(),
        sessions: SessionStore(),
        allowedOrigin: allowedOrigin
    )
}

func buildRouter(users: UserStore, todos: TodoStore, sessions: SessionStore, allowedOrigin: String) -> Router {
    let router = Router(enableWelcomePage: false)

    // Middleware for every route
    router.all(middleware: RequestLogger())
    router.all(middleware: CORSMiddleware(allowedOrigin: allowedOrigin))

    // Public routes
    router.get("/") { (_: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        response.json(InfoResponse(name: "{{projectName}}", framework: "Kitura 3", status: "running"))
        next()
    }
    router.get("/health") { (_: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        response.json(HealthResponse(status: "ok"))
        next()
    }

    // Authentication
    router.post("/api/auth/register") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        guard let credentials = request.decodeJSON(Credentials.self) else {
            response.fail(.badRequest, "Expected a JSON body with username and password")
            return next()
        }
        let username = credentials.username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard username.count >= 3 else {
            response.fail(.badRequest, "username must be at least 3 characters")
            return next()
        }
        guard credentials.password.count >= 8 else {
            response.fail(.badRequest, "password must be at least 8 characters")
            return next()
        }
        let password = credentials.password
        // Hashing is CPU-bound: keep it off the event loop.
        DispatchQueue.global(qos: .userInitiated).async {
            let hash = PasswordHasher.hash(password)
            if let user = users.create(username: username, passwordHash: hash) {
                response.json(UserResponse(id: user.id, username: user.username), status: .created)
            } else {
                response.fail(.conflict, "username is already taken")
            }
            next()
        }
    }

    router.post("/api/auth/login") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        guard let credentials = request.decodeJSON(Credentials.self) else {
            response.fail(.badRequest, "Expected a JSON body with username and password")
            return next()
        }
        let username = credentials.username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let password = credentials.password
        DispatchQueue.global(qos: .userInitiated).async {
            guard let user = users.find(username: username),
                  PasswordHasher.verify(password, hash: user.passwordHash)
            else {
                response.fail(.unauthorized, "invalid username or password")
                return next()
            }
            let token = sessions.create(userID: user.id, username: user.username)
            response.json(TokenResponse(token: token))
            next()
        }
    }

    router.post("/api/auth/logout") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        if let token = request.bearerToken {
            sessions.revoke(token: token)
        }
        response.statusCode = .noContent
        next()
    }

    // Everything below /api/todos requires a bearer token
    router.all("/api/todos", middleware: BearerAuthMiddleware(sessions: sessions))

    router.get("/api/todos") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        guard let owner = request.authenticatedUserID else {
            response.fail(.unauthorized, "Authentication required")
            return next()
        }
        response.json(TodoListResponse(todos: todos.list(owner: owner)))
        next()
    }

    router.post("/api/todos") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        guard let owner = request.authenticatedUserID else {
            response.fail(.unauthorized, "Authentication required")
            return next()
        }
        guard let body = request.decodeJSON(CreateTodoRequest.self) else {
            response.fail(.badRequest, "Expected a JSON body with a title")
            return next()
        }
        let title = body.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            response.fail(.badRequest, "title must not be empty")
            return next()
        }
        response.json(todos.create(owner: owner, title: title), status: .created)
        next()
    }

    router.get("/api/todos/:id") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        guard let owner = request.authenticatedUserID else {
            response.fail(.unauthorized, "Authentication required")
            return next()
        }
        guard let id = request.parameters["id"].flatMap({ UUID(uuidString: $0) }),
              let todo = todos.get(owner: owner, id: id)
        else {
            response.fail(.notFound, "todo not found")
            return next()
        }
        response.json(todo)
        next()
    }

    router.patch("/api/todos/:id") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        guard let owner = request.authenticatedUserID else {
            response.fail(.unauthorized, "Authentication required")
            return next()
        }
        guard let id = request.parameters["id"].flatMap({ UUID(uuidString: $0) }) else {
            response.fail(.notFound, "todo not found")
            return next()
        }
        guard let body = request.decodeJSON(UpdateTodoRequest.self) else {
            response.fail(.badRequest, "Expected a JSON body")
            return next()
        }
        if let title = body.title, title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            response.fail(.badRequest, "title must not be empty")
            return next()
        }
        guard let todo = todos.update(owner: owner, id: id, title: body.title, completed: body.completed) else {
            response.fail(.notFound, "todo not found")
            return next()
        }
        response.json(todo)
        next()
    }

    router.delete("/api/todos/:id") { (request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) in
        guard let owner = request.authenticatedUserID else {
            response.fail(.unauthorized, "Authentication required")
            return next()
        }
        guard let id = request.parameters["id"].flatMap({ UUID(uuidString: $0) }),
              todos.delete(owner: owner, id: id)
        else {
            response.fail(.notFound, "todo not found")
            return next()
        }
        response.statusCode = .noContent
        next()
    }

    return router
}`,

    'Sources/App/Stores.swift': `import Foundation

// Kitura handlers run on several event loops, so every store guards its state with a lock.
// The stores keep everything in memory: replace them with a database before production use.

final class UserStore {
    private var usersByName: [String: User] = [:]
    private let lock = NSLock()

    /// Returns nil when the username is already taken.
    func create(username: String, passwordHash: String) -> User? {
        lock.lock()
        defer { lock.unlock() }
        guard usersByName[username] == nil else { return nil }
        let user = User(id: UUID(), username: username, passwordHash: passwordHash)
        usersByName[username] = user
        return user
    }

    func find(username: String) -> User? {
        lock.lock()
        defer { lock.unlock() }
        return usersByName[username]
    }
}

final class TodoStore {
    private var todosByOwner: [UUID: [Todo]] = [:]
    private let lock = NSLock()

    func list(owner: UUID) -> [Todo] {
        lock.lock()
        defer { lock.unlock() }
        return todosByOwner[owner] ?? []
    }

    func create(owner: UUID, title: String) -> Todo {
        lock.lock()
        defer { lock.unlock() }
        let todo = Todo(id: UUID(), title: title, completed: false)
        todosByOwner[owner, default: []].append(todo)
        return todo
    }

    func get(owner: UUID, id: UUID) -> Todo? {
        lock.lock()
        defer { lock.unlock() }
        return todosByOwner[owner]?.first { $0.id == id }
    }

    func update(owner: UUID, id: UUID, title: String?, completed: Bool?) -> Todo? {
        lock.lock()
        defer { lock.unlock() }
        guard var todos = todosByOwner[owner], let index = todos.firstIndex(where: { $0.id == id }) else {
            return nil
        }
        if let title = title {
            todos[index].title = title
        }
        if let completed = completed {
            todos[index].completed = completed
        }
        todosByOwner[owner] = todos
        return todos[index]
    }

    func delete(owner: UUID, id: UUID) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard var todos = todosByOwner[owner], let index = todos.firstIndex(where: { $0.id == id }) else {
            return false
        }
        todos.remove(at: index)
        todosByOwner[owner] = todos
        return true
    }
}

/// Opaque bearer tokens kept in memory. They are random, so they carry no information themselves.
final class SessionStore {
    struct Session {
        let userID: UUID
        let username: String
        let expiresAt: Date
    }

    private var sessions: [String: Session] = [:]
    private let lock = NSLock()
    private let lifetime: TimeInterval

    /// - Parameter lifetime: seconds a token stays valid (12 hours by default).
    init(lifetime: TimeInterval = 12 * 60 * 60) {
        self.lifetime = lifetime
    }

    func create(userID: UUID, username: String) -> String {
        let token = SecureRandom.hexString(byteCount: 32)
        lock.lock()
        defer { lock.unlock() }
        sessions[token] = Session(userID: userID, username: username, expiresAt: Date().addingTimeInterval(lifetime))
        return token
    }

    /// Returns the session for a token, or nil when the token is unknown or expired.
    func lookup(token: String) -> Session? {
        lock.lock()
        defer { lock.unlock() }
        guard let session = sessions[token] else { return nil }
        if session.expiresAt <= Date() {
            sessions.removeValue(forKey: token)
            return nil
        }
        return session
    }

    func revoke(token: String) {
        lock.lock()
        defer { lock.unlock() }
        sessions.removeValue(forKey: token)
    }
}`,

    'Sources/Run/main.swift': `import App
import Foundation
import HeliumLogger
import Kitura
import LoggerAPI

// Configuration comes from the environment (see \`.env.example\`): PORT and CORS_ORIGIN.
HeliumLogger.use()

let environment = ProcessInfo.processInfo.environment
let port = Int(environment["PORT"] ?? "") ?? {{PORT}}
let router = makeRouter(allowedOrigin: environment["CORS_ORIGIN"] ?? "*")

Kitura.addHTTPServer(onPort: port, with: router)
Log.info("{{projectName}} listening on port \\(port)")
Kitura.run()`,

    'Tests/AppTests/AppTests.swift': `import XCTest
@testable import App

final class AppTests: XCTestCase {
    func testPBKDF2MatchesPublishedVectors() {
        // PBKDF2-HMAC-SHA256, password "password", salt "salt", 32 byte key
        let password = Array("password".utf8)
        let salt = Array("salt".utf8)
        XCTAssertEqual(
            Hex.encode(PasswordHasher.pbkdf2(password: password, salt: salt, iterations: 1)),
            "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b"
        )
        XCTAssertEqual(
            Hex.encode(PasswordHasher.pbkdf2(password: password, salt: salt, iterations: 2)),
            "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43"
        )
        XCTAssertEqual(
            Hex.encode(PasswordHasher.pbkdf2(password: password, salt: salt, iterations: 4096)),
            "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a"
        )
    }

    func testPasswordHashRoundTrip() {
        let hash = PasswordHasher.hash("correct horse battery", iterations: 1_000)
        XCTAssertTrue(hash.hasPrefix("pbkdf2-sha256$1000$"))
        XCTAssertTrue(PasswordHasher.verify("correct horse battery", hash: hash))
        XCTAssertFalse(PasswordHasher.verify("wrong password", hash: hash))
        XCTAssertFalse(PasswordHasher.verify("anything", hash: "not a hash"))
    }

    func testHexRoundTrip() {
        let bytes: [UInt8] = [0, 1, 15, 16, 254, 255]
        XCTAssertEqual(Hex.encode(bytes), "00010f10feff")
        XCTAssertEqual(Hex.decode("00010f10feff"), bytes)
        XCTAssertNil(Hex.decode("abc"))
    }

    func testUserStoreRejectsDuplicates() {
        let users = UserStore()
        XCTAssertNotNil(users.create(username: "alice", passwordHash: "hash"))
        XCTAssertNil(users.create(username: "alice", passwordHash: "other"))
        XCTAssertEqual(users.find(username: "alice")?.passwordHash, "hash")
        XCTAssertNil(users.find(username: "bob"))
    }

    func testTodoStoreLifecycle() throws {
        let store = TodoStore()
        let alice = UUID()
        let bob = UUID()

        let todo = store.create(owner: alice, title: "Write tests")
        XCTAssertFalse(todo.completed)
        XCTAssertEqual(store.list(owner: alice), [todo])
        XCTAssertTrue(store.list(owner: bob).isEmpty)
        XCTAssertNil(store.get(owner: bob, id: todo.id))

        let updated = try XCTUnwrap(store.update(owner: alice, id: todo.id, title: nil, completed: true))
        XCTAssertTrue(updated.completed)
        XCTAssertEqual(updated.title, "Write tests")

        XCTAssertFalse(store.delete(owner: bob, id: todo.id))
        XCTAssertTrue(store.delete(owner: alice, id: todo.id))
        XCTAssertNil(store.get(owner: alice, id: todo.id))
    }

    func testSessionStoreTokens() throws {
        let sessions = SessionStore()
        let userID = UUID()
        let token = sessions.create(userID: userID, username: "alice")
        XCTAssertEqual(token.count, 64)
        XCTAssertEqual(sessions.lookup(token: token)?.userID, userID)
        sessions.revoke(token: token)
        XCTAssertNil(sessions.lookup(token: token))

        let expired = SessionStore(lifetime: -1)
        let expiredToken = expired.create(userID: userID, username: "alice")
        XCTAssertNil(expired.lookup(token: expiredToken))
    }

    func testRouterBuilds() {
        _ = makeRouter()
    }
}`
  }
};
