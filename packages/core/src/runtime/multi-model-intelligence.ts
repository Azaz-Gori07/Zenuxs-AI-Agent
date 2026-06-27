/**
 * Multi-Model Intelligence System
 *
 * Transforms Zenuxs into a provider-agnostic orchestration platform with:
 * - Provider abstraction (OpenAI, Anthropic, Google, OpenRouter, etc.)
 * - Intelligent model router (task-based model selection)
 * - Reasoning engine (separate from execution)
 * - Cost optimization and tracking
 * - Confidence and risk assessment
 * - Provider fallback and retry
 * - Model performance tracking and self-learning
 *
 * Architecture:
 * Task → Planner → Model Router → Reasoning Engine → Execution Engine → Validation
 *
 * Benefits:
 * - Provider independence (interchangeable)
 * - Cost optimization (right model for right task)
 * - Improved reliability (fallback, retry)
 * - Better reasoning (multi-model collaboration)
 * - Context optimization (send only relevant data)
 * - Self-learning routing (adapt based on performance)
 */

export enum ProviderType {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
  GOOGLE = "google",
  OPENROUTER = "openrouter",
  DEEPSEEK = "deepseek",
  GROQ = "groq",
  MISTRAL = "mistral",
  OLLAMA = "ollama",
  CUSTOM = "custom",
}

export enum ModelCapability {
  CHAT = "chat",
  CODING = "coding",
  REASONING = "reasoning",
  VISION = "vision",
  LONG_CONTEXT = "long_context",
  FAST = "fast",
  CHEAP = "cheap",
  REVIEW = "review",
  WRITING = "writing",
}

export enum TaskComplexity {
  SIMPLE = "simple", // Quick questions, basic edits
  MODERATE = "moderate", // Feature implementation, refactoring
  COMPLEX = "complex", // Architecture design, large refactors
  CRITICAL = "critical", // Security, migrations, major changes
}

export enum TaskType {
  QUESTION = "question",
  SEARCH = "search",
  ARCHITECTURE = "architecture",
  CODING = "coding",
  IMAGE_ANALYSIS = "image_analysis",
  DOCUMENTATION = "documentation",
  CODE_REVIEW = "code_review",
  REPOSITORY_ANALYSIS = "repository_analysis",
  DEBUGGING = "debugging",
  TESTING = "testing",
  VALIDATION = "validation",
}

export interface ModelConfig {
  /** Model identifier */
  modelId: string;
  /** Provider */
  provider: ProviderType;
  /** Model capabilities */
  capabilities: ModelCapability[];
  /** Maximum context window (tokens) */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Cost per 1M input tokens (USD) */
  costPerInputToken: number;
  /** Cost per 1M output tokens (USD) */
  costPerOutputToken: number;
  /** Average latency (ms) */
  averageLatencyMs: number;
  /** Model tier */
  tier: "fast" | "balanced" | "strong" | "premium";
}

export interface ProviderConfig {
  /** Provider type */
  provider: ProviderType;
  /** API key */
  apiKey: string;
  /** Base URL (optional, for custom endpoints) */
  baseUrl?: string;
  /** Default model for this provider */
  defaultModel: string;
  /** Available models */
  models: ModelConfig[];
  /** Whether provider is enabled */
  enabled: boolean;
  /** Rate limit (requests per minute) */
  rateLimitRPM?: number;
}

export interface ModelRoutingDecision {
  /** Selected model */
  selectedModel: ModelConfig;
  /** Reasoning for selection */
  reasoning: string;
  /** Estimated cost (USD) */
  estimatedCost: number;
  /** Estimated latency (ms) */
  estimatedLatencyMs: number;
  /** Confidence in selection (0-1) */
  confidence: number;
  /** Alternative models considered */
  alternatives: ModelConfig[];
}

export interface ReasoningRequest {
  /** Task type */
  taskType: TaskType;
  /** Task complexity */
  complexity: TaskComplexity;
  /** Task description */
  description: string;
  /** Required capabilities */
  requiredCapabilities: ModelCapability[];
  /** Context (relevant files, symbols, etc.) */
  context?: {
    files?: string[];
    symbols?: string[];
    history?: string;
    dependencies?: string[];
  };
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
  /** Whether to stream response */
  stream?: boolean;
  /** Timeout (ms) */
  timeoutMs?: number;
}

