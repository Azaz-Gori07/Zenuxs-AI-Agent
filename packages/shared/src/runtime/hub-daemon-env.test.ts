import { describe, expect, it } from "vitest";
import {
	ZENUXS_RUN_AS_HUB_DAEMON_ENV,
	isHubDaemonProcess,
} from "./hub-daemon-env";

describe("hub daemon environment helpers", () => {
	it("detects hub daemon mode from the shared sentinel", () => {
		expect(
			isHubDaemonProcess({
				[ZENUXS_RUN_AS_HUB_DAEMON_ENV]: "1",
			}),
		).toBe(true);
		expect(
			isHubDaemonProcess({
				[ZENUXS_RUN_AS_HUB_DAEMON_ENV]: "0",
			}),
		).toBe(false);
	});
});
