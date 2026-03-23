import { BackendTemplate } from '../types';

export const ktorTemplate: BackendTemplate = {
  id: 'ktor',
  name: 'ktor',
  displayName: 'Ktor Framework',
  description: 'Asynchronous Kotlin web framework for connected applications',
  language: 'kotlin',
  framework: 'ktor',
  version: '2.3.7',
  tags: ['kotlin', 'ktor', 'coroutines', 'api', 'rest', 'jvm'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],

  files: {
    // Gradle build configuration
    'build.gradle.kts': `import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.21"
    kotlin("plugin.serialization") version "1.9.21"
    id("io.ktor.plugin") version "2.3.7"
    application
}

group = "com.{{projectName}}"
version = "0.0.1"

application {
    mainClass.set("com.{{projectName}}.ApplicationKt")

    val isDevelopment: Boolean = project.ext.has("development")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

repositories {
    mavenCentral()
}

dependencies {
    // Ktor server
    implementation("io.ktor:ktor-server-core-jvm:2.3.7")
    implementation("io.ktor:ktor-server-netty-jvm:2.3.7")
    implementation("io.ktor:ktor-server-host-common-jvm:2.3.7")
    implementation("io.ktor:ktor-server-status-pages-jvm:2.3.7")
    implementation("io.ktor:ktor-server-auto-head-response-jvm:2.3.7")
    implementation("io.ktor:ktor-server-cors-jvm:2.3.7")
    implementation("io.ktor:ktor-server-compression-jvm:2.3.7")
    implementation("io.ktor:ktor-server-default-headers-jvm:2.3.7")
    implementation("io.ktor:ktor-server-call-logging-jvm:2.3.7")
    implementation("io.ktor:ktor-server-call-id-jvm:2.3.7")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:2.3.7")
    implementation("io.ktor:ktor-server-auth-jvm:2.3.7")
    implementation("io.ktor:ktor-server-auth-jwt-jvm:2.3.7")
    implementation("io.ktor:ktor-server-websockets-jvm:2.3.7")
    implementation("io.ktor:ktor-server-rate-limit:2.3.7")
    implementation("io.ktor:ktor-server-request-validation:2.3.7")

    // Serialization
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:2.3.7")

    // OpenAPI/Swagger
    implementation("io.ktor:ktor-server-openapi:2.3.7")
    implementation("io.ktor:ktor-server-swagger-jvm:2.3.7")

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

    // Logging
    implementation("ch.qos.logback:logback-classic:1.4.14")

    // Configuration
    implementation("io.github.cdimascio:dotenv-kotlin:6.4.1")

    // Testing
    testImplementation("io.ktor:ktor-server-tests-jvm:2.3.7")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:1.9.21")
    testImplementation("io.ktor:ktor-client-content-negotiation-jvm:2.3.7")
}

tasks.withType<KotlinCompile> {
    kotlinOptions.jvmTarget = "17"
}

ktor {
    docker {
        jreVersion.set(io.ktor.plugin.features.JavaVersion.VERSION_17)
        localImageName.set("{{projectName}}")
        imageTag.set("latest")
    }
}
`,

    // Gradle settings
    'settings.gradle.kts': `rootProject.name = "{{projectName}}"
`,

    // Gradle wrapper properties
    'gradle/wrapper/gradle-wrapper.properties': `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.5-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,

    // Main Application
    'src/main/kotlin/com/{{projectName}}/Application.kt': `package com.{{projectName}}

import com.{{projectName}}.config.configureCORS
import com.{{projectName}}.config.configureDatabase
import com.{{projectName}}.config.configureLogging
import com.{{projectName}}.config.configureSecurity
import com.{{projectName}}.config.configureSerialization
import com.{{projectName}}.config.configureStatusPages
import com.{{projectName}}.config.configureSwagger
import com.{{projectName}}.routes.configureRouting
import io.github.cdimascio.dotenv.dotenv
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

fun main() {
    val dotenv = dotenv {
        ignoreIfMissing = true
    }

    val port = dotenv["PORT"]?.toIntOrNull() ?: 8080
    val host = dotenv["HOST"] ?: "0.0.0.0"

    embeddedServer(Netty, port = port, host = host, module = Application::module)
        .start(wait = true)
}

fun Application.module() {
    configureLogging()
    configureSerialization()
    configureStatusPages()
    configureCORS()
    configureDatabase()
    configureSecurity()
    configureSwagger()
    configureRouting()
}
`,

    // Configuration - Serialization
    'src/main/kotlin/com/{{projectName}}/config/Serialization.kt': `package com.{{projectName}}.config

import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import kotlinx.serialization.json.Json

fun Application.configureSerialization() {
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
            encodeDefaults = true
        })
    }
}
`,

    // Configuration - CORS
    'src/main/kotlin/com/{{projectName}}/config/CORS.kt': `package com.{{projectName}}.config

