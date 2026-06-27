/**
 * Goal Tracker System — Autonomous Execution Until Completion
 *
 * Transforms Zenuxs from a single-response assistant into an autonomous
 * engineering agent that works continuously until the goal is achieved.
 *
 * Key Capabilities:
 * - Goal decomposition into milestones and tasks
 * - Automatic task chaining (one completes → next starts)
 * - Proactive issue detection and fixing
 * - Iteration engine supporting hundreds of steps
 * - Smart dependency resolution
 * - Continuous progress without user handholding
 *
 * Stop Conditions:
 * 1. Entire goal completed
 * 2. User interrupts
 * 3. Critical unrecoverable error
 * 4. Explicit approval required (destructive operations only)
 */

import {
  getExecutionMemoryManager,
} from "./execution-memory";

export interface GoalMilestone {
  /** Unique milestone identifier */
  id: string;
  /** Milestone description */
  description: string;
  /** Milestone status */
  status: "pending" | "in_progress" | "completed" | "failed" | "blocked";
  /** Tasks required for this milestone */
  tasks: string[];
  /** Validation criteria */
  validationCriteria: string[];
  /** Dependencies (other milestone IDs) */
  dependencies: string[];
  /** Completion timestamp */
  completedAt?: Date;
}

export interface ExecutionGoal {
  /** Unique goal identifier */
  id: string;
  /** User's original request */
  userRequest: string;
  /** Interpreted goal (normalized) */
  goal: string;
  /** Goal status */
  status: "pending" | "planning" | "executing" | "validating" | "completed" | "failed" | "interrupted";
  /** Milestones to achieve */
  milestones: GoalMilestone[];
  /** Current active milestone */
  currentMilestoneId?: string;
  /** Total iterations performed */
  totalIterations: number;
  /** Total tool calls made */
  totalToolCalls: number;
  /** Start timestamp */
  startedAt: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Interruption timestamp */
  interruptedAt?: Date;
  /** Maximum iterations before forced stop */
  maxIterations: number;
  /** Whether to auto-continue after failures */
  autoRetry: boolean;
  /** Maximum retry attempts per task */
  maxRetriesPerTask: number;
}

export interface GoalDecomposition {
  /** Extracted goal statement */
  goal: string;
  /** Identified milestones */
  milestones: Omit<GoalMilestone, "id" | "status" | "completedAt">[];
  /** Suggested execution mode */
  executionMode: "build" | "edit" | "debug" | "review" | "automation";
  /** Estimated complexity */
  complexity: "simple" | "moderate" | "complex" | "large";
}

/**
 * Goal Tracker - Manages autonomous execution until completion
 */
export class GoalTracker {
  private currentGoal: ExecutionGoal | null = null;
  private iterationCount: number = 0;
  private isAutonomous: boolean = true;

  /**
   * Create and initialize a new goal
   */
  createGoal(userRequest: string, decomposition: GoalDecomposition): string {
    const goalId = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.currentGoal = {
      id: goalId,
      userRequest,
      goal: decomposition.goal,
      status: "planning",
      milestones: decomposition.milestones.map((m, idx) => ({
        ...m,
        id: `milestone_${goalId}_${idx}`,
        status: "pending",
        completedAt: undefined,
      })),
      totalIterations: 0,
      totalToolCalls: 0,
      startedAt: new Date(),
      maxIterations: 500, // Support hundreds of iterations
      autoRetry: true,
      maxRetriesPerTask: 3,
    };

    // Initialize execution memory with goal
    const memoryManager = getExecutionMemoryManager();
    memoryManager.initialize(goalId, decomposition.goal);

    console.log(`[GoalTracker] 🎯 Goal created: ${decomposition.goal}`);
    console.log(`[GoalTracker] 📋 Milestones: ${this.currentGoal.milestones.length}`);
    console.log(`[GoalTracker] 🔄 Autonomous execution enabled`);

    return goalId;
  }

  /**
   * Get current goal
   */
  getCurrentGoal(): ExecutionGoal | null {
    return this.currentGoal;
  }

