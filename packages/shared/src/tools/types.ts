/**
 * Enhanced tool types ported from OpenCode's tool system
 *
 * These types provide the foundation for OpenCode-level tool intelligence
 * while integrating with Zenuxs-Code's existing architecture.
 */

import type { AgentTool, AgentToolContext as BaseAgentToolContext } from "../agent";

// =============================================================================
// Tool Registry & Orchestration
// =============================================================================

export interface ToolRegistryEntry {
  id: string;
  description: string;
  tool: AgentTool;
  category: "builtin" | "plugin" | "mcp" | "custom";
  enabled: boolean;
  hidden?: boolean;
}

export interface ToolRegistrySnapshot {
  entries: ToolRegistryEntry[];
  filteredIds: string[];
}

/**
 * Model-specific tool routing rule
 * Determines which tools are available for which models/providers
 */
export interface ToolRoutingRule {
  pattern: string | RegExp;
  deny?: string[];
  allow?: string[];
  replace?: Record<string, string>;
}

/**
 * Dynamic tool description evaluated at runtime
 */
export type DynamicToolDescription = (context: {
  agentName: string;
  providerId?: string;
  modelId?: string;
}) => string | Promise<string>;

// =============================================================================
// Enhanced Tool Execution
// =============================================================================

export interface ToolExecutionContext extends BaseAgentToolContext {
  agentName: string;
  providerId?: string;
  modelId?: string;
  worktree: string;
  directory: string;
  permission?: string;
}

export interface ToolExecuteResult {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
  attachments?: Array<{
    type: string;
    data: string;
    mimeType: string;
    fileName?: string;
  }>;
  isError?: boolean;
}

/**
 * Definition for the tool registry - mirrors OpenCode Tool.Def/Info pattern
 */
export interface ToolDefinition<TParameters = unknown> {
  id: string;
  description: string | DynamicToolDescription;
  parameters: Record<string, unknown>;
  execute: (
    args: TParameters,
    ctx: ToolExecutionContext,
  ) => Promise<ToolExecuteResult> | ToolExecuteResult;
  formatValidationError?: (error: unknown) => string;
  jsonSchema?: Record<string, unknown>;
}

// =============================================================================
// Tool Output Truncation (ported from OpenCode's truncate.ts)
// =============================================================================

export interface TruncationResult {
  content: string;
  truncated: boolean;
  outputPath?: string;
}

export interface TruncationConfig {
  maxLines: number;
  maxBytes: number;
  mode: "head" | "tail";
}

export const DEFAULT_TRUNCATION_CONFIG: TruncationConfig = {
  maxLines: 2000,
  maxBytes: 50 * 1024,
  mode: "head",
};

// =============================================================================
// External Directory Permission (ported from OpenCode's external-directory.ts)
// =============================================================================

export interface ExternalDirectoryCheck {
  targetPath: string;
  projectRoot: string;
  bypass?: boolean;
}

// =============================================================================
// Fuzzy Edit Matching Types (ported from OpenCode's edit.ts)
// =============================================================================

export interface EditOperation {
  filePath: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export interface EditResult {
  success: boolean;
  diff?: string;
  matchType?: string;
  contentOld?: string;
  contentNew?: string;
}

// =============================================================================
// Shell Security Scanning (ported from OpenCode's shell.ts)
// =============================================================================

export interface ShellScanResult {
  commands: string[];
  fileOperations: Array<{
    operation: "read" | "write" | "delete" | "move" | "execute";
    paths: string[];
  }>;
  hasExternalFileAccess: boolean;
  externalPaths: string[];
  dangerousPatterns: string[];
}

// =============================================================================
// Agent Configuration (ported from OpenCode's agent.ts)
// =============================================================================

export type AgentMode = "primary" | "subagent" | "all";

export interface AgentInfo {
  name: string;
  description?: string;
  mode: AgentMode;
  native?: boolean;
  hidden?: boolean;
  topP?: number;
  temperature?: number;
  color?: string;
  permission: Record<string, unknown>;
  model?: { modelId: string; providerId: string };
  variant?: string;
  prompt?: string;
  options?: Record<string, string>;
  steps?: number;
}

// =============================================================================
// Context System Types (ported from OpenCode's system-context)
// =============================================================================

export interface SystemContextSource<T = unknown> {
  key: string;
  load: () => Promise<T | typeof UNAVAILABLE>;
  baseline: (current: T) => string;
  update: (previous: T, current: T) => string;
  removed?: (previous: T) => string;
}

export const UNAVAILABLE = Symbol("SystemContextUnavailable");

export interface SystemContextSnapshot {
  baseline: string;
  snapshot: Record<string, unknown>;
}

export type ContextReconciliation =
  | { type: "unchanged" }
  | { type: "updated"; text: string; snapshot: Record<string, unknown> }
  | { type: "replacement"; text: string; snapshot: Record<string, unknown> };

// =============================================================================
// Prompt Types (ported from OpenCode prompts)
// =============================================================================

export interface AgentPrompt {
  system: string;
  explore?: string;
  compaction?: string;
  title?: string;
  summary?: string;
  generate?: string;
}
