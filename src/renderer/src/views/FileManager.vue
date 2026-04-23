<template>
  <div
    class="file-manager-container"
    :style="{ width: windowWidth + 'px' }"
  >
    <header>
      <h1>
        <svg
          class="header-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        文件管理器
      </h1>
      <div
        v-if="currentPath"
        class="breadcrumb"
      >
        <span
          class="breadcrumb-item"
          @click="navigateToRoot"
        >根目录</span>
        <span
          v-for="(part, index) in pathParts"
          :key="index"
          class="breadcrumb-path"
        >
          <span class="breadcrumb-separator">/</span>
          <span
            class="breadcrumb-item"
            @click="navigateToPath(index)"
          >{{ part }}</span>
        </span>
      </div>
    </header>

    <div class="main-content">
      <div class="toolbar">
        <div class="nav-controls">
          <button 
            class="back-btn" 
            :disabled="isAtRoot"
            title="返回上一级"
            @click="goToParent"
          >
            ↑ 返回上一级
          </button>
        </div>
        <div class="view-controls">
          <button 
            class="view-btn" 
            :class="{ active: viewMode === 'list' }"
            title="列表视图"
            @click="viewMode = 'list'"
          >
            ☰
          </button>
          <button 
            class="view-btn" 
            :class="{ active: viewMode === 'grid' }"
            title="平铺视图"
            @click="viewMode = 'grid'"
          >
            ⊞
          </button>
          <button 
            class="view-btn compact-toggle" 
            :class="{ active: compactMode }"
            title="紧凑风格"
            @click="compactMode = !compactMode"
          >
            ≡
          </button>
        </div>
        <div class="sort-controls">
          <span class="sort-label">时间排序:</span>
          <button 
            class="sort-btn" 
            :class="{ active: sortOrder === 'desc' }"
            @click="sortOrder = 'desc'"
          >
            倒序
          </button>
          <button 
            class="sort-btn" 
            :class="{ active: sortOrder === 'asc' }"
            @click="sortOrder = 'asc'"
          >
            正序
          </button>
        </div>
      </div>
      
      <div
        v-if="loading"
        class="loading"
      >
        加载中...
      </div>
      
      <div
        v-else-if="error && !isDirectoryNotExist"
        class="error-message"
      >
        {{ error }}
      </div>
      
      <div
        v-else-if="!config?.base_path || isDirectoryNotExist"
        class="empty-message"
      >
        文件目录未设置，请到设置中设置
      </div>
      
      <div
        v-else-if="directories.length === 0 && files.length === 0"
        class="empty-message"
      >
        暂时没有文件哦!
      </div>
      
      <div
        v-else
        :class="['file-list', viewMode, { compact: compactMode }]"
      >
        <div
          v-for="dir in sortedDirectories"
          :key="dir.path"
          class="file-item directory"
          @click="enterDirectory(dir)"
          @contextmenu.prevent="showContextMenu($event, dir)"
        >
          <span class="item-icon">📁</span>
          <span class="item-name">{{ dir.name }}</span>
          <span
            v-if="viewMode === 'list'"
            class="item-time"
          >{{ formatTime(dir.created) }}</span>
        </div>
        
        <div
          v-for="file in sortedFiles"
          :key="file.path"
          class="file-item file"
          @contextmenu.prevent="showContextMenu($event, file)"
        >
          <span class="item-icon">📄</span>
          <span class="item-name">{{ file.name }}</span>
          <span
            v-if="viewMode === 'list'"
            class="item-time"
          >{{ formatTime(file.created) }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div
        class="context-menu-item"
        @click="openItem"
      >
        打开
      </div>
      <div class="context-menu-separator" />
      <div
        v-if="contextMenu.item?.isDirectory"
        class="context-menu-item"
        @click="copyDirectoryFiles"
      >
        复制所有文件路径
      </div>
      <div
        v-if="contextMenu.item?.isDirectory"
        class="context-menu-item"
        @click="copyAllFilesPath"
      >
        复制所有文件路径（含子目录）
      </div>
      <div
        v-if="!contextMenu.item?.isDirectory"
        class="context-menu-item"
        @click="copyFilePath"
      >
        复制文件路径
      </div>
      <div class="context-menu-separator" />
      <div
        class="context-menu-item"
        @click="showProperties"
      >
        属性
      </div>
    </div>

    <div
      v-if="properties.show"
      class="properties-modal"
      @click.self="closeProperties"
    >
      <div
        class="properties-dialog"
        :style="{ left: properties.x + 'px', top: properties.y + 'px' }"
      >
        <div class="properties-header">
          <h3>{{ properties.info?.type === '文件夹' ? '📁' : '📄' }} {{ properties.info?.name }}</h3>
          <button
            class="close-btn"
            @click="closeProperties"
          >
            ×
          </button>
        </div>
        <div class="properties-content">
          <div class="properties-row">
            <span class="properties-label">类型:</span>
            <span class="properties-value">{{ properties.info?.type }}</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">位置:</span>
            <span class="properties-value location">{{ properties.info?.location }}</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">大小:</span>
            <span class="properties-value">{{ formatSize(properties.info?.size) }}</span>
          </div>
          <div
            v-if="properties.info?.type === '文件夹'"
            class="properties-row"
          >
            <span class="properties-label">包含:</span>
            <span class="properties-value">{{ properties.info?.directoryCount }} 个文件夹，{{ properties.info?.fileCount }} 个文件</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">创建时间:</span>
            <span class="properties-value">{{ formatTime(properties.info?.created) }}</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">修改时间:</span>
            <span class="properties-value">{{ formatTime(properties.info?.modified) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWindowWidth } from '@/composables'
import { readDirectory, copyToClipboard, onConfigChanged, getConfig, openFile, openFolder, getItemInfo } from '@/api'

const windowWidth = useWindowWidth()

const config = ref(null)

const currentPath = ref('')
const directories = ref([])
const files = ref([])
const loading = ref(false)
const error = ref('')
const viewMode = ref('list')
const sortOrder = ref('desc')
const compactMode = ref(false)

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  item: null
})

