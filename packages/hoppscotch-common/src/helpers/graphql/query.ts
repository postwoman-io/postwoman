import { useService } from "dioc/vue"
import {
  ArgumentNode,
  DocumentNode,
  FieldNode,
  getNamedType,
  GraphQLArgument,
  GraphQLType,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
  print,
} from "graphql"
import { ref } from "vue"
import { GQLTabService } from "~/services/tab/graphql"
import { ExplorerFieldDef, ExplorerNavStackItem, useExplorer } from "./explorer"

/**
 * Makes all properties in type T mutable
 */
type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

const updatedQuery = ref("")
const cursorPosition = ref({ line: 0, ch: 1 })
const operations = ref<OperationDefinitionNode[]>([])

/**
 * Hook to manage GraphQL query operations and mutations
 * Provides functionality for building and modifying GraphQL operations
 */
export function useQuery() {
  const tabs = useService(GQLTabService)
  const { navStack } = useExplorer()

  /**
   * Returns default value for a GraphQL type
   * @param type - GraphQL type to get default value for
   */
  const getDefaultArgumentValue = (type: GraphQLType): string => {
    const namedType = getNamedType(type)
    const defaultValues: Record<string, string> = {
      String: "",
      Int: "0",
      Float: "0.0",
      Boolean: "false",
    }
    return defaultValues[namedType.name] || "null"
  }

  /**
   * Maps operation name to GraphQL operation type
   * @param name - Operation name to convert
   */
  const getOperationTypeNode = (name: string): OperationTypeNode => {
    const operationTypes: Record<string, OperationTypeNode> = {
      Query: OperationTypeNode.QUERY,
      Mutation: OperationTypeNode.MUTATION,
      Subscription: OperationTypeNode.SUBSCRIPTION,
    }
    return operationTypes[name] || OperationTypeNode.QUERY
  }

  /**
   * Finds operation definition node at given cursor position
   * @param cursorPosition - Position to find operation at
   */
  const getOperation = (cursorPosition: number) => {
    return operations.value.find(
      ({ loc }) =>
        loc && cursorPosition >= loc.start && cursorPosition <= loc.end
    )
  }

  /**
   * Creates an ArgumentNode with default value
   * @param argName - Name of the argument
   * @param type - GraphQL type of the argument
   */
  const createArgumentNode = (
    argName: string,
    type: GraphQLType
  ): ArgumentNode => ({
    kind: Kind.ARGUMENT,
    name: { kind: Kind.NAME, value: argName },
    value: { kind: Kind.STRING, value: getDefaultArgumentValue(type) },
  })

  /**
   * Creates a FieldNode with optional arguments and nested fields
   * @param name - Field name
   * @param args - Field arguments
   * @param hasNestedFields - Whether field has nested selections
   */
  const createFieldNode = (
    name: string,
    args: GraphQLArgument[] | undefined,
    hasNestedFields = false
  ): Mutable<FieldNode> => ({
    kind: Kind.FIELD,
    name: { kind: Kind.NAME, value: name },
    arguments: args?.map((arg) => createArgumentNode(arg.name, arg.type)) || [],
    directives: [],
    selectionSet: hasNestedFields
      ? { kind: Kind.SELECTION_SET, selections: [] }
      : undefined,
  })

  /**
   * Result of processing an operation, including document and field location
   */
  type OperationResult = {
    append?: boolean
    document: DocumentNode | null
    fieldLocation?: {
      start: number
      end: number
    }
  }

  /**
   * Processes GraphQL operation based on navigation stack
   * Handles merging with existing operations and field/argument modifications
   *
   * @param navItems - Navigation stack items
   * @param existingOperation - Existing operation to modify (if any)
   * @param isArgument - Whether processing an argument
   */
  const processOperation = (
    navItems: ExplorerNavStackItem[],
    existingOperation?: OperationDefinitionNode,
    isArgument = false
  ): OperationResult => {
    const queryPath = navItems.slice(2, isArgument ? -1 : undefined)
    const argumentItem = isArgument ? navItems[navItems.length - 1] : null
    const lastItem = queryPath[queryPath.length - 1]
    const requestedOperationType = getOperationTypeNode(navItems[1].name)

    // Handle new operations
    if (
      !existingOperation ||
      existingOperation.operation !== requestedOperationType
    ) {
      // Build from bottom up starting with the last field
      let currentSelection = createFieldNode(
        lastItem.name,
        lastItem.def?.args,
        lastItem.def?.fields?.length > 0
      )

      for (let i = queryPath.length - 2; i >= 0; i--) {
        const item = queryPath[i]
        const parentField = createFieldNode(item.name, item.def?.args, true)
        parentField.selectionSet!.selections = [currentSelection]
        currentSelection = parentField
      }

      return {
        document: {
          kind: Kind.DOCUMENT,
          definitions: [
            {
              kind: Kind.OPERATION_DEFINITION,
              operation: requestedOperationType,
              name: { kind: Kind.NAME, value: queryPath[0].name },
              variableDefinitions: [],
              directives: [],
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [currentSelection],
              },
            },
          ],
        },
      }
    }

    // For existing operations
    let currentSelectionSet = existingOperation.selectionSet
    let fieldLocation: { start: number; end: number } | undefined
    let append = false

    if (
      requestedOperationType === OperationTypeNode.SUBSCRIPTION &&
      requestedOperationType === existingOperation?.operation
    ) {
      // Check if paths are different at the top level
      const existingTopField = existingOperation.selectionSet
        .selections[0] as FieldNode
      if (existingTopField.name.value !== queryPath[0].name) {
        append = true
        currentSelectionSet.selections = []
      }
    }

    for (let i = 0; i < queryPath.length; i++) {
      const item = queryPath[i]
      const isLastItem = i === queryPath.length - 1

      const existingFieldIndex = currentSelectionSet.selections.findIndex(
        (selection): selection is FieldNode =>
          selection.kind === Kind.FIELD && selection.name.value === item.name
      )

      if (existingFieldIndex !== -1) {
        const existingField = currentSelectionSet.selections[
          existingFieldIndex
        ] as Mutable<FieldNode>

        if (isLastItem) {
          if (isArgument && argumentItem) {
            // Handle argument modifications
            const argIndex =
              existingField.arguments?.findIndex(
                (arg) => arg.name.value === argumentItem.name
              ) ?? -1

            if (argIndex !== -1) {
              existingField.arguments?.splice(argIndex, 1)
            } else {
              const newArg = createArgumentNode(
                argumentItem.name,
                (argumentItem.def as any)?.type
              )
              existingField.arguments = existingField.arguments || []
              existingField.arguments.push(newArg)
            }
          } else {
            // Remove the field if it's not an argument operation
            currentSelectionSet.selections.splice(existingFieldIndex, 1)
          }

          if (existingField.loc) {
            fieldLocation = {
              start: existingField.loc.start,
              end: existingField.loc.end,
            }
          }
          break
        }

        // Ensure parent has a selection set
        if (!existingField.selectionSet) {
          existingField.selectionSet = {
            kind: Kind.SELECTION_SET,
            selections: [],
          }
        }

        // Move to the next level
        currentSelectionSet = existingField.selectionSet ?? {
          kind: Kind.SELECTION_SET,
          selections: [],
        }
      } else {
        const newField = createFieldNode(
          item.name,
          (item.def as any)?.args, // these type assertion is avoidable
          !isLastItem || (isLastItem && (item.def as any)?.fields?.length > 0)
        )

        // Store the approximate location where field will be added
        if (currentSelectionSet.loc) {
          fieldLocation = {
            start: currentSelectionSet.loc.end - 1,
            end: currentSelectionSet.loc.end - 1,
          }
        }

        if (!isLastItem) {
          // Ensure non-leaf nodes have a selection set
          newField.selectionSet = {
            kind: Kind.SELECTION_SET,
            selections: [],
          }
        }

        currentSelectionSet.selections.push(newField)

        if (!isLastItem) {
          // Move to the next level
          currentSelectionSet = newField.selectionSet!
        }
      }
    }

    return {
      document:
        existingOperation.selectionSet.selections.length === 0
          ? null
          : {
              kind: Kind.DOCUMENT,
              definitions: [existingOperation],
            },
      fieldLocation,
      append,
    }
  }

  /**
   * Handles operation modifications for fields and arguments
   * Updates query and cursor position based on changes
   *
   * @param item - Field or argument to process
   * @param isArgument - Whether item is an argument
   */
  const handleOperation = (item: ExplorerFieldDef, isArgument = false) => {
    const currentTab = tabs.currentActiveTab.value
    if (!currentTab) return

    const currentQuery = currentTab.document.request.query || ""
    const selectedOperation = getOperation(currentTab.document.cursorPosition)
    const navItems = [...navStack.value, { name: item.name, def: item }]

    const result = processOperation(
      navItems as ExplorerNavStackItem[],
      selectedOperation,
      isArgument
    )

    const newQuery = result.document
      ? print(result.document.definitions[0])
      : "\n"

    // If operation type is different or no existing operation,
    // append as a new operation
    if (
      !selectedOperation ||
      selectedOperation.operation !== getOperationTypeNode(navItems[1].name) ||
      result.append
    ) {
      updatedQuery.value = currentQuery.trim()
        ? `${currentQuery}\n\n${newQuery}`
        : newQuery
      cursorPosition.value = {
        line: currentQuery.split("\n").length + (currentQuery.trim() ? 2 : 1),
        ch: -1,
      }
      return
    }

    // Replace existing operation if operation types match
    updatedQuery.value = currentQuery.replace(
      currentQuery.substring(
        selectedOperation.loc!.start,
        selectedOperation.loc!.end
      ),
      newQuery
    )

    // Update cursor position to field location
    if (result.fieldLocation) {
      const precedingText = currentQuery.substring(
        0,
        result.fieldLocation.start
      )
      const lines = precedingText.split("\n")
      cursorPosition.value = {
        line: lines.length - 1,
        ch: -1,
      }
    }
  }

  const isItemInOperation = (
    item: ExplorerFieldDef,
    isArgument = false
  ): boolean => {
    const operation = getOperation(
      tabs.currentActiveTab.value?.document.cursorPosition
    )
    if (!operation) return false

    // Get the current navigation path (excluding root and operation type)
    const navPath = navStack.value.slice(2)

    // Start from the operation's selection set
    let currentSelections = operation.selectionSet.selections

    // Follow the navigation path
    for (let i = 0; i < navPath.length; i++) {
      const pathItem = navPath[i]
      const foundField = currentSelections.find(
        (selection) =>
          selection.kind === Kind.FIELD &&
          selection.name.value === pathItem.name
      ) as FieldNode | undefined

      if (!foundField?.selectionSet) return false

      currentSelections = foundField.selectionSet.selections
    }

    // Check based on type
    return currentSelections.some((selection) => {
      if (selection.kind !== Kind.FIELD) return false
      return isArgument
        ? selection.arguments?.some(
            (argNode) => argNode.name.value === item.name
          )
        : selection.name.value === item.name
    })
  }

  return {
    handleAddField: (field: ExplorerFieldDef) => handleOperation(field),
    handleAddArgument: (arg: ExplorerFieldDef) => handleOperation(arg, true),
    updatedQuery,
    cursorPosition,
    operationDefinitions: operations,
    isFieldInOperation: (field: ExplorerFieldDef) => isItemInOperation(field),
    isArgumentInOperation: (arg: ExplorerFieldDef) =>
      isItemInOperation(arg, true),
  }
}
