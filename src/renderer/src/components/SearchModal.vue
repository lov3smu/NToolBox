<template>
  <Teleport to="body">
    <div v-if="visible" class="search-overlay" :class="`is-${sizeClass}`" @click.self="close">
      <div class="search-modal">
        <div class="search-input-wrapper">
          <AppIcon name="search" class="search-icon" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="t('搜索工具或命令...')"
            @input="onInput"
            @paste="onPaste"
            @keydown.down="navigateDown"
            @keydown.up="navigateUp"
            @keydown.enter="selectCurrent($event)"
            @keydown.esc="close"
          />
          <span class="search-shortcut">ESC</span>
        </div>
        <div v-if="quickFinding" class="quick-card">
          <div class="quick-head">
            <span class="quick-kind">{{ t(QUICK_KIND_LABELS[quickFinding.kind]) }}</span>
            <span class="quick-size">{{ t('{p0} 字符', { p0: quickFinding.size }) }}</span>
            <span class="quick-spacer" />
            <button type="button" class="quick-close" :title="t('清空')" @click="dismissQuick">×</button>
          </div>
          <div class="quick-body">
            <span
              v-if="quickFinding.kind === 'color'"
              class="quick-swatch"
              :style="{ background: quickFinding.payload.hex }"
            />
            <div class="quick-details">
              <div v-for="item in quickDetails" :key="item.label" class="quick-row">
                <span class="quick-row-label">{{ item.label }}</span>
                <span class="quick-row-value">{{ item.value }}</span>
              </div>
            </div>
            <pre v-if="quickPreview" class="quick-pre">{{ quickPreview }}</pre>
          </div>
          <div class="quick-actions">
            <button v-if="quickFinding.send" type="button" class="btn btn-primary btn-sm" @click="openQuickTarget">
              {{ t('发送到 {p0}', { p0: quickTargetName }) }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="copyQuick">
              {{ quickCopied ? t('已复制') : t('复制') }}
            </button>
          </div>
        </div>
        <div v-if="recentTools.length > 0 && !searchQuery.trim()" class="recent-section">
          <div class="section-title">{{ t('最近使用') }}</div>
          <div class="recent-tools">
            <div
              v-for="tool in recentTools"
              :key="tool.path"
              class="recent-tool-item"
              :title="t(tool.name)"
              @click="selectTool(tool)"
            >
              <div class="tool-icon" v-html="tool.icon" />
            </div>
          </div>
        </div>
        <div v-if="groupedActions.length > 0" class="all-tools-section">
          <div class="section-title">{{ searchQuery.trim() ? t('搜索结果') : t('所有工具') }}</div>
          <div ref="resultsRef" class="search-results">
            <template v-for="group in groupedActions" :key="group.id">
              <div v-if="searchQuery.trim()" class="search-group-title">{{ t(group.label) }}</div>
              <div
                v-for="entry in group.items"
                :key="entry.action.id"
                class="search-result-item"
                :class="{ active: activeIndex === entry.index }"
                @click="selectEntry(entry.action)"
                @mouseenter="activeIndex = entry.index"
              >
                <div class="tool-icon" v-html="entry.action.icon" />
                <div class="tool-info">
                  <div class="tool-name">
                    {{ t(entry.action.title) }}
                    <span v-if="searchQuery.trim()" class="action-kind">
                      {{ t(entry.action.categoryLabel || ACTION_GROUP_LABELS[entry.action.group]) }}
                    </span>
                  </div>
                  <div v-if="entry.action.subtitle" class="tool-desc">
                    {{ t(entry.action.subtitle) }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div v-else class="search-empty">
          <span>{{ t('未找到匹配的结果') }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { openSettings, pluginsList } from '@/api'
import { t } from '@/i18n'
import { ACTION_GROUP_LABELS, buildSearchActions } from '@/actions/searchActions'
import { filterActions } from '@shared/actionSearch'
import { detectQuickInput } from '@shared/quickInput'
import { getRecentTools, addToRecent, SETTINGS_PATH, visibleTools } from '@shared/navTools'
import { sendResourceTo } from '@/composables'
import { copyToClipboard } from '@/utils/clipboard'

import AppIcon from '@/components/AppIcon.vue'
const QUICK_KIND_LABELS = Object.freeze({
  json: 'JSON',
  sql: 'SQL',
  jwt: 'JWT',
  url: 'URL',
  timestamp: '时间戳',
  color: '颜色',
  base64: 'Base64',
  urlencoded: 'URL 编码'
})

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  size: { type: String, default: 'md' }
})

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const emit = defineEmits(['close'])

const router = useRouter()
const searchQuery = ref('')
const searchInput = ref(null)
const resultsRef = ref(null)
const activeIndex = ref(0)
const quickText = ref('')
const quickHidden = ref(false)
const quickCopied = ref(false)
const pluginCommands = ref([])

const recentTools = computed(() => getRecentTools())

const quickFinding = computed(() => {
  if (quickHidden.value) return null
  return detectQuickInput(quickText.value || searchQuery.value.trim())
})

const quickDetails = computed(() => {
  const finding = quickFinding.value
  if (!finding) return []
  const payload = finding.payload
  switch (finding.kind) {
    case 'json':
      if (!payload.valid) return [{ label: t('状态'), value: t('格式无效') }]
      return [
        { label: t('类型'), value: payload.type === 'array' ? t('数组') : t('对象') },
        {
          label: t('数量'),
          value:
            payload.type === 'array' ? t('{p0} 项', { p0: payload.count }) : t('{p0} 个字段', { p0: payload.count })
        }
      ]
    case 'sql':
      return [
        { label: t('语句'), value: payload.statement },
        { label: t('行数'), value: String(payload.lines) }
      ]
    case 'jwt':
      return [
        { label: t('算法'), value: payload.algorithm },
        {
          label: t('状态'),
          value: payload.expired === null ? t('无过期时间') : payload.expired ? t('已过期') : t('未过期')
        }
      ]
    case 'url':
      return [
        { label: t('协议'), value: payload.protocol },
        { label: t('主机'), value: payload.host },
        { label: t('参数'), value: String(payload.params) }
      ]
    case 'timestamp':
      return [
        { label: t('精度'), value: payload.unit === 'seconds' ? t('秒级') : t('毫秒级') },
        { label: t('本地时间'), value: payload.local },
        { label: 'ISO 8601', value: payload.iso }
      ]
    case 'color':
      return [
        { label: 'HEX', value: payload.hex },
        { label: 'RGB', value: payload.rgb },
        { label: 'HSL', value: payload.hsl }
      ]
    case 'base64':
    case 'urlencoded':
      return [{ label: t('解码长度'), value: t('{p0} 字符', { p0: payload.decoded.length }) }]
    default:
      return []
  }
})

const quickPreview = computed(() => {
  const finding = quickFinding.value
  if (!finding) return ''
  if (finding.kind === 'jwt') {
    const text = JSON.stringify(finding.payload.claims, null, 2)
    return text.length > 600 ? `${text.slice(0, 600)}…` : text
  }
  if (finding.kind === 'base64' || finding.kind === 'urlencoded') {
    return finding.payload.preview
  }
  return ''
})

const quickTargetName = computed(() => {
  const path = quickFinding.value?.send?.path
  const tool = visibleTools.find((item) => item.path === path)
  return tool ? t(tool.name) : t('工具')
})

const allActions = computed(() =>
  buildSearchActions({
    navigate: (path) => router.push(path),
    addRecent: addToRecent,
    pluginCommands: pluginCommands.value,
    sendText: (payload, path) => sendResourceTo(payload, path)
  })
)

const matchedActions = computed(() => {
  const query = searchQuery.value.trim()
  if (!query) return allActions.value.filter((action) => action.group === 'tool')
  return filterActions(allActions.value, query, t)
})

const groupedActions = computed(() => {
  let index = 0
  const groups = []
  for (const action of matchedActions.value) {
    let group = groups.find((item) => item.id === action.group)
    if (!group) {
      group = { id: action.group, label: ACTION_GROUP_LABELS[action.group], items: [] }
      groups.push(group)
    }
    group.items.push({ action, index: index++ })
  }
  return groups
})

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      loadPluginCommands()
      nextTick(() => {
        searchInput.value?.focus()
      })
    } else {
      searchQuery.value = ''
      quickText.value = ''
      quickHidden.value = false
      quickCopied.value = false
      activeIndex.value = 0
    }
  }
)

