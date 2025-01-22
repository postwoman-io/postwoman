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
              'ai_experiments.generate_or_modify_prerequest_input_placeholder'
            )}`"
            class="flex flex-1 bg-transparent px-6 text-base text-secondaryDark"
            @keypress="
              async (e) => {
                if (e.key === 'Enter') {
                  await modifyPreRequestScript()
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
            :loading="isModifyPreRequestPending"
            :disabled="!userPrompt || isModifyPreRequestPending"
            @click="
              async () => {
                await modifyPreRequestScript()
                submittedFeedback = false
              }
            "
          />
        </div>

        <div>
          <AiexperimentsMergeView
            :content-left="{
              content: currentScript ?? '',
              langMime: 'application/javascript',
            }"
            :content-right="{
              content: generatedScriptContent,
              langMime: 'application/javascript',
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
            @click="emit('closeModal')"
          />
          <HoppButtonSecondary
            :label="t('ai_experiments.accept_change')"
            outline
            filled
            :disabled="isModifyPreRequestPending || !generatedScriptContent"
            @click="
              () => {
                emit('updateScript', generatedScriptContent)
                emit('closeModal')
              }
            "
          />
        </div>
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import IconArrowRight from "~icons/lucide/arrow-right"
import IconThumbsUp from "~icons/lucide/thumbs-up"
import IconThumbsDown from "~icons/lucide/thumbs-down"
import { ref } from "vue"
import { useI18n } from "~/composables/i18n"
import {
  useModifyPreRequestScript,
  useSubmitFeedback,
} from "~/composables/ai-experiments"
import { HoppRESTRequest } from "@hoppscotch/data"

const props = defineProps<{
  currentScript: string
  requestInfo: HoppRESTRequest
}>()

const emit = defineEmits<{
  (e: "closeModal"): void
  (e: "updateScript", script: string): void
}>()

const t = useI18n()
const generatedScriptContent = ref("")
const userPrompt = ref("")
const submittedFeedback = ref(false)

const { modifyPreRequestScript, isModifyPreRequestPending, lastTraceID } =
  useModifyPreRequestScript(
    props.currentScript,
    userPrompt,
    generatedScriptContent,
    props.requestInfo
  )

const { submitFeedback, isSubmitFeedbackPending } = useSubmitFeedback()
</script>
