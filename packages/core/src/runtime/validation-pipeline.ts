/**
 * Validation Pipeline & Self-Repair Loop — Architecture Migration Component
 *
 * After project generation or code modifications:
 * 1. Run installation (if dependencies changed)
 * 2. Run build/typecheck
 * 3. Run lint
 * 4. Run tests (if available)
 * 5. If failures occur, automatically repair them
 * 6. Retry until successful or iteration limit reached
 */

export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;
  /** Phase that failed (install, build, lint, test) */
  failedPhase?: 'install' | 'build' | 'lint' | 'test';
  /** Error messages from failed phase */
  errors: string[];
  /** Output from validation commands */
  output: string;
  /** Files that need repair */
  filesToRepair: string[];
}

export interface SelfRepairConfig {
  /** Maximum number of repair iterations */
  maxIterations: number;
  /** Whether to run typecheck */
  runTypecheck: boolean;
  /** Whether to run lint */
  runLint: boolean;
  /** Whether to run tests */
  runTests: boolean;
  /** Timeout for each command (ms) */
  commandTimeoutMs: number;
}

export const DEFAULT_REPAIR_CONFIG: SelfRepairConfig = {
  maxIterations: 5,
  runTypecheck: true,
  runLint: true,
  runTests: false, // Only run if tests exist
  commandTimeoutMs: 120000, // 2 minutes
};

/**
 * Validation phases in execution order
 */
export const VALIDATION_PHASES = ['install', 'build', 'lint', 'test'] as const;

/**
 * Commands for each validation phase
 */
export const PHASE_COMMANDS: Record<string, string[]> = {
  install: ['npm install', 'npm install --legacy-peer-deps'],
  build: ['npm run build', 'tsc --noEmit'],
  lint: ['npm run lint', 'eslint . --fix'],
  test: ['npm test', 'npm run test'],
};

/**
 * Execute validation pipeline
 * Returns ValidationResult with success/failure details
 */
export async function executeValidationPipeline(
  cwd: string,
  runCommand: (command: string, options?: { timeoutMs?: number }) => Promise<{
    success: boolean;
    output: string;
    exitCode: number;
  }>,
  config: SelfRepairConfig = DEFAULT_REPAIR_CONFIG
): Promise<ValidationResult> {
  const errors: string[] = [];
  let output = '';
  let filesToRepair: string[] = [];

  // Phase 1: Install dependencies
  const installResult = await runPhase(
    'install',
    cwd,
    runCommand,
    config.commandTimeoutMs
  );
  output += installResult.output;

  if (!installResult.success) {
    errors.push(...installResult.errors);
    return {
      success: false,
      failedPhase: 'install',
      errors,
      output,
      filesToRepair: [],
    };
  }

  // Phase 2: Build/Typecheck
  if (config.runTypecheck) {
    const buildResult = await runPhase(
      'build',
      cwd,
      runCommand,
      config.commandTimeoutMs
    );
    output += buildResult.output;

    if (!buildResult.success) {
      errors.push(...buildResult.errors);
      filesToRepair = extractFilesFromErrors(buildResult.errors);
      return {
        success: false,
        failedPhase: 'build',
        errors,
        output,
        filesToRepair,
      };
    }
  }

  // Phase 3: Lint
  if (config.runLint) {
    const lintResult = await runPhase(
      'lint',
      cwd,
      runCommand,
      config.commandTimeoutMs
    );
    output += lintResult.output;

    if (!lintResult.success) {
      errors.push(...lintResult.errors);
      filesToRepair = extractFilesFromErrors(lintResult.errors);
      return {
        success: false,
        failedPhase: 'lint',
        errors,
        output,
        filesToRepair,
      };
    }
  }

  // Phase 4: Tests (optional)
  if (config.runTests) {
    const testResult = await runPhase(
      'test',
      cwd,
      runCommand,
      config.commandTimeoutMs
    );
    output += testResult.output;

    if (!testResult.success) {
      errors.push(...testResult.errors);
      filesToRepair = extractFilesFromErrors(testResult.errors);
      return {
        success: false,
        failedPhase: 'test',
        errors,
        output,
        filesToRepair,
      };
    }
  }

  return {
    success: true,
    errors: [],
    output,
    filesToRepair: [],
  };
}

