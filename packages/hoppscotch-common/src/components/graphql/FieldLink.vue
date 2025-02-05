<template>
  <p class="inline-flex items-center mb-0 gap-2 align-bottom">
    <span
      v-if="showAddField"
      class="hover:text-accent cursor-pointer"
      :class="{ 'text-accent': isAdded }"
      @click.stop="emit('add-field', field)"
    >
      <icon-lucide-plus-circle v-if="!isAdded" />
      <icon-lucide-circle-check v-else />
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

const props = withDefaults(
  defineProps<{
    field: ExplorerFieldDef
    clickable?: boolean
    showAddField: boolean
    isAdded?: boolean
  }>(),
  {
    clickable: true,
    showAddField: true,
    isAdded: false,
  }
)

const emit = defineEmits<{
  (event: "add-field", field: ExplorerFieldDef): void
}>()

const { push } = useExplorer()

const handleClick = (event: MouseEvent) => {
  event.preventDefault()
  push({ name: props.field.name, def: props.field })
}
</script>
