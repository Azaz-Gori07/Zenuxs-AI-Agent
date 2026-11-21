import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveClineDataDir } from "@cline/shared/storage";

/** Toast messages vanish; persist the full connection error for diagnosis. */
export function logConnectionFailure(
	providerId: string,
	error: unknown,
	diagnostics?: Record<string, unknown>,
): string {
	const filePath = join(resolveClineDataDir(), "logs", "connect-failures.log");
	const detail =
		error instanceof Error
			? {
					message: error.message,
					name: error.name,
					stack: error.stack,
					cause:
						error.cause instanceof Error
							? {
									message: error.cause.message,
									code: (error.cause as NodeJS.ErrnoException).code,
								}
							: error.cause
								? String(error.cause)
								: undefined,
				}
			: { message: String(error) };
	mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
	appendFileSync(
		filePath,
		`${JSON.stringify({
			timestamp: new Date().toISOString(),
			providerId,
			...detail,
			...(diagnostics ?? {}),
		})}\n`,
		{ encoding: "utf8", mode: 0o600 },
	);
	return filePath;
}

export * as ConnectErrorLog from "./connect-error-log";
