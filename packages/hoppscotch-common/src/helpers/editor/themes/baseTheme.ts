import {
  EditorView,
  keymap,
  highlightSpecialChars,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  lineNumbers,
  highlightActiveLineGutter,
  rectangularSelection,
  crosshairCursor,
} from "@codemirror/view"
import {
  HighlightStyle,
  defaultHighlightStyle,
  foldKeymap,
  foldGutter,
  indentOnInput,
  bracketMatching,
  syntaxHighlighting,
} from "@codemirror/language"
import { tags as t } from "@lezer/highlight"
import { Extension, EditorState } from "@codemirror/state"
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands"
import {
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
  completionKeymap,
} from "@codemirror/autocomplete"
import {
  searchKeymap,
  highlightSelectionMatches,
  search,
} from "@codemirror/search"
import { lintKeymap } from "@codemirror/lint"

export const baseTheme = EditorView.theme({
  "&": {
    fontSize: "var(--font-size-body)",
    height: "100%",
    width: "100%",
    flex: "1",
  },
  ".cm-content": {
    caretColor: "var(--secondary-dark-color)",
    fontFamily: "var(--font-mono)",
    color: "var(--secondary-dark-color)",
    backgroundColor: "transparent",
    height: "100%",
  },
  ".cm-cursor": {
    borderColor: "var(--secondary-color)",
  },
  ".cm-widgetBuffer": {
    position: "absolute",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--accent-dark-color)",
    color: "var(--accent-contrast-color)",
    borderRadius: "2px",
    opacity: "0.4",
  },
  ".cm-panels": {
    backgroundColor: "var(--primary-light-color)",
    color: "var(--secondary-light-color)",
    zIndex: "1",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid var(--divider-light-color)",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid var(--divider-light-color)",
  },
  ".cm-search": {
    display: "flex",
    alignItems: "center",
    flexWrap: "nowrap",
    flexShrink: "0",
    overflow: "auto",
    padding: "0.25rem 0.5rem !important",
  },
  ".cm-search label": {
    display: "inline-flex",
    alignItems: "center",
  },
  ".cm-textfield": {
    backgroundColor: "var(--primary-color)",
    color: "var(--secondary-dark-color)",
    borderColor: "var(--divider-light-color)",
    borderRadius: "4px",
    fontSize: "var(--font-size-tiny)",
    fontWeight: "600",
    flexShrink: "0",
    border: "1px solid var(--divider-color)",
  },
  ".cm-button": {
    backgroundColor: "var(--primary-color)",
    color: "var(--secondary-light-color)",
    backgroundImage: "none",
    borderRadius: "4px",
    fontSize: "var(--font-size-tiny)",
    fontWeight: "600",
    textTransform: "capitalize",
    flexShrink: "0",
    border: "1px solid var(--divider-color)",
  },
  ".cm-completionLabel": {
    color: "var(--secondary-color)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--primary-dark-color)",
    color: "var(--secondary-light-color)",
    border: "none",
    borderRadius: "4px",
  },
  ".cm-tooltip-arrow": {
    color: "var(--tooltip-color)",
  },
  ".cm-tooltip-arrow:after": {
    borderTopColor: "currentColor !important",
  },
  ".cm-tooltip-arrow:before": {
    borderTopColor: "currentColor !important",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-mono)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent-dark-color)",
    color: "var(--accent-contrast-color)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionLabel": {
    color: "var(--accent-contrast-color)",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-searchMatch": {
    outline: "1px solid var(--accent-dark-color)",
    backgroundColor: "var(--divider-dark-color)",
    borderRadius: "2px",
  },
  ".cm-selectionMatch": {
    outline: "1px solid var(--accent-dark-color)",
    backgroundColor: "var(--divider-light-color)",
    borderRadius: "2px",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "var(--divider-color)",
    outline: "1px solid var(--accent-dark-color)",
    borderRadius: "2px",
  },
  ".cm-gutters": {
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--primary-color)",
    borderColor: "var(--divider-light-color)",
  },
  ".cm-lineNumbers": {
    minWidth: "3em",
    color: "var(--secondary-light-color)",
  },
  ".cm-foldGutter": {
    minWidth: "2em",
    color: "var(--secondary-light-color)",
  },
  ".cm-foldGutter .cm-gutterElement": {
    textAlign: "center",
  },
  ".cm-line": {
    paddingLeft: "0.5rem",
    paddingRight: "0.5rem",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--divider-light-color)",
    color: "var(--secondary-dark-color)",
    borderColor: "var(--divider-dark-color)",
  },
})

