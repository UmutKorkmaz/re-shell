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
    'pubspec.yaml': `name: {{projectNameSnake}}
description: A full-stack server application using Angel3 framework
version: 1.0.0
publish_to: none

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  # Angel3 Framework
  angel3_container: ^8.0.0
  angel3_framework: ^8.0.0
  angel3_configuration: ^8.0.0
  angel3_jael: ^8.0.0
  angel3_static: ^8.0.0
  angel3_hot: ^8.0.0
  angel3_websocket: ^8.0.0
  angel3_graphql: ^8.0.0
  graphql_schema2: ^6.0.0
  graphql_server2: ^6.0.0

  # Database
  postgres: ^3.0.0
  mysql_client: ^0.0.27
  sqlite3: ^2.1.0

  # Authentication
  crypto: ^3.0.3
  jaguar_jwt: ^3.0.0

  # Utilities
  args: ^2.4.0
  belatuk_pretty_logging: ^6.0.0
  dotenv: ^4.2.0
  file: ^7.0.0
  logging: ^1.2.0
  uuid: ^4.2.1
  collection: ^1.18.0
  intl: ^0.18.1

dev_dependencies:
  http: ^1.1.0
  lints: ^3.0.0
  test: ^1.24.0
`,

    // Main entry point
    'bin/server.dart': `import 'dart:io';

import 'package:angel3_container/angel3_container.dart';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_framework/http.dart';
import 'package:args/args.dart';
import 'package:belatuk_pretty_logging/belatuk_pretty_logging.dart';
import 'package:logging/logging.dart';
import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

Future<void> main(List<String> args) async {
  final result = (ArgParser()
        ..addOption('host', abbr: 'H', defaultsTo: Config.host)
        ..addOption('port', abbr: 'p', defaultsTo: Config.port.toString()))
      .parse(args);

  // Set up logging
  hierarchicalLoggingEnabled = true;
  Logger.root.level = isProduction ? Level.INFO : Level.ALL;
  Logger.root.onRecord.listen(prettyLog);

  // Routes are plain functions, so no reflection (dart:mirrors) is needed
  final app = Angel(logger: Logger('{{projectName}}'), reflector: const EmptyReflector());
  await app.configure(configureServer);

  final http = AngelHttp(app);
  await http.startServer(result['host'] as String, int.parse(result['port'] as String));
  print('Listening at \${http.uri}');

  // Graceful shutdown
  ProcessSignal.sigint.watch().listen((_) async {
    await http.close();
    await app.close();
    exit(0);
  });
}
`,

    // Development server with hot reload
    'bin/dev.dart': `import 'dart:io';
import 'package:angel3_container/angel3_container.dart';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_hot/angel3_hot.dart';
import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';
import 'package:logging/logging.dart';
import 'package:belatuk_pretty_logging/belatuk_pretty_logging.dart';

void main() async {
  // Set up hot reload logging
  hierarchicalLoggingEnabled = true;
  Logger.root.level = Level.ALL;
  Logger.root.onRecord.listen(prettyLog);

  var hot = HotReloader(() async {
    var logger = Logger('{{projectName}}');
    var app = Angel(logger: logger, reflector: const EmptyReflector());
    await app.configure(configureServer);
    return app;
  }, [
    Directory('lib'),
    Directory('config')]);

  await hot.startServer('127.0.0.1', 3000);
}`,

    // Main library file
    'lib/{{projectNameSnake}}.dart': `library {{projectNameSnake}};

import 'dart:async';

import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_static/angel3_static.dart';
import 'package:file/local.dart';
import 'package:{{projectNameSnake}}/config/config.dart' as config;
import 'package:{{projectNameSnake}}/config/plugins/plugins.dart' as plugins;
import 'package:{{projectNameSnake}}/database/database.dart';
import 'package:{{projectNameSnake}}/routes/routes.dart' as routes;

export 'package:{{projectNameSnake}}/config/config.dart' show Config, isProduction;
export 'package:{{projectNameSnake}}/controllers/controllers.dart';
export 'package:{{projectNameSnake}}/models/models.dart';
export 'package:{{projectNameSnake}}/services/services.dart';

/// Configures the server instance
Future<void> configureServer(Angel app) async {
  // Load configuration (config/*.yaml, Jael views)
  await config.configureServer(app);

  // Connect to the database and create the tables in development
  await Database.initialize();
  if (!config.isProduction) {
    await Database.runMigrations();
  }
  app.shutdownHooks.add((_) => Database.close());

  // Configure plugins (CORS, WebSocket, GraphQL)
  await plugins.configureServer(app);

  // Set up routes
  await routes.configureServer(app);

  // Static file handling
  const fs = LocalFileSystem();
  if (fs.directory('public').existsSync()) {
    final vDir = VirtualDirectory(app, fs, source: fs.directory('public'));
    app.fallback(vDir.handleRequest);
  }

  // 404 handler
  app.fallback((req, res) => throw AngelHttpException.notFound());

  // Error handler: JSON for API clients, the default page otherwise
  final oldErrorHandler = app.errorHandler;
  app.errorHandler = (e, req, res) async {
    final accept = req.headers?.value('accept') ?? '';
    if (accept.contains('text/html') && !accept.contains('application/json')) {
      return await oldErrorHandler(e, req, res);
    }

    res
      ..statusCode = e.statusCode
      ..json({
        'error': e.message,
        'statusCode': e.statusCode,
        if (e.errors.isNotEmpty) 'details': e.errors});
  };
}
`,

    // Configuration
    'lib/config/config.dart': `import 'dart:io';

import 'package:angel3_configuration/angel3_configuration.dart';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_jael/angel3_jael.dart';
import 'package:dotenv/dotenv.dart';
import 'package:file/local.dart';

/// Settings read from the environment and an optional \`.env\` file.
class Config {
  static DotEnv _env = _create();

  /// Values that take precedence over the environment (used by tests).
  static final Map<String, String> overrides = {};

  static String? _get(String key) => overrides[key] ?? _env[key];

  static String get environment => _get('ANGEL_ENV') ?? _get('ENVIRONMENT') ?? 'development';
  static String get host => _get('HOST') ?? '127.0.0.1';
  static int get port => int.tryParse(_get('PORT') ?? '') ?? 3000;

  // Database
  static String get dbType => _get('DB_TYPE') ?? 'sqlite';
  static String get dbHost => _get('DB_HOST') ?? 'localhost';
  static int get dbPort => int.tryParse(_get('DB_PORT') ?? '') ?? 5432;
  static String get dbName => _get('DB_NAME') ?? '{{projectNameSnake}}';
  static String get dbUser => _get('DB_USER') ?? 'postgres';
  static String get dbPassword => _get('DB_PASSWORD') ?? '';
  static bool get dbSsl => (_get('DB_SSL') ?? 'false').toLowerCase() == 'true';
  static String get dbPath => _get('DB_PATH') ?? 'database.db';

  // Security
  static String get jwtSecret => _get('JWT_SECRET') ?? 'your-secret-key';
  static int get jwtExpiryMinutes => int.tryParse(_get('JWT_EXPIRY_MINUTES') ?? '') ?? 15;
  static int get refreshTokenDays => int.tryParse(_get('REFRESH_TOKEN_DAYS') ?? '') ?? 30;

  static DotEnv _create() {
    final env = DotEnv(includePlatformEnvironment: true);

    // Load .env file if it exists
    if (File('.env').existsSync()) {
      env.load(['.env']);
    }
    return env;
  }

  /// Re-reads the environment and the .env file.
  static void reload() {
    _env = _create();
  }
}

/// Whether we are running in production mode
bool get isProduction => Config.environment == 'production';

/// Loads config/*.yaml into app.configuration and sets up Jael templates.
Future<void> configureServer(Angel app) async {
  const fs = LocalFileSystem();

  await app.configure(configuration(fs, directoryPath: 'config'));

  if (fs.directory('views').existsSync()) {
    await app.configure(jael(fs.directory('views')));
  }
}
`,

    'config/default.yaml': `# Default configuration
name: {{projectNameSnake}}
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
import 'cors.dart' as cors;
import 'graphql.dart' as graphql;
import 'websocket.dart' as websocket;

/// Configures all plugins
Future<void> configureServer(Angel app) async {
  await cors.configureServer(app);
  await websocket.configureServer(app);

  if (app.configuration['features']?['graphql'] != false) {
    await graphql.configureServer(app);
  }
}
`,

    'lib/config/plugins/cors.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:{{projectNameSnake}}/config/config.dart';

