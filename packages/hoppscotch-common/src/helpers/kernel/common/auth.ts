import { HoppRESTRequest, HoppRESTAuthOAuth2 } from "@hoppscotch/data"
import { AuthType } from "@hoppscotch/kernel"

type HoppAuth = HoppRESTRequest["auth"]
type OAuth2GrantType = HoppRESTAuthOAuth2["grantTypeInfo"]

const isBasicAuth = (
  auth: HoppAuth
): auth is HoppAuth & { authType: "basic" } => auth.authType === "basic"

const isBearerAuth = (
  auth: HoppAuth
): auth is HoppAuth & { authType: "bearer" } => auth.authType === "bearer"

const isApiKeyAuth = (
  auth: HoppAuth
): auth is HoppAuth & { authType: "api-key" } => auth.authType === "api-key"

const isAwsAuth = (
  auth: HoppAuth
): auth is HoppAuth & { authType: "aws-signature" } =>
  auth.authType === "aws-signature"

const isDigestAuth = (
  auth: HoppAuth
): auth is HoppAuth & { authType: "digest" } => auth.authType === "digest"

const isOAuth2Auth = (
  auth: HoppAuth
): auth is HoppAuth & { authType: "oauth-2" } => auth.authType === "oauth-2"

const isAuthCodeGrant = (
  grant: OAuth2GrantType
): grant is Extract<OAuth2GrantType, { grantType: "AUTHORIZATION_CODE" }> =>
  grant.grantType === "AUTHORIZATION_CODE"

const isClientCredentialsGrant = (
  grant: OAuth2GrantType
): grant is Extract<OAuth2GrantType, { grantType: "CLIENT_CREDENTIALS" }> =>
  grant.grantType === "CLIENT_CREDENTIALS"

const isPasswordGrant = (
  grant: OAuth2GrantType
): grant is Extract<OAuth2GrantType, { grantType: "PASSWORD" }> =>
  grant.grantType === "PASSWORD"

const isImplicitGrant = (
  grant: OAuth2GrantType
): grant is Extract<OAuth2GrantType, { grantType: "IMPLICIT" }> =>
  grant.grantType === "IMPLICIT"

const processBasic = (auth: HoppAuth & { authType: "basic" }): AuthType => ({
  kind: "basic",
  username: auth.username,
  password: auth.password,
})

const processBearer = (auth: HoppAuth & { authType: "bearer" }): AuthType => ({
  kind: "bearer",
  token: auth.token,
})

const processApiKey = (auth: HoppAuth & { authType: "api-key" }): AuthType => ({
  kind: "apikey",
  key: auth.key,
  value: auth.value,
  in: auth.addTo === "HEADERS" ? "header" : "query",
})

const processAWS = (
  auth: HoppAuth & { authType: "aws-signature" }
): AuthType => ({
  kind: "aws",
  accessKey: auth.accessKey,
  secretKey: auth.secretKey,
  region: auth.region,
  service: auth.serviceName,
  sessionToken: auth.serviceToken,
  in: auth.addTo === "HEADERS" ? "header" : "query",
})

const processDigest = (auth: HoppAuth & { authType: "digest" }): AuthType => ({
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
})

const processOAuth2Grant = (grant: OAuth2GrantType): AuthType["grantType"] => {
  if (isAuthCodeGrant(grant)) {
    return {
      kind: "authorization_code",
      authEndpoint: grant.authEndpoint,
      tokenEndpoint: grant.tokenEndpoint,
      clientId: grant.clientID,
      clientSecret: grant.clientSecret,
    }
  }

  if (isClientCredentialsGrant(grant)) {
    return {
      kind: "client_credentials",
      tokenEndpoint: grant.authEndpoint,
      clientId: grant.clientID,
      clientSecret: grant.clientSecret,
    }
  }

  if (isPasswordGrant(grant)) {
    return {
      kind: "password",
      tokenEndpoint: grant.authEndpoint,
      username: grant.username,
      password: grant.password,
    }
  }

  if (isImplicitGrant(grant)) {
    return {
      kind: "implicit",
      authEndpoint: grant.authEndpoint,
      clientId: grant.clientID,
    }
  }

  throw new Error("Invalid grant type")
}

const processOAuth2 = (auth: HoppAuth & { authType: "oauth-2" }): AuthType => ({
  kind: "oauth2",
  accessToken: auth.grantTypeInfo.token,
  refreshToken:
    "refreshToken" in auth.grantTypeInfo
      ? auth.grantTypeInfo.refreshToken
      : undefined,
  grantType: processOAuth2Grant(auth.grantTypeInfo),
})

const AuthProcessors = {
  basic: {
    process: (auth: HoppAuth): AuthType => {
      if (!isBasicAuth(auth)) throw new Error("Invalid basic auth")
      return processBasic(auth)
    },
  },
  bearer: {
    process: (auth: HoppAuth): AuthType => {
      if (!isBearerAuth(auth)) throw new Error("Invalid bearer auth")
      return processBearer(auth)
    },
  },
  "api-key": {
    process: (auth: HoppAuth): AuthType => {
      if (!isApiKeyAuth(auth)) throw new Error("Invalid API key auth")
      return processApiKey(auth)
    },
  },
  "aws-signature": {
    process: (auth: HoppAuth): AuthType => {
      if (!isAwsAuth(auth)) throw new Error("Invalid AWS auth")
      return processAWS(auth)
    },
  },
  digest: {
    process: (auth: HoppAuth): AuthType => {
      if (!isDigestAuth(auth)) throw new Error("Invalid digest auth")
      return processDigest(auth)
    },
  },
  "oauth-2": {
    process: (auth: HoppAuth): AuthType => {
      if (!isOAuth2Auth(auth)) throw new Error("Invalid OAuth2 auth")
      return processOAuth2(auth)
    },
  },
}

export const transformAuth = async (auth: HoppAuth): Promise<AuthType> => {
  if (
    !auth.authActive ||
    auth.authType === "none" ||
    auth.authType === "inherit"
  ) {
    return { kind: "none" }
  }

  const processor = AuthProcessors[auth.authType]
  return processor ? processor.process(auth) : { kind: "none" }
}
