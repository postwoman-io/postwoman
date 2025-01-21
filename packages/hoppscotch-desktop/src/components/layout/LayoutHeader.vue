<template>
  <header
    class="flex items-center justify-between border-b border-divider px-6 py-4 bg-primary shadow-lg"
  >
    <div class="flex items-center">
      <HoppButtonSecondary
        v-tippy="{ content: 'Toggle Navigation' }"
        :icon="IconLucideMenu"
        class="md:hidden mr-2"
        @click="emit('toggle-sidebar')"
      />
      <HoppButtonSecondary
        v-tippy="{ content: expanded ? 'Collapse Sidebar' : 'Expand Sidebar' }"
        :icon="expanded ? IconLucideSidebarClose : IconLucideSidebarOpen"
        class="hidden md:flex"
        @click="emit('toggle-expand')"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import IconLucideMenu from "~icons/lucide/menu"
import IconLucideSidebarClose from "~icons/lucide/sidebar-close"
import IconLucideSidebarOpen from "~icons/lucide/sidebar-open"

defineProps<{
  expanded: boolean
}>()

const emit = defineEmits<{
  (e: "toggle-sidebar"): void
  (e: "toggle-expand"): void
}>()
</script>
