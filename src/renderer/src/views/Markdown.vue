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
        <span>同步滚动</span>
      </label>

      <span class="toolbar-sep" />

      <div class="md-format-group">
        <button type="button" class="btn-icon btn-sm md-format-text" title="一级标题" @click="applyFormat('h1')">
          H1
        </button>
        <button type="button" class="btn-icon btn-sm md-format-text" title="二级标题" @click="applyFormat('h2')">
          H2
        </button>
        <button type="button" class="btn-icon btn-sm md-format-text" title="三级标题" @click="applyFormat('h3')">
          H3
        </button>
        <button type="button" class="btn-icon btn-sm" title="粗体 (Ctrl+B)" @click="applyFormat('bold')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="斜体 (Ctrl+I)" @click="applyFormat('italic')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 4h-9M14 20H5M15 4 9 20" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="删除线" @click="applyFormat('strike')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M4 12h16M16 6.5C15.2 5.5 13.8 5 12 5 9.2 5 7 6.4 7 8.5c0 2.5 3.5 3 5 3.5M8 17.5c.8 1 2.2 1.5 4 1.5 2.8 0 5-1.4 5-3.5"
            />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="行内代码 (Ctrl+E)" @click="applyFormat('code')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="引用" @click="applyFormat('quote')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M7 7h4v6H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM15 7h4v6h-4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM5 17h4M15 17h4"
            />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="无序列表" @click="applyFormat('ul')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 6h12M9 12h12M9 18h12" />
            <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="有序列表" @click="applyFormat('ol')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 6h11M10 12h11M10 18h11M4 5h1v4M3 9h3" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="任务列表" @click="applyFormat('task')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="6" height="6" rx="1" />
            <path d="m4.5 7 1.3 1.3L8 5.6M12 7h9M3 15h6M12 15h9M3 19h6M12 19h9" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="插入链接 (Ctrl+K)" @click="applyFormat('link')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="插入图片" @click="applyFormat('image')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="m4 17 4.5-4.5L12 16l3-3 5 5" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="代码块" @click="applyFormat('codeblock')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="m8 10-2 2 2 2M16 10l2 2-2 2" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="插入表格" @click="applyFormat('table')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M9 10v10M15 10v10" />
          </svg>
        </button>
        <button type="button" class="btn-icon btn-sm" title="分割线" @click="applyFormat('hr')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12h16" />
          </svg>
        </button>
      </div>

      <span class="toolbar-sep" />

      <button class="btn btn-secondary btn-sm" @click="triggerImport">导入</button>
      <button class="btn btn-secondary btn-sm" @click="exportMarkdown">导出</button>
      <button class="btn btn-secondary btn-sm" @click="copyHtml">复制 HTML</button>
      <button class="btn btn-secondary btn-sm" @click="loadExample">示例</button>
      <button class="btn btn-secondary btn-sm" @click="clearVisible = true">清空</button>
    </template>

    <div class="markdown-page">
      <div class="md-workbench" :class="`mode-${viewMode}`">
        <section v-show="viewMode !== 'preview'" class="md-pane md-editor-pane">
          <header class="md-pane-header">
            <span class="md-pane-title">Markdown</span>
            <span class="md-pane-stats">{{ stats.chars }} 字符 · {{ stats.lines }} 行</span>
            <span v-if="savedTime" class="md-save-status">已自动保存 {{ savedTime }}</span>
          </header>
          <div class="md-editor-body">
            <MarkdownEditor ref="editorRef" v-model="content" @scroll="onEditorScroll" />
          </div>
        </section>

        <section v-show="viewMode !== 'editor'" class="md-pane md-preview-pane">
          <header class="md-pane-header">
            <span class="md-pane-title">实时预览</span>
            <span class="md-pane-stats">约 {{ stats.minutes }} 分钟阅读</span>
            <div class="md-preview-controls">
              <label class="md-control">
                <span>主题</span>
                <select v-model="prefs.theme">
                  <option v-for="theme in themes" :key="theme.id" :value="theme.id">{{ theme.label }}</option>
                </select>
              </label>
              <label class="md-control">
                <span>字号</span>
                <select v-model.number="prefs.fontSize">
                  <option v-for="size in fontSizes" :key="size" :value="size">{{ size }}px</option>
                </select>
              </label>
              <label class="md-control md-accent-control" title="自定义预览强调色">
                <span>强调色</span>
                <input type="color" :value="prefs.accent || '#596bd4'" @input="prefs.accent = $event.target.value" />
              </label>
              <button
                v-if="prefs.accent"
                type="button"
                class="md-reset-accent"
                title="恢复主题强调色"
                @click="prefs.accent = ''"
              >
                重置
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
      title="清空编辑内容"
      message="当前 Markdown 内容将被清空，此操作无法撤销。"
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
import { useToast } from '@/composables'
import { copyToClipboard } from '@/utils/clipboard'
import { formatDateTime } from '@/utils/format'
import { openExternal } from '@/api'
import { decorateMarkdownPreview, renderMarkdownPreview } from '@/utils/markdownEditor'
import '@/styles/markdown.css'

