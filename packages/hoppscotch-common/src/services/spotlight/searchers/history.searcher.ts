import { Service } from "dioc"
import {
  SpotlightSearcher,
  SpotlightSearcherResult,
  SpotlightSearcherSessionState,
  SpotlightService,
} from "../"
import { Ref, computed, effectScope, markRaw, ref, watch } from "vue"
import { getI18n } from "~/modules/i18n"
import MiniSearch from "minisearch"
import { graphqlHistoryStore, restHistoryStore } from "~/newstore/history"
import { useTimeAgo } from "@vueuse/core"
import IconHistory from "~icons/lucide/history"
import IconTrash2 from "~icons/lucide/trash-2"
import SpotlightRESTHistoryEntry from "~/components/app/spotlight/entry/RESTHistory.vue"
import SpotlightGQLHistoryEntry from "~/components/app/spotlight/entry/GQLHistory.vue"
import { capitalize } from "lodash-es"
import { shortDateTime } from "~/helpers/utils/date"
import { useStreamStatic } from "~/composables/stream"
import { activeActions$, invokeAction } from "~/helpers/actions"
import { map } from "rxjs/operators"
import { HoppRequestDocument } from "~/helpers/rest/document"
import { platform } from "~/platform"

/**
 * This searcher is responsible for searching through the history.
 * It also provides actions to clear the history.
 *
 * NOTE: Initializing this service registers it as a searcher with the Spotlight Service.
 */
export class HistorySpotlightSearcherService
  extends Service
  implements SpotlightSearcher
{
  public static readonly ID = "HISTORY_SPOTLIGHT_SEARCHER_SERVICE"

  private t = getI18n()

  public searcherID = "history"
  public searcherSectionTitle = this.t("tab.history")

  private readonly spotlight = this.bind(SpotlightService)

  private clearHistoryActionEnabled = useStreamStatic(
    activeActions$.pipe(map((actions) => actions.includes("history.clear"))),
    activeActions$.value.includes("history.clear"),
    () => {
      /* noop */
    }
  )[0]

  private hasHistoryPlatformDef = "requestHistoryStore" in platform.sync.history

  private isHistoryEnabledPlatformRef =
    platform.sync.history.requestHistoryStore?.isHistoryStoreEnabled

  private clearHistoryActionEnabledCombined = computed(() => {
    // if the platform has not defined the history store, by default we consider history is enabled
    if (!this.hasHistoryPlatformDef) return this.clearHistoryActionEnabled.value

    // if the platform has defined the history store, we check the defined values to determine if history is enabled
    return (
      this.clearHistoryActionEnabled.value &&
      this.isHistoryEnabledPlatformRef?.value
    )
  })

  private restHistoryEntryOpenable = useStreamStatic(
    activeActions$.pipe(
      map((actions) => actions.includes("rest.request.open"))
    ),
    activeActions$.value.includes("rest.request.open"),
    () => {
      /* noop */
    }
  )[0]

  private gqlHistoryEntryOpenable = useStreamStatic(
    activeActions$.pipe(map((actions) => actions.includes("gql.request.open"))),
    activeActions$.value.includes("gql.request.open"),
    () => {
      /* noop */
    }
  )[0]

  override onServiceInit() {
    this.spotlight.registerSearcher(this)
  }

  createSearchSession(
    query: Readonly<Ref<string>>
  ): [Ref<SpotlightSearcherSessionState>, () => void] {
    const loading = ref(false)
    const results = ref<SpotlightSearcherResult[]>([])

    const minisearch = new MiniSearch({
      fields: ["url", "title", "reltime", "date"],
      storeFields: ["url"],
    })

    const stopWatchHandle = watch(
      this.clearHistoryActionEnabledCombined,
      (enabled) => {
        if (enabled) {
          if (minisearch.has("clear-history")) return

          minisearch.add({
            id: "clear-history",
            title: this.t("action.clear_history"),
          })
        } else {
          if (!minisearch.has("clear-history")) return

          minisearch.discard("clear-history")
        }
      },
      { immediate: true }
    )

    if (this.restHistoryEntryOpenable.value) {
      minisearch.addAll(
        restHistoryStore.value.state
          .filter((x) => !!x.updatedOn)
          .map((entry, index) => {
            const relTimeString = capitalize(
              useTimeAgo(entry.updatedOn!, {
                updateInterval: 0,
              }).value
            )

            return {
              id: `rest-${index}`,
              url: entry.request.endpoint,
              reltime: relTimeString,
              date: shortDateTime(entry.updatedOn!),
            }
          })
      )
    }

    if (this.gqlHistoryEntryOpenable.value) {
      minisearch.addAll(
        graphqlHistoryStore.value.state
          .filter((x) => !!x.updatedOn)
          .map((entry, index) => {
            const relTimeString = capitalize(
              useTimeAgo(entry.updatedOn!, {
                updateInterval: 0,
              }).value
            )

            return {
              id: `gql-${index}`,
              url: entry.request.url,
              reltime: relTimeString,
              date: shortDateTime(entry.updatedOn!),
            }
          })
      )
    }

    const scopeHandle = effectScope()

    scopeHandle.run(() => {
      watch(
        [query, this.clearHistoryActionEnabled],
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
              if (x.id === "clear-history") {
                return {
                  id: "clear-history",
                  icon: markRaw(IconTrash2),
                  score: x.score,
                  text: {
                    type: "text",
                    text: this.t("action.clear_history"),
                  },
                }
              }
              if (x.id.startsWith("rest-")) {
                const entry =
                  restHistoryStore.value.state[parseInt(x.id.split("-")[1])]

                return {
                  id: x.id,
                  icon: markRaw(IconHistory),
                  score: x.score,
                  text: {
                    type: "custom",
                    component: markRaw(SpotlightRESTHistoryEntry),
                    componentProps: {
                      historyEntry: entry,
                    },
                  },
                }
              }
              // Assume gql
              const entry =
                graphqlHistoryStore.value.state[parseInt(x.id.split("-")[1])]

              return {
                id: x.id,
                icon: markRaw(IconHistory),
                score: x.score,
                text: {
                  type: "custom",
                  component: markRaw(SpotlightGQLHistoryEntry),
                  componentProps: {
                    historyEntry: entry,
                  },
                },
              }
            })
        },
        { immediate: true }
      )
    })

    const onSessionEnd = () => {
      scopeHandle.stop()
      stopWatchHandle()
      minisearch.removeAll()
    }

    const resultObj = computed<SpotlightSearcherSessionState>(() => ({
      loading: loading.value,
      results: results.value,
    }))

    return [resultObj, onSessionEnd]
  }

  onResultSelect(result: SpotlightSearcherResult): void {
    if (result.id === "clear-history") {
      invokeAction("history.clear")
    } else if (result.id.startsWith("rest")) {
      const req =
        restHistoryStore.value.state[parseInt(result.id.split("-")[1])].request

      invokeAction("rest.request.open", {
        doc: <HoppRequestDocument>{
          request: req,
          isDirty: false,
          type: "request",
        },
      })
    } else {
      // Assume gql
      const req =
        graphqlHistoryStore.value.state[parseInt(result.id.split("-")[1])]
          .request

      invokeAction("gql.request.open", {
        request: req,
      })
    }
  }
}