const properties = ref({
  show: false,
  info: null,
  x: 0,
  y: 0
})

const pathParts = computed(() => {
  if (!currentPath.value) return []
  const base = config.value?.base_path || ''
  const relative = currentPath.value.replace(base, '').replace(/^[\\/]/, '')
  return relative ? relative.split(/[\\/]/).filter(Boolean) : []
})

const sortedDirectories = computed(() => {
  const sorted = [...directories.value]
  if (sortOrder.value === 'desc') {
    return sorted.sort((a, b) => b.created - a.created)
  } else {
    return sorted.sort((a, b) => a.created - b.created)
  }
})

const sortedFiles = computed(() => {
  const sorted = [...files.value]
  if (sortOrder.value === 'desc') {
    return sorted.sort((a, b) => b.created - a.created)
  } else {
    return sorted.sort((a, b) => a.created - b.created)
  }
})

const isAtRoot = computed(() => {
  if (!currentPath.value || !config.value?.base_path) return true
  const normalizePath = (p) => p.replace(/[\\/]+$/, '').toLowerCase()
  return normalizePath(currentPath.value) === normalizePath(config.value.base_path)
})

const isDirectoryNotExist = computed(() => {
  return error.value && (
    error.value.includes('ENOENT') || 
    error.value.includes('no such file') ||
    error.value.includes('目录不存在')
  )
})

async function loadDirectory(dirPath) {
  loading.value = true
  error.value = ''
  
  try {
    const result = await readDirectory(dirPath)
    if (result.success) {
      directories.value = result.directories
      files.value = result.files
      currentPath.value = dirPath
    } else {
      error.value = result.error || '读取目录失败'
    }
  } catch (e) {
    error.value = e.message || '读取目录失败'
  } finally {
    loading.value = false
  }
}

function navigateToRoot() {
  const base = config.value?.base_path
  if (base) {
    loadDirectory(base)
  }
}

function navigateToPath(index) {
  const base = config.value?.base_path || ''
  const parts = pathParts.value.slice(0, index + 1)
  const newPath = base + (base.endsWith('\\') || base.endsWith('/') ? '' : '\\') + parts.join('\\')
  loadDirectory(newPath)
}

function enterDirectory(dir) {
  loadDirectory(dir.path)
}

function goToParent() {
  if (isAtRoot.value) return
  
  const base = config.value?.base_path || ''
  const parts = pathParts.value
  if (parts.length > 0) {
    const parentParts = parts.slice(0, -1)
    const parentPath = base + (base.endsWith('\\') || base.endsWith('/') ? '' : '\\') + parentParts.join('\\')
    loadDirectory(parentPath)
  }
}

function showContextMenu(event, item) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    item
  }
}

function hideContextMenu() {
  contextMenu.value.show = false
}

async function openItem() {
  const item = contextMenu.value.item
  if (!item) return
  
  if (item.isDirectory) {
    await openFolder(item.path)
  } else {
    await openFile(item.path)
  }
  hideContextMenu()
}

async function copyFilePath() {
  const item = contextMenu.value.item
  if (!item) return
  
  const success = await copyToClipboard(item.path)
  if (success) {
    showToast('已复制文件路径')
  }
  hideContextMenu()
}

async function copyDirectoryFiles() {
  const item = contextMenu.value.item
  if (!item) return
  
  const success = await copyToClipboard(item.path, false)
  if (success) {
    showToast('已复制所有文件路径')
  }
  hideContextMenu()
}

