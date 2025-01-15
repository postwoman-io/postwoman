<template>
  <div :class="{ 'rounded border border-divider': saveRequest }">
    <div
      class="sticky z-10 flex flex-shrink-0 flex-col overflow-x-auto rounded-t bg-primary"
      :style="
        saveRequest ? 'top: calc(-1 * var(--line-height-body))' : 'top: 0'
      "
    >
      <input
        v-model="filterText"
        type="search"
        autocomplete="off"
        :placeholder="t('action.search')"
        class="flex w-full bg-transparent px-4 py-2 h-8"
      />
      <div
        class="flex flex-1 flex-shrink-0 justify-between border-y border-dividerLight bg-primary"
      >
        <HoppButtonSecondary
          :icon="IconPlus"
          :label="t('action.new')"
          class="!rounded-none"
          @click="displayModalAdd(true)"
        />
        <div class="flex">
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            to="https://docs.hoppscotch.io/documentation/features/collections"
            blank
            :title="t('app.wiki')"
            :icon="IconHelpCircle"
          />
          <HoppButtonSecondary
            v-if="!saveRequest"
            v-tippy="{ theme: 'tooltip' }"
            :title="t('modal.import_export')"
            :icon="IconImport"
            @click="displayModalImportExport(true)"
          />
        </div>
      </div>
    </div>
    <div class="flex flex-col">
      <CollectionsGraphqlCollection
        v-for="(collection, index) in filteredCollections"
        :key="`collection-${index}`"
        :picked="picked"
        :name="collection.name"
        :collection-index="index"
        :collection="collection"
        :is-filtered="filterText.length > 0"
        :save-request="saveRequest"
        @edit-collection="editCollection(collection, index)"
        @add-request="addRequest($event)"
        @add-folder="addFolder($event)"
        @edit-folder="editFolder($event)"
        @duplicate-collection="duplicateCollection($event)"
        @edit-request="editRequest($event)"
        @duplicate-request="duplicateRequest($event)"
        @select-collection="$emit('use-collection', collection)"
        @edit-properties="editProperties($event)"
        @select="$emit('select', $event)"
        @select-request="selectRequest($event)"
        @drop-request="dropRequest($event)"
      />
    </div>
    <HoppSmartPlaceholder
      v-if="collections.length === 0"
      :src="`/images/states/${colorMode.value}/pack.svg`"
      :alt="`${t('empty.collections')}`"
      :text="t('empty.collections')"
    >
      <template #body>
        <div class="flex flex-col items-center space-y-4">
          <span class="text-center text-secondaryLight">
            {{ t("collection.import_or_create") }}
          </span>
          <div class="flex flex-col items-stretch gap-4">
            <HoppButtonPrimary
              :icon="IconImport"
              :label="t('import.title')"
              filled
              outline
              @click="displayModalImportExport(true)"
            />
            <HoppButtonSecondary
              :label="t('add.new')"
              filled
              outline
              :icon="IconPlus"
              @click="displayModalAdd(true)"
            />
          </div>
        </div>
      </template>
    </HoppSmartPlaceholder>
    <HoppSmartPlaceholder
      v-if="!(filteredCollections.length !== 0 || collections.length === 0)"
      :text="`${t('state.nothing_found')} ‟${filterText}”`"
    >
      <template #icon>
        <icon-lucide-search class="svg-icons opacity-75" />
      </template>
    </HoppSmartPlaceholder>
    <CollectionsGraphqlAdd
      :show="showModalAdd"
      @hide-modal="displayModalAdd(false)"
    />
    <CollectionsGraphqlEdit
      :show="showModalEdit"
      :editing-collection="editingCollection"
      :editing-collection-index="editingCollectionIndex"
      :editing-collection-name="editingCollection ? editingCollection.name : ''"
      @hide-modal="displayModalEdit(false)"
    />
    <CollectionsGraphqlAddRequest
      :show="showModalAddRequest"
      :folder-path="editingFolderPath"
      :request-context="requestContext"
      @add-request="onAddRequest($event)"
      @hide-modal="displayModalAddRequest(false)"
    />
    <CollectionsGraphqlAddFolder
      :show="showModalAddFolder"
      :folder-path="editingFolderPath"
      @add-folder="onAddFolder($event)"
      @hide-modal="displayModalAddFolder(false)"
    />
    <CollectionsGraphqlEditFolder
      :show="showModalEditFolder"
      :collection-index="editingCollectionIndex"
      :folder="editingFolder"
      :folder-index="editingFolderIndex"
      :folder-path="editingFolderPath"
      :editing-folder-name="editingFolder ? editingFolder.name : ''"
      @hide-modal="displayModalEditFolder(false)"
    />
    <CollectionsGraphqlEditRequest
      :show="showModalEditRequest"
      :folder-path="editingFolderPath"
      :request="editingRequest"
      :request-index="editingRequestIndex"
      :request-context="editingRequest"
      :editing-request-name="editingRequest ? editingRequest.name : ''"
      @hide-modal="displayModalEditRequest(false)"
    />
    <CollectionsGraphqlImportExport
      v-if="showModalImportExport"
      @hide-modal="displayModalImportExport(false)"
    />
    <CollectionsProperties
      v-model="collectionPropertiesModalActiveTab"
      :show="showModalEditProperties"
      :editing-properties="editingProperties"
      source="GraphQL"
      @hide-modal="displayModalEditProperties(false)"
      @set-collection-properties="setCollectionProperties"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue"
