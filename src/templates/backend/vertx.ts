import { BackendTemplate } from '../types';

export const vertxTemplate: BackendTemplate = {
  id: 'vertx',
  name: 'Vert.x',
  displayName: 'Vert.x Reactive',
  description: 'Reactive JVM application framework for building responsive, resilient, elastic, and message-driven applications',
  version: '4.5.0',
  framework: 'vertx',
  language: 'java',
  port: 8080,
  tags: ['reactive', 'event-driven', 'non-blocking', 'microservices', 'high-performance'],
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
    'websockets',
    'microservices',
    'docker'
  ],
  dependencies: {},
  devDependencies: {},
  postInstall: [
    'echo "✅ Vert.x project created successfully!"',
    'echo "📦 Installing dependencies..."',
    './mvnw clean compile',
    'echo "🚀 Start development server: ./mvnw exec:java"',
    'echo "📚 API Documentation: http://localhost:{{port}}/swagger-ui"'
  ],
  files: {
    'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>{{packageName}}</groupId>
  <artifactId>{{serviceName}}</artifactId>
  <version>1.0.0-SNAPSHOT</version>

  <properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
    <vertx.version>4.5.0</vertx.version>
    <junit-jupiter.version>5.10.1</junit-jupiter.version>
    <testcontainers.version>1.19.3</testcontainers.version>
    <main.verticle>{{packageName}}.MainVerticle</main.verticle>
    <launcher.class>io.vertx.core.Launcher</launcher.class>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>io.vertx</groupId>
        <artifactId>vertx-stack-depchain</artifactId>
        <version>\${vertx.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <!-- Vert.x Core -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-core</artifactId>
    </dependency>
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-web</artifactId>
    </dependency>
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-web-validation</artifactId>
    </dependency>
    
    <!-- Security -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-auth-jwt</artifactId>
    </dependency>
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-auth-common</artifactId>
    </dependency>
    
    <!-- Database -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-pg-client</artifactId>
    </dependency>
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-sql-client-templates</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
      <version>9.22.3</version>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <version>42.7.1</version>
    </dependency>
    
    <!-- Redis -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-redis-client</artifactId>
    </dependency>
    
    <!-- Configuration -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-config</artifactId>
    </dependency>
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-config-yaml</artifactId>
    </dependency>
    
    <!-- OpenAPI -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-web-openapi</artifactId>
    </dependency>
    
    <!-- Health Checks -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-health-check</artifactId>
    </dependency>
    
    <!-- Metrics -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-micrometer-metrics</artifactId>
    </dependency>
    <dependency>
      <groupId>io.micrometer</groupId>
      <artifactId>micrometer-registry-prometheus</artifactId>
      <version>1.12.0</version>
    </dependency>
    
    <!-- Service Discovery -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-service-discovery</artifactId>
    </dependency>
    
    <!-- Circuit Breaker -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-circuit-breaker</artifactId>
    </dependency>
    
    <!-- JSON -->
    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
      <version>2.16.0</version>
    </dependency>
    <dependency>
      <groupId>com.fasterxml.jackson.datatype</groupId>
      <artifactId>jackson-datatype-jsr310</artifactId>
      <version>2.16.0</version>
    </dependency>
    
    <!-- Logging -->
    <dependency>
      <groupId>ch.qos.logback</groupId>
      <artifactId>logback-classic</artifactId>
      <version>1.4.14</version>
    </dependency>
    
    <!-- Utils -->
    <dependency>
      <groupId>org.mindrot</groupId>
      <artifactId>jbcrypt</artifactId>
      <version>0.4</version>
    </dependency>
    
    <!-- Testing -->
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-junit5</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.vertx</groupId>
      <artifactId>vertx-web-client</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>\${junit-jupiter.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.mockito</groupId>
      <artifactId>mockito-core</artifactId>
      <version>5.7.0</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>testcontainers</artifactId>
      <version>\${testcontainers.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>postgresql</artifactId>
      <version>\${testcontainers.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.11.0</version>
        <configuration>
          <source>\${maven.compiler.source}</source>
          <target>\${maven.compiler.target}</target>
        </configuration>
      </plugin>
      <plugin>
        <artifactId>maven-shade-plugin</artifactId>
        <version>3.5.1</version>
        <executions>
          <execution>
            <phase>package</phase>
            <goals>
              <goal>shade</goal>
            </goals>
            <configuration>
              <transformers>
                <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
                  <manifestEntries>
                    <Main-Class>\${launcher.class}</Main-Class>
                    <Main-Verticle>\${main.verticle}</Main-Verticle>
                  </manifestEntries>
                </transformer>
                <transformer implementation="org.apache.maven.plugins.shade.resource.ServicesResourceTransformer"/>
              </transformers>
              <outputFile>\${project.build.directory}/\${project.artifactId}-\${project.version}-fat.jar</outputFile>
            </configuration>
          </execution>
        </executions>
      </plugin>
      <plugin>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.2.2</version>
      </plugin>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>exec-maven-plugin</artifactId>
        <version>3.1.1</version>
        <configuration>
          <mainClass>\${launcher.class}</mainClass>
          <arguments>
            <argument>run</argument>
            <argument>\${main.verticle}</argument>
          </arguments>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`,
    'src/main/java/{{packagePath}}/MainVerticle.java': `package {{packageName}};

import {{packageName}}.config.DbConfig;
import {{packageName}}.handler.*;
import {{packageName}}.repository.UserRepository;
import {{packageName}}.service.*;
import io.vertx.core.AbstractVerticle;
import io.vertx.core.Promise;
import io.vertx.core.http.HttpServer;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.auth.PubSecKeyOptions;
import io.vertx.ext.auth.jwt.JWTAuth;
import io.vertx.ext.auth.jwt.JWTAuthOptions;
import io.vertx.ext.healthchecks.HealthCheckHandler;
import io.vertx.ext.healthchecks.HealthChecks;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.*;
import io.vertx.ext.web.openapi.RouterBuilder;
import io.vertx.micrometer.PrometheusScrapingHandler;
import io.vertx.pgclient.PgPool;
import io.vertx.redis.client.Redis;
import io.vertx.redis.client.RedisOptions;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MainVerticle extends AbstractVerticle {
    
    private static final Logger LOG = LoggerFactory.getLogger(MainVerticle.class);
    
    @Override
    public void start(Promise<Void> startPromise) {
        // Run database migrations
        runMigrations();
        
        // Initialize database pool
        PgPool pgPool = DbConfig.createPgPool(vertx, config());
        
        // Initialize Redis client
        Redis redis = Redis.createClient(
            vertx,
            new RedisOptions()
                .setConnectionString(config().getString("redis.uri", "redis://localhost:6379"))
        );
        
        // Initialize JWT Auth
        JWTAuth jwtAuth = JWTAuth.create(vertx, new JWTAuthOptions()
            .addPubSecKey(new PubSecKeyOptions()
                .setAlgorithm("HS256")
                .setBuffer(config().getString("jwt.secret", "change-this-secret"))
            ));
        
        // Initialize repositories
        UserRepository userRepository = new UserRepository(pgPool);
        
        // Initialize services
        PasswordService passwordService = new PasswordService();
        UserService userService = new UserService(userRepository, passwordService);
        AuthService authService = new AuthService(userService, jwtAuth, config());
        CacheService cacheService = new CacheService(redis);
        
        // Build router from OpenAPI spec
        RouterBuilder.create(vertx, "openapi.yaml")
            .onSuccess(routerBuilder -> {
                // Create main router
                Router router = Router.router(vertx);
                
                // Add global handlers
                router.route().handler(BodyHandler.create());
                router.route().handler(LoggerHandler.create());
                router.route().handler(TimeoutHandler.create(30000));
                router.route().handler(ResponseContentTypeHandler.create());
                
                // CORS configuration
                router.route().handler(CorsHandler.create()
                    .addOrigin("http://localhost:3000")
                    .addOrigin("http://localhost:5173")
                    .allowedMethod(io.vertx.core.http.HttpMethod.GET)
                    .allowedMethod(io.vertx.core.http.HttpMethod.POST)
                    .allowedMethod(io.vertx.core.http.HttpMethod.PUT)
                    .allowedMethod(io.vertx.core.http.HttpMethod.DELETE)
                    .allowedMethod(io.vertx.core.http.HttpMethod.OPTIONS)
                    .allowedHeader("*")
                    .allowCredentials(true));
                
                // Initialize handlers
                AuthHandler authHandler = new AuthHandler(authService);
                UserHandler userHandler = new UserHandler(userService, cacheService);
                
                // Authentication endpoints
                router.post("/api/auth/register").handler(authHandler::register);
                router.post("/api/auth/login").handler(authHandler::login);
                router.post("/api/auth/refresh").handler(authHandler::refresh);
                
                // Protected routes
                Router apiRouter = Router.router(vertx);
                apiRouter.route().handler(JWTAuthHandler.create(jwtAuth));
                
                // User endpoints
                apiRouter.get("/users").handler(userHandler::getAll);
                apiRouter.get("/users/:id").handler(userHandler::getById);
                apiRouter.post("/users").handler(userHandler::create);
                apiRouter.put("/users/:id").handler(userHandler::update);
                apiRouter.delete("/users/:id").handler(userHandler::delete);
                
                router.mountSubRouter("/api", apiRouter);
                
                // Health checks
                HealthCheckHandler healthCheckHandler = HealthCheckHandler.create(vertx);
                HealthChecks healthChecks = HealthChecks.create(vertx);
                
                healthChecks.register("database", promise -> {
                    pgPool.query("SELECT 1").execute(ar -> {
                        if (ar.succeeded()) {
                            promise.complete();
                        } else {
                            promise.fail(ar.cause());
                        }
                    });
                });
                
                healthChecks.register("caching", promise -> {
                    redis.ping(ar -> {
                        if (ar.succeeded()) {
                            promise.complete();
                        } else {
                            promise.fail(ar.cause());
                        }
                    });
                });
                
                router.get("/health").handler(healthCheckHandler);
                router.get("/health/live").handler(ctx -> ctx.response().end("OK"));
                router.get("/health/ready").handler(healthCheckHandler);
                
                // Metrics endpoint
                router.route("/metrics").handler(PrometheusScrapingHandler.create());
                
                // OpenAPI UI
                router.get("/swagger-ui/*").handler(
                    StaticHandler.create("webroot/swagger-ui")
                );
                
                // Mount OpenAPI router
                router.mountSubRouter("/", routerBuilder.createRouter());
                
                // Create HTTP server
                HttpServer server = vertx.createHttpServer();
                
                server.requestHandler(router)
                    .listen(config().getInteger("http.port", {{port}}))
                    .onSuccess(http -> {
                        LOG.info("HTTP server started on port " + http.actualPort());
                        startPromise.complete();
                    })
                    .onFailure(startPromise::fail);
            })
            .onFailure(startPromise::fail);
    }
    
    private void runMigrations() {
        JsonObject dbConfig = config().getJsonObject("database");
        String jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s",
            dbConfig.getString("host", "localhost"),
            dbConfig.getInteger("port", 5432),
            dbConfig.getString("database", "{{serviceName}}_db")
        );
        
        Flyway flyway = Flyway.configure()
            .dataSource(jdbcUrl,
                dbConfig.getString("user", "postgres"),
                dbConfig.getString("password", "postgres"))
            .load();
        
        flyway.migrate();
        LOG.info("Database migrations completed");
    }
}
`,
    'src/main/java/{{packagePath}}/config/DbConfig.java': `package {{packageName}}.config;

import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.pgclient.PgPool;
import io.vertx.sqlclient.PoolOptions;

public class DbConfig {
    
    public static PgPool createPgPool(Vertx vertx, JsonObject config) {
        JsonObject dbConfig = config.getJsonObject("database", new JsonObject());
        
        PgConnectOptions connectOptions = new PgConnectOptions()
            .setPort(dbConfig.getInteger("port", 5432))
            .setHost(dbConfig.getString("host", "localhost"))
            .setDatabase(dbConfig.getString("database", "{{serviceName}}_db"))
            .setUser(dbConfig.getString("user", "postgres"))
            .setPassword(dbConfig.getString("password", "postgres"));
        
        PoolOptions poolOptions = new PoolOptions()
            .setMaxSize(dbConfig.getInteger("maxPoolSize", 10));
        
        return PgPool.pool(vertx, connectOptions, poolOptions);
    }
}
`,
    'src/main/java/{{packagePath}}/model/User.java': `package {{packageName}}.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.vertx.codegen.annotations.DataObject;
import io.vertx.core.json.JsonObject;

import java.time.LocalDateTime;
import java.util.Set;

@DataObject
public class User {
    
    private Long id;
    private String username;
    private String email;
    
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;
    
    private String firstName;
    private String lastName;
    private Set<String> roles;
    private boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    public User() {}
    
    public User(JsonObject json) {
        this.id = json.getLong("id");
        this.username = json.getString("username");
        this.email = json.getString("email");
        this.password = json.getString("password");
        this.firstName = json.getString("first_name");
        this.lastName = json.getString("last_name");
        this.enabled = json.getBoolean("enabled", true);
        // Handle roles and timestamps conversion
    }
    
    public JsonObject toJson() {
        JsonObject json = new JsonObject()
            .put("id", id)
            .put("username", username)
            .put("email", email)
            .put("first_name", firstName)
            .put("last_name", lastName)
            .put("enabled", enabled);
        
        if (roles != null) {
            json.put("roles", roles);
        }
        if (createdAt != null) {
            json.put("created_at", createdAt.toString());
        }
        if (updatedAt != null) {
            json.put("updated_at", updatedAt.toString());
        }
        
        return json;
    }
    
    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    
    public Set<String> getRoles() { return roles; }
    public void setRoles(Set<String> roles) { this.roles = roles; }
    
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
`,
    'src/main/java/{{packagePath}}/repository/UserRepository.java': `package {{packageName}}.repository;

import {{packageName}}.model.User;
import io.vertx.core.Future;
import io.vertx.pgclient.PgPool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.RowSet;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class UserRepository {
    
    private final PgPool pool;
    
    public UserRepository(PgPool pool) {
        this.pool = pool;
    }
    
    public Future<User> findById(Long id) {
        return pool.preparedQuery(
            "SELECT * FROM users WHERE id = $1"
        ).execute(Tuple.of(id))
        .map(rows -> {
            if (rows.size() == 0) {
                return null;
            }
            return mapRowToUser(rows.iterator().next());
        });
    }
    
    public Future<User> findByUsername(String username) {
        return pool.preparedQuery(
            "SELECT * FROM users WHERE username = $1"
        ).execute(Tuple.of(username))
        .map(rows -> {
            if (rows.size() == 0) {
                return null;
            }
            return mapRowToUser(rows.iterator().next());
        });
    }
    
    public Future<User> findByEmail(String email) {
        return pool.preparedQuery(
            "SELECT * FROM users WHERE email = $1"
        ).execute(Tuple.of(email))
        .map(rows -> {
            if (rows.size() == 0) {
                return null;
            }
            return mapRowToUser(rows.iterator().next());
        });
    }
    
    public Future<List<User>> findAll(int limit, int offset) {
        return pool.preparedQuery(
            "SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2"
        ).execute(Tuple.of(limit, offset))
        .map(rows -> {
            List<User> users = new ArrayList<>();
            for (Row row : rows) {
                users.add(mapRowToUser(row));
            }
            return users;
        });
    }
    
    public Future<User> save(User user) {
        return pool.preparedQuery(
            "INSERT INTO users (username, email, password, first_name, last_name, roles, enabled) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"
        ).execute(Tuple.of(
            user.getUsername(),
            user.getEmail(),
            user.getPassword(),
            user.getFirstName(),
            user.getLastName(),
            String.join(",", user.getRoles()),
            user.isEnabled()
        ))
        .map(rows -> mapRowToUser(rows.iterator().next()));
    }
    
    public Future<User> update(User user) {
        return pool.preparedQuery(
            "UPDATE users SET email = $2, first_name = $3, last_name = $4, " +
            "updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *"
        ).execute(Tuple.of(
            user.getId(),
            user.getEmail(),
            user.getFirstName(),
            user.getLastName()
        ))
        .map(rows -> {
            if (rows.size() == 0) {
                return null;
            }
            return mapRowToUser(rows.iterator().next());
        });
    }
    
    public Future<Boolean> delete(Long id) {
        return pool.preparedQuery(
            "DELETE FROM users WHERE id = $1"
        ).execute(Tuple.of(id))
        .map(rows -> rows.rowCount() > 0);
    }
    
    public Future<Boolean> existsByUsername(String username) {
        return pool.preparedQuery(
            "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)"
        ).execute(Tuple.of(username))
        .map(rows -> rows.iterator().next().getBoolean(0));
    }
    
    public Future<Boolean> existsByEmail(String email) {
        return pool.preparedQuery(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
        ).execute(Tuple.of(email))
        .map(rows -> rows.iterator().next().getBoolean(0));
    }
    
    private User mapRowToUser(Row row) {
        User user = new User();
        user.setId(row.getLong("id"));
        user.setUsername(row.getString("username"));
        user.setEmail(row.getString("email"));
        user.setPassword(row.getString("password"));
        user.setFirstName(row.getString("first_name"));
        user.setLastName(row.getString("last_name"));
        user.setEnabled(row.getBoolean("enabled"));
        user.setCreatedAt(row.getLocalDateTime("created_at"));
        user.setUpdatedAt(row.getLocalDateTime("updated_at"));
        
        String rolesStr = row.getString("roles");
        if (rolesStr != null) {
            Set<String> roles = new HashSet<>();
            for (String role : rolesStr.split(",")) {
                roles.add(role.trim());
            }
            user.setRoles(roles);
        }
        
        return user;
    }
}
`,
    'src/main/java/{{packagePath}}/service/UserService.java': `package {{packageName}}.service;

import {{packageName}}.model.User;
import {{packageName}}.repository.UserRepository;
import io.vertx.core.Future;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class UserService {
    
    private final UserRepository userRepository;
    private final PasswordService passwordService;
    
    public UserService(UserRepository userRepository, PasswordService passwordService) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
    }
    
    public Future<User> findById(Long id) {
        return userRepository.findById(id);
    }
    
    public Future<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }
    
    public Future<List<User>> findAll(int limit, int offset) {
        return userRepository.findAll(limit, offset);
    }
    
    public Future<User> create(User user) {
        return userRepository.existsByUsername(user.getUsername())
            .compose(exists -> {
                if (exists) {
                    return Future.failedFuture("Username already exists");
                }
                return userRepository.existsByEmail(user.getEmail());
            })
            .compose(exists -> {
                if (exists) {
                    return Future.failedFuture("Email already exists");
                }
                
                // Set default role
                Set<String> roles = new HashSet<>();
                roles.add("ROLE_USER");
                user.setRoles(roles);
                
                // Hash password
                user.setPassword(passwordService.hash(user.getPassword()));
                
                return userRepository.save(user);
            });
    }
    
    public Future<User> update(Long id, User updates) {
        return userRepository.findById(id)
            .compose(user -> {
                if (user == null) {
                    return Future.failedFuture("User not found");
                }
                
                // Update fields
                if (updates.getFirstName() != null) {
                    user.setFirstName(updates.getFirstName());
                }
                if (updates.getLastName() != null) {
                    user.setLastName(updates.getLastName());
                }
                if (updates.getEmail() != null && !updates.getEmail().equals(user.getEmail())) {
                    return userRepository.existsByEmail(updates.getEmail())
                        .compose(exists -> {
                            if (exists) {
                                return Future.failedFuture("Email already exists");
                            }
                            user.setEmail(updates.getEmail());
                            return userRepository.update(user);
                        });
                }
                
                return userRepository.update(user);
            });
    }
    
    public Future<Boolean> delete(Long id) {
        return userRepository.delete(id);
    }
    
    public Future<Boolean> verifyPassword(String username, String password) {
        return userRepository.findByUsername(username)
            .compose(user -> {
                if (user == null) {
                    // Also check email
                    return userRepository.findByEmail(username);
                }
                return Future.succeededFuture(user);
            })
            .map(user -> {
                if (user == null) {
                    return false;
                }
                return passwordService.verify(password, user.getPassword());
            });
    }
}
`,
    'src/main/java/{{packagePath}}/service/AuthService.java': `package {{packageName}}.service;

import {{packageName}}.dto.*;
import {{packageName}}.model.User;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.auth.JWTOptions;
import io.vertx.ext.auth.jwt.JWTAuth;

public class AuthService {
    
    private final UserService userService;
    private final JWTAuth jwtAuth;
    private final JsonObject config;
    
    public AuthService(UserService userService, JWTAuth jwtAuth, JsonObject config) {
        this.userService = userService;
        this.jwtAuth = jwtAuth;
        this.config = config;
    }
    
    public Future<AuthResponse> register(RegisterRequest request) {
        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        
        return userService.create(user)
            .map(createdUser -> {
                String token = generateToken(createdUser);
                String refreshToken = generateRefreshToken(createdUser);
                
                AuthResponse response = new AuthResponse();
                response.setAccessToken(token);
                response.setRefreshToken(refreshToken);
                response.setTokenType("Bearer");
                response.setExpiresIn(config.getLong("jwt.expiresIn", 3600L));
                response.setUser(createdUser);
                
                return response;
            });
    }
    
    public Future<AuthResponse> authenticate(LoginRequest request) {
        return userService.verifyPassword(request.getUsername(), request.getPassword())
            .compose(verified -> {
                if (!verified) {
                    return Future.failedFuture("Invalid credentials");
                }
                return userService.findByUsername(request.getUsername())
                    .compose(user -> {
                        if (user == null) {
                            return userService.findByEmail(request.getUsername());
                        }
                        return Future.succeededFuture(user);
                    });
            })
            .map(user -> {
                String token = generateToken(user);
                String refreshToken = generateRefreshToken(user);
                
                AuthResponse response = new AuthResponse();
                response.setAccessToken(token);
                response.setRefreshToken(refreshToken);
                response.setTokenType("Bearer");
                response.setExpiresIn(config.getLong("jwt.expiresIn", 3600L));
                response.setUser(user);
                
                return response;
            });
    }
    
    public Future<AuthResponse> refresh(String refreshToken) {
        // Verify refresh token
        return Future.future(promise -> {
            jwtAuth.authenticate(new JsonObject().put("authentication", refreshToken))
                .onSuccess(user -> {
                    String username = user.principal().getString("sub");
                    userService.findByUsername(username)
                        .onSuccess(foundUser -> {
                            String newToken = generateToken(foundUser);
                            
                            AuthResponse response = new AuthResponse();
                            response.setAccessToken(newToken);
                            response.setRefreshToken(refreshToken);
                            response.setTokenType("Bearer");
                            response.setExpiresIn(config.getLong("jwt.expiresIn", 3600L));
                            response.setUser(foundUser);
                            
                            promise.complete(response);
                        })
                        .onFailure(promise::fail);
                })
                .onFailure(error -> promise.fail("Invalid refresh token"));
        });
    }
    
    private String generateToken(User user) {
        JsonObject claims = new JsonObject()
            .put("sub", user.getUsername())
            .put("email", user.getEmail())
            .put("roles", user.getRoles());
        
        JWTOptions options = new JWTOptions()
            .setExpiresInSeconds(config.getInteger("jwt.expiresIn", 3600))
            .setSubject(user.getUsername());
        
        return jwtAuth.generateToken(claims, options);
    }
    
    private String generateRefreshToken(User user) {
        JsonObject claims = new JsonObject()
            .put("sub", user.getUsername())
            .put("type", "refresh");
        
        JWTOptions options = new JWTOptions()
            .setExpiresInSeconds(config.getInteger("jwt.refreshExpiresIn", 86400));
        
        return jwtAuth.generateToken(claims, options);
    }
}
`,
    'src/main/java/{{packagePath}}/service/PasswordService.java': `package {{packageName}}.service;

import org.mindrot.jbcrypt.BCrypt;

public class PasswordService {
    
    public String hash(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt());
    }
    
    public boolean verify(String password, String hashedPassword) {
        return BCrypt.checkpw(password, hashedPassword);
    }
}
`,
    'src/main/java/{{packagePath}}/service/CacheService.java': `package {{packageName}}.service;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.redis.client.Redis;
import io.vertx.redis.client.Request;
import io.vertx.redis.client.Command;

public class CacheService {
    
    private final Redis redis;
    private static final int DEFAULT_TTL = 600; // 10 minutes
    
    public CacheService(Redis redis) {
        this.redis = redis;
    }
    
    public Future<JsonObject> get(String key) {
        return redis.send(Request.cmd(Command.GET).arg(key))
            .map(response -> {
                if (response == null || response.toString() == null) {
                    return null;
                }
                return new JsonObject(response.toString());
            })
            .recover(error -> Future.succeededFuture(null));
    }
    
    public Future<Void> set(String key, JsonObject value) {
        return set(key, value, DEFAULT_TTL);
    }
    
    public Future<Void> set(String key, JsonObject value, int ttl) {
        return redis.send(Request.cmd(Command.SETEX)
            .arg(key)
            .arg(ttl)
            .arg(value.encode()))
            .mapEmpty();
    }
    
    public Future<Void> delete(String key) {
        return redis.send(Request.cmd(Command.DEL).arg(key))
            .mapEmpty();
    }
    
    public Future<Void> deletePattern(String pattern) {
        return redis.send(Request.cmd(Command.KEYS).arg(pattern))
            .compose(keys -> {
                if (keys == null || keys.size() == 0) {
                    return Future.succeededFuture();
                }
                Request request = Request.cmd(Command.DEL);
                for (int i = 0; i < keys.size(); i++) {
                    request.arg(keys.get(i).toString());
                }
                return redis.send(request).mapEmpty();
            });
    }
}
`,
    'src/main/java/{{packagePath}}/handler/AuthHandler.java': `package {{packageName}}.handler;

import {{packageName}}.dto.*;
import {{packageName}}.service.AuthService;
import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.validation.RequestPredicate;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.Bodies;
import io.vertx.json.schema.SchemaParser;
import io.vertx.json.schema.SchemaRouter;
import io.vertx.json.schema.SchemaRouterOptions;
import io.vertx.json.schema.draft7.Draft7SchemaParser;

public class AuthHandler {
    
    private final AuthService authService;
    
    public AuthHandler(AuthService authService) {
        this.authService = authService;
    }
    
    public void register(RoutingContext ctx) {
        try {
            RegisterRequest request = ctx.body().asPojo(RegisterRequest.class);
            
            if (request.getUsername() == null || request.getUsername().isEmpty()) {
                ctx.response()
                    .setStatusCode(400)
                    .end(new JsonObject()
                        .put("error", "Username is required")
                        .encode());
                return;
            }
            
            authService.register(request)
                .onSuccess(response -> {
                    ctx.response()
                        .setStatusCode(201)
                        .putHeader("content-type", "application/json")
                        .end(JsonObject.mapFrom(response).encode());
                })
                .onFailure(error -> {
                    ctx.response()
                        .setStatusCode(400)
                        .end(new JsonObject()
                            .put("error", error.getMessage())
                            .encode());
                });
        } catch (DecodeException e) {
            ctx.response()
                .setStatusCode(400)
                .end(new JsonObject()
                    .put("error", "Invalid request body")
                    .encode());
        }
    }
    
    public void login(RoutingContext ctx) {
        try {
            LoginRequest request = ctx.body().asPojo(LoginRequest.class);
            
            authService.authenticate(request)
                .onSuccess(response -> {
                    ctx.response()
                        .putHeader("content-type", "application/json")
                        .end(JsonObject.mapFrom(response).encode());
                })
                .onFailure(error -> {
                    ctx.response()
                        .setStatusCode(401)
                        .end(new JsonObject()
                            .put("error", error.getMessage())
                            .encode());
                });
        } catch (DecodeException e) {
            ctx.response()
                .setStatusCode(400)
                .end(new JsonObject()
                    .put("error", "Invalid request body")
                    .encode());
        }
    }
    
    public void refresh(RoutingContext ctx) {
        String refreshToken = ctx.request().getParam("token");
        
        if (refreshToken == null || refreshToken.isEmpty()) {
            ctx.response()
                .setStatusCode(400)
                .end(new JsonObject()
                    .put("error", "Refresh token is required")
                    .encode());
            return;
        }
        
        authService.refresh(refreshToken)
            .onSuccess(response -> {
                ctx.response()
                    .putHeader("content-type", "application/json")
                    .end(JsonObject.mapFrom(response).encode());
            })
            .onFailure(error -> {
                ctx.response()
                    .setStatusCode(401)
                    .end(new JsonObject()
                        .put("error", error.getMessage())
                        .encode());
            });
    }
}
`,
    'src/main/java/{{packagePath}}/handler/UserHandler.java': `package {{packageName}}.handler;

import {{packageName}}.model.User;
import {{packageName}}.service.CacheService;
import {{packageName}}.service.UserService;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.List;

public class UserHandler {
    
    private final UserService userService;
    private final CacheService cacheService;
    
    public UserHandler(UserService userService, CacheService cacheService) {
        this.userService = userService;
        this.cacheService = cacheService;
    }
    
    public void getAll(RoutingContext ctx) {
        int limit = Integer.parseInt(ctx.request().getParam("limit", "20"));
        int offset = Integer.parseInt(ctx.request().getParam("offset", "0"));
        
        userService.findAll(limit, offset)
            .onSuccess(users -> {
                JsonArray jsonArray = new JsonArray();
                for (User user : users) {
                    jsonArray.add(user.toJson());
                }
                
                ctx.response()
                    .putHeader("content-type", "application/json")
                    .end(jsonArray.encode());
            })
            .onFailure(error -> {
                ctx.response()
                    .setStatusCode(500)
                    .end(new JsonObject()
                        .put("error", error.getMessage())
                        .encode());
            });
    }
    
    public void getById(RoutingContext ctx) {
        String idParam = ctx.pathParam("id");
        
        try {
            Long id = Long.parseLong(idParam);
            String cacheKey = "user:" + id;
            
            // Check cache first
            cacheService.get(cacheKey)
                .compose(cached -> {
                    if (cached != null) {
                        ctx.response()
                            .putHeader("content-type", "application/json")
                            .end(cached.encode());
                        return null;
                    }
                    return userService.findById(id);
                })
                .onSuccess(user -> {
                    if (user == null) {
                        return; // Already sent response from cache
                    }
                    if (user == null) {
                        ctx.response()
                            .setStatusCode(404)
                            .end(new JsonObject()
                                .put("error", "User not found")
                                .encode());
                    } else {
                        JsonObject userJson = user.toJson();
                        // Cache the result
                        cacheService.set(cacheKey, userJson);
                        
                        ctx.response()
                            .putHeader("content-type", "application/json")
                            .end(userJson.encode());
                    }
                })
                .onFailure(error -> {
                    ctx.response()
                        .setStatusCode(500)
                        .end(new JsonObject()
                            .put("error", error.getMessage())
                            .encode());
                });
        } catch (NumberFormatException e) {
            ctx.response()
                .setStatusCode(400)
                .end(new JsonObject()
                    .put("error", "Invalid user ID")
                    .encode());
        }
    }
    
    public void create(RoutingContext ctx) {
        try {
            User user = ctx.body().asPojo(User.class);
            
            userService.create(user)
                .onSuccess(createdUser -> {
                    ctx.response()
                        .setStatusCode(201)
                        .putHeader("content-type", "application/json")
                        .end(createdUser.toJson().encode());
                })
                .onFailure(error -> {
                    ctx.response()
                        .setStatusCode(400)
                        .end(new JsonObject()
                            .put("error", error.getMessage())
                            .encode());
                });
        } catch (Exception e) {
            ctx.response()
                .setStatusCode(400)
                .end(new JsonObject()
                    .put("error", "Invalid request body")
                    .encode());
        }
    }
    
    public void update(RoutingContext ctx) {
        String idParam = ctx.pathParam("id");
        
        try {
            Long id = Long.parseLong(idParam);
            User updates = ctx.body().asPojo(User.class);
            
            userService.update(id, updates)
                .onSuccess(updatedUser -> {
                    if (updatedUser == null) {
                        ctx.response()
                            .setStatusCode(404)
                            .end(new JsonObject()
                                .put("error", "User not found")
                                .encode());
                    } else {
                        // Invalidate cache
                        cacheService.delete("user:" + id);
                        
                        ctx.response()
                            .putHeader("content-type", "application/json")
                            .end(updatedUser.toJson().encode());
                    }
                })
                .onFailure(error -> {
                    ctx.response()
                        .setStatusCode(400)
                        .end(new JsonObject()
                            .put("error", error.getMessage())
                            .encode());
                });
        } catch (Exception e) {
            ctx.response()
                .setStatusCode(400)
                .end(new JsonObject()
                    .put("error", "Invalid request")
                    .encode());
        }
    }
    
    public void delete(RoutingContext ctx) {
        String idParam = ctx.pathParam("id");
        
        try {
            Long id = Long.parseLong(idParam);
            
            userService.delete(id)
                .onSuccess(deleted -> {
                    if (deleted) {
                        // Invalidate cache
                        cacheService.delete("user:" + id);
                        
                        ctx.response().setStatusCode(204).end();
                    } else {
                        ctx.response()
                            .setStatusCode(404)
                            .end(new JsonObject()
                                .put("error", "User not found")
                                .encode());
                    }
                })
                .onFailure(error -> {
                    ctx.response()
                        .setStatusCode(500)
                        .end(new JsonObject()
                            .put("error", error.getMessage())
                            .encode());
                });
        } catch (NumberFormatException e) {
            ctx.response()
                .setStatusCode(400)
                .end(new JsonObject()
                    .put("error", "Invalid user ID")
                    .encode());
        }
    }
}
`,
    'src/main/java/{{packagePath}}/dto/LoginRequest.java': `package {{packageName}}.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class LoginRequest {
    
    @JsonProperty("username")
    private String username;
    
    @JsonProperty("password")
    private String password;
    
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

import com.fasterxml.jackson.annotation.JsonProperty;

public class RegisterRequest {
    
    @JsonProperty("username")
    private String username;
    
    @JsonProperty("email")
    private String email;
    
    @JsonProperty("password")
    private String password;
    
    @JsonProperty("first_name")
    private String firstName;
    
    @JsonProperty("last_name")
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

import {{packageName}}.model.User;
import com.fasterxml.jackson.annotation.JsonProperty;

public class AuthResponse {
    
    @JsonProperty("access_token")
    private String accessToken;
    
    @JsonProperty("refresh_token")
    private String refreshToken;
    
    @JsonProperty("token_type")
    private String tokenType;
    
    @JsonProperty("expires_in")
    private Long expiresIn;
    
    @JsonProperty("user")
    private User user;
    
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
    
    public User getUser() {
        return user;
    }
    
    public void setUser(User user) {
        this.user = user;
    }
}
`,
    'src/main/resources/config.yaml': `http:
  port: {{port}}

database:
  host: \${DB_HOST:localhost}
  port: \${DB_PORT:5432}
  database: \${DB_NAME:{{serviceName}}_db}
  user: \${DB_USER:postgres}
  password: \${DB_PASSWORD:postgres}
  maxPoolSize: 10

redis:
  uri: redis://\${REDIS_HOST:localhost}:\${REDIS_PORT:6379}

jwt:
  secret: \${JWT_SECRET:change-this-secret-for-production}
  expiresIn: 3600
  refreshExpiresIn: 86400

cors:
  allowedOrigins:
    - http://localhost:3000
    - http://localhost:5173
`,
    'src/main/resources/openapi.yaml': `openapi: 3.0.0
info:
  title: {{serviceName}} API
  description: {{description}}
  version: 1.0.0
  contact:
    name: {{team}} Team
    email: {{team}}@{{org}}.com

servers:
  - url: http://localhost:{{port}}
    description: Development server

paths:
  /api/auth/register:
    post:
      tags:
        - Authentication
      summary: Register new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: User registered successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '400':
          description: Invalid input or user already exists

  /api/auth/login:
    post:
      tags:
        - Authentication
      summary: Authenticate user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          description: Invalid credentials

  /api/users:
    get:
      tags:
        - Users
      summary: Get all users
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: limit
          schema:
            type: integer
            default: 20
        - in: query
          name: offset
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          format: int64
        username:
          type: string
        email:
          type: string
          format: email
        firstName:
          type: string
        lastName:
          type: string
        roles:
          type: array
          items:
            type: string
        enabled:
          type: boolean
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    RegisterRequest:
      type: object
      required:
        - username
        - email
        - password
      properties:
        username:
          type: string
          minLength: 3
          maxLength: 50
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 6
        firstName:
          type: string
        lastName:
          type: string

    LoginRequest:
      type: object
      required:
        - username
        - password
      properties:
        username:
          type: string
        password:
          type: string

    AuthResponse:
      type: object
      properties:
        access_token:
          type: string
        refresh_token:
          type: string
        token_type:
          type: string
        expires_in:
          type: integer
        user:
          $ref: '#/components/schemas/User'
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
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="info">
        <appender-ref ref="STDOUT" />
    </root>

    <logger name="{{packageName}}" level="debug" />
    <logger name="io.vertx" level="info" />
    <logger name="io.netty" level="info" />
</configuration>
`,
    'src/test/java/{{packagePath}}/MainVerticleTest.java': `package {{packageName}};

import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(VertxExtension.class)
class MainVerticleTest {

    @BeforeEach
    void deploy_verticle(Vertx vertx, VertxTestContext testContext) {
        vertx.deployVerticle(new MainVerticle(), testContext.succeeding(id -> testContext.completeNow()));
    }

    @Test
    void verticle_deployed(Vertx vertx, VertxTestContext testContext) {
        testContext.completeNow();
    }

    @Test
    void health_check_responds(Vertx vertx, VertxTestContext testContext) {
        WebClient client = WebClient.create(vertx);
        
        client.get({{port}}, "localhost", "/health/live")
            .send()
            .onComplete(testContext.succeeding(response -> {
                testContext.verify(() -> {
                    assertEquals(200, response.statusCode());
                    assertEquals("OK", response.bodyAsString());
                });
                testContext.completeNow();
            }));
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

# Vert.x
.vertx/
file-uploads/
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
RUN mvn clean package

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM eclipse-temurin:17-jre-alpine
RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/target/*-fat.jar app.jar
USER appuser
EXPOSE {{port}}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:{{port}}/health || exit 1

CMD ["java", "-jar", "app.jar"]
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
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=change-this-secret-for-production
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
./mvnw exec:java
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
- OpenAPI Spec: http://localhost:{{port}}/openapi.yaml

## 🔒 Security

This application uses JWT for authentication:

1. Register: \`POST /api/auth/register\`
2. Login: \`POST /api/auth/login\`
3. Use the token in \`Authorization: Bearer <token>\` header

## 📊 Monitoring

- Health Check: http://localhost:{{port}}/health
- Live Check: http://localhost:{{port}}/health/live
- Ready Check: http://localhost:{{port}}/health/ready
- Metrics: http://localhost:{{port}}/metrics

## 🏗️ Architecture

- **Framework**: Vert.x 4.5
- **Security**: JWT Authentication
- **Database**: PostgreSQL with reactive client
- **Caching**: Redis
- **Migrations**: Flyway
- **API Documentation**: OpenAPI 3.0
- **Testing**: JUnit 5, Vert.x Test

## 🌟 Features

- ⚡ Non-blocking, event-driven architecture
- 🔄 Reactive programming model
- 🚀 High performance and low latency
- 🔐 JWT authentication
- 📊 Built-in health checks and metrics
- 🧪 Comprehensive test coverage
- 📚 Auto-generated API documentation
- 🌍 Polyglot support (multiple JVM languages)
`
  }
};