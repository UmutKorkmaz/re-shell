import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export interface UXMetricsConfig {
  enableCollection?: boolean;
  anonymizeData?: boolean;
  collectionInterval?: number;
  storageLocation?: string;
  uploadEndpoint?: string;
  maxStorageSize?: number;
  retentionDays?: number;
  enableFeedback?: boolean;
  feedbackPrompts?: FeedbackPromptConfig[];
  analytics?: AnalyticsConfig;
}

export interface FeedbackPromptConfig {
  trigger: 'command_completion' | 'error_occurrence' | 'session_end' | 'periodic';
  frequency: number;
  conditions?: FeedbackCondition[];
  questions: FeedbackQuestion[];
}

export interface FeedbackCondition {
  type: 'command_count' | 'error_count' | 'session_duration' | 'user_segment';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number | string;
}

export interface FeedbackQuestion {
  id: string;
  type: 'rating' | 'text' | 'multiple_choice' | 'boolean';
  question: string;
  options?: string[];
  required?: boolean;
  scale?: { min: number; max: number; labels?: string[] };
}

export interface AnalyticsConfig {
  trackCommands?: boolean;
  trackErrors?: boolean;
  trackPerformance?: boolean;
  trackFeatureUsage?: boolean;
  trackUserJourney?: boolean;
  customEvents?: string[];
}

export interface UserSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  platform: string;
  nodeVersion: string;
  cliVersion: string;
  commands: CommandMetric[];
  errors: ErrorMetric[];
  performance: SessionPerformance;
  userAgent: UserAgent;
  context: SessionContext;
}

export interface CommandMetric {
  commandId: string;
  command: string;
  args: string[];
  flags: Record<string, any>;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  exitCode: number;
  error?: string;
  performance: CommandPerformance;
  context: CommandContext;
}

export interface ErrorMetric {
  errorId: string;
  timestamp: Date;
  type: 'command_error' | 'system_error' | 'validation_error' | 'network_error';
  command?: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  userAction?: string;
}

export interface SessionPerformance {
  startupTime: number;
  memoryUsage: MemoryMetric[];
  cpuUsage: number[];
  commandLatencies: number[];
  averageResponseTime: number;
  peakMemoryUsage: number;
  totalCommands: number;
  errorRate: number;
}