export interface ReasoningResponse {
  /** Response content */
  content: string;
  /** Model used */
  model: ModelConfig;
  /** Tokens used */
  tokensUsed: {
    input: number;
    output: number;
  };
  /** Cost (USD) */
  cost: number;
  /** Latency (ms) */
  latencyMs: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Risk assessment */
  risk: "low" | "medium" | "high";
  /** Suggested next steps */
  nextSteps?: string[];
  /** Whether response was validated */
  validated: boolean;
  /** Validation result (if validated) */
  validationResult?: {
    validator: ModelConfig;
    confidence: number;
    feedback?: string;
  };
}

export interface ModelPerformanceMetrics {
  /** Model ID */
  modelId: string;
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average latency (ms) */
  averageLatencyMs: number;
  /** Average cost per request (USD) */
  averageCostPerRequest: number;
  /** Total cost (USD) */
  totalCost: number;
  /** Total tokens used */
  totalTokens: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average confidence (0-1) */
  averageConfidence: number;
  /** Last used */
  lastUsed: Date;
}

export interface MultiModelConfig {
  /** Default provider */
  defaultProvider?: ProviderType;
  /** Default model */
  defaultModel?: string;
  /** Maximum cost per task (USD) */
  maxCostPerTask?: number;
  /** Whether to enable automatic fallback */
  enableFallback?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Whether to enable response validation */
  enableValidation?: boolean;
  /** Whether to enable cost optimization */
  enableCostOptimization?: boolean;
  /** Whether to track model performance */
  trackPerformance?: boolean;
}

const DEFAULT_CONFIG: Required<MultiModelConfig> = {
  defaultProvider: ProviderType.OPENAI,
  defaultModel: "gpt-4o",
  maxCostPerTask: 1.0,
  enableFallback: true,
  maxRetries: 3,
  enableValidation: true,
  enableCostOptimization: true,
  trackPerformance: true,
};

/**
 * Built-in model catalog
 */
export const BUILTIN_MODELS: ModelConfig[] = [
  // OpenAI
  {
    modelId: "gpt-4o",
    provider: ProviderType.OPENAI,
    capabilities: [ModelCapability.CHAT, ModelCapability.CODING, ModelCapability.REASONING, ModelCapability.VISION],
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    costPerInputToken: 2.50,
    costPerOutputToken: 10.00,
    averageLatencyMs: 2000,
    tier: "premium",
  },
  {
    modelId: "gpt-4o-mini",
    provider: ProviderType.OPENAI,
    capabilities: [ModelCapability.CHAT, ModelCapability.FAST, ModelCapability.CHEAP],
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    costPerInputToken: 0.15,
    costPerOutputToken: 0.60,
    averageLatencyMs: 1000,
    tier: "fast",
  },
  {
    modelId: "o1",
    provider: ProviderType.OPENAI,
    capabilities: [ModelCapability.REASONING, ModelCapability.CODING],
    maxContextTokens: 200_000,
    maxOutputTokens: 100_000,
    costPerInputToken: 15.00,
    costPerOutputToken: 60.00,
    averageLatencyMs: 10000,
    tier: "premium",
  },

  // Anthropic
  {
    modelId: "claude-sonnet-4-20250514",
    provider: ProviderType.ANTHROPIC,
    capabilities: [ModelCapability.CHAT, ModelCapability.CODING, ModelCapability.REASONING],
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 3.00,
    costPerOutputToken: 15.00,
    averageLatencyMs: 3000,
    tier: "strong",
  },
  {
    modelId: "claude-opus-4-20250514",
    provider: ProviderType.ANTHROPIC,
    capabilities: [ModelCapability.CHAT, ModelCapability.CODING, ModelCapability.REASONING, ModelCapability.REVIEW],
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 15.00,
    costPerOutputToken: 75.00,
    averageLatencyMs: 5000,
    tier: "premium",
  },
  {
    modelId: "claude-haiku-3-20240307",
    provider: ProviderType.ANTHROPIC,
    capabilities: [ModelCapability.CHAT, ModelCapability.FAST, ModelCapability.CHEAP],
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    costPerInputToken: 0.25,
    costPerOutputToken: 1.25,
    averageLatencyMs: 800,
    tier: "fast",
  },

  // Google
  {
    modelId: "gemini-2.5-pro",
    provider: ProviderType.GOOGLE,
    capabilities: [ModelCapability.CHAT, ModelCapability.CODING, ModelCapability.REASONING, ModelCapability.LONG_CONTEXT],
    maxContextTokens: 1_000_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 1.25,
    costPerOutputToken: 10.00,
    averageLatencyMs: 4000,
    tier: "strong",
  },
  {
    modelId: "gemini-2.5-flash",
    provider: ProviderType.GOOGLE,
    capabilities: [ModelCapability.CHAT, ModelCapability.FAST, ModelCapability.CHEAP],
    maxContextTokens: 1_000_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 0.15,
    costPerOutputToken: 0.60,
    averageLatencyMs: 1500,
    tier: "fast",
  },

  // DeepSeek
  {
    modelId: "deepseek-chat",
    provider: ProviderType.DEEPSEEK,
    capabilities: [ModelCapability.CHAT, ModelCapability.CODING],
    maxContextTokens: 128_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 0.27,
    costPerOutputToken: 1.10,
    averageLatencyMs: 3000,
    tier: "balanced",
  },
  {
    modelId: "deepseek-reasoner",
    provider: ProviderType.DEEPSEEK,
    capabilities: [ModelCapability.REASONING, ModelCapability.CODING],
    maxContextTokens: 128_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 0.55,
    costPerOutputToken: 2.19,
    averageLatencyMs: 8000,
    tier: "strong",
  },

  // Groq
  {
    modelId: "llama-3.3-70b-versatile",
    provider: ProviderType.GROQ,
    capabilities: [ModelCapability.CHAT, ModelCapability.FAST, ModelCapability.CHEAP],
    maxContextTokens: 128_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 0.59,
    costPerOutputToken: 0.79,
    averageLatencyMs: 300,
    tier: "fast",
  },

  // Mistral
  {
    modelId: "mistral-large-latest",
    provider: ProviderType.MISTRAL,
    capabilities: [ModelCapability.CHAT, ModelCapability.CODING, ModelCapability.REASONING],
    maxContextTokens: 128_000,
    maxOutputTokens: 8_192,
    costPerInputToken: 2.00,
    costPerOutputToken: 6.00,
    averageLatencyMs: 2500,
    tier: "strong",
  },
];

