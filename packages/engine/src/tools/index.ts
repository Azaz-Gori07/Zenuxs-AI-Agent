import type { RegisteredTool } from "../tool/registry"
import * as ReadTool from "./read"
import * as WriteTool from "./write"
import * as EditTool from "./edit"
import * as ShellTool from "./shell"
import * as GrepTool from "./grep"
import * as GlobTool from "./glob"
import * as QuestionTool from "./question"
import * as WebFetchTool from "./webfetch"
import * as WebSearchTool from "./websearch"

export function buildCoreTools(): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    { definition: ReadTool.definition, handler: ReadTool.handler },
    { definition: WriteTool.definition, handler: WriteTool.handler },
    { definition: EditTool.definition, handler: EditTool.handler },
    { definition: ShellTool.definition, handler: ShellTool.handler },
    { definition: GrepTool.definition, handler: GrepTool.handler },
    { definition: GlobTool.definition, handler: GlobTool.handler },
    { definition: WebFetchTool.definition, handler: WebFetchTool.handler },
    { definition: WebSearchTool.definition, handler: WebSearchTool.handler },
  ]
  return tools
}

export { EDIT_STRATEGIES, findBestStrategy, type EditOperation } from "./edit-strategies"

export * as Tools from "."