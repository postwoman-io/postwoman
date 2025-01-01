import { markRaw } from "vue"
import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import { getI18n } from "~/modules/i18n"
import { preProcessRelayRequest } from "~/helpers/functional/preprocess"
import type { RelayCapabilities, RelayRequest } from "@hoppscotch/kernel"
import { Relay } from "~/kernel/relay"
import { Service } from "dioc"
import type {
  KernelInterceptor,
  ExecutionResult,
  KernelInterceptorError,
} from "~/services/kernel-interceptor.service"
import { CookieJarService } from "~/services/cookie-jar.service"
import InterceptorsErrorPlaceholder from "~/components/interceptors/ErrorPlaceholder.vue"
import SettingsNative from "~/components/settings/Native.vue"
import { KernelInterceptorNativeStore } from "./store"

export class NativeKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "NATIVE_KERNEL_INTERCEPTOR_SERVICE"

  private readonly store = this.bind(KernelInterceptorNativeStore)
  private readonly cookieJar = this.bind(CookieJarService)

  public readonly id = "native"
  public readonly name = (t: ReturnType<typeof getI18n>) =>
    t("interceptor.native.name")
  public readonly selectable = { type: "selectable" as const }
  public readonly capabilities: RelayCapabilities = {
    method: new Set([
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ]),
    header: new Set(["stringvalue", "arrayvalue", "multivalue"]),
    content: new Set([
      "text",
      "json",
      "xml",
      "form",
      "binary",
      "multipart",
      "urlencoded",
      "compression",
    ]),
    auth: new Set(["basic", "bearer", "apikey"]),
    security: new Set([
      "clientcertificates",
      "cacertificates",
      "certificatevalidation",
      "hostverification",
      "peerverification",
    ]),
    proxy: new Set(["http", "https", "authentication", "certificates"]),
    advanced: new Set(["redirects", "cookies", "localaccess"]),
  } as const
  public readonly settingsEntry = markRaw({
    title: (t: ReturnType<typeof getI18n>) =>
      t("interceptor.native.settings_title"),
    component: SettingsNative,
  })

  public execute(
    request: RelayRequest
  ): ExecutionResult<KernelInterceptorError> {
    console.log("[NATIVE]: request", request)
    const effectiveRequest = this.store.completeRequest(
      preProcessRelayRequest(request)
    )
    console.log("[NATIVE]: effectiveRequest", effectiveRequest)
    const relevantCookies = this.cookieJar.getCookiesForURL(
      new URL(effectiveRequest.url!)
    )

    if (relevantCookies.length > 0) {
      effectiveRequest.headers!["Cookie"] = relevantCookies
        .map((cookie) => `${cookie.name!}=${cookie.value!}`)
        .join(";")
    }

    console.log("[NATIVE]: effectiveRequest", effectiveRequest)
    const relayExecution = Relay.execute(effectiveRequest)

    const response = pipe(relayExecution.response, (promise) =>
      promise.then((either) =>
        pipe(
          either,
          E.mapLeft((error): KernelInterceptorError => {
            const humanMessage = {
              heading: (t: ReturnType<typeof getI18n>) => {
                switch (error.kind) {
                  case "network":
                    return t("error.network.heading")
                  case "timeout":
                    return t("error.timeout.heading")
                  case "certificate":
                    return t("error.certificate.heading")
                  case "auth":
                    return t("error.auth.heading")
                  case "proxy":
                    return t("error.proxy.heading")
                  case "parse":
                    return t("error.parse.heading")
                  case "version":
                    return t("error.version.heading")
                  case "abort":
                    return t("error.aborted.heading")
                  default:
                    return t("error.unknown.heading")
                }
              },
              description: (t: ReturnType<typeof getI18n>) => {
                switch (error.kind) {
                  case "network":
                    return t("error.network.description", {
                      message: error.message,
                      cause: error.cause ?? t("error.unknown.cause"),
                    })
                  case "timeout":
                    return t("error.timeout.description", {
                      message: error.message,
                      phase: error.phase ?? t("error.unknown.phase"),
                    })
                  case "certificate":
                    return t("error.certificate.description", {
                      message: error.message,
                      cause: error.cause ?? t("error.unknown.cause"),
                    })
                  case "auth":
                    return t("error.auth.description", {
                      message: error.message,
                      cause: error.cause ?? t("error.unknown.cause"),
                    })
                  case "proxy":
                    return t("error.proxy.description", {
                      message: error.message,
                      cause: error.cause ?? t("error.unknown.cause"),
                    })
                  case "parse":
                    return t("error.parse.description", {
                      message: error.message,
                      cause: error.cause ?? t("error.unknown.cause"),
                    })
                  case "version":
                    return t("error.version.description", {
                      message: error.message,
                      cause: error.cause ?? t("error.unknown.cause"),
                    })
                  case "abort":
                    return t("error.aborted.description", {
                      message: error.message,
                    })
                  default:
                    return t("error.unknown.description")
                }
              },
            }
            return {
              humanMessage,
              error,
              component: InterceptorsErrorPlaceholder,
            }
          })
        )
      )
    )

    return {
      cancel: relayExecution.cancel,
      response,
    }
  }
}
