import {
  Environment,
  HoppRESTHeaders,
  HoppRESTRequest,
  HoppRESTRequestVariable,
} from "@hoppscotch/data"
import { SandboxTestResult, TestDescriptor } from "@hoppscotch/js-sandbox"
import { runTestScript } from "@hoppscotch/js-sandbox/web"
import * as A from "fp-ts/Array"
import * as E from "fp-ts/Either"
import * as O from "fp-ts/Option"
import { flow, pipe } from "fp-ts/function"
import { cloneDeep } from "lodash-es"
import { Observable, Subject } from "rxjs"
import { filter } from "rxjs/operators"
import { Ref } from "vue"

import { getService } from "~/modules/dioc"
import {
  environmentsStore,
  getCurrentEnvironment,
  getEnvironment,
  getGlobalVariables,
  setGlobalEnvVariables,
  updateEnvironment,
} from "~/newstore/environments"
import {
  SecretEnvironmentService,
  SecretVariable,
} from "~/services/secret-environment.service"
import { HoppTab } from "~/services/tab"
import { updateTeamEnvironment } from "./backend/mutations/TeamEnvironment"
import { createRESTNetworkRequestStream } from "./network"
import {
  getCombinedEnvVariables,
  getFinalEnvsFromPreRequest,
} from "./preRequest"
import { HoppRequestDocument } from "./rest/document"
import { HoppRESTResponse } from "./types/HoppRESTResponse"
import { HoppTestData, HoppTestResult } from "./types/HoppTestResult"
import { getEffectiveRESTRequest } from "./utils/EffectiveURL"
import { isJSONContentType } from "./utils/contenttypes"
import {
  getTemporaryVariables,
  setTemporaryVariables,
} from "./runner/temp_envs"

const secretEnvironmentService = getService(SecretEnvironmentService)

export const getTestableBody = (
  res: HoppRESTResponse & { type: "success" | "fail" }
) => {
  const contentTypeHeader = res.headers.find(
    (h) => h.key.toLowerCase() === "content-type"
  )

  const rawBody = new TextDecoder("utf-8")
    .decode(res.body)
    .replaceAll("\x00", "")

  const x = pipe(
    // This pipeline just decides whether JSON parses or not
    contentTypeHeader && isJSONContentType(contentTypeHeader.value)
      ? O.of(rawBody)
      : O.none,

    // Try parsing, if failed, go to the fail option
    O.chain((body) => O.tryCatch(() => JSON.parse(body))),

    // If JSON, return that (get), else return just the body string (else)
    O.getOrElse<any | string>(() => rawBody)
  )

  return x
}

export const combineEnvVariables = (variables: {
  environments: {
    selected: Environment["variables"]
    global: Environment["variables"]
    temp?: Environment["variables"]
  }
  requestVariables: Environment["variables"]
}) => [
  ...variables.requestVariables,
  ...(variables.environments.temp ?? []),
  ...variables.environments.selected,
  ...variables.environments.global,
]

export const executedResponses$ = new Subject<
  HoppRESTResponse & { type: "success" | "fail " }
>()

/**
 * Used to update the environment schema with the secret variables
 * and store the secret variable values in the secret environment service
 * @param envs The environment variables to update
 * @param type Whether the environment variables are global or selected
 * @returns the updated environment variables
 */
const updateEnvironmentsWithSecret = (
  envs: Environment["variables"] &
    {
      secret: true
      value: string | undefined
      key: string
    }[],
  type: "global" | "selected"
) => {
  const currentEnvID =
    type === "selected" ? getCurrentEnvironment().id : "Global"

  const updatedSecretEnvironments: SecretVariable[] = []

  const updatedEnv = pipe(
    envs,
    A.mapWithIndex((index, e) => {
      if (e.secret) {
        updatedSecretEnvironments.push({
          key: e.key,
          value: e.value ?? "",
          varIndex: index,
        })

        // delete the value from the environment
        // so that it doesn't get saved in the environment
        delete e.value
        return e
      }
      return e
    })
  )
  if (currentEnvID) {
    secretEnvironmentService.addSecretEnvironment(
      currentEnvID,
      updatedSecretEnvironments
    )
  }
  return updatedEnv
}

