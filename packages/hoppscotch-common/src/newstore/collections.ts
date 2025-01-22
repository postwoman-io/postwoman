import {
  generateUniqueRefId,
  HoppCollection,
  HoppGQLAuth,
  HoppGQLRequest,
  HoppRESTAuth,
  HoppRESTHeaders,
  HoppRESTRequest,
  makeCollection,
} from "@hoppscotch/data"
import { cloneDeep } from "lodash-es"
import { pluck } from "rxjs/operators"
import { resolveSaveContextOnRequestReorder } from "~/helpers/collection/request"
import { GQLHeader } from "@hoppscotch/data"
import { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { getService } from "~/modules/dioc"
import { getI18n } from "~/modules/i18n"
import { RESTTabService } from "~/services/tab/rest"
import DispatchingStore, { defineDispatchers } from "./DispatchingStore"

const defaultRESTCollectionState = {
  state: [
    makeCollection({
      name: "My Collection",
      folders: [],
      requests: [],
      auth: {
        authType: "inherit",
        authActive: false,
      },
      headers: [],
    }),
  ],
}

const defaultGraphqlCollectionState = {
  state: [
    makeCollection({
      name: "My GraphQL Collection",
      folders: [],
      requests: [],
      auth: {
        authType: "inherit",
        authActive: false,
      },
      headers: [],
    }),
  ],
}

type RESTCollectionStoreType = typeof defaultRESTCollectionState
type GraphqlCollectionStoreType = typeof defaultGraphqlCollectionState

/**
 * NOTE: this function is not pure. It mutates the indexPaths inplace
 * Not removing this behaviour because i'm not sure if we utilize this behaviour anywhere and i found this on a tight time crunch.
 */
export function navigateToFolderWithIndexPath(
  collections: HoppCollection[],
  indexPaths: number[]
) {
  if (indexPaths.length === 0) return null

  let target = collections[indexPaths.shift() as number]

  while (indexPaths.length > 0 && target)
    target = target.folders[indexPaths.shift() as number]

  return target !== undefined ? target : null
}

/**
 * Used to obtain the inherited auth and headers for a given folder path, used for both REST and GraphQL personal collections
 * @param folderPath the path of the folder to cascade the auth from
 * @param type the type of collection
 * @returns the inherited auth and headers for the given folder path
 */
export function cascadeParentCollectionForHeaderAuth(
  folderPath: string | undefined,
  type: "rest" | "graphql"
) {
  const collectionStore =
    type === "rest" ? restCollectionStore : graphqlCollectionStore

  let auth: HoppInheritedProperty["auth"] = {
    parentID: folderPath ?? "",
    parentName: "",
    inheritedAuth: {
      authType: "none",
      authActive: true,
    },
  }
  const headers: HoppInheritedProperty["headers"] = []

  if (!folderPath) return { auth, headers }

  const path = folderPath.split("/").map((i) => parseInt(i))

  // Check if the path is empty or invalid
  if (!path || path.length === 0) {
    console.error("Invalid path:", folderPath)
    return { auth, headers }
  }

  // Loop through the path and get the last parent folder with authType other than 'inherit'
  for (let i = 0; i < path.length; i++) {
    const parentFolder = navigateToFolderWithIndexPath(
      collectionStore.value.state,
      [...path.slice(0, i + 1)] // Create a copy of the path array
    )

    // Check if parentFolder is undefined or null
    if (!parentFolder) {
      console.error("Parent folder not found for path:", path)
      return { auth, headers }
    }

    const parentFolderAuth = parentFolder.auth as HoppRESTAuth | HoppGQLAuth
    const parentFolderHeaders = parentFolder.headers as
      | HoppRESTHeaders
      | GQLHeader[]

    // check if the parent folder has authType 'inherit' and if it is the root folder
    if (
      parentFolderAuth?.authType === "inherit" &&
      [...path.slice(0, i + 1)].length === 1
    ) {
      auth = {
        parentID: [...path.slice(0, i + 1)].join("/"),
        parentName: parentFolder.name,
        inheritedAuth: auth.inheritedAuth,
      }
    }

    if (parentFolderAuth?.authType !== "inherit") {
      auth = {
        parentID: [...path.slice(0, i + 1)].join("/"),
        parentName: parentFolder.name,
        inheritedAuth: parentFolderAuth,
      }
    }

    // Update headers, overwriting duplicates by key
    if (parentFolderHeaders) {
      const activeHeaders = parentFolderHeaders.filter((h) => h.active)
      activeHeaders.forEach((header) => {
        const index = headers.findIndex(
          (h) => h.inheritedHeader?.key === header.key
        )
        const currentPath = [...path.slice(0, i + 1)].join("/")
        if (index !== -1) {
          // Replace the existing header with the same key
          headers[index] = {
            parentID: currentPath,
            parentName: parentFolder.name,
            inheritedHeader: header,
          }
        } else {
          headers.push({
            parentID: currentPath,
            parentName: parentFolder.name,
            inheritedHeader: header,
          })
        }
      })
    }
  }

  return { auth, headers }
}

function reorderItems(array: unknown[], from: number, to: number) {
  const item = array.splice(from, 1)[0]
  if (from < to) {
    array.splice(to - 1, 0, item)
  } else {
    array.splice(to, 0, item)
  }
}

const restCollectionDispatchers = defineDispatchers({
  setCollections(
    _: RESTCollectionStoreType,
    { entries }: { entries: HoppCollection[] }
  ) {
    return {
      state: entries,
    }
  },

  appendCollections(
    { state }: RESTCollectionStoreType,
    { entries }: { entries: HoppCollection[] }
  ) {
    return {
      state: [...state, ...entries],
    }
  },

  addCollection(
    { state }: RESTCollectionStoreType,
    { collection }: { collection: HoppCollection }
  ) {
    return {
      state: [...state, collection],
    }
  },

  removeCollection(
    { state }: RESTCollectionStoreType,
    {
      collectionIndex,
      // this collectionID is used to sync the collection removal
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      collectionID,
    }: { collectionIndex: number; collectionID?: string }
  ) {
    return {
      state: (state as any).filter(
        (_: any, i: number) => i !== collectionIndex
      ),
    }
  },

  editCollection(
    { state }: RESTCollectionStoreType,
    {
      collectionIndex,
      partialCollection,
    }: {
      collectionIndex: number
      partialCollection: Partial<HoppCollection>
    }
  ) {
    return {
      state: state.map((col, index) =>
        index === collectionIndex
          ? { ...col, ...cloneDeep(partialCollection) }
          : col
      ),
    }
  },

  addFolder(
    { state }: RESTCollectionStoreType,
    { name, path }: { name: string; path: string }
  ) {
    const newFolder: HoppCollection = makeCollection({
      name,
      folders: [],
      requests: [],
      auth: {
        authType: "inherit",
        authActive: true,
      },
      headers: [],
    })

    const newState = state
    const indexPaths = path.split("/").map((x) => parseInt(x))

    const target = navigateToFolderWithIndexPath(newState, indexPaths)

    if (target === null) {
      console.log(`Could not parse path '${path}'. Ignoring add folder request`)
      return {}
    }

    target.folders.push(newFolder)

    return {
      state: newState,
    }
  },

  editFolder(
    { state }: RESTCollectionStoreType,
    {
      path,
      folder,
    }: {
      path: string
      folder: Partial<HoppCollection>
    }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const target = navigateToFolderWithIndexPath(newState, indexPaths)

    if (target === null) {
      console.log(
        `Could not parse path '${path}'. Ignoring edit folder request`
      )
      return {}
    }

    Object.assign(target, {
      ...target,
      ...cloneDeep(folder),
    })

    return {
      state: newState,
    }
  },

  removeFolder(
    { state }: RESTCollectionStoreType,
    // folderID is used to sync the folder removal in collections.sync.ts
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { path, folderID }: { path: string; folderID?: string }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))
    if (indexPaths.length === 0) {
      console.log(
        "Given path too short. If this is a collection, use removeCollection dispatcher instead. Skipping request."
      )
      return {}
    }
    // We get the index path to the folder itself,
    // we have to find the folder containing the target folder,
    // so we pop the last path index
    const folderIndex = indexPaths.pop() as number

    const containingFolder = navigateToFolderWithIndexPath(newState, indexPaths)

    if (containingFolder === null) {
      console.log(
        `Could not resolve path '${path}'. Skipping removeFolder dispatch.`
      )
      return {}
    }

    containingFolder.folders.splice(folderIndex, 1)

    return {
      state: newState,
    }
  },

  moveFolder(
    { state }: RESTCollectionStoreType,
    { path, destinationPath }: { path: string; destinationPath: string | null }
  ) {
    const newState = state

    // Move the folder to the root
    if (destinationPath === null) {
      const indexPaths = path.split("/").map((x) => parseInt(x))

      if (indexPaths.length === 0) {
        console.log("Given path too short. Skipping request.")
        return {}
      }

      const folderIndex = indexPaths.pop() as number

      const containingFolder = navigateToFolderWithIndexPath(
        newState,
        indexPaths
      )
      if (containingFolder === null) {
        console.error(
          `The folder to move is already in the root. Skipping request to move folder.`
        )
        return {}
      }

      const theFolder = containingFolder.folders.splice(folderIndex, 1)
      newState.push(theFolder[0] as HoppCollection)

      return {
        state: newState,
      }
    }

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const destinationIndexPaths = destinationPath
      .split("/")
      .map((x) => parseInt(x))

    if (indexPaths.length === 0 || destinationIndexPaths.length === 0) {
      console.error(
        `Given path is too short. Skipping request to move folder '${path}' to destination '${destinationPath}'.`
      )
      return {}
    }

    const target = navigateToFolderWithIndexPath(
      newState,
      destinationIndexPaths
    )
    if (target === null) {
      console.error(
        `Could not resolve destination path '${destinationPath}'. Skipping moveFolder dispatch.`
      )
      return {}
    }

    const folderIndex = indexPaths.pop() as number

    const containingFolder = navigateToFolderWithIndexPath(newState, indexPaths)
    // We are moving a folder from the root
    if (containingFolder === null) {
      const theFolder = newState.splice(folderIndex, 1)

      target.folders.push(theFolder[0])
    } else {
      const theFolder = containingFolder.folders.splice(folderIndex, 1)

      target.folders.push(theFolder[0])
    }

    return { state: newState }
  },

  updateCollectionOrder(
    { state }: RESTCollectionStoreType,
    {
      collectionIndex,
      destinationCollectionIndex,
    }: {
      collectionIndex: string
      destinationCollectionIndex: string | null
    }
  ) {
    const newState = state

    const indexPaths = collectionIndex.split("/").map((x) => parseInt(x))

    if (indexPaths.length === 0) {
      console.log("Given path too short. Skipping request.")
      return {}
    }

    // Reordering the collection to the last position
    if (destinationCollectionIndex === null) {
      const folderIndex = indexPaths.pop() as number

      const containingFolder = navigateToFolderWithIndexPath(
        newState,
        indexPaths
      )

      if (containingFolder === null) {
        newState.push(newState.splice(folderIndex, 1)[0])
        return {
          state: newState,
        }
      }

      // Pushing the folder to the end of the array (last position)
      containingFolder.folders.push(
        containingFolder.folders.splice(folderIndex, 1)[0]
      )

      return {
        state: newState,
      }
    }

    const destinationIndexPaths = destinationCollectionIndex
      .split("/")
      .map((x) => parseInt(x))

    if (destinationIndexPaths.length === 0) {
      console.log("Given path too short. Skipping request.")
      return {}
    }

    const folderIndex = indexPaths.pop() as number
    const destinationFolderIndex = destinationIndexPaths.pop() as number

    const containingFolder = navigateToFolderWithIndexPath(
      newState,
      destinationIndexPaths
    )

    if (containingFolder === null) {
      reorderItems(newState, folderIndex, destinationFolderIndex)

      return {
        state: newState,
      }
    }

    reorderItems(containingFolder.folders, folderIndex, destinationFolderIndex)

    return {
      state: newState,
    }
  },

  duplicateCollection(
    { state }: RESTCollectionStoreType,
    // `collectionSyncID` is used to sync the duplicated collection in `collections.sync.ts`
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { path, collectionSyncID }: { path: string; collectionSyncID?: string }
  ) {
    const t = getI18n()

    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const isRootCollection = indexPaths.length === 1

    const collection = navigateToFolderWithIndexPath(state, [...indexPaths])

    if (collection) {
      const name = `${collection.name} - ${t("action.duplicate")}`

      function recursiveChangeRefIdToAvoidConflicts(
        collection: HoppCollection
      ): HoppCollection {
        const newCollection = {
          ...collection,
          _ref_id: generateUniqueRefId("coll"),
        }

        newCollection.folders = newCollection.folders.map((folder) =>
          recursiveChangeRefIdToAvoidConflicts(folder)
        )

        return newCollection
      }

      const duplicatedCollection = {
        ...cloneDeep(collection),
        name,
        ...(collection.id
          ? { id: `${collection.id}-duplicate-collection` }
          : {}),
      }

      const duplicatedCollectionWithNewRefId =
        recursiveChangeRefIdToAvoidConflicts(duplicatedCollection)

      if (isRootCollection) {
        newState.push(duplicatedCollectionWithNewRefId)
      } else {
        const parentCollectionIndexPath = indexPaths.slice(0, -1)

        const parentCollection = navigateToFolderWithIndexPath(state, [
          ...parentCollectionIndexPath,
        ])
        parentCollection?.folders.push(duplicatedCollectionWithNewRefId)
      }
    }

    return {
      state: newState,
    }
  },

  editRequest(
    { state }: RESTCollectionStoreType,
    {
      path,
      requestIndex,
      requestNew,
    }: { path: string; requestIndex: number; requestNew: any }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve path '${path}'. Ignoring editRequest dispatch.`
      )
      return {}
    }

    targetLocation.requests = targetLocation.requests.map((req, index) =>
      index !== requestIndex ? req : requestNew
    )

    return {
      state: newState,
    }
  },

  saveRequestAs(
    { state }: RESTCollectionStoreType,
    { path, request }: { path: string; request: any }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve path '${path}'. Ignoring saveRequestAs dispatch.`
      )
      return {}
    }

    targetLocation.requests.push(request)

    return {
      state: newState,
    }
  },

  removeRequest(
    { state }: RESTCollectionStoreType,
    {
      path,
      requestIndex,
      // this requestID is used to sync the request removal
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      requestID,
    }: { path: string; requestIndex: number; requestID?: string }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve path '${path}'. Ignoring removeRequest dispatch.`
      )
      return {}
    }

    targetLocation.requests.splice(requestIndex, 1)

    // Deal with situations where a tab with the given thing is deleted
    // We are just going to dissociate the save context of the tab and mark it dirty

    const tabService = getService(RESTTabService)

    const tab = tabService.getTabRefWithSaveContext({
      originLocation: "user-collection",
      folderPath: path,
      requestIndex: requestIndex,
    })

    if (tab) {
      tab.value.document.saveContext = undefined
      tab.value.document.isDirty = true
    }

    return {
      state: newState,
    }
  },

  moveRequest(
    { state }: RESTCollectionStoreType,
    {
      path,
      requestIndex,
      destinationPath,
    }: { path: string; requestIndex: number; destinationPath: string }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    if (indexPaths.length === 0) {
      console.log("Given path too short. Skipping request.")
      return {}
    }

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve source path '${path}'. Skipping moveRequest dispatch.`
      )
      return {}
    }

    const req = targetLocation.requests[requestIndex]

    const destIndexPaths = destinationPath.split("/").map((x) => parseInt(x))

    const destLocation = navigateToFolderWithIndexPath(newState, destIndexPaths)

    if (destLocation === null) {
      console.log(
        `Could not resolve destination path '${destinationPath}'. Skipping moveRequest dispatch.`
      )
      return {}
    }

    destLocation.requests.push(req)
    targetLocation.requests.splice(requestIndex, 1)

    const tabService = getService(RESTTabService)
    const possibleTab = tabService.getTabRefWithSaveContext({
      originLocation: "user-collection",
      folderPath: path,
      requestIndex,
    })

    if (possibleTab) {
      possibleTab.value.document.saveContext = {
        originLocation: "user-collection",
        folderPath: destinationPath,
        requestIndex: destLocation.requests.length - 1,
      }
    }

    return {
      state: newState,
    }
  },

  updateRequestOrder(
    { state }: RESTCollectionStoreType,
    {
      requestIndex,
      destinationRequestIndex,
      destinationCollectionPath,
    }: {
      requestIndex: number
      destinationRequestIndex: number | null
      destinationCollectionPath: string
    }
  ) {
    const newState = state

    const indexPaths = destinationCollectionPath
      .split("/")
      .map((x) => parseInt(x))

    if (indexPaths.length === 0) {
      console.log("Given path too short. Skipping request.")
      return {}
    }

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve path '${destinationCollectionPath}'. Ignoring reorderRequest dispatch.`
      )
      return {}
    }

    // if the destination is null, we are moving to the end of the list
    if (destinationRequestIndex === null) {
      // move to the end of the list
      targetLocation.requests.push(
        targetLocation.requests.splice(requestIndex, 1)[0]
      )

      resolveSaveContextOnRequestReorder({
        lastIndex: requestIndex,
        newIndex: targetLocation.requests.length,
        folderPath: destinationCollectionPath,
      })

      return {
        state: newState,
      }
    }

    reorderItems(targetLocation.requests, requestIndex, destinationRequestIndex)

    resolveSaveContextOnRequestReorder({
      lastIndex: requestIndex,
      newIndex: destinationRequestIndex,
      folderPath: destinationCollectionPath,
    })

    return {
      state: newState,
    }
  },

  // only used for collections.sync.ts to prevent double insertion of collections from storeSync and Subscriptions
  removeDuplicateCollectionOrFolder(
    { state },
    {
      id,
      collectionPath,
      type,
    }: {
      id: string
      collectionPath: string
      type: "collection" | "request"
    }
  ) {
    const after = removeDuplicateCollectionsFromPath(
      id,
      collectionPath,
      state,
      type ?? "collection"
    )

    return {
      state: after,
    }
  },
})

const gqlCollectionDispatchers = defineDispatchers({
  setCollections(
    _: GraphqlCollectionStoreType,
    { entries }: { entries: HoppCollection[] }
  ) {
    return {
      state: entries,
    }
  },

  appendCollections(
    { state }: GraphqlCollectionStoreType,
    { entries }: { entries: HoppCollection[] }
  ) {
    return {
      state: [...state, ...entries],
    }
  },

  addCollection(
    { state }: GraphqlCollectionStoreType,
    { collection }: { collection: HoppCollection }
  ) {
    return {
      state: [...state, collection],
    }
  },

  removeCollection(
    { state }: GraphqlCollectionStoreType,
    {
      collectionIndex, // this collectionID is used to sync the collection removal
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      collectionID,
    }: { collectionIndex: number; collectionID?: string }
  ) {
    return {
      state: (state as any).filter(
        (_: any, i: number) => i !== collectionIndex
      ),
    }
  },

  editCollection(
    { state }: GraphqlCollectionStoreType,
    {
      collectionIndex,
      collection,
    }: { collectionIndex: number; collection: Partial<HoppCollection> }
  ) {
    return {
      state: state.map((col, index) =>
        index === collectionIndex ? { ...col, ...cloneDeep(collection) } : col
      ),
    }
  },

  addFolder(
    { state }: GraphqlCollectionStoreType,
    { name, path }: { name: string; path: string }
  ) {
    const newFolder: HoppCollection = makeCollection({
      name,
      folders: [],
      requests: [],
      auth: {
        authType: "inherit",
        authActive: true,
      },
      headers: [],
    })
    const newState = state
    const indexPaths = path.split("/").map((x) => parseInt(x))

    const target = navigateToFolderWithIndexPath(newState, indexPaths)

    if (target === null) {
      console.log(`Could not parse path '${path}'. Ignoring add folder request`)
      return {}
    }

    target.folders.push(newFolder)

    return {
      state: newState,
    }
  },

  editFolder(
    { state }: GraphqlCollectionStoreType,
    { path, folder }: { path: string; folder: Partial<HoppCollection> }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const target = navigateToFolderWithIndexPath(newState, indexPaths)

    if (target === null) {
      console.log(
        `Could not parse path '${path}'. Ignoring edit folder request`
      )
      return {}
    }

    Object.assign(target, {
      ...target,
      ...cloneDeep(folder),
    })

    return {
      state: newState,
    }
  },

  removeFolder(
    { state }: GraphqlCollectionStoreType,
    // folderID is used to sync the folder removal in collections.sync.ts
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { path, folderID }: { path: string; folderID?: string }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))
    if (indexPaths.length === 0) {
      console.log(
        "Given path too short. If this is a collection, use removeCollection dispatcher instead. Skipping request."
      )
      return {}
    }
    // We get the index path to the folder itself,
    // we have to find the folder containing the target folder,
    // so we pop the last path index
    const folderIndex = indexPaths.pop() as number

    const containingFolder = navigateToFolderWithIndexPath(newState, indexPaths)

    if (containingFolder === null) {
      console.log(
        `Could not resolve path '${path}'. Skipping removeFolder dispatch.`
      )
      return {}
    }

    containingFolder.folders.splice(folderIndex, 1)

    return {
      state: newState,
    }
  },

  duplicateCollection(
    { state }: GraphqlCollectionStoreType,
    // `collectionSyncID` is used to sync the duplicated collection in `gqlCollections.sync.ts`
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { path, collectionSyncID }: { path: string; collectionSyncID?: string }
  ) {
    const t = getI18n()

    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const isRootCollection = indexPaths.length === 1

    const collection = navigateToFolderWithIndexPath(state, [...indexPaths])

    if (collection) {
      const name = `${collection.name} - ${t("action.duplicate")}`

      const duplicatedCollection = {
        ...cloneDeep(collection),
        name,
        ...(collection.id
          ? { id: `${collection.id}-duplicate-collection` }
          : {}),
      }

      if (isRootCollection) {
        newState.push(duplicatedCollection)
      } else {
        const parentCollectionIndexPath = indexPaths.slice(0, -1)

        const parentCollection = navigateToFolderWithIndexPath(state, [
          ...parentCollectionIndexPath,
        ])
        parentCollection?.folders.push(duplicatedCollection)
      }
    }

    return {
      state: newState,
    }
  },

  editRequest(
    { state }: GraphqlCollectionStoreType,
    {
      path,
      requestIndex,
      requestNew,
    }: { path: string; requestIndex: number; requestNew: any }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve path '${path}'. Ignoring editRequest dispatch.`
      )
      return {}
    }

    targetLocation.requests = targetLocation.requests.map((req, index) =>
      index !== requestIndex ? req : requestNew
    )

    return {
      state: newState,
    }
  },

  saveRequestAs(
    { state }: GraphqlCollectionStoreType,
    { path, request }: { path: string; request: any }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve path '${path}'. Ignoring saveRequestAs dispatch.`
      )
      return {}
    }

    targetLocation.requests.push(request)

    return {
      state: newState,
    }
  },

  removeRequest(
    { state }: GraphqlCollectionStoreType,
    {
      path,
      requestIndex,
      // this requestID is used to sync the request removal
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      requestID,
    }: { path: string; requestIndex: number; requestID?: string }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve path '${path}'. Ignoring removeRequest dispatch.`
      )
      return {}
    }

    targetLocation.requests.splice(requestIndex, 1)

    return {
      state: newState,
    }
  },

  moveRequest(
    { state }: GraphqlCollectionStoreType,
    {
      path,
      requestIndex,
      destinationPath,
    }: { path: string; requestIndex: number; destinationPath: string }
  ) {
    const newState = state

    const indexPaths = path.split("/").map((x) => parseInt(x))

    const targetLocation = navigateToFolderWithIndexPath(newState, indexPaths)

    if (targetLocation === null) {
      console.log(
        `Could not resolve source path '${path}'. Skipping moveRequest dispatch.`
      )
      return {}
    }

    const req = targetLocation.requests[requestIndex]

    const destIndexPaths = destinationPath.split("/").map((x) => parseInt(x))

    const destLocation = navigateToFolderWithIndexPath(newState, destIndexPaths)

    if (destLocation === null) {
      console.log(
        `Could not resolve destination path '${destinationPath}'. Skipping moveRequest dispatch.`
      )
      return {}
    }

    destLocation.requests.push(req)
    targetLocation.requests.splice(requestIndex, 1)

    return {
      state: newState,
    }
  },
  // only used for collections.sync.ts to prevent double insertion of collections from storeSync and Subscriptions
  removeDuplicateCollectionOrFolder(
    { state },
    {
      id,
      collectionPath,
      type,
    }: {
      id: string
      collectionPath: string
      type: "collection" | "request"
    }
  ) {
    const after = removeDuplicateCollectionsFromPath(
      id,
      collectionPath,
      state,
      type ?? "collection"
    )

    return {
      state: after,
    }
  },
})

