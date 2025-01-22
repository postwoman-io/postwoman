<template>
  <div class="flex flex-col justify-center h-screen">
    <div
      v-if="sharedRequestDetails.loading"
      class="flex justify-center items-center py-5"
    >
      <HoppSmartSpinner />
    </div>

    <div
      v-else-if="E.isLeft(sharedRequestDetails.data) || invalidLink"
      class="flex flex-1 flex-col items-center justify-center p-8"
    >
      <icon-lucide-alert-triangle class="svg-icons mb-2 opacity-75" />
      <h1 class="heading text-center">
        {{ t("error.invalid_link") }}
      </h1>
      <p class="mt-2 text-center">
        {{ t("error.invalid_embed_link") }}
      </p>
    </div>

    <Embeds
      v-else-if="tab"
      v-model:model-tab="tab"
      :properties="properties"
      :shared-request-i-d="sharedRequestID"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { watch } from "vue"
import { useRoute } from "vue-router"
import { useGQLQuery } from "~/composables/graphql"
import {
  ResolveShortcodeDocument,
  ResolveShortcodeQuery,
  ResolveShortcodeQueryVariables,
} from "~/helpers/backend/graphql"
import * as E from "fp-ts/Either"
import { onMounted } from "vue"
import {
  getDefaultRESTRequest,
  safelyExtractRESTRequest,
} from "@hoppscotch/data"
import { HoppTab } from "~/services/tab"
import { HoppRequestDocument } from "~/helpers/rest/document"
import { applySetting } from "~/newstore/settings"
import { useI18n } from "~/composables/i18n"

const t = useI18n()

const route = useRoute()

const sharedRequestID = ref("")
const invalidLink = ref(false)
const properties = ref([])

const sharedRequestDetails = useGQLQuery<
  ResolveShortcodeQuery,
  ResolveShortcodeQueryVariables,
  ""
>({
  query: ResolveShortcodeDocument,
  variables: {
    code: route.params.id.toString(),
  },
})

const tab = ref<HoppTab<HoppRequestDocument>>({
  id: "0",
  document: {
    request: getDefaultRESTRequest(),
    response: null,
    isDirty: false,
    type: "request",
  },
})

watch(
  () => sharedRequestDetails.data,
  () => {
    if (sharedRequestDetails.loading) return

    const data = sharedRequestDetails.data

    if (E.isRight(data)) {
      if (!data.right.shortcode?.request) {
        invalidLink.value = true
        return
      }

      const request: unknown = JSON.parse(
        data.right.shortcode?.request as string
      )

      tab.value.document.request = safelyExtractRESTRequest(
        request,
        getDefaultRESTRequest()
      )

      if (data.right.shortcode && data.right.shortcode.properties) {
        const parsedProperties = JSON.parse(data.right.shortcode.properties)
        if (parsedProperties.theme === "dark") {
          applySetting("BG_COLOR", "dark")
        } else if (parsedProperties.theme === "light") {
          applySetting("BG_COLOR", "light")
        } else if (parsedProperties.theme === "system") {
          applySetting("BG_COLOR", "system")
        }
        properties.value = parsedProperties.options
      }
    }
  }
)

onMounted(() => {
  if (typeof route.params.id === "string") {
    sharedRequestID.value = route.params.id
    sharedRequestDetails.execute()
  }
  invalidLink.value = !sharedRequestID.value
})
</script>

<route lang="yaml">
meta:
  layout: empty
</route>
