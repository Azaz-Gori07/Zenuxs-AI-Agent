console.error(
	[
		"Do not publish the workspace root package.",
		"",
		"This repo root is a private monorepo package (@zenuxs/workspace).",
		"To publish the CLI for `npx zenuxs-code`, use:",
		"",
		"  bun run --cwd apps/cli build:platforms",
		"  bun run --cwd apps/cli publish:npm:dry",
		"  bun run --cwd apps/cli publish:npm",
		"",
		"From the repo root you can also run:",
		"",
		"  bun run publish:cli:dry",
		"  bun run publish:cli",
	].join("\n"),
);
process.exit(1);
