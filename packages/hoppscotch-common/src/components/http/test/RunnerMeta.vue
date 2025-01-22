<template>
  <div class="flex flex-col">
    <span class="text-xs text-secondaryLight mb-1 truncate">
      {{ heading }}
    </span>
    <span class="text-sm font-bold text-secondaryDark truncate">
      <slot>
        {{ text }}
      </slot>
    </span>
  </div>
</template>
<script setup lang="ts">
withDefaults(
  defineProps<{
    heading: string
    text?: string
  }>(),
  {}
)
</script>
