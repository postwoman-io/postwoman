<template>
  <Transition name="slide">
    <div
      v-if="open"
      class="fixed inset-0 z-20 transition-opacity bg-primary opacity-50 lg:hidden"
      @click="emit('update:open', false)"
    />
  </Transition>

  <div
    :class="[
      open ? '' : '-translate-x-full ease-in',
      expanded ? 'w-56' : 'w-16'
    ]"
    class="fixed md:static md:translate-x-0 md:inset-0 inset-y-0 left-0 z-30 transition duration-300 flex overflow-y-auto bg-primary border-r border-divider"
  >
    <div class="w-full">
      <div class="flex items-center px-4 my-4">
        <img src="/logo.svg" alt="Hoppscotch" class="h-7 w-7" />
        <span v-if="expanded" class="ml-4 font-semibold text-accentContrast">HOPPSCOTCH</span>
      </div>

      <nav class="my-5">
        <HoppSmartItem
          label="Home"
          :class="!expanded && 'justify-center'"
          to="/"
          exact-active-class="!text-accent !bg-primaryLight"
        >
          <template #icon>
            <IconLucideHome />
          </template>
        </HoppSmartItem>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconLucideHome from "~icons/lucide/home"

defineProps<{
  open: boolean
  expanded: boolean
}>()

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "update:expanded", value: boolean): void
}>()
</script>

<style>
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}
</style>
