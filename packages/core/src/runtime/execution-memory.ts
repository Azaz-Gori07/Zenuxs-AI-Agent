/**
 * Execution Memory System — Session Persistence & Resume
 *
 * Tracks execution state across session interruptions:
 * - Current task and goal
 * - Completed tasks
 * - Pending tasks
 * - Modified files
 * - Tool execution history
 * - Validation results
 * - Repair attempts
 *
 * Enables automatic resume after interruption without restarting entire task.
 *
 * Inspired by OpenCode's durable execution pattern, but uses localStorage/filesystem
 * persistence for simplicity and cross-platform compatibility.
 */

import * as fs from "fs";
import * as path from "path";

export interface ExecutionTask {
  /** Unique task identifier */
  id: string;
  /** Task description */
  description: string;
  /** Task status */
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  /** Dependencies (task IDs that must complete first) */
  dependencies: string[];
  /** Tools required for this task */
  requiredTools: string[];
  /** Validation criteria */
  validationCriteria: string[];
  /** Result output (if completed) */
  result?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Time started */
  startedAt?: Date;
  /** Time completed */
  completedAt?: Date;
}

export interface ExecutionMemory {
  /** Session ID */
  sessionId: string;
  /** Current goal/request */
  goal: string;
  /** Execution state */
  state: "idle" | "planning" | "executing" | "validating" | "repairing" | "completed" | "interrupted";
  /** All tasks in execution plan */
  tasks: ExecutionTask[];
  /** Files created during execution */
  filesCreated: string[];
  /** Files modified during execution */
  filesModified: string[];
  /** Files deleted during execution */
  filesDeleted: string[];
  /** Commands executed */
  commandsExecuted: string[];
  /** Dependencies installed */
  dependenciesInstalled: string[];
  /** Tool execution history */
  toolHistory: {
    toolName: string;
    input: unknown;
    status: "success" | "error";
    timestamp: Date;
  }[];
  /** Validation results */
  validationResults: {
    type: "build" | "lint" | "test" | "typecheck";
    success: boolean;
    errors?: string[];
    timestamp: Date;
  }[];
  /** Repair attempts */
  repairAttempts: {
    taskId: string;
    error: string;
    fix: string;
    success: boolean;
    timestamp: Date;
  }[];
  /** Current task being executed */
  currentTaskId?: string;
  /** Last saved timestamp */
  lastSaved: Date;
  /** Interruption timestamp (if interrupted) */
  interruptedAt?: Date;
}

/**
 * Create new execution memory
 */
export function createExecutionMemory(sessionId: string, goal: string): ExecutionMemory {
  return {
    sessionId,
    goal,
    state: "planning",
    tasks: [],
    filesCreated: [],
    filesModified: [],
    filesDeleted: [],
    commandsExecuted: [],
    dependenciesInstalled: [],
    toolHistory: [],
    validationResults: [],
    repairAttempts: [],
    lastSaved: new Date(),
  };
}

/**
 * Execution memory manager with persistence
 */
export class ExecutionMemoryManager {
  private memory: ExecutionMemory | null = null;
  private persistencePath: string | null = null;

  /**
   * Initialize execution memory
   */
  initialize(sessionId: string, goal: string): void {
    this.memory = createExecutionMemory(sessionId, goal);
  }

  /**
   * Load execution memory from persistence
   */
  loadFromFile(filePath: string): ExecutionMemory | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const memory = JSON.parse(content) as ExecutionMemory;

      // Deserialize dates
      memory.lastSaved = new Date(memory.lastSaved);
      if (memory.interruptedAt) {
        memory.interruptedAt = new Date(memory.interruptedAt);
      }
      for (const task of memory.tasks) {
        if (task.startedAt) task.startedAt = new Date(task.startedAt);
        if (task.completedAt) task.completedAt = new Date(task.completedAt);
      }
      for (const entry of memory.toolHistory) {
        entry.timestamp = new Date(entry.timestamp);
      }
      for (const result of memory.validationResults) {
        result.timestamp = new Date(result.timestamp);
      }
      for (const attempt of memory.repairAttempts) {
        attempt.timestamp = new Date(attempt.timestamp);
      }

      this.memory = memory;
      this.persistencePath = filePath;