export const restCollectionStore = new DispatchingStore(
  defaultRESTCollectionState,
  restCollectionDispatchers
)

export const graphqlCollectionStore = new DispatchingStore(
  defaultGraphqlCollectionState,
  gqlCollectionDispatchers
)

export function setRESTCollections(entries: HoppCollection[]) {
  restCollectionStore.dispatch({
    dispatcher: "setCollections",
    payload: {
      entries,
    },
  })
}

export const restCollections$ = restCollectionStore.subject$.pipe(
  pluck("state")
)

export const graphqlCollections$ = graphqlCollectionStore.subject$.pipe(
  pluck("state")
)

export function appendRESTCollections(entries: HoppCollection[]) {
  restCollectionStore.dispatch({
    dispatcher: "appendCollections",
    payload: {
      entries,
    },
  })
}

export function addRESTCollection(collection: HoppCollection) {
  restCollectionStore.dispatch({
    dispatcher: "addCollection",
    payload: {
      collection,
    },
  })
}

export function removeRESTCollection(
  collectionIndex: number,
  collectionID?: string
) {
  restCollectionStore.dispatch({
    dispatcher: "removeCollection",
    payload: {
      collectionIndex,
      collectionID,
    },
  })
}

export function getRESTCollection(collectionIndex: number) {
  return restCollectionStore.value.state[collectionIndex]
}

