<template>
  <div class="border-b border-dividerLight autocomplete-wrapper">
    <div ref="searchWrapper" class="no-scrollbar inset-0 flex flex-1">
      <input
        v-model="searchText"
        type="search"
        autocomplete="off"
        class="flex w-full bg-transparent px-3 py-2 h-8"
        :placeholder="t('action.search')"
        @keydown="handleSearchKeystroke"
        @focusin="showSearchResults = true"
      />
    </div>
    <ul
      v-if="showSearchResults && filteredResults.length > 0"
      ref="resultsMenu"
      class="suggestions"
    >
      <li
        v-for="(result, index) in filteredResults"
        :key="`result-${index}`"
        :class="{ active: currentResultIndex === index }"
        @click="selectSearchResult(result)"
      >
        <span class="truncate py-0.5">
          {{ result.name }}
          <span class="text-secondaryLight">- {{ result.type }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLInputField,
  GraphQLNamedType,
} from "graphql"
import { isInputObjectType, isInterfaceType, isObjectType } from "graphql"
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { schema } from "~/helpers/graphql/connection"
import { ExplorerNavStackItem, useExplorer } from "~/helpers/graphql/explorer"

// Types
type SearchResult = {
  name: string
  type: string
  def:
    | GraphQLNamedType
    | GraphQLField<unknown, unknown>
    | GraphQLInputField
    | GraphQLArgument
}

// Composables
const { t } = useI18n()
const { navStack, push, pop } = useExplorer()

// Refs
const searchText = ref("")
const showSearchResults = ref(false)
const currentResultIndex = ref(-1)
const searchWrapper = ref<HTMLElement | null>(null)
const resultsMenu = ref<HTMLElement | null>(null)

// Search Results Generation
const generateSearchResults = () => {
  const results: SearchResult[] = []

  if (!schema.value) return results

  const typeMap = schema.value.getTypeMap()
  const typeNames = Object.keys(typeMap).filter(
    (name) => !name.startsWith("__")
  ) // Filter out __ types

  for (const typeName of typeNames) {
    if (results.length >= 100) break

    const type = typeMap[typeName]

    // Add type match
    if (typeName.toLowerCase().includes(searchText.value.toLowerCase())) {
      results.push({
        name: typeName,
        type: "Type",
        def: type,
      })
    }

    // Skip if not an object, interface, or input object type
    if (
      !isObjectType(type) &&
      !isInterfaceType(type) &&
      !isInputObjectType(type)
    ) {
      continue
    }

    // Search fields
    const fields = type.getFields()
    for (const fieldName in fields) {
      // Skip fields starting with __
      if (fieldName.startsWith("__")) continue

      const field = fields[fieldName]

      // Field name match
      if (fieldName.toLowerCase().includes(searchText.value.toLowerCase())) {
        results.push({
          name: fieldName,
          type: `Field in ${typeName}`,
          def: field,
        })
      }

      // Search arguments if applicable
      if ("args" in field) {
        field.args.forEach((arg) => {
          if (arg.name.toLowerCase().includes(searchText.value.toLowerCase())) {
            results.push({
              name: arg.name,
              type: `Argument in ${fieldName}`,
              def: arg,
            })
          }
        })
      }
    }
  }

  return results
}

// Computed
const filteredResults = computed(() =>
  searchText.value.trim() ? generateSearchResults() : []
)

