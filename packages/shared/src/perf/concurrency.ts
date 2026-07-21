/**
 * Concurrency utilities for controlled parallel execution.
 *
 * All functions use a configurable concurrency limit (default 4) to
 * prevent resource exhaustion in long-running agent sessions.
 */

export interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function deferredPromise<T>(): DeferredPromise<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function pMap<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const errors: Error[] = [];

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);

  if (errors.length > 0) throw errors[0];
  return results;
}

export async function pFilter<T>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<boolean>,
  concurrency = 4,
): Promise<T[]> {
  const bools = await pMap(items, fn, concurrency);
  return items.filter((_, i) => bools[i]);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  const { promise: timeoutPromise, reject } = deferredPromise<T>();
  const timer = setTimeout(() => reject(new Error(message ?? `Timed out after ${ms}ms`)), ms);
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export function rateLimit<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  maxCalls: number,
  windowMs: number,
): (...args: TArgs) => Promise<TReturn> {
  const queue: number[] = [];
  const execQueue: Array<{ args: TArgs; resolve: (v: TReturn) => void; reject: (e: unknown) => void }> = [];

  function processQueue(): void {
    const now = Date.now();
    while (queue.length > 0 && queue[0] < now - windowMs) queue.shift();
    while (queue.length < maxCalls && execQueue.length > 0) {
      const item = execQueue.shift()!;
      queue.push(Date.now());
      fn(...item.args).then(item.resolve).catch(item.reject);
    }
  }

  return (...args: TArgs): Promise<TReturn> => {
    return new Promise((resolve, reject) => {
      execQueue.push({ args, resolve, reject });
      processQueue();
    });
  };
}
