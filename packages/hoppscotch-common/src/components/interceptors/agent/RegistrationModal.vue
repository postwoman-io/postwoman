<template>
  <!-- TODO: i18n -->
  <HoppSmartModal
    v-if="show"
    dialog
    styles="sm:max-w-md"
    :title="modalTitle"
    @close="hideModal"
  >
    <template #body>
      <div class="space-y-4">
        <p v-if="status === 'agent_not_running'" class="text-secondaryLight">
          {{ t("agent.not_running") }}
        </p>

        <template v-else-if="status === 'registration_required'">
          <p
            v-if="registrationStatus === 'initial'"
            class="text-secondaryLight"
          >
            {{ t("agent.registration_instruction") }}
          </p>

          <template v-else-if="registrationStatus === 'otp_required'">
            <p class="text-secondaryLight">
              {{ t("agent.enter_otp_instruction") }}
            </p>

            <HoppSmartInput
              v-model="userEnteredOTP"
              placeholder=" "
              :label="t('agent.otp_label')"
              input-styles="input floating-input"
            />
          </template>

          <div
            v-else-if="isRegistrationLoading"
            class="flex items-center space-x-2"
          >
            <HoppSmartSpinner />

            <p class="text-secondaryLight">{{ t("agent.processing") }}</p>
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-start flex-1">
        <HoppButtonPrimary
          :label="primaryButtonLabel"
          :loading="isRegistrationLoading"
          @click="primaryActionHandler"
        />

        <HoppButtonSecondary
          :label="t('action.cancel')"
          class="ml-2"
          filled
          outline
          @click="hideModal"
        />
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"

import { useI18n } from "~/composables/i18n"

const t = useI18n()
const userEnteredOTP = ref("")

const props = defineProps<{
  show: boolean
  status: "agent_not_running" | "registration_required" | "hidden"
  registrationStatus: "initial" | "otp_required" | "loading"
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
  (e: "register"): void
  (e: "verify", otp: string): void
  (e: "retry-connection"): void
}>()

const modalTitle = computed(() => {
  switch (props.status) {
    case "agent_not_running":
      return t("agent.not_running_title")
    case "registration_required":
      return t("agent.registration_title")
    default:
      return ""
  }
})

const isRegistrationLoading = computed(
  () => props.registrationStatus === "loading"
)

const primaryButtonLabel = computed(() => {
  if (isRegistrationLoading.value) {
    return t("state.loading")
  }

  if (props.status === "agent_not_running") {
    return t("action.retry")
  }

  if (props.status === "registration_required") {
    if (props.registrationStatus === "initial") {
      return t("action.register")
    }

    if (props.registrationStatus === "otp_required") {
      return t("action.verify")
    }
  }

  return ""
})

const primaryActionHandler = () => {
  if (props.status === "agent_not_running") {
    return emit("retry-connection")
  }

  if (props.status === "registration_required") {
    if (props.registrationStatus === "initial") {
      return emit("register")
    }

    if (props.registrationStatus === "otp_required") {
      return emit("verify", userEnteredOTP.value)
    }
  }

  return null
}

const hideModal = () => emit("hide-modal")
</script>
