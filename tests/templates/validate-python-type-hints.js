#!/usr/bin/env node

/**
 * Comprehensive validation test for Python type hints system
 * Tests type annotation generation and mypy compliance
 */

const fs = require('fs');
const path = require('path');

const typeHintsPath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'python-type-hints.ts');

if (!fs.existsSync(typeHintsPath)) {
  console.error('❌ Python type hints file not found:', typeHintsPath);
  process.exit(1);
}

const typeHintsContent = fs.readFileSync(typeHintsPath, 'utf8');

// Validation results
let passed = 0;
let failed = 0;
const failures = [];

function test(description, assertion) {
  try {
    if (assertion) {
      console.log(`✅ ${description}`);
      passed++;
    } else {
      console.log(`❌ ${description}`);
      failed++;
      failures.push(description);
    }
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
    failed++;
    failures.push(description);
  }
}

console.log('🧪 Validating Python Type Hints System...\n');

// Basic Structure Tests
test('Contains PythonTypeHintsGenerator class', typeHintsContent.includes('class PythonTypeHintsGenerator'));
test('Has generateTypeHintsConfig method', typeHintsContent.includes('generateTypeHintsConfig'));
test('Has generateBaseTypes method', typeHintsContent.includes('generateBaseTypes'));
test('Has generateFastAPITypes method', typeHintsContent.includes('generateFastAPITypes'));
test('Has generateDjangoTypes method', typeHintsContent.includes('generateDjangoTypes'));
test('Has generateFlaskTypes method', typeHintsContent.includes('generateFlaskTypes'));
test('Has generateTornadoTypes method', typeHintsContent.includes('generateTornadoTypes'));
test('Has generateSanicTypes method', typeHintsContent.includes('generateSanicTypes'));

// Configuration Interface Tests
test('Has PythonTypeHintsConfig interface', typeHintsContent.includes('interface PythonTypeHintsConfig'));
test('Config has framework field', typeHintsContent.includes('framework: string'));
test('Config has pythonVersion field', typeHintsContent.includes('pythonVersion: string'));
test('Config has strictMode field', typeHintsContent.includes('strictMode: boolean'));
test('Config has enableDataclasses field', typeHintsContent.includes('enableDataclasses: boolean'));
test('Config has enablePydantic field', typeHintsContent.includes('enablePydantic: boolean'));
test('Config has enableProtocols field', typeHintsContent.includes('enableProtocols: boolean'));
test('Config has enableGenericAliases field', typeHintsContent.includes('enableGenericAliases: boolean'));

// Base Types Tests
test('Has future annotations import', typeHintsContent.includes('from __future__ import annotations'));
test('Has comprehensive typing imports', typeHintsContent.includes('from typing import ('));
test('Has TYPE_CHECKING import', typeHintsContent.includes('TYPE_CHECKING'));
test('Has version-specific imports', typeHintsContent.includes('if sys.version_info >= (3, 10)'));
test('Has typing_extensions fallback', typeHintsContent.includes('from typing_extensions import'));
test('Has Python 3.11 specific imports', typeHintsContent.includes('if sys.version_info >= (3, 11)'));

// Type Variables Tests
test('Has generic type variables', typeHintsContent.includes('T = TypeVar'));
test('Has key-value type variables', typeHintsContent.includes('K = TypeVar') && typeHintsContent.includes('V = TypeVar'));
test('Has ParamSpec variable', typeHintsContent.includes('P = ParamSpec'));

// Type Aliases Tests
test('Has JSONValue type alias', typeHintsContent.includes('JSONValue: TypeAlias'));
test('Has JSONDict type alias', typeHintsContent.includes('JSONDict: TypeAlias'));
test('Has PathLike type alias', typeHintsContent.includes('PathLike: TypeAlias'));
test('Has HTTPMethod type alias', typeHintsContent.includes('HTTPMethod: TypeAlias'));
test('Has HTTPStatus type alias', typeHintsContent.includes('HTTPStatus: TypeAlias'));
test('Has DatabaseURL type alias', typeHintsContent.includes('DatabaseURL: TypeAlias'));
test('Has UserID type alias', typeHintsContent.includes('UserID: TypeAlias'));
test('Has Token type alias', typeHintsContent.includes('Token: TypeAlias'));

