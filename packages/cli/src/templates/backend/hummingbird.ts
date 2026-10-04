import { BackendTemplate } from '../types';

export const hummingbirdTemplate: BackendTemplate = {
  id: 'hummingbird',
  name: 'hummingbird',
  displayName: 'Hummingbird Framework',
  description: 'Lightweight, flexible server-side Swift framework built on SwiftNIO (Hummingbird 2) with JWT authentication, WebSockets and response compression',
  language: 'swift',
  framework: 'hummingbird',
  version: '2.27.0',
  tags: ['swift', 'hummingbird', 'api', 'rest', 'swiftnio', 'lightweight', 'jwt', 'websocket'],
  port: 8080,
  dependencies: {
    'hummingbird': '^2.19.0',
    'hummingbird-auth': '^2.0.0',
    'hummingbird-compression': '^2.0.0',
    'hummingbird-websocket': '^2.5.0',
    'jwt-kit': '^5.0.0'
  },
  features: ['authentication', 'middleware', 'logging', 'cors', 'compression', 'websockets', 'rest-api', 'testing', 'docker'],

  files: {
    'Package.swift': `// swift-tools-version:5.10
// Hummingbird 2 needs a Swift 6.2 (or newer) toolchain; the manifest itself stays at
// tools-version 5.10 so the app compiles in the Swift 5 language mode.
import PackageDescription

let package = Package(
    name: "{{projectName}}",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "{{projectName}}", targets: ["App"])
    ],
    dependencies: [
        .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "2.19.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-auth.git", from: "2.0.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-compression.git", from: "2.0.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-websocket.git", from: "2.5.0"),
        .package(url: "https://github.com/vapor/jwt-kit.git", from: "5.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                .product(name: "Hummingbird", package: "hummingbird"),
                .product(name: "HummingbirdBcrypt", package: "hummingbird-auth"),
                .product(name: "HummingbirdCompression", package: "hummingbird-compression"),
                .product(name: "HummingbirdWebSocket", package: "hummingbird-websocket"),
                .product(name: "JWTKit", package: "jwt-kit"),
            ]
        ),
        .testTarget(
            name: "AppTests",
            dependencies: [
                .byName(name: "App"),
                .product(name: "HummingbirdTesting", package: "hummingbird"),
                .product(name: "HummingbirdWSTesting", package: "hummingbird-websocket"),
            ]
        ),
    ]
)`,

    '.env.example': `# Interface and port to bind
HOST=0.0.0.0
PORT={{PORT}}

# trace, debug, info, notice, warning, error
LOG_LEVEL=info

# HMAC secret used to sign access tokens. Use a long random value.
# When unset, a random secret is generated on every start.
JWT_SECRET=change-me`,

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
      HOST: 0.0.0.0
      PORT: "{{PORT}}"
      LOG_LEVEL: info
      JWT_SECRET: \${JWT_SECRET:-change-me}
    restart: unless-stopped`,

    'Dockerfile': `# ================================
# Build image
# ================================
FROM swift:6.2-noble AS build

WORKDIR /build
COPY Package.swift ./
COPY Sources ./Sources
COPY Tests ./Tests

RUN swift build -c release --static-swift-stdlib

# ================================
# Run image
# ================================
FROM ubuntu:24.04

RUN apt-get update \\
    && apt-get install -y --no-install-recommends ca-certificates tzdata \\
    && rm -rf /var/lib/apt/lists/* \\
    && useradd --system --create-home --uid 1001 app

WORKDIR /app
COPY --from=build /build/.build/release/{{projectName}} /app/{{projectName}}

USER app
ENV HOST=0.0.0.0 PORT={{PORT}}
EXPOSE {{PORT}}

ENTRYPOINT ["/app/{{projectName}}"]`,

    'README.md': `# {{projectName}}

A small server-side Swift API built with [Hummingbird 2](https://github.com/hummingbird-project/hummingbird).

## What is included

- Routing with route groups and typed request contexts
- Registration and login: passwords hashed with bcrypt (\`HummingbirdBcrypt\`), access tokens are HS256 JWTs (\`JWTKit\`)
- A bearer-token protected todo API (create, list, read, update, delete)
- Request logging, CORS and response compression middleware
- A WebSocket echo endpoint (\`HummingbirdWebSocket\`)
- XCTest tests that run the app in-process (\`HummingbirdTesting\`)

Users and todos live in memory (see \`Sources/App/Models/Stores.swift\`), so they are lost on restart. Replace the
two store actors with a database (for example PostgresNIO or Fluent) before putting this into production.

## Requirements

- Swift 6.2 or newer (the current Hummingbird 2 releases require it)
- macOS 14+ or Linux (Ubuntu 24.04 is used in CI)

## Run

\`\`\`bash
cp .env.example .env   # optional, export the variables in your shell
export JWT_SECRET="a-long-random-string"
swift run {{projectName}}
\`\`\`

The server listens on \`http://0.0.0.0:{{PORT}}\` by default.

| Variable     | Default   | Meaning                                                      |
| ------------ | --------- | ------------------------------------------------------------ |
| \`HOST\`       | \`0.0.0.0\` | Interface to bind                                            |
| \`PORT\`       | \`{{PORT}}\`    | Port to bind                                                 |
| \`LOG_LEVEL\`  | \`info\`    | \`trace\`, \`debug\`, \`info\`, \`notice\`, \`warning\`, \`error\`       |
| \`JWT_SECRET\` | random    | HMAC secret for tokens (a random one is used if it is unset) |

## API

| Method | Path                | Auth   | Description                      |
| ------ | ------------------- | ------ | -------------------------------- |
| GET    | \`/\`                 | no     | Service information              |
| GET    | \`/health\`           | no     | Health check                     |
| POST   | \`/api/auth/register\`| no     | \`{ "username", "password" }\`     |
| POST   | \`/api/auth/login\`   | no     | Returns \`{ "token" }\`            |
| GET    | \`/api/todos\`        | bearer | List your todos                  |
| POST   | \`/api/todos\`        | bearer | \`{ "title" }\`                    |
| GET    | \`/api/todos/:id\`    | bearer | Read one todo                    |
| PATCH  | \`/api/todos/:id\`    | bearer | \`{ "title"?, "completed"? }\`     |
| DELETE | \`/api/todos/:id\`    | bearer | Delete a todo                    |
| WS     | \`/echo\`             | no     | Echoes every text/binary message |

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

    'Sources/App/App.swift': `import Foundation
import Hummingbird
import Logging

/// Entry point. Configuration comes from the environment (see \`.env.example\`):
/// HOST, PORT, LOG_LEVEL and JWT_SECRET.
@main
struct AppMain {
    static func main() async throws {
        let env = ProcessInfo.processInfo.environment

        let logger = Logger(label: "{{projectName}}")
        let jwtSecret: String
        if let secret = env["JWT_SECRET"], !secret.isEmpty {
            jwtSecret = secret
        } else {
            // No secret configured: use a random one. Tokens stop working on restart.
            jwtSecret = UUID().uuidString + UUID().uuidString
            logger.warning("JWT_SECRET is not set; using a random secret that is lost on restart")
        }

        let config = AppConfig(
            hostname: env["HOST"] ?? "0.0.0.0",
            port: Int(env["PORT"] ?? "") ?? {{PORT}},
            jwtSecret: jwtSecret,
            logLevel: Logger.Level(rawValue: env["LOG_LEVEL"] ?? "info") ?? .info
        )

        let app = try await buildApplication(config)
        try await app.runService()
    }
}`,

    'Sources/App/Application+build.swift': `import Foundation
import Hummingbird
import HummingbirdCompression
import HummingbirdWebSocket
import Logging

/// Settings the application is built from. Tests build the app with their own values.
struct AppConfig: Sendable {
    var hostname: String = "0.0.0.0"
    var port: Int = {{PORT}}
    var jwtSecret: String
    var logLevel: Logger.Level = .info
}

/// Build the HTTP + WebSocket application. Used by the executable and by the tests.
func buildApplication(_ config: AppConfig) async throws -> some ApplicationProtocol {
    var logger = Logger(label: "{{projectName}}")
    logger.logLevel = config.logLevel

    let users = UserStore()
    let todos = TodoStore()
    let tokens = await TokenService.make(secret: config.jwtSecret)

    let router = buildRouter(users: users, todos: todos, tokens: tokens)
    let wsRouter = buildWebSocketRouter()

    return Application(
        router: router,
        server: .http1WebSocketUpgrade(webSocketRouter: wsRouter),
        configuration: .init(
            address: .hostname(config.hostname, port: config.port),
            serverName: "{{projectName}}"
        ),
        logger: logger
    )
}

/// HTTP routes: health, registration/login and the authenticated todo API.
func buildRouter(users: UserStore, todos: TodoStore, tokens: TokenService) -> Router<AppRequestContext> {
    let router = Router(context: AppRequestContext.self)

    // Middleware
    router.add(middleware: LogRequestsMiddleware(.info))
    router.add(
        middleware: CORSMiddleware(
            allowOrigin: .originBased,
            allowHeaders: [.accept, .authorization, .contentType, .origin],
            allowMethods: [.get, .post, .patch, .delete, .options]
        )
    )
    router.add(middleware: ResponseCompressionMiddleware())

    // Public routes
    router.get("/") { _, _ -> InfoResponse in
        InfoResponse(name: "{{projectName}}", framework: "Hummingbird 2", status: "running")
    }
    router.get("health") { _, _ -> HealthResponse in
        HealthResponse(status: "ok")
    }

    // /api/auth/register and /api/auth/login
    AuthController(users: users, tokens: tokens).addRoutes(to: router.group("api/auth"))

    // /api/todos (bearer token required)
    TodoController(todos: todos).addRoutes(
        to: router.group("api/todos").add(middleware: BearerAuthMiddleware(tokens: tokens))
    )

    return router
}

/// WebSocket routes: \`ws://host:port/echo\` sends every message back.
func buildWebSocketRouter() -> Router<BasicWebSocketRequestContext> {
    let wsRouter = Router(context: BasicWebSocketRequestContext.self)
    wsRouter.add(middleware: LogRequestsMiddleware(.debug))
    wsRouter.ws("echo") { _, _ in
        .upgrade([:])
    } onUpgrade: { inbound, outbound, _ in
        for try await message in inbound.messages(maxSize: 1 << 16) {
            switch message {
            case .text(let text):
                try await outbound.write(.text(text))
            case .binary(let buffer):
                try await outbound.write(.binary(buffer))
            default:
                break
            }
        }
    }
    return wsRouter
}`,

    'Sources/App/Auth/BearerAuthMiddleware.swift': `import Foundation
import Hummingbird

/// Rejects requests without a valid \`Authorization: Bearer <jwt>\` header and stores the
/// token's user in the request context.
struct BearerAuthMiddleware: RouterMiddleware {
    typealias Context = AppRequestContext

    let tokens: TokenService

    func handle(
        _ request: Request,
        context: AppRequestContext,
        next: (Request, AppRequestContext) async throws -> Response
    ) async throws -> Response {
        let prefix = "Bearer "
        guard let header = request.headers[.authorization], header.hasPrefix(prefix) else {
            throw HTTPError(.unauthorized, message: "Missing bearer token")
        }
        let token = String(header.dropFirst(prefix.count))

        let payload: SessionPayload
        do {
            payload = try await tokens.verify(token)
        } catch {
            throw HTTPError(.unauthorized, message: "Invalid or expired token")
        }
        guard let userID = UUID(uuidString: payload.subject.value) else {
            throw HTTPError(.unauthorized, message: "Invalid token subject")
        }

        var context = context
        context.userID = userID
        context.username = payload.username
        return try await next(request, context)
    }
}`,

    'Sources/App/Auth/TokenService.swift': `import Foundation
import JWTKit

/// Claims carried by the access token.
struct SessionPayload: JWTPayload, Equatable {
    enum CodingKeys: String, CodingKey {
        case subject = "sub"
        case expiration = "exp"
        case username = "name"
    }

    var subject: SubjectClaim
    var expiration: ExpirationClaim
    var username: String

    func verify(using algorithm: some JWTAlgorithm) async throws {
        try self.expiration.verifyNotExpired()
    }
}

/// Signs and verifies HS256 JSON Web Tokens.
struct TokenService: Sendable {
    private let keys: JWTKeyCollection
    private let kid: JWKIdentifier

    private init(keys: JWTKeyCollection, kid: JWKIdentifier) {
        self.keys = keys
        self.kid = kid
    }

    static func make(secret: String) async -> TokenService {
        let kid = JWKIdentifier("{{projectName}}")
        let keys = JWTKeyCollection()
        await keys.add(hmac: HMACKey(from: secret), digestAlgorithm: .sha256, kid: kid)
        return TokenService(keys: keys, kid: kid)
    }

    /// Issue a token that is valid for 12 hours.
    func issue(userID: UUID, username: String) async throws -> String {
        let payload = SessionPayload(
            subject: .init(value: userID.uuidString),
            expiration: .init(value: Date(timeIntervalSinceNow: 12 * 60 * 60)),
            username: username
        )
        return try await keys.sign(payload, kid: kid)
    }

    func verify(_ token: String) async throws -> SessionPayload {
        try await keys.verify(token, as: SessionPayload.self)
    }
}`,

    'Sources/App/Controllers/AuthController.swift': `import Foundation
import Hummingbird
import HummingbirdBcrypt
import NIOPosix

/// Registration and login. Passwords are hashed with bcrypt on the NIO thread pool.
struct AuthController {
    let users: UserStore
    let tokens: TokenService

    func addRoutes(to group: RouterGroup<AppRequestContext>) {
        group.post("register", use: self.register)
        group.post("login", use: self.login)
    }

    @Sendable func register(_ request: Request, context: AppRequestContext) async throws -> EditedResponse<UserResponse> {
        let credentials = try await request.decode(as: Credentials.self, context: context)
        let username = credentials.username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard username.count >= 3 else {
            throw HTTPError(.badRequest, message: "username must be at least 3 characters")
        }
        guard credentials.password.count >= 8 else {
            throw HTTPError(.badRequest, message: "password must be at least 8 characters")
        }

        let password = credentials.password
        let hash = try await NIOThreadPool.singleton.runIfActive { Bcrypt.hash(password, cost: 10) }
        guard let user = await users.create(username: username, passwordHash: hash) else {
            throw HTTPError(.conflict, message: "username is already taken")
        }
        return .init(status: .created, response: UserResponse(id: user.id, username: user.username))
    }

    @Sendable func login(_ request: Request, context: AppRequestContext) async throws -> TokenResponse {
        let credentials = try await request.decode(as: Credentials.self, context: context)
        let username = credentials.username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let user = await users.find(username: username) else {
            throw HTTPError(.unauthorized, message: "invalid username or password")
        }

        let password = credentials.password
        let hash = user.passwordHash
        let valid = try await NIOThreadPool.singleton.runIfActive { Bcrypt.verify(password, hash: hash) }
        guard valid else {
            throw HTTPError(.unauthorized, message: "invalid username or password")
        }
        let token = try await tokens.issue(userID: user.id, username: user.username)
        return TokenResponse(token: token)
    }
}`,

    'Sources/App/Controllers/TodoController.swift': `import Foundation
import Hummingbird

/// CRUD for the authenticated user's todos.
struct TodoController {
    let todos: TodoStore

    func addRoutes(to group: RouterGroup<AppRequestContext>) {
        group
            .get(use: self.list)
            .post(use: self.create)
            .get(":id", use: self.get)
            .patch(":id", use: self.update)
            .delete(":id", use: self.remove)
    }

    @Sendable func list(_ request: Request, context: AppRequestContext) async throws -> [Todo] {
        let owner = try context.requireUserID()
        return await todos.list(owner: owner)
    }

    @Sendable func create(_ request: Request, context: AppRequestContext) async throws -> EditedResponse<Todo> {
        let owner = try context.requireUserID()
        let body = try await request.decode(as: CreateTodoRequest.self, context: context)
        let title = body.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            throw HTTPError(.badRequest, message: "title must not be empty")
        }
        let todo = await todos.create(owner: owner, title: title)
        return .init(status: .created, response: todo)
    }

    @Sendable func get(_ request: Request, context: AppRequestContext) async throws -> Todo {
        let owner = try context.requireUserID()
        let id = try context.parameters.require("id", as: UUID.self)
        guard let todo = await todos.get(owner: owner, id: id) else {
            throw HTTPError(.notFound, message: "todo not found")
        }
        return todo
    }

    @Sendable func update(_ request: Request, context: AppRequestContext) async throws -> Todo {
        let owner = try context.requireUserID()
        let id = try context.parameters.require("id", as: UUID.self)
        let body = try await request.decode(as: UpdateTodoRequest.self, context: context)
        if let title = body.title, title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw HTTPError(.badRequest, message: "title must not be empty")
        }
        guard let todo = await todos.update(owner: owner, id: id, title: body.title, completed: body.completed) else {
            throw HTTPError(.notFound, message: "todo not found")
        }
        return todo
    }

    @Sendable func remove(_ request: Request, context: AppRequestContext) async throws -> HTTPResponse.Status {
        let owner = try context.requireUserID()
        let id = try context.parameters.require("id", as: UUID.self)
        guard await todos.delete(owner: owner, id: id) else {
            throw HTTPError(.notFound, message: "todo not found")
        }
        return .noContent
    }
}`,

    'Sources/App/Models/Models.swift': `import Foundation
import Hummingbird

// MARK: - Todos

struct Todo: ResponseCodable, Equatable, Sendable {
    var id: UUID
    var title: String
    var completed: Bool
}

struct CreateTodoRequest: Codable, Sendable {
    var title: String
}

struct UpdateTodoRequest: Codable, Sendable {
    var title: String?
    var completed: Bool?
}

// MARK: - Users and auth

struct User: Sendable {
    let id: UUID
    let username: String
    let passwordHash: String
}

struct Credentials: Codable, Sendable {
    var username: String
    var password: String
}

struct UserResponse: ResponseCodable, Sendable {
    var id: UUID
    var username: String
}

struct TokenResponse: ResponseCodable, Sendable {
    var token: String
}

// MARK: - Misc responses

struct InfoResponse: ResponseEncodable, Sendable {
    var name: String
    var framework: String
    var status: String
}

struct HealthResponse: ResponseEncodable, Sendable {
    var status: String
}`,

    'Sources/App/Models/Stores.swift': `import Foundation

/// In-memory user storage. Swap for a database (for example PostgresNIO or Fluent) before production use.
actor UserStore {
    private var usersByName: [String: User] = [:]

    /// Returns nil when the username is already taken.
    func create(username: String, passwordHash: String) -> User? {
        guard usersByName[username] == nil else { return nil }
        let user = User(id: UUID(), username: username, passwordHash: passwordHash)
        usersByName[username] = user
        return user
    }

    func find(username: String) -> User? {
        usersByName[username]
    }
}

/// In-memory todo storage, one list per user.
actor TodoStore {
    private var todosByOwner: [UUID: [Todo]] = [:]

    func list(owner: UUID) -> [Todo] {
        todosByOwner[owner] ?? []
    }

    func create(owner: UUID, title: String) -> Todo {
        let todo = Todo(id: UUID(), title: title, completed: false)
        todosByOwner[owner, default: []].append(todo)
        return todo
    }

    func get(owner: UUID, id: UUID) -> Todo? {
        todosByOwner[owner]?.first { $0.id == id }
    }

    func update(owner: UUID, id: UUID, title: String?, completed: Bool?) -> Todo? {
        guard var todos = todosByOwner[owner], let index = todos.firstIndex(where: { $0.id == id }) else {
            return nil
        }
        if let title {
            todos[index].title = title
        }
        if let completed {
            todos[index].completed = completed
        }
        todosByOwner[owner] = todos
        return todos[index]
    }

    func delete(owner: UUID, id: UUID) -> Bool {
        guard var todos = todosByOwner[owner], let index = todos.firstIndex(where: { $0.id == id }) else {
            return false
        }
        todos.remove(at: index)
        todosByOwner[owner] = todos
        return true
    }
}`,

    'Sources/App/RequestContext.swift': `import Foundation
import Hummingbird

/// Request context shared by every route. \`BearerAuthMiddleware\` fills in the user.
struct AppRequestContext: RequestContext {
    var coreContext: CoreRequestContextStorage
    var userID: UUID?
    var username: String?

    init(source: Source) {
        self.coreContext = .init(source: source)
    }

    /// The authenticated user's id, or a 401 when the request is not authenticated.
    func requireUserID() throws -> UUID {
        guard let userID else { throw HTTPError(.unauthorized, message: "Authentication required") }
        return userID
    }
}`,

    'Tests/AppTests/AppTests.swift': `@testable import App
import Foundation
import Hummingbird
import HummingbirdTesting
import HummingbirdWSTesting
import HummingbirdWebSocket
import XCTest

final class AppTests: XCTestCase {
    private func makeConfig() -> AppConfig {
        AppConfig(
            hostname: "127.0.0.1",
            port: 0,
            jwtSecret: "secret-used-by-the-unit-tests-only",
            logLevel: .warning
        )
    }

    private func json<T: Encodable>(_ value: T) throws -> ByteBuffer {
        try JSONEncoder().encodeAsByteBuffer(value, allocator: ByteBufferAllocator())
    }

    func testHealth() async throws {
        let app = try await buildApplication(makeConfig())
        try await app.test(.router) { client in
            try await client.execute(uri: "/health", method: .get) { response in
                XCTAssertEqual(response.status, .ok)
            }
        }
    }

    func testTodosRequireAuthentication() async throws {
        let app = try await buildApplication(makeConfig())
        try await app.test(.router) { client in
            try await client.execute(uri: "/api/todos", method: .get) { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
            try await client.execute(
                uri: "/api/todos",
                method: .get,
                headers: [.authorization: "Bearer not-a-valid-token"]
            ) { response in
                XCTAssertEqual(response.status, .unauthorized)
            }
        }
    }

    func testRegisterRejectsShortPassword() async throws {
        let app = try await buildApplication(makeConfig())
        try await app.test(.router) { client in
            try await client.execute(
                uri: "/api/auth/register",
                method: .post,
                headers: [.contentType: "application/json"],
                body: try self.json(Credentials(username: "alice", password: "short"))
            ) { response in
                XCTAssertEqual(response.status, .badRequest)
            }
        }
    }

    func testTodoLifecycle() async throws {
        let app = try await buildApplication(makeConfig())
        try await app.test(.router) { client in
            let credentials = Credentials(username: "alice", password: "correct horse battery")

            // Register
            try await client.execute(
                uri: "/api/auth/register",
                method: .post,
                headers: [.contentType: "application/json"],
                body: try self.json(credentials)
            ) { response in
                XCTAssertEqual(response.status, .created)
            }

            // The same username cannot be registered twice
            try await client.execute(
                uri: "/api/auth/register",
                method: .post,
                headers: [.contentType: "application/json"],
                body: try self.json(credentials)
            ) { response in
                XCTAssertEqual(response.status, .conflict)
            }

            // A wrong password is rejected
            try await client.execute(
                uri: "/api/auth/login",
                method: .post,
                headers: [.contentType: "application/json"],
                body: try self.json(Credentials(username: "alice", password: "wrong password"))
            ) { response in
                XCTAssertEqual(response.status, .unauthorized)
            }

            // Login
            let token = try await client.execute(
                uri: "/api/auth/login",
                method: .post,
                headers: [.contentType: "application/json"],
                body: try self.json(credentials)
            ) { response -> String in
                XCTAssertEqual(response.status, .ok)
                return try JSONDecoder().decode(TokenResponse.self, from: response.body).token
            }
            let authHeaders: HTTPFields = [.contentType: "application/json", .authorization: "Bearer \\(token)"]

            // Create
            let created = try await client.execute(
                uri: "/api/todos",
                method: .post,
                headers: authHeaders,
                body: try self.json(CreateTodoRequest(title: "Write more tests"))
            ) { response -> Todo in
                XCTAssertEqual(response.status, .created)
                return try JSONDecoder().decode(Todo.self, from: response.body)
            }
            XCTAssertEqual(created.title, "Write more tests")
            XCTAssertFalse(created.completed)

            // List
            try await client.execute(uri: "/api/todos", method: .get, headers: authHeaders) { response in
                XCTAssertEqual(response.status, .ok)
                let todos = try JSONDecoder().decode([Todo].self, from: response.body)
                XCTAssertEqual(todos, [created])
            }

            // Update
            try await client.execute(
                uri: "/api/todos/\\(created.id.uuidString)",
                method: .patch,
                headers: authHeaders,
                body: try self.json(UpdateTodoRequest(title: nil, completed: true))
            ) { response in
                XCTAssertEqual(response.status, .ok)
                let todo = try JSONDecoder().decode(Todo.self, from: response.body)
                XCTAssertTrue(todo.completed)
                XCTAssertEqual(todo.title, "Write more tests")
            }

            // Delete
            try await client.execute(
                uri: "/api/todos/\\(created.id.uuidString)",
                method: .delete,
                headers: authHeaders
            ) { response in
                XCTAssertEqual(response.status, .noContent)
            }

            // Gone
            try await client.execute(
                uri: "/api/todos/\\(created.id.uuidString)",
                method: .get,
                headers: authHeaders
            ) { response in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }

    func testWebSocketEcho() async throws {
        let app = try await buildApplication(makeConfig())
        try await app.test(.live) { client in
            _ = try await client.ws("/echo") { inbound, outbound, _ in
                try await outbound.write(.text("Hello"))
                var inboundIterator = inbound.messages(maxSize: .max).makeAsyncIterator()
                let message = try await inboundIterator.next()
                XCTAssertEqual(message, .text("Hello"))
            }
        }
    }
}`
  }
};
