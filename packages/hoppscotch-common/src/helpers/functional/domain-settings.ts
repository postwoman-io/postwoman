import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import * as E from "fp-ts/Either"
import { StoreFile, RelayRequest } from "@hoppscotch/kernel"

export type InputDomainSetting = {
  version: "v1"
  security?: {
    certificates?: {
      client?:
        | {
            kind: "pem"
            cert?: StoreFile
            key?: StoreFile
          }
        | {
            kind: "pfx"
            data?: StoreFile
            password?: string
          }
      ca?: StoreFile[]
    }
    validateCertificates?: boolean
    verifyHost?: boolean
    verifyPeer?: boolean
  }
  proxy?: {
    url: string
    auth?: {
      username?: string
      password?: string
    }
    certificates?: {
      ca?: StoreFile[]
      client?:
        | {
            kind: "pem"
            cert?: StoreFile
            key?: StoreFile
          }
        | {
            kind: "pfx"
            data?: StoreFile
            password?: string
          }
    }
  }
}

const convertStoreFile = (file: StoreFile): O.Option<Uint8Array> =>
  file.include === false ? O.none : O.some(file.content)

const convertClientCert = (
  cert?:
    | {
        kind: "pem"
        cert?: StoreFile
        key?: StoreFile
      }
    | {
        kind: "pfx"
        data?: StoreFile
        password?: string
      }
): O.Option<
  NonNullable<
    NonNullable<
      Pick<RelayRequest, "proxy" | "security">["security"]
    >["certificates"]
  >["client"]
> => {
  if (!cert) return O.none

  switch (cert.kind) {
    case "pem": {
      const certContent = pipe(
        O.fromNullable(cert.cert),
        O.chain(convertStoreFile)
      )
      const keyContent = pipe(
        O.fromNullable(cert.key),
        O.chain(convertStoreFile)
      )

      return pipe(
        O.Do,
        O.bind("cert", () => certContent),
        O.bind("key", () => keyContent),
        O.map(({ cert, key }) => ({
          kind: "pem" as const,
          cert,
          key,
        }))
      )
    }
    case "pfx": {
      const dataContent = pipe(
        O.fromNullable(cert.data),
        O.chain(convertStoreFile)
      )

      return pipe(
        O.Do,
        O.bind("data", () => dataContent),
        O.bind("password", () => O.fromNullable(cert.password)),
        O.map(({ data, password }) => ({
          kind: "pfx" as const,
          data,
          password,
        }))
      )
    }
  }
}

const convertCaCerts = (certs?: StoreFile[]): O.Option<Uint8Array[]> =>
  pipe(
    O.fromNullable(certs),
    O.chain((certs: StoreFile[]) => {
      const converted = certs
        .map(convertStoreFile)
        .filter(O.isSome)
        .map((opt) => opt.value)
      return converted.length > 0 ? O.some(converted) : O.none
    })
  )

const convertSecurity = (
  security?: InputDomainSetting["security"]
): O.Option<Pick<RelayRequest, "proxy" | "security">["security"]> =>
  pipe(
    O.fromNullable(security),
    O.chain((security) => {
      return pipe(
        O.fromNullable(security.certificates),
        O.chain((certificates) =>
          pipe(
            O.Do,
            O.bind("client", () => convertClientCert(certificates.client)),
            O.bind("ca", () => convertCaCerts(certificates.ca)),
            O.map((convertedCerts) => ({
              certificates: {
                client: convertedCerts.client,
                ca: convertedCerts.ca,
              },
              validateCertificates: security.validateCertificates,
              verifyHost: security.verifyHost,
              verifyPeer: security.verifyPeer,
            }))
          )
        )
      )
    })
  )

const convertProxy = (
  proxy?: InputDomainSetting["proxy"]
): O.Option<Pick<RelayRequest, "proxy" | "security">["proxy"]> =>
  pipe(
    O.fromNullable(proxy),
    O.chain((proxy) => {
      if (!proxy.url) return O.none

      const auth = proxy.auth && {
        username: proxy.auth.username || "",
        password: proxy.auth.password || "",
      }

      return pipe(
        O.fromNullable(proxy.certificates),
        O.chain((certificates) =>
          pipe(
            O.Do,
            O.bind("client", () => convertClientCert(certificates.client)),
            O.bind("ca", () => convertCaCerts(certificates.ca)),
            O.map((certs) => ({
              client: certs.client,
              ca: certs.ca,
            }))
          )
        ),
        O.fold(
          () =>
            O.some({
              url: proxy.url,
              ...(auth && { auth }),
            }),
          (certificates) =>
            O.some({
              url: proxy.url,
              ...(auth && { auth }),
              certificates,
            })
        )
      )
    })
  )

export const convertDomainSetting = (
  input: InputDomainSetting
): E.Either<Error, Pick<RelayRequest, "proxy" | "security">> => {
  if (input.version !== "v1") {
    return E.left(new Error("Invalid version"))
  }

  const security = convertSecurity(input.security)
  const proxy = convertProxy(input.proxy)

  const result: Pick<RelayRequest, "proxy" | "security"> = {
    proxy: O.isSome(proxy) ? proxy.value : undefined,
    security: O.isSome(security) ? security.value : undefined,
  }

  return E.right(result)
}