function computeCollectionInheritedProps(
  collection: HoppCollection,
  ref_id: string,
  type: "my-collections" | "team-collections" = "my-collections",
  parentAuth: HoppRESTAuth | null = null,
  parentHeaders: HoppRESTHeaders | null = null
): { auth: HoppRESTAuth; headers: HoppRESTHeaders } | null {
  // Determine the inherited authentication and headers
  const inheritedAuth =
    collection.auth?.authType === "inherit" && collection.auth.authActive
      ? (parentAuth ?? { authType: "none", authActive: false })
      : (collection.auth ?? { authType: "none", authActive: false })

  const inheritedHeaders: HoppRESTHeaders = [
    ...(parentHeaders ?? []),
    ...collection.headers,
  ]

  // Check if the current collection matches the target reference ID
  const isTargetCollection =
    type === "my-collections"
      ? collection._ref_id === ref_id
      : collection.id === ref_id

  if (isTargetCollection) {
    return {
      auth: inheritedAuth,
      headers: inheritedHeaders,
    }
  }

  // Recursively search in folders
  for (const folder of collection.folders) {
    const result = computeCollectionInheritedProps(
      folder,
      ref_id,
      type,
      inheritedAuth,
      inheritedHeaders
    )
    if (result) return result // Return as soon as a match is found
  }

  return null
}

