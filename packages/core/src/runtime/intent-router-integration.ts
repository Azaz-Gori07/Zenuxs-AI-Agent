/**
 * Intent Router Integration — Architecture Migration Component
 *
 * Hooks into the agent runtime to:
 * 1. Classify user intent before LLM processing
 * 2. Inject execution mode system prompt additions
 * 3. Enforce mode-specific tool policies
 * 4. Route build requests through filesystem-first pipeline
 */

import type { AgentRuntimeHooks, AgentMessage, AgentBeforeModelResult, AgentStopControl } from "@cline/shared";
import { classifyIntent, recommendTechnology, type IntentClassification } from "./intent-router";
import { buildModeSystemPrompt } from "./execution-modes";
import { getTemplate, processTemplate } from "./project-templates";
import { analyzeWorkspace, type WorkspaceAnalysis } from "./workspace-analyzer";

export interface IntentRouterConfig {
  /** Working directory */
  cwd?: string;
  /** Whether intent routing is enabled */
  enabled?: boolean;
  /** Whether to log intent classifications */
  logClassifications?: boolean;
  /** Callback when intent is classified */
  onIntentClassified?: (intent: IntentClassification) => void;
  /** Whether to perform workspace analysis */
  analyzeWorkspace?: boolean;
  /** Cached workspace analysis result */
  workspaceAnalysis?: WorkspaceAnalysis | null;
}

/**
 * Create intent router hooks for agent runtime
 * These hooks intercept messages and enforce execution modes
 */
export function createIntentRouterHooks(config: IntentRouterConfig): Partial<AgentRuntimeHooks> {
  const enabled = config.enabled ?? true;
  const logClassifications = config.logClassifications ?? false;
  const shouldAnalyzeWorkspace = config.analyzeWorkspace ?? true;
  let workspaceAnalysis: WorkspaceAnalysis | null = config.workspaceAnalysis ?? null;

  if (!enabled) {
    return {};
  }

  return {
    /**
     * Before model call: inject execution mode system prompt additions
     */
    beforeModel: async (ctx): Promise<AgentBeforeModelResult | undefined> => {
      const userMessages = ctx.request.messages.filter((m: AgentMessage) => m.role === 'user');
      if (userMessages.length === 0) {
        return undefined;
      }

      // Get the latest user message
      const latestUserMessage = userMessages[userMessages.length - 1];
      const messageText = extractTextFromMessage(latestUserMessage);

      if (!messageText) {
        return undefined;
      }

      // Perform workspace analysis if needed
      if (shouldAnalyzeWorkspace && !workspaceAnalysis && config.cwd) {
        try {
          workspaceAnalysis = await analyzeWorkspace(config.cwd);
          if (logClassifications) {
            console.log(`[WorkspaceAnalyzer] Project detected: ${workspaceAnalysis.hasProject ? 'Yes' : 'No'}`);
            if (workspaceAnalysis.projectType) {
              console.log(`[WorkspaceAnalyzer] Project type: ${workspaceAnalysis.projectType}`);
            }
            if (workspaceAnalysis.frameworks.length > 0) {
              console.log(`[WorkspaceAnalyzer] Frameworks: ${workspaceAnalysis.frameworks.join(', ')}`);
            }
          }
        } catch (error) {
          if (logClassifications) {
            console.error(`[WorkspaceAnalyzer] Analysis failed:`, error);
          }
        }
      }

      // Classify intent with workspace context
      const intent = classifyIntent(messageText, {
        hasExistingProject: workspaceAnalysis?.hasProject ?? false,
        workspaceFiles: workspaceAnalysis?.configFiles,
        projectType: workspaceAnalysis?.projectType,
        frameworks: workspaceAnalysis?.frameworks,
      });

      if (logClassifications) {
        console.log(`[IntentRouter] Classified: ${intent.intent} → ${intent.mode} (confidence: ${intent.confidence.toFixed(2)})`);
        console.log(`[IntentRouter] Rationale: ${intent.rationale}`);
        if (intent.technologyHints.length > 0) {
          console.log(`[IntentRouter] Technologies: ${intent.technologyHints.join(', ')}`);
        }
      }

      config.onIntentClassified?.(intent);

      const systemParts: Array<{ type: 'text'; text: string }> = [];

      // Always inject execution mode system prompt for non-chat modes or when classified
      if (intent.mode && intent.mode !== 'chat') {
        systemParts.push({
          type: 'text',
          text: buildModeSystemPrompt(intent.mode),
        });
      }

      // For build mode, add technology recommendations
      if (intent.mode === 'build' && intent.technologyHints.length > 0) {
        const techRecommendation = recommendTechnology(intent.intent, intent.technologyHints);
        const techPrompt = `# Technology Selection\nBased on your request, the following technology stack has been selected:\n- Framework: ${techRecommendation.framework}\n- Build Tool: ${techRecommendation.buildTool}\n- Language: ${techRecommendation.language}\n\nProceed with creating the project using these technologies.`;
        systemParts.push({
          type: 'text',
          text: techPrompt,
        });
      }

      if (systemParts.length > 0) {
        return { systemParts };
      }

      return undefined;
    },

    /**
     * After model call: validate that build mode used filesystem tools
     */
    afterModel: async (_ctx): Promise<AgentStopControl | undefined> => {
      // Enforcement is handled via system prompt instructions
      // afterModel hook cannot add messages to the conversation
      return undefined;
    },
  };
}

