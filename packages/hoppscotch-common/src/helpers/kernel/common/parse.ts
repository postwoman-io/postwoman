import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"

import { parseBytesTo } from "~/helpers/functional/parse"
import { MediaType, RelayResponseBody } from "@hoppscotch/kernel"

export const parseBodyAsJSON = <T>(body: RelayResponseBody): O.Option<T> =>
  pipe(
    O.fromNullable(body.mediaType),
    O.filter((type) => type.includes(MediaType.APPLICATION_JSON)),
    O.chain(() => parseBytesTo<T>(body.body))
  )
