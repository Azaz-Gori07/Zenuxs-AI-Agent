/**
 * Agent System - Ported from OpenCode's agent.ts and prompts
 *
 * Includes:
 * - Built-in agents (build, plan, general, explore, compaction, title, summary)
 * - Subagent permission derivation
 * - Agent generation prompt
 * - All system prompts
 * - Agent configuration loading
 */

import type { AgentMode } from "@cline/shared";
import { PermissionChecker } from "../tools/registry";

// =============================================================================
// Prompts (ported verbatim from OpenCode)
// =============================================================================

/**
 * Explore Agent Prompt (ported from opencode/agent/prompt/explore.txt)
 */
export const PROMPT_EXPLORE = `You are a file search specialist. You excel at thoroughly navigating and exploring codebases.

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents

Guidelines:
- Use Glob for broad file pattern matching
- Use Grep for searching file contents with regex
- Use Read when you know the specific file path you need to read
- Use Bash for file operations like copying, moving, or listing directory contents
- Adapt your search approach based on the thoroughness level specified by the caller
- Return file paths as absolute paths in your final response
- For clear communication, avoid using emojis
- Do not create any files, or run bash commands that modify the user's system state in any way

Complete the user's search request efficiently and report your findings clearly.`;

/**
 * Compaction Agent Prompt (ported from opencode/agent/prompt/compaction.txt)
 */
export const PROMPT_COMPACTION = `You are an anchored context summarization assistant for coding sessions.

Summarize only the conversation history you are given. The newest turns may be kept verbatim outside your summary, so focus on the older context that still matters for continuing the work.

If the prompt includes a <previous-summary> block, treat it as the current anchored summary. Update it with the new history by preserving still-true details, removing stale details, and merging in new facts.

Always follow the exact output structure requested by the user prompt. Keep every section, preserve exact file paths and identifiers when known, and prefer terse bullets over paragraphs.

Do not answer the conversation itself. Do not mention that you are summarizing, compacting, or merging context. Respond in the same language as the conversation.`;

/**
 * Title Generation Prompt (ported from opencode/agent/prompt/title.txt)
 */
export const PROMPT_TITLE = `You are a title generator. You output ONLY a thread title. Nothing else.

<task>
Generate a brief title that would help the user find this conversation later.

Follow all rules in <rules>
Use the <examples> so you know what a good title looks like.
Your output must be:
- A single line
- ≤50 characters
- No explanations
</task>

<rules>
- you MUST use the same language as the user message you are summarizing
- Title must be grammatically correct and read naturally - no word salad
- Never include tool names in the title (e.g. "read tool", "bash tool", "edit tool")
- Focus on the main topic or question the user needs to retrieve
- Vary your phrasing - avoid repetitive patterns like always starting with "Analyzing"
- When a file is mentioned, focus on WHAT the user wants to do WITH the file, not just that they shared it
- Keep exact: technical terms, numbers, filenames, HTTP codes
- Remove: the, this, my, a, an
- Never assume tech stack
- Never use tools
- NEVER respond to questions, just generate a title for the conversation
- The title should NEVER include "summarizing" or "generating" when generating a title
- DO NOT SAY YOU CANNOT GENERATE A TITLE OR COMPLAIN ABOUT THE INPUT
- Always output something meaningful, even if the input is minimal.
- If the user message is short or conversational (e.g. "hello", "lol", "what's up", "hey"):
  → create a title that reflects the user's tone or intent (such as Greeting, Quick check-in, Light chat, Intro message, etc.)
</rules>

<examples>
"debug 500 errors in production" → Debugging production 500 errors
"refactor user service" → Refactoring user service
"why is app.js failing" → app.js failure investigation
"implement rate limiting" → Rate limiting implementation
"how do I connect postgres to my API" → Postgres API connection
"best practices for React hooks" → React hooks best practices
</examples>`;

/**
 * Summary Agent Prompt (ported from opencode/agent/prompt/summary.txt)
 */
export const PROMPT_SUMMARY = `Summarize what was done in this conversation. Write like a pull request description.

Rules:
- 2-3 sentences max
- Describe the changes made, not the process
- Do not mention running tests, builds, or other validation steps
- Do not explain what the user asked for
- Write in first person (I added..., I fixed...)
- Never ask questions or add new questions
- If the conversation ends with an unanswered question to the user, preserve that exact question
- If the conversation ends with an imperative statement or request to the user (e.g. "Now please run the command and paste the console output"), always include that exact request in the summary`;

