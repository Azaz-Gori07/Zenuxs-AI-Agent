import { useRef, useEffect, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";

export function LogsView() {
	const { state, dispatch, runCommand } = useExtensionState();
	const consoleRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (consoleRef.current) {
			consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
		}
	}, [state.logs]);

	const clearLogs = useCallback(() => {
		dispatch({ type: "CLEAR_LOGS" });
	}, [dispatch]);

	return (
		<div className="logs-container">
			<div className="logs-console" ref={consoleRef}>
				{state.logs.map((line, i) => (
					<div key={i} className={line.startsWith("[ERROR]") ? "log-error" : line.startsWith("[WARN]") ? "log-warn" : "log-info"}>{line}</div>
				))}
			</div>
			<div className="logs-actions-bar">
				<button className="btn sm" onClick={() => runCommand("build")}>Run Build</button>
				<button className="btn sm" onClick={() => runCommand("lint")}>Run Lint</button>
				<button className="btn sm" onClick={() => runCommand("test")}>Run Test</button>
				<button className="btn sm danger" onClick={() => runCommand("doctor")}>Doctor Fix</button>
				<button className="btn sm secondary" style={{ marginLeft: "auto" }} onClick={clearLogs}>Clear Panel</button>
			</div>
		</div>
	);
}
