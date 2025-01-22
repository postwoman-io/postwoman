import { defineVersion, entityReference } from "verzod"
import { z } from "zod"
import { HoppRESTRequest } from "../../rest"
import { HoppGQLRequest } from "../../graphql"

const baseCollectionSchema = z.object({
  v: z.literal(1),
  id: z.optional(z.string()), // For Firestore ID data

  name: z.string(),
  requests: z.array(
    z.lazy(() =>
      z.union([
        entityReference(HoppRESTRequest),
        entityReference(HoppGQLRequest),
      ])
    )
  ),
})

type Input = z.input<typeof baseCollectionSchema> & {
  folders: Input[]
}

type Output = z.output<typeof baseCollectionSchema> & {
  folders: Output[]
}

export const V1_SCHEMA: z.ZodType<Output, z.ZodTypeDef, Input> =
  baseCollectionSchema.extend({
    folders: z.lazy(() => z.array(V1_SCHEMA)),
  })

export default defineVersion({
  initial: true,
  schema: V1_SCHEMA,
})
