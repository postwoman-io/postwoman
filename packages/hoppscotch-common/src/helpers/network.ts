import * as TE from "fp-ts/TaskEither"
import { BehaviorSubject, Observable } from "rxjs"
import { cloneDeep } from "lodash-es"
import { HoppRESTResponse } from "./types/HoppRESTResponse"
import { EffectiveHoppRESTRequest } from "./utils/EffectiveURL"
import { getService } from "~/modules/dioc"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { RESTRequest, RESTResponse } from "~/helpers/kernel/rest"
import { RelayError } from "@hoppscotch/kernel"

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

  const req = cloneDeep(request)

  console.info("[helpers/network]: req", req)

  const execResult = RESTRequest.toRequest(req).then((kernelRequest) => {
    console.info("[helpers/network]: kernelRequest", kernelRequest)

    if (!kernelRequest) {
      response.next({
        type: "network_fail",
        req,
        error: new Error("Failed to create kernel request"),
      })
      response.complete()
      return
    }

    return service.execute(kernelRequest)
  })

  const service = getService(KernelInterceptorService)

  execResult.then((result) => {
    if (!result) return

    result.response.then(async (res) => {
      if (res._tag === "Right") {
        const processedRes = await RESTResponse.toResponse(res.right, req)

        if (processedRes.type === "success") {
          response.next(processedRes)
        } else {
          response.next({
            type: "network_fail",
            req,
            error: processedRes.error,
          })
        }
      } else {
        response.next({
          type: "interceptor_error",
          req,
          error: res.left,
        })
      }
      response.complete()
    })
  })

  return [
    response,
    async () => {
      const result = await execResult
      if (result) await result.cancel()
    },
  ]
}
