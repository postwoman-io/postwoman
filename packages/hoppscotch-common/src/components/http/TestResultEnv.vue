<template>
  <div class="flex items-center justify-between px-4 py-2">
    <div class="flex flex-shrink items-center overflow-x-auto">
      <component
        :is="getIcon(status)"
        v-tippy="{ theme: 'tooltip' }"
        class="svg-icons mr-4 cursor-help"
        :class="getStyle(status)"
        :title="`${t(getTooltip(status))}`"
      />
      <div class="flex flex-shrink items-center space-x-2 overflow-x-auto">
        <span class="inline-flex text-secondaryDark">
          {{ env.key }}
        </span>
        <span class="inline-flex text-secondaryDark">
          <icon-lucide-minus class="svg-icons mr-2" />
          {{ env.value }}
        </span>
        <span
          v-if="status === 'updations'"
          class="inline-flex text-secondaryLight"
        >
          <icon-lucide-arrow-left class="svg-icons mr-2" />
          {{ env.previousValue }}
        </span>
      </div>
    </div>
    <span
      v-if="global"
      class="ml-4 rounded bg-accentLight px-1 text-tiny text-accentContrast"
    >
      Global
    </span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"

import IconPlusCircle from "~icons/lucide/plus-circle"
import IconCheckCircle2 from "~icons/lucide/check-circle-2"
import IconMinusCircle from "~icons/lucide/minus-circle"

type Status = "updations" | "additions" | "deletions"
type Props = {
  env: {
    key: string
    value: string
    previousValue?: string
  }
  status: Status
  global?: boolean
}

withDefaults(defineProps<Props>(), {
  global: false,
})

const t = useI18n()

const getIcon = (status: Status) => {
  switch (status) {
    case "additions":
      return IconPlusCircle
    case "updations":
      return IconCheckCircle2
    case "deletions":
      return IconMinusCircle
  }
}

const getStyle = (status: Status) => {
  switch (status) {
    case "additions":
      return "text-green-500"
    case "updations":
      return "text-yellow-500"
    case "deletions":
      return "text-red-500"
  }
}

const getTooltip = (status: Status) => {
  switch (status) {
    case "additions":
      return "environment.added"
    case "updations":
      return "environment.updated"
    case "deletions":
      return "environment.deleted"
  }
}
</script>
