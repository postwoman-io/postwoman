import {CookieJarService} from "@hoppscotch/common/services/cookie-jar.service"
import {Interceptor, InterceptorError, RequestRunResult} from "@hoppscotch/common/services/interceptor.service"
import {Service} from "dioc"
import {cloneDeep} from "lodash-es"
import {invoke} from "@tauri-apps/api/tauri"
import * as E from "fp-ts/Either"
import SettingsNativeInterceptor from "../../../components/settings/NativeInterceptor.vue"
import {ref, watch} from "vue"
import {z} from "zod"
import {PersistenceService} from "@hoppscotch/common/services/persistence"
import {CACertStore, ClientCertsStore, ClientCertStore, StoredClientCert} from "./persisted-data"


type KeyValuePair = {
  key: string,
  value: string
}

type FormDataValue =
  | { Text: string }
  | {
  File: {
    filename: string,
    data: number[],
    mime: string
  }
}

type FormDataEntry = {
  key: string,
  value: FormDataValue
}

type BodyDef =
  | { Text: string }
  | { URLEncoded: KeyValuePair[] }
  | { FormData: FormDataEntry[] }

type ClientCertDef =
  | {
  PEMCert: {
    certificate_pem: number[],
    key_pem: number[]
  },
}
  | {
  PFXCert: {
    certificate_pfx: number[],
    password: string
  }
}

// TODO: Figure out a way to autogen this from the interceptor definition on the Rust side
export type RequestDef = {
  req_id: number

  method: string
  endpoint: string

  parameters: KeyValuePair[]
  headers: KeyValuePair[]

  body: BodyDef | null,

  validate_certs: boolean,
  root_cert_bundle_files: number[],
  client_cert: ClientCertDef | null

  proxy?: {
    no_proxy: string[];
    url: string
  }
}

type RunRequestResponse = {
  status: number,
  status_text: string,
  headers: KeyValuePair[],
  data: number[],

  time_start_ms: number,
  time_end_ms: number
}

// HACK: To solve the AxiosRequestConfig being different between @hoppscotch/common
// and the axios present in this package
type AxiosRequestConfig = Parameters<Interceptor["runRequest"]>[0]

export const preProcessRequest = (
  req: AxiosRequestConfig
): AxiosRequestConfig => {
  const reqClone = cloneDeep(req)

  // If the parameters are URLSearchParams, inject them to URL instead
  // This prevents issues of marshalling the URLSearchParams to the proxy
  if (reqClone.params instanceof URLSearchParams) {
    try {
      const url = new URL(reqClone.url ?? "")

      for (const [key, value] of reqClone.params.entries()) {
        url.searchParams.append(key, value)
      }

      reqClone.url = url.toString()
    } catch (e) {
      // making this a non-empty block, so we can make the linter happy.
      // we should probably use, allowEmptyCatch, or take the time to do something with the caught errors :)
    }

    reqClone.params = {}
  }

  return reqClone
}

async function processBody(axiosReq: AxiosRequestConfig): Promise<BodyDef | null> {
  if (!axiosReq.data) return null

  if (typeof axiosReq.data === "string") {
    return {Text: axiosReq.data}
  }

  if (axiosReq.data instanceof FormData) {
    const entries: FormDataEntry[] = []

    for (const [key, value] of axiosReq.data.entries()) {
      if (typeof value === "string") {
        entries.push({
          key,
          value: {Text: value}
        })
      } else {
        const mime = value.type !== "" ? value.type : "application/octet-stream"

        entries.push({
          key,
          value: {
            File: {
              filename: value.name,
              data: Array.from(new Uint8Array(await value.arrayBuffer())),
              mime,
            }
          }
        })
      }
    }

    return {FormData: entries}
  }

  throw new Error("Native Process Body: Unhandled Axios Request Configuration")
}

function getURLDomain(url: string): string | null {
  try {
    return new URL(url).host
  } catch (_) {
    return null
  }
}

function convertClientCertToDefCert(cert: ClientCertificateEntry): ClientCertDef {
  if ("PEMCert" in cert.cert) {
    return {
      PEMCert: {
        certificate_pem: Array.from(cert.cert.PEMCert.certificate_pem),
        key_pem: Array.from(cert.cert.PEMCert.key_pem)
      }
    }
  } else {
    return {
      PFXCert: {
        certificate_pfx: Array.from(cert.cert.PFXCert.certificate_pfx),
        password: cert.cert.PFXCert.password
      }
    }
  }
}

