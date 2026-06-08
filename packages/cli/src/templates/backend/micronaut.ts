import { BackendTemplate } from '../types';

export const micronautTemplate: BackendTemplate = {
  id: 'micronaut',
  name: 'Micronaut',
  displayName: 'Micronaut Framework',
  description: 'Modern JVM-based framework with dependency injection, AOP, and cloud-native features',
  version: '4.2.0',
  framework: 'micronaut',
  language: 'java',
  port: 8080,
  tags: ['microservices', 'cloud-native', 'reactive', 'middleware', 'aop'],
  features: [
    'authentication',
    'authorization',
    'database',
    'caching',
    'logging',
    'monitoring',
    'testing',
    'documentation',
    'security',
    'validation',
    'rest-api',
    'graphql',
    'microservices',
    'docker'
  ],
  dependencies: {},
  devDependencies: {},
  postInstall: [
    'echo "✅ Micronaut project created successfully!"',
    'echo "📦 Installing dependencies..."',
    './mvnw clean compile',
    'echo "🚀 Start development server: ./mvnw mn:run"',
    'echo "📚 API Documentation: http://localhost:{{port}}/swagger-ui"'
  ],
  files: {
    'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>{{packageName}}</groupId>
  <artifactId>{{serviceName}}</artifactId>
  <version>0.1</version>
  <packaging>jar</packaging>
  
  <parent>
    <groupId>io.micronaut.platform</groupId>
    <artifactId>micronaut-parent</artifactId>
    <version>4.2.0</version>
  </parent>
  
  <properties>
    <packaging>jar</packaging>
    <jdk.version>17</jdk.version>
    <release.version>17</release.version>
    <micronaut.version>4.2.0</micronaut.version>
    <micronaut.runtime>netty</micronaut.runtime>
    <micronaut.data.version>4.2.0</micronaut.data.version>
    <exec.mainClass>{{packageName}}.Application</exec.mainClass>
  </properties>
  
  <repositories>
    <repository>
      <id>central</id>
      <url>https://repo.maven.apache.org/maven2</url>
    </repository>
  </repositories>
  
  <dependencies>
    <!-- Micronaut Core -->
    <dependency>
      <groupId>io.micronaut</groupId>
      <artifactId>micronaut-inject</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut</groupId>
      <artifactId>micronaut-runtime</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut</groupId>
      <artifactId>micronaut-http-server-netty</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut</groupId>
      <artifactId>micronaut-http-client</artifactId>
    </dependency>
    
    <!-- Validation -->
    <dependency>
      <groupId>io.micronaut.validation</groupId>
      <artifactId>micronaut-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>jakarta.validation</groupId>
      <artifactId>jakarta.validation-api</artifactId>
    </dependency>
    
    <!-- Security -->
    <dependency>
      <groupId>io.micronaut.security</groupId>
      <artifactId>micronaut-security-jwt</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut.security</groupId>
      <artifactId>micronaut-security-annotations</artifactId>
    </dependency>
    
    <!-- Data Access -->
    <dependency>
      <groupId>io.micronaut.data</groupId>
      <artifactId>micronaut-data-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut.sql</groupId>
      <artifactId>micronaut-jdbc-hikari</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut.flyway</groupId>
      <artifactId>micronaut-flyway</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    
    <!-- Cache -->
    <dependency>
      <groupId>io.micronaut.cache</groupId>
      <artifactId>micronaut-cache-caffeine</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut.redis</groupId>
      <artifactId>micronaut-redis-lettuce</artifactId>
    </dependency>
    
    <!-- OpenAPI -->
    <dependency>
      <groupId>io.micronaut.openapi</groupId>
      <artifactId>micronaut-openapi</artifactId>
    </dependency>
    
    <!-- Monitoring -->
    <dependency>
      <groupId>io.micronaut.micrometer</groupId>
      <artifactId>micronaut-micrometer-core</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut.micrometer</groupId>
      <artifactId>micronaut-micrometer-registry-prometheus</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micronaut</groupId>
      <artifactId>micronaut-management</artifactId>
    </dependency>
    
    <!-- AOP -->
    <dependency>
      <groupId>io.micronaut</groupId>
      <artifactId>micronaut-aop</artifactId>
    </dependency>
    
    <!-- Serialization -->
    <dependency>
      <groupId>io.micronaut.serde</groupId>
      <artifactId>micronaut-serde-jackson</artifactId>
    </dependency>
    
    <!-- Logging -->
    <dependency>
      <groupId>ch.qos.logback</groupId>
      <artifactId>logback-classic</artifactId>
      <scope>runtime</scope>
    </dependency>
    
    <!-- Testing -->
    <dependency>
      <groupId>io.micronaut.test</groupId>
      <artifactId>micronaut-test-junit5</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter-api</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter-engine</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.mockito</groupId>
      <artifactId>mockito-core</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>testcontainers</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>postgresql</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
  
  <build>
    <plugins>
      <plugin>
        <groupId>io.micronaut.maven</groupId>
        <artifactId>micronaut-maven-plugin</artifactId>
        <configuration>
          <configFile>aot-\${packaging}.properties</configFile>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-enforcer-plugin</artifactId>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <configuration>
          <annotationProcessorPaths combine.self="override">
            <path>
              <groupId>io.micronaut</groupId>
              <artifactId>micronaut-inject-java</artifactId>
              <version>\${micronaut.core.version}</version>
            </path>
            <path>
              <groupId>io.micronaut.data</groupId>
              <artifactId>micronaut-data-processor</artifactId>
              <version>\${micronaut.data.version}</version>
            </path>
            <path>
              <groupId>io.micronaut</groupId>
              <artifactId>micronaut-graal</artifactId>
              <version>\${micronaut.core.version}</version>
            </path>
            <path>
              <groupId>io.micronaut.openapi</groupId>
              <artifactId>micronaut-openapi</artifactId>
              <version>\${micronaut.openapi.version}</version>
            </path>
            <path>
              <groupId>io.micronaut.serde</groupId>
              <artifactId>micronaut-serde-processor</artifactId>
              <version>\${micronaut.serialization.version}</version>
            </path>
            <path>
              <groupId>io.micronaut.validation</groupId>
              <artifactId>micronaut-validation-processor</artifactId>
              <version>\${micronaut.validation.version}</version>
            </path>
          </annotationProcessorPaths>
          <compilerArgs>
            <arg>-Amicronaut.processing.group={{packageName}}</arg>
            <arg>-Amicronaut.processing.module={{serviceName}}</arg>
          </compilerArgs>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`,
    'src/main/java/{{packagePath}}/Application.java': `package {{packageName}};

import io.micronaut.runtime.Micronaut;
import io.swagger.v3.oas.annotations.*;
import io.swagger.v3.oas.annotations.info.*;

@OpenAPIDefinition(
    info = @Info(
        title = "{{serviceName}}",
        version = "1.0",
        description = "{{description}}",
        contact = @Contact(name = "{{team}}", email = "{{team}}@{{org}}.com")
    )
)
public class Application {

    public static void main(String[] args) {
        Micronaut.run(Application.class, args);
    }
}
`,
    'src/main/java/{{packagePath}}/entity/User.java': `package {{packageName}}.entity;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.data.annotation.*;
import io.micronaut.serde.annotation.Serdeable;

import javax.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.Set;

@Serdeable
@Introspected
@MappedEntity("users")
public class User {
    
    @Id
    @GeneratedValue(GeneratedValue.Type.AUTO)
    private Long id;
    
    @NotBlank
    @Size(min = 3, max = 50)
    private String username;
    
    @NotBlank
    @Email
    private String email;
    
    @NotBlank
    private String password;
    
    private String firstName;
    
    private String lastName;
    
    private Set<String> roles;
    
    private boolean enabled = true;
    
    @DateCreated
    private LocalDateTime createdAt;
    
    @DateUpdated
    private LocalDateTime updatedAt;
    
    // Getters and setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public String getFirstName() {
        return firstName;
    }
    
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }
    
    public String getLastName() {
        return lastName;
    }
    
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
    
    public Set<String> getRoles() {
        return roles;
    }
    
    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }
    
    public boolean isEnabled() {
        return enabled;
    }
    
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
`,
    'src/main/java/{{packagePath}}/repository/UserRepository.java': `package {{packageName}}.repository;

