/**
 * Execution Verification System — Zero Simulation Policy
 *
 * Ensures every claimed action was actually executed:
 * - Files mentioned must exist
 * - Commands mentioned must have been run
 * - Dependencies mentioned must be installed
 * - Builds mentioned must have succeeded
 * - Validations mentioned must have passed
 *
 * This system audits execution claims against actual evidence,
 * preventing the LLM from simulating or pretending work was done.
 *
 * Enforced Rules:
 * 1. No fake file generation in chat
 * 2. No simulated command execution
 * 3. No claims without evidence
 * 4. No partial completion reporting
 * 5. No placeholder TODOs in "complete" projects
 */

import * as fs from "fs";
import * as path from "path";
import {
  getExecutionMemoryManager,
} from "./execution-memory";

export interface ExecutionEvidence {
  /** Files that were claimed to be created */
  claimedFiles: string[];
  /** Files that actually exist */
  existingFiles: string[];
  /** Commands that were claimed to run */
  claimedCommands: string[];
  /** Commands that actually executed */
  executedCommands: string[];
  /** Dependencies that were claimed installed */
  claimedDependencies: string[];
  /** Dependencies that are actually installed */
  installedDependencies: string[];
  /** Build was claimed successful */
  claimedBuildSuccess: boolean;
  /** Build actually succeeded */
  actualBuildSuccess: boolean;
}

export interface VerificationResult {
  /** Whether all claims are backed by evidence */
  verified: boolean;
  /** Missing files (claimed but don't exist) */
  missingFiles: string[];
  /** Missing commands (claimed but didn't run) */
  missingCommands: string[];
  /** Missing dependencies (claimed but not installed) */
  missingDependencies: string[];
  /** Build verification failed */
  buildVerificationFailed: boolean;
  /** Warnings about potential simulation */
  warnings: string[];
  /** Evidence summary */
  evidence: ExecutionEvidence;
}

/**
 * Verify execution claims against actual evidence
 *
 * This is the core of the zero simulation policy.
 * It checks that every claim made during execution
 * is backed by actual evidence.
 */
export function verifyExecution(
  workspaceRoot: string,
  claims: {
    files?: string[];
    commands?: string[];
    dependencies?: string[];
    buildSuccess?: boolean;
  },
): VerificationResult {
  const memoryManager = getExecutionMemoryManager();
  const memory = memoryManager.getMemory();

  const evidence: ExecutionEvidence = {
    claimedFiles: claims.files || [],
    existingFiles: [],
    claimedCommands: claims.commands || [],
    executedCommands: memory?.commandsExecuted || [],
    claimedDependencies: claims.dependencies || [],
    installedDependencies: memory?.dependenciesInstalled || [],
    claimedBuildSuccess: claims.buildSuccess || false,
    actualBuildSuccess: false,
  };

  // Check which claimed files actually exist
  for (const filePath of evidence.claimedFiles) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
    if (fs.existsSync(fullPath)) {
      evidence.existingFiles.push(filePath);
    }
  }

  // Check which claimed commands actually executed
  const executedCommands = evidence.executedCommands;
  const missingCommands = evidence.claimedCommands.filter(claimed =>
    !executedCommands.some(executed => executed.includes(claimed) || claimed.includes(executed))
  );

  // Check which claimed dependencies were actually installed
  const installedDeps = evidence.installedDependencies.join(" ");
  const missingDependencies = evidence.claimedDependencies.filter(dep =>
    !installedDeps.includes(dep)
  );

  // Check build status from validation results
  const buildResults = memory?.validationResults.filter(r => r.type === "build") || [];
  const lastBuildResult = buildResults[buildResults.length - 1];
  evidence.actualBuildSuccess = lastBuildResult?.success || false;

  // Generate missing files list
  const missingFiles = evidence.claimedFiles.filter(f => !evidence.existingFiles.includes(f));

  // Generate warnings
  const warnings: string[] = [];

  if (missingFiles.length > 0) {
    warnings.push(`⚠ CLAIMED FILES NOT FOUND: ${missingFiles.join(", ")}`);
    warnings.push("  These files were mentioned but don't exist in the workspace.");
    warnings.push("  This suggests simulation rather than real execution.");
  }

  if (missingCommands.length > 0) {
    warnings.push(`⚠ CLAIMED COMMANDS NOT EXECUTED: ${missingCommands.join(", ")}`);
    warnings.push("  These commands were claimed but don't appear in execution history.");
    warnings.push("  Shell commands must actually run to be valid.");
  }

  if (missingDependencies.length > 0) {
    warnings.push(`⚠ CLAIMED DEPENDENCIES NOT INSTALLED: ${missingDependencies.join(", ")}`);
    warnings.push("  These packages were claimed installed but weren't tracked.");
    warnings.push("  Dependencies must be installed via package manager commands.");
  }

  if (evidence.claimedBuildSuccess && !evidence.actualBuildSuccess) {
    warnings.push("⚠ BUILD SUCCESS CLAIMED BUT NOT VERIFIED");
    warnings.push("  Build must actually succeed before claiming project completion.");
  }

  // Check for placeholder code or TODO stubs
  const placeholderWarnings = checkForPlaceholders(workspaceRoot, evidence.existingFiles);
  warnings.push(...placeholderWarnings);

  const verified =
    missingFiles.length === 0 &&
    missingCommands.length === 0 &&
    missingDependencies.length === 0 &&
    (!evidence.claimedBuildSuccess || evidence.actualBuildSuccess) &&
    warnings.length === 0;

  return {
    verified,
    missingFiles,
    missingCommands,
    missingDependencies,
    buildVerificationFailed: evidence.claimedBuildSuccess && !evidence.actualBuildSuccess,
    warnings,
    evidence,
  };
}

