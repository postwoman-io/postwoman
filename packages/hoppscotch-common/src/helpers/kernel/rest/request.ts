import * as TE from "fp-ts/TaskEither"
import * as T from "fp-ts/Task"
import * as O from "fp-ts/Option"
import { pipe } from "fp-ts/function"

import { Method, RelayRequest, ContentType, AuthType } from "@hoppscotch/kernel"
import { EffectiveHoppRESTRequest } from "~/helpers/utils/EffectiveURL"

import { transformAuth, transformContent } from "~/helpers/kernel/common"
import { defaultAuth } from "~/helpers/kernel/common/auth"
import { filterActiveToRecord } from "~/helpers/functional/filter-active"

export const RESTRequest = {
  async toRequest(request: EffectiveHoppRESTRequest): Promise<RelayRequest> {
    const auth = await pipe(
      transformAuth(request.auth),
      TE.getOrElse(() => T.of<AuthType>(defaultAuth))
    )()

    const content = await pipe(
      transformContent(request),
      TE.getOrElse(() => T.of<O.Option<ContentType>>(O.none)),
      T.map(O.toUndefined)
    )()

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
