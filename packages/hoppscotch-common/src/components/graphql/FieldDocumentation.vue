<!-- FieldDocumentation.vue -->
<template>
  <div class="px-3">
    <AppMarkdown v-if="hasDescription" type="description" class="mb-6">
      {{ description }}
    </AppMarkdown>
    <GraphqlDeprecationReason :preview="false" class="mb-4">
      {{ deprecationReason }}
    </GraphqlDeprecationReason>
    <GraphqlExplorerSection title="Type">
      <GraphqlTypeLinkNew :type="type" />
    </GraphqlExplorerSection>
    <GraphqlArguments :field="field" />
    <GraphqlDirectives :field="field" />
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue"
// Define the props interface
interface Field {
  description: string | null
  deprecationReason: string
  type: string
}

// Use defineProps to declare component props
const props = defineProps<{
  field: Field
}>()

// Computed properties
const hasDescription = computed(() => props.field.description !== null)
const description = computed(() => props.field.description)
const deprecationReason = computed(() => props.field.deprecationReason)
const type = computed(() => props.field.type)
</script>
