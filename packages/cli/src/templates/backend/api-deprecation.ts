import { BackendTemplate } from '../types';

/**
 * API Deprecation Management and Migration Tools Template
 * Complete deprecation solution with sunset headers, migration guides, and automated notifications
 */
export const apiDeprecationTemplate: BackendTemplate = {
  id: 'api-deprecation',
  name: 'api-deprecation',
  displayName: 'API Deprecation Management & Migration Tools',
  description: 'Complete API deprecation solution with sunset headers, automated migration guides, version compatibility tracking, notification system, and deprecation monitoring dashboard',
  language: 'javascript',
  framework: 'deprecation',
  version: '1.0.0',
  tags: ['deprecation', 'migration', 'sunset', 'api-versioning', 'compatibility', 'monitoring'],
  port: 3000,
  dependencies: {},
  features: ['deprecation', 'monitoring', 'docker', 'rest-api'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "deprecation-report": "node scripts/generate-deprecation-report.js",
    "notify-users": "node scripts/notify-deprecated-users.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ioredis": "^5.3.2",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.7",
    "helmet": "^7.1.0"
  }
}
`,

    'deprecation/deprecation-registry.js': `/**
 * API Deprecation Registry
 * Central registry for all deprecated endpoints and their migration paths
 */

class DeprecationRegistry {
  constructor() {
    this.deprecations = new Map();
    this.loadRegistry();
  }

  loadRegistry() {
    const deprecations = [
      {
        endpoint: '/api/v1/users',
        method: 'GET',
        deprecatedAt: '2024-01-01',
        sunsetAt: '2024-06-30',
        replacement: '/api/v2/users',
        migrationGuide: 'https://docs.example.com/migration/users-v1-to-v2',
        reason: 'Improved response format with additional user metadata',
        affectedClients: ['mobile-app-v1', 'legacy-integration'],
        breakdownPercentage: 5
      },
      {
        endpoint: '/api/v1/orders',
        method: 'POST',
        deprecatedAt: '2024-02-01',
        sunsetAt: '2024-08-31',
        replacement: '/api/v2/orders',
        migrationGuide: 'https://docs.example.com/migration/orders-v1-to-v2',
        reason: 'Enhanced validation and error handling',
        affectedClients: ['web-portal', 'pos-system'],
        breakdownPercentage: 12
      },
      {
        endpoint: '/api/v1/products/search',
        method: 'GET',
        deprecatedAt: '2024-03-01',
        sunsetAt: '2024-09-30',
        replacement: '/api/v2/catalog/search',
        migrationGuide: 'https://docs.example.com/migration/search-v1-to-v2',
        reason: 'New search engine with improved relevance',
        affectedClients: ['mobile-app', 'partner-api'],
        breakdownPercentage: 8
      },
      {
        endpoint: '/api/v1/auth/login',
        method: 'POST',
        deprecatedAt: '2024-04-01',
        sunsetAt: '2024-12-31',
        replacement: '/api/v2/auth/signin',
        migrationGuide: 'https://docs.example.com/migration/auth-v1-to-v2',
        reason: 'Enhanced security with MFA support',
        affectedClients: ['mobile-app-v1', 'desktop-app'],
        breakdownPercentage: 3
      }
    ];

    deprecations.forEach(dep => {
      const key = dep.method + ':' + dep.endpoint;
      this.deprecations.set(key, dep);
    });
  }

  getDeprecation(endpoint, method) {
    return this.deprecations.get(method + ':' + endpoint);
  }

  getAllDeprecations() {
    return Array.from(this.deprecations.values());
  }

  getActiveDeprecations() {
    const now = new Date();
    return this.getAllDeprecations().filter(dep => {
      return new Date(dep.sunsetAt) > now;
    });
  }

  getExpiredDeprecations() {
    const now = new Date();
    return this.getAllDeprecations().filter(dep => {
      return new Date(dep.sunsetAt) <= now;
    });
  }

  getUpcomingSunsets(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.getAllDeprecations().filter(dep => {
      const sunsetDate = new Date(dep.sunsetAt);
      return sunsetDate > new Date() && sunsetDate <= cutoff;
    }).sort((a, b) => new Date(a.sunsetAt).getTime() - new Date(b.sunsetAt).getTime());
  }

  addDeprecation(deprecation) {
    const key = deprecation.method + ':' + deprecation.endpoint;
    this.deprecations.set(key, {
      ...deprecation,
      deprecatedAt: deprecation.deprecatedAt || new Date().toISOString().split('T')[0],
      affectedClients: deprecation.affectedClients || [],
      breakdownPercentage: deprecation.breakdownPercentage || 0
    });
  }

  removeDeprecation(endpoint, method) {
    return this.deprecations.delete(method + ':' + endpoint);
  }

  getStats() {
    const all = this.getAllDeprecations();
    const active = this.getActiveDeprecations();
    const expired = this.getExpiredDeprecations();
    const upcoming = this.getUpcomingSunsets();

    const totalAffectedClients = new Set();
    all.forEach(dep => {
      dep.affectedClients.forEach(client => totalAffectedClients.add(client));
    });

    return {
      total: all.length,
      active: active.length,
      expired: expired.length,
      upcomingSunsets: upcoming.length,
      uniqueAffectedClients: totalAffectedClients.size
    };
  }
}

