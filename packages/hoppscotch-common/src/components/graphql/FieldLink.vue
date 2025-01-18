<template>
  <p class="inline-flex items-center mb-0 gap-2 align-bottom">
    <span class="hover:text-accent cursor-pointer" @click="insertQuery">
      <icon-lucide-plus-circle />
    </span>
    <span
      class="hopp-doc-explorer-field-name [text-decoration:inherit]"
      @click="clickable ? handleClick : undefined"
    >
      {{ field.name }}
    </span>
  </p>
</template>

<script setup lang="ts">
import { type ExplorerFieldDef, useExplorer } from "~/helpers/graphql/explorer"
import { useQuery } from "~/helpers/graphql/query"

const { handleAddField } = useQuery()

const props = defineProps<{
  field: ExplorerFieldDef
  clickable?: boolean
}>()

const { push } = useExplorer()

const handleClick = (event: MouseEvent) => {
  event.preventDefault()
  push({ name: props.field.name, def: props.field })
}

const insertQuery = () => {
  handleAddField(props.field)
}
</script>
