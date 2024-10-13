import jsonParse, {
  JSONArrayValue,
  JSONCommentValue,
  JSONObjectValue,
  JSONValue,
} from "~/helpers/jsoncParse"

type PrettifyOptions = {
  indent?: string | number
  maxLength?: number
  commentSpace?: boolean
  trailingComma?: boolean
}

const DEFAULT_OPTIONS: Required<PrettifyOptions> = {
  indent: 2,
  maxLength: 80,
  commentSpace: true,
  trailingComma: true,
}

function prettify(
  ast: JSONObjectValue | JSONArrayValue,
  options: PrettifyOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const indent =
    typeof opts.indent === "number" ? " ".repeat(opts.indent) : opts.indent
  return formatValue(ast, opts, 0, indent)
}

function formatValue(
  node: JSONValue,
  options: Required<PrettifyOptions>,
  depth: number,
  indent: string
): string {
  switch (node.kind) {
    case "Object":
      return formatObject(node, options, depth, indent)
    case "Array":
      return formatArray(node, options, depth, indent)
    case "String":
      return JSON.stringify(node.value)
    case "Number":
    case "Boolean":
      return String(node.value)
    case "Null":
      return "null"
    default:
      return ""
  }
}

function formatComments(
  comments: JSONCommentValue[] | undefined,
  options: Required<PrettifyOptions>,
  indentation: string,
  inline: boolean = false
): string {
  if (!comments?.length) return ""

  return comments
    .map((comment) => {
      if (comment.kind === "SingleLineComment") {
        const space = options.commentSpace ? " " : ""
        return inline
          ? ` //${space}${comment.value}`
          : `\n${indentation}//${space}${comment.value}`
      }
      const space = options.commentSpace ? " " : ""
      const commentLines = comment.value.split("\n")

      if (commentLines.length === 1) {
        return inline
          ? ` /*${space}${comment.value}${space}*/`
          : `\n${indentation}/*${space}${comment.value}${space}*/`
      }

      return (
        `\n${indentation}/*\n` +
        commentLines.map((line) => `${indentation} * ${line}`).join("\n") +
        `\n${indentation} */`
      )
    })
    .join("")
}

function formatObject(
  node: JSONObjectValue,
  options: Required<PrettifyOptions>,
  depth: number,
  indent: string
): string {
  if (node.members.length === 0) {
    const comments = formatComments(node.comments, options, "", true)
    return `{${comments}}`
  }

  const indentation = indent.repeat(depth)
  const nextIndentation = indent.repeat(depth + 1)

  let result = "{"

  // Leading comments (before any members)
  if (node.comments?.length) {
    const leadingComments = node.comments.filter(
      (c) => c.start < node.members[0].start
    )
    if (leadingComments.length) {
      result += formatComments(leadingComments, options, nextIndentation)
    }
  }

  // Format each member
  node.members.forEach((member, index) => {
    const isLast = index === node.members.length - 1

    // Member's leading comments
    if (member.comments?.length) {
      const leadingComments = member.comments.filter(
        (c) => c.start < member.key.start
      )
      if (leadingComments.length) {
        result += formatComments(leadingComments, options, nextIndentation)
      }
    }

    // Member key-value pair
    result += "\n" + nextIndentation
    result += JSON.stringify(member.key.value) + ": "
    result += formatValue(member.value, options, depth + 1, indent)

    // Inline comments after the value
    if (member.comments?.length) {
      const inlineComments = member.comments.filter((c) => c.start > member.end)
      if (inlineComments.length) {
        result += formatComments(inlineComments, options, "", true)
      }
    }

    // Add comma if not last item or if trailing comma is enabled
    if (!isLast || options.trailingComma) {
      result += ","
    }

    // Comments between members
    if (!isLast && node.comments?.length) {
      const betweenComments = node.comments.filter(
        (c) => c.start > member.end && c.end < node.members[index + 1].start
      )
      if (betweenComments.length) {
        result += formatComments(betweenComments, options, nextIndentation)
      }
    }
  })

  // Trailing comments (after last member)
  if (node.comments?.length) {
    const trailingComments = node.comments.filter(
      (c) =>
        c.start > node.members[node.members.length - 1].end && c.end < node.end
    )
    if (trailingComments.length) {
      result += formatComments(trailingComments, options, nextIndentation)
    }
  }

  result += "\n" + indentation + "}"
  return result
}

function formatArray(
  node: JSONArrayValue,
  options: Required<PrettifyOptions>,
  depth: number,
  indent: string
): string {
  if (node.values.length === 0) {
    const comments = formatComments(node.comments, options, "", true)
    return `[${comments}]`
  }

  const indentation = indent.repeat(depth)
  const nextIndentation = indent.repeat(depth + 1)

  let result = "["

  // Leading comments (before any values)
  if (node.comments?.length) {
    const leadingComments = node.comments.filter(
      (c) => c.start < node.values[0].start
    )
    if (leadingComments.length) {
      result += formatComments(leadingComments, options, nextIndentation)
    }
  }

  // Format each value
  node.values.forEach((value, index) => {
    const isLast = index === node.values.length - 1

    // Value's leading comments
    if ("comments" in value && value.comments?.length) {
      const leadingComments = value.comments.filter(
        (c) => c.start < value.start
      )
      if (leadingComments.length) {
        result += formatComments(leadingComments, options, nextIndentation)
      }
    }

    result += "\n" + nextIndentation
    result += formatValue(value, options, depth + 1, indent)

    // Inline comments after the value
    if ("comments" in value && value.comments?.length) {
      const inlineComments = value.comments.filter((c) => c.start > value.end)
      if (inlineComments.length) {
        result += formatComments(inlineComments, options, "", true)
      }
    }

    // Add comma if not last item or if trailing comma is enabled
    if (!isLast || options.trailingComma) {
      result += ","
    }

    // Comments between values
    if (!isLast && node.comments?.length) {
      const betweenComments = node.comments.filter(
        (c) => c.start > value.end && c.end < node.values[index + 1].start
      )
      if (betweenComments.length) {
        result += formatComments(betweenComments, options, nextIndentation)
      }
    }
  })

  // Trailing comments (after last value)
  if (node.comments?.length) {
    const trailingComments = node.comments.filter(
      (c) =>
        c.start > node.values[node.values.length - 1].end && c.end < node.end
    )
    if (trailingComments.length) {
      result += formatComments(trailingComments, options, nextIndentation)
    }
  }

  result += "\n" + indentation + "]"
  return result
}

export function prettifyJSONC(str: string, options: PrettifyOptions = {}) {
  const ast = jsonParse(str)
  return prettify(ast, options)
}
