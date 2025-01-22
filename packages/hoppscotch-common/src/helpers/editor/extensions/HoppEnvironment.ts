import { Compartment } from "@codemirror/state"
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  hoverTooltip,
} from "@codemirror/view"
import { StreamSubscriberFunc } from "@composables/stream"
import { parseTemplateStringE } from "@hoppscotch/data"
import * as E from "fp-ts/Either"
import { Ref, watch } from "vue"

import { invokeAction } from "~/helpers/actions"
import { getService } from "~/modules/dioc"
import {
  AggregateEnvironment,
  aggregateEnvsWithSecrets$,
  getAggregateEnvs,
  getCurrentEnvironment,
  getSelectedEnvironmentType,
} from "~/newstore/environments"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import { RESTTabService } from "~/services/tab/rest"
import IconEdit from "~icons/lucide/edit?raw"
import IconUser from "~icons/lucide/user?raw"
import IconUsers from "~icons/lucide/users?raw"
import { isComment } from "./helpers"

const HOPP_ENVIRONMENT_REGEX = /(<<[a-zA-Z0-9-_]+>>)/g

const HOPP_ENV_HIGHLIGHT =
  "cursor-help transition rounded px-1 focus:outline-none mx-0.5 env-highlight"

const HOPP_REQUEST_VARIABLE_HIGHLIGHT = "request-variable-highlight"
const HOPP_ENVIRONMENT_HIGHLIGHT = "environment-variable-highlight"
const HOPP_GLOBAL_ENVIRONMENT_HIGHLIGHT = "global-variable-highlight"
const HOPP_ENV_HIGHLIGHT_NOT_FOUND = "environment-not-found-highlight"

const secretEnvironmentService = getService(SecretEnvironmentService)
const restTabs = getService(RESTTabService)

/**
 * Transforms the environment list to a list with unique keys with value
 * @param envs The environment list to be transformed
 * @returns The transformed environment list with keys with value
 */
const filterNonEmptyEnvironmentVariables = (
  envs: AggregateEnvironment[]
): AggregateEnvironment[] => {
  const envsMap = new Map<string, AggregateEnvironment>()

  envs.forEach((env) => {
    if (envsMap.has(env.key)) {
      const existingEnv = envsMap.get(env.key)

      if (existingEnv?.value === "" && env.value !== "") {
        envsMap.set(env.key, env)
      }
    } else {
      envsMap.set(env.key, env)
    }
  })

  return Array.from(envsMap.values())
}

