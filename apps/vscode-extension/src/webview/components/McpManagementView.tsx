import { useState, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";

export function McpManagementView() {
	const { state, registerMcpServer, unregisterMcpServer, connectMcpServer, disconnectMcpServer, setMcpServerDisabled, refreshMcpTools } = useExtensionState();
	const [showAddForm, setShowAddForm] = useState(false);
	const [newName, setNewName] = useState("");
	const [newTransport, setNewTransport] = useState<"stdio" | "sse">("stdio");
	const [newCommand, setNewCommand] = useState("");
	const [newArgs, setNewArgs] = useState("");
	const [newUrl, setNewUrl] = useState("");

	const handleAdd = useCallback(() => {
		if (!newName.trim()) return;
		if (newTransport === "stdio") {
			registerMcpServer(newName.trim(), "stdio", newCommand.trim() || undefined, newArgs ? newArgs.split(" ").filter(Boolean) : undefined, undefined);
		} else {
			registerMcpServer(newName.trim(), "sse", undefined, undefined, newUrl.trim() || undefined);
		}
		setNewName(""); setNewCommand(""); setNewArgs(""); setNewUrl("");
		setShowAddForm(false);
	}, [newName, newTransport, newCommand, newArgs, newUrl, registerMcpServer]);

	const servers = state.mcpServers;

	return (
		<div className="settings-container">
			<div className="settings-section">
				<h3 className="settings-section-title">MCP Servers</h3>
				<div className="mcp-server-list">
					{servers.length === 0 ? (
						<div className="text-muted text-center" style={{ padding: 10 }}>No MCP servers configured.</div>
					) : (
						servers.map((s) => (
							<div key={s.name} className="mcp-server-item">
								<div className="mcp-server-info">
									<div className="mcp-server-name">
										<span className={`status-dot ${s.status}`} />
										{s.name}
									</div>
									<div className="mcp-server-meta">
										<span>{s.transport}</span>
										<span>{s.toolCount} tools</span>
										{s.disabled && <span style={{ color: "var(--warning)" }}>Disabled</span>}
										{s.lastError && <span style={{ color: "var(--error)" }}>{s.lastError}</span>}
									</div>
								</div>
								<div className="mcp-server-actions">
									{s.status === "connected" ? (
										<button className="btn sm secondary" onClick={() => disconnectMcpServer(s.name)}>Disconnect</button>
									) : (
										<button className="btn sm" onClick={() => connectMcpServer(s.name)} disabled={s.disabled}>Connect</button>
									)}
									<label className="switch" title={s.disabled ? "Enable" : "Disable"}>
										<input type="checkbox" checked={!s.disabled} onChange={() => setMcpServerDisabled(s.name, !s.disabled)} />
										<span className="slider" />
									</label>
									<button className="btn sm secondary" onClick={() => refreshMcpTools(s.name)}>Refresh</button>
									<button className="btn sm danger" onClick={() => unregisterMcpServer(s.name)}>Remove</button>
								</div>
							</div>
						))
					)}
				</div>
				{showAddForm ? (
					<div className="form-group mt-8">
						<div className="form-group">
							<label>Server Name</label>
							<input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-server" />
						</div>
						<div className="form-group-row">
							<label className="checkbox-label">
								<input type="radio" name="transport" checked={newTransport === "stdio"} onChange={() => setNewTransport("stdio")} />
								Stdio
							</label>
							<label className="checkbox-label">
								<input type="radio" name="transport" checked={newTransport === "sse"} onChange={() => setNewTransport("sse")} />
								SSE
							</label>
						</div>
						{newTransport === "stdio" ? (
							<>
								<div className="form-group">
									<label>Command</label>
									<input type="text" value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder="npx, uvx, node..." />
								</div>
								<div className="form-group">
									<label>Arguments (space separated)</label>
									<input type="text" value={newArgs} onChange={(e) => setNewArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem /path" />
								</div>
							</>
						) : (
							<div className="form-group">
								<label>Server URL</label>
								<input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="http://localhost:3000/sse" />
							</div>
						)}
						<div className="row">
							<button className="btn" onClick={handleAdd}>Add Server</button>
							<button className="btn secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
						</div>
					</div>
				) : (
					<button className="btn secondary mt-8" onClick={() => setShowAddForm(true)}>+ Add MCP Server</button>
				)}
			</div>
		</div>
	);
}
