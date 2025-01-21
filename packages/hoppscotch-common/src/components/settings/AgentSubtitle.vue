<template>
  <div
    v-if="isSelected"
    class="flex flex-col items-left my-2 text-secondaryLight"
  >
    <div
      v-if="
        !store.authKey.value &&
        (!store.isAgentRunning.value || !hasCheckedAgent)
      "
      class="flex flex-1 items-center space-x-2"
    >
      <div class="relative flex-1 border border-divider rounded p-2">
        <span>{{ t("settings.agent_not_running_short") }}</span>
      </div>
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.retry')"
        :icon="IconRefresh"
        outline
        class="rounded"
        @click="handleAgentCheck"
      />
    </div>

    <div
      v-else-if="!store.authKey.value && !hasInitiatedRegistration"
      class="flex flex-1 items-center space-x-2"
    >
      <div
        class="relative flex-1 border border-divider rounded p-2 text-accent"
      >
        <span>{{ t("settings.agent_running") }}</span>
      </div>
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.register')"
        :icon="IconPlus"
        outline
        class="rounded"
        @click="initiateRegistration"
      />
    </div>

    <div
      v-else-if="!store.authKey.value"
      class="flex flex-1 items-center space-x-2"
    >
      <HoppSmartInput
        v-model="registrationOTP"
        :autofocus="false"
        :placeholder="' '"
        :disabled="isRegistering"
        :label="t('settings.enter_otp')"
        input-styles="input floating-input"
        class="flex-1"
      />
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.confirm')"
        :icon="IconCheck"
        :loading="isRegistering"
        outline
        class="rounded"
        @click="register"
      />
    </div>

    <div v-else class="flex relative flex-1 items-center space-x-2">
      <label
        class="text-secondaryLight text-tiny absolute -top-2 left-2 px-1 bg-primary"
        >{{ t("settings.agent_registered") }}</label
      >
      <div
        class="w-full p-2 border border-dividerLight rounded bg-primary text-secondaryDark cursor-text select-all"
      >
        {{ maskedAuthKey }}
      </div>
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('settings.agent_reset_registration')"
        :icon="iconClear"
        outline
        class="rounded"
        @click="resetRegistration"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { refAutoReset } from "@vueuse/core"
import { useService } from "dioc/vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { KernelInterceptorAgentStore } from "~/platform/std/kernel-interceptors/agent/store"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"

import IconPlus from "~icons/lucide/plus"
import IconRotateCCW from "~icons/lucide/rotate-ccw"
import IconCheck from "~icons/lucide/check"
import IconRefresh from "~icons/lucide/refresh-cw"

const t = useI18n()
const toast = useToast()
const store = useService(KernelInterceptorAgentStore)
const interceptorService = useService(KernelInterceptorService)
const iconClear = refAutoReset<typeof IconRotateCCW | typeof IconCheck>(
  IconRotateCCW,
  1000
)

const isSelected = computed(
  () => interceptorService.current.value?.id === "agent"
)

const hasInitiatedRegistration = ref(false)
const maskedAuthKey = ref("")
const hasCheckedAgent = ref(false)
const registrationOTP = ref(store.authKey.value ? null : "")
const isRegistering = ref(false)

async function handleAgentCheck() {
  try {
    await store.checkAgentStatus()
    hasCheckedAgent.value = true
    if (!store.isAgentRunning.value) {
      toast.error(t("settings.agent_not_running"))
    }
  } catch (e) {
    hasCheckedAgent.value = false
    toast.error(t("settings.agent_check_failed"))
  }
}

async function initiateRegistration() {
  try {
    await store.initiateRegistration()
    hasInitiatedRegistration.value = true
  } catch (e) {}
}

async function register() {
  if (!registrationOTP.value) return
  isRegistering.value = true
  try {
    await store.verifyRegistration(registrationOTP.value)
    await updateMaskedAuthKey()
    toast.success(t("settings.agent_registration_successful"))
    registrationOTP.value = ""
  } catch (e) {
  } finally {
    isRegistering.value = false
  }
}

function resetRegistration() {
  store.authKey.value = null
  maskedAuthKey.value = ""
  registrationOTP.value = ""
  hasInitiatedRegistration.value = false
}

async function updateMaskedAuthKey() {
  if (!store.authKey.value) return

  try {
    const registration = await store.fetchRegistrationInfo()
    maskedAuthKey.value = registration.auth_key_hash
  } catch (e) {}
}

onMounted(async () => {
  if (store.authKey.value) {
    await updateMaskedAuthKey()
  }
})
</script>
