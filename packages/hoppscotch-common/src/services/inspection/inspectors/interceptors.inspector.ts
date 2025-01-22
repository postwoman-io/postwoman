import { Service } from "dioc"
import { InspectionService, Inspector, InspectorResult } from ".."
import { computed, Ref } from "vue"
import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"

import IconAlertCircle from "~icons/lucide/alert-circle"
import { InterceptorService } from "~/services/interceptor.service"
import { getI18n } from "~/modules/i18n"

/**
 * This inspector is responsible for inspecting the interceptor usage.
 *
 * NOTE: Initializing this service registers it as a inspector with the Inspection Service.
 */
export class InterceptorsInspectorService extends Service implements Inspector {
  public static readonly ID = "INTERCEPTORS_INSPECTOR_SERVICE"

  inspectorID = "interceptors"

  private t = getI18n()

  private readonly inspection = this.bind(InspectionService)
  private readonly interceptors = this.bind(InterceptorService)

  onServiceInit() {
    this.inspection.registerInspector(this)
  }

  getInspections(
    req: Readonly<Ref<HoppRESTRequest | HoppRESTResponseOriginalRequest>>
  ) {
    return computed((): InspectorResult[] => {
      if (!req.value) {
        return []
      }

      const isBinaryBody =
        req.value.body.contentType === "application/octet-stream"

      const currentInterceptor = this.interceptors.currentInterceptor.value

      // TODO: Maybe move feature determination/checking related things to interceptor system.
      if (
        isBinaryBody &&
        currentInterceptor &&
        currentInterceptor.supportsBinaryContentType === false
      ) {
        return [
          {
            isApplicable: true,
            icon: IconAlertCircle,
            severity: 2,
            text: {
              type: "text",
              text: this.t(
                "inspections.requestBody.active_interceptor_doesnt_support_binary_body"
              ),
            },
            locations: {
              type: "body-content-type-header",
            },
            id: "interceptors-inspector-binary-agent-body-content-type-header",
          },
        ]
      }

      return []
    })
  }
}
