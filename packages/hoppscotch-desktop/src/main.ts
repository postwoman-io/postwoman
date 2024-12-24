import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"

import '@hoppscotch/ui/style.css'
import './assets/scss/styles.scss'
import './assets/scss/tailwind.scss'
import '@fontsource-variable/inter'
import '@fontsource-variable/material-symbols-rounded'
import '@fontsource-variable/roboto-mono'

const app = createApp(App)
app.use(router)
app.mount('#app')
