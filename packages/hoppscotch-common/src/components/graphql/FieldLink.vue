<template>
  <a
    href="#"
    class="hopp-doc-explorer-field-name [text-decoration:inherit]"
    @click="handleClick"
  >
    {{ field.name }}
  </a>
</template>

<script setup lang="ts">
import { type ExplorerFieldDef, useExplorer } from "~/helpers/graphql/explorer"

const props = defineProps<{
  field: ExplorerFieldDef
}>()

const { push } = useExplorer()

const handleClick = (event: MouseEvent) => {
  event.preventDefault()
  push({ name: props.field.name, def: props.field })
}
</script>
