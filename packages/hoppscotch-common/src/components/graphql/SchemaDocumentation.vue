<template>
  <div class="px-3">
    <AppMarkdown type="description" class="mb-4">
      {{ schemaDescription }}
    </AppMarkdown>

    <GraphqlExplorerSection title="Root Types">
      <div v-if="queryType">
        <span class="hopp-doc-explorer-root-type">query</span>
        {{ ": " }}
        <GraphqlTypeLinkNew :type="queryType" />
      </div>
      <div v-if="mutationType">
        <span class="hopp-doc-explorer-root-type">mutation</span>
        {{ ": " }}
        <GraphqlTypeLinkNew :type="mutationType" />
      </div>
      <div v-if="subscriptionType">
        <span class="hopp-doc-explorer-root-type">subscription</span>
        {{ ": " }}
        <GraphqlTypeLinkNew :type="subscriptionType" />
      </div>
    </GraphqlExplorerSection>
    <GraphqlExplorerSection title="All Schema Types">
      <div v-if="filteredTypes">
        <div v-for="type in filteredTypes" :key="type.name">
          <GraphqlTypeLinkNew :type="type" />
        </div>
      </div>
    </GraphqlExplorerSection>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { GraphQLSchema } from "graphql"

const props = defineProps<{
  schema: GraphQLSchema
}>()

const queryType = props.schema.getQueryType()
const mutationType = props.schema.getMutationType?.()
const subscriptionType = props.schema.getSubscriptionType?.()
const typeMap = props.schema.getTypeMap()

const schemaDescription = computed(
  () =>
    props.schema.description ||
    "A GraphQL schema provides a root type for each kind of operation."
)

const ignoreTypesInAllSchema = computed(() => [
  queryType?.name,
  mutationType?.name,
  subscriptionType?.name,
])

const filteredTypes = computed(() => {
  if (!typeMap) return []

  return Object.values(typeMap).filter(
    (type) =>
      !ignoreTypesInAllSchema.value.includes(type.name) &&
      !type.name.startsWith("__")
  )
})
</script>
