/**
 * Unified Authentication/Authorization Middleware
 * JWT token validation, RBAC, and cross-language authentication
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Token types
export type TokenType = 'access' | 'refresh' | 'id' | 'api-key';

// Auth algorithms
export type AuthAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'HS256' | 'HS384' | 'HS512';

// Role types
export type RoleType = 'admin' | 'user' | 'moderator' | 'guest' | 'service';

// Permission types
export type Permission = string;
export type PermissionSet = Set<Permission>;

// User/Service identity
export interface Identity {
  id: string;
  type: 'user' | 'service';
  roles: RoleType[];
  permissions: Permission[];
  metadata: Record<string, any>;
  issuer: string;
  subject: string;
  audience: string[];
  expiresAt: Date;
  issuedAt: Date;
}

// Token payload
export interface TokenPayload {
  sub: string; // Subject (user/service ID)
  iss: string; // Issuer
  aud: string[]; // Audience
  exp: number; // Expiration time
  iat: number; // Issued at
  nbf?: number; // Not before
  jti?: string; // JWT ID
  typ?: string; // Token type
  roles: RoleType[];
  permissions: Permission[];
  metadata?: Record<string, any>;
}

// Auth configuration
export interface AuthConfig {
  serviceName: string;
  algorithm: AuthAlgorithm;
  secretOrPrivateKey: string;
  secretOrPublicKey?: string;
  tokenExpiration: number; // seconds
  refreshExpiration: number; // seconds
  issuer: string;
  audience: string[];
  enableRefreshTokens: boolean;
  enableAPITokens: boolean;
  enableRBAC: boolean;
  defaultRoles: RoleType[];
  defaultPermissions: Permission[];
}

// Role definition
export interface RoleDefinition {
  name: RoleType;
  permissions: Permission[];
  inherits?: RoleType[];
  description: string;
}

// Permission check result
export interface AuthCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: Permission[];
  userPermissions?: Permission[];
}

// JWT utilities interface
export interface JWTUtils {
  sign(payload: TokenPayload, secret: string, options: any): Promise<string>;
  verify(token: string, secret: string, options: any): Promise<TokenPayload>;
  decode(token: string): TokenPayload | null;
}

// Generate auth configuration
export async function generateAuthConfig(
  serviceName: string,
  algorithm: AuthAlgorithm = 'RS256',
  enableRBAC = true
): Promise<AuthConfig> {
  return {
    serviceName,
    algorithm,
    secretOrPrivateKey: '', // Will be generated
    tokenExpiration: 3600, // 1 hour
    refreshExpiration: 604800, // 7 days
    issuer: serviceName,
    audience: [serviceName, 'api'],
    enableRefreshTokens: true,
    enableAPITokens: true,
    enableRBAC,
    defaultRoles: ['user'],
    defaultPermissions: [],
  };
}

// Default role definitions
export const DEFAULT_ROLES: Record<RoleType, RoleDefinition> = {
  admin: {
    name: 'admin',
    permissions: ['*'], // All permissions
    description: 'Administrator with full access',
  },
  moderator: {
    name: 'moderator',
    permissions: ['read:*', 'write:*', 'delete:content'],
    inherits: ['user'],
    description: 'Moderator with elevated privileges',
  },
  user: {
    name: 'user',
    permissions: ['read:*', 'write:own'],
    description: 'Regular user',
  },
  guest: {
    name: 'guest',
    permissions: ['read:public'],
    description: 'Guest with limited access',
  },
  service: {
    name: 'service',
    permissions: ['service:call', 'service:register'],
    description: 'Service account for inter-service communication',
  },
};

// Generate TypeScript implementation
export async function generateTypeScriptAuth(config: AuthConfig): Promise<{
  files: Array<{ path: string; content: string }>;
  dependencies: string[];
}> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['jsonwebtoken', 'jwks-client'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-auth.ts`,
    content: `import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-client';
import { IncomingHttpHeaders } from 'http';

// Types
type TokenType = 'access' | 'refresh' | 'id' | 'api-key';
type RoleType = 'admin' | 'user' | 'moderator' | 'guest' | 'service';
type Permission = string;

interface TokenPayload {
  sub: string;
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
  nbf?: number;
  jti?: string;
  typ?: string;
  roles: RoleType[];
  permissions: Permission[];
  metadata?: Record<string, any>;
}

interface Identity {
  id: string;
  type: 'user' | 'service';
  roles: RoleType[];
  permissions: Permission[];
  metadata: Record<string, any>;
  issuer: string;
  subject: string;
  audience: string[];
  expiresAt: Date;
  issuedAt: Date;
}

interface AuthCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: Permission[];
  userPermissions?: Permission[];
}

// Role definitions
const ROLES: Record<RoleType, { permissions: Permission[]; inherits?: RoleType[] }> = {
  admin: {
    permissions: ['*'],
  },
  moderator: {
    permissions: ['read:*', 'write:*', 'delete:content'],
    inherits: ['user'],
  },
  user: {
    permissions: ['read:*', 'write:own'],
  },
  guest: {
    permissions: ['read:public'],
  },
  service: {
    permissions: ['service:call', 'service:register'],
  },
};

// Main Auth Middleware
export class ${toPascalCase(config.serviceName)}AuthMiddleware {
  private config: any;
  private jwksClient?: JwksClient;

  constructor(config: any) {
    this.config = config;

    // Initialize JWKS client if using RS256
    if (this.config.algorithm.startsWith('RS')) {
      this.jwksClient = JwksClient({
        jwksUri: this.config.jwksUrl || 'https://auth.example.com/.well-known/jwks.json',
      });
    }
  }

  /**
   * Generate access token
   */
  async generateAccessToken(identity: Partial<Identity>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload: TokenPayload = {
      sub: identity.id || '',
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: now,
      exp: now + this.config.tokenExpiration,
      roles: identity.roles || this.config.defaultRoles,
      permissions: identity.permissions || [],
      metadata: identity.metadata,
    };

    return jwt.sign(payload, this.config.secretOrPrivateKey, {
      algorithm: this.config.algorithm,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(identity: Partial<Identity>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload: TokenPayload = {
      sub: identity.id || '',
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: now,
      exp: now + this.config.refreshExpiration,
      roles: identity.roles || this.config.defaultRoles,
      permissions: [],
      typ: 'refresh',
    };

    return jwt.sign(payload, this.config.secretOrPrivateKey, {
      algorithm: this.config.algorithm,
    });
  }

  /**
   * Verify and decode token
   */
  async verifyToken(token: string): Promise<Identity | null> {
    try {
      let secret = this.config.secretOrPublicKey || this.config.secretOrPrivateKey;

      // Get signing key from JWKS if using RS256
      if (this.jwksClient) {
        const decoded = jwt.decode(token, { complete: true }) as any;
        const signingKey = await this.jwksClient.getSigningKey(decoded.header.kid);
        secret = signingKey.getPublicKey();
      }

      const payload = jwt.verify(token, secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as TokenPayload;

      return this.payloadToIdentity(payload);
    } catch (error) {
      console.error('Token verification failed:', (error as Error).message);
      return null;
    }
  }

  /**
   * Extract token from headers
   */
  extractTokenFromHeaders(headers: IncomingHttpHeaders): string | null {
    const authHeader = headers.authorization;

    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Check if user has required permissions
   */
  checkPermissions(identity: Identity, requiredPermissions: Permission[]): AuthCheckResult {
    const userPermissions = this.getAllPermissions(identity.roles);

    // Check for wildcard permission
    if (userPermissions.has('*')) {
      return { allowed: true, userPermissions: Array.from(userPermissions) };
    }

    // Check each required permission
    for (const required of requiredPermissions) {
      const hasPermission = userPermissions.has(required) ||
        userPermissions.has(required.replace(/:[^:]+$/, ':*')); // Check wildcard

      if (!hasPermission) {
        return {
          allowed: false,
          reason: \`Missing permission: \${required}\`,
          requiredPermissions,
          userPermissions: Array.from(userPermissions),
        };
      }
    }

    return { allowed: true, userPermissions: Array.from(userPermissions) };
  }

  /**
   * Check if user has required roles
   */
  checkRoles(identity: Identity, requiredRoles: RoleType[]): boolean {
    return requiredRoles.some(role => identity.roles.includes(role));
  }

  /**
   * Get all permissions for roles (including inherited)
   */
  private getAllPermissions(roles: RoleType[]): Set<Permission> {
    const permissions = new Set<Permission>();

    for (const role of roles) {
      const roleDef = ROLES[role];

      if (roleDef) {
        roleDef.permissions.forEach(p => permissions.add(p));

        // Add inherited permissions
        if (roleDef.inherits) {
          const inherited = this.getAllPermissions(roleDef.inherits);
          inherited.forEach(p => permissions.add(p));
        }
      }
    }

    return permissions;
  }

  /**
   * Convert token payload to identity
   */
  private payloadToIdentity(payload: TokenPayload): Identity {
    return {
      id: payload.sub,
      type: payload.roles.includes('service') ? 'service' : 'user',
      roles: payload.roles,
      permissions: payload.permissions,
      metadata: payload.metadata || {},
      issuer: payload.iss,
      subject: payload.sub,
      audience: payload.aud,
      expiresAt: new Date(payload.exp * 1000),
      issuedAt: new Date(payload.iat * 1000),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    const identity = await this.verifyToken(refreshToken);

    if (!identity) {
      return null;
    }

    return this.generateAccessToken(identity);
  }
}

/**
 * Express middleware factory
 */
export function createAuthMiddleware(auth: ${toPascalCase(config.serviceName)}AuthMiddleware, options: any = {}) {
  return async (req: any, res: any, next: any) => {
    try {
      // Extract token
      const token = auth.extractTokenFromHeaders(req.headers);

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Verify token
      const identity = await auth.verifyToken(token);

      if (!identity) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Attach identity to request
      req.user = identity;
      req.auth = auth;

      // Check if token is expiring soon (add refresh token header)
      const expiresSoon = identity.expiresAt.getTime() - Date.now() < 5 * 60 * 1000; // 5 minutes
      if (expiresSoon && options.enableTokenRefresh !== false) {
        const newToken = await auth.generateAccessToken(identity);
        res.setHeader('X-New-Access-Token', newToken);
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  };
}

/**
 * Require permissions middleware
 */
export function requirePermissions(...permissions: Permission[]) {
  return (req: any, res: any, next: any) => {
    const auth: ${toPascalCase(config.serviceName)}AuthMiddleware = req.auth;
    const identity = req.user;

    if (!identity) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = auth.checkPermissions(identity, permissions);

    if (!result.allowed) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        reason: result.reason,
        required: result.requiredPermissions,
        your_permissions: result.userPermissions,
      });
    }

    next();
  };
}

/**
 * Require roles middleware
 */
export function requireRoles(...roles: RoleType[]) {
  return (req: any, res: any, next: any) => {
    const auth: ${toPascalCase(config.serviceName)}AuthMiddleware = req.auth;
    const identity = req.user;

    if (!identity) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!auth.checkRoles(identity, roles)) {
      return res.status(403).json({
        error: 'Insufficient roles',
        required: roles,
        your_roles: identity.roles,
      });
    }

    next();
  };
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    algorithm: 'HS256',
    secretOrPrivateKey: 'your-secret-key',
    tokenExpiration: 3600,
    refreshExpiration: 604800,
    issuer: '${config.serviceName}',
    audience: ['${config.serviceName}', 'api'],
    defaultRoles: ['user'],
  };

  const auth = new ${toPascalCase(config.serviceName)}AuthMiddleware(config);

  // Generate token
  const token = await auth.generateAccessToken({
    id: 'user-123',
    roles: ['user'],
    permissions: ['read:*', 'write:own'],
  });

  console.log('Generated token:', token);

  // Verify token
  const identity = await auth.verifyToken(token);
  console.log('Identity:', identity);

  // Check permissions
  const result = auth.checkPermissions(identity!, ['read:data']);
  console.log('Permission check:', result);
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonAuth(config: AuthConfig): Promise<{
  files: Array<{ path: string; content: string }>;
  dependencies: string[];
}> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['pyjwt', 'cryptography'];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_auth.py`,
    content: `import jwt
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass
from enum import Enum

class TokenType(Enum):
    ACCESS = 'access'
    REFRESH = 'refresh'
    ID = 'id'
    API_KEY = 'api-key'

class RoleType(Enum):
    ADMIN = 'admin'
    USER = 'user'
    MODERATOR = 'moderator'
    GUEST = 'guest'
    SERVICE = 'service'

@dataclass
class TokenPayload:
    sub: str  # Subject
    iss: str  # Issuer
    aud: List[str]  # Audience
    exp: int  # Expiration
    iat: int  # Issued at
    nbf: Optional[int] = None  # Not before
    jti: Optional[str] = None  # JWT ID
    typ: Optional[str] = None  # Token type
    roles: List[str] = None
    permissions: List[str] = None
    metadata: Dict[str, Any] = None

@dataclass
class Identity:
    id: str
    type: str  # 'user' or 'service'
    roles: List[str]
    permissions: List[str]
    metadata: Dict[str, Any]
    issuer: str
    subject: str
    audience: List[str]
    expires_at: datetime
    issued_at: datetime

@dataclass
class AuthCheckResult:
    allowed: bool
    reason: Optional[str] = None
    required_permissions: Optional[List[str]] = None
    user_permissions: Optional[List[str]] = None

# Role definitions
ROLES = {
    RoleType.ADMIN: {
        'permissions': ['*'],
    },
    RoleType.MODERATOR: {
        'permissions': ['read:*', 'write:*', 'delete:content'],
        'inherits': [RoleType.USER],
    },
    RoleType.USER: {
        'permissions': ['read:*', 'write:own'],
    },
    RoleType.GUEST: {
        'permissions': ['read:public'],
    },
    RoleType.SERVICE: {
        'permissions': ['service:call', 'service:register'],
    },
}

# Main Auth Middleware
class ${toPascalCase(config.serviceName)}AuthMiddleware:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.algorithm = config.get('algorithm', 'HS256')

    async def generate_access_token(self, identity: Dict[str, Any]) -> str:
        now = int(datetime.utcnow().timestamp())

        payload = {
            'sub': identity.get('id', ''),
            'iss': self.config['issuer'],
            'aud': self.config['audience'],
            'iat': now,
            'exp': now + self.config.get('tokenExpiration', 3600),
            'roles': identity.get('roles', self.config.get('defaultRoles', ['user'])),
            'permissions': identity.get('permissions', []),
            'metadata': identity.get('metadata'),
        }

        return jwt.encode(payload, self.config['secretOrPrivateKey'], algorithm=self.algorithm)

    async def generate_refresh_token(self, identity: Dict[str, Any]) -> str:
        now = int(datetime.utcnow().timestamp())

        payload = {
            'sub': identity.get('id', ''),
            'iss': self.config['issuer'],
            'aud': self.config['audience'],
            'iat': now,
            'exp': now + self.config.get('refreshExpiration', 604800),
            'roles': identity.get('roles', self.config.get('defaultRoles', ['user'])),
            'permissions': [],
            'typ': 'refresh',
        }

        return jwt.encode(payload, self.config['secretOrPrivateKey'], algorithm=self.algorithm)

    async def verify_token(self, token: str) -> Optional[Identity]:
        try:
            payload = jwt.decode(
                token,
                self.config.get('secretOrPublicKey', self.config['secretOrPrivateKey']),
                algorithms=[self.algorithm],
                issuer=self.config['issuer'],
                audience=self.config['audience'],
            )

            return self.payload_to_identity(payload)
        except jwt.InvalidTokenError as e:
            print(f'Token verification failed: {e}')
            return None

    def extract_token_from_headers(self, headers: Dict[str, str]) -> Optional[str]:
        auth_header = headers.get('Authorization') or headers.get('authorization')

        if not auth_header:
            return None

        parts = auth_header.split(' ')

        if len(parts) != 2 or parts[0] != 'Bearer':
            return None

        return parts[1]

    def check_permissions(self, identity: Identity, required_permissions: List[str]) -> AuthCheckResult:
        user_permissions = self.get_all_permissions(identity.roles)

        # Check wildcard
        if '*' in user_permissions:
            return AuthCheckResult(allowed=True, user_permissions=list(user_permissions))

        # Check each required permission
        for required in required_permissions:
            has_permission = required in user_permissions or \\
                required.replace(/:[^:]+$/, ':*') in user_permissions

            if not has_permission:
                return AuthCheckResult(
                    allowed=False,
                    reason=f'Missing permission: {required}',
                    required_permissions=required_permissions,
                    user_permissions=list(user_permissions),
                )

        return AuthCheckResult(allowed=True, user_permissions=list(user_permissions))

    def check_roles(self, identity: Identity, required_roles: List[str]) -> bool:
        return any(role in identity.roles for role in required_roles)

    def get_all_permissions(self, roles: List[str]) -> Set[str]:
        permissions = set()

        for role in roles:
            role_enum = RoleType(role)
            role_def = ROLES.get(role_enum)

            if role_def:
                permissions.update(role_def['permissions'])

                # Add inherited permissions
                if 'inherits' in role_def:
                    inherited = self.get_all_permissions([r.value for r in role_def['inherits']])
                    permissions.update(inherited)

        return permissions

    def payload_to_identity(self, payload: Dict[str, Any]) -> Identity:
        return Identity(
            id=payload['sub'],
            type='service' if 'service' in payload.get('roles', []) else 'user',
            roles=payload.get('roles', []),
            permissions=payload.get('permissions', []),
            metadata=payload.get('metadata', {}),
            issuer=payload['iss'],
            subject=payload['sub'],
            audience=payload.get('aud', []),
            expires_at=datetime.fromtimestamp(payload['exp']),
            issued_at=datetime.fromtimestamp(payload['iat']),
        )

    async def refresh_access_token(self, refresh_token: str) -> Optional[str]:
        identity = await self.verify_token(refresh_token)

        if not identity:
            return None

        return await self.generate_access_token({
            'id': identity.id,
            'roles': identity.roles,
            'permissions': identity.permissions,
            'metadata': identity.metadata,
        })

# FastAPI dependency factory
from fastapi import Request, HTTPException, status

def create_auth_dependency(auth: ${toPascalCase(config.serviceName)}AuthMiddleware):
    async def get_current_user(request: Request) -> Identity:
        token = auth.extract_token_from_headers(request.headers)

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='No token provided',
            )

        identity = await auth.verify_token(token)

        if not identity:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Invalid or expired token',
            )

        return identity

    return get_current_user

def require_permissions(*permissions: str):
    def decorator(dependency):
        async def wrapper(request: Request, *args, **kwargs):
            identity = await dependency(request, *args, **kwargs)
            result = auth.check_permissions(identity, list(permissions))

            if not result.allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        'error': 'Insufficient permissions',
                        'reason': result.reason,
                        'required': result.required_permissions,
                        'your_permissions': result.user_permissions,
                    },
                )

            return identity

        return wrapper
    return decorator

# Usage example
async def main():
    config = {
        'serviceName': '${config.serviceName}',
        'algorithm': 'HS256',
        'secretOrPrivateKey': 'your-secret-key',
        'tokenExpiration': 3600,
        'refreshExpiration': 604800,
        'issuer': '${config.serviceName}',
        'audience': ['${config.serviceName}', 'api'],
        'defaultRoles': ['user'],
    }

    auth = ${toPascalCase(config.serviceName)}AuthMiddleware(config)

    # Generate token
    token = await auth.generate_access_token({
        'id': 'user-123',
        'roles': ['user'],
        'permissions': ['read:*', 'write:own'],
    })

    print('Generated token:', token)

    # Verify token
    identity = await auth.verify_token(token)
    print('Identity:', identity)

    # Check permissions
    result = auth.check_permissions(identity, ['read:data'])
    print('Permission check:', result)

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoAuth(config: AuthConfig): Promise<{
  files: Array<{ path: string; content: string }>;
  dependencies: string[];
}> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['github.com/golang-jwt/jwt/v5'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-auth.go`,
    content: `package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TokenType represents token types
type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
	TokenTypeID      TokenType = "id"
	TokenTypeAPIKey  TokenType = "api-key"
)

// RoleType represents role types
type RoleType string

const (
	RoleTypeAdmin     RoleType = "admin"
	RoleTypeUser      RoleType = "user"
	RoleTypeModerator RoleType = "moderator"
	RoleTypeGuest     RoleType = "guest"
	RoleTypeService   RoleType = "service"
)

// Permission represents a permission string
type Permission string

// TokenPayload represents JWT token payload
type TokenPayload struct {
	Sub        string              \`json:"sub"\`
	Iss        string              \`json:"iss"\`
	Aud        []string            \`json:"aud"\`
	Exp        int64               \`json:"exp"\`
	Iat        int64               \`json:"iat"\`
	Nbf        int64               \`json:"nbf,omitempty"\`
	Jti        string              \`json:"jti,omitempty"\`
	Typ        string              \`json:"typ,omitempty"\`
	Roles      []RoleType          \`json:"roles"\`
	Permissions []Permission       \`json:"permissions"\`
	Metadata   map[string]interface{} \`json:"metadata,omitempty"\`
}

// Identity represents authenticated identity
type Identity struct {
	ID        string
	Type      string
	Roles     []RoleType
	Permissions []Permission
	Metadata  map[string]interface{}
	Issuer    string
	Subject   string
	Audience  []string
	ExpiresAt time.Time
	IssuedAt  time.Time
}

// AuthCheckResult represents permission check result
type AuthCheckResult struct {
	Allowed              bool
	Reason               string
	RequiredPermissions   []Permission
	UserPermissions      []Permission
}

// RoleDefinition represents role definition
type RoleDefinition struct {
	Permissions []Permission
	Inherits    []RoleType
}

// Role definitions
var ROLES = map[RoleType]RoleDefinition{
	RoleTypeAdmin: {
		Permissions: []Permission{"*"},
	},
	RoleTypeModerator: {
		Permissions: []Permission{"read:*", "write:*", "delete:content"},
		Inherits:    []RoleType{RoleTypeUser},
	},
	RoleTypeUser: {
		Permissions: []Permission{"read:*", "write:own"},
	},
	RoleTypeGuest: {
		Permissions: []Permission{"read:public"},
	},
	RoleTypeService: {
		Permissions: []Permission{"service:call", "service:register"},
	},
}

// AuthConfig represents auth configuration
type AuthConfig struct {
	ServiceName         string
	Algorithm          string
	SecretOrPrivateKey  string
	SecretOrPublicKey  string
	TokenExpiration    int
	RefreshExpiration  int
	Issuer             string
	Audience           []string
	DefaultRoles       []RoleType
}

// ${toPascalCase(config.serviceName)}AuthMiddleware main auth middleware
type ${toPascalCase(config.serviceName)}AuthMiddleware struct {
	config AuthConfig
}

func New${toPascalCase(config.serviceName)}AuthMiddleware(config AuthConfig) *${toPascalCase(config.serviceName)}AuthMiddleware {
	return &${toPascalCase(config.serviceName)}AuthMiddleware{
		config: config,
	}
}

// GenerateAccessToken generates a new access token
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) GenerateAccessToken(identity Identity) (string, error) {
	now := time.Now().Unix()

	payload := TokenPayload{
		Sub: identity.ID,
		Iss: am.config.Issuer,
		Aud: am.config.Audience,
		Iat: now,
		Exp: now + int64(am.config.TokenExpiration),
		Roles: identity.Roles,
		Permissions: identity.Permissions,
		Metadata: identity.Metadata,
	}

	token := jwt.NewWithClaims(jwt.GetSigningMethod(am.config.Algorithm), jwt.MapClaims{
		"sub": payload.Sub,
		"iss": payload.Iss,
		"aud": payload.Aud,
		"iat": payload.Iat,
		"exp": payload.Exp,
		"roles": payload.Roles,
		"permissions": payload.Permissions,
		"metadata": payload.Metadata,
	})

	return token.SignedString([]byte(am.config.SecretOrPrivateKey))
}

// GenerateRefreshToken generates a new refresh token
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) GenerateRefreshToken(identity Identity) (string, error) {
	now := time.Now().Unix()

	payload := TokenPayload{
		Sub: identity.ID,
		Iss: am.config.Issuer,
		Aud: am.config.Audience,
		Iat: now,
		Exp: now + int64(am.config.RefreshExpiration),
		Roles: identity.Roles,
		Permissions: []Permission{},
	}

	typ := "refresh"
	payload.Typ = typ

	token := jwt.NewWithClaims(jwt.GetSigningMethod(am.config.Algorithm), jwt.MapClaims{
		"sub": payload.Sub,
		"iss": payload.Iss,
		"aud": payload.Aud,
		"iat": payload.Iat,
		"exp": payload.Exp,
		"roles": payload.Roles,
		"typ": typ,
	})

	return token.SignedString([]byte(am.config.SecretOrPrivateKey))
}

// VerifyToken verifies and decodes a token
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) VerifyToken(tokenString string) (*Identity, error) {
	secret := am.config.SecretOrPublicKey
	if secret == "" {
		secret = am.config.SecretOrPrivateKey
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return am.PayloadToIdentity(claims), nil
	}

	return nil, fmt.Errorf("invalid token")
}

// ExtractTokenFromHeaders extracts token from HTTP headers
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) ExtractTokenFromHeaders(headers http.Header) string {
	authHeader := headers.Get("Authorization")

	if authHeader == "" {
		return ""
	}

	parts := strings.Split(authHeader, " ")

	if len(parts) != 2 || parts[0] != "Bearer" {
		return ""
	}

	return parts[1]
}

// CheckPermissions checks if identity has required permissions
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) CheckPermissions(identity *Identity, requiredPermissions []Permission) AuthCheckResult {
	userPermissions := am.GetAllPermissions(identity.Roles)

	// Check wildcard
	for _, perm := range userPermissions {
		if perm == "*" {
			return AuthCheckResult{
				Allowed:         true,
				UserPermissions: userPermissions,
			}
		}
	}

	// Check each required permission
	for _, required := range requiredPermissions {
		hasPermission := false

		for _, perm := range userPermissions {
			if perm == required || strings.HasSuffix(string(perm), ":*") {
				hasPermission = true
				break
			}
		}

		if !hasPermission {
			return AuthCheckResult{
				Allowed:              false,
				Reason:              fmt.Sprintf("Missing permission: %s", required),
				RequiredPermissions:  requiredPermissions,
				UserPermissions:      userPermissions,
			}
		}
	}

	return AuthCheckResult{
		Allowed:         true,
		UserPermissions: userPermissions,
	}
}

// CheckRoles checks if identity has required roles
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) CheckRoles(identity *Identity, requiredRoles []RoleType) bool {
	for _, requiredRole := range requiredRoles {
		for _, userRole := range identity.Roles {
			if userRole == requiredRole {
				return true
			}
		}
	}
	return false
}

// GetAllPermissions gets all permissions for roles (including inherited)
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) GetAllPermissions(roles []RoleType) []Permission {
	permissions := make(map[Permission]bool)

	for _, role := range roles {
		roleDef, ok := ROLES[role]
		if !ok {
			continue
		}

		for _, perm := range roleDef.Permissions {
			permissions[perm] = true
		}

		// Add inherited permissions
		if len(roleDef.Inherits) > 0 {
			inherited := am.GetAllPermissions(roleDef.Inherits)
			for _, perm := range inherited {
				permissions[perm] = true
			}
		}
	}

	result := make([]Permission, 0, len(permissions))
	for perm := range permissions {
		result = append(result, perm)
	}

	return result
}

// PayloadToIdentity converts token payload to identity
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) PayloadToIdentity(claims jwt.MapClaims) *Identity {
	roles := []RoleType{}
	if rolesClaim, ok := claims["roles"].([]interface{}); ok {
		for _, r := range rolesClaim {
			if roleStr, ok := r.(string); ok {
				roles = append(roles, RoleType(roleStr))
			}
		}
	}

	permissions := []Permission{}
	if permsClaim, ok := claims["permissions"].([]interface{}); ok {
		for _, p := range permsClaim {
			if permStr, ok := p.(string); ok {
				permissions = append(permissions, Permission(permStr))
			}
		}
	}

	metadata := make(map[string]interface{})
	if metadataClaim, ok := claims["metadata"].(map[string]interface{}); ok {
		metadata = metadataClaim
	}

	return &Identity{
		ID:         claims["sub"].(string),
		Type:       "service",
		Roles:      roles,
		Permissions: permissions,
		Metadata:   metadata,
		Issuer:     claims["iss"].(string),
		Subject:    claims["sub"].(string),
		ExpiresAt:  time.Unix(int64(claims["exp"].(float64)), 0),
		IssuedAt:   time.Unix(int64(claims["iat"].(float64)), 0),
	}
}

// RefreshAccessToken refreshes access token using refresh token
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) RefreshAccessToken(refreshToken string) (string, error) {
	identity, err := am.VerifyToken(refreshToken)
	if err != nil {
		return "", err
	}

	return am.GenerateAccessToken(*identity)
}

// AuthMiddleware creates HTTP middleware
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := am.ExtractTokenFromHeaders(r.Header)

		if token == "" {
			http.Error(w, "No token provided", http.StatusUnauthorized)
			return
		}

		identity, err := am.VerifyToken(token)
		if err != nil {
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Store identity in request context
		ctx := context.WithValue(r.Context(), "identity", identity)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequirePermissions creates permission-checking middleware
func (am *${toPascalCase(config.serviceName)}AuthMiddleware) RequirePermissions(permissions ...Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			identity := r.Context().Value("identity").(*Identity)

			result := am.CheckPermissions(identity, permissions)
			if !result.Allowed {
				http.Error(w, result.Reason, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Usage example
func main() {
	config := AuthConfig{
		ServiceName:        "${config.serviceName}",
		Algorithm:         "HS256",
		SecretOrPrivateKey: "your-secret-key",
		TokenExpiration:   3600,
		RefreshExpiration: 604800,
		Issuer:            "${config.serviceName}",
		Audience:          []string{"${config.serviceName}", "api"},
		DefaultRoles:      []RoleType{RoleTypeUser},
	}

	auth := New${toPascalCase(config.serviceName)}AuthMiddleware(config)

	identity := Identity{
		ID:    "user-123",
		Roles: []RoleType{RoleTypeUser},
		Permissions: []Permission{"read:*", "write:own"},
		Metadata: make(map[string]interface{}),
	}

	token, err := auth.GenerateAccessToken(identity)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	fmt.Println("Generated token:", token)

	verifiedIdentity, err := auth.VerifyToken(token)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	fmt.Println("Identity:", verifiedIdentity)

	result := auth.CheckPermissions(verifiedIdentity, []Permission{"read:data"})
	fmt.Println("Permission check:", result.Allowed)
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeAuthFiles(
  serviceName: string,
  integration: any,
  outputDir: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  for (const file of integration.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.ensureDir(fileDir);
    await fs.writeFile(filePath, file.content);
  }

  // Generate BUILD.md
  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayAuthConfig(config: AuthConfig): Promise<void> {
  console.log(chalk.bold.yellow('\n🔐 Authentication/Authorization: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Algorithm:'), config.algorithm);
  console.log(chalk.cyan('Issuer:'), config.issuer);
  console.log(chalk.cyan('Audience:'), config.audience.join(', '));
  console.log(chalk.cyan('Token Expiration:'), `${config.tokenExpiration}s (${Math.floor(config.tokenExpiration / 60)} minutes)`);
  console.log(chalk.cyan('Refresh Expiration:'), `${config.refreshExpiration}s (${Math.floor(config.refreshExpiration / 3600)} hours)`);
  console.log(chalk.cyan('RBAC:'), config.enableRBAC ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Refresh Tokens:'), config.enableRefreshTokens ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('API Tokens:'), config.enableAPITokens ? chalk.green('enabled') : chalk.red('disabled'));

  console.log(chalk.bold('\n👥 Default Roles:'));
  console.log(chalk.gray('  • admin: Full access (*)'));
  console.log(chalk.gray('  • moderator: read:*, write:*, delete:content'));
  console.log(chalk.gray('  • user: read:*, write:own'));
  console.log(chalk.gray('  • guest: read:public'));
  console.log(chalk.gray('  • service: service:call, service:register'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Authentication/Authorization Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This authentication/authorization system provides:
- **JWT Token Management**: Access and refresh token generation
- **Token Validation**: Verify JWT signatures and claims
- **Role-Based Access Control (RBAC)**: Define roles and permissions
- **Permission Checking**: Check user permissions for authorization
- **Token Refresh**: Automatic token refresh for expiring tokens
- **Multi-Language Support**: TypeScript, Python, Go implementations

## Dependencies

${integration.dependencies.map((d: string) => `- \`${d}\``).join('\n')}

## Build Steps

1. Install dependencies
2. Configure auth settings
3. Generate RSA keys (if using RS256)
4. Integrate auth middleware with your framework
5. Define roles and permissions

## Supported Algorithms

- **HS256**: HMAC-SHA256 (symmetric)
- **HS384**: HMAC-SHA384 (symmetric)
- **HS512**: HMAC-SHA512 (symmetric)
- **RS256**: RSA-SHA256 (asymmetric)
- **RS384**: RSA-SHA384 (asymmetric)
- **RS512**: RSA-SHA512 (asymmetric)

## Token Types

1. **Access Token**: Short-lived token for API access (default: 1 hour)
2. **Refresh Token**: Long-lived token for obtaining new access tokens (default: 7 days)
3. **ID Token**: Contains user identity information
4. **API Key**: Long-lived token for service-to-service communication

## Default Roles

### Admin
- Permissions: \`*\` (all permissions)
- Full system access

### Moderator
- Permissions: \`read:*\`, \`write:*\`, \`delete:content\`
- Inherits: \`user\`
- Elevated content management privileges

### User
- Permissions: \`read:*\`, \`write:own\`
- Standard user access

### Guest
- Permissions: \`read:public\`
- Limited public access

### Service
- Permissions: \`service:call\`, \`service:register\`
- Inter-service communication

## Usage

### TypeScript/Express

\`\`\`typescript
import { ${serviceName}AuthMiddleware, createAuthMiddleware, requirePermissions } from './auth';

const config = {
  serviceName: '${serviceName}',
  algorithm: 'HS256',
  secretOrPrivateKey: process.env.JWT_SECRET,
  tokenExpiration: 3600,
  refreshExpiration: 604800,
  issuer: '${serviceName}',
  audience: ['${serviceName}', 'api'],
};

const auth = new ${serviceName}AuthMiddleware(config);

// Apply auth middleware
app.use(createAuthMiddleware(auth));

// Protect routes
app.get('/api/data', requirePermissions('read:data'), (req, res) => {
  res.json({ data: 'secret' });
});

// Generate token
const token = await auth.generateAccessToken({
  id: 'user-123',
  roles: ['user'],
  permissions: ['read:*'],
});
\`\`\`

### Python/FastAPI

\`\`\`python
from ${serviceName}_auth import ${toPascalCase(serviceName)}AuthMiddleware, create_auth_dependency, require_permissions

config = {
    'serviceName': '${serviceName}',
    'algorithm': 'HS256',
    'secretOrPrivateKey': os.getenv('JWT_SECRET'),
    'tokenExpiration': 3600,
    'refreshExpiration': 604800,
    'issuer': '${serviceName}',
    'audience': ['${serviceName}', 'api'],
}

auth = ${toPascalCase(serviceName)}AuthMiddleware(config)

# Create dependency
get_current_user = create_auth_dependency(auth)

# Protect routes
@app.get("/api/data")
@require_permissions("read:data")
async def get_data(user: Identity = Depends(get_current_user_with_permissions)):
    return {"data": "secret"}
\`\`\`

### Go

\`\`\`go
import "yourpackage/${serviceName}-auth"

config := AuthConfig{
    ServiceName: "${serviceName}",
    Algorithm: "HS256",
    SecretOrPrivateKey: os.Getenv("JWT_SECRET"),
    TokenExpiration: 3600,
    RefreshExpiration: 604800,
    Issuer: "${serviceName}",
    Audience: []string{"${serviceName}", "api"},
}

auth := New${toPascalCase(serviceName)}AuthMiddleware(config)

// Apply middleware
mux.Use(auth.AuthMiddleware)

// Protect routes
mux.Handle("/api/data",
    auth.RequirePermissions("read:data")(http.HandlerFunc(handleData)),
)
\`\`\`

## Permission Format

Permissions use the format \`resource:action\`:

- \`read:data\` - Read data resource
- \`write:data\` - Write to data resource
- \`delete:content\` - Delete content
- \`read:*\` - Read any resource (wildcard)
- \`*\` - All permissions (superadmin)

## Token Refresh

Tokens close to expiration are automatically refreshed:

\`\`\`typescript
// Response includes new token in X-New-Access-Token header
if (response.headers['X-New-Access-Token']) {
  localStorage.setItem('token', response.headers['X-New-Access-Token']);
}
\`\`\`

## Security Best Practices

1. **Use RS256** for production (asymmetric encryption)
2. **Rotate keys** regularly
3. **Store secrets** in environment variables
4. **Use HTTPS** only
5. **Set appropriate expiration times**
6. **Implement token revocation** for logout
7. **Validate audience** and issuer
8. **Use short-lived access tokens**
9. **Store refresh tokens securely**
10. **Implement rate limiting** on auth endpoints

## Environment Variables

\`\`\`bash
# Required
JWT_SECRET=your-secret-key
JWT_ISSUER=${serviceName}

# Optional (for RS256)
JWT_PRIVATE_KEY=path/to/private.pem
JWT_PUBLIC_KEY=path/to/public.pem
JWT_JWKS_URL=https://auth.example.com/.well-known/jwks.json

# Token expiration
TOKEN_EXPIRATION=3600
REFRESH_TOKEN_EXPIRATION=604800
\`\`\`
`;
}
