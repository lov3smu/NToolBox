import { ref } from 'vue'

const COLLAPSED_KEY = 'sidebar_collapsed'

export const sidebarCollapsed = ref(localStorage.getItem(COLLAPSED_KEY) === '1')

export function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem(COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
}

export function useSidebar() {
  return {
    collapsed: sidebarCollapsed,
    toggleSidebar
  }
}
