import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import { refDebounced } from "@vueuse/core"
import { Service } from "dioc"
import { computed, markRaw, reactive } from "vue"
import { Component, Ref, ref, watch } from "vue"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { RESTTabService } from "../tab/rest"

/**
 * Defines how to render the text in an Inspector Result
 */
export type InspectorTextType<T extends object | Component = never> =
  | {
      type: "text"
      text: string[] | string
    }
  | {
      type: "custom"
      component: T
      componentProps: T extends Component<infer Props> ? Props : never
    }

export type InspectorLocation =
  | {
      type: "url"
    }
  | {
      type: "header"
      position: "key" | "value"
      key?: string
      index?: number
    }
  | {
      type: "parameter"
      position: "key" | "value"
      key?: string
      index?: number
    }
  | {
      type: "body"
      key: string
      index: number
    }
  | {
      type: "response"
    }

/**
 * Defines info about an inspector result so the UI can render it
 */
export interface InspectorResult {
  id: string
  text: InspectorTextType<any>
  icon: object | Component
  severity: number
  isApplicable: boolean
  action?: {
    text: string
    apply: () => void
  }
  doc: {
    text: string
    link: string
  }
  locations: InspectorLocation
}

/**
 * Defines the state of the inspector service
 */
export type InspectorState = {
  results: InspectorResult[]
}

/**
 * Defines an inspector that can be registered with the inspector service
 * Inspectors are used to perform checks on a request and return the results
 */
export interface Inspector {
  /**
   * The unique ID of the inspector
   */
  inspectorID: string
  /**
   * Returns the inspector results for the request.
   * NOTE: The refs passed down are readonly and are debounced to avoid performance issues
   * @param req The ref to the request to inspect
   * @param res The ref to the response to inspect
   * @returns The ref to the inspector results
   */
  getInspections: (
    req: Readonly<Ref<HoppRESTRequest | HoppRESTResponseOriginalRequest>>,
    res: Readonly<Ref<HoppRESTResponse | null | undefined>>
  ) => Ref<InspectorResult[]>
}

/**
 * Defines the inspection service
 * The service watches the current active tab and returns the inspector results for the request and response
 */
export class InspectionService extends Service {
  public static readonly ID = "INSPECTION_SERVICE"

  private inspectors: Map<string, Inspector> = reactive(new Map())

  private tabs: Ref<Map<string, InspectorResult[]>> = ref(new Map())

  private readonly restTab = this.bind(RESTTabService)

  override onServiceInit() {
    this.initializeListeners()
  }

  /**
   * Registers a inspector with the inspection service
   * @param inspector The inspector instance to register
   */
  public registerInspector(inspector: Inspector) {
    // markRaw is required here so that the inspector is not made reactive
    this.inspectors.set(inspector.inspectorID, markRaw(inspector))
  }

  private initializeListeners() {
    watch(
      () => [this.inspectors.entries(), this.restTab.currentActiveTab.value.id],
      () => {
        const currentTabRequest = computed(() =>
          this.restTab.currentActiveTab.value.document.type === "request"
            ? this.restTab.currentActiveTab.value.document.request
            : this.restTab.currentActiveTab.value.document.response
                .originalRequest
        )

        const currentTabResponse = computed(() =>
          this.restTab.currentActiveTab.value.document.type === "request"
            ? this.restTab.currentActiveTab.value.document.response
            : null
        )

        const reqRef = computed(() => currentTabRequest.value)
        const resRef = computed(() => currentTabResponse.value)

        const debouncedReq = refDebounced(reqRef, 1000, { maxWait: 2000 })
        const debouncedRes = refDebounced(resRef, 1000, { maxWait: 2000 })

        const inspectorRefs = Array.from(this.inspectors.values()).map((x) =>
          x.getInspections(debouncedReq, debouncedRes)
        )

        const activeInspections = computed(() =>
          inspectorRefs.flatMap((x) => x!.value)
        )

        watch(
          () => [...inspectorRefs.flatMap((x) => x!.value)],
          () => {
            this.tabs.value.set(
              this.restTab.currentActiveTab.value.id,
              activeInspections.value
            )
          },
          { immediate: true }
        )
      },
      { immediate: true, flush: "pre" }
    )
  }

  public deleteTabInspectorResult(tabID: string) {
    // TODO: Move Tabs into a service and implement this with an event instead
    this.tabs.value.delete(tabID)
  }

  /**
   * Returns a reactive view into the inspector results for a specific tab
   * @param tabID The ID of the tab to get the results for
   * @param filter The filter to apply to the results.
   * @returns The ref into the inspector results, if the tab doesn't exist, a ref into an empty array is returned
   */
  public getResultViewFor(
    tabID: string,
    filter: (x: InspectorResult) => boolean = () => true
  ) {
    return computed(() => this.tabs.value.get(tabID)?.filter(filter) ?? [])
  }
}
