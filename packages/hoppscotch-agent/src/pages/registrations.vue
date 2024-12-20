<template>
  <div class="p-5 h-full flex flex-col flex-grow gap-y-2 justify-between">
    <h1 class="font-bold text-lg text-white">Agent Registrations</h1>
    <div class="overflow-auto">
      <HoppSmartTable
        :headings="[
           { key: 'auth_key_hash', label: 'ID' },
           { key: 'registered_at', label: 'Registered At' },
         ]"
        :list="registrations"
      >
        <template #registered_at="{ item }">{{ formatDate(item.registered_at) }}</template>
      </HoppSmartTable>
    </div>
    <div class="border-t border-divider p-5 flex justify-between">
      <HoppButtonPrimary label="Hide Window" outline @click="hideWindow" />
    </div>
  </div>
</template>

<script setup>
import { ref, markRaw, onMounted } from "vue"
import { HoppButtonPrimary, HoppSmartTable } from "@hoppscotch/ui"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { orderBy } from "lodash-es"

const registrations = ref([])

function formatDate(date) {
  return new Date(date).toLocaleString()
}

function hideWindow() {
  const currentWindow = getCurrentWindow()
  currentWindow.hide()
}

async function loadRegistrations() {
  const result = await invoke("list_registrations", {})
  registrations.value = orderBy(result.registrations, "registered_at", "desc")
}

onMounted(async () => {
  const currentWindow = getCurrentWindow()
  currentWindow.setAlwaysOnTop(true)

  await loadRegistrations()
  await listen("authenticated", () => {
    loadRegistrations()
  })
  await listen("show-registrations", () => {
    loadRegistrations()
  })
})
</script>
