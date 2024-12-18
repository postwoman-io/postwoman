import { Service } from "dioc"
import { ref } from "vue"
import * as E from "fp-ts/Either"
import axios from "axios"
import { Store } from "~/kernel/store"
import { PersistenceService } from "~/services/persistence"
import { RelayRequest, RelayResponse } from "@hoppscotch/kernel"
import { x25519 } from "@noble/curves/ed25519"
import { base16 } from "@scure/base"

const STORE_NAMESPACE = "interceptors.agent.v1"

const STORE_KEYS = {
  SETTINGS: "settings",
  AUTH_KEY: "auth_key",
  SHARED_SECRET: "shared_secret",
  PROXY: "proxy_info",
  VALIDATE_SSL: "validate_ssl",
  CA_STORE: "ca_store",
  CLIENT_CERTS: "client_certs",
} as const

interface StoredData {
  version: string
  domains: Record<string, AgentDomainSetting>
  lastUpdated: string
}

type AgentDomainSetting = {
  version: "v1"
  security?: {
    validateCertificates: boolean
    verifyHost: boolean
    verifyPeer: boolean
  }
  proxy?: {
    url: string
    auth?: {
      username: string
      password: string
    }
    certificates?: {
      ca?: Uint8Array[]
      client?: {
        kind: "pem" | "pfx"
        cert: Uint8Array
        key?: Uint8Array
        password?: string
      }
    }
  }
}

export class KernelInterceptorAgentStore extends Service {
  public static readonly ID = "AGENT_INTERCEPTOR_STORE"
  private static readonly GLOBAL_DOMAIN = "*"
  private static readonly DEFAULT_GLOBAL_SETTINGS: AgentDomainSetting = {
    version: "v1",
    security: {
      validateCertificates: true,
      verifyHost: true,
      verifyPeer: true,
    },
  }

  private persistenceService = this.bind(PersistenceService)
  private domainSettings = new Map<string, AgentDomainSetting>()

  public isAgentRunning = ref(false)
  public authKey = ref<string | null>(null)
  private sharedSecretB16 = ref<string | null>(null)

  override async onServiceInit() {
    const initResult = await Store.init()
    if (E.isLeft(initResult)) {
      console.error("[AgentStore] Failed to initialize store:", initResult.left)
      return
    }

    await this.loadSettings()
    await this.initializeAuth()

    this.setupWatchers()
  }

  private async loadSettings(): Promise<void> {
    const loadResult = await Store.get<StoredData>(
      STORE_NAMESPACE,
      STORE_KEYS.SETTINGS
    )

    if (E.isRight(loadResult) && loadResult.right) {
      const storedData = loadResult.right
      this.domainSettings = new Map(Object.entries(storedData.domains))
    }

    if (!this.domainSettings.has(KernelInterceptorAgentStore.GLOBAL_DOMAIN)) {
      this.domainSettings.set(
        KernelInterceptorAgentStore.GLOBAL_DOMAIN,
        KernelInterceptorAgentStore.DEFAULT_GLOBAL_SETTINGS
      )
      await this.persistSettings()
    }
  }

  private async initializeAuth() {
    const persistedAuthKey = this.persistenceService.getLocalConfig(
      STORE_KEYS.AUTH_KEY
    )
    if (persistedAuthKey) this.authKey.value = persistedAuthKey

    const sharedSecret = this.persistenceService.getLocalConfig(
      STORE_KEYS.SHARED_SECRET
    )
    if (sharedSecret) this.sharedSecretB16.value = sharedSecret
  }

  private setupWatchers() {
    Store.watch(STORE_NAMESPACE, STORE_KEYS.SETTINGS).on(
      "change",
      async ({ value }) => {
        if (value) {
          const storedData = value as StoredData
          this.domainSettings = new Map(Object.entries(storedData.domains))
        }
      }
    )
  }

  private async persistSettings(): Promise<void> {
    const storedData: StoredData = {
      version: "v1",
      domains: Object.fromEntries(this.domainSettings),
      lastUpdated: new Date().toISOString(),
    }

    const saveResult = await Store.set(
      STORE_NAMESPACE,
      STORE_KEYS.SETTINGS,
      storedData
    )
    if (E.isLeft(saveResult)) {
      console.error("[AgentStore] Failed to save settings:", saveResult.left)
    }
  }

