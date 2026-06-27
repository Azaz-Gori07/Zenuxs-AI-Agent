/**
 * Tool execution dispatch — ported from OpenCode's ToolRuntime.
 *
 * Handles one canonical tool-call at a time:
 *  - Looks up the named tool
 *  - Optionally validates input against JSON Schema
 *  - Executes the handler
 *  - Returns a structured result (success or error)
 */

import type { AgentToolCallPart, AgentToolContext } from "../agent";
import type { DispatchResult, EnhancedTools, ToolSettlement } from "./definition";

// =============================================================================
// Simple JSON Schema validation (lightweight, no external deps)
// =============================================================================

interface ValidationError {
  path: string;
  message: string;
}

/**
 * Minimal JSON Schema validator for tool inputs.
 * Checks top-level property types and required fields.
 * For full validation, use zod-to-json-schema or ajv.
 */
function validateInput(
  input: unknown,
  schema: Record<string, unknown>,
): ValidationError | null {
  if (!schema || typeof schema !== "object") return null;
  if (input === null || input === undefined) {
    if (schema.type === "object" || (schema as any).type === "object") {
      return { path: "", message: "Expected object, got null/undefined" };
    }
    return null;
  }

  const s = schema as Record<string, unknown>;

  // Check required properties
  const required: string[] = Array.isArray(s.required) ? s.required : [];
  if (required.length > 0 && typeof input !== "object") {
    return { path: "", message: `Expected object with required properties, got ${typeof input}` };
  }

  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    for (const prop of required) {
      if (!(prop in obj) || obj[prop] === undefined) {
        return { path: prop, message: `Missing required property: "${prop}"` };
      }
    }

    // Type-check properties against schema
    const properties: Record<string, unknown> = (s.properties as Record<string, unknown>) ?? {};
    for (const [key, value] of Object.entries(obj)) {
      const propSchema = properties[key] as Record<string, unknown> | undefined;
      if (!propSchema) continue;
      const propType = propSchema.type as string | undefined;
      if (propType && value !== null && value !== undefined) {
        const actualType = Array.isArray(value) ? "array" : typeof value;
        if (propType === "array" && actualType !== "array") {
          return { path: key, message: `Expected array, got ${actualType}` };
        }
        if (propType === "object" && actualType !== "object") {
          return { path: key, message: `Expected object, got ${actualType}` };
        }
        if (["string", "number", "boolean", "integer"].includes(propType) && actualType !== propType) {
          // Allow integer as number
          if (!(propType === "integer" && actualType === "number")) {
            return { path: key, message: `Expected ${propType}, got ${actualType}` };
          }
        }
      }
    }
  }

  return null;
}

// =============================================================================
// Dispatch
// =============================================================================

interface DispatchErrorEvent {
  type: "tool-error";
  id: string;
  name: string;
  result: { type: "error"; value: unknown };
  error?: unknown;
}

function settlementFromError(
  call: { id: string; name: string },
  message: string,
  error?: unknown,
): { settlement: ToolSettlement; errorEvent: DispatchErrorEvent } {
  const settlement: ToolSettlement = {
    result: { type: "error", value: message },
  };
  return {
    settlement,
    errorEvent: { type: "tool-error", id: call.id, name: call.name, result: { type: "error", value: message }, error },
  };
}

/**
 * Dispatch a single tool call against registered tools.
 *
 * @param tools - Record of registered tools
 * @param call - The tool call to execute
 * @param context - Agent tool execution context
 * @returns DispatchResult with settlement and events
 */
export async function dispatch(
  tools: EnhancedTools,
  call: Pick<AgentToolCallPart, "toolCallId" | "toolName" | "input">,
  context: AgentToolContext,
): Promise<DispatchResult> {
  const callInfo = { id: call.toolCallId, name: call.toolName };

  // Look up the tool
  const tool = tools[call.toolName];
  if (!tool) {
    const { settlement, errorEvent } = settlementFromError(
      callInfo,
      `Unknown tool: ${call.toolName}`,
    );
    return { ...settlement, events: [errorEvent] };
  }

  if (!tool.execute) {
    const { settlement, errorEvent } = settlementFromError(
      callInfo,
      `Tool has no execute handler: ${call.toolName}`,
    );
    return { ...settlement, events: [errorEvent] };
  }

  // Validate input
  if (call.input === null || call.input === undefined || (typeof call.input === "object" && Object.keys(call.input).length === 0)) {
    const { settlement, errorEvent } = settlementFromError(
      callInfo,
      `Tool call arguments are empty for "${call.toolName}". Tool calls must include valid JSON arguments.`,
    );
    return { ...settlement, events: [errorEvent] };
  }

  const validationError = validateInput(call.input, tool.inputSchema);
  if (validationError) {
    const { settlement, errorEvent } = settlementFromError(
      callInfo,
      `Invalid tool input for "${call.toolName}": ${validationError.message}`,
    );
    return { ...settlement, events: [errorEvent] };
  }

  // Execute the tool
  try {
    const decoded = call.input; // Input is already decoded by the runtime
    const result = await tool.execute(decoded, {
      ...context,
      toolCallId: call.toolCallId,
    });

    // Encode the result
    let encoded = result;
    if (tool.toStructuredOutput) {
      encoded = tool.toStructuredOutput(result);
    }

    const outputText = typeof result === "string"
      ? result
      : JSON.stringify(result, null, 2);

    const settlement: ToolSettlement = {
      result: { type: "json", value: encoded },
      output: {
        title: `Tool result: ${call.toolName}`,
        output: outputText,
      },
    };

    return {
      ...settlement,
      events: [
        {
          type: "tool-result",
          id: call.toolCallId,
          name: call.toolName,
          result: settlement.result,
          output: settlement.output,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { settlement, errorEvent } = settlementFromError(callInfo, message, error);
    return { ...settlement, events: [errorEvent] };
  }
}

/**
 * Dispatch multiple tool calls, optionally in parallel.
 * Handles sequential and parallel execution modes.
 */
export async function dispatchAll(
  tools: EnhancedTools,
  calls: Array<Pick<AgentToolCallPart, "toolCallId" | "toolName" | "input">>,
  context: AgentToolContext,
  parallel: boolean = false,
): Promise<DispatchResult[]> {
  if (parallel) {
    return Promise.all(
      calls.map((call) => dispatch(tools, call, context)),
    );
  }

  const results: DispatchResult[] = [];
  for (const call of calls) {
    results.push(await dispatch(tools, call, context));
  }
  return results;
}

export const ToolRuntime = { dispatch, dispatchAll } as const;
