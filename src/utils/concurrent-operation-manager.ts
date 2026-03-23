/**
 * Concurrent operation handling with rate limiting and resource management
 */
import { EventEmitter } from 'events';

interface OperationOptions {
  priority?: number; // Higher number = higher priority
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  tags?: string[];
  abortSignal?: AbortSignal;
}

interface QueuedOperation<T> {
  id: string;
  operation: () => Promise<T>;
  options: OperationOptions;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
  attempts: number;
}

interface OperationStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  avgDuration: number;
  successRate: number;
}

export class ConcurrentOperationManager extends EventEmitter {
  private static instance: ConcurrentOperationManager;
  private queue: QueuedOperation<any>[] = [];
  private running: Map<string, QueuedOperation<any>> = new Map();
  private completed: Array<{ id: string; duration: number; success: boolean }> = [];
  private maxConcurrent: number;
  private rateLimitWindow: number; // ms
  private maxOperationsPerWindow: number;
  private operationTimes: number[] = [];
  private intervalIds: NodeJS.Timeout[] = [];
  
  private constructor(
    maxConcurrent = 5,
    rateLimitWindow = 1000,
    maxOperationsPerWindow = 10
  ) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.rateLimitWindow = rateLimitWindow;
    this.maxOperationsPerWindow = maxOperationsPerWindow;
    