export function getRESTCollectionInheritedProps(
  collectionID: string,
  collections: HoppCollection[] = restCollectionStore.value.state,
  type: "my-collections" | "team-collections" = "my-collections"
): { auth: HoppRESTAuth; headers: HoppRESTHeaders } | null {
  for (const collection of collections) {
    const result = computeCollectionInheritedProps(
      collection,
      collectionID,
      type
    )

    if (result) {
      return result
    }
  }

  return null
}

function findCollection(
  collection: HoppCollection,
  ref_id: string
): HoppCollection | null {
  if (collection._ref_id === ref_id) {
    return collection
  }
  for (const folder of collection.folders) {
    const found = findCollection(folder, ref_id)
    if (found) {
      return found
    }
  }
  return null
}

export function getRESTCollectionByRefId(ref_id: string) {
  for (const collection of restCollectionStore.value.state) {
    const found = findCollection(collection, ref_id)
    if (found) {
      return found
    }
  }
}

export function editRESTCollection(
  collectionIndex: number,
  partialCollection: Partial<HoppCollection>
) {
  restCollectionStore.dispatch({
    dispatcher: "editCollection",
    payload: {
      collectionIndex,
      partialCollection: partialCollection,
    },
  })
}

export function addRESTFolder(name: string, path: string) {
  restCollectionStore.dispatch({
    dispatcher: "addFolder",
    payload: {
      name,
      path,
    },
  })
}

