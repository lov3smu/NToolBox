<template>
  <PageLayout tool-path="/file-manager">
    <template #header-extra>
      <div v-if="currentPath" class="breadcrumb">
        <span class="breadcrumb-item" @click="navigateToRoot">根目录</span>
        <span v-for="(part, index) in pathParts" :key="index" class="breadcrumb-path">
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-item" @click="navigateToPath(index)">{{ part }}</span>
        </span>
      </div>
    </template>

    <template #actions>
      <button class="btn btn-secondary btn-sm" :disabled="isAtRoot" @click="goToParent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19V5M5 12l7-7l7 7" />
        </svg>
        返回上一级
      </button>
      <span class="toolbar-sep" />
      <div class="segmented">
        <button
          class="segmented-item"
          :class="{ active: viewMode === 'list' }"
          title="列表视图"
          @click="viewMode = 'list'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button
          class="segmented-item"
          :class="{ active: viewMode === 'grid' }"
          title="平铺视图"
          @click="viewMode = 'grid'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
          </svg>
        </button>
      </div>
      <button
        class="btn-icon btn-sm"
        :class="{ active: compactMode }"
        title="紧凑风格"
        @click="compactMode = !compactMode"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>
      <span class="toolbar-sep" />
      <button
        class="btn-icon btn-sm"
        :class="{ active: sortMenu.show }"
        :title="`排序：${activeSortLabel}`"
        aria-label="排序方式"
        @click.stop="toggleSortMenu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h12M4 12h8M4 18h4" />
          <path d="M18 6v12M15 15l3 3l3-3" />
        </svg>
      </button>
      <div class="file-search">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20l-3.5-3.5" />
        </svg>
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="搜索当前目录"
          spellcheck="false"
          @input="onSearchInput"
          @keydown.esc="clearSearch"
        />
        <button v-if="searchQuery" class="search-clear" title="清除搜索" @click="clearSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </template>

    <div
      v-if="sortMenu.show"
      class="context-menu sort-menu"
      :style="{ top: sortMenu.y + 'px', left: sortMenu.x + 'px' }"
      @click.stop
    >
      <div
        v-for="option in SORT_OPTIONS"
        :key="option.label"
        class="context-menu-item sort-menu-item"
        :class="{ active: isActiveSort(option) }"
        @click="selectSort(option)"
      >
        <span>{{ option.label }}</span>
        <svg
          v-if="isActiveSort(option)"
          class="sort-check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    </div>
    <div class="page-body">
      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="error && !isDirectoryNotExist" class="error-message">
        {{ error }}
      </div>

      <div v-else-if="!config?.base_path || isDirectoryNotExist" class="empty-message">
        文件目录未设置，请到设置中设置
      </div>

      <div v-else-if="isSearchMode && searching" class="loading">搜索中...</div>

      <div v-else-if="isSearchMode && searchError" class="error-message">{{ searchError }}</div>

      <div v-else-if="isSearchMode && searchResults.length === 0" class="empty-message">未找到匹配的文件或文件夹</div>

      <div v-else-if="!isSearchMode && directories.length === 0 && files.length === 0" class="empty-message">
        暂时没有文件哦!
      </div>

      <template v-else>
        <div v-if="isSearchMode" class="search-summary">
          找到 {{ searchResults.length }} 个匹配项{{ searchTruncated ? '（结果过多，仅显示前 500 项）' : '' }}
        </div>

        <div :class="['file-list', viewMode, { compact: compactMode }]">
          <div
            v-for="item in displayedItems"
            :key="item.path"
            :class="['file-item', item.isDirectory ? 'directory' : 'file']"
            @click="handleItemClick(item)"
            @contextmenu.prevent="showContextMenu($event, item)"
          >
            <svg
              v-if="item.isDirectory"
              class="item-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
            <svg v-else class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
              <path d="M14 3v5h5" />
            </svg>
            <div class="item-main">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="isSearchMode && parentPathOf(item.relativePath)" class="item-sub">{{
                parentPathOf(item.relativePath)
              }}</span>
            </div>
            <div v-if="viewMode === 'list'" class="item-meta">
              <span class="item-size">{{ formatItemSize(item.size) }}</span>
              <span class="item-time">{{ formatTime(item.created) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div class="context-menu-item" @click="openItem">打开</div>
      <div class="context-menu-separator" />
      <div v-if="contextMenu.item?.isDirectory" class="context-menu-item" @click="copyDirectoryFiles">
        复制所有文件路径
      </div>
      <div v-if="contextMenu.item?.isDirectory" class="context-menu-item" @click="copyAllFilesPath">
        复制所有文件路径（含子目录）
      </div>
      <div v-if="!contextMenu.item?.isDirectory" class="context-menu-item" @click="copyFilePath">复制文件路径</div>
      <div class="context-menu-separator" />
      <div class="context-menu-item" @click="showProperties">属性</div>
    </div>

    <div v-if="properties.show" class="properties-modal" @click.self="closeProperties">
      <div class="properties-dialog" :style="{ left: properties.x + 'px', top: properties.y + 'px' }">
        <div class="properties-header">
          <h3>{{ properties.info?.name }}</h3>
          <button class="btn-icon btn-sm" title="关闭" @click="closeProperties">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
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
          <div v-if="properties.info?.type === '文件夹'" class="properties-row">
            <span class="properties-label">包含:</span>
            <span class="properties-value"
              >{{ properties.info?.directoryCount }} 个文件夹，{{ properties.info?.fileCount }} 个文件</span
            >
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
    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useToast, useConfig } from '@/composables'
import { readDirectory, searchDirectory, copyToClipboard, openFile, openFolder, getItemInfo } from '@/api'
import { joinPath } from '@/utils/path'
import Toast from '@/components/Toast.vue'
import PageLayout from '@/layouts/PageLayout.vue'

const { toastVisible, toastMessage, toastType, showSuccess, showError } = useToast()
const { config } = useConfig()

const currentPath = ref('')
const directories = ref([])
const files = ref([])
const loading = ref(false)
const error = ref('')
const viewMode = ref('list')
const sortField = ref('time')
const sortOrder = ref('desc')
const sortMenu = ref({ show: false, x: 0, y: 0 })
const SORT_OPTIONS = Object.freeze([
  { field: 'time', order: 'desc', label: '时间（新→旧）' },
  { field: 'time', order: 'asc', label: '时间（旧→新）' },
  { field: 'name', order: 'asc', label: '名称（A→Z）' },
  { field: 'name', order: 'desc', label: '名称（Z→A）' },
  { field: 'size', order: 'desc', label: '大小（大→小）' },
  { field: 'size', order: 'asc', label: '大小（小→大）' }
])
const activeSortLabel = computed(() => {
  const active = SORT_OPTIONS.find((option) => isActiveSort(option))
  return active ? active.label : SORT_OPTIONS[0].label
})
const compactMode = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
const searchError = ref('')
const searchTruncated = ref(false)
const isSearchMode = computed(() => searchQuery.value.trim().length > 0)

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

const nameCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

function compareItems(a, b) {
  if (sortField.value === 'name') return nameCollator.compare(a.name, b.name)
  if (sortField.value === 'size') return (a.size || 0) - (b.size || 0)
  return (a.created || 0) - (b.created || 0)
}

function sortItems(items) {
  const direction = sortOrder.value === 'desc' ? -1 : 1
  return [...items].sort((a, b) => {
    const primary = compareItems(a, b) * direction
    return primary !== 0 ? primary : nameCollator.compare(a.name, b.name)
  })
}

const sourceDirectories = computed(() =>
  isSearchMode.value ? searchResults.value.filter((item) => item.isDirectory) : directories.value
)

const sourceFiles = computed(() =>
  isSearchMode.value ? searchResults.value.filter((item) => !item.isDirectory) : files.value
)

const displayedItems = computed(() => [...sortItems(sourceDirectories.value), ...sortItems(sourceFiles.value)])

const isAtRoot = computed(() => {
  if (!currentPath.value || !config.value?.base_path) return true
  const normalizePath = (p) => p.replace(/[\\/]+$/, '').toLowerCase()
  return normalizePath(currentPath.value) === normalizePath(config.value.base_path)
})

const isDirectoryNotExist = computed(() => {
  return (
    error.value &&
    (error.value.includes('ENOENT') || error.value.includes('no such file') || error.value.includes('目录不存在'))
  )
})

let sizeToken = 0

async function loadDirectory(dirPath) {
  loading.value = true
  error.value = ''
  const token = ++sizeToken

  try {
    const result = await readDirectory(dirPath, { withDirectorySize: sortField.value === 'size' })
    if (result.success) {
      directories.value = result.directories
      files.value = result.files
      currentPath.value = dirPath
      if (sortField.value !== 'size' && directories.value.length > 0 && viewMode.value === 'list') {
        loadDirectorySizes(dirPath, token)
      }
    } else {
      error.value = result.error || '读取目录失败'
    }
  } catch (e) {
    error.value = e.message || '读取目录失败'
  } finally {
    loading.value = false
  }
}

async function loadDirectorySizes(dirPath, token) {
  try {
    const result = await readDirectory(dirPath, { withDirectorySize: true })
    if (!result.success || token !== sizeToken || currentPath.value !== dirPath) return
    const sizes = new Map(result.directories.map((item) => [item.path, item.size]))
    directories.value = directories.value.map((item) =>
      item.isDirectory && sizes.has(item.path) ? { ...item, size: sizes.get(item.path) } : item
    )
  } catch {
    /* 尺寸统计失败时保留占位 */
  }
}

function navigateToRoot() {
  const base = config.value?.base_path
  if (base) {
    resetSearch()
    loadDirectory(base)
  }
}

function navigateToPath(index) {
  const base = config.value?.base_path || ''
  const parts = pathParts.value.slice(0, index + 1)
  resetSearch()
  loadDirectory(joinPath(base, parts))
}

function enterDirectory(dir) {
  resetSearch()
  loadDirectory(dir.path)
}

function handleItemClick(item) {
  if (item.isDirectory) enterDirectory(item)
}

function isActiveSort(option) {
  return option.field === sortField.value && option.order === sortOrder.value
}

function toggleSortMenu(event) {
  if (sortMenu.value.show) {
    sortMenu.value.show = false
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  sortMenu.value = {
    show: true,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 192)),
    y: rect.bottom + 4
  }
}

