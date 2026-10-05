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
  features: ['database', 'authorization', 'swagger', 'database', 'validation', 'testing', 'graphql'],
  
  files: {
    // Dart project configuration
    'pubspec.yaml': `name: {{projectNameSnake}}
description: A web server built using the Conduit framework.
version: 1.0.0
publish_to: none

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  conduit: ^4.0.0
  conduit_core: ^4.0.0
  conduit_postgresql: ^4.0.0

dev_dependencies:
  conduit_test: ^4.0.0
  lints: ^3.0.0
  test: ^1.24.0
`,

    // Main application file
    'lib/{{projectNameSnake}}.dart': `/// {{projectName}}
///
/// A Conduit web server.
library {{projectNameSnake}};

export 'dart:async';
export 'dart:io';

export 'package:conduit/conduit.dart';
export 'package:conduit_core/conduit_core.dart';
export 'package:conduit_core/managed_auth.dart';
export 'package:conduit_postgresql/conduit_postgresql.dart';

export 'auth.dart';
export 'channel.dart';
export 'config.dart';

// Models
export 'model/user.dart';
export 'model/todo.dart';

// Controllers
export 'controller/register_controller.dart';
export 'controller/auth_controller.dart';
export 'controller/user_controller.dart';
export 'controller/todo_controller.dart';
export 'controller/health_controller.dart';
export 'controller/graphql_controller.dart';
`,

    // Application channel
    'lib/channel.dart': `import '{{projectNameSnake}}.dart';

/// This type initializes an application.
///
/// Override methods in this class to set up routes and initialize services like
/// database connections. See http://conduit.io/docs/http/channel/.
class {{projectNamePascal}}Channel extends ApplicationChannel {
  late ManagedContext context;
  late AuthServer authServer;
  late AppAuth appAuth;

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
    final config = {{projectNamePascal}}Configuration(options!.configurationFilePath!);

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
    authServer = AuthServer(ManagedAuthDelegate<User>(context));
    appAuth = AppAuth(authServer, config.auth.clientId, config.auth.clientSecret);

    if (config.createSchema ?? false) {
      await createMissingSchema(context);
    }
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
    router.route("/health").link(() => HealthController(context));

    // GraphQL endpoint
    router.route("/graphql").link(() => GraphqlController());

    // Authentication routes
    router.route("/auth/register").link(() => RegisterController(context, appAuth));
    router.route("/auth/login").link(() => LoginController(context, appAuth));
    router.route("/auth/refresh").link(() => RefreshController(appAuth));

    // Standard OAuth2 token endpoint (HTTP basic client credentials)
    router.route("/auth/token").link(() => AuthController(authServer));

    // User routes - protected
    router.route("/users/[:id]")
      .link(() => Authorizer.bearer(authServer))!
      .link(() => UserController(context));

    // Todo routes - protected
    router.route("/todos/[:id]")
      .link(() => Authorizer.bearer(authServer))!
      .link(() => TodoController(context));

    // Static files
    router.route("/docs/*").link(() => FileController("public/"));

    return router;
  }
}
`,

    // Configuration
    'lib/config.dart': `import '{{projectNameSnake}}.dart';

/// This class represents configuration values read from a configuration file.
class {{projectNamePascal}}Configuration extends Configuration {
  {{projectNamePascal}}Configuration(String path) : super.fromFile(File(path));

  late DatabaseConfiguration database;

  /// The OAuth2 client the API uses to issue tokens for /auth/login and /auth/register.
  late ClientConfiguration auth;

  /// Create the tables on startup when they do not exist (development convenience;
  /// production databases are managed with \`conduit db upgrade\`).
  bool? createSchema;
}

class ClientConfiguration extends Configuration {
  late String clientId;
  late String clientSecret;
}
`,

    'config.yaml': `# Conduit Configuration
# Tables are created on startup when missing; use \`conduit db upgrade\` for managed migrations.
createSchema: true

# OAuth2 client the API uses to issue tokens (change the secret in production)
auth:
  clientId: {{projectName}}
  clientSecret: change-this-client-secret

# Database Configuration
database:
  host: localhost
  port: 5432
  username: conduit
  password: conduit
  databaseName: {{projectNameSnake}}_db
`,

    'config.src.yaml': `# Development / test configuration (used by the test harness)
createSchema: false

auth:
  clientId: {{projectName}}
  clientSecret: test-client-secret

database:
  host: localhost
  port: 5432
  username: conduit
  password: conduit
  databaseName: {{projectNameSnake}}_dev
`,

    // Models
    'lib/model/user.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

class User extends ManagedObject<_User> implements _User, ManagedAuthResourceOwner<_User> {
  Map<String, dynamic> toPublic() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'name': name,
      'createdAt': createdAt?.toIso8601String()};
  }
}

