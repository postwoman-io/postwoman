import { Service } from "dioc"

/**
 * This service provice debug utilities for the application and is
 * supposed to be used only in development.
 *
 * This service logs events from the container and also events
 * from all the services that are bound to the container. Along with that
 * this service exposes all registered services (including this) to global
 * scope (window) under the ID of the service so it can be accessed using
 * the console for debugging.
 *
 * This service injects couple of utilities into the global scope:
 *  - `_getService(id: string): Service | undefined` - Returns the service instance with the given ID or undefined.
 *  - `_getBoundServiceIDs(): string[]` - Returns the IDs of all the bound services.
 */
export class DebugService extends Service {
  public static readonly ID = "DEBUG_SERVICE"

  override onServiceInit() {
    console.debug("DebugService is initialized...")

    const container = this.getContainer()

    // Log container events
    container.getEventStream().subscribe((event) => {
      if (event.type === "SERVICE_BIND") {
        console.debug(
          "[CONTAINER] Service Bind:",
          event.bounderID ?? "<CONTAINER>",
          "->",
          event.boundeeID
        )
      } else if (event.type === "SERVICE_INIT") {
        console.debug("[CONTAINER] Service Init:", event.serviceID)

        // Subscribe to event stream of the newly initialized service
        const service = container.getBoundServiceWithID(event.serviceID)

        // Expose the service globally for debugging via a global variable
        ;(window as any)[event.serviceID] = service

        service?.getEventStream().subscribe((ev: any) => {
          console.debug(`[${event.serviceID}] Event:`, ev)
        })
      }
    })

    // Subscribe to event stream of all already bound services (if any)
    for (const [id, service] of container.getBoundServices()) {
      service.getEventStream().subscribe((event: any) => {
        console.debug(`[${id}]`, event)
      })

      // Expose the service globally for debugging via a global variable
      ;(window as any)[id] = service
    }

    // Inject debug utilities into the global scope
    ;(window as any)._getService = this.getService.bind(this)
    ;(window as any)._getBoundServiceIDs = this.getBoundServiceIDs.bind(this)
  }

  private getBoundServiceIDs() {
    return Array.from(this.getContainer().getBoundServices()).map(([id]) => id)
  }

  private getService(id: string) {
    return this.getContainer().getBoundServiceWithID(id)
  }
}
