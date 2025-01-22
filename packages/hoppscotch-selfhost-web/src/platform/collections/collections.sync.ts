import {
  graphqlCollectionStore,
  navigateToFolderWithIndexPath,
  removeDuplicateRESTCollectionOrFolder,
  restCollectionStore,
} from "@hoppscotch/common/newstore/collections"
import {
  getSettingSubject,
  settingsStore,
} from "@hoppscotch/common/newstore/settings"

import {
  generateUniqueRefId,
  HoppCollection,
  HoppRESTRequest,
} from "@hoppscotch/data"

import { getSyncInitFunction, StoreSyncDefinitionOf } from "../../lib/sync"
import { createMapper } from "../../lib/sync/mapper"
import {
  createRESTChildUserCollection,
  createRESTRootUserCollection,
  createRESTUserRequest,
  deleteUserCollection,
  deleteUserRequest,
  duplicateUserCollection,
  editUserRequest,
  moveUserCollection,
  moveUserRequest,
  updateUserCollection,
  updateUserCollectionOrder,
} from "./collections.api"

import * as E from "fp-ts/Either"
import { ReqType } from "../../api/generated/graphql"

// restCollectionsMapper uses the collectionPath as the local identifier
export const restCollectionsMapper = createMapper<string, string>()

// restRequestsMapper uses the collectionPath/requestIndex as the local identifier
export const restRequestsMapper = createMapper<string, string>()

// temp implementation untill the backend implements an endpoint that accepts an entire collection
// TODO: use importCollectionsJSON to do this
const recursivelySyncCollections = async (
  collection: HoppCollection,
  collectionPath: string,
  parentUserCollectionID?: string
) => {
  let parentCollectionID = parentUserCollectionID

  // if parentUserCollectionID does not exist, create the collection as a root collection
  if (!parentUserCollectionID) {
    const data = {
      auth: collection.auth ?? {
        authType: "inherit",
        authActive: true,
      },
      headers: collection.headers ?? [],
      _ref_id: collection._ref_id,
    }
    const res = await createRESTRootUserCollection(
      collection.name,
      JSON.stringify(data)
    )
    if (E.isRight(res)) {
      parentCollectionID = res.right.createRESTRootUserCollection.id

      const returnedData = res.right.createRESTRootUserCollection.data
        ? JSON.parse(res.right.createRESTRootUserCollection.data)
        : {
            auth: {
              authType: "inherit",
              authActive: true,
            },
            headers: [],
            _ref_id: generateUniqueRefId("coll"),
          }

      collection.id = parentCollectionID
      collection._ref_id = returnedData._ref_id ?? generateUniqueRefId("coll")
      collection.auth = returnedData.auth
      collection.headers = returnedData.headers
      removeDuplicateRESTCollectionOrFolder(parentCollectionID, collectionPath)
    } else {
      parentCollectionID = undefined
    }
  } else {
    // if parentUserCollectionID exists, create the collection as a child collection
    const data = {
      auth: collection.auth ?? {
        authType: "inherit",
        authActive: true,
      },
      headers: collection.headers ?? [],
      _ref_id: collection._ref_id,
    }

    const res = await createRESTChildUserCollection(
      collection.name,
      parentUserCollectionID,
      JSON.stringify(data)
    )

    if (E.isRight(res)) {
      const childCollectionId = res.right.createRESTChildUserCollection.id

      const returnedData = res.right.createRESTChildUserCollection.data
        ? JSON.parse(res.right.createRESTChildUserCollection.data)
        : {
            auth: {
              authType: "inherit",
              authActive: true,
            },
            headers: [],
            _ref_id: generateUniqueRefId("coll"),
          }

      collection.id = childCollectionId
      collection._ref_id = returnedData._ref_id ?? generateUniqueRefId("coll")
      collection.auth = returnedData.auth
      collection.headers = returnedData.headers

      removeDuplicateRESTCollectionOrFolder(
        childCollectionId,
        `${collectionPath}`
      )
    }
  }

  // create the requests
  if (parentCollectionID) {
    collection.requests.forEach(async (request) => {
      const res =
        parentCollectionID &&
        (await createRESTUserRequest(
          request.name,
          JSON.stringify(request),
          parentCollectionID
        ))

      if (res && E.isRight(res)) {
        const requestId = res.right.createRESTUserRequest.id

        request.id = requestId
      }
    })
  }

  // create the folders aka child collections
  if (parentCollectionID)
    collection.folders.forEach(async (folder, index) => {
      recursivelySyncCollections(
        folder,
        `${collectionPath}/${index}`,
        parentCollectionID
      )
    })
}

