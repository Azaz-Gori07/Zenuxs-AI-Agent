import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { HookDeclaration } from "../../governance/hooks/hook-declaration";

export const RESERVED_OFFICIAL_MARKETS = new Set([
	"zenuxs-official",
	"zenuxs-curated",
]);

export interface PluginManifest {
	name: string;
	version: string;
	description?: string;
	hooks?: Array<Record<string, unknown>>;
	commands?: string[];
	skills?: string[];
	mcpServers?: Record<string, unknown>;
}

export interface MarketplaceDescriptor {
	name: string;
	publisherType: "official" | "community";
	plugins: Array<{ name: string; path?: string; version?: string }>;
}

export interface MarketplaceSource {
	id: string;
	descriptorPath: string;
	publisherType: "official" | "community";
	addedAt: string;
}

export interface AddMarketplaceOptions {
	/** Only a trusted caller (never the CLI) may register an official source. */
	trustedOfficial?: boolean;
}

export interface AvailablePlugin {
	id: string;
	name: string;
	marketplace: string;
	publisherType: "official" | "community";
	version?: string;
	path: string;
}

export interface InstalledPlugin {
	id: string;
	name: string;
	marketplace: string;
	version: string;
	path: string;
	enabled: boolean;
	installedAt: string;
}

export interface PluginValidation {
	ok: boolean;
	diagnostics: string[];
}

export class PluginExchangeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PluginExchangeError";
	}
}

function readJson<T>(filePath: string): T | undefined {
	try {
		return JSON.parse(readFileSync(filePath, "utf8")) as T;
	} catch {
		return undefined;
	}
}

