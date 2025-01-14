<template>
  <span class="hopp-doc-explorer-directive">
    @{{ directive?.name?.value }}
  </span>
</template>

<script setup lang="ts">
import type { DirectiveNode } from "graphql"

defineProps<{
  /**
   * The directive that should be rendered.
   */
  directive: DirectiveNode
}>()
</script>