export const inputTheme = EditorView.theme({
  "&": {
    fontSize: "var(--font-size-body)",
    height: "100%",
    width: "100%",
    flex: "1",
  },
  ".cm-content": {
    caretColor: "var(--secondary-dark-color)",
    fontFamily: "var(--font-sans)",
    color: "var(--secondary-dark-color)",
    backgroundColor: "transparent",
    height: "100%",
  },
  ".cm-cursor": {
    borderColor: "var(--secondary-color)",
  },
  ".cm-widgetBuffer": {
    position: "absolute",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--accent-dark-color)",
    color: "var(--accent-contrast-color)",
    borderRadius: "2px",
  },
  ".cm-panels": {
    backgroundColor: "var(--primary-light-color)",
    color: "var(--secondary-light-color)",
    zIndex: "1",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid var(--divider-light-color)",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid var(--divider-light-color)",
  },
  ".cm-search": {
    display: "flex",
    alignItems: "center",
    flexWrap: "nowrap",
    flexShrink: "0",
    overflow: "auto",
    padding: "0.25rem 0.5rem !important",
  },
  ".cm-search label": {
    display: "inline-flex",
    alignItems: "center",
  },
  ".cm-textfield": {
    backgroundColor: "var(--primary-color)",
    color: "var(--secondary-dark-color)",
    borderColor: "var(--divider-light-color)",
    borderRadius: "4px",
    fontSize: "var(--font-size-tiny)",
    fontWeight: "600",
    flexShrink: "0",
    border: "1px solid var(--divider-color)",
  },
  ".cm-button": {
    backgroundColor: "var(--primary-color)",
    color: "var(--secondary-light-color)",
    backgroundImage: "none",
    borderRadius: "4px",
    fontSize: "var(--font-size-tiny)",
    fontWeight: "600",
    textTransform: "capitalize",
    flexShrink: "0",
    border: "1px solid var(--divider-color)",
  },
  ".cm-completionLabel": {
    color: "var(--secondary-color)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--primary-dark-color)",
    color: "var(--secondary-light-color)",
    border: "none",
    borderRadius: "4px",
  },
  ".cm-tooltip-arrow": {
    color: "var(--tooltip-color)",
  },
  ".cm-tooltip-arrow:after": {
    borderTopColor: "currentColor !important",
  },
  ".cm-tooltip-arrow:before": {
    borderTopColor: "currentColor !important",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-mono)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent-dark-color)",
    color: "var(--accent-contrast-color)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionLabel": {
    color: "var(--accent-contrast-color)",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-searchMatch": {
    outline: "1px solid var(--accent-dark-color)",
    backgroundColor: "var(--divider-dark-color)",
    borderRadius: "2px",
  },
  ".cm-selectionMatch": {
    outline: "1px solid var(--accent-dark-color)",
    backgroundColor: "var(--divider-light-color)",
    borderRadius: "2px",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "var(--divider-color)",
    outline: "1px solid var(--accent-dark-color)",
    borderRadius: "2px",
  },
  ".cm-gutters": {
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--primary-color)",
    borderColor: "var(--divider-light-color)",
  },
  ".cm-lineNumbers": {
    minWidth: "3em",
    color: "var(--secondary-light-color)",
  },
  ".cm-foldGutter": {
    minWidth: "2em",
    color: "var(--secondary-light-color)",
  },
  ".cm-foldGutter .cm-gutterElement": {
    textAlign: "center",
  },
  ".cm-line": {
    lineHeight: "1rem",
    paddingLeft: "1rem",
    paddingRight: "1rem",
    paddingTop: "0.25rem",
    paddingBottom: "0.25rem",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--divider-light-color)",
    color: "var(--secondary-dark-color)",
    borderColor: "var(--divider-dark-color)",
  },
})

const editorTypeColor = "var(--editor-type-color)"
const editorNameColor = "var(--editor-name-color)"
const editorOperatorColor = "var(--editor-operator-color)"
const editorInvalidColor = "var(--editor-invalid-color)"
const editorSeparatorColor = "var(--editor-separator-color)"
const editorMetaColor = "var(--editor-meta-color)"
const editorVariableColor = "var(--editor-variable-color)"
const editorLinkColor = "var(--editor-link-color)"
const editorProcessColor = "var(--editor-process-color)"
const editorConstantColor = "var(--editor-constant-color)"
const editorKeywordColor = "var(--editor-keyword-color)"

export const baseHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: editorKeywordColor },
  {
    tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
    color: editorNameColor,
  },
  {
    tag: [t.function(t.variableName), t.labelName],
    color: editorVariableColor,
  },
  {
    tag: [t.color, t.constant(t.name), t.standard(t.name)],
    color: editorConstantColor,
  },
  { tag: [t.definition(t.name), t.separator], color: editorSeparatorColor },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.annotation,
      t.modifier,
      t.self,
      t.namespace,
    ],
    color: editorTypeColor,
  },
  {
    tag: [
      t.operator,
      t.operatorKeyword,
      t.url,
      t.escape,
      t.regexp,
      t.link,
      t.special(t.string),
    ],
    color: editorOperatorColor,
  },
  {
    tag: [t.meta, t.comment],
    color: editorMetaColor,
  },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: editorLinkColor, textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: editorNameColor },
  {
    tag: [t.atom, t.bool, t.special(t.variableName)],
    color: editorConstantColor,
  },
  {
    tag: [t.processingInstruction, t.string, t.inserted],
    color: editorProcessColor,
  },
  { tag: t.invalid, color: editorInvalidColor },
])

export const basicSetup: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter({
    openText: "▾",
    closedText: "▸",
  }),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(baseHighlightStyle),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
  search({
    top: true,
  }),
]