/**
 * Transforms the environment list to a list with unique keys with value
 * @param envs The environment list to be transformed
 * @returns The transformed environment list with keys with value
 */
const filterNonEmptyEnvironmentVariables = (
  envs: Environment["variables"]
): Environment["variables"] => {
  const envsMap = new Map<string, Environment["variables"][number]>()

  envs.forEach((env) => {
    if (env.secret) {
      envsMap.set(env.key, env)
    } else if (envsMap.has(env.key)) {
      const existingEnv = envsMap.get(env.key)

      if (
        existingEnv &&
        "value" in existingEnv &&
        existingEnv.value === "" &&
        env.value !== ""
      ) {
        envsMap.set(env.key, env)
      }
    } else {
      envsMap.set(env.key, env)
    }
  })

  return Array.from(envsMap.values())
}

export function runRESTRequest$(
  tab: Ref<HoppTab<HoppRequestDocument>>
): [
  () => void,
  Promise<
    | E.Left<"script_fail" | "cancellation">
    | E.Right<Observable<HoppRESTResponse>>
  >,
] {
  let cancelCalled = false
  let cancelFunc: (() => void) | null = null

  const cancel = () => {
    cancelCalled = true
    cancelFunc?.()
  }

  const res = getFinalEnvsFromPreRequest(
    tab.value.document.request.preRequestScript,
    getCombinedEnvVariables()
  ).then(async (envs) => {
    if (cancelCalled) return E.left("cancellation" as const)

    if (E.isLeft(envs)) {
      console.error(envs.left)
      return E.left("script_fail" as const)
    }

    const requestAuth =
      tab.value.document.request.auth.authType === "inherit" &&
      tab.value.document.request.auth.authActive
        ? tab.value.document.inheritedProperties?.auth.inheritedAuth
        : tab.value.document.request.auth

    let requestHeaders

    const inheritedHeaders =
      tab.value.document.inheritedProperties?.headers.map((header) => {
        if (header.inheritedHeader) {
          return header.inheritedHeader
        }
        return []
      })

    if (inheritedHeaders) {
      requestHeaders = [
        ...inheritedHeaders,
        ...tab.value.document.request.headers,
      ]
    } else {
      requestHeaders = [...tab.value.document.request.headers]
    }

    const finalRequestVariables =
      tab.value.document.request.requestVariables.map(
        (v: HoppRESTRequestVariable) => {
          if (v.active) {
            return {
              key: v.key,
              value: v.value,
              secret: false,
            }
          }
          return []
        }
      )

    const finalRequest = {
      ...tab.value.document.request,
      auth: requestAuth ?? { authType: "none", authActive: false },
      headers: requestHeaders as HoppRESTHeaders,
    }

    const finalEnvs = {
      requestVariables: finalRequestVariables as Environment["variables"],
      environments: envs.right,
    }

    const finalEnvsWithNonEmptyValues = filterNonEmptyEnvironmentVariables(
      combineEnvVariables(finalEnvs)
    )

    const effectiveRequest = await getEffectiveRESTRequest(finalRequest, {
      id: "env-id",
      v: 1,
      name: "Env",
      variables: finalEnvsWithNonEmptyValues,
    })

    const [stream, cancelRun] = createRESTNetworkRequestStream(
      await effectiveRequest
    )
    cancelFunc = cancelRun

    const subscription = stream
      .pipe(filter((res) => res.type === "success" || res.type === "fail"))
      .subscribe(async (res) => {
        if (res.type === "success" || res.type === "fail") {
          executedResponses$.next(
            // @ts-expect-error Typescript can't figure out this inference for some reason
            res
          )

          const runResult = await runTestScript(
            res.req.testScript,
            envs.right,
            {
              status: res.statusCode,
              body: getTestableBody(res),
              headers: res.headers,
            }
          )

          if (E.isRight(runResult)) {
            // set the response in the tab so that multiple tabs can run request simultaneously
            tab.value.document.response = res
            const updatedRunResult = updateEnvsAfterTestScript(runResult)
            tab.value.document.testResults =
              // @ts-expect-error Typescript can't figure out this inference for some reason
              translateToSandboxTestResults(updatedRunResult)
          } else {
            tab.value.document.testResults = {
              description: "",
              expectResults: [],
              tests: [],
              envDiff: {
                global: {
                  additions: [],
                  deletions: [],
                  updations: [],
                },
                selected: {
                  additions: [],
                  deletions: [],
                  updations: [],
                },
              },
              scriptError: true,
            }
          }

          subscription.unsubscribe()
        }
      })

    return E.right(stream)
  })

  return [cancel, res]
}

