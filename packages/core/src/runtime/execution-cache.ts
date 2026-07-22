/**
 * Execution Cache System — Smart Caching for Performance
 *
 * Caches expensive operations to avoid redundant work:
 * - Workspace analysis
 * - Dependency analysis
 * - Tool discovery
 * - Framework detection
 * - Configuration detection
 *
 * Automatically invalidates when files change.
 *
 * Optimizations vs original:
 * 1. O(1) LRU eviction via Map insertion order (bump on get/upsert)
 * 2. Incremental memory tracking (no O(n) JSON.stringify per getStats)
 * 3. Async disk persistence via fs.promises
 * 4. Batch key-based invalidation via Set intersection (O(m) not O(n))
 * 5. Periodic TTL sweep via configurable interval timer
 * 6. Type-safe convenience functions with inference
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export enum CacheType {
  WORKSPACE_ANALYSIS = "workspace:analysis",
  DEPENDENCY_ANALYSIS = "dependency:analysis",
  TOOL_DISCOVERY = "tool:discovery",
  FRAMEWORK_DETECTION = "framework:detection",
  CONFIG_DETECTION = "config:detection",
  FILE_CONTENT = "file:content",
  SYMBOL_INDEX = "symbol:index",
  BUILD_RESULT = "build:result",
}

export interface CacheEntry<T = unknown> {
  value: T;
  cachedAt: number;
  ttlMs: number;
  key: string;
  type: CacheType;
  isValid: boolean;
}

export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsed: number;
}

export interface CacheOptions {
  defaultTtlMs?: number;
  maxSize?: number;
  persistToDisk?: boolean;
  cacheDir?: string;
  ttlSweepIntervalMs?: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_TTL_SWEEP_MS = 60_000;

export class ExecutionCacheManager {
  private cache = new Map<string, CacheEntry>();
  private options: Required<CacheOptions>;
  private stats = { hits: 0, misses: 0 };
  private estimatedMemoryBytes = 0;
  private ttlSweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTtlMs: options.defaultTtlMs ?? DEFAULT_TTL_MS,
      maxSize: options.maxSize ?? DEFAULT_MAX_SIZE,
      persistToDisk: options.persistToDisk ?? false,
      cacheDir: options.cacheDir ?? path.join(process.cwd(), ".zenuxs-cache"),
      ttlSweepIntervalMs: options.ttlSweepIntervalMs ?? DEFAULT_TTL_SWEEP_MS,
    };
    this.startTtlSweep();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (!this.isEntryValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, type: CacheType, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.estimatedMemoryBytes -= this.entrySize(this.cache.get(key)!);
    }
    while (this.cache.size >= this.options.maxSize) {
      const first = this.cache.keys().next().value;
      if (first === undefined) break;
      this.estimatedMemoryBytes -= this.entrySize(this.cache.get(first)!);
      this.cache.delete(first);
    }
    const entry: CacheEntry<T> = {
      value,
      cachedAt: Date.now(),
      ttlMs: ttlMs ?? this.options.defaultTtlMs,
      key,
      type,
      isValid: true,
    };
    this.cache.set(key, entry);
    this.estimatedMemoryBytes += this.entrySize(entry);

    if (this.options.persistToDisk) {
      this.persistEntry(entry).catch(() => {});
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.estimatedMemoryBytes -= this.entrySize(entry);
      this.cache.delete(key);
    }
  }

  invalidateType(type: CacheType): void {
    for (const [key, entry] of this.cache) {
      if (entry.type === type) {
        this.estimatedMemoryBytes -= this.entrySize(entry);
        this.cache.delete(key);
      }
    }
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.estimatedMemoryBytes -= this.entrySize(this.cache.get(key)!);
        this.cache.delete(key);
      }
    }
  }

  invalidateKeys(keys: Set<string>): number {
    let count = 0;
    for (const key of keys) {
      if (this.cache.has(key)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    this.estimatedMemoryBytes = 0;
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    return {
      totalEntries: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      memoryUsed: this.estimatedMemoryBytes,
    };
  }

  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if (!entry.isValid || now - entry.cachedAt >= entry.ttlMs) {
        this.estimatedMemoryBytes -= this.entrySize(entry);
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  async loadFromDisk(): Promise<void> {
    if (!this.options.persistToDisk) return;
    try {
      const stat = await fs.stat(this.options.cacheDir).catch(() => null);
      if (!stat?.isDirectory()) return;
      const files = await fs.readdir(this.options.cacheDir);
      let loaded = 0;
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const content = await fs.readFile(path.join(this.options.cacheDir, file), "utf-8");
          const entry = JSON.parse(content) as CacheEntry;
          entry.cachedAt = Number(entry.cachedAt);
          if (this.isEntryValid(entry)) {
            this.cache.set(entry.key, entry);
            this.estimatedMemoryBytes += this.entrySize(entry);
            loaded++;
          }
        } catch {}
      }
    } catch {}
  }

  private startTtlSweep(): void {
    if (this.ttlSweepTimer) clearInterval(this.ttlSweepTimer);
    this.ttlSweepTimer = setInterval(() => {
      this.cleanExpired();
    }, this.options.ttlSweepIntervalMs);
    if (this.ttlSweepTimer && typeof this.ttlSweepTimer === "object" && "unref" in this.ttlSweepTimer) {
      (this.ttlSweepTimer as NodeJS.Timeout).unref();
    }
  }

  private isEntryValid(entry: CacheEntry): boolean {
    if (!entry.isValid) return false;
    return Date.now() - entry.cachedAt < entry.ttlMs;
  }

  private entrySize(entry: CacheEntry): number {
    if (typeof entry.value === "string") return entry.value.length * 2;
    try {
      return JSON.stringify(entry.value).length * 2;
    } catch {
      return 256;
    }
  }

  private async persistEntry<T>(entry: CacheEntry<T>): Promise<void> {
    try {
      const safeKey = entry.key.replace(/[<>:"/\\|?*]/g, "_");
      const cachePath = path.join(this.options.cacheDir, `${entry.type}_${safeKey}.json`);
      await fs.mkdir(this.options.cacheDir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(entry), "utf-8");
    } catch {}
  }
}

let globalCacheManager: ExecutionCacheManager | null = null;

export function getExecutionCache(): ExecutionCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new ExecutionCacheManager();
  }
  return globalCacheManager;
}

export function resetExecutionCache(): void {
  if (globalCacheManager) {
    globalCacheManager.clear();
  }
  globalCacheManager = null;
}

export function cacheWorkspaceAnalysis<T>(workspaceRoot: string, value: T, ttlMs?: number): void {
  getExecutionCache().set(`${CacheType.WORKSPACE_ANALYSIS}:${workspaceRoot}`, value, CacheType.WORKSPACE_ANALYSIS, ttlMs);
}

export function getCachedWorkspaceAnalysis<T>(workspaceRoot: string): T | null {
  return getExecutionCache().get<T>(`${CacheType.WORKSPACE_ANALYSIS}:${workspaceRoot}`);
}

export function cacheDependencyAnalysis<T>(workspaceRoot: string, value: T, ttlMs?: number): void {
  getExecutionCache().set(`${CacheType.DEPENDENCY_ANALYSIS}:${workspaceRoot}`, value, CacheType.DEPENDENCY_ANALYSIS, ttlMs);
}

export function getCachedDependencyAnalysis<T>(workspaceRoot: string): T | null {
  return getExecutionCache().get<T>(`${CacheType.DEPENDENCY_ANALYSIS}:${workspaceRoot}`);
}

export function cacheFileContent<T>(filePath: string, value: T, ttlMs: number = 60000): void {
  getExecutionCache().set(`${CacheType.FILE_CONTENT}:${filePath}`, value, CacheType.FILE_CONTENT, ttlMs);
}

export function getCachedFileContent<T>(filePath: string): T | null {
  return getExecutionCache().get<T>(`${CacheType.FILE_CONTENT}:${filePath}`);
}

export function invalidateFileCaches(filePath: string): void {
  const cache = getExecutionCache();
  cache.invalidatePattern(filePath);
  cache.invalidateType(CacheType.WORKSPACE_ANALYSIS);
  cache.invalidateType(CacheType.SYMBOL_INDEX);
}
