import { EventEmitter } from 'events';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  timeout?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  volumeThreshold: number;
  errorThresholdPercentage: number;
  onStateChange?: (state: CircuitState) => void;
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  lastAttemptDuration: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  failureRate: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}

export class RetryExecutor extends EventEmitter {
  private defaultOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    timeout: 60000
  };

  constructor(private options: Partial<RetryOptions> = {}) {
    super();
    this.options = { ...this.defaultOptions, ...options };
  }

  async execute<T>(
    operation: () => Promise<T>,
    customOptions?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> {
    const opts = { ...this.defaultOptions, ...this.options, ...customOptions };
    const startTime = Date.now();
    let lastError: Error | undefined;
    let lastAttemptDuration = 0;

    for (let attempt = 1; attempt <= opts.maxAttempts!; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        this.emit('attempt:start', { attempt, operation: operation.name });

        let result: T;
        if (opts.timeout) {
          result = await this.withTimeout(operation(), opts.timeout);
        } else {
          result = await operation();
        }

        lastAttemptDuration = Date.now() - attemptStartTime;
        const totalDuration = Date.now() - startTime;

        this.emit('attempt:success', { 
          attempt, 
          duration: lastAttemptDuration,
          totalDuration 
        });

        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration,
          lastAttemptDuration
        };

      } catch (error: any) {
        lastError = error;
        lastAttemptDuration = Date.now() - attemptStartTime;

        this.emit('attempt:failure', { 
          attempt, 
          error, 
          duration: lastAttemptDuration 
        });

        // Check if we should retry
        if (attempt === opts.maxAttempts || 
            (opts.retryCondition && !opts.retryCondition(error))) {
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, opts);
        
        if (opts.onRetry) {
          opts.onRetry(attempt, error, delay);
        }

        this.emit('retry:delay', { attempt, delay, error });

        // Wait before retry
        await this.sleep(delay);
      }
    }

    const totalDuration = Date.now() - startTime;

    this.emit('retry:exhausted', { 
      attempts: opts.maxAttempts, 
      error: lastError,
      totalDuration 
    });

    return {
      success: false,
      error: lastError,
      attempts: opts.maxAttempts!,
      totalDuration,
      lastAttemptDuration
    };
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const exponentialDelay = options.baseDelay! * Math.pow(options.backoffMultiplier!, attempt - 1);
    let delay = Math.min(exponentialDelay, options.maxDelay!);

    // Add jitter to prevent thundering herd
    if (options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Static convenience methods
  static async withRetry<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const executor = new RetryExecutor(options);
    const result = await executor.execute(operation);
    
    if (result.success) {
      return result.result!;
    } else {
      throw result.error;
    }
  }

  static isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP errors (5xx)
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limiting
    if (error.response && error.response.status === 429) {
      return true;
    }

    return false;
  }
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextRetryTime?: Date;
  private stats: Map<string, number> = new Map();

  private defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    monitoringPeriod: 60000,
    volumeThreshold: 10,
    errorThresholdPercentage: 50
  };

  constructor(
    private name: string,
    private options: Partial<CircuitBreakerOptions> = {}
  ) {
    super();
    this.options = { ...this.defaultOptions, ...options };
    this.startMonitoring();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.setState(CircuitState.HALF_OPEN);
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN. Next retry at ${this.nextRetryTime}`);
      }
    }

    this.totalCalls++;
    const startTime = Date.now();

    try {
      const result = await operation();
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error, Date.now() - startTime);
      throw error;
    }
  }

  private onSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.CLOSED);
      this.failureCount = 0;
    }

    this.emit('success', { 
      duration, 
      state: this.state,
      successCount: this.successCount 
    });
  }

  private onFailure(error: any, duration: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    this.emit('failure', { 
      error, 
      duration, 
      state: this.state,
      failureCount: this.failureCount 
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN);
      this.setNextRetryTime();
    } else if (this.shouldTrip()) {
      this.setState(CircuitState.OPEN);
      this.setNextRetryTime();
    }
  }

  private shouldTrip(): boolean {
    if (this.totalCalls < this.options.volumeThreshold!) {
      return false;
    }

    const failureRate = (this.failureCount / this.totalCalls) * 100;
    return failureRate >= this.options.errorThresholdPercentage!;
  }

  private shouldAttemptReset(): boolean {
    return this.nextRetryTime ? new Date() >= this.nextRetryTime : false;
  }

  private setNextRetryTime(): void {
    this.nextRetryTime = new Date(Date.now() + this.options.recoveryTimeout!);
  }

  private setState(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    this.emit('state:change', { 
      from: oldState, 
      to: newState, 
      timestamp: new Date() 
    });

    if (this.options.onStateChange) {
      this.options.onStateChange(newState);
    }
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.resetCounters();
      this.emit('monitoring:reset', this.getStats());
    }, this.options.monitoringPeriod!);
  }

  private resetCounters(): void {
    // Reset counters for monitoring period
    if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.totalCalls = 0;
    }
  }

  getStats(): CircuitBreakerStats {
    const failureRate = this.totalCalls > 0 ? 
      (this.failureCount / this.totalCalls) * 100 : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      failureRate,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime
    };
  }

  reset(): void {
    this.setState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.totalCalls = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextRetryTime = undefined;
    
    this.emit('reset', { timestamp: new Date() });
  }

  forceOpen(): void {
    this.setState(CircuitState.OPEN);
    this.setNextRetryTime();
    this.emit('force:open', { timestamp: new Date() });
  }

  forceClose(): void {
    this.setState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.nextRetryTime = undefined;
    this.emit('force:close', { timestamp: new Date() });
  }

  getName(): string {
    return this.name;
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }
}

export class RetryManager extends EventEmitter {
  private retryExecutors: Map<string, RetryExecutor> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  createRetryExecutor(name: string, options?: Partial<RetryOptions>): RetryExecutor {
    const executor = new RetryExecutor(options);
    this.retryExecutors.set(name, executor);
    
    executor.on('attempt:start', (data) => this.emit('executor:attempt:start', { name, ...data }));
    executor.on('attempt:success', (data) => this.emit('executor:attempt:success', { name, ...data }));
    executor.on('attempt:failure', (data) => this.emit('executor:attempt:failure', { name, ...data }));
    executor.on('retry:exhausted', (data) => this.emit('executor:retry:exhausted', { name, ...data }));

    return executor;
  }

  createCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    const breaker = new CircuitBreaker(name, options);
    this.circuitBreakers.set(name, breaker);
    
    breaker.on('success', (data) => this.emit('breaker:success', { name, ...data }));
    breaker.on('failure', (data) => this.emit('breaker:failure', { name, ...data }));
    breaker.on('state:change', (data) => this.emit('breaker:state:change', { name, ...data }));

    return breaker;
  }

  async executeWithRetryAndCircuitBreaker<T>(
    name: string,
    operation: () => Promise<T>,
    retryOptions?: Partial<RetryOptions>,
    circuitOptions?: Partial<CircuitBreakerOptions>
  ): Promise<T> {
    let executor = this.retryExecutors.get(name);
    if (!executor) {
      executor = this.createRetryExecutor(name, retryOptions);
    }

    let breaker = this.circuitBreakers.get(name);
    if (!breaker) {
      breaker = this.createCircuitBreaker(name, circuitOptions);
    }

    const result = await executor.execute(() => breaker!.execute(operation));
    return result.result;
  }

  getRetryExecutor(name: string): RetryExecutor | undefined {
    return this.retryExecutors.get(name);
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  getAllCircuitBreakers(): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values());
  }

  getAllRetryExecutors(): RetryExecutor[] {
    return Array.from(this.retryExecutors.values());
  }

  getCircuitBreakerStats(): Array<{ name: string; stats: CircuitBreakerStats }> {
    return Array.from(this.circuitBreakers.entries()).map(([name, breaker]) => ({
      name,
      stats: breaker.getStats()
    }));
  }

  resetAllCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
    this.emit('reset:all');
  }

  getHealthStatus(): {
    healthy: boolean;
    openCircuits: string[];
    totalCircuits: number;
    failedOperations: string[];
  } {
    const openCircuits: string[] = [];
    const failedOperations: string[] = [];

    for (const [name, breaker] of this.circuitBreakers) {
      if (breaker.isOpen()) {
        openCircuits.push(name);
      }
      
      const stats = breaker.getStats();
      if (stats.failureRate > 25) { // 25% failure rate threshold
        failedOperations.push(name);
      }
    }

    return {
      healthy: openCircuits.length === 0,
      openCircuits,
      totalCircuits: this.circuitBreakers.size,
      failedOperations
    };
  }

  // Convenience methods for common retry patterns
  async retryNetworkOperation<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const defaultNetworkOptions: Partial<RetryOptions> = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      retryCondition: RetryExecutor.isRetryableError
    };

    return RetryExecutor.withRetry(operation, { ...defaultNetworkOptions, ...options });
  }

  async retryFileOperation<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const defaultFileOptions: Partial<RetryOptions> = {
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 5000,
      retryCondition: (error) => {
        return error.code === 'EBUSY' || 
               error.code === 'EMFILE' || 
               error.code === 'ENFILE' ||
               error.code === 'EAGAIN';
      }
    };

    return RetryExecutor.withRetry(operation, { ...defaultFileOptions, ...options });
  }

  async retryDatabaseOperation<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const defaultDbOptions: Partial<RetryOptions> = {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 20000,
      retryCondition: (error) => {
        return error.code === 'ECONNRESET' || 
               error.code === 'ECONNREFUSED' ||
               error.message?.includes('timeout') ||
               error.message?.includes('deadlock');
      }
    };

    return RetryExecutor.withRetry(operation, { ...defaultDbOptions, ...options });
  }
}

// Global retry manager
let globalRetryManager: RetryManager | null = null;

export function createRetryManager(): RetryManager {
  return new RetryManager();
}

export function getGlobalRetryManager(): RetryManager {
  if (!globalRetryManager) {
    globalRetryManager = new RetryManager();
  }
  return globalRetryManager;
}

export function setGlobalRetryManager(manager: RetryManager): void {
  globalRetryManager = manager;
}