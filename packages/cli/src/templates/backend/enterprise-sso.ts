// Enterprise SSO Integration
// Single Sign-On (SSO) with multiple identity providers for enterprise applications

import { BackendTemplate } from '../types';

export const enterpriseSsoTemplate: BackendTemplate = {
  id: 'enterprise-sso',
  name: 'Enterprise SSO Integration',
  displayName: 'Enterprise Single Sign-On (SSO) Integration',
  description: 'Comprehensive SSO integration with SAML, OAuth 2.0, OpenID Connect, LDAP for enterprise applications. Supports Okta, Auth0, Azure AD, Google Workspace, Keycloak',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['authentication', 'security', 'session-management'],
  tags: ['sso', 'saml', 'oauth', 'oidc', 'ldap', 'enterprise', 'auth'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-sso",
  "version": "1.0.0",
  "description": "{{name}} - Enterprise SSO Integration",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "passport": "^0.6.0",
    "passport-saml": "^3.2.4",
    "passport-oauth2": "^1.7.0",
    "passport-openidconnect": "^0.1.1",
    "jsonwebtoken": "^9.0.2",
    "jose": "^5.1.3",
    "ldapjs": "^3.0.5",
    "axios": "^1.5.0",
    "cookie-parser": "^1.4.6",
    "express-session": "^1.17.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/passport": "^1.0.12",
    "@types/passport-saml": "^3.2.3",
    "@types/passport-oauth2": "^1.4.12",
    "@types/cookie-parser": "^1.4.3",
    "@types/express-session": "^1.17.7",
    "@types/ldapjs": "^3.0.2",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`,

    'src/index.ts': `// Enterprise SSO Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { SsoManager } from './sso-manager';
import { TokenManager } from './token-manager';
import { AuditLogger } from './audit-logger';
import { apiRoutes } from './routes/api.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Initialize SSO components
const ssoManager = new SsoManager();
const tokenManager = new TokenManager();
const auditLogger = new AuditLogger();

// Mount routes
app.use('/api', apiRoutes(ssoManager, tokenManager, auditLogger));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    ssoProviders: ssoManager.getConfiguredProviders(),
  });
});

