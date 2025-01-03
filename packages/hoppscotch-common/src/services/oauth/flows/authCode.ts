import { PersistenceService } from "~/services/persistence"
import {
  OauthAuthService,
  PersistedOAuthConfig,
  createFlowConfig,
  decodeResponseAsJSON,
  generateRandomString,
} from "../oauth.service"
import { z } from "zod"
import { getService } from "~/modules/dioc"
import * as E from "fp-ts/Either"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { AuthCodeGrantTypeParams } from "@hoppscotch/data"
import { content } from "@hoppscotch/kernel"

const persistenceService = getService(PersistenceService)
const interceptorService = getService(KernelInterceptorService)

const AuthCodeOauthFlowParamsSchema = AuthCodeGrantTypeParams.pick({
  authEndpoint: true,
  tokenEndpoint: true,
  clientID: true,
  clientSecret: true,
  scopes: true,
  isPKCE: true,
  codeVerifierMethod: true,
})
  .refine(
    (params) => {
      return (
        params.authEndpoint.length >= 1 &&
        params.tokenEndpoint.length >= 1 &&
        params.clientID.length >= 1 &&
        (!params.scopes || params.scopes.trim().length >= 1)
      )
    },
    {
      message: "Minimum length requirement not met for one or more parameters",
    }
  )
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

const initAuthCodeOauthFlow = async ({
  tokenEndpoint,
  clientID,
  clientSecret,
  scopes,
  authEndpoint,
  isPKCE,
  codeVerifierMethod,
}: AuthCodeOauthFlowParams) => {
  const state = generateRandomString()

  let codeVerifier: string | undefined
  let codeChallenge: string | undefined

  if (isPKCE) {
    codeVerifier = generateCodeVerifier()
    codeChallenge = await generateCodeChallenge(
      codeVerifier,
      codeVerifierMethod
    )
  }

  let oauthTempConfig: {
    state: string
    grant_type: "AUTHORIZATION_CODE"
    authEndpoint: string
    tokenEndpoint: string
    clientSecret?: string
    clientID: string
    isPKCE: boolean
    codeVerifier?: string
    codeVerifierMethod?: string
    codeChallenge?: string
    scopes?: string
  } = {
    state,
    grant_type: "AUTHORIZATION_CODE",
    authEndpoint,
    tokenEndpoint,
    clientSecret,
    clientID,
    isPKCE,
    codeVerifierMethod,
    scopes,
  }

  if (codeVerifier && codeChallenge) {
    oauthTempConfig = {
      ...oauthTempConfig,
      codeVerifier,
      codeChallenge,
    }
  }

  const localOAuthTempConfig =
    await persistenceService.getLocalConfig("oauth_temp_config")

  const persistedOAuthConfig: PersistedOAuthConfig = localOAuthTempConfig
    ? { ...JSON.parse(localOAuthTempConfig) }
    : {}

  const { grant_type, ...rest } = oauthTempConfig

  // persist the state so we can compare it when we get redirected back
  // also persist the grant_type,tokenEndpoint and clientSecret so we can use them when we get redirected back
  await persistenceService.setLocalConfig(
    "oauth_temp_config",
    JSON.stringify(<PersistedOAuthConfig>{
      ...persistedOAuthConfig,
      fields: rest,
      grant_type,
    })
  )

  let url: URL

  try {
    url = new URL(authEndpoint)
  } catch (e) {
    return E.left("INVALID_AUTH_ENDPOINT")
  }

  url.searchParams.set("grant_type", "authorization_code")
  url.searchParams.set("client_id", clientID)
  url.searchParams.set("state", state)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", OauthAuthService.redirectURI)

  if (scopes) url.searchParams.set("scope", scopes)

  if (codeVerifierMethod && codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge)
    url.searchParams.set("code_challenge_method", codeVerifierMethod)
  }

  // Redirect to the authorization server
  window.location.assign(url.toString())

  return E.right(undefined)
}

