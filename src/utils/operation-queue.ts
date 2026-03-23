/**
 * Operation queue management with priority scheduling
 */
import { EventEmitter } from 'events';

export interface QueuedTask<T = any> {
  id: string;
  name: string;
  priority: number;
  operation: () => Promise<T>;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  metadata?: Record<string, any>;
  createdAt: number;
  scheduledAt?: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface QueueStats {
  total: number;
  pending: number;
  scheduled: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  throughput: number; // tasks per minute
}

export class OperationQueue extends EventEmitter {
  private static instance: OperationQueue;
  private tasks: Map<string, QueuedTask> = new Map();
  private runningTasks: Map<string, QueuedTask> = new Map();
  private completedTasks: QueuedTask[] = [];
  private maxConcurrent: number;
  private processing = false;
  private processingInterval?: NodeJS.Timeout;
  
  // Priority levels
  static readonly PRIORITY = {
    CRITICAL: 100,
    HIGH: 75,
    NORMAL: 50,
    LOW: 25,
    BACKGROUND: 0
  } as const;
  
  private constructor(maxConcurrent = 3) {
    super();
    this.maxConcurrent = maxConcurrent;
  }
  
  static getInstance(maxConcurrent?: number): OperationQueue {
    if (!OperationQueue.instance) {
      OperationQueue.instance = new OperationQueue(maxConcurrent);
    }
    return OperationQueue.instance;
  }
  
  /**
   * Add a task to the queue
   */
  add<T>(
    name: string,
    operation: () => Promise<T>,
    options: {
      priority?: number;
      dependencies?: string[];
      timeout?: number;
      retries?: number;
      retryDelay?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    const id = this.generateId();
    const task: QueuedTask<T> = {
      id,
      name,
      priority: options.priority || OperationQueue.PRIORITY.NORMAL,
      operation,
      dependencies: options.dependencies || [],
      timeout: options.timeout || 30000,
      retries: options.retries || 2,
      retryDelay: options.retryDelay || 1000,
      metadata: options.metadata || {},
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending'
    };
    
    this.tasks.set(id, task);
    this.emit('taskAdded', { id, name, priority: task.priority });
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
    
    return id;
  }
  
  /**
   * Add multiple related tasks as a batch
   */
  addBatch<T>(
    tasks: Array<{
      name: string;
      operation: () => Promise<T>;
      priority?: number;
      dependencies?: string[];
      timeout?: number;
      retries?: number;
      metadata?: Record<string, any>;
    }>
  ): string[] {
    const ids: string[] = [];
    
    for (const task of tasks) {
      const id = this.add(task.name, task.operation, {
        priority: task.priority,
        dependencies: task.dependencies,
        timeout: task.timeout,
        retries: task.retries,
        metadata: task.metadata
      });
      ids.push(id);
    }
    
    this.emit('batchAdded', { ids, count: tasks.length });
    return ids;
  }
  
  /**
   * Cancel a task
   */
  cancel(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    if (task.status === 'running') {
      // Can't cancel running tasks directly, but mark for cancellation
      task.status = 'cancelled';
      this.emit('taskCancelled', { id, name: task.name });
      return true;
    }
    
    if (task.status === 'pending' || task.status === 'scheduled') {
      task.status = 'cancelled';
      this.tasks.delete(id);
      this.emit('taskCancelled', { id, name: task.name });
      return true;
    }
    
    return false;
  }
  
  /**
   * Cancel all tasks with specific priority or lower
   */
  cancelByPriority(maxPriority: number): number {
    let cancelled = 0;
    
    for (const [id, task] of this.tasks) {
      if (task.priority <= maxPriority && 
          (task.status === 'pending' || task.status === 'scheduled')) {
        if (this.cancel(id)) {
          cancelled++;
        }
      }
    }
    
    return cancelled;
  }
  
  /**
   * Get task by ID
   */
  getTask(id: string): QueuedTask | undefined {
    return this.tasks.get(id) || this.runningTasks.get(id) || 
           this.completedTasks.find(t => t.id === id);
  }
  
  /**
   * Get all tasks by status
   */
  getTasksByStatus(status: QueuedTask['status']): QueuedTask[] {
    const allTasks = [
      ...Array.from(this.tasks.values()),
      ...Array.from(this.runningTasks.values()),
      ...this.completedTasks
    ];
    
    return allTasks.filter(task => task.status === status);
  }
  
  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const allTasks = [
      ...Array.from(this.tasks.values()),
      ...Array.from(this.runningTasks.values()),
      ...this.completedTasks
    ];
    
    const total = allTasks.length;
    const pending = allTasks.filter(t => t.status === 'pending').length;
    const scheduled = allTasks.filter(t => t.status === 'scheduled').length;
    const running = allTasks.filter(t => t.status === 'running').length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const failed = allTasks.filter(t => t.status === 'failed').length;
    const cancelled = allTasks.filter(t => t.status === 'cancelled').length;
    
    // Calculate average wait time (from created to started)
    const waitTimes = allTasks
      .filter(t => t.startedAt)
      .map(t => t.startedAt! - t.createdAt);
    const averageWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
      : 0;
    
    // Calculate average execution time
    const execTimes = allTasks
      .filter(t => t.completedAt && t.startedAt)
      .map(t => t.completedAt! - t.startedAt!);
    const averageExecutionTime = execTimes.length > 0
      ? execTimes.reduce((sum, time) => sum + time, 0) / execTimes.length
      : 0;
    
    // Calculate throughput (completed tasks per minute)
    const now = Date.now();
    const recentlyCompleted = allTasks.filter(t => 
      t.status === 'completed' && 
      t.completedAt && 
      (now - t.completedAt) < 60000
    ).length;
    
    return {
      total,
      pending,
      scheduled,
      running,
      completed,
      failed,
      cancelled,
      averageWaitTime,
      averageExecutionTime,
      throughput: recentlyCompleted
    };
  }
  
