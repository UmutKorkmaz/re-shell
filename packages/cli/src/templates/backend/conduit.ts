import { BackendTemplate } from '../types';

export const conduitTemplate: BackendTemplate = {
  id: 'conduit',
  name: 'conduit',
  displayName: 'Conduit Framework',
  description: 'Modern server-side Dart framework for building scalable REST APIs with built-in ORM, OAuth2, and OpenAPI support',
  language: 'dart',
  framework: 'conduit',
  version: '4.0.0',
  tags: ['dart', 'conduit', 'api', 'rest', 'database', 'authorization', 'swagger', 'postgresql'],
  port: 8888,
  dependencies: {},
  features: ['database', 'authorization', 'swagger', 'database', 'validation', 'testing'],
  
  files: {
    // Dart project configuration
    'pubspec.yaml': `name: {{projectName}}
description: A web server built using the Conduit framework.
version: 1.0.0
publish_to: none

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  conduit: ^4.0.0
  conduit_postgresql: ^4.0.0
  
dev_dependencies:
  conduit_test: ^4.0.0
  lints: ^3.0.0
  test: ^1.24.0`,

    // Main application file
    'lib/{{projectName}}.dart': `/// {{projectName}}
///
/// A Conduit web server.
library {{projectName}};

export 'dart:async';
export 'dart:io';

export 'package:conduit/conduit.dart';
export 'package:conduit_postgresql/conduit_postgresql.dart';

export 'channel.dart';
export 'config.dart';

// Models
export 'model/user.dart';
export 'model/todo.dart';
export 'model/auth_token.dart';

// Controllers  
export 'controller/register_controller.dart';
export 'controller/auth_controller.dart';
export 'controller/user_controller.dart';
export 'controller/todo_controller.dart';
export 'controller/health_controller.dart';`,

    // Application channel
    'lib/channel.dart': `import '{{projectName}}.dart';
import 'package:conduit_postgresql/conduit_postgresql.dart';

/// This type initializes an application.
///
/// Override methods in this class to set up routes and initialize services like
/// database connections. See http://conduit.io/docs/http/channel/.
class {{projectName}}Channel extends ApplicationChannel {
  late ManagedContext context;
  late AuthServer authServer;

  /// Initialize services in this method.
  ///
  /// Implement this method to initialize services, read values from [options]
  /// and any other initialization required before constructing [entryPoint].
  ///
  /// This method is invoked prior to [entryPoint] being accessed.
  @override
  Future prepare() async {
    logger.onRecord.listen(
        (rec) => print("\${rec.level.name}: \${rec.time}: \${rec.message}"));

    // Load configuration
    final config = {{projectName}}Configuration(options!.configurationFilePath!);
    
    // Set up database connection
    final dataModel = ManagedDataModel.fromCurrentMirrorSystem();
    final persistentStore = PostgreSQLPersistentStore.fromConnectionInfo(
      config.database.username,
      config.database.password,
      config.database.host,
      config.database.port,
      config.database.databaseName,
    );

    context = ManagedContext(dataModel, persistentStore);

    // Set up auth server
    final authStorage = ManagedAuthDelegate<User>(context);
    authServer = AuthServer(authStorage);
  }

  /// Construct the request channel.
  ///
  /// Return an instance of some [Controller] that will be the initial receiver
  /// of all incoming requests.
  ///
  /// This method is invoked after [prepare].
  @override
  Controller get entryPoint {
    final router = Router();

    // Health check
    router.route("/health").link(() => HealthController());

    // Authentication routes
    router.route("/auth/register").link(() => RegisterController(context, authServer));
    
    router.route("/auth/login").link(() => AuthController(authServer));
    
    router.route("/auth/refresh").link(() => Authorizer.bearer(authServer))!
      .link(() => AuthController(authServer));

    // User routes - protected
    router.route("/users/[:id]")
      .link(() => Authorizer.bearer(authServer))!
      .link(() => UserController(context));

    // Todo routes - protected  
    router.route("/todos/[:id]")
      .link(() => Authorizer.bearer(authServer))!
      .link(() => TodoController(context));

    // API Documentation
    router.route("/docs/*").link(() => FileController("public/"));

    return router;
  }
}`,

    // Configuration
    'lib/config.dart': `import '{{projectName}}.dart';

/// This class represents configuration values read from a configuration file.
class {{projectName}}Configuration extends Configuration {
  {{projectName}}Configuration(String path) : super.fromFile(File(path));

  late DatabaseConfiguration database;
  
  @optionalConfiguration
  int port = 8888;
  
  @optionalConfiguration
  String host = "0.0.0.0";
}`,

    'config.yaml': `# Conduit Configuration
host: 0.0.0.0
port: 8888

# Database Configuration
database:
  host: localhost
  port: 5432
  username: conduit
  password: conduit
  databaseName: {{projectName}}_db`,

    'config.src.yaml': `# Development Configuration
host: localhost
port: 8888

database:
  host: localhost
  port: 5432
  username: conduit
  password: conduit
  databaseName: {{projectName}}_dev`,

    // Models
    'lib/model/user.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class User extends ManagedObject<_User> implements _User, ManagedAuthResourceOwner<_User> {
  @Serialize(input: true, output: false)
  String? password;

  @override
  void willInsert() {
    salt = AuthUtility.generateRandomSalt();
    hashedPassword = authServer!.hashPassword(password!, salt!);
  }
  
  Map<String, dynamic> toPublic() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'createdAt': createdAt?.toIso8601String()};
  }
}

