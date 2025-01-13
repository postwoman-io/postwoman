<template>
  <div v-if="isNamedType(type)">
    <AppMarkdown v-if="type.description" type="description">
      {{ type.description }}
    </AppMarkdown>
    <GraphqlImplementsInterfaces :type="type" />
    <GraphqlFields :type="type" />
    <GraphqlEnumValues :type="type" />
    <GraphqlPossibleTypes :type="type" />
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue"
import { GraphQLNamedType, isNamedType } from "graphql"

defineProps<{
  type: GraphQLNamedType
}>()
</script>
