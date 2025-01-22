<template>
  <button
    ref="el"
    class="search-entry relative flex flex-1 cursor-pointer items-center space-x-4 px-6 py-4 font-medium transition focus:outline-none"
    :class="{ 'active bg-primaryLight text-secondaryDark': active }"
    tabindex="-1"
    @click="emit('action')"
    @keydown.enter="emit('action')"
  >
    <component
      :is="entry.icon"
      class="svg-icons opacity-80"
      :class="{ 'opacity-25': active }"
    />
    <template
      v-if="entry.text.type === 'text' && typeof entry.text.text === 'string'"
    >
      <span class="block truncate">
        {{ entry.text.text }}
      </span>
    </template>
    <template
      v-else-if="entry.text.type === 'text' && Array.isArray(entry.text.text)"
    >
      <template
        v-for="(labelPart, labelPartIndex) in entry.text.text"
        :key="`label-${labelPart}-${labelPartIndex}`"
      >
        <span class="block truncate">
          {{ labelPart }}
        </span>
        <icon-lucide-chevron-right
          v-if="labelPartIndex < entry.text.text.length - 1"
          class="flex flex-shrink-0"
        />
      </template>
    </template>
    <template v-else-if="entry.text.type === 'custom'">
      <span class="block truncate">
        <component
          :is="entry.text.component"
          v-bind="entry.text.componentProps"
        />
      </span>
    </template>
    <span v-if="formattedShortcutKeys" class="block truncate">
      <kbd
        v-for="(key, keyIndex) in formattedShortcutKeys"
        :key="`key-${String(keyIndex)}`"
        class="shortcut-key"
      >
        {{ key }}
      </kbd>
    </span>
  </button>
</template>

<script lang="ts">
import { getPlatformSpecialKey } from "~/helpers/platformutils"
import { SpotlightSearcherResult } from "~/services/spotlight"

const SPECIAL_KEY_CHARS: Record<string, string> = {
  ctrl: getPlatformSpecialKey(),
  alt: getPlatformAlternateKey(),
  up: "↑",
  down: "↓",
  enter: "↩",
}
</script>

<script setup lang="ts">
import { computed, watch, ref } from "vue"
import { capitalize } from "lodash-es"
import { getPlatformAlternateKey } from "~/helpers/platformutils"

const el = ref<HTMLElement>()

const props = defineProps<{
  entry: SpotlightSearcherResult
  active: boolean
}>()

const formattedShortcutKeys = computed(() =>
  props.entry.meta?.keyboardShortcut?.map(
    (key) => SPECIAL_KEY_CHARS[key] ?? capitalize(key)
  )
)

const emit = defineEmits<{
  (e: "action"): void
}>()

watch(
  () => props.active,
  (active) => {
    if (active) {
      el.value?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      })
    }
  }
)
</script>

<style lang="scss" scoped>
.search-entry {
  @apply after:absolute;
  @apply after:top-0;
  @apply after:left-0;
  @apply after:bottom-0;
  @apply after:bg-transparent;
  @apply after:z-10;
  @apply after:w-0.5;
  @apply after:content-[''];

  &.active {
    @apply after:bg-accentLight;
  }

  scroll-padding: 4rem !important;
  scroll-margin: 4rem !important;
}
</style>
