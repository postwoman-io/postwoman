import { Service } from "dioc"
import {
  InspectionService,
  Inspector,
  InspectorResult,
} from "~/services/inspection"
import { getI18n } from "~/modules/i18n"
import { HoppRESTRequest } from "@hoppscotch/data"
import { computed, markRaw } from "vue"
import IconAlertTriangle from "~icons/lucide/alert-triangle"
import { Ref } from "vue"
import { InterceptorService } from "~/services/interceptor.service"
import { ExtensionInterceptorService } from "~/platform/std/interceptors/extension"

/**
 * This inspector is responsible for inspecting the URL of a request.
 * It checks if the URL contains localhost and if the extension is installed.
 * It also provides an action to enable the extension.
 *
 * NOTE: Initializing this service registers it as a inspector with the Inspection Service.
 */
export class ExtensionInspectorService extends Service implements Inspector {
  public static readonly ID = "EXTENSION_INSPECTOR_SERVICE"

  private t = getI18n()

  public readonly inspectorID = "extension"

  private readonly interceptorService = this.bind(InterceptorService)
  private readonly extensionService = this.bind(ExtensionInterceptorService)

  private readonly inspection = this.bind(InspectionService)

  override onServiceInit() {
    this.inspection.registerInspector(this)
  }

  getInspections(req: Readonly<Ref<HoppRESTRequest | null>>) {
    const currentExtensionStatus = this.extensionService.extensionStatus

    const isExtensionInstalled = computed(
      () => currentExtensionStatus.value === "available"
    )

    const activeInterceptor = computed(
      () => this.interceptorService.currentInterceptorID.value
    )

    const EXTENSION_ENABLED = computed(
      () => activeInterceptor.value === "extension"
    )

    const AGENT_ENABLED = computed(() => activeInterceptor.value === "agent")

    return computed(() => {
      const results: InspectorResult[] = []

      if (!req.value) return results

      const url = req.value.endpoint
      const localHostURLs = ["localhost", "127.0.0.1"]

      const isContainLocalhost = localHostURLs.some((host) =>
        url.includes(host)
      )

      // Prompt the user to install or enable the extension via inspector if the endpoint is `localhost`, and an interceptor other than `Agent` is active
      if (
        isContainLocalhost &&
        !AGENT_ENABLED.value &&
        (!EXTENSION_ENABLED.value || !isExtensionInstalled.value)
      ) {
        let text

        if (!isExtensionInstalled.value) {
          if (currentExtensionStatus.value === "unknown-origin") {
            text = this.t("inspections.url.extension_unknown_origin")
          } else {
            text = this.t("inspections.url.extension_not_installed")
          }
        } else if (!EXTENSION_ENABLED.value) {
          text = this.t("inspections.url.extention_not_enabled")
        } else {
          text = this.t("inspections.url.localhost")
        }

        results.push({
          id: "url",
          icon: markRaw(IconAlertTriangle),
          text: {
            type: "text",
            text: text,
          },
          action: {
            text: this.t("inspections.url.extention_enable_action"),
            apply: () => {
              this.interceptorService.currentInterceptorID.value = "extension"
            },
          },
          severity: 2,
          isApplicable: true,
          locations: {
            type: "url",
          },
          doc: {
            text: this.t("action.learn_more"),
            link: "https://docs.hoppscotch.io/documentation/features/interceptor#browser-extension",
          },
        })
      }

      return results
    })
  }
}
