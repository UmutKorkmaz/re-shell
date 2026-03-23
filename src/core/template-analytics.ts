import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Template, TemplateCategory } from './template-engine';

export interface TemplateUsageEvent {
  id: string;
  templateId: string;
  version: string;
  eventType: UsageEventType;
  timestamp: Date;
  duration?: number;
  success: boolean;
  error?: string;
  context: {
    projectName?: string;
    projectPath?: string;
    variables?: Record<string, any>;
    platform: string;
    nodeVersion: string;
    cliVersion: string;
  };
  metadata?: Record<string, any>;
}

export enum UsageEventType {
  INSTALLED = 'installed',
  CREATED = 'created',
  UPDATED = 'updated',
  REMOVED = 'removed',
  VALIDATED = 'validated',
  PUBLISHED = 'published',
  DOWNLOADED = 'downloaded',
  FAILED = 'failed',
  CUSTOMIZED = 'customized'
}

export interface TemplateMetrics {
  templateId: string;
  totalUsage: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  popularVariables: Array<{ name: string; values: any[]; count: number }>;
  platformDistribution: Record<string, number>;
  versionDistribution: Record<string, number>;
  timeSeriesData: TimeSeriesData[];
  userSegments: UserSegment[];
}

export interface TimeSeriesData {
  date: Date;
  usage: number;
  success: number;
  errors: number;
  uniqueUsers: number;
}

export interface UserSegment {
  name: string;
  description: string;
  userCount: number;
  percentage: number;
  characteristics: Record<string, any>;
}

export interface AnalyticsReport {
  period: { start: Date; end: Date };
  summary: {
    totalEvents: number;
    uniqueTemplates: number;
    uniqueUsers: number;
    successRate: number;
    averageDuration: number;
  };
  topTemplates: Array<{
    templateId: string;
    usage: number;
    successRate: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  categoryBreakdown: Record<TemplateCategory, number>;
  errorAnalysis: Array<{
    error: string;
    count: number;
    templates: string[];
    suggestions: string[];
  }>;
  insights: Insight[];
}

export interface Insight {
  type: InsightType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  data?: any;
  recommendations?: string[];
}

export enum InsightType {
  PERFORMANCE = 'performance',
  RELIABILITY = 'reliability',
  ADOPTION = 'adoption',
  ERRORS = 'errors',
  TRENDS = 'trends',
  OPPORTUNITIES = 'opportunities'
}

export interface AnalyticsConfig {
  enabled?: boolean;
  anonymize?: boolean;
  storageLimit?: number;
  retentionDays?: number;
  syncInterval?: number;
  remoteEndpoint?: string;
  includeSystemInfo?: boolean;
  trackVariables?: boolean;
}

export class TemplateAnalytics extends EventEmitter {
  private events: TemplateUsageEvent[] = [];
  private metricsCache: Map<string, TemplateMetrics> = new Map();
  private storagePath: string;
  private syncInterval?: NodeJS.Timeout;
  private sessionId: string;

  private defaultConfig: AnalyticsConfig = {
    enabled: true,
    anonymize: true,
    storageLimit: 10 * 1024 * 1024, // 10MB
    retentionDays: 90,
    syncInterval: 60 * 60 * 1000, // 1 hour
    includeSystemInfo: true,
    trackVariables: true
  };

  constructor(
    private dataDir: string,
    private config: AnalyticsConfig = {}
  ) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.storagePath = path.join(dataDir, 'analytics');
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    await fs.ensureDir(this.storagePath);
    await this.loadEvents();
    await this.cleanupOldEvents();

    if (this.config.remoteEndpoint && this.config.syncInterval) {
      this.startSyncing();
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath);
      const eventFiles = files.filter(f => f.endsWith('.json'));

      for (const file of eventFiles) {
        const filePath = path.join(this.storagePath, file);
        const data = await fs.readJson(filePath);
        
        if (Array.isArray(data)) {
          this.events.push(...data.map(e => ({
            ...e,
            timestamp: new Date(e.timestamp)
          })));
        }
      }

