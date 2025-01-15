import { useService } from "dioc/vue"
import {
  getNamedType,
  GraphQLField,
  GraphQLType,
  isObjectType,
  OperationDefinitionNode,
  parse,
  visit,
} from "graphql"
import { GQLTabService } from "~/services/tab/graphql"
import { mutationFields, queryFields, subscriptionFields } from "./connection"

export function useQuery() {
  const tabs = useService(GQLTabService)

  function insertGraphQLField(
    currentQuery = "",
    field: GraphQLField<any, any>
  ): string {
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

    // Check if the field has a complex type that needs nested selection
    if (
      fieldType.name !== "String" &&
      fieldType.name !== "Int" &&
      fieldType.name !== "Float" &&
      fieldType.name !== "Boolean"
    ) {
      return {
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
    }

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
    const fieldType = getNamedType(field.type)

    const argParts = field.args.length
      ? `(${field.args.map((arg) => `$${arg.name}: ${arg.type}`).join(", ")})`
      : ""

    const variableParts = field.args.length
      ? `(${field.args.map((arg) => `${arg.name}: $${arg.name}`).join(", ")})`
      : ""

    const fieldSelection = isObjectType(fieldType)
      ? `{\n  ${Object.values(fieldType.getFields())
          .map((subField: any) => subField.name)
          .join("\n  ")}\n}`
      : ""

    return `${operationType.toLowerCase()} ${operationName}${argParts} {
  ${field.name}${variableParts} ${fieldSelection}
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

  const handleAddField = (field: any) => {
    console.log("queryeditor", queryEditor.value)
    const currentTab = tabs.currentActiveTab.value
    if (!currentTab) return

    currentTab.document.request.query = insertGraphQLField(
      currentTab.document.request.query || "",
      field
    )
  }

  const handleAddArgument = (arg: any) => {
    const currentTab = tabs.currentActiveTab.value
    if (!currentTab) return

    currentTab.document.request.query = insertGraphQLField(
      currentTab.document.request.query || "",
      arg
    )
  }

  return {
    handleAddField,
    handleAddArgument,
  }
}
