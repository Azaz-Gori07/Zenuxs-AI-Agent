import { describe, expect, it } from "vitest";
import {
	ClineNotSubscribedError,
	getClineNotSubscribedMessage,
	isClineNotSubscribedMessage,
} from "./errors";
import { extractErrorMessage } from "./format";

describe("extractErrorMessage", () => {
	it("extracts structured provider errors without fallback branches", () => {
		expect(
			extractErrorMessage({
				statusCode: 400,
				responseBody: {
					error: {
						message: "Bad request detail",
					},
				},
				message: "Bad Request",
			}),
		).toBe("Bad request detail");

		expect(
			extractErrorMessage({
				cause: new Error("Nested failure"),
			}),
		).toBe("Nested failure");

		expect(extractErrorMessage(new Error("Plain failure"))).toBe(
			"Plain failure",
		);
	});

	it("prefers nested stream error details over generic wrapper messages", () => {
		expect(
			extractErrorMessage({
				message: "Stream error occurred",
				errors: [
					{
						responseBody: JSON.stringify({
							error: { message: "Missing upstream API key" },
						}),
					},
				],
			}),
		).toBe("Missing upstream API key");
	});

	it("prefers OpenRouter raw metadata over generic provider errors", () => {
		expect(
			extractErrorMessage({
				statusCode: 429,
				responseBody: JSON.stringify({
					error: {
						message: "Provider returned error",
						metadata: {
							provider_name: "Google AI Studio",
							raw: "Gemini requires thought_signature on function calls",
						},
					},
				}),
			}),
		).toBe(
			"Google AI Studio: Gemini requires thought_signature on function calls",
		);

		expect(
			extractErrorMessage({
				responseBody: {
					error: "Provider returned error",
					metadata: {
						raw: "The upstream provider is temporarily rate-limited",
					},
				},
			}),
		).toBe("The upstream provider is temporarily rate-limited");
	});
});

describe("ClineNotSubscribedError", () => {
	it("uses the user-facing subscription message", () => {
		expect(new ClineNotSubscribedError("cline-pass").message).toBe(
			getClineNotSubscribedMessage(),
		);
	});

	it("detects the ClinePass required-plan message", () => {
		expect(
			isClineNotSubscribedMessage(
				JSON.stringify({
					error: {
						message: "the user is not subscribed to required model plan",
					},
				}),
			),
		).toBe(true);
		expect(isClineNotSubscribedMessage("different forbidden error")).toBe(
			false,
		);
	});
});
