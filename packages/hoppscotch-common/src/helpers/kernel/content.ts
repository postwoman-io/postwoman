import { HoppRESTFormDataEntry } from "./type"
import { ContentType } from "@hoppscotch/kernel"
import { logger } from "./logger"

abstract class ContentHandler {
  abstract convert(body: any): Promise<ContentType>
}

class JsonContentHandler extends ContentHandler {
  async convert(body: string): Promise<ContentType> {
    logger.debug("Converting JSON body", { bodyLength: body.length })

    // TODO: Is this an okay fallback? Empty body isn't valid JSON,
    // but there is an error indicator with empty json body in the app,
    // so perhaps allowing it here would be a good middle ground
    // where user can expect undefined behavior going with empty body anyways?
    if (body.trim() === "")
      return {
        kind: "json",
        content: {},
        mediaType: "application/json",
      }
    return {
      kind: "json",
      content: JSON.parse(body),
      mediaType: "application/json",
    }
  }
}

class XmlContentHandler extends ContentHandler {
  async convert(body: string): Promise<ContentType> {
    return {
      kind: "xml",
      content: body,
      mediaType: "application/xml",
    }
  }
}

class TextContentHandler extends ContentHandler {
  constructor(
    private mediaType: "text/plain" | "text/html" | "text/css" | "text/csv"
  ) {
    super()
  }

  async convert(body: string): Promise<ContentType> {
    return {
      kind: "text",
      content: body,
      mediaType: this.mediaType,
    }
  }
}

class FormContentHandler extends ContentHandler {
  appendBlobToForm(
    form: FormData,
    key: string,
    blob: Blob,
    contentType?: string
  ) {
    if (!(blob instanceof Blob)) return form
    form.append(
      key,
      contentType ? new Blob([blob], { type: contentType }) : blob
    )
    return form
  }

  appendEntryToForm(
    form: FormData,
    { key, value, isFile, contentType }: HoppRESTFormDataEntry
  ) {
    if (!value) return form
    if (isFile && Array.isArray(value)) {
      return value.reduce(
        (f, blob) => this.appendBlobToForm(f, key, blob, contentType),
        form
      )
    }
    if (!isFile) form.append(key, value)
    return form
  }

  async convert(
    entries: ReadonlyArray<HoppRESTFormDataEntry>
  ): Promise<ContentType> {
    const formData = new FormData()
    entries
      .filter(
        (entry): entry is HoppRESTFormDataEntry & { active: true } =>
          entry.active
      )
      .reduce(this.appendEntryToForm, formData)
    return {
      kind: "form",
      content: formData,
      mediaType: "application/x-www-form-urlencoded",
    }
  }
}

class UrlencodedContentHandler extends ContentHandler {
  async convert(body: string): Promise<ContentType> {
    return {
      kind: "urlencoded",
      content: Object.fromEntries(new URLSearchParams(body)),
      mediaType: "application/x-www-form-urlencoded",
    }
  }
}

class BinaryContentHandler extends ContentHandler {
  async convert(file: File): Promise<ContentType> {
    // NOTE: This might fix edge cases where sending empty binary body
    // would pass on request that should have failed.
    if (!file) throw new Error("Binary body requires a file")
    const buffer = await file.arrayBuffer()
    return {
      kind: "binary",
      content: new Uint8Array(buffer),
      mediaType: "application/octet-stream",
      filename: file.name,
    }
  }
}

export class ContentHandlerFactory {
  getHandler(contentType: string): ContentHandler {
    switch (contentType) {
      case "application/json":
      case "application/ld+json":
        return new JsonContentHandler()
      case "application/xml":
      case "text/xml":
        return new XmlContentHandler()
      case "text/plain":
        return new TextContentHandler("text/plain")
      case "text/html":
        return new TextContentHandler("text/html")
      case "text/css":
        return new TextContentHandler("text/css")
      case "text/csv":
        return new TextContentHandler("text/csv")
      case "multipart/form-data":
        return new FormContentHandler()
      case "application/x-www-form-urlencoded":
        return new UrlencodedContentHandler()
      case "application/octet-stream":
        return new BinaryContentHandler()
      default:
        throw new Error(`No handler for content type: ${contentType}`)
    }
  }
}
