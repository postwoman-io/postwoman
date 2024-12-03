import { Service } from "dioc"
import type { Request } from "@hoppscotch/kernel"

type DomainSetting = {
  version: "v1"
  security?: Required<Request>["security"]
  proxy?: Required<Request>["proxy"]
}

const defaultConfig: Pick<Request, "proxy" | "security"> = {
  security: {
    validateCertificates: false,
    verifyHost: true
  },
  proxy: {
    url: ""
  }
}

export class KernelInterceptorNativeStore extends Service {
  public static readonly ID = "KERNEL_NATIVE_INTERCEPTOR_STORE"
  private domainSettings = new Map<string, DomainSetting>()
  private static readonly GLOBAL_DOMAIN = "*"
  private static readonly DEFAULT_GLOBAL_SETTINGS: DomainSetting = {
    ...defaultConfig,
    version: "v1"
  }

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

  private getMergedSettings(domain: string): Pick<Request, "proxy" | "security"> {
    console.log("[Store] Getting merged settings for domain:", domain)
    const domainSettings = this.domainSettings.get(domain)
    const globalSettings = this.domainSettings.get(KernelInterceptorNativeStore.GLOBAL_DOMAIN)

    const mergedSettings = {
      security: domainSettings?.security ?? globalSettings?.security ?? defaultConfig.security,
      proxy: domainSettings?.proxy ?? globalSettings?.proxy ?? defaultConfig.proxy,
    }

    console.log("[Store] Merged settings:", mergedSettings)
    return mergedSettings
  }

  public completeRequest(
    request: Omit<Request, "proxy" | "security">
  ): Request {
    console.log("[Store] Completing request for URL:", request.url)
    const hostname = new URL(request.url).hostname
    console.log("[Store] Extracted hostname:", hostname)
    const settings = this.getMergedSettings(hostname)
    const completedRequest = { ...request, ...settings }
    console.log("[Store] Completed request:", completedRequest)
    return completedRequest
  }

  public saveDomainSettings(
    domain: string,
    settings: {
      security?: Required<Request>["security"]
      proxy?: Required<Request>["proxy"]
    }
  ): void {
    const current = this.domainSettings.get(domain) || { version: "v1" }
    const globalSettings = this.getMergedSettings(KernelInterceptorNativeStore.GLOBAL_DOMAIN)

    const mergedSettings = {
      ...current,
      security: {
        ...defaultConfig.security,
        ...globalSettings.security,
        ...current.security,
        ...settings.security,
      },
      proxy: {
        ...defaultConfig.proxy,
        ...globalSettings.proxy,
        ...current.proxy,
        ...settings.proxy,
      },
    }

    console.log("[Store] Merged with existing settings:", mergedSettings)
    this.domainSettings.set(domain, mergedSettings)
    console.log("[Store] Current settings:", this.domainSettings.get(domain))
  }

  public getDomainSettings(domain: string) {
    console.log("[Store] Getting settings for domain:", domain)
    return this.domainSettings.get(domain) ?? { version: "v1", ...defaultConfig }
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
