import { Service } from "dioc"
import { Store } from "~/kernel/store"
import * as E from "fp-ts/Either"
import * as O from "fp-ts/Option"

const STORE_NAMESPACE = "interceptors.extension.v1"
const SETTINGS_KEY = "settings"

export type ExtensionStatus = "available" | "unknown-origin" | "waiting"

export type ExtensionVersion = {
  major: number
  minor: number
}

type ExtensionSettings = {
  version: "v1"
  status: ExtensionStatus
  extensionVersion?: ExtensionVersion
}

interface StoredData {
  version: string
  settings: ExtensionSettings
  lastUpdated: string
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  version: "v1",
  status: "waiting",
}

export class KernelInterceptorExtensionStore extends Service {
  public static readonly ID = "KERNEL_EXTENSION_INTERCEPTOR_STORE"

  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS }

  async onServiceInit(): Promise<void> {
    const initResult = await Store.init()
    if (E.isLeft(initResult)) {
      console.error(
        "[ExtensionStore] Failed to initialize store:",
        initResult.left
      )
      return
    }

    await this.loadSettings()
    this.setupExtensionStatusListener()

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

  public getExtensionVersion(): O.Option<ExtensionVersion> {
    return O.fromNullable(this.settings.extensionVersion)
  }

  public getExtensionStatus(): ExtensionStatus {
    return this.settings.status
  }

  private setupExtensionStatusListener(): void {
    if (window.__HOPP_EXTENSION_STATUS_PROXY__) {
      this.settings.status = window.__HOPP_EXTENSION_STATUS_PROXY__.status
      window.__HOPP_EXTENSION_STATUS_PROXY__.subscribe(
        "status",
        (status: ExtensionStatus) => {
          this.updateSettings({ status })
        }
      )
    }
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
      console.error(
        "[ExtensionStore] Failed to save settings:",
        saveResult.left
      )
    }
  }

  public async updateSettings(
    settings: Partial<ExtensionSettings>
  ): Promise<void> {
    this.settings = {
      ...this.settings,
      ...settings,
    }

    await this.persistSettings()
  }

  public getSettings(): ExtensionSettings {
    return { ...this.settings }
  }
}