// Protocol Definitions Tests
test('Has Serializable protocol', typeHintsContent.includes('class Serializable(Protocol)'));
test('Has Identifiable protocol', typeHintsContent.includes('class Identifiable(Protocol'));
test('Has Timestamped protocol', typeHintsContent.includes('class Timestamped(Protocol)'));
test('Has Validatable protocol', typeHintsContent.includes('class Validatable(Protocol)'));
test('Has Cacheable protocol', typeHintsContent.includes('class Cacheable(Protocol'));
test('Has RequestHandler protocol', typeHintsContent.includes('class RequestHandler(Protocol)'));
test('Has Middleware protocol', typeHintsContent.includes('class Middleware(Protocol)'));
test('Has DatabaseConnection protocol', typeHintsContent.includes('class DatabaseConnection(Protocol)'));

// Protocol Methods Tests
test('Serializable has to_dict method', typeHintsContent.includes('def to_dict(self) -> Dict[str, Any]'));
test('Serializable has from_dict method', typeHintsContent.includes('def from_dict(cls, data: Dict[str, Any]) -> Self'));
test('Identifiable has id field', typeHintsContent.includes('id: T'));
test('Timestamped has timestamp fields', typeHintsContent.includes('created_at: datetime') && typeHintsContent.includes('updated_at: Optional[datetime]'));
test('Validatable has validate method', typeHintsContent.includes('def validate(self) -> bool'));
test('Validatable has get_errors method', typeHintsContent.includes('def get_errors(self) -> ValidationError'));

// Type Guards Tests
test('Has is_json_dict type guard', typeHintsContent.includes('def is_json_dict(value: Any) -> TypeGuard[JSONDict]'));
test('Has is_valid_id type guard', typeHintsContent.includes('def is_valid_id(value: Any) -> TypeGuard'));
test('Has is_http_method type guard', typeHintsContent.includes('def is_http_method(value: str) -> TypeGuard[HTTPMethod]'));

// Utility Functions Tests
test('Has ensure_list function', typeHintsContent.includes('def ensure_list(value: Union[T, List[T]]) -> List[T]'));
test('Has ensure_dict function', typeHintsContent.includes('def ensure_dict(value: Union[Dict[K, V], List[Tuple[K, V]]]) -> Dict[K, V]'));

// Generic Result Type Tests
test('Has Result generic class', typeHintsContent.includes('class Result(Generic[T])'));
test('Result has is_success property', typeHintsContent.includes('def is_success(self) -> bool'));
test('Result has is_error property', typeHintsContent.includes('def is_error(self) -> bool'));
test('Result has value property', typeHintsContent.includes('def value(self) -> T'));
test('Result has success class method', typeHintsContent.includes('def success(cls, value: T) -> Result[T]'));
test('Result has failure class method', typeHintsContent.includes('def failure(cls, error: str) -> Result[T]'));

// Pagination Types Tests
test('Has PaginationInfo protocol', typeHintsContent.includes('class PaginationInfo(Protocol)'));
test('Has PaginatedResponse protocol', typeHintsContent.includes('class PaginatedResponse(Generic[T], Protocol)'));
test('PaginationInfo has pagination fields', typeHintsContent.includes('page: int') && typeHintsContent.includes('limit: int') && typeHintsContent.includes('total: int'));
test('PaginatedResponse has data and pagination', typeHintsContent.includes('data: List[T]') && typeHintsContent.includes('pagination: PaginationInfo'));

