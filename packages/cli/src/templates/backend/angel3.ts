import { BackendTemplate } from '../types';

export const angel3Template: BackendTemplate = {
  id: 'angel3',
  name: 'angel3',
  displayName: 'Angel3 Framework',
  description: 'Full-stack Dart framework with ORM, real-time features, dependency injection, and GraphQL support',
  language: 'dart',
  framework: 'angel3',
  version: '8.0.0',
  tags: ['dart', 'angel3', 'api', 'rest', 'database', 'websockets', 'graphql', 'full-stack'],
  port: 3000,
  dependencies: {},
  features: ['database', 'websockets', 'graphql', 'authentication', 'middleware'],
  
  files: {
    // Dart project configuration
    'pubspec.yaml': `name: {{projectName}}
description: A full-stack server application using Angel3 framework
version: 1.0.0
publish_to: none

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  # Angel3 Framework
  angel3_framework: ^8.0.0
  angel3_auth: ^8.0.0
  angel3_configuration: ^8.0.0
  angel3_jael: ^8.0.0
  angel3_production: ^8.0.0
  angel3_static: ^8.0.0
  angel3_cors: ^8.0.0
  angel3_hot: ^8.0.0
  angel3_serialize: ^8.0.0
  angel3_orm: ^8.0.0
  angel3_orm_postgres: ^8.0.0
  angel3_orm_mysql: ^8.0.0
  angel3_migration: ^8.0.0
  angel3_validate: ^8.0.0
  angel3_graphql: ^8.0.0
  angel3_websocket: ^8.0.0
  angel3_client: ^8.0.0
  angel3_test: ^8.0.0
  
  # Database
  postgres: ^3.0.0
  mysql_client: ^0.0.27
  sqlite3: ^2.1.0
  
  # Authentication
  crypto: ^3.0.3
  jaguar_jwt: ^3.0.0
  
  # Utilities
  belatuk_pretty_logging: ^6.0.0
  dotenv: ^4.2.0
  uuid: ^4.2.1
  collection: ^1.18.0
  intl: ^0.18.1
  
dev_dependencies:
  angel3_orm_generator: ^8.0.0
  angel3_serialize_generator: ^8.0.0
  build_runner: ^2.4.0
  lints: ^3.0.0
  test: ^1.24.0
  mockito: ^5.4.3
  build_test: ^2.2.1`,

    // Main entry point
    'bin/server.dart': `import 'dart:io';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_production/angel3_production.dart';
import 'package:{{projectName}}/{{projectName}}.dart';
import 'package:{{projectName}}/config/config.dart' as config;
import 'package:belatuk_pretty_logging/belatuk_pretty_logging.dart';
import 'package:logging/logging.dart';

void main(List<String> args) {
  // Set up logging
  hierarchicalLoggingEnabled = true;
  
  if (config.isProduction) {
    Logger.root.level = Level.INFO;
  } else {
    Logger.root.level = Level.ALL;
    Logger.root.onRecord.listen(prettyLog);
  }

  // Start the server
  return Runner('{{projectName}}', configureServer).run(args);
}`,

    // Development server with hot reload
    'bin/dev.dart': `import 'dart:io';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_hot/angel3_hot.dart';
import 'package:{{projectName}}/{{projectName}}.dart';
import 'package:logging/logging.dart';
import 'package:belatuk_pretty_logging/belatuk_pretty_logging.dart';

void main() async {
  // Set up hot reload logging
  hierarchicalLoggingEnabled = true;
  Logger.root.level = Level.ALL;
  Logger.root.onRecord.listen(prettyLog);

  var hot = HotReloader(() async {
    var logger = Logger('{{projectName}}');
    var app = Angel(logger: logger);
    await app.configure(configureServer);
    return app;
  }, [
    Directory('lib'),
    Directory('config')]);

  await hot.startServer('127.0.0.1', 3000);
}`,

    // Main library file
    'lib/{{projectName}}.dart': `library {{projectName}};

import 'dart:async';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_static/angel3_static.dart';
import 'package:file/file.dart';
import 'package:{{projectName}}/config/config.dart' as config;
import 'package:{{projectName}}/config/plugins/plugins.dart' as plugins;
import 'package:{{projectName}}/routes/routes.dart' as routes;
import 'package:{{projectName}}/services/services.dart' as services;

export 'package:{{projectName}}/models/models.dart';
export 'package:{{projectName}}/services/services.dart';
export 'package:{{projectName}}/controllers/controllers.dart';

/// Configures the server instance
Future configureServer(Angel app) async {
  // Load configuration
  await config.configureServer(app);
  
  // Configure plugins (database, auth, etc)
  await plugins.configureServer(app);
  
  // Set up services
  await services.configureServer(app);
  
  // Set up routes
  await routes.configureServer(app);
  
  // Static file handling
  var fs = app.container.make<FileSystem>();
  var vDir = VirtualDirectory(app, fs, source: fs.directory('public'));
  app.fallback(vDir.handleRequest);
  
  // 404 handler
  app.fallback((req, res) => throw AngelHttpException.notFound());
  
  // Error handler
  var oldErrorHandler = app.errorHandler;
  app.errorHandler = (e, req, res) async {
    if (req.accepts('application/json', strict: true)) {
      res
        ..statusCode = e.statusCode
        ..json({
          'error': e.message,
          'statusCode': e.statusCode,
          'details': e.errors});
    } else {
      return await oldErrorHandler(e, req, res);
    }
  };
}`,

    // Configuration
    'lib/config/config.dart': `import 'dart:io';
import 'package:angel3_configuration/angel3_configuration.dart';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_jael/angel3_jael.dart';
import 'package:file/local.dart';
import 'package:dotenv/dotenv.dart';

/// Whether we are running in production mode
bool get isProduction => Platform.environment['ANGEL_ENV'] == 'production';

/// Configures the server from environment and config files
Future configureServer(Angel app) async {
  // Load environment variables
  var env = DotEnv()..load();
  
  // Load configuration files
  var fs = const LocalFileSystem();
  await app.configure(configuration(
    fs,
    directoryPath: 'config',
    envPath: '.env',
  ));
  
  // Configure Jael templating
  await app.configure(jael(fs.directory('views')));
  
  // Set server configuration
  app.configuration.addAll({
    'host': env['HOST'] ?? '127.0.0.1',
    'port': int.parse(env['PORT'] ?? '3000'),
    'jwt_secret': env['JWT_SECRET'] ?? 'your-secret-key',
    'db_type': env['DB_TYPE'] ?? 'postgres',
    'db_host': env['DB_HOST'] ?? 'localhost',
    'db_port': int.parse(env['DB_PORT'] ?? '5432'),
    'db_name': env['DB_NAME'] ?? '{{projectName}}',
    'db_user': env['DB_USER'] ?? 'postgres',
    'db_password': env['DB_PASSWORD'] ?? ''});
}`,

    'config/default.yaml': `# Default configuration
name: {{projectName}}
version: 1.0.0

# Server settings
server:
  host: 0.0.0.0
  port: 3000
  
# Security
auth:
  jwt_expiry_minutes: 15
  refresh_token_days: 30
  bcrypt_rounds: 10
  
# Features
features:
  websocket: true
  graphql: true
  
# Logging
logging:
  level: info
  format: json`,

    'config/development.yaml': `# Development configuration
server:
  host: 127.0.0.1
  
logging:
  level: debug
  format: pretty
  
# Development features
hot_reload: true
debug: true`,

    'config/production.yaml': `# Production configuration
server:
  host: 0.0.0.0
  
logging:
  level: warning
  
# Production optimizations
cache:
  enabled: true
  ttl: 3600
  
compression:
  enabled: true`,

    // Plugins configuration
    'lib/config/plugins/plugins.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'orm.dart' as orm;
import 'auth.dart' as auth;
import 'cors.dart' as cors;
import 'websocket.dart' as websocket;
import 'graphql.dart' as graphql;

/// Configures all plugins
Future configureServer(Angel app) async {
  // Configure CORS
  await cors.configureServer(app);
  
  // Configure ORM
  await orm.configureServer(app);
  
  // Configure authentication
  await auth.configureServer(app);
  
  // Configure WebSocket
  await websocket.configureServer(app);
  
  // Configure GraphQL
  if (app.configuration['features']?['graphql'] == true) {
    await graphql.configureServer(app);
  }
}`,

    'lib/config/plugins/orm.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_orm_postgres/angel3_orm_postgres.dart';
import 'package:angel3_orm_mysql/angel3_orm_mysql.dart';
import 'package:postgres/postgres.dart';
import 'package:mysql_client/mysql_client.dart';
import 'package:logging/logging.dart';
import 'package:{{projectName}}/models/models.dart';

final _logger = Logger('ORM');

/// Configures database connection and ORM
Future configureServer(Angel app) async {
  var dbType = app.configuration['db_type'] as String;
  var executor = await _createExecutor(app, dbType);
  
  app.container.registerSingleton(executor);
  
  // Run migrations in development
  if (app.environment.isProduction == false) {
    await _runMigrations(executor);
  }
}

Future<QueryExecutor> _createExecutor(Angel app, String dbType) async {
  switch (dbType) {
    case 'postgres':
      var connection = await Connection.open(
        Endpoint(
          host: app.configuration['db_host'] as String,
          port: app.configuration['db_port'] as int,
          database: app.configuration['db_name'] as String,
          username: app.configuration['db_user'] as String,
          password: app.configuration['db_password'] as String,
        ),
        settings: const ConnectionSettings(sslMode: SslMode.prefer),
      );
      
      app.shutdownHooks.add((_) => connection.close());
      _logger.info('Connected to PostgreSQL database');
      
      return PostgreSqlExecutor(connection);
      
    case 'mysql':
      var connection = await MySQLConnection.createConnection(
        host: app.configuration['db_host'] as String,
        port: app.configuration['db_port'] as int,
        userName: app.configuration['db_user'] as String,
        password: app.configuration['db_password'] as String,
        databaseName: app.configuration['db_name'] as String,
      );
      
      await connection.connect();
      app.shutdownHooks.add((_) => connection.close());
      _logger.info('Connected to MySQL database');
      
      return MySqlExecutor(connection);
      
    default:
      throw UnsupportedError('Database type $dbType is not supported');
  }
}

Future<void> _runMigrations(QueryExecutor executor) async {
  _logger.info('Running database migrations...');
  
  // Create tables
  await UserMigration().up(executor);
  await TodoMigration().up(executor);
  await RefreshTokenMigration().up(executor);
  
  _logger.info('Database migrations completed');
}`,

    'lib/config/plugins/auth.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_auth/angel3_auth.dart';
import 'package:jaguar_jwt/jaguar_jwt.dart';
import 'package:{{projectName}}/models/user.dart';
import 'package:{{projectName}}/services/user_service.dart';

/// Configures authentication
Future configureServer(Angel app) async {
  var auth = AngelAuth<User>(
    serializer: (user) => user.id,
    deserializer: (id) async {
      var userService = app.findService<UserService>('/api/users')!;
      return await userService.findOne(
        {'query': {'id': id}},
      );
    },
  );
  
  // JWT strategy
  var jwtSecret = app.configuration['jwt_secret'] as String;
  
  auth.strategies['jwt'] = JwtAuthStrategy(
    secretOrPublicKey: jwtSecret,
    verify: (jwt, req) async {
      var userService = app.findService<UserService>('/api/users')!;
      var userId = jwt.subject;
      
      if (userId == null) return null;
      
      return await userService.findOne(
        {'query': {'id': userId}},
      );
    },
  );
  
  // Local strategy for login
  auth.strategies['local'] = LocalAuthStrategy(
    verifier: (email, password) async {
      var userService = app.findService<UserService>('/api/users')!;
      var user = await userService.findByEmail(email);
      
      if (user != null && user.verifyPassword(password)) {
        return user;
      }
      
      return null;
    },
    usernameField: 'email',
    passwordField: 'password',
  );
  
  app.container.registerSingleton(auth);
  
  // Mount auth routes
  await app.configure(auth.configureServer);
}

class JwtAuthStrategy extends AuthStrategy<User> {
  final String secretOrPublicKey;
  final Future<User?> Function(JwtClaim jwt, RequestContext req) verify;
  
  JwtAuthStrategy({
    required this.secretOrPublicKey,
    required this.verify});
  
  @override
  Future<User?> authenticate(RequestContext req, ResponseContext res,
      [AngelAuthOptions<User>? options]) async {
    var token = AuthToken.parse(req.headers?.value('authorization') ?? '');
    
    if (token?.scheme != 'Bearer') {
      return null;
    }
    
    try {
      var jwt = verifyJwtHS256Signature(token!.credentials, secretOrPublicKey);
      jwt.validate();
      return await verify(jwt, req);
    } catch (e) {
      return null;
    }
  }
}`,

    'lib/config/plugins/cors.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_cors/angel3_cors.dart';

/// Configures CORS
Future configureServer(Angel app) async {
  // Configure CORS with sensible defaults
  app.fallback(
    cors(
      CorsOptions(
        origin: app.environment.isProduction
            ? ['https://yourdomain.com'] // Set your production domains
            : true, // Allow all origins in development
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 3600,
      ),
    ),
  );
}`,

    'lib/config/plugins/websocket.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_websocket/server.dart';
import 'package:file/local.dart';

/// Configures WebSocket support
Future configureServer(Angel app) async {
  var ws = AngelWebSocket(app);
  
  // Enable synchronization across multiple server instances
  // await app.configure(ws.synchronizationChannel);
  
  await app.configure(ws.configureServer);
  app.all('/ws', ws.handleRequest);
  
  // Handle WebSocket events
  ws.onConnection.listen((socket) {
    socket.request.container.registerSingleton<WebSocketContext>(socket);
    
    print('WebSocket client connected: \${socket.id}');
    
    socket.send('connected', {
      'id': socket.id,
      'message': 'Welcome to {{projectName}} WebSocket server!'});
  });
  
  ws.onDisconnection.listen((socket) {
    print('WebSocket client disconnected: \${socket.id}');
  });
  
  // Register WebSocket actions
  ws.onAction('ping', (socket, data) {
    socket.send('pong', {'timestamp': DateTime.now().toIso8601String()});
  });
  
  ws.onAction('broadcast', (socket, data) {
    ws.batchEvent({
      'type': 'broadcast',
      'from': socket.id,
      'data': data,
      'timestamp': DateTime.now().toIso8601String()});
  });
}`,

    'lib/config/plugins/graphql.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_graphql/angel3_graphql.dart';
import 'package:graphql_server/graphql_server.dart';
import 'package:{{projectName}}/graphql/schema.dart';

/// Configures GraphQL
Future configureServer(Angel app) async {
  var schema = createGraphQLSchema(app);
  
  // Mount GraphQL
  app.all('/graphql', graphQLHttp(schema));
  
  // Mount GraphiQL in development
  if (!app.environment.isProduction) {
    app.get('/graphiql', graphiQL());
  }
  
  // Mount GraphQL subscription support
  // app.get('/subscriptions', graphQLWS(schema));
}`,

    // Models
    'lib/models/models.dart': `export 'user.dart';
export 'todo.dart';
export 'token.dart';`,

    'lib/models/user.dart': `import 'package:angel3_orm/angel3_orm.dart';
import 'package:angel3_serialize/angel3_serialize.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';
import 'todo.dart';
import 'token.dart';

part 'user.g.dart';

@Serializable(autoIdAndDateFields: false)
@Orm(tableName: 'users')
abstract class _User extends Model {
  @primaryKey
  @Column(isNullable: false, indexType: IndexType.primaryKey)
  String get id;

  @Column(isNullable: false, indexType: IndexType.unique)
  String get email;

  @Column(isNullable: false)
  String get passwordHash;

  @Column(isNullable: false)
  String get name;

  @Column(defaultValue: 'NOW()')
  DateTime get createdAt;

  @Column(defaultValue: 'NOW()')
  DateTime get updatedAt;

  @HasMany()
  List<_Todo> get todos;

  @HasMany()
  List<_RefreshToken> get tokens;
}

// User model extension
extension UserExtension on User {
  static String hashPassword(String password) {
    var bytes = utf8.encode(password);
    var digest = sha256.convert(bytes);
    return digest.toString();
  }

  bool verifyPassword(String password) {
    return hashPassword(password) == passwordHash;
  }

  Map<String, dynamic> toPublic() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'createdAt': createdAt.toIso8601String()};
  }
}

// User creation model
@Serializable()
abstract class _CreateUser {
  String get email;
  String get password;
  String get name;
}

// User update model
@Serializable()
abstract class _UpdateUser {
  String? get email;
  String? get name;
}

// User login model
@Serializable()
abstract class _LoginUser {
  String get email;
  String get password;
}

// User migration
class UserMigration extends Migration {
  @override
  void up(QueryExecutor executor) {
    executor.createTable('users', (table) {
      table
        ..varChar('id', length: 36).primaryKey()
        ..varChar('email', length: 255).unique().notNull()
        ..varChar('password_hash', length: 255).notNull()
        ..varChar('name', length: 255).notNull()
        ..timestamp('created_at').defaultsTo(currentTimestamp)
        ..timestamp('updated_at').defaultsTo(currentTimestamp);
    });
  }

  @override
  void down(QueryExecutor executor) {
    executor.dropTable('users');
  }
}`,

    'lib/models/todo.dart': `import 'package:angel3_orm/angel3_orm.dart';
import 'package:angel3_serialize/angel3_serialize.dart';
import 'user.dart';

part 'todo.g.dart';

@Serializable(autoIdAndDateFields: false)
@Orm(tableName: 'todos')
abstract class _Todo extends Model {
  @primaryKey
  @Column(isNullable: false, indexType: IndexType.primaryKey)
  String get id;

  @Column(isNullable: false)
  String get title;

  @Column(isNullable: true)
  String? get description;

  @Column(defaultValue: false)
  bool get completed;

  @BelongsTo()
  _User get user;

  @Column(defaultValue: 'NOW()')
  DateTime get createdAt;

  @Column(defaultValue: 'NOW()')
  DateTime get updatedAt;
}

// Todo creation model
@Serializable()
abstract class _CreateTodo {
  String get title;
  String? get description;
}

// Todo update model
@Serializable()
abstract class _UpdateTodo {
  String? get title;
  String? get description;
  bool? get completed;
}

// Todo migration
class TodoMigration extends Migration {
  @override
  void up(QueryExecutor executor) {
    executor.createTable('todos', (table) {
      table
        ..varChar('id', length: 36).primaryKey()
        ..varChar('user_id', length: 36).notNull().references('users', 'id', onDelete: 'CASCADE')
        ..varChar('title', length: 255).notNull()
        ..text('description').nullable()
        ..boolean('completed').defaultsTo(false)
        ..timestamp('created_at').defaultsTo(currentTimestamp)
        ..timestamp('updated_at').defaultsTo(currentTimestamp);
    });
  }

  @override
  void down(QueryExecutor executor) {
    executor.dropTable('todos');
  }
}`,

    'lib/models/token.dart': `import 'package:angel3_orm/angel3_orm.dart';
import 'package:angel3_serialize/angel3_serialize.dart';
import 'user.dart';

part 'token.g.dart';

@Serializable(autoIdAndDateFields: false)
@Orm(tableName: 'refresh_tokens')
abstract class _RefreshToken extends Model {
  @primaryKey
  @Column(isNullable: false, indexType: IndexType.primaryKey)
  String get id;

  @Column(isNullable: false, indexType: IndexType.unique)
  String get token;

  @BelongsTo()
  _User get user;

  @Column(isNullable: false)
  DateTime get expiresAt;

  @Column(defaultValue: 'NOW()')
  DateTime get createdAt;
}

extension RefreshTokenExtension on RefreshToken {
  bool get isValid => expiresAt.isAfter(DateTime.now());
}

// RefreshToken migration
class RefreshTokenMigration extends Migration {
  @override
  void up(QueryExecutor executor) {
    executor.createTable('refresh_tokens', (table) {
      table
        ..varChar('id', length: 36).primaryKey()
        ..varChar('user_id', length: 36).notNull().references('users', 'id', onDelete: 'CASCADE')
        ..varChar('token', length: 255).unique().notNull()
        ..timestamp('expires_at').notNull()
        ..timestamp('created_at').defaultsTo(currentTimestamp);
    });
  }

  @override
  void down(QueryExecutor executor) {
    executor.dropTable('refresh_tokens');
  }
}`,

    // Services
    'lib/services/services.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'user_service.dart';
import 'todo_service.dart';
import 'token_service.dart';

/// Configure all services
Future configureServer(Angel app) async {
  // User service
  app.use('/api/users', UserService());
  
  // Todo service - protected
  app.use('/api/todos', chain([
    requireAuth<User>(),
    TodoService()]));
  
  // Token service
  app.use('/api/tokens', TokenService());
}`,

    'lib/services/user_service.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_orm/angel3_orm.dart';
import 'package:uuid/uuid.dart';
import 'package:{{projectName}}/models/user.dart';

class UserService extends Service<String, User> {
  final _uuid = const Uuid();
  
  @override
  Future<User> create(data, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var createUser = CreateUserSerializer.fromMap(data as Map);
    
    // Check if user exists
    var existingQuery = UserQuery()..where!.email.equals(createUser.email);
    var existing = await existingQuery.getOne(executor);
    
    if (existing != null) {
      throw AngelHttpException.conflict(message: 'User already exists');
    }
    
    // Create user
    var user = User(
      id: _uuid.v4(),
      email: createUser.email,
      passwordHash: UserExtension.hashPassword(createUser.password),
      name: createUser.name,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    
    var query = UserQuery()..values = user;
    return await query.insert(executor);
  }
  
  @override
  Future<List<User>> index([Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var query = UserQuery();
    
    // Apply filters from query params
    if (params['query'] is Map) {
      var queryParams = params['query'] as Map;
      if (queryParams['email'] != null) {
        query.where!.email.equals(queryParams['email'] as String);
      }
    }
    
    return await query.get(executor);
  }
  
  @override
  Future<User> findOne([Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var query = UserQuery();
    
    if (params['query'] is Map) {
      var queryParams = params['query'] as Map;
      if (queryParams['id'] != null) {
        query.where!.id.equals(queryParams['id'] as String);
      }
      if (queryParams['email'] != null) {
        query.where!.email.equals(queryParams['email'] as String);
      }
    }
    
    var user = await query.getOne(executor);
    if (user == null) {
      throw AngelHttpException.notFound(message: 'User not found');
    }
    
    return user;
  }
  
  @override
  Future<User> read(String id, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var query = UserQuery()..where!.id.equals(id);
    
    var user = await query.getOne(executor);
    if (user == null) {
      throw AngelHttpException.notFound(message: 'User not found');
    }
    
    return user;
  }
  
  @override
  Future<User> update(String id, data, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var updateUser = UpdateUserSerializer.fromMap(data as Map);
    
    // Get existing user
    var existingQuery = UserQuery()..where!.id.equals(id);
    var existing = await existingQuery.getOne(executor);
    
    if (existing == null) {
      throw AngelHttpException.notFound(message: 'User not found');
    }
    
    // Check email uniqueness if changing
    if (updateUser.email != null && updateUser.email != existing.email) {
      var emailQuery = UserQuery()..where!.email.equals(updateUser.email!);
      var emailExists = await emailQuery.getOne(executor);
      if (emailExists != null) {
        throw AngelHttpException.conflict(message: 'Email already taken');
      }
    }
    
    // Update fields
    var updatedUser = existing.copyWith(
      email: updateUser.email ?? existing.email,
      name: updateUser.name ?? existing.name,
      updatedAt: DateTime.now(),
    );
    
    var query = UserQuery()
      ..where!.id.equals(id)
      ..values = updatedUser;
      
    return await query.updateOne(executor);
  }
  
  @override
  Future<User> remove(String id, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    
    var query = UserQuery()..where!.id.equals(id);
    var user = await query.getOne(executor);
    
    if (user == null) {
      throw AngelHttpException.notFound(message: 'User not found');
    }
    
    await query.delete(executor);
    return user;
  }
  
  // Custom method to find by email
  Future<User?> findByEmail(String email) async {
    var executor = app!.container.make<QueryExecutor>();
    var query = UserQuery()..where!.email.equals(email);
    return await query.getOne(executor);
  }
}`,

    'lib/services/todo_service.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_orm/angel3_orm.dart';
import 'package:uuid/uuid.dart';
import 'package:{{projectName}}/models/todo.dart';
import 'package:{{projectName}}/models/user.dart';

class TodoService extends Service<String, Todo> {
  final _uuid = const Uuid();
  
  @override
  Future<Todo> create(data, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var user = params['user'] as User;
    var createTodo = CreateTodoSerializer.fromMap(data as Map);
    
    var todo = Todo(
      id: _uuid.v4(),
      title: createTodo.title,
      description: createTodo.description,
      completed: false,
      userId: user.id,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    
    var query = TodoQuery()..values = todo;
    return await query.insert(executor);
  }
  
  @override
  Future<List<Todo>> index([Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var user = params['user'] as User;
    
    var query = TodoQuery()
      ..where!.userId.equals(user.id)
      ..orderBy(TodoFields.createdAt, descending: true);
    
    return await query.get(executor);
  }
  
  @override
  Future<Todo> read(String id, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var user = params['user'] as User;
    
    var query = TodoQuery()
      ..where!.id.equals(id)
      ..where!.userId.equals(user.id);
    
    var todo = await query.getOne(executor);
    if (todo == null) {
      throw AngelHttpException.notFound(message: 'Todo not found');
    }
    
    return todo;
  }
  
  @override
  Future<Todo> update(String id, data, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var user = params['user'] as User;
    var updateTodo = UpdateTodoSerializer.fromMap(data as Map);
    
    // Get existing todo
    var existingQuery = TodoQuery()
      ..where!.id.equals(id)
      ..where!.userId.equals(user.id);
    
    var existing = await existingQuery.getOne(executor);
    if (existing == null) {
      throw AngelHttpException.notFound(message: 'Todo not found');
    }
    
    // Update fields
    var updatedTodo = existing.copyWith(
      title: updateTodo.title ?? existing.title,
      description: updateTodo.description ?? existing.description,
      completed: updateTodo.completed ?? existing.completed,
      updatedAt: DateTime.now(),
    );
    
    var query = TodoQuery()
      ..where!.id.equals(id)
      ..values = updatedTodo;
      
    return await query.updateOne(executor);
  }
  
  @override
  Future<Todo> remove(String id, [Map<String, dynamic>? params]) async {
    var executor = params!['executor'] as QueryExecutor;
    var user = params['user'] as User;
    
    var query = TodoQuery()
      ..where!.id.equals(id)
      ..where!.userId.equals(user.id);
    
    var todo = await query.getOne(executor);
    if (todo == null) {
      throw AngelHttpException.notFound(message: 'Todo not found');
    }
    
    await query.delete(executor);
    return todo;
  }
}`,

    'lib/services/token_service.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_orm/angel3_orm.dart';
import 'package:uuid/uuid.dart';
import 'package:{{projectName}}/models/token.dart';
import 'package:{{projectName}}/models/user.dart';

class TokenService extends Service<String, RefreshToken> {
  final _uuid = const Uuid();
  
  Future<RefreshToken> createForUser(User user) async {
    var executor = app!.container.make<QueryExecutor>();
    
    var token = RefreshToken(
      id: _uuid.v4(),
      token: _uuid.v4(),
      userId: user.id,
      expiresAt: DateTime.now().add(const Duration(days: 30)),
      createdAt: DateTime.now(),
    );
    
    var query = RefreshTokenQuery()..values = token;
    return await query.insert(executor);
  }
  
  Future<RefreshToken?> findByToken(String token) async {
    var executor = app!.container.make<QueryExecutor>();
    var query = RefreshTokenQuery()..where!.token.equals(token);
    return await query.getOne(executor);
  }
  
  Future<void> deleteByToken(String token) async {
    var executor = app!.container.make<QueryExecutor>();
    var query = RefreshTokenQuery()..where!.token.equals(token);
    await query.delete(executor);
  }
  
  Future<void> deleteExpired() async {
    var executor = app!.container.make<QueryExecutor>();
    var query = RefreshTokenQuery()
      ..where!.expiresAt.lessThan(DateTime.now());
    await query.delete(executor);
  }
}`,

    // Controllers
    'lib/controllers/controllers.dart': `export 'auth_controller.dart';
export 'health_controller.dart';`,

    'lib/controllers/auth_controller.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_auth/angel3_auth.dart';
import 'package:jaguar_jwt/jaguar_jwt.dart';
import 'package:{{projectName}}/models/models.dart';
import 'package:{{projectName}}/services/user_service.dart';
import 'package:{{projectName}}/services/token_service.dart';

@Expose('/auth')
class AuthController extends Controller {
  late AngelAuth<User> _auth;
  late UserService _userService;
  late TokenService _tokenService;
  late String _jwtSecret;
  
  @override
  FutureOr<void> configureServer(Angel app) async {
    await super.configureServer(app);
    
    _auth = app.container.make<AngelAuth<User>>();
    _userService = app.findService<UserService>('/api/users') as UserService;
    _tokenService = app.findService<TokenService>('/api/tokens') as TokenService;
    _jwtSecret = app.configuration['jwt_secret'] as String;
  }
  
  @Expose('/register', method: 'POST')
  Future<Map<String, dynamic>> register(RequestContext req, ResponseContext res) async {
    await req.parseBody();
    
    // Create user
    var user = await _userService.create(req.bodyAsMap, {
      'executor': req.container.make<QueryExecutor>()});
    
    // Generate tokens
    var accessToken = _generateAccessToken(user);
    var refreshToken = await _tokenService.createForUser(user);
    
    return {
      'user': user.toPublic(),
      'accessToken': accessToken,
      'refreshToken': refreshToken.token};
  }
  
  @Expose('/login', method: 'POST')
  Future<Map<String, dynamic>> login(RequestContext req, ResponseContext res) async {
    await req.parseBody();
    
    // Authenticate with local strategy
    var result = await _auth.authenticate('local', req, res);
    
    if (result == null || !result) {
      throw AngelHttpException.unauthorized(message: 'Invalid credentials');
    }
    
    var user = req.container.make<User>();
    
    // Generate tokens
    var accessToken = _generateAccessToken(user);
    var refreshToken = await _tokenService.createForUser(user);
    
    return {
      'user': user.toPublic(),
      'accessToken': accessToken,
      'refreshToken': refreshToken.token};
  }
  
  @Expose('/refresh', method: 'POST')
  Future<Map<String, dynamic>> refresh(RequestContext req, ResponseContext res) async {
    await req.parseBody();
    
    var refreshTokenValue = req.bodyAsMap['refreshToken'] as String?;
    if (refreshTokenValue == null) {
      throw AngelHttpException.badRequest(message: 'Refresh token required');
    }
    
    // Find and validate token
    var token = await _tokenService.findByToken(refreshTokenValue);
    if (token == null || !token.isValid) {
      throw AngelHttpException.unauthorized(message: 'Invalid refresh token');
    }
    
    // Get user
    var user = await _userService.read(token.userId, {
      'executor': req.container.make<QueryExecutor>()});
    
    // Delete old token
    await _tokenService.deleteByToken(refreshTokenValue);
    
    // Generate new tokens
    var accessToken = _generateAccessToken(user);
    var newRefreshToken = await _tokenService.createForUser(user);
    
    return {
      'accessToken': accessToken,
      'refreshToken': newRefreshToken.token};
  }
  
  @Expose('/logout', method: 'POST', middleware: [requireAuth])
  Future<void> logout(RequestContext req, ResponseContext res) async {
    // Token-based auth doesn't require server-side logout
    // Client should discard tokens
    res.statusCode = 204;
  }
  
  @Expose('/me', method: 'GET', middleware: [requireAuth])
  Future<Map<String, dynamic>> me(RequestContext req, ResponseContext res) async {
    var user = req.container.make<User>();
    return user.toPublic();
  }
  
  String _generateAccessToken(User user) {
    var claimSet = JwtClaim(
      issuer: '{{projectName}}',
      subject: user.id,
      issuedAt: DateTime.now(),
      expiry: DateTime.now().add(const Duration(minutes: 15)),
      otherClaims: {
        'email': user.email,
        'name': user.name},
    );
    
    return issueJwtHS256(claimSet, _jwtSecret);
  }
}`,

    'lib/controllers/health_controller.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_orm/angel3_orm.dart';

@Expose('/health')
class HealthController extends Controller {
  @Expose('/', method: 'GET')
  Future<Map<String, dynamic>> checkHealth(RequestContext req) async {
    var dbHealthy = await _checkDatabase(req);
    
    return {
      'status': dbHealthy ? 'healthy' : 'unhealthy',
      'timestamp': DateTime.now().toIso8601String(),
      'version': app?.configuration['version'] ?? '1.0.0',
      'checks': {
        'database': dbHealthy}};
  }
  
  Future<bool> _checkDatabase(RequestContext req) async {
    try {
      var executor = req.container.make<QueryExecutor>();
      // Simple query to check connection
      await executor.query('SELECT 1');
      return true;
    } catch (e) {
      return false;
    }
  }
}`,

    // Routes
    'lib/routes/routes.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_auth/angel3_auth.dart';
import 'package:angel3_static/angel3_static.dart';
import 'package:{{projectName}}/controllers/controllers.dart';

/// Configure application routes
Future configureServer(Angel app) async {
  // Mount controllers
  await app.mountController<AuthController>();
  await app.mountController<HealthController>();
  
  // API info route
  app.get('/', (req, res) {
    return res.json({
      'name': '{{projectName}} API',
      'version': app.configuration['version'] ?? '1.0.0',
      'status': 'running',
      'endpoints': {
        'auth': '/auth',
        'health': '/health',
        'api': '/api',
        'graphql': '/graphql',
        'websockets': '/ws'}});
  });
  
  // Protected API info
  app.get('/api', requireAuth<User>(), (req, res) {
    var user = req.container.make<User>();
    return res.json({
      'message': 'Welcome to the protected API',
      'user': user.toPublic()});
  });
}`,

    // GraphQL Schema
    'lib/graphql/schema.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:graphql_server/graphql_server.dart';
import 'package:{{projectName}}/models/models.dart';
import 'package:{{projectName}}/services/services.dart';

GraphQLSchema createGraphQLSchema(Angel app) {
  var userType = objectType(
    'User',
    fields: [
      field('id', graphQLString.nonNullable()),
      field('email', graphQLString.nonNullable()),
      field('name', graphQLString.nonNullable()),
      field('createdAt', graphQLString.nonNullable()),
      field('todos', listOf(todoType))],
  );
  
  var todoType = objectType(
    'Todo',
    fields: [
      field('id', graphQLString.nonNullable()),
      field('title', graphQLString.nonNullable()),
      field('description', graphQLString),
      field('completed', graphQLBoolean.nonNullable()),
      field('createdAt', graphQLString.nonNullable()),
      field('updatedAt', graphQLString.nonNullable())],
  );
  
  var queryType = objectType(
    'Query',
    fields: [
      field(
        'me',
        userType,
        resolve: (_, args) async {
          // Get current user from context
          var req = _.get<RequestContext>('req');
          return req?.container.make<User>();
        },
      ),
      field(
        'todos',
        listOf(todoType),
        resolve: (_, args) async {
          var req = _.get<RequestContext>('req');
          var user = req?.container.make<User>();
          var todoService = app.findService<TodoService>('/api/todos');
          
          return await todoService?.index({
            'user': user,
            'executor': req?.container.make<QueryExecutor>()});
        },
      )],
  );
  
  var mutationType = objectType(
    'Mutation',
    fields: [
      field(
        'createTodo',
        todoType,
        inputs: [
          GraphQLFieldInput('title', graphQLString.nonNullable()),
          GraphQLFieldInput('description', graphQLString)],
        resolve: (_, args) async {
          var req = _.get<RequestContext>('req');
          var user = req?.container.make<User>();
          var todoService = app.findService<TodoService>('/api/todos');
          
          return await todoService?.create(args, {
            'user': user,
            'executor': req?.container.make<QueryExecutor>()});
        },
      )],
  );
  
  return graphQLSchema(
    queryType: queryType,
    mutationType: mutationType,
  );
}`,

    // Views
    'views/error.jael': `<html>
<head>
    <title>Error {{ statusCode }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
        }
        h1 { color: #e74c3c; }
        .error-code { font-size: 72px; font-weight: bold; color: #bdc3c7; }
        .message { color: #7f8c8d; margin: 20px 0; }
        a { color: #3498db; text-decoration: none; }
    </style>
</head>
<body>
    <div class="error-code">{{ statusCode }}</div>
    <h1>{{ message ?? "An error occurred" }}</h1>
    <p class="message">{{ error }}</p>
    <a href="/">Go back home</a>
</body>
</html>`,

    // Public files
    'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; }
        .endpoints {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .endpoint {
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .endpoint:last-child { border-bottom: none; }
        .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }
        .get { background: #28a745; color: white; }
        .post { background: #007bff; color: white; }
        .put { background: #ffc107; color: black; }
        .delete { background: #dc3545; color: white; }
        code {
            background: #f1f3f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{projectName}} API</h1>
        <p>Welcome to the {{projectName}} API server built with Angel3 framework.</p>
        
        <div class="endpoints">
            <h2>Available Endpoints</h2>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/health</code> - Health check
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <code>/auth/register</code> - Register new user
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <code>/auth/login</code> - Login
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <code>/auth/refresh</code> - Refresh token
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/api</code> - Protected API info (requires auth)
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/graphql</code> - GraphQL endpoint
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/graphiql</code> - GraphQL IDE (development only)
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/ws</code> - WebSocket endpoint
            </div>
        </div>
    </div>
</body>
</html>`,

    // Tests
    'test/auth_test.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_test/angel3_test.dart';
import 'package:test/test.dart';
import 'package:{{projectName}}/{{projectName}}.dart';

void main() {
  late Angel app;
  late TestClient client;

  setUp(() async {
    app = Angel();
    await app.configure(configureServer);
    client = await connectTo(app);
  });

  tearDown(() async {
    await client.close();
  });

  group('Authentication', () {
    test('can register new user', () async {
      var response = await client.post('/auth/register', body: {
        'email': 'test@example.com',
        'password': 'password123',
        'name': 'Test User'});

      expect(response, hasStatus(200));
      expect(response.body['user']['email'], equals('test@example.com'));
      expect(response.body['accessToken'], isNotEmpty);
      expect(response.body['refreshToken'], isNotEmpty);
    });

    test('can login with valid credentials', () async {
      // First register
      await client.post('/auth/register', body: {
        'email': 'login@example.com',
        'password': 'password123',
        'name': 'Login User'});

      // Then login
      var response = await client.post('/auth/login', body: {
        'email': 'login@example.com',
        'password': 'password123'});

      expect(response, hasStatus(200));
      expect(response.body['user']['email'], equals('login@example.com'));
      expect(response.body['accessToken'], isNotEmpty);
    });

    test('cannot login with invalid credentials', () async {
      var response = await client.post('/auth/login', body: {
        'email': 'wrong@example.com',
        'password': 'wrongpassword'});

      expect(response, hasStatus(401));
    });
  });
}`,

    // Configuration files
    '.env.example': `# Environment
ANGEL_ENV=development

# Server
HOST=0.0.0.0
PORT=3000

# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectName}}
DB_USER=postgres
DB_PASSWORD=

# Security
JWT_SECRET=your-secret-key-here`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM dart:3.2-sdk AS build

WORKDIR /app

# Copy pubspec files
COPY pubspec.* ./

# Install dependencies
RUN dart pub get

# Copy source code
COPY . .

# Generate code
RUN dart run build_runner build --delete-conflicting-outputs

# Compile
RUN dart compile exe bin/server.dart -o bin/server

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    ca-certificates \\
    libsqlite3-0 \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash app

WORKDIR /app

# Copy compiled executable
COPY --from=build /app/bin/server .
COPY --from=build /app/config ./config
COPY --from=build /app/views ./views
COPY --from=build /app/public ./public

# Set ownership
RUN chown -R app:app /app

USER app

# Environment
ENV ANGEL_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["./server"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ANGEL_ENV=production
      - PORT=3000
      - DB_TYPE=postgres
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME={{projectName}}
      - DB_USER=angel
      - DB_PASSWORD=angel_password
      - JWT_SECRET=your-production-secret-key
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./public:/app/public
      - ./views:/app/views

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=angel
      - POSTGRES_PASSWORD=angel_password
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U angel"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:`,

    // README
    'README.md': `# {{projectName}}

A full-stack server application built with Angel3 framework.

## Features

- ✅ Full-featured web framework with dependency injection
- ✅ ORM with PostgreSQL, MySQL, and SQLite support
- ✅ Real-time WebSocket support
- ✅ GraphQL API with GraphiQL interface
- ✅ JWT authentication with refresh tokens
- ✅ Database migrations
- ✅ Hot reload in development
- ✅ Request validation
- ✅ Comprehensive middleware system
- ✅ Docker ready

## Requirements

- Dart SDK 3.0 or later

## Getting Started

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   dart pub get
   \`\`\`
3. Generate code:
   \`\`\`bash
   dart run build_runner build
   \`\`\`
4. Copy \`.env.example\` to \`.env\` and configure
5. Run the server:
   \`\`\`bash
   dart run bin/server.dart
   \`\`\`

## Development

Run with hot reload:
\`\`\`bash
dart run bin/dev.dart
\`\`\`

Generate code after model changes:
\`\`\`bash
dart run build_runner watch
\`\`\`

## API Endpoints

### REST API
- \`GET /\` - API information
- \`GET /health\` - Health check
- \`POST /auth/register\` - Register new user
- \`POST /auth/login\` - Login
- \`POST /auth/refresh\` - Refresh token
- \`POST /auth/logout\` - Logout (protected)
- \`GET /auth/me\` - Get current user (protected)

### GraphQL
- \`GET/POST /graphql\` - GraphQL endpoint
- \`GET /graphiql\` - GraphQL IDE (development only)

### WebSocket
- \`WS /ws\` - WebSocket connection

## Testing

Run all tests:
\`\`\`bash
dart test
\`\`\`

## Building

Build for production:
\`\`\`bash
dart compile exe bin/server.dart
\`\`\`

## Docker

Build and run with Docker:
\`\`\`bash
docker-compose up
\`\`\`

## Project Structure

\`\`\`
├── bin/              # Entry points
├── config/           # Configuration files
├── lib/
│   ├── config/       # App configuration
│   ├── controllers/  # HTTP controllers
│   ├── graphql/      # GraphQL schema
│   ├── models/       # Data models
│   ├── routes/       # Route definitions
│   └── services/     # Business logic
├── public/           # Static files
├── test/             # Tests
└── views/            # Template files
\`\`\`

## License

MIT`,

    '.gitignore': `# Dart
.dart_tool/
.packages
build/
pubspec.lock

# Generated files
*.g.dart

# Environment
.env
.env.local

# Database
*.db
*.sqlite
*.sqlite3

# IDE
.idea/
.vscode/

# Logs
*.log

# OS
.DS_Store
Thumbs.db`,

    'analysis_options.yaml': `include: package:lints/recommended.yaml

analyzer:
  exclude:
    - build/**
    - "**/*.g.dart"
    
linter:
  rules:
    - always_declare_return_types
    - avoid_empty_else
    - avoid_relative_lib_imports
    - avoid_returning_null_for_future
    - avoid_types_as_parameter_names
    - avoid_web_libraries_in_flutter
    - cancel_subscriptions
    - close_sinks
    - literal_only_boolean_expressions
    - no_adjacent_strings_in_list
    - prefer_void_to_null
    - test_types_in_equals
    - throw_in_finally
    - unnecessary_statements`,

    'build.yaml': `targets:
  $default:
    builders:
      angel3_orm_generator:
        generate_for:
          - lib/models/*.dart
      angel3_serialize_generator:
        generate_for:
          - lib/models/*.dart
          
builders:
  angel3_orm_generator:
    import: "package:angel3_orm_generator/angel3_orm_generator.dart"
    builder_factories:
      - migrationBuilder
      - ormBuilder
      - sqlMigrationBuilder
    build_extensions:
      ".dart":
        - ".g.dart"
        - ".migration.dart"
        - ".migration.sql"
    auto_apply: dependents
    build_to: source
    applies_builders: ["source_gen|combining_builder"]
    
  angel3_serialize_generator:
    import: "package:angel3_serialize_generator/angel3_serialize_generator.dart"
    builder_factories:
      - jsonModelBuilder
    build_extensions:
      ".dart":
        - ".g.dart"
    auto_apply: dependents
    build_to: source
    applies_builders: ["source_gen|combining_builder"]`}};