import io.github.cdimascio.dotenv.dotenv
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.compression.*
import io.ktor.server.plugins.defaultheaders.*

fun Application.configureCORS() {
    val dotenv = dotenv { ignoreIfMissing = true }
    val allowedOrigins = dotenv["ALLOWED_ORIGINS"]?.split(",") ?: listOf("*")

    install(CORS) {
        allowedOrigins.forEach { origin ->
            if (origin == "*") {
                anyHost()
            } else {
                allowHost(origin.removePrefix("http://").removePrefix("https://"))
            }
        }
        allowCredentials = true
        allowNonSimpleContentTypes = true
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
        allowHeader("X-Request-ID")
        exposeHeader("X-Request-ID")
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Patch)
        allowMethod(HttpMethod.Delete)
        maxAgeInSeconds = 3600
    }

    install(Compression) {
        gzip {
            priority = 1.0
        }
        deflate {
            priority = 10.0
            minimumSize(1024)
        }
    }

    install(DefaultHeaders) {
        header("X-Engine", "Ktor")
    }
}
`,

    // Configuration - Logging
    'src/main/kotlin/com/{{projectName}}/config/Logging.kt': `package com.{{projectName}}.config

import io.ktor.server.application.*
import io.ktor.server.plugins.callid.*
import io.ktor.server.plugins.callloging.*
import io.ktor.server.request.*
import org.slf4j.event.Level
import java.util.UUID

fun Application.configureLogging() {
    install(CallId) {
        header(HttpHeaders.XRequestId)
        generate { UUID.randomUUID().toString() }
        verify { callId: String -> callId.isNotEmpty() }
    }

    install(CallLogging) {
        level = Level.INFO
        filter { call -> call.request.path().startsWith("/api") }
        callIdMdc("request-id")
        format { call ->
            val status = call.response.status()
            val httpMethod = call.request.httpMethod.value
            val path = call.request.path()
            val duration = call.processingTimeMillis()
            "$httpMethod $path -> $status in \${duration}ms"
        }
    }
}

private object HttpHeaders {
    const val XRequestId = "X-Request-ID"
}
`,

    // Configuration - Database
    'src/main/kotlin/com/{{projectName}}/config/Database.kt': `package com.{{projectName}}.config

import com.{{projectName}}.models.Products
import com.{{projectName}}.models.Users
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.github.cdimascio.dotenv.dotenv
import io.ktor.server.application.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction

fun Application.configureDatabase() {
    val dotenv = dotenv { ignoreIfMissing = true }

    val dbHost = dotenv["DB_HOST"] ?: "localhost"
    val dbPort = dotenv["DB_PORT"] ?: "5432"
    val dbName = dotenv["DB_NAME"] ?: "{{projectName}}"
    val dbUser = dotenv["DB_USER"] ?: "postgres"
    val dbPassword = dotenv["DB_PASSWORD"] ?: "password"
    val useH2 = dotenv["USE_H2"]?.toBoolean() ?: false

    val config = HikariConfig().apply {
        if (useH2) {
            driverClassName = "org.h2.Driver"
            jdbcUrl = "jdbc:h2:mem:{{projectName}};DB_CLOSE_DELAY=-1"
        } else {
            driverClassName = "org.postgresql.Driver"
            jdbcUrl = "jdbc:postgresql://$dbHost:$dbPort/$dbName"
            username = dbUser
            password = dbPassword
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

    log.info("Database initialized successfully")
}
`,

    // Configuration - Security
    'src/main/kotlin/com/{{projectName}}/config/Security.kt': `package com.{{projectName}}.config

import com.{{projectName}}.models.User
import com.{{projectName}}.models.Users
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.github.cdimascio.dotenv.dotenv
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.response.*
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.transactions.transaction
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

fun Application.configureSecurity() {
    val dotenv = dotenv { ignoreIfMissing = true }

    val jwtSecret = dotenv["JWT_SECRET"] ?: "your-secret-key"
    val jwtIssuer = dotenv["JWT_ISSUER"] ?: "{{projectName}}"
    val jwtAudience = dotenv["JWT_AUDIENCE"] ?: "{{projectName}}-users"
    val jwtRealm = dotenv["JWT_REALM"] ?: "{{projectName}}"

    install(Authentication) {
        jwt("auth-jwt") {
            realm = jwtRealm
            verifier(
                JWT.require(Algorithm.HMAC256(jwtSecret))
                    .withAudience(jwtAudience)
                    .withIssuer(jwtIssuer)
                    .build()
            )
            validate { credential ->
                val userId = credential.payload.getClaim("userId").asInt()
                val user = transaction {
                    User.find { Users.id eq userId }.firstOrNull()
                }
                if (user != null && user.active) {
                    JWTPrincipal(credential.payload)
                } else {
                    null
                }
            }
            challenge { _, _ ->
                call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid or expired token"))
            }
        }
    }

    install(RateLimit) {
        register(RateLimitName("public")) {
            rateLimiter(limit = 100, refillPeriod = 1.minutes)
        }
        register(RateLimitName("authenticated")) {
            rateLimiter(limit = 1000, refillPeriod = 1.minutes)
        }
        register(RateLimitName("auth")) {
            rateLimiter(limit = 10, refillPeriod = 1.minutes)
        }
    }
}

fun generateToken(userId: Int, email: String, role: String): String {
    val dotenv = dotenv { ignoreIfMissing = true }
    val jwtSecret = dotenv["JWT_SECRET"] ?: "your-secret-key"
    val jwtIssuer = dotenv["JWT_ISSUER"] ?: "{{projectName}}"
    val jwtAudience = dotenv["JWT_AUDIENCE"] ?: "{{projectName}}-users"
    val expirationHours = dotenv["JWT_EXPIRATION_HOURS"]?.toLongOrNull() ?: 24

    return JWT.create()
        .withAudience(jwtAudience)
        .withIssuer(jwtIssuer)
        .withClaim("userId", userId)
        .withClaim("email", email)
        .withClaim("role", role)
        .withExpiresAt(java.util.Date(System.currentTimeMillis() + expirationHours * 3600 * 1000))
        .sign(Algorithm.HMAC256(jwtSecret))
}
`,

    // Configuration - Status Pages
    'src/main/kotlin/com/{{projectName}}/config/StatusPages.kt': `package com.{{projectName}}.config

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable

@Serializable
data class ErrorResponse(
    val error: String,
    val message: String? = null,
    val status: Int
)

class ValidationException(message: String) : Exception(message)
class AuthenticationException(message: String) : Exception(message)
class AuthorizationException(message: String) : Exception(message)
class NotFoundException(message: String) : Exception(message)

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<ValidationException> { call, cause ->
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(
                    error = "Validation Error",
                    message = cause.message,
                    status = 400
                )
            )
        }

        exception<AuthenticationException> { call, cause ->
            call.respond(
                HttpStatusCode.Unauthorized,
                ErrorResponse(
                    error = "Authentication Error",
                    message = cause.message,
                    status = 401
                )
            )
        }

        exception<AuthorizationException> { call, cause ->
            call.respond(
                HttpStatusCode.Forbidden,
                ErrorResponse(
                    error = "Authorization Error",
                    message = cause.message,
                    status = 403
                )
            )
        }

        exception<NotFoundException> { call, cause ->
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(
                    error = "Not Found",
                    message = cause.message,
                    status = 404
                )
            )
        }

        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled exception", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse(
                    error = "Internal Server Error",
                    message = "An unexpected error occurred",
                    status = 500
                )
            )
        }

        status(HttpStatusCode.NotFound) { call, _ ->
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(
                    error = "Not Found",
                    message = "The requested resource was not found",
                    status = 404
                )
            )
        }
    }
}
`,

    // Configuration - Swagger
    'src/main/kotlin/com/{{projectName}}/config/Swagger.kt': `package com.{{projectName}}.config