export function editRESTFolder(path: string, folder: Partial<HoppCollection>) {
  restCollectionStore.dispatch({
    dispatcher: "editFolder",
    payload: {
      path,
      folder,
    },
  })
}

export function removeRESTFolder(path: string, folderID?: string) {
  restCollectionStore.dispatch({
    dispatcher: "removeFolder",
    payload: {
      path,
      folderID,
    },
  })
}

export function moveRESTFolder(path: string, destinationPath: string | null) {
  restCollectionStore.dispatch({
    dispatcher: "moveFolder",
    payload: {
      path,
      destinationPath,
    },
  })
}

export function duplicateRESTCollection(
  path: string,
  collectionSyncID?: string
) {
  restCollectionStore.dispatch({
    dispatcher: "duplicateCollection",
    payload: {
      path,
      collectionSyncID,
    },
  })
}

export function removeDuplicateRESTCollectionOrFolder(
  id: string,
  collectionPath: string,
  type?: "collection" | "request"
) {
  restCollectionStore.dispatch({
    dispatcher: "removeDuplicateCollectionOrFolder",
    payload: {
      id,
      collectionPath,
      type: type ?? "collection",
    },
  })
}

export function editRESTRequest(
  path: string,
  requestIndex: number,
  requestNew: HoppRESTRequest
) {
  const indexPaths = path.split("/").map((x) => parseInt(x))
  if (
    !navigateToFolderWithIndexPath(restCollectionStore.value.state, indexPaths)
  )
    throw new Error("Path not found")

  restCollectionStore.dispatch({
    dispatcher: "editRequest",
    payload: {
      path,
      requestIndex,
      requestNew,
    },
  })
}

