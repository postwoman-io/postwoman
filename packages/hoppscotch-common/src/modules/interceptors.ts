import { InterceptorService } from "~/services/interceptor.service"
import { HoppModule } from "."
import { getService } from "./dioc"
import { platform } from "~/platform"
import { watch } from "vue"
import { applySetting } from "~/newstore/settings"
import { useSettingStatic } from "~/composables/settings"

export default <HoppModule>{
  deprecated: true,
  onVueAppInit() {
    const interceptorService = getService(InterceptorService)

    for (const interceptorDef of platform.interceptors.interceptors) {
      if (interceptorDef.type === "standalone") {
        interceptorService.registerInterceptor(interceptorDef.interceptor)
      } else {
        const service = getService(interceptorDef.service)

        interceptorService.registerInterceptor(service)
      }
    }

    interceptorService.currentInterceptorID.value =
      platform.interceptors.default

    watch(interceptorService.currentInterceptorID, (id) => {
      applySetting(
        "CURRENT_INTERCEPTOR_ID",
        id ?? platform.interceptors.default
      )
    })

    const [setting] = useSettingStatic("CURRENT_INTERCEPTOR_ID")

    watch(
      setting,
      () => {
        interceptorService.currentInterceptorID.value =
          setting.value ?? platform.interceptors.default
      },
      {
        immediate: true,
      }
    )
  },
}
