/**
 * Self-Reflection System — Execution Engine Enhancement
 *
 * Before every model call, the reflection system:
 * 1. Analyzes recent tool executions
 * 2. Detects failures and errors
 * 3. Determines if self-repair is needed
 * 4. Generates reflection context for the model
 * 5. Guides the model to fix issues instead of continuing blindly
 *
 * This prevents the model from making assumptions and ensures
 * evidence-based decision making.
 *
 * Inspired by OpenCode's conversation context reflection pattern,
 * but implemented as a dedicated reflection engine.
 */

import {
  getRecentToolObservations,
  generateExecutionSummary,
  analyzeForSelfRepair,
  shouldEnterSelfRepair,
  type SessionExecutionState,
} from "./observation-system";

export interface ReflectionContext {
  /** Whether reflection detected issues */
  hasIssues: boolean;
  /** Summary of recent activity */
  recentActivity: string;
  /** Detected errors */
  errors: string[];
  /** Suggested actions for the model */
  suggestedActions: string[];
  /** Whether self-repair mode is active */
  isSelfRepairing: boolean;
  /** Current self-repair iteration */
  repairIteration: number;
  /** Reflection prompt to inject into system message */
  reflectionPrompt: string;
}

/**
 * Generate reflection context before model call
 *
 * This analyzes recent tool executions and creates guidance
 * for the model to make informed decisions.
 */
export function generateReflectionContext(
  sessionState: SessionExecutionState,
): ReflectionContext {
  const recentObservations = getRecentToolObservations(sessionState, 10);
  const summary = generateExecutionSummary(sessionState);
  const repairAnalysis = analyzeForSelfRepair(sessionState);

  // Detect errors from recent observations
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const obs of recentObservations) {
    if (obs.status === "error" && obs.error) {
      errors.push(`[${obs.toolName}] ${obs.error}`);
    } else if (obs.status === "timeout") {
      errors.push(`[${obs.toolName}] Timeout after ${obs.durationMs}ms`);
    } else if (obs.status === "cancelled") {
      warnings.push(`[${obs.toolName}] Cancelled`);
    }
  }

  // Determine if self-repair is needed
  const needsRepair = shouldEnterSelfRepair(sessionState);
  const isSelfRepairing = sessionState.isSelfRepairing;
  const repairIteration = sessionState.selfRepairIteration;

  // Generate suggested actions
  const suggestedActions: string[] = [];

  if (errors.length > 0) {
    suggestedActions.push("CRITICAL: Recent tool executions failed. Review errors and fix before continuing.");
    suggestedActions.push(...errors.map(e => `- Error: ${e}`));
  }

  if (needsRepair && !isSelfRepairing) {
    suggestedActions.push("WARNING: Multiple failures detected. Consider entering self-repair mode.");
  }

  if (isSelfRepairing) {
    suggestedActions.push(`SELF-REPAIR ACTIVE (iteration ${repairIteration}): Focus on fixing the root cause of failures.`);
    if (repairAnalysis.suggestedActions.length > 0) {
      suggestedActions.push("Recommended actions:");
      suggestedActions.push(...repairAnalysis.suggestedActions.map(a => `- ${a}`));
    }
  }

  if (summary.recentActivity.includes("build") || summary.recentActivity.includes("compile")) {
    const buildFailed = errors.some(e => e.toLowerCase().includes("build") || e.toLowerCase().includes("compile"));
    if (buildFailed) {
      suggestedActions.push("Build/compilation failed. Fix type errors, import errors, or syntax errors before continuing.");
    }
  }

  // Generate reflection prompt
  const reflectionPrompt = buildReflectionPrompt({
    hasIssues: errors.length > 0,
    errors,
    warnings,
    suggestedActions,
    isSelfRepairing,
    repairIteration,
    summary,
  });

  return {
    hasIssues: errors.length > 0,
    recentActivity: summary.recentActivity.join(", "),
    errors,
    suggestedActions,
    isSelfRepairing,
    repairIteration,
    reflectionPrompt,
  };
}

/**
 * Build reflection prompt to inject into system message
 */
