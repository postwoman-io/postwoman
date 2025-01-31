import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { createRequire } from "module"

import type ivmT from "isolated-vm"

import { TestResponse, TestResult } from "~/types"
import {
  getTestRunnerScriptMethods,
  preventCyclicObjects,
} from "~/shared-utils"
import { getSerializedAPIMethods } from "./utils"

const nodeRequire = createRequire(import.meta.url)
const ivm = nodeRequire("isolated-vm")

export const runTestScript = (
  testScript: string,
  envs: TestResult["envs"],
  response: TestResponse
): TE.TaskEither<string, TestResult> =>
  pipe(
    TE.tryCatch(
      async () => {
        const isolate: ivmT.Isolate = new ivm.Isolate()
        const context = await isolate.createContext()
        return { isolate, context }
      },
      (reason) => `Context initialization failed: ${reason}`
    ),
    TE.chain(({ isolate, context }) =>
      pipe(
        TE.tryCatch(
          async () =>
            executeScriptInContext(
              testScript,
              envs,
              response,
              isolate,
              context
            ),
          (reason) => `Script execution failed: ${reason}`
        ),
        TE.chain((result) =>
          TE.tryCatch(
            async () => {
              await isolate.dispose()
              return result
            },
            (disposeReason) => `Isolate disposal failed: ${disposeReason}`
          )
        )
      )
    )
  )
const executeScriptInContext = (
  testScript: string,
  envs: TestResult["envs"],
  response: TestResponse,
  isolate: ivmT.Isolate,
  context: ivmT.Context
): Promise<TestResult> => {
  return new Promise((resolve, reject) => {
    // Parse response object
    const responseObjHandle = preventCyclicObjects(response)
    if (E.isLeft(responseObjHandle)) {
      return reject(`Response parsing failed: ${responseObjHandle.left}`)
    }

    const jail = context.global

    const { pw, testRunStack, updatedEnvs } = getTestRunnerScriptMethods(envs)

    const serializedAPIMethods = getSerializedAPIMethods({
      ...pw,
      response: responseObjHandle.right,
    })
    jail.setSync("serializedAPIMethods", serializedAPIMethods, { copy: true })

    jail.setSync("atob", atob)
    jail.setSync("btoa", btoa)

    jail.setSync("ivm", ivm)

    // Methods in the isolate context can't be invoked straightaway
    const finalScript = `
    const pw = new Proxy(serializedAPIMethods, {
      get: (pwObj, pwObjProp) => {
        // pw.expect(), pw.env, etc.
        const topLevelEntry = pwObj[pwObjProp]

        // If the entry exists and is a function
        // pw.expect(), pw.test(), etc.
        if (topLevelEntry && topLevelEntry.typeof === "function") {
          // pw.test() just involves invoking the function via "applySync()"
          if (pwObjProp === "test") {
            return (...args) => topLevelEntry.applySync(null, args)
          }

          // pw.expect() returns an object with matcher methods
          return (...args) => {
            // Invoke "pw.expect()" and get access to the object with matcher methods
            const expectFnResult = topLevelEntry.applySync(
              null,
              args.map((expectVal) => {
                if (typeof expectVal === "object") {
                  if (expectVal === null) {
                    return null
                  }

                  // Only arrays and objects stringified here should be parsed from the "pw.expect()" method definition
                  // The usecase is that any JSON string supplied should be preserved
                  // An extra "isStringifiedWithinIsolate" prop is added to indicate it has to be parsed

                  if (Array.isArray(expectVal)) {
                    return JSON.stringify({
                      arr: expectVal,
                      isStringifiedWithinIsolate: true,
                    })
                  }

                  return JSON.stringify({
                    ...expectVal,
                    isStringifiedWithinIsolate: true,
                  })
                }

                return expectVal
              })
            )

            // Matcher methods that can be chained with "pw.expect()"
            // pw.expect().toBe(), etc
            if (expectFnResult.typeof === "object") {
              // Access the getter that points to the negated matcher methods via "{ accessors: true }"
              const matcherMethods = {
                not: expectFnResult.getSync("not", { accessors: true }),
              }

              // Serialize matcher methods for use in the isolate context
              const matcherMethodNames = [
                "toBe",
                "toBeLevel2xx",
                "toBeLevel3xx",
                "toBeLevel4xx",
                "toBeLevel5xx",
                "toBeType",
                "toHaveLength",
                "toInclude",
                "toBeGreaterThan",
                "toBeLessThan",
                "toBeGreaterThanOrEqual",
                "toBeLessThanOrEqual"
              ]
              matcherMethodNames.forEach((methodName) => {
                matcherMethods[methodName] = expectFnResult.getSync(methodName)
              })

              return new Proxy(matcherMethods, {
                get: (matcherMethodTarget, matcherMethodProp) => {
                  // pw.expect().not.toBe(), etc
                  const matcherMethodEntry = matcherMethodTarget[matcherMethodProp]

                  if (matcherMethodProp === "not") {
                    return new Proxy(matcherMethodEntry, {
                      get: (negatedObjTarget, negatedObjprop) => {
                        // Return the negated matcher method defn that is invoked from the test script
                        const negatedMatcherMethodDefn = negatedObjTarget.getSync(negatedObjprop)
                        return negatedMatcherMethodDefn
                      },
                    })
                  }

                  // Return the matcher method defn that is invoked from the test script
                  return matcherMethodEntry
                },
              })
            }
          }
        }

        // "pw.env" set of API methods
        if (typeof topLevelEntry === "object" && pwObjProp !== "response") {
          return new Proxy(topLevelEntry, {
            get: (subTarget, subProp) => {
              const subLevelProperty = subTarget[subProp]
              if (
                subLevelProperty &&
                subLevelProperty.typeof === "function"
              ) {
                return (...args) => subLevelProperty.applySync(null, args)
              }
            },
          })
        }

        return topLevelEntry
      },
    })

      ${testScript}
    `

    // Create a script and compile it
    const script = isolate.compileScript(finalScript)

    // Run the test script in the provided context
    script
      .then((script) => script.run(context))
      .then(() => {
        resolve({
          tests: testRunStack,
          envs: updatedEnvs,
        })
      })
      .catch((error: Error) => {
        reject(error)
      })
  })
}
