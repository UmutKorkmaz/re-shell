/**
 * Graceful degradation under resource constraints
 */
import { EventEmitter } from 'events';

interface DegradationLevel {
  name: string;
  priority: number;
  memoryThreshold: number; // MB
  cpuThreshold: number; // %
  actions: DegradationAction[];
}

interface DegradationAction {
  type: 'disable_feature' | 'reduce_quality' | 'limit_concurrency' | 'clear_cache' | 'delay_operations';
  target: string;
  parameters?: Record<string, any>;
  reversible: boolean;
}

interface SystemConstraints {
  memory: {
    current: number;
    limit: number;
    available: number;
  };
  cpu: {
    current: number;
    limit: number;
  };
  operations: {
    running: number;
    queued: number;
    limit: number;
  };
}

export class GracefulDegradation extends EventEmitter {
  private static instance: GracefulDegradation;
  private currentLevel = 0; // 0 = normal operation
  private activatedActions: DegradationAction[] = [];
  private monitoring = false;
  private monitorInterval?: NodeJS.Timeout;
  private lastCpuUsage?: NodeJS.CpuUsage;
  private lastCpuTime?: number;
  
  private degradationLevels: DegradationLevel[] = [
    {
      name: 'normal',
      priority: 0,
      memoryThreshold: 0,
      cpuThreshold: 0,
      actions: []
    },
    {
      name: 'light_constraints',
      priority: 1,
      memoryThreshold: 80, // MB
      cpuThreshold: 70, // %
      actions: [
        {
          type: 'disable_feature',
          target: 'auto_update_check',
          reversible: true
        },
        {
          type: 'reduce_quality',
          target: 'progress_animations',
          parameters: { fps: 15 },
          reversible: true
        },
        {
          type: 'limit_concurrency',
          target: 'file_operations',
          parameters: { maxConcurrent: 3 },
          reversible: true
        }
      ]
    },
    {
      name: 'moderate_constraints',
      priority: 2,
      memoryThreshold: 120, // MB
      cpuThreshold: 85, // %
      actions: [
        {
          type: 'disable_feature',
          target: 'syntax_highlighting',
          reversible: true
        },
        {
          type: 'clear_cache',
          target: 'template_cache',
          reversible: false
        },
        {
          type: 'limit_concurrency',
          target: 'network_requests',
          parameters: { maxConcurrent: 2 },
          reversible: true
        },
        {
          type: 'delay_operations',
          target: 'background_tasks',
          parameters: { delayMs: 5000 },
          reversible: true
        }
      ]
    },
    {
      name: 'severe_constraints',
      priority: 3,
      memoryThreshold: 160, // MB
      cpuThreshold: 95, // %
      actions: [
        {
          type: 'disable_feature',
          target: 'file_watching',
          reversible: true
        },
        {
          type: 'disable_feature',
          target: 'plugin_system',
          reversible: true
        },
        {
          type: 'clear_cache',
          target: 'all_caches',
          reversible: false
        },
        {
          type: 'limit_concurrency',
          target: 'all_operations',
          parameters: { maxConcurrent: 1 },
          reversible: true
        }
      ]
    },
    {
      name: 'critical_constraints',
      priority: 4,
      memoryThreshold: 200, // MB
      cpuThreshold: 98, // %
      actions: [
        {
          type: 'disable_feature',
          target: 'non_essential_commands',
          reversible: true
        },
        {
          type: 'clear_cache',
          target: 'memory_intensive_caches',
          reversible: false
        }
      ]
    }
  ];
  
  private constructor() {
    super();
  }
  
  static getInstance(): GracefulDegradation {
    if (!GracefulDegradation.instance) {
      GracefulDegradation.instance = new GracefulDegradation();
    }
    return GracefulDegradation.instance;
  }
  
  /**
   * Start monitoring system constraints
   */
  startMonitoring(intervalMs = 5000): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.monitorInterval = setInterval(() => {
      this.checkConstraints();
    }, intervalMs);
    
    // Initial check
    this.checkConstraints();
    
