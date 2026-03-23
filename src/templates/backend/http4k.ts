import { BackendTemplate } from '../types';

export const http4kTemplate: BackendTemplate = {
  id: 'http4k',
  name: 'http4k',
  displayName: 'http4k Framework',
  description: 'Functional toolkit for Kotlin HTTP applications with zero dependencies',
  language: 'kotlin',
  framework: 'http4k',
  version: '5.12.0.0',
  tags: ['kotlin', 'http4k', 'functional', 'api', 'rest', 'jvm', 'serverless'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Gradle build configuration
    'build.gradle.kts': `import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.21"
    kotlin("plugin.serialization") version "1.9.21"
    application
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

group = "com.{{projectName}}"
version = "0.0.1"

application {
    mainClass.set("com.{{projectName}}.ApplicationKt")
}

repositories {
    mavenCentral()
}

val http4kVersion = "5.12.0.0"
val kotlinVersion = "1.9.21"

dependencies {
    // http4k core
    implementation("org.http4k:http4k-core:$http4kVersion")
    implementation("org.http4k:http4k-server-netty:$http4kVersion")
    implementation("org.http4k:http4k-client-okhttp:$http4kVersion")

    // Routing & contract
    implementation("org.http4k:http4k-contract:$http4kVersion")
    implementation("org.http4k:http4k-format-jackson:$http4kVersion")

    // Security
    implementation("org.http4k:http4k-security-oauth:$http4kVersion")

    // OpenAPI
    implementation("org.http4k:http4k-contract-ui-swagger:$http4kVersion")

    // Template
    implementation("org.http4k:http4k-template-handlebars:$http4kVersion")

    // Resilience
    implementation("org.http4k:http4k-resilience4j:$http4kVersion")

    // Metrics
    implementation("org.http4k:http4k-metrics-micrometer:$http4kVersion")
    implementation("io.micrometer:micrometer-registry-prometheus:1.12.1")

    // Database
    implementation("org.jetbrains.exposed:exposed-core:0.46.0")
    implementation("org.jetbrains.exposed:exposed-dao:0.46.0")
    implementation("org.jetbrains.exposed:exposed-jdbc:0.46.0")
    implementation("org.jetbrains.exposed:exposed-java-time:0.46.0")
    implementation("com.zaxxer:HikariCP:5.1.0")
    implementation("org.postgresql:postgresql:42.7.1")
    implementation("com.h2database:h2:2.2.224")

    // Password hashing
    implementation("at.favre.lib:bcrypt:0.10.2")

    // JWT
    implementation("com.auth0:java-jwt:4.4.0")

    // Logging
    implementation("io.github.oshai:kotlin-logging-jvm:6.0.1")
    implementation("ch.qos.logback:logback-classic:1.4.14")

    // Configuration
    implementation("io.github.cdimascio:dotenv-kotlin:6.4.1")

    // Testing
    testImplementation("org.http4k:http4k-testing-kotest:$http4kVersion")
    testImplementation("org.http4k:http4k-testing-approval:$http4kVersion")
    testImplementation("io.kotest:kotest-runner-junit5:5.8.0")
    testImplementation("io.kotest:kotest-assertions-core:5.8.0")
    testImplementation("io.mockk:mockk:1.13.8")
}

tasks.withType<KotlinCompile> {
    kotlinOptions.jvmTarget = "17"
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}

tasks.shadowJar {
    archiveBaseName.set("{{projectName}}")
    archiveClassifier.set("")
    archiveVersion.set("")
    mergeServiceFiles()
}
`,

    // Gradle settings
    'settings.gradle.kts': `rootProject.name = "{{projectName}}"
`,

    // Main Application
    'src/main/kotlin/com/{{projectName}}/Application.kt': `package com.{{projectName}}

import com.{{projectName}}.config.Database
import com.{{projectName}}.config.Environment
import com.{{projectName}}.routes.createApi
import io.github.oshai.kotlinlogging.KotlinLogging
import org.http4k.server.Netty
import org.http4k.server.asServer

private val logger = KotlinLogging.logger {}

fun main() {
    val env = Environment.load()

    // Initialize database
    Database.init(env)

    logger.info { "Starting {{projectName}} server on port \${env.port}" }

    val app = createApi(env)

    app.asServer(Netty(env.port)).start()

    logger.info { "Server started successfully. API docs at http://localhost:\${env.port}/docs" }
}
`,

    // Configuration - Environment
    'src/main/kotlin/com/{{projectName}}/config/Environment.kt': `package com.{{projectName}}.config

import io.github.cdimascio.dotenv.dotenv

data class Environment(
    val port: Int,
    val environment: String,
    val dbHost: String,
    val dbPort: Int,
    val dbName: String,
    val dbUser: String,
    val dbPassword: String,
    val useH2: Boolean,
    val jwtSecret: String,
    val jwtExpirationHours: Long,
    val allowedOrigins: List<String>
) {
    val isDevelopment: Boolean get() = environment == "development"
    val isProduction: Boolean get() = environment == "production"

    companion object {
        fun load(): Environment {
            val dotenv = dotenv { ignoreIfMissing = true }

            return Environment(
                port = dotenv["PORT"]?.toIntOrNull() ?: 8080,
                environment = dotenv["ENVIRONMENT"] ?: "development",
                dbHost = dotenv["DB_HOST"] ?: "localhost",
                dbPort = dotenv["DB_PORT"]?.toIntOrNull() ?: 5432,
                dbName = dotenv["DB_NAME"] ?: "{{projectName}}",
                dbUser = dotenv["DB_USER"] ?: "postgres",
                dbPassword = dotenv["DB_PASSWORD"] ?: "password",
                useH2 = dotenv["USE_H2"]?.toBoolean() ?: true,
                jwtSecret = dotenv["JWT_SECRET"] ?: "your-secret-key",
                jwtExpirationHours = dotenv["JWT_EXPIRATION_HOURS"]?.toLongOrNull() ?: 24,
                allowedOrigins = dotenv["ALLOWED_ORIGINS"]?.split(",") ?: listOf("*")
            )
        }
    }
}
`,

    // Configuration - Database
    'src/main/kotlin/com/{{projectName}}/config/Database.kt': `package com.{{projectName}}.config

import com.{{projectName}}.models.Products
import com.{{projectName}}.models.Users
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.github.oshai.kotlinlogging.KotlinLogging
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction

private val logger = KotlinLogging.logger {}

object Database {
    fun init(env: Environment) {
        val config = HikariConfig().apply {
            if (env.useH2) {
                driverClassName = "org.h2.Driver"
                jdbcUrl = "jdbc:h2:mem:{{projectName}};DB_CLOSE_DELAY=-1"
            } else {
                driverClassName = "org.postgresql.Driver"
                jdbcUrl = "jdbc:postgresql://\${env.dbHost}:\${env.dbPort}/\${env.dbName}"
                username = env.dbUser
                password = env.dbPassword
            }
            maximumPoolSize = 10
            minimumIdle = 2
            idleTimeout = 10000
            connectionTimeout = 10000
            maxLifetime = 1800000
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_REPEATABLE_READ"
        }

        val dataSource = HikariDataSource(config)
        Database.connect(dataSource)

        // Run migrations
        transaction {
            SchemaUtils.create(Users, Products)
        }

        logger.info { "Database initialized successfully" }
    }
}
`,

    // Configuration - JWT
    'src/main/kotlin/com/{{projectName}}/config/JwtAuth.kt': `package com.{{projectName}}.config

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import com.{{projectName}}.models.User
import com.{{projectName}}.models.UserPrincipal
import com.{{projectName}}.models.Users
import org.http4k.core.Filter
import org.http4k.core.HttpHandler
import org.http4k.core.Request
import org.http4k.core.Response
import org.http4k.core.Status
import org.http4k.core.with
import org.http4k.format.Jackson.auto
import org.http4k.lens.RequestContextLens
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.Date

data class JwtConfig(
    val secret: String,
    val expirationHours: Long,
    val issuer: String = "{{projectName}}",
    val audience: String = "{{projectName}}-users"
)

object JwtAuth {
    private lateinit var config: JwtConfig
    private val algorithm: Algorithm by lazy { Algorithm.HMAC256(config.secret) }

    fun initialize(env: Environment) {
        config = JwtConfig(
            secret = env.jwtSecret,
            expirationHours = env.jwtExpirationHours
        )
    }

    fun generateToken(userId: Int, email: String, role: String): String {
        return JWT.create()
            .withIssuer(config.issuer)
            .withAudience(config.audience)
            .withClaim("userId", userId)
            .withClaim("email", email)
            .withClaim("role", role)
            .withExpiresAt(Date(System.currentTimeMillis() + config.expirationHours * 3600 * 1000))
            .sign(algorithm)
    }

    fun verifyToken(token: String): UserPrincipal? {
        return try {
            val verifier = JWT.require(algorithm)
                .withIssuer(config.issuer)
                .withAudience(config.audience)
                .build()

            val decoded = verifier.verify(token)
            val userId = decoded.getClaim("userId").asInt()
            val email = decoded.getClaim("email").asString()
            val role = decoded.getClaim("role").asString()

            UserPrincipal(userId, email, role)
        } catch (e: JWTVerificationException) {
            null
        }
    }

    fun authFilter(userLens: RequestContextLens<UserPrincipal?>): Filter = Filter { next ->
        { request ->
            val token = request.header("Authorization")?.removePrefix("Bearer ")
            val principal = token?.let { verifyToken(it) }

            if (principal != null) {
                // Verify user still exists and is active
                val user = transaction {
                    User.find { Users.id eq principal.id }.firstOrNull()
                }

                if (user != null && user.active) {
                    next(request.with(userLens of principal))
                } else {
                    Response(Status.UNAUTHORIZED).with(errorLens of ErrorResponse("Invalid or expired token"))
                }
            } else {
                Response(Status.UNAUTHORIZED).with(errorLens of ErrorResponse("Authorization required"))
            }
        }
    }

    fun requireRole(vararg roles: String, userLens: RequestContextLens<UserPrincipal?>): Filter = Filter { next ->
        { request ->
            val principal = userLens(request)
            if (principal != null && roles.contains(principal.role)) {
                next(request)
            } else {
                Response(Status.FORBIDDEN).with(errorLens of ErrorResponse("Insufficient permissions"))
            }
        }
    }
}

data class ErrorResponse(val error: String)
val errorLens = org.http4k.core.Body.auto<ErrorResponse>().toLens()
`,

    // Models - User
    'src/main/kotlin/com/{{projectName}}/models/User.kt': `package com.{{projectName}}.models

import at.favre.lib.crypto.bcrypt.BCrypt
import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.javatime.datetime
import java.time.LocalDateTime

object Users : IntIdTable() {
    val email = varchar("email", 255).uniqueIndex()
    val password = varchar("password", 255)
    val name = varchar("name", 100)
    val role = varchar("role", 50).default("user")
    val active = bool("active").default(true)
    val createdAt = datetime("created_at").default(LocalDateTime.now())
    val updatedAt = datetime("updated_at").default(LocalDateTime.now())
}

class User(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<User>(Users)

    var email by Users.email
    var password by Users.password
    var name by Users.name
    var role by Users.role
    var active by Users.active
    var createdAt by Users.createdAt
    var updatedAt by Users.updatedAt

    fun setPassword(plainPassword: String) {
        password = BCrypt.withDefaults().hashToString(12, plainPassword.toCharArray())
    }

    fun checkPassword(plainPassword: String): Boolean {
        return BCrypt.verifyer().verify(plainPassword.toCharArray(), password).verified
    }

    fun toResponse() = UserResponse(
        id = id.value,
        email = email,
        name = name,
        role = role,
        active = active,
        createdAt = createdAt.toString()
    )
}

data class UserResponse(
    val id: Int,
    val email: String,
    val name: String,
    val role: String,
    val active: Boolean,
    val createdAt: String
)

data class UserPrincipal(
    val id: Int,
    val email: String,
    val role: String
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String
)

data class AuthResponse(
    val token: String,
    val user: UserResponse
)
`,

    // Models - Product
    'src/main/kotlin/com/{{projectName}}/models/Product.kt': `package com.{{projectName}}.models

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.javatime.datetime
import java.math.BigDecimal
import java.time.LocalDateTime

object Products : IntIdTable() {
    val name = varchar("name", 200)
    val description = text("description").nullable()
    val price = decimal("price", 10, 2)
    val stock = integer("stock").default(0)
    val active = bool("active").default(true)
    val createdAt = datetime("created_at").default(LocalDateTime.now())
    val updatedAt = datetime("updated_at").default(LocalDateTime.now())
}

class Product(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<Product>(Products)

    var name by Products.name
    var description by Products.description
    var price by Products.price
    var stock by Products.stock
    var active by Products.active
    var createdAt by Products.createdAt
    var updatedAt by Products.updatedAt

    fun toResponse() = ProductResponse(
        id = id.value,
        name = name,
        description = description,
        price = price.toDouble(),
        stock = stock,
        active = active,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )
}

data class ProductResponse(
    val id: Int,
    val name: String,
    val description: String?,
    val price: Double,
    val stock: Int,
    val active: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class CreateProductRequest(
    val name: String,
    val description: String? = null,
    val price: Double,
    val stock: Int = 0
)

data class UpdateProductRequest(
    val name: String? = null,
    val description: String? = null,
    val price: Double? = null,
    val stock: Int? = null,
    val active: Boolean? = null
)

data class PaginatedResponse<T>(
    val data: List<T>,
    val total: Long,
    val page: Int,
    val limit: Int
)
`,

    // Routes - Main API
    'src/main/kotlin/com/{{projectName}}/routes/Api.kt': `package com.{{projectName}}.routes

import com.{{projectName}}.config.Environment
import com.{{projectName}}.config.JwtAuth
import com.{{projectName}}.models.UserPrincipal
import org.http4k.contract.contract
import org.http4k.contract.openapi.ApiInfo
import org.http4k.contract.openapi.v3.OpenApi3
import org.http4k.contract.ui.swaggerUi
import org.http4k.core.Filter
import org.http4k.core.HttpHandler
import org.http4k.core.Method
import org.http4k.core.RequestContexts
import org.http4k.core.Response
import org.http4k.core.Status
import org.http4k.core.then
import org.http4k.core.with
import org.http4k.filter.CorsPolicy
import org.http4k.filter.ServerFilters
import org.http4k.format.Jackson.auto
import org.http4k.lens.RequestContextKey
import org.http4k.routing.bind
import org.http4k.routing.routes
import java.time.Instant

fun createApi(env: Environment): HttpHandler {
    // Initialize JWT
    JwtAuth.initialize(env)

    // Request context for user principal
    val contexts = RequestContexts()
    val userLens = RequestContextKey.optional<UserPrincipal>(contexts)

    // CORS configuration
    val corsPolicy = CorsPolicy(
        origins = if (env.allowedOrigins.contains("*")) listOf("*") else env.allowedOrigins,
        headers = listOf("Content-Type", "Authorization", "X-Request-ID"),
        methods = listOf(Method.GET, Method.POST, Method.PUT, Method.PATCH, Method.DELETE, Method.OPTIONS),
        credentials = true
    )

    // OpenAPI contract
    val apiContract = contract {
        renderer = OpenApi3(ApiInfo("{{projectName}} API", "1.0.0", "REST API for {{projectName}}"))
        descriptionPath = "/openapi.json"

        routes += authRoutes(env, userLens)
        routes += userRoutes(env, userLens)
        routes += productRoutes(env, userLens)
    }

    // Health check response
    val healthLens = org.http4k.core.Body.auto<Map<String, Any>>().toLens()

    val app = routes(
        "/health" bind Method.GET to {
            Response(Status.OK).with(healthLens of mapOf(
                "status" to "healthy",
                "timestamp" to Instant.now().toString()
            ))
        },
        "/docs" bind swaggerUi("/api/v1/openapi.json"),
        "/api/v1" bind apiContract
    )

    // Apply filters
    return ServerFilters.InitialiseRequestContext(contexts)
        .then(ServerFilters.Cors(corsPolicy))
        .then(loggingFilter())
        .then(app)
}

private fun loggingFilter(): Filter = Filter { next ->
    { request ->
        val start = System.currentTimeMillis()
        val response = next(request)
        val duration = System.currentTimeMillis() - start

        println("\${request.method} \${request.uri} -> \${response.status} in \${duration}ms")

        response
    }
}
`,

    // Routes - Auth
    'src/main/kotlin/com/{{projectName}}/routes/AuthRoutes.kt': `package com.{{projectName}}.routes

import com.{{projectName}}.config.Environment
import com.{{projectName}}.config.JwtAuth
import com.{{projectName}}.config.ErrorResponse
import com.{{projectName}}.config.errorLens
import com.{{projectName}}.models.*
import org.http4k.contract.ContractRoute
import org.http4k.contract.meta
import org.http4k.core.Body
import org.http4k.core.Method
import org.http4k.core.Response
import org.http4k.core.Status
import org.http4k.core.with
import org.http4k.format.Jackson.auto
import org.http4k.lens.RequestContextLens
import org.jetbrains.exposed.sql.transactions.transaction

fun authRoutes(env: Environment, userLens: RequestContextLens<UserPrincipal?>): List<ContractRoute> {
    val registerRequestLens = Body.auto<RegisterRequest>().toLens()
    val loginRequestLens = Body.auto<LoginRequest>().toLens()
    val userResponseLens = Body.auto<UserResponse>().toLens()
    val authResponseLens = Body.auto<AuthResponse>().toLens()

    return listOf(
        // Register
        "/auth/register" meta {
            summary = "Register new user"
            description = "Create a new user account"
            receiving(registerRequestLens to RegisterRequest("user@example.com", "password123", "John Doe"))
            returning(Status.CREATED, userResponseLens to UserResponse(1, "user@example.com", "John Doe", "user", true, "2024-01-01T00:00:00"))
        } bindContract Method.POST to { request ->
            val body = registerRequestLens(request)

            // Validation
            if (body.email.isBlank() || !body.email.contains("@")) {
                return@to Response(Status.BAD_REQUEST).with(errorLens of ErrorResponse("Valid email is required"))
            }
            if (body.password.length < 6) {
                return@to Response(Status.BAD_REQUEST).with(errorLens of ErrorResponse("Password must be at least 6 characters"))
            }
            if (body.name.length < 2) {
                return@to Response(Status.BAD_REQUEST).with(errorLens of ErrorResponse("Name must be at least 2 characters"))
            }

            val existingUser = transaction {
                User.find { Users.email eq body.email }.firstOrNull()
            }

            if (existingUser != null) {
                return@to Response(Status.CONFLICT).with(errorLens of ErrorResponse("Email already registered"))
            }

            val user = transaction {
                User.new {
                    email = body.email
                    name = body.name
                    setPassword(body.password)
                }
            }

            Response(Status.CREATED).with(userResponseLens of user.toResponse())
        },

        // Login
        "/auth/login" meta {
            summary = "Login user"
            description = "Authenticate user and return JWT token"
            receiving(loginRequestLens to LoginRequest("user@example.com", "password123"))
            returning(Status.OK, authResponseLens to AuthResponse("jwt-token", UserResponse(1, "user@example.com", "John Doe", "user", true, "2024-01-01T00:00:00")))
        } bindContract Method.POST to { request ->
            val body = loginRequestLens(request)

            val user = transaction {
                User.find { Users.email eq body.email }.firstOrNull()
            }

            if (user == null || !user.checkPassword(body.password)) {
                return@to Response(Status.UNAUTHORIZED).with(errorLens of ErrorResponse("Invalid credentials"))
            }

            if (!user.active) {
                return@to Response(Status.UNAUTHORIZED).with(errorLens of ErrorResponse("Account is disabled"))
            }

            val token = JwtAuth.generateToken(user.id.value, user.email, user.role)

            Response(Status.OK).with(authResponseLens of AuthResponse(token, user.toResponse()))
        }
    )
}
`,

    // Routes - User
    'src/main/kotlin/com/{{projectName}}/routes/UserRoutes.kt': `package com.{{projectName}}.routes

import com.{{projectName}}.config.Environment
import com.{{projectName}}.config.ErrorResponse
import com.{{projectName}}.config.JwtAuth
import com.{{projectName}}.config.errorLens
import com.{{projectName}}.models.*
import org.http4k.contract.ContractRoute
import org.http4k.contract.div
import org.http4k.contract.meta
import org.http4k.contract.security.BearerAuthSecurity
import org.http4k.core.Body
import org.http4k.core.Method
import org.http4k.core.Response
import org.http4k.core.Status
import org.http4k.core.with
import org.http4k.format.Jackson.auto
import org.http4k.lens.Path
import org.http4k.lens.RequestContextLens
import org.http4k.lens.int
import org.jetbrains.exposed.sql.transactions.transaction

fun userRoutes(env: Environment, userLens: RequestContextLens<UserPrincipal?>): List<ContractRoute> {
    val userResponseLens = Body.auto<UserResponse>().toLens()
    val usersResponseLens = Body.auto<List<UserResponse>>().toLens()
    val updateLens = Body.auto<Map<String, String>>().toLens()
    val idPath = Path.int().of("id", "User ID")

    val authFilter = JwtAuth.authFilter(userLens)
    val adminFilter = JwtAuth.requireRole("admin", userLens = userLens)

    return listOf(
        // Get current user
        "/users/me" meta {
            summary = "Get current user"
            description = "Get the currently authenticated user"
            security = BearerAuthSecurity
        } bindContract Method.GET to authFilter.then { request ->
            val principal = userLens(request) ?: return@then Response(Status.UNAUTHORIZED)

            val user = transaction {
                User.findById(principal.id)
            } ?: return@then Response(Status.NOT_FOUND).with(errorLens of ErrorResponse("User not found"))

            Response(Status.OK).with(userResponseLens of user.toResponse())
        },

        // Update current user
        "/users/me" meta {
            summary = "Update current user"
            description = "Update the currently authenticated user's profile"
            security = BearerAuthSecurity
            receiving(updateLens to mapOf("name" to "New Name"))
        } bindContract Method.PUT to authFilter.then { request ->
            val principal = userLens(request) ?: return@then Response(Status.UNAUTHORIZED)
            val updates = updateLens(request)

            val user = transaction {
                val u = User.findById(principal.id) ?: return@transaction null
                updates["name"]?.let { u.name = it }
                u
            } ?: return@then Response(Status.NOT_FOUND).with(errorLens of ErrorResponse("User not found"))

            Response(Status.OK).with(userResponseLens of user.toResponse())
        },

        // List users (admin only)
        "/users" meta {
            summary = "List all users"
            description = "Get a list of all users (admin only)"
            security = BearerAuthSecurity
        } bindContract Method.GET to authFilter.then(adminFilter).then { request ->
            val users = transaction {
                User.all().map { it.toResponse() }
            }

            Response(Status.OK).with(usersResponseLens of users)
        },

        // Get user by ID
        "/users" / idPath meta {
            summary = "Get user by ID"
            description = "Get a specific user by ID"
            security = BearerAuthSecurity
        } bindContract Method.GET to authFilter.then { id -> { request ->
            val user = transaction {
                User.findById(id)
            } ?: return@to Response(Status.NOT_FOUND).with(errorLens of ErrorResponse("User not found"))

            Response(Status.OK).with(userResponseLens of user.toResponse())
        }},

        // Delete user (admin only)
        "/users" / idPath meta {
            summary = "Delete user"
            description = "Delete a user (admin only)"
            security = BearerAuthSecurity
        } bindContract Method.DELETE to authFilter.then(adminFilter).then { id -> { request ->
            transaction {
                val user = User.findById(id) ?: return@transaction null
                user.delete()
                user
            } ?: return@to Response(Status.NOT_FOUND).with(errorLens of ErrorResponse("User not found"))

            Response(Status.NO_CONTENT)
        }}
    )
}
`,

    // Routes - Product
    'src/main/kotlin/com/{{projectName}}/routes/ProductRoutes.kt': `package com.{{projectName}}.routes

import com.{{projectName}}.config.Environment
import com.{{projectName}}.config.ErrorResponse
import com.{{projectName}}.config.JwtAuth
import com.{{projectName}}.config.errorLens
import com.{{projectName}}.models.*
import org.http4k.contract.ContractRoute
import org.http4k.contract.div
import org.http4k.contract.meta
import org.http4k.contract.security.BearerAuthSecurity
import org.http4k.core.Body
import org.http4k.core.Method
import org.http4k.core.Response
import org.http4k.core.Status
import org.http4k.core.with
import org.http4k.format.Jackson.auto
import org.http4k.lens.Path
import org.http4k.lens.Query
import org.http4k.lens.RequestContextLens
import org.http4k.lens.int
import org.jetbrains.exposed.sql.transactions.transaction
import java.math.BigDecimal
import java.time.LocalDateTime

fun productRoutes(env: Environment, userLens: RequestContextLens<UserPrincipal?>): List<ContractRoute> {
    val productResponseLens = Body.auto<ProductResponse>().toLens()
    val paginatedLens = Body.auto<PaginatedResponse<ProductResponse>>().toLens()
    val createLens = Body.auto<CreateProductRequest>().toLens()
    val updateLens = Body.auto<UpdateProductRequest>().toLens()
    val idPath = Path.int().of("id", "Product ID")
    val pageQuery = Query.int().defaulted("page", 1)
    val limitQuery = Query.int().defaulted("limit", 10)

    val authFilter = JwtAuth.authFilter(userLens)
    val adminFilter = JwtAuth.requireRole("admin", userLens = userLens)

    return listOf(
        // List products
        "/products" meta {
            summary = "List products"
            description = "Get a paginated list of products"
            queries += pageQuery
            queries += limitQuery
        } bindContract Method.GET to { request ->
            val page = pageQuery(request)
            val limit = limitQuery(request)
            val offset = (page - 1) * limit

            val (products, total) = transaction {
                val total = Product.find { Products.active eq true }.count()
                val products = Product.find { Products.active eq true }
                    .limit(limit, offset.toLong())
                    .map { it.toResponse() }
                products to total
            }

            Response(Status.OK).with(paginatedLens of PaginatedResponse(products, total, page, limit))
        },

        // Get product by ID
        "/products" / idPath meta {
            summary = "Get product by ID"
            description = "Get a specific product by ID"
        } bindContract Method.GET to { id -> { request ->
            val product = transaction {
                Product.findById(id)
            } ?: return@to Response(Status.NOT_FOUND).with(errorLens of ErrorResponse("Product not found"))

            Response(Status.OK).with(productResponseLens of product.toResponse())
        }},

        // Create product (admin only)
        "/products" meta {
            summary = "Create product"
            description = "Create a new product (admin only)"
            security = BearerAuthSecurity
            receiving(createLens to CreateProductRequest("Product Name", "Description", 29.99, 100))
        } bindContract Method.POST to authFilter.then(adminFilter).then { request ->
            val body = createLens(request)

            if (body.name.isBlank()) {
                return@then Response(Status.BAD_REQUEST).with(errorLens of ErrorResponse("Product name is required"))
            }
            if (body.price < 0) {
                return@then Response(Status.BAD_REQUEST).with(errorLens of ErrorResponse("Price must be non-negative"))
            }

            val product = transaction {
                Product.new {
                    name = body.name
                    description = body.description
                    price = BigDecimal.valueOf(body.price)
                    stock = body.stock
                }
            }

            Response(Status.CREATED).with(productResponseLens of product.toResponse())
        },

        // Update product (admin only)
        "/products" / idPath meta {
            summary = "Update product"
            description = "Update a product (admin only)"
            security = BearerAuthSecurity
            receiving(updateLens to UpdateProductRequest("Updated Name", null, 39.99, null, null))
        } bindContract Method.PUT to authFilter.then(adminFilter).then { id -> { request ->
            val body = updateLens(request)

            val product = transaction {
                val p = Product.findById(id) ?: return@transaction null
                body.name?.let { p.name = it }
                body.description?.let { p.description = it }
                body.price?.let { p.price = BigDecimal.valueOf(it) }
                body.stock?.let { p.stock = it }
                body.active?.let { p.active = it }
                p.updatedAt = LocalDateTime.now()
                p
            } ?: return@to Response(Status.NOT_FOUND).with(errorLens of ErrorResponse("Product not found"))

            Response(Status.OK).with(productResponseLens of product.toResponse())
        }},

        // Delete product (admin only)
        "/products" / idPath meta {
            summary = "Delete product"
            description = "Delete a product (admin only)"
            security = BearerAuthSecurity
        } bindContract Method.DELETE to authFilter.then(adminFilter).then { id -> { request ->
            transaction {
                val product = Product.findById(id) ?: return@transaction null
                product.delete()
                product
            } ?: return@to Response(Status.NOT_FOUND).with(errorLens of ErrorResponse("Product not found"))

            Response(Status.NO_CONTENT)
        }}
    )
}
`,

    // Logback configuration
    'src/main/resources/logback.xml': `<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{YYYY-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="STDOUT"/>
    </root>

    <logger name="org.http4k" level="INFO"/>
    <logger name="Exposed" level="INFO"/>
</configuration>
`,

    // Environment file
    '.env.example': `# Server
PORT=8080
ENVIRONMENT=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectName}}
DB_USER=postgres
DB_PASSWORD=password
USE_H2=true

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION_HOURS=24

# CORS
ALLOWED_ORIGINS=*
`,

    // Dockerfile
    'Dockerfile': `# Build stage
FROM gradle:8.5-jdk17 AS builder

WORKDIR /app

COPY build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle

RUN gradle dependencies --no-daemon

COPY src ./src

RUN gradle shadowJar --no-daemon

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/build/libs/{{projectName}}.jar app.jar

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME={{projectName}}
      - DB_USER=postgres
      - DB_PASSWORD=password
      - USE_H2=false
      - JWT_SECRET=change-this-secret
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`,

    // Test file
    'src/test/kotlin/com/{{projectName}}/ApplicationTest.kt': `package com.{{projectName}}

import com.{{projectName}}.config.Environment
import com.{{projectName}}.routes.createApi
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.http4k.core.Method
import org.http4k.core.Request
import org.http4k.core.Status

class ApplicationTest : StringSpec({
    val env = Environment(
        port = 8080,
        environment = "test",
        dbHost = "localhost",
        dbPort = 5432,
        dbName = "test",
        dbUser = "test",
        dbPassword = "test",
        useH2 = true,
        jwtSecret = "test-secret",
        jwtExpirationHours = 24,
        allowedOrigins = listOf("*")
    )

    // Initialize database for tests
    beforeSpec {
        com.{{projectName}}.config.Database.init(env)
    }

    val app = createApi(env)

    "health check returns OK" {
        val response = app(Request(Method.GET, "/health"))
        response.status shouldBe Status.OK
        response.bodyString() shouldContain "healthy"
    }

    "products endpoint returns paginated results" {
        val response = app(Request(Method.GET, "/api/v1/products"))
        response.status shouldBe Status.OK
        response.bodyString() shouldContain "data"
        response.bodyString() shouldContain "total"
    }
})
`,

    // README
    'README.md': `# {{projectName}}

A functional HTTP API built with http4k in Kotlin.

## Features

- **http4k Framework**: Functional toolkit for Kotlin HTTP
- **Type-safe Contracts**: OpenAPI documentation generation
- **JWT Authentication**: Secure token-based authentication
- **Exposed ORM**: Type-safe SQL with Kotlin DSL
- **Swagger UI**: Interactive API documentation
- **Docker Support**: Containerized deployment
- **Kotest**: Property-based testing

## Requirements

- JDK 17+
- Gradle 8.5+
- PostgreSQL (optional, H2 for development)
- Docker (optional)

## Quick Start

1. Clone the repository
2. Copy \`.env.example\` to \`.env\` and configure
3. Run with Gradle:
   \`\`\`bash
   ./gradlew run
   \`\`\`

4. Or run with Docker:
   \`\`\`bash
   docker-compose up
   \`\`\`

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8080/docs
- OpenAPI JSON: http://localhost:8080/api/v1/openapi.json

## Development

### Run tests
\`\`\`bash
./gradlew test
\`\`\`

### Build shadow jar
\`\`\`bash
./gradlew shadowJar
\`\`\`

## Project Structure

\`\`\`
src/
├── main/kotlin/com/{{projectName}}/
│   ├── config/       # Configuration
│   ├── models/       # Data models
│   ├── routes/       # API routes
│   └── Application.kt
└── test/kotlin/      # Tests
\`\`\`
`
  }
};
