import { getI18n } from "~/modules/i18n"
import {
  InspectionService,
  Inspector,
  InspectorLocation,
  InspectorResult,
} from ".."
import { Service } from "dioc"
import { Ref, markRaw } from "vue"
import IconPlusCircle from "~icons/lucide/plus-circle"
import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import {
  AggregateEnvironment,
  aggregateEnvsWithSecrets$,
  getCurrentEnvironment,
  getSelectedEnvironmentType,
} from "~/newstore/environments"
import { invokeAction } from "~/helpers/actions"
import { computed } from "vue"
import { useStreamStatic } from "~/composables/stream"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import { RESTTabService } from "~/services/tab/rest"

const HOPP_ENVIRONMENT_REGEX = /(<<[a-zA-Z0-9-_]+>>)/g

const isENVInString = (str: string) => {
  return HOPP_ENVIRONMENT_REGEX.test(str)
}

/**
 * This inspector is responsible for inspecting the environment variables of a input.
 * It checks if the environment variables are defined in the environment.
 * It also provides an action to add the environment variable.
 *
 * NOTE: Initializing this service registers it as a inspector with the Inspection Service.
 */
export class EnvironmentInspectorService extends Service implements Inspector {
  public static readonly ID = "ENVIRONMENT_INSPECTOR_SERVICE"

  private t = getI18n()

  public readonly inspectorID = "environment"

  private readonly inspection = this.bind(InspectionService)
  private readonly secretEnvs = this.bind(SecretEnvironmentService)
  private readonly restTabs = this.bind(RESTTabService)

  private aggregateEnvsWithSecrets = useStreamStatic(
    aggregateEnvsWithSecrets$,
    [],
    () => {
      /* noop */
    }
  )[0]

  override onServiceInit() {
    this.inspection.registerInspector(this)
  }

  /**
   * Validates the environment variables in the target array
   * @param target The target array to validate
   * @param locations The location where results are to be displayed
   * @returns The results array containing the results of the validation
   */
  private validateEnvironmentVariables = (
    target: any[],
    locations: InspectorLocation
  ) => {
    const newErrors: InspectorResult[] = []

    const currentTab = this.restTabs.currentActiveTab.value

    const currentTabRequest =
      currentTab.document.type === "request"
        ? currentTab.document.request
        : currentTab.document.response.originalRequest

    const environmentVariables = [
      ...currentTabRequest.requestVariables,
      ...this.aggregateEnvsWithSecrets.value,
    ]

    const envKeys = environmentVariables.map((e) => e.key)

    target.forEach((element, index) => {
      if (isENVInString(element)) {
        const extractedEnv = element.match(HOPP_ENVIRONMENT_REGEX)

        if (extractedEnv) {
          extractedEnv.forEach((exEnv: string) => {
            const formattedExEnv = exEnv.slice(2, -2)
            const itemLocation: InspectorLocation = {
              type: locations.type,
              position:
                locations.type === "url" ||
                locations.type === "body" ||
                locations.type === "response"
                  ? "key"
                  : locations.position,
              index: index,
              key: element,
            }
            if (!envKeys.includes(formattedExEnv)) {
              newErrors.push({
                id: `environment-not-found-${newErrors.length}`,
                text: {
                  type: "text",
                  text: this.t("inspections.environment.not_found", {
                    environment: exEnv,
                  }),
                },
                icon: markRaw(IconPlusCircle),
                action: {
                  text: this.t("inspections.environment.add_environment"),
                  apply: () => {
                    invokeAction("modals.environment.add", {
                      envName: formattedExEnv,
                      variableName: "",
                    })
                  },
                },
                severity: 3,
                isApplicable: true,
                locations: itemLocation,
                doc: {
                  text: this.t("action.learn_more"),
                  link: "https://docs.hoppscotch.io/documentation/features/inspections",
                },
              })
            }
          })
        }
      }
    })

    return newErrors
  }

