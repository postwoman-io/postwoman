<template>
  <div
    :class="{
      'rounded border border-divider': saveRequest,
      'bg-primaryDark':
        draggingToRoot && currentReorderingStatus.type !== 'request',
    }"
    class="flex-1"
    @drop.prevent="dropToRoot"
    @dragover.prevent="draggingToRoot = true"
    @dragend="draggingToRoot = false"
  >
    <div
      class="sticky z-10 flex flex-shrink-0 flex-col overflow-x-auto bg-primary border-b border-dividerLight"
      :class="{ 'rounded-t': saveRequest }"
      :style="
        saveRequest ? 'top: calc(-1 * var(--line-height-body))' : 'top: 0'
      "
    >
      <WorkspaceCurrent :section="t('tab.collections')" />
      <input
        v-model="filterTexts"
        type="search"
        autocomplete="off"
        class="flex w-full bg-transparent px-4 py-2 h-8"
        :placeholder="t('action.search')"
      />
    </div>
    <CollectionsMyCollections
      v-if="collectionsType.type === 'my-collections'"
      :collections-type="collectionsType"
      :filtered-collections="filteredCollections"
      :filter-text="filterTexts"
      :save-request="saveRequest"
      :picked="picked"
      @add-folder="addFolder"
      @add-request="addRequest"
      @edit-request="editRequest"
      @edit-collection="editCollection"
      @edit-folder="editFolder"
      @edit-response="editResponse"
      @drop-request="dropRequest"
      @drop-collection="dropCollection"
      @display-modal-add="displayModalAdd(true)"
      @display-modal-import-export="displayModalImportExport(true)"
      @duplicate-collection="duplicateCollection"
      @duplicate-request="duplicateRequest"
      @duplicate-response="duplicateResponse"
      @edit-properties="editProperties"
      @export-data="exportData"
      @remove-collection="removeCollection"
      @remove-folder="removeFolder"
      @remove-request="removeRequest"
      @remove-response="removeResponse"
      @share-request="shareRequest"
      @select="selectPicked"
      @select-response="selectResponse"
      @select-request="selectRequest"
      @update-request-order="updateRequestOrder"
      @update-collection-order="updateCollectionOrder"
    />
    <CollectionsTeamCollections
      v-else
      :collections-type="collectionsType"
      :team-collection-list="
        filterTexts.length > 0 ? teamsSearchResults : teamCollectionList
      "
      :team-loading-collections="
        filterTexts.length > 0
          ? collectionsBeingLoadedFromSearch
          : teamLoadingCollections
      "
      :filter-text="filterTexts"
      :export-loading="exportLoading"
      :duplicate-request-loading="duplicateRequestLoading"
      :duplicate-collection-loading="duplicateCollectionLoading"
      :save-request="saveRequest"
      :picked="picked"
      :collection-move-loading="collectionMoveLoading"
      :request-move-loading="requestMoveLoading"
      @add-request="addRequest"
      @add-folder="addFolder"
      @collection-click="handleCollectionClick"
      @duplicate-collection="duplicateCollection"
      @duplicate-request="duplicateRequest"
      @duplicate-response="duplicateResponse"
      @drop-request="dropRequest"
      @drop-collection="dropCollection"
      @display-modal-add="displayModalAdd(true)"
      @display-modal-import-export="displayModalImportExport(true)"
      @edit-collection="editCollection"
      @edit-folder="editFolder"
      @edit-request="editRequest"
      @edit-response="editResponse"
      @edit-properties="editProperties"
      @export-data="exportData"
      @expand-team-collection="expandTeamCollection"
      @remove-collection="removeCollection"
      @remove-folder="removeFolder"
      @remove-request="removeRequest"
      @remove-response="removeResponse"
      @run-collection="runCollectionHandler"
      @share-request="shareRequest"
      @select-request="selectRequest"
      @select-response="selectResponse"
      @select="selectPicked"
      @update-request-order="updateRequestOrder"
      @update-collection-order="updateCollectionOrder"
    />
    <div
      class="py-15 hidden flex-1 flex-col items-center justify-center bg-primaryDark px-4 text-secondaryLight"
      :class="{
        '!flex': draggingToRoot && currentReorderingStatus.type !== 'request',
      }"
    >
      <icon-lucide-list-end class="svg-icons !h-8 !w-8" />
    </div>
    <CollectionsAdd
      :show="showModalAdd"
      :loading-state="modalLoadingState"
      @submit="addNewRootCollection"
      @hide-modal="displayModalAdd(false)"
    />
    <CollectionsAddRequest
      :show="showModalAddRequest"
      :loading-state="modalLoadingState"
      :request-context="requestContext"
      @add-request="onAddRequest"
      @hide-modal="displayModalAddRequest(false)"
    />
    <CollectionsAddFolder
      :show="showModalAddFolder"
      :loading-state="modalLoadingState"
      @add-folder="onAddFolder"
      @hide-modal="displayModalAddFolder(false)"
    />
    <CollectionsEdit
      :show="showModalEditCollection"
      :editing-collection-name="editingCollectionName ?? ''"
      :loading-state="modalLoadingState"
      @hide-modal="displayModalEditCollection(false)"
      @submit="updateEditingCollection"
    />
    <CollectionsEditFolder
      :show="showModalEditFolder"
      :editing-folder-name="editingFolderName ?? ''"
      :loading-state="modalLoadingState"
      @submit="updateEditingFolder"
      @hide-modal="displayModalEditFolder(false)"
    />
    <CollectionsEditRequest
      v-model="editingRequestName"
      :show="showModalEditRequest"
      :request-context="editingRequest"
      :loading-state="modalLoadingState"
      @submit="updateEditingRequest"
      @hide-modal="displayModalEditRequest(false)"
    />
    <CollectionsEditResponse
      v-model="editingResponseName"
      :show="showModalEditResponse"
      :request-context="editingRequest"
      :loading-state="modalLoadingState"
      @submit="updateEditingResponse"
      @hide-modal="displayModalEditResponse(false)"
    />
    <HoppSmartConfirmModal
      :show="showConfirmModal"
      :title="confirmModalTitle"
      :loading-state="modalLoadingState"
      @hide-modal="showConfirmModal = false"
      @resolve="resolveConfirmModal"
    />

    <CollectionsImportExport
      v-if="showModalImportExport"
      :collections-type="collectionsType"
      @hide-modal="displayModalImportExport(false)"
    />

    <TeamsAdd
      :show="showTeamModalAdd"
      @hide-modal="displayTeamModalAdd(false)"
    />
    <CollectionsProperties
      v-model="collectionPropertiesModalActiveTab"
      :show="showModalEditProperties"
      :editing-properties="editingProperties"
      :show-details="collectionsType.type === 'team-collections'"
      source="REST"
      @hide-modal="displayModalEditProperties(false)"
      @set-collection-properties="setCollectionProperties"
    />

    <!-- `selectedCollectionID` is guaranteed to be a string when `showCollectionsRunnerModal` is `true` -->
    <CollectionsRunner
      v-if="showCollectionsRunnerModal"
      :collection-i-d="selectedCollectionID!"
      :environment-i-d="activeEnvironmentID"
      :selected-environment-index="selectedEnvironmentIndex"
      @hide-modal="showCollectionsRunnerModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import {
  HoppCollection,
  HoppRESTAuth,
  HoppRESTHeaders,
  HoppRESTRequest,
  makeCollection,
} from "@hoppscotch/data"
import { useService } from "dioc/vue"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { cloneDeep, debounce, isEqual } from "lodash-es"
import { PropType, computed, nextTick, onMounted, ref, watch } from "vue"
import { useReadonlyStream, useStream } from "~/composables/stream"
import { defineActionHandler, invokeAction } from "~/helpers/actions"
import { GQLError } from "~/helpers/backend/GQLClient"
import {
  getCompleteCollectionTree,
  teamCollToHoppRESTColl,
} from "~/helpers/backend/helpers"
import {
  createChildCollection,
  createNewRootCollection,
  deleteCollection,
  duplicateTeamCollection,
  moveRESTTeamCollection,
  updateOrderRESTTeamCollection,
  updateTeamCollection,
} from "~/helpers/backend/mutations/TeamCollection"
import {
  createRequestInCollection,
  deleteTeamRequest,
  moveRESTTeamRequest,
  updateOrderRESTTeamRequest,
  updateTeamRequest,
} from "~/helpers/backend/mutations/TeamRequest"
import {
  getFoldersByPath,
  resetTeamRequestsContext,
  resolveSaveContextOnCollectionReorder,
  updateInheritedPropertiesForAffectedRequests,
  updateSaveContextForAffectedRequests,
} from "~/helpers/collection/collection"
import {
  getRequestsByPath,
  resolveSaveContextOnRequestReorder,
} from "~/helpers/collection/request"
import { TeamCollection } from "~/helpers/teams/TeamCollection"
import TeamCollectionAdapter from "~/helpers/teams/TeamCollectionAdapter"
import TeamEnvironmentAdapter from "~/helpers/teams/TeamEnvironmentAdapter"
import { TeamSearchService } from "~/helpers/teams/TeamsSearch.service"
import { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { Picked } from "~/helpers/types/HoppPicked"
import {
  addRESTCollection,
  addRESTFolder,
  cascadeParentCollectionForHeaderAuth,
  duplicateRESTCollection,
  editRESTCollection,
  editRESTFolder,
  editRESTRequest,
  moveRESTFolder,
  moveRESTRequest,
  navigateToFolderWithIndexPath,
  removeRESTCollection,
  removeRESTFolder,
  removeRESTRequest,
  restCollectionStore,
  restCollections$,
  saveRESTRequestAs,
  updateRESTCollectionOrder,
  updateRESTRequestOrder,
} from "~/newstore/collections"
import {
  selectedEnvironmentIndex$,
  setSelectedEnvironmentIndex,
} from "~/newstore/environments"
import { useLocalState } from "~/newstore/localstate"
import { currentReorderingStatus$ } from "~/newstore/reordering"
import { platform } from "~/platform"
import { PersistedOAuthConfig } from "~/services/oauth/oauth.service"
import { PersistenceService } from "~/services/persistence"
import { RESTTabService } from "~/services/tab/rest"
import { TeamWorkspace, WorkspaceService } from "~/services/workspace.service"
import { RESTOptionTabs } from "../http/RequestOptions.vue"
import { Collection as NodeCollection } from "./MyCollections.vue"
import { EditingProperties } from "./Properties.vue"
import { getDefaultRESTRequest } from "~/helpers/rest/default"

const t = useI18n()
const toast = useToast()
const tabs = useService(RESTTabService)

const props = defineProps({
  saveRequest: {
    type: Boolean,
    default: false,
    required: false,
  },
  picked: {
    type: Object as PropType<Picked | null>,
    default: null,
    required: false,
  },
})

const emit = defineEmits<{
  (event: "select", payload: Picked | null): void
  (event: "update-team", team: TeamWorkspace): void
  (event: "update-collection-type", type: CollectionType["type"]): void
}>()

type CollectionType =
  | {
      type: "team-collections"
      selectedTeam: TeamWorkspace
    }
  | { type: "my-collections"; selectedTeam: undefined }

const collectionsType = ref<CollectionType>({
  type: "my-collections",
  selectedTeam: undefined,
})

// Collection Data
const editingCollection = ref<HoppCollection | TeamCollection | null>(null)
const editingCollectionName = ref<string | null>(null)
const editingCollectionIndex = ref<number | null>(null)
const editingCollectionID = ref<string | null>(null)
const editingFolder = ref<HoppCollection | TeamCollection | null>(null)
const editingFolderName = ref<string | null>(null)
const editingFolderPath = ref<string | null>(null)
const editingRequest = ref<HoppRESTRequest | null>(null)
const editingRequestName = ref("")
const editingResponseName = ref("")
const editingResponseOldName = ref("")
const editingRequestIndex = ref<number | null>(null)
const editingRequestID = ref<string | null>(null)
const editingResponseID = ref<string | null>(null)

const editingProperties = ref<EditingProperties>({
  collection: null,
  isRootCollection: false,
  path: "",
  inheritedProperties: undefined,
})

const confirmModalTitle = ref<string | null>(null)

const filterTexts = ref("")

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)
const myCollections = useReadonlyStream(restCollections$, [], "deep")

