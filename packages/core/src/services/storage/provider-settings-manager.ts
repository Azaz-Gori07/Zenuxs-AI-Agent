import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname } from "node:path";
import { resolveProviderSettingsPath } from "@cline/shared/storage";
import { getLiveModelsCatalog } from "../..";
import { getProviderAuthHandler } from "../../auth/provider-auth-registry";
import { ProviderSettingsSchema as KnownProviderSettingsSchema } from "../llms/provider-settings";
import {
	emptyStoredProviderSettings,
	type ProviderConfig,
	type ProviderSettings,
	ProviderSettingsSchemaTyped as ProviderSettingsSchema,
	type ProviderTokenSource,
	type StoredProviderSettings,
	StoredProviderSettingsSchema,
	type ToProviderConfigOptions,
	toProviderConfig,
} from "../../types/provider-settings";
import {
	ensureCustomProvidersLoadedSync,
	registerConfiguredProvidersFromSettings,
} from "../providers/local-provider-registry";
import { migrateLegacyProviderSettings } from "./provider-settings-legacy-migration";

type RawState = { providers?: Record<string, { settings?: Record<string, unknown> }> };

/** Read the on-disk state without schema stripping, to preserve unknown fields. */
function readRawSettings(filePath: string): RawState {
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as RawState;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

const KNOWN_SETTING_KEYS = new Set(
  Object.keys(KnownProviderSettingsSchema.shape),
);

function mergePreservingUnknown(
  normalized: StoredProviderSettings,
  raw: RawState,
  clearFields: string[] = [],
): StoredProviderSettings {
  const providers = { ...normalized.providers };
  for (const [id, entry] of Object.entries(providers)) {
    const rawSettings = raw.providers?.[id]?.settings;
    if (rawSettings) {
      // Only re-inject fields the schema does not know about. Known fields
      // that were deliberately cleared must stay cleared (e.g. apiKey="").
      const unknown: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawSettings)) {
        if (!KNOWN_SETTING_KEYS.has(key) && !clearFields.includes(key)) {
          unknown[key] = value;
        }
      }
      (entry as { settings: Record<string, unknown> }).settings = {
        ...unknown,
        ...(entry.settings as Record<string, unknown>),
      };
    }
  }
  return { ...normalized, providers };
}

