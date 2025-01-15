<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky z-10 flex flex-1 justify-between border-b border-dividerLight bg-primary"
      :style="
        saveRequest
          ? 'top: calc(var(--upper-primary-sticky-fold) - var(--line-height-body))'
          : 'top: var(--upper-primary-sticky-fold)'
      "
    >
      <HoppButtonSecondary
        v-if="hasNoTeamAccess || isShowingSearchResults"
        v-tippy="{ theme: 'tooltip' }"
        disabled
        class="!rounded-none"
        :icon="IconPlus"
        :title="t('team.no_access')"
        :label="t('action.new')"
      />
      <HoppButtonSecondary
        v-else
        :icon="IconPlus"
        :label="t('action.new')"
        class="!rounded-none"
        @click="emit('display-modal-add')"
      />
      <span class="flex">
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
          :disabled="
            (collectionsType.type === 'team-collections' &&
              collectionsType.selectedTeam === undefined) ||
            isShowingSearchResults
          "
          :icon="IconImport"
          :title="t('modal.import_export')"
          @click="emit('display-modal-import-export')"
        />
      </span>
    </div>
    <div class="flex flex-col overflow-hidden">
      <HoppSmartTree :adapter="teamAdapter">
        <template
          #content="{ node, toggleChildren, isOpen, highlightChildren }"
        >
          <CollectionsCollection
            v-if="node.data.type === 'collections'"
            :id="node.data.data.data.id"
            :parent-i-d="node.data.data.parentIndex"
            :data="node.data.data.data"
            :collections-type="collectionsType.type"
            :is-open="isOpen"
            :export-loading="exportLoading"
            :has-no-team-access="hasNoTeamAccess || isShowingSearchResults"
            :collection-move-loading="collectionMoveLoading"
            :duplicate-collection-loading="duplicateCollectionLoading"
            :is-last-item="node.data.isLastItem"
            :is-selected="
              isSelected({
                collectionID: node.id,
              })
            "
            folder-type="collection"
            @add-request="
              node.data.type === 'collections' &&
                emit('add-request', {
                  path: node.id,
                  folder: node.data.data.data,
                })
            "
            @add-folder="
              node.data.type === 'collections' &&
                emit('add-folder', {
                  path: node.id,
                  folder: node.data.data.data,
                })
            "
            @edit-collection="
              node.data.type === 'collections' &&
                emit('edit-collection', {
                  collectionIndex: node.id,
                  collection: node.data.data.data,
                })
            "
            @duplicate-collection="
              node.data.type === 'collections' &&
                emit('duplicate-collection', {
                  pathOrID: node.data.data.data.id,
                })
            "
            @edit-properties="
              node.data.type === 'collections' &&
                emit('edit-properties', {
                  collectionIndex: node.id,
                  collection: node.data.data.data,
                })
            "
            @export-data="
              node.data.type === 'collections' &&
                emit('export-data', node.data.data.data)
            "
            @remove-collection="emit('remove-collection', node.id)"
            @drop-event="dropEvent($event, node.id)"
            @drag-event="dragEvent($event, node.id)"
            @update-collection-order="
              updateCollectionOrder($event, {
                destinationCollectionIndex: node.data.data.data.id,
                destinationCollectionParentIndex: node.data.data.parentIndex,
              })
            "
            @update-last-collection-order="
              updateCollectionOrder($event, {
                destinationCollectionIndex: null,
                destinationCollectionParentIndex: node.data.data.parentIndex,
              })
            "
            @dragging="
              (isDraging: boolean) =>
                highlightChildren(isDraging ? node.data.data.data.id : null)
            "
            @toggle-children="
              () => {
                toggleChildren(),
                  saveRequest &&
                    emit('select', {
                      pickedType: 'teams-collection',
                      collectionID: node.id,
                    })
              }
            "
            @run-collection="
              emit('run-collection', {
                collectionID: node.data.data.data.id,
                path: node.id,
              })
            "
            @click="
              () => {
                handleCollectionClick({
                  collectionID: node.id,
                  isOpen,
                })
              }
            "
          />
          <CollectionsCollection
            v-if="node.data.type === 'folders'"
            :id="node.data.data.data.id"
            :parent-i-d="node.data.data.parentIndex"
            :data="node.data.data.data"
            :collections-type="collectionsType.type"
            :is-open="isOpen"
            :export-loading="exportLoading"
            :has-no-team-access="hasNoTeamAccess || isShowingSearchResults"
            :collection-move-loading="collectionMoveLoading"
            :duplicate-collection-loading="duplicateCollectionLoading"
            :is-last-item="node.data.isLastItem"
            :is-selected="
              isSelected({
                folderID: node.data.data.data.id,
              })
            "
            folder-type="folder"
            @add-request="
              node.data.type === 'folders' &&
                emit('add-request', {
                  path: node.id,
                  folder: node.data.data.data,
                })
            "
            @add-folder="
              node.data.type === 'folders' &&
                emit('add-folder', {
                  path: node.id,
                  folder: node.data.data.data,
                })
            "
            @edit-collection="
              node.data.type === 'folders' &&
                emit('edit-folder', {
                  folder: node.data.data.data,
                })
            "
            @duplicate-collection="
              node.data.type === 'folders' &&
                emit('duplicate-collection', {
                  pathOrID: node.data.data.data.id,
                })
            "
            @edit-properties="
              node.data.type === 'folders' &&
                emit('edit-properties', {
                  collectionIndex: node.id,
                  collection: node.data.data.data,
                })
            "
            @export-data="
              node.data.type === 'folders' &&
                emit('export-data', node.data.data.data)
            "
            @remove-collection="
              node.data.type === 'folders' &&
                emit('remove-folder', node.data.data.data.id)
            "
            @drop-event="dropEvent($event, node.data.data.data.id)"
            @drag-event="dragEvent($event, node.data.data.data.id)"
            @update-collection-order="
              updateCollectionOrder($event, {
                destinationCollectionIndex: node.data.data.data.id,
                destinationCollectionParentIndex: node.data.data.parentIndex,
              })
            "
            @update-last-collection-order="
              updateCollectionOrder($event, {
                destinationCollectionIndex: null,
                destinationCollectionParentIndex: node.data.data.parentIndex,
              })
            "
            @dragging="
              (isDraging: boolean) =>
                highlightChildren(isDraging ? node.data.data.data.id : null)
            "
            @toggle-children="
              () => {
                toggleChildren(),
                  saveRequest &&
                    emit('select', {
                      pickedType: 'teams-folder',
                      folderID: node.data.data.data.id,
                    })
              }
            "
            @run-collection="
              emit('run-collection', {
                collectionID: node.data.data.data.id,
                path: node.id,
              })
            "
            @click="
              () => {
                handleCollectionClick({
                  // for the folders, we get a path, so we need to get the last part of the path which is the folder id
                  collectionID: node.id.split('/').pop() as string,
                  isOpen,
                })
              }
            "
          />
          <CollectionsRequest
            v-if="node.data.type === 'requests'"
            :request="node.data.data.data.request"
            :request-i-d="node.data.data.data.id"
            :parent-i-d="node.data.data.parentIndex"
            :collections-type="collectionsType.type"
            :duplicate-request-loading="duplicateRequestLoading"
            :is-active="isActiveRequest(node.data.data.data.id)"
            :has-no-team-access="hasNoTeamAccess || isShowingSearchResults"
            :request-move-loading="requestMoveLoading"
            :is-last-item="node.data.isLastItem"
            :is-selected="
              isSelected({
                requestID: node.data.data.data.id,
              })
            "
            @edit-request="
              node.data.type === 'requests' &&
                emit('edit-request', {
                  requestIndex: node.data.data.data.id,
                  request: node.data.data.data.request,
                })
            "
            @edit-response="
              emit('edit-response', {
                folderPath: node.data.data.parentIndex,
                requestIndex: node.data.data.data.id,
                request: node.data.data.data.request,
                responseName: $event.responseName,
                responseID: $event.responseID,
              })
            "
            @duplicate-request="
              node.data.type === 'requests' &&
                emit('duplicate-request', {
                  folderPath: node.data.data.parentIndex,
                  request: node.data.data.data.request,
                })
            "
            @duplicate-response="
              emit('duplicate-response', {
                folderPath: node.data.data.parentIndex,
                requestIndex: node.data.data.data.id,
                request: node.data.data.data.request,
                responseName: $event.responseName,
                responseID: $event.responseID,
              })
            "
            @remove-request="
              node.data.type === 'requests' &&
                emit('remove-request', {
                  folderPath: null,
                  requestIndex: node.data.data.data.id,
                })
            "
            @remove-response="
              emit('remove-response', {
                folderPath: node.data.data.parentIndex,
                requestIndex: node.data.data.data.id,
                request: node.data.data.data.request,
                responseName: $event.responseName,
                responseID: $event.responseID,
              })
            "
            @select-request="
              node.data.type === 'requests' &&
                selectRequest({
                  request: node.data.data.data.request,
                  requestIndex: node.data.data.data.id,
                  folderPath: getPath(node.id),
                })
            "
            @select-response="
              emit('select-response', {
                responseName: $event.responseName,
                responseID: $event.responseID,
                request: node.data.data.data.request,
                folderPath: getPath(node.id),
                requestIndex: node.data.data.data.id,
              })
            "
            @share-request="
              node.data.type === 'requests' &&
                emit('share-request', {
                  request: node.data.data.data.request,
                })
            "
            @drag-request="
              dragRequest($event, {
                folderPath: node.data.data.parentIndex,
                requestIndex: node.data.data.data.id,
              })
            "
            @update-request-order="
              updateRequestOrder($event, {
                folderPath: node.data.data.parentIndex,
                requestIndex: node.data.data.data.id,
              })
            "
            @update-last-request-order="
              updateRequestOrder($event, {
                folderPath: node.data.data.parentIndex,
                requestIndex: null,
              })
            "
          />
        </template>
        <template #emptyNode="{ node }">
          <HoppSmartPlaceholder
            v-if="filterText.length !== 0 && teamCollectionList.length === 0"
            :text="`${t('state.nothing_found')} ‟${filterText}”`"
          >
            <template #icon>
              <icon-lucide-search class="svg-icons opacity-75" />
            </template>
          </HoppSmartPlaceholder>
          <HoppSmartPlaceholder
            v-else-if="node === null"
            :src="`/images/states/${colorMode.value}/pack.svg`"
            :alt="`${t('empty.collections')}`"
            :text="t('empty.collections')"
            @drop.stop
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
                    :disabled="hasNoTeamAccess"
                    :title="hasNoTeamAccess ? t('team.no_access') : ''"
                    @click="
                      hasNoTeamAccess
                        ? null
                        : emit('display-modal-import-export')
                    "
                  />
                  <HoppButtonSecondary
                    :icon="IconPlus"
                    :label="t('add.new')"
                    filled
                    outline
                    :disabled="hasNoTeamAccess"
                    :title="hasNoTeamAccess ? t('team.no_access') : ''"
                    @click="hasNoTeamAccess ? null : emit('display-modal-add')"
                  />
                </div>
              </div>
            </template>
          </HoppSmartPlaceholder>
          <HoppSmartPlaceholder
            v-else-if="node.data.type === 'collections'"
            :src="`/images/states/${colorMode.value}/pack.svg`"
            :alt="`${t('empty.collections')}`"
            :text="t('empty.collections')"
            @drop.stop
          >
            <template #body>
              <HoppButtonSecondary
                :label="t('add.new')"
                filled
                outline
                @click="
                  node.data.type === 'collections' &&
                    emit('add-folder', {
                      path: node.id,
                      folder: node.data.data.data,
                    })
                "
              />
            </template>
          </HoppSmartPlaceholder>
          <HoppSmartPlaceholder
            v-else-if="node.data.type === 'folders'"
            :src="`/images/states/${colorMode.value}/pack.svg`"
            :alt="`${t('empty.folder')}`"
            :text="t('empty.folder')"
            @drop.stop
          />
        </template>
      </HoppSmartTree>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconPlus from "~icons/lucide/plus"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconImport from "~icons/lucide/folder-down"
