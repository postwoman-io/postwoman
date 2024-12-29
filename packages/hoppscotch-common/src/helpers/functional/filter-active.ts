import { HoppRESTRequestVariables } from "@hoppscotch/data"
import { pipe } from "fp-ts/function"
import * as A from "fp-ts/Array"

export const filterActiveToRecord = (
  headers: HoppRESTRequestVariables
): Record<string, string> =>
  pipe(
    headers,
    A.filter((header) => header.active),
    A.map((header): [string, string] => [header.key, header.value]),
    (entries) => Object.fromEntries(entries)
  )
