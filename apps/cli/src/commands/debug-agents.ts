import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { EOL } from "node:os"
import { homedir } from "node:os"
import { parse } from "yaml"

const GLOBAL_AGENTS_DIR = join(homedir(), ".cline", "agents")

export interface DebugAgentsOptions {
  directory?: string
}

export async function runDebugAgentsCommand(options: DebugAgentsOptions): Promise<number> {
  const agents = new Set<string>()
  const entries: Record<string, unknown>[] = []

  const workspaceDir = options.directory ?? process.cwd()
  const localDir = join(workspaceDir, ".cline", "agents")
  const dirs = [localDir, GLOBAL_AGENTS_DIR]

  for (const dir of dirs) {
    try {
      const files = await readdir(dir)
      for (const file of files) {
        if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue
        const name = file.replace(/\.ya?ml$/, "")
        if (agents.has(name)) continue
        agents.add(name)

        const content = await readFile(join(dir, file), "utf-8")
        const { frontmatter } = parseYamlFrontmatter(content)
        entries.push({
          name,
          description: frontmatter.description ?? "",
          mode: frontmatter.mode ?? "custom",
          hidden: false,
          native: false,
          source: dir === localDir ? "workspace" : "global",
        })
      }
    } catch {}
  }

  entries.push({
    name: "build",
    description: "Default agent. Executes tools with configured permissions.",
    mode: "coder",
    hidden: false,
    native: true,
  })
  entries.push({
    name: "plan",
    description: "Plan mode. Disallows all edit tools.",
    mode: "architect",
    hidden: false,
    native: true,
  })
  entries.push({
    name: "general",
    description: "General-purpose for research and multi-step tasks.",
    mode: "ask",
    hidden: false,
    native: true,
  })
  entries.push({
    name: "explore",
    description: "Fast codebase exploration (file search, code analysis).",
    mode: "ask",
    hidden: false,
    native: true,
  })

  entries.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  process.stdout.write(JSON.stringify(entries, null, 2) + EOL)
  return 0
}

interface YamlFrontmatter {
  frontmatter: Record<string, unknown>
  body: string
}

function parseYamlFrontmatter(content: string): YamlFrontmatter {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith("---")) return { frontmatter: {}, body: content }
  const end = trimmed.indexOf("---", 3)
  if (end === -1) return { frontmatter: {}, body: content }
  const fm = trimmed.slice(3, end)
  const body = trimmed.slice(end + 3).trim()
  try {
    return { frontmatter: parse(fm) as Record<string, unknown> ?? {}, body }
  } catch {
    return { frontmatter: {}, body }
  }
}

export * as DebugAgents from "./debug-agents"
