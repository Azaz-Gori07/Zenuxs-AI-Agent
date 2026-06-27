/**
 * Tool Chain Orchestrator — Execution Engine Enhancement
 *
 * Enables automatic tool chaining:
 *   Tool A → Tool B → Tool C → Validation → Repair → Complete
 *
 * Instead of LLM manually simulating tool behavior, the orchestrator:
 * 1. Executes tools in sequence
 * 2. Captures observations after each tool
 * 3. Validates intermediate results
 * 4. Auto-repairs on failure
 * 5. Continues to next tool or retries
 *
 * This matches OpenCode's FiberSet isolation + ToolOutputStore settlement pattern,
 * but uses Promise-based approach compatible with Zenuxs architecture.
 */

import {
  captureObservation,
  analyzeForSelfRepair,
  type ToolObservation,
  type SessionExecutionState,
} from "./observation-system";

export interface ToolChainStep {
  /** Tool name to execute */
  toolName: string;
  /** Input to pass to the tool */
  input: unknown;
  /** Whether this step is required (optional steps can be skipped) */
  required?: boolean;
  /** Validation function to check if step succeeded */
  validate?: (observation: ToolObservation) => boolean;
  /** Repair function to fix failures before retry */
  repair?: (observation: ToolObservation) => Promise<unknown>;
  /** Maximum retry attempts for this step */
  maxRetries?: number;
}

export interface ToolChainConfig {
  /** Session ID for observation tracking */
  sessionId: string;
  /** Tool executor function */
  executeTool: (toolName: string, input: unknown) => Promise<ToolObservation>;
  /** Session state for observation capture */
  sessionState: SessionExecutionState;
  /** Whether to enable automatic repair */
  enableAutoRepair?: boolean;
  /** Callback when chain completes */
  onComplete?: (results: ToolChainResult) => void;
  /** Callback when chain fails */
  onFailure?: (error: Error, step: ToolChainStep, observation?: ToolObservation) => void;
}

export interface ToolChainResult {
  /** Whether the chain completed successfully */
  success: boolean;
  /** All observations from the chain */
  observations: ToolObservation[];
  /** Step that failed (if any) */
  failedStep?: ToolChainStep;
  /** Error message (if failed) */
  error?: string;
  /** Total execution time in ms */
  totalDurationMs: number;
  /** Number of retries performed */
  totalRetries: number;
}

/**
 * Execute a chain of tools with observation, validation, and self-repair
 */
export async function executeToolChain(
  config: ToolChainConfig,
  steps: ToolChainStep[],
): Promise<ToolChainResult> {
  const startTime = Date.now();
  const observations: ToolObservation[] = [];
  let totalRetries = 0;

  for (const step of steps) {
    const maxRetries = step.maxRetries ?? 3;
    let attempt = 0;
    let stepSuccess = false;
    let lastObservation: ToolObservation | undefined;

    while (attempt <= maxRetries && !stepSuccess) {
      attempt++;

      try {
        // Execute tool
        const observation = await config.executeTool(step.toolName, step.input);
        lastObservation = observation;

        // Capture observation
        captureObservation(config.sessionState, observation);
        observations.push(observation);

        // Check if tool execution was successful
        if (observation.status !== "success") {
          throw new Error(
            `Tool ${step.toolName} failed: ${observation.error?.message ?? "Unknown error"}`,
          );
        }

        // Validate result if validator provided
        if (step.validate && !step.validate(observation)) {
          throw new Error(`Validation failed for ${step.toolName}`);
        }

        stepSuccess = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // If we have retries left and auto-repair is enabled, try to repair
        if (attempt < maxRetries && config.enableAutoRepair && step.repair && lastObservation) {
          try {
            const repairedInput = await step.repair(lastObservation);
            // Update input for next attempt
            step.input = repairedInput;
            totalRetries++;

            console.log(
              `[ToolChain] Repairing ${step.toolName} (attempt ${attempt}/${maxRetries})`,
            );
            continue;
          } catch (repairError) {
            console.warn(`[ToolChain] Repair failed for ${step.toolName}:`, repairError);
          }
        }

        // If this is a required step and we've exhausted retries, fail the chain
        if (step.required !== false && attempt >= maxRetries) {
          const result: ToolChainResult = {
            success: false,
            observations,
            failedStep: step,
            error: `Step "${step.toolName}" failed after ${maxRetries} attempts: ${errorMessage}`,
            totalDurationMs: Date.now() - startTime,
            totalRetries,
          };

          config.onFailure?.(
            new Error(result.error),
            step,
            lastObservation,
          );

          return result;
        }

        // If optional step, continue to next
        if (step.required === false) {
          console.warn(`[ToolChain] Optional step "${step.toolName}" failed, skipping`);
          break;
        }
      }
    }

    // If we exited without success and step was required, fail
    if (!stepSuccess && step.required !== false) {
      return {
        success: false,
        observations,
        failedStep: step,
        error: `Step "${step.toolName}" failed after ${maxRetries} attempts`,
        totalDurationMs: Date.now() - startTime,
        totalRetries,
      };
    }
  }

  // All steps completed successfully
  const result: ToolChainResult = {
    success: true,
    observations,
    totalDurationMs: Date.now() - startTime,
    totalRetries,
  };

  config.onComplete?.(result);
  return result;
}

