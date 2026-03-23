import { BackendTemplate } from '../types';

export const hummingbirdTemplate: BackendTemplate = {
  id: 'hummingbird',
  name: 'hummingbird',
  displayName: 'Hummingbird Framework',
  description: 'Lightweight, flexible server-side Swift framework built on SwiftNIO with minimal dependencies',
  language: 'swift',
  framework: 'hummingbird',
  version: '1.10.0',
  tags: ['swift', 'hummingbird', 'api', 'rest', 'swiftnio', 'lightweight'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'middleware', 'logging', 'cors', 'compression', 'websockets'],
  
  files: {
    // Swift Package Manager configuration
    'Package.swift': `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "{{projectName}}",
    platforms: [
        .macOS(.v14)],
    products: [
        .executable(name: "{{projectName}}", targets: ["{{projectName}}"])],
    dependencies: [
        // Hummingbird
        .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "1.10.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-websocket.git", from: "1.2.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-fluent.git", from: "1.3.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-auth.git", from: "1.3.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird-compression.git", from: "1.2.0"),
        
        // Fluent ORM and drivers
        .package(url: "https://github.com/vapor/fluent.git", from: "4.8.0"),
        .package(url: "https://github.com/vapor/fluent-postgres-driver.git", from: "2.8.0"),
        .package(url: "https://github.com/vapor/fluent-mysql-driver.git", from: "4.4.0"),
        .package(url: "https://github.com/vapor/fluent-sqlite-driver.git", from: "4.5.0"),
        
        // JWT
        .package(url: "https://github.com/vapor/jwt.git", from: "4.2.2"),
        
        // Crypto
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
        
        // Logging
        .package(url: "https://github.com/apple/swift-log.git", from: "1.5.3"),
        
        // Argument Parser
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.2.3")],
    targets: [
        .executableTarget(
            name: "{{projectName}}",
            dependencies: [
                .product(name: "Hummingbird", package: "hummingbird"),
                .product(name: "HummingbirdFoundation", package: "hummingbird"),
                .product(name: "HummingbirdWebSocket", package: "hummingbird-websocket"),
                .product(name: "HummingbirdFluent", package: "hummingbird-fluent"),
                .product(name: "HummingbirdAuth", package: "hummingbird-auth"),
                .product(name: "HummingbirdCompression", package: "hummingbird-compression"),
                .product(name: "Fluent", package: "fluent"),
                .product(name: "FluentPostgresDriver", package: "fluent-postgres-driver"),
                .product(name: "FluentMySQLDriver", package: "fluent-mysql-driver"),
                .product(name: "FluentSQLiteDriver", package: "fluent-sqlite-driver"),
                .product(name: "JWT", package: "authentication"),
                .product(name: "Crypto", package: "swift-crypto"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "ArgumentParser", package: "swift-argument-parser")],
            path: "Sources/{{projectName}}"
        ),
        .testTarget(
            name: "{{projectName}}Tests",
            dependencies: [
                .target(name: "{{projectName}}"),
                .product(name: "HummingbirdXCT", package: "hummingbird")],
            path: "Tests/{{projectName}}Tests"
        )]
)`,

    // Main entry point
    'Sources/{{projectName}}/main.swift': `import Hummingbird
import ArgumentParser
import Logging

@main
struct {{projectName}}App: AsyncParsableCommand {
    @Option(name: .shortAndLong)
    var hostname: String = "127.0.0.1"
    
    @Option(name: .shortAndLong)
    var port: Int = 8080
    
    @Flag(name: .shortAndLong)
    var migrate: Bool = false
    
    @Flag(name: .shortAndLong)
    var revert: Bool = false
    
    mutating func run() async throws {
        // Setup logging
        LoggingSystem.bootstrap { label in
            var handler = StreamLogHandler.standardOutput(label: label)
            handler.logLevel = .debug
            return handler
        }
        
        let app = HBApplication(
            configuration: .init(
                address: .hostname(hostname, port: port),
                serverName: "{{projectName}}"
            )
        )
        
        // Configure application
        try await app.configure()
        
        // Handle migrations
        if migrate {
            try await app.migrate()
            return
        }
        
        if revert {
            try await app.revert()
            return
        }
        
        // Start server
        try await app.run()
    }
}`,

    // Application configuration
    'Sources/{{projectName}}/configure.swift': `import Hummingbird
import HummingbirdFluent
import HummingbirdAuth
import HummingbirdCompression
import HummingbirdWebSocket
import FluentPostgresDriver
import FluentMySQLDriver
import FluentSQLiteDriver
import JWT
import Logging

extension HBApplication {
    func configure() async throws {
        // Initialize logger
        logger.info("Configuring {{projectName}}")
        
        // Configure database
        try configureDatabase()
        
        // Configure middleware
        configureMiddleware()
        
        // Configure JWT
        configureJWT()
        
        // Configure routes
        configureRoutes()
        
        // Configure WebSocket
        try configureWebSocket()
    }
    
    private func configureDatabase() throws {
        let databaseType = Environment.get("DB_TYPE") ?? "sqlite"
        
        switch databaseType {
        case "postgres":
            fluent.databases.use(.postgres(
                configuration: .init(
                    hostname: Environment.get("DB_HOST") ?? "localhost",
                    port: Environment.get("DB_PORT").flatMap(Int.init) ?? 5432,
                    username: Environment.get("DB_USER") ?? "postgres",
                    password: Environment.get("DB_PASSWORD") ?? "",
                    database: Environment.get("DB_NAME") ?? "{{projectName}}",
                    tls: .prefer(try .init(configuration: .clientDefault))
                )
            ), as: .psql)
            
        case "mysql":
            fluent.databases.use(.mysql(
                configuration: .init(
                    hostname: Environment.get("DB_HOST") ?? "localhost",
                    port: Environment.get("DB_PORT").flatMap(Int.init) ?? 3306,
                    username: Environment.get("DB_USER") ?? "root",
                    password: Environment.get("DB_PASSWORD") ?? "",
                    database: Environment.get("DB_NAME") ?? "{{projectName}}"
                )
            ), as: .mysql)
            
        default:
            fluent.databases.use(.sqlite(.file(Environment.get("DB_PATH") ?? "db.sqlite")), as: .sqlite)
        }
        
        // Add migrations
        fluent.migrations.add(CreateUser())
        fluent.migrations.add(CreateTodo())
        fluent.migrations.add(CreateToken())
        
        // Run migrations in development
        if Environment.get("ENV") == "development" {
            try fluent.migrate().wait()
        }
    }
    
    private func configureMiddleware() {
        // CORS middleware
        middleware.add(CORSMiddleware())
        
        // Request logging
        middleware.add(LogRequestsMiddleware(.info))
        
        // Compression
        middleware.add(RequestCompressionMiddleware())
        middleware.add(ResponseCompressionMiddleware())
        
        // Error handling
        middleware.add(ErrorMiddleware())
        
        // File middleware for serving static files
        middleware.add(FileMiddleware(from: "public"))
    }
    
    private func configureJWT() {
        let secret = Environment.get("JWT_SECRET") ?? "your-256-bit-secret"
        jwt.signers.use(.hs256(key: secret))
    }
    
    func configureRoutes() {
        // Add routes
        router.get("/") { request -> HBResponse in
            let response = APIInfo(
                name: "{{projectName}} API",
                version: "1.0.0",
                status: "running"
            )
            return try HBResponse(status: .ok, body: .json(response))
        }
        
        // Health check
        router.get("/health") { request -> HBResponse in
            let health = try await checkHealth(request)
            return try HBResponse(status: .ok, body: .json(health))
        }
        
        // API routes
        let api = router.group("api").add(middleware: LogRequestsMiddleware(.debug))
        let v1 = api.group("v1")
        
        // Authentication routes
        let auth = v1.group("auth")
        auth.post("register", use: AuthController.register)
        auth.post("login", use: AuthController.login)
        auth.post("refresh", use: AuthController.refresh)
        
        // Protected routes
        let protected = v1.group("protected")
            .add(middleware: JWTAuthenticator())
            .add(middleware: UserAuthenticator())
        
        // User routes
        protected.get("users", use: UserController.list)
        protected.get("users/:id", use: UserController.get)
        protected.put("users/:id", use: UserController.update)
        protected.delete("users/:id", use: UserController.delete)
        
        // Todo routes
        protected.get("todos", use: TodoController.list)
        protected.post("todos", use: TodoController.create)
        protected.get("todos/:id", use: TodoController.get)
        protected.put("todos/:id", use: TodoController.update)
        protected.delete("todos/:id", use: TodoController.delete)
    }
    
    private func configureWebSocket() throws {
        // WebSocket configuration
        ws.addUpgrade()
        
        ws.on("/ws") { request, ws in
            WebSocketHandler.handle(request: request, ws: ws)
        }
    }
    
    private func checkHealth(_ request: HBRequest) async throws -> HealthCheck {
        var dbHealthy = false
        
        do {
            _ = try await User.query(on: request.db).count()
            dbHealthy = true
        } catch {
            request.logger.error("Database health check failed: \\(error)")
        }
        
        return HealthCheck(
            status: dbHealthy ? "healthy" : "unhealthy",
            version: "1.0.0",
            database: dbHealthy
        )
    }
    
    func migrate() async throws {
        try await fluent.migrate()
        logger.info("Migrations completed")
    }
    
    func revert() async throws {
        try await fluent.revert()
        logger.info("Migrations reverted")
    }
}

struct APIInfo: Codable {
    let name: String
    let version: String
    let status: String
}

struct HealthCheck: Codable {
    let status: String
    let version: String
    let database: Bool
}`,

    // Models
    'Sources/{{projectName}}/Models/User.swift': `import Foundation
import Fluent
import Crypto

final class User: Model {
    static let schema = "users"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "email")
    var email: String
    
    @Field(key: "password_hash")
    var passwordHash: String
    
    @Field(key: "name")
    var name: String
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?
    
    @Children(for: \\.$user)
    var todos: [Todo]
    
    @Children(for: \\.$user)
    var tokens: [Token]
    
    init() { }
    
    init(id: UUID? = nil, email: String, passwordHash: String, name: String) {
        self.id = id
        self.email = email
        self.passwordHash = passwordHash
        self.name = name
    }
}

extension User {
    struct Create: Codable {
        let email: String
        let password: String
        let name: String
    }
    
    struct Login: Codable {
        let email: String
        let password: String
    }
    
    struct Update: Codable {
        let name: String?
        let email: String?
    }
    
    struct Public: Codable {
        let id: UUID
        let email: String
        let name: String
        let createdAt: Date?
    }
    
    func toPublic() -> Public {
        return Public(
            id: id!,
            email: email,
            name: name,
            createdAt: createdAt
        )
    }
}

extension User {
    static func hashPassword(_ password: String) throws -> String {
        let salt = [UInt8].random(count: 16)
        let hash = try PBKDF2.deriveKey(
            from: password,
            salt: salt,
            iterations: 10_000,
            keySize: 32
        )
        return Data(salt + hash).base64EncodedString()
    }
    
    func verifyPassword(_ password: String) throws -> Bool {
        guard let data = Data(base64Encoded: passwordHash),
              data.count >= 16 else { return false }
        
        let salt = Array(data[0..<16])
        let expectedHash = Array(data[16...])
        
        let hash = try PBKDF2.deriveKey(
            from: password,
            salt: salt,
            iterations: 10_000,
            keySize: 32
        )
        
        return hash == expectedHash
    }
}`,

    'Sources/{{projectName}}/Models/Todo.swift': `import Foundation
import Fluent

final class Todo: Model {
    static let schema = "todos"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "title")
    var title: String
    
    @Field(key: "description")
    var description: String?
    
    @Field(key: "completed")
    var completed: Bool
    
    @Parent(key: "user_id")
    var user: User
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?
    
    init() { }
    
    init(id: UUID? = nil, title: String, description: String? = nil, completed: Bool = false, userID: User.IDValue) {
        self.id = id
        self.title = title
        self.description = description
        self.completed = completed
        self.$user.id = userID
    }
}

extension Todo {
    struct Create: Codable {
        let title: String
        let description: String?
    }
    
    struct Update: Codable {
        let title: String?
        let description: String?
        let completed: Bool?
    }
}`,

    'Sources/{{projectName}}/Models/Token.swift': `import Foundation
import Fluent

final class Token: Model {
    static let schema = "tokens"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "value")
    var value: String
    
    @Parent(key: "user_id")
    var user: User
    
    @Field(key: "expires_at")
    var expiresAt: Date
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    init() { }
    
    init(id: UUID? = nil, value: String, userID: User.IDValue, expiresAt: Date? = nil) {
        self.id = id
        self.value = value
        self.$user.id = userID
        self.expiresAt = expiresAt ?? Date().addingTimeInterval(60 * 60 * 24 * 30) // 30 days
    }
    
    var isValid: Bool {
        return expiresAt > Date()
    }
}`,

    // Migrations
    'Sources/{{projectName}}/Migrations/CreateUser.swift': `import Fluent

struct CreateUser: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("users")
            .id()
            .field("email", .string, .required)
            .unique(on: "email")
            .field("password_hash", .string, .required)
            .field("name", .string, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("users").delete()
    }
}`,

    'Sources/{{projectName}}/Migrations/CreateTodo.swift': `import Fluent

struct CreateTodo: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("todos")
            .id()
            .field("title", .string, .required)
            .field("description", .string)
            .field("completed", .bool, .required, .sql(.default(false)))
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("todos").delete()
    }
}`,

    'Sources/{{projectName}}/Migrations/CreateToken.swift': `import Fluent

struct CreateToken: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("tokens")
            .id()
            .field("value", .string, .required)
            .unique(on: "value")
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("expires_at", .datetime, .required)
            .field("created_at", .datetime)
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("tokens").delete()
    }
}`,

    // Controllers
    'Sources/{{projectName}}/Controllers/AuthController.swift': `import Hummingbird
import HummingbirdFluent
import JWT
import Fluent

struct AuthController {
    static func register(_ request: HBRequest) async throws -> HBResponse {
        let createRequest = try request.decode(as: User.Create.self)
        
        // Check if user exists
        let existingUser = try await User.query(on: request.db)
            .filter(\\.$email == createRequest.email)
            .first()
        
        guard existingUser == nil else {
            throw HBHTTPError(.conflict, message: "User already exists")
        }
        
        // Create user
        let passwordHash = try User.hashPassword(createRequest.password)
        let user = User(
            email: createRequest.email,
            passwordHash: passwordHash,
            name: createRequest.name
        )
        
        try await user.save(on: request.db)
        
        // Generate tokens
        let tokens = try await generateTokens(for: user, db: request.db)
        
        let response = AuthResponse(
            user: user.toPublic(),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        )
        
        return try HBResponse(status: .created, body: .json(response))
    }
    
    static func login(_ request: HBRequest) async throws -> HBResponse {
        let loginRequest = try request.decode(as: User.Login.self)
        
        // Find user
        guard let user = try await User.query(on: request.db)
            .filter(\\.$email == loginRequest.email)
            .first() else {
            throw HBHTTPError(.unauthorized, message: "Invalid credentials")
        }
        
        // Verify password
        guard try user.verifyPassword(loginRequest.password) else {
            throw HBHTTPError(.unauthorized, message: "Invalid credentials")
        }
        
        // Generate tokens
        let tokens = try await generateTokens(for: user, db: request.db)
        
        let response = AuthResponse(
            user: user.toPublic(),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        )
        
        return try HBResponse(status: .ok, body: .json(response))
    }
    
    static func refresh(_ request: HBRequest) async throws -> HBResponse {
        struct RefreshRequest: Codable {
            let refreshToken: String
        }
        
        let refreshRequest = try request.decode(as: RefreshRequest.self)
        
        // Find token
        guard let token = try await Token.query(on: request.db)
            .filter(\\.$value == refreshRequest.refreshToken)
            .with(\\.$user)
            .first(),
            token.isValid else {
            throw HBHTTPError(.unauthorized, message: "Invalid refresh token")
        }
        
        // Delete old token
        try await token.delete(on: request.db)
        
        // Generate new tokens
        let tokens = try await generateTokens(for: token.user, db: request.db)
        
        let response = RefreshResponse(
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        )
        
        return try HBResponse(status: .ok, body: .json(response))
    }
    
    private static func generateTokens(for user: User, db: Database) async throws -> (accessToken: String, refreshToken: String) {
        // Generate JWT access token
        let payload = JWTPayload(
            sub: SubjectClaim(value: user.id!.uuidString),
            exp: ExpirationClaim(value: Date().addingTimeInterval(60 * 15)), // 15 minutes
            email: user.email,
            name: user.name
        )
        
        let accessToken = try request.application.jwt.signers.sign(payload)
        
        // Generate refresh token
        let refreshToken = Token(
            value: [UInt8].random(count: 32).base64EncodedString(),
            userID: user.id!
        )
        try await refreshToken.save(on: db)
        
        return (accessToken: accessToken, refreshToken: refreshToken.value)
    }
}

struct AuthResponse: Codable {
    let user: User.Public
    let accessToken: String
    let refreshToken: String
}

struct RefreshResponse: Codable {
    let accessToken: String
    let refreshToken: String
}

struct JWTPayload: JWTPayload {
    let sub: SubjectClaim
    let exp: ExpirationClaim
    let email: String
    let name: String
    
    func verify(using signer: JWTSigner) throws {
        try exp.verifyNotExpired()
    }
}`,

    'Sources/{{projectName}}/Controllers/UserController.swift': `import Hummingbird
import HummingbirdFluent
import Fluent

struct UserController {
    static func list(_ request: HBRequest) async throws -> HBResponse {
        let users = try await User.query(on: request.db).all()
        let publicUsers = users.map { $0.toPublic() }
        
        return try HBResponse(status: .ok, body: .json(publicUsers))
    }
    
    static func get(_ request: HBRequest) async throws -> HBResponse {
        guard let id = request.parameters.get("id", as: UUID.self) else {
            throw HBHTTPError(.badRequest, message: "Invalid user ID")
        }
        
        guard let user = try await User.find(id, on: request.db) else {
            throw HBHTTPError(.notFound, message: "User not found")
        }
        
        return try HBResponse(status: .ok, body: .json(user.toPublic()))
    }
    
    static func update(_ request: HBRequest) async throws -> HBResponse {
        guard let currentUser = request.user else {
            throw HBHTTPError(.unauthorized)
        }
        
        guard let id = request.parameters.get("id", as: UUID.self) else {
            throw HBHTTPError(.badRequest, message: "Invalid user ID")
        }
        
        // Users can only update their own profile
        guard currentUser.id == id else {
            throw HBHTTPError(.forbidden)
        }
        
        let updateRequest = try request.decode(as: User.Update.self)
        
        guard let user = try await User.find(id, on: request.db) else {
            throw HBHTTPError(.notFound, message: "User not found")
        }
        
        // Update fields
        if let name = updateRequest.name {
            user.name = name
        }
        
        if let email = updateRequest.email {
            // Check if email is already taken
            let existingUser = try await User.query(on: request.db)
                .filter(\\.$email == email)
                .filter(\\.$id != id)
                .first()
            
            guard existingUser == nil else {
                throw HBHTTPError(.conflict, message: "Email already taken")
            }
            
            user.email = email
        }
        
        try await user.save(on: request.db)
        
        return try HBResponse(status: .ok, body: .json(user.toPublic()))
    }
    
    static func delete(_ request: HBRequest) async throws -> HBResponse {
        guard let currentUser = request.user else {
            throw HBHTTPError(.unauthorized)
        }
        
        guard let id = request.parameters.get("id", as: UUID.self) else {
            throw HBHTTPError(.badRequest, message: "Invalid user ID")
        }
        
        // Users can only delete their own profile
        guard currentUser.id == id else {
            throw HBHTTPError(.forbidden)
        }
        
        guard let user = try await User.find(id, on: request.db) else {
            throw HBHTTPError(.notFound, message: "User not found")
        }
        
        try await user.delete(on: request.db)
        
        return HBResponse(status: .noContent)
    }
}`,

    'Sources/{{projectName}}/Controllers/TodoController.swift': `import Hummingbird
import HummingbirdFluent
import Fluent

struct TodoController {
    static func list(_ request: HBRequest) async throws -> HBResponse {
        guard let user = request.user else {
            throw HBHTTPError(.unauthorized)
        }
        
        let todos = try await Todo.query(on: request.db)
            .filter(\\.$user.$id == user.id!)
            .sort(\\.$createdAt, .descending)
            .all()
        
        return try HBResponse(status: .ok, body: .json(todos))
    }
    
    static func create(_ request: HBRequest) async throws -> HBResponse {
        guard let user = request.user else {
            throw HBHTTPError(.unauthorized)
        }
        
        let createRequest = try request.decode(as: Todo.Create.self)
        
        let todo = Todo(
            title: createRequest.title,
            description: createRequest.description,
            userID: user.id!
        )
        
        try await todo.save(on: request.db)
        
        return try HBResponse(status: .created, body: .json(todo))
    }
    
    static func get(_ request: HBRequest) async throws -> HBResponse {
        guard let user = request.user else {
            throw HBHTTPError(.unauthorized)
        }
        
        guard let id = request.parameters.get("id", as: UUID.self) else {
            throw HBHTTPError(.badRequest, message: "Invalid todo ID")
        }
        
        guard let todo = try await Todo.find(id, on: request.db),
              todo.$user.id == user.id else {
            throw HBHTTPError(.notFound, message: "Todo not found")
        }
        
        return try HBResponse(status: .ok, body: .json(todo))
    }
    
    static func update(_ request: HBRequest) async throws -> HBResponse {
        guard let user = request.user else {
            throw HBHTTPError(.unauthorized)
        }
        
        guard let id = request.parameters.get("id", as: UUID.self) else {
            throw HBHTTPError(.badRequest, message: "Invalid todo ID")
        }
        
        guard let todo = try await Todo.find(id, on: request.db),
              todo.$user.id == user.id else {
            throw HBHTTPError(.notFound, message: "Todo not found")
        }
        
        let updateRequest = try request.decode(as: Todo.Update.self)
        
        // Update fields
        if let title = updateRequest.title {
            todo.title = title
        }
        
        if let description = updateRequest.description {
            todo.description = description
        }
        
        if let completed = updateRequest.completed {
            todo.completed = completed
        }
        
        try await todo.save(on: request.db)
        
        return try HBResponse(status: .ok, body: .json(todo))
    }
    
    static func delete(_ request: HBRequest) async throws -> HBResponse {
        guard let user = request.user else {
            throw HBHTTPError(.unauthorized)
        }
        
        guard let id = request.parameters.get("id", as: UUID.self) else {
            throw HBHTTPError(.badRequest, message: "Invalid todo ID")
        }
        
        guard let todo = try await Todo.find(id, on: request.db),
              todo.$user.id == user.id else {
            throw HBHTTPError(.notFound, message: "Todo not found")
        }
        
        try await todo.delete(on: request.db)
        
        return HBResponse(status: .noContent)
    }
}`,

    // Middleware
    'Sources/{{projectName}}/Middleware/CORSMiddleware.swift': `import Hummingbird

struct CORSMiddleware: HBMiddleware {
    func apply(to request: HBRequest, next: HBResponder) async throws -> HBResponse {
        var response = try await next.respond(to: request)
        
        response.headers.replaceOrAdd(name: "Access-Control-Allow-Origin", value: "*")
        response.headers.replaceOrAdd(name: "Access-Control-Allow-Headers", value: "Accept, Content-Type, Authorization")
        response.headers.replaceOrAdd(name: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS, PATCH")
        response.headers.replaceOrAdd(name: "Access-Control-Max-Age", value: "3600")
        
        if request.method == .OPTIONS {
            response.status = .ok
        }
        
        return response
    }
}`,

    'Sources/{{projectName}}/Middleware/ErrorMiddleware.swift': `import Hummingbird
import Logging

struct ErrorMiddleware: HBMiddleware {
    func apply(to request: HBRequest, next: HBResponder) async throws -> HBResponse {
        do {
            return try await next.respond(to: request)
        } catch let error as HBHTTPError {
            request.logger.error("HTTP Error: \\(error)")
            let errorResponse = ErrorResponse(
                error: error.message ?? HTTPResponseStatus(statusCode: error.status.code).reasonPhrase,
                status: error.status.code
            )
            return try HBResponse(status: error.status, body: .json(errorResponse))
        } catch {
            request.logger.error("Unexpected error: \\(error)")
            let errorResponse = ErrorResponse(
                error: "Internal server error",
                status: 500
            )
            return try HBResponse(status: .internalServerError, body: .json(errorResponse))
        }
    }
}

struct ErrorResponse: Codable {
    let error: String
    let status: Int
}`,

    'Sources/{{projectName}}/Middleware/JWTAuthenticator.swift': `import Hummingbird
import HummingbirdAuth
import JWT

struct JWTAuthenticator: HBAuthenticator {
    func authenticate(request: HBRequest) async throws -> User? {
        guard let token = request.headers.bearerAuthorization?.token else {
            return nil
        }
        
        do {
            let payload = try request.application.jwt.signers.verify(token, as: JWTPayload.self)
            
            guard let userId = UUID(uuidString: payload.sub.value) else {
                return nil
            }
            
            return try await User.find(userId, on: request.db)
        } catch {
            request.logger.debug("JWT authentication failed: \\(error)")
            return nil
        }
    }
}`,

    'Sources/{{projectName}}/Middleware/UserAuthenticator.swift': `import Hummingbird
import HummingbirdAuth

struct UserAuthenticator: HBMiddleware {
    func apply(to request: HBRequest, next: HBResponder) async throws -> HBResponse {
        guard request.user != nil else {
            throw HBHTTPError(.unauthorized, message: "Authentication required")
        }
        
        return try await next.respond(to: request)
    }
}

extension HBRequest {
    var user: User? {
        get { self.auth.get(User.self) }
        set { self.auth.set(newValue) }
    }
}`,

    // WebSocket handler
    'Sources/{{projectName}}/WebSocket/WebSocketHandler.swift': `import Hummingbird
import HummingbirdWebSocket
import Logging

struct WebSocketHandler {
    static func handle(request: HBRequest, ws: HBWebSocket) {
        let logger = request.logger
        let connectionId = UUID().uuidString
        
        logger.info("WebSocket connected: \\(connectionId)")
        
        // Send welcome message
        Task {
            let welcome = WebSocketMessage(
                type: "welcome",
                connectionId: connectionId,
                timestamp: Date()
            )
            
            if let data = try? JSONEncoder().encode(welcome) {
                try? await ws.send(.text(String(data: data, encoding: .utf8)!))
            }
        }
        
        // Handle incoming messages
        Task {
            for await message in ws.messages {
                switch message {
                case .text(let text):
                    await handleTextMessage(text, ws: ws, logger: logger)
                    
                case .binary(let data):
                    logger.debug("Received binary message: \\(data.count) bytes")
                    
                case .ping:
                    logger.debug("Received ping")
                    try? await ws.send(.pong)
                    
                case .pong:
                    logger.debug("Received pong")
                    
                case .close:
                    logger.info("WebSocket closing: \\(connectionId)")
                    break
                }
            }
        }
    }
    
    private static func handleTextMessage(_ text: String, ws: HBWebSocket, logger: Logger) async {
        guard let data = text.data(using: .utf8),
              let message = try? JSONDecoder().decode(IncomingMessage.self, from: data) else {
            logger.error("Failed to decode WebSocket message")
            return
        }
        
        switch message.type {
        case "echo":
            let response = WebSocketMessage(
                type: "echo",
                content: message.content,
                timestamp: Date()
            )
            if let responseData = try? JSONEncoder().encode(response) {
                try? await ws.send(.text(String(data: responseData, encoding: .utf8)!))
            }
            
        case "ping":
            let response = WebSocketMessage(
                type: "pong",
                timestamp: Date()
            )
            if let responseData = try? JSONEncoder().encode(response) {
                try? await ws.send(.text(String(data: responseData, encoding: .utf8)!))
            }
            
        default:
            logger.warning("Unknown message type: \\(message.type)")
        }
    }
}

struct IncomingMessage: Codable {
    let type: String
    let content: String?
}

struct WebSocketMessage: Codable {
    let type: String
    let connectionId: String?
    let content: String?
    let timestamp: Date
    
    init(type: String, connectionId: String? = nil, content: String? = nil, timestamp: Date) {
        self.type = type
        self.connectionId = connectionId
        self.content = content
        self.timestamp = timestamp
    }
}`,

    // Tests
    'Tests/{{projectName}}Tests/AuthTests.swift': `import XCTest
import HummingbirdXCT
import Fluent
@testable import {{projectName}}

final class AuthTests: XCTestCase {
    func testRegister() async throws {
        let app = HBApplication.xct
        try await app.configure()
        
        try await app.xct.execute(
            uri: "/api/v1/auth/register",
            method: .POST,
            body: .json([
                "email": "test@example.com",
                "password": "password123",
                "name": "Test User"
            ])
        ) { response in
            XCTAssertEqual(response.status, .created)
            
            let body = try JSONDecoder().decode(AuthResponse.self, from: response.body)
            XCTAssertEqual(body.user.email, "test@example.com")
            XCTAssertFalse(body.accessToken.isEmpty)
            XCTAssertFalse(body.refreshToken.isEmpty)
        }
    }
    
    func testLogin() async throws {
        let app = HBApplication.xct
        try await app.configure()
        
        // First create a user
        let user = User(
            email: "login@example.com",
            passwordHash: try User.hashPassword("password123"),
            name: "Login User"
        )
        try await user.save(on: app.db)
        
        // Then login
        try await app.xct.execute(
            uri: "/api/v1/auth/login",
            method: .POST,
            body: .json([
                "email": "login@example.com",
                "password": "password123"
            ])
        ) { response in
            XCTAssertEqual(response.status, .ok)
            
            let body = try JSONDecoder().decode(AuthResponse.self, from: response.body)
            XCTAssertEqual(body.user.email, "login@example.com")
            XCTAssertFalse(body.accessToken.isEmpty)
        }
    }
    
    func testInvalidLogin() async throws {
        let app = HBApplication.xct
        try await app.configure()
        
        try await app.xct.execute(
            uri: "/api/v1/auth/login",
            method: .POST,
            body: .json([
                "email": "nonexistent@example.com",
                "password": "wrongpassword"
            ])
        ) { response in
            XCTAssertEqual(response.status, .unauthorized)
        }
    }
}`,

    'Tests/{{projectName}}Tests/TodoTests.swift': `import XCTest
import HummingbirdXCT
import JWT
@testable import {{projectName}}

final class TodoTests: XCTestCase {
    var app: HBApplication!
    var authToken: String!
    var user: User!
    
    override func setUp() async throws {
        app = HBApplication.xct
        try await app.configure()
        
        // Create test user and get auth token
        user = User(
            email: "test@example.com",
            passwordHash: try User.hashPassword("password123"),
            name: "Test User"
        )
        try await user.save(on: app.db)
        
        let payload = JWTPayload(
            sub: SubjectClaim(value: user.id!.uuidString),
            exp: ExpirationClaim(value: Date().addingTimeInterval(3600)),
            email: user.email,
            name: user.name
        )
        authToken = try app.jwt.signers.sign(payload)
    }
    
    override func tearDown() async throws {
        try await app.fluent.databases.shutdown()
    }
    
    func testCreateTodo() async throws {
        try await app.xct.execute(
            uri: "/api/v1/protected/todos",
            method: .POST,
            headers: ["Authorization": "Bearer \\(authToken)"],
            body: .json([
                "title": "Test Todo",
                "description": "This is a test"
            ])
        ) { response in
            XCTAssertEqual(response.status, .created)
            
            let todo = try JSONDecoder().decode(Todo.self, from: response.body)
            XCTAssertEqual(todo.title, "Test Todo")
            XCTAssertEqual(todo.description, "This is a test")
            XCTAssertFalse(todo.completed)
        }
    }
    
    func testListTodos() async throws {
        // Create some todos
        let todo1 = Todo(title: "Todo 1", userID: user.id!)
        let todo2 = Todo(title: "Todo 2", userID: user.id!)
        try await todo1.save(on: app.db)
        try await todo2.save(on: app.db)
        
        try await app.xct.execute(
            uri: "/api/v1/protected/todos",
            method: .GET,
            headers: ["Authorization": "Bearer \\(authToken)"]
        ) { response in
            XCTAssertEqual(response.status, .ok)
            
            let todos = try JSONDecoder().decode([Todo].self, from: response.body)
            XCTAssertEqual(todos.count, 2)
        }
    }
    
    func testUpdateTodo() async throws {
        let todo = Todo(title: "Original", userID: user.id!)
        try await todo.save(on: app.db)
        
        try await app.xct.execute(
            uri: "/api/v1/protected/todos/\\(todo.id!)",
            method: .PUT,
            headers: ["Authorization": "Bearer \\(authToken)"],
            body: .json([
                "title": "Updated",
                "completed": true
            ])
        ) { response in
            XCTAssertEqual(response.status, .ok)
            
            let updatedTodo = try JSONDecoder().decode(Todo.self, from: response.body)
            XCTAssertEqual(updatedTodo.title, "Updated")
            XCTAssertTrue(updatedTodo.completed)
        }
    }
    
    func testDeleteTodo() async throws {
        let todo = Todo(title: "To Delete", userID: user.id!)
        try await todo.save(on: app.db)
        
        try await app.xct.execute(
            uri: "/api/v1/protected/todos/\\(todo.id!)",
            method: .DELETE,
            headers: ["Authorization": "Bearer \\(authToken)"]
        ) { response in
            XCTAssertEqual(response.status, .noContent)
        }
        
        // Verify deletion
        let deletedTodo = try await Todo.find(todo.id, on: app.db)
        XCTAssertNil(deletedTodo)
    }
}`,

    // Configuration files
    '.env.example': `# Environment
ENV=development

# Server
HOST=127.0.0.1
PORT=8080

# Database
DB_TYPE=sqlite
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME={{projectName}}
DB_PATH=db.sqlite

# Security
JWT_SECRET=your-256-bit-secret-key-here`,

    // Docker configuration  
    'Dockerfile': `# ================================
# Build image
# ================================
FROM swift:5.9-jammy as build

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    libssl-dev \\
    libsqlite3-dev \\
    libpq-dev \\
    libmysqlclient-dev \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy package files
COPY Package.* ./

# Resolve dependencies
RUN swift package resolve

# Copy source
COPY Sources ./Sources
COPY Tests ./Tests

# Build for release
RUN swift build -c release --static-swift-stdlib

# Run tests
RUN swift test

# ================================
# Runtime image  
# ================================
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    libssl3 \\
    libsqlite3-0 \\
    libpq5 \\
    libmysqlclient21 \\
    ca-certificates \\
    tzdata \\
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -s /bin/bash app

WORKDIR /app

# Copy build artifacts
COPY --from=build /build/.build/release/{{projectName}} .

# Copy public files
COPY public ./public

# Set ownership
RUN chown -R app:app /app

USER app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["./{{projectName}}"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENV=development
      - PORT=8080
      - DB_TYPE=postgres
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USER=hummingbird
      - DB_PASSWORD=hummingbird
      - DB_NAME={{projectName}}
      - JWT_SECRET=development-secret-key
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./public:/app/public

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=hummingbird
      - POSTGRES_PASSWORD=hummingbird
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hummingbird"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:`,

    // README
    'README.md': `# {{projectName}}

A lightweight, high-performance server-side Swift application built with Hummingbird.

## Features

- ✅ Lightweight HTTP server built on SwiftNIO
- ✅ RESTful API with async/await
- ✅ JWT authentication with refresh tokens
- ✅ Fluent ORM with PostgreSQL, MySQL, and SQLite
- ✅ WebSocket support
- ✅ Request/response compression
- ✅ CORS middleware
- ✅ Comprehensive error handling
- ✅ Database migrations
- ✅ Docker ready

## Requirements

- Swift 5.9 or later
- macOS 14+ or Ubuntu 22.04+

## Getting Started

1. Clone the repository
2. Copy \`.env.example\` to \`.env\` and configure
3. Install dependencies:
   \`\`\`bash
   swift package resolve
   \`\`\`
4. Run migrations:
   \`\`\`bash
   swift run {{projectName}} --migrate
   \`\`\`
5. Start the server:
   \`\`\`bash
   swift run {{projectName}}
   \`\`\`

The server will start on port 8080.

## Command Line Options

- \`--hostname, -h\`: Server hostname (default: 127.0.0.1)
- \`--port, -p\`: Server port (default: 8080)  
- \`--migrate, -m\`: Run database migrations
- \`--revert, -r\`: Revert database migrations

## API Endpoints

### Public Endpoints
- \`GET /\` - API information
- \`GET /health\` - Health check
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login
- \`POST /api/v1/auth/refresh\` - Refresh token

### Protected Endpoints
All protected endpoints require Bearer token authentication.

- \`GET /api/v1/protected/users\` - List users
- \`GET /api/v1/protected/users/:id\` - Get user
- \`PUT /api/v1/protected/users/:id\` - Update user
- \`DELETE /api/v1/protected/users/:id\` - Delete user
- \`GET /api/v1/protected/todos\` - List todos
- \`POST /api/v1/protected/todos\` - Create todo
- \`GET /api/v1/protected/todos/:id\` - Get todo
- \`PUT /api/v1/protected/todos/:id\` - Update todo
- \`DELETE /api/v1/protected/todos/:id\` - Delete todo

### WebSocket Endpoint
- \`WS /ws\` - WebSocket connection

## Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## Testing

Run the test suite:
\`\`\`bash
swift test
\`\`\`

## Performance

Hummingbird is built on SwiftNIO for high-performance async I/O. It's designed to be lightweight with minimal overhead.

## License

MIT`,

    '.gitignore': `# Swift
.DS_Store
/.build
/Packages
/*.xcodeproj
xcuserdata/
DerivedData/
.swiftpm/config/registries.json
.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata
.netrc

# Environment
.env
.env.local

# Database
*.sqlite
*.db

# Public files
public/uploads/

# IDE
.vscode/
.idea/`}};