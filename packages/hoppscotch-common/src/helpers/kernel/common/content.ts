import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import * as O from "fp-ts/Option"
import * as A from "fp-ts/Array"
import { pipe } from "fp-ts/function"

import { parseJSONAs } from "~/helpers/functional/json"
import { ContentType, MediaType, content } from "@hoppscotch/kernel"
import { EffectiveHoppRESTRequest } from "~/helpers/utils/EffectiveURL"

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

    process: (formData: FormData): TE.TaskEither<Error, ContentType> =>
      pipe(
        TE.tryCatch(
          async () => {
            const entries = [] as {
              key: string
              file: Blob
              contentType?: string
            }[]
            // @ts-expect-error: `formData.entries` does exist but isn't visible,
            // see `"lib": ["ESNext", "DOM"],` in `tsconfig.json`
            for (const [key, value] of formData.entries()) {
              if (value instanceof Blob) {
                entries.push({
                  key,
                  file: value,
                  contentType: value.type || undefined,
                })
              }
            }
            return entries
          },
          () => new Error("FormData processing failed")
        ),
        TE.chain((entries) =>
          pipe(
            entries,
            A.traverse(TE.ApplicativePar)(Processors.multipart.processFile),
            TE.map(
              A.reduce(
                new Map<string, FormDataValue[]>(),
                (acc, { key, value }) => {
                  acc.set(key, value)
                  return acc
                }
              )
            )
          )
        ),
        TE.map((entries) => content.multipart(entries))
      ),
  },

  binary: {
    process: (file: Blob): TE.TaskEither<Error, ContentType> =>
      pipe(
        TE.tryCatch(
          () => file.arrayBuffer(),
          () => new Error("Binary read failed")
        ),
        TE.map((buffer) =>
          content.binary(
            new Uint8Array(buffer),
            file.type || "application/octet-stream",
            file instanceof File ? file.name : "unknown"
          )
        )
      ),
  },

  urlencoded: {
    process: (body: string): E.Either<Error, ContentType> =>
      pipe(
        E.right(body),
        E.map((contents) => {
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
  request: EffectiveHoppRESTRequest
): TE.TaskEither<Error, O.Option<ContentType>> => {
  const { body, effectiveFinalBody } = request

  if (!body.contentType || !effectiveFinalBody) {
    return TE.right(O.none)
  }

  switch (body.contentType) {
    case "multipart/form-data":
      if (!(effectiveFinalBody instanceof FormData)) {
        return TE.right(O.none)
      }
      return pipe(
        Processors.multipart.process(effectiveFinalBody),
        TE.map(O.some)
      )

    case "application/octet-stream":
      if (!(effectiveFinalBody instanceof Blob)) {
        return TE.right(O.none)
      }
      return pipe(Processors.binary.process(effectiveFinalBody), TE.map(O.some))

    default:
      if (typeof effectiveFinalBody !== "string") {
        return TE.right(O.none)
      }
      return pipe(
        TE.fromEither(getProcessor(body.contentType)(effectiveFinalBody)),
        TE.map(O.some)
      )
  }
}
