/**
 * Unit tests for MistakeTracker and pure helpers.
 *
 * Covers:
 * - MistakeTracker: consecutive counting, cumulative tracking, reset behavior
 * - MistakeTracker: stop/continue decisions at limit
 * - buildMistakeLimitStopMessage: message formatting
 */

import { describe, expect, it, vi } from "vitest";
import {
	MistakeTracker,
	buildMistakeLimitStopMessage,
	type MistakeTrackerOptions,
} from "./mistake-tracker";

function createMockOptions(
	overrides?: Partial<MistakeTrackerOptions>,
): MistakeTrackerOptions {
	return {
		maxConsecutiveMistakes: 3,
		emit: vi.fn(),
		log: vi.fn(),
		agentId: "test-agent",
		getConversationId: () => "conv-1",
		getActiveRunId: () => "run-1",
		appendRecoveryNotice: vi.fn(),
		...overrides,
	};
}

// =============================================================================
// MistakeTracker — consecutive counting
// =============================================================================

describe("MistakeTracker — consecutive counting", () => {
	it("starts at zero", () => {
		const tracker = new MistakeTracker(createMockOptions());
		expect(tracker.value).toBe(0);
		expect(tracker.cumulative).toBe(0);
	});

	it("increments consecutive on each record", async () => {
		const tracker = new MistakeTracker(createMockOptions({ maxConsecutiveMistakes: 10 }));
		await tracker.record({ iteration: 1, reason: "api_error" });
		expect(tracker.value).toBe(1);
		await tracker.record({ iteration: 2, reason: "api_error" });
		expect(tracker.value).toBe(2);
	});

	it("increments cumulative on each record", async () => {
		const tracker = new MistakeTracker(createMockOptions({ maxConsecutiveMistakes: 10 }));
		await tracker.record({ iteration: 1, reason: "api_error" });
		expect(tracker.cumulative).toBe(1);
		await tracker.record({ iteration: 2, reason: "invalid_tool_call" });
		expect(tracker.cumulative).toBe(2);
		await tracker.record({ iteration: 3, reason: "tool_execution_failed" });
		expect(tracker.cumulative).toBe(3);
	});

	it("returns 'continue' when below max", async () => {
		const tracker = new MistakeTracker(createMockOptions({ maxConsecutiveMistakes: 5 }));
		const outcome = await tracker.record({ iteration: 1, reason: "api_error" });
		expect(outcome.action).toBe("continue");
	});
});

// =============================================================================
// MistakeTracker — cumulative tracking (Phase 4 feature)
// =============================================================================

describe("MistakeTracker — cumulative budget", () => {
	it("cumulative survives reset (tracks entire session)", async () => {
		const tracker = new MistakeTracker(createMockOptions({ maxConsecutiveMistakes: 10 }));
		await tracker.record({ iteration: 1, reason: "api_error" });
		await tracker.record({ iteration: 2, reason: "api_error" });
		await tracker.record({ iteration: 3, reason: "api_error" });
		expect(tracker.cumulative).toBe(3);

		tracker.reset();
		expect(tracker.value).toBe(0); // consecutive resets
		expect(tracker.cumulative).toBe(3); // cumulative persists
	});

	it("cumulative continues after reset", async () => {
		const tracker = new MistakeTracker(createMockOptions({ maxConsecutiveMistakes: 10 }));
		await tracker.record({ iteration: 1, reason: "api_error" });
		await tracker.record({ iteration: 2, reason: "api_error" });
		tracker.reset();
		await tracker.record({ iteration: 3, reason: "api_error" });
		expect(tracker.value).toBe(1);
		expect(tracker.cumulative).toBe(3);
	});

	it("logs cumulative count in metadata", async () => {
		const logFn = vi.fn();
		const tracker = new MistakeTracker(
			createMockOptions({ maxConsecutiveMistakes: 10, log: logFn as any }),
		);
		await tracker.record({ iteration: 1, reason: "api_error", details: "test error" });
		expect(logFn).toHaveBeenCalledWith(
			"warn",
			"Recorded consecutive mistake",
			expect.objectContaining({ cumulativeMistakes: 1 }),
		);
		await tracker.record({ iteration: 2, reason: "api_error" });
		expect(logFn).toHaveBeenCalledWith(
			"warn",
			"Recorded consecutive mistake",
			expect.objectContaining({ cumulativeMistakes: 2 }),
		);
	});
});

