import { defineVersion } from "verzod"
import { z } from "zod"

import {
  HoppGQLAuthBasic,
  HoppGQLAuthBearer,
  HoppGQLAuthInherit,
  HoppGQLAuthNone,
} from "./2"
import { HoppGQLAuthAPIKey } from "./4"
import { HoppGQLAuthAWSSignature } from "./6"
import { HoppRESTAuthOAuth2 } from "./../../rest/v/11"
import { V7_SCHEMA } from "./7"

export { HoppRESTAuthOAuth2 as HoppGQLAuthOAuth2 } from "../../rest/v/11"

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

export const V8_SCHEMA = V7_SCHEMA.extend({
  v: z.literal(8),
  auth: HoppGQLAuth,
})

export default defineVersion({
  schema: V8_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V7_SCHEMA>) {
    const auth = old.auth

    return {
      ...old,
      v: 8 as const,
      auth:
        auth.authType === "oauth-2"
          ? {
              ...auth,
              grantTypeInfo:
                auth.grantTypeInfo.grantType === "CLIENT_CREDENTIALS"
                  ? {
                      ...auth.grantTypeInfo,
                      clientAuthentication: "IN_BODY" as const,
                    }
                  : auth.grantTypeInfo,
            }
          : auth,
    }
  },
})