// Draging
const draggingToRoot = ref(false)
const collectionMoveLoading = ref<string[]>([])
const requestMoveLoading = ref<string[]>([])

// TeamList-Adapter
const workspaceService = useService(WorkspaceService)
const teamListAdapter = workspaceService.acquireTeamListAdapter(null)
const REMEMBERED_TEAM_ID = useLocalState("REMEMBERED_TEAM_ID")

// Team Collection Adapter
const teamCollectionAdapter = new TeamCollectionAdapter(null)
const teamCollectionList = useReadonlyStream(
  teamCollectionAdapter.collections$,
  []
)
const teamLoadingCollections = useReadonlyStream(
  teamCollectionAdapter.loadingCollections$,
  []
)
const teamEnvironmentAdapter = new TeamEnvironmentAdapter(undefined)
const teamEnvironmentList = useReadonlyStream(
  teamEnvironmentAdapter.teamEnvironmentList$,
  []
)
const selectedEnvironmentIndex = useStream(
  selectedEnvironmentIndex$,
  { type: "NO_ENV_SELECTED" },
  setSelectedEnvironmentIndex
)

const {
  cascadeParentCollectionForHeaderAuthForSearchResults,
  searchTeams,
  teamsSearchResults,
  teamsSearchResultsLoading,
  expandCollection,
  expandingCollections,
} = useService(TeamSearchService)

watch(teamsSearchResults, (newSearchResults) => {
  if (newSearchResults.length === 1 && filterTexts.value.length > 0) {
    expandCollection(newSearchResults[0].id)
  }
})

const debouncedSearch = debounce(searchTeams, 400)

const collectionsBeingLoadedFromSearch = computed(() => {
  const collections = []

  if (teamsSearchResultsLoading.value) {
    collections.push("root")
  }

  collections.push(...expandingCollections.value)

  return collections
})

watch(
  filterTexts,
  (newFilterText) => {
    if (collectionsType.value.type === "team-collections") {
      const selectedTeamID = collectionsType.value.selectedTeam?.teamID

      selectedTeamID &&
        debouncedSearch(newFilterText, selectedTeamID)?.catch(() => {})
    }
  },
  {
    immediate: true,
  }
)
const persistenceService = useService(PersistenceService)

const collectionPropertiesModalActiveTab = ref<RESTOptionTabs>("headers")

onMounted(() => {
  const localOAuthTempConfig =
    persistenceService.getLocalConfig("oauth_temp_config")

  if (!localOAuthTempConfig) {
    return
  }

  const { context, source, token, refresh_token }: PersistedOAuthConfig =
    JSON.parse(localOAuthTempConfig)

  if (source === "GraphQL") {
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

const switchToMyCollections = () => {
  collectionsType.value.type = "my-collections"
  collectionsType.value.selectedTeam = undefined
  teamCollectionAdapter.changeTeamID(null)
}

/**
 * right now, for search results, we rely on collection click + isOpen to expand the collection
 */
const handleCollectionClick = (payload: {
  collectionID: string
  isOpen: boolean
}) => {
  if (
    filterTexts.value.length > 0 &&
    teamsSearchResults.value.length &&
    payload.isOpen
  ) {
    expandCollection(payload.collectionID)
    return
  }
}

const expandTeamCollection = (collectionID: string) => {
  if (filterTexts.value.length > 0 && teamsSearchResults.value) {
    return
  }

  teamCollectionAdapter.expandCollection(collectionID)
}

const updateSelectedTeam = (team: TeamWorkspace) => {
  if (team) {
    collectionsType.value.type = "team-collections"
    teamCollectionAdapter.changeTeamID(team.teamID)
    collectionsType.value.selectedTeam = team
    REMEMBERED_TEAM_ID.value = team.teamID
    emit("update-team", team)
    emit("update-collection-type", "team-collections")
  }
}

const workspace = workspaceService.currentWorkspace

// Used to switch collection type and team when user switch workspace in the global workspace switcher
watch(
  workspace,
  (newWorkspace) => {
    if (newWorkspace.type === "personal") {
      switchToMyCollections()
    } else if (newWorkspace.type === "team") {
      updateSelectedTeam(newWorkspace)

      teamEnvironmentAdapter.changeTeamID(newWorkspace.teamID)
    }
  },
  {
    immediate: true,
  }
)

// Switch to my-collections and reset the team collection when user logout
watch(
  () => currentUser.value,
  (user) => {
    if (!user) {
      switchToMyCollections()
    }
  }
)

const currentReorderingStatus = useReadonlyStream(currentReorderingStatus$, {
  type: "collection",
  id: "",
  parentID: "",
})

const hasTeamWriteAccess = computed(() => {
  if (collectionsType.value.type !== "team-collections") {
    return false
  }

  const role = collectionsType.value.selectedTeam?.role
  return role === "OWNER" || role === "EDITOR"
})

const filteredCollections = computed(() => {
  const collections =
    collectionsType.value.type === "my-collections" ? myCollections.value : []

  if (filterTexts.value === "") return collections

  if (collectionsType.value.type === "team-collections") return []

  const filterText = filterTexts.value.toLowerCase()
  const filteredCollections = []

  const isMatch = (text: string) => text.toLowerCase().includes(filterText)

  for (const collection of collections) {
    const filteredRequests = []
    const filteredFolders = []
    for (const request of collection.requests) {
      if (isMatch(request.name)) filteredRequests.push(request)
    }
    for (const folder of collection.folders) {
      if (isMatch(folder.name)) filteredFolders.push(folder)
      const filteredFolderRequests = []
      for (const request of folder.requests) {
        if (isMatch(request.name)) filteredFolderRequests.push(request)
      }
      if (filteredFolderRequests.length > 0) {
        const filteredFolder = Object.assign({}, folder)
        filteredFolder.requests = filteredFolderRequests
        filteredFolders.push(filteredFolder)
      }
    }

    if (
      filteredRequests.length + filteredFolders.length > 0 ||
      isMatch(collection.name)
    ) {
      const filteredCollection = Object.assign({}, collection)
      filteredCollection.requests = filteredRequests
      filteredCollection.folders = filteredFolders
      filteredCollections.push(filteredCollection)
    }
  }

  return filteredCollections
})

const isSelected = ({
  collectionIndex,
  folderPath,
  requestIndex,
  collectionID,
  folderID,
  requestID,
}: {
  collectionIndex?: number | undefined
  folderPath?: string | undefined
  requestIndex?: number | undefined
  collectionID?: string | undefined
  folderID?: string | undefined
  requestID?: string | undefined
}) => {
  if (collectionIndex !== undefined) {
    return (
      props.picked &&
      props.picked.pickedType === "my-collection" &&
      props.picked.collectionIndex === collectionIndex
    )
  } else if (requestIndex !== undefined && folderPath !== undefined) {
    return (
      props.picked &&
      props.picked.pickedType === "my-request" &&
      props.picked.folderPath === folderPath &&
      props.picked.requestIndex === requestIndex
    )
  } else if (folderPath !== undefined) {
    return (
      props.picked &&
      props.picked.pickedType === "my-folder" &&
      props.picked.folderPath === folderPath
    )
  } else if (collectionID !== undefined) {
    return (
      props.picked &&
      props.picked.pickedType === "teams-collection" &&
      props.picked.collectionID === collectionID
    )
  } else if (requestID !== undefined) {
    return (
      props.picked &&
      props.picked.pickedType === "teams-request" &&
      props.picked.requestID === requestID
    )
  } else if (folderID !== undefined) {
    return (
      props.picked &&
      props.picked.pickedType === "teams-folder" &&
      props.picked.folderID === folderID
    )
  }
}

const modalLoadingState = ref(false)
const exportLoading = ref(false)
const duplicateRequestLoading = ref(false)
const duplicateCollectionLoading = ref(false)

const showModalAdd = ref(false)
const showModalAddRequest = ref(false)
const showModalAddFolder = ref(false)
const showModalEditCollection = ref(false)
const showModalEditFolder = ref(false)
const showModalEditRequest = ref(false)
const showModalEditResponse = ref(false)
const showModalImportExport = ref(false)
const showModalEditProperties = ref(false)
const showConfirmModal = ref(false)
const showTeamModalAdd = ref(false)

const showCollectionsRunnerModal = ref(false)
const selectedCollectionID = ref<string | null>(null)
const activeEnvironmentID = ref<string | null | undefined>(null)

const displayModalAdd = (show: boolean) => {
  showModalAdd.value = show

  if (!show) resetSelectedData()
}

const displayModalAddRequest = (show: boolean) => {
  showModalAddRequest.value = show

  if (!show) resetSelectedData()
}

const displayModalAddFolder = (show: boolean) => {
  showModalAddFolder.value = show

  if (!show) resetSelectedData()
}

const displayModalEditCollection = (show: boolean) => {
  showModalEditCollection.value = show

  if (!show) resetSelectedData()
}

const displayModalEditFolder = (show: boolean) => {
  showModalEditFolder.value = show

  if (!show) resetSelectedData()
}

const displayModalEditRequest = (show: boolean) => {
  showModalEditRequest.value = show

  if (!show) resetSelectedData()
}

const displayModalEditResponse = (show: boolean) => {
  showModalEditResponse.value = show

  if (!show) resetSelectedData()
}

const displayModalImportExport = (show: boolean) => {
  showModalImportExport.value = show

  if (!show) resetSelectedData()
}

const displayModalEditProperties = (show: boolean) => {
  showModalEditProperties.value = show

  if (!show) resetSelectedData()
}

const displayConfirmModal = (show: boolean) => {
  showConfirmModal.value = show

  if (!show) resetSelectedData()
}

const displayTeamModalAdd = (show: boolean) => {
  showTeamModalAdd.value = show

  teamListAdapter.fetchList()
}

const addNewRootCollection = (name: string) => {
  if (collectionsType.value.type === "my-collections") {
    addRESTCollection(
      makeCollection({
        name,
        folders: [],
        requests: [],
        headers: [],
        auth: {
          authType: "none",
          authActive: true,
        },
      })
    )

    platform.analytics?.logEvent({
      type: "HOPP_CREATE_COLLECTION",
      platform: "rest",
      workspaceType: "personal",
      isRootCollection: true,
    })

    displayModalAdd(false)
  } else if (hasTeamWriteAccess.value) {
    if (!collectionsType.value.selectedTeam) return
    modalLoadingState.value = true

    platform.analytics?.logEvent({
      type: "HOPP_CREATE_COLLECTION",
      platform: "rest",
      workspaceType: "team",
      isRootCollection: true,
    })

    pipe(
      createNewRootCollection(name, collectionsType.value.selectedTeam.teamID),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("collection.created"))
          displayModalAdd(false)
        }
      )
    )()
  }
}