export default DeprecationRegistry;
`,

    'deprecation/deprecation-middleware.js': `/**
 * API Deprecation Middleware
 * Adds deprecation headers and logging to deprecated endpoints
 */

import DeprecationRegistry from './deprecation-registry.js';

class DeprecationMiddleware {
  constructor(options = {}) {
    this.registry = new DeprecationRegistry();
    this.logger = options.logger || console;
    this.linkHeader = options.linkHeader || 'https://docs.example.com/deprecations';
    this.usageTracker = options.usageTracker || null;
  }

  /**
   * Main middleware to add deprecation headers
   */
  handle() {
    return (req, res, next) => {
      const deprecation = this.registry.getDeprecation(req.path, req.method);

      if (!deprecation) {
        return next();
      }

      // Add standard deprecation headers
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', new Date(deprecation.sunsetAt).toUTCString());
      res.setHeader('Link', this.formatLinkHeader(deprecation));

      // Add custom headers for additional information
      res.setHeader('X-Deprecation-Date', deprecation.deprecatedAt);
      res.setHeader('X-Replacement-Endpoint', deprecation.replacement);
      res.setHeader('X-Migration-Guide', deprecation.migrationGuide);
      res.setHeader('X-Deprecation-Reason', deprecation.reason);

      // Add warning header (RFC 7234)
      const daysUntilSunset = this.getDaysUntil(deprecation.sunsetAt);
      const warnCode = daysUntilSunset <= 30 ? 299 : 199;
      const warningMsg = warnCode + ' - "' + req.method + ' ' + req.path + ' is deprecated and will be removed on ' + deprecation.sunsetAt + '. Use ' + deprecation.replacement + ' instead."';
      res.setHeader('Warning', warningMsg);

      // Log the usage of deprecated endpoint
      this.logDeprecatedUsage(req, deprecation);

      // Track usage if tracker is available
      if (this.usageTracker) {
        this.usageTracker.track(req, deprecation);
      }

      next();
    };
  }

  /**
   * Format Link header for RFC 8288 compliance
   */
  formatLinkHeader(deprecation) {
    const links = [
      '<' + deprecation.migrationGuide + '>; rel="deprecation"; title="Migration Guide"',
      '<' + deprecation.replacement + '>; rel="alternate"; title="Replacement Endpoint"'
    ];
    return links.join(', ');
  }

  /**
   * Calculate days until sunset date
   */
  getDaysUntil(dateString) {
    const sunset = new Date(dateString);
    const now = new Date();
    const diff = sunset.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Log usage of deprecated endpoints
   */
  logDeprecatedUsage(req, deprecation) {
    const logData = {
      timestamp: new Date().toISOString(),
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      deprecation: {
        sunsetAt: deprecation.sunsetAt,
        replacement: deprecation.replacement,
        daysUntilSunset: this.getDaysUntil(deprecation.sunsetAt)
      }
    };

    this.logger.warn('Deprecated endpoint accessed', logData);
  }

  /**
   * Middleware to block deprecated endpoints after sunset
   */
  blockAfterSunset() {
    return (req, res, next) => {
      const deprecation = this.registry.getDeprecation(req.path, req.method);

      if (!deprecation) {
        return next();
      }

      if (new Date(deprecation.sunsetAt) <= new Date()) {
        return res.status(410).json({
          error: 'Gone',
          message: 'This endpoint has been sunset and is no longer available.',
          endpoint: req.method + ' ' + req.path,
          sunsetDate: deprecation.sunsetAt,
          replacement: deprecation.replacement,
          migrationGuide: deprecation.migrationGuide
        });
      }

      next();
    };
  }

  /**
   * Get deprecation info for an endpoint
   */
  getDeprecationInfo(endpoint, method) {
    const deprecation = this.registry.getDeprecation(endpoint, method);
    if (!deprecation) {
      return null;
    }

    return {
      endpoint: deprecation.endpoint,
      method: deprecation.method,
      deprecatedAt: deprecation.deprecatedAt,
      sunsetAt: deprecation.sunsetAt,
      daysUntilSunset: this.getDaysUntil(deprecation.sunsetAt),
      replacement: deprecation.replacement,
      migrationGuide: deprecation.migrationGuide,
      reason: deprecation.reason,
      affectedClients: deprecation.affectedClients,
      breakdownPercentage: deprecation.breakdownPercentage,
      status: this.getStatus(deprecation)
    };
  }

  getStatus(deprecation) {
    const daysUntil = this.getDaysUntil(deprecation.sunsetAt);

    if (daysUntil <= 0) {
      return 'expired';
    } else if (daysUntil <= 30) {
      return 'critical';
    } else if (daysUntil <= 90) {
      return 'warning';
    } else {
      return 'notice';
    }
  }
}

export default DeprecationMiddleware;
`,

    'deprecation/usage-tracker.js': `/**
 * API Usage Tracker
 * Tracks usage of deprecated endpoints by client
 */

import Redis from 'ioredis';

class UsageTracker {
  constructor(options = {}) {
    this.redis = new Redis({
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || parseInt(process.env.REDIS_PORT || '6379'),
      db: options.db || parseInt(process.env.REDIS_DB || '1')
    });

    this.keyPrefix = options.keyPrefix || 'deprecation:usage:';
    this.clientKeyPrefix = options.clientKeyPrefix || 'client:';
  }