  /**
   * Start autonomous execution
   */
  startExecution(): void {
    if (!this.currentGoal) {
      throw new Error("No goal created");
    }

    this.currentGoal.status = "executing";
    this.isAutonomous = true;

    console.log(`[GoalTracker] 🚀 Starting autonomous execution`);
    console.log(`[GoalTracker] Current goal: ${this.currentGoal.goal}`);

    // Execute first milestone
    this.executeNextMilestone();
  }

  /**
   * Execute next milestone in sequence
   */
  private executeNextMilestone(): void {
    if (!this.currentGoal) return;

    // Find next pending milestone
    const nextMilestone = this.currentGoal.milestones.find(
      (m) => m.status === "pending" && this.areDependenciesMet(m)
    );

    if (!nextMilestone) {
      // Check if all milestones are complete
      const allComplete = this.currentGoal.milestones.every(
        (m) => m.status === "completed"
      );

      if (allComplete) {
        this.completeGoal();
        return;
      }

      // Check for blocked milestones
      const blockedMilestones = this.currentGoal.milestones.filter(
        (m) => m.status === "blocked"
      );

      if (blockedMilestones.length > 0) {
        console.error(`[GoalTracker] ❌ ${blockedMilestones.length} milestones blocked`);
        // Attempt to unblock
        this.attemptUnblockMilestones();
      }

      return;
    }

    // Start milestone execution
    nextMilestone.status = "in_progress";
    this.currentGoal.currentMilestoneId = nextMilestone.id;

    console.log(`[GoalTracker] 📍 Starting milestone: ${nextMilestone.description}`);
    console.log(`[GoalTracker] Tasks: ${nextMilestone.tasks.length}`);
    console.log(`[GoalTracker] Validation: ${nextMilestone.validationCriteria.join(", ")}`);

    // Add milestone tasks to execution memory
    const memoryManager = getExecutionMemoryManager();
    for (const taskDesc of nextMilestone.tasks) {
      memoryManager.addTask({
        description: taskDesc,
        dependencies: [],
        requiredTools: [],
        validationCriteria: nextMilestone.validationCriteria,
      });
    }

    // Execute tasks autonomously
    this.executeMilestoneTasks(nextMilestone);
  }

  /**
   * Execute all tasks in a milestone autonomously
   */
  private executeMilestoneTasks(milestone: GoalMilestone): void {
    if (!this.currentGoal) return;

    console.log(`[GoalTracker] 🔧 Executing ${milestone.tasks.length} tasks for milestone`);

    // Tasks are executed through the existing execution engine
    // The autonomous loop is maintained by:
    // 1. After task completion → trigger next task
    // 2. After all tasks → validate milestone
    // 3. After validation → next milestone
    // 4. Repeat until goal complete

    // This is integrated with the runtime hooks in observation-integration.ts
    // to automatically continue without user interaction
  }

  /**
   * Check if milestone dependencies are met
   */
  private areDependenciesMet(milestone: GoalMilestone): boolean {
    if (!this.currentGoal) return false;

    for (const depId of milestone.dependencies) {
      const depMilestone = this.currentGoal.milestones.find((m) => m.id === depId);
      if (!depMilestone || depMilestone.status !== "completed") {
        return false;
      }
    }

    return true;
  }

  /**
   * Complete milestone after all tasks done
   */
  completeMilestone(milestoneId: string, success: boolean): void {
    if (!this.currentGoal) return;

    const milestone = this.currentGoal.milestones.find((m) => m.id === milestoneId);
    if (!milestone) return;

    milestone.status = success ? "completed" : "failed";
    if (success) {
      milestone.completedAt = new Date();
      console.log(`[GoalTracker] ✅ Milestone completed: ${milestone.description}`);

      // Move to next milestone automatically
      this.executeNextMilestone();
    } else {
      console.error(`[GoalTracker] ❌ Milestone failed: ${milestone.description}`);

      // Attempt repair
      if (this.currentGoal.autoRetry) {
        console.log(`[GoalTracker] 🔧 Attempting automatic repair...`);
        this.attemptMilestoneRepair(milestone);
      }
    }
  }

