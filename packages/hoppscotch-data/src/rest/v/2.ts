import { defineVersion } from "verzod"
import { z } from "zod"
import { V1_SCHEMA } from "./1"

export const HoppRESTRequestVariables = z.array(
  z.object({
    key: z.string().catch(""),
    value: z.string().catch(""),
    active: z.boolean().catch(true),
  })
)

export type HoppRESTRequestVariables = z.infer<typeof HoppRESTRequestVariables>

export const V2_SCHEMA = V1_SCHEMA.extend({
  v: z.literal("2"),
  requestVariables: HoppRESTRequestVariables,
})

export default defineVersion({
  initial: false,
  schema: V2_SCHEMA,
  up(old: z.infer<typeof V1_SCHEMA>) {
    return {
      ...old,
      v: "2",
      requestVariables: [],
    } as z.infer<typeof V2_SCHEMA>
  },
})
