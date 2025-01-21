import { settingsStore } from "@hoppscotch/common/newstore/settings"

import { getSyncInitFunction } from "@lib/sync"

import { StoreSyncDefinitionOf } from "@lib/sync"

import { updateUserSettings } from "./api"

export const settingsSyncDefinition: StoreSyncDefinitionOf<
  typeof settingsStore
> = {
  toggleSetting() {
    updateUserSettings(JSON.stringify(settingsStore.value))
  },
  toggleNestedSetting() {
    updateUserSettings(JSON.stringify(settingsStore.value))
  },
  applySetting() {
    updateUserSettings(JSON.stringify(settingsStore.value))
  },
  applyNestedSetting() {
    updateUserSettings(JSON.stringify(settingsStore.value))
  },
}

export const settingsSyncer = getSyncInitFunction(
  settingsStore,
  settingsSyncDefinition,
  () => true
)