  /**
   * Track a deprecated endpoint usage
   */
  async track(req, deprecation) {
    const date = new Date().toISOString().split('T')[0];
    const clientId = this.getClientId(req);
    const endpointKey = deprecation.method + ':' + deprecation.endpoint;

    const pipeline = this.redis.pipeline();

    // Track daily usage by endpoint
    pipeline.incr(this.keyPrefix + 'daily:' + date + ':' + endpointKey);
    pipeline.expire(this.keyPrefix + 'daily:' + date + ':' + endpointKey, 7776000); // 90 days

    // Track usage by client
    pipeline.incr(this.keyPrefix + 'client:' + clientId + ':' + endpointKey);
    pipeline.expire(this.keyPrefix + 'client:' + clientId + ':' + endpointKey, 7776000);

    // Store client metadata
    pipeline.hset(this.clientKeyPrefix + clientId, {
      userAgent: req.get('user-agent'),
      lastSeen: new Date().toISOString()
    });
    pipeline.expire(this.clientKeyPrefix + clientId, 7776000);

    await pipeline.exec();
  }

  /**
   * Extract or generate client ID
   */
  getClientId(req) {
    // Try to get client ID from header
    const clientId = req.get('X-Client-ID');
    if (clientId) {
      return clientId;
    }

    // Generate ID from user agent
    const userAgent = req.get('user-agent') || 'unknown';
    const hash = this.simpleHash(userAgent);
    return 'client_' + hash.substring(0, 12);
  }

  /**
   * Simple hash function for client identification
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get usage statistics for an endpoint
   */
  async getEndpointUsage(endpoint, method, days = 30) {
    const stats = [];
    const endpointKey = method + ':' + endpoint;

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const count = await this.redis.get(
        this.keyPrefix + 'daily:' + dateStr + ':' + endpointKey
      );

      stats.push({
        date: dateStr,
        count: parseInt(count || '0')
      });
    }

    return stats.reverse();
  }

  /**
   * Get top clients using a deprecated endpoint
   */
  async getTopClients(endpoint, method, limit = 10) {
    const pattern = this.keyPrefix + 'client:*:' + method + ':' + endpoint;
    const keys = await this.redis.keys(pattern);

    const clients = [];
    for (const key of keys) {
      const count = await this.redis.get(key);
      const clientId = key.split(':')[2];

      const metadata = await this.redis.hgetall(this.clientKeyPrefix + clientId);

      clients.push({
        clientId: clientId,
        count: parseInt(count || '0'),
        metadata: metadata
      });
    }

    return clients
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get all clients still using deprecated APIs
   */
  async getActiveClients() {
    const keys = await this.redis.keys(this.keyPrefix + 'client:*');

    const clientMap = new Map();

    for (const key of keys) {
      const parts = key.split(':');
      const clientId = parts[2];
      const endpoint = parts.slice(3).join(':');

      const count = await this.redis.get(key);

      if (!clientMap.has(clientId)) {
        const metadata = await this.redis.hgetall(this.clientKeyPrefix + clientId);
        clientMap.set(clientId, {
          clientId: clientId,
          metadata: metadata,
          endpoints: []
        });
      }

      clientMap.get(clientId).endpoints.push({
        endpoint: endpoint,
        count: parseInt(count || '0')
      });
    }

    return Array.from(clientMap.values());
  }

  /**
   * Get summary statistics
   */
  async getSummary() {
    const dailyKeys = await this.redis.keys(this.keyPrefix + 'daily:*');
    const clientKeys = await this.redis.keys(this.keyPrefix + 'client:*');

    let totalCalls = 0;
    for (const key of dailyKeys) {
      const count = await this.redis.get(key);
      totalCalls += parseInt(count || '0');
    }

    const uniqueClients = new Set();
    for (const key of clientKeys) {
      const clientId = key.split(':')[2];
      uniqueClients.add(clientId);
    }

    return {
      totalDeprecatedCalls: totalCalls,
      uniqueClients: uniqueClients.size,
      trackedEndpoints: dailyKeys.length,
      trackedClients: clientKeys.length
    };
  }

  async close() {
    await this.redis.quit();
  }
}

export default UsageTracker;
`,

    'deprecation/notification-service.js': `/**
 * Deprecation Notification Service
 * Sends automated notifications to clients about deprecated endpoints
 */

import nodemailer from 'nodemailer';

class NotificationService {
  constructor(options = {}) {
    this.transporter = nodemailer.createTransporter({
      host: options.smtpHost || process.env.SMTP_HOST || 'localhost',
      port: options.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
      secure: options.secure || false,
      auth: options.auth || {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    });

    this.fromAddress = options.fromAddress || process.env.FROM_ADDRESS || 'api-notifications@example.com';
    this.baseUrl = options.baseUrl || process.env.BASE_URL || 'https://api.example.com';
  }

  /**
   * Send deprecation notice to a client
   */
  async sendDeprecationNotice(client, deprecation) {
    const daysUntil = this.getDaysUntil(deprecation.sunsetAt);
    const urgency = this.getUrgency(daysUntil);

    const subject = this.getSubject(deprecation, urgency);
    const html = this.getEmailTemplate(client, deprecation, daysUntil, urgency);

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: client.contactEmail || client.email,
        subject: subject,
        html: html
      });