const DRAFT_KEY = 'ntb_markdown_draft'
const PREFS_KEY = 'ntb_markdown_prefs'

const THEMES = [
  { id: 'paper', label: '纸墨' },
  { id: 'github', label: 'GitHub' },
  { id: 'dark', label: '暗夜' },
  { id: 'sepia', label: '羊皮纸' },
  { id: 'forest', label: '森林' },
  { id: 'ocean', label: '海洋' }
]
const FONT_SIZES = [13, 14, 15, 16, 18, 20]
const VIEW_MODES = [
  { id: 'split', label: '分栏' },
  { id: 'editor', label: '编辑' },
  { id: 'preview', label: '预览' }
]

const EXAMPLE = [
  '# Markdown 编辑器',
  '',
  '边写边预览，支持 **粗体**、*斜体*、~~删除线~~、`行内代码` 与 [链接](https://example.com)。',
  '',
  '## 列表',
  '',
  '- 无序列表项',
  '- 支持嵌套',
  '  1. 有序子项',
  '  2. 有序子项',
  '',
  '- [x] 已完成任务',
  '- [ ] 待办任务',
  '',
  '## 表格',
  '',
  '| 功能 | 状态 |',
  '| --- | --- |',
  '| 实时预览 | 支持 |',
  '| 主题定制 | 支持 |',
  '| 代码高亮 | 支持 |',
  '',
  '> 引用：所见即所得，主题、字号与强调色都可以实时调整。',
  '',
  '## 代码',
  '',
  '```js',
  'export function greet(name) {',
  '  return `Hello, ${name}!`',
  '}',
  '```',
  '',
  '---',
  '',
  '图片语法：`![替代文字](https://example.com/image.png)`。'
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
      editor.wrapSelection('**', '**', '粗体')
      break
    case 'italic':
      editor.wrapSelection('*', '*', '斜体')
      break
    case 'strike':
      editor.wrapSelection('~~', '~~', '删除线')
      break
    case 'code':
      editor.wrapSelection('`', '`', '代码')
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
    showSuccess(`已导入 ${file.name}`)
  }
  reader.onerror = () => showError('读取文件失败')
  reader.readAsText(file)
}

function exportMarkdown() {
  if (!content.value.trim()) {
    showInfo('当前没有可导出的内容')
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
  showSuccess('已导出 Markdown 文件')
}

async function copyHtml() {
  previewHtml.value = renderMarkdownPreview(content.value)
  const ok = await copyToClipboard(previewHtml.value)
  if (ok) showSuccess('已复制渲染后的 HTML')
  else showError('复制失败')
}

function loadExample() {
  content.value = EXAMPLE
  showInfo('已加载示例内容')
}

function clearContent() {
  clearVisible.value = false
  content.value = ''
  showSuccess('已清空编辑内容')
}

onMounted(() => {
  try {
    content.value = localStorage.getItem(DRAFT_KEY) || EXAMPLE
  } catch {
    content.value = EXAMPLE
  }
  scheduleRender()
  nextTick(() => {
    decorateMarkdownPreview(previewScrollRef.value)
    editorRef.value?.focus()
  })
})

onUnmounted(() => {
  clearTimeout(renderTimer)
  clearTimeout(saveTimer)
})
</script>

<style scoped>
.markdown-page {
  flex: 1;
  min-height: 0;
  padding: 12px 20px 20px;
}

.md-workbench {
  height: 100%;
  min-height: 0;
  display: grid;
  gap: 12px;
}

.md-workbench.mode-split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.md-workbench.mode-editor,
.md-workbench.mode-preview {
  grid-template-columns: minmax(0, 1fr);
}

.md-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
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

.md-control select {
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-xs);
  outline: none;
}

.md-control select:focus-visible {
  border-color: var(--accent-color);
}

.md-accent-control input[type='color'] {
  width: 24px;
  height: 22px;
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

.md-toggle input {
  accent-color: var(--accent-color);
}

.md-view-switch .segmented-item {
  height: 24px;
  padding: 0 10px;
  font-size: var(--font-size-xs);
}

@media (max-width: 1100px) {
  .md-workbench.mode-split {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }

  .md-preview-controls {
    gap: 6px;
  }

  .md-control > span {
    display: none;
  }
}
</style>
