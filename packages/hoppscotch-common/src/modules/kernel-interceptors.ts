import { watch } from "vue"
import { HoppModule } from "."
import { getService } from "./dioc"
import { platform } from "~/platform"
import { applySetting } from "~/newstore/settings"
import { useSettingStatic } from "~/composables/settings"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"

export default <HoppModule>{
  onVueAppInit() {
    const kernelInterceptorService = initKernelInterceptorService()
    setupInterceptorSync(kernelInterceptorService)
  },
}

function initKernelInterceptorService(): KernelInterceptorService {
  const service = getService(KernelInterceptorService)

  registerInterceptors(service)
  initializeDefaultInterceptor(service)

  return service
}

function registerInterceptors(service: KernelInterceptorService): void {
  platform.kernelInterceptors.interceptors.forEach((interceptorDef) => {
    if (interceptorDef.type === "standalone") {
      service.register(interceptorDef.interceptor)
    } else {
      const interceptorService = getService(interceptorDef.service)
      service.register(interceptorService)
    }
  })
}

function initializeDefaultInterceptor(service: KernelInterceptorService): void {
  service.setActive(platform.kernelInterceptors.default)
}

function setupInterceptorSync(service: KernelInterceptorService): void {
  syncServiceToSettings(service)
  syncSettingsToService(service)
}

function syncServiceToSettings(service: KernelInterceptorService): void {
  watch(
    () => service.current.value?.id,
    (id) => {
      applySetting(
        "CURRENT_KERNEL_INTERCEPTOR_ID",
        id ?? platform.kernelInterceptors.default
      )
    }
  )
}

function syncSettingsToService(service: KernelInterceptorService): void {
  const [setting] = useSettingStatic("CURRENT_KERNEL_INTERCEPTOR_ID")

  watch(
    setting,
    () => {
      const fallback = setting.value ?? platform.kernelInterceptors.default
      service.setActive(fallback)
    },
    { immediate: true }
  )
}
