/**
 * Request/Response Validation Middleware for All Backend Frameworks
 * Validates incoming requests and outgoing responses against OpenAPI schemas
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Validation types
export type ValidationMode = 'strict' | 'lenient' | 'permissive';

export interface ValidationConfig {
  mode: ValidationMode;
  validateRequest: boolean;
  validateResponse: boolean;
  stripUnknownProps: boolean;
  coerceTypes: boolean;
  customValidators?: Record<string, ValidatorFunction>;
  errorResponses: ErrorResponseConfig;
}

export interface ValidatorFunction {
  (value: any, schema: any): ValidationResult | Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  value?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  path?: string;
}

export interface ErrorResponseConfig {
  includeDetails: boolean;
  includeSchema: boolean;
  format: 'json' | 'xml' | 'text';
  customHandler?: string;
}

// Framework-specific validation middleware
export interface FrameworkValidationTemplate {
  framework: string;
  language: string;
  middlewareFile: string;
  dependencies: string[];
  imports: string[];
  middlewareCode: string;
  usageExample: string;
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  url: /^https?:\/\/.+/,
  dateString: /^\d{4}-\d{2}-\d{2}$/,
  iso8601: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
};

// Built-in validators
export const BUILT_IN_VALIDATORS = {
  required: (value: any) => ({
    valid: value !== null && value !== undefined && value !== '',
    errors: !value ? [{ field: '', message: 'This field is required', code: 'required' }] : [],
  }),
  email: (value: string) => ({
    valid: !value || VALIDATION_PATTERNS.email.test(value),
    errors: value && !VALIDATION_PATTERNS.email.test(value) ? [{ field: '', message: 'Invalid email format', code: 'format' }] : [],
  }),
  minLength: (min: number) => (value: string) => ({
    valid: !value || value.length >= min,
    errors: value && value.length < min ? [{ field: '', message: `Must be at least ${min} characters`, code: 'minLength' }] : [],
  }),
  maxLength: (max: number) => (value: string) => ({
    valid: !value || value.length <= max,
    errors: value && value.length > max ? [{ field: '', message: `Must be at most ${max} characters`, code: 'maxLength' }] : [],
  }),
  min: (min: number) => (value: number) => ({
    valid: value === null || value === undefined || value >= min,
    errors: value !== null && value !== undefined && value < min ? [{ field: '', message: `Must be at least ${min}`, code: 'minimum' }] : [],
  }),
  max: (max: number) => (value: number) => ({
    valid: value === null || value === undefined || value <= max,
    errors: value !== null && value !== undefined && value > max ? [{ field: '', message: `Must be at most ${max}`, code: 'maximum' }] : [],
  }),
  pattern: (regex: RegExp) => (value: string) => ({
    valid: !value || regex.test(value),
    errors: value && !regex.test(value) ? [{ field: '', message: 'Format is invalid', code: 'pattern' }] : [],
  }),
  enum: (...values: any[]) => (value: any) => ({
    valid: value === null || value === undefined || values.includes(value),
    errors: value !== null && value !== undefined && !values.includes(value) ? [{ field: '', message: `Must be one of: ${values.join(', ')}`, code: 'enum' }] : [],
  }),
};

// Get validation template for a framework
export function getValidationTemplate(framework: string): FrameworkValidationTemplate | undefined {
  const templates: Record<string, FrameworkValidationTemplate> = {
    express: {
      framework: 'express',
      language: 'typescript',
      middlewareFile: 'validation.middleware.ts',
      dependencies: [
        'joi@17.13.3',
        'joi-to-json@4.0.0',
      ],
      imports: [
        'import { Request, Response, NextFunction } from \'express\';',
        'import Joi from \'joi\';',
      ],
      middlewareCode: `// Request validation middleware using Joi
interface ValidationSchemas {
  body?: Joi.ObjectSchema<any>;
  query?: Joi.ObjectSchema<any>;
  params?: Joi.ObjectSchema<any>;
  headers?: Joi.ObjectSchema<any>;
}

export function createValidationMiddleware(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string; location: string }> = [];

    // Validate body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          location: 'body',
        })));
      } else {
        req.body = value;
      }
    }

    // Validate query
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          location: 'query',
        })));
      } else {
        req.query = value;
      }
    }

    // Validate params
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: false,
        convert: true,
      });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          location: 'params',
        })));
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
}

// Usage example
const userCreateSchema = {
  body: Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    age: Joi.number().integer().min(18).max(120),
  }),
};

app.post('/users', createValidationMiddleware(userCreateSchema), createUserHandler);`,
      usageExample: `// Apply validation to a route
app.post('/users',
  createValidationMiddleware({
    body: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
    })
  }),
  createUserHandler
);`,
    },
    nestjs: {
      framework: 'nestjs',
      language: 'typescript',
      middlewareFile: 'validation.pipe.ts',
      dependencies: [
        '@nestjs/joi@2.2.0',
        'joi@17.13.3',
      ],
      imports: [
        'import { PipeTransform, Injectable, ArgumentMetadata } from \'@nestjs/common\';',
        'import { Joi, ValidationError } from \'joi\';',
        'import { HttpException } from \'@nestjs/common\';',
      ],
      middlewareCode: `@Injectable()
export class JoiValidationPipe implements PipeTransform<any> {
  constructor(private readonly schema?: Joi.ObjectSchema<any>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (!this.schema) {
      return value;
    }

    const { error, value: validatedValue } = this.schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      throw new HttpException({
        error: 'Validation failed',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      }, 400);
    }

    return validatedValue;
  }
}

// Parameter decorator for DTO validation
export function JoiSchema(schema: Joi.ObjectSchema<any>) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const existingValidators = Reflect.getMetadata('validation:validators', target) || [];
    Reflect.defineMetadata('validation:validators', [...existingValidators, { schema, parameterIndex }], target);
  };
}`,
      usageExample: `// Use validation pipe in controller
@Post('users')
async createUser(@Body(new JoiValidationPipe(userCreateSchema)) userData: CreateUserDto) {
  return this.usersService.create(userData);
}

// Or apply globally
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new JoiValidationPipe());
}`,
    },
    fastify: {
      framework: 'fastify',
      language: 'typescript',
      middlewareFile: 'validation-plugin.ts',
      dependencies: [
        'fastify-type-provider-zod@3.3.0',
        'zod@3.23.8',
      ],
      imports: [
        'import { FastifyPluginAsync } from \'fastify\';',
        'import { z } from \'zod\';',
      ],
      middlewareCode: `import fp from 'fastify-plugin';
import { ZodTypeProvider, z } from 'fastify-type-provider-zod';

// Add validation plugin
const validationPlugin = fp(async function (fastify, opts) {
  fastify.setValidatorCompiler({
    schema: z.object({}),
  });

  fastify.setReplySerializer(zodSerializer);
});

// Route schema definition
const userSchema = z.object({
  name: z.string().min(3).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120).optional(),
});

// Usage in routes
fastify.post('/users', async (request, reply) => {
  const userData = userSchema.parse(request.body);
  // Process user data
});`,
      usageExample: `// Register validation plugin
fastify.register(validationPlugin);

// Define route with schema
fastify.post<{
  Body: { name: string; email: string };
}>('/users', {
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 3, maxLength: 50 },
        email: { type: 'string', format: 'email' },
      },
      required: ['name', 'email'],
    },
  },
}, async (request, reply) => {
  return { success: true };
});`,
    },
    fastapi: {
      framework: 'fastapi',
      language: 'python',
      middlewareFile: 'validation.py',
      dependencies: [
        'pydantic@2.7.4',
      ],
      imports: [
        'from pydantic import BaseModel, EmailStr, Field, validator',
        'from typing import Optional',
        'from fastapi import FastAPI, Request, HTTPException',
      ],
      middlewareCode: `from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional

app = FastAPI()

# Request models with validation
class UserCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    age: Optional[int] = Field(None, ge=18, le=120)

    @validator('name')
    def name_must_not_contain_spaces(cls, v):
        if ' ' in v:
            raise ValueError('name must not contain spaces')
        return v

# Response models
class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

# Usage in routes
@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreateRequest):
    # FastAPI automatically validates the request
    return user

# Custom validation exception handler
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )`,
      usageExample: `# Define request model
class UserCreate(BaseModel):
    name: str = Field(min_length=3, max_length=50)
    email: EmailStr
    age: Optional[int] = Field(None, ge=18, le=120)

# Use in route
@app.post("/users")
async def create_user(user: UserCreate):
    # Request is automatically validated
    return user`,
    },
    django: {
      framework: 'django',
      language: 'python',
      middlewareFile: 'validation.py',
      dependencies: [
        'pydantic@2.7.4',
        'django-pydantic@2.17.0',
      ],
      imports: [
        'from pydantic import BaseModel, EmailStr, Field, validator',
        'from django.core.exceptions import ValidationError',
        'from functools import wraps',
      ],
      middlewareCode: `from pydantic import BaseModel, EmailStr, Field, ValidationError
from functools import wraps

def validate_request(model_class):
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            try:
                # Parse request body
                import json
                data = json.loads(request.body)
                validated = model_class(**data)
                request.validated_data = validated
            except ValidationError as e:
                from django.http import JsonResponse
                return JsonResponse({
                    'error': 'Validation failed',
                    'details': e.errors(),
                }, status=400)
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

# Request models
class UserCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    age: int | None = Field(None, ge=18, le=120)

# Usage in views
@validate_request(UserCreateRequest)
def create_user_view(request):
    data = request.validated_data
    # Process validated data
    pass`,
      usageExample: `from pydantic import BaseModel, Field
from functools import wraps

def validate_request(model_class):
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            try:
                data = json.loads(request.body)
                validated = model_class(**data)
                request.validated_data = validated
            except ValidationError as e:
                return JsonResponse({'error': 'Validation failed'}, status=400)
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

@validate_request(UserCreateRequest)
def create_user_view(request):
    data = request.validated_data
    return data`,
    },
    'aspnet-core': {
      framework: 'aspnet-core',
      language: 'csharp',
      middlewareFile: 'ValidationMiddleware.cs',
      dependencies: [
        'FluentValidation.AspNetCore@11.3.0',
        'FluentValidation@11.9.0',
      ],
      imports: [
        'using FluentValidation;',
        'using Microsoft.AspNetCore.Mvc;',
        'using System.Collections.Generic;',
      ],
      middlewareCode: `using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public class ValidationFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            var errors = new Dictionary<string, string[]>();
            foreach (var keyValue in context.ModelState)
            {
                errors[keyValue.Key] = keyValue.Value.Errors
                    .Select(e => e.ErrorMessage)
                    .ToArray();
            }

            context.Result = new BadRequestObjectResult(new
            {
                error = "Validation failed",
                details = errors
            });
        }
    }
}

// Validator using FluentValidation
public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .Length(3, 50).WithMessage("Name must be between 3 and 50 characters");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Age)
            .InclusiveBetween(18, 120).When(x => x.Age.HasValue);
    }
}

// Register in Program.cs
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
});`,
      usageExample: `public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .Length(3, 50);

        RuleFor(x => x.Email)
            .EmailAddress();
    }
}

// In Program.cs:
builder.Services.AddValidatorsFromAssemblyContaining<Program>();`,
    },
    'spring-boot': {
      framework: 'spring-boot',
      language: 'java',
      middlewareFile: 'ValidationMiddleware.java',
      dependencies: [
        'org.springframework.boot:spring-boot-starter-validation',
      ],
      imports: [
        'import jakarta.validation.constraints.*;',
        'import org.springframework.validation.annotation.Validated;',
        'import org.springframework.validation.FieldError;',
      ],
      middlewareCode: `import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(
            MethodArgumentNotValidException ex) {

        List<FieldError> fieldErrors = ex.getBindingResult().getFieldErrors();
        Map<String, List<String>> errors = fieldErrors.stream()
            .collect(Collectors.groupingBy(
                FieldError::getField,
                Collectors.mapping(
                    FieldError::getDefaultMessage,
                    Collectors.toList()
                )
            ));

        return ResponseEntity.badRequest().body(Map.of(
            "error", "Validation failed",
            "details", errors
        ));
    }
}`,
      usageExample: `@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping
    public ResponseEntity<User> createUser(@Valid @RequestBody CreateUserRequest request) {
        // Validation happens automatically
        User user = userService.create(request);
        return ResponseEntity.ok(user);
    }
}

// DTO with validation annotations
public class CreateUserRequest {
    @NotBlank(message = "Name is required")
    @Size(min = 3, max = 50)
    private String name;

    @Email(message = "Invalid email format")
    @NotBlank
    private String email;

    @Min(18)
    @Max(120)
    private Integer age;
}`,
    },
    gin: {
      framework: 'gin',
      language: 'go',
      middlewareFile: 'validation.go',
      dependencies: [
        'github.com/go-playground/validator/v10@v10.22.1',
        'github.com/go-playground/validator/v10',
      ],
      imports: [
        'import "github.com/gin-gonic/gin"',
        'import "github.com/go-playground/validator/v10"',
      ],
      middlewareCode: `package middleware

import (
    "github.com/gin-gonic/gin"
    "github.com/go-playground/validator/v10"
)

type CreateUserRequest struct {
    Name     string \`json:"name" validate:"required,min=3,max=50"\`
    Email    string \`json:"email" validate:"required,email"\`
    Age      int    \`json:"age" validate:"min=18,max=120"\`
}

func ValidationMiddleware() gin.HandlerFunc {
    validate := validator.New()

    return func(c *gin.Context) {
        var request interface{}

        if err := c.ShouldBindJSON(&request); err != nil {
            c.JSON(400, gin.H{
                "error": "Invalid request format",
            })
            c.Abort()
            return
        }

        if err := validate.Struct(request); err != nil {
            c.JSON(400, gin.H{
                "error": "Validation failed",
                "details": err.Error(),
            })
            c.Abort()
            return
        }

        c.Set("validatedRequest", request)
        c.Next()
    }
}

// Usage example
func RegisterRoutes(r *gin.Engine) {
    r.Use(ValidationMiddleware())

    r.POST("/users", func(c *gin.Context) {
        request := c.MustGet("validatedRequest").(*CreateUserRequest)
        // Process validated request
        c.JSON(200, gin.H{"message": "User created"})
    })
}`,
      usageExample: `type CreateUserRequest struct {
    Name  string \`json:"name" validate:"required,min=3,max=50"\`
    Email string \`json:"email" validate:"required,email"\`
    Age   int    \`json:"age" validate:"min=18,max=120"\`
}

func ValidationMiddleware() gin.HandlerFunc {
    validate := validator.New()
    return func(c *gin.Context) {
        var request interface{}
        if err := c.ShouldBindJSON(&request); err != nil {
            c.JSON(400, gin.H{"error": "Invalid request"})
            c.Abort()
            return
        }
        if err := validate.Struct(request); err != nil {
            c.JSON(400, gin.H{"error": "Validation failed", "details": err.Error()})
            c.Abort()
            return
        }
        c.Set("validatedRequest", request)
        c.Next()
    }
}`,
    },
    'rust-axum': {
      framework: 'axum',
      language: 'rust',
      middlewareFile: 'validation.rs',
      dependencies: [
        'validator@0.18.1',
        'serde@1.0.199',
        'serde_json@1.0.119',
      ],
      imports: [
        'use serde::{Deserialize, Serialize};',
        'use validator::Validate;',
        'use axum,',
        'use axum::{extract::State, http::StatusCode, response::Json, response::Response},',
      ],
      middlewareCode: `use serde::{Deserialize, Serialize};
use validator::Validate;
use axum::{
    extract::State,
    http::StatusCode,
    response::{Json, Response},
    Json as AxumJson,
};

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct CreateUserRequest {
    #[validate(length(min = 3, max = 50))]
    pub name: String,
    #[validate(email)]
    pub email: String,
    #[validate(range(min = 18, max = 120))]
    pub age: Option<u32>,
}

pub async fn create_user(
    Json(request): Json<CreateUserRequest>,
) -> Result<Json<User>, StatusCode> {
    // Validation happens automatically during JSON parsing
    match request.validate() {
        Ok(_) => {
            let user = create_user_logic(request.0);
            Ok(Json(user))
        }
        Err(e) => {
            eprintln!("Validation error: {:?}", e);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

// Custom error response
struct ValidationError {
    error: String,
    details: Vec<String>,
}

pub fn handle_validation_error(
    err: validator::ValidationErrors,
) -> Response {
    let details = err
        .field_errors()
        .into_iter()
        .flat_map(|(field, errors)| {
            errors.iter().map(move |e| (field.clone(), e.code.clone()))
        })
        .map(|(field, code)| format!("{}: {}", field, code))
        .collect();

    Json((
        StatusCode::BAD_REQUEST,
        ValidationError {
            error: "Validation failed".to_string(),
            details,
        },
    ))
        .into_response()
}`,
      usageExample: `#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct CreateUserRequest {
    #[validate(length(min = 3, max = 50))]
    pub name: String,
    #[validate(email)]
    pub email: String,
}

pub async fn create_user(
    Json(request): Json<CreateUserRequest>,
) -> Result<Json<User>, StatusCode> {
    match request.validate() {
        Ok(_) => Ok(Json(create_user_logic(request.0))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}`,
    },
  };

  return templates[framework];
}

// Generate validation middleware for a framework
export function generateValidationMiddleware(
  framework: string,
  options: {
    mode?: ValidationMode;
    validateRequest?: boolean;
    validateResponse?: boolean;
    stripUnknown?: boolean;
  } = {}
): string | undefined {
  const template = getValidationTemplate(framework);
  if (!template) {
    return undefined;
  }

  const {
    mode = 'lenient',
    validateRequest = true,
    validateResponse = false,
    stripUnknown = true,
  } = options;

  let code = `// Validation middleware for ${framework}\n`;
  code += `// Mode: ${mode}\n`;
  code += `// Validate Request: ${validateRequest}\n`;
  code += `// Validate Response: ${validateResponse}\n`;
  code += `// Strip Unknown: ${stripUnknown}\n\n`;
  code += template.middlewareCode;

  return code;
}

// Validation generator class
export class ValidationMiddlewareGenerator {
  private projectPath: string;
  private framework?: string;

  constructor(projectPath: string, framework?: string) {
    this.projectPath = projectPath;
    this.framework = framework;
  }

  // Detect framework from project files
  async detectFramework(): Promise<string> {
    const frameworkFiles: Record<string, string[]> = {
      'express': ['package.json'],
      'nestjs': ['nest-cli.json'],
      'fastify': ['package.json'],
      'fastapi': ['requirements.txt'],
      'django': ['manage.py'],
      'aspnet-core': ['*.csproj'],
      'spring-boot': ['pom.xml', 'build.gradle'],
      'gin': ['go.mod'],
      'rust-axum': ['Cargo.toml'],
    };

    for (const [framework, files] of Object.entries(frameworkFiles)) {
      for (const file of files) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          return framework;
        }
      }
    }

    return 'express';
  }

  // Generate validation middleware file
  async generate(outputPath: string): Promise<void> {
    const framework = this.framework || await this.detectFramework();
    const template = getValidationTemplate(framework);

    if (!template) {
      throw new Error(`No validation template found for framework: ${framework}`);
    }

    const fullPath = path.join(this.projectPath, outputPath);
    await fs.ensureDir(path.dirname(fullPath));

    // Combine imports and code
    const content = [
      ...template.imports,
      '',
      template.middlewareCode,
    ].join('\n');

    await fs.writeFile(fullPath, content, 'utf-8');
  }

  // Generate package.json install commands
  getInstallCommands(framework: string): string[] {
    const template = getValidationTemplate(framework);
    if (!template) {
      return [];
    }

    return template.dependencies;
  }

  // Get all supported frameworks
  getSupportedFrameworks(): string[] {
    return Object.keys(getValidationTemplate(null) || {});
  }
}

// Factory functions
export async function createValidationGenerator(projectPath: string, framework?: string): Promise<ValidationMiddlewareGenerator> {
  return new ValidationMiddlewareGenerator(projectPath, framework);
}

// Format for display
export function formatValidationTemplate(template: FrameworkValidationTemplate): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`\n🔍 Validation Template for ${template.framework}\n`));
  lines.push(chalk.gray('═'.repeat(60)));
  lines.push(`\n${chalk.blue('Language:')} ${template.language}`);
  lines.push(`${chalk.blue('Middleware File:')} ${template.middlewareFile}`);

  if (template.dependencies.length > 0) {
    lines.push(`\n${chalk.blue('Dependencies:')}`);
    for (const dep of template.dependencies) {
      lines.push(`  ${chalk.gray('•')} ${dep}`);
    }
  }

  lines.push(`\n${chalk.blue('Usage Example:')}\n`);
  lines.push(chalk.gray(template.usageExample));

  return lines.join('\n');
}
