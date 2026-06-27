/**
 * SDLC Engine — Complete Software Development Lifecycle
 *
 * Transforms Zenuxs from a coding agent into a complete engineering delivery platform.
 * Owns the entire process from requirements understanding through deployment preparation.
 *
 * SDLC Phases:
 * 1. Requirement Analysis — Understand business goal, users, platform, constraints
 * 2. Architecture Planning — Choose frontend, backend, database, auth, deployment
 * 3. Project Breakdown — Decompose into milestones, tasks, subtasks, dependencies
 * 4. Implementation — Execute foundation → core → secondary → integrations
 * 5. Testing — Unit, integration, E2E, validation, regression
 * 6. Debugging — Fix failures, optimize performance, resolve issues
 * 7. Validation — Build, lint, test, typecheck, security, performance
 * 8. Optimization — Improve architecture, code quality, DX, performance
 * 9. Documentation — API docs, setup guides, deployment guides
 * 10. Deployment Preparation — Env vars, configs, health checks, security
 * 11. Maintenance — Monitoring, logging, error tracking, updates
 *
 * Benefits:
 * - Product thinking (not just code generation)
 * - Architecture-first implementation
 * - Milestone-based execution
 * - Test-driven validation
 * - Deployment-ready output
 * - Continuous improvement loop
 */

import { getGoalTracker, type GoalDecomposition, type GoalMilestone } from "./goal-tracker";
import { logInfo } from "./logging";
import { emitExecutionStart } from "./event-bus";

export enum SDLCPhase {
  REQUIREMENT_ANALYSIS = "requirement_analysis",
  ARCHITECTURE_PLANNING = "architecture_planning",
  PROJECT_BREAKDOWN = "project_breakdown",
  IMPLEMENTATION = "implementation",
  TESTING = "testing",
  DEBUGGING = "debugging",
  VALIDATION = "validation",
  OPTIMIZATION = "optimization",
  DOCUMENTATION = "documentation",
  DEPLOYMENT_PREPARATION = "deployment_preparation",
  MAINTENANCE = "maintenance",
}

export interface RequirementAnalysis {
  /** Business goal */
  businessGoal: string;
  /** Target users */
  targetUsers: string[];
  /** Platform (web, mobile, desktop, API) */
  platform: string[];
  /** Technology preferences */
  technology?: string[];
  /** Performance requirements */
  performanceRequirements?: {
    maxResponseTime?: number; // ms
    maxLoadTime?: number; // ms
    concurrentUsers?: number;
  };
  /** Security requirements */
  securityRequirements?: {
    authentication: boolean;
    authorization: boolean;
    dataEncryption: boolean;
    compliance?: string[]; // GDPR, HIPAA, etc.
  };
  /** Deployment requirements */
  deploymentRequirements?: {
    targetEnvironment: "cloud" | "on-premise" | "hybrid";
    scalingRequirements?: "horizontal" | "vertical" | "auto";
    monitoringRequired: boolean;
  };
  /** Maintainability requirements */
  maintainabilityRequirements?: {
    codeCoverage?: number; // percentage
    documentationRequired: boolean;
    testingRequired: boolean;
  };
  /** Future scalability */
  scalabilityRequirements?: {
    expectedGrowth: "low" | "medium" | "high";
    multiTenantRequired: boolean;
    internationalizationRequired: boolean;
  };
}

export interface ArchitectureDecision {
  /** Component name */
  component: string;
  /** Chosen technology */
  technology: string;
  /** Alternatives considered */
  alternatives: string[];
  /** Reasoning (internal, not exposed to user) */
  reasoning: string;
  /** Trade-offs */
  tradeOffs: string[];
}

