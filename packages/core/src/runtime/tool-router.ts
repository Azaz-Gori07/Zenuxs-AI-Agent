/**
 * Centralized Tool Router Service
 *
 * Ported from OpenCode's tool routing architecture.
 * Provides intelligent tool selection based on intent detection and path analysis.
 *
 * Responsibilities:
 * - Route tool calls to appropriate implementations
 * - Consult Path Analyzer before execution
 * - Select file-mode vs directory-mode tools
 * - Automatic recovery and tool switching on failure
 * - Payload normalization
 * - Retry logic with compatible tool fallback
 *
 * Design Principle:
 * The LLM must never choose tools directly.
 * The Tool Router owns routing based on path type and intent.
 */

import type { PathAnalysis } from "./path-analyzer";
import { analyzePath, isEnotdirError, isRecoverableError, recoverFromEnotdir } from "./path-analyzer";

// =============================================================================
// Types
// =============================================================================

export type ToolCategory =
  | "file-read"
  | "file-write"
  | "file-edit"
  | "file-delete"
  | "file-move"
  | "file-copy"
  | "directory-list"
  | "directory-search"
  | "directory-glob"
  | "directory-tree"
  | "shell-command"
  | "unknown";

export interface ToolRoute {
  /** Tool name to execute */
  toolName: string;
  /** Tool category */
  category: ToolCategory;
  /** Normalized input payload */
  normalizedInput: Record<string, unknown>;
  /** Whether to use file mode */
  useFileMode: boolean;
  /** Whether to use directory mode */
  useDirectoryMode: boolean;
  /** Recovery strategy if tool fails */
  recoveryStrategy?: RecoveryStrategy;
}

export interface RecoveryStrategy {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Whether to switch to compatible tool on failure */
  switchToolOnFailure: boolean;
  /** Compatible fallback tools */
  fallbackTools?: string[];
  /** Whether to re-analyze path on failure */
  reanalyzePathOnFailure: boolean;
}

export interface ToolRouterConfig {
  /** Working directory */
  cwd: string;
  /** Default recovery strategy */
  defaultRecovery?: Partial<RecoveryStrategy>;
  /** Tool routing rules (custom overrides) */
  routingRules?: ToolRoutingRule[];
}

export interface ToolRoutingRule {
  /** Tool name pattern */
  pattern: string | RegExp;
  /** Force file mode */
  forceFileMode?: boolean;
  /** Force directory mode */
  forceDirectoryMode?: boolean;
  /** Override tool name */
  overrideToolName?: string;
  /** Custom recovery strategy */
  recovery?: Partial<RecoveryStrategy>;
}

export interface ToolExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Tool result */
  result?: unknown;
  /** Error if failed */
  error?: Error;
  /** Number of retries attempted */
  retries: number;
  /** Whether tool was switched */
  toolSwitched: boolean;
  /** Final tool name executed */
  finalToolName: string;
}

// =============================================================================
// Default Routing Rules
// =============================================================================

const DEFAULT_ROUTING_RULES: ToolRoutingRule[] = [
  {
    pattern: /^(read_file|read|cat)$/,
    forceFileMode: true,
    recovery: { maxRetries: 2, switchToolOnFailure: false },
  },
  {
    pattern: /^(write_file|write|create)$/,
    forceFileMode: true,
    recovery: { maxRetries: 2, switchToolOnFailure: false },
  },
  {
    pattern: /^(edit|replace|patch)$/,
    forceFileMode: true,
    recovery: { maxRetries: 3, switchToolOnFailure: false },
  },
  {
    pattern: /^(grep|search|find_content)$/,
    forceFileMode: false, // Can be file or directory
    forceDirectoryMode: false,
    recovery: { maxRetries: 3, switchToolOnFailure: true, fallbackTools: ["grep", "read"] },
  },
  {
    pattern: /^(glob|find_files|list_files)$/,
    forceDirectoryMode: true,
    recovery: { maxRetries: 2, switchToolOnFailure: false },
  },
  {
    pattern: /^(delete|remove|rm)$/,
    forceFileMode: true,
    recovery: { maxRetries: 1, switchToolOnFailure: false },
  },
  {
    pattern: /^(move|rename|mv)$/,
    forceFileMode: true,
    recovery: { maxRetries: 2, switchToolOnFailure: false },
  },
  {
    pattern: /^(copy|cp)$/,
    forceFileMode: true,
    recovery: { maxRetries: 2, switchToolOnFailure: false },
  },
];