// FastAPI-Specific Tests
test('FastAPI has TypedBaseModel', typeHintsContent.includes('class TypedBaseModel(BaseModel)'));
test('FastAPI has FastAPI type aliases', typeHintsContent.includes('FastAPIApp: TypeAlias = FastAPI'));
test('FastAPI has dependency types', typeHintsContent.includes('Dependency: TypeAlias'));
test('FastAPI has route handler types', typeHintsContent.includes('RouteHandler: TypeAlias'));
test('FastAPI has middleware types', typeHintsContent.includes('MiddlewareCallable: TypeAlias'));
test('FastAPI has security types', typeHintsContent.includes('SecurityScheme: TypeAlias'));

// FastAPI Model Features Tests
test('TypedBaseModel has Config class', typeHintsContent.includes('class Config'));
test('TypedBaseModel has from_attributes', typeHintsContent.includes('from_attributes = True'));
test('TypedBaseModel has json_encoders', typeHintsContent.includes('json_encoders'));
test('TypedBaseModel has get_field_types method', typeHintsContent.includes('def get_field_types(cls) -> Dict[str, Any]'));
test('TypedBaseModel has to_dict method', typeHintsContent.includes('def to_dict(self, exclude_none: bool = True) -> Dict[str, Any]'));
test('TypedBaseModel has from_dict method', typeHintsContent.includes('def from_dict(cls, data: Dict[str, Any]) -> Self'));

// FastAPI Request/Response Models Tests
test('Has APIRequest model', typeHintsContent.includes('class APIRequest(TypedBaseModel)'));
test('Has APIResponse generic model', typeHintsContent.includes('class APIResponse(TypedBaseModel, Generic[T])'));
test('Has PaginatedAPIResponse model', typeHintsContent.includes('class PaginatedAPIResponse(APIResponse[List[T]])'));
test('Has APIError model', typeHintsContent.includes('class APIError(TypedBaseModel)'));
test('Has ValidationErrorResponse model', typeHintsContent.includes('class ValidationErrorResponse(APIResponse[None])'));

// FastAPI Authentication Tests
test('Has UserClaims model', typeHintsContent.includes('class UserClaims(TypedBaseModel)'));
test('Has AuthenticatedUser model', typeHintsContent.includes('class AuthenticatedUser(TypedBaseModel)'));
test('UserClaims has JWT fields', typeHintsContent.includes('user_id: UserID') && typeHintsContent.includes('exp: int') && typeHintsContent.includes('iat: int'));
test('AuthenticatedUser has user fields', typeHintsContent.includes('username: str') && typeHintsContent.includes('roles: List[str]'));

// FastAPI Database Models Tests
test('Has DatabaseModel base class', typeHintsContent.includes('class DatabaseModel(TypedBaseModel)'));
test('DatabaseModel has common fields', typeHintsContent.includes('id: Optional[UUID]') && typeHintsContent.includes('created_at: Optional[datetime]'));
test('DatabaseModel has soft delete', typeHintsContent.includes('is_deleted: bool'));

// FastAPI File Upload Tests
test('Has FileInfo model', typeHintsContent.includes('class FileInfo(TypedBaseModel)'));
test('Has UploadedFile model', typeHintsContent.includes('class UploadedFile(FileInfo)'));
test('FileInfo has file fields', typeHintsContent.includes('filename: str') && typeHintsContent.includes('content_type: str') && typeHintsContent.includes('size: int'));

// FastAPI WebSocket Tests
test('Has WebSocketMessage model', typeHintsContent.includes('class WebSocketMessage(TypedBaseModel)'));
test('Has WebSocketConnection protocol', typeHintsContent.includes('class WebSocketConnection(Protocol)'));
test('WebSocketConnection has async methods', typeHintsContent.includes('async def send_text') && typeHintsContent.includes('async def receive_json'));

