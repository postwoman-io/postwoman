import { Component, computed, markRaw, reactive } from "vue"
import { invokeAction, isActionBound } from "~/helpers/actions"
import { getI18n } from "~/modules/i18n"
import { SpotlightSearcherResult, SpotlightService } from ".."
import {
  SearchResult,
  StaticSpotlightSearcherService,
} from "./base/static.searcher"

import { useRoute } from "vue-router"
import { RESTOptionTabs } from "~/components/http/RequestOptions.vue"
import IconWindow from "~icons/lucide/app-window"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCode2 from "~icons/lucide/code-2"
import IconShare2 from "~icons/lucide/share-2"
import IconFileCode from "~icons/lucide/file-code"
import IconRename from "~icons/lucide/file-edit"
import IconPlay from "~icons/lucide/play"
import IconRotateCCW from "~icons/lucide/rotate-ccw"
import IconSave from "~icons/lucide/save"
import { GQLOptionTabs } from "~/components/graphql/RequestOptions.vue"
import { RESTTabService } from "~/services/tab/rest"
import { Container } from "dioc"

type Doc = {
  text: string | string[]
  alternates: string[]
  icon: object | Component
  excludeFromSearch?: boolean
}

/**
 *
 * This searcher is responsible for providing request related actions on the spotlight results.
 *
 * NOTE: Initializing this service registers it as a searcher with the Spotlight Service.
 */
export class RequestSpotlightSearcherService extends StaticSpotlightSearcherService<Doc> {
  public static readonly ID = "REQUEST_SPOTLIGHT_SEARCHER_SERVICE"

  private t = getI18n()

  public readonly searcherID = "request"
  public searcherSectionTitle = this.t("shortcut.request.title")

  private readonly spotlight = this.bind(SpotlightService)
  private readonly restTab = this.bind(RESTTabService)

  private route = useRoute()
  private isRESTPage = computed(
    () =>
      this.route.name === "index" &&
      this.restTab.currentActiveTab.value.document.type === "request"
  )
  private isGQLPage = computed(() => this.route.name === "graphql")
  private isRESTOrGQLPage = computed(
    () => this.isRESTPage.value || this.isGQLPage.value
  )
  private isGQLConnectBound = isActionBound("gql.connect")
  private isGQLDisconnectBound = isActionBound("gql.disconnect")

