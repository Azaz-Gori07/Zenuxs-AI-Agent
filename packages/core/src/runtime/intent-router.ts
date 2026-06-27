/**
 * Intent Router — Architecture Migration Component
 *
 * Routes every user request through an intent classification layer before
 * the LLM produces output. This prevents build/project creation requests
 * from being treated as conversational chat tasks.
 *
 * Supported intent categories:
 * - Information, Explanation, Code Review, Debug
 * - Build New Project, Modify Existing Project
 * - UI Generation, API Generation, Backend Generation, Fullstack Generation
 * - File Edit, Documentation, Testing, DevOps
 * - Git Operations, Shell Operations, Automation
 */

export type IntentCategory =
  // Conversational intents (return text via chat)
  | "information"
  | "explanation"
  | "code_review"
  | "debug"

  // Engineering intents (require filesystem/shell execution)
  | "build_project"
  | "modify_project"
  | "ui_generation"
  | "api_generation"
  | "backend_generation"
  | "fullstack_generation"
  | "file_edit"
  | "documentation"
  | "testing"
  | "devops"
  | "git_operations"
  | "shell_operations"
  | "automation";

export type ExecutionMode =
  | "chat"        // Explanations, questions → returns text
  | "edit"        // Modifies existing files → uses filesystem tools
  | "build"       // Creates complete projects → uses filesystem + shell + templates
  | "automation"  // Runs workflows → uses automation engine
  | "review"      // Reviews code → uses read/analysis tools
  | "debug";      // Investigates bugs → uses read/shell/diagnostic tools

export interface IntentClassification {
  /** The classified intent category */
  intent: IntentCategory;
  /** The execution mode to use */
  mode: ExecutionMode;
  /** Confidence score (0-1) */
  confidence: number;
  /** Extracted technology hints (e.g., "react", "nextjs", "mern") */
  technologyHints: string[];
  /** Extracted project name if applicable */
  projectName?: string;
  /** Whether this is a new project or modifying existing */
  isNewProject: boolean;
  /** Rationale for the classification (for debugging) */
  rationale: string;
}

/**
 * Build trigger keywords that automatically route to Build Mode
 */
const BUILD_TRIGGER_KEYWORDS = [
  "create", "build", "generate", "develop", "clone", "scaffold",
  "make", "design", "start", "bootstrap", "initialize", "init",
  "setup", "new project", "new app", "new website", "new api",
];

/**
 * Edit trigger keywords that route to Edit Mode
 */
const EDIT_TRIGGER_KEYWORDS = [
  "edit", "modify", "update", "change", "fix", "refactor",
  "improve", "add feature", "remove", "rename", "move",
];

/**
 * Debug trigger keywords
 */
const DEBUG_TRIGGER_KEYWORDS = [
  "debug", "fix bug", "error", "not working", "broken",
  "why is", "what's wrong", "troubleshoot", "investigate",
];

/**
 * Technology detection patterns
 */
const TECHNOLOGY_PATTERNS: Record<string, RegExp> = {
  react: /\breact\b/i,
  nextjs: /\bnext\.?js\b/i,
  vue: /\bvue\.?js\b|\bvue\b/i,
  angular: /\bangular\b/i,
  node: /\bnode\.?js\b|\bnode\b/i,
  express: /\bexpress\b/i,
  mongodb: /\bmongo[\s-]?db\b|\bmongodb\b/i,
  postgresql: /\bpostgres(?:ql)?\b/i,
  mysql: /\bmysql\b/i,
  typescript: /\btype\s*script\b|\bts\b/i,
  python: /\bpython\b|\bflask\b|\bdjango\b/i,
  electron: /\belectron\b/i,
  tailwind: /\btailwind\b/i,
  vite: /\bvite\b/i,
  webpack: /\bwebpack\b/i,
  docker: /\bdocker\b/i,
  kubernetes: /\bkubernetes\b|\bk8s\b/i,
};

/**
 * Classify the user's intent from their message
 */