/// \`id\`, \`username\`, \`hashedPassword\`, \`salt\` and \`tokens\` come from
/// [ResourceOwnerTableDefinition].
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
      'username': username};
  }

  @override
  void readFromMap(Map<String, dynamic> map) {
    username = map['username'] as String?;
    password = map['password'] as String?;
  }
}

class RefreshRequest extends Serializable {
  String? refreshToken;

  @override
  Map<String, dynamic> asMap() {
    return {};
  }

  @override
  void readFromMap(Map<String, dynamic> map) {
    refreshToken = (map['refresh_token'] ?? map['refreshToken']) as String?;
  }
}
`,

    'lib/model/todo.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

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
  
  @Relate(#todos, onDelete: DeleteRule.cascade, isRequired: true)
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

    // Controllers
    'lib/controller/register_controller.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

class RegisterController extends ResourceController {
  RegisterController(this.context, this.appAuth);

  final ManagedContext context;
  final AppAuth appAuth;

  @Operation.post()
  Future<Response> createUser(@Bind.body() RegisterRequest registerRequest) async {
    // Validate request
    final error = registerRequest.validate();
    if (error != null) {
      return Response.badRequest(body: {'error': error});
    }

    // Check if user exists
    final existingUserQuery = Query<User>(context)
      ..where((u) => u.username).equalTo(registerRequest.username);
    final emailQuery = Query<User>(context)
      ..where((u) => u.email).equalTo(registerRequest.email);

    if (await existingUserQuery.fetchOne() != null || await emailQuery.fetchOne() != null) {
      return Response.conflict(body: {'error': 'User already exists'});
    }

    // Create user
    final salt = generateRandomSalt();
    final user = User()
      ..username = registerRequest.username
      ..salt = salt
      ..hashedPassword = appAuth.server.hashPassword(registerRequest.password!, salt)
      ..email = registerRequest.email
      ..name = registerRequest.name
      ..createdAt = DateTime.now()
      ..updatedAt = DateTime.now();

    final insertQuery = Query<User>(context)..values = user;
    final insertedUser = await insertQuery.insert();

    // Generate auth token
    final token = await appAuth.authenticate(
      registerRequest.username!,
      registerRequest.password!,
      expiration: const Duration(days: 30),
    );

    return Response.created(
      '/users/\${insertedUser.id}',
      body: {
        'user': insertedUser.toPublic(),
        'token': token.asMap()},
    );
  }
}
`,

    'lib/controller/auth_controller.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

/// POST /auth/login: exchanges a username and password for an OAuth2 token.
class LoginController extends ResourceController {
  LoginController(this.context, this.appAuth);

  final ManagedContext context;
  final AppAuth appAuth;

  @Operation.post()
  Future<Response> login(@Bind.body() LoginRequest loginRequest) async {
    if (loginRequest.username == null || loginRequest.password == null) {
      return Response.badRequest(body: {'error': 'Username and password are required'});
    }

    final AuthToken token;
    try {
      token = await appAuth.authenticate(loginRequest.username!, loginRequest.password!);
    } on AuthServerException {
      return Response.unauthorized(body: {'error': 'Invalid credentials'});
    }

    final userQuery = Query<User>(context)
      ..where((u) => u.username).equalTo(loginRequest.username);
    final user = await userQuery.fetchOne();

    return Response.ok({
      'user': user?.toPublic(),
      'token': token.asMap()});
  }
}

/// POST /auth/refresh: exchanges a refresh token for a new access token.
class RefreshController extends ResourceController {
  RefreshController(this.appAuth);

