/**
 * Execution Modes — Architecture Migration Component
 *
 * Defines execution modes that control how the agent behaves:
 * - CHAT MODE: For explanations and questions (returns text)
 * - EDIT MODE: Modifies existing files (uses filesystem tools)
 * - BUILD MODE: Creates complete projects (uses filesystem + shell + templates)
 * - AUTOMATION MODE: Runs workflows
 * - REVIEW MODE: Reviews existing code
 * - DEBUG MODE: Investigates bugs
 *
 * Each mode has specific policies for:
 * - Tool usage requirements
 * - Output format
 * - Filesystem-first vs chat-first behavior
 * - Validation requirements
 */

export type ExecutionMode =
  | "chat"
  | "edit"
  | "build"
  | "automation"
  | "review"
  | "debug";

export interface ModePolicy {
  /** Mode name */
  mode: ExecutionMode;
  /** Description */
  description: string;
  /** Whether filesystem tools are mandatory */
  filesystemFirst: boolean;
  /** Whether shell tools are mandatory */
  shellFirst: boolean;
  /** Whether chat output should only show progress (not source code) */
  progressOnly: boolean;
  /** Whether to use templates */
  useTemplates: boolean;
  /** Whether to run validation after execution */
  requiresValidation: boolean;
  /** Maximum consecutive iterations without tool usage */
  maxIdleIterations: number;
  /** System prompt additions for this mode */
  systemPromptAdditions: string[];
  /** Required tools for this mode */
  requiredTools: string[];
  /** Forbidden actions in this mode */
  forbiddenActions: string[];
}

/**
 * Chat Mode Policy
 * For explanations, questions, and informational queries.
 * Returns text responses. No filesystem modifications.
 */
export const CHAT_MODE_POLICY: ModePolicy = {
  mode: "chat",
  description: "Conversational mode for explanations and questions",
  filesystemFirst: false,
  shellFirst: false,
  progressOnly: false,
  useTemplates: false,
  requiresValidation: false,
  maxIdleIterations: 1,
  systemPromptAdditions: [
    "You are in CHAT MODE. Answer questions directly without using tools unless necessary for context.",
    "Do NOT create, modify, or delete files in this mode.",
    "Provide clear, concise explanations with code examples when helpful.",
  ],
  requiredTools: [],
  forbiddenActions: ["create_file", "edit_file", "delete_file", "run_build_commands"],
};

/**
 * Edit Mode Policy
 * For modifying existing files. Uses filesystem tools.
 * Never dumps entire files into chat.
 */
export const EDIT_MODE_POLICY: ModePolicy = {
  mode: "edit",
  description: "File editing mode for modifying existing code",
  filesystemFirst: true,
  shellFirst: false,
  progressOnly: true,
  useTemplates: false,
  requiresValidation: true,
  maxIdleIterations: 2,
  systemPromptAdditions: [
    "You are in EDIT MODE. All file modifications MUST use filesystem tools (editor, write_file).",
    "NEVER output complete file contents in chat. Only show progress and summaries.",
    "Before editing, ALWAYS read the target file to understand current state.",
    "Use targeted edits (replace, insert, delete) rather than rewriting entire files.",
    "After editing, ALWAYS verify the changes by reading the modified sections.",
    "If the edit fails, analyze the error and retry with corrected parameters.",
    "Maximum 3 retry attempts per file edit before asking for clarification.",
  ],
  requiredTools: ["read_files", "editor"],
  forbiddenActions: ["create_entire_project_in_chat", "output_full_file_contents"],
};

/**
 * Build Mode Policy
 * For creating complete projects. Uses filesystem + shell + templates.
 * MANDATORY: Never paste project source into chat.
 */
export const BUILD_MODE_POLICY: ModePolicy = {
  mode: "build",
  description: "Project creation mode for scaffolding new applications",
  filesystemFirst: true,
  shellFirst: true,
  progressOnly: true,
  useTemplates: true,
  requiresValidation: true,
  maxIdleIterations: 1,
  systemPromptAdditions: [
    "You are in BUILD MODE. You are creating a complete project from scratch.",
    "CRITICAL: NEVER output project source code in chat responses.",
    "ALL files MUST be created using filesystem tools (write_file, editor).",
    "ALL dependencies MUST be installed using shell tools (run_commands).",
    "Follow this execution sequence:",
    "  1. Create project directory structure",
    "  2. Create configuration files (package.json, tsconfig.json, etc.)",
    "  3. Create source code files (components, utilities, etc.)",
    "  4. Create asset files (styles, images, etc.)",
    "  5. Install dependencies via package manager",
    "  6. Run build/lint/typecheck to validate",
    "  7. Fix any build errors automatically",
    "  8. Report final progress summary",
    "Chat output format: ONLY show progress checkmarks (✔) and summaries.",
    "Example: '✔ Created 15 files | ✔ Installed dependencies | ✔ Build successful'",
    "NEVER show source code unless user explicitly requests a specific file.",
    "If build fails, read error messages, locate affected files, fix them, and retry.",
    "Maximum 5 build-repair iterations before reporting unresolved issues.",
    "Use templates when available for common project types (React, Next.js, Node, etc.).",
  ],
  requiredTools: ["write_file", "read_files", "run_commands", "glob", "grep"],
  forbiddenActions: [
    "output_project_source_in_chat",
    "simulate_file_creation",
    "skip_dependency_installation",
    "skip_build_validation",
  ],
};