const addRequest = (payload: {
  path: string
  folder: HoppCollection | TeamCollection
}) => {
  const { path, folder } = payload
  editingFolder.value = folder
  editingFolderPath.value = path
  displayModalAddRequest(true)
}

const requestContext = computed(() => {
  return tabs.currentActiveTab.value.document.type === "request"
    ? tabs.currentActiveTab.value.document.request
    : null
})

const onAddRequest = (requestName: string) => {
  const request =
    tabs.currentActiveTab.value.document.type === "request"
      ? tabs.currentActiveTab.value.document.request
      : getDefaultRESTRequest()

  if (!request) return

  const newRequest = {
    ...cloneDeep(request),
    name: requestName,
  }

  const path = editingFolderPath.value
  if (!path) return
  if (collectionsType.value.type === "my-collections") {
    const insertionIndex = saveRESTRequestAs(path, newRequest)

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(path, "rest")

    tabs.createNewTab({
      request: newRequest,
      isDirty: false,
      type: "request",
      saveContext: {
        originLocation: "user-collection",
        folderPath: path,
        requestIndex: insertionIndex,
      },
      inheritedProperties: {
        auth,
        headers,
      },
    })

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      workspaceType: "personal",
      createdNow: true,
      platform: "rest",
    })

    displayModalAddRequest(false)
  } else if (hasTeamWriteAccess.value) {
    const folder = editingFolder.value

    if (!folder || !collectionsType.value.selectedTeam) return
    if (!folder.id) return

    modalLoadingState.value = true

    const data = {
      request: JSON.stringify(newRequest),
      teamID: collectionsType.value.selectedTeam.teamID,
      title: requestName,
    }

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      workspaceType: "team",
      platform: "rest",
      createdNow: true,
    })

    pipe(
      createRequestInCollection(folder.id, data),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        (result) => {
          const { createRequestInCollection } = result
          const { auth, headers } =
            teamCollectionAdapter.cascadeParentCollectionForHeaderAuth(path)
          tabs.createNewTab({
            request: newRequest,
            isDirty: false,
            type: "request",
            saveContext: {
              originLocation: "team-collection",
              requestID: createRequestInCollection.id,
              collectionID: path,
              teamID: createRequestInCollection.collection.team.id,
            },
            inheritedProperties: {
              auth,
              headers,
            },
          })

          modalLoadingState.value = false
          displayModalAddRequest(false)
        }
      )
    )()
  }
}

const addFolder = (payload: {
  path: string
  folder: HoppCollection | TeamCollection
}) => {
  const { path, folder } = payload
  editingFolder.value = folder
  editingFolderPath.value = path
  displayModalAddFolder(true)
}

const onAddFolder = (folderName: string) => {
  const path = editingFolderPath.value

  if (collectionsType.value.type === "my-collections") {
    if (!path) return
    addRESTFolder(folderName, path)

    platform.analytics?.logEvent({
      type: "HOPP_CREATE_COLLECTION",
      workspaceType: "personal",
      isRootCollection: false,
      platform: "rest",
    })

    displayModalAddFolder(false)
  } else if (hasTeamWriteAccess.value) {
    const folder = editingFolder.value
    if (!folder || !folder.id) return

    modalLoadingState.value = true

    platform.analytics?.logEvent({
      type: "HOPP_CREATE_COLLECTION",
      workspaceType: "personal",
      isRootCollection: false,
      platform: "rest",
    })

    pipe(
      createChildCollection(folderName, folder.id),
      TE.match(
        (err: GQLError<string>) => {
          if (err.error === "team_coll/short_title") {
            toast.error(t("folder.name_length_insufficient"))
          } else {
            toast.error(`${getErrorMessage(err)}`)
          }
          modalLoadingState.value = false
        },
        () => {
          toast.success(t("folder.created"))
          modalLoadingState.value = false
          displayModalAddFolder(false)
        }
      )
    )()
  }
}

const editCollection = (payload: {
  collectionIndex: string
  collection: HoppCollection | TeamCollection
}) => {
  const { collectionIndex, collection } = payload
  editingCollection.value = collection
  if (collectionsType.value.type === "my-collections") {
    editingCollectionIndex.value = parseInt(collectionIndex)
    editingCollectionName.value = (collection as HoppCollection).name
  } else {
    editingCollectionName.value = (collection as TeamCollection).title
  }

  displayModalEditCollection(true)
}

const updateEditingCollection = (newName: string) => {
  if (!editingCollection.value) return

  if (!newName) {
    toast.error(t("collection.invalid_name"))
    return
  }

  if (collectionsType.value.type === "my-collections") {
    const collectionIndex = editingCollectionIndex.value
    if (collectionIndex === null) return

    const collectionUpdated = {
      ...editingCollection.value,
      name: newName,
    }

    editRESTCollection(
      collectionIndex,
      collectionUpdated as NodeCollection["data"]["data"]
    )
    displayModalEditCollection(false)
  } else if (hasTeamWriteAccess.value) {
    if (!editingCollection.value.id) return
    modalLoadingState.value = true

    pipe(
      updateTeamCollection(editingCollection.value.id, undefined, newName),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("collection.renamed"))
          displayModalEditCollection(false)
        }
      )
    )()
  }
}

const editFolder = (payload: {
  folderPath: string | undefined
  folder: HoppCollection | TeamCollection
}) => {
  const { folderPath, folder } = payload
  editingFolder.value = folder
  if (collectionsType.value.type === "my-collections" && folderPath) {
    editingFolderPath.value = folderPath
    editingFolderName.value = (folder as HoppCollection).name
  } else {
    editingFolderName.value = (folder as TeamCollection).title
  }
  displayModalEditFolder(true)
}

