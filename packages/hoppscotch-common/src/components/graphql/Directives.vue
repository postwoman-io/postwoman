<template>
  <ExplorerSection v-if="directives.length > 0" title="Directives">
    <div v-for="directive in directives" :key="directive.name.value">
      <span class="hopp-doc-explorer-directive">
        @{{ directive?.name?.value }}
      </span>
    </div>
  </ExplorerSection>
</template>

<script setup lang="ts">
import { ExplorerFieldDef } from "~/helpers/graphql/explorer"
import ExplorerSection from "./ExplorerSection.vue"
import { computed } from "vue"

const props = defineProps<{
  field: ExplorerFieldDef
}>()

const directives = computed(() => props.field.astNode?.directives || [])
</script>
