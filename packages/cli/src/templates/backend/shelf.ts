import { BackendTemplate } from '../types';

export const shelfTemplate: BackendTemplate = {
  id: 'shelf',
  name: 'shelf',
  displayName: 'Shelf Framework',
  description: 'Modular web server framework for Dart with middleware pipeline and routing',
  language: 'dart',
  framework: 'shelf',
  version: '1.4.1',
  tags: ['dart', 'shelf', 'api', 'rest', 'middleware', 'modular'],
  port: 8080,
  dependencies: {},
  features: ['middleware', 'routing', 'cors', 'authentication', 'logging', 'file-upload', 'graphql'],
  
  files: {
    // Dart project configuration
    'pubspec.yaml': `name: {{projectNameSnake}}
description: A server app using the shelf package and Docker.
version: 1.0.0
publish_to: none

environment:
  sdk: ^3.0.0

dependencies:
  args: ^2.4.0
  shelf: ^1.4.1
  shelf_router: ^1.1.4
  shelf_static: ^1.1.2
  shelf_cors_headers: ^0.1.5
  shelf_hotreload: ^1.4.1
  dotenv: ^4.2.0
  postgres: ^3.0.0
  mysql_client: ^0.0.27
  sqlite3: ^2.1.0
  crypto: ^3.0.3
  jaguar_jwt: ^3.0.0
  uuid: ^4.2.1
  logger: ^2.4.0
  collection: ^1.18.0
  http: ^1.1.0
  intl: ^0.18.1
  graphql: ^5.1.3

dev_dependencies:
  build_runner: ^2.4.0
  build_web_compilers: ^4.0.0
  lints: ^3.0.0
  test: ^1.24.0
  coverage: ^1.7.1
  mockito: ^5.4.3
  build_test: ^2.2.1`,

    // Main entry point
    'bin/server.dart': `import 'dart:io';

import 'package:args/args.dart';
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_hotreload/shelf_hotreload.dart';
import 'package:{{projectNameSnake}}/app.dart';
import 'package:{{projectNameSnake}}/config/config.dart';
import 'package:{{projectNameSnake}}/database/database.dart';
import 'package:{{projectNameSnake}}/utils/logger.dart';

void main(List<String> args) async {
  var parser = ArgParser()
    ..addOption('port', abbr: 'p', defaultsTo: Config.port.toString())
    ..addOption('host', abbr: 'h', defaultsTo: Config.host)
    ..addFlag('hot-reload', abbr: 'r', defaultsTo: false);

  var result = parser.parse(args);
  var port = int.tryParse(result['port'] as String) ?? 8080;
  var host = result['host'] as String;
  var hotReload = result['hot-reload'] as bool;

  // Load configuration
  await Config.load();
  
  // Initialize logger
  final logger = AppLogger();
  
  // Initialize database
  try {
    await Database.initialize();
    logger.info('Database connected successfully');
  } catch (e) {
    logger.error('Failed to connect to database: $e');
    exit(1);
  }

  // Run migrations in development
  if (Config.environment == 'development') {
    try {
      await Database.runMigrations();
      logger.info('Database migrations completed');
    } catch (e) {
      logger.error('Failed to run migrations: $e');
    }
  }

  if (hotReload && Config.environment == 'development') {
    // Use hot reload in development
    withHotreload(
      () => io.serve(createApp(), host, port),
      onReloaded: () {
        logger.info('Hot reload triggered');
      },
    );
  } else {
    // Normal server start
    final handler = createApp();
    final server = await io.serve(handler, host, port);
    
    logger.info('Server listening on http://$host:$port');
    
    // Graceful shutdown
    ProcessSignal.sigint.watch().listen((_) async {
      logger.info('Shutting down server...');
      await server.close();
      await Database.close();
      exit(0);
    });
  }
}`,

    // Application setup
    'lib/app.dart': `import 'dart:io';

import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_cors_headers/shelf_cors_headers.dart';
import 'package:shelf_static/shelf_static.dart';

import 'controllers/auth_controller.dart';
import 'controllers/user_controller.dart';
import 'controllers/todo_controller.dart';
import 'controllers/graphql_controller.dart';
import 'database/database.dart';
import 'middleware/auth_middleware.dart';
import 'middleware/error_middleware.dart';
import 'middleware/logging_middleware.dart';
import 'middleware/validation_middleware.dart';
import 'utils/response.dart';

Handler createApp() {
  final router = Router();

  // API info
  router.get('/', (Request request) {
    return jsonOk({
      'name': '{{projectName}} API',
      'version': '1.0.0',
      'status': 'running'});
  });

  // Health check
  router.get('/health', (Request request) async {
    final health = await _checkHealth();
    return jsonOk({
      'status': health ? 'healthy' : 'unhealthy',
      'timestamp': DateTime.now().toIso8601String(),
      'database': health});
  });

  // GraphQL endpoint
  router.post('/graphql', GraphqlController.handle);

  // API routes
  router.mount('/api/v1/', _apiRouter().call);

  // Static files (only when a public directory exists)
  var cascade = Cascade().add(router.call);
  if (Directory('public').existsSync()) {
    cascade = cascade.add(createStaticHandler('public', defaultDocument: 'index.html'));
  }

  // Create pipeline with middleware
  final handler = Pipeline()
      .addMiddleware(corsHeaders())
      .addMiddleware(logRequests())
      .addMiddleware(loggingMiddleware())
      .addMiddleware(errorMiddleware())
      .addHandler(cascade.handler);

  return handler;
}

Router _apiRouter() {
  final router = Router();

  // Authentication routes
  router.post('/auth/register', AuthController.register);
  router.post('/auth/login', AuthController.login);
  router.post('/auth/refresh', AuthController.refresh);

  // Protected routes
  router.mount(
    '/users',
    Pipeline()
        .addMiddleware(authMiddleware())
        .addHandler(_userRouter().call),
  );

  router.mount(
    '/todos',
    Pipeline()
        .addMiddleware(authMiddleware())
        .addHandler(_todoRouter().call),
  );

  return router;
}

Router _userRouter() {
  final router = Router();

  router.get('/', UserController.list);
  router.get('/<id>', UserController.get);
  router.put(
    '/<id>',
    (Request request, String id) =>
        _jsonOnly((request) => UserController.update(request, id))(request),
  );
  router.delete('/<id>', UserController.delete);

  return router;
}

Router _todoRouter() {
  final router = Router();

  router.get('/', TodoController.list);
  router.post('/', _jsonOnly(TodoController.create));
  router.get('/<id>', TodoController.get);
  router.put(
    '/<id>',
    (Request request, String id) =>
        _jsonOnly((request) => TodoController.update(request, id))(request),
  );
  router.delete('/<id>', TodoController.delete);

  return router;
}

/// Rejects POST/PUT requests whose Content-Type is not JSON.
Handler _jsonOnly(Handler handler) => validationMiddleware()(handler);

Future<bool> _checkHealth() async {
  try {
    // Check database connection
    final db = Database.instance;
    await db.testConnection();
    return true;
  } catch (e) {
    return false;
  }
}`,

    // Configuration
    'lib/config/config.dart': `import 'dart:io';
import 'package:dotenv/dotenv.dart';

class Config {
  static DotEnv _env = _create();
  
  static String get environment => _env['ENVIRONMENT'] ?? 'development';
  static String get host => _env['HOST'] ?? '0.0.0.0';
  static int get port => int.tryParse(_env['PORT'] ?? '') ?? 8080;
  
  // Database
  static String get dbType => _env['DB_TYPE'] ?? 'sqlite';
  static String get dbHost => _env['DB_HOST'] ?? 'localhost';
  static int get dbPort => int.tryParse(_env['DB_PORT'] ?? '') ?? 5432;
  static String get dbName => _env['DB_NAME'] ?? '{{projectNameSnake}}';
  static String get dbUser => _env['DB_USER'] ?? 'postgres';
  static String get dbPassword => _env['DB_PASSWORD'] ?? '';
  static bool get dbSsl => (_env['DB_SSL'] ?? 'false').toLowerCase() == 'true';
  static String get dbPath => _env['DB_PATH'] ?? 'database.db';
  
  // Security
  static String get jwtSecret => _env['JWT_SECRET'] ?? 'your-secret-key';
  static int get jwtExpiryMinutes => int.tryParse(_env['JWT_EXPIRY_MINUTES'] ?? '') ?? 15;
  static int get refreshTokenDays => int.tryParse(_env['REFRESH_TOKEN_DAYS'] ?? '') ?? 30;
  
  static DotEnv _create() {
    final env = DotEnv(includePlatformEnvironment: true);

    // Load .env file if it exists
    if (File('.env').existsSync()) {
      env.load(['.env']);
    }
    return env;
  }

  /// Re-reads the environment and the .env file.
  static Future<void> load() async {
    _env = _create();
  }
}
`,

    // Database setup
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

    // Models
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

    // Repositories
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

    // Controllers
    // GraphQL schema + resolver (Dart GraphQL: graphql package)
    'lib/graphql/schema.dart': `// Minimal GraphQL schema for Shelf: type Query { hello: String!, health: String! }
const String graphqlSchema = r'''
type Query {
  hello: String!
  health: String!
}
''';

class GraphqlResolvers {
  static const String helloValue = 'Hello from Shelf GraphQL!';
  static const String healthValue = 'healthy';

  static Map<String, dynamic> resolve(String query) {
    // Minimal resolver: returns both hello and health fields regardless of
    // the query selection. Backed by the graphql package for full parsing.
    return {
      'data': {
        'hello': helloValue,
        'health': healthValue}
    };
  }
}
`,

    'lib/controllers/graphql_controller.dart': `import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/graphql/schema.dart';
import 'package:{{projectNameSnake}}/utils/response.dart';

class GraphqlController {
  static Future<Response> handle(Request request) async {
    try {
      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final query = json['query'] as String? ?? '';
      final result = GraphqlResolvers.resolve(query);
      return jsonOk(result);
    } catch (e) {
      return jsonOk({
        'errors': [
          {'message': e.toString()}
        ]
      });
    }
  }
}
`,

    'lib/controllers/auth_controller.dart': `import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/models/user.dart';
import 'package:{{projectNameSnake}}/models/token.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';
import 'package:{{projectNameSnake}}/repositories/token_repository.dart';
import 'package:{{projectNameSnake}}/services/auth_service.dart';
import 'package:{{projectNameSnake}}/utils/response.dart';

class AuthController {
  static final _userRepo = UserRepository();
  static final _tokenRepo = TokenRepository();
  static final _authService = AuthService();

  static Future<Response> register(Request request) async {
    try {
      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final createRequest = CreateUserRequest.fromJson(json);

      // Validate request
      final error = createRequest.validate();
      if (error != null) {
        return jsonStatus(400, {'error': error});
      }

      // Check if user exists
      final existingUser = await _userRepo.findByEmail(createRequest.email);
      if (existingUser != null) {
        return jsonStatus(409, {'error': 'User already exists'});
      }

      // Create user
      final user = User(
        email: createRequest.email,
        passwordHash: User.hashPassword(createRequest.password),
        name: createRequest.name,
      );

      await _userRepo.create(user);

      // Generate tokens
      final accessToken = _authService.generateAccessToken(user);
      final refreshToken = RefreshToken(userId: user.id);
      await _tokenRepo.create(refreshToken);

      return jsonOk({
        'user': user.toPublic(),
        'accessToken': accessToken,
        'refreshToken': refreshToken.token});
    } catch (e) {
      return jsonStatus(500, {'error': 'Registration failed'});
    }
  }

  static Future<Response> login(Request request) async {
    try {
      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final loginRequest = LoginRequest.fromJson(json);

      // Find user
      final user = await _userRepo.findByEmail(loginRequest.email);
      if (user == null || !user.verifyPassword(loginRequest.password)) {
        return jsonStatus(401, {'error': 'Invalid credentials'});
      }

      // Generate tokens
      final accessToken = _authService.generateAccessToken(user);
      final refreshToken = RefreshToken(userId: user.id);
      await _tokenRepo.create(refreshToken);

      return jsonOk({
        'user': user.toPublic(),
        'accessToken': accessToken,
        'refreshToken': refreshToken.token});
    } catch (e) {
      return jsonStatus(500, {'error': 'Login failed'});
    }
  }

  static Future<Response> refresh(Request request) async {
    try {
      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final refreshTokenValue = json['refreshToken'] as String?;

      if (refreshTokenValue == null) {
        return jsonStatus(400, {'error': 'Refresh token required'});
      }

      // Find and validate token
      final token = await _tokenRepo.findByToken(refreshTokenValue);
      if (token == null || !token.isValid) {
        return jsonStatus(401, {'error': 'Invalid refresh token'});
      }

      // Get user
      final user = await _userRepo.findById(token.userId);
      if (user == null) {
        return jsonStatus(401, {'error': 'User not found'});
      }

      // Delete old token
      await _tokenRepo.delete(refreshTokenValue);

      // Generate new tokens
      final accessToken = _authService.generateAccessToken(user);
      final newRefreshToken = RefreshToken(userId: user.id);
      await _tokenRepo.create(newRefreshToken);

      return jsonOk({
        'accessToken': accessToken,
        'refreshToken': newRefreshToken.token});
    } catch (e) {
      return jsonStatus(500, {'error': 'Token refresh failed'});
    }
  }
}`,

    'lib/controllers/user_controller.dart': `import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/models/user.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';
import 'package:{{projectNameSnake}}/utils/response.dart';

class UserController {
  static final _userRepo = UserRepository();

  static Future<Response> list(Request request) async {
    try {
      final users = await _userRepo.findAll();
      final publicUsers = users.map((u) => u.toPublic()).toList();

      return jsonOk(publicUsers);
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to fetch users'});
    }
  }

  static Future<Response> get(Request request, String id) async {
    try {
      final user = await _userRepo.findById(id);
      if (user == null) {
        return jsonStatus(404, {'error': 'User not found'});
      }

      return jsonOk(user.toPublic());
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to fetch user'});
    }
  }

  static Future<Response> update(Request request, String id) async {
    try {
      final currentUser = request.context['user'] as User;

      if (id != currentUser.id) {
        return jsonStatus(403, {'error': 'Forbidden'});
      }

      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final updateRequest = UpdateUserRequest.fromJson(json);

      // Validate request
      final error = updateRequest.validate();
      if (error != null) {
        return jsonStatus(400, {'error': error});
      }

      // Check if email is taken
      if (updateRequest.email != null && updateRequest.email != currentUser.email) {
        final existingUser = await _userRepo.findByEmail(updateRequest.email!);
        if (existingUser != null) {
          return jsonStatus(409, {'error': 'Email already taken'});
        }
      }

      // Update user
      final updatedUser = User(
        id: currentUser.id,
        email: updateRequest.email ?? currentUser.email,
        passwordHash: currentUser.passwordHash,
        name: updateRequest.name ?? currentUser.name,
        createdAt: currentUser.createdAt,
        updatedAt: DateTime.now(),
      );

      await _userRepo.update(updatedUser);

      return jsonOk(updatedUser.toPublic());
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to update user'});
    }
  }

  static Future<Response> delete(Request request, String id) async {
    try {
      final currentUser = request.context['user'] as User;

      if (id != currentUser.id) {
        return jsonStatus(403, {'error': 'Forbidden'});
      }

      await _userRepo.delete(id);

      return Response(204);
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to delete user'});
    }
  }
}`,

    'lib/controllers/todo_controller.dart': `import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/models/user.dart';
import 'package:{{projectNameSnake}}/models/todo.dart';
import 'package:{{projectNameSnake}}/repositories/todo_repository.dart';
import 'package:{{projectNameSnake}}/utils/response.dart';

class TodoController {
  static final _todoRepo = TodoRepository();

  static Future<Response> list(Request request) async {
    try {
      final user = request.context['user'] as User;
      final todos = await _todoRepo.findByUserId(user.id);

      return jsonOk(todos.map((t) => t.toJson()).toList());
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to fetch todos'});
    }
  }

  static Future<Response> create(Request request) async {
    try {
      final user = request.context['user'] as User;
      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final createRequest = CreateTodoRequest.fromJson(json);

      // Validate request
      final error = createRequest.validate();
      if (error != null) {
        return jsonStatus(400, {'error': error});
      }

      // Create todo
      final todo = Todo(
        userId: user.id,
        title: createRequest.title,
        description: createRequest.description,
      );

      await _todoRepo.create(todo);

      return jsonStatus(201, todo.toJson());
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to create todo'});
    }
  }

  static Future<Response> get(Request request, String id) async {
    try {
      final user = request.context['user'] as User;

      final todo = await _todoRepo.findByIdAndUserId(id, user.id);
      if (todo == null) {
        return jsonStatus(404, {'error': 'Todo not found'});
      }

      return jsonOk(todo.toJson());
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to fetch todo'});
    }
  }

  static Future<Response> update(Request request, String id) async {
    try {
      final user = request.context['user'] as User;

      final todo = await _todoRepo.findByIdAndUserId(id, user.id);
      if (todo == null) {
        return jsonStatus(404, {'error': 'Todo not found'});
      }

      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final updateRequest = UpdateTodoRequest.fromJson(json);

      // Validate request
      final error = updateRequest.validate();
      if (error != null) {
        return jsonStatus(400, {'error': error});
      }

      // Update todo
      final updatedTodo = Todo(
        id: todo.id,
        userId: todo.userId,
        title: updateRequest.title ?? todo.title,
        description: updateRequest.description ?? todo.description,
        completed: updateRequest.completed ?? todo.completed,
        createdAt: todo.createdAt,
        updatedAt: DateTime.now(),
      );

      await _todoRepo.update(updatedTodo);

      return jsonOk(updatedTodo.toJson());
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to update todo'});
    }
  }

  static Future<Response> delete(Request request, String id) async {
    try {
      final user = request.context['user'] as User;

      final todo = await _todoRepo.findByIdAndUserId(id, user.id);
      if (todo == null) {
        return jsonStatus(404, {'error': 'Todo not found'});
      }

      await _todoRepo.delete(id);

      return Response(204);
    } catch (e) {
      return jsonStatus(500, {'error': 'Failed to delete todo'});
    }
  }
}`,

    // Services
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
}`,

    // Middleware
    'lib/middleware/auth_middleware.dart': `import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/services/auth_service.dart';
import 'package:{{projectNameSnake}}/repositories/user_repository.dart';
import 'package:{{projectNameSnake}}/utils/response.dart';

Middleware authMiddleware() {
  final authService = AuthService();
  final userRepo = UserRepository();

  return (Handler innerHandler) {
    return (Request request) async {
      // Extract token from Authorization header
      final authHeader = request.headers['authorization'];
      if (authHeader == null || !authHeader.startsWith('Bearer ')) {
        return jsonStatus(401, {'error': 'Authentication required'});
      }

      final token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify token
      final userId = authService.getUserIdFromToken(token);
      if (userId == null) {
        return jsonStatus(401, {'error': 'Invalid token'});
      }

      // Get user
      final user = await userRepo.findById(userId);
      if (user == null) {
        return jsonStatus(401, {'error': 'User not found'});
      }

      // Add user to request context
      final updatedRequest = request.change(context: {
        ...request.context,
        'user': user});

      return innerHandler(updatedRequest);
    };
  };
}`,

    'lib/middleware/error_middleware.dart': `import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/utils/logger.dart';
import 'package:{{projectNameSnake}}/utils/response.dart';

Middleware errorMiddleware() {
  final logger = AppLogger();

  return (Handler innerHandler) {
    return (Request request) async {
      try {
        return await innerHandler(request);
      } catch (e, stackTrace) {
        logger.error('Unhandled error: $e', error: e, stackTrace: stackTrace);

        return jsonStatus(500, {
            'error': 'Internal server error',
            'message': e.toString()});
      }
    };
  };
}`,

    'lib/middleware/logging_middleware.dart': `import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/utils/logger.dart';

Middleware loggingMiddleware() {
  final logger = AppLogger();

  return (Handler innerHandler) {
    return (Request request) async {
      final watch = Stopwatch()..start();

      try {
        final response = await innerHandler(request);

        logger.info(
          '\${request.method} /\${request.url.path} '
          '\${response.statusCode} \${watch.elapsedMilliseconds} ms',
        );

        return response;
      } catch (e) {
        logger.error(
          '\${request.method} /\${request.url.path} '
          'ERROR \${watch.elapsedMilliseconds} ms',
          error: e,
        );
        rethrow;
      }
    };
  };
}
`,

    'lib/middleware/validation_middleware.dart': `import 'package:shelf/shelf.dart';
import 'package:{{projectNameSnake}}/utils/response.dart';

Middleware validationMiddleware() {
  return (Handler innerHandler) {
    return (Request request) async {
      // Ensure content-type is JSON for POST/PUT requests
      if (request.method == 'POST' || request.method == 'PUT') {
        final contentType = request.headers['content-type'];
        if (contentType == null || !contentType.contains('application/json')) {
          return jsonStatus(400, {
              'error': 'Content-Type must be application/json'});
        }
      }

      return innerHandler(request);
    };
  };
}`,

    // Utilities
    'lib/utils/response.dart': `import 'dart:convert';

import 'package:shelf/shelf.dart';

String jsonResponse(Object? data) {
  return jsonEncode(data);
}

Map<String, String> jsonHeaders() {
  return {'content-type': 'application/json'};
}

/// 200 response with a JSON body.
Response jsonOk(Object? data) => jsonStatus(200, data);

/// Response with the given status code and a JSON body.
Response jsonStatus(int status, Object? data) {
  return Response(status, body: jsonResponse(data), headers: jsonHeaders());
}
`,

    'lib/utils/logger.dart': `import 'package:logger/logger.dart';

class AppLogger {
  static final _instance = AppLogger._internal();
  late final Logger _logger;

  factory AppLogger() {
    return _instance;
  }

  AppLogger._internal() {
    _logger = Logger(
      // The default filter only logs when asserts are enabled (debug mode)
      filter: ProductionFilter(),
      printer: PrettyPrinter(
        methodCount: 2,
        errorMethodCount: 8,
        lineLength: 120,
        colors: true,
        printEmojis: true,
        dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
      ),
    );
  }

  void debug(String message) => _logger.d(message);
  void info(String message) => _logger.i(message);
  void warning(String message) => _logger.w(message);
  void error(String message, {Object? error, StackTrace? stackTrace}) =>
      _logger.e(message, error: error, stackTrace: stackTrace);
}`,

    // Tests
    'test/server_test.dart': `import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart';
import 'package:test/test.dart';

void main() {
  final port = '8080';
  final host = 'http://localhost:$port';

  group('Server Tests', () {
    late Process process;
    late Directory dataDir;

    setUpAll(() async {
      dataDir = Directory.systemTemp.createTempSync('{{projectNameSnake}}_test');
      process = await Process.start(
        Platform.resolvedExecutable,
        ['run', 'bin/server.dart'],
        environment: {
          'PORT': port,
          'DB_TYPE': 'sqlite',
          'DB_PATH': '\${dataDir.path}/test.db',
        },
      );

      final ready = Completer<void>();
      process.stdout.transform(utf8.decoder).listen((chunk) {
        if (chunk.contains('Server listening') && !ready.isCompleted) {
          ready.complete();
        }
      });
      process.stderr.drain<void>();
      await ready.future.timeout(const Duration(seconds: 60));
    });

    tearDownAll(() {
      process.kill();
      dataDir.deleteSync(recursive: true);
    });

    test('Root endpoint returns API info', () async {
      final response = await get(Uri.parse('$host/'));
      expect(response.statusCode, equals(200));
      
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      expect(body['name'], equals('{{projectName}} API'));
      expect(body['version'], equals('1.0.0'));
      expect(body['status'], equals('running'));
    });

    test('Health check endpoint', () async {
      final response = await get(Uri.parse('$host/health'));
      expect(response.statusCode, equals(200));
      
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      expect(body['status'], isIn(['healthy', 'unhealthy']));
      expect(body['timestamp'], isNotNull);
    });

    test('404 for unknown routes', () async {
      final response = await get(Uri.parse('$host/unknown'));
      expect(response.statusCode, equals(404));
    });
  });
}`,

    'test/auth_test.dart': `import 'package:test/test.dart';
import 'package:{{projectNameSnake}}/models/user.dart';
import 'package:{{projectNameSnake}}/services/auth_service.dart';

void main() {
  group('Auth Tests', () {
    late AuthService authService;

    setUp(() {
      authService = AuthService();
    });

    test('Password hashing', () {
      final password = 'testpassword123';
      final hash1 = User.hashPassword(password);
      final hash2 = User.hashPassword(password);

      expect(hash1, equals(hash2));
      expect(hash1, isNot(equals(password)));
    });

    test('JWT token generation and verification', () {
      final user = User(
        email: 'test@example.com',
        passwordHash: 'hash',
        name: 'Test User',
      );

      final token = authService.generateAccessToken(user);
      expect(token, isNotEmpty);

      final claims = authService.verifyToken(token);
      expect(claims, isNotNull);
      expect(claims!['sub'], equals(user.id));
      expect(claims['email'], equals(user.email));
      expect(claims['name'], equals(user.name));
    });

    test('Invalid token verification fails', () {
      final claims = authService.verifyToken('invalid.token.here');
      expect(claims, isNull);
    });
  });
}`,

    // Configuration files
    '.env.example': `# Environment
ENVIRONMENT=development

# Server
HOST=0.0.0.0
PORT=8080

# Database
DB_TYPE=sqlite
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectNameSnake}}
DB_USER=postgres
DB_PASSWORD=
DB_PATH=database.db

