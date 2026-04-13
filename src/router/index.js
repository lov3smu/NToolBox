import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
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
    path: '/template',
    name: 'Template',
    component: () => import('@/views/Template.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router