import * as RA from "fp-ts/ReadonlyArray"
import * as S from "fp-ts/string"
import { pipe, flow } from "fp-ts/function"
import * as Har from "har-format"
import { HoppRESTRequest } from "@hoppscotch/data"
import { FieldEquals, objectFieldIncludes } from "../typeutils"

// Hoppscotch support HAR Spec 1.2
// For more info on the spec: http://www.softwareishard.com/blog/har-12-spec/

const splitHarQueryParams = (sep: string) => {
  return (s: string): Array<string> => {
    const out = pipe(s, S.split(sep))
    const [key, ...rest] = out
    return [key, rest.join(sep)] // Split by the first colon and join the rest
  }
}

const buildHarHeaders = (req: HoppRESTRequest): Har.Header[] => {
  return req.headers
    .filter((header) => header.active)
    .map((header) => ({
      name: header.key,
      value: header.value,
    }))
}

const buildHarQueryStrings = (req: HoppRESTRequest): Har.QueryString[] => {
  return req.params
    .filter((param) => param.active)
    .map((param) => ({
      name: param.key,
      value: param.value,
    }))
}

const buildHarPostParams = (
  req: HoppRESTRequest &
    FieldEquals<HoppRESTRequest, "method", ["POST", "PUT"]> & {
      body: {
        contentType: "application/x-www-form-urlencoded" | "multipart/form-data"
      }
    }
): Har.Param[] => {
  // URL Encoded strings have a string style of contents
  if (req.body.contentType === "application/x-www-form-urlencoded") {
    return pipe(
      req.body.body,
      S.split("\n"),
      RA.map(
        flow(
          // Define how each lines are parsed

          splitHarQueryParams(":"), // Split by the first ":"
          RA.map(S.trim), // Remove trailing spaces in key/value begins and ends
          ([key, value]) => ({
            // Convert into a proper key value definition
            name: key,
            value: value ?? "", // Value can be undefined (if no ":" is present)
          })
        )
      ),
      RA.toArray
    )
  }
  // FormData has its own format
  return req.body.body.flatMap((entry) => {
    if (entry.isFile) {
      // We support multiple files
      return entry.value.map(
        (file) =>
          <Har.Param>{
            name: entry.key,
            fileName: entry.key, // TODO: Blob doesn't contain file info, anyway to bring file name here ?
            contentType: entry.contentType ? entry.contentType : file?.type,
          }
      )
    }

    if (entry.contentType) {
      return {
        name: entry.key,
        value: entry.value,
        fileName: entry.key,
        contentType: entry.contentType,
      }
    }

    return {
      name: entry.key,
      value: entry.value,
      contentType: entry.contentType,
    }
  })
}

const buildHarPostData = (req: HoppRESTRequest): Har.PostData | undefined => {
  if (!req.body.contentType) return undefined

  if (
    objectFieldIncludes(req.body, "contentType", [
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ] as const)
  ) {
    return {
      mimeType: req.body.contentType, // By default assume JSON ?
      params: buildHarPostParams(req as any),
    }
  }

  return {
    mimeType: req.body.contentType, // Let's assume by default content type is JSON
    text: req.body.body,
  }
}

export const buildHarRequest = (
  req: HoppRESTRequest
): Har.Request & {
  postData: Har.PostData & Exclude<Har.PostData, undefined>
} => {
  return {
    bodySize: -1, // TODO: It would be cool if we can calculate the body size
    headersSize: -1, // TODO: It would be cool if we can calculate the header size
    httpVersion: "HTTP/1.1",
    cookies: [], // Hoppscotch does not have formal support for Cookies as of right now
    headers: buildHarHeaders(req),
    method: req.method,
    queryString: buildHarQueryStrings(req),
    url: req.endpoint,
    postData: buildHarPostData(req) ?? {
      mimeType: "x-unknown",
      params: [],
    },
  }
}
