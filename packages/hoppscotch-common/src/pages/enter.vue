<template>
  <div class="flex min-h-screen flex-col items-center justify-center">
    <HoppSmartSpinner v-if="signingInWithEmail" />
    <AppLogo v-else class="h-16 w-16 rounded" />
    <pre v-if="error" class="mt-4 text-secondaryLight">{{ error }}</pre>
  </div>
</template>

<script lang="ts">
import { useI18n } from "@composables/i18n"
import { defineComponent } from "vue"
import { useRoute } from "vue-router"
import { initializeApp } from "~/helpers/app"
import { platform } from "~/platform"

export default defineComponent({
  setup() {
    return {
      t: useI18n(),
      route: useRoute(),
    }
  },
  data() {
    return {
      signingInWithEmail: false,
      error: null,
    }
  },
  beforeMount() {
    initializeApp()
  },
  async mounted() {
    const { redirect, ...queryParams } = this.route.query

    if (redirect && Object.keys(queryParams).length) {
      const url = new URL(("https://" + redirect) as string)

      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value as string)
      })

      window.location.href = url.href
      return
    }

    this.signingInWithEmail = true

    try {
      await platform.auth.processMagicLink()
    } catch (e) {
      this.error = e.message
    } finally {
      this.signingInWithEmail = false
    }
  },
})
</script>

<route lang="yaml">
meta:
  layout: empty
  onlyGuest: true
</route>
