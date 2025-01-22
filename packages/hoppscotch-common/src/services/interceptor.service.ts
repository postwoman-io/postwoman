import * as E from "fp-ts/Either"
import { Service } from "dioc"
import { MaybeRef, refWithControl } from "@vueuse/core"
import { AxiosRequestConfig, AxiosResponse } from "axios"
import type { getI18n } from "~/modules/i18n"
import { throwError } from "~/helpers/functional/error"
import { Component, Ref, computed, reactive, watch, unref, markRaw } from "vue"

/**
 * Defines the response data from an interceptor request run.
 */
export type NetworkResponse = AxiosResponse<unknown> & {
  config?: {
    timeData?: {
      startTime: number
      endTime: number
    }
  }
  /**
   * Optional additional fields with special optional metadata that can be used
   */
  additional?: {
    /**
     * By the HTTP spec, we can have multiple headers with the same name, but
     * this is not accessible in the AxiosResponse type as the headers there are Record<string, string>
     * (and hence cannot have secondary values).
     *
     * If this value is present, headers can be read from here which will have the data.
     */
    multiHeaders?: Array<{
      key: string
      value: string
    }>
  }
}

/**
 * Defines the errors that can occur during interceptor request run.
 */
export type InterceptorError =
  | "cancellation"
  | {
      humanMessage: {
        heading: (t: ReturnType<typeof getI18n>) => string
        description: (t: ReturnType<typeof getI18n>) => string
      }
      error?: unknown
      component?: Component
    }

/**
 * Defines the result of an interceptor request run.
 */
export type RequestRunResult<Err extends InterceptorError = InterceptorError> =
  {
    /**
     * Cancels the interceptor request run.
     */
    cancel: () => void

    /**
     * Promise that resolves when the interceptor request run is finished.
     */
    response: Promise<E.Either<Err, NetworkResponse>>
  }

/**
 * Defines whether an interceptor is selectable or not
 */
export type InterceptorSelectableStatus<CustomComponentProps = any> =
  | { type: "selectable" }
  | {
      type: "unselectable"
      reason:
        | {
            type: "text"
            text: (t: ReturnType<typeof getI18n>) => string
            action?: {
              text: (t: ReturnType<typeof getI18n>) => string
              onActionClick: () => void
            }
          }
        | {
            type: "custom"
            component: Component<CustomComponentProps>
            props: CustomComponentProps
          }
    }

/**
 * An interceptor is an object that defines how to run a Hoppscotch request.
 */
export type Interceptor<Err extends InterceptorError = InterceptorError> = {
  /**
   * The ID of the interceptor. This should be unique across all registered interceptors.
   */
  interceptorID: string

  /**
   * The function that returns the name of the interceptor.
   * @param t The i18n function.
   */
  name: (t: ReturnType<typeof getI18n>) => MaybeRef<string>

  /**
   * Defines whether the interceptor has support for cookies.
   * If this field is undefined, it is assumed as *not supporting* cookies.
   */
  supportsCookies?: boolean

  /**
   * Defines whether the interceptor has support for Digest Auth.
   * If this field is undefined, it is assumed as *not supporting* the Digest Auth type.
   */
  supportsDigestAuth?: boolean

  /**
   * Defines whether the interceptor has support for Binary (file) content type.
   * If this field is undefined, it is assumed as *supporting* the Binary content type.
   */
  supportsBinaryContentType?: boolean

  /**
   * Defines what to render in the Interceptor section of the Settings page.
   * Use this space to define interceptor specific settings.
   * Not setting this will lead to nothing being rendered about this interceptor in the settings page.
   */
  settingsPageEntry?: {
    /**
     * The title of the interceptor entry in the settings page.
     */
    entryTitle: (t: ReturnType<typeof getI18n>) => string

    /**
     * The component to render in the settings page.
     */
    component: Component
  }

  /**
   * Defines what to render under the entry for the interceptor in the Interceptor selector.
   */
  selectorSubtitle?: Component

  /**
   * Defines whether the interceptor is selectable or not.
   */
  selectable: MaybeRef<InterceptorSelectableStatus<unknown>>

  /**
   * Runs the interceptor on the given request.
   * NOTE: Make sure this function doesn't throw, instead when an error occurs, return a Left Either with the error.
   * @param request The request to run the interceptor on.
   */
  runRequest: (request: AxiosRequestConfig) => RequestRunResult<Err>
}

/**
 * This service deals with the registration and execution of
 * interceptors for request execution.
 */
export class InterceptorService extends Service {
  public static readonly ID = "INTERCEPTOR_SERVICE"

  private interceptors: Map<string, Interceptor> = reactive(new Map())

  /**
   * The ID of the currently selected interceptor.
   * If `null`, there are no interceptors registered or none can be selected.
   */
  public currentInterceptorID: Ref<string | null> = refWithControl(
    null as string | null,
    {
      onBeforeChange: (value) => {
        if (!value) {
          // Only allow `null` if there are no interceptors
          return this.availableInterceptors.value.length === 0
        }

        if (value && !this.interceptors.has(value)) {
          console.warn(
            "Attempt to set current interceptor ID to unknown ID is ignored"
          )
          return false
        }

        return true
      },
    }
  )

  /**
   * List of interceptors that are registered with the service.
   */
  public availableInterceptors = computed(() =>
    Array.from(this.interceptors.values())
  )

  /**
   * Gives an instance to the current interceptor.
   *  NOTE: Do not update from here, this is only for reading.
   */
  public currentInterceptor = computed(() => {
    if (this.currentInterceptorID.value === null) return null

    return this.interceptors.get(this.currentInterceptorID.value)
  })

  override onServiceInit() {
    // If the current interceptor is unselectable, select the first selectable one, else null
    watch([() => this.interceptors, this.currentInterceptorID], () => {
      if (!this.currentInterceptorID.value) return

      const interceptor = this.interceptors.get(this.currentInterceptorID.value)

      if (!interceptor) {
        this.currentInterceptorID.value = null
        return
      }

      if (unref(interceptor.selectable).type === "unselectable") {
        this.currentInterceptorID.value =
          this.availableInterceptors.value.filter(
            (interceptor) => unref(interceptor.selectable).type === "selectable"
          )[0]?.interceptorID ?? null
      }
    })
  }

  /**
   * Register an interceptor with the service.
   * @param interceptor The interceptor to register
   */
  public registerInterceptor(interceptor: Interceptor) {
    // markRaw so that interceptor state by itself is not fully marked reactive
    this.interceptors.set(interceptor.interceptorID, markRaw(interceptor))

    if (this.currentInterceptorID.value === null) {
      this.currentInterceptorID.value = interceptor.interceptorID
    }
  }

  /**
   * Runs a request through the currently selected interceptor.
   * @param req The request to run
   * @throws If no interceptor is selected
   */
  public runRequest(req: AxiosRequestConfig): RequestRunResult {
    if (!this.currentInterceptorID.value) {
      throw new Error("No interceptor selected")
    }

    const interceptor =
      this.interceptors.get(this.currentInterceptorID.value) ??
      throwError(
        "Current Interceptor ID is not found in the list of registered interceptors"
      )

    return interceptor.runRequest(req)
  }
}
