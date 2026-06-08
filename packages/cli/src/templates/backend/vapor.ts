import { BackendTemplate } from '../types';

export const vaporTemplate: BackendTemplate = {
  id: 'vapor',
  name: 'vapor',
  displayName: 'Vapor Framework',
  description: 'Server-side Swift web framework with Fluent ORM, authentication, and async/await support',
  language: 'swift',
  framework: 'vapor',
  version: '4.89.0',
  tags: ['swift', 'vapor', 'api', 'rest', 'database', 'authentication'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'database', 'database', 'validation', 'logging', 'cors', 'websockets'],
  
  files: {
    // Swift Package Manager configuration
    'Package.swift': `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "{{projectName}}",
    platforms: [
       .macOS(.v13)
    ],
    dependencies: [
        // 💧 A server-side Swift web framework.
        .package(url: "https://github.com/vapor/vapor.git", from: "4.89.0"),
        // 🔵 Swift ORM (queries, models, relations, etc) built on SQLite 3.
        .package(url: "https://github.com/vapor/fluent.git", from: "4.8.0"),
        .package(url: "https://github.com/vapor/fluent-postgres-driver.git", from: "2.8.0"),
        .package(url: "https://github.com/vapor/fluent-mysql-driver.git", from: "4.4.0"),
        .package(url: "https://github.com/vapor/fluent-sqlite-driver.git", from: "4.5.0"),
        // 🔐 Vapor's JWT package
        .package(url: "https://github.com/vapor/jwt.git", from: "4.2.2"),
        // 📝 SwiftLog API for logging
        .package(url: "https://github.com/apple/swift-log.git", from: "1.5.3"),
        // 🔍 Swift Metrics API
        .package(url: "https://github.com/apple/swift-metrics.git", from: "2.4.1"),
        // 🧪 Testing utilities
        .package(url: "https://github.com/vapor/vapor-testing.git", from: "0.2.0")],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                .product(name: "Fluent", package: "fluent"),
                .product(name: "FluentPostgresDriver", package: "fluent-postgres-driver"),
                .product(name: "FluentMySQLDriver", package: "fluent-mysql-driver"),
                .product(name: "FluentSQLiteDriver", package: "fluent-sqlite-driver"),
                .product(name: "Vapor", package: "vapor"),
                .product(name: "JWT", package: "authentication"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Metrics", package: "swift-metrics")]
        ),
        .testTarget(
            name: "AppTests",
            dependencies: [
                .target(name: "App"),
                .product(name: "XCTVapor", package: "vapor"),
                .product(name: "VaporTesting", package: "vapor-testing")]
        )
    ]
)`,

    // Entry point
    'Sources/App/entrypoint.swift': `import Vapor
import Logging
import NIOCore
import NIOPosix

@main
enum Entrypoint {
    static func main() async throws {
        // Bootstrap logging system
        LoggingSystem.bootstrap(StreamLogHandler.standardOutput)
        
        var env = try Environment.detect()
        try LoggingSystem.bootstrap(from: &env)
        
        let app = Application(env)
        defer { app.shutdown() }
        
        do {
            try await configure(app)
        } catch {
            app.logger.report(error: error)
            throw error
        }
        
        try await app.run()
    }
}`,

    // Configuration
    'Sources/App/configure.swift': `import NIOSSL
import Fluent
import FluentPostgresDriver
import FluentMySQLDriver
import FluentSQLiteDriver
import Vapor
import JWT

// configures your application
public func configure(_ app: Application) async throws {
    // Load environment variables from .env file
    if let envPath = Environment.get("ENV_PATH") {
        try DotEnv.load(path: envPath)
    }
    
    // Configure server
    app.http.server.configuration.hostname = Environment.get("HOST") ?? "127.0.0.1"
    app.http.server.configuration.port = Environment.get("PORT").flatMap(Int.init) ?? 8080
    
    // Configure file middleware
    app.middleware.use(FileMiddleware(publicDirectory: app.directory.publicDirectory))
    
    // Configure CORS
    let corsConfiguration = CORSMiddleware.Configuration(
        allowedOrigin: .all,
        allowedMethods: [.GET, .POST, .PUT, .OPTIONS, .DELETE, .PATCH],
        allowedHeaders: [.accept, .authorization, .contentType, .origin, .xRequestedWith, .userAgent, .accessControlAllowOrigin]
    )
    app.middleware.use(CORSMiddleware(configuration: corsConfiguration))
    
    // Configure error middleware
    app.middleware.use(ErrorMiddleware.default(environment: app.environment))
    
    // Configure database
    let databaseType = Environment.get("DATABASE_TYPE") ?? "sqlite"
    
    switch databaseType {
    case "postgres":
        app.databases.use(DatabaseConfigurationFactory.postgres(configuration: .init(
            hostname: Environment.get("DATABASE_HOST") ?? "localhost",
            port: Environment.get("DATABASE_PORT").flatMap(Int.init) ?? PostgresConfiguration.ianaPortNumber,
            username: Environment.get("DATABASE_USERNAME") ?? "vapor_username",
            password: Environment.get("DATABASE_PASSWORD") ?? "vapor_password",
            database: Environment.get("DATABASE_NAME") ?? "vapor_database",
            tls: .prefer(try .init(configuration: .clientDefault))
        )), as: .psql)
        
    case "mysql":
        app.databases.use(DatabaseConfigurationFactory.mysql(
            hostname: Environment.get("DATABASE_HOST") ?? "localhost",
            port: Environment.get("DATABASE_PORT").flatMap(Int.init) ?? MySQLConfiguration.ianaPortNumber,
            username: Environment.get("DATABASE_USERNAME") ?? "vapor_username",
            password: Environment.get("DATABASE_PASSWORD") ?? "vapor_password",
            database: Environment.get("DATABASE_NAME") ?? "vapor_database"
        ), as: .mysql)
        
    default:
        app.databases.use(.sqlite(.file("db.sqlite")), as: .sqlite)
    }
    
    // Configure migrations
    app.migrations.add(CreateUser())
    app.migrations.add(CreateTodo())
    app.migrations.add(CreateToken())
    
    // Run migrations automatically in development
    if app.environment == .development {
        try await app.autoMigrate()
    }
    
    // Configure JWT
    let privateKey = Environment.get("JWT_PRIVATE_KEY") ?? """
    -----BEGIN PRIVATE KEY-----
    MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2
    OF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r
    1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G
    -----END PRIVATE KEY-----
    """
    
    let publicKey = Environment.get("JWT_PUBLIC_KEY") ?? """
    -----BEGIN PUBLIC KEY-----
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEEVs/o5+uQbTjL3chynL4wXgUg2R9
    q9UU8I5mEovUf86QZ7kOBIjJwqnzD1omageEHWwHdBO6B+dFabmdT9POxg==
    -----END PUBLIC KEY-----
    """
    
    let privateKeyData = Data(privateKey.utf8)
    let publicKeyData = Data(publicKey.utf8)
    
    try app.jwt.signers.use(.es256(key: .private(pem: privateKeyData)))
    try app.jwt.signers.use(.es256(key: .public(pem: publicKeyData)), isDefault: false)
    
    // Register routes
    try routes(app)
}`,

    // Routes
    'Sources/App/routes.swift': `import Fluent
import Vapor

func routes(_ app: Application) throws {
    app.get { req async in
        "Welcome to {{projectName}} API!"
    }
    
    app.get("health") { req async -> HealthCheckResponse in
        let dbHealthy = await checkDatabaseHealth(req.db)
        
        return HealthCheckResponse(
            status: dbHealthy ? "healthy" : "unhealthy",
            version: "1.0.0",
            database: dbHealthy
        )
    }
    
    // API routes
    let api = app.grouped("api", "v1")
    
    // Public routes
    try api.register(collection: AuthController())
    
    // Protected routes
    let protected = api.grouped(UserAuthenticator())
        .grouped(User.guardMiddleware())
    
    try protected.register(collection: UserController())
    try protected.register(collection: TodoController())
}

private func checkDatabaseHealth(_ db: Database) async -> Bool {
    do {
        // Try a simple query
        _ = try await User.query(on: db).count()
        return true
    } catch {
        return false
    }
}

struct HealthCheckResponse: Content {
    let status: String
    let version: String
    let database: Bool
}`,

    // Models
    'Sources/App/Models/User.swift': `import Fluent
import Vapor

final class User: Model, Content, @unchecked Sendable {
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
    struct Create: Content, Validatable {
        var email: String
        var password: String
        var confirmPassword: String
        var name: String
        
        static func validations(_ validations: inout Validations) {
            validations.add("email", as: String.self, is: .email)
            validations.add("password", as: String.self, is: .count(8...))
            validations.add("name", as: String.self, is: !.empty)
        }
    }
    
    struct Login: Content, Validatable {
        var email: String
        var password: String
        
        static func validations(_ validations: inout Validations) {
            validations.add("email", as: String.self, is: .email)
            validations.add("password", as: String.self, is: !.empty)
        }
    }
}

extension User: ModelAuthenticatable {
    static let usernameKey = \\User.$email
    static let passwordHashKey = \\User.$passwordHash
    
    func verify(password: String) throws -> Bool {
        try Bcrypt.verify(password, created: self.passwordHash)
    }
}

extension User {
    func generateToken() throws -> Token {
        try .init(
            value: [UInt8].random(count: 16).base64,
            userID: self.requireID()
        )
    }
}`,

    'Sources/App/Models/Todo.swift': `import Fluent
import Vapor

final class Todo: Model, Content, @unchecked Sendable {
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
    struct Create: Content, Validatable {
        var title: String
        var description: String?
        
        static func validations(_ validations: inout Validations) {
            validations.add("title", as: String.self, is: !.empty)
        }
    }
    
    struct Update: Content, Validatable {
        var title: String?
        var description: String?
        var completed: Bool?
        
        static func validations(_ validations: inout Validations) {
            validations.add("title", as: String?.self, is: .nil || !.empty, required: false)
        }
    }
}`,

    'Sources/App/Models/Token.swift': `import Fluent
import Vapor

final class Token: Model, Content, @unchecked Sendable {
    static let schema = "tokens"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "value")
    var value: String
    
    @Parent(key: "user_id")
    var user: User
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Field(key: "expires_at")
    var expiresAt: Date?
    
    init() { }
    
    init(id: UUID? = nil, value: String, userID: User.IDValue, expiresAt: Date? = nil) {
        self.id = id
        self.value = value
        self.$user.id = userID
        self.expiresAt = expiresAt ?? Date().addingTimeInterval(60 * 60 * 24 * 30) // 30 days
    }
}

extension Token: ModelTokenAuthenticatable {
    static let valueKey = \\Token.$value
    static let userKey = \\Token.$user
    
    var isValid: Bool {
        guard let expiresAt = expiresAt else { return true }
        return expiresAt > Date()
    }
}`,

    // Migrations
    'Sources/App/Migrations/CreateUser.swift': `import Fluent

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

    'Sources/App/Migrations/CreateTodo.swift': `import Fluent

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

    'Sources/App/Migrations/CreateToken.swift': `import Fluent

struct CreateToken: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("tokens")
            .id()
            .field("value", .string, .required)
            .unique(on: "value")
            .field("user_id", .uuid, .required, .references("users", "id", onDelete: .cascade))
            .field("created_at", .datetime)
            .field("expires_at", .datetime)
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("tokens").delete()
    }
}`,

    // Controllers
    'Sources/App/Controllers/AuthController.swift': `import Fluent
import Vapor
import JWT

struct AuthController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let auth = routes.grouped("auth")
        auth.post("register", use: register)
        auth.post("login", use: login)
        
        let authenticated = auth.grouped(UserAuthenticator())
            .grouped(User.guardMiddleware())
        authenticated.delete("logout", use: logout)
        authenticated.get("me", use: me)
    }
    
    @Sendable
    func register(req: Request) async throws -> TokenResponse {
        try User.Create.validate(content: req)
        let create = try req.content.decode(User.Create.self)
        
        guard create.password == create.confirmPassword else {
            throw Abort(.badRequest, reason: "Passwords did not match")
        }
        
        // Check if user already exists
        let existingUser = try await User.query(on: req.db)
            .filter(\\.$email == create.email)
            .first()
        
        guard existingUser == nil else {
            throw Abort(.badRequest, reason: "A user with this email already exists")
        }
        
        // Create new user
        let user = try User(
            email: create.email,
            passwordHash: Bcrypt.hash(create.password),
            name: create.name
        )
        
        try await user.save(on: req.db)
        
        // Generate token
        let token = try user.generateToken()
        try await token.save(on: req.db)
        
        return TokenResponse(
            token: token.value,
            user: UserResponse(user: user)
        )
    }
    
    @Sendable
    func login(req: Request) async throws -> TokenResponse {
        try User.Login.validate(content: req)
        let login = try req.content.decode(User.Login.self)
        
        // Find user
        guard let user = try await User.query(on: req.db)
            .filter(\\.$email == login.email)
            .first() else {
            throw Abort(.unauthorized, reason: "Invalid email or password")
        }
        
        // Verify password
        guard try user.verify(password: login.password) else {
            throw Abort(.unauthorized, reason: "Invalid email or password")
        }
        
        // Generate token
        let token = try user.generateToken()
        try await token.save(on: req.db)
        
        return TokenResponse(
            token: token.value,
            user: UserResponse(user: user)
        )
    }
    
    @Sendable
    func logout(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        
        // Delete all user tokens
        try await user.$tokens.query(on: req.db).delete()
        
        return .noContent
    }
    
    @Sendable
    func me(req: Request) async throws -> UserResponse {
        let user = try req.auth.require(User.self)
        return UserResponse(user: user)
    }
}

struct UserAuthenticator: AsyncBearerAuthenticator {
    func authenticate(bearer: BearerAuthorization, for request: Request) async throws {
        guard let token = try await Token.query(on: request.db)
            .filter(\\.$value == bearer.token)
            .with(\\.$user)
            .first(),
            token.isValid else {
            return
        }
        
        request.auth.login(token.user)
    }
}

struct TokenResponse: Content {
    let token: String
    let user: UserResponse
}

struct UserResponse: Content {
    let id: UUID
    let email: String
    let name: String
    let createdAt: Date?
    
    init(user: User) {
        self.id = user.id!
        self.email = user.email
        self.name = user.name
        self.createdAt = user.createdAt
    }
}`,

    'Sources/App/Controllers/UserController.swift': `import Fluent
import Vapor

struct UserController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.get(use: index)
        users.put(use: update)
        users.delete(use: delete)
    }
    
    @Sendable
    func index(req: Request) async throws -> [UserResponse] {
        let users = try await User.query(on: req.db).all()
        return users.map { UserResponse(user: $0) }
    }
    
    @Sendable
    func update(req: Request) async throws -> UserResponse {
        let user = try req.auth.require(User.self)
        
        struct UpdateUser: Content, Validatable {
            var name: String?
            var email: String?
            
            static func validations(_ validations: inout Validations) {
                validations.add("email", as: String?.self, is: .nil || .email, required: false)
                validations.add("name", as: String?.self, is: .nil || !.empty, required: false)
            }
        }
        
        try UpdateUser.validate(content: req)
        let update = try req.content.decode(UpdateUser.self)
        
        if let name = update.name {
            user.name = name
        }
        
        if let email = update.email {
            // Check if email is already taken
            let existingUser = try await User.query(on: req.db)
                .filter(\\.$email == email)
                .filter(\\.$id != user.id!)
                .first()
            
            guard existingUser == nil else {
                throw Abort(.badRequest, reason: "Email is already taken")
            }
            
            user.email = email
        }
        
        try await user.save(on: req.db)
        
        return UserResponse(user: user)
    }
    
    @Sendable
    func delete(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        try await user.delete(on: req.db)
        return .noContent
    }
}`,

    'Sources/App/Controllers/TodoController.swift': `import Fluent
import Vapor

struct TodoController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let todos = routes.grouped("todos")
        todos.get(use: index)
        todos.post(use: create)
        todos.group(":todoID") { todo in
            todo.get(use: show)
            todo.put(use: update)
            todo.delete(use: delete)
        }
    }
    
    @Sendable
    func index(req: Request) async throws -> Page<TodoResponse> {
        let user = try req.auth.require(User.self)
        
        let todos = try await Todo.query(on: req.db)
            .filter(\\.$user.$id == user.id!)
            .sort(\\.$createdAt, .descending)
            .paginate(for: req)
        
        return todos.map { TodoResponse(todo: $0) }
    }
    
    @Sendable
    func create(req: Request) async throws -> TodoResponse {
        let user = try req.auth.require(User.self)
        
        try Todo.Create.validate(content: req)
        let create = try req.content.decode(Todo.Create.self)
        
        let todo = Todo(
            title: create.title,
            description: create.description,
            userID: user.id!
        )
        
        try await todo.save(on: req.db)
        
        return TodoResponse(todo: todo)
    }
    
    @Sendable
    func show(req: Request) async throws -> TodoResponse {
        let user = try req.auth.require(User.self)
        
        guard let todo = try await Todo.find(req.parameters.get("todoID"), on: req.db),
              todo.$user.id == user.id else {
            throw Abort(.notFound)
        }
        
        return TodoResponse(todo: todo)
    }
    
    @Sendable
    func update(req: Request) async throws -> TodoResponse {
        let user = try req.auth.require(User.self)
        
        guard let todo = try await Todo.find(req.parameters.get("todoID"), on: req.db),
              todo.$user.id == user.id else {
            throw Abort(.notFound)
        }
        
        try Todo.Update.validate(content: req)
        let update = try req.content.decode(Todo.Update.self)
        
        if let title = update.title {
            todo.title = title
        }
        
        if let description = update.description {
            todo.description = description
        }
        
        if let completed = update.completed {
            todo.completed = completed
        }
        
        try await todo.save(on: req.db)
        
        return TodoResponse(todo: todo)
    }
    
    @Sendable
    func delete(req: Request) async throws -> HTTPStatus {
        let user = try req.auth.require(User.self)
        
        guard let todo = try await Todo.find(req.parameters.get("todoID"), on: req.db),
              todo.$user.id == user.id else {
            throw Abort(.notFound)
        }
        
        try await todo.delete(on: req.db)
        
        return .noContent
    }
}

struct TodoResponse: Content {
    let id: UUID
    let title: String
    let description: String?
    let completed: Bool
    let createdAt: Date?
    let updatedAt: Date?
    
    init(todo: Todo) {
        self.id = todo.id!
        self.title = todo.title
        self.description = todo.description
        self.completed = todo.completed
        self.createdAt = todo.createdAt
        self.updatedAt = todo.updatedAt
    }
}`,

    // Tests
    'Tests/AppTests/AuthTests.swift': `@testable import App
import XCTVapor
import Fluent

final class AuthTests: XCTestCase {
    var app: Application!
    
    override func setUp() async throws {
        app = Application(.testing)
        try await configure(app)
        try await app.autoMigrate()
    }
    
    override func tearDown() async throws {
        try await app.autoRevert()
        app.shutdown()
    }
    
    func testRegister() async throws {
        try await app.test(.POST, "api/v1/auth/register", beforeRequest: { req in
            try req.content.encode([
                "email": "test@example.com",
                "password": "password123",
                "confirmPassword": "password123",
                "name": "Test User"
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let tokenResponse = try res.content.decode(TokenResponse.self)
            XCTAssertFalse(tokenResponse.token.isEmpty)
            XCTAssertEqual(tokenResponse.user.email, "test@example.com")
        })
    }
    
    func testLoginWithValidCredentials() async throws {
        // First register a user
        let user = User(
            email: "test@example.com",
            passwordHash: try Bcrypt.hash("password123"),
            name: "Test User"
        )
        try await user.save(on: app.db)
        
        // Then try to login
        try await app.test(.POST, "api/v1/auth/login", beforeRequest: { req in
            try req.content.encode([
                "email": "test@example.com",
                "password": "password123"
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let tokenResponse = try res.content.decode(TokenResponse.self)
            XCTAssertFalse(tokenResponse.token.isEmpty)
        })
    }
    
    func testLoginWithInvalidCredentials() async throws {
        try await app.test(.POST, "api/v1/auth/login", beforeRequest: { req in
            try req.content.encode([
                "email": "test@example.com",
                "password": "wrongpassword"
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized)
        })
    }
}`,

    'Tests/AppTests/TodoTests.swift': `@testable import App
import XCTVapor
import Fluent

final class TodoTests: XCTestCase {
    var app: Application!
    var testUser: User!
    var authToken: String!
    
    override func setUp() async throws {
        app = Application(.testing)
        try await configure(app)
        try await app.autoMigrate()
        
        // Create test user
        testUser = User(
            email: "test@example.com",
            passwordHash: try Bcrypt.hash("password123"),
            name: "Test User"
        )
        try await testUser.save(on: app.db)
        
        // Create auth token
        let token = try testUser.generateToken()
        try await token.save(on: app.db)
        authToken = token.value
    }
    
    override func tearDown() async throws {
        try await app.autoRevert()
        app.shutdown()
    }
    
    func testCreateTodo() async throws {
        try await app.test(.POST, "api/v1/todos", beforeRequest: { req in
            req.headers.bearerAuthorization = BearerAuthorization(token: authToken)
            try req.content.encode([
                "title": "Test Todo",
                "description": "This is a test todo"
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let todo = try res.content.decode(TodoResponse.self)
            XCTAssertEqual(todo.title, "Test Todo")
            XCTAssertEqual(todo.description, "This is a test todo")
            XCTAssertFalse(todo.completed)
        })
    }
    
    func testGetTodos() async throws {
        // Create some todos
        let todo1 = Todo(title: "Todo 1", userID: testUser.id!)
        let todo2 = Todo(title: "Todo 2", userID: testUser.id!)
        try await todo1.save(on: app.db)
        try await todo2.save(on: app.db)
        
        try await app.test(.GET, "api/v1/todos", beforeRequest: { req in
            req.headers.bearerAuthorization = BearerAuthorization(token: authToken)
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let page = try res.content.decode(Page<TodoResponse>.self)
            XCTAssertEqual(page.items.count, 2)
        })
    }
    
    func testUpdateTodo() async throws {
        let todo = Todo(title: "Original Title", userID: testUser.id!)
        try await todo.save(on: app.db)
        
        try await app.test(.PUT, "api/v1/todos/\\(todo.id!)", beforeRequest: { req in
            req.headers.bearerAuthorization = BearerAuthorization(token: authToken)
            try req.content.encode([
                "title": "Updated Title",
                "completed": true
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let updatedTodo = try res.content.decode(TodoResponse.self)
            XCTAssertEqual(updatedTodo.title, "Updated Title")
            XCTAssertTrue(updatedTodo.completed)
        })
    }
    
    func testDeleteTodo() async throws {
        let todo = Todo(title: "To Delete", userID: testUser.id!)
        try await todo.save(on: app.db)
        
        try await app.test(.DELETE, "api/v1/todos/\\(todo.id!)", beforeRequest: { req in
            req.headers.bearerAuthorization = BearerAuthorization(token: authToken)
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .noContent)
        })
        
        // Verify deletion
        let deletedTodo = try await Todo.find(todo.id, on: app.db)
        XCTAssertNil(deletedTodo)
    }
}`,

    // Environment configuration
    '.env.example': `# Server Configuration
HOST=127.0.0.1
PORT=8080

# Database Configuration
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=vapor_username
DATABASE_PASSWORD=vapor_password
DATABASE_NAME=vapor_database

# JWT Configuration
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2
OF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r
1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G
-----END PRIVATE KEY-----"

JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEEVs/o5+uQbTjL3chynL4wXgUg2R9
q9UU8I5mEovUf86QZ7kOBIjJwqnzD1omageEHWwHdBO6B+dFabmdT9POxg==
-----END PUBLIC KEY-----"

# Environment
ENVIRONMENT=development`,

    // Docker configuration
    'Dockerfile': `# ================================
# Build image
# ================================
FROM swift:5.9-jammy as build

# Install OS updates
RUN export DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true \
    && apt-get -q update \
    && apt-get -q dist-upgrade -y \
    && apt-get install -y libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set up a build area
WORKDIR /build

# First just resolve dependencies.
# This creates a cached layer that can be reused
# as long as your Package.swift/Package.resolved files do not change.
COPY ./Package.* ./
RUN swift package resolve --skip-update \
        $([ -f ./Package.resolved ] && echo "--force-resolved-versions" || true)

# Copy entire repo into container
COPY . .

# Build everything, with optimizations
RUN swift build -c release --static-swift-stdlib \
    # Workaround for https://github.com/apple/swift/pull/68669
    # This can be removed as soon as 5.9.1 is released, but is harmless if left in.
    -Xlinker -u -Xlinker _swift_backtrace_isThunkFunction

# Switch to the staging area
WORKDIR /staging

# Copy main executable to staging area
RUN cp "$(swift build --package-path /build -c release --show-bin-path)/App" ./

# Copy resources bundled by SPM to staging area
RUN find -L "$(swift build --package-path /build -c release --show-bin-path)/" -regex '.*\\.resources$' -exec cp -Ra {} ./ \\;

# Copy any resources from the public directory and views directory if the directories exist
# Ensure that by default, neither the directory nor any of its contents are writable.
RUN [ -d /build/Public ] && { mv /build/Public ./Public && chmod -R a-w ./Public; } || true
RUN [ -d /build/Resources ] && { mv /build/Resources ./Resources && chmod -R a-w ./Resources; } || true

# ================================
# Run image
# ================================
FROM swift:5.9-jammy-slim

# Install runtime dependencies
RUN export DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true \
    && apt-get -q update \
    && apt-get -q dist-upgrade -y \
    && apt-get -q install -y \
      ca-certificates \
      tzdata \
      libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

# Create a vapor user and group with /app as its home directory
RUN useradd --user-group --create-home --system --skel /dev/null --home-dir /app vapor

# Switch to the new home directory
WORKDIR /app

# Copy built executable and any staged resources from builder
COPY --from=build --chown=vapor:vapor /staging /app

# Provide configuration defaults
ENV HOST=0.0.0.0 \\
    PORT=8080

# Ensure all further commands run as the vapor user
USER vapor:vapor

# Let Docker bind to port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Start the Vapor service when the image is run
ENTRYPOINT ["./App"]
CMD ["serve", "--env", "production", "--hostname", "0.0.0.0", "--port", "8080"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build:
      context: .
    ports:
      - "8080:8080"
    environment:
      - HOST=0.0.0.0
      - PORT=8080
      - DATABASE_TYPE=postgres
      - DATABASE_HOST=db
      - DATABASE_PORT=5432
      - DATABASE_USERNAME=vapor
      - DATABASE_PASSWORD=vapor_password
      - DATABASE_NAME=vapor_db
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=vapor
      - POSTGRES_PASSWORD=vapor_password
      - POSTGRES_DB=vapor_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vapor"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge`,

    // README
    'README.md': `# {{projectName}}

A server-side Swift application built with Vapor 4.

## Features

- ✅ RESTful API with Vapor 4
- ✅ Fluent ORM with PostgreSQL/MySQL/SQLite support
- ✅ JWT authentication
- ✅ User registration and login
- ✅ CRUD operations for todos
- ✅ Request validation
- ✅ Database migrations
- ✅ Comprehensive test suite
- ✅ Docker support
- ✅ CORS configuration
- ✅ Health check endpoint

## Requirements

- Swift 5.9 or later
- macOS 13+ or Linux

## Getting Started

1. Clone the repository
2. Copy \`.env.example\` to \`.env\` and configure your environment variables
3. Install dependencies:
   \`\`\`bash
   swift package resolve
   \`\`\`
4. Run migrations:
   \`\`\`bash
   swift run App migrate
   \`\`\`
5. Start the server:
   \`\`\`bash
   swift run App serve
   \`\`\`

The API will be available at \`http://localhost:8080\`.

## Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Endpoints

### Public Endpoints
- \`GET /\` - Welcome message
- \`GET /health\` - Health check
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login

### Protected Endpoints (require Bearer token)
- \`GET /api/v1/auth/me\` - Get current user
- \`DELETE /api/v1/auth/logout\` - Logout
- \`GET /api/v1/users\` - List all users
- \`PUT /api/v1/users\` - Update current user
- \`DELETE /api/v1/users\` - Delete current user
- \`GET /api/v1/todos\` - List todos
- \`POST /api/v1/todos\` - Create todo
- \`GET /api/v1/todos/:id\` - Get todo
- \`PUT /api/v1/todos/:id\` - Update todo
- \`DELETE /api/v1/todos/:id\` - Delete todo

## Testing

Run the test suite:
\`\`\`bash
swift test
\`\`\`

## Environment Variables

See \`.env.example\` for all available configuration options.

## License

MIT`,

    '.gitignore': `# Vapor
.build/
DerivedData/
Package.resolved
*.xcodeproj
.swiftpm
.DS_Store
db.sqlite
.env
.env.development.local
.env.test.local
.env.production.local
.env.local
Public/
Resources/`}};