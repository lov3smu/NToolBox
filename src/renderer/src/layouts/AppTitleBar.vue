<template>
  <header class="app-titlebar" :class="`platform-${platform}`" @dblclick="onTitlebarDoubleClick">
    <div class="titlebar-nav no-drag" role="group" :aria-label="t('导航')">
      <button
        type="button"
        class="titlebar-tool"
        :title="collapsed ? t('展开侧边栏') : t('收起侧边栏')"
        :aria-label="collapsed ? t('展开侧边栏') : t('收起侧边栏')"
        @click="toggleSidebar"
      >
        <AppIcon name="panel-left" class="titlebar-collapse-icon" :class="{ collapsed }" :stroke-width="2.2" />
      </button>
      <button
        type="button"
        class="titlebar-tool"
        :title="t('返回上一页')"
        :aria-label="t('返回上一页')"
        :disabled="!canGoBack"
        @click="goBack"
      >
        <AppIcon name="arrow-left" :stroke-width="2.2" />
      </button>
      <button
        type="button"
        class="titlebar-tool"
        :title="t('前进下一页')"
        :aria-label="t('前进下一页')"
        :disabled="!canGoForward"
        @click="goForward"
      >
        <AppIcon name="arrow-right" :stroke-width="2.2" />
      </button>
    </div>

    <span class="titlebar-divider" aria-hidden="true" />

    <div ref="menuRootRef" class="titlebar-menus no-drag" role="menubar">
      <div v-for="menu in menus" :key="menu.key" class="menu-entry" @mouseenter="onMenuHover(menu.key)">
        <button
          type="button"
          class="menu-trigger"
          :class="{ open: openMenu === menu.key }"
          :aria-expanded="openMenu === menu.key"
          aria-haspopup="menu"
          @click="toggleMenu(menu.key)"
        >
          {{ menu.label }}
        </button>

        <Transition name="menu-pop">
          <div v-if="openMenu === menu.key" v-clamp-viewport class="menu-popup" role="menu">
            <template v-for="(item, index) in menu.items" :key="index">
              <div v-if="item.type === 'separator'" class="menu-separator" role="separator" />
              <button
                v-else
                type="button"
                class="menu-option"
                :class="{ active: activeMenuIndex === index }"
                role="menuitem"
                @mouseenter="activeMenuIndex = index"
                @click="selectItem(item)"
              >
                <span class="menu-option-label">{{ item.label }}</span>
                <span v-if="item.shortcut" class="menu-option-shortcut">{{ item.shortcut }}</span>
              </button>
            </template>
          </div>
        </Transition>
      </div>
    </div>

    <span class="titlebar-spacer" aria-hidden="true" />

    <NotificationCenter />

    <WindowControls
      v-if="!isMac"
      :fullscreen="isFullscreen"
      @minimize="windowMinimize"
      @maximize="windowToggleMaximize"
      @exit-fullscreen="menuAction('toggle-fullscreen')"
      @close="windowClose"
    />
  </header>
</template>

<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getConfig,
  menuAction,
  onConfigChanged,
  onWindowFullscreen,
  openSettings,
  platform,
  windowClose,
  windowIsFullscreen,
  windowMinimize,
  windowToggleMaximize
} from '@/api'
import { openUpdateCenter } from '@/composables'
import { useSidebar } from '@/composables'
import { t } from '@/i18n'
import { SETTINGS_PATH, getToolAccelerator, getToolByPath } from '@shared/navTools'
import WindowControls from '@/components/WindowControls.vue'
import NotificationCenter from '@/components/NotificationCenter.vue'

const isMac = platform === 'darwin'
const isDev = import.meta.env.DEV

const router = useRouter()
const { collapsed, toggleSidebar } = useSidebar()

const historyState = ref(router.options.history.state || {})
const removeHistoryListener = router.afterEach(() => {
  historyState.value = router.options.history.state || {}
})

const canGoBack = computed(() => Boolean(historyState.value.back))
const canGoForward = computed(() => Boolean(historyState.value.forward))

function goBack() {
  if (canGoBack.value) router.back()
}

function goForward() {
  if (canGoForward.value) router.forward()
}

const menuRootRef = ref(null)
const openMenu = ref(null)
const activeMenuIndex = ref(-1)
const shortcuts = ref({})
const isFullscreen = ref(false)
let removeConfigListener = null
let removeFullscreenListener = null

