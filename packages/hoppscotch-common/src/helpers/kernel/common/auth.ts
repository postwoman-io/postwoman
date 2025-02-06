import { HoppRESTRequest, HoppRESTAuthOAuth2 } from "@hoppscotch/data"
import { AuthType } from "@hoppscotch/kernel"
import * as E from "fp-ts/Either"
import * as O from "fp-ts/Option"
import * as TE from "fp-ts/TaskEither"
import { flow, pipe } from "fp-ts/function"

type HoppAuth = HoppRESTRequest["auth"]
type OAuth2GrantType = HoppRESTAuthOAuth2["grantTypeInfo"]
type GrantType = Extract<AuthType, { kind: "oauth2" }>["grantType"]

export const defaultAuth: AuthType = { kind: "none" }

const isAuthActive = (auth: HoppAuth): boolean =>
  auth.authActive && auth.authType !== "none" && auth.authType !== "inherit"

const Guards = {
  basic: flow(
    O.fromPredicate(
      (auth: HoppAuth): auth is HoppAuth & { authType: "basic" } =>
        auth.authType === "basic"
    )
  ),
  bearer: flow(
    O.fromPredicate(
      (auth: HoppAuth): auth is HoppAuth & { authType: "bearer" } =>
        auth.authType === "bearer"
    )
  ),
  apiKey: flow(
    O.fromPredicate(
      (auth: HoppAuth): auth is HoppAuth & { authType: "api-key" } =>
        auth.authType === "api-key"
    )
  ),
  aws: flow(
    O.fromPredicate(
      (auth: HoppAuth): auth is HoppAuth & { authType: "aws-signature" } =>
        auth.authType === "aws-signature"
    )
  ),
  digest: flow(
    O.fromPredicate(
      (auth: HoppAuth): auth is HoppAuth & { authType: "digest" } =>
        auth.authType === "digest"
    )
  ),
  oauth2: flow(
    O.fromPredicate(
      (auth: HoppAuth): auth is HoppAuth & { authType: "oauth-2" } =>
        auth.authType === "oauth-2"
    )
  ),
  grants: {
    authCode: flow(
      O.fromPredicate(
        (
          g: OAuth2GrantType
        ): g is Extract<OAuth2GrantType, { grantType: "AUTHORIZATION_CODE" }> =>
          g.grantType === "AUTHORIZATION_CODE"
      )
    ),
    clientCreds: flow(
      O.fromPredicate(
        (
          g: OAuth2GrantType
        ): g is Extract<OAuth2GrantType, { grantType: "CLIENT_CREDENTIALS" }> =>
          g.grantType === "CLIENT_CREDENTIALS"
      )
    ),
    password: flow(
      O.fromPredicate(
        (
          g: OAuth2GrantType
        ): g is Extract<OAuth2GrantType, { grantType: "PASSWORD" }> =>
          g.grantType === "PASSWORD"
      )
    ),
    implicit: flow(
      O.fromPredicate(
        (
          g: OAuth2GrantType
        ): g is Extract<OAuth2GrantType, { grantType: "IMPLICIT" }> =>
          g.grantType === "IMPLICIT"
      )
    ),
  },
}

type AuthProcessor<T extends HoppAuth = HoppAuth> = (
  auth: T
) => E.Either<Error, AuthType>

