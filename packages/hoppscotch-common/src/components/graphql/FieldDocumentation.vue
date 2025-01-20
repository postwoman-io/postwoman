<template>
  <div class="px-3">
    <div
      class="hopp-doc-explorer-title text-xl font-bold break-words mb-4 flex items-center gap-2 leading-[inherit]"
    >
      {{ field.name }}:
      <GraphqlTypeLink :type="field.type" />
      <span
        class="hover:text-accent cursor-pointer text-base"
        @click="insertQuery"
      >
        <icon-lucide-plus-circle />
      </span>
    </div>

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
    <!-- <GraphqlExplorerSection title="Type">
      <GraphqlTypeLink :type="field.type" />
    </GraphqlExplorerSection> -->
    <GraphqlArguments :field="field" />
    <GraphqlFields :type="resolvedType" />
    <GraphqlDirectives :field="field" />
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue"
import { GraphQLOutputType, getNamedType } from "graphql"
import { useQuery } from "~/helpers/graphql/query"

// Update the Field interface
interface Field {
  name: string
  description: string | null
  deprecationReason: string
  type: GraphQLOutputType
}

const props = defineProps<{
  field: Field
}>()

const { handleAddField } = useQuery()

// Computed properties
const hasDescription = computed(() => props.field.description !== null)
const description = computed(() => props.field.description)
const deprecationReason = computed(() => props.field.deprecationReason)

// Add new computed property to resolve the named type
const resolvedType = computed(() => getNamedType(props.field.type))

// Add new method to insert the query
const insertQuery = () => {
  handleAddField(props.field as any)
}
</script>
