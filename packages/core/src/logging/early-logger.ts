/**
 * Early SDK logger for components that operate before/outside of `ZenuxsCore`
 * sessions, plus a secret-hashing helper for credential diagnostics.
 */

import { createHash } from "node:crypto";
import type { BasicLogger } from "@cline/shared";

let earlyLogger: BasicLogger | undefined;

/**
 * Register the logger used by {@link sdkDebug}. Pass `undefined` to disable.
 */
export function setSdkLogger(logger: BasicLogger | undefined): void {
	earlyLogger = logger;
}

/** @internal Returns the currently registered early logger (for testing). */
export function getSdkLogger(): BasicLogger | undefined {
	return earlyLogger;
}

/**
 * Short, stable fingerprint of a secret for debug logging (8 hex digits of a
 * SHA-256 digest).
 */
export function hashSecret(value: unknown): string {
	if (typeof value !== "string" || value.length === 0) {
		return "unset";
	}
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

/**
 * Emit a debug-level SDK diagnostic message (already a formatted string).
 */
export function sdkDebug(message: string): void {
	try {
		earlyLogger?.debug(message);
	} catch {
		// Never let logging break the app.
	}
}
