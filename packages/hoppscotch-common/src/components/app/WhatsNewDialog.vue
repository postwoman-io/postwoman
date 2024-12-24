<template>
  <div
    class="flex flex-col p-[1px] w-72 relative border border-dividerDark bg-dividerLight rounded-md text-secondary border-animation overflow-hidden"
    :class="{
      'before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:aspect-square before:w-full before:absolute before:rounded-md': true,
    }"
  >
    <div
      class="overflow-hidden relative flex flex-1 bg-dividerLight px-4 py-2 rounded-md"
    >
      <button
        class="absolute top-2 right-2 hover:text-secondaryLight"
        @click="$emit('close-toast')"
      >
        <IconLucideX />
      </button>
      <div class="flex flex-col space-y-3">
        <p class="leading-5 font-semibold">
          {{ t("app.updated_text", { version: version }) }}
        </p>
        <button
          class="flex items-center space-x-1 hover:underline"
          @click="openWhatsNew"
        >
          <span>
            {{ t("app.see_whats_new") }}
          </span>
          <IconLucideArrowUpRight />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "~/composables/i18n"
import { platform } from "~/platform"

const t = useI18n()

const props = defineProps<{
  notesUrl: string
  version: string
}>()

defineEmits<{
  (e: "close-toast"): void
}>()

const openWhatsNew = () => {
  if (props.notesUrl) platform.kernelIO.openExternalLink(props.notesUrl)
}
</script>

<style>
/* Transition Classes */
.list-enter-active {
  transition: all 1s ease;
}
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}
.list-leave-active {
  position: absolute;
}

/* Conic gradient */
.border-animation::before {
  background: conic-gradient(
    transparent 270deg,
    var(--accent-dark-color),
    transparent
  );
  animation: rotate 4s linear infinite;
}

@keyframes rotate {
  from {
    transform: translate(-50%, -50%) scale(1.4) rotate(0turn);
  }

  to {
    transform: translate(-50%, -50%) scale(1.4) rotate(1turn);
  }
}
</style>
