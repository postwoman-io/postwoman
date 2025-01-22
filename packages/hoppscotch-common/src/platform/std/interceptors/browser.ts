import * as E from "fp-ts/Either"
import {
  Interceptor,
  InterceptorError,
  NetworkResponse,
  RequestRunResult,
} from "../../../services/interceptor.service"
import axios, { AxiosRequestConfig, CancelToken } from "axios"
import { preProcessRequest } from "./helpers"

async function runRequest(
  req: AxiosRequestConfig,
  cancelToken: CancelToken
): RequestRunResult["response"] {
  const timeStart = Date.now()

  try {
    const res = await axios({
      ...req,
      cancelToken,
      responseType: "arraybuffer",
    })

    const timeEnd = Date.now()

    return E.right(<NetworkResponse>{
      ...res,
      config: {
        timeData: {
          startTime: timeStart,
          endTime: timeEnd,
        },
      },
    })
  } catch (e) {
    const timeEnd = Date.now()

    if (axios.isAxiosError(e) && e.response) {
      return E.right(<NetworkResponse>{
        ...e.response,
        config: {
          timeData: {
            startTime: timeStart,
            endTime: timeEnd,
          },
        },
      })
    } else if (axios.isCancel(e)) {
      return E.left("cancellation")
    }
    return E.left(<InterceptorError>{
      humanMessage: {
        heading: (t) => t("error.network_fail"),
        description: (t) => t("helpers.network_fail"),
      },
      error: e,
    })
  }
}

export const browserInterceptor: Interceptor = {
  interceptorID: "browser",
  name: (t) => t("state.none"),
  selectable: { type: "selectable" },
  runRequest(req) {
    const cancelToken = axios.CancelToken.source()

    const processedReq = preProcessRequest(req)

    const promise = runRequest(processedReq, cancelToken.token)

    return {
      cancel: () => cancelToken.cancel(),
      response: promise,
    }
  },
}