const cursorTooltipField = (aggregateEnvs: AggregateEnvironment[]) =>
  hoverTooltip(
    (view, pos, side) => {
      // Check if the current position is inside a comment then disable the tooltip
      if (isComment(view.state, pos)) {
        return null
      }
      const { from, to, text } = view.state.doc.lineAt(pos)

      // TODO: When Codemirror 6 allows this to work (not make the
      // popups appear half of the time) use this implementation
      // const wordSelection = view.state.wordAt(pos)
      // if (!wordSelection) return null
      // const word = view.state.doc.sliceString(
      //   wordSelection.from - 2,
      //   wordSelection.to + 2
      // )
      // if (!HOPP_ENVIRONMENT_REGEX.test(word)) return null

      // Tracking the start and the end of the words
      let start = pos
      let end = pos

      while (start > from && /[a-zA-Z0-9-_]+/.test(text[start - from - 1]))
        start--
      while (end < to && /[a-zA-Z0-9-_]+/.test(text[end - from])) end++

      if (
        (start === pos && side < 0) ||
        (end === pos && side > 0) ||
        !HOPP_ENVIRONMENT_REGEX.test(
          text.slice(start - from - 2, end - from + 2)
        )
      )
        return null

      const parsedEnvKey = text.slice(start - from, end - from)

      const envsWithNoEmptyValues =
        filterNonEmptyEnvironmentVariables(aggregateEnvs)

      const tooltipEnv = envsWithNoEmptyValues.find(
        (env) => env.key === parsedEnvKey
      )

      const envName = tooltipEnv?.sourceEnv ?? "Choose an Environment"

      let envValue = "Not Found"

      const currentSelectedEnvironment = getCurrentEnvironment()

      const hasSecretEnv = secretEnvironmentService.hasSecretValue(
        tooltipEnv?.sourceEnv !== "Global"
          ? currentSelectedEnvironment.id
          : "Global",
        tooltipEnv?.key ?? ""
      )

      if (!tooltipEnv?.secret && tooltipEnv?.value) envValue = tooltipEnv.value
      else if (tooltipEnv?.secret && hasSecretEnv) {
        envValue = "******"
      } else if (tooltipEnv?.secret && !hasSecretEnv) {
        envValue = "Empty"
      } else if (!tooltipEnv?.sourceEnv) {
        envValue = "Not Found"
      } else if (!tooltipEnv?.value) {
        envValue = "Empty"
      }

      const result = parseTemplateStringE(envValue, aggregateEnvs)

      let finalEnv = E.isLeft(result) ? "error" : result.right

      // If the request variable has an secret variable
      // parseTemplateStringE is passed the secret value which has value undefined
      // So, we need to check if the result is undefined and then set the finalEnv to ******
      if (finalEnv === "undefined") finalEnv = "******"

      const selectedEnvType = getSelectedEnvironmentType()

      const envTypeIcon = `<span class="inline-flex items-center justify-center my-1">${
        selectedEnvType === "TEAM_ENV" ? IconUsers : IconUser
      }</span>`

      const appendEditAction = (tooltip: HTMLElement) => {
        const editIcon = document.createElement("button")
        editIcon.className =
          "ml-2 cursor-pointer text-accent hover:text-accentDark"
        editIcon.addEventListener("click", () => {
          let invokeActionType:
            | "modals.my.environment.edit"
            | "modals.team.environment.edit"
            | "modals.global.environment.update" = "modals.my.environment.edit"

          if (tooltipEnv?.sourceEnv === "Global") {
            invokeActionType = "modals.global.environment.update"
          } else if (selectedEnvType === "MY_ENV") {
            invokeActionType = "modals.my.environment.edit"
          } else if (selectedEnvType === "TEAM_ENV") {
            invokeActionType = "modals.team.environment.edit"
          } else {
            invokeActionType = "modals.my.environment.edit"
          }

          if (
            tooltipEnv?.sourceEnv === "RequestVariable" &&
            restTabs.currentActiveTab.value.document.type === "request"
          ) {
            restTabs.currentActiveTab.value.document.optionTabPreference =
              "requestVariables"
          } else {
            invokeAction(invokeActionType, {
              envName: tooltipEnv?.sourceEnv === "Global" ? "Global" : envName,
              variableName: parsedEnvKey,
              isSecret: tooltipEnv?.secret,
            })
          }
        })
        editIcon.innerHTML = `<span class="inline-flex items-center justify-center my-1">${IconEdit}</span>`
        tooltip.appendChild(editIcon)
      }

      return {
        pos: start,
        end: to,
        above: true,
        arrow: true,
        create() {
          const dom = document.createElement("span")
          const tooltipContainer = document.createElement("span")
          const kbd = document.createElement("kbd")
          const icon = document.createElement("span")
          icon.innerHTML = envTypeIcon
          icon.className = "mr-2"
          kbd.textContent = finalEnv
          tooltipContainer.appendChild(icon)
          tooltipContainer.appendChild(document.createTextNode(`${envName} `))
          tooltipContainer.appendChild(kbd)
          if (tooltipEnv) appendEditAction(tooltipContainer)
          tooltipContainer.className = "tippy-content"
          dom.className = "tippy-box"
          dom.dataset.theme = "tooltip"
          dom.appendChild(tooltipContainer)
          return { dom }
        },
      }
    },
    // HACK: This is a hack to fix hover tooltip not coming half of the time
    // https://github.com/codemirror/tooltip/blob/765c463fc1d5afcc3ec93cee47d72606bed27e1d/src/tooltip.ts#L622
    // Still doesn't fix the not showing up some of the time issue, but this is atleast more consistent
    { hoverTime: 1 } as any
  )

