import { InferredEntity, createVersionedEntity } from "verzod"

import { z } from "zod"

import V0_VERSION from "./v/0"
import V1_VERSION from "./v/1"

const versionedObject = z.object({
  v: z.number(),
})

export const GlobalEnvironment = createVersionedEntity({
  latestVersion: 1,
  versionMap: {
    0: V0_VERSION,
    1: V1_VERSION,
  },
  getVersion(data) {
    const versionCheck = versionedObject.safeParse(data)

    if (versionCheck.success) return versionCheck.data.v

    // For V0 we have to check the schema
    const result = V0_VERSION.schema.safeParse(data)
    return result.success ? 0 : null
  },
})

export type GlobalEnvironment = InferredEntity<typeof GlobalEnvironment>

export type GlobalEnvironmentVariable = InferredEntity<
  typeof GlobalEnvironment
>["variables"][number]
