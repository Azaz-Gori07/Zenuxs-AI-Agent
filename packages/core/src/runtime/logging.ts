/**
 * Centralized Logging & Error Handling System
 *
 * Provides structured logging, error classification, and recovery guidance
 * across the entire Zenuxs runtime. Replaces scattered console.log/error calls
 * with a production-grade logging infrastructure.
 *
 * Capabilities:
 * - Structured logging with levels (debug, info, warn, error, fatal)
 * - Error classification (recoverable, unrecoverable, validation, tool, system)
 * - Automatic error context capture
 * - Recovery suggestion engine
 * - Log aggregation and filtering
 * - Performance timing
 * - Session-scoped log isolation
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export enum ErrorCategory {
  /** Error can be automatically recovered */
  RECOVERABLE = "recoverable",
  /** Error requires user intervention */
  UNRECOVERABLE = "unrecoverable",
  /** Validation failure (build, lint, test) */
  VALIDATION = "validation",
  /** Tool execution failure */
  TOOL = "tool",
  /** System/runtime error */
  SYSTEM = "system",
  /** Configuration error */
  CONFIG = "config",
  /** Filesystem error */
  FILESYSTEM = "filesystem",
  /** Network error */
  NETWORK = "network",
}

export interface LogEntry {
  /** Timestamp */
  timestamp: Date;
  /** Log level */
  level: LogLevel;
  /** Component that generated the log */
  component: string;
  /** Log message */
  message: string;
  /** Optional error object */
  error?: Error;
  /** Optional context data */
  context?: Record<string, unknown>;
  /** Session ID for log isolation */
  sessionId?: string;
}

export interface StructuredError {
  /** Error category */
  category: ErrorCategory;
  /** Error message */
  message: string;
  /** Original error */
  originalError?: Error;
  /** Stack trace */
  stack?: string;
  /** Recovery suggestions */
  recoverySuggestions: string[];
  /** Whether error is recoverable */
  isRecoverable: boolean;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Centralized logger for Zenuxs runtime
 */
class RuntimeLogger {
  private logs: LogEntry[] = [];
  private minLevel: LogLevel = LogLevel.INFO;
  private sessionId: string | null = null;
  private enableStructuredLogging: boolean = true;

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Set session ID for log isolation
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Enable/disable structured logging
   */
  setStructuredLogging(enabled: boolean): void {
    this.enableStructuredLogging = enabled;
  }

  /**
   * Log debug message
   */
  debug(component: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, component, message, undefined, context);
  }

  /**
   * Log info message
   */
  info(component: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, component, message, undefined, context);
  }

  /**
   * Log warning message
   */
  warn(component: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, component, message, undefined, context);
  }

  /**
   * Log error message
   */
  error(
    component: string,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.log(LogLevel.ERROR, component, message, error, context);
  }

  /**
   * Log fatal message (unrecoverable error)
   */
  fatal(
    component: string,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.log(LogLevel.FATAL, component, message, error, context);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    component: string,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      error,
      context,
      sessionId: this.sessionId || undefined,
    };

    this.logs.push(entry);

    // Output to console if structured logging enabled
    if (this.enableStructuredLogging) {
      this.outputLog(entry);
    }
  }

  /**
   * Output log to console with formatting
   */
  private outputLog(entry: LogEntry): void {
    const levelStr = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const sessionId = entry.sessionId ? `[${entry.sessionId}]` : "";

    const prefix = `[${timestamp}] ${sessionId} [${entry.component}] ${levelStr}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix}: ${entry.message}`, entry.context || "");
        break;
      case LogLevel.INFO:
        console.log(`${prefix}: ${entry.message}`, entry.context || "");
        break;
      case LogLevel.WARN:
        console.warn(`${prefix}: ${entry.message}`, entry.context || "");
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`${prefix}: ${entry.message}`, entry.error || "", entry.context || "");
        break;
    }
  }

  /**
   * Get logs for current session
   */
  getLogs(level?: LogLevel): LogEntry[] {
    let logs = this.logs;

    if (this.sessionId) {
      logs = logs.filter((l) => l.sessionId === this.sessionId);
    }

    if (level !== undefined) {
      logs = logs.filter((l) => l.level >= level);
    }

    return logs;
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get error summary
   */
  getErrorSummary(): {
    totalErrors: number;
    totalWarnings: number;
    categories: Record<ErrorCategory, number>;
    mostRecentError?: LogEntry;
  } {
    const errors = this.logs.filter((l) => l.level >= LogLevel.ERROR);
    const warnings = this.logs.filter((l) => l.level === LogLevel.WARN);

    const categories: Record<ErrorCategory, number> = {
      [ErrorCategory.RECOVERABLE]: 0,
      [ErrorCategory.UNRECOVERABLE]: 0,
      [ErrorCategory.VALIDATION]: 0,
      [ErrorCategory.TOOL]: 0,
      [ErrorCategory.SYSTEM]: 0,
      [ErrorCategory.CONFIG]: 0,
      [ErrorCategory.FILESYSTEM]: 0,
      [ErrorCategory.NETWORK]: 0,
    };

    // Count error categories from context
    for (const error of errors) {
      const category = error.context?.category as ErrorCategory | undefined;
      if (category && category in categories) {
        categories[category]++;
      }
    }

    return {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      categories,
      mostRecentError: errors[errors.length - 1],
    };
  }
}

/**
 * Error handler with classification and recovery suggestions
 */
class ErrorHandler {
  /**
   * Classify and wrap error with recovery suggestions
   */
  classifyError(error: unknown, context?: Record<string, unknown>): StructuredError {
    const originalError = error instanceof Error ? error : new Error(String(error));

    const category = this.categorizeError(originalError, context);
    const isRecoverable = this.isErrorRecoverable(category, originalError);
    const recoverySuggestions = this.getRecoverySuggestions(category, originalError, context);

    return {
      category,
      message: originalError.message,
      originalError,
      stack: originalError.stack,
      recoverySuggestions,
      isRecoverable,
      context,
    };
  }

