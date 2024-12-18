import { CookieJarService } from "~/services/cookie-jar.service"
import {
  Interceptor,
  InterceptorError,
  InterceptorService,
  RequestRunResult,
} from "~/services/interceptor.service"
import { Service } from "dioc"
import * as E from "fp-ts/Either"
import { ref, watch } from "vue"
import { z } from "zod"
import { PersistenceService } from "~/services/persistence"
import {
  CACertStore,
  ClientCertsStore,
  ClientCertStore,
  StoredClientCert,
} from "./persisted-data"
import axios, { CancelTokenSource } from "axios"
import SettingsAgentInterceptor from "~/components/settings/Agent.vue"
import AgentRootUIExtension from "~/components/interceptors/agent/RootExt.vue"
import { UIExtensionService } from "~/services/ui-extension.service"
import { x25519 } from "@noble/curves/ed25519"
import { base16 } from "@scure/base"
import { invokeAction } from "~/helpers/actions"
import { preProcessRequest } from "../helpers"

type KeyValuePair = {
  key: string
  value: string
}

type FormDataValue =
  | { Text: string }
  | {
      File: {
        filename: string
        data: number[]
        mime: string
      }
    }

type FormDataEntry = {
  key: string
  value: FormDataValue
}

type BodyDef =
  | { Text: string }
  | { URLEncoded: KeyValuePair[] }
  | { FormData: FormDataEntry[] }

type ClientCertDef =
  | {
      PEMCert: {
        certificate_pem: number[]
        key_pem: number[]
      }
    }
  | {
      PFXCert: {
        certificate_pfx: number[]
        password: string
      }
    }

// TODO: Figure out a way to autogen this from the interceptor definition on the Rust side
export type RequestDef = {
  req_id: number

  method: string
  endpoint: string

  headers: KeyValuePair[]

  body: BodyDef | null

  validate_certs: boolean
  root_cert_bundle_files: number[][]
  client_cert: ClientCertDef | null

  proxy?: {
    url: string
  }
}

type RunRequestResponse = {
  status: number
  status_text: string
  headers: KeyValuePair[]
  data: number[]

  time_start_ms: number
  time_end_ms: number
}

// HACK: To solve the AxiosRequestConfig being different between @hoppscotch/common
// and the axios present in this package
type AxiosRequestConfig = Parameters<Interceptor["runRequest"]>[0]

async function processBody(
  axiosReq: AxiosRequestConfig
): Promise<BodyDef | null> {
  if (!axiosReq.data) return null

  if (typeof axiosReq.data === "string") {
    return { Text: axiosReq.data }
  }

  if (axiosReq.data instanceof FormData) {
    const entries: FormDataEntry[] = []

    for (const [key, value] of axiosReq.data.entries()) {
      if (typeof value === "string") {
        entries.push({
          key,
          value: { Text: value },
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
            },
          },
        })
      }
    }

    return { FormData: entries }
  }

  throw new Error("Agent Process Body: Unhandled Axios Request Configuration")
}

function getURLDomain(url: string): string | null {
  try {
    return new URL(url).host
  } catch (_) {
    return null
  }
}

function convertClientCertToDefCert(
  cert: ClientCertificateEntry
): ClientCertDef {
  if ("PEMCert" in cert.cert) {
    return {
      PEMCert: {
        certificate_pem: Array.from(cert.cert.PEMCert.certificate_pem),
        key_pem: Array.from(cert.cert.PEMCert.key_pem),
      },
    }
  }
  return {
    PFXCert: {
      certificate_pfx: Array.from(cert.cert.PFXCert.certificate_pfx),
      password: cert.cert.PFXCert.password,
    },
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
  const clientCertDomain = getURLDomain(axiosReq.url!)

  const clientCert = clientCertDomain
    ? clientCertificates.get(clientCertDomain)
    : null

  const urlObj = new URL(axiosReq.url ?? "")

  // If there are parameters in axiosReq.params, add them to the URL.
  if (axiosReq.params) {
    const params = new URLSearchParams(urlObj.search) // Taking in existing params if are any.

    Object.entries(axiosReq.params as Record<string, string>).forEach(
      ([key, value]) => {
        params.append(key, value)
      }
    )

    urlObj.search = params.toString() // Now put back all the params in the URL.
  }

  return {
    req_id: reqID,
    method: axiosReq.method ?? "GET",
    endpoint: urlObj.toString(), // This is the updated URL with parms.
    headers: Object.entries(axiosReq.headers ?? {})
      .filter(
        ([key, value]) =>
          !(
            key.toLowerCase() === "content-type" &&
            value.toLowerCase() === "multipart/form-data"
          )
      ) // Removing header, because this header will be set by agent.
      .map(([key, value]): KeyValuePair => ({ key, value })),

    // NOTE: Injected parameters are already part of the URL

    body: await processBody(axiosReq),
    root_cert_bundle_files: caCertificates.map((cert) =>
      Array.from(cert.certificate)
    ),
    validate_certs: validateCerts,
    client_cert: clientCert ? convertClientCertToDefCert(clientCert) : null,
    proxy: proxyInfo,
  }
}

export const CACertificateEntry = z.object({
  filename: z.string().min(1),
  enabled: z.boolean(),
  certificate: z.instanceof(Uint8Array),
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
      }),
    }),
    z.object({
      PFXCert: z.object({
        certificate_filename: z.string().min(1),
        certificate_pfx: z.instanceof(Uint8Array),

        password: z.string(),
      }),
    }),
  ]),
})

