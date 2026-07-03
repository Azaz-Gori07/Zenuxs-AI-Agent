import { describe, expect, it, vi } from "vitest";
import { wrapFetchWithRetry } from "./http";
import type { BasicLogger } from "@cline/shared";

describe("wrapFetchWithRetry", () => {
	it("should return the response directly on 200 OK", async () => {
		const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
		const retryingFetch = wrapFetchWithRetry(mockFetch as unknown as typeof fetch);

		const response = await retryingFetch("https://api.example.com/v1/chat");
		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("should retry on 429 status code and succeed when API becomes available", async () => {
		let callCount = 0;
		const mockFetch = vi.fn().mockImplementation(async () => {
			callCount++;
			if (callCount < 3) {
				return new Response("Too Many Requests", {
					status: 429,
					headers: { "retry-after-ms": "1" },
				});
			}
			return new Response("Success", { status: 200 });
		});

		const logger: BasicLogger = {
			log: vi.fn(),
			error: vi.fn(),
		};

		const retryingFetch = wrapFetchWithRetry(mockFetch as unknown as typeof fetch, logger, 5);
		const response = await retryingFetch("https://api.example.com/v1/chat");

		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(logger.log).toHaveBeenCalledTimes(2);
		expect(logger.log).toHaveBeenCalledWith(
			expect.stringContaining("[Rate Limited] Request to https://api.example.com/v1/chat failed"),
			expect.any(Object)
		);
	});

	it("should respect retry-after header in seconds", async () => {
		let callCount = 0;
		const mockFetch = vi.fn().mockImplementation(async () => {
			callCount++;
			if (callCount === 1) {
				return new Response("Too Many Requests", {
					status: 429,
					headers: { "retry-after": "0.001" }, // 1ms
				});
			}
			return new Response("Success", { status: 200 });
		});

		const retryingFetch = wrapFetchWithRetry(mockFetch as unknown as typeof fetch, undefined, 2);
		const response = await retryingFetch("https://api.example.com/v1/chat");

		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it("should fail after maximum retries are exhausted", async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response("Too Many Requests", {
				status: 429,
				headers: { "retry-after-ms": "1" },
			})
		);

		const retryingFetch = wrapFetchWithRetry(mockFetch as unknown as typeof fetch, undefined, 2);
		const response = await retryingFetch("https://api.example.com/v1/chat");

		expect(response.status).toBe(429);
		expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial call + 2 retries
	});

	it("should not retry on non-retryable 4xx errors", async () => {
		const mockFetch = vi.fn().mockResolvedValue(new Response("Bad Request", { status: 400 }));
		const retryingFetch = wrapFetchWithRetry(mockFetch as unknown as typeof fetch, undefined, 3);
		const response = await retryingFetch("https://api.example.com/v1/chat");

		expect(response.status).toBe(400);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("should retry on network errors", async () => {
		let callCount = 0;
		const mockFetch = vi.fn().mockImplementation(async () => {
			callCount++;
			if (callCount < 3) {
				throw new Error("Network connection closed");
			}
			return new Response("Success", { status: 200 });
		});

		const logger: BasicLogger = {
			log: vi.fn(),
			error: vi.fn(),
		};

		const retryingFetch = wrapFetchWithRetry(mockFetch as unknown as typeof fetch, logger, 3);
		const response = await retryingFetch("https://api.example.com/v1/chat");

		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(logger.log).toHaveBeenCalledTimes(2);
		expect(logger.log).toHaveBeenCalledWith(
			expect.stringContaining("[Network/Timeout Error] Request to https://api.example.com/v1/chat failed"),
			expect.any(Object)
		);
	});

	it("should retry on request timeout", async () => {
		let callCount = 0;
		const mockFetch = vi.fn().mockImplementation(async (url: any, initOpts: any) => {
			callCount++;
			if (callCount === 1) {
				await new Promise((resolve, reject) => {
					const timeout = setTimeout(() => {
						initOpts?.signal?.removeEventListener("abort", onAbort);
						resolve(null);
					}, 50);
					const onAbort = () => {
						clearTimeout(timeout);
						reject(initOpts?.signal?.reason ?? new DOMException("The user aborted a request.", "AbortError"));
					};
					initOpts?.signal?.addEventListener("abort", onAbort);
				});
			}
			return new Response("Success", { status: 200 });
		});

		const logger: BasicLogger = {
			log: vi.fn(),
			error: vi.fn(),
		};

		const retryingFetch = wrapFetchWithRetry(mockFetch as unknown as typeof fetch, logger, 3, 10);
		const response = await retryingFetch("https://api.example.com/v1/chat");

		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(logger.log).toHaveBeenCalledWith(
			expect.stringContaining("[Network/Timeout Error] Request to https://api.example.com/v1/chat failed: Upstream idle timeout exceeded"),
			expect.any(Object)
		);
	});
});
