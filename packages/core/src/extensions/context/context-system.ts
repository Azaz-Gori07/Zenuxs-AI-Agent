/**
 * Context System - Ported from OpenCode's SystemContext algebra and compaction
 *
 * Features ported:
 * - SystemContext algebra: typed sources, initialize/reconcile/replace lifecycle
 * - Context sources: environment, date, instructions, skills, references
 * - Context epoch management with snapshots
 * - Context compaction with overflow detection
 * - Session history compaction with tail preservation
 * - Compaction summary template
 * - Auto-compaction loop
 */

import * as os from "os";

// =============================================================================
// SystemContext Algebra (ported from opencode/core/system-context/index.ts)
// =============================================================================

export const UNAVAILABLE = Symbol("SystemContextUnavailable");
export type Unavailable = typeof UNAVAILABLE;

export interface ContextSource<T = unknown> {
  key: string;
  load: () => Promise<T | Unavailable>;
  baseline: (current: T) => string;
  update: (previous: T, current: T) => string;
  removed?: (previous: T) => string;
}

export interface ContextGeneration {
  baseline: string;
  snapshot: Record<string, unknown>;
}

export class SystemContext {
  private sources: ContextSource<any>[] = [];

  add<T>(source: ContextSource<T>): void {
    const existing = this.sources.find((s) => s.key === source.key);
    if (existing) {
      throw new Error(`Duplicate context source key: ${source.key}`);
    }
    this.sources.push(source);
  }

  addAll(...sources: ContextSource<any>[]): void {
    for (const s of sources) this.add(s);
  }

  async initialize(): Promise<ContextGeneration> {
    const baselineParts: string[] = [];
    const snapshot: Record<string, unknown> = {};

    for (const source of this.sources) {
      const value = await source.load();
      if (value === UNAVAILABLE) {
        throw new Error(`Context source unavailable: ${source.key}`);
      }
      baselineParts.push(source.baseline(value as any));
      snapshot[source.key] = value;
    }

    return {
      baseline: baselineParts.join("\n\n"),
      snapshot,
    };
  }

  async reconcile(previous: ContextGeneration): Promise<{
    type: "unchanged" | "updated";
    text?: string;
    snapshot?: Record<string, unknown>;
  }> {
    const updates: string[] = [];
    const newSnapshot: Record<string, unknown> = {};
    let changed = false;

    for (const source of this.sources) {
      const value = await source.load();
      if (value === UNAVAILABLE) continue;

      newSnapshot[source.key] = value;
      const prevValue = previous.snapshot[source.key];

      if (prevValue !== undefined && JSON.stringify(prevValue) !== JSON.stringify(value)) {
        updates.push(source.update(prevValue as any, value as any));
        changed = true;
      } else if (prevValue === undefined) {
        updates.push(source.baseline(value as any));
        changed = true;
      }
    }

    if (!changed) return { type: "unchanged" };

    return {
      type: "updated",
      text: updates.join("\n\n"),
      snapshot: newSnapshot,
    };
  }
}

// =============================================================================
// Built-in Context Sources (ported from opencode/core/system-context/builtins.ts)
// =============================================================================

export function createEnvironmentSource(cwd: string): ContextSource<string> {
  return {
    key: "core/environment",
    async load() {
      const parts = [
        `Working directory: ${cwd}`,
        `Platform: ${os.platform()}`,
        `Hostname: ${os.hostname()}`,
      ];
      return parts.join("\n");
    },
    baseline(current) {
      return `Here is some useful information about the environment you are running in:\n<env>\n  ${current}\n</env>`;
    },
    update(_previous, current) {
      return `The environment you are running in is now:\n<env>\n  ${current}\n</env>`;
    },
  };
}

