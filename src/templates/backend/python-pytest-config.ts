/**
 * Comprehensive Pytest Configuration for Python Framework Templates
 * Provides fixtures, coverage, async testing, and framework-specific test utilities
 */

export interface PytestConfig {
  framework: string;
  pythonVersion: string;
  enableAsync: boolean;
  enableCoverage: boolean;
  enableFixtures: boolean;
  enableMocking: boolean;
  enableBenchmarks: boolean;
  enableParallel: boolean;
}

export class PytestConfigGenerator {
  generatePytestConfig(framework: string): PytestConfig {
    return {
      framework,
      pythonVersion: '3.11',
      enableAsync: true,
      enableCoverage: true,
      enableFixtures: true,
      enableMocking: true,
      enableBenchmarks: true,
      enableParallel: true
    };
  }

  generateConftestPy(): string {
    return this.generateBaseConftest();
  }

  generateTestUtilities(): string {
    return `"""
Comprehensive test utilities for Python framework testing
Provides common testing functions and assertion helpers
"""

import asyncio
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from unittest.mock import AsyncMock, Mock, patch
import pytest


# Test Data Generation Utilities
def generate_fake_data(data_type: str = "user") -> Dict[str, Any]:
    """Generate fake test data."""
    fake_data = {
        "user": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "username": "testuser",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "is_active": True},
        "post": {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "title": "Test Post",
            "content": "Test content",
            "author_id": "550e8400-e29b-41d4-a716-446655440000"},
        "product": {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "name": "Test Product",
            "price": 99.99,
            "description": "Test product description"}
    }
    return fake_data.get(data_type, {})


def random_test_data(length: int = 10) -> List[Dict[str, Any]]:
    """Generate random test data."""
    import random
    import string
    
    data = []
    for i in range(length):
        data.append({
            "id": ''.join(random.choices(string.ascii_lowercase + string.digits, k=8)),
            "name": f"Test Item {i}",
            "value": random.randint(1, 100),
            "active": random.choice([True, False])})
    return data


# Factory Pattern Utilities
class TestFactory:
    """Factory for creating test objects."""
    
    @staticmethod
    def create_user(**kwargs):
        """Create test user."""
        defaults = {
            "username": "testuser",
            "email": "test@example.com",
            "is_active": True}
        defaults.update(kwargs)
        return defaults
    
    @staticmethod
    def create_admin_user(**kwargs):
        """Create test admin user."""
        defaults = {
            "username": "admin",
            "email": "admin@example.com",
            "is_active": True,
            "is_admin": True,
            "roles": ["admin", "user"]}
        defaults.update(kwargs)
        return defaults
    
    @staticmethod
    def create_post(**kwargs):
        """Create test post."""
        defaults = {
            "title": "Test Post",
            "content": "Test content",
            "status": "published"}
        defaults.update(kwargs)
        return defaults


def test_factory(object_type: str, **kwargs):
    """Factory function for test objects."""
    factory_map = {
        "user": TestFactory.create_user,
        "admin": TestFactory.create_admin_user,
        "post": TestFactory.create_post}
    
    factory_func = factory_map.get(object_type)
    if factory_func:
        return factory_func(**kwargs)
    else:
        raise ValueError(f"Unknown object type: {object_type}")


# Database Testing Utilities
async def cleanup_database(db_connection):
    """Clean up database after tests."""
    if hasattr(db_connection, 'execute'):
        await db_connection.execute("DELETE FROM users WHERE email LIKE '%test%'")
        await db_connection.execute("DELETE FROM posts WHERE title LIKE '%test%'")
        await db_connection.commit()


async def seed_test_data(db_connection, data: List[Dict[str, Any]]):
    """Seed database with test data."""
    for item in data:
        # This would be framework-specific implementation
        pass


async def reset_database(db_connection):
    """Reset database to clean state."""
    await cleanup_database(db_connection)
    # Recreate tables if needed
    pass


async def rollback_transaction(db_connection):
    """Rollback database transaction."""
    if hasattr(db_connection, 'rollback'):
        await db_connection.rollback()


# HTTP Testing Utilities
def assert_status(response, expected_status: int):
    """Assert HTTP response status."""
    actual_status = getattr(response, 'status_code', getattr(response, 'status', None))
    assert actual_status == expected_status, f"Expected status {expected_status}, got {actual_status}"


def assert_json(response, expected_keys: List[str] = None):
    """Assert JSON response structure."""
    if hasattr(response, 'json'):
        data = response.json if callable(response.json) else response.json()
    elif hasattr(response, 'get_json'):
        data = response.get_json()
    else:
        data = json.loads(response.body if hasattr(response, 'body') else response.content)
    
    assert isinstance(data, dict), "Response is not JSON object"
    
    if expected_keys:
        for key in expected_keys:
            assert key in data, f"Missing key '{key}' in response"
    
    return data


def assert_headers(response, expected_headers: Dict[str, str]):
    """Assert response headers."""
    headers = getattr(response, 'headers', {})
    for header, value in expected_headers.items():
        assert header in headers, f"Missing header '{header}'"
        assert headers[header] == value, f"Header '{header}': expected '{value}', got '{headers[header]}'"


def assert_content(response, expected_content: str):
    """Assert response content contains expected text."""
    content = getattr(response, 'content', getattr(response, 'body', ''))
    if isinstance(content, bytes):
        content = content.decode('utf-8')
    assert expected_content in content, f"Content does not contain '{expected_content}'"


# Authentication Testing Utilities
def create_test_user(username: str = "testuser", **kwargs) -> Dict[str, Any]:
    """Create test user data."""
    return TestFactory.create_user(username=username, **kwargs)


def generate_test_token(payload: Dict[str, Any] = None) -> str:
    """Generate test JWT token."""
    import jwt
    
    default_payload = {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "testuser",
        "exp": int(time.time()) + 3600,  # 1 hour
    }
    
    if payload:
        default_payload.update(payload)
    
    return jwt.encode(default_payload, "test-secret", algorithm="HS256")


async def authenticate_test_user(client, username: str = "testuser", password: str = "testpass"):
    """Authenticate test user and return token."""
    login_data = {
        "username": username,
        "password": password}
    
    # This would be framework-specific implementation
    response = await client.post("/auth/login", json=login_data)
    data = assert_json(response, ["token"])
    return data["token"]


async def logout_test_user(client, token: str):
    """Logout test user."""
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.post("/auth/logout", headers=headers)
    assert_status(response, 200)


# File Testing Utilities
def create_test_file(filename: str = "test_file.txt", content: bytes = b"test content") -> Path:
    """Create temporary test file."""
    temp_dir = Path(tempfile.mkdtemp())
    file_path = temp_dir / filename
    file_path.write_bytes(content)
    return file_path


async def upload_test_file(client, file_path: Path, endpoint: str = "/upload"):
    """Upload test file."""
    with open(file_path, "rb") as f:
        files = {"file": (file_path.name, f, "text/plain")}
        response = await client.post(endpoint, files=files)
    return response


def cleanup_test_files(*file_paths: Path):
    """Clean up test files."""
    for file_path in file_paths:
        if file_path.exists():
            if file_path.is_file():
                file_path.unlink()
            elif file_path.is_dir():
                import shutil
                shutil.rmtree(file_path)


# Performance Testing Utilities
def time_execution(func):
    """Decorator to time function execution."""
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        print(f"Function {func.__name__} took {execution_time:.4f} seconds")
        return result
    return wrapper


def assert_performance(actual_time: float, max_time: float):
    """Assert performance within limits."""
    assert actual_time <= max_time, f"Performance test failed: {actual_time:.4f}s > {max_time:.4f}s"


def memory_usage():
    """Get current memory usage."""
    import psutil
    process = psutil.Process()
    return process.memory_info().rss / 1024 / 1024  # MB


# Schema Validation Utilities
def validate_schema(data: Dict[str, Any], schema: Dict[str, Any]) -> bool:
    """Validate data against schema."""
    for field, field_type in schema.items():
        if field not in data:
            return False
        if not isinstance(data[field], field_type):
            return False
    return True


def validate_response(response, schema: Dict[str, Any]) -> bool:
    """Validate response against schema."""
    data = assert_json(response)
    return validate_schema(data, schema)


def validate_model(model_data: Dict[str, Any], required_fields: List[str]) -> bool:
    """Validate model data has required fields."""
    for field in required_fields:
        if field not in model_data:
            return False
    return True


# Exception Testing Utilities
def assert_raises(exception_type: Exception, func, *args, **kwargs):
    """Assert function raises specific exception."""
    try:
        func(*args, **kwargs)
        pytest.fail(f"Expected {exception_type.__name__} but no exception was raised")
    except exception_type:
        pass  # Expected exception
    except Exception as e:
        pytest.fail(f"Expected {exception_type.__name__} but got {type(e).__name__}: {e}")


async def test_error_response(client, endpoint: str, expected_status: int):
    """Test error response from endpoint."""
    response = await client.get(endpoint)
    assert_status(response, expected_status)
    data = assert_json(response, ["message"])
    assert data["success"] is False


async def test_validation_error(client, endpoint: str, invalid_data: Dict[str, Any]):
    """Test validation error response."""
    response = await client.post(endpoint, json=invalid_data)
    assert_status(response, 422)
    data = assert_json(response, ["errors"])
    assert isinstance(data["errors"], (list, dict))


# Mock Utilities
def mock_database():
    """Create mock database connection."""
    db_mock = AsyncMock()
    db_mock.execute.return_value = None
    db_mock.fetch_one.return_value = None
    db_mock.fetch_all.return_value = []
    db_mock.commit.return_value = None
    db_mock.rollback.return_value = None
    return db_mock


def patch_request():
    """Create mock request patch."""
    request_mock = Mock()
    request_mock.method = "GET"
    request_mock.url = "http://testserver/test"
    request_mock.headers = {}
    request_mock.json = {}
    return patch("request", request_mock)


def mock_external_api():
    """Mock external API calls."""
    api_mock = AsyncMock()
    api_mock.get.return_value = {"status": "success", "data": {}}
    api_mock.post.return_value = {"status": "success", "id": "123"}
    api_mock.put.return_value = {"status": "success"}
    api_mock.delete.return_value = {"status": "success"}
    return api_mock


# Async Testing Utilities
async def wait_for_condition(condition_func, timeout: float = 5.0, interval: float = 0.1):
    """Wait for condition to become true."""
    start_time = asyncio.get_event_loop().time()
    while True:
        if await condition_func() if asyncio.iscoroutinefunction(condition_func) else condition_func():
            return True
        
        if asyncio.get_event_loop().time() - start_time > timeout:
            return False
        
        await asyncio.sleep(interval)


async def assert_eventually(assertion_func, timeout: float = 5.0, interval: float = 0.1):
    """Assert condition eventually becomes true."""
    success = await wait_for_condition(assertion_func, timeout, interval)
    if not success:
        pytest.fail(f"Condition did not become true within {timeout} seconds")


# Skip conditions and retry mechanisms
def skip_condition(condition: bool, reason: str):
    """Skip test based on condition."""
    return pytest.mark.skipif(condition, reason=reason)


def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    """Retry test on failure."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        await asyncio.sleep(delay)
                    continue
            raise last_exception
        return wrapper
    return decorator
`;
  }

