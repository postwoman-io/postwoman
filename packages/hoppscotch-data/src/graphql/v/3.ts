import { z } from "zod"

import { defineVersion } from "verzod"

import { HoppRESTAuthOAuth2 } from "../../rest/v/3"
import {
  HoppGQLAuthAPIKey,
  HoppGQLAuthBasic,
  HoppGQLAuthBearer,
  HoppGQLAuthInherit,
  HoppGQLAuthNone,
  V2_SCHEMA,
} from "./2"

export { HoppRESTAuthOAuth2 as HoppGQLAuthOAuth2 } from "../../rest/v/3"

export type HoppGqlAuthOAuth2 = z.infer<typeof HoppRESTAuthOAuth2>

export const HoppGQLAuth = z
  .discriminatedUnion("authType", [
    HoppGQLAuthNone,
    HoppGQLAuthInherit,
    HoppGQLAuthBasic,
    HoppGQLAuthBearer,
    HoppGQLAuthAPIKey,
    HoppRESTAuthOAuth2, // both rest and gql have the same auth type for oauth2
  ])
  .and(
    z.object({
      authActive: z.boolean(),
    })
  )

export type HoppGQLAuth = z.infer<typeof HoppGQLAuth>

export const V3_SCHEMA = V2_SCHEMA.extend({
  v: z.literal(3),
  auth: HoppGQLAuth,
})

export default defineVersion({
  initial: false,
  schema: V3_SCHEMA,
  up(old: z.infer<typeof V2_SCHEMA>) {
    if (old.auth.authType === "oauth-2") {
      const { token, accessTokenURL, scope, clientID, authURL } = old.auth

      return {
        ...old,
        v: 3 as const,
        auth: {
          ...old.auth,
          authType: "oauth-2" as const,
          grantTypeInfo: {
            grantType: "AUTHORIZATION_CODE" as const,
            authEndpoint: authURL,
            tokenEndpoint: accessTokenURL,
            clientID: clientID,
            clientSecret: "",
            scopes: scope,
            isPKCE: false,
            token,
          },
          addTo: "HEADERS" as const,
        },
      }
    }

    return {
      ...old,
      v: 3 as const,
      auth: {
        ...old.auth,
      },
    }
  },
})
