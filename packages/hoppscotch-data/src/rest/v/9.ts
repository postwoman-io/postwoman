import { defineVersion } from "verzod"
import { z } from "zod"

import { HoppRESTRequestVariables } from "./2"
import { HoppRESTHeaders, HoppRESTParams } from "./7"
import {
  HoppRESTAuth,
  HoppRESTResponseHeaders,
  V8_SCHEMA,
  ValidCodes,
} from "./8"

export const FormDataKeyValue = z
  .object({
    key: z.string(),
    active: z.boolean(),
    contentType: z.string().optional().catch(undefined),
  })
  .and(
    z.union([
      z.object({
        isFile: z.literal(true),
        value: z.array(z.instanceof(Blob).nullable()),
      }),
      z.object({
        isFile: z.literal(false),
        value: z.string(),
      }),
    ])
  )

export type FormDataKeyValue = z.infer<typeof FormDataKeyValue>

export const HoppRESTReqBody = z.union([
  z.object({
    contentType: z.literal(null),
    body: z.literal(null).catch(null),
  }),
  z.object({
    contentType: z.literal("multipart/form-data"),
    body: z.array(FormDataKeyValue).catch([]),
    showIndividualContentType: z.boolean().optional().catch(false),
  }),
  z.object({
    contentType: z.literal("application/octet-stream"),
    body: z.instanceof(File).nullable().catch(null),
  }),
  z.object({
    contentType: z.union([
      z.literal("application/json"),
      z.literal("application/ld+json"),
      z.literal("application/hal+json"),
      z.literal("application/vnd.api+json"),
      z.literal("application/xml"),
      z.literal("text/xml"),
      z.literal("application/x-www-form-urlencoded"),
      z.literal("binary"),
      z.literal("text/html"),
      z.literal("text/plain"),
    ]),
    body: z.string().catch(""),
  }),
])

export type HoppRESTReqBody = z.infer<typeof HoppRESTReqBody>

/**
 * The original request that was made to get this response
 * Only the necessary fields are saved
 */
export const HoppRESTResponseOriginalRequest = z.object({
  v: z.literal("2"),
  name: z.string(),
  method: z.string(),
  endpoint: z.string(),
  headers: HoppRESTHeaders,
  params: HoppRESTParams,
  body: HoppRESTReqBody,
  auth: HoppRESTAuth,
  requestVariables: HoppRESTRequestVariables,
})

export type HoppRESTResponseOriginalRequest = z.infer<
  typeof HoppRESTResponseOriginalRequest
>

export const HoppRESTRequestResponse = z.object({
  name: z.string(),
  originalRequest: HoppRESTResponseOriginalRequest,
  status: z.string(),
  code: z.optional(ValidCodes),
  headers: HoppRESTResponseHeaders,
  body: z.string(),
})

export type HoppRESTRequestResponse = z.infer<typeof HoppRESTRequestResponse>

/**
 * The responses saved for a request
 * The key is the name of the response saved by the user
 * The value is the response
 */
export const HoppRESTRequestResponses = z.record(
  z.string(),
  HoppRESTRequestResponse
)

export type HoppRESTRequestResponses = z.infer<typeof HoppRESTRequestResponses>

export const V9_SCHEMA = V8_SCHEMA.extend({
  v: z.literal("9"),
  body: HoppRESTReqBody,
  responses: HoppRESTRequestResponses,
})

export default defineVersion({
  schema: V9_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V8_SCHEMA>) {
    // update the version number of response original request
    const responses = Object.fromEntries(
      Object.entries(old.responses).map(([key, response]) => [
        key,
        {
          ...response,
          originalRequest: {
            ...response.originalRequest,
            v: "2" as const,
          },
        },
      ])
    )

    // No migration for body, the new contentType added to each formdata field is optional
    return {
      ...old,
      v: "9" as const,
      responses,
    }
  },
})