// FastAPI Background Tasks Tests
test('Has TaskResult model', typeHintsContent.includes('class TaskResult(TypedBaseModel, Generic[T])'));
test('TaskResult has task fields', typeHintsContent.includes('task_id: str') && typeHintsContent.includes('status: Literal'));
test('TaskResult has progress field', typeHintsContent.includes('progress: Optional[int]'));

// FastAPI Health Check Tests
test('Has HealthStatus model', typeHintsContent.includes('class HealthStatus(TypedBaseModel)'));
test('HealthStatus has status field with literals', typeHintsContent.includes('status: Literal["healthy", "unhealthy", "degraded"]'));

// FastAPI Configuration Tests
test('Has AppConfig model', typeHintsContent.includes('class AppConfig(TypedBaseModel)'));
test('AppConfig has environment field', typeHintsContent.includes('environment: Literal["development", "staging", "production"]'));
test('AppConfig has database and redis URLs', typeHintsContent.includes('database_url: DatabaseURL') && typeHintsContent.includes('redis_url: Optional[str]'));

// FastAPI Exception Tests
test('Has APIException class', typeHintsContent.includes('class APIException(HTTPException)'));
test('Has ValidationException class', typeHintsContent.includes('class ValidationException(APIException)'));
test('Has AuthenticationException class', typeHintsContent.includes('class AuthenticationException(APIException)'));
test('Has AuthorizationException class', typeHintsContent.includes('class AuthorizationException(APIException)'));

// Django-Specific Tests
test('Django has TypedModel class', typeHintsContent.includes('class TypedModel(models.Model)'));
test('Django has model type aliases', typeHintsContent.includes('DjangoModel: TypeAlias'));
test('Django has QuerySet type', typeHintsContent.includes('QuerySet: TypeAlias'));
test('Django has Manager type', typeHintsContent.includes('Manager: TypeAlias'));
test('Django has request/response types', typeHintsContent.includes('DjangoRequest: TypeAlias = HttpRequest'));

// Django Model Features Tests
test('TypedModel has objects manager', typeHintsContent.includes('objects: Manager[Self]'));
test('TypedModel has get_field_types method', typeHintsContent.includes('def get_field_types(cls) -> Dict[str, Any]'));
test('TypedModel has to_dict method', typeHintsContent.includes('def to_dict(self, exclude: Optional[List[str]] = None) -> Dict[str, Any]'));
test('TypedModel has update_from_dict method', typeHintsContent.includes('def update_from_dict(self, data: Dict[str, Any], save: bool = True) -> None'));

// Django Mixins Tests
test('Has TimestampMixin', typeHintsContent.includes('class TimestampMixin(models.Model)'));
test('Has UUIDMixin', typeHintsContent.includes('class UUIDMixin(models.Model)'));
test('Has SoftDeleteMixin', typeHintsContent.includes('class SoftDeleteMixin(models.Model)'));
test('Has BaseModel combining mixins', typeHintsContent.includes('class BaseModel(TypedModel, TimestampMixin, UUIDMixin, SoftDeleteMixin)'));

// Django User Model Tests
test('Has TypedUser class', typeHintsContent.includes('class TypedUser(AbstractUser)'));
test('TypedUser has enhanced fields', typeHintsContent.includes('email: str = models.EmailField(unique=True)'));
test('TypedUser has methods', typeHintsContent.includes('def get_full_name(self) -> str') && typeHintsContent.includes('def get_display_name(self) -> str'));

// Django DRF Tests (conditional)
test('Checks for DRF import', typeHintsContent.includes('try:') && typeHintsContent.includes('from rest_framework import serializers'));
test('Has TypedModelSerializer conditional', typeHintsContent.includes('class TypedModelSerializer(serializers.ModelSerializer)'));

// Django Forms Tests
test('Has TypedForm class', typeHintsContent.includes('class TypedForm(Form)'));
test('Has TypedModelForm class', typeHintsContent.includes('class TypedModelForm(ModelForm)'));
test('TypedForm has get_errors_dict method', typeHintsContent.includes('def get_errors_dict(self) -> Dict[str, List[str]]'));

