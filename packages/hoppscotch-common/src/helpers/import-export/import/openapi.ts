import {
  OpenAPI,
  OpenAPIV2,
  OpenAPIV3,
  OpenAPIV3_1 as OpenAPIV31,
} from "openapi-types"
import SwaggerParser from "@apidevtools/swagger-parser"
import yaml from "js-yaml"
import {
  FormDataKeyValue,
  HoppRESTAuth,
  HoppRESTHeader,
  HoppRESTParam,
  HoppRESTReqBody,
  knownContentTypes,
  makeRESTRequest,
  HoppCollection,
  makeCollection,
  HoppRESTRequestVariable,
  HoppRESTRequest,
  HoppRESTRequestResponses,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import { pipe, flow } from "fp-ts/function"
import * as A from "fp-ts/Array"
import * as S from "fp-ts/string"
import * as O from "fp-ts/Option"
import * as TE from "fp-ts/TaskEither"
import * as RA from "fp-ts/ReadonlyArray"
import { IMPORTER_INVALID_FILE_FORMAT } from "."
import { cloneDeep, isNumber } from "lodash-es"
import { getStatusCodeReasonPhrase } from "~/helpers/utils/statusCodes"

export const OPENAPI_DEREF_ERROR = "openapi/deref_error" as const

// TODO: URL Import Support

const safeParseJSON = (str: string) => O.tryCatch(() => JSON.parse(str))

const safeParseYAML = (str: string) => O.tryCatch(() => yaml.load(str))

const objectHasProperty = <T extends string>(
  obj: unknown,
  propName: T
  // eslint-disable-next-line
): obj is { [propName in T]: unknown } =>
  !!obj &&
  typeof obj === "object" &&
  Object.prototype.hasOwnProperty.call(obj, propName)

type OpenAPIPathInfoType =
  | OpenAPIV2.PathItemObject<Record<string, unknown>>
  | OpenAPIV3.PathItemObject<Record<string, unknown>>
  | OpenAPIV31.PathItemObject<Record<string, unknown>>

type OpenAPIParamsType =
  | OpenAPIV2.ParameterObject
  | OpenAPIV3.ParameterObject
  | OpenAPIV31.ParameterObject

type OpenAPIOperationType =
  | OpenAPIV2.OperationObject
  | OpenAPIV3.OperationObject
  | OpenAPIV31.OperationObject

// Removes the OpenAPI Path Templating to the Hoppscotch Templating (<< ? >>)
const replaceOpenApiPathTemplating = flow(
  S.replace(/{/g, "<<"),
  S.replace(/}/g, ">>")
)

const parseOpenAPIParams = (params: OpenAPIParamsType[]): HoppRESTParam[] =>
  pipe(
    params,

    A.filterMap(
      flow(
        O.fromPredicate((param) => param.in === "query"),
        O.map(
          (param) =>
            <HoppRESTParam>{
              key: param.name,
              value: "", // TODO: Can we do anything more ? (parse default values maybe)
              active: true,
              description: param.description ?? "",
            }
        )
      )
    )
  )

const parseOpenAPIVariables = (
  variables: OpenAPIParamsType[]
): HoppRESTRequestVariable[] =>
  pipe(
    variables,

    A.filterMap(
      flow(
        O.fromPredicate((param) => param.in === "path"),
        O.map(
          (param) =>
            <HoppRESTRequestVariable>{
              key: param.name,
              value: "", // TODO: Can we do anything more ? (parse default values maybe)
              active: true,
            }
        )
      )
    )
  )

const parseOpenAPIV3Responses = (
  op: OpenAPIV3.OperationObject | OpenAPIV31.OperationObject,
  originalRequest: HoppRESTResponseOriginalRequest
): HoppRESTRequestResponses => {
  const responses = op.responses
  if (!responses) return {}

  const res: HoppRESTRequestResponses = {}

  for (const [key, value] of Object.entries(responses)) {
    const response = value as
      | OpenAPIV3.ResponseObject
      | OpenAPIV31.ResponseObject

    // add support for schema key as well
    const contentType = Object.keys(response.content ?? {})[0]
    const body = response.content?.[contentType]

    const name = response.description ?? key

    const code = isNumber(key) ? Number(key) : 200

    const status = getStatusCodeReasonPhrase(code)

    const headers: HoppRESTHeader[] = [
      {
        key: "content-type",
        value: contentType ?? "application/json",
        description: "",
        active: true,
      },
    ]

    res[name] = {
      name,
      status,
      code,
      headers,
      body: JSON.stringify(body ?? ""),
      originalRequest,
    }
  }

  return res
}

const parseOpenAPIV2Responses = (
  op: OpenAPIV2.OperationObject,
  originalRequest: HoppRESTResponseOriginalRequest
): HoppRESTRequestResponses => {
  const responses = op.responses

  if (!responses) return {}

  const res: HoppRESTRequestResponses = {}

  for (const [key, value] of Object.entries(responses)) {
    const response = value as OpenAPIV2.ResponseObject

    // add support for schema key as well
    const contentType = Object.keys(response.examples ?? {})[0]
    const body = response.examples?.[contentType]

    const name = response.description ?? key

    const code = isNumber(Number(key)) ? Number(key) : 200
    const status = getStatusCodeReasonPhrase(code)

    const headers: HoppRESTHeader[] = [
      {
        key: "content-type",
        value: contentType ?? "application/json",
        description: "",
        active: true,
      },
    ]

    res[name] = {
      name,
      status,
      code,
      headers,
      body: body ?? "",
      originalRequest,
    }
  }

  return res
}

const parseOpenAPIResponses = (
  doc: OpenAPI.Document,
  op: OpenAPIOperationType,
  originalRequest: HoppRESTResponseOriginalRequest
): HoppRESTRequestResponses =>
  isOpenAPIV3Operation(doc, op)
    ? parseOpenAPIV3Responses(op, originalRequest)
    : parseOpenAPIV2Responses(op, originalRequest)

const parseOpenAPIHeaders = (params: OpenAPIParamsType[]): HoppRESTHeader[] =>
  pipe(
    params,

    A.filterMap(
      flow(
        O.fromPredicate((param) => param.in === "header"),
        O.map((header) => {
          return <HoppRESTParam>{
            key: header.name,
            value: "", // TODO: Can we do anything more ? (parse default values maybe)
            active: true,
            description: header.description ?? "",
          }
        })
      )
    )
  )

const parseOpenAPIV2Body = (op: OpenAPIV2.OperationObject): HoppRESTReqBody => {
  const obj = (op.consumes ?? [])[0] as string | undefined

  // Not a content-type Hoppscotch supports
  if (!obj || !(obj in knownContentTypes))
    return { contentType: null, body: null }

  // Textual Content Types, so we just parse it and keep
  if (
    obj !== "multipart/form-data" &&
    obj !== "application/x-www-form-urlencoded"
  )
    return { contentType: obj as any, body: "" }

  const formDataValues = pipe(
    (op.parameters ?? []) as OpenAPIV2.Parameter[],

    A.filterMap(
      flow(
        O.fromPredicate((param) => param.in === "body"),
        O.map(
          (param) =>
            <FormDataKeyValue>{
              key: param.name,
              isFile: false,
              value: "",
              active: true,
            }
        )
      )
    )
  )

  return obj === "application/x-www-form-urlencoded"
    ? {
        contentType: obj,
        body: formDataValues.map(({ key }) => `${key}: `).join("\n"),
      }
    : { contentType: obj, body: formDataValues }
}

const parseOpenAPIV3BodyFormData = (
  contentType: "multipart/form-data" | "application/x-www-form-urlencoded",
  mediaObj: OpenAPIV3.MediaTypeObject | OpenAPIV31.MediaTypeObject
): HoppRESTReqBody => {
  const schema = mediaObj.schema as
    | OpenAPIV3.SchemaObject
    | OpenAPIV31.SchemaObject
    | undefined

  if (!schema || schema.type !== "object") {
    return contentType === "application/x-www-form-urlencoded"
      ? { contentType, body: "" }
      : { contentType, body: [] }
  }

  const keys = Object.keys(schema.properties ?? {})

  if (contentType === "application/x-www-form-urlencoded") {
    return {
      contentType,
      body: keys.map((key) => `${key}: `).join("\n"),
    }
  }
  return {
    contentType,
    body: keys.map(
      (key) => <FormDataKeyValue>{ key, value: "", isFile: false, active: true }
    ),
  }
}

const parseOpenAPIV3Body = (
  op: OpenAPIV3.OperationObject | OpenAPIV31.OperationObject
): HoppRESTReqBody => {
  const objs = Object.entries(
    (
      op.requestBody as
        | OpenAPIV3.RequestBodyObject
        | OpenAPIV31.RequestBodyObject
        | undefined
    )?.content ?? {}
  )

  if (objs.length === 0) return { contentType: null, body: null }

  // We only take the first definition
  const [contentType, media]: [
    string,
    OpenAPIV3.MediaTypeObject | OpenAPIV31.MediaTypeObject,
  ] = objs[0]

  return contentType in knownContentTypes
    ? contentType === "multipart/form-data" ||
      contentType === "application/x-www-form-urlencoded"
      ? parseOpenAPIV3BodyFormData(contentType, media)
      : { contentType: contentType as any, body: "" }
    : { contentType: null, body: null }
}

const isOpenAPIV3Operation = (
  doc: OpenAPI.Document,
  op: OpenAPIOperationType
): op is OpenAPIV3.OperationObject | OpenAPIV31.OperationObject =>
  objectHasProperty(doc, "openapi") &&
  typeof doc.openapi === "string" &&
  doc.openapi.startsWith("3.")

const parseOpenAPIBody = (
  doc: OpenAPI.Document,
  op: OpenAPIOperationType
): HoppRESTReqBody =>
  isOpenAPIV3Operation(doc, op)
    ? parseOpenAPIV3Body(op)
    : parseOpenAPIV2Body(op)

const resolveOpenAPIV3SecurityObj = (
  scheme: OpenAPIV3.SecuritySchemeObject | OpenAPIV31.SecuritySchemeObject,
  _schemeData: string[] // Used for OAuth to pass params
): HoppRESTAuth => {
  if (scheme.type === "http") {
    if (scheme.scheme === "basic") {
      // Basic
      return { authType: "basic", authActive: true, username: "", password: "" }
    } else if (scheme.scheme === "bearer") {
      // Bearer
      return { authType: "bearer", authActive: true, token: "" }
    }
    // Unknown/Unsupported Scheme
    return { authType: "none", authActive: true }
  } else if (scheme.type === "apiKey") {
    if (scheme.in === "header") {
      return {
        authType: "api-key",
        authActive: true,
        addTo: "HEADERS",
        key: scheme.name,
        value: "",
      }
    } else if (scheme.in === "query") {
      return {
        authType: "api-key",
        authActive: true,
        addTo: "QUERY_PARAMS",
        key: scheme.in,
        value: "",
      }
    }
  } else if (scheme.type === "oauth2") {
    // NOTE: We select flow on a first come basis on this order, authorizationCode > implicit > password > clientCredentials
    if (scheme.flows.authorizationCode) {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          grantType: "AUTHORIZATION_CODE",
          authEndpoint: scheme.flows.authorizationCode.authorizationUrl ?? "",
          clientID: "",
          scopes: _schemeData.join(" "),
          token: "",
          isPKCE: false,
          tokenEndpoint: scheme.flows.authorizationCode.tokenUrl ?? "",
          clientSecret: "",
        },
        addTo: "HEADERS",
      }
    } else if (scheme.flows.implicit) {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          grantType: "IMPLICIT",
          authEndpoint: scheme.flows.implicit.authorizationUrl ?? "",
          clientID: "",
          token: "",
          scopes: _schemeData.join(" "),
        },
        addTo: "HEADERS",
      }
    } else if (scheme.flows.password) {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          grantType: "PASSWORD",
          clientID: "",
          authEndpoint: scheme.flows.password.tokenUrl,
          clientSecret: "",
          password: "",
          username: "",
          token: "",
          scopes: _schemeData.join(" "),
        },
        addTo: "HEADERS",
      }
    } else if (scheme.flows.clientCredentials) {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          grantType: "CLIENT_CREDENTIALS",
          authEndpoint: scheme.flows.clientCredentials.tokenUrl ?? "",
          clientID: "",
          clientSecret: "",
          scopes: _schemeData.join(" "),
          token: "",
        },
        addTo: "HEADERS",
      }
    }
    return {
      authType: "oauth-2",
      authActive: true,
      grantTypeInfo: {
        grantType: "AUTHORIZATION_CODE",
        authEndpoint: "",
        clientID: "",
        scopes: _schemeData.join(" "),
        token: "",
        isPKCE: false,
        tokenEndpoint: "",
        clientSecret: "",
      },
      addTo: "HEADERS",
    }
  } else if (scheme.type === "openIdConnect") {
    return {
      authType: "oauth-2",
      authActive: true,
      grantTypeInfo: {
        grantType: "AUTHORIZATION_CODE",
        authEndpoint: "",
        clientID: "",
        scopes: _schemeData.join(" "),
        token: "",
        isPKCE: false,
        tokenEndpoint: "",
        clientSecret: "",
      },
      addTo: "HEADERS",
    }
  }

  return { authType: "none", authActive: true }
}

