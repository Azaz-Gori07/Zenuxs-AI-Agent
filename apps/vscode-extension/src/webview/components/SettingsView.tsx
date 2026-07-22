import { useState, useEffect, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";
import { McpManagementView } from "./McpManagementView.js";
import { DeveloperLogsView } from "./DeveloperLogsView.js";
import type { ToggleItem, CompactionStrategy } from "../types.js";
import { postMessage } from "../vscode-api.js";

type SettingsSectionKey = "provider" | "skills" | "auto" | "mcp" | "plugins" | "about" | "developer" | "execution";

type ApprovalKey =
	| "write"
	| "read"
	| "read_out_of_workspace"
	| "write_out_of_workspace"
	| "mcp"
	| "mode"
	| "subtasks"
	| "execute"
	| "questions";

interface ApprovalPref {
	key: ApprovalKey;
	label: string;
	desc: string;
	defaultEnabled: boolean;
}

interface SidebarTab {
	key: SettingsSectionKey;
	icon: React.ReactNode;
	label: string;
}

const ZapIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
	</svg>
);

const WrenchIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
	</svg>
);

const CheckSquareIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<polyline points="9 11 12 14 22 4" />
		<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
	</svg>
);

const SettingsIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="12" r="3" />
		<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
	</svg>
);

const PlugIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M12 22v-5" />
		<path d="M9 8V2" />
		<path d="M15 8V2" />
		<path d="M18 8v5a6 6 0 0 1-12 0V8Z" />
	</svg>
);

const PuzzleIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.611a2.404 2.404 0 0 1-1.705.706 2.404 2.404 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.404 2.404 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.611-1.611a2.404 2.404 0 0 1 1.704-.706c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.969a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.968 1.02Z" />
	</svg>
);

const InfoIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="12" r="10" />
		<line x1="12" y1="16" x2="12" y2="12" />
		<line x1="12" y1="8" x2="12.01" y2="8" />
	</svg>
);

const CodeIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<polyline points="16 18 22 12 16 6" />
		<polyline points="8 6 2 12 8 18" />
	</svg>
);

const SIDEBAR_TABS: SidebarTab[] = [
	{ key: "provider", icon: <ZapIcon />, label: "Provider" },
	{ key: "skills", icon: <WrenchIcon />, label: "Skills" },
	{ key: "auto", icon: <CheckSquareIcon />, label: "Auto Approves" },
	{ key: "execution", icon: <SettingsIcon />, label: "Execution" },
	{ key: "mcp", icon: <PlugIcon />, label: "MCP" },
	{ key: "plugins", icon: <PuzzleIcon />, label: "Plugins" },
	{ key: "about", icon: <InfoIcon />, label: "About" },
	{ key: "developer", icon: <CodeIcon />, label: "Developer" },
];

const AUTO_APPROVALS: ApprovalPref[] = [
	{ key: "write", label: "Write", desc: "Allow file writes in workspace", defaultEnabled: true },
	{ key: "read", label: "Read", desc: "Allow file reads in workspace", defaultEnabled: true },
	{ key: "read_out_of_workspace", label: "Read out of workspace", desc: "Allow reading outside the workspace", defaultEnabled: false },
	{ key: "write_out_of_workspace", label: "Write out of workspace", desc: "Allow writing outside the workspace", defaultEnabled: false },
	{ key: "mcp", label: "MCP", desc: "Allow MCP server operations", defaultEnabled: true },
	{ key: "mode", label: "Mode changes", desc: "Allow switching agent modes", defaultEnabled: true },
	{ key: "subtasks", label: "Subtasks", desc: "Allow creating/using subtasks", defaultEnabled: true },
	{ key: "execute", label: "Execute", desc: "Allow shell/command execution", defaultEnabled: false },
	{ key: "questions", label: "Questions", desc: "Show approval requests for question-type operations", defaultEnabled: false },
];

