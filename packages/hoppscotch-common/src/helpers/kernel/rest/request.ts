import * as TE from "fp-ts/TaskEither"
import * as T from "fp-ts/Task"
import * as O from "fp-ts/Option"
import { pipe } from "fp-ts/function"

import { Method, RelayRequest, ContentType, AuthType } from "@hoppscotch/kernel"
import { EffectiveHoppRESTRequest } from "~/helpers/utils/EffectiveURL"

import { transformAuth, transformContent } from "~/helpers/kernel/common"
import { filterActiveToRecord } from "~/helpers/functional/filter-active"

export const RESTRequest = {
  async toRequest(request: EffectiveHoppRESTRequest): Promise<RelayRequest> {
    const perhapsAuth: O.Option<AuthType> = await pipe(
      transformAuth(request.auth),
      TE.fold(
        (_error) => T.of(O.none),
        (result) => T.of(result)
      )
    )()

    const auth = pipe(
      perhapsAuth,
      O.fold(
        () => undefined,
        (c) => c
      )
    )

    const perhapsContent: O.Option<ContentType> = await pipe(
      transformContent(request.body),
      TE.fold(
        (_error) => T.of(O.none),
        (result) => T.of(result)
      )
    )()

    const content = pipe(
      perhapsContent,
      O.fold(
        () => undefined,
        (c) => c
      )
    )

    const headers = filterActiveToRecord(request.effectiveFinalHeaders)
    const params = filterActiveToRecord(request.effectiveFinalParams)

    return {
      id: Date.now(),
      url: request.effectiveFinalURL,
      method: request.method.toUpperCase() as Method,
      version: "HTTP/1.1",
      headers,
      params,
      auth,
      content,
    }
  },
}
