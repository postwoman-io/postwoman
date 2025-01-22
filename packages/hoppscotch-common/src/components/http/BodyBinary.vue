<script setup lang="ts">
import { watch } from "vue"

type BinaryBody = {
  contentType: "application/octet-stream"
  body: File | null
}

const props = defineProps<{
  modelValue: BinaryBody
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: BinaryBody): void
}>()

// in the parent component,
// there's a invalid assignment happening
// when switching between different body types only the content type is reset, not the body
// need to look into this
// eg: body: some-json-value-user-entered, contentType: "application/json" -> change content type-> body: some-json-value-user-entered, contentType: "application/octet-stream"
// this is not caught by the type system
// but this behavior right now gives us persistance, which will prevent unwanted data loss
// eg: when the user comes back to the json body, the value is still there
// so to solve this, we need to consider this too.
watch(
  props.modelValue,
  (val) => {
    if (!(val.body instanceof File)) {
      emit("update:modelValue", {
        body: null,
        contentType: "application/octet-stream",
      })
    }
  },
  {
    immediate: true,
  }
)

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    emit("update:modelValue", {
      body: file,
      contentType: "application/octet-stream",
    })
  } else {
    emit("update:modelValue", {
      body: null,
      contentType: "application/octet-stream",
    })
  }
}
</script>
<template>
  <div class="flex items-center px-4 py-2">
    <HoppSmartFileChip v-if="props.modelValue.body">{{
      props.modelValue.body.name
    }}</HoppSmartFileChip>

    <label :for="`attachment-binary-body`" class="p-0">
      <input
        :id="`attachment-binary-body`"
        :name="`attachment-binary-body`"
        type="file"
        class="cursor-pointer p-1 text-tiny text-secondaryLight transition file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-primaryLight file:px-4 file:py-1 file:text-tiny file:text-secondary file:transition hover:text-secondaryDark hover:file:bg-primaryDark hover:file:text-secondaryDark"
        @change="handleFileChange"
      />
    </label>
  </div>
</template>
