<template>
  <div
    class="group flex divide-x divide-dividerLight border-b border-dividerLight"
  >
    <span class="flex min-w-0 flex-1 transition group-hover:text-secondaryDark">
      <span
        v-if="!isEntryEditable"
        class="select-all truncate rounded-sm py-2 pl-4"
      >
        {{ headerKey }}
      </span>
      <SmartEnvInput
        v-else
        :model-value="headerKey"
        @update:model-value="emit('update:headerKey', $event)"
      />
    </span>
    <span
      class="flex min-w-0 flex-1 justify-between transition group-hover:text-secondaryDark"
    >
      <span
        v-if="!isEntryEditable"
        class="select-all truncate rounded-sm py-2 pl-4"
      >
        {{ headerValue }}
      </span>
      <SmartEnvInput
        v-else
        :model-value="headerValue"
        @update:model-value="emit('update:headerValue', $event)"
      />
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.copy')"
        :icon="copyIcon"
        class="hidden !py-0 group-hover:inline-flex"
        @click="copyHeader(headerValue)"
      />
      <HoppButtonSecondary
        v-if="isEntryEditable"
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.delete')"
        :icon="IconTrash"
        class="hidden !py-0 group-hover:inline-flex"
        @click="deleteHeader(headerKey)"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import IconCopy from "~icons/lucide/copy"
import IconTrash from "~icons/lucide/trash"
import IconCheck from "~icons/lucide/check"
import { refAutoReset } from "@vueuse/core"
import { copyToClipboard } from "~/helpers/utils/clipboard"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { computed } from "vue"

const t = useI18n()

const toast = useToast()

const props = defineProps<{
  headerKey: string
  headerValue: string
  isEditable: boolean
}>()

const emit = defineEmits<{
  (e: "update:headerKey", value: string): void
  (e: "update:headerValue", value: string): void
  (e: "delete-header", key: string): void
}>()

// we can allow editing only if the header is not content-type
// because editing content-type can break lense
const isEntryEditable = computed(
  () => props.isEditable && props.headerKey.toLowerCase() !== "content-type"
)

const copyIcon = refAutoReset<typeof IconCopy | typeof IconCheck>(
  IconCopy,
  1000
)

const copyHeader = (headerValue: string) => {
  copyToClipboard(headerValue)
  copyIcon.value = IconCheck
  toast.success(`${t("state.copied_to_clipboard")}`)
}

const deleteHeader = (headerKey: string) => {
  emit("delete-header", headerKey)
}
</script>