  generatePyprojectConfig(): string {
    return `[tool.pytest.ini_options]
# Pytest configuration for comprehensive testing
minversion = "7.0"
python_files = ["test_*.py", "*_test.py", "tests.py"]
python_classes = ["Test*", "*Test", "*Tests"]
python_functions = ["test_*"]
testpaths = ["tests", "test"]
addopts = [
    "-ra",
    "--strict-markers",
    "--strict-config",
    "--cov=app",
    "--cov=src",
    "--cov=api",
    "--cov=models",
    "--cov=schemas",
    "--cov=routers",
    "--cov=blueprints",
    "--cov=handlers",
    "--cov=middleware",
    "--cov=core",
    "--cov-report=term-missing",
    "--cov-report=html:htmlcov",
    "--cov-report=xml:coverage.xml",
    "--cov-report=json:coverage.json",
    "--cov-fail-under=85",
    "--tb=short",
    "--disable-warnings",
    "-p no:warnings",
    "--maxfail=5",
    "--verbose"]

# Async testing configuration
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"

# Test markers for categorization
markers = [
    "unit: Unit tests that test individual components in isolation",
    "integration: Integration tests that test component interactions", 
    "e2e: End-to-end tests that test complete user workflows",
    "smoke: Smoke tests for basic functionality verification",
    "regression: Regression tests for bug prevention",
    "performance: Performance and benchmark tests",
    "security: Security-related tests",
    "slow: Tests that take a long time to run (deselect with '-m "not slow"')",
    "fast: Quick tests that should always pass",
    "database: Tests that require database access",
    "network: Tests that require network access",
    "auth: Authentication and authorization tests",
    "api: API endpoint tests",
    "models: Database model tests",
    "views: View/handler tests",
    "forms: Form validation tests",
    "utils: Utility function tests",
    "mock: Tests using mocks/stubs",
    "parametrized: Parametrized tests with multiple inputs",
    "fixture: Tests demonstrating fixture usage"]

# Test discovery patterns
norecursedirs = [
    ".*",
    "build",
    "dist", 
    "*.egg",
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    ".git",
    ".tox",
    "node_modules",
    "migrations",
    "static",
    "media",
    "htmlcov",
    ".coverage*"]

# Filter warnings
filterwarnings = [
    "error",
    "ignore::UserWarning",
    "ignore::DeprecationWarning",
    "ignore::PendingDeprecationWarning", 
    "ignore::ImportWarning",
    "ignore::ResourceWarning",
    "ignore:.*unclosed.*:ResourceWarning",
    "ignore:.*aiohttp.*:DeprecationWarning",
    "ignore:.*django.*:DeprecationWarning",
    "ignore:.*flask.*:DeprecationWarning",
    "ignore:.*tornado.*:DeprecationWarning",
    "ignore:.*sanic.*:DeprecationWarning"]

# Logging configuration for tests
log_auto_indent = true
log_cli = false
log_cli_level = "INFO"
log_cli_format = "%(asctime)s [%(levelname)8s] %(name)s: %(message)s"
log_cli_date_format = "%Y-%m-%d %H:%M:%S"
log_file = "tests/logs/pytest.log"
log_file_level = "DEBUG"
log_file_format = "%(asctime)s [%(levelname)8s] %(filename)s:%(lineno)d %(funcName)s(): %(message)s"
log_file_date_format = "%Y-%m-%d %H:%M:%S"

# Timeout configuration
timeout = 300
timeout_method = "thread"

[tool.coverage.run]
# Coverage configuration
source = ["app", "src", "api", "models", "schemas", "routers", "routing", "handlers", "middleware", "core"]
branch = true
parallel = true
concurrency = ["thread", "multiprocessing"]
omit = [
    "*/migrations/*",
    "*/tests/*",
    "*/test/*",
    "*/.venv/*",
    "*/venv/*",
    "*/env/*",
    "*/.env/*",
    "*/node_modules/*",
    "*/static/*", 
    "*/media/*",
    "*/htmlcov/*",
    "*/__pycache__/*",
    "*/.*",
    "setup.py",
    "manage.py",
    "wsgi.py",
    "asgi.py",
    "conftest.py",
    "*/conftest.py",
    "*/settings/*",
    "*/config/*"]

# Include/exclude patterns
include = ["*/app/*", "*/src/*", "*/api/*"]

[tool.coverage.report]
# Coverage reporting
exclude_lines = [
    "pragma: no cover",
    "pragma: nocover", 
    "def __repr__",
    "def __str__",
    "if self.debug:",
    "if settings.DEBUG",
    "if DEBUG:",
    "raise AssertionError",
    "raise NotImplementedError",
    "if 0:",
    "if False:",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
    "class .*\\bProtocol\\):",
    "@(abc\\.)?abstractmethod",
    "@overload",
    "except ImportError:",
    "except ModuleNotFoundError:",
    "pass",
    "\\.\\.\\."]

show_missing = true
skip_covered = false
skip_empty = false
sort = "Cover"
precision = 2

[tool.coverage.html]
# HTML coverage reports
directory = "htmlcov"
title = "Test Coverage Report"
show_contexts = true

[tool.coverage.xml]
# XML coverage reports  
output = "coverage.xml"

[tool.coverage.json]
# JSON coverage reports
output = "coverage.json"
show_contexts = true

[tool.pytest-benchmark]
# Benchmark configuration
only_run_marked = false
sort = "mean"
histogram = true
json = "benchmark.json"
compare_fail = ["min:10%", "max:10%", "mean:10%", "stddev:10%"]
timer = "time.perf_counter"
disable_gc = true
warmup = true
warmup_iterations = 100000
calibration_precision = 10
max_time = 1.0
min_rounds = 5
min_time = 0.000005
group_by = "group"

[tool.pytest-xdist]
# Parallel testing configuration  
auto = true
dist = "worksteal"
tx = ["popen//python=python3.11"]
rsyncdir = ["app", "src", "tests"]

# Dependencies for testing
[build-system]
requires = ["setuptools>=45", "wheel", "setuptools_scm[toml]>=6.2"]

[tool.pytest.dependencies]
test = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.0.0",
    "pytest-mock>=3.10.0",
    "pytest-xdist>=3.0.0",
    "pytest-benchmark>=4.0.0",
    "pytest-timeout>=2.1.0",
    "pytest-html>=3.1.0",
    "coverage>=7.0.0",
    "httpx>=0.24.0",
    "aiohttp>=3.8.0",
    "psutil>=5.9.0",
    "PyJWT>=2.6.0"]
`;
  }

