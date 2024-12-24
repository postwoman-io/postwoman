import { Service } from "dioc"
import { PersistenceService } from "~/services/persistence"
import {
  CACertificateEntry,
  ClientCertificateEntry,
  CACertStore,
  ClientCertsStore,
} from "./persistence"
import { effectScope, markRaw, reactive, toRaw, watchEffect } from "vue"

export interface NativeCertStoreState {
  caCertificates: CACertificateEntry[]
  clientCertificates: Map<string, ClientCertificateEntry>
  validateCerts: boolean
  proxyUrl?: string
}

const STORAGE_KEYS = {
  VALIDATE_SSL: "native_interceptor_validate_ssl",
  PROXY_INFO: "native_interceptor_proxy_info",
  CA_STORE: "native_interceptor_ca_store",
  CLIENT_CERTS: "native_interceptor_client_certs_store",
} as const

export class NativeCertStore extends Service {
  public static readonly ID = "NATIVE_CERT_STORE"

  private readonly persistence = this.bind(PersistenceService)
  private readonly scope = effectScope()

  private readonly state = reactive<NativeCertStoreState>({
    caCertificates: [],
    clientCertificates: new Map(),
    validateCerts: true,
    proxyUrl: undefined,
  })

  public get caCertificates() {
    return toRaw(this.state.caCertificates)
  }
  public get clientCertificates() {
    return toRaw(this.state.clientCertificates)
  }
  public get validateCerts() {
    return this.state.validateCerts
  }
  public get proxyUrl() {
    return this.state.proxyUrl
  }

  public set caCertificates(value: CACertificateEntry[]) {
    this.state.caCertificates = markRaw([...value])
  }

  public set clientCertificates(value: Map<string, ClientCertificateEntry>) {
    this.state.clientCertificates = markRaw(new Map(value))
  }

  public set validateCerts(value: boolean) {
    this.state.validateCerts = value
  }

  public set proxyUrl(value: string | undefined) {
    this.state.proxyUrl = value
  }

  override onServiceInit() {
    this.scope.run(() => {
      this.loadPersistedState()
      this.setupPersistence()
    })
  }

  override onServiceDestroy() {
    this.scope.stop()
  }

  private loadPersistedState() {
    this.loadValidation()
    this.loadProxy()
    this.loadCACertificates()
    this.loadClientCertificates()
  }

  private loadValidation() {
    const config = JSON.parse(
      this.persistence.getLocalConfig(STORAGE_KEYS.VALIDATE_SSL) ?? "true"
    )
    if (typeof config === "boolean") this.state.validateCerts = config
  }

  private loadProxy() {
    const config = this.persistence.getLocalConfig(STORAGE_KEYS.PROXY_INFO)
    if (!config || config === "null") return
    try {
      const { url } = JSON.parse(config)
      this.state.proxyUrl = url
    } catch {
      this.state.proxyUrl = undefined
    }
  }

  private loadCACertificates() {
    const store = JSON.parse(
      this.persistence.getLocalConfig(STORAGE_KEYS.CA_STORE) ?? "null"
    )
    const result = CACertStore.safeParse(store)
    if (result.type === "ok") {
      this.state.caCertificates = result.value.certs.map((cert) => ({
        ...cert,
        certificate: new Uint8Array(cert.certificate),
      }))
    }
  }

  private loadClientCertificates() {
    const store = JSON.parse(
      this.persistence.getLocalConfig(STORAGE_KEYS.CLIENT_CERTS) ?? "null"
    )
    const result = ClientCertsStore.safeParse(store)
    if (result.type === "ok") {
      this.state.clientCertificates = new Map(
        Object.entries(result.value.clientCerts).map(([domain, cert]) => [
          domain,
          this.hydrateClientCert(cert),
        ])
      )
    }
  }

  private setupPersistence() {
    watchEffect(() => {
      this.persistence.setLocalConfig(
        STORAGE_KEYS.VALIDATE_SSL,
        JSON.stringify(this.state.validateCerts)
      )
    })

    watchEffect(() => {
      this.persistence.setLocalConfig(
        STORAGE_KEYS.PROXY_INFO,
        this.state.proxyUrl
          ? JSON.stringify({ url: this.state.proxyUrl })
          : "null"
      )
    })

    watchEffect(() => {
      this.persistence.setLocalConfig(
        STORAGE_KEYS.CA_STORE,
        JSON.stringify({
          v: 1,
          certs: this.state.caCertificates.map(this.dehydrateCACert),
        })
      )
    })

    watchEffect(() => {
      this.persistence.setLocalConfig(
        STORAGE_KEYS.CLIENT_CERTS,
        JSON.stringify({
          v: 1,
          clientCerts: Object.fromEntries(
            Array.from(this.state.clientCertificates.entries()).map(
              ([domain, cert]) => [domain, this.dehydrateClientCert(cert)]
            )
          ),
        })
      )
    })
  }

  private hydrateClientCert(
    cert: ClientCertificateEntry
  ): ClientCertificateEntry {
    if ("PFXCert" in cert.cert) {
      return {
        ...cert,
        cert: {
          PFXCert: {
            ...cert.cert.PFXCert,
            certificate_pfx: new Uint8Array(cert.cert.PFXCert.certificate_pfx),
          },
        },
      }
    }
    return {
      ...cert,
      cert: {
        PEMCert: {
          ...cert.cert.PEMCert,
          certificate_pem: new Uint8Array(cert.cert.PEMCert.certificate_pem),
          key_pem: new Uint8Array(cert.cert.PEMCert.key_pem),
        },
      },
    }
  }

  private dehydrateCACert(cert: CACertificateEntry) {
    return {
      ...cert,
      certificate: Array.from(cert.certificate),
    }
  }

  private dehydrateClientCert(cert: ClientCertificateEntry) {
    if ("PFXCert" in cert.cert) {
      return {
        ...cert,
        cert: {
          PFXCert: {
            ...cert.cert.PFXCert,
            certificate_pfx: Array.from(cert.cert.PFXCert.certificate_pfx),
          },
        },
      }
    }
    return {
      ...cert,
      cert: {
        PEMCert: {
          ...cert.cert.PEMCert,
          certificate_pem: Array.from(cert.cert.PEMCert.certificate_pem),
          key_pem: Array.from(cert.cert.PEMCert.key_pem),
        },
      },
    }
  }
}