/**
 * Agent Generation Prompt (ported from opencode/agent/generate.txt)
 */
export const PROMPT_GENERATE = `You are an elite AI agent architect specializing in crafting high-performance agent configurations. Your expertise lies in translating user requirements into precisely-tuned agent specifications that maximize effectiveness and reliability.

**Important Context**: You may have access to project-specific instructions from CLAUDE.md files and other context that may include coding standards, project structure, and custom requirements. Consider this context when creating agents to ensure they align with the project's established patterns and practices.

When a user describes what they want an agent to do, you will:

1. **Extract Core Intent**: Identify the fundamental purpose, key responsibilities, and success criteria for the agent. Look for both explicit requirements and implicit needs. Consider any project-specific context from CLAUDE.md files. For agents that are meant to review code, you should assume that the user is asking to review recently written code and not the whole codebase, unless the user has explicitly instructed you otherwise.

2. **Design Expert Persona**: Create a compelling expert identity that embodies deep domain knowledge relevant to the task. The persona should inspire confidence and guide the agent's decision-making approach.

3. **Architect Comprehensive Instructions**: Develop a system prompt that:
   - Establishes clear behavioral boundaries and operational parameters
   - Provides specific methodologies and best practices for task execution
   - Anticipates edge cases and provides guidance for handling them
   - Incorporates any specific requirements or preferences mentioned by the user
   - Defines output format expectations when relevant
   - Aligns with project-specific coding standards and patterns from CLAUDE.md

4. **Optimize for Performance**: Include decision-making frameworks, quality control mechanisms, efficient workflow patterns, and escalation strategies.

5. **Create Identifier**: Design a concise, descriptive identifier using lowercase letters, numbers, and hyphens only, typically 2-4 words, clearly indicating the agent's primary function.

Your output must be a valid JSON object with exactly these fields:
{
"identifier": "unique-descriptive-identifier",
"whenToUse": "Use this agent when... with examples",
"systemPrompt": "Complete behavioral instructions in second person"
}`;

// =============================================================================
// Compaction Summary Template (ported from opencode/core/session/compaction.ts)
// =============================================================================

export const SUMMARY_TEMPLATE = `## Goal
{What was the overall objective?}

## Constraints & Preferences
{What constraints were identified?}

## Progress
- **Done**: {What has been completed?}
- **In Progress**: {What is currently being worked on?}
- **Blocked**: {What is blocked and why?}

## Key Decisions
{What important decisions were made?}

## Next Steps
{What needs to be done next?}

## Critical Context
{What context is critical for continuing?}

## Relevant Files
{Which files are most relevant?}
`;

// =============================================================================
// Agent Configuration (ported from opencode/agent/agent.ts)
// =============================================================================

export interface AgentConfigEntry {
  name: string;
  description: string;
  mode: AgentMode;
  hidden?: boolean;
  native?: boolean;
  temperature?: number;
  prompt?: string;
  permission: Record<string, unknown>;
}

/**
 * Built-in agent definitions mirroring OpenCode's agent system
 */
export function createBuiltinAgents(): AgentConfigEntry[] {
  return [
    {
      name: "build",
      description: "The default agent. Executes tools based on configured permissions.",
      mode: "coder" as any,
      native: true,
      permission: {
        "*": "allow",
        doom_loop: "ask",
        external_directory: { "*": "ask" },
        question: "allow",
        plan_enter: "allow",
        plan_exit: "deny",
        read: { "*": "allow", "*.env": "ask", "*.env.*": "ask", "*.env.example": "allow" },
      },
    },
    {
      name: "plan",
      description: "Plan mode. Disallows all edit tools.",
      mode: "architect" as any,
      native: true,
      permission: {
        "*": "allow",
        doom_loop: "ask",
        external_directory: { "*": "ask" },
        question: "allow",
        plan_enter: "deny",
        plan_exit: "allow",
        task: { general: "deny" },
        edit: { "*": "deny", ".opencode/plans/*.md": "allow" },
        write: { "*": "deny", ".opencode/plans/*.md": "allow" },
      },
    },
    {
      name: "general",
      description: "General-purpose agent for researching complex questions and executing multi-step tasks.",
      mode: "ask" as any,
      native: true,
      permission: {
        "*": "allow",
        doom_loop: "ask",
        external_directory: { "*": "ask" },
        todowrite: "deny",
      },
    },
    {
      name: "explore",
      description: "Fast agent specialized for exploring codebases. Use for file searches, code analysis, and codebase questions.",
      mode: "ask" as any,
      native: true,
      prompt: PROMPT_EXPLORE,
      permission: {
        "*": "deny",
        grep: "allow",
        glob: "allow",
        bash: "allow",
        read: "allow",
        webfetch: "allow",
        websearch: "allow",
        external_directory: { "*": "ask" },
      },
    },
    {
      name: "compaction",
      description: "Context compaction agent (internal use).",
      mode: "architect" as any,
      hidden: true,
      native: true,
      prompt: PROMPT_COMPACTION,
      permission: { "*": "deny" },
    },
    {
      name: "title",
      description: "Title generation agent (internal use).",
      mode: "architect" as any,
      hidden: true,
      native: true,
      temperature: 0.5,
      prompt: PROMPT_TITLE,
      permission: { "*": "deny" },
    },
    {
      name: "summary",
      description: "Conversation summary agent (internal use).",
      mode: "architect" as any,
      hidden: true,
      native: true,
      prompt: PROMPT_SUMMARY,
      permission: { "*": "deny" },
    },
  ];
}

