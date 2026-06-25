/**
 * Enhanced Tools Index
 *
 * Factory to create all enhanced tools with OpenCode-level intelligence.
 * Integrates with Zenuxs-Code's existing tool infrastructure.
 */

import type { AgentTool } from "@cline/shared";
import { ToolRegistry, type ToolFilterContext, type ToolRegistration, DoomLoopDetector } from "./registry";
import { createEnhancedFileReadTool, type CreateEnhancedFileReadOptions } from "./file-read-enhanced";
import { createEnhancedWriteTool, createEnhancedEditorTool, type CreateEnhancedEditorOptions } from "./editor-enhanced";
import { createEnhancedGlobTool, createEnhancedGrepTool } from "./glob-grep-enhanced";
import { createEnhancedShellTool, type CreateEnhancedShellOptions } from "./shell-enhanced";
import { createWebFetchTool, createWebSearchTool } from "./web-enhanced";
import { createTodoWriteTool, createPlanExitTool, type TodoService } from "./todo-enhanced";

// =============================================================================
// Types
// =============================================================================

export interface CreateAllEnhancedToolsOptions {
  cwd: string;
  todoService?: TodoService;
  shell?: Partial<CreateEnhancedShellOptions>;
  fileRead?: Partial<CreateEnhancedFileReadOptions>;
  editor?: Partial<CreateEnhancedEditorOptions>;
  webFetchTimeout?: number;
  enableWebSearch?: boolean;
  enablePlanExit?: boolean;
  mode?: "plan" | "build" | "act";
  disabledTools?: string[];
  enabledTools?: string[];
}

// =============================================================================
// Create All Enhanced Tools
// =============================================================================

export function createAllEnhancedTools(options: CreateAllEnhancedToolsOptions): {
  tools: AgentTool[];
  registry: ToolRegistry;
  doomDetector: DoomLoopDetector;
} {
  const { cwd, mode, disabledTools = [], enabledTools } = options;
  const registry = new ToolRegistry();
  const doomDetector = new DoomLoopDetector();

  const filterContext: ToolFilterContext = {
    mode,
    disabledToolIds: new Set(disabledTools),
    enabledToolIds: enabledTools ? new Set(enabledTools) : undefined,
  };

  // Create all tools
  const readTool = createEnhancedFileReadTool({ cwd, ...options.fileRead });
  const writeTool = createEnhancedWriteTool({ cwd, ...options.editor });
  const editTool = createEnhancedEditorTool({ cwd, ...options.editor });
  const globTool = createEnhancedGlobTool({ cwd });
  const grepTool = createEnhancedGrepTool({ cwd });
  const shellTool = createEnhancedShellTool({ cwd, ...options.shell });
  const fetchTool = createWebFetchTool({ defaultTimeout: options.webFetchTimeout });
  const searchTool = options.enableWebSearch ? createWebSearchTool() : undefined;
  const todoTool = createTodoWriteTool(options.todoService);
  const planExitTool = options.enablePlanExit ? createPlanExitTool() : undefined;

  // Register all tools
  const registrations: ToolRegistration[] = [
    { id: "read", tool: readTool, category: "builtin", enabled: true },
    { id: "write", tool: writeTool, category: "builtin", enabled: true, modelFilter: (_providerId, modelId) => {
      // Apply_patch replaces write/edit for some GPT models
      return !(modelId.includes("gpt-4-turbo") || modelId.includes("gpt-4-32k"));
    }},
    { id: "edit", tool: editTool, category: "builtin", enabled: true, modelFilter: (_providerId, modelId) => {
      return !(modelId.includes("gpt-4-turbo") || modelId.includes("gpt-4-32k"));
    }},
    { id: "glob", tool: globTool, category: "builtin", enabled: true },
    { id: "grep", tool: grepTool, category: "builtin", enabled: true },
    { id: "bash", tool: shellTool, category: "builtin", enabled: true },
    { id: "webfetch", tool: fetchTool, category: "builtin", enabled: true },
    { id: "todowrite", tool: todoTool, category: "builtin", enabled: true },
  ];

  if (searchTool) {
    registrations.push({ id: "websearch", tool: searchTool, category: "builtin", enabled: true });
  }

  if (planExitTool) {
    registrations.push({ id: "plan_exit", tool: planExitTool, category: "builtin", enabled: true });
  }

  registry.registerAll(registrations);

  // Filter by context
  const tools = registry.filter(filterContext);

  return { tools, registry, doomDetector };
}

// Re-export all individual tool creators for consumers
export { createEnhancedFileReadTool } from "./file-read-enhanced";
export { createEnhancedWriteTool, createEnhancedEditorTool } from "./editor-enhanced";
export { createEnhancedGlobTool, createEnhancedGrepTool } from "./glob-grep-enhanced";
export { createEnhancedShellTool } from "./shell-enhanced";
export { createWebFetchTool, createWebSearchTool } from "./web-enhanced";
export { createTodoWriteTool, createPlanExitTool } from "./todo-enhanced";
export type { TodoService } from "./todo-enhanced";