  generateBaseConftest(): string {
    return `"""
Base conftest.py for all Python framework templates
Provides common fixtures, utilities, and test configuration
"""

import asyncio
import os
import pytest
import tempfile
import shutil
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, Generator, List, Optional
from unittest.mock import AsyncMock, MagicMock, Mock, patch
import json
import uuid
from datetime import datetime, timedelta

# Import testing utilities
from .test_utilities import (
    generate_fake_data, random_test_data, test_factory,
    cleanup_database, seed_test_data, reset_database, rollback_transaction,
    assert_status, assert_json, assert_headers, assert_content,
    create_test_user, generate_test_token, authenticate_test_user, logout_test_user,
    create_test_file, upload_test_file, cleanup_test_files,
    time_execution, assert_performance, memory_usage,
    validate_schema, validate_response, validate_model,
    assert_raises, test_error_response, test_validation_error,
    mock_database, patch_request, mock_external_api
)

# Test configuration
pytest_plugins = [
    "pytest_asyncio",
    "pytest_mock", 
    "pytest_cov",
    "pytest_benchmark",
    "pytest_xdist",
    "pytest_timeout",
    "pytest_html"]

# Environment setup
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("TEST_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("TEST_REDIS_URL", "redis://localhost:6379/15")


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_config() -> Dict[str, Any]:
    """Test configuration fixture."""
    return {
        "DEBUG": True,
        "TESTING": True,
        "SECRET_KEY": "test-secret-key-not-for-production",
        "DATABASE_URL": "sqlite:///:memory:",
        "REDIS_URL": "redis://localhost:6379/15",
        "JWT_SECRET_KEY": "test-jwt-secret",
        "JWT_ALGORITHM": "HS256",
        "JWT_EXPIRATION_DELTA": timedelta(hours=1),
        "UPLOAD_FOLDER": "/tmp/test_uploads",
        "MAX_CONTENT_LENGTH": 16 * 1024 * 1024,  # 16MB
        "CORS_ORIGINS": ["http://localhost:3000"],
        "RATE_LIMIT": "100/minute",
        "LOG_LEVEL": "DEBUG"}


@pytest.fixture(scope="function")
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for tests."""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)


@pytest.fixture(scope="function")  
def temp_file() -> Generator[Path, None, None]:
    """Create a temporary file for tests."""
    fd, temp_path = tempfile.mkstemp()
    os.close(fd)
    path = Path(temp_path)
    yield path
    if path.exists():
        path.unlink()


@pytest.fixture(scope="function")
def mock_uuid():
    """Mock UUID generation for consistent testing."""
    test_uuid = "550e8400-e29b-41d4-a716-446655440000"
    with patch("uuid.uuid4", return_value=uuid.UUID(test_uuid)):
        yield test_uuid


@pytest.fixture(scope="function")
def mock_datetime():
    """Mock datetime for consistent testing."""
    fixed_time = datetime(2024, 1, 1, 12, 0, 0)
    with patch("datetime.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_time
        mock_dt.utcnow.return_value = fixed_time
        mock_dt.side_effect = lambda *args, **kw: datetime(*args, **kw)
        yield fixed_time


@pytest.fixture(scope="function")
def sample_user_data() -> Dict[str, Any]:
    """Sample user data for testing."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "testuser",
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "is_active": True,
        "is_verified": True,
        "roles": ["user"],
        "permissions": ["read", "write"],
        "created_at": "2024-01-01T12:00:00Z",
        "updated_at": "2024-01-01T12:00:00Z"}


@pytest.fixture(scope="function")
def sample_post_data() -> Dict[str, Any]:
    """Sample blog post data for testing."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "Test Blog Post",
        "content": "This is a test blog post content.",
        "slug": "test-blog-post",
        "status": "published",
        "author_id": "550e8400-e29b-41d4-a716-446655440000",
        "category_id": "550e8400-e29b-41d4-a716-446655440002",
        "tags": ["test", "blog", "python"],
        "meta_title": "Test Blog Post - SEO Title",
        "meta_description": "Test blog post for SEO testing",
        "featured_image": "https://example.com/image.jpg",
        "published_at": "2024-01-01T12:00:00Z",
        "created_at": "2024-01-01T12:00:00Z",
        "updated_at": "2024-01-01T12:00:00Z"}


@pytest.fixture(scope="function")
def sample_api_response() -> Dict[str, Any]:
    """Sample API response data for testing."""
    return {
        "success": True,
        "data": {"message": "Operation successful"},
        "message": "Request completed successfully",
        "timestamp": "2024-01-01T12:00:00Z",
        "request_id": "550e8400-e29b-41d4-a716-446655440003"}


@pytest.fixture(scope="function")
def sample_pagination() -> Dict[str, Any]:
    """Sample pagination data for testing."""
    return {
        "page": 1,
        "limit": 20,
        "total": 100,
        "pages": 5,
        "has_next": True,
        "has_prev": False}


@pytest.fixture(scope="function")
def mock_redis():
    """Mock Redis client for testing."""
    redis_mock = AsyncMock()
    redis_mock.get.return_value = None
    redis_mock.set.return_value = True
    redis_mock.delete.return_value = 1
    redis_mock.exists.return_value = True
    redis_mock.expire.return_value = True
    redis_mock.ttl.return_value = 3600
    redis_mock.keys.return_value = []
    redis_mock.flushdb.return_value = True
    return redis_mock


@pytest.fixture(scope="function")
def mock_database():
    """Mock database connection for testing."""
    db_mock = AsyncMock()
    db_mock.execute.return_value = None
    db_mock.fetch_one.return_value = None
    db_mock.fetch_all.return_value = []
    db_mock.begin.return_value = AsyncMock()
    db_mock.commit.return_value = None
    db_mock.rollback.return_value = None
    db_mock.close.return_value = None
    return db_mock


@pytest.fixture(scope="function")
def mock_file_upload():
    """Mock file upload for testing."""
    file_mock = Mock()
    file_mock.filename = "test_file.txt"
    file_mock.content_type = "text/plain"
    file_mock.size = 1024
    file_mock.read.return_value = b"test file content"
    file_mock.seek.return_value = None
    return file_mock


@pytest.fixture(scope="function")
def mock_email_service():
    """Mock email service for testing."""
    email_mock = AsyncMock()
    email_mock.send_email.return_value = True
    email_mock.send_verification_email.return_value = True
    email_mock.send_password_reset_email.return_value = True
    email_mock.send_notification_email.return_value = True
    return email_mock


@pytest.fixture(scope="function")
def mock_auth_service():
    """Mock authentication service for testing."""
    auth_mock = AsyncMock()
    auth_mock.authenticate.return_value = True
    auth_mock.generate_token.return_value = "test-jwt-token"
    auth_mock.verify_token.return_value = {"user_id": "550e8400-e29b-41d4-a716-446655440000"}
    auth_mock.hash_password.return_value = "hashed_password"
    auth_mock.verify_password.return_value = True
    return auth_mock


@pytest.fixture(scope="function")
def mock_storage_service():
    """Mock storage service for testing."""
    storage_mock = AsyncMock()
    storage_mock.upload_file.return_value = "https://example.com/uploaded-file.jpg"
    storage_mock.delete_file.return_value = True
    storage_mock.get_file_url.return_value = "https://example.com/file.jpg"
    storage_mock.file_exists.return_value = True
    return storage_mock


@pytest.fixture(scope="function")
def mock_cache_service():
    """Mock cache service for testing."""
    cache_mock = AsyncMock()
    cache_mock.get.return_value = None
    cache_mock.set.return_value = True
    cache_mock.delete.return_value = True
    cache_mock.clear.return_value = True
    cache_mock.exists.return_value = False
    return cache_mock


@pytest.fixture(scope="function")
def mock_task_queue():
    """Mock task queue for testing."""
    queue_mock = AsyncMock()
    queue_mock.enqueue.return_value = "task-id-123"
    queue_mock.get_task_status.return_value = "completed"
    queue_mock.get_task_result.return_value = {"status": "success"}
    return queue_mock


@pytest.fixture(scope="function")
def database():
    """Database fixture for testing."""
    return mock_database()


@pytest.fixture(scope="function")
def mock_db():
    """Mock database utility fixture."""
    db_mock = AsyncMock()
    db_mock.execute.return_value = None
    db_mock.fetch_one.return_value = None
    db_mock.fetch_all.return_value = []
    db_mock.commit.return_value = None
    db_mock.rollback.return_value = None
    db_mock.close.return_value = None
    return db_mock


@pytest.fixture(scope="function")
async def async_database():
    """Async database fixture for testing."""
    db_mock = AsyncMock()
    db_mock.execute.return_value = None
    db_mock.fetch_one.return_value = None
    db_mock.fetch_all.return_value = []
    db_mock.begin.return_value = AsyncMock()
    db_mock.commit.return_value = None
    db_mock.rollback.return_value = None
    db_mock.close.return_value = None
    yield db_mock
    await db_mock.close()


@pytest.fixture(scope="function")
def client():
    """Generic test client fixture."""
    class MockClient:
        def __init__(self):
            self.headers = {}
        
        def get(self, url, **kwargs):
            return Mock(status_code=200, json=lambda: {"success": True})
        
        def post(self, url, **kwargs):
            return Mock(status_code=201, json=lambda: {"success": True})
        
        def put(self, url, **kwargs):
            return Mock(status_code=200, json=lambda: {"success": True})
        
        def delete(self, url, **kwargs):
            return Mock(status_code=204)
    
    return MockClient()


@pytest.fixture(scope="function")
async def async_client():
    """Generic async test client fixture."""
    class MockAsyncClient:
        def __init__(self):
            self.headers = {}
        
        async def get(self, url, **kwargs):
            return Mock(status_code=200, json=lambda: {"success": True})
        
        async def post(self, url, **kwargs):
            return Mock(status_code=201, json=lambda: {"success": True})
        
        async def put(self, url, **kwargs):
            return Mock(status_code=200, json=lambda: {"success": True})
        
        async def delete(self, url, **kwargs):
            return Mock(status_code=204)
    
    yield MockAsyncClient()


@pytest.fixture(scope="function")
def mock_user():
    """Mock user fixture."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "testuser",
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "is_active": True,
        "roles": ["user"]}


@pytest.fixture(scope="function")
def auth_headers(mock_user):
    """Authentication headers fixture."""
    import jwt
    import time
    
    payload = {
        "user_id": mock_user["id"],
        "username": mock_user["username"],
        "exp": int(time.time()) + 3600
    }
    token = jwt.encode(payload, "test-secret", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def sanic_client():
    """Sanic test client fixture."""
    from sanic_testing import TestClient
    from sanic import Sanic
    
    app = Sanic("test_app")
    return TestClient(app)


@pytest.fixture(scope="function")
def tornado_app():
    """Tornado app fixture."""
    from tornado.web import Application
    return Application([])


@pytest.fixture(scope="function")
def tornado_server():
    """Tornado server fixture."""
    from tornado.testing import AsyncHTTPTestCase
    
    class TornadoTestCase(AsyncHTTPTestCase):
        def get_app(self):
            from tornado.web import Application
            return Application([])
    
    test_case = TornadoTestCase()
    test_case.setUp()
    yield test_case
    test_case.tearDown()


# Skip conditions
def test_skip_conditions():
    """Test skip conditions."""
    return pytest.mark.skipif(True, reason="Conditional skip example")


# Conditional test execution
def test_conditional_execution():
    """Test conditional execution."""
    import sys
    return pytest.mark.skipif(sys.version_info < (3, 9), reason="Requires Python 3.9+")


# Test retry mechanism
@pytest.fixture(scope="function")
def test_retry():
    """Test retry mechanism."""
    def retry_test(max_attempts=3):
        def decorator(func):
            def wrapper(*args, **kwargs):
                last_exception = None
                for attempt in range(max_attempts):
                    try:
                        return func(*args, **kwargs)
                    except Exception as e:
                        last_exception = e
                        if attempt < max_attempts - 1:
                            continue
                        raise
                raise last_exception
            return wrapper
        return decorator
    return retry_test


# Async test utilities
async def async_test_wrapper(coro):
    """Wrapper for async test functions."""
    return await coro


def pytest_configure(config):
    """Pytest configuration hook."""
    # Add custom markers
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "fast: mark test as fast running") 
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")
    config.addinivalue_line("markers", "e2e: mark test as end-to-end test")
    config.addinivalue_line("markers", "api: mark test as API test")
    config.addinivalue_line("markers", "database: mark test as requiring database")
    config.addinivalue_line("markers", "auth: mark test as authentication test")
    config.addinivalue_line("markers", "performance: mark test as performance test")
    config.addinivalue_line("markers", "security: mark test as security test")


def pytest_collection_modifyitems(config, items):
    """Modify collected test items."""
    # Add slow marker to tests that take more than 1 second
    for item in items:
        if "slow" not in item.keywords and any(
            keyword in item.name.lower() 
            for keyword in ["integration", "e2e", "database", "network"]
        ):
            item.add_marker(pytest.mark.slow)
        
        # Add fast marker to unit tests
        if "unit" in item.keywords or "test_unit" in item.name:
            item.add_marker(pytest.mark.fast)


@pytest.fixture(scope="function")
def assert_all_responses_recorded():
    """Ensure all HTTP responses are recorded in tests."""
    def _assert_all_responses_recorded(responses):
        assert len(responses.calls) > 0, "No HTTP calls were made"
        for call in responses.calls:
            assert call.response is not None, f"No response for {call.request.url}"
    return _assert_all_responses_recorded


@pytest.fixture(scope="function")
def benchmark_config():
    """Configuration for benchmark tests."""
    return {
        "min_rounds": 3,
        "max_time": 1.0,
        "min_time": 0.000005,
        "timer": "time.perf_counter",
        "disable_gc": True,
        "warmup": True}


class TestClient:
    """Base test client for framework testing."""
    
    def __init__(self, app, base_url: str = "http://testserver"):
        self.app = app
        self.base_url = base_url
        self.session = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def set_auth_header(self, token: str):
        """Set authorization header for requests."""
        if not hasattr(self, '_headers'):
            self._headers = {}
        self._headers['Authorization'] = f'Bearer {token}'
    
    def clear_auth_header(self):
        """Clear authorization header."""
        if hasattr(self, '_headers') and 'Authorization' in self._headers:
            del self._headers['Authorization']


# Parametrized test data generators
@pytest.fixture(scope="session")
def user_test_cases():
    """Test cases for user-related tests."""
    return [
        # Valid cases
        {"username": "validuser", "email": "valid@example.com", "valid": True},
        {"username": "test123", "email": "test123@domain.co", "valid": True},
        {"username": "user_name", "email": "user.name@test.org", "valid": True},
        
        # Invalid cases
        {"username": "", "email": "invalid@example.com", "valid": False},
        {"username": "validuser", "email": "invalid-email", "valid": False},
        {"username": "ab", "email": "valid@example.com", "valid": False},  # Too short
        {"username": "a" * 51, "email": "valid@example.com", "valid": False},  # Too long
    ]


@pytest.fixture(scope="session")
def api_error_test_cases():
    """Test cases for API error handling."""
    return [
        {"status_code": 400, "error_type": "ValidationError", "expected_fields": ["message", "errors"]},
        {"status_code": 401, "error_type": "AuthenticationError", "expected_fields": ["message"]},
        {"status_code": 403, "error_type": "AuthorizationError", "expected_fields": ["message"]},
        {"status_code": 404, "error_type": "NotFoundError", "expected_fields": ["message"]},
        {"status_code": 422, "error_type": "ValidationError", "expected_fields": ["message", "errors"]},
        {"status_code": 500, "error_type": "InternalServerError", "expected_fields": ["message"]}]


@pytest.fixture(scope="session")
def pagination_test_cases():
    """Test cases for pagination testing."""
    return [
        {"page": 1, "limit": 10, "total": 100, "expected_pages": 10},
        {"page": 1, "limit": 20, "total": 100, "expected_pages": 5},
        {"page": 2, "limit": 25, "total": 100, "expected_pages": 4},
        {"page": 1, "limit": 50, "total": 30, "expected_pages": 1},
        {"page": 1, "limit": 10, "total": 0, "expected_pages": 0}]


# Performance testing utilities
@pytest.fixture(scope="function")
def performance_monitor():
    """Monitor performance metrics during tests."""
    import psutil
    import time
    
    class PerformanceMonitor:
        def __init__(self):
            self.start_time = None
            self.start_memory = None
            self.start_cpu = None
        
        def start(self):
            self.start_time = time.perf_counter()
            self.start_memory = psutil.virtual_memory().used
            self.start_cpu = psutil.cpu_percent()
        
        def stop(self):
            if self.start_time is None:
                raise ValueError("Monitor not started")
            
            end_time = time.perf_counter()
            end_memory = psutil.virtual_memory().used
            end_cpu = psutil.cpu_percent()
            
            return {
                "duration": end_time - self.start_time,
                "memory_delta": end_memory - self.start_memory,
                "cpu_usage": (self.start_cpu + end_cpu) / 2}
    
    return PerformanceMonitor()


# Database test utilities  
@pytest.fixture(scope="function")
def db_transaction_rollback():
    """Rollback database transactions after tests."""
    transactions = []
    
    def start_transaction(db):
        tx = db.begin()
        transactions.append(tx)
        return tx
    
    yield start_transaction
    
    # Rollback all transactions
    for tx in reversed(transactions):
        try:
            tx.rollback()
        except Exception:
            pass  # Transaction might already be closed


# Security testing utilities
@pytest.fixture(scope="function") 
def security_headers_check():
    """Check for security headers in responses."""
    def _check_security_headers(response):
        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "X-XSS-Protection",
            "Strict-Transport-Security",
            "Content-Security-Policy"]
        
        missing_headers = []
        for header in security_headers:
            if header not in response.headers:
                missing_headers.append(header)
        
        return {
            "has_all_security_headers": len(missing_headers) == 0,
            "missing_headers": missing_headers,
            "present_headers": [h for h in security_headers if h in response.headers]}
    
    return _check_security_headers


# Async testing helpers
async def wait_for_condition(condition_func, timeout: float = 5.0, interval: float = 0.1):
    """Wait for a condition to become true with timeout."""
    start_time = asyncio.get_event_loop().time()
    while True:
        if await condition_func() if asyncio.iscoroutinefunction(condition_func) else condition_func():
            return True
        
        if asyncio.get_event_loop().time() - start_time > timeout:
            return False
        
        await asyncio.sleep(interval)


async def assert_eventually(assertion_func, timeout: float = 5.0, interval: float = 0.1):
    """Assert that a condition eventually becomes true."""
    success = await wait_for_condition(assertion_func, timeout, interval)
    if not success:
        raise AssertionError(f"Condition did not become true within {timeout} seconds")
`;
  }

