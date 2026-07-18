# Debug Analysis: Why New CLI Session Works But New Extension Session Fails

## Observed Behavior
- **Old Session - CLI**: Authentication failed
- **Old Session - Extension**: Authentication failed  
- **New Session - CLI**: Works correctly
- **New Session - Extension**: Authentication failed again

## Root Cause Summary

**The CLI creates a fresh `ZenuxsCore` instance for EVERY session, while the Extension caches a single `ZenuxsCore` instance for its ENTIRE LIFETIME.**

This means:
1. Authentication state/tokens are cached in the Core instance
2. Provider clients are cached in the Core instance
3. Provider registry state is cached in the Core instance
4. When the CLI creates a new session, it gets a fresh Core with fresh state
5. When the Extension creates a new session, it reuses the SAME Core with STALE state

## Detailed Execution Path Comparison

### CLI Session Lifecycle (Working)

```
1. User runs: cline "fix bug"
   ↓
2. main.ts: runCli() → runAgent()
   ↓
3. run-agent.ts: createCliCore() 
   ↓
4. session/session.ts: withCliCore()
   - Creates NEW ZenuxsCore instance
   - Instantiates NEW ProviderSettingsManager
   - Calls ZenuxsCore.create() with fresh config
   ↓
5. runAgent() executes with fresh Core
   ↓
6. If auth fails:
   - Core.dispose() is called
   - All cached state is destroyed
   ↓
7. User runs: cline "fix bug" (NEW SESSION)
   ↓
8. Steps 2-6 repeat with FRESH ZenuxsCore
   - New authentication context
   - New provider instances
   - No stale state contamination
   ↓
9. SUCCESS ✓
```

**Key CLI Code Pattern:**
```typescript
// apps/cli/src/session/session.ts:82-102
export async function withCliCore<T>(run: (core: ZenuxsCore) => Promise<T>): Promise<T> {
    const core = await createCliCore({...});  // ← FRESH INSTANCE EVERY TIME
    try {
        return await run(core);
    } finally {
        await core.dispose("cli_session_helper_dispose");  // ← ALWAYS DISPOSED
    }
}
```

### Extension Session Lifecycle (Broken)

```
1. User opens VS Code
   ↓
2. extension.ts: activate()
   - Creates ZenuxsChatViewProvider (once)
   ↓
3. ChatProvider.getCore() called
   ↓
4. core-bridge.ts: ExtensionCoreBridge created
   - Singleton pattern: this.core = undefined initially
   ↓
5. getCore().createCore()
   - Creates ZenuxsCore instance ONCE
   - Caches in this.core
   - Subscribes to events
   ↓
6. First session executes
   ↓
7. Auth FAILS (stale token, expired session, etc.)
   - Core caches the FAILED auth state
   - Provider instance caches the error
   ↓
8. User clicks "New Session" button
   ↓
9. chat-view-provider.ts: newSession()
   - ONLY clears this.activeSessionId = undefined
   - Does NOT dispose ExtensionCoreBridge
   - Does NOT recreate ZenuxsCore
   - Does NOT clear provider cache
   ↓
10. Second session executes
    - Reuses SAME ZenuxsCore instance
    - Reuses SAME ProviderSettingsManager
    - Reuses SAME provider clients
    - STALE AUTH STATE STILL PRESENT
   ↓
11. AUTH FAILS AGAIN ✗
```

**Key Extension Code Pattern:**
```typescript
// apps/vscode-extension/src/runtime/core-bridge.ts:64-74
async getCore(): Promise<ZenuxsCore> {
    if (this.core) {
        return this.core;  // ← REUSES EXISTING INSTANCE
    }
    if (this.initPromise) {
        return this.initPromise;
    }
    this.initPromise = this.createCore();  // ← ONLY CREATED ONCE
    this.core = await this.initPromise;
    return this.core;
}

// apps/vscode-extension/src/providers/chat-view-provider.ts:304-307
public newSession(): void {
    this.activeSessionId = undefined;  // ← ONLY CLEARS SESSION ID
    this.postToWebview({ type: "reset_done" });
    // DOES NOT DISPOSE OR RECREATE BRIDGE/CORE
}
```

## Object Lifecycle Analysis

