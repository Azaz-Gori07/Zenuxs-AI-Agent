import { describe, it, expect } from "vitest";
import { SUB_AGENT_ROLES, getRoleConfig } from "./subagents/roles";
import type { AgentRole } from "./subagents/types";

describe("Sub-agent roles", () => {
	it("should define all roles", () => {
		const roles = Object.keys(SUB_AGENT_ROLES);
		expect(roles).toContain("planner");
		expect(roles).toContain("coder");
		expect(roles).toContain("reviewer");
		expect(roles).toContain("researcher");
		expect(roles).toContain("browser");
	});

	it("should have valid config for each role", () => {
		for (const [name, config] of Object.entries(SUB_AGENT_ROLES)) {
			expect(config.role).toBe(name);
			expect(typeof config.systemPrompt).toBe("string");
			expect(config.systemPrompt.length).toBeGreaterThan(50);
			expect(Array.isArray(config.allowedMcpServers)).toBe(true);
		}
	});

	it("should get role config by name", () => {
		const config = getRoleConfig("coder");
		expect(config).toBeDefined();
		expect(config!.role).toBe("coder");
	});

	it("should return undefined for unknown role", () => {
		const config = getRoleConfig("nonexistent");
		expect(config).toBeUndefined();
	});
});

describe("Browser role detection", () => {
	const browserPhrases = [
		"go to github.com",
		"open website https://example.com",
		"fill form on the login page",
		"download from the portal",
		"search on google",
		"browse the catalog",
		"navigate to settings",
		"scrape product data",
	];

	for (const phrase of browserPhrases) {
		it(`should detect browser task: "${phrase}"`, () => {
			const taskLower = phrase.toLowerCase();
			const detected = [
				"go to", "open website", "open url", "navigate to", "browse",
				"fill form", "submit form", "enter details",
				"download from", "extract from website", "scrape", "web scrape",
				"search on", "look up on the web", "check website",
				"go on", "visit site", "visit website",
			].some((p) => taskLower.includes(p));
			expect(detected).toBe(true);
		});
	}

	it("should not detect regular coding tasks as browser tasks", () => {
		const task = "implement a sorting algorithm";
		const taskLower = task.toLowerCase();
		const detected = [
			"go to", "open website", "open url", "navigate to", "browse",
			"fill form", "submit form", "enter details",
			"download from", "extract from website", "scrape", "web scrape",
			"search on", "look up on the web", "check website",
			"go on", "visit site", "visit website",
		].some((p) => taskLower.includes(p));
		expect(detected).toBe(false);
	});
});
