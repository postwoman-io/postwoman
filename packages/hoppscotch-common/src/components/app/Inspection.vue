<template>
  <div v-if="inspectionResults && inspectionResults.length > 0">
    <tippy interactive trigger="click" theme="popover">
      <div class="flex flex-1 flex-col items-center justify-center">
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :icon="IconAlertTriangle"
          :class="severityColor(getHighestSeverity.severity)"
          :title="t('inspections.description')"
        />
      </div>
      <template #content="{ hide }">
        <div class="flex flex-1 flex-col items-start space-y-2">
          <div
            class="sticky top-0 flex justify-between self-stretch rounded border border-divider bg-popover pl-2"
          >
            <span class="flex flex-1 items-center">
              <icon-lucide-activity class="svg-icons mr-2 text-accent" />
              <span class="font-bold">
                {{ t("inspections.title") }}
              </span>
            </span>
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              to="https://docs.hoppscotch.io/documentation/features/inspections"
              blank
              :title="t('app.wiki')"
              :icon="IconHelpCircle"
            />
          </div>
          <div
            v-for="(inspector, index) in inspectionResults"
            :key="index"
            class="flex w-full max-w-md self-stretch"
          >
            <div
              class="flex flex-1 flex-col divide-y divide-dashed divide-dividerDark rounded border border-dashed border-dividerDark"
            >
              <span
                v-if="inspector.text.type === 'text'"
                class="flex-1 px-3 py-2"
              >
                {{ inspector.text.text }}
                <HoppSmartLink
                  v-if="inspector.doc"
                  blank
                  :to="inspector.doc.link"
                  class="text-accent transition hover:text-accentDark"
                >
                  {{ inspector.doc.text }}
                  <icon-lucide-arrow-up-right class="svg-icons" />
                </HoppSmartLink>
              </span>
              <span v-if="inspector.action" class="flex space-x-2 p-2">
                <HoppButtonSecondary
                  :label="inspector.action.text"
                  outline
                  filled
                  @click="
                    () => {
                      inspector.action?.apply()
                      hide()
                    }
                  "
                />
              </span>
            </div>
          </div>
        </div>
      </template>
    </tippy>
  </div>
</template>

<script lang="ts" setup>
import { InspectorResult } from "~/services/inspection"
import IconAlertTriangle from "~icons/lucide/alert-triangle"
import IconHelpCircle from "~icons/lucide/help-circle"
import { computed } from "vue"
import { useI18n } from "~/composables/i18n"

const t = useI18n()

const props = defineProps<{
  inspectionResults: InspectorResult[] | undefined
}>()

const getHighestSeverity = computed(() => {
  if (props.inspectionResults) {
    return props.inspectionResults.reduce(
      (prev, curr) => {
        return prev.severity > curr.severity ? prev : curr
      },
      { severity: 0 }
    )
  }
  return { severity: 0 }
})

const severityColor = (severity: number) => {
  switch (severity) {
    case 1:
      return "!text-green-500 hover:!text-green-600"
    case 2:
      return "!text-yellow-500 hover:!text-yellow-600"
    case 3:
      return "!text-red-500 hover:!text-red-600"
    default:
      return "!text-gray-500 hover:!text-gray-600"
  }
}
</script>
