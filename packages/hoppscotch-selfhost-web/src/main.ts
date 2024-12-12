import { ref } from "vue"
import { listen } from '@tauri-apps/api/event'

import { createHoppApp } from "@hoppscotch/common"
import { def as authDef } from "./platform/auth/auth.platform"
import { def as environmentsDef } from "./platform/environments/environments.platform"
import { def as collectionsDef } from "./platform/collections/collections.platform"
import { def as settingsDef } from "./platform/settings/settings.platform"
import { def as historyDef } from "./platform/history/history.platform"
import { proxyInterceptor } from "@hoppscotch/common/platform/std/interceptors/proxy"
import { ExtensionInspectorService } from "@hoppscotch/common/platform/std/inspections/extension.inspector"
import { ExtensionInterceptorService } from "@hoppscotch/common/platform/std/interceptors/extension"
import { AgentInterceptorService } from "@hoppscotch/common/platform/std/interceptors/agent"
import { stdFooterItems } from "@hoppscotch/common/platform/std/ui/footerItem"
import { stdSupportOptionItems } from "@hoppscotch/common/platform/std/ui/supportOptionsItem"
import { browserIODef } from "@hoppscotch/common/platform/std/io"
import { InfraPlatform } from "@platform/infra/infra.platform"

import { getKernelMode } from "@hoppscotch/kernel"
import { NativeKernelInterceptorService } from "@hoppscotch/common/platform/std/kernel-interceptors/native"
import { ProxyKernelInterceptorService } from "@hoppscotch/common/platform/std/kernel-interceptors/proxy"
import { kernelIO } from "@hoppscotch/common/platform/std/kernel-io"

const kernelMode = getKernelMode();
const defaultInterceptor = kernelMode == "desktop" ? "native" : "browser";
const headerPaddingLeft = ref("0px")
const headerPaddingTop = ref("0px")

createHoppApp("#app", {
  ui: {
    additionalFooterMenuItems: stdFooterItems,
    additionalSupportOptionsMenuItems: stdSupportOptionItems,
    appHeader: {
      paddingLeft: headerPaddingLeft,
      paddingTop: headerPaddingTop,
    }
  },
  auth: authDef,
  // NOTE: To be deprecated
  io: browserIODef,
  kernelIO: kernelIO,
  sync: {
    environments: environmentsDef,
    collections: collectionsDef,
    settings: settingsDef,
    history: historyDef,
  },
  // NOTE: To be deprecated
  interceptors: {
    default: "browser",
    interceptors: [
      { type: "standalone", interceptor: proxyInterceptor },
      { type: "service", service: ExtensionInterceptorService },
      { type: "service", service: AgentInterceptorService },
    ],
  },
  kernelInterceptors: {
    default: defaultInterceptor,
    interceptors: [
      { type: "service", service: NativeKernelInterceptorService },
      { type: "service", service: ProxyKernelInterceptorService },
    ],
  },
  additionalInspectors: [
    { type: "service", service: ExtensionInspectorService },
  ],
  platformFeatureFlags: {
    exportAsGIST: false,
    hasTelemetry: false,
  },
  limits: {
    collectionImportSizeLimit: 50,
  },
  infra: InfraPlatform,
})

if (kernelMode === "desktop") {
  listen("will-enter-fullscreen", () => {
    headerPaddingTop.value = "0px"
    headerPaddingLeft.value = "0px"
  })

  listen("will-exit-fullscreen", () => {
    headerPaddingTop.value = "2px"
    headerPaddingLeft.value = "70px"
  })

  headerPaddingTop.value = "2px"
  headerPaddingLeft.value = "70px"
}
