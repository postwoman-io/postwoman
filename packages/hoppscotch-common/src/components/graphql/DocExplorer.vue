<template>
  <section
    v-if="schema"
    class="hopp-doc-explorer pb-10"
    aria-label="Documentation Explorer"
  >
    <div class="sticky top-0 z-10 border-b border-dividerLight bg-primary">
      <GraphqlSchemaSearch />
      <div
        class="flex items-center overflow-x-auto whitespace-nowrap px-3 py-2 text-tiny text-secondaryLight"
      >
        <template v-for="(item, index) in navStack" :key="index">
          <span
            class="cursor-pointer hover:text-secondary"
            @click="navigateToIndex(index)"
          >
            {{ item.name }}
          </span>
          <span>
            <icon-lucide-chevron-right
              v-if="index < navStack.length - 1"
              class="mx-1"
            />
          </span>
        </template>
      </div>
    </div>
    <!-- <div class="hopp-doc-explorer-header px-3 mt-4" v-if="navStack.length > 1">
      <div class="hopp-doc-explorer-header-content mb-2">
        <div class="hopp-doc-explorer-title text-xl font-bold break-words">
          {{ currentNavItem.name }}
        </div>
      </div>
    </div> -->
    <div class="hopp-doc-explorer-content mt-4">
      <template v-if="navStack.length === 1">
        <GraphqlSchemaDocumentation :schema="schema" />
      </template>
      <template v-else-if="isType(currentNavItem.def)">
        <div
          class="hopp-doc-explorer-title text-xl font-bold break-words px-3 mb-4"
        >
          {{ currentNavItem.name }}
        </div>
        <GraphqlTypeDocumentation :type="currentNavItem.def" />
      </template>
      <template v-else-if="currentNavItem.def">
        <GraphqlFieldDocumentation :field="currentNavItem.def" />
      </template>
    </div>
  </section>

  <HoppSmartPlaceholder
    v-else
    :src="`/images/states/${colorMode.value}/pack.svg`"
    :alt="`No schema found`"
    :text="`No schema found`"
  >
  </HoppSmartPlaceholder>
</template>

<script setup lang="ts">
import { isType } from "graphql"
import { schema } from "~/helpers/graphql/connection"
import { useExplorer } from "../../helpers/graphql/explorer"
import { useColorMode } from "~/composables/theming"

const colorMode = useColorMode()

// Use explorer composable
const { navStack, currentNavItem, navigateToIndex } = useExplorer()
</script>

<style lang="scss">
a.hopp-doc-explorer-field-name {
  color: hsl(208, 100%, 72%);
  &:hover {
    text-decoration: underline;
  }
}
.hopp-doc-explorer-root-type {
  color: hsl(208, 100%, 72%);
}
.hopp-doc-explorer-type-name {
  color: hsl(30, 100%, 80%);
  cursor: pointer;
}

.hopp-doc-explorer-argument-name {
  color: hsl(243, 100%, 77%);
}

.hopp-doc-explorer-argument-multiple {
  margin-left: 0.5rem;
}

.hopp-doc-explorer-argument-deprecation {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: hsl(0, 100%, 90%);
  border-radius: 0.25rem;
}
</style>
