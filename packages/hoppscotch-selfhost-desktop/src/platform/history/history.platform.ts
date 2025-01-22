import { authEvents$, def as platformAuth } from "@platform/auth"
import {
  restHistoryStore,
  RESTHistoryEntry,
  setRESTHistoryEntries,
  addRESTHistoryEntry,
  toggleRESTHistoryEntryStar,
  deleteRESTHistoryEntry,
  clearRESTHistory,
  setGraphqlHistoryEntries,
  GQLHistoryEntry,
  addGraphqlHistoryEntry,
  toggleGraphqlHistoryEntryStar,
  graphqlHistoryStore,
  deleteGraphqlHistoryEntry,
  clearGraphqlHistory,
} from "@hoppscotch/common/newstore/history"
import { HistoryPlatformDef } from "@hoppscotch/common/platform/history"
import {
  getUserHistoryEntries,
  getUserHistoryStore,
  runUserHistoryAllDeletedSubscription,
  runUserHistoryCreatedSubscription,
  runUserHistoryDeletedManySubscription,
  runUserHistoryDeletedSubscription,
  runUserHistoryStoreStatusChangedSubscription,
  runUserHistoryUpdatedSubscription,
} from "./history.api"

import * as E from "fp-ts/Either"
import { restHistorySyncer, gqlHistorySyncer } from "./history.sync"
import { runGQLSubscription } from "@hoppscotch/common/helpers/backend/GQLClient"
import { runDispatchWithOutSyncing } from "@lib/sync"
import { ReqType } from "../../api/generated/graphql"
import { ref } from "vue"

function initHistorySync() {
  const currentUser$ = platformAuth.getCurrentUserStream()

  restHistorySyncer.startStoreSync()
  restHistorySyncer.setupSubscriptions(setupSubscriptions)

  gqlHistorySyncer.startStoreSync()

  getUserHistoryStatus()
  loadHistoryEntries()

  currentUser$.subscribe(async (user) => {
    getUserHistoryStatus()

    if (user) {
      await loadHistoryEntries()
    }
  })

  authEvents$.subscribe((event) => {
    if (event.event == "login" || event.event == "token_refresh") {
      restHistorySyncer.startListeningToSubscriptions()
    }

    if (event.event == "logout") {
      restHistorySyncer.stopListeningToSubscriptions()
    }
  })
}

function setupSubscriptions() {
  let subs: ReturnType<typeof runGQLSubscription>[1][] = []

  const userHistoryCreatedSub = setupUserHistoryCreatedSubscription()
  const userHistoryUpdatedSub = setupUserHistoryUpdatedSubscription()
  const userHistoryDeletedSub = setupUserHistoryDeletedSubscription()
  const userHistoryDeletedManySub = setupUserHistoryDeletedManySubscription()
  const userHistoryStoreStatusChangedSub =
    setupUserHistoryStoreStatusChangedSubscription()
  const userHistoryAllDeletedSub = setupUserHistoryAllDeletedSubscription()

  subs = [
    userHistoryCreatedSub,
    userHistoryUpdatedSub,
    userHistoryDeletedSub,
    userHistoryDeletedManySub,
    userHistoryStoreStatusChangedSub,
    userHistoryAllDeletedSub,
  ]

  return () => {
    subs.forEach((sub) => sub.unsubscribe())
  }
}

async function loadHistoryEntries() {
  const res = await getUserHistoryEntries()

  if (E.isRight(res)) {
    const restEntries = res.right.me.RESTHistory
    const gqlEntries = res.right.me.GQLHistory

    const restHistoryEntries: RESTHistoryEntry[] = restEntries.map((entry) => ({
      v: 1,
      request: JSON.parse(entry.request),
      responseMeta: JSON.parse(entry.responseMetadata),
      star: entry.isStarred,
      updatedOn: new Date(entry.executedOn),
      id: entry.id,
    }))

    const gqlHistoryEntries: GQLHistoryEntry[] = gqlEntries.map((entry) => ({
      v: 1,
      request: JSON.parse(entry.request),
      response: JSON.parse(entry.responseMetadata),
      star: entry.isStarred,
      updatedOn: new Date(entry.executedOn),
      id: entry.id,
    }))

    runDispatchWithOutSyncing(() => {
      setRESTHistoryEntries(restHistoryEntries)
      setGraphqlHistoryEntries(gqlHistoryEntries)
    })
  }
}

async function getUserHistoryStatus() {
  const currentUser = platformAuth.getCurrentUser()

  if (!currentUser) {
    isHistoryStoreEnabled.value = true
    return
  }

  isFetchingHistoryStoreStatus.value = true

  const res = await getUserHistoryStore()

  if (E.isLeft(res)) {
    hasErrorFetchingHistoryStoreStatus.value = true
    isFetchingHistoryStoreStatus.value = false
    return
  }

  isHistoryStoreEnabled.value =
    res.right.isUserHistoryEnabled.value === "ENABLE"

  isFetchingHistoryStoreStatus.value = false
}