const updateEditingFolder = (newName: string) => {
  if (!editingFolder.value) return

  if (collectionsType.value.type === "my-collections") {
    if (!editingFolderPath.value) return

    editRESTFolder(editingFolderPath.value, {
      ...(editingFolder.value as HoppCollection),
      name: newName,
    })
    displayModalEditFolder(false)
  } else if (hasTeamWriteAccess.value) {
    if (!editingFolder.value.id) return
    modalLoadingState.value = true

    /* renameCollection can be used to rename both collections and folders
     since folder is treated as collection in the BE. */
    pipe(
      updateTeamCollection(editingFolder.value.id, undefined, newName),
      TE.match(
        (err: GQLError<string>) => {
          if (err.error === "team_coll/short_title") {
            toast.error(t("folder.name_length_insufficient"))
          } else {
            toast.error(`${getErrorMessage(err)}`)
          }
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("folder.renamed"))
          displayModalEditFolder(false)
        }
      )
    )()
  }
}

const duplicateCollection = async ({
  pathOrID,
  collectionSyncID,
}: {
  pathOrID: string
  collectionSyncID?: string
}) => {
  if (collectionsType.value.type === "my-collections") {
    duplicateRESTCollection(pathOrID, collectionSyncID)
  } else if (hasTeamWriteAccess.value) {
    duplicateCollectionLoading.value = true

    await pipe(
      duplicateTeamCollection(pathOrID),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          duplicateCollectionLoading.value = false
        },
        () => {
          toast.success(t("collection.duplicated"))
          duplicateCollectionLoading.value = false
        }
      )
    )()
  }
}

const editRequest = (payload: {
  folderPath: string | undefined
  requestIndex: string
  request: HoppRESTRequest
}) => {
  const { folderPath, requestIndex, request } = payload
  editingRequest.value = request
  editingRequestName.value = request.name ?? ""
  if (collectionsType.value.type === "my-collections" && folderPath) {
    editingFolderPath.value = folderPath
    editingRequestIndex.value = parseInt(requestIndex)
  } else {
    editingRequestID.value = requestIndex
  }
  displayModalEditRequest(true)
}

const updateEditingRequest = (newName: string) => {
  const request = editingRequest.value
  if (!request) return

  const requestUpdated = {
    ...request,
    name: newName || request.name,
  }
  if (collectionsType.value.type === "my-collections") {
    const folderPath = editingFolderPath.value
    const requestIndex = editingRequestIndex.value

    if (folderPath === null || requestIndex === null) return

    const possibleActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      requestIndex,
      folderPath,
    })

    editRESTRequest(folderPath, requestIndex, requestUpdated)

    if (
      possibleActiveTab &&
      possibleActiveTab.value.document.type === "request"
    ) {
      possibleActiveTab.value.document.request.name = requestUpdated.name
      nextTick(() => {
        possibleActiveTab.value.document.isDirty = false
      })
    }

    displayModalEditRequest(false)
  } else if (hasTeamWriteAccess.value) {
    modalLoadingState.value = true

    const requestID = editingRequestID.value
    const requestName = newName || request.name

    if (!requestID) return

    const data = {
      request: JSON.stringify(requestUpdated),
      title: requestName,
    }

    pipe(
      updateTeamRequest(requestID, data),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("request.renamed"))
          displayModalEditRequest(false)
        }
      )
    )()

    const possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID,
    })

    if (possibleTab && possibleTab.value.document.type === "request") {
      possibleTab.value.document.request.name = requestName
      nextTick(() => {
        possibleTab.value.document.isDirty = false
      })
    }
  }
}

type ResponseConfigPayload = {
  folderPath: string | undefined
  requestIndex: string
  request: HoppRESTRequest
  responseName: string
  responseID: string
}

const editResponse = (payload: ResponseConfigPayload) => {
  const { folderPath, requestIndex, request, responseID, responseName } =
    payload

  editingRequest.value = request
  editingRequestName.value = request.name ?? ""
  editingResponseID.value = responseID
  editingResponseName.value = responseName

  //need to store the old name for updating the response key
  editingResponseOldName.value = responseName
  if (collectionsType.value.type === "my-collections" && folderPath) {
    editingFolderPath.value = folderPath
    editingRequestIndex.value = parseInt(requestIndex)
  } else {
    editingRequestID.value = requestIndex
  }
  displayModalEditResponse(true)
}

const updateEditingResponse = (newName: string) => {
  const request = cloneDeep(editingRequest.value)
  if (!request) return

  const responseOldName = editingResponseOldName.value

  if (!responseOldName) return

  if (responseOldName !== newName) {
    // Convert object to entries array (preserving order)
    const entries = Object.entries(request.responses)

    // Replace the old key with the new key in the array
    const updatedEntries = entries.map(([key, value]) =>
      key === responseOldName
        ? [newName, { ...value, name: newName }]
        : [key, value]
    )

    // Convert the array back into an object
    request.responses = Object.fromEntries(updatedEntries)
  }

  if (collectionsType.value.type === "my-collections") {
    const folderPath = editingFolderPath.value
    const requestIndex = editingRequestIndex.value

    if (folderPath === null || requestIndex === null) return

    const possibleExampleActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      requestIndex,
      folderPath,
      exampleID: editingResponseID.value ?? undefined,
    })

    const possibleRequestActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      requestIndex,
      folderPath,
    })

    editRESTRequest(folderPath, requestIndex, request)

    if (
      possibleExampleActiveTab &&
      possibleExampleActiveTab.value.document.type === "example-response"
    ) {
      possibleExampleActiveTab.value.document.response.name = newName

      nextTick(() => {
        possibleExampleActiveTab.value.document.isDirty = false
        possibleExampleActiveTab.value.document.saveContext = {
          originLocation: "user-collection",
          folderPath: folderPath,
          requestIndex: requestIndex,
          exampleID: editingResponseID.value!,
        }
      })
    }

    // update the request tab responses if it's open
    if (
      possibleRequestActiveTab &&
      possibleRequestActiveTab.value.document.type === "request"
    ) {
      possibleRequestActiveTab.value.document.request.responses =
        request.responses
    }

    displayModalEditResponse(false)

    toast.success(t("response.renamed"))
  } else if (hasTeamWriteAccess.value) {
    modalLoadingState.value = true

    const requestID = editingRequestID.value

    if (!requestID) return

    const data = {
      request: JSON.stringify(request),
      title: request.name,
    }

    pipe(
      updateTeamRequest(requestID, data),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("response.renamed"))
          displayModalEditResponse(false)
        }
      )
    )()

    const possibleActiveResponseTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID,
      exampleID: editingResponseID.value ?? undefined,
    })

    const possibleRequestActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID,
    })

    if (
      possibleActiveResponseTab &&
      possibleActiveResponseTab.value.document.type === "example-response"
    ) {
      possibleActiveResponseTab.value.document.response.name = newName
      nextTick(() => {
        possibleActiveResponseTab.value.document.isDirty = false
        possibleActiveResponseTab.value.document.saveContext = {
          originLocation: "team-collection",
          requestID,
          exampleID: editingResponseID.value!,
        }
      })
    }

    // update the request tab responses if it's open
    if (
      possibleRequestActiveTab &&
      possibleRequestActiveTab.value.document.type === "request"
    ) {
      possibleRequestActiveTab.value.document.request.responses =
        request.responses
    }
  }
}

const duplicateRequest = (payload: {
  folderPath: string
  request: HoppRESTRequest
}) => {
  const { folderPath, request } = payload
  if (!folderPath) return

  const newRequest = {
    ...cloneDeep(request),
    name: `${request.name} - ${t("action.duplicate")}`,
  }

  if (collectionsType.value.type === "my-collections") {
    saveRESTRequestAs(folderPath, newRequest)
    toast.success(t("request.duplicated"))
  } else if (hasTeamWriteAccess.value) {
    duplicateRequestLoading.value = true

    if (!collectionsType.value.selectedTeam) return

    const data = {
      request: JSON.stringify(newRequest),
      teamID: collectionsType.value.selectedTeam.teamID,
      title: `${request.name} - ${t("action.duplicate")}`,
    }

    pipe(
      createRequestInCollection(folderPath, data),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          duplicateRequestLoading.value = false
        },
        () => {
          duplicateRequestLoading.value = false
          toast.success(t("request.duplicated"))
          displayModalAddRequest(false)
        }
      )
    )()
  }
}

const duplicateResponse = (payload: ResponseConfigPayload) => {
  const { folderPath, requestIndex, request, responseName } = payload

  const response = request.responses[responseName]

  if (!response || !folderPath || !requestIndex) return

  const newName = `${responseName} - ${t("action.duplicate")}`

  // if the new name is already taken, show a toast and return
  if (Object.keys(request.responses).includes(newName)) {
    toast.error(t("response.duplicate_name_error"))
    return
  }

  const newResponse = {
    ...cloneDeep(response),
    name: newName,
  }

  const updatedRequest = {
    ...request,
    responses: {
      ...request.responses,
      [newResponse.name]: newResponse,
    },
  }

  if (collectionsType.value.type === "my-collections") {
    editRESTRequest(folderPath, parseInt(requestIndex), updatedRequest)
    toast.success(t("response.duplicated"))

    const possibleRequestActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      requestIndex: parseInt(requestIndex),
      folderPath,
    })

    // update the request tab responses if it's open
    if (
      possibleRequestActiveTab &&
      possibleRequestActiveTab.value.document.type === "request"
    ) {
      possibleRequestActiveTab.value.document.request.responses =
        updatedRequest.responses
    }
  } else if (hasTeamWriteAccess.value) {
    duplicateRequestLoading.value = true

    if (!collectionsType.value.selectedTeam) return

    const data = {
      request: JSON.stringify(updatedRequest),
      title: request.name,
    }

    pipe(
      updateTeamRequest(requestIndex, data),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("response.duplicated"))
          displayModalEditResponse(false)
        }
      )
    )()

    // update the request tab responses if it's open
    const possibleRequestActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID: requestIndex,
    })

    if (
      possibleRequestActiveTab &&
      possibleRequestActiveTab.value.document.type === "request"
    ) {
      possibleRequestActiveTab.value.document.request.responses =
        updatedRequest.responses
    }
  }
}