export type ClientCertificateEntry = z.infer<typeof ClientCertificateEntry>

const CA_STORE_PERSIST_KEY = "agent_interceptor_ca_store"
const CLIENT_CERTS_PERSIST_KEY = "agent_interceptor_client_certs_store"
const VALIDATE_SSL_KEY = "agent_interceptor_validate_ssl"
const AUTH_KEY_PERSIST_KEY = "agent_interceptor_auth_key"
const SHARED_SECRET_PERSIST_KEY = "agent_interceptor_shared_secret"
const PROXY_INFO_PERSIST_KEY = "agent_interceptor_proxy_info"

export class AgentInterceptorService extends Service implements Interceptor {
  public static readonly ID = "AGENT_INTERCEPTOR_SERVICE"

  public interceptorID = "agent"

  // TODO: Better User facing name
  public name = () => "Agent"

  public selectable = { type: "selectable" as const }

  public supportsDigestAuth = true
  public supportsCookies = true
  public supportsBinaryContentType = false

  private interceptorService = this.bind(InterceptorService)
  private cookieJarService = this.bind(CookieJarService)
  private persistenceService = this.bind(PersistenceService)
  private uiExtensionService = this.bind(UIExtensionService)

  public isAgentRunning = ref(false)

  private reqIDTicker = 0
  private cancelTokens: Map<number, CancelTokenSource> = new Map()

  public settingsPageEntry = {
    entryTitle: () => "Agent", // TODO: i18n this
    component: SettingsAgentInterceptor,
  }

  public caCertificates = ref<CACertificateEntry[]>([])

  public clientCertificates = ref<Map<string, ClientCertificateEntry>>(
    new Map()
  )
  public validateCerts = ref(true)

  public showRegistrationModal = ref(false)
  public authKey = ref<string | null>(null)
  public sharedSecretB16 = ref<string | null>(null)
  private registrationOTP = ref<string | null>(null)

  public proxyInfo = ref<RequestDef["proxy"]>(undefined)

