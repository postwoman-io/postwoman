import { pipe } from "fp-ts/lib/function"
import { chain, right } from "fp-ts/lib/TaskEither"
import { execPreRequestScript } from "./preRequest"
import { execTestScript, TestResponse, TestDescriptor as _TestDescriptor } from "./test-runner"

export type TestDescriptor = _TestDescriptor
/**
 * Executes a given test script on the test-runner sandbox
 * @param testScript The string of the script to run
 * @returns A TaskEither with an error message or a TestDescriptor with the final status
 */
export const runTestScript = (
  testScript: string,
  response: TestResponse
) => pipe(
  execTestScript(testScript, response),
  chain((results) => right(results[0])) // execTestScript returns an array of descriptors with a single element (extract that)
)

/**
 * Executes a given pre-request script on the sandbox
 * @param preRequestScript The script to run
 * @param env The envirionment variables active
 * @returns A TaskEither with an error message or an array of the final environments with the all the script values applied
 */
export const runPreRequestScript = execPreRequestScript