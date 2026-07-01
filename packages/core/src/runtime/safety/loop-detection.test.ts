/**
 * Unit tests for LoopDetectionTracker and pure helpers.
 *
 * Covers:
 * - toolCallSignature: deterministic canonical serialization
 * - checkRepeatedToolCall: consecutive-identical counting + flip-flop detection
 * - LoopDetectionTracker class: ok/soft/hard verdicts, reset
 */

import { describe, expect, it } from "vitest";
import {
	createLoopDetectionState,
	resetLoopDetectionState,
	toolCallSignature,
	checkRepeatedToolCall,
	LoopDetectionTracker,
} from "./loop-detection";

// =============================================================================
// toolCallSignature
// =============================================================================

describe("toolCallSignature", () => {
	it("returns 'null' for null/undefined", () => {
		expect(toolCallSignature(null)).toBe("null");
		expect(toolCallSignature(undefined)).toBe("null");
	});

	it("returns the string itself for string input", () => {
		expect(toolCallSignature("hello")).toBe("hello");
	});

	it("returns stringified number/boolean", () => {
		expect(toolCallSignature(42)).toBe("42");
		expect(toolCallSignature(true)).toBe("true");
	});

	it("sorts object keys for deterministic signatures", () => {
		const a = toolCallSignature({ x: 1, a: 2 });
		const b = toolCallSignature({ a: 2, x: 1 });
		expect(a).toBe(b);
	});

	it("handles nested objects with sorted keys", () => {
		const a = toolCallSignature({ z: { b: 1, a: 2 }, a: 3 });
		const b = toolCallSignature({ a: 3, z: { a: 2, b: 1 } });
		expect(a).toBe(b);
	});

	it("handles arrays", () => {
		const sig = toolCallSignature([1, 2, 3]);
		expect(sig).toBe("[1,2,3]");
	});
});

// =============================================================================
// checkRepeatedToolCall — consecutive identical detection
// =============================================================================

describe("checkRepeatedToolCall — consecutive identical", () => {
	const config = { softThreshold: 3, hardThreshold: 5 };

	it("returns ok for first call", () => {
		const state = createLoopDetectionState();
		const result = checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		expect(result.softWarning).toBe(false);
		expect(result.hardEscalation).toBe(false);
	});

	it("increments consecutiveIdenticalCount for repeated calls", () => {
		const state = createLoopDetectionState();
		checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		const result = checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		expect(state.consecutiveIdenticalCount).toBe(3);
		expect(result.softWarning).toBe(true);
		expect(result.hardEscalation).toBe(false);
	});

	it("resets count when tool changes", () => {
		const state = createLoopDetectionState();
		checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		checkRepeatedToolCall(state, "write_file", '{"path":"bar.ts"}', config);
		expect(state.consecutiveIdenticalCount).toBe(1);
	});

	it("triggers hard escalation at hardThreshold", () => {
		const state = createLoopDetectionState();
		for (let i = 0; i < 5; i++) {
			checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		}
		expect(state.consecutiveIdenticalCount).toBe(5);
		const result = checkRepeatedToolCall(state, "read_file", '{"path":"foo.ts"}', config);
		expect(result.hardEscalation).toBe(true);
	});

	it("different inputs with same tool name reset count", () => {
		const state = createLoopDetectionState();
		checkRepeatedToolCall(state, "read_file", '{"path":"a.ts"}', config);
		checkRepeatedToolCall(state, "read_file", '{"path":"b.ts"}', config);
		expect(state.consecutiveIdenticalCount).toBe(1);
	});
});

// =============================================================================
// checkRepeatedToolCall — flip-flop detection
// =============================================================================

describe("checkRepeatedToolCall — flip-flop detection", () => {
	const config = { softThreshold: 10, hardThreshold: 20 }; // high thresholds to isolate flip-flop

	it("detects alternating between two tool calls", () => {
		const state = createLoopDetectionState();
		// Alternate: A, B, A, B, A, B
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"b.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"b.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		expect(state.flipFlopCount).toBeGreaterThanOrEqual(2);
	});

	it("triggers hard escalation after 3+ flip-flops", () => {
		const state = createLoopDetectionState();
		// Need 3+ alternations: A, B, A, B, A, B, A
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"b.ts"}', config); // flip-flop 1
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config); // flip-flop 2
		checkRepeatedToolCall(state, "edit", '{"file":"b.ts"}', config); // flip-flop 3
		const result = checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		expect(state.flipFlopCount).toBeGreaterThanOrEqual(3);
		expect(result.hardEscalation).toBe(true);
	});

	it("resets flip-flop count when a third distinct input appears", () => {
		const state = createLoopDetectionState();
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"b.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		// Now introduce a third distinct input
		checkRepeatedToolCall(state, "edit", '{"file":"c.ts"}', config);
		expect(state.flipFlopCount).toBe(0);
	});

	it("does not count same-input repeats as flip-flops", () => {
		const state = createLoopDetectionState();
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		checkRepeatedToolCall(state, "edit", '{"file":"a.ts"}', config);
		expect(state.flipFlopCount).toBe(0);
	});
});

