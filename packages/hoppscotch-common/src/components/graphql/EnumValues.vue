<template>
  <template v-if="isEnumType(type)">
    <GraphqlExplorerSection
      v-if="enumValues.values.length > 0"
      title="Enum Values"
    >
      <div
        v-for="value in enumValues.values"
        :key="value.name"
        class="hopp-doc-explorer-item"
      >
        <div class="hopp-doc-explorer-enum-value">{{ value.name }}</div>
        <GraphqlMarkdown v-if="value.description" type="description">
          {{ value.description }}
        </GraphqlMarkdown>
        <GraphqlMarkdown v-if="value.deprecationReason" type="deprecation">
          {{ value.deprecationReason }}
        </GraphqlMarkdown>
      </div>
    </GraphqlExplorerSection>

    <template v-if="enumValues.deprecatedValues.length > 0">
      <ExplorerSection
        v-if="showDeprecated || enumValues.values.length === 0"
        title="Deprecated Enum Values"
      >
        <EnumValue
          v-for="value in enumValues.deprecatedValues"
          :key="value.name"
          :value="value"
        />
      </ExplorerSection>

      <button v-else type="button" @click="handleShowDeprecated">
        {{ t("graphql.show_depricated_values") }}
      </button>
    </template>
  </template>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { GraphQLNamedType, GraphQLEnumValue } from "graphql"
import { isEnumType } from "graphql"
import { useI18n } from "~/composables/i18n"

const t = useI18n()

interface EnumValuesProps {
  type: GraphQLNamedType
}

const props = defineProps<EnumValuesProps>()

const showDeprecated = ref(false)

const handleShowDeprecated = () => {
  showDeprecated.value = true
}

const enumValues = computed(() => {
  if (!isEnumType(props.type)) {
    return { values: [], deprecatedValues: [] }
  }

  const values: GraphQLEnumValue[] = []
  const deprecatedValues: GraphQLEnumValue[] = []

  for (const value of props.type.getValues()) {
    if (value.deprecationReason) {
      deprecatedValues.push(value)
    } else {
      values.push(value)
    }
  }

  return { values, deprecatedValues }
})
</script>