/// Configures CORS: any origin in development, an allow-list in production.
Future<void> configureServer(Angel app) async {
  // Set your production domains here
  const productionOrigins = ['https://yourdomain.com'];

  // Registered before the routes so it runs first.
  app.all('*', (req, res) async {
    final origin = req.headers?.value('origin');
    if (origin == null) return true;
    if (isProduction && !productionOrigins.contains(origin)) return true;

    res.headers['access-control-allow-origin'] = origin;
    res.headers['access-control-allow-credentials'] = 'true';
    res.headers['vary'] = 'Origin';

    if (req.method == 'OPTIONS') {
      res.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      res.headers['access-control-allow-headers'] = 'Content-Type, Authorization';
      res.headers['access-control-max-age'] = '3600';
      res.statusCode = 204;
      await res.close();
      return false;
    }

    return true;
  });
}
`,

    'lib/config/plugins/websocket.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_websocket/server.dart';

/// Configures WebSocket support at /ws.
///
/// Messages are JSON objects: \`{"eventName": "ping"}\` is answered with a \`pong\`
/// event; \`{"eventName": "broadcast", "data": ...}\` is sent to every client.
Future<void> configureServer(Angel app) async {
  final ws = AngelWebSocket(app, sendErrors: !app.environment.isProduction);

  await app.configure(ws.configureServer);
  app.get('/ws', ws.handleRequest);

  var nextId = 0;

  ws.onConnection.listen((socket) {
    final id = ++nextId;

    socket.send('connected', {
      'id': id,
      'message': 'Welcome to {{projectName}} WebSocket server!'});

    socket.onAction.listen((action) {
      switch (action.eventName) {
        case 'ping':
          socket.send('pong', {'timestamp': DateTime.now().toIso8601String()});
          break;
        case 'broadcast':
          ws.batchEvent(WebSocketEvent(eventName: 'broadcast', data: {
            'from': id,
            'data': action.data,
            'timestamp': DateTime.now().toIso8601String()}));
          break;
      }
    });
  });
}
`,

    'lib/config/plugins/graphql.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_graphql/angel3_graphql.dart';
import 'package:graphql_server2/graphql_server2.dart';
import 'package:{{projectNameSnake}}/config/config.dart';
import 'package:{{projectNameSnake}}/graphql/schema.dart';

/// Configures GraphQL
Future<void> configureServer(Angel app) async {
  final schema = createGraphQLSchema();

  // Mount GraphQL
  app.all('/graphql', graphQLHttp(GraphQL(schema)));

  // Mount GraphiQL in development
  if (!isProduction) {
    app.get('/graphiql', graphiQL());
  }
}
`,

    // Models
    'lib/models/models.dart': `export 'todo.dart';
export 'token.dart';
export 'user.dart';
`,

    'lib/models/user.dart': `import 'package:{{projectNameSnake}}/utils/convert.dart';
import 'package:uuid/uuid.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';

class User {
  final String id;
  final String email;
  final String passwordHash;
  final String name;
  final DateTime createdAt;
  final DateTime updatedAt;

  User({
    String? id,
    required this.email,
    required this.passwordHash,
    required this.name,
    DateTime? createdAt,
    DateTime? updatedAt})  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory User.fromMap(Map<String, dynamic> map) {
    return User(
      id: map['id'] as String,
      email: map['email'] as String,
      passwordHash: map['password_hash'] as String,
      name: map['name'] as String,
      createdAt: parseDateTime(map['created_at']),
      updatedAt: parseDateTime(map['updated_at']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'email': email,
      'password_hash': passwordHash,
      'name': name,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String()};
  }

  Map<String, dynamic> toPublic() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'createdAt': createdAt.toIso8601String()};
  }

  static String hashPassword(String password) {
    final bytes = utf8.encode(password);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  bool verifyPassword(String password) {
    return hashPassword(password) == passwordHash;
  }
}

