import { PersistenceService } from "~/services/persistence"
import {
  OauthAuthService,
  PersistedOAuthConfig,
  createFlowConfig,
  generateRandomString,
  decodeResponseAsJSON,
} from "../oauth.service"
import { z } from "zod"
import { getService } from "~/modules/dioc"
import * as E from "fp-ts/Either"
import { AuthCodeGrantTypeParams } from "@hoppscotch/data"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { content } from "@hoppscotch/kernel"

const persistenceService = getService(PersistenceService)
const kernelInterceptor = getService(KernelInterceptorService)

const AuthCodeOauthFlowParamsSchema = AuthCodeGrantTypeParams.pick({
  authEndpoint: true,
  tokenEndpoint: true,
  clientID: true,
  clientSecret: true,
  scopes: true,
  isPKCE: true,
  codeVerifierMethod: true,
})
  .refine((params) => {
    return (
      params.authEndpoint.length >= 1 &&
      params.tokenEndpoint.length >= 1 &&
      params.clientID.length >= 1 &&
      (!params.scopes || params.scopes.trim().length >= 1)
    )
  })
  .refine((params) => (params.isPKCE ? !!params.codeVerifierMethod : true), {
    message: "codeVerifierMethod is required when using PKCE",
    path: ["codeVerifierMethod"],
  })

export type AuthCodeOauthFlowParams = z.infer<
  typeof AuthCodeOauthFlowParamsSchema
>
export type AuthCodeOauthRefreshParams = {
  tokenEndpoint: string
  clientID: string
  clientSecret?: string
  refreshToken: string
}

export const getDefaultAuthCodeOauthFlowParams =
  (): AuthCodeOauthFlowParams => ({
    authEndpoint: "",
    tokenEndpoint: "",
    clientID: "",
    clientSecret: "",
    scopes: undefined,
    isPKCE: false,
    codeVerifierMethod: "S256",
  })

const initAuthCodeOauthFlow = async (params: AuthCodeOauthFlowParams) => {
  const state = generateRandomString()
  let codeVerifier: string | undefined
  let codeChallenge: string | undefined

  if (params.isPKCE) {
    codeVerifier = generateCodeVerifier()
    codeChallenge = await generateCodeChallenge(
      codeVerifier,
      params.codeVerifierMethod
    )
  }

  const oauthTempConfig = {
    state,
    grant_type: "AUTHORIZATION_CODE",
    ...params,
    ...(codeVerifier && codeChallenge ? { codeVerifier, codeChallenge } : {}),
  }

  const localOAuthTempConfig =
    persistenceService.getLocalConfig("oauth_temp_config")
  const persistedOAuthConfig: PersistedOAuthConfig = localOAuthTempConfig
    ? { ...JSON.parse(localOAuthTempConfig) }
    : {}

  persistenceService.setLocalConfig(
    "oauth_temp_config",
    JSON.stringify(<PersistedOAuthConfig>{
      ...persistedOAuthConfig,
      fields: oauthTempConfig,
      grant_type: "AUTHORIZATION_CODE",
    })
  )

  try {
    const url = new URL(params.authEndpoint)
    url.searchParams.set("grant_type", "authorization_code")
    url.searchParams.set("client_id", params.clientID)
    url.searchParams.set("state", state)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("redirect_uri", OauthAuthService.redirectURI)

    if (params.scopes) url.searchParams.set("scope", params.scopes)
    if (params.codeVerifierMethod && codeChallenge) {
      url.searchParams.set("code_challenge", codeChallenge)
      url.searchParams.set("code_challenge_method", params.codeVerifierMethod)
    }

    window.location.assign(url.toString())
    return E.right(undefined)
  } catch (e) {
    return E.left("INVALID_AUTH_ENDPOINT")
  }
}