import { computed, PropType, Ref, toRef } from "vue"
import { useI18n } from "@composables/i18n"
import { useColorMode } from "@composables/theming"
import { TeamCollection } from "~/helpers/teams/TeamCollection"
import { TeamRequest } from "~/helpers/teams/TeamRequest"
import { ChildrenResult, SmartTreeAdapter } from "@hoppscotch/ui/helpers"
import { cloneDeep } from "lodash-es"
import { HoppRESTRequest } from "@hoppscotch/data"
import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import { Picked } from "~/helpers/types/HoppPicked.js"
import { RESTTabService } from "~/services/tab/rest"
import { useService } from "dioc/vue"
import { TeamWorkspace } from "~/services/workspace.service"

const t = useI18n()
const colorMode = useColorMode()
const tabs = useService(RESTTabService)

type CollectionType =
  | {
      type: "team-collections"
      selectedTeam: TeamWorkspace
    }
  | { type: "my-collections"; selectedTeam: undefined }

const props = defineProps({
  collectionsType: {
    type: Object as PropType<CollectionType>,
    default: () => ({ type: "my-collections", selectedTeam: undefined }),
    required: true,
  },
  filterText: {
    type: String as PropType<string>,
    default: "",
    required: true,
  },
  teamCollectionList: {
    type: Array as PropType<TeamCollection[]>,
    default: () => [],
    required: true,
  },
  teamLoadingCollections: {
    type: Array as PropType<string[]>,
    default: () => [],
    required: true,
  },
  saveRequest: {
    type: Boolean,
    default: false,
    required: false,
  },
  exportLoading: {
    type: Boolean,
    default: false,
    required: false,
  },
  duplicateRequestLoading: {
    type: Boolean,
    default: false,
    required: false,
  },
  duplicateCollectionLoading: {
    type: Boolean,
    default: false,
    required: false,
  },
  picked: {
    type: Object as PropType<Picked | null>,
    default: null,
    required: false,
  },
  collectionMoveLoading: {
    type: Array as PropType<string[]>,
    default: () => [],
    required: false,
  },
  requestMoveLoading: {
    type: Array as PropType<string[]>,
    default: () => [],
    required: false,
  },
})

