import type { Version } from '@type/versioning'

export function checkCapability(required: Version, available: Version): boolean {
  if (available.major !== required.major) return false
  if (available.minor < required.minor) return false
  return true
}
