<template>
  <component :is="layout">
    <router-view />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRouter } from "vue-router"
import { HOPP_MODULES } from "@hoppscotch/sh-admin/modules"

const defaultLayout = "default"

const { currentRoute } = useRouter()

const layout = computed(
  () => `${currentRoute.value.meta.layout || defaultLayout}-layout`
)

// Run module root component setup code
HOPP_MODULES.forEach((mod) => mod.onRootSetup?.())
</script>
