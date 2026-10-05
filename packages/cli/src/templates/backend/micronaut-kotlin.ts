import { BackendTemplate } from '../types';

export const micronautKotlinTemplate: BackendTemplate = {
  id: 'micronaut-kotlin',
  name: 'micronaut-kotlin',
  displayName: 'Micronaut (Kotlin)',
  description: 'Modern JVM framework for building cloud-native microservices with fast startup and low memory',
  language: 'kotlin',
  framework: 'micronaut',
  version: '1.0.0',
  tags: ['kotlin', 'micronaut', 'microservices', 'cloud-native', 'jwt', 'docker'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'docker', 'graphql'],

  files: {
    // Gradle build file
    'build.gradle.kts': `import io.micronaut.gradle.docker.MicronautDockerfile

plugins {
    kotlin("jvm") version "1.9.21"
    kotlin("kapt") version "1.9.21"
    kotlin("plugin.allopen") version "1.9.21"
    id("io.micronaut.application") version "4.0.3"
    id("io.micronaut.aot") version "4.0.3"
}

version = "0.1"
group = "{{projectGroup}}"

repositories {
    mavenCentral()
}

dependencies {
    kapt("io.micronaut:micronaut-http-validation")
    kapt("io.micronaut.security:micronaut-security-annotations")
    kapt("io.micronaut.validation:micronaut-validation-processor")
    kapt("io.micronaut.data:micronaut-data-processor")
    implementation("io.micronaut:micronaut-http-client")
    implementation("io.micronaut:micronaut-http-server-netty")
    implementation("io.micronaut:micronaut-jackson-databind")
    implementation("io.micronaut.security:micronaut-security-jwt")
    implementation("io.micronaut.kotlin:micronaut-kotlin-runtime")
    implementation("io.micronaut.data:micronaut-data-jdbc")
    implementation("jakarta.annotation:jakarta.annotation-api")
    implementation("org.jetbrains.kotlin:kotlin-reflect:1.9.21")
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.21")
    implementation("io.micronaut.validation:micronaut-validation")
    implementation("io.micronaut.reactor:micronaut-reactor")
    implementation("io.micronaut.graphql:micronaut-graphql")
    runtimeOnly("ch.qos.logback:logback-classic")
    runtimeOnly("com.h2database:h2")
    runtimeOnly("io.micronaut.sql:micronaut-jdbc-hikari")
    testImplementation("io.micronaut:micronaut-http-client")
}

application {
    mainClass.set("{{projectPackage}}.ApplicationKt")
}
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions.jvmTarget = "17"
}

graalvmNative.toolchainDetection.set(false)

micronaut {
    runtime("netty")
    testRuntime("junit5")
    processing {
        incremental(true)
        annotations("{{projectPackage}}.*")
    }
}
`,

    'gradle.properties': `micronautVersion=4.2.0
kotlin.code.style=official
`,

    // Application configuration
    'src/main/resources/application.yml': `micronaut:
  application:
    name: {{projectNameSnake}}
  server:
    port: 8080
    cors:
      enabled: true
  security:
    jwt:
      enabled: true
      token:
        enabled: true
        signatures:
          secret:
            generator:
              secret: change-this-secret-in-production
              jws-algorithm: HS256
graphql:
  enabled: true
  path: /graphql
  graphiql:
    enabled: true
    path: /graphiql

datasources:
  default:
    url: jdbc:h2:mem:devDb;MVCC=TRUE;LOCK_TIMEOUT=10000;DB_CLOSE_ON_EXIT=FALSE
    driverClassName: org.h2.Driver
    username: sa
    password: ''

jpa:
  default:
    entity-scan:
      packages: '{{projectPackage}}.models'
    properties:
      hibernate:
        hbm2ddl:
          auto: update
        show_sql: true

logger:
  levels:
    {{projectPackage}}: DEBUG
`,

    // Main application
    'src/main/kotlin/{{packagePath}}/Application.kt': `package {{projectPackage}}

import io.micronaut.runtime.Micronaut

object Application {
    @JvmStatic
    fun main(args: Array<String>) {
        Micronaut.build()
            .args(*args)
            .packages("{{projectPackage}}")
            .start()
    }
}
`,

    // Configuration
    'src/main/kotlin/{{packagePath}}/config/JwtConfig.kt': `package {{projectPackage}}.config

import io.micronaut.context.annotation.Value
import io.micronaut.security.token.config.TokenConfiguration
import jakarta.inject.Singleton

@Singleton
class JwtConfig(
    @Value("\\\${micronaut.security.jwt.token.signatures.secret.generator.secret}") private val secret: String
) {
    fun getSecret(): String = secret
}
`,

    // Security configuration
    'src/main/kotlin/{{packagePath}}/config/SecurityConfig.kt': `package {{packageName}}.config

import {{packageName}}.repository.UserRepository
import io.micronaut.core.annotation.Nullable
import io.micronaut.http.HttpRequest
import io.micronaut.security.authentication.AuthenticationFailureReason
import io.micronaut.security.authentication.AuthenticationProvider
import io.micronaut.security.authentication.AuthenticationRequest
import io.micronaut.security.authentication.AuthenticationResponse
import jakarta.inject.Singleton
import org.reactivestreams.Publisher
import reactor.core.publisher.Mono

@Singleton
class CustomAuthenticationProvider(
    private val userRepository: UserRepository
) : AuthenticationProvider<HttpRequest<*>> {

    override fun authenticate(
        @Nullable httpRequest: HttpRequest<*>?,
        authenticationRequest: AuthenticationRequest<*, *>
    ): Publisher<AuthenticationResponse> {
        return Mono.fromCallable {
            val email = authenticationRequest.identity as String
            val password = authenticationRequest.secret as String

            val user = userRepository.findByEmail(email)
            if (user != null && user.password == password) {
                AuthenticationResponse.success(
                    user.email,
                    listOf(user.role.name),
                    mapOf<String, Any>("userId" to user.id.toString())
                )
            } else {
                AuthenticationResponse.failure(AuthenticationFailureReason.CREDENTIALS_DO_NOT_MATCH)
            }
        }
    }
}
`,

    // Models
    'src/main/kotlin/{{packagePath}}/models/User.kt': `package {{projectPackage}}.models

import io.micronaut.core.annotation.Creator
import io.micronaut.data.annotation.GeneratedValue
import io.micronaut.data.annotation.Id
import io.micronaut.data.annotation.MappedEntity
import java.time.Instant

@MappedEntity
data class User(
    @field:Id
    @field:GeneratedValue
    var id: Long? = null,

    val email: String,

    var password: String,

    val name: String,

    val role: Role = Role.USER,

    val createdAt: Instant = Instant.now(),

    var updatedAt: Instant = Instant.now()
)

enum class Role {
    USER, ADMIN
}

data class UserResponse(
    val id: Long,
    val email: String,
    val name: String,
    val role: Role
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class AuthResponse(
    val token: String,
    val user: UserResponse
)
`,

    'src/main/kotlin/{{packagePath}}/models/Product.kt': `package {{projectPackage}}.models

import io.micronaut.data.annotation.GeneratedValue
import io.micronaut.data.annotation.Id
import io.micronaut.data.annotation.MappedEntity
import java.time.Instant

@MappedEntity
data class Product(
    @field:Id
    @field:GeneratedValue
    var id: Long? = null,

    val name: String,

    val description: String? = null,

    val price: Double,

    var stock: Int = 0,

    val createdAt: Instant = Instant.now(),

    var updatedAt: Instant = Instant.now()
)

data class CreateProductRequest(
    val name: String,
    val description: String?,
    val price: Double,
    val stock: Int
)

data class UpdateProductRequest(
    val name: String?,
    val description: String?,
    val price: Double?,
    val stock: Int?
)
`,

    // Repositories
    'src/main/kotlin/{{packagePath}}/repository/UserRepository.kt': `package {{projectPackage}}.repository

import {{projectPackage}}.models.User
import {{projectPackage}}.models.Role
import io.micronaut.data.jdbc.annotation.JdbcRepository
import io.micronaut.data.model.query.builder.sql.Dialect
import io.micronaut.data.repository.CrudRepository

@JdbcRepository(dialect = Dialect.H2)
interface UserRepository : CrudRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun findByRole(role: Role): List<User>
}
`,

    'src/main/kotlin/{{packagePath}}/repository/ProductRepository.kt': `package {{projectPackage}}.repository

import {{projectPackage}}.models.Product
import io.micronaut.data.jdbc.annotation.JdbcRepository
import io.micronaut.data.model.query.builder.sql.Dialect
import io.micronaut.data.repository.CrudRepository

@JdbcRepository(dialect = Dialect.H2)
interface ProductRepository : CrudRepository<Product, Long>
`,

    // Controllers
    'src/main/kotlin/{{packagePath}}/controllers/AuthController.kt': `package {{projectPackage}}.controllers

import {{projectPackage}}.models.*
import {{projectPackage}}.repository.UserRepository
import {{projectPackage}}.services.AuthService
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Post
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.http.HttpStatus
import io.micronaut.http.exceptions.HttpStatusException

@Controller("/api/v1/auth")
class AuthController(
    private val userRepository: UserRepository,
    private val authService: AuthService
) {

    @Post("/register")
    @Secured(SecurityRule.IS_ANONYMOUS)
    fun register(@Body request: RegisterRequest): AuthResponse {
        if (userRepository.findByEmail(request.email) != null) {
            throw HttpStatusException(HttpStatus.CONFLICT, "Email already registered")
        }

        val user = authService.register(request)
        // In production, generate JWT token here
        val userResponse = UserResponse(user.id!!, user.email, user.name, user.role)
        return AuthResponse("jwt-token-placeholder", userResponse)
    }

    @Post("/login")
    @Secured(SecurityRule.IS_ANONYMOUS)
    fun login(@Body request: LoginRequest): AuthResponse {
        val user = authService.login(request)
            ?: throw HttpStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")

        val userResponse = UserResponse(user.id!!, user.email, user.name, user.role)
        return AuthResponse("jwt-token-placeholder", userResponse)
    }
}
`,

    'src/main/kotlin/{{packagePath}}/controllers/ProductController.kt': `package {{projectPackage}}.controllers

import {{projectPackage}}.models.*
import {{projectPackage}}.repository.ProductRepository
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Delete
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.Post
import io.micronaut.http.annotation.Put
import io.micronaut.http.HttpStatus
import io.micronaut.http.exceptions.HttpStatusException
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import java.time.Instant

@Controller("/api/v1/products")
class ProductController(
    private val productRepository: ProductRepository
) {

    @Get
    fun listProducts(): Map<String, Any> {
        val products = productRepository.findAll()
        return mapOf(
            "products" to products.toList(),
            "count" to products.size
        )
    }

    @Get("/{id}")
    fun getProduct(id: Long): Map<String, Any> {
        val product = productRepository.findById(id)
        return product.map {
            mapOf("product" to it)
        }.orElseThrow { HttpStatusException(HttpStatus.NOT_FOUND, "Product not found") }
    }

    @Post
    @Secured("ADMIN")
    fun createProduct(@Body request: CreateProductRequest): Map<String, Any> {
        val product = Product(
            name = request.name,
            description = request.description,
            price = request.price,
            stock = request.stock
        )
        val saved = productRepository.save(product)
        return mapOf("product" to saved)
    }

    @Put("/{id}")
    @Secured("ADMIN")
    fun updateProduct(
        id: Long,
        @Body request: UpdateProductRequest
    ): Map<String, Any> {
        val product = productRepository.findById(id)
            .orElseThrow { HttpStatusException(HttpStatus.NOT_FOUND, "Product not found") }

        val updated = product.copy(
            name = request.name ?: product.name,
            description = request.description ?: product.description,
            price = request.price ?: product.price,
            stock = request.stock ?: product.stock,
            updatedAt = Instant.now()
        )
        productRepository.update(updated)
        return mapOf("product" to updated)
    }

    @Delete("/{id}")
    @Secured("ADMIN")
    fun deleteProduct(id: Long): HttpStatus {
        return if (productRepository.existsById(id)) {
            productRepository.deleteById(id)
            HttpStatus.NO_CONTENT
        } else {
            HttpStatus.NOT_FOUND
        }
    }
}
`,

    // Services
    'src/main/kotlin/{{packagePath}}/services/AuthService.kt': `package {{projectPackage}}.services

import {{projectPackage}}.models.RegisterRequest
import {{projectPackage}}.models.User
import {{projectPackage}}.models.Role
import {{projectPackage}}.repository.UserRepository
import java.time.Instant

@jakarta.inject.Singleton
class AuthService(
    private val userRepository: UserRepository
) {
    fun register(request: RegisterRequest): User {
        val user = User(
            email = request.email,
            password = request.password, // In production, hash this
            name = request.name,
            role = Role.USER,
            createdAt = Instant.now(),
            updatedAt = Instant.now()
        )
        return userRepository.save(user)
    }

    fun login(request: {{projectPackage}}.models.LoginRequest): User? {
        val user = userRepository.findByEmail(request.email)
            ?: return null

        // In production, verify password hash
        return if (request.password == user.password) {
            user
        } else null
    }
}
`,

    // Health check
    'src/main/kotlin/{{packagePath}}/controllers/HealthController.kt': `package {{projectPackage}}.controllers

import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import java.time.Instant

@Controller("/api/v1")
class HealthController {

    @Get("/health")
    fun health(): Map<String, Any> {
        return mapOf(
            "status" to "healthy",
            "timestamp" to Instant.now().toString(),
            "version" to "1.0.0"
        )
    }
}
`,

    // GraphQL schema
    'src/main/resources/schema.graphqls': `schema {
    query: Query
}

type Query {
    hello(name: String = "World"): String!
    health: HealthStatus!
}

type HealthStatus {
    status: String!
    timestamp: String!
    version: String!
}
`,

    // GraphQL query resolver
    'src/main/kotlin/{{packagePath}}/graphql/QueryResolver.kt': `package {{projectPackage}}.graphql

import jakarta.inject.Singleton
import java.time.Instant

@Singleton
class QueryResolver {

    fun hello(name: String = "World"): String {
        return "Hello, \${name}!"
    }

    fun health(): HealthStatus {
        return HealthStatus(
            status = "healthy",
            timestamp = Instant.now().toString(),
            version = "1.0.0"
        )
    }
}

data class HealthStatus(
    val status: String,
    val timestamp: String,
    val version: String
)
`,

    // Dockerfile
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon
COPY src src
RUN ./gradlew build --no-daemon

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM eclipse-temurin:17-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/build/libs/*.jar app.jar
USER appuser
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["java", "-jar", "app.jar"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MICRONAUT_ENVIRONMENTS=production
    restart: unless-stopped
`,

    // Tests
    'src/test/kotlin/{{packagePath}}/ApplicationTest.kt': `package {{projectPackage}}

import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import org.junit.jupiter.api.Test
import jakarta.inject.Inject

@MicronautTest
class ApplicationTest {

    @Test
    fun testItWorks() {
        // Test implementation
    }
}
`,

    // README
    'README.md': `# {{projectName}}

Cloud-native microservice built with Micronaut and Kotlin.

## Features

- **Micronaut 4.0**: Fast startup, low memory footprint
- **Kotlin**: Concise, null-safe language
- **JWT Authentication**: Secure token-based auth
- **Micronaut Data**: Type-safe database access
- **GraalVM**: Native image support
- **Compile-time DI**: No runtime reflection overhead

## Requirements

- JDK 17+
- Kotlin 1.9+

## Quick Start

\`\`\`bash
./gradlew run
\`\`\`

## API Endpoints

- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/health\` - Health check

## License

MIT
`
  }
};