function updateEnvsAfterTestScript(runResult: E.Right<SandboxTestResult>) {
  const updatedGlobalEnvVariables = updateEnvironmentsWithSecret(
    // @ts-expect-error Typescript can't figure out this inference for some reason
    cloneDeep(runResult.right.envs.global),
    "global"
  )

  const updatedSelectedEnvVariables = updateEnvironmentsWithSecret(
    // @ts-expect-error Typescript can't figure out this inference for some reason
    cloneDeep(runResult.right.envs.selected),
    "selected"
  )

  const updatedRunResult = {
    ...runResult.right,
    envs: {
      global: updatedGlobalEnvVariables,
      selected: updatedSelectedEnvVariables,
    },
  }

  const globalEnvVariables = updateEnvironmentsWithSecret(
    // @ts-expect-error Typescript can't figure out this inference for some reason
    runResult.right.envs.global,
    "global"
  )

  setGlobalEnvVariables({
    v: 1,
    variables: globalEnvVariables,
  })
  if (environmentsStore.value.selectedEnvironmentIndex.type === "MY_ENV") {
    const env = getEnvironment({
      type: "MY_ENV",
      index: environmentsStore.value.selectedEnvironmentIndex.index,
    })
    updateEnvironment(environmentsStore.value.selectedEnvironmentIndex.index, {
      name: env.name,
      v: 1,
      id: "id" in env ? env.id : "",
      variables: updatedRunResult.envs.selected,
    })
  } else if (
    environmentsStore.value.selectedEnvironmentIndex.type === "TEAM_ENV"
  ) {
    const env = getEnvironment({
      type: "TEAM_ENV",
    })
    pipe(
      updateTeamEnvironment(
        JSON.stringify(updatedRunResult.envs.selected),
        environmentsStore.value.selectedEnvironmentIndex.teamEnvID,
        env.name
      )
    )()
  }

  return updatedRunResult
}

/**
 * Run the test runner request
 * @param request The request to run
 * @param persistEnv Whether to persist the environment variables after running the test script
 * @returns The response and the test result
 */

export function runTestRunnerRequest(
  request: HoppRESTRequest,
  persistEnv = true
): Promise<
  | E.Left<"script_fail">
  | E.Right<{
      response: HoppRESTResponse
      testResult: HoppTestResult
    }>
  | undefined
