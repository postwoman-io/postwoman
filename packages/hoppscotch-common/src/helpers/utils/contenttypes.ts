import { ValidContentTypes } from "@hoppscotch/data"

export type Content = "json" | "xml" | "multipart" | "html" | "plain" | "binary"

export const knownContentTypes: Record<ValidContentTypes, Content> = {
  "application/json": "json",
  "application/ld+json": "json",
  "application/hal+json": "json",
  "application/vnd.api+json": "json",
  "application/xml": "xml",
  "application/x-www-form-urlencoded": "multipart",
  "multipart/form-data": "multipart",
  "application/octet-stream": "binary",
  "text/html": "html",
  "text/plain": "plain",
  "text/xml": "xml",
}

type ContentTypeTitle =
  | "request.content_type_titles.text"
  | "request.content_type_titles.structured"
  | "request.content_type_titles.others"
  | "request.content_type_titles.binary"

type SegmentedContentType = {
  title: ContentTypeTitle
  contentTypes: ValidContentTypes[]
}

export const segmentedContentTypes: SegmentedContentType[] = [
  {
    title: "request.content_type_titles.text",
    contentTypes: [
      "application/json",
      "application/ld+json",
      "application/hal+json",
      "application/vnd.api+json",
      "application/xml",
      "text/xml",
    ],
  },
  {
    title: "request.content_type_titles.structured",
    contentTypes: ["application/x-www-form-urlencoded", "multipart/form-data"],
  },
  {
    title: "request.content_type_titles.binary",
    contentTypes: ["application/octet-stream"],
  },
  {
    title: "request.content_type_titles.others",
    contentTypes: ["text/html", "text/plain"],
  },
]

export function isJSONContentType(contentType: string) {
  return /\bjson\b/i.test(contentType)
}