  override onServiceInit() {
    // Register the Root UI Extension
    this.uiExtensionService.addRootUIExtension(AgentRootUIExtension)

    const persistedAuthKey =
      this.persistenceService.getLocalConfig(AUTH_KEY_PERSIST_KEY)
    if (persistedAuthKey) {
      this.authKey.value = persistedAuthKey
    }

    const sharedSecret = this.persistenceService.getLocalConfig(
      SHARED_SECRET_PERSIST_KEY
    )
    if (sharedSecret) {
      this.sharedSecretB16.value = sharedSecret
    }

    const persistedProxyInfo = this.persistenceService.getLocalConfig(
      PROXY_INFO_PERSIST_KEY
    )
    if (persistedProxyInfo && persistedProxyInfo !== "null") {
      try {
        const proxyInfo = JSON.parse(persistedProxyInfo)
        this.proxyInfo.value = proxyInfo
      } catch (e) {}
    }

    // Load SSL Validation
    const persistedValidateSSL: unknown = JSON.parse(
      this.persistenceService.getLocalConfig(VALIDATE_SSL_KEY) ?? "null"
    )

    if (typeof persistedValidateSSL === "boolean") {
      this.validateCerts.value = persistedValidateSSL
    }

    watch(this.validateCerts, () => {
      this.persistenceService.setLocalConfig(
        VALIDATE_SSL_KEY,
        JSON.stringify(this.validateCerts.value)
      )
    })

    // Load and setup writes for CA Store
    const persistedCAStoreData = JSON.parse(
      this.persistenceService.getLocalConfig(CA_STORE_PERSIST_KEY) ?? "null"
    )

    const caStoreDataParseResult = CACertStore.safeParse(persistedCAStoreData)

    if (caStoreDataParseResult.type === "ok") {
      this.caCertificates.value = caStoreDataParseResult.value.certs.map(
        (entry) => ({
          ...entry,
          certificate: new Uint8Array(entry.certificate),
        })
      )
    }

    watch(this.caCertificates, (certs) => {
      const storableValue: CACertStore = {
        v: 1,
        certs: certs.map((el) => ({
          ...el,
          certificate: Array.from(el.certificate),
        })),
      }

      this.persistenceService.setLocalConfig(
        CA_STORE_PERSIST_KEY,
        JSON.stringify(storableValue)
      )
    })

    // Load and setup writes for Client Certs Store
    const persistedClientCertStoreData = JSON.parse(
      this.persistenceService.getLocalConfig(CLIENT_CERTS_PERSIST_KEY) ?? "null"
    )

    const clientCertStoreDataParseResult = ClientCertsStore.safeParse(
      persistedClientCertStoreData
    )

    if (clientCertStoreDataParseResult.type === "ok") {
      this.clientCertificates.value = new Map(
        Object.entries(clientCertStoreDataParseResult.value.clientCerts).map(
          ([domain, cert]) => {
            if ("PFXCert" in cert.cert) {
              const newCert = <ClientCertificateEntry>{
                ...cert,
                cert: {
                  PFXCert: {
                    certificate_pfx: new Uint8Array(
                      cert.cert.PFXCert.certificate_pfx
                    ),
                    certificate_filename:
                      cert.cert.PFXCert.certificate_filename,

                    password: cert.cert.PFXCert.password,
                  },
                },
              }

              return [domain, newCert]
            }
            const newCert = <ClientCertificateEntry>{
              ...cert,
              cert: {
                PEMCert: {
                  certificate_pem: new Uint8Array(
                    cert.cert.PEMCert.certificate_pem
                  ),
                  certificate_filename: cert.cert.PEMCert.certificate_filename,

                  key_pem: new Uint8Array(cert.cert.PEMCert.key_pem),
                  key_filename: cert.cert.PEMCert.key_filename,
                },
              },
            }

            return [domain, newCert]
          }
        )
      )
    }

    watch(this.clientCertificates, (certs) => {
      const storableValue: ClientCertStore = {
        v: 1,
        clientCerts: Object.fromEntries(
          Array.from(certs.entries()).map(([domain, cert]) => {
            if ("PFXCert" in cert.cert) {
              const newCert = <StoredClientCert>{
                ...cert,
                cert: {
                  PFXCert: {
                    certificate_pfx: Array.from(
                      cert.cert.PFXCert.certificate_pfx
                    ),
                    certificate_filename:
                      cert.cert.PFXCert.certificate_filename,

                    password: cert.cert.PFXCert.password,
                  },
                },
              }

              return [domain, newCert]
            }
            const newCert = <StoredClientCert>{
              ...cert,
              cert: {
                PEMCert: {
                  certificate_pem: Array.from(
                    cert.cert.PEMCert.certificate_pem
                  ),
                  certificate_filename: cert.cert.PEMCert.certificate_filename,

                  key_pem: Array.from(cert.cert.PEMCert.key_pem),
                  key_filename: cert.cert.PEMCert.key_filename,
                },
              },
            }

            return [domain, newCert]
          })
        ),
      }

      this.persistenceService.setLocalConfig(
        CLIENT_CERTS_PERSIST_KEY,
        JSON.stringify(storableValue)
      )
    })

    watch(this.authKey, (newAuthKey) => {
      if (newAuthKey) {
        this.persistenceService.setLocalConfig(AUTH_KEY_PERSIST_KEY, newAuthKey)
      } else {
        this.persistenceService.removeLocalConfig(AUTH_KEY_PERSIST_KEY)
      }
    })

    watch(this.proxyInfo, (newProxyInfo) => {
      this.persistenceService.setLocalConfig(
        PROXY_INFO_PERSIST_KEY,
        JSON.stringify(newProxyInfo) ?? "null"
      )
    })

    // Show registration UI if there is no auth key present
    watch(
      [this.interceptorService.currentInterceptor, this.authKey],
      ([currentInterceptor, authKey]) => {
        if (
          currentInterceptor?.interceptorID === this.interceptorID &&
          authKey === null
        ) {
          this.showRegistrationModal.value = true
        }
      },
      {
        immediate: true,
      }
    )

    // Verify if the agent registration still holds, else revoke the registration
    if (this.authKey.value) {
      ;(async () => {
        try {
          const nonce = window.crypto.getRandomValues(new Uint8Array(12))
          const nonceB16 = base16.encode(nonce).toLowerCase()

          const response = await axios.get(
            "http://localhost:9119/registered-handshake",
            {
              headers: {
                Authorization: `Bearer ${this.authKey.value}`,
                "X-Hopp-Nonce": nonceB16,
              },
              responseType: "arraybuffer",
            }
          )

          const responseNonceB16: string = response.headers["x-hopp-nonce"]
          const encryptedResponseBytes = response.data

          const parsedData = await this.getDecryptedResponse<unknown>(
            responseNonceB16,
            encryptedResponseBytes
          )

          // This should decrypt directly into `true` else registration failed
          if (parsedData !== true) {
            throw "handshake-mismatch"
          }
        } catch (e) {
          if (e === "handshake-mismatch") {
            this.sharedSecretB16.value = null
            this.authKey.value = null
          } else if (axios.isAxiosError(e) && e.status === 401) {
            this.sharedSecretB16.value = null
            this.authKey.value = null
          }
        }
      })()
    }
  }

