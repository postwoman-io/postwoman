import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import { Service } from "dioc"
import { computed, markRaw, Ref } from "vue"

import { getI18n } from "~/modules/i18n"
import { InterceptorService } from "~/services/interceptor.service"
import { RESTTabService } from "~/services/tab/rest"
import IconAlertTriangle from "~icons/lucide/alert-triangle"
import { InspectionService, Inspector, InspectorResult } from ".."

/**
 * This inspector is responsible for inspecting the authorization properties of a request.
 * Only applies to REST tabs currently.
 *
 * NOTE: Initializing this service registers it as a inspector with the Inspection Service.
 */
export class AuthorizationInspectorService
  extends Service
  implements Inspector
{
  public static readonly ID = "AUTHORIZATION_INSPECTOR_SERVICE"

  private t = getI18n()

  public readonly inspectorID = "authorization"

  private readonly inspection = this.bind(InspectionService)
  private readonly interceptorService = this.bind(InterceptorService)
  private readonly restTabService = this.bind(RESTTabService)

  override onServiceInit() {
    this.inspection.registerInspector(this)
  }

  private resolveAuthType(auth: HoppRESTRequest["auth"]) {
    if (auth.authType !== "inherit") {
      return auth.authType
    }

    const activeTabDocument =
      this.restTabService.currentActiveTab.value.document

    if (
      activeTabDocument.type === "example-response" ||
      activeTabDocument.type === "test-runner"
    ) {
      return null
    }

    const { inheritedProperties } = activeTabDocument

    if (!inheritedProperties) {
      return null
    }

    return inheritedProperties.auth.inheritedAuth.authType
  }

  getInspections(
    req: Readonly<Ref<HoppRESTRequest | HoppRESTResponseOriginalRequest>>
  ) {
    return computed(() => {
      if (!req.value) return []
      const currentInterceptorIDValue =
        this.interceptorService.currentInterceptorID.value

      if (!currentInterceptorIDValue) {
        return []
      }

      const auth = req.value.auth

      const results: InspectorResult[] = []

      const resolvedAuthType = this.resolveAuthType(auth)

      if (
        resolvedAuthType === "digest" &&
        !this.interceptorService.currentInterceptor.value?.supportsDigestAuth
      ) {
        results.push({
          id: "url",
          icon: markRaw(IconAlertTriangle),
          text: {
            type: "text",
            text: this.t("authorization.digest.inspector_warning"),
          },
          severity: 2,
          isApplicable: true,
          locations: {
            type: "url",
          },
          doc: {
            text: this.t("action.learn_more"),
            link: "https://docs.hoppscotch.io/documentation/features/inspections",
          },
        })
      }

      return results
    })
  }
}
