import { implementation as interceptorV1 } from './v/1'

export const INTERCEPTOR_IMPLS = {
  v1: interceptorV1,
} as const