const removeCollection = (id: string) => {
  if (collectionsType.value.type === "my-collections")
    editingCollectionIndex.value = parseInt(id)
  else editingCollectionID.value = id

  confirmModalTitle.value = `${t("confirm.remove_collection")}`
  displayConfirmModal(true)
}

/**
 * Used to delete both collections and folders
 * since folder is treated as collection in the BE.
 * @param collectionID - ID of the collection or folder to be deleted.
 */
const removeTeamCollectionOrFolder = async (collectionID: string) => {
  modalLoadingState.value = true

  await pipe(
    deleteCollection(collectionID),
    TE.match(
      (err: GQLError<string>) => {
        toast.error(`${getErrorMessage(err)}`)
        modalLoadingState.value = false
      },
      () => {
        modalLoadingState.value = false
        toast.success(t("state.deleted"))
        displayConfirmModal(false)
      }
    )
  )()
}

const onRemoveCollection = () => {
  if (collectionsType.value.type === "my-collections") {
    const collectionIndex = editingCollectionIndex.value

    const collectionToRemove =
      collectionIndex || collectionIndex === 0
        ? navigateToFolderWithIndexPath(restCollectionStore.value.state, [
            collectionIndex,
          ])
        : undefined

    if (collectionIndex === null) return

    if (
      isSelected({
        collectionIndex,
      })
    ) {
      emit("select", null)
    }

    removeRESTCollection(
      collectionIndex,
      collectionToRemove ? collectionToRemove.id : undefined
    )

    resolveSaveContextOnCollectionReorder({
      lastIndex: collectionIndex,
      newIndex: -1,
      folderPath: "", // root folder
      length: myCollections.value.length,
    })

    toast.success(t("state.deleted"))
    displayConfirmModal(false)
  } else if (hasTeamWriteAccess.value) {
    const collectionID = editingCollectionID.value

    if (!collectionID) return

    if (
      isSelected({
        collectionID,
      })
    ) {
      emit("select", null)
    }

    removeTeamCollectionOrFolder(collectionID).then(() => {
      resetTeamRequestsContext()
    })
  }
}

const removeFolder = (id: string) => {
  if (collectionsType.value.type === "my-collections")
    editingFolderPath.value = id
  else editingCollectionID.value = id

  confirmModalTitle.value = `${t("confirm.remove_folder")}`
  displayConfirmModal(true)
}

const onRemoveFolder = () => {
  if (collectionsType.value.type === "my-collections") {
    const folderPath = editingFolderPath.value

    if (!folderPath) return

    if (
      isSelected({
        folderPath,
      })
    ) {
      emit("select", null)
    }

    const folderToRemove = folderPath
      ? navigateToFolderWithIndexPath(
          restCollectionStore.value.state,
          folderPath.split("/").map((i) => parseInt(i))
        )
      : undefined

    removeRESTFolder(folderPath, folderToRemove ? folderToRemove.id : undefined)

    const parentFolder = folderPath.split("/").slice(0, -1).join("/") // remove last folder to get parent folder
    resolveSaveContextOnCollectionReorder({
      lastIndex: pathToLastIndex(folderPath),
      newIndex: -1,
      folderPath: parentFolder,
      length: getFoldersByPath(myCollections.value, parentFolder).length,
    })

    toast.success(t("state.deleted"))
    displayConfirmModal(false)
  } else if (hasTeamWriteAccess.value) {
    const collectionID = editingCollectionID.value

    if (!collectionID) return

    if (
      isSelected({
        collectionID,
      })
    ) {
      emit("select", null)
    }

    removeTeamCollectionOrFolder(collectionID).then(() => {
      resetTeamRequestsContext()
    })
  }
}

const removeRequest = (payload: {
  folderPath: string | null
  requestIndex: string
}) => {
  const { folderPath, requestIndex } = payload
  if (collectionsType.value.type === "my-collections" && folderPath) {
    editingFolderPath.value = folderPath
    editingRequestIndex.value = parseInt(requestIndex)
  } else {
    editingRequestID.value = requestIndex
  }
  confirmModalTitle.value = `${t("confirm.remove_request")}`
  displayConfirmModal(true)
}

const onRemoveRequest = () => {
  if (collectionsType.value.type === "my-collections") {
    const folderPath = editingFolderPath.value
    const requestIndex = editingRequestIndex.value

    if (folderPath === null || requestIndex === null) return

    if (
      isSelected({
        folderPath,
        requestIndex,
      })
    ) {
      emit("select", null)
    }

    const possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      folderPath,
      requestIndex,
    })

    // If there is a tab attached to this request, dissociate its state and mark it dirty
    if (possibleTab && possibleTab.value.document.type === "request") {
      possibleTab.value.document.saveContext = null
      possibleTab.value.document.isDirty = true

      // since the request is deleted, we need to remove the saved responses as well
      possibleTab.value.document.request.responses = {}
    }

    const requestToRemove = navigateToFolderWithIndexPath(
      restCollectionStore.value.state,
      folderPath.split("/").map((i) => parseInt(i))
    )?.requests[requestIndex]

    removeRESTRequest(folderPath, requestIndex, requestToRemove?.id)

    // the same function is used to reorder requests since after removing, it's basically doing reorder
    resolveSaveContextOnRequestReorder({
      lastIndex: requestIndex,
      newIndex: -1,
      folderPath,
      length: getRequestsByPath(myCollections.value, folderPath).length,
    })

    toast.success(t("state.deleted"))
    displayConfirmModal(false)
  } else if (hasTeamWriteAccess.value) {
    const requestID = editingRequestID.value

    if (!requestID) return

    if (
      isSelected({
        requestID,
      })
    ) {
      emit("select", null)
    }

    modalLoadingState.value = true

    pipe(
      deleteTeamRequest(requestID),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("state.deleted"))
          displayConfirmModal(false)
        }
      )
    )()

    // If there is a tab attached to this request, dissociate its state and mark it dirty
    const possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID,
    })

    if (possibleTab && possibleTab.value.document.type === "request") {
      possibleTab.value.document.saveContext = null
      possibleTab.value.document.isDirty = true

      // since the request is deleted, we need to remove the saved responses as well
      possibleTab.value.document.request.responses = {}
    }
  }
}

const removeResponse = (payload: ResponseConfigPayload) => {
  const { folderPath, requestIndex, request, responseID, responseName } =
    payload
  if (collectionsType.value.type === "my-collections" && folderPath) {
    editingFolderPath.value = folderPath
    editingRequestIndex.value = parseInt(requestIndex)
    editingResponseID.value = responseID
    editingRequest.value = request
    editingResponseName.value = responseName
  } else {
    editingRequestID.value = requestIndex
    editingResponseID.value = payload.responseID
    editingRequest.value = request
    editingResponseName.value = responseName
  }
  confirmModalTitle.value = `${t("confirm.remove_response")}`
  displayConfirmModal(true)
}

const onRemoveResponse = () => {
  const request = cloneDeep(editingRequest.value)

  if (!request) return

  const responseName = editingResponseName.value
  const responseID = editingResponseID.value

  delete request.responses[responseName]

  const requestUpdated: HoppRESTRequest = {
    ...request,
  }

  if (collectionsType.value.type === "my-collections") {
    const folderPath = editingFolderPath.value
    const requestIndex = editingRequestIndex.value

    if (folderPath === null || requestIndex === null) return

    editRESTRequest(folderPath, requestIndex, requestUpdated)

    const possibleActiveResponseTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      folderPath,
      requestIndex,
      exampleID: responseID ?? undefined,
    })

    const possibleRequestActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      requestIndex,
      folderPath,
    })

    // If there is a tab attached to this request, close it and set the active tab to the first one
    if (
      possibleActiveResponseTab &&
      possibleActiveResponseTab.value.document.type === "example-response"
    ) {
      const activeTabs = tabs.getActiveTabs()

      // if the last tab is the one we are closing, we need to create a new tab
      if (
        activeTabs.value.length === 1 &&
        activeTabs.value[0].id === possibleActiveResponseTab.value.id
      ) {
        tabs.createNewTab({
          request: getDefaultRESTRequest(),
          isDirty: false,
          type: "request",
          saveContext: undefined,
        })
        tabs.closeTab(possibleActiveResponseTab.value.id)
      } else {
        tabs.closeTab(possibleActiveResponseTab.value.id)
        tabs.setActiveTab(activeTabs.value[0].id)
      }
    }

    // update the request tab responses if it's open
    if (
      possibleRequestActiveTab &&
      possibleRequestActiveTab.value.document.type === "request"
    ) {
      possibleRequestActiveTab.value.document.request.responses =
        requestUpdated.responses
    }

    toast.success(t("state.deleted"))
    displayConfirmModal(false)
  } else if (hasTeamWriteAccess.value) {
    const requestID = editingRequestID.value

    if (!requestID) return

    modalLoadingState.value = true

    const data = {
      request: JSON.stringify(requestUpdated),
      title: request.name,
    }

    pipe(
      updateTeamRequest(requestID, data),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          toast.success(t("state.deleted"))
          displayConfirmModal(false)
        }
      )
    )()

    const possibleActiveResponseTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID,
      exampleID: responseID ?? undefined,
    })

    const possibleRequestActiveTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID,
    })

    // If there is a tab attached to this request, close it and set the active tab to the first one
    if (
      possibleActiveResponseTab &&
      possibleActiveResponseTab.value.document.type === "example-response"
    ) {
      const activeTabs = tabs.getActiveTabs()

      // if the last tab is the one we are closing, we need to create a new tab
      if (
        activeTabs.value.length === 1 &&
        activeTabs.value[0].id === possibleActiveResponseTab.value.id
      ) {
        tabs.createNewTab({
          request: getDefaultRESTRequest(),
          isDirty: false,
          type: "request",
          saveContext: undefined,
        })
        tabs.closeTab(possibleActiveResponseTab.value.id)
      } else {
        tabs.closeTab(possibleActiveResponseTab.value.id)
        tabs.setActiveTab(activeTabs.value[0].id)
      }
    }

    // update the request tab responses if it's open
    if (
      possibleRequestActiveTab &&
      possibleRequestActiveTab.value.document.type === "request"
    ) {
      possibleRequestActiveTab.value.document.request.responses =
        requestUpdated.responses
    }
  }
}

