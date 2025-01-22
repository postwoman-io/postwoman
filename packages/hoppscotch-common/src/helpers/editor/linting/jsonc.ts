import { Node, parseTree, stripComments as stripComments_ } from "jsonc-parser"
import jsoncParse from "~/helpers/jsoncParse"
import { convertIndexToLineCh } from "../utils"
import { LinterDefinition, LinterResult } from "./linter"

const linter: LinterDefinition = (text) => {
  try {
    jsoncParse(text)
    return Promise.resolve([])
  } catch (e: any) {
    return Promise.resolve([
      <LinterResult>{
        from: convertIndexToLineCh(text, e.start),
        to: convertIndexToLineCh(text, e.end),
        message: e.message,
        severity: "error",
      },
    ])
  }
}

/**
 * An internal error that is thrown when an invalid JSONC node configuration
 * is encountered
 */
class InvalidJSONCNodeError extends Error {
  constructor() {
    super()
    this.message = "Invalid JSONC node"
  }
}

// NOTE: If we choose to export this function, do refactor it to return a result discriminated union instead of throwing
/**
 * @throws {InvalidJSONCNodeError} if the node is in an invalid configuration
 * @returns The JSON string without comments and trailing commas or null
 * if the conversion failed
 */
function convertNodeToJSON(node: Node): string {
  switch (node.type) {
    case "string":
      return JSON.stringify(node.value)
    case "null":
      return "null"
    case "array":
      if (!node.children) {
        throw new InvalidJSONCNodeError()
      }

      return `[${node.children
        .map((child) => convertNodeToJSON(child))
        .join(",")}]`
    case "number":
      return JSON.stringify(node.value)
    case "boolean":
      return JSON.stringify(node.value)
    case "object":
      if (!node.children) {
        throw new InvalidJSONCNodeError()
      }

      return `{${node.children
        .map((child) => convertNodeToJSON(child))
        .join(",")}}`
    case "property":
      if (!node.children || node.children.length !== 2) {
        throw new InvalidJSONCNodeError()
      }

      const [keyNode, valueNode] = node.children

      // If the valueNode configuration is wrong, this will return an error, which will propagate up
      return `${JSON.stringify(keyNode)}:${convertNodeToJSON(valueNode)}`
  }
}

function stripCommentsAndCommas(text: string): string {
  const tree = parseTree(text, undefined, {
    allowEmptyContent: true,
    allowTrailingComma: true,
  })

  // If we couldn't parse the tree, return the original text
  if (!tree) {
    return text
  }

  // convertNodeToJSON can throw an error if the tree is invalid
  try {
    return convertNodeToJSON(tree)
  } catch (_) {
    return text
  }
}

/**
 * Removes comments from a JSON string.
 * @param jsonString The JSON string with comments.
 * @returns The JSON string without comments.
 */

export function stripComments(jsonString: string) {
  return stripCommentsAndCommas(stripComments_(jsonString))
}

export default linter
