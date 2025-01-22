import { Service } from "dioc"
import {
  ContextMenu,
  ContextMenuResult,
  ContextMenuService,
  ContextMenuState,
} from "../"
import { markRaw, ref } from "vue"
import IconArrowDownRight from "~icons/lucide/arrow-down-right"
import { getI18n } from "~/modules/i18n"
import { RESTTabService } from "~/services/tab/rest"
import { getService } from "~/modules/dioc"

//regex containing both url and parameter
const urlAndParameterRegex = new RegExp("[^&?]*?=[^&?]*")

interface Param {
  [key: string]: string
}

/**
 * The extracted parameters from the input
 * with the new URL if it was provided
 */
interface ExtractedParams {
  params: Param
  newURL?: string
}

/**
 * This menu returns a single result that allows the user
 * to add the selected text as a parameter
 * if the selected text is a valid URL
 */
export class ParameterMenuService extends Service implements ContextMenu {
  public static readonly ID = "PARAMETER_CONTEXT_MENU_SERVICE"

  private t = getI18n()

  public readonly menuID = "parameter"

  private readonly contextMenu = this.bind(ContextMenuService)

  override onServiceInit() {
    this.contextMenu.registerMenu(this)
  }

  /**
   *
   * @param input The input to extract the parameters from
   * @returns The extracted parameters and the new URL if it was provided
   */
  private extractParams(input: string): ExtractedParams {
    let text = input
    let newURL: string | undefined

    // if the input is a URL, extract the parameters
    if (text.startsWith("http")) {
      const url = new URL(text)
      newURL = url.origin + url.pathname
      text = url.search.slice(1)
    }

    const regex = /([^&=]+)=([^&]+)/g
    const matches = text.matchAll(regex)
    const params: Param = {}

    // extract the parameters from the input
    for (const match of matches) {
      const [, key, value] = match
      params[key] = value
    }

    return { params, newURL }
  }

  /**
   * Adds the parameters from the input to the current request
   * parameters and updates the endpoint if a new URL was provided
   * @param text The input to extract the parameters from
   */
  private addParameter(text: string) {
    const { params, newURL } = this.extractParams(text)

    const queryParams = []
    for (const [key, value] of Object.entries(params)) {
      queryParams.push({ key, value, active: true })
    }

    const tabService = getService(RESTTabService)

    if (tabService.currentActiveTab.value.document.type === "test-runner")
      return

    const currentActiveRequest =
      tabService.currentActiveTab.value.document.type === "request"
        ? tabService.currentActiveTab.value.document.request
        : tabService.currentActiveTab.value.document.response.originalRequest

    // add the parameters to the current request parameters
    currentActiveRequest.params = [
      ...currentActiveRequest.params,
      ...queryParams.map((param) => ({ ...param, description: "" })),
    ]

    if (newURL) {
      currentActiveRequest.endpoint = newURL
    } else {
      // remove the parameter from the URL
      const textRegex = new RegExp(`\\b${text.replace(/\?/g, "")}\\b`, "gi")
      const sanitizedWord = currentActiveRequest.endpoint
      const newURL = sanitizedWord.replace(textRegex, "")
      currentActiveRequest.endpoint = newURL
    }
  }

  getMenuFor(text: Readonly<string>): ContextMenuState {
    const results = ref<ContextMenuResult[]>([])

    if (urlAndParameterRegex.test(text)) {
      results.value = [
        {
          id: "environment",
          text: {
            type: "text",
            text: this.t("context_menu.add_parameters"),
          },
          icon: markRaw(IconArrowDownRight),
          action: () => {
            this.addParameter(text)
          },
        },
      ]
    }

    const resultObj = <ContextMenuState>{
      results: results.value,
    }

    return resultObj
  }
}