import io.ktor.server.application.*
import io.ktor.server.plugins.swagger.*
import io.ktor.server.routing.*

fun Application.configureSwagger() {
    routing {
        swaggerUI(path = "swagger", swaggerFile = "openapi/documentation.yaml")
    }
}
`,

    // Models - User
    'src/main/kotlin/com/{{projectName}}/models/User.kt': `package com.{{projectName}}.models

import at.favre.lib.crypto.bcrypt.BCrypt
import kotlinx.serialization.Serializable
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

@Serializable
data class UserResponse(
    val id: Int,
    val email: String,
    val name: String,
    val role: String,
    val active: Boolean,
    val createdAt: String
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String
)

@Serializable
data class AuthResponse(
    val token: String,
    val user: UserResponse
)
`,

    // Models - Product
    'src/main/kotlin/com/{{projectName}}/models/Product.kt': `package com.{{projectName}}.models

import kotlinx.serialization.Serializable
import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.javatime.datetime
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

@Serializable
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

@Serializable
data class CreateProductRequest(
    val name: String,
    val description: String? = null,
    val price: Double,
    val stock: Int = 0
)

@Serializable
data class UpdateProductRequest(
    val name: String? = null,
    val description: String? = null,
    val price: Double? = null,
    val stock: Int? = null,
    val active: Boolean? = null
)

@Serializable
data class PaginatedResponse<T>(
    val data: List<T>,
    val total: Long,
    val page: Int,
    val limit: Int
)
`,

    // Routes - Main routing
    'src/main/kotlin/com/{{projectName}}/routes/Routing.kt': `package com.{{projectName}}.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.time.Instant

fun Application.configureRouting() {
    routing {
        // Health check
        get("/health") {
            call.respond(HttpStatusCode.OK, mapOf(
                "status" to "healthy",
                "timestamp" to Instant.now().toString()
            ))
        }

        // API routes
        route("/api/v1") {
            authRoutes()
            userRoutes()
            productRoutes()
        }
    }
}
`,

    // Routes - Auth
    'src/main/kotlin/com/{{projectName}}/routes/AuthRoutes.kt': `package com.{{projectName}}.routes

import com.{{projectName}}.config.AuthenticationException
import com.{{projectName}}.config.ValidationException
import com.{{projectName}}.config.generateToken
import com.{{projectName}}.models.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.transactions.transaction

fun Route.authRoutes() {
    route("/auth") {
        rateLimit(RateLimitName("auth")) {
            post("/register") {
                val request = call.receive<RegisterRequest>()

                // Validation
                if (request.email.isBlank() || !request.email.contains("@")) {
                    throw ValidationException("Valid email is required")
                }
                if (request.password.length < 6) {
                    throw ValidationException("Password must be at least 6 characters")
                }
                if (request.name.length < 2) {
                    throw ValidationException("Name must be at least 2 characters")
                }

                val existingUser = transaction {
                    User.find { Users.email eq request.email }.firstOrNull()
                }

                if (existingUser != null) {
                    call.respond(HttpStatusCode.Conflict, mapOf("error" to "Email already registered"))
                    return@post
                }

                val user = transaction {
                    User.new {
                        email = request.email
                        name = request.name
                        setPassword(request.password)
                    }
                }

                call.respond(HttpStatusCode.Created, user.toResponse())
            }

            post("/login") {
                val request = call.receive<LoginRequest>()

                val user = transaction {
                    User.find { Users.email eq request.email }.firstOrNull()
                } ?: throw AuthenticationException("Invalid credentials")

                if (!user.checkPassword(request.password)) {
                    throw AuthenticationException("Invalid credentials")
                }

                if (!user.active) {
                    throw AuthenticationException("Account is disabled")
                }

                val token = generateToken(user.id.value, user.email, user.role)

                call.respond(HttpStatusCode.OK, AuthResponse(
                    token = token,
                    user = user.toResponse()
                ))
            }
        }
    }
}
`,

    // Routes - User
    'src/main/kotlin/com/{{projectName}}/routes/UserRoutes.kt': `package com.{{projectName}}.routes

