import { format, applyEdits } from "jsonc-parser"

export function prettifyJSONC(str: string) {
  const editResult = format(str, undefined, {
    insertSpaces: true,
    tabSize: 2,
    insertFinalNewline: true,
  })
  return applyEdits(str, editResult)
}
