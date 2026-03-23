import { BackendTemplate } from '../types';

export const quarkusTemplate: BackendTemplate = {
  id: 'quarkus',
  name: 'Quarkus',
  displayName: 'Quarkus Native',
  description: 'Cloud-native Java microservices with GraalVM native compilation support',
  version: '3.6.0',
  framework: 'quarkus',
  language: 'java',
  port: 8080,
  tags: ['cloud-native', 'microservices', 'reactive', 'graalvm', 'kubernetes'],
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
    'echo "✅ Quarkus project created successfully!"',
    'echo "📦 Installing dependencies..."',
    './mvnw clean install',
    'echo "🚀 Start development server: ./mvnw quarkus:dev"',
    'echo "📚 API Documentation: http://localhost:{{port}}/q/swagger-ui"',
    'echo "⚡ Build native image: ./mvnw package -Pnative"'
  ],
  files: {
    'pom.xml': `<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd" xmlns="http://maven.apache.org/POM/4.0.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <modelVersion>4.0.0</modelVersion>
  <groupId>{{packageName}}</groupId>
  <artifactId>{{serviceName}}</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <properties>
    <compiler-plugin.version>3.11.0</compiler-plugin.version>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
    <quarkus.platform.artifact-id>quarkus-bom</quarkus.platform.artifact-id>
    <quarkus.platform.group-id>io.quarkus.platform</quarkus.platform.group-id>
    <quarkus.platform.version>3.6.0</quarkus.platform.version>
    <skipITs>true</skipITs>
    <surefire-plugin.version>3.1.2</surefire-plugin.version>
  </properties>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>\${quarkus.platform.group-id}</groupId>
        <artifactId>\${quarkus.platform.artifact-id}</artifactId>
        <version>\${quarkus.platform.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <!-- Core -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-resteasy-reactive-jackson</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-arc</artifactId>
    </dependency>
    
    <!-- Database -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-hibernate-orm-panache</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-jdbc-postgresql</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-flyway</artifactId>
    </dependency>
    
    <!-- Security -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-smallrye-jwt</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-security</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-elytron-security-properties-file</artifactId>
    </dependency>
    
    <!-- Caching -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-cache</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-redis-client</artifactId>
    </dependency>
    
    <!-- Validation -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-hibernate-validator</artifactId>
    </dependency>
    
    <!-- Health & Metrics -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-smallrye-health</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-micrometer</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
    </dependency>
    
    <!-- Documentation -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-smallrye-openapi</artifactId>
    </dependency>
    
    <!-- Reactive -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-reactive-pg-client</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-mutiny</artifactId>
    </dependency>
    
    <!-- Utilities -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-scheduler</artifactId>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-config-yaml</artifactId>
    </dependency>
    
    <!-- Testing -->
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-junit5</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.rest-assured</groupId>
      <artifactId>rest-assured</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-junit5-mockito</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-test-security-jwt</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.quarkus</groupId>
      <artifactId>quarkus-test-h2</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>\${quarkus.platform.group-id}</groupId>
        <artifactId>quarkus-maven-plugin</artifactId>
        <version>\${quarkus.platform.version}</version>
        <extensions>true</extensions>
        <executions>
          <execution>
            <goals>
              <goal>build</goal>
              <goal>generate-code</goal>
              <goal>generate-code-tests</goal>
            </goals>
          </execution>
        </executions>
      </plugin>
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>\${compiler-plugin.version}</version>
        <configuration>
          <compilerArgs>
            <arg>-parameters</arg>
          </compilerArgs>
        </configuration>
      </plugin>
      <plugin>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>\${surefire-plugin.version}</version>
        <configuration>
          <systemPropertyVariables>
            <java.util.logging.manager>org.jboss.logmanager.LogManager</java.util.logging.manager>
            <maven.home>\${maven.home}</maven.home>
          </systemPropertyVariables>
        </configuration>
      </plugin>
      <plugin>
        <artifactId>maven-failsafe-plugin</artifactId>
        <version>\${surefire-plugin.version}</version>
        <executions>
          <execution>
            <goals>
              <goal>integration-test</goal>
              <goal>verify</goal>
            </goals>
            <configuration>
              <systemPropertyVariables>
                <native.image.path>\${project.build.directory}/\${project.build.finalName}-runner</native.image.path>
                <java.util.logging.manager>org.jboss.logmanager.LogManager</java.util.logging.manager>
                <maven.home>\${maven.home}</maven.home>
              </systemPropertyVariables>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
  <profiles>
    <profile>
      <id>native</id>
      <activation>
        <property>
          <name>native</name>
        </property>
      </activation>
      <properties>
        <skipITs>false</skipITs>
        <quarkus.package.type>native</quarkus.package.type>
      </properties>
    </profile>
  </profiles>
</project>
`,
    'src/main/java/{{packagePath}}/entity/User.java': `package {{packageName}}.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import io.quarkus.security.jpa.Password;
import io.quarkus.security.jpa.Roles;
import io.quarkus.security.jpa.UserDefinition;
import io.quarkus.security.jpa.Username;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@UserDefinition
public class User extends PanacheEntityBase {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    
    @Username
    @Column(unique = true, nullable = false)
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50)
    public String username;
    
    @Column(unique = true, nullable = false)
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    public String email;
    
    @Password
    @Column(nullable = false)
    @NotBlank(message = "Password is required")
    public String password;
    
    @Column(name = "first_name")
    public String firstName;
    
    @Column(name = "last_name")
    public String lastName;
    
    @Roles
    @Column(nullable = false)
    public String roles = "user";
    
    @Column(nullable = false)
    public boolean active = true;
    
    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;
    
    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public static User findByUsername(String username) {
        return find("username", username).firstResult();
    }
    
    public static User findByEmail(String email) {
        return find("email", email).firstResult();
    }
    
    public static boolean existsByUsername(String username) {
        return count("username", username) > 0;
    }
    
    public static boolean existsByEmail(String email) {
        return count("email", email) > 0;
    }
}
`,
    'src/main/java/{{packagePath}}/resource/UserResource.java': `package {{packageName}}.resource;

import {{packageName}}.dto.UserDto;
import {{packageName}}.entity.User;
import {{packageName}}.service.UserService;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import java.util.List;
import java.util.stream.Collectors;

@Path("/api/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "User Management", description = "User management endpoints")
public class UserResource {
    
    @Inject
    UserService userService;
    
    @GET
    @RolesAllowed("admin")
    @Operation(summary = "Get all users", description = "Retrieve a paginated list of users")
    @APIResponse(responseCode = "200", description = "List of users",
        content = @Content(mediaType = "application/json", 
            schema = @Schema(implementation = UserDto.class, type = "array")))
    public Response getUsers(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size,
            @QueryParam("sort") @DefaultValue("id") String sort) {
        
        List<User> users = User.findAll(Sort.by(sort))
            .page(Page.of(page, size))
            .list();
        
        List<UserDto> userDtos = users.stream()
            .map(UserDto::from)
            .collect(Collectors.toList());
        
        return Response.ok(userDtos).build();
    }
    
    @GET
    @Path("/{id}")
    @RolesAllowed({"admin", "user"})
    @Operation(summary = "Get user by ID", description = "Retrieve a specific user")
    @APIResponse(responseCode = "200", description = "User found",
        content = @Content(mediaType = "application/json", 
            schema = @Schema(implementation = UserDto.class)))
    @APIResponse(responseCode = "404", description = "User not found")
    public Response getUser(@PathParam("id") Long id) {
        User user = User.findById(id);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(UserDto.from(user)).build();
    }
    
    @POST
    @Transactional
    @RolesAllowed("admin")
    @Operation(summary = "Create user", description = "Create a new user")
    @APIResponse(responseCode = "201", description = "User created",
        content = @Content(mediaType = "application/json", 
            schema = @Schema(implementation = UserDto.class)))
    @APIResponse(responseCode = "400", description = "Invalid input")
    public Response createUser(@Valid UserDto userDto) {
        User user = userService.createUser(userDto);
        return Response.status(Response.Status.CREATED)
            .entity(UserDto.from(user))
            .build();
    }
    
    @PUT
    @Path("/{id}")
    @Transactional
    @RolesAllowed({"admin", "user"})
    @Operation(summary = "Update user", description = "Update an existing user")
    @APIResponse(responseCode = "200", description = "User updated",
        content = @Content(mediaType = "application/json", 
            schema = @Schema(implementation = UserDto.class)))
    @APIResponse(responseCode = "404", description = "User not found")
    public Response updateUser(@PathParam("id") Long id, @Valid UserDto userDto) {
        User user = userService.updateUser(id, userDto);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(UserDto.from(user)).build();
    }
    
    @DELETE
    @Path("/{id}")
    @Transactional
    @RolesAllowed("admin")
    @Operation(summary = "Delete user", description = "Delete a user")
    @APIResponse(responseCode = "204", description = "User deleted")
    @APIResponse(responseCode = "404", description = "User not found")
    public Response deleteUser(@PathParam("id") Long id) {
        boolean deleted = User.deleteById(id);
        if (!deleted) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.noContent().build();
    }
}
`,
    'src/main/java/{{packagePath}}/resource/AuthResource.java': `package {{packageName}}.resource;

import {{packageName}}.dto.*;
import {{packageName}}.service.AuthService;
import io.quarkus.cache.CacheInvalidate;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Authentication", description = "Authentication endpoints")
public class AuthResource {
    
    @Inject
    AuthService authService;
    
    @POST
    @Path("/register")
    @Transactional
    @Operation(summary = "Register new user", description = "Register a new user account")
    @APIResponse(responseCode = "201", description = "User registered successfully",
        content = @Content(mediaType = "application/json", 
            schema = @Schema(implementation = AuthResponse.class)))
    @APIResponse(responseCode = "400", description = "Invalid input or user already exists")
    public Response register(@Valid RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }
    
    @POST
    @Path("/login")
    @Operation(summary = "Authenticate user", description = "Authenticate user and receive JWT token")
    @APIResponse(responseCode = "200", description = "Authentication successful",
        content = @Content(mediaType = "application/json", 
            schema = @Schema(implementation = AuthResponse.class)))
    @APIResponse(responseCode = "401", description = "Invalid credentials")
    public Response login(@Valid LoginRequest request) {
        AuthResponse response = authService.authenticate(request);
        return Response.ok(response).build();
    }
    
    @POST
    @Path("/refresh")
    @Operation(summary = "Refresh token", description = "Refresh JWT token using refresh token")
    @APIResponse(responseCode = "200", description = "Token refreshed successfully",
        content = @Content(mediaType = "application/json", 
            schema = @Schema(implementation = AuthResponse.class)))
    @APIResponse(responseCode = "401", description = "Invalid refresh token")
    public Response refresh(@QueryParam("token") String refreshToken) {
        AuthResponse response = authService.refreshToken(refreshToken);
        return Response.ok(response).build();
    }
    
    @POST
    @Path("/logout")
    @CacheInvalidate(cacheName = "user-cache")
    @Operation(summary = "Logout user", description = "Logout user and invalidate tokens")
    @APIResponse(responseCode = "204", description = "Logout successful")
    public Response logout() {
        // In a real application, you would invalidate the token here
        return Response.noContent().build();
    }
}
`,
    'src/main/java/{{packagePath}}/service/UserService.java': `package {{packageName}}.service;

import {{packageName}}.dto.UserDto;
import {{packageName}}.entity.User;
import io.quarkus.cache.CacheInvalidate;
import io.quarkus.cache.CacheResult;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class UserService {
    
    @CacheResult(cacheName = "user-cache")
    public User getUserById(Long id) {
        return User.findById(id);
    }
    
    @Transactional
    public User createUser(UserDto userDto) {
        if (User.existsByUsername(userDto.username)) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (User.existsByEmail(userDto.email)) {
            throw new IllegalArgumentException("Email already exists");
        }
        
        User user = new User();
        user.username = userDto.username;
        user.email = userDto.email;
        user.password = BcryptUtil.bcryptHash(userDto.password);
        user.firstName = userDto.firstName;
        user.lastName = userDto.lastName;
        user.roles = "user";
        user.persist();
        
        return user;
    }
    
    @Transactional
    @CacheInvalidate(cacheName = "user-cache")
    public User updateUser(Long id, UserDto userDto) {
        User user = User.findById(id);
        if (user == null) {
            return null;
        }
        
        if (userDto.firstName != null) {
            user.firstName = userDto.firstName;
        }
        if (userDto.lastName != null) {
            user.lastName = userDto.lastName;
        }
        if (userDto.email != null && !userDto.email.equals(user.email)) {
            if (User.existsByEmail(userDto.email)) {
                throw new IllegalArgumentException("Email already exists");
            }
            user.email = userDto.email;
        }
        
        user.persist();
        return user;
    }
}
`,
    'src/main/java/{{packagePath}}/service/AuthService.java': `package {{packageName}}.service;

import {{packageName}}.dto.*;
import {{packageName}}.entity.User;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;
import java.util.Arrays;
import java.util.HashSet;

@ApplicationScoped
public class AuthService {
    
    @ConfigProperty(name = "mp.jwt.verify.issuer")
    String issuer;
    
    @ConfigProperty(name = "jwt.duration", defaultValue = "3600")
    Long duration;
    
    @ConfigProperty(name = "jwt.refresh.duration", defaultValue = "86400")
    Long refreshDuration;
    
    @Inject
    UserService userService;
    
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        UserDto userDto = new UserDto();
        userDto.username = request.username;
        userDto.email = request.email;
        userDto.password = request.password;
        userDto.firstName = request.firstName;
        userDto.lastName = request.lastName;
        
        User user = userService.createUser(userDto);
        
        String token = generateToken(user);
        String refreshToken = generateRefreshToken(user);
        
        return AuthResponse.builder()
            .accessToken(token)
            .refreshToken(refreshToken)
            .tokenType("Bearer")
            .expiresIn(duration)
            .user(UserDto.from(user))
            .build();
    }
    
    public AuthResponse authenticate(LoginRequest request) {
        User user = User.findByUsername(request.username);
        if (user == null) {
            user = User.findByEmail(request.username);
        }
        
        if (user == null || !BcryptUtil.matches(request.password, user.password)) {
            throw new WebApplicationException("Invalid credentials", 401);
        }
        
        if (!user.active) {
            throw new WebApplicationException("Account is disabled", 403);
        }
        
        String token = generateToken(user);
        String refreshToken = generateRefreshToken(user);
        
        return AuthResponse.builder()
            .accessToken(token)
            .refreshToken(refreshToken)
            .tokenType("Bearer")
            .expiresIn(duration)
            .user(UserDto.from(user))
            .build();
    }
    
    public AuthResponse refreshToken(String refreshToken) {
        // In a real application, you would validate the refresh token
        // For this example, we'll parse it and generate a new access token
        
        try {
            var parser = Jwt.parser().verify(refreshToken);
            String username = parser.getClaim("sub");
            
            User user = User.findByUsername(username);
            if (user == null || !user.active) {
                throw new WebApplicationException("Invalid token", 401);
            }
            
            String newToken = generateToken(user);
            
            return AuthResponse.builder()
                .accessToken(newToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(duration)
                .user(UserDto.from(user))
                .build();
        } catch (Exception e) {
            throw new WebApplicationException("Invalid refresh token", 401);
        }
    }
    
    private String generateToken(User user) {
        return Jwt.issuer(issuer)
            .upn(user.username)
            .subject(user.username)
            .groups(new HashSet<>(Arrays.asList(user.roles.split(","))))
            .claim("email", user.email)
            .claim("userId", user.id)
            .expiresIn(Duration.ofSeconds(duration))
            .sign();
    }
    
    private String generateRefreshToken(User user) {
        return Jwt.issuer(issuer)
            .upn(user.username)
            .subject(user.username)
            .claim("type", "refresh")
            .expiresIn(Duration.ofSeconds(refreshDuration))
            .sign();
    }
}
`,
    'src/main/java/{{packagePath}}/dto/UserDto.java': `package {{packageName}}.dto;

import {{packageName}}.entity.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class UserDto {
    
    public Long id;
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    public String username;
    
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    public String email;
    
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Size(min = 6, message = "Password must be at least 6 characters")
    public String password;
    
    public String firstName;
    
    public String lastName;
    
    public String roles;
    
    public boolean active;
    
    public LocalDateTime createdAt;
    
    public LocalDateTime updatedAt;
    
    public static UserDto from(User user) {
        UserDto dto = new UserDto();
        dto.id = user.id;
        dto.username = user.username;
        dto.email = user.email;
        dto.firstName = user.firstName;
        dto.lastName = user.lastName;
        dto.roles = user.roles;
        dto.active = user.active;
        dto.createdAt = user.createdAt;
        dto.updatedAt = user.updatedAt;
        return dto;
    }
}
`,
    'src/main/java/{{packagePath}}/dto/LoginRequest.java': `package {{packageName}}.dto;

import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
    
    @NotBlank(message = "Username or email is required")
    public String username;
    
    @NotBlank(message = "Password is required")
    public String password;
}
`,
    'src/main/java/{{packagePath}}/dto/RegisterRequest.java': `package {{packageName}}.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    public String username;
    
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    public String email;
    
    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    public String password;
    
    public String firstName;
    
    public String lastName;
}
`,
    'src/main/java/{{packagePath}}/dto/AuthResponse.java': `package {{packageName}}.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class AuthResponse {
    
    @JsonProperty("access_token")
    public String accessToken;
    
    @JsonProperty("refresh_token")
    public String refreshToken;
    
    @JsonProperty("token_type")
    public String tokenType;
    
    @JsonProperty("expires_in")
    public Long expiresIn;
    
    public UserDto user;
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private AuthResponse response = new AuthResponse();
        
        public Builder accessToken(String accessToken) {
            response.accessToken = accessToken;
            return this;
        }
        
        public Builder refreshToken(String refreshToken) {
            response.refreshToken = refreshToken;
            return this;
        }
        
        public Builder tokenType(String tokenType) {
            response.tokenType = tokenType;
            return this;
        }
        
        public Builder expiresIn(Long expiresIn) {
            response.expiresIn = expiresIn;
            return this;
        }
        
        public Builder user(UserDto user) {
            response.user = user;
            return this;
        }
        
        public AuthResponse build() {
            return response;
        }
    }
}
`,
    'src/main/java/{{packagePath}}/health/DatabaseHealthCheck.java': `package {{packageName}}.health;

import io.agroal.api.AgroalDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

import java.sql.Connection;
import java.sql.SQLException;

@Readiness
@ApplicationScoped
public class DatabaseHealthCheck implements HealthCheck {
    
    @Inject
    AgroalDataSource dataSource;
    
    @Override
    public HealthCheckResponse call() {
        HealthCheckResponse.HealthCheckResponseBuilder responseBuilder = HealthCheckResponse
            .named("Database connection health check");
        
        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(10);
            if (valid) {
                responseBuilder.up();
            } else {
                responseBuilder.down();
            }
        } catch (SQLException e) {
            responseBuilder.down()
                .withData("error", e.getMessage());
        }
        
        return responseBuilder.build();
    }
}
`,
    'src/main/java/{{packagePath}}/health/RedisHealthCheck.java': `package {{packageName}}.health;

import io.quarkus.redis.client.RedisClient;
import io.vertx.mutiny.redis.client.Response;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Liveness;

import java.time.Duration;

@Liveness
@ApplicationScoped
public class RedisHealthCheck implements HealthCheck {
    
    @Inject
    RedisClient redisClient;
    
    @Override
    public HealthCheckResponse call() {
        HealthCheckResponse.HealthCheckResponseBuilder responseBuilder = HealthCheckResponse
            .named("Redis connection health check");
        
        try {
            Response response = redisClient.ping()
                .onFailure()
                .retry()
                .atMost(3)
                .await()
                .atMost(Duration.ofSeconds(3));
            
            if (response != null && response.toString().equals("PONG")) {
                responseBuilder.up();
            } else {
                responseBuilder.down();
            }
        } catch (Exception e) {
            responseBuilder.down()
                .withData("error", e.getMessage());
        }
        
        return responseBuilder.build();
    }
}
`,
    'src/main/java/{{packagePath}}/exception/ErrorMapper.java': `package {{packageName}}.exception;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Provider
public class ErrorMapper implements ExceptionMapper<ConstraintViolationException> {
    
    @Override
    public Response toResponse(ConstraintViolationException e) {
        Map<String, Object> error = new HashMap<>();
        error.put("type", "validation_error");
        error.put("title", "Validation Failed");
        
        Map<String, String> violations = new HashMap<>();
        Set<ConstraintViolation<?>> constraintViolations = e.getConstraintViolations();
        
        for (ConstraintViolation<?> violation : constraintViolations) {
            String path = violation.getPropertyPath().toString();
            String message = violation.getMessage();
            violations.put(path, message);
        }
        
        error.put("violations", violations);
        
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(error)
            .build();
    }
}
`,
    'src/main/java/{{packagePath}}/exception/WebApplicationExceptionMapper.java': `package {{packageName}}.exception;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.HashMap;
import java.util.Map;

@Provider
public class WebApplicationExceptionMapper implements ExceptionMapper<WebApplicationException> {
    
    @Override
    public Response toResponse(WebApplicationException e) {
        Map<String, Object> error = new HashMap<>();
        error.put("type", "application_error");
        error.put("status", e.getResponse().getStatus());
        error.put("message", e.getMessage());
        
        return Response.status(e.getResponse().getStatus())
            .entity(error)
            .build();
    }
}
`,
    'src/main/resources/application.yml': `quarkus:
  application:
    name: {{serviceName}}
    version: 1.0.0

  http:
    port: {{port}}
    cors:
      ~: true
      origins: "http://localhost:3000,http://localhost:5173"
      methods: "GET,POST,PUT,DELETE,OPTIONS"
      headers: "*"
      exposed-headers: "*"

  datasource:
    db-kind: postgresql
    username: \${DB_USERNAME:postgres}
    password: \${DB_PASSWORD:postgres}
    jdbc:
      url: jdbc:postgresql://\${DB_HOST:localhost}:\${DB_PORT:5432}/\${DB_NAME:{{serviceName}}_db}
      max-size: 16

  hibernate-orm:
    database:
      generation: none
    log:
      sql: false

  flyway:
    migrate-at-start: true
    locations: db/migration

  redis:
    hosts: redis://\${REDIS_HOST:localhost}:\${REDIS_PORT:6379}
    password: \${REDIS_PASSWORD:}
    timeout: 10s

  cache:
    type: redis
    redis:
      "user-cache":
        expire-after-write: 10M
      "default":
        expire-after-write: 5M

  log:
    level: INFO
    category:
      "{{packageName}}":
        level: DEBUG

  native:
    container-build: true
    builder-image: quay.io/quarkus/ubi-quarkus-mandrel-builder-image:23.1-java17

mp:
  jwt:
    verify:
      publickey:
        location: publicKey.pem
      issuer: {{serviceName}}

jwt:
  duration: 3600
  refresh:
    duration: 86400

"%dev":
  quarkus:
    log:
      console:
        enable: true
        format: "%d{HH:mm:ss} %-5p [%c{2.}] (%t) %s%e%n"
        level: DEBUG

    hibernate-orm:
      log:
        sql: true

"%test":
  quarkus:
    datasource:
      db-kind: h2
      jdbc:
        url: jdbc:h2:mem:test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1

    hibernate-orm:
      database:
        generation: drop-and-create
`,
    'src/main/resources/db/migration/V1__Create_users_table.sql': `CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    roles VARCHAR(255) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);

-- Create admin user (password: admin123)
INSERT INTO users (username, email, password, first_name, last_name, roles) 
VALUES ('admin', 'admin@{{org}}.com', '$2a$10$mVWJ3N5pJ.6KJxPl8XhKaOjFqQH.Y3bg8gFRT6bCBLrJWBZwJvj9S', 'Admin', 'User', 'admin,user');
`,
    'src/main/resources/privateKey.pem': `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCWK8UjyoHgPTLa
PLQJ8SoXLLjpHSjtLxMqmzHnFscqhTVVaDpCRCb6e3Ii/WniQTWw8RA7KlFzjF5C
fHQgusEK1FM0Z5845KN7IgNcr6u8EzjDkfOH6HwTGHfcdJqzl3KJBuJqPQAOjlo4
kB1hdRy0K2Q5g6jKBcUL6pYqJurFmFkVQqpFdBFwF/fPDGJvOumWjc6OGKpvKkNo
jLf4a0MJZ0YMOHUJMbHmVA0hZVDe6FWWnl0TWmJmfaL8JdyU/HHtPiLl5XjGPgE6
bgXwXBhcOREzwWt2FM6lzOqMbicntUDwqAl3etmFJlXzh+C9BvawCC4MFCR4UAFC
n5UtfRqxAgMBAAECggEAB0nW2ApqWzx5k6T25eKh4zCYbHDpYdXnRdYB6yH+gt2P
DJkUIA5/4wZGnVhGLl6cBKDrANzyLkqJUZMHuuBk+7L1QBGDTHD7jI7wfPl7PKUW
xKEnPgl0hIj3bqHU9QLOyT7OKJLywqsbjXbWqMkZuBwCrGp3zsDQksNCS6it7SeZ
LLtbDANKW/qx/8/NIr9gP3rJDcJgdBHCM3A3pIPqsRjW2BQpGGPWxxxj9TjFQdRW
jN0xlr2DplcXnuVJkQW7j3E2mGnHJh4DxOdnMiS2Lv9mU6Y5MMKgWT3iI1MhdPPE
VLM4phZPbcXLCWTKENU1WShXZK1vVYgsY0SMAJduwQKBgQDE/ksW7f39HqMD6nQB
5k8GeiEGgCGKJRPSJlEi+K9eOYOalqZ8YXsFHaJowru6J7FvCd7cacikrqPCJgeZ
YNCgUxskFgQ9w0v1tpShJNaFdGTBkJSmVNpbeFTNhKgEeVePJLm9VKdlivBl6qJV
p3tierQV42jimZHMqNmglk9o0QKBgQDDJVYCPSGYMsVYDXcP4u1lbA6nN5WkYJ8z
AVFcTHfBU+Vtt0KeponAlGkLH48YrxP8TWXKT8LQnsywbhCB+7R8vQ3vhkc7ILVU
L9Ye8JPrIKc2nC1oCPPaOC5Y7ehzztLiI8bO+TBLGKhO/s1s6pLT0q9V3NWEmR0n
Ff4LRoFMgQKBgQCBenP4HMFEzBH/MN6HJvmCjIcFVI3j5bZ6vK5vaOu2n5b9Kqxt
k3DQSY9x0VRxHAGX8M2IaF5gNxnrHEZ6i6to7akj8rU4PoP2PVAKcQdXEHltaT8K
TcIWJEHMdW3CBVx3wQ1Rl+uGjQngaZz6PFooKrGCo8ESUucgjVpQ8w16AQKBgHCD
niHa7fGXXNcLQ/gUXe+xbnGS4nLHgLJEGnGeIbgvP7r9xQBHMlv3N4YNNbXt8EKe
RdOtguuJmf8lK9se7f7lazmp6ND8WLJdkQNmZ3fvMVXe9nVyUKh1JJo1HDlTkfCz
oZW8sWXLBpiG0geqcponGba6l7Lx3mZpqBVfcnoBAoGABaBnDAqsKyhtoKkGfa5O
+nFO3n7cGXji0Vx8cGxL3hrGXWNFkUfMo6I0WQUUVhvsJVXMlN8F0Okm0xS6YTHa
DSvG2jG1mEWw0S6n5CYoV/zJ+lKxRmN1rv5iAmNfZ1OqJjLb4qNRNRqZb2ZrM0fx
dQwT/x8hsDdeAIVAIy9k2Fs=
-----END PRIVATE KEY-----
`,
    'src/main/resources/publicKey.pem': `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlivFI8qB4D0y2jy0CfEq
Fyy46R0o7S8TKpsx5xbHKoU1VWg6QkQm+nt4Iv1p4kE1sPEQOypRc4xeQnx0ILrB
CtRTNGefOOSjeyIDXK+rvBM4w5Hzh+h8Exh33HSas5dyiQbaj0ADo5aOJAdYXUc
tClkOYOoygXFC+qWKibrxZhZFUKqRXQRcBf3zwxib7jrplo3Ojhiqb+pDaIy3+Gt
DCWdGDDh1CTGx5lQNIWVQ3uhVlp5dE1piZn2i/CXclPxx7T4i5eV4xj4BOm4F8Fw
YXDkRM8FrdhTOpcTqjG4nJ7VA8KgJd3rZiZV84fgvQb2sAguDBQkeFABQp+VLX0a
sQIDAQAB
-----END PUBLIC KEY-----
`,
    'src/test/java/{{packagePath}}/UserResourceTest.java': `package {{packageName}};

import {{packageName}}.dto.UserDto;
import io.quarkus.test.common.http.TestHTTPEndpoint;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

@QuarkusTest
@TestHTTPEndpoint(UserResource.class)
public class UserResourceTest {
    
    @Test
    @TestSecurity(user = "admin", roles = "admin")
    public void testGetUsersEndpoint() {
        given()
            .when().get()
            .then()
            .statusCode(200)
            .body("$.size()", is(1));
    }
    
    @Test
    @TestSecurity(user = "admin", roles = "admin")
    public void testGetUserById() {
        given()
            .when().get("/1")
            .then()
            .statusCode(200)
            .body("username", is("admin"));
    }
    
    @Test
    @TestSecurity(user = "admin", roles = "admin")
    public void testCreateUser() {
        UserDto userDto = new UserDto();
        userDto.username = "testuser";
        userDto.email = "test@example.com";
        userDto.password = "password123";
        userDto.firstName = "Test";
        userDto.lastName = "User";
        
        given()
            .contentType(ContentType.JSON)
            .body(userDto)
            .when().post()
            .then()
            .statusCode(201)
            .body("id", notNullValue())
            .body("username", is("testuser"));
    }
    
    @Test
    public void testUnauthorizedAccess() {
        given()
            .when().get()
            .then()
            .statusCode(401);
    }
    
    @Test
    @TestSecurity(user = "user", roles = "user")
    public void testForbiddenAccess() {
        given()
            .when().get()
            .then()
            .statusCode(403);
    }
}
`,
    'src/test/java/{{packagePath}}/AuthResourceTest.java': `package {{packageName}};

import {{packageName}}.dto.LoginRequest;
import {{packageName}}.dto.RegisterRequest;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.is;

@QuarkusTest
public class AuthResourceTest {
    
    @Test
    public void testRegisterNewUser() {
        RegisterRequest request = new RegisterRequest();
        request.username = "newuser";
        request.email = "newuser@example.com";
        request.password = "password123";
        request.firstName = "New";
        request.lastName = "User";
        
        given()
            .contentType(ContentType.JSON)
            .body(request)
            .when().post("/api/auth/register")
            .then()
            .statusCode(201)
            .body("access_token", notNullValue())
            .body("refresh_token", notNullValue())
            .body("token_type", is("Bearer"))
            .body("user.username", is("newuser"));
    }
    
    @Test
    public void testLoginWithValidCredentials() {
        LoginRequest request = new LoginRequest();
        request.username = "admin";
        request.password = "admin123";
        
        given()
            .contentType(ContentType.JSON)
            .body(request)
            .when().post("/api/auth/login")
            .then()
            .statusCode(200)
            .body("access_token", notNullValue())
            .body("refresh_token", notNullValue());
    }
    
    @Test
    public void testLoginWithInvalidCredentials() {
        LoginRequest request = new LoginRequest();
        request.username = "admin";
        request.password = "wrongpassword";
        
        given()
            .contentType(ContentType.JSON)
            .body(request)
            .when().post("/api/auth/login")
            .then()
            .statusCode(401);
    }
}
`,
    'src/native-test/java/{{packagePath}}/NativeUserResourceIT.java': `package {{packageName}};

import io.quarkus.test.junit.QuarkusIntegrationTest;

@QuarkusIntegrationTest
public class NativeUserResourceIT extends UserResourceTest {
    // Execute the same tests but in native mode
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

# Quarkus
.quarkus/
`,
    'Dockerfile': `# =============================================================================
# Multi-stage build for Quarkus JVM mode
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

ENV LANGUAGE='en_US:en'

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser

# We make four distinct layers so if there are application changes the library layers can be re-used
COPY --from=build --chown=appuser:appuser target/quarkus-app/lib/ /deployments/lib/
COPY --from=build --chown=appuser:appuser target/quarkus-app/*.jar /deployments/
COPY --from=build --chown=appuser:appuser target/quarkus-app/app/ /deployments/app/
COPY --from=build --chown=appuser:appuser target/quarkus-app/quarkus/ /deployments/quarkus/

WORKDIR /deployments
EXPOSE {{port}}
USER appuser
ENV JAVA_OPTS="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
ENV JAVA_APP_JAR="/deployments/quarkus-run.jar"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:{{port}}/q/health || exit 1
`,
    'Dockerfile.native': `####
# This Dockerfile is used in order to build a container that runs the Quarkus application in native (no JVM) mode.
#
# Before building the container image run:
#
# ./mvnw package -Pnative
#
# Then, build the image with:
#
# docker build -f src/main/docker/Dockerfile.native -t quarkus/{{serviceName}} .
#
# Then run the container using:
#
# docker run -i --rm -p {{port}}:{{port}} quarkus/{{serviceName}}
#
###
FROM registry.access.redhat.com/ubi8/ubi-minimal:8.8
WORKDIR /work/
RUN chown 1001 /work \
    && chmod "g+rwX" /work \
    && chown 1001:root /work
COPY --chown=1001:root target/*-runner /work/application

EXPOSE {{port}}
USER 1001

CMD ["./application", "-Dquarkus.http.host=0.0.0.0"]
`,
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "{{port}}:{{port}}"
    environment:
      - QUARKUS_PROFILE=prod
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME={{serviceName}}_db
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      - REDIS_HOST=redis
      - REDIS_PORT=6379
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
- GraalVM (optional, for native builds)

### Running in Development Mode

\`\`\`bash
./mvnw quarkus:dev
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

Run integration tests:
\`\`\`bash
./mvnw verify
\`\`\`

## ⚡ Building Native Image

\`\`\`bash
# Build native executable
./mvnw package -Pnative

# Build Docker image with native executable
docker build -f Dockerfile.native -t {{serviceName}}:native .

# Run native Docker container
docker run -i --rm -p {{port}}:{{port}} {{serviceName}}:native
\`\`\`

## 📚 API Documentation

- Swagger UI: http://localhost:{{port}}/q/swagger-ui
- OpenAPI Spec: http://localhost:{{port}}/q/openapi

## 🔒 Security

This application uses JWT for authentication:

1. Register: \`POST /api/auth/register\`
2. Login: \`POST /api/auth/login\`
3. Use the token in \`Authorization: Bearer <token>\` header

## 📊 Monitoring

- Health: http://localhost:{{port}}/q/health
- Metrics: http://localhost:{{port}}/q/metrics
- Ready: http://localhost:{{port}}/q/health/ready
- Live: http://localhost:{{port}}/q/health/live

## 🏗️ Architecture

- **Framework**: Quarkus 3.6
- **Security**: JWT with SmallRye JWT
- **Database**: PostgreSQL with Hibernate ORM Panache
- **Caching**: Redis
- **Migrations**: Flyway
- **API Documentation**: SmallRye OpenAPI
- **Testing**: JUnit 5, RestAssured, Mockito

## 🌟 Features

- ⚡ Super-fast startup time
- 🔥 Live reload in development
- 🦾 Native compilation with GraalVM
- 🔐 JWT authentication
- 📊 Built-in health checks and metrics
- 🚀 Reactive programming support
- 🧪 Comprehensive test coverage
- 📚 Auto-generated API documentation
`
  }
};