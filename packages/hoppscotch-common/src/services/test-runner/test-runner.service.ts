import {
  HoppCollection,
  HoppRESTHeaders,
  HoppRESTRequest,
} from "@hoppscotch/data"
import { Service } from "dioc"
import * as E from "fp-ts/Either"
import { cloneDeep } from "lodash-es"
import { Ref } from "vue"
import { runTestRunnerRequest } from "~/helpers/RequestRunner"
import {
  HoppTestRunnerDocument,
  TestRunnerConfig,
} from "~/helpers/rest/document"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { HoppTestData, HoppTestResult } from "~/helpers/types/HoppTestResult"
import { HoppTab } from "../tab"

export type TestRunnerOptions = {
  stopRef: Ref<boolean>
} & TestRunnerConfig

export type TestRunnerRequest = HoppRESTRequest & {
  type: "test-response"
  response?: HoppRESTResponse | null
  testResults?: HoppTestResult | null
  isLoading?: boolean
  error?: string
  renderResults?: boolean
  passedTests: number
  failedTests: number
}

function delay(timeMS: number) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, timeMS)
    return () => {
      clearTimeout(timeout)
      reject(new Error("Operation cancelled"))
    }
  })
}

export class TestRunnerService extends Service {
  public static readonly ID = "TEST_RUNNER_SERVICE"

  public runTests(
    tab: Ref<HoppTab<HoppTestRunnerDocument>>,
    collection: HoppCollection,
    options: TestRunnerOptions
  ) {
    // Reset the result collection
    tab.value.document.status = "running"
    tab.value.document.resultCollection = {
      v: collection.v,
      id: collection.id,
      name: collection.name,
      auth: collection.auth,
      headers: collection.headers,
      folders: [],
      requests: [],
    }

    this.runTestCollection(tab, collection, options)
      .then(() => {
        tab.value.document.status = "stopped"
      })
      .catch((error) => {
        if (
          error instanceof Error &&
          error.message === "Test execution stopped"
        ) {
          tab.value.document.status = "stopped"
        } else {
          tab.value.document.status = "error"
          console.error("Test runner failed:", error)
        }
      })
      .finally(() => {
        tab.value.document.status = "stopped"
      })
  }

