import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { AgentTool, SystemPart } from "@cline/shared";
import type { SkillConfig } from "../extensions/config";

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx", ".mdown"]);

export interface LoadedSkill {
	id: string;
	name: string;
	description: string;
	filePath: string;
	instructions: string;
	frontmatter: Record<string, unknown>;
	enabled: boolean;
	source: "global" | "workspace" | "worktree" | "external";
}

export interface SkillComposition {
	prompts: SystemPart[];
	tools: AgentTool[];
	hooks: {
		beforeTool?: (toolName: string, input: unknown) => Promise<void>;
		afterTool?: (toolName: string, result: unknown) => Promise<void>;
	};
}

export class SkillsRuntime {
	private skills: Map<string, LoadedSkill> = new Map();
	private searchPaths: string[] = [];

	constructor(searchPaths?: string[]) {
		if (searchPaths) {
			this.searchPaths = searchPaths;
		}
	}

	addSearchPath(path: string): void {
		if (!this.searchPaths.includes(path)) {
			this.searchPaths.push(path);
		}
	}

	async discover(): Promise<LoadedSkill[]> {
		const discovered: LoadedSkill[] = [];

		for (const searchPath of this.searchPaths) {
			if (!existsSync(searchPath)) continue;
			const files = await this.findSkillFiles(searchPath);
			for (const filePath of files) {
				const skill = await this.loadSkill(filePath);
				if (skill) {
					discovered.push(skill);
				}
			}
		}

		// Update internal map
		for (const skill of discovered) {
			this.skills.set(skill.id, skill);
		}

		return discovered;
	}

	load(skill: LoadedSkill): void {
		this.skills.set(skill.id, skill);
	}

	unload(skillId: string): boolean {
		return this.skills.delete(skillId);
	}

	get(skillId: string): LoadedSkill | undefined {
		return this.skills.get(skillId);
	}

	list(): LoadedSkill[] {
		return [...this.skills.values()];
	}

	getEnabled(): LoadedSkill[] {
		return this.list().filter((s) => s.enabled);
	}

	async loadSkill(filePath: string): Promise<LoadedSkill | undefined> {
		try {
			const content = await readFile(filePath, "utf-8");
			const config = this.parseSkillConfig(content, filePath);
			if (!config) return undefined;

			return {
				id: config.name.toLowerCase().replace(/\s+/g, "-"),
				name: config.name,
				description: config.description ?? "",
				filePath,
				instructions: config.instructions,
				frontmatter: config.frontmatter,
				enabled: config.disabled !== true,
				source: this.resolveSource(filePath),
			};
		} catch {
			return undefined;
		}
	}

	composeSystemParts(): SystemPart[] {
		const parts: SystemPart[] = [];
		for (const skill of this.getEnabled()) {
			if (!skill.instructions.trim()) continue;
			parts.push({
				type: "text",
				text: `[SKILL: ${skill.name}]\n${skill.instructions.trim()}\n[/SKILL]`,
				cache: "ephemeral" as const,
				metadata: { skillId: skill.id, skillName: skill.name },
			});
		}
		return parts;
	}

	composeSystemPrompt(): string {
		const parts = this.composeSystemParts();
		if (parts.length === 0) return "";
		return parts.map((p) => p.text).join("\n\n");
	}

	private async findSkillFiles(dirPath: string): Promise<string[]> {
		const files: string[] = [];
		try {
			const entries = await readdir(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.name.startsWith(".")) continue;
				const fullPath = join(dirPath, entry.name);
				if (entry.isDirectory()) {
					const nested = await this.findSkillFiles(fullPath);
					files.push(...nested);
				} else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(extname(entry.name))) {
					files.push(fullPath);
				}
			}
		} catch {
			// Directory not accessible
		}
		return files;
	}

	private parseSkillConfig(
		content: string,
		filePath: string,
	): SkillConfig | undefined {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
		const frontmatter: Record<string, unknown> = {};
		let body = content;

		if (frontmatterMatch) {
			const yaml = frontmatterMatch[1];
			for (const line of yaml.split("\n")) {
				const colonIdx = line.indexOf(":");
				if (colonIdx > 0) {
					const key = line.slice(0, colonIdx).trim();
					const value = line.slice(colonIdx + 1).trim();
					if (value === "true") frontmatter[key] = true;
					else if (value === "false") frontmatter[key] = false;
					else frontmatter[key] = value.replace(/^["']|["']$/g, "");
				}
			}
			body = content.slice(frontmatterMatch[0].length).trim();
		}

		const name =
			(frontmatter.name as string) ||
			(frontmatter.title as string) ||
			this.fileNameToName(filePath);

		return {
			name,
			description: (frontmatter.description as string) || undefined,
			disabled: frontmatter.disabled === true || frontmatter.enabled === false,
			instructions: body || name,
			frontmatter,
		};
	}

	private fileNameToName(filePath: string): string {
		const basename = filePath.split(/[\\/]/).pop() ?? "unknown";
		return basename.replace(extname(basename), "").replace(/[-_]/g, " ");
	}

	private resolveSource(filePath: string): LoadedSkill["source"] {
		const normalized = resolve(filePath).toLowerCase();
		for (const searchPath of this.searchPaths) {
			const resolved = resolve(searchPath).toLowerCase();
			if (normalized.startsWith(resolved)) {
				if (searchPath.includes("worktree")) return "worktree";
				if (searchPath.includes("workspace") || searchPath.includes(".zenuxs")) return "workspace";
				return "global";
			}
		}
		return "external";
	}
}

export function createSkillsRuntime(searchPaths?: string[]): SkillsRuntime {
	return new SkillsRuntime(searchPaths);
}
