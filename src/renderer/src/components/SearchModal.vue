<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="search-overlay"
        @click.self="close"
      >
        <div class="search-modal">
          <div class="search-input-wrapper">
            <svg
              class="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              class="search-input"
              placeholder="搜索工具..."
              @keydown.down="navigateDown"
              @keydown.up="navigateUp"
              @keydown.enter="selectCurrent"
              @keydown.esc="close"
            >
            <span class="search-shortcut">ESC</span>
          </div>
          <div
            v-if="recentTools.length > 0 && !searchQuery.trim()"
            class="recent-section"
          >
            <div class="section-title">
              最近使用
            </div>
            <div class="recent-tools">
              <div
                v-for="tool in recentTools"
                :key="tool.path"
                class="recent-tool-item"
                :title="tool.name"
                @click="selectTool(tool)"
              >
                <div
                  class="tool-icon"
                  v-html="tool.icon"
                />
              </div>
            </div>
          </div>
          <div
            v-if="!searchQuery.trim()"
            class="all-tools-section"
          >
            <div class="section-title">
              所有工具
            </div>
            <div class="search-results">
              <div
                v-for="(tool, index) in tools"
                :key="tool.path"
                class="search-result-item"
                :class="{ active: activeIndex === index }"
                @click="selectTool(tool)"
                @mouseenter="activeIndex = index"
              >
                <div
                  class="tool-icon"
                  v-html="tool.icon"
                />
                <div class="tool-info">
                  <div class="tool-name">
                    {{ tool.name }}
                  </div>
                  <div class="tool-desc">
                    {{ tool.description }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="filteredTools.length > 0"
            class="search-results"
          >
            <div
              v-for="(tool, index) in filteredTools"
              :key="tool.path"
              class="search-result-item"
              :class="{ active: activeIndex === index }"
              @click="selectTool(tool)"
              @mouseenter="activeIndex = index"
            >
              <div
                class="tool-icon"
                v-html="tool.icon"
              />
              <div class="tool-info">
                <div class="tool-name">
                  {{ tool.name }}
                </div>
                <div class="tool-desc">
                  {{ tool.description }}
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="searchQuery"
            class="search-empty"
          >
            <span>未找到匹配的工具</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { openSettings } from '@/api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const router = useRouter()
const searchQuery = ref('')
const searchInput = ref(null)
const activeIndex = ref(0)

const RECENT_TOOLS_KEY = 'recent_tools'
const MAX_RECENT = 3

const tools = [
  {
    name: '首页',
    description: '工具集首页',
    path: '/',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`
  },
  {
    name: 'SQL脚本生成',
    description: 'SQL脚本生成工具',
    path: '/sql-generator',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`
  },
  {
    name: 'AI聊天助手',
    description: '智能对话，解答编程问题',
    path: '/chat',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`
  },
  {
    name: '密码生成',
    description: '生成随机密码',
    path: '/password',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`
  },
  {
    name: 'Cron表达式',
    description: 'Cron表达式生成器',
    path: '/cron',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`
  },
  {
    name: '时间戳转换',
    description: 'Unix时间戳转换工具',
    path: '/unixtimestamp',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`
  },
  {
    name: 'YAML编辑器',
    description: 'YAML格式编辑器',
    path: '/yaml-editor',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`
  },
  {
    name: '文件管理',
    description: '文件管理工具',
    path: '/file-manager',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>`
  },
  {
    name: 'JSON解析',
    description: 'JSON格式化与解析',
    path: '/json-parser',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <polyline points="4 17 4 20 20 20 20 17"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>`
  },
  {
    name: 'HTML预览',
    description: 'HTML代码预览工具',
    path: '/html-viewer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>`
  },
  {
    name: '设置',
    description: '应用程序设置',
    path: '/settings',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`
  }
]

const recentTools = computed(() => {
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]')
    return recent.slice(0, MAX_RECENT).map(path => tools.find(t => t.path === path)).filter(Boolean)
  } catch {
    return []
  }
})

function addToRecent(tool) {
  try {
    let recent = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]')
    recent = recent.filter(p => p !== tool.path)
    recent.unshift(tool.path)
    recent = recent.slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(recent))
  } catch {
    // ignore
  }
}

const filteredTools = computed(() => {
  if (!searchQuery.value.trim()) {
    return tools
  }
  const query = searchQuery.value.toLowerCase()
  return tools.filter(tool =>
    tool.name.toLowerCase().includes(query) ||
    tool.description.toLowerCase().includes(query)
  )
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      searchInput.value?.focus()
    })
  } else {
    searchQuery.value = ''
    activeIndex.value = 0
  }
})

watch(searchQuery, () => {
  activeIndex.value = 0
})

function navigateDown() {
  if (activeIndex.value < filteredTools.value.length - 1) {
    activeIndex.value++
  }
}

function navigateUp() {
  if (activeIndex.value > 0) {
    activeIndex.value--
  }
}

function selectCurrent() {
  if (filteredTools.value[activeIndex.value]) {
    selectTool(filteredTools.value[activeIndex.value])
  }
}

function selectTool(tool) {
  if (tool.path === '/settings') {
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
  background: rgba(0, 0, 0, 0.5);
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
  max-height: 500px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255, 255, 255, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.search-icon {
  width: 20px;
  height: 20px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  background: transparent;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-shortcut {
  font-size: 12px;
  color: var(--text-tertiary);
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.section-title {
  font-size: 12px;
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

.recent-tool-item .tool-icon {
  width: 48px;
  height: 48px;
}

.recent-tool-item .tool-icon :deep(svg) {
  width: 24px;
  height: 24px;
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
  background: rgba(102, 126, 234, 0.1);
}

.search-result-item.active {
  background: rgba(102, 126, 234, 0.15);
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
  width: 20px;
  height: 20px;
  color: white;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.tool-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-active .search-modal,
.fade-leave-active .search-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .search-modal,
.fade-leave-to .search-modal {
  transform: translateY(-20px) scale(0.98);
  opacity: 0;
}
</style>