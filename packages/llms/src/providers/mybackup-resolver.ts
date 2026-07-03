const ENV_KEYS = ["MYBACKUP_KEY_1", "MYBACKUP_KEY_2", "MYBACKUP_KEY_3"] as const;
const REQUESTS_PER_KEY = 1;

function readKeys(): string[] {
	return ENV_KEYS
		.map((k) => process.env[k]?.trim())
		.filter((k): k is string => !!k);
}

export function createMyBackupKeyResolver(): () => string | undefined {
	let keys: string[] | undefined;
	let counter = 0;

	return () => {
		if (keys === undefined) {
			keys = readKeys();
		}
		if (keys.length === 0) return undefined;
		const idx = Math.floor(counter / REQUESTS_PER_KEY) % keys.length;
		counter++;
		return keys[idx];
	};
}