      return { success: true, clientId: client.id };
    } catch (err) {
      console.error('Failed to send deprecation notice:', err);
      return { success: false, clientId: client.id, error: err.message };
    }
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotifications(notifications) {
    const results = [];

    for (const notification of notifications) {
      const result = await this.sendDeprecationNotice(notification.client, notification.deprecation);
      results.push(result);

      // Rate limiting: delay between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Send weekly digest
   */
  async sendWeeklyDigest(client, deprecations) {
    const html = this.getDigestTemplate(client, deprecations);

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: client.contactEmail || client.email,
        subject: 'Weekly API Deprecation Digest',
        html: html
      });

      return { success: true, clientId: client.id };
    } catch (err) {
      console.error('Failed to send weekly digest:', err);
      return { success: false, clientId: client.id, error: err.message };
    }
  }

  /**
   * Calculate days until sunset
   */
  getDaysUntil(dateString) {
    const sunset = new Date(dateString);
    const now = new Date();
    const diff = sunset.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get urgency level
   */
  getUrgency(daysUntil) {
    if (daysUntil <= 7) return 'critical';
    if (daysUntil <= 30) return 'urgent';
    if (daysUntil <= 90) return 'warning';
    return 'info';
  }

  /**
   * Get email subject based on urgency
   */
  getSubject(deprecation, urgency) {
    const daysUntil = this.getDaysUntil(deprecation.sunsetAt);

    switch (urgency) {
      case 'critical':
        return '[CRITICAL] API Endpoint Shutdown in ' + daysUntil + ' days: ' + deprecation.endpoint;
      case 'urgent':
        return '[Action Required] API Deprecation: ' + daysUntil + ' days until sunset for ' + deprecation.endpoint;
      case 'warning':
        return '[Reminder] API Deprecation Notice for ' + deprecation.endpoint;
      default:
        return 'API Update: ' + deprecation.endpoint + ' deprecation schedule';
    }
  }

  /**
   * Generate email template for single deprecation
   */
  getEmailTemplate(client, deprecation, daysUntil, urgency) {
    const badgeColor = {
      critical: '#dc2626',
      urgent: '#f59e0b',
      warning: '#eab308',
      info: '#3b82f6'
    }[urgency];

    const clientName = client.name || 'Valued Developer';
    const badgeStyle = 'background: ' + badgeColor;
    const urgencyLabel = urgency.toUpperCase();
    const endpointInfo = deprecation.method + ' ' + deprecation.endpoint;
    const daysColor = 'color: ' + badgeColor;

    return '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'  <meta charset="utf-8">' +
'  <style>' +
'    body { font-family: -apple-system, BlinkMacSystemFont, \\'Segoe UI\\', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }' +
'    .container { max-width: 600px; margin: 0 auto; padding: 20px; }' +
'    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }' +
'    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }' +
'    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; font-size: 12px; font-weight: bold; text-transform: uppercase; }' +
'    .endpoint { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ' + badgeColor + '; margin: 20px 0; }' +
'    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }' +
'    .info-item { background: white; padding: 12px; border-radius: 6px; }' +
'    .info-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }' +
'    .info-value { font-weight: 600; color: #1f2937; }' +
'    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }' +
'    .button:hover { background: #5568d3; }' +
'    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="container">' +
'    <div class="header">' +
'      <h1 style="margin: 0;">API Deprecation Notice</h1>' +
'      <p style="margin: 10px 0 0 0; opacity: 0.9;">Action required to maintain service continuity</p>' +
'    </div>' +
'    <div class="content">' +
'      <p>Hello ' + clientName + ',</p>' +
'      <p>We\\'re writing to inform you about an upcoming change to our API that affects your application.</p>' +
'' +
'      <div class="endpoint">' +
'        <span class="badge" style="' + badgeStyle + '">' + urgencyLabel + '</span>' +
'        <h3 style="margin: 10px 0;">' + endpointInfo + '</h3>' +
'        <p style="margin: 5px 0 0 0; color: #6b7280;">' + deprecation.reason + '</p>' +
'      </div>' +
'' +
'      <div class="info-grid">' +
'        <div class="info-item">' +
'          <div class="info-label">Deprecated On</div>' +
'          <div class="info-value">' + deprecation.deprecatedAt + '</div>' +
'        </div>' +
'        <div class="info-item">' +
'          <div class="info-label">Sunset Date</div>' +
'          <div class="info-value">' + deprecation.sunsetAt + '</div>' +
'        </div>' +
'        <div class="info-item">' +
'          <div class="info-label">Days Remaining</div>' +
'          <div class="info-value" style="' + daysColor + '">' + daysUntil + ' days</div>' +
'        </div>' +
'        <div class="info-item">' +
'          <div class="info-label">Replacement</div>' +
'          <div class="info-value">' + deprecation.replacement + '</div>' +
'        </div>' +
'      </div>' +
'' +
'      <h3 style="margin: 20px 0 10px 0;">Migration Steps</h3>' +
'      <ol style="line-height: 1.8;">' +
'        <li>Review the <a href="' + deprecation.migrationGuide + '" style="color: #667eea;">migration guide</a></li>' +
'        <li>Update your application to use the new endpoint</li>' +
'        <li>Test your changes in our sandbox environment</li>' +
'        <li>Deploy to production before the sunset date</li>' +
'      </ol>' +
'' +
'      <div style="text-align: center; margin: 30px 0;">' +
'        <a href="' + deprecation.migrationGuide + '" class="button">View Migration Guide</a>' +
'      </div>' +
'' +
'      <p style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">' +
'        <strong>Important:</strong> After ' + deprecation.sunsetAt + ', this endpoint will no longer respond to requests. Please ensure your application is updated before this date.' +
'      </p>' +
'' +
'      <div class="footer">' +
'        <p>Need help? Contact our support team at <a href="mailto:support@example.com" style="color: #667eea;">support@example.com</a></p>' +
'        <p style="margin: 5px 0 0 0;">' +
'          <a href="' + this.baseUrl + '/docs/deprecations" style="color: #6b7280;">View All Deprecations</a> &bull;' +
'          <a href="' + this.baseUrl + '/docs" style="color: #6b7280;">API Documentation</a>' +
'        </p>' +
'      </div>' +
'    </div>' +
'  </div>' +
'</body>' +
'</html>';
  }

  /**
   * Generate weekly digest template
   */
  getDigestTemplate(client, deprecations) {
    const clientName = client.name || 'Valued Developer';

    const items = deprecations.map(dep => {
      const daysUntil = this.getDaysUntil(dep.sunsetAt);
      const urgency = this.getUrgency(daysUntil);
      const badgeColor = urgency === 'critical' ? '#dc2626' : '#f59e0b';
      const urgencyLabel = urgency.toUpperCase();

      return '<div class="endpoint">' +
'        <span class="badge" style="background: ' + badgeColor + '">' + urgencyLabel + '</span>' +
'        <h4 style="margin: 10px 0;">' + dep.method + ' ' + dep.endpoint + '</h4>' +
'        <div style="font-size: 14px; color: #6b7280;">' +
'          Sunset: ' + dep.sunsetAt + ' (' + daysUntil + ' days) &bull;' +
'          Replacement: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">' + dep.replacement + '</code>' +
'        </div>' +
'      </div>';
    }).join('');

    return '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'  <meta charset="utf-8">' +
'  <style>' +
'    body { font-family: -apple-system, BlinkMacSystemFont, \\'Segoe UI\\', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }' +
'    .container { max-width: 600px; margin: 0 auto; padding: 20px; }' +
'    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }' +
'    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }' +
'    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; font-size: 12px; font-weight: bold; text-transform: uppercase; }' +
'    .endpoint { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="container">' +
'    <div class="header">' +
'      <h1 style="margin: 0;">Weekly API Deprecation Digest</h1>' +
'      <p style="margin: 10px 0 0 0; opacity: 0.9;">Summary of deprecations affecting your application</p>' +
'    </div>' +
'    <div class="content">' +
'      <p>Hello ' + clientName + ',</p>' +
'      <p>Here\\'s your weekly summary of API deprecations that may affect your application:</p>' +
'      ' + items +
'      <div style="text-align: center; margin: 30px 0;">' +
'        <a href="' + this.baseUrl + '/docs/deprecations" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View All Deprecations</a>' +
'      </div>' +
'    </div>' +
'  </div>' +
'</body>' +
'</html>';
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(webhookUrl, payload) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return { success: response.ok, status: response.status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async close() {
    this.transporter.close();
  }
}

export default NotificationService;
`,

    'index.js': `import express from 'express';
import helmet from 'helmet';
import DeprecationRegistry from './deprecation/deprecation-registry.js';
import DeprecationMiddleware from './deprecation/deprecation-middleware.js';
import UsageTracker from './deprecation/usage-tracker.js';

const app = express();
app.use(helmet());
app.use(express.json());

// Initialize deprecation components
const usageTracker = new UsageTracker();
const deprecationMiddleware = new DeprecationMiddleware({
  usageTracker: usageTracker
});

// Apply deprecation middleware to all routes
app.use(deprecationMiddleware.handle());
app.use(deprecationMiddleware.blockAfterSunset());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Deprecation management API
app.get('/api/deprecations', (req, res) => {
  const registry = new DeprecationRegistry();
  const deprecations = registry.getAllDeprecations();

  res.json({
    total: deprecations.length,
    deprecations: deprecations.map(dep => deprecationMiddleware.getDeprecationInfo(dep.endpoint, dep.method))
  });
});

app.get('/api/deprecations/active', (req, res) => {
  const registry = new DeprecationRegistry();
  const active = registry.getActiveDeprecations();

  res.json({
    count: active.length,
    deprecations: active.map(dep => deprecationMiddleware.getDeprecationInfo(dep.endpoint, dep.method))
  });
});

app.get('/api/deprecations/upcoming', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const registry = new DeprecationRegistry();
  const upcoming = registry.getUpcomingSunsets(days);

  res.json({
    count: upcoming.length,
    timeframe: days + ' days',
    deprecations: upcoming.map(dep => deprecationMiddleware.getDeprecationInfo(dep.endpoint, dep.method))
  });
});

app.get('/api/deprecations/stats', async (req, res) => {
  const registry = new DeprecationRegistry();
  const stats = registry.getStats();
  const usage = await usageTracker.getSummary();

  res.json({ ...stats, usage: usage });
});

app.get('/api/deprecations/:endpoint', (req, res) => {
  const { endpoint } = req.params;
  const method = req.method;

  const info = deprecationMiddleware.getDeprecationInfo('/' + endpoint, method);
  if (!info) {
    return res.status(404).json({ error: 'No deprecation info found for this endpoint' });
  }

  res.json(info);
});

app.get('/api/deprecations/:endpoint/usage', async (req, res) => {
  const { endpoint } = req.params;
  const method = req.method;
  const days = parseInt(req.query.days) || 30;

  const usage = await usageTracker.getEndpointUsage('/' + endpoint, method, days);

  res.json({
    endpoint: '/' + endpoint,
    method: method,
    period: days + ' days',
    usage: usage
  });
});

app.get('/api/deprecations/:endpoint/clients', async (req, res) => {
  const { endpoint } = req.params;
  const method = req.method;
  const limit = parseInt(req.query.limit) || 10;

  const clients = await usageTracker.getTopClients('/' + endpoint, method, limit);

  res.json({
    endpoint: '/' + endpoint,
    method: method,
    clients: clients
  });
});

// Deprecated API endpoints (examples)

// v1/users - Deprecated, use /api/v2/users
app.get('/api/v1/users', (req, res) => {
  res.json([
    { id: 1, name: 'User 1', email: 'user1@example.com' },
    { id: 2, name: 'User 2', email: 'user2@example.com' }
  ]);
});

// v2/users - New version
app.get('/api/v2/users', (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'User 1', email: 'user1@example.com', metadata: { createdAt: '2024-01-01' } }
    ],
    pagination: { page: 1, perPage: 20, total: 1 }
  });
});

