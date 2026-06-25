import { describe, expect, it } from "vitest";
import {
	buildSystemPrompt,
	isWrappedSystemUpdate,
	normalizeSystemInput,
	renderSystemPart,
	renderSystemParts,
	systemText,
	systemUpdate,
	unwrapSystemUpdate,
	wrapSystemUpdate,
} from "./system-part";

describe("systemText", () => {
	it("creates a text system part", () => {
		const part = systemText("Hello world");
		expect(part).toEqual({ type: "text", text: "Hello world" });
	});

	it("creates a text system part with cache hint", () => {
		const part = systemText("Hello", "ephemeral");
		expect(part.cache).toBe("ephemeral");
	});

	it("creates a text system part with metadata", () => {
		const part = systemText("Hello", undefined, { key: "value" });
		expect(part.metadata).toEqual({ key: "value" });
	});
});

describe("systemUpdate", () => {
	it("creates a system update content block", () => {
		const update = systemUpdate("New instructions");
		expect(update).toEqual({ type: "system-update", text: "New instructions" });
	});
});

describe("renderSystemPart", () => {
	it("renders a text part to its string", () => {
		expect(renderSystemPart(systemText("Hello"))).toBe("Hello");
	});
});

describe("renderSystemParts", () => {
	it("renders multiple parts joined by double newlines", () => {
		const parts = [systemText("First"), systemText("Second")];
		expect(renderSystemParts(parts)).toBe("First\n\nSecond");
	});
});

describe("buildSystemPrompt", () => {
	it("returns just the base when no parts", () => {
		expect(buildSystemPrompt("Base")).toBe("Base");
	});

	it("appends parts after the base", () => {
		const result = buildSystemPrompt("Base", [systemText("Extra")]);
		expect(result).toBe("Base\n\nExtra");
	});

	it("handles undefined base", () => {
		const result = buildSystemPrompt(undefined, [systemText("Extra")]);
		expect(result).toBe("Extra");
	});

	it("returns empty string for undefined base and no parts", () => {
		expect(buildSystemPrompt(undefined)).toBe("");
	});
});

describe("normalizeSystemInput", () => {
	it("normalizes a string to a single text part", () => {
		const parts = normalizeSystemInput("Hello");
		expect(parts).toHaveLength(1);
		expect(parts[0].text).toBe("Hello");
	});

	it("returns empty array for undefined", () => {
		expect(normalizeSystemInput(undefined)).toEqual([]);
	});

	it("returns empty array for empty string", () => {
		expect(normalizeSystemInput("")).toEqual([]);
	});

	it("passes through an array of system parts", () => {
		const input = [systemText("Hello")];
		expect(normalizeSystemInput(input)).toBe(input);
	});
});

describe("wrapSystemUpdate", () => {
	it("wraps text in system-update XML", () => {
		const wrapped = wrapSystemUpdate("Update text");
		expect(wrapped).toBe("<system-update>\nUpdate text\n</system-update>");
	});

	it("escapes XML special characters", () => {
		const wrapped = wrapSystemUpdate("a < b & c > d");
		expect(wrapped).toContain("a &lt; b &amp; c &gt; d");
	});
});

describe("isWrappedSystemUpdate", () => {
	it("detects a wrapped system update", () => {
		expect(isWrappedSystemUpdate("<system-update>\ntext\n</system-update>")).toBe(true);
	});

	it("returns false for plain text", () => {
		expect(isWrappedSystemUpdate("plain text")).toBe(false);
	});
});

describe("unwrapSystemUpdate", () => {
	it("unwraps and unescapes a wrapped update", () => {
		const wrapped = wrapSystemUpdate("a < b");
		expect(unwrapSystemUpdate(wrapped)).toBe("a < b");
	});
});
