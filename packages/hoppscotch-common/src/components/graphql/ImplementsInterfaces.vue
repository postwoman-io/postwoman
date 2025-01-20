<template>
  <GraphqlExplorerSection v-if="interfaces.length > 0" title="Implements">
    <div
      v-for="implementedInterface in interfaces"
      :key="implementedInterface.name"
    >
      <GraphqlTypeLink :type="implementedInterface" />
    </div>
  </GraphqlExplorerSection>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue"
import { isObjectType, GraphQLNamedType } from "graphql"

const props = defineProps<{
  type: GraphQLNamedType
}>()

const interfaces = computed(() => {
  if (!isObjectType(props.type)) {
    return []
  }
  return props.type.getInterfaces()
})
</script>
