/**
 * Parallel Execution Orchestrator — Safe Concurrent Task Execution
 *
 * Enables parallel execution of independent tasks while maintaining
 * correctness through dependency tracking and synchronization.
 *
 * Features:
 * - Automatic dependency resolution
 * - Parallel execution of independent tasks
 * - Sequential execution when dependencies require it
 * - Progress tracking
 * - Error isolation (one failure doesn't stop others)
 * - Timeout support
 * - Cancellation support
 *
 * Use Cases:
 * - Generate multiple components simultaneously
 * - Build frontend and backend in parallel
 * - Run multiple validations concurrently
 * - Process multiple files simultaneously
 */

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMED_OUT = "timed_out",
}

export interface ParallelTask<T = unknown> {
  /** Task ID */
  id: string;
  /** Task description */
  description: string;
  /** Task execution function */
  execute: () => Promise<T>;
  /** Dependencies (task IDs that must complete first) */
  dependencies: string[];
  /** Current status */
  status: TaskStatus;
  /** Task result */
  result?: T;
  /** Error if failed */
  error?: Error;
  /** Execution time in ms */
  duration?: number;
  /** Whether task is critical (failure stops all) */
  critical: boolean;
  /** Timeout in ms (0 = no timeout) */
  timeoutMs: number;
  /** Retry count */
  retries: number;
  /** Maximum retries */
  maxRetries: number;
}

export interface ExecutionPlan {
  /** All tasks */
  tasks: ParallelTask[];
  /** Tasks organized by execution phase */
  phases: string[][];
  /** Whether plan is valid (no circular dependencies) */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
}

export interface ParallelExecutionResult {
  /** Whether all tasks completed successfully */
  success: boolean;
  /** Total execution time */
  duration: number;
  /** Tasks completed */
  completed: number;
  /** Tasks failed */
  failed: number;
  /** Tasks cancelled */
  cancelled: number;
  /** Results by task ID */
  results: Map<string, ParallelTask>;
}

export interface ParallelOptions {
  /** Maximum concurrent tasks (default: unlimited) */
  maxConcurrency?: number;
  /** Whether to stop on first critical failure */
  stopOnCriticalFailure?: boolean;
  /** Default timeout for all tasks (ms) */
  defaultTimeoutMs?: number;
  /** Default retries for all tasks */
  defaultRetries?: number;
}

/**
 * Parallel Execution Orchestrator
 */
export class ParallelOrchestrator {
  private options: Required<ParallelOptions>;

