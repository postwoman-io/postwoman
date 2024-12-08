import { ContentType, Response } from "@hoppscotch/kernel"
import { HoppRESTRequest } from "@hoppscotch/data"
import {
  HoppRESTResponse,
  HoppRESTResponseHeader,
} from "../types/HoppRESTResponse"
import { ResponseData, ResponseMetadata } from "./type"

abstract class ResponseBodyHandler {
  abstract convert(content: ContentType): ArrayBuffer
}

class BinaryHandler extends ResponseBodyHandler {
  convert(content: ContentType & { kind: "binary" }): ArrayBuffer {
    return content.content.buffer
  }
}

class JsonHandler extends ResponseBodyHandler {
  convert(content: ContentType & { kind: "json" }): ArrayBuffer {
    return new TextEncoder().encode(JSON.stringify(content.content, null, 2))
      .buffer
  }
}

class FormHandler extends ResponseBodyHandler {
  convert(
    content: ContentType & { kind: "form" | "multipart" | "urlencoded" }
  ): ArrayBuffer {
    return new TextEncoder().encode(
      JSON.stringify(Object.fromEntries(content.content), null, 2)
    ).buffer
  }
}

class DefaultHandler extends ResponseBodyHandler {
  convert(content: ContentType): ArrayBuffer {
    return new TextEncoder().encode(String(content.content)).buffer
  }
}

class ResponseBodyFactory {
  getHandler(content: ContentType): ResponseBodyHandler {
    switch (content.kind) {
      case "binary":
        return new BinaryHandler()
      case "json":
        return new JsonHandler()
      case "form":
      case "multipart":
      case "urlencoded":
        return new FormHandler()
      case "stream":
        throw new Error("Stream responses not supported")
      default:
        return new DefaultHandler()
    }
  }
}

export class ResponseBuilder {
  constructor(
    private originalRequest: HoppRESTRequest,
    private meta: ResponseMetadata
  ) {}

  buildFailure(error: Error): HoppRESTResponse {
    return {
      type: "network_fail",
      error,
      req: this.originalRequest,
    }
  }

  buildFromResponse(response: Response): HoppRESTResponse {
    const headers = this.convertHeaders(response.headers)
    const body = this.convertBody(response.content)

    const responseData: ResponseData = {
      headers,
      body,
      statusCode: response.status,
      statusText: response.statusText || "",
      meta: this.meta,
      req: this.originalRequest,
    }

    return {
      type:
        response.status >= 200 && response.status < 300 ? "success" : "fail",
      ...responseData,
    }
  }

  private convertHeaders(
    headers: Record<string, any> = {}
  ): HoppRESTResponseHeader[] {
    return Object.entries(headers).flatMap(([key, values]) => {
      if (!values) return []
      const stringValues = Array.isArray(values)
        ? values.map(String)
        : [String(values)]
      return stringValues.map((value) => ({
        key: String(key),
        value: value.trim(),
      }))
    })
  }

  private convertBody(content: ContentType | null): ArrayBuffer {
    if (!content) return new ArrayBuffer(0)
    return new ResponseBodyFactory().getHandler(content).convert(content)
  }
}