// v1/orders - Deprecated, use /api/v2/orders
app.post('/api/v1/orders', (req, res) => {
  res.json({ id: 123, status: 'created', message: 'Use /api/v2/orders for enhanced features' });
});

// v2/orders - New version
app.post('/api/v2/orders', (req, res) => {
  res.json({
    id: 123,
    status: 'pending',
    validated: true,
    metadata: { createdAt: new Date().toISOString() }
  });
});

// v1/products/search - Deprecated, use /api/v2/catalog/search
app.get('/api/v1/products/search', (req, res) => {
  const { q } = req.query;
  res.json({
    results: q ? [
      { id: 1, name: 'Product matching ' + q, price: 29.99 }
    ] : []
  });
});

// v2/catalog/search - New version
app.get('/api/v2/catalog/search', (req, res) => {
  const { q } = req.query;
  res.json({
    data: {
      products: q ? [
        { id: 1, name: 'Product matching ' + q, price: 29.99, score: 0.95 }
      ] : [],
      facets: { categories: [], priceRanges: [] }
    }
  });
});

// v1/auth/login - Deprecated, use /api/v2/auth/signin
app.post('/api/v1/auth/login', (req, res) => {
  res.json({
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    warning: 'Please migrate to /api/v2/auth/signin for enhanced security'
  });
});

