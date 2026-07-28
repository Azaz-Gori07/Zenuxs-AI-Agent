export interface EditOperation {
  oldText: string
  newText: string
  path: string
}

export interface StrategyResult {
  success: boolean
  matchCount: number
  error?: string
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

export class SimpleStrategy {
  name = "simple"
  apply(content: string, op: EditOperation): StrategyResult {
    const idx = content.indexOf(op.oldText)
    if (idx === -1) return { success: false, matchCount: 0, error: "oldText not found" }
    return { success: true, matchCount: 1 }
  }
  execute(content: string, op: EditOperation): string {
    return content.replace(op.oldText, op.newText)
  }
}

export class LineTrimmedStrategy {
  name = "lineTrimmed"
  apply(content: string, op: EditOperation): StrategyResult {
    const oldLines = op.oldText.split("\n").map((l) => l.trim())
    const contentLines = content.split("\n")
    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      let match = true
      for (let j = 0; j < oldLines.length; j++) {
        if (contentLines[i + j].trim() !== oldLines[j]) { match = false; break }
      }
      if (match) return { success: true, matchCount: 1 }
    }
    return { success: false, matchCount: 0, error: "oldText not found (line-trimmed)" }
  }
  execute(content: string, op: EditOperation): string {
    const oldLines = op.oldText.split("\n").map((l) => l.trim())
    const contentLines = content.split("\n")
    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      let match = true
      for (let j = 0; j < oldLines.length; j++) {
        if (contentLines[i + j].trim() !== oldLines[j]) { match = false; break }
      }
      if (match) {
        const before = contentLines.slice(0, i).join("\n")
        const after = contentLines.slice(i + oldLines.length).join("\n")
        return [before, op.newText, after].filter(Boolean).join("\n")
      }
    }
    return content
  }
}

export class BlockAnchorStrategy {
  name = "blockAnchor"
  readonly similarityThreshold: number
  constructor(threshold = 0.85) { this.similarityThreshold = threshold }

  apply(content: string, op: EditOperation): StrategyResult {
    const oldLines = op.oldText.split("\n")
    const contentLines = content.split("\n")
    if (oldLines.length < 2) return { success: false, matchCount: 0, error: "BlockAnchor requires at least 2 lines" }
    const anchorStart = oldLines[0].trim()
    const anchorEnd = oldLines[oldLines.length - 1].trim()

    for (let i = 0; i < contentLines.length; i++) {
      if (similarity(contentLines[i].trim(), anchorStart) >= this.similarityThreshold) {
        const endIdx = i + oldLines.length - 1
        if (endIdx < contentLines.length && similarity(contentLines[endIdx].trim(), anchorEnd) >= this.similarityThreshold) {
          const block = contentLines.slice(i, endIdx + 1).join("\n")
          if (similarity(block.trim(), op.oldText.trim()) >= this.similarityThreshold) {
            return { success: true, matchCount: 1 }
          }
        }
      }
    }
    return { success: false, matchCount: 0, error: "BlockAnchor match not found" }
  }
  execute(content: string, op: EditOperation): string {
    const oldLines = op.oldText.split("\n")
    const contentLines = content.split("\n")
    if (oldLines.length < 2) return content
    const anchorStart = oldLines[0].trim()
    const anchorEnd = oldLines[oldLines.length - 1].trim()

    for (let i = 0; i < contentLines.length; i++) {
      if (similarity(contentLines[i].trim(), anchorStart) >= this.similarityThreshold) {
        const endIdx = i + oldLines.length - 1
        if (endIdx < contentLines.length && similarity(contentLines[endIdx].trim(), anchorEnd) >= this.similarityThreshold) {
          const before = contentLines.slice(0, i).join("\n")
          const after = contentLines.slice(endIdx + 1).join("\n")
          return [before, op.newText, after].filter(Boolean).join("\n")
        }
      }
    }
    return content
  }
}

export class WhitespaceNormalizedStrategy {
  name = "whitespaceNormalized"
  apply(content: string, op: EditOperation): StrategyResult {
    const normalized = content.replace(/\s+/g, " ")
    const target = op.oldText.replace(/\s+/g, " ")
    if (normalized.includes(target)) return { success: true, matchCount: 1 }
    return { success: false, matchCount: 0, error: "oldText not found (whitespace-normalized)" }
  }
  execute(content: string, op: EditOperation): string {
    const normalized = content.replace(/\s+/g, " ")
    const target = op.oldText.replace(/\s+/g, " ")
    const idx = normalized.indexOf(target)
    if (idx === -1) return content
    const before = content.substring(0, idx)
    const after = content.substring(idx + op.oldText.length)
    return before + op.newText + after
  }
}

