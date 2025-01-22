import { defineVersion } from "verzod"
import { z } from "zod"
import { HoppRESTAuthAWSSignature } from "./../../rest/v/7"
import {
  HoppGQLAuthBasic,
  HoppGQLAuthBearer,
  HoppGQLAuthInherit,
  HoppGQLAuthNone,
} from "./2"
import { HoppGQLAuthOAuth2, V5_SCHEMA } from "./5"
import { HoppGQLAuthAPIKey } from "./4"

export { HoppRESTAuthOAuth2 as HoppGQLAuthOAuth2 } from "../../rest/v/7"

// Both REST & GQL have the same schema definition for AWS Signature Authorization type
export const HoppGQLAuthAWSSignature = HoppRESTAuthAWSSignature

export type HoppGQLAuthAWSSignature = z.infer<typeof HoppGQLAuthAWSSignature>

export const GQLHeader = z.object({
  key: z.string().catch(""),
  value: z.string().catch(""),
  active: z.boolean().catch(true),
  description: z.string().catch(""),
})

export type GQLHeader = z.infer<typeof GQLHeader>

export const HoppGQLAuth = z
  .discriminatedUnion("authType", [
    HoppGQLAuthNone,
    HoppGQLAuthInherit,
    HoppGQLAuthBasic,
    HoppGQLAuthBearer,
    HoppGQLAuthOAuth2,
    HoppGQLAuthAPIKey,
    HoppGQLAuthAWSSignature,
  ])
  .and(
    z.object({
      authActive: z.boolean(),
    })
  )

export type HoppGQLAuth = z.infer<typeof HoppGQLAuth>

export const V6_SCHEMA = V5_SCHEMA.extend({
  v: z.literal(6),
  auth: HoppGQLAuth,
  headers: z.array(GQLHeader).catch([]),
})

export default defineVersion({
  schema: V6_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V6_SCHEMA>) {
    const headers = old.headers.map((header) => {
      return {
        ...header,
        description: "",
      }
    })

    return {
      ...old,
      v: 6 as const,
      headers,
    }
  },
})
