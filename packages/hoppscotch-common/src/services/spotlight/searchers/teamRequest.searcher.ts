import { Service } from "dioc"
import {
  SpotlightResultTextType,
  SpotlightSearcher,
  SpotlightSearcherResult,
  SpotlightSearcherSessionState,
  SpotlightService,
} from ".."
import { getI18n } from "~/modules/i18n"
import { Ref, computed, effectScope, markRaw, ref, watch } from "vue"
import { TeamSearchService } from "~/helpers/teams/TeamsSearch.service"
import { cloneDeep, debounce } from "lodash-es"
import IconFolder from "~icons/lucide/folder"
import IconImport from "~icons/lucide/folder-down"
import { WorkspaceService } from "~/services/workspace.service"
import RESTTeamRequestEntry from "~/components/app/spotlight/entry/RESTTeamRequestEntry.vue"
import { RESTTabService } from "~/services/tab/rest"
import { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { HoppRESTRequest } from "@hoppscotch/data"
import MiniSearch from "minisearch"
import { invokeAction } from "~/helpers/actions"

export class TeamsSpotlightSearcherService
  extends Service
  implements SpotlightSearcher
{
  public static readonly ID = "TEAMS_SPOTLIGHT_SEARCHER_SERVICE"

  private t = getI18n()

  public searcherID = "teams"
  public searcherSectionTitle = this.t("team.search_title")

  private readonly spotlight = this.bind(SpotlightService)

  private readonly teamsSearch = this.bind(TeamSearchService)

  private readonly workspaceService = this.bind(WorkspaceService)

  private readonly tabs = this.bind(RESTTabService)

  override onServiceInit() {
    this.spotlight.registerSearcher(this)
  }

  private getCurrentPageCategory() {
    // TODO: Better logic for this ?
    try {
      const url = new URL(window.location.href)

      if (url.pathname.startsWith("/graphql")) {
        return "graphql"
      } else if (url.pathname === "/") {
        return "rest"
      }
      return "other"
    } catch (e) {
      return "other"
    }
  }

  createSearchSession(
    query: Readonly<Ref<string>>
  ): [Ref<SpotlightSearcherSessionState>, () => void] {
    const pageCategory = this.getCurrentPageCategory()

    // Only show the searcher on the REST page
    if (pageCategory !== "rest") {
      return [computed(() => ({ loading: false, results: [] })), () => {}]
    }

    const results = ref<SpotlightSearcherResult[]>([])

    const minisearch = new MiniSearch({
      fields: ["name"],
      storeFields: ["name"],
      searchOptions: {
        prefix: true,
        fuzzy: true,
        boost: {
          name: 2,
        },
        weights: {
          fuzzy: 0.2,
          prefix: 0.8,
        },
      },
    })

    minisearch.add({
      id: `create-collection`,
      name: this.t("collection.new"),
    })
    minisearch.add({
      id: "import-collection",
      name: this.t("collection.import"),
    })

    const newCollectionText: SpotlightResultTextType<any> = {
      type: "text",
      text: this.t("collection.new"),
    }

    const importCollectionText: SpotlightResultTextType<any> = {
      type: "text",
      text: this.t("collection.import_collection"),
    }

    const getResultText = (id: string): SpotlightResultTextType<any> => {
      if (id === "create-collection") return newCollectionText
      return importCollectionText
    }

    const getResultIcon = (id: string) => {
      if (id === "import-collection") return markRaw(IconImport)
      return markRaw(IconFolder)
    }

    const isTeamWorkspace = computed(
      () => this.workspaceService.currentWorkspace.value.type === "team"
    )

    const scopeHandle = effectScope()

    scopeHandle.run(() => {
      const debouncedSearch = debounce(this.teamsSearch.searchTeams, 400)

      watch(
        query,
        (query) => {
          if (this.workspaceService.currentWorkspace.value.type === "team") {
            const teamID = this.workspaceService.currentWorkspace.value.teamID
            debouncedSearch(query, teamID)?.catch(() => {})
            const searchResults = minisearch.search(query).slice(0, 10)
            results.value = searchResults.map((result) => ({
              id: result.id,
              text: getResultText(result.id),
              icon: getResultIcon(result.id),
              score: result.score,
            }))
          }
        },
        {
          immediate: true,
        }
      )

      // set the search section title based on the current workspace
      const teamName = computed(() => {
        return (
          (this.workspaceService.currentWorkspace.value.type === "team" &&
            this.workspaceService.currentWorkspace.value.teamName) ||
          this.t("team.search_title")
        )
      })

      watch(
        teamName,
        (newTeamName) => {
          this.searcherSectionTitle = newTeamName
        },
        {
          immediate: true,
        }
      )
    })

    const onSessionEnd = () => {
      scopeHandle.stop()
    }

    const resultObj = computed<SpotlightSearcherSessionState>(() => {
      if (isTeamWorkspace.value) {
        const teamsSearchResults =
          this.teamsSearch.teamsSearchResultsFormattedForSpotlight.value
        const minisearchResults = results.value

        const mergedResults = [
          ...teamsSearchResults.map((result) => ({
            id: result.request.id,
            icon: markRaw(IconFolder),
            score: 1, // make a better scoring system for this
            text: {
              type: "custom",
              component: markRaw(RESTTeamRequestEntry),
              componentProps: {
                collectionTitles: result.collectionTitles,
                request: result.request,
              },
            },
          })),
          ...minisearchResults,
        ] as SpotlightSearcherResult[]

        return {
          loading: this.teamsSearch.teamsSearchResultsLoading.value,
          results: mergedResults,
        }
      }
      return {
        loading: false,
        results: [],
      }
    })
    return [resultObj, onSessionEnd]
  }

  onResultSelect(result: SpotlightSearcherResult): void {
    if (result.id === "create-collection") return invokeAction("collection.new")

    if (result.id === "import-collection")
      return invokeAction(`modals.collection.import`)

    let inheritedProperties: HoppInheritedProperty | undefined = undefined

    const selectedRequest = this.teamsSearch.searchResultsRequests[result.id]

    if (!selectedRequest) return

    const collectionID = result.id

    if (!collectionID) return

    inheritedProperties =
      this.teamsSearch.cascadeParentCollectionForHeaderAuthForSearchResults(
        collectionID
      )

    const possibleTab = this.tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID: result.id,
    })

    if (possibleTab) {
      this.tabs.setActiveTab(possibleTab.value.id)
    } else {
      this.tabs.createNewTab({
        request: cloneDeep(selectedRequest.request as HoppRESTRequest),
        isDirty: false,
        type: "request",
        saveContext: {
          originLocation: "team-collection",
          requestID: selectedRequest.id,
          collectionID: selectedRequest.collectionID,
        },
        inheritedProperties: inheritedProperties,
      })
    }
  }
}