import com.{{projectName}}.config.AuthorizationException
import com.{{projectName}}.config.NotFoundException
import com.{{projectName}}.models.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.transactions.transaction

fun Route.userRoutes() {
    route("/users") {
        authenticate("auth-jwt") {
            rateLimit(RateLimitName("authenticated")) {
                // Get current user
                get("/me") {
                    val principal = call.principal<JWTPrincipal>()
                    val userId = principal!!.payload.getClaim("userId").asInt()

                    val user = transaction {
                        User.findById(userId)
                    } ?: throw NotFoundException("User not found")

                    call.respond(user.toResponse())
                }

                // Update current user
                put("/me") {
                    val principal = call.principal<JWTPrincipal>()
                    val userId = principal!!.payload.getClaim("userId").asInt()

                    val updates = call.receive<Map<String, String>>()

                    val user = transaction {
                        val u = User.findById(userId) ?: throw NotFoundException("User not found")
                        updates["name"]?.let { u.name = it }
                        u
                    }

                    call.respond(user.toResponse())
                }

                // List all users (admin only)
                get {
                    val principal = call.principal<JWTPrincipal>()
                    val role = principal!!.payload.getClaim("role").asString()

                    if (role != "admin") {
                        throw AuthorizationException("Admin access required")
                    }

                    val users = transaction {
                        User.all().map { it.toResponse() }
                    }

                    call.respond(users)
                }

                // Get user by ID
                get("/{id}") {
                    val id = call.parameters["id"]?.toIntOrNull()
                        ?: throw NotFoundException("Invalid user ID")

                    val user = transaction {
                        User.findById(id)
                    } ?: throw NotFoundException("User not found")

                    call.respond(user.toResponse())
                }

                // Delete user (admin only)
                delete("/{id}") {
                    val principal = call.principal<JWTPrincipal>()
                    val role = principal!!.payload.getClaim("role").asString()

                    if (role != "admin") {
                        throw AuthorizationException("Admin access required")
                    }

                    val id = call.parameters["id"]?.toIntOrNull()
                        ?: throw NotFoundException("Invalid user ID")

                    transaction {
                        val user = User.findById(id) ?: throw NotFoundException("User not found")
                        user.delete()
                    }

                    call.respond(HttpStatusCode.NoContent)
                }
            }
        }
    }
}
`,

    // Routes - Product
    'src/main/kotlin/com/{{projectName}}/routes/ProductRoutes.kt': `package com.{{projectName}}.routes

import com.{{projectName}}.config.AuthorizationException
import com.{{projectName}}.config.NotFoundException
import com.{{projectName}}.config.ValidationException
import com.{{projectName}}.models.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.transactions.transaction
import java.math.BigDecimal
import java.time.LocalDateTime

