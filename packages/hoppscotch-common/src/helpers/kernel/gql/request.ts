import { MediaType, content } from "@hoppscotch/kernel"
import { HoppGQLRequest } from "@hoppscotch/data"
import { filterActive, transformAuth } from "~/helpers/kernel/common"

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
      ...filterActive(request.headers),
      "content-type": "application/json",
    }
    const auth = await transformAuth(request.auth)
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
