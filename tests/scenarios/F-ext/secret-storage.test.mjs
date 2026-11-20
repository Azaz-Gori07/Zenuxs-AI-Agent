// Check: AuthService stores and deletes credentials through SecretStorage only.
import assert from "node:assert/strict";
import { AuthService } from "../../../apps/vscode-extension/src/services/auth-service.ts";

const vault = new Map();
const calls = [];
const secretStorage = {
  async store(key, value) { calls.push(["store", key]); vault.set(key, value); },
  async get(key) { calls.push(["get", key]); return vault.get(key); },
  async delete(key) { calls.push(["delete", key]); vault.delete(key); },
};
const auth = AuthService.getInstance();
auth.setSecretStorage(secretStorage);
await auth.storeCredential("openai", "SENTINEL_TOKEN");
assert.equal(await auth.readCredential("openai"), "SENTINEL_TOKEN");
await auth.deleteCredential("openai");
assert.equal(await auth.readCredential("openai"), undefined);
assert.ok(calls.some(c => c[0] === "store" && c[1] === "zenuxs.auth.openai.accessToken"));
assert.ok(calls.some(c => c[0] === "delete" && c[1] === "zenuxs.auth.openai.accessToken"));
assert.ok(!calls.some(c => c[0] === "get" && c[1] === "zenuxs.auth.openai.accessToken" && vault.has(c[1])));
console.log(JSON.stringify({ ok: true, calls: calls.length, vaultSize: vault.size }));
