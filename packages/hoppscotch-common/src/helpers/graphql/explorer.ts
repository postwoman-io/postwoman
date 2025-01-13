import { ref, computed } from "vue"
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

export type ExplorerFieldDef =
  | GraphQLField<unknown, unknown, unknown>
  | GraphQLInputField
  | GraphQLArgument

export type ExplorerNavStackItem = {
  name: string
  def?: GraphQLNamedType | ExplorerFieldDef
}

export type ExplorerNavStack = [ExplorerNavStackItem, ...ExplorerNavStackItem[]]

const initialNavStackItem: ExplorerNavStackItem = { name: "Docs" }

const navStack = ref<ExplorerNavStack>([initialNavStackItem])
const schema = ref<GraphQLSchema | null>()
const validationErrors = ref<any[]>([])
export function useExplorer(initialSchema?: GraphQLSchema) {
  schema.value = initialSchema ?? null

  const currentNavItem = computed(() => {
    const lastItem = navStack.value[navStack.value.length - 1]
    console.log("currentNavItem", lastItem)
    return lastItem
  })

  function push(item: ExplorerNavStackItem) {
    console.log("pushing", item)
    const lastItem = navStack.value[navStack.value.length - 1]

    // Avoid pushing duplicate items
    if (lastItem.def === item.def) return

    navStack.value.push(item)

    console.log("navStack", navStack.value)
  }

  function pop() {
    if (navStack.value.length > 1) {
      navStack.value.pop()
    }
  }

  function reset() {
    navStack.value =
      navStack.value.length === 1 ? navStack.value : [initialNavStackItem]
  }

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
    reset,
    updateSchema,
  }
}

export function renderType(
  type: GraphQLType,
  renderNamedType: (namedType: GraphQLNamedType) => string
): string {
  if (isNonNullType(type)) {
    return `${renderType(type.ofType, renderNamedType)}!`
  }
  if (isListType(type)) {
    return `[${renderType(type.ofType, renderNamedType)}]`
  }
  return renderNamedType(type)
}