const isShowingSearchResults = computed(() => props.filterText.length > 0)

type ResponsePayload = {
  folderPath: string
  requestIndex: string
  request: HoppRESTRequest
  responseName: string
  responseID: string
}

const emit = defineEmits<{
  (
    event: "add-request",
    payload: {
      path: string
      folder: TeamCollection
    }
  ): void
  (
    event: "add-folder",
    payload: {
      path: string
      folder: TeamCollection
    }
  ): void
  (
    event: "edit-collection",
    payload: {
      collectionIndex: string
      collection: TeamCollection
    }
  ): void
  (
    event: "edit-folder",
    payload: {
      folder: TeamCollection
    }
  ): void
  (
    event: "duplicate-collection",
    payload: {
      pathOrID: string
      collectionSyncID?: string
    }
  ): void
  (
    event: "edit-properties",
    payload: {
      collectionIndex: string
      collection: TeamCollection
    }
  ): void
  (
    event: "edit-request",
    payload: {
      requestIndex: string
      request: HoppRESTRequest
    }
  ): void
  (event: "edit-response", payload: ResponsePayload): void
  (
    event: "duplicate-request",
    payload: {
      folderPath: string
      request: HoppRESTRequest
    }
  ): void
  (event: "duplicate-response", payload: ResponsePayload): void
  (event: "export-data", payload: TeamCollection): void
  (event: "remove-collection", payload: string): void
  (event: "remove-folder", payload: string): void
  (
    event: "remove-request",
    payload: {
      folderPath: string | null
      requestIndex: string
    }
  ): void
  (event: "remove-response", payload: ResponsePayload): void
  (
    event: "select-request",
    payload: {
      request: HoppRESTRequest
      requestIndex: string
      isActive: boolean
      folderPath: string
    }
  ): void
  (event: "select-response", payload: ResponsePayload): void
  (
    event: "share-request",
    payload: {
      request: HoppRESTRequest
    }
  ): void
  (
    event: "drop-request",
    payload: {
      folderPath: string
      requestIndex: string
      destinationCollectionIndex: string
    }
  ): void
  (
    event: "drop-collection",
    payload: {
      collectionIndexDragged: string
      destinationCollectionIndex: string
    }
  ): void
  (
    event: "update-request-order",
    payload: {
      dragedRequestIndex: string
      destinationRequestIndex: string | null
      destinationCollectionIndex: string
    }
  ): void
  (
    event: "update-collection-order",
    payload: {
      dragedCollectionIndex: string
      destinationCollection: {
        destinationCollectionIndex: string | null
        destinationCollectionParentIndex: string | null
      }
    }
  ): void
  (
    event: "collection-click",
    payload: {
      // if the collection is open or not in the tree
      isOpen: boolean
      collectionID: string
    }
  ): void
  (event: "select", payload: Picked | null): void
  (event: "expand-team-collection", payload: string): void
  (event: "display-modal-add"): void
  (event: "display-modal-import-export"): void
  (
    event: "run-collection",
    payload: { collectionID: string; path: string }
  ): void
}>()

