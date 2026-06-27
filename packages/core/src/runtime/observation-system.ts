/**
 * Observation System — Execution Engine Enhancement
 *
 * Captures structured observations after every tool execution:
 * - stdout/stderr output
 * - Exit codes
 * - Modified files
 * - Execution artifacts
 * - Timing information
 * - Error details
 *
 * These observations feed into the reflection loop and self-repair system,
 * enabling evidence-based decisions rather than assumptions.
 *
 * Inspired by OpenCode's ToolOutputStore and LLMEvent publishing pattern.
 */

export interface ToolObservation {
  /** Unique identifier for this observation */
  id: string;
  /** Tool that was executed */
  toolName: string;
  /** Input that was passed to the tool */
  input: unknown;
  /** Timestamp when tool started */
  startTime: Date;
  /** Timestamp when tool finished */
  endTime?: Date;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Tool execution status */
  status: "success" | "error" | "timeout" | "cancelled";
  /** Standard output (for shell tools) */
  stdout?: string;
  /** Standard error (for shell tools) */
  stderr?: string;
  /** Exit code (for shell tools) */
  exitCode?: number;
  /** Error details if status is "error" */
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  /** Files that were created or modified by this tool */
  modifiedFiles: string[];
  /** Files that were read by this tool */
  readFiles: string[];
  /** Artifacts produced (e.g., build output, test results) */
  artifacts: ToolArtifact[];
  /** Metadata specific to the tool */
  metadata?: Record<string, unknown>;
}

export interface ToolArtifact {
  /** Artifact type */
  type: "build_output" | "test_results" | "lint_results" | "typecheck_results" | "other";
  /** Artifact content or path */
  content: string;
  /** Whether the artifact indicates success */
  success: boolean;
  /** Summary of the artifact (e.g., "3 tests passed, 1 failed") */
  summary?: string;
}

/**
 * Session execution state that persists across turns
 */
export interface SessionExecutionState {
  /** Session ID */
  sessionId: string;
  /** All observations captured in this session */
  observations: ToolObservation[];
  /** Current task being executed */
  currentTask?: string;
  /** Completed tasks */
  completedTasks: string[];
  /** Failed tasks that need retry */
  failedTasks: Array<{
    task: string;
    observation: ToolObservation;
    retryCount: number;
  }>;
  /** Files modified during this session */
  modifiedFiles: Set<string>;
  /** Current iteration count */
  iteration: number;
  /** Whether session is in self-repair mode */
  isSelfRepairing: boolean;
  /** Self-repair iteration count */
  selfRepairIteration: number;
}

/**
 * Create a new session execution state
 */
export function createSessionState(sessionId: string): SessionExecutionState {
  return {
    sessionId,
    observations: [],
    completedTasks: [],
    failedTasks: [],
    modifiedFiles: new Set<string>(),
    iteration: 0,
    isSelfRepairing: false,
    selfRepairIteration: 0,
  };
}

/**
 * Capture an observation after tool execution
 */
export function captureObservation(
  state: SessionExecutionState,
  observation: ToolObservation,
): void {
  state.observations.push(observation);

  // Track modified files
  for (const file of observation.modifiedFiles) {
    state.modifiedFiles.add(file);
  }

  // Update timing if not already set
  if (!observation.endTime) {
    observation.endTime = new Date();
  }
  if (!observation.durationMs && observation.startTime) {
    observation.durationMs = observation.endTime.getTime() - observation.startTime.getTime();
  }
}

/**
 * Get recent observations (last N)
 */
export function getRecentObservations(
  state: SessionExecutionState,
  count: number = 10,
): ToolObservation[] {
  return state.observations.slice(-count);
}

/**
 * Get recent tool observations (alias for getRecentObservations)
 */
export function getRecentToolObservations(
  state: SessionExecutionState,
  count: number = 10,
): ToolObservation[] {
  return getRecentObservations(state, count);
}

/**
 * Get observations for a specific tool
 */
export function getToolObservations(
  state: SessionExecutionState,
  toolName: string,
): ToolObservation[] {
  return state.observations.filter((obs) => obs.toolName === toolName);
}

/**
 * Get observations with errors
 */
export function getErrorObservations(
  state: SessionExecutionState,
): ToolObservation[] {
  return state.observations.filter((obs) => obs.status === "error");
}

/**
 * Get successful build/test observations
 */
export function getSuccessObservations(
  state: SessionExecutionState,
  artifactType?: ToolArtifact["type"],
): ToolObservation[] {
  return state.observations.filter((obs) => {
    if (obs.status !== "success") return false;
    if (!artifactType) return true;
    return obs.artifacts.some((a) => a.type === artifactType && a.success);
  });
}

