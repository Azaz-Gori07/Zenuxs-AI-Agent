import * as vscode from "vscode";

/**
 * Bridge between the VS Code extension and the Zenuxs backend server.
 * Handles API calls, health checks, and data synchronization.
 */
export class ZenuxsBackendBridge {
	private baseUrl: string;
	private connected = false;
	private disposables: vscode.Disposable[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		const config = vscode.workspace.getConfiguration("zenuxs");
		this.baseUrl = config.get<string>("backendUrl", "http://localhost:3000");

		// Watch for config changes
		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration("zenuxs.backendUrl")) {
					const newConfig = vscode.workspace.getConfiguration("zenuxs");
					this.baseUrl = newConfig.get<string>("backendUrl", "http://localhost:3000");
				}
			}),
		);
	}

	/**
	 * Returns the configured backend base URL.
	 */
	getBaseUrl(): string {
		return this.baseUrl;
	}

	/**
	 * Checks if the backend server is reachable.
	 */
	async checkConnection(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/api/health`, {
				method: "GET",
				signal: AbortSignal.timeout(3000),
			});
			this.connected = response.ok;
			return this.connected;
		} catch {
			this.connected = false;
			return false;
		}
	}

	/**
	 * Returns whether the backend is currently connected.
	 */
	isConnected(): boolean {
		return this.connected;
	}

	/**
	 * Sends a prompt to the backend and returns the streaming response.
	 */
	async sendPrompt(prompt: string, config?: Record<string, unknown>): Promise<Response | null> {
		if (!this.connected) {
			return null;
		}
		try {
			const response = await fetch(`${this.baseUrl}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt,
					config: config || {},
					workspaceRoot: this.getWorkspaceRoot(),
				}),
				signal: AbortSignal.timeout(60000),
			});
			return response;
		} catch {
			return null;
		}
	}

	/**
	 * Fetches available models from the backend.
	 */
	async fetchModels(): Promise<Record<string, string[]>> {
		try {
			const response = await fetch(`${this.baseUrl}/api/models`, {
				signal: AbortSignal.timeout(5000),
			});
			if (response.ok) {
				return await response.json();
			}
		} catch {
			// ignore
		}
		return {};
	}

	/**
	 * Fetches session history from the backend.
	 */
	async fetchSessions(): Promise<any[]> {
		try {
			const response = await fetch(`${this.baseUrl}/api/sessions`, {
				signal: AbortSignal.timeout(5000),
			});
			if (response.ok) {
				return await response.json();
			}
		} catch {
			// ignore
		}
		return [];
	}

	/**
	 * Saves a session to the backend.
	 */
	async saveSession(sessionId: string, data: any): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
				signal: AbortSignal.timeout(5000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Deletes a session from the backend.
	 */
	async deleteSession(sessionId: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
				method: "DELETE",
				signal: AbortSignal.timeout(5000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Fetches usage/dashboard data from the backend.
	 */
	async fetchUsageData(): Promise<any> {
		try {
			const response = await fetch(`${this.baseUrl}/api/usage`, {
				signal: AbortSignal.timeout(5000),
			});
			if (response.ok) {
				return await response.json();
			}
		} catch {
			// ignore
		}
		return null;
	}

	/**
	 * Gets the current workspace root path.
	 */
	private getWorkspaceRoot(): string {
		const folders = vscode.workspace.workspaceFolders;
		if (folders && folders.length > 0) {
			return folders[0].uri.fsPath;
		}
		return process.cwd();
	}

	/**
	 * Disposes all resources.
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose());
		this.disposables = [];
	}
}