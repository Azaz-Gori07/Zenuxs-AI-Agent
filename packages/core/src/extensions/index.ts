export type { ResolveAgentPluginPathsOptions } from "./plugin/plugin-config-loader";
export {
	discoverPluginModulePaths,
	resolveAgentPluginPaths,
	resolveAndLoadAgentPlugins,
	resolvePluginConfigSearchPaths,
	resolvePluginSkillDirectoriesFromPaths,
} from "./plugin/plugin-config-loader";
export type {
	PluginInitializationFailure,
	PluginInitializationWarning,
	PluginLoadDiagnostics,
} from "./plugin/plugin-load-report";
export type { LoadAgentPluginFromPathOptions } from "./plugin/plugin-loader";
export {
	loadAgentPluginFromPath,
	loadAgentPluginsFromPaths,
	loadAgentPluginsFromPathsWithDiagnostics,
} from "./plugin/plugin-loader";

// =============================================================================
// Ported OpenCode Components - Agent System
// =============================================================================
export {
	AgentService,
	PROMPT_EXPLORE,
	PROMPT_COMPACTION,
	PROMPT_TITLE,
	PROMPT_SUMMARY,
	PROMPT_GENERATE,
	SUMMARY_TEMPLATE,
	createBuiltinAgents,
	deriveSubagentSessionPermission,
	evaluatePermission,
} from "./agents/agent-system";
export type { AgentConfigEntry } from "./agents/agent-system";

// =============================================================================
// Ported OpenCode Components - Context System
// =============================================================================
export {
	SystemContext,
	createEnvironmentSource,
	createDateSource,
	buildCompactionPrompt,
	buildSystemPrompt,
	createContextEpoch,
	estimateTokens,
	truncateToolOutput,
	isOverflow,
	usableContext,
	selectTail,
} from "./context/context-system";
export type { ContextSource, ContextGeneration, CompactionConfig, CompactionInput, OverflowConfig } from "./context/context-system";

// =============================================================================
// Mode System
// =============================================================================
export {
	MODE_BEHAVIORS,
	getModeBehavior,
	buildModeSystemPromptTag,
} from "./modes";
export type { ModeBehavior } from "./modes";

// =============================================================================
// Ported OpenCode Components - Enhanced Tool System
// =============================================================================
export {
	ToolRegistry,
	DoomLoopDetector,
	PermissionChecker,
	isExternalDirectory,
	getRelativePatterns,
	formatPermissionRequest,
} from "./tools/registry";
export type { ToolRegistration, ToolRegistrySnapshot, ToolFilterContext, ToolRegistration as ToolRegistryRegistration } from "./tools/registry";
export {
	createAllEnhancedTools,
	createEnhancedFileReadTool,
	createEnhancedWriteTool,
	createEnhancedEditorTool,
	createEnhancedGlobTool,
	createEnhancedGrepTool,
	createEnhancedShellTool,
	createWebFetchTool,
	createWebSearchTool,
	createTodoWriteTool,
	createPlanExitTool,
} from "./tools/enhanced-index";
export type { CreateAllEnhancedToolsOptions } from "./tools/enhanced-index";
export { EditFileInputSchema, WriteFileInputSchema } from "./tools/editor-enhanced";
export { ReadFileRequestSchema } from "./tools/file-read-enhanced";
export { ShellInputSchema } from "./tools/shell-enhanced";
export { WebFetchInputSchema, WebSearchInputSchema } from "./tools/web-enhanced";
export { TodoWriteInputSchema, TodoItemSchema } from "./tools/todo-enhanced";
export { GlobInputSchema, GrepInputSchema } from "./tools/glob-grep-enhanced";
export type { EditFileInput, WriteFileInput } from "./tools/editor-enhanced";
export type { ReadFileRequest } from "./tools/file-read-enhanced";
export type { ShellInput } from "./tools/shell-enhanced";
export type { WebFetchInput, WebSearchInput } from "./tools/web-enhanced";
export type { TodoWriteInput, TodoItem } from "./tools/todo-enhanced";
export type { GlobInput, GrepInput } from "./tools/glob-grep-enhanced";
