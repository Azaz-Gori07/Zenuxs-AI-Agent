import { useEffect } from "react";
import { useExtensionState } from "./context/ExtensionStateContext.js";
import { ChatView } from "./components/ChatView.js";
import { SettingsView } from "./components/SettingsView.js";
import { HistoryView } from "./components/HistoryView.js";
import { DashboardView } from "./components/DashboardView.js";
import { LogsView } from "./components/LogsView.js";
import { TeamsView } from "./components/TeamsView.js";
import type { TabId } from "./types.js";

const TABS: { id: TabId; label: string }[] = [
	{ id: "chat", label: "Chat" },
	{ id: "history", label: "History" },
	{ id: "settings", label: "Settings" },
	{ id: "teams", label: "Teams" },
	{ id: "dashboard", label: "Dashboard" },
	{ id: "logs", label: "Logs" },
];

export function App() {
	const { state, dispatch, switchTab, newSession } = useExtensionState();
	if (typeof window !== "undefined") {
		(window as any).logStartup?.("WEBVIEW", state.activeSessionId || "None", "React", "App_render", "EVENT", "N/A", `activeTab:${state.activeTab}`);
	}

	useEffect(() => {
		if (state.toast) {
			const t = setTimeout(() => dispatch({ type: "DISMISS_TOAST" }), 3000);
			return () => clearTimeout(t);
		}
	}, [state.toast, dispatch]);

	return (
		<div className="app-root">

			{state.activeTab === "chat" && <ChatView />}
			{state.activeTab === "history" && <HistoryView />}
			{state.activeTab === "settings" && <SettingsView />}
			{state.activeTab === "teams" && <TeamsView />}
			{state.activeTab === "dashboard" && <DashboardView />}
			{state.activeTab === "logs" && <LogsView />}
			{state.toast && (
				<div className="toast-container">
					<div className={`toast ${state.toast.severity}`}>{state.toast.message}</div>
				</div>
			)}
		</div>
	);
}