class CreateUserRequest {
  final String email;
  final String password;
  final String name;

  CreateUserRequest({
    required this.email,
    required this.password,
    required this.name});

  factory CreateUserRequest.fromJson(Map<String, dynamic> json) {
    return CreateUserRequest(
      email: json['email'] as String,
      password: json['password'] as String,
      name: json['name'] as String,
    );
  }

  String? validate() {
    if (email.isEmpty || !email.contains('@')) {
      return 'Invalid email address';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (name.isEmpty) {
      return 'Name is required';
    }
    return null;
  }
}

class LoginRequest {
  final String email;
  final String password;

  LoginRequest({
    required this.email,
    required this.password});

  factory LoginRequest.fromJson(Map<String, dynamic> json) {
    return LoginRequest(
      email: json['email'] as String,
      password: json['password'] as String,
    );
  }
}

class UpdateUserRequest {
  final String? name;
  final String? email;

  UpdateUserRequest({
    this.name,
    this.email});

  factory UpdateUserRequest.fromJson(Map<String, dynamic> json) {
    return UpdateUserRequest(
      name: json['name'] as String?,
      email: json['email'] as String?,
    );
  }

  String? validate() {
    if (email != null && (email!.isEmpty || !email!.contains('@'))) {
      return 'Invalid email address';
    }
    if (name != null && name!.isEmpty) {
      return 'Name cannot be empty';
    }
    return null;
  }
}`,

    'lib/models/todo.dart': `import 'package:{{projectNameSnake}}/utils/convert.dart';
import 'package:uuid/uuid.dart';

class Todo {
  final String id;
  final String userId;
  final String title;
  final String? description;
  final bool completed;
  final DateTime createdAt;
  final DateTime updatedAt;

  Todo({
    String? id,
    required this.userId,
    required this.title,
    this.description,
    this.completed = false,
    DateTime? createdAt,
    DateTime? updatedAt})  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory Todo.fromMap(Map<String, dynamic> map) {
    return Todo(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      title: map['title'] as String,
      description: map['description'] as String?,
      completed: parseBool(map['completed']),
      createdAt: parseDateTime(map['created_at']),
      updatedAt: parseDateTime(map['updated_at']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'title': title,
      'description': description,
      'completed': completed ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String()};
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'completed': completed,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String()};
  }
}

class CreateTodoRequest {
  final String title;
  final String? description;

  CreateTodoRequest({
    required this.title,
    this.description});

  factory CreateTodoRequest.fromJson(Map<String, dynamic> json) {
    return CreateTodoRequest(
      title: json['title'] as String,
      description: json['description'] as String?,
    );
  }

  String? validate() {
    if (title.isEmpty) {
      return 'Title is required';
    }
    return null;
  }
}

class UpdateTodoRequest {
  final String? title;
  final String? description;
  final bool? completed;

  UpdateTodoRequest({
    this.title,
    this.description,
    this.completed});

  factory UpdateTodoRequest.fromJson(Map<String, dynamic> json) {
    return UpdateTodoRequest(
      title: json['title'] as String?,
      description: json['description'] as String?,
      completed: json['completed'] as bool?,
    );
  }

  String? validate() {
    if (title != null && title!.isEmpty) {
      return 'Title cannot be empty';
    }
    return null;
  }
}`,

    'lib/models/token.dart': `import 'package:{{projectNameSnake}}/utils/convert.dart';
import 'package:uuid/uuid.dart';

class RefreshToken {
  final String id;
  final String userId;
  final String token;
  final DateTime expiresAt;
  final DateTime createdAt;

  RefreshToken({
    String? id,
    required this.userId,
    String? token,
    DateTime? expiresAt,
    DateTime? createdAt})  : id = id ?? const Uuid().v4(),
        token = token ?? const Uuid().v4(),
        expiresAt = expiresAt ?? DateTime.now().add(const Duration(days: 30)),
        createdAt = createdAt ?? DateTime.now();