// v2/auth/signin - New version
app.post('/api/v2/auth/signin', (req, res) => {
  res.json({
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    mfaEnabled: true,
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('API Deprecation Management server running on port ' + PORT);
  console.log('');
  console.log('Deprecated Endpoints (with headers):');
  console.log('  GET  /api/v1/users -> /api/v2/users');
  console.log('  POST /api/v1/orders -> /api/v2/orders');
  console.log('  GET  /api/v1/products/search -> /api/v2/catalog/search');
  console.log('  POST /api/v1/auth/login -> /api/v2/auth/signin');
  console.log('');
  console.log('Deprecation Management API:');
  console.log('  GET /api/deprecations - List all deprecations');
  console.log('  GET /api/deprecations/active - Active deprecations');
  console.log('  GET /api/deprecations/upcoming?days=30 - Upcoming sunsets');
  console.log('  GET /api/deprecations/stats - Deprecation statistics');
  console.log('  GET /api/deprecations/:endpoint/usage - Usage stats');
});
`,

    'scripts/generate-deprecation-report.js': `import DeprecationRegistry from '../deprecation/deprecation-registry.js';
import DeprecationMiddleware from '../deprecation/deprecation-middleware.js';
import UsageTracker from '../deprecation/usage-tracker.js';
import * as fs from 'fs';
import * as path from 'path';

async function generateReport() {
  const registry = new DeprecationRegistry();
  const middleware = new DeprecationMiddleware();
  const tracker = new UsageTracker();

  const stats = registry.getStats();
  const usage = await tracker.getSummary();
  const active = registry.getActiveDeprecations();
  const upcoming = registry.getUpcomingSunsets(30);
  const expired = registry.getExpiredDeprecations();

  let report = '# API Deprecation Report\\n';
  report += 'Generated: ' + new Date().toISOString() + '\\n\\n';

  // Executive Summary
  report += '## Executive Summary\\n\\n';
  report += '- **Total Deprecations**: ' + stats.total + '\\n';
  report += '- **Active Deprecations**: ' + stats.active + '\\n';
  report += '- **Expired Deprecations**: ' + stats.expired + '\\n';
  report += '- **Upcoming Sunsets (30 days)**: ' + stats.upcomingSunsets + '\\n';
  report += '- **Total Deprecated API Calls**: ' + usage.totalDeprecatedCalls + '\\n';
  report += '- **Unique Affected Clients**: ' + usage.uniqueClients + '\\n\\n';

  // Critical Alerts
  report += '## Critical Alerts\\n\\n';
  if (upcoming.length > 0) {
    report += 'The following endpoints will sunset within 30 days:\\n\\n';
    upcoming.forEach(dep => {
      const days = middleware.getDaysUntil(dep.sunsetAt);
      report += '- **' + dep.method + ' ' + dep.endpoint + '** - ';
      report += days + ' days remaining (' + dep.sunsetAt + ')\\n';
      report += '  - Replacement: ' + dep.replacement + '\\n';
      report += '  - Affected clients: ' + dep.affectedClients.join(', ') + '\\n';
      report += '  - Usage: ' + dep.breakdownPercentage + '% of requests\\n\\n';
    });
  } else {
    report += 'No endpoints scheduled for sunset in the next 30 days.\\n\\n';
  }

  // Active Deprecations
  report += '## Active Deprecations\\n\\n';
  active.forEach(dep => {
    const days = middleware.getDaysUntil(dep.sunsetAt);
    const status = middleware.getStatus(dep);

    report += '### ' + dep.method + ' ' + dep.endpoint + '\\n\\n';
    report += '- **Status**: ' + status.toUpperCase() + '\\n';
    report += '- **Deprecated**: ' + dep.deprecatedAt + '\\n';
    report += '- **Sunset**: ' + dep.sunsetAt + ' (' + days + ' days)\\n';
    report += '- **Replacement**: ' + dep.replacement + '\\n';
    report += '- **Migration Guide**: ' + dep.migrationGuide + '\\n';
    report += '- **Reason**: ' + dep.reason + '\\n';
    report += '- **Affected Clients**: ' + (dep.affectedClients.length || 0) + '\\n\\n';
  });

  // Expired Deprecations
  if (expired.length > 0) {
    report += '## Expired Deprecations\\n\\n';
    expired.forEach(dep => {
      report += '- ~~' + dep.method + ' ' + dep.endpoint + '~~ (removed ' + dep.sunsetAt + ')\\n';
    });
    report += '\\n';
  }

  // Recommendations
  report += '## Recommendations\\n\\n';
  report += '1. Contact clients using endpoints with critical/urgent status\\n';
  report += '2. Review and update documentation for upcoming migrations\\n';
  report += '3. Schedule removal of expired endpoints from codebase\\n';
  report += '4. Monitor usage patterns to identify stragglers\\n\\n';

  // Print report
  console.log(report);

  // Save report
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.ensureDir(reportsDir);
  const reportPath = path.join(reportsDir, 'deprecation-report-' + new Date().toISOString().split('T')[0] + '.md');
  await fs.writeFile(reportPath, report);
  console.log('Report saved to: ' + reportPath);

  await tracker.close();
}

generateReport().catch(console.error);
`,

    'scripts/notify-deprecated-users.js': `import DeprecationRegistry from '../deprecation/deprecation-registry.js';
import DeprecationMiddleware from '../deprecation/deprecation-middleware.js';
import NotificationService from '../deprecation/notification-service.js';
import UsageTracker from '../deprecation/usage-tracker.js';

async function sendNotifications() {
  const registry = new DeprecationRegistry();
  const middleware = new DeprecationMiddleware();
  const notificationService = new NotificationService();
  const tracker = new UsageTracker();

  console.log('Sending deprecation notifications...');

  // Get upcoming sunsets (60 days)
  const upcoming = registry.getUpcomingSunsets(60);

  if (upcoming.length === 0) {
    console.log('No upcoming deprecations requiring notification.');
    return;
  }

  // Get active clients
  const clients = await tracker.getActiveClients();

  console.log('Found ' + clients.length + ' active clients using deprecated APIs');

  // Build notification list
  const notifications = [];

  for (const client of clients) {
    for (const endpointUsage of client.endpoints) {
      // Parse endpoint
      const [method, ...pathParts] = endpointUsage.endpoint.split(':');
      const endpoint = '/' + pathParts.join(':');

      // Find deprecation info
      const deprecation = registry.getDeprecation(endpoint, method);

      if (deprecation && endpointUsage.count > 0) {
        notifications.push({
          client: {
            id: client.clientId,
            name: client.metadata.userAgent || 'Unknown',
            email: client.metadata.email || 'dev@example.com'
          },
          deprecation: deprecation,
          usageCount: endpointUsage.count
        });
      }
    }
  }

  console.log('Sending ' + notifications.length + ' notifications...');

  // Send notifications
  const results = await notificationService.sendBatchNotifications(notifications);

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('');
  console.log('Notification Summary:');
  console.log('  Sent: ' + success);
  console.log('  Failed: ' + failed);

  await tracker.close();
  await notificationService.close();
}

sendNotifications().catch(console.error);
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
`,

    '.env.example': `# Server
PORT=3000
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# SMTP Configuration (for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_ADDRESS=api-notifications@example.com

# API Configuration
BASE_URL=https://api.example.com
`,

    'README.md': `# {{projectName}}

Complete API deprecation management solution with sunset headers, automated migration guides, usage tracking, and notification system.

## Features

- **Sunset Headers**: RFC-compliant Deprecation, Sunset, and Link headers
- **Migration Guides**: Automatic linking to migration documentation
- **Usage Tracking**: Track which clients are still using deprecated endpoints
- **Notification System**: Automated email notifications to affected clients
- **Deprecation Dashboard**: Monitor all deprecations from a central API
- **Version Compatibility**: Track API versions and their sunset dates

## Quick Start

\`\`\`bash
# Start services
docker-compose up -d

# Install dependencies
npm install

# Start server
npm start

# Generate deprecation report
npm run deprecation-report

# Send notifications to affected users
npm run notify-users
\`\`\`

## How It Works

### 1. Deprecation Registry

Register deprecated endpoints with their metadata:

\`\`\`javascript
registry.addDeprecation({
  endpoint: '/api/v1/users',
  method: 'GET',
  deprecatedAt: '2024-01-01',
  sunsetAt: '2024-06-30',
  replacement: '/api/v2/users',
  migrationGuide: 'https://docs.example.com/migration',
  reason: 'Improved response format',
  affectedClients: ['mobile-app', 'legacy-integration'],
  breakdownPercentage: 5
});
\`\`\`

### 2. Automatic Headers

Requests to deprecated endpoints receive these headers:

\`\`\`
Deprecation: true
Sunset: Sun, 30 Jun 2024 23:59:59 GMT
Link: <https://docs.example.com/migration>; rel="deprecation"
X-Deprecation-Date: 2024-01-01
X-Replacement-Endpoint: /api/v2/users
X-Migration-Guide: https://docs.example.com/migration
Warning: 199 - "GET /api/v1/users is deprecated..."
\`\`\`

### 3. Usage Tracking

Track which clients are still using deprecated endpoints:

\`\`\`bash
curl /api/deprecations/v1/users/usage
curl /api/deprecations/v1/users/clients
\`\`\`

### 4. Automated Notifications

Send notifications to affected clients:

\`\`\`bash
npm run notify-users
\`\`\`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /health | Health check |
| GET /api/deprecations | List all deprecations |
| GET /api/deprecations/active | Active deprecations only |
| GET /api/deprecations/upcoming?days=30 | Upcoming sunsets |
| GET /api/deprecations/stats | Deprecation statistics |
| GET /api/deprecations/:endpoint | Specific endpoint info |
| GET /api/deprecations/:endpoint/usage | Usage statistics |
| GET /api/deprecations/:endpoint/clients | Affected clients |

## Example Response

\`\`\`json
{
  "endpoint": "/api/v1/users",
  "method": "GET",
  "deprecatedAt": "2024-01-01",
  "sunsetAt": "2024-06-30",
  "daysUntilSunset": 45,
  "replacement": "/api/v2/users",
  "migrationGuide": "https://docs.example.com/migration",
  "reason": "Improved response format with additional user metadata",
  "status": "warning"
}
\`\`\`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| REDIS_HOST | localhost | Redis host for usage tracking |
| REDIS_PORT | 6379 | Redis port |
| SMTP_HOST | - | SMTP server for notifications |
| FROM_ADDRESS | - | From email address |

## Best Practices

1. **Provide at least 90 days notice** before sunset
2. **Include detailed migration guides** with code examples
3. **Track usage metrics** to identify affected clients
4. **Send progressive notifications** at 90, 60, 30, and 7 days
5. **Monitor usage** after sunset for unexpected traffic
6. **Return 410 Gone** for sunset endpoints

## Sunset Timeline

\`\`\`
Day 0:     Announce deprecation
Day 30:    Send reminder notification
Day 60:    Send urgent notification
Day 90:    Send critical notification
Day 100:   Endpoint sunset (returns 410 Gone)
\`\`\`

## License

MIT
`
  }
};
