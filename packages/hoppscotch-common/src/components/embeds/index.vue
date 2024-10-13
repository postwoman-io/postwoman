<template>
  <AppPaneLayout layout-id="embed-primary" :is-embed="true">
    <template #primary>
      <EmbedsHeader :shared-request-u-r-l="sharedRequestURL" />
      <div class="flex flex-col flex-1">
        <EmbedsRequest
          :model-tab="modelTab"
          :shared-request-u-r-l="sharedRequestURL"
        />
        <div class="flex flex-col flex-1">
          <HttpRequestOptions
            v-model="tab.document.request"
            v-model:option-tab="selectedOptionTab"
            :properties="properties"
            :envs="tabRequestVariables"
          />
        </div>
      </div>
    </template>
    <template #secondary>
      <HttpResponse :document="tab.document" :is-embed="true" />
    </template>
  </AppPaneLayout>
</template>

<script lang="ts" setup>
import { computed, useModel } from "vue"
import { ref } from "vue"
import { HoppTab } from "~/services/tab"
import { HoppRequestDocument } from "~/helpers/rest/document"
import { RESTOptionTabs } from "../http/RequestOptions.vue"

const props = defineProps<{
  modelTab: HoppTab<HoppRequestDocument>
  properties: RESTOptionTabs[]
  sharedRequestID: string
}>()

const tab = useModel(props, "modelTab")

const selectedOptionTab = ref<RESTOptionTabs>(props.properties[0])

const shortcodeBaseURL =
  import.meta.env.VITE_SHORTCODE_BASE_URL ?? "https://hopp.sh"

const sharedRequestURL = computed(() => {
  return `${shortcodeBaseURL}/r/${props.sharedRequestID}`
})

const tabRequestVariables = computed(() => {
  return tab.value.document.request.requestVariables.map(({ key, value }) => ({
    key,
    value,
    secret: false,
    sourceEnv: "RequestVariable",
  }))
})
</script>
