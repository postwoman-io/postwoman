import { AxiosRequestConfig } from "axios"
import { cloneDeep } from "lodash-es"
import { useSetting } from "~/composables/settings"

// Helper function to check if a string is already encoded
const isEncoded = (value: string) => {
  try {
    return value !== decodeURIComponent(value)
  } catch (e) {
    return false // in case of malformed URI sequence
  }
}

export const preProcessRequest = (
  req: AxiosRequestConfig
): AxiosRequestConfig => {
  const reqClone = cloneDeep(req)
  const encodeMode = useSetting("ENCODE_MODE")

  // If the parameters are URLSearchParams, inject them to URL instead
  // This prevents issues of marshalling the URLSearchParams to the proxy
  if (reqClone.params instanceof URLSearchParams) {
    try {
      const url = new URL(reqClone.url ?? "")

      for (const [key, value] of reqClone.params.entries()) {
        let finalValue = value
        if (
          encodeMode.value === "enable" ||
          (encodeMode.value === "auto" &&
            /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(value))
        ) {
          // Check if the value is already encoded (e.g., contains % symbols)
          if (!isEncoded(value)) {
            finalValue = encodeURIComponent(value)
          }
        }

        // Set the parameter with the final value
        url.searchParams.append(key, finalValue)
      }

      // decode the URL to prevent double encoding
      reqClone.url = decodeURIComponent(url.toString())
    } catch (e) {
      // making this a non-empty block, so we can make the linter happy.
      // we should probably use, allowEmptyCatch, or take the time to do something with the caught errors :)
    }

    reqClone.params = {}
  }

  return reqClone
}
