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
  features: ['middleware', 'routing', 'cors', 'authentication', 'logging', 'file-upload'],
  
  files: {
    // Dart project configuration
    'pubspec.yaml': `name: {{projectName}}
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
  logger: ^2.0.2
  collection: ^1.18.0
  http: ^1.1.0
  intl: ^0.18.1

dev_dependencies:
  build_runner: ^2.4.0
  build_web_compilers: ^4.0.0
  http: ^1.1.0
  lints: ^3.0.0
  test: ^1.24.0
  test_process: ^2.1.0
  coverage: ^1.7.1
  mockito: ^5.4.3
  build_test: ^2.2.1`,

    // Main entry point
    'bin/server.dart': `import 'dart:io';

import 'package:args/args.dart';
import 'package:shelf/shelf.dart' as shelf;
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_hotreload/shelf_hotreload.dart';
import 'package:{{projectName}}/app.dart';
import 'package:{{projectName}}/config/config.dart';
import 'package:{{projectName}}/database/database.dart';
import 'package:{{projectName}}/utils/logger.dart';

void main(List<String> args) async {
  var parser = ArgParser()
    ..addOption('port', abbr: 'p', defaultsTo: '8080')
    ..addOption('host', abbr: 'h', defaultsTo: '0.0.0.0')
    ..addFlag(, abbr: 'r', defaultsTo: true);

  var result = parser.parse(args);
  var port = int.tryParse(result['port'] as String) ?? 8080;
  var host = result['host'] as String;
  var hotReload = result[] as bool;

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
    withHotreload(() => createApp(), onReloaded: () {
      logger.info('🔥 Hot reload triggered');
    });
  } else {
    // Normal server start
    final handler = await createApp();
    final server = await io.serve(handler, host, port);
    
    logger.info('🚀 Server listening on http://$host:$port');
    
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
    'lib/app.dart': `import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_cors_headers/shelf_cors_headers.dart';
import 'package:shelf_static/shelf_static.dart';

import 'controllers/auth_controller.dart';
import 'controllers/user_controller.dart';
import 'controllers/todo_controller.dart';
import 'middleware/auth_middleware.dart';
import 'middleware/error_middleware.dart';
import 'middleware/logging_middleware.dart';
import 'middleware/validation_middleware.dart';
import 'utils/response.dart';

Handler createApp() {
  final router = Router();

  // API info
  router.get('/', (Request request) {
    return Response.ok(jsonResponse({
      'name': '{{projectName}} API',
      'version': '1.0.0',
      'status': 'running'}));
  });

  // Health check
  router.get('/health', (Request request) async {
    final health = await _checkHealth();
    return Response.ok(jsonResponse({
      'status': health ? 'healthy' : 'unhealthy',
      'timestamp': DateTime.now().toIso8601String(),
      'database': health}));
  });

  // API routes
  router.mount('/api/v1/', _apiRouter());

  // Static files
  final staticHandler = createStaticHandler(
    'public',
    defaultDocument: 'index.html',
  );

  // Create pipeline with middleware
  final handler = Pipeline()
      .addMiddleware(corsHeaders())
      .addMiddleware(logRequests())
      .addMiddleware(loggingMiddleware())
      .addMiddleware(errorMiddleware())
      .addHandler(
        Cascade()
            .add(router)
            .add(staticHandler)
            .handler,
      );

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
        .addHandler(_userRouter()),
  );

  router.mount(
    '/todos',
    Pipeline()
        .addMiddleware(authMiddleware())
        .addHandler(_todoRouter()),
  );

  return router;
}

Router _userRouter() {
  final router = Router();

  router.get('/', UserController.list);
  router.get('/<id>', UserController.get);
  router.put('/<id>', Pipeline()
      .addMiddleware(validationMiddleware())
      .addHandler(UserController.update));
  router.delete('/<id>', UserController.delete);

  return router;
}

