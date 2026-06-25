/**
 * Tool Registry - Ported from OpenCode's registry.ts
 *
 * Provides tool registration, model-specific filtering, and orchestration.
 * Uses Zenuxs-Code's existing AgentTool type while adding OpenCode's
 * registry intelligence (dynamic descriptions, model routing, plugin tools).
 */

import type { AgentTool, AgentToolDefinition } from "@cline/shared";

// =============================================================================
// Types
// =============================================================================

export interface ToolRegistration {
  id: string;
  tool: AgentTool;
  category: "builtin" | "plugin" | "mcp";
  enabled: boolean;
  hidden?: boolean;
  modelFilter?: (providerId: string, modelId: string) => boolean;
}

export interface ToolRegistrySnapshot {
  tools: AgentTool[];
  registrations: ToolRegistration[];
}

export interface ToolFilterContext {
  providerId?: string;
  modelId?: string;
  agentName?: string;
  mode?: "plan" | "build" | "act";
  enabledToolIds?: ReadonlySet<string>;
  disabledToolIds?: ReadonlySet<string>;
}

// =============================================================================
// Doom Loop Detection (ported from OpenCode's session/processor.ts)
// =============================================================================

const DOOM_LOOP_THRESHOLD = 3;

function normalizeToolInput(input: unknown): string {
  return JSON.stringify(input);
}

export interface DoomLoopState {
  key: string;
  count: number;
  lastCallId?: string;
}

export class DoomLoopDetector {
  private history = new Map<string, number>();

  check(toolName: string, input: unknown): boolean {
    const key = `${toolName}:${normalizeToolInput(input)}`;
    const count = (this.history.get(key) ?? 0) + 1;
    this.history.set(key, count);
    return count >= DOOM_LOOP_THRESHOLD;
  }

  reset(): void {
    this.history.clear();
  }
}

// =============================================================================
// Tool Registry
// =============================================================================

export class ToolRegistry {
  private registrations = new Map<string, ToolRegistration>();
  private doomDetector = new DoomLoopDetector();

  register(tool: ToolRegistration): void {
    this.registrations.set(tool.id, tool);
  }

  registerAll(tools: ToolRegistration[]): void {
    for (const t of tools) {
      this.register(t);
    }
  }

  unregister(id: string): boolean {
    return this.registrations.delete(id);
  }

  get(id: string): ToolRegistration | undefined {
    return this.registrations.get(id);
  }

  getTool(id: string): AgentTool | undefined {
    return this.registrations.get(id)?.tool;
  }

  list(): ToolRegistration[] {
    return [...this.registrations.values()];
  }

  /**
   * Filter tools by context (model, agent, mode, enabled/disabled sets)
   */
  filter(context: ToolFilterContext): AgentTool[] {
    let tools = this.list();

    // Filter by enabled/disabled sets
    if (context.enabledToolIds && context.enabledToolIds.size > 0) {
      tools = tools.filter((t) => context.enabledToolIds!.has(t.id));
    }
    if (context.disabledToolIds && context.disabledToolIds.size > 0) {
      tools = tools.filter((t) => !context.disabledToolIds!.has(t.id));
    }

    // Filter disabled registrations
    tools = tools.filter((t) => t.enabled);

    // Filter by model
    if (context.providerId && context.modelId) {
      tools = tools.filter(
        (t) => !t.modelFilter || t.modelFilter(context.providerId!, context.modelId!),
      );
    }

    // Filter by mode
    if (context.mode === "plan") {
      tools = tools.filter((t) => t.id !== "edit" && t.id !== "write" && t.id !== "apply_patch");
    }

    return tools.map((t) => t.tool);
  }

  /**
   * Get all tools (for tool registration listing)
   */
  all(): AgentTool[] {
    return this.list().map((t) => t.tool);
  }

  /**
   * Get tool definitions in LLM-compatible format
   */
  definitions(): AgentToolDefinition[] {
    return this.all().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      lifecycle: t.lifecycle,
    }));
  }

  /**
   * Check if a tool call is a doom loop
   */
  isDoomLoop(toolName: string, input: unknown): boolean {
    return this.doomDetector.check(toolName, input);
  }

  resetDoomDetection(): void {
    this.doomDetector.reset();
  }

  snapshot(): ToolRegistrySnapshot {
    return {
      tools: this.all(),
      registrations: this.list(),
    };
  }
}

// =============================================================================
// Permission Checker (ported from OpenCode's permission system)
// =============================================================================

export type PermissionAction = "allow" | "deny" | "ask";

export interface PermissionRule {
  pattern: string;
  action: PermissionAction;
}

export class PermissionChecker {
  private rules: PermissionRule[] = [];

  constructor(defaultAction: PermissionAction = "allow") {
    this.rules.push({ pattern: "*", action: defaultAction });
  }

  addRule(pattern: string, action: PermissionAction): void {
    this.rules.push({ pattern, action });
  }

  check(permission: string, target?: string): PermissionAction {
    for (const rule of this.rules) {
      if (this.match(rule.pattern, permission, target)) {
        return rule.action;
      }
    }
    return "deny";
  }

  private match(pattern: string, permission: string, target?: string): boolean {
    if (pattern === "*") return true;
    if (pattern === permission) return true;
    if (target && pattern.startsWith("*.") && target.endsWith(pattern.slice(1))) return true;
    if (target && this.wildcardMatch(pattern, target)) return true;
    return false;
  }

  private wildcardMatch(pattern: string, target: string): boolean {
    const regex = new RegExp(
      "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
    );
    return regex.test(target);
  }

  isAllowed(permission: string, target?: string): boolean {
    return this.check(permission, target) === "allow";
  }

  isDenied(permission: string, target?: string): boolean {
    return this.check(permission, target) === "deny";
  }
}

// =============================================================================
// External Directory Permission (ported from OpenCode's external-directory.ts)
// =============================================================================

import path from "path";

/**
 * Check if a file path is within the project directory.
 * If it's outside, it needs special permission.
 */
export function isExternalDirectory(
  targetPath: string,
  projectRoot: string,
): boolean {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(projectRoot);
  return !resolved.startsWith(root + path.sep) && resolved !== root;
}

/**
 * Get paths relative to project root for permission prompts
 */
export function getRelativePatterns(
  paths: string[],
  projectRoot: string,
): string[] {
  return paths.map((p) => path.relative(projectRoot, path.resolve(p)));
}

// =============================================================================
// Console output for permission request
// =============================================================================

export function formatPermissionRequest(permission: string, patterns: string[]): string {
  const header = `\x1b[33m[Permission Required]\x1b[0m ${permission}`;
  const files = patterns.map((p) => `  \x1b[36m${p}\x1b[0m`).join("\n");
  return `${header}\n${files}`;
}