@Table(name: "users")
class _User extends ResourceOwnerTableDefinition {
  @Column(unique: true, indexed: true)
  String? email;
  
  @Column()
  String? name;
  
  @Column()
  DateTime? createdAt;
  
  @Column()
  DateTime? updatedAt;
  
  ManagedSet<Todo>? todos;
  
  @override
  @Column(unique: true, indexed: true)
  String? username;
  
  @override
  @Column(omitByDefault: true)
  String? hashedPassword;
  
  @override
  @Column(omitByDefault: true)
  String? salt;
}

class RegisterRequest extends Serializable {
  String? username;
  String? password;
  String? email;
  String? name;
  
  @override
  Map<String, dynamic> asMap() {
    return {
      'username': username,
      'password': password,
      'email': email,
      'name': name};
  }
  
  @override
  void readFromMap(Map<String, dynamic> map) {
    username = map['username'] as String?;
    password = map['password'] as String?;
    email = map['email'] as String?;
    name = map['name'] as String?;
  }
  
  String? validate() {
    if (username == null || username!.isEmpty) {
      return 'Username is required';
    }
    if (password == null || password!.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (email == null || !email!.contains('@')) {
      return 'Valid email is required';
    }
    if (name == null || name!.isEmpty) {
      return 'Name is required';
    }
    return null;
  }
}

class LoginRequest extends Serializable {
  String? username;
  String? password;
  
  @override
  Map<String, dynamic> asMap() {
    return {
      'username': username,
      'password': password};
  }
  
  @override
  void readFromMap(Map<String, dynamic> map) {
    username = map['username'] as String?;
    password = map['password'] as String?;
  }
}`,

    'lib/model/todo.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class Todo extends ManagedObject<_Todo> implements _Todo {}

@Table(name: "todos")
class _Todo {
  @primaryKey
  int? id;
  
  @Column()
  String? title;
  
  @Column(nullable: true)
  String? description;
  
  @Column(defaultValue: "false")
  bool? completed;
  
  @Column()
  DateTime? createdAt;
  
  @Column()
  DateTime? updatedAt;
  
  @Relate(#todos)
  User? user;
}

class CreateTodoRequest extends Serializable {
  String? title;
  String? description;
  
  @override
  Map<String, dynamic> asMap() {
    return {
      'title': title,
      'description': description};
  }
  
  @override
  void readFromMap(Map<String, dynamic> map) {
    title = map['title'] as String?;
    description = map['description'] as String?;
  }
  
  String? validate() {
    if (title == null || title!.isEmpty) {
      return 'Title is required';
    }
    return null;
  }
}

class UpdateTodoRequest extends Serializable {
  String? title;
  String? description;
  bool? completed;
  
  @override
  Map<String, dynamic> asMap() {
    return {
      'title': title,
      'description': description,
      'completed': completed};
  }
  
  @override
  void readFromMap(Map<String, dynamic> map) {
    title = map['title'] as String?;
    description = map['description'] as String?;
    completed = map['completed'] as bool?;
  }
}`,

