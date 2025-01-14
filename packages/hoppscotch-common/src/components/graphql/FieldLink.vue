<template>
  <a
    href="#"
    class="hopp-doc-explorer-field-name decoration-inherit"
    style="color: hsl(30, 100%, 80%); cursor: pointer"
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