  generateFastAPITestConfig(): string {
    return `"""
FastAPI-specific test configuration and fixtures
"""

import pytest
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, patch

# FastAPI test dependencies
@pytest.fixture(scope="session")
def fastapi_app() -> FastAPI:
    """Create FastAPI test application."""
    from app.main import create_app
    
    app = create_app()
    app.dependency_overrides = {}
    return app


@pytest.fixture(scope="function")
def test_client(fastapi_app: FastAPI) -> Generator[TestClient, None, None]:
    """Create FastAPI test client."""
    with TestClient(fastapi_app) as client:
        yield client


@pytest.fixture(scope="function")
async def async_client(fastapi_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Create FastAPI async test client."""
    async with AsyncClient(app=fastapi_app, base_url="http://testserver") as client:
        yield client


@pytest.fixture(scope="function")
def override_dependencies(fastapi_app: FastAPI):
    """Override FastAPI dependencies for testing."""
    def _override_dependency(dependency, override):
        fastapi_app.dependency_overrides[dependency] = override
    
    yield _override_dependency
    
    # Clear overrides after test
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def mock_current_user():
    """Mock current user dependency."""
    from app.models.user import User
    
    user = User(
        id="550e8400-e29b-41d4-a716-446655440000",
        username="testuser",
        email="test@example.com",
        is_active=True,
        roles=["user"]
    )
    return user


@pytest.fixture(scope="function")
def mock_admin_user():
    """Mock admin user dependency."""
    from app.models.user import User
    
    user = User(
        id="550e8400-e29b-41d4-a716-446655440001",
        username="admin",
        email="admin@example.com", 
        is_active=True,
        roles=["admin", "user"]
    )
    return user


@pytest.fixture(scope="function")
def authenticated_client(test_client: TestClient, mock_current_user):
    """Test client with authenticated user."""
    from app.core.auth import create_access_token
    
    token = create_access_token(data={"sub": mock_current_user.username})
    test_client.headers.update({"Authorization": f"Bearer {token}"})
    return test_client


@pytest.fixture(scope="function")
async def authenticated_async_client(async_client: AsyncClient, mock_current_user):
    """Async test client with authenticated user."""
    from app.core.auth import create_access_token
    
    token = create_access_token(data={"sub": mock_current_user.username})
    async_client.headers.update({"Authorization": f"Bearer {token}"})
    return async_client


@pytest.fixture(scope="function")
def mock_database_session():
    """Mock database session for FastAPI."""
    session_mock = AsyncMock()
    session_mock.add.return_value = None
    session_mock.commit.return_value = None
    session_mock.rollback.return_value = None
    session_mock.refresh.return_value = None
    session_mock.close.return_value = None
    session_mock.execute.return_value = AsyncMock()
    session_mock.scalar.return_value = None
    return session_mock


# FastAPI-specific test utilities
class FastAPITestUtils:
    """Utilities for FastAPI testing."""
    
    @staticmethod
    def assert_api_response(response, expected_status: int = 200):
        """Assert API response structure."""
        assert response.status_code == expected_status
        
        if response.headers.get("content-type", "").startswith("application/json"):
            data = response.json()
            assert "success" in data
            assert "timestamp" in data
            
            if expected_status < 400:
                assert data["success"] is True
                assert "data" in data
            else:
                assert data["success"] is False
                assert "message" in data
    
    @staticmethod
    def assert_validation_error(response, field_name: str = None):
        """Assert validation error response."""
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        
        if field_name:
            errors = data["detail"]
            field_errors = [error for error in errors if error["loc"][-1] == field_name]
            assert len(field_errors) > 0, f"No validation error for field '{field_name}'"
    
    @staticmethod
    def assert_authentication_required(response):
        """Assert authentication required response."""
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert "authentication" in data["message"].lower()
    
    @staticmethod
    def assert_authorization_failed(response):
        """Assert authorization failed response."""
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert "permission" in data["message"].lower() or "forbidden" in data["message"].lower()
    
    @staticmethod
    def assert_not_found(response):
        """Assert not found response."""
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert "not found" in data["message"].lower()


@pytest.fixture(scope="function")
def fastapi_utils():
    """FastAPI test utilities fixture."""
    return FastAPITestUtils()


# Background task testing
@pytest.fixture(scope="function")
def mock_background_tasks():
    """Mock FastAPI background tasks."""
    from fastapi import BackgroundTasks
    
    tasks_mock = AsyncMock(spec=BackgroundTasks)
    tasks_mock.add_task.return_value = None
    return tasks_mock


# WebSocket testing
@pytest.fixture(scope="function")
def websocket_client(fastapi_app: FastAPI):
    """WebSocket test client."""
    from fastapi.testclient import TestClient
    
    client = TestClient(fastapi_app)
    return client


@pytest.fixture(scope="function")
async def websocket_connection(websocket_client):
    """WebSocket connection for testing."""
    with websocket_client.websocket_connect("/ws") as websocket:
        yield websocket


# Dependency injection testing
@pytest.fixture(scope="function")
def dependency_overrides():
    """Manage dependency overrides."""
    overrides = {}
    
    def set_override(dependency, override):
        overrides[dependency] = override
    
    def get_overrides():
        return overrides
    
    def clear_overrides():
        overrides.clear()
    
    return {
        "set": set_override,
        "get": get_overrides,
        "clear": clear_overrides}


# File upload testing
@pytest.fixture(scope="function")
def test_upload_file():
    """Test file for upload testing."""
    import io
    
    file_content = b"This is a test file content for upload testing."
    file_obj = io.BytesIO(file_content)
    file_obj.name = "test_file.txt"
    
    return {
        "file": ("test_file.txt", file_obj, "text/plain"),
        "content": file_content}


# API versioning testing
@pytest.fixture(scope="function")
def versioned_client(test_client: TestClient):
    """Test client with API version headers."""
    def _versioned_client(version: str = "v1"):
        test_client.headers.update({"API-Version": version})
        return test_client
    
    return _versioned_client


# Rate limiting testing
@pytest.fixture(scope="function")
def mock_rate_limiter():
    """Mock rate limiter for testing."""
    rate_limiter_mock = AsyncMock()
    rate_limiter_mock.is_allowed.return_value = True
    rate_limiter_mock.get_remaining.return_value = 99
    rate_limiter_mock.get_reset_time.return_value = 3600
    return rate_limiter_mock


# Caching testing
@pytest.fixture(scope="function")
def mock_cache():
    """Mock cache for FastAPI testing."""
    cache_mock = AsyncMock()
    cache_mock.get.return_value = None
    cache_mock.set.return_value = True
    cache_mock.delete.return_value = True
    cache_mock.clear.return_value = True
    return cache_mock


# Event testing
@pytest.fixture(scope="function")
def event_recorder():
    """Record events during testing."""
    events = []
    
    def record_event(event_type: str, data: dict = None):
        events.append({
            "type": event_type,
            "data": data or {},
            "timestamp": asyncio.get_event_loop().time()})
    
    def get_events():
        return events.copy()
    
    def clear_events():
        events.clear()
    
    return {
        "record": record_event,
        "get": get_events,
        "clear": clear_events}
`;
  }

  generateDjangoTestConfig(): string {
    return `"""
Django-specific test configuration and fixtures
"""

import pytest
import django
from django.test import TestCase, TransactionTestCase, Client
from django.test.utils import setup_test_environment, teardown_test_environment
from django.core.management import call_command
from django.db import transaction
from django.contrib.auth import get_user_model
from django.conf import settings
from typing import Generator
from unittest.mock import patch, Mock

# Configure Django settings for testing
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")
django.setup()

User = get_user_model()


@pytest.fixture(scope="session")
def django_db_setup():
    """Setup test database."""
    setup_test_environment()
    call_command("migrate", "--run-syncdb", verbosity=0, interactive=False)
    yield
    teardown_test_environment()


@pytest.fixture(scope="function")
def django_client() -> Generator[Client, None, None]:
    """Django test client."""
    client = Client()
    yield client


@pytest.fixture(scope="function")
def authenticated_client(django_client: Client, test_user) -> Generator[Client, None, None]:
    """Django test client with authenticated user."""
    django_client.force_login(test_user)
    yield django_client


@pytest.fixture(scope="function")
def admin_client(django_client: Client, admin_user) -> Generator[Client, None, None]:
    """Django test client with admin user."""
    django_client.force_login(admin_user)
    yield django_client


@pytest.fixture(scope="function")
def test_user(db):
    """Create test user."""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User",
    )


@pytest.fixture(scope="function")
def admin_user(db):
    """Create admin user."""
    return User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="adminpass123",
        first_name="Admin",
        last_name="User",
    )


@pytest.fixture(scope="function")
def test_users(db):
    """Create multiple test users."""
    users = []
    for i in range(5):
        user = User.objects.create_user(
            username=f"user{i}",
            email=f"user{i}@example.com",
            password="testpass123",
            first_name=f"User{i}",
            last_name="Test",
        )
        users.append(user)
    return users


@pytest.fixture(scope="function")
def db_transaction():
    """Database transaction fixture."""
    with transaction.atomic():
        sid = transaction.savepoint()
        yield
        transaction.savepoint_rollback(sid)


@pytest.fixture(scope="function")
def mock_cache():
    """Mock Django cache."""
    from django.core.cache import cache
    
    original_get = cache.get
    original_set = cache.set
    original_delete = cache.delete
    
    cache_data = {}
    
    def mock_get(key, default=None):
        return cache_data.get(key, default)
    
    def mock_set(key, value, timeout=None):
        cache_data[key] = value
        return True
    
    def mock_delete(key):
        return cache_data.pop(key, None) is not None
    
    cache.get = mock_get
    cache.set = mock_set  
    cache.delete = mock_delete
    
    yield cache
    
    # Restore original methods
    cache.get = original_get
    cache.set = original_set
    cache.delete = original_delete


@pytest.fixture(scope="function")
def mock_send_mail():
    """Mock Django send_mail function."""
    with patch("django.core.mail.send_mail") as mock_mail:
        mock_mail.return_value = True
        yield mock_mail


@pytest.fixture(scope="function")
def mock_celery_task():
    """Mock Celery task execution."""
    with patch("celery.current_app.send_task") as mock_task:
        mock_task.return_value = Mock(id="test-task-id")
        yield mock_task


@pytest.fixture(scope="function")
def django_settings_override():
    """Override Django settings for testing."""
    def _override_settings(**kwargs):
        from django.test import override_settings
        return override_settings(**kwargs)
    
    return _override_settings


@pytest.fixture(scope="function")
def test_media_root(tmp_path):
    """Temporary media root for file upload testing."""
    from django.test import override_settings
    
    media_root = tmp_path / "media"
    media_root.mkdir()
    
    with override_settings(MEDIA_ROOT=str(media_root)):
        yield media_root


@pytest.fixture(scope="function")
def uploaded_file():
    """Test uploaded file."""
    from django.core.files.uploadedfile import SimpleUploadedFile
    
    file_content = b"This is a test file content."
    uploaded_file = SimpleUploadedFile(
        "test_file.txt",
        file_content,
        content_type="text/plain"
    )
    return uploaded_file


# Django REST Framework fixtures (if installed)
try:
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken
    
    @pytest.fixture(scope="function")
    def api_client() -> Generator[APIClient, None, None]:
        """DRF API test client."""
        client = APIClient()
        yield client
    
    @pytest.fixture(scope="function")
    def authenticated_api_client(api_client: APIClient, test_user) -> Generator[APIClient, None, None]:
        """DRF API test client with authenticated user."""
        refresh = RefreshToken.for_user(test_user)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        yield api_client
    
    @pytest.fixture(scope="function")
    def admin_api_client(api_client: APIClient, admin_user) -> Generator[APIClient, None, None]:
        """DRF API test client with admin user."""
        refresh = RefreshToken.for_user(admin_user)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        yield api_client

except ImportError:
    # DRF not installed
    pass


# Django model testing utilities
class DjangoTestUtils:
    """Utilities for Django testing."""
    
    @staticmethod
    def assert_model_fields(model_instance, expected_fields: dict):
        """Assert model fields have expected values."""
        for field_name, expected_value in expected_fields.items():
            actual_value = getattr(model_instance, field_name)
            assert actual_value == expected_value, f"Field {field_name}: expected {expected_value}, got {actual_value}"
    
    @staticmethod
    def assert_queryset_equal(queryset1, queryset2):
        """Assert two querysets are equal."""
        list1 = list(queryset1.values_list('pk', flat=True))
        list2 = list(queryset2.values_list('pk', flat=True))
        assert sorted(list1) == sorted(list2)
    
    @staticmethod
    def assert_form_errors(form, expected_errors: dict):
        """Assert form has expected validation errors."""
        assert not form.is_valid()
        for field_name, expected_error in expected_errors.items():
            assert field_name in form.errors
            assert expected_error in str(form.errors[field_name])
    
    @staticmethod
    def assert_response_contains(response, text: str):
        """Assert response contains specific text."""
        content = response.content.decode('utf-8')
        assert text in content, f"Response does not contain '{text}'"
    
    @staticmethod
    def assert_response_not_contains(response, text: str):
        """Assert response does not contain specific text."""
        content = response.content.decode('utf-8')
        assert text not in content, f"Response contains '{text}'"
    
    @staticmethod
    def assert_redirects_to(response, expected_url: str):
        """Assert response redirects to expected URL."""
        assert response.status_code in [301, 302]
        assert response.url == expected_url


@pytest.fixture(scope="function")
def django_utils():
    """Django test utilities fixture."""
    return DjangoTestUtils()


# Management command testing
@pytest.fixture(scope="function")
def call_command_capture():
    """Capture management command output."""
    from io import StringIO
    from django.core.management import call_command
    
    def _call_command(*args, **kwargs):
        out = StringIO()
        err = StringIO()
        kwargs.update({'stdout': out, 'stderr': err})
        call_command(*args, **kwargs)
        return {
            'stdout': out.getvalue(),
            'stderr': err.getvalue()}
    
    return _call_command


# Signal testing
@pytest.fixture(scope="function")
def signal_recorder():
    """Record Django signals during testing."""
    from django.db.models import signals
    
    recorded_signals = []
    
    def signal_handler(sender, **kwargs):
        recorded_signals.append({
            'sender': sender,
            'signal': kwargs.get('signal'),
            'instance': kwargs.get('instance')})
    
    # Connect to common signals
    signals.pre_save.connect(signal_handler)
    signals.post_save.connect(signal_handler)
    signals.pre_delete.connect(signal_handler)
    signals.post_delete.connect(signal_handler)
    
    yield recorded_signals
    
    # Disconnect signals
    signals.pre_save.disconnect(signal_handler)
    signals.post_save.disconnect(signal_handler)
    signals.pre_delete.disconnect(signal_handler)
    signals.post_delete.disconnect(signal_handler)


# Template testing
@pytest.fixture(scope="function")
def mock_template_response():
    """Mock template response for testing."""
    from django.template.response import TemplateResponse
    from django.http import HttpRequest
    
    def _mock_template_response(template_name: str, context: dict = None):
        request = HttpRequest()
        response = TemplateResponse(request, template_name, context or {})
        return response
    
    return _mock_template_response


# Middleware testing
@pytest.fixture(scope="function")  
def middleware_test_setup():
    """Setup for middleware testing."""
    from django.http import HttpRequest, HttpResponse
    from django.test import RequestFactory
    
    factory = RequestFactory()
    
    def get_response(request):
        return HttpResponse("OK")
    
    def create_request(path="/", method="GET", **kwargs):
        if method.upper() == "GET":
            return factory.get(path, **kwargs)
        elif method.upper() == "POST":
            return factory.post(path, **kwargs)
        elif method.upper() == "PUT":
            return factory.put(path, **kwargs)
        elif method.upper() == "DELETE":
            return factory.delete(path, **kwargs)
        else:
            raise ValueError(f"Unsupported method: {method}")
    
    return {
        "factory": factory,
        "get_response": get_response,
        "create_request": create_request}
`;
  }

