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
 * Benefits:
 * - Faster execution (skip redundant analysis)
 * - Lower memory usage (cache shared across requests)
 * - Reduced filesystem operations
 * - Improved tool routing
 * - Better context loading
 */

import * as fs from "fs";
import * as path from "path";

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
  /** Cached value */
  value: T;
  /** Cache timestamp */
  cachedAt: Date;
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Cache key */
  key: string;
  /** Cache type */
  type: CacheType;
  /** Whether cache is still valid */
  isValid: boolean;
}

export interface CacheStats {
  /** Total cache entries */
  totalEntries: number;
  /** Cache hits */
  hits: number;
  /** Cache misses */
  misses: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total memory used (approximate) */
  memoryUsed: number;
}

export interface CacheOptions {
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtlMs?: number;
  /** Maximum cache size (default: 1000 entries) */
  maxSize?: number;
  /** Whether to persist cache to disk */
  persistToDisk?: boolean;
  /** Cache directory (if persisting) */
  cacheDir?: string;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 1000;

/**
 * Execution Cache Manager
 */
export class ExecutionCacheManager {
  private cache = new Map<string, CacheEntry>();
  private options: Required<CacheOptions>;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTtlMs: options.defaultTtlMs ?? DEFAULT_TTL_MS,
      maxSize: options.maxSize ?? DEFAULT_MAX_SIZE,
      persistToDisk: options.persistToDisk ?? false,
      cacheDir: options.cacheDir ?? path.join(process.cwd(), ".zenuxs-cache"),
    };
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (!this.isEntryValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(
    key: string,
    value: T,
    type: CacheType,
    ttlMs?: number,
  ): void {
    // Enforce max size
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      value,
      cachedAt: new Date(),
      ttlMs: ttlMs ?? this.options.defaultTtlMs,
      key,
      type,
      isValid: true,
    };

    this.cache.set(key, entry);

    // Persist to disk if enabled
    if (this.options.persistToDisk) {
      this.persistEntry(entry);
    }
  }

  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries of a type
   */
  invalidateType(type: CacheType): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.type === type) {
        entry.isValid = false;
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate entries matching key pattern
   */
  invalidatePattern(pattern: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(pattern)) {
        entry.isValid = false;
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    // Approximate memory usage
    let memoryUsed = 0;
    for (const entry of this.cache.values()) {
      memoryUsed += JSON.stringify(entry.value).length;
    }

    return {
      totalEntries: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      memoryUsed,
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Check if entry is valid
   */
  private isEntryValid(entry: CacheEntry): boolean {
    if (!entry.isValid) return false;

    const age = Date.now() - entry.cachedAt.getTime();
    return age < entry.ttlMs;
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.cachedAt.getTime() < oldestTime) {
        oldestTime = entry.cachedAt.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Persist entry to disk
   */
  private persistEntry<T>(entry: CacheEntry<T>): void {
    try {
      const cachePath = path.join(this.options.cacheDir, `${entry.type}_${entry.key}.json`);
      const dir = path.dirname(cachePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(cachePath, JSON.stringify(entry), "utf-8");
    } catch (error) {
      console.error("[ExecutionCache] Failed to persist entry:", error);
    }
  }

  /**
   * Load cache from disk
   */
  loadFromDisk(): void {
    if (!this.options.persistToDisk) return;

    try {
      const cacheDir = this.options.cacheDir;
      if (!fs.existsSync(cacheDir)) return;

      const files = fs.readdirSync(cacheDir);
      let loaded = 0;

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(cacheDir, file);
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const entry = JSON.parse(content) as CacheEntry;

            // Restore dates
            entry.cachedAt = new Date(entry.cachedAt);

            if (this.isEntryValid(entry)) {
              this.cache.set(entry.key, entry);
              loaded++;
            }
          } catch {
            // Skip unreadable/corrupt files
          }
        }
      }

      console.log(`[ExecutionCache] Loaded ${loaded} entries from disk`);
    } catch (error) {
      console.error("[ExecutionCache] Failed to load from disk:", error);
    }
  }
}

/**
 * Convenience functions for common caching patterns
 */

/**
 * Cache workspace analysis result
 */
export function cacheWorkspaceAnalysis<T>(
  workspaceRoot: string,
  value: T,
  ttlMs?: number,
): void {
  const cache = getExecutionCache();
  cache.set(
    `${CacheType.WORKSPACE_ANALYSIS}:${workspaceRoot}`,
    value,
    CacheType.WORKSPACE_ANALYSIS,
    ttlMs,
  );
}

/**
 * Get cached workspace analysis
 */
export function getCachedWorkspaceAnalysis<T>(
  workspaceRoot: string,
): T | null {
  const cache = getExecutionCache();
  return cache.get<T>(`${CacheType.WORKSPACE_ANALYSIS}:${workspaceRoot}`);
}

/**
 * Cache dependency analysis result
 */
export function cacheDependencyAnalysis<T>(
  workspaceRoot: string,
  value: T,
  ttlMs?: number,
): void {
  const cache = getExecutionCache();
  cache.set(
    `${CacheType.DEPENDENCY_ANALYSIS}:${workspaceRoot}`,
    value,
    CacheType.DEPENDENCY_ANALYSIS,
    ttlMs,
  );
}

/**
 * Get cached dependency analysis
 */
export function getCachedDependencyAnalysis<T>(
  workspaceRoot: string,
): T | null {
  const cache = getExecutionCache();
  return cache.get<T>(`${CacheType.DEPENDENCY_ANALYSIS}:${workspaceRoot}`);
}

/**
 * Cache file content (short TTL)
 */
export function cacheFileContent<T>(
  filePath: string,
  value: T,
  ttlMs: number = 60000, // 1 minute
): void {
  const cache = getExecutionCache();
  cache.set(
    `${CacheType.FILE_CONTENT}:${filePath}`,
    value,
    CacheType.FILE_CONTENT,
    ttlMs,
  );
}

/**
 * Get cached file content
 */
export function getCachedFileContent<T>(
  filePath: string,
): T | null {
  const cache = getExecutionCache();
  return cache.get<T>(`${CacheType.FILE_CONTENT}:${filePath}`);
}

/**
 * Invalidate file-related caches after modification
 */
export function invalidateFileCaches(filePath: string): void {
  const cache = getExecutionCache();
  cache.invalidatePattern(filePath);
  cache.invalidateType(CacheType.WORKSPACE_ANALYSIS);
  cache.invalidateType(CacheType.SYMBOL_INDEX);
}

/**
 * Singleton instance
 */
let globalCacheManager: ExecutionCacheManager | null = null;

export function getExecutionCache(): ExecutionCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new ExecutionCacheManager();
  }
  return globalCacheManager;
}

export function resetExecutionCache(): void {
  globalCacheManager = null;
}