  factory RefreshToken.fromMap(Map<String, dynamic> map) {
    return RefreshToken(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      token: map['token'] as String,
      expiresAt: parseDateTime(map['expires_at']),
      createdAt: parseDateTime(map['created_at']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'token': token,
      'expires_at': expiresAt.toIso8601String(),
      'created_at': createdAt.toIso8601String()};
  }

  bool get isValid => expiresAt.isAfter(DateTime.now());
}`,

    // Services
    'lib/services/services.dart': `export 'auth_service.dart';
`,

    // Controllers
    'lib/controllers/controllers.dart': `export 'auth_controller.dart';
export 'health_controller.dart';
export 'todo_controller.dart';
export 'user_controller.dart';
`,

    'lib/controllers/auth_controller.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:{{projectNameSnake}}/middleware/auth_middleware.dart';
import 'package:{{projectNameSnake}}/models/token.dart';
import 'package:{{projectNameSnake}}/models/user.dart';
import 'package:{{projectNameSnake}}/repositories/token_repository.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';
import 'package:{{projectNameSnake}}/services/auth_service.dart';

class AuthController {
  final UserRepository users;
  final TokenRepository tokens;
  final AuthService authService;

  AuthController(this.users, this.tokens, this.authService);

  void register(Routable router, RequestHandler guard) {
    router.post('/auth/register', registerUser);
    router.post('/auth/login', login);
    router.post('/auth/refresh', refresh);
    router.post('/auth/logout', logout, middleware: [guard]);
    router.get('/auth/me', me, middleware: [guard]);
  }

  Future<Map<String, dynamic>> registerUser(RequestContext req, ResponseContext res) async {
    final body = await _body(req);

    final CreateUserRequest createRequest;
    try {
      createRequest = CreateUserRequest.fromJson(body);
    } on TypeError {
      throw AngelHttpException.badRequest(message: 'email, password and name are required');
    }

    final error = createRequest.validate();
    if (error != null) {
      throw AngelHttpException.badRequest(message: error);
    }

    if (await users.findByEmail(createRequest.email) != null) {
      throw AngelHttpException.conflict(message: 'User already exists');
    }

    final user = User(
      email: createRequest.email,
      passwordHash: User.hashPassword(createRequest.password),
      name: createRequest.name,
    );
    await users.create(user);

    res.statusCode = 201;
    return _session(user);
  }

  Future<Map<String, dynamic>> login(RequestContext req, ResponseContext res) async {
    final body = await _body(req);
    final email = body['email'];
    final password = body['password'];

    final user = email is String ? await users.findByEmail(email) : null;
    if (user == null || password is! String || !user.verifyPassword(password)) {
      throw AngelHttpException.notAuthenticated(message: 'Invalid credentials');
    }

    return _session(user);
  }

  Future<Map<String, dynamic>> refresh(RequestContext req, ResponseContext res) async {
    final body = await _body(req);
    final value = body['refreshToken'];
    if (value is! String) {
      throw AngelHttpException.badRequest(message: 'Refresh token required');
    }

    final token = await tokens.findByToken(value);
    if (token == null || !token.isValid) {
      throw AngelHttpException.notAuthenticated(message: 'Invalid refresh token');
    }

    final user = await users.findById(token.userId);
    if (user == null) {
      throw AngelHttpException.notAuthenticated(message: 'User not found');
    }

    // Rotate the refresh token
    await tokens.delete(value);
    final next = RefreshToken(userId: user.id);
    await tokens.create(next);

    return {
      'accessToken': authService.generateAccessToken(user),
      'refreshToken': next.token};
  }

  Future<Map<String, dynamic>> logout(RequestContext req, ResponseContext res) async {
    await tokens.deleteByUserId(currentUser(req).id);
    return {'message': 'Logged out'};
  }

  Map<String, dynamic> me(RequestContext req, ResponseContext res) {
    return currentUser(req).toPublic();
  }

  Future<Map<String, dynamic>> _session(User user) async {
    final refreshToken = RefreshToken(userId: user.id);
    await tokens.create(refreshToken);

    return {
      'user': user.toPublic(),
      'accessToken': authService.generateAccessToken(user),
      'refreshToken': refreshToken.token};
  }
}

/// The JSON body of the request as a map ({} when absent).
Future<Map<String, dynamic>> _body(RequestContext req) async {
  await req.parseBody();
  return Map<String, dynamic>.from(req.bodyAsMap);
}
`,

    'lib/controllers/health_controller.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:{{projectNameSnake}}/database/database.dart';

class HealthController {
  void register(Routable router) {
    router.get('/health', checkHealth);
  }

  Future<Map<String, dynamic>> checkHealth(RequestContext req, ResponseContext res) async {
    final dbHealthy = await _checkDatabase();

    return {
      'status': dbHealthy ? 'healthy' : 'unhealthy',
      'timestamp': DateTime.now().toIso8601String(),
      'version': req.app?.configuration['version'] ?? '1.0.0',
      'checks': {
        'database': dbHealthy}};
  }

  Future<bool> _checkDatabase() async {
    try {
      return await Database.instance.testConnection();
    } catch (e) {
      return false;
    }
  }
}
`,

    // Routes
    'lib/routes/routes.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:{{projectNameSnake}}/controllers/controllers.dart';
import 'package:{{projectNameSnake}}/middleware/auth_middleware.dart';
import 'package:{{projectNameSnake}}/repositories/todo_repository.dart';
import 'package:{{projectNameSnake}}/repositories/token_repository.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';
import 'package:{{projectNameSnake}}/services/auth_service.dart';

/// Configure application routes
Future<void> configureServer(Angel app) async {
  final authService = AuthService();
  final users = UserRepository();
  final guard = requireAuth(authService, users);

  AuthController(users, TokenRepository(), authService).register(app, guard);
  UserController(users).register(app, guard);
  TodoController(TodoRepository()).register(app, guard);
  HealthController().register(app);

  // API info route
  app.get('/api', (req, res) {
    return {
      'name': '{{projectName}} API',
      'version': app.configuration['version'] ?? '1.0.0',
      'status': 'running',
      'endpoints': {
        'auth': '/auth',
        'health': '/health',
        'todos': '/api/todos',
        'users': '/api/users',
        'graphql': '/graphql',
        'websockets': '/ws'}};
  });

  // Protected API info
  app.get('/api/me', (req, res) {
    return {
      'message': 'Welcome to the protected API',
      'user': currentUser(req).toPublic()};
  }, middleware: [guard]);
}
`,

