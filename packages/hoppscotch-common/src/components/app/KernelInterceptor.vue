<template>
  <div class="flex flex-col space-y-2">
    <div v-if="isTooltipComponent" class="flex flex-col px-4 pt-2">
      <h2 class="inline-flex pb-1 font-semibold text-secondaryDark">
        {{ t("settings.kernel_interceptor") }}
      </h2>
      <p class="inline-flex text-tiny">
        {{ t("settings.kernel_interceptor_description") }}
      </p>
    </div>

    <div>
      <div
        v-for="kernelInterceptor in kernelInterceptors"
        :key="kernelInterceptor.id"
        class="flex flex-col"
      >
        <HoppSmartRadio
          :value="kernelInterceptor.id"
          :label="kernelInterceptor.name(t)"
          :selected="kernelInterceptorSelection === kernelInterceptor.id"
          :disabled="kernelInterceptor.selectable.type === 'unselectable'"
          :class="{
            '!px-0 hover:bg-transparent': !isTooltipComponent,
          }"
          @change="setKernelInterceptor(kernelInterceptor.id)"
        />

        <div
          v-if="kernelInterceptor.selectable.type === 'unselectable'"
          class="px-4 py-1"
        >
          <template v-if="kernelInterceptor.selectable.reason.type === 'text'">
            <p class="text-tiny text-secondaryLight">
              {{ kernelInterceptor.selectable.reason.text(t) }}
            </p>
            <button
              v-if="kernelInterceptor.selectable.reason.action"
              class="text-tiny text-accent hover:text-accentDark"
              @click="kernelInterceptor.selectable.reason.action.onActionClick"
            >
              {{ kernelInterceptor.selectable.reason.action.text(t) }}
            </button>
          </template>

          <component
            :is="kernelInterceptor.selectable.reason.component"
            v-else-if="kernelInterceptor.selectable.reason.type === 'custom'"
            v-bind="kernelInterceptor.selectable.reason.props ?? {}"
          />
        </div>

        <component
          :is="kernelInterceptor.subtitle"
          v-if="kernelInterceptor.subtitle"
          class="ml-8"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useService } from "dioc/vue"
import { computed } from "vue"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"

const t = useI18n()

withDefaults(
  defineProps<{
    isTooltipComponent?: boolean
  }>(),
  {
    isTooltipComponent: true,
  }
)

const kernelInterceptorService = useService(KernelInterceptorService)

const kernelInterceptorSelection = computed(
  () => kernelInterceptorService.current.value?.id ?? null
)

const kernelInterceptors = computed(
  () => kernelInterceptorService.available.value
)

const setKernelInterceptor = (id: string) => {
  if (!kernelInterceptors.value.some((ki) => ki.id === id)) {
    console.warn("Attempted to set an unknown interceptor:", id)
    return
  }
  kernelInterceptorService.setActive(id)
}
</script>
