import { ref } from "vue"
import { GlobalEnvironmentVariable } from "@hoppscotch/data"

export const temporaryVariables = ref<GlobalEnvironmentVariable[]>([])

export function getTemporaryVariables() {
  return temporaryVariables.value
}

export function setTemporaryVariables(variables: GlobalEnvironmentVariable[]) {
  temporaryVariables.value = variables
}

export function clearTemporaryVariables() {
  temporaryVariables.value = []
}

export function addTemporaryVariable(variable: GlobalEnvironmentVariable) {
  temporaryVariables.value.push(variable)
}
