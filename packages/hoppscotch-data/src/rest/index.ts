import * as Eq from "fp-ts/Eq";
import * as S from "fp-ts/string";
import cloneDeep from "lodash/cloneDeep";
import { createVersionedEntity, InferredEntity } from "verzod";

import { lodashIsEqualEq, mapThenEq, undefinedEq } from "../utils/eq";
import V0_VERSION from "./v/0";
import V1_VERSION, { HoppRESTAuth, HoppRESTHeaders, HoppRESTParams, HoppRESTReqBody } from "./v/1";

export * from "./content-types"
export {
  FormDataKeyValue,
  HoppRESTReqBodyFormData,
  HoppRESTAuth,
  HoppRESTAuthAPIKey,
  HoppRESTAuthBasic,
  HoppRESTAuthBearer,
  HoppRESTAuthNone,
  HoppRESTAuthOAuth2,
  HoppRESTReqBody
} from "./v/1"

export const HoppRESTRequest = createVersionedEntity({
  latestVersion: 1,
  versionMap: {
    0: V0_VERSION,
    1: V1_VERSION
  },
  getVersion(data) {
    // For V1 onwards we have the v string storing the number
    if (
      typeof data === "object"
      && data !== null
      && "v" in data
      && typeof data.v === "string"
      && !Number.isNaN(parseInt(data.v))
    ) {
      return parseInt(data.v)
    }

    // For V0 we have to check the schema
    const result = V0_VERSION.schema.safeParse(data)

    return result.success ? 0 : null
  },
})

export type HoppRESTRequest = InferredEntity<typeof HoppRESTRequest>

const HoppRESTRequestEq = Eq.struct<HoppRESTRequest>({
  id: undefinedEq(S.Eq),
  v: S.Eq,
  auth: lodashIsEqualEq,
  body: lodashIsEqualEq,
  endpoint: S.Eq,
  headers: mapThenEq(
    (arr) => arr.filter((h) => h.key !== "" && h.value !== ""),
    lodashIsEqualEq
  ),
  params: mapThenEq(
    (arr) => arr.filter((p) => p.key !== "" && p.value !== ""),
    lodashIsEqualEq
  ),
  method: S.Eq,
  name: S.Eq,
  preRequestScript: S.Eq,
  testScript: S.Eq,
})

export const RESTReqSchemaVersion = "1"

export type HoppRESTParam = HoppRESTRequest["params"][number]
export type HoppRESTHeader = HoppRESTRequest["headers"][number]

export const isEqualHoppRESTRequest = HoppRESTRequestEq.equals

/**
 * Safely tries to extract REST Request data from an unknown value.
 * If we fail to detect certain bits, we just resolve it to the default value
 * @param x The value to extract REST Request data from
 * @param defaultReq The default REST Request to source from
 *
 * @deprecated Usage of this function is no longer recommended and is only here
 * for legacy reasons and will be removed
 */
export function safelyExtractRESTRequest(
  x: unknown,
  defaultReq: HoppRESTRequest
): HoppRESTRequest {
  const req = cloneDeep(defaultReq)

  if (!!x && typeof x === "object") {

    if ("id" in x && typeof x.id === "string")
      req.id = x.id

    if ("name" in x && typeof x.name === "string")
      req.name = x.name

    if ("method" in x && typeof x.method === "string")
      req.method = x.method

    if ("endpoint" in x && typeof x.endpoint === "string")
      req.endpoint = x.endpoint

    if ("preRequestScript" in x && typeof x.preRequestScript === "string")
      req.preRequestScript = x.preRequestScript

    if ("testScript" in x && typeof x.testScript === "string")
      req.testScript = x.testScript

    if ("body" in x) {
      const result = HoppRESTReqBody.safeParse(x.body)

      if (result.success) {
        req.body = result.data
      }
    }

    if ("auth" in x) {
      const result = HoppRESTAuth.safeParse(x.auth)

      if (result.success) {
        req.auth = result.data
      }
    }

    if ("params" in x) {
      const result = HoppRESTParams.safeParse(x.params)

      if (result.success) {
        req.params = result.data
      }
    }

    if ("headers" in x) {
      const result = HoppRESTHeaders.safeParse(x.headers)

      if (result.success) {
        req.headers = result.data
      }
    }
  }

  return req
}

export function makeRESTRequest(
  x: Omit<HoppRESTRequest, "v">
): HoppRESTRequest {
  return {
    v: RESTReqSchemaVersion,
    ...x,
  }
}

export function getDefaultRESTRequest(): HoppRESTRequest {
  return {
    v: "1",
    endpoint: "https://echo.hoppscotch.io",
    name: "Untitled",
    params: [],
    headers: [],
    method: "GET",
    auth: {
      authType: "none",
      authActive: true,
    },
    preRequestScript: "",
    testScript: "",
    body: {
      contentType: null,
      body: null,
    }
  }
}


/**
 * Checks if the given value is a HoppRESTRequest
 * @param x The value to check
 *
 * @deprecated This function is no longer recommended and is only here for legacy reasons
 * Use `HoppRESTRequest.is`/`HoppRESTRequest.isLatest` instead.
 */
export function isHoppRESTRequest(x: unknown): x is HoppRESTRequest {
  return HoppRESTRequest.isLatest(x)
}

/**
 * Safely parses a value into a HoppRESTRequest.
 * @param x The value to check
 *
 * @deprecated This function is no longer recommended and is only here for
 * legacy reasons. Use `HoppRESTRequest.safeParse` instead.
 */
export function translateToNewRequest(x: unknown): HoppRESTRequest {
  const result = HoppRESTRequest.safeParse(x)
  return result.type === "ok" ? result.value : getDefaultRESTRequest()
}