// =============================================================================
// Tool Router
// =============================================================================

export class ToolRouter {
  private config: Required<ToolRouterConfig>;
  /**
   * TTL cache for path analysis results.
   * Avoids redundant filesystem stat calls when the same path
   * is analyzed multiple times within a short window (e.g. repeated
   * tool calls on the same file).
   */
  private pathCache = new Map<string, { analysis: PathAnalysis; expiresAt: number }>();
  private readonly PATH_CACHE_TTL_MS = 2000; // 2s TTL
  private readonly PATH_CACHE_MAX = 256;

  constructor(config: ToolRouterConfig) {
    this.config = {
      cwd: config.cwd,
      defaultRecovery: {
        maxRetries: 3,
        switchToolOnFailure: true,
        fallbackTools: [],
        reanalyzePathOnFailure: true,
        ...config.defaultRecovery,
      },
      routingRules: [...DEFAULT_ROUTING_RULES, ...(config.routingRules || [])],
    };
  }

  /**
   * Analyze a path with TTL caching. Returns cached result if
   * the same path was analyzed within the TTL window.
   */
  private async cachedAnalyzePath(targetPath: string): Promise<PathAnalysis> {
    const now = Date.now();
    const cached = this.pathCache.get(targetPath);
    if (cached && cached.expiresAt > now) {
      return cached.analysis;
    }
    const analysis = await analyzePath(targetPath, { cwd: this.config.cwd });
    // Evict oldest if full
    if (this.pathCache.size >= this.PATH_CACHE_MAX) {
      const firstKey = this.pathCache.keys().next().value;
      if (firstKey !== undefined) this.pathCache.delete(firstKey);
    }
    this.pathCache.set(targetPath, {
      analysis,
      expiresAt: now + this.PATH_CACHE_TTL_MS,
    });
    return analysis;
  }

  /** Clear the path analysis cache. */
  clearPathCache(): void {
    this.pathCache.clear();
  }