import {{packageName}}.entity.User;
import io.micronaut.data.jdbc.annotation.JdbcRepository;
import io.micronaut.data.model.query.builder.sql.Dialect;
import io.micronaut.data.repository.PageableRepository;

import java.util.Optional;

@JdbcRepository(dialect = Dialect.POSTGRES)
public interface UserRepository extends PageableRepository<User, Long> {
    
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmail(String email);
    
    boolean existsByUsername(String username);
    
    boolean existsByEmail(String email);
    
    Optional<User> findByUsernameOrEmail(String username, String email);
}
`,
    'src/main/java/{{packagePath}}/service/UserService.java': `package {{packageName}}.service;

import {{packageName}}.dto.UserDto;
import {{packageName}}.entity.User;
import {{packageName}}.exception.ResourceNotFoundException;
import {{packageName}}.repository.UserRepository;
import io.micronaut.cache.annotation.*;
import io.micronaut.data.model.Page;
import io.micronaut.data.model.Pageable;
import io.micronaut.security.authentication.Authentication;
import io.micronaut.transaction.annotation.TransactionalAdvice;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.Set;

@Singleton
@TransactionalAdvice
public class UserService {
    
    private static final Logger LOG = LoggerFactory.getLogger(UserService.class);
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }
    
    @Cacheable("user-cache")
    public UserDto findById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return UserDto.fromEntity(user);
    }
    
    public UserDto findByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + username));
        return UserDto.fromEntity(user);
    }
    
    public Page<UserDto> findAll(Pageable pageable) {
        return userRepository.findAll(pageable)
                .map(UserDto::fromEntity);
    }
    
    public UserDto create(UserDto userDto) {
        if (userRepository.existsByUsername(userDto.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmail(userDto.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }
        
        User user = new User();
        user.setUsername(userDto.getUsername());
        user.setEmail(userDto.getEmail());
        user.setPassword(passwordEncoder.encode(userDto.getPassword()));
        user.setFirstName(userDto.getFirstName());
        user.setLastName(userDto.getLastName());
        
        Set<String> roles = new HashSet<>();
        roles.add("ROLE_USER");
        user.setRoles(roles);
        
        user = userRepository.save(user);
        LOG.info("Created new user: {}", user.getUsername());
        
        return UserDto.fromEntity(user);
    }
    
    @CacheInvalidate("user-cache")
    public UserDto update(Long id, UserDto userDto) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        if (userDto.getFirstName() != null) {
            user.setFirstName(userDto.getFirstName());
        }
        if (userDto.getLastName() != null) {
            user.setLastName(userDto.getLastName());
        }
        if (userDto.getEmail() != null && !userDto.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(userDto.getEmail())) {
                throw new IllegalArgumentException("Email already exists");
            }
            user.setEmail(userDto.getEmail());
        }
        
        user = userRepository.update(user);
        LOG.info("Updated user: {}", user.getUsername());
        
        return UserDto.fromEntity(user);
    }
    
    @CacheInvalidate("user-cache")
    public void delete(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        userRepository.delete(user);
        LOG.info("Deleted user: {}", user.getUsername());
    }
    
    public boolean checkPassword(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElse(null);
        
        if (user == null) {
            user = userRepository.findByEmail(username)
                    .orElse(null);
        }
        
        return user != null && passwordEncoder.matches(password, user.getPassword());
    }
}
`,
    'src/main/java/{{packagePath}}/controller/UserController.java': `package {{packageName}}.controller;

