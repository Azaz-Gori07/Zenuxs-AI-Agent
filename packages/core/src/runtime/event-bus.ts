/**
 * Event Bus System — Decoupled Platform Communication
 *
 * Provides a centralized event bus for all subsystems to communicate
 * without tight coupling. Every significant action in Zenuxs emits
 * structured events that other subsystems can subscribe to.
 *
 * Architecture:
 * - Runtime emits execution events
 * - Tools emit tool events
 * - Filesystem emits file events
 * - Shell emits command events
 * - Validation emits result events
 * - Plugins can emit and listen to custom events
 * - MCP servers emit connection events
 * - Workflows emit orchestration events
 *
 * Benefits:
 * - No direct dependencies between subsystems
 * - Easy to add new listeners without modifying emitters
 * - Event replay for debugging
 * - Event streaming for real-time monitoring
 * - Plugin extensibility through event hooks
 */

export enum EventType {
  // Execution events
  EXECUTION_START = "execution:start",
  EXECUTION_COMPLETE = "execution:complete",
  EXECUTION_INTERRUPT = "execution:interrupt",
  EXECUTION_RESUME = "execution:resume",

  // Task events
  TASK_CREATE = "task:create",
  TASK_START = "task:start",
  TASK_COMPLETE = "task:complete",
  TASK_FAIL = "task:fail",
  TASK_RETRY = "task:retry",

  // Tool events
  TOOL_REGISTER = "tool:register",
  TOOL_UNREGISTER = "tool:unregister",
  TOOL_CALL_START = "tool:call:start",
  TOOL_CALL_COMPLETE = "tool:call:complete",
  TOOL_CALL_FAIL = "tool:call:fail",
  TOOL_CALL_RETRY = "tool:call:retry",

  // Filesystem events
  FILE_CREATE = "file:create",
  FILE_MODIFY = "file:modify",
  FILE_DELETE = "file:delete",
  FILE_MOVE = "file:move",
  FILE_WATCH = "file:watch",

  // Shell events
  SHELL_COMMAND_START = "shell:command:start",
  SHELL_COMMAND_COMPLETE = "shell:command:complete",
  SHELL_COMMAND_FAIL = "shell:command:fail",
  SHELL_OUTPUT_STREAM = "shell:output:stream",

  // Validation events
  VALIDATION_START = "validation:start",
  VALIDATION_COMPLETE = "validation:complete",
  VALIDATION_FAIL = "validation:fail",
  VALIDATION_REPAIR = "validation:repair",

  // MCP events
  MCP_SERVER_REGISTER = "mcp:server:register",
  MCP_SERVER_CONNECT = "mcp:server:connect",
  MCP_SERVER_DISCONNECT = "mcp:server:disconnect",
  MCP_SERVER_ERROR = "mcp:server:error",
  MCP_TOOL_CALL = "mcp:tool:call",

  // Plugin events
  PLUGIN_REGISTER = "plugin:register",
  PLUGIN_ACTIVATE = "plugin:activate",
  PLUGIN_DEACTIVATE = "plugin:deactivate",
  PLUGIN_ERROR = "plugin:error",

  // Session events
  SESSION_START = "session:start",
  SESSION_END = "session:end",
  SESSION_PAUSE = "session:pause",
  SESSION_RESUME = "session:resume",

  // Goal events
  GOAL_CREATE = "goal:create",
  GOAL_START = "goal:start",
  GOAL_MILESTONE_COMPLETE = "goal:milestone:complete",
  GOAL_COMPLETE = "goal:complete",
  GOAL_FAIL = "goal:fail",

  // Error events
  ERROR_OCCURRED = "error:occurred",
  ERROR_RECOVERED = "error:recovered",
  ERROR_UNRECOVERABLE = "error:unrecoverable",
}

export interface BaseEvent {
  /** Event type */
  type: EventType;
  /** Timestamp */
  timestamp: Date;
  /** Session ID */
  sessionId?: string;
  /** Source component */
  source: string;
}

