import * as O from "fp-ts/Option"
import { flow } from "fp-ts/function"

/**
 * Checks and Parses JSON string
 * @param str Raw JSON data to be parsed
 * @returns Option type with some(JSON data) or none
 */
export const safeParseJSON = (
  str: string,
  convertToArray = false
): O.Option<Record<string, unknown> | Array<unknown>> =>
  O.tryCatch(() => {
    const data = JSON.parse(str)
    if (convertToArray) {
      return Array.isArray(data) ? data : [data]
    }
    return data
  })

/**
 * Checks if given string is a JSON string
 * @param str Raw string to be checked
 * @returns If string is a JSON string
 */
export const isJSON = flow(safeParseJSON, O.isSome)
