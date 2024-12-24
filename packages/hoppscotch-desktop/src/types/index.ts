export interface RecentUrl {
  url: string
  lastUsed: string
  version?: string
  pinned: boolean
}

export interface StoreSchema {
  recentUrls: RecentUrl[]
}