export class IndentationFlexibleStrategy {
  name = "indentationFlexible"
  apply(content: string, op: EditOperation): StrategyResult {
    const oldLines = op.oldText.split("\n")
    const contentLines = content.split("\n")
    if (oldLines.length < 2) return { success: false, matchCount: 0, error: "Requires at least 2 lines" }
    const targetFirst = oldLines[0].trim()
    const targetLast = oldLines[oldLines.length - 1].trim()

    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].trim() === targetFirst && i + oldLines.length - 1 < contentLines.length) {
        if (contentLines[i + oldLines.length - 1].trim() === targetLast) {
          return { success: true, matchCount: 1 }
        }
      }
    }
    return { success: false, matchCount: 0, error: "Indentation-flexible match not found" }
  }
  execute(content: string, op: EditOperation): string {
    const oldLines = op.oldText.split("\n")
    const contentLines = content.split("\n")
    const targetFirst = oldLines[0].trim()
    const targetLast = oldLines[oldLines.length - 1].trim()

    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].trim() === targetFirst && i + oldLines.length - 1 < contentLines.length) {
        if (contentLines[i + oldLines.length - 1].trim() === targetLast) {
          const before = contentLines.slice(0, i).join("\n")
          const after = contentLines.slice(i + oldLines.length).join("\n")
          return [before, op.newText, after].filter(Boolean).join("\n")
        }
      }
    }
    return content
  }
}

export class EscapeNormalizedStrategy {
  name = "escapeNormalized"
  apply(content: string, op: EditOperation): StrategyResult {
    const normalize = (s: string) => s.replace(/\\([nrt'"\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", "'": "'", '"': '"', "\\": "\\" })[c] ?? _)
    if (normalize(content).includes(normalize(op.oldText))) return { success: true, matchCount: 1 }
    return { success: false, matchCount: 0, error: "Escape-normalized match not found" }
  }
  execute(content: string, op: EditOperation): string {
    const normalize = (s: string) => s.replace(/\\([nrt'"\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", "'": "'", '"': '"', "\\": "\\" })[c] ?? _)
    const normalizedContent = normalize(content)
    const target = normalize(op.oldText)
    const idx = normalizedContent.indexOf(target)
    if (idx === -1) return content
    return content.substring(0, idx) + op.newText + content.substring(idx + op.oldText.length)
  }
}

export class TrimmedBoundaryStrategy {
  name = "trimmedBoundary"
  apply(content: string, op: EditOperation): StrategyResult {
    const trimmed = op.oldText.trim()
    if (content.includes(trimmed)) return { success: true, matchCount: 1 }
    return { success: false, matchCount: 0, error: "Trimmed boundary match not found" }
  }
  execute(content: string, op: EditOperation): string {
    const trimmed = op.oldText.trim()
    const idx = content.indexOf(trimmed)
    if (idx === -1) return content
    return content.substring(0, idx) + op.newText + content.substring(idx + trimmed.length)
  }
}

export class ContextAwareStrategy {
  name = "contextAware"
  apply(content: string, op: EditOperation): StrategyResult {
    const oldLines = op.oldText.split("\n")
    const contentLines = content.split("\n")
    if (oldLines.length < 3) return { success: false, matchCount: 0, error: "ContextAware requires at least 3 lines" }
    const contextStart = oldLines[0].trim()
    const contextEnd = oldLines[oldLines.length - 1].trim()
    const targetBlock = oldLines.slice(1, -1).join("\n").trim()

    for (let i = 1; i < contentLines.length - 1; i++) {
      if (contentLines[i - 1].trim() === contextStart) {
        const endIdx = i + (oldLines.length - 2)
        if (endIdx < contentLines.length && contentLines[endIdx].trim() === contextEnd) {
          const block = contentLines.slice(i, endIdx).join("\n").trim()
          if (block === targetBlock) return { success: true, matchCount: 1 }
        }
      }
    }
    return { success: false, matchCount: 0, error: "Context-aware match not found" }
  }
  execute(content: string, op: EditOperation): string {
    const oldLines = op.oldText.split("\n")
    const contentLines = content.split("\n")
    if (oldLines.length < 3) return content
    const contextStart = oldLines[0].trim()
    const contextEnd = oldLines[oldLines.length - 1].trim()

    for (let i = 1; i < contentLines.length - 1; i++) {
      if (contentLines[i - 1].trim() === contextStart && contentLines[i + oldLines.length - 2].trim() === contextEnd) {
        const before = contentLines.slice(0, i - 1).join("\n")
        const after = contentLines.slice(i + oldLines.length - 1).join("\n")
        return [before, op.newText, after].filter(Boolean).join("\n")
      }
    }
    return content
  }
}

export class MultiOccurrenceStrategy {
  name = "multiOccurrence"
  apply(content: string, op: EditOperation): StrategyResult {
    const regex = new RegExp(op.oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
    const matches = content.match(regex)
    if (!matches) return { success: false, matchCount: 0, error: "No occurrences found" }
    return { success: true, matchCount: matches.length }
  }
  execute(content: string, op: EditOperation): string {
    return content.split(op.oldText).join(op.newText)
  }
}

export const EDIT_STRATEGIES = [
  new SimpleStrategy(),
  new LineTrimmedStrategy(),
  new BlockAnchorStrategy(),
  new WhitespaceNormalizedStrategy(),
  new IndentationFlexibleStrategy(),
  new EscapeNormalizedStrategy(),
  new TrimmedBoundaryStrategy(),
  new ContextAwareStrategy(),
  new MultiOccurrenceStrategy(),
]

export function findBestStrategy(content: string, op: EditOperation): { strategy: typeof EDIT_STRATEGIES[number]; result: StrategyResult } {
  for (const strategy of EDIT_STRATEGIES) {
    const result = strategy.apply(content, op)
    if (result.success) return { strategy, result }
  }
  return { strategy: EDIT_STRATEGIES[0]!, result: { success: false, matchCount: 0, error: "No strategy could match" } }
}

export * as EditStrategies from "."