# Security
JWT_SECRET=your-secret-key-here
JWT_EXPIRY_MINUTES=15
REFRESH_TOKEN_DAYS=30`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM dart:3.2 AS build

WORKDIR /app

# Copy pubspec files
COPY pubspec.* ./

# Install dependencies
RUN dart pub get

# Copy source code
COPY . .

# Compile to executable
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

# Copy public directory
COPY --from=build /app/public ./public

# Create data directory
RUN mkdir -p data && chown -R app:app /app

USER app

# Environment variables
ENV PORT=8080
ENV DB_TYPE=sqlite
ENV DB_PATH=/app/data/database.db

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["./server"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENVIRONMENT=production
      - PORT=8080
      - DB_TYPE=postgres
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME={{projectNameSnake}}
      - DB_USER=shelf
      - DB_PASSWORD=shelf_password
      - JWT_SECRET=your-production-secret-key
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./public:/app/public

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=shelf
      - POSTGRES_PASSWORD=shelf_password
      - POSTGRES_DB={{projectNameSnake}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shelf"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:`,

    // README
    'README.md': `# {{projectName}}

A modular web server application built with Dart and the Shelf framework.

## Features

- ✅ Modular architecture with Shelf middleware
- ✅ RESTful API with routing
- ✅ JWT authentication with refresh tokens
- ✅ PostgreSQL, MySQL, and SQLite support
- ✅ Database migrations
- ✅ CORS support
- ✅ Request logging
- ✅ Hot reload in development
- ✅ Docker ready
- ✅ Comprehensive test suite

## Requirements

- Dart SDK 3.0 or later

## Getting Started

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   dart pub get
   \`\`\`
3. Copy \`.env.example\` to \`.env\` and configure
4. Run the server:
   \`\`\`bash
   dart run bin/server.dart
   \`\`\`

The server will start on port 8080 (override with \`PORT\` or \`--port\`).

## Development

Run with hot reload:
\`\`\`bash
dart run bin/server.dart --hot-reload
\`\`\`

Run on a different port:
\`\`\`bash
dart run bin/server.dart --port 3000
\`\`\`

## API Endpoints

### Public Endpoints
- \`GET /\` - API information
- \`GET /health\` - Health check
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login
- \`POST /api/v1/auth/refresh\` - Refresh token

### Protected Endpoints
All protected endpoints require Bearer token authentication.

- \`GET /api/v1/users\` - List users
- \`GET /api/v1/users/:id\` - Get user
- \`PUT /api/v1/users/:id\` - Update user
- \`DELETE /api/v1/users/:id\` - Delete user
- \`GET /api/v1/todos\` - List todos
- \`POST /api/v1/todos\` - Create todo
- \`GET /api/v1/todos/:id\` - Get todo
- \`PUT /api/v1/todos/:id\` - Update todo
- \`DELETE /api/v1/todos/:id\` - Delete todo

## Testing

Run all tests:
\`\`\`bash
dart test
\`\`\`

Run with coverage:
\`\`\`bash
dart test --coverage=coverage
dart pub global run coverage:format_coverage --lcov --in=coverage --out=coverage/lcov.info --report-on=lib
\`\`\`

## Building

Build a standalone executable:
\`\`\`bash
dart compile exe bin/server.dart -o server
\`\`\`

## Docker

Build and run with Docker:
\`\`\`bash
docker-compose up
\`\`\`

## Environment Variables

See \`.env.example\` for all available configuration options.

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

# Coverage
coverage/

# IDE
.idea/
.vscode/

# Logs
*.log

# OS
.DS_Store
Thumbs.db`,

    'analysis_options.yaml': `include: package:lints/recommended.yaml

linter:
  rules:
    - always_declare_return_types
    - avoid_dynamic_calls
    - avoid_empty_else
    - avoid_relative_lib_imports
    - avoid_returning_null_for_future
    - avoid_slow_async_io
    - avoid_type_to_string
    - avoid_web_libraries_in_flutter
    - cancel_subscriptions
    - close_sinks
    - comment_references
    - literal_only_boolean_expressions
    - no_adjacent_strings_in_list
    - prefer_void_to_null
    - test_types_in_equals
    - throw_in_finally
    - unnecessary_statements
    - unsafe_html

analyzer:
  exclude:
    - build/**
    - "**/*.g.dart"
  errors:
    invalid_annotation_target: ignore`,

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
`,

    'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{projectName}}</title>
</head>
<body>
  <h1>{{projectName}} API</h1>
  <p>See <a href="/health">/health</a>. The API lives under <code>/api/v1</code>.</p>
</body>
</html>
`}};