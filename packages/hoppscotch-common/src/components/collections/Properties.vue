<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('collection.properties')"
    :full-width-body="true"
    styles="sm:max-w-2xl"
    @close="hideModal"
  >
    <template #body>
      <HoppSmartTabs
        v-model="activeTab"
        styles="sticky overflow-x-auto flex-shrink-0 bg-primary top-0 z-10 !-py-4"
        render-inactive-tabs
      >
        <HoppSmartTab id="headers" :label="`${t('tab.headers')}`">
          <HttpHeaders
            v-model="editableCollection"
            :is-collection-property="true"
            @change-tab="changeOptionTab"
          />
          <div
            class="bg-bannerInfo px-4 py-2 flex items-center sticky bottom-0"
          >
            <icon-lucide-info class="svg-icons mr-2" />
            {{ t("helpers.collection_properties_header") }}
          </div>
        </HoppSmartTab>

        <HoppSmartTab id="authorization" :label="`${t('tab.authorization')}`">
          <HttpAuthorization
            v-model="editableCollection.auth"
            :is-collection-property="true"
            :is-root-collection="editingProperties.isRootCollection"
            :inherited-properties="editingProperties.inheritedProperties"
            :source="source"
          />
          <div
            class="bg-bannerInfo px-4 py-2 flex items-center sticky bottom-0"
          >
            <icon-lucide-info class="svg-icons mr-2" />
            {{ t("helpers.collection_properties_authorization") }}
          </div>
        </HoppSmartTab>

        <HoppSmartTab
          v-if="showDetails"
          :id="'details'"
          :label="t('collection.details')"
        >
          <div
            class="flex flex-shrink-0 items-center justify-between border-b border-dividerLight bg-primary pl-4"
          >
            <span>{{ t("collection_runner.collection_id") }}</span>

            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              to="https://docs.hoppscotch.io/documentation/clients/cli/overview#running-collections-present-on-the-api-client"
              blank
              :title="t('app.wiki')"
              :icon="IconHelpCircle"
            />
          </div>

          <div class="p-4">
            <div
              class="flex items-center justify-between py-2 px-4 rounded-md bg-primaryLight select-text"
            >
              <div class="text-secondaryDark">
                {{ editingProperties.path }}
              </div>

              <HoppButtonSecondary
                filled
                :icon="copyIcon"
                @click="copyCollectionID"
              />
            </div>
          </div>

          <div
            class="bg-bannerInfo px-4 py-2 flex items-center sticky bottom-0"
          >
            <icon-lucide-info class="svg-icons mr-2" />
            {{ t("collection_runner.cli_collection_id_description") }}
          </div>
        </HoppSmartTab>
      </HoppSmartTabs>
    </template>
    <template #footer>
      <div class="flex gap-x-2">
        <HoppButtonPrimary
          v-if="activeTabIsDetails"
          :label="t('action.copy')"
          :icon="copyIcon"
          outline
          filled
          @click="copyCollectionID"
        />
        <HoppButtonPrimary
          v-else
          :label="t('action.save')"
          :loading="loadingState"
          outline
          @click="saveEditedCollection"
        />

        <HoppButtonSecondary
          :label="activeTabIsDetails ? t('action.close') : t('action.cancel')"
          outline
          filled
          @click="hideModal"
        />
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import {
  GQLHeader,
  HoppCollection,
  HoppGQLAuth,
  HoppRESTAuth,
  HoppRESTHeaders,
} from "@hoppscotch/data"
import { refAutoReset, useVModel } from "@vueuse/core"
import { useService } from "dioc/vue"
import { clone } from "lodash-es"
import { computed, ref, watch } from "vue"
import { useToast } from "~/composables/toast"

import { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { copyToClipboard } from "~/helpers/utils/clipboard"
import { PersistenceService } from "~/services/persistence"
import IconCheck from "~icons/lucide/check"
import IconCopy from "~icons/lucide/copy"
import IconHelpCircle from "~icons/lucide/help-circle"
import { RESTOptionTabs } from "../http/RequestOptions.vue"

const persistenceService = useService(PersistenceService)
const t = useI18n()

export type EditingProperties = {
  collection: Partial<HoppCollection> | null
  isRootCollection: boolean
  path: string
  inheritedProperties?: HoppInheritedProperty
}

type HoppCollectionAuth = HoppRESTAuth | HoppGQLAuth
type HoppCollectionHeaders = HoppRESTHeaders | GQLHeader[]

const toast = useToast()

const props = withDefaults(
  defineProps<{
    show: boolean
    loadingState: boolean
    editingProperties: EditingProperties
    source: "REST" | "GraphQL"
    modelValue: string
    showDetails: boolean
  }>(),
  {
    show: false,
    loadingState: false,
    showDetails: false,
  }
)

const emit = defineEmits<{
  (
    e: "set-collection-properties",
    newCollection: Omit<EditingProperties, "inheritedProperties">
  ): void
  (e: "hide-modal"): void
  (e: "update:modelValue"): void
}>()

const editableCollection = ref<{
  headers: HoppCollectionHeaders
  auth: HoppCollectionAuth
}>({
  headers: [],
  auth: {
    authType: "inherit",
    authActive: false,
  },
})

const copyIcon = refAutoReset<typeof IconCopy | typeof IconCheck>(
  IconCopy,
  1000
)

const activeTabIsDetails = computed(() => activeTab.value === "details")

watch(
  editableCollection,
  async (updatedEditableCollection) => {
    if (props.show && props.editingProperties) {
      const unsavedCollectionProperties: EditingProperties = {
        collection: updatedEditableCollection,
        isRootCollection: props.editingProperties.isRootCollection ?? false,
        path: props.editingProperties.path,
        inheritedProperties: props.editingProperties.inheritedProperties,
      }
      await persistenceService.setLocalConfig(
        "unsaved_collection_properties",
        JSON.stringify(unsavedCollectionProperties)
      )
    }
  },
  {
    deep: true,
  }
)

const activeTab = useVModel(props, "modelValue", emit)

watch(
  () => props.show,
  async (show) => {
    // `Details` tab doesn't exist for personal workspace, hence switching to the `Headers` tab
    // The modal can appear empty while switching from a team workspace with `Details` as the active tab
    if (activeTab.value === "details" && !props.showDetails) {
      activeTab.value = "headers"
    }

    if (show && props.editingProperties.collection) {
      editableCollection.value.auth = clone(
        props.editingProperties.collection.auth as HoppCollectionAuth
      )
      editableCollection.value.headers = clone(
        props.editingProperties.collection.headers as HoppCollectionHeaders
      )
    } else {
      editableCollection.value = {
        headers: [],
        auth: {
          authType: "inherit",
          authActive: false,
        },
      }

      await persistenceService.removeLocalConfig(
        "unsaved_collection_properties"
      )
    }
  }
)

const saveEditedCollection = async () => {
  if (!props.editingProperties) return
  const finalCollection = clone(editableCollection.value)
  const collection = {
    path: props.editingProperties.path,
    collection: {
      ...props.editingProperties.collection,
      ...finalCollection,
    },
    isRootCollection: props.editingProperties.isRootCollection,
  }
  emit("set-collection-properties", collection as EditingProperties)
  await persistenceService.removeLocalConfig("unsaved_collection_properties")
}

const hideModal = async () => {
  await persistenceService.removeLocalConfig("unsaved_collection_properties")
  emit("hide-modal")
}

const changeOptionTab = (e: RESTOptionTabs) => {
  activeTab.value = e
}

const copyCollectionID = () => {
  copyToClipboard(props.editingProperties.path)
  copyIcon.value = IconCheck

  toast.success(`${t("state.copied_to_clipboard")}`)
}
</script>
