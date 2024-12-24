import {
  AuthType,
  ContentType,
  FormDataValue,
  MediaType,
  Method,
  RelayRequest,
  content,
} from "@hoppscotch/kernel"
import { HoppGQLRequest, HoppRESTRequest } from "@hoppscotch/data"

import { EffectiveHoppRESTRequest } from "~/helpers/utils/EffectiveURL"

export async function transformHoppGQLRequestToRequest(
  request: HoppGQLRequest
): Promise<RelayRequest> {
  const headers = request.headers
    .filter((header) => header.active)
    .reduce(
      (acc, { key, value }) => ({
        ...acc,
        [key]: value,
        "content-type": "application/json", // GQL specs
      }),
      {}
    )

  const auth = await transformAuth(request.auth)

  const gqlPayload = {
    query: request.query,
    variables: request.variables ? JSON.parse(request.variables) : undefined,
  }

  return {
    id: Date.now(),
    url: request.url,
    method: "POST", // GQL specs
    version: "HTTP/1.1",
    headers,
    auth,
    content: content.json(gqlPayload, MediaType.APPLICATION_JSON),
  }
}

export async function transformEffectiveHoppRESTRequestToRequest(
  request: EffectiveHoppRESTRequest
): Promise<RelayRequest> {
  const method = request.method.toUpperCase() as Method

  const auth = await transformAuth(request.auth)
  const content = await transformContent(request.body)

  const headers: Record<string, string> = await transformActiveRecord(
    request.effectiveFinalHeaders
  )
  const params: Record<string, string> = await transformActiveRecord(
    request.effectiveFinalParams
  )

  return {
    id: Date.now(),
    url: request.effectiveFinalURL,
    method,
    version: "HTTP/1.1",
    headers,
    params,
    auth,
    content,
  }
}

async function transformActiveRecord(
  param: { key: string; value: string; active: boolean }[]
): Promise<Record<string, string>> {
  return param
    .filter((param) => param.active)
    .reduce(
      (acc, { key, value }) => ({
        ...acc,
        [key]: value,
      }),
      {}
    )
}

async function transformAuth(auth: HoppRESTRequest["auth"]): Promise<AuthType> {
  if (!auth.authActive) return { kind: "none" }

  switch (auth.authType) {
    case "none":
    case "inherit":
      return { kind: "none" }

    case "basic":
      return {
        kind: "basic",
        username: auth.username,
        password: auth.password,
      }

    case "bearer":
      return {
        kind: "bearer",
        token: auth.token,
      }

    case "oauth-2": {
      const baseOAuth2 = {
        kind: "oauth2" as const,
        accessToken: auth.grantTypeInfo.token,
        refreshToken:
          "refreshToken" in auth.grantTypeInfo
            ? auth.grantTypeInfo.refreshToken
            : undefined,
      }

      switch (auth.grantTypeInfo.grantType) {
        case "AUTHORIZATION_CODE":
          return {
            ...baseOAuth2,
            grantType: {
              kind: "authorization_code",
              authEndpoint: auth.grantTypeInfo.authEndpoint,
              tokenEndpoint: auth.grantTypeInfo.tokenEndpoint,
              clientId: auth.grantTypeInfo.clientID,
              clientSecret: auth.grantTypeInfo.clientSecret,
            },
          }
        case "CLIENT_CREDENTIALS":
          return {
            ...baseOAuth2,
            grantType: {
              kind: "client_credentials",
              tokenEndpoint: auth.grantTypeInfo.authEndpoint,
              clientId: auth.grantTypeInfo.clientID,
              clientSecret: auth.grantTypeInfo.clientSecret,
            },
          }
        case "PASSWORD":
          return {
            ...baseOAuth2,
            grantType: {
              kind: "password",
              tokenEndpoint: auth.grantTypeInfo.authEndpoint,
              username: auth.grantTypeInfo.username,
              password: auth.grantTypeInfo.password,
            },
          }
        case "IMPLICIT":
          return {
            ...baseOAuth2,
            grantType: {
              kind: "implicit",
              authEndpoint: auth.grantTypeInfo.authEndpoint,
              clientId: auth.grantTypeInfo.clientID,
            },
          }
      }
    }

    case "api-key":
      return {
        kind: "apikey",
        key: auth.key,
        value: auth.value,
        in: auth.addTo === "HEADERS" ? "header" : "query",
      }

    case "aws-signature":
      return {
        kind: "aws",
        accessKey: auth.accessKey,
        secretKey: auth.secretKey,
        region: auth.region,
        service: auth.serviceName,
        sessionToken: auth.serviceToken,
        in: auth.addTo === "HEADERS" ? "header" : "query",
      }

    case "digest":
      return {
        kind: "digest",
        username: auth.username,
        password: auth.password,
        realm: auth.realm,
        nonce: auth.nonce,
        algorithm: auth.algorithm === "MD5" ? "MD5" : "SHA-256",
        qop: auth.qop,
        nc: auth.nc,
        cnonce: auth.cnonce,
        opaque: auth.opaque,
      }

    default:
      return { kind: "none" }
  }
}

async function transformContent(
  body: HoppRESTRequest["body"]
): Promise<ContentType | undefined> {
  if (!body || body.contentType === null) return undefined

  switch (body.contentType) {
    case "multipart/form-data": {
      const formData = new Map<string, FormDataValue[]>()

      for (const item of body.body) {
        if (!item.active) continue

        if (item.isFile) {
          for (const file of item.value) {
            if (!file) continue
            const data = new Uint8Array(await file.arrayBuffer())
            formData.set(item.key, [
              {
                kind: "file",
                filename: file instanceof File ? file.name : "unknown",
                contentType:
                  item.contentType ??
                  (file instanceof File
                    ? file.type
                    : "application/octet-stream"),
                data,
              },
            ])
          }
        }
      }

      return content.multipart(formData)
    }

    case "application/octet-stream": {
      if (!body.body) return undefined
      const data = new Uint8Array(await body.body.arrayBuffer())
      return content.binary(data, body.contentType, body.body.name)
    }

    case "application/json":
    case "application/ld+json":
    case "application/hal+json":
    case "application/vnd.api+json":
      try {
        return content.json(JSON.parse(body.body), MediaType.APPLICATION_JSON)
      } catch {
        return content.text(body.body, MediaType.TEXT_PLAIN)
      }

    case "application/xml":
    case "text/xml":
      return content.xml(body.body, MediaType.APPLICATION_XML)

    case "application/x-www-form-urlencoded": {
      const params = new URLSearchParams(body.body)
      const contents: Record<string, string> = {}
      params.forEach((value, key) => {
        contents[key] = value
      })
      return content.urlencoded(contents)
    }

    default:
      return content.text(body.body, MediaType.TEXT_PLAIN)
  }
}
