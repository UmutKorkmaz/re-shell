// Circuit breaker: closed -> open -> half-open -> closed.
//
//  closed     calls pass through; `failureThreshold` CONSECUTIVE failures open it.
//  open       calls fail fast with CircuitOpenError until `resetTimeoutMs` has elapsed.
//  half-open  up to `halfOpenMaxCalls` probe calls are let through concurrently;
//             `successThreshold` successes close the circuit, any failure re-opens it.

/** Breaker states. */
export type BreakerState = 'closed' | 'open' | 'half-open';

/** Thrown instead of calling the protected function while the circuit is open. */
export class CircuitOpenError extends Error {
  constructor(readonly breaker: string, readonly retryAfterMs: number) {
    super(`circuit "${breaker}" is open; retry in ${Math.ceil(retryAfterMs)}ms`);
    this.name = 'CircuitOpenError';
  }
}

/** Breaker tuning. */
export interface BreakerOptions {
  /** Name used in errors and events. */
  name?: string;
  /** Consecutive failures that open the circuit (default 5). */
  failureThreshold?: number;
  /** How long to stay open before probing (default 10_000 ms). */
  resetTimeoutMs?: number;
  /** Concurrent probe calls allowed while half-open (default 1). */
  halfOpenMaxCalls?: number;
  /** Successful probes needed to close (default 1). */
  successThreshold?: number;
  /** Which errors count as failures (default: all). */
  isFailure?: (error: unknown) => boolean;
  /** Called on every state transition. */
  onStateChange?: (to: BreakerState, from: BreakerState, breaker: string) => void;
  /** Injectable clock (ms), for tests. */
  now?: () => number;
}

/** A circuit breaker guarding one dependency. */
export class CircuitBreaker {
  readonly name: string;
  private state: BreakerState = 'closed';
  private failures = 0;
  private successes = 0;
  private inFlightProbes = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly successThreshold: number;
  private readonly isFailure: (error: unknown) => boolean;
  private readonly onStateChange?: BreakerOptions['onStateChange'];
  private readonly now: () => number;

  constructor(options: BreakerOptions = {}) {
    this.name = options.name ?? 'breaker';
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10_000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1;
    this.successThreshold = options.successThreshold ?? 1;
    this.isFailure = options.isFailure ?? (() => true);
    this.onStateChange = options.onStateChange;
    this.now = options.now ?? Date.now;
    if (this.failureThreshold < 1 || this.successThreshold < 1 || this.halfOpenMaxCalls < 1) {
      throw new Error('breaker thresholds must be >= 1');
    }
  }

  /** Current state (an expired open circuit reports `half-open`). */
  get currentState(): BreakerState {
    this.maybeHalfOpen();
    return this.state;
  }

  /** Consecutive failures seen while closed. */
  get consecutiveFailures(): number {
    return this.failures;
  }

  private transition(to: BreakerState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    if (to === 'open') this.openedAt = this.now();
    if (to === 'closed') this.failures = 0;
    if (to !== 'half-open') this.successes = 0;
    if (to === 'half-open') {
      this.successes = 0;
      this.inFlightProbes = 0;
    }
    this.onStateChange?.(to, from, this.name);
  }

  private maybeHalfOpen(): void {
    if (this.state === 'open' && this.now() - this.openedAt >= this.resetTimeoutMs) this.transition('half-open');
  }

  /**
   * Run `fn` through the breaker.
   * @throws CircuitOpenError when open (or when half-open and the probe slots are taken).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeHalfOpen();
    if (this.state === 'open') {
      throw new CircuitOpenError(this.name, this.resetTimeoutMs - (this.now() - this.openedAt));
    }
    let probe = false;
    if (this.state === 'half-open') {
      if (this.inFlightProbes >= this.halfOpenMaxCalls) throw new CircuitOpenError(this.name, 0);
      this.inFlightProbes++;
      probe = true;
    }
    try {
      const result = await fn();
      this.recordSuccess(probe);
      return result;
    } catch (error) {
      this.recordFailure(probe, error);
      throw error;
    }
  }

  private recordSuccess(probe: boolean): void {
    if (probe) this.inFlightProbes = Math.max(0, this.inFlightProbes - 1);
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.successThreshold) this.transition('closed');
    } else if (this.state === 'closed') {
      this.failures = 0;
    }
  }

  private recordFailure(probe: boolean, error: unknown): void {
    if (probe) this.inFlightProbes = Math.max(0, this.inFlightProbes - 1);
    if (!this.isFailure(error)) {
      // not a dependency failure: treat like a success for state purposes
      if (this.state === 'closed') this.failures = 0;
      return;
    }
    if (this.state === 'half-open') {
      this.transition('open');
    } else if (this.state === 'closed') {
      this.failures++;
      if (this.failures >= this.failureThreshold) this.transition('open');
    }
  }

  /** Force the circuit closed (e.g. after a manual fix). */
  reset(): void {
    this.transition('closed');
  }
}
