<template>
  <div
    class="group relative flex items-center px-4 py-2 bg-primaryLight hover:bg-primaryDark rounded-lg"
  >
    <div
      class="flex-1 flex items-center cursor-pointer"
      :class="{ 'opacity-50': disabled }"
      @click="emit('select')"
    >
      <IconLucideServer class="opacity-75 mr-4" />
      <div class="flex flex-col flex-1 min-w-0">
        <div class="font-semibold truncate">{{ url }}</div>
        <p class="text-tiny text-secondary">{{ formattedDate }}</p>
        <span v-if="bundleVersion" class="text-tiny text-secondary">v{{ bundleVersion }}</span>
      </div>
    </div>

    <button
      class="ml-4 p-2 hover:bg-primaryDark rounded-full transition-colors"
      :disabled="disabled"
      @click="emit('toggle-pin')"
      v-tippy="{
        content: pinned ? 'Unpin Connection' : 'Pin Connection',
        theme: 'tooltip'
      }"
    >
      <component
        :is="pinned ? IconLucidePinOff : IconLucidePin"
        class="text-secondary hover:text-secondaryDark"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import IconLucideServer from "~icons/lucide/server"
import IconLucidePin from "~icons/lucide/pin"
import IconLucidePinOff from "~icons/lucide/pin-off"

const props = defineProps<{
  url: string
  lastUsed: string
  bundleVersion?: string
  pinned: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: "select"): void
  (e: "toggle-pin"): void
}>()

const formattedDate = computed(() => {
  const date = new Date(props.lastUsed)
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day"
  )
})
</script>
