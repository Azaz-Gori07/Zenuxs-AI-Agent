/**
 * Original lexical codebase index for Zenuxs.
 *
 * Design: files are chunked by lines with overlap, tokenised into words, and
 * scored with BM25. Embeddings are optional (a caller may supply a vector
 * function); without one the lexical/BM25 fallback is used. Incremental
 * updates are driven by a polling watcher that compares mtime/size.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

export const DEFAULT_IGNORE = [
  ".git", "node_modules", "dist", "build", ".turbo", ".vscode-test", ".tmp",
  "coverage", "vendor", "__snapshots__", ".next", ".cache",
];

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".txt",
  ".py", ".go", ".rs", ".java", ".rb", ".sh", ".yml", ".yaml", ".toml",
  ".css", ".scss", ".html", ".sql", ".mts", ".cts",
]);

export interface RagChunk {
  id: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  text: string;
  terms: Record<string, number>;
  embedding?: number[];
}

export interface RagIndex {
  version: 1;
  root: string;
  createdAt: string;
  chunkLines: number;
  overlapLines: number;
  avgChunkLength: number;
  docFreq: Record<string, number>;
  chunks: RagChunk[];
  files: Record<string, { hash: string; mtimeMs: number; size: number }>;
}

export interface BuildIndexOptions {
  root: string;
  ignore?: string[];
  chunkLines?: number;
  overlapLines?: number;
  maxFileBytes?: number;
  embed?: (text: string) => Promise<number[] | undefined> | number[] | undefined;
}

const tokenize = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? []).map((t) => t.replace(/^_+|_+$/g, ""));

const termFreq = (tokens: string[]): Record<string, number> => {
  const freq: Record<string, number> = {};
  for (const token of tokens) freq[token] = (freq[token] ?? 0) + 1;
  return freq;
};

export function chunkLines(text: string, size = 40, overlap = 10): Array<{ lineStart: number; lineEnd: number; text: string }> {
  const lines = text.split(/\r?\n/);
  const step = Math.max(1, size - overlap);
  const out: Array<{ lineStart: number; lineEnd: number; text: string }> = [];
  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(lines.length, start + size);
    out.push({ lineStart: start + 1, lineEnd: end, text: lines.slice(start, end).join("\n") });
    if (end === lines.length) break;
  }
  return out;
}

function shouldIgnore(relPath: string, ignore: string[]): boolean {
  const parts = relPath.split(/[\\/]/);
  return parts.some((part) => ignore.includes(part)) ||
    parts.some((part) => part.startsWith(".") && part !== ".env.example" && part !== ".agents");
}

/** Recursively collect indexable text files, honouring ignore rules. */
export async function collectFiles(root: string, ignore: string[] = DEFAULT_IGNORE): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      if (shouldIgnore(rel, ignore)) continue;
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) found.push(full);
    }
  }
  await walk(root);
  return found.sort();
}

export async function buildRagIndex(options: BuildIndexOptions): Promise<RagIndex> {
  const root = resolve(options.root);
  const ignore = options.ignore ?? DEFAULT_IGNORE;
  const chunkSize = options.chunkLines ?? 40;
  const overlap = options.overlapLines ?? 10;
  const maxBytes = options.maxFileBytes ?? 2_000_000;
  const files = await collectFiles(root, ignore);
  const chunks: RagChunk[] = [];
  const fileState: RagIndex["files"] = {};

  for (const file of files) {
    const info = await stat(file);
    if (info.size > maxBytes) continue;
    const content = await readFile(file, "utf8");
    const hash = createHash("sha256").update(content).digest("hex");
    const rel = relative(root, file).split(sep).join("/");
    fileState[rel] = { hash, mtimeMs: info.mtimeMs, size: info.size };
    for (const part of chunkLines(content, chunkSize, overlap)) {
      const embedding = options.embed ? await options.embed(part.text) : undefined;
      chunks.push({
        id: `${rel}:${part.lineStart}`,
        path: rel,
        lineStart: part.lineStart,
        lineEnd: part.lineEnd,
        text: part.text,
        terms: termFreq(tokenize(part.text)),
        ...(embedding ? { embedding } : {}),
      });
    }
  }

  const docFreq: Record<string, number> = {};
  for (const chunk of chunks) {
    for (const term of Object.keys(chunk.terms)) docFreq[term] = (docFreq[term] ?? 0) + 1;
  }
  const totalTerms = chunks.reduce((sum, c) => sum + Object.values(c.terms).reduce((a, b) => a + b, 0), 0);

  return {
    version: 1,
    root,
    createdAt: new Date().toISOString(),
    chunkLines: chunkSize,
    overlapLines: overlap,
    avgChunkLength: chunks.length ? totalTerms / chunks.length : 0,
    docFreq,
    chunks,
    files: fileState,
  };
}