  constructor(options: ParallelOptions = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency ?? Infinity,
      stopOnCriticalFailure: options.stopOnCriticalFailure ?? true,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 0,
      defaultRetries: options.defaultRetries ?? 0,
    };
  }

  /**
   * Create execution plan with dependency resolution
   */
  createPlan(tasks: ParallelTask[]): ExecutionPlan {
    // Validate no circular dependencies
    const isValid = this.validateDependencies(tasks);

    if (!isValid.valid) {
      return {
        tasks,
        phases: [],
        isValid: false,
        error: isValid.error,
      };
    }

    // Build execution phases using topological sort
    const phases = this.buildPhases(tasks);

    return {
      tasks,
      phases,
      isValid: true,
    };
  }

  /**
   * Execute tasks in parallel according to plan
   */
  async execute(
    tasks: ParallelTask[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();

    // Create execution plan
    const plan = this.createPlan(tasks);

    if (!plan.isValid) {
      throw new Error(`Invalid execution plan: ${plan.error}`);
    }

    const results = new Map<string, ParallelTask>();
    let completedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;

    // Execute each phase sequentially
    for (const phase of plan.phases) {
      // Execute tasks in this phase in parallel
      const phasePromises = phase.map(async (taskId) => {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        // Check if dependencies are met
        const depsMet = task.dependencies.every((depId) => {
          const depTask = results.get(depId);
          return depTask && depTask.status === TaskStatus.COMPLETED;
        });

        if (!depsMet) {
          task.status = TaskStatus.CANCELLED;
          cancelledCount++;
          results.set(task.id, task);
          return;
        }

        // Execute task
        await this.executeTask(task);
        results.set(task.id, task);

        if (task.status === TaskStatus.COMPLETED) {
          completedCount++;
        } else if (task.status === TaskStatus.FAILED) {
          failedCount++;

          // Stop on critical failure
          if (task.critical && this.options.stopOnCriticalFailure) {
            // Cancel remaining tasks
            for (const remaining of tasks) {
              if (remaining.status === TaskStatus.PENDING) {
                remaining.status = TaskStatus.CANCELLED;
                cancelledCount++;
                results.set(remaining.id, remaining);
              }
            }
          }
        }

        // Report progress
        if (onProgress) {
          onProgress(completedCount + failedCount + cancelledCount, tasks.length);
        }
      });

      // Wait for all tasks in phase to complete
      await Promise.all(phasePromises);

      // Check if we should stop
      if (failedCount > 0 && this.options.stopOnCriticalFailure) {
        break;
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: failedCount === 0,
      duration,
      completed: completedCount,
      failed: failedCount,
      cancelled: cancelledCount,
      results,
    };
  }

  /**
   * Execute a single task with timeout and retry
   */
  private async executeTask(task: ParallelTask): Promise<void> {
    task.status = TaskStatus.RUNNING;
    const taskStart = Date.now();

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(task);

      task.result = result;
      task.status = TaskStatus.COMPLETED;
      task.duration = Date.now() - taskStart;
    } catch (error) {
      task.error = error instanceof Error ? error : new Error(String(error));
      task.duration = Date.now() - taskStart;

      // Retry if retries remaining
      if (task.retries < task.maxRetries) {
        task.retries++;
        await this.executeTask(task);
      } else {
        task.status = TaskStatus.FAILED;
      }
    }
  }

  /**
   * Execute task with timeout
   */
  private async executeWithTimeout(task: ParallelTask): Promise<unknown> {
    if (task.timeoutMs === 0 && this.options.defaultTimeoutMs === 0) {
      return task.execute();
    }

    const timeout = task.timeoutMs || this.options.defaultTimeoutMs;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeout}ms`));
        task.status = TaskStatus.TIMED_OUT;
      }, timeout);

      task
        .execute()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Validate dependencies (no circular dependencies)
   */
  private validateDependencies(tasks: ParallelTask[]): {
    valid: boolean;
    error?: string;
  } {
    const taskIds = new Set(tasks.map((t) => t.id));

    // Check all dependencies exist
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          return {
            valid: false,
            error: `Task ${task.id} depends on non-existent task ${depId}`,
          };
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const task of tasks) {
      if (this.hasCycle(task.id, tasks, visited, recursionStack)) {
        return {
          valid: false,
          error: `Circular dependency detected involving task ${task.id}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Detect cycle using DFS
   */
  private hasCycle(
    taskId: string,
    tasks: ParallelTask[],
    visited: Set<string>,
    recursionStack: Set<string>,
  ): boolean {
    if (recursionStack.has(taskId)) {
      return true;
    }

    if (visited.has(taskId)) {
      return false;
    }

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      for (const depId of task.dependencies) {
        if (this.hasCycle(depId, tasks, visited, recursionStack)) {
          return true;
        }
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  /**
   * Build execution phases using topological sort
   */
  private buildPhases(tasks: ParallelTask[]): string[][] {
    const phases: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(tasks.map((t) => t.id));

    while (remaining.size > 0) {
      // Find tasks with all dependencies met
      const ready: string[] = [];

      for (const taskId of remaining) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) continue;

        const depsMet = task.dependencies.every((depId) =>
          completed.has(depId),
        );

        if (depsMet) {
          ready.push(taskId);
        }
      }

      // If no tasks ready, there's a dependency issue
      if (ready.length === 0) {
        break;
      }

      // Add ready tasks to current phase
      phases.push(ready);

      // Mark as completed
      for (const taskId of ready) {
        completed.add(taskId);
        remaining.delete(taskId);
      }
    }

    return phases;
  }
}

/**
 * Convenience function for simple parallel execution
 */
export async function executeInParallel<T>(
  tasks: Array<{
    id: string;
    description: string;
    execute: () => Promise<T>;
    critical?: boolean;
    timeoutMs?: number;
  }>,
  options?: ParallelOptions,
): Promise<ParallelExecutionResult> {
  const orchestrator = new ParallelOrchestrator(options);

  const parallelTasks: ParallelTask<T>[] = tasks.map((task) => ({
    id: task.id,
    description: task.description,
    execute: task.execute,
    dependencies: [],
    status: TaskStatus.PENDING,
    critical: task.critical ?? false,
    timeoutMs: task.timeoutMs ?? 0,
    retries: 0,
    maxRetries: options?.defaultRetries ?? 0,
  }));

  return orchestrator.execute(parallelTasks);
}

/**
 * Convenience function for sequential execution
 */
export async function executeSequentially<T>(
  tasks: Array<{
    id: string;
    description: string;
    execute: () => Promise<T>;
    critical?: boolean;
  }>,
): Promise<ParallelExecutionResult> {
  const orchestrator = new ParallelOrchestrator({ maxConcurrency: 1 });

  const sequentialTasks: ParallelTask<T>[] = tasks.map((task, index) => ({
    id: task.id,
    description: task.description,
    execute: task.execute,
    dependencies: index > 0 ? [tasks[index - 1].id] : [],
    status: TaskStatus.PENDING,
    critical: task.critical ?? false,
    timeoutMs: 0,
    retries: 0,
    maxRetries: 0,
  }));

  return orchestrator.execute(sequentialTasks);
}
