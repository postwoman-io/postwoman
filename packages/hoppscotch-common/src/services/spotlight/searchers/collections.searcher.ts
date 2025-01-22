import { Service } from "dioc"
import {
  SpotlightResultTextType,
  SpotlightSearcher,
  SpotlightSearcherResult,
  SpotlightSearcherSessionState,
  SpotlightService,
} from "../"
import { Ref, computed, effectScope, markRaw, ref, watch } from "vue"
import { getI18n } from "~/modules/i18n"
import MiniSearch from "minisearch"
import {
  cascadeParentCollectionForHeaderAuth,
  graphqlCollectionStore,
  restCollectionStore,
} from "~/newstore/collections"
import IconFolder from "~icons/lucide/folder"
import IconImport from "~icons/lucide/folder-down"
import RESTRequestSpotlightEntry from "~/components/app/spotlight/entry/RESTRequest.vue"
import GQLRequestSpotlightEntry from "~/components/app/spotlight/entry/GQLRequest.vue"
import {
  HoppCollection,
  HoppGQLRequest,
  HoppRESTRequest,
} from "@hoppscotch/data"
import { WorkspaceService } from "~/services/workspace.service"
import { invokeAction } from "~/helpers/actions"
import { RESTTabService } from "~/services/tab/rest"
import { GQLTabService } from "~/services/tab/graphql"

/**
 * A spotlight searcher that searches through the user's collections
 *
 * NOTE: Initializing this service registers it as a searcher with the Spotlight Service.
 */
