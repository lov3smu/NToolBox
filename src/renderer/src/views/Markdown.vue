<template>
  <PageLayout tool-path="/markdown-editor" page-class="markdown-page-layout">
    <template #actions>
      <div class="segmented md-view-switch">
        <button
          v-for="mode in viewModes"
          :key="mode.id"
          type="button"
          class="segmented-item"
          :class="{ active: viewMode === mode.id }"
          @click="viewMode = mode.id"
        >
          {{ mode.label }}
        </button>
      </div>

      <label class="md-toggle" :class="{ disabled: viewMode !== 'split' }">
        <input v-model="syncScroll" type="checkbox" :disabled="viewMode !== 'split'" />
        <span>{{ t('同步滚动') }}</span>
      </label>

      <span class="toolbar-sep" />

      <div class="md-format-group">
        <button type="button" class="btn-icon btn-sm md-format-text" :title="t('一级标题')" @click="applyFormat('h1')">
          H1
        </button>
        <button type="button" class="btn-icon btn-sm md-format-text" :title="t('二级标题')" @click="applyFormat('h2')">
          H2
        </button>
        <button type="button" class="btn-icon btn-sm md-format-text" :title="t('三级标题')" @click="applyFormat('h3')">
          H3
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('粗体 (Ctrl+B)')" @click="applyFormat('bold')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('斜体 (Ctrl+I)')" @click="applyFormat('italic')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 4h-9M14 20H5M15 4 9 20" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('删除线')" @click="applyFormat('strike')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M4 12h16M16 6.5C15.2 5.5 13.8 5 12 5 9.2 5 7 6.4 7 8.5c0 2.5 3.5 3 5 3.5M8 17.5c.8 1 2.2 1.5 4 1.5 2.8 0 5-1.4 5-3.5"
            />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('行内代码 (Ctrl+E)')" @click="applyFormat('code')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('引用')" @click="applyFormat('quote')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M7 7h4v6H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM15 7h4v6h-4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM5 17h4M15 17h4"
            />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('无序列表')" @click="applyFormat('ul')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 6h12M9 12h12M9 18h12" />
            <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('有序列表')" @click="applyFormat('ol')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 6h11M10 12h11M10 18h11M4 5h1v4M3 9h3" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('任务列表')" @click="applyFormat('task')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="6" height="6" rx="1" />
            <path d="m4.5 7 1.3 1.3L8 5.6M12 7h9M3 15h6M12 15h9M3 19h6M12 19h9" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入链接 (Ctrl+K)')" @click="applyFormat('link')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入图片')" @click="applyFormat('image')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="m4 17 4.5-4.5L12 16l3-3 5 5" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('代码块')" @click="applyFormat('codeblock')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="m8 10-2 2 2 2M16 10l2 2-2 2" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入表格')" @click="applyFormat('table')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M9 10v10M15 10v10" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('分割线')" @click="applyFormat('hr')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12h16" />
          </svg>
        </button>
      </div>

      <span class="toolbar-sep" />

      <button class="btn btn-secondary btn-sm" @click="triggerImport">{{ t('导入') }}</button>
      <button class="btn btn-secondary btn-sm" @click="exportMarkdown">{{ t('导出') }}</button>
      <button class="btn btn-secondary btn-sm" @click="copyHtml">{{ t('复制 HTML') }}</button>
      <button class="btn btn-secondary btn-sm" @click="loadExample">{{ t('示例') }}</button>
      <button class="btn btn-secondary btn-sm" @click="clearVisible = true">{{ t('清空') }}</button>
    </template>

    <div class="markdown-page">
      <div
        ref="workbenchRef"
        class="md-workbench"
        :class="[`mode-${viewMode}`, `split-${splitDirection}`]"
        :style="{ '--split-ratio': `${splitRatio}%` }"
      >
        <section v-show="viewMode !== 'preview'" class="md-pane md-editor-pane">
          <header class="md-pane-header">
            <span class="md-pane-title">Markdown</span>
            <span class="md-pane-stats">{{
              t('{chars} 字符 · {lines} 行', { chars: stats.chars, lines: stats.lines })
            }}</span>
            <span v-if="savedTime" class="md-save-status">{{ t('已自动保存 {time}', { time: savedTime }) }}</span>
          </header>
          <div class="md-editor-body">
            <MarkdownEditor ref="editorRef" v-model="content" @scroll="onEditorScroll" />
          </div>
        </section>

        <SplitHandle
          v-if="viewMode === 'split'"
          :orientation="splitDirection === 'horizontal' ? 'vertical' : 'horizontal'"
          :resizing="splitResizing"
          :label="t('拖动调整编辑与预览大小')"
          @pointerdown="startSplitResize"
          @keydown="onSplitKeydown"
        />

        <section v-show="viewMode !== 'editor'" class="md-pane md-preview-pane">
          <header class="md-pane-header">
            <span class="md-pane-title">{{ t('实时预览') }}</span>
            <span class="md-pane-stats">{{ t('约 {count} 分钟阅读', { count: stats.minutes }) }}</span>
            <div class="md-preview-controls">
              <label class="md-control">
                <span>{{ t('主题') }}</span>
                <select v-model="prefs.theme" class="select-field-sm">
                  <option v-for="theme in themes" :key="theme.id" :value="theme.id">{{ t(theme.label) }}</option>
                </select>
              </label>
              <label class="md-control">
                <span>{{ t('字号') }}</span>
                <select v-model.number="prefs.fontSize" class="select-field-sm">
                  <option v-for="size in fontSizes" :key="size" :value="size">{{ size }}px</option>
                </select>
              </label>
              <label class="md-control md-accent-control" :title="t('自定义预览强调色')">
                <span>{{ t('强调色') }}</span>
                <input type="color" :value="prefs.accent || '#596bd4'" @input="prefs.accent = $event.target.value" />
              </label>
              <button
                v-if="prefs.accent"
                type="button"
                class="md-reset-accent"
                :title="t('恢复主题强调色')"
                @click="prefs.accent = ''"
              >
                {{ t('重置') }}
              </button>
            </div>
          </header>
          <div
            ref="previewScrollRef"
            class="md-preview-scroll"
            :data-md-theme="prefs.theme"
            :style="previewStyle"
            @click="onPreviewClick"
          >
            <article class="md-preview" v-html="previewHtml" />
          </div>
        </section>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        class="md-hidden-input"
        @change="onImportFile"
      />
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />

    <MessageDialog
      :visible="clearVisible"
      type="confirm"
      :title="t('清空编辑内容')"
      :message="t('当前 Markdown 内容将被清空，此操作无法撤销。')"
      @confirm="clearContent"
      @cancel="clearVisible = false"
      @close="clearVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { usePaneResize, useToast } from '@/composables'
