import {
  graphqlHistoryStore,
  removeDuplicateRestHistoryEntry,
  removeDuplicateGraphqlHistoryEntry,
  restHistoryStore,
} from "@hoppscotch/common/newstore/history"
import {
  getSettingSubject,
  settingsStore,
} from "@hoppscotch/common/newstore/settings"

import { getSyncInitFunction } from "@lib/sync"

import * as E from "fp-ts/Either"

import { StoreSyncDefinitionOf } from "@lib/sync"
import {
  createUserHistory,
  deleteAllUserHistory,
  removeRequestFromHistory,
  toggleHistoryStarStatus,
} from "./api"
import { ReqType } from "@api/generated/graphql"

import { isHistoryStoreEnabled } from "."

export const restHistoryStoreSyncDefinition: StoreSyncDefinitionOf<
  typeof restHistoryStore
> = {
  async addEntry({ entry }) {
    if (!isHistoryStoreEnabled.value) {
      return
    }

    const res = await createUserHistory(
      JSON.stringify(entry.request),
      JSON.stringify(entry.responseMeta),
      ReqType.Rest
    )

    if (E.isRight(res)) {
      entry.id = res.right.createUserHistory.id

      // preventing double insertion from here and subscription
      removeDuplicateRestHistoryEntry(entry.id)
    }
  },
  deleteEntry({ entry }) {
    if (entry.id) {
      removeRequestFromHistory(entry.id)
    }
  },
  toggleStar({ entry }) {
    if (entry.id) {
      toggleHistoryStarStatus(entry.id)
    }
  },
  clearHistory() {
    deleteAllUserHistory(ReqType.Rest)
  },
}

export const gqlHistoryStoreSyncDefinition: StoreSyncDefinitionOf<
  typeof graphqlHistoryStore
> = {
  async addEntry({ entry }) {
    if (!isHistoryStoreEnabled.value) {
      return
    }

    const res = await createUserHistory(
      JSON.stringify(entry.request),
      JSON.stringify(entry.response),
      ReqType.Gql
    )

    if (E.isRight(res)) {
      entry.id = res.right.createUserHistory.id

      // preventing double insertion from here and subscription
      removeDuplicateGraphqlHistoryEntry(entry.id)
    }
  },
  deleteEntry({ entry }) {
    if (entry.id) {
      removeRequestFromHistory(entry.id)
    }
  },
  toggleStar({ entry }) {
    if (entry.id) {
      toggleHistoryStarStatus(entry.id)
    }
  },
  clearHistory() {
    deleteAllUserHistory(ReqType.Gql)
  },
}

export const restHistorySyncer = getSyncInitFunction(
  restHistoryStore,
  restHistoryStoreSyncDefinition,
  () => settingsStore.value.syncHistory,
  getSettingSubject("syncHistory")
)

export const gqlHistorySyncer = getSyncInitFunction(
  graphqlHistoryStore,
  gqlHistoryStoreSyncDefinition,
  () => settingsStore.value.syncHistory,
  getSettingSubject("syncHistory")
)