export interface ExecutionStartEvent extends BaseEvent {
  type: EventType.EXECUTION_START;
  data: {
    goal: string;
    mode: string;
    workspaceRoot: string;
  };
}

export interface ExecutionCompleteEvent extends BaseEvent {
  type: EventType.EXECUTION_COMPLETE;
  data: {
    success: boolean;
    duration: number;
    tasksCompleted: number;
    tasksFailed: number;
  };
}

export interface ToolCallStartEvent extends BaseEvent {
  type: EventType.TOOL_CALL_START;
  data: {
    toolName: string;
    input: unknown;
    toolCallId: string;
  };
}

export interface ToolCallCompleteEvent extends BaseEvent {
  type: EventType.TOOL_CALL_COMPLETE;
  data: {
    toolName: string;
    toolCallId: string;
    output: unknown;
    duration: number;
  };
}

export interface ToolCallFailEvent extends BaseEvent {
  type: EventType.TOOL_CALL_FAIL;
  data: {
    toolName: string;
    toolCallId: string;
    error: string;
  };
}

export interface FileCreateEvent extends BaseEvent {
  type: EventType.FILE_CREATE;
  data: {
    path: string;
    size: number;
  };
}

export interface FileModifyEvent extends BaseEvent {
  type: EventType.FILE_MODIFY;
  data: {
    path: string;
    changes: number;
  };
}

export interface ValidationCompleteEvent extends BaseEvent {
  type: EventType.VALIDATION_COMPLETE;
  data: {
    type: "build" | "lint" | "test" | "typecheck";
    success: boolean;
    errors?: string[];
    duration: number;
  };
}

export interface ErrorOccurredEvent extends BaseEvent {
  type: EventType.ERROR_OCCURRED;
  data: {
    category: string;
    message: string;
    recoverable: boolean;
    stack?: string;
  };
}

/**
 * Union type of all events
 */
export type PlatformEvent =
  | BaseEvent
  | ExecutionStartEvent
  | ExecutionCompleteEvent
  | ToolCallStartEvent
  | ToolCallCompleteEvent
  | ToolCallFailEvent
  | FileCreateEvent
  | FileModifyEvent
  | ValidationCompleteEvent
  | ErrorOccurredEvent;

/**
 * Event handler function
 */
export type EventHandler<T extends PlatformEvent = PlatformEvent> = (
  event: T,
) => void | Promise<void>;

/**
 * Event filter for selective listening
 */
export interface EventFilter {
  /** Event types to listen to */
  types?: EventType[];
  /** Source components to listen to */
  sources?: string[];
  /** Session IDs to listen to */
  sessionIds?: string[];
}

/**
 * Event Bus for decoupled platform communication
 */
export class EventBus {
  private listeners = new Map<EventType, Set<EventHandler>>();
  private eventHistory: PlatformEvent[] = [];
  private maxHistorySize: number = 1000;
  private enabled: boolean = true;

  /**
   * Enable or disable event bus
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
  }

  /**
   * Subscribe to events
   */
  subscribe<T extends PlatformEvent>(
    eventType: EventType | EventType[],
    handler: EventHandler<T>,
    filter?: EventFilter,
  ): () => void {
    const types = Array.isArray(eventType) ? eventType : [eventType];

    for (const type of types) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }

      // Wrap handler with filter
      const wrappedHandler: EventHandler = async (event) => {
        if (filter) {
          if (filter.types && !filter.types.includes(event.type)) return;
          if (filter.sources && !filter.sources.includes(event.source)) return;
          if (filter.sessionIds && event.sessionId && !filter.sessionIds.includes(event.sessionId)) return;
        }

        await handler(event as T);
      };

