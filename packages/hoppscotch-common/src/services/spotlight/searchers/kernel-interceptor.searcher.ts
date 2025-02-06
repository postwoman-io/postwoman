import { Ref, computed, effectScope, markRaw, ref, unref, watch } from "vue"
import { getI18n } from "~/modules/i18n"
import {
  SpotlightSearcher,
  SpotlightSearcherResult,
  SpotlightSearcherSessionState,
  SpotlightService,
} from ".."

import { Service } from "dioc"
import MiniSearch from "minisearch"
import IconCheckCircle from "~/components/app/spotlight/entry/IconSelected.vue"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import IconCircle from "~icons/lucide/circle"

/**
 * This searcher is responsible for searching through the kernel-interceptor.
 * And switching between them.
 */
export class KernelInterceptorSpotlightSearcherService
  extends Service
  implements SpotlightSearcher
{
  public static readonly ID = "KERNEL_INTERCEPTOR_SPOTLIGHT_SEARCHER_SERVICE"

  private t = getI18n()

  public searcherID = "kernel-interceptor"
  public searcherSectionTitle = this.t("settings.interceptor")

  private readonly spotlight = this.bind(SpotlightService)
  private kernelInterceptorService = this.bind(KernelInterceptorService)

  override onServiceInit() {
    this.spotlight.registerSearcher(this)
  }

  createSearchSession(
    query: Readonly<Ref<string>>
  ): [Ref<SpotlightSearcherSessionState>, () => void] {
    const loading = ref(false)
    const results = ref<SpotlightSearcherResult[]>([])

    const minisearch = new MiniSearch({
      fields: ["name", "alternates"],
      storeFields: ["name"],
    })

    const kernelInterceptorSelection = this.kernelInterceptorService.current

    const kernelInterceptors = this.kernelInterceptorService.available

    minisearch.addAll(
      kernelInterceptors.value.map((entry) => {
        const id =
          entry.id === kernelInterceptorSelection.value?.id
            ? `kernelInterceptor-${entry.id}-selected`
            : `kernelInterceptor-${entry.id}`
        const name = unref(entry.name(this.t))
        const alternates = ["interceptor", "change", name]

        return {
          id,
          name,
          alternates,
        }
      })
    )

    const scopeHandle = effectScope()

    scopeHandle.run(() => {
      watch(
        [query],
        ([query]) => {
          results.value = minisearch
            .search(query, {
              prefix: true,
              fuzzy: true,
              boost: {
                reltime: 2,
              },
              weights: {
                fuzzy: 0.2,
                prefix: 0.8,
              },
            })
            .map((x) => {
              return {
                id: x.id,
                icon: markRaw(
                  x.id.endsWith("-selected") ? IconCheckCircle : IconCircle
                ),
                score: x.score,
                text: {
                  type: "text",
                  text: [this.t("spotlight.section.interceptor"), x.name],
                },
              }
            })
        },
        { immediate: true }
      )
    })

    const onSessionEnd = () => {
      scopeHandle.stop()
      minisearch.removeAll()
    }

    const resultObj = computed<SpotlightSearcherSessionState>(() => ({
      loading: loading.value,
      results: results.value,
    }))

    return [resultObj, onSessionEnd]
  }

  onResultSelect(result: SpotlightSearcherResult): void {
    const selectedInterceptor = result.id.split("-")[1]
    this.kernelInterceptorService.setActive(selectedInterceptor)
  }
}
