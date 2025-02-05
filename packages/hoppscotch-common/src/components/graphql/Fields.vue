<template>
  <div>
    <GraphqlExplorerSection v-if="fields.length > 0" title="Fields">
      <GraphqlField
        v-for="field in fields"
        :key="field.name"
        :field="field"
        :show-add-field="showAddField"
      />
    </GraphqlExplorerSection>
  </div>
</template>

<script setup lang="ts">
import {
  GraphQLNamedType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
} from "graphql"
import { computed } from "vue"
import { ExplorerFieldDef } from "~/helpers/graphql/explorer"

const props = withDefaults(
  defineProps<{
    type: GraphQLNamedType
    showAddField: boolean
  }>(),
  {
    showAddField: true,
  }
)

const fieldMap = computed(() => {
  if (
    !isObjectType(props.type) &&
    !isInterfaceType(props.type) &&
    !isInputObjectType(props.type)
  ) {
    return {}
  }
  return props.type.getFields()
})

const fields = computed(() => {
  return Object.values(fieldMap.value) as ExplorerFieldDef[]
})
</script>