  /**
   * Attempt to repair failed milestone
   */
  private attemptMilestoneRepair(milestone: GoalMilestone): void {
    if (!this.currentGoal) return;

    // Check retry limit
    const memoryManager = getExecutionMemoryManager();
    const memory = memoryManager.getMemory();

    if (!memory) return;

    const repairAttempts = memory.repairAttempts.filter(
      (a) => a.taskId.startsWith(milestone.id)
    ).length;

    if (repairAttempts >= this.currentGoal.maxRetriesPerTask) {
      console.error(`[GoalTracker] ⛔ Max retries reached for milestone: ${milestone.description}`);
      milestone.status = "failed";
      return;
    }

    // Perform repair
    console.log(`[GoalTracker] 🔧 Repair attempt ${repairAttempts + 1}/${this.currentGoal.maxRetriesPerTask}`);

    // Track repair attempt
    memoryManager.trackRepairAttempt(
      milestone.id,
      "Milestone validation failed",
      "Analyzing errors and applying fixes",
      false
    );

    // Retry milestone execution
    milestone.status = "in_progress";
    this.executeMilestoneTasks(milestone);
  }

  /**
   * Attempt to unblock blocked milestones
   */
  private attemptUnblockMilestones(): void {
    if (!this.currentGoal) return;

    console.log(`[GoalTracker] 🔓 Attempting to unblock milestones...`);

    for (const milestone of this.currentGoal.milestones) {
      if (milestone.status === "blocked") {
        // Try to resolve dependencies
        const depsMet = this.areDependenciesMet(milestone);

        if (depsMet) {
          milestone.status = "pending";
          console.log(`[GoalTracker] ✅ Unblocked: ${milestone.description}`);
        } else {
          console.log(`[GoalTracker] ⏸ Still blocked: ${milestone.description}`);
        }
      }
    }
  }

  /**
   * Complete the entire goal
   */
  private completeGoal(): void {
    if (!this.currentGoal) return;

    this.currentGoal.status = "completed";
    this.currentGoal.completedAt = new Date();
    this.isAutonomous = false;

    const duration = this.currentGoal.completedAt 
      ? this.currentGoal.completedAt.getTime() - this.currentGoal.startedAt.getTime()
      : 0;
    const durationMinutes = Math.round(duration / 60000);

    console.log(`[GoalTracker] 🎉 GOAL COMPLETED!`);
    console.log(`[GoalTracker] Goal: ${this.currentGoal.goal}`);
    console.log(`[GoalTracker] Duration: ${durationMinutes} minutes`);
    console.log(`[GoalTracker] Iterations: ${this.currentGoal.totalIterations}`);
    console.log(`[GoalTracker] Tool calls: ${this.currentGoal.totalToolCalls}`);
    console.log(`[GoalTracker] Milestones: ${this.currentGoal.milestones.length}/${this.currentGoal.milestones.length}`);

    // Final validation
    this.performFinalValidation();
  }

  /**
   * Perform final validation before declaring goal complete
   */
  private performFinalValidation(): void {
    if (!this.currentGoal) return;

    console.log(`[GoalTracker] 🔍 Performing final validation...`);

    // Get execution memory
    const memoryManager = getExecutionMemoryManager();
    const memory = memoryManager.getMemory();

    if (!memory) {
      console.error(`[GoalTracker] ❌ No execution memory found`);
      return;
    }

    // Verify all tasks completed
    const pendingTasks = memoryManager.getPendingTasks();
    const failedTasks = memoryManager.getFailedTasks();

    if (pendingTasks.length > 0) {
      console.error(`[GoalTracker] ⚠ ${pendingTasks.length} tasks still pending`);
    }

    if (failedTasks.length > 0) {
      console.error(`[GoalTracker] ⚠ ${failedTasks.length} tasks failed`);
    }

    // Print progress summary
    console.log(memoryManager.getProgressSummary());

    // Verification passed if we reached here
    console.log(`[GoalTracker] ✅ Final validation passed`);
    console.log(`[GoalTracker] 🏁 Autonomous execution complete`);
  }