import {{packageName}}.dto.UserDto;
import {{packageName}}.service.UserService;
import io.micronaut.data.model.Page;
import io.micronaut.data.model.Pageable;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.*;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.validation.Validated;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import javax.validation.Valid;

@Validated
@Controller("/api/users")
@Tag(name = "User Management", description = "User management endpoints")
public class UserController {
    
    private final UserService userService;
    
    public UserController(UserService userService) {
        this.userService = userService;
    }
    
    @Get
    @Secured("ROLE_ADMIN")
    @Operation(summary = "Get all users", description = "Retrieve a paginated list of users")
    @ApiResponse(responseCode = "200", description = "List of users",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = Page.class)))
    public HttpResponse<Page<UserDto>> getUsers(Pageable pageable) {
        return HttpResponse.ok(userService.findAll(pageable));
    }
    
    @Get("/{id}")
    @Secured(SecurityRule.IS_AUTHENTICATED)
    @Operation(summary = "Get user by ID", description = "Retrieve a specific user")
    @ApiResponse(responseCode = "200", description = "User found",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = UserDto.class)))
    @ApiResponse(responseCode = "404", description = "User not found")
    public HttpResponse<UserDto> getUser(Long id) {
        return HttpResponse.ok(userService.findById(id));
    }
    
    @Post
    @Secured("ROLE_ADMIN")
    @Operation(summary = "Create user", description = "Create a new user")
    @ApiResponse(responseCode = "201", description = "User created",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = UserDto.class)))
    @ApiResponse(responseCode = "400", description = "Invalid input")
    public HttpResponse<UserDto> createUser(@Body @Valid UserDto userDto) {
        return HttpResponse.created(userService.create(userDto));
    }
    
    @Put("/{id}")
    @Secured(SecurityRule.IS_AUTHENTICATED)
    @Operation(summary = "Update user", description = "Update an existing user")
    @ApiResponse(responseCode = "200", description = "User updated",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = UserDto.class)))
    @ApiResponse(responseCode = "404", description = "User not found")
    public HttpResponse<UserDto> updateUser(Long id, @Body @Valid UserDto userDto) {
        return HttpResponse.ok(userService.update(id, userDto));
    }
    
    @Delete("/{id}")
    @Secured("ROLE_ADMIN")
    @Operation(summary = "Delete user", description = "Delete a user")
    @ApiResponse(responseCode = "204", description = "User deleted")
    @ApiResponse(responseCode = "404", description = "User not found")
    public HttpResponse<Void> deleteUser(Long id) {
        userService.delete(id);
        return HttpResponse.noContent();
    }
}
`,
    'src/main/java/{{packagePath}}/controller/AuthController.java': `package {{packageName}}.controller;

import {{packageName}}.dto.*;
import {{packageName}}.service.AuthService;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.*;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.validation.Validated;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import javax.validation.Valid;

