import { isLeft } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/function"
import { TaskEither, tryCatch, chain, right, left } from "fp-ts/lib/TaskEither"
import * as qjs from "quickjs-emscripten"
import { marshalObjectToVM } from "./utils"

/**
 * The response object structure exposed to the test script
 */
export type TestResponse = {
  /** Status Code of the response */
  status: number,
  /** List of headers returned */
  headers: { key: string, value: string }[],
  /**
   * Body of the response, this will be the JSON object if it is a JSON content type, else body string
   */
  body: string | object
}

/**
 * The result of an expectation statement
 */
type ExpectResult =
  | { status: "pass" | "fail" | "error", message: string } // The expectation failed (fail) or errored (error)

/**
 * An object defining the result of the execution of a
 * test block
 */
export type TestDescriptor = {
  /**
   * The name of the test block
   */
  descriptor: string

  /**
   * Expectation results of the test block
   */
  expectResults: ExpectResult[]

  /**
   * Children test blocks (test blocks inside the test block)
   */
  children: TestDescriptor[]
}

/**
 * Creates an Expectation object for use inside the sandbox
 * @param vm The QuickJS sandbox VM instance
 * @param expectVal The expecting value of the expectation
 * @param negated Whether the expectation is negated (negative)
 * @param currTestStack The current state of the test execution stack
 * @returns Handle to the expectation object in VM
 */
function createExpectation(
  vm: qjs.QuickJSVm,
  expectVal: any,
  negated: boolean,
  currTestStack: TestDescriptor[]
): qjs.QuickJSHandle {
  const resultHandle = vm.newObject()

  const toBeFnHandle = vm.newFunction("toBe", (expectedValHandle) => {
    const expectedVal = vm.dump(expectedValHandle)

    let assertion = expectVal === expectedVal
    if (negated) assertion = !assertion

    if (assertion) {
      currTestStack[currTestStack.length - 1].expectResults.push({ 
        status: "pass",
        message: `Expected '${expectVal}' to${negated ? " not" : ""} be '${expectedVal}'`
      })
    } else {
      currTestStack[currTestStack.length - 1].expectResults.push({
        status: "fail",
        message: `Expected '${expectVal}' to${negated ? " not" : ""} be '${expectedVal}'`,
      })
    }

    return { value: vm.undefined }
  })

  const toBeLevel2xxHandle = vm.newFunction("toBeLevel2xx", () => {
    // Check if the expected value is a number, else it is an error
    if (typeof expectVal === "number" && !Number.isNaN(expectVal)) {
      let assertion = expectVal >= 200 && expectVal <= 299
      if (negated) assertion = !assertion

      if (assertion) {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "pass",
          message: `Expected '${expectVal}' to${negated ? " not" : ""} be 200-level status`,
        })
      } else {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "fail",
          message:
            `Expected '${expectVal}' to${negated ? " not" : ""} be 200-level status`,
        })
      }
    } else {
      currTestStack[currTestStack.length - 1].expectResults.push({
        status: "error",
        message: `Expected 200-level status but could not parse value '${expectVal}'`,
      })
    }

    return { value: vm.undefined }
  })

  const toBeLevel3xxHandle = vm.newFunction("toBeLevel3xx", () => {
    // Check if the expected value is a number, else it is an error
    if (typeof expectVal === "number" && !Number.isNaN(expectVal)) {
      let assertion = expectVal >= 300 && expectVal <= 399
      if (negated) assertion = !assertion

      if (assertion) {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "pass",
          message: `Expected '${expectVal}' to${negated ? " not" : ""} be 300-level status`,
        })
      } else {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "fail",
          message:
            `Expected '${expectVal}' to${negated ? " not" : ""} be 300-level status`,
        })
      }
    } else {
      currTestStack[currTestStack.length - 1].expectResults.push({
        status: "error",
        message: `Expected 300-level status but could not parse value '${expectVal}'`,
      })
    }

    return { value: vm.undefined }
  })

  const toBeLevel4xxHandle = vm.newFunction("toBeLevel4xx", () => {
    // Check if the expected value is a number, else it is an error
    if (typeof expectVal === "number" && !Number.isNaN(expectVal)) {
      let assertion = expectVal >= 400 && expectVal <= 499
      if (negated) assertion = !assertion

      if (assertion) {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "pass",
          message: `Expected '${expectVal}' to${negated ? " not" : ""} be 400-level status`,
        })
      } else {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "fail",
          message:
            `Expected '${expectVal}' to${negated ? " not" : ""} be 400-level status`,
        })
      }
    } else {
      currTestStack[currTestStack.length - 1].expectResults.push({
        status: "error",
        message: `Expected 400-level status but could not parse value '${expectVal}'`,
      })
    }

    return { value: vm.undefined }
  })

  const toBeLevel5xxHandle = vm.newFunction("toBeLevel5xx", () => {
    // Check if the expected value is a number, else it is an error
    if (typeof expectVal === "number" && !Number.isNaN(expectVal)) {
      let assertion = expectVal >= 500 && expectVal <= 599
      if (negated) assertion = !assertion

      if (assertion) {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "pass",
          message: `Expected '${expectVal}' to${negated ? " not" : ""} be 500-level status`,
        })
      } else {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "fail",
          message: `Expected '${expectVal}' to${negated ? " not" : ""} be 500-level status`
        })
      }
    } else {
      currTestStack[currTestStack.length - 1].expectResults.push({
        status: "error",
        message: `Expected 500-level status but could not parse value '${expectVal}'`,
      })
    }
    
    return { value: vm.undefined }
  })

  const toBeTypeHandle = vm.newFunction("toBeType", (expectedValHandle) => {
    const expectedType = vm.dump(expectedValHandle)

    // Check if the expectation param is a valid type name string, else error
    if (["string", "boolean", "number", "object", "undefined", "bigint", "symbol", "function"].includes(expectedType)) {
      let assertion = typeof expectVal === expectedType
      if (negated) assertion = !assertion

      if (assertion) {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "pass",
          message: `Expected '${expectVal}' to${negated ? " not" : ""} be type '${expectedType}'`
        })
      } else {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "fail",
          message: `Expected '${expectVal}' to${negated ? " not" : ""} be type '${expectedType}'`,
        })
      }
    } else {
      currTestStack[currTestStack.length - 1].expectResults.push({
        status: "error",
        message: `Argument for toBeType should be "string", "boolean", "number", "object", "undefined", "bigint", "symbol" or "function"`
      })
    }

    return { value: vm.undefined }
  })

  const toHaveLengthHandle = vm.newFunction(
    "toHaveLength",
    (expectedValHandle) => {
      const expectedLength = vm.dump(expectedValHandle)

      if (!(Array.isArray(expectVal) || typeof expectVal === "string")) {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "error",
          message: `Expected toHaveLength to be called for an array or string`,
        })

        return { value: vm.undefined }
      }

      // Check if the parameter is a number, else error
      if (typeof expectedLength === "number" && !Number.isNaN(expectedLength)) {
        let assertion = (expectVal as any[]).length === expectedLength
        if (negated) assertion = !assertion
        
        if (assertion) {
          currTestStack[currTestStack.length - 1].expectResults.push({
            status: "pass",
            message: `Expected the array to${negated ? " not" : ""} be of length '${expectedLength}'`,
          })
        } else {
          currTestStack[currTestStack.length - 1].expectResults.push({
            status: "fail",
            message: `Expected the array to${negated ? " not" : ""} be of length '${expectedLength}'`
          })
        }
      } else {
        currTestStack[currTestStack.length - 1].expectResults.push({
          status: "error",
          message: `Argument for toHaveLength should be a number`
        })
      }
      
      return { value: vm.undefined }
    }
  )

  vm.setProp(resultHandle, "toBe", toBeFnHandle)
  vm.setProp(resultHandle, "toBeLevel2xx", toBeLevel2xxHandle)
  vm.setProp(resultHandle, "toBeLevel3xx", toBeLevel3xxHandle)
  vm.setProp(resultHandle, "toBeLevel4xx", toBeLevel4xxHandle)
  vm.setProp(resultHandle, "toBeLevel5xx", toBeLevel5xxHandle)
  vm.setProp(resultHandle, "toBeType", toBeTypeHandle)
  vm.setProp(resultHandle, "toHaveLength", toHaveLengthHandle)

  vm.defineProp(resultHandle, "not", {
    get: () => {
      return createExpectation(vm, expectVal, !negated, currTestStack)
    },
  })

  toBeFnHandle.dispose()
  toBeLevel2xxHandle.dispose()
  toBeLevel3xxHandle.dispose()
  toBeLevel4xxHandle.dispose()
  toBeLevel5xxHandle.dispose()
  toBeTypeHandle.dispose()
  toHaveLengthHandle.dispose()

  return resultHandle
}

