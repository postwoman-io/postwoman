import { pipe } from "fp-ts/function"
import * as E from "fp-ts/Either"
import * as O from "fp-ts/Option"

export const decodeToString = (content: Uint8Array): E.Either<Error, string> =>
  E.tryCatch(
    () => new TextDecoder("utf-8").decode(content).replace(/\x00/g, ""),
    E.toError
  )

export const parseJSONAs = <T>(str: string): E.Either<Error, T> =>
  E.tryCatch(() => JSON.parse(str) as T, E.toError)

export const parseBytesTo = <T>(content: Uint8Array): O.Option<T> =>
  pipe(
    content,
    decodeToString,
    E.chain(parseJSONAs<T>),
    E.fold(() => O.none, O.some)
  )
