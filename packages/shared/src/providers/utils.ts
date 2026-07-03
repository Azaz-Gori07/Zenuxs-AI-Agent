export function isZenuxsProvider(providerId: string): boolean {
	return (
		providerId === "cline" ||
		providerId === "cline-pass" ||
		providerId === "zenuxs"
	);
}