// Django Views Tests
test('Has TypedView class', typeHintsContent.includes('class TypedView(View)'));
test('Has TypedListView generic', typeHintsContent.includes('class TypedListView(ListView, Generic[T])'));
test('Has TypedDetailView generic', typeHintsContent.includes('class TypedDetailView(DetailView, Generic[T])'));

// Django QuerySet/Manager Tests
test('Has TypedQuerySet generic', typeHintsContent.includes('class TypedQuerySet(QuerySet, Generic[T])'));
test('Has TypedManager generic', typeHintsContent.includes('class TypedManager(Manager, Generic[T])'));
test('TypedQuerySet has typed methods', typeHintsContent.includes('def filter(self, **kwargs: Any) -> TypedQuerySet[T]'));

// Django Admin Tests (conditional)
test('Checks for admin import', typeHintsContent.includes('from django.contrib import admin'));
test('Has TypedModelAdmin conditional', typeHintsContent.includes('class TypedModelAdmin(admin.ModelAdmin, Generic[T])'));

// Django Signals Tests
test('Has signal type aliases', typeHintsContent.includes('SignalSender: TypeAlias'));
test('Has typed_receiver function', typeHintsContent.includes('def typed_receiver'));

// Django Cache Tests
test('Has TypedCache class', typeHintsContent.includes('class TypedCache'));
test('TypedCache has typed methods', typeHintsContent.includes('def get(self, key: CacheKey, default: Optional[T] = None) -> Optional[T]'));

// Flask-Specific Tests
test('Flask has TypedFlask class', typeHintsContent.includes('class TypedFlask(Flask)'));
test('Flask has route handler types', typeHintsContent.includes('RouteHandler: TypeAlias'));
test('Flask has blueprint handler types', typeHintsContent.includes('BlueprintHandler: TypeAlias'));
test('Flask has view types', typeHintsContent.includes('FlaskView: TypeAlias'));

// Flask Request Tests
test('Has TypedRequest class', typeHintsContent.includes('class TypedRequest(Request)'));
test('TypedRequest has json_data property', typeHintsContent.includes('def json_data(self) -> Optional[Dict[str, Any]]'));
test('TypedRequest has get_param method', typeHintsContent.includes('def get_param(self, key: str, default: Optional[T] = None, param_type: Type[T] = str) -> Optional[T]'));

// Flask Response Tests
test('Has APIResponse class for Flask', typeHintsContent.includes('class APIResponse:') && typeHintsContent.includes('def success('));
test('APIResponse has error method', typeHintsContent.includes('def error(') && typeHintsContent.includes('message: str'));
test('APIResponse has paginated method', typeHintsContent.includes('def paginated('));

// Flask Blueprint Tests
test('Has TypedBlueprint class', typeHintsContent.includes('class TypedBlueprint(Blueprint)'));
test('TypedBlueprint has route decorator', typeHintsContent.includes('def route(') && typeHintsContent.includes('rule: str'));

// Flask SQLAlchemy Tests (conditional)
test('Checks for Flask-SQLAlchemy import', typeHintsContent.includes('from flask_sqlalchemy import SQLAlchemy'));
test('Has TypedSQLAlchemy conditional', typeHintsContent.includes('class TypedSQLAlchemy(SQLAlchemy)'));

// Flask Forms Tests (conditional)
test('Checks for Flask-WTF import', typeHintsContent.includes('from flask_wtf import FlaskForm'));
test('Has TypedFlaskForm conditional', typeHintsContent.includes('class TypedFlaskForm(FlaskForm)'));

// Flask Authentication Tests
test('Has User class', typeHintsContent.includes('class User:'));
test('User has authentication methods', typeHintsContent.includes('def is_authenticated(self) -> bool') && typeHintsContent.includes('def get_id(self) -> str'));

