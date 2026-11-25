<template>
  <section
    class="file-explorer"
    :class="[variant, `size-${size}`, { compact: compactMode, panel: variant === 'panel' }]"
  >
    <div class="fx-header" :class="{ 'panel-header': variant === 'panel' }">
      <div v-if="$slots.title" class="fx-title">
        <slot name="title" />
      </div>
      <div class="fx-toolbar">
        <button
          class="btn-icon btn-sm"
          :title="t('返回上一级')"
          :aria-label="t('返回上一级')"
          :disabled="isAtRoot"
          @click="goToParent"
        >
          <AppIcon name="corner-up-left" />
        </button>
        <button
          class="btn-icon btn-sm"
          :class="{ active: loading }"
          :title="t('刷新')"
          :aria-label="t('刷新')"
          @click="refresh"
        >
          <AppIcon name="refresh" />
        </button>
        <div v-if="currentPath" class="breadcrumb">
          <span class="breadcrumb-item" @click="navigateToRoot">{{ t('根目录') }}</span>
          <span v-for="(part, index) in pathParts" :key="index" class="breadcrumb-path">
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item" @click="navigateToPath(index)">{{ part }}</span>
          </span>
        </div>
        <span class="toolbar-sep" />
        <div class="segmented">
          <button
            class="segmented-item"
            :class="{ active: viewMode === 'list' }"
            :title="t('列表视图')"
            :aria-label="t('列表视图')"
            @click="viewMode = 'list'"
          >
            <AppIcon name="align-justify" />
          </button>
          <button
            class="segmented-item"
            :class="{ active: viewMode === 'grid' }"
            :title="t('平铺视图')"
            :aria-label="t('平铺视图')"
            @click="viewMode = 'grid'"
          >
            <AppIcon name="layout-grid" />
          </button>
        </div>
        <button
          class="btn-icon btn-sm"
          :class="{ active: compactMode }"
          :title="t('紧凑风格')"
          :aria-label="t('紧凑风格')"
          @click="compactMode = !compactMode"
        >
          <AppIcon name="align-left" />
        </button>
        <span class="toolbar-sep" />
        <button
          class="btn-icon btn-sm"
          :class="{ active: sortMenu.show }"
          :title="t('排序：{label}', { label: activeSortLabel })"
          :aria-label="t('排序方式')"
          @click.stop="toggleSortMenu"
        >
          <AppIcon name="sort-descending" />
        </button>
        <div class="file-search">
          <AppIcon name="search" class="search-icon" />
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            :placeholder="t('搜索当前目录')"
            spellcheck="false"
            @input="onSearchInput"
            @keydown.esc="clearSearch"
          />
          <button
            class="search-clear"
            :class="{ 'is-hidden': !searchQuery }"
            :title="t('清除搜索')"
            :tabindex="searchQuery ? 0 : -1"
            @click="clearSearch"
          >
            <AppIcon name="close" />
          </button>
        </div>
      </div>
    </div>

    <div class="fx-body" :class="{ 'panel-body': variant === 'panel' }">
      <div v-if="isSearchMode" class="search-summary">
        {{ t('找到 {count} 个匹配项', { count: searchResults.length })
        }}{{ searchTruncated ? t('（结果过多，仅显示前 500 项）') : '' }}
      </div>

      <div class="fx-scroll">
        <EmptyState
          v-if="!root || isDirectoryNotExist"
          icon="folder-minus"
          :title="t('文件目录未设置')"
          :description="unsetDescriptionText"
        >
          <template #actions>
            <button v-if="!root" class="btn btn-secondary btn-sm" @click="goToSettings">{{ t('前往设置') }}</button>
          </template>
        </EmptyState>

        <div v-else-if="loading" class="fx-message">{{ t('加载中...') }}</div>

        <div v-else-if="error" class="fx-message is-error">{{ error }}</div>

        <div v-else-if="isSearchMode && searching" class="fx-message">{{ t('搜索中...') }}</div>

        <div v-else-if="isSearchMode && searchError" class="fx-message is-error">{{ searchError }}</div>

        <EmptyState
          v-else-if="isSearchMode && searchResults.length === 0"
          icon="search"
          :title="t('没有匹配的文件或文件夹')"
          :description="t('试试更换关键词，或切换到其他目录搜索。')"
        />

        <EmptyState
          v-else-if="!isSearchMode && directories.length === 0 && files.length === 0"
          icon="folder"
          :title="emptyTitleText"
          :description="emptyDescriptionText"
        />

        <div v-else :class="['file-list', viewMode, { compact: compactMode }]">
          <div
            v-for="item in displayedItems"
            :key="item.path"
            :class="['file-item', item.isDirectory ? 'directory' : 'file']"
            role="button"
            tabindex="0"
            :draggable="imageDrag && isImagePath(item.path)"
            @click="handleItemClick(item)"
            @keydown.enter.prevent="handleItemClick(item)"
            @keydown.space.prevent="handleItemClick(item)"
            @contextmenu.prevent="showContextMenu($event, item)"
            @dragstart="onItemDragStart($event, item)"
            @dragend="endResourceDrag"
          >
            <AppIcon v-if="item.isDirectory" name="folder" :stroke-width="1.8" class="item-icon" />
            <AppIcon v-else name="file" :stroke-width="1.8" class="item-icon" />
            <div class="item-main">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="isSearchMode && parentPathOf(item.relativePath)" class="item-sub">{{
                parentPathOf(item.relativePath)
              }}</span>
            </div>
            <div v-if="viewMode === 'list'" class="item-meta">
              <span class="item-size">{{ formatItemSize(item.size) }}</span>
              <span class="item-time">{{ formatDateTime(item.created) }}</span>
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
        <AppIcon v-if="isActiveSort(option)" name="check" class="sort-check" />
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
      <div v-if="contextMenu.item?.isDirectory" class="context-menu-item" @click="copyDirectoryFiles">
        {{ t('复制所有文件路径') }}
      </div>
      <div v-if="contextMenu.item?.isDirectory" class="context-menu-item" @click="copyAllFilesPath">
        {{ t('复制所有文件路径（含子目录）') }}
      </div>
      <div v-if="!contextMenu.item?.isDirectory" class="context-menu-item" @click="copyFilePath">
        {{ t('复制文件路径') }}
      </div>
      <div v-if="canSendContextItem" class="context-menu-item" @click="sendContextItem">{{ t('发送到…') }}</div>
      <div class="context-menu-separator" />
      <div class="context-menu-item" @click="showProperties">{{ t('属性') }}</div>
    </div>

    <FilePropertiesDialog
      :visible="properties.show"
      :info="properties.info"
      :x="properties.x"
      :y="properties.y"
      @close="closeProperties"
    />
    <SendToMenu
      :visible="sendMenu.show"
      :x="sendMenu.x"
      :y="sendMenu.y"
      :resource="sendResource"
      @close="sendMenu.show = false"
      @sent="onSendDone"
    />
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useToast, startResourceDrag, endResourceDrag } from '@/composables'
import {
  readDirectory,
  searchDirectory,
  copyToClipboard,
  openFile,
  openFolder,
  getItemInfo,
  openSettings,
  readTextDocument
} from '@/api'
import { joinPath } from '@/utils/path'
import { copyToClipboard as copyTextToClipboard } from '@/utils/clipboard'
import { t } from '@/i18n'
import { formatBytes, formatDateTime } from '@shared/format'
import { encodeSendResource, isImagePath, sendKindForPath } from '@shared/sendTo'
import FilePropertiesDialog from '@/components/FilePropertiesDialog.vue'
import SendToMenu from '@/components/SendToMenu.vue'