const Processors: {
  basic: AuthProcessor
  bearer: AuthProcessor
  apiKey: AuthProcessor
  aws: AuthProcessor
  digest: AuthProcessor
  oauth2: {
    processGrant: (
      grant: OAuth2GrantType
    ) => E.Either<Error, AuthType["grantType"]>
    process: AuthProcessor
  }
} = {
  basic: flow(
    Guards.basic,
    O.map((a) => ({
      kind: "basic" as const,
      username: a.username,
      password: a.password,
    })),
    E.fromOption(() => new Error("Invalid basic auth"))
  ),

  bearer: flow(
    Guards.bearer,
    O.map((a) => ({
      kind: "bearer" as const,
      token: a.token,
    })),
    E.fromOption(() => new Error("Invalid bearer auth"))
  ),

  apiKey: flow(
    Guards.apiKey,
    O.map((a) => ({
      kind: "apikey" as const,
      key: a.key,
      value: a.value,
      in: a.addTo === "HEADERS" ? "header" : "query",
    })),
    E.fromOption(() => new Error("Invalid API key auth"))
  ),

  aws: flow(
    Guards.aws,
    O.map((a) => ({
      kind: "aws" as const,
      accessKey: a.accessKey,
      secretKey: a.secretKey,
      region: a.region,
      service: a.serviceName,
      sessionToken: a.serviceToken,
      in: a.addTo === "HEADERS" ? "header" : "query",
    })),
    E.fromOption(() => new Error("Invalid AWS auth"))
  ),

  digest: flow(
    Guards.digest,
    O.map((a) => ({
      kind: "digest" as const,
      username: a.username,
      password: a.password,
      realm: a.realm,
      nonce: a.nonce,
      algorithm: a.algorithm === "MD5" ? "MD5" : "SHA-256",
      qop: a.qop,
      nc: a.nc,
      cnonce: a.cnonce,
      opaque: a.opaque,
    })),
    E.fromOption(() => new Error("Invalid digest auth"))
  ),

  oauth2: {
    processGrant: (
      grant: OAuth2GrantType
    ): E.Either<Error, AuthType["grantType"]> =>
      pipe(
        grant,
        (g) =>
          pipe(
            O.none as O.Option<GrantType>,
            O.alt(() =>
              pipe(
                Guards.grants.authCode(g),
                O.map(
                  (g): GrantType => ({
                    kind: "authorization_code",
                    authEndpoint: g.authEndpoint,
                    tokenEndpoint: g.tokenEndpoint,
                    clientId: g.clientID,
                    clientSecret: g.clientSecret,
                  })
                )
              )
            ),
            O.alt(() =>
              pipe(
                Guards.grants.clientCreds(g),
                O.map(
                  (g): GrantType => ({
                    kind: "client_credentials",
                    tokenEndpoint: g.authEndpoint,
                    clientId: g.clientID,
                    clientSecret: g.clientSecret,
                  })
                )
              )
            ),
            O.alt(() =>
              pipe(
                Guards.grants.password(g),
                O.map(
                  (g): GrantType => ({
                    kind: "password",
                    tokenEndpoint: g.authEndpoint,
                    username: g.username,
                    password: g.password,
                  })
                )
              )
            ),
            O.alt(() =>
              pipe(
                Guards.grants.implicit(g),
                O.map(
                  (g): GrantType => ({
                    kind: "implicit",
                    authEndpoint: g.authEndpoint,
                    clientId: g.clientID,
                  })
                )
              )
            )
          ),
        E.fromOption(() => new Error("Invalid grant type"))
      ),
    process: flow(
      Guards.oauth2,
      E.fromOption(() => new Error("Invalid OAuth2 auth")),
      E.chain((a) =>
        pipe(
          Processors.oauth2.processGrant(a.grantTypeInfo),
          E.map((grantType) => ({
            kind: "oauth2" as const,
            accessToken: a.grantTypeInfo.token,
            refreshToken:
              "refreshToken" in a.grantTypeInfo
                ? a.grantTypeInfo.refreshToken
                : undefined,
            grantType,
          }))
        )
      )
    ),
  },
}

const getProcessor = (
  auth: HoppAuth
): O.Option<(auth: HoppAuth) => E.Either<Error, AuthType>> =>
  pipe(
    O.fromNullable(auth.authType),
    O.chain((type) => {
      switch (type) {
        case "basic":
          return O.some(Processors.basic)
        case "bearer":
          return O.some(Processors.bearer)
        case "api-key":
          return O.some(Processors.apiKey)
        case "aws-signature":
          return O.some(Processors.aws)
        case "digest":
          return O.some(Processors.digest)
        case "oauth-2":
          return O.some(Processors.oauth2.process)
        default:
          return O.none
      }
    })
  )

export const transformAuth = (auth: HoppAuth): TE.TaskEither<Error, AuthType> =>
  pipe(
    auth,
    O.fromPredicate(isAuthActive),
    O.chain(getProcessor),
    O.map((processor) => processor(auth)),
    O.getOrElse(() => E.right(defaultAuth)),
    TE.fromEither
  )
