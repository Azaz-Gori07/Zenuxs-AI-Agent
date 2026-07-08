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
			--bg: color-mix(in srgb, var(--vscode-editor-background, #121318) 85%, #08090c);
			--fg: var(--vscode-editor-foreground, #e2e8f0);
			--border: var(--vscode-panel-border, rgba(255, 255, 255, 0.08));
			--input-bg: rgba(0, 0, 0, 0.22);
			--input-fg: var(--vscode-input-foreground, #f1f5f9);
			--input-border: rgba(255, 255, 255, 0.1);
			--button-bg: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
			--button-fg: var(--vscode-button-foreground, #ffffff);
			--button-hover: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
			--accent: #8b5cf6;
			--accent-gradient: linear-gradient(135deg, #a78bfa 0%, #22d3ee 100%);
			--muted: rgba(255, 255, 255, 0.45);
			--error: #f43f5e;
			--success: #10b981;
			--warning: #f59e0b;
			--header-bg: color-mix(in srgb, var(--bg) 95%, #181b25);
			--card-bg: rgba(255, 255, 255, 0.025);
			--card-hover: rgba(255, 255, 255, 0.055);
			--font-mono: var(--vscode-editor-font-family, Menlo, Monaco, Consolas, "Fira Code", monospace);
			--code-bg: rgba(0, 0, 0, 0.35);
			--log-bg: #090a0f;
			--log-fg: #34d399;
			--radius: 8px;
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			color: var(--fg);
			background: var(--bg);
			height: 100vh;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			-webkit-font-smoothing: antialiased;
		}
		#root { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
		.app-root { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
		.tabs-header {
			display: flex; background: var(--header-bg); border-bottom: 1px solid var(--border);
			padding: 8px 12px; gap: 6px; user-select: none; flex-shrink: 0; align-items: center;
			overflow-x: auto;
		}
		.tabs-header::-webkit-scrollbar { display: none; }
		.tab-btn {
			background: transparent; border: 1px solid transparent; color: var(--muted); padding: 6px 12px;
			cursor: pointer; font-size: 0.9em; font-weight: 500;
			border-radius: 6px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			white-space: nowrap;
		}
		.tab-btn:hover { color: var(--fg); background: rgba(255, 255, 255, 0.04); }
		.tab-btn.active {
			color: #fff; background: rgba(124, 58, 237, 0.15);
			border-color: rgba(124, 58, 237, 0.3);
			box-shadow: 0 0 12px rgba(124, 58, 237, 0.1);
		}
		::-webkit-scrollbar { width: 6px; height: 6px; }
		::-webkit-scrollbar-track { background: transparent; }
		::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 3px; }
		::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
		.chat-view, .history-view, .settings-container, .dashboard-container, .logs-container {
			flex: 1; display: flex; flex-direction: column; overflow: hidden;
		}
		.selector-bar {
			padding: 10px 14px; background: var(--header-bg);
			border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
		}
		.selector-row { display: flex; gap: 8px; align-items: center; }
		.selector-row select { flex: 1; min-width: 0; }
		select, input[type="text"], input[type="number"], input[type="password"], textarea {
			width: 100%; background: var(--input-bg); color: var(--input-fg);
			border: 1px solid var(--input-border); border-radius: var(--radius); padding: 8px 10px;
			font-family: inherit; font-size: inherit; transition: all 0.2s ease;
		}
		select {
			appearance: none;
			background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
			background-repeat: no-repeat;
			background-position: right 8px center;
			background-size: 12px;
			padding-right: 28px;
		}
		select:focus, input:focus, textarea:focus {
			outline: none; border-color: var(--accent);
			box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
		}
		.option-checkbox-row {
			display: flex; gap: 14px; align-items: center; font-size: 0.9em; color: var(--muted);
			flex-wrap: wrap;
		}
		.option-checkbox-row select { width: auto; flex-shrink: 1; min-width: 100px; }
		.checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
		.checkbox-label input {
			cursor: pointer; width: 14px; height: 14px; accent-color: var(--accent);
		}
		.messages-container {
			flex: 1; overflow-y: auto; padding: 14px; display: flex;
			flex-direction: column; gap: 14px;
		}
		.message {
			padding: 12px 16px; border-radius: var(--radius); max-width: 100%;
			position: relative; line-height: 1.5; display: flex; flex-direction: column; gap: 6px;
			animation: fadeInUp 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: 0 2px 8px rgba(0,0,0,0.12);
			border: 1px solid rgba(255, 255, 255, 0.04);
		}
		@keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
		.message.user {
			background: rgba(124, 58, 237, 0.09); border-color: rgba(124, 58, 237, 0.2);
			align-self: flex-end; max-width: 85%; border-radius: 12px 12px 2px 12px;
		}
		.message.assistant {
			background: var(--card-bg); border-left: 3px solid var(--accent);
		}
		.message.error {
			background: rgba(244, 63, 94, 0.07); border-left: 3px solid var(--error); border-color: rgba(244, 63, 94, 0.15); color: var(--fg);
		}
		.message-header {
			font-weight: 600; font-size: 0.85em; color: var(--muted); margin-bottom: 2px;
			display: flex; justify-content: space-between; align-items: center;
			text-transform: uppercase; letter-spacing: 0.05em;
		}
		.message.user .message-header { color: rgba(167, 139, 250, 0.85); }
		.message.assistant .message-header { color: rgba(255, 255, 255, 0.7); }
		.message-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.2s ease; }
		.message:hover .message-actions { opacity: 1; }
		.msg-action-btn {
			background: transparent; border: 1px solid rgba(255,255,255,0.06); color: var(--muted);
			padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;
			justify-content: center; width: 24px; height: 24px; transition: all 0.15s ease;
		}
		.msg-action-btn:hover { color: var(--fg); background: var(--card-hover); border-color: rgba(255,255,255,0.15); }
		.edit-box { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
		.edit-box textarea { resize: vertical; min-height: 64px; }
		.edit-actions { display: flex; gap: 8px; }
		*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
		.message-text { white-space: pre-wrap; word-wrap: break-word; font-size: 0.95em; }
		.markdown-body p { margin: 6px 0; }
		.markdown-body h1, .markdown-body h2, .markdown-body h3 { margin: 12px 0 6px; color: #fff; font-weight: 600; }
		.markdown-body h1 { font-size: 1.25em; }
		.markdown-body h2 { font-size: 1.15em; }
		.markdown-body h3 { font-size: 1.05em; }
		.markdown-body a { color: #a78bfa; text-decoration: none; border-bottom: 1px dotted #a78bfa; transition: color 0.15s ease; }
		.markdown-body a:hover { color: #c4b5fd; border-bottom-style: solid; }
		.markdown-body blockquote {
			border-left: 3px solid var(--accent); padding: 6px 12px; margin: 8px 0;
			color: rgba(255, 255, 255, 0.7); background: rgba(0, 0, 0, 0.15); border-radius: 0 var(--radius) var(--radius) 0;
		}
		.markdown-body ul, .markdown-body ol { padding-left: 20px; margin: 6px 0; }
		.markdown-body li { margin: 3px 0; }
		.markdown-body del { opacity: 0.55; }
		.markdown-body img { max-width: 100%; border-radius: var(--radius); margin: 8px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.25); }
		.reasoning-block {
			background: rgba(0, 0, 0, 0.16); border-left: 3px solid rgba(255, 255, 255, 0.15);
			border-radius: 4px; padding: 10px 14px; font-size: 0.9em; color: var(--muted); margin-top: 6px;
			border: 1px solid rgba(255, 255, 255, 0.04); border-left-width: 3px;
		}
		.reasoning-header {
			font-weight: 600; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em;
			margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;
			cursor: pointer; color: rgba(255,255,255,0.6); transition: color 0.15s ease;
		}
		.reasoning-header:hover { color: var(--fg); }
		.reasoning-content { white-space: pre-wrap; font-family: var(--font-mono); margin-top: 8px; line-height: 1.45; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; }
		.thinking-indicator { padding: 8px 0; display: flex; align-items: center; }
		.dot-pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 1.4s infinite ease-in-out; box-shadow: 0 0 8px var(--accent); }
		@keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
		.tool-timeline { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; border-left: 1px dashed rgba(255,255,255,0.12); padding-left: 12px; margin-left: 6px; }
		.tool-node {
			font-size: 0.9em; border-radius: 6px; padding: 8px 12px; background: rgba(255, 255, 255, 0.015);
			border: 1px solid rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; gap: 6px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.05);
		}
		.tool-node-header { display: flex; justify-content: space-between; align-items: center; font-weight: 500; }
		.tool-status-badge { font-size: 0.8em; padding: 2px 8px; border-radius: 12px; font-weight: 600; text-transform: uppercase; }
		.tool-status-badge.running { background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3); }
		.tool-status-badge.completed { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
		.tool-status-badge.failed { background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); }
		.tool-details {
			font-family: var(--font-mono); font-size: 0.85em; background: rgba(0, 0, 0, 0.25);
			padding: 8px 10px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; max-height: 140px;
			color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.03);
		}
		.approval-card {
			margin-top: 10px; border: 1px solid rgba(139, 92, 246, 0.3); border-radius: var(--radius); padding: 14px;
			background: color-mix(in srgb, var(--accent) 7%, var(--bg));
			display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 16px rgba(124, 58, 237, 0.15);
		}
		.approval-input {
			background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.06); padding: 8px 10px;
			font-family: var(--font-mono); font-size: 0.85em; max-height: 120px; overflow: auto; border-radius: 4px;
		}
		.approval-actions { display: flex; gap: 8px; }
		.input-section {
			padding: 12px 14px; border-top: 1px solid var(--border); background: var(--header-bg);
			display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
		}
		.textarea-wrapper { position: relative; display: flex; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: var(--radius); transition: all 0.2s ease; }
		.textarea-wrapper:focus-within {
			border-color: var(--accent);
			box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
		}
		#prompt-textarea {
			flex: 1; resize: none; min-height: 52px; max-height: 100px;
			padding: 14px 44px 14px 14px; border-radius: var(--radius); line-height: 1.45;
			background: transparent; border: none; color: var(--input-fg); outline: none;
		}
		#prompt-textarea:focus { outline: none; }
		.send-icon-btn {
			position: absolute; right: 12px; bottom: 12px; background: var(--button-bg); color: var(--button-fg);
			border: none; border-radius: 6px; width: 26px; height: 26px; cursor: pointer;
			display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);
		}
		.send-icon-btn:hover:not(:disabled) { background: var(--button-hover); transform: translateY(-1px); }
		.send-icon-btn:active:not(:disabled) { transform: scale(0.95); }
		.send-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
		.stop-btn {
			background: var(--error); color: #fff; border: none; padding: 10px 14px; border-radius: var(--radius);
			cursor: pointer; font-weight: 600; text-align: center; display: none; transition: all 0.2s ease;
			box-shadow: 0 4px 12px rgba(244, 63, 94, 0.25);
		}
		.stop-btn:hover { background: #e11d48; transform: translateY(-1px); }
		.stop-btn:active { transform: scale(0.98); }
		.autocomplete-list {
			position: absolute; bottom: 100%; left: 12px; right: 12px; background: color-mix(in srgb, var(--header-bg) 95%, #fff);
			border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 -8px 24px rgba(0,0,0,0.45);
			max-height: 200px; overflow-y: auto; z-index: 100; display: none; padding: 4px;
			backdrop-filter: blur(8px);
		}
		.autocomplete-item { padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; border-radius: 6px; transition: background 0.15s ease; }
		.autocomplete-item:hover, .autocomplete-item.selected { background: rgba(124, 58, 237, 0.15); }
		.autocomplete-cmd { font-weight: 600; color: #a78bfa; }
		.autocomplete-desc { font-size: 0.85em; color: var(--muted); }
		.chat-bottom-bar { display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; color: var(--muted); padding: 2px 4px 0 4px; flex-wrap: wrap; gap: 6px; }
		.attachment-btn { background: transparent; border: none; color: var(--muted); cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 0.95em; transition: color 0.15s ease; }
		.attachment-btn:hover { color: var(--fg); }
		.welcome-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px 24px; text-align: center; }
		.welcome-icon {
			width: 60px; height: 60px; border-radius: 16px; background: var(--accent-gradient); color: #fff;
			display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800;
			box-shadow: 0 8px 24px rgba(124, 58, 237, 0.35); animation: float 4s ease-in-out infinite;
		}
		@keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
		.welcome-placeholder h2 { font-weight: 700; color: #fff; font-size: 1.4em; }
		.btn {
			background: var(--button-bg); color: var(--button-fg); border: 1px solid transparent; border-radius: 6px;
			padding: 8px 14px; cursor: pointer; font-weight: 600; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			display: inline-flex; align-items: center; justify-content: center; gap: 6px;
			box-shadow: 0 4px 10px rgba(124, 58, 237, 0.2);
		}
		.btn:hover:not(:disabled) { background: var(--button-hover); transform: translateY(-1px); box-shadow: 0 6px 14px rgba(124, 58, 237, 0.3); }
		.btn:active:not(:disabled) { transform: scale(0.98); }
		.btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
		.btn.danger { background: var(--error); box-shadow: 0 4px 10px rgba(244, 63, 94, 0.2); }
		.btn.danger:hover:not(:disabled) { background: #e11d48; box-shadow: 0 6px 14px rgba(244, 63, 94, 0.3); }
		.btn.success { background: var(--success); box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
		.btn.success:hover:not(:disabled) { background: #059669; box-shadow: 0 6px 14px rgba(16, 185, 129, 0.3); }
		.btn.secondary { background: transparent; border: 1px solid var(--border); color: var(--fg); box-shadow: none; }
		.btn.secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.04); border-color: rgba(255,255,255,0.15); }
		.btn.sm { padding: 5px 10px; font-size: 0.85em; border-radius: 4px; }
		.history-list { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
		.history-group-title { font-size: 0.8em; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-top: 12px; margin-bottom: 8px; letter-spacing: 0.08em; }
		.history-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
			padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;
			cursor: pointer; transition: all 0.2s ease;
		}
		.history-item:hover { background: var(--card-hover); border-color: rgba(255, 255, 255, 0.15); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
		.history-info { display: flex; flex-direction: column; gap: 4px; flex: 1; overflow: hidden; padding-right: 12px; }
		.history-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f1f5f9; }
		.history-meta-row { font-size: 0.8em; color: var(--muted); display: flex; gap: 10px; white-space: nowrap; }
		.history-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.2s ease; }
		.history-item:hover .history-actions { opacity: 1; }
		.delete-btn {
			background: transparent; border: 1px solid transparent; color: var(--muted);
			padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;
			justify-content: center; width: 26px; height: 26px; transition: all 0.15s ease;
		}
		.delete-btn:hover { color: var(--error); background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.2); }
		.settings-container { padding: 16px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; }
		.settings-section { display: flex; flex-direction: column; gap: 14px; background: rgba(255, 255, 255, 0.012); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
		.settings-section-title { font-size: 1.05em; font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 4px; color: #fff; letter-spacing: 0.02em; }
		.form-group { display: flex; flex-direction: column; gap: 6px; }
		.form-group label { font-weight: 600; color: rgba(255, 255, 255, 0.85); font-size: 0.95em; }
		.form-group-row { display: flex; gap: 12px; align-items: center; }
		.settings-subtabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 12px; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
		.settings-subtab-btn { background: transparent; border: none; color: var(--muted); padding: 8px 12px; cursor: pointer; font-size: 0.9em; border-bottom: 2px solid transparent; white-space: nowrap; transition: all 0.2s ease; border-radius: 4px 4px 0 0; }
		.settings-subtab-btn:hover { color: var(--fg); background: rgba(255, 255, 255, 0.03); }
		.settings-subtab-btn.active { color: #fff; border-bottom-color: var(--accent); font-weight: 600; background: rgba(124, 58, 237, 0.05); }
		.toggle-list { display: flex; flex-direction: column; gap: 8px; }
		.toggle-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px;
			padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;
			transition: all 0.2s ease;
		}
		.toggle-item:hover { background: var(--card-hover); }
		.toggle-item-info { display: flex; flex-direction: column; gap: 2px; flex: 1; padding-right: 12px; }
		.toggle-item-name { font-weight: 600; color: #fff; }
		.toggle-item-desc { font-size: 0.85em; color: var(--muted); line-height: 1.4; }
		.switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
		.switch input { opacity: 0; width: 0; height: 0; }
		.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255, 255, 255, 0.12); transition: .2s; border-radius: 20px; }
		.slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
		input:checked + .slider { background-color: var(--accent); }
		input:checked + .slider:before { transform: translateX(16px); }
		.oauth-section { margin-top: 18px; border-top: 1px dashed var(--border); padding-top: 16px; display: flex; flex-direction: column; gap: 10px; }
		.oauth-title { font-weight: 700; font-size: 0.85em; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
		.dashboard-container { padding: 16px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
		.metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
		.metric-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
		.metric-value { font-size: 1.5em; font-weight: 800; color: #c4b5fd; text-shadow: 0 0 10px rgba(124, 58, 237, 0.15); }
		.metric-label { font-size: 0.85em; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
		.dashboard-charts { display: flex; flex-wrap: wrap; gap: 16px; }
		.chart-section { flex: 1; min-width: 240px; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
		.chart-section.full-width { flex-basis: 100%; }
		.breakdown-title { font-weight: 700; font-size: 1em; margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px; color: #fff; }
		.chart-bar-row { display: flex; align-items: center; gap: 10px; font-size: 0.85em; padding: 4px 0; }
		.chart-bar-label { width: 84px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; color: rgba(255, 255, 255, 0.85); font-weight: 500; }
		.chart-bar-track { flex: 1; height: 12px; background: rgba(0,0,0,0.25); border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03); }
		.chart-bar-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease; min-width: 2px; }
		.chart-bar-fill.provider { background: linear-gradient(90deg, #8b5cf6, #06b6d4); }
		.chart-bar-fill.model { background: linear-gradient(90deg, #10b981, #34d399); }
		.chart-bar-fill.tools { background: linear-gradient(90deg, #f59e0b, #ef4444); }
		.chart-bar-value { width: 44px; text-align: right; font-weight: 700; flex-shrink: 0; color: #fff; }
		.logs-container { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
		.logs-console {
			flex: 1; background: var(--log-bg); color: var(--log-fg); font-family: var(--font-mono);
			font-size: 0.85em; padding: 12px; border-radius: var(--radius); overflow-y: auto;
			white-space: pre-wrap; border: 1px solid var(--border); line-height: 1.45;
			box-shadow: inset 0 3px 8px rgba(0,0,0,0.4);
		}
		.log-info { color: #34d399; }
		.log-error { color: var(--error); }
		.log-warn { color: var(--warning); }
		.logs-actions-bar { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
		.row { display: flex; gap: 8px; }
		.col { flex: 1; }
		.text-center { text-align: center; }
		.text-muted { color: var(--muted); }
		.search-box { margin-bottom: 8px; }
		.code-block-wrapper { margin: 12px 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
		.code-block-header { background: var(--header-bg); padding: 6px 12px; font-size: 0.8em; font-family: var(--font-mono); color: var(--muted); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
		.code-block-header span { text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
		.code-block-content { margin: 0; padding: 12px; background: var(--code-bg); color: #e2e8f0; font-family: var(--font-mono); font-size: 0.85em; overflow-x: auto; line-height: 1.45; }
		.inline-code { font-family: var(--font-mono); padding: 2px 5px; background: rgba(255, 255, 255, 0.08); border-radius: 4px; color: #f472b6; font-size: 0.9em; }
		.markdown-body strong { font-weight: 600; color: #fff; }
		.markdown-body em { font-style: italic; }
		.toast-container {
			position: fixed; bottom: 20px; right: 20px; z-index: 1000;
			animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		}
		@keyframes slideIn { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
		.toast {
			padding: 10px 18px; border-radius: 6px; font-size: 0.9em; font-weight: 600;
			box-shadow: 0 10px 25px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05);
			display: flex; align-items: center; gap: 8px;
		}
		.toast.info { background: var(--button-bg); color: white; border-color: rgba(139, 92, 246, 0.3); }
		.toast.success { background: var(--success); color: white; border-color: rgba(16, 185, 129, 0.3); }
		.toast.error { background: var(--error); color: white; border-color: rgba(244, 63, 94, 0.3); }
		.mcp-server-list { display: flex; flex-direction: column; gap: 10px; }
		.mcp-server-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
			padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;
			transition: all 0.2s ease;
		}
		.mcp-server-item:hover { background: var(--card-hover); }
		.mcp-server-info { display: flex; flex-direction: column; gap: 4px; flex: 1; }
		.mcp-server-name { font-weight: 700; color: #fff; display: flex; align-items: center; }
		.mcp-server-meta { font-size: 0.8em; color: var(--muted); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
		.mcp-server-actions { display: flex; gap: 6px; align-items: center; }
		.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; box-shadow: 0 0 6px currentColor; }
		.status-dot.connected { background: var(--success); color: var(--success); }
		.status-dot.connecting { background: var(--warning); color: var(--warning); }
		.status-dot.disconnected { background: var(--muted); color: var(--muted); }
		.checkpoint-list { display: flex; flex-direction: column; gap: 8px; }
		.checkpoint-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px;
			padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9em;
		}
		.form-inline { display: flex; gap: 8px; align-items: flex-end; }
		.form-inline .form-group { flex: 1; }
		.mt-8 { margin-top: 8px; }
		.gap-4 { gap: 4px; }
		.flex-wrap { flex-wrap: wrap; }
		.flex { display: flex; }
		.items-center { align-items: center; }
		.mode-badge {
			box-shadow: 0 2px 6px rgba(0,0,0,0.1);
			border: 1px solid currentColor;
		}
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