export function saveRESTRequestAs(path: string, request: HoppRESTRequest) {
  // For calculating the insertion request index
  const targetLocation = navigateToFolderWithIndexPath(
    restCollectionStore.value.state,
    path.split("/").map((x) => parseInt(x))
  )

  const insertionIndex = targetLocation!.requests.length

  restCollectionStore.dispatch({
    dispatcher: "saveRequestAs",
    payload: {
      path,
      request,
    },
  })

  return insertionIndex
}

export function removeRESTRequest(
  path: string,
  requestIndex: number,
  requestID?: string
) {
  restCollectionStore.dispatch({
    dispatcher: "removeRequest",
    payload: {
      path,
      requestIndex,
      requestID,
    },
  })
}

export function moveRESTRequest(
  path: string,
  requestIndex: number,
  destinationPath: string
) {
  restCollectionStore.dispatch({
    dispatcher: "moveRequest",
    payload: {
      path,
      requestIndex,
      destinationPath,
    },
  })
}

export function updateRESTRequestOrder(
  requestIndex: number,
  destinationRequestIndex: number | null,
  destinationCollectionPath: string
) {
  restCollectionStore.dispatch({
    dispatcher: "updateRequestOrder",
    payload: {
      requestIndex,
      destinationRequestIndex,
      destinationCollectionPath,
    },
  })
}