/**
 * Run a single validation phase
 */
async function runPhase(
  phase: string,
  cwd: string,
  runCommand: (command: string, options?: { timeoutMs?: number }) => Promise<{
    success: boolean;
    output: string;
    exitCode: number;
  }>,
  timeoutMs: number
): Promise<{ success: boolean; errors: string[]; output: string }> {
  const commands = PHASE_COMMANDS[phase] || [];

  for (const command of commands) {
    try {
      const result = await runCommand(command, { timeoutMs });

      if (result.success) {
        return {
          success: true,
          errors: [],
          output: `[${phase}] ✔ ${command}\n${result.output}`,
        };
      }

      // Try next command in phase
      continue;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Continue to next command
    }
  }

  // All commands in phase failed
  return {
    success: false,
    errors: [`[${phase}] All commands failed`],
    output: `[${phase}] ✗ Failed`,
  };
}

/**
 * Extract file paths from error messages
 * Parses common error formats to identify files needing repair
 */
function extractFilesFromErrors(errors: string[]): string[] {
  const filePattern = /(?:at\s+)?(?:file:\/\/)?([^\s:]+:\d+:\d+)/g;
  const files = new Set<string>();

  for (const error of errors) {
    let match;
    while ((match = filePattern.exec(error)) !== null) {
      const filePath = match[1].split(':')[0];
      files.add(filePath);
    }
  }

  return Array.from(files);
}

/**
 * Self-repair loop
 * Attempts to fix build/lint/test failures automatically
 */
export async function executeSelfRepairLoop(
  cwd: string,
  validationResult: ValidationResult,
  repairFile: (filePath: string, errorContext: string) => Promise<boolean>,
  runCommand: (command: string, options?: { timeoutMs?: number }) => Promise<{
    success: boolean;
    output: string;
    exitCode: number;
  }>,
  config: SelfRepairConfig = DEFAULT_REPAIR_CONFIG
): Promise<{
  success: boolean;
  iterations: number;
  finalValidation: ValidationResult;
}> {
  let currentValidation = validationResult;
  let iteration = 0;

  while (iteration < config.maxIterations && !currentValidation.success) {
    iteration++;

    // Attempt to repair each failing file
    const repairResults = await Promise.all(
      currentValidation.filesToRepair.map(async (filePath) => {
        const errorContext = currentValidation.errors
          .filter(e => e.includes(filePath))
          .join('\n');

        return repairFile(filePath, errorContext);
      })
    );

    const allRepairsSuccessful = repairResults.every(r => r);

    if (!allRepairsSuccessful) {
      // Some repairs failed, don't retry validation
      return {
        success: false,
        iterations: iteration,
        finalValidation: currentValidation,
      };
    }

    // Re-run validation after repairs
    currentValidation = await executeValidationPipeline(
      cwd,
      runCommand,
      config
    );

    if (currentValidation.success) {
      break;
    }
  }

  return {
    success: currentValidation.success,
    iterations: iteration,
    finalValidation: currentValidation,
  };
}

/**
 * Build progress report for chat output
 * Shows checkmarks and summaries instead of source code
 */
export function buildProgressReport(
  phase: string,
  success: boolean,
  details?: string
): string {
  const icon = success ? '✔' : '✗';
  return `${icon} ${phase}${details ? `: ${details}` : ''}`;
}

/**
 * Format complete build summary
 */
export function formatBuildSummary(
  filesCreated: number,
  dependenciesInstalled: boolean,
  buildSuccess: boolean,
  validationSuccess: boolean,
  repairIterations: number = 0
): string {
  const lines = [
    buildProgressReport('Project scaffold generated', true),
    buildProgressReport(`${filesCreated} files created`, true),
    buildProgressReport('Dependencies installed', dependenciesInstalled),
    buildProgressReport('Build successful', buildSuccess),
  ];

  if (repairIterations > 0) {
    lines.push(
      buildProgressReport(
        `Self-repair completed`,
        true,
        `${repairIterations} iteration(s)`
      )
    );
  }

  lines.push(
    buildProgressReport('Validation completed', validationSuccess)
  );

  return lines.join('\n');
}
