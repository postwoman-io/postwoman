import * as E from "fp-ts/Either"

export type ExperimentsPlatformDef = {
  aiExperiments?: {
    enableAIExperiments: boolean
    generateRequestName?: (requestInfo: string) => Promise<
      E.Either<
        string,
        {
          request_name: string
          trace_id: string
        }
      >
    >
    modifyRequestBody?: (
      requestBody: string,
      userPrompt: string
    ) => Promise<
      E.Either<
        string,
        {
          modified_body: string
          trace_id: string
        }
      >
    >
    submitFeedback?: (
      rating: -1 | 1,
      traceID: string
    ) => Promise<E.Either<string, void>>
  }
}
