<template>
  <div v-if="isNamedType(type)" class="px-3">
    <AppMarkdown v-if="type.description" type="description">
      {{ type.description }}
    </AppMarkdown>
    <GraphqlImplementsInterfaces :type="type" />
    <GraphqlFields
      :type="type"
      :insert-query="false"
      :show-add-field="isShowAddField"
    />
    <GraphqlEnumValues :type="type" />
    <GraphqlPossibleTypes :type="type" />
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue"
import { GraphQLNamedType, isNamedType } from "graphql"

const props = defineProps<{
  type: GraphQLNamedType
}>()

const isShowAddField = ["Query", "Mutation", "Subscription"].includes(
  props.type.name
)
</script>
