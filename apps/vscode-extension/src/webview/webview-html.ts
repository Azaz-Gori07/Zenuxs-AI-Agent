export function getWebviewHtml(
	nonce: string,
	cspSource: string,
	scriptUri: string,
): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} data:; font-src ${cspSource};">
	<title>Zenuxs AI</title>
	<style>
		:root {
			--bg: var(--vscode-editor-background, #1e1e1e);
			--fg: var(--vscode-editor-foreground, #cccccc);
			--border: var(--vscode-panel-border, #3c3c3c);
			--input-bg: var(--vscode-input-background, #252526);
			--input-fg: var(--vscode-input-foreground, #cccccc);
			--input-border: var(--vscode-input-border, #3c3c3c);
			--button-bg: var(--vscode-button-background, #4f46e5);
			--button-fg: var(--vscode-button-foreground, #ffffff);
			--button-hover: #4338ca;
			--accent: var(--vscode-focusBorder, #6366f1);
			--accent-gradient: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
			--muted: var(--vscode-descriptionForeground, #858585);
			--error: var(--vscode-errorForeground, #ef4444);
			--success: var(--vscode-testing-iconPassed, #10b981);
			--warning: var(--vsceextensionButton-prominentForeground, #f59e0b);
			--header-bg: var(--vscode-sideBar-background, #1f1f2e);
			--card-bg: color-mix(in srgb, var(--bg) 96%, white);
			--card-hover: color-mix(in srgb, var(--bg) 92%, white);
			--font-mono: var(--vscode-editor-font-family, monospace);
			--code-bg: #1e1e1e;
			--log-bg: #111;
			--log-fg: #8d8;
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			color: var(--fg);
			background: var(--bg);
			height: 100vh;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		#root { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
		.app-root { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
		.tabs-header {
			display: flex; background: var(--header-bg); border-bottom: 1px solid var(--border);
			padding: 4px 8px 0 8px; gap: 4px; user-select: none; flex-shrink: 0;
		}
		.tab-btn {
			background: transparent; border: none; color: var(--muted); padding: 8px 12px;
			cursor: pointer; font-size: 0.95em; font-weight: 500;
			border-radius: 4px 4px 0 0; border-bottom: 2px solid transparent;
			transition: all 0.2s ease;
		}
		.tab-btn:hover { color: var(--fg); background: color-mix(in srgb, var(--bg) 93%, white); }
		.tab-btn.active { color: var(--fg); border-bottom-color: var(--accent); background: var(--bg); }
		::-webkit-scrollbar { width: 8px; height: 8px; }
		::-webkit-scrollbar-track { background: transparent; }
		::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
		::-webkit-scrollbar-thumb:hover { background: var(--muted); }
		.chat-view, .history-view, .settings-container, .dashboard-container, .logs-container {
			flex: 1; display: flex; flex-direction: column; overflow: hidden;
		}
		.selector-bar {
			padding: 10px 12px; background: color-mix(in srgb, var(--bg) 97%, white);
			border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
		}
		.selector-row { display: flex; gap: 8px; align-items: center; }
		select, input[type="text"], input[type="number"], input[type="password"], textarea {
			width: 100%; background: var(--input-bg); color: var(--input-fg);
			border: 1px solid var(--input-border); border-radius: 4px; padding: 6px 8px;
			font-family: inherit; font-size: inherit;
		}
		select:focus, input:focus, textarea:focus { outline: 1px solid var(--accent); }
		.option-checkbox-row {
			display: flex; gap: 12px; align-items: center; font-size: 0.9em; color: var(--muted);
		}
		.checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
		.checkbox-label input { cursor: pointer; }
		.messages-container {
			flex: 1; overflow-y: auto; padding: 12px; display: flex;
			flex-direction: column; gap: 12px;
		}
		.message {
			padding: 10px 14px; border-radius: 6px; max-width: 100%;
			position: relative; line-height: 1.45; display: flex; flex-direction: column; gap: 6px;
			animation: fadeIn 0.15s ease;
		}
		@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
		.message.user { background: var(--input-bg); border: 1px solid var(--border); align-self: flex-end; max-width: 85%; }
		.message.assistant { background: color-mix(in srgb, var(--accent) 6%, transparent); border-left: 3px solid var(--accent); }
		.message.error { background: color-mix(in srgb, var(--error) 6%, transparent); border-left: 3px solid var(--error); color: var(--error); }
		.message-header { font-weight: 600; font-size: 0.85em; color: var(--muted); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; }
		.message-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s ease; }
		.message:hover .message-actions { opacity: 1; }
		.msg-action-btn { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; }
		.msg-action-btn:hover { color: var(--fg); background: var(--card-hover); }
		.edit-box { display: flex; flex-direction: column; gap: 6px; }
		.edit-box textarea { resize: vertical; min-height: 60px; }
		.edit-actions { display: flex; gap: 6px; }
		*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
		.message-text { white-space: pre-wrap; word-wrap: break-word; }
		.markdown-body p { margin: 4px 0; }
		.markdown-body h1, .markdown-body h2, .markdown-body h3 { margin: 8px 0 4px; color: var(--fg); }
		.markdown-body h1 { font-size: 1.3em; }
		.markdown-body h2 { font-size: 1.15em; }
		.markdown-body h3 { font-size: 1.05em; }
		.markdown-body a { color: var(--accent); text-decoration: underline; }
		.markdown-body blockquote {
			border-left: 3px solid var(--accent); padding: 4px 12px; margin: 6px 0;
			color: var(--muted); background: color-mix(in srgb, var(--bg) 95%, black); border-radius: 0 4px 4px 0;
		}
		.markdown-body ul, .markdown-body ol { padding-left: 20px; margin: 4px 0; }
		.markdown-body li { margin: 2px 0; }
		.markdown-body del { opacity: 0.6; }
		.markdown-body img { max-width: 100%; border-radius: 4px; margin: 8px 0; }
		.reasoning-block {
			background: color-mix(in srgb, var(--bg) 95%, black); border-left: 2px solid var(--muted);
			border-radius: 4px; padding: 8px 12px; font-style: italic; font-size: 0.9em; color: var(--muted); margin-top: 4px;
		}
		.reasoning-header {
			font-weight: 600; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em;
			margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;
			cursor: pointer;
		}
		.reasoning-content { white-space: pre-wrap; }
		.thinking-indicator { padding: 10px 0; }
		.dot-pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 1.4s infinite ease-in-out; }
		@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
		.tool-timeline { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; border-left: 1px dashed var(--border); padding-left: 10px; margin-left: 4px; }
		.tool-node {
			font-size: 0.9em; border-radius: 4px; padding: 6px 10px; background: var(--card-bg);
			border: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px;
		}
		.tool-node-header { display: flex; justify-content: space-between; align-items: center; font-weight: 500; }
		.tool-status-badge { font-size: 0.8em; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
		.tool-status-badge.running { background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent); }
		.tool-status-badge.completed { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); }
		.tool-status-badge.failed { background: color-mix(in srgb, var(--error) 20%, transparent); color: var(--error); }
		.tool-details {
			font-family: var(--font-mono); font-size: 0.85em; background: color-mix(in srgb, var(--bg) 93%, black);
			padding: 6px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; max-height: 120px;
		}
		.approval-card {
			margin-top: 8px; border: 1px solid var(--accent); border-radius: 6px; padding: 12px;
			background: color-mix(in srgb, var(--accent) 8%, var(--bg));
			display: flex; flex-direction: column; gap: 8px;
		}
		.approval-input {
			background: var(--bg); border: 1px solid var(--border); padding: 6px;
			font-family: var(--font-mono); font-size: 0.85em; max-height: 100px; overflow: auto;
		}
		.approval-actions { display: flex; gap: 8px; }
		.input-section {
			padding: 10px 12px; border-top: 1px solid var(--border); background: var(--bg);
			display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
		}
		.textarea-wrapper { position: relative; display: flex; }
		#prompt-textarea {
			flex: 1; resize: none; min-height: 40px; max-height: 180px;
			padding: 10px 40px 10px 12px; border-radius: 6px; line-height: 1.4;
		}
		.send-icon-btn {
			position: absolute; right: 8px; bottom: 8px; background: var(--button-bg); color: var(--button-fg);
			border: none; border-radius: 4px; width: 26px; height: 26px; cursor: pointer;
			display: flex; align-items: center; justify-content: center; transition: background 0.15s ease;
		}
		.send-icon-btn:hover { background: var(--button-hover); }
		.send-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
		.stop-btn {
			background: var(--error); color: #fff; border: none; padding: 8px 12px; border-radius: 4px;
			cursor: pointer; font-weight: 500; text-align: center; display: none;
		}
		.autocomplete-list {
			position: absolute; bottom: 100%; left: 12px; right: 12px; background: var(--input-bg);
			border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 -4px 12px rgba(0,0,0,0.35);
			max-height: 200px; overflow-y: auto; z-index: 100; display: none;
		}
		.autocomplete-item { padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
		.autocomplete-item:hover, .autocomplete-item.selected { background: color-mix(in srgb, var(--accent) 15%, var(--input-bg)); }
		.autocomplete-cmd { font-weight: 600; color: var(--accent); }
		.autocomplete-desc { font-size: 0.85em; color: var(--muted); }
		.chat-bottom-bar { display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; color: var(--muted); padding: 0 4px; }
		.attachment-btn { background: transparent; border: none; color: var(--muted); cursor: pointer; display: flex; align-items: center; gap: 4px; }
		.attachment-btn:hover { color: var(--fg); }
		.welcome-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px 20px; }
		.welcome-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--accent-gradient); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; }
		.btn {
			background: var(--button-bg); color: var(--button-fg); border: none; border-radius: 4px;
			padding: 8px 12px; cursor: pointer; font-weight: 500; transition: background 0.15s ease;
			display: inline-flex; align-items: center; justify-content: center; gap: 6px;
		}
		.btn:hover { background: var(--button-hover); }
		.btn:disabled { opacity: 0.5; cursor: not-allowed; }
		.btn.danger { background: var(--error); color: white; }
		.btn.success { background: var(--success); color: white; }
		.btn.secondary { background: transparent; border: 1px solid var(--border); color: var(--fg); }
		.btn.secondary:hover { background: color-mix(in srgb, var(--bg) 88%, white); }
		.btn.sm { padding: 4px 8px; font-size: 0.85em; }
		.history-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
		.history-group-title { font-size: 0.85em; font-weight: 600; text-transform: uppercase; color: var(--muted); margin-top: 10px; margin-bottom: 6px; letter-spacing: 0.05em; }
		.history-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px;
			padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;
			cursor: pointer; transition: all 0.15s ease;
		}
		.history-item:hover { background: var(--card-hover); border-color: var(--muted); }
		.history-info { display: flex; flex-direction: column; gap: 4px; flex: 1; overflow: hidden; padding-right: 12px; }
		.history-title { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
		.history-meta-row { font-size: 0.8em; color: var(--muted); display: flex; gap: 8px; white-space: nowrap; }
		.history-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s ease; }
		.history-item:hover .history-actions { opacity: 1; }
		.action-btn { background: transparent; border: none; color: var(--muted); padding: 4px 6px; border-radius: 4px; cursor: pointer; }
		.action-btn:hover { color: var(--fg); background: color-mix(in srgb, var(--bg) 88%, white); }
		.settings-container { padding: 16px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
		.settings-section { display: flex; flex-direction: column; gap: 12px; }
		.settings-section-title { font-size: 1.05em; font-weight: 600; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 4px; }
		.form-group { display: flex; flex-direction: column; gap: 6px; }
		.form-group label { font-weight: 500; }
		.form-group-row { display: flex; gap: 12px; align-items: center; }
		.settings-subtabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 12px; gap: 8px; overflow-x: auto; }
		.settings-subtab-btn { background: transparent; border: none; color: var(--muted); padding: 6px 10px; cursor: pointer; font-size: 0.9em; border-bottom: 2px solid transparent; white-space: nowrap; }
		.settings-subtab-btn.active { color: var(--fg); border-bottom-color: var(--accent); font-weight: 600; }
		.toggle-list { display: flex; flex-direction: column; gap: 8px; }
		.toggle-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px;
			padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;
		}
		.toggle-item-info { display: flex; flex-direction: column; gap: 2px; flex: 1; padding-right: 12px; }
		.toggle-item-name { font-weight: 600; }
		.toggle-item-desc { font-size: 0.85em; color: var(--muted); }
		.switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
		.switch input { opacity: 0; width: 0; height: 0; }
		.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border); transition: .2s; border-radius: 20px; }
		.slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; }
		input:checked + .slider { background-color: var(--accent); }
		input:checked + .slider:before { transform: translateX(16px); }
		.oauth-section { margin-top: 16px; border-top: 1px dashed var(--border); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
		.oauth-title { font-weight: 600; font-size: 0.9em; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
		.dashboard-container { padding: 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
		.metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
		.metric-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
		.metric-value { font-size: 1.6em; font-weight: 700; color: var(--accent); }
		.metric-label { font-size: 0.85em; color: var(--muted); font-weight: 500; }
		.dashboard-charts { display: flex; flex-wrap: wrap; gap: 16px; }
		.chart-section { flex: 1; min-width: 200px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
		.chart-section.full-width { flex-basis: 100%; }
		.breakdown-title { font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
		.chart-bar-row { display: flex; align-items: center; gap: 8px; font-size: 0.85em; padding: 3px 0; }
		.chart-bar-label { width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
		.chart-bar-track { flex: 1; height: 16px; background: var(--input-bg); border-radius: 8px; overflow: hidden; }
		.chart-bar-fill { height: 100%; border-radius: 8px; transition: width 0.3s ease; min-width: 2px; }
		.chart-bar-fill.provider { background: linear-gradient(90deg, var(--accent), #06b6d4); }
		.chart-bar-fill.model { background: linear-gradient(90deg, var(--success), #34d399); }
		.chart-bar-fill.tools { background: linear-gradient(90deg, #f59e0b, #f97316); }
		.chart-bar-value { width: 40px; text-align: right; font-weight: 600; flex-shrink: 0; }
		.logs-container { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
		.logs-console {
			flex: 1; background: var(--log-bg); color: var(--log-fg); font-family: var(--font-mono);
			font-size: 0.85em; padding: 10px; border-radius: 6px; overflow-y: auto;
			white-space: pre-wrap; border: 1px solid var(--border);
		}
		.log-info { color: var(--log-fg); }
		.log-error { color: var(--error); }
		.log-warn { color: var(--warning); }
		.logs-actions-bar { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
		.row { display: flex; gap: 8px; }
		.col { flex: 1; }
		.text-center { text-align: center; }
		.text-muted { color: var(--muted); }
		.search-box { margin-bottom: 8px; }
		.code-block-wrapper { margin: 8px 0; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
		.code-block-header { background: var(--header-bg); padding: 4px 8px; font-size: 0.8em; font-family: var(--font-mono); color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
		.code-block-content { margin: 0; padding: 10px; background: var(--code-bg); color: #d4d4d4; font-family: var(--font-mono); font-size: 0.9em; overflow-x: auto; }
		.inline-code { font-family: var(--font-mono); padding: 2px 4px; background: color-mix(in srgb, var(--border) 40%, transparent); border-radius: 3px; }
		.markdown-body strong { font-weight: 600; }
		.markdown-body em { font-style: italic; }
		.toast-container {
			position: fixed; bottom: 16px; right: 16px; z-index: 1000;
			animation: slideIn 0.2s ease;
		}
		@keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
		.toast {
			padding: 10px 16px; border-radius: 6px; font-size: 0.9em; font-weight: 500;
			box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		}
		.toast.info { background: var(--accent); color: white; }
		.toast.success { background: var(--success); color: white; }
		.toast.error { background: var(--error); color: white; }
		.mcp-server-list { display: flex; flex-direction: column; gap: 8px; }
		.mcp-server-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px;
			padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;
		}
		.mcp-server-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
		.mcp-server-name { font-weight: 600; }
		.mcp-server-meta { font-size: 0.8em; color: var(--muted); display: flex; gap: 8px; }
		.mcp-server-actions { display: flex; gap: 4px; }
		.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
		.status-dot.connected { background: var(--success); }
		.status-dot.connecting { background: var(--warning); }
		.status-dot.disconnected { background: var(--muted); }
		.checkpoint-list { display: flex; flex-direction: column; gap: 6px; }
		.checkpoint-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: 4px;
			padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9em;
		}
		.form-inline { display: flex; gap: 8px; align-items: flex-end; }
		.form-inline .form-group { flex: 1; }
		.mt-8 { margin-top: 8px; }
		.gap-4 { gap: 4px; }
		.flex-wrap { flex-wrap: wrap; }
		.flex { display: flex; }
		.items-center { align-items: center; }
	</style>
</head>
<body>
	<div id="root"><div class="welcome-placeholder"><div class="welcome-icon">Z</div><h2>Loading Zenuxs...</h2></div></div>
	<script nonce="${nonce}">
		(function() {
			try {
				const vscode = window.vscodeApi || acquireVsCodeApi();
				window.vscodeApi = vscode;
				
				window.logStartup = function(workerId, sessionId, component, func, event, duration, status) {
					vscode.postMessage({
						type: 'webview_log',
						level: 'info',
						message: '',
						logParams: {
							workerId: workerId,
							sessionId: sessionId || 'None',
							component: component,
							func: func,
							event: event,
							duration: duration || 'N/A',
							status: status || 'SUCCESS'
						}
					});
				};
				
				window.addEventListener('error', function(e) {
					vscode.postMessage({
						type: 'webview_log',
						level: 'error',
						message: e.message + ' at ' + e.filename + ':' + e.lineno + ':' + e.colno,
						stack: e.error ? e.error.stack : null
					});
				});

				window.addEventListener('unhandledrejection', function(e) {
					vscode.postMessage({
						type: 'webview_log',
						level: 'error',
						message: e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled rejection',
						stack: e.reason ? e.reason.stack : null
					});
				});

				const logTypes = ['log', 'info', 'warn', 'error'];
				logTypes.forEach(function(type) {
					const original = console[type];
					console[type] = function() {
						original.apply(console, arguments);
						vscode.postMessage({
							type: 'webview_log',
							level: type,
							message: Array.prototype.slice.call(arguments).map(function(arg) {
								return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
							}).join(' ')
						});
					};
				});
			} catch (err) {
				console.error('Failed to set up webview logger:', err);
			}
		})();
	</script>
	<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
