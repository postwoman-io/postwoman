import { computed, Ref, ref } from "vue"
import { useReadonlyStream } from "./stream"
import { platform } from "~/platform"
import { useSetting } from "./settings"
import { HoppGQLRequest, HoppRESTRequest } from "@hoppscotch/data"
import { useToast } from "@composables/toast"
import { useI18n } from "@composables/i18n"
import * as E from "fp-ts/Either"
import { useRoute } from "vue-router"
import { invokeAction } from "~/helpers/actions"

export const useRequestNameGeneration = (targetNameRef: Ref<string>) => {
  const toast = useToast()
  const t = useI18n()
  const route = useRoute()

  const targetPage = computed(() => {
    return route.fullPath.includes("/graphql") ? "gql" : "rest"
  })

  const isGenerateRequestNamePending = ref(false)

  const generateRequestNameForPlatform =
    platform.experiments?.aiExperiments?.generateRequestName

  const currentUser = useReadonlyStream(
    platform.auth.getCurrentUserStream(),
    platform.auth.getCurrentUser()
  )

  const ENABLE_AI_EXPERIMENTS = useSetting("ENABLE_AI_EXPERIMENTS")

  const canDoRequestNameGeneration = computed(() => {
    return ENABLE_AI_EXPERIMENTS.value && !!platform.experiments?.aiExperiments
  })

  const lastTraceID = ref<string | null>(null)

  const generateRequestName = async (
    requestContext: HoppRESTRequest | HoppGQLRequest | null
  ) => {
    if (!currentUser.value) {
      invokeAction("modals.login.toggle")
      return
    }

    if (!requestContext || !generateRequestNameForPlatform) {
      toast.error(t("request.generate_name_error"))
      return
    }

    const namingStyle = useSetting("AI_REQUEST_NAMING_STYLE").value

    isGenerateRequestNamePending.value = true

    platform.analytics?.logEvent({
      type: "EXPERIMENTS_GENERATE_REQUEST_NAME_WITH_AI",
      platform: targetPage.value,
    })

    const result = await generateRequestNameForPlatform(
      JSON.stringify(requestContext),
      namingStyle
    )

    if (result && E.isLeft(result)) {
      toast.error(t("request.generate_name_error"))

      isGenerateRequestNamePending.value = false

      return
    }

    targetNameRef.value = result.right.request_name
    lastTraceID.value = result.right.trace_id

    isGenerateRequestNamePending.value = false
  }

  return {
    generateRequestName,
    isGenerateRequestNamePending,
    canDoRequestNameGeneration,
    lastTraceID,
  }
}

export const useAIExperiments = () => {
  const ENABLE_AI_EXPERIMENTS = useSetting("ENABLE_AI_EXPERIMENTS")

  const shouldEnableAIFeatures = computed(() => {
    return ENABLE_AI_EXPERIMENTS.value && !!platform.experiments?.aiExperiments
  })

  return {
    shouldEnableAIFeatures,
  }
}

export const useModifyRequestBody = (
  currentRequestBody: string,
  userPromptRef: Ref<string>,
  generatedRequestBodyRef: Ref<string>
) => {
  const toast = useToast()
  const t = useI18n()

  const lastTraceID = ref<string | null>(null)

  const isModifyRequestBodyPending = ref(false)

  const modifyRequestBodyForPlatform =
    platform.experiments?.aiExperiments?.modifyRequestBody

  const modifyRequestBody = async () => {
    isModifyRequestBodyPending.value = true

    if (!modifyRequestBodyForPlatform) {
      toast.error(t("ai_experiments.modify_request_body_error"))
      isModifyRequestBodyPending.value = false
      return
    }

    const result = await modifyRequestBodyForPlatform(
      currentRequestBody ?? "",
      userPromptRef.value
    )

    if (result && E.isLeft(result)) {
      toast.error(t("ai_experiments.modify_request_body_error"))
      isModifyRequestBodyPending.value = false
      return
    }

    generatedRequestBodyRef.value = result.right.modified_body
    lastTraceID.value = result.right.trace_id

    isModifyRequestBodyPending.value = false
    return result.right
  }

  return {
    modifyRequestBody,
    isModifyRequestBodyPending,
    lastTraceID,
  }
}