import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps({
  rootPath: { type: String, default: '' },
  variant: { type: String, default: 'panel' },
  size: { type: String, default: 'md' },
  systemOpen: { type: Boolean, default: false },
  imageDrag: { type: Boolean, default: false },
  openFileOnClick: { type: Boolean, default: true },
  emptyTitle: { type: String, default: '' },
  emptyDescription: { type: String, default: '' },
  unsetDescription: { type: String, default: '' }
})

const { showSuccess, showError } = useToast()

const root = computed(() => (props.rootPath || '').trim())
const emptyTitleText = computed(() => props.emptyTitle || t('该目录暂无文件'))
const emptyDescriptionText = computed(() => props.emptyDescription || t('把文件放入当前目录后，即可在这里查看和管理。'))
const unsetDescriptionText = computed(() => props.unsetDescription || t('请先配置脚本根目录。'))

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

async function openPath(item) {
  try {
    const result = await openFile(item.path)
    if (result && result.success === false) showError(result.error || t('打开失败'))
  } catch (e) {
    showError(e.message || t('打开失败'))
  }
}

function handleItemClick(item) {
  if (item.isDirectory) enterDirectory(item)
  else if (props.openFileOnClick) openPath(item)
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

const sendMenu = ref({ show: false, x: 0, y: 0 })
const sendResource = ref(null)
const canSendContextItem = computed(() => {
  const item = contextMenu.value.item
  return Boolean(item && !item.isDirectory && sendKindForPath(item.path))
})

async function sendContextItem() {
  const item = contextMenu.value.item
  if (!item) return
  const kind = sendKindForPath(item.path)
  if (!kind) return

  const anchor = { x: contextMenu.value.x, y: contextMenu.value.y }
  hideContextMenu()

  if (kind === 'image') {
    sendResource.value = { kind: 'image', title: item.name, path: item.path }
    sendMenu.value = { show: true, ...anchor }
    return
  }

  const result = await readTextDocument(item.path)
  if (!result?.success) {
    showError(result?.error || t('读取文件失败'))
    return
  }
  sendResource.value = { kind: 'text', title: item.name, text: result.content }
  sendMenu.value = { show: true, ...anchor }
}

function onItemDragStart(event, item) {
  if (item.isDirectory || !isImagePath(item.path)) {
    event.preventDefault()
    return
  }
  const resource = startResourceDrag({ kind: 'image', title: item.name, path: item.path })
  if (!resource) {
    event.preventDefault()
    return
  }
  event.dataTransfer.setData('application/x-ntb-resource', encodeSendResource(resource))
  event.dataTransfer.setData('text/plain', item.path)
  event.dataTransfer.effectAllowed = 'copy'
}

function onSendDone(target) {
  showSuccess(t('已发送到 {name}', { name: t(target.name) }))
}

async function openItem() {
  const item = contextMenu.value.item
  if (!item) return
  hideContextMenu()

  if (item.isDirectory) {
    if (props.systemOpen) await openFolder(item.path)
    else enterDirectory(item)
    return
  }
  await openPath(item)
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

async function copyDirectoryFiles() {
  const item = contextMenu.value.item
  if (!item) return

  const success = await copyToClipboard(item.path, false)
  if (success) {
    showSuccess(t('已复制所有文件路径'))
  }
  hideContextMenu()
}

async function copyAllFilesPath() {
  const item = contextMenu.value.item
  if (!item) return

  const success = await copyToClipboard(item.path, true)
  if (success) {
    showSuccess(t('已复制所有文件路径（含子目录）'))
  }
  hideContextMenu()
}

function formatItemSize(size) {
  return size == null ? '—' : formatBytes(size)
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
.file-explorer {
  --fx-font: var(--font-size-dense);
  --fx-font-meta: var(--font-size-sm);
  --fx-icon: var(--icon-size-xs);
  --fx-grid-icon: 28px;
  --fx-row-pad-y: 8px;
  --fx-row-pad-x: 10px;
  --fx-grid-min: 150px;
  --fx-compact-grid-min: 100px;
  --fx-search-h: var(--control-height-sm);
  --fx-search-w: 170px;
}

.file-explorer.size-xl {
  --fx-font: var(--font-size-md);
  --fx-font-meta: var(--font-size-base);
  --fx-icon: var(--icon-size-md);
  --fx-grid-icon: 36px;
  --fx-row-pad-y: 12px;
  --fx-row-pad-x: 14px;
  --fx-grid-min: 200px;
  --fx-compact-grid-min: 140px;
  --fx-search-h: var(--control-height-xl);
  --fx-search-w: 220px;
}

.file-explorer.size-lg {
  --fx-font: var(--font-size-base);
  --fx-font-meta: var(--font-size-base);
  --fx-icon: var(--icon-size-sm);
  --fx-grid-icon: 32px;
  --fx-row-pad-y: 10px;
  --fx-row-pad-x: 12px;
  --fx-grid-min: 180px;
  --fx-compact-grid-min: 120px;
  --fx-search-h: var(--control-height-lg);
  --fx-search-w: 200px;
}

.file-explorer.size-sm {
  --fx-font: var(--font-size-sm);
  --fx-font-meta: var(--font-size-xs);
  --fx-icon: var(--icon-size-2xs);
  --fx-grid-icon: 22px;
  --fx-row-pad-y: 6px;
  --fx-row-pad-x: 8px;
  --fx-grid-min: 130px;
  --fx-compact-grid-min: 90px;
  --fx-search-h: var(--control-height-xs);
  --fx-search-w: 150px;
}

.file-explorer.size-xs {
  --fx-font: var(--font-size-xs);
  --fx-font-meta: var(--font-size-xs);
  --fx-icon: var(--icon-size-2xs);
  --fx-grid-icon: 20px;
  --fx-row-pad-y: 4px;
  --fx-row-pad-x: 6px;
  --fx-grid-min: 110px;
  --fx-compact-grid-min: 80px;
  --fx-search-h: var(--control-height-xs);
  --fx-search-w: 130px;
}

.file-explorer {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-explorer.panel {
  overflow: hidden;
}

.file-explorer.page {
  flex: 1;
  min-height: 0;
}

.fx-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.file-explorer.panel .fx-header {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}

.file-explorer.panel .fx-title {
  min-height: 40px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.file-explorer.page .fx-header {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 6px 20px;
  background: var(--app-toolbar-bg);
  border-bottom: 1px solid var(--border-color);
}

.fx-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.fx-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1;
}

.file-explorer.panel .fx-toolbar {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px 12px 0;
}

.fx-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.file-explorer.panel .fx-body {
  padding: 10px 12px 12px;
}

.file-explorer.page .fx-body {
  padding: 16px 20px 20px;
}

.fx-scroll {
  min-width: 0;
}

.file-explorer.panel .fx-scroll {
  margin-top: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.breadcrumb {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-sm);
  /* 固定行高，避免 CJK 与 ASCII 回退字体行高不同导致各段文字上下错位 */
  line-height: 1.4;
  color: var(--text-secondary);
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
}

.breadcrumb::-webkit-scrollbar {
  display: none;
}

.breadcrumb-path {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.breadcrumb-item {
  flex-shrink: 0;
  cursor: pointer;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
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
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--fx-search-h);
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
  /* 预留清除按钮的位置（6px 间距 + 18px 按钮），输入时搜索框宽度不变 */
  width: calc(var(--fx-search-w) - 24px);
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
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.search-clear.is-hidden {
  visibility: hidden;
  pointer-events: none;
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

.fx-message {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-tertiary);
  font-size: var(--font-size-dense);
}

.fx-message.is-error {
  color: var(--error-dark);
}

.fx-scroll > .empty-state {
  min-height: 200px;
}

.file-explorer.page .fx-scroll > .empty-state {
  min-height: 320px;
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
  grid-template-columns: repeat(auto-fill, minmax(var(--fx-grid-min), 1fr));
  gap: 10px;
  background: transparent;
  border: none;
  padding: 0;
}

.file-item {
  display: flex;
  align-items: center;
  padding: var(--fx-row-pad-y) var(--fx-row-pad-x);
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

.file-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
  background: var(--surface-hover);
}

.file-list.grid .file-item:hover {
  border-color: var(--border-strong);
}

.file-item.directory:hover {
  background: rgba(var(--accent-rgb), 0.06);
}

.item-icon {
  width: var(--fx-icon);
  height: var(--fx-icon);
  margin-right: 10px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.file-item.directory .item-icon {
  color: var(--accent-color);
}

.file-list.grid .item-icon {
  width: var(--fx-grid-icon);
  height: var(--fx-grid-icon);
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
  font-size: var(--fx-font);
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
  font-size: var(--fx-font-meta);
  color: var(--text-tertiary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.item-time {
  font-size: var(--fx-font-meta);
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
  grid-template-columns: repeat(auto-fill, minmax(var(--fx-compact-grid-min), 1fr));
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
  border-radius: var(--radius-xs);
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

@media (max-width: 900px) {
  .file-explorer.page .fx-header {
    padding: 6px 16px;
  }

  .file-explorer.page .fx-body {
    padding: 12px 16px 20px;
  }

  .search-input {
    width: 120px;
  }
}
</style>
