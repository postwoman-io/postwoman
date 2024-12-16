import { RelayResponse } from "@hoppscotch/kernel"
import { HoppRESTRequest } from "@hoppscotch/data"
import {
  HoppRESTResponseHeader,
  HoppRESTSuccessResponse,
} from "~/helpers/types/HoppRESTResponse"

export type HoppRESTTransformError = {
  type: "fail"
  error: {
    type: "transform_error"
    message: string
  }
}

const extractTiming = (response: RelayResponse): number =>
  response.meta?.timing
    ? response.meta.timing.end - response.meta.timing.start
    : 0

const extractSize = (response: RelayResponse): number =>
  response.meta?.size?.total ?? 0

export const RESTResponse = {
  async toResponse(
    response: RelayResponse,
    originalRequest: HoppRESTRequest
  ): Promise<HoppRESTSuccessResponse | HoppRESTTransformError> {
    if (!response.body.body || !(response.body.body instanceof Uint8Array)) {
      return {
        type: "fail",
        error: {
          type: "transform_error",
          message: "Invalid response body format",
        },
      }
    }

    return {
      type: "success",
      headers: Object.entries(response.headers ?? {}).map(
        ([key, value]) => ({ key, value }) as HoppRESTResponseHeader
      ),
      body: response.body.body.buffer,
      statusCode: response.status,
      statusText: response.statusText ?? "",
      meta: {
        responseSize: extractSize(response),
        responseDuration: extractTiming(response),
      },
      req: originalRequest,
    }
  },
}
