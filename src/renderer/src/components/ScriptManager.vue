<template>
  <section class="panel script-manager">
    <div class="panel-header sm-header">
      <div class="sm-title">
        <span class="panel-title">{{ t('脚本管理') }}</span>
        <span class="panel-hint">{{ t('浏览并管理脚本根目录下的文件') }}</span>
      </div>
      <div class="sm-toolbar">
        <button
          class="btn-icon btn-sm"
          :disabled="isAtRoot"
          :title="t('返回上一级')"
          :aria-label="t('返回上一级')"
          @click="goToParent"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M5 12l7-7l7 7" />
          </svg>
        </button>
        <button
          class="btn-icon btn-sm"
          :class="{ active: loading }"
          :title="t('刷新')"
          :aria-label="t('刷新')"
          @click="refresh"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 11a8 8 0 1 0-2.34 5.66" />
            <path d="M20 4v7h-7" />
          </svg>
        </button>
        <span class="toolbar-sep" />
        <div class="segmented">
          <button
            class="segmented-item"
            :class="{ active: viewMode === 'list' }"
            :title="t('列表视图')"
            :aria-label="t('列表视图')"
            @click="viewMode = 'list'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            class="segmented-item"
            :class="{ active: viewMode === 'grid' }"
            :title="t('平铺视图')"
            :aria-label="t('平铺视图')"
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
          :title="t('紧凑风格')"
          :aria-label="t('紧凑风格')"
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
          :title="t('排序：{label}', { label: activeSortLabel })"
          :aria-label="t('排序方式')"
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
            :placeholder="t('搜索当前目录')"
            spellcheck="false"
            @input="onSearchInput"
            @keydown.esc="clearSearch"
          />
          <button v-if="searchQuery" class="search-clear" :title="t('清除搜索')" @click="clearSearch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="panel-body sm-body">
      <div class="sm-path">
        <div v-if="root && currentPath" class="breadcrumb">
          <span class="breadcrumb-item" @click="navigateToRoot">{{ t('根目录') }}</span>
          <span v-for="(part, index) in pathParts" :key="index" class="breadcrumb-path">
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item" @click="navigateToPath(index)">{{ part }}</span>
          </span>
        </div>
        <span v-if="isSearchMode" class="search-summary">
          {{ t('找到 {count} 个匹配项', { count: searchResults.length })
          }}{{ searchTruncated ? t('（结果过多，仅显示前 500 项）') : '' }}
        </span>
      </div>

      <div class="sm-scroll">
        <div v-if="!root || isDirectoryNotExist" class="empty-state">
          <span class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              <path d="M9 13h6" />
            </svg>
          </span>
          <p class="empty-state-title">{{ t('文件目录未设置') }}</p>
          <p class="empty-state-hint">{{ t('请先配置脚本根目录。') }}</p>
          <div v-if="!root" class="empty-state-actions">
            <button class="btn btn-secondary btn-sm" @click="goToSettings">{{ t('前往设置') }}</button>
          </div>
        </div>

        <div v-else-if="loading" class="sm-message">{{ t('加载中...') }}</div>

        <div v-else-if="error" class="sm-message is-error">{{ error }}</div>

        <div v-else-if="isSearchMode && searching" class="sm-message">{{ t('搜索中...') }}</div>

        <div v-else-if="isSearchMode && searchError" class="sm-message is-error">{{ searchError }}</div>

        <div v-else-if="isSearchMode && searchResults.length === 0" class="empty-state">
          <span class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <p class="empty-state-title">{{ t('没有匹配的文件或文件夹') }}</p>
          <p class="empty-state-hint">{{ t('试试更换关键词，或切换到其他目录搜索。') }}</p>
        </div>

        <div v-else-if="!isSearchMode && directories.length === 0 && files.length === 0" class="empty-state">
          <span class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
          </span>
          <p class="empty-state-title">{{ t('该目录暂无文件') }}</p>
          <p class="empty-state-hint">{{ t('生成脚本后可在这里查看和管理。') }}</p>
        </div>

        <div v-else :class="['file-list', viewMode, { compact: compactMode }]">
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
      </div>
    </div>

    <div
      v-if="sortMenu.show"
      v-clamp-viewport
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
        <span>{{ t(option.label) }}</span>
        <svg
          v-if="isActiveSort(option)"
          class="sort-check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    </div>

    <div
      v-if="contextMenu.show"
      v-clamp-viewport
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div class="context-menu-item" @click="openItem">{{ t('打开') }}</div>
      <div class="context-menu-separator" />
      <div v-if="contextMenu.item?.isDirectory" class="context-menu-item" @click="copyDirectoryName">
        {{ t('复制目录名称') }}
      </div>
      <div v-else class="context-menu-item" @click="copyFilePath">{{ t('复制文件路径') }}</div>
      <div class="context-menu-separator" />
      <div class="context-menu-item" @click="showProperties">{{ t('属性') }}</div>
    </div>

    <div v-if="properties.show" class="properties-modal" @click.self="closeProperties">
      <div v-clamp-viewport class="properties-dialog" :style="{ left: properties.x + 'px', top: properties.y + 'px' }">
        <div class="properties-header">
          <h3>{{ properties.info?.name }}</h3>
          <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeProperties">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="properties-content">
          <div class="properties-row">
            <span class="properties-label">{{ t('类型:') }}</span>
            <span class="properties-value">{{ properties.info?.type }}</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">{{ t('位置:') }}</span>
            <span class="properties-value location">{{ properties.info?.location }}</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">{{ t('大小:') }}</span>
            <span class="properties-value">{{ formatSize(properties.info?.size) }}</span>
          </div>
          <div v-if="isPropertiesDirectory" class="properties-row">
            <span class="properties-label">{{ t('包含:') }}</span>
            <span class="properties-value">{{
              t('{dirs} 个文件夹，{files} 个文件', {
                dirs: properties.info?.directoryCount,
                files: properties.info?.fileCount
              })
            }}</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">{{ t('创建时间:') }}</span>
            <span class="properties-value">{{ formatTime(properties.info?.created) }}</span>
          </div>
          <div class="properties-row">
            <span class="properties-label">{{ t('修改时间:') }}</span>
            <span class="properties-value">{{ formatTime(properties.info?.modified) }}</span>
          </div>
        </div>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useToast } from '@/composables'