export function migrateUnknownFields(filePath: string, clearFields: string[] = []): number {
  const raw = readRawSettings(filePath);
  let parsed: StoredProviderSettings;
  try {
    parsed = StoredProviderSettingsSchema.parse(raw);
  } catch {
    return 0;
  }
  const original = JSON.stringify(parsed);
  const merged = mergePreservingUnknown(
    JSON.parse(original) as StoredProviderSettings,
    raw,
    clearFields,
  );
  const changed = JSON.stringify(merged) !== original;
  if (changed) {
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
    writeFileSync(filePath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  }
  return changed ? 1 : 0;
}

function nowIso(): string {
	return new Date().toISOString();
}

export interface ProviderSettingsManagerOptions {
	filePath?: string;
	dataDir?: string;
}

export interface SaveProviderSettingsOptions {
	setLastUsed?: boolean;
	tokenSource?: ProviderTokenSource;
	/** Known fields the caller explicitly cleared and must not be re-merged. */
	clearFields?: string[];
}

export interface ResolveLastUsedProviderSettingsOptions {
	isClinePassEnabled?: boolean;
}

const CLINE_PROVIDER_ID = "cline";
const CLINE_PASS_PROVIDER_ID = "cline-pass";

function inferLegacyDataDir(filePath: string): string | undefined {
	if (basename(filePath) !== "providers.json") {
		return undefined;
	}
	const settingsDir = dirname(filePath);
	if (basename(settingsDir) !== "settings") {
		return undefined;
	}
	return dirname(settingsDir);
}

export class ProviderSettingsManager {
	private readonly filePath: string;
	private readonly dataDir?: string;

	constructor(options: ProviderSettingsManagerOptions = {}) {
		this.filePath = options.filePath ?? resolveProviderSettingsPath();
		this.dataDir = options.dataDir ?? inferLegacyDataDir(this.filePath);
		if (this.dataDir || !options.filePath) {
			migrateLegacyProviderSettings({
				providerSettingsManager: this,
				dataDir: this.dataDir,
			});
		}
		ensureCustomProvidersLoadedSync(this);
		registerConfiguredProvidersFromSettings(this.read());
		// Harden permissions on any existing file at startup so that
		// pre-existing installations are also protected (best-effort; no-op on Windows).
		if (existsSync(this.filePath)) {
			try {
				migrateUnknownFields(this.filePath);
			} catch {
				// Best-effort migration; invalid files are handled by read().
			}
			try {
				chmodSync(this.filePath, 0o600);
			} catch {
				// Ignore - Windows does not support POSIX chmod.
			}
		}
	}

	getFilePath(): string {
		return this.filePath;
	}

	read(): StoredProviderSettings {
		if (!existsSync(this.filePath)) {
			return emptyStoredProviderSettings();
		}

		try {
			const raw = readFileSync(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as unknown;
			const result = StoredProviderSettingsSchema.safeParse(parsed);
			if (result.success) {
				registerConfiguredProvidersFromSettings(result.data);
				return result.data;
			}
		} catch {
			// Invalid content falls back to a clean state.
		}

		return emptyStoredProviderSettings();
	}

	write(state: StoredProviderSettings, clearFields: string[] = []): void {
		const normalized = mergePreservingUnknown(
			StoredProviderSettingsSchema.parse(state),
			readRawSettings(this.filePath),
			clearFields,
		);
		const dir = dirname(this.filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: 0o700 });
		}
		writeFileSync(
			this.filePath,
			`${JSON.stringify(normalized, null, 2)}\n`,
			"utf8",
		);
		// Restrict file to owner-only read/write (best-effort; no-op on Windows).
		try {
			chmodSync(this.filePath, 0o600);
		} catch {
			// Ignore - Windows does not support POSIX chmod.
		}
		registerConfiguredProvidersFromSettings(normalized);
	}

	saveProviderSettings(
		settings: unknown,
		options: SaveProviderSettingsOptions = {},
	): StoredProviderSettings {
		const validatedSettings = ProviderSettingsSchema.parse(settings);
		const previous = this.read();
		const providerId = validatedSettings.provider;
		const shouldSetLastUsed = options.setLastUsed !== false;
		const previousEntry = previous.providers[providerId];
		const tokenSource =
			options.tokenSource ?? previousEntry?.tokenSource ?? "manual";
		const merged: Record<string, unknown> = {
			...(previousEntry?.settings ?? {}),
			...(validatedSettings as Record<string, unknown>),
		};
		for (const key of options.clearFields ?? []) delete merged[key];
		const next: StoredProviderSettings = {
			...previous,
			providers: {
				...previous.providers,
				[providerId]: {
					settings: merged as typeof validatedSettings,
					updatedAt: nowIso(),
					tokenSource,
					favorites: previousEntry?.favorites,
					recentlyUsed: previousEntry?.recentlyUsed,
				},
			},
			lastUsedProvider: shouldSetLastUsed
				? providerId
				: previous.lastUsedProvider,
		};
		this.write(next, options.clearFields);
		return next;
	}

	toggleFavorite(providerId: string, modelId: string): StoredProviderSettings {
		const previous = this.read();
		const entry = previous.providers[providerId];
		if (!entry) return previous;
		const favorites = entry.favorites ?? [];
		const nextFavorites = favorites.includes(modelId)
			? favorites.filter((id) => id !== modelId)
			: [...favorites, modelId];
		const next: StoredProviderSettings = {
			...previous,
			providers: {
				...previous.providers,
				[providerId]: {
					...entry,
					favorites: nextFavorites,
					updatedAt: nowIso(),
				},
			},
		};
		this.write(next);
		return next;
	}

	addRecentlyUsed(providerId: string, modelId: string): StoredProviderSettings {
		const previous = this.read();
		const entry = previous.providers[providerId];
		if (!entry) return previous;
		const recentlyUsed = entry.recentlyUsed ?? [];
		const nextRecentlyUsed = [
			modelId,
			...recentlyUsed.filter((id) => id !== modelId),
		].slice(0, 5);
		const next: StoredProviderSettings = {
			...previous,
			providers: {
				...previous.providers,
				[providerId]: {
					...entry,
					recentlyUsed: nextRecentlyUsed,
					updatedAt: nowIso(),
				},
			},
		};
		this.write(next);
		return next;
	}

	private resolveProviderSettings(
		state: StoredProviderSettings,
		providerId: string,
	): ProviderSettings | undefined {
		const directSettings = state.providers[providerId]?.settings;
		const authHandler = getProviderAuthHandler(providerId);
		const storageProviderId = authHandler?.storageProviderId;
		if (!storageProviderId || storageProviderId === providerId) {
			return directSettings;
		}

		const authSettings = state.providers[storageProviderId]?.settings;
		if (!authSettings) {
			return directSettings;
		}

		return ProviderSettingsSchema.parse({
			...(authSettings.auth ? { auth: authSettings.auth } : {}),
			...(authSettings.apiKey ? { apiKey: authSettings.apiKey } : {}),
			...(authSettings.baseUrl ? { baseUrl: authSettings.baseUrl } : {}),
			...(directSettings ?? {}),
			provider: providerId,
		});
	}

	getProviderSettings(providerId: string): ProviderSettings | undefined {
		const state = this.read();
		return this.resolveProviderSettings(state, providerId);
	}

	private resolveLastUsedProviderId(
		state: StoredProviderSettings,
		options: ResolveLastUsedProviderSettingsOptions,
	): string | undefined {
		const providerId = state.lastUsedProvider;
		if (
			providerId === CLINE_PASS_PROVIDER_ID &&
			options.isClinePassEnabled === false
		) {
			return CLINE_PROVIDER_ID;
		}

		return providerId;
	}

	getLastUsedProviderSettings(
		options: ResolveLastUsedProviderSettingsOptions = {},
	): ProviderSettings | undefined {
		const state = this.read();
		const providerId = this.resolveLastUsedProviderId(state, options);
		if (!providerId) {
			return undefined;
		}
		return this.resolveProviderSettings(state, providerId);
	}

	getProviderConfig(
		providerId: string,
		options?: ToProviderConfigOptions,
	): ProviderConfig | undefined {
		const settings = this.getProviderSettings(providerId);
		if (!settings) {
			return undefined;
		}
		return toProviderConfig(settings, options);
	}

	getLastUsedProviderConfig(
		options: ToProviderConfigOptions &
			ResolveLastUsedProviderSettingsOptions = {},
	): ProviderConfig | undefined {
		const settings = this.getLastUsedProviderSettings(options);
		if (!settings) {
			return undefined;
		}
		return toProviderConfig(settings, options);
	}

	async refreshCatalog(): Promise<void> {
		try {
			await getLiveModelsCatalog({});
		} catch {
			// Ignore errors
		}
	}
}
