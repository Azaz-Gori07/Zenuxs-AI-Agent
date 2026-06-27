/**
 * Observation System Integration — Runtime Hooks
 *
 * Integrates the observation system into the agent runtime to automatically:
 * 1. Capture tool execution results
 * 2. Track modified files
 * 3. Enable reflection after tool execution
 * 4. Trigger self-repair when needed
 */

import type {
  AgentRuntimeHooks,
  AgentAfterToolResult,
} from "@cline/shared";
import {
  captureObservation,
  createSessionState,
  analyzeForSelfRepair,
  shouldEnterSelfRepair,
  enterSelfRepair,
  incrementSelfRepair,
  generateExecutionSummary,
  type ToolObservation,
  type SessionExecutionState,
} from "./observation-system";
import {
  generateReflectionContext,
  shouldTriggerSelfRepair,
  getReflectionSummary,
} from "./self-reflection";
import {
  getExecutionMemoryManager,
} from "./execution-memory";
import {
  selfAuditExecution,
} from "./execution-verification";
import {
  getGoalTracker,
} from "./goal-tracker";
import {
  logError,
} from "./logging";
import {
  emitToolCallComplete,
} from "./event-bus";
import {
  getWorkspaceIndexer,
} from "./workspace-indexer";
import {
  invalidateFileCaches,
} from "./execution-cache";

export interface ObservationConfig {
  /** Session ID for tracking */
  sessionId: string;
  /** Whether observation capture is enabled */
  enabled?: boolean;
  /** Whether to log observations */
  logObservations?: boolean;
  /** Whether to enable self-repair based on observations */
  enableSelfRepair?: boolean;
  /** Maximum self-repair iterations */
  maxSelfRepairIterations?: number;
  /** Callback when observation is captured */
  onObservation?: (observation: ToolObservation) => void;
  /** Callback when self-repair is triggered */
  onSelfRepairTrigger?: (summary: ReturnType<typeof generateExecutionSummary>) => void;
}

/**
 * Session state singleton for current session
 * TODO: Replace with proper dependency injection
 */
let currentSessionState: SessionExecutionState | null = null;

/**
 * Get or create session state
 */
export function getSessionState(sessionId: string): SessionExecutionState {
  if (!currentSessionState || currentSessionState.sessionId !== sessionId) {
    currentSessionState = createSessionState(sessionId);
  }
  return currentSessionState;
}

/**
 * Get current session state (may be null)
 */
export function getCurrentSessionState(): SessionExecutionState | null {
  return currentSessionState;
}

/**
 * Reset session state (for testing or session cleanup)
 */
export function resetSessionState(): void {
  currentSessionState = null;
}

/**
 * Create observation system hooks for agent runtime
 */
