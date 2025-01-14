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
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue"
import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLInputField,
  GraphQLNamedType,
} from "graphql"
import { isObjectType, isInterfaceType, isInputObjectType } from "graphql"
import { useI18n } from "vue-i18n"
import { useExplorer } from "~/helpers/graphql/explorer"
import { schema } from "~/helpers/graphql/connection"

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
const { navStack, push } = useExplorer()

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

  const navItem = navStack.value.at(-1)!
  const withinType = navItem.def

  const typeMap = schema.value.getTypeMap()
  const typeNames = Object.keys(typeMap)

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
const selectSearchResult = (result: SearchResult) => {
  push({
    name: "name" in result.def ? result.def.name : result.name,
    def: result.def,
  })
  showSearchResults.value = false
  searchText.value = ""
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
