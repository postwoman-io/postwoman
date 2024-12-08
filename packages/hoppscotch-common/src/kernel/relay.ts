import { Request, Capabilities } from "@hoppscotch/kernel"

export const Relay = {
  capabilities(): Capabilities {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.relay) {
      throw new Error("Kernel relay is not initialized")
    }
    return window.__KERNEL__.relay.capabilities
  },

  canHandle(request: Request) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.relay) {
      throw new Error("Kernel relay is not initialized")
    }
    return window.__KERNEL__.relay.canHandle(request)
  },

  execute(request: Request) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.relay) {
      throw new Error("Kernel relay is not initialized")
    }
    console.log("Kernel found, executing request")
    return window.__KERNEL__.relay.execute(request)
  },
}