// =============================================================================
// MistakeTracker — stop at limit
// =============================================================================

describe("MistakeTracker — stop at limit", () => {
	it("returns 'stop' when consecutive reaches max (no callback)", async () => {
		const tracker = new MistakeTracker(createMockOptions({ maxConsecutiveMistakes: 2 }));
		await tracker.record({ iteration: 1, reason: "api_error" });
		const outcome = await tracker.record({ iteration: 2, reason: "api_error" });
		expect(outcome.action).toBe("stop");
		expect((outcome as any).message).toContain("2/2");
	});

	it("forceAtLimit jumps directly to max", async () => {
		const tracker = new MistakeTracker(createMockOptions({ maxConsecutiveMistakes: 5 }));
		const outcome = await tracker.record({
			iteration: 1,
			reason: "tool_execution_failed",
			forceAtLimit: true,
		});
		expect(outcome.action).toBe("stop");
		expect(tracker.value).toBe(5);
	});

	it("onLimitReached callback can return 'continue' with guidance", async () => {
		const tracker = new MistakeTracker(
			createMockOptions({
				maxConsecutiveMistakes: 2,
				onLimitReached: () => ({
					action: "continue" as const,
					guidance: "Try a different approach",
				}),
			}),
		);
		await tracker.record({ iteration: 1, reason: "api_error" });
		const outcome = await tracker.record({ iteration: 2, reason: "api_error" });
		expect(outcome.action).toBe("continue");
		expect((outcome as any).guidance).toBe("Try a different approach");
		// Consecutive resets after continue
		expect(tracker.value).toBe(0);
	});

	it("onLimitReached callback can return 'stop'", async () => {
		const tracker = new MistakeTracker(
			createMockOptions({
				maxConsecutiveMistakes: 2,
				onLimitReached: () => ({
					action: "stop" as const,
					reason: "Too many failures",
				}),
			}),
		);
		await tracker.record({ iteration: 1, reason: "api_error" });
		const outcome = await tracker.record({ iteration: 2, reason: "api_error" });
		expect(outcome.action).toBe("stop");
	});

	it("emits error event on each record", async () => {
		const emitFn = vi.fn();
		const tracker = new MistakeTracker(
			createMockOptions({ maxConsecutiveMistakes: 10, emit: emitFn as any }),
		);
		await tracker.record({ iteration: 1, reason: "api_error", details: "timeout" });
		expect(emitFn).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "error",
				recoverable: true,
				iteration: 1,
			}),
		);
	});

	it("appendRecoveryNotice called when callback returns guidance", async () => {
		const appendFn = vi.fn();
		const tracker = new MistakeTracker(
			createMockOptions({
				maxConsecutiveMistakes: 1,
				onLimitReached: () => ({
					action: "continue" as const,
					guidance: "Try something else",
				}),
				appendRecoveryNotice: appendFn,
			}),
		);
		await tracker.record({ iteration: 1, reason: "api_error" });
		expect(appendFn).toHaveBeenCalledWith("Try something else", "api_error");
	});
});

// =============================================================================
// buildMistakeLimitStopMessage
// =============================================================================

describe("buildMistakeLimitStopMessage", () => {
	it("includes mistake count and reason", () => {
		const msg = buildMistakeLimitStopMessage({
			iteration: 10,
			consecutiveMistakes: 3,
			maxConsecutiveMistakes: 3,
			reason: "api_error",
		});
		expect(msg).toContain("3/3");
		expect(msg).toContain("api_error");
		expect(msg).toContain("iteration 10");
	});

	it("includes details when provided", () => {
		const msg = buildMistakeLimitStopMessage({
			iteration: 5,
			consecutiveMistakes: 2,
			maxConsecutiveMistakes: 3,
			reason: "tool_execution_failed",
			details: "Connection refused",
		});
		expect(msg).toContain("Connection refused");
	});

	it("includes stop reason when provided", () => {
		const msg = buildMistakeLimitStopMessage({
			iteration: 5,
			consecutiveMistakes: 3,
			maxConsecutiveMistakes: 3,
			reason: "api_error",
			stopReason: "User requested stop",
		});
		expect(msg).toContain("User requested stop");
	});

	it("always includes resume guidance", () => {
		const msg = buildMistakeLimitStopMessage({
			iteration: 1,
			consecutiveMistakes: 1,
			maxConsecutiveMistakes: 1,
			reason: "api_error",
		});
		expect(msg).toContain("Send a new prompt to resume");
	});
});
