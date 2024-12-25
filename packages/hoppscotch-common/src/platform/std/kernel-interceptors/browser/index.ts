import { markRaw } from "vue"
import { Service } from "dioc"
import type { RelayRequest } from "@hoppscotch/kernel"
import { Relay } from "~/kernel/relay"
import SettingsBrowser from "~/components/settings/Browser.vue"
import { KernelInterceptorBrowserStore } from "./store"
import type {
  KernelInterceptor,
  ExecutionResult,
  KernelInterceptorError,
} from "~/services/kernel-interceptor.service"
import { getI18n } from "~/modules/i18n"
import { preProcessRelayRequest } from "~/helpers/functional/preprocess"

export class BrowserKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "BROWSER_KERNEL_INTERCEPTOR_SERVICE"
  private readonly store = this.bind(KernelInterceptorBrowserStore)

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

  public readonly settingsEntry = markRaw({
    title: (t: ReturnType<typeof getI18n>) =>
      t("interceptor.browser.settings_title"),
    component: SettingsBrowser,
  })

  public execute(
    request: RelayRequest
  ): ExecutionResult<KernelInterceptorError> {
    const processedRequest = preProcessRelayRequest(request)
    return Relay.execute(processedRequest)
  }
}
