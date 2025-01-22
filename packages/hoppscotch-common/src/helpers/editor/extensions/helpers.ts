import { syntaxTree } from "@codemirror/language"
import { EditorState } from "@codemirror/state"

/**
 * Check if the cursor is inside a comment
 * @param state Editor state
 * @param pos Position of the cursor
 * @return Boolean value indicating if the cursor is inside a comment
 */
export const isComment = (state: EditorState, pos: number) => {
  const tree = syntaxTree(state)
  const { name } = tree.resolveInner(pos)
  return name.endsWith("Comment") || name.endsWith("comment")
}