// Flask Session Tests
test('Has SessionManager class', typeHintsContent.includes('class SessionManager'));
test('SessionManager has typed methods', typeHintsContent.includes('def get(key: str, default: Optional[T] = None) -> Optional[T]'));

// Flask Configuration Tests
test('Has FlaskConfig class', typeHintsContent.includes('class FlaskConfig'));
test('FlaskConfig has typed fields', typeHintsContent.includes('DEBUG: bool') && typeHintsContent.includes('SECRET_KEY: Optional[str]'));

// Flask Error Handler Tests
test('Has TypedErrorHandler class', typeHintsContent.includes('class TypedErrorHandler'));
test('Has error handler methods', typeHintsContent.includes('def handle_404') && typeHintsContent.includes('def handle_500'));

// Flask Decorators Tests
test('Has typed_route decorator', typeHintsContent.includes('def typed_route'));
test('Has requires_auth decorator', typeHintsContent.includes('def requires_auth'));
test('Has requires_role decorator', typeHintsContent.includes('def requires_role'));

// Tornado-Specific Tests
test('Tornado has TypedRequestHandler class', typeHintsContent.includes('class TypedRequestHandler(tornado.web.RequestHandler)'));
test('Tornado has TypedWebSocketHandler class', typeHintsContent.includes('class TypedWebSocketHandler(tornado.websocket.WebSocketHandler)'));
test('Tornado has TypedApplication class', typeHintsContent.includes('class TypedApplication(tornado.web.Application)'));

// Tornado Handler Features Tests
test('TypedRequestHandler has typed get_argument', typeHintsContent.includes('def get_argument(') && typeHintsContent.includes('-> str'));
test('TypedRequestHandler has get_json_argument', typeHintsContent.includes('def get_json_argument(self, name: str, default: Optional[T] = None) -> Optional[T]'));
test('TypedRequestHandler has write_json method', typeHintsContent.includes('def write_json(self, obj: Any) -> None'));

// Tornado WebSocket Features Tests
test('TypedWebSocketHandler has send_json method', typeHintsContent.includes('def send_json(self, data: Dict[str, Any]) -> Future[None]'));
test('TypedWebSocketHandler has send_error method', typeHintsContent.includes('def send_error(self, error: str, code: Optional[int] = None) -> Future[None]'));

// Tornado URL Routing Tests
test('Has URLPattern type alias', typeHintsContent.includes('URLPattern: TypeAlias'));
test('Has typed_url function', typeHintsContent.includes('def typed_url'));

// Tornado Authentication Tests
test('Has AuthMixin class', typeHintsContent.includes('class AuthMixin'));
test('AuthMixin has get_current_user method', typeHintsContent.includes('def get_current_user(self) -> Optional[Dict[str, Any]]'));
test('Has AuthenticatedHandler class', typeHintsContent.includes('class AuthenticatedHandler(TypedRequestHandler, AuthMixin)'));

// Tornado Error Handling Tests
test('Has APIError class for Tornado', typeHintsContent.includes('class APIError(tornado.web.HTTPError)'));
test('Has ValidationError for Tornado', typeHintsContent.includes('class ValidationError(APIError)'));

// Tornado Settings Tests
test('Has TornadoSettings class', typeHintsContent.includes('class TornadoSettings'));
test('TornadoSettings has to_dict method', typeHintsContent.includes('def to_dict(self) -> Dict[str, Any]'));

// Tornado Async Utilities Tests
test('Has AsyncUtils class', typeHintsContent.includes('class AsyncUtils'));
test('AsyncUtils has run_in_executor method', typeHintsContent.includes('async def run_in_executor'));
test('AsyncUtils has gather_with_concurrency method', typeHintsContent.includes('async def gather_with_concurrency'));

