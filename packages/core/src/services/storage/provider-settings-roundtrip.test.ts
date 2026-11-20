import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProviderSettingsManager, migrateUnknownFields } from "./provider-settings-manager";

function tempFile(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "provider-settings-"));
  return { dir, path: join(dir, "providers.json") };
}

describe("provider settings round-trip", () => {
  it("preserves baseUrl and unknown fields across writes", () => {
    const { dir, path } = tempFile();
    try {
      writeFileSync(path, JSON.stringify({
        version: 1,
        lastUsedProvider: "openai-compatible",
        providers: {
          "openai-compatible": {
            settings: {
              provider: "openai-compatible", apiKey: "fake-key", model: "fake-model",
              baseUrl: "http://127.0.0.1:4317/v1", timeout: 1234, customField: "KEEP_ME",
            },
            updatedAt: "2026-11-20T00:00:00.000Z", tokenSource: "manual",
          },
        },
      }));
      const manager = new ProviderSettingsManager({ filePath: path });
      manager.saveProviderSettings({ provider: "openai-compatible", model: "new-model" }, { setLastUsed: false });
      const stored = JSON.parse(readFileSync(path, "utf8"));
      const settings = stored.providers["openai-compatible"].settings;
      expect(settings.baseUrl).toBe("http://127.0.0.1:4317/v1");
      expect(settings.customField).toBe("KEEP_ME");
      expect(settings.timeout).toBe(1234);
      expect(settings.model).toBe("new-model");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrates an existing file that lost unknown fields", () => {
    const { dir, path } = tempFile();
    try {
      writeFileSync(path, JSON.stringify({
        version: 1,
        providers: { fake: { settings: { provider: "fake", baseUrl: "http://localhost:1234/v1", legacyField: 42 }, updatedAt: "2026-01-01T00:00:00.000Z" } },
      }));
      expect(migrateUnknownFields(path)).toBe(1);
      const stored = JSON.parse(readFileSync(path, "utf8"));
      expect(stored.providers.fake.settings.legacyField).toBe(42);
      expect(stored.providers.fake.settings.baseUrl).toBe("http://localhost:1234/v1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