const resolveOpenAPIV3SecurityScheme = (
  doc: OpenAPIV3.Document | OpenAPIV31.Document,
  schemeName: string,
  schemeData: string[]
): HoppRESTAuth => {
  const scheme = doc.components?.securitySchemes?.[schemeName] as
    | OpenAPIV3.SecuritySchemeObject
    | undefined

  if (!scheme) return { authType: "none", authActive: true }
  return resolveOpenAPIV3SecurityObj(scheme, schemeData)
}

const resolveOpenAPIV3Security = (
  doc: OpenAPIV3.Document | OpenAPIV31.Document,
  security:
    | OpenAPIV3.SecurityRequirementObject[]
    | OpenAPIV31.SecurityRequirementObject[]
): HoppRESTAuth => {
  // NOTE: Hoppscotch only considers the first security requirement
  const sec = security[0] as OpenAPIV3.SecurityRequirementObject | undefined

  if (!sec) return { authType: "none", authActive: true }

  // NOTE: We only consider the first security condition within the first condition
  const [schemeName, schemeData] = (Object.entries(sec)[0] ?? [
    undefined,
    undefined,
  ]) as [string | undefined, string[] | undefined]

  if (!schemeName || !schemeData) return { authType: "none", authActive: true }

  return resolveOpenAPIV3SecurityScheme(doc, schemeName, schemeData)
}