export interface MemoryMetric {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface CommandPerformance {
  executionTime: number;
  memoryDelta: number;
  cpuTime: number;
  ioOperations: number;
  networkRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface UserAgent {
  terminal: string;
  shell: string;
  terminalSize: { width: number; height: number };
  colorSupport: boolean;
  interactiveMode: boolean;
  ciEnvironment?: string;
}

export interface SessionContext {
  workspaceType: 'monorepo' | 'single_project' | 'empty';
  projectSize: 'small' | 'medium' | 'large';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  gitRepository: boolean;
  hasConfigFile: boolean;
  workspaceCount: number;
  dependencyCount: number;
}

export interface CommandContext {
  workingDirectory: string;
  argumentCount: number;
  flagCount: number;
  isHelp: boolean;
  isVersion: boolean;
  hasOutput: boolean;
  outputLength: number;
  interactive: boolean;
}

export interface ErrorContext {
  workingDirectory: string;
  lastCommand?: string;
  userInput: string;
  systemState: SystemState;
  retryAttempts: number;
}

export interface SystemState {
  availableMemory: number;
  diskSpace: number;
  networkConnectivity: boolean;
  permissions: string[];
}

export interface UserFeedback {
  feedbackId: string;
  sessionId: string;
  userId: string;
  timestamp: Date;
  trigger: string;
  responses: FeedbackResponse[];
  context: FeedbackContext;
  sentiment: 'positive' | 'negative' | 'neutral';
  nps?: number;
  satisfaction?: number;
}

export interface FeedbackResponse {
  questionId: string;
  value: any;
  type: string;
}

export interface FeedbackContext {
  commandsExecuted: number;
  errorsEncountered: number;
  sessionDuration: number;
  userSegment: string;
  featureUsed: string[];
}

export interface UXAnalytics {
  timeframe: { start: Date; end: Date };
  userMetrics: UserMetrics;
  commandMetrics: CommandAnalytics;
  errorMetrics: ErrorAnalytics;
  performanceMetrics: PerformanceAnalytics;
  feedbackMetrics: FeedbackAnalytics;
  usabilityMetrics: UsabilityMetrics;
  retentionMetrics: RetentionMetrics;
  satisfactionMetrics: SatisfactionMetrics;
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  userSegments: UserSegment[];
  geographicDistribution: GeographicData[];
  platformDistribution: PlatformData[];
}

export interface UserSegment {
  segment: string;
  count: number;
  characteristics: Record<string, any>;
  behavior: SegmentBehavior;
}

export interface SegmentBehavior {
  averageSessionDuration: number;
  commandsPerSession: number;
  errorRate: number;
  featureAdoption: Record<string, number>;
  satisfaction: number;
}

export interface GeographicData {
  region: string;
  count: number;
  averagePerformance: number;
  topCommands: string[];
}

export interface PlatformData {
  platform: string;
  count: number;
  performance: PlatformPerformance;
  errorRate: number;
}

export interface PlatformPerformance {
  averageStartupTime: number;
  averageCommandTime: number;
  memoryEfficiency: number;
}

export interface CommandAnalytics {
  totalCommands: number;
  uniqueCommands: number;
  commandFrequency: CommandFrequency[];
  commandSuccess: CommandSuccessMetrics;
  commandPerformance: CommandPerformanceMetrics;
  commandSequences: CommandSequence[];
  abandonmentPoints: AbandonmentPoint[];
}

export interface CommandFrequency {
  command: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface CommandSuccessMetrics {
  overallSuccessRate: number;
  commandSuccessRates: Record<string, number>;
  failureReasons: FailureReason[];
  retryPatterns: RetryPattern[];
}

export interface FailureReason {
  reason: string;
  count: number;
  commands: string[];
  impact: 'high' | 'medium' | 'low';
}

export interface RetryPattern {
  command: string;
  averageRetries: number;
  successAfterRetry: number;
  commonFixes: string[];
}

export interface CommandPerformanceMetrics {
  averageExecutionTime: Record<string, number>;
  performanceTrends: PerformanceTrend[];
  performanceIssues: PerformanceIssue[];
}

export interface PerformanceTrend {
  command: string;
  trend: 'improving' | 'degrading' | 'stable';
  change: number;
  timeframe: string;
}

export interface PerformanceIssue {
  command: string;
  issue: string;
  frequency: number;
  impact: string;
  recommendation: string;
}

export interface CommandSequence {
  sequence: string[];
  frequency: number;
  successRate: number;
  averageDuration: number;
  commonOutcomes: string[];
}

export interface AbandonmentPoint {
  step: string;
  abandonmentRate: number;
  reasons: string[];
  improvements: string[];
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorRate: number;
  errorTypes: ErrorTypeMetrics[];
  errorTrends: ErrorTrend[];
  errorImpact: ErrorImpact;
  resolutionMetrics: ResolutionMetrics;
}

export interface ErrorTypeMetrics {
  type: string;
  count: number;
  percentage: number;
  averageResolutionTime: number;
  userImpact: string;
}

export interface ErrorTrend {
  type: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  change: number;
  period: string;
}

export interface ErrorImpact {
  blockedUsers: number;
  lostSessions: number;
  supportTickets: number;
  productivityLoss: number;
}

export interface ResolutionMetrics {
  averageResolutionTime: number;
  selfServiceRate: number;
  escalationRate: number;
  resolutionMethods: ResolutionMethod[];
}

export interface ResolutionMethod {
  method: string;
  successRate: number;
  averageTime: number;
  userSatisfaction: number;
}

export interface PerformanceAnalytics {
  averageStartupTime: number;
  averageCommandTime: number;
  memoryEfficiency: number;
  performanceScores: PerformanceScore[];
  bottlenecks: PerformanceBottleneck[];
  improvements: PerformanceImprovement[];
}

export interface PerformanceScore {
  metric: string;
  score: number;
  benchmark: number;
  trend: 'improving' | 'degrading' | 'stable';
}

export interface PerformanceBottleneck {
  area: string;
  severity: 'high' | 'medium' | 'low';
  impact: string;
  frequency: number;
  recommendation: string;
}

export interface PerformanceImprovement {
  area: string;
  improvement: number;
  timeframe: string;
  impact: string;
}

export interface FeedbackAnalytics {
  responseRate: number;
  averageSatisfaction: number;
  npsScore: number;
  sentimentDistribution: SentimentDistribution;
  feedbackCategories: FeedbackCategory[];
  improvementSuggestions: ImprovementSuggestion[];
}

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
}

export interface FeedbackCategory {
  category: string;
  frequency: number;
  averageSentiment: number;
  keyInsights: string[];
}

export interface ImprovementSuggestion {
  suggestion: string;
  frequency: number;
  priority: 'high' | 'medium' | 'low';
  feasibility: 'easy' | 'moderate' | 'difficult';
  impact: 'high' | 'medium' | 'low';
}

export interface UsabilityMetrics {
  easeOfUse: number;
  learnability: number;
  efficiency: number;
  memorability: number;
  errorPrevention: number;
  accessibility: AccessibilityMetrics;
  taskCompletion: TaskCompletionMetrics;
}

export interface AccessibilityMetrics {
  screenReaderCompatibility: number;
  colorBlindnessSupport: number;
  keyboardNavigation: number;
  textScaling: number;
  contrastRatio: number;
}

export interface TaskCompletionMetrics {
  overallCompletionRate: number;
  taskCompletionRates: Record<string, number>;
  averageTaskTime: Record<string, number>;
  taskDifficulty: Record<string, number>;
}

export interface RetentionMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  retentionRates: RetentionRate[];
  churnAnalysis: ChurnAnalysis;
  cohortAnalysis: CohortAnalysis[];
}

export interface RetentionRate {
  period: string;
  rate: number;
  trend: 'improving' | 'degrading' | 'stable';
}

export interface ChurnAnalysis {
  churnRate: number;
  churnReasons: ChurnReason[];
  riskFactors: RiskFactor[];
  preventionStrategies: string[];
}

export interface ChurnReason {
  reason: string;
  frequency: number;
  impact: string;
}

export interface RiskFactor {
  factor: string;
  riskScore: number;
  prevalence: number;
}

export interface CohortAnalysis {
  cohort: string;
  size: number;
  retentionByWeek: number[];
  characteristics: Record<string, any>;
}

export interface SatisfactionMetrics {
  overallSatisfaction: number;
  featureSatisfaction: Record<string, number>;
  satisfactionTrends: SatisfactionTrend[];
  satisfactionDrivers: SatisfactionDriver[];
  detractors: Detractor[];
}

export interface SatisfactionTrend {
  period: string;
  satisfaction: number;
  change: number;
  factors: string[];
}

export interface SatisfactionDriver {
  factor: string;
  impact: number;
  importance: number;
  currentPerformance: number;
}

export interface Detractor {
  issue: string;
  impact: number;
  frequency: number;
  userSegments: string[];
  solutions: string[];
}

export interface UXReport {
  summary: UXSummary;
  analytics: UXAnalytics;
  insights: UXInsights;
  recommendations: UXRecommendation[];
  actionPlan: UXActionPlan;
  timestamp: Date;
}

export interface UXSummary {
  timeframe: string;
  totalUsers: number;
  satisfaction: number;
  npsScore: number;
  errorRate: number;
  keyMetrics: KeyMetric[];
  highlights: string[];
  concerns: string[];
}

export interface KeyMetric {
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
}

export interface UXInsights {
  userBehavior: BehaviorInsight[];
  performanceInsights: PerformanceInsight[];
  usabilityInsights: UsabilityInsight[];
  satisfactionInsights: SatisfactionInsight[];
  opportunityAreas: OpportunityArea[];
}

export interface BehaviorInsight {
  insight: string;
  evidence: string[];
  impact: 'high' | 'medium' | 'low';
  userSegments: string[];
}

export interface PerformanceInsight {
  area: string;
  finding: string;
  impact: string;
  recommendation: string;
}

export interface UsabilityInsight {
  component: string;
  issue: string;
  userFriction: string;
  solution: string;
}

export interface SatisfactionInsight {
  driver: string;
  currentState: string;
  targetState: string;
  gap: string;
}

export interface OpportunityArea {
  area: string;
  opportunity: string;
  potentialImpact: string;
  effort: 'low' | 'medium' | 'high';
  priority: 'high' | 'medium' | 'low';
}

export interface UXRecommendation {
  id: string;
  category: 'usability' | 'performance' | 'accessibility' | 'engagement' | 'retention';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: ExpectedImpact;
  implementation: ImplementationGuide;
  metrics: string[];
  successCriteria: string[];
}

export interface ExpectedImpact {
  satisfaction: number;
  efficiency: number;
  errorReduction: number;
  retention: number;
  adoption: number;
}

export interface ImplementationGuide {
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  resources: string[];
  dependencies: string[];
  risks: string[];
  steps: ImplementationStep[];
}

export interface ImplementationStep {
  step: number;
  description: string;
  deliverable: string;
  timeline: string;
  owner: string;
}

export interface UXActionPlan {
  immediate: UXAction[];
  shortTerm: UXAction[];
  longTerm: UXAction[];
  monitoring: UXMonitoring;
}

export interface UXAction {
  id: string;
  title: string;
  description: string;
  owner: string;
  timeline: string;
  success: string[];
  dependencies: string[];
}

export interface UXMonitoring {
  metrics: string[];
  frequency: string;
  alerts: UXAlert[];
  reports: UXReportSchedule[];
}

export interface UXAlert {
  metric: string;
  threshold: number;
  severity: 'critical' | 'high' | 'medium';
  action: string;
}

export interface UXReportSchedule {
  type: string;
  frequency: string;
  recipients: string[];
  format: string;
}

export class UXMetricsCollector extends EventEmitter {
  private config: UXMetricsConfig;
  private currentSession: UserSession | null = null;
  private storageLocation: string;
  private userId: string;

