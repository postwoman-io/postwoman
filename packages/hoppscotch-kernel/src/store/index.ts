import { v1 } from './v/1'

export type {
    StoreV1,
} from './v/1'

export const VERSIONS = {
    v1,
} as const

export const latest = v1
