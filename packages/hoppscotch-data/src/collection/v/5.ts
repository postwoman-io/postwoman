import { defineVersion } from "verzod"
import { z } from "zod"

import { V4_SCHEMA, v4_baseCollectionSchema } from "./4"
import { generateUniqueRefId } from "../../utils/collection"

export const v5_baseCollectionSchema = v4_baseCollectionSchema.extend({
  v: z.literal(5),
  _ref_id: z.string().optional(),
})

type Input = z.input<typeof v5_baseCollectionSchema> & {
  folders: Input[]
}

type Output = z.output<typeof v5_baseCollectionSchema> & {
  folders: Output[]
}

export const V5_SCHEMA: z.ZodType<Output, z.ZodTypeDef, Input> =
  v5_baseCollectionSchema.extend({
    folders: z.lazy(() => z.array(V5_SCHEMA)),
  })

export default defineVersion({
  initial: false,
  schema: V5_SCHEMA,
  // @ts-expect-error
  up(old: z.infer<typeof V4_SCHEMA>) {
    return {
      ...old,
      v: 5 as const,
      _ref_id: generateUniqueRefId("coll"),
    }
  },
})