    // GraphQL Schema
    'lib/graphql/schema.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:graphql_schema2/graphql_schema2.dart';
import 'package:{{projectNameSnake}}/middleware/auth_middleware.dart';
import 'package:{{projectNameSnake}}/models/todo.dart';
import 'package:{{projectNameSnake}}/repositories/todo_repository.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';
import 'package:{{projectNameSnake}}/services/auth_service.dart';

/// Builds the schema:
///
///     type Query    { hello: String!, health: String!, me: User, todos: [Todo!]! }
///     type Mutation { createTodo(title: String!, description: String): Todo }
///
/// \`me\`, \`todos\` and \`createTodo\` need an \`Authorization: Bearer <token>\` header.
GraphQLSchema createGraphQLSchema() {
  final authService = AuthService();
  final users = UserRepository();
  final todos = TodoRepository();

  Future<Map<String, dynamic>?> currentUserOf(Map<String, dynamic> args) async {
    final req = args['__requestctx'] as RequestContext;
    final user = await userFromHeader(req.headers?.value('authorization'), authService, users);
    return user?.toPublic();
  }

  final todoType = objectType(
    'Todo',
    fields: [
      field('id', graphQLString.nonNullable()),
      field('title', graphQLString.nonNullable()),
      field('description', graphQLString),
      field('completed', graphQLBoolean.nonNullable()),
      field('createdAt', graphQLString.nonNullable()),
      field('updatedAt', graphQLString.nonNullable())],
  );

  final userType = objectType(
    'User',
    fields: [
      field('id', graphQLString.nonNullable()),
      field('email', graphQLString.nonNullable()),
      field('name', graphQLString.nonNullable()),
      field('createdAt', graphQLString.nonNullable())],
  );

  final queryType = objectType(
    'Query',
    fields: [
      field('hello', graphQLString.nonNullable(), resolve: (_, args) => 'Hello from Angel3 GraphQL!'),
      field('health', graphQLString.nonNullable(), resolve: (_, args) => 'healthy'),
      field(
        'me',
        userType,
        resolve: (_, args) => currentUserOf(args),
      ),
      field(
        'todos',
        listOf(todoType.nonNullable()).nonNullable(),
        resolve: (_, args) async {
          final user = await currentUserOf(args);
          if (user == null) throw GraphQLException.fromMessage('Authentication required');

          final mine = await todos.findByUserId(user['id'] as String);
          return mine.map((t) => t.toJson()).toList();
        },
      )],
  );

  final mutationType = objectType(
    'Mutation',
    fields: [
      field(
        'createTodo',
        todoType,
        inputs: [
          GraphQLFieldInput('title', graphQLString.nonNullable()),
          GraphQLFieldInput('description', graphQLString)],
        resolve: (_, args) async {
          final user = await currentUserOf(args);
          if (user == null) throw GraphQLException.fromMessage('Authentication required');

          final todo = Todo(
            userId: user['id'] as String,
            title: args['title'] as String,
            description: args['description'] as String?,
          );
          await todos.create(todo);
          return todo.toJson();
        },
      )],
  );

  return graphQLSchema(queryType: queryType, mutationType: mutationType);
}
`,

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
    'test/auth_test.dart': `import 'dart:convert';
import 'dart:io';

import 'package:angel3_container/angel3_container.dart';
import 'package:angel3_framework/angel3_framework.dart';
import 'package:angel3_framework/http.dart';
import 'package:http/http.dart' as http;
import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';
import 'package:test/test.dart';

void main() {
  late Angel app;
  late AngelHttp server;
  late String base;

  setUp(() async {
    Config.overrides['DB_TYPE'] = 'sqlite';
    Config.overrides['DB_PATH'] = ':memory:';

    app = Angel(reflector: const EmptyReflector());
    await app.configure(configureServer);
    server = AngelHttp(app);
    await server.startServer(InternetAddress.loopbackIPv4.address, 0);
    base = 'http://\${server.server!.address.address}:\${server.server!.port}';
  });

  tearDown(() async {
    await server.close();
    await app.close();
  });

  Future<http.Response> post(String path, Map<String, dynamic> body, {Map<String, String>? headers}) {
    return http.post(
      Uri.parse('$base$path'),
      headers: {'content-type': 'application/json', ...?headers},
      body: jsonEncode(body),
    );
  }

  group('Authentication', () {
    test('can register new user', () async {
      final response = await post('/auth/register', {
        'email': 'test@example.com',
        'password': 'password123',
        'name': 'Test User'});

      expect(response.statusCode, equals(201));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      expect(body['user']['email'], equals('test@example.com'));
      expect(body['accessToken'], isNotEmpty);
      expect(body['refreshToken'], isNotEmpty);
    });

    test('can login with valid credentials', () async {
      await post('/auth/register', {
        'email': 'login@example.com',
        'password': 'password123',
        'name': 'Login User'});

      final response = await post('/auth/login', {
        'email': 'login@example.com',
        'password': 'password123'});

      expect(response.statusCode, equals(200));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      expect(body['user']['email'], equals('login@example.com'));
      expect(body['accessToken'], isNotEmpty);
    });

    test('cannot login with invalid credentials', () async {
      final response = await post('/auth/login', {
        'email': 'wrong@example.com',
        'password': 'wrongpassword'});

      expect(response.statusCode, equals(401));
    });

    test('protected routes need a token', () async {
      final anonymous = await http.get(Uri.parse('$base/auth/me'), headers: {'accept': 'application/json'});
      expect(anonymous.statusCode, equals(401));

      final registered = await post('/auth/register', {
        'email': 'me@example.com',
        'password': 'password123',
        'name': 'Me'});
      final token = (jsonDecode(registered.body) as Map<String, dynamic>)['accessToken'];

      final me = await http.get(Uri.parse('$base/auth/me'), headers: {'authorization': 'Bearer $token'});
      expect(me.statusCode, equals(200));
      expect((jsonDecode(me.body) as Map<String, dynamic>)['email'], equals('me@example.com'));
    });
  });

  test('health check', () async {
    final response = await http.get(Uri.parse('$base/health'));
    expect(response.statusCode, equals(200));
    expect((jsonDecode(response.body) as Map<String, dynamic>)['status'], equals('healthy'));
  });
}
`,

    // Configuration files
    '.env.example': `# Environment
ANGEL_ENV=development

# Server
HOST=0.0.0.0
PORT=3000

# Database
DB_TYPE=sqlite
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectNameSnake}}
DB_USER=postgres
DB_PASSWORD=
DB_PATH=database.db
DB_PATH=database.db
DB_PATH=database.db
DB_PATH=database.db
DB_PATH=database.db
DB_PATH=database.db
DB_PATH=database.db

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
      - DB_NAME={{projectNameSnake}}
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
      - POSTGRES_DB={{projectNameSnake}}
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