function checkEnv(env: string, aggregateEnvs: AggregateEnvironment[]) {
  let className = HOPP_ENV_HIGHLIGHT_NOT_FOUND

  const envSource = aggregateEnvs.find(
    (k: { key: string }) => k.key === env.slice(2, -2)
  )?.sourceEnv

  if (envSource === "RequestVariable")
    className = HOPP_REQUEST_VARIABLE_HIGHLIGHT
  else if (envSource === "Global") className = HOPP_GLOBAL_ENVIRONMENT_HIGHLIGHT
  else if (envSource !== undefined) className = HOPP_ENVIRONMENT_HIGHLIGHT

  return Decoration.mark({
    class: `${HOPP_ENV_HIGHLIGHT} ${className}`,
  })
}

const getMatchDecorator = (aggregateEnvs: AggregateEnvironment[]) =>
  new MatchDecorator({
    regexp: HOPP_ENVIRONMENT_REGEX,
    decoration: (m, view, pos) => {
      // Check if the current position is inside a comment then disable the highlight
      if (isComment(view.state, pos)) {
        return null
      }
      return checkEnv(m[0], aggregateEnvs)
    },
  })

export const environmentHighlightStyle = (
  aggregateEnvs: AggregateEnvironment[]
) => {
  const envsWithNoEmptyValues =
    filterNonEmptyEnvironmentVariables(aggregateEnvs)

  const decorator = getMatchDecorator(envsWithNoEmptyValues)

  return ViewPlugin.define(
    (view) => ({
      decorations: decorator.createDeco(view),
      update(u) {
        this.decorations = decorator.updateDeco(u, this.decorations)
      },
    }),
    {
      decorations: (v) => v.decorations,
    }
  )
}

export class HoppEnvironmentPlugin {
  private compartment = new Compartment()

  private envs: AggregateEnvironment[] = []

  constructor(
    subscribeToStream: StreamSubscriberFunc,
    private editorView: Ref<EditorView | undefined>
  ) {
    const aggregateEnvs = getAggregateEnvs()
    const currentTab = restTabs.currentActiveTab.value

    const currentTabRequest =
      currentTab.document.type === "example-response"
        ? currentTab.document.response.originalRequest
        : currentTab.document.request

    watch(
      currentTabRequest,
      (request) => {
        const requestVariables = request?.requestVariables
          ? request.requestVariables
          : []

        this.envs = [
          ...requestVariables.map(({ key, value }) => ({
            key,
            value,
            sourceEnv: "RequestVariable",
            secret: false,
          })),
          ...aggregateEnvs,
        ]

        this.editorView.value?.dispatch({
          effects: this.compartment.reconfigure([
            cursorTooltipField(this.envs),
            environmentHighlightStyle(this.envs),
          ]),
        })
      },
      { immediate: true, deep: true }
    )

    const requestVariables = currentTabRequest?.requestVariables ?? []

    subscribeToStream(aggregateEnvsWithSecrets$, (envs) => {
      this.envs = [
        ...requestVariables.map(({ key, value }) => ({
          key,
          value,
          sourceEnv: "RequestVariable",
          secret: false,
        })),
        ...envs,
      ]

      this.editorView.value?.dispatch({
        effects: this.compartment.reconfigure([
          cursorTooltipField(this.envs),
          environmentHighlightStyle(this.envs),
        ]),
      })
    })
  }

  get extension() {
    return this.compartment.of([
      cursorTooltipField(this.envs),
      environmentHighlightStyle(this.envs),
    ])
  }
}

export class HoppReactiveEnvPlugin {
  private compartment = new Compartment()

  private envs: AggregateEnvironment[] = []

  constructor(
    envsRef: Ref<AggregateEnvironment[]>,
    private editorView: Ref<EditorView | undefined>
  ) {
    watch(
      envsRef,
      (envs) => {
        this.envs = envs

        this.editorView.value?.dispatch({
          effects: this.compartment.reconfigure([
            cursorTooltipField(this.envs),
            environmentHighlightStyle(this.envs),
          ]),
        })
      },
      { immediate: true, deep: true }
    )
  }

  get extension() {
    return this.compartment.of([
      cursorTooltipField(this.envs),
      environmentHighlightStyle(this.envs),
    ])
  }
}
