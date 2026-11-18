// Browser-safe stand-ins for Node-only provider gateway helpers.

export function createGateway(): never {
  throw new Error("Provider gateway is not available in browser builds")
}

export async function createHandlerAsync(): Promise<never> {
  throw new Error("Provider handler factory is not available in browser builds")
}
