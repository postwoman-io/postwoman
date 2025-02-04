<template>
  <template v-if="type">
    <component :is="renderedComponent" />
  </template>
</template>

<script setup lang="ts">
import { GraphQLNamedType, GraphQLType } from "graphql"
import { computed, h } from "vue"
import { renderType, useExplorer } from "~/helpers/graphql/explorer"

const props = defineProps<{
  type: GraphQLType
  clickable?: boolean
}>()

const { push } = useExplorer()

const handleTypeClick = (event: MouseEvent, namedType: GraphQLNamedType) => {
  event.preventDefault()
  push({ name: namedType.name, def: namedType })
}

/**
 * Generates the rendered HTML for the GraphQL type.
 */
const renderedComponent = computed(() => {
  if (!props.type) return ""

  return renderType(props.type, (namedType: GraphQLNamedType) => {
    return h(
      "span",
      {
        class: "hopp-doc-explorer-type-name",
        onClick: (event: MouseEvent) =>
          props.clickable ? handleTypeClick(event, namedType) : undefined,
      },
      namedType.name
    )
  })
})
</script>
