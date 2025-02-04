<template>
  <template v-if="defaultValueAst">
    {' = '}
    <span class="hopp-doc-explorer-default-value">
      {{ printDefault(defaultValueAst) }}
    </span>
  </template>
</template>

<script setup lang="ts">
import { astFromValue, print } from "graphql"
import type { ValueNode } from "graphql"
import { ExplorerFieldDef } from "~/helpers/graphql/explorer"
import { computed } from "vue"

const props = defineProps<{
  field: ExplorerFieldDef
}>()

const printDefault = (ast?: ValueNode | null): string => {
  if (!ast) return ""
  return print(ast)
}

const defaultValueAst = computed(() => {
  if (
    !("defaultValue" in props.field) ||
    props.field.defaultValue === undefined
  ) {
    return null
  }
  return astFromValue(props.field.defaultValue, props.field.type)
})
</script>
