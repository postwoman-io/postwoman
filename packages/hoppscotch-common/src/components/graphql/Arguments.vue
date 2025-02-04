<template>
  <template v-if="'args' in field">
    <GraphqlExplorerSection v-if="field.args.length > 0" title="Arguments">
      <GraphqlArgument
        v-for="arg in field.args"
        :key="arg.name"
        :arg="arg"
        :show-add-button="true"
      />
    </GraphqlExplorerSection>
  </template>
</template>

<script setup lang="ts">
import { GraphQLField } from "graphql"

defineProps<{
  field: GraphQLField<any, any>
}>()
</script>