async function copyAllFilesPath() {
  const item = contextMenu.value.item
  if (!item) return
  
  const success = await copyToClipboard(item.path, true)
  if (success) {
    showToast('已复制所有文件路径（含子目录）')
  }
  hideContextMenu()
}

function showToast(message) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.innerHTML = `<span class="toast-icon">✓</span><span class="toast-message">${message}</span>`
  document.body.appendChild(toast)
  
  setTimeout(() => {
    toast.classList.add('show')
  }, 10)
  
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

async function showProperties() {
  const item = contextMenu.value.item
  const x = contextMenu.value.x
  const y = contextMenu.value.y
  if (!item) return
  hideContextMenu()
  
  const result = await getItemInfo(item.path)
  if (result.success) {
    properties.value = {
      show: true,
      info: result.info,
      x,
      y
    }
  } else {
    showToast(result.error || '获取信息失败')
  }
}

function closeProperties() {
  properties.value.show = false
}

function handleClickOutside(e) {
  if (contextMenu.value.show) {
    hideContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  getConfig().then(initialConfig => {
    if (initialConfig?.base_path) {
      config.value = initialConfig
      loadDirectory(initialConfig.base_path)
    }
  })
  
  onConfigChanged(() => {
    getConfig().then(newConfig => {
      config.value = newConfig
      if (newConfig?.base_path) {
        loadDirectory(newConfig.base_path)
      }
    })
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.file-manager-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
}

.file-manager-container header {
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.95) 0%, 
    rgba(118, 75, 162, 0.95) 100%
  );
  color: white;
  padding: 20px 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.file-manager-container header h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  margin-bottom: 10px;
}

.file-manager-container header h1 .header-icon {
  width: 28px;
  height: 28px;
}

.breadcrumb {
  font-size: 13px;
  opacity: 0.9;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.breadcrumb-item {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.2s;
}

.breadcrumb-item:hover {
  background: rgba(255, 255, 255, 0.2);
}

.breadcrumb-separator {
  opacity: 0.7;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.view-controls, .sort-controls, .nav-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-btn {
  padding: 8px 16px;
  border: 1px solid var(--primary-color);
  background: var(--primary-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  color: white;
  transition: all 0.2s;
  font-weight: 500;
}

.back-btn:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.8);
  border-color: rgba(102, 126, 234, 0.8);
}

.back-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(200, 200, 200, 0.5);
  border-color: rgba(200, 200, 200, 0.5);
  color: var(--text-tertiary);
}

.view-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 16px;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.view-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: var(--primary-color);
}

.view-btn.active {
  background: var(--primary-gradient);
  color: white;
  border-color: transparent;
}

.sort-btn {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.sort-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: var(--primary-color);
}

.sort-btn.active {
  background: var(--primary-gradient);
  color: white;
  border-color: transparent;
}

.sort-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.loading, .error-message, .empty-message {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 15px;
}

.error-message {
  color: #e74c3c;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.file-list.grid .file-item {
  flex-direction: column;
  padding: 16px;
  text-align: center;
}

.file-item:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(102, 126, 234, 0.3);
}

.file-item.directory:hover {
  background: rgba(102, 126, 234, 0.1);
}

.item-icon {
  font-size: 20px;
  margin-right: 12px;
  flex-shrink: 0;
}

.file-list.grid .item-icon {
  font-size: 32px;
  margin-right: 0;
  margin-bottom: 8px;
}

.item-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-list.grid .item-name {
  flex: none;
  font-size: 13px;
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
}

.item-time {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  margin-left: 16px;
}

.file-list.compact {
  gap: 2px;
}

.file-list.compact .file-item {
  padding: 6px 10px;
}

.file-list.compact .item-icon {
  font-size: 16px;
  margin-right: 8px;
}

.file-list.compact .item-name {
  font-size: 13px;
}

.file-list.compact .item-time {
  font-size: 11px;
  margin-left: 10px;
}

.file-list.grid.compact {
  gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
}

.file-list.grid.compact .file-item {
  padding: 10px;
}

.file-list.grid.compact .item-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.file-list.grid.compact .item-name {
  font-size: 12px;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 180px;
  z-index: 1000;
}

.context-menu-item {
  padding: 10px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.context-menu-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.properties-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.properties-dialog {
  position: fixed;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 400px;
  max-width: 90vw;
  z-index: 9999;
}

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--primary-gradient);
  color: white;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.properties-header h3 {
  font-size: 16px;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.properties-content {
  padding: 20px;
}

.properties-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid rgba(224, 224, 224, 0.5);
}

.properties-row:last-child {
  border-bottom: none;
}

.properties-label {
  width: 80px;
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.properties-value {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
  word-break: break-all;
}

.properties-value.location {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>