import { runPreRequestScript } from "@hoppscotch/js-sandbox"
import {
  getCurrentEnvironment,
  getGlobalVariables,
} from "~/newstore/environments"
import { getRESTRequest } from "~/newstore/RESTSession"

export const getCombinedEnvVariables = () => {
  const variables: { key: string; value: string }[] = [...getGlobalVariables()]

  for (const variable of getCurrentEnvironment().variables) {
    const index = variables.findIndex((v) => variable.key === v.key)

    if (index === -1) {
      variables.push({
        key: variable.key,
        value: variable.value,
      })
    } else {
      variables[index].value = variable.value
    }
  }

  return variables
}

export const getFinalEnvsFromPreRequest = () =>
  runPreRequestScript(
    getRESTRequest().preRequestScript,
    getCombinedEnvVariables()
  )
