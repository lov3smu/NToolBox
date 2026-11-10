<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="search-overlay" @click.self="close">
        <div class="search-modal">
          <div class="search-input-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
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
              @keydown.enter="selectCurrent($event)"
              @keydown.esc="close"
            />
            <span class="search-shortcut">ESC</span>
          </div>
          <div v-if="recentTools.length > 0 && !searchQuery.trim()" class="recent-section">
            <div class="section-title">最近使用</div>
            <div class="recent-tools">
              <div
                v-for="tool in recentTools"
                :key="tool.path"
                class="recent-tool-item"
                :title="tool.name"
                @click="selectTool(tool)"
              >
                <div class="tool-icon" v-html="tool.icon" />
              </div>
            </div>
          </div>
          <div v-if="!searchQuery.trim()" class="all-tools-section">
            <div class="section-title">所有工具</div>
            <div ref="resultsRef" class="search-results">
              <div
                v-for="(tool, index) in tools"
                :key="tool.path"
                class="search-result-item"
                :class="{ active: activeIndex === index }"
                @click="selectTool(tool)"
                @mouseenter="activeIndex = index"
              >
                <div class="tool-icon" v-html="tool.icon" />
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
          <div v-else-if="filteredTools.length > 0" ref="resultsRef" class="search-results">
            <div
              v-for="(tool, index) in filteredTools"
              :key="tool.path"
              class="search-result-item"
              :class="{ active: activeIndex === index }"
              @click="selectTool(tool)"
              @mouseenter="activeIndex = index"
            >
              <div class="tool-icon" v-html="tool.icon" />
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
          <div v-else-if="searchQuery" class="search-empty">
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
import { tools, getRecentTools, addToRecent, searchTools, SETTINGS_PATH } from '@shared/tools'

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
const resultsRef = ref(null)
const activeIndex = ref(0)

const recentTools = computed(() => getRecentTools())

const filteredTools = computed(() => searchTools(searchQuery.value))

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      nextTick(() => {
        searchInput.value?.focus()
      })
    } else {
      searchQuery.value = ''
      activeIndex.value = 0
    }
  }
)

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
  if (activeIndex.value < filteredTools.value.length - 1) {
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
  if (filteredTools.value[activeIndex.value]) {
    selectTool(filteredTools.value[activeIndex.value])
  }
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
  background: rgba(0, 0, 0, 0.45);
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
  color: white;
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

.search-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--font-size-base);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}

.fade-enter-active .search-modal,
.fade-leave-active .search-modal {
  transition:
    transform var(--motion-panel) var(--motion-ease),
    opacity var(--motion-panel) var(--motion-ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .search-modal,
.fade-leave-to .search-modal {
  transform: translateY(-8px) scale(0.98);
  opacity: 0;
}
</style>
