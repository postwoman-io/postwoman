import { Service } from "dioc"
import { InspectionService, Inspector, InspectorResult } from ".."
import { getI18n } from "~/modules/i18n"
import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import { markRaw, ref, watch, nextTick } from "vue"
import IconAlertTriangle from "~icons/lucide/alert-triangle"
import IconLoader from "~icons/lucide/loader"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { Ref } from "vue"
import { computed } from "vue"
import * as E from "fp-ts/Either"
import { platform } from "~/platform"
import { useAIExperiments } from "~/composables/ai-experiments"
import AIDiagnosisInspector from "~/components/aiexperiments/AIDiagnosisInspector.vue"

/**
 * This inspector is responsible for inspecting the response of a request.
 * It checks if the response is successful and if it contains errors.
 *
 * NOTE: Initializing this service registers it as a inspector with the Inspection Service.
 */
export class ResponseInspectorService extends Service implements Inspector {
  public static readonly ID = "RESPONSE_INSPECTOR_SERVICE"

  private t = getI18n()

  public readonly inspectorID = "response"

  private readonly inspection = this.bind(InspectionService)

  private inspectionResults = ref<InspectorResult[]>([])
  private isLoadingAI = ref(false)

  private async updateInspectionResults(results: InspectorResult[]) {
    this.inspectionResults.value = [...results]
    await nextTick()
  }

  override onServiceInit() {
    this.inspection.registerInspector(this)
  }

  getInspections(
    req: Readonly<Ref<HoppRESTRequest | HoppRESTResponseOriginalRequest>>,
    res: Readonly<Ref<HoppRESTResponse | null | undefined>>
  ) {
    const { shouldEnableAIFeatures } = useAIExperiments()

    // Watch for response changes to trigger inspection updates
    watch(
      [res, shouldEnableAIFeatures],
      async ([newRes]) => {
        if (!newRes) {
          await this.updateInspectionResults([])
          return
        }

        const baseResults: InspectorResult[] = []

        const hasErrors =
          newRes.type !== "success" ||
          (newRes.type === "success" && newRes.statusCode !== 200)

        let text: string | undefined = undefined

        if (newRes.type === "network_fail" && !navigator.onLine) {
          text = this.t("inspections.response.network_error")
        } else if (newRes.type === "fail") {
          text = this.t("inspections.response.default_error")
        } else if (newRes.type === "success" && newRes.statusCode === 404) {
          text = this.t("inspections.response.404_error")
        } else if (newRes.type === "success" && newRes.statusCode === 401) {
          text = this.t("inspections.response.401_error")
        }

        if (hasErrors && text) {
          baseResults.push({
            id: "url",
            icon: markRaw(IconAlertTriangle),
            text: {
              type: "text",
              text: text,
            },
            severity: 2,
            isApplicable: true,
            locations: {
              type: "response",
            },
            doc: {
              text: this.t("action.learn_more"),
              link: "https://docs.hoppscotch.io/documentation/features/inspections",
            },
          })

          // Update UI with base results first
          await this.updateInspectionResults(baseResults)

          // Add AI diagnosis if AI features are enabled
          if (
            shouldEnableAIFeatures.value &&
            platform.experiments?.aiExperiments?.diagnoseError
          ) {
            this.isLoadingAI.value = true
            // Show loading state
            await this.updateInspectionResults([
              ...baseResults,
              {
                id: "ai_diagnosis_loading",
                icon: markRaw(IconLoader),
                text: {
                  type: "text",
                  text: "AI is analyzing your request...",
                },
                severity: 1,
                isApplicable: true,
                locations: {
                  type: "response",
                },
              },
            ])

            try {
              const aiResult =
                await platform.experiments.aiExperiments.diagnoseError(
                  JSON.stringify(req.value),
                  JSON.stringify(newRes)
                )

              if (E.isRight(aiResult)) {
                // Update with final results including AI diagnosis
                await this.updateInspectionResults([
                  ...baseResults,
                  {
                    id: "ai_diagnosis",
                    icon: markRaw(IconAlertTriangle),
                    text: {
                      type: "custom",
                      component: markRaw(AIDiagnosisInspector),
                      componentProps: {
                        diagnosis: aiResult.right.diagnosis,
                        fix: aiResult.right.fix,
                        traceID: aiResult.right.trace_id,
                      },
                    },
                    severity: 2,
                    isApplicable: true,
                    locations: {
                      type: "response",
                    },
                  },
                ])
              }
            } catch (error) {
              // Update with error state
              await this.updateInspectionResults([
                ...baseResults,
                {
                  id: "ai_diagnosis_error",
                  icon: markRaw(IconAlertTriangle),
                  text: {
                    type: "text",
                    text: "Failed to get AI diagnosis for now.",
                  },
                  severity: 1,
                  isApplicable: true,
                  locations: {
                    type: "response",
                  },
                },
              ])
            } finally {
              this.isLoadingAI.value = false
            }
          } else {
            // If AI features are not enabled, just show base results
            await this.updateInspectionResults(baseResults)
          }
        } else {
          // If no errors, clear the results
          await this.updateInspectionResults([])
        }
      },
      { immediate: true }
    )

    return computed(() => {
      return this.inspectionResults.value
    })
  }
}