  public async checkAgentStatus(): Promise<void> {
    try {
      await this.performHandshake()
      this.isAgentRunning.value = true
    } catch (error) {
      this.isAgentRunning.value = false
    }
  }

  public isAuthKeyPresent(): boolean {
    return this.authKey.value !== null
  }

  private generateOTP(): string {
    // This generates a 6-digit numeric OTP
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  public async performHandshake(): Promise<void> {
    const handshakeResponse = await axios.get("http://localhost:9119/handshake")
    if (
      handshakeResponse.data.status !== "success" &&
      handshakeResponse.data.__hoppscotch__agent__ === true
    ) {
      throw new Error("Handshake failed")
    }
  }

  public async initiateRegistration() {
    try {
      // Generate OTP and send registration request
      this.registrationOTP.value = this.generateOTP()

      const registrationResponse = await axios.post(
        "http://localhost:9119/receive-registration",
        {
          registration: this.registrationOTP.value,
        }
      )

      if (
        registrationResponse.data.message !== "Registration received and stored"
      ) {
        throw new Error("Registration failed")
      }

      // Registration successful, modal will handle showing the OTP input
    } catch (error) {
      console.error("Registration initiation failed:", error)
      throw error // Re-throw to let the modal handle the error
    }
  }

  public async verifyRegistration(userEnteredOTP: string) {
    try {
      const myPrivateKey = x25519.utils.randomPrivateKey()
      const myPublicKey = x25519.getPublicKey(myPrivateKey)

      const myPublicKeyB16 = base16.encode(myPublicKey).toLowerCase()

      const verificationResponse = await axios.post(
        "http://localhost:9119/verify-registration",
        {
          registration: userEnteredOTP,
          client_public_key_b16: myPublicKeyB16,
        }
      )

      const newAuthKey = verificationResponse.data.auth_key
      const agentPublicKeyB16: string =
        verificationResponse.data.agent_public_key_b16

      const agentPublicKey = base16.decode(agentPublicKeyB16.toUpperCase())

      const sharedSecret = x25519.getSharedSecret(myPrivateKey, agentPublicKey)
      const sharedSecretB16 = base16.encode(sharedSecret).toLowerCase()

      if (typeof newAuthKey === "string") {
        this.authKey.value = newAuthKey
        this.sharedSecretB16.value = sharedSecretB16
        this.persistenceService.setLocalConfig(AUTH_KEY_PERSIST_KEY, newAuthKey)
        this.persistenceService.setLocalConfig(
          SHARED_SECRET_PERSIST_KEY,
          sharedSecretB16
        )
      } else {
        throw new Error("Invalid auth key received")
      }

      this.showRegistrationModal.value = false
      this.registrationOTP.value = null
    } catch (error) {
      console.error("Verification failed:", error)
      throw new Error("Verification failed")
    }
  }

  private async getEncryptedRequestDef(
    def: RequestDef
  ): Promise<[string, ArrayBuffer]> {
    const defJSON = JSON.stringify(def)
    const defJSONBytes = new TextEncoder().encode(defJSON)

    const nonce = window.crypto.getRandomValues(new Uint8Array(12))
    const nonceB16 = base16.encode(nonce).toLowerCase()

    const sharedSecretKeyBytes = base16.decode(
      this.sharedSecretB16.value!.toUpperCase()
    )

    const sharedSecretKey = await window.crypto.subtle.importKey(
      "raw",
      sharedSecretKeyBytes,
      "AES-GCM",
      true,
      ["encrypt", "decrypt"]
    )

    const encryptedDef = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      sharedSecretKey,
      defJSONBytes
    )

    return [nonceB16, encryptedDef]
  }