// TODO: generalize this
// TODO: ask backend to send enough info on the subscription to not need this
export const collectionReorderOrMovingOperations: {
  sourceCollectionID: string
  destinationCollectionID?: string
  reorderOperation: {
    fromPath: string
    toPath?: string
  }
}[] = []

type OperationStatus = "pending" | "completed"

type OperationCollectionRemoved = {
  type: "COLLECTION_REMOVED"
  collectionBackendID: string
  status: OperationStatus
}

export const restCollectionsOperations: Array<OperationCollectionRemoved> = []

export const storeSyncDefinition: StoreSyncDefinitionOf<
  typeof restCollectionStore
> = {
  appendCollections({ entries }) {
    let indexStart = restCollectionStore.value.state.length - entries.length

    entries.forEach((collection) => {
      recursivelySyncCollections(collection, `${indexStart}`)
      indexStart++
    })
  },
  async addCollection({ collection }) {
    const lastCreatedCollectionIndex =
      restCollectionStore.value.state.length - 1

    recursivelySyncCollections(collection, `${lastCreatedCollectionIndex}`)
  },
  async removeCollection({ collectionID }) {
    if (collectionID) {
      await deleteUserCollection(collectionID)
    }
  },
  editCollection({ partialCollection: collection, collectionIndex }) {
    const collectionID = navigateToFolderWithIndexPath(
      restCollectionStore.value.state,
      [collectionIndex]
    )?.id

    const data = {
      auth: collection.auth,
      headers: collection.headers,
    }

    if (collectionID) {
      updateUserCollection(collectionID, collection.name, JSON.stringify(data))
    }
  },
  async addFolder({ name, path }) {
    const parentCollection = navigateToFolderWithIndexPath(
      restCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )

    const parentCollectionBackendID = parentCollection?.id

    if (parentCollectionBackendID) {
      const foldersLength = parentCollection.folders.length

      const res = await createRESTChildUserCollection(
        name,
        parentCollectionBackendID
      )

      if (E.isRight(res)) {
        const { id } = res.right.createRESTChildUserCollection

        if (foldersLength) {
          parentCollection.folders[foldersLength - 1].id = id
          removeDuplicateRESTCollectionOrFolder(
            id,
            `${path}/${foldersLength - 1}`
          )
        }
      }
    }
  },
  editFolder({ folder, path }) {
    const folderID = navigateToFolderWithIndexPath(
      restCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )?.id

    const folderName = folder.name
    const data = {
      auth: folder.auth,
      headers: folder.headers,
    }
    if (folderID) {
      updateUserCollection(folderID, folderName, JSON.stringify(data))
    }
  },
  async removeFolder({ folderID }) {
    if (folderID) {
      await deleteUserCollection(folderID)
    }
  },
  async moveFolder({ destinationPath, path }) {
    const { newSourcePath, newDestinationPath } = getPathsAfterMoving(
      path,
      destinationPath ?? undefined
    )

    if (newSourcePath) {
      const sourceCollectionID = navigateToFolderWithIndexPath(
        restCollectionStore.value.state,
        newSourcePath.split("/").map((index) => parseInt(index))
      )?.id

      const destinationCollectionID = destinationPath
        ? newDestinationPath &&
          navigateToFolderWithIndexPath(
            restCollectionStore.value.state,
            newDestinationPath.split("/").map((index) => parseInt(index))
          )?.id
        : undefined

      if (sourceCollectionID) {
        await moveUserCollection(sourceCollectionID, destinationCollectionID)
      }
    }
  },
  async duplicateCollection({ collectionSyncID }) {
    if (collectionSyncID) {
      await duplicateUserCollection(collectionSyncID, ReqType.Rest)
    }
  },
  editRequest({ path, requestIndex, requestNew }) {
    const request = navigateToFolderWithIndexPath(
      restCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )?.requests[requestIndex]

    const requestBackendID = request?.id

    if (requestBackendID) {
      editUserRequest(
        requestBackendID,
        (requestNew as HoppRESTRequest).name,
        JSON.stringify(requestNew)
      )
    }
  },
  async saveRequestAs({ path, request }) {
    const folder = navigateToFolderWithIndexPath(
      restCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )

    const parentCollectionBackendID = folder?.id

    if (parentCollectionBackendID) {
      const newRequest = folder.requests[folder.requests.length - 1]

      const res = await createRESTUserRequest(
        (request as HoppRESTRequest).name,
        JSON.stringify(request),
        parentCollectionBackendID
      )

      if (E.isRight(res)) {
        const { id } = res.right.createRESTUserRequest

        newRequest.id = id
        removeDuplicateRESTCollectionOrFolder(
          id,
          `${path}/${folder.requests.length - 1}`,
          "request"
        )
      }
    }
  },
  async removeRequest({ requestID }) {
    if (requestID) {
      await deleteUserRequest(requestID)
    }
  },
  moveRequest({ destinationPath, path, requestIndex }) {
    moveOrReorderRequests(requestIndex, path, destinationPath)
  },
  updateRequestOrder({
    destinationCollectionPath,
    destinationRequestIndex,
    requestIndex,
  }) {
    /**
     * currently the FE implementation only supports reordering requests between the same collection,
     * so destinationCollectionPath and sourceCollectionPath will be same
     */
    moveOrReorderRequests(
      requestIndex,
      destinationCollectionPath,
      destinationCollectionPath,
      destinationRequestIndex ?? undefined
    )
  },
  async updateCollectionOrder({
    collectionIndex: collectionPath,
    destinationCollectionIndex: destinationCollectionPath,
  }) {
    const collections = restCollectionStore.value.state

    const sourcePathIndexes = getParentPathIndexesFromPath(collectionPath)
    const sourceCollectionIndex = getCollectionIndexFromPath(collectionPath)

    const destinationCollectionIndex = !!destinationCollectionPath
      ? getCollectionIndexFromPath(destinationCollectionPath)
      : undefined

    let updatedCollectionIndexs:
      | [newSourceIndex: number, newDestinationIndex: number | undefined]
      | undefined

    if (
      (sourceCollectionIndex || sourceCollectionIndex == 0) &&
      (destinationCollectionIndex || destinationCollectionIndex == 0)
    ) {
      updatedCollectionIndexs = getIndexesAfterReorder(
        sourceCollectionIndex,
        destinationCollectionIndex
      )
    } else if (sourceCollectionIndex || sourceCollectionIndex == 0) {
      if (sourcePathIndexes.length == 0) {
        // we're reordering root collections
        updatedCollectionIndexs = [collections.length - 1, undefined]
      } else {
        const sourceCollection = navigateToFolderWithIndexPath(collections, [
          ...sourcePathIndexes,
        ])

        if (sourceCollection && sourceCollection.folders.length > 0) {
          updatedCollectionIndexs = [
            sourceCollection.folders.length - 1,
            undefined,
          ]
        }
      }
    }

    const sourceCollectionID =
      updatedCollectionIndexs &&
      navigateToFolderWithIndexPath(collections, [
        ...sourcePathIndexes,
        updatedCollectionIndexs[0],
      ])?.id

    const destinationCollectionID =
      updatedCollectionIndexs &&
      (updatedCollectionIndexs[1] || updatedCollectionIndexs[1] == 0)
        ? navigateToFolderWithIndexPath(collections, [
            ...sourcePathIndexes,
            updatedCollectionIndexs[1],
          ])?.id
        : undefined

    if (sourceCollectionID) {
      await updateUserCollectionOrder(
        sourceCollectionID,
        destinationCollectionID
      )
    }
  },
}