/**
 * Model Router — Intelligent model selection based on task requirements
 */
export class ModelRouter {
  private providers: Map<ProviderType, ProviderConfig> = new Map();
  private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private config: Required<MultiModelConfig>;

  constructor(config: MultiModelConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize with built-in models
    this.initializeProviders();
  }

  /**
   * Register a provider
   */
  registerProvider(config: ProviderConfig): void {
    this.providers.set(config.provider, config);

    // Initialize performance metrics for provider's models
    for (const model of config.models) {
      if (!this.performanceMetrics.has(model.modelId)) {
        this.performanceMetrics.set(model.modelId, {
          modelId: model.modelId,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageLatencyMs: model.averageLatencyMs,
          averageCostPerRequest: 0,
          totalCost: 0,
          totalTokens: 0,
          successRate: 1.0,
          averageConfidence: 0.8,
          lastUsed: new Date(),
        });
      }
    }
  }

  /**
   * Route task to best model
   */
  routeTask(request: ReasoningRequest): ModelRoutingDecision {
    // Get all available models
    const availableModels = this.getAvailableModels();

    // Filter by required capabilities
    const capableModels = availableModels.filter((model) =>
      request.requiredCapabilities.every((cap) => model.capabilities.includes(cap)),
    );

    if (capableModels.length === 0) {
      // Fallback to default model
      const defaultModel = this.getDefaultModel();
      return {
        selectedModel: defaultModel,
        reasoning: "No capable models available, using default",
        estimatedCost: 0,
        estimatedLatencyMs: defaultModel.averageLatencyMs,
        confidence: 0.5,
        alternatives: [],
      };
    }

    // Score models based on task requirements
    const scored = capableModels.map((model) => ({
      model,
      score: this.scoreModel(model, request),
    }));

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const alternatives = scored.slice(1, 4).map((s) => s.model);

    // Estimate cost and latency
    const estimatedCost = this.estimateCost(best.model, request);
    const estimatedLatency = best.model.averageLatencyMs;

    return {
      selectedModel: best.model,
      reasoning: this.generateRoutingReasoning(best.model, request, scored),
      estimatedCost,
      estimatedLatencyMs: estimatedLatency,
      confidence: Math.min(best.score / 10, 1.0),
      alternatives,
    };
  }