const parseOpenAPIV3Auth = (
  doc: OpenAPIV3.Document | OpenAPIV31.Document,
  op: OpenAPIV3.OperationObject | OpenAPIV31.OperationObject
): HoppRESTAuth => {
  const rootAuth = doc.security
    ? resolveOpenAPIV3Security(doc, doc.security)
    : undefined
  const opAuth = op.security
    ? resolveOpenAPIV3Security(doc, op.security)
    : undefined

  return opAuth ?? rootAuth ?? { authType: "none", authActive: true }
}

const resolveOpenAPIV2SecurityScheme = (
  scheme: OpenAPIV2.SecuritySchemeObject,
  _schemeData: string[]
): HoppRESTAuth => {
  if (scheme.type === "basic") {
    return { authType: "basic", authActive: true, username: "", password: "" }
  } else if (scheme.type === "apiKey") {
    // V2 only supports in: header and in: query
    return {
      authType: "api-key",
      addTo: scheme.in === "header" ? "HEADERS" : "QUERY_PARAMS",
      authActive: true,
      key: scheme.name,
      value: "",
    }
  } else if (scheme.type === "oauth2") {
    // NOTE: We select flow on a first come basis on this order, accessCode > implicit > password > application
    if (scheme.flow === "accessCode") {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          authEndpoint: scheme.authorizationUrl ?? "",
          clientID: "",
          clientSecret: "",
          grantType: "AUTHORIZATION_CODE",
          scopes: _schemeData.join(" "),
          token: "",
          isPKCE: false,
          tokenEndpoint: scheme.tokenUrl ?? "",
        },
        addTo: "HEADERS",
      }
    } else if (scheme.flow === "implicit") {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          authEndpoint: scheme.authorizationUrl ?? "",
          clientID: "",
          grantType: "IMPLICIT",
          scopes: _schemeData.join(" "),
          token: "",
        },
        addTo: "HEADERS",
      }
    } else if (scheme.flow === "application") {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          authEndpoint: scheme.tokenUrl ?? "",
          clientID: "",
          clientSecret: "",
          grantType: "CLIENT_CREDENTIALS",
          scopes: _schemeData.join(" "),
          token: "",
        },
        addTo: "HEADERS",
      }
    } else if (scheme.flow === "password") {
      return {
        authType: "oauth-2",
        authActive: true,
        grantTypeInfo: {
          grantType: "PASSWORD",
          authEndpoint: scheme.tokenUrl ?? "",
          clientID: "",
          clientSecret: "",
          password: "",
          scopes: _schemeData.join(" "),
          token: "",
          username: "",
        },
        addTo: "HEADERS",
      }
    }
    return {
      authType: "oauth-2",
      authActive: true,
      grantTypeInfo: {
        authEndpoint: "",
        clientID: "",
        clientSecret: "",
        grantType: "AUTHORIZATION_CODE",
        scopes: _schemeData.join(" "),
        token: "",
        isPKCE: false,
        tokenEndpoint: "",
      },
      addTo: "HEADERS",
    }
  }

  return { authType: "none", authActive: true }
}

