/**
 * Error‑message sub-strings that indicate an auth / credential failure.
 * Used with provider auth handlers to decide whether a failed API call should
 * trigger an OAuth refresh.
 */
export const AUTH_ERROR_PATTERNS = [
	"401",
	"403",
	"unauthorized",
	"forbidden",
	"invalid token",
	"expired token",
	"no token provided",
	"token provided",
	"no token",
	"missing token",
	"no api key",
	"unauthenticated",
	"authentication",
] as const;

/**
 * Returns `true` when `error` looks like an authentication failure.
 */
export function isLikelyAuthError(error: unknown): boolean {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error);
	return AUTH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Substrings that indicate the request exceeded the model's context window.
 */
export const CONTEXT_LENGTH_ERROR_PATTERNS = [
	"maximum context length",
	"context_length_exceeded",
	"context window",
	"tokens exceeds",
	"exceeds the maximum",
] as const;

/**
 * Returns `true` when `error` indicates the request exceeded the model's
 * context window (i.e. too many tokens were sent).
 */
export function isContextLengthError(error: unknown): boolean {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	return CONTEXT_LENGTH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Substrings that indicate the model returned an empty response.
 * This often happens when the context is so full the model cannot
 * produce any output tokens.
 */
export const EMPTY_MODEL_OUTPUT_PATTERNS = [
	"model output must contain either output text or tool calls",
	"output text or tool calls, these cannot both be empty",
	"no output generated",
	"empty model response",
] as const;

/**
 * Returns `true` when `error` indicates the model returned an empty
 * response (no text and no tool calls).  This commonly happens when the
 * context window is nearly exhausted and the model has no budget left
 * for a response.
 */
export function isEmptyModelOutputError(error: unknown): boolean {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	return EMPTY_MODEL_OUTPUT_PATTERNS.some((pattern) => message.includes(pattern));
}