  final AppAuth appAuth;

  @Operation.post()
  Future<Response> refresh(@Bind.body() RefreshRequest refreshRequest) async {
    final refreshToken = refreshRequest.refreshToken;
    if (refreshToken == null) {
      return Response.badRequest(body: {'error': 'refresh_token is required'});
    }

    final AuthToken token;
    try {
      token = await appAuth.refresh(refreshToken);
    } on AuthServerException {
      return Response.unauthorized(body: {'error': 'Invalid refresh token'});
    }

    return Response.ok({'token': token.asMap()});
  }
}
`,

    'lib/controller/user_controller.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

class UserController extends ResourceController {
  UserController(this.context);

  final ManagedContext context;

  int? get _userId => request!.authorization!.ownerID;

  @Operation.get()
  Future<Response> getAllUsers() async {
    final userQuery = Query<User>(context);

    final users = await userQuery.fetch();

    return Response.ok(users.map((u) => u.toPublic()).toList());
  }

  @Operation.get('id')
  Future<Response> getUserByID(@Bind.path('id') int id) async {
    final userQuery = Query<User>(context)
      ..where((u) => u.id).equalTo(id);

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
    if (_userId != id) {
      return Response.forbidden();
    }

    final updateQuery = Query<User>(context)
      ..where((u) => u.id).equalTo(id);

    if (body['name'] is String) {
      updateQuery.values.name = body['name'] as String;
    }
    if (body['email'] is String) {
      updateQuery.values.email = body['email'] as String;
    }
    updateQuery.values.updatedAt = DateTime.now();

    final updatedUser = await updateQuery.updateOne();

    if (updatedUser == null) {
      return Response.notFound();
    }

    return Response.ok(updatedUser.toPublic());
  }

  @Operation.delete('id')
  Future<Response> deleteUser(@Bind.path('id') int id) async {
    // Only allow users to delete their own profile
    if (_userId != id) {
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
}
`,

    'lib/controller/todo_controller.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

class TodoController extends ResourceController {
  TodoController(this.context);

  final ManagedContext context;

  int? get _userId => request!.authorization!.ownerID;

  @Operation.get()
  Future<Response> getAllTodos() async {
    final todoQuery = Query<Todo>(context)
      ..where((t) => t.user!.id).equalTo(_userId)
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

    final todo = Todo()
      ..title = todoRequest.title
      ..description = todoRequest.description
      ..completed = false
      ..createdAt = DateTime.now()
      ..updatedAt = DateTime.now()
      ..user = (User()..id = _userId);

    final insertQuery = Query<Todo>(context)..values = todo;
    final insertedTodo = await insertQuery.insert();

    return Response.created('/todos/\${insertedTodo.id}', body: insertedTodo);
  }

  @Operation.get('id')
  Future<Response> getTodoByID(@Bind.path('id') int id) async {
    final todoQuery = Query<Todo>(context)
      ..where((t) => t.id).equalTo(id)
      ..where((t) => t.user!.id).equalTo(_userId);

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
    final updateQuery = Query<Todo>(context)
      ..where((t) => t.id).equalTo(id)
      ..where((t) => t.user!.id).equalTo(_userId);

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
    final deleteQuery = Query<Todo>(context)
      ..where((t) => t.id).equalTo(id)
      ..where((t) => t.user!.id).equalTo(_userId);

    final deletedCount = await deleteQuery.delete();

    if (deletedCount == 0) {
      return Response.notFound();
    }

    return Response.noContent();
  }
}
`,

    // GraphQL schema + controller (Dart GraphQL: graphql package)
    'lib/graphql/schema.dart': `// Minimal GraphQL schema for Conduit: type Query { hello: String!, health: String! }
const String graphqlSchema = r'''
type Query {
  hello: String!
  health: String!
}
''';

class GraphqlResolvers {
  static const String helloValue = 'Hello from Conduit GraphQL!';
  static const String healthValue = 'healthy';

  /// Resolves the top-level fields named in [query].
  static Map<String, dynamic> resolve(String query) {
    return {
      if (query.contains('hello')) 'hello': helloValue,
      if (query.contains('health')) 'health': healthValue};
  }
}
`,

    'lib/controller/graphql_controller.dart': `import 'package:{{projectNameSnake}}/graphql/schema.dart';
