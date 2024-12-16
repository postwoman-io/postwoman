import { HoppRESTRequest } from "@hoppscotch/data"
import { ContentType, MediaType, content } from "@hoppscotch/kernel"
import { FormDataKeyValue } from "@hoppscotch/data"

type FileEntry = {
  key: string
  file: Blob
  contentType?: string
}

const processJSON = async (body: string): Promise<ContentType> => {
  try {
    const json = JSON.parse(body)
    return content.json(json, MediaType.APPLICATION_JSON)
  } catch {
    return content.text(body, MediaType.TEXT_PLAIN)
  }
}

const processMultipart = async (
  formData: FormDataKeyValue[]
): Promise<ContentType> => {
  const fileEntries: FileEntry[] = formData
    .filter(
      (item): item is FormDataKeyValue & { isFile: true } =>
        item.active && item.isFile
    )
    .flatMap((item) =>
      item.value
        .filter((blob): blob is Blob => blob !== null)
        .map((file) => ({ key: item.key, file, contentType: item.contentType }))
    )

  const entries = await Promise.all(
    fileEntries.map(async ({ key, file, contentType }) => {
      try {
        const buffer = await file.arrayBuffer()
        return {
          key,
          value: [
            {
              kind: "file" as const,
              filename: file instanceof File ? file.name : "unknown",
              contentType:
                contentType ??
                (file instanceof File ? file.type : "application/octet-stream"),
              data: new Uint8Array(buffer),
            },
          ],
        }
      } catch {
        throw new Error("File read failed")
      }
    })
  )

  return content.multipart(new Map(entries.map((e) => [e.key, e.value])))
}

const processBinary = async (
  file: Blob,
  contentType: string
): Promise<ContentType> => {
  try {
    const buffer = await file.arrayBuffer()
    return content.binary(
      new Uint8Array(buffer),
      contentType,
      file instanceof File ? file.name : "unknown"
    )
  } catch {
    throw new Error("Binary read failed")
  }
}

const processText = (body: string): ContentType =>
  content.text(body, MediaType.TEXT_PLAIN)

const processXML = (body: string): ContentType =>
  content.xml(body, MediaType.APPLICATION_XML)

const processUrlEncoded = (body: string): ContentType => {
  const params = new URLSearchParams(body)
  const contents: Record<string, string> = {}
  params.forEach((value, key) => {
    contents[key] = value
  })
  return content.urlencoded(contents)
}

type BodyProcessor = {
  readonly kind: string
  readonly process: (
    body: string | FormDataKeyValue[] | Blob
  ) => Promise<ContentType>
}

const ContentProcessors: Record<string, BodyProcessor> = {
  "multipart/form-data": {
    kind: "multipart",
    process: async (body): Promise<ContentType> => {
      if (!Array.isArray(body)) throw new Error("Invalid multipart body")
      return processMultipart(body)
    },
  },
  "application/octet-stream": {
    kind: "binary",
    process: async (body): Promise<ContentType> => {
      if (!(body instanceof Blob)) throw new Error("Invalid binary body")
      return processBinary(body, "application/octet-stream")
    },
  },
  "application/json": {
    kind: "json",
    process: async (body): Promise<ContentType> => {
      if (typeof body !== "string") throw new Error("Invalid JSON body")
      return processJSON(body)
    },
  },
  "application/xml": {
    kind: "xml",
    process: async (body): Promise<ContentType> => {
      if (typeof body !== "string") throw new Error("Invalid XML body")
      return processXML(body)
    },
  },
  "application/x-www-form-urlencoded": {
    kind: "urlencoded",
    process: async (body): Promise<ContentType> => {
      if (typeof body !== "string") throw new Error("Invalid urlencoded body")
      return processUrlEncoded(body)
    },
  },
}

export const transformContent = async (
  body: HoppRESTRequest["body"]
): Promise<ContentType | undefined> => {
  if (!body?.contentType || !body.body) return undefined

  const processor = ContentProcessors[body.contentType] ?? {
    kind: "text",
    process: async (b): Promise<ContentType> => {
      if (typeof b !== "string") throw new Error("Invalid text body")
      return processText(b)
    },
  }

  return processor.process(body.body)
}