  /**
   * Route a tool call based on path analysis and intent.
   * This is the main entry point for all tool execution.
   */
  async route(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolRoute> {
    // Step 1: Find matching routing rule
    const rule = this.findRoutingRule(toolName);

    // Step 2: Extract path from input
    const targetPath = this.extractPath(input);

    // Step 3: Analyze path (if applicable) — uses TTL cache
    let pathAnalysis: PathAnalysis | null = null;
    if (targetPath) {
      pathAnalysis = await this.cachedAnalyzePath(targetPath);
    }

    // Step 4: Determine execution mode
    const { useFileMode, useDirectoryMode } = this.determineExecutionMode(
      toolName,
      pathAnalysis,
      rule,
    );

    // Step 5: Normalize input payload
    const normalizedInput = this.normalizeInput(toolName, input, pathAnalysis);

    // Step 6: Build recovery strategy
    const recoveryStrategy = this.buildRecoveryStrategy(toolName, rule);

    // Step 7: Determine final tool name
    const finalToolName = rule?.overrideToolName || toolName;

    // Step 8: Determine category
    const category = this.determineCategory(finalToolName, pathAnalysis);

    return {
      toolName: finalToolName,
      category,
      normalizedInput,
      useFileMode,
      useDirectoryMode,
      recoveryStrategy,
    };
  }

  /**
   * Execute a tool with automatic recovery.
   */
  async execute(
    toolName: string,
    input: Record<string, unknown>,
    executor: (name: string, normalizedInput: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ToolExecutionResult> {
    // Step 1: Route the tool call
    const route = await this.route(toolName, input);

    let retries = 0;
    let toolSwitched = false;
    let currentToolName = route.toolName;
    let currentInput = route.normalizedInput;

    // Step 2: Execute with retry logic
    while (retries <= (route.recoveryStrategy?.maxRetries ?? 3)) {
      try {
        // Execute the tool
        const result = await executor(currentToolName, currentInput);

        return {
          success: true,
          result,
          retries,
          toolSwitched,
          finalToolName: currentToolName,
        };
      } catch (error) {
        // Step 3: Check if error is recoverable
        if (!isRecoverableError(error)) {
          // Non-recoverable error - fail immediately
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            retries,
            toolSwitched,
            finalToolName: currentToolName,
          };
        }

        // Step 4: Handle ENOTDIR specifically
        if (isEnotdirError(error)) {
          const recoveredAnalysis = await this.handleEnotdirRecovery(
            this.extractPath(input),
          );

          if (recoveredAnalysis) {
            // Re-route with correct path analysis
            const newRoute = await this.route(toolName, input);
            currentToolName = newRoute.toolName;
            currentInput = newRoute.normalizedInput;
          }
        }

        // Step 5: Check if we should switch tools
        if (route.recoveryStrategy?.switchToolOnFailure && route.recoveryStrategy?.fallbackTools) {
          const fallbackIndex = retries % route.recoveryStrategy.fallbackTools.length;
          const fallbackTool = route.recoveryStrategy.fallbackTools[fallbackIndex];

          if (fallbackTool && fallbackTool !== currentToolName) {
            currentToolName = fallbackTool;
            toolSwitched = true;
          }
        }

        // Step 6: Re-analyze path if configured (uses cache)
        if (route.recoveryStrategy?.reanalyzePathOnFailure) {
          const targetPath = this.extractPath(input);
          if (targetPath) {
            const newPathAnalysis = await this.cachedAnalyzePath(targetPath);
            currentInput = this.normalizeInput(toolName, input, newPathAnalysis);
          }
        }

        retries++;
      }
    }

    // Exhausted all retries
    return {
      success: false,
      error: new Error(`Tool ${toolName} failed after ${retries} retries`),
      retries,
      toolSwitched,
      finalToolName: currentToolName,
    };
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Find matching routing rule for tool name.
   */
  private findRoutingRule(toolName: string): ToolRoutingRule | undefined {
    for (const rule of this.config.routingRules) {
      const pattern = rule.pattern;
      if (typeof pattern === "string") {
        if (pattern === toolName) return rule;
      } else {
        if (pattern.test(toolName)) return rule;
      }
    }
    return undefined;
  }

  /**
   * Extract target path from tool input.
   */
  private extractPath(input: Record<string, unknown>): string | null {
    // Common path parameter names
    const pathKeys = ["path", "filePath", "file", "target", "targetPath", "dir", "directory"];

    for (const key of pathKeys) {
      if (typeof input[key] === "string") {
        return input[key] as string;
      }
    }

    return null;
  }

  /**
   * Determine execution mode based on path analysis and routing rules.
   */
  private determineExecutionMode(
    toolName: string,
    pathAnalysis: PathAnalysis | null,
    rule?: ToolRoutingRule,
  ): { useFileMode: boolean; useDirectoryMode: boolean } {
    // Check routing rule overrides first
    if (rule?.forceFileMode) {
      return { useFileMode: true, useDirectoryMode: false };
    }
    if (rule?.forceDirectoryMode) {
      return { useFileMode: false, useDirectoryMode: true };
    }

    // Use path analysis if available
    if (pathAnalysis) {
      return {
        useFileMode: pathAnalysis.routingHint.isFile,
        useDirectoryMode: pathAnalysis.routingHint.isDirectory,
      };
    }

    // Default to flexible mode (can handle both)
    return { useFileMode: false, useDirectoryMode: false };
  }

  /**
   * Normalize input payload based on path analysis.
   */
  private normalizeInput(
    _toolName: string,
    input: Record<string, unknown>,
    pathAnalysis: PathAnalysis | null,
  ): Record<string, unknown> {
    // If no path analysis, return input as-is
    if (!pathAnalysis) {
      return input;
    }

    // Normalize path to absolute path
    const normalizedInput = { ...input };

    // Update path parameters with absolute path
    const pathKeys = ["path", "filePath", "file", "target", "targetPath"];
    for (const key of pathKeys) {
      if (typeof normalizedInput[key] === "string") {
        normalizedInput[key] = pathAnalysis.absolutePath;
      }
    }

    return normalizedInput;
  }

  /**
   * Build recovery strategy for tool.
   */
  private buildRecoveryStrategy(
    toolName: string,
    rule?: ToolRoutingRule,
  ): RecoveryStrategy {
    const defaultStrategy = this.config.defaultRecovery;
    const ruleRecovery = rule?.recovery || {};

    return {
      maxRetries: ruleRecovery.maxRetries ?? defaultStrategy.maxRetries ?? 3,
      switchToolOnFailure: ruleRecovery.switchToolOnFailure ?? defaultStrategy.switchToolOnFailure ?? true,
      fallbackTools: ruleRecovery.fallbackTools ?? defaultStrategy.fallbackTools ?? [],
      reanalyzePathOnFailure: ruleRecovery.reanalyzePathOnFailure ?? defaultStrategy.reanalyzePathOnFailure ?? true,
    };
  }

  /**
   * Determine tool category based on tool name and path analysis.
   */
  private determineCategory(
    toolName: string,
    pathAnalysis: PathAnalysis | null,
  ): ToolCategory {
    // File operations
    if (/^(read|cat)$/.test(toolName)) return "file-read";
    if (/^(write|create)$/.test(toolName)) return "file-write";
    if (/^(edit|replace|patch)$/.test(toolName)) return "file-edit";
    if (/^(delete|remove|rm)$/.test(toolName)) return "file-delete";
    if (/^(move|rename|mv)$/.test(toolName)) return "file-move";
    if (/^(copy|cp)$/.test(toolName)) return "file-copy";

    // Directory operations
    if (/^(list|ls|tree)$/.test(toolName)) return "directory-list";
    if (/^(glob|find_files|list_files)$/.test(toolName)) return "directory-glob";

    // Search operations (can be file or directory)
    if (/^(grep|search|find_content)$/.test(toolName)) {
      if (pathAnalysis?.routingHint.isFile) return "directory-search";
      if (pathAnalysis?.routingHint.isDirectory) return "directory-search";
      return "directory-search"; // Flexible
    }

    // Shell commands
    if (/^(bash|shell|exec|run)$/.test(toolName)) return "shell-command";

    return "unknown";
  }

  /**
   * Handle ENOTDIR error recovery.
   */
  private async handleEnotdirRecovery(targetPath: string | null): Promise<PathAnalysis | null> {
    if (!targetPath) return null;

    try {
      return await recoverFromEnotdir(targetPath, { cwd: this.config.cwd });
    } catch {
      return null;
    }
  }

  /**
   * Update routing rules.
   */
  updateRules(rules: ToolRoutingRule[]): void {
    this.config.routingRules = [...DEFAULT_ROUTING_RULES, ...rules];
  }

  /**
   * Update default recovery strategy.
   */
  updateRecovery(recovery: Partial<RecoveryStrategy>): void {
    this.config.defaultRecovery = { ...this.config.defaultRecovery, ...recovery };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Tool Router instance.
 */
export function createToolRouter(config: ToolRouterConfig): ToolRouter {
  return new ToolRouter(config);
}