/**
 * Check files for placeholder code or TODO stubs
 *
 * A project with TODOs, placeholders, or "implement this" comments
 * is not complete and should not be reported as such.
 */
function checkForPlaceholders(
  workspaceRoot: string,
  files: string[],
): string[] {
  const warnings: string[] = [];
  const placeholderPatterns = [
    /TODO[:\s]/i,
    /FIXME[:\s]/i,
    /HACK[:\s]/i,
    /implement this/i,
    /add your code here/i,
    /placeholder/i,
    /stub/i,
    /coming soon/i,
    /work in progress/i,
  ];

  // Check a sample of files (not all, to avoid performance issues)
  const sampleFiles = files.slice(-10); // Check last 10 files

  for (const filePath of sampleFiles) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);

    try {
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const pattern of placeholderPatterns) {
          if (pattern.test(line)) {
            // Skip legitimate comments in non-generated files
            if (line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*")) {
              warnings.push(`⚠ PLACEHOLDER in ${filePath}:${i + 1}: ${line.trim()}`);
            }
            break;
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return warnings;
}

/**
 * Self-audit during execution
 *
 * Called after every task to verify:
 * - Did execution really happen?
 * - Were files actually created?
 * - Did shell actually execute?
 * - Did validation actually pass?
 * - Is there evidence?
 */
export function selfAuditExecution(): VerificationResult | null {
  const memoryManager = getExecutionMemoryManager();
  const memory = memoryManager.getMemory();

  if (!memory) {
    return null;
  }

  // Only audit when in executing, validating, or repairing state
  if (!["executing", "validating", "repairing"].includes(memory.state)) {
    return null;
  }

  // Get current workspace root (from memory or default)
  const workspaceRoot = process.cwd();

  // Verify claims based on completed tasks
  const claimedFiles = memory.filesCreated;
  const claimedCommands = memory.commandsExecuted;
  const claimedDependencies = memory.dependenciesInstalled;

  const verification = verifyExecution(workspaceRoot, {
    files: claimedFiles,
    commands: claimedCommands,
    dependencies: claimedDependencies,
    buildSuccess: memory.validationResults.some(r => r.type === "build" && r.success),
  });

  // Log audit results
  if (!verification.verified) {
    console.error("[Self-Audit] ❌ VERIFICATION FAILED");
    console.error(`[Self-Audit] Missing files: ${verification.missingFiles.length}`);
    console.error(`[Self-Audit] Missing commands: ${verification.missingCommands.length}`);
    console.error(`[Self-Audit] Missing dependencies: ${verification.missingDependencies.length}`);
    console.error(`[Self-Audit] Warnings: ${verification.warnings.length}`);

    for (const warning of verification.warnings) {
      console.error(`[Self-Audit] ${warning}`);
    }
  } else {
    console.log("[Self-Audit] ✅ All execution verified");
  }

  return verification;
}

/**
 * Enforce zero simulation policy
 *
 * Scans LLM response for claims that require execution evidence.
 * If evidence is missing, blocks the response and forces real execution.
 */
export function enforceZeroSimulationPolicy(
  response: string,
  workspaceRoot: string,
): { allowed: boolean; reason?: string } {
  // Extract file claims from response
  const fileClaims = extractFileClaims(response);
  const commandClaims = extractCommandClaims(response);
  const dependencyClaims = extractDependencyClaims(response);
  const buildClaims = extractBuildClaims(response);

  // If no execution claims, allow response (it's probably just conversation)
  if (
    fileClaims.length === 0 &&
    commandClaims.length === 0 &&
    dependencyClaims.length === 0 &&
    !buildClaims
  ) {
    return { allowed: true };
  }

  // Verify execution claims
  const verification = verifyExecution(workspaceRoot, {
    files: fileClaims,
    commands: commandClaims,
    dependencies: dependencyClaims,
    buildSuccess: buildClaims,
  });

  if (!verification.verified) {
    const reason = [
      "❌ ZERO SIMULATION POLICY VIOLATION",
      "",
      "The following claims lack execution evidence:",
      "",
      ...verification.warnings,
      "",
      "ACTION REQUIRED:",
      "- Execute actual tools to create files",
      "- Run actual commands via shell tool",
      "- Install actual dependencies via package manager",
      "- Run actual build validation",
      "",
      "Do not simulate work. Execute it.",
    ].join("\n");

    return { allowed: false, reason };
  }

  return { allowed: true };
}

/**
 * Extract file claims from LLM response
 */
function extractFileClaims(response: string): string[] {
  const files: string[] = [];

  // Match "Created file: path/to/file" patterns
  const createdFilePattern = /created\s+(?:file|files)[\s:]+([^\n]+)/gi;
  let match;
  while ((match = createdFilePattern.exec(response)) !== null) {
    const filePath = match[1].trim();
    if (filePath && !filePath.includes("\n")) {
      files.push(filePath);
    }
  }

  // Match "File: path/to/file" patterns
  const filePattern = /file[\s:]+([^\n]+\.\w+)/gi;
  while ((match = filePattern.exec(response)) !== null) {
    const filePath = match[1].trim();
    if (filePath && filePath.includes(".")) {
      files.push(filePath);
    }
  }

  return files;
}

/**
 * Extract command claims from LLM response
 */
function extractCommandClaims(response: string): string[] {
  const commands: string[] = [];

  // Match command patterns
  const commandPatterns = [
    /ran\s+command[\s:]+([^\n]+)/gi,
    /executed[\s:]+([^\n]+)/gi,
    /npm\s+(install|create|run)[^\n]*/gi,
    /yarn\s+(add|create|run)[^\n]*/gi,
    /pnpm\s+(install|create|run)[^\n]*/gi,
    /bun\s+(install|create|run)[^\n]*/gi,
    /git\s+[^\n]*/gi,
  ];

  for (const pattern of commandPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const command = match[0].trim();
      if (command) {
        commands.push(command);
      }
    }
  }

  return commands;
}

/**
 * Extract dependency claims from LLM response
 */
function extractDependencyClaims(response: string): string[] {
  const dependencies: string[] = [];

  // Match "installed X" patterns
  const installPattern = /installed\s+([^\n]+)/gi;
  let match;
  while ((match = installPattern.exec(response)) !== null) {
    const deps = match[1].trim();
    if (deps) {
      dependencies.push(...deps.split(/[,\s]+/).filter(d => d.length > 0));
    }
  }

  return dependencies;
}

/**
 * Extract build claims from LLM response
 */
function extractBuildClaims(response: string): boolean {
  const buildPatterns = [
    /build\s+(successful|succeeded|passed)/gi,
    /successfully\s+built/gi,
    /build\s+complete/gi,
    /compilation\s+successful/gi,
  ];

  for (const pattern of buildPatterns) {
    if (pattern.test(response)) {
      return true;
    }
  }

  return false;
}
