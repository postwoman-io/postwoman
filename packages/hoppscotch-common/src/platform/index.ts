import { ServiceClassInstance } from "dioc"
import { Ref } from "vue"
import { HoppModule } from "~/modules"
import { AnalyticsPlatformDef } from "./analytics"
import { AuthPlatformDef } from "./auth"
import { CollectionsPlatformDef } from "./collections"
import { EnvironmentsPlatformDef } from "./environments"
import { ExperimentsPlatformDef } from "./experiments"
import { HistoryPlatformDef } from "./history"
import { InfraPlatformDef } from "./infra"
import { InspectorsPlatformDef } from "./inspectors"
import { InterceptorsPlatformDef } from "./interceptors"
import { IOPlatformDef } from "./io"
import { LimitsPlatformDef } from "./limits"
import { SettingsPlatformDef } from "./settings"
import { SpotlightPlatformDef } from "./spotlight"
import { UIPlatformDef } from "./ui"

export type PlatformDef = {
  ui?: UIPlatformDef
  addedHoppModules?: HoppModule[]
  addedServices?: Array<ServiceClassInstance<unknown>>
  auth: AuthPlatformDef
  analytics?: AnalyticsPlatformDef
  io: IOPlatformDef
  sync: {
    environments: EnvironmentsPlatformDef
    collections: CollectionsPlatformDef
    settings: SettingsPlatformDef
    history: HistoryPlatformDef
  }
  interceptors: InterceptorsPlatformDef
  additionalInspectors?: InspectorsPlatformDef
  spotlight?: SpotlightPlatformDef
  platformFeatureFlags: {
    exportAsGIST: boolean
    hasTelemetry: boolean

    /**
     *  Whether the platform supports cookies (affects whether the cookies footer item is shown)
     *  If a value is not given, then the value is assumed to be false
     */
    cookiesEnabled?: boolean

    /**
     * Whether the platform should prompt the user that cookies are being used.
     * This will result in the user being notified a cookies advisory and is meant for web apps.
     *
     * If a value is not given, then the value is assumed to be true
     */
    promptAsUsingCookies?: boolean

    /**
     * Whether to show the A/B testing workspace switcher click login flow or not
     */
    workspaceSwitcherLogin?: Ref<boolean>
  }
  limits?: LimitsPlatformDef
  infra?: InfraPlatformDef
  experiments?: ExperimentsPlatformDef
}

export let platform: PlatformDef

export function setPlatformDef(def: PlatformDef) {
  platform = def
}