export const collectionsSyncer = getSyncInitFunction(
  restCollectionStore,
  storeSyncDefinition,
  () => settingsStore.value.syncCollections,
  getSettingSubject("syncCollections")
)

export async function moveOrReorderRequests(
  requestIndex: number,
  path: string,
  destinationPath: string,
  nextRequestIndex?: number,
  requestType: "REST" | "GQL" = "REST"
) {
  const { collectionStore } = getStoreByCollectionType(requestType)

  const sourceCollectionBackendID = navigateToFolderWithIndexPath(
    collectionStore.value.state,
    path.split("/").map((index) => parseInt(index))
  )?.id

  const destinationCollection = navigateToFolderWithIndexPath(
    collectionStore.value.state,
    destinationPath.split("/").map((index) => parseInt(index))
  )

  const destinationCollectionBackendID = destinationCollection?.id

  let requestBackendID: string | undefined

  let nextRequestBackendID: string | undefined

  // we only need this for reordering requests, not for moving requests
  if (nextRequestIndex) {
    // reordering
    const [newRequestIndex, newDestinationIndex] = getIndexesAfterReorder(
      requestIndex,
      nextRequestIndex
    )

    requestBackendID =
      destinationCollection?.requests[newRequestIndex]?.id ?? undefined

    nextRequestBackendID =
      destinationCollection?.requests[newDestinationIndex]?.id ?? undefined
  } else {
    // moving
    const requests = destinationCollection?.requests
    requestBackendID =
      requests && requests.length > 0
        ? requests[requests.length - 1]?.id
        : undefined
  }

  if (
    sourceCollectionBackendID &&
    destinationCollectionBackendID &&
    requestBackendID
  ) {
    await moveUserRequest(
      sourceCollectionBackendID,
      destinationCollectionBackendID,
      requestBackendID,
      nextRequestBackendID
    )
  }
}