    this.startProcessing();
    this.setupCleanup();
  }
  
  static getInstance(
    maxConcurrent?: number,
    rateLimitWindow?: number,
    maxOperationsPerWindow?: number
  ): ConcurrentOperationManager {
    if (!ConcurrentOperationManager.instance) {
      ConcurrentOperationManager.instance = new ConcurrentOperationManager(
        maxConcurrent,
        rateLimitWindow,
        maxOperationsPerWindow
      );
    }
    return ConcurrentOperationManager.instance;
  }
  
  /**
   * Execute an operation with rate limiting and concurrency control
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: OperationOptions = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const queuedOp: QueuedOperation<T> = {
        id,
        operation,
        options: {
          priority: 0,
          timeout: 30000,
          retries: 3,
          retryDelay: 1000,
          tags: [],
          ...options
        },
        resolve,
        reject,
        timestamp: Date.now(),
        attempts: 0
      };
      
      // Add to queue with priority sorting
      this.addToQueue(queuedOp);
      this.emit('operationQueued', { id, queueSize: this.queue.length });
    });
  }
  
  /**
   * Execute multiple operations concurrently with limits
   */
  async executeAll<T>(
    operations: Array<() => Promise<T>>,
    options: OperationOptions = {}
  ): Promise<T[]> {
    const promises = operations.map(op => this.execute(op, options));
    return Promise.all(promises);
  }
  
  /**
   * Execute operations with different strategies
   */
  async executeWithStrategy<T>(
    operations: Array<() => Promise<T>>,
    strategy: 'all' | 'race' | 'allSettled' = 'all',
    options: OperationOptions = {}
  ): Promise<T[] | T | PromiseSettledResult<T>[]> {
    const promises = operations.map(op => this.execute(op, options));
    
    switch (strategy) {
      case 'race':
        return Promise.race(promises) as Promise<T>;
      case 'allSettled':
        return Promise.allSettled(promises);
      case 'all':
      default:
        return Promise.all(promises);
    }
  }
  
  /**
   * Cancel operations by ID or tags
   */
  cancel(idOrTags: string | string[]): number {
    let cancelled = 0;
    
    if (typeof idOrTags === 'string') {
      // Cancel by ID
      const queueIndex = this.queue.findIndex(op => op.id === idOrTags);
      if (queueIndex !== -1) {
        const op = this.queue.splice(queueIndex, 1)[0];
        op.reject(new Error('Operation cancelled'));
        cancelled++;
      }
      
      const runningOp = this.running.get(idOrTags);
      if (runningOp && runningOp.options.abortSignal) {
        runningOp.options.abortSignal.dispatchEvent(new Event('abort'));
        cancelled++;
      }
    } else {
      // Cancel by tags
      const tags = idOrTags;
      
      // Cancel queued operations
      this.queue = this.queue.filter(op => {
        const hasTag = op.options.tags?.some(tag => tags.includes(tag));
        if (hasTag) {
          op.reject(new Error('Operation cancelled by tag'));
          cancelled++;
          return false;
        }
        return true;
      });
      
      // Cancel running operations
      for (const [id, op] of this.running) {
        const hasTag = op.options.tags?.some(tag => tags.includes(tag));
        if (hasTag && op.options.abortSignal) {
          op.options.abortSignal.dispatchEvent(new Event('abort'));
          cancelled++;
        }
      }
    }
    
    this.emit('operationsCancelled', { count: cancelled });
    return cancelled;
  }
  
  /**
   * Get operation statistics
   */
  getStats(): OperationStats {
    const total = this.completed.length + this.running.size + this.queue.length;
    const successful = this.completed.filter(op => op.success).length;
    const avgDuration = this.completed.length > 0
      ? this.completed.reduce((sum, op) => sum + op.duration, 0) / this.completed.length
      : 0;
    
    return {
      total,
      pending: this.queue.length,
      running: this.running.size,
      completed: this.completed.length,
      failed: this.completed.length - successful,
      avgDuration,
      successRate: this.completed.length > 0 ? (successful / this.completed.length) * 100 : 0
    };
  }
  
  /**
   * Adjust concurrency limits
   */
  setConcurrencyLimits(
    maxConcurrent?: number,
    rateLimitWindow?: number,
    maxOperationsPerWindow?: number
  ): void {
    if (maxConcurrent !== undefined) {
      this.maxConcurrent = maxConcurrent;
    }
    if (rateLimitWindow !== undefined) {
      this.rateLimitWindow = rateLimitWindow;
    }
    if (maxOperationsPerWindow !== undefined) {
      this.maxOperationsPerWindow = maxOperationsPerWindow;
    }
    
    this.emit('limitsChanged', {
      maxConcurrent: this.maxConcurrent,
      rateLimitWindow: this.rateLimitWindow,
      maxOperationsPerWindow: this.maxOperationsPerWindow
    });
  }
  
  /**
   * Get current rate limiting status
   */
  getRateLimitStatus(): {
    currentWindow: number;
    operationsInWindow: number;
    canExecute: boolean;
    nextSlotAvailable: number;
  } {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    // Clean old operation times
    this.operationTimes = this.operationTimes.filter(time => time > windowStart);
    
    const canExecute = this.operationTimes.length < this.maxOperationsPerWindow;
    const nextSlotAvailable = this.operationTimes.length > 0
      ? Math.max(0, this.operationTimes[0] + this.rateLimitWindow - now)
      : 0;
    
    return {
      currentWindow: this.rateLimitWindow,
      operationsInWindow: this.operationTimes.length,
      canExecute,
      nextSlotAvailable
    };
  }
  
  /**
   * Add operation to queue with priority sorting
   */
  private addToQueue<T>(operation: QueuedOperation<T>): void {
    // Insert with priority (higher priority first)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if ((operation.options.priority || 0) > (this.queue[i].options.priority || 0)) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, operation);
  }
  
  /**
   * Shutdown manager and clear all intervals
   */
  shutdown(): void {
    for (const id of this.intervalIds) {
      clearInterval(id);
    }
    this.intervalIds = [];
  }

  /**
   * Start processing operations from queue
   */
  private startProcessing(): void {
    const id = setInterval(() => {
      this.processQueue();
    }, 100);
    id.unref();
    this.intervalIds.push(id);
  }
  
  /**
   * Process operations from queue
   */
  private async processQueue(): Promise<void> {
    // Check if we can execute more operations
    if (this.running.size >= this.maxConcurrent) {
      return;
    }
    
    // Check rate limiting
    const rateLimitStatus = this.getRateLimitStatus();
    if (!rateLimitStatus.canExecute) {
      return;
    }
    
    // Get next operation from queue
    const operation = this.queue.shift();
    if (!operation) {
      return;
    }
    
    // Check if operation has timed out while waiting
    const waitTime = Date.now() - operation.timestamp;
    if (operation.options.timeout && waitTime > operation.options.timeout) {
      operation.reject(new Error('Operation timed out while waiting in queue'));
      return;
    }
    
    // Execute operation
    this.executeOperation(operation);
  }
  
  /**
   * Execute a single operation
   */
  private async executeOperation<T>(operation: QueuedOperation<T>): Promise<void> {
    const startTime = Date.now();
    this.operationTimes.push(startTime);
    this.running.set(operation.id, operation);
    operation.attempts++;
    
    this.emit('operationStarted', {
      id: operation.id,
      attempt: operation.attempts,
      runningCount: this.running.size
    });
    
    try {
      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = operation.options.timeout
        ? new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error(`Operation timed out after ${operation.options.timeout}ms`));
            }, operation.options.timeout);
          })
        : null;
      
      // Execute operation with timeout
      const result = timeoutPromise
        ? await Promise.race([operation.operation(), timeoutPromise])
        : await operation.operation();
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Operation succeeded
      const duration = Date.now() - startTime;
      this.running.delete(operation.id);
      this.completed.push({ id: operation.id, duration, success: true });
      
      operation.resolve(result);
      this.emit('operationCompleted', {
        id: operation.id,
        duration,
        success: true,
        attempts: operation.attempts
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.running.delete(operation.id);
      
      // Check if we should retry
      if (operation.attempts < (operation.options.retries || 0)) {
        // Retry after delay
        setTimeout(() => {
          this.addToQueue(operation);
        }, operation.options.retryDelay || 1000);
        
        this.emit('operationRetry', {
          id: operation.id,
          attempt: operation.attempts,
          error: error.message
        });
      } else {
        // Operation failed permanently
        this.completed.push({ id: operation.id, duration, success: false });
        operation.reject(error);
        
        this.emit('operationFailed', {
          id: operation.id,
          duration,
          attempts: operation.attempts,
          error: error.message
        });
      }
    }
  }
  
  /**
   * Generate unique operation ID
   */
  private generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Setup cleanup and monitoring
   */
  private setupCleanup(): void {
    // Clean completed operations periodically
    const cleanId = setInterval(() => {
      if (this.completed.length > 1000) {
        this.completed = this.completed.slice(-500);
      }
    }, 60000);
    cleanId.unref();
    this.intervalIds.push(cleanId);

    // Monitor for stuck operations
    const monitorId = setInterval(() => {
      const now = Date.now();
      for (const [id, operation] of this.running) {
        const runtime = now - operation.timestamp;
        if (runtime > 300000) { // 5 minutes
          this.emit('operationStuck', {
            id,
            runtime,
            attempts: operation.attempts
          });
        }
      }
    }, 30000);
    monitorId.unref();
    this.intervalIds.push(monitorId);
  }
}

// Export singleton instance
export const concurrentOps = ConcurrentOperationManager.getInstance();