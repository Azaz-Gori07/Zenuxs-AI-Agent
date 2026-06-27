/**
 * Engineering DNA — Permanent Behavior, Decision Making & Quality Standard
 *
 * This system permanently embeds engineering principles into Zenuxs' runtime,
 * ensuring every decision, implementation, and improvement reinforces
 * Zenuxs' identity as a production-grade autonomous engineering platform.
 *
 * Core Principles:
 * 1. Engineering Before Tokens — Optimize for correct execution, not quick replies
 * 2. Root Cause First — Solve problems permanently, never patch symptoms
 * 3. Systems Thinking — Improve systems, not isolated files
 * 4. Search Before Create — Reuse existing implementations
 * 5. Reuse Before Rewrite — Never replace working code unnecessarily
 * 6. No Duplication — Always integrate, never duplicate
 * 7. Zero Placeholders — Everything production-ready
 * 8. Validation First — Never trust generated code, always verify
 * 9. Self Repair — Failures expected, stopping is not
 * 10. Tool First — If a tool can do it, use the tool
 * 11. Automatic Improvement — Leave every subsystem better
 * 12. Long Term Thinking — Will this be good in one year?
 *
 * Enforcement:
 * - Quality gate validators (block low-quality implementations)
 * - Technical debt detection (find and fix debt automatically)
 * - Architecture discipline checker (ensure architectural integrity)
 * - Automatic improvement tracker (continuously enhance systems)
 */

import * as fs from "fs";
import * as path from "path";
import { logInfo, logWarn, logError } from "./logging";
import { getWorkspaceIndexer } from "./workspace-indexer";

export enum EngineeringPrinciple {
  ENGINEERING_BEFORE_TOKENS = "engineering_before_tokens",
  ROOT_CAUSE_FIRST = "root_cause_first",
  SYSTEMS_THINKING = "systems_thinking",
  SEARCH_BEFORE_CREATE = "search_before_create",
  REUSE_BEFORE_REWRITE = "reuse_before_rewrite",
  NO_DUPLICATION = "no_duplication",
  ZERO_PLACEHOLDERS = "zero_placeholders",
  VALIDATION_FIRST = "validation_first",
  SELF_REPAIR = "self_repair",
  TOOL_FIRST = "tool_first",
  AUTOMATIC_IMPROVEMENT = "automatic_improvement",
  LONG_TERM_THINKING = "long_term_thinking",
}

export interface QualityGate {
  /** Gate name */
  name: string;
  /** Whether gate passed */
  passed: boolean;
  /** Violations found */
  violations: QualityViolation[];
  /** Recommendations */
  recommendations: string[];
}

export interface QualityViolation {
  /** Severity level */
  severity: "critical" | "warning" | "info";
  /** Violation type */
  type: string;
  /** File path */
  file: string;
  /** Line number */
  line?: number;
  /** Description */
  description: string;
  /** Suggested fix */
  fix?: string;
}

export interface TechnicalDebt {
  /** Debt type */
  type: "duplicate_code" | "dead_code" | "weak_typing" | "magic_values" | "unused_import" | "unsafe_cast" | "silent_failure";
  /** Location */
  file: string;
  /** Line number */
  line?: number;
  /** Description */
  description: string;
  /** Estimated effort to fix (minutes) */
  effortMinutes: number;
  /** Impact if not fixed */
  impact: "low" | "medium" | "high" | "critical";
}

export interface ArchitectureDecision {
  /** Decision description */
  decision: string;
  /** Rationale */
  rationale: string;
  /** Alternatives considered */
  alternatives: string[];
  /** Trade-offs */
  tradeOffs: string[];
  /** Compatibility impact */
  compatibilityImpact: "none" | "minor" | "major" | "breaking";
  /** Reliability impact */
  reliabilityImpact: "improves" | "neutral" | "degrades";
  /** Complexity impact */
  complexityImpact: "reduces" | "neutral" | "increases";
  /** Extensibility impact */
  extensibilityImpact: "improves" | "neutral" | "degrades";
}

export interface ImprovementOpportunity {
  /** Subsystem name */
  subsystem: string;
  /** Improvement type */
  type: "error_handling" | "logging" | "validation" | "performance" | "architecture" | "developer_experience";
  /** Description */
  description: string;
  /** Effort required */
  effort: "low" | "medium" | "high";
  /** Impact */
  impact: "low" | "medium" | "high";
  /** Recommendation */
  recommendation: string;
}