  public async checkAgentStatus(): Promise<void> {
    try {
      const handshakeResponse = await axios.get(
        "http://localhost:9119/handshake"
      )
      this.isAgentRunning.value =
        handshakeResponse.data.status === "success" &&
        handshakeResponse.data.__hoppscotch__agent__ === true
    } catch {
      this.isAgentRunning.value = false
    }
  }

  public isAuthKeyPresent(): boolean {
    return this.authKey.value !== null
  }

  public async initiateRegistration() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    const response = await axios.post(
      "http://localhost:9119/receive-registration",
      {
        registration: otp,
      }
    )

    if (response.data.message !== "Registration received and stored") {
      throw new Error("Registration failed")
    }

    return otp
  }

  public async verifyRegistration(otp: string): Promise<void> {
    const myPrivateKey = x25519.utils.randomPrivateKey()
    const myPublicKey = x25519.getPublicKey(myPrivateKey)
    const myPublicKeyB16 = base16.encode(myPublicKey).toLowerCase()

    const response = await axios.post(
      "http://localhost:9119/verify-registration",
      {
        registration: otp,
        client_public_key_b16: myPublicKeyB16,
      }
    )

    const { auth_key: newAuthKey, agent_public_key_b16: agentPublicKeyB16 } =
      response.data

    if (typeof newAuthKey !== "string")
      throw new Error("Invalid auth key received")

    const agentPublicKey = base16.decode(agentPublicKeyB16.toUpperCase())
    const sharedSecret = x25519.getSharedSecret(myPrivateKey, agentPublicKey)
    const sharedSecretB16 = base16.encode(sharedSecret).toLowerCase()

    this.authKey.value = newAuthKey
    this.sharedSecretB16.value = sharedSecretB16

    this.persistenceService.setLocalConfig(STORE_KEYS.AUTH_KEY, newAuthKey)
    this.persistenceService.setLocalConfig(
      STORE_KEYS.SHARED_SECRET,
      sharedSecretB16
    )
  }

  public async encryptRequest(
    request: RelayRequest,
    reqID: number
  ): Promise<[string, ArrayBuffer]> {
    const reqJSON = JSON.stringify({ ...request, req_id: reqID })
    const reqJSONBytes = new TextEncoder().encode(reqJSON)

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

    const encryptedReq = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      sharedSecretKey,
      reqJSONBytes
    )

    return [nonceB16, encryptedReq]
  }

  public async decryptResponse(
    nonceB16: string,
    encryptedResponse: ArrayBuffer
  ): Promise<RelayResponse> {
    const nonce = base16.decode(nonceB16.toUpperCase())
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

    const decryptedBytes = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      sharedSecretKey,
      encryptedResponse
    )

    const decryptedText = new TextDecoder().decode(decryptedBytes)
    return JSON.parse(decryptedText)
  }

  public async cancelRequest(reqId: number): Promise<void> {
    try {
      await axios.post(
        `http://localhost:9119/cancel-request/${reqId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.authKey.value}`,
          },
        }
      )
    } catch (error) {
      console.error("Error cancelling request:", error)
    }
  }

  public getDomainSettings(domain: string): AgentDomainSetting {
    return (
      this.domainSettings.get(domain) ?? {
        ...KernelInterceptorAgentStore.DEFAULT_GLOBAL_SETTINGS,
      }
    )
  }

  public async saveDomainSettings(
    domain: string,
    settings: Partial<AgentDomainSetting>
  ): Promise<void> {
    const updated: AgentDomainSetting = {
      version: "v1",
      ...settings,
    }

    this.domainSettings.set(domain, updated)
    await this.persistSettings()
  }

  public async clearDomainSettings(domain: string): Promise<void> {
    this.domainSettings.delete(domain)
    await this.persistSettings()
  }

  public getDomains(): string[] {
    return Array.from(this.domainSettings.keys())
  }

  public getAllDomainSettings(): Map<string, AgentDomainSetting> {
    return new Map(this.domainSettings)
  }
}
