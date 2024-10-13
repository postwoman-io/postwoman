import { z } from "zod"
import { defineVersion } from "verzod"

export const V0_SCHEMA = z.array(
  z.union([
    z.object({
      key: z.string(),
      value: z.string(),
      secret: z.literal(false),
    }),
    z.object({
      key: z.string(),
      secret: z.literal(true),
    }),
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ])
)

export default defineVersion({
  initial: true,
  schema: V0_SCHEMA,
})
