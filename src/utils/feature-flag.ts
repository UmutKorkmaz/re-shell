/**
 * Enterprise Feature Flag Management System
 *
 * Provides comprehensive feature flag management with A/B testing,
 * gradual rollouts, remote toggles, and experimentation capabilities.
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types and Enums
// ============================================================================

export type FlagType = 'boolean' | 'string' | 'number' | 'json' | 'percentage';
export type FlagStatus = 'active' | 'inactive' | 'scheduled' | 'archived';
export type RolloutStrategy = 'all' | 'percentage' | 'whitelist' | 'gradual' | 'experiment';
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
export type VariantType = 'control' | 'treatment' | 'treatment_a' | 'treatment_b';

// ============================================================================
// Interfaces
// ============================================================================

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  type: FlagType;
  status: FlagStatus;
  defaultValue: boolean | string | number | object | null;
  currentValue: boolean | string | number | object | null;
  tags: string[];
  owner: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  conditions: TargetCondition[];
  rolloutStrategy: RolloutStrategy;
  rolloutPercentage: number; // 0-100
  whitelist: string[]; // user IDs, segments, or attributes
  segments: string[]; // segment IDs
  dependencies: string[]; // flag keys that must be enabled
}

export interface TargetCondition {
  id: string;
  attribute: string; // userId, email, tier, country, customAttribute
  operator: ConditionOperator;
  value: string | number | string[];
  enabled: boolean;
}

export interface UserSegment {
  id: string;
  name: string;
  description: string;
  conditions: TargetCondition[];
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string;
  hypothesis: string;
  successMetric: string;
  status: ExperimentStatus;
  flagKey: string;
  variants: ExperimentVariant[];
  trafficAllocation: number; // percentage of traffic to include
  startDate: Date;
  endDate: Date;
  results?: ExperimentResults;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentVariant {
  id: string;
  key: string;
  name: string;
  description: string;
  type: VariantType;
  percentage: number; // traffic allocation
  config: Record<string, unknown>;
}

export interface ExperimentResults {
  status: 'significant' | 'not_significant' | 'inconclusive';
  winner?: string; // variant key
  confidence: number; // 0-100
  pValue?: number;
  lift?: number; // percentage improvement
  metrics: VariantMetric[];
  concludedAt: Date;
}

export interface VariantMetric {
  variantKey: string;
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  meanValue?: number;
  stdDev?: number;
}

export interface FlagEvaluation {
  flagKey: string;
  enabled: boolean;
  value: boolean | string | number | object | null;
  reason: string;
  variantKey?: string;
  timestamp: Date;
}

export interface RolloutPlan {
  id: string;
  flagKey: string;
  name: string;
  description: string;
  steps: RolloutStep[];
  currentStep: number;
  status: 'pending' | 'in_progress' | 'completed' | 'rolled_back';
  monitoring: MonitoringConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolloutStep {
  step: number;
  percentage: number;
  duration: number; // hours
  waitForApproval: boolean;
  criteria: RolloutCriteria;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
}

export interface RolloutCriteria {
  errorRateThreshold: number; // percentage
  latencyThreshold: number; // milliseconds
  customMetrics?: Record<string, number>;
}

export interface MonitoringConfig {
  enabled: boolean;
  errorRate: boolean;
  latency: boolean;
  customMetrics: string[];
  alertChannels: string[];
}

export interface FlagDependency {
  flagKey: string;
  requiredValue: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  entityType: 'flag' | 'experiment' | 'segment' | 'rollout';
  entityId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
}

export interface FlagTemplate {
  key: string;
  name: string;
  description: string;
  type: FlagType;
  defaultValue: boolean | string | number;
  tags: string[];
  suggestedRollout: RolloutStrategy;
}

// ============================================================================
// Example Configuration Data
// ============================================================================

export const exampleFeatureFlags: FeatureFlag[] = [
  {
    id: 'flag-001',
    key: 'new-dashboard-ui',
    name: 'New Dashboard UI',
    description: 'Enable the new dashboard interface for beta users',
    type: 'boolean',
    status: 'active',
    defaultValue: false,
    currentValue: true,
    tags: ['ui', 'beta', 'dashboard'],
    owner: 'product-team@acme.com',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(),
    conditions: [
      {
        id: 'cond-001',
        attribute: 'tier',
        operator: 'in',
        value: ['enterprise', 'beta'],
        enabled: true
      }
    ],
    rolloutStrategy: 'whitelist',
    rolloutPercentage: 20,
    whitelist: ['user-001', 'user-002', 'user-003'],
    segments: ['beta-users'],
    dependencies: []
  },
  {
    id: 'flag-002',
    key: 'api-rate-limit-v2',
    name: 'API Rate Limiting v2',
    description: 'New rate limiting algorithm with better burst handling',
    type: 'percentage',
    status: 'active',
    defaultValue: 0,
    currentValue: 50,
    tags: ['api', 'performance', 'gradual-rollout'],
    owner: 'platform-team@acme.com',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date(),
    conditions: [],
    rolloutStrategy: 'gradual',
    rolloutPercentage: 50,
    whitelist: [],
    segments: [],
    dependencies: []
  },
  {
    id: 'flag-003',
    key: 'dark-mode-beta',
    name: 'Dark Mode Beta',
    description: 'Enable dark mode for internal testing',
    type: 'boolean',
    status: 'scheduled',
    defaultValue: false,
    currentValue: false,
    tags: ['ui', 'feature'],
    owner: 'design-team@acme.com',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date(),
    expiresAt: new Date('2024-06-01'),
    conditions: [],
    rolloutStrategy: 'percentage',
    rolloutPercentage: 0,
    whitelist: [],
    segments: [],
    dependencies: []
  }
];

export const exampleSegments: UserSegment[] = [
  {
    id: 'seg-001',
    name: 'Beta Users',
    description: 'Users who opted in for beta features',
    conditions: [
      {
        id: 'cond-seg-001',
        attribute: 'beta_opt_in',
        operator: 'eq',
        value: 'true',
        enabled: true
      }
    ],
    userCount: 1250,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  {
    id: 'seg-002',
    name: 'Enterprise Customers',
    description: 'Users with enterprise subscription tier',
    conditions: [
      {
        id: 'cond-seg-002',
        attribute: 'tier',
        operator: 'eq',
        value: 'enterprise',
        enabled: true
      }
    ],
    userCount: 450,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  {
    id: 'seg-003',
    name: 'North America Users',
    description: 'Users located in North America',
    conditions: [
      {
        id: 'cond-seg-003',
        attribute: 'country',
        operator: 'in',
        value: ['US', 'CA', 'MX'],
        enabled: true
      }
    ],
    userCount: 5000,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  }
];

export const exampleExperiments: Experiment[] = [
  {
    id: 'exp-001',
    key: 'checkout-button-color',
    name: 'Checkout Button Color Test',
    description: 'Test if green checkout button increases conversions',
    hypothesis: 'Green button will increase checkout completion by 5%',
    successMetric: 'checkout_completion_rate',
    status: 'running',
    flagKey: 'checkout-experiment',
    variants: [
      {
        id: 'var-001',
        key: 'control',
        name: 'Blue Button (Control)',
        description: 'Current blue checkout button',
        type: 'control',
        percentage: 50,
        config: { color: 'blue', text: 'Checkout' }
      },
      {
        id: 'var-002',
        key: 'treatment',
        name: 'Green Button (Treatment)',
        description: 'New green checkout button',
        type: 'treatment',
        percentage: 50,
        config: { color: 'green', text: 'Checkout Now' }
      }
    ],
    trafficAllocation: 100,
    startDate: new Date('2024-01-20'),
    endDate: new Date('2024-02-20'),
    createdBy: 'growth-team@acme.com',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  }
];

export const exampleRolloutPlan: RolloutPlan = {
  id: 'roll-001',
  flagKey: 'new-api-version',
  name: 'New API v2 Gradual Rollout',
  description: 'Gradually roll out new API version to all users',
  steps: [
    {
      step: 1,
      percentage: 10,
      duration: 24,
      waitForApproval: true,
      criteria: {
        errorRateThreshold: 1,
        latencyThreshold: 500
      },
      status: 'completed',
      startedAt: new Date('2024-01-20'),
      completedAt: new Date('2024-01-21')
    },
    {
      step: 2,
      percentage: 25,
      duration: 48,
      waitForApproval: true,
      criteria: {
        errorRateThreshold: 1,
        latencyThreshold: 500
      },
      status: 'active',
      startedAt: new Date('2024-01-22')
    },
    {
      step: 3,
      percentage: 50,
      duration: 72,
      waitForApproval: true,
      criteria: {
        errorRateThreshold: 1,
        latencyThreshold: 500
      },
      status: 'pending'
    },
    {
      step: 4,
      percentage: 100,
      duration: 168,
      waitForApproval: false,
      criteria: {
        errorRateThreshold: 1,
        latencyThreshold: 500
      },
      status: 'pending'
    }
  ],
  currentStep: 2,
  status: 'in_progress',
  monitoring: {
    enabled: true,
    errorRate: true,
    latency: true,
    customMetrics: ['api_v2_success_rate', 'api_v2_latency_p95'],
    alertChannels: ['slack', 'pagerduty']
  },
  createdAt: new Date('2024-01-19'),
  updatedAt: new Date()
};

// ============================================================================
// Manager Class
// ============================================================================

export interface FeatureFlagConfig {
  organization: string;
  description?: string;
  enablePersistence?: boolean;
  enableAuditLog?: boolean;
  enableAnalytics?: boolean;
  storageBackend?: 'memory' | 'redis' | 'database';
}

export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private segments: Map<string, UserSegment> = new Map();
  private experiments: Map<string, Experiment> = new Map();
  private rolloutPlans: Map<string, RolloutPlan> = new Map();
  private auditLogs: AuditLog[] = [];

  constructor(private config: FeatureFlagConfig) {
    this.initializeExampleData();
  }

  private initializeExampleData(): void {
    exampleFeatureFlags.forEach(f => this.flags.set(f.key, f));
    exampleSegments.forEach(s => this.segments.set(s.id, s));
    exampleExperiments.forEach(e => this.experiments.set(e.key, e));
    this.rolloutPlans.set(exampleRolloutPlan.id, exampleRolloutPlan);
  }

  generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  // Flag Management
  createFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): FeatureFlag {
    if (this.flags.has(flag.key)) {
      throw new Error(`Flag with key "${flag.key}" already exists`);
    }

    const id = this.generateId('flag');
    const newFlag: FeatureFlag = {
      ...flag,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.flags.set(flag.key, newFlag);

    this.logAudit('flag', id, 'created', {
      key: { from: null, to: flag.key },
      type: { from: null, to: flag.type },
      defaultValue: { from: null, to: flag.defaultValue }
    });

    return newFlag;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  listFlags(filters?: { status?: FlagStatus; tags?: string[]; owner?: string }): FeatureFlag[] {
    let flags = Array.from(this.flags.values());

    if (filters?.status) {
      flags = flags.filter(f => f.status === filters.status);
    }
    if (filters?.tags && filters.tags.length > 0) {
      flags = flags.filter(f => filters.tags!.some(t => f.tags.includes(t)));
    }
    if (filters?.owner) {
      flags = flags.filter(f => f.owner === filters.owner);
    }

    return flags.sort((a, b) => a.key.localeCompare(b.key));
  }

  updateFlag(key: string, updates: Partial<Omit<FeatureFlag, 'id' | 'key' | 'createdAt'>>): FeatureFlag | undefined {
    const flag = this.flags.get(key);
    if (!flag) return undefined;

    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (updates.currentValue !== undefined && updates.currentValue !== flag.currentValue) {
      changes.currentValue = { from: flag.currentValue, to: updates.currentValue };
    }
    if (updates.status !== undefined && updates.status !== flag.status) {
      changes.status = { from: flag.status, to: updates.status };
    }

    const updated: FeatureFlag = {
      ...flag,
      ...updates,
      updatedAt: new Date()
    };

    this.flags.set(key, updated);

    this.logAudit('flag', flag.id, 'updated', changes);

    return updated;
  }

  toggleFlag(key: string): FeatureFlag | undefined {
    const flag = this.flags.get(key);
    if (!flag || flag.type !== 'boolean') return undefined;

    const newValue = !flag.currentValue;
    return this.updateFlag(key, { currentValue: newValue, status: newValue ? 'active' : 'inactive' })!;
  }

  deleteFlag(key: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;

    this.logAudit('flag', flag.id, 'deleted', {
      key: { from: flag.key, to: null },
      currentValue: { from: flag.currentValue, to: null }
    });
    this.flags.delete(key);
    return true;
  }

  // Flag Evaluation
  evaluateFlag(
    key: string,
    context: Record<string, unknown>
  ): FlagEvaluation {
    const flag = this.flags.get(key);
    if (!flag) {
      return {
        flagKey: key,
        enabled: false,
        value: null,
        reason: 'Flag not found',
        timestamp: new Date()
      };
    }

    // Check if flag is active
    if (flag.status !== 'active') {
      return {
        flagKey: key,
        enabled: false,
        value: flag.defaultValue,
        reason: `Flag status is ${flag.status}`,
        timestamp: new Date()
      };
    }

    // Check expiration
    if (flag.expiresAt && flag.expiresAt < new Date()) {
      return {
        flagKey: key,
        enabled: false,
        value: flag.defaultValue,
        reason: 'Flag has expired',
        timestamp: new Date()
      };
    }

    // Check dependencies
    for (const depKey of flag.dependencies) {
      const depEval = this.evaluateFlag(depKey, context);
      if (!depEval.enabled) {
        return {
          flagKey: key,
          enabled: false,
          value: flag.defaultValue,
          reason: `Dependency "${depKey}" is not enabled`,
          timestamp: new Date()
        };
      }
    }

    // Check whitelist
    const userId = context.userId as string | undefined;
    if (flag.rolloutStrategy === 'whitelist' && flag.whitelist.length > 0) {
      if (userId && flag.whitelist.includes(userId)) {
        return {
          flagKey: key,
          enabled: true,
          value: flag.currentValue,
          reason: 'User in whitelist',
          timestamp: new Date()
        };
      }
      return {
        flagKey: key,
        enabled: false,
        value: flag.defaultValue,
        reason: 'User not in whitelist',
        timestamp: new Date()
      };
    }

    // Check segments
    for (const segmentId of flag.segments) {
      if (this.isInSegment(segmentId, context)) {
        return {
          flagKey: key,
          enabled: true,
          value: flag.currentValue,
          reason: `User in segment "${segmentId}"`,
          timestamp: new Date()
        };
      }
    }

    // Check conditions
    for (const condition of flag.conditions) {
      if (this.matchesCondition(condition, context)) {
        return {
          flagKey: key,
          enabled: true,
          value: flag.currentValue,
          reason: `Condition matched: ${condition.attribute} ${condition.operator}`,
          timestamp: new Date()
        };
      }
    }

    // Check percentage rollout
    if (flag.rolloutStrategy === 'percentage' || flag.rolloutStrategy === 'gradual') {
      const bucket = this.getUserBucket(key, context);
      const enabled = bucket < flag.rolloutPercentage;

      return {
        flagKey: key,
        enabled,
        value: flag.type === 'boolean' ? enabled : flag.currentValue,
        reason: enabled ? 'User in rollout percentage' : 'User not in rollout percentage',
        timestamp: new Date()
      };
    }

    // Default: return current value
    return {
      flagKey: key,
      enabled: flag.currentValue === true,
      value: flag.currentValue,
      reason: 'Default value',
      timestamp: new Date()
    };
  }

  private getUserBucket(key: string, context: Record<string, unknown>): number {
    const userId = context.userId as string | undefined;
    if (!userId) return 50; // Default to 50% for anonymous users

    // Simple hash-based bucket assignment (0-99)
    let hash = 0;
    const str = `${key}:${userId}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }

  private isInSegment(segmentId: string, context: Record<string, unknown>): boolean {
    const segment = this.segments.get(segmentId);
    if (!segment) return false;

    return segment.conditions.every(c => this.matchesCondition(c, context));
  }

  private matchesCondition(condition: TargetCondition, context: Record<string, unknown>): boolean {
    if (!condition.enabled) return false;

    const value = context[condition.attribute];

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (condition.value as number);
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (condition.value as number);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(String(value));
      case 'contains':
        return typeof value === 'string' && value.includes(String(condition.value));
      case 'regex':
        try {
          const regex = new RegExp(condition.value as string);
          return typeof value === 'string' && regex.test(value);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  // Segment Management
  createSegment(segment: Omit<UserSegment, 'id' | 'createdAt' | 'updatedAt'>): UserSegment {
    const id = this.generateId('seg');
    const newSegment: UserSegment = {
      ...segment,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.segments.set(id, newSegment);
    return newSegment;
  }

  getSegment(id: string): UserSegment | undefined {
    return this.segments.get(id);
  }

  listSegments(): UserSegment[] {
    return Array.from(this.segments.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Experiment Management
  createExperiment(experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>): Experiment {
    const id = this.generateId('exp');
    const newExperiment: Experiment = {
      ...experiment,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.experiments.set(experiment.key, newExperiment);

    // Create corresponding flag for experiment
    this.createFlag({
      key: experiment.flagKey,
      name: experiment.name,
      description: `Experiment flag for ${experiment.key}`,
      type: 'json',
      status: 'active',
      defaultValue: null,
      currentValue: { experiment: experiment.key, variant: 'control' },
      tags: ['experiment', 'ab-test'],
      owner: experiment.createdBy,
      conditions: [],
      rolloutStrategy: 'experiment',
      rolloutPercentage: experiment.trafficAllocation,
      whitelist: [],
      segments: [],
      dependencies: []
    });

    return newExperiment;
  }

  getExperiment(key: string): Experiment | undefined {
    return this.experiments.get(key);
  }

  // Evaluate experiment assignment for a user
  evaluateExperiment(experimentKey: string, context: Record<string, unknown>): {
    variant: string;
    config: Record<string, unknown>;
  } | null {
    const experiment = this.experiments.get(experimentKey);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    const flag = this.flags.get(experiment.flagKey);
    if (!flag || flag.status !== 'active') {
      return null;
    }

    // Check if user is in traffic allocation
    const bucket = this.getUserBucket(experimentKey, context);
    if (bucket >= experiment.trafficAllocation) {
      return null; // User not in experiment
    }

    // Assign variant based on bucket
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.percentage;
      if (bucket < cumulative) {
        return {
          variant: variant.key,
          config: variant.config
        };
      }
    }

    // Default to control
    const control = experiment.variants.find(v => v.type === 'control');
    return control ? { variant: control.key, config: control.config } : null;
  }

  completeExperiment(key: string, results: ExperimentResults): void {
    const experiment = this.experiments.get(key);
    if (!experiment) return;

    experiment.status = 'completed';
    experiment.results = results;
    experiment.updatedAt = new Date();

    // Apply winning variant if significant
    if (results.status === 'significant' && results.winner) {
      const winner = experiment.variants.find(v => v.key === results.winner);
      if (winner) {
        // Update flag with winning config
        this.updateFlag(experiment.flagKey, {
          currentValue: winner.config,
          description: `Applied winning variant "${results.winner}" from experiment ${key}`
        });
      }
    }
  }

  // Rollout Plan Management
  createRolloutPlan(plan: Omit<RolloutPlan, 'id' | 'createdAt' | 'updatedAt'>): RolloutPlan {
    const id = this.generateId('roll');
    const newPlan: RolloutPlan = {
      ...plan,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.rolloutPlans.set(id, newPlan);

    // Update flag to match initial rollout percentage
    this.updateFlag(plan.flagKey, {
      currentValue: plan.steps[0].percentage,
      rolloutPercentage: plan.steps[0].percentage
    });

    return newPlan;
  }

  advanceRolloutPlan(planId: string): RolloutStep | undefined {
    const plan = this.rolloutPlans.get(planId);
    if (!plan || plan.currentStep >= plan.steps.length) {
      return undefined;
    }

    const currentStep = plan.steps[plan.currentStep];
    const nextStep = plan.steps[plan.currentStep + 1];

    if (nextStep) {
      nextStep.status = 'active';
      nextStep.startedAt = new Date();
      plan.currentStep++;
      plan.updatedAt = new Date();

      // Update flag percentage
      this.updateFlag(plan.flagKey, {
        currentValue: nextStep.percentage,
        rolloutPercentage: nextStep.percentage
      });

      return nextStep;
    }

    return undefined;
  }

  // Audit Logging
  private logAudit(
    entityType: AuditLog['entityType'],
    entityId: string,
    action: string,
    changes?: Record<string, { from: unknown; to: unknown }>
  ): void {
    const log: AuditLog = {
      id: this.generateId('audit'),
      timestamp: new Date(),
      userId: 'system',
      action,
      entityType,
      entityId,
      changes: changes || {}
    };
    this.auditLogs.push(log);

    // Keep only last 1000 logs
    if (this.auditLogs.length > 1000) {
      this.auditLogs.shift();
    }
  }

  getAuditLogs(filters?: {
    entityType?: AuditLog['entityType'];
    entityId?: string;
    limit?: number;
  }): AuditLog[] {
    let logs = [...this.auditLogs];

    if (filters?.entityType) {
      logs = logs.filter(l => l.entityType === filters.entityType);
    }
    if (filters?.entityId) {
      logs = logs.filter(l => l.entityId === filters.entityId);
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filters?.limit ? logs.slice(0, filters.limit) : logs;
  }

  // Analytics
  getMetrics(): Record<string, unknown> {
    const flags = Array.from(this.flags.values());
    const experiments = Array.from(this.experiments.values());

    return {
      flags: {
        total: flags.length,
        active: flags.filter(f => f.status === 'active').length,
        inactive: flags.filter(f => f.status === 'inactive').length,
        byType: this.countByProperty(flags, 'type')
      },
      experiments: {
        total: experiments.length,
        running: experiments.filter(e => e.status === 'running').length,
        completed: experiments.filter(e => e.status === 'completed').length
      },
      segments: this.segments.size,
      rolloutPlans: this.rolloutPlans.size
    };
  }

  private countByProperty<T>(items: T[], prop: keyof T): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const value = String(item[prop]);
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }

  getSummary(): Record<string, unknown> {
    const metrics = this.getMetrics();

    return {
      organization: this.config.organization,
      metrics,
      activeFlags: this.listFlags({ status: 'active' }).map(f => ({
        key: f.key,
        name: f.name,
        type: f.type,
        rollout: `${f.rolloutPercentage}%`,
        status: f.status
      })),
      runningExperiments: Array.from(this.experiments.values())
        .filter(e => e.status === 'running')
        .map(e => ({
          key: e.key,
          name: e.name,
          variants: e.variants.length,
          trafficAllocation: `${e.trafficAllocation}%`,
          startDate: e.startDate
        }))
    };
  }
}

// ============================================================================
// Generators
// ============================================================================

export function generateMarkdown(name: string, manager: FeatureFlagManager): string {
  const summary = manager.getSummary();

  return `# Feature Flag Management System
**Generated for:** ${name}

## Overview

This document outlines the feature flag management system including flags, segments, experiments, and rollout plans.

---

## Summary

| Metric | Count |
|--------|-------|
| Total Flags | ${(summary.metrics as any).flags.total} |
| Active Flags | ${(summary.metrics as any).flags.active} |
| Total Experiments | ${(summary.metrics as any).experiments.total} |
| Running Experiments | ${(summary.metrics as any).experiments.running} |
| Segments | ${(summary.metrics as any).segments} |
| Rollout Plans | ${(summary.metrics as any).rolloutPlans} |

---

## Active Flags

${(summary.activeFlags as any[]).map((f: any) => `
### ${f.name}
- **Key:** \`${f.key}\`
- **Type:** ${f.type}
- **Rollout:** ${f.rollout}
- **Status:** ${f.status}
`).join('\n')}

---

## Usage Examples

### Evaluate a Flag
\`\`\`typescript
import { FeatureFlagManager } from './feature-flag-manager';

const manager = new FeatureFlagManager({
  organization: '${name}'
});

const evaluation = manager.evaluateFlag('new-dashboard-ui', {
  userId: 'user-123',
  tier: 'enterprise'
});

console.log(evaluation);
// { flagKey: 'new-dashboard-ui', enabled: true, value: true, reason: 'User in whitelist' }
\`\`\`

### Create a New Flag
\`\`\`typescript
const flag = manager.createFlag({
  key: 'new-feature',
  name: 'New Feature',
  description: 'Enable the new feature',
  type: 'boolean',
  status: 'inactive',
  defaultValue: false,
  currentValue: false,
  tags: ['feature'],
  owner: 'product@acme.com',
  conditions: [],
  rolloutStrategy: 'percentage',
  rolloutPercentage: 0,
  whitelist: [],
  segments: [],
  dependencies: []
});
\`\`\`

### Create an A/B Test
\`\`\`typescript
const experiment = manager.createExperiment({
  key: 'button-color-test',
  name: 'Button Color Test',
  description: 'Test green vs blue button',
  hypothesis: 'Green button increases conversions',
  successMetric: 'click_rate',
  status: 'running',
  flagKey: 'button-experiment',
  variants: [
    {
      id: 'var-1',
      key: 'control',
      name: 'Blue',
      description: 'Control blue button',
      type: 'control',
      percentage: 50,
      config: { color: 'blue' }
    },
    {
      id: 'var-2',
      key: 'treatment',
      name: 'Green',
      description: 'Treatment green button',
      type: 'treatment',
      percentage: 50,
      config: { color: 'green' }
    }
  ],
  trafficAllocation: 100,
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdBy: 'growth-team@acme.com'
});

// Evaluate experiment for a user
const assignment = manager.evaluateExperiment('button-color-test', {
  userId: 'user-123'
});

console.log(assignment);
// { variant: 'control', config: { color: 'blue' } }
\`\`\`

---

*Document generated on ${new Date().toISOString()}*
`;
}

export function generateTerraform(provider: 'aws' | 'azure' | 'gcp', name: string, config: FeatureFlagConfig): string {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

  if (provider === 'aws') {
    return `# Terraform for Feature Flag Management - AWS
# Generated for ${name}

# DynamoDB for feature flags
resource "aws_dynamodb_table" "feature_flags" {
  name = "${normalizedName}-feature-flags"
  billing_mode = "PAY_PER_REQUEST"
  hash_key = "key"

  attribute {
    name = "key"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  ttl {
    attribute_name = "expires_at"
    enabled = false
  }
}

# DynamoDB for experiments
resource "aws_dynamodb_table" "experiments" {
  name = "${normalizedName}-experiments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key = "key"

  attribute {
    name = "key"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# DynamoDB for segments
resource "aws_dynamodb_table" "segments" {
  name = "${normalizedName}-segments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  global_secondary_index {
    name = "ByName"
    hash_key = "name"
    projection_type = "ALL"
  }
}

# DynamoDB for audit logs
resource "aws_dynamodb_table" "audit_logs" {
  name = "${normalizedName}-audit-logs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  global_secondary_index {
    name = "ByTimestamp"
    hash_key = "timestamp"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "retention_until"
    enabled = true
  }
}

# Lambda for flag evaluation
resource "aws_lambda_function" "flag_evaluator" {
  function_name = "${normalizedName}-flag-evaluator"
  role = aws_iam_role.lambda_role.arn
  package_type = "Zip"
  runtime = "nodejs20.x"
  handler = "index.handler"

  environment {
    variables = {
      FLAGS_TABLE = aws_dynamodb_table.feature_flags.name
      SEGMENTS_TABLE = aws_dynamodb_table.segments.name
      EXPERIMENTS_TABLE = aws_dynamodb_table.experiments.name
    }
  }
}

# API Gateway for flag evaluation API
resource "aws_apigatewayv2_api" "feature_flags" {
  name = "${normalizedName}-feature-flags"
  protocol_type = "HTTP"
  target = aws_lambda_function.flag_evaluator.arn
}

resource "aws_apigatewayv2_stage" "production" {
  api_id = aws_apigatewayv2_api.feature_flags.id
  name = "production"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttrottling_burst_limit = 100
    throttrottling_rate_limit = 50
  }
}

# CloudWatch for metrics
resource "aws_cloudwatch_dashboard" "feature_flags" {
  dashboard_name = "${normalizedName}-feature-flags"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric",
        x = 0,
        y = 0,
        width = 12,
        height = 6,
        properties = {
          metrics = [
            {
              label = "Flag Evaluations",
              id = "flagEvaluations",
              stat = "Sum",
              period = 300,
              refId = "flagEvaluations"
            }
          ]
        }
      }
    ]
  })
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${normalizedName}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "dynamodb" {
  role = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}
`;
  }

  if (provider === 'azure') {
    return `# Terraform for Feature Flag Management - Azure
# Generated for ${name}

# Cosmos DB for feature flags
resource "azurerm_cosmosdb_account" "feature_flags" {
  name = "${normalizedName}-feature-flags"
  location = var.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type = "Standard"
  kind = "GlobalDocumentDB"
}

resource "azurerm_cosmosdb_sql_database" "flags" {
  name = "feature-flags"
  resource_group_name = azurerm_resource_group.main.name
  account_name = azurerm_cosmosdb_account.feature_flags.name
}

# Azure Function for flag evaluation
resource "azurerm_function_app" "flag_evaluator" {
  name = "${normalizedName}-flag-evaluator"
  location = var.location
  resource_group_name = azurerm_resource_group.main.name
  app_service_plan_id = azurerm_app_service_plan.main.id

  app_settings = {
    FLAGS_DATABASE = azurerm_cosmosdb_account.feature_flags.endpoint
    EXPERIMENTS_DATABASE = azurerm_cosmosdb_account.feature_flags.endpoint
  }
}

# Application Insights for monitoring
resource "azurerm_application_insights" "monitoring" {
  name = "${normalizedName}-monitoring"
  location = var.location
  resource_group_name = azurerm_resource_group.main.name
  application_type = "web"
}

resource "azurerm_resource_group" "main" {
  name = "${normalizedName}-rg"
  location = var.location
}
`;
  }

  // GCP
  return `# Terraform for Feature Flag Management - GCP
# Generated for ${name}

# Firestore for feature flags
resource "google_firestore_database" "feature_flags" {
  name = "${normalizedName}-feature-flags"
  location = var.location
  type = "FIRESTORE_NATIVE"

  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
}

# Firestore for experiments
resource "google_firestore_database" "experiments" {
  name = "${normalizedName}-experiments"
  location = var.location
  type = "FIRESTORE_NATIVE"
}

# Cloud Functions for flag evaluation
resource "google_cloud_function_v2" "flag_evaluator" {
  name = "${normalizedName}-flag-evaluator"
  location = var.location
  description = "Feature flag evaluation endpoint"

  build_config {
    runtime = "nodejs20"
    entry_point = "evaluateFlag"
    environment_variables = {
      FLAGS_COLLECTION = "feature_flags"
      EXPERIMENTS_COLLECTION = "experiments"
    }
  }

  service_config {
    available_memory = "256M"
    timeout_seconds = 10
  }
}

# Cloud Monitoring dashboard
resource "google_monitoring_dashboard" "feature_flags" {
  dashboard_json = jsonencode({
    displayName = "${normalizedName} Feature Flags"
    gridLayout = {
      widgets = [
        {
          title = "Flag Evaluations"
          widget = {
            title = "Evaluations per minute"
            score = {
              timeSeriesQuery = {
                query = "fetch feature_flag_evaluation"
              }
            }
          }
        }
      ]
    }
  })
}
`;
}

export function generateTypeScript(name: string, config: FeatureFlagConfig): string {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

return `// Feature Flag Manager - TypeScript
// Generated for ${name}

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ============================================================================
// Enums
// ============================================================================

export enum FlagType {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
  JSON = 'json',
  PERCENTAGE = 'percentage'
}

export enum FlagStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SCHEDULED = 'scheduled',
  ARCHIVED = 'archived'
}

export enum RolloutStrategy {
  ALL = 'all',
  PERCENTAGE = 'percentage',
  WHITELIST = 'whitelist',
  GRADUAL = 'gradual',
  EXPERIMENT = 'experiment'
}

export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// ============================================================================
// Interfaces
// ============================================================================

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  type: FlagType;
  status: FlagStatus;
  defaultValue: boolean | string | number | object | null;
  currentValue: boolean | string | number | object | null;
  tags: string[];
  owner: string;
  rolloutStrategy: RolloutStrategy;
  rolloutPercentage: number;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string;
  hypothesis: string;
  successMetric: string;
  status: ExperimentStatus;
  flagKey: string;
  variants: ExperimentVariant[];
  trafficAllocation: number;
  startDate: Date;
  endDate: Date;
}

export interface ExperimentVariant {
  id: string;
  key: string;
  name: string;
  description: string;
  type: 'control' | 'treatment';
  percentage: number;
  config: Record<string, unknown>;
}

export interface FlagEvaluation {
  flagKey: string;
  enabled: boolean;
  value: boolean | string | number | object | null;
  reason: string;
  timestamp: Date;
}

// ============================================================================
// Manager Class
// ============================================================================

export class FeatureFlagManager extends EventEmitter {
  private flags: Map<string, FeatureFlag> = new Map();
  private experiments: Map<string, Experiment> = new Map();

  constructor(private organization: string) {
    super();
  }

  generateId(prefix: string): string {
    return \`\${prefix}-\${Date.now()}-\${randomUUID().slice(0, 8)}\`;
  }

  // Flag Management
  createFlag(flag: Omit<FeatureFlag, 'id'>): FeatureFlag {
    const id = this.generateId('flag');
    const newFlag: FeatureFlag = {
      ...flag,
      id
    };
    this.flags.set(flag.key, newFlag);
    this.emit('flagCreated', newFlag);
    return newFlag;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  updateFlag(key: string, updates: Partial<FeatureFlag>): FeatureFlag | undefined {
    const flag = this.flags.get(key);
    if (!flag) return undefined;

    const updated = { ...flag, ...updates };
    this.flags.set(key, updated);
    this.emit('flagUpdated', updated);
    return updated;
  }

  toggleFlag(key: string): boolean | undefined {
    const flag = this.flags.get(key);
    if (!flag || flag.type !== FlagType.BOOLEAN) return undefined;

    const newValue = !flag.currentValue;
    this.updateFlag(key, { currentValue: newValue, status: newValue ? FlagStatus.ACTIVE : FlagStatus.INACTIVE });
    this.emit('flagToggled', { key, value: newValue });
    return newValue;
  }

  listFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  // Flag Evaluation
  evaluateFlag(key: string, context: Record<string, unknown> = {}): FlagEvaluation {
    const flag = this.flags.get(key);

    if (!flag || flag.status !== FlagStatus.ACTIVE) {
      return {
        flagKey: key,
        enabled: false,
        value: flag?.defaultValue ?? null,
        reason: flag ? 'Flag not active' : 'Flag not found',
        timestamp: new Date()
      };
    }

    // Simple percentage-based rollout
    const bucket = this.getUserBucket(key, context);
    const enabled = bucket < flag.rolloutPercentage;

    return {
      flagKey: key,
      enabled,
      value: flag.currentValue,
      reason: enabled ? 'In rollout percentage' : 'Not in rollout percentage',
      timestamp: new Date()
    };
  }

  private getUserBucket(key: string, context: Record<string, unknown>): number {
    const userId = context.userId as string | undefined;
    if (!userId) return 50;

    let hash = 0;
    const str = \`\${key}:\${userId}\`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }

  // Experiment Management
  createExperiment(experiment: Omit<Experiment, 'id'>): Experiment {
    const id = this.generateId('exp');
    const newExperiment: Experiment = {
      ...experiment,
      id
    };
    this.experiments.set(experiment.key, newExperiment);
    this.emit('experimentCreated', newExperiment);
    return newExperiment;
  }

  evaluateExperiment(experimentKey: string, context: Record<string, unknown>): {
    variant: string;
    config: Record<string, unknown>;
  } | null {
    const experiment = this.experiments.get(experimentKey);
    if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
      return null;
    }

    const bucket = this.getUserBucket(experimentKey, context);
    if (bucket >= experiment.trafficAllocation) {
      return null;
    }

    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.percentage;
      if (bucket < cumulative) {
        return {
          variant: variant.key,
          config: variant.config
        };
      }
    }

    return null;
  }

  getMetrics() {
    return {
      organization: this.organization,
      flags: {
        total: this.flags.size,
        active: Array.from(this.flags.values()).filter(f => f.status === FlagStatus.ACTIVE).length
      },
      experiments: {
        total: this.experiments.size,
        running: Array.from(this.experiments.values()).filter(e => e.status === ExperimentStatus.RUNNING).length
      }
    };
  }
}

// ============================================================================
// Usage Example
// ============================================================================

const manager = new FeatureFlagManager('${normalizedName}');

// Create a flag
const flag = manager.createFlag({
  key: 'new-feature',
  name: 'New Feature',
  description: 'Enable the new feature',
  type: FlagType.BOOLEAN,
  status: FlagStatus.ACTIVE,
  defaultValue: false,
  currentValue: true,
  tags: ['feature'],
  owner: 'product@${normalizedName}.com',
  rolloutStrategy: RolloutStrategy.PERCENTAGE,
  rolloutPercentage: 50
});

// Evaluate for a user
const evaluation = manager.evaluateFlag('new-feature', {
  userId: 'user-123'
});

console.log('Evaluation:', evaluation);

export { manager as featureFlagManager };
`;
}

export function generatePython(name: string, config: FeatureFlagConfig): string {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

return `# Feature Flag Manager - Python
# Generated for ${name}

from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
import uuid
import json
import hashlib

# ============================================================================
# Enums
# ============================================================================

class FlagType(Enum):
    BOOLEAN = "boolean"
    STRING = "string"
    NUMBER = "number"
    JSON = "json"
    PERCENTAGE = "percentage"

class FlagStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SCHEDULED = "scheduled"
    ARCHIVED = "archived"

class RolloutStrategy(Enum):
    ALL = "all"
    PERCENTAGE = "percentage"
    WHITELIST = "whitelist"
    GRADUAL = "gradual"
    EXPERIMENT = "experiment"

class ExperimentStatus(Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class FeatureFlag:
    id: str
    key: str
    name: str
    description: str
    type: FlagType
    status: FlagStatus
    default_value: Optional[Union[bool, str, int, dict, None]]
    current_value: Optional[Union[bool, str, int, dict, None]]
    tags: List[str]
    owner: str
    rollout_strategy: RolloutStrategy
    rollout_percentage: int
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

@dataclass
class ExperimentVariant:
    id: str
    key: str
    name: str
    description: str
    type: str  # control, treatment
    percentage: int
    config: Dict[str, Any]

@dataclass
class Experiment:
    id: str
    key: str
    name: str
    description: str
    hypothesis: str
    success_metric: str
    status: ExperimentStatus
    flag_key: str
    variants: List[ExperimentVariant]
    traffic_allocation: int
    start_date: datetime
    end_date: datetime
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

@dataclass
class FlagEvaluation:
    flag_key: str
    enabled: bool
    value: Optional[Union[bool, str, int, dict, None]]
    reason: str
    timestamp: datetime = field(default_factory=datetime.now)

# ============================================================================
# Manager Class
# ============================================================================

class FeatureFlagManager:
    def __init__(self, organization: str):
        self.organization = organization
        self.flags: Dict[str, FeatureFlag] = {}
        self.experiments: Dict[str, Experiment] = {}

    def generate_id(self, prefix: str) -> str:
        timestamp = int(datetime.now().timestamp())
        unique = uuid.uuid4().hex[:8]
        return f"{prefix}-{timestamp}-{unique}"

    # Flag Management
    def create_flag(
        self,
        key: str,
        name: str,
        description: str,
        flag_type: FlagType,
        status: FlagStatus,
        default_value: Optional[Union[bool, str, int, dict, None]],
        current_value: Optional[Union[bool, str, int, dict, None]],
        tags: List[str],
        owner: str,
        rollout_strategy: RolloutStrategy,
        rollout_percentage: int
    ) -> FeatureFlag:
        flag_id = self.generate_id("flag")
        flag = FeatureFlag(
            id=flag_id,
            key=key,
            name=name,
            description=description,
            type=flag_type,
            status=status,
            default_value=default_value,
            current_value=current_value,
            tags=tags,
            owner=owner,
            rollout_strategy=rollout_strategy,
            rollout_percentage=rollout_percentage
        )
        self.flags[key] = flag
        return flag

    def get_flag(self, key: str) -> Optional[FeatureFlag]:
        return self.flags.get(key)

    def update_flag(self, key: str, **updates) -> Optional[FeatureFlag]:
        flag = self.flags.get(key)
        if not flag:
            return None

        for k, v in updates.items():
            setattr(flag, k, v)
        flag.updated_at = datetime.now()
        return flag

    def toggle_flag(self, key: str) -> Optional[bool]:
        flag = self.flags.get(key)
        if not flag or flag.type != FlagType.BOOLEAN:
            return None

        new_value = not flag.current_value
        flag.current_value = new_value
        flag.status = FlagStatus.ACTIVE if new_value else FlagStatus.INACTIVE
        flag.updated_at = datetime.now()
        return new_value

    def list_flags(self) -> List[FeatureFlag]:
        return list(self.flags.values())

    # Flag Evaluation
    def evaluate_flag(self, key: str, context: Optional[Dict[str, Any]] = None) -> FlagEvaluation:
        flag = self.flags.get(key)
        ctx = context or {}

        if not flag or flag.status != FlagStatus.ACTIVE:
            return FlagEvaluation(
                flag_key=key,
                enabled=False,
                value=flag.default_value if flag else None,
                reason="Flag not active" if flag else "Flag not found"
            )

        # Simple percentage-based rollout
        bucket = self._get_user_bucket(key, ctx)
        enabled = bucket < flag.rollout_percentage

        return FlagEvaluation(
            flag_key=key,
            enabled=enabled,
            value=flag.current_value,
            reason="In rollout percentage" if enabled else "Not in rollout percentage"
        )

    def _get_user_bucket(self, key: str, context: Dict[str, Any]) -> int:
        user_id = context.get("userId")
        if not user_id:
            return 50

        # Hash-based bucket assignment
        data = f"{key}:{user_id}".encode()
        hash_val = int(hashlib.sha256(data).hexdigest(), 16)
        return hash_val % 100

    # Experiment Management
    def create_experiment(
        self,
        key: str,
        name: str,
        description: str,
        hypothesis: str,
        success_metric: str,
        flag_key: str,
        variants: List[ExperimentVariant],
        traffic_allocation: int,
        start_date: datetime,
        end_date: datetime
    ) -> Experiment:
        exp_id = self.generate_id("exp")
        experiment = Experiment(
            id=exp_id,
            key=key,
            name=name,
            description=description,
            hypothesis=hypothesis,
            success_metric=success_metric,
            status=ExperimentStatus.RUNNING,
            flag_key=flag_key,
            variants=variants,
            traffic_allocation=traffic_allocation,
            start_date=start_date,
            end_date=end_date
        )
        self.experiments[key] = experiment

        # Create corresponding flag
        self.create_flag(
            key=flag_key,
            name=f"Experiment: {name}",
            description=f"Flag for A/B test: {name}",
            flag_type=FlagType.JSON,
            status=FlagStatus.ACTIVE,
            default_value=None,
            current_value={"experiment": key, "variant": "control"},
            tags=["experiment"],
            owner="growth-team",
            rollout_strategy=RolloutStrategy.EXPERIMENT,
            rollout_percentage=traffic_allocation
        )

        return experiment

    def evaluate_experiment(
        self,
        experiment_key: str,
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        experiment = self.experiments.get(experiment_key)
        if not experiment or experiment.status != ExperimentStatus.RUNNING:
            return None

        bucket = self._get_user_bucket(experiment_key, context)
        if bucket >= experiment.traffic_allocation:
            return None

        cumulative = 0
        for variant in experiment.variants:
            cumulative += variant.percentage
            if bucket < cumulative:
                return {
                    "variant": variant.key,
                    "config": variant.config
                }

        return None

    def get_metrics(self) -> Dict[str, Any]:
        flags_list = list(self.flags.values())
        experiments_list = list(self.experiments.values())

        return {
            "organization": self.organization,
            "flags": {
                "total": len(flags_list),
                "active": sum(1 for f in flags_list if f.status == FlagStatus.ACTIVE)
            },
            "experiments": {
                "total": len(experiments_list),
                "running": sum(1 for e in experiments_list if e.status == ExperimentStatus.RUNNING)
            }
        }

# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    manager = FeatureFlagManager("${normalizedName}")

    # Create a flag
    flag = manager.create_flag(
        key="new-feature",
        name="New Feature",
        description="Enable the new feature",
        flag_type=FlagType.BOOLEAN,
        status=FlagStatus.ACTIVE,
        default_value=False,
        current_value=True,
        tags=["feature"],
        owner="product@${normalizedName}.com",
        rollout_strategy=RolloutStrategy.PERCENTAGE,
        rollout_percentage=50
    )

    # Evaluate for a user
    evaluation = manager.evaluate_flag("new-feature", {"userId": "user-123"})
    print("Evaluation:", evaluation)

    # Get metrics
    metrics = manager.get_metrics()
    print("Metrics:", json.dumps(metrics, indent=2, default=str))
`;
}

export async function writeFeatureFlagFiles(
  config: FeatureFlagConfig,
  outputDir: string,
  language: string
): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const manager = new FeatureFlagManager(config);

  // Always generate Terraform
  const awsTerraform = generateTerraform('aws', config.organization, config);
  const terraformDir = path.join(outputDir, 'terraform', 'aws');
  await fs.ensureDir(terraformDir);
  await fs.writeFile(path.join(terraformDir, 'main.tf'), awsTerraform);

  // Generate language-specific files
  if (language === 'typescript') {
    const tsCode = generateTypeScript(config.organization, config);
    await fs.writeFile(path.join(outputDir, 'feature-flag-manager.ts'), tsCode);

    const packageJson = {
      name: `${config.organization.toLowerCase()}-feature-flags`,
      version: '1.0.0',
      description: 'Enterprise feature flag management system',
      main: 'feature-flag-manager.ts',
      scripts: {
        dev: 'ts-node feature-flag-manager.ts',
        test: 'jest',
      },
      dependencies: {
        '@types/node': '^20.0.0',
        events: '^3.3.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        'ts-node': '^10.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePython(config.organization, config);
    await fs.writeFile(path.join(outputDir, 'feature_flag_manager.py'), pyCode);

    const requirements = [
      'typing>=3.10.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  // Generate markdown and config
  const markdown = generateMarkdown(config.organization, manager);
  await fs.writeFile(path.join(outputDir, 'FEATURE_FLAG_GUIDE.md'), markdown);

  const configJson = {
    organization: config.organization,
    description: config.description,
    enablePersistence: config.enablePersistence ?? true,
    enableAuditLog: config.enableAuditLog ?? true,
    enableAnalytics: config.enableAnalytics ?? true,
    storageBackend: config.storageBackend || 'memory',
  };
  await fs.writeFile(path.join(outputDir, 'feature-flag-config.json'), JSON.stringify(configJson, null, 2));
}

export function createExampleFeatureFlagConfig(): FeatureFlagConfig {
  return {
    organization: 'Acme Corp',
    description: 'Enterprise feature flag management',
    enablePersistence: true,
    enableAuditLog: true,
    enableAnalytics: true,
    storageBackend: 'memory',
  };
}

export function displayFeatureFlagConfig(config: FeatureFlagConfig, language: string, output: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chalk = require('chalk');

  console.log(chalk.cyan('\n✨ Feature Flag Management with A/B Testing'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Organization:'), config.organization);
  console.log(chalk.yellow('Description:'), config.description || 'N/A');
  console.log(chalk.yellow('Language:'), language);
  console.log(chalk.yellow('Output:'), output);
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.cyan('\n⚙️  Features:'));
  console.log(chalk.gray('  Persistence:'), config.enablePersistence ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('  Audit Logging:'), config.enableAuditLog ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('  Analytics:'), config.enableAnalytics ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('\n📁 Output Files:'));
  console.log(chalk.gray('  - feature-flag-manager.' + (language === 'typescript' ? 'ts' : 'py')));
  console.log(chalk.gray('  - FEATURE_FLAG_GUIDE.md'));
  console.log(chalk.gray('  - feature-flag-config.json'));
  console.log(chalk.gray('  - terraform/provider/main.tf'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}
