import { AuthType, ContentType, Method, Request } from "@hoppscotch/kernel"

export class RequestBuilder {
  constructor(private request: Partial<Request> = {}) {}

  setId(): this {
    this.request.id = Date.now()
    return this
  }

  setVersion(): this {
    this.request.version = "HTTP/1.1"
    return this
  }

  setMethod(method: Method): this {
    this.request.method = method
    return this
  }

  setURL(url: string): this {
    this.request.url = url
    return this
  }

  setAuth(auth: AuthType): this {
    this.request.auth = auth
    return this
  }

  setContent(content: ContentType | null): this {
    if (content) this.request.content = content
    return this
  }

  setHeaders(headers: Record<string, string[]>): this {
    if (Object.keys(headers).length > 0) {
      this.request.headers = headers
    }
    return this
  }

  setParams(params: Record<string, string[]>): this {
    if (Object.keys(params).length > 0) {
      this.request.params = params
    }
    return this
  }

  build(): Request {
    if (!this.request.url || !this.request.method) {
      throw new Error("URL and method are required")
    }
    return this.request as Request
  }
}
