import * as E from "fp-ts/Either"
import { runPreRequestScript } from "@hoppscotch/js-sandbox/web"
import { Environment } from "@hoppscotch/data"
import { cloneDeep } from "lodash-es"

import {
  getCurrentEnvironment,
  getGlobalVariables,
} from "~/newstore/environments"
import { TestResult } from "@hoppscotch/js-sandbox"
import { getService } from "~/modules/dioc"
import { SecretEnvironmentService } from "~/services/secret-environment.service"

const secretEnvironmentService = getService(SecretEnvironmentService)

const unsecretEnvironments = (
  selected: Environment,
  global: Environment["variables"]
) => {
  const resolvedGlobalWithSecrets = global.map((globalVar, index) => {
    const secretVar = secretEnvironmentService.getSecretEnvironmentVariable(
      "Global",
      index
    )
    if (secretVar) {
      return {
        ...globalVar,
        value: secretVar.value,
      }
    } else if (!("value" in globalVar) || !globalVar.value) {
      return {
        ...globalVar,
        value: "",
      }
    }
    return globalVar
  })

  const resolvedSelectedWithSecrets = selected.variables.map(
    (selectedVar, index) => {
      const secretVar = secretEnvironmentService.getSecretEnvironmentVariable(
        selected.id,
        index
      )
      if (secretVar) {
        return {
          ...selectedVar,
          value: secretVar.value,
        }
      } else if (!("value" in selectedVar) || !selectedVar.value) {
        return {
          ...selectedVar,
          value: "",
        }
      }
      return selectedVar
    }
  )

  return {
    global: resolvedGlobalWithSecrets,
    selected: resolvedSelectedWithSecrets,
  }
}

export const getCombinedEnvVariables = (temp?: Environment["variables"]) => {
  const reformedVars = unsecretEnvironments(
    getCurrentEnvironment(),
    getGlobalVariables()
  )
  return {
    global: cloneDeep(reformedVars.global),
    selected: cloneDeep(reformedVars.selected),
    temp: temp ? cloneDeep(temp) : [],
  }
}

export const getFinalEnvsFromPreRequest = (
  script: string,
  envs: {
    global: Environment["variables"]
    selected: Environment["variables"]
    temp: Environment["variables"]
  }
): Promise<E.Either<string, TestResult["envs"]>> =>
  runPreRequestScript(script, envs)
