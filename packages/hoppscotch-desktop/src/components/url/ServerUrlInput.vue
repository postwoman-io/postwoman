<template>
  <div class="flex flex-col space-y-2">
    <div class="relative">
      <HoppSmartInput
        :model-value="modelValue"
        :disabled="loading"
        placeholder="http://localhost:3000"
        :error="!!error"
        :loading="loading"
        type="url"
        input-styles="floating-input peer w-full px-4 py-2 bg-primaryDark border border-divider rounded text-secondaryDark font-medium transition focus:border-dividerDark disabled:opacity-75"
        styles="bg-primaryLight border-divider text-secondaryDark"
        class="!h-10 !bg-primaryLight"
        @update:model-value="emit('update:modelValue', $event)"
        @submit="emit('submit')"
      >
        <template #prefix>
          <IconLucideGlobe class="text-secondary" />
        </template>
        <template #suffix v-if="!loading && !error && modelValue">
          <IconLucideCheck class="text-green-500" />
        </template>
      </HoppSmartInput>
    </div>
    <span v-if="error" class="text-red-500 text-tiny">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import IconLucideCheck from "~icons/lucide/check"
import IconLucideGlobe from "~icons/lucide/globe"

defineProps<{
  modelValue: string
  error?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "submit"): void
}>()
</script>
