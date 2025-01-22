import { z } from "zod"
import { defineVersion } from "verzod"
import { V0_SCHEMA } from "./0"

export const V1_SCHEMA = z.object({
  v: z.literal(1),
  variables: z.array(
    z.union([
      z.object({
        key: z.string(),
        secret: z.literal(true),
      }),
      z.object({
        key: z.string(),
        value: z.string(),
        secret: z.literal(false),
      }),
    ])
  ),
})

export default defineVersion({
  initial: false,
  schema: V1_SCHEMA,
  up(old: z.infer<typeof V0_SCHEMA>) {
    const variables = old.map((variable) => {
      if ("value" in variable) {
        return {
          key: variable.key,
          value: variable.value,
          secret: false,
        }
      }

      return {
        key: variable.key,
        secret: true,
      }
    })

    return <z.infer<typeof V1_SCHEMA>>{
      v: 1,
      variables,
    }
  },
})
