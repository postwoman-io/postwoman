import { Service } from "dioc"
import type { Request } from "@hoppscotch/kernel"

type DomainSetting = {
  version: "v1"
  security?: Required<Request>["security"]
  proxy?: Required<Request>["proxy"]
}

const defaultConfig: Pick<Request, "proxy" | "security"> = {
  security: {
    validateCertificates: true,
    verifyHost: true,
    verifyPeer: true
  },
  proxy: undefined
}

export class KernelInterceptorNativeStore extends Service {
  public static readonly ID = "KERNEL_NATIVE_INTERCEPTOR_STORE"
  private static readonly GLOBAL_DOMAIN = "*"
  private static readonly DEFAULT_GLOBAL_SETTINGS: DomainSetting = {
    ...defaultConfig,
    version: "v1"
  }

  private domainSettings = new Map<string, DomainSetting>()

  onServiceInit(): void {
    console.log("[Store] Initializing service")
    if (!this.domainSettings.has(KernelInterceptorNativeStore.GLOBAL_DOMAIN)) {
      console.log("[Store] Setting default global settings")
      this.domainSettings.set(
        KernelInterceptorNativeStore.GLOBAL_DOMAIN,
        KernelInterceptorNativeStore.DEFAULT_GLOBAL_SETTINGS
      )
    }
  }

  private mergeSecurity(base: Required<Request>["security"], ...overrides: (Required<Request>["security"] | undefined)[]): Required<Request>["security"] {
    console.log("[Store] Merging security with base:", base)
    console.log("[Store] Security overrides:", overrides)

    const result = overrides.reduce((acc, override) =>
      override ? { ...acc, ...override } : acc,
      { ...base }
    )

    console.log("[Store] Merged security result:", result)
    return result
  }

  private mergeProxy(...settings: (Required<Request>["proxy"] | undefined)[]): Required<Request>["proxy"] | undefined {
    console.log("[Store] Merging proxy settings:", settings)

    const merged = settings.reduce((acc, setting) =>
      setting ? { ...acc, ...setting } : acc,
      undefined as (Required<Request>["proxy"] | undefined)
    )

    console.log("[Store] Merged proxy result:", merged)
    return merged
  }

  private getMergedSettings(domain: string): Pick<Request, "proxy" | "security"> {
    console.log("[Store] Getting merged settings for domain:", domain)

    const domainSettings = this.domainSettings.get(domain)
    console.log("[Store] Domain settings:", domainSettings)

    const globalSettings = domain !== KernelInterceptorNativeStore.GLOBAL_DOMAIN ?
      this.domainSettings.get(KernelInterceptorNativeStore.GLOBAL_DOMAIN) : undefined
    console.log("[Store] Global settings:", globalSettings)

    const result = {
      security: this.mergeSecurity(
        defaultConfig.security,
        globalSettings?.security,
        domainSettings?.security
      ),
      proxy: this.mergeProxy(
        globalSettings?.proxy,
        domainSettings?.proxy
      )
    }

    console.log("[Store] Final merged settings:", result)
    return result
  }

  public completeRequest(request: Omit<Request, "proxy" | "security">): Request {
    console.log("[Store] Completing request for URL:", request.url)
    const host = new URL(request.url).host
    console.log("[Store] Extracted host:", host)
    const settings = this.getMergedSettings(host)
    const completedRequest = { ...request, ...settings }
    console.log("[Store] Completed request:", completedRequest)
    return completedRequest
  }

  public saveDomainSettings(domain: string, settings: Partial<DomainSetting>): void {
    console.log("[Store] Saving settings for domain:", domain)
    console.log("[Store] New settings:", settings)

    const current = this.getMergedSettings(domain)
    console.log("[Store] Current merged settings:", current)

    const updatedSettings: DomainSetting = {
      version: "v1" as const,
      security: settings.security !== undefined ?
        this.mergeSecurity(current.security, settings.security) :
        current.security,
      proxy: settings.proxy !== undefined ?
        this.mergeProxy(current.proxy, settings.proxy) :
        current.proxy
    }

    console.log("[Store] Updated settings:", updatedSettings)
    this.domainSettings.set(domain, updatedSettings)
  }

  public getDomainSettings(domain: string): DomainSetting {
    console.log("[Store] Getting settings for domain:", domain)
    const settings = this.domainSettings.get(domain) ?? { version: "v1", ...defaultConfig }
    console.log("[Store] Retrieved settings:", settings)
    return settings
  }

  public clearDomainSettings(domain: string): void {
    console.log("[Store] Clearing settings for domain:", domain)
    this.domainSettings.delete(domain)
    console.log("[Store] Settings cleared")
  }

  public getDomains(): string[] {
    const domains = Array.from(this.domainSettings.keys())
    console.log("[Store] Retrieved all domains:", domains)
    return domains
  }

  public getAllDomainSettings(): Map<string, DomainSetting> {
    console.log("[Store] Retrieved all domain settings:", this.domainSettings)
    return this.domainSettings
  }
}
