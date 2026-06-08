#!/usr/bin/env node

/**
 * Comprehensive validation test for Pydantic models across Python frameworks
 * Tests universal validation models and framework-specific integrations
 */

const fs = require('fs');
const path = require('path');

const pydanticPath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'pydantic-models.py');

if (!fs.existsSync(pydanticPath)) {
  console.error('❌ Pydantic models file not found:', pydanticPath);
  process.exit(1);
}

const pydanticContent = fs.readFileSync(pydanticPath, 'utf8');

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

console.log('🧪 Validating Universal Pydantic Models...\n');

// Basic Structure Tests
test('Contains PydanticModelGenerator class', pydanticContent.includes('class PydanticModelGenerator'));
test('Has generate_base_models method', pydanticContent.includes('def generate_base_models'));
test('Has generate_framework_specific_models method', pydanticContent.includes('def generate_framework_specific_models'));
test('Has generate_validation_utilities method', pydanticContent.includes('def generate_validation_utilities'));

// Base Models Tests
test('Creates base schema module', pydanticContent.includes("'schemas/__init__.py'"));
test('Creates base models file', pydanticContent.includes("'schemas/base.py'"));
test('Creates auth models file', pydanticContent.includes("'schemas/auth.py'"));
test('Creates blog models file', pydanticContent.includes("'schemas/blog.py'"));
test('Creates API models file', pydanticContent.includes("'schemas/api.py'"));

// Base Schema Features Tests
test('Has TimestampMixin class', pydanticContent.includes('class TimestampMixin'));
test('Has UUIDMixin class', pydanticContent.includes('class UUIDMixin'));
test('Has StatusEnum enumeration', pydanticContent.includes('class StatusEnum'));
test('Has PriorityEnum enumeration', pydanticContent.includes('class PriorityEnum'));
test('Has BaseResponseModel class', pydanticContent.includes('class BaseResponseModel'));
test('Has PaginationMeta class', pydanticContent.includes('class PaginationMeta'));
test('Has PaginatedResponse class', pydanticContent.includes('class PaginatedResponse'));
test('Has ErrorDetail class', pydanticContent.includes('class ErrorDetail'));
test('Has ErrorResponse class', pydanticContent.includes('class ErrorResponse'));
test('Has HealthCheckResponse class', pydanticContent.includes('class HealthCheckResponse'));

// Auth Models Tests
test('Has UserRole enumeration', pydanticContent.includes('class UserRole'));
test('Has UserBase class', pydanticContent.includes('class UserBase'));
test('Has UserCreate class', pydanticContent.includes('class UserCreate'));
test('Has UserUpdate class', pydanticContent.includes('class UserUpdate'));
test('Has UserResponse class', pydanticContent.includes('class UserResponse'));
test('Has UserProfile class', pydanticContent.includes('class UserProfile'));
test('Has LoginRequest class', pydanticContent.includes('class LoginRequest'));
test('Has LoginResponse class', pydanticContent.includes('class LoginResponse'));
test('Has TokenRefreshRequest class', pydanticContent.includes('class TokenRefreshRequest'));
test('Has PasswordChangeRequest class', pydanticContent.includes('class PasswordChangeRequest'));
test('Has PasswordResetRequest class', pydanticContent.includes('class PasswordResetRequest'));
test('Has EmailVerificationRequest class', pydanticContent.includes('class EmailVerificationRequest'));

// Auth Validation Tests
test('User model has email validation', pydanticContent.includes('EmailStr'));
test('User model has username validation', pydanticContent.includes('min_length=3, max_length=50'));
test('Password has strength validation', pydanticContent.includes('validate_password'));
test('Password confirmation validation', pydanticContent.includes('passwords_match'));
test('Username format validation', pydanticContent.includes('r\'^[a-zA-Z0-9_-]+$\''));
test('Password complexity requirements', pydanticContent.includes('[A-Z]') && pydanticContent.includes('[a-z]') && pydanticContent.includes('\\d'));

// Blog Models Tests
test('Has ContentStatus enumeration', pydanticContent.includes('class ContentStatus'));
test('Has CategoryBase class', pydanticContent.includes('class CategoryBase'));
test('Has CategoryCreate class', pydanticContent.includes('class CategoryCreate'));
test('Has CategoryResponse class', pydanticContent.includes('class CategoryResponse'));
test('Has TagBase class', pydanticContent.includes('class TagBase'));
test('Has PostBase class', pydanticContent.includes('class PostBase'));
test('Has PostCreate class', pydanticContent.includes('class PostCreate'));
test('Has PostResponse class', pydanticContent.includes('class PostResponse'));
test('Has CommentBase class', pydanticContent.includes('class CommentBase'));
test('Has CommentResponse class', pydanticContent.includes('class CommentResponse'));
test('Has PostFilters class', pydanticContent.includes('class PostFilters'));
test('Has PostStats class', pydanticContent.includes('class PostStats'));

