import { ref } from "vue"
import { listen } from "@tauri-apps/api/event"

import { createHoppApp } from "@hoppscotch/common"
import { def as environmentsDef } from "./platform/environments/environments.platform"
import { def as collectionsDef } from "./platform/collections/collections.platform"
import { def as settingsDef } from "./platform/settings/settings.platform"
import { stdFooterItems } from "@hoppscotch/common/platform/std/ui/footerItem"
import { stdSupportOptionItems } from "@hoppscotch/common/platform/std/ui/supportOptionsItem"
import { InfraPlatform } from "@platform/infra/infra.platform"
// import { proxyInterceptor } from "@hoppscotch/common/platform/std/interceptors/proxy"
// import { ExtensionInspectorService } from "@hoppscotch/common/platform/std/inspections/extension.inspector"
// import { ExtensionInterceptorService } from "@hoppscotch/common/platform/std/interceptors/extension"
// import { AgentInterceptorService } from "@hoppscotch/common/platform/std/interceptors/agent"
// import { browserIODef } from "@hoppscotch/common/platform/std/io"

import { KernelMode, getKernelMode } from "@hoppscotch/kernel"

import { kernelIO } from "@hoppscotch/common/platform/std/kernel-io"

import { NativeKernelInterceptorService } from "@hoppscotch/common/platform/std/kernel-interceptors/native"
import { AgentKernelInterceptorService } from "@hoppscotch/common/platform/std/kernel-interceptors/agent"
import { ProxyKernelInterceptorService } from "@hoppscotch/common/platform/std/kernel-interceptors/proxy"
import { ExtensionKernelInterceptorService } from "@hoppscotch/common/platform/std/kernel-interceptors/extension"
import { BrowserKernelInterceptorService } from "@hoppscotch/common/platform/std/kernel-interceptors/browser"

import { def as webAuth } from "@platform/auth/web"
import { def as desktopAuth } from "@platform/auth/desktop"

import { def as webHistory } from "@platform/history/web"

const kernelMode = getKernelMode()
const defaultInterceptor = kernelMode == "desktop" ? "native" : "browser"

const headerPaddingLeft = ref("0px")
const headerPaddingTop = ref("0px")

const MODE_INTERCEPTORS = {
  desktop: [
    NativeKernelInterceptorService,
    ProxyKernelInterceptorService],
  web: [
    BrowserKernelInterceptorService,
    ProxyKernelInterceptorService,
    AgentKernelInterceptorService,
    ExtensionKernelInterceptorService
  ],
} as const;

const getInterceptors = (mode: KernelMode) =>
  MODE_INTERCEPTORS[mode].map(service => ({ type: "service" as const, service }));

const MODE_AUTHS = {
  desktop: [desktopAuth],
  web: [webAuth],
} as const

export const getAuths = (mode: KernelMode) => MODE_AUTHS[mode][0]

createHoppApp("#app", {
  ui: {
    additionalFooterMenuItems: stdFooterItems,
    additionalSupportOptionsMenuItems: stdSupportOptionItems,
    appHeader: {
      paddingLeft: headerPaddingLeft,
      paddingTop: headerPaddingTop,
    },
  },
  auth: getAuths(kernelMode),
  // NOTE: To be deprecated
  // io: browserIODef,
  kernelIO: kernelIO,
  sync: {
    environments: environmentsDef,
    collections: collectionsDef,
    settings: settingsDef,
    history: webHistory,
  },
  // NOTE: To be deprecated
  // interceptors: {
  //   default: "browser",
  //   interceptors: [
  //     { type: "standalone", interceptor: proxyInterceptor },
  //     { type: "service", service: ExtensionInterceptorService },
  //     { type: "service", service: AgentInterceptorService },
  //   ],
  // },
  kernelInterceptors: {
    default: defaultInterceptor,
    interceptors: getInterceptors(kernelMode),
  },
  // NOTE: To be deprecated
  // additionalInspectors: [
  //   { type: "service", service: ExtensionInspectorService },
  // ],
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
