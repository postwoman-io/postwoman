<template>
  <div class="px-3">
    <div
      v-if="deprecationReason"
      class="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-3 mb-4 -mt-2"
      role="alert"
    >
      <p class="font-bold uppercase">Deprecated</p>
      <AppMarkdown type="deprecation">
        {{ deprecationReason }}
      </AppMarkdown>
    </div>

    <AppMarkdown v-if="hasDescription" type="description" class="mb-6">
      {{ description }}
    </AppMarkdown>
    <GraphqlExplorerSection title="Type">
      <GraphqlTypeLink :type="type" />
    </GraphqlExplorerSection>
    <GraphqlArguments :field="field" />
    <GraphqlDirective :field="field" />
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