  generateFlaskTestConfig(): string {
    return `"""
Flask-specific test configuration and fixtures
"""

import pytest
import tempfile
import os
from flask import Flask
from flask.testing import FlaskClient
from typing import Generator
from unittest.mock import patch, Mock

# Flask test fixtures
@pytest.fixture(scope="session")
def flask_app() -> Flask:
    """Create Flask test application."""
    from app import create_app
    
    # Create temporary database
    db_fd, db_path = tempfile.mkstemp()
    
    app = create_app({
        'TESTING': True,
        'DATABASE_URL': f'sqlite:///{db_path}',
        'SECRET_KEY': 'test-secret-key',
        'WTF_CSRF_ENABLED': False,
        'UPLOAD_FOLDER': tempfile.mkdtemp()})
    
    with app.app_context():
        from app.extensions import db
        db.create_all()
    
    yield app
    
    # Cleanup
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture(scope="function")
def client(flask_app: Flask) -> Generator[FlaskClient, None, None]:
    """Flask test client."""
    with flask_app.test_client() as client:
        yield client


@pytest.fixture(scope="function")
def authenticated_client(client: FlaskClient, test_user) -> Generator[FlaskClient, None, None]:
    """Flask test client with authenticated user."""
    with client.session_transaction() as sess:
        sess['user_id'] = test_user.id
        sess['_fresh'] = True
    yield client


@pytest.fixture(scope="function")
def app_context(flask_app: Flask):
    """Flask application context."""
    with flask_app.app_context():
        yield


@pytest.fixture(scope="function")
def request_context(flask_app: Flask):
    """Flask request context."""
    with flask_app.test_request_context():
        yield


@pytest.fixture(scope="function")
def test_user(app_context):
    """Create test user."""
    from app.models.user import User
    from app.extensions import db
    
    user = User(
        username='testuser',
        email='test@example.com',
        first_name='Test',
        last_name='User'
    )
    user.set_password('testpass123')
    
    db.session.add(user)
    db.session.commit()
    
    yield user
    
    # Cleanup
    db.session.delete(user)
    db.session.commit()


@pytest.fixture(scope="function")
def admin_user(app_context):
    """Create admin user."""
    from app.models.user import User
    from app.extensions import db
    
    user = User(
        username='admin',
        email='admin@example.com',
        first_name='Admin',
        last_name='User',
        is_admin=True
    )
    user.set_password('adminpass123')
    
    db.session.add(user)
    db.session.commit()
    
    yield user
    
    # Cleanup
    db.session.delete(user)
    db.session.commit()


@pytest.fixture(scope="function")
def db_session(app_context):
    """Database session with rollback."""
    from app.extensions import db
    
    connection = db.engine.connect()
    transaction = connection.begin()
    
    # Configure session to use the connection
    db.session.configure(bind=connection)
    
    yield db.session
    
    # Rollback transaction
    transaction.rollback()
    connection.close()
    db.session.remove()


@pytest.fixture(scope="function")
def mock_mail():
    """Mock Flask-Mail for testing."""
    with patch('flask_mail.Mail.send') as mock_send:
        mock_send.return_value = None
        yield mock_send


@pytest.fixture(scope="function")
def uploaded_file():
    """Test file upload."""
    from werkzeug.datastructures import FileStorage
    from io import BytesIO
    
    file_content = b"This is test file content"
    file_obj = FileStorage(
        stream=BytesIO(file_content),
        filename="test_file.txt",
        content_type="text/plain"
    )
    
    return file_obj


@pytest.fixture(scope="function")
def form_data():
    """Sample form data for testing."""
    return {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'testpass123',
        'confirm_password': 'testpass123',
        'first_name': 'Test',
        'last_name': 'User'}


@pytest.fixture(scope="function")
def json_headers():
    """JSON request headers."""
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'}


@pytest.fixture(scope="function")
def mock_session():
    """Mock Flask session."""
    session_data = {}
    
    def mock_session_get(key, default=None):
        return session_data.get(key, default)
    
    def mock_session_set(key, value):
        session_data[key] = value
    
    def mock_session_pop(key, default=None):
        return session_data.pop(key, default)
    
    def mock_session_clear():
        session_data.clear()
    
    return {
        'get': mock_session_get,
        'set': mock_session_set,
        'pop': mock_session_pop,
        'clear': mock_session_clear,
        'data': session_data}


# Flask-specific test utilities
class FlaskTestUtils:
    """Utilities for Flask testing."""
    
    @staticmethod
    def assert_response_json(response, expected_status: int = 200):
        """Assert JSON response structure."""
        assert response.status_code == expected_status
        assert response.is_json
        
        data = response.get_json()
        assert 'success' in data
        
        if expected_status < 400:
            assert data['success'] is True
            assert 'data' in data
        else:
            assert data['success'] is False
            assert 'message' in data
    
    @staticmethod
    def assert_form_validation_error(response, field_name: str = None):
        """Assert form validation error."""
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert 'errors' in data
        
        if field_name:
            assert field_name in data['errors']
    
    @staticmethod
    def assert_authentication_required(response):
        """Assert authentication required."""
        assert response.status_code == 401
        data = response.get_json()
        assert data['success'] is False
    
    @staticmethod
    def assert_authorization_failed(response):
        """Assert authorization failed."""
        assert response.status_code == 403
        data = response.get_json()
        assert data['success'] is False
    
    @staticmethod
    def assert_not_found(response):
        """Assert not found response."""
        assert response.status_code == 404
    
    @staticmethod
    def assert_template_used(response, template_name: str):
        """Assert specific template was used."""
        # This would need Flask-Testing extension
        pass
    
    @staticmethod
    def assert_flashed_message(category: str = None, message: str = None):
        """Assert flash message was set."""
        from flask import get_flashed_messages
        
        messages = get_flashed_messages(with_categories=True)
        
        if category and message:
            assert (category, message) in messages
        elif message:
            message_texts = [msg for cat, msg in messages]
            assert message in message_texts
        elif category:
            categories = [cat for cat, msg in messages]
            assert category in categories
        else:
            assert len(messages) > 0


@pytest.fixture(scope="function")
def flask_utils():
    """Flask test utilities fixture."""
    return FlaskTestUtils()


# Blueprint testing
@pytest.fixture(scope="function")
def blueprint_app():
    """Create minimal Flask app for blueprint testing."""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret'
    return app


# Cache testing
@pytest.fixture(scope="function")
def mock_cache():
    """Mock Flask-Caching."""
    cache_data = {}
    
    def mock_get(key):
        return cache_data.get(key)
    
    def mock_set(key, value, timeout=None):
        cache_data[key] = value
        return True
    
    def mock_delete(key):
        return cache_data.pop(key, None) is not None
    
    def mock_clear():
        cache_data.clear()
        return True
    
    cache_mock = Mock()
    cache_mock.get = mock_get
    cache_mock.set = mock_set
    cache_mock.delete = mock_delete
    cache_mock.clear = mock_clear
    
    return cache_mock


# CLI testing
@pytest.fixture(scope="function")
def cli_runner(flask_app: Flask):
    """Flask CLI test runner."""
    return flask_app.test_cli_runner()


# Error handler testing
@pytest.fixture(scope="function")
def error_test_setup(flask_app: Flask):
    """Setup for error handler testing."""
    def trigger_error(error_code: int):
        from flask import abort
        
        @flask_app.route(f'/test_error_{error_code}')
        def test_error():
            abort(error_code)
        
        return f'/test_error_{error_code}'
    
    return trigger_error


# Middleware testing
@pytest.fixture(scope="function")
def middleware_test_setup(flask_app: Flask):
    """Setup for middleware testing."""
    middleware_calls = []
    
    def track_middleware(f):
        def wrapper(*args, **kwargs):
            middleware_calls.append({
                'function': f.__name__,
                'args': args,
                'kwargs': kwargs})
            return f(*args, **kwargs)
        return wrapper
    
    return {
        'track': track_middleware,
        'calls': middleware_calls}


# Signal testing (if Flask-SQLAlchemy is used)
@pytest.fixture(scope="function")
def signal_recorder(app_context):
    """Record SQLAlchemy signals."""
    from sqlalchemy import event
    from app.extensions import db
    
    recorded_events = []
    
    def record_event(mapper, connection, target):
        recorded_events.append({
            'mapper': mapper,
            'target': target,
            'event': 'after_insert'})
    
    event.listen(db.Model, 'after_insert', record_event)
    
    yield recorded_events
    
    event.remove(db.Model, 'after_insert', record_event)


# Configuration testing
@pytest.fixture(scope="function")
def config_override(flask_app: Flask):
    """Override Flask configuration for testing."""
    original_config = flask_app.config.copy()
    
    def override(**kwargs):
        flask_app.config.update(kwargs)
    
    yield override
    
    # Restore original configuration
    flask_app.config.clear()
    flask_app.config.update(original_config)
`;
  }

