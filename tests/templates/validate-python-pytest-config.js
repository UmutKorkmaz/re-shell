#!/usr/bin/env node

/**
 * Comprehensive validation test for Python pytest configuration system
 * Tests pytest setup, fixtures, coverage, and async testing capabilities
 */

const fs = require('fs');
const path = require('path');

const pytestConfigPath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'python-pytest-config.ts');

if (!fs.existsSync(pytestConfigPath)) {
  console.error('❌ Python pytest config file not found:', pytestConfigPath);
  process.exit(1);
}

const pytestConfigContent = fs.readFileSync(pytestConfigPath, 'utf8');

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

console.log('🧪 Validating Python Pytest Configuration System...\n');

// Basic Structure Tests
test('Contains PytestConfigGenerator class', pytestConfigContent.includes('class PytestConfigGenerator'));
test('Has generatePytestConfig method', pytestConfigContent.includes('generatePytestConfig'));
test('Has generatePyprojectConfig method', pytestConfigContent.includes('generatePyprojectConfig'));
test('Has generateConftestPy method', pytestConfigContent.includes('generateConftestPy'));
test('Has generateTestUtilities method', pytestConfigContent.includes('generateTestUtilities'));

// Configuration Interface Tests
test('Has PytestConfig interface', pytestConfigContent.includes('interface PytestConfig'));
test('Config has framework field', pytestConfigContent.includes('framework: string'));
test('Config has pythonVersion field', pytestConfigContent.includes('pythonVersion: string'));
test('Config has enableAsync field', pytestConfigContent.includes('enableAsync: boolean'));
test('Config has enableCoverage field', pytestConfigContent.includes('enableCoverage: boolean'));
test('Config has enableFixtures field', pytestConfigContent.includes('enableFixtures: boolean'));
test('Config has enableMocking field', pytestConfigContent.includes('enableMocking: boolean'));
test('Config has enableBenchmarks field', pytestConfigContent.includes('enableBenchmarks: boolean'));
test('Config has enableParallel field', pytestConfigContent.includes('enableParallel: boolean'));

// Pyproject.toml Configuration Tests
test('Has tool.pytest.ini_options section', pytestConfigContent.includes('[tool.pytest.ini_options]'));
test('Sets minimum pytest version', pytestConfigContent.includes('minversion = "7.0"'));
test('Configures test file patterns', pytestConfigContent.includes('python_files = ["test_*.py", "*_test.py", "tests.py"]'));
test('Configures test class patterns', pytestConfigContent.includes('python_classes = ["Test*", "*Test", "*Tests"]'));
test('Configures test function patterns', pytestConfigContent.includes('python_functions = ["test_*"]'));
test('Sets test paths', pytestConfigContent.includes('testpaths = ["tests", "test"]'));

// Coverage Configuration Tests
test('Enables coverage for core directories', pytestConfigContent.includes('--cov=app') && pytestConfigContent.includes('--cov=src'));
test('Enables coverage for API directories', pytestConfigContent.includes('--cov=api') && pytestConfigContent.includes('--cov=schemas'));
test('Enables coverage for framework directories', pytestConfigContent.includes('--cov=blueprints') && pytestConfigContent.includes('--cov=handlers'));
test('Configures coverage reporting formats', pytestConfigContent.includes('--cov-report=term-missing') && pytestConfigContent.includes('--cov-report=html:htmlcov'));
test('Sets coverage threshold', pytestConfigContent.includes('--cov-fail-under=85'));
test('Configures XML coverage output', pytestConfigContent.includes('--cov-report=xml:coverage.xml'));
test('Configures JSON coverage output', pytestConfigContent.includes('--cov-report=json:coverage.json'));

// Async Testing Configuration Tests
test('Enables asyncio mode', pytestConfigContent.includes('asyncio_mode = "auto"'));
test('Sets asyncio fixture scope', pytestConfigContent.includes('asyncio_default_fixture_loop_scope = "function"'));

// Test Markers Tests
test('Defines unit test marker', pytestConfigContent.includes('unit: Unit tests that test individual components in isolation'));
test('Defines integration test marker', pytestConfigContent.includes('integration: Integration tests that test component interactions'));
test('Defines e2e test marker', pytestConfigContent.includes('e2e: End-to-end tests that test complete user workflows'));
test('Defines smoke test marker', pytestConfigContent.includes('smoke: Smoke tests for basic functionality verification'));
test('Defines performance test marker', pytestConfigContent.includes('performance: Performance and benchmark tests'));
test('Defines security test marker', pytestConfigContent.includes('security: Security-related tests'));
test('Defines slow test marker', pytestConfigContent.includes('slow: Tests that take a long time to run'));
test('Defines database test marker', pytestConfigContent.includes('database: Tests that require database access'));
test('Defines auth test marker', pytestConfigContent.includes('auth: Authentication and authorization tests'));
test('Defines API test marker', pytestConfigContent.includes('api: API endpoint tests'));

