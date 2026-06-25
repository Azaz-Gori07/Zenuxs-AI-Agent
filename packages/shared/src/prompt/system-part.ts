/**
 * System part types and utilities — ported from OpenCode's LLM prompt model.
 *
 * Supports:
 *  - Initial privileged system prompt (single part)
 *  - Chronological system updates (inserted in conversation history)
 *  - Stable escaped fallback for non‑native routes (`<system-update>`)
 */

import type { SystemPart } from "../agent";

// =============================================================================
// Types
// =============================================================================

export type { SystemPart };

/** Minimal shape for a chronological system update inside messages. */
export interface SystemUpdateContent {
  type: "system-update";
  text: string;
}

// =============================================================================
// Escaping helpers (stable representation for non‑native routes)
// =============================================================================

const ESCAPE_RE = /[<>&"']/g;
const ESCAPE_MAP: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeXml(str: string): string {
  return str.replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] ?? ch);
}

function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// =============================================================================
// System update wrapper — stable text representation
// =============================================================================

const SYSTEM_UPDATE_TAG = "system-update";

/**
 * Wraps a chronological system update in a stable, escaped XML block.
 * This is the fallback representation when the provider does not natively
 * support chronological system messages inside the conversation.
 */
export function wrapSystemUpdate(text: string): string {
  const escaped = escapeXml(text);
  return `<${SYSTEM_UPDATE_TAG}>\n${escaped}\n</${SYSTEM_UPDATE_TAG}>`;
}

/**
 * Detect whether a text block is a wrapped system update.
 */
export function isWrappedSystemUpdate(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith(`<${SYSTEM_UPDATE_TAG}>`) &&
    trimmed.endsWith(`</${SYSTEM_UPDATE_TAG}>`)
  );
}

/**
 * Unwrap a wrapped system update, returning the original text.
 */
export function unwrapSystemUpdate(wrapped: string): string {
  const trimmed = wrapped.trim();
  const start = trimmed.indexOf(">") + 1;
  const end = trimmed.lastIndexOf("</");
  const inner = trimmed.slice(start, end).trim();
  return unescapeXml(inner);
}

// =============================================================================
// System part rendering
// =============================================================================

/**
 * Render a single system part to its string representation.
 */
export function renderSystemPart(part: SystemPart): string {
  return part.text;
}

/**
 * Render multiple system parts into a single prompt string.
 * Parts are joined with double newlines.
 */
export function renderSystemParts(parts: readonly SystemPart[]): string {
  return parts.map(renderSystemPart).join("\n\n");
}

/**
 * Build a complete system prompt from a base prompt string and
 * optional additional system parts. The base is treated as a text part
 * if provided; additional parts are appended.
 *
 * This is the primary composition function used at request time.
 */
export function buildSystemPrompt(
  base: string | undefined,
  additionalParts?: readonly SystemPart[],
): string {
  const parts: string[] = [];

  if (base?.trim()) {
    parts.push(base.trim());
  }

  if (additionalParts) {
    for (const part of additionalParts) {
      const rendered = renderSystemPart(part).trim();
      if (rendered) {
        parts.push(rendered);
      }
    }
  }

  return parts.join("\n\n");
}

/**
 * Create a system part from a text string.
 */
export function systemText(
  text: string,
  cache?: "ephemeral" | "persistent",
  metadata?: Record<string, unknown>,
): SystemPart {
  return { type: "text", text, ...(cache ? { cache } : {}), ...(metadata ? { metadata } : {}) };
}

/**
 * Create a chronological system update content block (for use inside messages).
 */
export function systemUpdate(text: string): SystemUpdateContent {
  return { type: "system-update", text };
}

/**
 * Normalize a variety of system prompt inputs to an array of SystemPart.
 */
export function normalizeSystemInput(
  input: string | readonly SystemPart[] | undefined,
): SystemPart[] {
  if (!input) return [];
  if (typeof input === "string") {
    return input.trim() ? [{ type: "text", text: input.trim() }] : [];
  }
  return input as SystemPart[];
}
