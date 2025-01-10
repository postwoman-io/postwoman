import { SettingsPlatformDef } from "@hoppscotch/common/platform/settings"
import { settingsSyncer } from "./sync"
import { authEvents$, def as platformAuth } from "@platform/auth/web"
import {
  createUserSettings,
  getUserSettings,
  runUserSettingsUpdatedSubscription,
} from "./api"
import * as E from "fp-ts/Either"
import { runGQLSubscription } from "@hoppscotch/common/helpers/backend/GQLClient"
import {
  bulkApplySettings,
  getDefaultSettings,
} from "@hoppscotch/common/newstore/settings"
import { runDispatchWithOutSyncing } from "@lib/sync"

function initSettingsSync() {
  const currentUser$ = platformAuth.getCurrentUserStream()
  settingsSyncer.startStoreSync()
  settingsSyncer.setupSubscriptions(setupSubscriptions)

  // load the settings

  loadUserSettings()

  currentUser$.subscribe(async (user) => {
    if (user) {
      // load the settings
      loadUserSettings()
    }
  })

  authEvents$.subscribe((event) => {
    if (event.event == "login" || event.event == "token_refresh") {
      settingsSyncer.startListeningToSubscriptions()
    }

    if (event.event == "logout") {
      settingsSyncer.stopListeningToSubscriptions()
    }
  })
}

async function loadUserSettings() {
  const res = await getUserSettings()

  // create user settings if it doesn't exist
  E.isLeft(res) &&
    res.left.error == "user_settings/not_found" &&
    (await createUserSettings(JSON.stringify(getDefaultSettings())))

  if (E.isRight(res)) {
    runDispatchWithOutSyncing(() => {
      bulkApplySettings(JSON.parse(res.right.me.settings.properties))
    })
  }
}

function setupSubscriptions() {
  let subs: ReturnType<typeof runGQLSubscription>[1][] = []

  const userSettingsUpdatedSub = setupUserSettingsUpdatedSubscription()

  subs = [userSettingsUpdatedSub]

  return () => {
    subs.forEach((sub) => sub.unsubscribe())
  }
}

function setupUserSettingsUpdatedSubscription() {
  const [userSettingsUpdated$, userSettingsUpdatedSub] =
    runUserSettingsUpdatedSubscription()

  userSettingsUpdated$.subscribe((res) => {
    if (E.isRight(res)) {
      runDispatchWithOutSyncing(() => {
        bulkApplySettings(JSON.parse(res.right.userSettingsUpdated.properties))
      })
    }
  })

  return userSettingsUpdatedSub
}

export const def: SettingsPlatformDef = {
  initSettingsSync,
}
