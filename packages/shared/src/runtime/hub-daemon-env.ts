export const ZENUXS_RUN_AS_HUB_DAEMON_ENV = "ZENUXS_RUN_AS_HUB_DAEMON";

export function isHubDaemonProcess(
	env: Record<string, string | undefined> = process.env,
): boolean {
	return env[ZENUXS_RUN_AS_HUB_DAEMON_ENV] === "1";
}
