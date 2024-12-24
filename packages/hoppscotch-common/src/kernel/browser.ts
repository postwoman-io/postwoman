import { InterceptorV1, Request } from "@hoppscotch/kernel"

export const BrowserInterceptor: InterceptorV1 = {
  id: "browser",
  capabilities: {
    content: new Set([
      "Text",
      "Json",
      "FormData",
      "Binary",
      "Multipart",
      "Urlencoded",
      "Streaming",
    ]),
    auth: new Set(["Basic", "Bearer", "ApiKey"]),
    security: new Set([]),
    proxy: new Set([]),
    advanced: new Set(["Timeout", "Redirects"]),
  },

  canHandle(request: Request) {
    return window.__KERNEL__.interceptor.canHandle(request)
  },

  execute(request: Request) {
    return window.__KERNEL__.interceptor.execute(request)
  },
}