@Validated
@Controller("/api/auth")
@Secured(SecurityRule.IS_ANONYMOUS)
@Tag(name = "Authentication", description = "Authentication endpoints")
public class AuthController {
    
    private final AuthService authService;
    
    public AuthController(AuthService authService) {
        this.authService = authService;
    }
    
    @Post("/register")
    @Operation(summary = "Register new user", description = "Register a new user account")
    @ApiResponse(responseCode = "201", description = "User registered successfully",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = AuthResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid input or user already exists")
    public HttpResponse<AuthResponse> register(@Body @Valid RegisterRequest request) {
        return HttpResponse.created(authService.register(request));
    }
    
    @Post("/login")
    @Operation(summary = "Authenticate user", description = "Authenticate user and receive JWT token")
    @ApiResponse(responseCode = "200", description = "Authentication successful",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = AuthResponse.class)))
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    public HttpResponse<AuthResponse> login(@Body @Valid LoginRequest request) {
        return HttpResponse.ok(authService.authenticate(request));
    }
    
    @Post("/refresh")
    @Operation(summary = "Refresh token", description = "Refresh JWT token using refresh token")
    @ApiResponse(responseCode = "200", description = "Token refreshed successfully",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = AuthResponse.class)))
    @ApiResponse(responseCode = "401", description = "Invalid refresh token")
    public HttpResponse<AuthResponse> refresh(@QueryValue String refreshToken) {
        return HttpResponse.ok(authService.refreshToken(refreshToken));
    }
}
`,
    'src/main/java/{{packagePath}}/service/AuthService.java': `package {{packageName}}.service;

import {{packageName}}.dto.*;
import {{packageName}}.entity.User;
import {{packageName}}.security.AuthenticationProviderUserPassword;
import io.micronaut.security.authentication.UsernamePasswordCredentials;
import io.micronaut.security.token.jwt.generator.JwtTokenGenerator;
import io.micronaut.security.token.jwt.render.AccessRefreshToken;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Singleton
public class AuthService {
    
    private static final Logger LOG = LoggerFactory.getLogger(AuthService.class);
    
    private final UserService userService;
    private final JwtTokenGenerator tokenGenerator;
    private final AuthenticationProviderUserPassword authProvider;
    
    public AuthService(UserService userService, 
                      JwtTokenGenerator tokenGenerator,
                      AuthenticationProviderUserPassword authProvider) {
        this.userService = userService;
        this.tokenGenerator = tokenGenerator;
        this.authProvider = authProvider;
    }
    
    public AuthResponse register(RegisterRequest request) {
        UserDto userDto = new UserDto();
        userDto.setUsername(request.getUsername());
        userDto.setEmail(request.getEmail());
        userDto.setPassword(request.getPassword());
        userDto.setFirstName(request.getFirstName());
        userDto.setLastName(request.getLastName());
        
        UserDto createdUser = userService.create(userDto);
        
        // Generate tokens
        Map<String, Object> claims = new HashMap<>();
        claims.put("username", createdUser.getUsername());
        claims.put("email", createdUser.getEmail());
        claims.put("roles", createdUser.getRoles());
        
        Optional<String> accessToken = tokenGenerator.generateToken(claims);
        Optional<String> refreshToken = tokenGenerator.generateToken(claims);
        
        AuthResponse response = new AuthResponse();
        response.setAccessToken(accessToken.orElse(""));
        response.setRefreshToken(refreshToken.orElse(""));
        response.setTokenType("Bearer");
        response.setExpiresIn(3600L);
        response.setUser(createdUser);
        
        LOG.info("User registered successfully: {}", createdUser.getUsername());
        
        return response;
    }
    
    public AuthResponse authenticate(LoginRequest request) {
        var credentials = new UsernamePasswordCredentials(request.getUsername(), request.getPassword());
        var authResponse = authProvider.authenticate(null, credentials);
        
        if (authResponse.isAuthenticated()) {
            UserDto user = userService.findByUsername(authResponse.getAuthentication().get().getName());
            
            Map<String, Object> claims = new HashMap<>();
            claims.put("username", user.getUsername());
            claims.put("email", user.getEmail());
            claims.put("roles", user.getRoles());
            
            Optional<String> accessToken = tokenGenerator.generateToken(claims);
            Optional<String> refreshToken = tokenGenerator.generateToken(claims);
            
            AuthResponse response = new AuthResponse();
            response.setAccessToken(accessToken.orElse(""));
            response.setRefreshToken(refreshToken.orElse(""));
            response.setTokenType("Bearer");
            response.setExpiresIn(3600L);
            response.setUser(user);
            
            LOG.info("User authenticated successfully: {}", user.getUsername());
            
            return response;
        } else {
            throw new IllegalArgumentException("Invalid credentials");
        }
    }
    
    public AuthResponse refreshToken(String refreshToken) {
        // In a real implementation, validate the refresh token
        // For now, we'll generate new tokens
        
        // This is a simplified implementation
        // You should implement proper refresh token validation
        throw new UnsupportedOperationException("Refresh token not implemented");
    }
}
`,
    'src/main/java/{{packagePath}}/security/AuthenticationProviderUserPassword.java': `package {{packageName}}.security;

