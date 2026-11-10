<template>
  <div class="app-shell" :class="{ collapsed }">
    <AppTitleBar />

    <div class="app-body">
      <aside class="app-sidebar">
        <div class="sidebar-brand">
          <img :src="iconUrl" alt="NToolBox" class="sidebar-brand-logo" />
          <span class="sidebar-brand-name">NToolBox</span>
        </div>

        <nav class="nav-scroll">
          <div v-for="section in sections" :key="section.title" class="nav-section">
            <div class="nav-section-title">
              {{ section.title }}
            </div>
            <button
              v-for="tool in section.tools"
              :key="tool.path"
              type="button"
              class="nav-item"
              :class="{ active: isActive(tool) }"
              :title="toolTitle(tool)"
              @click="navigate(tool)"
            >
              <span class="nav-icon" v-html="tool.icon" />
              <span class="nav-label">{{ tool.name }}</span>
            </button>
          </div>
        </nav>

        <div class="sidebar-footer">
          <button
            v-for="tool in footerTools"
            :key="tool.path"
            type="button"
            class="nav-item"
            :class="{ active: isActive(tool) }"
            :title="tool.name"
            @click="navigate(tool)"
          >
            <span class="nav-icon" v-html="tool.icon" />
            <span class="nav-label">{{ tool.name }}</span>
          </button>
          <button type="button" class="nav-item" title="设置" @click="openSettings">
            <span class="nav-icon" v-html="settingsTool?.icon" />
            <span class="nav-label">设置</span>
          </button>
        </div>
      </aside>

      <div class="shell-main">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { openSettings as openSettingsWindow, platform } from '@/api'
import { SETTINGS_PATH, addToRecent, getToolsByMenuGroup, tools } from '@shared/tools'
import { useSidebar } from '@/composables/useSidebar'
import AppTitleBar from './AppTitleBar.vue'
import iconUrl from '@assets/icon.png'

const isMac = platform === 'darwin'

const route = useRoute()
const router = useRouter()
const { collapsed } = useSidebar()

const homeTool = tools.find((tool) => tool.path === '/')
const settingsTool = tools.find((tool) => tool.path === SETTINGS_PATH)
const footerTools = getToolsByMenuGroup('extensions')

const sections = computed(() => {
  const home = homeTool ? [homeTool] : []
  const fileTools = getToolsByMenuGroup('file').filter((tool) => tool.path !== '/')
  return [
    { title: '概览', tools: home },
    { title: '核心', tools: getToolsByMenuGroup('primary') },
    ...(fileTools.length ? [{ title: '文件', tools: fileTools }] : []),
    { title: '实用工具', tools: getToolsByMenuGroup('utilities') }
  ].filter((section) => section.tools.length > 0)
})

function isActive(tool) {
  return route.path === tool.path
}

function toolTitle(tool) {
  if (!tool.accelerator) return tool.name
  const label = isMac
    ? tool.accelerator.replace('CmdOrCtrl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥').replaceAll('+', '')
    : tool.accelerator.replace('CmdOrCtrl+', 'Ctrl+')
  return `${tool.name} · ${label}`
}

function navigate(tool) {
  addToRecent(tool)
  router.push(tool.path)
}

function openSettings() {
  openSettingsWindow()
}
</script>

<style scoped>
.app-shell {
  --sidebar-width: 232px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--app-bg);
}

.app-shell.collapsed {
  --sidebar-width: 84px;
}

.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.app-sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--shell-sidebar-bg);
  border-right: 1px solid var(--shell-border);
  color: var(--shell-text);
  transition: width var(--motion-slow) var(--motion-ease);
  overflow: hidden;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 24px;
  margin-bottom: 6px;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--shell-divider);
  color: var(--shell-text-strong);
  overflow: hidden;
}

.sidebar-brand-logo {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
  flex-shrink: 0;
  border-radius: 5px;
  object-fit: contain;
}

.sidebar-brand-name {
  font-size: var(--font-size-dense);
  font-weight: 650;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.nav-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.nav-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--shell-scrollbar) transparent;
}

.nav-scroll::-webkit-scrollbar {
  width: 6px;
}

.nav-scroll::-webkit-scrollbar-thumb {
  background: var(--shell-scrollbar);
  border-radius: 3px;
}

.nav-section + .nav-section {
  margin-top: 14px;
}

.nav-section-title {
  max-height: 32px;
  overflow: hidden;
  padding: 0 10px 6px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.6px;
  color: var(--shell-text-muted);
  white-space: nowrap;
  transition:
    opacity var(--motion-fast) var(--motion-ease),
    max-height var(--motion-fast) var(--motion-ease),
    padding var(--motion-fast) var(--motion-ease);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--font-size-base);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.nav-item:hover {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.nav-item.active {
  background: var(--shell-active-bg);
  color: var(--shell-active-text);
}

.nav-icon {
  display: inline-flex;
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  flex-shrink: 0;
}

.nav-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.nav-label {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    opacity var(--motion-fast) var(--motion-ease),
    transform var(--motion-fast) var(--motion-ease),
    max-width var(--motion-fast) var(--motion-ease);
}

.sidebar-footer {
  flex-shrink: 0;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--shell-divider);
}

.sidebar-footer .nav-item + .nav-item {
  margin-top: 2px;
}

.shell-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.app-shell.collapsed .app-sidebar {
  padding: 12px 4px;
}

.app-shell.collapsed .sidebar-brand {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}

.app-shell.collapsed .sidebar-brand-name {
  display: none;
}

.app-shell.collapsed .nav-section-title {
  max-height: 0;
  padding-bottom: 0;
  opacity: 0;
}

.app-shell.collapsed .nav-item .nav-label {
  max-width: 0;
  opacity: 0;
  transform: translateX(-4px);
  pointer-events: none;
}

.app-shell.collapsed .nav-item {
  justify-content: center;
  gap: 0;
  padding: 9px 0;
}

@media (max-width: 1000px) {
  .app-shell {
    --sidebar-width: 84px;
  }

  .app-sidebar {
    padding: 12px 4px;
  }

  .sidebar-brand {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }

  .sidebar-brand-name {
    display: none;
  }

  .nav-section-title {
    max-height: 0;
    padding-bottom: 0;
    opacity: 0;
  }

  .nav-item .nav-label {
    max-width: 0;
    opacity: 0;
    transform: translateX(-4px);
    pointer-events: none;
  }

  .nav-item {
    justify-content: center;
    gap: 0;
    padding: 9px 0;
  }
}
</style>
