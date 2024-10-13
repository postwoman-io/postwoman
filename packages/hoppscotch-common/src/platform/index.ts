import { AuthPlatformDef } from "./auth"
import { UIPlatformDef } from "./ui"
import { EnvironmentsPlatformDef } from "./environments"
import { CollectionsPlatformDef } from "./collections"
import { SettingsPlatformDef } from "./settings"
import { HistoryPlatformDef } from "./history"
import { AnalyticsPlatformDef } from "./analytics"
import { InterceptorsPlatformDef } from "./interceptors"
import { HoppModule } from "~/modules"
import { InspectorsPlatformDef } from "./inspectors"
import { ServiceClassInstance } from "dioc"
import { IOPlatformDef } from "./io"
import { SpotlightPlatformDef } from "./spotlight"
import { InfraPlatformDef } from "./infra"
import { ExperimentsPlatformDef } from "./experiments"
import { Ref } from "vue"

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
  infra?: InfraPlatformDef
  experiments?: ExperimentsPlatformDef
}

export let platform: PlatformDef

export function setPlatformDef(def: PlatformDef) {
  platform = def
}