// The request is picked in the save request as modal
const selectPicked = (payload: Picked | null) => {
  emit("select", payload)
}

/**
 * This function is called when the user clicks on a request
 * @param selectedRequest The request that the user clicked on emited from the collection tree
 */
const selectRequest = (selectedRequest: {
  request: HoppRESTRequest
  folderPath: string
  requestIndex: string
  isActive: boolean
}) => {
  const { request, folderPath, requestIndex } = selectedRequest
  // If there is a request with this save context, switch into it
  let possibleTab = null

  if (collectionsType.value.type === "team-collections") {
    let inheritedProperties: HoppInheritedProperty | undefined = undefined

    if (filterTexts.value.length > 0) {
      const collectionID = folderPath.split("/").at(-1)

      if (!collectionID) return

      inheritedProperties =
        cascadeParentCollectionForHeaderAuthForSearchResults(collectionID)
    } else {
      inheritedProperties =
        teamCollectionAdapter.cascadeParentCollectionForHeaderAuth(folderPath)
    }

    const possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID: requestIndex,
    })

    if (possibleTab) {
      tabs.setActiveTab(possibleTab.value.id)
    } else {
      tabs.createNewTab({
        request: cloneDeep(request),
        isDirty: false,
        type: "request",
        saveContext: {
          originLocation: "team-collection",
          requestID: requestIndex,
          collectionID: folderPath,
          exampleID: undefined,
        },
        inheritedProperties: inheritedProperties,
      })
    }
  } else {
    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      folderPath,
      "rest"
    )
    possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      requestIndex: parseInt(requestIndex),
      folderPath: folderPath!,
    })
    if (possibleTab) {
      tabs.setActiveTab(possibleTab.value.id)
    } else {
      // If not, open the request in a new tab
      tabs.createNewTab({
        request: cloneDeep(request),
        isDirty: false,
        type: "request",
        saveContext: {
          originLocation: "user-collection",
          folderPath: folderPath!,
          requestIndex: parseInt(requestIndex),
        },
        inheritedProperties: {
          auth,
          headers,
        },
      })
    }
  }
}

const selectResponse = (payload: {
  folderPath: string
  requestIndex: string
  responseName: string
  request: HoppRESTRequest
  responseID: string
}) => {
  const { folderPath, requestIndex, responseName, request, responseID } =
    payload

  const response = request.responses[responseName]

  if (collectionsType.value.type === "my-collections") {
    const possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      requestIndex: parseInt(requestIndex),
      folderPath: folderPath!,
      exampleID: responseID,
    })

    if (possibleTab) {
      tabs.setActiveTab(possibleTab.value.id)
    } else {
      tabs.createNewTab({
        response: {
          ...cloneDeep(response),
          name: responseName,
        },
        isDirty: false,
        type: "example-response",
        saveContext: {
          originLocation: "user-collection",
          folderPath: folderPath!,
          requestIndex: parseInt(requestIndex),
          exampleID: responseID,
        },
      })
    }
  } else {
    const possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "team-collection",
      requestID: requestIndex,
      exampleID: responseID,
    })

    if (possibleTab) {
      tabs.setActiveTab(possibleTab.value.id)
    } else {
      tabs.createNewTab({
        response: {
          ...cloneDeep(response),
          name: responseName,
        },
        isDirty: false,
        type: "example-response",
        saveContext: {
          originLocation: "team-collection",
          requestID: requestIndex,
          collectionID: folderPath,
          exampleID: responseID,
        },
      })
    }
  }
}

/**
 * Used to get the index of the request from the path
 * @param path The path of the request
 * @returns The index of the request
 */
const pathToLastIndex = (path: string) => {
  const pathArr = path.split("/")
  return parseInt(pathArr[pathArr.length - 1])
}

/**
 * This function is called when the user drops the request inside a collection
 * @param payload Object that contains the folder path, request index and the destination collection index
 */
const dropRequest = (payload: {
  folderPath?: string | undefined
  requestIndex: string
  destinationCollectionIndex: string
}) => {
  const { folderPath, requestIndex, destinationCollectionIndex } = payload

  if (!requestIndex || !destinationCollectionIndex || !folderPath) return

  let possibleTab = null

  if (collectionsType.value.type === "my-collections") {
    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      destinationCollectionIndex,
      "rest"
    )

    possibleTab = tabs.getTabRefWithSaveContext({
      originLocation: "user-collection",
      folderPath,
      requestIndex: pathToLastIndex(requestIndex),
    })

    // If there is a tab attached to this request, change save its save context
    if (possibleTab && possibleTab.value.document.type === "request") {
      possibleTab.value.document.saveContext = {
        originLocation: "user-collection",
        folderPath: destinationCollectionIndex,
        requestIndex: getRequestsByPath(
          myCollections.value,
          destinationCollectionIndex
        ).length,
      }

      possibleTab.value.document.inheritedProperties = {
        auth,
        headers,
      }
    }

    // When it's drop it's basically getting deleted from last folder. reordering last folder accordingly
    resolveSaveContextOnRequestReorder({
      lastIndex: pathToLastIndex(requestIndex),
      newIndex: -1, // being deleted from last folder
      folderPath,
      length: getRequestsByPath(myCollections.value, folderPath).length,
    })
    moveRESTRequest(
      folderPath,
      pathToLastIndex(requestIndex),
      destinationCollectionIndex
    )

    toast.success(`${t("request.moved")}`)
    draggingToRoot.value = false
  } else if (hasTeamWriteAccess.value) {
    // add the request index to the loading array
    requestMoveLoading.value.push(requestIndex)

    pipe(
      moveRESTTeamRequest(destinationCollectionIndex, requestIndex),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          requestMoveLoading.value.splice(
            requestMoveLoading.value.indexOf(requestIndex),
            1
          )
        },
        () => {
          // remove the request index from the loading array
          requestMoveLoading.value.splice(
            requestMoveLoading.value.indexOf(requestIndex),
            1
          )
          const { auth, headers } =
            teamCollectionAdapter.cascadeParentCollectionForHeaderAuth(
              destinationCollectionIndex
            )

          possibleTab = tabs.getTabRefWithSaveContext({
            originLocation: "team-collection",
            requestID: requestIndex,
          })

          if (possibleTab && possibleTab.value.document.type === "request") {
            possibleTab.value.document.saveContext = {
              originLocation: "team-collection",
              requestID: requestIndex,
            }
            possibleTab.value.document.inheritedProperties = {
              auth,
              headers,
            }
          }
          toast.success(`${t("request.moved")}`)
        }
      )
    )()
  }
}

/**
 * @param path The path of the collection or request
 * @returns The index of the collection or request
 */
const pathToIndex = (path: string) => {
  const pathArr = path.split("/")
  return pathArr
}

/**
 * Used to check if the collection exist as the parent of the childrens
 * @param collectionIndexDragged The index of the collection dragged
 * @param destinationCollectionIndex The index of the destination collection
 * @returns True if the collection exist as the parent of the childrens
 */
const checkIfCollectionIsAParentOfTheChildren = (
  collectionIndexDragged: string,
  destinationCollectionIndex: string
) => {
  const collectionDraggedPath = pathToIndex(collectionIndexDragged)
  const destinationCollectionPath = pathToIndex(destinationCollectionIndex)

  if (collectionDraggedPath.length < destinationCollectionPath.length) {
    const slicedDestinationCollectionPath = destinationCollectionPath.slice(
      0,
      collectionDraggedPath.length
    )
    if (isEqual(slicedDestinationCollectionPath, collectionDraggedPath)) {
      return true
    }
    return false
  }

  return false
}

const isMoveToSameLocation = (
  draggedItemPath: string,
  destinationPath: string
) => {
  const draggedItemPathArr = pathToIndex(draggedItemPath)
  const destinationPathArr = pathToIndex(destinationPath)

  if (draggedItemPathArr.length > 0) {
    const draggedItemParentPathArr = draggedItemPathArr.slice(
      0,
      draggedItemPathArr.length - 1
    )

    if (isEqual(draggedItemParentPathArr, destinationPathArr)) {
      return true
    }
    return false
  }
}