    'lib/model/auth_token.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class AuthToken extends ManagedObject<_AuthToken> implements _AuthToken {}

@Table(name: "auth_tokens")
class _AuthToken extends ManagedAuthToken<_AuthToken> {
  @Column()
  DateTime? issuedAt;
  
  @Column()
  DateTime? expiresAt;
}`,

    // Controllers
    'lib/controller/register_controller.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class RegisterController extends ResourceController {
  RegisterController(this.context, this.authServer);

  final ManagedContext context;
  final AuthServer authServer;

  @Operation.post()
  Future<Response> createUser(@Bind.body() RegisterRequest request) async {
    // Validate request
    final error = request.validate();
    if (error != null) {
      return Response.badRequest(body: {'error': error});
    }

    // Check if user exists
    final existingUserQuery = Query<User>(context)
      ..where((u) => u.username).equalTo(request.username)
      ..where((u) => u.email).equalTo(request.email);

    final existingUser = await existingUserQuery.fetchOne();
    if (existingUser != null) {
      return Response.conflict(body: {'error': 'User already exists'});
    }

    // Create user
    final user = User()
      ..username = request.username
      ..password = request.password
      ..email = request.email
      ..name = request.name
      ..createdAt = DateTime.now()
      ..updatedAt = DateTime.now();

    final insertedUser = await Query<User>(context)
      ..values = user
      ..returningProperties((u) => [u.id, u.username, u.email, u.name, u.createdAt])
      ..insert();

    // Generate auth token
    final token = await authServer.authenticate(
      request.username!,
      request.password!,
      request.asMap(),
      duration: const Duration(days: 30),
    );

    return Response.ok({
      'user': insertedUser.toPublic(),
      'token': token!.asMap()});
  }
}`,

    'lib/controller/auth_controller.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class AuthController extends ResourceController {
  AuthController(this.authServer);

  final AuthServer authServer;

  @Operation.post()
  Future<Response> login(@Bind.body() LoginRequest request) async {
    final token = await authServer.authenticate(
      request.username!,
      request.password!,
      request.asMap(),
      duration: const Duration(hours: 24),
    );

    if (token == null) {
      return Response.unauthorized();
    }

    // Get user details
    final userQuery = Query<User>(context!)
      ..where((u) => u.username).equalTo(request.username);
    
    final user = await userQuery.fetchOne();

    return Response.ok({
      'user': user?.toPublic(),
      'token': token.asMap()});
  }

