/**
 * Lightweight performance measurement decorators.
 * Usage: @Measured or measure("label", () => fn())
 */

const measurements = new Map<string, { count: number; totalMs: number; maxMs: number }>();

export function getMeasurements(): Record<string, { count: number; avgMs: number; totalMs: number; maxMs: number }> {
  const result: Record<string, { count: number; avgMs: number; totalMs: number; maxMs: number }> = {};
  for (const [key, val] of measurements) {
    result[key] = { count: val.count, avgMs: val.totalMs / val.count, totalMs: val.totalMs, maxMs: val.maxMs };
  }
  return result;
}

export function resetMeasurements(): void {
  measurements.clear();
}

export function measure<T>(label: string, fn: () => T): T;
export function measure<T>(label: string, fn: () => Promise<T>): Promise<T>;
export function measure<T>(label: string, fn: (() => T) | (() => Promise<T>)): T | Promise<T> {
  const start = performance.now();
  const result = fn();
  if (result instanceof Promise) {
    return result.finally(() => record(label, performance.now() - start)) as Promise<T>;
  }
  record(label, performance.now() - start);
  return result;
}

function record(label: string, durationMs: number): void {
  const prev = measurements.get(label);
  if (prev) {
    prev.count++;
    prev.totalMs += durationMs;
    if (durationMs > prev.maxMs) prev.maxMs = durationMs;
  } else {
    measurements.set(label, { count: 1, totalMs: durationMs, maxMs: durationMs });
  }
}

export function Measured(target: object, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
  const original = descriptor.value;
  const label = `${target.constructor?.name ?? ""}.${propertyKey}`;
  if (original.constructor.name === "AsyncFunction") {
    descriptor.value = async function (...args: unknown[]) {
      return measure(label, () => original.apply(this, args));
    };
  } else {
    descriptor.value = function (...args: unknown[]) {
      return measure(label, () => original.apply(this, args));
    };
  }
  return descriptor;
}
