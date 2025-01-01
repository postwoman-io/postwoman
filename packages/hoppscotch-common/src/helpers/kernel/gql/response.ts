import * as O from "fp-ts/Option"
import { pipe } from "fp-ts/function"
import { RelayResponse } from "@hoppscotch/kernel"
import { RunQueryOptions } from "~/helpers/graphql/connection"
import { OperationType } from "@urql/core"
import { parseBodyAsJSON } from "~/helpers/functional/json"

export type HoppGQLSuccessResponse = {
  type: "response"
  time: number
  operationName: string | undefined
  operationType: OperationType
  data: string
  rawQuery?: RunQueryOptions
}

export type GQLTransformError = {
  type: "error"
  error: {
    type: "transform_error"
    message: string
  }
}

type GQLParsedResponse = {
  data?: unknown
  errors?: Array<{ message: string }>
}

const determineOperationType = (query: string): OperationType => {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.startsWith("mutation")) return "mutation"
  if (trimmed.startsWith("subscription")) return "subscription"
  return "query"
}

const createTransformError = (message: string): GQLTransformError => ({
  type: "error",
  error: {
    type: "transform_error" as const,
    message,
  },
})

const validateResponse = (data: unknown): GQLParsedResponse | null => {
  if (typeof data !== "object" || data === null) return null

  const hasValidData = "data" in data && data.data !== undefined
  const hasValidErrors =
    "errors" in data &&
    Array.isArray(data.errors) &&
    data.errors.every(
      (e) => typeof e === "object" && e !== null && "message" in e
    )

  return hasValidData || hasValidErrors ? (data as GQLParsedResponse) : null
}

export const GQLResponse = {
  async toResponse(
    response: RelayResponse,
    options: RunQueryOptions
  ): Promise<HoppGQLSuccessResponse | GQLTransformError> {
    const parsedJSON = pipe(
      response.body,
      parseBodyAsJSON<unknown>,
      O.fold(
        () => createTransformError("Invalid JSON response"),
        (json) => {
          const validBody = validateResponse(json)
          return validBody
            ? {
                type: "response" as const,
                time: response.meta?.timing
                  ? response.meta.timing.end - response.meta.timing.start
                  : 0,
                operationName: options.operationName,
                operationType: determineOperationType(options.query),
                data: JSON.stringify(validBody, null, 2),
                rawQuery: options,
              }
            : createTransformError("Invalid GraphQL response structure")
        }
      )
    )

    return parsedJSON
  },
}
