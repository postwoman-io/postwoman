import { Observable } from "rxjs"
import { filter } from "rxjs/operators"
import { chain, right, TaskEither } from "fp-ts/lib/TaskEither"
import { pipe } from "fp-ts/lib/function"
import { runTestScript, TestDescriptor } from "@hoppscotch/js-sandbox"
import { isRight } from "fp-ts/lib/Either"
import { getFinalEnvsFromPreRequest } from "./preRequest"
import { getEffectiveRESTRequest } from "./utils/EffectiveURL"
import { HoppRESTResponse } from "./types/HoppRESTResponse"
import { createRESTNetworkRequestStream } from "./network"
import { HoppTestData, HoppTestResult } from "./types/HoppTestResult"
import { isJSONContentType } from "./utils/contenttypes"
import { getRESTRequest, setRESTTestResults } from "~/newstore/RESTSession"

const getTestableBody = (res: HoppRESTResponse & { type: "success" }) => {
  const contentTypeHeader = res.headers.find(
    (h) => h.value.toLowerCase() === "content-type"
  )

  const rawBody = new TextDecoder("utf-8").decode(res.body)

  if (!contentTypeHeader || !isJSONContentType(contentTypeHeader.value))
    return rawBody

  return JSON.parse(rawBody)
}

export const runRESTRequest$: TaskEither<
  string,
  Observable<HoppRESTResponse>
> = pipe(
  getFinalEnvsFromPreRequest(),
  chain((envs) => {
    console.log(envs)
    const effectiveRequest = getEffectiveRESTRequest(getRESTRequest(), {
      name: "Env",
      variables: envs,
    })

    const stream = createRESTNetworkRequestStream(effectiveRequest)

    // Run Test Script when request ran successfully
    const subscription = stream
      .pipe(filter((res) => res.type === "success"))
      .subscribe(async (res) => {
        if (res.type === "success") {
          const runResult = await runTestScript(res.req.testScript, {
            status: res.statusCode,
            body: getTestableBody(res),
            headers: res.headers,
          })()

          // TODO: Handle script executation fails (isLeft)
          if (isRight(runResult)) {
            setRESTTestResults(translateToSandboxTestResults(runResult.right))
          }

          subscription.unsubscribe()
        }
      })

    return right(stream)
  })
)

function translateToSandboxTestResults(
  testDesc: TestDescriptor
): HoppTestResult {
  const translateChildTests = (child: TestDescriptor): HoppTestData => {
    return {
      description: child.descriptor,
      expectResults: child.expectResults,
      tests: child.children.map(translateChildTests),
    }
  }
  return {
    expectResults: testDesc.expectResults,
    tests: testDesc.children.map(translateChildTests),
  }
}
