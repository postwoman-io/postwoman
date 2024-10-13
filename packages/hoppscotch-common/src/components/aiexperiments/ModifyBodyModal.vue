<script setup lang="ts">
import IconArrowRight from "~icons/lucide/arrow-right"
import IconThumbsUp from "~icons/lucide/thumbs-up"
import IconThumbsDown from "~icons/lucide/thumbs-down"
import {
  useModifyRequestBody,
  useSubmitFeedback,
} from "~/composables/ai-experiments"
import { ref } from "vue"
import { useI18n } from "~/composables/i18n"

const t = useI18n()

const props = defineProps<{
  currentBody: string
}>()

const emit = defineEmits<{
  (e: "closeModal"): void
  (e: "updateBody", body: string): void
}>()

const generatedBodyContent = ref("")

const userPrompt = ref("")

const { modifyRequestBody, isModifyRequestBodyPending, lastTraceID } =
  useModifyRequestBody(props.currentBody, userPrompt, generatedBodyContent)

const submittedFeedback = ref(false)

const { submitFeedback, isSubmitFeedbackPending } = useSubmitFeedback()
</script>

<template>
  <HoppSmartModal styles="sm:max-w-3xl" full-width>
    <template #body>
      <div class="flex flex-col border-b border-divider transition relative">
        <div class="flex items-center pt-3 pb-3 sticky">
          <input
            id="command"
            v-model="userPrompt"
            v-focus
            type="text"
            autocomplete="off"
            name="command"
            :placeholder="`${t(
              'ai_experiments.generate_or_modify_request_body_input_placeholder'
            )}`"
            class="flex flex-1 bg-transparent px-6 text-base text-secondaryDark"
            @keypress="
              async (e) => {
                if (e.key === 'Enter') {
                  await modifyRequestBody()
                  submittedFeedback = false
                }
              }
            "
          />

          <HoppButtonSecondary
            :icon="IconArrowRight"
            class="mr-6 rounded-md flex flex-col-reverse"
            :label="t('ai_experiments.generate')"
            outline
            filled
            :loading="isModifyRequestBodyPending"
            :disabled="!userPrompt || isModifyRequestBodyPending"
            @click="
              async () => {
                await modifyRequestBody()
                submittedFeedback = false
              }
            "
          />
        </div>

        <div>
          <AiexperimentsMergeView
            :content-left="{
              content: currentBody ?? '',
              langMime: 'application/json',
            }"
            :content-right="{
              content: generatedBodyContent,
              langMime: 'application/json',
            }"
          ></AiexperimentsMergeView>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-1 px-6 py-3 justify-between items-center w-full">
        <div
          v-if="lastTraceID && !submittedFeedback"
          class="flex items-center gap-2"
        >
          <p>{{ t("ai_experiments.feedback_cta_text_long") }}</p>
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

          <HoppSmartSpinner v-else />
        </div>

        <div v-if="submittedFeedback">
          <p>{{ t("ai_experiments.feedback_thank_you") }}</p>
        </div>

        <div class="ml-auto space-x-2">
          <HoppButtonSecondary
            :label="t('action.cancel')"
            outline
            @click="
              () => {
                emit('closeModal')
              }
            "
          />
          <HoppButtonSecondary
            :label="t('ai_experiments.accept_change')"
            outline
            filled
            :disabled="isModifyRequestBodyPending || !generatedBodyContent"
            @click="
              () => {
                emit('updateBody', generatedBodyContent)
                emit('closeModal')
              }
            "
          />
        </div>
      </div>
    </template>
  </HoppSmartModal>
</template>