  @Operation.post('refresh')
  Future<Response> refresh(
    @Bind.header(HttpHeaders.authorizationHeader) String authHeader,
  ) async {
    final currentToken = await authServer.verify(authHeader);
    
    if (currentToken == null) {
      return Response.unauthorized();
    }

    // Issue new token
    final newToken = await authServer.refresh(
      currentToken.resourceOwnerIdentifier.toString(),
      currentToken.clientID,
      currentToken.scopes?.map((s) => s.toString()).toList(),
    );

    if (newToken == null) {
      return Response.unauthorized();
    }

    return Response.ok({
      'token': newToken.asMap()});
  }
}`,

    'lib/controller/user_controller.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class UserController extends ResourceController {
  UserController(this.context);

  final ManagedContext context;

  @Operation.get()
  Future<Response> getAllUsers() async {
    final userQuery = Query<User>(context)
      ..returningProperties((u) => [u.id, u.username, u.email, u.name, u.createdAt]);

    final users = await userQuery.fetch();
    
    return Response.ok(users.map((u) => u.toPublic()).toList());
  }

  @Operation.get('id')
  Future<Response> getUserByID(@Bind.path('id') int id) async {
    final userQuery = Query<User>(context)
      ..where((u) => u.id).equalTo(id)
      ..returningProperties((u) => [u.id, u.username, u.email, u.name, u.createdAt]);

    final user = await userQuery.fetchOne();

    if (user == null) {
      return Response.notFound();
    }

    return Response.ok(user.toPublic());
  }

  @Operation.put('id')
  Future<Response> updateUser(
    @Bind.path('id') int id,
    @Bind.body() Map<String, dynamic> body,
  ) async {
    // Only allow users to update their own profile
    if (request!.authorization!.resourceOwnerIdentifier != id) {
      return Response.forbidden();
    }

    final updateQuery = Query<User>(context)
      ..where((u) => u.id).equalTo(id)
      ..values.name = body['name'] as String?
      ..values.email = body['email'] as String?
      ..values.updatedAt = DateTime.now()
      ..returningProperties((u) => [u.id, u.username, u.email, u.name, u.createdAt]);

    final updatedUser = await updateQuery.updateOne();

    if (updatedUser == null) {
      return Response.notFound();
    }

    return Response.ok(updatedUser.toPublic());
  }

  @Operation.delete('id')
  Future<Response> deleteUser(@Bind.path('id') int id) async {
    // Only allow users to delete their own profile
    if (request!.authorization!.resourceOwnerIdentifier != id) {
      return Response.forbidden();
    }

    final deleteQuery = Query<User>(context)
      ..where((u) => u.id).equalTo(id);

    final deletedCount = await deleteQuery.delete();

    if (deletedCount == 0) {
      return Response.notFound();
    }

    return Response.noContent();
  }
}`,

    'lib/controller/todo_controller.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class TodoController extends ResourceController {
  TodoController(this.context);

  final ManagedContext context;

  @Operation.get()
  Future<Response> getAllTodos() async {
    final userId = request!.authorization!.resourceOwnerIdentifier;
    
    final todoQuery = Query<Todo>(context)
      ..where((t) => t.user!.id).equalTo(userId)
      ..sortBy((t) => t.createdAt, QuerySortOrder.descending);

    final todos = await todoQuery.fetch();

    return Response.ok(todos);
  }

  @Operation.post()
  Future<Response> createTodo(@Bind.body() CreateTodoRequest todoRequest) async {
    final error = todoRequest.validate();
    if (error != null) {
      return Response.badRequest(body: {'error': error});
    }

    final userId = request!.authorization!.resourceOwnerIdentifier;

    final todo = Todo()
      ..title = todoRequest.title
      ..description = todoRequest.description
      ..completed = false
      ..createdAt = DateTime.now()
      ..updatedAt = DateTime.now()
      ..user = User()..id = userId;

    final insertedTodo = await Query<Todo>(context)
      ..values = todo
      ..insert();

    return Response.ok(insertedTodo);
  }

  @Operation.get('id')
  Future<Response> getTodoByID(@Bind.path('id') int id) async {
    final userId = request!.authorization!.resourceOwnerIdentifier;

    final todoQuery = Query<Todo>(context)
      ..where((t) => t.id).equalTo(id)
      ..where((t) => t.user!.id).equalTo(userId);

    final todo = await todoQuery.fetchOne();

    if (todo == null) {
      return Response.notFound();
    }

    return Response.ok(todo);
  }

  @Operation.put('id')
  Future<Response> updateTodo(
    @Bind.path('id') int id,
    @Bind.body() UpdateTodoRequest updateRequest,
  ) async {
    final userId = request!.authorization!.resourceOwnerIdentifier;

    final updateQuery = Query<Todo>(context)
      ..where((t) => t.id).equalTo(id)
      ..where((t) => t.user!.id).equalTo(userId);

    if (updateRequest.title != null) {
      updateQuery.values.title = updateRequest.title;
    }
    if (updateRequest.description != null) {
      updateQuery.values.description = updateRequest.description;
    }
    if (updateRequest.completed != null) {
      updateQuery.values.completed = updateRequest.completed;
    }
    updateQuery.values.updatedAt = DateTime.now();

    final updatedTodo = await updateQuery.updateOne();

    if (updatedTodo == null) {
      return Response.notFound();
    }

    return Response.ok(updatedTodo);
  }

  @Operation.delete('id')
  Future<Response> deleteTodo(@Bind.path('id') int id) async {
    final userId = request!.authorization!.resourceOwnerIdentifier;

    final deleteQuery = Query<Todo>(context)
      ..where((t) => t.id).equalTo(id)
      ..where((t) => t.user!.id).equalTo(userId);

    final deletedCount = await deleteQuery.delete();

    if (deletedCount == 0) {
      return Response.notFound();
    }

    return Response.noContent();
  }
}`,

    'lib/controller/health_controller.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

class HealthController extends ResourceController {
  @Operation.get()
  Future<Response> checkHealth() async {
    final health = {
      'status': 'healthy',
      'timestamp': DateTime.now().toIso8601String(),
      'version': '1.0.0'};

    // Check database connection
    try {
      final testQuery = Query<User>(context!)..fetchLimit = 1;
      await testQuery.fetch();
      health['database'] = true;
    } catch (e) {
      health['status'] = 'unhealthy';
      health['database'] = false;
    }

    return Response.ok(health);
  }
}`,

    // Entry point
    'bin/main.dart': `import 'package:{{projectName}}/{{projectName}}.dart';

Future main() async {
  final app = Application<{{projectName}}Channel>()
    ..options.configurationFilePath = "config.yaml"
    ..options.port = 8888;

  await app.startOnCurrentIsolate();

  print("Application started on port: \${app.options.port}.");
  print("Use Ctrl-C (SIGINT) to stop running the application.");
}`,

    // Migration files
    'migrations/00000001_initial.migration.dart': `import 'dart:async';
import 'package:conduit/conduit.dart';

class Migration1 extends Migration {
  @override
  Future upgrade() async {
    // Create users table
    database.createTable(SchemaTable("users", [
      SchemaColumn("id", ManagedPropertyType.bigInteger,
          isPrimaryKey: true, autoincrement: true, isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("username", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: false, isUnique: true),
      SchemaColumn("hashedPassword", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("salt", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("email", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: false, isUnique: true),
      SchemaColumn("name", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),
      SchemaColumn("createdAt", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),
      SchemaColumn("updatedAt", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false)]));

    // Create todos table
    database.createTable(SchemaTable("todos", [
      SchemaColumn("id", ManagedPropertyType.bigInteger,
          isPrimaryKey: true, autoincrement: true, isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("title", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("description", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),
      SchemaColumn("completed", ManagedPropertyType.boolean,
          isPrimaryKey: false, autoincrement: false, defaultValue: "false", isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("createdAt", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),
      SchemaColumn("updatedAt", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false)]));

    // Add foreign key for todos.user_id
    database.addColumn("todos", SchemaColumn.relationship("user", ManagedPropertyType.bigInteger,
        relatedTableName: "users", relatedColumnName: "id", rule: DeleteRule.cascade, isNullable: false, isUnique: false));

    // Create auth tokens table
    database.createTable(SchemaTable("auth_tokens", [
      SchemaColumn("id", ManagedPropertyType.bigInteger,
          isPrimaryKey: true, autoincrement: true, isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("code", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: true, isUnique: true),
      SchemaColumn("accessToken", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: true, isUnique: true),
      SchemaColumn("refreshToken", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: true, isUnique: true),
      SchemaColumn("scope", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),
      SchemaColumn("issueDate", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),
      SchemaColumn("expirationDate", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: false, isUnique: false),
      SchemaColumn("type", ManagedPropertyType.string,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),
      SchemaColumn("issuedAt", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),
      SchemaColumn("expiresAt", ManagedPropertyType.datetime,
          isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false)]));

    // Add foreign keys for auth tokens
    database.addColumn("auth_tokens", SchemaColumn.relationship("resourceOwner", ManagedPropertyType.bigInteger,
        relatedTableName: "users", relatedColumnName: "id", rule: DeleteRule.cascade, isNullable: false, isUnique: false));
    database.addColumn("auth_tokens", SchemaColumn.relationship("client", ManagedPropertyType.string,
        relatedTableName: "_authclient", relatedColumnName: "id", rule: DeleteRule.cascade, isNullable: true, isUnique: false));
  }

  @override
  Future downgrade() async {}

  @override
  Future seed() async {}
}`,

    // Tests
    'test/harness/app.dart': `import 'package:{{projectName}}/{{projectName}}.dart';
import 'package:conduit_test/conduit_test.dart';

export 'package:{{projectName}}/{{projectName}}.dart';
export 'package:conduit_test/conduit_test.dart';
export 'package:test/test.dart';
export 'package:conduit/conduit.dart';

/// A testing harness for {{projectName}}.
///
/// A harness for testing an conduit application. Example test file:
///
///     void main() {
///       Harness harness = Harness()..install();
///
///       test("GET /path returns 200", () async {
///         final response = await harness.agent.get("/path");
///         expectResponse(response, 200);
///       });
///     }
///
class Harness extends TestHarness<{{projectName}}Channel> {
  @override
  Future onSetUp() async {}

  @override
  Future onTearDown() async {}
  
  Future<Map<String, dynamic>> registerUser({
    String username = 'testuser',
    String password = 'password123',
    String email = 'test@example.com',
    String name = 'Test User'}) async {
    final response = await agent!.post('/auth/register', body: {
      'username': username,
      'password': password,
      'email': email,
      'name': name});
    
    return response.body.as<Map<String, dynamic>>();
  }
  
  Future<String> getAuthToken({
    String username = 'testuser',
    String password = 'password123'}) async {
    final response = await agent!.post('/auth/login', body: {
      'username': username,
      'password': password});
    
    final body = response.body.as<Map<String, dynamic>>();
    return body['token']['access_token'] as String;
  }
}`,

    'test/auth_test.dart': `import 'harness/app.dart';

void main() {
  final harness = Harness()..install();

  group('Authentication', () {
    test('POST /auth/register creates new user', () async {
      final response = await harness.agent!.post('/auth/register', body: {
        'username': 'newuser',
        'password': 'password123',
        'email': 'new@example.com',
        'name': 'New User'});

      expectResponse(response, 200);
      expect(response.body.as<Map>()['user']['username'], 'newuser');
      expect(response.body.as<Map>()['token'], isNotNull);
    });

    test('POST /auth/login with valid credentials returns token', () async {
      await harness.registerUser();

      final response = await harness.agent!.post('/auth/login', body: {
        'username': 'testuser',
        'password': 'password123'});

      expectResponse(response, 200);
      expect(response.body.as<Map>()['token'], isNotNull);
      expect(response.body.as<Map>()['user']['username'], 'testuser');
    });

    test('POST /auth/login with invalid credentials returns 401', () async {
      final response = await harness.agent!.post('/auth/login', body: {
        'username': 'wronguser',
        'password': 'wrongpassword'});

      expectResponse(response, 401);
    });
  });
}`,

    'test/todo_test.dart': `import 'harness/app.dart';

void main() {
  final harness = Harness()..install();

  group('Todos', () {
    late String authToken;

    setUpAll(() async {
      await harness.registerUser();
      authToken = await harness.getAuthToken();
    });

    test('GET /todos returns user todos', () async {
      final response = await harness.agent!.get(
        '/todos',
        headers: {'Authorization': 'Bearer $authToken'},
      );

      expectResponse(response, 200);
      expect(response.body.as<List>(), isEmpty);
    });

    test('POST /todos creates new todo', () async {
      final response = await harness.agent!.post(
        '/todos',
        headers: {'Authorization': 'Bearer $authToken'},
        body: {
          'title': 'Test Todo',
          'description': 'Test Description'},
      );

      expectResponse(response, 200);
      expect(response.body.as<Map>()['title'], 'Test Todo');
      expect(response.body.as<Map>()['completed'], false);
    });

    test('Unauthorized request returns 401', () async {
      final response = await harness.agent!.get('/todos');
      expectResponse(response, 401);
    });
  });
}`,

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

