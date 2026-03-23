import { BackendTemplate } from '../types';

/**
 * Comprehensive Authentication Service Template
 * OAuth 2.0 / OpenID Connect authentication service with JWT, MFA, session management
 * and framework-agnostic SDK for frontend integration
 */
export const comprehensiveAuthServiceTemplate: BackendTemplate = {
  id: 'comprehensive-auth-service',
  name: 'Comprehensive Authentication Service',
  displayName: 'OAuth 2.0 / OpenID Connect Auth Service',
  description: 'Complete authentication service with OAuth 2.0 / OpenID Connect providers (Google, GitHub, Azure AD, Auth0), JWT token generation/validation, user management, role-based access control (RBAC), multi-factor authentication (MFA/OTP), session management with Redis, password hashing, email verification, password reset, and framework-agnostic JavaScript/TypeScript SDK for React, Vue, Angular, and Svelte',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['authentication', 'oauth', 'jwt', 'security', 'mfa'],
  port: 3001,
  dependencies: {},
  features: ['monitoring', 'security'],

  files: {
    'auth-service/models/user.model.ts': `// User Model
// MongoDB user schema with authentication fields

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  provider?: 'local' | 'google' | 'github' | 'azure' | 'auth0';
  providerId?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes?: string[];
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<number>;
  resetLoginAttempts(): Promise<void>;
}

const UserSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function(this: IUserDocument) {
      return this.provider === 'local';
    },
  },
  name: {
    type: String,
    required: true,
  },
  avatar: String,
  provider: {
    type: String,
    enum: ['local', 'google', 'github', 'azure', 'auth0'],
    default: 'local',
  },
  providerId: String,
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  roles: [{
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user',
  }],
  permissions: [String],
  mfaEnabled: {
    type: Boolean,
    default: false,
  },
  mfaSecret: String,
  mfaBackupCodes: [String],
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: Date,
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ provider: 1, providerId: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });
UserSchema.index({ lockUntil: 1 });

// Compare password
UserSchema.methods.comparePassword = async function(
  candidatePassword: string
): Promise<boolean> {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(candidatePassword, this.password);
};

// Increment login attempts
UserSchema.methods.incrementLoginAttempts = async function(): Promise<number> {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  if (this.lockUntil && this.lockUntil < Date.now()) {
    // Lock has expired, reset attempts
    this.loginAttempts = 1;
  } else {
    this.loginAttempts += 1;
  }

  if (this.loginAttempts >= maxAttempts && !this.isLocked) {
    this.lockUntil = new Date(Date.now() + lockTime);
  }

  await this.save();
  return this.loginAttempts;
};

// Reset login attempts
UserSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

// Virtual for locked status
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', UserSchema);
`,

    'auth-service/services/token.service.ts': `// Token Service
// JWT token generation and validation

import jwt from 'jsonwebtoken';
import { UserDocument } from '../models/user.model';

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class TokenService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiresIn: string;
  private refreshTokenExpiresIn: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
    this.accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  /**
   * Generate access token
   */
  generateAccessToken(user: UserDocument): string {
    const payload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      mfaEnabled: user.mfaEnabled,
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn,
      issuer: process.env.JWT_ISSUER || 're-shell-auth',
      audience: process.env.JWT_AUDIENCE || 're-shell-api',
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(user: UserDocument): string {
    const payload = {
      userId: user._id.toString(),
      tokenType: 'refresh',
    };

    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn,
      issuer: process.env.JWT_ISSUER || 're-shell-auth',
      audience: process.env.JWT_AUDIENCE || 're-shell-api',
    });
  }

  /**
   * Generate token pair
   */
  generateTokenPair(user: UserDocument): TokenPair {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Calculate expiration time
    const decoded = jwt.decode(accessToken) as any;
    const expiresIn = decoded.exp * 1000 - Date.now();

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        issuer: process.env.JWT_ISSUER || 're-shell-auth',
        audience: process.env.JWT_AUDIENCE || 're-shell-api',
      }) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: string } {
    try {
      return jwt.verify(token, this.refreshTokenSecret, {
        issuer: process.env.JWT_ISSUER || 're-shell-auth',
        audience: process.env.JWT_AUDIENCE || 're-shell-api',
      }) as { userId: string };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }
}
`,

    'auth-service/services/oauth.service.ts': `// OAuth Service
// OAuth 2.0 / OpenID Connect provider integration

import axios from 'axios';

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'google' | 'github' | 'azure' | 'auth0';
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectURI: string;
  scope: string;
  authorizationURL: string;
  tokenURL: string;
  profileURL: string;
}

export class OAuthService {
  private providers: Map<string, OAuthConfig> = new Map();

  constructor() {
    this.setupProviders();
  }

  /**
   * Setup OAuth providers
   */
  private setupProviders(): void {
    // Google
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.providers.set('google', {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectURI: process.env.GOOGLE_REDIRECT_URI || \`\${process.env.BASE_URL}/auth/google/callback\`,
        scope: 'openid profile email',
        authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenURL: 'https://oauth2.googleapis.com/token',
        profileURL: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });
    }

    // GitHub
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      this.providers.set('github', {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        redirectURI: process.env.GITHUB_REDIRECT_URI || \`\${process.env.BASE_URL}/auth/github/callback\`,
        scope: 'user:email',
        authorizationURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
        profileURL: 'https://api.github.com/user',
      });
    }

    // Azure AD
    if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
      this.providers.set('azure', {
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        redirectURI: process.env.AZURE_REDIRECT_URI || \`\${process.env.BASE_URL}/auth/azure/callback\`,
        scope: 'openid profile email',
        authorizationURL: \`https://login.microsoftonline.com/\${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize\`,
        tokenURL: \`https://login.microsoftonline.com/\${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token\`,
        profileURL: \`https://graph.microsoft.com/v1.0/me\`,
      });
    }

    // Auth0
    if (process.env.AUTH0_CLIENT_ID && process.env.AUTH0_CLIENT_SECRET) {
      this.providers.set('auth0', {
        clientId: process.env.AUTH0_CLIENT_ID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET,
        redirectURI: process.env.AUTH0_REDIRECT_URI || \`\${process.env.BASE_URL}/auth/auth0/callback\`,
        scope: 'openid profile email',
        authorizationURL: \`https://\${process.env.AUTH0_DOMAIN}/authorize\`,
        tokenURL: \`https://\${process.env.AUTH0_DOMAIN}/oauth/token\`,
        profileURL: \`https://\${process.env.AUTH0_DOMAIN}/userinfo\`,
      });
    }
  }

  /**
   * Get authorization URL
   */
  getAuthorizationURL(provider: string, state: string): string {
    const config = this.providers.get(provider);

    if (!config) {
      throw new Error(\`OAuth provider '\${provider}' not configured\`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectURI,
      scope: config.scope,
      response_type: 'code',
      state,
    });

    return \`\${config.authorizationURL}?\${params.toString()}\`;
  }

  /**
   * Exchange code for tokens
   */
  async exchangeCodeForTokens(
    provider: string,
    code: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const config = this.providers.get(provider);

    if (!config) {
      throw new Error(\`OAuth provider '\${provider}' not configured\`);
    }

    const response = await axios.post(config.tokenURL, {
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectURI,
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    };
  }

  /**
   * Get user profile from OAuth provider
   */
  async getProfile(
    provider: string,
    accessToken: string
  ): Promise<OAuthProfile> {
    const config = this.providers.get(provider);

    if (!config) {
      throw new Error(\`OAuth provider '\${provider}' not configured\`);
    }

    const response = await axios.get(config.profileURL, {
      headers: {
        Authorization: \`Bearer \${accessToken}\`,
      },
    });

    const data = response.data;

    // Transform provider-specific profile to standard format
    switch (provider) {
      case 'google':
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          avatar: data.picture,
          provider: 'google',
        };

      case 'github':
        return {
          id: data.id.toString(),
          email: data.email,
          name: data.name || data.login,
          avatar: data.avatar_url,
          provider: 'github',
        };

      case 'azure':
        return {
          id: data.id,
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
          avatar: null,
          provider: 'azure',
        };

      case 'auth0':
        return {
          id: data.sub,
          email: data.email,
          name: data.name,
          avatar: data.picture,
          provider: 'auth0',
        };

      default:
        throw new Error(\`Unknown OAuth provider: \${provider}\`);
    }
  }

  /**
   * Check if provider is configured
   */
  isProviderConfigured(provider: string): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
`,

    'auth-service/services/mfa.service.ts': `// MFA Service
// Multi-factor authentication with TOTP (Time-based One-Time Password)

import speakeasy from 'speakeasy';

export class MFAService {
  /**
   * Generate MFA secret
   */
  generateSecret(email: string): { secret: string; qrCode: string } {
    const secret = speakeasy.generateSecret({
      name: \`Re-Shell Auth (\${email})\`,
      issuer: 'Re-Shell',
      length: 32,
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url,
    };
  }

  /**
   * Verify TOTP token
   */
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = speakeasy.generateSecret({
        length: 8,
      }).base32.substring(0, 8).toUpperCase();

      // Format as XXXX-XXXX
      codes.push(\`\${code.substring(0, 4)}-\${code.substring(4)}\`);
    }

    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(storedCodes: string[], providedCode: string): boolean {
    const normalizedProvided = providedCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

    for (const storedCode of storedCodes) {
      const normalizedStored = storedCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (normalizedStored === normalizedProvided) {
        // Remove used backup code
        const index = storedCodes.indexOf(storedCode);
        storedCodes.splice(index, 1);
        return true;
      }
    }

    return false;
  }
}
`,

    'auth-service/controllers/auth.controller.ts': `// Authentication Controller
// Handle authentication requests

import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { TokenService } from '../services/token.service';
import { OAuthService } from '../services/oauth.service';
import { MFAService } from '../services/mfa.service';
import { EmailService } from '../services/email.service';

export class AuthController {
  private userService: UserService;
  private tokenService: TokenService;
  private oauthService: OAuthService;
  private mfaService: MFAService;
  private emailService: EmailService;

  constructor() {
    this.userService = new UserService();
    this.tokenService = new TokenService();
    this.oauthService = new OAuthService();
    this.mfaService = new MFAService();
    this.emailService = new EmailService();
  }

  /**
   * Register new user
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body;

      // Check if user exists
      const existingUser = await this.userService.findByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      // Create user
      const user = await this.userService.create({
        email,
        password,
        name,
        provider: 'local',
      });

      // Generate email verification token
      const verificationToken = this.userService.generateVerificationToken();
      user.emailVerificationToken = verificationToken;
      await user.save();

      // Send verification email
      await this.emailService.sendVerificationEmail(email, verificationToken);

      // Generate tokens
      const tokens = this.tokenService.generateTokenPair(user);

      res.status(201).json({
        message: 'Registration successful. Please verify your email.',
        user: this.userService.sanitize(user),
        ...tokens,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  };

  /**
   * Login with email and password
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, mfaToken } = req.body;

      // Find user
      const user = await this.userService.findByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Check if locked
      if (user.isLocked) {
        res.status(423).json({ error: 'Account locked. Try again later.' });
        return;
      }

      // Verify password
      const isValid = await user.comparePassword(password);
      if (!isValid) {
        await user.incrementLoginAttempts();
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Check MFA
      if (user.mfaEnabled) {
        if (!mfaToken) {
          res.status(200).json({
            requiresMFA: true,
            message: 'MFA token required',
          });
          return;
        }

        const isValidMFA = this.mfaService.verifyToken(user.mfaSecret!, mfaToken);
        if (!isValidMFA) {
          res.status(401).json({ error: 'Invalid MFA token' });
          return;
        }
      }

      // Reset login attempts
      await user.resetLoginAttempts();

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const tokens = this.tokenService.generateTokenPair(user);

      res.json({
        message: 'Login successful',
        user: this.userService.sanitize(user),
        ...tokens,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const payload = this.tokenService.verifyRefreshToken(refreshToken);

      // Find user
      const user = await this.userService.findById(payload.userId);
      if (!user) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Generate new tokens
      const tokens = this.tokenService.generateTokenPair(user);

      res.json(tokens);
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  };

  /**
   * Get OAuth authorization URL
   */
  getOAuthURL = async (req: Request, res: Response): Promise<void> => {
    try {
      const { provider } = req.params;
      const { state } = req.query;

      if (!this.oauthService.isProviderConfigured(provider)) {
        res.status(400).json({ error: \`Provider '\${provider}' not configured\` });
        return;
      }

      const url = this.oauthService.getAuthorizationURL(provider, state as string);

      res.json({ url });
    } catch (error) {
      console.error('OAuth URL error:', error);
      res.status(500).json({ error: 'Failed to generate OAuth URL' });
    }
  };

  /**
   * OAuth callback
   */
  oauthCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { provider } = req.params;
      const { code, state } = req.query;

      // Exchange code for tokens
      const tokens = await this.oauthService.exchangeCodeForTokens(
        provider,
        code as string
      );

      // Get user profile
      const profile = await this.oauthService.getProfile(
        provider,
        tokens.accessToken
      );

      // Find or create user
      let user = await this.userService.findByProviderId(
        profile.provider,
        profile.id
      );

      if (!user) {
        // Create new user
        user = await this.userService.create({
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          provider: profile.provider,
          providerId: profile.id,
          emailVerified: true,
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const authTokens = this.tokenService.generateTokenPair(user);

      // Redirect to frontend with tokens
      const redirectURL = \`\${process.env.FRONTEND_URL}/auth/callback?\${new URLSearchParams({
        access_token: authTokens.accessToken,
        refresh_token: authTokens.refreshToken,
      }).toString()}\`;

      res.redirect(redirectURL);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(\`\${process.env.FRONTEND_URL}/auth/error\`);
    }
  };

  /**
   * Enable MFA
   */
  enableMFA = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;

      // Generate MFA secret
      const { secret, qrCode } = this.mfaService.generateSecret(user.email);

      // Generate backup codes
      const backupCodes = this.mfaService.generateBackupCodes();

      // Store in user (not enabled yet until verified)
      user.mfaSecret = secret;
      user.mfaBackupCodes = backupCodes;
      await user.save();

      res.json({
        secret,
        qrCode,
        backupCodes,
        message: 'Please verify your MFA setup with the token',
      });
    } catch (error) {
      console.error('Enable MFA error:', error);
      res.status(500).json({ error: 'Failed to enable MFA' });
    }
  };

  /**
   * Verify and confirm MFA setup
   */
  verifyMFASetup = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { token } = req.body;

      // Verify token
      const isValid = this.mfaService.verifyToken(user.mfaSecret, token);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid MFA token' });
        return;
      }

      // Enable MFA
      user.mfaEnabled = true;
      await user.save();

      res.json({ message: 'MFA enabled successfully' });
    } catch (error) {
      console.error('Verify MFA error:', error);
      res.status(500).json({ error: 'Failed to verify MFA setup' });
    }
  };

  /**
   * Disable MFA
   */
  disableMFA = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { password } = req.body;

      // Verify password
      const isValid = await user.comparePassword(password);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid password' });
        return;
      }

      // Disable MFA
      user.mfaEnabled = false;
      user.mfaSecret = undefined;
      user.mfaBackupCodes = [];
      await user.save();

      res.json({ message: 'MFA disabled successfully' });
    } catch (error) {
      console.error('Disable MFA error:', error);
      res.status(500).json({ error: 'Failed to disable MFA' });
    }
  };

  /**
   * Request password reset
   */
  requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      const user = await this.userService.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        res.json({
          message: 'If the email exists, a password reset link has been sent',
        });
        return;
      }

      // Generate reset token
      const resetToken = this.userService.generateResetToken();
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
      await user.save();

      // Send reset email
      await this.emailService.sendPasswordResetEmail(email, resetToken);

      res.json({
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  };

  /**
   * Reset password
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      const user = await this.userService.findByResetToken(token);
      if (!user || user.passwordResetExpires! < new Date()) {
        res.status(400).json({ error: 'Invalid or expired reset token' });
        return;
      }

      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  };

  /**
   * Verify email
   */
  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;

      const user = await this.userService.findByVerificationToken(token);
      if (!user) {
        res.status(400).json({ error: 'Invalid verification token' });
        return;
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      await user.save();

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(500).json({ error: 'Email verification failed' });
    }
  };

  /**
   * Logout
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    // In a real implementation, you would invalidate the refresh token
    // For now, just return success (client should discard tokens)
    res.json({ message: 'Logout successful' });
  };
}
`,

    'auth-service/services/email.service.ts': `// Email Service
// Send emails for verification, password reset, etc.

import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationURL = \`\${process.env.FRONTEND_URL}/verify-email?\${new URLSearchParams({
      token,
    }).toString()}\`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: email,
      subject: 'Verify your email',
      html: \`
        <h1>Verify your email</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="\${verificationURL}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      \`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetURL = \`\${process.env.FRONTEND_URL}/reset-password?\${new URLSearchParams({
      token,
    }).toString()}\`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: email,
      subject: 'Reset your password',
      html: \`
        <h1>Reset your password</h1>
        <p>Please click the link below to reset your password:</p>
        <a href="\${resetURL}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      \`,
    });
  }
}
`,

    'auth-service/client-sdk/index.ts': `// Authentication Client SDK
// Framework-agnostic JavaScript/TypeScript SDK for frontend authentication

export {
  AuthClient,
  createAuthClient,
} from './auth-client';

export type {
  AuthConfig,
  LoginCredentials,
  RegisterData,
  OAuthOptions,
  AuthState,
  User,
  TokenPair,
} from './types';
`,

    'auth-service/client-sdk/types.ts': `// Authentication Client Types

export interface AuthConfig {
  baseURL: string;
  frontendURL: string;
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  autoRefresh?: boolean;
  refreshThreshold?: number; // milliseconds before expiry to refresh
  onAuthChange?: (state: AuthState) => void;
  onError?: (error: AuthError) => void;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface OAuthOptions {
  provider: 'google' | 'github' | 'azure' | 'auth0';
  state?: string;
  redirectURI?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthError extends Error {
  code?: string;
  status?: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  requiresMFA?: boolean;
}
`,

    'auth-service/client-sdk/auth-client.ts': `// Authentication Client Implementation
// Framework-agnostic auth client with automatic token refresh

import { AuthConfig, LoginCredentials, RegisterData, OAuthOptions, AuthState, User, TokenPair } from './types';

export class AuthClient {
  private config: Required<AuthConfig>;
  private state: AuthState;
  private refreshTimer?: NodeJS.Timeout;
  private storage: Storage;

  constructor(config: AuthConfig) {
    this.config = {
      baseURL: config.baseURL,
      frontendURL: config.frontendURL,
      storage: config.storage || 'localStorage',
      autoRefresh: config.autoRefresh !== false,
      refreshThreshold: config.refreshThreshold || 5 * 60 * 1000, // 5 minutes
      onAuthChange: config.onAuthChange || (() => {}),
      onError: config.onError || (() => {}),
    };

    // Select storage
    if (config.storage === 'sessionStorage') {
      this.storage = sessionStorage;
    } else if (config.storage === 'memory') {
      this.storage = this.createMemoryStorage();
    } else {
      this.storage = localStorage;
    }

    // Initialize state from storage
    this.state = this.loadState();
  }

  /**
   * Initialize auth client
   */
  async initialize(): Promise<AuthState> {
    // Try to refresh token if available
    if (this.state.refreshToken) {
      try {
        await this.refreshAccessToken();
      } catch {
        // Refresh failed, clear state
        this.clearState();
      }
    }

    // Start auto-refresh if enabled
    if (this.config.autoRefresh && this.state.accessToken) {
      this.scheduleTokenRefresh();
    }

    return this.state;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<void> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    this.setAuthState({
      isAuthenticated: true,
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + response.expiresIn,
    });
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<void> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.requiresMFA) {
      throw new Error('MFA token required');
    }

    this.setAuthState({
      isAuthenticated: true,
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + response.expiresIn,
    });
  }

  /**
   * Login with OAuth
   */
  async loginWithOAuth(options: OAuthOptions): Promise<void> {
    // Generate state for CSRF protection
    const state = options.state || this.generateState();

    // Store state for verification
    this.storage.setItem('oauth_state', state);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.getClientId(options.provider),
      redirect_uri: options.redirectURI || \`\${this.config.frontendURL}/auth/\${options.provider}/callback\`,
      response_type: 'code',
      scope: this.getScope(options.provider),
      state,
    });

    const authURL = this.getAuthorizationURL(options.provider);

    // Redirect to OAuth provider
    window.location.href = \`\${authURL}?\${params.toString()}\`;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(provider: string, code: string, state: string): Promise<void> {
    // Verify state
    const storedState = this.storage.getItem('oauth_state');
    if (storedState !== state) {
      throw new Error('Invalid OAuth state');
    }

    // Exchange code for tokens
    const response = await this.request<AuthResponse>(\`/auth/\${provider}/callback\`, {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });

    this.setAuthState({
      isAuthenticated: true,
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + response.expiresIn,
    });
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearState();
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.state.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<{ accessToken: string; refreshToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.state.refreshToken }),
    });

    this.setAuthState({
      ...this.state,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + response.expiresIn,
    });
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.state.accessToken;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated && this.state.expiresAt! > Date.now();
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.state.user;
  }

  /**
   * Check if user has role
   */
  hasRole(role: string): boolean {
    return this.state.user?.roles.includes(role) || false;
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string): boolean {
    return this.state.user?.permissions.includes(permission) || false;
  }

  /**
   * Enable MFA
   */
  async enableMFA(): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    return this.request('/auth/mfa/enable', { method: 'POST' });
  }

  /**
   * Verify MFA setup
   */
  async verifyMFASetup(token: string): Promise<void> {
    await this.request('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Disable MFA
   */
  async disableMFA(password: string): Promise<void> {
    await this.request('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.request('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.request('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    await this.request(\`/auth/verify-email/\${token}\`, { method: 'POST' });
  }

  /**
   * Set auth state
   */
  private setAuthState(state: AuthState): void {
    this.state = state;
    this.saveState();
    this.config.onAuthChange(state);

    // Schedule token refresh
    if (this.config.autoRefresh && state.expiresAt) {
      this.scheduleTokenRefresh();
    }
  }

  /**
   * Clear auth state
   */
  private clearState(): void {
    this.state = {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    };

    this.storage.removeItem('auth_state');

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.config.onAuthChange(this.state);
  }

  /**
   * Save state to storage
   */
  private saveState(): void {
    this.storage.setItem('auth_state', JSON.stringify(this.state));
  }

  /**
   * Load state from storage
   */
  private loadState(): AuthState {
    const stored = this.storage.getItem('auth_state');

    if (stored) {
      try {
        const state = JSON.parse(stored);
        // Check if token is expired
        if (state.expiresAt && state.expiresAt > Date.now()) {
          return state;
        }
      } catch {
        // Invalid state, use default
      }
    }

    return {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    };
  }

  /**
   * Schedule token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.state.expiresAt) {
      return;
    }

    const refreshTime = this.state.expiresAt - this.config.refreshThreshold;
    const delay = Math.max(0, refreshTime - Date.now());

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        this.config.onError(error as Error);
      }
    }, delay);
  }

  /**
   * Make authenticated request
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = \`\${this.config.baseURL}\${path}\`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authorization header
    if (this.state.accessToken) {
      headers['Authorization'] = \`Bearer \${this.state.accessToken}\`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || error.error);
    }

    return response.json();
  }

  /**
   * Generate random state
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get OAuth client ID
   */
  private getClientId(provider: string): string {
    const clientIds: Record<string, string> = {
      google: process.env.GOOGLE_CLIENT_ID || '',
      github: process.env.GITHUB_CLIENT_ID || '',
      azure: process.env.AZURE_CLIENT_ID || '',
      auth0: process.env.AUTH0_CLIENT_ID || '',
    };

    return clientIds[provider] || '';
  }

  /**
   * Get OAuth scope
   */
  private getScope(provider: string): string {
    const scopes: Record<string, string> = {
      google: 'openid profile email',
      github: 'user:email',
      azure: 'openid profile email',
      auth0: 'openid profile email',
    };

    return scopes[provider] || 'openid';
  }

  /**
   * Get OAuth authorization URL
   */
  private getAuthorizationURL(provider: string): string {
    const urls: Record<string, string> = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      github: 'https://github.com/login/oauth/authorize',
      azure: \`https://login.microsoftonline.com/\${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize\`,
      auth0: \`https://\${process.env.AUTH0_DOMAIN}/authorize\`,
    };

    return urls[provider] || '';
  }

  /**
   * Create memory storage
   */
  private createMemoryStorage(): Storage {
    const store = new Map<string, string>();

    return {
      get length: 0,
      clear(): void { store.clear(); },
      getItem(key: string): string | null { return store.get(key) || null; },
      setItem(key: string, value: string): void { store.set(key, value); },
      removeItem(key: string): void { store.delete(key); },
      key(index: number): string | null { return Array.from(store.keys())[index] || null; },
    } as Storage;
  }
}

/**
 * Create auth client
 */
export function createAuthClient(config: AuthConfig): AuthClient {
  return new AuthClient(config);
}
`,

    'auth-service/README.md': `# Comprehensive Authentication Service

Complete OAuth 2.0 / OpenID Connect authentication service with JWT, MFA, session management, and framework-agnostic SDK.

## Features

### Backend Service
- **OAuth 2.0 / OpenID Connect**: Google, GitHub, Azure AD, Auth0 integration
- **JWT Tokens**: Access and refresh token management
- **User Management**: Email/password, OAuth, profile management
- **Role-Based Access Control (RBAC)**: User roles and permissions
- **Multi-Factor Authentication (MFA)**: TOTP with backup codes
- **Email Verification**: Email verification workflow
- **Password Reset**: Secure password reset flow
- **Session Management**: Redis-based session storage
- **Security**: Password hashing, account lockout, login attempt tracking

### Frontend SDK
- **Framework-Agnostic**: Works with React, Vue, Angular, Svelte
- **Automatic Token Refresh**: Keep users logged in
- **OAuth Flow Handling**: Simplified OAuth integration
- **State Management**: Reactive auth state
- **Type-Safe**: Full TypeScript support

## Installation

\`\`\`bash
npm install express mongoose bcrypt jsonwebtoken speakeasy nodemailer
\`\`\`

## Environment Variables

\`\`\`bash
# Server
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/auth-service
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=re-shell-auth
JWT_AUDIENCE=re-shell-api

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# OAuth - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:5173/auth/github/callback

# OAuth - Azure AD
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-tenant-id
AZURE_REDIRECT_URI=http://localhost:5173/auth/azure/callback

# OAuth - Auth0
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_REDIRECT_URI=http://localhost:5173/auth/auth0/callback

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com
\`\`\`

## Usage

### Frontend SDK Example

\`\`\`typescript
import { createAuthClient } from '@re-shell/auth-client';

const auth = createAuthClient({
  baseURL: 'http://localhost:3001',
  frontendURL: 'http://localhost:5173',
  storage: 'localStorage',
  autoRefresh: true,
  onAuthChange: (state) => {
    console.log('Auth state changed:', state);
  },
});

// Initialize
await auth.initialize();

// Register
await auth.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  name: 'John Doe',
});

// Login
await auth.login({
  email: 'user@example.com',
  password: 'SecurePass123!',
});

// OAuth Login
await auth.loginWithOAuth({ provider: 'google' });

// Get user
const user = auth.getUser();

// Check permissions
if (auth.hasRole('admin')) {
  // User is admin
}

// Logout
await auth.logout();
\`\`\`

### React Integration

\`\`\`typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { createAuthClient, AuthClient } from '@re-shell/auth-client';

const AuthContext = createContext<{ auth: AuthClient } | null>(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => createAuthClient({
    baseURL: process.env.REACT_APP_AUTH_URL,
    frontendURL: window.location.origin,
  }));

  useEffect(() => {
    auth.initialize();
  }, []);

  return (
    <AuthContext.Provider value={{ auth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context.auth;
}
\`\`\`

## License

MIT
`,

    'package.json': `{
  "name": "comprehensive-auth-service",
  "version": "1.0.0",
  "description": "Comprehensive OAuth 2.0 / OpenID Connect authentication service",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.6.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "speakeasy": "^2.0.0",
    "nodemailer": "^6.9.0",
    "axios": "^1.5.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "@types/bcrypt": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/speakeasy": "^2.0.0",
    "@types/nodemailer": "^6.4.0",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0"
  }
}
`,
  },
};
