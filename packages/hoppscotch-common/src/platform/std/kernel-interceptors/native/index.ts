import { markRaw } from "vue"
import type { Request } from "@hoppscotch/kernel"
import { Service } from "dioc"
import { Relay } from "~/kernel/relay"
import SettingsNative from "~/components/settings/Native.vue"
import { KernelInterceptorNativeStore } from "./store"
import { KernelInterceptor } from "~/services/kernel-interceptor.service"

export class NativeKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "KERNEL_NATIVE_INTERCEPTOR_SERVICE"

  private readonly store = this.bind(KernelInterceptorNativeStore)

  public readonly id = "native"
  public readonly name = () => "Native"
  public readonly selectable = { type: "selectable" as const }
  public readonly capabilities = Relay.capabilities()
  public readonly settingsEntry = markRaw({
    title: () => "Native",
    component: SettingsNative,
  })

  public execute(req: Request) {
    const effectiveRequest = this.store.completeRequest(req)
    return Relay.execute(effectiveRequest)
  }
}
