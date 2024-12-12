import { Observable, BehaviorSubject } from "rxjs"
import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { Response, RelayError } from "@hoppscotch/kernel"
import { HoppRESTResponse } from "./types/HoppRESTResponse"
import { EffectiveHoppRESTRequest } from "./utils/EffectiveURL"
import { getService } from "~/modules/dioc"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import {
  convertEffectiveHoppRESTRequestToRequest,
  convertResponseToHoppRESTResponse,
} from "./kernel"

const logger = {
  debug: (...args: any[]) => console.debug("[REST Network]", ...args),
  error: (...args: any[]) => console.error("[REST Network]", ...args),
}

export type NetworkStrategy = (
  req: EffectiveHoppRESTRequest
) => TE.TaskEither<RelayError, HoppRESTResponse>

export function createRESTNetworkRequestStream(
  request: EffectiveHoppRESTRequest
): [Observable<HoppRESTResponse>, () => void] {
  logger.debug("Creating network request stream", {
    url: request.effectiveFinalURL,
    method: request.method,
  })

  const response = new BehaviorSubject<HoppRESTResponse>({
    type: "loading",
    req: request,
  })

  const startTime = Date.now()
  const service = getService(KernelInterceptorService)

  const makeRequest = async () => {
    try {
      const kernelRequest =
        await convertEffectiveHoppRESTRequestToRequest(request)

      const result = await service.execute(kernelRequest).response
      const endTime = Date.now()

      logger.debug("Request completed", {
        duration: endTime - startTime,
        status: "success",
      })

      return pipe(
        result,
        E.map((kernelResponse: Response) => {
          const { start, end } = kernelResponse.meta.timing
          const { total } = kernelResponse.meta.size

          const response = convertResponseToHoppRESTResponse(
            kernelResponse,
            request,
            {
              responseSize: total,
              responseDuration: end - start,
            }
          )
          logger.debug("Response converted", {
            size: kernelResponse.body?.byteLength ?? 0,
            duration: end - start,
          })
          return response
        }),
        E.mapLeft((error) => {
          logger.error("Request failed", { error })
          return {
            type: "network_fail" as const,
            error,
            req: request,
          }
        })
      )
    } catch (err) {
      throw err
    }
  }

  makeRequest().then((result) => {
    response.next(E.isRight(result) ? result.right : result.left)
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
