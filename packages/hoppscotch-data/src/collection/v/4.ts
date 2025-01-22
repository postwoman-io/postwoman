import { defineVersion } from "verzod"
import { z } from "zod"

import { HoppGQLAuth } from "../../graphql/v/7"
import { HoppRESTAuth } from "../../rest/v/8"

import { V3_SCHEMA, v3_baseCollectionSchema } from "./3"

export const v4_baseCollectionSchema = v3_baseCollectionSchema.extend({
  v: z.literal(4),
  auth: z.union([HoppRESTAuth, HoppGQLAuth]),
})

type Input = z.input<typeof v4_baseCollectionSchema> & {
  folders: Input[]
}

type Output = z.output<typeof v4_baseCollectionSchema> & {
  folders: Output[]
}

export const V4_SCHEMA: z.ZodType<Output, z.ZodTypeDef, Input> =
  v4_baseCollectionSchema.extend({
    folders: z.lazy(() => z.array(V4_SCHEMA)),
  })

export default defineVersion({
  initial: false,
  schema: V4_SCHEMA,
  // @ts-expect-error
  up(old: z.infer<typeof V3_SCHEMA>) {
    return {
      ...old,
      v: 4 as const,
    }
  },
})