async function loadShortcuts() {
  try {
    const config = await getConfig()
    shortcuts.value = config?.app.shortcuts || {}
  } catch {
    shortcuts.value = {}
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
  window.addEventListener('blur', closeMenu)
  removeConfigListener = onConfigChanged(loadShortcuts)
  removeFullscreenListener = onWindowFullscreen((value) => {
    isFullscreen.value = Boolean(value)
  })
  windowIsFullscreen().then((value) => {
    isFullscreen.value = Boolean(value)
  })
  loadShortcuts()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
  window.removeEventListener('blur', closeMenu)
  removeConfigListener?.()
  removeFullscreenListener?.()
  removeHistoryListener()
})

function onDocumentPointerDown(event) {
  if (!menuRootRef.value?.contains(event.target)) closeMenu()
}

function onTitlebarDoubleClick(event) {
  if (isFullscreen.value) return
  if (event.target.closest('button, .menu-entry')) return
  windowToggleMaximize()
}

function onDocumentKeyDown(event) {
  if (!openMenu.value) return

  if (event.key === 'Escape') {
    closeMenu()
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key === 'Enter' && activeMenuIndex.value >= 0 && !event.target.closest?.('.menu-option')) {
    const menu = menus.value.find((entry) => entry.key === openMenu.value)
    const item = menu?.items[activeMenuIndex.value]
    if (item && item.type !== 'separator') {
      event.preventDefault()
      selectItem(item)
    }
  }
}

function moveActive(delta) {
  const menu = menus.value.find((entry) => entry.key === openMenu.value)
  if (!menu) return

  const indexes = menu.items
    .map((item, index) => (item.type === 'separator' ? -1 : index))
    .filter((index) => index >= 0)
  if (!indexes.length) return

  const current = indexes.indexOf(activeMenuIndex.value)
  const next = current === -1 ? (delta > 0 ? 0 : indexes.length - 1) : current + delta
  activeMenuIndex.value = indexes[Math.min(indexes.length - 1, Math.max(0, next))]
  scrollActiveMenuIntoView()
}

function scrollActiveMenuIntoView() {
  nextTick(() => {
    const container = menuRootRef.value?.querySelector('.menu-popup')
    const active = container?.querySelector('.menu-option.active')
    if (!container || !active) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    if (activeRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - activeRect.top
    } else if (activeRect.bottom > containerRect.bottom) {
      container.scrollTop += activeRect.bottom - containerRect.bottom
    }
  })
}

function formatAccelerator(accelerator) {
  if (!accelerator) return ''
  const modifiers = []
  let key = ''

  for (const part of accelerator.split('+')) {
    if (part === 'CmdOrCtrl' || part === 'Command' || part === 'Cmd') {
      modifiers.push(isMac ? '⌘' : 'Ctrl')
    } else if (part === 'Ctrl' || part === 'Control') {
      modifiers.push(isMac ? '⌃' : 'Ctrl')
    } else if (part === 'Alt' || part === 'Option') {
      modifiers.push(isMac ? '⌥' : 'Alt')
    } else if (part === 'Shift') {
      modifiers.push(isMac ? '⇧' : 'Shift')
    } else {
      key = part
    }
  }

  if (isMac) {
    const order = ['⌃', '⌥', '⇧', '⌘']
    return order.filter((modifier) => modifiers.includes(modifier)).join('') + key
  }

  const order = ['Ctrl', 'Alt', 'Shift']
  return [...order.filter((modifier) => modifiers.includes(modifier)), key].join('+')
}

const menus = computed(() => {
  const settingsTool = getToolByPath(SETTINGS_PATH)

  const fileItems = [
    ...(settingsTool
      ? [
          {
            label: t(settingsTool.name),
            action: 'open-settings',
            shortcut: formatAccelerator(getToolAccelerator(settingsTool, shortcuts.value))
          },
          { type: 'separator' }
        ]
      : []),
    { label: t('隐藏窗口'), action: 'hide-window', shortcut: isMac ? '⌘H' : '' },
    { label: t('关闭窗口'), action: 'close-window', shortcut: isMac ? '⌘W' : 'Alt+F4' }
  ]

  const editItems = [
    { label: t('撤销'), action: 'edit-undo', shortcut: formatAccelerator('CmdOrCtrl+Z') },
    { label: t('重做'), action: 'edit-redo', shortcut: formatAccelerator('Shift+CmdOrCtrl+Z') },
    { type: 'separator' },
    { label: t('剪切'), action: 'edit-cut', shortcut: formatAccelerator('CmdOrCtrl+X') },
    { label: t('复制'), action: 'edit-copy', shortcut: formatAccelerator('CmdOrCtrl+C') },
    { label: t('粘贴'), action: 'edit-paste', shortcut: formatAccelerator('CmdOrCtrl+V') },
    { label: t('全选'), action: 'select-all', shortcut: formatAccelerator('CmdOrCtrl+A') }
  ]

  const viewItems = [
    { label: t('重新载入'), action: 'reload', shortcut: formatAccelerator('CmdOrCtrl+R') },
    { label: t('强制重新载入'), action: 'force-reload', shortcut: formatAccelerator('Shift+CmdOrCtrl+R') },
    { type: 'separator' },
    { label: t('实际大小'), action: 'reset-zoom', shortcut: formatAccelerator('CmdOrCtrl+0') },
    { label: t('放大'), action: 'zoom-in', shortcut: formatAccelerator('CmdOrCtrl+=') },
    { label: t('缩小'), action: 'zoom-out', shortcut: formatAccelerator('CmdOrCtrl+-') },
    { type: 'separator' },
    { label: t('切换全屏'), action: 'toggle-fullscreen', shortcut: isMac ? '⌃⌘F' : 'F11' }
  ]

  const helpItems = [
    { label: t('检查更新'), action: 'check-updates' },
    { label: t('关于软件'), action: 'about' },
    ...(isDev
      ? [
          { type: 'separator' },
          {
            label: t('开发者工具'),
            action: 'toggle-devtools',
            shortcut: isMac ? '⌥⌘I' : 'F12'
          }
        ]
      : [])
  ]

  return [
    { key: 'file', label: t('文件'), items: fileItems },
    { key: 'edit', label: t('编辑'), items: editItems },
    { key: 'view', label: t('视图'), items: viewItems },
    { key: 'help', label: t('帮助'), items: helpItems }
  ]
})

