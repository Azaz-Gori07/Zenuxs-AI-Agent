// Browser-safe subset of the Codex CLI provider metadata. The node implementation
// shells out to the `codex` binary and cannot be bundled into a webview.

export const OPENAI_CODEX_CLI_PROVIDER_ID = "openai-codex-cli"
export const CODEX_CLI_INSTALL_URL = "https://developers.openai.com/codex/cli"

export type CodexCliStatus =
  | { installed: true; version: string }
  | { installed: false; reason: string }

export function isOpenAICodexCliProvider(providerId: string): boolean {
  return providerId.trim().toLowerCase() === OPENAI_CODEX_CLI_PROVIDER_ID
}

export async function checkCodexCliInstalled(): Promise<CodexCliStatus> {
  return { installed: false, reason: "Codex CLI detection is unavailable in the browser" }
}
