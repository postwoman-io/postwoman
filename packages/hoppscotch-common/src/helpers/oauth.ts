import * as E from "fp-ts/Either"
import { z } from "zod"

import { getService } from "~/modules/dioc"
import { PersistenceService } from "~/services/persistence"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { content } from "@hoppscotch/kernel"

const kernelInterceptor = getService(KernelInterceptorService)
const persistenceService = getService(PersistenceService)

const redirectUri = `${window.location.origin}/oauth`

export type TokenRequestParams = {
  oidcDiscoveryUrl: string
  grantType: string
  authUrl: string
  accessTokenUrl: string
  clientId: string
  clientSecret: string
  scope: string
}

async function getTokenConfiguration(endpoint: string) {
  const { response } = kernelInterceptor.execute({
    id: Date.now(),
    url: endpoint,
    method: "GET",
    version: "HTTP/1.1",
    headers: {
      "Content-Type": ["application/json"],
    },
  })

  const result = await response
  if (E.isLeft(result)) return E.left("OIDC_DISCOVERY_FAILED")

  const jsonContent = result.right.content
  if (jsonContent.kind !== "json") return E.left("OIDC_DISCOVERY_FAILED")

  return E.right(jsonContent.content)
}

const generateRandomString = () => {
  const array = new Uint32Array(28)
  window.crypto.getRandomValues(array)
  return Array.from(array, (dec) => `0${dec.toString(16)}`.slice(-2)).join("")
}

const base64urlencode = (str: ArrayBuffer) => {
  const hashArray = Array.from(new Uint8Array(str))
  return btoa(String.fromCharCode.apply(null, hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

const pkceChallengeFromVerifier = async (v: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(v)
  const hashed = await window.crypto.subtle.digest("SHA-256", data)
  return base64urlencode(hashed)
}

export const tokenRequest = async ({
  oidcDiscoveryUrl,
  grantType,
  authUrl,
  accessTokenUrl,
  clientId,
  clientSecret,
  scope,
}: TokenRequestParams) => {
  if (oidcDiscoveryUrl) {
    const res = await getTokenConfiguration(oidcDiscoveryUrl)

    const OIDCConfigurationSchema = z.object({
      authorization_endpoint: z.string(),
      token_endpoint: z.string(),
    })

    if (E.isLeft(res)) return E.left("OIDC_DISCOVERY_FAILED")

    const parsedOIDCConfiguration = OIDCConfigurationSchema.safeParse(res.right)
    if (!parsedOIDCConfiguration.success) return E.left("OIDC_DISCOVERY_FAILED")

    authUrl = parsedOIDCConfiguration.data.authorization_endpoint
    accessTokenUrl = parsedOIDCConfiguration.data.token_endpoint
  }

  await persistenceService.setLocalConfig("tokenEndpoint", accessTokenUrl)
  await persistenceService.setLocalConfig("client_id", clientId)
  await persistenceService.setLocalConfig("client_secret", clientSecret)

  const state = generateRandomString()
  await persistenceService.setLocalConfig("pkce_state", state)

  const codeVerifier = generateRandomString()
  await persistenceService.setLocalConfig("pkce_codeVerifier", codeVerifier)

  const codeChallenge = await pkceChallengeFromVerifier(codeVerifier)

  const url = new URL(authUrl)
  url.searchParams.set("response_type", grantType)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("state", state)
  url.searchParams.set("scope", scope)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("code_challenge", codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")

  window.location.assign(url.toString())
}

export const handleOAuthRedirect = async () => {
  const queryParams = Object.fromEntries(
    new URLSearchParams(window.location.search)
  )

  if (queryParams.error) return E.left("AUTH_SERVER_RETURNED_ERROR")
  if (!queryParams.code) return E.left("NO_AUTH_CODE")
  if (
    (await persistenceService.getLocalConfig("pkce_state")) !==
    queryParams.state
  ) {
    return E.left("INVALID_STATE")
  }

  const tokenEndpoint = await persistenceService.getLocalConfig("tokenEndpoint")
  const clientID = await persistenceService.getLocalConfig("client_id")
  const clientSecret = await persistenceService.getLocalConfig("client_secret")
  const codeVerifier =
    await persistenceService.getLocalConfig("pkce_codeVerifier")

  if (!tokenEndpoint) return E.left("NO_TOKEN_ENDPOINT")
  if (!clientID) return E.left("NO_CLIENT_ID")
  if (!clientSecret) return E.left("NO_CLIENT_SECRET")
  if (!codeVerifier) return E.left("NO_CODE_VERIFIER")

  const requestParams = {
    grant_type: "authorization_code",
    code: queryParams.code,
    client_id: clientID,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  }

  const { response } = kernelInterceptor.execute({
    id: Date.now(),
    url: tokenEndpoint,
    method: "POST",
    version: "HTTP/1.1",
    headers: {
      "Content-Type": ["application/x-www-form-urlencoded"],
    },
    content: content.urlencoded(requestParams),
  })

  clearPKCEState()

  const result = await response
  if (E.isLeft(result)) return E.left("AUTH_TOKEN_REQUEST_FAILED")

  if (result.right.content.kind !== "json") {
    return E.left("AUTH_TOKEN_REQUEST_FAILED")
  }

  const withAccessTokenSchema = z.object({
    access_token: z.string(),
  })

  const parsedTokenResponse = withAccessTokenSchema.safeParse(
    result.right.content.content
  )

  return parsedTokenResponse.success
    ? E.right(parsedTokenResponse.data)
    : E.left("AUTH_TOKEN_REQUEST_INVALID_RESPONSE")
}

const clearPKCEState = async () => {
  await persistenceService.removeLocalConfig("pkce_state")
  await persistenceService.removeLocalConfig("pkce_codeVerifier")
  await persistenceService.removeLocalConfig("tokenEndpoint")
  await persistenceService.removeLocalConfig("client_id")
  await persistenceService.removeLocalConfig("client_secret")
}
