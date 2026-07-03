#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env from workspace root (Bun's --cwd may skip root .env)
const rootEnvPath = join(import.meta.dir, "../../../.env");
try {
	const envText = readFileSync(rootEnvPath, "utf-8");
	for (const line of envText.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		const val = trimmed.slice(eqIdx + 1).trim();
		if (key && !process.env[key]) process.env[key] = val;
	}
	} catch {}

import { isMainThread } from "node:worker_threads";
import { disposeAll, initVcr, isHubDaemonProcess, profiler } from "@cline/shared";
import { logCliProcessError } from "./logging/errors";
import {
	abortActiveRuntime,
	cleanupActiveRuntime,
	isAbortInProgress,
} from "./runtime/active-runtime";
import { writeErr } from "./utils/output";
// OPT-09: Static import for main module — avoids dynamic import overhead (~30-50ms).
// The hub daemon path uses a separate dynamic import below.
import { runCli } from "./main";

// Initialize VCR before any HTTP requests are made.
// Set CLINE_VCR=record|playback and CLINE_VCR_CASSETTE=<path> to enable.
profiler.markTimeline("process.start", "startup");
initVcr(process.env.CLINE_VCR);
profiler.markTimeline("vcr.initialized", "startup");

if (!isMainThread) {
	// Worker imports of the bundled CLI entrypoint should not start the CLI.
} else {
	let shuttingDown = false;
	let handlingFatalProcessError = false;
	const forwardSignalToRuntime = () => {
		if (shuttingDown) {
			process.exit(1);
		}
		shuttingDown = true;
		abortActiveRuntime();
	};
	process.on("SIGINT", forwardSignalToRuntime);
	process.on("SIGTERM", forwardSignalToRuntime);
	const handleFatalProcessError = (kind: string, error: unknown) => {
		if (handlingFatalProcessError) {
			process.exit(1);
		}
		handlingFatalProcessError = true;
		logCliProcessError(kind, error);
		writeErr(
			error instanceof Error ? (error.stack ?? error.message) : String(error),
		);
		cleanupActiveRuntime();
		abortActiveRuntime();
		void disposeAll().finally(() => {
			process.exit(1);
		});
	};
	process.on("uncaughtException", (error) => {
		handleFatalProcessError("uncaughtException", error);
	});
	process.on("unhandledRejection", (reason, promise) => {
		if (isAbortInProgress()) {
			// Mark the promise as handled so OpenTUI's error overlay
			// does not surface expected abort-related rejections.
			promise.catch(() => {});
			return;
		}
		handleFatalProcessError("unhandledRejection", reason);
	});

	void (async () => {
		if (isHubDaemonProcess()) {
			await import("@cline/core/hub/daemon-entry");
			return;
		}

		let exitCode = 0;
		try {
			const runCliId = profiler.start("cli.runCli", "startup");
			await runCli();
			profiler.end(runCliId);
		} catch (err) {
			logCliProcessError("runCli", err);
			writeErr(err instanceof Error ? err.message : String(err));
			cleanupActiveRuntime();
			abortActiveRuntime();
			exitCode = 1;
		} finally {
			await profiler.finish();
			await disposeAll();
		}
		process.exit(exitCode || (process.exitCode as number) || 0);
	})();
}