Router _todoRouter() {
  final router = Router();

  router.get('/', TodoController.list);
  router.post('/', Pipeline()
      .addMiddleware(validationMiddleware())
      .addHandler(TodoController.create));
  router.get('/<id>', TodoController.get);
  router.put('/<id>', Pipeline()
      .addMiddleware(validationMiddleware())
      .addHandler(TodoController.update));
  router.delete('/<id>', TodoController.delete);

  return router;
}

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
  static late DotEnv _env;
  
  static String get environment => _env['ENVIRONMENT'] ?? 'development';
  static String get host => _env['HOST'] ?? '0.0.0.0';
  static int get port => int.tryParse(_env['PORT'] ?? '') ?? 8080;
  
  // Database
  static String get dbType => _env['DB_TYPE'] ?? 'sqlite';
  static String get dbHost => _env['DB_HOST'] ?? 'localhost';
  static int get dbPort => int.tryParse(_env['DB_PORT'] ?? '') ?? 5432;
  static String get dbName => _env['DB_NAME'] ?? '{{projectName}}';
  static String get dbUser => _env['DB_USER'] ?? 'postgres';
  static String get dbPassword => _env['DB_PASSWORD'] ?? '';
  static String get dbPath => _env['DB_PATH'] ?? 'database.db';
  
  // Security
  static String get jwtSecret => _env['JWT_SECRET'] ?? 'your-secret-key';
  static int get jwtExpiryMinutes => int.tryParse(_env['JWT_EXPIRY_MINUTES'] ?? '') ?? 15;
  static int get refreshTokenDays => int.tryParse(_env['REFRESH_TOKEN_DAYS'] ?? '') ?? 30;
  
  static Future<void> load() async {
    _env = DotEnv(includePlatformEnvironment: true);
    
    // Load .env file if it exists
    final envFile = File('.env');
    if (await envFile.exists()) {
      _env.load(['.env']);
    }
  }
}`,

    // Database setup
    'lib/database/database.dart': `import 'package:postgres/postgres.dart';
import 'package:mysql_client/mysql_client.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:{{projectName}}/config/config.dart';
import 'package:{{projectName}}/utils/logger.dart';

export 'package:{{projectName}}/database/database.dart';

abstract class Database {
  static Database? _instance;
  static Database get instance => _instance!;
  