export interface EngineeringDNAConfig {
  /** Whether to enforce quality gates */
  enforceQualityGates?: boolean;
  /** Whether to detect technical debt */
  detectTechnicalDebt?: boolean;
  /** Whether to validate architecture decisions */
  validateArchitecture?: boolean;
  /** Whether to track improvement opportunities */
  trackImprovements?: boolean;
  /** Maximum acceptable technical debt count */
  maxTechnicalDebt?: number;
  /** Whether to block on critical violations */
  blockOnCritical?: boolean;
}

const DEFAULT_CONFIG: Required<EngineeringDNAConfig> = {
  enforceQualityGates: true,
  detectTechnicalDebt: true,
  validateArchitecture: true,
  trackImprovements: true,
  maxTechnicalDebt: 0,
  blockOnCritical: true,
};

/**
 * Engineering DNA Enforcement System
 */
export class EngineeringDNA {
  private config: Required<EngineeringDNAConfig>;
  private qualityGates: Map<string, QualityGate> = new Map();
  private technicalDebt: TechnicalDebt[] = [];
  private architectureDecisions: ArchitectureDecision[] = [];
  private improvementOpportunities: ImprovementOpportunity[] = [];

  constructor(config: EngineeringDNAConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // PRINCIPLE 1: Engineering Before Tokens
  // ===========================================================================

  /**
   * Validate that implementation prioritizes engineering over conversation
   */
  validateEngineeringFirst(execution: {
    hasRealExecution: boolean;
    hasValidation: boolean;
    hasQualityChecks: boolean;
    codeBlocksInResponse: number;
  }): QualityGate {
    const violations: QualityViolation[] = [];
    const recommendations: string[] = [];

    if (!execution.hasRealExecution) {
      violations.push({
        severity: "critical",
        type: "no_real_execution",
        file: "",
        description: "Response contains simulated execution instead of real tool usage",
        fix: "Use actual tools to execute filesystem, shell, and validation operations",
      });
    }

    if (!execution.hasValidation) {
      violations.push({
        severity: "warning",
        type: "no_validation",
        file: "",
        description: "No validation performed after implementation",
        fix: "Run build, lint, typecheck, and tests after every change",
      });
    }

    if (execution.codeBlocksInResponse > 3) {
      recommendations.push(
        "Large code blocks in responses indicate tool-first principle violation. Use tools to create files instead.",
      );
    }

    return {
      name: "Engineering Before Tokens",
      passed: violations.filter((v) => v.severity === "critical").length === 0,
      violations,
      recommendations,
    };
  }

  // ===========================================================================
  // PRINCIPLE 2: Root Cause First
  // ===========================================================================

  /**
   * Analyze failure to identify root cause, not symptoms
   */
  analyzeRootCause(error: Error, context: Record<string, unknown>): {
    rootCause: string;
    subsystem: string;
    permanentFix: string;
    temporaryWorkaround?: string;
  } {
    const message = error.message.toLowerCase();

    // Identify subsystem
    let subsystem = "unknown";
    if (message.includes("file") || message.includes("fs")) {
      subsystem = "filesystem";
    } else if (message.includes("shell") || message.includes("command")) {
      subsystem = "shell";
    } else if (message.includes("build") || message.includes("compile")) {
      subsystem = "build";
    } else if (message.includes("import") || message.includes("module")) {
      subsystem = "module_resolution";
    } else if (message.includes("type") || message.includes("ts")) {
      subsystem = "type_system";
    }

    // Identify root cause patterns
    const rootCauses: Record<string, string> = {
      enoent: "File or directory does not exist — workspace structure mismatch",
      eacces: "Permission denied — incorrect file permissions or ownership",
      econnrefused: "Connection refused — service not running or wrong port",
      "not found": "Dependency or command not installed — environment setup incomplete",
      "type error": "Type mismatch — weak type definitions or incorrect usage",
      "missing import": "Import not found — module path incorrect or dependency missing",
      "build failed": "Build configuration error — webpack/vite/tsconfig misconfigured",
    };

    let rootCause = "Unknown root cause";
    let permanentFix = "Investigate and fix the underlying issue";

    for (const [pattern, cause] of Object.entries(rootCauses)) {
      if (message.includes(pattern)) {
        rootCause = cause;
        break;
      }
    }

    // Generate permanent fix based on subsystem
    const fixes: Record<string, string> = {
      filesystem: "Add workspace structure validation before file operations",
      shell: "Add command existence checks and environment validation",
      build: "Add build configuration validation and auto-repair",
      module_resolution: "Add import path validation and dependency verification",
      type_system: "Strengthen type definitions and add compile-time checks",
    };

    permanentFix = fixes[subsystem] || permanentFix;

    return {
      rootCause,
      subsystem,
      permanentFix,
    };
  }

  // ===========================================================================
  // PRINCIPLE 3: Systems Thinking
  // ===========================================================================

  /**
   * Validate that changes improve systems, not just files
   */
  validateSystemsThinking(change: {
    affectedFiles: string[];
    affectedSubsystems: string[];
    improvesArchitecture: boolean;
    reducesComplexity: boolean;
  }): QualityGate {
    const violations: QualityViolation[] = [];

    if (change.affectedFiles.length > 0 && change.affectedSubsystems.length === 0) {
      violations.push({
        severity: "warning",
        type: "file_level_thinking",
        file: "",
        description: "Changes affect files but not subsystems — consider system-level impact",
        fix: "Analyze which subsystems are affected and improve the system architecture",
      });
    }

    if (!change.improvesArchitecture && !change.reducesComplexity) {
      violations.push({
        severity: "info",
        type: "no_architectural_improvement",
        file: "",
        description: "Change does not improve architecture or reduce complexity",
        fix: "Consider how this change can improve the overall system architecture",
      });
    }

    return {
      name: "Systems Thinking",
      passed: violations.filter((v) => v.severity === "critical").length === 0,
      violations,
      recommendations: [
        "Think in terms of Runtime, Execution, Planner, Filesystem, Shell, Validation, Automation, Memory, Context, Sessions, Events, Tools",
        "Improve systems, not isolated files",
      ],
    };
  }

  // ===========================================================================
  // PRINCIPLE 4 & 5: Search Before Create & Reuse Before Rewrite
  // ===========================================================================

  /**
   * Search repository before creating new implementations
   */
  async searchBeforeCreate(
    workspaceRoot: string,
    implementation: {
      name: string;
      type: "function" | "class" | "service" | "tool" | "utility";
    },
  ): Promise<{
    exists: boolean;
    location?: string;
    canReuse: boolean;
    canExtend: boolean;
    recommendation: string;
  }> {
    const indexer = getWorkspaceIndexer();

    // Search for existing implementation
    const searchResults = indexer.findByPattern(implementation.name);

    if (searchResults.length > 0) {
      return {
        exists: true,
        location: searchResults[0],
        canReuse: true,
        canExtend: true,
        recommendation: `Implementation exists at ${searchResults[0]}. Reuse or extend it instead of creating new.`,
      };
    }

    // Search by type
    const typeResults = indexer.findByTag(implementation.type);
    if (typeResults.length > 0) {
      return {
        exists: true,
        location: typeResults[0],
        canReuse: false,
        canExtend: true,
        recommendation: `Similar ${implementation.type} exists at ${typeResults[0]}. Consider extending it.`,
      };
    }

    return {
      exists: false,
      canReuse: false,
      canExtend: false,
      recommendation: `No existing implementation found. Safe to create new ${implementation.type}.`,
    };
  }

  // ===========================================================================
  // PRINCIPLE 6: No Duplication
  // ===========================================================================

  /**
   * Detect duplicate code across the codebase
   */
  detectDuplication(workspaceRoot: string): TechnicalDebt[] {
    const debts: TechnicalDebt[] = [];

    // Simple duplicate detection (can be enhanced with AST analysis)
    const files = this.getAllFiles(workspaceRoot);
    const functionSignatures = new Map<string, string[]>();

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const functions = this.extractFunctionSignatures(content);

        for (const func of functions) {
          if (!functionSignatures.has(func)) {
            functionSignatures.set(func, []);
          }
          functionSignatures.get(func)!.push(file);
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Find duplicates
    for (const [signature, locations] of functionSignatures) {
      if (locations.length > 1) {
        debts.push({
          type: "duplicate_code",
          file: locations[1],
          description: `Duplicate function signature: ${signature}`,
          effortMinutes: 30,
          impact: "medium",
        });
      }
    }

    return debts;
  }

  // ===========================================================================
  // PRINCIPLE 7: Zero Placeholders
  // ===========================================================================

  /**
   * Detect placeholder code (TODO, FIXME, mock implementations)
   */
  detectPlaceholders(workspaceRoot: string): QualityViolation[] {
    const violations: QualityViolation[] = [];
    const files = this.getAllFiles(workspaceRoot, [".ts", ".tsx", ".js", ".jsx"]);

    const placeholderPatterns = [
      /TODO[:\s]/i,
      /FIXME[:\s]/i,
      /HACK[:\s]/i,
      /XXX[:\s]/i,
      /TEMPORARY/i,
      /MOCK\s+(implementation|function|class)/i,
      /FAKE\s+(implementation|function|class)/i,
      /PLACEHOLDER/i,
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of placeholderPatterns) {
            if (pattern.test(lines[i])) {
              violations.push({
                severity: "warning",
                type: "placeholder_code",
                file,
                line: i + 1,
                description: `Placeholder detected: ${lines[i].trim()}`,
                fix: "Implement production-ready code instead of placeholder",
              });
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return violations;
  }

  // ===========================================================================
  // PRINCIPLE 8: Validation First
  // ===========================================================================

  /**
   * Validate implementation quality
   */
  validateImplementation(workspaceRoot: string): QualityGate {
    const violations: QualityViolation[] = [];
    const recommendations: string[] = [];

    // Check for compilation errors
    const buildResult = this.runBuildCheck(workspaceRoot);
    if (!buildResult.success) {
      violations.push({
        severity: "critical",
        type: "build_failure",
        file: "",
        description: `Build failed: ${buildResult.error}`,
        fix: "Fix compilation errors before considering implementation complete",
      });
    }

    // Check for type errors
    const typeResult = this.runTypeCheck(workspaceRoot);
    if (!typeResult.success) {
      violations.push({
        severity: "critical",
        type: "type_errors",
        file: "",
        description: `Type check failed: ${typeResult.error}`,
        fix: "Fix type errors to ensure type safety",
      });
    }

    // Check for lint errors
    const lintResult = this.runLintCheck(workspaceRoot);
    if (!lintResult.success) {
      violations.push({
        severity: "warning",
        type: "lint_errors",
        file: "",
        description: `Lint check failed: ${lintResult.error}`,
        fix: "Fix lint errors to maintain code quality",
      });
    }

    return {
      name: "Validation First",
      passed: violations.filter((v) => v.severity === "critical").length === 0,
      violations,
      recommendations,
    };
  }

  // ===========================================================================
  // PRINCIPLE 11: Automatic Improvement
  // ===========================================================================

  /**
   * Identify improvement opportunities when touching subsystems
   */
  identifyImprovements(subsystem: string, workspaceRoot: string): ImprovementOpportunity[] {
    const improvements: ImprovementOpportunity[] = [];

    // Analyze subsystem for improvement opportunities
    const files = this.getSubsystemFiles(subsystem, workspaceRoot);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");

        // Check error handling
        if (!content.includes("try") && !content.includes("catch")) {
          improvements.push({
            subsystem,
            type: "error_handling",
            description: `File ${file} lacks error handling`,
            effort: "low",
            impact: "medium",
            recommendation: "Add try-catch blocks for robust error handling",
          });
        }

        // Check logging
        if (!content.includes("console.") && !content.includes("log")) {
          improvements.push({
            subsystem,
            type: "logging",
            description: `File ${file} lacks logging`,
            effort: "low",
            impact: "low",
            recommendation: "Add structured logging for observability",
          });
        }

        // Check validation
        if (!content.includes("validate") && !content.includes("assert")) {
          improvements.push({
            subsystem,
            type: "validation",
            description: `File ${file} lacks input validation`,
            effort: "medium",
            impact: "medium",
            recommendation: "Add input validation to prevent invalid state",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return improvements;
  }

  // ===========================================================================
  // PRINCIPLE 12: Long Term Thinking
  // ===========================================================================

  /**
   * Validate architecture decision for long-term viability
   */
  validateLongTermViability(decision: ArchitectureDecision): {
    viable: boolean;
    concerns: string[];
    recommendations: string[];
  } {
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Check compatibility impact
    if (decision.compatibilityImpact === "breaking") {
      concerns.push("Breaking change — ensure migration path exists");
      recommendations.push("Provide backward compatibility layer or migration guide");
    }

    // Check reliability impact
    if (decision.reliabilityImpact === "degrades") {
      concerns.push("Reliability degradation — reconsider implementation");
      recommendations.push("Find alternative that preserves or improves reliability");
    }

    // Check complexity impact
    if (decision.complexityImpact === "increases") {
      concerns.push("Increased complexity — justify with significant benefits");
      recommendations.push("Ensure complexity increase is justified by functionality gains");
    }

    // Check extensibility impact
    if (decision.extensibilityImpact === "degrades") {
      concerns.push("Reduced extensibility — may limit future growth");
      recommendations.push("Design for future extensibility even if not needed now");
    }

    return {
      viable: concerns.filter((c) => c.includes("reconsider")).length === 0,
      concerns,
      recommendations,
    };
  }

  // ===========================================================================
  // Technical Debt Detection
  // ===========================================================================

  /**
   * Scan codebase for technical debt
   */
  scanTechnicalDebt(workspaceRoot: string): TechnicalDebt[] {
    const debts: TechnicalDebt[] = [];

    // Detect duplicate code
    debts.push(...this.detectDuplication(workspaceRoot));

    // Detect dead code
    debts.push(...this.detectDeadCode(workspaceRoot));

    // Detect weak typing
    debts.push(...this.detectWeakTyping(workspaceRoot));

    // Detect magic values
    debts.push(...this.detectMagicValues(workspaceRoot));

    // Detect unused imports
    debts.push(...this.detectUnusedImports(workspaceRoot));

    this.technicalDebt = debts;
    return debts;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private getAllFiles(workspaceRoot: string, extensions?: string[]): string[] {
    const files: string[] = [];

    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules, .git, dist, build
            if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) {
              continue;
            }
            walk(fullPath);
          } else if (entry.isFile()) {
            if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    walk(workspaceRoot);
    return files;
  }

  private extractFunctionSignatures(content: string): string[] {
    const signatures: string[] = [];
    const functionPattern =
      /(export\s+)?(async\s+)?function\s+(\w+)\s*\([^)]*\)/g;
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      signatures.push(match[3]);
    }

    return signatures;
  }

  private runBuildCheck(workspaceRoot: string): { success: boolean; error?: string } {
    // Placeholder — would integrate with actual build system
    return { success: true };
  }

  private runTypeCheck(workspaceRoot: string): { success: boolean; error?: string } {
    // Placeholder — would integrate with TypeScript compiler
    return { success: true };
  }

  private runLintCheck(workspaceRoot: string): { success: boolean; error?: string } {
    // Placeholder — would integrate with ESLint
    return { success: true };
  }

  private getSubsystemFiles(subsystem: string, workspaceRoot: string): string[] {
    // Placeholder — would map subsystems to file paths
    return [];
  }

  private detectDeadCode(workspaceRoot: string): TechnicalDebt[] {
    // Placeholder — would use AST analysis
    return [];
  }

  private detectWeakTyping(workspaceRoot: string): TechnicalDebt[] {
    // Placeholder — would detect 'any' types
    return [];
  }

  private detectMagicValues(workspaceRoot: string): TechnicalDebt[] {
    // Placeholder — would detect hardcoded numbers/strings
    return [];
  }

  private detectUnusedImports(workspaceRoot: string): TechnicalDebt[] {
    // Placeholder — would detect unused imports
    return [];
  }
}

/**
 * Singleton instance
 */
let globalEngineeringDNA: EngineeringDNA | null = null;

export function getEngineeringDNA(config: EngineeringDNAConfig = {}): EngineeringDNA {
  if (!globalEngineeringDNA) {
    globalEngineeringDNA = new EngineeringDNA(config);
  }
  return globalEngineeringDNA;
}

export function resetEngineeringDNA(): void {
  globalEngineeringDNA = null;
}
