import * as E from "fp-ts/Either"
import { entityReference } from "verzod"

import {
  createEnvironment,
  deleteEnvironment,
  environmentsStore,
  getLocalIndexByEnvironmentID,
  replaceEnvironments,
  setGlobalEnvID,
  setGlobalEnvVariables,
  updateEnvironment,
} from "@hoppscotch/common/newstore/environments"
import { authEvents$, def as platformAuth } from "@platform/auth/auth.platform"

import { runGQLSubscription } from "@hoppscotch/common/helpers/backend/GQLClient"
import { EnvironmentsPlatformDef } from "@hoppscotch/common/src/platform/environments"

import { environnmentsSyncer } from "@platform/environments/environments.sync"

import { GlobalEnvironment } from "@hoppscotch/data"
import { runDispatchWithOutSyncing } from "@lib/sync"
import {
  createUserGlobalEnvironment,
  getGlobalEnvironments,
  getUserEnvironments,
  runUserEnvironmentCreatedSubscription,
  runUserEnvironmentDeletedSubscription,
  runUserEnvironmentUpdatedSubscription,
} from "@platform/environments/environments.api"

export function initEnvironmentsSync() {
  const currentUser$ = platformAuth.getCurrentUserStream()

  environnmentsSyncer.startStoreSync()
  environnmentsSyncer.setupSubscriptions(setupSubscriptions)

  currentUser$.subscribe(async (user) => {
    if (user) {
      await loadAllEnvironments()
    }
  })

  authEvents$.subscribe((event) => {
    if (event.event == "login" || event.event == "token_refresh") {
      environnmentsSyncer.startListeningToSubscriptions()
    }

    if (event.event == "logout") {
      environnmentsSyncer.stopListeningToSubscriptions()
    }
  })
}

export const def: EnvironmentsPlatformDef = {
  initEnvironmentsSync,
}

function setupSubscriptions() {
  let subs: ReturnType<typeof runGQLSubscription>[1][] = []

  const userEnvironmentCreatedSub = setupUserEnvironmentCreatedSubscription()
  const userEnvironmentUpdatedSub = setupUserEnvironmentUpdatedSubscription()
  const userEnvironmentDeletedSub = setupUserEnvironmentDeletedSubscription()

  subs = [
    userEnvironmentCreatedSub,
    userEnvironmentUpdatedSub,
    userEnvironmentDeletedSub,
  ]

  return () => {
    subs.forEach((sub) => sub.unsubscribe())
  }
}

async function loadUserEnvironments() {
  const res = await getUserEnvironments()

  if (E.isRight(res)) {
    const environments = res.right.me.environments

    if (environments.length > 0) {
      runDispatchWithOutSyncing(() => {
        replaceEnvironments(
          environments.map(({ id, variables, name }) => ({
            v: 1,
            id,
            name,
            variables: JSON.parse(variables),
          }))
        )
      })
    }
  }
}

async function loadGlobalEnvironments() {
  const res = await getGlobalEnvironments()

  if (E.isRight(res)) {
    const globalEnv = res.right.me.globalEnvironments

    if (globalEnv) {
      const globalEnvVariableEntries = JSON.parse(globalEnv.variables)

      const result = entityReference(GlobalEnvironment).safeParse(
        globalEnvVariableEntries
      )

      runDispatchWithOutSyncing(() => {
        setGlobalEnvVariables(
          result.success ? result.data : globalEnvVariableEntries
        )
        setGlobalEnvID(globalEnv.id)
      })
    }
  } else if (res.left.error == "user_environment/user_env_does_not_exists") {
    const res = await createUserGlobalEnvironment(JSON.stringify([]))

    if (E.isRight(res)) {
      const backendId = res.right.createUserGlobalEnvironment.id
      setGlobalEnvID(backendId)
    }
  }
}

async function loadAllEnvironments() {
  await loadUserEnvironments()
  await loadGlobalEnvironments()
}

function setupUserEnvironmentCreatedSubscription() {
  const [userEnvironmentCreated$, userEnvironmentCreatedSub] =
    runUserEnvironmentCreatedSubscription()

  userEnvironmentCreated$.subscribe((res) => {
    if (E.isRight(res)) {
      const { name, variables, id } = res.right.userEnvironmentCreated

      const isAlreadyExisting = environmentsStore.value.environments.some(
        (env) => env.id == id
      )

      if (name && !isAlreadyExisting) {
        runDispatchWithOutSyncing(() => {
          createEnvironment(name, JSON.parse(variables), id)
        })
      }
    }
  })

  return userEnvironmentCreatedSub
}

function setupUserEnvironmentUpdatedSubscription() {
  const [userEnvironmentUpdated$, userEnvironmentUpdatedSub] =
    runUserEnvironmentUpdatedSubscription()

  userEnvironmentUpdated$.subscribe((res) => {
    if (E.isRight(res)) {
      const { name, variables, id, isGlobal } = res.right.userEnvironmentUpdated

      // handle the case for global environments
      if (isGlobal) {
        runDispatchWithOutSyncing(() => {
          setGlobalEnvVariables(JSON.parse(variables))
        })
      } else {
        // handle the case for normal environments

        const localIndex = environmentsStore.value.environments.findIndex(
          (env) => env.id == id
        )

        if ((localIndex || localIndex == 0) && name) {
          runDispatchWithOutSyncing(() => {
            updateEnvironment(localIndex, {
              v: 1,
              id,
              name,
              variables: JSON.parse(variables),
            })
          })
        }
      }
    }
  })

  return userEnvironmentUpdatedSub
}

function setupUserEnvironmentDeletedSubscription() {
  const [userEnvironmentDeleted$, userEnvironmentDeletedSub] =
    runUserEnvironmentDeletedSubscription()

  userEnvironmentDeleted$.subscribe((res) => {
    if (E.isRight(res)) {
      const { id } = res.right.userEnvironmentDeleted

      // TODO: move getLocalIndexByID to a getter in the environmentsStore
      const localIndex = getLocalIndexByEnvironmentID(id)

      if (localIndex || localIndex === 0) {
        runDispatchWithOutSyncing(() => {
          deleteEnvironment(localIndex)
        })
      }
    }
  })

  return userEnvironmentDeletedSub
}
