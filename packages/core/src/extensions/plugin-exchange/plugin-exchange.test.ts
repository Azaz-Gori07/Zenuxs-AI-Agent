import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginExchange, PluginExchangeError } from "./plugin-exchange";

function fixture(publisherType: "official" | "community" = "community") {
	const root = mkdtempSync(join(tmpdir(), "plugin-exchange-"));
	const pluginDir = join(root, "hello");
	mkdirSync(pluginDir, { recursive: true });
	writeFileSync(
		join(pluginDir, "plugin.json"),
		JSON.stringify({
			name: "hello",
			version: "1.2.3",
			hooks: [
				{
					event: "PreToolUse",
					type: "process",
					command: "/bin/true",
					args: [],
				},
			],
		}),
	);
	const descriptor = join(root, "marketplace.json");
	writeFileSync(
		descriptor,
		JSON.stringify({
			name: "community-market",
			publisherType,
			plugins: [{ name: "hello", path: "hello", version: "1.2.3" }],
		}),
	);
	const exchange = new PluginExchange(join(root, "data"));
	return { root, pluginDir, descriptor, exchange };
}

describe("plugin exchange (security)", () => {
	it("rejects a self-certified official marketplace", () => {
		const { root, descriptor, exchange } = fixture("official");
		try {
			expect(() => exchange.addMarketplace(descriptor, "zenuxs-official")).toThrow(
				/trusted installation source/,
			);
			expect(exchange.listMarketplaces()).toEqual([]);
			// A trusted caller may register it with an explicit opt-in.
			const source = exchange.addMarketplace(descriptor, "zenuxs-official", {
				trustedOfficial: true,
			});
			expect(source.publisherType).toBe("official");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("rejects a source claiming a reserved official id", () => {
		const { root, descriptor, exchange } = fixture();
		try {
			expect(() => exchange.addMarketplace(descriptor, "zenuxs-official")).toThrow(
				PluginExchangeError,
			);
			expect(exchange.listMarketplaces()).toEqual([]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("refuses to install a plugin whose path escapes the marketplace root", () => {
		const { root, descriptor, exchange } = fixture();
		try {
			writeFileSync(
				descriptor,
				JSON.stringify({
					name: "community-market",
					publisherType: "community",
					plugins: [{ name: "evil", path: "../../etc" }],
				}),
			);
			exchange.addMarketplace(descriptor);
			expect(() => exchange.install("evil@community-market")).toThrow(
				PluginExchangeError,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("install does not enable; enable/disable are explicit and hooks remain ungranted", () => {
		const { root, descriptor, exchange } = fixture();
		try {
			exchange.addMarketplace(descriptor);
			const available = exchange.available();
			expect(available[0]?.id).toBe("hello@community-market");
			const installed = exchange.install("hello@community-market");
			expect(installed.enabled).toBe(false);
			expect(exchange.list()[0]?.enabled).toBe(false);
			expect(exchange.hooksFor(installed.id)).toHaveLength(1);
			expect(exchange.publisherTypeOf(installed.id)).toBe("community");
			exchange.setEnabled(installed.id, true);
			expect(exchange.list()[0]?.enabled).toBe(true);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("validate is read-only and reports escaping component paths", () => {
		const { root, pluginDir, exchange } = fixture();
		try {
			writeFileSync(
				join(pluginDir, "plugin.json"),
				JSON.stringify({ name: "hello", skills: ["../../etc/passwd"] }),
			);
			const result = exchange.validate(pluginDir);
			expect(result.ok).toBe(false);
			expect(result.diagnostics.join("\n")).toContain("escapes");
			expect(existsSync(join(root, "data", "plugin-exchange", "installed.json"))).toBe(
				false,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("removing a marketplace source keeps installed plugins as orphans", () => {
		const { root, descriptor, exchange } = fixture();
		try {
			exchange.addMarketplace(descriptor, "custom");
			const installed = exchange.install("hello@custom");
			expect(existsSync(installed.path)).toBe(true);
			exchange.removeMarketplace("custom");
			expect(exchange.list()).toHaveLength(1);
			expect(exchange.available()).toHaveLength(0);
			expect(exchange.publisherTypeOf("hello@custom")).toBe("community");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("fails closed on a corrupt marketplace registry", () => {
		const { root, exchange } = fixture();
		try {
			const state = join(root, "data", "plugin-exchange");
			mkdirSync(state, { recursive: true });
			writeFileSync(join(state, "marketplaces.json"), "not json");
			expect(() => exchange.listMarketplaces()).toThrow(PluginExchangeError);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("persists state atomically", () => {
		const { root, descriptor, exchange } = fixture();
		try {
			exchange.addMarketplace(descriptor);
			const state = join(root, "data", "plugin-exchange", "marketplaces.json");
			expect(JSON.parse(readFileSync(state, "utf8")).sources).toHaveLength(1);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
