import { createHoppAdminApp } from "@hoppscotch/sh-admin/main"
import { PluginsDef } from "@hoppscotch/sh-admin/plugins"
import Move from "./components/learn/Move.vue"
import Move2 from "./components/learn/Move2.vue"
import "./style.css"

const registeredComponents: PluginsDef = {
  ui: {
    additionalConfigurationsItems: [Move, Move2],
    additionalMetricItems: [Move2],
  },
}

createHoppAdminApp("#app", registeredComponents)
