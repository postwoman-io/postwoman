<template>
  <div>
    <GraphqlExplorerSection v-if="fields.length > 0" title="Fields">
      <GraphqlField v-for="field in fields" :key="field.name" :field="field" />
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
import { computed, ref } from "vue"
import { ExplorerFieldDef } from "~/helpers/graphql/explorer"

const props = defineProps<{
  type: GraphQLNamedType
}>()

const showDeprecated = ref(false)
const handleShowDeprecated = () => {
  showDeprecated.value = true
}

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