// Test Discovery Configuration Tests
test('Excludes build directories', pytestConfigContent.includes('build') && pytestConfigContent.includes('dist'));
test('Excludes virtual environments', pytestConfigContent.includes('venv') && pytestConfigContent.includes('.venv'));
test('Excludes hidden directories', pytestConfigContent.includes('.*'));
test('Excludes egg directories', pytestConfigContent.includes('*.egg'));

// Conftest.py Generation Tests
test('Generates conftest.py file', pytestConfigContent.includes('generateConftestPy'));
test('Imports pytest', pytestConfigContent.includes('import pytest'));
test('Imports asyncio for async tests', pytestConfigContent.includes('import asyncio'));
test('Imports testing utilities', pytestConfigContent.includes('from unittest.mock import') && pytestConfigContent.includes('Mock') && pytestConfigContent.includes('AsyncMock'));

// Common Fixtures Tests
test('Has database fixture', pytestConfigContent.includes('def database()'));
test('Has async database fixture', pytestConfigContent.includes('async def async_database()'));
test('Has client fixture', pytestConfigContent.includes('def client()'));
test('Has async client fixture', pytestConfigContent.includes('async def async_client()'));
test('Has event loop fixture', pytestConfigContent.includes('def event_loop()'));
test('Has temp directory fixture', pytestConfigContent.includes('def temp_dir()'));
test('Has mock user fixture', pytestConfigContent.includes('def mock_user()'));
test('Has auth headers fixture', pytestConfigContent.includes('def auth_headers('));

// FastAPI-Specific Fixtures Tests
test('Has FastAPI app fixture', pytestConfigContent.includes('def fastapi_app()') || pytestConfigContent.includes('def app()'));
test('Has FastAPI test client fixture', pytestConfigContent.includes('TestClient'));
test('Has async FastAPI client fixture', pytestConfigContent.includes('AsyncClient'));
test('Has dependency override fixture', pytestConfigContent.includes('app.dependency_overrides'));

// Django-Specific Fixtures Tests
test('Has Django settings fixture', pytestConfigContent.includes('def django_settings()') || pytestConfigContent.includes('@pytest.fixture'));
test('Has Django client fixture', pytestConfigContent.includes('from django.test import Client'));
test('Has Django user fixture', pytestConfigContent.includes('User.objects.create'));
test('Has Django database transaction fixture', pytestConfigContent.includes('django_db'));

// Flask-Specific Fixtures Tests
test('Has Flask app fixture', pytestConfigContent.includes('def flask_app()') || pytestConfigContent.includes('app = Flask'));
test('Has Flask client fixture', pytestConfigContent.includes('app.test_client()'));
test('Has Flask app context fixture', pytestConfigContent.includes('app_context()'));
test('Has Flask request context fixture', pytestConfigContent.includes('test_request_context()'));

// Tornado-Specific Fixtures Tests
test('Has Tornado app fixture', pytestConfigContent.includes('tornado.web.Application') || pytestConfigContent.includes('def tornado_app'));
test('Has Tornado async HTTP client fixture', pytestConfigContent.includes('AsyncHTTPClient'));
test('Has Tornado server fixture', pytestConfigContent.includes('tornado.testing.AsyncHTTPTestCase') || pytestConfigContent.includes('def tornado_server'));

// Sanic-Specific Fixtures Tests
test('Has Sanic app fixture', pytestConfigContent.includes('Sanic('));
test('Has Sanic test client fixture', pytestConfigContent.includes('sanic_client'));
test('Has Sanic async test fixture', pytestConfigContent.includes('async def test_'));

// Database Testing Utilities Tests
test('Has database cleanup utility', pytestConfigContent.includes('cleanup_database'));
test('Has test data seeding utility', pytestConfigContent.includes('seed_test_data'));
test('Has database reset utility', pytestConfigContent.includes('reset_database'));
test('Has transaction rollback utility', pytestConfigContent.includes('rollback_transaction'));

// Mock and Patch Utilities Tests
test('Has mock authentication utility', pytestConfigContent.includes('mock_auth'));
test('Has mock database utility', pytestConfigContent.includes('mock_db'));
test('Has patch request utility', pytestConfigContent.includes('patch_request'));
test('Has mock external API utility', pytestConfigContent.includes('mock_external_api'));

// Async Testing Utilities Tests
test('Has async test wrapper', pytestConfigContent.includes('async def async_test'));
test('Has async context manager', pytestConfigContent.includes('async with'));
test('Has async mock utilities', pytestConfigContent.includes('AsyncMock'));
test('Has async database operations', pytestConfigContent.includes('await'));

// HTTP Testing Utilities Tests
test('Has HTTP status assertion utility', pytestConfigContent.includes('assert_status'));
test('Has JSON response assertion utility', pytestConfigContent.includes('assert_json'));
test('Has response headers assertion utility', pytestConfigContent.includes('assert_headers'));
test('Has response content assertion utility', pytestConfigContent.includes('assert_content'));

