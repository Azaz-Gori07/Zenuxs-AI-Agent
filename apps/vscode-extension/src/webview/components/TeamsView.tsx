import { useState, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";

type TeamsSubtab = "members" | "tasks" | "runs" | "mailbox";

export function TeamsView() {
	const { state, spawnTeammate, shutdownTeammate, getTeamStatus, runTeamTask, listTeamRuns, cancelTeamRun, sendTeamMessage, broadcastTeamMessage, readTeamMailbox, addTeamMissionLog, listTeamTasks, createTeamTask, completeTeamTask, listConnectors, connectConnector, disconnectConnector } = useExtensionState();
	const [activeSubtab, setActiveSubtab] = useState<TeamsSubtab>("members");
	const [spawnAgentId, setSpawnAgentId] = useState("");
	const [spawnRole, setSpawnRole] = useState("");
	const [taskAgentId, setTaskAgentId] = useState("");
	const [taskDesc, setTaskDesc] = useState("");
	const [msgTo, setMsgTo] = useState("");
	const [msgSubject, setMsgSubject] = useState("");
	const [msgBody, setMsgBody] = useState("");
	const [connectorProvider, setConnectorProvider] = useState("slack");
	const [connectorName, setConnectorName] = useState("");
	const [connectorToken, setConnectorToken] = useState("");

	const ts = state.teamStatus;

	const handleSpawn = useCallback(() => {
		if (spawnAgentId.trim()) {
			spawnTeammate(spawnAgentId.trim(), spawnRole.trim());
			setSpawnAgentId(""); setSpawnRole("");
		}
	}, [spawnAgentId, spawnRole, spawnTeammate]);

	const handleRunTask = useCallback(() => {
		if (taskAgentId.trim() && taskDesc.trim()) {
			runTeamTask(taskAgentId.trim(), taskDesc.trim());
			setTaskDesc("");
		}
	}, [taskAgentId, taskDesc, runTeamTask]);

	const handleSendMsg = useCallback(() => {
		if (msgTo.trim() && msgSubject.trim() && msgBody.trim()) {
			sendTeamMessage(msgTo.trim(), msgSubject.trim(), msgBody.trim());
			setMsgSubject(""); setMsgBody("");
		}
	}, [msgTo, msgSubject, msgBody, sendTeamMessage]);

	const handleConnectConnector = useCallback(() => {
		connectConnector(connectorProvider, connectorName.trim() || connectorProvider, connectorToken ? { token: connectorToken } : undefined);
		setConnectorName(""); setConnectorToken("");
	}, [connectorProvider, connectorName, connectorToken, connectConnector]);

	return (
		<div className="settings-container">
			<div className="settings-subtabs">
				{(["members", "tasks", "runs", "mailbox"] as TeamsSubtab[]).map((st) => (
					<button key={st} className={`settings-subtab-btn ${activeSubtab === st ? "active" : ""}`} onClick={() => setActiveSubtab(st)}>
						{st.charAt(0).toUpperCase() + st.slice(1)}
					</button>
				))}
			</div>

			{activeSubtab === "members" && (
				<div className="settings-section">
					<h3 className="settings-section-title">Team Members</h3>
					<div className="mcp-server-list">
						{!ts || ts.members.length === 0 ? (
							<div className="text-muted text-center" style={{ padding: 10 }}>No active team. Spawn a teammate to start.</div>
						) : (
							ts.members.map((m) => (
								<div key={m.agentId} className="mcp-server-item">
									<div className="mcp-server-info">
										<div className="mcp-server-name">
											<span className={`status-dot ${m.status === "running" ? "connected" : m.status === "idle" ? "disconnected" : "connecting"}`} />
											{m.agentId} <span className="text-muted">({m.role})</span>
										</div>
										{m.description && <div className="mcp-server-meta">{m.description}</div>}
									</div>
									<div className="mcp-server-actions">
										<button className="btn sm danger" onClick={() => shutdownTeammate(m.agentId)}>Shutdown</button>
									</div>
								</div>
							))
						)}
					</div>
					<div className="form-group mt-8">
						<div className="form-inline">
							<div className="form-group">
								<label>Agent ID</label>
								<input type="text" value={spawnAgentId} onChange={(e) => setSpawnAgentId(e.target.value)} placeholder="worker-1" />
							</div>
							<div className="form-group">
								<label>Role Prompt</label>
								<input type="text" value={spawnRole} onChange={(e) => setSpawnRole(e.target.value)} placeholder="You are a code reviewer" />
							</div>
							<button className="btn" onClick={handleSpawn}>Spawn</button>
						</div>
						<button className="btn secondary sm mt-8" onClick={getTeamStatus}>Refresh Status</button>
					</div>
				</div>
			)}

			{activeSubtab === "tasks" && (
				<div className="settings-section">
					<h3 className="settings-section-title">Team Tasks</h3>
					<div className="mcp-server-list">
						{state.teamTasks.length === 0 ? (
							<div className="text-muted text-center" style={{ padding: 10 }}>No tasks.</div>
						) : (
							state.teamTasks.map((t) => (
								<div key={t.id} className="mcp-server-item">
									<div className="mcp-server-info">
										<div className="mcp-server-name">{t.title}</div>
										<div className="mcp-server-meta">{t.status} | {t.assignee || "unassigned"} | by {t.createdBy}</div>
									</div>
									{t.status === "in_progress" && (
										<button className="btn sm success" onClick={() => completeTeamTask(t.id, "Done")}>Complete</button>
									)}
								</div>
							))
						)}
					</div>
					<div className="form-group mt-8">
						<div className="form-group">
							<label>Title</label>
							<input type="text" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Task title" />
						</div>
						<div className="form-inline">
							<div className="form-group">
								<label>Assignee (optional)</label>
								<input type="text" value={taskAgentId} onChange={(e) => setTaskAgentId(e.target.value)} placeholder="agent-id" />
							</div>
							<button className="btn" onClick={() => { if (taskDesc.trim()) { createTeamTask(taskDesc.trim(), taskDesc.trim(), taskAgentId.trim() || undefined); setTaskDesc(""); setTaskAgentId(""); } }}>Create</button>
						</div>
						<button className="btn secondary sm mt-8" onClick={listTeamTasks}>Refresh Tasks</button>
					</div>
				</div>
			)}

			{activeSubtab === "runs" && (
				<div className="settings-section">
					<h3 className="settings-section-title">Team Runs</h3>
					<div className="form-inline">
						<div className="form-group">
							<label>Teammate ID</label>
							<input type="text" value={taskAgentId} onChange={(e) => setTaskAgentId(e.target.value)} placeholder="worker-1" />
						</div>
						<div className="form-group">
							<label>Task</label>
							<input type="text" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Run: test suite" />
						</div>
						<button className="btn" onClick={handleRunTask}>Run Task</button>
					</div>
					<div className="mcp-server-list mt-8">
						{state.teamRuns.length === 0 ? (
							<div className="text-muted text-center" style={{ padding: 10 }}>No runs.</div>
						) : (
							state.teamRuns.map((r) => (
								<div key={r.id} className="mcp-server-item">
									<div className="mcp-server-info">
										<div className="mcp-server-name">{r.agentId}: {r.message.slice(0, 60)}</div>
										<div className="mcp-server-meta">{r.status} | {r.currentActivity || "idle"}</div>
									</div>
									{(r.status === "running" || r.status === "queued") && (
										<button className="btn sm danger" onClick={() => cancelTeamRun(r.id)}>Cancel</button>
									)}
								</div>
							))
						)}
					</div>
					<button className="btn secondary sm mt-8" onClick={listTeamRuns}>Refresh Runs</button>
				</div>
			)}

			{activeSubtab === "mailbox" && (
				<div className="settings-section">
					<h3 className="settings-section-title">Team Mailbox</h3>
					<div className="form-group">
						<label>To Agent ID</label>
						<input type="text" value={msgTo} onChange={(e) => setMsgTo(e.target.value)} placeholder="worker-1" />
					</div>
					<div className="form-group">
						<label>Subject</label>
						<input type="text" value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} placeholder="Status update" />
					</div>
					<div className="form-group">
						<label>Body</label>
						<textarea rows={2} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Message content" />
					</div>
					<div className="row">
						<button className="btn" onClick={handleSendMsg}>Send Direct</button>
						<button className="btn secondary" onClick={() => { if (msgSubject.trim() && msgBody.trim()) { broadcastTeamMessage(msgSubject.trim(), msgBody.trim()); setMsgSubject(""); setMsgBody(""); } }}>Broadcast</button>
						<button className="btn secondary" onClick={readTeamMailbox}>Read Mailbox</button>
					</div>
				</div>
			)}

			<div className="settings-section" style={{ marginTop: 20 }}>
				<h3 className="settings-section-title">Connectors (Slack / Discord / Telegram)</h3>
				<div className="mcp-server-list">
					{state.connectors.length === 0 ? (
						<div className="text-muted text-center" style={{ padding: 10 }}>No connectors configured.</div>
					) : (
						state.connectors.map((c) => (
							<div key={c.id} className="mcp-server-item">
								<div className="mcp-server-info">
									<div className="mcp-server-name">
										<span className={`status-dot ${c.connected ? "connected" : "disconnected"}`} />
										{c.name}
									</div>
									<div className="mcp-server-meta">{c.provider} {c.lastActive && `| last active: ${c.lastActive}`}</div>
								</div>
								<button className="btn sm danger" onClick={() => disconnectConnector(c.id)}>Disconnect</button>
							</div>
						))
					)}
				</div>
				<div className="form-inline mt-8">
					<div className="form-group">
						<label>Provider</label>
						<select value={connectorProvider} onChange={(e) => setConnectorProvider(e.target.value)}>
							<option value="slack">Slack</option>
							<option value="discord">Discord</option>
							<option value="telegram">Telegram</option>
						</select>
					</div>
					<div className="form-group">
						<label>Name</label>
						<input type="text" value={connectorName} onChange={(e) => setConnectorName(e.target.value)} placeholder="my-slack-bot" />
					</div>
					<button className="btn" onClick={handleConnectConnector}>Connect</button>
				</div>
				<button className="btn secondary sm mt-8" onClick={listConnectors}>Refresh</button>
			</div>
		</div>
	);
}
