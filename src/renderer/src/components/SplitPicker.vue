<template>
  <div ref="rootRef" class="split-picker" :class="`is-${sizeClass}`">
    <button
      type="button"
      class="split-trigger"
      :class="{ 'is-active': splitActive }"
      :title="t('分屏')"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click="toggleMenu"
    >
      <AppIcon name="split" />
      <span>{{ t('分屏') }}</span>
    </button>

    <Teleport to="body">
      <Transition name="split-menu-pop">
        <div v-if="menuOpen" ref="menuRef" class="split-menu" role="menu" :style="menuStyle" @click.stop>
          <div class="split-menu-title">{{ t('选择工具分屏打开') }}</div>
          <div class="split-menu-list">
            <template v-for="group in groups" :key="group.id">
              <div class="split-menu-group">{{ t(group.label) }}</div>
              <button
                v-for="tool in group.tools"
                :key="tool.path"
                type="button"
                role="menuitem"
                class="split-menu-item"
                :class="{ 'is-current': secondaryPath === tool.path }"
                @click="choose(tool)"
              >
                <span class="split-menu-icon" v-html="tool.icon" />
                <span class="split-menu-label">{{ t(tool.name) }}</span>
                <AppIcon v-if="secondaryPath === tool.path" name="check" :stroke-width="2.4" class="split-menu-check" />
              </button>
            </template>
          </div>
          <button v-if="splitActive" type="button" class="split-menu-close" @click="closeSplit">
            {{ t('关闭分屏') }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { MENU_GROUP_LABELS, splitTools } from '@shared/navTools'
import { useSplitView } from '@/composables'
import { t } from '@/i18n'

import AppIcon from '@/components/AppIcon.vue'
const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  size: { type: String, default: 'md' }
})

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const GROUP_ORDER = ['primary', 'file', 'dev', 'content', 'system']
const GROUP_LABELS = MENU_GROUP_LABELS
const MENU_WIDTH = 248
const MENU_GAP = 6
const VIEWPORT_MARGIN = 8

const route = useRoute()
const { secondaryPath, splitActive, openSplit, closeSplit } = useSplitView()

const rootRef = ref(null)
const menuRef = ref(null)
const menuOpen = ref(false)
const menuStyle = ref({})

const groups = computed(() => {
  const items = splitTools.filter((tool) => tool.path !== route.path)
  return GROUP_ORDER.map((id) => ({
    id,
    label: GROUP_LABELS[id],
    tools: items.filter((tool) => tool.menuGroup === id)
  })).filter((group) => group.tools.length > 0)
})

function measure() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const menu = menuRef.value?.getBoundingClientRect()
  if (!trigger || !menu) return
  const width = Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
  const left = Math.min(Math.max(VIEWPORT_MARGIN, trigger.right - width), window.innerWidth - width - VIEWPORT_MARGIN)
  const spaceBelow = window.innerHeight - trigger.bottom - MENU_GAP - VIEWPORT_MARGIN
  const spaceAbove = trigger.top - MENU_GAP - VIEWPORT_MARGIN
  const flipUp = spaceBelow < menu.height && spaceAbove > spaceBelow
  const top = flipUp ? Math.max(VIEWPORT_MARGIN, trigger.top - menu.height - MENU_GAP) : trigger.bottom + MENU_GAP
  menuStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(Math.max(180, flipUp ? spaceAbove : spaceBelow))}px`
  }
}

async function openMenu() {
  menuOpen.value = true
  await nextTick()
  measure()
}

function toggleMenu() {
  if (menuOpen.value) closeMenu()
  else openMenu()
}

function choose(tool) {
  menuOpen.value = false
  if (tool.path === route.path) return
  openSplit(tool.path)
}

function closeMenu() {
  menuOpen.value = false
}

function onPointerDown(event) {
  if (!menuOpen.value) return
  if (rootRef.value?.contains(event.target) || menuRef.value?.contains(event.target)) return
  closeMenu()
}

function onKeyDown(event) {
  if (event.key === 'Escape' && menuOpen.value) closeMenu()
}

function onScroll(event) {
  if (!menuOpen.value) return
  const target = event.target
  if (target && target.nodeType && (rootRef.value?.contains(target) || menuRef.value?.contains(target))) return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', closeMenu)
})
</script>

<style scoped>
.split-picker {
  display: inline-flex;
  flex-shrink: 0;
}

.split-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--control-height);
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.split-trigger:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.split-trigger:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.split-trigger.is-active {
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.split-trigger svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.split-picker.is-xl .split-trigger {
  height: var(--control-height-xl);
  padding: 0 14px;
  font-size: var(--font-size-base);
}

.split-picker.is-xl .split-trigger svg {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.split-picker.is-lg .split-trigger {
  height: var(--control-height-lg);
  padding: 0 12px;
  font-size: var(--font-size-base);
}

.split-picker.is-lg .split-trigger svg {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.split-picker.is-sm .split-trigger {
  height: var(--control-height-sm);
  padding: 0 9px;
}

.split-picker.is-xs .split-trigger {
  height: var(--control-height-xs);
  padding: 0 8px;
  font-size: var(--font-size-xs);
}

.split-picker.is-xs .split-trigger svg {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
}

.split-picker.is-xs .split-menu-item {
  padding: 4px 6px;
  font-size: var(--font-size-xs);
}

.split-menu {
  position: fixed;
  z-index: 1200;
  width: 248px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.split-menu-title {
  padding: 8px 12px 6px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.4px;
}

.split-menu-list {
  flex: 1;
  min-height: 0;
  max-height: 320px;
  overflow-y: auto;
  padding: 0 6px 6px;
}

.split-menu-group {
  padding: 6px 6px 2px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.split-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.split-menu-item:hover {
  background: var(--surface-hover);
}

.split-menu-item.is-current {
  color: var(--accent-color);
}

.split-menu-icon {
  display: inline-flex;
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.split-menu-item.is-current .split-menu-icon {
  color: var(--accent-color);
}

.split-menu-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.split-menu-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split-menu-check {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  flex-shrink: 0;
}

.split-menu-close {
  padding: 8px 12px;
  border: none;
  border-top: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.split-menu-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.split-menu-pop-enter-active,
.split-menu-pop-leave-active {
  transition:
    opacity var(--motion-fast) var(--motion-ease),
    transform var(--motion-fast) var(--motion-ease);
}

.split-menu-pop-enter-from,
.split-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
