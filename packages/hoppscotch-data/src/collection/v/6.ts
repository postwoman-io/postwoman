import { defineVersion } from "verzod"
import { z } from "zod"

import { HoppGQLAuth } from "../../graphql/v/8"
import { HoppRESTAuth } from "../../rest/v/11"

import { V5_SCHEMA, v5_baseCollectionSchema } from "./5"

export const v6_baseCollectionSchema = v5_baseCollectionSchema.extend({
  v: z.literal(6),
  auth: z.union([HoppRESTAuth, HoppGQLAuth]),
})

type Input = z.input<typeof v6_baseCollectionSchema> & {
  folders: Input[]
}

type Output = z.output<typeof v6_baseCollectionSchema> & {
  folders: Output[]
}

export const V6_SCHEMA: z.ZodType<Output, z.ZodTypeDef, Input> =
  v6_baseCollectionSchema.extend({
    folders: z.lazy(() => z.array(V6_SCHEMA)),
  })

export default defineVersion({
  initial: false,
  schema: V6_SCHEMA,
  // @ts-expect-error
  up(old: z.infer<typeof V5_SCHEMA>) {
    const auth = old.auth

    const migratedAuth: HoppRESTAuth =
      auth.authType === "oauth-2"
        ? {
            ...auth,
            grantTypeInfo:
              auth.grantTypeInfo.grantType === "CLIENT_CREDENTIALS"
                ? {
                    ...auth.grantTypeInfo,
                    clientAuthentication: "IN_BODY",
                  }
                : auth.grantTypeInfo,
          }
        : auth

    return {
      ...old,
      auth: migratedAuth,
      v: 6 as const,
    }
  },
})