  /**
   * Transforms the environment list to a list with unique keys with value
   * @param envs The environment list to be transformed
   * @returns The transformed environment list with keys with value
   */
  private filterNonEmptyEnvironmentVariables = (
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

  /**
   * Checks if the environment variables in the target array are empty
   * @param target The target array to validate
   * @param locations The location where results are to be displayed
   * @returns The results array containing the results of the validation
   */
  private validateEmptyEnvironmentVariables = (
    target: any[],
    locations: InspectorLocation
  ) => {
    const newErrors: InspectorResult[] = []

    target.forEach((element, index) => {
      if (isENVInString(element)) {
        const extractedEnv = element.match(HOPP_ENVIRONMENT_REGEX)

        if (extractedEnv) {
          extractedEnv.forEach((exEnv: string) => {
            const formattedExEnv = exEnv.slice(2, -2)
            const currentSelectedEnvironment = getCurrentEnvironment()

            const currentTab = this.restTabs.currentActiveTab.value

            const currentTabRequest =
              currentTab.document.type === "request"
                ? currentTab.document.request
                : currentTab.document.response.originalRequest

            const environmentVariables =
              this.filterNonEmptyEnvironmentVariables([
                ...currentTabRequest.requestVariables.map((env) => ({
                  ...env,
                  secret: false,
                  sourceEnv: "RequestVariable",
                })),
                ...this.aggregateEnvsWithSecrets.value,
              ])

            environmentVariables.forEach((env) => {
              const hasSecretEnv = this.secretEnvs.hasSecretValue(
                env.sourceEnv !== "Global"
                  ? currentSelectedEnvironment.id
                  : "Global",
                env.key
              )

              if (env.key === formattedExEnv) {
                if (env.secret ? !hasSecretEnv : env.value === "") {
                  const itemLocation: InspectorLocation = {
                    type: locations.type,
                    position:
                      locations.type === "url" ||
                      locations.type === "body" ||
                      locations.type === "response"
                        ? "key"
                        : locations.position,
                    index: index,
                    key: element,
                  }

                  const currentEnvironmentType = getSelectedEnvironmentType()

                  let invokeActionType:
                    | "modals.my.environment.edit"
                    | "modals.team.environment.edit"
                    | "modals.global.environment.update" =
                    "modals.my.environment.edit"

                  if (env.sourceEnv === "Global") {
                    invokeActionType = "modals.global.environment.update"
                  } else if (currentEnvironmentType === "MY_ENV") {
                    invokeActionType = "modals.my.environment.edit"
                  } else if (currentEnvironmentType === "TEAM_ENV") {
                    invokeActionType = "modals.team.environment.edit"
                  } else {
                    invokeActionType = "modals.my.environment.edit"
                  }

                  newErrors.push({
                    id: `environment-empty-${newErrors.length}`,
                    text: {
                      type: "text",
                      text: this.t("inspections.environment.empty_value", {
                        variable: exEnv,
                      }),
                    },
                    icon: markRaw(IconPlusCircle),
                    action: {
                      text: this.t(
                        "inspections.environment.add_environment_value"
                      ),
                      apply: () => {
                        if (
                          env.sourceEnv === "RequestVariable" &&
                          currentTab.document.type === "request"
                        ) {
                          currentTab.document.optionTabPreference =
                            "requestVariables"
                        } else {
                          invokeAction(invokeActionType, {
                            envName:
                              env.sourceEnv === "Global"
                                ? "Global"
                                : currentSelectedEnvironment.name,
                            variableName: formattedExEnv,
                            isSecret: env.secret,
                          })
                        }
                      },
                    },
                    severity: 2,
                    isApplicable: true,
                    locations: itemLocation,
                    doc: {
                      text: this.t("action.learn_more"),
                      link: "https://docs.hoppscotch.io/documentation/features/inspections",
                    },
                  })
                }
              }
            })
          })
        }
      }
    })

    return newErrors
  }

  getInspections(
    req: Readonly<Ref<HoppRESTRequest | HoppRESTResponseOriginalRequest>>
  ) {
    return computed(() => {
      const results: InspectorResult[] = []

      const headers = req.value.headers

      const params = req.value.params

      /**
       * Validate the environment variables in the URL
       */
      const url = req.value.endpoint

      results.push(
        ...this.validateEnvironmentVariables([url], {
          type: "url",
        })
      )
      results.push(
        ...this.validateEmptyEnvironmentVariables([url], {
          type: "url",
        })
      )

      /**
       * Validate the environment variables in the headers
       */
      const headerKeys = Object.values(headers).map((header) => header.key)

      results.push(
        ...this.validateEnvironmentVariables(headerKeys, {
          type: "header",
          position: "key",
        })
      )
      results.push(
        ...this.validateEmptyEnvironmentVariables(headerKeys, {
          type: "header",
          position: "key",
        })
      )

      const headerValues = Object.values(headers).map((header) => header.value)

      results.push(
        ...this.validateEnvironmentVariables(headerValues, {
          type: "header",
          position: "value",
        })
      )
      results.push(
        ...this.validateEmptyEnvironmentVariables(headerValues, {
          type: "header",
          position: "value",
        })
      )

      /**
       * Validate the environment variables in the parameters
       */
      const paramsKeys = Object.values(params).map((param) => param.key)

      results.push(
        ...this.validateEnvironmentVariables(paramsKeys, {
          type: "parameter",
          position: "key",
        })
      )
      results.push(
        ...this.validateEmptyEnvironmentVariables(paramsKeys, {
          type: "parameter",
          position: "key",
        })
      )

      const paramsValues = Object.values(params).map((param) => param.value)

      results.push(
        ...this.validateEnvironmentVariables(paramsValues, {
          type: "parameter",
          position: "value",
        })
      )

      results.push(
        ...this.validateEmptyEnvironmentVariables(paramsValues, {
          type: "parameter",
          position: "value",
        })
      )

      return results
    })
  }
}