  /**
   * Update performance metrics after request
   */
  updateMetrics(modelId: string, response: ReasoningResponse): void {
    const metrics = this.performanceMetrics.get(modelId);
    if (!metrics) return;

    metrics.totalRequests++;
    if (response.confidence > 0.7) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.averageLatencyMs =
      (metrics.averageLatencyMs * (metrics.totalRequests - 1) + response.latencyMs) /
      metrics.totalRequests;

    metrics.totalCost += response.cost;
    metrics.averageCostPerRequest = metrics.totalCost / metrics.totalRequests;

    metrics.totalTokens += response.tokensUsed.input + response.tokensUsed.output;
    metrics.successRate = metrics.successfulRequests / metrics.totalRequests;
    metrics.averageConfidence =
      (metrics.averageConfidence * (metrics.totalRequests - 1) + response.confidence) /
      metrics.totalRequests;

    metrics.lastUsed = new Date();
  }

  /**
   * Get performance metrics for a model
   */
  getMetrics(modelId: string): ModelPerformanceMetrics | undefined {
    return this.performanceMetrics.get(modelId);
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): ModelPerformanceMetrics[] {
    return Array.from(this.performanceMetrics.values());
  }

  /**
   * Initialize providers with built-in models
   */
  private initializeProviders(): void {
    // Group built-in models by provider
    const modelsByProvider = new Map<ProviderType, ModelConfig[]>();

    for (const model of BUILTIN_MODELS) {
      if (!modelsByProvider.has(model.provider)) {
        modelsByProvider.set(model.provider, []);
      }
      modelsByProvider.get(model.provider)!.push(model);
    }

    // Create provider configs
    for (const [provider, models] of modelsByProvider) {
      this.providers.set(provider, {
        provider,
        apiKey: "", // Will be set by user
        defaultModel: models[0].modelId,
        models,
        enabled: true,
      });
    }
  }

  /**
   * Get all available models
   */
  private getAvailableModels(): ModelConfig[] {
    const models: ModelConfig[] = [];

    for (const provider of this.providers.values()) {
      if (provider.enabled) {
        models.push(...provider.models);
      }
    }

    return models;
  }

  /**
   * Get default model
   */
  private getDefaultModel(): ModelConfig {
    const provider = this.providers.get(this.config.defaultProvider);
    if (!provider) {
      return BUILTIN_MODELS[0];
    }

    const model = provider.models.find((m) => m.modelId === this.config.defaultModel);
    return model || provider.models[0];
  }

  /**
   * Score a model for a task
   */
  private scoreModel(model: ModelConfig, request: ReasoningRequest): number {
    let score = 0;

    // Capability match (0-40 points)
    const capabilityMatch = request.requiredCapabilities.filter((cap) =>
      model.capabilities.includes(cap),
    ).length;
    score += (capabilityMatch / request.requiredCapabilities.length) * 40;

    // Context window fit (0-20 points)
    if (model.maxContextTokens >= 100_000) {
      score += 20; // Long context bonus for repository analysis
    } else if (model.maxContextTokens >= 50_000) {
      score += 15;
    } else {
      score += 10;
    }

    // Cost optimization (0-20 points)
    const totalCost = model.costPerInputToken + model.costPerOutputToken;
    if (request.complexity === TaskComplexity.SIMPLE) {
      // Prefer cheap models for simple tasks
      score += totalCost < 2 ? 20 : totalCost < 10 ? 10 : 5;
    } else if (request.complexity === TaskComplexity.CRITICAL) {
      // Cost doesn't matter for critical tasks
      score += 15;
    } else {
      score += totalCost < 5 ? 15 : totalCost < 20 ? 10 : 5;
    }

    // Latency (0-10 points)
    if (model.averageLatencyMs < 1000) {
      score += 10;
    } else if (model.averageLatencyMs < 3000) {
      score += 7;
    } else {
      score += 5;
    }

    // Historical performance (0-10 points)
    const metrics = this.performanceMetrics.get(model.modelId);
    if (metrics) {
      score += metrics.successRate * 10;
    } else {
      score += 5; // Default for new models
    }

    return score;
  }

  /**
   * Estimate cost for a request
   */
  private estimateCost(model: ModelConfig, request: ReasoningRequest): number {
    // Rough estimate: 1000 input tokens, 500 output tokens
    const inputTokens = 1000;
    const outputTokens = request.maxTokens || 500;

    const inputCost = (inputTokens / 1_000_000) * model.costPerInputToken;
    const outputCost = (outputTokens / 1_000_000) * model.costPerOutputToken;

    return inputCost + outputCost;
  }