function getParentPathIndexesFromPath(path: string) {
  const indexes = path.split("/")
  indexes.pop()
  return indexes.map((index) => parseInt(index))
}

export function getCollectionIndexFromPath(collectionPath: string) {
  const sourceCollectionIndexString = collectionPath.split("/").pop()
  const sourceCollectionIndex = sourceCollectionIndexString
    ? parseInt(sourceCollectionIndexString)
    : undefined

  return sourceCollectionIndex
}

/**
 * the sync function is called after the reordering has happened on the store
 * because of this we need to find the new source and destination indexes after the reordering
 */
function getIndexesAfterReorder(
  oldSourceIndex: number,
  oldDestinationIndex: number
): [newSourceIndex: number, newDestinationIndex: number] {
  // Source Becomes Destination -1
  // Destination Remains Same
  if (oldSourceIndex < oldDestinationIndex) {
    return [oldDestinationIndex - 1, oldDestinationIndex]
  }

  // Source Becomes The Destination
  // Destintion Becomes Source + 1
  if (oldSourceIndex > oldDestinationIndex) {
    return [oldDestinationIndex, oldDestinationIndex + 1]
  }

  throw new Error("Source and Destination are the same")
}

/**
 * the sync function is called after moving a folder has happened on the store,
 * because of this the source index given to the sync function is not the live one
 * we need to find the new source index after the moving
 */
function getPathsAfterMoving(sourcePath: string, destinationPath?: string) {
  if (!destinationPath) {
    return {
      newSourcePath: `${restCollectionStore.value.state.length - 1}`,
      newDestinationPath: destinationPath,
    }
  }

  const sourceParentPath = getParentPathFromPath(sourcePath)
  const destinationParentPath = getParentPathFromPath(destinationPath)

  const isSameParentPath = sourceParentPath === destinationParentPath

  let newDestinationPath: string

  if (isSameParentPath) {
    const sourceIndex = getCollectionIndexFromPath(sourcePath)
    const destinationIndex = getCollectionIndexFromPath(destinationPath)

    if (
      (sourceIndex || sourceIndex == 0) &&
      (destinationIndex || destinationIndex == 0) &&
      sourceIndex < destinationIndex
    ) {
      newDestinationPath = destinationParentPath
        ? `${destinationParentPath}/${destinationIndex - 1}`
        : `${destinationIndex - 1}`
    } else {
      newDestinationPath = destinationPath
    }
  } else {
    newDestinationPath = destinationPath
  }

  const destinationFolder = navigateToFolderWithIndexPath(
    restCollectionStore.value.state,
    newDestinationPath.split("/").map((index) => parseInt(index))
  )

  const newSourcePath = destinationFolder
    ? `${newDestinationPath}/${destinationFolder?.folders.length - 1}`
    : undefined

  return {
    newSourcePath,
    newDestinationPath,
  }
}

function getParentPathFromPath(path: string | undefined) {
  const indexes = path ? path.split("/") : []
  indexes.pop()

  return indexes.join("/")
}

export function getStoreByCollectionType(type: "GQL" | "REST") {
  const isGQL = type == "GQL"

  const collectionStore = isGQL ? graphqlCollectionStore : restCollectionStore

  return { collectionStore }
}
