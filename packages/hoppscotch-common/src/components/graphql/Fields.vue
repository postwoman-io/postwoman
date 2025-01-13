<template>
  <div>
    <GraphqlExplorerSection v-if="fields.length > 0" title="Fields">
      <GraphqlField v-for="field in fields" :key="field.name" :field="field" />
    </GraphqlExplorerSection>
    <GraphqlExplorerSection
      v-if="showDeprecated || fields.length === 0"
      title="Deprecated Fields"
    >
      <GraphqlField
        v-for="field in deprecatedFields"
        :key="field.name"
        :field="field"
      />
    </GraphqlExplorerSection>
    <button
      v-if="deprecatedFields.length > 0 && !showDeprecated && fields.length > 0"
      type="button"
      @click="handleShowDeprecated"
    >
      Show Deprecated Fields
    </button>
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
  const result: ExplorerFieldDef[] = []
  for (const field of Object.keys(fieldMap.value).map(
    (name) => fieldMap.value[name]
  )) {
    if (!field.deprecationReason) {
      result.push(field)
    }
  }
  return result
})

const deprecatedFields = computed(() => {
  const result: ExplorerFieldDef[] = []
  for (const field of Object.keys(fieldMap.value).map(
    (name) => fieldMap.value[name]
  )) {
    if (field.deprecationReason) {
      result.push(field)
    }
  }
  return result
})
</script>