const resolveOpenAPIV2SecurityDef = (
  doc: OpenAPIV2.Document,
  schemeName: string,
  schemeData: string[]
): HoppRESTAuth => {
  const scheme = Object.entries(doc.securityDefinitions ?? {}).find(
    ([name]) => schemeName === name
  )

  if (!scheme) return { authType: "none", authActive: true }

  const schemeObj = scheme[1]

  return resolveOpenAPIV2SecurityScheme(schemeObj, schemeData)
}

const resolveOpenAPIV2Security = (
  doc: OpenAPIV2.Document,
  security: OpenAPIV2.SecurityRequirementObject[]
): HoppRESTAuth => {
  // NOTE: Hoppscotch only considers the first security requirement
  const sec = security[0] as OpenAPIV2.SecurityRequirementObject | undefined

  if (!sec) return { authType: "none", authActive: true }

  // NOTE: We only consider the first security condition within the first condition
  const [schemeName, schemeData] = (Object.entries(sec)[0] ?? [
    undefined,
    undefined,
  ]) as [string | undefined, string[] | undefined]

  if (!schemeName || !schemeData) return { authType: "none", authActive: true }

  return resolveOpenAPIV2SecurityDef(doc, schemeName, schemeData)
}

const parseOpenAPIV2Auth = (
  doc: OpenAPIV2.Document,
  op: OpenAPIV2.OperationObject
): HoppRESTAuth => {
  const rootAuth = doc.security
    ? resolveOpenAPIV2Security(doc, doc.security)
    : undefined
  const opAuth = op.security
    ? resolveOpenAPIV2Security(doc, op.security)
    : undefined

  return opAuth ?? rootAuth ?? { authType: "none", authActive: true }
}