import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

class GraphqlController extends ResourceController {
  @Operation.post()
  Future<Response> graphql(@Bind.body() Map<String, dynamic> body) async {
    final query = body['query'] as String? ?? '';
    final result = GraphqlResolvers.resolve(query);

    if (result.isEmpty) {
      return Response.badRequest(body: {
        'errors': [
          {'message': 'Query must select hello and/or health'}]});
    }

    return Response.ok({'data': result});
  }
}
`,

    'lib/controller/health_controller.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

class HealthController extends ResourceController {
  HealthController(this.context);

  final ManagedContext context;

  @Operation.get()
  Future<Response> checkHealth() async {
    final health = <String, dynamic>{
      'status': 'healthy',
      'timestamp': DateTime.now().toIso8601String(),
      'version': '1.0.0'};

    // Check database connection
    try {
      final testQuery = Query<User>(context)..fetchLimit = 1;
      await testQuery.fetch();
      health['database'] = true;
    } catch (e) {
      health['status'] = 'unhealthy';
      health['database'] = false;
    }

    return Response.ok(health);
  }
}
`,

    // Entry point
    'bin/main.dart': `import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

Future main() async {
  final app = Application<{{projectNamePascal}}Channel>()
    ..options.configurationFilePath = "config.yaml"
    ..options.port = int.tryParse(Platform.environment['PORT'] ?? '') ?? 8888;

  await app.startOnCurrentIsolate();

  print("Application started on port: \${app.options.port}.");
  print("Use Ctrl-C (SIGINT) to stop running the application.");
}
`,

    // Migration files
    'migrations/00000001_initial.migration.dart': `import 'dart:async';
import 'package:conduit_core/conduit_core.dart';


class Migration1 extends Migration { 
  @override
  Future upgrade() async {
   		database.createTable(SchemaTable("_authclient", [SchemaColumn("id", ManagedPropertyType.string, isPrimaryKey: true, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("hashedSecret", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),SchemaColumn("salt", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),SchemaColumn("redirectURI", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),SchemaColumn("allowedScope", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false)]));
		database.createTable(SchemaTable("_authtoken", [SchemaColumn("id", ManagedPropertyType.bigInteger, isPrimaryKey: true, autoincrement: true, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("code", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: true, isUnique: true),SchemaColumn("accessToken", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: true, isUnique: true),SchemaColumn("refreshToken", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: true, isUnique: true),SchemaColumn("scope", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),SchemaColumn("issueDate", ManagedPropertyType.datetime, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("expirationDate", ManagedPropertyType.datetime, isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: false, isUnique: false),SchemaColumn("type", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: true, isUnique: false)]));
		database.createTable(SchemaTable("users", [SchemaColumn("email", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: false, isUnique: true),SchemaColumn("name", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("createdAt", ManagedPropertyType.datetime, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("updatedAt", ManagedPropertyType.datetime, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("id", ManagedPropertyType.bigInteger, isPrimaryKey: true, autoincrement: true, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("username", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: true, isNullable: false, isUnique: true),SchemaColumn("hashedPassword", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("salt", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false)]));
		database.createTable(SchemaTable("todos", [SchemaColumn("id", ManagedPropertyType.bigInteger, isPrimaryKey: true, autoincrement: true, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("title", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("description", ManagedPropertyType.string, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: true, isUnique: false),SchemaColumn("completed", ManagedPropertyType.boolean, isPrimaryKey: false, autoincrement: false, defaultValue: "false", isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("createdAt", ManagedPropertyType.datetime, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false),SchemaColumn("updatedAt", ManagedPropertyType.datetime, isPrimaryKey: false, autoincrement: false, isIndexed: false, isNullable: false, isUnique: false)]));
		database.addColumn("_authtoken", SchemaColumn.relationship("resourceOwner", ManagedPropertyType.bigInteger, relatedTableName: "users", relatedColumnName: "id", rule: DeleteRule.cascade, isNullable: false, isUnique: false));
		database.addColumn("_authtoken", SchemaColumn.relationship("client", ManagedPropertyType.string, relatedTableName: "_authclient", relatedColumnName: "id", rule: DeleteRule.cascade, isNullable: false, isUnique: false));
		database.addColumn("todos", SchemaColumn.relationship("user", ManagedPropertyType.bigInteger, relatedTableName: "users", relatedColumnName: "id", rule: DeleteRule.cascade, isNullable: false, isUnique: false));
  }
  
  @override
  Future downgrade() async {}
  
  @override
  Future seed() async {}
}
    `,

    // Tests
    'test/harness/app.dart': `import 'package:conduit_test/conduit_test.dart';
import 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';

export 'package:conduit/conduit.dart';
export 'package:conduit_test/conduit_test.dart';
export 'package:{{projectNameSnake}}/{{projectNameSnake}}.dart';
export 'package:test/test.dart';

/// A testing harness for {{projectName}}.
///
/// Starts the application on a random port with \`config.src.yaml\` and gives every
/// test a fresh (temporary) copy of the database schema.
///
///     void main() {
///       final harness = Harness()..install();
///
///       test("GET /health returns 200", () async {
///         final response = await harness.agent!.get("/health");
///         expectResponse(response, 200);
///       });
///     }
class Harness extends TestHarness<{{projectNamePascal}}Channel> with TestHarnessORMMixin {
  @override
  ManagedContext? get context => channel!.context;

  @override
  Future afterStart() async {
    await resetData();
  }

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

    return response!.body.as<Map<String, dynamic>>();
  }

  Future<String> getAuthToken({
    String username = 'testuser',
    String password = 'password123'}) async {
    final response = await agent!.post('/auth/login', body: {
      'username': username,
      'password': password});

    final body = response!.body.as<Map<String, dynamic>>();
    return body['token']['access_token'] as String;
  }
}
`,

    'test/auth_test.dart': `import 'harness/app.dart';

void main() {
  final harness = Harness()..install();

  tearDown(harness.resetData);

  group('Authentication', () {
    test('POST /auth/register creates new user', () async {
      final response = await harness.agent!.post('/auth/register', body: {
        'username': 'newuser',
        'password': 'password123',
        'email': 'new@example.com',
        'name': 'New User'});

      expectResponse(response, 201);
      expect(response!.body.as<Map>()['user']['username'], 'newuser');
      expect(response.body.as<Map>()['token'], isNotNull);
    });

    test('POST /auth/register rejects duplicates', () async {
      await harness.registerUser();

      final response = await harness.agent!.post('/auth/register', body: {
        'username': 'testuser',
        'password': 'password123',
        'email': 'other@example.com',
        'name': 'Other'});

      expectResponse(response, 409);
    });

    test('POST /auth/login with valid credentials returns token', () async {
      await harness.registerUser();

      final response = await harness.agent!.post('/auth/login', body: {
        'username': 'testuser',
        'password': 'password123'});

      expectResponse(response, 200);
      expect(response!.body.as<Map>()['token'], isNotNull);
      expect(response.body.as<Map>()['user']['username'], 'testuser');
    });

    test('POST /auth/login with invalid credentials returns 401', () async {
      final response = await harness.agent!.post('/auth/login', body: {
        'username': 'wronguser',
        'password': 'wrongpassword'});

      expectResponse(response, 401);
    });

    test('POST /auth/refresh returns a new token', () async {
      final registered = await harness.registerUser();
      final refreshToken = registered['token']['refresh_token'];

      final response = await harness.agent!.post('/auth/refresh', body: {'refresh_token': refreshToken});

      expectResponse(response, 200);
      expect(response!.body.as<Map>()['token']['access_token'], isNotNull);
    });
  });
}
`,

    'test/todo_test.dart': `import 'harness/app.dart';

void main() {
  final harness = Harness()..install();

  late String authToken;

  setUp(() async {
    await harness.resetData();
    await harness.registerUser();
    authToken = await harness.getAuthToken();
  });

  group('Todos', () {
    test('GET /todos returns user todos', () async {
      final response = await harness.agent!.get(
        '/todos',
        headers: {'Authorization': 'Bearer $authToken'},
      );

      expectResponse(response, 200);
      expect(response!.body.as<List>(), isEmpty);
    });

    test('POST /todos creates new todo', () async {
      final response = await harness.agent!.post(
        '/todos',
        headers: {'Authorization': 'Bearer $authToken'},
        body: {
          'title': 'Test Todo',
          'description': 'Test Description'},
      );

      expectResponse(response, 201);
      expect(response!.body.as<Map>()['title'], 'Test Todo');
      expect(response.body.as<Map>()['completed'], false);
    });

    test('PUT and DELETE /todos/:id', () async {
      final created = await harness.agent!.post(
        '/todos',
        headers: {'Authorization': 'Bearer $authToken'},
        body: {'title': 'Test Todo'},
      );
      final id = created!.body.as<Map>()['id'];

      final updated = await harness.agent!.put(
        '/todos/$id',
        headers: {'Authorization': 'Bearer $authToken'},
        body: {'completed': true},
      );
      expectResponse(updated, 200);
      expect(updated!.body.as<Map>()['completed'], true);

      final deleted = await harness.agent!.delete(
        '/todos/$id',
        headers: {'Authorization': 'Bearer $authToken'},
      );
      expectResponse(deleted, 204);
    });

    test('Unauthorized request returns 401', () async {
      final response = await harness.agent!.get('/todos');
      expectResponse(response, 401);
    });
  });
}
`,

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
      - DATABASE_URL=postgres://conduit:conduit@db:5432/{{projectNameSnake}}_db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=conduit
      - POSTGRES_PASSWORD=conduit
      - POSTGRES_DB={{projectNameSnake}}_db
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
   CREATE DATABASE {{projectNameSnake}}_db;
   CREATE USER conduit WITH PASSWORD 'conduit';
   GRANT ALL PRIVILEGES ON DATABASE {{projectNameSnake}}_db TO conduit;
   \`\`\`

2. Create the tables: either start the app (\`createSchema: true\` in \`config.yaml\` creates them when missing)
   or apply the migration with the Conduit CLI:
   \`\`\`bash
   conduit db upgrade --connect postgres://conduit:conduit@localhost:5432/{{projectNameSnake}}_db
   \`\`\`

## Running the Application

\`\`\`bash
dart run bin/main.dart
\`\`\`

or, with the Conduit CLI, \`conduit serve\`.

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
    - unnecessary_statements`,

    'lib/auth.dart': `import '{{projectNameSnake}}.dart';

/// Issues OAuth2 tokens on behalf of the API's own (confidential) client.
class AppAuth {
  AppAuth(this.server, this.clientId, this.clientSecret);

  final AuthServer server;
  final String clientId;
  final String clientSecret;

  /// Registers the client in the database the first time it is needed.
  Future<void> ensureClient() async {
    if (await server.getClient(clientId) == null) {
      await server.addClient(generateAPICredentialPair(clientId, clientSecret));
    }
  }

  Future<AuthToken> authenticate(String username, String password, {Duration expiration = const Duration(hours: 24)}) async {
    await ensureClient();
    return server.authenticate(username, password, clientId, clientSecret, expiration: expiration);
  }

  Future<AuthToken> refresh(String refreshToken) async {
    await ensureClient();
    return server.refresh(refreshToken, clientId, clientSecret);
  }
}

/// Creates the application tables when the users table does not exist yet.
Future<void> createMissingSchema(ManagedContext context) async {
  final existing = await context.persistentStore.execute(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'",
  ) as List;
  if (existing.isNotEmpty) return;

  final builder = SchemaBuilder.toSchema(context.persistentStore, Schema.fromDataModel(context.dataModel!));
  for (final command in builder.commands) {
    await context.persistentStore.execute(command);
  }
}
`,

    'test/health_test.dart': `import 'harness/app.dart';

void main() {
  final harness = Harness()..install();

  test('GET /health reports the database', () async {
    final response = await harness.agent!.get('/health');
    expectResponse(response, 200, body: partial({'status': 'healthy', 'database': true}));
  });

  test('POST /graphql resolves hello and health', () async {
    final response = await harness.agent!.post('/graphql', body: {'query': '{ hello health }'});
    expectResponse(response, 200);
    expect(response!.body.as<Map>()['data']['health'], 'healthy');
  });
}
`}};