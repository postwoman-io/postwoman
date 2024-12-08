import { Service } from "dioc"
import { InspectionService, Inspector, InspectorResult } from ".."
import { computed, markRaw, Ref } from "vue"
import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import IconAlertTriangle from "~icons/lucide/alert-triangle"
import { getI18n } from "~/modules/i18n"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { Capabilities } from "@hoppscotch/kernel"

type CapabilityRequirement<K extends keyof Capabilities> = {
  type: K
  name: string & Capabilities[K] extends Set<infer T> ? T : never
}

interface InspectionMatch {
  index?: number
  key?: string
}

interface CapabilityCheck {
  matcher: (
    req: HoppRESTRequest | HoppRESTResponseOriginalRequest
  ) => InspectionMatch | null
  requires: CapabilityRequirement<keyof Capabilities>
  createInspection: (match: InspectionMatch) => InspectorResult
}

export class RequestInspectorService extends Service implements Inspector {
  public static readonly ID = "REQUEST_INSPECTOR_SERVICE"
  public readonly inspectorID = "request"

  private readonly t = getI18n()
  private readonly inspection = this.bind(InspectionService)
  private readonly kernelInterceptor = this.bind(KernelInterceptorService)

  private readonly inspectionChecks: CapabilityCheck[] = [
    {
      matcher: (req) => (req.auth.authType === "digest" ? {} : null),
      requires: { type: "auth", name: "digest" },
      createInspection: () => ({
        id: "digest-auth",
        icon: markRaw(IconAlertTriangle),
        text: { type: "text", text: this.t("inspections.auth.digest") },
        severity: 2,
        isApplicable: true,
        locations: { type: "url" },
        doc: {
          text: this.t("action.learn_more"),
          link: "https://docs.hoppscotch.io/documentation/features/inspections",
        },
      }),
    },
    {
      matcher: (req) => {
        const index = req.headers.findIndex((h) =>
          h.key.toLowerCase().includes("cookie")
        )
        return index !== -1 ? { index, key: req.headers[index].key } : null
      },
      requires: { type: "advanced", name: "cookies" },
      createInspection: (match) => ({
        id: "cookie-header",
        icon: markRaw(IconAlertTriangle),
        text: { type: "text", text: this.t("inspections.header.cookie") },
        severity: 2,
        isApplicable: true,
        locations: {
          type: "header",
          position: "key",
          ...match,
        },
        doc: {
          text: this.t("action.learn_more"),
          link: "https://hoppscotch.com/download",
        },
      }),
    },
    {
      matcher: (req) =>
        req.body.contentType === "application/octet-stream" ? {} : null,
      requires: { type: "content", name: "binary" },
      createInspection: () => ({
        id: "binary-body",
        icon: markRaw(IconAlertTriangle),
        text: { type: "text", text: this.t("inspections.body.binary") },
        severity: 2,
        isApplicable: true,
        locations: { type: "body-content-type-header" },
        doc: {
          text: this.t("action.learn_more"),
          link: "https://docs.hoppscotch.io/documentation/features/inspections",
        },
      }),
    },
  ]

  override onServiceInit() {
    this.inspection.registerInspector(this)
  }

  private validateCapability(
    req: HoppRESTRequest | HoppRESTResponseOriginalRequest,
    { matcher, requires, createInspection }: CapabilityCheck
  ): InspectorResult[] {
    const match = matcher(req)
    if (!match) return []

    const capabilities = this.kernelInterceptor.capabilities
    const supports = capabilities.value[requires.type].has(requires.name)

    return !supports ? [createInspection(match)] : []
  }

  getInspections(
    req: Readonly<Ref<HoppRESTRequest | HoppRESTResponseOriginalRequest>>
  ) {
    return computed(() =>
      !req.value
        ? []
        : this.inspectionChecks.flatMap((check) =>
            this.validateCapability(req.value, check)
          )
    )
  }
}
