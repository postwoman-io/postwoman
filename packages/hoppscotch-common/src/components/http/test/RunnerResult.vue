<template>
  <div class="sticky top-upperRunnerStickyFold z-10">
    <HoppSmartTabs
      v-model="selectedTestTab"
      styles="overflow-x-auto flex-shrink-0 bg-primary"
      render-inactive-tabs
      @update:model-value="emit('onChangeTab', $event)"
    >
      <HoppSmartTab
        :id="'all'"
        :label="`${t('tab.all_tests')}`"
        :info="tab.document.testRunnerMeta.totalTests.toString()"
      >
      </HoppSmartTab>
      <HoppSmartTab
        :id="'passed'"
        :label="`${t('tab.passed')}`"
        :info="tab.document.testRunnerMeta.passedTests.toString()"
      >
      </HoppSmartTab>
      <HoppSmartTab
        :id="'failed'"
        :label="`${t('tab.failed')}`"
        :info="tab.document.testRunnerMeta.failedTests.toString()"
      >
      </HoppSmartTab>
    </HoppSmartTabs>
  </div>

  <div
    class="flex flex-col justify-center test-runner pr-2"
    :class="{
      hidden:
        (selectedTestTab === 'passed' &&
          tab.document.testRunnerMeta.passedTests === 0) ||
        (selectedTestTab === 'failed' &&
          tab.document.testRunnerMeta.failedTests === 0),
    }"
  >
    <HoppSmartTree :expand-all="true" :adapter="collectionAdapter">
      <template #content="{ node }">
        <HttpTestResultFolder
          v-if="
            node.data.type === 'folders' &&
            node.data.data.data.requests.length > 0
          "
          :id="node.id"
          :parent-i-d="node.data.data.parentIndex"
          :data="node.data.data.data"
          :is-open="true"
          :is-selected="node.data.isSelected"
          :is-last-item="node.data.isLastItem"
          :show-selection="showCheckbox"
          folder-type="folder"
        />

        <HttpTestResultRequest
          v-if="node.data.type === 'requests' && !node.data.hidden"
          class="runner-request"
          :show-test-type="selectedTestTab"
          :request="node.data.data.data"
          :request-i-d="node.id"
          :parent-i-d="node.data.data.parentIndex"
          :is-selected="node.id === selectedRequestPath"
          :show-selection="showCheckbox"
          :is-last-item="node.data.isLastItem"
          @select-request="selectRequest(node.data.data.data, node.id)"
        />
      </template>
    </HoppSmartTree>
  </div>

  <HoppSmartPlaceholder
    v-if="
      (selectedTestTab === 'passed' &&
        tab.document.testRunnerMeta.passedTests === 0) ||
      (selectedTestTab === 'failed' &&
        tab.document.testRunnerMeta.failedTests === 0)
    "
    :src="`/images/states/${colorMode.value}/pack.svg`"
    :text="
      selectedTestTab === 'passed'
        ? `${t('collection_runner.no_passed_tests')}`
        : `${t('collection_runner.no_failed_tests')}`
    "
  />
</template>

<script setup lang="ts">
import { SmartTreeAdapter } from "@hoppscotch/ui"
import { ref } from "vue"
import { useI18n } from "~/composables/i18n"
import { useColorMode } from "~/composables/theming"
import { HoppTestRunnerDocument } from "~/helpers/rest/document"
import { HoppTab } from "~/services/tab"
import { TestRunnerRequest } from "~/services/test-runner/test-runner.service"

const t = useI18n()
const colorMode = useColorMode()

defineProps<{
  tab: HoppTab<HoppTestRunnerDocument>
  collectionAdapter: SmartTreeAdapter<any>
  isRunning: boolean
  selectedRequestPath: string
}>()

const emit = defineEmits<{
  (e: "onSelectRequest", request: TestRunnerRequest): void
  (e: "onChangeTab", event: string): void
  (e: "requestPath", path: string): void
}>()

const selectedTestTab = ref<"all" | "passed" | "failed">("all")

const showCheckbox = ref(false)

const selectRequest = (request: TestRunnerRequest, indexPath: string) => {
  emit("onSelectRequest", request)
  emit("requestPath", indexPath)
}
</script>

<style>
.test-runner > div > div > div > div > div {
  margin-left: 0;
  width: 0;
}

.test-runner .runner-request {
  @apply ml-2;
}
</style>