const handleRedirectForAuthCodeOauthFlow = async (localConfig: string) => {
  // parse the query string
  const params = new URLSearchParams(window.location.search)

  const code = params.get("code")
  const state = params.get("state")
  const error = params.get("error")

  if (error) {
    return E.left("AUTH_SERVER_RETURNED_ERROR")
  }

  if (!code) {
    return E.left("AUTH_TOKEN_REQUEST_FAILED")
  }

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

  if (!decodedLocalConfig.success) {
    return E.left("INVALID_LOCAL_CONFIG")
  }

  // check if the state matches
  if (decodedLocalConfig.data.state !== state) {
    return E.left("INVALID_STATE")
  }

  // exchange the code for a token
  const { response } = interceptorService.execute({
    id: Date.now(),
    url: decodedLocalConfig.data.tokenEndpoint,
    method: "POST",
    version: "HTTP/1.1",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    content: content.urlencoded({
      code,
      grant_type: "authorization_code",
      client_id: decodedLocalConfig.data.clientID,
      client_secret: decodedLocalConfig.data.clientSecret,
      redirect_uri: OauthAuthService.redirectURI,
      ...(decodedLocalConfig.data.codeVerifier && {
        code_verifier: decodedLocalConfig.data.codeVerifier,
      }),
    }),
  })

  const res = await response

  if (E.isLeft(res)) {
    return E.left("AUTH_TOKEN_REQUEST_FAILED" as const)
  }

  const responsePayload = decodeResponseAsJSON(res.right)

  if (E.isLeft(responsePayload)) {
    return E.left("AUTH_TOKEN_REQUEST_FAILED" as const)
  }

  const withAccessTokenSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
  })

  const parsedTokenResponse = withAccessTokenSchema.safeParse(
    responsePayload.right
  )

  return parsedTokenResponse.success
    ? E.right(parsedTokenResponse.data)
    : E.left("AUTH_TOKEN_REQUEST_INVALID_RESPONSE" as const)
}

const generateCodeVerifier = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const length = Math.floor(Math.random() * (128 - 43 + 1)) + 43 // Random length between 43 and 128
  let codeVerifier = ""

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length)
    codeVerifier += characters[randomIndex]
  }

  return codeVerifier
}

const generateCodeChallenge = async (
  codeVerifier: string,
  strategy: AuthCodeOauthFlowParams["codeVerifierMethod"]
) => {
  if (strategy === "plain") {
    return codeVerifier
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)

  const buffer = await crypto.subtle.digest("SHA-256", data)

  return encodeArrayBufferAsUrlEncodedBase64(buffer)
}

const encodeArrayBufferAsUrlEncodedBase64 = (buffer: ArrayBuffer) => {
  const hashArray = Array.from(new Uint8Array(buffer))
  const hashBase64URL = btoa(String.fromCharCode(...hashArray))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  return hashBase64URL
}

const refreshToken = async ({
  tokenEndpoint,
  clientID,
  refreshToken,
  clientSecret,
}: AuthCodeOauthRefreshParams) => {
  const { response } = interceptorService.execute({
    id: Date.now(),
    url: tokenEndpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    content: content.urlencoded({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientID,
      ...(clientSecret && {
        client_secret: clientSecret,
      }),
    }),
  })

  const res = await response

  if (E.isLeft(res)) {
    return E.left("AUTH_TOKEN_REQUEST_FAILED" as const)
  }

  const responsePayload = decodeResponseAsJSON(res.right)

  if (E.isLeft(responsePayload)) {
    return E.left("AUTH_TOKEN_REQUEST_FAILED" as const)
  }

  const withAccessTokenAndRefreshTokenSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
  })

  const parsedTokenResponse = withAccessTokenAndRefreshTokenSchema.safeParse(
    responsePayload.right
  )

  return parsedTokenResponse.success
    ? E.right(parsedTokenResponse.data)
    : E.left("AUTH_TOKEN_REQUEST_INVALID_RESPONSE" as const)
}

export default createFlowConfig(
  "AUTHORIZATION_CODE" as const,
  AuthCodeOauthFlowParamsSchema,
  initAuthCodeOauthFlow,
  handleRedirectForAuthCodeOauthFlow,
  refreshToken
)
