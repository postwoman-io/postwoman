<template>
  <div v-if="slots.default" class="hopp-doc-explorer-deprecation">
    <div class="hopp-doc-explorer-deprecation-label">Deprecated</div>
    <AppMarkdown type="deprecation" :only-show-first-child="preview">
      {{ slots.default()[0].children }}
    </AppMarkdown>
  </div>
</template>

<script setup lang="ts">
import { useSlots } from "vue"

withDefaults(
  defineProps<{
    preview?: boolean
  }>(),
  {
    preview: true,
  }
)

const slots: {
  default?: () => any[]
} = useSlots()
</script>
