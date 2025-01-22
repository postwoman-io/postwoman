<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('collection.edit')"
    @close="hideModal"
  >
    <template #body>
      <HoppSmartInput
        v-model="editingName"
        placeholder=" "
        input-styles="floating-input"
        :label="t('action.label')"
        @submit="saveCollection"
      />
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="loadingState"
          outline
          @click="saveCollection"
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
import { useToast } from "@composables/toast"
import { useI18n } from "@composables/i18n"

const t = useI18n()
const toast = useToast()

const props = withDefaults(
  defineProps<{
    show: boolean
    loadingState: boolean
    editingCollectionName: string
  }>(),
  {
    show: false,
    loadingState: false,
    editingCollectionName: "",
  }
)

const emit = defineEmits<{
  (e: "submit", name: string): void
  (e: "hide-modal"): void
}>()

const editingName = ref("")

watch(
  () => props.editingCollectionName,
  (newName) => {
    editingName.value = newName
  }
)

const saveCollection = () => {
  if (props.loadingState) {
    return
  }

  if (editingName.value.trim() === "") {
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
