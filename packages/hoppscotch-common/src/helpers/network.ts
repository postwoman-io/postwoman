import { Observable, BehaviorSubject } from "rxjs"
import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"

import { RelayResponse, RelayError } from "@hoppscotch/kernel"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { EffectiveHoppRESTRequest } from "~/helpers/utils/EffectiveURL"
import { getService } from "~/modules/dioc"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import {
  transformEffectiveHoppRESTRequestToRequest,
  transformResponseToHoppRESTResponse,
} from "~/helpers/kernel"

export type NetworkStrategy = (
  req: EffectiveHoppRESTRequest
) => TE.TaskEither<RelayError, HoppRESTResponse>

export function createRESTNetworkRequestStream(
  request: EffectiveHoppRESTRequest
): [Observable<HoppRESTResponse>, () => void] {
  const response = new BehaviorSubject<HoppRESTResponse>({
    type: "loading",
    req: request,
  })

  const service = getService(KernelInterceptorService)

  const makeRequest = async () => {
    const relayRequest =
      await transformEffectiveHoppRESTRequestToRequest(request)
    const result = await service.execute(relayRequest).response

    return pipe(
      result,
      E.map(async (kernelResponse: RelayResponse) => {
        const response = await transformResponseToHoppRESTResponse(
          kernelResponse,
          request
        )
        return response
      }),
      E.mapLeft(async (error) => {
        return {
          type: "network_fail" as const,
          error,
          req: request,
        }
      })
    )
  }

  makeRequest().then(async (result) => {
    response.next(await (E.isRight(result) ? result.right : result.left))
    response.complete()
  })

  return [
    response,
    () => {
      const current = service.current.value
      if (current) current.execute(request).cancel()
    },
  ]
}
