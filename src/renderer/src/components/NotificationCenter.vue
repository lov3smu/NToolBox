<template>
  <div ref="rootRef" class="titlebar-notifications" :class="`is-${sizeClass}`">
    <button
      type="button"
      class="titlebar-tool"
      :class="{ active: open }"
      :title="t('通知中心')"
      :aria-label="t('通知中心')"
      :aria-expanded="open"
      @click="toggle"
    >
      <AppIcon name="bell" />
      <span v-if="unread > 0" class="notify-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <Transition name="notify-pop">
      <section v-if="open" v-clamp-viewport class="notify-panel" role="dialog" :aria-label="t('通知中心')">
        <header class="notify-panel-head">
          <span class="notify-panel-title">{{ t('通知中心') }}</span>
          <button type="button" class="notify-clear" :disabled="!items.length" @click="clearAllItems">
            {{ t('清空通知') }}
          </button>
        </header>
        <div v-if="items.length" class="notify-list">
          <article
            v-for="item in items"
            :key="item.id"
            class="notify-item"
            :class="[`level-${item.level}`, { unread: !item.read }]"
          >
            <div class="notify-item-head">
              <span class="notify-item-title">{{ item.title }}</span>
              <span class="notify-item-time">{{ formatRelativeTime(item.createdAt) }}</span>
            </div>
            <p class="notify-item-body">{{ item.body }}</p>
          </article>
        </div>
        <div v-else class="notify-empty">{{ t('暂无通知') }}</div>
      </section>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { notificationsClear, notificationsList, notificationsMarkRead, onNotificationCreated } from '@/api'
import { t } from '@/i18n'
import AppIcon from '@/components/AppIcon.vue'
import { formatRelativeTime } from '@/utils/format'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  size: { type: String, default: 'md' }
})

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const rootRef = ref(null)
const open = ref(false)
const items = ref([])
const unread = ref(0)
let removeCreatedListener = null

async function load() {
  try {
    const page = await notificationsList({ limit: 30 })
    items.value = page?.items || []
    unread.value = Number(page?.unread) || 0
  } catch {
    items.value = []
    unread.value = 0
  }
}

async function markAllRead() {
  if (unread.value === 0) return
  unread.value = 0
  items.value = items.value.map((item) => ({ ...item, read: true }))
  try {
    await notificationsMarkRead()
  } catch {
    // 标记失败不阻断面板浏览，下次打开会重新同步
  }
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await markAllRead()
  await load()
}

async function clearAllItems() {
  if (!items.value.length) return
  try {
    await notificationsClear()
    items.value = []
    unread.value = 0
  } catch {
    // 清理失败保留现有列表
  }
}

function onDocumentPointerDown(event) {
  if (!open.value) return
  if (!rootRef.value?.contains(event.target)) open.value = false
}

function onDocumentKeyDown(event) {
  if (open.value && event.key === 'Escape') open.value = false
}

function onCreated(payload) {
  const notification = payload?.notification
  if (!notification?.id) return
  if (open.value) {
    notificationsMarkRead([notification.id]).catch(() => {})
    items.value = [{ ...notification, read: true }, ...items.value]
    return
  }
  if (!items.value.some((item) => item.id === notification.id)) {
    items.value = [notification, ...items.value].slice(0, 30)
  }
  unread.value = Number(payload?.unread) || unread.value + 1
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
  removeCreatedListener = onNotificationCreated(onCreated)
  load()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
  removeCreatedListener?.()
})
</script>

<style scoped>
.titlebar-notifications {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.titlebar-tool {
  position: relative;
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

.titlebar-tool svg {
  width: 15px;
  height: 15px;
}

.titlebar-tool:hover,
.titlebar-tool.active {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.notify-badge {
  position: absolute;
  top: 1px;
  right: 0;
  min-width: 13px;
  height: 13px;
  padding: 0 3px;
  border-radius: var(--radius-pill);
  background: var(--error-color);
  color: var(--text-inverse);
  font-size: calc(9px * var(--font-scale));
  font-weight: 600;
  line-height: 13px;
  text-align: center;
}

.notify-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 340px;
  max-width: calc(100vw - 16px);
  max-height: min(420px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1200;
}

.titlebar-notifications.is-xl .notify-panel {
  width: 400px;
}

.titlebar-notifications.is-xl .notify-panel-head {
  padding: 12px 14px;
}

.titlebar-notifications.is-xl .notify-item-title {
  font-size: var(--font-size-base);
}

.titlebar-notifications.is-lg .notify-panel {
  width: 372px;
}

.titlebar-notifications.is-lg .notify-item-title {
  font-size: var(--font-size-base);
}

.titlebar-notifications.is-sm .notify-panel {
  width: 308px;
}

.titlebar-notifications.is-sm .notify-item {
  padding: 7px 9px;
}

.titlebar-notifications.is-xs .notify-panel {
  width: 276px;
}

.titlebar-notifications.is-xs .notify-panel-head {
  padding: 8px 10px;
}

.titlebar-notifications.is-xs .notify-item {
  padding: 6px 8px;
}

.titlebar-notifications.is-xs .notify-item-title,
.titlebar-notifications.is-xs .notify-item-body {
  font-size: var(--font-size-xs);
}

.notify-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px dashed var(--border-color);
  flex-shrink: 0;
}

.notify-panel-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.notify-clear {
  border: none;
  background: transparent;
  padding: 2px 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  cursor: pointer;
}

.notify-clear:hover:not(:disabled) {
  color: var(--accent-color);
}

.notify-clear:disabled {
  opacity: 0.5;
  cursor: default;
}

.notify-list {
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notify-item {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
}

.notify-item.unread {
  background: var(--inset-bg);
}

.notify-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notify-item-title {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notify-item-title::before {
  content: '';
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--accent-color);
}

.notify-item.level-success .notify-item-title::before {
  background: var(--success-color);
}

.notify-item.level-warning .notify-item-title::before {
  background: var(--warning-color);
}

.notify-item.level-error .notify-item-title::before {
  background: var(--error-color);
}

.notify-item-time {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.notify-item-body {
  margin: 3px 0 0 12px;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
}

.notify-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.notify-pop-enter-active,
.notify-pop-leave-active {
  transform-origin: top right;
  transition:
    opacity var(--motion-fast) var(--motion-ease),
    transform var(--motion-fast) var(--motion-ease);
}

.notify-pop-leave-active {
  pointer-events: none;
}

.notify-pop-enter-from,
.notify-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