| Object | CLI Behavior | Extension Behavior | Expected | Actual | Root Cause |
|--------|-------------|-------------------|----------|--------|-----------|
| **Session object** | ✓ Recreated | ✓ Recreated (new session ID) | Recreated | Recreated | Both correct |
| **Conversation object** | ✓ Recreated | ✓ Recreated | Recreated | Recreated | Both correct |
| **AgentRuntime** | ✓ Recreated | ✗ REUSED | Recreated | Extension caches | ExtensionCoreBridge caches ZenuxsCore |
| **ProviderManager** | ✓ Recreated | ✗ REUSED | Recreated | Extension caches | ProviderSettingsManager instance persists |
| **Provider instances** | ✓ Recreated | ✗ REUSED | Recreated | Cached in Core | Provider clients cached in ZenuxsCore singleton |
| **ModelManager** | ✓ Recreated | ✗ REUSED | Recreated | Cached in Core | Part of Core singleton |
| **Authentication state** | ✓ Fresh | ✗ STALE | Fresh | Cached in Core | Auth tokens cached in Core/provider instances |
| **SecretStorage reload** | ✓ Fresh read | ✗ Cached read | Fresh | Extension reads once | ProviderSettingsManager.read() called once at init |
| **Config reload** | ✓ Fresh config | ✓ VS Code config watcher | Fresh | Extension uses VS Code config | Extension uses VS Code settings (correct) |
| **PromptBuilder** | ✓ Recreated | ✓ Recreated | Recreated | Both correct | Created per request |
| **Memory** | ✓ Recreated | ✗ REUSED | Recreated | Extension singleton | Memory context cached in Core |
| **Event subscriptions** | ✓ Fresh | ✓ Recreated per turn | Fresh | Extension adds new per turn | Line 1029: unsubscribe after each turn |
| **Cached runtime instances** | ✓ None | ✗ Persistent cache | No cache | Extension has cache | ExtensionCoreBridge caches ZenuxsCore |
| **Singleton services** | ✓ N/A | ✓ Uses singletons | Acceptable | Shared across sessions | Core/PSM singletons retain state |
| **DI Container** | ✓ Fresh per run | ✗ Persistent | Fresh | Extension persistent | Core.create() called once |
| **Extension activation lifecycle** | N/A | ✗ Bridge never recreated | Recreate on new session | Never recreated | activate() creates ChatProvider once |

## Critical Code Paths

### 1. CLI: Fresh Core Creation (CORRECT)

**File:** `apps/cli/src/session/session.ts:82-102`
```typescript
async function withCliCore<T>(run: (core: ZenuxsCore) => Promise<T>): Promise<T> {
    const core = await createCliCore({...});  // NEW INSTANCE
    try {
        return await run(core);
    } finally {
        await core.dispose("cli_session_helper_dispose");  // CLEANED UP
    }
}
```

**File:** `apps/cli/src/runtime/run-agent.ts:169-179`
```typescript
const sessionManager = await createCliCore({
    capabilities: {...},
    forceLocalBackend: isYoloMode || config.sandbox === true,
    logger: config.logger,
    cwd: config.cwd,
    workspaceRoot: config.workspaceRoot,
    toolPolicies: config.toolPolicies,
});
// ← NEW ZenuxsCore for EVERY runAgent() call
```

### 2. Extension: Cached Core (BUG)

**File:** `apps/vscode-extension/src/runtime/core-bridge.ts:64-74`
```typescript
async getCore(): Promise<ZenuxsCore> {
    if (this.core) {
        return this.core;  // BUG: Returns cached instance
    }
    this.initPromise = this.createCore();
    this.core = await this.initPromise;
    return this.core;
}
```

**File:** `apps/vscode-extension/src/providers/chat-view-provider.ts:334-371`
```typescript
private async getCore(): Promise<ExtensionCoreBridge> {
    if (!this.coreBridge) {
        this.coreBridge = new ExtensionCoreBridge({...});  // CREATED ONCE
        this.mcpManager = new InMemoryMcpManager({...});
        await this.initializeMcpManager();
    }
    return this.coreBridge;  // CACHED FOREVER
}
```

**File:** `apps/vscode-extension/src/providers/chat-view-provider.ts:304-307`
```typescript
public newSession(): void {
    this.activeSessionId = undefined;  // ONLY CLEARS SESSION ID
    this.postToWebview({ type: "reset_done" });
    // MISSING: this.coreBridge.dispose() and recreation
}
```

## Why This Causes Authentication Failures

### State that Gets Cached in ZenuxsCore:

1. **Provider Clients**: HTTP clients with OAuth tokens, API keys
   - Once instantiated with old/bad credentials, they remain bad
   - Token refresh may have failed and cached the failure

2. **Authentication Tokens**: 
   - OAuth access tokens stored in memory
   - Refresh tokens that may be expired
   - Provider-specific auth handlers with state

