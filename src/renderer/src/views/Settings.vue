<template>
  <div
    class="settings-layout"
    :class="{ 'menu-collapsed': menuCollapsed, 'is-resizing': settingsSidebarResizing }"
    :style="menuCollapsed ? null : { '--settings-sidebar-width': `${settingsSidebarWidth}px` }"
  >
    <header class="settings-topbar" :class="{ 'platform-darwin': isMac }">
      <div class="settings-nav">
        <button
          type="button"
          class="settings-nav-tool"
          :title="menuCollapsed ? t('展开菜单') : t('收起菜单')"
          :aria-label="menuCollapsed ? t('展开菜单') : t('收起菜单')"
          @click="menuCollapsed = !menuCollapsed"
        >
          <AppIcon name="panel-left" class="settings-nav-collapse-icon" :class="{ collapsed: menuCollapsed }" />
        </button>
        <button
          type="button"
          class="settings-nav-tool"
          :title="t('返回上一页')"
          :aria-label="t('返回上一页')"
          :disabled="!canGoBackTab"
          @click="goBackTab"
        >
          <AppIcon name="arrow-left" />
        </button>
        <button
          type="button"
          class="settings-nav-tool"
          :title="t('前进下一页')"
          :aria-label="t('前进下一页')"
          :disabled="!canGoForwardTab"
          @click="goForwardTab"
        >
          <AppIcon name="arrow-right" />
        </button>
      </div>
      <WindowControls v-if="!isMac" @minimize="minimizeWindow" @maximize="toggleMaximizeWindow" @close="closeWindow" />
    </header>

    <div class="settings-body">
      <aside class="settings-sidebar">
        <button type="button" class="settings-menu-item settings-return" :title="t('返回应用')" @click="leaveSettings">
          <span class="menu-icon">
            <AppIcon name="home" />
          </span>
          <span class="menu-text">{{ t('返回应用') }}</span>
        </button>
        <div class="settings-menu-divider" />
        <button
          v-for="item in menuItems"
          :key="item.id"
          type="button"
          :class="['settings-menu-item', { active: activeTab === item.id }]"
          :aria-current="activeTab === item.id ? 'page' : undefined"
          @click="selectTab(item.id)"
        >
          <span class="menu-icon">
            <AppIcon v-if="item.id === 'general'" name="sliders" />
            <AppIcon v-else-if="item.id === 'api'" name="key" />
            <AppIcon v-else-if="item.id === 'database-client'" name="database" />
            <AppIcon v-else-if="item.id === 'sql-generator'" name="file-text" />
            <AppIcon v-else-if="item.id === 'image-hosting'" name="image" />
            <AppIcon v-else-if="item.id === 'shortcuts'" name="keyboard" />
            <AppIcon v-else-if="item.id === 'assistant'" name="bot" />
            <AppIcon v-else-if="item.id === 'network'" name="globe" />
            <AppIcon v-else-if="item.id === 'extensions'" name="puzzle" />
            <AppIcon v-else-if="item.id === 'appearance'" name="sun" />
            <AppIcon v-else name="info" />
          </span>
          <span class="menu-text">{{ t(item.text) }}</span>
        </button>
      </aside>
      <SplitHandle
        v-if="!menuCollapsed"
        orientation="vertical"
        :resizing="settingsSidebarResizing"
        :label="t('拖动调整设置菜单宽度')"
        @pointerdown="startSettingsSidebarResize"
        @keydown="onSettingsSidebarKeydown"
      />

      <div class="settings-main">
        <div ref="settingsContentRef" class="settings-content" @focusout="onSettingsFocusOut">
          <div v-if="activeTab !== 'extensions'" class="settings-page-head">
            <div class="settings-page-title">
              <h2>{{ activeMeta.title }}</h2>
              <p>{{ t(activeMeta.description) }}</p>
            </div>
          </div>

          <div v-show="activeTab === 'general'" class="settings-tab">
            <GeneralPanel />
          </div>

          <div v-show="activeTab === 'appearance'" class="settings-tab">
            <AppearancePanel />
          </div>

          <div v-show="activeTab === 'api'" class="settings-tab api-settings">
            <ModelsPanel />
          </div>

          <div v-show="activeTab === 'assistant'" class="settings-tab">
            <AssistantPanel />
          </div>

          <div v-show="activeTab === 'database-client'" class="settings-tab">
            <DatabasePanel />
          </div>

          <div v-show="activeTab === 'sql-generator'" class="settings-tab">
            <SqlGeneratorPanel />
          </div>

          <div v-show="activeTab === 'image-hosting'" class="settings-tab">
            <ImageHostingPanel />
          </div>

          <div v-show="activeTab === 'network'" class="settings-tab">
            <NetworkPanel />
          </div>

          <div v-show="activeTab === 'shortcuts'" class="settings-tab">
            <ShortcutsPanel />
          </div>

          <div v-if="activeTab === 'extensions'" class="settings-tab extensions-tab">
            <ExtensionsManager />
          </div>

          <div v-show="activeTab === 'about'" class="settings-tab">
            <AboutPanel />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { provide } from 'vue'
import { useRoute } from 'vue-router'
import WindowControls from '@/components/WindowControls.vue'
import SplitHandle from '@/components/SplitHandle.vue'
import ExtensionsManager from '@/components/ExtensionsManager.vue'
import { t } from '@/i18n'
import { createSettingsState } from './settings/settingsState'
import { SETTINGS_CONTEXT } from './settings/settingsContext'
import GeneralPanel from './settings/panels/GeneralPanel.vue'
import AppearancePanel from './settings/panels/AppearancePanel.vue'
import ModelsPanel from './settings/panels/ModelsPanel.vue'
import AssistantPanel from './settings/panels/AssistantPanel.vue'
import DatabasePanel from './settings/panels/DatabasePanel.vue'
import SqlGeneratorPanel from './settings/panels/SqlGeneratorPanel.vue'
import ImageHostingPanel from './settings/panels/ImageHostingPanel.vue'
import NetworkPanel from './settings/panels/NetworkPanel.vue'
import ShortcutsPanel from './settings/panels/ShortcutsPanel.vue'
import AboutPanel from './settings/panels/AboutPanel.vue'

import AppIcon from '@/components/AppIcon.vue'
const route = useRoute()
const state = createSettingsState({ route })
provide(SETTINGS_CONTEXT, state)
const {
  activeMeta,
  activeTab,
  canGoBackTab,
  canGoForwardTab,
  closeWindow,
  goBackTab,
  goForwardTab,
  isMac,
  leaveSettings,
  menuCollapsed,
  menuItems,
  minimizeWindow,
  onSettingsFocusOut,
  onSettingsSidebarKeydown,
  selectTab,
  settingsSidebarResizing,
  settingsSidebarWidth,
  startSettingsSidebarResize,
  toggleMaximizeWindow
} = state
</script>

<style src="./settings/styles/settings.css"></style>