export function createDateSource(): ContextSource<string> {
  return {
    key: "core/date",
    async load() {
      return new Date().toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
    baseline(current) {
      return `Today's date: ${current}`;
    },
    update(_previous, current) {
      return `Today's date is now: ${current}`;
    },
  };
}

// =============================================================================
// Compaction System (ported from opencode/core/session/compaction.ts)
// =============================================================================

export interface CompactionConfig {
  auto: boolean;
  buffer: number;
  keepTokens: number;
}

export interface CompactionInput {
  previousSummary?: string;
  recentContext: string;
  config?: Partial<CompactionConfig>;
}

export function buildCompactionPrompt(input: CompactionInput): string {
  const parts: string[] = [];

  if (input.previousSummary) {
    parts.push(
      `Update the anchored summary below using the conversation history above.\nPreserve still-true details, remove stale details, and merge in the new facts.\n<previous-summary>\n${input.previousSummary}\n</previous-summary>`,
    );
  } else {
    parts.push("Create a new anchored summary from the conversation history.");
  }

  parts.push(`\n\n${SUMMARY_TEMPLATE}`);

  if (input.recentContext) {
    parts.push(`\n\nRecent context to preserve:\n${input.recentContext}`);
  }

  return parts.join("\n");
}

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
{Which files are most relevant?}`;

// =============================================================================
// Overflow Detection (ported from opencode/session/overflow.ts)
// =============================================================================

export interface OverflowConfig {
  modelContextLimit: number;
  maxOutputTokens: number;
  autoCompactionEnabled: boolean;
}

export function usableContext(config: OverflowConfig): number {
  const reserved = Math.min(config.maxOutputTokens, 20000);
  return config.modelContextLimit - reserved;
}

export function isOverflow(
  totalTokens: number,
  config: OverflowConfig,
): boolean {
  if (!config.autoCompactionEnabled) return false;
  return totalTokens >= usableContext(config);
}

// =============================================================================
// Tail Preservation (ported from opencode/session/compaction.ts)
// =============================================================================

export interface MessageEntry {
  id: string;
  tokens: number;
  content: string;
  isToolOutput?: boolean;
}

/**
 * Select tail messages to preserve within a token budget
 */
export function selectTail(
  entries: MessageEntry[],
  maxTokens: number,
): MessageEntry[] {
  const tail: MessageEntry[] = [];
  let used = 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (used + entry.tokens <= maxTokens) {
      tail.unshift(entry);
      used += entry.tokens;
    } else if (tail.length === 0) {
      // Always keep at least the last message
      tail.unshift(entry);
      break;
    } else {
      break;
    }
  }

  return tail;
}

// =============================================================================
// Token Estimation
// =============================================================================

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 chars per token
  return Math.ceil(text.length / 4);
}

/**
 * Truncate tool output for compaction
 */
export function truncateToolOutput(output: string, maxChars = 2000): string {
  if (output.length <= maxChars) return output;
  return output.slice(0, maxChars) + `\n... (truncated to ${maxChars} chars)`;
}

// =============================================================================
// Context Epoch (ported from opencode/core/session/context-epoch.ts)
// =============================================================================

export interface ContextEpoch {
  sessionId: string;
  baseline: string;
  agent: string;
  snapshot: Record<string, unknown>;
  baselineSeq: number;
  replacementSeq: number;
  revision: number;
}

export function createContextEpoch(params: {
  sessionId: string;
  baseline: string;
  agent: string;
  snapshot: Record<string, unknown>;
}): ContextEpoch {
  return {
    sessionId: params.sessionId,
    baseline: params.baseline,
    agent: params.agent,
    snapshot: params.snapshot,
    baselineSeq: 0,
    replacementSeq: 0,
    revision: 1,
  };
}

/**
 * Build the full system prompt from agent prompt + context baseline
 */
export function buildSystemPrompt(
  agentPrompt?: string,
  contextBaseline?: string,
  instructions?: string,
  skillGuidance?: string,
): string {
  const parts: string[] = [];

  if (agentPrompt) parts.push(agentPrompt);
  if (contextBaseline) parts.push(contextBaseline);
  if (instructions) parts.push(instructions);
  if (skillGuidance) parts.push(skillGuidance);

  return parts.join("\n\n");
}
