import { Service } from "dioc"
import { effectScope, markRaw, reactive, toRaw, watchEffect } from "vue"
import type { Request } from "@hoppscotch/kernel"
import { NativeCertStore } from "./cert-store"
import { NativeInterceptor } from "~/kernel/native"
import { CertificateType } from "@hoppscotch/kernel"
import SettingsNativeInterceptor from "~/components/settings/NativeInterceptor.vue"

export interface NativeKernelConfig {
  verifyHost: boolean
  proxyEnabled: boolean
  followRedirects: boolean
  maxRedirects: number
  requestTimeout: number
  proxyAuth?: {
    username: string
    password: string
  }
}

export class NativeKernelInterceptorService extends Service {
  public static readonly ID = "NATIVE_KERNEL_INTERCEPTOR_SERVICE"

  private readonly certStore = this.bind(NativeCertStore)
  private readonly scope = effectScope()

  private readonly state = reactive<NativeKernelConfig>({
    verifyHost: true,
    proxyEnabled: false,
    followRedirects: true,
    maxRedirects: 5,
    requestTimeout: 10000,
  })

  public readonly id = "native"
  public readonly name = () => "Native"
  public readonly selectable = { type: "selectable" as const }
  public readonly settingsEntry = markRaw({
    title: () => "Native",
    component: SettingsNativeInterceptor,
  })

  public get config() {
    return toRaw(this.state)
  }

  public get verifyHost() {
    return this.state.verifyHost
  }
  public get proxyEnabled() {
    return this.state.proxyEnabled
  }
  public get followRedirects() {
    return this.state.followRedirects
  }
  public get maxRedirects() {
    return this.state.maxRedirects
  }
  public get requestTimeout() {
    return this.state.requestTimeout
  }
  public get proxyAuth() {
    return this.state.proxyAuth
  }

  public set verifyHost(value: boolean) {
    this.state.verifyHost = value
  }
  public set proxyEnabled(value: boolean) {
    this.state.proxyEnabled = value
  }
  public set followRedirects(value: boolean) {
    this.state.followRedirects = value
  }
  public set maxRedirects(value: number) {
    this.state.maxRedirects = value
  }
  public set requestTimeout(value: number) {
    this.state.requestTimeout = value
  }
  public set proxyAuth(
    value: { username: string; password: string } | undefined
  ) {
    this.state.proxyAuth = value
  }

  override onServiceInit(): void {
    this.scope.run(() => this.setupPersistence())
  }

  private setupPersistence(): void {
    watchEffect(() => {
      this.certStore.validateCerts = this.state.verifyHost
    })

    watchEffect(() => {
      if (this.state.proxyEnabled && this.certStore.proxyUrl) {
        this.certStore.proxyUrl = undefined
      }
    })
  }

  public execute(req: Request) {
    const requestWithCerts = this.attachCertificates(req)
    return NativeInterceptor.execute(requestWithCerts)
  }

  private attachCertificates(req: Request): Request {
    const url = new URL(req.url)
    const clientCert = this.getClientCertForDomain(url.host)

    return {
      ...req,
      security: {
        certificates: {
          ca: this.certStore.caCertificates
            .filter((cert) => cert.enabled)
            .map((cert) => cert.certificate),
          client: clientCert,
        },
        validateCertificates: this.certStore.validateCerts,
        verifyHost: this.state.verifyHost,
      },
      proxy:
        this.state.proxyEnabled && this.certStore.proxyUrl
          ? {
              url: this.certStore.proxyUrl,
              auth: this.state.proxyAuth,
            }
          : undefined,
    }
  }

  private getClientCertForDomain(domain: string): CertificateType | undefined {
    const cert = this.certStore.clientCertificates.get(domain)
    return cert?.enabled ? cert.cert : undefined
  }
}
