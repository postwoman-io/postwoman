<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="`${t('modal.edit_request')}`"
    @close="hideModal"
  >
    <template #body>
      <div class="flex gap-1">
        <HoppSmartInput
          v-model="editingName"
          class="flex-grow"
          placeholder=" "
          :label="t('action.label')"
          input-styles="floating-input"
          @submit="saveRequest"
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
            :label="`${t('action.save')}`"
            outline
            @click="saveRequest"
          />
          <HoppButtonSecondary
            :label="`${t('action.cancel')}`"
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
import { HoppGQLRequest } from "@hoppscotch/data"
import { nextTick, ref, watch } from "vue"
import { useService } from "dioc/vue"
import {
  useRequestNameGeneration,
  useSubmitFeedback,
} from "~/composables/ai-experiments"
import { editGraphqlRequest } from "~/newstore/collections"
import { GQLTabService } from "~/services/tab/graphql"
import IconSparkle from "~icons/lucide/sparkles"
import IconThumbsUp from "~icons/lucide/thumbs-up"
import IconThumbsDown from "~icons/lucide/thumbs-down"

const t = useI18n()
const toast = useToast()
const tabs = useService(GQLTabService)

const props = defineProps<{
  show: boolean
  folderPath?: string
  requestIndex: number | null
  request: HoppGQLRequest | null
  editingRequestName: string
  requestContext: HoppGQLRequest | null
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const editingName = ref("")

watch(
  () => props.editingRequestName,
  (val) => {
    editingName.value = val
  }
)

const {
  canDoRequestNameGeneration,
  generateRequestName,
  isGenerateRequestNamePending,
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

const saveRequest = () => {
  if (!editingName.value) {
    toast.error(`${t("collection.invalid_name")}`)
    return
  }

  const requestUpdated = {
    ...(props.request as any),
    name: editingName.value || (props.request as any).name,
  }

  // Future TODO: Move below store and follow up tab updates to the page level
  const possibleActiveTab = tabs.getTabRefWithSaveContext({
    originLocation: "user-collection",
    requestIndex: props.requestIndex!,
    folderPath: props.folderPath!,
  })

  editGraphqlRequest(props.folderPath, props.requestIndex, requestUpdated)

  if (possibleActiveTab) {
    possibleActiveTab.value.document.request.name = requestUpdated.name

    nextTick(() => {
      possibleActiveTab.value.document.isDirty = false
    })
  }

  hideModal()
}

const hideModal = () => {
  editingName.value = ""
  emit("hide-modal")
}
</script>
