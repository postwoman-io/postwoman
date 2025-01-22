export const knownContentTypes = {
  "application/json": "json",
  "application/ld+json": "json",
  "application/hal+json": "json",
  "application/vnd.api+json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/x-www-form-urlencoded": "multipart",
  "multipart/form-data": "multipart",
  "application/octet-stream": "binary",
  "text/html": "html",
  "text/plain": "plain",
}

export type ValidContentTypes = keyof typeof knownContentTypes

export const ValidContentTypesList = Object.keys(
  knownContentTypes
) as ValidContentTypes[]