- ✅ Angel3 web framework (plain route functions, no reflection)
- ✅ SQL storage with PostgreSQL, MySQL and SQLite behind one repository layer
- ✅ Real-time WebSocket support
- ✅ GraphQL API with GraphiQL interface
- ✅ JWT authentication with refresh tokens
- ✅ Tables created automatically outside production
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
3. Copy \`.env.example\` to \`.env\` and configure (SQLite is the default database)
4. Run the server:
   \`\`\`bash
   dart run bin/server.dart
   \`\`\`

## Development

Run with hot reload:
\`\`\`bash
dart run bin/dev.dart
\`\`\`

## API Endpoints

### REST API
- \`GET /\` - Welcome page (public/index.html)
- \`GET /api\` - API information
- \`GET /api/me\` - Current user (protected)
- \`GET/POST /api/todos\`, \`GET/PUT/DELETE /api/todos/:id\` - Todos of the current user (protected)
- \`GET /api/users\`, \`GET /api/users/:id\`, \`PUT/DELETE /api/users/:id\` - Users (protected; you can only change yourself)
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

    'lib/controllers/todo_controller.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:{{projectNameSnake}}/middleware/auth_middleware.dart';
import 'package:{{projectNameSnake}}/models/todo.dart';
import 'package:{{projectNameSnake}}/repositories/todo_repository.dart';

class TodoController {
  final TodoRepository todos;

  TodoController(this.todos);

  void register(Routable router, RequestHandler guard) {
    router.get('/api/todos', list, middleware: [guard]);
    router.post('/api/todos', create, middleware: [guard]);
    router.get('/api/todos/:id', get, middleware: [guard]);
    router.put('/api/todos/:id', update, middleware: [guard]);
    router.delete('/api/todos/:id', delete, middleware: [guard]);
  }

  Future<List<Map<String, dynamic>>> list(RequestContext req, ResponseContext res) async {
    final mine = await todos.findByUserId(currentUser(req).id);
    return mine.map((t) => t.toJson()).toList();
  }

  Future<Map<String, dynamic>> create(RequestContext req, ResponseContext res) async {
    await req.parseBody();
    final createRequest = CreateTodoRequest.fromJson(Map<String, dynamic>.from(req.bodyAsMap));
    final error = createRequest.validate();
    if (error != null) {
      throw AngelHttpException.badRequest(message: error);
    }

    final todo = Todo(
      userId: currentUser(req).id,
      title: createRequest.title,
      description: createRequest.description,
    );
    await todos.create(todo);

    res.statusCode = 201;
    return todo.toJson();
  }

  Future<Map<String, dynamic>> get(RequestContext req, ResponseContext res) async {
    return (await _find(req)).toJson();
  }

  Future<Map<String, dynamic>> update(RequestContext req, ResponseContext res) async {
    final todo = await _find(req);

    await req.parseBody();
    final updateRequest = UpdateTodoRequest.fromJson(Map<String, dynamic>.from(req.bodyAsMap));
    final error = updateRequest.validate();
    if (error != null) {
      throw AngelHttpException.badRequest(message: error);
    }

    final updated = Todo(
      id: todo.id,
      userId: todo.userId,
      title: updateRequest.title ?? todo.title,
      description: updateRequest.description ?? todo.description,
      completed: updateRequest.completed ?? todo.completed,
      createdAt: todo.createdAt,
      updatedAt: DateTime.now(),
    );
    await todos.update(updated);

    return updated.toJson();
  }

  Future<void> delete(RequestContext req, ResponseContext res) async {
    final todo = await _find(req);
    await todos.delete(todo.id);
    res.statusCode = 204;
    await res.close();
  }

  Future<Todo> _find(RequestContext req) async {
    final todo = await todos.findByIdAndUserId(req.params['id'] as String, currentUser(req).id);
    if (todo == null) {
      throw AngelHttpException.notFound(message: 'Todo not found');
    }
    return todo;
  }
}
`,

    'lib/controllers/user_controller.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:{{projectNameSnake}}/middleware/auth_middleware.dart';
import 'package:{{projectNameSnake}}/models/user.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';

class UserController {
  final UserRepository users;

  UserController(this.users);

  void register(Routable router, RequestHandler guard) {
    router.get('/api/users', list, middleware: [guard]);
    router.get('/api/users/:id', get, middleware: [guard]);
    router.put('/api/users/:id', update, middleware: [guard]);
    router.delete('/api/users/:id', delete, middleware: [guard]);
  }

  Future<List<Map<String, dynamic>>> list(RequestContext req, ResponseContext res) async {
    final all = await users.findAll();
    return all.map((u) => u.toPublic()).toList();
  }

  Future<Map<String, dynamic>> get(RequestContext req, ResponseContext res) async {
    final user = await users.findById(req.params['id'] as String);
    if (user == null) {
      throw AngelHttpException.notFound(message: 'User not found');
    }
    return user.toPublic();
  }

  Future<Map<String, dynamic>> update(RequestContext req, ResponseContext res) async {
    final me = currentUser(req);
    final id = req.params['id'] as String;
    if (id != me.id) {
      throw AngelHttpException.forbidden(message: 'Forbidden');
    }

    await req.parseBody();
    final updateRequest = UpdateUserRequest.fromJson(Map<String, dynamic>.from(req.bodyAsMap));
    final error = updateRequest.validate();
    if (error != null) {
      throw AngelHttpException.badRequest(message: error);
    }

    final email = updateRequest.email;
    if (email != null && email != me.email && await users.findByEmail(email) != null) {
      throw AngelHttpException.conflict(message: 'Email already taken');
    }

    final updated = User(
      id: me.id,
      email: email ?? me.email,
      passwordHash: me.passwordHash,
      name: updateRequest.name ?? me.name,
      createdAt: me.createdAt,
      updatedAt: DateTime.now(),
    );
    await users.update(updated);

    return updated.toPublic();
  }

  Future<void> delete(RequestContext req, ResponseContext res) async {
    final id = req.params['id'] as String;
    if (id != currentUser(req).id) {
      throw AngelHttpException.forbidden(message: 'Forbidden');
    }

    await users.delete(id);
    res.statusCode = 204;
    await res.close();
  }
}
`,

    'lib/database/database.dart': `import 'package:postgres/postgres.dart';
import 'package:mysql_client/mysql_client.dart';
import 'package:sqlite3/sqlite3.dart' as sqlite;
import 'package:{{projectNameSnake}}/config/config.dart';

abstract class Database {
  static Database? _instance;
  static Database get instance => _instance!;
  
  static Future<void> initialize() async {
    switch (Config.dbType) {
      case 'postgres':
        _instance = PostgresDatabase();
        break;
      case 'mysql':
        _instance = MySQLDatabase();
        break;
      default:
        _instance = SQLiteDatabase();
    }
    
    await _instance!.connect();
  }
  
  static Future<void> close() async {
    await _instance?.disconnect();
  }
  
  static Future<void> runMigrations() async {
    await _instance?.migrate();
  }
  
  Future<void> connect();
  Future<void> disconnect();
  Future<void> migrate();
  Future<bool> testConnection();
  Future<List<Map<String, dynamic>>> query(String sql, [List<Object?>? params]);
  Future<int> execute(String sql, [List<Object?>? params]);
}