export function updateRESTCollectionOrder(
  collectionIndex: string,
  destinationCollectionIndex: string | null
) {
  restCollectionStore.dispatch({
    dispatcher: "updateCollectionOrder",
    payload: {
      collectionIndex,
      destinationCollectionIndex,
    },
  })
}

export function setGraphqlCollections(entries: HoppCollection[]) {
  graphqlCollectionStore.dispatch({
    dispatcher: "setCollections",
    payload: {
      entries,
    },
  })
}

export function appendGraphqlCollections(entries: HoppCollection[]) {
  graphqlCollectionStore.dispatch({
    dispatcher: "appendCollections",
    payload: {
      entries,
    },
  })
}

export function addGraphqlCollection(collection: HoppCollection) {
  graphqlCollectionStore.dispatch({
    dispatcher: "addCollection",
    payload: {
      collection,
    },
  })
}

export function removeGraphqlCollection(
  collectionIndex: number,
  collectionID?: string
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "removeCollection",
    payload: {
      collectionIndex,
      collectionID,
    },
  })
}

export function editGraphqlCollection(
  collectionIndex: number,
  collection: Partial<HoppCollection>
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "editCollection",
    payload: {
      collectionIndex,
      collection,
    },
  })
}

export function addGraphqlFolder(name: string, path: string) {
  graphqlCollectionStore.dispatch({
    dispatcher: "addFolder",
    payload: {
      name,
      path,
    },
  })
}

