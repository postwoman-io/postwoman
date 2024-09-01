<template>
  <div>Hello from Move.vue</div>
  <div>
    {{ workingConfigs.dataSharingConfigs.name }}
  </div>
  <button @click="workingConfigs.dataSharingConfigs.name = 'Hello'">
    Change
  </button>
</template>

<script setup lang="ts">
import { ServerConfigs } from "@hoppscotch/sh-admin/helpers/configs"
import { useVModel } from "@vueuse/core"

const props = defineProps<{
  config: ServerConfigs
}>()

const emit = defineEmits<{
  (e: "update:config", v: ServerConfigs): void
}>()

const workingConfigs = useVModel(props, "config", emit)
</script>

<style scoped></style>