import { copyToClipboard } from '@/utils/clipboard'
import { formatDateTime } from '@/utils/format'
import { openExternal } from '@/api'
import { decorateMarkdownPreview, renderMarkdownPreview } from '@/utils/markdownEditor'
import SplitHandle from '@/components/SplitHandle.vue'
import '@/styles/markdown.css'
import { t } from '@/i18n'

const DRAFT_KEY = 'ntb_markdown_draft'
const PREFS_KEY = 'ntb_markdown_prefs'

const THEMES = [
  {
    id: 'paper',
    get label() {
      return t('纸墨')
    }
  },
  { id: 'github', label: 'GitHub' },
  {
    id: 'dark',
    get label() {
      return t('暗夜')
    }
  },
  {
    id: 'sepia',
    get label() {
      return t('羊皮纸')
    }
  },
  {
    id: 'forest',
    get label() {
      return t('森林')
    }
  },
  {
    id: 'ocean',
    get label() {
      return t('海洋')
    }
  }
]
const FONT_SIZES = [13, 14, 15, 16, 18, 20]
const VIEW_MODES = [
  {
    id: 'split',
    get label() {
      return t('分栏')
    }
  },
  {
    id: 'editor',
    get label() {
      return t('编辑')
    }
  },
  {
    id: 'preview',
    get label() {
      return t('预览')
    }
  }
]

const buildExample = () =>
  [
    t('# Markdown 编辑器'),
    '',
    t('边写边预览，支持 **粗体**、*斜体*、~~删除线~~、`行内代码` 与 [链接](https://example.com)。'),
    '',
    t('## 列表'),
    '',
    t('- 无序列表项'),
    t('- 支持嵌套'),
    t('  1. 有序子项'),
    t('  2. 有序子项'),
    '',
    t('- [x] 已完成任务'),
    t('- [ ] 待办任务'),
    '',
    t('## 表格'),
    '',
    t('| 功能 | 状态 |'),
    '| --- | --- |',
    t('| 实时预览 | 支持 |'),
    t('| 主题定制 | 支持 |'),
    t('| 代码高亮 | 支持 |'),
    '',
    t('> 引用：所见即所得，主题、字号与强调色都可以实时调整。'),
    '',
    t('## 代码'),
    '',
    '```js',
    'export function greet(name) {',
    '  return `Hello, ${name}!`',
    '}',
    '```',
    '',
    '---',
    '',
    t('图片语法：`![替代文字](https://example.com/image.png)`。')
  ].join('\n')

