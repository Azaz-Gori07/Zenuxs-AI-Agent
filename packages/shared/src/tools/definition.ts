/**
 * Enhanced tool definition types and factory — ported from OpenCode's LLM tool model.
 *
 * Provides:
 *  - `ToolDefinition` — canonical description of a tool (name, description, JSON Schema)
 *  - `Tool.make()` — typed + dynamic tool construction
 *  - `Tool.toDefinitions()` — convert a tools record to definition arrays
 *  - `ToolRuntime.dispatch()` — execute a tool call against registered tools
 */

import type { AgentTool, AgentToolContext } from "../agent";

// =============================================================================
// Types
// =============================================================================

export interface ToolDefinitionShape {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  cache?: "ephemeral" | "persistent";
  metadata?: Record<string, unknown>;
  /** Provider-native tool metadata passthrough (e.g., Anthropic's `type: "web_search"`) */
  native?: Record<string, unknown>;
}

export interface ToolCallInfo {
  id: string;
  name: string;
}

export type ToolExecuteFn<TInput, TOutput> = (
  params: TInput,
  context: AgentToolContext,
) => Promise<TOutput> | TOutput;

export type ToolToModelOutput<TOutput> = (
  input: { callID: string; parameters: unknown; output: TOutput },
) => Array<{ type: "text"; text: string }>;

export interface ToolOutputContent {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
  isError?: boolean;
  attachments?: Array<{
    type: string;
    data: string;
    mimeType: string;
    fileName?: string;
  }>;
}

export interface ToolSettlement {
  result: { type: "json" | "text" | "error"; value: unknown };
  output?: ToolOutputContent;
}

export interface DispatchResult extends ToolSettlement {
  events: Array<{
    type: "tool-result" | "tool-error";
    id: string;
    name: string;
    result: { type: "json" | "text" | "error"; value: unknown };
    output?: ToolOutputContent;
    error?: unknown;
  }>;
}

// =============================================================================
// Tool interface — the enhanced shape that tools implement
// =============================================================================

export interface EnhancedTool<TInput = unknown, TOutput = unknown> {
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly execute?: ToolExecuteFn<TInput, TOutput>;
  readonly toModelOutput?: ToolToModelOutput<TOutput>;
  readonly toStructuredOutput?: (output: TOutput) => unknown;
  /** @internal Cached definition for serialization */
  readonly _definition: ToolDefinitionShape;
}

export type AnyEnhancedTool = EnhancedTool<any, any>;

export type EnhancedTools = Record<string, AnyEnhancedTool>;

// =============================================================================
// Tool choice — control model tool selection behavior
// =============================================================================

export type ToolChoiceMode = "auto" | "none" | "required";

export interface ToolChoice {
  type: ToolChoiceMode | "tool";
  name?: string;
}

export namespace ToolChoice {
  export const auto: ToolChoice = { type: "auto" };
  export const none: ToolChoice = { type: "none" };
  export const required: ToolChoice = { type: "required" };
  export const named = (name: string): ToolChoice => ({ type: "tool", name });

  export const make = (input: ToolChoice | ToolDefinitionShape | string): ToolChoice => {
    if (typeof input === "string") {
      if (input === "auto" || input === "none" || input === "required") {
        return { type: input };
      }
      return named(input);
    }
    if ("type" in input && (input.type === "auto" || input.type === "none" || input.type === "required" || input.type === "tool")) {
      return input as ToolChoice;
    }
    if ("name" in input && typeof (input as ToolDefinitionShape).name === "string") {
      return named((input as ToolDefinitionShape).name);
    }
    return auto;
  };
}

// =============================================================================
// Tool factory
// =============================================================================

export function make<TInput, TOutput>(config: {
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute: ToolExecuteFn<TInput, TOutput>;
  toModelOutput?: ToolToModelOutput<TOutput>;
  toStructuredOutput?: (output: TOutput) => unknown;
}): EnhancedTool<TInput, TOutput>;

export function make(config: {
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute?: undefined;
  toModelOutput?: ToolToModelOutput<unknown>;
  toStructuredOutput?: (output: unknown) => unknown;
}): EnhancedTool<unknown, unknown>;

export function make(config: {
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute?: ToolExecuteFn<unknown, unknown>;
  toModelOutput?: ToolToModelOutput<unknown>;
  toStructuredOutput?: (output: unknown) => unknown;
}): AnyEnhancedTool {
  const definition: ToolDefinitionShape = {
    name: "",
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
  };

  return {
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: config.execute,
    toModelOutput: config.toModelOutput,
    toStructuredOutput: config.toStructuredOutput,
    _definition: definition,
  };
}

/** Create a dynamic tool from a JSON Schema (for MCP, plugins, etc.) */
export function makeDynamic(config: {
  description: string;
  jsonSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute?: (params: unknown, context: AgentToolContext) => Promise<unknown>;
  toModelOutput?: ToolToModelOutput<unknown>;
  toStructuredOutput?: (output: unknown) => unknown;
}): AnyEnhancedTool {
  if (config.execute) {
    return make({
      description: config.description,
      inputSchema: config.jsonSchema,
      outputSchema: config.outputSchema,
      execute: config.execute as ToolExecuteFn<unknown, unknown>,
      toModelOutput: config.toModelOutput,
      toStructuredOutput: config.toStructuredOutput,
    });
  }
  return make({
    description: config.description,
    inputSchema: config.jsonSchema,
    outputSchema: config.outputSchema,
    toModelOutput: config.toModelOutput,
    toStructuredOutput: config.toStructuredOutput,
  });
}

/**
 * Convert a tools record into ToolDefinitionShape[].
 * Tool names come from the record keys.
 */
export function toDefinitions(tools: EnhancedTools): ToolDefinitionShape[] {
  return Object.entries(tools).map(([name, item]) => ({
    name,
    description: item._definition.description,
    inputSchema: item._definition.inputSchema,
    outputSchema: item._definition.outputSchema,
  }));
}

/**
 * Wrap an AgentTool into an EnhancedTool for uniform handling.
 */
export function fromAgentTool(name: string, tool: AgentTool): AnyEnhancedTool {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: tool.execute as ToolExecuteFn<unknown, unknown>,
    _definition: {
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
  };
}
