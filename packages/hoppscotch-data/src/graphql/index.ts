import { InferredEntity, createVersionedEntity } from "verzod"
import { z } from "zod"
import V1_VERSION from "./v/1"
import V2_VERSION from "./v/2"
import V3_VERSION from "./v/3"
import V4_VERSION from "./v/4"
import V5_VERSION from "./v/5"
import V6_VERSION from "./v/6"
import V7_VERSION from "./v/7"

export {
  HoppGQLAuthBasic,
  HoppGQLAuthBearer,
  HoppGQLAuthInherit,
  HoppGQLAuthNone,
} from "./v/2"

export { HoppGQLAuthAPIKey } from "./v/4"

export { GQLHeader } from "./v/6"
export { HoppGQLAuth, HoppGQLAuthOAuth2 } from "./v/7"

export const GQL_REQ_SCHEMA_VERSION = 7

const versionedObject = z.object({
  v: z.number(),
})

export const HoppGQLRequest = createVersionedEntity({
  latestVersion: 7,
  versionMap: {
    1: V1_VERSION,
    2: V2_VERSION,
    3: V3_VERSION,
    4: V4_VERSION,
    5: V5_VERSION,
    6: V6_VERSION,
    7: V7_VERSION,
  },
  getVersion(x) {
    const result = versionedObject.safeParse(x)

    return result.success ? result.data.v : null
  },
})

export type HoppGQLRequest = InferredEntity<typeof HoppGQLRequest>

const DEFAULT_QUERY = `
query Request {
  method
  url
  headers {
    key
    value
  }
}`.trim()

export function getDefaultGQLRequest(): HoppGQLRequest {
  return {
    v: GQL_REQ_SCHEMA_VERSION,
    name: "Untitled",
    url: "https://echo.hoppscotch.io/graphql",
    headers: [],
    variables: `
{
  "id": "1"
}`.trim(),
    query: DEFAULT_QUERY,
    auth: {
      authType: "inherit",
      authActive: true,
    },
  }
}

/**
 * @deprecated This function is deprecated. Use `HoppGQLRequest` instead.
 */
export function translateToGQLRequest(x: unknown): HoppGQLRequest {
  const result = HoppGQLRequest.safeParse(x)
  return result.type === "ok" ? result.value : getDefaultGQLRequest()
}

export function makeGQLRequest(x: Omit<HoppGQLRequest, "v">): HoppGQLRequest {
  return {
    v: GQL_REQ_SCHEMA_VERSION,
    ...x,
  }
}
