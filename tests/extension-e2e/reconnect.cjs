// L3 evidence: the extension reconnects after its core is killed/disposed.
// The core is in-process, so "kill" uses the extension's own dispose path
// (new_session -> resetCore -> coreBridge.dispose) and we observe a fresh
// "Extension core runtime initialized" followed by a successful turn.
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const fs = require("fs");
const path = require("path");

const PORT = process.env.ZENUXS_CDP_PORT || "9242";
const OUT =
	process.env.ZENUXS_EXT_E2E_OUT_DIR ||
	path.join(__dirname, "../../docs/evidence/F-ext");
const root = path.join(__dirname, "../..");
const READY = process.env.ZENUXS_READY_FILE || "/tmp/zenuxs-ext-ready";
const RESULT = path.join(OUT, "reconnect.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const result = {
		sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
			.toString()
			.trim(),
		timestamp: new Date().toISOString(),
		checks: [],
		phases: {},
		error: null,
	};
	const add = (name, ok, detail) =>
		result.checks.push({ name, ok: Boolean(ok), detail: detail ?? null });

	let browser;
	let frame;
	try {
		for (let i = 0; i < 120 && !fs.existsSync(READY); i += 1) await sleep(1000);
		if (!fs.existsSync(READY)) throw new Error("extension host never became ready");
		result.ready = JSON.parse(fs.readFileSync(READY, "utf8"));

		browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
		const page = browser.contexts().flatMap((c) => c.pages())[0];
		if (!page) throw new Error("no page available over CDP");

		const opened = await page.evaluate(() => {
			const el = [...document.querySelectorAll("a")].find((e) =>
				/activity-workbench-view-extension-zenuxs/.test(
					(e.className || "").toString(),
				),
			);
			if (!el) return false;
			el.click();
			return true;
		});
		add("open chat view", opened);
		await sleep(4000);

		async function findFrame(predicate, timeoutMs = 30000) {
			const start = Date.now();
			while (Date.now() - start < timeoutMs) {
				for (const frame of page.frames()) {
					try {
						const text = await frame.evaluate(() =>
							document.body ? document.body.innerText.slice(0, 800) : "",
						);
						if (predicate(text)) return frame;
					} catch {
						/* frame navigating */
					}
				}
				await sleep(500);
			}
			return null;
		}

		frame = await findFrame((t) => t.includes("Sign in to Zenuxs"), 30000);
		if (frame) {
			await frame.getByText(/Continue without Login/i).first().dispatchEvent("click");
			await sleep(2000);
		}
		frame = await findFrame((t) => t.includes("CONTEXT WINDOW"), 30000);
		add("chat webview mounted", !!frame);
		if (!frame) throw new Error("chat webview not found");

		// Tap the webview message bus (ExtensionStateContext.tsx posts "ready"
		// and extension messages arrive via window.addEventListener("message")).
		await frame.evaluate(() => {
			window.__zm = [];
			window.addEventListener("message", (event) => {
				const data = event.data || {};
				window.__zm.push({
					t: data.type,
					text: typeof data.text === "string" ? data.text : undefined,
					sessionId: data.sessionId,
				});
			});
		});

		const messages = () => frame.evaluate(() => window.__zm.slice());
		const initCount = async () =>
			(await messages()).filter(
				(m) =>
					m.t === "logs_stream" &&
					/Extension core runtime initialized/.test(m.text || ""),
			).length;
		const countType = async (type, since = 0) =>
			(await messages()).slice(since).filter((m) => m.t === type).length;

		async function waitFor(predicate, label, timeoutMs = 60000) {
			const start = Date.now();
			while (Date.now() - start < timeoutMs) {
				if (await predicate()) return true;
				await sleep(500);
			}
			throw new Error(`timeout waiting for ${label}`);
		}

		async function sendPrompt(text) {
			const input = frame.locator("#prompt-textarea").first();
			await input.fill(text);
			await frame
				.locator('button[title="Send (Enter)"]')
				.first()
				.dispatchEvent("click", { timeout: 5000 });
		}

		// Phase 1: baseline connection (the core was created on webview mount,
		// before the message tap, so only the turn is asserted here).
		await sendPrompt("Reconnect baseline");
		await waitFor(
			async () => (await countType("turn_done")) > 0,
			"baseline turn_done",
		);
		const baselineSessions = (await messages())
			.filter((m) => m.t === "session_started")
			.map((m) => m.sessionId);
		result.phases.baseline = {
			sessionIds: baselineSessions,
			turnDone: await countType("turn_done"),
		};
		add("baseline turn completed", (await countType("turn_done")) > 0);

		// Kill the core via the extension's disposal path.
		const resetSlot = (await messages()).length;
		await frame.evaluate(() =>
			window.vscodeApi.postMessage({ type: "new_session" }),
		);
		await waitFor(
			async () => (await countType("reset_done", resetSlot)) > 0,
			"reset_done after core dispose",
		);
		add("core disposed (reset_done)", (await countType("reset_done", resetSlot)) > 0);
		result.phases.afterKill = {
			resetDone: await countType("reset_done", resetSlot),
			coreInstancesDisposed: true,
		};

		// Phase 2: reconnect. Posting `ready` after disposal forces getCore()
		// to rebuild the in-process core; the init log proves a fresh instance.
		const reconnectSlot = (await messages()).length;
		const beforeReconnectInit = await initCount();
		await frame.evaluate(() => window.vscodeApi.postMessage({ type: "ready" }));
		await waitFor(
			async () => (await initCount()) > beforeReconnectInit,
			"core re-initialized after dispose",
			45000,
		);
		add(
			"core re-initialized after kill",
			(await initCount()) > beforeReconnectInit,
			`init count ${beforeReconnectInit} -> ${await initCount()}`,
		);

		const turnSlot = (await messages()).length;
		await sendPrompt("Reconnect after core kill");
		await waitFor(
			async () =>
				(await countType("session_started", turnSlot)) > 0 &&
				(await countType("turn_done", turnSlot)) > 0,
			"session_started + turn_done after kill",
		);
		const reconnectedSessions = (await messages())
			.slice(turnSlot)
			.filter((m) => m.t === "session_started")
			.map((m) => m.sessionId);
		result.phases.reconnected = {
			sessionIds: reconnectedSessions,
			turnDone: await countType("turn_done", turnSlot),
		};
		add("turn completed after reconnect", (await countType("turn_done", turnSlot)) > 0);
		add(
			"fresh session after reconnect",
			reconnectedSessions.some(
				(id) => id && !baselineSessions.includes(id),
			),
			reconnectedSessions.join(","),
		);

		const state = await fetch(`http://127.0.0.1:4317/__state`).then((r) => r.json());
		result.fakeProviderState = state;
		add("fake provider served both phases", state.turn >= 2, state);
		result.transcript = (await messages()).slice(-40);
	} catch (error) {
		result.error = String((error && error.stack) || error);
	} finally {
		if (frame) {
			try {
				result.transcript = await frame.evaluate(() => window.__zm.slice(-60));
				result.webviewText = await frame.evaluate(() =>
					document.body ? document.body.innerText.slice(0, 1500) : "",
				);
			} catch {
				/* frame already gone */
			}
		}
		fs.writeFileSync(RESULT, JSON.stringify(result, null, 2));
		const ok =
			!result.error && result.checks.length > 0 && result.checks.every((c) => c.ok);
		console.log(
			JSON.stringify(
				{
					ok,
					passed: result.checks.filter((c) => c.ok).length,
					total: result.checks.length,
					error: result.error,
				},
				null,
				2,
			),
		);
		if (browser) await browser.close();
		if (!ok) process.exitCode = 1;
	}
})();
