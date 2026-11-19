import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRagIndex,
  chunkLines,
  collectFiles,
  saveRagIndex,
  loadRagIndex,
  searchRagIndex,
  watchRagIndex,
} from "./rag";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "rag-fixture-"));
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "node_modules"), { recursive: true });
  writeFileSync(join(root, "src", "alpha.ts"), "export const alpha = 1;\n// unique magnet vocabulary\n".repeat(6));
  writeFileSync(join(root, "src", "beta.ts"), "export const beta = 2;\n".repeat(20));
  writeFileSync(join(root, "node_modules", "ignored.ts"), "unique magnet vocabulary\n");
  return root;
}

describe("Zenuxs codebase index", () => {
  it("chunks text with overlap and line ranges", () => {
    const chunks = chunkLines(Array.from({ length: 25 }, (_, i) => `line ${i}`).join("\n"), 10, 3);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]?.lineStart).toBe(1);
    expect(chunks[0]?.lineEnd).toBe(10);
    expect(chunks[1]?.lineStart).toBe(8);
  });

  it("ignores node_modules and non-text files", async () => {
    const root = fixture();
    writeFileSync(join(root, "blob.bin"), "binary");
    const files = await collectFiles(root);
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
    expect(files.some((f) => f.endsWith(".bin"))).toBe(false);
    expect(files.length).toBe(2);
  });

  it("ranks a chunk containing a distinctive term first", async () => {
    const index = await buildRagIndex({ root: fixture(), chunkLines: 12, overlapLines: 2 });
    expect(index.chunks.length).toBeGreaterThan(2);
    expect(index.docFreq.magnet).toBeGreaterThan(0);
    const results = searchRagIndex(index, "magnet vocabulary", 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.path).toBe("src/alpha.ts");
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it("persists and reloads the index", async () => {
    const root = fixture();
    const index = await buildRagIndex({ root });
    const path = join(root, ".zenuxs", "rag-index.json");
    saveRagIndex(index, path);
    const loaded = loadRagIndex(path);
    expect(loaded?.chunks.length).toBe(index.chunks.length);
    expect(loaded?.files["src/alpha.ts"]).toBeDefined();
  });

  it("incrementally reindexes a changed file via the watcher", async () => {
    const root = fixture();
    const index = await buildRagIndex({ root });
    const watcher = watchRagIndex(index, { root, intervalMs: 10_000 });
    try {
      writeFileSync(join(root, "src", "gamma.ts"), "totally new unique tokentheta\n".repeat(10));
      const changed = await watcher.refresh();
      expect(changed).toBe(true);
      expect(index.chunks.some((c) => c.path === "src/gamma.ts")).toBe(true);
    } finally {
      watcher.close();
    }
  });
});