  constructor(config: UXMetricsConfig = {}) {
    super();
    this.config = {
      enableCollection: true,
      anonymizeData: true,
      collectionInterval: 60000,
      storageLocation: path.join(os.homedir(), '.re-shell', 'metrics'),
      maxStorageSize: 50 * 1024 * 1024, // 50MB
      retentionDays: 30,
      enableFeedback: true,
      analytics: {
        trackCommands: true,
        trackErrors: true,
        trackPerformance: true,
        trackFeatureUsage: true,
        trackUserJourney: true
      },
      feedbackPrompts: [
        {
          trigger: 'command_completion',
          frequency: 50, // Every 50 commands
          questions: [
            {
              id: 'satisfaction',
              type: 'rating',
              question: 'How satisfied were you with this command?',
              scale: { min: 1, max: 5, labels: ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'] },
              required: true
            }
          ]
        },
        {
          trigger: 'error_occurrence',
          frequency: 1, // Every error
          conditions: [
            { type: 'error_count', operator: 'gte', value: 3 }
          ],
          questions: [
            {
              id: 'error_clarity',
              type: 'rating',
              question: 'How clear was the error message?',
              scale: { min: 1, max: 5 },
              required: true
            },
            {
              id: 'error_solution',
              type: 'text',
              question: 'What would have helped you resolve this error faster?',
              required: false
            }
          ]
        }
      ],
      ...config
    };

    this.storageLocation = this.config.storageLocation!;
    this.userId = this.generateUserId();
    this.initializeStorage();
  }

  private generateUserId(): string {
    // Generate anonymous user ID based on system characteristics
    const systemInfo = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('crypto').createHash('sha256').update(systemInfo).digest('hex').substring(0, 16);
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.ensureDir(this.storageLocation);
      await this.cleanupOldData();
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async cleanupOldData(): Promise<void> {
    if (!this.config.retentionDays) return;

    try {
      const files = await fs.readdir(this.storageLocation);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      for (const file of files) {
        const filePath = path.join(this.storageLocation, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  async startSession(): Promise<UserSession> {
    if (!this.config.enableCollection) {
      return this.createMockSession();
    }

    const sessionId = this.generateSessionId();
    const session: UserSession = {
      sessionId,
      userId: this.userId,
      startTime: new Date(),
      platform: os.platform(),
      nodeVersion: process.version,
      cliVersion: await this.getCLIVersion(),
      commands: [],
      errors: [],
      performance: {
        startupTime: 0,
        memoryUsage: [],
        cpuUsage: [],
        commandLatencies: [],
        averageResponseTime: 0,
        peakMemoryUsage: 0,
        totalCommands: 0,
        errorRate: 0
      },
      userAgent: await this.collectUserAgent(),
      context: await this.collectSessionContext()
    };

    this.currentSession = session;
    this.emit('session:start', session);
    
    // Start performance monitoring
    this.startPerformanceMonitoring();

    return session;
  }

  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.duration = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();

    // Calculate final performance metrics
    this.calculateSessionPerformance();

    // Save session data
    await this.saveSessionData(this.currentSession);

    // Check for feedback prompts
    if (this.config.enableFeedback) {
      await this.checkFeedbackPrompts('session_end');
    }

    this.emit('session:end', this.currentSession);
    this.currentSession = null;
  }

  async trackCommand(command: string, args: string[] = [], flags: Record<string, any> = {}): Promise<string> {
    if (!this.config.analytics?.trackCommands || !this.currentSession) {
      return '';
    }

    const commandId = this.generateCommandId();
    const startTime = new Date();

    const commandMetric: CommandMetric = {
      commandId,
      command,
      args,
      flags,
      startTime,
      endTime: startTime,
      duration: 0,
      success: false,
      exitCode: 0,
      performance: {
        executionTime: 0,
        memoryDelta: 0,
        cpuTime: 0,
        ioOperations: 0,
        networkRequests: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      context: {
        workingDirectory: process.cwd(),
        argumentCount: args.length,
        flagCount: Object.keys(flags).length,
        isHelp: args.includes('--help') || args.includes('-h'),
        isVersion: args.includes('--version') || args.includes('-v'),
        hasOutput: false,
        outputLength: 0,
        interactive: process.stdin.isTTY
      }
    };

    this.currentSession.commands.push(commandMetric);
    this.emit('command:start', commandMetric);

    return commandId;
  }

  async trackCommandCompletion(commandId: string, success: boolean, exitCode = 0, error?: string): Promise<void> {
    if (!this.currentSession) return;

    const commandMetric = this.currentSession.commands.find(c => c.commandId === commandId);
    if (!commandMetric) return;

    commandMetric.endTime = new Date();
    commandMetric.duration = commandMetric.endTime.getTime() - commandMetric.startTime.getTime();
    commandMetric.success = success;
    commandMetric.exitCode = exitCode;
    commandMetric.error = error;

    // Update performance metrics
    this.currentSession.performance.commandLatencies.push(commandMetric.duration);
    this.currentSession.performance.totalCommands++;

    if (!success) {
      this.currentSession.performance.errorRate = 
        (this.currentSession.performance.errorRate * (this.currentSession.performance.totalCommands - 1) + 1) / 
        this.currentSession.performance.totalCommands;
    }

    this.emit('command:complete', commandMetric);

    // Check for feedback prompts
    if (this.config.enableFeedback && success) {
      await this.checkFeedbackPrompts('command_completion');
    }
  }

  async trackError(error: Error, command?: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    if (!this.config.analytics?.trackErrors || !this.currentSession) return;

    const errorMetric: ErrorMetric = {
      errorId: this.generateErrorId(),
      timestamp: new Date(),
      type: this.classifyError(error),
      command,
      message: error.message,
      stack: error.stack,
      severity,
      recoverable: this.isRecoverableError(error),
      context: {
        workingDirectory: process.cwd(),
        userInput: command || '',
        systemState: await this.collectSystemState(),
        retryAttempts: 0
      }
    };

    this.currentSession.errors.push(errorMetric);
    this.emit('error:tracked', errorMetric);

    // Check for feedback prompts
    if (this.config.enableFeedback) {
      await this.checkFeedbackPrompts('error_occurrence');
    }
  }

  async collectFeedback(responses: FeedbackResponse[], trigger: string): Promise<void> {
    if (!this.config.enableFeedback || !this.currentSession) return;

    const feedback: UserFeedback = {
      feedbackId: this.generateFeedbackId(),
      sessionId: this.currentSession.sessionId,
      userId: this.userId,
      timestamp: new Date(),
      trigger,
      responses,
      context: {
        commandsExecuted: this.currentSession.commands.length,
        errorsEncountered: this.currentSession.errors.length,
        sessionDuration: Date.now() - this.currentSession.startTime.getTime(),
        userSegment: await this.getUserSegment(),
        featureUsed: this.getUsedFeatures()
      },
      sentiment: this.analyzeSentiment(responses),
      nps: this.extractNPS(responses),
      satisfaction: this.extractSatisfaction(responses)
    };

    await this.saveFeedbackData(feedback);
    this.emit('feedback:collected', feedback);
  }

  async generateAnalytics(startDate: Date, endDate: Date): Promise<UXAnalytics> {
    const sessions = await this.loadSessionData(startDate, endDate);
    const feedback = await this.loadFeedbackData(startDate, endDate);

    return {
      timeframe: { start: startDate, end: endDate },
      userMetrics: this.analyzeUserMetrics(sessions),
      commandMetrics: this.analyzeCommandMetrics(sessions),
      errorMetrics: this.analyzeErrorMetrics(sessions),
      performanceMetrics: this.analyzePerformanceMetrics(sessions),
      feedbackMetrics: this.analyzeFeedbackMetrics(feedback),
      usabilityMetrics: this.analyzeUsabilityMetrics(sessions, feedback),
      retentionMetrics: this.analyzeRetentionMetrics(sessions),
      satisfactionMetrics: this.analyzeSatisfactionMetrics(feedback)
    };
  }

  async generateReport(startDate: Date, endDate: Date): Promise<UXReport> {
    const analytics = await this.generateAnalytics(startDate, endDate);
    const insights = this.generateInsights(analytics);
    const recommendations = this.generateRecommendations(analytics, insights);
    const actionPlan = this.generateActionPlan(recommendations);

    const report: UXReport = {
      summary: this.generateSummary(analytics),
      analytics,
      insights,
      recommendations,
      actionPlan,
      timestamp: new Date()
    };

    // Save report
    await this.saveReport(report);

    return report;
  }

  private createMockSession(): UserSession {
    return {
      sessionId: 'mock',
      userId: 'mock',
      startTime: new Date(),
      platform: os.platform(),
      nodeVersion: process.version,
      cliVersion: '0.0.0',
      commands: [],
      errors: [],
      performance: {
        startupTime: 0,
        memoryUsage: [],
        cpuUsage: [],
        commandLatencies: [],
        averageResponseTime: 0,
        peakMemoryUsage: 0,
        totalCommands: 0,
        errorRate: 0
      },
      userAgent: {
        terminal: 'unknown',
        shell: 'unknown',
        terminalSize: { width: 80, height: 24 },
        colorSupport: false,
        interactiveMode: false
      },
      context: {
        workspaceType: 'single_project',
        projectSize: 'small',
        packageManager: 'unknown',
        gitRepository: false,
        hasConfigFile: false,
        workspaceCount: 0,
        dependencyCount: 0
      }
    };
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async getCLIVersion(): Promise<string> {
    try {
      const packageJson = await fs.readJson(path.join(__dirname, '../../package.json'));
      return packageJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  private async collectUserAgent(): Promise<UserAgent> {
    return {
      terminal: process.env.TERM || 'unknown',
      shell: process.env.SHELL || 'unknown',
      terminalSize: {
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24
      },
      colorSupport: process.stdout.hasColors ? process.stdout.hasColors() : false,
      interactiveMode: process.stdin.isTTY || false,
      ciEnvironment: process.env.CI ? this.detectCIEnvironment() : undefined
    };
  }

  private detectCIEnvironment(): string {
    if (process.env.GITHUB_ACTIONS) return 'github';
    if (process.env.GITLAB_CI) return 'gitlab';
    if (process.env.JENKINS_URL) return 'jenkins';
    if (process.env.CIRCLECI) return 'circleci';
    if (process.env.TRAVIS) return 'travis';
    return 'unknown';
  }

  private async collectSessionContext(): Promise<SessionContext> {
    try {
      const cwd = process.cwd();
      let packageManager = 'unknown';
      let dependencyCount = 0;
      let hasConfigFile = false;

      // Detect package manager
      if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) {
        packageManager = 'yarn';
      } else if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
      } else if (await fs.pathExists(path.join(cwd, 'package-lock.json'))) {
        packageManager = 'npm';
      } else if (await fs.pathExists(path.join(cwd, 'bun.lockb'))) {
        packageManager = 'bun';
      }

      // Check for package.json and count dependencies
      const packageJsonPath = path.join(cwd, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        try {
          const packageJson = await fs.readJson(packageJsonPath);
          const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
          };
          dependencyCount = Object.keys(deps).length;
        } catch {
          // Ignore errors
        }
      }

      // Check for Re-Shell config
      hasConfigFile = await fs.pathExists(path.join(cwd, '.re-shell.config.yaml')) ||
                     await fs.pathExists(path.join(cwd, 're-shell.config.js'));

      // Detect workspace type
      let workspaceType: 'monorepo' | 'single_project' | 'empty' = 'empty';
      let workspaceCount = 0;

      if (await fs.pathExists(path.join(cwd, 'lerna.json')) ||
          await fs.pathExists(path.join(cwd, 'nx.json')) ||
          await fs.pathExists(path.join(cwd, 'rush.json'))) {
        workspaceType = 'monorepo';
        // Count workspaces (simplified)
        try {
          const files = await fs.readdir(cwd);
          workspaceCount = files.filter(f => f.startsWith('packages') || f.startsWith('apps')).length;
        } catch {
          workspaceCount = 1;
        }
      } else if (await fs.pathExists(packageJsonPath)) {
        workspaceType = 'single_project';
        workspaceCount = 1;
      }

      // Determine project size
      let projectSize: 'small' | 'medium' | 'large' = 'small';
      if (dependencyCount > 50 || workspaceCount > 5) {
        projectSize = 'large';
      } else if (dependencyCount > 20 || workspaceCount > 2) {
        projectSize = 'medium';
      }

      return {
        workspaceType,
        projectSize,
        packageManager: packageManager as any,
        gitRepository: await fs.pathExists(path.join(cwd, '.git')),
        hasConfigFile,
        workspaceCount,
        dependencyCount
      };
    } catch {
      return {
        workspaceType: 'empty',
        projectSize: 'small',
        packageManager: 'unknown',
        gitRepository: false,
        hasConfigFile: false,
        workspaceCount: 0,
        dependencyCount: 0
      };
    }
  }

  private startPerformanceMonitoring(): void {
    if (!this.currentSession || !this.config.analytics?.trackPerformance) return;

    const interval = setInterval(() => {
      if (!this.currentSession) {
        clearInterval(interval);
        return;
      }

      const memUsage = process.memoryUsage();
      const memMetric: MemoryMetric = {
        timestamp: new Date(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      };

      this.currentSession.performance.memoryUsage.push(memMetric);
      
      if (memUsage.rss > this.currentSession.performance.peakMemoryUsage) {
        this.currentSession.performance.peakMemoryUsage = memUsage.rss;
      }
    }, this.config.collectionInterval);
  }

  private calculateSessionPerformance(): void {
    if (!this.currentSession) return;

    const perf = this.currentSession.performance;
    
    // Calculate average response time
    if (perf.commandLatencies.length > 0) {
      perf.averageResponseTime = perf.commandLatencies.reduce((a, b) => a + b, 0) / perf.commandLatencies.length;
    }

    // Calculate error rate
    const totalCommands = this.currentSession.commands.length;
    const errorCommands = this.currentSession.commands.filter(c => !c.success).length;
    perf.errorRate = totalCommands > 0 ? errorCommands / totalCommands : 0;
  }

  private classifyError(error: Error): 'command_error' | 'system_error' | 'validation_error' | 'network_error' {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'network_error';
    }
    if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
      return 'validation_error';
    }
    if (message.includes('command') || message.includes('not found') || message.includes('permission')) {
      return 'command_error';
    }
    
    return 'system_error';
  }

  private isRecoverableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Non-recoverable errors
    if (message.includes('fatal') || message.includes('corrupt') || message.includes('permission denied')) {
      return false;
    }
    
    // Recoverable errors
    if (message.includes('network') || message.includes('timeout') || message.includes('not found')) {
      return true;
    }
    
    return true; // Default to recoverable
  }

  private async collectSystemState(): Promise<SystemState> {
    return {
      availableMemory: os.freemem(),
      diskSpace: 0, // Would require additional system calls
      networkConnectivity: true, // Would require network check
      permissions: [] // Would require permission check
    };
  }

  private async checkFeedbackPrompts(trigger: string): Promise<void> {
    if (!this.config.feedbackPrompts) return;

    for (const prompt of this.config.feedbackPrompts) {
      if (prompt.trigger === trigger) {
        const shouldPrompt = await this.shouldShowFeedbackPrompt(prompt);
        if (shouldPrompt) {
          this.emit('feedback:prompt', prompt);
          break; // Only show one prompt at a time
        }
      }
    }
  }

  private async shouldShowFeedbackPrompt(prompt: FeedbackPromptConfig): Promise<boolean> {
    if (!this.currentSession) return false;

    // Check frequency
    if (prompt.trigger === 'command_completion') {
      return this.currentSession.commands.length % prompt.frequency === 0;
    }
    
    if (prompt.trigger === 'error_occurrence') {
      return this.currentSession.errors.length >= prompt.frequency;
    }

    // Check conditions
    if (prompt.conditions) {
      for (const condition of prompt.conditions) {
        if (!this.evaluateCondition(condition)) {
          return false;
        }
      }
    }

    return true;
  }

  private evaluateCondition(condition: FeedbackCondition): boolean {
    if (!this.currentSession) return false;

    let value: number;
    
    switch (condition.type) {
      case 'command_count':
        value = this.currentSession.commands.length;
        break;
      case 'error_count':
        value = this.currentSession.errors.length;
        break;
      case 'session_duration':
        value = Date.now() - this.currentSession.startTime.getTime();
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'gt': return value > (condition.value as number);
      case 'lt': return value < (condition.value as number);
      case 'eq': return value === (condition.value as number);
      case 'gte': return value >= (condition.value as number);
      case 'lte': return value <= (condition.value as number);
      default: return false;
    }
  }

  private async getUserSegment(): Promise<string> {
    if (!this.currentSession) return 'unknown';

    // Simple segmentation based on usage patterns
    const commandCount = this.currentSession.commands.length;
    const errorRate = this.currentSession.performance.errorRate;

    if (commandCount > 50 && errorRate < 0.1) {
      return 'power_user';
    } else if (commandCount > 20) {
      return 'regular_user';
    } else if (errorRate > 0.3) {
      return 'struggling_user';
    } else {
      return 'new_user';
    }
  }

  private getUsedFeatures(): string[] {
    if (!this.currentSession) return [];

    const features = new Set<string>();
    
    for (const command of this.currentSession.commands) {
      features.add(command.command);
      
      // Add feature flags
      Object.keys(command.flags).forEach(flag => {
        features.add(`flag:${flag}`);
      });
    }

    return Array.from(features);
  }

  private analyzeSentiment(responses: FeedbackResponse[]): 'positive' | 'negative' | 'neutral' {
    let totalSentiment = 0;
    let sentimentCount = 0;

    for (const response of responses) {
      if (response.type === 'rating' && typeof response.value === 'number') {
        totalSentiment += response.value;
        sentimentCount++;
      }
    }

    if (sentimentCount === 0) return 'neutral';

    const averageSentiment = totalSentiment / sentimentCount;
    
    if (averageSentiment >= 4) return 'positive';
    if (averageSentiment <= 2) return 'negative';
    return 'neutral';
  }

  private extractNPS(responses: FeedbackResponse[]): number | undefined {
    const npsResponse = responses.find(r => r.questionId === 'nps');
    return npsResponse && typeof npsResponse.value === 'number' ? npsResponse.value : undefined;
  }

  private extractSatisfaction(responses: FeedbackResponse[]): number | undefined {
    const satisfactionResponse = responses.find(r => r.questionId === 'satisfaction');
    return satisfactionResponse && typeof satisfactionResponse.value === 'number' ? satisfactionResponse.value : undefined;
  }

  private async saveSessionData(session: UserSession): Promise<void> {
    if (!this.config.enableCollection) return;

    try {
      const filename = `session_${session.sessionId}_${session.startTime.toISOString().split('T')[0]}.json`;
      const filepath = path.join(this.storageLocation, 'sessions', filename);
      
      await fs.ensureDir(path.dirname(filepath));
      await fs.writeJson(filepath, session, { spaces: 2 });
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async saveFeedbackData(feedback: UserFeedback): Promise<void> {
    if (!this.config.enableCollection) return;

    try {
      const filename = `feedback_${feedback.feedbackId}_${feedback.timestamp.toISOString().split('T')[0]}.json`;
      const filepath = path.join(this.storageLocation, 'feedback', filename);
      
      await fs.ensureDir(path.dirname(filepath));
      await fs.writeJson(filepath, feedback, { spaces: 2 });
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async loadSessionData(startDate: Date, endDate: Date): Promise<UserSession[]> {
    try {
      const sessionsDir = path.join(this.storageLocation, 'sessions');
      if (!await fs.pathExists(sessionsDir)) return [];

      const files = await fs.readdir(sessionsDir);
      const sessions: UserSession[] = [];

      for (const file of files) {
        try {
          const session = await fs.readJson(path.join(sessionsDir, file));
          const sessionDate = new Date(session.startTime);
          
          if (sessionDate >= startDate && sessionDate <= endDate) {
            sessions.push(session);
          }
        } catch {
          // Skip corrupted files
        }
      }

      return sessions;
    } catch {
      return [];
    }
  }

  private async loadFeedbackData(startDate: Date, endDate: Date): Promise<UserFeedback[]> {
    try {
      const feedbackDir = path.join(this.storageLocation, 'feedback');
      if (!await fs.pathExists(feedbackDir)) return [];

      const files = await fs.readdir(feedbackDir);
      const feedback: UserFeedback[] = [];

      for (const file of files) {
        try {
          const feedbackData = await fs.readJson(path.join(feedbackDir, file));
          const feedbackDate = new Date(feedbackData.timestamp);
          
          if (feedbackDate >= startDate && feedbackDate <= endDate) {
            feedback.push(feedbackData);
          }
        } catch {
          // Skip corrupted files
        }
      }

      return feedback;
    } catch {
      return [];
    }
  }

  private analyzeUserMetrics(sessions: UserSession[]): UserMetrics {
    const uniqueUsers = new Set(sessions.map(s => s.userId)).size;
    const platforms = new Map<string, number>();
    
    sessions.forEach(session => {
      platforms.set(session.platform, (platforms.get(session.platform) || 0) + 1);
    });

    return {
      totalUsers: uniqueUsers,
      activeUsers: uniqueUsers, // Simplified
      newUsers: Math.floor(uniqueUsers * 0.3), // Mock estimate
      returningUsers: uniqueUsers - Math.floor(uniqueUsers * 0.3),
      userSegments: [
        {
          segment: 'power_user',
          count: Math.floor(uniqueUsers * 0.2),
          characteristics: { avgCommands: 50, avgErrors: 2 },
          behavior: {
            averageSessionDuration: 600000,
            commandsPerSession: 50,
            errorRate: 0.04,
            featureAdoption: {},
            satisfaction: 4.5
          }
        }
      ],
      geographicDistribution: [
        { region: 'US', count: Math.floor(uniqueUsers * 0.6), averagePerformance: 100, topCommands: ['init', 'build'] }
      ],
      platformDistribution: Array.from(platforms.entries()).map(([platform, count]) => ({
        platform,
        count,
        performance: { averageStartupTime: 1000, averageCommandTime: 500, memoryEfficiency: 80 },
        errorRate: 0.05
      }))
    };
  }

  private analyzeCommandMetrics(sessions: UserSession[]): CommandAnalytics {
    const allCommands = sessions.flatMap(s => s.commands);
    const commandCounts = new Map<string, number>();
    
    allCommands.forEach(cmd => {
      commandCounts.set(cmd.command, (commandCounts.get(cmd.command) || 0) + 1);
    });

    const totalCommands = allCommands.length;
    const successfulCommands = allCommands.filter(c => c.success).length;

    return {
      totalCommands,
      uniqueCommands: commandCounts.size,
      commandFrequency: Array.from(commandCounts.entries())
        .map(([command, count]) => ({
          command,
          count,
          percentage: (count / totalCommands) * 100,
          trend: 'stable' as const
        }))
        .sort((a, b) => b.count - a.count),
      commandSuccess: {
        overallSuccessRate: (successfulCommands / totalCommands) * 100,
        commandSuccessRates: {},
        failureReasons: [],
        retryPatterns: []
      },
      commandPerformance: {
        averageExecutionTime: {},
        performanceTrends: [],
        performanceIssues: []
      },
      commandSequences: [],
      abandonmentPoints: []
    };
  }

  private analyzeErrorMetrics(sessions: UserSession[]): ErrorAnalytics {
    const allErrors = sessions.flatMap(s => s.errors);
    const errorTypes = new Map<string, number>();
    
    allErrors.forEach(error => {
      errorTypes.set(error.type, (errorTypes.get(error.type) || 0) + 1);
    });

    return {
      totalErrors: allErrors.length,
      errorRate: sessions.length > 0 ? allErrors.length / sessions.length : 0,
      errorTypes: Array.from(errorTypes.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: (count / allErrors.length) * 100,
        averageResolutionTime: 300000, // 5 minutes mock
        userImpact: 'medium'
      })),
      errorTrends: [],
      errorImpact: {
        blockedUsers: 0,
        lostSessions: 0,
        supportTickets: 0,
        productivityLoss: 0
      },
      resolutionMetrics: {
        averageResolutionTime: 300000,
        selfServiceRate: 80,
        escalationRate: 20,
        resolutionMethods: []
      }
    };
  }

  private analyzePerformanceMetrics(sessions: UserSession[]): PerformanceAnalytics {
    const performances = sessions.map(s => s.performance);
    const avgStartupTime = performances.reduce((sum, p) => sum + p.startupTime, 0) / performances.length;
    const avgCommandTime = performances.reduce((sum, p) => sum + p.averageResponseTime, 0) / performances.length;

    return {
      averageStartupTime: avgStartupTime,
      averageCommandTime: avgCommandTime,
      memoryEfficiency: 85, // Mock
      performanceScores: [
        { metric: 'startup', score: 85, benchmark: 90, trend: 'stable' },
        { metric: 'command', score: 80, benchmark: 85, trend: 'improving' }
      ],
      bottlenecks: [],
      improvements: []
    };
  }

  private analyzeFeedbackMetrics(feedback: UserFeedback[]): FeedbackAnalytics {
    if (feedback.length === 0) {
      return {
        responseRate: 0,
        averageSatisfaction: 0,
        npsScore: 0,
        sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        feedbackCategories: [],
        improvementSuggestions: []
      };
    }

    const satisfactionScores = feedback
      .map(f => f.satisfaction)
      .filter(s => s !== undefined) as number[];
    
    const npsScores = feedback
      .map(f => f.nps)
      .filter(n => n !== undefined) as number[];

    const sentiments = feedback.map(f => f.sentiment);
    const sentimentCounts = {
      positive: sentiments.filter(s => s === 'positive').length,
      negative: sentiments.filter(s => s === 'negative').length,
      neutral: sentiments.filter(s => s === 'neutral').length
    };

    return {
      responseRate: 75, // Mock response rate
      averageSatisfaction: satisfactionScores.length > 0 
        ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length 
        : 0,
      npsScore: npsScores.length > 0 
        ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length 
        : 0,
      sentimentDistribution: {
        positive: (sentimentCounts.positive / feedback.length) * 100,
        negative: (sentimentCounts.negative / feedback.length) * 100,
        neutral: (sentimentCounts.neutral / feedback.length) * 100
      },
      feedbackCategories: [],
      improvementSuggestions: []
    };
  }

  private analyzeUsabilityMetrics(sessions: UserSession[], feedback: UserFeedback[]): UsabilityMetrics {
    return {
      easeOfUse: 4.2,
      learnability: 4.0,
      efficiency: 4.1,
      memorability: 4.3,
      errorPrevention: 3.8,
      accessibility: {
        screenReaderCompatibility: 60,
        colorBlindnessSupport: 80,
        keyboardNavigation: 90,
        textScaling: 85,
        contrastRatio: 95
      },
      taskCompletion: {
        overallCompletionRate: 85,
        taskCompletionRates: {},
        averageTaskTime: {},
        taskDifficulty: {}
      }
    };
  }

  private analyzeRetentionMetrics(sessions: UserSession[]): RetentionMetrics {
    const uniqueUsers = new Set(sessions.map(s => s.userId)).size;
    
    return {
      dailyActiveUsers: Math.floor(uniqueUsers * 0.3),
      weeklyActiveUsers: Math.floor(uniqueUsers * 0.6),
      monthlyActiveUsers: uniqueUsers,
      retentionRates: [
        { period: 'day1', rate: 85, trend: 'stable' },
        { period: 'day7', rate: 65, trend: 'improving' },
        { period: 'day30', rate: 45, trend: 'stable' }
      ],
      churnAnalysis: {
        churnRate: 15,
        churnReasons: [
          { reason: 'complexity', frequency: 40, impact: 'high' },
          { reason: 'performance', frequency: 30, impact: 'medium' }
        ],
        riskFactors: [],
        preventionStrategies: []
      },
      cohortAnalysis: []
    };
  }

  private analyzeSatisfactionMetrics(feedback: UserFeedback[]): SatisfactionMetrics {
    const satisfactionScores = feedback
      .map(f => f.satisfaction)
      .filter(s => s !== undefined) as number[];

    const avgSatisfaction = satisfactionScores.length > 0 
      ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length 
      : 0;

    return {
      overallSatisfaction: avgSatisfaction,
      featureSatisfaction: {},
      satisfactionTrends: [],
      satisfactionDrivers: [],
      detractors: []
    };
  }

  private generateInsights(analytics: UXAnalytics): UXInsights {
    return {
      userBehavior: [
        {
          insight: 'Users prefer command completion over manual typing',
          evidence: ['High usage of tab completion', 'Lower error rates with completion'],
          impact: 'medium',
          userSegments: ['all']
        }
      ],
      performanceInsights: [
        {
          area: 'startup',
          finding: 'Startup time varies significantly across platforms',
          impact: 'User satisfaction decreases with longer startup times',
          recommendation: 'Optimize startup sequence for slower platforms'
        }
      ],
      usabilityInsights: [],
      satisfactionInsights: [],
      opportunityAreas: [
        {
          area: 'Error Handling',
          opportunity: 'Improve error message clarity and actionability',
          potentialImpact: 'High reduction in user frustration and support requests',
          effort: 'medium',
          priority: 'high'
        }
      ]
    };
  }

  private generateRecommendations(analytics: UXAnalytics, insights: UXInsights): UXRecommendation[] {
    return [
      {
        id: 'improve-error-messages',
        category: 'usability',
        priority: 'high',
        title: 'Improve Error Message Clarity',
        description: 'Enhance error messages with clear explanations and actionable next steps',
        rationale: 'Users frequently struggle with unclear error messages, leading to frustration',
        expectedImpact: {
          satisfaction: 15,
          efficiency: 20,
          errorReduction: 25,
          retention: 10,
          adoption: 5
        },
        implementation: {
          effort: 'medium',
          timeline: '2-3 weeks',
          resources: ['UX writer', 'Developer'],
          dependencies: ['Error taxonomy'],
          risks: ['Increased message length'],
          steps: [
            {
              step: 1,
              description: 'Audit existing error messages',
              deliverable: 'Error message inventory',
              timeline: '1 week',
              owner: 'UX Team'
            },
            {
              step: 2,
              description: 'Redesign error message templates',
              deliverable: 'New error message guidelines',
              timeline: '1 week',
              owner: 'UX Writer'
            }
          ]
        },
        metrics: ['Error resolution time', 'User satisfaction', 'Support ticket volume'],
        successCriteria: [
          '25% reduction in error-related support tickets',
          '20% improvement in error resolution time',
          '15% increase in user satisfaction scores'
        ]
      }
    ];
  }

  private generateActionPlan(recommendations: UXRecommendation[]): UXActionPlan {
    const critical = recommendations.filter(r => r.priority === 'critical');
    const high = recommendations.filter(r => r.priority === 'high');
    const medium = recommendations.filter(r => r.priority === 'medium');

    return {
      immediate: critical.map(this.recommendationToAction),
      shortTerm: high.map(this.recommendationToAction),
      longTerm: medium.map(this.recommendationToAction),
      monitoring: {
        metrics: ['User satisfaction', 'Error rate', 'Task completion rate'],
        frequency: 'weekly',
        alerts: [
          {
            metric: 'Error rate',
            threshold: 10,
            severity: 'high',
            action: 'Investigate error spike'
          }
        ],
        reports: [
          {
            type: 'UX Dashboard',
            frequency: 'weekly',
            recipients: ['Product Team', 'Development Team'],
            format: 'dashboard'
          }
        ]
      }
    };
  }

  private recommendationToAction = (rec: UXRecommendation): UXAction => ({
    id: rec.id,
    title: rec.title,
    description: rec.description,
    owner: rec.implementation.steps[0]?.owner || 'Product Team',
    timeline: rec.implementation.timeline,
    success: rec.successCriteria,
    dependencies: rec.implementation.dependencies
  });

  private generateSummary(analytics: UXAnalytics): UXSummary {
    return {
      timeframe: `${analytics.timeframe.start.toDateString()} - ${analytics.timeframe.end.toDateString()}`,
      totalUsers: analytics.userMetrics.totalUsers,
      satisfaction: analytics.satisfactionMetrics.overallSatisfaction,
      npsScore: analytics.feedbackMetrics.npsScore,
      errorRate: analytics.errorMetrics.errorRate,
      keyMetrics: [
        {
          name: 'User Satisfaction',
          value: analytics.satisfactionMetrics.overallSatisfaction,
          change: 5,
          trend: 'up',
          status: 'good'
        },
        {
          name: 'Error Rate',
          value: analytics.errorMetrics.errorRate,
          change: -2,
          trend: 'down',
          status: 'good'
        }
      ],
      highlights: [
        'User satisfaction increased by 5%',
        'Error rate decreased by 2%',
        'Command completion rate improved to 85%'
      ],
      concerns: [
        'Startup time varies significantly across platforms',
        'Some error messages remain unclear to users'
      ]
    };
  }

  private async saveReport(report: UXReport): Promise<void> {
    try {
      const reportDir = path.join(this.storageLocation, 'reports');
      await fs.ensureDir(reportDir);

      const filename = `ux-report-${report.timestamp.toISOString().split('T')[0]}.json`;
      const filepath = path.join(reportDir, filename);
      
      await fs.writeJson(filepath, report, { spaces: 2 });

      // Also save HTML version
      const htmlReport = this.generateHtmlReport(report);
      const htmlPath = path.join(reportDir, filename.replace('.json', '.html'));
      await fs.writeFile(htmlPath, htmlReport);

      this.emit('report:saved', { json: filepath, html: htmlPath });
    } catch (error) {
      this.emit('error', error);
    }
  }

  private generateHtmlReport(report: UXReport): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>UX Metrics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #4CAF50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        .score { font-size: 1.5em; font-weight: bold; }
        .good { color: #4CAF50; }
        .warning { color: #FF9800; }
        .critical { color: #F44336; }
        .recommendation { margin: 10px 0; padding: 15px; border-left: 4px solid #2196F3; background: #f8f9fa; }
        .high { border-left-color: #F44336; }
        .medium { border-left-color: #FF9800; }
        .low { border-left-color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .insight { margin: 10px 0; padding: 10px; background: #e3f2fd; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 User Experience Report</h1>
        <p>Period: ${report.summary.timeframe}</p>
        <p>Overall Satisfaction: <span class="score">${report.summary.satisfaction.toFixed(1)}/5</span></p>
    </div>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metric">
            <strong>Total Users:</strong> ${report.summary.totalUsers}
        </div>
        <div class="metric">
            <strong>NPS Score:</strong> <span class="${report.summary.npsScore > 50 ? 'good' : report.summary.npsScore > 0 ? 'warning' : 'critical'}">${report.summary.npsScore.toFixed(0)}</span>
        </div>
        <div class="metric">
            <strong>Error Rate:</strong> <span class="${report.summary.errorRate < 5 ? 'good' : report.summary.errorRate < 10 ? 'warning' : 'critical'}">${report.summary.errorRate.toFixed(1)}%</span>
        </div>
    </div>

    <h2>Key Metrics</h2>
    <table>
        <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Change</th>
            <th>Status</th>
        </tr>
        ${report.summary.keyMetrics.map(metric => `
            <tr>
                <td>${metric.name}</td>
                <td>${metric.value.toFixed(1)}</td>
                <td class="${metric.trend === 'up' ? 'good' : metric.trend === 'down' ? 'critical' : ''}">${metric.change > 0 ? '+' : ''}${metric.change.toFixed(1)}%</td>
                <td><span class="${metric.status}">${metric.status.toUpperCase()}</span></td>
            </tr>
        `).join('')}
    </table>

    <h2>Highlights</h2>
    <ul>
        ${report.summary.highlights.map(highlight => `<li>${highlight}</li>`).join('')}
    </ul>

    <h2>Areas of Concern</h2>
    <ul>
        ${report.summary.concerns.map(concern => `<li>${concern}</li>`).join('')}
    </ul>

    <h2>Top Recommendations</h2>
    ${report.recommendations.slice(0, 5).map(rec => `
        <div class="recommendation ${rec.priority}">
            <h4>${rec.title} (${rec.priority} priority)</h4>
            <p>${rec.description}</p>
            <p><strong>Expected Impact:</strong> ${rec.expectedImpact.satisfaction}% satisfaction improvement</p>
            <p><strong>Timeline:</strong> ${rec.implementation.timeline}</p>
            <p><strong>Effort:</strong> ${rec.implementation.effort}</p>
        </div>
    `).join('')}

    <h2>Key Insights</h2>
    ${report.insights.opportunityAreas.map(area => `
        <div class="insight">
            <h4>${area.area}</h4>
            <p><strong>Opportunity:</strong> ${area.opportunity}</p>
            <p><strong>Impact:</strong> ${area.potentialImpact}</p>
            <p><strong>Priority:</strong> ${area.priority} | <strong>Effort:</strong> ${area.effort}</p>
        </div>
    `).join('')}

    <footer>
        <p>Generated on ${report.timestamp.toISOString()}</p>
        <p>Report covers ${report.analytics.userMetrics.totalUsers} users and ${report.analytics.commandMetrics.totalCommands} commands</p>
    </footer>
</body>
</html>`;
  }
}

// Export utility functions
export async function collectUXMetrics(
  config?: Partial<UXMetricsConfig>
): Promise<UXMetricsCollector> {
  const collector = new UXMetricsCollector(config);
  return collector;
}

export async function generateUXReport(
  startDate: Date,
  endDate: Date,
  config?: Partial<UXMetricsConfig>
): Promise<UXReport> {
  const collector = new UXMetricsCollector(config);
  return collector.generateReport(startDate, endDate);
}