<template>
  <div>
    <div
      class="sticky top-lowerSecondaryStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("request.header_list") }}
      </label>
      <div class="flex">
        <HoppButtonSecondary
          v-if="headers"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.copy')"
          :icon="copyIcon"
          @click="copyHeaders"
        />
      </div>
    </div>
    <LensesHeadersRendererEntry
      v-for="(header, index) in headers"
      :key="index"
      v-model:header-key="header.key"
      v-model:header-value="header.value"
      :is-editable="isEditable"
      @delete-header="deleteHeader(index)"
    />
  </div>
</template>

<script setup lang="ts">
import IconCopy from "~icons/lucide/copy"
import IconCheck from "~icons/lucide/check"
import { refAutoReset } from "@vueuse/core"
import { copyToClipboard } from "~/helpers/utils/clipboard"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import type { HoppRESTResponseHeader } from "~/helpers/types/HoppRESTResponse"
import { useVModel } from "@vueuse/core"

const t = useI18n()

const toast = useToast()

const props = defineProps<{
  modelValue: HoppRESTResponseHeader[]
  isEditable: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue"): void
}>()

const headers = useVModel(props, "modelValue", emit)

const copyIcon = refAutoReset<typeof IconCopy | typeof IconCheck>(
  IconCopy,
  1000
)

const copyHeaders = () => {
  copyToClipboard(JSON.stringify(props.modelValue))
  copyIcon.value = IconCheck
  toast.success(`${t("state.copied_to_clipboard")}`)
}

const deleteHeader = (index: number) => {
  headers.value.splice(index, 1)
}
</script>
