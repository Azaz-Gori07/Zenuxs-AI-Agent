# Zenuxs Code Coding Conventions

## Module Shape

Use flat top-level exports combined with a self-reexport at the bottom of the file:

```ts
// src/foo/foo.ts
export interface Interface { ... }
export class Service { ... }
export function create() { ... }

export * as Foo from "./foo"
```

Consumers import the namespace projection:
```ts
import { Foo } from "@/foo/foo"
```

Namespace-private helpers stay as non-exported top-level declarations.

## Multi-sibling directories

For directories with several independent modules, keep each sibling as its own file with its own self-reexport. Do not add barrel `index.ts` files.

## TypeScript

- Use `strict: true` with `noUncheckedIndexedAccess`
- Avoid `any` type — use `unknown` instead
- Rely on type inference when possible
- Prefer `const` over `let`
- Avoid `else` — use early returns

## Naming

- Files: `kebab-case.ts`
- Classes/PascalCase: `SessionManager`, `ToolRegistry`
- Functions/camelCase: `createSession()`, `resolveTools()`
- Interfaces: `Interface` or descriptive name like `SessionConfig`
- Types: `PascalCase` or descriptive

## Error handling

- Use `Result<T, E>` pattern or typed error classes
- Never throw raw strings — use typed errors
- Prefer early returns over try/catch

## Testing

- Vitest for unit tests
- File co-location: `foo.test.ts` next to `foo.ts`
- Avoid mocks — test actual implementation

## Imports

- Prefer `import type` for type-only imports
- Use path aliases: `@zenuxs/engine` not relative paths in published code
- Avoid star imports (`import * as`)
- Avoid aliased imports (`import { foo as bar }`)

## Async

- Use `AbortSignal` for cancellation in all async operations
- Prefer `Promise.all` for parallel independent operations
- Handle rejections at the boundary, not everywhere