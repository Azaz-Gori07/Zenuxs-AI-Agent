# Architecture Map - Zenuxs-Code

## Layer Definitions

### Layer 1: CLI Entry Point
```
apps/cli/src/
├── index.ts           # Entry bootstrap
├── main.ts            # Commander routing, config resolution
├── commands/          # Subcommand implementations
│   ├── program.ts     # Base program setup
│   ├── auth.ts        # Provider authentication
│   ├── config.ts      # Configuration display
│   ├── plugin.ts      # Plugin management
│   ├── mcp.ts         # MCP server management
│   ├── history.ts     # Session history
│   └── schedule.ts    # Task scheduling
└── runtime/           # Agent runtime wrappers
    ├── run-agent.ts   # Headless agent execution
    ├── run-interactive.ts # TUI interactive mode
    └── prompt.ts      # System prompt resolution
```

### Layer 2: Core Runtime
```
packages/core/src/
├── index.ts           # Barrel exports
├── extensions/        # Enhanced tool infrastructure
│   └── tools/
│       ├── definitions.ts   # Default tool factory
│       ├── executors/       # Built-in executors
│       │   ├── bash.ts       # Shell execution
│       │   ├── file-read.ts  # File reading
│       │   ├── editor.ts     # File editing
│       │   └── web-fetch.ts  # URL fetching
│       ├── shell-enhanced.ts    # Enhanced shell (unused)
│       ├── file-read-enhanced.ts # Enhanced read (unused)
│       ├── editor-enhanced.ts   # Enhanced editor (unused)
│       ├── glob-grep-enhanced.ts # Enhanced grep/glob (unused)
│       └── todo-enhanced.ts     # TODO tool (unused)
├── cron/              # Scheduled tasks
│   ├── schedule/scheduler.ts   # Cron parsing
│   ├── service/schedule-service.ts # Service layer
│   ├── runner/cron-runner.ts     # Execution engine
│   └── events/                 # Event triggers
└── services/          # Core services
    ├── telemetry/     # OpenTelemetry
    ├── storage/       # SQLite, provider settings
    └── workspace/     # File indexing, workspace info
```

### Layer 3: Agent Runtime
```
packages/agents/src/
├── index.ts           # Agent exports
├── agent-runtime.ts   # AgentRuntime class
├── agent-graph.ts     # LangGraph workflow
├── subagents/         # Multi-agent support
│   ├── roles.ts       # Planner, coder, reviewer configs
│   └── subAgentNode.ts # Sub-agent workflow node
└── mcp/               # MCP abstraction layer
    ├── mcpClient.ts   # McpLayer main class
    ├── types.ts       # MCP types and built-in catalog
    ├── connectionManager.ts # Server connections
    ├── discoveryEngine.ts   # Server discovery
    └── toolRegistry.ts    # Tool registration wrapper
```

### Layer 4: Shared Types & Utilities
```
packages/shared/src/
├── agent.ts           # AgentRuntime types (tools, messages, events)
├── tools/             # Tool definition system
│   ├── definition.ts  # make(), makeDynamic(), ToolRuntime
│   └── dispatch.ts    # dispatch(), dispatchAll()
├── hooks/             # Hook system
│   ├── events.ts      # Hook event types and payloads
│   └── contracts.ts   # Hook control types
├── llms/              # LLM provider types
│   └── model-info.ts  # Model information types
└── services/          # Shared utilities
    └── zenuxs-memory.ts # Memory service
```

### Layer 5: LLM Providers
```
packages/llms/src/
├── index.ts           # Provider exports
├── providers/         # Provider implementations
│   ├── gateway.ts     # Provider gateway
│   ├── registry.ts    # Provider registry
│   └── vendors/       # Individual providers
│       ├── openai.ts
│       ├── anthropic.ts
│       └── ...
└── services/           # Runtime services
    ├── runtime-config.ts
    └── runtime-registry.ts
```

---

## Data Flow Diagram

```
┌─────────────┐
│   User      │
│ (CLI/TUI)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│  main.ts    │────▶│ UserInstrSrv │
│ (CLI entry) │     │ (skills/rules│
└──────┬──────┘     └──────────────┘
       │
       ▼
┌─────────────┐
│ run-agent.ts│
│ (headless)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│ SessionMgr  │────▶│ AgentRuntime │
│ (core)      │     │ (agents)     │
└──────┬──────┘     └──────┬───────┘
       │                   │
       │                   ├──────▶┌──────────────┐
       │                   │       │ ToolRegistry │
       │                   │       └──────┬───────┘
       │                   │              │
       │                   │              ▼
       │                   │       ┌──────────────┐
       │                   └──────▶│ MCPToolRegistry│
       │                            └──────────────┘
       │                                   │
       │                                   ▼
       │                            ┌──────────────┐
       │                            │   McpLayer   │
       │                            └──────────────┘
       │                                   │
       ▼                                   ▼
┌─────────────┐                   ┌──────────────┐
│   State     │                   │ ConnectionMgr│
│   Persist   │                   │ (MCP conn)   │
└─────────────┘                   └──────────────┘
```

---

## Tool Registration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  AgentRuntime.tools Map                  │
│  (Runtime tool registry for native execution)            │
├─────────────────────────────────────────────────────────┤
│  read_files  ──▶ executors/file-read.ts                │
│  run_commands ──▶ executors/bash.ts                    │
│  editor      ──▶ executors/editor.ts                  │
│  ...                                                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Enhanced Tool Registry (unused)              │
│  ToolRegistry in registry.ts                           │
├─────────────────────────────────────────────────────────┤
│  read        ──▶ file-read-enhanced.ts (DISCONNECTED)   │
│  bash        ──▶ shell-enhanced.ts (DISCONNECTED)      │
│  ...                                                   │
└─────────────────────────────────────────────────────────┘
```

---

## MCP Integration Architecture

```
                    ┌──────────────────┐
                    │  McpLayer        │
                    │  (mcpClient.ts)  │
                    └────────┬─────────┘
                             │
           discoverAll()    │    getCapabilitiesForTask()
              │            │            │
              ▼            ▼            ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │ CapabilityReg    │  │ DiscoveryEngine  │  │ Tool Descriptions│
    │ (registry)       │  │                  │  │ (for prompts)     │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
              │
              ▼
    ┌──────────────────┐
    │ ConnectionMgr    │
    │ (connections)  │
    └────────┬─────────┘
             │
      connect() ──▶ StdioClientTransport / SSEClientTransport
             │
             ▼
    ┌──────────────────┐
    │  MCP Servers     │
    │  (filesystem,    │
    │   github, etc.)  │
    └──────────────────┘
```

---

## Agent Loop Flow

```
┌─────────────┐
│   Planner   │──messages──▶ Model
│   (graph    │◀──response──┤
│   node)     │
└──────┬──────┘
       │
       ├──── has tool calls?
       │              │
       ▼              ▼
┌─────────────┐ ┌─────────────┐
│ tool_selector│ │ crew_dispatch│
└──────┬──────┘ └──────┬──────┘
       │               │
       ▼               ▼
┌─────────────┐ ┌─────────────┐
│MCP tools    │ │Sub-agents   │
│(tool_executor)│ │(agent_*)    │
└─────────────┘ └──────┬──────┘
       │               │
       ▼               ▼
┌─────────────┐ ┌─────────────┐
│Executor     │ │Reasoning    │
│(native tools)│ │(self-       │
└──────┬──────┘ │critique)    │
       │       └──────┬──────┘
       └──────────────┬──────┘
                      │
                      ▼
              ┌─────────────┐
              │   done      │
              └─────────────┘
```