  /**
   * Wait for all tasks to complete
   */
  async waitForCompletion(timeout?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const check = () => {
        const stats = this.getStats();
        if (stats.pending + stats.scheduled + stats.running === 0) {
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        setTimeout(check, 100);
      };

      if (timeout) {
        timeoutId = setTimeout(() => reject(new Error('Timeout waiting for queue completion')), timeout);
      }

      check();
    });
  }
  
  /**
   * Clear completed tasks from memory
   */
  clearCompleted(): number {
    const count = this.completedTasks.length;
    this.completedTasks = [];
    this.emit('completedTasksCleared', { count });
    return count;
  }
  
  /**
   * Start processing queue
   */
  private startProcessing(): void {
    if (this.processing) return;
    
    this.processing = true;
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 100);
    
    this.emit('processingStarted');
  }
  
  /**
   * Stop processing queue
   */
  private stopProcessing(): void {
    this.processing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    this.emit('processingStopped');
  }
  
  /**
   * Process tasks from queue
   */
  private async processQueue(): Promise<void> {
    // Check if we can run more tasks
    if (this.runningTasks.size >= this.maxConcurrent) {
      return;
    }
    
    // Get next executable task
    const nextTask = this.getNextExecutableTask();
    if (!nextTask) {
      // No executable tasks - stop processing if queue is empty
      if (this.tasks.size === 0 && this.runningTasks.size === 0) {
        this.stopProcessing();
      }
      return;
    }
    
    // Move task to running
    this.tasks.delete(nextTask.id);
    this.runningTasks.set(nextTask.id, nextTask);
    nextTask.status = 'running';
    nextTask.startedAt = Date.now();
    nextTask.attempts++;
    
    this.emit('taskStarted', {
      id: nextTask.id,
      name: nextTask.name,
      attempt: nextTask.attempts
    });
    
    // Execute task
    this.executeTask(nextTask);
  }
  
  /**
   * Get next executable task considering priority and dependencies
   */
  private getNextExecutableTask(): QueuedTask | null {
    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'pending');
    
    if (pendingTasks.length === 0) return null;
    
    // Filter tasks that have all dependencies completed
    const executableTasks = pendingTasks.filter(task => 
      this.areDependenciesCompleted(task.dependencies || [])
    );
    
    if (executableTasks.length === 0) return null;
    
    // Sort by priority (highest first), then by creation time (oldest first)
    executableTasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });
    
    return executableTasks[0];
  }
  
  /**
   * Check if all dependencies are completed
   */
  private areDependenciesCompleted(dependencies: string[]): boolean {
    for (const depId of dependencies) {
      const depTask = this.getTask(depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Execute a single task
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Task "${task.name}" timed out after ${task.timeout}ms`));
        }, task.timeout);
      });

      // Execute with timeout
      const result = await Promise.race([task.operation(), timeoutPromise]);
      clearTimeout(timeoutId);

      // Task completed successfully
      task.status = 'completed';
      task.completedAt = Date.now();

      this.runningTasks.delete(task.id);
      this.completedTasks.push(task);

      this.emit('taskCompleted', {
        id: task.id,
        name: task.name,
        duration: task.completedAt - task.startedAt!,
        attempts: task.attempts
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      // Task failed
      const duration = Date.now() - task.startedAt!;
      
      // Check if we should retry
      if (task.attempts < (task.retries || 0)) {
        // Retry the task
        task.status = 'pending';
        this.runningTasks.delete(task.id);
        
        setTimeout(() => {
          this.tasks.set(task.id, task);
        }, task.retryDelay || 1000);
        
        this.emit('taskRetry', {
          id: task.id,
          name: task.name,
          attempt: task.attempts,
          error: error.message
        });
      } else {
        // Task failed permanently
        task.status = 'failed';
        task.completedAt = Date.now();
        
        this.runningTasks.delete(task.id);
        this.completedTasks.push(task);
        
        this.emit('taskFailed', {
          id: task.id,
          name: task.name,
          duration,
          attempts: task.attempts,
          error: error.message
        });
      }
    }
  }
  
  /**
   * Generate unique task ID
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const operationQueue = OperationQueue.getInstance();