/**
 * the direct import from yargs-parser uses fs which is a built in node module,
 * just adding the /browser import as a fix for now, which does not have type info on DefinitelyTyped.
 * remove/update this comment before merging the vue3 port.
 */
import {
  FormDataKeyValue,
  HoppRESTReqBody,
  makeRESTRequest,
} from "@hoppscotch/data"
import * as A from "fp-ts/Array"
import { flow, pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import parser from "yargs-parser/browser"
import { getAuthObject } from "./sub_helpers/auth"
import { getHeaders, recordToHoppHeaders } from "./sub_helpers/headers"
// import { getCookies } from "./sub_helpers/cookies"
import {
  objHasArrayProperty,
  objHasProperty,
} from "~/helpers/functional/object"
import { getDefaultRESTRequest } from "../rest/default"
import { getBody, getFArgumentMultipartData } from "./sub_helpers/body"
import { getMethod } from "./sub_helpers/method"
import { preProcessCurlCommand } from "./sub_helpers/preproc"
import { getQueries } from "./sub_helpers/queries"
import { concatParams, getURLObject } from "./sub_helpers/url"

const defaultRESTReq = getDefaultRESTRequest()

export const parseCurlCommand = (curlCommand: string) => {
  // const isDataBinary = curlCommand.includes(" --data-binary")
  // const compressed = !!parsedArguments.compressed

  curlCommand = preProcessCurlCommand(curlCommand)

  const args: parser.Arguments = parser(curlCommand)

  const parsedArguments = pipe(
    args,
    O.fromPredicate(
      (args) =>
        objHasProperty("dataUrlencode", "string")(args) ||
        objHasProperty("dataUrlencode", "object")(args)
    ),
    O.map((args) => {
      const urlEncodedData: string[] = Array.isArray(args.dataUrlencode)
        ? args.dataUrlencode
        : [args.dataUrlencode]

      const data = A.map(decodeURIComponent)(urlEncodedData)

      return { ...args, d: data }
    }),
    O.getOrElse(() => args)
  )

  const headerObject = getHeaders(parsedArguments)
  const { headers } = headerObject
  let { rawContentType } = headerObject
  const hoppHeaders = pipe(
    headers,
    O.fromPredicate(() => Object.keys(headers).length > 0),
    O.map(recordToHoppHeaders),
    O.getOrElse(() => defaultRESTReq.headers)
  )

  const method = getMethod(parsedArguments)
  // const cookies = getCookies(parsedArguments)
  const urlObject = getURLObject(parsedArguments)
  const auth = getAuthObject(parsedArguments, headers, urlObject)

  let rawData: string | string[] = pipe(
    parsedArguments,
    O.fromPredicate(objHasArrayProperty("d", "string")),
    O.map((args) => args.d),
    O.altW(() =>
      pipe(
        parsedArguments,
        O.fromPredicate(objHasProperty("d", "string")),
        O.map((args) => args.d)
      )
    ),
    O.getOrElseW(() => "")
  )

  let body: HoppRESTReqBody["body"] = ""
  let contentType: HoppRESTReqBody["contentType"] =
    defaultRESTReq.body.contentType
  let hasBodyBeenParsed = false

  let { queries, danglingParams } = getQueries(
    Array.from(urlObject.searchParams.entries())
  )

  const stringToPair = flow(
    decodeURIComponent,
    (pair) => <[string, string]>pair.split("=", 2)
  )
  const pairs = pipe(
    rawData,
    O.fromPredicate(Array.isArray),
    O.map(A.map(stringToPair)),
    O.alt(() =>
      pipe(
        rawData,
        O.fromPredicate((s) => s.length > 0),
        O.map(() => [stringToPair(rawData as string)])
      )
    ),
    O.getOrElseW(() => undefined)
  )

  if (objHasProperty("G", "boolean")(parsedArguments) && !!pairs) {
    const newQueries = getQueries(pairs)
    queries = [...queries, ...newQueries.queries]
    danglingParams = [...danglingParams, ...newQueries.danglingParams]
    hasBodyBeenParsed = true
  } else if (
    rawContentType.includes("application/x-www-form-urlencoded") &&
    !!pairs &&
    Array.isArray(rawData)
  ) {
    body = pairs.map((p) => p.join(": ")).join("\n") || null
    contentType = "application/x-www-form-urlencoded"
    hasBodyBeenParsed = true
  }

  const urlString = decodeURIComponent(concatParams(urlObject, danglingParams))

  let multipartUploads: Record<string, string> = pipe(
    O.of(parsedArguments),
    O.chain(getFArgumentMultipartData),
    O.match(
      () => ({}),
      (args) => {
        hasBodyBeenParsed = true
        rawContentType = "multipart/form-data"
        return args
      }
    )
  )

  if (!hasBodyBeenParsed) {
    if (typeof rawData !== "string") {
      rawData = rawData.join("")
    }
    const bodyObject = getBody(rawData, rawContentType, contentType)

    if (O.isSome(bodyObject)) {
      const bodyObjectValue = bodyObject.value

      if (bodyObjectValue.type === "FORMDATA") {
        multipartUploads = bodyObjectValue.body
      } else {
        body = bodyObjectValue.body.body
        contentType = bodyObjectValue.body
          .contentType as HoppRESTReqBody["contentType"]
      }
    }
  }

  const finalBody: HoppRESTReqBody = pipe(
    body,
    O.fromNullable,
    O.filter((b) => b.length > 0),
    O.map((b) => <HoppRESTReqBody>{ body: b, contentType }),
    O.alt(() =>
      pipe(
        multipartUploads,
        O.of,
        O.map((m) => Object.entries(m)),
        O.filter((m) => m.length > 0),
        O.map(
          flow(
            A.map(
              ([key, value]) =>
                <FormDataKeyValue>{
                  active: true,
                  isFile: false,
                  key,
                  value,
                }
            ),
            (b) =>
              <HoppRESTReqBody>{ body: b, contentType: "multipart/form-data" }
          )
        )
      )
    ),
    O.getOrElse(() => defaultRESTReq.body)
  )

  return makeRESTRequest({
    name: defaultRESTReq.name,
    endpoint: urlString,
    method: (method || defaultRESTReq.method).toUpperCase(),
    params: queries ?? defaultRESTReq.params,
    headers: hoppHeaders,
    preRequestScript: defaultRESTReq.preRequestScript,
    testScript: defaultRESTReq.testScript,
    auth,
    body: finalBody,
    requestVariables: defaultRESTReq.requestVariables,
    responses: {},
  })
}