// Authentication Testing Utilities Tests
test('Has create test user utility', pytestConfigContent.includes('create_test_user'));
test('Has generate JWT token utility', pytestConfigContent.includes('generate_test_token'));
test('Has authenticate user utility', pytestConfigContent.includes('authenticate_test_user'));
test('Has logout user utility', pytestConfigContent.includes('logout_test_user'));

// File and Upload Testing Utilities Tests
test('Has create test file utility', pytestConfigContent.includes('create_test_file'));
test('Has upload file utility', pytestConfigContent.includes('upload_test_file'));
test('Has cleanup files utility', pytestConfigContent.includes('cleanup_test_files'));

// Performance Testing Utilities Tests
test('Has benchmark decorator', pytestConfigContent.includes('benchmark'));
test('Has performance assertion utility', pytestConfigContent.includes('assert_performance'));
test('Has memory usage utility', pytestConfigContent.includes('memory_usage'));
test('Has timing utility', pytestConfigContent.includes('time_execution'));

// Validation and Schema Testing Tests
test('Has schema validation utility', pytestConfigContent.includes('validate_schema'));
test('Has API response validation utility', pytestConfigContent.includes('validate_response'));
test('Has model validation utility', pytestConfigContent.includes('validate_model'));

// Test Data Generation Tests
test('Has fake data generation utility', pytestConfigContent.includes('generate_fake_data'));
test('Has random test data utility', pytestConfigContent.includes('random_test_data'));
test('Has factory pattern utility', pytestConfigContent.includes('test_factory'));

// Error Testing Utilities Tests
test('Has exception assertion utility', pytestConfigContent.includes('assert_raises'));
test('Has error response testing utility', pytestConfigContent.includes('test_error_response'));
test('Has validation error testing utility', pytestConfigContent.includes('test_validation_error'));

// Coverage Configuration Tests
test('Has coverage run configuration', pytestConfigContent.includes('[tool.coverage.run]'));
test('Configures coverage source', pytestConfigContent.includes('source = ['));
test('Excludes test files from coverage', pytestConfigContent.includes('omit = ['));
test('Has coverage report configuration', pytestConfigContent.includes('[tool.coverage.report]'));
test('Sets coverage precision', pytestConfigContent.includes('precision = 2'));
test('Shows missing lines', pytestConfigContent.includes('show_missing = true'));

// Pytest Plugins Configuration Tests
test('Configures pytest-asyncio plugin', pytestConfigContent.includes('pytest-asyncio'));
test('Configures pytest-cov plugin', pytestConfigContent.includes('pytest-cov'));
test('Configures pytest-mock plugin', pytestConfigContent.includes('pytest-mock'));
test('Configures pytest-xdist for parallel testing', pytestConfigContent.includes('pytest-xdist'));

// Framework-Specific Test Utilities Tests
test('Has FastAPI-specific test utilities', pytestConfigContent.includes('fastapi') || pytestConfigContent.includes('TestClient'));
test('Has Django-specific test utilities', pytestConfigContent.includes('django') || pytestConfigContent.includes('django.test'));
test('Has Flask-specific test utilities', pytestConfigContent.includes('flask') || pytestConfigContent.includes('test_client'));
test('Has Tornado-specific test utilities', pytestConfigContent.includes('tornado') || pytestConfigContent.includes('AsyncHTTPTestCase'));
test('Has Sanic-specific test utilities', pytestConfigContent.includes('sanic') || pytestConfigContent.includes('sanic_client'));

// Advanced Testing Features Tests
test('Has parametrized test utilities', pytestConfigContent.includes('pytest.mark.parametrize'));
test('Has test timeout configuration', pytestConfigContent.includes('timeout'));
test('Has test retry mechanism', pytestConfigContent.includes('retry'));
test('Has test skip conditions', pytestConfigContent.includes('pytest.mark.skip'));
test('Has conditional test execution', pytestConfigContent.includes('pytest.mark.skipif'));

// Integration with IDE Tests
test('Configures test discovery for IDEs', pytestConfigContent.includes('testpaths'));
test('Sets proper test naming conventions', pytestConfigContent.includes('python_files'));
test('Configures test execution options', pytestConfigContent.includes('addopts'));

// Dependencies and Requirements Tests
test('Lists pytest as dependency', pytestConfigContent.includes('pytest'));
test('Lists pytest-asyncio as dependency', pytestConfigContent.includes('pytest-asyncio'));
test('Lists pytest-cov as dependency', pytestConfigContent.includes('pytest-cov'));
test('Lists pytest-mock as dependency', pytestConfigContent.includes('pytest-mock'));
test('Lists pytest-xdist as dependency', pytestConfigContent.includes('pytest-xdist'));

console.log(`\n📊 Python Pytest Configuration Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Python pytest configuration system is comprehensive and testing-ready.`);
}