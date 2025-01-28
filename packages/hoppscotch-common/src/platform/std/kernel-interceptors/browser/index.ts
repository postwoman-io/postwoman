import { pipe } from "fp-ts/function"
import * as E from "fp-ts/Either"

import { Service } from "dioc"
import type { RelayRequest } from "@hoppscotch/kernel"

import { Relay } from "~/kernel/relay"
import type {
  KernelInterceptor,
  ExecutionResult,
  KernelInterceptorError,
} from "~/services/kernel-interceptor.service"

import { getI18n } from "~/modules/i18n"
import { preProcessRelayRequest } from "~/helpers/functional/preprocess"

import InterceptorsErrorPlaceholder from "~/components/interceptors/ErrorPlaceholder.vue"

export class BrowserKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "BROWSER_KERNEL_INTERCEPTOR_SERVICE"

  public readonly id = "browser"
  public readonly name = (t: ReturnType<typeof getI18n>) =>
    t("interceptor.browser.name")
  public readonly selectable = { type: "selectable" as const }
  public readonly capabilities = {
    method: new Set([
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ]),
    header: new Set(["stringvalue"]),
    content: new Set([
      "text",
      "json",
      "xml",
      "form",
      "multipart",
      "urlencoded",
    ]),
    auth: new Set(["basic", "bearer", "apikey"]),
    security: new Set([]),
    proxy: new Set([]),
    advanced: new Set([]),
  } as const

  public execute(
    request: RelayRequest
  ): ExecutionResult<KernelInterceptorError> {
    const processedRequest = preProcessRelayRequest(request)
    const relayExecution = Relay.execute(processedRequest)

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
