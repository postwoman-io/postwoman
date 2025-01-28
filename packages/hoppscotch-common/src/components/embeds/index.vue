<template>
  <div
    v-if="pageLoading"
    class="flex flex-1 flex-col items-center justify-center p-4"
  >
    <HoppSmartSpinner class="mb-4" />
  </div>

  <!-- Shortcodes are behind login on subdomain based cloud instances -->
  <template
    v-else-if="
      platform.organization && !platform.organization.isDefaultCloudInstance
    "
  >
    <div
      v-if="loadingCurrentUser"
      class="flex flex-1 flex-col items-center justify-center p-4"
    >
      <HoppSmartSpinner class="mb-4" />
    </div>

    <HoppSmartPlaceholder
      v-else-if="currentUser === null"
      :src="`/images/states/${colorMode.value}/login.svg`"
      :alt="t('empty.shared_requests_logout')"
      :text="t('empty.shared_requests_logout')"
    >
      <template #body>
        <HoppButtonPrimary :label="t('auth.login')" @click="showLogin = true" />
      </template>
    </HoppSmartPlaceholder>

    <AppPaneLayout v-else layout-id="embed-primary" :is-embed="true">
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

    <FirebaseLogin v-if="showLogin" @hide-modal="showLogin = false" />
  </template>

  <AppPaneLayout v-else layout-id="embed-primary" :is-embed="true">
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
import { computed, onMounted, useModel } from "vue"
import { ref } from "vue"
import { HoppTab } from "~/services/tab"
import { useI18n } from "~/composables/i18n"
import { useReadonlyStream } from "~/composables/stream"
import { useColorMode } from "~/composables/theming"
import { HoppRequestDocument } from "~/helpers/rest/document"
import { platform } from "~/platform"
import { RESTOptionTabs } from "../http/RequestOptions.vue"

const props = defineProps<{
  modelTab: HoppTab<HoppRequestDocument>
  properties: RESTOptionTabs[]
  sharedRequestID: string
}>()

const tab = useModel(props, "modelTab")

const selectedOptionTab = ref<RESTOptionTabs>(props.properties[0])

const organizationDomain = ref<string>("")

const pageLoading = ref(false)
const showLogin = ref(false)

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)
const probableUser = useReadonlyStream(
  platform.auth.getProbableUserStream(),
  platform.auth.getProbableUser()
)

const t = useI18n()
const colorMode = useColorMode()

const loadingCurrentUser = computed(() => {
  if (!probableUser.value) return false
  else if (!currentUser.value) return true
  return false
})

onMounted(async () => {
  pageLoading.value = true

  const { organization } = platform

  if (!organization || organization.isDefaultCloudInstance) {
    pageLoading.value = false
    return
  }

  const orgInfo = await organization.getOrgInfo()

  if (orgInfo) {
    const { orgDomain } = orgInfo

    organizationDomain.value = orgDomain
  }

  pageLoading.value = false
})

const shortcodeBaseURL = computed(() => {
  const { organization } = platform

  if (!organization || organization.isDefaultCloudInstance) {
    return import.meta.env.VITE_SHORTCODE_BASE_URL ?? "https://hopp.sh"
  }

  const rootDomain = organization.getRootDomain()
  return `https://${organizationDomain.value}.${rootDomain}`
})

const sharedRequestURL = computed(() => {
  return `${shortcodeBaseURL.value}/r/${props.sharedRequestID}`
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
