<template>
  <div>
    <span
      v-if="testResults.description"
      class="flex items-center px-4 py-2 font-bold text-secondaryDark"
    >
      {{ testResults.description }}
    </span>
    <div v-if="testResults.expectResults" class="divide-y divide-dividerLight">
      <HttpTestResultReport
        v-if="testResults.expectResults.length && !shouldHideResultReport"
        :test-results="testResults"
      />

      <template
        v-for="(result, index) in testResults.expectResults"
        :key="`result-${index}`"
      >
        <div
          v-if="shouldShowResult(result.status)"
          class="flex items-center px-4 py-2"
        >
          <div class="flex flex-shrink-0 items-center overflow-x-auto">
            <component
              :is="result.status === 'pass' ? IconCheck : IconClose"
              class="svg-icons mr-4"
              :class="
                result.status === 'pass' ? 'text-green-500' : 'text-red-500'
              "
            />
            <div
              class="flex flex-shrink-0 items-center space-x-2 overflow-x-auto"
            >
              <span
                v-if="result.message"
                class="inline-flex text-secondaryDark"
              >
                {{ result.message }}
              </span>
              <span class="inline-flex text-secondaryLight">
                <icon-lucide-minus class="svg-icons mr-2" />
                {{
                  result.status === "pass" ? t("test.passed") : t("test.failed")
                }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { computed } from "vue"
import {
  HoppTestResult,
  HoppTestExpectResult,
} from "~/helpers/types/HoppTestResult"

import IconCheck from "~icons/lucide/check"
import IconClose from "~icons/lucide/x"

const t = useI18n()

const props = withDefaults(
  defineProps<{
    testResults: HoppTestResult
    showTestType: "all" | "passed" | "failed"
  }>(),
  {
    showTestType: "all",
  }
)

/**
 * Determines if a test result should be displayed based on the filter type
 */
function shouldShowResult(status: HoppTestExpectResult["status"]): boolean {
  if (props.showTestType === "all") return true
  if (props.showTestType === "passed" && status === "pass") return true
  if (props.showTestType === "failed" && status === "fail") return true
  return false
}

const shouldHideResultReport = computed(() => {
  if (props.showTestType === "all") return false

  return props.testResults.expectResults.some(
    (result) => result.status === "pass" || result.status === "fail"
  )
})
</script>