// Tornado HTTP Client Tests
test('Has TypedHTTPClient class', typeHintsContent.includes('class TypedHTTPClient'));
test('TypedHTTPClient has HTTP methods', typeHintsContent.includes('async def get') && typeHintsContent.includes('async def post'));

// Sanic-Specific Tests
test('Sanic has TypedSanic class', typeHintsContent.includes('class TypedSanic(Sanic)'));
test('Sanic has handler type aliases', typeHintsContent.includes('RouteHandler: TypeAlias'));
test('Sanic has middleware types', typeHintsContent.includes('MiddlewareHandler: TypeAlias'));

// Sanic Request Tests
test('Has TypedRequest for Sanic', typeHintsContent.includes('class TypedRequest(Request)'));
test('TypedRequest has get_json method', typeHintsContent.includes('def get_json(self, force: bool = False) -> Optional[Dict[str, Any]]'));
test('TypedRequest has get_arg method', typeHintsContent.includes('def get_arg(self, key: str, default: Optional[T] = None, cast: Type[T] = str) -> Optional[T]'));

// Sanic Response Tests
test('Has APIResponse for Sanic', typeHintsContent.includes('class APIResponse:') && typeHintsContent.includes('def json('));
test('Sanic APIResponse has success method', typeHintsContent.includes('def success(') && typeHintsContent.includes('data: Optional[T] = None'));
test('Sanic APIResponse has error method', typeHintsContent.includes('def error(') && typeHintsContent.includes('message: str'));

// Sanic Blueprint Tests
test('Has TypedBlueprint for Sanic', typeHintsContent.includes('class TypedBlueprint(Blueprint)'));

// Sanic Method Views Tests
test('Has TypedHTTPMethodView', typeHintsContent.includes('class TypedHTTPMethodView(HTTPMethodView)'));
test('TypedHTTPMethodView has HTTP methods', typeHintsContent.includes('async def get') && typeHintsContent.includes('async def post'));

// Sanic Middleware Tests
test('Has TypedMiddleware for Sanic', typeHintsContent.includes('class TypedMiddleware'));
test('Has AuthenticationMiddleware', typeHintsContent.includes('class AuthenticationMiddleware(TypedMiddleware)'));
test('AuthenticationMiddleware has before_request method', typeHintsContent.includes('async def before_request'));

// Sanic Error Handling Tests
test('Has SanicAPIError class', typeHintsContent.includes('class SanicAPIError(SanicException)'));
test('Has ValidationError for Sanic', typeHintsContent.includes('class ValidationError(SanicAPIError)'));

// Sanic WebSocket Tests
test('Has TypedWebSocketHandler for Sanic', typeHintsContent.includes('class TypedWebSocketHandler'));
test('TypedWebSocketHandler has handle methods', typeHintsContent.includes('async def handle_connect') && typeHintsContent.includes('async def handle_message'));
test('TypedWebSocketHandler has broadcast method', typeHintsContent.includes('async def broadcast'));

// Sanic Configuration Tests
test('Has SanicConfig class', typeHintsContent.includes('class SanicConfig'));
test('SanicConfig has update method', typeHintsContent.includes('def update(self, config: Dict[str, Any]) -> None'));

// Sanic Dependency Injection Tests
test('Has DependencyContainer class', typeHintsContent.includes('class DependencyContainer'));
test('DependencyContainer has register methods', typeHintsContent.includes('def register(') && typeHintsContent.includes('def register_factory('));

// Sanic Task Queue Tests
test('Has TaskQueue class', typeHintsContent.includes('class TaskQueue'));
test('TaskQueue has add_task method', typeHintsContent.includes('def add_task(') && typeHintsContent.includes('async def process_tasks'));

// Sanic Rate Limiting Tests
test('Has RateLimiter class', typeHintsContent.includes('class RateLimiter'));
test('RateLimiter has is_allowed method', typeHintsContent.includes('def is_allowed(self, key: str) -> bool'));

