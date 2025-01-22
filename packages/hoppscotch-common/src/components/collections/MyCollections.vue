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
          :icon="IconImport"
          :title="t('modal.import_export')"
          @click="emit('display-modal-import-export')"
        />
      </span>
    </div>
    <div class="flex flex-1 flex-col">
      <HoppSmartTree :adapter="myAdapter">
        <template
          #content="{ node, toggleChildren, isOpen, highlightChildren }"
        >
          <CollectionsCollection
            v-if="node.data.type === 'collections'"
            :id="node.id"
            :parent-i-d="node.data.data.parentIndex"
            :data="node.data.data.data"
            :collections-type="collectionsType.type"
            :is-open="isOpen"
            :is-last-item="node.data.isLastItem"
            :is-selected="
              isSelected({
                collectionIndex: parseInt(node.id),
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
            @run-collection="
              emit('run-collection', {
                collectionIndex: node.id,
                collection: node.data.data.data,
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
                  pathOrID: node.id,
                  collectionSyncID: node.data.data.data.id,
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
                destinationCollectionIndex: node.id,
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
                highlightChildren(isDraging ? node.id : null)
            "
            @toggle-children="
              () => {
                toggleChildren(),
                  saveRequest &&
                    emit('select', {
                      pickedType: 'my-collection',
                      collectionIndex: parseInt(node.id),
                    })
              }
            "
          />
          <CollectionsCollection
            v-if="node.data.type === 'folders'"
            :id="node.id"
            :parent-i-d="node.data.data.parentIndex"
            :data="node.data.data.data"
            :collections-type="collectionsType.type"
            :is-open="isOpen"
            :is-last-item="node.data.isLastItem"
            :is-selected="
              isSelected({
                folderPath: node.id,
              })
            "
            folder-type="folder"
            @run-collection="
              emit('run-collection', {
                collectionIndex: node.id,
                collection: node.data.data.data,
              })
            "
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
                  folderPath: node.id,
                  folder: node.data.data.data,
                })
            "
            @duplicate-collection="
              node.data.type === 'folders' &&
                emit('duplicate-collection', {
                  pathOrID: node.id,
                  collectionSyncID: node.data.data.data.id,
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
            @remove-collection="emit('remove-folder', node.id)"
            @drop-event="dropEvent($event, node.id)"
            @drag-event="dragEvent($event, node.id)"
            @update-collection-order="
              updateCollectionOrder($event, {
                destinationCollectionIndex: node.id,
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
                highlightChildren(isDraging ? node.id : null)
            "
            @toggle-children="
              () => {
                toggleChildren(),
                  saveRequest &&
                    emit('select', {
                      pickedType: 'my-folder',
                      folderPath: node.id,
                    })
              }
            "
          />
          <CollectionsRequest
            v-if="node.data.type === 'requests'"
            :request="node.data.data.data"
            :request-i-d="node.id"
            :parent-i-d="node.data.data.parentIndex"
            :collections-type="collectionsType.type"
            :save-request="saveRequest"
            :is-last-item="node.data.isLastItem"
            :is-active="
              isActiveRequest(
                node.data.data.parentIndex,
                parseInt(pathToIndex(node.id))
              )
            "
            :is-selected="
              isSelected({
                folderPath: node.data.data.parentIndex,
                requestIndex: parseInt(pathToIndex(node.id)),
              })
            "
            @edit-request="
              node.data.type === 'requests' &&
                emit('edit-request', {
                  folderPath: node.data.data.parentIndex,
                  requestIndex: pathToIndex(node.id),
                  request: node.data.data.data,
                })
            "
            @edit-response="
              emit('edit-response', {
                folderPath: node.data.data.parentIndex,
                requestIndex: pathToIndex(node.id),
                request: node.data.data.data,
                responseName: $event.responseName,
                responseID: $event.responseID,
              })
            "
            @duplicate-request="
              node.data.type === 'requests' &&
                emit('duplicate-request', {
                  folderPath: node.data.data.parentIndex,
                  request: node.data.data.data,
                })
            "
            @duplicate-response="
              emit('duplicate-response', {
                folderPath: node.data.data.parentIndex,
                requestIndex: pathToIndex(node.id),
                request: node.data.data.data,
                responseName: $event.responseName,
                responseID: $event.responseID,
              })
            "
            @remove-request="
              node.data.type === 'requests' &&
                emit('remove-request', {
                  folderPath: node.data.data.parentIndex,
                  requestIndex: pathToIndex(node.id),
                })
            "
            @remove-response="
              emit('remove-response', {
                folderPath: node.data.data.parentIndex,
                requestIndex: pathToIndex(node.id),
                request: node.data.data.data,
                responseName: $event.responseName,
                responseID: $event.responseID,
              })
            "
            @select-request="
              node.data.type === 'requests' &&
                selectRequest({
                  request: node.data.data.data,
                  folderPath: node.data.data.parentIndex,
                  requestIndex: pathToIndex(node.id),
                })
            "
            @select-response="
              emit('select-response', {
                responseName: $event.responseName,
                responseID: $event.responseID,
                request: node.data.data.data,
                folderPath: node.data.data.parentIndex,
                requestIndex: pathToIndex(node.id),
              })
            "
            @share-request="
              node.data.type === 'requests' &&
                emit('share-request', {
                  request: node.data.data.data,
                })
            "
            @drag-request="
              dragRequest($event, {
                folderPath: node.data.data.parentIndex,
                requestIndex: node.id,
              })
            "
            @update-request-order="
              updateRequestOrder($event, {
                folderPath: node.data.data.parentIndex,
                requestIndex: node.id,
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
            v-if="filterText.length !== 0 && filteredCollections.length === 0"
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
                    @click="emit('display-modal-import-export')"
                  />
                  <HoppButtonSecondary
                    :icon="IconPlus"
                    :label="t('add.new')"
                    filled
                    outline
                    @click="emit('display-modal-add')"
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
import { HoppCollection, HoppRESTRequest } from "@hoppscotch/data"
import { computed, PropType, Ref, toRef } from "vue"
import { GetMyTeamsQuery } from "~/helpers/backend/graphql"
import { ChildrenResult, SmartTreeAdapter } from "@hoppscotch/ui/helpers"
import { useI18n } from "@composables/i18n"
import { useColorMode } from "@composables/theming"
import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import { Picked } from "~/helpers/types/HoppPicked.js"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"

export type Collection = {
  type: "collections"
  isLastItem: boolean
  data: {
    parentIndex: null
    data: HoppCollection
  }
}

type Folder = {
  type: "folders"
  isLastItem: boolean
  data: {
    parentIndex: string
    data: HoppCollection
  }
}

type Requests = {
  type: "requests"
  isLastItem: boolean
  data: {
    parentIndex: string
    data: HoppRESTRequest
  }
}

const t = useI18n()
const colorMode = useColorMode()

type SelectedTeam = GetMyTeamsQuery["myTeams"][number] | undefined

type CollectionType =
  | {
      type: "team-collections"
      selectedTeam: SelectedTeam
    }
  | { type: "my-collections"; selectedTeam: undefined }

const props = defineProps({
  filteredCollections: {
    type: Array as PropType<HoppCollection[]>,
    default: () => [],
    required: true,
  },
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

type ResponsePayload = {
  folderPath: string
  requestIndex: string
  request: HoppRESTRequest
  responseName: string
  responseID: string
}

const emit = defineEmits<{
  (event: "display-modal-add"): void
  (
    event: "add-request",
    payload: {
      path: string
      folder: HoppCollection
    }
  ): void
  (
    event: "add-folder",
    payload: {
      path: string
      folder: HoppCollection
    }
  ): void
  (
    event: "run-collection",
    payload: {
      collectionIndex: string
      collection: HoppCollection
    }
  ): void
  (
    event: "edit-collection",
    payload: {
      collectionIndex: string
      collection: HoppCollection
    }
  ): void
  (
    event: "edit-folder",
    payload: {
      folderPath: string
      folder: HoppCollection
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
      collection: HoppCollection
    }
  ): void
  (
    event: "edit-request",
    payload: {
      folderPath: string
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
  (event: "export-data", payload: HoppCollection): void
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
      folderPath: string
      requestIndex: string
      isActive: boolean
    }
  ): void
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
  (event: "select", payload: Picked | null): void
  (event: "display-modal-import-export"): void
  (event: "select-response", payload: ResponsePayload): void
}>()

const refFilterCollection = toRef(props, "filteredCollections")

const pathToIndex = (path: string) => {
  const pathArr = path.split("/")
  return pathArr[pathArr.length - 1]
}

const isSelected = ({
  collectionIndex,
  folderPath,
  requestIndex,
}: {
  collectionIndex?: number | undefined
  folderPath?: string | undefined
  requestIndex?: number | undefined
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
  }
  return (
    props.picked &&
    props.picked.pickedType === "my-folder" &&
    props.picked.folderPath === folderPath
  )
}

const tabs = useService(RESTTabService)
const active = computed(() => tabs.currentActiveTab.value.document.saveContext)

const isActiveRequest = (folderPath: string, requestIndex: number) => {
  return pipe(
    active.value,
    O.fromNullable,
    O.filter(
      (active) =>
        active.originLocation === "user-collection" &&
        active.folderPath === folderPath &&
        active.requestIndex === requestIndex &&
        active.exampleID === undefined
    ),
    O.isSome
  )
}

const selectRequest = (data: {
  request: HoppRESTRequest
  folderPath: string
  requestIndex: string
}) => {
  const { request, folderPath, requestIndex } = data

  if (props.saveRequest) {
    emit("select", {
      pickedType: "my-request",
      folderPath: folderPath,
      requestIndex: parseInt(requestIndex),
    })
  } else {
    emit("select-request", {
      request,
      folderPath,
      requestIndex,
      isActive: isActiveRequest(folderPath, parseInt(requestIndex)),
    })
  }
}

const dragEvent = (dataTransfer: DataTransfer, collectionIndex: string) => {
  dataTransfer.setData("collectionIndex", collectionIndex)
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

type MyCollectionNode = Collection | Folder | Requests

class MyCollectionsAdapter implements SmartTreeAdapter<MyCollectionNode> {
  constructor(public data: Ref<HoppCollection[]>) {}

  navigateToFolderWithIndexPath(
    collections: HoppCollection[],
    indexPaths: number[]
  ) {
    if (indexPaths.length === 0) return null

    let target = collections[indexPaths.shift() as number]

    while (indexPaths.length > 0)
      target = target?.folders[indexPaths.shift() as number]

    return target !== undefined ? target : null
  }

  getChildren(id: string | null): Ref<ChildrenResult<MyCollectionNode>> {
    return computed(() => {
      if (id === null) {
        const data = this.data.value.map((item, index) => ({
          id: index.toString(),
          data: {
            type: "collections",
            isLastItem: index === this.data.value.length - 1,
            data: {
              parentIndex: null,
              data: item,
            },
          },
        }))
        return {
          status: "loaded",
          data: data,
        } as ChildrenResult<Collection>
      }

      const indexPath = id.split("/").map((x) => parseInt(x))

      const item = this.navigateToFolderWithIndexPath(
        this.data.value,
        indexPath
      )

      if (item) {
        const data = [
          ...item.folders.map((folder, index) => ({
            id: `${id}/${index}`,
            data: {
              isLastItem:
                item.folders && item.folders.length > 1
                  ? index === item.folders.length - 1
                  : false,
              type: "folders",
              data: {
                parentIndex: id,
                data: folder,
              },
            },
          })),
          ...item.requests.map((requests, index) => ({
            id: `${id}/${index}`,
            data: {
              isLastItem:
                item.requests && item.requests.length > 1
                  ? index === item.requests.length - 1
                  : false,
              type: "requests",
              data: {
                parentIndex: id,
                data: requests,
              },
            },
          })),
        ]

        return {
          status: "loaded",
          data: data,
        } as ChildrenResult<Folder | Requests>
      }
      return {
        status: "loaded",
        data: [],
      }
    })
  }
}

const myAdapter: SmartTreeAdapter<MyCollectionNode> = new MyCollectionsAdapter(
  refFilterCollection
)
</script>