export function classifyIntent(message: string, context?: {
  hasExistingProject?: boolean;
  workspaceFiles?: string[];
  projectType?: string;
  frameworks?: string[];
}): IntentClassification {
  const lowerMessage = message.toLowerCase().trim();

  // Check for build triggers
  const hasBuildTrigger = BUILD_TRIGGER_KEYWORDS.some(keyword =>
    lowerMessage.includes(keyword)
  );

  // Check for edit triggers
  const hasEditTrigger = EDIT_TRIGGER_KEYWORDS.some(keyword =>
    lowerMessage.includes(keyword)
  );

  // Check for debug triggers
  const hasDebugTrigger = DEBUG_TRIGGER_KEYWORDS.some(keyword =>
    lowerMessage.includes(keyword)
  );

  // Extract technology hints
  const technologyHints: string[] = [];
  for (const [tech, pattern] of Object.entries(TECHNOLOGY_PATTERNS)) {
    if (pattern.test(lowerMessage)) {
      technologyHints.push(tech);
    }
  }

  // Add workspace-detected technologies
  if (context?.frameworks) {
    for (const framework of context.frameworks) {
      if (!technologyHints.includes(framework)) {
        technologyHints.push(framework);
      }
    }
  }
  if (context?.projectType && !technologyHints.includes(context.projectType)) {
    technologyHints.push(context.projectType);
  }

  // Extract project name (heuristic: text after "create/build" and before technology keywords)
  const projectName = extractProjectName(lowerMessage);

  // Determine if this is a new project
  const hasExistingProject = context?.hasExistingProject ?? false;
  const isNewProject = hasBuildTrigger && !hasExistingProject;

  // If modifying existing project, adjust intent
  let adjustedIntent: IntentCategory | undefined;
  if (hasEditTrigger && hasExistingProject) {
    adjustedIntent = "modify_project";
  }

  // Classify intent
  let intent: IntentCategory;
  let mode: ExecutionMode;
  let confidence: number;
  let rationale: string;

  if (hasBuildTrigger) {
    // Build intent - determine what kind of project
    if (technologyHints.includes("react") || technologyHints.includes("nextjs") ||
        technologyHints.includes("vue") || technologyHints.includes("angular")) {
      if (technologyHints.includes("node") || technologyHints.includes("express") ||
          technologyHints.includes("mongodb")) {
        intent = "fullstack_generation";
        rationale = "Fullstack project detected (frontend + backend technologies)";
      } else {
        intent = "ui_generation";
        rationale = "UI/frontend framework detected";
      }
    } else if (technologyHints.includes("node") || technologyHints.includes("express") ||
               technologyHints.includes("python")) {
      intent = technologyHints.includes("mongodb") || technologyHints.includes("postgresql") ||
               technologyHints.includes("mysql")
        ? "backend_generation"
        : "api_generation";
      rationale = "Backend/API technologies detected";
    } else {
      intent = "build_project";
      rationale = "Build trigger keywords detected without specific technology hints";
    }
    mode = "build";
    confidence = 0.9;
  } else if (adjustedIntent) {
    // Modified project intent
    intent = adjustedIntent;
    mode = "edit";
    confidence = 0.85;
    rationale = "Edit trigger with existing project detected";
  } else if (hasDebugTrigger) {
    intent = "debug";
    mode = "debug";
    confidence = 0.85;
    rationale = "Debug/error investigation keywords detected";
  } else if (hasEditTrigger) {
    intent = "file_edit";
    mode = "edit";
    confidence = 0.8;
    rationale = "File modification keywords detected";
  } else if (lowerMessage.includes("test") || lowerMessage.includes("unit test") ||
             lowerMessage.includes("integration test")) {
    intent = "testing";
    mode = "build"; // Testing requires filesystem operations
    confidence = 0.75;
    rationale = "Testing keywords detected";
  } else if (lowerMessage.includes("document") || lowerMessage.includes("readme") ||
             lowerMessage.includes("comment")) {
    intent = "documentation";
    mode = "edit";
    confidence = 0.7;
    rationale = "Documentation keywords detected";
  } else if (lowerMessage.includes("git") || lowerMessage.includes("commit") ||
             lowerMessage.includes("push") || lowerMessage.includes("branch")) {
    intent = "git_operations";
    mode = "automation";
    confidence = 0.8;
    rationale = "Git operation keywords detected";
  } else if (lowerMessage.includes("deploy") || lowerMessage.includes("docker") ||
             lowerMessage.includes("ci/cd") || lowerMessage.includes("pipeline")) {
    intent = "devops";
    mode = "automation";
    confidence = 0.75;
    rationale = "DevOps keywords detected";
  } else if (lowerMessage.includes("review") || lowerMessage.includes("analyze") ||
             lowerMessage.includes("audit")) {
    intent = "code_review";
    mode = "review";
    confidence = 0.8;
    rationale = "Code review keywords detected";
  } else if (lowerMessage.includes("automate") || lowerMessage.includes("workflow") ||
             lowerMessage.includes("cron") || lowerMessage.includes("schedule")) {
    intent = "automation";
    mode = "automation";
    confidence = 0.75;
    rationale = "Automation keywords detected";
  } else {
    // Default to information/explanation for conversational queries
    intent = lowerMessage.includes("how") || lowerMessage.includes("what") ||
             lowerMessage.includes("why") || lowerMessage.includes("explain")
      ? "explanation"
      : "information";
    mode = "chat";
    confidence = 0.6;
    rationale = "No specific engineering intent detected; treating as informational query";
  }

  return {
    intent,
    mode,
    confidence,
    technologyHints,
    projectName,
    isNewProject,
    rationale,
  };
}

