import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"
import { boundToolOutput } from "../tool/output-bound"

export interface SkillManifest {
  name: string
  description: string
  location?: string
  instructions?: string
}

export const definition: ToolDefinition = {
  id: "skill",
  description: "Load and inject a specialized skill's instructions and resources into the current conversation. Skills provide structured guidance for specific tasks.",
  parameters: [
    { name: "name", description: "The name of the skill to load", required: true, schema: { type: "string" } },
    { name: "skillsDir", description: "Override the default skills directory", required: false, schema: { type: "string" } },
  ],
  readOnly: true,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { name, skillsDir } = args as { name: string; skillsDir?: string }
    try {
      const baseDir = skillsDir ?? ctx.skillsDir ?? ""
      const fs = await import("node:fs/promises")
      const path_mod = await import("node:path")
      const skillPath = path_mod.join(baseDir, name, "SKILL.md")
      const manifestPath = path_mod.join(baseDir, name, "manifest.json")

      let manifest: SkillManifest = { name, description: "" }
      try {
        const manifestContent = await fs.readFile(manifestPath, "utf-8")
        manifest = JSON.parse(manifestContent)
      } catch {}

      let instructions = ""
      try {
        instructions = await fs.readFile(skillPath, "utf-8")
      } catch {
        instructions = `# ${name}\nNo SKILL.md found at ${skillPath}`
      }

      const lines = instructions.split("\n").length
      const charCount = instructions.length

      return boundToolOutput({
        title: `Loaded skill: ${name}`,
        output: instructions,
        metadata: {
          name: manifest.name || name,
          description: manifest.description,
          skillPath,
          lines,
          charCount,
        },
      })
    } catch (err) {
      return {
        title: `Skill error: ${name}`,
        output: `Failed to load skill "${name}": ${(err as Error).message}`,
        metadata: { name, error: true },
        error: (err as Error).message,
      }
    }
  },
}

export * as Skill from "."