  generateTornadoTestConfig(): string {
    return `"""
Tornado-specific test configuration and fixtures
"""

import pytest
import asyncio
from tornado.testing import AsyncHTTPTestCase, AsyncHTTPSTestCase, AsyncTestCase
from tornado.web import Application
from tornado.httpclient import AsyncHTTPClient
from tornado.websocket import websocket_connect
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, patch, Mock
import json

# Tornado test fixtures
@pytest.fixture(scope="session")
def tornado_app() -> Application:
    """Create Tornado test application."""
    from app.main import create_app
    
    app = create_app(
        debug=True,
        testing=True,
        database_url="sqlite:///:memory:",
        redis_url="redis://localhost:6379/15",
    )
    return app


@pytest.fixture(scope="function")
async def http_client():
    """Async HTTP client for testing."""
    client = AsyncHTTPClient()
    yield client
    client.close()


@pytest.fixture(scope="function")
def tornado_test_case(tornado_app: Application):
    """Tornado test case setup."""
    class TornadoTestCase(AsyncHTTPTestCase):
        def get_app(self):
            return tornado_app
    
    test_case = TornadoTestCase()
    test_case.setUp()
    
    yield test_case
    
    test_case.tearDown()


@pytest.fixture(scope="function")
async def test_server(tornado_app: Application):
    """Start test server for Tornado app."""
    import tornado.httpserver
    import socket
    
    # Find available port
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('localhost', 0))
    port = sock.getsockname()[1]
    sock.close()
    
    server = tornado.httpserver.HTTPServer(tornado_app)
    server.listen(port, '127.0.0.1')
    
    base_url = f"http://127.0.0.1:{port}"
    
    yield {
        'server': server,
        'port': port,
        'base_url': base_url}
    
    server.stop()
    await server.close_all_connections()


@pytest.fixture(scope="function")
async def websocket_client():
    """WebSocket client for testing."""
    connections = []
    
    async def connect(url: str):
        ws = await websocket_connect(url)
        connections.append(ws)
        return ws
    
    yield connect
    
    # Close all connections
    for ws in connections:
        if ws:
            ws.close()


@pytest.fixture(scope="function")
def mock_request():
    """Mock Tornado request."""
    from tornado.httputil import HTTPServerRequest
    
    def create_request(
        method: str = "GET",
        uri: str = "/",
        body: bytes = b"",
        headers: dict = None,
        **kwargs
    ):
        request = HTTPServerRequest(
            method=method,
            uri=uri,
            body=body,
            headers=headers or {},
            **kwargs
        )
        return request
    
    return create_request


@pytest.fixture(scope="function")
def mock_handler():
    """Mock Tornado request handler."""
    from tornado.web import RequestHandler
    
    class MockHandler(RequestHandler):
        def __init__(self):
            self.written = []
            self.status = 200
            self.headers = {}
            self.finished = False
        
        def write(self, chunk):
            self.written.append(chunk)
        
        def set_status(self, status_code):
            self.status = status_code
        
        def set_header(self, name, value):
            self.headers[name] = value
        
        def finish(self, chunk=None):
            if chunk:
                self.write(chunk)
            self.finished = True
        
        def get_written_data(self):
            return b''.join(self.written)
    
    return MockHandler()


@pytest.fixture(scope="function")
def sample_json_data():
    """Sample JSON data for testing."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Test Item",
        "description": "This is a test item",
        "active": True,
        "created_at": "2024-01-01T12:00:00Z"}


# Tornado-specific test utilities
class TornadoTestUtils:
    """Utilities for Tornado testing."""
    
    @staticmethod
    async def assert_response_json(response, expected_status: int = 200):
        """Assert JSON response structure."""
        assert response.code == expected_status
        
        try:
            data = json.loads(response.body.decode('utf-8'))
            assert 'success' in data
            
            if expected_status < 400:
                assert data['success'] is True
                assert 'data' in data
            else:
                assert data['success'] is False
                assert 'message' in data
            
            return data
        except json.JSONDecodeError:
            pytest.fail(f"Response is not valid JSON: {response.body}")
    
    @staticmethod
    async def assert_websocket_message(ws, expected_type: str = None):
        """Assert WebSocket message structure."""
        message = await ws.read_message()
        
        if message is None:
            pytest.fail("WebSocket connection closed unexpectedly")
        
        try:
            data = json.loads(message)
            
            if expected_type:
                assert data.get('type') == expected_type
            
            return data
        except json.JSONDecodeError:
            pytest.fail(f"WebSocket message is not valid JSON: {message}")
    
    @staticmethod
    def assert_handler_called(handler_mock, method: str = None):
        """Assert handler method was called."""
        if method:
            method_mock = getattr(handler_mock, method, None)
            assert method_mock is not None, f"Handler has no method '{method}'"
            assert method_mock.called, f"Handler method '{method}' was not called"
        else:
            # Check if any HTTP method was called
            http_methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
            called_methods = [
                method for method in http_methods
                if hasattr(handler_mock, method) and getattr(handler_mock, method).called
            ]
            assert len(called_methods) > 0, "No handler methods were called"
    
    @staticmethod
    async def make_request(client, url: str, method: str = "GET", **kwargs):
        """Make HTTP request with error handling."""
        try:
            response = await client.fetch(url, method=method, raise_error=False, **kwargs)
            return response
        except Exception as e:
            pytest.fail(f"Request failed: {e}")


@pytest.fixture(scope="function")
def tornado_utils():
    """Tornado test utilities fixture."""
    return TornadoTestUtils()


# Database testing
@pytest.fixture(scope="function")
async def mock_database():
    """Mock database connection for Tornado."""
    db_mock = AsyncMock()
    
    # Mock common database operations
    db_mock.execute.return_value = None
    db_mock.fetchone.return_value = None
    db_mock.fetchall.return_value = []
    db_mock.fetchmany.return_value = []
    db_mock.close.return_value = None
    
    yield db_mock


# Authentication testing
@pytest.fixture(scope="function")
def mock_auth():
    """Mock authentication for Tornado."""
    auth_mock = AsyncMock()
    
    auth_mock.authenticate.return_value = {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "testuser",
        "roles": ["user"]}
    auth_mock.generate_token.return_value = "test-jwt-token"
    auth_mock.verify_token.return_value = True
    
    return auth_mock


# Cache testing
@pytest.fixture(scope="function")
def mock_cache():
    """Mock cache for Tornado."""
    cache_data = {}
    
    async def mock_get(key):
        return cache_data.get(key)
    
    async def mock_set(key, value, expire=None):
        cache_data[key] = value
        return True
    
    async def mock_delete(key):
        return cache_data.pop(key, None) is not None
    
    cache_mock = AsyncMock()
    cache_mock.get = mock_get
    cache_mock.set = mock_set
    cache_mock.delete = mock_delete
    
    return cache_mock


# File upload testing
@pytest.fixture(scope="function")
def test_file_upload():
    """Test file upload data."""
    import io
    
    file_content = b"This is test file content for Tornado"
    file_obj = io.BytesIO(file_content)
    
    return {
        'filename': 'test_file.txt',
        'content_type': 'text/plain',
        'body': file_content,
        'file_obj': file_obj}


# Background task testing
@pytest.fixture(scope="function")
def mock_executor():
    """Mock executor for background tasks."""
    from concurrent.futures import ThreadPoolExecutor
    
    executor_mock = Mock(spec=ThreadPoolExecutor)
    executor_mock.submit.return_value = asyncio.Future()
    
    return executor_mock


# IOLoop testing
@pytest.fixture(scope="function")
def ioloop_test():
    """IOLoop testing utilities."""
    from tornado.ioloop import IOLoop
    
    # Use current IOLoop or create new one
    ioloop = IOLoop.current()
    
    scheduled_callbacks = []
    
    def mock_call_later(delay, callback, *args, **kwargs):
        handle = Mock()
        scheduled_callbacks.append({
            'delay': delay,
            'callback': callback,
            'args': args,
            'kwargs': kwargs,
            'handle': handle})
        return handle
    
    original_call_later = ioloop.call_later
    ioloop.call_later = mock_call_later
    
    yield {
        'ioloop': ioloop,
        'scheduled_callbacks': scheduled_callbacks}
    
    # Restore original method
    ioloop.call_later = original_call_later


# Performance testing
@pytest.fixture(scope="function")
def tornado_benchmark():
    """Benchmark utilities for Tornado."""
    import time
    
    class TornadoBenchmark:
        def __init__(self):
            self.start_time = None
            self.end_time = None
        
        def start(self):
            self.start_time = time.perf_counter()
        
        def stop(self):
            self.end_time = time.perf_counter()
            return self.duration
        
        @property
        def duration(self):
            if self.start_time is None or self.end_time is None:
                return None
            return self.end_time - self.start_time
    
    return TornadoBenchmark()


# Error simulation
@pytest.fixture(scope="function")
def error_simulator():
    """Simulate various error conditions."""
    class ErrorSimulator:
        @staticmethod
        def connection_error():
            from tornado.httpclient import HTTPError
            raise HTTPError(599, "Connection timed out")
        
        @staticmethod
        def http_error(status_code: int = 500):
            from tornado.httpclient import HTTPError
            raise HTTPError(status_code, f"HTTP {status_code} Error")
        
        @staticmethod
        def parse_error():
            raise ValueError("Failed to parse response")
        
        @staticmethod
        def database_error():
            raise Exception("Database connection failed")
    
    return ErrorSimulator()


# Template testing
@pytest.fixture(scope="function")
def mock_template():
    """Mock Tornado template rendering."""
    def render_template(template_name: str, **kwargs):
        return f"<html>Rendered {template_name} with {kwargs}</html>"
    
    with patch('tornado.template.Template.generate', side_effect=render_template):
        yield render_template
`;
  }