function buildReflectionPrompt(context: {
  hasIssues: boolean;
  errors: string[];
  warnings: string[];
  suggestedActions: string[];
  isSelfRepairing: boolean;
  repairIteration: number;
  summary: ReturnType<typeof generateExecutionSummary>;
}): string {
  const parts: string[] = [];

  // Self-repair mode header
  if (context.isSelfRepairing) {
    parts.push(`## SELF-REPAIR MODE (Iteration ${context.repairIteration})`);
    parts.push("");
    parts.push("You are in self-repair mode. Your primary objective is to fix the failures detected in recent tool executions.");
    parts.push("DO NOT continue with new tasks until the current failures are resolved.");
    parts.push("");
  }

  // Error analysis
  if (context.hasIssues) {
    parts.push("## CRITICAL: Recent Failures Detected");
    parts.push("");
    parts.push("The following tool executions failed:");
    parts.push("");
    for (const error of context.errors) {
      parts.push(`- ${error}`);
    }
    parts.push("");
    parts.push("Before proceeding, you MUST:");
    parts.push("1. Analyze the root cause of these failures");
    parts.push("2. Locate the affected files or configurations");
    parts.push("3. Apply targeted fixes (not broad regeneration)");
    parts.push("4. Validate the fixes by re-running the failed operations");
    parts.push("");
  }

  // Warnings
  if (context.warnings.length > 0) {
    parts.push("## Warnings");
    parts.push("");
    for (const warning of context.warnings) {
      parts.push(`- ${warning}`);
    }
    parts.push("");
  }

  // Suggested actions
  if (context.suggestedActions.length > 0) {
    parts.push("## Recommended Actions");
    parts.push("");
    for (const action of context.suggestedActions) {
      parts.push(action);
    }
    parts.push("");
  }

  // Guidance based on activity
  if (context.summary.recentActivity.includes("write") || context.summary.recentActivity.includes("edit")) {
    parts.push("## Recent File Modifications");
    parts.push("");
    parts.push("You recently modified files. Ensure that:");
    parts.push("- All imports are valid");
    parts.push("- No syntax errors were introduced");
    parts.push("- Type annotations are correct");
    parts.push("- Dependencies are properly referenced");
    parts.push("");
  }

  if (context.summary.recentActivity.includes("shell") || context.summary.recentActivity.includes("run")) {
    parts.push("## Recent Shell Executions");
    parts.push("");
    parts.push("You recently executed shell commands. Verify that:");
    parts.push("- Commands succeeded without errors");
    parts.push("- Output matches expectations");
    parts.push("- Working directory is correct");
    parts.push("- Environment variables are set");
    parts.push("");
  }

  // Decision guidance
  parts.push("## Decision Guidance");
  parts.push("");
  if (context.hasIssues) {
    parts.push("❌ DO NOT: Continue with new features or tasks");
    parts.push("✅ DO: Fix the failures first, then validate, then continue");
  } else {
    parts.push("✅ Recent executions successful. Continue with the task plan.");
  }
  parts.push("");

  return parts.join("\n");
}

/**
 * Check if reflection should trigger self-repair mode
 */
export function shouldTriggerSelfRepair(
  sessionState: SessionExecutionState,
): boolean {
  return shouldEnterSelfRepair(sessionState);
}

/**
 * Get reflection summary for logging/debugging
 */
export function getReflectionSummary(
  sessionState: SessionExecutionState,
): string {
  const context = generateReflectionContext(sessionState);
  
  const lines: string[] = [];
  lines.push(`Reflection Summary:`);
  lines.push(`- Has issues: ${context.hasIssues}`);
  lines.push(`- Errors: ${context.errors.length}`);
  lines.push(`- Self-repairing: ${context.isSelfRepairing}`);
  lines.push(`- Repair iteration: ${context.repairIteration}`);
  lines.push(`- Recent activity: ${context.recentActivity}`);
  
  if (context.suggestedActions.length > 0) {
    lines.push(`- Suggested actions:`);
    for (const action of context.suggestedActions) {
      lines.push(`  ${action}`);
    }
  }
  
  return lines.join("\n");
}