/**
 * Common tool chain patterns
 */

/**
 * File modification chain: Search → Read → Edit → Write → Validate
 */
export function createFileModificationChain(
  config: ToolChainConfig,
  filePath: string,
  searchPattern: string,
  editOperation: (content: string) => string,
): ToolChainStep[] {
  let fileContent = "";

  return [
    {
      toolName: "grep",
      input: { pattern: searchPattern, path: filePath },
      required: true,
      validate: (obs) => obs.status === "success",
    },
    {
      toolName: "read",
      input: { path: filePath },
      required: true,
      validate: (obs) => {
        // Extract content from observation metadata
        fileContent = (obs.metadata?.content as string) ?? "";
        return fileContent.length > 0;
      },
    },
    {
      toolName: "edit",
      input: {
        path: filePath,
        content: editOperation(fileContent),
      },
      required: true,
      validate: (obs) => obs.status === "success",
      repair: async (obs) => {
        // Re-read file and retry
        return { path: filePath, content: editOperation(fileContent) };
      },
    },
  ];
}

/**
 * Build validation chain: Install → Build → Lint → Typecheck
 */
export function createBuildValidationChain(
  config: ToolChainConfig,
): ToolChainStep[] {
  return [
    {
      toolName: "bash",
      input: { command: "npm install" },
      required: true,
      validate: (obs) => obs.exitCode === 0,
      repair: async () => ({ command: "npm install --legacy-peer-deps" }),
    },
    {
      toolName: "bash",
      input: { command: "npm run build" },
      required: true,
      validate: (obs) => obs.exitCode === 0,
      repair: async (obs) => {
        // Parse error from stderr and suggest fix
        const stderr = obs.stderr ?? "";
        console.log(`[ToolChain] Build failed:`, stderr.slice(0, 200));
        return { command: "npm run build" }; // Retry after manual inspection
      },
    },
    {
      toolName: "bash",
      input: { command: "npm run lint" },
      required: false, // Lint failures are warnings, not blockers
      validate: (obs) => obs.exitCode === 0,
    },
    {
      toolName: "bash",
      input: { command: "npx tsc --noEmit" },
      required: false,
      validate: (obs) => obs.exitCode === 0,
    },
  ];
}

/**
 * Project generation chain: Create → Install → Build → Validate
 */
export function createProjectGenerationChain(
  config: ToolChainConfig,
  projectName: string,
  template: string,
): ToolChainStep[] {
  return [
    {
      toolName: "bash",
      input: { command: `mkdir -p ${projectName}` },
      required: true,
    },
    {
      toolName: "write",
      input: {
        path: `${projectName}/package.json`,
        content: generatePackageJson(projectName, template),
      },
      required: true,
    },
    {
      toolName: "bash",
      input: { command: `cd ${projectName} && npm install` },
      required: true,
      validate: (obs) => obs.exitCode === 0,
      repair: async () => ({ command: `cd ${projectName} && npm install --legacy-peer-deps` }),
    },
    {
      toolName: "bash",
      input: { command: `cd ${projectName} && npm run build` },
      required: true,
      validate: (obs) => obs.exitCode === 0,
    },
  ];
}

/**
 * Generate package.json content based on template
 */
function generatePackageJson(projectName: string, template: string): string {
  const basePackage = {
    name: projectName,
    version: "1.0.0",
    private: true,
  };

  const templates: Record<string, any> = {
    "react-vite-ts": {
      ...basePackage,
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
    },
    "nextjs": {
      ...basePackage,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "14.2.5",
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
    },
    "node-express": {
      ...basePackage,
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsc",
        start: "node dist/index.js",
      },
      dependencies: {
        express: "^4.19.2",
      },
    },
  };

  return JSON.stringify(templates[template] ?? basePackage, null, 2);
}

/**
 * Analyze tool chain results for self-repair insights
 */
export function analyzeChainResults(
  result: ToolChainResult,
): {
  needsRepair: boolean;
  suggestedActions: string[];
  failedTools: string[];
} {
  if (result.success) {
    return { needsRepair: false, suggestedActions: [], failedTools: [] };
  }

  const failedTools = result.observations
    .filter((obs) => obs.status === "error")
    .map((obs) => obs.toolName);

  const suggestedActions: string[] = [];

  // Analyze failure patterns
  for (const obs of result.observations) {
    if (obs.status === "error" && obs.error) {
      if (obs.error.message.includes("ENOENT")) {
        suggestedActions.push("File not found. Check if file exists before reading/editing.");
      } else if (obs.error.message.includes("EACCES")) {
        suggestedActions.push("Permission denied. Check file permissions.");
      } else if (obs.exitCode !== undefined && obs.exitCode !== 0) {
        suggestedActions.push(
          `Command exited with code ${obs.exitCode}. Check stderr for details.`,
        );
      }
    }
  }

  // Check for repeated failures
  const failureCounts = new Map<string, number>();
  for (const tool of failedTools) {
    failureCounts.set(tool, (failureCounts.get(tool) ?? 0) + 1);
  }

  for (const [tool, count] of failureCounts) {
    if (count >= 3) {
      suggestedActions.push(
        `Tool "${tool}" failed ${count} times. Consider alternative approach.`,
      );
    }
  }

  return {
    needsRepair: failedTools.length > 0,
    suggestedActions,
    failedTools,
  };
}
