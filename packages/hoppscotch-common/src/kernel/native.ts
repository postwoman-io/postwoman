import { InterceptorV1, Request } from "@hoppscotch/kernel"

export const NativeInterceptor: InterceptorV1 = {
  id: "native",
  capabilities: {
    method: new Set([
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ]),
    header: new Set(["StringValues"]),
    content: new Set(["Text", "Json", "FormData", "Urlencoded"]),
    auth: new Set(["Basic", "Bearer", "Digest"]),
    security: new Set([
      "ClientCertificates",
      "CaCertificates",
      "CertificateValidation",
      "HostVerification",
    ]),
    proxy: new Set(["Http", "Https"]),
    advanced: new Set(["Redirects", "Timeout"]),
  },

  canHandle(request: Request) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel interceptor not properly initialized")
    }
    return window.__KERNEL__.interceptor.canHandle(request)
  },

  execute(request: Request) {
    if (!window.__KERNEL__?.interceptor?.execute) {
      throw new Error("Kernel interceptor not properly initialized")
    }
    console.log("Kernel found, executing request")
    return window.__KERNEL__.interceptor.execute(request)
  },
}
