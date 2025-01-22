import { Service } from "dioc"
import { InspectionService, Inspector, InspectorResult } from ".."
import { getI18n } from "~/modules/i18n"
import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import { Ref, computed, markRaw } from "vue"
import IconAlertTriangle from "~icons/lucide/alert-triangle"
import { InterceptorService } from "~/services/interceptor.service"

/**
 * This inspector is responsible for inspecting the header of a request.
 * It checks if the header contains cookies.
 *
 * NOTE: Initializing this service registers it as a inspector with the Inspection Service.
 */
export class HeaderInspectorService extends Service implements Inspector {
  public static readonly ID = "HEADER_INSPECTOR_SERVICE"

  private t = getI18n()

  public readonly inspectorID = "header"

  private readonly inspection = this.bind(InspectionService)
  private readonly interceptorService = this.bind(InterceptorService)

  override onServiceInit() {
    this.inspection.registerInspector(this)
  }

  private cookiesCheck(headerKey: string) {
    const cookieKeywords = ["Cookie", "Set-Cookie", "Cookie2", "Set-Cookie2"]

    return cookieKeywords.includes(headerKey)
  }

  getInspections(
    req: Readonly<Ref<HoppRESTRequest | HoppRESTResponseOriginalRequest>>
  ) {
    return computed(() => {
      const results: InspectorResult[] = []

      if (!req.value) return results

      const headers = req.value.headers

      const headerKeys = Object.values(headers).map((header) => header.key)

      const isContainCookies = headerKeys.includes("Cookie")

      if (
        isContainCookies &&
        !this.interceptorService.currentInterceptor.value?.supportsCookies
      ) {
        headerKeys.forEach((headerKey, index) => {
          if (this.cookiesCheck(headerKey)) {
            results.push({
              id: "header",
              icon: markRaw(IconAlertTriangle),
              text: {
                type: "text",
                text: this.t("inspections.header.cookie"),
              },
              severity: 2,
              isApplicable: true,
              locations: {
                type: "header",
                position: "key",
                key: headerKey,
                index: index,
              },
              doc: {
                text: this.t("action.download_here"),
                link: "https://hoppscotch.com/download",
              },
            })
          }
        })
      }

      return results
    })
  }
}
