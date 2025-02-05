<template>
  <div class="flex flex-col items-center justify-between">
    <!-- Shortcodes are behind login on subdomain based cloud instances -->
    <template
      v-if="
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
          <HoppButtonPrimary
            :label="t('auth.login')"
            @click="invokeAction('modals.login.toggle')"
          />
        </template>
      </HoppSmartPlaceholder>

      <template v-else>
        <div
          v-if="invalidLink"
          class="flex flex-1 flex-col items-center justify-center"
        >
          <icon-lucide-alert-triangle class="svg-icons mb-2 opacity-75" />
          <h1 class="heading text-center">
            {{ t("error.invalid_link") }}
          </h1>

          <p class="mt-2 text-center">
            {{ t("error.invalid_link_description") }}
          </p>

          <p class="mt-4">
            <HoppButtonSecondary
              to="/"
              :icon="IconHome"
              filled
              :label="t('app.home')"
            />
          </p>
        </div>

        <div
          v-else
          class="flex flex-1 flex-col items-center justify-center p-4"
        >
          <div
            v-if="sharedRequestDetails.loading"
            class="flex flex-1 flex-col items-center justify-center p-4"
          >
            <HoppSmartSpinner />
          </div>

          <div v-else>
            <div
              v-if="
                !sharedRequestDetails.loading &&
                E.isLeft(sharedRequestDetails.data)
              "
              class="flex flex-col items-center p-4"
            >
              <icon-lucide-alert-triangle class="svg-icons mb-2 opacity-75" />
              <h1 class="heading text-center">
                {{ t("error.invalid_link") }}
              </h1>

              <p class="mt-2 text-center">
                {{ t("error.invalid_link_description") }}
              </p>

              <p class="mt-4">
                <HoppButtonSecondary
                  to="/"
                  :icon="IconHome"
                  filled
                  :label="t('app.home')"
                />
                <HoppButtonSecondary
                  :icon="IconRefreshCW"
                  :label="t('app.reload')"
                  filled
                  @click="reloadApplication"
                />
              </p>
            </div>

            <div
              v-if="
                !sharedRequestDetails.loading &&
                E.isRight(sharedRequestDetails.data)
              "
              class="flex flex-1 flex-col items-center justify-center p-4"
            >
              <h1 class="heading">
                {{ t("state.loading") }}
              </h1>
            </div>
          </div>
        </div>
      </template>
    </template>

    <template v-else>
      <div
        v-if="invalidLink"
        class="flex flex-1 flex-col items-center justify-center"
      >
        <icon-lucide-alert-triangle class="svg-icons mb-2 opacity-75" />
        <h1 class="heading text-center">
          {{ t("error.invalid_link") }}
        </h1>

        <p class="mt-2 text-center">
          {{ t("error.invalid_link_description") }}
        </p>

        <p class="mt-4">
          <HoppButtonSecondary
            to="/"
            :icon="IconHome"
            filled
            :label="t('app.home')"
          />
        </p>
      </div>

      <div v-else class="flex flex-1 flex-col items-center justify-center p-4">
        <div
          v-if="sharedRequestDetails.loading"
          class="flex flex-1 flex-col items-center justify-center p-4"
        >
          <HoppSmartSpinner />
        </div>

        <div v-else>
          <div
            v-if="
              !sharedRequestDetails.loading &&
              E.isLeft(sharedRequestDetails.data)
            "
            class="flex flex-col items-center p-4"
          >
            <icon-lucide-alert-triangle class="svg-icons mb-2 opacity-75" />
            <h1 class="heading text-center">
              {{ t("error.invalid_link") }}
            </h1>

            <p class="mt-2 text-center">
              {{ t("error.invalid_link_description") }}
            </p>

            <p class="mt-4">
              <HoppButtonSecondary
                to="/"
                :icon="IconHome"
                filled
                :label="t('app.home')"
              />
              <HoppButtonSecondary
                :icon="IconRefreshCW"
                :label="t('app.reload')"
                filled
                @click="reloadApplication"
              />
            </p>
          </div>

          <div
            v-if="
              !sharedRequestDetails.loading &&
              E.isRight(sharedRequestDetails.data)
            "
            class="flex flex-1 flex-col items-center justify-center p-4"
          >
            <h1 class="heading">
              {{ t("state.loading") }}
            </h1>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import * as E from "fp-ts/Either"
import { safelyExtractRESTRequest } from "@hoppscotch/data"
import { useGQLQuery } from "@composables/graphql"
import { useI18n } from "@composables/i18n"
import {
  ResolveShortcodeDocument,
  ResolveShortcodeQuery,
  ResolveShortcodeQueryVariables,
} from "~/helpers/backend/graphql"

import IconHome from "~icons/lucide/home"
import IconRefreshCW from "~icons/lucide/refresh-cw"
import { getDefaultRESTRequest } from "~/helpers/rest/default"
import { platform } from "~/platform"
import { RESTTabService } from "~/services/tab/rest"
import { useService } from "dioc/vue"
import { invokeAction } from "~/helpers/actions"
import { useColorMode } from "~/composables/theming"
import { useReadonlyStream } from "~/composables/stream"
import { until } from "@vueuse/core"

const route = useRoute()
const router = useRouter()

const t = useI18n()

const tabs = useService(RESTTabService)

const invalidLink = ref(false)
const sharedRequestID = ref("")

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

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)
const probableUser = useReadonlyStream(
  platform.auth.getProbableUserStream(),
  platform.auth.getProbableUser()
)

const colorMode = useColorMode()

const loadingCurrentUser = computed(() => {
  if (!probableUser.value) return false
  else if (!currentUser.value) return true
  return false
})

watch(
  () => currentUser.value,
  () => {
    if (typeof route.params.id === "string") {
      sharedRequestID.value = route.params.id
      sharedRequestDetails.execute()
    }
    invalidLink.value = !sharedRequestID.value
  }
)

watch(
  () => sharedRequestDetails.data,
  () => addRequestToTab()
)

const addRequestToTab = () => {
  if (sharedRequestDetails.loading) return

  const data = sharedRequestDetails.data

  if (E.isRight(data)) {
    if (!data.right.shortcode?.request) {
      invalidLink.value = true
      return
    }

    platform.analytics?.logEvent({
      type: "HOPP_SHORTCODE_RESOLVED",
    })

    const request: unknown = JSON.parse(data.right.shortcode?.request as string)

    tabs.createNewTab({
      type: "request",
      request: safelyExtractRESTRequest(request, getDefaultRESTRequest()),
      isDirty: false,
    })

    router.push({ path: "/" })
  }
}

const reloadApplication = () => {
  window.location.reload()
}

onMounted(async () => {
  const { organization } = platform

  if (organization && !organization.isDefaultCloudInstance) {
    await until(loadingCurrentUser).toMatch((val) => !val)

    if (!currentUser.value) {
      return
    }
  }

  if (typeof route.params.id === "string") {
    sharedRequestID.value = route.params.id
    sharedRequestDetails.execute()
  }
  invalidLink.value = !sharedRequestID.value
})
</script>