const getPath = (path: string) => {
  const pathArray = path.split("/")
  pathArray.pop()
  return pathArray.join("/")
}

const handleCollectionClick = (payload: {
  collectionID: string
  isOpen: boolean
}) => {
  const { collectionID, isOpen } = payload

  emit("collection-click", {
    collectionID,
    isOpen,
  })
}

const teamCollectionsList = toRef(props, "teamCollectionList")

const hasNoTeamAccess = computed(
  () =>
    props.collectionsType.type === "team-collections" &&
    (props.collectionsType.selectedTeam === undefined ||
      props.collectionsType.selectedTeam.role === "VIEWER")
)

const isSelected = ({
  collectionID,
  folderID,
  requestID,
}: {
  collectionID?: string | undefined
  folderID?: string | undefined
  requestID?: string | undefined
}) => {
  if (collectionID !== undefined) {
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
  }
  return (
    props.picked &&
    props.picked.pickedType === "teams-folder" &&
    props.picked.folderID === folderID
  )
}

const active = computed(() => tabs.currentActiveTab.value.document.saveContext)

const isActiveRequest = (requestID: string) => {
  return pipe(
    active.value,
    O.fromNullable,
    O.filter(
      (active) =>
        active.originLocation === "team-collection" &&
        active.requestID === requestID &&
        active.exampleID === undefined
    ),
    O.isSome
  )
}

