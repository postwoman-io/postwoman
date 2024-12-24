import { Observable, BehaviorSubject } from "rxjs"
import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { RelayError } from "@hoppscotch/kernel"
import { HoppRESTResponse } from "./types/HoppRESTResponse"
import { EffectiveHoppRESTRequest } from "./utils/EffectiveURL"
import { getService } from "~/modules/dioc"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { convertEffectiveHoppRESTRequestToRequest, convertResponseToHoppRESTResponse } from "./kernel"

const logger = {
    debug: (...args: any[]) => console.debug('[REST Network]', ...args),
    error: (...args: any[]) => console.error('[REST Network]', ...args)
}

export type NetworkStrategy = (
    req: EffectiveHoppRESTRequest
) => TE.TaskEither<RelayError, HoppRESTResponse>

export function createRESTNetworkRequestStream(
    request: EffectiveHoppRESTRequest
): [Observable<HoppRESTResponse>, () => void] {
    logger.debug('Creating network request stream', {
        url: request.effectiveFinalURL,
        method: request.method
    })

    const response = new BehaviorSubject<HoppRESTResponse>({
        type: "loading",
        req: request,
    })

    const startTime = Date.now()
    const service = getService(KernelInterceptorService)

    const makeRequest = async () => {
        try {
            logger.debug('Converting request to kernel format', request)
            const kernelRequest = await convertEffectiveHoppRESTRequestToRequest(request)
            logger.debug('Converted request to kernel format', kernelRequest)

            logger.debug('Executing kernel request')
            const result = await service.execute(kernelRequest).response
            logger.debug('Got response', result)
            const endTime = Date.now()

            logger.debug('Request completed', {
                duration: endTime - startTime,
                status: 'success'
            })

            return pipe(
                result,
                E.map((kernelResponse) => {
                    const response = convertResponseToHoppRESTResponse(kernelResponse, request, {
                        responseSize: kernelResponse.body?.byteLength ?? 0,
                        responseDuration: endTime - startTime,
                    })
                    logger.debug('Response converted', {
                        size: kernelResponse.body?.byteLength ?? 0,
                        duration: endTime - startTime
                    })
                    return response
                }),
                E.mapLeft((error) => {
                    logger.error('Request failed', { error })
                    return {
                        type: "network_fail" as const,
                        error,
                        req: request,
                    }
                })
            )
        } catch (err) {
            logger.error('Unexpected error during request', { error: err })
            throw err
        }
    }

    makeRequest().then((result) => {
        logger.debug('Emitting final response')
        response.next(E.isRight(result) ? result.right : result.left)
        response.complete()
    })

    return [
        response,
        () => {
            logger.debug('Cancelling request')
            const current = service.current.value
            if (current) current.execute(request).cancel()
        },
    ]
}
