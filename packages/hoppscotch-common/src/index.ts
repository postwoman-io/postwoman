import { HOPP_MODULES } from "@modules/."
import { createApp } from "vue"
import { initializeApp } from "./helpers/app"
import { initBackendGQLClient } from "./helpers/backend/GQLClient"
import { performMigrations } from "./helpers/migrations"
import { PlatformDef, setPlatformDef } from "./platform"
import { initKernel, getKernelMode } from "@hoppscotch/kernel"

import "../assets/scss/tailwind.scss"
import "../assets/themes/themes.scss"
import "../assets/scss/styles.scss"
import "nprogress/nprogress.css"

import "unfonts.css"

import App from "./App.vue"
import { getService } from "./modules/dioc"
import { PersistenceService } from "./services/persistence"

export function createHoppApp(el: string | Element, platformDef: PlatformDef) {
  initKernel(getKernelMode())
  // initKernel("desktop")
  setPlatformDef(platformDef)

  const app = createApp(App)

  // Some basic work that needs to be done before module inits even
  initBackendGQLClient()
  initializeApp()

  HOPP_MODULES.forEach((mod) => mod.onVueAppInit?.(app))
  platformDef.addedHoppModules?.forEach((mod) => mod.onVueAppInit?.(app))

  // TODO: Explore possibilities of moving this invocation to the service constructor
  // `toast` was coming up as `null` in the previous attempts
  getService(PersistenceService).setupLocalPersistence()
  performMigrations()

  app.mount(el)

  console.info(
    "%cWE ♥️ OPEN SOURCE",
    "margin:8px 0;font-family:sans-serif;font-weight:600;font-size:60px;color:violet;"
  )
  console.info(
    "%cContribute: https://github.com/hoppscotch/hoppscotch",
    "margin:8px 0;font-family:sans-serif;font-weight:500;font-size:24px;color:violet;"
  )
}