// =============================================================================
// Agent Service
// =============================================================================

export class AgentService {
  private agents = new Map<string, AgentConfigEntry>();

  constructor() {
    // Register built-in agents
    for (const agent of createBuiltinAgents()) {
      this.agents.set(agent.name, agent);
    }
  }

  get(name: string): AgentConfigEntry | undefined {
    return this.agents.get(name);
  }

  list(): AgentConfigEntry[] {
    return [...this.agents.values()].filter((a) => !a.hidden);
  }

  listAll(): AgentConfigEntry[] {
    return [...this.agents.values()];
  }

  register(config: AgentConfigEntry): void {
    this.agents.set(config.name, config);
  }

  getDefault(): AgentConfigEntry {
    return this.agents.get("build")!;
  }

  getSubagents(): AgentConfigEntry[] {
    return this.listAll().filter((a) => a.mode === ("ask" as any) || a.mode === ("architect" as any));
  }
}

// =============================================================================
// Subagent Permission Derivation (ported from opencode/agent/subagent-permissions.ts)
// =============================================================================

/**
 * Derive permissions for a subagent session
 * - Inherits parent's deny rules and external_directory rules
 * - Denies todowrite if not explicitly permitted
 * - Denies task (recursive spawning) if not explicitly permitted
 */
export function deriveSubagentSessionPermission(
  parentPermission: Record<string, unknown>,
  subagentPermission: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...parentPermission };

  // Inherit the parent's deny rules
  for (const [key, value] of Object.entries(parentPermission)) {
    if (value === "deny" || (typeof value === "object" && value !== null)) {
      result[key] = value;
    }
  }

  // Apply subagent-specific rules on top
  for (const [key, value] of Object.entries(subagentPermission)) {
    result[key] = value;
  }

  // Deny todowrite unless subagent explicitly allows it
  if (subagentPermission.todowrite !== "allow") {
    result.todowrite = "deny";
  }

  // Deny task unless subagent explicitly allows it
  if (subagentPermission.task !== "allow") {
    result.task = "deny";
  }

  return result;
}

// =============================================================================
// Permission Evaluation (ported from opencode/permission/)
// =============================================================================

export type PermissionAction = "allow" | "deny" | "ask";

export function evaluatePermission(
  ruleset: Record<string, unknown>,
  permission: string,
  target?: string,
): PermissionAction {
  const checker = new PermissionChecker("allow");

  for (const [key, value] of Object.entries(ruleset)) {
    if (typeof value === "string") {
      checker.addRule(key, value as PermissionAction);
    } else if (typeof value === "object" && value !== null) {
      // Nested rules: key is the permission type, value is target-specific rules
      if (key === permission || key === "*") {
        const nested = value as Record<string, unknown>;
        for (const [pattern, action] of Object.entries(nested)) {
          if (!target || pattern === "*") {
            checker.addRule(permission, action as PermissionAction);
          } else if (matchWildcard(pattern, target)) {
            return action as PermissionAction;
          }
        }
      }
    }
  }

  return checker.check(permission, target);
}

function matchWildcard(pattern: string, target: string): boolean {
  const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  return regex.test(target);
}
