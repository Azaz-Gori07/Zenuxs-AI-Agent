function normalizeShellName(shell: string): string {
	const normalizedPath = shell.replaceAll("\\", "/");
	const lastSeparatorIndex = normalizedPath.lastIndexOf("/");
	const baseName =
		lastSeparatorIndex >= 0
			? normalizedPath.slice(lastSeparatorIndex + 1)
			: normalizedPath;
	return baseName.toLowerCase();
}

export function getDefaultShell(platform: string): string {
	return platform === "win32" ? "powershell" : "/bin/bash";
}

export function preparePowerShellCommand(command: string): string {
	let cmd = command.trim();
	// Normalize common Unix aliases/flags that fail natively in PowerShell
	cmd = cmd.replace(/\bls\s+-(?:la|al|l|a|lh|F)\b/gi, "Get-ChildItem -Force");
	cmd = cmd.replace(/\bls\s+-(?:R|r)\b/gi, "Get-ChildItem -Recurse -Force");
	cmd = cmd.replace(/\brm\s+-rf?\b/gi, "Remove-Item -Recurse -Force");
	cmd = cmd.replace(/\brm\s+-f\b/gi, "Remove-Item -Force");
	cmd = cmd.replace(/\bmkdir\s+-p\b/gi, "New-Item -ItemType Directory -Force -Path");
	cmd = cmd.replace(/\btouch\b/gi, "New-Item -ItemType File -Force -Path");
	cmd = cmd.replace(/\bwhich\b/gi, "Get-Command");
	return cmd;
}

export function getShellArgs(shell: string, command: string): string[] {
	const shellName = normalizeShellName(shell);

	if (
		shellName === "powershell" ||
		shellName === "powershell.exe" ||
		shellName === "pwsh" ||
		shellName === "pwsh.exe"
	) {
		return ["-NoProfile", "-NonInteractive", "-Command", preparePowerShellCommand(command)];
	}

	if (shellName === "cmd" || shellName === "cmd.exe") {
		return ["/d", "/s", "/c", command];
	}

	return ["-c", command];
}