  private async getDecryptedResponse<T>(
    nonceB16: string,
    responseData: ArrayBuffer
  ) {
    const sharedSecretKeyBytes = base16.decode(
      this.sharedSecretB16.value!.toUpperCase()
    )

    const sharedSecretKey = await window.crypto.subtle.importKey(
      "raw",
      sharedSecretKeyBytes,
      "AES-GCM",
      true,
      ["encrypt", "decrypt"]
    )

    const nonce = base16.decode(nonceB16.toUpperCase())

    const plainTextDefBytes = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      sharedSecretKey,
      responseData
    )

    const plainText = new TextDecoder().decode(plainTextDefBytes)

    return JSON.parse(plainText) as T
  }

  public runRequest(
    req: AxiosRequestConfig
  ): RequestRunResult<InterceptorError> {
    // TODO: Check if auth key is defined ?

    const processedReq = preProcessRequest(req)

    const relevantCookies = this.cookieJarService.getCookiesForURL(
      new URL(processedReq.url!)
    )

    if (relevantCookies.length > 0) {
      processedReq.headers!["Cookie"] = relevantCookies
        .map((cookie) => `${cookie.name!}=${cookie.value!}`)
        .join(";")
    }

    const reqID = this.reqIDTicker++

    const cancelTokenSource = axios.CancelToken.source()
    this.cancelTokens.set(reqID, cancelTokenSource)

    return {
      cancel: () => {
        const cancelTokenSource = this.cancelTokens.get(reqID)
        if (cancelTokenSource) {
          cancelTokenSource.cancel("Request cancelled")
          this.cancelTokens.delete(reqID)
          axios
            .post(
              `http://localhost:9119/cancel-request/${reqID}`,
              {},
              {
                headers: {
                  Authorization: `Bearer ${this.authKey.value}`,
                },
              }
            )
            .catch((error) => console.error("Error cancelling request:", error))
        }
      },
      response: (async () => {
        await this.checkAgentStatus()

        if (!this.isAgentRunning.value || !this.authKey.value) {
          invokeAction("agent.open-registration-modal")

          return E.left(<InterceptorError>{
            humanMessage: {
              heading: (t) => t("error.network_fail"),
              description: (t) => t("helpers.network_fail"),
            },
          })
        }

        const requestDef = await convertToRequestDef(
          processedReq,
          reqID,
          this.caCertificates.value,
          this.clientCertificates.value,
          this.validateCerts.value,
          this.proxyInfo.value
        )

        const [nonceB16, encryptedDef] =
          await this.getEncryptedRequestDef(requestDef)

        try {
          const http_response = await axios.post(
            "http://localhost:9119/request",
            encryptedDef,
            {
              headers: {
                Authorization: `Bearer ${this.authKey.value}`,
                "X-Hopp-Nonce": nonceB16,
                "Content-Type": "application/octet-stream",
              },
              cancelToken: cancelTokenSource.token,
              responseType: "arraybuffer",
            }
          )

          const responseNonceB16: string = http_response.headers["x-hopp-nonce"]
          const encryptedResponseBytes = http_response.data

          const response = await this.getDecryptedResponse<RunRequestResponse>(
            responseNonceB16,
            encryptedResponseBytes
          )

          // TODO: Run it against a Zod Schema validation

          return E.right({
            headers: Object.fromEntries(
              response.headers.map(({ key, value }) => [key, value])
            ),
            status: response.status,
            statusText: response.status_text,
            data: new Uint8Array(response.data).buffer,
            config: {
              timeData: {
                startTime: response.time_start_ms,
                endTime: response.time_end_ms,
              },
            },
            additional: {
              multiHeaders: response.headers,
            },
          })
        } catch (e) {
          if (typeof e === "object" && (e as any)["RequestCancelled"]) {
            return E.left("cancellation" as const)
          }

          // TODO: More in-depth error messages
          return E.left(<InterceptorError>{
            humanMessage: {
              heading: (t) => t("error.network_fail"),
              description: (t) => t("helpers.network_fail"),
            },
          })
        }
      })(),
    }
  }
}
