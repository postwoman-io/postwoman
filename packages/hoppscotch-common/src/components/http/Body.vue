<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky top-upperMobileSecondaryStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4 sm:top-upperSecondaryStickyFold"
    >
      <span class="flex items-center">
        <label class="truncate font-semibold text-secondaryLight">
          {{ t("request.content_type") }}
        </label>
        <tippy
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => tippyActions.focus()"
        >
          <HoppSmartSelectWrapper>
            <HoppButtonSecondary
              :label="body.contentType || t('state.none')"
              class="ml-2 rounded-none pr-8"
            />
          </HoppSmartSelectWrapper>
          <template #content="{ hide }">
            <div
              ref="tippyActions"
              class="flex flex-col space-y-2 divide-y divide-dividerLight focus:outline-none"
              tabindex="0"
              @keyup.escape="hide()"
            >
              <HoppSmartItem
                :label="t('state.none')"
                :info-icon="
                  (body.contentType === null ? IconDone : null) as any
                "
                :active-info-icon="body.contentType === null"
                @click="
                  () => {
                    body.contentType = null
                    body.body = null
                    hide()
                  }
                "
              />
              <div
                v-for="(
                  contentTypeItems, contentTypeItemsIndex
                ) in segmentedContentTypes"
                :key="`contentTypeItems-${contentTypeItemsIndex}`"
                class="flex flex-col text-left"
              >
                <div class="flex rounded px-4 py-2">
                  <span class="text-tiny font-bold text-secondaryLight">
                    {{ t(contentTypeItems.title) }}
                  </span>
                </div>
                <div class="flex flex-col">
                  <HoppSmartItem
                    v-for="(
                      contentTypeItem, contentTypeIndex
                    ) in contentTypeItems.contentTypes"
                    :key="`contentTypeItem-${contentTypeIndex}`"
                    :label="contentTypeItem"
                    :info-icon="
                      contentTypeItem === body.contentType
                        ? IconDone
                        : undefined
                    "
                    :active-info-icon="contentTypeItem === body.contentType"
                    @click="updateContentType(contentTypeItem, hide)"
                  />
                </div>
              </div>
            </div>
          </template>
        </tippy>
        <AppInspection :inspection-results="tabResults" />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="t('request.override_help')"
          :label="
            overridenContentType
              ? `${t('request.overriden')}: ${overridenContentType}`
              : t('request.override')
          "
          :icon="overridenContentType ? IconInfo : IconRefreshCW"
          :class="[
            '!px-1 !py-0.5',
            {
              'text-yellow-500 hover:text-yellow-500': overridenContentType,
            },
          ]"
          filled
          outline
          @click="contentTypeOverride('headers')"
        />
      </span>
    </div>
    <HttpBodyParameters
      v-if="body.contentType === 'multipart/form-data'"
      v-model="body"
      :envs="envs"
    />
    <HttpURLEncodedParams
      v-else-if="body.contentType === 'application/x-www-form-urlencoded'"
      v-model="body"
      :envs="envs"
    />
    <HttpBodyBinary
      v-else-if="body.contentType === 'application/octet-stream'"
      v-model="body"
    />
    <HttpRawBody v-else-if="body.contentType !== null" v-model="body" />
    <HoppSmartPlaceholder
      v-if="body.contentType == null"
      :src="`/images/states/${colorMode.value}/upload_single_file.svg`"
      :alt="`${t('empty.body')}`"
      :text="t('empty.body')"
    >
      <template #body>
        <HoppButtonSecondary
          outline
          :label="`${t('app.documentation')}`"
          to="https://docs.hoppscotch.io/documentation/getting-started/rest/uploading-data"
          blank
          :icon="IconExternalLink"
          reverse
        />
      </template>
    </HoppSmartPlaceholder>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useColorMode } from "@composables/theming"
import { HoppRESTHeader, HoppRESTReqBody } from "@hoppscotch/data"
import { useVModel } from "@vueuse/core"
import * as A from "fp-ts/Array"
import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import { computed, ref } from "vue"
import { segmentedContentTypes } from "~/helpers/utils/contenttypes"
import IconDone from "~icons/lucide/check"
import IconExternalLink from "~icons/lucide/external-link"
import IconInfo from "~icons/lucide/info"
import IconRefreshCW from "~icons/lucide/refresh-cw"
import { RESTOptionTabs } from "./RequestOptions.vue"
import { AggregateEnvironment } from "~/newstore/environments"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import { InspectionService } from "~/services/inspection"

const colorMode = useColorMode()
const t = useI18n()

const props = defineProps<{
  body: HoppRESTReqBody
  headers: HoppRESTHeader[]
  envs?: AggregateEnvironment[]
}>()

const emit = defineEmits<{
  (e: "change-tab", value: RESTOptionTabs): void
  (e: "update:headers", value: HoppRESTHeader[]): void
  (e: "update:body", value: HoppRESTReqBody): void
}>()

const headers = useVModel(props, "headers", emit)
const body = useVModel(props, "body", emit)

const overridenContentType = computed(() =>
  pipe(
    headers.value,
    A.findLast((h) => h.key.toLowerCase() === "content-type" && h.active),
    O.map((h) => h.value),
    O.getOrElse(() => "")
  )
)

const contentTypeOverride = (tab: RESTOptionTabs) => {
  emit("change-tab", tab)
  if (!isContentTypeAlreadyExist()) {
    // TODO: Fix this

    headers.value.push({
      key: "Content-Type",
      value: "",
      active: true,
      description: "",
    })
  }
}

const isContentTypeAlreadyExist = () => {
  return pipe(
    headers.value,
    A.some((e) => e.key.toLowerCase() === "content-type")
  )
}

const updateContentType = (contentTypeItem, hide) => {
  if (contentTypeItem === 'none') {
    body.contentType = null
    headers.value = headers.value.filter(header => header.key.toLowerCase() !== 'content-type');
  } else {
    body.contentType = contentTypeItem
  }
  hide()
}

// Template refs
const tippyActions = ref<any | null>(null)

const tabs = useService(RESTTabService)
const inspectionService = useService(InspectionService)

const tabResults = inspectionService.getResultViewFor(
  tabs.currentTabID.value,
  (result) => result.locations.type === "body-content-type-header"
)
</script>
