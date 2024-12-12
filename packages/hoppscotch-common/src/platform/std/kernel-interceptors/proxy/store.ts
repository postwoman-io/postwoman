import { Service } from "dioc"
import { Store } from "~/kernel/store"
import * as E from "fp-ts/Either"

const STORE_NAMESPACE = "interceptors.proxy.v1"
const SETTINGS_KEY = "settings"

type ProxySettings = {
  version: "v1"
  proxyUrl: string
  accessToken: string
}

interface StoredData {
  version: string
  settings: ProxySettings
  lastUpdated: string
}

const DEFAULT_SETTINGS: ProxySettings = {
  version: "v1",
  proxyUrl: "https://proxy.hoppscotch.io",
  accessToken: import.meta.env.VITE_PROXYSCOTCH_ACCESS_TOKEN ?? "",
}

export class KernelInterceptorProxyStore extends Service {
  public static readonly ID = "KERNEL_PROXY_INTERCEPTOR_STORE"

  private settings: ProxySettings = { ...DEFAULT_SETTINGS }

  async onServiceInit(): Promise<void> {

    const initResult = await Store.init()
    if (E.isLeft(initResult)) {
      console.error("[ProxyStore] Failed to initialize store:", initResult.left)
      return
    }

    await this.loadSettings()

    Store.watch(STORE_NAMESPACE, SETTINGS_KEY).on(
      "change",
      async ({ value }) => {
        if (value) {
          const storedData = value as StoredData
          this.settings = storedData.settings
        }
      }
    )
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
    } else {
      await this.persistSettings()
    }
  }

  private async persistSettings(): Promise<void> {

    const storedData: StoredData = {
      version: "v1",
      settings: this.settings,
      lastUpdated: new Date().toISOString(),
    }

    const saveResult = await Store.set(
      STORE_NAMESPACE,
      SETTINGS_KEY,
      storedData
    )

    if (E.isLeft(saveResult)) {
      console.error("[ProxyStore] Failed to save settings:", saveResult.left)
    }
  }

  public async updateSettings(settings: Partial<ProxySettings>): Promise<void> {

    this.settings = {
      ...this.settings,
      ...settings,
    }

    await this.persistSettings()
  }

  public getSettings(): ProxySettings {
    return { ...this.settings }
  }

  public async resetSettings(): Promise<void> {

    this.settings = { ...DEFAULT_SETTINGS }
    await this.persistSettings()
  }
}