const parseOpenAPIAuth = (
  doc: OpenAPI.Document,
  op: OpenAPIOperationType
): HoppRESTAuth =>
  isOpenAPIV3Operation(doc, op)
    ? parseOpenAPIV3Auth(doc as OpenAPIV3.Document | OpenAPIV31.Document, op)
    : parseOpenAPIV2Auth(doc as OpenAPIV2.Document, op)

const parseOpenAPIUrl = (
  doc: OpenAPI.Document | OpenAPIV2.Document | OpenAPIV3.Document
): string => {
  /**
   * OpenAPI V2 has version as a string in the document's swagger property.
   * And host and basePath are in the document's host and basePath properties.
   * Relevant v2 reference: https://swagger.io/specification/v2/#:~:text=to%20be%20obscured.-,Schema,-Swagger%20Object
   **/

  if (objectHasProperty(doc, "swagger")) {
    return `${doc.host}${doc.basePath}`
  }

  /**
   * OpenAPI V3 has version as a string in the document's openapi property.
   * And host and basePath are in the document's servers property.
   * Relevant v3 reference: https://swagger.io/specification/#server-object
   **/
  if (objectHasProperty(doc, "servers")) {
    return doc.servers?.[0].url ?? "<<baseUrl>>"
  }

  // If the document is neither v2 nor v3 then return a env variable as placeholder
  return "<<baseUrl>>"
}

