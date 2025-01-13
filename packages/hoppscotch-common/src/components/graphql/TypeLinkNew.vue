<template>
  <template v-if="type">
    <component :is="renderedType.type" v-bind="renderedType.props">
      {{ renderedType.children }}
    </component>
  </template>
</template>

<script setup lang="ts">
import { GraphQLType } from "graphql"
import { computed } from "vue"

import { renderType, useExplorer } from "~/helpers/graphql/explorer"

const props = defineProps<{
  type: GraphQLType
}>()

const { push } = useExplorer()

const handleTypeClick = (event: MouseEvent, namedType: any) => {
  event.preventDefault()
  push({ name: namedType.name, def: namedType })
}

const renderedType = computed(() => {
  if (!props.type) return null

  return renderType(props.type, (namedType) => {
    return {
      type: "a",
      props: {
        class: "hopp-doc-explorer-type-name",
        href: "#",
        onClick: (event: MouseEvent) => handleTypeClick(event, namedType),
      },
      children: namedType.name,
    }
  })
})
</script>