export interface ArchitecturePlan {
  /** Frontend architecture */
  frontend: ArchitectureDecision;
  /** Backend architecture */
  backend: ArchitectureDecision;
  /** Database architecture */
  database: ArchitectureDecision;
  /** Authentication */
  authentication: ArchitectureDecision;
  /** Storage */
  storage?: ArchitectureDecision;
  /** Caching */
  caching?: ArchitectureDecision;
  /** Queue */
  queue?: ArchitectureDecision;
  /** Search */
  search?: ArchitectureDecision;
  /** Deployment */
  deployment: ArchitectureDecision;
  /** Monitoring */
  monitoring: ArchitectureDecision;
  /** Logging */
  logging: ArchitectureDecision;
}

export interface ProjectMilestone extends Omit<GoalMilestone, "status" | "id" | "completedAt"> {
  /** Milestone ID */
  milestoneId: string;
  /** SDLC phase this milestone belongs to */
  sdlcPhase: SDLCPhase;
  /** Dependencies on other milestones */
  dependencies: string[];
  /** Validation criteria */
  validationCriteria: string[];
  /** Estimated duration (hours) */
  estimatedDuration?: number;
}

export interface SDLCProject {
  /** Project name */
  name: string;
  /** Project type (portfolio, crm, chat, erp, saas, etc.) */
  type: string;
  /** Product description */
  productDescription: string;
  /** Requirement analysis */
  requirements: RequirementAnalysis;
  /** Architecture plan */
  architecture: ArchitecturePlan;
  /** Project milestones */
  milestones: ProjectMilestone[];
  /** Current phase */
  currentPhase: SDLCPhase;
  /** Project status */
  status: "planning" | "in_progress" | "completed" | "failed";
  /** Started at */
  startedAt?: Date;
  /** Completed at */
  completedAt?: Date;
}

export interface SDLCConfig {
  /** Whether to require architecture planning */
  requireArchitecture?: boolean;
  /** Whether to require test generation */
  requireTests?: boolean;
  /** Whether to require documentation */
  requireDocumentation?: boolean;
  /** Whether to prepare for deployment */
  prepareDeployment?: boolean;
  /** Maximum iterations per phase */
  maxIterationsPerPhase?: number;
  /** Whether to enable continuous improvement */
  enableContinuousImprovement?: boolean;
}

const DEFAULT_CONFIG: Required<SDLCConfig> = {
  requireArchitecture: true,
  requireTests: true,
  requireDocumentation: true,
  prepareDeployment: true,
  maxIterationsPerPhase: 100,
  enableContinuousImprovement: true,
};

/**
 * SDLC Engine
 */
export class SDLCEngine {
  private currentProject: SDLCProject | null = null;
  private config: Required<SDLCConfig>;

