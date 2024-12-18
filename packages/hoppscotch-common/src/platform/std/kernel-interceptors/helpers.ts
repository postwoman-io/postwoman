import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import * as E from "fp-ts/Either"
import * as R from "fp-ts/Record"
import { cloneDeep } from "lodash-es"
import { useSetting } from "~/composables/settings"
import type { RelayRequest } from "@hoppscotch/kernel"

const isEncoded = (value: string): boolean =>
  pipe(
    E.tryCatch(
      () => value !== decodeURIComponent(value),
      () => false
    ),
    E.getOrElse(() => false)
  )

const encodeParam = (value: string): string =>
  pipe(
    O.some(value),
    O.filter((v) => !isEncoded(v)),
    O.map(encodeURIComponent),
    O.getOrElse(() => value)
  )

const processParams = (
  params: Record<string, string>
): Record<string, string> => {
  const encodeMode = useSetting("ENCODE_MODE").value
  const needsEncoding = (v: string) =>
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(v)

  return pipe(
    params,
    R.map((value) =>
      encodeMode === "enable" || (encodeMode === "auto" && needsEncoding(value))
        ? encodeParam(value)
        : value
    )
  )
}

const updateUrl = (
  url: string,
  params: Record<string, string>
): E.Either<Error, string> =>
  pipe(
    E.tryCatch(
      () => new URL(url),
      (e) => new Error(`Invalid URL: ${e}`)
    ),
    E.map((u) => {
      Object.entries(processParams(params)).forEach(([k, v]) =>
        u.searchParams.append(k, v)
      )
      return decodeURIComponent(u.toString())
    })
  )

export const preProcessRelayRequest = (req: RelayRequest): RelayRequest =>
  pipe(cloneDeep(req), (req) =>
    req.params
      ? pipe(
          updateUrl(req.url, req.params),
          E.map((url) => ({ ...req, url, params: {} })),
          E.getOrElse(() => req)
        )
      : req
  )
