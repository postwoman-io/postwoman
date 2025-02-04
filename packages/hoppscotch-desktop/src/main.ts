import { createApp } from "vue";
import { createRouter, createWebHistory } from 'vue-router'

import App from "./App.vue";

import '@hoppscotch/ui/style.css';
import './assets/scss/styles.scss';
import './assets/scss/tailwind.scss';
import '@fontsource-variable/inter';
import '@fontsource-variable/material-symbols-rounded';
import '@fontsource-variable/roboto-mono';

const app = createApp(App)
app.use(createRouter({
    history: createWebHistory(),
    routes: []
}))
app.mount('#app')