const { toastVisible, toastMessage, toastType, showSuccess, showError, showInfo } = useToast()

const editorRef = ref(null)
const previewScrollRef = ref(null)
const previewHtml = ref('')
const fileInputRef = ref(null)
const clearVisible = ref(false)
const viewMode = ref('split')
const syncScroll = ref(true)
const savedAt = ref(0)
const content = ref('')

const workbenchRef = ref(null)
const splitMedia = window.matchMedia('(max-width: 1100px)')
const splitDirection = ref(splitMedia.matches ? 'vertical' : 'horizontal')
const {
  size: splitRatio,
  resizing: splitResizing,
  startResize: startSplitResize,
  onKeydown: onSplitKeydown
} = usePaneResize({
  key: 'markdownSplitRatio',
  initial: 50,
  min: 20,
  max: 80,
  unit: 'percent',
  direction: () => splitDirection.value,
  container: () => workbenchRef.value
})

function syncSplitDirection() {
  splitDirection.value = splitMedia.matches ? 'vertical' : 'horizontal'
}

const themes = THEMES
const fontSizes = FONT_SIZES
const viewModes = VIEW_MODES

function currentDefaultTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'paper'
}

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null')
    if (!saved || typeof saved !== 'object') {
      return { theme: currentDefaultTheme(), fontSize: 15, accent: '' }
    }
    return {
      theme: THEMES.some((theme) => theme.id === saved.theme) ? saved.theme : currentDefaultTheme(),
      fontSize: FONT_SIZES.includes(saved.fontSize) ? saved.fontSize : 15,
      accent: /^#[0-9a-f]{6}$/i.test(saved.accent) ? saved.accent : ''
    }
  } catch {
    return { theme: currentDefaultTheme(), fontSize: 15, accent: '' }
  }
}

const prefs = ref(loadPrefs())

const previewStyle = computed(() => {
  const style = { '--md-font-size': `${prefs.value.fontSize}px` }
  if (prefs.value.accent) style['--md-accent'] = prefs.value.accent
  return style
})

const stats = computed(() => {
  const text = content.value
  const chars = text.replace(/\s/g, '').length
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length
  const words = (text.match(/[A-Za-z0-9_]+/g) || []).length
  const units = cjk + words
  return {
    chars,
    lines: text ? text.split('\n').length : 1,
    minutes: units === 0 ? 0 : Math.max(1, Math.ceil(units / 300))
  }
})

const savedTime = computed(() => {
  if (!savedAt.value) return ''
  return new Date(savedAt.value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})

let renderTimer = null
let saveTimer = null

function scheduleRender() {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    previewHtml.value = renderMarkdownPreview(content.value)
  }, 80)
}

watch(previewHtml, () => decorateMarkdownPreview(previewScrollRef.value), { flush: 'post' })

watch(
  content,
  () => {
    scheduleRender()
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, content.value)
        savedAt.value = Date.now()
      } catch {
        // 本地存储不可用时仅保留内存草稿
      }
    }, 500)
  },
  { immediate: true }
)

watch(
  prefs,
  (value) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(value))
    } catch {
      // 忽略本地存储失败
    }
  },
  { deep: true }
)

