import { Ref } from "vue"

export type HistoryPlatformDef = {
  initHistorySync: () => void
  requestHistoryStore?: {
    isHistoryStoreEnabled: Ref<boolean>
    isFetchingHistoryStoreStatus: Ref<boolean>
    hasErrorFetchingHistoryStoreStatus: Ref<boolean>
  }
}
