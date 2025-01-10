import {
  environmentsStore,
  getGlobalVariableID,
  removeDuplicateEntry,
} from "@hoppscotch/common/newstore/environments"
import {
  getSettingSubject,
  settingsStore,
} from "@hoppscotch/common/newstore/settings"

import { getSyncInitFunction } from "@lib/sync"

import * as E from "fp-ts/Either"

import { StoreSyncDefinitionOf } from "@lib/sync"
import { createMapper } from "@lib/sync/mapper"
import {
  clearGlobalEnvironmentVariables,
  createUserEnvironment,
  deleteUserEnvironment,
  updateUserEnvironment,
} from "./api"
import { SecretEnvironmentService } from "@hoppscotch/common/services/secret-environment.service"
import { getService } from "@hoppscotch/common/modules/dioc"

export const environmentsMapper = createMapper<number, string>()
export const globalEnvironmentMapper = createMapper<number, string>()

const secretEnvironmentService = getService(SecretEnvironmentService)

export const storeSyncDefinition: StoreSyncDefinitionOf<
  typeof environmentsStore
> = {
  async createEnvironment({ name, variables }) {
    const lastCreatedEnvIndex = environmentsStore.value.environments.length - 1

    const res = await createUserEnvironment(name, JSON.stringify(variables))

    if (E.isRight(res)) {
      const id = res.right.createUserEnvironment.id

      secretEnvironmentService.updateSecretEnvironmentID(
        environmentsStore.value.environments[lastCreatedEnvIndex].id,
        id
      )

      environmentsStore.value.environments[lastCreatedEnvIndex].id = id
      removeDuplicateEntry(id)
    }
  },
  async appendEnvironments({ envs }) {
    const appendListLength = envs.length
    let appendStart =
      environmentsStore.value.environments.length - appendListLength - 1

    envs.forEach((env) => {
      const envId = ++appendStart

      ;(async function () {
        const res = await createUserEnvironment(
          env.name,
          JSON.stringify(env.variables)
        )

        if (E.isRight(res)) {
          const id = res.right.createUserEnvironment.id
          environmentsStore.value.environments[envId].id = id

          removeDuplicateEntry(id)
        }
      })()
    })
  },
  async duplicateEnvironment({ envIndex }) {
    const environmentToDuplicate = environmentsStore.value.environments.find(
      (_, index) => index === envIndex
    )

    const lastCreatedEnvIndex = environmentsStore.value.environments.length - 1

    if (environmentToDuplicate) {
      const res = await createUserEnvironment(
        `${environmentToDuplicate?.name} - Duplicate`,
        JSON.stringify(environmentToDuplicate?.variables)
      )

      if (E.isRight(res)) {
        const id = res.right.createUserEnvironment.id
        environmentsStore.value.environments[lastCreatedEnvIndex].id = id

        removeDuplicateEntry(id)
      }
    }
  },
  updateEnvironment({ envIndex, updatedEnv }) {
    const backendId = environmentsStore.value.environments[envIndex].id
    if (backendId) {
      updateUserEnvironment(backendId, updatedEnv)()
    }
  },
  async deleteEnvironment({ envID }) {
    if (envID) {
      await deleteUserEnvironment(envID)()
    }
  },
  setGlobalVariables({ entries }) {
    const backendId = getGlobalVariableID()
    if (backendId) {
      updateUserEnvironment(backendId, {
        name: "",
        variables: entries,
        id: "",
        v: 1,
      })()
    }
  },
  clearGlobalVariables() {
    const backendId = getGlobalVariableID()

    if (backendId) {
      clearGlobalEnvironmentVariables(backendId)
    }
  },
}

export const environnmentsSyncer = getSyncInitFunction(
  environmentsStore,
  storeSyncDefinition,
  () => settingsStore.value.syncEnvironments,
  getSettingSubject("syncEnvironments")
)