    this.emit('monitoringStarted', { interval: intervalMs });
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    
    // Restore normal operation
    this.restoreNormalOperation();
    
    this.emit('monitoringStopped');
  }
  
  /**
   * Manually trigger degradation to a specific level
   */
  degradeToLevel(level: number): void {
    if (level < 0 || level >= this.degradationLevels.length) {
      throw new Error(`Invalid degradation level: ${level}`);
    }
    
    this.applyDegradationLevel(level);
  }
  
  /**
   * Get current degradation status
   */
  getStatus(): {
    level: number;
    levelName: string;
    activatedActions: DegradationAction[];
    constraints: SystemConstraints;
  } {
    return {
      level: this.currentLevel,
      levelName: this.degradationLevels[this.currentLevel].name,
      activatedActions: [...this.activatedActions],
      constraints: this.getCurrentConstraints()
    };
  }
  
  /**
   * Check if a feature is currently disabled
   */
  isFeatureDisabled(feature: string): boolean {
    return this.activatedActions.some(action => 
      action.type === 'disable_feature' && action.target === feature
    );
  }
  
  /**
   * Get current concurrency limit for a target
   */
  getConcurrencyLimit(target: string): number | null {
    const action = this.activatedActions.find(action => 
      action.type === 'limit_concurrency' && action.target === target
    );
    
    return action?.parameters?.maxConcurrent || null;
  }
  
  /**
   * Get current operation delay for a target
   */
  getOperationDelay(target: string): number {
    const action = this.activatedActions.find(action => 
      action.type === 'delay_operations' && action.target === target
    );
    
    return action?.parameters?.delayMs || 0;
  }
  
  /**
   * Add custom degradation level
   */
  addDegradationLevel(level: DegradationLevel): void {
    // Insert in priority order
    let insertIndex = this.degradationLevels.findIndex(l => l.priority > level.priority);
    if (insertIndex === -1) {
      insertIndex = this.degradationLevels.length;
    }
    
    this.degradationLevels.splice(insertIndex, 0, level);
    this.emit('degradationLevelAdded', level);
  }
  
  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      global.gc();
      this.emit('garbageCollectionForced');
      return true;
    }
    return false;
  }
  
  /**
   * Check current system constraints and apply degradation if needed
   */
  private checkConstraints(): void {
    const constraints = this.getCurrentConstraints();
    const requiredLevel = this.calculateRequiredDegradationLevel(constraints);
    
    if (requiredLevel !== this.currentLevel) {
      this.applyDegradationLevel(requiredLevel);
    }
    
    this.emit('constraintsChecked', { constraints, level: this.currentLevel });
  }
  
  /**
   * Get current system constraints
   */
  private getCurrentConstraints(): SystemConstraints {
    const memory = process.memoryUsage();
    const memoryMB = memory.heapUsed / 1024 / 1024;

    // Calculate CPU usage as a percentage of elapsed real time
    const now = Date.now();
    let cpuPercent = 0;
    if (this.lastCpuUsage && this.lastCpuTime) {
      const delta = process.cpuUsage(this.lastCpuUsage);
      const elapsedUs = (now - this.lastCpuTime) * 1000; // ms to microseconds
      cpuPercent = elapsedUs > 0 ? ((delta.user + delta.system) / elapsedUs) * 100 : 0;
    }
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = now;

    return {
      memory: {
        current: memoryMB,
        limit: 500, // Assume 500MB limit
        available: 500 - memoryMB
      },
      cpu: {
        current: Math.min(100, cpuPercent),
        limit: 100
      },
      operations: {
        running: 0, // Would be populated by operation managers
        queued: 0,
        limit: 10
      }
    };
  }
  
  /**
   * Calculate required degradation level based on constraints
   */
  private calculateRequiredDegradationLevel(constraints: SystemConstraints): number {
    let requiredLevel = 0;
    
    for (let i = 1; i < this.degradationLevels.length; i++) {
      const level = this.degradationLevels[i];
      
      if (constraints.memory.current >= level.memoryThreshold ||
          constraints.cpu.current >= level.cpuThreshold) {
        requiredLevel = i;
      }
    }
    
    // Add hysteresis to prevent oscillation
    if (requiredLevel < this.currentLevel) {
      const currentLevelDef = this.degradationLevels[this.currentLevel];
      const hysteresis = 10; // 10% hysteresis
      
      if (constraints.memory.current >= (currentLevelDef.memoryThreshold - hysteresis) ||
          constraints.cpu.current >= (currentLevelDef.cpuThreshold - hysteresis)) {
        requiredLevel = this.currentLevel; // Stay at current level
      }
    }
    
    return requiredLevel;
  }
  
  /**
   * Apply degradation actions for a specific level
   */
  private applyDegradationLevel(targetLevel: number): void {
    const previousLevel = this.currentLevel;
    
    if (targetLevel > this.currentLevel) {
      // Increasing degradation - apply new actions
      for (let level = this.currentLevel + 1; level <= targetLevel; level++) {
        const levelDef = this.degradationLevels[level];
        this.applyActions(levelDef.actions);
      }
    } else if (targetLevel < this.currentLevel) {
      // Decreasing degradation - reverse actions
      for (let level = this.currentLevel; level > targetLevel; level--) {
        const levelDef = this.degradationLevels[level];
        this.reverseActions(levelDef.actions);
      }
    }
    
    this.currentLevel = targetLevel;
    
    this.emit('degradationLevelChanged', {
      previousLevel,
      currentLevel: targetLevel,
      levelName: this.degradationLevels[targetLevel].name,
      activatedActions: this.activatedActions.length
    });
    
    // Force GC at higher degradation levels
    if (targetLevel >= 2) {
      this.forceGarbageCollection();
    }
  }
  
  /**
   * Apply degradation actions
   */
  private applyActions(actions: DegradationAction[]): void {
    for (const action of actions) {
      this.applyAction(action);
      this.activatedActions.push({ ...action });
    }
  }
  
  /**
   * Reverse degradation actions
   */
  private reverseActions(actions: DegradationAction[]): void {
    for (const action of actions) {
      if (action.reversible) {
        this.reverseAction(action);
        this.activatedActions = this.activatedActions.filter(a => 
          !(a.type === action.type && a.target === action.target)
        );
      }
    }
  }
  
  /**
   * Apply a single degradation action
   */
  private applyAction(action: DegradationAction): void {
    this.emit('actionApplied', action);
    
    switch (action.type) {
      case 'disable_feature':
        this.emit('featureDisabled', { feature: action.target });
        break;
        
      case 'reduce_quality':
        this.emit('qualityReduced', { 
          target: action.target, 
          parameters: action.parameters 
        });
        break;
        
      case 'limit_concurrency':
        this.emit('concurrencyLimited', { 
          target: action.target, 
          limit: action.parameters?.maxConcurrent 
        });
        break;
        
      case 'clear_cache':
        this.emit('cacheCleared', { target: action.target });
        break;
        
      case 'delay_operations':
        this.emit('operationsDelayed', { 
          target: action.target, 
          delay: action.parameters?.delayMs 
        });
        break;
    }
  }
  
  /**
   * Reverse a single degradation action
   */
  private reverseAction(action: DegradationAction): void {
    this.emit('actionReversed', action);
    
    switch (action.type) {
      case 'disable_feature':
        this.emit('featureEnabled', { feature: action.target });
        break;
        
      case 'reduce_quality':
        this.emit('qualityRestored', { target: action.target });
        break;
        
      case 'limit_concurrency':
        this.emit('concurrencyRestored', { target: action.target });
        break;
        
      case 'delay_operations':
        this.emit('operationDelayRemoved', { target: action.target });
        break;
    }
  }
  
  /**
   * Restore normal operation (level 0)
   */
  private restoreNormalOperation(): void {
    if (this.currentLevel > 0) {
      this.applyDegradationLevel(0);
    }
  }
}

// Export singleton instance
export const gracefulDegradation = GracefulDegradation.getInstance();