const selectRequest = (data: {
  request: HoppRESTRequest
  requestIndex: string
  folderPath: string | null
}) => {
  const { request, requestIndex } = data
  if (props.saveRequest) {
    emit("select", {
      pickedType: "teams-request",
      requestID: requestIndex,
    })
  } else {
    emit("select-request", {
      request: request,
      requestIndex: requestIndex,
      isActive: isActiveRequest(requestIndex),
      folderPath: data.folderPath ?? "",
    })
  }
}

const dragRequest = (
  dataTransfer: DataTransfer,
  {
    folderPath,
    requestIndex,
  }: { folderPath: string | null; requestIndex: string }
) => {
  if (!folderPath) return
  dataTransfer.setData("folderPath", folderPath)
  dataTransfer.setData("requestIndex", requestIndex)
}

const dragEvent = (dataTransfer: DataTransfer, collectionIndex: string) => {
  dataTransfer.setData("collectionIndex", collectionIndex)
}

const dropEvent = (
  dataTransfer: DataTransfer,
  destinationCollectionIndex: string
) => {
  const folderPath = dataTransfer.getData("folderPath")
  const requestIndex = dataTransfer.getData("requestIndex")
  const collectionIndexDragged = dataTransfer.getData("collectionIndex")
  if (folderPath && requestIndex) {
    emit("drop-request", {
      folderPath,
      requestIndex,
      destinationCollectionIndex,
    })
  } else {
    emit("drop-collection", {
      collectionIndexDragged,
      destinationCollectionIndex,
    })
  }
}