export const execTestScript = (
  testScript: string,
  response: TestResponse
): TaskEither<string, TestDescriptor[]> => pipe(
  tryCatch(
    async () => await qjs.getQuickJS(),
    (reason) => `QuickJS initialization failed: ${reason}`
  ),
  chain(
    // TODO: Make this more functional ?
    (QuickJS) => {
      const vm = QuickJS.createVm()

      const pwHandle = vm.newObject()

      const testRunStack: TestDescriptor[] = [
        { descriptor: "root", expectResults: [], children: [] },
      ]

      const testFuncHandle = vm.newFunction(
        "test",
        (descriptorHandle, testFuncHandle) => {
          const descriptor = vm.getString(descriptorHandle)

          testRunStack.push({
            descriptor,
            expectResults: [],
            children: [],
          })

          const result = vm.unwrapResult(vm.callFunction(testFuncHandle, vm.null))
          result.dispose()

          const child = testRunStack.pop() as TestDescriptor
          testRunStack[testRunStack.length - 1].children.push(child)
        }
      )

      const expectFnHandle = vm.newFunction("expect", (expectValueHandle) => {
        const expectVal = vm.dump(expectValueHandle)

        return {
          value: createExpectation(vm, expectVal, false, testRunStack),
        }
      })

      // Marshal response object
      const responseObjHandle = marshalObjectToVM(vm, response)
      if (isLeft(responseObjHandle)) return left(`Response marshalling failed: ${responseObjHandle.left}`)

      vm.setProp(pwHandle, "response", responseObjHandle.right)
      responseObjHandle.right.dispose()

      vm.setProp(pwHandle, "expect", expectFnHandle)
      expectFnHandle.dispose()

      vm.setProp(pwHandle, "test", testFuncHandle)
      testFuncHandle.dispose()

      vm.setProp(vm.global, "pw", pwHandle)
      pwHandle.dispose()

      const evalRes = vm.evalCode(testScript)

      if (evalRes.error) {
        const errorData = vm.dump(evalRes.error)
        evalRes.error.dispose()

        return left(`Script evaluation failed: ${errorData}`)
      }

      vm.dispose()

      return right(testRunStack)
    }
  )
)