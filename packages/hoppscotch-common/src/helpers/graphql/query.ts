import { useService } from "dioc/vue"
import {
  ArgumentNode,
  DocumentNode,
  FieldNode,
  getNamedType,
  GraphQLField,
  GraphQLType,
  isObjectType,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
  parse,
  print,
  visit,
} from "graphql"
import { ref } from "vue"
import { GQLTabService } from "~/services/tab/graphql"
import { mutationFields, queryFields, subscriptionFields } from "./connection"
import { ExplorerFieldDef, ExplorerNavStack, useExplorer } from "./explorer"

const updatedQuery = ref("")
const cursorPosition = ref({ line: 0, ch: 0 })
const operations = ref<OperationDefinitionNode[]>([])

export function useQuery() {
  const tabs = useService(GQLTabService)
  const { navStack, push } = useExplorer()

  const getOperation = (cursorPosition: number) => {
    return operations.value.find((operation) => {
      const { start, end } = operation.loc!
      return cursorPosition >= start && cursorPosition <= end
    })
  }

  const getSelectedOperation = () =>
    getOperation(tabs.currentActiveTab.value.document.cursorPosition)

  function insertGraphQLField(
    currentQuery = "",
    field: GraphQLField<any, any>
  ): string {
    console.log("currentQuery", currentQuery, operations.value)
    if (!currentQuery.trim()) return createNewQuery(field)

    try {
      const ast = parse(currentQuery)
      const fieldName = field.name

      // Determine the operation type for the field
      const operationType = getOperationType(field)

      // Helper function to check if field exists in an operation
      const isFieldInOperation = (node: OperationDefinitionNode) => {
        if (!node.selectionSet) return false
        return node.selectionSet.selections.some(
          (selection) =>
            selection.kind === "Field" &&
            selection.name.value.split("(")[0] === fieldName
        )
      }

      // Modify the AST
      const modifiedAst = visit(ast, {
        OperationDefinition(node: OperationDefinitionNode) {
          // If operation type matches and field doesn't exist
          if (
            node.operation === operationType.toLowerCase() &&
            !isFieldInOperation(node)
          ) {
            // Check if the field has a complex type that needs nested selection
            const fieldType = getNamedType(field.type)

            const fieldNode =
              fieldType.name !== "String" &&
              fieldType.name !== "Int" &&
              fieldType.name !== "Float" &&
              fieldType.name !== "Boolean"
                ? {
                    kind: "Field",
                    name: { kind: "Name", value: fieldName },
                    selectionSet: {
                      kind: "SelectionSet",
                      selections: [
                        {
                          kind: "Field",
                          name: { kind: "Name", value: "id" },
                        },
                      ],
                    },
                  }
                : createFieldNode(field)

            return {
              ...node,
              selectionSet: {
                ...node.selectionSet,
                selections: [
                  ...(node.selectionSet?.selections || []),
                  fieldNode,
                ],
              },
            }
          }
          return node
        },
      })

      const wasModified = modifiedAst !== ast

      if (!wasModified) {
        modifiedAst.definitions.push(createOperationNode(field))
      }

      return print(modifiedAst)
    } catch (error) {
      console.error("Error inserting field:", error)
      return createNewQuery(field)
    }
  }

  // Helper function to create a field node
  function createFieldNode(field: GraphQLField<any, any>) {
    const fieldName = field.name
    const fieldType = getNamedType(field.type)

    // Handle fields with arguments
    if (field.args.length > 0) {
      const argStrings = field.args.map(
        (arg) => `${arg.name}: ${getDefaultArgumentValue(arg.type)}`
      )
      return {
        kind: "Field",
        name: {
          kind: "Name",
          value: fieldName,
        },
        arguments: argStrings.map((arg) => ({
          kind: "Argument",
          name: { kind: "Name", value: arg.split(":")[0].trim() },
          value: {
            kind: "StringValue",
            value: arg.split(":")[1].trim(),
          },
        })),
      }
    }

    console.log("fieldType", fieldType, fieldName)
    // Add empty parentheses for object types
    if (isObjectType(fieldType)) {
      return {
        kind: "Field",
        name: { kind: "Name", value: `${fieldName}{}` },
      }
    }

    return {
      kind: "Field",
      name: { kind: "Name", value: fieldName },
    }
  }

  // Helper function to get operation type
  function getOperationType(field: GraphQLField<any, any>): string {
    if (queryFields.value.includes(field)) return "Query"
    if (mutationFields.value.includes(field)) return "Mutation"
    if (subscriptionFields.value.includes(field)) return "Subscription"
    return "Query" // Default fallback
  }

  // Helper function to create a new operation node
  function createOperationNode(field: GraphQLField<any, any>) {
    const operationType = getOperationType(field)
    const operationName = `${operationType.toLowerCase()}Operation`

    return {
      kind: "OperationDefinition",
      operation: operationType.toLowerCase(),
      name: { kind: "Name", value: operationName },
      selectionSet: {
        kind: "SelectionSet",
        selections: [createFieldNode(field)],
      },
    }
  }

  // Helper function to create a new query
  function createNewQuery(field: GraphQLField<any, any>): string {
    const operationType = getOperationType(field)
    const operationName = `${operationType.toLowerCase()}Operation`

    const argParts = field.args.length
      ? `(${field.args.map((arg) => `$${arg.name}: ${arg.type}`).join(", ")})`
      : ""

    const variableParts = field.args.length
      ? `(${field.args.map((arg) => `${arg.name}: $${arg.name}`).join(", ")})`
      : ""

    return `${operationType.toLowerCase()} ${operationName}${argParts} {
  ${field.name}${variableParts}
}`
  }

  // Helper to get default argument value based on type
  function getDefaultArgumentValue(type: GraphQLType): string {
    const namedType = getNamedType(type)
    switch (namedType.name) {
      case "String":
        return '""'
      case "Int":
        return "0"
      case "Float":
        return "0.0"
      case "Boolean":
        return "false"
      default:
        return "null"
    }
  }

  function getCursorPositionFromIndex(query: string, index: number) {
    const lines = query.slice(0, index).split("\n")
    return {
      line: lines.length - 1,
      ch: lines[lines.length - 1].length,
    }
  }

  function buildQueryAst(navStack: ExplorerNavStack): DocumentNode {
    // Start from the actual query part (skip Root and Query)
    const queryPath = navStack.slice(2)
    const operationTypeNode =
      navStack[1].name === "Query"
        ? OperationTypeNode.QUERY
        : navStack[1].name === "Mutation"
          ? OperationTypeNode.MUTATION
          : OperationTypeNode.SUBSCRIPTION

    // Build the selections from inside out
    let currentSelection: FieldNode = {
      kind: Kind.FIELD,
      name: {
        kind: Kind.NAME,
        value: queryPath[queryPath.length - 1].name,
      },
      arguments: [],
      directives: [],
    }

    // Work backwards through the path (excluding the last item as we already processed it)
    for (let i = queryPath.length - 2; i >= 0; i--) {
      const item = queryPath[i]
      const arguments_: ArgumentNode[] = []

      // Add arguments if defined in the schema
      if (item.def?.args) {
        for (const arg of item.def.args) {
          // For this example, we'll add a dummy ID for teamID
          if (arg.name === "teamID") {
            arguments_.push({
              kind: Kind.ARGUMENT,
              name: {
                kind: Kind.NAME,
                value: arg.name,
              },
              value: {
                kind: Kind.STRING,
                value: "team123",
              },
            })
          }
        }
      }

      // Wrap the current selection in a new field
      currentSelection = {
        kind: Kind.FIELD,
        name: {
          kind: Kind.NAME,
          value: item.name,
        },
        arguments: arguments_,
        directives: [],
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [currentSelection],
        },
      }
    }

    // Create the final document
    const operation: OperationDefinitionNode = {
      kind: Kind.OPERATION_DEFINITION,
      operation: operationTypeNode,
      name: {
        kind: Kind.NAME,
        value: navStack[navStack.length - 1].name,
      },
      variableDefinitions: [],
      directives: [],
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [currentSelection],
      },
    }

    const document: DocumentNode = {
      kind: Kind.DOCUMENT,
      definitions: [operation],
    }

    return document
  }

  const handleAddField = (field: ExplorerFieldDef, addToNav = false) => {
    if (addToNav)
      push({
        name: field.name,
        def: field,
      })

    const currentTab = tabs.currentActiveTab.value
    if (!currentTab) return

    const currentQuery = currentTab.document.request.query || ""

    if (!currentQuery.trim()) {
      const q = buildQueryAst(navStack.value)
      const query = print(q)
      updatedQuery.value = query
      return
    }

    const selectedOperation = getSelectedOperation()
    console.log("selectedOperation", selectedOperation)

    // const newQuery = insertGraphQLField(currentQuery, field)

    // // Calculate cursor position - assuming we want to place it after the inserted field
    // const fieldNameIndex = newQuery.lastIndexOf(field.name)
    // if (fieldNameIndex !== -1) {
    //   cursorPosition.value = getCursorPositionFromIndex(
    //     newQuery,
    //     fieldNameIndex + field.name.length
    //   )
    // }

    // updatedQuery.value = query.query
  }

  const handleAddArgument = (arg: any) => {}

  return {
    handleAddField,
    handleAddArgument,
    updatedQuery,
    cursorPosition,
    operationDefinitions: operations,
  }
}
