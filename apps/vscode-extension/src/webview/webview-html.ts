export function getWebviewHtml(
	nonce: string,
	cspSource: string,
	scriptUri: string,
	logoUri: string,
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
		@keyframes pulseGlow {
			0% { transform: scale(0.9) translateY(0); opacity: 0.4; }
			100% { transform: scale(1.2) translateY(-10px); opacity: 0.8; }
		}
		@keyframes pulseGlowSecondary {
			0% { transform: scale(0.8) translate(0, 0); opacity: 0.3; }
			100% { transform: scale(1.3) translate(-20px, -15px); opacity: 0.6; }
		}
		@keyframes welcomeEntry {
			0% { opacity: 0; transform: scale(0.88) translateY(20px); filter: blur(8px); }
			30% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
			70% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
			100% { opacity: 0; transform: scale(1.03) translateY(-8px); filter: blur(6px); }
		}
		@keyframes welcomeFloat {
			0% { transform: translateY(0px) rotateX(0deg) scale(1); }
			50% { transform: translateY(-6px) rotateX(2deg) scale(1.01); }
			100% { transform: translateY(-3px) rotateX(1deg) scale(1); }
		}
		@keyframes subtitleFadeIn {
			0% { opacity: 0; transform: translateY(6px); }
			100% { opacity: 1; transform: translateY(0); }
		}
		@keyframes loginEntry {
			0% { opacity: 0; transform: translateY(16px) scale(0.97); filter: blur(6px); }
			100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
		}
		@keyframes transitionBlur {
			0% { opacity: 1; backdrop-filter: blur(0px); }
			50% { opacity: 1; backdrop-filter: blur(8px); }
			100% { opacity: 0; backdrop-filter: blur(0px); }
		}
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
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
		select { color-scheme: dark; }
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
			flex: 1 1 0%; display: flex; flex-direction: column; overflow: hidden; min-height: 0;
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
		select::-webkit-listbox,
		select option {
			background: #1e1e2e !important;
			color: #e2e8f0 !important;
		}
		select option:hover,
		select option:focus,
		select option:active,
		select option:checked {
			background: rgba(124, 58, 237, 0.2) !important;
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
			flex: 1 1 0%; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 6px 8px; display: flex;
			flex-direction: column; gap: 3px; position: relative;
		}
		.scroll-to-bottom-btn {
			position: absolute; right: 12px; bottom: 12px; z-index: 50;
			background: var(--button-bg); color: var(--button-fg);
			border: none; border-radius: 20px; padding: 5px 10px; font-size: 0.78em;
			cursor: pointer; display: flex; align-items: center; gap: 4px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35); font-weight: 600;
			transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		}
		.scroll-to-bottom-btn:hover { background: var(--button-hover); transform: translateY(-2px); }
		.message {
			padding: 3px 8px; max-width: 100%;
			position: relative; line-height: 1.5; display: flex; flex-direction: column; gap: 2px;
			animation: chatFadeIn 0.15s ease-out;
		}
		@keyframes chatFadeIn { from { opacity: 0; } to { opacity: 1; } }
		.message.user {
			align-self: flex-end; max-width: 85%;
		}
		.message.assistant {
		}
		.message.error {
			color: var(--error);
		}
		.message-header {
			font-weight: 500; font-size: 0.78em; color: var(--muted);
			display: flex; justify-content: space-between; align-items: center;
		}
		.message-header .brand-zenuxs { font-weight: 600; letter-spacing: 0.04em; }
		.message.user .message-header .brand-zenuxs { display: none; }
		.message-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s ease; }
		.message:hover .message-actions { opacity: 1; }
		.msg-action-btn {
			background: transparent; border: none; color: var(--muted);
			padding: 3px; border-radius: 3px; cursor: pointer; display: flex; align-items: center;
			justify-content: center; width: 20px; height: 20px; transition: all 0.15s ease;
		}
		.msg-action-btn:hover { color: var(--fg); background: rgba(255,255,255,0.06); }
		.message.editing { width: 100%; }
		.edit-box { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; width: 100%; }
		.edit-box textarea {
			resize: vertical; min-height: 80px; width: 100%; box-sizing: border-box;
			background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border);
			color: #fff; padding: 10px; border-radius: 6px; font-family: inherit; font-size: 0.95em;
		}
		.edit-box textarea:focus {
			border-color: var(--accent); outline: none;
		}
		.edit-actions { display: flex; gap: 8px; }
		*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
		.message-text { white-space: pre-wrap; word-wrap: break-word; font-size: 0.925em; line-height: 1.65; }
		.markdown-body p { margin: 4px 0; line-height: 1.65; }
		.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 { margin: 10px 0 4px; color: #fff; font-weight: 600; }
		.markdown-body h1 { font-size: 1.2em; }
		.markdown-body h2 { font-size: 1.1em; }
		.markdown-body h3 { font-size: 1em; }
		.markdown-body h4 { font-size: 0.95em; }
		.markdown-body a { color: var(--accent); text-decoration: none; }
		.markdown-body a:hover { text-decoration: underline; }
		.markdown-body blockquote {
			border-left: 2px solid var(--accent); padding: 4px 12px; margin: 6px 0;
			color: var(--muted);
		}
		.markdown-body ul, .markdown-body ol { padding-left: 18px; margin: 4px 0; }
		.markdown-body li { margin: 2px 0; }
		.markdown-body li > p { margin: 0; }
		.markdown-body del { opacity: 0.5; }
		.markdown-body img { max-width: 100%; border-radius: 4px; margin: 6px 0; }
		.markdown-body hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
		.markdown-body table { border-collapse: collapse; margin: 6px 0; font-size: 0.9em; width: 100%; }
		.markdown-body th, .markdown-body td { border: 1px solid var(--border); padding: 4px 8px; text-align: left; }
		.markdown-body th { background: rgba(255,255,255,0.04); font-weight: 600; }
		.markdown-body input[type="checkbox"] { accent-color: var(--accent); margin-right: 4px; }
		.reasoning-block {
			font-size: 0.88em; color: var(--muted); margin-top: 4px;
		}
		.reasoning-header {
			font-size: 0.8em; display: flex; align-items: center; gap: 4px;
			cursor: pointer; color: var(--muted); transition: color 0.15s ease;
			user-select: none;
		}
		.reasoning-header:hover { color: var(--fg); }
		.reasoning-content { white-space: pre-wrap; font-family: var(--font-mono); margin-top: 4px; line-height: 1.5; font-size: 0.92em; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.04); }
		.dot-pulse { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 1.4s infinite ease-in-out; box-shadow: 0 0 6px var(--accent); }
		@keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
		.tool-timeline { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
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
			flex: 1; resize: none; min-height: 80px; max-height: 150px;
			padding: 14px 44px 38px 14px; border-radius: var(--radius); line-height: 1.45;
			background: transparent; border: none; color: var(--input-fg); outline: none;
			overflow-y: hidden;
			-ms-overflow-style: none;
			scrollbar-width: none;
		}
		#prompt-textarea::-webkit-scrollbar {
			display: none;
		}
		#prompt-textarea:focus { outline: none; }
		.send-icon-btn {
			position: absolute; right: 8px; bottom: 8px; background: var(--button-bg); color: var(--button-fg);
			border: none; border-radius: 6px; width: 26px; height: 26px; cursor: pointer;
			display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);
		}
		.send-icon-btn.stop { background: var(--error); box-shadow: 0 4px 10px rgba(244, 63, 94, 0.25); }
		.send-icon-btn.stop:hover { background: #e11d48; transform: translateY(-1px); }
		.send-icon-btn:hover:not(:disabled):not(.stop) { background: var(--button-hover); transform: translateY(-1px); }
		.send-icon-btn:active:not(:disabled) { transform: scale(0.95); }
		.send-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
		.bottom-left-controls {
			position: absolute; left: 8px; bottom: 8px; z-index: 10;
			margin-left: 5px; display: flex; align-items: center; gap: 8px;
		}
		.mode-switcher-btn {
			background: transparent; border: none; outline: none; box-shadow: none;
			color: var(--fg); padding: 0; font-size: 0.82em;
			cursor: pointer; display: flex; align-items: center; gap: 3px; font-weight: 600;
			transition: opacity 0.15s ease; user-select: none;
		}
		.mode-switcher-btn:hover {
			opacity: 0.8;
		}
		.mode-dropdown {
			position: absolute; bottom: 100%; left: 0; margin-bottom: 4px;
			background: color-mix(in srgb, var(--header-bg) 95%, #fff); border: 1px solid var(--border);
			border-radius: var(--radius); box-shadow: 0 -4px 16px rgba(0,0,0,0.35);
			min-width: 110px; display: flex; flex-direction: column; padding: 4px;
			z-index: 100; backdrop-filter: blur(8px);
		}
		.mode-dropdown-item {
			padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8em;
			color: var(--muted); transition: all 0.15s ease; display: flex;
			align-items: center; justify-content: space-between; font-weight: 500;
		}
		.mode-dropdown-item:hover, .mode-dropdown-item.active {
			background: rgba(124, 58, 237, 0.15); color: #fff;
		}
		.model-switcher-btn {
			background: transparent; border: none; outline: none; box-shadow: none;
			color: var(--muted); padding: 0; font-size: 0.82em;
			cursor: pointer; display: flex; align-items: center; gap: 3px; font-weight: 600;
			transition: color 0.15s ease; user-select: none;
			max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		}
		.model-switcher-btn:hover {
			color: var(--fg);
		}
		.model-dropdown {
			position: absolute; bottom: 100%; left: 0; margin-bottom: 4px;
			background: color-mix(in srgb, var(--header-bg) 95%, #fff); border: 1px solid var(--border);
			border-radius: var(--radius); box-shadow: 0 -4px 16px rgba(0,0,0,0.35);
			min-width: 160px; max-height: 200px; overflow-y: auto;
			display: flex; flex-direction: column; padding: 4px;
			z-index: 100; backdrop-filter: blur(8px);
		}
		.model-dropdown::-webkit-scrollbar {
			width: 4px;
		}
		.model-dropdown::-webkit-scrollbar-track {
			background: transparent;
		}
		.model-dropdown::-webkit-scrollbar-thumb {
			background: var(--border);
			border-radius: 2px;
		}
		.model-dropdown-item {
			padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;
			color: var(--muted); transition: all 0.15s ease; display: flex;
			align-items: center; justify-content: space-between; font-weight: 500;
			white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		}
		.model-dropdown-item:hover, .model-dropdown-item.active {
			background: rgba(124, 58, 237, 0.15); color: #fff;
		}
		.model-dropdown.enhanced {
			min-width: 240px; max-height: 360px; padding: 0;
		}
		.model-search-wrapper {
			padding: 6px 8px; border-bottom: 1px solid var(--border); flex-shrink: 0;
		}
		.model-search-input {
			width: 100%; box-sizing: border-box;
			background: rgba(0,0,0,0.2); border: 1px solid var(--border);
			border-radius: 4px; padding: 5px 8px; font-size: 0.8em;
			color: var(--fg); outline: none;
		}
		.model-search-input:focus {
			border-color: var(--accent);
		}
		.model-dropdown-items {
			overflow-y: auto; flex: 1; padding: 4px;
		}
		.model-dropdown-empty {
			padding: 12px; text-align: center; color: var(--muted); font-size: 0.8em;
		}
		.model-group-header {
			padding: 4px 10px 2px; font-size: 0.7em; font-weight: 700;
			color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;
		}
		.model-item-name {
			flex: 1; overflow: hidden; text-overflow: ellipsis;
		}
		.model-item-badges {
			display: flex; gap: 3px; flex-shrink: 0; margin-left: 6px;
		}
		.model-badge {
			display: inline-flex; align-items: center; justify-content: center;
			font-size: 0.7em; font-weight: 700; padding: 1px 4px; border-radius: 3px;
			line-height: 1.2;
		}
		.model-badge.reasoning { background: rgba(168, 85, 247, 0.25); color: #c084fc; }
		.model-badge.vision { background: rgba(59, 130, 246, 0.25); color: #93c5fd; }
		.model-badge.files { background: rgba(34, 197, 94, 0.25); color: #86efac; }
		.model-badge.ctx { background: rgba(234, 179, 8, 0.2); color: #fde047; }
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
		.welcome-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 15vh; gap: 16px; padding-left: 24px; padding-right: 24px; text-align: center; }
		.welcome-icon {
			width: 85px; height: 85px;
			 animation: float 4s ease-in-out infinite;
			object-fit: cover;
			mix-blend-mode: screen;
			background-color: rgba(255, 255, 255, 0.08);
		}
		@keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
		.welcome-placeholder h2 { font-weight: 700; color: #fff; font-size: 1.4em; }
		.welcome-recent-sessions { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
		.welcome-recent-label { font-size: 0.78em; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; text-align: left; margin-bottom: 2px; }
		.welcome-session-title { display: block; font-weight: 500; font-size: 0.92em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.welcome-session-meta { display: block; font-size: 0.78em; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.chat-messages-list { display: flex; flex-direction: column; gap: 4px; width: 100%; }
		.btn {
			background: var(--button-bg); color: var(--button-fg); border: 1px solid transparent; border-radius: 6px;
			padding: 8px 14px; cursor: pointer; font-weight: 600; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			display: inline-flex; align-items: center; justify-content: center; gap: 6px;
			box-shadow: 0 4px 10px rgba(124, 58, 237, 0.2);
		}
		.btn:hover:not(:disabled) { background: var(--button-hover); transform: translateY(-1px); box-shadow: 0 6px 14px rgba(124, 58, 237, 0.3); }
		.btn:active:not(:disabled) { transform: scale(0.98); }
		.btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
		.recent-chat-item {
			background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border);
			border-radius: 6px; padding: 8px 12px; text-align: left; color: var(--fg);
			font-size: 0.85em; cursor: pointer; display: flex; align-items: center;
			justify-content: space-between; gap: 8px; transition: all 0.2s ease;
		}
		.recent-chat-item:hover {
			background: rgba(124, 58, 237, 0.12); border-color: rgba(124, 58, 237, 0.25);
			transform: translateY(-1px);
		}
		.recent-chat-item:active {
			transform: translateY(0);
		}
		.link-btn {
			background: none; border: none; padding: 0; color: var(--accent);
			font-size: 0.85em; cursor: pointer; font-weight: 600; transition: opacity 0.15s ease;
		}
		.link-btn:hover {
			text-decoration: underline; opacity: 0.85;
		}
		.btn.danger { background: var(--error); box-shadow: 0 4px 10px rgba(244, 63, 94, 0.2); }
		.btn.danger:hover:not(:disabled) { background: #e11d48; box-shadow: 0 6px 14px rgba(244, 63, 94, 0.3); }
		.btn.success { background: var(--success); box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
		.btn.success:hover:not(:disabled) { background: #059669; box-shadow: 0 6px 14px rgba(16, 185, 129, 0.3); }
		.btn.secondary { background: transparent; border: 1px solid var(--border); color: var(--fg); box-shadow: none; }
		.btn.secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.04); border-color: rgba(255,255,255,0.15); }
		.btn.sm { padding: 5px 10px; font-size: 0.85em; border-radius: 4px; }
		.task-completion-card {
			margin: 10px 0 14px 0;
			padding: 12px 14px;
			border-radius: 8px;
			border: 1px solid rgba(16, 185, 129, 0.3);
			background: linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0%, rgba(16, 185, 129, 0.03) 100%);
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05);
			animation: fadeInCompletion 0.3s cubic-bezier(0.16, 1, 0.3, 1);
			width: 100%;
			box-sizing: border-box;
		}
		@keyframes fadeInCompletion {
			from { opacity: 0; transform: translateY(4px); }
			to { opacity: 1; transform: translateY(0); }
		}
		.completion-header {
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.completion-icon-badge {
			width: 24px;
			height: 24px;
			border-radius: 50%;
			background: rgba(16, 185, 129, 0.2);
			border: 1px solid rgba(16, 185, 129, 0.4);
			color: #10b981;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		}
		.completion-header-text {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.completion-title {
			font-weight: 600;
			font-size: 0.9em;
			color: var(--fg);
			letter-spacing: -0.01em;
		}
		.completion-subtitle {
			font-size: 0.8em;
			color: var(--muted);
		}
		.completion-metrics {
			display: flex;
			flex-wrap: wrap;
			gap: 6px 12px;
			margin-top: 10px;
			padding-top: 10px;
			border-top: 1px solid rgba(16, 185, 129, 0.15);
		}
		.completion-metric-item {
			display: flex;
			align-items: center;
			gap: 5px;
			font-size: 0.78em;
			background: rgba(0, 0, 0, 0.15);
			padding: 3px 8px;
			border-radius: 4px;
			border: 1px solid rgba(255, 255, 255, 0.04);
		}
		.metric-icon { font-size: 0.9em; opacity: 0.85; }
		.metric-label { color: var(--muted); font-weight: 400; }
		.metric-value { color: var(--fg); font-weight: 600; }
		.completion-footer {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-top: 8px;
			font-size: 0.75em;
			color: var(--muted);
		}
		.completion-footer-dot {
			width: 5px;
			height: 5px;
			border-radius: 50%;
			background: #10b981;
			opacity: 0.8;
		}
		.history-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }
		.history-header { padding: 18px 16px 12px 16px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid var(--border); }
		.history-header h2 { font-size: 1.15em; font-weight: 700; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px; }
		.history-header p { font-size: 0.82em; color: var(--muted); margin: 0; }
		.history-toolbar { padding: 10px 16px; display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--border); background: rgba(0, 0, 0, 0.08); }
		.history-search-wrapper { position: relative; flex: 1; display: flex; align-items: center; }
		.history-search-input {
			width: 100%; padding: 6px 10px 6px 28px; background: rgba(255, 255, 255, 0.03);
			border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 0.85em;
			outline: none; transition: all 0.2s ease;
		}
		.history-search-input:focus { border-color: var(--accent); background: rgba(255,255,255,0.06); box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15); }
		.history-search-icon { position: absolute; left: 8px; color: var(--muted); pointer-events: none; display: flex; align-items: center; }
		.history-toolbar-actions { display: flex; gap: 6px; }
		.history-toolbar-btn {
			background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); color: var(--fg);
			padding: 6px; border-radius: 6px; cursor: pointer; display: flex; align-items: center;
			justify-content: center; transition: all 0.2s ease;
		}
		.history-toolbar-btn:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.15); }
		.history-toolbar-btn.danger:hover { color: var(--error); background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.2); }
		.history-toolbar-btn.primary { background: var(--accent-gradient); border-color: transparent; color: #fff; }
		.history-toolbar-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }
		.history-list { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
		.history-group-title { font-size: 0.78em; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-top: 10px; margin-bottom: 6px; letter-spacing: 0.08em; display: flex; align-items: center; gap: 8px; }
		.history-group-title::after { content: ""; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.05); }
		.history-item {
			background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
			padding: 12px; display: flex; align-items: center; justify-content: space-between;
			cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); gap: 12px;
		}
		.history-item:hover { background: var(--card-hover); border-color: rgba(124, 58, 237, 0.25); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
		.provider-icon-badge {
			width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center;
			justify-content: center; font-size: 0.85em; font-weight: 700; color: #fff;
			background: var(--accent-gradient); flex-shrink: 0; text-transform: uppercase;
		}
		.provider-icon-badge.cline { background: linear-gradient(135deg, #7c3aed, #4f46e5); }
		.provider-icon-badge.openrouter { background: linear-gradient(135deg, #ea580c, #ca8a04); }
		.provider-icon-badge.openai { background: linear-gradient(135deg, #10b981, #059669); }
		.provider-icon-badge.anthropic { background: linear-gradient(135deg, #d97706, #b45309); }
		.provider-icon-badge.gemini { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
		.history-info { display: flex; flex-direction: column; gap: 3px; flex: 1; overflow: hidden; }
		.history-title { font-weight: 600; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc; }
		.history-meta-row { font-size: 0.78em; color: var(--muted); display: flex; gap: 10px; align-items: center; }
		.history-meta-item { display: flex; align-items: center; gap: 3px; }
		.history-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s ease; }
		.history-item:hover .history-actions { opacity: 1; }
		.history-action-btn {
			background: transparent; border: 1px solid transparent; color: var(--muted);
			padding: 5px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;
			justify-content: center; width: 26px; height: 26px; transition: all 0.15s ease;
		}
		.history-action-btn:hover { color: var(--fg); background: rgba(255, 255, 255, 0.05); }
		.history-action-btn.delete:hover { color: var(--error); background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.2); }
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
		.code-block-wrapper { margin: 8px 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
		.code-block-header { background: color-mix(in srgb, var(--bg) 85%, #fff); padding: 4px 10px; font-size: 0.78em; font-family: var(--font-mono); color: var(--muted); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
		.code-block-header span { font-weight: 500; }
		.code-block-header .code-lang-label { font-weight: 500; }
		.code-block-header .code-copy-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85em; padding: 2px 6px; border-radius: 3px; transition: all 0.15s ease; }
		.code-block-header .code-copy-btn:hover { color: var(--fg); background: rgba(255,255,255,0.06); }
		.code-block-content { margin: 0; padding: 10px; background: var(--code-bg); color: #e2e8f0; font-family: var(--font-mono); font-size: 0.85em; overflow-x: auto; line-height: 1.5; }
		.inline-code { font-family: var(--font-mono); padding: 1px 5px; background: rgba(255, 255, 255, 0.07); border-radius: 3px; color: #f472b6; font-size: 0.9em; }
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
		.flex { display: flex; }
		.items-center { align-items: center; }
		.mode-badge {
			box-shadow: 0 2px 6px rgba(0,0,0,0.1);
			border: 1px solid currentColor;
		}

		/* ================= CONTEXT WINDOW BAR ================= */
		.session-header-bar {
			background: color-mix(in srgb, var(--header-bg) 95%, #000);
			border-bottom: 1px solid var(--border);
			padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
			z-index: 10; gap: 14px;
		}
		.context-window-label {
			font-size: 0.72em; font-weight: 700; color: rgba(255,255,255,0.35);
			text-transform: uppercase; letter-spacing: 0.08em; flex-shrink: 0;
		}
		.context-window-display {
			display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;
		}
		.context-bar-track {
			flex: 1; max-width: 100px; height: 6px;
			background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;
		}
		.context-bar-fill {
			height: 100%; background: linear-gradient(90deg, #8b5cf6, #22d3ee);
			transition: width 0.3s ease; border-radius: 4px;
		}
		.context-window-text {
			font-size: 0.82em; color: rgba(255,255,255,0.6); font-weight: 500;
			font-variant-numeric: tabular-nums; white-space: nowrap;
		}
		.badge-compacted {
			background: rgba(16,185,129,0.1); color: #34d399; font-size: 0.65em;
			padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(16,185,129,0.15);
			font-weight: 700; flex-shrink: 0; letter-spacing: 0.04em;
		}
		.session-toolbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
		.toolbar-icon-btn {
			background: rgba(255,255,255,0.04); border: 1px solid var(--border);
			color: var(--muted); border-radius: 5px; width: 28px; height: 28px;
			display: flex; align-items: center; justify-content: center;
			cursor: pointer; transition: all 0.15s ease; font-size: 0.85em;
		}
		.toolbar-icon-btn:hover { color: var(--fg); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
		
		/* Checkpoint Dropdown menu */
		.checkpoint-dropdown {
			position: absolute; top: calc(100% + 6px); right: 0; background: color-mix(in srgb, var(--header-bg) 96%, #000);
			border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0,0,0,0.5);
			min-width: 220px; max-height: 250px; overflow-y: auto; padding: 6px; z-index: 200; backdrop-filter: blur(12px);
			animation: slideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1);
		}
		@keyframes slideDown { from { transform: translateY(-4px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
		.checkpoint-dropdown-title { font-size: 0.78em; font-weight: 700; text-transform: uppercase; color: var(--muted); padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px; letter-spacing: 0.05em; }
		.checkpoint-dropdown-item {
			display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 4px;
			cursor: pointer; font-size: 0.85em; transition: all 0.15s ease; color: var(--fg);
		}
		.checkpoint-dropdown-item:hover { background: rgba(124, 58, 237, 0.15); color: #fff; }
		.checkpoint-item-actions { display: flex; gap: 4px; }
		.checkpoint-item-btn { background: none; border: none; color: var(--muted); cursor: pointer; border-radius: 3px; padding: 2px; display: flex; }
		.checkpoint-item-btn:hover { color: var(--fg); background: rgba(255, 255, 255, 0.06); }
		.checkpoint-item-btn.delete:hover { color: var(--error); background: rgba(244,63,94,0.1); }



		/* File Diff Previewer */
		.file-diff-panel { background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-top: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
		.file-diff-header { background: rgba(0,0,0,0.15); padding: 6px 12px; font-size: 0.8em; font-weight: 600; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); color: var(--fg); }
		.file-diff-lines { font-family: var(--font-mono); font-size: 0.82em; line-height: 1.45; overflow-x: auto; padding: 8px 0; max-height: 250px; }
		.diff-line { display: flex; padding: 0 12px; white-space: pre; }
		.diff-line-added { background: rgba(16, 185, 129, 0.12); color: #34d399; }
		.diff-line-removed { background: rgba(244, 63, 94, 0.12); color: #f43f5e; }
		.diff-line-normal { color: rgba(255,255,255,0.7); }
		
		/* Workspace escaping warning banner */
		.warning-banner { background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 6px; padding: 10px 14px; color: #fda4af; font-size: 0.85em; line-height: 1.4; display: flex; gap: 8px; align-items: flex-start; }
		.warning-banner-icon { color: var(--error); font-size: 1.1em; line-height: 1; flex-shrink: 0; }

		/* Enhanced approval card */
		.approval-card.dangerous { border-color: rgba(244, 63, 94, 0.35); background: color-mix(in srgb, var(--error) 5%, var(--bg)); box-shadow: 0 4px 18px rgba(244, 63, 94, 0.15); }
		.approval-card-subtitle { font-size: 0.82em; color: var(--muted); margin-bottom: 4px; }
		.approval-feedback-area { display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed var(--border); padding-top: 12px; margin-top: 4px; }
		.approval-feedback-textarea { min-height: 60px; font-size: 0.85em; resize: vertical; }

		/* Tool Execution Progress bar */
		.tool-progress-bar-container { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
		.tool-progress-header { display: flex; justify-content: space-between; font-size: 0.8em; font-weight: 600; color: var(--muted); }
		.tool-progress-track { height: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03); }
		.tool-progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent) 0%, #a78bfa 100%); transition: width 0.3s ease; }
		
		/* Error recovery card */
		.error-recovery-card { border: 1px solid rgba(244, 63, 94, 0.2); background: rgba(244, 63, 94, 0.05); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
		.error-recovery-title { font-weight: 700; color: #fda4af; display: flex; align-items: center; gap: 6px; }
		.error-recovery-desc { font-size: 0.85em; color: var(--muted); line-height: 1.4; }
		.error-recovery-actions { display: flex; gap: 8px; flex-wrap: wrap; }

		/* ================= TASK EXECUTION PANEL ================= */
		.exec-panel {
			margin: 6px 0; border: 1px solid var(--border);
			border-radius: var(--radius); overflow: hidden;
			background: rgba(255,255,255,0.012);
			animation: chatFadeIn 0.15s ease-out;
		}
		.exec-panel.collapsed {
			border-color: rgba(255,255,255,0.06);
			background: rgba(255,255,255,0.005);
		}
		.exec-header {
			display: flex; align-items: center; gap: 8px;
			padding: 8px 12px; cursor: pointer; user-select: none;
			transition: background 0.1s ease;
		}
		.exec-header:hover { background: rgba(255,255,255,0.02); }
		.exec-toggle { font-size: 0.7em; color: var(--muted); flex-shrink: 0; width: 12px; }
		.exec-task-id { font-weight: 700; font-size: 0.85em; color: #fff; }
		.exec-live-status { font-size: 0.78em; color: var(--muted); font-weight: 500; }
		.exec-live-status .exec-status-done { color: var(--success); }
		.exec-live-status .exec-status-cancelled { color: var(--error); }
		.exec-live-status .exec-status-interrupted { color: var(--warning); }
		.exec-live-status .exec-status-stopping { color: var(--accent); }
		.exec-stop-btn {
			margin-left: auto; background: rgba(244,63,94,0.12);
			border: 1px solid rgba(244,63,94,0.2); color: #fda4af;
			padding: 3px 10px; border-radius: 4px; font-size: 0.75em;
			cursor: pointer; font-weight: 600; transition: all 0.15s ease;
		}
		.exec-stop-btn:hover { background: rgba(244,63,94,0.25); color: #fff; }
		.exec-body { padding: 4px 12px 10px 12px; display: flex; flex-direction: column; gap: 6px; }

		.phase-pending-row { font-size: 0.82em; color: var(--muted); display: flex; align-items: center; gap: 4px; }

		/* Step icon (flat event timeline) */
		.step-icon { font-size: 0.8em; width: 14px; text-align: center; flex-shrink: 0; }
		.step-path { font-family: var(--font-mono); font-size: 0.85em; color: var(--muted); margin-left: auto; }

		.exec-summary {
			margin-top: 4px; border: 1px solid var(--border);
			border-radius: 6px; overflow: hidden;
		}
		.summary-title-row {
			display: flex; align-items: center; gap: 6px;
			padding: 8px 10px; background: rgba(255,255,255,0.015);
			border-bottom: 1px solid var(--border);
		}
		.summary-check { color: var(--success); font-size: 0.9em; }
		.summary-title-text { font-weight: 700; font-size: 0.82em; color: #34d399; }
		.exec-summary .summary-stats {
			display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
			background: var(--border);
		}
		.exec-summary .summary-stat {
			display: flex; justify-content: space-between; align-items: center;
			padding: 5px 10px; font-size: 0.78em; background: rgba(255,255,255,0.008);
		}
		.exec-summary .summary-stat span:first-child { color: var(--muted); }
		.exec-summary .summary-stat span:last-child { color: #fff; font-weight: 600; font-variant-numeric: tabular-nums; }
		.exec-summary .summary-changes-btn {
			width: 100%; background: none; border: none; border-top: 1px solid var(--border);
			padding: 6px 10px; font-size: 0.76em; color: var(--muted); cursor: pointer;
			text-align: left; display: flex; align-items: center; gap: 4px;
			transition: color 0.15s ease; font-weight: 500;
		}
		.exec-summary .summary-changes-btn:hover { color: var(--fg); }

		.exec-summary .view-changes-panel { border-top: 1px solid var(--border); }
		.exec-summary .changes-group { border-bottom: 1px solid var(--border); }
		.exec-summary .changes-group:last-child { border-bottom: none; }
		.exec-summary .changes-group-label {
			font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
			padding: 4px 10px; color: var(--muted); background: rgba(0,0,0,0.1);
		}
		.exec-summary .changes-file-row {
			display: flex; align-items: center; gap: 6px;
			padding: 4px 10px; cursor: pointer; transition: background 0.1s ease;
		}
		.exec-summary .changes-file-row:hover { background: rgba(255,255,255,0.02); }
		.exec-summary .changes-file-icon {
			font-family: var(--font-mono); font-size: 0.78em; font-weight: 700; width: 14px; flex-shrink: 0;
		}
		.exec-summary .changes-file-icon.created { color: var(--success); }
		.exec-summary .changes-file-icon.modified { color: var(--warning); }
		.exec-summary .changes-file-icon.deleted { color: var(--error); }
		.exec-summary .changes-file-path {
			flex: 1; font-family: var(--font-mono); font-size: 0.78em; color: rgba(255,255,255,0.7);
			min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		}
		.exec-summary .changes-expand { font-size: 0.6em; color: var(--muted); flex-shrink: 0; }

		.exec-cancelled-block {
			padding: 10px; border: 1px solid rgba(244,63,94,0.15);
			border-radius: 6px; background: rgba(244,63,94,0.04);
			text-align: center; display: flex; flex-direction: column; gap: 8px;
		}
		.cancelled-title { font-weight: 700; font-size: 0.88em; color: #fda4af; }
		.cancelled-before { font-size: 0.78em; color: var(--muted); }

		.exec-completed-indicator {
			text-align: center; padding: 12px 8px;
			color: var(--success); font-weight: 600; font-size: 0.9em;
			letter-spacing: 0.5px; border-top: 1px solid rgba(34,197,94,0.12);
		}
		.vertical-timeline {
			display: flex; flex-direction: column; gap: 4px; position: relative;
			padding-left: 8px; margin: 4px 0;
		}
		.vertical-timeline-item {
			display: flex; flex-direction: column; position: relative;
			padding-left: 16px; border-left: 1px solid rgba(255,255,255,0.08);
		}
		.vertical-timeline-item::before {
			content: ""; position: absolute; left: -4px; top: 8px; width: 7px; height: 7px;
			border-radius: 50%; background: var(--muted); border: 1px solid var(--bg);
		}
		.vertical-timeline-item.running::before {
			background: var(--accent); box-shadow: 0 0 6px var(--accent);
		}
		.vertical-timeline-item.completed::before { background: var(--success); }
		.vertical-timeline-item.failed::before { background: var(--error); }

		/* Command Event Card */
		.command-card {
			margin-top: 4px; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 6px; padding: 8px 10px; font-family: var(--font-mono); font-size: 0.8em;
			display: flex; flex-direction: column; gap: 4px;
		}
		.command-card-header { display: flex; justify-content: space-between; align-items: center; color: var(--muted); }
		.command-card-cwd { color: var(--accent); font-weight: 600; }
		.command-card-cmd { color: #fff; font-weight: 600; background: rgba(255, 255, 255, 0.04); padding: 4px 6px; border-radius: 4px; word-break: break-all; }
		.command-card-stream { color: #34d399; white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.4); padding: 6px; border-radius: 4px; margin-top: 4px; }
		.command-card-stderr { color: var(--error); white-space: pre-wrap; word-break: break-all; max-height: 100px; overflow-y: auto; background: rgba(244,63,94,0.08); padding: 6px; border-radius: 4px; margin-top: 4px; }

		/* Callouts / Alerts */
		.markdown-body blockquote.alert-note { border-left-color: #38bdf8; background: rgba(56, 189, 248, 0.06); }
		.markdown-body blockquote.alert-warning { border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.06); }
		.markdown-body blockquote.alert-tip { border-left-color: #10b981; background: rgba(16, 185, 129, 0.06); }

		/* Thinking Animation & Streaming UX */
		.thinking-banner-animated {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 14px;
			border-radius: var(--radius);
			background: linear-gradient(135deg, rgba(139, 92, 246, 0.09) 0%, rgba(34, 211, 238, 0.04) 100%);
			border: 1px solid rgba(139, 92, 246, 0.22);
			margin-bottom: 8px;
			transition: opacity 0.3s ease, transform 0.3s ease;
			box-shadow: 0 2px 14px rgba(124, 58, 237, 0.1);
		}
		.streaming-cursor {
			display: inline-block;
			width: 7px;
			height: 1.15em;
			vertical-align: text-bottom;
			background: var(--accent);
			margin-left: 3px;
			border-radius: 1px;
			box-shadow: 0 0 8px var(--accent);
			animation: cursorPulse 0.8s ease-in-out infinite alternate;
		}
		@keyframes cursorPulse {
			from { opacity: 0.25; transform: scaleY(0.9); }
			to { opacity: 1; transform: scaleY(1.05); }
		}
		.streaming-cursor.fade-out {
			animation: cursorFadeOut 0.4s ease forwards;
		}
		@keyframes cursorFadeOut {
			to { opacity: 0; transform: scale(0.5); }
		}
		.step-slide-in {
			animation: stepSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
		}
		@keyframes stepSlideIn {
			from { opacity: 0; transform: translateY(6px); }
			to { opacity: 1; transform: translateY(0); }
		}
		.command-output-stream {
			font-family: var(--font-mono);
			font-size: 0.8em;
			background: rgba(0, 0, 0, 0.45);
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 4px;
			padding: 6px 10px;
			margin-top: 4px;
			max-height: 140px;
			overflow-y: auto;
			color: #34d399;
			white-space: pre-wrap;
			word-break: break-all;
			line-height: 1.4;
		}
		/* ChatGPT-o3 / Codex style thinking & reasoning animations */
		.thinking-container {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 6px 0;
			animation: thinkSlideIn 0.3s ease;
		}
		@keyframes thinkSlideIn {
			from { opacity: 0; transform: translateY(8px); }
			to { opacity: 1; transform: translateY(0); }
		}
		.thinking-dots {
			display: flex;
			align-items: center;
			gap: 5px;
		}
		.thinking-dot {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			background: var(--accent);
			animation: dotBounce 1.4s ease-in-out infinite;
		}
		.thinking-dot:nth-child(2) { animation-delay: 0.16s; }
		.thinking-dot:nth-child(3) { animation-delay: 0.32s; }
		@keyframes dotBounce {
			0%, 80%, 100% { transform: scale(0.55); opacity: 0.25; }
			40% { transform: scale(1); opacity: 1; }
		}
		.thinking-label {
			font-size: 0.85em;
			color: var(--muted);
			font-weight: 500;
			letter-spacing: 0.02em;
			animation: labelBreath 2.2s ease-in-out infinite;
		}
		@keyframes labelBreath {
			0%, 100% { opacity: 0.5; }
			50% { opacity: 1; }
		}
		.thinking-bar {
			height: 2px;
			background: linear-gradient(90deg,
				transparent 0%,
				var(--accent) 25%,
				rgba(139, 92, 246, 0.3) 50%,
				var(--accent) 75%,
				transparent 100%
			);
			background-size: 200% 100%;
			animation: barSlide 1.8s linear infinite;
			border-radius: 2px;
			margin-bottom: 8px;
		}
		@keyframes barSlide {
			0% { background-position: 200% 0; }
			100% { background-position: -200% 0; }
		}
		/* Live reasoning streaming — glowing left border + animated header */
		.reasoning-live {
			border-left: 2px solid var(--accent);
			padding-left: 12px;
			animation: reasoningBorderGlow 2s ease-in-out infinite;
		}
		@keyframes reasoningBorderGlow {
			0%, 100% { border-left-color: var(--accent); }
			50% { border-left-color: rgba(139, 92, 246, 0.25); }
		}
		.reasoning-live .reasoning-header svg {
			animation: reasoningIconPulse 2s ease-in-out infinite;
		}
		@keyframes reasoningIconPulse {
			0%, 100% { opacity: 0.5; }
			50% { opacity: 1; }
		}

		@media (prefers-reduced-motion: reduce) {
			.streaming-cursor {
				animation: none !important;
				opacity: 0.9 !important;
			}
			.step-slide-in {
				animation: none !important;
				opacity: 1 !important;
				transform: none !important;
			}
			.thinking-banner-animated {
				box-shadow: none !important;
				transition: none !important;
			}
			.thinking-dot {
				animation: none !important;
				opacity: 0.6 !important;
			}
			.thinking-label {
				animation: none !important;
				opacity: 0.8 !important;
			}
			.thinking-bar {
				animation: none !important;
				background: var(--accent) !important;
				opacity: 0.3 !important;
			}
			.reasoning-live {
				animation: none !important;
				border-left-color: var(--accent) !important;
			}
			.reasoning-live .reasoning-header svg {
				animation: none !important;
			}
		}

		/* =================================================================== */
		/* Task Completed Banner & Action Button (Cline-matching style) */
		/* =================================================================== */
		.task-completed-banner {
			margin-bottom: 10px;
			width: 100%;
			display: flex;
			justify-content: center;
		}
		.start-new-task-btn {
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
			color: #ffffff;
			border: 1px solid rgba(167, 139, 250, 0.4);
			border-radius: 8px;
			padding: 10px 16px;
			font-size: 0.92rem;
			font-weight: 600;
			cursor: pointer;
			box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
			transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		}
		.start-new-task-btn:hover {
			background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
			box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
			transform: translateY(-1px);
		}
		.start-new-task-btn:active {
			transform: translateY(0);
		}
		.task-completion-card {
			margin: 12px 0;
			padding: 14px;
			background: rgba(139, 92, 246, 0.06);
			border: 1px solid rgba(139, 92, 246, 0.35);
			border-radius: 10px;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}
		.completion-header {
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.completion-icon-badge {
			width: 24px;
			height: 24px;
			border-radius: 50%;
			background: rgba(16, 185, 129, 0.2);
			color: #10b981;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		}
		.completion-header-text {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.completion-title {
			font-weight: 600;
			font-size: 0.95rem;
			color: var(--fg);
		}
		.completion-subtitle {
			font-size: 0.82rem;
			color: var(--muted);
		}
		.completion-metrics {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
			gap: 8px;
			padding: 8px 0;
			border-top: 1px dashed rgba(255, 255, 255, 0.1);
			border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
		}
		.completion-metric-item {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 0.8rem;
			color: var(--muted);
		}
		.metric-value {
			font-weight: 500;
			color: var(--fg);
		}
		.completion-action-bar {
			margin-top: 4px;
		}
	</style>
</head>
<body>
	<div id="root"><div class="welcome-placeholder"><img class="welcome-icon" src="${logoUri}" alt="Logo" /><h2>Loading Zenuxs...</h2></div></div>
	<script nonce="${nonce}">
		window.logoUri = "${logoUri}";
		(function() {
			try {
				const vscode = window.vscodeApi || acquireVsCodeApi();
				window.vscodeApi = vscode;
				
			window.logStartup = function(workerId, sessionId, component, func, event, duration, status) {
				vscode.postMessage({
					type: 'webview_log',
					level: 'info',
					message: '[' + component + '] ' + func + ' — ' + (status || 'SUCCESS') + (duration && duration !== 'N/A' ? ' (' + duration + ')' : ''),
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
