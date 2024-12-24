<template>
  <div class="flex flex-col">
    <div class="flex items-center gap-2 my-4">
      <div class="h-px bg-divider flex-1" />
      <span class="text-tiny text-secondary uppercase">Recent Connections</span>
      <div class="h-px bg-divider flex-1" />
    </div>

    <div class="flex flex-col space-y-0.5">
      <RecentUrlItem
        v-for="item in urls"
        :key="item.url"
        :url="item.url"
        :last-used="item.lastUsed"
        :bundle-version="item.bundleVersion"
        :pinned="item.pinned"
        :disabled="loading"
        @select="emit('select', item.url)"
        @toggle-pin="emit('toggle-pin', item.url)"
      />
    </div>

    <div v-if="hasUnpinnedUrls" class="flex justify-end mt-4">
      <HoppButtonSecondary
        :icon="IconLucideTrash2"
        label="Clear unpinned history"
        @click="emit('clear')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import IconLucideTrash2 from "~icons/lucide/trash-2"
import type { RecentUrl } from "~/types"
import RecentUrlItem from "./RecentUrlItem.vue"

const props = defineProps<{
  urls: RecentUrl[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: "select", url: string): void
  (e: "toggle-pin", url: string): void
  (e: "clear"): void
}>()

const hasUnpinnedUrls = computed(() => props.urls.some((item) => !item.pinned))
</script>