function applyFormat(action) {
  const editor = editorRef.value
  if (!editor) return

  switch (action) {
    case 'h1':
      editor.toggleLineMark('# ', /^#{1,6}\s+/)
      break
    case 'h2':
      editor.toggleLineMark('## ', /^#{1,6}\s+/)
      break
    case 'h3':
      editor.toggleLineMark('### ', /^#{1,6}\s+/)
      break
    case 'bold':
      editor.wrapSelection('**', '**', t('粗体'))
      break
    case 'italic':
      editor.wrapSelection('*', '*', t('斜体'))
      break
    case 'strike':
      editor.wrapSelection('~~', '~~', t('删除线'))
      break
    case 'code':
      editor.wrapSelection('`', '`', t('代码'))
      break
    case 'quote':
      editor.toggleLineMark('> ', /^>\s?/)
      break
    case 'ul':
      editor.toggleLineMark('- ', /^[-*+]\s+/)
      break
    case 'ol':
      editor.toggleLineMark('1. ', /^\d+[.)]\s+/)
      break
    case 'task':
      editor.toggleLineMark('- [ ] ', /^[-*+]\s+\[[ xX]\]\s+/)
      break
    case 'link':
      editor.insertLink()
      break
    case 'image':
      editor.insertImage()
      break
    case 'codeblock':
      editor.insertCodeBlock()
      break
    case 'table':
      editor.insertTable()
      break
    case 'hr':
      editor.insertBlock('---')
      break
    default:
      break
  }
}

function onEditorScroll(ratio) {
  if (!syncScroll.value || viewMode.value !== 'split') return
  const el = previewScrollRef.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  if (max > 0) el.scrollTop = ratio * max
}

function onPreviewClick(event) {
  const anchor = event.target.closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('href') || ''
  if (!href) return
  event.preventDefault()

  if (href.startsWith('#')) {
    const target = previewScrollRef.value?.querySelector(`#${CSS.escape(href.slice(1))}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  if (/^https?:\/\//i.test(href)) openExternal(href)
}

function triggerImport() {
  fileInputRef.value?.click()
}

function onImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    content.value = String(reader.result || '')
    showSuccess(t('已导入 {name}', { name: file.name }))
  }
  reader.onerror = () => showError(t('读取文件失败'))
  reader.readAsText(file)
}

function exportMarkdown() {
  if (!content.value.trim()) {
    showInfo(t('当前没有可导出的内容'))
    return
  }
  const blob = new Blob([content.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `markdown-${formatDateTime(Date.now(), 'date')}.md`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 0)
  showSuccess(t('已导出 Markdown 文件'))
}

async function copyHtml() {
  previewHtml.value = renderMarkdownPreview(content.value)
  const ok = await copyToClipboard(previewHtml.value)
  if (ok) showSuccess(t('已复制渲染后的 HTML'))
  else showError(t('复制失败'))
}

function loadExample() {
  content.value = buildExample()
  showInfo(t('已加载示例内容'))
}

function clearContent() {
  clearVisible.value = false
  content.value = ''
  showSuccess(t('已清空编辑内容'))
}

onMounted(() => {
  splitMedia.addEventListener('change', syncSplitDirection)
  try {
    content.value = localStorage.getItem(DRAFT_KEY) || buildExample()
  } catch {
    content.value = buildExample()
  }
  scheduleRender()
  nextTick(() => {
    decorateMarkdownPreview(previewScrollRef.value)
    editorRef.value?.focus()
  })
})

onUnmounted(() => {
  splitMedia.removeEventListener('change', syncSplitDirection)
  clearTimeout(renderTimer)
  clearTimeout(saveTimer)
})
</script>

<style scoped>
.markdown-page {
  flex: 1;
  min-height: 0;
  padding: 16px 20px 20px;
}

@media (max-width: 900px) {
  .markdown-page {
    padding: 12px 16px 20px;
  }
}

.md-workbench {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.md-workbench.mode-split.split-horizontal {
  flex-direction: row;
}

.md-workbench.mode-split.split-vertical {
  flex-direction: column;
}

.md-pane {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.md-workbench.mode-split.split-horizontal .md-editor-pane {
  flex: 0 0 auto;
  width: var(--split-ratio);
}

.md-workbench.mode-split.split-vertical .md-editor-pane {
  flex: 0 0 auto;
  height: var(--split-ratio);
}

.md-pane-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.md-pane-title {
  font-size: var(--font-size-dense);
  font-weight: 650;
  color: var(--text-primary);
}

.md-pane-stats {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.md-save-status {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--success-dark);
}

.md-preview-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
  margin-left: auto;
}

.md-control {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.md-accent-control input[type='color'] {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.md-reset-accent {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.md-reset-accent:hover {
  text-decoration: underline;
}

.md-editor-body {
  flex: 1;
  min-height: 0;
}

.md-preview-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 24px 32px;
  background: var(--md-bg);
}

.md-hidden-input {
  display: none;
}

.md-format-group {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.md-format-text {
  width: auto !important;
  min-width: 30px;
  padding: 0 5px !important;
  font-size: var(--font-size-xs);
  font-weight: 650;
}

.md-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
}

.md-toggle.disabled {
  opacity: 0.5;
  cursor: default;
}

.md-view-switch .segmented-item {
  height: 24px;
  padding: 0 10px;
  font-size: var(--font-size-xs);
}

@media (max-width: 1100px) {
  .md-preview-controls {
    gap: 6px;
  }

  .md-control > span {
    display: none;
  }
}
</style>