      return memory;
    } catch (error) {
      console.error(`[ExecutionMemory] Failed to load from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Save execution memory to file
   */
  saveToFile(filePath?: string): boolean {
    if (!this.memory) {
      return false;
    }

    const savePath = filePath || this.persistencePath;
    if (!savePath) {
      return false;
    }

    try {
      this.memory.lastSaved = new Date();

      // Ensure directory exists
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(savePath, JSON.stringify(this.memory, null, 2), "utf-8");
      this.persistencePath = savePath;

      return true;
    } catch (error) {
      console.error(`[ExecutionMemory] Failed to save to ${savePath}:`, error);
      return false;
    }
  }

  /**
   * Get current execution memory
   */
  getMemory(): ExecutionMemory | null {
    return this.memory;
  }

  /**
   * Update execution state
   */
  setState(state: ExecutionMemory["state"]): void {
    if (!this.memory) return;
    this.memory.state = state;
  }

  /**
   * Add task to execution plan
   */
  addTask(task: Omit<ExecutionTask, "id" | "status" | "retryCount">): string {
    if (!this.memory) {
      throw new Error("Execution memory not initialized");
    }

    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullTask: ExecutionTask = {
      ...task,
      id,
      status: "pending",
      retryCount: 0,
    };

    this.memory.tasks.push(fullTask);
    return id;
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: ExecutionTask["status"], result?: unknown, error?: string): void {
    if (!this.memory) return;

    const task = this.memory.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.status = status;
    if (result !== undefined) task.result = result;
    if (error) task.error = error;

    if (status === "in_progress" && !task.startedAt) {
      task.startedAt = new Date();
      this.memory.currentTaskId = taskId;
    }

    if ((status === "completed" || status === "failed") && !task.completedAt) {
      task.completedAt = new Date();
      if (status === "completed") {
        this.memory.currentTaskId = undefined;
      }
    }
  }

  /**
   * Track file creation
   */
  trackFileCreated(filePath: string): void {
    if (!this.memory) return;
    if (!this.memory.filesCreated.includes(filePath)) {
      this.memory.filesCreated.push(filePath);
    }
  }

  /**
   * Track file modification
   */
  trackFileModified(filePath: string): void {
    if (!this.memory) return;
    if (!this.memory.filesModified.includes(filePath)) {
      this.memory.filesModified.push(filePath);
    }
  }

  /**
   * Track file deletion
   */
  trackFileDeleted(filePath: string): void {
    if (!this.memory) return;
    if (!this.memory.filesDeleted.includes(filePath)) {
      this.memory.filesDeleted.push(filePath);
    }
  }

  /**
   * Track command execution
   */
  trackCommand(command: string): void {
    if (!this.memory) return;
    this.memory.commandsExecuted.push(command);
  }

  /**
   * Track dependency installation
   */
  trackDependencyInstalled(dependency: string): void {
    if (!this.memory) return;
    if (!this.memory.dependenciesInstalled.includes(dependency)) {
      this.memory.dependenciesInstalled.push(dependency);
    }
  }

  /**
   * Track tool execution
   */
  trackToolExecution(toolName: string, input: unknown, status: "success" | "error"): void {
    if (!this.memory) return;
    this.memory.toolHistory.push({
      toolName,
      input,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Track validation result
   */
  trackValidation(
    type: ExecutionMemory["validationResults"][number]["type"],
    success: boolean,
    errors?: string[],
  ): void {
    if (!this.memory) return;
    this.memory.validationResults.push({
      type,
      success,
      errors,
      timestamp: new Date(),
    });
  }

  /**
   * Track repair attempt
   */
  trackRepairAttempt(taskId: string, error: string, fix: string, success: boolean): void {
    if (!this.memory) return;
    this.memory.repairAttempts.push({
      taskId,
      error,
      fix,
      success,
      timestamp: new Date(),
    });
  }

  /**
   * Mark session as interrupted
   */
  markInterrupted(): void {
    if (!this.memory) return;
    this.memory.state = "interrupted";
    this.memory.interruptedAt = new Date();
  }

  /**
   * Resume from interruption
   */
  resume(): boolean {
    if (!this.memory) return false;
    if (this.memory.state !== "interrupted") return false;

    this.memory.state = "executing";
    this.memory.interruptedAt = undefined;

    console.log(`[ExecutionMemory] Resumed session ${this.memory.sessionId}`);
    console.log(`[ExecutionMemory] Current task: ${this.memory.currentTaskId || "None"}`);
    console.log(`[ExecutionMemory] Completed: ${this.memory.tasks.filter((t) => t.status === "completed").length}/${this.memory.tasks.length}`);

    return true;
  }

  /**
   * Check if execution can resume
   */
  canResume(): boolean {
    if (!this.memory) return false;
    return this.memory.state === "interrupted" && this.memory.tasks.length > 0;
  }

  /**
   * Get pending tasks (not completed or failed)
   */
  getPendingTasks(): ExecutionTask[] {
    if (!this.memory) return [];
    return this.memory.tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): ExecutionTask[] {
    if (!this.memory) return [];
    return this.memory.tasks.filter((t) => t.status === "completed");
  }

  /**
   * Get failed tasks
   */
  getFailedTasks(): ExecutionTask[] {
    if (!this.memory) return [];
    return this.memory.tasks.filter((t) => t.status === "failed");
  }

  /**
   * Get execution progress summary
   */
  getProgressSummary(): string {
    if (!this.memory) return "No execution memory";

    const completed = this.memory.tasks.filter((t) => t.status === "completed").length;
    const failed = this.memory.tasks.filter((t) => t.status === "failed").length;
    const pending = this.memory.tasks.filter((t) => t.status === "pending").length;
    const inProgress = this.memory.tasks.filter((t) => t.status === "in_progress").length;

    const lines: string[] = [
      `Execution Progress:`,
      `  State: ${this.memory.state}`,
      `  Goal: ${this.memory.goal}`,
      `  Tasks: ${completed}/${this.memory.tasks.length} completed`,
      `    ✓ Completed: ${completed}`,
      `    ✗ Failed: ${failed}`,
      `    ⟳ In Progress: ${inProgress}`,
      `    ○ Pending: ${pending}`,
      `  Files Created: ${this.memory.filesCreated.length}`,
      `  Files Modified: ${this.memory.filesModified.length}`,
      `  Commands Executed: ${this.memory.commandsExecuted.length}`,
      `  Validation Results: ${this.memory.validationResults.length}`,
      `  Repair Attempts: ${this.memory.repairAttempts.length}`,
    ];

    return lines.join("\n");
  }

  /**
   * Clear execution memory
   */
  clear(): void {
    this.memory = null;
    this.persistencePath = null;
  }
}

/**
 * Singleton instance for current session
 */
let globalMemoryManager: ExecutionMemoryManager | null = null;

export function getExecutionMemoryManager(): ExecutionMemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new ExecutionMemoryManager();
  }
  return globalMemoryManager;
}

export function resetExecutionMemoryManager(): void {
  globalMemoryManager = null;
}

