import * as E from "fp-ts/Either"

export const decodeToString = (content: Uint8Array): E.Either<Error, string> =>
  E.tryCatch(
    () => new TextDecoder("utf-8").decode(content).replace(/\x00/g, ""),
    E.toError
  )