      this.listeners.get(type)!.add(wrappedHandler);
    }

    // Return unsubscribe function
    return () => {
      for (const type of types) {
        this.listeners.get(type)?.delete(handler as EventHandler);
      }
    };
  }

  /**
   * Emit an event
   */
  async emit<T extends PlatformEvent>(event: T): Promise<void> {
    if (!this.enabled) return;

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Get listeners for this event type
    const handlers = this.listeners.get(event.type);
    if (!handlers || handlers.size === 0) return;

    // Call all handlers
    const promises: Array<Promise<void>> = [];
    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`[EventBus] Error in event handler for ${event.type}:`, error);
      }
    }

    // Wait for all async handlers
    await Promise.allSettled(promises);
  }

  /**
   * Emit event synchronously (fire and forget)
   */
  emitSync<T extends PlatformEvent>(event: T): void {
    void this.emit(event);
  }

  /**
   * Get event history
   */
  getHistory(filter?: EventFilter): PlatformEvent[] {
    let events = this.eventHistory;

    if (filter) {
      if (filter.types) {
        events = events.filter((e) => filter.types!.includes(e.type));
      }
      if (filter.sources) {
        events = events.filter((e) => filter.sources!.includes(e.source));
      }
      if (filter.sessionIds) {
        events = events.filter(
          (e) => e.sessionId && filter.sessionIds!.includes(e.sessionId),
        );
      }
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get event statistics
   */
  getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySource: Record<string, number> = {};

    for (const event of this.eventHistory) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;
    }

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      eventsBySource,
    };
  }

  /**
   * Remove all listeners
   */
  clearListeners(): void {
    this.listeners.clear();
  }
}

/**
 * Singleton instance
 */
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  globalEventBus = null;
}

/**
 * Convenience event emitters
 */
export function emitExecutionStart(
  sessionId: string,
  goal: string,
  mode: string,
  workspaceRoot: string,
): void {
  getEventBus().emitSync({
    type: EventType.EXECUTION_START,
    timestamp: new Date(),
    sessionId,
    source: "runtime",
    data: { goal, mode, workspaceRoot },
  });
}

export function emitExecutionComplete(
  sessionId: string,
  success: boolean,
  duration: number,
  tasksCompleted: number,
  tasksFailed: number,
): void {
  getEventBus().emitSync({
    type: EventType.EXECUTION_COMPLETE,
    timestamp: new Date(),
    sessionId,
    source: "runtime",
    data: { success, duration, tasksCompleted, tasksFailed },
  });
}

export function emitToolCallStart(
  sessionId: string,
  toolName: string,
  input: unknown,
  toolCallId: string,
): void {
  getEventBus().emitSync({
    type: EventType.TOOL_CALL_START,
    timestamp: new Date(),
    sessionId,
    source: "tool",
    data: { toolName, input, toolCallId },
  });
}

export function emitToolCallComplete(
  sessionId: string,
  toolName: string,
  toolCallId: string,
  output: unknown,
  duration: number,
): void {
  getEventBus().emitSync({
    type: EventType.TOOL_CALL_COMPLETE,
    timestamp: new Date(),
    sessionId,
    source: "tool",
    data: { toolName, toolCallId, output, duration },
  });
}

export function emitToolCallFail(
  sessionId: string,
  toolName: string,
  toolCallId: string,
  error: string,
): void {
  getEventBus().emitSync({
    type: EventType.TOOL_CALL_FAIL,
    timestamp: new Date(),
    sessionId,
    source: "tool",
    data: { toolName, toolCallId, error },
  });
}

export function emitFileCreate(
  sessionId: string,
  path: string,
  size: number,
): void {
  getEventBus().emitSync({
    type: EventType.FILE_CREATE,
    timestamp: new Date(),
    sessionId,
    source: "filesystem",
    data: { path, size },
  });
}

export function emitFileModify(
  sessionId: string,
  path: string,
  changes: number,
): void {
  getEventBus().emitSync({
    type: EventType.FILE_MODIFY,
    timestamp: new Date(),
    sessionId,
    source: "filesystem",
    data: { path, changes },
  });
}

export function emitValidationComplete(
  sessionId: string,
  type: "build" | "lint" | "test" | "typecheck",
  success: boolean,
  duration: number,
  errors?: string[],
): void {
  getEventBus().emitSync({
    type: EventType.VALIDATION_COMPLETE,
    timestamp: new Date(),
    sessionId,
    source: "validation",
    data: { type, success, errors, duration },
  });
}
