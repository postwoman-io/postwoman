import { createApp } from 'vue'
import App from './App.vue'
import './index.css'

import { plugin as HoppUI } from "@hoppscotch/ui"

import "@hoppscotch/ui/themes.css"

import "@hoppscotch/ui/style.css"

createApp(App)
  .use(HoppUI)
  .mount('#app')