const updateRequestOrder = (
  dataTransfer: DataTransfer,
  {
    folderPath,
    requestIndex,
  }: { folderPath: string | null; requestIndex: string | null }
) => {
  if (!folderPath) return
  const dragedRequestIndex = dataTransfer.getData("requestIndex")
  const destinationRequestIndex = requestIndex
  const destinationCollectionIndex = folderPath

  emit("update-request-order", {
    dragedRequestIndex,
    destinationRequestIndex,
    destinationCollectionIndex,
  })
}

const updateCollectionOrder = (
  dataTransfer: DataTransfer,
  destinationCollection: {
    destinationCollectionIndex: string | null
    destinationCollectionParentIndex: string | null
  }
) => {
  const dragedCollectionIndex = dataTransfer.getData("collectionIndex")

  emit("update-collection-order", {
    dragedCollectionIndex,
    destinationCollection,
  })
}

type TeamCollections = {
  isLastItem: boolean
  type: "collections"
  data: {
    parentIndex: null
    data: TeamCollection
  }
}

type TeamFolder = {
  isLastItem: boolean
  type: "folders"
  data: {
    parentIndex: string
    data: TeamCollection
  }
}

type TeamRequests = {
  isLastItem: boolean
  type: "requests"
  data: {
    parentIndex: string
    data: TeamRequest
  }
}

type TeamCollectionNode = TeamCollections | TeamFolder | TeamRequests

class TeamCollectionsAdapter implements SmartTreeAdapter<TeamCollectionNode> {
  constructor(public data: Ref<TeamCollection[]>) {}

  findCollInTree(
    tree: TeamCollection[],
    targetID: string
  ): TeamCollection | null {
    for (const coll of tree) {
      // If the direct child matched, then return that
      if (coll.id === targetID) return coll

      // Else run it in the children
      if (coll.children) {
        const result = this.findCollInTree(coll.children, targetID)
        if (result) return result
      }
    }

    // If nothing matched, return null
    return null
  }

  getChildren(id: string | null): Ref<ChildrenResult<TeamCollectionNode>> {
    return computed(() => {
      if (id === null) {
        if (props.teamLoadingCollections.includes("root")) {
          return {
            status: "loading",
          }
        }
        const data = this.data.value.map((item, index) => ({
          id: item.id,
          data: {
            isLastItem: index === this.data.value.length - 1,
            type: "collections",
            data: {
              parentIndex: null,
              data: item,
            },
          },
        }))
        return {
          status: "loaded",
          data: cloneDeep(data),
        } as ChildrenResult<TeamCollections>
      }
      const parsedID = id.split("/")[id.split("/").length - 1]

      !props.teamLoadingCollections.includes(parsedID) &&
        emit("expand-team-collection", parsedID)

      if (props.teamLoadingCollections.includes(parsedID)) {
        return {
          status: "loading",
        }
      }
      const items = this.findCollInTree(this.data.value, parsedID)
      if (items) {
        const data = [
          ...(items.children
            ? items.children.map((item, index) => ({
                id: `${id}/${item.id}`,
                data: {
                  isLastItem:
                    items.children && items.children.length > 1
                      ? index === items.children.length - 1
                      : false,
                  type: "folders",
                  data: {
                    parentIndex: parsedID,
                    data: item,
                  },
                },
              }))
            : []),
          ...(items.requests
            ? items.requests.map((item, index) => ({
                id: `${id}/${item.id}`,
                data: {
                  isLastItem:
                    items.requests && items.requests.length > 1
                      ? index === items.requests.length - 1
                      : false,
                  type: "requests",
                  data: {
                    parentIndex: parsedID,
                    data: item,
                  },
                },
              }))
            : []),
        ]
        return {
          status: "loaded",
          data: cloneDeep(data),
        } as ChildrenResult<TeamFolder | TeamRequests>
      }
      return {
        status: "loaded",
        data: [],
      }
    })
  }
}

const teamAdapter: SmartTreeAdapter<TeamCollectionNode> =
  new TeamCollectionsAdapter(teamCollectionsList)
</script>
