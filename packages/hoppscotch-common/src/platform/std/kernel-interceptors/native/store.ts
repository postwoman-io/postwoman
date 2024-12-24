import { Service } from "dioc"
import type { Request } from "@hoppscotch/kernel"
import { Store } from "~/kernel/store"
import * as E from "fp-ts/Either"

const STORE_NAMESPACE = "interceptors.native.v1"
const SETTINGS_KEY = "settings"

type DomainSetting = {
  version: "v1"
  security?: Required<Request>["security"]
  proxy?: Required<Request>["proxy"]
}

interface StoredData {
  version: string
  domains: Record<string, DomainSetting>
  lastUpdated: string
}

const defaultConfig: Pick<Request, "proxy" | "security"> = {
  security: {
    validateCertificates: true,
    verifyHost: true,
    verifyPeer: true,
  },
  proxy: undefined,
}

export class KernelInterceptorNativeStore extends Service {
  public static readonly ID = "KERNEL_NATIVE_INTERCEPTOR_STORE"
  private static readonly GLOBAL_DOMAIN = "*"
  private static readonly DEFAULT_GLOBAL_SETTINGS: DomainSetting = {
    ...defaultConfig,
    version: "v1",
  }

  private domainSettings = new Map<string, DomainSetting>()

  async onServiceInit(): Promise<void> {
    const initResult = await Store.init()
    if (E.isLeft(initResult)) {
      console.error(
        "[NativeStore] Failed to initialize store:",
        initResult.left
      )
      return
    }

    await this.loadSettings()

    if (!this.domainSettings.has(KernelInterceptorNativeStore.GLOBAL_DOMAIN)) {
      this.domainSettings.set(
        KernelInterceptorNativeStore.GLOBAL_DOMAIN,
        KernelInterceptorNativeStore.DEFAULT_GLOBAL_SETTINGS
      )
      await this.persistSettings()
    }

    Store.watch(STORE_NAMESPACE, SETTINGS_KEY).on(
      "change",
      async ({ value }) => {
        if (value) {
          const storedData = value as StoredData
          this.domainSettings = new Map(Object.entries(storedData.domains))
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
      this.domainSettings = new Map(Object.entries(storedData.domains))
    }
  }

  private async persistSettings(): Promise<void> {
    const storedData: StoredData = {
      version: "v1",
      domains: Object.fromEntries(this.domainSettings),
      lastUpdated: new Date().toISOString(),
    }

    const saveResult = await Store.set(
      STORE_NAMESPACE,
      SETTINGS_KEY,
      storedData
    )

    if (E.isLeft(saveResult)) {
      console.error("[NativeStore] Failed to save settings:", saveResult.left)
    }
  }

  private mergeSecurity(
    base: Required<Request>["security"],
    ...overrides: (Required<Request>["security"] | undefined)[]
  ): Required<Request>["security"] {
    const result = overrides.reduce(
      (acc, override) => (override ? { ...acc, ...override } : acc),
      { ...base }
    )

    return result
  }

  private mergeProxy(
    ...settings: (Required<Request>["proxy"] | undefined)[]
  ): Required<Request>["proxy"] | undefined {
    const result = settings.reduce(
      (acc, setting) => (setting ? { ...acc, ...setting } : acc),
      undefined as Required<Request>["proxy"] | undefined
    )

    return result
  }

  private getMergedSettings(
    domain: string
  ): Pick<Request, "proxy" | "security"> {
    const domainSettings = this.domainSettings.get(domain)

    const globalSettings =
      domain !== KernelInterceptorNativeStore.GLOBAL_DOMAIN
        ? this.domainSettings.get(KernelInterceptorNativeStore.GLOBAL_DOMAIN)
        : undefined

    const result = {
      security: this.mergeSecurity(
        defaultConfig.security,
        globalSettings?.security,
        domainSettings?.security
      ),
      proxy: this.mergeProxy(globalSettings?.proxy, domainSettings?.proxy),
    }

    return result
  }

  public completeRequest(
    request: Omit<Request, "proxy" | "security">
  ): Request {
    const host = new URL(request.url).host
    const settings = this.getMergedSettings(host)
    const completedRequest = { ...request, ...settings }
    return completedRequest
  }

  public async saveDomainSettings(
    domain: string,
    settings: Partial<DomainSetting>
  ): Promise<void> {
    const current = this.getMergedSettings(domain)

    const updatedSettings: DomainSetting = {
      version: "v1",
      security:
        settings.security !== undefined
          ? this.mergeSecurity(current.security, settings.security)
          : current.security,
      proxy:
        settings.proxy !== undefined
          ? this.mergeProxy(current.proxy, settings.proxy)
          : current.proxy,
    }

    this.domainSettings.set(domain, updatedSettings)
    await this.persistSettings()
  }

  public getDomainSettings(domain: string): DomainSetting {
    const settings = this.domainSettings.get(domain) ?? {
      version: "v1",
      ...defaultConfig,
    }
    return settings
  }

  public async clearDomainSettings(domain: string): Promise<void> {
    this.domainSettings.delete(domain)
    await this.persistSettings()
  }

  public getDomains(): string[] {
    const domains = Array.from(this.domainSettings.keys())
    return domains
  }

  public getAllDomainSettings(): Map<string, DomainSetting> {
    return new Map(this.domainSettings)
  }
}
