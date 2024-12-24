import { Request, Response } from "@hoppscotch/kernel"
import { EffectiveHoppRESTRequest } from "../utils/EffectiveURL"
import { HoppRESTRequest, HoppGQLRequest } from "@hoppscotch/data"
import { HoppRESTResponse } from "../types/HoppRESTResponse"
import { GQLResponseEvent } from "../graphql/connection"
import { logger } from "./logger"
import { RequestBuilder } from "./request"
import { convertArrayToRecord, convertAuth, convertContent } from "./convert"
import { ResponseMetadata } from "./type"
import { ResponseBuilder } from "./response"

export async function convertEffectiveHoppRESTRequestToRequest(
  hopp: EffectiveHoppRESTRequest
): Promise<Request> {
  logger.info("Converting REST request", {
    method: hopp.method,
    url: hopp.effectiveFinalURL,
  })

  try {
    const method = hopp.method.toUpperCase()
    const [headers, params, content] = await Promise.all([
      convertArrayToRecord(hopp.effectiveFinalHeaders),
      convertArrayToRecord(hopp.effectiveFinalParams),
      convertContent(hopp.body, hopp.effectiveFinalBody, method),
    ])

    if (content && ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
      throw new Error(`${method} requests cannot have a body`)
    }

    return new RequestBuilder()
      .setId()
      .setVersion()
      .setMethod(method)
      .setURL(hopp.effectiveFinalURL)
      .setHeaders(headers)
      .setParams(params)
      .setContent(content)
      .setAuth(convertAuth(hopp.auth))
      .build()
  } catch (error) {
    logger.error("Request conversion failed", error)
    throw error
  }
}

export const convertResponseToHoppRESTResponse = (
  response: Response | null | undefined,
  originalRequest: HoppRESTRequest,
  meta: ResponseMetadata
): HoppRESTResponse => {
  logger.info("Converting response", response)

  const builder = new ResponseBuilder(originalRequest, meta)

  if (!response) {
    return builder.buildFailure(new Error("No response received"))
  }

  try {
    return builder.buildFromResponse(response)
  } catch (error) {
    logger.error("Response conversion failed", { error })

    if (error instanceof Error && error.message.includes("Stream")) {
      return builder.buildFailure(
        new Error("Stream responses are not supported")
      )
    }

    return builder.buildFailure(
      error instanceof Error
        ? error
        : new Error("Unknown error during response conversion")
    )
  }
}

export const convertHoppGQLRequestToRequest = async (
  req: HoppGQLRequest
): Promise<Request> => {
  const headers = req.headers.reduce(
    (acc, { key, value }) => ({
      ...acc,
      [key]: [value],
    }),
    {}
  )

  const requestData = {
    query: req.query,
    variables: JSON.parse(req.variables || "{}"),
  }

  return new RequestBuilder()
    .setId()
    .setVersion()
    .setMethod("POST")
    .setURL(req.url)
    .setHeaders({
      ...headers,
      "content-type": ["application/json"],
    })
    .setContent({
      kind: "json",
      mediaType: "application/json",
      content: requestData,
    })
    .setAuth(convertAuth(req.auth))
    .build()
}

export const convertResponseToGQLResponseEvent = (
  response: Response | null,
  timeTaken: number,
  request: HoppGQLRequest,
  operationName?: string,
  operationType?: string
): GQLResponseEvent => {
  if (!response) {
    return {
      type: "error",
      error: {
        type: "NO_RESPONSE",
        message: "No response received",
      },
    }
  }

  try {
    const responseData =
      response.content?.kind === "json"
        ? JSON.stringify(response.content.content)
        : new TextDecoder().decode(response.content?.content as any)

    return {
      type: "response",
      time: timeTaken,
      operationName,
      data: responseData,
      operationType: operationType as any,
    }
  } catch (e) {
    return {
      type: "error",
      error: {
        type: "PARSING_ERROR",
        message: e instanceof Error ? e.message : "Unknown error",
      },
    }
  }
}