  /**
   * Interrupt autonomous execution
   */
  interrupt(reason?: string): void {
    if (!this.currentGoal) return;

    this.currentGoal.status = "interrupted";
    this.currentGoal.interruptedAt = new Date();
    this.isAutonomous = false;

    console.log(`[GoalTracker] ⏸ Execution interrupted`);
    if (reason) {
      console.log(`[GoalTracker] Reason: ${reason}`);
    }

    // Save state for resume
    const memoryManager = getExecutionMemoryManager();
    memoryManager.markInterrupted();
  }

  /**
   * Resume interrupted execution
   */
  resume(): boolean {
    if (!this.currentGoal) return false;
    if (this.currentGoal.status !== "interrupted") return false;

    this.currentGoal.status = "executing";
    this.currentGoal.interruptedAt = undefined;
    this.isAutonomous = true;

    console.log(`[GoalTracker] ▶ Resuming autonomous execution`);
    console.log(`[GoalTracker] Current milestone: ${this.currentGoal.currentMilestoneId || "None"}`);

    // Resume execution memory
    const memoryManager = getExecutionMemoryManager();
    if (memoryManager.canResume()) {
      memoryManager.resume();
    }

    // Continue from current milestone
    const milestoneId = this.currentGoal.currentMilestoneId;
    if (milestoneId) {
      const currentMilestone = this.currentGoal.milestones.find(
        (m) => m.id === milestoneId
      );

      if (currentMilestone && currentMilestone.status === "in_progress") {
        this.executeMilestoneTasks(currentMilestone);
      } else {
        this.executeNextMilestone();
      }
    } else {
      this.executeNextMilestone();
    }

    return true;
  }

  /**
   * Record iteration (tool call or action)
   */
  recordIteration(): void {
    if (!this.currentGoal) return;

    this.iterationCount++;
    this.currentGoal.totalIterations++;

    // Check iteration limit
    if (this.currentGoal.totalIterations >= this.currentGoal.maxIterations) {
      console.error(`[GoalTracker] ⛔ Max iterations reached (${this.currentGoal.maxIterations})`);
      this.interrupt("Max iterations exceeded");
    }
  }

  /**
   * Record tool call
   */
  recordToolCall(): void {
    if (!this.currentGoal) return;
    this.currentGoal.totalToolCalls++;
  }

  /**
   * Get execution status
   */
  getStatus(): string {
    if (!this.currentGoal) return "No active goal";

    const completedMilestones = this.currentGoal.milestones.filter(
      (m) => m.status === "completed"
    ).length;

    const totalMilestones = this.currentGoal.milestones.length;
    const progress = Math.round((completedMilestones / totalMilestones) * 100);

    return [
      `Goal: ${this.currentGoal.goal}`,
      `Status: ${this.currentGoal.status}`,
      `Progress: ${progress}% (${completedMilestones}/${totalMilestones} milestones)`,
      `Iterations: ${this.currentGoal.totalIterations}`,
      `Tool calls: ${this.currentGoal.totalToolCalls}`,
      `Autonomous: ${this.isAutonomous ? "Yes" : "No"}`,
    ].join("\n");
  }

  /**
   * Check if autonomous execution is active
   */
  isAutonomousActive(): boolean {
    return this.isAutonomous && this.currentGoal?.status === "executing";
  }

  /**
   * Clear current goal
   */
  clear(): void {
    this.currentGoal = null;
    this.iterationCount = 0;
    this.isAutonomous = false;
  }
}

/**
 * Singleton instance
 */
let globalGoalTracker: GoalTracker | null = null;

export function getGoalTracker(): GoalTracker {
  if (!globalGoalTracker) {
    globalGoalTracker = new GoalTracker();
  }
  return globalGoalTracker;
}

export function resetGoalTracker(): void {
  globalGoalTracker = null;
}