import { readDirectory, searchDirectory, copyToClipboard, openFile, getItemInfo, openSettings } from '@/api'
import { joinPath } from '@/utils/path'
import { copyToClipboard as copyTextToClipboard } from '@/utils'
import Toast from '@/components/Toast.vue'
import { t } from '@/i18n'

const props = defineProps({
  rootPath: { type: String, default: '' }
})

const { toastVisible, toastMessage, toastType, showSuccess, showError } = useToast()

const root = computed(() => (props.rootPath || '').trim())
const currentPath = ref('')
const directories = ref([])
const files = ref([])
const loading = ref(false)
const error = ref('')
const viewMode = ref('list')
const sortField = ref('time')
const sortOrder = ref('desc')
const sortMenu = ref({ show: false, x: 0, y: 0 })
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

const SORT_OPTIONS = Object.freeze([
  {
    field: 'time',
    order: 'desc',
    get label() {
      return t('时间（新→旧）')
    }
  },
  {
    field: 'time',
    order: 'asc',
    get label() {
      return t('时间（旧→新）')
    }
  },
  {
    field: 'name',
    order: 'asc',
    get label() {
      return t('名称（A→Z）')
    }
  },
  {
    field: 'name',
    order: 'desc',
    get label() {
      return t('名称（Z→A）')
    }
  },
  {
    field: 'size',
    order: 'desc',
    get label() {
      return t('大小（大→小）')
    }
  },
  {
    field: 'size',
    order: 'asc',
    get label() {
      return t('大小（小→大）')
    }
  }
])

const activeSortLabel = computed(() => {
  const active = SORT_OPTIONS.find((option) => isActiveSort(option))
  return t(active ? active.label : SORT_OPTIONS[0].label)
})

const isPropertiesDirectory = computed(
  () => properties.value.info?.isDirectory === true || properties.value.info?.type === t('文件夹')
)

const pathParts = computed(() => {
  if (!currentPath.value || !root.value) return []
  const relative = currentPath.value.replace(root.value, '').replace(/^[\\/]/, '')
  return relative ? relative.split(/[\\/]/).filter(Boolean) : []
})

const nameCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

const sourceDirectories = computed(() =>
  isSearchMode.value ? searchResults.value.filter((item) => item.isDirectory) : directories.value
)

const sourceFiles = computed(() =>
  isSearchMode.value ? searchResults.value.filter((item) => !item.isDirectory) : files.value
)

const displayedItems = computed(() => [...sortItems(sourceDirectories.value), ...sortItems(sourceFiles.value)])