function selectSort(option) {
  sortField.value = option.field
  sortOrder.value = option.order
  sortMenu.value.show = false
}

function goToParent() {
  if (isAtRoot.value) return

  const base = config.value?.base_path || ''
  const parts = pathParts.value
  if (parts.length > 0) {
    resetSearch()
    loadDirectory(joinPath(base, parts.slice(0, -1)))
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
    showSuccess('已复制文件路径')
  }
  hideContextMenu()
}

async function copyDirectoryFiles() {
  const item = contextMenu.value.item
  if (!item) return

  const success = await copyToClipboard(item.path, false)
  if (success) {
    showSuccess('已复制所有文件路径')
  }
  hideContextMenu()
}

async function copyAllFilesPath() {
  const item = contextMenu.value.item
  if (!item) return

  const success = await copyToClipboard(item.path, true)
  if (success) {
    showSuccess('已复制所有文件路径（含子目录）')
  }
  hideContextMenu()
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

function formatItemSize(size) {
  return size == null ? '—' : formatSize(size)
}

function parentPathOf(relativePath) {
  if (!relativePath) return ''
  const index = Math.max(relativePath.lastIndexOf('/'), relativePath.lastIndexOf('\\'))
  return index > 0 ? relativePath.slice(0, index) : ''
}

let searchTimer = null
let searchToken = 0

function resetSearch() {
  searchToken++
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  searchQuery.value = ''
  searchResults.value = []
  searching.value = false
  searchError.value = ''
  searchTruncated.value = false
}

function clearSearch() {
  const shouldReload = sortField.value === 'size' && currentPath.value
  resetSearch()
  if (shouldReload) loadDirectory(currentPath.value)
}

function onSearchInput() {
  const keyword = searchQuery.value.trim()
  searchToken++
  const token = searchToken

  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }

  searchError.value = ''
  searchTruncated.value = false
  searching.value = true

  if (!keyword) {
    searchResults.value = []
    searching.value = false
    return
  }

  searchTimer = setTimeout(() => {
    searchTimer = null
    if (token === searchToken) performSearch(token)
  }, 300)
}

