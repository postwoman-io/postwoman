import { Service } from "dioc"
import { BrowserInterceptor } from "~/kernel/browser"
import { Request } from "@hoppscotch/kernel"
import { KernelInterceptor } from "~/services/kernel-interceptor.service"

export class BrowserKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "BROWSER_KERNEL_INTERCEPTOR_SERVICE"

  public readonly id = "browser"
  public readonly name = () => "Browser"
  public readonly selectable = { type: "selectable" as const }

  public execute(req: Request) {
    return BrowserInterceptor.execute(req)
  }
}
