<template>
  <div class="flex h-screen overflow-hidden bg-primary text-secondary">
    <!-- Sidebar -->
    <div
      :class="isOpen ? '' : '-translate-x-full ease-in'"
      class="fixed md:static md:translate-x-0 md:inset-0 inset-y-0 left-0 z-30 transition duration-300 flex overflow-y-auto bg-primary border-r border-divider"
    >
      <!-- Backdrop for mobile -->
      <div
        :class="isOpen ? 'block' : 'hidden'"
        @click="isOpen = false"
        class="fixed inset-0 z-20 transition-opacity bg-primary opacity-50 lg:hidden"
      ></div>

      <div :class="isExpanded ? 'w-56' : 'w-16'">
        <!-- Logo section -->
        <div class="flex items-center justify-start px-4 my-4">
          <div class="flex items-center">
            <img src="/logo.svg" alt="hoppscotch-logo" class="h-7 w-7" />
            <span v-if="isExpanded" class="ml-4 font-semibold text-accentContrast">HOPPSCOTCH</span>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="my-5">
          <HoppSmartItem :icon="IconHome" label="Home" :class="!isExpanded && 'justify-center'" />
        </nav>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header
        class="flex items-center justify-between border-b border-divider px-6 py-4 bg-primary shadow-lg"
      >
        <div class="flex items-center">
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="'Open Navigation'"
            :icon="IconMenu"
            class="transform md:hidden mr-2"
            @click="isOpen = true"
          />
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'"
            :icon="isExpanded ? IconSidebarClose : IconSidebarOpen"
            class="transform hidden md:block"
            @click="isExpanded = !isExpanded"
          />
        </div>
      </header>

      <!-- App content -->
      <main class="flex-1 overflow-y-auto bg-primary">
        <div class="container mx-auto p-6">
          <div class="flex flex-1 flex-col items-center justify-center min-h-[80vh]">
            <div
              class="p-6 bg-primaryLight rounded-lg border border-primaryDark shadow max-w-lg w-full"
            >
              <form @submit.prevent="handleSubmit" class="flex flex-col space-y-4">
                <div class="relative">
                  <input
                    v-model="appUrl"
                    type="url"
                    :disabled="isLoading"
                    placeholder=" "
                    class="floating-input peer w-full px-4 py-2 bg-primaryDark border border-divider rounded text-secondaryDark font-medium transition focus:border-dividerDark disabled:opacity-75"
                  />
                  <label
                    class="absolute left-2 text-secondaryLight peer-focus:text-secondaryDark bg-primaryDark px-1 transition-all"
                  >Enter app URL</label>
                </div>

                <HoppButtonPrimary
                  :loading="isLoading"
                  type="submit"
                  :label="isLoading ? 'Loading...' : 'Load App'"
                  class="w-full !bg-accent"
                />

                <p v-if="error" class="text-red-500 text-sm text-center">{{ error }}</p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { download, load } from "tauri-plugin-hoppscotch-appload-api"
import IconMenu from "~icons/lucide/menu"
import IconHome from "~icons/lucide/home"
import IconSidebarOpen from "~icons/lucide/sidebar-open"
import IconSidebarClose from "~icons/lucide/sidebar-close"

const isOpen = ref(false)
const isExpanded = ref(true)

const appUrl = ref("")
const error = ref("")
const isLoading = ref(false)

async function handleSubmit() {
  if (!appUrl.value) {
    error.value = "Please enter an app URL"
    return
  }

  isLoading.value = true
  error.value = ""

  try {
    const urlString = appUrl.value.startsWith("http")
      ? appUrl.value
      : `http://${appUrl.value}`
    const url = new URL(urlString)
    const name = url.hostname

    const downloadResponse = await download({ url: urlString, name })
    console.info(downloadResponse)
    const loadResponse = await load({ name, inline: true })
    console.info(loadResponse)
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : "Failed to load app"
  } finally {
    isLoading.value = false
  }
}
</script>

<style>
.floating-input:focus-within ~ label,
.floating-input:not(:placeholder-shown) ~ label {
  @apply transform -translate-y-5 scale-75 z-0 px-1 py-0;
}
</style>