/**
 * This function is called when the user moves the collection
 * to a different collection or folder
 * @param payload - object containing the collection index dragged and the destination collection index
 */
const dropCollection = (payload: {
  collectionIndexDragged: string
  destinationCollectionIndex: string
}) => {
  const { collectionIndexDragged, destinationCollectionIndex } = payload
  if (!collectionIndexDragged || !destinationCollectionIndex) return
  if (collectionIndexDragged === destinationCollectionIndex) return

  if (collectionsType.value.type === "my-collections") {
    if (
      checkIfCollectionIsAParentOfTheChildren(
        collectionIndexDragged,
        destinationCollectionIndex
      )
    ) {
      toast.error(`${t("team.parent_coll_move")}`)
      return
    }

    //check if the collection is being moved to its own parent
    if (
      isMoveToSameLocation(collectionIndexDragged, destinationCollectionIndex)
    ) {
      return
    }

    const parentFolder = collectionIndexDragged
      .split("/")
      .slice(0, -1)
      .join("/") // remove last folder to get parent folder
    const totalFoldersOfDestinationCollection =
      getFoldersByPath(myCollections.value, destinationCollectionIndex).length -
      (parentFolder === destinationCollectionIndex ? 1 : 0)

    moveRESTFolder(collectionIndexDragged, destinationCollectionIndex)

    resolveSaveContextOnCollectionReorder(
      {
        lastIndex: pathToLastIndex(collectionIndexDragged),
        newIndex: -1,
        folderPath: parentFolder,
        length: getFoldersByPath(myCollections.value, parentFolder).length,
      },
      "drop"
    )

    updateSaveContextForAffectedRequests(
      collectionIndexDragged,
      `${destinationCollectionIndex}/${totalFoldersOfDestinationCollection}`
    )

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      `${destinationCollectionIndex}/${totalFoldersOfDestinationCollection}`,
      "rest"
    )

    const inheritedProperty = {
      auth,
      headers,
    }

    updateInheritedPropertiesForAffectedRequests(
      `${destinationCollectionIndex}/${totalFoldersOfDestinationCollection}`,
      inheritedProperty,
      "rest"
    )

    draggingToRoot.value = false
    toast.success(`${t("collection.moved")}`)
  } else if (hasTeamWriteAccess.value) {
    // add the collection index to the loading array
    collectionMoveLoading.value.push(collectionIndexDragged)
    pipe(
      moveRESTTeamCollection(
        collectionIndexDragged,
        destinationCollectionIndex
      ),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          collectionMoveLoading.value.splice(
            collectionMoveLoading.value.indexOf(collectionIndexDragged),
            1
          )
        },
        () => {
          toast.success(`${t("collection.moved")}`)
          // remove the collection index from the loading array
          collectionMoveLoading.value.splice(
            collectionMoveLoading.value.indexOf(collectionIndexDragged),
            1
          )

          const { auth, headers } =
            teamCollectionAdapter.cascadeParentCollectionForHeaderAuth(
              destinationCollectionIndex
            )

          const inheritedProperty = {
            auth,
            headers,
          }

          updateInheritedPropertiesForAffectedRequests(
            `${destinationCollectionIndex}`,
            inheritedProperty,
            "rest"
          )
        }
      )
    )()
  }
}

/**
 * Checks if the collection is already in the root
 * @param id - path of the collection
 * @returns boolean - true if the collection is already in the root
 */
const isAlreadyInRoot = (id: string) => {
  const indexPath = pathToIndex(id)
  return indexPath.length === 1
}

/**
 * This function is called when the user drops the collection
 * to the root
 * @param payload - object containing the collection index dragged
 */
const dropToRoot = ({ dataTransfer }: DragEvent) => {
  if (dataTransfer) {
    const collectionIndexDragged = dataTransfer.getData("collectionIndex")
    if (!collectionIndexDragged) return
    if (collectionsType.value.type === "my-collections") {
      // check if the collection is already in the root
      if (isAlreadyInRoot(collectionIndexDragged)) {
        toast.error(`${t("collection.invalid_root_move")}`)
      } else {
        moveRESTFolder(collectionIndexDragged, null)
        toast.success(`${t("collection.moved")}`)

        const rootLength = myCollections.value.length

        updateSaveContextForAffectedRequests(
          collectionIndexDragged,
          `${rootLength - 1}`
        )
      }

      draggingToRoot.value = false
    } else if (hasTeamWriteAccess.value) {
      // add the collection index to the loading array
      collectionMoveLoading.value.push(collectionIndexDragged)

      // destination collection index is null since we are moving to root
      pipe(
        moveRESTTeamCollection(collectionIndexDragged, null),
        TE.match(
          (err: GQLError<string>) => {
            collectionMoveLoading.value.splice(
              collectionMoveLoading.value.indexOf(collectionIndexDragged),
              1
            )
            toast.error(`${getErrorMessage(err)}`)
          },
          () => {
            // remove the collection index from the loading array
            collectionMoveLoading.value.splice(
              collectionMoveLoading.value.indexOf(collectionIndexDragged),
              1
            )
            toast.success(`${t("collection.moved")}`)
          }
        )
      )()
    }
  }
}

/**
 * Used to check if the request/collection is being moved to the same parent since reorder is only allowed within the same parent
 * @param draggedItem - path index of the dragged request
 * @param destinationItem - path index of the destination request
 * @param destinationCollectionIndex -  index of the destination collection
 * @returns boolean - true if the request is being moved to the same parent
 */
const isSameSameParent = (
  draggedItemPath: string,
  destinationItemPath: string | null,
  destinationCollectionIndex: string | null
) => {
  const draggedItemIndex = pathToIndex(draggedItemPath)

  // if the destinationItemPath and destinationCollectionIndex is null, it means the request is being moved to the root
  if (destinationItemPath === null && destinationCollectionIndex === null) {
    return draggedItemIndex.length === 1
  } else if (
    destinationItemPath === null &&
    destinationCollectionIndex !== null &&
    draggedItemIndex.length === 1
  ) {
    return draggedItemIndex[0] === destinationCollectionIndex
  } else if (
    destinationItemPath === null &&
    draggedItemIndex.length !== 1 &&
    destinationCollectionIndex !== null
  ) {
    const dragedItemParent = draggedItemIndex.slice(0, -1)

    return dragedItemParent.join("/") === destinationCollectionIndex
  }
  if (destinationItemPath === null) return false
  const destinationItemIndex = pathToIndex(destinationItemPath)

  // length of 1 means the request is in the root
  if (draggedItemIndex.length === 1 && destinationItemIndex.length === 1) {
    return true
  } else if (draggedItemIndex.length === destinationItemIndex.length) {
    const dragedItemParent = draggedItemIndex.slice(0, -1)
    const destinationItemParent = destinationItemIndex.slice(0, -1)
    if (isEqual(dragedItemParent, destinationItemParent)) {
      return true
    }
    return false
  }
  return false
}

/**
 * This function is called when the user updates the request order in a collection
 * @param payload - object containing the request index dragged and the destination request index
 *  with the destination collection index
 */
const updateRequestOrder = (payload: {
  dragedRequestIndex: string
  destinationRequestIndex: string | null
  destinationCollectionIndex: string
}) => {
  const {
    dragedRequestIndex,
    destinationRequestIndex,
    destinationCollectionIndex,
  } = payload

  if (!dragedRequestIndex || !destinationCollectionIndex) return

  if (dragedRequestIndex === destinationRequestIndex) return

  if (collectionsType.value.type === "my-collections") {
    if (
      !isSameSameParent(
        dragedRequestIndex,
        destinationRequestIndex,
        destinationCollectionIndex
      )
    ) {
      toast.error(`${t("collection.different_parent")}`)
    } else {
      updateRESTRequestOrder(
        pathToLastIndex(dragedRequestIndex),
        destinationRequestIndex
          ? pathToLastIndex(destinationRequestIndex)
          : null,
        destinationCollectionIndex
      )

      toast.success(`${t("request.order_changed")}`)
    }
  } else if (hasTeamWriteAccess.value) {
    // add the request index to the loading array
    requestMoveLoading.value.push(dragedRequestIndex)

    pipe(
      updateOrderRESTTeamRequest(
        dragedRequestIndex,
        destinationRequestIndex,
        destinationCollectionIndex
      ),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          requestMoveLoading.value.splice(
            requestMoveLoading.value.indexOf(dragedRequestIndex),
            1
          )
        },
        () => {
          toast.success(`${t("request.order_changed")}`)

          // remove the request index from the loading array
          requestMoveLoading.value.splice(
            requestMoveLoading.value.indexOf(dragedRequestIndex),
            1
          )
        }
      )
    )()
  }
}

/**
 * This function is called when the user updates the collection or folder order
 * @param payload - object containing the collection index dragged and the destination collection index
 */