// Blog Validation Tests
test('Category has slug validation', pydanticContent.includes('validate_slug'));
test('Tag has color validation', pydanticContent.includes('r\'^#[0-9A-Fa-f]{6}$\''));
test('Post has featured image URL', pydanticContent.includes('HttpUrl'));
test('Post has SEO fields', pydanticContent.includes('meta_title') && pydanticContent.includes('meta_description'));
test('Comment has content length limits', pydanticContent.includes('max_length=1000'));
test('Slug pattern validation', pydanticContent.includes('r\'^[a-z0-9-]+$\''));

// API Models Tests
test('Has SystemInfo class', pydanticContent.includes('class SystemInfo'));
test('Has DatabaseInfo class', pydanticContent.includes('class DatabaseInfo'));
test('Has CacheInfo class', pydanticContent.includes('class CacheInfo'));
test('Has WebSocketStats class', pydanticContent.includes('class WebSocketStats'));
test('Has SystemMetrics class', pydanticContent.includes('class SystemMetrics'));
test('Has DetailedStatus class', pydanticContent.includes('class DetailedStatus'));
test('Has LogEntry class', pydanticContent.includes('class LogEntry'));
test('Has LogFilter class', pydanticContent.includes('class LogFilter'));
test('Has ConfigItem class', pydanticContent.includes('class ConfigItem'));
test('Has BackupInfo class', pydanticContent.includes('class BackupInfo'));
test('Has TaskInfo class', pydanticContent.includes('class TaskInfo'));
test('Has BulkOperation class', pydanticContent.includes('class BulkOperation'));
test('Has ExportRequest class', pydanticContent.includes('class ExportRequest'));

// Framework-Specific Models Tests
test('Supports FastAPI models', pydanticContent.includes('_generate_fastapi_models'));
test('Supports Django models', pydanticContent.includes('_generate_django_models'));
test('Supports Flask models', pydanticContent.includes('_generate_flask_models'));
test('Supports Tornado models', pydanticContent.includes('_generate_tornado_models'));
test('Supports Sanic models', pydanticContent.includes('_generate_sanic_models'));

// FastAPI-Specific Tests
test('FastAPI has QueryParams model', pydanticContent.includes('class FastAPIQueryParams'));
test('FastAPI has FileUploadResponse', pydanticContent.includes('class FileUploadResponse'));
test('FastAPI has BatchRequest model', pydanticContent.includes('class BatchRequest'));
test('FastAPI has WebSocketMessage model', pydanticContent.includes('class WebSocketMessage'));
test('FastAPI has OpenAPI customization', pydanticContent.includes('class OpenAPICustomization'));
test('FastAPI uses Query/Path/Body imports', pydanticContent.includes('from fastapi import Form, File, UploadFile, Query, Path, Body'));

// Django-Specific Tests
test('Django has ModelMixin', pydanticContent.includes('class DjangoModelMixin'));
test('Django has FilterParams', pydanticContent.includes('class DjangoFilterParams'));
test('Django has ChoiceField model', pydanticContent.includes('class DjangoChoiceField'));
test('Django has ModelFieldInfo', pydanticContent.includes('class ModelFieldInfo'));
test('Django has ModelMetadata', pydanticContent.includes('class ModelMetadata'));
test('Django has validation error model', pydanticContent.includes('class SerializerValidationError'));
test('Django has ORM mode config', pydanticContent.includes('orm_mode = True'));

// Flask-Specific Tests
test('Flask has RequestValidator', pydanticContent.includes('class FlaskRequestValidator'));
test('Flask has PaginationParams', pydanticContent.includes('class FlaskPaginationParams'));
test('Flask has FileUpload model', pydanticContent.includes('class FlaskFileUpload'));
test('Flask has ErrorResponse model', pydanticContent.includes('class FlaskErrorResponse'));
test('Flask has BlueprintInfo model', pydanticContent.includes('class BlueprintInfo'));
test('Flask has from_request method', pydanticContent.includes('def from_request'));

// Tornado-Specific Tests
test('Tornado has WebSocketMessage', pydanticContent.includes('class TornadoWebSocketMessage'));
test('Tornado has AsyncResponse model', pydanticContent.includes('class TornadoAsyncResponse'));
test('Tornado has RequestMetadata', pydanticContent.includes('class TornadoRequestMetadata'));
test('Tornado has HandlerConfig model', pydanticContent.includes('class TornadoHandlerConfig'));
test('Tornado has ApplicationInfo', pydanticContent.includes('class TornadoApplicationInfo'));