const convertPathToHoppReqs = (
  doc: OpenAPI.Document,
  pathName: string,
  pathObj: OpenAPIPathInfoType
) =>
  pipe(
    ["get", "head", "post", "put", "delete", "options", "patch"] as const,

    // Filter and map out path info
    RA.filterMap(
      flow(
        O.fromPredicate((method) => !!pathObj[method]),
        O.map((method) => ({ method, info: pathObj[method]! }))
      )
    ),

    // Construct request object
    RA.map(({ method, info }) => {
      const openAPIUrl = parseOpenAPIUrl(doc)
      const openAPIPath = replaceOpenApiPathTemplating(pathName)

      const endpoint =
        openAPIUrl.endsWith("/") && openAPIPath.startsWith("/")
          ? openAPIUrl + openAPIPath.slice(1)
          : openAPIUrl + openAPIPath

      const res: {
        request: HoppRESTRequest
        metadata: {
          tags: string[]
        }
      } = {
        request: makeRESTRequest({
          name: info.operationId ?? info.summary ?? "Untitled Request",
          method: method.toUpperCase(),
          endpoint,

          // We don't need to worry about reference types as the Dereferencing pass should remove them
          params: parseOpenAPIParams(
            (info.parameters as OpenAPIParamsType[] | undefined) ?? []
          ),
          headers: parseOpenAPIHeaders(
            (info.parameters as OpenAPIParamsType[] | undefined) ?? []
          ),

          auth: parseOpenAPIAuth(doc, info),

          body: parseOpenAPIBody(doc, info),

          preRequestScript: "",
          testScript: "",

          requestVariables: parseOpenAPIVariables(
            (info.parameters as OpenAPIParamsType[] | undefined) ?? []
          ),

          responses: parseOpenAPIResponses(doc, info, {
            name: info.operationId ?? info.summary ?? "Untitled Request",
            auth: parseOpenAPIAuth(doc, info),
            body: parseOpenAPIBody(doc, info),
            endpoint,
            // We don't need to worry about reference types as the Dereferencing pass should remove them
            params: parseOpenAPIParams(
              (info.parameters as OpenAPIParamsType[] | undefined) ?? []
            ),
            headers: parseOpenAPIHeaders(
              (info.parameters as OpenAPIParamsType[] | undefined) ?? []
            ),
            method: method.toUpperCase(),
            requestVariables: parseOpenAPIVariables(
              (info.parameters as OpenAPIParamsType[] | undefined) ?? []
            ),
            v: "1",
          }),
        }),
        metadata: {
          tags: info.tags ?? [],
        },
      }

      return res
    }),

    // Disable Readonly
    RA.toArray
  )

const convertOpenApiDocsToHopp = (
  docs: OpenAPI.Document[]
): TE.TaskEither<never, HoppCollection[]> => {
  const collections = docs.map((doc) => {
    const name = doc.info.title

    const paths = Object.entries(doc.paths ?? {})
      .map(([pathName, pathObj]) =>
        convertPathToHoppReqs(doc, pathName, pathObj)
      )
      .flat()

    const requestsByTags: Record<string, Array<HoppRESTRequest>> = {}
    const requestsWithoutTags: Array<HoppRESTRequest> = []

    paths.forEach(({ metadata, request }) => {
      const tags = metadata.tags

      if (tags.length === 0) {
        requestsWithoutTags.push(request)
        return
      }

      for (const tag of tags) {
        if (!requestsByTags[tag]) {
          requestsByTags[tag] = []
        }

        requestsByTags[tag].push(cloneDeep(request))
      }
    })

    return makeCollection({
      name,
      folders: Object.entries(requestsByTags).map(([name, paths]) =>
        makeCollection({
          name,
          requests: paths,
          folders: [],
          auth: { authType: "inherit", authActive: true },
          headers: [],
        })
      ),
      requests: requestsWithoutTags,
      auth: { authType: "inherit", authActive: true },
      headers: [],
    })
  })

  return TE.of(collections)
}

const parseOpenAPIDocContent = (str: string) =>
  pipe(
    str,
    safeParseJSON,
    O.match(
      () => safeParseYAML(str),
      (data) => O.of(data)
    )
  )

export const hoppOpenAPIImporter = (fileContents: string[]) =>
  pipe(
    // See if we can parse JSON properly
    fileContents,
    A.traverse(O.Applicative)(parseOpenAPIDocContent),
    TE.fromOption(() => {
      return IMPORTER_INVALID_FILE_FORMAT
    }),
    // Try validating, else the importer is invalid file format
    TE.chainW((docArr) => {
      return pipe(
        TE.tryCatch(
          async () => {
            const resultDoc = []

            for (const docObj of docArr) {
              const validatedDoc = await SwaggerParser.validate(docObj)
              resultDoc.push(validatedDoc)
            }

            return resultDoc
          },
          () => IMPORTER_INVALID_FILE_FORMAT
        )
      )
    }),
    // Deference the references
    TE.chainW((docArr) =>
      pipe(
        TE.tryCatch(
          async () => {
            const resultDoc = []

            for (const docObj of docArr) {
              const validatedDoc = await SwaggerParser.dereference(docObj)
              resultDoc.push(validatedDoc)
            }

            return resultDoc
          },
          () => OPENAPI_DEREF_ERROR
        )
      )
    ),
    TE.chainW(convertOpenApiDocsToHopp)
  )
