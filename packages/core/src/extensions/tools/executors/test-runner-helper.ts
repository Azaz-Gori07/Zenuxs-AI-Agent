/**
 * Test Runner Helper
 *
 * Auto-detects test/lint/typecheck scripts from package.json and provides
 * structured output parsing for pass/fail counts.
 *
 * This is a helper utility (T8), not a standalone tool — it wraps the bash
 * executor to provide intelligent test/lint/typecheck detection.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentToolContext } from "@cline/shared";
import type { BashExecutor } from "../types";

export interface TestRunnerResult {
	/** The command that was executed */
	command: string;
	/** Raw output from the command */
	output: string;
	/** Detected test framework */
	framework: string | null;
	/** Number of passing tests (if parseable) */
	passed: number | null;
	/** Number of failing tests (if parseable) */
	failed: number | null;
	/** Number of skipped tests (if parseable) */
	skipped: number | null;
	/** Whether the command succeeded */
	success: boolean;
}

export interface DetectedScripts {
	test: string | null;
	lint: string | null;
	typecheck: string | null;
}

/**
 * Detect test/lint/typecheck scripts from the nearest package.json.
 */
export async function detectScripts(cwd: string): Promise<DetectedScripts> {
	const result: DetectedScripts = { test: null, lint: null, typecheck: null };

	try {
		const pkgPath = path.join(cwd, "package.json");
		const raw = await fs.readFile(pkgPath, "utf-8");
		const pkg = JSON.parse(raw);
		const scripts = pkg.scripts ?? {};

		result.test = scripts.test ?? null;
		result.lint = scripts.lint ?? null;
		result.typecheck =
			scripts.typecheck ?? scripts["type-check"] ?? scripts["tsc"] ?? null;
	} catch {
		// No package.json or malformed — return nulls
	}

	return result;
}

/**
 * Parse test output to extract pass/fail/skip counts.
 * Supports common frameworks: vitest, jest, mocha, pytest, go test.
 */
export function parseTestOutput(
	output: string,
): { passed: number | null; failed: number | null; skipped: number | null; framework: string | null } {
	// Vitest: "Tests  5 passed (5)" or "Test Files  1 passed (1)"
	const vitestMatch = output.match(/Tests\s+(\d+)\s+passed.*?(?:(\d+)\s+failed)?.*?(?:(\d+)\s+skipped)?/);
	if (vitestMatch) {
		return {
			passed: parseInt(vitestMatch[1], 10),
			failed: vitestMatch[2] ? parseInt(vitestMatch[2], 10) : null,
			skipped: vitestMatch[3] ? parseInt(vitestMatch[3], 10) : null,
			framework: "vitest",
		};
	}

	// Jest: "Tests: 5 passed, 1 failed, 2 skipped, 8 total"
	const jestMatch = output.match(/Tests:\s*(?:(\d+)\s+passed)?(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+skipped)?/);
	if (jestMatch) {
		return {
			passed: jestMatch[1] ? parseInt(jestMatch[1], 10) : null,
			failed: jestMatch[2] ? parseInt(jestMatch[2], 10) : null,
			skipped: jestMatch[3] ? parseInt(jestMatch[3], 10) : null,
			framework: "jest",
		};
	}

	// pytest: "5 passed, 1 failed, 2 skipped"
	const pytestMatch = output.match(/(\d+)\s+passed(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+(?:skipped|deselected))?/);
	if (pytestMatch) {
		return {
			passed: parseInt(pytestMatch[1], 10),
			failed: pytestMatch[2] ? parseInt(pytestMatch[2], 10) : null,
			skipped: pytestMatch[3] ? parseInt(pytestMatch[3], 10) : null,
			framework: "pytest",
		};
	}

	// go test: "ok  	pkg	0.123s" or "FAIL	pkg	0.123s"
	if (output.includes("FAIL") || output.match(/^ok\s+/m)) {
		const fails = (output.match(/^FAIL\s+/gm) ?? []).length;
		const passes = (output.match(/^ok\s+/gm) ?? []).length;
		return {
			passed: passes || null,
			failed: fails || null,
			skipped: null,
			framework: "go-test",
		};
	}

	return { passed: null, failed: null, skipped: null, framework: null };
}

/**
 * Create a test runner helper that wraps the bash executor.
 */
export function createTestRunnerHelper(
	bashExecutor: BashExecutor,
): (
	action: "test" | "lint" | "typecheck",
	cwd: string,
	context: AgentToolContext,
) => Promise<TestRunnerResult> {
	return async (action, cwd, context) => {
		const scripts = await detectScripts(cwd);

		let command: string;
		switch (action) {
			case "test":
				command = scripts.test ?? "echo 'No test script found in package.json'";
				break;
			case "lint":
				command = scripts.lint ?? "echo 'No lint script found in package.json'";
				break;
			case "typecheck":
				command = scripts.typecheck ?? "echo 'No typecheck script found in package.json'";
				break;
		}

		try {
			const output = await bashExecutor(command, cwd, context);
			const parsed = parseTestOutput(output);
			return {
				command,
				output,
				...parsed,
				success: true,
			};
		} catch (error) {
			const output = error instanceof Error ? error.message : String(error);
			const parsed = parseTestOutput(output);
			return {
				command,
				output,
				...parsed,
				success: false,
			};
		}
	};
}