  /**
   * Categorize error based on type and context
   */
  private categorizeError(error: Error, context?: Record<string, unknown>): ErrorCategory {
    const message = error.message.toLowerCase();

    // Check context for explicit category
    if (context?.category) {
      return context.category as ErrorCategory;
    }

    // Filesystem errors
    if (message.includes("enoent") || message.includes("eacces") || message.includes("eperm")) {
      return ErrorCategory.FILESYSTEM;
    }

    // Network errors
    if (message.includes("network") || message.includes("fetch") || message.includes("econnrefused")) {
      return ErrorCategory.NETWORK;
    }

    // Validation errors
    if (message.includes("build failed") || message.includes("type error") || message.includes("lint error")) {
      return ErrorCategory.VALIDATION;
    }

    // Tool errors
    if (message.includes("tool") || message.includes("execution")) {
      return ErrorCategory.TOOL;
    }

    // Config errors
    if (message.includes("configuration") || message.includes("config") || message.includes("missing")) {
      return ErrorCategory.CONFIG;
    }

    // Default to system error
    return ErrorCategory.SYSTEM;
  }

  /**
   * Determine if error is recoverable
   */
  private isErrorRecoverable(category: ErrorCategory, _error: Error): boolean {
    switch (category) {
      case ErrorCategory.RECOVERABLE:
        return true;
      case ErrorCategory.VALIDATION:
        return true; // Can retry with fixes
      case ErrorCategory.TOOL:
        return true; // Can retry or use alternative
      case ErrorCategory.FILESYSTEM:
        return false; // Usually requires intervention
      case ErrorCategory.NETWORK:
        return true; // Can retry
      case ErrorCategory.CONFIG:
        return false; // Requires user fix
      case ErrorCategory.SYSTEM:
        return false; // Usually fatal
      case ErrorCategory.UNRECOVERABLE:
        return false;
      default:
        return false;
    }
  }

  /**
   * Get recovery suggestions based on error type
   */
  private getRecoverySuggestions(
    category: ErrorCategory,
    _error: Error,
    _context?: Record<string, unknown>,
  ): string[] {
    const suggestions: string[] = [];

    switch (category) {
      case ErrorCategory.VALIDATION:
        suggestions.push("Analyze build/lint/test errors");
        suggestions.push("Locate affected files");
        suggestions.push("Apply targeted fixes");
        suggestions.push("Re-run validation");
        break;

      case ErrorCategory.TOOL:
        suggestions.push("Check tool input parameters");
        suggestions.push("Verify tool prerequisites");
        suggestions.push("Try alternative tool if available");
        suggestions.push("Retry with corrected input");
        break;

      case ErrorCategory.FILESYSTEM:
        suggestions.push("Check file permissions");
        suggestions.push("Verify file paths exist");
        suggestions.push("Check disk space");
        suggestions.push("Ensure workspace is writable");
        break;

      case ErrorCategory.NETWORK:
        suggestions.push("Check network connectivity");
        suggestions.push("Verify API endpoints");
        suggestions.push("Check authentication tokens");
        suggestions.push("Retry after brief delay");
        break;

      case ErrorCategory.CONFIG:
        suggestions.push("Review configuration files");
        suggestions.push("Check for missing required fields");
        suggestions.push("Validate configuration schema");
        suggestions.push("Fix configuration and retry");
        break;

      case ErrorCategory.SYSTEM:
        suggestions.push("Check system resources");
        suggestions.push("Review error logs");
        suggestions.push("Restart runtime if necessary");
        suggestions.push("Report issue if persistent");
        break;
    }

    return suggestions;
  }
}

/**
 * Performance timer for measuring execution time
 */
class PerformanceTimer {
  private timers: Map<string, number> = new Map();

  /**
   * Start timer
   */
  start(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * Stop timer and return duration in ms
   */
  stop(name: string): number | null {
    const startTime = this.timers.get(name);
    if (!startTime) return null;

    const duration = Date.now() - startTime;
    this.timers.delete(name);
    return duration;
  }

  /**
   * Get elapsed time without stopping timer
   */
  elapsed(name: string): number | null {
    const startTime = this.timers.get(name);
    if (!startTime) return null;
    return Date.now() - startTime;
  }
}

/**
 * Singleton instances
 */
const globalLogger = new RuntimeLogger();
const globalErrorHandler = new ErrorHandler();
const globalPerformanceTimer = new PerformanceTimer();

/**
 * Export singleton accessors
 */
export function getLogger(): RuntimeLogger {
  return globalLogger;
}

export function getErrorHandler(): ErrorHandler {
  return globalErrorHandler;
}

export function getPerformanceTimer(): PerformanceTimer {
  return globalPerformanceTimer;
}

/**
 * Convenience functions for backward compatibility
 */
export function logInfo(component: string, message: string, context?: Record<string, unknown>): void {
  getLogger().info(component, message, context);
}

export function logWarn(component: string, message: string, context?: Record<string, unknown>): void {
  getLogger().warn(component, message, context);
}

export function logError(
  component: string,
  message: string,
  error?: Error,
  context?: Record<string, unknown>,
): void {
  getLogger().error(component, message, error, context);
}

export function logFatal(
  component: string,
  message: string,
  error?: Error,
  context?: Record<string, unknown>,
): void {
  getLogger().fatal(component, message, error, context);
}

export function classifyError(error: unknown, context?: Record<string, unknown>): StructuredError {
  return getErrorHandler().classifyError(error, context);
}