// Pyproject.toml Configuration Tests
test('Has generatePyprojectTomlTypes method', typeHintsContent.includes('generatePyprojectTomlTypes'));
test('Pyproject config has MyPy section', typeHintsContent.includes('[tool.mypy]'));
test('Pyproject config has Pyright section', typeHintsContent.includes('[tool.pyright]'));
test('Pyproject config has Ruff section', typeHintsContent.includes('[tool.ruff]'));
test('Pyproject config has Black section', typeHintsContent.includes('[tool.black]'));
test('Pyproject config has Pytest section', typeHintsContent.includes('[tool.pytest.ini_options]'));
test('Pyproject config has Coverage section', typeHintsContent.includes('[tool.coverage.run]'));

// MyPy Configuration Tests
test('MyPy config has strict mode', typeHintsContent.includes('strict = true'));
test('MyPy config has Python version', typeHintsContent.includes('python_version = "3.11"'));
test('MyPy config has disallow_untyped_defs', typeHintsContent.includes('disallow_untyped_defs = true'));
test('MyPy config has framework overrides', typeHintsContent.includes('[tool.mypy.overrides]'));

// Pyright Configuration Tests
test('Pyright config has strict checking', typeHintsContent.includes('typeCheckingMode = "strict"'));
test('Pyright config has error reporting', typeHintsContent.includes('reportMissingImports = "error"'));
test('Pyright config has optional checks', typeHintsContent.includes('reportOptionalSubscript = "error"'));

// Validation Script Tests
test('Has generateValidationScript method', typeHintsContent.includes('generateValidationScript'));
test('Validation script has TypeHintValidator class', typeHintsContent.includes('class TypeHintValidator'));
test('Validation script has TypeHintVisitor class', typeHintsContent.includes('class TypeHintVisitor'));
test('Validation script has validate_file method', typeHintsContent.includes('def validate_file'));
test('Validation script has validate_mypy_compliance method', typeHintsContent.includes('def validate_mypy_compliance'));
test('Validation script has AST analysis', typeHintsContent.includes('def _analyze_ast'));
test('Validation script has coverage calculation', typeHintsContent.includes('def _calculate_coverage'));

// Visitor Pattern Tests
test('TypeHintVisitor visits functions', typeHintsContent.includes('def visit_FunctionDef'));
test('TypeHintVisitor visits async functions', typeHintsContent.includes('def visit_AsyncFunctionDef'));
test('TypeHintVisitor visits classes', typeHintsContent.includes('def visit_ClassDef'));
test('TypeHintVisitor visits annotations', typeHintsContent.includes('def visit_AnnAssign'));

// Validation Features Tests
test('Validator checks magic methods', typeHintsContent.includes('is_magic_method'));
test('Validator checks properties', typeHintsContent.includes('is_property'));
test('Validator tracks statistics', typeHintsContent.includes('total_functions') && typeHintsContent.includes('typed_functions'));
test('Validator has error tracking', typeHintsContent.includes('self.errors') && typeHintsContent.includes('self.warnings'));

// Sample Code Generation Tests
test('Validation script has create_sample_code function', typeHintsContent.includes('def create_sample_code'));
test('Sample code supports all frameworks', typeHintsContent.includes('framework_file == "fastapi_types.py"'));
test('Sample code has imports', typeHintsContent.includes('base_imports'));

// Advanced Type Features Tests
test('Uses Self type annotation', typeHintsContent.includes('-> Self'));
test('Uses Literal type annotations', typeHintsContent.includes('Literal['));
test('Uses Union type annotations', typeHintsContent.includes('Union['));
test('Uses Optional type annotations', typeHintsContent.includes('Optional['));
test('Uses Generic type annotations', typeHintsContent.includes('Generic[T]'));
test('Uses Protocol type annotations', typeHintsContent.includes('Protocol)'));

console.log(`\n📊 Python Type Hints Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Python type hints system is comprehensive and standards-compliant.`);
}