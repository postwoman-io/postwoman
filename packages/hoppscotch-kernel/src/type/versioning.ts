export type Version = {
  major: number
  minor: number
  patch: number
}

export type VersionedAPI<T> = {
  version: Version
  api: T
}