export function createObservationHooks(config: ObservationConfig): Partial<AgentRuntimeHooks> {
  const enabled = config.enabled ?? true;
  const logObservations = config.logObservations ?? false;
  const enableSelfRepair = config.enableSelfRepair ?? true;
  const maxSelfRepairIterations = config.maxSelfRepairIterations ?? 5;

  if (!enabled) {
    return {};
  }

  // Initialize session state
  const state = getSessionState(config.sessionId);

  return {
    /**
     * After tool execution: capture observation
     */
    afterTool: async (ctx): Promise<AgentAfterToolResult | undefined> => {
      const toolName = ctx.toolCall.toolName;
      const input = ctx.toolCall.input;
      const startTime = new Date();

      // Track in execution memory
      const memoryManager = getExecutionMemoryManager();
      memoryManager.trackToolExecution(toolName, input, "success");

      // Track file operations based on tool name
      if (toolName === "write_file" || toolName === "editor") {
        const filePath = typeof input === "object" && input !== null && "path" in input ? String((input as any).path) : undefined;
        if (filePath) {
          memoryManager.trackFileModified(filePath);
          // Invalidate cache for modified file
          invalidateFileCaches(filePath);
          // Update workspace index incrementally
          const indexer = getWorkspaceIndexer();
          indexer.updateFile(filePath).catch(() => {
            // Ignore indexing errors
          });
        }
      }

      // Track shell commands
      if (toolName === "run_commands" || toolName === "shell") {
        const command = typeof input === "object" && input !== null && "command" in input ? String((input as any).command) : undefined;
        if (command) {
          memoryManager.trackCommand(command);
          // Track package installations
          if (command.includes("npm install") || command.includes("yarn add") || command.includes("pnpm add")) {
            const packages = command.split(" ").slice(2).join(" ");
            if (packages) {
              memoryManager.trackDependencyInstalled(packages);
            }
          }
        }
      }

      // Self-audit after tool execution (periodic check)
      const auditResult = selfAuditExecution();
      if (auditResult && !auditResult.verified) {
        logError("Observation", "Self-audit failed - simulation detected", undefined, {
          missingFiles: auditResult.missingFiles.length,
          missingCommands: auditResult.missingCommands.length,
          category: "validation",
        });
      }

      // Record iteration and tool call in goal tracker
      const goalTracker = getGoalTracker();
      goalTracker.recordIteration();
      goalTracker.recordToolCall();

      // Emit tool call complete event
      emitToolCallComplete(
        config.sessionId,
        toolName,
        ctx.toolCall.toolCallId,
        ctx.result.output,
        Date.now() - startTime.getTime(),
      );

      // If autonomous execution is active, continue to next task automatically
      if (goalTracker.isAutonomousActive()) {
        // The goal tracker will automatically trigger the next task
        // after the current one completes
        if (logObservations) {
          console.log(`[Observation] 🔄 Autonomous execution active - continuing automatically`);
          console.log(`[Observation] ${goalTracker.getStatus()}`);
        }
      }

      try {
        // Execute the tool (this happens in the runtime, we just observe)
        // The result will be available in the context

        // For now, we create a placeholder observation
        // In a full implementation, we'd hook into the actual tool executor
        const observation: ToolObservation = {
          id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          toolName,
          input,
          startTime,
          endTime: new Date(),
          durationMs: Date.now() - startTime.getTime(),
          status: "success", // Assume success unless we catch an error
          modifiedFiles: [], // TODO: Extract from tool result
          readFiles: [], // TODO: Extract from tool result
          artifacts: [], // TODO: Extract from tool result
          metadata: {
            toolCallId: ctx.toolCall.toolCallId,
          },
        };

        // Capture observation
        captureObservation(state, observation);

        // Log if enabled
        if (logObservations) {
          console.log(
            `[Observation] ${toolName} completed in ${observation.durationMs}ms`,
          );
        }

        // Trigger callback if provided
        config.onObservation?.(observation);

        // Check if we should enter self-repair mode
        if (enableSelfRepair && shouldEnterSelfRepair(state, 3)) {
          enterSelfRepair(state);
          const summary = generateExecutionSummary(state);

          if (logObservations) {
            console.log("[Observation] Entering self-repair mode");
            console.log(`[Observation] Execution summary:`, summary);
          }

          config.onSelfRepairTrigger?.(summary);
        }

        return undefined;
      } catch (error) {
        // Capture error observation
        const observation: ToolObservation = {
          id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          toolName,
          input,
          startTime,
          endTime: new Date(),
          durationMs: Date.now() - startTime.getTime(),
          status: "error",
          error: {
            type: error instanceof Error ? error.constructor.name : "UnknownError",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          modifiedFiles: [],
          readFiles: [],
          artifacts: [],
          metadata: {
            toolCallId: ctx.toolCall.toolCallId,
          },
        };

        captureObservation(state, observation);

        if (logObservations) {
          console.error(`[Observation] ${toolName} failed:`, observation.error?.message);
        }

        config.onObservation?.(observation);

        // Analyze for self-repair
        if (enableSelfRepair) {
          const analysis = analyzeForSelfRepair(state);
          if (analysis.needsRepair && analysis.suggestedActions.length > 0) {
            if (logObservations) {
              console.log("[Observation] Self-repair suggestions:", analysis.suggestedActions);
            }
          }
        }

        return undefined;
      }
    },

    /**
     * Before model call: inject reflection context into system message
     * This enables the model to reflect on recent tool executions
     * and make evidence-based decisions instead of assumptions.
     */
    beforeModel: async (): Promise<undefined> => {
      // Always generate reflection context (even if not self-repairing)
      const reflectionContext = generateReflectionContext(state);

      // Check if we should enter self-repair mode
      if (enableSelfRepair && shouldTriggerSelfRepair(state) && !state.isSelfRepairing) {
        enterSelfRepair(state);
        if (logObservations) {
          console.log(`[Observation] Self-repair mode activated`);
          console.log(getReflectionSummary(state));
        }
      }

      // If in self-repair mode, check iteration limit
      if (state.isSelfRepairing) {
        if (state.selfRepairIteration >= maxSelfRepairIterations) {
          if (logObservations) {
            console.log(
              `[Observation] Self-repair exceeded max iterations (${maxSelfRepairIterations})`,
            );
          }
          return undefined;
        }

        // Increment self-repair iteration
        const iteration = incrementSelfRepair(state);

        if (logObservations) {
          console.log(`[Observation] Self-repair iteration ${iteration}`);
          console.log(`[Observation] Recent activity:`, reflectionContext.recentActivity);
          console.log(`[Observation] Suggested actions:`, reflectionContext.suggestedActions);
        }
      }

      // Log reflection summary if enabled
      if (logObservations && reflectionContext.hasIssues) {
        console.log(getReflectionSummary(state));
      }

      // TODO: Inject reflectionContext.reflectionPrompt into system message
      // This requires modifying the system prompt assembly in session-runtime-orchestrator.ts
      // The prompt should be prepended to guide model behavior

      return undefined;
    },
  };
}

/**
 * Get execution summary for current session
 */
export function getExecutionSummary(sessionId?: string) {
  const state = sessionId ? getSessionState(sessionId) : currentSessionState;
  if (!state) {
    return null;
  }
  return generateExecutionSummary(state);
}

/**
 * Get recent tool observations
 */
export function getRecentToolObservations(count: number = 10, sessionId?: string) {
  const state = sessionId ? getSessionState(sessionId) : currentSessionState;
  if (!state) {
    return [];
  }
  return state.observations.slice(-count);
}

/**
 * Get failed tool observations
 */
export function getFailedToolObservations(sessionId?: string) {
  const state = sessionId ? getSessionState(sessionId) : currentSessionState;
  if (!state) {
    return [];
  }
  return state.observations.filter((obs) => obs.status === "error");
}