const isAtRoot = computed(() => {
  if (!currentPath.value || !root.value) return true
  const normalizePath = (p) => p.replace(/[\\/]+$/, '').toLowerCase()
  return normalizePath(currentPath.value) === normalizePath(root.value)
})

const isDirectoryNotExist = computed(() => {
  return (
    error.value &&
    (error.value.includes('ENOENT') || error.value.includes('no such file') || error.value.includes(t('目录不存在')))
  )
})

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
      error.value = result.error || t('读取目录失败')
    }
  } catch (e) {
    error.value = e.message || t('读取目录失败')
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
  if (!root.value) return
  resetSearch()
  loadDirectory(root.value)
}

function navigateToPath(index) {
  const parts = pathParts.value.slice(0, index + 1)
  resetSearch()
  loadDirectory(joinPath(root.value, parts))
}

function goToSettings() {
  openSettings('sql-generator')
}

function enterDirectory(dir) {
  resetSearch()
  loadDirectory(dir.path)
}

async function openScript(item) {
  try {
    const result = await openFile(item.path)
    if (result && result.success === false) showError(result.error || t('打开失败'))
  } catch (e) {
    showError(e.message || t('打开失败'))
  }
}

function handleItemClick(item) {
  if (item.isDirectory) enterDirectory(item)
  else openScript(item)
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
  const parts = pathParts.value
  if (parts.length > 0) {
    resetSearch()
    loadDirectory(joinPath(root.value, parts.slice(0, -1)))
  }
}

function refresh() {
  if (!root.value) return
  if (isSearchMode.value) {
    searchToken++
    performSearch(searchToken)
    return
  }
  loadDirectory(currentPath.value || root.value)
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
  hideContextMenu()

  if (item.isDirectory) {
    enterDirectory(item)
    return
  }
  await openScript(item)
}

async function copyFilePath() {
  const item = contextMenu.value.item
  if (!item) return

  const success = await copyToClipboard(item.path)
  if (success) {
    showSuccess(t('已复制文件路径'))
  }
  hideContextMenu()
}

async function copyDirectoryName() {
  const item = contextMenu.value.item
  if (!item) return

  const success = await copyTextToClipboard(item.path)
  if (success) {
    showSuccess(t('已复制目录路径'))
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
  const base = currentPath.value
  const keyword = searchQuery.value.trim()
  if (!base || !keyword) return

  searching.value = true
  try {
    const result = await searchDirectory(base, keyword, { withDirectorySize: sortField.value === 'size' })
    if (token !== searchToken) return

    if (result.success) {
      searchResults.value = result.items
      searchTruncated.value = !!result.truncated
      searchError.value = ''
    } else {
      searchResults.value = []
      searchError.value = result.error || t('搜索失败')
    }
  } catch (e) {
    if (token !== searchToken) return
    searchResults.value = []
    searchError.value = e.message || t('搜索失败')
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
    showError(result.error || t('获取信息失败'))
  }
}

function closeProperties() {
  properties.value.show = false
}

function handleClickOutside() {
  if (contextMenu.value.show) hideContextMenu()
  if (sortMenu.value.show) sortMenu.value.show = false
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  sortMenu.value.show = false
  hideContextMenu()
}

watch(
  root,
  (value) => {
    resetSearch()
    contextMenu.value.show = false
    properties.value.show = false
    if (value) {
      loadDirectory(value)
    } else {
      currentPath.value = ''
      directories.value = []
      files.value = []
      error.value = ''
    }
  },
  { immediate: true }
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

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})

defineExpose({ refresh })
</script>

<style scoped>
.script-manager {
  display: flex;
  flex-direction: column;
}

.sm-header {
  flex-wrap: wrap;
  row-gap: 8px;
}

.sm-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.sm-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-left: auto;
}

.sm-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px 12px;
}

.sm-path {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 24px;
}

.sm-scroll {
  margin-top: 8px;
  max-height: 360px;
  overflow-y: auto;
}

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
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.sm-message {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-tertiary);
  font-size: var(--font-size-dense);
}

.sm-message.is-error {
  color: var(--error-dark);
}

.sm-scroll > .empty-state {
  min-height: 200px;
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
  box-shadow: var(--shadow-md);
  padding: 4px;
  min-width: 180px;
  z-index: 2000;
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
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.properties-dialog {
  position: fixed;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 400px;
  max-width: 90vw;
  max-height: calc(100vh - 32px);
  overflow: hidden auto;
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
  .sm-title .panel-hint {
    display: none;
  }

  .search-input {
    width: 120px;
  }
}
</style>