export function editGraphqlFolder(
  path: string,
  folder: Partial<HoppCollection>
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "editFolder",
    payload: {
      path,
      folder,
    },
  })
}

export function removeGraphqlFolder(path: string, folderID?: string) {
  graphqlCollectionStore.dispatch({
    dispatcher: "removeFolder",
    payload: {
      path,
      folderID,
    },
  })
}

export function duplicateGraphQLCollection(
  path: string,
  collectionSyncID?: string
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "duplicateCollection",
    payload: {
      path,
      collectionSyncID,
    },
  })
}

export function removeDuplicateGraphqlCollectionOrFolder(
  id: string,
  collectionPath: string,
  type?: "collection" | "request"
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "removeDuplicateCollectionOrFolder",
    payload: {
      id,
      collectionPath,
      type: type ?? "collection",
    },
  })
}

export function editGraphqlRequest(
  path: string,
  requestIndex: number,
  requestNew: HoppGQLRequest
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "editRequest",
    payload: {
      path,
      requestIndex,
      requestNew,
    },
  })
}

export function saveGraphqlRequestAs(path: string, request: HoppGQLRequest) {
  // For calculating the insertion request index
  const targetLocation = navigateToFolderWithIndexPath(
    graphqlCollectionStore.value.state,
    path.split("/").map((x) => parseInt(x))
  )

  const insertionIndex = targetLocation!.requests.length

  graphqlCollectionStore.dispatch({
    dispatcher: "saveRequestAs",
    payload: {
      path,
      request,
    },
  })

  return insertionIndex
}

export function removeGraphqlRequest(
  path: string,
  requestIndex: number,
  requestID?: string
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "removeRequest",
    payload: {
      path,
      requestIndex,
      requestID,
    },
  })
}

export function moveGraphqlRequest(
  path: string,
  requestIndex: number,
  destinationPath: string
) {
  graphqlCollectionStore.dispatch({
    dispatcher: "moveRequest",
    payload: {
      path,
      requestIndex,
      destinationPath,
    },
  })
}

function removeDuplicateCollectionsFromPath(
  idToRemove: string,
  collectionPath: string | null,
  collections: HoppCollection[],
  type: "collection" | "request"
): HoppCollection[] {
  const indexes = collectionPath?.split("/").map((x) => parseInt(x))
  indexes && indexes.pop()
  const parentPath = indexes?.join("/")

  const parentCollection = parentPath
    ? navigateToFolderWithIndexPath(
        collections,
        parentPath.split("/").map((x) => parseInt(x)) || []
      )
    : undefined

  if (collectionPath && parentCollection) {
    if (type === "collection") {
      parentCollection.folders = removeDuplicatesFromAnArrayById(
        idToRemove,
        parentCollection.folders
      )
    } else {
      parentCollection.requests = removeDuplicatesFromAnArrayById(
        idToRemove,
        parentCollection.requests
      )
    }
  } else {
    return removeDuplicatesFromAnArrayById(idToRemove, collections)
  }

  return collections

  function removeDuplicatesFromAnArrayById<T extends { id?: string }>(
    idToRemove: string,
    arrayWithID: T[]
  ) {
    const duplicateEntries = arrayWithID.filter(
      (entry) => entry.id === idToRemove
    )

    if (duplicateEntries.length === 2) {
      const duplicateEntryIndex = arrayWithID.findIndex(
        (entry) => entry.id === idToRemove
      )

      arrayWithID.splice(duplicateEntryIndex, 1)
    }

    return arrayWithID
  }
}