export function SettingsView() {
	const { state, saveSettings, toggleItem, loginOAuth, logoutOAuth, switchTab } = useExtensionState();
	const cfg = state.currentConfig;
	const [section, setSection] = useState<SettingsSectionKey>("provider");
	const [localCfg, setLocalCfg] = useState({ ...cfg });
	const [showApiKeyInput, setShowApiKeyInput] = useState(false);
	const [autos, setAutos] = useState<Record<ApprovalKey, boolean>>(() => buildAutoDefaults());
	const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});
	const [loadingProviders, setLoadingProviders] = useState(false);
	const [providerError, setProviderError] = useState<string | null>(null);
	const [oauthStatus, setOauthStatus] = useState<Record<string, "idle" | "authenticating" | "success" | "error">>({});
	const [oauthErrorMessage, setOauthErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const msg = event.data;
			if (!msg || typeof msg !== "object") return;
			if (msg.type === "oauth_status") {
				const pid = msg.providerId;
				if (msg.status === "authenticating") {
					setOauthStatus((prev) => ({ ...prev, [pid]: "authenticating" }));
					setOauthErrorMessage(null);
				} else if (msg.status === "success") {
					setOauthStatus((prev) => ({ ...prev, [pid]: "success" }));
					setOauthErrorMessage(null);
				} else if (msg.status === "error") {
					setOauthStatus((prev) => ({ ...prev, [pid]: "error" }));
					setOauthErrorMessage(msg.message || "Authentication failed.");
				} else if (msg.status === "logged_out") {
					setOauthStatus((prev) => ({ ...prev, [pid]: "idle" }));
					setOauthErrorMessage(null);
				}
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	useEffect(() => {
		setLocalCfg({ ...cfg });
		if (cfg.apiKey === "") {
			setShowApiKeyInput(false);
		}
	}, [cfg.providerId, cfg.modelId, cfg.apiKey, cfg.baseUrl, cfg.mode, cfg.compaction, cfg.retries, cfg.timeout, cfg.checkpointEnabled, cfg.thinking, cfg.reasoningEffort, cfg.maxIterations, cfg.autoApproveTools]);

	useEffect(() => {
		if (state.autoApprovals && Object.keys(state.autoApprovals).length > 0) {
			setAutos(state.autoApprovals as Record<ApprovalKey, boolean>);
		}
	}, [state.autoApprovals]);

	const handleSaveProvider = useCallback(() => {
		saveSettings(localCfg);
		setShowApiKeyInput(false);
	}, [localCfg, saveSettings]);

	const handleSaveAutos = useCallback(() => {
		saveSettings({ ...localCfg, autoApprovals: autos });
	}, [autos, localCfg, saveSettings]);

	const handleProviderChange = useCallback((value: string) => {
		setLocalCfg((prev) => ({ ...prev, providerId: value, modelId: "", apiKey: "" }));
		setShowApiKeyInput(false);
		fetchModelsFor(value);
	}, []);

	const fetchModelsFor = useCallback(async (providerId: string) => {
		setLoadingProviders(true);
		setProviderError(null);
		try {
			const models = await new Promise<Record<string, string[]>>((resolve) => {
				const handler = (event: MessageEvent) => {
					const msg = event.data;
					if (msg && typeof msg === "object" && msg.type === "models" && msg.providerId === providerId) {
						window.removeEventListener("message", handler);
						resolve({ [providerId]: (msg.models || []).map((m: any) => (typeof m === "string" ? m : m.id || m.name || String(m))) });
					}
				};
				window.addEventListener("message", handler);
				postMessage({ type: "models_request", providerId });
				setTimeout(() => { window.removeEventListener("message", handler); resolve({}); }, 5000);
			});
			setProviderModels((prev) => ({ ...prev as Record<string, string[]>, ...models }));
		} catch (e) {
			setProviderError("Failed to load models.");
		} finally {
			setLoadingProviders(false);
		}
	}, []);

	const selectedProvider = state.providers?.find((p: any) => p && (p.id === localCfg.providerId || p === localCfg.providerId));
	const isOAuth = selectedProvider && typeof selectedProvider === "object" ? !!selectedProvider.isOAuth : ["cline", "cline-pass", "oca", "openai-codex", "zenuxs"].includes(localCfg.providerId);
	const authType = selectedProvider && typeof selectedProvider === "object" && selectedProvider.authType
		? selectedProvider.authType
		: isOAuth
		? "OAUTH"
		: "API_KEY";

	const isOAuthProvider = authType === "OAUTH";
	const needsApiKey = authType === "API_KEY";
	const hasSavedApiKey = selectedProvider && typeof selectedProvider === "object" ? !!selectedProvider.hasApiKey : false;
	const isCustomProvider = localCfg.providerId === "custom";
	const isOAuthAuthenticated = (selectedProvider && typeof selectedProvider === "object" ? !!selectedProvider.oauthAccessTokenPresent : false) || oauthStatus[localCfg.providerId] === "success";
	const accountId = selectedProvider && typeof selectedProvider === "object" ? selectedProvider.accountId : undefined;
	const currentOAuthState = oauthStatus[localCfg.providerId] || (isOAuthAuthenticated ? "success" : "idle");

	const handleOAuth = useCallback(() => {
		setOauthStatus((prev) => ({ ...prev, [localCfg.providerId]: "authenticating" }));
		setOauthErrorMessage(null);
		loginOAuth(localCfg.providerId);
	}, [localCfg.providerId, loginOAuth]);

	const handleLogoutOAuth = useCallback((pid: string) => {
		logoutOAuth(pid);
		setOauthStatus((prev) => ({ ...prev, [pid]: "idle" }));
		setOauthErrorMessage(null);
	}, [logoutOAuth]);

	const renderContent = () => {
		switch (section) {
			case "provider":
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
						<div className="form-group">
							<label>Provider</label>
							<select value={localCfg.providerId} onChange={(e) => handleProviderChange(e.target.value)}>
								{state.providers.map((p: any) => (
									<option key={p.id || p} value={p.id || p}>{p.name || p.id || p}</option>
								))}
								{!state.providers.some((p: any) => (p.id || p) === "custom") && (
									<option value="custom">Custom Provider</option>
								)}
							</select>
							<div className="text-muted" style={{ fontSize: "0.82em", marginTop: 6 }}>
								{isCustomProvider ? "Custom OpenAI-compatible provider" : "Built-in provider"}
								{state.connectors && state.connectors.length > 0 && (
									<span style={{ marginLeft: 8 }}>{state.connectors.filter(c => c.provider === localCfg.providerId).length} connector(s)</span>
								)}
							</div>
						</div>

						{isCustomProvider ? (
							<div className="form-group">
								<label>Model Name</label>
								<input
									type="text"
									value={localCfg.modelId}
									onChange={(e) => {
										const newCfg = { ...localCfg, modelId: e.target.value };
										setLocalCfg(newCfg);
										saveSettings(newCfg);
									}}
									placeholder="e.g. gpt-4, llama-3-70b"
								/>
							</div>
						) : (
							<div className="form-group">
								<label>Model</label>
								<select
									value={localCfg.modelId}
									onChange={(e) => {
										const newCfg = { ...localCfg, modelId: e.target.value };
										setLocalCfg(newCfg);
										saveSettings(newCfg);
									}}
									disabled={loadingProviders}
								>
									<option value="">Select a model</option>
									{(providerModels[localCfg.providerId] || state.models[localCfg.providerId] || []).map((m) => (
										<option key={m} value={m}>{m}</option>
									))}
								</select>
								{loadingProviders && <div className="text-muted" style={{ fontSize: "0.8em" }}>Loading models...</div>}
								{providerError && <div className="text-muted" style={{ fontSize: "0.8em", color: "var(--error)" }}>{providerError}</div>}
							</div>
						)}

						{needsApiKey && (
							<div className="form-group">
								<label>API Key</label>
								{showApiKeyInput ? (
									<div className="row">
										<input
											type="password"
											value={localCfg.apiKey}
											onChange={(e) => setLocalCfg({ ...localCfg, apiKey: e.target.value })}
											placeholder="Enter API Key"
										/>
										<button className="btn secondary sm" onClick={() => { setShowApiKeyInput(false); setLocalCfg((prev) => ({ ...prev, apiKey: "" })); }}>
											Cancel
										</button>
									</div>
								) : hasSavedApiKey ? (
									<button className="btn secondary" style={{ width: "100%" }} onClick={() => { setShowApiKeyInput(true); setLocalCfg((prev) => ({ ...prev, apiKey: "" })); }}>
										Update API Key
									</button>
								) : (
									<div className="row">
										<input
											type="password"
											value={localCfg.apiKey}
											onChange={(e) => setLocalCfg({ ...localCfg, apiKey: e.target.value })}
											placeholder="Enter API Key"
										/>
									</div>
								)}
							</div>
						)}

						{isCustomProvider && (
							<div className="form-group">
								<label>Base URL</label>
								<input type="text" value={localCfg.baseUrl} onChange={(e) => setLocalCfg({ ...localCfg, baseUrl: e.target.value })} placeholder="e.g. https://api.openai.com/v1" />
							</div>
						)}

						{needsApiKey && (
							<button className="btn" onClick={handleSaveProvider}>Save Configuration</button>
						)}

						{isOAuthProvider && (
							<div className="oauth-section" style={{
								marginTop: 10,
								padding: 16,
								borderRadius: 10,
								background: "rgba(255, 255, 255, 0.03)",
								border: "1px solid rgba(255, 255, 255, 0.08)",
								display: "flex",
								flexDirection: "column",
								gap: 12
							}}>
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
									<span style={{ fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)" }}>
										Authentication
									</span>
									{isOAuthAuthenticated && (
										<span style={{ fontSize: 12, color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
											✓ Connected
										</span>
									)}
								</div>

								{currentOAuthState === "authenticating" ? (
									<div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px", gap: 10, textAlign: "center" }}>
										<div className="spinner" style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
										<div style={{ fontWeight: 600, fontSize: 14, color: "#f8fafc" }}>Authenticating...</div>
										<div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", lineHeight: 1.4 }}>
											Waiting for authentication approval...<br />Please complete the login in your browser.
										</div>
										<button className="btn secondary" style={{ width: "100%", opacity: 0.6, cursor: "not-allowed", marginTop: 6 }} disabled>
											Authenticating in browser...
										</button>
									</div>
								) : isOAuthAuthenticated ? (
									<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
										<div style={{
											padding: "10px 12px",
											borderRadius: 8,
											background: "rgba(16, 185, 129, 0.08)",
											border: "1px solid rgba(16, 185, 129, 0.2)",
											color: "#34d399",
											fontSize: 13,
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between"
										}}>
											<span>✅ Login Successful</span>
											<span style={{ fontSize: 11, opacity: 0.8 }}>
												{accountId ? `Logged in as ${accountId}` : "Status: Connected"}
											</span>
										</div>
										<button
											className="btn secondary"
											style={{ width: "100%", color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.3)", background: "rgba(244, 63, 94, 0.05)" }}
											onClick={() => handleLogoutOAuth(localCfg.providerId)}
										>
											Logout
										</button>
									</div>
								) : (
									<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
										<div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", lineHeight: 1.4 }}>
											This provider authenticates securely via browser login.
										</div>
										<button className="btn primary" style={{ width: "100%" }} onClick={handleOAuth}>
											Login with {selectedProvider?.name || localCfg.providerId}
										</button>
										{oauthErrorMessage && (
											<div style={{ fontSize: 12, color: "#f43f5e", marginTop: 4, textAlign: "center" }}>
												{oauthErrorMessage}
											</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				);

			case "skills":
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						<div className="text-muted" style={{ fontSize: "0.85em" }}>Manage externally downloaded skills. In future, create your own skill and view Worktree-based skills here.</div>
						<div style={{ marginBottom: 6 }}>
							<button className="btn secondary sm" onClick={() => postMessage({ type: "status", text: "Create skill coming soon" })}>+ Create Skill</button>
						</div>
						<div className="toggle-list">
							{state.toggles.skills.length === 0 ? (
								<div className="text-center text-muted" style={{ padding: 10 }}>No skills configured.</div>
							) : (
								state.toggles.skills.map((item, i) => (
									<div key={i} className="toggle-item">
										<div className="toggle-item-info">
											<div className="toggle-item-name">{item.name}</div>
											{item.description && <div className="toggle-item-desc">{item.description}</div>}
										</div>
										<label className="switch">
											<input type="checkbox" checked={item.enabled} onChange={() => toggleItem("skills", item.id, item.name, item.path, !item.enabled)} />
											<span className="slider" />
										</label>
									</div>
								))
							)}
						</div>
					</div>
				);

			case "auto":
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						<div className="text-muted" style={{ fontSize: "0.85em" }}>Control which operations can run without approval. All are enabled by default except Questions and Execute.</div>
						<div className="toggle-list">
							{AUTO_APPROVALS.map((pref) => (
								<div key={pref.key} className="toggle-item">
									<div className="toggle-item-info">
										<div className="toggle-item-name">{pref.label}</div>
										<div className="toggle-item-desc">{pref.desc}</div>
									</div>
									<label className="switch">
										<input
											type="checkbox"
											checked={!!autos[pref.key]}
											onChange={(e) => setAutos((prev) => ({ ...prev, [pref.key]: e.target.checked }))}
										/>
										<span className="slider" />
									</label>
								</div>
							))}
						</div>
						<div style={{ display: "flex", gap: 8 }}>
							<button className="btn" onClick={handleSaveAutos}>Save Auto Approvals</button>
							<button className="btn secondary sm" onClick={() => setAutos(buildAutoDefaults())}>Reset Defaults</button>
						</div>
					</div>
				);

			case "mcp":
				return <McpManagementView />;

			case "execution":
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
						<div className="form-group">
							<label className="checkbox-label" style={{ fontWeight: 600 }}>
								<input
									type="checkbox"
									checked={!!localCfg.checkpointEnabled}
									onChange={(e) => setLocalCfg({ ...localCfg, checkpointEnabled: e.target.checked })}
								/>
								<span>Enable Version Checkpoints</span>
							</label>
							<div className="text-muted" style={{ fontSize: "0.82em" }}>Automatically creates a lightweight checkpoint before and after tool calls.</div>
						</div>

						<div className="form-group">
							<label>Compaction Strategy</label>
							<select
								value={localCfg.compaction || "off"}
								onChange={(e) => setLocalCfg({ ...localCfg, compaction: e.target.value as CompactionStrategy })}
							>
								<option value="off">Off (No context compaction)</option>
								<option value="basic">Basic (Summarizes older messages)</option>
								<option value="agentic">Agentic (Compacts context using LLM reasoning)</option>
							</select>
							<div className="text-muted" style={{ fontSize: "0.82em" }}>Optimizes context window to prevent token overflow.</div>
						</div>

						<div className="form-group">
							<label className="checkbox-label" style={{ fontWeight: 600 }}>
								<input
									type="checkbox"
									checked={!!localCfg.thinking}
									onChange={(e) => setLocalCfg({ ...localCfg, thinking: e.target.checked })}
								/>
								<span>Enable Model Reasoning (Thinking)</span>
							</label>
							<div className="text-muted" style={{ fontSize: "0.82em" }}>Allows models to generate reasoning/thinking blocks before answering.</div>
						</div>

						{localCfg.thinking && (
							<div className="form-group" style={{ paddingLeft: 20 }}>
								<label>Reasoning Effort</label>
								<select
									value={localCfg.reasoningEffort || "none"}
									onChange={(e) => setLocalCfg({ ...localCfg, reasoningEffort: e.target.value })}
								>
									<option value="none">None</option>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
								</select>
							</div>
						)}

						<div className="row" style={{ gap: 12 }}>
							<div className="form-group col">
								<label>Max Iterations</label>
								<input
									type="number"
									min="1"
									max="1000"
									value={localCfg.maxIterations || 100}
									onChange={(e) => setLocalCfg({ ...localCfg, maxIterations: parseInt(e.target.value) || 100 })}
								/>
							</div>
							<div className="form-group col">
								<label>Mistake Retries</label>
								<input
									type="number"
									min="0"
									max="20"
									value={localCfg.retries || 3}
									onChange={(e) => setLocalCfg({ ...localCfg, retries: parseInt(e.target.value) || 3 })}
								/>
							</div>
						</div>

						<div className="form-group">
							<label>Execution Timeout (seconds)</label>
							<input
								type="number"
								min="0"
								value={localCfg.timeout || 0}
								onChange={(e) => setLocalCfg({ ...localCfg, timeout: parseInt(e.target.value) || 0 })}
								placeholder="0 for no timeout"
							/>
						</div>

						<button className="btn" onClick={() => saveSettings(localCfg)}>Save Execution Settings</button>
					</div>
				);

			case "plugins":
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<div className="text-muted" style={{ fontSize: "0.85em" }}>Manage plugin connections. Plugins extend the agent capabilities.</div>
						<div style={{ display: "flex", gap: 8 }}>
							<button className="btn" onClick={() => postMessage({ type: "status", text: "Connect plugin dialog coming soon" })}>+ Connect Plugin</button>
						</div>
						<div className="text-center text-muted" style={{ padding: 20 }}>No plugins configured.</div>
					</div>
				);

			case "about":
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
							<img src={(window as any).logoUri || ""} alt="Zenuxs logo" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }} />
							<div>
								<h3 style={{ color: "#fff", margin: 0 }}>Zenuxs-Code</h3>
								<div className="text-muted" style={{ fontSize: "0.85em" }}>VS Code Extension</div>
							</div>
						</div>
						<div className="form-group">
							<label>Version</label>
							<div className="text-muted" style={{ fontSize: "0.85em" }}>0.1.0</div>
						</div>
						<div style={{ display: "flex", gap: 8 }}>
							<a className="btn secondary" href="https://github.com/Azaz-Gori07/Zenuxs-AI-Agent" target="_blank" rel="noreferrer">GitHub</a>
						</div>
						<div className="text-muted" style={{ fontSize: "0.82em" }}>Welcome to Zenuxs. This extension connects your VS Code environment to the Zenuxs agent runtime.</div>
					</div>
				);

			case "developer":
				return <DeveloperLogsView />;

			default:
				return null;
		}
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			<div style={{ padding: "12px 16px", flexShrink: 0 }}>
				<button className="btn secondary sm" onClick={() => switchTab("chat")}>
					← Back to Chat
				</button>
			</div>

			<div style={{ display: "flex", flex: 1, overflow: "hidden", padding: "0 16px 16px", gap: 0 }}>
				{/* Vertical sidebar - full height, no border, dark background */}
				<div style={{
					display: "flex",
					flexDirection: "column",
					gap: 8,
					background: "color-mix(in srgb, var(--bg) 80%, #000)",
					padding: "8px 0",
					flexShrink: 0,
					width: 44,
					alignItems: "center",
					borderRadius: "8px 0 0 8px",
				}}>
					{SIDEBAR_TABS.map((tab) => (
						<button
							key={tab.key}
							title={tab.label}
							style={{
								background: section === tab.key ? "rgba(124, 58, 237, 0.2)" : "transparent",
								color: section === tab.key ? "#a78bfa" : "var(--muted)",
								padding: "8px",
								borderRadius: 6,
								cursor: "pointer",
								fontSize: 18,
								lineHeight: 1,
								border: "none",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: 32,
								height: 32,
								transition: "all 0.15s ease",
							}}
							onClick={() => setSection(tab.key)}
							onMouseEnter={(e) => { if (section !== tab.key) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
							onMouseLeave={(e) => { if (section !== tab.key) e.currentTarget.style.background = "transparent"; }}
						>
							{tab.icon}
						</button>
					))}
				</div>

				{/* Content area */}
				<div style={{
					flex: 1,
					overflowY: "auto",
					padding: "16px 20px",
					borderLeft: "1px solid var(--border)",
				}}>
					<h3 style={{
						fontSize: "1.1em",
						fontWeight: 700,
						margin: "0 0 16px 0",
						color: "#fff",
						display: "flex",
						alignItems: "center",
						gap: 8,
					}}>
						<span style={{ color: "#a78bfa", display: "flex" }}>
							{SIDEBAR_TABS.find(t => t.key === section)?.icon}
						</span>
						{SIDEBAR_TABS.find(t => t.key === section)?.label}
					</h3>
					{renderContent()}
				</div>
			</div>
		</div>
	);
}

function buildAutoDefaults(): Record<ApprovalKey, boolean> {
	const out: Partial<Record<ApprovalKey, boolean>> = {};
	for (const pref of AUTO_APPROVALS) {
		out[pref.key] = pref.defaultEnabled;
	}
	return out as Record<ApprovalKey, boolean>;
}

function getProviderLabel(id: string): string {
	const labels: Record<string, string> = {
		cline: "Zenuxs",
		anthropic: "Anthropic",
		openrouter: "OpenRouter",
		"openai-compatible": "OpenAI Compatible",
		gemini: "Gemini",
		vertex: "Google Vertex AI",
		bedrock: "AWS Bedrock",
		azure: "Azure OpenAI",
		sap: "SAP AI Core",
		oca: "OCA",
	};
	return labels[id] || id;
}