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
  public readonly settingsEntry = markRaw({
    title: () => "Native",
    component: SettingsNative,
  })

  public execute(req: Request) {
    console.log("[NativeInterceptor] Got request:", req)
    const effectiveRequest = this.store.completeRequest(req)
    console.log(
      "[NativeInterceptor] Sending complete request:",
      effectiveRequest
    )
    return Relay.execute(effectiveRequest)
  }
}