async function convertToRequestDef(
  axiosReq: AxiosRequestConfig,
  reqID: number,
  caCertificates: CACertificateEntry[],
  clientCertificates: Map<string, ClientCertificateEntry>,
  validateCerts: boolean,
  proxyInfo: RequestDef["proxy"]
): Promise<RequestDef> {

  const clientCertDomain = getURLDomain(axiosReq.url!);
  const clientCert = clientCertDomain ? clientCertificates.get(clientCertDomain) : null;
  const useProxy = proxyInfo && (!proxyInfo.no_proxy || (proxyInfo.no_proxy.filter(domain => domain.trim().length > 0).length === 0 || shouldUseProxy(axiosReq.url!, proxyInfo.no_proxy.map(domain => domain.trim()))));
  return {
    req_id: reqID,
    method: axiosReq.method ?? "GET",
    endpoint: axiosReq.url ?? "",
    headers: Object.entries(axiosReq.headers ?? {})
      .filter(
        ([key, value]) =>
          !(
            key.toLowerCase() === "content-type" &&
            value.toLowerCase() === "multipart/form-data"
          )
      ) // Removing header, because this header will be set by relay.
      .map(([key, value]): KeyValuePair => ({key, value})),
    parameters: Object.entries(axiosReq.params as Record<string, string> ?? {})
      .map(([key, value]): KeyValuePair => ({key, value})),
    body: await processBody(axiosReq),
    root_cert_bundle_files: caCertificates.map((cert) => Array.from(cert.certificate)),
    validate_certs: validateCerts,
    client_cert: clientCert ? convertClientCertToDefCert(clientCert) : null,
    proxy: useProxy ? proxyInfo : undefined
  };
}

function shouldUseProxy(url: string, noProxyList: string[]): boolean {
  const hostname = new URL(url).hostname.toLowerCase();
  return !noProxyList.some(domain => hostname.endsWith(domain.toLowerCase().trim()));
}

export const CACertificateEntry = z.object({
  filename: z.string().min(1),
  enabled: z.boolean(),
  certificate: z.instanceof(Uint8Array)
})

export type CACertificateEntry = z.infer<typeof CACertificateEntry>

export const ClientCertificateEntry = z.object({
  enabled: z.boolean(),
  domain: z.string().trim().min(1),
  cert: z.union([
    z.object({
      PEMCert: z.object({
        certificate_filename: z.string().min(1),
        certificate_pem: z.instanceof(Uint8Array),

        key_filename: z.string().min(1),
        key_pem: z.instanceof(Uint8Array),
      })
    }),
    z.object({
      PFXCert: z.object({
        certificate_filename: z.string().min(1),
        certificate_pfx: z.instanceof(Uint8Array),

        password: z.string()
      })
    })
  ])
})

export type ClientCertificateEntry = z.infer<typeof ClientCertificateEntry>

const CA_STORE_PERSIST_KEY = "native_interceptor_ca_store"
const CLIENT_CERTS_PERSIST_KEY = "native_interceptor_client_certs_store"
const VALIDATE_SSL_KEY = "native_interceptor_validate_ssl"
const PROXY_INFO_PERSIST_KEY = "native_interceptor_proxy_info"

export class NativeInterceptorService extends Service implements Interceptor {
  public static readonly ID = "NATIVE_INTERCEPTOR_SERVICE"

  public interceptorID = "native"

  public name = () => "Native"

  public selectable = {type: "selectable" as const}

  public supportsCookies = true
  public supportsDigestAuth = true
  public supportsBinaryContentType = false

  private cookieJarService = this.bind(CookieJarService)
  private persistenceService: PersistenceService = this.bind(PersistenceService)

  private reqIDTicker = 0

  public settingsPageEntry = {
    entryTitle: () => "Native", // TODO: i18n this
    component: SettingsNativeInterceptor
  }

  public caCertificates = ref<CACertificateEntry[]>([])

  public clientCertificates = ref<Map<string, ClientCertificateEntry>>(new Map())
  public validateCerts = ref(true)
  public proxyInfo = ref<RequestDef["proxy"]>(undefined)

