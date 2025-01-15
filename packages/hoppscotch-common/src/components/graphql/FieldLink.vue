<template>
  <p class="inline-flex items-center mb-0 gap-1 align-bottom">
    <span class="hover:text-accent cursor-pointer" @click="insertQuery">
      <icon-lucide-plus-circle />
    </span>
    <a
      href="#"
      class="hopp-doc-explorer-field-name [text-decoration:inherit]"
      @click="handleClick"
    >
      {{ field.name }}
    </a>
  </p>
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

const insertQuery = () => {
  console.log("Inserting query")
}
</script>
