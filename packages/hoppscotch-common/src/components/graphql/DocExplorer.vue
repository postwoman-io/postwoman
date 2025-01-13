<template>
  <section class="hopp-doc-explorer pb-10" aria-label="Documentation Explorer">
    <div class="hopp-doc-explorer-header px-3 pt-4">
      <div class="hopp-doc-explorer-header-content mb-6">
        <a
          v-if="prevName"
          href="#"
          class="hopp-doc-explorer-back"
          @click.prevent="pop"
          :aria-label="`Go back to ${prevName}`"
        >
          <icon-lucide-chevron-left />
          {{ prevName }}
        </a>
        <div class="hopp-doc-explorer-title text-xl font-bold">
          {{ currentNavItem.name }}
        </div>
      </div>
      <!-- TODO: implement search -->
      <!-- <Search :key="currentNavItem.name" /> -->
    </div>
    <div class="hopp-doc-explorer-content">
      <template v-if="schema && navStack.length === 1">
        <GraphqlSchemaDocumentation :schema="schema" />
      </template>
      <template v-else-if="isType(currentNavItem.def)">
        <GraphqlTypeDocumentation :type="currentNavItem.def" />
      </template>
      <template v-else-if="currentNavItem.def">
        <GraphqlFieldDocumentation :field="currentNavItem.def" />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { isType } from "graphql"
import { useExplorer } from "../../helpers/graphql/explorer"
import { schema } from "~/helpers/graphql/connection"

// Use explorer composable
const { navStack, currentNavItem, pop } = useExplorer()

// Compute previous name if navigation stack has more than one item
const prevName = computed(() => {
  return navStack.value.length > 1
    ? navStack.value[navStack.value.length - 2].name
    : undefined
})
</script>

<style lang="scss">
a.hopp-doc-explorer-field-name {
  color: hsl(208, 100%, 72%);
  &:hover {
    text-decoration: underline;
  }
}
a.hopp-doc-explorer-type-name {
  color: hsl(30, 100%, 80%);
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
}

.hopp-doc-explorer-argument-name {
  color: hsl(243, 100%, 77%);
}

.hopp-doc-explorer-argument-deprecation {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: hsl(0, 100%, 90%);
  border-radius: 0.25rem;
}

.hopp-doc-explorer-item {
  margin-bottom: 1rem;
}
</style>