export class CollectionsSpotlightSearcherService
  extends Service
  implements SpotlightSearcher
{
  public static readonly ID = "COLLECTIONS_SPOTLIGHT_SEARCHER_SERVICE"

  private t = getI18n()

  public searcherID = "collections"
  public searcherSectionTitle = this.t("collection.my_collections")

  private readonly restTab = this.bind(RESTTabService)
  private readonly gqlTab = this.bind(GQLTabService)

  private readonly spotlight = this.bind(SpotlightService)
  private readonly workspaceService = this.bind(WorkspaceService)

  override onServiceInit() {
    this.spotlight.registerSearcher(this)
  }

  private loadGQLDocsIntoMinisearch(minisearch: MiniSearch) {
    const gqlCollsQueue = [
      ...graphqlCollectionStore.value.state.map((coll, index) => ({
        coll: coll,
        index: `${index}`,
      })),
    ]

    while (gqlCollsQueue.length > 0) {
      const { coll, index } = gqlCollsQueue.shift()!

      gqlCollsQueue.push(
        ...coll.folders.map((folder, folderIndex) => ({
          coll: folder,
          index: `${index}/${folderIndex}`,
        }))
      )

      minisearch.addAll(
        coll.requests.map((req, reqIndex) => ({
          id: `gql-${index}/${reqIndex}`,
          name: req.name,
        }))
      )
    }
  }

  private loadRESTDocsIntoMinisearch(minisearch: MiniSearch) {
    const restDocsQueue = [
      ...restCollectionStore.value.state.map((coll, index) => ({
        coll: coll,
        index: `${index}`,
      })),
    ]

    while (restDocsQueue.length > 0) {
      const { coll, index } = restDocsQueue.shift()!

      restDocsQueue.push(
        ...coll.folders.map((folder, folderIndex) => ({
          coll: folder,
          index: `${index}/${folderIndex}`,
        }))
      )

      minisearch.addAll(
        coll.requests.map((req, reqIndex) => ({
          id: `rest-${index}/${reqIndex}`,
          name: req.name,
        }))
      )
    }
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

  public createSearchSession(
    query: Readonly<Ref<string>>
  ): [Ref<SpotlightSearcherSessionState>, () => void] {
    const pageCategory = this.getCurrentPageCategory()

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

    if (pageCategory === "rest" || pageCategory === "graphql") {
      minisearch.add({
        id: `create-collection`,
        name: this.t("collection.new"),
      })
      minisearch.add({
        id: "import-collection",
        name: this.t("collection.import"),
      })
    }

    if (pageCategory === "rest") {
      this.loadRESTDocsIntoMinisearch(minisearch)
    } else if (pageCategory === "graphql") {
      this.loadGQLDocsIntoMinisearch(minisearch)
    }

    const results = ref<SpotlightSearcherResult[]>([])

    const scopeHandle = effectScope()

    const newCollectionText: SpotlightResultTextType<any> = {
      type: "text",
      text: this.t("collection.new"),
    }

    const importCollectionText: SpotlightResultTextType<any> = {
      type: "text",
      text: this.t("collection.import_collection"),
    }

    scopeHandle.run(() => {
      const isPersonalWorkspace = computed(
        () => this.workspaceService.currentWorkspace.value.type === "personal"
      )

      watch(query, (query) => {
        if (!isPersonalWorkspace.value) {
          results.value = []
          return
        }

        if (pageCategory === "other") {
          results.value = []
          return
        }
        const getResultText = (id: string): SpotlightResultTextType<any> => {
          if (id === "create-collection") return newCollectionText
          else if (id === "import-collection") return importCollectionText
          return {
            type: "custom",
            component: markRaw(
              pageCategory === "rest"
                ? RESTRequestSpotlightEntry
                : GQLRequestSpotlightEntry
            ),
            componentProps: {
              folderPath: id.split(
                pageCategory === "rest" ? "rest-" : "gql-"
              )[1],
            },
          }
        }

        const getResultIcon = (id: string) => {
          if (id === "import-collection") return markRaw(IconImport)
          return markRaw(IconFolder)
        }

        const searchResults = minisearch.search(query).slice(0, 10)

        results.value = searchResults.map((result) => ({
          id: result.id,
          text: getResultText(result.id),
          icon: getResultIcon(result.id),
          score: result.score,
        }))
      })
    })

    const resultObj = computed<SpotlightSearcherSessionState>(() => ({
      loading: false,
      results: results.value,
    }))

    return [
      resultObj,
      () => {
        scopeHandle.stop()
      },
    ]
  }

  private getRESTFolderFromFolderPath(
    folderPath: string
  ): HoppCollection | undefined {
    try {
      const folderIndicies = folderPath.split("/").map((x) => parseInt(x))

      let currentFolder =
        restCollectionStore.value.state[folderIndicies.shift()!]

      while (folderIndicies.length > 0) {
        const folderIndex = folderIndicies.shift()!

        const folder = currentFolder.folders[folderIndex]

        currentFolder = folder
      }

      return currentFolder
    } catch (e) {
      console.error(e)
      return undefined
    }
  }

  private getGQLFolderFromFolderPath(
    folderPath: string
  ): HoppCollection | undefined {
    try {
      const folderIndicies = folderPath.split("/").map((x) => parseInt(x))

      let currentFolder =
        graphqlCollectionStore.value.state[folderIndicies.shift()!]

      while (folderIndicies.length > 0) {
        const folderIndex = folderIndicies.shift()!

        const folder = currentFolder.folders[folderIndex]

        currentFolder = folder
      }

      return currentFolder
    } catch (e) {
      console.error(e)
      return undefined
    }
  }

  public onResultSelect(result: SpotlightSearcherResult): void {
    if (result.id === "create-collection") return invokeAction("collection.new")

    if (result.id === "import-collection")
      return invokeAction(`modals.collection.import`)

    const [type, path] = result.id.split("-")

    if (type === "rest") {
      const folderPath = path.split("/").map((x) => parseInt(x))
      const reqIndex = folderPath.pop()!

      if (this.workspaceService.currentWorkspace.value.type !== "personal") {
        this.workspaceService.changeWorkspace({
          type: "personal",
        })
      }

      const possibleTab = this.restTab.getTabRefWithSaveContext({
        originLocation: "user-collection",
        folderPath: folderPath.join("/"),
        requestIndex: reqIndex,
      })

      if (possibleTab) {
        this.restTab.setActiveTab(possibleTab.value.id)
      } else {
        const req = this.getRESTFolderFromFolderPath(folderPath.join("/"))
          ?.requests[reqIndex] as HoppRESTRequest

        if (!req) return

        const { auth, headers } = cascadeParentCollectionForHeaderAuth(
          folderPath.join("/"),
          "rest"
        )

        this.restTab.createNewTab(
          {
            type: "request",
            request: req,
            isDirty: false,
            saveContext: {
              originLocation: "user-collection",
              folderPath: folderPath.join("/"),
              requestIndex: reqIndex,
            },
            inheritedProperties: {
              auth,
              headers,
            },
          },
          true
        )
      }
    } else if (type === "gql") {
      const folderPath = path.split("/").map((x) => parseInt(x))
      const reqIndex = folderPath.pop()!

      const req = this.getGQLFolderFromFolderPath(folderPath.join("/"))
        ?.requests[reqIndex] as HoppGQLRequest

      if (!req) return

      const { auth, headers } = cascadeParentCollectionForHeaderAuth(
        folderPath.join("/"),
        "graphql"
      )
      this.gqlTab.createNewTab({
        saveContext: {
          originLocation: "user-collection",
          folderPath: folderPath.join("/"),
          requestIndex: reqIndex,
        },
        request: req,
        isDirty: false,
        inheritedProperties: {
          auth,
          headers,
        },
      })
    }
  }
}