import {{packageName}}.service.UserService;
import io.micronaut.core.annotation.Nullable;
import io.micronaut.http.HttpRequest;
import io.micronaut.security.authentication.*;
import jakarta.inject.Singleton;
import org.reactivestreams.Publisher;
import reactor.core.publisher.Mono;

import java.util.Collections;

@Singleton
public class AuthenticationProviderUserPassword implements AuthenticationProvider {
    
    private final UserService userService;
    
    public AuthenticationProviderUserPassword(UserService userService) {
        this.userService = userService;
    }
    
    @Override
    public Publisher<AuthenticationResponse> authenticate(@Nullable HttpRequest<?> httpRequest,
                                                         AuthenticationRequest<?, ?> authenticationRequest) {
        String username = authenticationRequest.getIdentity().toString();
        String password = authenticationRequest.getSecret().toString();
        
        return Mono.create(emitter -> {
            if (userService.checkPassword(username, password)) {
                var userDto = userService.findByUsername(username);
                emitter.success(AuthenticationResponse.success(
                    username,
                    userDto.getRoles(),
                    Collections.singletonMap("email", userDto.getEmail())
                ));
            } else {
                emitter.error(AuthenticationResponse.exception());
            }
        });
    }
}
`,
    'src/main/java/{{packagePath}}/security/PasswordEncoder.java': `package {{packageName}}.security;

import jakarta.inject.Singleton;
import org.mindrot.jbcrypt.BCrypt;

@Singleton
public class PasswordEncoder {
    
    public String encode(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt());
    }
    
    public boolean matches(String password, String encodedPassword) {
        return BCrypt.checkpw(password, encodedPassword);
    }
}
`,
    'src/main/java/{{packagePath}}/dto/UserDto.java': `package {{packageName}}.dto;

import {{packageName}}.entity.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.Serdeable;

import javax.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.Set;

@Serdeable
@Introspected
public class UserDto {
    
    private Long id;
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;
    
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;
    
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;
    
    private String firstName;
    
    private String lastName;
    
    private Set<String> roles;
    
    private boolean enabled;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    // Static factory method
    public static UserDto fromEntity(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setRoles(user.getRoles());
        dto.setEnabled(user.isEnabled());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        return dto;
    }
    
    // Getters and setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public String getFirstName() {
        return firstName;
    }
    
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }
    
    public String getLastName() {
        return lastName;
    }
    
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
    
    public Set<String> getRoles() {
        return roles;
    }
    
    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }
    
    public boolean isEnabled() {
        return enabled;
    }
    
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
`,
    'src/main/java/{{packagePath}}/dto/LoginRequest.java': `package {{packageName}}.dto;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.Serdeable;

import javax.validation.constraints.NotBlank;

@Serdeable
@Introspected
public class LoginRequest {
    
    @NotBlank(message = "Username or email is required")
    private String username;
    
    @NotBlank(message = "Password is required")
    private String password;
    
    // Getters and setters
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
}
`,
    'src/main/java/{{packagePath}}/dto/RegisterRequest.java': `package {{packageName}}.dto;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.Serdeable;

import javax.validation.constraints.*;

@Serdeable
@Introspected
public class RegisterRequest {
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;
    
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;
    
    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;
    
    private String firstName;
    
    private String lastName;
    
    // Getters and setters
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public String getFirstName() {
        return firstName;
    }
    
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }
    
    public String getLastName() {
        return lastName;
    }
    
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
}
`,
    'src/main/java/{{packagePath}}/dto/AuthResponse.java': `package {{packageName}}.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.Serdeable;

@Serdeable
@Introspected
public class AuthResponse {
    
    @JsonProperty("access_token")
    private String accessToken;
    
    @JsonProperty("refresh_token")
    private String refreshToken;
    
    @JsonProperty("token_type")
    private String tokenType;
    
    @JsonProperty("expires_in")
    private Long expiresIn;
    
    private UserDto user;
    
    // Getters and setters
    public String getAccessToken() {
        return accessToken;
    }
    
    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }
    
    public String getRefreshToken() {
        return refreshToken;
    }
    
    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }
    
    public String getTokenType() {
        return tokenType;
    }
    
    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }
    
    public Long getExpiresIn() {
        return expiresIn;
    }
    
    public void setExpiresIn(Long expiresIn) {
        this.expiresIn = expiresIn;
    }
    
    public UserDto getUser() {
        return user;
    }
    
    public void setUser(UserDto user) {
        this.user = user;
    }
}
`,
    'src/main/java/{{packagePath}}/exception/ResourceNotFoundException.java': `package {{packageName}}.exception;

import io.micronaut.http.HttpStatus;
import io.micronaut.http.exceptions.HttpStatusException;

