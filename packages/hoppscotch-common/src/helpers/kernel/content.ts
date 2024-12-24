import { ContentType, FormData, FormDataValue } from "@hoppscotch/kernel"
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
  async convert(formData: FormData): Promise<ContentType> {
    const converted = new Map<string, FormDataValue[]>();

    for (const [key, value] of formData.entries()) {
      if (!converted.has(key)) {
        converted.set(key, []);
      }

      if (value instanceof File) {
        converted.get(key)!.push({
          kind: "file",
          filename: value.name,
          contentType: value.type || "application/octet-stream",
          data: new Uint8Array(await value.arrayBuffer())
        });
      } else {
        converted.get(key)!.push({
          kind: "text",
          value: value.toString()
        });
      }
    }

    return {
      kind: "form",
      content: converted,
      mediaType: "multipart/form-data" as const,
    };
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
