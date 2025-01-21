import { computed, markRaw } from "vue"
import { Service } from "dioc"
import type { RelayRequest, RelayResponse } from "@hoppscotch/kernel"
import { body } from "@hoppscotch/kernel"
import SettingsExtension from "~/components/settings/Extension.vue"
import SettingsExtensionSubtitle from "~/components/settings/ExtensionSubtitle.vue"
import { KernelInterceptorExtensionStore } from "./store"
import type {
  KernelInterceptor,
  ExecutionResult,
  KernelInterceptorError,
} from "~/services/kernel-interceptor.service"
import * as E from "fp-ts/Either"
import { getI18n } from "~/modules/i18n"
import { until } from "@vueuse/core"
import { preProcessRelayRequest } from "~/helpers/functional/preprocess"

export class ExtensionKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "KERNEL_EXTENSION_INTERCEPTOR_SERVICE"
  private readonly store = this.bind(KernelInterceptorExtensionStore)

  public readonly id = "extension"
  public readonly name = (t: ReturnType<typeof getI18n>) =>
    t("interceptor.extension.name")
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
    advanced: new Set(["localaccess"]),
  } as const

  public readonly settingsEntry = markRaw({
    title: (t: ReturnType<typeof getI18n>) =>
      t("interceptor.extension.settings_title"),
    component: SettingsExtension,
  })

  public readonly subtitle = markRaw(SettingsExtensionSubtitle)
  public readonly extensionStatus = computed(
    () => this.store.getSettings().status
  )
  public readonly extensionVersion = computed(
    () => this.store.getSettings().extensionVersion
  )

  private async executeExtensionRequest(
    request: RelayRequest
  ): Promise<E.Either<KernelInterceptorError, RelayResponse>> {
    await until(() => this.store.getSettings().status).not.toBe("waiting")

    if (!window.__POSTWOMAN_EXTENSION_HOOK__) {
      return E.left({
        humanMessage: {
          heading: (t) => t("error.extension_not_found.heading"),
          description: (t) => t("error.extension_not_found.description"),
        },
        error: {
          kind: "extension",
          message: "Extension hook not found",
        },
      })
    }

    try {
      const extensionResponse =
        await window.__POSTWOMAN_EXTENSION_HOOK__.sendRequest({
          url: request.url,
          method: request.method,
          headers: request.headers,
          data: request.content?.content,
          wantsBinary: true,
        })

      return E.right({
        status: extensionResponse.status,
        statusText: extensionResponse.statusText,
        headers: extensionResponse.headers,
        body: body.body(
          extensionResponse.data,
          extensionResponse.headers["content-type"]
        ),
      })
    } catch (e) {
      return E.left({
        humanMessage: {
          heading: (t) => t("error.extension.heading"),
          description: (t) => t("error.extension.description"),
        },
        error: {
          kind: "extension",
          message: e instanceof Error ? e.message : "Unknown error",
        },
      })
    }
  }

  public execute(
    request: RelayRequest
  ): ExecutionResult<KernelInterceptorError> {
    const extensionExecution = {
      cancel: async () => {
        window.__POSTWOMAN_EXTENSION_HOOK__?.cancelRequest()
      },
      response: this.executeExtensionRequest(preProcessRelayRequest(request)),
    }

    return extensionExecution
  }
}