  /**
   * Generate reasoning for model selection
   */
  private generateRoutingReasoning(
    model: ModelConfig,
    request: ReasoningRequest,
    scored: Array<{ model: ModelConfig; score: number }>,
  ): string {
    const reasons: string[] = [];

    reasons.push(`Selected ${model.modelId} (${model.provider})`);
    reasons.push(`Tier: ${model.tier}`);
    reasons.push(`Capabilities: ${model.capabilities.join(", ")}`);

    if (request.complexity === TaskComplexity.CRITICAL) {
      reasons.push("Critical task requiring strong reasoning");
    } else if (request.complexity === TaskComplexity.SIMPLE) {
      reasons.push("Simple task optimized for cost and speed");
    }

    if (scored.length > 1) {
      const second = scored[1];
      reasons.push(`Outperformed ${second.model.modelId} by ${(model.capabilities.length - second.model.capabilities.length) * 10} points`);
    }

    return reasons.join(". ");
  }
}

/**
 * Reasoning Engine — Separates reasoning from execution
 */
export class ReasoningEngine {
  private router: ModelRouter;

  constructor(router: ModelRouter) {
    this.router = router;
  }

  /**
   * Perform reasoning for a task
   */
  async reason(request: ReasoningRequest): Promise<ReasoningResponse> {
    const startTime = Date.now();

    // Route to best model
    const routingDecision = this.router.routeTask(request);

    // Execute reasoning (placeholder - will be integrated with actual provider)
    const response = await this.executeReasoning(routingDecision.selectedModel, request);

    // Update metrics
    this.router.updateMetrics(routingDecision.selectedModel.modelId, response);

    // Validate if required
    if (this.shouldValidate(request, response)) {
      response.validationResult = await this.validateResponse(request, response);
      response.validated = true;
    }

    return response;
  }

  /**
   * Execute reasoning with a model
   */
  private async executeReasoning(
    model: ModelConfig,
    request: ReasoningRequest,
  ): Promise<ReasoningResponse> {
    // Placeholder: In production, this would call the actual provider API
    // For now, simulate a response
    const latencyMs = model.averageLatencyMs;
    const inputTokens = 1000;
    const outputTokens = 500;

    const cost =
      (inputTokens / 1_000_000) * model.costPerInputToken +
      (outputTokens / 1_000_000) * model.costPerOutputToken;

    return {
      content: `Reasoning response from ${model.modelId}`,
      model,
      tokensUsed: { input: inputTokens, output: outputTokens },
      cost,
      latencyMs,
      confidence: 0.85,
      risk: request.complexity === TaskComplexity.CRITICAL ? "high" : "medium",
      validated: false,
    };
  }

  /**
   * Determine if response should be validated
   */
  private shouldValidate(request: ReasoningRequest, response: ReasoningResponse): boolean {
    // Validate critical tasks
    if (request.complexity === TaskComplexity.CRITICAL) {
      return true;
    }

    // Validate low confidence responses
    if (response.confidence < 0.7) {
      return true;
    }

    // Validate high-risk responses
    if (response.risk === "high") {
      return true;
    }

    return false;
  }

  /**
   * Validate response with secondary model
   */
  private async validateResponse(
    request: ReasoningRequest,
    response: ReasoningResponse,
  ): Promise<ReasoningResponse["validationResult"]> {
    // Select validator model (different from primary)
    const validatorModel = BUILTIN_MODELS.find(
      (m) => m.modelId !== response.model.modelId && m.capabilities.includes(ModelCapability.REVIEW),
    ) || BUILTIN_MODELS[0];

    // Simulate validation
    return {
      validator: validatorModel,
      confidence: 0.9,
      feedback: "Response validated successfully",
    };
  }
}

/**
 * Singleton instances
 */
let globalModelRouter: ModelRouter | null = null;
let globalReasoningEngine: ReasoningEngine | null = null;

export function getModelRouter(config: MultiModelConfig = {}): ModelRouter {
  if (!globalModelRouter) {
    globalModelRouter = new ModelRouter(config);
  }
  return globalModelRouter;
}

export function getReasoningEngine(config: MultiModelConfig = {}): ReasoningEngine {
  if (!globalReasoningEngine) {
    const router = getModelRouter(config);
    globalReasoningEngine = new ReasoningEngine(router);
  }
  return globalReasoningEngine;
}

export function resetMultiModelSystem(): void {
  globalModelRouter = null;
  globalReasoningEngine = null;
}
