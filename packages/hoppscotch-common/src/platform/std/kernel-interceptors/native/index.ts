import { markRaw } from "vue"
import type { RelayRequest } from "@hoppscotch/kernel"
import { Service } from "dioc"
import { Relay } from "~/kernel/relay"
import InterceptorsErrorPlaceholder from "~/components/interceptors/ErrorPlaceholder.vue"
import SettingsNative from "~/components/settings/Native.vue"
import { KernelInterceptorNativeStore } from "./store"
import type {
  KernelInterceptor,
  ExecutionResult,
  KernelInterceptorError,
} from "~/services/kernel-interceptor.service"
import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import { getI18n } from "~/modules/i18n"

export class NativeKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "KERNEL_NATIVE_INTERCEPTOR_SERVICE"

  private readonly store = this.bind(KernelInterceptorNativeStore)

  public readonly id = "native"
  public readonly name = (t: ReturnType<typeof getI18n>) =>
    t("interceptor.native.name")
  public readonly selectable = { type: "selectable" as const }
  public readonly capabilities = Relay.capabilities()
  public readonly settingsEntry = markRaw({
    title: (t: ReturnType<typeof getI18n>) =>
      t("interceptor.native.settings_title"),
    component: SettingsNative,
  })

  public execute(req: RelayRequest): ExecutionResult<KernelInterceptorError> {
    const effectiveRequest = this.store.completeRequest(req)
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
                    })
                  case "timeout":
                    return t("error.timeout.description", {
                      phase: error.phase ?? t("error.unknown.phase"),
                    })
                  case "certificate":
                    return t("error.certificate.description", {
                      message: error.message,
                    })
                  case "auth":
                    return t("error.auth.description", {
                      message: error.message,
                    })
                  case "proxy":
                    return t("error.proxy.description", {
                      message: error.message,
                    })
                  case "parse":
                    return t("error.parse.description", {
                      message: error.message,
                    })
                  case "version":
                    return t("error.version.description", {
                      message: error.message,
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
