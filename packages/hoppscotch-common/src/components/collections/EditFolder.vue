<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('folder.edit')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <HoppSmartInput
        v-model="editingName"
        placeholder=" "
        :label="t('action.label')"
        input-styles="floating-input"
        @submit="editFolder"
      />
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="loadingState"
          outline
          @click="editFolder"
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

const t = useI18n()
const toast = useToast()

const props = withDefaults(
  defineProps<{
    show: boolean
    loadingState: boolean
    editingFolderName: string
  }>(),
  {
    show: false,
    loadingState: false,
    editingFolderName: "",
  }
)

const emit = defineEmits<{
  (e: "submit", name: string): void
  (e: "hide-modal"): void
}>()

const editingName = ref("")

watch(
  () => props.editingFolderName,
  (newName) => {
    editingName.value = newName
  }
)

const editFolder = () => {
  if (props.loadingState) {
    return
  }

  if (editingName.value.trim() === "") {
    toast.error(t("folder.invalid_name"))
    return
  }

  emit("submit", editingName.value)
}

const hideModal = () => {
  editingName.value = ""
  emit("hide-modal")
}
</script>