class PostgresDatabase extends Database {
  Connection? _connection;

  static final _isoDateTime = RegExp(r'^\\d{4}-\\d{2}-\\d{2}T');

  /// The repositories write \`?\` placeholders; PostgreSQL wants \`$1\`, \`$2\`, ...
  static String _positional(String sql) {
    var index = 0;
    return sql.replaceAllMapped('?', (_) => '\\$\${++index}');
  }

  /// Timestamps are passed as ISO-8601 strings; PostgreSQL wants DateTime values.
  static List<Object?> _bind(List<Object?>? params) {
    return (params ?? const <Object?>[])
        .map((p) => p is String && _isoDateTime.hasMatch(p) ? DateTime.parse(p) : p)
        .toList();
  }

  /// Hands rows to the models the way SQLite does (timestamps as strings).
  static Map<String, dynamic> _normalize(Map<String, dynamic> row) {
    return row.map((key, value) => MapEntry(key, value is DateTime ? value.toIso8601String() : value));
  }
  
  @override
  Future<void> connect() async {
    _connection = await Connection.open(
      Endpoint(
        host: Config.dbHost,
        port: Config.dbPort,
        database: Config.dbName,
        username: Config.dbUser,
        password: Config.dbPassword,
      ),
      settings: ConnectionSettings(
        sslMode: Config.dbSsl ? SslMode.require : SslMode.disable,
      ),
    );
  }
  
  @override
  Future<void> disconnect() async {
    await _connection?.close();
  }
  
  @override
  Future<bool> testConnection() async {
    final result = await _connection!.execute('SELECT 1');
    return result.isNotEmpty;
  }
  
  @override
  Future<List<Map<String, dynamic>>> query(String sql, [List<Object?>? params]) async {
    final result = await _connection!.execute(
      _positional(sql),
      parameters: _bind(params),
    );
    
    return result.map((row) => _normalize(row.toColumnMap())).toList();
  }
  
  @override
  Future<int> execute(String sql, [List<Object?>? params]) async {
    final result = await _connection!.execute(
      _positional(sql),
      parameters: _bind(params),
    );
    return result.affectedRows;
  }
  
  @override
  Future<void> migrate() async {
    // Create users table
    await execute('''
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ''');
    
    // Create todos table
    await execute('''
      CREATE TABLE IF NOT EXISTS todos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ''');
    
    // Create refresh_tokens table
    await execute('''
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ''');
  }
}

class MySQLDatabase extends Database {
  MySQLConnection? _connection;
  
  @override
  Future<void> connect() async {
    _connection = await MySQLConnection.createConnection(
      host: Config.dbHost,
      port: Config.dbPort,
      userName: Config.dbUser,
      password: Config.dbPassword,
      databaseName: Config.dbName,
    );
    
    await _connection!.connect();
  }
  
  @override
  Future<void> disconnect() async {
    await _connection?.close();
  }
  
  @override
  Future<bool> testConnection() async {
    final result = await _connection!.execute('SELECT 1');
    return result.rows.isNotEmpty;
  }
  
  @override
  Future<List<Map<String, dynamic>>> query(String sql, [List<Object?>? params]) async {
    final stmt = await _connection!.prepare(sql);
    final result = await stmt.execute(params ?? []);
    await stmt.deallocate();
    
    return result.rows.map((row) => row.assoc()).toList();
  }
  
  @override
  Future<int> execute(String sql, [List<Object?>? params]) async {
    final stmt = await _connection!.prepare(sql);
    final result = await stmt.execute(params ?? []);
    await stmt.deallocate();
    
    return result.affectedRows.toInt();
  }
  
  @override
  Future<void> migrate() async {
    // Similar migrations adapted for MySQL syntax
    await execute('''
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    ''');
    
    await execute('''
      CREATE TABLE IF NOT EXISTS todos (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    ''');
    
    await execute('''
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    ''');
  }
}

class SQLiteDatabase extends Database {
  sqlite.Database? _db;
  
  @override
  Future<void> connect() async {
    _db = sqlite.sqlite3.open(Config.dbPath);
  }
  
  @override
  Future<void> disconnect() async {
    _db?.dispose();
  }
  
  @override
  Future<bool> testConnection() async {
    final result = _db!.select('SELECT 1');
    return result.isNotEmpty;
  }
  
  @override
  Future<List<Map<String, dynamic>>> query(String sql, [List<Object?>? params]) async {
    final stmt = _db!.prepare(sql);
    final result = stmt.select(params ?? []);
    stmt.dispose();
    
    return result.map((row) => Map<String, dynamic>.from(row)).toList();
  }
  
  @override
  Future<int> execute(String sql, [List<Object?>? params]) async {
    final stmt = _db!.prepare(sql);
    stmt.execute(params ?? []);
    final affectedRows = _db!.updatedRows;
    stmt.dispose();
    
    return affectedRows;
  }
  
