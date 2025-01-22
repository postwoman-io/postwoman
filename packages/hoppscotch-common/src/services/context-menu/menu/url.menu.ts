import { Service } from "dioc"
import { markRaw, ref } from "vue"
import { getDefaultRESTRequest } from "~/helpers/rest/default"
import { getI18n } from "~/modules/i18n"
import { RESTTabService } from "~/services/tab/rest"
import IconCopyPlus from "~icons/lucide/copy-plus"
import {
  ContextMenu,
  ContextMenuResult,
  ContextMenuService,
  ContextMenuState,
} from ".."

/**
 * Used to check if a string is a valid URL
 * @param url The string to check
 * @returns Whether the string is a valid URL
 */
function isValidURL(url: string) {
  try {
    // Try to create a URL object
    // this will fail for endpoints like "localhost:3000", ie without a protocol
    new URL(url)
    return true
  } catch (error) {
    // Fallback to regular expression check
    const pattern = /^(https?:\/\/)?([\w.-]+)(\.[\w.-]+)+([/?].*)?$/
    return pattern.test(url)
  }
}

export class URLMenuService extends Service implements ContextMenu {
  public static readonly ID = "URL_CONTEXT_MENU_SERVICE"

  private t = getI18n()

  public readonly menuID = "url"

  private readonly contextMenu = this.bind(ContextMenuService)
  private readonly restTab = this.bind(RESTTabService)

  override onServiceInit() {
    this.contextMenu.registerMenu(this)
  }

  /**
   * Opens a new tab with the provided URL
   * @param url The URL to open
   */
  private openNewTab(url: string) {
    //create a new request object
    const request = {
      ...getDefaultRESTRequest(),
      endpoint: url,
    }

    this.restTab.createNewTab({
      type: "request",
      request: request,
      isDirty: false,
    })
  }

  getMenuFor(text: Readonly<string>): ContextMenuState {
    const results = ref<ContextMenuResult[]>([])

    if (isValidURL(text)) {
      results.value = [
        {
          id: "link-tab",
          text: {
            type: "text",
            text: this.t("context_menu.open_request_in_new_tab"),
          },
          icon: markRaw(IconCopyPlus),
          action: () => {
            this.openNewTab(text)
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
