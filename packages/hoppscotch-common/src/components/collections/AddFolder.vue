<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('folder.new')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <HoppSmartInput
        v-model="editingName"
        placeholder=" "
        input-styles="floating-input"
        :label="t('action.label')"
        @submit="addFolder"
      />
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="loadingState"
          outline
          @click="addFolder"
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
import { ref, watch } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"

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
  (e: "hide-modal"): void
  (e: "add-folder", name: string): void
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

const addFolder = () => {
  if (props.loadingState) {
    return
  }

  if (editingName.value.trim() === "") {
    toast.error(t("folder.invalid_name"))
    return
  }

  emit("add-folder", editingName.value)
}

const hideModal = () => {
  editingName.value = ""
  emit("hide-modal")
}
</script>