async function performSearch(token) {
  if (token !== searchToken) return
  const root = currentPath.value
  const keyword = searchQuery.value.trim()
  if (!root || !keyword) return

  searching.value = true
  try {
    const result = await searchDirectory(root, keyword, { withDirectorySize: sortField.value === 'size' })
    if (token !== searchToken) return

    if (result.success) {
      searchResults.value = result.items
      searchTruncated.value = !!result.truncated
      searchError.value = ''
    } else {
      searchResults.value = []
      searchError.value = result.error || '搜索失败'
    }
  } catch (e) {
    if (token !== searchToken) return
    searchResults.value = []
    searchError.value = e.message || '搜索失败'
  } finally {
    if (token === searchToken) searching.value = false
  }
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
    showError(result.error || '获取信息失败')
  }
}

function closeProperties() {
  properties.value.show = false
}

function handleClickOutside() {
  if (contextMenu.value.show) {
    hideContextMenu()
  }
  if (sortMenu.value.show) {
    sortMenu.value.show = false
  }
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  sortMenu.value.show = false
  hideContextMenu()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

watch(
  () => config.value?.base_path,
  (basePath) => {
    if (basePath) {
      resetSearch()
      loadDirectory(basePath)
    }
  }
)

watch(sortField, (field) => {
  if (field !== 'size') return
  if (isSearchMode.value) {
    searchToken++
    performSearch(searchToken)
  } else if (currentPath.value) {
    loadDirectory(currentPath.value)
  }
})

watch(viewMode, (mode) => {
  if (mode !== 'list' || isSearchMode.value || !currentPath.value) return
  if (directories.value.some((item) => item.isDirectory && item.size == null)) {
    loadDirectorySizes(currentPath.value, sizeToken)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
.breadcrumb {
  font-size: var(--font-size-sm);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  color: var(--text-secondary);
}

.breadcrumb-item {
  cursor: pointer;
  padding: 1px 5px;
  border-radius: 4px;
  transition: background 0.15s;
}

.breadcrumb-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.breadcrumb-separator {
  color: var(--text-tertiary);
}

.page-body {
  padding: 12px 16px 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.loading,
.error-message,
.empty-message {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-tertiary);
  font-size: var(--font-size-dense);
}

.error-message {
  color: var(--error-dark);
}

.segmented-item {
  min-width: 30px;
  padding: 0 8px;
  gap: 4px;
}

.segmented-item svg {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
}

.file-search {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s;
}

.file-search:focus-within {
  border-color: var(--accent-color);
}

.search-icon {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.search-input {
  width: 170px;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.search-clear:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.search-clear svg {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
}

.search-summary {
  margin-bottom: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.file-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  background: transparent;
  border: none;
  padding: 0;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;
  min-width: 0;
}

.file-list.grid .file-item {
  flex-direction: column;
  padding: 16px 12px;
  text-align: center;
  background: var(--surface);
  border-color: var(--border-color);
}

.file-item:hover {
  background: var(--surface-hover);
}

.file-list.grid .file-item:hover {
  border-color: var(--border-strong);
}

.file-item.directory:hover {
  background: rgba(var(--accent-rgb), 0.06);
}

.item-icon {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  margin-right: 10px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.file-item.directory .item-icon {
  color: var(--accent-color);
}

.file-list.grid .item-icon {
  width: 28px;
  height: 28px;
  margin-right: 0;
  margin-bottom: 8px;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.item-name {
  min-width: 0;
  font-size: var(--font-size-dense);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-sub {
  min-width: 0;
  margin-top: 1px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-list.grid .item-main {
  width: 100%;
  align-items: center;
}

.file-list.grid .item-name {
  flex: none;
  font-size: var(--font-size-sm);
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  margin-left: 16px;
}

.item-size {
  min-width: 72px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.item-time {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.file-list.compact {
  gap: 0;
}

.file-list.compact .file-item {
  padding: 4px 8px;
}

.file-list.compact .item-icon {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  margin-right: 8px;
}

.file-list.compact .item-name {
  font-size: var(--font-size-sm);
}

.file-list.compact .item-meta {
  gap: 10px;
  margin-left: 10px;
}

.file-list.compact .item-size,
.file-list.compact .item-time {
  font-size: var(--font-size-xs);
}

.file-list.compact .item-size {
  min-width: 60px;
}

.file-list.grid.compact {
  gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
}

.file-list.grid.compact .file-item {
  padding: 10px;
}

.file-list.grid.compact .item-icon {
  width: 22px;
  height: 22px;
  margin-bottom: 4px;
}

.file-list.grid.compact .item-name {
  font-size: var(--font-size-sm);
}

.context-menu {
  position: fixed;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(20, 20, 24, 0.14);
  padding: 4px;
  min-width: 180px;
  z-index: 1000;
}

.context-menu-item {
  padding: 7px 10px;
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.sort-menu {
  min-width: 176px;
}

.sort-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  white-space: nowrap;
}

.sort-menu-item.active {
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent-color);
}

.sort-check {
  width: var(--icon-size-2xs);
  height: var(--icon-size-2xs);
  flex-shrink: 0;
}

.context-menu-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px;
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
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgba(20, 20, 24, 0.18);
  width: 400px;
  max-width: 90vw;
  overflow: hidden;
  z-index: 9999;
}

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.properties-header h3 {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.properties-content {
  padding: 8px 16px 12px;
}

.properties-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.properties-row:last-child {
  border-bottom: none;
}

.properties-label {
  width: 80px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.properties-value {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-dense);
  color: var(--text-primary);
  word-break: break-all;
}

.properties-value.location {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .search-input {
    width: 120px;
  }
}
</style>