export interface RagSearchResult {
  path: string;
  lineStart: number;
  lineEnd: number;
  score: number;
  snippet: string;
}

/** BM25 search. Optional embedding vectors use cosine similarity when present. */
export function searchRagIndex(index: RagIndex, query: string, topK = 8): RagSearchResult[] {
  const qTerms = tokenize(query);
  const N = index.chunks.length;
  if (!N || qTerms.length === 0) return [];
  const k1 = 1.5;
  const b = 0.75;
  const avgdl = index.avgChunkLength || 1;

  return index.chunks.map((chunk) => {
    let score = 0;
    for (const term of qTerms) {
      const tf = chunk.terms[term] ?? 0;
      if (!tf) continue;
      const df = index.docFreq[term] ?? 1;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const len = Object.values(chunk.terms).reduce((a, v) => a + v, 0);
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (len / avgdl)));
    }
    return { chunk, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      path: chunk.path,
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      score: Number(score.toFixed(4)),
      snippet: chunk.text.slice(0, 400),
    }));
}

export interface RagWatcher {
  close(): void;
  refresh(): Promise<boolean>;
}

/** Polling watcher: portable across Linux/macOS/Windows, with incremental reindex. */
export function watchRagIndex(
  index: RagIndex,
  options: { root?: string; intervalMs?: number; onChange?: (index: RagIndex) => void } = {},
): RagWatcher {
  const root = options.root ?? index.root;
  const interval = options.intervalMs ?? 2000;
  let closed = false;
  const timer = setInterval(() => { void refresh(); }, interval);
  timer.unref?.();

  async function refresh(): Promise<boolean> {
    if (closed) return false;
    const files = await collectFiles(root);
    let changed = false;
    const nextFiles: RagIndex["files"] = {};
    for (const file of files) {
      const rel = relative(root, file).split(sep).join("/");
      const info = await stat(file).catch(() => null);
      if (!info) continue;
      const hash = createHash("sha256").update(await readFile(file)).digest("hex");
      nextFiles[rel] = { hash, mtimeMs: info.mtimeMs, size: info.size };
      if (!index.files[rel] || index.files[rel].hash !== hash) {
        // Incrementally replace this file's chunks.
        index.chunks = index.chunks.filter((c) => c.path !== rel);
        const content = await readFile(file, "utf8");
        for (const part of chunkLines(content, index.chunkLines, index.overlapLines)) {
          index.chunks.push({
            id: `${rel}:${part.lineStart}`, path: rel, lineStart: part.lineStart, lineEnd: part.lineEnd,
            text: part.text, terms: termFreq(tokenize(part.text)),
          });
        }
        changed = true;
      }
    }
    for (const rel of Object.keys(index.files)) {
      if (!nextFiles[rel]) {
        index.chunks = index.chunks.filter((c) => c.path !== rel);
        changed = true;
      }
    }
    if (changed) {
      index.files = nextFiles;
      const docFreq: Record<string, number> = {};
      let total = 0;
      for (const chunk of index.chunks) {
        for (const term of Object.keys(chunk.terms)) docFreq[term] = (docFreq[term] ?? 0) + 1;
        total += Object.values(chunk.terms).reduce((a, v) => a + v, 0);
      }
      index.docFreq = docFreq;
      index.avgChunkLength = index.chunks.length ? total / index.chunks.length : 0;
      index.createdAt = new Date().toISOString();
      options.onChange?.(index);
    }
    return changed;
  }

  return { close: () => { closed = true; clearInterval(timer); }, refresh };
}

export function saveRagIndex(index: RagIndex, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(index), "utf8");
}

export function loadRagIndex(path: string): RagIndex | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as RagIndex;
}

// ── Agent tool ─────────────────────────────────────────────────────────

import { createTool } from "@cline/shared";

export interface CodebaseSearchInput {
  query: string;
  topK?: number;
}

/** Expose the index as an agent-callable semantic search tool. */
export function createCodebaseSearchTool(index: RagIndex) {
  return createTool<CodebaseSearchInput, string>({
    name: "codebase_search",
    description:
      "Search the indexed codebase using BM25 lexical ranking. Returns file paths, " +
      "line ranges, scores and snippets. Use for finding implementations by meaning " +
      "rather than exact text; prefer narrow queries.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, description: "What to search for" },
        topK: { type: "number", minimum: 1, maximum: 20, description: "Maximum results" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    execute: async (input) => {
      const results = searchRagIndex(index, input.query, input.topK ?? 8);
      if (results.length === 0) return "No matching code found in the index.";
      return results
        .map((r) => `${r.path}:${r.lineStart}-${r.lineEnd} (score ${r.score})\n${r.snippet}`)
        .join("\n\n");
    },
  });
}
