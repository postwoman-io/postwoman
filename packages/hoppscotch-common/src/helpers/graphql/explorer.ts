import { ref, computed, h, VNode } from "vue"
import type {
  GraphQLSchema,
  GraphQLNamedType,
  GraphQLField,
  GraphQLInputField,
  GraphQLArgument,
  GraphQLType,
} from "graphql"
import {
  isNamedType,
  isObjectType,
  isInputObjectType,
  isScalarType,
  isEnumType,
  isInterfaceType,
  isUnionType,
  isNonNullType,
  isListType,
} from "graphql"

/**
 * Represents a field definition in the GraphQL explorer
 * Can be a field, input field, or argument
 */
export type ExplorerFieldDef =
  | GraphQLField<unknown, unknown, unknown>
  | GraphQLInputField
  | GraphQLArgument

/**
 * Represents a single item in the explorer navigation stack
 */
export type ExplorerNavStackItem = {
  name: string
  def?: GraphQLNamedType | ExplorerFieldDef
}

/**
 * Represents the complete navigation stack for the explorer
 * Must contain at least one item
 */
export type ExplorerNavStack = [ExplorerNavStackItem, ...ExplorerNavStackItem[]]

const initialNavStackItem: ExplorerNavStackItem = { name: "Root" }

const navStack = ref<ExplorerNavStack>([initialNavStackItem])
const schema = ref<GraphQLSchema | null>()
const validationErrors = ref<any[]>([])

/**
 * Hook to manage the GraphQL schema explorer state and navigation
 * @param initialSchema - Optional initial GraphQL schema
 * @returns Object containing explorer state and methods
 */
export function useExplorer(initialSchema?: GraphQLSchema) {
  schema.value = initialSchema ?? null

  const currentNavItem = computed(() => {
    const lastItem = navStack.value[navStack.value.length - 1]
    return lastItem
  })

  /**
   * Adds a new item to the navigation stack
   * @param item - The navigation stack item to add
   */
  function push(item: ExplorerNavStackItem) {
    const lastItem = navStack.value[navStack.value.length - 1]

    // Avoid pushing duplicate items
    if (lastItem.def === item.def) return

    navStack.value.push(item)
  }

  /**
   * Removes the last item from the navigation stack
   * Won't remove the root item
   */
  function pop() {
    if (navStack.value.length > 1) {
      navStack.value.pop()
    }
  }

  /**
   * Resets the navigation stack to initial state
   */
  function reset() {
    navStack.value =
      navStack.value.length === 1 ? navStack.value : [initialNavStackItem]
  }

  /**
   * Updates the schema and validation errors
   * Rebuilds the navigation stack if needed
   * @param newSchema - The new GraphQL schema
   * @param newValidationErrors - Array of validation errors
   */
  function updateSchema(
    newSchema: GraphQLSchema,
    newValidationErrors: any[] = []
  ) {
    schema.value = newSchema
    validationErrors.value = newValidationErrors

    // If schema is invalid, reset navigation
    if (!newSchema || newValidationErrors.length > 0) {
      reset()
      return
    }

    // Rebuild navigation stack with new schema
    rebuildNavStack()
  }

  /**
   * Navigates to a specific index in the navigation stack
   * @param index - Target index to navigate to
   */
  const navigateToIndex = (index: number) => {
    while (navStack.value.length > index + 1) {
      pop()
    }
  }

  /**
   * Rebuilds the navigation stack based on the current schema
   * Used when schema is updated to maintain valid navigation
   */
  function rebuildNavStack() {
    if (!schema.value) return

    const newNavStack: ExplorerNavStack = [initialNavStackItem]
    let lastEntity: GraphQLNamedType | GraphQLField<any, any, any> | null = null

    for (const item of navStack.value.slice(1)) {
      if (item.def) {
        if (isNamedType(item.def)) {
          const newType = schema.value.getType(item.def.name)
          if (newType) {
            newNavStack.push({
              name: item.name,
              def: newType,
            })
            lastEntity = newType
          } else {
            break
          }
        } else if (lastEntity === null) {
          break
        } else if (isObjectType(lastEntity) || isInputObjectType(lastEntity)) {
          const field = lastEntity.getFields()[item.name]
          if (field) {
            newNavStack.push({
              name: item.name,
              def: field,
            })
          } else {
            break
          }
        } else if (
          isScalarType(lastEntity) ||
          isEnumType(lastEntity) ||
          isInterfaceType(lastEntity) ||
          isUnionType(lastEntity)
        ) {
          break
        } else {
          const field: GraphQLField<any, any> = lastEntity
          const arg = field.args.find((a) => a.name === item.name)

          if (arg) {
            newNavStack.push({
              name: item.name,
              def: field,
            })
          } else {
            break
          }
        }
      } else {
        lastEntity = null
        newNavStack.push(item)
      }
    }

    navStack.value = newNavStack
  }

  return {
    navStack,
    currentNavItem,
    schema,
    validationErrors,
    push,
    pop,
    navigateToIndex,
    reset,
    updateSchema,
  }
}

/**
 * Recursively renders a GraphQL type as a Vue virtual node
 * Handles non-null types, list types, and named types
 *
 * @param type - The GraphQL type to render
 * @param renderNamedType - Function to render named types
 * @returns VNode representing the rendered type
 */
export function renderType(
  type: GraphQLType,
  renderNamedType: (namedType: GraphQLNamedType) => any
): VNode {
  if (isNonNullType(type)) {
    return h("span", {}, [renderType(type.ofType, renderNamedType), "!"])
  }
  if (isListType(type)) {
    return h("span", {}, ["[", renderType(type.ofType, renderNamedType), "]"])
  }
  return renderNamedType(type as GraphQLNamedType)
}
