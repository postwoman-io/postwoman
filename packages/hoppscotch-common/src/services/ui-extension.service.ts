import { Service } from "dioc"
import { Component, shallowRef } from "vue"

/**
 * A registrar that allows other services to register
 * additional stuff into the UI
 */
export class UIExtensionService extends Service {
  public static readonly ID = "UI_EXTENSION_SERVICE"

  /**
   * Defines the Root UI Extensions that are registered.
   * These components are rendered in `layouts/default.vue`.
   * NOTE: This is supposed to be readonly, to register
   */
  public rootUIExtensionComponents = shallowRef<Component[]>([])

  /**
   * Registers a root UI extension component that will be rendered
   * in the root of the UI
   */
  public addRootUIExtension(component: Component) {
    this.rootUIExtensionComponents.value.push(component)
  }
}
