import { createFlowConfig, decodeResponseAsJSON } from "../oauth.service"
import { z } from "zod"
import { getService } from "~/modules/dioc"
import * as E from "fp-ts/Either"
import { useToast } from "~/composables/toast"
import { PasswordGrantTypeParams } from "@hoppscotch/data"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { content } from "@hoppscotch/kernel"

const kernelInterceptor = getService(KernelInterceptorService)

const PasswordFlowParamsSchema = PasswordGrantTypeParams.pick({
  authEndpoint: true,
  clientID: true,
  clientSecret: true,
  scopes: true,
  username: true,
  password: true,
}).refine((params) => {
  return (
    params.authEndpoint.length >= 1 &&
    params.clientID.length >= 1 &&
    params.username.length >= 1 &&
    params.password.length >= 1 &&
    (!params.scopes || params.scopes.length >= 1)
  )
})

export type PasswordFlowParams = z.infer<typeof PasswordFlowParamsSchema>

export const getDefaultPasswordFlowParams = (): PasswordFlowParams => ({
  authEndpoint: "",
  clientID: "",
  clientSecret: "",
  scopes: undefined,
  username: "",
  password: "",
})

const initPasswordOauthFlow = async (params: PasswordFlowParams) => {
  const toast = useToast()

  const requestParams = {
    grant_type: "password",
    client_id: params.clientID,
    username: params.username,
    password: params.password,
    ...(params.clientSecret && { client_secret: params.clientSecret }),
    ...(params.scopes && { scope: params.scopes }),
  }

  const { response } = kernelInterceptor.execute({
    id: Date.now(),
    url: params.authEndpoint,
    method: "POST",
    version: "HTTP/1.1",
    headers: {
      "Content-Type": ["application/x-www-form-urlencoded"],
      Accept: ["application/json"],
    },
    content: content.urlencoded(requestParams),
  })

  const result = await response

  if (E.isLeft(result)) {
    toast.error("AUTH_TOKEN_REQUEST_FAILED")
    return E.left("AUTH_TOKEN_REQUEST_FAILED" as const)
  }

  const jsonResponse = decodeResponseAsJSON(result.right)
  if (E.isLeft(jsonResponse)) return E.left("AUTH_TOKEN_REQUEST_FAILED")

  const withAccessTokenSchema = z.object({
    access_token: z.string(),
  })

  const parsedTokenResponse = withAccessTokenSchema.safeParse(
    jsonResponse.right
  )

  if (!parsedTokenResponse.success) {
    toast.error("AUTH_TOKEN_REQUEST_INVALID_RESPONSE")
  }

  return parsedTokenResponse.success
    ? E.right(parsedTokenResponse.data)
    : E.left("AUTH_TOKEN_REQUEST_INVALID_RESPONSE" as const)
}

export default createFlowConfig(
  "PASSWORD" as const,
  PasswordFlowParamsSchema,
  initPasswordOauthFlow,
  () => Promise.resolve(E.left("NOT_IMPLEMENTED"))
)