/**
 * Analyze observations to determine if self-repair is needed
 */
export function analyzeForSelfRepair(
  state: SessionExecutionState,
): {
  needsRepair: boolean;
  failedTools: ToolObservation[];
  suggestedActions: string[];
} {
  const failedTools = getErrorObservations(state);
  const recentFailures = failedTools.slice(-5); // Last 5 failures

  if (recentFailures.length === 0) {
    return { needsRepair: false, failedTools: [], suggestedActions: [] };
  }

  const suggestedActions: string[] = [];

  // Analyze failure patterns
  for (const failure of recentFailures) {
    if (failure.error) {
      if (failure.error.message.includes("ENOENT") || failure.error.message.includes("not found")) {
        suggestedActions.push(`File not found: ${failure.input}. Check file paths.`);
      } else if (failure.error.message.includes("EACCES") || failure.error.message.includes("permission")) {
        suggestedActions.push(`Permission denied for ${failure.toolName}. Check file permissions.`);
      } else if (failure.error.message.includes("timeout")) {
        suggestedActions.push(`Tool ${failure.toolName} timed out. Consider increasing timeout.`);
      } else if (failure.exitCode !== undefined && failure.exitCode !== 0) {
        suggestedActions.push(`${failure.toolName} exited with code ${failure.exitCode}. Check stderr for details.`);
      }
    }

    // Check for repeated failures
    const sameToolFailures = failedTools.filter((f) => f.toolName === failure.toolName);
    if (sameToolFailures.length >= 3) {
      suggestedActions.push(`${failure.toolName} has failed ${sameToolFailures.length} times. Consider alternative approach.`);
    }
  }

  return {
    needsRepair: failedTools.length > 0,
    failedTools: recentFailures,
    suggestedActions,
  };
}

/**
 * Generate a summary of session execution for reflection
 */
export function generateExecutionSummary(
  state: SessionExecutionState,
): {
  totalObservations: number;
  successfulTools: number;
  failedTools: number;
  totalDurationMs: number;
  modifiedFilesCount: number;
  currentIteration: number;
  isSelfRepairing: boolean;
  recentActivity: string[];
} {
  const successfulTools = state.observations.filter((obs) => obs.status === "success").length;
  const failedTools = state.observations.filter((obs) => obs.status === "error").length;
  const totalDurationMs = state.observations.reduce(
    (sum, obs) => sum + (obs.durationMs ?? 0),
    0,
  );

  // Generate recent activity summary
  const recentActivity = state.observations.slice(-5).map((obs) => {
    const status = obs.status === "success" ? "✓" : "✗";
    return `${status} ${obs.toolName} (${obs.durationMs ?? 0}ms)`;
  });

  return {
    totalObservations: state.observations.length,
    successfulTools,
    failedTools,
    totalDurationMs,
    modifiedFilesCount: state.modifiedFiles.size,
    currentIteration: state.iteration,
    isSelfRepairing: state.isSelfRepairing,
    recentActivity,
  };
}

/**
 * Reset observation history while keeping session state
 * Used when transitioning between major tasks
 */
export function resetObservationHistory(
  state: SessionExecutionState,
  keepLast: number = 10,
): void {
  // Keep only the most recent observations for context
  const recent = state.observations.slice(-keepLast);
  state.observations = recent;

  // Reset self-repair state
  state.isSelfRepairing = false;
  state.selfRepairIteration = 0;
}

/**
 * Check if the session should enter self-repair mode
 */
export function shouldEnterSelfRepair(
  state: SessionExecutionState,
  maxFailedIterations: number = 3,
): boolean {
  const recentObservations = state.observations.slice(-maxFailedIterations);
  const allFailed = recentObservations.every((obs) => obs.status === "error");
  const hasRecentFailures = recentObservations.length >= maxFailedIterations;

  return hasRecentFailures && allFailed && !state.isSelfRepairing;
}

/**
 * Mark session as entering self-repair mode
 */
export function enterSelfRepair(state: SessionExecutionState): void {
  state.isSelfRepairing = true;
  state.selfRepairIteration = 0;
}

/**
 * Increment self-repair iteration
 */
export function incrementSelfRepair(state: SessionExecutionState): number {
  state.selfRepairIteration++;
  return state.selfRepairIteration;
}

/**
 * Exit self-repair mode
 */
export function exitSelfRepair(state: SessionExecutionState): void {
  state.isSelfRepairing = false;
  state.selfRepairIteration = 0;
}