> {
  return getFinalEnvsFromPreRequest(
    request.preRequestScript,
    getCombinedEnvVariables()
  ).then(async (envs) => {
    if (E.isLeft(envs)) {
      console.error(envs.left)
      return E.left("script_fail" as const)
    }

    const effectiveRequest = await getEffectiveRESTRequest(request, {
      id: "env-id",
      v: 1,
      name: "Env",
      variables: combineEnvVariables({
        environments: {
          ...envs.right,
          temp: !persistEnv ? getTemporaryVariables() : [],
        },
        requestVariables: [],
      }),
    })

    const [stream] = createRESTNetworkRequestStream(effectiveRequest)

    const requestResult = stream
      .pipe(filter((res) => res.type === "success" || res.type === "fail"))
      .toPromise()
      .then(async (res) => {
        if (res?.type === "success" || res?.type === "fail") {
          executedResponses$.next(
            // @ts-expect-error Typescript can't figure out this inference for some reason
            res
          )

          const runResult = await runTestScript(
            res.req.testScript,
            envs.right,
            {
              status: res.statusCode,
              body: getTestableBody(res),
              headers: res.headers,
            }
          )

          if (E.isRight(runResult)) {
            const sandboxTestResult = translateToSandboxTestResults(
              runResult.right
            )

            // Update the environment variables after running the test script when persistEnv is true. else store the updated environment variables in the store as a temporary variable.
            if (persistEnv) {
              updateEnvsAfterTestScript(runResult)
            } else {
              // Combine global and selected environment changes
              const allChanges = [
                ...runResult.right.envs.global,
                ...runResult.right.envs.selected,
              ]

              setTemporaryVariables(allChanges)
            }

            return E.right({
              response: res,
              testResult: sandboxTestResult,
            })
          }
          const sandboxTestResult = {
            description: "",
            expectResults: [],
            tests: [],
            envDiff: {
              global: {
                additions: [],
                deletions: [],
                updations: [],
              },
              selected: {
                additions: [],
                deletions: [],
                updations: [],
              },
            },
            scriptError: true,
          }
          return E.right({
            response: res,
            testResult: sandboxTestResult,
          })
        }
      })

    if (requestResult) {
      return requestResult
    }

    return E.left("script_fail")
  })
}

const getAddedEnvVariables = (
  current: Environment["variables"],
  updated: Environment["variables"]
) => updated.filter((x) => current.findIndex((y) => y.key === x.key) === -1)

const getRemovedEnvVariables = (
  current: Environment["variables"],
  updated: Environment["variables"]
) => current.filter((x) => updated.findIndex((y) => y.key === x.key) === -1)

const getUpdatedEnvVariables = (
  current: Environment["variables"],
  updated: Environment["variables"]
) =>
  pipe(
    updated,
    A.filterMap(
      flow(
        O.of,
        O.bindTo("env"),
        O.bind("index", ({ env }) =>
          pipe(
            current.findIndex((x) => x.key === env.key),
            O.fromPredicate((x) => x !== -1)
          )
        ),
        O.chain(
          O.fromPredicate(
            ({ env, index }) => env.value !== current[index].value
          )
        ),
        O.map(({ env, index }) => ({
          ...env,
          previousValue: current[index].value,
        }))
      )
    )
  )

function translateToSandboxTestResults(
  testDesc: SandboxTestResult
): HoppTestResult {
  const translateChildTests = (child: TestDescriptor): HoppTestData => {
    return {
      description: child.descriptor,
      expectResults: child.expectResults,
      tests: child.children.map(translateChildTests),
    }
  }

  const globals = cloneDeep(getGlobalVariables())
  const env = getCurrentEnvironment()
  return {
    description: "",
    expectResults: testDesc.tests.expectResults,
    tests: testDesc.tests.children.map(translateChildTests),
    scriptError: false,
    envDiff: {
      global: {
        additions: getAddedEnvVariables(globals, testDesc.envs.global),
        deletions: getRemovedEnvVariables(globals, testDesc.envs.global),
        updations: getUpdatedEnvVariables(globals, testDesc.envs.global),
      },
      selected: {
        additions: getAddedEnvVariables(env.variables, testDesc.envs.selected),
        deletions: getRemovedEnvVariables(
          env.variables,
          testDesc.envs.selected
        ),
        updations: getUpdatedEnvVariables(
          env.variables,
          testDesc.envs.selected
        ),
      },
    },
  }
}
