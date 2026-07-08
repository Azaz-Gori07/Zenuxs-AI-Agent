import { useState, useEffect, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";
import { McpManagementView } from "./McpManagementView.js";
import type { ToggleItem } from "../types.js";
import { postMessage } from "../vscode-api.js";

type SettingsSectionKey = "provider" | "skills" | "auto" | "mcp" | "plugins" | "about";

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

const SIDEBAR_TABS: SidebarTab[] = [
	{ key: "provider", icon: <ZapIcon />, label: "Provider" },
	{ key: "skills", icon: <WrenchIcon />, label: "Skills" },
	{ key: "auto", icon: <CheckSquareIcon />, label: "Auto Approves" },
	{ key: "mcp", icon: <PlugIcon />, label: "MCP" },
	{ key: "plugins", icon: <PuzzleIcon />, label: "Plugins" },
	{ key: "about", icon: <InfoIcon />, label: "About" },
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
	const { state, saveSettings, toggleItem, loginOAuth, switchTab } = useExtensionState();
	const cfg = state.currentConfig;
	const [section, setSection] = useState<SettingsSectionKey>("provider");
	const [localCfg, setLocalCfg] = useState({ ...cfg });
	const [showApiKey, setShowApiKey] = useState(false);
	const [autos, setAutos] = useState<Record<ApprovalKey, boolean>>(() => buildAutoDefaults());
	const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});
	const [loadingProviders, setLoadingProviders] = useState(false);
	const [providerError, setProviderError] = useState<string | null>(null);
	const [oauthStatus, setOauthStatus] = useState<Record<string, "idle" | "authenticated" | "error">>({});

	useEffect(() => {
		setLocalCfg({ ...cfg });
	}, [cfg.providerId, cfg.modelId, cfg.apiKey, cfg.baseUrl, cfg.mode, cfg.compaction, cfg.retries, cfg.timeout, cfg.checkpointEnabled, cfg.thinking, cfg.reasoningEffort, cfg.maxIterations, cfg.autoApproveTools]);

	const handleSaveProvider = useCallback(() => {
		saveSettings(localCfg);
		// mask api key after save
		setLocalCfg(prev => ({ ...prev, apiKey: prev.apiKey ? "•".repeat(Math.min(prev.apiKey.length, 12)) : "" }));
		setShowApiKey(false);
	}, [localCfg, saveSettings]);

	const handleSaveAutos = useCallback(() => {
		saveSettings(localCfg);
	}, [autos, localCfg, saveSettings]);

	const handleProviderChange = useCallback((value: string) => {
		setLocalCfg((prev) => ({ ...prev, providerId: value, modelId: "" }));
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

	const isBuiltinProvider = ["cline", "anthropic", "gemini", "vertex", "bedrock", "azure", "openrouter", "openai-compatible", "sap", "oca"].includes(localCfg.providerId);
	const needsApiKey = localCfg.providerId !== "cline";
	const handleOAuth = useCallback(() => {
		setOauthStatus((prev) => ({ ...prev, [localCfg.providerId]: "idle" }));
		loginOAuth(localCfg.providerId);
	}, [localCfg.providerId, loginOAuth]);

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
							</select>
							<div className="text-muted" style={{ fontSize: "0.82em", marginTop: 6 }}>
								{isBuiltinProvider ? "Built-in provider" : "External provider"}
								{state.connectors && state.connectors.length > 0 && (
									<span style={{ marginLeft: 8 }}>{state.connectors.filter(c => c.provider === localCfg.providerId).length} connector(s)</span>
								)}
							</div>
						</div>

						<div className="form-group">
							<label>Model</label>
							<select
								value={localCfg.modelId}
								onChange={(e) => setLocalCfg({ ...localCfg, modelId: e.target.value })}
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

						{needsApiKey && (
							<div className="form-group">
								<label>API Key</label>
								<div className="row">
									<input
										type={showApiKey ? "text" : "password"}
										value={localCfg.apiKey}
										onChange={(e) => setLocalCfg({ ...localCfg, apiKey: e.target.value })}
										placeholder="Enter API Key"
									/>
									<button className="btn secondary sm" onClick={() => setShowApiKey(!showApiKey)}>
										{showApiKey ? "Hide" : "Show"}
									</button>
								</div>
							</div>
						)}

						<div className="form-group">
							<label>Custom Base URL</label>
							<input type="text" value={localCfg.baseUrl} onChange={(e) => setLocalCfg({ ...localCfg, baseUrl: e.target.value })} placeholder="e.g. https://api.openai.com/v1" />
						</div>

						<button className="btn" onClick={handleSaveProvider}>Save Connection</button>

						<div className="oauth-section">
							<span className="oauth-title">Authentication</span>
							<div className="text-muted" style={{ fontSize: "0.85em", marginBottom: 4 }}>
								{localCfg.providerId === "cline"
									? "Zenuxs provider does not require separate API key or OAuth."
									: "OAuth login may be required for this provider. If not authenticated, you will be redirected to the login page."}
							</div>
							<button className="btn secondary" style={{ width: "100%" }} onClick={handleOAuth}>
								Login / Authenticate via Browser
							</button>
							{oauthStatus[localCfg.providerId] === "error" && (
								<div className="text-muted" style={{ fontSize: "0.8em", color: "var(--warning)" }}>Authentication failed or cancelled.</div>
							)}
						</div>
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
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<div className="text-muted" style={{ fontSize: "0.85em" }}>Manage MCP server connections. Servers provide tools and resources to the agent.</div>
						<div style={{ display: "flex", gap: 8 }}>
							<button className="btn" onClick={() => postMessage({ type: "status", text: "Open MCP connect dialog coming soon" })}>+ Connect MCP Server</button>
						</div>
						<div className="mcp-server-list">
							{state.mcpServers.length === 0 ? (
								<div className="text-center text-muted" style={{ padding: 10 }}>No MCP servers configured.</div>
							) : (
								state.mcpServers.map((s) => (
									<div key={s.name} className="mcp-server-item">
										<div className="mcp-server-info">
											<div className="mcp-server-name">
												<span className={`status-dot ${s.status}`} style={{ marginRight: 8 }} />
												<span>{s.name}</span>
											</div>
											<div className="mcp-server-meta">{s.transport} • {s.toolCount} tools • {s.disabled ? "Disabled" : s.status}</div>
										</div>
										<div className="mcp-server-actions">
										<button className="btn secondary sm" onClick={() => postMessage({ type: "mcp_connect", name: s.name })}>Connect</button>
										<button className="btn secondary sm" onClick={() => postMessage({ type: "mcp_disconnect", name: s.name })}>Disconnect</button>
										</div>
									</div>
								))
							)}
						</div>
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