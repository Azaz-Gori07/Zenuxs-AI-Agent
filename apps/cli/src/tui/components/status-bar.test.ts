import { describe, expect, it, vi } from "vitest";
import {
	createContextBar,
	formatStatusBarUsageText,
	resolveContextBarFilledForeground,
} from "./status-bar";

vi.mock("@opentui/react", () => ({
	useTerminalDimensions: () => ({ width: 80, height: 24 }),
}));

describe("createContextBar", () => {
	it("keeps a stable width while changing segment lengths", () => {
		expect(createContextBar(0, 100)).toEqual({ filled: "", empty: "........" });
		expect(createContextBar(50, 100)).toEqual({ filled: "####", empty: "...." });
		expect(createContextBar(100, 100)).toEqual({ filled: "########", empty: "" });
	});

	it("shows a non-empty fill when usage is above zero", () => {
		expect(createContextBar(7_000, 1_000_000)).toEqual({
			filled: "#",
			empty: ".......",
		});
	});

	it("reserves the final segment for usage at or above the limit", () => {
		expect(createContextBar(999_999, 1_000_000)).toEqual({
			filled: "#######",
			empty: ".",
		});
		expect(createContextBar(1_000_000, 1_000_000)).toEqual({
			filled: "########",
			empty: "",
		});
	});

	it("uses explicit white when terminal foreground would inherit gray", () => {
		expect(resolveContextBarFilledForeground(undefined)).toBe("#ffffff");
		expect(resolveContextBarFilledForeground("#1a1a1a")).toBe("#1a1a1a");
	});
});

describe("formatStatusBarUsageText", () => {
	it("includes cost when usage cost display is enabled", () => {
		expect(
			formatStatusBarUsageText({
				totalTokens: 1234,
				totalCost: 0.5,
				showCost: true,
			}),
		).toBe("(1,234) $0.50");
	});

	it("omits cost when usage cost display is disabled", () => {
		expect(
			formatStatusBarUsageText({
				totalTokens: 1234,
				totalCost: 0.5,
				showCost: false,
			}),
		).toBe("(1,234)");
	});
});