// Methods
const buildNavigationPath = (result: SearchResult): ExplorerNavStackItem[] => {
  const path: ExplorerNavStackItem[] = []

  if (result.type === "Type") {
    // For type results, traverse through schema to build proper path
    const type = result.def as GraphQLNamedType
    const rootTypes = {
      query: schema.value?.getQueryType(),
      mutation: schema.value?.getMutationType(),
      subscription: schema.value?.getSubscriptionType(),
    }

    // Check if the type is directly accessible from root types
    const rootEntry = Object.entries(rootTypes).find(
      ([, rootType]) => rootType?.name === type.name
    )

    if (rootEntry) {
      path.push({
        name: rootEntry[0].charAt(0).toUpperCase() + rootEntry[0].slice(1),
        def: type,
      })
    } else {
      // If not a root type, try to find the path through fields
      const parentType = Object.values(rootTypes).find((rootType) => {
        if (!rootType || !isObjectType(rootType)) return false
        const fields = rootType.getFields()
        return Object.values(fields).some((field) =>
          field.type.toString().includes(type.name)
        )
      })

      if (parentType) {
        path.push({
          name: parentType.name,
          def: parentType,
        })

        // Find the field that leads to our type
        const field = Object.values(parentType.getFields()).find((field) =>
          field.type.toString().includes(type.name)
        )

        if (field) {
          path.push({
            name: field.name,
            def: field,
          })
        }
      }

      path.push({
        name: type.name,
        def: type,
      })
    }
  } else if (result.type.startsWith("Field in")) {
    // For fields, ensure we have the complete path from root
    const parentTypeName = result.type.replace("Field in ", "")
    const parentType = schema.value?.getType(parentTypeName)

    if (parentType) {
      // First find path to parent type
      const parentPath = buildNavigationPath({
        name: parentType.name,
        type: "Type",
        def: parentType,
      })

      path.push(...parentPath)
      path.push({
        name: result.name,
        def: result.def,
      })
    }
  }

  return path
}

const selectSearchResult = (result: SearchResult) => {
  const navigationPath = buildNavigationPath(result)

  // Reset to root
  while (navStack.value.length > 1) {
    pop()
  }

  // Push each item in the path sequentially
  navigationPath.forEach((item, i) => {
    if (
      i === 0 ||
      (!isObjectType(item.def) &&
        !isInterfaceType(item.def) &&
        !isInputObjectType(item.def))
    )
      push(item)
  })

  showSearchResults.value = false
  searchText.value = ""
  currentResultIndex.value = -1
}

const scrollActiveResultIntoView = async () => {
  await nextTick()
  if (resultsMenu.value && currentResultIndex.value > -1) {
    const activeElement = resultsMenu.value.children[
      currentResultIndex.value
    ] as HTMLElement
    activeElement?.scrollIntoView({ block: "nearest" })
  }
}

const handleSearchKeystroke = (ev: KeyboardEvent) => {
  if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(ev.key)) {
    ev.preventDefault()
  }

  if (["Escape", "Tab"].includes(ev.key)) {
    showSearchResults.value = false
  }

  if (ev.key === "Enter" && currentResultIndex.value > -1) {
    selectSearchResult(filteredResults.value[currentResultIndex.value])
  }

  if (ev.key === "ArrowDown") {
    currentResultIndex.value =
      currentResultIndex.value < filteredResults.value.length - 1
        ? currentResultIndex.value + 1
        : filteredResults.value.length - 1
    scrollActiveResultIntoView()
  }

  if (ev.key === "ArrowUp") {
    currentResultIndex.value =
      currentResultIndex.value > 0 ? currentResultIndex.value - 1 : 0
    scrollActiveResultIntoView()
  }
}

// Click outside handling
const handleClickOutside = (event: MouseEvent) => {
  if (
    searchWrapper.value &&
    !searchWrapper.value.contains(event.target as Node)
  ) {
    showSearchResults.value = false
  }
}

// Add watch for searchText
watch(searchText, () => {
  currentResultIndex.value = -1
  if (searchText.value.trim()) {
    showSearchResults.value = true
  }
})

// Lifecycle
onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside)
})
</script>

<style lang="scss" scoped>
.autocomplete-wrapper {
  @apply relative;
  @apply whitespace-nowrap;

  .suggestions {
    @apply absolute;
    @apply bg-popover;
    @apply z-50;
    @apply shadow-lg;
    @apply max-h-46;
    @apply border-x border-b border-divider;
    @apply overflow-y-auto;
    @apply -left-[1px];
    @apply -right-[1px];

    top: calc(100% + 1px);
    border-radius: 0 0 8px 8px;

    li {
      @apply flex;
      @apply items-center;
      @apply justify-between;
      @apply w-full;
      @apply px-4 py-2;
      @apply text-secondary;
      @apply cursor-pointer;

      &:last-child {
        border-radius: 0 0 0 8px;
      }

      &:hover,
      &.active {
        @apply bg-primaryDark;
        @apply text-secondaryDark;
        @apply cursor-pointer;
      }
    }
  }
}
</style>
