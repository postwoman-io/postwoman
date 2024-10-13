import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import * as RR from "fp-ts/ReadonlyRecord"

export const REQUEST_METHOD_LABEL_COLORS = {
  get: "var(--method-get-color)",
  post: "var(--method-post-color)",
  put: "var(--method-put-color)",
  patch: "var(--method-patch-color)",
  delete: "var(--method-delete-color)",
  head: "var(--method-head-color)",
  options: "var(--method-options-color)",
  default: "var(--method-default-color)",
} as const

/**
 * Returns the label color tailwind class for a request
 * @param method The HTTP VERB of the request
 * @returns The class value for the given HTTP VERB, if not, a generic verb class
 */
export function getMethodLabelColorClassOf(method: string) {
  return pipe(
    REQUEST_METHOD_LABEL_COLORS,
    RR.lookup(method.toLowerCase()),
    O.getOrElseW(() => REQUEST_METHOD_LABEL_COLORS.default)
  )
}

export function getMethodLabelColor(method: string) {
  return pipe(
    REQUEST_METHOD_LABEL_COLORS,
    RR.lookup(method.toLowerCase()),
    O.getOrElseW(() => REQUEST_METHOD_LABEL_COLORS.default)
  )
}
