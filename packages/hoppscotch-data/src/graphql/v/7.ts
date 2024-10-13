import { defineVersion } from "verzod"
import { z } from "zod"

import {
  HoppGQLAuthBasic,
  HoppGQLAuthBearer,
  HoppGQLAuthInherit,
  HoppGQLAuthNone,
} from "./2"
import { HoppGQLAuthAPIKey } from "./4"
import { HoppGQLAuthAWSSignature, V6_SCHEMA } from "./6"
import { HoppRESTAuthOAuth2 } from "./../../rest/v/7"

export { HoppRESTAuthOAuth2 as HoppGQLAuthOAuth2 } from "../../rest/v/7"

export const HoppGQLAuth = z
  .discriminatedUnion("authType", [
    HoppGQLAuthNone,
    HoppGQLAuthInherit,
    HoppGQLAuthBasic,
    HoppGQLAuthBearer,
    HoppRESTAuthOAuth2,
    HoppGQLAuthAPIKey,
    HoppGQLAuthAWSSignature,
  ])
  .and(
    z.object({
      authActive: z.boolean(),
    })
  )

export type HoppGQLAuth = z.infer<typeof HoppGQLAuth>

export const V7_SCHEMA = V6_SCHEMA.extend({
  v: z.literal(7),
  auth: HoppGQLAuth,
})

export default defineVersion({
  schema: V7_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V6_SCHEMA>) {
    return {
      ...old,
      v: 7 as const,
      // no need to update anything for HoppGQLAuth, because we loosened the previous schema by making `clientSecret` optional
    }
  },
})
