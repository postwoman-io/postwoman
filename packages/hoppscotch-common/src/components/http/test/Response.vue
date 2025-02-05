<template>
  <div class="relative flex flex-1 flex-col">
    <div
      v-if="doc.response?.type === 'network_fail'"
      class="sticky top-0 z-50 flex-none flex-shrink-0 items-center justify-center whitespace-nowrap bg-primary p-4"
    >
      <span class="text-secondary">
        {{ t("response.status") }}:
        <span class="text-red-500">{{ doc.error }}</span>
      </span>
    </div>
    <HttpResponseMeta v-else :response="doc.response" :is-embed="false" />
    <LensesResponseBodyRenderer
      v-if="hasResponse"
      :document="{
        request: {
          ...doc,
          response: null,
          testResults: null,
        },
        response: doc.response,
        testResults: doc.testResults,
      }"
      :is-editable="false"
      :is-test-runner="true"
      :show-response="showResponse"
    />
    <HoppSmartPlaceholder
      v-else
      :src="`/images/states/${colorMode.value}/add_files.svg`"
      :alt="`${t('collection_runner.response_body_lost_rerun')}`"
      :text="`${t('collection_runner.response_body_lost_rerun')}`"
    >
    </HoppSmartPlaceholder>
  </div>
</template>

<script setup lang="ts">
import { useVModel } from "@vueuse/core"
import { computed } from "vue"
import { useI18n } from "~/composables/i18n"
import { useColorMode } from "~/composables/theming"
import { HoppRequestDocument } from "~/helpers/rest/document"
import { TestRunnerRequest } from "~/services/test-runner/test-runner.service"

const t = useI18n()
const colorMode = useColorMode()

const props = defineProps<{
  showResponse: boolean
  document: TestRunnerRequest
}>()

const emit = defineEmits<{
  (e: "update:tab", val: HoppRequestDocument): void
}>()

const doc = useVModel(props, "document", emit)

const hasResponse = computed(
  () =>
    doc.value.response?.type === "success" ||
    doc.value.response?.type === "fail" ||
    doc.value.response?.type === "network_fail"
)
</script>
