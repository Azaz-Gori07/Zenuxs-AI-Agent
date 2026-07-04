import { AgentRuntimeAbortError } from "@cline/agents";
import { initVcr, resolveZenuxsBuildEnv } from "@cline/shared";
import { createLocalHubScheduleRuntimeHandlers } from "../daemon/runtime-handlers";
import { resolveHubEndpointOptions } from "../discovery/defaults";
import {
	resolveProductionHubOwnerContext,
	resolveSharedHubOwnerContext,
} from "../discovery/workspace";
import { startHubWebSocketServer } from "../server";

initVcr(process.env.CLINE_VCR);

function parseArgs(argv: string[]): {
	cwd: string;
	host?: string;
	port?: number;
	pathname?: string;
} {
	let cwd = process.cwd();
	let host: string | undefined;
	let port: number | undefined;
	let pathname: string | undefined;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const value = argv[index + 1];
		if (arg === "--cwd" && value) {
			cwd = value;
			index += 1;
			continue;
		}
		if (arg === "--host" && value) {
			host = value;
			index += 1;
			continue;
		}
		if (arg === "--port" && value) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				port = parsed;
			}
			index += 1;
			continue;
		}
		if (arg === "--pathname" && value) {
			pathname = value;
			index += 1;
		}
	}

	return { cwd, host, port, pathname };
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	process.chdir(options.cwd);

	// Load workspace .env if present
	try {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const dotenvPath = path.join(options.cwd, ".env");
		if (fs.existsSync(dotenvPath)) {
			const content = fs.readFileSync(dotenvPath, "utf8");
			for (const line of content.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) {
					continue;
				}
				const equalIndex = trimmed.indexOf("=");
				if (equalIndex === -1) {
					continue;
				}
				const rawKey = trimmed.slice(0, equalIndex).trim();
				const rawValue = trimmed.slice(equalIndex + 1).trim();
				const key = rawKey.startsWith("export ") ? rawKey.slice(7).trim() : rawKey;
				let value = rawValue;
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				if (key) {
					process.env[key] = value;
				}
			}
		}
	} catch (e) {
		process.stderr.write(`[hub-daemon] failed to load .env: ${e}\n`);
	}

	const endpoint = resolveHubEndpointOptions({
		host: options.host,
		port: options.port,
		pathname: options.pathname,
	});

	const server = await startHubWebSocketServer({
		host: endpoint.host,
		port: endpoint.port,
		pathname: endpoint.pathname,
		owner:
			resolveZenuxsBuildEnv() === "production"
				? resolveProductionHubOwnerContext()
				: resolveSharedHubOwnerContext(),
		runtimeHandlers: createLocalHubScheduleRuntimeHandlers(),
		cronOptions: { workspaceRoot: options.cwd },
	});

	const shutdown = async (): Promise<void> => {
		await server.close();
		process.exit(0);
	};

	let fatalShutdownStarted = false;
	const shutdownFatal = (label: string, error: unknown): void => {
		if (fatalShutdownStarted) {
			return;
		}
		fatalShutdownStarted = true;
		const message =
			error instanceof Error ? error.stack || error.message : String(error);
		process.stderr.write(`[hub-daemon] ${label}: ${message}\n`);
		void server
			.close()
			.catch((closeError) => {
				const closeMessage =
					closeError instanceof Error
						? closeError.stack || closeError.message
						: String(closeError);
				process.stderr.write(
					`[hub-daemon] shutdown after ${label} failed: ${closeMessage}\n`,
				);
			})
			.finally(() => {
				process.exit(1);
			});
	};

	process.on("SIGINT", () => {
		void shutdown();
	});
	process.on("SIGTERM", () => {
		void shutdown();
	});
	process.on("uncaughtException", (error) => {
		shutdownFatal("uncaughtException", error);
	});
	process.on("unhandledRejection", (reason) => {
		if (reason instanceof AgentRuntimeAbortError) {
			process.stderr.write(
				`[hub-daemon] ignored agent runtime abort rejection: ${reason.message}\n`,
			);
			return;
		}
		shutdownFatal("unhandledRejection", reason);
	});

	await new Promise<void>(() => {
		// keep daemon process alive
	});
}

void main().catch((error) => {
	const message =
		error instanceof Error ? error.stack || error.message : String(error);
	process.stderr.write(`[hub-daemon] fatal: ${message}\n`);
	process.exit(1);
});