      // Sort by timestamp
      this.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.emit('error', { type: 'load_events', error });
    }
  }

  private async cleanupOldEvents(): Promise<void> {
    if (!this.config.retentionDays) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const oldCount = this.events.length;
    this.events = this.events.filter(e => e.timestamp > cutoffDate);
    
    if (oldCount !== this.events.length) {
      await this.persistEvents();
      this.emit('cleanup:complete', { removed: oldCount - this.events.length });
    }
  }

  private startSyncing(): void {
    this.syncInterval = setInterval(() => {
      this.syncToRemote().catch(error => {
        this.emit('error', { type: 'sync', error });
      });
    }, this.config.syncInterval!);
  }

  async trackUsage(
    template: Template,
    eventType: UsageEventType,
    context: Partial<TemplateUsageEvent['context']> = {},
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled) return;

    const event: TemplateUsageEvent = {
      id: this.generateEventId(),
      templateId: template.id,
      version: template.version,
      eventType,
      timestamp: new Date(),
      success: true,
      context: {
        platform: process.platform,
        nodeVersion: process.version,
        cliVersion: await this.getCliVersion(),
        ...context
      },
      metadata
    };

    // Anonymize if needed
    if (this.config.anonymize) {
      event.context = this.anonymizeContext(event.context);
    }

    this.events.push(event);
    this.emit('event:tracked', event);

    // Persist periodically
    if (this.events.length % 100 === 0) {
      await this.persistEvents();
    }

    // Check storage limit
    await this.checkStorageLimit();
  }

  async trackError(
    template: Template,
    error: Error,
    context: Partial<TemplateUsageEvent['context']> = {}
  ): Promise<void> {
    await this.trackUsage(
      template,
      UsageEventType.FAILED,
      context,
      {
        error: error.message,
        stack: this.config.anonymize ? undefined : error.stack
      }
    );
  }

  async getMetrics(templateId: string): Promise<TemplateMetrics | null> {
    // Check cache
    const cached = this.metricsCache.get(templateId);
    if (cached) {
      return cached;
    }

    const events = this.events.filter(e => e.templateId === templateId);
    if (events.length === 0) {
      return null;
    }

    const metrics = this.calculateMetrics(templateId, events);
    this.metricsCache.set(templateId, metrics);
    
    return metrics;
  }

  private calculateMetrics(templateId: string, events: TemplateUsageEvent[]): TemplateMetrics {
    const totalUsage = events.length;
    const successCount = events.filter(e => e.success).length;
    const durations = events.filter(e => e.duration).map(e => e.duration!);
    
    // Variable analysis
    const variableUsage = new Map<string, Map<string, number>>();
    events.forEach(event => {
      if (event.context.variables && this.config.trackVariables) {
        Object.entries(event.context.variables).forEach(([key, value]) => {
          if (!variableUsage.has(key)) {
            variableUsage.set(key, new Map());
          }
          const valueStr = JSON.stringify(value);
          const counts = variableUsage.get(key)!;
          counts.set(valueStr, (counts.get(valueStr) || 0) + 1);
        });
      }
    });

    const popularVariables = Array.from(variableUsage.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([v]) => JSON.parse(v)),
      count: Array.from(values.values()).reduce((a, b) => a + b, 0)
    }));

    // Platform distribution
    const platformDistribution: Record<string, number> = {};
    events.forEach(e => {
      platformDistribution[e.context.platform] = (platformDistribution[e.context.platform] || 0) + 1;
    });

    // Version distribution
    const versionDistribution: Record<string, number> = {};
    events.forEach(e => {
      versionDistribution[e.version] = (versionDistribution[e.version] || 0) + 1;
    });

    // Time series data (last 30 days)
    const timeSeriesData = this.generateTimeSeriesData(events, 30);

    // User segments
    const userSegments = this.analyzeUserSegments(events);

    return {
      templateId,
      totalUsage,
      successRate: totalUsage > 0 ? (successCount / totalUsage) * 100 : 0,
      averageDuration: durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0,
      errorRate: totalUsage > 0 ? ((totalUsage - successCount) / totalUsage) * 100 : 0,
      popularVariables,
      platformDistribution,
      versionDistribution,
      timeSeriesData,
      userSegments
    };
  }

  private generateTimeSeriesData(events: TemplateUsageEvent[], days: number): TimeSeriesData[] {
    const data: TimeSeriesData[] = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(date);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayEvents = events.filter(e => 
        e.timestamp >= date && e.timestamp < dayEnd
      );
      
      const uniqueUsers = new Set(dayEvents.map(e => e.context.projectName || 'unknown'));
      
      data.push({
        date,
        usage: dayEvents.length,
        success: dayEvents.filter(e => e.success).length,
        errors: dayEvents.filter(e => !e.success).length,
        uniqueUsers: uniqueUsers.size
      });
    }
    
    return data;
  }

  private analyzeUserSegments(events: TemplateUsageEvent[]): UserSegment[] {
    const segments: UserSegment[] = [];
    const totalUsers = new Set(events.map(e => e.context.projectName || 'unknown')).size;

    // Platform segments
    const platformGroups = this.groupBy(events, e => e.context.platform);
    for (const [platform, platformEvents] of Object.entries(platformGroups)) {
      const users = new Set(platformEvents.map(e => e.context.projectName || 'unknown'));
      segments.push({
        name: `${platform} Users`,
        description: `Users on ${platform} platform`,
        userCount: users.size,
        percentage: (users.size / totalUsers) * 100,
        characteristics: { platform }
      });
    }

    // Activity segments
    const userActivity = new Map<string, number>();
    events.forEach(e => {
      const user = e.context.projectName || 'unknown';
      userActivity.set(user, (userActivity.get(user) || 0) + 1);
    });

    const powerUsers = Array.from(userActivity.entries())
      .filter(([_, count]) => count > 10)
      .map(([user]) => user);

    if (powerUsers.length > 0) {
      segments.push({
        name: 'Power Users',
        description: 'Users with >10 template operations',
        userCount: powerUsers.length,
        percentage: (powerUsers.length / totalUsers) * 100,
        characteristics: { minOperations: 10 }
      });
    }

    return segments;
  }

  async generateReport(
    startDate?: Date,
    endDate?: Date,
    templateIds?: string[]
  ): Promise<AnalyticsReport> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const end = endDate || new Date();
    
    const filteredEvents = this.events.filter(e => {
      if (e.timestamp < start || e.timestamp > end) return false;
      if (templateIds && !templateIds.includes(e.templateId)) return false;
      return true;
    });

    const uniqueTemplates = new Set(filteredEvents.map(e => e.templateId));
    const uniqueUsers = new Set(filteredEvents.map(e => e.context.projectName || 'unknown'));
    const successCount = filteredEvents.filter(e => e.success).length;
    const durations = filteredEvents.filter(e => e.duration).map(e => e.duration!);

    // Top templates
    const templateUsage = this.groupBy(filteredEvents, e => e.templateId);
    const topTemplates = Object.entries(templateUsage)
      .map(([templateId, events]) => {
        const successRate = events.filter(e => e.success).length / events.length * 100;
        const trend = this.calculateTrend(templateId, start, end);
        
        return {
          templateId,
          usage: events.length,
          successRate,
          trend
        };
      })
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    // Category breakdown
    const categoryBreakdown: Record<TemplateCategory, number> = {} as any;
    // Note: This would need access to template metadata

    // Error analysis
    const errorAnalysis = this.analyzeErrors(filteredEvents);

    // Calculate average duration
    const allDurations = filteredEvents
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!);
    const averageDuration = allDurations.length > 0 
      ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length 
      : 0;

    // Generate insights
    const insights = this.generateInsights(filteredEvents, {
      totalEvents: filteredEvents.length,
      uniqueTemplates: uniqueTemplates.size,
      uniqueUsers: uniqueUsers.size,
      successRate: filteredEvents.length > 0 ? successCount / filteredEvents.length * 100 : 0,
      averageDuration
    });

    return {
      period: { start, end },
      summary: {
        totalEvents: filteredEvents.length,
        uniqueTemplates: uniqueTemplates.size,
        uniqueUsers: uniqueUsers.size,
        successRate: filteredEvents.length > 0 ? successCount / filteredEvents.length * 100 : 0,
        averageDuration: durations.length > 0 
          ? durations.reduce((a, b) => a + b, 0) / durations.length 
          : 0
      },
      topTemplates,
      categoryBreakdown,
      errorAnalysis,
      insights
    };
  }

  private analyzeErrors(events: TemplateUsageEvent[]): AnalyticsReport['errorAnalysis'] {
    const errorGroups = new Map<string, { count: number; templates: Set<string> }>();
    
    events.filter(e => !e.success && e.metadata?.error).forEach(event => {
      const error = event.metadata!.error;
      if (!errorGroups.has(error)) {
        errorGroups.set(error, { count: 0, templates: new Set() });
      }
      
      const group = errorGroups.get(error)!;
      group.count++;
      group.templates.add(event.templateId);
    });

    return Array.from(errorGroups.entries())
      .map(([error, data]) => ({
        error,
        count: data.count,
        templates: Array.from(data.templates),
        suggestions: this.getErrorSuggestions(error)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getErrorSuggestions(error: string): string[] {
    const suggestions: string[] = [];
    
    if (error.includes('permission')) {
      suggestions.push('Check file system permissions');
      suggestions.push('Run with appropriate user privileges');
    }
    
    if (error.includes('not found')) {
      suggestions.push('Verify template dependencies are installed');
      suggestions.push('Check template file paths');
    }
    
    if (error.includes('timeout')) {
      suggestions.push('Increase timeout settings');
      suggestions.push('Check network connectivity');
    }
    
    return suggestions;
  }

  private generateInsights(
    events: TemplateUsageEvent[],
    summary: AnalyticsReport['summary']
  ): Insight[] {
    const insights: Insight[] = [];

    // Performance insights
    if (summary.averageDuration > 5000) {
      insights.push({
        type: InsightType.PERFORMANCE,
        severity: 'warning',
        title: 'Slow Template Processing',
        description: `Average template processing time is ${Math.round(summary.averageDuration / 1000)}s`,
        recommendations: [
          'Consider optimizing template file operations',
          'Review hook execution times',
          'Enable caching for repeated operations'
        ]
      });
    }

    // Reliability insights
    if (summary.successRate < 90) {
      insights.push({
        type: InsightType.RELIABILITY,
        severity: 'critical',
        title: 'Low Success Rate',
        description: `Only ${summary.successRate.toFixed(1)}% of template operations succeed`,
        recommendations: [
          'Review error logs for common issues',
          'Improve template validation',
          'Add better error handling'
        ]
      });
    }

    // Adoption insights
    const dailyAverage = events.length / 30;
    if (dailyAverage < 1) {
      insights.push({
        type: InsightType.ADOPTION,
        severity: 'info',
        title: 'Low Template Usage',
        description: 'Templates are being used less than once per day on average',
        recommendations: [
          'Improve template documentation',
          'Promote templates to developers',
          'Create more useful templates'
        ]
      });
    }

    // Trend insights
    const recentEvents = events.filter(e => 
      e.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const oldEvents = events.filter(e => 
      e.timestamp < new Date(Date.now() - 23 * 24 * 60 * 60 * 1000) &&
      e.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    if (recentEvents.length > oldEvents.length * 1.5) {
      insights.push({
        type: InsightType.TRENDS,
        severity: 'info',
        title: 'Growing Template Usage',
        description: 'Template usage has increased by 50% in the last week',
        data: { recent: recentEvents.length, old: oldEvents.length }
      });
    }

    return insights;
  }

  private calculateTrend(
    templateId: string,
    startDate: Date,
    endDate: Date
  ): 'up' | 'down' | 'stable' {
    const midpoint = new Date((startDate.getTime() + endDate.getTime()) / 2);
    
    const firstHalf = this.events.filter(e => 
      e.templateId === templateId &&
      e.timestamp >= startDate &&
      e.timestamp < midpoint
    ).length;
    
    const secondHalf = this.events.filter(e => 
      e.templateId === templateId &&
      e.timestamp >= midpoint &&
      e.timestamp <= endDate
    ).length;
    
    if (secondHalf > firstHalf * 1.2) return 'up';
    if (secondHalf < firstHalf * 0.8) return 'down';
    return 'stable';
  }

  private groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<K, T[]>);
  }

  private anonymizeContext(context: any): any {
    const anonymized = { ...context };
    
    // Remove sensitive paths
    if (anonymized.projectPath) {
      anonymized.projectPath = this.anonymizePath(anonymized.projectPath);
    }
    
    // Remove project name if it might be sensitive
    if (anonymized.projectName) {
      anonymized.projectName = this.hashString(anonymized.projectName);
    }
    
    // Anonymize variable values that might be sensitive
    if (anonymized.variables && this.config.trackVariables) {
      const safeVariables: Record<string, any> = {};
      for (const [key, value] of Object.entries(anonymized.variables)) {
        if (this.isSensitiveVariable(key)) {
          safeVariables[key] = '<redacted>';
        } else {
          safeVariables[key] = value;
        }
      }
      anonymized.variables = safeVariables;
    }
    
    return anonymized;
  }

  private anonymizePath(filePath: string): string {
    const home = os.homedir();
    return filePath.replace(home, '~').replace(/\/Users\/[^/]+/, '/Users/<user>');
  }

  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 8);
  }

  private isSensitiveVariable(name: string): boolean {
    const sensitive = ['password', 'token', 'key', 'secret', 'credential'];
    return sensitive.some(s => name.toLowerCase().includes(s));
  }

  private async persistEvents(): Promise<void> {
    try {
      // Group events by date
      const eventsByDate = this.groupBy(this.events, e => 
        e.timestamp.toISOString().split('T')[0]
      );
      
      for (const [date, events] of Object.entries(eventsByDate)) {
        const filePath = path.join(this.storagePath, `events-${date}.json`);
        await fs.writeJson(filePath, events, { spaces: 2 });
      }
    } catch (error) {
      this.emit('error', { type: 'persist', error });
    }
  }

  private async checkStorageLimit(): Promise<void> {
    if (!this.config.storageLimit) return;
    
    const files = await fs.readdir(this.storagePath);
    let totalSize = 0;
    
    for (const file of files) {
      const stats = await fs.stat(path.join(this.storagePath, file));
      totalSize += stats.size;
    }
    
    if (totalSize > this.config.storageLimit) {
      // Remove oldest files
      const sortedFiles = files.sort();
      while (totalSize > this.config.storageLimit * 0.8 && sortedFiles.length > 0) {
        const fileToRemove = sortedFiles.shift()!;
        const filePath = path.join(this.storagePath, fileToRemove);
        const stats = await fs.stat(filePath);
        totalSize -= stats.size;
        await fs.remove(filePath);
      }
      
      // Reload events
      this.events = [];
      await this.loadEvents();
    }
  }

  private async syncToRemote(): Promise<void> {
    if (!this.config.remoteEndpoint || this.events.length === 0) return;
    
    try {
      // Get unsyced events (last 1000)
      const eventsToSync = this.events.slice(-1000);
      
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events: eventsToSync
        })
      });
      
      if (response.ok) {
        this.emit('sync:complete', { count: eventsToSync.length });
      }
    } catch (error) {
      this.emit('sync:error', error);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private async getCliVersion(): Promise<string> {
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      const pkg = await fs.readJson(packagePath);
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Public methods
  isEnabled(): boolean {
    return this.config.enabled || false;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (!enabled && this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(this.events, null, 2);
    }
    
    // CSV export
    const headers = [
      'id', 'templateId', 'version', 'eventType', 'timestamp',
      'success', 'duration', 'platform', 'nodeVersion', 'cliVersion'
    ];
    
    const rows = [headers.join(',')];
    
    for (const event of this.events) {
      const row = [
        event.id,
        event.templateId,
        event.version,
        event.eventType,
        event.timestamp.toISOString(),
        event.success.toString(),
        event.duration || '',
        event.context.platform,
        event.context.nodeVersion,
        event.context.cliVersion
      ];
      rows.push(row.map(v => `"${v}"`).join(','));
    }
    
    return rows.join('\n');
  }

  async clearData(): Promise<void> {
    this.events = [];
    this.metricsCache.clear();
    
    const files = await fs.readdir(this.storagePath);
    for (const file of files) {
      await fs.remove(path.join(this.storagePath, file));
    }
    
    this.emit('data:cleared');
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
    
    this.persistEvents().catch(() => { /* ignore */ });
  }
}

// Global analytics instance
let globalAnalytics: TemplateAnalytics | null = null;

export function createTemplateAnalytics(
  dataDir: string,
  config?: AnalyticsConfig
): TemplateAnalytics {
  return new TemplateAnalytics(dataDir, config);
}

export function getGlobalTemplateAnalytics(): TemplateAnalytics {
  if (!globalAnalytics) {
    const dataDir = path.join(process.cwd(), '.re-shell', 'analytics');
    globalAnalytics = new TemplateAnalytics(dataDir);
  }
  return globalAnalytics;
}

export function setGlobalTemplateAnalytics(analytics: TemplateAnalytics): void {
  globalAnalytics = analytics;
}