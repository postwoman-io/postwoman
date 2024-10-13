import { defineVersion } from "verzod"
import { z } from "zod"

import {
  HoppRESTAuthAPIKey,
  HoppRESTAuthBasic,
  HoppRESTAuthBearer,
  HoppRESTAuthInherit,
  HoppRESTAuthNone,
} from "./1"

import {
  ClientCredentialsGrantTypeParams as ClientCredentialsGrantTypeParamsOld,
  ImplicitOauthFlowParams,
  PasswordGrantTypeParams as PasswordGrantTypeParamsOld,
} from "./3"

import {
  AuthCodeGrantTypeParams,
  HoppRESTAuthAWSSignature,
  HoppRESTHeaders,
  HoppRESTParams,
  V7_SCHEMA,
} from "./7"

import { StatusCodes } from "../../utils/statusCodes"
import { HoppRESTReqBody } from "./6"
import { HoppRESTRequestVariables } from "./2"

export const ClientCredentialsGrantTypeParams =
  ClientCredentialsGrantTypeParamsOld.extend({
    clientSecret: z.string().optional(),
  })

export const PasswordGrantTypeParams = PasswordGrantTypeParamsOld.extend({
  clientSecret: z.string().optional(),
})

export const HoppRESTAuthOAuth2 = z.object({
  authType: z.literal("oauth-2"),
  grantTypeInfo: z.discriminatedUnion("grantType", [
    AuthCodeGrantTypeParams,
    ClientCredentialsGrantTypeParams,
    PasswordGrantTypeParams,
    ImplicitOauthFlowParams,
  ]),
  addTo: z.enum(["HEADERS", "QUERY_PARAMS"]).catch("HEADERS"),
})

export type HoppRESTAuthOAuth2 = z.infer<typeof HoppRESTAuthOAuth2>

export const HoppRESTAuth = z
  .discriminatedUnion("authType", [
    HoppRESTAuthNone,
    HoppRESTAuthInherit,
    HoppRESTAuthBasic,
    HoppRESTAuthBearer,
    HoppRESTAuthOAuth2,
    HoppRESTAuthAPIKey,
    HoppRESTAuthAWSSignature,
  ])
  .and(
    z.object({
      authActive: z.boolean(),
    })
  )

export type HoppRESTAuth = z.infer<typeof HoppRESTAuth>

const ValidCodes = z.union(
  Object.keys(StatusCodes).map((code) => z.literal(parseInt(code))) as [
    z.ZodLiteral<number>,
    z.ZodLiteral<number>,
    ...z.ZodLiteral<number>[]
  ]
)

const HoppRESTResponseHeaders = z.array(
  z.object({
    key: z.string(),
    value: z.string(),
  })
)

export type HoppRESTResponseHeader = z.infer<typeof HoppRESTResponseHeaders>

/**
 * The original request that was made to get this response
 * Only the necessary fields are saved
 */
export const HoppRESTResponseOriginalRequest = z.object({
  v: z.literal("1"),
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

export const V8_SCHEMA = V7_SCHEMA.extend({
  v: z.literal("8"),
  auth: HoppRESTAuth,
  responses: HoppRESTRequestResponses,
})

export default defineVersion({
  schema: V8_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V7_SCHEMA>) {
    return {
      ...old,
      v: "8" as const,
      // no need to update anything for HoppRESTAuth, because we loosened the previous schema by making `clientSecret` optional
      responses: {},
    }
  },
})
