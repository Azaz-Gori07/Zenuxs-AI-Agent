import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLocale, resolveLocale, setLocale } from "./locale";

describe("locale resolution", () => {
	const originalLang = process.env.LANG;
	const originalLcAll = process.env.LC_ALL;

	beforeEach(() => setLocale("en-US"));
	afterEach(() => {
		if (originalLang === undefined) delete process.env.LANG;
		else process.env.LANG = originalLang;
		if (originalLcAll === undefined) delete process.env.LC_ALL;
		else process.env.LC_ALL = originalLcAll;
	});

	it("accepts explicit locales", () => {
		expect(resolveLocale("zh-CN")).toBe("zh-CN");
		expect(resolveLocale("en-US")).toBe("en-US");
	});

	it("derives auto from the environment", () => {
		process.env.LC_ALL = "zh_CN.UTF-8";
		expect(resolveLocale("auto")).toBe("zh-CN");
		process.env.LC_ALL = "en_US.UTF-8";
		expect(resolveLocale("auto")).toBe("en-US");
	});

	it("keeps the current locale for unknown values", () => {
		setLocale("zh-CN");
		expect(resolveLocale("fr-FR")).toBe("zh-CN");
		expect(getLocale()).toBe("zh-CN");
	});
});