const updateCollectionOrder = (payload: {
  dragedCollectionIndex: string
  destinationCollection: {
    destinationCollectionIndex: string | null
    destinationCollectionParentIndex: string | null
  }
}) => {
  const { dragedCollectionIndex, destinationCollection } = payload
  const { destinationCollectionIndex, destinationCollectionParentIndex } =
    destinationCollection
  if (!dragedCollectionIndex) return
  if (dragedCollectionIndex === destinationCollectionIndex) return

  if (collectionsType.value.type === "my-collections") {
    if (
      !isSameSameParent(
        dragedCollectionIndex,
        destinationCollectionIndex,
        destinationCollectionParentIndex
      )
    ) {
      toast.error(`${t("collection.different_parent")}`)
    } else {
      updateRESTCollectionOrder(
        dragedCollectionIndex,
        destinationCollectionIndex
      )
      resolveSaveContextOnCollectionReorder({
        lastIndex: pathToLastIndex(dragedCollectionIndex),
        newIndex: pathToLastIndex(
          destinationCollectionIndex ? destinationCollectionIndex : ""
        ),
        folderPath: dragedCollectionIndex.split("/").slice(0, -1).join("/"),
      })
      toast.success(`${t("collection.order_changed")}`)
    }
  } else if (hasTeamWriteAccess.value) {
    collectionMoveLoading.value.push(dragedCollectionIndex)
    pipe(
      updateOrderRESTTeamCollection(
        dragedCollectionIndex,
        destinationCollectionIndex
      ),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          collectionMoveLoading.value.splice(
            collectionMoveLoading.value.indexOf(dragedCollectionIndex),
            1
          )
        },
        () => {
          toast.success(`${t("collection.order_changed")}`)
          collectionMoveLoading.value.splice(
            collectionMoveLoading.value.indexOf(dragedCollectionIndex),
            1
          )
        }
      )
    )()
  }
}
// Import - Export Collection functions

/**
 * Create a downloadable file from a collection and prompts the user to download it.
 * @param collectionJSON - JSON string of the collection
 * @param name - Name of the collection set as the file name
 */
const initializeDownloadCollection = async (
  collectionJSON: string,
  name: string | null
) => {
  const result = await platform.io.saveFileWithDialog({
    data: collectionJSON,
    contentType: "application/json",
    suggestedFilename: `${name ?? "collection"}.json`,
    filters: [
      {
        name: "Hoppscotch Collection JSON file",
        extensions: ["json"],
      },
    ],
  })

  if (result.type === "unknown" || result.type === "saved") {
    toast.success(t("state.download_started").toString())
  }
}

/**
 * Export a specific collection or folder
 * Triggered by the export button in the tippy menu
 * @param collection - Collection or folder to be exported
 */
const exportData = async (collection: HoppCollection | TeamCollection) => {
  if (collectionsType.value.type === "my-collections") {
    const collectionJSON = JSON.stringify(collection)

    const name = (collection as HoppCollection).name

    initializeDownloadCollection(collectionJSON, name)
  } else {
    if (!collection.id) return
    exportLoading.value = true

    pipe(
      getCompleteCollectionTree(collection.id),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          exportLoading.value = false
          return
        },
        async (coll) => {
          const hoppColl = teamCollToHoppRESTColl(coll)
          const collectionJSONString = JSON.stringify(hoppColl)

          await initializeDownloadCollection(
            collectionJSONString,
            hoppColl.name
          )
          exportLoading.value = false
        }
      )
    )()
  }
}

const shareRequest = ({ request }: { request: HoppRESTRequest }) => {
  if (currentUser.value) {
    // opens the share request modal
    invokeAction("share.request", {
      request,
    })
  } else {
    invokeAction("modals.login.toggle")
  }
}

const editProperties = (payload: {
  collectionIndex: string
  collection: HoppCollection | TeamCollection
}) => {
  const { collection, collectionIndex } = payload

  if (collectionsType.value.type === "my-collections") {
    const parentIndex = collectionIndex.split("/").slice(0, -1).join("/") // remove last folder to get parent folder

    let inheritedProperties = {
      auth: {
        parentID: "",
        parentName: "",
        inheritedAuth: {
          authType: "inherit",
          authActive: true,
        },
      },
      headers: [
        {
          parentID: "",
          parentName: "",
          inheritedHeader: {},
        },
      ],
    } as HoppInheritedProperty

    if (parentIndex) {
      const { auth, headers } = cascadeParentCollectionForHeaderAuth(
        parentIndex,
        "rest"
      )

      inheritedProperties = {
        auth,
        headers,
      }
    }

    editingProperties.value = {
      collection: collection as Partial<HoppCollection>,
      isRootCollection: isAlreadyInRoot(collectionIndex),
      path: collectionIndex,
      inheritedProperties,
    }
  } else if (hasTeamWriteAccess.value) {
    const parentIndex = collectionIndex.split("/").slice(0, -1).join("/") // remove last folder to get parent folder

    const data = (collection as TeamCollection).data
      ? JSON.parse((collection as TeamCollection).data ?? "")
      : null

    let inheritedProperties = undefined
    let coll = {
      id: collection.id,
      name: (collection as TeamCollection).title,
      auth: {
        authType: "inherit",
        authActive: true,
      } as HoppRESTAuth,
      headers: [] as HoppRESTHeaders,
      folders: null,
      requests: null,
    }

    if (parentIndex) {
      const { auth, headers } =
        teamCollectionAdapter.cascadeParentCollectionForHeaderAuth(parentIndex)

      inheritedProperties = {
        auth,
        headers,
      }
    }

    if (data) {
      coll = {
        ...coll,
        auth: data.auth,
        headers: data.headers as HoppRESTHeaders,
      }
    }

    editingProperties.value = {
      collection: coll as unknown as Partial<HoppCollection>,
      isRootCollection: isAlreadyInRoot(collectionIndex),
      path: collectionIndex,
      inheritedProperties,
    }
  }

  displayModalEditProperties(true)
}

const setCollectionProperties = (newCollection: {
  collection: Partial<HoppCollection> | null
  isRootCollection: boolean
  path: string
}) => {
  const { collection, path, isRootCollection } = newCollection
  if (!collection) return

  if (collectionsType.value.type === "my-collections") {
    if (isRootCollection) {
      editRESTCollection(parseInt(path), collection)
    } else {
      editRESTFolder(path, collection)
    }

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(path, "rest")

    nextTick(() => {
      updateInheritedPropertiesForAffectedRequests(
        path,
        {
          auth,
          headers,
        },
        "rest"
      )
    })
    toast.success(t("collection.properties_updated"))
  } else if (hasTeamWriteAccess.value && collection.id) {
    const data = {
      auth: collection.auth,
      headers: collection.headers,
    }
    pipe(
      updateTeamCollection(collection.id, JSON.stringify(data), undefined),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
        },
        () => {
          toast.success(t("collection.properties_updated"))
        }
      )
    )()

    //This is a hack to update the inherited properties of the requests if there an tab opened
    // since it takes a little bit of time to update the collection tree
    setTimeout(() => {
      const { auth, headers } =
        teamCollectionAdapter.cascadeParentCollectionForHeaderAuth(path)
      updateInheritedPropertiesForAffectedRequests(
        path,
        {
          auth,
          headers,
        },
        "rest"
      )
    }, 200)
  }

  displayModalEditProperties(false)
}

const runCollectionHandler = (collectionID: string) => {
  selectedCollectionID.value = collectionID
  showCollectionsRunnerModal.value = true

  const activeWorkspace = workspace.value
  const currentEnv = selectedEnvironmentIndex.value

  if (["NO_ENV_SELECTED", "MY_ENV"].includes(currentEnv.type)) {
    activeEnvironmentID.value = null
    return
  }

  if (activeWorkspace.type === "team" && currentEnv.type === "TEAM_ENV") {
    activeEnvironmentID.value = teamEnvironmentList.value.find(
      (env) =>
        env.teamID === activeWorkspace.teamID &&
        env.environment.id === currentEnv.environment.id
    )?.environment.id
  }
}

const resolveConfirmModal = (title: string | null) => {
  if (title === `${t("confirm.remove_collection")}`) onRemoveCollection()
  else if (title === `${t("confirm.remove_request")}`) onRemoveRequest()
  else if (title === `${t("confirm.remove_folder")}`) onRemoveFolder()
  else if (title === `${t("confirm.remove_response")}`) onRemoveResponse()
  else {
    console.error(
      `Confirm modal title ${title} is not handled by the component`
    )
    toast.error(t("error.something_went_wrong"))
    displayConfirmModal(false)
  }
}

const resetSelectedData = () => {
  editingCollection.value = null
  editingCollectionIndex.value = null
  editingCollectionID.value = null
  editingFolder.value = null
  editingFolderPath.value = null
  editingRequest.value = null
  editingRequestIndex.value = null
  editingRequestID.value = null
  confirmModalTitle.value = null
}

const getErrorMessage = (err: GQLError<string>) => {
  console.error(err)
  if (err.type === "network_error") {
    return t("error.network_error")
  }
  switch (err.error) {
    case "team_coll/short_title":
      return t("collection.name_length_insufficient")
    case "team/invalid_coll_id":
    case "bug/team_coll/no_coll_id":
    case "team_req/invalid_target_id":
      return t("team.invalid_coll_id")
    case "team/not_required_role":
      return t("profile.no_permission")
    case "team_req/not_required_role":
      return t("profile.no_permission")
    case "Forbidden resource":
      return t("profile.no_permission")
    case "team_req/not_found":
      return t("team.no_request_found")
    case "bug/team_req/no_req_id":
      return t("team.no_request_found")
    case "team/collection_is_parent_coll":
      return t("team.parent_coll_move")
    case "team/target_and_destination_collection_are_same":
      return t("team.same_target_destination")
    case "team/target_collection_is_already_root_collection":
      return t("collection.invalid_root_move")
    case "team_req/requests_not_from_same_collection":
      return t("request.different_collection")
    case "team/team_collections_have_different_parents":
      return t("collection.different_parent")
    default:
      return t("error.something_went_wrong")
  }
}

defineActionHandler("collection.new", () => {
  displayModalAdd(true)
})
defineActionHandler("modals.collection.import", () => {
  displayModalImportExport(true)
})
</script>