const handleRedirectForAuthCodeOauthFlow = async (localConfig: string) => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get("code")
  const state = params.get("state")
  const error = params.get("error")

  if (error) return E.left("AUTH_SERVER_RETURNED_ERROR")
  if (!code) return E.left("AUTH_TOKEN_REQUEST_FAILED")

  const expectedSchema = z.object({
    source: z.optional(z.string()),
    state: z.string(),
    tokenEndpoint: z.string(),
    clientSecret: z.string(),
    clientID: z.string(),
    codeVerifier: z.string().optional(),
    codeChallenge: z.string().optional(),
  })

  const decodedLocalConfig = expectedSchema.safeParse(
    JSON.parse(localConfig).fields
  )
  if (!decodedLocalConfig.success) return E.left("INVALID_LOCAL_CONFIG")
  if (decodedLocalConfig.data.state !== state) return E.left("INVALID_STATE")

  const config = {
    grant_type: "authorization_code",
    code,
    client_id: decodedLocalConfig.data.clientID,
    client_secret: decodedLocalConfig.data.clientSecret,
    redirect_uri: OauthAuthService.redirectURI,
    ...(decodedLocalConfig.data.codeVerifier && {
      code_verifier: decodedLocalConfig.data.codeVerifier,
    }),
  }

  const { response } = kernelInterceptor.execute({
    id: Date.now(),
    url: decodedLocalConfig.data.tokenEndpoint,
    method: "POST",
    version: "HTTP/1.1",
    headers: {
      "Content-Type": ["application/x-www-form-urlencoded"],
      Accept: ["application/json"],
    },
    content: content.urlencoded(config),
  })

  const result = await response
  if (E.isLeft(result)) return E.left("AUTH_TOKEN_REQUEST_FAILED")

  const jsonResponse = decodeResponseAsJSON(result.right)
  if (E.isLeft(jsonResponse)) return E.left("AUTH_TOKEN_REQUEST_FAILED")

  const withAccessTokenSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
  })

  const parsedTokenResponse = withAccessTokenSchema.safeParse(
    jsonResponse.right
  )

  return parsedTokenResponse.success
    ? E.right(parsedTokenResponse.data)
    : E.left("AUTH_TOKEN_REQUEST_INVALID_RESPONSE")
}

const generateCodeVerifier = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const length = Math.floor(Math.random() * (128 - 43 + 1)) + 43
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((x) => characters[x % characters.length])
    .join("")
}

const generateCodeChallenge = async (
  codeVerifier: string,
  strategy: AuthCodeOauthFlowParams["codeVerifierMethod"]
) => {
  if (strategy === "plain") return codeVerifier

  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  )
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

const refreshToken = async (params: AuthCodeOauthRefreshParams) => {
  const requestParams = {
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientID,
    ...(params.clientSecret && { client_secret: params.clientSecret }),
  }

  const { response } = kernelInterceptor.execute({
    id: Date.now(),
    url: params.tokenEndpoint,
    method: "POST",
    version: "HTTP/1.1",
    headers: {
      "Content-Type": ["application/x-www-form-urlencoded"],
      Accept: ["application/json"],
    },
    content: content.urlencoded(requestParams),
  })

  const result = await response
  if (E.isLeft(result)) return E.left("AUTH_TOKEN_REQUEST_FAILED")

  const jsonResponse = decodeResponseAsJSON(result.right)
  if (E.isLeft(jsonResponse)) return E.left("AUTH_TOKEN_REQUEST_FAILED")

  const withAccessTokenAndRefreshTokenSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
  })

  const parsedTokenResponse = withAccessTokenAndRefreshTokenSchema.safeParse(
    jsonResponse.right
  )

  return parsedTokenResponse.success
    ? E.right(parsedTokenResponse.data)
    : E.left("AUTH_TOKEN_REQUEST_INVALID_RESPONSE")
}

export default createFlowConfig(
  "AUTHORIZATION_CODE" as const,
  AuthCodeOauthFlowParamsSchema,
  initAuthCodeOauthFlow,
  handleRedirectForAuthCodeOauthFlow,
  refreshToken
)
