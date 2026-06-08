import { BackendTemplate } from '../types';

export const springBootKotlinTemplate: BackendTemplate = {
  id: 'spring-boot-kotlin',
  name: 'spring-boot-kotlin',
  displayName: 'Spring Boot (Kotlin)',
  description: 'Enterprise-grade framework for building production-ready applications with Kotlin',
  language: 'kotlin',
  framework: 'spring-boot',
  version: '1.0.0',
  tags: ['kotlin', 'spring-boot', 'enterprise', 'microservices', 'jwt', 'security'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],

  files: {
    // Gradle build file
    'build.gradle.kts': `import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("org.springframework.boot") version "3.2.0"
    id("io.spring.depend-management") version "1.1.4"
    kotlin("jvm") version "1.9.21"
    kotlin("plugin.spring") version "1.9.21"
    kotlin("plugin.jpa") version "1.9.21"
}

group = "{{projectGroup}}"
version = "0.0.1-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_21
}

repositories {
    mavenCentral()
}

extra["springCloudVersion"] = "2023.0.0"

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
    implementation("io.jsonwebtoken:jjwt-api:0.12.3")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.3")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.3")
    implementation("at.favre.lib:bcrypt:0.10.1")
    developmentOnly("org.springframework.boot:spring-boot-devtools")
    developmentOnly("com.h2database:h2")
    runtimeOnly("com.mysql:mysql-connector-j")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs += "-Xjsr305=strict"
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
`,

    // Settings
    'settings.gradle.kts': `rootProject.name = "{{projectNameSnake}}"
`,

    // Application properties
    'src/main/resources/application.properties': `# Server Configuration
server.port=8080
server.error.include-message=always
server.error.include-binding-errors=always

# Application Name
spring.application.name={{projectNameSnake}}

# H2 Database (Development)
spring.datasource.url=jdbc:h2:mem:{{projectNameSnake}}
spring.datasource.driverClassName=org.h2.Driver
spring.h2.console.enabled=true

# JPA/Hibernate
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true

# JWT Secret
app.jwt.secret=change-this-secret-in-production
app.jwt.expiration=604800000

# CORS
app.cors.allowed-origins=*

# Logging
logging.level.{{projectGroup}}=DEBUG
logging.level.org.springframework.web=INFO
logging.level.org.hibernate.SQL=DEBUG
`,

    // Main application
    'src/main/kotlin/{{projectPackage}}/{{projectNamePascal}}Application.kt': `package {{projectPackage}}

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class {{projectNamePascal}}Application

fun main(args: Array<String>) {
    runApplication<{{projectNamePascal}}Application>(*args)
}
`,

    // Config
    'src/main/kotlin/{{projectPackage}}/config/JwtConfig.kt': `package {{projectPackage}}.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import io.jsonwebtoken.JwtParserBuilder

@Configuration
class JwtConfig(
    @Value("\${app.jwt.secret}") private val secret: String,
    @Value("\${app.jwt.expiration}") private val expiration: Long
) {
    @Bean
    fun jwtParser(): JwtParserBuilder =
        JwtParserBuilder()
            .setSigningKey(secret)
            .setAllowedClockSkewSeconds(30)
}
`,

    // Security config
    'src/main/kotlin/{{projectPackage}}/config/SecurityConfig.kt': `package {{projectPackage}}.config

import {{projectPackage}}.security.JwtAuthenticationFilter
import {{projectPackage}}.security.JwtAuthenticationEntryPoint
import {{projectPackage}}.services.UserService
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
class SecurityConfig(
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
    private val jwtAuthenticationEntryPoint: JwtAuthenticationEntryPoint,
    private val userService: UserService
) {
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun authenticationManager(authenticationConfiguration: org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration): AuthenticationManager =
        authenticationConfiguration.authenticationManager

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .exceptionHandling { it.authenticationEntryPoint(jwtAuthenticationEntryPoint) }
            .authorizeHttpRequests { it.anyRequest().permitAll() }
            .addFilterBefore(jwtAuthenticationFilter, org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }
}
`,

    // Models
    'src/main/kotlin/{{projectPackage}}/models/User.kt': `package {{projectPackage}}.models

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(unique = true, nullable = false)
    val email: String,

    @Column(nullable = false)
    var password: String,

    @Column(nullable = false)
    val name: String,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    val role: Role = Role.USER,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(nullable = false)
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

    'src/main/kotlin/{{projectPackage}}/models/Product.kt': `package {{projectPackage}}.models

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "products")
data class Product(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val name: String,

    @Column(length = 1000)
    val description: String? = null,

    @Column(nullable = false)
    val price: Double,

    @Column(nullable = false)
    var stock: Int = 0,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(nullable = false)
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

    // Repository
    'src/main/kotlin/{{projectPackage}}/repository/UserRepository.kt': `package {{projectPackage}}.repository

import {{projectPackage}}.models.User
import {{projectPackage}}.models.Role
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.*

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): Optional<User>
    fun findByRole(role: Role): List<User>
}
`,

    'src/main/kotlin/{{projectPackage}}/repository/ProductRepository.kt': `package {{projectPackage}}.repository

import {{projectPackage}}.models.Product
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface ProductRepository : JpaRepository<Product, Long>
`,

    // Security
    'src/main/kotlin/{{projectPackage}}/security/JwtService.kt': `package {{projectPackage}}.security

import {{projectPackage}}.models.User
import io.jsonwebtoken.*
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.stereotype.Service
import java.util.*

@Service
class JwtService(
    @Value("\${app.jwt.secret}") private val secret: String,
    @Value("\${app.jwt.expiration}") private val expiration: Long
) {
    private val key = Keys.hmacShaKeyFor(secret.toByteArray())

    fun generateToken(user: User): String {
        val claims = Jwts.claims()
            .setSubject(user.id.toString())
            .claim("email", user.email)
            .claim("role", user.role.name)
            .setIssuedAt(Date())
            .setExpiration(Date(System.currentTimeMillis() + expiration))

        return Jwts.builder()
            .setClaims(claims)
            .signWith(key)
            .compact()
    }

    fun extractClaims(token: String): Claims? {
        return try {
            Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .body
        } catch (e: Exception) {
            null
        }
    }

    fun extractUserId(claims: Claims): Long = claims.subject.toLong()
}
`,

    'src/main/kotlin/{{projectPackage}}/security/JwtAuthenticationFilter.kt': `package {{projectPackage}}.security

import {{projectPackage}}.security.UserDetailsServiceImpl
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthenticationFilter(
    private val jwtService: JwtService,
    private val userDetailsService: UserDetailsService
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val authHeader = request.getHeader("Authorization")

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            val token = authHeader.substring(7)
            val claims = jwtService.extractClaims(token)

            if (claims != null) {
                val userId = jwtService.extractUserId(claims)
                val userDetails = userDetailsService.loadUserByUsername(userId.toString())
                val authentication = UsernamePasswordAuthenticationToken(
                    userDetails,
                    null,
                    userDetails.authorities
                )
                authentication.details = WebAuthenticationDetailsSource().buildDetails(request)
                SecurityContextHolder.getContext().authentication = authentication
            }
        }

        filterChain.doFilter(request, response)
    }
}
`,

    'src/main/kotlin/{{projectPackage}}/security/JwtAuthenticationEntryPoint.kt': `package {{projectPackage}}.security

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.AuthenticationException
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.stereotype.Component
import com.fasterxml.jackson.databind.ObjectMapper

@Component
class JwtAuthenticationEntryPoint : AuthenticationEntryPoint {
    private val objectMapper = ObjectMapper()

    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException
    ) {
        response.status = HttpServletResponse.SC_UNAUTHORIZED
        response.contentType = "application/json"
        response.writer.write(objectMapper.writeValueAsString(mapOf("error" to "Unauthorized")))
    }
}
`,

    'src/main/kotlin/{{projectPackage}}/security/UserDetailsServiceImpl.kt': `package {{projectPackage}}.security

import {{projectPackage}}.models.User
import {{projectPackage}}.repository.UserRepository
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service

@Service
class UserDetailsServiceImpl(
    private val userRepository: UserRepository
) : UserDetailsService {

    override fun loadUserByUsername(username: String): UserDetails {
        val userId = username.toLong()
        val user = userRepository.findById(userId)
            .orElseThrow { UsernameNotFoundException("User not found") }

        return User(user.email, "", user.role.name, mutableListOf())
    }
}
`,

    // Controllers
    'src/main/kotlin/{{projectPackage}}/controllers/AuthController.kt': `package {{projectPackage}}.controllers

import {{projectPackage}}.models.*
import {{projectPackage}}.repository.UserRepository
import {{projectPackage}}.security.JwtService
import {{projectPackage}}.services.AuthService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val userRepository: UserRepository,
    private val authService: AuthService,
    private val jwtService: JwtService
) {
    @PostMapping("/register")
    fun register(@RequestBody request: RegisterRequest): ResponseEntity<AuthResponse> {
        if (userRepository.findByEmail(request.email).isPresent) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

        val user = authService.register(request)
        val token = jwtService.generateToken(user)

        val userResponse = UserResponse(user.id!!, user.email, user.name, user.role)
        return ResponseEntity.status(HttpStatus.CREATED).body(AuthResponse(token, userResponse))
    }

    @PostMapping("/login")
    fun login(@RequestBody request: LoginRequest): ResponseEntity<AuthResponse> {
        val user = authService.login(request)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()

        val token = jwtService.generateToken(user)
        val userResponse = UserResponse(user.id!!, user.email, user.name, user.role)
        return ResponseEntity.ok(AuthResponse(token, userResponse))
    }

    @PostMapping("/me")
    fun me(): ResponseEntity<UserResponse> {
        // In production: get user from SecurityContext
        val userResponse = UserResponse(1, "user@example.com", "Test User", Role.USER)
        return ResponseEntity.ok(userResponse)
    }
}
`,

    'src/main/kotlin/{{projectPackage}}/controllers/ProductController.kt': `package {{projectPackage}}.controllers

import {{projectPackage}}.models.*
import {{projectPackage}}.repository.ProductRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/products")
class ProductController(
    private val productRepository: ProductRepository
) {
    @GetMapping
    fun listProducts(): ResponseEntity<Map<String, Any>> {
        val products = productRepository.findAll()
        return ResponseEntity.ok(mapOf(
            "products" to products,
            "count" to products.size
        ))
    }

    @GetMapping("/{id}")
    fun getProduct(@PathVariable id: Long): ResponseEntity<Map<String, Any>> {
        val product = productRepository.findById(id)
        return product.map { ResponseEntity.ok(mapOf("product" to it)) }
            .orElse(ResponseEntity.notFound())
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    fun createProduct(@RequestBody request: CreateProductRequest): ResponseEntity<Map<String, Any>> {
        val product = Product(
            name = request.name,
            description = request.description,
            price = request.price,
            stock = request.stock
        )
        val saved = productRepository.save(product)
        return ResponseEntity.status(HttpStatus.CREATED).body(mapOf("product" to saved))
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    fun updateProduct(
        @PathVariable id: Long,
        @RequestBody request: UpdateProductRequest
    ): ResponseEntity<Map<String, Any>> {
        val product = productRepository.findById(id)
        return product.map { existing ->
            val updated = existing.copy(
                name = request.name ?: existing.name,
                description = request.description ?: existing.description,
                price = request.price ?: existing.price,
                stock = request.stock ?: existing.stock,
                updatedAt = java.time.Instant.now()
            )
            productRepository.save(updated)
            ResponseEntity.ok(mapOf("product" to updated))
        }.orElse(ResponseEntity.notFound())
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    fun deleteProduct(@PathVariable id: Long): ResponseEntity<Void> {
        return if (productRepository.existsById(id)) {
            productRepository.deleteById(id)
            ResponseEntity.noContent()
        } else {
            ResponseEntity.notFound()
        }
    }
}
`,

    // Services
    'src/main/kotlin/{{projectPackage}}/services/AuthService.kt': `package {{projectPackage}}.services

import {{projectPackage}}.models.RegisterRequest
import {{projectPackage}}.models.User
import {{projectPackage}}.repository.UserRepository
import org.springframework.security.crypto.password.PasswordEncoder
import java.time.Instant

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder
) {
    fun register(request: RegisterRequest): User {
        val user = User(
            email = request.email,
            password = passwordEncoder.encode(request.password),
            name = request.name,
            role = {{projectPackage}}.models.Role.USER,
            createdAt = Instant.now(),
            updatedAt = Instant.now()
        )
        return userRepository.save(user)
    }

    fun login(request: {{projectPackage}}.models.LoginRequest): User? {
        val user = userRepository.findByEmail(request.email)
            .orElse(null) ?: return null

        return if (passwordEncoder.matches(request.password, user.password)) {
            user
        } else null
    }
}
`,

    // Dockerfile
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
VOLUME /tmp
COPY build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon
COPY src src
RUN ./gradlew clean build --no-daemon

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM eclipse-temurin:21-jre-alpine

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
    CMD curl -f http://localhost:8080/actuator/health || exit 1

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
      - SPRING_PROFILES_ACTIVE=production
    restart: unless-stopped
`,

    // Tests
    'src/test/kotlin/{{projectPackage}}/{{projectNamePascal}}ApplicationTests.kt': `package {{projectPackage}}

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("test")
class {{projectNamePascal}}ApplicationTests {

    @Test
    fun contextLoads() {
    }
}
`,

    // README
    'README.md': `# {{projectName}}

Enterprise REST API built with Spring Boot and Kotlin.

## Features

- **Spring Boot 3.2**: Latest Spring Boot framework
- **Kotlin**: Concise, null-safe language
- **Spring Security**: JWT authentication
- **Spring Data JPA**: Database abstraction
- **Validation**: Request validation
- **WebSocket**: Real-time communication

## Requirements

- JDK 21+
- Kotlin 1.9+

## Quick Start

\`\`\`bash
./gradlew bootRun
\`\`\`

## API Endpoints

- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## License

MIT
`
  }
};