fun Route.productRoutes() {
    route("/products") {
        // Public routes
        rateLimit(RateLimitName("public")) {
            // List products (paginated)
            get {
                val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
                val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 10
                val offset = (page - 1) * limit

                val (products, total) = transaction {
                    val total = Product.find { Products.active eq true }.count()
                    val products = Product.find { Products.active eq true }
                        .limit(limit, offset.toLong())
                        .map { it.toResponse() }
                    products to total
                }

                call.respond(PaginatedResponse(
                    data = products,
                    total = total,
                    page = page,
                    limit = limit
                ))
            }

            // Get product by ID
            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: throw NotFoundException("Invalid product ID")

                val product = transaction {
                    Product.findById(id)
                } ?: throw NotFoundException("Product not found")

                call.respond(product.toResponse())
            }
        }

        // Protected routes (admin only)
        authenticate("auth-jwt") {
            rateLimit(RateLimitName("authenticated")) {
                // Create product
                post {
                    val principal = call.principal<JWTPrincipal>()
                    val role = principal!!.payload.getClaim("role").asString()

                    if (role != "admin") {
                        throw AuthorizationException("Admin access required")
                    }

                    val request = call.receive<CreateProductRequest>()

                    // Validation
                    if (request.name.isBlank()) {
                        throw ValidationException("Product name is required")
                    }
                    if (request.price < 0) {
                        throw ValidationException("Price must be non-negative")
                    }

                    val product = transaction {
                        Product.new {
                            name = request.name
                            description = request.description
                            price = BigDecimal.valueOf(request.price)
                            stock = request.stock
                        }
                    }

                    call.respond(HttpStatusCode.Created, product.toResponse())
                }

                // Update product
                put("/{id}") {
                    val principal = call.principal<JWTPrincipal>()
                    val role = principal!!.payload.getClaim("role").asString()

                    if (role != "admin") {
                        throw AuthorizationException("Admin access required")
                    }

                    val id = call.parameters["id"]?.toIntOrNull()
                        ?: throw NotFoundException("Invalid product ID")

                    val request = call.receive<UpdateProductRequest>()

                    val product = transaction {
                        val p = Product.findById(id) ?: throw NotFoundException("Product not found")
                        request.name?.let { p.name = it }
                        request.description?.let { p.description = it }
                        request.price?.let { p.price = BigDecimal.valueOf(it) }
                        request.stock?.let { p.stock = it }
                        request.active?.let { p.active = it }
                        p.updatedAt = LocalDateTime.now()
                        p
                    }

                    call.respond(product.toResponse())
                }

                // Delete product
                delete("/{id}") {
                    val principal = call.principal<JWTPrincipal>()
                    val role = principal!!.payload.getClaim("role").asString()

                    if (role != "admin") {
                        throw AuthorizationException("Admin access required")
                    }

                    val id = call.parameters["id"]?.toIntOrNull()
                        ?: throw NotFoundException("Invalid product ID")

                    transaction {
                        val product = Product.findById(id) ?: throw NotFoundException("Product not found")
                        product.delete()
                    }

                    call.respond(HttpStatusCode.NoContent)
                }
            }
        }
    }
}
`,

    // OpenAPI documentation
    'src/main/resources/openapi/documentation.yaml': `openapi: "3.0.3"
info:
  title: "{{projectName}} API"
  description: "API documentation for {{projectName}}"
  version: "1.0.0"
servers:
  - url: "http://localhost:8080"
    description: "Development server"
paths:
  /health:
    get:
      summary: "Health check"
      description: "Check if the service is healthy"
      responses:
        "200":
          description: "Service is healthy"
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  timestamp:
                    type: string
  /api/v1/auth/register:
    post:
      summary: "Register new user"
      tags:
        - auth
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RegisterRequest"
      responses:
        "201":
          description: "User created"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserResponse"
        "400":
          description: "Validation error"
        "409":
          description: "Email already exists"
  /api/v1/auth/login:
    post:
      summary: "Login user"
      tags:
        - auth
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/LoginRequest"
      responses:
        "200":
          description: "Login successful"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AuthResponse"
        "401":
          description: "Invalid credentials"
  /api/v1/users/me:
    get:
      summary: "Get current user"
      tags:
        - users
      security:
        - bearerAuth: []
      responses:
        "200":
          description: "Current user"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserResponse"
        "401":
          description: "Unauthorized"
  /api/v1/products:
    get:
      summary: "List products"
      tags:
        - products
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
      responses:
        "200":
          description: "Products list"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaginatedProducts"
    post:
      summary: "Create product"
      tags:
        - products
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateProductRequest"
      responses:
        "201":
          description: "Product created"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProductResponse"
        "401":
          description: "Unauthorized"
        "403":
          description: "Forbidden"
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    RegisterRequest:
      type: object
      required:
        - email
        - password
        - name
      properties:
        email:
          type: string
        password:
          type: string
        name:
          type: string
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
        password:
          type: string
    UserResponse:
      type: object
      properties:
        id:
          type: integer
        email:
          type: string
        name:
          type: string
        role:
          type: string
        active:
          type: boolean
        createdAt:
          type: string
    AuthResponse:
      type: object
      properties:
        token:
          type: string
        user:
          $ref: "#/components/schemas/UserResponse"
    CreateProductRequest:
      type: object
      required:
        - name
        - price
      properties:
        name:
          type: string
        description:
          type: string
        price:
          type: number
        stock:
          type: integer
    ProductResponse:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        description:
          type: string
        price:
          type: number
        stock:
          type: integer
        active:
          type: boolean
        createdAt:
          type: string
        updatedAt:
          type: string
    PaginatedProducts:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/ProductResponse"
        total:
          type: integer
        page:
          type: integer
        limit:
          type: integer