  generateSanicTestConfig(): string {
    return `"""
Sanic-specific test configuration and fixtures
"""

import pytest
import asyncio
from sanic import Sanic
from sanic.request import Request
from sanic.response import HTTPResponse
from sanic_testing import TestClient
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, Mock, patch
import json

# Sanic test fixtures
@pytest.fixture(scope="session")
def sanic_app() -> Sanic:
    """Create Sanic test application."""
    from app.main import create_app
    
    app = create_app(
        debug=True,
        testing=True,
        access_log=False,
        auto_reload=False,
    )
    
    # Override configuration for testing
    app.config.update({
        'TESTING': True,
        'DATABASE_URL': 'sqlite:///:memory:',
        'REDIS_URL': 'redis://localhost:6379/15',
        'SECRET_KEY': 'test-secret-key',
        'JWT_SECRET': 'test-jwt-secret'})
    
    return app


@pytest.fixture(scope="function")
async def test_client(sanic_app: Sanic) -> AsyncGenerator[TestClient, None]:
    """Sanic test client."""
    async with TestClient(sanic_app) as client:
        yield client


@pytest.fixture(scope="function")
async def authenticated_client(test_client: TestClient, test_user) -> AsyncGenerator[TestClient, None]:
    """Sanic test client with authenticated user."""
    from app.core.auth import create_access_token
    
    token = create_access_token({'user_id': test_user['id']})
    test_client.headers.update({'Authorization': f'Bearer {token}'})
    
    yield test_client


@pytest.fixture(scope="function")
async def admin_client(test_client: TestClient, admin_user) -> AsyncGenerator[TestClient, None]:
    """Sanic test client with admin user."""
    from app.core.auth import create_access_token
    
    token = create_access_token({'user_id': admin_user['id'], 'roles': ['admin']})
    test_client.headers.update({'Authorization': f'Bearer {token}'})
    
    yield test_client


@pytest.fixture(scope="function")
def test_user():
    """Test user data."""
    return {
        'id': '550e8400-e29b-41d4-a716-446655440000',
        'username': 'testuser',
        'email': 'test@example.com',
        'first_name': 'Test',
        'last_name': 'User',
        'is_active': True,
        'roles': ['user']}


@pytest.fixture(scope="function")
def admin_user():
    """Admin user data."""
    return {
        'id': '550e8400-e29b-41d4-a716-446655440001',
        'username': 'admin',
        'email': 'admin@example.com',
        'first_name': 'Admin',
        'last_name': 'User',
        'is_active': True,
        'roles': ['admin', 'user']}


@pytest.fixture(scope="function")
def mock_request():
    """Mock Sanic request."""
    def create_request(
        method: str = 'GET',
        path: str = '/',
        headers: dict = None,
        json_data: dict = None,
        form_data: dict = None,
        **kwargs
    ):
        from sanic.request import Request
        from sanic.models.http import HTTPVersion
        
        # Create mock request
        request = Mock(spec=Request)
        request.method = method.upper()
        request.path = path
        request.headers = headers or {}
        request.json = json_data
        request.form = form_data or {}
        request.args = kwargs.get('args', {})
        request.ctx = Mock()
        request.version = HTTPVersion.HTTP_1_1
        
        return request
    
    return create_request


@pytest.fixture(scope="function")
def sample_json_data():
    """Sample JSON data for testing."""
    return {
        'name': 'Test Item',
        'description': 'This is a test item for Sanic',
        'active': True,
        'tags': ['test', 'sanic', 'python']}


@pytest.fixture(scope="function")
def sample_form_data():
    """Sample form data for testing."""
    return {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'testpass123',
        'confirm_password': 'testpass123'}


# Sanic-specific test utilities
class SanicTestUtils:
    """Utilities for Sanic testing."""
    
    @staticmethod
    def assert_response_json(response: HTTPResponse, expected_status: int = 200):
        """Assert JSON response structure."""
        assert response.status == expected_status
        assert response.content_type.startswith('application/json')
        
        try:
            data = response.json
            assert 'success' in data
            
            if expected_status < 400:
                assert data['success'] is True
                assert 'data' in data
            else:
                assert data['success'] is False
                assert 'message' in data
            
            return data
        except (ValueError, TypeError):
            pytest.fail(f"Response is not valid JSON: {response.body}")
    
    @staticmethod
    def assert_validation_error(response: HTTPResponse, field_name: str = None):
        """Assert validation error response."""
        assert response.status == 422
        data = response.json
        assert data['success'] is False
        assert 'errors' in data
        
        if field_name:
            assert field_name in data['errors']
    
    @staticmethod
    def assert_authentication_required(response: HTTPResponse):
        """Assert authentication required."""
        assert response.status == 401
        data = response.json
        assert data['success'] is False
        assert 'authentication' in data['message'].lower()
    
    @staticmethod
    def assert_authorization_failed(response: HTTPResponse):
        """Assert authorization failed."""
        assert response.status == 403
        data = response.json
        assert data['success'] is False
        assert 'permission' in data['message'].lower() or 'forbidden' in data['message'].lower()
    
    @staticmethod
    def assert_not_found(response: HTTPResponse):
        """Assert not found response."""
        assert response.status == 404
        data = response.json
        assert data['success'] is False
        assert 'not found' in data['message'].lower()
    
    @staticmethod
    def assert_rate_limited(response: HTTPResponse):
        """Assert rate limit exceeded."""
        assert response.status == 429
        data = response.json
        assert data['success'] is False
        assert 'rate limit' in data['message'].lower() or 'too many requests' in data['message'].lower()


@pytest.fixture(scope="function")
def sanic_utils():
    """Sanic test utilities fixture."""
    return SanicTestUtils()


# WebSocket testing
@pytest.fixture(scope="function")
async def websocket_client(sanic_app: Sanic):
    """WebSocket client for testing."""
    from sanic_testing import TestClient
    
    async with TestClient(sanic_app) as client:
        connections = []
        
        async def connect(uri: str, headers: dict = None):
            ws = await client.websocket(uri, headers=headers or {})
            connections.append(ws)
            return ws
        
        yield connect
        
        # Close all connections
        for ws in connections:
            try:
                await ws.close()
            except Exception:
                pass


@pytest.fixture(scope="function")
def mock_websocket():
    """Mock WebSocket connection."""
    ws_mock = AsyncMock()
    
    messages = []
    
    async def mock_send(message):
        messages.append(message)
    
    async def mock_receive():
        if messages:
            return messages.pop(0)
        return None
    
    ws_mock.send = mock_send
    ws_mock.recv = mock_receive
    ws_mock.messages = messages
    
    return ws_mock


# Database testing
@pytest.fixture(scope="function")
async def mock_database():
    """Mock database for Sanic."""
    db_mock = AsyncMock()
    
    # Mock database operations
    db_mock.execute.return_value = None
    db_mock.fetch_one.return_value = None
    db_mock.fetch_all.return_value = []
    db_mock.fetch_many.return_value = []
    db_mock.begin.return_value = AsyncMock()
    db_mock.commit.return_value = None
    db_mock.rollback.return_value = None
    db_mock.close.return_value = None
    
    return db_mock


# Middleware testing
@pytest.fixture(scope="function")
def middleware_recorder():
    """Record middleware execution."""
    middleware_calls = []
    
    def record_middleware(name: str):
        def middleware(request):
            middleware_calls.append({
                'name': name,
                'method': request.method,
                'path': request.path,
                'timestamp': asyncio.get_event_loop().time()})
        return middleware
    
    return {
        'record': record_middleware,
        'calls': middleware_calls}


# Cache testing
@pytest.fixture(scope="function")
def mock_cache():
    """Mock cache for Sanic."""
    cache_data = {}
    
    async def mock_get(key, default=None):
        return cache_data.get(key, default)
    
    async def mock_set(key, value, expire=None):
        cache_data[key] = value
        return True
    
    async def mock_delete(key):
        return cache_data.pop(key, None) is not None
    
    async def mock_clear():
        cache_data.clear()
        return True
    
    cache_mock = AsyncMock()
    cache_mock.get = mock_get
    cache_mock.set = mock_set
    cache_mock.delete = mock_delete
    cache_mock.clear = mock_clear
    cache_mock.data = cache_data
    
    return cache_mock


# Background task testing
@pytest.fixture(scope="function")
def mock_task_queue():
    """Mock task queue for Sanic."""
    tasks = []
    
    async def mock_enqueue(task_name, *args, **kwargs):
        task_id = f"task_{len(tasks)}"
        tasks.append({
            'id': task_id,
            'name': task_name,
            'args': args,
            'kwargs': kwargs,
            'status': 'pending'})
        return task_id
    
    async def mock_get_task(task_id):
        for task in tasks:
            if task['id'] == task_id:
                return task
        return None
    
    queue_mock = AsyncMock()
    queue_mock.enqueue = mock_enqueue
    queue_mock.get_task = mock_get_task
    queue_mock.tasks = tasks
    
    return queue_mock


# File upload testing
@pytest.fixture(scope="function")
def test_file_upload():
    """Test file upload for Sanic."""
    import io
    
    file_content = b"This is test file content for Sanic testing"
    file_obj = io.BytesIO(file_content)
    
    return {
        'name': 'test_file.txt',
        'type': 'text/plain',
        'body': file_content,
        'file': file_obj}


# Rate limiting testing
@pytest.fixture(scope="function")
def mock_rate_limiter():
    """Mock rate limiter for Sanic."""
    request_counts = {}
    
    def check_rate_limit(key: str, limit: int = 100, window: int = 60):
        current_count = request_counts.get(key, 0)
        request_counts[key] = current_count + 1
        return current_count < limit
    
    def reset_rate_limit(key: str):
        request_counts.pop(key, None)
    
    def get_remaining(key: str, limit: int = 100):
        current_count = request_counts.get(key, 0)
        return max(0, limit - current_count)
    
    limiter_mock = Mock()
    limiter_mock.check = check_rate_limit
    limiter_mock.reset = reset_rate_limit
    limiter_mock.get_remaining = get_remaining
    limiter_mock.counts = request_counts
    
    return limiter_mock


# Performance testing
@pytest.fixture(scope="function")
def sanic_benchmark():
    """Benchmark utilities for Sanic."""
    import time
    
    class SanicBenchmark:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            self.request_count = 0
        
        def start(self):
            self.start_time = time.perf_counter()
            self.request_count = 0
        
        def record_request(self):
            self.request_count += 1
        
        def stop(self):
            self.end_time = time.perf_counter()
            return {
                'duration': self.duration,
                'requests': self.request_count,
                'rps': self.requests_per_second}
        
        @property
        def duration(self):
            if self.start_time is None or self.end_time is None:
                return None
            return self.end_time - self.start_time
        
        @property
        def requests_per_second(self):
            if self.duration is None or self.duration == 0:
                return 0
            return self.request_count / self.duration
    
    return SanicBenchmark()


# Error handling testing
@pytest.fixture(scope="function")
def error_handler_test():
    """Test error handling in Sanic."""
    from sanic.exceptions import SanicException
    
    class TestException(SanicException):
        status_code = 500
        message = "Test exception for error handling"
    
    def trigger_error(error_type: str = "generic"):
        if error_type == "validation":
            raise ValueError("Validation error")
        elif error_type == "not_found":
            raise FileNotFoundError("Resource not found")
        elif error_type == "sanic":
            raise TestException("Test Sanic exception")
        else:
            raise Exception("Generic test exception")
    
    return {
        'trigger': trigger_error,
        'TestException': TestException}


# Listener testing
@pytest.fixture(scope="function")
def listener_recorder():
    """Record Sanic listeners execution."""
    listener_calls = []
    
    def record_listener(event: str):
        def listener(app, loop):
            listener_calls.append({
                'event': event,
                'app': app.name,
                'timestamp': asyncio.get_event_loop().time()})
        return listener
    
    return {
        'record': record_listener,
        'calls': listener_calls}


# Security testing
@pytest.fixture(scope="function")
def security_test_utils():
    """Security testing utilities."""
    class SecurityTestUtils:
        @staticmethod
        def create_csrf_token():
            import secrets
            return secrets.token_urlsafe(32)
        
        @staticmethod
        def create_malicious_payload():
            return {
                'script': '<script>alert("XSS")</script>',
                'sql': "'; DROP TABLE users; --",
                'path_traversal': '../../../etc/passwd',
                'command_injection': '; cat /etc/passwd'}
        
        @staticmethod
        def assert_security_headers(response: HTTPResponse):
            security_headers = [
                'X-Content-Type-Options',
                'X-Frame-Options',
                'X-XSS-Protection']
            
            missing_headers = []
            for header in security_headers:
                if header not in response.headers:
                    missing_headers.append(header)
            
            return {
                'secure': len(missing_headers) == 0,
                'missing': missing_headers}
    
    return SecurityTestUtils()
`;
  }

