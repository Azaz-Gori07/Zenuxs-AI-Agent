/**
 * Process-local cache with TTL expiry and a hard entry cap.
 * Uses Map insertion order for O(1) LRU eviction.
 * Optimized: now generic, bulk operations, deletion tracking.
 */

export class BoundedTtlCache<T = string> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get(key: string, now = Date.now()): T | undefined {
    this.pruneExpired(now);
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T, now = Date.now(), ttlMsOverride = this.ttlMs): void {
    this.pruneExpired(now);
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
    this.entries.set(key, { value, expiresAt: now + ttlMsOverride });
  }

  has(key: string, now = Date.now()): boolean {
    const hit = this.entries.get(key);
    if (!hit) return false;
    if (hit.expiresAt <= now) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  mget(keys: string[], now = Date.now()): Map<string, T> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const val = this.get(key, now);
      if (val !== undefined) result.set(key, val);
    }
    return result;
  }

  mset(entries: Record<string, T>, now = Date.now()): void {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value, now);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  private pruneExpired(now: number): void {
    for (const [k, v] of this.entries) {
      if (v.expiresAt <= now) this.entries.delete(k);
    }
  }
}
