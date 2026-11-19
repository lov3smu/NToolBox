import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import './styles/main.css'
import './styles/password.css'
import './styles/cron.css'
import { initTheme } from './utils/theme'
import { initLocale } from './i18n'
import { clampViewportDirective } from './utils/clampViewport'

initTheme()
initLocale()

const app = createApp(App)
app.directive('clamp-viewport', clampViewportDirective)
app.use(router)
app.mount('#app')