`,

    // Logback configuration
    'src/main/resources/logback.xml': `<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{YYYY-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/{{projectName}}.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/{{projectName}}.%d{yyyy-MM-dd}.log</fileNamePattern>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%d{YYYY-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="STDOUT"/>
        <appender-ref ref="FILE"/>
    </root>

    <logger name="io.ktor" level="INFO"/>
    <logger name="Exposed" level="INFO"/>
    <logger name="com.zaxxer.hikari" level="INFO"/>
</configuration>
`,

    // Environment file
    '.env.example': `# Server
PORT=8080
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectName}}
DB_USER=postgres
DB_PASSWORD=password
USE_H2=true

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_ISSUER={{projectName}}
JWT_AUDIENCE={{projectName}}-users
JWT_REALM={{projectName}}
JWT_EXPIRATION_HOURS=24

# CORS
ALLOWED_ORIGINS=*
`,

    // Dockerfile
    'Dockerfile': `# Build stage
FROM gradle:8.5-jdk17 AS builder

WORKDIR /app

# Copy gradle files
COPY build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle

# Download dependencies
RUN gradle dependencies --no-daemon

# Copy source code
COPY src ./src

# Build the application
RUN gradle buildFatJar --no-daemon

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the built jar
COPY --from=builder /app/build/libs/*-all.jar app.jar

# Copy resources
COPY --from=builder /app/src/main/resources/openapi ./openapi

# Change ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:8080/health || exit 1

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
      - JWT_SECRET=change-this-secret-in-production
    depends_on:
      - postgres
    restart: unless-stopped

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
    restart: unless-stopped

volumes:
  postgres_data:
`,

    // Test file
    'src/test/kotlin/com/{{projectName}}/ApplicationTest.kt': `package com.{{projectName}}

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlin.test.*

class ApplicationTest {
    @Test
    fun testHealthCheck() = testApplication {
        application {
            module()
        }

        client.get("/health").apply {
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(bodyAsText().contains("healthy"))
        }
    }

    @Test
    fun testRoot() = testApplication {
        application {
            module()
        }

        client.get("/").apply {
            assertEquals(HttpStatusCode.NotFound, status)
        }
    }
}
`,

    // README
    'README.md': `# {{projectName}}

A high-performance REST API built with Ktor framework in Kotlin.

## Features

- **Ktor Framework**: Asynchronous Kotlin web framework
- **Kotlin Coroutines**: Non-blocking async operations
- **JWT Authentication**: Secure token-based authentication
- **Exposed ORM**: Type-safe SQL with Kotlin DSL
- **Swagger/OpenAPI**: Interactive API documentation
- **Rate Limiting**: Request throttling
- **CORS Support**: Configurable cross-origin requests
- **Docker Support**: Containerized deployment
- **PostgreSQL/H2**: Database support

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
- Swagger UI: http://localhost:8080/swagger

## Development

### Run tests
\`\`\`bash
./gradlew test
\`\`\`

### Build fat jar
\`\`\`bash
./gradlew buildFatJar
\`\`\`

### Build Docker image
\`\`\`bash
./gradlew buildImage
\`\`\`

## Project Structure

\`\`\`
src/
├── main/
│   ├── kotlin/com/{{projectName}}/
│   │   ├── config/       # Configuration
│   │   ├── models/       # Data models
│   │   ├── routes/       # API routes
│   │   └── Application.kt
│   └── resources/
│       ├── openapi/      # OpenAPI documentation
│       └── logback.xml   # Logging config
└── test/
    └── kotlin/           # Tests
\`\`\`
`
  }
};
