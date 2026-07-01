/**
 * Performance Benchmark Suite
 *
 * Measures key hot-path operations before/after optimization.
 * Run with: npx vitest run packages/core/src/perf/benchmark.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Benchmark helpers
function bench<T>(fn: () => Promise<T>, iterations: number): Promise<{ elapsed: number; result: T }> {
	return (async () => {
		const start = performance.now();
		let result: T;
		for (let i = 0; i < iterations; i++) {
			result = await fn();
		}
		const elapsed = performance.now() - start;
		return { elapsed, result: result! };
	})();
}

// Setup a temp workspace with realistic file structure
let tempDir: string;
const FILE_COUNT = 200;

async function createTestWorkspace(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perf-bench-"));
	// Create nested directory structure
	for (let i = 0; i < 10; i++) {
		const subDir = path.join(dir, `src`, `module-${i}`);
		await fs.mkdir(subDir, { recursive: true });
		for (let j = 0; j < FILE_COUNT / 10; j++) {
			const content = `export function fn${j}() {\n  return ${j};\n}\n\nexport const value${j} = "hello-${j}";\n`;
			await fs.writeFile(path.join(subDir, `file-${j}.ts`), content);
		}
	}
	// Create package.json
	await fs.writeFile(
		path.join(dir, "package.json"),
		JSON.stringify({
			name: "test-project",
			dependencies: { express: "4.0.0", react: "18.0.0" },
			devDependencies: { vitest: "1.0.0" },
		}),
	);
	return dir;
}

describe("Performance Benchmarks", () => {
	beforeAll(async () => {
		tempDir = await createTestWorkspace();
	});

	afterAll(async () => {
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});

	it("workspace-indexer: buildIndex", async () => {
		const { WorkspaceIndexer } = await import("../runtime/workspace-indexer");
		const indexer = new WorkspaceIndexer({ parseSymbols: false });

		const { elapsed } = await bench(
			() => indexer.buildIndex(tempDir) as Promise<any>,
			3,
		);
		console.log(`[BENCH] workspace-indexer buildIndex (${FILE_COUNT} files): ${elapsed.toFixed(0)}ms total (3 runs)`);
		expect(elapsed).toBeGreaterThan(0);
	});

	it("workspace-indexer: buildIndex with symbol parsing", async () => {
		const { WorkspaceIndexer } = await import("../runtime/workspace-indexer");
		const indexer = new WorkspaceIndexer({ parseSymbols: true });

		const { elapsed } = await bench(
			() => indexer.buildIndex(tempDir) as Promise<any>,
			3,
		);
		console.log(`[BENCH] workspace-indexer buildIndex+symbols (${FILE_COUNT} files): ${elapsed.toFixed(0)}ms total (3 runs)`);
		expect(elapsed).toBeGreaterThan(0);
	});

	it("regex-search: globToRegex compilation", async () => {
		const { globToRegex, matchesGlobs } = await import("../extensions/tools/executors/regex-search");

		const patterns = ["*.ts", "**/*.test.ts", "src/**/*.tsx", "**/*.{js,jsx}"];
		const testPaths = Array.from({ length: FILE_COUNT }, (_, i) => `src/module-${i % 10}/file-${i}.ts`);

		const { elapsed } = await bench(async () => {
			for (const p of testPaths) {
				matchesGlobs(p, patterns);
			}
		}, 10);
		console.log(`[BENCH] matchesGlobs (${FILE_COUNT} paths x 4 patterns x 10 iters): ${elapsed.toFixed(0)}ms`);
		expect(elapsed).toBeGreaterThan(0);
	});

	it("regex-search: searchWithRegex on workspace", async () => {
		const { searchWithRegex } = await import("../extensions/tools/executors/regex-search");

		const { elapsed } = await bench(
			() => searchWithRegex({
				pattern: "export function",
				cwd: tempDir,
				maxResults: 50,
				contextLines: 0,
			}),
			3,
		);
		console.log(`[BENCH] searchWithRegex (${FILE_COUNT} files, 3 runs): ${elapsed.toFixed(0)}ms`);
		expect(elapsed).toBeGreaterThan(0);
	});

	it("path-analyzer: analyzePath repeated calls", async () => {
		const { analyzePath } = await import("../runtime/path-analyzer");
		const testFile = path.join(tempDir, "src", "module-0", "file-0.ts");

		const { elapsed } = await bench(
			() => analyzePath(testFile, { cwd: tempDir }),
			50,
		);
		console.log(`[BENCH] analyzePath (50 calls, same path): ${elapsed.toFixed(0)}ms`);
		expect(elapsed).toBeGreaterThan(0);
	});

	it("execution-cache: persist and load", async () => {
		const { ExecutionCacheManager, CacheType } = await import("../runtime/execution-cache");
		const cacheDir = path.join(tempDir, ".cache-test");

		const { elapsed } = await bench(async () => {
			const cache = new ExecutionCacheManager({ cacheDir, persistToDisk: true, maxSize: 50 });
			for (let i = 0; i < 20; i++) {
				cache.set(`key-${i}`, { data: `value-${i}` }, CacheType.FILE_CONTENT);
			}
			cache.loadFromDisk();
		}, 3);
		console.log(`[BENCH] execution-cache persist+load (20 entries, 3 runs): ${elapsed.toFixed(0)}ms`);
		expect(elapsed).toBeGreaterThan(0);
	});

	it("glob-grep-enhanced: globFiles", async () => {
		const { createEnhancedGlobTool } = await import("../extensions/tools/glob-grep-enhanced");
		const tool = createEnhancedGlobTool({ cwd: tempDir });

		const { elapsed } = await bench(
			async () => {
				const result = await tool.execute({ pattern: "**/*.ts", path: tempDir });
				return result;
			},
			5,
		);
		console.log(`[BENCH] glob tool (**/*.ts, 5 runs): ${elapsed.toFixed(0)}ms`);
		expect(elapsed).toBeGreaterThan(0);
	});
});
