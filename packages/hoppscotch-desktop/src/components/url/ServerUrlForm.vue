<template>
  <div class="flex flex-col space-y-6 w-full max-w-md">
    <FormHeader />

    <form @submit.prevent="handleSubmit" class="flex flex-col space-y-4">
      <ServerUrlInput v-model="appUrl" :error="error" :loading="isLoading" @submit="handleSubmit" />

      <HoppButtonPrimary
        type="submit"
        :disabled="isLoading"
        :loading="isLoading"
        label="Connect"
        class="h-10"
      />

      <RecentUrlList
        v-if="recentUrls.length"
        :urls="recentUrls"
        :loading="isLoading"
        @select="selectUrl"
        @toggle-pin="handleTogglePin"
        @clear="clearHistory"
      />
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useUrlHistory } from "~/composables/useUrlHistory"
import { useToast } from "~/composables/toast"
import { download, load } from "tauri-plugin-hoppscotch-appload-api"
import FormHeader from "./FormHeader.vue"
import ServerUrlInput from "./ServerUrlInput.vue"
import RecentUrlList from "./RecentUrlList.vue"

const toast = useToast()
const {
  recentUrls,
  addUrl,
  togglePin: rawTogglePin,
  clearHistory,
} = useUrlHistory()

const appUrl = ref("")
const error = ref("")
const isLoading = ref(false)

const selectUrl = (url: string) => {
  appUrl.value = url
}

const handleTogglePin = async (url: string) => {
  try {
    await rawTogglePin(url)
    const item = recentUrls.value.find((i) => i.url === url)
    toast.success(item?.pinned ? "Connection pinned" : "Connection unpinned")
  } catch {
    toast.error("Failed to toggle pin status")
  }
}

const normalizeUrl = (url: string): string => {
  const withProtocol = url.startsWith("http") ? url : `http://${url}`

  try {
    const parsedUrl = new URL(withProtocol)

    if (parsedUrl.port && parsedUrl.port !== "3200") {
      console.warn(
        `Using custom port ${parsedUrl.port} instead of default port 3200`
      )
    } else if (!parsedUrl.port) {
      parsedUrl.port = "3200"
    }

    return parsedUrl.toString()
  } catch {
    return withProtocol
  }
}

const handleSubmit = async () => {
  if (!appUrl.value) {
    error.value = "Please enter a server URL"
    return
  }

  isLoading.value = true
  error.value = ""

  try {
    const serverUrl = normalizeUrl(appUrl.value)
    const downloadRes = await download({ serverUrl })

    if (downloadRes.success) {
      const loadRes = await load({
        bundleName: downloadRes.bundleName,
        inline: false,
        window: {
          title: "Hoppscotch",
          width: 1200,
          height: 800,
          resizable: true,
        },
      })

      if (loadRes.success) {
        await addUrl(appUrl.value, downloadRes.version)
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Connection failed"
  } finally {
    isLoading.value = false
  }
}
</script>
