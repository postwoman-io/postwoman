import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import { InferredEntity, createVersionedEntity } from "verzod"

import { z } from "zod"

import V0_VERSION from "./v/0"
import V1_VERSION, { uniqueID } from "./v/1"
import { HOPP_SUPPORTED_PREDEFINED_VARIABLES } from "../predefinedVariables"

const versionedObject = z.object({
  v: z.number(),
})

export const Environment = createVersionedEntity({
  latestVersion: 1,
  versionMap: {
    0: V0_VERSION,
    1: V1_VERSION,
  },
  getVersion(data) {
    const versionCheck = versionedObject.safeParse(data)

    if (versionCheck.success) return versionCheck.data.v

    // For V0 we have to check the schema
    const result = V0_VERSION.schema.safeParse(data)
    return result.success ? 0 : null
  },
})

export type Environment = InferredEntity<typeof Environment>

export type EnvironmentVariable = InferredEntity<
  typeof Environment
>["variables"][number]

const REGEX_ENV_VAR = /<<([^>]*)>>/g // "<<myVariable>>"

/**
 * How much times can we expand environment variables
 */
const ENV_MAX_EXPAND_LIMIT = 10

/**
 * Error state when there is a suspected loop while
 * recursively expanding variables
 */
const ENV_EXPAND_LOOP = "ENV_EXPAND_LOOP" as const

export const EnvironmentSchemaVersion = 1

export function parseBodyEnvVariablesE(
  body: string,
  env: Environment["variables"]
) {
  let result = body
  let depth = 0

  while (result.match(REGEX_ENV_VAR) != null && depth <= ENV_MAX_EXPAND_LIMIT) {
    result = result.replace(REGEX_ENV_VAR, (key) => {
      const variableName = key.replace(/[<>]/g, "")

      // Prioritise predefined variable values over normal environment variables processing.
      const foundPredefinedVar = HOPP_SUPPORTED_PREDEFINED_VARIABLES.find(
        (preVar) => preVar.key === variableName
      )

      if (foundPredefinedVar) {
        return foundPredefinedVar.getValue()
      }

      const foundEnv = env.find((envVar) => envVar.key === variableName)

      if (foundEnv && "value" in foundEnv) {
        return foundEnv.value
      }
      return key
    })

    depth++
  }

  return depth > ENV_MAX_EXPAND_LIMIT
    ? E.left(ENV_EXPAND_LOOP)
    : E.right(result)
}

/**
 * @deprecated Use `parseBodyEnvVariablesE` instead.
 */
export const parseBodyEnvVariables = (
  body: string,
  env: Environment["variables"]
) =>
  pipe(
    parseBodyEnvVariablesE(body, env),
    E.getOrElse(() => body)
  )

export function parseTemplateStringE(
  str: string,
  variables:
    | Environment["variables"]
    | { secret: true; value: string; key: string }[],
  maskValue = false,
  showKeyIfSecret = false
) {
  if (!variables || !str) {
    return E.right(str)
  }

  let result = str
  let depth = 0
  let isSecret = false

  while (
    result.match(REGEX_ENV_VAR) != null &&
    depth <= ENV_MAX_EXPAND_LIMIT &&
    !isSecret
  ) {
    result = decodeURI(encodeURI(result)).replace(REGEX_ENV_VAR, (_, p1) => {
      // Prioritise predefined variable values over normal environment variables processing.
      const foundPredefinedVar = HOPP_SUPPORTED_PREDEFINED_VARIABLES.find(
        (preVar) => preVar.key === p1
      )

      if (foundPredefinedVar) {
        return foundPredefinedVar.getValue()
      }

      const variable = variables.find((x) => x && x.key === p1)

      if (variable && "value" in variable) {
        // Show the key if it is a secret and explicitly specified
        if (variable.secret && showKeyIfSecret) {
          isSecret = true
          return `<<${p1}>>`
        }
        // Mask the value if it is a secret and explicitly specified
        if (variable.secret && maskValue) {
          return "*".repeat(
            (variable as { secret: true; value: string; key: string }).value
              .length
          )
        }
        return variable.value
      }

      return ""
    })
    depth++
  }

  return depth > ENV_MAX_EXPAND_LIMIT
    ? E.left(ENV_EXPAND_LOOP)
    : E.right(result)
}

export type NonSecretEnvironmentVariable = Extract<
  EnvironmentVariable,
  { secret: false }
>

export type NonSecretEnvironment = Omit<Environment, "variables"> & {
  variables: NonSecretEnvironmentVariable[]
}

/**
 * @deprecated Use `parseTemplateStringE` instead
 */
export const parseTemplateString = (
  str: string,
  variables:
    | Environment["variables"]
    | { secret: true; value: string; key: string }[],
  maskValue = false,
  showKeyIfSecret = false
) =>
  pipe(
    parseTemplateStringE(str, variables, maskValue, showKeyIfSecret),
    E.getOrElse(() => str)
  )

export const translateToNewEnvironmentVariables = (
  x: any
): Environment["variables"][number] => {
  return {
    key: x.key,
    value: x.value,
    secret: false,
  }
}

export const translateToNewEnvironment = (x: any): Environment => {
  if (x.v && x.v === EnvironmentSchemaVersion) return x

  // Legacy
  const id = x.id || uniqueID()
  const name = x.name ?? "Untitled"
  const variables = (x.variables ?? []).map(translateToNewEnvironmentVariables)

  return {
    v: EnvironmentSchemaVersion,
    id,
    name,
    variables,
  }
}
