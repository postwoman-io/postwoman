import {
  HoppCollection,
  HoppRESTRequest,
  HoppRESTRequestResponse,
} from "@hoppscotch/data"
import { RESTOptionTabs } from "~/components/http/RequestOptions.vue"
import { HoppInheritedProperty } from "../types/HoppInheritedProperties"
import { HoppRESTResponse } from "../types/HoppRESTResponse"
import { HoppTestResult } from "../types/HoppTestResult"
import { TestRunnerRequest } from "~/services/test-runner/test-runner.service"

export type HoppRESTSaveContext =
  | {
      /**
       * The origin source of the request
       */
      originLocation: "user-collection"
      /**
       * Path to the request folder
       */
      folderPath: string
      /**
       * Index to the request
       */
      requestIndex: number
      /**
       * ID of the example response
       */
      exampleID?: string
    }
  | {
      /**
       * The origin source of the request
       */
      originLocation: "team-collection"
      /**
       * ID of the request in the team
       */
      requestID: string
      /**
       * ID of the team
       */
      teamID?: string
      /**
       * ID of the collection loaded
       */
      collectionID?: string
      /**
       * ID of the example response
       */
      exampleID?: string
    }
  | null

/**
 * Defines a live 'document' (something that is open and being edited) in the app
 */

export type HoppCollectionSaveContext =
  | {
      /**
       * The origin source of the request
       */
      originLocation: "user-collection"
      /**
       * Path to the request folder
       */
      folderPath: string
    }
  | {
      /**
       * The origin source of the request
       */
      originLocation: "team-collection"
      /**
       * ID of the team
       */
      teamID?: string
      /**
       * ID of the collection loaded
       */
      collectionID?: string
      /**
       * ID of the request in the team
       */
      requestID: string
    }
  | null

export type TestRunnerConfig = {
  iterations: number
  delay: number
  stopOnError: boolean
  persistResponses: boolean
  keepVariableValues: boolean
}

export type HoppTestRunnerDocument = {
  /**
   * The document type
   */
  type: "test-runner"

  /**
   * The test runner configuration
   */
  config: TestRunnerConfig

  /**
   * initiate test runner on tab open
   */
  status: "idle" | "running" | "stopped" | "error"

  /**
   * The collection as it is in the document
   */
  collection: HoppCollection

  /**
   * The type of the collection
   */
  collectionType: "my-collections" | "team-collections"

  /**
   * collection ID to be used for team collections
   * (if it's my-collections, the _ref_id will be used as collectionID)
   */
  collectionID: string

  /**
   * Selected request id
   * (if any)
   */
  selectedRequestPath?: string

  /**
   * The request as it is in the document
   */
  resultCollection?: HoppCollection

  /**
   * The test runner meta information
   */
  testRunnerMeta: {
    totalRequests: number
    completedRequests: number
    totalTests: number
    passedTests: number
    failedTests: number
    totalTime: number
  }

  /**
   * Selected test runner request
   */
  request: TestRunnerRequest | null

  /**
   * The response of the selected request in collections after running the test
   * (if any)
   */
  response?: HoppRESTResponse | null

  /**
   * The test results of the selected request in collections after running the test
   * (if any)
   */
  testResults?: HoppTestResult | null

  /**
   * Whether the request has any unsaved changes
   * (atleast as far as we can say)
   */
  isDirty: boolean

  /**
   * The inherited properties from the parent collection also the collection itself
   * (if any) - Used for team collections
   */
  inheritedProperties?: HoppInheritedProperty
}

export type HoppRequestDocument = {
  /**
   * The document type
   */
  type: "request"

  /**
   * The request as it is in the document
   */
  request: HoppRESTRequest

  /**
   * Whether the request has any unsaved changes
   * (atleast as far as we can say)
   */
  isDirty: boolean

  /**
   * Info about where this request should be saved.
   * This contains where the request is originated from basically.
   */
  saveContext?: HoppRESTSaveContext

  /**
   * The response as it is in the document
   * (if any)
   */
  response?: HoppRESTResponse | null

  /**
   * The test results as it is in the document
   * (if any)
   */
  testResults?: HoppTestResult | null

  /**
   * Response tab preference for the current tab's document
   */
  responseTabPreference?: string

  /**
   * Options tab preference for the current tab's document
   */
  optionTabPreference?: RESTOptionTabs

  /**
   * The inherited properties from the parent collection
   * (if any)
   */
  inheritedProperties?: HoppInheritedProperty

  /**
   * The function responsible for cancelling the tab request call
   */
  cancelFunction?: () => void
}

export type HoppSavedExampleDocument = {
  /**
   * The type of the document
   */
  type: "example-response"

  /**
   * The response as it is in the document
   */
  response: HoppRESTRequestResponse

  /**
   * Info about where this response should be saved.
   * This contains where the response is originated from basically.
   */
  saveContext?: HoppRESTSaveContext

  /**
   * Whether the response has any unsaved changes
   * (atleast as far as we can say)
   */
  isDirty: boolean
}

/**
 * Defines a live 'document' (something that is open and being edited) in the app
 */
export type HoppTabDocument =
  | HoppSavedExampleDocument
  | HoppRequestDocument
  | HoppTestRunnerDocument
