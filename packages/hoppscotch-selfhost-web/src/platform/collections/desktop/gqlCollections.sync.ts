import {
  graphqlCollectionStore,
  navigateToFolderWithIndexPath,
  removeDuplicateGraphqlCollectionOrFolder,
} from "@hoppscotch/common/newstore/collections"
import {
  getSettingSubject,
  settingsStore,
} from "@hoppscotch/common/newstore/settings"

import { HoppCollection, HoppRESTRequest } from "@hoppscotch/data"

import { getSyncInitFunction } from "@lib/sync"

import { StoreSyncDefinitionOf } from "@lib/sync"
import { createMapper } from "@lib/sync/mapper"
import {
  createGQLChildUserCollection,
  createGQLRootUserCollection,
  createGQLUserRequest,
  deleteUserCollection,
  deleteUserRequest,
  editGQLUserRequest,
  renameUserCollection,
} from "./api"

import * as E from "fp-ts/Either"
import { moveOrReorderRequests } from "./sync"

// gqlCollectionsMapper uses the collectionPath as the local identifier
export const gqlCollectionsMapper = createMapper<string, string>()

// gqlRequestsMapper uses the collectionPath/requestIndex as the local identifier
export const gqlRequestsMapper = createMapper<string, string>()

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
    const res = await createGQLRootUserCollection(collection.name)

    if (E.isRight(res)) {
      parentCollectionID = res.right.createGQLRootUserCollection.id

      collection.id = parentCollectionID
      removeDuplicateGraphqlCollectionOrFolder(
        parentCollectionID,
        collectionPath
      )
    } else {
      parentCollectionID = undefined
    }
  } else {
    // if parentUserCollectionID exists, create the collection as a child collection
    const res = await createGQLChildUserCollection(
      collection.name,
      parentUserCollectionID
    )

    if (E.isRight(res)) {
      const childCollectionId = res.right.createGQLChildUserCollection.id

      collection.id = childCollectionId

      removeDuplicateGraphqlCollectionOrFolder(
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
        (await createGQLUserRequest(
          request.name,
          JSON.stringify(request),
          parentCollectionID
        ))

      if (res && E.isRight(res)) {
        const requestId = res.right.createGQLUserRequest.id

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

export const gqlCollectionsOperations: Array<OperationCollectionRemoved> = []

export const storeSyncDefinition: StoreSyncDefinitionOf<
  typeof graphqlCollectionStore
> = {
  appendCollections({ entries }) {
    let indexStart = graphqlCollectionStore.value.state.length - entries.length

    entries.forEach((collection) => {
      recursivelySyncCollections(collection, `${indexStart}`)
      indexStart++
    })
  },
  async addCollection({ collection }) {
    const lastCreatedCollectionIndex =
      graphqlCollectionStore.value.state.length - 1

    await recursivelySyncCollections(
      collection,
      `${lastCreatedCollectionIndex}`
    )
  },
  async removeCollection({ collectionID }) {
    if (collectionID) {
      await deleteUserCollection(collectionID)
    }
  },
  editCollection({ collection, collectionIndex }) {
    const collectionID = navigateToFolderWithIndexPath(
      graphqlCollectionStore.value.state,
      [collectionIndex]
    )?.id

    if (collectionID && collection.name) {
      renameUserCollection(collectionID, collection.name)
    }
  },
  async addFolder({ name, path }) {
    const parentCollection = navigateToFolderWithIndexPath(
      graphqlCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )

    const parentCollectionBackendID = parentCollection?.id

    if (parentCollectionBackendID) {
      const foldersLength = parentCollection.folders.length

      const res = await createGQLChildUserCollection(
        name,
        parentCollectionBackendID
      )

      if (E.isRight(res)) {
        const { id } = res.right.createGQLChildUserCollection

        if (foldersLength) {
          parentCollection.folders[foldersLength - 1].id = id
          removeDuplicateGraphqlCollectionOrFolder(
            id,
            `${path}/${foldersLength - 1}`
          )
        }
      }
    }
  },
  editFolder({ folder, path }) {
    const folderBackendId = navigateToFolderWithIndexPath(
      graphqlCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )?.id

    if (folderBackendId && folder.name) {
      renameUserCollection(folderBackendId, folder.name)
    }
  },
  async removeFolder({ folderID }) {
    if (folderID) {
      await deleteUserCollection(folderID)
    }
  },
  editRequest({ path, requestIndex, requestNew }) {
    const request = navigateToFolderWithIndexPath(
      graphqlCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )?.requests[requestIndex]

    const requestBackendID = request?.id

    if (requestBackendID) {
      editGQLUserRequest(
        requestBackendID,
        (requestNew as HoppRESTRequest).name,
        JSON.stringify(requestNew)
      )
    }
  },
  async saveRequestAs({ path, request }) {
    const folder = navigateToFolderWithIndexPath(
      graphqlCollectionStore.value.state,
      path.split("/").map((index) => parseInt(index))
    )

    const parentCollectionBackendID = folder?.id

    if (parentCollectionBackendID) {
      const newRequest = folder.requests[folder.requests.length - 1]

      const res = await createGQLUserRequest(
        (request as HoppRESTRequest).name,
        JSON.stringify(request),
        parentCollectionBackendID
      )

      if (E.isRight(res)) {
        const { id } = res.right.createGQLUserRequest

        newRequest.id = id
        removeDuplicateGraphqlCollectionOrFolder(
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
    moveOrReorderRequests(requestIndex, path, destinationPath, undefined, "GQL")
  },
}

export const gqlCollectionsSyncer = getSyncInitFunction(
  graphqlCollectionStore,
  storeSyncDefinition,
  () => settingsStore.value.syncCollections,
  getSettingSubject("syncCollections")
)
