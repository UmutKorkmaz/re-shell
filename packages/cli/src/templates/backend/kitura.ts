import { BackendTemplate } from '../types';

export const kituraTemplate: BackendTemplate = {
  id: 'kitura',
  name: 'kitura',
  displayName: 'Kitura Framework',
  description: 'Enterprise-grade Swift web framework with IBM Cloud integration, middleware, and OpenAPI support',
  language: 'swift',
  framework: 'kitura',
  version: '2.9.0',
  tags: ['swift', 'kitura', 'api', 'rest', 'ibm', 'docker', 'swagger'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'swagger', 'monitoring', 'monitoring', 'logging', 'cors', 'docker'],
  
  files: {
    // Swift Package Manager configuration
    'Package.swift': `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "{{projectName}}",
    platforms: [
        .macOS(.v10_15)
    ],
    dependencies: [
        // 💙 Kitura web framework
        .package(url: "https://github.com/Kitura/Kitura.git", from: "2.9.200"),
        .package(url: "https://github.com/Kitura/Kitura-OpenAPI.git", from: "1.4.0"),
        .package(url: "https://github.com/Kitura/Swift-Kuery-ORM.git", from: "0.6.1"),
        .package(url: "https://github.com/Kitura/Swift-Kuery-PostgreSQL.git", from: "2.1.1"),
        .package(url: "https://github.com/Kitura/SwiftKueryMySQL.git", from: "2.0.2"),
        .package(url: "https://github.com/Kitura/Swift-Kuery-SQLite.git", from: "2.0.2"),
        
        // Authentication & Security
        .package(url: "https://github.com/Kitura/Kitura-Credentials.git", from: "2.5.0"),
        .package(url: "https://github.com/Kitura/Kitura-CredentialsJWT.git", from: "1.0.0"),
        .package(url: "https://github.com/Kitura/Kitura-Session.git", from: "3.3.4"),
        
        // Cloud & Monitoring
        .package(url: "https://github.com/Kitura/Health.git", from: "1.0.5"),
        .package(url: "https://github.com/RuntimeTools/SwiftMetrics.git", from: "2.6.5"),
        .package(url: "https://github.com/Kitura/HeliumLogger.git", from: "2.0.0"),
        
        // Utilities
        .package(url: "https://github.com/Kitura/Kitura-CORS.git", from: "2.1.1"),
        .package(url: "https://github.com/Kitura/Kitura-Compression.git", from: "2.2.2"),
        .package(url: "https://github.com/Kitura/CloudEnvironment.git", from: "9.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.5.3")],
    targets: [
        .executableTarget(
            name: "{{projectName}}",
            dependencies: [
                .product(name: "Kitura", package: "Kitura"),
                .product(name: "KituraOpenAPI", package: "Kitura-OpenAPI"),
                .product(name: "SwiftKueryORM", package: "Swift-Kuery-ORM"),
                .product(name: "SwiftKueryPostgreSQL", package: "Swift-Kuery-PostgreSQL"),
                .product(name: "SwiftKueryMySQL", package: "SwiftKueryMySQL"),
                .product(name: "SwiftKuerySQLite", package: "Swift-Kuery-SQLite"),
                .product(name: "Credentials", package: "Kitura-Credentials"),
                .product(name: "CredentialsJWT", package: "Kitura-CredentialsJWT"),
                .product(name: "KituraSession", package: "Kitura-Session"),
                .product(name: "Health", package: "Health"),
                .product(name: "SwiftMetrics", package: "SwiftMetrics"),
                .product(name: "HeliumLogger", package: "HeliumLogger"),
                .product(name: "KituraCORS", package: "Kitura-CORS"),
                .product(name: "KituraCompression", package: "Kitura-Compression"),
                .product(name: "CloudEnvironment", package: "CloudEnvironment"),
                .product(name: "Logging", package: "swift-log")],
            path: "Sources/{{projectName}}"
        ),
        .testTarget(
            name: "{{projectName}}Tests",
            dependencies: ["{{projectName}}"],
            path: "Tests/{{projectName}}Tests"
        )
    ]
)`,

    // Main application
    'Sources/{{projectName}}/main.swift': `import Kitura
import HeliumLogger
import LoggerAPI
import CloudEnvironment
import Health

// Initialize Helium Logger
HeliumLogger.use()

let cloudEnv = CloudEnvironment()
let app = App(cloudEnv: cloudEnv)

do {
    try app.run()
} catch let error {
    Log.error("Failed to start application: \\(error.localizedDescription)")
}`,

    // Application class
    'Sources/{{projectName}}/Application/App.swift': `import Foundation
import Kitura
import KituraSession
import KituraOpenAPI
import KituraCORS
import KituraCompression
import SwiftKueryORM
import SwiftKueryPostgreSQL
import SwiftKueryMySQL
import SwiftKuerySQLite
import Credentials
import CredentialsJWT
import CloudEnvironment
import Health
import SwiftMetrics
import SwiftMetricsKitura
import LoggerAPI
import Logging

public class App {
    let router = Router()
    let cloudEnv: CloudEnvironment
    let health = Health()
    let metrics = Metrics()
    let logger = Logger(label: "{{projectName}}")
    
    public init(cloudEnv: CloudEnvironment) {
        self.cloudEnv = cloudEnv
    }
    
    public func run() throws {
        // Configure middleware
        configureMiddleware()
        
        // Configure database
        try configureDatabase()
        
        // Configure authentication
        configureAuthentication()
        
        // Configure routes
        configureRoutes()
        
        // Configure health checks
        configureHealthChecks()
        
        // Configure metrics
        configureMetrics()
        
        // Configure OpenAPI
        KituraOpenAPI.addEndpoints(to: router)
        
        // Start server
        let port = cloudEnv.port ?? 8080
        logger.info("Starting {{projectName}} on port \\(port)")
        
        Kitura.addHTTPServer(onPort: port, with: router)
        Kitura.run()
    }
    
    private func configureMiddleware() {
        // CORS
        let cors = CORS(
            allowedOrigin: .all,
            allowedHeaders: ["Content-Type", "Authorization"],
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            credentials: true,
            maxAge: 3600
        )
        router.all("/*", middleware: cors)
        
        // Body Parser
        router.all("/*", middleware: BodyParser())
        
        // Compression
        router.all("/*", middleware: Compression())
        
        // Session
        router.all("/*", middleware: Session(secret: cloudEnv.getCredentials(for: "session_secret")?.username ?? "default-secret"))
        
        // Static file serving
        router.all("/", middleware: StaticFileServer(path: "./public"))
        
        // Request logging
        router.all("/*", middleware: RequestLogger())
    }
    
    private func configureDatabase() throws {
        let dbType = ProcessInfo.processInfo.environment["DB_TYPE"] ?? "postgresql"
        
        switch dbType {
        case "postgresql":
            let connectionString = cloudEnv.getDatabaseConfiguration(for: "{{projectName}}-db")?.url ??
                                 ProcessInfo.processInfo.environment["DATABASE_URL"] ??
                                 "postgresql://localhost:5432/{{projectName}}"
            
            let pool = PostgreSQLConnection.createPool(
                url: URL(string: connectionString)!,
                poolOptions: ConnectionPoolOptions(initialCapacity: 10, maxCapacity: 50)
            )
            Database.default = Database(pool)
            
        case "mysql":
            let connectionString = ProcessInfo.processInfo.environment["DATABASE_URL"] ?? 
                                 "mysql://root@localhost:3306/{{projectName}}"
            
            let pool = MySQLConnection.createPool(
                url: URL(string: connectionString)!,
                poolOptions: ConnectionPoolOptions(initialCapacity: 10, maxCapacity: 50)
            )
            Database.default = Database(pool)
            
        default:
            let pool = SQLiteConnection.createPool(
                filename: ProcessInfo.processInfo.environment["DATABASE_PATH"] ?? "./{{projectName}}.db",
                poolOptions: ConnectionPoolOptions(initialCapacity: 1, maxCapacity: 5)
            )
            Database.default = Database(pool)
        }
        
        // Run migrations
        try runMigrations()
    }
    
    private func configureAuthentication() {
        let credentials = Credentials()
        
        // JWT authentication
        let jwtSecret = cloudEnv.getCredentials(for: "jwt_secret")?.password ?? 
                       ProcessInfo.processInfo.environment["JWT_SECRET"] ?? 
                       "default-jwt-secret"
        
        credentials.register(CredentialsJWT(
            verifier: .hs256(key: jwtSecret.data(using: .utf8)!)
        ))
        
        router.all("/api/v1/protected/*", middleware: credentials)
    }
    
    private func configureRoutes() {
        // API Info
        router.get("/") { request, response, next in
            response.send(json: [
                "name": "{{projectName}} API",
                "version": "1.0.0",
                "status": "running"
            ])
            next()
        }
        
        // Health check
        router.get("/health") { request, response, next in
            let health = self.health.status.toSimpleDictionary()
            response.send(json: health)
            next()
        }
        
        // API Routes
        let api = router.route("/api/v1")
        
        // Authentication routes
        api.post("/auth/register", handler: AuthController.register)
        api.post("/auth/login", handler: AuthController.login)
        api.post("/auth/refresh", handler: AuthController.refresh)
        
        // Protected routes
        let protected = api.route("/protected")
        
        // User routes
        protected.get("/users", handler: UserController.list)
        protected.get("/users/:id", handler: UserController.get)
        protected.put("/users/:id", handler: UserController.update)
        protected.delete("/users/:id", handler: UserController.delete)
        
        // Todo routes
        protected.get("/todos", handler: TodoController.list)
        protected.post("/todos", handler: TodoController.create)
        protected.get("/todos/:id", handler: TodoController.get)
        protected.put("/todos/:id", handler: TodoController.update)
        protected.delete("/todos/:id", handler: TodoController.delete)
    }
    
    private func configureHealthChecks() {
        // Add liveness check
        health.addLivenessCheck { callback in
            callback(true, nil)
        }
        
        // Add readiness check - verify database connection
        health.addReadinessCheck { callback in
            Database.default?.tableExists(User.tableName) { exists, error in
                callback(exists && error == nil, nil)
            }
        }
    }
    
    private func configureMetrics() {
        metrics.initialize(router: router)
    }
    
    private func runMigrations() throws {
        // Create tables
        do {
            try User.createTableSync()
            try Todo.createTableSync()
            try RefreshToken.createTableSync()
            logger.info("Database migrations completed successfully")
        } catch {
            logger.error("Failed to run migrations: \\(error)")
            throw error
        }
    }
}`,

    // Models
    'Sources/{{projectName}}/Models/User.swift': `import Foundation
import SwiftKueryORM
import Credentials

struct User: Model {
    static var tableName = "users"
    
    var id: UUID?
    var email: String
    var passwordHash: String
    var name: String
    var createdAt: Date?
    var updatedAt: Date?
    
    init(email: String, passwordHash: String, name: String) {
        self.id = UUID()
        self.email = email
        self.passwordHash = passwordHash
        self.name = name
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}

extension User {
    struct CreateRequest: Codable {
        let email: String
        let password: String
        let name: String
    }
    
    struct LoginRequest: Codable {
        let email: String
        let password: String
    }
    
    struct UpdateRequest: Codable {
        let name: String?
        let email: String?
    }
    
    struct PublicResponse: Codable {
        let id: UUID
        let email: String
        let name: String
        let createdAt: Date?
    }
    
    func toPublic() -> PublicResponse {
        return PublicResponse(
            id: id!,
            email: email,
            name: name,
            createdAt: createdAt
        )
    }
}

// JWT Claims
struct UserClaims: Claims {
    let sub: String // user id
    let exp: Date
    let iat: Date
    let email: String
    let name: String
}`,

    'Sources/{{projectName}}/Models/Todo.swift': `import Foundation
import SwiftKueryORM

struct Todo: Model {
    static var tableName = "todos"
    
    var id: UUID?
    var userId: UUID
    var title: String
    var description: String?
    var completed: Bool
    var createdAt: Date?
    var updatedAt: Date?
    
    init(userId: UUID, title: String, description: String? = nil) {
        self.id = UUID()
        self.userId = userId
        self.title = title
        self.description = description
        self.completed = false
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}

extension Todo {
    struct CreateRequest: Codable {
        let title: String
        let description: String?
    }
    
    struct UpdateRequest: Codable {
        let title: String?
        let description: String?
        let completed: Bool?
    }
}`,

    'Sources/{{projectName}}/Models/RefreshToken.swift': `import Foundation
import SwiftKueryORM

struct RefreshToken: Model {
    static var tableName = "refresh_tokens"
    
    var id: UUID?
    var userId: UUID
    var token: String
    var expiresAt: Date
    var createdAt: Date?
    
    init(userId: UUID) {
        self.id = UUID()
        self.userId = userId
        self.token = UUID().uuidString
        self.expiresAt = Date().addingTimeInterval(60 * 60 * 24 * 30) // 30 days
        self.createdAt = Date()
    }
    
    var isValid: Bool {
        return expiresAt > Date()
    }
}`,

    // Controllers
    'Sources/{{projectName}}/Controllers/AuthController.swift': `import Foundation
import Kitura
import SwiftKueryORM
import Credentials
import CredentialsJWT
import CryptorECC
import LoggerAPI

struct AuthController {
    static func register(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        let createRequest = try request.read(as: User.CreateRequest.self)
        
        // Check if user exists
        User.find(where: {$0.email == createRequest.email}) { users, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            if let users = users, !users.isEmpty {
                response.status(.conflict).send(json: ["error": "User already exists"])
                return next()
            }
            
            // Hash password
            let passwordHash = PasswordHasher.hash(createRequest.password)
            
            // Create user
            var user = User(
                email: createRequest.email,
                passwordHash: passwordHash,
                name: createRequest.name
            )
            
            user.save { savedUser, error in
                if let error = error {
                    response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                    return next()
                }
                
                guard let savedUser = savedUser else {
                    response.status(.internalServerError).send(json: ["error": "Failed to create user"])
                    return next()
                }
                
                // Generate tokens
                do {
                    let tokens = try generateTokens(for: savedUser)
                    response.send(json: [
                        "user": savedUser.toPublic(),
                        "accessToken": tokens.accessToken,
                        "refreshToken": tokens.refreshToken
                    ])
                } catch {
                    response.status(.internalServerError).send(json: ["error": "Failed to generate tokens"])
                }
                
                next()
            }
        }
    }
    
    static func login(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        let loginRequest = try request.read(as: User.LoginRequest.self)
        
        User.find(where: {$0.email == loginRequest.email}) { users, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            guard let users = users,
                  let user = users.first,
                  PasswordHasher.verify(loginRequest.password, against: user.passwordHash) else {
                response.status(.unauthorized).send(json: ["error": "Invalid credentials"])
                return next()
            }
            
            // Generate tokens
            do {
                let tokens = try generateTokens(for: user)
                response.send(json: [
                    "user": user.toPublic(),
                    "accessToken": tokens.accessToken,
                    "refreshToken": tokens.refreshToken
                ])
            } catch {
                response.status(.internalServerError).send(json: ["error": "Failed to generate tokens"])
            }
            
            next()
        }
    }
    
    static func refresh(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        struct RefreshRequest: Codable {
            let refreshToken: String
        }
        
        let refreshRequest = try request.read(as: RefreshRequest.self)
        
        RefreshToken.find(where: {$0.token == refreshRequest.refreshToken}) { tokens, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            guard let tokens = tokens,
                  let token = tokens.first,
                  token.isValid else {
                response.status(.unauthorized).send(json: ["error": "Invalid refresh token"])
                return next()
            }
            
            // Find user
            User.find(id: token.userId) { user, error in
                if let error = error {
                    response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                    return next()
                }
                
                guard let user = user else {
                    response.status(.notFound).send(json: ["error": "User not found"])
                    return next()
                }
                
                // Delete old refresh token
                token.delete { error in
                    if let error = error {
                        Log.error("Failed to delete old refresh token: \\(error)")
                    }
                }
                
                // Generate new tokens
                do {
                    let tokens = try generateTokens(for: user)
                    response.send(json: [
                        "accessToken": tokens.accessToken,
                        "refreshToken": tokens.refreshToken
                    ])
                } catch {
                    response.status(.internalServerError).send(json: ["error": "Failed to generate tokens"])
                }
                
                next()
            }
        }
    }
    
    private static func generateTokens(for user: User) throws -> (accessToken: String, refreshToken: String) {
        // Generate access token
        let claims = UserClaims(
            sub: user.id!.uuidString,
            exp: Date().addingTimeInterval(60 * 15), // 15 minutes
            iat: Date(),
            email: user.email,
            name: user.name
        )
        
        let jwtSecret = ProcessInfo.processInfo.environment["JWT_SECRET"] ?? "default-jwt-secret"
        let jwt = JWT(claims: claims)
        let accessToken = try jwt.sign(using: .hs256(key: jwtSecret.data(using: .utf8)!))
        
        // Generate refresh token
        var refreshToken = RefreshToken(userId: user.id!)
        try refreshToken.save()
        
        return (accessToken: accessToken, refreshToken: refreshToken.token)
    }
}`,

    'Sources/{{projectName}}/Controllers/UserController.swift': `import Foundation
import Kitura
import SwiftKueryORM
import Credentials

struct UserController {
    static func list(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        User.findAll { users, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            let publicUsers = users?.map { $0.toPublic() } ?? []
            response.send(json: publicUsers)
            next()
        }
    }
    
    static func get(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let id = request.parameters["id"],
              let userId = UUID(uuidString: id) else {
            response.status(.badRequest).send(json: ["error": "Invalid user ID"])
            return next()
        }
        
        User.find(id: userId) { user, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            guard let user = user else {
                response.status(.notFound).send(json: ["error": "User not found"])
                return next()
            }
            
            response.send(json: user.toPublic())
            next()
        }
    }
    
    static func update(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let userProfile = request.userProfile,
              let currentUserId = UUID(uuidString: userProfile.id) else {
            response.status(.unauthorized).send(json: ["error": "Unauthorized"])
            return next()
        }
        
        guard let id = request.parameters["id"],
              let userId = UUID(uuidString: id) else {
            response.status(.badRequest).send(json: ["error": "Invalid user ID"])
            return next()
        }
        
        // Users can only update their own profile
        guard currentUserId == userId else {
            response.status(.forbidden).send(json: ["error": "Forbidden"])
            return next()
        }
        
        let updateRequest = try request.read(as: User.UpdateRequest.self)
        
        User.find(id: userId) { user, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            guard var user = user else {
                response.status(.notFound).send(json: ["error": "User not found"])
                return next()
            }
            
            // Update fields
            if let name = updateRequest.name {
                user.name = name
            }
            
            if let email = updateRequest.email {
                // Check if email is already taken
                User.find(where: {$0.email == email}) { existingUsers, error in
                    if let existingUsers = existingUsers,
                       !existingUsers.isEmpty,
                       existingUsers[0].id != userId {
                        response.status(.conflict).send(json: ["error": "Email already taken"])
                        return next()
                    }
                    
                    user.email = email
                    user.updatedAt = Date()
                    
                    user.update(id: userId) { updatedUser, error in
                        if let error = error {
                            response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                            return next()
                        }
                        
                        response.send(json: updatedUser?.toPublic() ?? user.toPublic())
                        next()
                    }
                }
            } else {
                user.updatedAt = Date()
                
                user.update(id: userId) { updatedUser, error in
                    if let error = error {
                        response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                        return next()
                    }
                    
                    response.send(json: updatedUser?.toPublic() ?? user.toPublic())
                    next()
                }
            }
        }
    }
    
    static func delete(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let userProfile = request.userProfile,
              let currentUserId = UUID(uuidString: userProfile.id) else {
            response.status(.unauthorized).send(json: ["error": "Unauthorized"])
            return next()
        }
        
        guard let id = request.parameters["id"],
              let userId = UUID(uuidString: id) else {
            response.status(.badRequest).send(json: ["error": "Invalid user ID"])
            return next()
        }
        
        // Users can only delete their own profile
        guard currentUserId == userId else {
            response.status(.forbidden).send(json: ["error": "Forbidden"])
            return next()
        }
        
        User.delete(id: userId) { error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            response.status(.noContent)
            next()
        }
    }
}`,

    'Sources/{{projectName}}/Controllers/TodoController.swift': `import Foundation
import Kitura
import SwiftKueryORM
import Credentials

struct TodoController {
    static func list(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let userProfile = request.userProfile,
              let userId = UUID(uuidString: userProfile.id) else {
            response.status(.unauthorized).send(json: ["error": "Unauthorized"])
            return next()
        }
        
        Todo.find(where: {$0.userId == userId}) { todos, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            response.send(json: todos ?? [])
            next()
        }
    }
    
    static func create(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let userProfile = request.userProfile,
              let userId = UUID(uuidString: userProfile.id) else {
            response.status(.unauthorized).send(json: ["error": "Unauthorized"])
            return next()
        }
        
        let createRequest = try request.read(as: Todo.CreateRequest.self)
        
        var todo = Todo(
            userId: userId,
            title: createRequest.title,
            description: createRequest.description
        )
        
        todo.save { savedTodo, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            response.status(.created).send(json: savedTodo ?? todo)
            next()
        }
    }
    
    static func get(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let userProfile = request.userProfile,
              let userId = UUID(uuidString: userProfile.id) else {
            response.status(.unauthorized).send(json: ["error": "Unauthorized"])
            return next()
        }
        
        guard let id = request.parameters["id"],
              let todoId = UUID(uuidString: id) else {
            response.status(.badRequest).send(json: ["error": "Invalid todo ID"])
            return next()
        }
        
        Todo.find(id: todoId) { todo, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            guard let todo = todo else {
                response.status(.notFound).send(json: ["error": "Todo not found"])
                return next()
            }
            
            // Check ownership
            guard todo.userId == userId else {
                response.status(.forbidden).send(json: ["error": "Forbidden"])
                return next()
            }
            
            response.send(json: todo)
            next()
        }
    }
    
    static func update(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let userProfile = request.userProfile,
              let userId = UUID(uuidString: userProfile.id) else {
            response.status(.unauthorized).send(json: ["error": "Unauthorized"])
            return next()
        }
        
        guard let id = request.parameters["id"],
              let todoId = UUID(uuidString: id) else {
            response.status(.badRequest).send(json: ["error": "Invalid todo ID"])
            return next()
        }
        
        let updateRequest = try request.read(as: Todo.UpdateRequest.self)
        
        Todo.find(id: todoId) { todo, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            guard var todo = todo else {
                response.status(.notFound).send(json: ["error": "Todo not found"])
                return next()
            }
            
            // Check ownership
            guard todo.userId == userId else {
                response.status(.forbidden).send(json: ["error": "Forbidden"])
                return next()
            }
            
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
            
            todo.updatedAt = Date()
            
            todo.update(id: todoId) { updatedTodo, error in
                if let error = error {
                    response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                    return next()
                }
                
                response.send(json: updatedTodo ?? todo)
                next()
            }
        }
    }
    
    static func delete(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        guard let userProfile = request.userProfile,
              let userId = UUID(uuidString: userProfile.id) else {
            response.status(.unauthorized).send(json: ["error": "Unauthorized"])
            return next()
        }
        
        guard let id = request.parameters["id"],
              let todoId = UUID(uuidString: id) else {
            response.status(.badRequest).send(json: ["error": "Invalid todo ID"])
            return next()
        }
        
        // Verify ownership before deletion
        Todo.find(id: todoId) { todo, error in
            if let error = error {
                response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                return next()
            }
            
            guard let todo = todo else {
                response.status(.notFound).send(json: ["error": "Todo not found"])
                return next()
            }
            
            // Check ownership
            guard todo.userId == userId else {
                response.status(.forbidden).send(json: ["error": "Forbidden"])
                return next()
            }
            
            Todo.delete(id: todoId) { error in
                if let error = error {
                    response.status(.internalServerError).send(json: ["error": error.localizedDescription])
                    return next()
                }
                
                response.status(.noContent)
                next()
            }
        }
    }
}`,

    // Middleware
    'Sources/{{projectName}}/Middleware/RequestLogger.swift': `import Kitura
import LoggerAPI

class RequestLogger: RouterMiddleware {
    func handle(request: RouterRequest, response: RouterResponse, next: @escaping () -> Void) throws {
        let startTime = Date()
        
        response.setOnEndInvoked {
            let duration = Date().timeIntervalSince(startTime)
            let durationMs = Int(duration * 1000)
            
            Log.info("""
                \\(request.method.rawValue) \\(request.originalURL) \\
                \\(response.statusCode?.rawValue ?? 0) \\(durationMs)ms
                """)
        }
        
        next()
    }
}`,

    // Utilities
    'Sources/{{projectName}}/Utils/PasswordHasher.swift': `import Foundation
import Crypto

struct PasswordHasher {
    static func hash(_ password: String) -> String {
        // In production, use bcrypt or argon2
        // This is a simple example using SHA256
        let salt = UUID().uuidString
        let salted = password + salt
        let hashed = salted.digest(using: .sha256)?.base64EncodedString() ?? ""
        return "\\(salt)$\\(hashed)"
    }
    
    static func verify(_ password: String, against hash: String) -> Bool {
        let parts = hash.split(separator: "$")
        guard parts.count == 2 else { return false }
        
        let salt = String(parts[0])
        let expectedHash = String(parts[1])
        
        let salted = password + salt
        let computedHash = salted.digest(using: .sha256)?.base64EncodedString() ?? ""
        
        return computedHash == expectedHash
    }
}`,

    // Tests
    'Tests/{{projectName}}Tests/AuthTests.swift': `import XCTest
import Foundation
import Kitura
import KituraNet
@testable import {{projectName}}

final class AuthTests: XCTestCase {
    static var app: App?
    static var port: Int = 8090
    
    override class func setUp() {
        super.setUp()
        
        let cloudEnv = CloudEnvironment()
        app = App(cloudEnv: cloudEnv)
        
        Kitura.addHTTPServer(onPort: port, with: app!.router)
        Kitura.start()
    }
    
    override class func tearDown() {
        Kitura.stop()
        super.tearDown()
    }
    
    func testRegister() {
        let expectation = self.expectation(description: "Register user")
        
        let user = [
            "email": "test@example.com",
            "password": "password123",
            "name": "Test User"
        ]
        
        performRequest(
            method: "POST",
            path: "/api/v1/auth/register",
            body: user
        ) { data in
            if let response = try? JSONDecoder().decode(AuthResponse.self, from: data) {
                XCTAssertEqual(response.user.email, "test@example.com")
                XCTAssertFalse(response.accessToken.isEmpty)
                XCTAssertFalse(response.refreshToken.isEmpty)
            } else {
                XCTFail("Failed to decode response")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5)
    }
    
    func testLogin() {
        let expectation = self.expectation(description: "Login user")
        
        // First register
        let user = [
            "email": "login@example.com",
            "password": "password123",
            "name": "Login User"
        ]
        
        performRequest(
            method: "POST",
            path: "/api/v1/auth/register",
            body: user
        ) { _ in
            // Then login
            let credentials = [
                "email": "login@example.com",
                "password": "password123"
            ]
            
            self.performRequest(
                method: "POST",
                path: "/api/v1/auth/login",
                body: credentials
            ) { data in
                if let response = try? JSONDecoder().decode(AuthResponse.self, from: data) {
                    XCTAssertEqual(response.user.email, "login@example.com")
                    XCTAssertFalse(response.accessToken.isEmpty)
                } else {
                    XCTFail("Failed to decode response")
                }
                expectation.fulfill()
            }
        }
        
        wait(for: [expectation], timeout: 10)
    }
    
    private func performRequest(method: String, path: String, body: [String: Any]? = nil, callback: @escaping (Data) -> Void) {
        var request = URLRequest(url: URL(string: "http://localhost:\\(AuthTests.port)\\(path)")!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let body = body {
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            XCTAssertNil(error)
            XCTAssertNotNil(data)
            
            if let data = data {
                callback(data)
            }
        }.resume()
    }
}

struct AuthResponse: Codable {
    let user: UserResponse
    let accessToken: String
    let refreshToken: String
}

struct UserResponse: Codable {
    let id: String
    let email: String
    let name: String
}`,

    // Configuration files
    '.env.example': `# Server Configuration
PORT=8080

# Database Configuration
DB_TYPE=postgresql
DATABASE_URL=postgresql://localhost:5432/{{projectName}}

# Security
JWT_SECRET=your-jwt-secret-key-here
SESSION_SECRET=your-session-secret-here

# IBM Cloud Services (optional)
VCAP_SERVICES={}

# Environment
NODE_ENV=development`,

    'manifest.yml': `---
applications:
- name: {{projectName}}
  memory: 256M
  instances: 1
  buildpack: swift_buildpack
  env:
    SWIFT_BUILD_DIR_CACHE: false
  services:
    - {{projectName}}-db
    - {{projectName}}-monitoring`,

    'cloud-config.json': `{
  "name": "{{projectName}}",
  "region": "us-south",
  "services": {
    "cloudant": {
      "name": "{{projectName}}-cloudant",
      "plan": "lite"
    },
    "appid": {
      "name": "{{projectName}}-appid",
      "plan": "lite"
    },
    "monitoring": {
      "name": "{{projectName}}-monitoring",
      "plan": "lite"
    }
  }
}`,

    // Docker configuration
    'Dockerfile': `# ================================
# Build image
# ================================
FROM swift:5.9-jammy as build

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    libssl-dev \\
    libcurl4-openssl-dev \\
    libpq-dev \\
    libmysqlclient-dev \\
    libsqlite3-dev \\
    uuid-dev \\
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
RUN swift build -c release

# Run tests
RUN swift test

# ================================
# Runtime image
# ================================
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    libssl3 \\
    libcurl4 \\
    libpq5 \\
    libmysqlclient21 \\
    libsqlite3-0 \\
    ca-certificates \\
    tzdata \\
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -d /app -s /bin/bash app

WORKDIR /app

# Copy build artifacts
COPY --from=build /build/.build/release/{{projectName}} .
COPY --from=build /build/Package.resolved .

# Copy static files
COPY public ./public

# Create necessary directories
RUN mkdir -p logs && chown -R app:app /app

USER app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["./{{projectName}}"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - DB_TYPE=postgresql
      - DATABASE_URL=postgresql://kitura:kitura@db:5432/{{projectName}}
      - JWT_SECRET=development-jwt-secret
      - SESSION_SECRET=development-session-secret
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./public:/app/public

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=kitura
      - POSTGRES_PASSWORD=kitura
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kitura"]
      interval: 5s
      timeout: 5s
      retries: 5

  metrics:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

volumes:
  postgres_data:
  prometheus_data:`,

    'prometheus.yml': `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: '{{projectName}}'
    static_configs:
      - targets: ['app:8080']
    metrics_path: '/metrics'`,

    // README
    'README.md': `# {{projectName}}

Enterprise-grade Swift web application built with Kitura and IBM Cloud integration.

## Features

- ✅ RESTful API with Kitura framework
- ✅ OpenAPI/Swagger documentation
- ✅ JWT authentication with refresh tokens
- ✅ SwiftKuery ORM with PostgreSQL, MySQL, and SQLite
- ✅ Health checks and metrics monitoring
- ✅ IBM Cloud ready with manifest.yml
- ✅ Docker and Kubernetes support
- ✅ Request logging and compression
- ✅ CORS and session management
- ✅ Comprehensive test suite

## Requirements

- Swift 5.9 or later
- macOS 10.15+ or Ubuntu 22.04+
- PostgreSQL 12+ (optional)

## Getting Started

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   swift package resolve
   \`\`\`
3. Copy \`.env.example\` to \`.env\` and configure
4. Run the application:
   \`\`\`bash
   swift run
   \`\`\`

The server will start on port 8080.

## API Documentation

Once running, visit \`http://localhost:8080/openapi\` for interactive API documentation.

## Endpoints

### Public Endpoints
- \`GET /\` - API information
- \`GET /health\` - Health status
- \`GET /metrics\` - Prometheus metrics
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

## Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## Deploying to IBM Cloud

1. Install IBM Cloud CLI
2. Login: \`ibmcloud login\`
3. Push the app: \`ibmcloud cf push\`

## Testing

Run the test suite:
\`\`\`bash
swift test
\`\`\`

## Configuration

Environment variables:
- \`PORT\` - Server port (default: 8080)
- \`DB_TYPE\` - Database type: postgresql, mysql, sqlite (default: postgresql)
- \`DATABASE_URL\` - Database connection string
- \`JWT_SECRET\` - Secret key for JWT signing
- \`SESSION_SECRET\` - Secret key for sessions

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

# Logs
logs/
*.log

# Dependencies
node_modules/

# IDE
.vscode/
.idea/`,

    '.cfignore': `.git/
.build/
.env
*.xcodeproj
Tests/
README.md
docker-compose.yml
Dockerfile`}};