import type { ProviderConfig, ProviderModel, ProviderRoute } from "@zenuxs/schema"

export interface ProviderHandler {
  readonly id: string
  readonly name: string
  createRoute(config: ProviderConfig, modelId: string): ProviderRoute
  stream?(route: ProviderRoute, messages: unknown[], tools?: unknown[], signal?: AbortSignal): AsyncGenerator<unknown>
}

export class ProviderManager {
  private providers = new Map<string, ProviderHandler>()

  register(provider: ProviderHandler): void {
    this.providers.set(provider.id, provider)
  }

  get(id: string): ProviderHandler | undefined {
    return this.providers.get(id)
  }

  list(): ProviderHandler[] {
    return Array.from(this.providers.values())
  }

  createRoute(config: ProviderConfig, modelId: string): ProviderRoute {
    const handler = this.get(config.id)
    if (!handler) throw new Error(`Unknown provider: ${config.id}`)
    return handler.createRoute(config, modelId)
  }
}

export const providerManager = new ProviderManager()

export * as Provider from "."