  static final _logger = AppLogger();
  
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
        sslMode: SslMode.prefer,
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
      Sql.named(sql),
      parameters: params ?? [],
    );
    
    return result.map((row) => row.toColumnMap()).toList();
  }
  
  @override
  Future<int> execute(String sql, [List<Object?>? params]) async {
    final result = await _connection!.execute(
      Sql.named(sql),
      parameters: params ?? [],
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
        completed BOOLEAN DEFAULT FALSE,
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
  Database? _db;
  
  @override
  Future<void> connect() async {
    _db = sqlite3.open(Config.dbPath);
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
    'lib/models/user.dart': `import 'package:uuid/uuid.dart';
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
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
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

    'lib/models/todo.dart': `import 'package:uuid/uuid.dart';

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
      completed: (map['completed'] as num) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
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

    'lib/models/token.dart': `import 'package:uuid/uuid.dart';

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
      expiresAt: DateTime.parse(map['expires_at'] as String),
      createdAt: DateTime.parse(map['created_at'] as String),
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
    'lib/repositories/user_repository.dart': `import 'package:{{projectName}}/database/database.dart';
import 'package:{{projectName}}/models/user.dart';

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

    'lib/repositories/todo_repository.dart': `import 'package:{{projectName}}/database/database.dart';
import 'package:{{projectName}}/models/todo.dart';

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

    'lib/repositories/token_repository.dart': `import 'package:{{projectName}}/database/database.dart';
import 'package:{{projectName}}/models/token.dart';

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
    'lib/controllers/auth_controller.dart': `import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:{{projectName}}/models/user.dart';
import 'package:{{projectName}}/models/token.dart';
import 'package:{{projectName}}/repositories/user_repository.dart';
import 'package:{{projectName}}/repositories/token_repository.dart';
import 'package:{{projectName}}/services/auth_service.dart';
import 'package:{{projectName}}/utils/response.dart';

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
        return Response.badRequest(body: jsonResponse({'error': error}));
      }

      // Check if user exists
      final existingUser = await _userRepo.findByEmail(createRequest.email);
      if (existingUser != null) {
        return Response(409, body: jsonResponse({'error': 'User already exists'}));
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

      return Response.ok(jsonResponse({
        'user': user.toPublic(),
        'accessToken': accessToken,
        'refreshToken': refreshToken.token}));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Registration failed'}),
      );
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
        return Response.unauthorized(
          body: jsonResponse({'error': 'Invalid credentials'}),
        );
      }

      // Generate tokens
      final accessToken = _authService.generateAccessToken(user);
      final refreshToken = RefreshToken(userId: user.id);
      await _tokenRepo.create(refreshToken);

      return Response.ok(jsonResponse({
        'user': user.toPublic(),
        'accessToken': accessToken,
        'refreshToken': refreshToken.token}));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Login failed'}),
      );
    }
  }

  static Future<Response> refresh(Request request) async {
    try {
      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final refreshTokenValue = json['refreshToken'] as String?;

      if (refreshTokenValue == null) {
        return Response.badRequest(
          body: jsonResponse({'error': 'Refresh token required'}),
        );
      }

      // Find and validate token
      final token = await _tokenRepo.findByToken(refreshTokenValue);
      if (token == null || !token.isValid) {
        return Response.unauthorized(
          body: jsonResponse({'error': 'Invalid refresh token'}),
        );
      }

      // Get user
      final user = await _userRepo.findById(token.userId);
      if (user == null) {
        return Response.unauthorized(
          body: jsonResponse({'error': 'User not found'}),
        );
      }

      // Delete old token
      await _tokenRepo.delete(refreshTokenValue);

      // Generate new tokens
      final accessToken = _authService.generateAccessToken(user);
      final newRefreshToken = RefreshToken(userId: user.id);
      await _tokenRepo.create(newRefreshToken);

      return Response.ok(jsonResponse({
        'accessToken': accessToken,
        'refreshToken': newRefreshToken.token}));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Token refresh failed'}),
      );
    }
  }
}`,

    'lib/controllers/user_controller.dart': `import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:{{projectName}}/models/user.dart';
import 'package:{{projectName}}/repositories/user_repository.dart';
import 'package:{{projectName}}/utils/response.dart';

class UserController {
  static final _userRepo = UserRepository();

  static Future<Response> list(Request request) async {
    try {
      final users = await _userRepo.findAll();
      final publicUsers = users.map((u) => u.toPublic()).toList();

      return Response.ok(jsonResponse(publicUsers));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to fetch users'}),
      );
    }
  }

  static Future<Response> get(Request request) async {
    try {
      final id = request.params['id'];
      if (id == null) {
        return Response.badRequest(body: jsonResponse({'error': 'Invalid user ID'}));
      }

      final user = await _userRepo.findById(id);
      if (user == null) {
        return Response.notFound(body: jsonResponse({'error': 'User not found'}));
      }

      return Response.ok(jsonResponse(user.toPublic()));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to fetch user'}),
      );
    }
  }

  static Future<Response> update(Request request) async {
    try {
      final currentUser = request.context['user'] as User;
      final id = request.params['id'];

      if (id == null || id != currentUser.id) {
        return Response.forbidden(body: jsonResponse({'error': 'Forbidden'}));
      }

      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final updateRequest = UpdateUserRequest.fromJson(json);

      // Validate request
      final error = updateRequest.validate();
      if (error != null) {
        return Response.badRequest(body: jsonResponse({'error': error}));
      }

      // Check if email is taken
      if (updateRequest.email != null && updateRequest.email != currentUser.email) {
        final existingUser = await _userRepo.findByEmail(updateRequest.email!);
        if (existingUser != null) {
          return Response(409, body: jsonResponse({'error': 'Email already taken'}));
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

      return Response.ok(jsonResponse(updatedUser.toPublic()));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to update user'}),
      );
    }
  }

  static Future<Response> delete(Request request) async {
    try {
      final currentUser = request.context['user'] as User;
      final id = request.params['id'];

      if (id == null || id != currentUser.id) {
        return Response.forbidden(body: jsonResponse({'error': 'Forbidden'}));
      }

      await _userRepo.delete(id);

      return Response.noContent();
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to delete user'}),
      );
    }
  }
}`,

    'lib/controllers/todo_controller.dart': `import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:{{projectName}}/models/user.dart';
import 'package:{{projectName}}/models/todo.dart';
import 'package:{{projectName}}/repositories/todo_repository.dart';
import 'package:{{projectName}}/utils/response.dart';

class TodoController {
  static final _todoRepo = TodoRepository();

  static Future<Response> list(Request request) async {
    try {
      final user = request.context['user'] as User;
      final todos = await _todoRepo.findByUserId(user.id);

      return Response.ok(jsonResponse(todos.map((t) => t.toJson()).toList()));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to fetch todos'}),
      );
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
        return Response.badRequest(body: jsonResponse({'error': error}));
      }

      // Create todo
      final todo = Todo(
        userId: user.id,
        title: createRequest.title,
        description: createRequest.description,
      );

      await _todoRepo.create(todo);

      return Response.ok(
        jsonResponse(todo.toJson()),
        headers: {'status': '201'},
      );
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to create todo'}),
      );
    }
  }

  static Future<Response> get(Request request) async {
    try {
      final user = request.context['user'] as User;
      final id = request.params['id'];

      if (id == null) {
        return Response.badRequest(body: jsonResponse({'error': 'Invalid todo ID'}));
      }

      final todo = await _todoRepo.findByIdAndUserId(id, user.id);
      if (todo == null) {
        return Response.notFound(body: jsonResponse({'error': 'Todo not found'}));
      }

      return Response.ok(jsonResponse(todo.toJson()));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to fetch todo'}),
      );
    }
  }

  static Future<Response> update(Request request) async {
    try {
      final user = request.context['user'] as User;
      final id = request.params['id'];

      if (id == null) {
        return Response.badRequest(body: jsonResponse({'error': 'Invalid todo ID'}));
      }

      final todo = await _todoRepo.findByIdAndUserId(id, user.id);
      if (todo == null) {
        return Response.notFound(body: jsonResponse({'error': 'Todo not found'}));
      }

      final body = await request.readAsString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      final updateRequest = UpdateTodoRequest.fromJson(json);

      // Validate request
      final error = updateRequest.validate();
      if (error != null) {
        return Response.badRequest(body: jsonResponse({'error': error}));
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

      return Response.ok(jsonResponse(updatedTodo.toJson()));
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to update todo'}),
      );
    }
  }

  static Future<Response> delete(Request request) async {
    try {
      final user = request.context['user'] as User;
      final id = request.params['id'];

      if (id == null) {
        return Response.badRequest(body: jsonResponse({'error': 'Invalid todo ID'}));
      }

      final todo = await _todoRepo.findByIdAndUserId(id, user.id);
      if (todo == null) {
        return Response.notFound(body: jsonResponse({'error': 'Todo not found'}));
      }

      await _todoRepo.delete(id);

      return Response.noContent();
    } catch (e) {
      return Response.internalServerError(
        body: jsonResponse({'error': 'Failed to delete todo'}),
      );
    }
  }
}`,

    // Services
    'lib/services/auth_service.dart': `import 'package:jaguar_jwt/jaguar_jwt.dart';
import 'package:{{projectName}}/config/config.dart';
import 'package:{{projectName}}/models/user.dart';

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
import 'package:{{projectName}}/services/auth_service.dart';
import 'package:{{projectName}}/repositories/user_repository.dart';
import 'package:{{projectName}}/utils/response.dart';

Middleware authMiddleware() {
  final authService = AuthService();
  final userRepo = UserRepository();

  return (Handler innerHandler) {
    return (Request request) async {
      // Extract token from Authorization header
      final authHeader = request.headers['authorization'];
      if (authHeader == null || !authHeader.startsWith('Bearer ')) {
        return Response.unauthorized(
          body: jsonResponse({'error': 'Authentication required'}),
        );
      }

      final token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify token
      final userId = authService.getUserIdFromToken(token);
      if (userId == null) {
        return Response.unauthorized(
          body: jsonResponse({'error': 'Invalid token'}),
        );
      }

      // Get user
      final user = await userRepo.findById(userId);
      if (user == null) {
        return Response.unauthorized(
          body: jsonResponse({'error': 'User not found'}),
        );
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
import 'package:{{projectName}}/utils/logger.dart';
import 'package:{{projectName}}/utils/response.dart';

Middleware errorMiddleware() {
  final logger = AppLogger();

  return (Handler innerHandler) {
    return (Request request) async {
      try {
        return await innerHandler(request);
      } catch (e, stackTrace) {
        logger.error('Unhandled error: $e', error: e, stackTrace: stackTrace);

        return Response.internalServerError(
          body: jsonResponse({
            'error': 'Internal server error',
            'message': e.toString()}),
        );
      }
    };
  };
}`,

    'lib/middleware/logging_middleware.dart': `import 'package:shelf/shelf.dart';
import 'package:{{projectName}}/utils/logger.dart';

Middleware loggingMiddleware() {
  final logger = AppLogger();

  return (Handler innerHandler) {
    return (Request request) async {
      final watch = Stopwatch()..start();
      
      try {
        final response = await innerHandler(request);
        
        logger.info(
          '  '
          ' ms',
        );
        
        return response;
      } catch (e) {
        logger.error(
          '  '
          'ERROR ms',
          error: e,
        );
        rethrow;
      }
    };
  };
}`,

    'lib/middleware/validation_middleware.dart': `import 'package:shelf/shelf.dart';
import 'package:{{projectName}}/utils/response.dart';

Middleware validationMiddleware() {
  return (Handler innerHandler) {
    return (Request request) async {
      // Ensure content-type is JSON for POST/PUT requests
      if (request.method == 'POST' || request.method == 'PUT') {
        final contentType = request.headers['content-type'];
        if (contentType == null || !contentType.contains('application/json')) {
          return Response.badRequest(
            body: jsonResponse({
              'error': 'Content-Type must be application/json'}),
          );
        }
      }

      return innerHandler(request);
    };
  };
}`,

    // Utilities
    'lib/utils/response.dart': `import 'dart:convert';

String jsonResponse(Object? data) {
  return jsonEncode(data);
}

Map<String, String> jsonHeaders() {
  return {'content-type': 'application/json'};
}`,

    'lib/utils/logger.dart': `import 'package:logger/logger.dart';

class AppLogger {
  static final _instance = AppLogger._internal();
  late final Logger _logger;

  factory AppLogger() {
    return _instance;
  }

  AppLogger._internal() {
    _logger = Logger(
      printer: PrettyPrinter(
        methodCount: 2,
        errorMethodCount: 8,
        lineLength: 120,
        colors: true,
        printEmojis: true,
        printTime: true,
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
    'test/server_test.dart': `import 'dart:convert';
import 'package:http/http.dart';
import 'package:test/test.dart';
import 'package:test_process/test_process.dart';

void main() {
  final port = '8080';
  final host = 'http://localhost:$port';

  group('Server Tests', () {
    late TestProcess process;

    setUpAll(() async {
      process = await TestProcess.start(
        'dart',
        ['run', 'bin/server.dart'],
        environment: {'PORT': port},
      );
      await process.stdout.stream
          .map((bytes) => utf8.decode(bytes))
          .firstWhere((line) => line.contains('Server listening'));
    });

    tearDownAll(() async {
      process.kill();
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

    'test/auth_test.dart': `import 'dart:convert';
import 'package:test/test.dart';
import 'package:{{projectName}}/models/user.dart';
import 'package:{{projectName}}/services/auth_service.dart';

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
DB_NAME={{projectName}}
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
      - DB_NAME={{projectName}}
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
      - POSTGRES_DB={{projectName}}
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

The server will start on port 8080 with hot reload enabled.

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
    invalid_annotation_target: ignore`}};