  override onServiceInit() {
    // Load SSL Validation
    const persistedValidateSSL: unknown = JSON.parse(
      this.persistenceService.getLocalConfig(VALIDATE_SSL_KEY) ?? "null"
    )

    if (typeof persistedValidateSSL === "boolean") {
      this.validateCerts.value = persistedValidateSSL
    }

    const persistedProxyInfo = this.persistenceService.getLocalConfig(
      PROXY_INFO_PERSIST_KEY
    )

    if (persistedProxyInfo && persistedProxyInfo !== "null") {
      try {
        const proxyInfo = JSON.parse(persistedProxyInfo)
        this.proxyInfo.value = proxyInfo
      } catch (e) {
      }
    }

    watch(this.validateCerts, () => {
      this.persistenceService.setLocalConfig(VALIDATE_SSL_KEY, JSON.stringify(this.validateCerts.value))
    })

    // Load and setup writes for CA Store
    const persistedCAStoreData = JSON.parse(
      this.persistenceService.getLocalConfig(CA_STORE_PERSIST_KEY) ?? "null"
    )

    const caStoreDataParseResult = CACertStore.safeParse(persistedCAStoreData)

    if (caStoreDataParseResult.type === "ok") {
      this.caCertificates.value = caStoreDataParseResult.value.certs
        .map((entry) => ({...entry, certificate: new Uint8Array(entry.certificate)}))
    }

    watch(this.caCertificates, (certs) => {
      const storableValue: CACertStore = {
        v: 1,
        certs: certs
          .map((el) => ({...el, certificate: Array.from(el.certificate)}))
      }

      this.persistenceService.setLocalConfig(CA_STORE_PERSIST_KEY, JSON.stringify(storableValue))
    })


    // Load and setup writes for Client Certs Store
    const persistedClientCertStoreData = JSON.parse(
      this.persistenceService.getLocalConfig(CLIENT_CERTS_PERSIST_KEY) ?? "null"
    )

    const clientCertStoreDataParseResult = ClientCertsStore.safeParse(persistedClientCertStoreData)

    if (clientCertStoreDataParseResult.type === "ok") {
      this.clientCertificates.value = new Map(
        Object.entries(
          clientCertStoreDataParseResult.value.clientCerts
        )
          .map(([domain, cert]) => {
            if ("PFXCert" in cert.cert) {
              const newCert = <ClientCertificateEntry>{
                ...cert,
                cert: {
                  PFXCert: {
                    certificate_pfx: new Uint8Array(cert.cert.PFXCert.certificate_pfx),
                    certificate_filename: cert.cert.PFXCert.certificate_filename,

                    password: cert.cert.PFXCert.password
                  }
                }
              }

              return [domain, newCert]
            } else {
              const newCert = <ClientCertificateEntry>{
                ...cert,
                cert: {
                  PEMCert: {
                    certificate_pem: new Uint8Array(cert.cert.PEMCert.certificate_pem),
                    certificate_filename: cert.cert.PEMCert.certificate_filename,

                    key_pem: new Uint8Array(cert.cert.PEMCert.key_pem),
                    key_filename: cert.cert.PEMCert.key_filename
                  }
                }
              }

              return [domain, newCert]
            }
          })
      )
    }

    watch(this.clientCertificates, (certs) => {
      const storableValue: ClientCertStore = {
        v: 1,
        clientCerts: Object.fromEntries(
          Array.from(certs.entries())
            .map(([domain, cert]) => {
              if ("PFXCert" in cert.cert) {
                const newCert = <StoredClientCert>{
                  ...cert,
                  cert: {
                    PFXCert: {
                      certificate_pfx: Array.from(cert.cert.PFXCert.certificate_pfx),
                      certificate_filename: cert.cert.PFXCert.certificate_filename,

                      password: cert.cert.PFXCert.password
                    }
                  }
                }

                return [domain, newCert]
              } else {
                const newCert = <StoredClientCert>{
                  ...cert,
                  cert: {
                    PEMCert: {
                      certificate_pem: Array.from(cert.cert.PEMCert.certificate_pem),
                      certificate_filename: cert.cert.PEMCert.certificate_filename,

                      key_pem: Array.from(cert.cert.PEMCert.key_pem),
                      key_filename: cert.cert.PEMCert.key_filename
                    }
                  }
                }

                return [domain, newCert]
              }
            })
        )
      }


      this.persistenceService.setLocalConfig(CLIENT_CERTS_PERSIST_KEY, JSON.stringify(storableValue))
    })

    watch(this.proxyInfo, (newProxyInfo) => {
      this.persistenceService.setLocalConfig(
        PROXY_INFO_PERSIST_KEY,
        JSON.stringify(newProxyInfo) ?? "null"
      )
    })
  }

  public runRequest(req: AxiosRequestConfig): RequestRunResult<InterceptorError> {
    const processedReq = preProcessRequest(req)

    const relevantCookies = this.cookieJarService.getCookiesForURL(
      new URL(processedReq.url!)
    )

    if (relevantCookies.length > 0) {
      processedReq.headers["Cookie"] = relevantCookies
        .map((cookie) => `${cookie.name!}=${cookie.value!}`)
        .join(";")
    }

    const reqID = this.reqIDTicker++;

    return {
      cancel: () => {
        invoke("plugin:hopp_native_interceptor|cancel_request", {reqId: reqID});
      },
      response: (async () => {
        const requestDef = await convertToRequestDef(
          processedReq,
          reqID,
          this.caCertificates.value,
          this.clientCertificates.value,
          this.validateCerts.value,
          this.proxyInfo.value
        )

        try {
          console.log(requestDef)

          const response: RunRequestResponse = await invoke(
            "plugin:hopp_native_interceptor|run_request",
            {req: requestDef}
          )

          return E.right({
            headers: Object.fromEntries(
              response.headers.map(({key, value}) => [key, value])
            ),
            status: response.status,
            statusText: response.status_text,
            data: new Uint8Array(response.data).buffer,
            config: {
              timeData: {
                startTime: response.time_start_ms,
                endTime: response.time_end_ms
              }
            },
            additional: {
              multiHeaders: response.headers
            }
          })
        } catch (e) {
          console.log(e)

          if (typeof e === "object" && (e as any)["RequestCancelled"]) {
            return E.left("cancellation" as const)
          }

          // TODO: More in-depth error messages
          return E.left(<InterceptorError>{
            humanMessage: {
              heading: (t) => t("error.network_fail"),
              description: (t) => t("helpers.network_fail"),
            }
          })
        }
      })()
    }
  }
}
