import * as TE from "fp-ts/TaskEither"
import * as T from "fp-ts/Task"
import * as O from "fp-ts/Option"
import { pipe } from "fp-ts/function"

import { AuthType, MediaType, content } from "@hoppscotch/kernel"
import { HoppGQLRequest } from "@hoppscotch/data"

import { transformAuth } from "~/helpers/kernel/common"
import { filterActiveToRecord } from "~/helpers/functional/filter-active"

const parseVariables = async (variables: string | null): Promise<unknown> => {
  if (!variables) return undefined
  try {
    return JSON.parse(variables)
  } catch {
    throw new Error("Invalid JSON")
  }
}

export const GQLRequest = {
  async toRequest(request: HoppGQLRequest) {
    const headers = {
      ...filterActiveToRecord(request.headers),
      "content-type": "application/json",
    }

    const perhapsAuth: O.Option<AuthType> = await pipe(
      transformAuth(request.auth),
      TE.fold(
        (_error) => T.of(O.none),
        (result) => T.of(result)
      )
    )()

    const auth = pipe(
      perhapsAuth,
      O.fold(
        () => undefined,
        (c) => c
      )
    )

    const variables = await parseVariables(request.variables)

    return {
      id: Date.now(),
      url: request.url,
      method: "POST", // GQL specs
      version: "HTTP/1.1",
      headers,
      auth,
      content: content.json(
        { query: request.query, variables },
        MediaType.APPLICATION_JSON
      ),
    }
  },
}
