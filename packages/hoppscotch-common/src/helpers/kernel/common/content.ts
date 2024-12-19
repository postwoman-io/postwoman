import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import * as O from "fp-ts/Option"
import * as A from "fp-ts/Array"
import { pipe } from "fp-ts/function"

import { parseJSONAs } from "~/helpers/functional/parse"
import { HoppRESTReqBody } from "@hoppscotch/data"
import { ContentType, MediaType, content } from "@hoppscotch/kernel"

type FormDataValue = {
  kind: "file"
  filename: string
  contentType: string
  data: Uint8Array
}

const Processors = {
  json: {
    process: (body: string): E.Either<Error, ContentType> =>
      pipe(
        parseJSONAs<unknown>(body),
        E.map((json) => content.json(json, MediaType.APPLICATION_JSON)),
        E.orElse(() => E.right(content.text(body, MediaType.TEXT_PLAIN)))
      ),
  },

  multipart: {
    processFile: (entry: {
      key: string
      file: Blob
      contentType?: string
    }): TE.TaskEither<Error, { key: string; value: FormDataValue[] }> =>
      pipe(
        TE.tryCatch(
          () => entry.file.arrayBuffer(),
          () => new Error("File read failed")
        ),
        TE.map((buffer) => ({
          key: entry.key,
          value: [
            {
              kind: "file",
              filename:
                entry.file instanceof File ? entry.file.name : "unknown",
              contentType:
                entry.contentType ??
                (entry.file instanceof File
                  ? entry.file.type
                  : "application/octet-stream"),
              data: new Uint8Array(buffer),
            },
          ],
        }))
      ),

    process: (
      formData: NonNullable<
        Extract<HoppRESTReqBody, { contentType: "multipart/form-data" }>["body"]
      >
    ): TE.TaskEither<Error, ContentType> =>
      pipe(
        formData,
        A.filter(
          (
            item
          ): item is Extract<(typeof formData)[number], { isFile: true }> =>
            item.active && item.isFile
        ),
        A.chain((item) =>
          pipe(
            item.value,
            A.filterMap(O.fromNullable),
            A.map((file) => ({
              key: item.key,
              file,
              contentType: item.contentType,
            }))
          )
        ),
        A.traverse(TE.ApplicativePar)(Processors.multipart.processFile),
        TE.map(
          A.reduce(
            new Map<string, FormDataValue[]>(),
            (acc, { key, value }) => {
              acc.set(key, value)
              return acc
            }
          )
        ),
        TE.map((entries) => content.multipart(entries))
      ),
  },

  binary: {
    process: (file: File): TE.TaskEither<Error, ContentType> =>
      pipe(
        TE.tryCatch(
          () => file.arrayBuffer(),
          () => new Error("Binary read failed")
        ),
        TE.map((buffer) =>
          content.binary(
            new Uint8Array(buffer),
            "application/octet-stream",
            file.name
          )
        )
      ),
  },

  urlencoded: {
    process: (body: string): E.Either<Error, ContentType> =>
      pipe(
        E.right(new URLSearchParams(body)),
        E.map((params) => {
          const contents: Record<string, string> = {}
          params.forEach((value, key) => {
            contents[key] = value
          })
          return content.urlencoded(contents)
        })
      ),
  },

  xml: {
    process: (body: string): E.Either<Error, ContentType> =>
      E.right(content.xml(body, MediaType.APPLICATION_XML)),
  },

  text: {
    process: (body: string): E.Either<Error, ContentType> =>
      E.right(content.text(body, MediaType.TEXT_PLAIN)),
  },
}

const getProcessor = (contentType: string) => {
  switch (contentType) {
    case "application/json":
    case "application/ld+json":
    case "application/hal+json":
    case "application/vnd.api+json":
      return Processors.json.process
    case "application/xml":
    case "text/xml":
      return Processors.xml.process
    case "application/x-www-form-urlencoded":
      return Processors.urlencoded.process
    case "text/html":
    case "text/plain":
      return Processors.text.process
    default:
      return Processors.text.process
  }
}

export const transformContent = (
  body: HoppRESTReqBody
): TE.TaskEither<Error, O.Option<ContentType>> => {
  if (!body.contentType || !body.body) {
    return TE.right(O.none)
  }

  switch (body.contentType) {
    case "multipart/form-data":
      return pipe(Processors.multipart.process(body.body), TE.map(O.some))

    case "application/octet-stream":
      return pipe(
        O.fromNullable(body.body),
        O.fold(
          () => TE.right(O.none),
          (file) => pipe(Processors.binary.process(file), TE.map(O.some))
        )
      )

    default:
      return pipe(
        TE.fromEither(getProcessor(body.contentType)(body.body)),
        TE.map(O.some)
      )
  }
}