// Sanic-Specific Tests
test('Sanic has RequestContext model', pydanticContent.includes('class SanicRequestContext'));
test('Sanic has MiddlewareInfo model', pydanticContent.includes('class SanicMiddlewareInfo'));
test('Sanic has BlueprintInfo model', pydanticContent.includes('class SanicBlueprintInfo'));
test('Sanic has PerformanceMetrics', pydanticContent.includes('class SanicPerformanceMetrics'));
test('Sanic has WorkerInfo model', pydanticContent.includes('class SanicWorkerInfo'));
test('Sanic has ServerInfo model', pydanticContent.includes('class SanicServerInfo'));

// Validation Utilities Tests
test('Has ValidationUtils class', pydanticContent.includes('class ValidationUtils'));
test('Has ModelValidator class', pydanticContent.includes('class ModelValidator'));
test('Has ValidationErrorFormatter class', pydanticContent.includes('class ValidationErrorFormatter'));
test('Creates validation utilities module', pydanticContent.includes("'utils/validation.py'"));

// Validation Utils Features Tests
test('Email format validation', pydanticContent.includes('def validate_email_format'));
test('Phone number validation', pydanticContent.includes('def validate_phone_number'));
test('URL format validation', pydanticContent.includes('def validate_url'));
test('Password strength validation', pydanticContent.includes('def validate_password_strength'));
test('Slug format validation', pydanticContent.includes('def validate_slug'));
test('Hex color validation', pydanticContent.includes('def validate_hex_color'));
test('JSON format validation', pydanticContent.includes('def validate_json'));
test('HTML sanitization', pydanticContent.includes('def sanitize_html'));

// Model Validator Features Tests
test('Email validator creator', pydanticContent.includes('def create_email_validator'));
test('Password validator creator', pydanticContent.includes('def create_password_validator'));
test('Slug validator creator', pydanticContent.includes('def create_slug_validator'));
test('Phone validator creator', pydanticContent.includes('def create_phone_validator'));

// Error Formatting Tests
test('Validation error formatter', pydanticContent.includes('def format_validation_error'));
test('Field errors formatter', pydanticContent.includes('def format_field_errors'));
test('Uses ValidationError import', pydanticContent.includes('from pydantic import validator, ValidationError'));

// Field Types and Imports Tests
test('Uses comprehensive Pydantic imports', pydanticContent.includes('from pydantic import BaseModel, EmailStr, Field, validator'));
test('Uses Pydantic types', pydanticContent.includes('from pydantic.types import SecretStr, HttpUrl, UUID4'));
test('Uses datetime imports', pydanticContent.includes('from datetime import datetime, date'));
test('Uses typing imports', pydanticContent.includes('from typing import Optional, List, Dict, Any, Union'));
test('Uses enum imports', pydanticContent.includes('from enum import Enum'));

// Advanced Features Tests
test('Has pagination support', pydanticContent.includes('has_next') && pydanticContent.includes('has_prev'));
test('Has bulk operations support', pydanticContent.includes('BulkOperation'));
test('Has export functionality', pydanticContent.includes('ExportRequest'));
test('Has task status tracking', pydanticContent.includes('TaskStatus'));
test('Has system metrics monitoring', pydanticContent.includes('SystemMetrics'));
test('Has comprehensive logging', pydanticContent.includes('LogEntry') && pydanticContent.includes('LogFilter'));

// Configuration and Customization Tests
test('Has model configuration', pydanticContent.includes('class Config'));
test('Has from_attributes support', pydanticContent.includes('from_attributes = True'));
test('Has custom field descriptions', pydanticContent.includes('description='));
test('Has field constraints', pydanticContent.includes('ge=') && pydanticContent.includes('le='));
test('Has regex validation', pydanticContent.includes('regex='));

// Security Features Tests
test('Uses SecretStr for passwords', pydanticContent.includes('SecretStr'));
test('Has sensitive data marking', pydanticContent.includes('is_sensitive'));
test('Has HTML sanitization', pydanticContent.includes('bleach'));
test('Has JWT token models', pydanticContent.includes('access_token') && pydanticContent.includes('refresh_token'));
test('Has role-based access', pydanticContent.includes('UserRole'));

// Data Integrity Tests
test('Has timestamp mixins', pydanticContent.includes('TimestampMixin'));
test('Has UUID primary keys', pydanticContent.includes('UUIDMixin'));
test('Has soft delete support', pydanticContent.includes('DELETED'));
test('Has status enumerations', pydanticContent.includes('StatusEnum'));
test('Has priority levels', pydanticContent.includes('PriorityEnum'));

console.log(`\n📊 Pydantic Models Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Pydantic models are comprehensive and framework-agnostic.`);
}