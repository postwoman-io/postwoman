import { InferredEntity, createVersionedEntity } from "verzod"

import V1_VERSION from "./v/1"
import V2_VERSION from "./v/2"
import V3_VERSION from "./v/3"
import V4_VERSION from "./v/4"

import { z } from "zod"
import { translateToNewRequest } from "../rest"
import { translateToGQLRequest } from "../graphql"

const versionedObject = z.object({
  v: z.number(),
})

export const HoppCollection = createVersionedEntity({
  latestVersion: 4,
  versionMap: {
    1: V1_VERSION,
    2: V2_VERSION,
    3: V3_VERSION,
    4: V4_VERSION,
  },
  getVersion(data) {
    const versionCheck = versionedObject.safeParse(data)

    if (versionCheck.success) return versionCheck.data.v

    // For V1 we have to check the schema
    const result = V1_VERSION.schema.safeParse(data)

    return result.success ? 1 : null
  },
})

export type HoppCollection = InferredEntity<typeof HoppCollection>

export const CollectionSchemaVersion = 4

/**
 * Generates a Collection object. This ignores the version number object
 * @param x The Collection Data
 * @returns The final collection
 */
export function makeCollection(x: Omit<HoppCollection, "v">): HoppCollection {
  return {
    v: CollectionSchemaVersion,
    ...x,
  }
}

/**
 * Translates an old collection to a new collection
 * @param x The collection object to load
 * @returns The proper new collection format
 */
export function translateToNewRESTCollection(x: any): HoppCollection {
  // Legacy
  const name = x.name ?? "Untitled"
  const folders = (x.folders ?? []).map(translateToNewRESTCollection)
  const requests = (x.requests ?? []).map(translateToNewRequest)

  const auth = x.auth ?? { authType: "inherit", authActive: true }
  const headers = x.headers ?? []

  const obj = makeCollection({
    name,
    folders,
    requests,
    auth,
    headers,
  })

  if (x.id) obj.id = x.id

  return obj
}

/**
 * Translates an old collection to a new collection
 * @param x The collection object to load
 * @returns The proper new collection format
 */
export function translateToNewGQLCollection(x: any): HoppCollection {
  // Legacy
  const name = x.name ?? "Untitled"
  const folders = (x.folders ?? []).map(translateToNewGQLCollection)
  const requests = (x.requests ?? []).map(translateToGQLRequest)

  const auth = x.auth ?? { authType: "inherit", authActive: true }
  const headers = x.headers ?? []

  const obj = makeCollection({
    name,
    folders,
    requests,
    auth,
    headers,
  })

  if (x.id) obj.id = x.id

  return obj
}
