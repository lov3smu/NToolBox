import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import './styles/main.css'
import './styles/password.css'
import './styles/cron.css'
import { initTheme } from './utils/theme'

initTheme()

const app = createApp(App)
app.use(router)
app.mount('#app')
