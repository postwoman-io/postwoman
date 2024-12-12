<template>
  <div class="my-1 text-secondaryLight">
    {{ `${t("settings.official_proxy_hosting")} ${t("settings.read_the")}` }}
    <HoppSmartAnchor
      class="link"
      to="https://docs.hoppscotch.io/support/privacy"
      blank
      :label="t('app.proxy_privacy_policy')"
    />.
  </div>
  <div class="flex items-center space-x-2 py-4">
    <HoppSmartInput
      v-model="proxyUrl"
      :autofocus="false"
      styles="flex-1"
      :placeholder="' '"
      :label="t('settings.proxy_url')"
      input-styles="input floating-input"
      @change="updateProxyUrl"
    />
    <HoppButtonSecondary
      v-tippy="{ theme: 'tooltip' }"
      :title="t('settings.reset_default')"
      :icon="clearIcon"
      outline
      class="rounded"
      @click="resetSettings"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { refAutoReset } from "@vueuse/core"
import { useService } from "dioc/vue"
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import { KernelInterceptorProxyStore } from "~/platform/std/kernel-interceptors/proxy/store"

import IconRotateCCW from "~icons/lucide/rotate-ccw"
import IconCheck from "~icons/lucide/check"
import IconEye from "~icons/lucide/eye"
import IconEyeOff from "~icons/lucide/eye-off"

const t = useI18n()
const toast = useToast()
const store = useService(KernelInterceptorProxyStore)

const proxyUrl = ref("")
const showToken = ref(false)

const clearIcon = refAutoReset<typeof IconRotateCCW | typeof IconCheck>(
  IconRotateCCW,
  1000
)

async function updateProxyUrl() {
  await store.updateSettings({ proxyUrl: proxyUrl.value })
  toast.success(t("state.saved"))
}

async function resetSettings() {
  await store.resetSettings()
  const settings = store.getSettings()
  proxyUrl.value = settings.proxyUrl
  clearIcon.value = IconCheck
  toast.success(t("state.cleared"))
}

onMounted(async () => {
  const settings = store.getSettings()
  proxyUrl.value = settings.proxyUrl
})
</script>