/**
 * Extract project name from message (heuristic)
 */
function extractProjectName(message: string): string | undefined {
  // Patterns like "create a [project name] with/using/for"
  const patterns = [
    /(?:create|build|generate|make)\s+(?:a|an|the)\s+([\w\s-]+?)\s+(?:with|using|for|in|that)/i,
    /(?:create|build|generate|make)\s+(?:a|an|the)\s+([\w\s-]+?)(?:\.|\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  }

  return undefined;
}

/**
 * Get technology-specific recommendations based on intent
 */
export function recommendTechnology(intent: IntentCategory, hints: string[]): {
  framework: string;
  buildTool: string;
  language: string;
} {
  const hasHint = (tech: string) => hints.includes(tech);

  // React projects
  if (hasHint("react")) {
    if (hasHint("nextjs")) {
      return { framework: "nextjs", buildTool: "next", language: "typescript" };
    }
    return { framework: "react", buildTool: "vite", language: "typescript" };
  }

  // Vue projects
  if (hasHint("vue")) {
    return { framework: "vue", buildTool: "vite", language: "typescript" };
  }

  // Angular projects
  if (hasHint("angular")) {
    return { framework: "angular", buildTool: "angular-cli", language: "typescript" };
  }

  // Node/Express backend
  if (hasHint("node") || hasHint("express")) {
    return { framework: "express", buildTool: "npm", language: "typescript" };
  }

  // Python backend
  if (hasHint("python")) {
    if (hasHint("django")) {
      return { framework: "django", buildTool: "pip", language: "python" };
    }
    if (hasHint("flask")) {
      return { framework: "flask", buildTool: "pip", language: "python" };
    }
    return { framework: "fastapi", buildTool: "pip", language: "python" };
  }

  // MERN stack
  if (hasHint("mongodb") && (hasHint("react") || hasHint("node"))) {
    return { framework: "mern", buildTool: "npm", language: "typescript" };
  }

  // Electron
  if (hasHint("electron")) {
    return { framework: "electron", buildTool: "electron-forge", language: "typescript" };
  }

  // Static HTML/CSS/JS
  if (intent === "ui_generation" || intent === "build_project") {
    return { framework: "html", buildTool: "none", language: "javascript" };
  }

  // Default
  return { framework: "react", buildTool: "vite", language: "typescript" };
}