/**
 * Automation Mode Policy
 * For running workflows, CI/CD, git operations.
 */
export const AUTOMATION_MODE_POLICY: ModePolicy = {
  mode: "automation",
  description: "Automation mode for workflows and operations",
  filesystemFirst: false,
  shellFirst: true,
  progressOnly: true,
  useTemplates: false,
  requiresValidation: true,
  maxIdleIterations: 2,
  systemPromptAdditions: [
    "You are in AUTOMATION MODE. Execute workflows and operations.",
    "Use shell tools for all command execution.",
    "Report progress after each step completion.",
    "If a command fails, analyze the error and retry or report the issue.",
    "NEVER output command results in full unless explicitly requested.",
    "Summarize outcomes: '✔ Git commit created | ✔ Branch pushed to remote'",
  ],
  requiredTools: ["run_commands"],
  forbiddenActions: ["output_full_command_logs"],
};

/**
 * Review Mode Policy
 * For code review, analysis, and auditing.
 */
export const REVIEW_MODE_POLICY: ModePolicy = {
  mode: "review",
  description: "Code review mode for analyzing existing code",
  filesystemFirst: true,
  shellFirst: false,
  progressOnly: false,
  useTemplates: false,
  requiresValidation: false,
  maxIdleIterations: 3,
  systemPromptAdditions: [
    "You are in REVIEW MODE. Analyze and review existing code.",
    "Read files to understand codebase structure and implementation.",
    "Provide structured feedback on:",
    "  - Code quality and best practices",
    "  - Potential bugs or edge cases",
    "  - Performance considerations",
    "  - Security vulnerabilities",
    "  - Architectural improvements",
    "Use read_files, search_codebase, and grep for analysis.",
    "Provide specific file references and line numbers in feedback.",
  ],
  requiredTools: ["read_files", "search_codebase", "grep"],
  forbiddenActions: ["modify_files", "create_files", "run_destructive_commands"],
};

/**
 * Debug Mode Policy
 * For investigating bugs and unexpected behavior.
 */
export const DEBUG_MODE_POLICY: ModePolicy = {
  mode: "debug",
  description: "Debug mode for investigating and fixing bugs",
  filesystemFirst: true,
  shellFirst: true,
  progressOnly: true,
  useTemplates: false,
  requiresValidation: true,
  maxIdleIterations: 2,
  systemPromptAdditions: [
    "You are in DEBUG MODE. Investigate and fix bugs.",
    "Follow systematic debugging process:",
    "  1. Reproduce the issue (if possible)",
    "  2. Read relevant source files",
    "  3. Check error logs and stack traces",
    "  4. Identify root cause",
    "  5. Implement fix using filesystem tools",
    "  6. Run tests to verify fix",
    "  7. If tests fail, analyze failures and iterate",
    "Use shell tools to run tests, check logs, and validate fixes.",
    "Report debugging progress: '✔ Identified root cause | ✔ Applied fix | ✔ Tests passing'",
    "Maximum 5 debug-repair iterations before escalating.",
  ],
  requiredTools: ["read_files", "run_commands", "editor", "grep"],
  forbiddenActions: ["output_full_source_without_context"],
};

/**
 * Mode policy registry
 */
export const MODE_POLICIES: Record<ExecutionMode, ModePolicy> = {
  chat: CHAT_MODE_POLICY,
  edit: EDIT_MODE_POLICY,
  build: BUILD_MODE_POLICY,
  automation: AUTOMATION_MODE_POLICY,
  review: REVIEW_MODE_POLICY,
  debug: DEBUG_MODE_POLICY,
};

/**
 * Get mode policy by execution mode
 */
export function getModePolicy(mode: ExecutionMode): ModePolicy {
  return MODE_POLICIES[mode];
}

/**
 * Build system prompt additions for a given mode
 */
export function buildModeSystemPrompt(mode: ExecutionMode): string {
  const policy = getModePolicy(mode);
  return [
    `# Execution Mode: ${mode.toUpperCase()}`,
    policy.description,
    "",
    ...policy.systemPromptAdditions,
  ].join("\n");
}

/**
 * Check if a tool is allowed in a given mode
 */
export function isToolAllowedInMode(
  toolName: string,
  mode: ExecutionMode,
  disabledTools?: string[]
): boolean {
  const policy = getModePolicy(mode);

  // Check if tool is forbidden
  if (policy.forbiddenActions.some(action =>
    toolName.toLowerCase().includes(action.toLowerCase())
  )) {
    return false;
  }

  // Check if tool is explicitly disabled
  if (disabledTools?.includes(toolName)) {
    return false;
  }

  return true;
}

/**
 * Get required tools for a mode
 */
export function getRequiredToolsForMode(mode: ExecutionMode): string[] {
  return getModePolicy(mode).requiredTools;
}