// =============================================================================
// resetLoopDetectionState
// =============================================================================

describe("resetLoopDetectionState", () => {
	it("clears all fields including flip-flop state", () => {
		const state = createLoopDetectionState();
		state.lastToolName = "edit";
		state.lastToolSignature = '{"file":"a.ts"}';
		state.consecutiveIdenticalCount = 5;
		state.previousToolName = "edit";
		state.previousToolSignature = '{"file":"b.ts"}';
		state.flipFlopCount = 3;

		resetLoopDetectionState(state);

		expect(state.lastToolName).toBe("");
		expect(state.lastToolSignature).toBe("");
		expect(state.consecutiveIdenticalCount).toBe(0);
		expect(state.previousToolName).toBeUndefined();
		expect(state.previousToolSignature).toBeUndefined();
		expect(state.flipFlopCount).toBe(0);
	});
});

// =============================================================================
// LoopDetectionTracker class
// =============================================================================

describe("LoopDetectionTracker", () => {
	it("returns 'ok' for varied calls", () => {
		const tracker = new LoopDetectionTracker();
		expect(tracker.inspect({ name: "read", input: { path: "a" } }).kind).toBe("ok");
		expect(tracker.inspect({ name: "read", input: { path: "b" } }).kind).toBe("ok");
		expect(tracker.inspect({ name: "write", input: { path: "c" } }).kind).toBe("ok");
	});

	it("returns 'soft' at softThreshold", () => {
		const tracker = new LoopDetectionTracker({ softThreshold: 3, hardThreshold: 5 });
		tracker.inspect({ name: "read", input: { path: "a" } });
		tracker.inspect({ name: "read", input: { path: "a" } });
		// 3rd identical call hits softThreshold=3 exactly
		const verdict = tracker.inspect({ name: "read", input: { path: "a" } });
		expect(verdict.kind).toBe("soft");
		expect(verdict.message).toContain("consider trying a different approach");
	});

	it("returns 'hard' at hardThreshold", () => {
		const tracker = new LoopDetectionTracker({ softThreshold: 2, hardThreshold: 4 });
		for (let i = 0; i < 4; i++) {
			tracker.inspect({ name: "read", input: { path: "a" } });
		}
		const verdict = tracker.inspect({ name: "read", input: { path: "a" } });
		expect(verdict.kind).toBe("hard");
		expect(verdict.message).toContain("stopping to avoid a loop");
	});

	it("resets all state", () => {
		const tracker = new LoopDetectionTracker({ softThreshold: 2, hardThreshold: 5 });
		tracker.inspect({ name: "read", input: { path: "a" } });
		tracker.inspect({ name: "read", input: { path: "a" } });
		tracker.reset();
		const verdict = tracker.inspect({ name: "read", input: { path: "a" } });
		expect(verdict.kind).toBe("ok");
	});

	it("detects flip-flop pattern and escalates to hard", () => {
		const tracker = new LoopDetectionTracker({ softThreshold: 10, hardThreshold: 20 });
		tracker.inspect({ name: "edit", input: { file: "a.ts" } });
		tracker.inspect({ name: "edit", input: { file: "b.ts" } });
		tracker.inspect({ name: "edit", input: { file: "a.ts" } });
		tracker.inspect({ name: "edit", input: { file: "b.ts" } });
		tracker.inspect({ name: "edit", input: { file: "a.ts" } });
		const verdict = tracker.inspect({ name: "edit", input: { file: "b.ts" } });
		expect(verdict.kind).toBe("hard");
	});

	it("uses default config when none provided", () => {
		const tracker = new LoopDetectionTracker();
		// Default: softThreshold=3, hardThreshold=5
		tracker.inspect({ name: "read", input: "a" });
		tracker.inspect({ name: "read", input: "a" });
		const soft = tracker.inspect({ name: "read", input: "a" });
		expect(soft.kind).toBe("soft");
	});
});
