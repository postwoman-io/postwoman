import { HOPP_MODULES } from "@modules/."
import { createApp } from "vue"
import { PlatformDef, setPlatformDef } from "./platform"
import { initKernel, getKernelMode } from "@hoppscotch/kernel"

import "../assets/scss/tailwind.scss"
import "../assets/themes/themes.scss"
import "../assets/scss/styles.scss"
import "nprogress/nprogress.css"

import "unfonts.css"

import App from "./App.vue"
import { getService } from "./modules/dioc"
import { InitializationService } from "./services/initialization.service"

export async function createHoppApp(
  el: string | Element,
  platformDef: PlatformDef
) {
  initKernel(getKernelMode())
  setPlatformDef(platformDef)

  const app = createApp(App)

  // Initialize core services before app mounting
  const initService = getService(InitializationService)

  await initService.initPre()

  try {
    await initService.initAuthAndSync()
  } catch {
    console.error(
      "Failed connecting to the backend, make sure the service is running and accessible on the network"
    )
  }

  HOPP_MODULES.forEach((mod) => mod.onVueAppInit?.(app))
  platformDef.addedHoppModules?.forEach((mod) => mod.onVueAppInit?.(app))

  app.mount(el)

  await initService.initPost()

  console.info(
    "%cWE ♥️ OPEN SOURCE",
    "margin:8px 0;font-family:sans-serif;font-weight:600;font-size:60px;color:violet;"
  )
  console.info(
    "%cContribute: https://github.com/hoppscotch/hoppscotch",
    "margin:8px 0;font-family:sans-serif;font-weight:500;font-size:24px;color:violet;"
  )
}