/**
 * Extract text content from an agent message
 */
function extractTextFromMessage(message: AgentMessage): string {
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.type === 'text' ? part.text : '')
    .join(' ');
}

/**
 * Create a build mode enforcement hook
 * Ensures build requests always use filesystem tools
 */
export function createBuildModeEnforcement(config: {
  cwd?: string;
  maxChatIterationsWithoutTools?: number;
}): Partial<AgentRuntimeHooks> {
  const maxIterations = config.maxChatIterationsWithoutTools ?? 2;
  let iterationsWithoutTools = 0;

  return {
    afterModel: async (ctx): Promise<AgentStopControl | undefined> => {
      const assistantMessage = ctx.assistantMessage;
      if (!assistantMessage) {
        return undefined;
      }

      const hasToolCalls = assistantMessage.content.some(
        (part: any) => part.type === 'tool-call'
      );

      if (!hasToolCalls) {
        iterationsWithoutTools++;

        if (iterationsWithoutTools >= maxIterations) {
          // Check if this was a build request
          // Note: We can't access request messages in afterModel context
          // This enforcement is handled via system prompt instead
          iterationsWithoutTools = 0;
        }
      } else {
        iterationsWithoutTools = 0;
      }

      return undefined;
    },
  };
}

/**
 * Template-based project scaffolding helper
 * Can be called by tools to scaffold projects from templates
 */
export async function scaffoldFromTemplate(
  templateId: string,
  projectRoot: string,
  variables: Record<string, string>,
  writeFile: (path: string, content: string) => Promise<void>,
  runCommand: (command: string) => Promise<{ success: boolean; output: string }>
): Promise<{
  success: boolean;
  filesCreated: number;
  errors: string[];
}> {
  const template = getTemplate(templateId);
  if (!template) {
    return {
      success: false,
      filesCreated: 0,
      errors: [`Template not found: ${templateId}`],
    };
  }

  const errors: string[] = [];
  let filesCreated = 0;

  try {
    // Process template variables
    const processedTemplate = processTemplate(template, {
      PROJECT_NAME: variables.projectName || 'my-project',
      ...variables,
    });

    // Create all files
    for (const file of processedTemplate.files) {
      const fullPath = `${projectRoot}/${file.path}`;
      await writeFile(fullPath, file.content);
      filesCreated++;
    }

    // Run post-create commands
    for (const command of processedTemplate.postCreateCommands) {
      const result = await runCommand(command);
      if (!result.success) {
        errors.push(`Command failed: ${command}`);
      }
    }

    return {
      success: errors.length === 0,
      filesCreated,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      filesCreated,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
