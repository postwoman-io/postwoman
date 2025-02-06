import { App } from "vue"
import { pipe } from "fp-ts/function"
import * as A from "fp-ts/Array"
import { RouteLocationNormalized, Router } from "vue-router"

export type HoppModule = {
  /**
   * Optional flag to mark a module as deprecated.
   * Deprecated modules will be filtered out during initialization.
   */
  deprecated?: boolean

  /**
   * Define this function to get access to Vue App instance and augment
   * it (installing components, directives and plugins). Also useful for
   * early generic initializations. This function should be called first
   */
  onVueAppInit?: (app: App) => void

  /**
   * Called when the router is done initializing.
   * Used if a module requires access to the router instance
   */
  onRouterInit?: (app: App, router: Router) => void

  /**
   * Called when the root component (App.vue) is running setup.
   * This function is generally called last in the lifecycle.
   * This function executes with a component setup context, so you can
   * run composables within this and it should just be scoped to the
   * root component
   */
  onRootSetup?: () => void

  /**
   * Called by the router to tell all the modules before a route navigation
   * is made.
   */
  onBeforeRouteChange?: (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    router: Router
  ) => void | Promise<void>

  /**
   * Called by the router to tell all the modules that a route navigation has completed
   */
  onAfterRouteChange?: (to: RouteLocationNormalized, router: Router) => void
}

/**
 * All the modules Hoppscotch loads into the app
 */
export const HOPP_MODULES = pipe(
  import.meta.glob("@modules/*.ts", { eager: true }),
  Object.values,
  A.map(({ default: defaultVal }) => defaultVal as HoppModule),
  A.filter((module) => !module.deprecated)
)