public class ResourceNotFoundException extends HttpStatusException {
    
    public ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
`,
    'src/main/java/{{packagePath}}/exception/GlobalExceptionHandler.java': `package {{packageName}}.exception;

import io.micronaut.context.annotation.Requires;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.annotation.Produces;
import io.micronaut.http.server.exceptions.ExceptionHandler;
import io.micronaut.http.server.exceptions.response.ErrorContext;
import io.micronaut.http.server.exceptions.response.ErrorResponseProcessor;
import jakarta.inject.Singleton;

import javax.validation.ConstraintViolationException;
import java.util.HashMap;
import java.util.Map;

@Produces
@Singleton
@Requires(classes = {ConstraintViolationException.class, ExceptionHandler.class})
public class GlobalExceptionHandler implements ExceptionHandler<Exception, HttpResponse<?>> {
    
    private final ErrorResponseProcessor<?> errorResponseProcessor;
    
    public GlobalExceptionHandler(ErrorResponseProcessor<?> errorResponseProcessor) {
        this.errorResponseProcessor = errorResponseProcessor;
    }
    
    @Override
    public HttpResponse<?> handle(HttpRequest request, Exception exception) {
        Map<String, Object> error = new HashMap<>();
        
        if (exception instanceof ResourceNotFoundException) {
            error.put("message", exception.getMessage());
            error.put("status", HttpStatus.NOT_FOUND.getCode());
            return HttpResponse.notFound(error);
        }
        
        if (exception instanceof IllegalArgumentException) {
            error.put("message", exception.getMessage());
            error.put("status", HttpStatus.BAD_REQUEST.getCode());
            return HttpResponse.badRequest(error);
        }
        
        if (exception instanceof ConstraintViolationException) {
            ConstraintViolationException cve = (ConstraintViolationException) exception;
            Map<String, String> violations = new HashMap<>();
            
            cve.getConstraintViolations().forEach(violation -> {
                String path = violation.getPropertyPath().toString();
                String message = violation.getMessage();
                violations.put(path, message);
            });
            
            error.put("message", "Validation failed");
            error.put("violations", violations);
            error.put("status", HttpStatus.BAD_REQUEST.getCode());
            return HttpResponse.badRequest(error);
        }
        
        error.put("message", "An unexpected error occurred");
        error.put("status", HttpStatus.INTERNAL_SERVER_ERROR.getCode());
        return HttpResponse.serverError(error);
    }
}
`,
    'src/main/java/{{packagePath}}/aop/LoggingInterceptor.java': `package {{packageName}}.aop;

import io.micronaut.aop.InterceptorBean;
import io.micronaut.aop.MethodInterceptor;
import io.micronaut.aop.MethodInvocationContext;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Singleton
@InterceptorBean(Loggable.class)
public class LoggingInterceptor implements MethodInterceptor<Object, Object> {
    
    private static final Logger LOG = LoggerFactory.getLogger(LoggingInterceptor.class);
    
    @Override
    public Object intercept(MethodInvocationContext<Object, Object> context) {
        String methodName = context.getMethodName();
        LOG.debug("Executing method: {}", methodName);
        
        long startTime = System.currentTimeMillis();
        
        try {
            Object result = context.proceed();
            long duration = System.currentTimeMillis() - startTime;
            LOG.debug("Method {} executed in {} ms", methodName, duration);
            return result;
        } catch (Exception e) {
            LOG.error("Method {} threw exception: {}", methodName, e.getMessage());
            throw e;
        }
    }
}
`,
    'src/main/java/{{packagePath}}/aop/Loggable.java': `package {{packageName}}.aop;

import io.micronaut.aop.Around;
import io.micronaut.context.annotation.Type;

import java.lang.annotation.*;

@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Around
@Type(LoggingInterceptor.class)
public @interface Loggable {
}
`,
    'src/main/java/{{packagePath}}/health/DatabaseHealthIndicator.java': `package {{packageName}}.health;

import io.micronaut.health.HealthStatus;
import io.micronaut.management.health.indicator.HealthIndicator;
import io.micronaut.management.health.indicator.HealthResult;
import jakarta.inject.Singleton;
import org.reactivestreams.Publisher;
import reactor.core.publisher.Mono;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@Singleton
public class DatabaseHealthIndicator implements HealthIndicator {
    
    private final DataSource dataSource;
    