  private async runTestCollection(
    tab: Ref<HoppTab<HoppTestRunnerDocument>>,
    collection: HoppCollection,
    options: TestRunnerOptions,
    parentPath: number[] = [],
    parentHeaders?: HoppRESTHeaders,
    parentAuth?: HoppRESTRequest["auth"]
  ) {
    try {
      // Compute inherited auth and headers for this collection
      const inheritedAuth =
        collection.auth?.authType === "inherit" && collection.auth.authActive
          ? parentAuth || { authType: "none", authActive: false }
          : collection.auth || { authType: "none", authActive: false }

      const inheritedHeaders: HoppRESTHeaders = [
        ...(parentHeaders || []),
        ...collection.headers,
      ]

      // Process folders progressively
      for (let i = 0; i < collection.folders.length; i++) {
        if (options.stopRef?.value) {
          tab.value.document.status = "stopped"
          throw new Error("Test execution stopped")
        }

        const folder = collection.folders[i]
        const currentPath = [...parentPath, i]

        // Add folder to the result collection
        this.addFolderToPath(
          tab.value.document.resultCollection!,
          currentPath,
          {
            ...cloneDeep(folder),
            folders: [],
            requests: [],
          }
        )

        // Pass inherited headers and auth to the folder
        await this.runTestCollection(
          tab,
          folder,
          options,
          currentPath,
          inheritedHeaders,
          inheritedAuth
        )
      }

      // Process requests progressively
      for (let i = 0; i < collection.requests.length; i++) {
        if (options.stopRef?.value) {
          tab.value.document.status = "stopped"
          throw new Error("Test execution stopped")
        }

        const request = collection.requests[i] as TestRunnerRequest
        const currentPath = [...parentPath, i]

        // Add request to the result collection before execution
        this.addRequestToPath(
          tab.value.document.resultCollection!,
          currentPath,
          cloneDeep(request)
        )

        // Update the request with inherited headers and auth before execution
        const finalRequest = {
          ...request,
          auth:
            request.auth.authType === "inherit" && request.auth.authActive
              ? inheritedAuth
              : request.auth,
          headers: [...inheritedHeaders, ...request.headers],
        }

        await this.runTestRequest(
          tab,
          finalRequest,
          collection,
          options,
          currentPath
        )

        if (options.delay && options.delay > 0) {
          try {
            await delay(options.delay)
          } catch (error) {
            if (options.stopRef?.value) {
              tab.value.document.status = "stopped"
              throw new Error("Test execution stopped")
            }
          }
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Test execution stopped"
      ) {
        throw error
      }
      tab.value.document.status = "error"
      console.error("Collection execution failed:", error)
      throw error
    }
  }

  private addFolderToPath(
    collection: HoppCollection,
    path: number[],
    folder: HoppCollection
  ) {
    let current = collection

    // Navigate to the parent folder
    for (let i = 0; i < path.length - 1; i++) {
      current = current.folders[path[i]]
    }

    // Add the folder at the specified index
    if (path.length > 0) {
      current.folders[path[path.length - 1]] = folder
    }
  }

  private addRequestToPath(
    collection: HoppCollection,
    path: number[],
    request: TestRunnerRequest
  ) {
    let current = collection

    // Navigate to the parent folder
    for (let i = 0; i < path.length - 1; i++) {
      current = current.folders[path[i]]
    }

    // Add the request at the specified index
    if (path.length > 0) {
      current.requests[path[path.length - 1]] = request
    }
  }

  private updateRequestAtPath(
    collection: HoppCollection,
    path: number[],
    updates: Partial<TestRunnerRequest>
  ) {
    let current = collection

    // Navigate to the parent folder
    for (let i = 0; i < path.length - 1; i++) {
      current = current.folders[path[i]]
    }

    // Update the request at the specified index
    if (path.length > 0) {
      const index = path[path.length - 1]
      current.requests[index] = {
        ...current.requests[index],
        ...updates,
      } as TestRunnerRequest
    }
  }

  private async runTestRequest(
    tab: Ref<HoppTab<HoppTestRunnerDocument>>,
    request: TestRunnerRequest,
    collection: HoppCollection,
    options: TestRunnerOptions,
    path: number[]
  ) {
    if (options.stopRef?.value) {
      throw new Error("Test execution stopped")
    }

    try {
      // Update request status in the result collection
      this.updateRequestAtPath(tab.value.document.resultCollection!, path, {
        isLoading: true,
        error: undefined,
      })

      const results = await runTestRunnerRequest(
        request,
        options.keepVariableValues
      )

      if (options.stopRef?.value) {
        throw new Error("Test execution stopped")
      }

      if (results && E.isRight(results)) {
        const { response, testResult } = results.right
        const { passed, failed } = this.getTestResultInfo(testResult)

        tab.value.document.testRunnerMeta.totalTests += passed + failed
        tab.value.document.testRunnerMeta.passedTests += passed
        tab.value.document.testRunnerMeta.failedTests += failed

        // Update request with results in the result collection
        this.updateRequestAtPath(tab.value.document.resultCollection!, path, {
          testResults: testResult,
          response: options.persistResponses ? response : null,
          isLoading: false,
        })

        if (response.type === "success" || response.type === "fail") {
          tab.value.document.testRunnerMeta.totalTime +=
            response.meta.responseDuration
          tab.value.document.testRunnerMeta.completedRequests += 1
        }
      } else {
        const errorMsg = "Request execution failed"

        // Update request with error in the result collection
        this.updateRequestAtPath(tab.value.document.resultCollection!, path, {
          error: errorMsg,
          isLoading: false,
        })

        if (options.stopOnError) {
          tab.value.document.status = "stopped"
          throw new Error("Test execution stopped due to error")
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Test execution stopped"
      ) {
        throw error
      }

      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred"

      // Update request with error in the result collection
      this.updateRequestAtPath(tab.value.document.resultCollection!, path, {
        error: errorMsg,
        isLoading: false,
      })

      if (options.stopOnError) {
        tab.value.document.status = "stopped"
        throw new Error("Test execution stopped due to error")
      }
    }
  }

  private getTestResultInfo(testResult: HoppTestData) {
    let passed = 0
    let failed = 0

    for (const result of testResult.expectResults) {
      if (result.status === "pass") {
        passed++
      } else if (result.status === "fail") {
        failed++
      }
    }

    for (const nestedTest of testResult.tests) {
      const nestedResult = this.getTestResultInfo(nestedTest)
      passed += nestedResult.passed
      failed += nestedResult.failed
    }

    return { passed, failed }
  }
}
