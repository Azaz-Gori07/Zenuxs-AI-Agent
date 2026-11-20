export type CliLocale = "en-US" | "zh-CN";

let currentLocale: CliLocale = "en-US";

/** Resolve `--locale`; `auto` follows LANG/LC_ALL and defaults to en-US. */
export function resolveLocale(value?: string): CliLocale {
	if (value === "en-US" || value === "zh-CN") {
		return value;
	}
	if (value === "auto") {
		const envLocale =
			process.env.LC_ALL ?? process.env.LANG ?? process.env.LC_MESSAGES ?? "";
		return /^zh([_-]|$)/i.test(envLocale) ? "zh-CN" : "en-US";
	}
	return currentLocale;
}

export function setLocale(value?: string): void {
	currentLocale = resolveLocale(value);
}

export function getLocale(): CliLocale {
	return currentLocale;
}

export * as Locale from "./locale";
