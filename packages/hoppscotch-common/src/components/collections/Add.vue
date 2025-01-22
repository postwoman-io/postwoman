<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('collection.new')"
    @close="hideModal"
  >
    <template #body>
      <HoppSmartInput
        v-model="editingName"
        placeholder=" "
        :label="t('action.label')"
        input-styles="floating-input"
        @submit="addNewCollection"
      />
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="loadingState"
          outline
          @click="addNewCollection"
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
import { watch, ref } from "vue"
import { useToast } from "@composables/toast"
import { useI18n } from "@composables/i18n"

const toast = useToast()
const t = useI18n()

const props = withDefaults(
  defineProps<{
    show: boolean
    loadingState: boolean
  }>(),
  {
    show: false,
    loadingState: false,
  }
)

const emit = defineEmits<{
  (e: "submit", name: string): void
  (e: "hide-modal"): void
}>()

const editingName = ref("")

watch(
  () => props.show,
  (show) => {
    if (!show) {
      editingName.value = ""
    }
  }
)

const addNewCollection = () => {
  if (props.loadingState) {
    return
  }

  if (!editingName.value) {
    toast.error(t("collection.invalid_name"))
    return
  }

  emit("submit", editingName.value)
}

const hideModal = () => {
  editingName.value = ""
  emit("hide-modal")
}
</script>
