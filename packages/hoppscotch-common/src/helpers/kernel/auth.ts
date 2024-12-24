import { AuthType } from "@hoppscotch/kernel"
import { DigestAlgorithm } from "./type"

abstract class AuthHandler {
  abstract convert(auth: any): AuthType
}

class BasicAuthHandler extends AuthHandler {
  convert({
    username,
    password,
  }: {
    username: string
    password: string
  }): AuthType {
    return { kind: "basic", username, password }
  }
}

class BearerAuthHandler extends AuthHandler {
  convert({ token }: { token: string }): AuthType {
    return { kind: "bearer", token }
  }
}

class DigestAuthHandler extends AuthHandler {
  convert({
    username,
    password,
    realm,
    nonce,
    qop,
    nc,
    cnonce,
    opaque,
    algorithm,
  }: any): AuthType {
    return {
      kind: "digest",
      username,
      password,
      realm,
      nonce,
      qop,
      nc,
      cnonce,
      opaque,
      algorithm:
        algorithm === "MD5" ? DigestAlgorithm.MD5 : DigestAlgorithm.SHA256,
    }
  }
}

class OAuth2Handler extends AuthHandler {
  convert(auth: any): AuthType {
    const baseOAuth2 = {
      kind: "oauth2" as const,
      accessToken: auth.grantTypeInfo.token,
      grantType: auth.grantTypeInfo,
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
}

class ApiKeyHandler extends AuthHandler {
  convert({ key, value, addTo }: any): AuthType {
    return {
      kind: "apikey",
      key,
      value,
      in: addTo === "HEADERS" ? "header" : "query",
    }
  }
}

class AwsHandler extends AuthHandler {
  convert({
    accessKey,
    secretKey,
    region,
    serviceName,
    addTo,
    serviceToken,
  }: any): AuthType {
    return {
      kind: "aws",
      accessKey,
      secretKey,
      region: region ?? "us-east-1",
      service: serviceName,
      sessionToken: serviceToken,
      in: addTo === "QUERY_PARAMS" ? "query" : "header",
    }
  }
}

export class AuthHandlerFactory {
  getHandler(authType: string): AuthHandler {
    switch (authType) {
      case "basic":
        return new BasicAuthHandler()
      case "bearer":
        return new BearerAuthHandler()
      case "digest":
        return new DigestAuthHandler()
      case "oauth-2":
        return new OAuth2Handler()
      case "api-key":
        return new ApiKeyHandler()
      case "aws-signature":
        return new AwsHandler()
      case "none":
      case "inherit":
        return { convert: () => ({ kind: "none" }) } as AuthHandler
      default:
        throw new Error(`Auth type not supported: ${authType}`)
    }
  }
}
