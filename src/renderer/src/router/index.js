import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/sql-generator',
    name: 'SqlGenerator',
    component: () => import('@/views/SqlScriptGenerator.vue')
  },
  {
    path: '/market',
    name: 'Market',
    component: () => import('@/views/Market.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue')
  },
  {
    path: '/password',
    name: 'Password',
    component: () => import('@/views/Password.vue')
  },
  {
    path: '/cron',
    name: 'Cron',
    component: () => import('@/views/Cron.vue')
  },
  {
    path: '/unixtimestamp',
    name: 'UnixTimestamp',
    component: () => import('@/views/UnixTimestamp.vue')
  },
  {
    path: '/yaml-editor',
    name: 'YamlEditor',
    component: () => import('@/views/YamlEditor.vue')
  },
  {
    path: '/file-manager',
    name: 'FileManager',
    component: () => import('@/views/FileManager.vue')
  },
  {
    path: '/markdown-editor',
    name: 'MarkdownEditor',
    component: () => import('@/views/Markdown.vue')
  },
  {
    path: '/wechat-formatter',
    name: 'WechatFormatter',
    component: () => import('@/views/WechatFormatter.vue')
  },
  {
    path: '/clipboard',
    name: 'Clipboard',
    component: () => import('@/views/Clipboard.vue')
  },
  {
    path: '/json-parser',
    name: 'JsonParser',
    component: () => import('@/views/JsonParser.vue')
  },
  {
    path: '/html-viewer',
    name: 'HtmlViewer',
    component: () => import('@/views/HtmlViewer.vue')
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('@/views/Chat.vue')
  },
  {
    path: '/database',
    name: 'Database',
    component: () => import('@/views/Database.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
