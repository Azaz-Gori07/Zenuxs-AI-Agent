export function extractErrorMessage(error: unknown): string {
	const GENERIC_PROVIDER_MESSAGES = new Set([
		"provider returned error",
		"upstream provider error",
		"provider error",
	]);

	const isGenericProviderMessage = (value: string): boolean =>
		GENERIC_PROVIDER_MESSAGES.has(value.trim().toLowerCase());

	const extractStructuredMessage = (value: unknown): string | undefined => {
		if (!value) {
			return undefined;
		}
		if (typeof value === "string") {
			try {
				return extractStructuredMessage(JSON.parse(value));
			} catch {
				return value.trim() || undefined;
			}
		}
		if (typeof value !== "object") {
			return undefined;
		}
		const payload = value as {
			error?:
				| {
						message?: string;
						metadata?: unknown;
						provider_name?: string;
						providerName?: string;
				  }
				| string;
			errors?: unknown;
			detail?: string;
			metadata?: unknown;
			message?: string;
			responseBody?: unknown;
			cause?: unknown;
		};
		const extractMetadataMessage = (metadata: unknown): string | undefined => {
			if (!metadata || typeof metadata !== "object") {
				return undefined;
			}
			const record = metadata as Record<string, unknown>;
			const raw =
				typeof record.raw === "string" && record.raw.trim()
					? record.raw.trim()
					: undefined;
			const providerName =
				typeof record.provider_name === "string" && record.provider_name.trim()
					? record.provider_name.trim()
					: typeof record.providerName === "string" &&
						  record.providerName.trim()
						? record.providerName.trim()
						: undefined;
			const nested =
				extractStructuredMessage(record.error) ??
				extractStructuredMessage(record.responseBody) ??
				extractStructuredMessage(record.cause);
			const detail = raw ?? nested;
			if (!detail) {
				return undefined;
			}
			return providerName ? `${providerName}: ${detail}` : detail;
		};
		if (typeof payload.error === "string" && payload.error.trim()) {
			const errorMessage = payload.error.trim();
			const metadataMessage = extractMetadataMessage(payload.metadata);
			if (metadataMessage && isGenericProviderMessage(errorMessage)) {
				return metadataMessage;
			}
			return errorMessage;
		}
		if (payload.error && typeof payload.error === "object") {
			const errorMessage =
				typeof payload.error.message === "string" &&
				payload.error.message.trim()
					? payload.error.message.trim()
					: undefined;
			const metadataMessage = extractMetadataMessage(payload.error.metadata);
			if (
				metadataMessage &&
				(!errorMessage || isGenericProviderMessage(errorMessage))
			) {
				return metadataMessage;
			}
			if (errorMessage) {
				return errorMessage;
			}
		}
		if (typeof payload.detail === "string" && payload.detail.trim()) {
			return payload.detail;
		}
		const metadataMessage = extractMetadataMessage(payload.metadata);
		if (
			metadataMessage &&
			(!payload.message || isGenericProviderMessage(payload.message))
		) {
			return metadataMessage;
		}
		if (Array.isArray(payload.errors)) {
			for (const error of payload.errors) {
				const nested = extractStructuredMessage(error);
				if (nested) {
					return nested;
				}
			}
		}
		if ("responseBody" in payload && payload.responseBody !== value) {
			const nested = extractStructuredMessage(payload.responseBody);
			if (nested) {
				return nested;
			}
		}
		if ("cause" in payload && payload.cause !== value) {
			const nested = extractStructuredMessage(payload.cause);
			if (nested) {
				return nested;
			}
		}
		if (typeof payload.message === "string" && payload.message.trim()) {
			return payload.message;
		}
		return undefined;
	};

	const structuredMessage = extractStructuredMessage(error);
	if (structuredMessage) {
		return structuredMessage;
	}

	return String(error);
}