import { clone, cloneDeep } from "lodash-es"
import {
  graphqlCollections$,
  addGraphqlFolder,
  saveGraphqlRequestAs,
  cascadeParentCollectionForHeaderAuth,
  editGraphqlCollection,
  editGraphqlFolder,
  moveGraphqlRequest,
  duplicateGraphQLCollection,
} from "~/newstore/collections"
import IconPlus from "~icons/lucide/plus"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconImport from "~icons/lucide/folder-down"
import { useI18n } from "@composables/i18n"
import { useReadonlyStream } from "@composables/stream"
import { useColorMode } from "@composables/theming"
import { platform } from "~/platform"
import { useService } from "dioc/vue"
import { GQLTabService } from "~/services/tab/graphql"
import { computed } from "vue"
import { HoppCollection, HoppGQLRequest } from "@hoppscotch/data"
import { Picked } from "~/helpers/types/HoppPicked"
import { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { updateInheritedPropertiesForAffectedRequests } from "~/helpers/collection/collection"
import { useToast } from "~/composables/toast"
import { getRequestsByPath } from "~/helpers/collection/request"
import { PersistenceService } from "~/services/persistence"
import { PersistedOAuthConfig } from "~/services/oauth/oauth.service"
import { GQLOptionTabs } from "~/components/graphql/RequestOptions.vue"
import { EditingProperties } from "../Properties.vue"
import { defineActionHandler } from "~/helpers/actions"

const t = useI18n()
const toast = useToast()

defineProps<{
  // Whether to activate the ability to pick items (activates 'select' events)
  saveRequest: boolean
  picked: Picked | null
}>()

const collections = useReadonlyStream(graphqlCollections$, [], "deep")
const colorMode = useColorMode()
const tabs = useService(GQLTabService)

const showModalAdd = ref(false)
const showModalEdit = ref(false)
const showModalImportExport = ref(false)
const showModalAddRequest = ref(false)
const showModalAddFolder = ref(false)
const showModalEditFolder = ref(false)
const showModalEditRequest = ref(false)
const showModalEditProperties = ref(false)

const editingCollection = ref<HoppCollection | null>(null)
const editingCollectionIndex = ref<number | null>(null)
const editingFolder = ref<HoppCollection | null>(null)
const editingFolderName = ref("")
const editingFolderIndex = ref<number | null>(null)
const editingFolderPath = ref("")
const editingRequest = ref<HoppGQLRequest | null>(null)
const editingRequestIndex = ref<number | null>(null)

const editingProperties = ref<{
  collection: Partial<HoppCollection> | null
  isRootCollection: boolean
  path: string
  inheritedProperties?: HoppInheritedProperty
}>({
  collection: null,
  isRootCollection: false,
  path: "",
  inheritedProperties: undefined,
})

const filterText = ref("")

const persistenceService = useService(PersistenceService)

const collectionPropertiesModalActiveTab = ref<GQLOptionTabs>("headers")

onMounted(() => {
  const localOAuthTempConfig =
    persistenceService.getLocalConfig("oauth_temp_config")

  if (!localOAuthTempConfig) {
    return
  }

  const { context, source, token, refresh_token }: PersistedOAuthConfig =
    JSON.parse(localOAuthTempConfig)

  if (source === "REST") {
    return
  }

  if (context?.type === "collection-properties") {
    // load the unsaved editing properties
    const unsavedCollectionPropertiesString = persistenceService.getLocalConfig(
      "unsaved_collection_properties"
    )

    if (unsavedCollectionPropertiesString) {
      const unsavedCollectionProperties: EditingProperties = JSON.parse(
        unsavedCollectionPropertiesString
      )

      const auth = unsavedCollectionProperties.collection?.auth

      if (auth?.authType === "oauth-2") {
        const grantTypeInfo = auth.grantTypeInfo

        grantTypeInfo && (grantTypeInfo.token = token ?? "")

        if (refresh_token && grantTypeInfo.grantType === "AUTHORIZATION_CODE") {
          grantTypeInfo.refreshToken = refresh_token
        }
      }

      editingProperties.value = unsavedCollectionProperties
    }

    persistenceService.removeLocalConfig("oauth_temp_config")
    collectionPropertiesModalActiveTab.value = "authorization"
    showModalEditProperties.value = true
  }
})

const filteredCollections = computed(() => {
  const collectionsClone = clone(collections.value)

  if (!filterText.value) return collectionsClone

  const filterTextLower = filterText.value.toLowerCase()
  const filteredCollections = []

  for (const collection of collectionsClone) {
    const filteredRequests = []
    const filteredFolders = []

    for (const request of collection.requests) {
      if (request.name.toLowerCase().includes(filterTextLower))
        filteredRequests.push(request)
    }

    for (const folder of collection.folders) {
      const filteredFolderRequests = []
      for (const request of folder.requests) {
        if (request.name.toLowerCase().includes(filterTextLower))
          filteredFolderRequests.push(request)
      }
      if (filteredFolderRequests.length > 0) {
        const filteredFolder = { ...folder }
        filteredFolder.requests = filteredFolderRequests
        filteredFolders.push(filteredFolder)
      }
    }

    if (filteredRequests.length + filteredFolders.length > 0) {
      const filteredCollection = { ...collection }
      filteredCollection.requests = filteredRequests
      filteredCollection.folders = filteredFolders
      filteredCollections.push(filteredCollection)
    }
  }

  return filteredCollections
})

const requestContext = computed(() => {
  return tabs.currentActiveTab.value.document.request
})

const displayModalAdd = (shouldDisplay: boolean) => {
  showModalAdd.value = shouldDisplay
}

const displayModalEdit = (shouldDisplay: boolean) => {
  showModalEdit.value = shouldDisplay

  if (!shouldDisplay) resetSelectedData()
}

const displayModalImportExport = (shouldDisplay: boolean) => {
  showModalImportExport.value = shouldDisplay
}

const displayModalAddRequest = (shouldDisplay: boolean) => {
  showModalAddRequest.value = shouldDisplay

  if (!shouldDisplay) resetSelectedData()
}

const displayModalAddFolder = (shouldDisplay: boolean) => {
  showModalAddFolder.value = shouldDisplay

  if (!shouldDisplay) resetSelectedData()
}

const displayModalEditFolder = (shouldDisplay: boolean) => {
  showModalEditFolder.value = shouldDisplay

  if (!shouldDisplay) resetSelectedData()
}

const displayModalEditRequest = (shouldDisplay: boolean) => {
  showModalEditRequest.value = shouldDisplay

  if (!shouldDisplay) resetSelectedData()
}

const displayModalEditProperties = (show: boolean) => {
  showModalEditProperties.value = show

  if (!show) resetSelectedData()
}

const editCollection = (
  collection: HoppCollection,
  collectionIndex: number
) => {
  editingCollection.value = collection
  editingCollectionIndex.value = collectionIndex
  displayModalEdit(true)
}

const duplicateCollection = ({
  path,
  collectionSyncID,
}: {
  path: string
  collectionSyncID?: string
}) => duplicateGraphQLCollection(path, collectionSyncID)

const onAddRequest = ({ name, path }: { name: string; path: string }) => {
  const newRequest = {
    ...tabs.currentActiveTab.value.document.request,
    name,
  }

  const insertionIndex = saveGraphqlRequestAs(path, newRequest)

  const { auth, headers } = cascadeParentCollectionForHeaderAuth(
    path,
    "graphql"
  )

  tabs.createNewTab({
    saveContext: {
      originLocation: "user-collection",
      folderPath: path,
      requestIndex: insertionIndex,
    },
    request: newRequest,
    isDirty: false,
    inheritedProperties: {
      auth,
      headers,
    },
  })

  platform.analytics?.logEvent({
    type: "HOPP_SAVE_REQUEST",
    platform: "gql",
    createdNow: true,
    workspaceType: "personal",
  })

  displayModalAddRequest(false)
}

const addRequest = (payload: { path: string }) => {
  const { path } = payload
  editingFolderPath.value = path
  displayModalAddRequest(true)
}

const onAddFolder = ({
  name,
  path,
}: {
  name: string
  path: string | undefined
}) => {
  addGraphqlFolder(name, path ?? "0")

  platform.analytics?.logEvent({
    type: "HOPP_CREATE_COLLECTION",
    isRootCollection: false,
    platform: "gql",
    workspaceType: "personal",
  })

  displayModalAddFolder(false)
}

const addFolder = (payload: { path: string }) => {
  const { path } = payload
  editingFolderPath.value = path
  displayModalAddFolder(true)
}

const editFolder = (payload: {
  folder: HoppCollection
  folderPath: string
}) => {
  const { folder, folderPath } = payload
  editingFolder.value = folder
  editingFolderPath.value = folderPath
  displayModalEditFolder(true)
}

const editRequest = (payload: {
  collectionIndex: number
  folderIndex: number
  folderName: string
  request: HoppGQLRequest
  requestIndex: number
  folderPath: string
}) => {
  const {
    collectionIndex,
    folderIndex,
    folderName,
    request,
    requestIndex,
    folderPath,
  } = payload
  editingFolderPath.value = folderPath
  editingCollectionIndex.value = collectionIndex
  editingFolderIndex.value = folderIndex
  editingFolderName.value = folderName
  editingRequest.value = request
  editingRequestIndex.value = requestIndex
  displayModalEditRequest(true)
}

const duplicateRequest = ({
  folderPath,
  request,
}: {
  folderPath: string
  request: HoppGQLRequest
}) => {
  saveGraphqlRequestAs(folderPath, {
    ...cloneDeep(request),
    name: `${request.name} - ${t("action.duplicate")}`,
  })
}

const selectRequest = ({
  request,
  folderPath,
  requestIndex,
}: {
  request: HoppGQLRequest
  folderPath: string
  requestIndex: number
}) => {
  const possibleTab = tabs.getTabRefWithSaveContext({
    originLocation: "user-collection",
    folderPath: folderPath,
    requestIndex: requestIndex,
  })
  const { auth, headers } = cascadeParentCollectionForHeaderAuth(
    folderPath,
    "graphql"
  )
  // Switch to that request if that request is open
  if (possibleTab) {
    tabs.setActiveTab(possibleTab.value.id)
    return
  }
  tabs.createNewTab({
    saveContext: {
      originLocation: "user-collection",
      folderPath: folderPath,
      requestIndex: requestIndex,
    },
    request: cloneDeep(request),
    isDirty: false,
    inheritedProperties: {
      auth,
      headers,
    },
  })
}

const dropRequest = ({
  folderPath,
  requestIndex,
  collectionIndex,
}: {
  folderPath: string
  requestIndex: number
  collectionIndex: number
}) => {
  const { auth, headers } = cascadeParentCollectionForHeaderAuth(
    `${collectionIndex}`,
    "graphql"
  )

  const possibleTab = tabs.getTabRefWithSaveContext({
    originLocation: "user-collection",
    folderPath,
    requestIndex: Number(requestIndex),
  })

  if (possibleTab) {
    possibleTab.value.document.saveContext = {
      originLocation: "user-collection",
      folderPath: `${collectionIndex}`,
      requestIndex: getRequestsByPath(collections.value, `${collectionIndex}`)
        .length,
    }

    possibleTab.value.document.inheritedProperties = {
      auth,
      headers,
    }
  }

  moveGraphqlRequest(folderPath, requestIndex, `${collectionIndex}`)

  toast.success(`${t("request.moved")}`)
}

/**
 * Checks if the collection is already in the root
 * @param id - path of the collection
 * @returns boolean - true if the collection is already in the root
 */
const isAlreadyInRoot = (id: string) => {
  const indexPath = id.split("/")
  return indexPath.length === 1
}

const editProperties = ({
  collectionIndex,
  collection,
}: {
  collectionIndex: string | null
  collection: HoppCollection | null
}) => {
  if (collectionIndex === null || collection === null) return

  const parentIndex = collectionIndex.split("/").slice(0, -1).join("/") // remove last folder to get parent folder
  let inheritedProperties = undefined

  if (parentIndex) {
    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      parentIndex,
      "graphql"
    )

    inheritedProperties = {
      auth,
      headers,
    }
  }

  editingProperties.value = {
    collection,
    isRootCollection: isAlreadyInRoot(collectionIndex),
    path: collectionIndex,
    inheritedProperties,
  }

  displayModalEditProperties(true)
}

const setCollectionProperties = (newCollection: {
  collection: Partial<HoppCollection> | null
  path: string
  isRootCollection: boolean
}) => {
  const { collection, path, isRootCollection } = newCollection
  if (!collection) {
    return
  }

  if (isRootCollection) {
    editGraphqlCollection(parseInt(path), collection)
  } else {
    editGraphqlFolder(path, collection)
  }

  const { auth, headers } = cascadeParentCollectionForHeaderAuth(
    path,
    "graphql"
  )

  nextTick(() => {
    updateInheritedPropertiesForAffectedRequests(
      path,
      {
        auth,
        headers,
      },
      "graphql"
    )
  })

  displayModalEditProperties(false)
}
const resetSelectedData = () => {
  editingCollection.value = null
  editingCollectionIndex.value = null
  editingFolder.value = null
  editingFolderIndex.value = null
  editingRequest.value = null
  editingRequestIndex.value = null
}

defineActionHandler("collection.new", () => {
  displayModalAdd(true)
})
defineActionHandler("modals.collection.import", () => {
  displayModalImportExport(true)
})
</script>