  @override
  Future<void> migrate() async {
    // Enable foreign keys
    _db!.execute('PRAGMA foreign_keys = ON');
    
    // Create users table
    await execute('''
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');
    
    // Create todos table
    await execute('''
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');
    
    // Create refresh_tokens table
    await execute('''
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');
  }
}`,

    'lib/middleware/auth_middleware.dart': `import 'package:angel3_framework/angel3_framework.dart';
import 'package:{{projectNameSnake}}/models/user.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';
import 'package:{{projectNameSnake}}/services/auth_service.dart';

/// Resolves the user behind an \`Authorization: Bearer <token>\` header, or null.
Future<User?> userFromHeader(String? header, AuthService authService, UserRepository users) async {
  if (header == null || !header.startsWith('Bearer ')) return null;

  final userId = authService.getUserIdFromToken(header.substring(7));
  if (userId == null) return null;

  return users.findById(userId);
}

/// Route middleware: rejects requests without a valid access token and stores
/// the user in the request's container for the handler.
RequestHandler requireAuth(AuthService authService, UserRepository users) {
  return (RequestContext req, ResponseContext res) async {
    final user = await userFromHeader(req.headers?.value('authorization'), authService, users);
    if (user == null) {
      throw AngelHttpException.notAuthenticated(message: 'Authentication required');
    }

    req.container!.registerSingleton<User>(user);
    return true;
  };
}

/// The user stored by [requireAuth].
User currentUser(RequestContext req) => req.container!.make<User>();
`,

    'lib/repositories/todo_repository.dart': `import 'package:{{projectNameSnake}}/database/database.dart';
import 'package:{{projectNameSnake}}/models/todo.dart';

class TodoRepository {
  final Database _db = Database.instance;

  Future<List<Todo>> findByUserId(String userId) async {
    final results = await _db.query(
      'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );

    return results.map((row) => Todo.fromMap(row)).toList();
  }

  Future<Todo?> findById(String id) async {
    final results = await _db.query(
      'SELECT * FROM todos WHERE id = ?',
      [id],
    );

    if (results.isEmpty) return null;
    return Todo.fromMap(results.first);
  }

  Future<Todo?> findByIdAndUserId(String id, String userId) async {
    final results = await _db.query(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?',
      [id, userId],
    );

    if (results.isEmpty) return null;
    return Todo.fromMap(results.first);
  }

  Future<Todo> create(Todo todo) async {
    await _db.execute(
      '''
      INSERT INTO todos (id, user_id, title, description, completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ''',
      [
        todo.id,
        todo.userId,
        todo.title,
        todo.description,
        todo.completed ? 1 : 0,
        todo.createdAt.toIso8601String(),
        todo.updatedAt.toIso8601String()],
    );

    return todo;
  }

  Future<Todo> update(Todo todo) async {
    await _db.execute(
      '''
      UPDATE todos
      SET title = ?, description = ?, completed = ?, updated_at = ?
      WHERE id = ?
      ''',
      [
        todo.title,
        todo.description,
        todo.completed ? 1 : 0,
        DateTime.now().toIso8601String(),
        todo.id],
    );

    return todo;
  }

  Future<void> delete(String id) async {
    await _db.execute('DELETE FROM todos WHERE id = ?', [id]);
  }
}`,

    'lib/repositories/token_repository.dart': `import 'package:{{projectNameSnake}}/database/database.dart';
import 'package:{{projectNameSnake}}/models/token.dart';

class TokenRepository {
  final Database _db = Database.instance;

  Future<RefreshToken?> findByToken(String token) async {
    final results = await _db.query(
      'SELECT * FROM refresh_tokens WHERE token = ?',
      [token],
    );

    if (results.isEmpty) return null;
    return RefreshToken.fromMap(results.first);
  }

  Future<RefreshToken> create(RefreshToken token) async {
    await _db.execute(
      '''
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      ''',
      [
        token.id,
        token.userId,
        token.token,
        token.expiresAt.toIso8601String(),
        token.createdAt.toIso8601String()],
    );

    return token;
  }

  Future<void> delete(String token) async {
    await _db.execute('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  }

  Future<void> deleteByUserId(String userId) async {
    await _db.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  Future<void> deleteExpired() async {
    await _db.execute(
      'DELETE FROM refresh_tokens WHERE expires_at < ?',
      [DateTime.now().toIso8601String()],
    );
  }
}`,

    'lib/repositories/user_repository.dart': `import 'package:{{projectNameSnake}}/database/database.dart';
import 'package:{{projectNameSnake}}/models/user.dart';

class UserRepository {
  final Database _db = Database.instance;

  Future<User?> findByEmail(String email) async {
    final results = await _db.query(
      'SELECT * FROM users WHERE email = ?',
      [email],
    );

    if (results.isEmpty) return null;
    return User.fromMap(results.first);
  }

  Future<User?> findById(String id) async {
    final results = await _db.query(
      'SELECT * FROM users WHERE id = ?',
      [id],
    );

    if (results.isEmpty) return null;
    return User.fromMap(results.first);
  }

  Future<List<User>> findAll() async {
    final results = await _db.query('SELECT * FROM users ORDER BY created_at DESC');
    return results.map((row) => User.fromMap(row)).toList();
  }

  Future<User> create(User user) async {
    await _db.execute(
      '''
      INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ''',
      [
        user.id,
        user.email,
        user.passwordHash,
        user.name,
        user.createdAt.toIso8601String(),
        user.updatedAt.toIso8601String()],
    );

    return user;
  }

  Future<User> update(User user) async {
    await _db.execute(
      '''
      UPDATE users
      SET email = ?, name = ?, updated_at = ?
      WHERE id = ?
      ''',
      [
        user.email,
        user.name,
        DateTime.now().toIso8601String(),
        user.id],
    );

    return user;
  }

  Future<void> delete(String id) async {
    await _db.execute('DELETE FROM users WHERE id = ?', [id]);
  }
}`,

    'lib/services/auth_service.dart': `import 'package:jaguar_jwt/jaguar_jwt.dart';
import 'package:{{projectNameSnake}}/config/config.dart';
import 'package:{{projectNameSnake}}/models/user.dart';

class AuthService {
  static const _issuer = '{{projectName}}';

  String generateAccessToken(User user) {
    final claimSet = JwtClaim(
      issuer: _issuer,
      subject: user.id,
      otherClaims: {
        'email': user.email,
        'name': user.name},
      maxAge: Duration(minutes: Config.jwtExpiryMinutes),
    );

    return issueJwtHS256(claimSet, Config.jwtSecret);
  }

  Map<String, dynamic>? verifyToken(String token) {
    try {
      final claimSet = verifyJwtHS256Signature(token, Config.jwtSecret);

      // Validate claims
      claimSet.validate(issuer: _issuer);

      return claimSet.toJson();
    } catch (e) {
      return null;
    }
  }

  String? getUserIdFromToken(String token) {
    final claims = verifyToken(token);
    return claims?['sub'] as String?;
  }
}
`,

    'lib/utils/convert.dart': `/// Database drivers disagree on column types (SQLite returns text and integers,
/// PostgreSQL returns DateTime and bool); these helpers accept either.
DateTime parseDateTime(Object? value) {
  if (value is DateTime) return value;
  return DateTime.parse(value as String);
}

bool parseBool(Object? value) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  return value == '1' || value == 'true';
}
`}};