  constructor(config: SDLCConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize SDLC project from user request
   */
  async initializeProject(
    userRequest: string,
    sessionId: string,
    workspaceRoot: string,
  ): Promise<string> {
    logInfo("SDLC", "Initializing SDLC project", { userRequest, sessionId });

    // Phase 1: Requirement Analysis
    const requirements = await this.analyzeRequirements(userRequest);

    // Determine project type
    const projectType = this.determineProjectType(userRequest, requirements);
    const productDescription = this.generateProductDescription(projectType, requirements);

    // Phase 2: Architecture Planning (if required)
    let architecture: ArchitecturePlan | undefined;
    if (this.config.requireArchitecture) {
      architecture = await this.planArchitecture(requirements, projectType);
    }

    // Create project
    this.currentProject = {
      name: this.extractProjectName(userRequest),
      type: projectType,
      productDescription,
      requirements,
      architecture: architecture!,
      milestones: [],
      currentPhase: SDLCPhase.REQUIREMENT_ANALYSIS,
      status: "planning",
      startedAt: new Date(),
    };

    // Phase 3: Project Breakdown
    await this.breakdownProject(workspaceRoot);

    // Emit execution start event
    emitExecutionStart(
      sessionId,
      this.currentProject.productDescription,
      "sdlc",
      workspaceRoot,
    );

    logInfo("SDLC", "Project initialized", {
      name: this.currentProject.name,
      type: projectType,
      milestones: this.currentProject.milestones.length,
    });

    // Convert to GoalMilestone format for goal tracker
    const goalMilestones = milestones.map((m) => ({
      id: m.milestoneId,
      description: m.description,
      tasks: m.tasks,
      dependencies: m.dependencies,
      validationCriteria: m.validationCriteria,
    }));

    // Create goal in goal tracker
    const goalTracker = getGoalTracker();
    const decomposition: GoalDecomposition = {
      goal: this.currentProject.productDescription,
      milestones: goalMilestones,
    };

    const goalId = goalTracker.createGoal(userRequest, decomposition);

    return goalId;
  }

  /**
   * Phase 1: Analyze requirements from user request
   */
  private async analyzeRequirements(userRequest: string): Promise<RequirementAnalysis> {
    const requestLower = userRequest.toLowerCase();

    // Extract business goal
    const businessGoal = this.extractBusinessGoal(userRequest);

    // Identify target users
    const targetUsers = this.identifyTargetUsers(requestLower);

    // Detect platform
    const platform = this.detectPlatform(requestLower);

    // Extract technology preferences
    const technology = this.extractTechnologyPreferences(requestLower);

    // Determine requirements based on project type
    const securityRequirements = this.determineSecurityRequirements(requestLower);
    const deploymentRequirements = this.determineDeploymentRequirements(requestLower);
    const scalabilityRequirements = this.determineScalabilityRequirements(requestLower);

    return {
      businessGoal,
      targetUsers,
      platform,
      technology,
      securityRequirements,
      deploymentRequirements,
      scalabilityRequirements,
      maintainabilityRequirements: {
        codeCoverage: 80,
        documentationRequired: true,
        testingRequired: true,
      },
    };
  }

  /**
   * Determine project type from request
   */
  private determineProjectType(
    userRequest: string,
    _requirements: RequirementAnalysis,
  ): string {
    const requestLower = userRequest.toLowerCase();

    // Portfolio
    if (requestLower.includes("portfolio") || requestLower.includes("personal site")) {
      return "portfolio";
    }

    // CRM
    if (requestLower.includes("crm") || requestLower.includes("customer management")) {
      return "crm";
    }

    // Chat/Messaging
    if (
      requestLower.includes("chat") ||
      requestLower.includes("messaging") ||
      requestLower.includes("real-time communication")
    ) {
      return "chat";
    }

    // ERP
    if (requestLower.includes("erp") || requestLower.includes("enterprise resource")) {
      return "erp";
    }

    // SaaS
    if (requestLower.includes("saas") || requestLower.includes("subscription")) {
      return "saas";
    }

    // Dashboard
    if (requestLower.includes("dashboard") || requestLower.includes("analytics")) {
      return "dashboard";
    }

    // E-commerce
    if (
      requestLower.includes("ecommerce") ||
      requestLower.includes("shop") ||
      requestLower.includes("store")
    ) {
      return "ecommerce";
    }

    // Blog/CMS
    if (requestLower.includes("blog") || requestLower.includes("cms") || requestLower.includes("content")) {
      return "cms";
    }

    // API
    if (requestLower.includes("api") || requestLower.includes("backend")) {
      return "api";
    }

    // CLI
    if (requestLower.includes("cli") || requestLower.includes("command line")) {
      return "cli";
    }

    // Default: web application
    return "webapp";
  }

  /**
   * Generate product description
   */
  private generateProductDescription(
    projectType: string,
    _requirements: RequirementAnalysis,
  ): string {
    const descriptions: Record<string, string> = {
      portfolio: "Personal Branding Platform",
      crm: "Customer Management Platform",
      chat: "Real-Time Communication Platform",
      erp: "Business Management Platform",
      saas: "Scalable Cloud Product",
      dashboard: "Analytics and Monitoring Platform",
      ecommerce: "E-Commerce Platform",
      cms: "Content Management System",
      api: "RESTful API Service",
      cli: "Command-Line Tool",
      webapp: "Web Application",
    };

    return descriptions[projectType] || "Web Application";
  }

  /**
   * Phase 2: Plan architecture
   */
  private async planArchitecture(
    requirements: RequirementAnalysis,
    projectType: string,
  ): Promise<ArchitecturePlan> {
    logInfo("SDLC", "Planning architecture", { projectType });

    // Choose frontend
    const frontend = this.chooseFrontend(projectType, requirements);

    // Choose backend
    const backend = this.chooseBackend(projectType, requirements);

    // Choose database
    const database = this.chooseDatabase(projectType, requirements);

    // Choose authentication
    const authentication = this.chooseAuthentication(requirements);

    // Choose deployment
    const deployment = this.chooseDeployment(requirements);

    // Choose monitoring
    const monitoring = this.chooseMonitoring(requirements);

    // Choose logging
    const logging = this.chooseLogging(requirements);

    return {
      frontend,
      backend,
      database,
      authentication,
      deployment,
      monitoring,
      logging,
    };
  }

  /**
   * Phase 3: Break down project into milestones
   */
  private async breakdownProject(_workspaceRoot: string): Promise<void> {
    if (!this.currentProject) {
      throw new Error("No project initialized");
    }

    logInfo("SDLC", "Breaking down project into milestones", {
      projectType: this.currentProject.type,
    });

    const milestones: ProjectMilestone[] = [];

    // Milestone 1: Foundation
    milestones.push({
      milestoneId: `milestone_foundation`,
      description: "Project Foundation",
      sdlcPhase: SDLCPhase.IMPLEMENTATION,
      tasks: [
        "Initialize project structure",
        "Configure build system",
        "Setup development environment",
        "Configure linting and formatting",
        "Setup version control",
      ],
      dependencies: [],
      validationCriteria: [
        "Project structure created",
        "Build system configured",
        "Development environment working",
        "Linting and formatting passing",
      ],
      status: "pending",
    } as ProjectMilestone);

    // Milestone 2: Core Features
    milestones.push({
      milestoneId: `milestone_core`,
      description: "Core Features Implementation",
      sdlcPhase: SDLCPhase.IMPLEMENTATION,
      tasks: [
        "Implement core business logic",
        "Setup data models",
        "Implement primary user flows",
        "Setup routing and navigation",
      ],
      dependencies: ["milestone_foundation"],
      validationCriteria: [
        "Core features implemented",
        "Data models working",
        "Primary user flows functional",
      ],
      status: "pending",
    } as ProjectMilestone);

    // Milestone 3: Secondary Features
    milestones.push({
      milestoneId: `milestone_secondary`,
      description: "Secondary Features",
      sdlcPhase: SDLCPhase.IMPLEMENTATION,
      tasks: [
        "Implement secondary features",
        "Add integrations",
        "Setup authentication",
        "Implement user preferences",
      ],
      dependencies: ["milestone_core"],
      validationCriteria: [
        "Secondary features implemented",
        "Integrations working",
        "Authentication functional",
      ],
      status: "pending",
    } as ProjectMilestone);

    // Milestone 4: Testing
    if (this.config.requireTests) {
      milestones.push({
        milestoneId: `milestone_testing`,
        description: "Testing & Validation",
        sdlcPhase: SDLCPhase.TESTING,
        tasks: [
          "Write unit tests",
          "Write integration tests",
          "Write E2E tests",
          "Setup test infrastructure",
          "Run test suite",
        ],
        dependencies: ["milestone_secondary"],
        validationCriteria: [
          "Unit tests passing",
          "Integration tests passing",
          "E2E tests passing",
          "Test coverage >= 80%",
        ],
        status: "pending",
      } as ProjectMilestone);
    }

    // Milestone 5: Optimization
    if (this.config.enableContinuousImprovement) {
      milestones.push({
        milestoneId: `milestone_optimization`,
        description: "Performance Optimization",
        sdlcPhase: SDLCPhase.OPTIMIZATION,
        tasks: [
          "Optimize bundle size",
          "Improve load time",
          "Optimize database queries",
          "Setup caching",
          "Performance testing",
        ],
        dependencies: ["milestone_testing"],
        validationCriteria: [
          "Bundle size optimized",
          "Load time < 3s",
          "Database queries optimized",
          "Caching working",
        ],
        status: "pending",
      } as ProjectMilestone);
    }

    // Milestone 6: Documentation
    if (this.config.requireDocumentation) {
      milestones.push({
        milestoneId: `milestone_documentation`,
        description: "Documentation",
        sdlcPhase: SDLCPhase.DOCUMENTATION,
        tasks: [
          "Write API documentation",
          "Write setup guide",
          "Write deployment guide",
          "Write architecture documentation",
          "Add inline code comments",
        ],
        dependencies: ["milestone_optimization"],
        validationCriteria: [
          "API documentation complete",
          "Setup guide written",
          "Deployment guide written",
          "Architecture documented",
        ],
        status: "pending",
      } as ProjectMilestone);
    }

    // Milestone 7: Deployment Preparation
    if (this.config.prepareDeployment) {
      milestones.push({
        milestoneId: `milestone_deployment`,
        description: "Deployment Preparation",
        sdlcPhase: SDLCPhase.DEPLOYMENT_PREPARATION,
        tasks: [
          "Setup environment variables",
          "Configure production build",
          "Add health checks",
          "Setup error tracking",
          "Configure logging",
          "Security audit",
        ],
        dependencies: ["milestone_documentation"],
        validationCriteria: [
          "Environment variables configured",
          "Production build working",
          "Health checks passing",
          "Error tracking setup",
          "Security audit passed",
        ],
        status: "pending",
      } as ProjectMilestone);
    }

    this.currentProject.milestones = milestones;
    this.currentProject.currentPhase = SDLCPhase.PROJECT_BREAKDOWN;

    logInfo("SDLC", `Project breakdown complete: ${milestones.length} milestones`);
  }

  /**
   * Get current project
   */
  getCurrentProject(): SDLCProject | null {
    return this.currentProject;
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): SDLCPhase | null {
    return this.currentProject?.currentPhase || null;
  }

  /**
   * Advance to next phase
   */
  advancePhase(): SDLCPhase | null {
    if (!this.currentProject) return null;

    const phases = Object.values(SDLCPhase);
    const currentIndex = phases.indexOf(this.currentProject.currentPhase);

    if (currentIndex >= phases.length - 1) {
      // Project completed
      this.currentProject.status = "completed";
      this.currentProject.completedAt = new Date();
      return null;
    }

    this.currentProject.currentPhase = phases[currentIndex + 1];
    return this.currentProject.currentPhase;
  }

  /**
   * Helper: Extract business goal
   */
  private extractBusinessGoal(userRequest: string): string {
    // Simple extraction (can be enhanced with NLP)
    return userRequest;
  }

  /**
   * Helper: Identify target users
   */
  private identifyTargetUsers(requestLower: string): string[] {
    const users: string[] = [];

    if (requestLower.includes("business") || requestLower.includes("enterprise")) {
      users.push("business_users");
    }
    if (requestLower.includes("consumer") || requestLower.includes("personal")) {
      users.push("consumers");
    }
    if (requestLower.includes("admin") || requestLower.includes("manager")) {
      users.push("administrators");
    }
    if (requestLower.includes("developer") || requestLower.includes("dev")) {
      users.push("developers");
    }

    return users.length > 0 ? users : ["general_users"];
  }

  /**
   * Helper: Detect platform
   */
  private detectPlatform(requestLower: string): string[] {
    const platforms: string[] = [];

    if (requestLower.includes("web") || requestLower.includes("website")) {
      platforms.push("web");
    }
    if (requestLower.includes("mobile") || requestLower.includes("ios") || requestLower.includes("android")) {
      platforms.push("mobile");
    }
    if (requestLower.includes("desktop") || requestLower.includes("electron")) {
      platforms.push("desktop");
    }
    if (requestLower.includes("api") || requestLower.includes("backend")) {
      platforms.push("api");
    }
    if (requestLower.includes("cli")) {
      platforms.push("cli");
    }

    return platforms.length > 0 ? platforms : ["web"];
  }

  /**
   * Helper: Extract technology preferences
   */
  private extractTechnologyPreferences(requestLower: string): string[] {
    const technologies: string[] = [];

    const techKeywords = [
      "react", "next.js", "vue", "angular", "svelte",
      "node", "express", "fastify", "nest",
      "python", "django", "fastapi", "flask",
      "go", "rust", "java", "c#",
      "postgresql", "mysql", "mongodb", "redis",
      "docker", "kubernetes", "aws", "vercel",
    ];

    for (const tech of techKeywords) {
      if (requestLower.includes(tech)) {
        technologies.push(tech);
      }
    }

    return technologies;
  }

  /**
   * Helper: Determine security requirements
   */
  private determineSecurityRequirements(requestLower: string): RequirementAnalysis["securityRequirements"] {
    const needsAuth = requestLower.includes("login") || requestLower.includes("auth") || requestLower.includes("user");

    return {
      authentication: needsAuth,
      authorization: needsAuth,
      dataEncryption: requestLower.includes("sensitive") || requestLower.includes("payment"),
      compliance: requestLower.includes("gdpr") ? ["GDPR"] : undefined,
    };
  }

  /**
   * Helper: Determine deployment requirements
   */
  private determineDeploymentRequirements(requestLower: string): RequirementAnalysis["deploymentRequirements"] {
    return {
      targetEnvironment: requestLower.includes("cloud") ? "cloud" : "on-premise",
      scalingRequirements: requestLower.includes("scale") ? "auto" : "vertical",
      monitoringRequired: true,
    };
  }

  /**
   * Helper: Determine scalability requirements
   */
  private determineScalabilityRequirements(requestLower: string): RequirementAnalysis["scalabilityRequirements"] {
    return {
      expectedGrowth: requestLower.includes("startup") || requestLower.includes("scale") ? "high" : "medium",
      multiTenantRequired: requestLower.includes("saas") || requestLower.includes("multi-tenant"),
      internationalizationRequired: requestLower.includes("i18n") || requestLower.includes("international"),
    };
  }

  /**
   * Helper: Choose frontend technology
   */
  private chooseFrontend(projectType: string, requirements: RequirementAnalysis): ArchitectureDecision {
    const alternatives = ["React", "Vue", "Angular", "Svelte"];

    // Default to Next.js for web apps
    let technology = "Next.js";
    let reasoning = "Next.js provides SSR, routing, and API routes out of the box";

    if (requirements.technology?.includes("react")) {
      technology = "React + Vite";
      reasoning = "React explicitly requested, Vite for fast development";
    } else if (requirements.technology?.includes("vue")) {
      technology = "Vue 3 + Vite";
      reasoning = "Vue explicitly requested";
    } else if (projectType === "portfolio") {
      technology = "Astro";
      reasoning = "Astro optimal for static portfolios with excellent performance";
    }

    return {
      component: "frontend",
      technology,
      alternatives,
      reasoning,
      tradeOffs: ["SSR vs CSR", "Bundle size", "Learning curve"],
    };
  }

  /**
   * Helper: Choose backend technology
   */
  private chooseBackend(projectType: string, requirements: RequirementAnalysis): ArchitectureDecision {
    const alternatives = ["Express", "Fastify", "NestJS", "Hono"];

    let technology = "Express";
    let reasoning = "Express is mature, well-documented, and widely adopted";

    if (requirements.technology?.includes("fastify")) {
      technology = "Fastify";
      reasoning = "Fastify explicitly requested, superior performance";
    } else if (requirements.technology?.includes("nest")) {
      technology = "NestJS";
      reasoning = "NestJS explicitly requested, enterprise-grade architecture";
    } else if (projectType === "api") {
      technology = "Fastify";
      reasoning = "Fastify optimal for API services with high performance";
    }

    return {
      component: "backend",
      technology,
      alternatives,
      reasoning,
      tradeOffs: ["Performance vs ecosystem", "TypeScript support", "Learning curve"],
    };
  }

  /**
   * Helper: Choose database
   */
  private chooseDatabase(projectType: string, requirements: RequirementAnalysis): ArchitectureDecision {
    const alternatives = ["PostgreSQL", "MySQL", "MongoDB", "SQLite"];

    let technology = "PostgreSQL";
    let reasoning = "PostgreSQL provides ACID compliance, JSON support, and excellent performance";

    if (requirements.technology?.includes("mongodb")) {
      technology = "MongoDB";
      reasoning = "MongoDB explicitly requested, flexible schema";
    } else if (projectType === "portfolio" || projectType === "cli") {
      technology = "SQLite";
      reasoning = "SQLite sufficient for simple projects, zero configuration";
    }

    return {
      component: "database",
      technology,
      alternatives,
      reasoning,
      tradeOffs: ["SQL vs NoSQL", "Scaling strategy", "Operational complexity"],
    };
  }

  /**
   * Helper: Choose authentication
   */
  private chooseAuthentication(requirements: RequirementAnalysis): ArchitectureDecision {
    const alternatives = ["NextAuth", "Clerk", "Auth0", "Custom JWT"];

    if (!requirements.securityRequirements?.authentication) {
      return {
        component: "authentication",
        technology: "None",
        alternatives,
        reasoning: "Authentication not required for this project",
        tradeOffs: [],
      };
    }

    return {
      component: "authentication",
      technology: "NextAuth",
      alternatives,
      reasoning: "NextAuth provides OAuth, email/password, and session management",
      tradeOffs: ["Vendor lock-in", "Customization complexity", "Cost"],
    };
  }

  /**
   * Helper: Choose deployment
   */
  private chooseDeployment(requirements: RequirementAnalysis): ArchitectureDecision {
    const alternatives = ["Vercel", "AWS", "Railway", "DigitalOcean"];

    let technology = "Vercel";
    let reasoning = "Vercel provides seamless deployment for Next.js and frontend apps";

    if (requirements.deploymentRequirements?.targetEnvironment === "on-premise") {
      technology = "Docker + Kubernetes";
      reasoning = "On-premise deployment requires containerization";
    }

    return {
      component: "deployment",
      technology,
      alternatives,
      reasoning,
      tradeOffs: ["Cost", "Scalability", "Vendor lock-in"],
    };
  }

  /**
   * Helper: Choose monitoring
   */
  private chooseMonitoring(_requirements: RequirementAnalysis): ArchitectureDecision {
    const alternatives = ["Sentry", "Datadog", "New Relic", "OpenTelemetry"];

    return {
      component: "monitoring",
      technology: "Sentry",
      alternatives,
      reasoning: "Sentry provides error tracking and performance monitoring",
      tradeOffs: ["Cost", "Data privacy", "Integration complexity"],
    };
  }

  /**
   * Helper: Choose logging
   */
  private chooseLogging(_requirements: RequirementAnalysis): ArchitectureDecision {
    const alternatives = ["Winston", "Pino", "Bunyan", "Console"];

    return {
      component: "logging",
      technology: "Pino",
      alternatives,
      reasoning: "Pino provides high-performance structured logging",
      tradeOffs: ["Performance vs features", "Log aggregation"],
    };
  }

  /**
   * Helper: Extract project name
   */
  private extractProjectName(userRequest: string): string {
    // Simple extraction (can be enhanced)
    const words = userRequest.split(" ").slice(0, 3);
    return words.join("-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  }
}

/**
 * Singleton instance
 */
let globalSDLCEngine: SDLCEngine | null = null;

export function getSDLCEngine(config: SDLCConfig = {}): SDLCEngine {
  if (!globalSDLCEngine) {
    globalSDLCEngine = new SDLCEngine(config);
  }
  return globalSDLCEngine;
}

export function resetSDLCEngine(): void {
  globalSDLCEngine = null;
}
