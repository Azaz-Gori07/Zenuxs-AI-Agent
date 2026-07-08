import { useState, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";
import { McpManagementView } from "./McpManagementView.js";
import type { ToggleItem, AgentMode, CompactionStrategy } from "../types.js";

type SettingsSubtab = "skills" | "workflows" | "rules" | "tools" | "mcpToggles";

const SUBTABS: { key: SettingsSubtab; label: string }[] = [
	{ key: "skills", label: "Skills" },
	{ key: "workflows", label: "Workflows" },
	{ key: "rules", label: "Rules" },
	{ key: "tools", label: "Tools" },
	{ key: "mcpToggles", label: "MCP" },
];

const MODES: { value: AgentMode; label: string; desc: string }[] = [
	{ value: "act", label: "Act", desc: "Full autonomy — read, write, execute, deploy" },
	{ value: "plan", label: "Plan", desc: "Analyze and propose a plan without taking action" },
	{ value: "yolo", label: "YOLO", desc: "Maximum auto-approve, limited toolset, speed" },
	{ value: "zen", label: "Zen", desc: "Background dispatch via hub, fire-and-forget" },
];

const COMPACTION_STRATEGIES: { value: CompactionStrategy; label: string; desc: string }[] = [
	{ value: "off", label: "Off", desc: "Never compact conversation context" },
	{ value: "basic", label: "Basic", desc: "Trim oldest messages when approaching token limit" },
	{ value: "agentic", label: "Agentic", desc: "Smart summarization of older turns" },
];

export function SettingsView() {
	const { state, saveSettings, toggleItem, loginOAuth, switchTab } = useExtensionState();
	const cfg = state.currentConfig;
	const [activeSubtab, setActiveSubtab] = useState<SettingsSubtab>("skills");
	const [showApiKey, setShowApiKey] = useState(false);
	const [localCfg, setLocalCfg] = useState({ ...cfg });

	const handleSave = useCallback(() => {
		saveSettings(localCfg);
	}, [localCfg, saveSettings]);

	const subtabItems: Record<SettingsSubtab, ToggleItem[]> = {
		skills: state.toggles.skills,
		workflows: state.toggles.workflows,
		rules: state.toggles.rules,
		tools: state.toggles.tools,
		mcpToggles: state.toggles.mcp,
	};

	return (
		<div className="settings-container">
			<div style={{ marginBottom: 12 }}>
				<button className="btn secondary sm" onClick={() => switchTab("chat")}>
					← Back to Chat
				</button>
			</div>
			<div className="settings-section">
				<h3 className="settings-section-title">Provider Connection</h3>
				<div className="form-group">
					<label>Selected Provider</label>
					<select value={localCfg.providerId} onChange={(e) => setLocalCfg({ ...localCfg, providerId: e.target.value })}>
						{state.providers.map((p) => (
							<option key={p} value={p}>{getProviderLabel(p)}</option>
						))}
					</select>
				</div>
				<div className="form-group">
					<label>Default Model</label>
					<select value={localCfg.modelId} onChange={(e) => setLocalCfg({ ...localCfg, modelId: e.target.value })}>
						{(state.models[localCfg.providerId] || ["default"]).map((m) => (
							<option key={m} value={m}>{m}</option>
						))}
					</select>
				</div>
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
				<div className="form-group">
					<label>Custom Base URL</label>
					<input type="text" value={localCfg.baseUrl} onChange={(e) => setLocalCfg({ ...localCfg, baseUrl: e.target.value })} placeholder="e.g. https://api.openai.com/v1" />
				</div>
				<button className="btn" onClick={handleSave}>Save Connection</button>
				<div className="oauth-section">
					<span className="oauth-title">Authentication</span>
					<div className="text-muted" style={{ fontSize: "0.85em", marginBottom: 4 }}>Log in or authenticate with OAuth-enabled providers</div>
					<button className="btn secondary" style={{ width: "100%" }} onClick={() => loginOAuth(localCfg.providerId)}>
						Login / Authenticate via Browser
					</button>
				</div>
			</div>

			<div className="settings-section">
				<h3 className="settings-section-title">Agent Mode</h3>
				{MODES.map((m) => (
					<label key={m.value} className="checkbox-label" style={{ padding: "6px 0" }}>
						<input type="radio" name="mode" checked={localCfg.mode === m.value} onChange={() => setLocalCfg({ ...localCfg, mode: m.value })} />
						<div><strong>{m.label}</strong><br /><span className="text-muted" style={{ fontSize: "0.85em" }}>{m.desc}</span></div>
					</label>
				))}
			</div>

			<div className="settings-section">
				<h3 className="settings-section-title">Runtime & Agent Options</h3>
				<div className="form-group-row">
					<label className="switch">
						<input type="checkbox" checked={localCfg.autoApproveTools} onChange={(e) => setLocalCfg({ ...localCfg, autoApproveTools: e.target.checked })} />
						<span className="slider" />
					</label>
					<span>Auto-Approve Tool Executions</span>
				</div>
				<div className="form-group-row">
					<label className="switch">
						<input type="checkbox" checked={localCfg.thinking} onChange={(e) => setLocalCfg({ ...localCfg, thinking: e.target.checked })} />
						<span className="slider" />
					</label>
					<span>Thinking Mode</span>
				</div>
				<div className="form-group">
					<label>Reasoning Effort</label>
					<select value={localCfg.reasoningEffort} onChange={(e) => setLocalCfg({ ...localCfg, reasoningEffort: e.target.value })}>
						<option value="none">None</option>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</div>
				<div className="form-group">
					<label>Max Iterations per Turn</label>
					<input type="number" min={1} max={1000} value={localCfg.maxIterations} onChange={(e) => setLocalCfg({ ...localCfg, maxIterations: parseInt(e.target.value) || 100 })} />
				</div>
				<div className="form-group">
					<label>Max Retries (Consecutive Mistakes)</label>
					<input type="number" min={1} max={50} value={localCfg.retries} onChange={(e) => setLocalCfg({ ...localCfg, retries: parseInt(e.target.value) || 3 })} />
				</div>
				<div className="form-group">
					<label>Session Timeout (seconds, 0 = no timeout)</label>
					<input type="number" min={0} max={3600} value={localCfg.timeout} onChange={(e) => setLocalCfg({ ...localCfg, timeout: parseInt(e.target.value) || 0 })} />
				</div>
				<button className="btn" onClick={handleSave}>Save Settings</button>
			</div>

			<div className="settings-section">
				<h3 className="settings-section-title">Context Management</h3>
				<div className="form-group">
					<label>Compaction Strategy</label>
					{COMPACTION_STRATEGIES.map((cs) => (
						<label key={cs.value} className="checkbox-label" style={{ padding: "3px 0" }}>
							<input type="radio" name="compaction" checked={localCfg.compaction === cs.value} onChange={() => setLocalCfg({ ...localCfg, compaction: cs.value })} />
							<div><strong>{cs.label}</strong><br /><span className="text-muted" style={{ fontSize: "0.85em" }}>{cs.desc}</span></div>
						</label>
					))}
				</div>
				<div className="form-group-row">
					<label className="switch">
						<input type="checkbox" checked={localCfg.checkpointEnabled} onChange={(e) => setLocalCfg({ ...localCfg, checkpointEnabled: e.target.checked })} />
						<span className="slider" />
					</label>
					<span>Enable Checkpoints (git-based snapshots)</span>
				</div>
				<button className="btn" onClick={handleSave}>Save Settings</button>
			</div>

			<div className="settings-section">
				<h3 className="settings-section-title">Rules, Skills & Tools Config</h3>
				<div className="settings-subtabs">
					{SUBTABS.map((st) => (
						<button
							key={st.key}
							className={`settings-subtab-btn ${activeSubtab === st.key ? "active" : ""}`}
							onClick={() => setActiveSubtab(st.key)}
						>
							{st.label}
						</button>
					))}
				</div>
				<div className="toggle-list">
					{subtabItems[activeSubtab].length === 0 ? (
						<div className="text-center text-muted" style={{ padding: 10 }}>No items configured.</div>
					) : (
						subtabItems[activeSubtab].map((item, i) => (
							<div key={i} className="toggle-item">
								<div className="toggle-item-info">
									<div className="toggle-item-name">{item.name}</div>
									{item.description && <div className="toggle-item-desc">{item.description}</div>}
								</div>
								{item.toggleable && (
									<label className="switch">
										<input type="checkbox" checked={item.enabled} onChange={() => toggleItem(activeSubtab === "mcpToggles" ? "mcp" : activeSubtab, item.id, item.name, item.path, !item.enabled)} />
										<span className="slider" />
									</label>
								)}
							</div>
						))
					)}
				</div>
			</div>

			<McpManagementView />
		</div>
	);
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