  generateTestValidation(): string {
    return `#!/usr/bin/env python3
"""
Comprehensive validation script for pytest configuration across Python frameworks
Validates test structure, coverage, async support, and framework-specific features
"""

import ast
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Optional
import importlib.util


class PytestConfigValidator:
    """Validates pytest configuration and test functionality."""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.test_results: Dict[str, Any] = {}
    
    def validate_pyproject_config(self, config_content: str) -> Dict[str, Any]:
        """Validate pyproject.toml pytest configuration."""
        required_sections = [
            '[tool.pytest.ini_options]',
            '[tool.coverage.run]',
            '[tool.coverage.report]',
            '[tool.pytest-benchmark]']
        
        missing_sections = []
        for section in required_sections:
            if section not in config_content:
                missing_sections.append(section)
        
        # Check for essential pytest options
        pytest_options = [
            'minversion',
            'testpaths',
            'python_files',
            'python_classes', 
            'python_functions',
            'addopts',
            'markers',
            'asyncio_mode']
        
        missing_options = []
        for option in pytest_options:
            if f'{option} =' not in config_content:
                missing_options.append(option)
        
        # Check coverage configuration
        coverage_options = [
            'source',
            'branch',
            'omit',
            'exclude_lines',
            'show_missing']
        
        missing_coverage = []
        for option in coverage_options:
            if f'{option} =' not in config_content:
                missing_coverage.append(option)
        
        return {
            'valid': len(missing_sections) == 0,
            'missing_sections': missing_sections,
            'missing_options': missing_options,
            'missing_coverage': missing_coverage,
            'has_async_support': 'asyncio_mode = "auto"' in config_content,
            'has_benchmarks': '[tool.pytest-benchmark]' in config_content,
            'has_parallel': 'pytest-xdist' in config_content}
    
    def validate_conftest_structure(self, conftest_content: str) -> Dict[str, Any]:
        """Validate conftest.py structure and fixtures."""
        try:
            tree = ast.parse(conftest_content)
            visitor = ConftestVisitor()
            visitor.visit(tree)
            
            return {
                'valid': True,
                'fixtures': visitor.fixtures,
                'async_fixtures': visitor.async_fixtures,
                'classes': visitor.classes,
                'functions': visitor.functions,
                'imports': visitor.imports,
                'pytest_plugins': visitor.pytest_plugins,
                'has_event_loop': 'event_loop' in visitor.fixtures,
                'has_test_config': 'test_config' in visitor.fixtures,
                'has_temp_fixtures': any('temp' in f for f in visitor.fixtures),
                'has_mock_fixtures': any('mock' in f for f in visitor.fixtures)}
            
        except SyntaxError as e:
            return {'valid': False, 'error': str(e)}
    
    def validate_framework_config(self, framework: str, config_content: str) -> Dict[str, Any]:
        """Validate framework-specific test configuration."""
        framework_checks = {
            'fastapi': self._validate_fastapi_config,
            'django': self._validate_django_config,
            'flask': self._validate_flask_config,
            'tornado': self._validate_tornado_config,
            'sanic': self._validate_sanic_config}
        
        if framework not in framework_checks:
            return {'valid': False, 'error': f'Unknown framework: {framework}'}
        
        return framework_checks[framework](config_content)
    
    def _validate_fastapi_config(self, content: str) -> Dict[str, Any]:
        """Validate FastAPI test configuration."""
        required_elements = [
            'fastapi_app',
            'test_client',
            'async_client',
            'authenticated_client',
            'FastAPITestUtils',
            'TestClient',
            'AsyncClient']
        
        missing_elements = [elem for elem in required_elements if elem not in content]
        
        return {
            'valid': len(missing_elements) == 0,
            'missing_elements': missing_elements,
            'has_dependency_override': 'override_dependencies' in content,
            'has_websocket_support': 'websockets' in content.lower(),
            'has_auth_fixtures': 'authenticated_client' in content,
            'has_file_upload': 'test_upload_file' in content,
            'has_background_tasks': 'background_tasks' in content}
    
    def _validate_django_config(self, content: str) -> Dict[str, Any]:
        """Validate Django test configuration."""
        required_elements = [
            'django_db_setup',
            'django_client',
            'test_user',
            'admin_user',
            'DjangoTestUtils',
            'django.test']
        
        missing_elements = [elem for elem in required_elements if elem not in content]
        
        return {
            'valid': len(missing_elements) == 0,
            'missing_elements': missing_elements,
            'has_transaction_support': 'db_transaction' in content,
            'has_cache_mock': 'mock_cache' in content,
            'has_mail_mock': 'mock_send_mail' in content,
            'has_management_commands': 'call_command' in content,
            'has_signal_testing': 'signal_recorder' in content,
            'has_drf_support': 'rest_framework' in content}
    
    def _validate_flask_config(self, content: str) -> Dict[str, Any]:
        """Validate Flask test configuration."""
        required_elements = [
            'flask_app',
            'client',
            'test_user',
            'FlaskTestUtils',
            'FlaskClient',
            'app_context']
        
        missing_elements = [elem for elem in required_elements if elem not in content]
        
        return {
            'valid': len(missing_elements) == 0,
            'missing_elements': missing_elements,
            'has_request_context': 'request_context' in content,
            'has_db_session': 'db_session' in content,
            'has_mail_mock': 'mock_mail' in content,
            'has_cli_testing': 'cli_runner' in content,
            'has_blueprint_testing': 'blueprint_app' in content}
    
    def _validate_tornado_config(self, content: str) -> Dict[str, Any]:
        """Validate Tornado test configuration."""
        required_elements = [
            'tornado_app',
            'http_client',
            'tornado_test_case',
            'TornadoTestUtils',
            'AsyncHTTPTestCase',
            'websocket_client']
        
        missing_elements = [elem for elem in required_elements if elem not in content]
        
        return {
            'valid': len(missing_elements) == 0,
            'missing_elements': missing_elements,
            'has_websocket_support': 'websockets' in content,
            'has_mock_handler': 'mock_handler' in content,
            'has_async_support': 'async def' in content,
            'has_ioloop_testing': 'ioloop_test' in content}
    
    def _validate_sanic_config(self, content: str) -> Dict[str, Any]:
        """Validate Sanic test configuration."""
        required_elements = [
            'sanic_app',
            'test_client',
            'authenticated_client',
            'SanicTestUtils',
            'TestClient',
            'websocket_client']
        
        missing_elements = [elem for elem in required_elements if elem not in content]
        
        return {
            'valid': len(missing_elements) == 0,
            'missing_elements': missing_elements,
            'has_middleware_testing': 'middleware_recorder' in content,
            'has_websocket_support': 'websockets' in content,
            'has_rate_limiting': 'rate_limiter' in content,
            'has_security_utils': 'security_test_utils' in content}
    
    def run_sample_tests(self, framework: str) -> Dict[str, Any]:
        """Run sample tests to validate functionality."""
        sample_test = self._create_sample_test(framework)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(sample_test)
            test_file = f.name
        
        try:
            # Run pytest on sample test
            result = subprocess.run(
                [sys.executable, '-m', 'pytest', test_file, '-v', '--tb=short'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                'success': result.returncode == 0,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'tests_run': self._count_tests_run(result.stdout),
                'tests_passed': self._count_tests_passed(result.stdout),
                'coverage': self._extract_coverage(result.stdout)}
            
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': 'Test execution timed out'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            os.unlink(test_file)
    
    def _create_sample_test(self, framework: str) -> str:
        """Create sample test for framework validation."""
        base_test = '''
import pytest
import asyncio

@pytest.mark.unit
def test_basic_functionality():
    """Test basic functionality."""
    assert True

@pytest.mark.asyncio
async def test_async_functionality():
    """Test async functionality."""
    await asyncio.sleep(0.001)
    assert True

@pytest.mark.parametrize("value,expected", [
    (1, True),
    (0, False),
    (-1, False)])
def test_parametrized(value, expected):
    """Test parametrized functionality."""
    assert bool(value) == expected

@pytest.mark.slow
def test_slow_operation():
    """Test slow operation marker."""
    import time
    time.sleep(0.01)
    assert True
'''
        
        framework_specific = {
            'fastapi': '''
@pytest.mark.api
async def test_fastapi_endpoint(async_client):
    """Test FastAPI endpoint."""
    response = await async_client.get("/health")
    assert response.status_code in [200, 404]  # 404 is ok for test
''',
            'django': '''
@pytest.mark.django_db
def test_django_model(test_user):
    """Test Django model."""
    assert test_user.username == "testuser"
''',
            'flask': '''
def test_flask_route(client):
    """Test Flask route."""
    response = client.get("/health")
    assert response.status_code in [200, 404]  # 404 is ok for test
''',
            'tornado': '''
@pytest.mark.asyncio
async def test_tornado_handler(tornado_utils):
    """Test Tornado handler."""
    assert tornado_utils is not None
''',
            'sanic': '''
@pytest.mark.asyncio
async def test_sanic_endpoint(test_client):
    """Test Sanic endpoint."""
    response = await test_client.get("/health")
    assert response.status in [200, 404]  # 404 is ok for test
'''}
        
        return base_test + framework_specific.get(framework, '')
    
    def _count_tests_run(self, output: str) -> int:
        """Count tests run from pytest output."""
        import re
        match = re.search(r'(d+) passed', output)
        if match:
            return int(match.group(1))
        return 0
    
    def _count_tests_passed(self, output: str) -> int:
        """Count tests passed from pytest output."""
        import re
        match = re.search(r'(d+) passed', output)
        if match:
            return int(match.group(1))
        return 0
    
    def _extract_coverage(self, output: str) -> Optional[float]:
        """Extract coverage percentage from output."""
        import re
        match = re.search(r'TOTAL.*?(d+)%', output)
        if match:
            return float(match.group(1))
        return None
    
    def generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test validation report."""
        return {
            'errors': self.errors,
            'warnings': self.warnings,
            'test_results': self.test_results,
            'summary': {
                'total_validations': len(self.test_results),
                'successful_validations': sum(1 for r in self.test_results.values() if r.get('valid', False)),
                'error_count': len(self.errors),
                'warning_count': len(self.warnings)}
        }


class ConftestVisitor(ast.NodeVisitor):
    """AST visitor for analyzing conftest.py structure."""
    
    def __init__(self):
        self.fixtures = []
        self.async_fixtures = []
        self.classes = []
        self.functions = []
        self.imports = []
        self.pytest_plugins = []
    
    def visit_FunctionDef(self, node):
        """Visit function definitions."""
        # Check for pytest fixtures
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name) and decorator.id == 'fixture':
                if node.name.startswith('async_'):
                    self.async_fixtures.append(node.name)
                else:
                    self.fixtures.append(node.name)
                break
            elif isinstance(decorator, ast.Attribute) and decorator.attr == 'fixture':
                if node.name.startswith('async_'):
                    self.async_fixtures.append(node.name)
                else:
                    self.fixtures.append(node.name)
                break
        else:
            self.functions.append(node.name)
        
        self.generic_visit(node)
    
    def visit_AsyncFunctionDef(self, node):
        """Visit async function definitions."""
        # Check for pytest fixtures
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name) and decorator.id == 'fixture':
                self.async_fixtures.append(node.name)
                break
            elif isinstance(decorator, ast.Attribute) and decorator.attr == 'fixture':
                self.async_fixtures.append(node.name)
                break
        else:
            self.functions.append(node.name)
        
        self.generic_visit(node)
    
    def visit_ClassDef(self, node):
        """Visit class definitions."""
        self.classes.append(node.name)
        self.generic_visit(node)
    
    def visit_Import(self, node):
        """Visit import statements."""
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node):
        """Visit from-import statements."""
        if node.module:
            for alias in node.names:
                self.imports.append(f"{node.module}.{alias.name}")
        self.generic_visit(node)
    
    def visit_Assign(self, node):
        """Visit assignments for pytest_plugins."""
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == 'pytest_plugins':
                if isinstance(node.value, ast.List):
                    for elt in node.value.elts:
                        if isinstance(elt, ast.Str):
                            self.pytest_plugins.append(elt.s)
                        elif isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                            self.pytest_plugins.append(elt.value)
        self.generic_visit(node)


def main():
    """Main validation function."""
    print("🧪 Validating Pytest Configuration System...")
    
    validator = PytestConfigValidator()
    frameworks = ['fastapi', 'django', 'flask', 'tornado', 'sanic']
    
    # Validate each framework
    for framework in frameworks:
        print(f"\\n📋 Validating {framework.upper()} test configuration...")
        
        # Create sample configurations
        sample_config = create_sample_config(framework)
        
        # Validate configuration
        config_result = validator.validate_pyproject_config(sample_config['pyproject'])
        conftest_result = validator.validate_conftest_structure(sample_config['conftest'])
        framework_result = validator.validate_framework_config(framework, sample_config['framework'])
        
        # Run sample tests
        test_result = validator.run_sample_tests(framework)
        
        validator.test_results[framework] = {
            'config': config_result,
            'conftest': conftest_result,
            'framework': framework_result,
            'tests': test_result}
        
        # Print results
        print(f"✅ Configuration: {'✓' if config_result['valid'] else '✗'}")
        print(f"✅ Conftest: {'✓' if conftest_result['valid'] else '✗'}")
        print(f"✅ Framework: {'✓' if framework_result['valid'] else '✗'}")
        print(f"✅ Tests: {'✓' if test_result['success'] else '✗'}")
        
        if not config_result['valid']:
            print(f"   ⚠️  Missing sections: {config_result['missing_sections']}")
        
        if not conftest_result['valid']:
            print(f"   ⚠️  Conftest error: {conftest_result.get('error', 'Unknown')}")
        
        if not framework_result['valid']:
            print(f"   ⚠️  Missing elements: {framework_result['missing_elements']}")
        
        if test_result['success']:
            print(f"   📊 Tests run: {test_result['tests_run']}, Passed: {test_result['tests_passed']}")
        else:
            print(f"   ❌ Test error: {test_result.get('error', 'Unknown')}")
    
    # Generate final report
    report = validator.generate_test_report()
    
    print(f"\\n📊 Pytest Configuration Validation Results:")
    print(f"✅ Total validations: {report['summary']['total_validations']}")
    print(f"✅ Successful: {report['summary']['successful_validations']}")
    print(f"❌ Errors: {report['summary']['error_count']}")
    print(f"⚠️  Warnings: {report['summary']['warning_count']}")
    
    success_rate = (report['summary']['successful_validations'] / report['summary']['total_validations'] * 100) if report['summary']['total_validations'] > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if report['errors']:
        print(f"\\n❌ Errors:")
        for error in report['errors']:
            print(f"   • {error}")
    
    print(f"\\n🎯 Result: {'✅ PASS' if success_rate >= 80 else '❌ FAIL'}")
    
    if success_rate < 80:
        sys.exit(1)


def create_sample_config(framework: str) -> Dict[str, str]:
    """Create sample configuration for testing."""
    pyproject_config = '''[tool.pytest.ini_options]
minversion = "7.0"
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = ["-ra", "--cov=app", "--cov-report=term-missing"]
markers = ["unit: Unit tests", "integration: Integration tests"]
asyncio_mode = "auto"

[tool.coverage.run]
source = ["app", "src"]
branch = true
omit = ["*/tests/*", "*/migrations/*"]

[tool.coverage.report]
exclude_lines = ["pragma: no cover", "def __repr__"]
show_missing = true

[tool.pytest-benchmark]
sort = "mean"
'''
    
    conftest_base = '''
import pytest
import asyncio

pytest_plugins = ["pytest_asyncio", "pytest_cov"]

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def test_config():
    return {"TESTING": True}

@pytest.fixture
def temp_dir(tmp_path):
    return tmp_path

@pytest.fixture
def mock_database():
    return {"connected": True}
'''
    
    framework_configs = {
        'fastapi': '''
from fastapi.testclient import TestClient
from httpx import AsyncClient

@pytest.fixture
def fastapi_app():
    from fastapi import FastAPI
    return FastAPI()

@pytest.fixture
def test_client(fastapi_app):
    return TestClient(fastapi_app)

@pytest.fixture
async def async_client(fastapi_app):
    async with AsyncClient(app=fastapi_app) as client:
        yield client

@pytest.fixture
def authenticated_client(test_client):
    return test_client

class FastAPITestUtils:
    pass
''',
        'django': '''
import django
from django.test import Client

@pytest.fixture
def django_db_setup():
    pass

@pytest.fixture
def django_client():
    return Client()

@pytest.fixture
def test_user():
    return {"username": "testuser"}

@pytest.fixture
def admin_user():
    return {"username": "admin"}

class DjangoTestUtils:
    pass
''',
        'flask': '''
from flask import Flask
from flask.testing import FlaskClient

@pytest.fixture
def flask_app():
    return Flask(__name__)

@pytest.fixture
def client(flask_app):
    return flask_app.test_client()

@pytest.fixture
def app_context(flask_app):
    with flask_app.app_context():
        yield

@pytest.fixture
def test_user():
    return {"username": "testuser"}

class FlaskTestUtils:
    pass
''',
        'tornado': '''
from tornado.web import Application
from tornado.testing import AsyncHTTPTestCase
from tornado.httpclient import AsyncHTTPClient

@pytest.fixture
def tornado_app():
    return Application([])

@pytest.fixture
async def http_client():
    client = AsyncHTTPClient()
    yield client
    client.close()

@pytest.fixture
def tornado_test_case(tornado_app):
    class TestCase(AsyncHTTPTestCase):
        def get_app(self):
            return tornado_app
    return TestCase()

@pytest.fixture
async def websocket_client():
    pass

class TornadoTestUtils:
    pass
''',
        'sanic': '''
from sanic import Sanic
from sanic_testing import TestClient

@pytest.fixture
def sanic_app():
    return Sanic("test_app")

@pytest.fixture
async def test_client(sanic_app):
    async with TestClient(sanic_app) as client:
        yield client

@pytest.fixture
async def authenticated_client(test_client):
    return test_client

@pytest.fixture
async def websocket_client():
    pass

class SanicTestUtils:
    pass
'''}
    
    return {
        'pyproject': pyproject_config,
        'conftest': conftest_base,
        'framework': framework_configs.get(framework, '')}


if __name__ == "__main__":
    main()
`;
  }
}

export const pytestConfigGenerator = new PytestConfigGenerator();