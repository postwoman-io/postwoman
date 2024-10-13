<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('request.new')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex gap-1 items-center">
        <HoppSmartInput
          v-model="editingName"
          class="flex-grow"
          placeholder=" "
          :label="t('action.label')"
          input-styles="floating-input"
          @submit="addRequest"
        />
        <HoppButtonSecondary
          v-if="canDoRequestNameGeneration"
          v-tippy="{ theme: 'tooltip' }"
          :icon="IconSparkle"
          :disabled="isGenerateRequestNamePending"
          class="rounded-md"
          :class="{
            'animate-pulse': isGenerateRequestNamePending,
          }"
          :title="t('ai_experiments.generate_request_name')"
          @click="
            async () => {
              await generateRequestName(props.requestContext)
              submittedFeedback = false
            }
          "
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <div class="flex space-x-2">
          <HoppButtonPrimary
            :label="t('action.save')"
            outline
            @click="addRequest"
          />
          <HoppButtonSecondary
            :label="t('action.cancel')"
            outline
            filled
            @click="hideModal"
          />
        </div>

        <div
          v-if="lastTraceID && !submittedFeedback"
          class="flex items-center gap-2"
        >
          <p>{{ t("ai_experiments.feedback_cta_request_name") }}</p>
          <template v-if="!isSubmitFeedbackPending">
            <HoppButtonSecondary
              :icon="IconThumbsUp"
              outline
              @click="
                async () => {
                  if (lastTraceID) {
                    await submitFeedback('positive', lastTraceID)
                    submittedFeedback = true
                  }
                }
              "
            />
            <HoppButtonSecondary
              :icon="IconThumbsDown"
              outline
              @click="
                async () => {
                  if (lastTraceID) {
                    await submitFeedback('negative', lastTraceID)
                    submittedFeedback = true
                  }
                }
              "
            />
          </template>
          <template v-else>
            <HoppSmartSpinner />
          </template>
        </div>
        <div v-if="submittedFeedback">
          <p>{{ t("ai_experiments.feedback_thank_you") }}</p>
        </div>
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { HoppRESTRequest } from "@hoppscotch/data"
import { useService } from "dioc/vue"
import { ref, watch } from "vue"

import {
  useRequestNameGeneration,
  useSubmitFeedback,
} from "~/composables/ai-experiments"
import { GQLTabService } from "~/services/tab/graphql"
import IconSparkle from "~icons/lucide/sparkles"
import IconThumbsUp from "~icons/lucide/thumbs-up"
import IconThumbsDown from "~icons/lucide/thumbs-down"

const toast = useToast()
const t = useI18n()

const tabs = useService(GQLTabService)

const props = defineProps<{
  show: boolean
  folderPath?: string
  requestContext: HoppRESTRequest | null
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
  (
    e: "add-request",
    v: {
      name: string
      path: string | undefined
    }
  ): void
}>()

const editingName = ref("")

const {
  generateRequestName,
  isGenerateRequestNamePending,
  canDoRequestNameGeneration,
  lastTraceID,
} = useRequestNameGeneration(editingName)

watch(
  () => props.show,
  (newVal) => {
    if (!newVal) {
      submittedFeedback.value = false
      lastTraceID.value = null
    }
  }
)

const submittedFeedback = ref(false)
const { submitFeedback, isSubmitFeedbackPending } = useSubmitFeedback()

watch(
  () => props.show,
  (show) => {
    if (show) {
      editingName.value = tabs.currentActiveTab.value?.document.request.name
    }
  }
)

const addRequest = () => {
  if (!editingName.value) {
    toast.error(`${t("error.empty_req_name")}`)
    return
  }
  emit("add-request", {
    name: editingName.value,
    path: props.folderPath,
  })
  hideModal()
}

const hideModal = () => {
  emit("hide-modal")
}
</script>
