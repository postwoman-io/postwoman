import * as E from "fp-ts/Either"
import { AxiosRequestConfig } from "axios"
import { Service } from "dioc"
import { getI18n } from "~/modules/i18n"
import {
  Interceptor,
  InterceptorError,
  RequestRunResult,
} from "~/services/interceptor.service"
import { computed, readonly, ref } from "vue"
import { browserIsChrome, browserIsFirefox } from "~/helpers/utils/userAgent"
import SettingsExtension from "~/components/settings/Extension.vue"
import InterceptorsExtensionSubtitle from "~/components/interceptors/ExtensionSubtitle.vue"
import InterceptorsErrorPlaceholder from "~/components/interceptors/ErrorPlaceholder.vue"
import { until } from "@vueuse/core"
import { preProcessRequest } from "./helpers"

export const defineSubscribableObject = <T extends object>(obj: T) => {
  const proxyObject = {
    ...obj,
    _subscribers: {} as {
      // eslint-disable-next-line no-unused-vars
      [key in keyof T]?: ((...args: any[]) => any)[]
    },
    subscribe(prop: keyof T, func: (...args: any[]) => any): void {
      if (Array.isArray(this._subscribers[prop])) {
        this._subscribers[prop]?.push(func)
      } else {
        this._subscribers[prop] = [func]
      }
    },
  }

  type SubscribableProxyObject = typeof proxyObject

  return new Proxy(proxyObject, {
    set(obj, prop, newVal) {
      obj[prop as keyof SubscribableProxyObject] = newVal

      const currentSubscribers = obj._subscribers[prop as keyof T]

      if (Array.isArray(currentSubscribers)) {
        for (const subscriber of currentSubscribers) {
          subscriber(newVal)
        }
      }

      return true
    },
  })
}

// TODO: Rework this to deal with individual requests rather than cancel all
export const cancelRunningExtensionRequest = () => {
  window.__POSTWOMAN_EXTENSION_HOOK__?.cancelRequest()
}

export type ExtensionStatus = "available" | "unknown-origin" | "waiting"

/**
 * This service is responsible for defining the extension interceptor.
 */
export class ExtensionInterceptorService
  extends Service
  implements Interceptor
{
  public static readonly ID = "EXTENSION_INTERCEPTOR_SERVICE"

  private _extensionStatus = ref<ExtensionStatus>("waiting")

  /**
   * The status of the extension, whether it's available, or not.
   */
  public extensionStatus = readonly(this._extensionStatus)

  /**
   * The version of the extension, if available.
   */
  public extensionVersion = computed(() => {
    if (this.extensionStatus.value === "available") {
      return window.__POSTWOMAN_EXTENSION_HOOK__?.getVersion()
    }
    return null
  })

  /**
   * Whether the extension is installed in Chrome or not.
   */
  public chromeExtensionInstalled = computed(
    () => this.extensionStatus.value === "available" && browserIsChrome()
  )

  /**
   * Whether the extension is installed in Firefox or not.
   */
  public firefoxExtensionInstalled = computed(
    () => this.extensionStatus.value === "available" && browserIsFirefox()
  )

  public interceptorID = "extension"

  public settingsPageEntry: Interceptor["settingsPageEntry"] = {
    entryTitle: (t) => t("settings.extensions"),
    component: SettingsExtension,
  }

  public selectorSubtitle = InterceptorsExtensionSubtitle

  public selectable = { type: "selectable" as const }

  override onServiceInit() {
    this.listenForExtensionStatus()
  }

  private listenForExtensionStatus() {
    const extensionPollIntervalId = ref<ReturnType<typeof setInterval>>()

    if (window.__HOPP_EXTENSION_STATUS_PROXY__) {
      this._extensionStatus.value =
        window.__HOPP_EXTENSION_STATUS_PROXY__.status

      window.__HOPP_EXTENSION_STATUS_PROXY__.subscribe(
        "status",
        (status: ExtensionStatus) => {
          this._extensionStatus.value = status
        }
      )
    } else {
      const statusProxy = defineSubscribableObject({
        status: "waiting" as ExtensionStatus,
      })

      window.__HOPP_EXTENSION_STATUS_PROXY__ = statusProxy
      statusProxy.subscribe(
        "status",
        (status: ExtensionStatus) => (this._extensionStatus.value = status)
      )

      /**
       * Keeping identifying extension backward compatible
       * We are assuming the default version is 0.24 or later. So if the extension exists, its identified immediately,
       * then we use a poll to find the version, this will get the version for 0.24 and any other version
       * of the extension, but will have a slight lag.
       * 0.24 users will get the benefits of 0.24, while the extension won't break for the old users
       */
      extensionPollIntervalId.value = setInterval(() => {
        if (typeof window.__POSTWOMAN_EXTENSION_HOOK__ !== "undefined") {
          if (extensionPollIntervalId.value)
            clearInterval(extensionPollIntervalId.value)

          const version = window.__POSTWOMAN_EXTENSION_HOOK__.getVersion()

          // When the version is not 0.24 or higher, the extension wont do this. so we have to do it manually
          if (
            version.major === 0 &&
            version.minor <= 23 &&
            window.__HOPP_EXTENSION_STATUS_PROXY__
          ) {
            window.__HOPP_EXTENSION_STATUS_PROXY__.status = "available"
          }
        }
      }, 2000)
    }
  }

  public name(t: ReturnType<typeof getI18n>) {
    return computed(() => {
      const version = window.__POSTWOMAN_EXTENSION_HOOK__?.getVersion()

      if (this.extensionStatus.value === "available" && version) {
        const { major, minor } = version
        return `${t("settings.extensions")}: v${major}.${minor}`
      }
      return `${t("settings.extensions")}: ${t(
        "settings.extension_ver_not_reported"
      )}`
    })
  }

  private async runRequestOnExtension(
    req: AxiosRequestConfig
  ): RequestRunResult["response"] {
    // wait for the extension to resolve
    await until(this.extensionStatus).toMatch(
      (status) => status !== "waiting",
      {
        timeout: 1000,
      }
    )

    const extensionHook = window.__POSTWOMAN_EXTENSION_HOOK__
    if (!extensionHook) {
      return E.left(<InterceptorError>{
        // TODO: i18n this
        humanMessage: {
          heading: () => "Extension not found",
          description: () => "Heading not found",
        },
        error: "NO_PW_EXT_HOOK",
        component: InterceptorsErrorPlaceholder,
      })
    }

    try {
      const result = await extensionHook.sendRequest({
        ...req,
        headers: req.headers ?? {},
        wantsBinary: true,
      })

      return E.right(result)
    } catch (e) {
      console.error(e)
      // TODO: improve type checking
      if ((e as any).response) {
        return E.right((e as any).response)
      }

      return E.left(<InterceptorError>{
        // TODO: i18n this
        humanMessage: {
          heading: () => "Extension error",
          description: () => "Failed running request on extension",
        },
        error: e,
      })
    }
  }

  public runRequest(
    request: AxiosRequestConfig
  ): RequestRunResult<InterceptorError> {
    const processedReq = preProcessRequest(request)

    return {
      cancel: cancelRunningExtensionRequest,
      response: this.runRequestOnExtension(processedReq),
    }
  }
}
