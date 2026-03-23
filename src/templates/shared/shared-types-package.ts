import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class SharedTypesPackageTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Package.json for shared types
    files.push({
      path: 'package.json',
      content: this.generatePackageJson()
    });

    // TypeScript configuration
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Main entry point
    files.push({
      path: 'src/index.ts',
      content: this.generateIndex()
    });

    // API Types
    files.push({
      path: 'src/api/index.ts',
      content: this.generateApiTypes()
    });

    files.push({
      path: 'src/api/requests.ts',
      content: this.generateRequestTypes()
    });

    files.push({
      path: 'src/api/responses.ts',
      content: this.generateResponseTypes()
    });

    files.push({
      path: 'src/api/errors.ts',
      content: this.generateErrorTypes()
    });

    // Domain Models
    files.push({
      path: 'src/models/index.ts',
      content: this.generateModelsIndex()
    });

    files.push({
      path: 'src/models/user.ts',
      content: this.generateUserModel()
    });

    files.push({
      path: 'src/models/base.ts',
      content: this.generateBaseModel()
    });

    // DTOs (Data Transfer Objects)
    files.push({
      path: 'src/dto/index.ts',
      content: this.generateDtoIndex()
    });

    files.push({
      path: 'src/dto/pagination.ts',
      content: this.generatePaginationDto()
    });

    // Validation schemas (Zod)
    files.push({
      path: 'src/validation/index.ts',
      content: this.generateValidationIndex()
    });

    files.push({
      path: 'src/validation/schemas.ts',
      content: this.generateValidationSchemas()
    });

    // Constants
    files.push({
      path: 'src/constants/index.ts',
      content: this.generateConstants()
    });

    // Enums
    files.push({
      path: 'src/enums/index.ts',
      content: this.generateEnums()
    });

    // Utility Types
    files.push({
      path: 'src/utils/types.ts',
      content: this.generateUtilityTypes()
    });

    // Type Guards
    files.push({
      path: 'src/guards/index.ts',
      content: this.generateTypeGuards()
    });

    // Event Types (for real-time)
    files.push({
      path: 'src/events/index.ts',
      content: this.generateEventTypes()
    });

    // Build scripts
    files.push({
      path: 'scripts/build.sh',
      content: this.generateBuildScript()
    });

    // Code generators
    files.push({
      path: 'scripts/generate-from-openapi.ts',
      content: this.generateOpenApiGenerator()
    });

    files.push({
      path: 'scripts/generate-from-prisma.ts',
      content: this.generatePrismaGenerator()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    return files;
  }

  protected generatePackageJson(): string {
    const { normalizedName } = this.context;
    return JSON.stringify({
      name: `@${normalizedName}/shared-types`,
      version: '1.0.0',
      description: 'Shared types for frontend-backend communication',
      main: 'dist/index.js',
      module: 'dist/index.mjs',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          import: './dist/index.mjs',
          require: './dist/index.js',
          types: './dist/index.d.ts'
        },
        './api': {
          import: './dist/api/index.mjs',
          require: './dist/api/index.js',
          types: './dist/api/index.d.ts'
        },
        './models': {
          import: './dist/models/index.mjs',
          require: './dist/models/index.js',
          types: './dist/models/index.d.ts'
        },
        './dto': {
          import: './dist/dto/index.mjs',
          require: './dist/dto/index.js',
          types: './dist/dto/index.d.ts'
        },
        './validation': {
          import: './dist/validation/index.mjs',
          require: './dist/validation/index.js',
          types: './dist/validation/index.d.ts'
        },
        './enums': {
          import: './dist/enums/index.mjs',
          require: './dist/enums/index.js',
          types: './dist/enums/index.d.ts'
        },
        './events': {
          import: './dist/events/index.mjs',
          require: './dist/events/index.js',
          types: './dist/events/index.d.ts'
        }
      },
      files: ['dist', 'src'],
      scripts: {
        build: 'tsup src/index.ts src/api/index.ts src/models/index.ts src/dto/index.ts src/validation/index.ts src/enums/index.ts src/events/index.ts --format cjs,esm --dts --clean',
        'build:watch': 'tsup --watch',
        lint: 'eslint src --ext .ts',
        typecheck: 'tsc --noEmit',
        test: 'vitest',
        prepublishOnly: 'npm run build',
        'generate:openapi': 'ts-node scripts/generate-from-openapi.ts',
        'generate:prisma': 'ts-node scripts/generate-from-prisma.ts'
      },
      dependencies: {
        zod: '^3.22.0'
      },
      devDependencies: {
        '@types/node': '^20.10.0',
        eslint: '^8.55.0',
        tsup: '^8.0.0',
        typescript: '^5.3.0',
        vitest: '^1.0.0',
        'ts-node': '^10.9.0'
      },
      peerDependencies: {
        typescript: '>=4.7.0'
      },
      publishConfig: {
        access: 'public'
      }
    }, null, 2);
  }

  protected generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2020'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        outDir: './dist',
        rootDir: './src',
        resolveJsonModule: true,
        isolatedModules: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts']
    }, null, 2);
  }

  private generateIndex(): string {
    return `// Shared Types Package
// This package provides type definitions shared between frontend and backend

// Re-export all modules
export * from './api';
export * from './models';
export * from './dto';
export * from './validation';
export * from './constants';
export * from './enums';
export * from './utils/types';
export * from './guards';
export * from './events';
`;
  }

  private generateApiTypes(): string {
    return `// API Types
// Shared types for API communication

export * from './requests';
export * from './responses';
export * from './errors';

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

// API Endpoint Definition
export interface ApiEndpoint<
  TRequest = unknown,
  TResponse = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>
> {
  method: HttpMethod;
  path: string;
  request?: TRequest;
  response: TResponse;
  params?: TParams;
  query?: TQuery;
}

// API Route Map
export interface ApiRoutes {
  [key: string]: ApiEndpoint;
}

// Request Configuration
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  signal?: AbortSignal;
}

// API Client Interface
export interface ApiClient {
  get<T>(url: string, config?: RequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
  delete<T>(url: string, config?: RequestConfig): Promise<T>;
}

// Typed API Client
export type TypedApiClient<TRoutes extends ApiRoutes> = {
  [K in keyof TRoutes]: (
    params?: TRoutes[K]['params'],
    query?: TRoutes[K]['query'],
    body?: TRoutes[K]['request']
  ) => Promise<TRoutes[K]['response']>;
};
`;
  }

  private generateRequestTypes(): string {
    return `// Request Types

// Base request interface
export interface BaseRequest {
  timestamp?: number;
  requestId?: string;
  correlationId?: string;
}

// Create request
export interface CreateRequest<T> extends BaseRequest {
  data: T;
}

// Update request
export interface UpdateRequest<T> extends BaseRequest {
  data: Partial<T>;
}

// Bulk request
export interface BulkRequest<T> extends BaseRequest {
  items: T[];
}

// Search request
export interface SearchRequest extends BaseRequest {
  query: string;
  filters?: Record<string, unknown>;
  sort?: SortOptions;
  pagination?: PaginationOptions;
}

// Filter request
export interface FilterRequest extends BaseRequest {
  filters: FilterOptions[];
  logic?: 'AND' | 'OR';
}

// Sort options
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// Pagination options
export interface PaginationOptions {
  page: number;
  limit: number;
  cursor?: string;
}

// Filter options
export interface FilterOptions {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'between'
  | 'isNull'
  | 'isNotNull';

// Auth requests
export interface LoginRequest extends BaseRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest extends BaseRequest {
  email: string;
  password: string;
  name: string;
  acceptTerms: boolean;
}

export interface RefreshTokenRequest extends BaseRequest {
  refreshToken: string;
}

export interface ResetPasswordRequest extends BaseRequest {
  token: string;
  newPassword: string;
}

export interface ForgotPasswordRequest extends BaseRequest {
  email: string;
}
`;
  }

  private generateResponseTypes(): string {
    return `// Response Types

// Base response interface
export interface BaseResponse {
  success: boolean;
  timestamp: number;
  requestId?: string;
}

// Success response
export interface SuccessResponse<T = unknown> extends BaseResponse {
  success: true;
  data: T;
}

// Error response
export interface ErrorResponse extends BaseResponse {
  success: false;
  error: ApiError;
}

// API Error
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

// Unified response type
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Paginated response
export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  pagination: PaginationMeta;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

// List response
export interface ListResponse<T> extends SuccessResponse<T[]> {
  count: number;
}

// Created response
export interface CreatedResponse<T> extends SuccessResponse<T> {
  location?: string;
}

// Updated response
export interface UpdatedResponse<T> extends SuccessResponse<T> {
  previousVersion?: T;
}

// Deleted response
export interface DeletedResponse extends SuccessResponse<{ id: string }> {
  deletedAt: string;
}

// Bulk response
export interface BulkResponse<T> extends SuccessResponse<T[]> {
  succeeded: number;
  failed: number;
  errors?: Array<{
    index: number;
    error: ApiError;
  }>;
}

// Auth responses
export interface AuthResponse extends SuccessResponse<{
  user: UserData;
  tokens: AuthTokens;
}> {}

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// Health check response
export interface HealthResponse extends SuccessResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: HealthCheck[];
}> {}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}
`;
  }

  private generateErrorTypes(): string {
    return `// Error Types

// Error codes
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',

  // Business logic errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_FAILED: 'OPERATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Validation error
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

// Detailed API error
export interface DetailedApiError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  method?: string;
  correlationId?: string;
  validationErrors?: ValidationError[];
  details?: Record<string, unknown>;
}

// Error factory functions (for backend)
export const createError = (
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
): DetailedApiError => ({
  code,
  message,
  statusCode,
  timestamp: new Date().toISOString(),
  details
});

// HTTP status to error code mapping
export const httpStatusToErrorCode: Record<number, ErrorCode> = {
  400: ErrorCodes.BAD_REQUEST,
  401: ErrorCodes.UNAUTHORIZED,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  405: ErrorCodes.METHOD_NOT_ALLOWED,
  409: ErrorCodes.CONFLICT,
  422: ErrorCodes.UNPROCESSABLE_ENTITY,
  429: ErrorCodes.TOO_MANY_REQUESTS,
  500: ErrorCodes.INTERNAL_ERROR,
  501: ErrorCodes.NOT_IMPLEMENTED,
  502: ErrorCodes.BAD_GATEWAY,
  503: ErrorCodes.SERVICE_UNAVAILABLE,
  504: ErrorCodes.GATEWAY_TIMEOUT
};
`;
  }

  private generateModelsIndex(): string {
    return `// Domain Models
export * from './base';
export * from './user';

// Re-export common model utilities
export type { BaseEntity, Timestamps, SoftDelete } from './base';
`;
  }

  private generateBaseModel(): string {
    return `// Base Model Types

// UUID type
export type UUID = string;

// ISO date string
export type ISODateString = string;

// Base entity with ID
export interface BaseEntity {
  id: UUID;
}

// Timestamps mixin
export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Soft delete mixin
export interface SoftDelete {
  deletedAt?: ISODateString;
  isDeleted: boolean;
}

// Auditable mixin
export interface Auditable {
  createdBy: UUID;
  updatedBy?: UUID;
  deletedBy?: UUID;
}

// Versioned mixin
export interface Versioned {
  version: number;
}

// Full entity combining all mixins
export interface FullEntity extends BaseEntity, Timestamps, SoftDelete, Auditable, Versioned {}

// Create input (without auto-generated fields)
export type CreateInput<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'isDeleted' | 'version'
>;

// Update input (partial, without immutable fields)
export type UpdateInput<T extends BaseEntity> = Partial<
  Omit<T, 'id' | 'createdAt' | 'createdBy'>
>;

// Entity with relations
export type WithRelations<T, R extends Record<string, unknown>> = T & R;

// Entity selection
export type EntitySelect<T> = {
  [K in keyof T]?: boolean;
};

// Entity include
export type EntityInclude<R extends Record<string, unknown>> = {
  [K in keyof R]?: boolean | { select?: EntitySelect<R[K]> };
};
`;
  }

  private generateUserModel(): string {
    return `// User Model
import { BaseEntity, Timestamps, SoftDelete, UUID } from './base';

// User status enum
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

// User role
export type UserRole = 'admin' | 'user' | 'moderator' | 'guest';

// User entity
export interface User extends BaseEntity, Timestamps, SoftDelete {
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt?: string;
  metadata?: UserMetadata;
}

// User metadata
export interface UserMetadata {
  timezone?: string;
  locale?: string;
  preferences?: UserPreferences;
  [key: string]: unknown;
}

// User preferences
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  notifications?: NotificationPreferences;
  language?: string;
}

// Notification preferences
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

// User profile (public data)
export interface UserProfile {
  id: UUID;
  name: string;
  avatar?: string;
  role: UserRole;
  createdAt: string;
}

// Create user input
export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

// Update user input
export interface UpdateUserInput {
  name?: string;
  avatar?: string;
  status?: UserStatus;
  metadata?: Partial<UserMetadata>;
}

// User with relations
export interface UserWithRelations extends User {
  posts?: unknown[];
  comments?: unknown[];
  followers?: UserProfile[];
  following?: UserProfile[];
}

// User session
export interface UserSession {
  userId: UUID;
  sessionId: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
}

// Device info
export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  os?: string;
  browser?: string;
}
`;
  }

  private generateDtoIndex(): string {
    return `// DTOs (Data Transfer Objects)
export * from './pagination';

// Common DTO utilities

// Omit sensitive fields
export type PublicDto<T, K extends keyof T = never> = Omit<
  T,
  'password' | 'passwordHash' | 'secret' | K
>;

// Response DTO wrapper
export interface ResponseDto<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// List DTO wrapper
export interface ListDto<T> {
  items: T[];
  count: number;
}
`;
  }

  private generatePaginationDto(): string {
    return `// Pagination DTOs

// Pagination query DTO
export interface PaginationQueryDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Cursor pagination query DTO
export interface CursorPaginationQueryDto {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

// Pagination result DTO
export interface PaginationResultDto<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Cursor pagination result DTO
export interface CursorPaginationResultDto<T> {
  items: T[];
  pagination: {
    nextCursor?: string;
    previousCursor?: string;
    hasMore: boolean;
    total?: number;
  };
}

// Infinite scroll result DTO
export interface InfiniteScrollResultDto<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100
} as const;

// Normalize pagination params
export function normalizePagination(query: PaginationQueryDto): Required<Omit<PaginationQueryDto, 'sortBy' | 'sortOrder'>> & Pick<PaginationQueryDto, 'sortBy' | 'sortOrder'> {
  return {
    page: Math.max(1, query.page ?? PAGINATION_DEFAULTS.page),
    limit: Math.min(
      Math.max(1, query.limit ?? PAGINATION_DEFAULTS.limit),
      PAGINATION_DEFAULTS.maxLimit
    ),
    sortBy: query.sortBy,
    sortOrder: query.sortOrder
  };
}

// Calculate pagination metadata
export function calculatePaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationResultDto<never>['pagination'] {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}
`;
  }

  private generateValidationIndex(): string {
    return `// Validation Schemas
export * from './schemas';

// Validation result type
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

// Validate function type
export type ValidateFn<T> = (data: unknown) => ValidationResult<T>;
`;
  }

  private generateValidationSchemas(): string {
    return `// Zod Validation Schemas
import { z } from 'zod';

// Common schemas

// UUID schema
export const uuidSchema = z.string().uuid();

// Email schema
export const emailSchema = z.string().email().toLowerCase().trim();

// Password schema (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Username schema
export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// Phone schema
export const phoneSchema = z.string().regex(/^\\+?[1-9]\\d{1,14}$/, 'Invalid phone number');

// URL schema
export const urlSchema = z.string().url();

// Date schema
export const dateSchema = z.coerce.date();

// ISO date string schema
export const isoDateSchema = z.string().datetime();

// Pagination schemas
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Search schema
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  filters: z.record(z.unknown()).optional()
}).merge(paginationQuerySchema);

// User schemas
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'moderator', 'guest']).default('user')
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: urlSchema.optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']).optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().default(false)
});

export const registerSchema = createUserSchema.extend({
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' })
  })
});

// Infer types from schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Schema registry for dynamic validation
export const schemaRegistry = {
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  login: loginSchema,
  register: registerSchema,
  pagination: paginationQuerySchema,
  search: searchQuerySchema
} as const;

export type SchemaName = keyof typeof schemaRegistry;
`;
  }

  private generateConstants(): string {
    return `// Constants shared between frontend and backend

// API Configuration
export const API_CONFIG = {
  VERSION: 'v1',
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RATE_LIMIT: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 60000
  }
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
} as const;

// Authentication
export const AUTH = {
  ACCESS_TOKEN_EXPIRY: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7 days in seconds
  TOKEN_TYPE: 'Bearer',
  HEADER_NAME: 'Authorization'
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
} as const;

// Validation
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  BIO_MAX_LENGTH: 500
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400 // 24 hours
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Date formats
export const DATE_FORMATS = {
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
  DATE: 'yyyy-MM-dd',
  TIME: 'HH:mm:ss',
  DATETIME: 'yyyy-MM-dd HH:mm:ss',
  DISPLAY: 'MMM d, yyyy',
  DISPLAY_WITH_TIME: 'MMM d, yyyy h:mm a'
} as const;

// Regex patterns
export const PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  USERNAME: /^[a-zA-Z0-9_-]+$/,
  PHONE: /^\\+?[1-9]\\d{1,14}$/
} as const;
`;
  }

  private generateEnums(): string {
    return `// Shared Enums

// User status
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

// User role
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
  GUEST = 'guest'
}

// Sort order
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

// Resource status
export enum ResourceStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

// Notification type
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

// Theme
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

// Locale
export enum Locale {
  EN_US = 'en-US',
  EN_GB = 'en-GB',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  JA = 'ja',
  ZH_CN = 'zh-CN'
}

// HTTP Method
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD'
}

// File type
export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  OTHER = 'other'
}

// Permission
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

// Enum utilities
export type EnumValue<T extends Record<string, string>> = T[keyof T];

export function getEnumValues<T extends Record<string, string>>(enumObj: T): T[keyof T][] {
  return Object.values(enumObj) as T[keyof T][];
}

export function isEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: unknown
): value is T[keyof T] {
  return Object.values(enumObj).includes(value as T[keyof T]);
}
`;
  }

  private generateUtilityTypes(): string {
    return `// Utility Types

// Make specific properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Make specific properties required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Make all properties nullable
export type Nullable<T> = { [K in keyof T]: T[K] | null };

// Make specific properties nullable
export type NullableBy<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

// Deep partial
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// Deep required
export type DeepRequired<T> = T extends object
  ? { [P in keyof T]-?: DeepRequired<T[P]> }
  : T;

// Deep readonly
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

// Mutable (remove readonly)
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// Deep mutable
export type DeepMutable<T> = T extends object
  ? { -readonly [P in keyof T]: DeepMutable<T[P]> }
  : T;

// Extract keys by value type
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

// Pick by value type
export type PickByType<T, V> = Pick<T, KeysOfType<T, V>>;

// Omit by value type
export type OmitByType<T, V> = Omit<T, KeysOfType<T, V>>;

// Union to intersection
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// Exact type (no extra properties)
export type Exact<T, Shape> = T extends Shape
  ? Exclude<keyof T, keyof Shape> extends never
    ? T
    : never
  : never;

// Awaited type (unwrap Promise)
export type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// Function types
export type AsyncFunction<T = void> = () => Promise<T>;
export type AsyncFunctionWithArgs<TArgs extends unknown[], TReturn = void> = (
  ...args: TArgs
) => Promise<TReturn>;

// Event handler type
export type EventHandler<T = void> = (event: T) => void;

// Callback type
export type Callback<T = void, E = Error> = (error: E | null, result?: T) => void;

// JSON types
export type JSONPrimitive = string | number | boolean | null;
export type JSONArray = JSONValue[];
export type JSONObject = { [key: string]: JSONValue };
export type JSONValue = JSONPrimitive | JSONArray | JSONObject;

// String literal union
export type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

// Brand type for nominal typing
export type Brand<T, B> = T & { __brand: B };

// ID types
export type UserId = Brand<string, 'UserId'>;
export type PostId = Brand<string, 'PostId'>;
export type CommentId = Brand<string, 'CommentId'>;
`;
  }

  private generateTypeGuards(): string {
    return `// Type Guards

import type { ApiResponse, SuccessResponse, ErrorResponse, ApiError } from './api';

// Check if value is defined
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Check if value is string
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Check if value is number
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

// Check if value is boolean
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// Check if value is object
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Check if value is array
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// Check if value is function
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

// Check if value is promise
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return value instanceof Promise;
}

// Check if value is date
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

// Check if value is error
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// Check if response is success
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

// Check if response is error
export function isErrorResponse(response: ApiResponse): response is ErrorResponse {
  return response.success === false;
}

// Check if value is API error
export function isApiError(value: unknown): value is ApiError {
  return (
    isObject(value) &&
    isString((value as ApiError).code) &&
    isString((value as ApiError).message)
  );
}

// Check if value is UUID
export function isUUID(value: unknown): value is string {
  if (!isString(value)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Check if value is email
export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/.test(value);
}

// Check if value is URL
export function isURL(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Check if value is ISO date string
export function isISODateString(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && value === date.toISOString();
}

// Assert type (throws if false)
export function assertType<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
  message?: string
): asserts value is T {
  if (!guard(value)) {
    throw new TypeError(message ?? 'Type assertion failed');
  }
}

// Assert defined (throws if undefined/null)
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message ?? 'Value is undefined or null');
  }
}
`;
  }

  private generateEventTypes(): string {
    return `// Event Types for Real-Time Communication

// Base event interface
export interface BaseEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  correlationId?: string;
}

// Typed event
export interface TypedEvent<T extends string, P = unknown> extends BaseEvent {
  type: T;
  payload: P;
}

// Event envelope
export interface EventEnvelope<T extends BaseEvent = BaseEvent> {
  event: T;
  metadata: EventMetadata;
}

// Event metadata
export interface EventMetadata {
  version: string;
  sentAt: string;
  receivedAt?: string;
  retryCount?: number;
}

// User events
export type UserCreatedEvent = TypedEvent<'user.created', { userId: string; email: string }>;
export type UserUpdatedEvent = TypedEvent<'user.updated', { userId: string; changes: Record<string, unknown> }>;
export type UserDeletedEvent = TypedEvent<'user.deleted', { userId: string }>;
export type UserLoginEvent = TypedEvent<'user.login', { userId: string; deviceInfo?: unknown }>;
export type UserLogoutEvent = TypedEvent<'user.logout', { userId: string }>;

// Notification events
export type NotificationEvent = TypedEvent<'notification', {
  userId: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, unknown>;
}>;

// Data sync events
export type DataSyncEvent = TypedEvent<'data.sync', {
  entity: string;
  action: 'create' | 'update' | 'delete';
  id: string;
  data?: unknown;
}>;

// Presence events
export type UserPresenceEvent = TypedEvent<'presence', {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen?: string;
}>;

// Chat events
export type ChatMessageEvent = TypedEvent<'chat.message', {
  roomId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file';
}>;

export type ChatTypingEvent = TypedEvent<'chat.typing', {
  roomId: string;
  userId: string;
  isTyping: boolean;
}>;

// System events
export type SystemMaintenanceEvent = TypedEvent<'system.maintenance', {
  scheduled: string;
  duration: number;
  message: string;
}>;

// Union of all events
export type AppEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | UserLoginEvent
  | UserLogoutEvent
  | NotificationEvent
  | DataSyncEvent
  | UserPresenceEvent
  | ChatMessageEvent
  | ChatTypingEvent
  | SystemMaintenanceEvent;

// Event type map for type-safe handlers
export interface EventTypeMap {
  'user.created': UserCreatedEvent;
  'user.updated': UserUpdatedEvent;
  'user.deleted': UserDeletedEvent;
  'user.login': UserLoginEvent;
  'user.logout': UserLogoutEvent;
  'notification': NotificationEvent;
  'data.sync': DataSyncEvent;
  'presence': UserPresenceEvent;
  'chat.message': ChatMessageEvent;
  'chat.typing': ChatTypingEvent;
  'system.maintenance': SystemMaintenanceEvent;
}

// Event handler type
export type EventHandler<T extends keyof EventTypeMap> = (event: EventTypeMap[T]) => void | Promise<void>;

// Event subscription
export interface EventSubscription {
  unsubscribe: () => void;
}

// Event emitter interface
export interface TypedEventEmitter {
  on<T extends keyof EventTypeMap>(type: T, handler: EventHandler<T>): EventSubscription;
  off<T extends keyof EventTypeMap>(type: T, handler: EventHandler<T>): void;
  emit<T extends keyof EventTypeMap>(type: T, event: EventTypeMap[T]): void;
}
`;
  }

  private generateBuildScript(): string {
    return `#!/bin/bash
set -e

echo "Building shared types package..."

# Clean previous build
rm -rf dist

# Type check
echo "Running type check..."
npx tsc --noEmit

# Lint
echo "Running linter..."
npx eslint src --ext .ts

# Build with tsup
echo "Building with tsup..."
npx tsup

echo "Build complete!"
echo "Output files:"
ls -la dist/
`;
  }

  private generateOpenApiGenerator(): string {
    return `#!/usr/bin/env ts-node
/**
 * Generate TypeScript types from OpenAPI specification
 */

import * as fs from 'fs';
import * as path from 'path';

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, SchemaObject> };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
}

interface Operation {
  operationId?: string;
  summary?: string;
  requestBody?: { content: Record<string, { schema: SchemaObject }> };
  responses: Record<string, { content?: Record<string, { schema: SchemaObject }> }>;
}

interface SchemaObject {
  type?: string;
  $ref?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: string[];
  format?: string;
}

function generateTypes(spec: OpenAPISpec): string {
  const lines: string[] = [
    '// Auto-generated from OpenAPI specification',
    '// Do not edit manually',
    ''
  ];

  // Generate schema types
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      lines.push(generateSchemaType(name, schema));
      lines.push('');
    }
  }

  // Generate API types
  for (const [pathUrl, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (operation && typeof operation === 'object' && 'operationId' in operation) {
        lines.push(generateOperationType(pathUrl, method, operation));
        lines.push('');
      }
    }
  }

  return lines.join('\\n');
}

function generateSchemaType(name: string, schema: SchemaObject): string {
  if (schema.enum) {
    return \`export type \${name} = \${schema.enum.map(e => \`'\${e}'\`).join(' | ')};\`;
  }

  if (schema.type === 'object' && schema.properties) {
    const props = Object.entries(schema.properties).map(([propName, propSchema]) => {
      const optional = !schema.required?.includes(propName) ? '?' : '';
      const type = schemaToType(propSchema);
      return \`  \${propName}\${optional}: \${type};\`;
    });
    return \`export interface \${name} {\\n\${props.join('\\n')}\\n}\`;
  }

  return \`export type \${name} = \${schemaToType(schema)};\`;
}

function schemaToType(schema: SchemaObject): string {
  if (schema.$ref) {
    return schema.$ref.split('/').pop() || 'unknown';
  }

  switch (schema.type) {
    case 'string':
      return schema.format === 'date-time' ? 'string' : 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return \`\${schemaToType(schema.items || {})}[]\`;
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function generateOperationType(path: string, method: string, operation: Operation): string {
  const name = operation.operationId || \`\${method}\${path.replace(/\\//g, '_')}\`;
  return \`// \${operation.summary || name}\\nexport type \${capitalize(name)}Request = unknown;\\nexport type \${capitalize(name)}Response = unknown;\`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Main
const specPath = process.argv[2] || './openapi.yaml';
const outputPath = process.argv[3] || './src/generated/api-types.ts';

if (!fs.existsSync(specPath)) {
  console.error(\`OpenAPI spec not found: \${specPath}\`);
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')) as OpenAPISpec;
const types = generateTypes(spec);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, types);

console.log(\`Generated types: \${outputPath}\`);
`;
  }

  private generatePrismaGenerator(): string {
    return `#!/usr/bin/env ts-node
/**
 * Generate TypeScript types from Prisma schema
 */

import * as fs from 'fs';
import * as path from 'path';

interface PrismaModel {
  name: string;
  fields: PrismaField[];
}

interface PrismaField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  default?: unknown;
}

function parsePrismaSchema(schema: string): PrismaModel[] {
  const models: PrismaModel[] = [];
  const modelRegex = /model\\s+(\\w+)\\s*\\{([^}]+)\\}/g;

  let match;
  while ((match = modelRegex.exec(schema)) !== null) {
    const [, name, body] = match;
    const fields = parseFields(body);
    models.push({ name, fields });
  }

  return models;
}

function parseFields(body: string): PrismaField[] {
  const fields: PrismaField[] = [];
  const lines = body.trim().split('\\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

    const fieldMatch = trimmed.match(/^(\\w+)\\s+(\\w+)(\\??)(\\[\\])?/);
    if (fieldMatch) {
      const [, name, type, optional, list] = fieldMatch;
      fields.push({
        name,
        type,
        isRequired: !optional,
        isList: !!list,
        isId: trimmed.includes('@id'),
        isUnique: trimmed.includes('@unique'),
        default: trimmed.includes('@default') ? 'auto' : undefined
      });
    }
  }

  return fields;
}

function generateTypes(models: PrismaModel[]): string {
  const lines: string[] = [
    '// Auto-generated from Prisma schema',
    '// Do not edit manually',
    ''
  ];

  for (const model of models) {
    // Main interface
    lines.push(\`export interface \${model.name} {\`);
    for (const field of model.fields) {
      const type = prismaTypeToTS(field.type, field.isList);
      const optional = field.isRequired ? '' : '?';
      lines.push(\`  \${field.name}\${optional}: \${type};\`);
    }
    lines.push('}');
    lines.push('');

    // Create input
    const createFields = model.fields.filter(f => !f.isId && !f.default);
    lines.push(\`export interface Create\${model.name}Input {\`);
    for (const field of createFields) {
      const type = prismaTypeToTS(field.type, field.isList);
      const optional = field.isRequired ? '' : '?';
      lines.push(\`  \${field.name}\${optional}: \${type};\`);
    }
    lines.push('}');
    lines.push('');

    // Update input
    lines.push(\`export interface Update\${model.name}Input {\`);
    for (const field of model.fields.filter(f => !f.isId)) {
      const type = prismaTypeToTS(field.type, field.isList);
      lines.push(\`  \${field.name}?: \${type};\`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\\n');
}

function prismaTypeToTS(type: string, isList: boolean): string {
  const typeMap: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Float: 'number',
    Boolean: 'boolean',
    DateTime: 'Date',
    Json: 'unknown',
    BigInt: 'bigint'
  };

  const tsType = typeMap[type] || type;
  return isList ? \`\${tsType}[]\` : tsType;
}

// Main
const schemaPath = process.argv[2] || './prisma/schema.prisma';
const outputPath = process.argv[3] || './src/generated/prisma-types.ts';

if (!fs.existsSync(schemaPath)) {
  console.error(\`Prisma schema not found: \${schemaPath}\`);
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf-8');
const models = parsePrismaSchema(schema);
const types = generateTypes(models);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, types);

console.log(\`Generated types: \${outputPath}\`);
`;
  }

  protected generateReadme(): string {
    const { name, normalizedName } = this.context;
    return `# @${normalizedName}/shared-types

Shared TypeScript types for seamless frontend-backend communication.

## Installation

\`\`\`bash
npm install @${normalizedName}/shared-types
# or
pnpm add @${normalizedName}/shared-types
# or
yarn add @${normalizedName}/shared-types
\`\`\`

## Usage

### Import Types

\`\`\`typescript
// Import everything
import { User, ApiResponse, UserStatus } from '@${normalizedName}/shared-types';

// Import from specific modules
import { User, CreateUserInput } from '@${normalizedName}/shared-types/models';
import { PaginatedResponse } from '@${normalizedName}/shared-types/api';
import { createUserSchema } from '@${normalizedName}/shared-types/validation';
import { UserCreatedEvent } from '@${normalizedName}/shared-types/events';
\`\`\`

### API Types

\`\`\`typescript
import type { ApiResponse, SuccessResponse, ErrorResponse } from '@${normalizedName}/shared-types';

// Type-safe API response handling
function handleResponse<T>(response: ApiResponse<T>) {
  if (response.success) {
    console.log(response.data);
  } else {
    console.error(response.error);
  }
}
\`\`\`

### Validation with Zod

\`\`\`typescript
import { createUserSchema, type CreateUserInput } from '@${normalizedName}/shared-types';

// Validate on frontend
const result = createUserSchema.safeParse(formData);
if (result.success) {
  await api.createUser(result.data);
}

// Validate on backend
app.post('/users', (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  // result.data is typed as CreateUserInput
});
\`\`\`

### Type Guards

\`\`\`typescript
import { isSuccessResponse, isUUID, assertDefined } from '@${normalizedName}/shared-types';

// Use type guards
if (isSuccessResponse(response)) {
  // response.data is available
}

if (isUUID(id)) {
  // id is valid UUID
}

// Assert and throw
assertDefined(user, 'User not found');
\`\`\`

### Event Types

\`\`\`typescript
import type { UserCreatedEvent, EventHandler } from '@${normalizedName}/shared-types/events';

const handleUserCreated: EventHandler<'user.created'> = (event) => {
  console.log(\`User \${event.payload.userId} created\`);
};

socket.on('user.created', handleUserCreated);
\`\`\`

## Generate Types

### From OpenAPI

\`\`\`bash
npm run generate:openapi -- ./api/openapi.yaml ./src/generated/api.ts
\`\`\`

### From Prisma

\`\`\`bash
npm run generate:prisma -- ./prisma/schema.prisma ./src/generated/models.ts
\`\`\`

## Package Structure

\`\`\`
src/
├── index.ts          # Main exports
├── api/              # API types (requests, responses, errors)
├── models/           # Domain models
├── dto/              # Data Transfer Objects
├── validation/       # Zod schemas
├── constants/        # Shared constants
├── enums/            # Shared enums
├── utils/            # Utility types
├── guards/           # Type guards
└── events/           # Event types for real-time
\`\`\`

## Best Practices

1. **Keep types in sync** - Run validation on both frontend and backend
2. **Use type guards** - Narrow types safely at runtime
3. **Generate from source** - Use OpenAPI/Prisma generators
4. **Version carefully** - Follow semver for type changes

## License

MIT
`;
  }
}