function resolveInside(base: string, target: string): string {
	const root = resolve(base);
	const absolute = resolve(root, target);
	const lexicalRel = relative(root, absolute);
	if (lexicalRel.startsWith("..") || isAbsolute(lexicalRel)) {
		throw new PluginExchangeError(`path escapes its root: ${target}`);
	}
	// Symlinks must not escape either. realpathSync resolves the on-disk target;
	// fall back to the lexical path when it does not exist yet.
	const realBase = existsSync(root) ? realpathSync(root) : root;
	const realTarget = existsSync(absolute) ? realpathSync(absolute) : absolute;
	const realRel = relative(realBase, realTarget);
	if (realRel.startsWith("..") || isAbsolute(realRel)) {
		throw new PluginExchangeError(`symlink escapes its root: ${target}`);
	}
	return absolute;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Minimal plugin exchange: marketplaces, install/enable lifecycle and hook provenance. */
export class PluginExchange {
	private readonly root: string;
	private readonly stateDir: string;
	private readonly cacheDir: string;
	private readonly dataDir: string;
	private readonly marketplacesFile: string;
	private readonly installedFile: string;

	constructor(dataDir: string) {
		this.root = resolve(dataDir, "plugin-exchange");
		this.stateDir = this.root;
		this.cacheDir = join(this.root, "cache");
		this.dataDir = join(this.root, "data");
		this.marketplacesFile = join(this.stateDir, "marketplaces.json");
		this.installedFile = join(this.stateDir, "installed.json");
		mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
		mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
	}

	private writeState(file: string, value: unknown): void {
		mkdirSync(this.stateDir, { recursive: true, mode: 0o700 });
		const temp = `${file}.tmp`;
		writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
			encoding: "utf8",
			mode: 0o600,
		});
		renameSync(temp, file);
	}

	private readSources(): MarketplaceSource[] {
		const data = readJson<{ sources?: MarketplaceSource[] }>(this.marketplacesFile);
		if (!data || !Array.isArray(data.sources)) {
			if (existsSync(this.marketplacesFile)) {
				throw new PluginExchangeError("marketplace registry is corrupt");
			}
			return [];
		}
		return data.sources.filter(
			(source): source is MarketplaceSource =>
				isRecord(source) && typeof source.id === "string" && typeof source.descriptorPath === "string",
		);
	}

	private readInstalled(): InstalledPlugin[] {
		const data = readJson<{ plugins?: InstalledPlugin[] }>(this.installedFile);
		if (!data || !Array.isArray(data.plugins)) {
			if (existsSync(this.installedFile)) {
				throw new PluginExchangeError("installed-plugin registry is corrupt");
			}
			return [];
		}
		return data.plugins.filter(
			(plugin): plugin is InstalledPlugin =>
				isRecord(plugin) && typeof plugin.id === "string",
		);
	}

	private descriptorFor(source: MarketplaceSource): MarketplaceDescriptor | undefined {
		const descriptor = readJson<MarketplaceDescriptor>(source.descriptorPath);
		if (!descriptor || typeof descriptor.name !== "string" || !Array.isArray(descriptor.plugins)) {
			return undefined;
		}
		return descriptor;
	}

	addMarketplace(
		descriptorPath: string,
		requestedId?: string,
		options: AddMarketplaceOptions = {},
	): MarketplaceSource {
		const absolute = resolve(descriptorPath);
		const descriptor = this.descriptorFor({
			id: requestedId ?? "pending",
			descriptorPath: absolute,
			publisherType: "community",
			addedAt: "",
		});
		if (!descriptor) {
			throw new PluginExchangeError("marketplace descriptor is invalid");
		}
		const id = requestedId ?? descriptor.name;
		// Provenance cannot be self-certified by an attacker-authored descriptor.
		// Official registration requires a trusted caller, never the CLI.
		const claimedOfficial = descriptor.publisherType === "official";
		if (claimedOfficial && !options.trustedOfficial) {
			throw new PluginExchangeError(
				"official marketplaces can only be registered by a trusted installation source",
			);
		}
		if (RESERVED_OFFICIAL_MARKETS.has(id) && !claimedOfficial) {
			throw new PluginExchangeError(`marketplace id ${id} is reserved for official sources`);
		}
		if (claimedOfficial && !RESERVED_OFFICIAL_MARKETS.has(id)) {
			throw new PluginExchangeError("official marketplaces must use a reserved official id");
		}
		const publisherType = claimedOfficial ? "official" : "community";
		const sources = this.readSources();
		const existing = sources.find((source) => source.id === id);
		if (existing) {
			throw new PluginExchangeError(`marketplace ${id} already exists`);
		}
		const source: MarketplaceSource = {
			id,
			descriptorPath: absolute,
			publisherType,
			addedAt: new Date().toISOString(),
		};
		this.writeState(this.marketplacesFile, { sources: [...sources, source] });
		return source;
	}

	listMarketplaces(): MarketplaceSource[] {
		return this.readSources();
	}

	removeMarketplace(id: string): void {
		const sources = this.readSources();
		const remaining = sources.filter((source) => source.id !== id);
		if (remaining.length === sources.length) {
			throw new PluginExchangeError(`unknown marketplace ${id}`);
		}
		// Installations are intentionally kept and become orphaned.
		this.writeState(this.marketplacesFile, { sources: remaining });
	}

	available(): AvailablePlugin[] {
		const plugins: AvailablePlugin[] = [];
		for (const source of this.readSources()) {
			const descriptor = this.descriptorFor(source);
			if (!descriptor) continue;
			const base = resolve(source.descriptorPath, "..");
			for (const entry of descriptor.plugins) {
				if (typeof entry.name !== "string") continue;
				plugins.push({
					id: `${entry.name}@${source.id}`,
					name: entry.name,
					marketplace: source.id,
					publisherType: source.publisherType,
					...(entry.version ? { version: entry.version } : {}),
					path: resolveInside(base, entry.path ?? entry.name),
				});
			}
		}
		return plugins;
	}

	findAvailable(id: string): AvailablePlugin | undefined {
		return this.available().find((plugin) => plugin.id === id);
	}

	install(id: string): InstalledPlugin {
		const plugin = this.findAvailable(id);
		if (!plugin) throw new PluginExchangeError(`unknown plugin ${id}`);
		const installed = this.readInstalled();
		const existing = installed.find((entry) => entry.id === id);
		if (existing) return existing;
		const version = plugin.version ?? "1.0.0";
		const target = resolveInside(this.cacheDir, join(plugin.marketplace, plugin.name, version));
		if (!existsSync(target)) {
			mkdirSync(target, { recursive: true, mode: 0o700 });
			copyDirectory(plugin.path, target);
		}
		const entry: InstalledPlugin = {
			id,
			name: plugin.name,
			marketplace: plugin.marketplace,
			version,
			path: target,
			enabled: false,
			installedAt: new Date().toISOString(),
		};
		this.writeState(this.installedFile, { plugins: [...installed, entry] });
		mkdirSync(join(this.dataDir, id.replace(/[@/]/g, "_")), { recursive: true, mode: 0o700 });
		return entry;
	}

	list(): InstalledPlugin[] {
		return this.readInstalled();
	}

	setEnabled(id: string, enabled: boolean): InstalledPlugin {
		const installed = this.readInstalled();
		const index = installed.findIndex((entry) => entry.id === id);
		if (index < 0) throw new PluginExchangeError(`plugin ${id} is not installed`);
		const updated = { ...installed[index], enabled } as InstalledPlugin;
		const next = [...installed];
		next[index] = updated;
		this.writeState(this.installedFile, { plugins: next });
		return updated;
	}

	uninstall(id: string, keepData = false): void {
		const installed = this.readInstalled();
		const entry = installed.find((item) => item.id === id);
		if (!entry) return;
		this.writeState(this.installedFile, {
			plugins: installed.filter((item) => item.id !== id),
		});
		rmSync(join(this.cacheDir, entry.marketplace, entry.name), {
			recursive: true,
			force: true,
		});
		if (!keepData) {
			rmSync(join(this.dataDir, id.replace(/[@/]/g, "_")), {
				recursive: true,
				force: true,
			});
		}
	}

	/** Strictly read-only: never installs, enables, or executes anything. */
	validate(pluginPath: string): PluginValidation {
		const diagnostics: string[] = [];
		let manifest: PluginManifest | undefined;
		try {
			const absolute = resolve(pluginPath);
			const raw = readJson<PluginManifest>(join(absolute, "plugin.json"));
			if (!raw || typeof raw.name !== "string") {
				diagnostics.push("error: plugin.json must declare a name");
			} else {
				manifest = raw;
			}
			if (manifest && !existsSync(absolute)) {
				diagnostics.push("error: plugin directory is missing");
			}
			for (const key of ["commands", "skills"] as const) {
				for (const item of manifest?.[key] ?? []) {
					if (typeof item !== "string") continue;
					try {
						resolveInside(absolute, item);
					} catch {
						diagnostics.push(`error: ${key} path escapes plugin root: ${item}`);
					}
				}
			}
		} catch (error) {
			diagnostics.push(`error: ${error instanceof Error ? error.message : String(error)}`);
		}
		return {
			ok: !diagnostics.some((line) => line.startsWith("error:")),
			diagnostics,
		};
	}

	/** Hooks are declarations only; grant/revoke stays in HookGovernance. */
	hooksFor(id: string): HookDeclaration[] {
		const installed = this.readInstalled().find((entry) => entry.id === id);
		if (!installed) return [];
		const manifest = readJson<PluginManifest>(join(installed.path, "plugin.json"));
		if (!manifest || !Array.isArray(manifest.hooks)) return [];
		return manifest.hooks.map((raw, index) => ({
			id: `plugin:${id}:${index}`,
			event: typeof raw.event === "string" ? raw.event : "PreToolUse",
			...(typeof raw.matcher === "string" ? { matcher: raw.matcher } : {}),
			type: raw.type === "command" ? "command" : "process",
			command: String(raw.command ?? ""),
			...(Array.isArray(raw.args) ? { args: raw.args.map(String) } : {}),
			source: join(installed.path, "plugin.json"),
		})) as HookDeclaration[];
	}

	publisherTypeOf(id: string): "official" | "community" | "local" {
		const installed = this.readInstalled().find((entry) => entry.id === id);
		if (!installed) return "community";
		if (installed.marketplace === "local") return "local";
		return this.readSources().find((source) => source.id === installed.marketplace)
			?.publisherType ?? "community";
	}
}

function copyDirectory(from: string, to: string): void {
	if (!existsSync(from)) return;
	cpSync(from, to, { recursive: true, force: true });
}

export * as PluginExchangeModule from "./plugin-exchange";
