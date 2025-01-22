<template>
  <div class="flex flex-col">
    <div class="h-1 w-full transition"></div>
    <div class="flex items-stretch group">
      <div
        class="flex items-center justify-center flex-1 min-w-0 cursor-pointer pointer-events-auto"
        @click="selectRequest()"
      >
        <span
          class="flex items-center justify-center px-2 truncate pointer-events-none"
          :style="{ color: requestLabelColor }"
        >
          <HoppSmartCheckbox
            v-if="showSelection"
            :on="isSelected"
            :name="`request-${requestID}`"
            class="mx-2 ml-4"
            @change="selectRequest()"
          />
          <span class="font-semibold truncate text-tiny">
            {{ request.method }}
          </span>
        </span>
        <span
          class="flex items-center flex-1 min-w-0 py-2 pr-2 pointer-events-none transition group-hover:text-secondaryDark"
        >
          <span class="truncate">
            {{ request.name }}
          </span>
          <span
            v-if="isActive"
            v-tippy="{ theme: 'tooltip' }"
            class="relative h-1.5 w-1.5 flex flex-shrink-0 mx-3"
            :title="`${t('collection.request_in_use')}`"
          >
            <span
              class="absolute inline-flex flex-shrink-0 w-full h-full bg-green-500 rounded-full opacity-75 animate-ping"
            >
            </span>
            <span
              class="relative inline-flex flex-shrink-0 rounded-full h-1.5 w-1.5 bg-green-500"
            ></span>
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { HoppRESTRequest } from "@hoppscotch/data"
import { useI18n } from "@composables/i18n"
import { getMethodLabelColorClassOf } from "~/helpers/rest/labelColoring"

const t = useI18n()

const props = withDefaults(
  defineProps<{
    request: HoppRESTRequest
    requestID?: string
    parentID: string | null
    isActive?: boolean
    isSelected?: boolean
    showSelection?: boolean
  }>(),
  {
    parentID: null,
    isActive: false,
    isSelected: false,
    showSelection: false,
  }
)

const emit = defineEmits<{
  (event: "select-request"): void
}>()

const requestLabelColor = computed(() =>
  getMethodLabelColorClassOf(props.request.method)
)

const selectRequest = () => {
  emit("select-request")
}
</script>