    public DatabaseHealthIndicator(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public Publisher<HealthResult> getResult() {
        return Mono.fromCallable(() -> {
            try (Connection connection = dataSource.getConnection()) {
                if (connection.isValid(1)) {
                    return HealthResult.builder("database")
                            .status(HealthStatus.UP)
                            .details("Database connection is healthy")
                            .build();
                }
            } catch (SQLException e) {
                return HealthResult.builder("database")
                        .status(HealthStatus.DOWN)
                        .details("Database connection failed: " + e.getMessage())
                        .build();
            }
            
            return HealthResult.builder("database")
                    .status(HealthStatus.DOWN)
                    .details("Database connection is not valid")
                    .build();
        });
    }
}
`,
    'src/main/resources/application.yml': `micronaut:
  application:
    name: {{serviceName}}
  server:
    port: {{port}}
    cors:
      enabled: true
      configurations:
        web:
          allowedOrigins:
            - http://localhost:3000
            - http://localhost:5173
          allowedMethods:
            - GET
            - POST
            - PUT
            - DELETE
            - OPTIONS
          allowedHeaders:
            - "*"
          exposedHeaders:
            - Authorization
  security:
    enabled: true
    endpoints:
      login:
        enabled: true
      logout:
        enabled: true
    intercept-url-map:
      - pattern: /swagger/**
        access:
          - isAnonymous()
      - pattern: /swagger-ui/**
        access:
          - isAnonymous()
      - pattern: /api/auth/**
        access:
          - isAnonymous()
    authentication: bearer
    token:
      jwt:
        signatures:
          secret:
            generator:
              secret: "\${JWT_SECRET:pleaseChangeThisSecretForANewOne}"
              jws-algorithm: HS256
        generator:
          refresh-token:
            secret: "\${JWT_REFRESH_SECRET:pleaseChangeThisRefreshSecretForANewOne}"
          access-token:
            expiration: 3600
  router:
    static-resources:
      swagger:
        paths: classpath:META-INF/swagger
        mapping: /swagger/**
      swagger-ui:
        paths: classpath:META-INF/swagger/views/swagger-ui
        mapping: /swagger-ui/**

datasources:
  default:
    url: jdbc:postgresql://\${DB_HOST:localhost}:\${DB_PORT:5432}/\${DB_NAME:{{serviceName}}_db}
    driverClassName: org.postgresql.Driver
    username: \${DB_USERNAME:postgres}
    password: \${DB_PASSWORD:postgres}
    schema-generate: NONE
    dialect: POSTGRES

flyway:
  datasources:
    default:
      enabled: true
      locations:
        - classpath:db/migration

redis:
  uri: redis://\${REDIS_HOST:localhost}:\${REDIS_PORT:6379}
  
cache:
  user-cache:
    expire-after-write: 10m
    maximum-size: 1000

jackson:
  serialization:
    write-dates-as-timestamps: false
  deserialization:
    fail-on-unknown-properties: false

endpoints:
  all:
    path: /management
    sensitive: false
  health:
    enabled: true
    sensitive: false
    details-visible: ANONYMOUS
  metrics:
    enabled: true
    sensitive: false
  prometheus:
    enabled: true
    sensitive: false

micronaut.metrics:
  enabled: true
  export:
    prometheus:
      enabled: true
      step: PT1M
      descriptions: true
`,
    'src/main/resources/db/migration/V1__Create_users_table.sql': `CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    roles TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_enabled ON users(enabled);

-- Create admin user (password: admin123)
INSERT INTO users (username, email, password, first_name, last_name, roles) 
VALUES ('admin', 'admin@{{org}}.com', '$2a$10$mVWJ3N5pJ.6KJxPl8XhKaOjFqQH.Y3bg8gFRT6bCBLrJWBZwJvj9S', 'Admin', 'User', 'ROLE_ADMIN,ROLE_USER');
`,
    'src/main/resources/logback.xml': `<configuration>

    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <withJansi>true</withJansi>
        <encoder>
            <pattern>%cyan(%d{HH:mm:ss.SSS}) %gray([%thread]) %highlight(%-5level) %magenta(%logger{36}) - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="info">
        <appender-ref ref="STDOUT" />
    </root>
    
    <logger name="{{packageName}}" level="debug" />
    <logger name="io.micronaut.http.server" level="debug" />
    <logger name="io.micronaut.data.query" level="debug" />
    
</configuration>
`,
    'src/test/java/{{packagePath}}/UserControllerTest.java': `package {{packageName}};

import {{packageName}}.dto.UserDto;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.client.HttpClient;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.http.client.exceptions.HttpClientResponseException;
import io.micronaut.security.authentication.UsernamePasswordCredentials;
import io.micronaut.security.token.jwt.render.BearerAccessRefreshToken;
import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@MicronautTest
public class UserControllerTest {
    
    @Inject
    @Client("/")
    HttpClient client;
    
    @Test
    void testGetUsersRequiresAuthentication() {
        HttpClientResponseException thrown = assertThrows(
            HttpClientResponseException.class,
            () -> client.toBlocking().exchange("/api/users")
        );
        
        assertEquals(HttpStatus.UNAUTHORIZED, thrown.getStatus());
    }
    
    @Test
    void testGetUsersWithAdminRole() {
        // First authenticate as admin
        UsernamePasswordCredentials creds = new UsernamePasswordCredentials("admin", "admin123");
        HttpRequest<?> request = HttpRequest.POST("/login", creds);
        BearerAccessRefreshToken token = client.toBlocking().retrieve(request, BearerAccessRefreshToken.class);
        
        // Then access users endpoint
        HttpRequest<?> usersRequest = HttpRequest.GET("/api/users")
                .bearerAuth(token.getAccessToken());
        
        String response = client.toBlocking().retrieve(usersRequest);
        assertNotNull(response);
    }
}
`,
    'src/test/java/{{packagePath}}/AuthControllerTest.java': `package {{packageName}};

import {{packageName}}.dto.*;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.client.HttpClient;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.http.client.exceptions.HttpClientResponseException;
import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@MicronautTest
public class AuthControllerTest {
    
    @Inject
    @Client("/")
    HttpClient client;
    
    @Test
    void testRegisterNewUser() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser_" + UUID.randomUUID());
        request.setEmail("test_" + UUID.randomUUID() + "@example.com");
        request.setPassword("password123");
        request.setFirstName("Test");
        request.setLastName("User");
        
        HttpRequest<RegisterRequest> httpRequest = HttpRequest.POST("/api/auth/register", request);
        AuthResponse response = client.toBlocking().retrieve(httpRequest, AuthResponse.class);
        
        assertNotNull(response);
        assertNotNull(response.getAccessToken());
        assertNotNull(response.getRefreshToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals(request.getUsername(), response.getUser().getUsername());
    }
    
    @Test
    void testLoginWithValidCredentials() {
        LoginRequest request = new LoginRequest();
        request.setUsername("admin");
        request.setPassword("admin123");
        
        HttpRequest<LoginRequest> httpRequest = HttpRequest.POST("/api/auth/login", request);
        AuthResponse response = client.toBlocking().retrieve(httpRequest, AuthResponse.class);
        
        assertNotNull(response);
        assertNotNull(response.getAccessToken());
        assertNotNull(response.getRefreshToken());
    }
    
    @Test
    void testLoginWithInvalidCredentials() {
        LoginRequest request = new LoginRequest();
        request.setUsername("admin");
        request.setPassword("wrongpassword");
        
        HttpRequest<LoginRequest> httpRequest = HttpRequest.POST("/api/auth/login", request);
        
        HttpClientResponseException thrown = assertThrows(
            HttpClientResponseException.class,
            () -> client.toBlocking().retrieve(httpRequest, AuthResponse.class)
        );
        
        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
    }
}
`,
    '.gitignore': `# Maven
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
release.properties

# Eclipse
.project
.classpath
.settings/
bin/

# IntelliJ
.idea
*.ipr
*.iml
*.iws

# NetBeans
nb-configuration.xml

# Visual Studio Code
.vscode
.factorypath

# OSX
.DS_Store

# Vim
*.swp
*.swo

# patch
*.orig
*.rej

# Local environment
.env

# Micronaut
.micronaut/
`,
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src src
RUN mvn clean package -DskipTests

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM eclipse-temurin:17-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/target/*-*.jar app.jar
USER appuser
EXPOSE {{port}}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:{{port}}/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
`,
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "{{port}}:{{port}}"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME={{serviceName}}_db
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=pleaseChangeThisSecretForANewOne
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB={{serviceName}}_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
`,
    'README.md': `# {{serviceName}}

{{description}}

## 🚀 Quick Start

### Prerequisites
- Java 17+
- Maven 3.8+
- PostgreSQL 15+
- Redis 7+

### Running in Development Mode

\`\`\`bash
./mvnw mn:run
\`\`\`

Your application is now running at http://localhost:{{port}}

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## 🧪 Testing

Run all tests:
\`\`\`bash
./mvnw test
\`\`\`

## 📚 API Documentation

- Swagger UI: http://localhost:{{port}}/swagger-ui
- OpenAPI Spec: http://localhost:{{port}}/swagger/{{serviceName}}-1.0.yml

## 🔒 Security

This application uses JWT for authentication:

1. Register: \`POST /api/auth/register\`
2. Login: \`POST /api/auth/login\`
3. Use the token in \`Authorization: Bearer <token>\` header

## 📊 Monitoring

- Health: http://localhost:{{port}}/management/health
- Metrics: http://localhost:{{port}}/management/metrics
- Prometheus: http://localhost:{{port}}/management/prometheus

## 🏗️ Architecture

- **Framework**: Micronaut 4.2
- **Security**: JWT with Micronaut Security
- **Database**: PostgreSQL with Micronaut Data JDBC
- **Caching**: Redis/Caffeine
- **Migrations**: Flyway
- **API Documentation**: OpenAPI with Swagger UI
- **Testing**: JUnit 5, Micronaut Test

## 🌟 Features

- ⚡ Fast startup time
- 🎯 Dependency injection with compile-time validation
- 🔄 Aspect-oriented programming (AOP) support
- 🔐 JWT authentication
- 📊 Built-in health checks and metrics
- 🧪 Comprehensive test coverage
- 📚 Auto-generated API documentation
- 🌍 Cloud-native ready
`
  }
};