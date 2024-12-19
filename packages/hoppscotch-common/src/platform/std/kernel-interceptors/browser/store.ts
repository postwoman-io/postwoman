import { Service } from "dioc"
import { Store } from "~/kernel/store"
import * as E from "fp-ts/Either"

const STORE_NAMESPACE = "interceptors.browser.v1"
const SETTINGS_KEY = "settings"

type BrowserSettings = {
  version: "v1"
}

interface StoredData {
  version: string
  settings: BrowserSettings
  lastUpdated: string
}

const DEFAULT_SETTINGS: BrowserSettings = {
  version: "v1",
}

export class KernelInterceptorBrowserStore extends Service {
  public static readonly ID = "KERNEL_BROWSER_INTERCEPTOR_STORE"
  private settings: BrowserSettings = { ...DEFAULT_SETTINGS }

  async onServiceInit(): Promise<void> {
    const initResult = await Store.init()
    if (E.isLeft(initResult)) {
      console.error(
        "[BrowserStore] Failed to initialize store:",
        initResult.left
      )
      return
    }

    await this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    const loadResult = await Store.get<StoredData>(
      STORE_NAMESPACE,
      SETTINGS_KEY
    )

    if (E.isRight(loadResult) && loadResult.right) {
      const storedData = loadResult.right
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...storedData.settings,
      }
    }
  }

  public getSettings(): BrowserSettings {
    return { ...this.settings }
  }
}