3. **Provider Registry**:
   - `registerCustomProvider()` state in `@cline/llms`
   - Once a provider is registered with bad config, it stays registered

4. **Session State**:
   - Active session IDs
   - Session metadata
   - Error states from previous runs

### Why New CLI Session Works:

```typescript
// Every new CLI invocation:
1. Process restarts (fresh memory)
2. New ZenuxsCore created
3. ProviderSettingsManager reads disk (fresh config)
4. Provider clients instantiated with CURRENT credentials
5. Auth state is fresh
6. SUCCESS
```

### Why New Extension Session Fails:

```typescript
// Same VS Code window:
1. Extension already activated (process not restarted)
2. ExtensionCoreBridge already exists
3. ZenuxsCore already exists with:
   - Failed auth state cached
   - Stale provider clients
   - Old OAuth tokens
   - Provider registry with bad entries
4. newSession() only clears activeSessionId
5. Reuses SAME broken Core
6. FAILS AGAIN
```

## The Fix

### Option 1: Dispose and Recreate Bridge (Preferred)

```typescript
// chat-view-provider.ts:334-371
private async getCore(): Promise<ExtensionCoreBridge> {
    if (!this.coreBridge) {
        this.coreBridge = new ExtensionCoreBridge({...});
        this.mcpManager = new InMemoryMcpManager({...});
        await this.initializeMcpManager();
    }
    return this.coreBridge;
}

// ADD THIS METHOD:
public async resetCore(): Promise<void> {
    if (this.coreBridge) {
        await this.coreBridge.dispose();  // Clean up old Core
        this.coreBridge = undefined;       // Force recreation
    }
    if (this.mcpManager) {
        await this.mcpManager.dispose();
        this.mcpManager = undefined;
    }
}

// MODIFY newSession():
public newSession(): void {
    this.activeSessionId = undefined;
    this.resetCore();  // ← ADD THIS
    this.postToWebview({ type: "reset_done" });
}
```

### Option 2: Lazy Recreation on Auth Failure (Defensive)

```typescript
// core-bridge.ts: Add method to check/recreate
async ensureFreshCore(): Promise<ZenuxsCore> {
    const core = await this.getCore();
    // Check if auth state is stale
    if (this.isAuthStateStale(core)) {
        await this.dispose();
        this.core = undefined;
        this.initPromise = undefined;
        return this.createCore();
    }
    return core;
}
```

### Option 3: Force Core Recreation on New Session (Most Explicit)

```typescript
// chat-view-provider.ts
public async newSession(): Promise<void> {
    this.activeSessionId = undefined;
    
    // Completely reset the runtime
    const bridge = await this.getCore();
    await bridge.dispose();
    this.coreBridge = undefined;
    
    // Recreate with fresh state
    this.coreBridge = new ExtensionCoreBridge({...});
    this.mcpManager = new InMemoryMcpManager({...});
    await this.initializeMcpManager();
    
    this.postToWebview({ type: "reset_done" });
}
```

## Permanent Fix Recommendation

**Implement Option 1** with the following changes:

1. **Add `resetCore()` method to `ZenuxsChatViewProvider`**
   - Disposes ExtensionCoreBridge
   - Disposes MCP Manager
   - Sets both to undefined

2. **Call `resetCore()` in `newSession()`**
   - Ensures fresh state for every new session
   - Matches CLI behavior

3. **Add `dispose()` call in Extension deactivation**
   - Clean up on window close
   - Prevent memory leaks

## Verification Steps

After fix, verify:
1. Old session with bad auth → fails (expected)
2. Click "New Session" in Extension → fresh Core created
3. New session authenticates → succeeds
4. Repeat: multiple new sessions all work
5. Close/reopen VS Code → fresh state (already works)

## Why This Wasn't Caught Earlier

1. **CLI-first development**: CLI pattern was established first
2. **Extension porting**: Extension mirrored architecture but missed lifecycle semantics
3. **Singleton pattern**: Seems correct for "one Core per window" but wrong for "one Core per session"
4. **Testing gap**: New session testing only verified CLI paths
5. **Auth caching**: OAuth tokens work most of the time, masking the bug until they expire/fail

## Related Code Paths That Should Also Be Updated

1. **`extension.ts:deactivate()`** - Should call `chatProvider.dispose()`
2. **`chat-view-provider.ts:handleAbort()`** - Should reset core on abort if needed
3. **`chat-view-provider.ts:handleClearHistory()`** - Should reset core
4. **`core-bridge.ts:dispose()`** - Already exists, just needs to be called