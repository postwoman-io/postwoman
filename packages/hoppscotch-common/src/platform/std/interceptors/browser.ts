import * as E from "fp-ts/Either"
import {
  Interceptor,
  InterceptorError,
  NetworkResponse,
} from "~/services/interceptor.service"
import { BrowserInterceptor } from "~/kernel/browser"
import {
  Response,
  InterceptorError as KernelInterceptorError,
} from "@hoppscotch/kernel"
import { AxiosRequestConfig } from "axios"

function toKernelRequest(req: AxiosRequestConfig) {
  return {
    url: req.url ?? "",
    method: req.method?.toUpperCase() ?? "GET",
    headers: req.headers,
    params: req.params,
    content: req.data
      ? {
          kind: "binary",
          content: new Uint8Array(req.data),
          mediaType: req.headers?.["Content-Type"],
        }
      : undefined,
    options: {
      timeout: req.timeout,
      maxRedirects: req.maxRedirects,
    },
  }
}

function toServiceResponse(
  res: E.Either<KernelInterceptorError, Response>
): Promise<E.Either<InterceptorError, NetworkResponse>> {
  return Promise.resolve(
    E.match(
      (error: KernelInterceptorError) => {
        if ("kind" in error && error.kind === "abort") {
          return E.left(<InterceptorError>"cancellation")
        }
        return E.left(<InterceptorError>{
          humanMessage: {
            heading: () => "Request Failed",
            description: () => error.message,
          },
          error,
        })
      },
      (response: Response) =>
        E.right(<NetworkResponse>{
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data:
            response.content.kind === "binary"
              ? response.content.content
              : null,
          config: {
            timeData: {
              startTime: response.meta.timing.start,
              endTime: response.meta.timing.end,
            },
          },
        })
    )(res)
  )
}

export const browserInterceptor: Interceptor = {
  interceptorID: "browser",
  name: (t) => t("state.none"),
  selectable: { type: "selectable" },

  runRequest(req) {
    const kernelReq = toKernelRequest(req)
    const { cancel, response } = BrowserInterceptor.execute(kernelReq)

    return {
      cancel,
      response: response
        .then(toServiceResponse)
        .then((x: NetworkResponse) => x),
    }
  },
}