function onMenuHover(key) {
  if (openMenu.value && openMenu.value !== key) {
    openMenu.value = key
    activeMenuIndex.value = -1
  }
}

function toggleMenu(key) {
  if (openMenu.value === key) {
    closeMenu()
    return
  }
  openMenu.value = key
  activeMenuIndex.value = -1
}

function closeMenu() {
  openMenu.value = null
  activeMenuIndex.value = -1
}

async function selectItem(item) {
  closeMenu()

  if (item.action === 'open-settings') {
    await openSettings()
    return
  }

  if (item.action === 'check-updates') {
    await openUpdateCenter()
    return
  }

  if (item.action) await menuAction(item.action)
}
</script>

<style scoped>
.app-titlebar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  flex-shrink: 0;
  padding-left: 12px;
  padding-right: 0;
  background: var(--shell-titlebar-bg);
  color: var(--shell-text);
  -webkit-app-region: drag;
  user-select: none;
}

.app-titlebar.platform-darwin {
  padding-left: 84px;
  padding-right: 12px;
}

.no-drag {
  -webkit-app-region: no-drag;
}

.titlebar-nav {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.titlebar-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--shell-text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}

.titlebar-tool:hover:not(:disabled) {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.titlebar-tool:disabled {
  opacity: 0.35;
  cursor: default;
}

.titlebar-tool:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.titlebar-tool svg {
  width: 16px;
  height: 16px;
}

.titlebar-collapse-icon {
  transition: transform 0.22s;
}

.titlebar-collapse-icon.collapsed {
  transform: rotate(180deg);
}

.titlebar-divider {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: var(--shell-divider);
}

.titlebar-menus {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.menu-entry {
  position: relative;
}

.menu-trigger {
  padding: 5px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--font-size-sm);
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.menu-trigger:hover,
.menu-trigger.open {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.menu-trigger:focus-visible,
.menu-option:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -1px;
}

.menu-popup {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1200;
  min-width: 232px;
  max-height: calc(100vh - 56px);
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--shell-menu-border);
  border-radius: var(--radius-md);
  background: var(--shell-menu-bg);
  box-shadow: var(--shell-shadow);
}

.menu-pop-enter-active,
.menu-pop-leave-active {
  transform-origin: top left;
  transition:
    opacity var(--motion-fast) var(--motion-ease),
    transform var(--motion-fast) var(--motion-ease);
}

.menu-pop-leave-active {
  pointer-events: none;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.menu-separator {
  height: 1px;
  margin: 5px 8px;
  background: var(--shell-divider);
}

.menu-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--shell-menu-text);
  font: inherit;
  font-size: var(--font-size-dense);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.menu-option:hover,
.menu-option.active {
  background: var(--shell-menu-hover-bg);
  color: var(--shell-menu-hover-text);
}

.menu-option-label {
  flex: 1;
  min-width: 0;
}

.menu-option-shortcut {
  flex-shrink: 0;
  color: var(--shell-menu-shortcut);
  font-size: var(--font-size-xs);
  letter-spacing: 0.2px;
}

.menu-option:hover .menu-option-shortcut,
.menu-option.active .menu-option-shortcut {
  color: var(--shell-menu-shortcut-hover);
}

.titlebar-spacer {
  flex: 1;
  min-width: 8px;
}
</style>