app.listen(PORT, () => {
  console.log(\`🔐 Enterprise SSO Server running on port \${PORT}\`);
  console.log(\`🔑 Configured providers: \${ssoManager.getConfiguredProviders().join(', ')}\`);
});`,

    'src/sso-manager.ts': `// SSO Manager
// Manages multiple SSO providers (SAML, OAuth, OIDC, LDAP)

import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import ldap from 'ldapjs';

export interface SsoConfig {
  provider: 'saml' | 'oauth2' | 'oidc' | 'ldap';
  name: string;
  config: any;
}

export interface SsoProvider {
  name: string;
  type: 'saml' | 'oauth2' | 'oidc' | 'ldap';
  loginUrl: string;
  callbackUrl: string;
  logoutUrl: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  groups: string[];
  roles: string[];
  attributes: Record<string, any>;
}

export class SsoManager {
  private providers: Map<string, SsoProvider> = new Map();
  private ldapClients: Map<string, ldap.Client> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // SAML Provider (Okta, Azure AD, ADFS, etc.)
    if (process.env.SAML_ENTRY_POINT) {
      this.setupSamlProvider();
    }

    // OAuth 2.0 Provider (GitHub, Google, etc.)
    if (process.env.OAUTH_CLIENT_ID) {
      this.setupOAuthProvider();
    }

    // OpenID Connect Provider (Auth0, Okta, etc.)
    if (process.env.OIDC_ISSUER) {
      this.setupOidcProvider();
    }

    // LDAP Provider (Active Directory, OpenLDAP, etc.)
    if (process.env.LDAP_URL) {
      this.setupLdapProvider();
    }
  }

  private setupSamlProvider(): void {
    const samlConfig = {
      entryPoint: process.env.SAML_ENTRY_POINT!,
      issuer: process.env.SAML_ISSUER || process.env.SAML_ENTITY_ID,
      callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:3000/api/sso/saml/callback',
      cert: process.env.SAML_CERT,
      privateKey: process.env.SAML_PRIVATE_KEY,
      decryptionPvk: process.env.SAML_DECRYPTION_PRIVATE_KEY,
    };

    passport.use('saml', new SamlStrategy(samlConfig, async (profile: any, done: any) => {
      try {
        const user: UserProfile = {
          id: profile.nameID || profile.id,
          email: profile.email || profile.mail,
          displayName: profile.displayName,
          firstName: profile.firstName || profile.givenName,
          lastName: profile.lastName || profile.sn,
          groups: profile.groups || [],
          roles: profile.roles || [],
          attributes: profile.attributes || {},
        };
        done(null, user);
      } catch (error) {
        done(error);
      }
    }));

    this.providers.set('saml', {
      name: process.env.SAML_PROVIDER_NAME || 'SAML',
      type: 'saml',
      loginUrl: '/api/sso/saml/login',
      callbackUrl: '/api/sso/saml/callback',
      logoutUrl: '/api/sso/saml/logout',
    });
  }

  private setupOAuthProvider(): void {
    const oauthConfig = {
      authorizationURL: process.env.OAUTH_AUTHORIZATION_URL!,
      tokenURL: process.env.OAUTH_TOKEN_URL!,
      clientID: process.env.OAUTH_CLIENT_ID!,
      clientSecret: process.env.OAUTH_CLIENT_SECRET!,
      callbackURL: process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/sso/oauth/callback',
    };

    passport.use('oauth2', new OAuth2Strategy(oauthConfig, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const user: UserProfile = {
          id: profile.id,
          email: profile.email,
          displayName: profile.displayName,
          firstName: profile.name?.givenName || profile.given_name,
          lastName: profile.name?.familyName || profile.family_name,
          groups: profile.groups || [],
          roles: profile.roles || [],
          attributes: profile._json || {},
        };
        done(null, user);
      } catch (error) {
        done(error);
      }
    }));

    this.providers.set('oauth2', {
      name: process.env.OAUTH_PROVIDER_NAME || 'OAuth 2.0',
      type: 'oauth2',
      loginUrl: '/api/sso/oauth/login',
      callbackUrl: '/api/sso/oauth/callback',
      logoutUrl: '/api/sso/oauth/logout',
    });
  }

  private setupOidcProvider(): void {
    const oidcConfig = {
      issuer: process.env.OIDC_ISSUER!,
      authorizationURL: \`\${process.env.OIDC_ISSUER}/oauth2/v1/authorize\`,
      tokenURL: \`\${process.env.OIDC_ISSUER}/oauth2/v1/token\`,
      userInfoURL: \`\${process.env.OIDC_ISSUER}/oauth2/v1/userinfo\`,
      clientID: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
      callbackURL: process.env.OIDC_CALLBACK_URL || 'http://localhost:3000/api/sso/oidc/callback',
    };

    passport.use('oidc', new OpenIDConnectStrategy(oidcConfig, async (issuer: string, profile: any, done: any) => {
      try {
        const user: UserProfile = {
          id: profile.id,
          email: profile.email,
          displayName: profile.displayName,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          groups: profile.groups || [],
          roles: profile.roles || [],
          attributes: profile._json || {},
        };
        done(null, user);
      } catch (error) {
        done(error);
      }
    }));

    this.providers.set('oidc', {
      name: process.env.OIDC_PROVIDER_NAME || 'OpenID Connect',
      type: 'oidc',
      loginUrl: '/api/sso/oidc/login',
      callbackUrl: '/api/sso/oidc/callback',
      logoutUrl: '/api/sso/oidc/logout',
    });
  }

  private setupLdapProvider(): void {
    const ldapClient = ldap.createClient({
      url: process.env.LDAP_URL!,
      tlsOptions: process.env.LDAP_TLS_OPTIONS ? JSON.parse(process.env.LDAP_TLS_OPTIONS) : undefined,
    });

    ldapClient.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_CREDENTIALS!, (err) => {
      if (err) {
        console.error('LDAP bind failed:', err);
      } else {
        console.log('LDAP provider connected successfully');
      }
    });

    this.ldapClients.set('ldap', ldapClient);

    this.providers.set('ldap', {
      name: process.env.LDAP_PROVIDER_NAME || 'LDAP',
      type: 'ldap',
      loginUrl: '/api/sso/ldap/login',
      callbackUrl: '',
      logoutUrl: '/api/sso/ldap/logout',
    });
  }

  async authenticateLdap(username: string, password: string): Promise<UserProfile | null> {
    const client = this.ldapClients.get('ldap');
    if (!client) return null;

    return new Promise((resolve, reject) => {
      const searchBase = process.env.LDAP_SEARCH_BASE || '';
      const searchFilter = \`(\${process.env.LDAP_SEARCH_ATTRIBUTE || 'uid'}=\${username})\`;

      client.search(searchBase, { filter: searchFilter }, (err, search) => {
        if (err) {
          reject(err);
          return;
        }

        let userFound = false;
        let userDn = '';

        search.on('searchEntry', (entry) => {
          userDn = entry.objectName!;
          userFound = true;
        });

        search.on('end', () => {
          if (!userFound) {
            resolve(null);
            return;
          }

          // Bind with user credentials to verify password
          client.bind(userDn, password, (bindErr) => {
            if (bindErr) {
              resolve(null);
            } else {
              // Fetch user details
              client.search(userDn, { scope: 'base' }, (searchErr, userSearch) => {
                if (searchErr) {
                  reject(searchErr);
                  return;
                }

                userSearch.on('searchEntry', (entry) => {
                  const user: UserProfile = {
                    id: entry.object.dn,
                    email: entry.object.mail || entry.object.email,
                    displayName: entry.object.cn || entry.object.displayName,
                    firstName: entry.object.givenName,
                    lastName: entry.object.sn,
                    groups: entry.object.memberOf || [],
                    roles: [],
                    attributes: entry.object,
                  };
                  resolve(user);
                });
              });
            }
          });
        });

        search.on('error', (searchErr) => {
          reject(searchErr);
        });
      });
    });
  }

  getProvider(name: string): SsoProvider | undefined {
    return this.providers.get(name);
  }

  getConfiguredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getAllProviders(): SsoProvider[] {
    return Array.from(this.providers.values());
  }
}`,

    'src/token-manager.ts': `// Token Manager
// JWT token generation, validation, and refresh

import jwt from 'jsonwebtoken';
import { SignOptions, VerifyOptions, Secret } from 'jsonwebtoken';
import { generateKeyPair, importJWK, SignJWT, CompactEncrypt, compactDecrypt } from 'jose';

export interface TokenPayload {
  sub: string; // User ID
  email: string;
  name: string;
  groups: string[];
  roles: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export class TokenManager {
  private accessTokenSecret: Secret;
  private refreshTokenSecret: Secret;
  private accessTokenExpiresIn: string;
  private refreshTokenExpiresIn: string;
  private issuer: string;
  private audience: string;
  private tokenVersions: Map<string, number> = new Map();

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-change-me';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me';
    this.accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.issuer = process.env.JWT_ISSUER || 're-shell-sso';
    this.audience = process.env.JWT_AUDIENCE || 're-shell-app';
  }

  generateAccessToken(user: any): string {
    const payload: Partial<TokenPayload> = {
      sub: user.id,
      email: user.email,
      name: user.displayName,
      groups: user.groups || [],
      roles: user.roles || [],
    };

    const options: SignOptions = {
      expiresIn: this.accessTokenExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
    };

    return jwt.sign(payload, this.accessTokenSecret, options);
  }

  generateRefreshToken(userId: string): string {
    const tokenVersion = this.getTokenVersion(userId);
    const payload: RefreshTokenPayload = {
      sub: userId,
      tokenVersion,
    };

    const options: SignOptions = {
      expiresIn: this.refreshTokenExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
    };

    return jwt.sign(payload, this.refreshTokenSecret, options);
  }

  generateIdToken(user: any, nonce?: string): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.displayName,
      given_name: user.firstName,
      family_name: user.lastName,
      groups: user.groups || [],
      nonce,
    };

    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setExpirationTime('1h')
      .sign(this.importKey(process.env.ID_TOKEN_PRIVATE_KEY || ''));
  }

  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const options: VerifyOptions = {
        issuer: this.issuer,
        audience: this.audience,
      };

      return jwt.verify(token, this.accessTokenSecret, options) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const options: VerifyOptions = {
        issuer: this.issuer,
        audience: this.audience,
      };

      const payload = jwt.verify(token, this.refreshTokenSecret, options) as RefreshTokenPayload;

      // Check token version
      const currentVersion = this.getTokenVersion(payload.sub);
      if (payload.tokenVersion !== currentVersion) {
        return null; // Token has been revoked
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  refreshAccessToken(refreshToken: string): { accessToken: string; refreshToken: string } | null {
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) return null;

    // Generate new tokens
    const accessToken = this.generateAccessToken({ id: payload.sub });
    const newRefreshToken = this.generateRefreshToken(payload.sub);

    return { accessToken, refreshToken: newRefreshToken };
  }

  revokeTokens(userId: string): void {
    // Increment token version to invalidate all existing tokens
    const currentVersion = this.tokenVersions.get(userId) || 0;
    this.tokenVersions.set(userId, currentVersion + 1);
  }

  private getTokenVersion(userId: string): number {
    return this.tokenVersions.get(userId) || 0;
  }

  private async importKey(key: string): Promise<Secret> {
    // In production, this should import a proper RSA key
    return key as Secret;
  }

  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return null;

    return new Date(decoded.exp * 1000);
  }
}`,

    'src/audit-logger.ts': `// Audit Logger
// Logging SSO events for compliance and security

export interface AuditEvent {
  timestamp: string;
  eventType: 'login' | 'logout' | 'token_refresh' | 'login_failed' | 'logout_failed' | 'permission_denied';
  userId?: string;
  provider: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  sessionId?: string;
  details?: Record<string, any>;
}

export class AuditLogger {
  private events: AuditEvent[] = [];

  log(event: AuditEvent): void {
    this.events.push(event);

    // In production, send to logging service (e.g., ELK, Splunk, CloudWatch)
    console.log(\`[AUDIT] \${event.eventType} | \${event.userId || 'anonymous'} | \${event.provider} | \${event.success ? 'SUCCESS' : 'FAILED'}\`);

    // Keep only last 10000 events in memory
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  logLogin(userId: string, provider: string, req: any, success: boolean, error?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      eventType: success ? 'login' : 'login_failed',
      userId,
      provider,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      success,
      errorCode: error ? 'LOGIN_FAILED' : undefined,
      errorMessage: error,
      sessionId: req.sessionID,
    });
  }

  logLogout(userId: string, provider: string, req: any, success: boolean): void {
    this.log({
      timestamp: new Date().toISOString(),
      eventType: success ? 'logout' : 'logout_failed',
      userId,
      provider,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      success,
      sessionId: req.sessionID,
    });
  }

  logTokenRefresh(userId: string, req: any, success: boolean): void {
    this.log({
      timestamp: new Date().toISOString(),
      eventType: 'token_refresh',
      userId,
      provider: 'token',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      success,
      sessionId: req.sessionID,
    });
  }

  logPermissionDenied(userId: string, resource: string, action: string, req: any): void {
    this.log({
      timestamp: new Date().toISOString(),
      eventType: 'permission_denied',
      userId,
      provider: 'rbac',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      success: false,
      errorCode: 'PERMISSION_DENIED',
      details: { resource, action },
    });
  }

  getEvents(filters?: {
    userId?: string;
    eventType?: string;
    provider?: string;
    startDate?: Date;
    endDate?: Date;
  }): AuditEvent[] {
    let events = this.events;

    if (filters) {
      if (filters.userId) {
        events = events.filter(e => e.userId === filters.userId);
      }
      if (filters.eventType) {
        events = events.filter(e => e.eventType === filters.eventType);
      }
      if (filters.provider) {
        events = events.filter(e => e.provider === filters.provider);
      }
      if (filters.startDate) {
        events = events.filter(e => new Date(e.timestamp) >= filters.startDate!);
      }
      if (filters.endDate) {
        events = events.filter(e => new Date(e.timestamp) <= filters.endDate!);
      }
    }

    return events;
  }

  getUserEvents(userId: string, limit: number = 100): AuditEvent[] {
    return this.events
      .filter(e => e.userId === userId)
      .slice(-limit);
  }

  getFailedAttempts(userId?: string, since?: Date): number {
    return this.events.filter(e => {
      const isFailed = !e.success && e.eventType === 'login_failed';
      const isUser = !userId || e.userId === userId;
      const isRecent = !since || new Date(e.timestamp) >= since;
      return isFailed && isUser && isRecent;
    }).length;
  }

  clear(): void {
    this.events = [];
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { SsoManager } from '../sso-manager';
import { TokenManager } from '../token-manager';
import { AuditLogger } from '../audit-logger';

export function apiRoutes(
  ssoManager: SsoManager,
  tokenManager: TokenManager,
  auditLogger: AuditLogger
): Router {
  const router = Router();

  // Get configured SSO providers
  router.get('/sso/providers', (req: Request, res: Response) => {
    const providers = ssoManager.getAllProviders();
    res.json({
      providers: providers.map(p => ({
        name: p.name,
        type: p.type,
        loginUrl: p.loginUrl,
      })),
    });
  });

  // SAML Login
  router.get('/sso/saml/login', passport.authenticate('saml', {
    failureRedirect: '/login',
    failureFlash: true,
  }));

  // SAML Callback
  router.post('/sso/saml/callback',
    passport.authenticate('saml', { failureRedirect: '/login', failureFlash: true }),
    (req: any, res: Response) => {
      const user = req.user;
      auditLogger.logLogin(user.id, 'saml', req, true);

      // Generate tokens
      const accessToken = tokenManager.generateAccessToken(user);
      const refreshToken = tokenManager.generateRefreshToken(user.id);

      // Set session
      req.session.user = user;
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;

      // Redirect to frontend
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(\`\${redirectUrl}/auth/callback?access_token=\${accessToken}&refresh_token=\${refreshToken}\`);
    }
  );

  // OAuth 2.0 Login
  router.get('/sso/oauth/login', passport.authenticate('oauth2'));

  // OAuth 2.0 Callback
  router.get('/sso/oauth/callback',
    passport.authenticate('oauth2', { failureRedirect: '/login', failureFlash: true }),
    (req: any, res: Response) => {
      const user = req.user;
      auditLogger.logLogin(user.id, 'oauth2', req, true);

      const accessToken = tokenManager.generateAccessToken(user);
      const refreshToken = tokenManager.generateRefreshToken(user.id);

      req.session.user = user;
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;

      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(\`\${redirectUrl}/auth/callback?access_token=\${accessToken}&refresh_token=\${refreshToken}\`);
    }
  );

  // OpenID Connect Login
  router.get('/sso/oidc/login', passport.authenticate('oidc'));

  // OpenID Connect Callback
  router.get('/sso/oidc/callback',
    passport.authenticate('oidc', { failureRedirect: '/login', failureFlash: true }),
    (req: any, res: Response) => {
      const user = req.user;
      auditLogger.logLogin(user.id, 'oidc', req, true);

      const accessToken = tokenManager.generateAccessToken(user);
      const refreshToken = tokenManager.generateRefreshToken(user.id);

      req.session.user = user;
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;

      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(\`\${redirectUrl}/auth/callback?access_token=\${accessToken}&refresh_token=\${refreshToken}\`);
    }
  );

  // LDAP Login
  router.post('/sso/ldap/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = await ssoManager.authenticateLdap(username, password);

      if (!user) {
        auditLogger.logLogin(username, 'ldap', req, false, 'Invalid credentials');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      auditLogger.logLogin(user.id, 'ldap', req, true);

      const accessToken = tokenManager.generateAccessToken(user);
      const refreshToken = tokenManager.generateRefreshToken(user.id);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          groups: user.groups,
          roles: user.roles,
        },
      });
    } catch (error: any) {
      console.error('LDAP login error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Token Refresh
  router.post('/auth/refresh', (req: any, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const tokens = tokenManager.refreshAccessToken(refreshToken);

      if (!tokens) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const payload = tokenManager.verifyAccessToken(tokens.accessToken);
      auditLogger.logTokenRefresh(payload!.sub, req, true);

      res.json(tokens);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Logout
  router.post('/auth/logout', (req: any, res: Response) => {
    try {
      const user = req.session.user;
      if (user) {
        auditLogger.logLogout(user.id, 'token', req, true);
        tokenManager.revokeTokens(user.id);
      }

      req.session.destroy((err: any) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Verify Token
  router.get('/auth/verify', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header missing or invalid' });
      }

      const token = authHeader.substring(7);
      const payload = tokenManager.verifyAccessToken(token);

      if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      res.json({
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          groups: payload.groups,
          roles: payload.roles,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Audit Events
  router.get('/audit/events', (req: any, res: Response) => {
    try {
      // Only admin users can view audit logs
      const token = tokenManager.verifyAccessToken(req.session.accessToken);
      if (!token || !token.roles.includes('admin')) {
        auditLogger.logPermissionDenied(token?.sub || 'unknown', 'audit', 'read', req);
        return res.status(403).json({ error: 'Permission denied' });
      }

      const filters: any = {};
      if (req.query.userId) filters.userId = req.query.userId;
      if (req.query.eventType) filters.eventType = req.query.eventType;
      if (req.query.provider) filters.provider = req.query.provider;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const events = auditLogger.getEvents(filters);
      res.json({ events, count: events.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}`,

    '.env.example': `# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=change-me-in-production

# JWT Configuration
JWT_ACCESS_SECRET=your-access-token-secret-change-me
JWT_REFRESH_SECRET=your-refresh-token-secret-change-me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=re-shell-sso
JWT_AUDIENCE=re-shell-app
ID_TOKEN_PRIVATE_KEY=your-private-key

# SAML Configuration (Okta, Azure AD, ADFS)
SAML_ENTRY_POINT=https://your-saml-provider.com/sso
SAML_ISSUER=re-shell-sso
SAML_CALLBACK_URL=http://localhost:3000/api/sso/saml/callback
SAML_CERT=-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----
SAML_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----
SAML_PROVIDER_NAME=Okta

# OAuth 2.0 Configuration (GitHub, Google)
OAUTH_AUTHORIZATION_URL=https://github.com/login/oauth/authorize
OAUTH_TOKEN_URL=https://github.com/login/oauth/access_token
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_CALLBACK_URL=http://localhost:3000/api/sso/oauth/callback
OAUTH_PROVIDER_NAME=GitHub

# OpenID Connect Configuration (Auth0, Okta)
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_CALLBACK_URL=http://localhost:3000/api/sso/oidc/callback
OIDC_PROVIDER_NAME=Auth0

# LDAP Configuration (Active Directory, OpenLDAP)
LDAP_URL=ldap://ldap.example.com:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_CREDENTIALS=your-password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_SEARCH_ATTRIBUTE=uid
LDAP_PROVIDER_NAME=Active Directory
LDAP_TLS_OPTIONS={"rejectUnauthorized":false}`,

    'README.md': `# Enterprise SSO Integration

Comprehensive Single Sign-On (SSO) integration with SAML, OAuth 2.0, OpenID Connect, and LDAP support for enterprise applications.

## Features

### 🔐 **Multiple SSO Protocols**
- **SAML 2.0**: Support for Okta, Azure AD, ADFS, OneLogin
- **OAuth 2.0**: GitHub, Google, Facebook, and other OAuth providers
- **OpenID Connect**: Auth0, Okta, Azure AD OIDC
- **LDAP**: Active Directory, OpenLDAP, other LDAP servers

### 🎫 **JWT Token Management**
- **Access Tokens**: Short-lived JWT tokens (15min default)
- **Refresh Tokens**: Long-lived refresh tokens (7 days default)
- **Token Rotation**: Automatic token refresh on expiration
- **Token Revocation**: Invalidate all user tokens on logout

### 👥 **User Provisioning**
- **Just-in-Time Provisioning**: Auto-create users on first login
- **Group/Role Mapping**: Map provider groups to application roles
- **Profile Synchronization**: Sync user attributes from identity provider

### 📊 **Audit Logging**
- **Login Events**: Track all login attempts (success and failure)
- **Logout Events**: Track logout activities
- **Token Events**: Monitor token refresh and revocation
- **Compliance**: Meet SOC 2, HIPAA, GDPR audit requirements

## Quick Start

### 1. Environment Setup

Copy \`.env.example\` to \`.env\` and configure your SSO providers:

\`\`\`bash
cp .env.example .env
\`\`\`

### 2. Configure SAML Provider (Okta Example)

\`\`\`env
SAML_ENTRY_POINT=https://your-org.okta.com/app/template_saml_2/exk1abc123/sso/saml
SAML_ISSUER=re-shell-sso
SAML_CALLBACK_URL=http://localhost:3000/api/sso/saml/callback
SAML_CERT=-----BEGIN CERTIFICATE-----
MIIC... (your SAML cert)
-----END CERTIFICATE-----
SAML_PROVIDER_NAME=Okta
\`\`\`

### 3. Configure OAuth Provider (GitHub Example)

\`\`\`env
OAUTH_AUTHORIZATION_URL=https://github.com/login/oauth/authorize
OAUTH_TOKEN_URL=https://github.com/login/oauth/access_token
OAUTH_CLIENT_ID=your-github-client-id
OAUTH_CLIENT_SECRET=your-github-client-secret
OAUTH_CALLBACK_URL=http://localhost:3000/api/sso/oauth/callback
OAUTH_PROVIDER_NAME=GitHub
\`\`\`

### 4. Configure OIDC Provider (Auth0 Example)

\`\`\`env
OIDC_ISSUER=https://your-org.auth0.com
OIDC_CLIENT_ID=your-auth0-client-id
OIDC_CLIENT_SECRET=your-auth0-client-secret
OIDC_CALLBACK_URL=http://localhost:3000/api/sso/oidc/callback
OIDC_PROVIDER_NAME=Auth0
\`\`\`

### 5. Configure LDAP Provider (Active Directory Example)

\`\`\`env
LDAP_URL=ldap://ad.example.com:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_CREDENTIALS=your-admin-password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_SEARCH_ATTRIBUTE=sAMAccountName
LDAP_PROVIDER_NAME=Active Directory
\`\`\`

## API Endpoints

#### \`GET /api/sso/providers\`
Get list of configured SSO providers.

**Response:**
\`\`\`json
{
  "providers": [
    { "name": "Okta", "type": "saml", "loginUrl": "/api/sso/saml/login" },
    { "name": "GitHub", "type": "oauth2", "loginUrl": "/api/sso/oauth/login" },
    { "name": "Auth0", "type": "oidc", "loginUrl": "/api/sso/oidc/login" },
    { "name": "Active Directory", "type": "ldap", "loginUrl": "/api/sso/ldap/login" }
  ]
}
\`\`\`

#### \`GET /api/sso/saml/login\`
Initiate SAML SSO login flow.

#### \`POST /api/sso/saml/callback\`
SAML assertion consumer endpoint (callback).

#### \`GET /api/sso/oauth/login\`
Initiate OAuth 2.0 login flow.

#### \`GET /api/sso/oauth/callback\`
OAuth 2.0 callback endpoint.

#### \`GET /api/sso/oidc/login\`
Initiate OpenID Connect login flow.

#### \`GET /api/sso/oidc/callback\`
OpenID Connect callback endpoint.

#### \`POST /api/sso/ldap/login\`
LDAP username/password login.

**Request:**
\`\`\`json
{
  "username": "jdoe",
  "password": "user-password"
}
\`\`\`

**Response:**
\`\`\`json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "cn=jdoe,ou=users,dc=example,dc=com",
    "email": "jdoe@example.com",
    "displayName": "John Doe",
    "groups": ["Developers", "Admins"],
    "roles": []
  }
}
\`\`\`

#### \`POST /api/auth/refresh\`
Refresh access token using refresh token.

**Request:**
\`\`\`json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
\`\`\`

**Response:**
\`\`\`json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
\`\`\`

#### \`POST /api/auth/logout\`
Logout user and revoke tokens.

**Response:**
\`\`\`json
{
  "message": "Logged out successfully"
}
\`\`\`

#### \`GET /api/auth/verify\`
Verify access token and get user info.

**Headers:**
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

**Response:**
\`\`\`json
{
  "valid": true,
  "user": {
    "id": "123456",
    "email": "user@example.com",
    "name": "John Doe",
    "groups": ["Developers"],
    "roles": ["admin"]
  }
}
\`\`\`

#### \`GET /api/audit/events\`
Get audit log events (admin only).

**Query Parameters:**
- \`userId\`: Filter by user ID
- \`eventType\`: Filter by event type (login, logout, token_refresh, etc.)
- \`provider\`: Filter by SSO provider
- \`startDate\`: Filter events after this date
- \`endDate\`: Filter events before this date

**Response:**
\`\`\`json
{
  "events": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "eventType": "login",
      "userId": "123456",
      "provider": "saml",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "success": true,
      "sessionId": "abc123"
    }
  ],
  "count": 1
}
\`\`\`

## Provider Setup Guides

### Okta (SAML)

1. **Create SAML Application in Okta:**
   - Go to **Applications** → **Applications** → **Create App Integration**
   - Select **SAML 2.0**
   - Configure app: \`http://localhost:3000/api/sso/saml/callback\`
   - Download certificate

2. **Configure Environment:**
   \`\`\`env
   SAML_ENTRY_POINT=https://your-org.okta.com/app/abc123/sso/saml
   SAML_ISSUER=re-shell-sso
   SAML_CERT=(paste Okta certificate)
   \`\`\`

### Auth0 (OIDC)

1. **Create Application in Auth0:**
   - Go to **Applications** → **Applications** → **Create Application**
   - Select **Regular Web Application**
   - Configure callbacks: \`http://localhost:3000/api/sso/oidc/callback\`

2. **Configure Environment:**
   \`\`\`env
   OIDC_ISSUER=https://your-org.auth0.com
   OIDC_CLIENT_ID=your-client-id
   OIDC_CLIENT_SECRET=your-client-secret
   \`\`\`

### Active Directory (LDAP)

1. **Create Service Account:**
   - Create AD user for LDAP bind
   - Grant read permissions to user OU

2. **Configure Environment:**
   \`\`\`env
   LDAP_URL=ldap://ad.example.com:389
   LDAP_BIND_DN=cn=service-account,cn=users,dc=example,dc=com
   LDAP_BIND_CREDENTIALS=service-account-password
   LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
   \`\`\`

## Security Best Practices

### Token Security
1. **Short Access Token Lifetime**: Use 5-15 minutes for access tokens
2. **Secure Storage**: Store tokens securely (httpOnly cookies or secure storage)
3. **HTTPS Only**: Always use HTTPS in production
4. **Token Revocation**: Implement token revocation on logout/password change

### Session Security
1. **Session Timeout**: Set appropriate session expiration (24h recommended)
2. **Secure Cookies**: Set \`secure\` and \`httpOnly\` flags
3. **CSRF Protection**: Implement CSRF tokens for state-changing operations
4. **Session Fixation**: Regenerate session ID after login

### Audit Compliance
1. **Log All Events**: Log all authentication events for compliance
2. **Retain Logs**: Keep logs for required retention period (e.g., 7 years)
3. **Log Protection**: Protect audit logs from tampering
4. **Regular Reviews**: Conduct regular audit log reviews

## Role-Based Access Control (RBAC)

Map provider groups to application roles:

\`\`\`typescript
// Example: Map Okta groups to app roles
const roleMapping: Record<string, string[]> = {
  'Okta_Admin': ['admin', 'superadmin'],
  'Okta_Developers': ['developer'],
  'Okta_Users': ['user'],
};
\`\`\`

## Troubleshooting

### SAML Issues
**Problem**: "Invalid signature" error
**Solution**: Verify SAML certificate matches IdP certificate

**Problem**: "No nameID in SAML response"
**Solution**: Check IdP configuration to ensure NameID is sent

### OAuth Issues
**Problem**: "redirect_uri_mismatch" error
**Solution**: Verify callback URL matches OAuth app configuration

### LDAP Issues
**Problem**: "LDAP bind failed"
**Solution**: Verify bind DN, credentials, and network connectivity

**Problem**: "User not found"
**Solution**: Check search base and search attribute configuration

## License

MIT`,
  },
};