  private documents: Record<string, Doc> = reactive({
    send_request: {
      text: this.t("shortcut.request.send_request"),
      alternates: ["request", "send"],
      icon: markRaw(IconPlay),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    gql_connect: {
      text: [this.t("navigation.graphql"), this.t("spotlight.graphql.connect")],
      alternates: ["connect", "server", "graphql"],
      icon: markRaw(IconPlay),
      excludeFromSearch: computed(() => !this.isGQLConnectBound.value),
    },
    gql_disconnect: {
      text: [
        this.t("navigation.graphql"),
        this.t("spotlight.graphql.disconnect"),
      ],
      alternates: ["disconnect", "stop", "graphql"],
      icon: markRaw(IconPlay),
      excludeFromSearch: computed(() => !this.isGQLDisconnectBound.value),
    },
    save_to_collections: {
      text: this.t("spotlight.request.save_as_new"),
      alternates: ["save", "collections"],
      icon: markRaw(IconSave),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    save_request: {
      text: this.t("shortcut.request.save_request"),
      alternates: ["save", "request"],
      icon: markRaw(IconSave),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    rename_request: {
      text: this.t("shortcut.request.rename"),
      alternates: ["rename", "request"],
      icon: markRaw(IconRename),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    share_request: {
      text: this.t("shortcut.request.share_request"),
      alternates: ["share", "request", "copy"],
      icon: markRaw(IconShare2),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    reset_request: {
      text: this.t("shortcut.request.reset_request"),
      alternates: ["reset", "request"],
      icon: markRaw(IconRotateCCW),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    import_curl: {
      text: this.t("shortcut.request.import_curl"),
      alternates: ["import", "curl"],
      icon: markRaw(IconFileCode),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    show_code: {
      text: this.t("shortcut.request.show_code"),
      alternates: ["show", "code"],
      icon: markRaw(IconCode2),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    // Change request method
    get_method: {
      text: [this.t("spotlight.request.select_method"), "GET"],
      alternates: ["get", "method"],
      icon: markRaw(IconCheckCircle),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    head_method: {
      text: [this.t("spotlight.request.select_method"), "HEAD"],
      alternates: ["head", "method"],
      icon: markRaw(IconCheckCircle),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    post_method: {
      text: [this.t("spotlight.request.select_method"), "POST"],
      alternates: ["post", "method"],
      icon: markRaw(IconCheckCircle),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    put_method: {
      text: [this.t("spotlight.request.select_method"), "PUT"],
      alternates: ["put", "method"],
      icon: markRaw(IconCheckCircle),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    delete_method: {
      text: [this.t("spotlight.request.select_method"), "DELETE"],
      alternates: ["delete", "method"],
      icon: markRaw(IconCheckCircle),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    // Change sub tabs
    tab_parameters: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_parameters"),
      ],
      alternates: ["parameters", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    tab_body: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_body"),
      ],
      alternates: ["body", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    tab_headers: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_headers"),
      ],
      alternates: ["headers", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    tab_authorization: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_authorization"),
      ],
      alternates: ["authorization", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isRESTOrGQLPage.value),
    },
    tab_pre_request_script: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_pre_request_script"),
      ],
      alternates: ["pre-request", "script", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    tab_tests: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_tests"),
      ],
      alternates: ["tests", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isRESTPage.value),
    },
    tab_query: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_query"),
      ],
      alternates: ["query", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isGQLPage.value),
    },
    tab_variables: {
      text: [
        this.t("spotlight.request.switch_to"),
        this.t("spotlight.request.tab_variables"),
      ],
      alternates: ["variables", "tab"],
      icon: markRaw(IconWindow),
      excludeFromSearch: computed(() => !this.isGQLPage.value),
    },
  })

  // TODO: Constructors are no longer recommended as of dioc > 3, use onServiceInit instead
  constructor(c: Container) {
    super(c, {
      searchFields: ["text", "alternates"],
      fieldWeights: {
        text: 2,
        alternates: 1,
      },
    })
  }

  override onServiceInit() {
    this.setDocuments(this.documents)
    this.spotlight.registerSearcher(this)
  }

  protected getSearcherResultForSearchResult(
    result: SearchResult<Doc>
  ): SpotlightSearcherResult {
    return {
      id: result.id,
      icon: result.doc.icon,
      text: { type: "text", text: result.doc.text },
      score: result.score,
    }
  }

  private openRequestTab(tab: RESTOptionTabs | GQLOptionTabs): void {
    invokeAction("request.open-tab", {
      tab,
    })
  }

  public onDocSelected(id: string): void {
    switch (id) {
      case "send_request":
        invokeAction("request.send-cancel")
        break
      case "gql_connect":
        invokeAction("gql.connect")
        break
      case "gql_disconnect":
        invokeAction("gql.disconnect")
        break
      case "save_to_collections":
        invokeAction("request.save-as", {
          requestType: "rest",
          request:
            this.restTab.currentActiveTab.value?.document.type === "request"
              ? this.restTab.currentActiveTab.value?.document.request
              : null,
        })
        break
      case "save_request":
        invokeAction("request-response.save")
        break
      case "rename_request":
        invokeAction("request.rename")
        break
      case "share_request":
        invokeAction("request.share-request")
        break
      case "reset_request":
        invokeAction("request.reset")
        break
      case "get_method":
        invokeAction("request.method.get")
        break
      case "head_method":
        invokeAction("request.method.head")
        break
      case "post_method":
        invokeAction("request.method.post")
        break
      case "put_method":
        invokeAction("request.method.put")
        break
      case "delete_method":
        invokeAction("request.method.delete")
        break
      case "import_curl":
        invokeAction("request.import-curl")
        break
      case "show_code":
        invokeAction("request.show-code")
        break
      case "tab_parameters":
        this.openRequestTab("params")
        break
      case "tab_body":
        this.openRequestTab("bodyParams")
        break
      case "tab_headers":
        this.openRequestTab("headers")
        break
      case "tab_authorization":
        this.openRequestTab("authorization")
        break
      case "tab_pre_request_script":
        this.openRequestTab("preRequestScript")
        break
      case "tab_tests":
        this.openRequestTab("tests")
        break
      case "tab_query":
        this.openRequestTab("query")
        break
      case "tab_variables":
        this.openRequestTab("variables")
        break
    }
  }
}
