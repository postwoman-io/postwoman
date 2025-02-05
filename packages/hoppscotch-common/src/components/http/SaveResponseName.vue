<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('modal.response_name')"
    @close="hideModal"
  >
    <template #body>
      <div class="flex gap-1">
        <HoppSmartInput
          v-model="editingName"
          class="flex-grow"
          placeholder=" "
          :label="t('action.label')"
          input-styles="floating-input !border-0"
          styles="border border-divider rounded"
          @submit="editRequest"
        >
          <template #button>
            <AppInspection :inspection-results="hasSameNameInspectionResult" />
          </template>
        </HoppSmartInput>
      </div>
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="loadingState"
          outline
          @click="editRequest"
        />
        <HoppButtonSecondary
          :label="t('action.cancel')"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { useVModel } from "@vueuse/core"
import { computed, ComputedRef, markRaw } from "vue"
import { InspectorResult } from "~/services/inspection"
import IconAlertTriangle from "~icons/lucide/alert-triangle"

const toast = useToast()
const t = useI18n()

const props = withDefaults(
  defineProps<{
    show: boolean
    loadingState?: boolean
    responseName?: string
    hasSameNameResponse?: boolean
  }>(),
  {
    show: false,
    loadingState: false,
    responseName: "",
    hasSameNameResponse: false,
  }
)

const emit = defineEmits<{
  (e: "submit", name: string): void
  (e: "hide-modal"): void
  (e: "update:responseName", value: string): void
}>()

const editingName = useVModel(props, "responseName")

const hasSameNameInspectionResult: ComputedRef<InspectorResult[]> = computed(
  () => {
    if (!props.hasSameNameResponse) return []

    return [
      {
        id: "same-name-response",
        severity: 2,
        icon: markRaw(IconAlertTriangle),
        isApplicable: true,
        text: {
          type: "text",
          text: t("response.same_name_inspector_warning"),
        },
        doc: {
          text: t("action.learn_more"),
          link: "https://docs.hoppscotch.io/documentation/getting-started/rest/response-handling#save-a-response-as-an-example",
        },
        locations: {
          type: "url",
        },
      },
    ]
  }
)

const editRequest = () => {
  if (editingName.value.trim() === "") {
    toast.error(t("response.invalid_name"))
    return
  }

  emit("submit", editingName.value)
}

const hideModal = () => {
  editingName.value = ""
  emit("hide-modal")
}
</script>