function setupUserHistoryCreatedSubscription() {
  const [userHistoryCreated$, userHistoryCreatedSub] =
    runUserHistoryCreatedSubscription()

  userHistoryCreated$.subscribe((res) => {
    if (E.isRight(res)) {
      const { id, reqType, request, responseMetadata, isStarred, executedOn } =
        res.right.userHistoryCreated

      const hasAlreadyBeenAdded =
        reqType == ReqType.Rest
          ? restHistoryStore.value.state.some((entry) => entry.id == id)
          : graphqlHistoryStore.value.state.some((entry) => entry.id == id)

      !hasAlreadyBeenAdded &&
        runDispatchWithOutSyncing(() => {
          reqType == ReqType.Rest
            ? addRESTHistoryEntry({
                v: 1,
                id,
                request: JSON.parse(request),
                responseMeta: JSON.parse(responseMetadata),
                star: isStarred,
                updatedOn: new Date(executedOn),
              })
            : addGraphqlHistoryEntry({
                v: 1,
                id,
                request: JSON.parse(request),
                response: JSON.parse(responseMetadata),
                star: isStarred,
                updatedOn: new Date(executedOn),
              })
        })
    }
  })

  return userHistoryCreatedSub
}

// currently the updates are only for toggling the star
function setupUserHistoryUpdatedSubscription() {
  const [userHistoryUpdated$, userHistoryUpdatedSub] =
    runUserHistoryUpdatedSubscription()

  userHistoryUpdated$.subscribe((res) => {
    if (E.isRight(res)) {
      const { id, executedOn, isStarred, request, responseMetadata, reqType } =
        res.right.userHistoryUpdated

      if (reqType == ReqType.Rest) {
        const updatedRestEntryIndex = restHistoryStore.value.state.findIndex(
          (entry) => entry.id == id
        )

        if (updatedRestEntryIndex != -1) {
          runDispatchWithOutSyncing(() => {
            toggleRESTHistoryEntryStar({
              v: 1,
              id,
              request: JSON.parse(request),
              responseMeta: JSON.parse(responseMetadata),
              // because the star will be toggled in the store, we need to pass the opposite value
              star: !isStarred,
              updatedOn: new Date(executedOn),
            })
          })
        }
      }

      if (reqType == ReqType.Gql) {
        const updatedGQLEntryIndex = graphqlHistoryStore.value.state.findIndex(
          (entry) => entry.id == id
        )

        if (updatedGQLEntryIndex != -1) {
          runDispatchWithOutSyncing(() => {
            toggleGraphqlHistoryEntryStar({
              v: 1,
              id,
              request: JSON.parse(request),
              response: JSON.parse(responseMetadata),
              // because the star will be toggled in the store, we need to pass the opposite value
              star: !isStarred,
              updatedOn: new Date(executedOn),
            })
          })
        }
      }
    }
  })

  return userHistoryUpdatedSub
}

function setupUserHistoryDeletedSubscription() {
  const [userHistoryDeleted$, userHistoryDeletedSub] =
    runUserHistoryDeletedSubscription()

  userHistoryDeleted$.subscribe((res) => {
    if (E.isRight(res)) {
      const { id, reqType } = res.right.userHistoryDeleted

      if (reqType == ReqType.Gql) {
        const deletedEntry = graphqlHistoryStore.value.state.find(
          (entry) => entry.id == id
        )

        deletedEntry &&
          runDispatchWithOutSyncing(() => {
            deleteGraphqlHistoryEntry(deletedEntry)
          })
      }

      if (reqType == ReqType.Rest) {
        const deletedEntry = restHistoryStore.value.state.find(
          (entry) => entry.id == id
        )

        deletedEntry &&
          runDispatchWithOutSyncing(() => {
            deleteRESTHistoryEntry(deletedEntry)
          })
      }
    }
  })

  return userHistoryDeletedSub
}

function setupUserHistoryDeletedManySubscription() {
  const [userHistoryDeletedMany$, userHistoryDeletedManySub] =
    runUserHistoryDeletedManySubscription()

  userHistoryDeletedMany$.subscribe((res) => {
    if (E.isRight(res)) {
      const { reqType } = res.right.userHistoryDeletedMany

      runDispatchWithOutSyncing(() => {
        reqType == ReqType.Rest ? clearRESTHistory() : clearGraphqlHistory()
      })
    }
  })

  return userHistoryDeletedManySub
}

function setupUserHistoryStoreStatusChangedSubscription() {
  const [userHistoryStoreStatusChanged$, userHistoryStoreStatusChangedSub] =
    runUserHistoryStoreStatusChangedSubscription()

  userHistoryStoreStatusChanged$.subscribe((res) => {
    if (E.isRight(res)) {
      const status = res.right.infraConfigUpdate == "ENABLE" ? true : false

      isHistoryStoreEnabled.value = status
    }
  })

  return userHistoryStoreStatusChangedSub
}

function setupUserHistoryAllDeletedSubscription() {
  const [userHistoryAllDeleted$, userHistoryAllDeletedSub] =
    runUserHistoryAllDeletedSubscription()

  userHistoryAllDeleted$.subscribe((res) => {
    if (E.isRight(res)) {
      runDispatchWithOutSyncing(() => {
        clearRESTHistory()
        clearGraphqlHistory()
      })
    }
  })

  return userHistoryAllDeletedSub
}

export const isHistoryStoreEnabled = ref(false)
const isFetchingHistoryStoreStatus = ref(false)
const hasErrorFetchingHistoryStoreStatus = ref(false)

export const def: HistoryPlatformDef = {
  initHistorySync,
  requestHistoryStore: {
    isHistoryStoreEnabled,
    isFetchingHistoryStoreStatus,
    hasErrorFetchingHistoryStoreStatus,
  },
}
