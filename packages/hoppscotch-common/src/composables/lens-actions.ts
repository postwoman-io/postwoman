import { HoppRESTResponse } from "@helpers/types/HoppRESTResponse"
import { copyToClipboard } from "@helpers/utils/clipboard"
import { refAutoReset } from "@vueuse/core"
import { computed, ComputedRef, onMounted, ref, Ref } from "vue"

import jsonToLanguage from "~/helpers/utils/json-to-language"
import { platform } from "~/platform"
import IconCheck from "~icons/lucide/check"
import IconCopy from "~icons/lucide/copy"
import IconDownload from "~icons/lucide/download"
import { useI18n } from "./i18n"
import { useToast } from "./toast"
import { HoppRESTRequestResponse } from "@hoppscotch/data"

export function useCopyInterface(responseBodyText: Ref<string>) {
  const toast = useToast()
  const t = useI18n()

  const copyInterfaceIcon = refAutoReset(IconCopy, 1000)

  const copyInterface = async (targetLanguage: string) => {
    jsonToLanguage(targetLanguage, responseBodyText.value).then((res) => {
      copyToClipboard(res.lines.join("\n"))
      copyInterfaceIcon.value = IconCheck
      toast.success(
        t("state.copied_interface_to_clipboard", { language: targetLanguage })
      )
    })
  }

  return {
    copyInterfaceIcon,
    copyInterface,
  }
}

export function useCopyResponse(responseBodyText: Ref<any>) {
  const toast = useToast()
  const t = useI18n()

  const copyIcon = refAutoReset(IconCopy, 1000)

  const copyResponse = () => {
    copyToClipboard(responseBodyText.value)
    copyIcon.value = IconCheck
    toast.success(`${t("state.copied_to_clipboard")}`)
  }

  return {
    copyIcon,
    copyResponse,
  }
}

export type downloadResponseReturnType = (() => void) | Ref<any>

export function useDownloadResponse(
  contentType: string,
  responseBody: Ref<string | ArrayBuffer>,
  filename: string
) {
  const downloadIcon = refAutoReset(IconDownload, 1000)

  const toast = useToast()
  const t = useI18n()

  const downloadResponse = async () => {
    const dataToWrite = responseBody.value

    // TODO: Look at the mime type and determine extension ?
    const result = await platform.io.saveFileWithDialog({
      data: dataToWrite,
      contentType: contentType,
      suggestedFilename: filename,
    })

    // Assume success if unknown as we cannot determine
    if (result.type === "unknown" || result.type === "saved") {
      downloadIcon.value = IconCheck
      toast.success(`${t("state.download_started")}`)
    }
  }

  return {
    downloadIcon,
    downloadResponse,
  }
}

export function usePreview(
  previewEnabledDefault: boolean,
  responseBodyText: Ref<string>
): {
  previewFrame: Ref<HTMLIFrameElement | null>
  previewEnabled: Ref<boolean>
  togglePreview: () => void
} {
  const previewFrame: Ref<HTMLIFrameElement | null> = ref(null)
  const previewEnabled = ref(previewEnabledDefault)
  const url = ref("")

  // `previewFrame` is a template ref that gets attached to the `iframe` element when the component mounts
  // Ensures the HTML content is rendered immediately after a request, persists between tab switches, and is not limited to preview toggles
  onMounted(() => updatePreviewFrame())

  // Prevent updating the `iframe` element attributes during preview toggle actions after they are set initially
  const shouldUpdatePreviewFrame = computed(
    () => previewFrame.value?.getAttribute("data-previewing-url") !== url.value
  )

  const updatePreviewFrame = () => {
    if (
      previewEnabled.value &&
      previewFrame.value &&
      shouldUpdatePreviewFrame.value
    ) {
      // Use DOMParser to parse document HTML.
      const previewDocument = new DOMParser().parseFromString(
        responseBodyText.value,
        "text/html"
      )
      // Inject <base href="..."> tag to head, to fix relative CSS/HTML paths.
      previewDocument.head.innerHTML =
        `<base href="${url.value}">` + previewDocument.head.innerHTML

      // Finally, set the iframe source to the resulting HTML.
      previewFrame.value.srcdoc = previewDocument.documentElement.outerHTML
      previewFrame.value.setAttribute("data-previewing-url", url.value)
    }
  }

  const togglePreview = () => {
    previewEnabled.value = !previewEnabled.value
    updatePreviewFrame()
  }

  return {
    previewFrame,
    previewEnabled,
    togglePreview,
  }
}

export function useResponseBody(
  response: HoppRESTResponse | HoppRESTRequestResponse
): {
  responseBodyText: ComputedRef<string>
} {
  const responseBodyText = computed(() => {
    if ("type" in response) {
      if (
        response.type === "loading" ||
        response.type === "network_fail" ||
        response.type === "script_fail" ||
        response.type === "fail" ||
        response.type === "extension_error"
      )
        return ""
    }
    return getResponseBodyText(response.body)
  })
  return {
    responseBodyText,
  }
}

export function getResponseBodyText(body: ArrayBuffer | string): string {
  if (typeof body === "string") return body

  const res = new TextDecoder("utf-8").decode(body)
  // HACK: Temporary trailing null character issue from the extension fix
  return res.replace(/\0+$/, "")
}