async function loadPluginCommands() {
  const list = await pluginsList()
  const commands = []
  for (const plugin of Array.isArray(list) ? list : []) {
    for (const command of Array.isArray(plugin?.commands) ? plugin.commands : []) {
      commands.push({ ...command, plugin: plugin.name })
    }
    for (const action of Array.isArray(plugin?.sandbox?.actions) ? plugin.sandbox.actions : []) {
      commands.push({
        id: `sandbox-${action.id}`,
        title: action.title,
        subtitle: t('插件沙箱'),
        keywords: `沙箱 sandbox ${action.description || ''}`,
        action: 'run',
        target: action.id,
        plugin: plugin.name
      })
    }
  }
  pluginCommands.value = commands
}

watch(searchQuery, () => {
  activeIndex.value = 0
  nextTick(() => {
    if (resultsRef.value) resultsRef.value.scrollTop = 0
  })
})

watch(activeIndex, scrollActiveIntoView)

function scrollActiveIntoView() {
  nextTick(() => {
    const container = resultsRef.value
    const active = container?.querySelector('.search-result-item.active')
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

function navigateDown() {
  if (activeIndex.value < matchedActions.value.length - 1) {
    activeIndex.value++
  }
}

function navigateUp() {
  if (activeIndex.value > 0) {
    activeIndex.value--
  }
}

function selectCurrent(e) {
  if (e && e.isComposing) return
  if (quickText.value && quickFinding.value?.send) {
    openQuickTarget()
    return
  }
  const action = matchedActions.value[activeIndex.value]
  if (action) selectEntry(action)
}

function selectEntry(action) {
  action.run()
  close()
}

function onInput() {
  quickText.value = ''
  quickHidden.value = false
  quickCopied.value = false
}

function onPaste(event) {
  const text = event.clipboardData?.getData('text/plain') || ''
  if (!text || !detectQuickInput(text)) return
  event.preventDefault()
  quickText.value = text
  quickHidden.value = false
  quickCopied.value = false
  searchQuery.value = ''
}

function dismissQuick() {
  quickHidden.value = true
  searchInput.value?.focus()
}

function openQuickTarget() {
  const send = quickFinding.value?.send
  if (!send) return
  sendResourceTo({ kind: 'text', text: send.text, title: send.title }, send.path)
  close()
}

async function copyQuick() {
  const copyText = quickFinding.value?.copyText
  if (!copyText) return
  quickCopied.value = await copyToClipboard(copyText)
}

function selectTool(tool) {
  if (tool.path === SETTINGS_PATH) {
    openSettings()
  } else {
    router.push(tool.path)
  }
  addToRecent(tool)
  close()
}

function close() {
  emit('close')
}
</script>

<style scoped>
.search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 9999;
}

.search-modal {
  width: 680px;
  max-width: calc(100vw - 32px);
  max-height: min(500px, calc(100vh - 112px));
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: search-modal-in var(--motion-panel) var(--motion-ease);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.search-icon {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: var(--font-size-md);
  background: transparent;
  color: var(--text-primary);
}

.search-overlay.is-xl .search-modal {
  width: 780px;
}

.search-overlay.is-xl .search-input-wrapper {
  padding: 14px 18px;
}

.search-overlay.is-xl .search-input {
  font-size: var(--font-size-lg);
}

.search-overlay.is-lg .search-modal {
  width: 720px;
}

.search-overlay.is-lg .search-input {
  font-size: var(--font-size-md);
}

.search-overlay.is-sm .search-modal {
  width: 600px;
}

.search-overlay.is-sm .search-input-wrapper {
  padding: 10px 14px;
}

.search-overlay.is-sm .search-input,
.search-overlay.is-sm .search-result-item {
  font-size: var(--font-size-sm);
}

.search-overlay.is-sm .search-result-item {
  padding: 8px 10px;
}

.search-overlay.is-xs .search-modal {
  width: 480px;
}

.search-overlay.is-xs .search-input-wrapper {
  padding: 8px 12px;
}

.search-overlay.is-xs .search-input,
.search-overlay.is-xs .search-result-item {
  font-size: var(--font-size-xs);
}

.search-overlay.is-xs .search-result-item {
  gap: 8px;
  padding: 6px 8px;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-shortcut {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  background: var(--inset-bg);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.quick-card {
  margin: 12px 16px 0;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quick-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-kind {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.4px;
}

.quick-size {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.quick-spacer {
  flex: 1;
}

.quick-close {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-size-md);
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.quick-close:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.quick-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.quick-swatch {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.quick-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quick-row {
  display: flex;
  gap: 12px;
  font-size: var(--font-size-sm);
  min-width: 0;
}

.quick-row-label {
  width: 64px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.quick-row-value {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-pre {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--inset-bg);
  color: var(--text-secondary);
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.quick-actions {
  display: flex;
  gap: 8px;
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-tertiary);
  padding: 8px 16px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recent-section {
  border-bottom: 1px solid var(--border-color);
}

.recent-tools {
  display: flex;
  gap: 12px;
  padding: 8px 16px 12px;
}

.recent-tool-item {
  cursor: pointer;
  transition: var(--transition-fast);
  border-radius: var(--radius-sm);
}

.recent-tool-item:hover {
  transform: scale(1.05);
}

.all-tools-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.all-tools-section .search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-group-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  padding: 8px 12px 4px;
  letter-spacing: 0.4px;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.search-result-item:hover,
.search-result-item.active {
  background: rgba(var(--accent-rgb), 0.08);
}

.search-result-item.active {
  background: rgba(var(--accent-rgb), 0.14);
  box-shadow: inset 2px 0 0 var(--accent-color);
}

.tool-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-gradient);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.tool-icon :deep(svg) {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
  color: var(--text-inverse);
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.tool-desc {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-kind {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--inset-bg);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 500;
  vertical-align: middle;
}

.search-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--font-size-base);
}

/* 入场动画只作用于卡片：遮罩层始终不透明，动画帧被节流时也不会留下不可见却拦截点击的全屏层 */
@keyframes search-modal-in {
  from {
    transform: translateY(-8px) scale(0.98);
    opacity: 0.85;
  }
}

@media (prefers-reduced-motion: reduce) {
  .search-modal {
    animation: none;
  }
}
</style>
