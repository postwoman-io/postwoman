import { HoppRESTRequest } from "@hoppscotch/data"
import { RelayResponse, RelayResponseBody } from "@hoppscotch/kernel"

import {
  HoppRESTResponse,
  HoppRESTResponseHeader,
} from "~/helpers/types/HoppRESTResponse"
import { GQLResponseEvent, RunQueryOptions } from "~/helpers/graphql/connection"
import { OperationType } from "@urql/core"

export async function transformResponseToHoppRESTResponse(
  response: RelayResponse,
  originalRequest: HoppRESTRequest
): Promise<HoppRESTResponse> {
  if (!response) {
    return {
      type: "network_fail",
      error: new Error("No response received"),
      req: originalRequest,
    }
  }

  const headers: HoppRESTResponseHeader[] = Object.entries(
    response.headers
  ).map(([key, value]) => ({ key, value }) as HoppRESTResponseHeader)

  const responseSize = response.meta.size.total
  const statusCode = response.status
  const statusText = response.statusText
  const responseDuration = response.meta.timing.end - response.meta.timing.start

  const body = await transformResponseBody(response.body)

  return {
    type: statusCode >= 200 && statusCode < 300 ? "success" : "fail",
    headers,
    body,
    statusCode,
    statusText,
    meta: {
      responseSize,
      responseDuration,
    },
    req: originalRequest,
  }
}

export async function transformResponseToGQLResponseEvent(
  response: RelayResponse,
  options: RunQueryOptions
): Promise<GQLResponseEvent> {
  try {
    if (!response || response.status >= 400) {
      return {
        type: "error",
        error: {
          type: "network_error",
          message: response?.statusText || "Network error occurred",
        },
      }
    }

    const bodyText = new TextDecoder().decode(response.body.body as Uint8Array)
    const data = JSON.stringify(JSON.parse(bodyText), null, 2)

    const operationType = determineOperationType(options.query)
    const operationName = options.operationName

    return {
      type: "response",
      time: response.meta.timing.end - response.meta.timing.start,
      operationName,
      operationType,
      data,
      rawQuery: options,
    }
  } catch (err) {
    return {
      type: "error",
      error: {
        type: "parse_error",
        message:
          err instanceof Error ? err.message : "Failed to parse response",
      },
    }
  }
}

async function transformResponseBody(
  responseBody: RelayResponseBody
): Promise<ArrayBuffer> {
  // NOTE: This'll be hit 90% of the time as designed by the kernel,
  // rest of the branch exist because `axios` sometimes likes to pull a fast one.
  if (responseBody.body instanceof Uint8Array) {
    return responseBody.body.buffer
  }

  // NOTE: This'll also be hit 90% if the response is from `native` kernel.
  if (Array.isArray(responseBody.body)) {
    // NOTE: Here we could've done something like `return new ArrayBuffer(responseBody.body)`
    // since we know it's `[u8]` type from Rust but explicit casting
    // is generally better even if it's an inefficient cast.
    // Plus there's a chance we get an `Array` from `Axios`.
    return new Uint8Array(responseBody.body).buffer
  }

  if (typeof responseBody.body === "string") {
    return new TextEncoder().encode(responseBody.body).buffer
  }

  // NOTE: HIGHLY EXPERIMENTAL!
  if (responseBody.body instanceof ReadableStream) {
    const reader = responseBody.body.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result.buffer
  }

  // Fallback for other types - convert to string then to ArrayBuffer
  // Yes, very inefficient...
  return new TextEncoder().encode(JSON.stringify(responseBody.body)).buffer
}

function determineOperationType(query: string): OperationType {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.startsWith("query")) return "query"
  if (trimmed.startsWith("mutation")) return "mutation"
  if (trimmed.startsWith("subscription")) return "subscription"
  return "query" // Default to query if not specified, simpler.
}