# Run ORM build
RUN dart run conduit:conduit build

# Compile to executable
RUN dart compile exe bin/main.dart -o bin/server

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    ca-certificates \\
    libpq5 \\
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -s /bin/bash app

WORKDIR /app

# Copy executable and config
COPY --from=build /app/bin/server .
COPY --from=build /app/config.yaml .
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/public ./public

# Set ownership
RUN chown -R app:app /app

USER app

# Environment
ENV PORT=8888

EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8888/health || exit 1

CMD ["./server"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8888:8888"
    volumes:
      - ./config.yaml:/app/config.yaml
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgres://conduit:conduit@db:5432/{{projectName}}_db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=conduit
      - POSTGRES_PASSWORD=conduit
      - POSTGRES_DB={{projectName}}_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U conduit"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:`,

    // OpenAPI Documentation
    'public/index.html': `<!DOCTYPE html>
<html>
<head>
    <title>{{projectName}} API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
    window.onload = function() {
        window.ui = SwaggerUIBundle({
            url: "/openapi.json",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout"
        });
    };
    </script>
</body>
</html>`,

    // README
    'README.md': `# {{projectName}}

A scalable REST API built with the Conduit framework for Dart.

## Features

- ✅ RESTful API with Conduit ORM
- ✅ PostgreSQL database with migrations
- ✅ OAuth2 authentication
- ✅ OpenAPI 3.0 documentation
- ✅ Request validation
- ✅ Comprehensive testing framework
- ✅ Docker ready
- ✅ Database migrations

## Requirements

- Dart SDK 3.0 or later
- PostgreSQL 12+
- Conduit CLI

## Installation

Install Conduit CLI:
\`\`\`bash
dart pub global activate conduit
\`\`\`

Install dependencies:
\`\`\`bash
dart pub get
\`\`\`

## Database Setup

1. Create PostgreSQL database:
   \`\`\`sql
   CREATE DATABASE {{projectName}}_db;
   CREATE USER conduit WITH PASSWORD 'conduit';
   GRANT ALL PRIVILEGES ON DATABASE {{projectName}}_db TO conduit;
   \`\`\`

2. Run migrations:
   \`\`\`bash
   conduit db upgrade --connect postgres://conduit:conduit@localhost:5432/{{projectName}}_db
   \`\`\`

## Running the Application

Development:
\`\`\`bash
conduit serve
\`\`\`

Production:
\`\`\`bash
dart run bin/main.dart
\`\`\`

The API will be available at \`http://localhost:8888\`.

## API Documentation

Once running, visit \`http://localhost:8888/docs\` for interactive API documentation.

## Testing

Run all tests:
\`\`\`bash
dart test
\`\`\`

Run specific test:
\`\`\`bash
dart test test/auth_test.dart
\`\`\`

## Database Migrations

Generate a new migration:
\`\`\`bash
conduit db generate
\`\`\`

Validate migrations:
\`\`\`bash
conduit db validate
\`\`\`

## Docker

Build and run with Docker:
\`\`\`bash
docker-compose up
\`\`\`

## API Endpoints

### Authentication
- \`POST /auth/register\` - Register new user
- \`POST /auth/login\` - Login
- \`POST /auth/refresh\` - Refresh token

### Users (Protected)
- \`GET /users\` - List all users
- \`GET /users/:id\` - Get user by ID
- \`PUT /users/:id\` - Update user
- \`DELETE /users/:id\` - Delete user

### Todos (Protected)
- \`GET /todos\` - List user's todos
- \`POST /todos\` - Create new todo
- \`GET /todos/:id\` - Get todo by ID
- \`PUT /todos/:id\` - Update todo
- \`DELETE /todos/:id\` - Delete todo

### Health
- \`GET /health\` - Health check

## Configuration

Configuration is managed through \`config.yaml\`:
- \`config.yaml\` - Production configuration
- \`config.src.yaml\` - Development configuration

## License

MIT`,

    '.gitignore': `# Dart
.dart_tool/
.packages
build/
pubspec.lock

# Conduit
.conduit/
.conduit_history
*.db
migrations/.temporary_migration/

# Environment
.env
config.yaml
!config.src.yaml

# IDE
.idea/
.vscode/

# Logs
*.log

# OS
.DS_Store
Thumbs.db

# Test
coverage/
.test_coverage.dart`,

    'analysis_options.yaml': `include: package:lints/recommended.yaml

analyzer:
  exclude:
    - build/**
    - migrations/**
    
linter:
  rules:
    - always_declare_return_types
    - avoid_empty_else
    - avoid_relative_lib_imports
    - avoid_returning_null_for_future
    - avoid_types_as_parameter_names
    - cancel_subscriptions
    - close_sinks
    - literal_only_boolean_expressions
    - no_adjacent_strings_in_list
    - prefer_void_to_null
    - test_types_in_equals
    - throw_in_finally
    - unnecessary_statements`}};