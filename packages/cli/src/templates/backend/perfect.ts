import { BackendTemplate } from '../types';

export const perfectTemplate: BackendTemplate = {
  id: 'perfect',
  name: 'perfect',
  displayName: 'Perfect Framework',
  description: 'High-performance server-side Swift framework with HTTP, WebSocket, and database support',
  language: 'swift',
  framework: 'perfect',
  version: '4.0.0',
  tags: ['swift', 'perfect', 'api', 'rest', 'websockets', 'performance'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'websockets', 'database', 'logging', 'cors', 'security'],
  
  files: {
    // Swift Package Manager configuration
    'Package.swift': `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "{{projectName}}",
    platforms: [
        .macOS(.v12)],
    products: [
        .executable(name: "{{projectName}}", targets: ["{{projectName}}"])],
    dependencies: [
        .package(url: "https://github.com/PerfectlySoft/Perfect-HTTPServer.git", from: "3.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-WebSockets.git", from: "3.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-Mustache.git", from: "3.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-PostgreSQL.git", from: "5.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-MySQL.git", from: "5.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-SQLite.git", from: "5.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-Crypto.git", from: "3.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-RequestLogger.git", from: "3.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-Session.git", from: "3.0.0"),
        .package(url: "https://github.com/PerfectlySoft/Perfect-SessionPostgreSQL.git", from: "3.0.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.5.3")],
    targets: [
        .executableTarget(
            name: "{{projectName}}",
            dependencies: [
                .product(name: "PerfectHTTPServer", package: "Perfect-HTTPServer"),
                .product(name: "PerfectWebSockets", package: "Perfect-WebSockets"),
                .product(name: "PerfectMustache", package: "Perfect-Mustache"),
                .product(name: "PerfectPostgreSQL", package: "Perfect-PostgreSQL"),
                .product(name: "PerfectMySQL", package: "Perfect-MySQL"),
                .product(name: "PerfectSQLite", package: "Perfect-SQLite"),
                .product(name: "PerfectCrypto", package: "Perfect-Crypto"),
                .product(name: "PerfectRequestLogger", package: "Perfect-RequestLogger"),
                .product(name: "PerfectSession", package: "Perfect-Session"),
                .product(name: "PerfectSessionPostgreSQL", package: "Perfect-SessionPostgreSQL"),
                .product(name: "Logging", package: "swift-log")],
            path: "Sources"
        ),
        .testTarget(
            name: "{{projectName}}Tests",
            dependencies: ["{{projectName}}"],
            path: "Tests"
        )]
)`,

    // Main entry point
    'Sources/main.swift': `import PerfectHTTP
import PerfectHTTPServer
import PerfectWebSockets
import PerfectSession
import PerfectSessionPostgreSQL
import PerfectRequestLogger
import Logging

// Initialize logger
let logger = Logger(label: "{{projectName}}")

// Load configuration
let config = Configuration.load()

// Configure server
let server = HTTPServer()
server.serverPort = config.port
server.serverAddress = config.host

// Configure sessions
let sessionDriver = SessionPostgreSQLDriver()
SessionConfig.name = "{{projectName}}-session"
SessionConfig.idle = config.sessionTimeout
SessionConfig.cookieDomain = config.cookieDomain
SessionConfig.IPAddressLock = true
SessionConfig.userAgentLock = true
SessionConfig.CSRF.checkState = true
SessionConfig.CSRF.failAction = .fail
SessionConfig.CSRF.checkHeaders = true
SessionConfig.CSRF.acceptableHostnames.append(config.host)

// Configure request logger
let requestLogger = RequestLogger()

// Configure routes
var routes = Routes()

// Apply middleware
routes.add(method: .get, uri: "/**", handler: requestLogger.handler)
routes.add(method: .post, uri: "/**", handler: requestLogger.handler)
routes.add(method: .put, uri: "/**", handler: requestLogger.handler)
routes.add(method: .delete, uri: "/**", handler: requestLogger.handler)

// Add CORS middleware
routes.add(method: .options, uri: "/**", handler: CORSHandler.handler)

// Setup routes
setupRoutes(&routes)

// Add routes to server
server.addRoutes(routes)

// Configure SSL if enabled
if config.useSSL {
    server.ssl = (config.sslCertPath, config.sslKeyPath)
}

// Configure filters
let requestFilters: [(HTTPRequestFilter, HTTPFilterPriority)] = [
    (SessionRequestFilter(), .high),
    (AuthenticationFilter(), .medium),
    (ValidationFilter(), .low)
]

let responseFilters: [(HTTPResponseFilter, HTTPFilterPriority)] = [
    (SessionResponseFilter(), .high),
    (CompressionFilter(), .medium),
    (ErrorHandlerFilter(), .low)
]

server.setRequestFilters(requestFilters)
server.setResponseFilters(responseFilters)

// Start server
do {
    logger.info("Starting {{projectName}} server on \\(config.host):\\(config.port)")
    try server.start()
} catch {
    logger.error("Failed to start server: \\(error)")
}`,

    // Configuration
    'Sources/Configuration.swift': `import Foundation
import PerfectLib

struct Configuration {
    let host: String
    let port: UInt16
    let databaseURL: String
    let useSSL: Bool
    let sslCertPath: String
    let sslKeyPath: String
    let sessionTimeout: Int
    let cookieDomain: String
    let jwtSecret: String
    
    static func load() -> Configuration {
        // Load from environment or config file
        let host = ProcessInfo.processInfo.environment["HOST"] ?? "0.0.0.0"
        let port = UInt16(ProcessInfo.processInfo.environment["PORT"] ?? "8080") ?? 8080
        let databaseURL = ProcessInfo.processInfo.environment["DATABASE_URL"] ?? "postgresql://localhost/{{projectName}}"
        let useSSL = ProcessInfo.processInfo.environment["USE_SSL"] == "true"
        let sslCertPath = ProcessInfo.processInfo.environment["SSL_CERT_PATH"] ?? "./cert.pem"
        let sslKeyPath = ProcessInfo.processInfo.environment["SSL_KEY_PATH"] ?? "./key.pem"
        let sessionTimeout = Int(ProcessInfo.processInfo.environment["SESSION_TIMEOUT"] ?? "86400") ?? 86400
        let cookieDomain = ProcessInfo.processInfo.environment["COOKIE_DOMAIN"] ?? ""
        let jwtSecret = ProcessInfo.processInfo.environment["JWT_SECRET"] ?? generateRandomSecret()
        
        return Configuration(
            host: host,
            port: port,
            databaseURL: databaseURL,
            useSSL: useSSL,
            sslCertPath: sslCertPath,
            sslKeyPath: sslKeyPath,
            sessionTimeout: sessionTimeout,
            cookieDomain: cookieDomain,
            jwtSecret: jwtSecret
        )
    }
    
    private static func generateRandomSecret() -> String {
        return UUID().uuidString + UUID().uuidString
    }
}`,

    // Routes
    'Sources/Routes.swift': `import PerfectHTTP
import PerfectWebSockets
import Logging

let routeLogger = Logger(label: "{{projectName}}.routes")

func setupRoutes(_ routes: inout Routes) {
    // Health check
    routes.add(method: .get, uri: "/health") { request, response in
        healthCheckHandler(request: request, response: response)
    }
    
    // API routes
    routes.add(method: .get, uri: "/api/v1") { request, response in
        response.setHeader(.contentType, value: "application/json")
        let info = [
            "name": "{{projectName}} API",
            "version": "1.0.0",
            "status": "running"
        ]
        try? response.setBody(json: info)
        response.completed()
    }
    
    // WebSocket endpoint
    routes.add(method: .get, uri: "/ws") { request, response in
        WebSocketHandler.handleRequest(request: request, response: response)
    }
    
    // Authentication routes
    routes.add(method: .post, uri: "/api/v1/auth/register") { request, response in
        AuthController.register(request: request, response: response)
    }
    
    routes.add(method: .post, uri: "/api/v1/auth/login") { request, response in
        AuthController.login(request: request, response: response)
    }
    
    routes.add(method: .post, uri: "/api/v1/auth/logout") { request, response in
        AuthController.logout(request: request, response: response)
    }
    
    // User routes (protected)
    routes.add(method: .get, uri: "/api/v1/users") { request, response in
        UserController.list(request: request, response: response)
    }
    
    routes.add(method: .get, uri: "/api/v1/users/{id}") { request, response in
        UserController.get(request: request, response: response)
    }
    
    routes.add(method: .put, uri: "/api/v1/users/{id}") { request, response in
        UserController.update(request: request, response: response)
    }
    
    routes.add(method: .delete, uri: "/api/v1/users/{id}") { request, response in
        UserController.delete(request: request, response: response)
    }
    
    // Todo routes (protected)
    routes.add(method: .get, uri: "/api/v1/todos") { request, response in
        TodoController.list(request: request, response: response)
    }
    
    routes.add(method: .post, uri: "/api/v1/todos") { request, response in
        TodoController.create(request: request, response: response)
    }
    
    routes.add(method: .get, uri: "/api/v1/todos/{id}") { request, response in
        TodoController.get(request: request, response: response)
    }
    
    routes.add(method: .put, uri: "/api/v1/todos/{id}") { request, response in
        TodoController.update(request: request, response: response)
    }
    
    routes.add(method: .delete, uri: "/api/v1/todos/{id}") { request, response in
        TodoController.delete(request: request, response: response)
    }
    
    // Static file handler
    routes.add(method: .get, uri: "/**") { request, response in
        StaticFileHandler(documentRoot: "./public").handleRequest(request: request, response: response)
    }
}

func healthCheckHandler(request: HTTPRequest, response: HTTPResponse) {
    let health = DatabaseManager.shared.checkHealth()
    
    response.setHeader(.contentType, value: "application/json")
    let status = [
        "status": health ? "healthy" : "unhealthy",
        "database": health,
        "timestamp": Date().timeIntervalSince1970
    ]
    
    try? response.setBody(json: status)
    response.completed(status: health ? .ok : .serviceUnavailable)
}`,

    // WebSocket Handler
    'Sources/Handlers/WebSocketHandler.swift': `import PerfectHTTP
import PerfectWebSockets
import Logging

class WebSocketHandler: WebSocketSessionHandler {
    let socketProtocol: String? = nil
    static let logger = Logger(label: "{{projectName}}.websocket")
    
    private var connections = [String: WebSocket]()
    
    static func handleRequest(request: HTTPRequest, response: HTTPResponse) {
        WebSocketHandler().handleRequest(request: request, response: response) {
            // Connection closed callback
            self.logger.info("WebSocket connection closed")
        }
    }
    
    func handleSession(request: HTTPRequest, socket: WebSocket) {
        let connectionId = UUID().uuidString
        connections[connectionId] = socket
        
        Self.logger.info("New WebSocket connection: \\(connectionId)")
        
        // Send welcome message
        let welcome = ["type": "welcome", "connectionId": connectionId]
        if let data = try? welcome.jsonEncodedString() {
            socket.sendStringMessage(string: data, final: true) {
                // Message sent
            }
        }
        
        // Handle incoming messages
        socket.readStringMessage { [weak self] string, opcode, final in
            guard let self = self, let message = string else {
                socket.close()
                return
            }
            
            self.handleMessage(message: message, socket: socket, connectionId: connectionId)
        }
    }
    
    private func handleMessage(message: String, socket: WebSocket, connectionId: String) {
        Self.logger.debug("Received message from \\(connectionId): \\(message)")
        
        // Parse and handle message
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }
        
        switch type {
        case "ping":
            let pong = ["type": "pong", "timestamp": Date().timeIntervalSince1970]
            if let response = try? pong.jsonEncodedString() {
                socket.sendStringMessage(string: response, final: true) {
                    // Pong sent
                }
            }
            
        case "broadcast":
            if let content = json["content"] as? String {
                broadcastMessage(content: content, from: connectionId)
            }
            
        case "echo":
            if let content = json["content"] as? String {
                let echo = ["type": "echo", "content": content]
                if let response = try? echo.jsonEncodedString() {
                    socket.sendStringMessage(string: response, final: true) {
                        // Echo sent
                    }
                }
            }
            
        default:
            Self.logger.warning("Unknown message type: \\(type)")
        }
        
        // Continue reading messages
        socket.readStringMessage { [weak self] string, _, _ in
            guard let self = self, let msg = string else {
                socket.close()
                return
            }
            self.handleMessage(message: msg, socket: socket, connectionId: connectionId)
        }
    }
    
    private func broadcastMessage(content: String, from connectionId: String) {
        let broadcast = [
            "type": "broadcast",
            "content": content,
            "from": connectionId,
            "timestamp": Date().timeIntervalSince1970
        ] as [String : Any]
        
        guard let message = try? broadcast.jsonEncodedString() else { return }
        
        for (id, socket) in connections where id != connectionId {
            socket.sendStringMessage(string: message, final: true) {
                // Message sent
            }
        }
    }
}`,

    // Database Manager
    'Sources/Database/DatabaseManager.swift': `import PerfectPostgreSQL
import PerfectMySQL
import PerfectSQLite
import Logging

class DatabaseManager {
    static let shared = DatabaseManager()
    private let logger = Logger(label: "{{projectName}}.database")
    
    private var postgresConnection: PGConnection?
    private var mysqlConnection: MySQL?
    private var sqliteConnection: SQLite?
    
    private let config = Configuration.load()
    
    private init() {
        setupDatabase()
    }
    
    private func setupDatabase() {
        if config.databaseURL.hasPrefix("postgresql://") {
            setupPostgreSQL()
        } else if config.databaseURL.hasPrefix("mysql://") {
            setupMySQL()
        } else {
            setupSQLite()
        }
        
        createTables()
    }
    
    private func setupPostgreSQL() {
        let connection = PGConnection()
        let status = connection.connectdb(config.databaseURL)
        
        if status == .ok {
            postgresConnection = connection
            logger.info("Connected to PostgreSQL database")
        } else {
            logger.error("Failed to connect to PostgreSQL: \\(connection.errorMessage())")
        }
    }
    
    private func setupMySQL() {
        // Parse MySQL connection string
        // Implementation depends on URL format
        let mysql = MySQL()
        mysqlConnection = mysql
        logger.info("MySQL connection configured")
    }
    
    private func setupSQLite() {
        do {
            let sqlite = try SQLite("./database.sqlite")
            sqliteConnection = sqlite
            logger.info("Connected to SQLite database")
        } catch {
            logger.error("Failed to connect to SQLite: \\(error)")
        }
    }
    
    private func createTables() {
        // Create users table
        let createUsers = """
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        
        // Create todos table
        let createTodos = """
            CREATE TABLE IF NOT EXISTS todos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        
        // Create sessions table
        let createSessions = """
            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        """
        
        execute(createUsers)
        execute(createTodos)
        execute(createSessions)
    }
    
    func execute(_ query: String, params: [Any] = []) -> PGResult? {
        guard let connection = postgresConnection else { return nil }
        return connection.exec(statement: query, params: params)
    }
    
    func checkHealth() -> Bool {
        if let connection = postgresConnection {
            return connection.status == .ok
        }
        return sqliteConnection != nil || mysqlConnection != nil
    }
}`,

    // Models
    'Sources/Models/User.swift': `import Foundation
import PerfectCrypto

struct User: Codable {
    let id: UUID
    let email: String
    let passwordHash: String
    let name: String
    let createdAt: Date
    let updatedAt: Date
    
    init(email: String, password: String, name: String) throws {
        self.id = UUID()
        self.email = email
        self.passwordHash = try BCrypt.hash(password)
        self.name = name
        self.createdAt = Date()
        self.updatedAt = Date()
    }
    
    func verifyPassword(_ password: String) throws -> Bool {
        return try BCrypt.verify(password, against: passwordHash)
    }
    
    func toPublic() -> PublicUser {
        return PublicUser(
            id: id,
            email: email,
            name: name,
            createdAt: createdAt
        )
    }
}

struct PublicUser: Codable {
    let id: UUID
    let email: String
    let name: String
    let createdAt: Date
}

extension User {
    static func find(by email: String) -> User? {
        let query = "SELECT * FROM users WHERE email = $1"
        guard let result = DatabaseManager.shared.execute(query, params: [email]),
              result.numTuples() > 0 else {
            return nil
        }
        
        return User.from(result: result, row: 0)
    }
    
    static func find(by id: UUID) -> User? {
        let query = "SELECT * FROM users WHERE id = $1"
        guard let result = DatabaseManager.shared.execute(query, params: [id.uuidString]),
              result.numTuples() > 0 else {
            return nil
        }
        
        return User.from(result: result, row: 0)
    }
    
    func save() throws {
        let query = """
            INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                updated_at = EXCLUDED.updated_at
        """
        
        _ = DatabaseManager.shared.execute(query, params: [
            id.uuidString,
            email,
            passwordHash,
            name,
            createdAt,
            updatedAt
        ])
    }
    
    private static func from(result: PGResult, row: Int) -> User? {
        guard let id = result.getFieldString(tupleIndex: row, fieldIndex: 0),
              let email = result.getFieldString(tupleIndex: row, fieldIndex: 1),
              let passwordHash = result.getFieldString(tupleIndex: row, fieldIndex: 2),
              let name = result.getFieldString(tupleIndex: row, fieldIndex: 3) else {
            return nil
        }
        
        // Parse dates - implementation depends on your date format
        let createdAt = Date()
        let updatedAt = Date()
        
        return User(
            id: UUID(uuidString: id) ?? UUID(),
            email: email,
            passwordHash: passwordHash,
            name: name,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}`,

    'Sources/Models/Todo.swift': `import Foundation

struct Todo: Codable {
    let id: UUID
    let userId: UUID
    let title: String
    let description: String?
    let completed: Bool
    let createdAt: Date
    let updatedAt: Date
    
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
    static func findAll(for userId: UUID) -> [Todo] {
        let query = "SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC"
        guard let result = DatabaseManager.shared.execute(query, params: [userId.uuidString]) else {
            return []
        }
        
        var todos: [Todo] = []
        for i in 0..<result.numTuples() {
            if let todo = Todo.from(result: result, row: i) {
                todos.append(todo)
            }
        }
        
        return todos
    }
    
    static func find(by id: UUID, userId: UUID) -> Todo? {
        let query = "SELECT * FROM todos WHERE id = $1 AND user_id = $2"
        guard let result = DatabaseManager.shared.execute(query, params: [id.uuidString, userId.uuidString]),
              result.numTuples() > 0 else {
            return nil
        }
        
        return Todo.from(result: result, row: 0)
    }
    
    func save() throws {
        let query = """
            INSERT INTO todos (id, user_id, title, description, completed, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                completed = EXCLUDED.completed,
                updated_at = EXCLUDED.updated_at
        """
        
        _ = DatabaseManager.shared.execute(query, params: [
            id.uuidString,
            userId.uuidString,
            title,
            description ?? NSNull(),
            completed,
            createdAt,
            updatedAt
        ])
    }
    
    func delete() throws {
        let query = "DELETE FROM todos WHERE id = $1"
        _ = DatabaseManager.shared.execute(query, params: [id.uuidString])
    }
    
    private static func from(result: PGResult, row: Int) -> Todo? {
        guard let id = result.getFieldString(tupleIndex: row, fieldIndex: 0),
              let userId = result.getFieldString(tupleIndex: row, fieldIndex: 1),
              let title = result.getFieldString(tupleIndex: row, fieldIndex: 2) else {
            return nil
        }
        
        let description = result.getFieldString(tupleIndex: row, fieldIndex: 3)
        let completed = result.getFieldBool(tupleIndex: row, fieldIndex: 4) ?? false
        
        return Todo(
            id: UUID(uuidString: id) ?? UUID(),
            userId: UUID(uuidString: userId) ?? UUID(),
            title: title,
            description: description,
            completed: completed,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}`,

    // Controllers
    'Sources/Controllers/AuthController.swift': `import PerfectHTTP
import PerfectCrypto
import Foundation

class AuthController {
    static func register(request: HTTPRequest, response: HTTPResponse) {
        guard let body = request.postBodyString,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let email = json["email"] as? String,
              let password = json["password"] as? String,
              let name = json["name"] as? String else {
            response.completed(status: .badRequest)
            return
        }
        
        // Check if user exists
        if User.find(by: email) != nil {
            response.setHeader(.contentType, value: "application/json")
            let error = ["error": "User already exists"]
            try? response.setBody(json: error)
            response.completed(status: .conflict)
            return
        }
        
        // Create user
        do {
            let user = try User(email: email, password: password, name: name)
            try user.save()
            
            // Create session
            request.session?.userid = user.id.uuidString
            
            // Return user
            response.setHeader(.contentType, value: "application/json")
            let result = [
                "user": user.toPublic(),
                "token": generateToken(for: user)
            ]
            try? response.setBody(json: result)
            response.completed()
        } catch {
            response.completed(status: .internalServerError)
        }
    }
    
    static func login(request: HTTPRequest, response: HTTPResponse) {
        guard let body = request.postBodyString,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let email = json["email"] as? String,
              let password = json["password"] as? String else {
            response.completed(status: .badRequest)
            return
        }
        
        // Find user
        guard let user = User.find(by: email),
              (try? user.verifyPassword(password)) == true else {
            response.setHeader(.contentType, value: "application/json")
            let error = ["error": "Invalid credentials"]
            try? response.setBody(json: error)
            response.completed(status: .unauthorized)
            return
        }
        
        // Create session
        request.session?.userid = user.id.uuidString
        
        // Return user
        response.setHeader(.contentType, value: "application/json")
        let result = [
            "user": user.toPublic(),
            "token": generateToken(for: user)
        ]
        try? response.setBody(json: result)
        response.completed()
    }
    
    static func logout(request: HTTPRequest, response: HTTPResponse) {
        request.session?.userid = nil
        response.completed()
    }
    
    private static func generateToken(for user: User) -> String {
        // Simple token generation - in production use JWT
        let payload = "\\(user.id.uuidString):\\(Date().timeIntervalSince1970)"
        return payload.digest(.sha256)?.encode(.base64url) ?? ""
    }
}`,

    'Sources/Controllers/UserController.swift': `import PerfectHTTP
import Foundation

class UserController {
    static func list(request: HTTPRequest, response: HTTPResponse) {
        // Check authentication
        guard let _ = request.session?.userid else {
            response.completed(status: .unauthorized)
            return
        }
        
        // For demo purposes, return empty array
        response.setHeader(.contentType, value: "application/json")
        try? response.setBody(json: [])
        response.completed()
    }
    
    static func get(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid,
              let userUUID = UUID(uuidString: userId),
              let user = User.find(by: userUUID) else {
            response.completed(status: .unauthorized)
            return
        }
        
        response.setHeader(.contentType, value: "application/json")
        try? response.setBody(json: user.toPublic())
        response.completed()
    }
    
    static func update(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid,
              let userUUID = UUID(uuidString: userId),
              let user = User.find(by: userUUID) else {
            response.completed(status: .unauthorized)
            return
        }
        
        guard let body = request.postBodyString,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            response.completed(status: .badRequest)
            return
        }
        
        // Update user fields
        var updatedUser = user
        if let name = json["name"] as? String {
            updatedUser = User(
                id: user.id,
                email: user.email,
                passwordHash: user.passwordHash,
                name: name,
                createdAt: user.createdAt,
                updatedAt: Date()
            )
        }
        
        try? updatedUser.save()
        
        response.setHeader(.contentType, value: "application/json")
        try? response.setBody(json: updatedUser.toPublic())
        response.completed()
    }
    
    static func delete(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid else {
            response.completed(status: .unauthorized)
            return
        }
        
        // Delete user
        let query = "DELETE FROM users WHERE id = $1"
        _ = DatabaseManager.shared.execute(query, params: [userId])
        
        // Clear session
        request.session?.userid = nil
        
        response.completed(status: .noContent)
    }
}`,

    'Sources/Controllers/TodoController.swift': `import PerfectHTTP
import Foundation

class TodoController {
    static func list(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid,
              let userUUID = UUID(uuidString: userId) else {
            response.completed(status: .unauthorized)
            return
        }
        
        let todos = Todo.findAll(for: userUUID)
        
        response.setHeader(.contentType, value: "application/json")
        try? response.setBody(json: todos)
        response.completed()
    }
    
    static func create(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid,
              let userUUID = UUID(uuidString: userId) else {
            response.completed(status: .unauthorized)
            return
        }
        
        guard let body = request.postBodyString,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let title = json["title"] as? String else {
            response.completed(status: .badRequest)
            return
        }
        
        let description = json["description"] as? String
        let todo = Todo(userId: userUUID, title: title, description: description)
        
        try? todo.save()
        
        response.setHeader(.contentType, value: "application/json")
        try? response.setBody(json: todo)
        response.completed()
    }
    
    static func get(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid,
              let userUUID = UUID(uuidString: userId),
              let todoId = request.urlVariables["id"],
              let todoUUID = UUID(uuidString: todoId),
              let todo = Todo.find(by: todoUUID, userId: userUUID) else {
            response.completed(status: .notFound)
            return
        }
        
        response.setHeader(.contentType, value: "application/json")
        try? response.setBody(json: todo)
        response.completed()
    }
    
    static func update(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid,
              let userUUID = UUID(uuidString: userId),
              let todoId = request.urlVariables["id"],
              let todoUUID = UUID(uuidString: todoId),
              var todo = Todo.find(by: todoUUID, userId: userUUID) else {
            response.completed(status: .notFound)
            return
        }
        
        guard let body = request.postBodyString,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            response.completed(status: .badRequest)
            return
        }
        
        // Update fields
        if let title = json["title"] as? String {
            todo = Todo(
                id: todo.id,
                userId: todo.userId,
                title: title,
                description: todo.description,
                completed: todo.completed,
                createdAt: todo.createdAt,
                updatedAt: Date()
            )
        }
        
        if let completed = json["completed"] as? Bool {
            todo = Todo(
                id: todo.id,
                userId: todo.userId,
                title: todo.title,
                description: todo.description,
                completed: completed,
                createdAt: todo.createdAt,
                updatedAt: Date()
            )
        }
        
        try? todo.save()
        
        response.setHeader(.contentType, value: "application/json")
        try? response.setBody(json: todo)
        response.completed()
    }
    
    static func delete(request: HTTPRequest, response: HTTPResponse) {
        guard let userId = request.session?.userid,
              let userUUID = UUID(uuidString: userId),
              let todoId = request.urlVariables["id"],
              let todoUUID = UUID(uuidString: todoId),
              let todo = Todo.find(by: todoUUID, userId: userUUID) else {
            response.completed(status: .notFound)
            return
        }
        
        try? todo.delete()
        response.completed(status: .noContent)
    }
}`,

    // Middleware
    'Sources/Middleware/AuthenticationFilter.swift': `import PerfectHTTP

struct AuthenticationFilter: HTTPRequestFilter {
    func filter(request: HTTPRequest, response: HTTPResponse, callback: (HTTPRequestFilterResult) -> ()) {
        // Check if route requires authentication
        let publicPaths = ["/", "/health", "/api/v1", "/api/v1/auth/register", "/api/v1/auth/login"]
        
        if publicPaths.contains(request.path) {
            callback(.continue(request, response))
            return
        }
        
        // Check session
        if request.session?.userid != nil {
            callback(.continue(request, response))
            return
        }
        
        // Check Bearer token
        if let auth = request.header(.authorization),
           auth.hasPrefix("Bearer ") {
            let token = String(auth.dropFirst(7))
            // Validate token - implementation depends on your token strategy
            if validateToken(token) {
                callback(.continue(request, response))
                return
            }
        }
        
        // Unauthorized
        response.status = .unauthorized
        response.setHeader(.contentType, value: "application/json")
        let error = ["error": "Authentication required"]
        try? response.setBody(json: error)
        callback(.halt(request, response))
    }
    
    private func validateToken(_ token: String) -> Bool {
        // Implement token validation
        return false
    }
}`,

    'Sources/Middleware/CORSHandler.swift': `import PerfectHTTP

struct CORSHandler {
    static func handler(request: HTTPRequest, response: HTTPResponse) {
        response.setHeader(.accessControlAllowOrigin, value: "*")
        response.setHeader(.accessControlAllowHeaders, value: "Accept, Content-Type, Authorization")
        response.setHeader(.accessControlAllowMethods, value: "GET, POST, PUT, DELETE, OPTIONS")
        response.setHeader(.accessControlMaxAge, value: "3600")
        
        if request.method == .options {
            response.completed()
        }
    }
}`,

    'Sources/Middleware/CompressionFilter.swift': `import PerfectHTTP
import PerfectLib

struct CompressionFilter: HTTPResponseFilter {
    func filterBody(response: HTTPResponse, callback: (HTTPResponseFilterResult) -> ()) {
        // Check if client accepts gzip
        guard let acceptEncoding = response.request.header(.acceptEncoding),
              acceptEncoding.contains("gzip") else {
            callback(.continue)
            return
        }
        
        // Compress response body if it's large enough
        if let body = response.bodyBytes, body.count > 1024 {
            // Implementation of gzip compression would go here
            // For now, just pass through
            callback(.continue)
        } else {
            callback(.continue)
        }
    }
    
    func filterHeaders(response: HTTPResponse, callback: (HTTPResponseFilterResult) -> ()) {
        callback(.continue)
    }
}`,

    'Sources/Middleware/ErrorHandlerFilter.swift': `import PerfectHTTP
import Logging

struct ErrorHandlerFilter: HTTPResponseFilter {
    private let logger = Logger(label: "{{projectName}}.error")
    
    func filterBody(response: HTTPResponse, callback: (HTTPResponseFilterResult) -> ()) {
        callback(.continue)
    }
    
    func filterHeaders(response: HTTPResponse, callback: (HTTPResponseFilterResult) -> ()) {
        // Log errors
        if response.status.code >= 400 {
            logger.error("Request failed: \\(response.request.path) - Status: \\(response.status.code)")
        }
        
        // Ensure error responses have proper content type
        if response.status.code >= 400 && response.header(.contentType) == nil {
            response.setHeader(.contentType, value: "application/json")
            
            let error = [
                "error": HTTPResponseStatus.statusFrom(code: response.status.code).description,
                "status": response.status.code
            ]
            
            try? response.setBody(json: error)
        }
        
        callback(.continue)
    }
}`,

    'Sources/Middleware/ValidationFilter.swift': `import PerfectHTTP

struct ValidationFilter: HTTPRequestFilter {
    func filter(request: HTTPRequest, response: HTTPResponse, callback: (HTTPRequestFilterResult) -> ()) {
        // Validate content type for POST/PUT requests
        if request.method == .post || request.method == .put {
            if let contentType = request.header(.contentType),
               !contentType.contains("application/json") &&
               !contentType.contains("multipart/form-data") {
                response.status = .unsupportedMediaType
                let error = ["error": "Content-Type must be application/json or multipart/form-data"]
                try? response.setBody(json: error)
                callback(.halt(request, response))
                return
            }
        }
        
        callback(.continue(request, response))
    }
}`,

    // Tests
    'Tests/{{projectName}}Tests.swift': `import XCTest
@testable import {{projectName}}
import PerfectHTTP
import PerfectHTTPServer

final class {{projectName}}Tests: XCTestCase {
    var server: HTTPServer!
    
    override func setUp() {
        super.setUp()
        
        server = HTTPServer()
        server.serverPort = 8181
        
        var routes = Routes()
        setupRoutes(&routes)
        server.addRoutes(routes)
        
        try? server.start()
    }
    
    override func tearDown() {
        server.stop()
        super.tearDown()
    }
    
    func testHealthEndpoint() {
        let expectation = self.expectation(description: "Health check")
        
        let url = URL(string: "http://localhost:8181/health")!
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            XCTAssertNil(error)
            XCTAssertNotNil(data)
            
            if let httpResponse = response as? HTTPURLResponse {
                XCTAssertEqual(httpResponse.statusCode, 200)
            }
            
            expectation.fulfill()
        }
        
        task.resume()
        wait(for: [expectation], timeout: 5.0)
    }
    
    func testAPIEndpoint() {
        let expectation = self.expectation(description: "API info")
        
        let url = URL(string: "http://localhost:8181/api/v1")!
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            XCTAssertNil(error)
            XCTAssertNotNil(data)
            
            if let httpResponse = response as? HTTPURLResponse {
                XCTAssertEqual(httpResponse.statusCode, 200)
            }
            
            if let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                XCTAssertEqual(json["name"] as? String, "{{projectName}} API")
                XCTAssertEqual(json["version"] as? String, "1.0.0")
            }
            
            expectation.fulfill()
        }
        
        task.resume()
        wait(for: [expectation], timeout: 5.0)
    }
}`,

    // Environment configuration
    '.env.example': `# Server Configuration
HOST=0.0.0.0
PORT=8080

# Database Configuration
DATABASE_URL=postgresql://localhost/{{projectName}}

# SSL Configuration
USE_SSL=false
SSL_CERT_PATH=./cert.pem
SSL_KEY_PATH=./key.pem

# Session Configuration
SESSION_TIMEOUT=86400
COOKIE_DOMAIN=

# Security
JWT_SECRET=your-secret-key-here`,

    // Docker configuration
    'Dockerfile': `# ================================
# Build image
# ================================
FROM swift:5.9-jammy as build

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libssl-dev \
    libcurl4-openssl-dev \
    libpq-dev \
    libmysqlclient-dev \
    libsqlite3-dev \
    uuid-dev \
    && rm -rf /var/lib/apt/lists/*

# Set up a build area
WORKDIR /build

# Copy package files
COPY Package.* ./

# Resolve dependencies
RUN swift package resolve

# Copy entire repo into container
COPY . .

# Build with optimizations
RUN swift build -c release

# ================================
# Run image
# ================================
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    libcurl4 \
    libpq5 \
    libmysqlclient21 \
    libsqlite3-0 \
    uuid-runtime \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd --create-home --shell /bin/bash app

WORKDIR /app

# Copy build artifacts
COPY --from=build /build/.build/release/{{projectName}} .
COPY --from=build /build/public ./public

# Set ownership
RUN chown -R app:app /app

USER app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run the app
CMD ["./{{projectName}}"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - HOST=0.0.0.0
      - PORT=8080
      - DATABASE_URL=postgresql://perfect:perfect@db/{{projectName}}
    depends_on:
      - db
    volumes:
      - ./public:/app/public

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=perfect
      - POSTGRES_PASSWORD=perfect
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:`,

    // README
    'README.md': `# {{projectName}}

A high-performance server-side Swift application built with Perfect.

## Features

- ✅ RESTful API with Perfect HTTPServer
- ✅ WebSocket support for real-time communication
- ✅ PostgreSQL, MySQL, and SQLite database support
- ✅ Session management and authentication
- ✅ Request logging and monitoring
- ✅ CORS support
- ✅ SSL/TLS support
- ✅ Docker ready

## Requirements

- Swift 5.9 or later
- macOS 12+ or Ubuntu 22.04+

## Getting Started

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   swift package resolve
   \`\`\`
3. Copy \`.env.example\` to \`.env\` and configure
4. Build and run:
   \`\`\`bash
   swift build
   swift run
   \`\`\`

The server will start on port 8080 by default.

## API Endpoints

### Public Endpoints
- \`GET /health\` - Health check
- \`GET /api/v1\` - API information
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login
- \`POST /api/v1/auth/logout\` - Logout

### Protected Endpoints
- \`GET /api/v1/users\` - List users
- \`GET /api/v1/users/{id}\` - Get user
- \`PUT /api/v1/users/{id}\` - Update user
- \`DELETE /api/v1/users/{id}\` - Delete user
- \`GET /api/v1/todos\` - List todos
- \`POST /api/v1/todos\` - Create todo
- \`GET /api/v1/todos/{id}\` - Get todo
- \`PUT /api/v1/todos/{id}\` - Update todo
- \`DELETE /api/v1/todos/{id}\` - Delete todo

### WebSocket Endpoint
- \`WS /ws\` - WebSocket connection for real-time communication

## Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## Testing

Run the test suite:
\`\`\`bash
swift test
\`\`\`

## Configuration

See \`.env.example\` for available configuration options.

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

# Perfect
*.log
*.pid

# Environment
.env
.env.local

# Database
*.sqlite
*.sqlite3

# Certificates
*.pem
*.key
*.crt`}};