export const useSubmitFeedback = () => {
  const submitFeedbackForPlatform =
    platform.experiments?.aiExperiments?.submitFeedback

  const t = useI18n()
  const toast = useToast()

  const isSubmitFeedbackPending = ref(false)

  const submitFeedback = async (
    rating: "positive" | "negative",
    traceID: string
  ) => {
    if (!submitFeedbackForPlatform) {
      toast.error(t("ai_experiments.feedback_failure"))

      return
    }

    isSubmitFeedbackPending.value = true

    const res = await submitFeedbackForPlatform(
      rating === "positive" ? 1 : -1,
      traceID
    )

    if (E.isLeft(res)) {
      toast.error(t("ai_experiments.feedback_failure"))
      isSubmitFeedbackPending.value = false
      return
    }

    isSubmitFeedbackPending.value = false

    return E.right(undefined)
  }

  return {
    submitFeedback,
    isSubmitFeedbackPending,
  }
}

export const useModifyPreRequestScript = (
  currentScript: string,
  userPromptRef: Ref<string>,
  generatedScriptRef: Ref<string>,
  requestInfo: HoppRESTRequest
) => {
  const toast = useToast()
  const t = useI18n()
  const lastTraceID = ref<string | null>(null)
  const isModifyPreRequestPending = ref(false)

  const modifyPreRequestScriptForPlatform =
    platform.experiments?.aiExperiments?.modifyPreRequestScript

  const modifyPreRequestScript = async () => {
    isModifyPreRequestPending.value = true

    if (!modifyPreRequestScriptForPlatform) {
      toast.error(t("ai_experiments.modify_prerequest_error"))
      isModifyPreRequestPending.value = false
      return
    }

    const result = await modifyPreRequestScriptForPlatform(
      buildRequestInfoString(requestInfo, currentScript),
      userPromptRef.value
    )

    if (result && E.isLeft(result)) {
      toast.error(t("ai_experiments.modify_prerequest_error"))
      isModifyPreRequestPending.value = false
      return
    }

    generatedScriptRef.value = result.right.modified_script
    lastTraceID.value = result.right.trace_id

    isModifyPreRequestPending.value = false
    return result.right
  }

  return {
    modifyPreRequestScript,
    isModifyPreRequestPending,
    lastTraceID,
  }
}

export const useModifyTestScript = (
  currentScript: string,
  userPromptRef: Ref<string>,
  generatedScriptRef: Ref<string>,
  requestInfo: HoppRESTRequest
) => {
  const toast = useToast()
  const t = useI18n()
  const lastTraceID = ref<string | null>(null)
  const isModifyTestScriptPending = ref(false)

  const modifyTestScriptForPlatform =
    platform.experiments?.aiExperiments?.modifyTestScript

  const modifyTestScript = async () => {
    isModifyTestScriptPending.value = true

    if (!modifyTestScriptForPlatform) {
      toast.error(t("ai_experiments.modify_test_script_error"))
      isModifyTestScriptPending.value = false
      return
    }

    const result = await modifyTestScriptForPlatform(
      buildRequestInfoString(requestInfo, currentScript),
      userPromptRef.value
    )

    if (result && E.isLeft(result)) {
      toast.error(t("ai_experiments.modify_test_script_error"))
      isModifyTestScriptPending.value = false
      return
    }

    generatedScriptRef.value = result.right.modified_script
    lastTraceID.value = result.right.trace_id

    isModifyTestScriptPending.value = false
    return result.right
  }

  return {
    modifyTestScript,
    isModifyTestScriptPending,
    lastTraceID,
  }
}

const buildRequestInfoString = (
  request: HoppRESTRequest,
  currentScript: string
) => {
  return `
  METHOD:
  ${request.method}

  URL:
  ${request.endpoint}

  BODY:
  ${JSON.stringify(request.body) ?? ""}

  PARAMS:
  ${JSON.stringify(request.params, null, 2)}

  HEADERS:
  ${JSON.stringify(request.headers, null, 2)}
  
  EXISTING SCRIPT:
  ${currentScript}
  `
}
