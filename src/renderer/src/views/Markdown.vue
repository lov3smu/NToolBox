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
          <AppIcon name="bold" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('斜体 (Ctrl+I)')" @click="applyFormat('italic')">
          <AppIcon name="italic" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('删除线')" @click="applyFormat('strike')">
          <AppIcon name="strike" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('行内代码 (Ctrl+E)')" @click="applyFormat('code')">
          <AppIcon name="code" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('引用')" @click="applyFormat('quote')">
          <AppIcon name="quote" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('无序列表')" @click="applyFormat('ul')">
          <AppIcon name="list" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('有序列表')" @click="applyFormat('ol')">
          <AppIcon name="list-ordered" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('任务列表')" @click="applyFormat('task')">
          <AppIcon name="task-list" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入链接 (Ctrl+K)')" @click="applyFormat('link')">
          <AppIcon name="link" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入图片')" @click="applyFormat('image')">
          <AppIcon name="image" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('代码块')" @click="applyFormat('codeblock')">
          <AppIcon name="code-block" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('插入表格')" @click="applyFormat('table')">
          <AppIcon name="table-insert" />
        </button>
        <button type="button" class="btn-icon btn-sm" :title="t('分割线')" @click="applyFormat('hr')">
          <AppIcon name="minus" />
        </button>
        <button type="button" class="btn-icon btn-sm md-ai-btn" :title="t('AI 处理选中内容')" @click="openInlineAi">
          <AppIcon name="sparkles" />
        </button>
      </div>

      <span class="toolbar-sep" />

      <div ref="openGroupRef" class="md-open-group">
        <button
          type="button"
          class="btn btn-secondary btn-sm md-open-trigger"
          :title="t('打开 (Ctrl+O)')"
          @click="toggleOpenMenu"
        >
          {{ t('打开') }}
          <AppIcon name="chevron-down" :size="12" />
        </button>
        <div v-if="openMenuVisible" v-clamp-viewport class="md-open-menu">
          <button type="button" class="md-open-item md-open-action" @click="openDocument">
            <AppIcon name="folder-open" :size="14" />
            <span>{{ t('打开文件…') }}</span>
          </button>
          <p class="md-open-heading">{{ t('最近打开') }}</p>
          <p v-if="!recents.length" class="md-open-empty">{{ t('暂无最近文件') }}</p>
          <button
            v-for="item in recents"
            :key="item.path"
            type="button"
            class="md-open-item"
            :title="item.path"
            @click="openRecent(item)"
          >
            <span class="md-open-name">{{ item.name }}</span>
            <span class="md-open-path">{{ item.path }}</span>
          </button>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" :title="t('保存 (Ctrl+S)')" @click="saveDocument()">
        {{ t('保存') }}
      </button>
      <button class="btn btn-secondary btn-sm" :title="t('另存为 (Ctrl+Shift+S)')" @click="saveDocument({ as: true })">
        {{ t('另存为') }}
      </button>
      <button
        class="btn btn-secondary btn-sm"
        :class="{ 'is-active': outlineVisible }"
        :title="t('切换大纲')"
        @click="outlineVisible = !outlineVisible"
      >
        {{ t('大纲') }}
      </button>
      <button class="btn btn-secondary btn-sm" @click="copyHtml">{{ t('复制 HTML') }}</button>
      <button class="btn btn-secondary btn-sm" @click="loadExample">{{ t('示例') }}</button>
      <button class="btn btn-secondary btn-sm" @click="clearVisible = true">{{ t('清空') }}</button>
    </template>

    <div class="markdown-page">
      <div class="md-shell">
        <aside v-if="outlineVisible" class="md-outline">
          <header class="md-outline-header">
            <span>{{ t('大纲') }}</span>
            <button type="button" class="md-outline-close" :title="t('关闭大纲')" @click="outlineVisible = false">
              {{ t('关闭') }}
            </button>
          </header>
          <div class="md-outline-scroll">
            <div v-if="frontmatter.length" class="md-outline-meta">
              <p class="md-outline-heading">{{ t('文档属性') }}</p>
              <div v-for="item in frontmatter" :key="item.key" class="md-meta-row">
                <span class="md-meta-key">{{ item.key }}</span>
                <span class="md-meta-value" :title="item.value">{{ item.value }}</span>
              </div>
            </div>
            <p class="md-outline-heading">{{ t('标题导航') }}</p>
            <p v-if="!outline.length" class="md-outline-empty">{{ t('暂无标题') }}</p>
            <button
              v-for="(item, index) in outline"
              :key="`${item.line}-${index}`"
              type="button"
              class="md-outline-item"
              :style="{ paddingLeft: `${8 + (item.level - 1) * 10}px` }"
              :title="item.text"
              @click="jumpToHeading(item, index)"
            >
              {{ item.text }}
            </button>
          </div>
        </aside>

        <div
          ref="workbenchRef"
          class="md-workbench"
          :class="[`mode-${viewMode}`, `split-${splitDirection}`]"
          :style="{ '--split-ratio': `${splitRatio}%` }"
        >
          <section v-show="viewMode !== 'preview'" class="md-pane md-editor-pane">
            <header class="md-pane-header">
              <span class="md-pane-title md-doc-title" :title="docPath">
                {{ docName || 'Markdown' }}
                <span v-if="dirty" class="md-dirty-dot" />
              </span>
              <span class="md-pane-stats">{{
                t('{chars} 字符 · {lines} 行', { chars: stats.chars, lines: stats.lines })
              }}</span>
              <span v-if="saveStatusText" class="md-save-status">{{ saveStatusText }}</span>
            </header>
            <div class="md-editor-body">
              <MarkdownEditor ref="editorRef" v-model="content" @scroll="onEditorScroll" @image="onPastedImage" />
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
                  <AppSelect v-model="prefs.theme" :options="themeOptions" size="sm" />
                </label>
                <label class="md-control">
                  <span>{{ t('字号') }}</span>
                  <AppSelect v-model="prefs.fontSize" :options="fontSizeOptions" size="sm" />
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
      </div>
    </div>

    <MessageDialog
      :visible="clearVisible"
      type="confirm"
      :title="t('清空编辑内容')"
      :message="t('当前 Markdown 内容将被清空，此操作无法撤销。')"
      @confirm="clearContent"
      @cancel="clearVisible = false"
      @close="clearVisible = false"
    />

    <InlineAiDialog
      :visible="inlineAiVisible"
      :text="inlineAiText"
      context="text"
      @apply="applyInlineAi"
      @close="inlineAiVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import AppSelect from '@/components/AppSelect.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import InlineAiDialog from '@/components/InlineAiDialog.vue'
import { usePaneResize, useToast, takeSendResource } from '@/composables'
import { copyToClipboard } from '@/utils/clipboard'
import {
  draftImport,
  draftList,
  draftSave,
  imageHostUploadData,
  mdListRecents,
  mdOpenDocument,
  mdReadDocument,
  mdSaveDocument,
  mdSaveDocumentAs,
  openExternal
} from '@/api'
import { decorateMarkdownPreview, renderMarkdownPreview } from '@/utils/markdownEditor'
import SplitHandle from '@/components/SplitHandle.vue'
import { extractMarkdownOutline, splitFrontmatter } from '@shared/markdownDocument'
import '@/styles/markdown.css'
import { t } from '@/i18n'

const DRAFT_KEY = 'ntb_markdown_draft'
const PREFS_KEY = 'ntb_markdown_prefs'
const DOC_KEY = 'ntb_markdown_doc_path'

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

const { showToast, showSuccess, showError, showInfo } = useToast()

const editorRef = ref(null)
const previewScrollRef = ref(null)
const previewHtml = ref('')
const openGroupRef = ref(null)
const clearVisible = ref(false)
const inlineAiVisible = ref(false)
const inlineAiText = ref('')
const viewMode = ref('split')
const syncScroll = ref(true)
const savedAt = ref(0)
const content = ref('')
const docPath = ref('')
const docName = ref('')
const lastSaved = ref('')
const recents = ref([])
const openMenuVisible = ref(false)
const outlineVisible = ref(false)
const imageUploading = ref(false)

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

const themeOptions = computed(() => themes.map((theme) => ({ value: theme.id, label: t(theme.label) })))
const fontSizeOptions = computed(() => fontSizes.map((size) => ({ value: size, label: `${size}px` })))

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

const docParts = computed(() => splitFrontmatter(content.value))
const frontmatter = computed(() => docParts.value.frontmatter)
const outline = computed(() => extractMarkdownOutline(content.value))
const dirty = computed(() => Boolean(docPath.value) && content.value !== lastSaved.value)
const saveStatusText = computed(() => {
  if (!savedAt.value) return ''
  if (docPath.value) return t('已保存到文件 {time}', { time: savedTime.value })
  return t('已自动保存 {time}', { time: savedTime.value })
})

let renderTimer = null
let draftTimer = null
let fileSaveTimer = null
let draftReady = false
let lastSaveErrorAt = 0

function scheduleRender() {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    previewHtml.value = renderMarkdownPreview(docParts.value.body)
  }, 80)
}

watch(previewHtml, () => decorateMarkdownPreview(previewScrollRef.value), { flush: 'post' })

watch(
  content,
  () => {
    scheduleRender()
    if (!draftReady) return
    clearTimeout(draftTimer)
    draftTimer = setTimeout(async () => {
      const result = await draftSave('markdown', { id: 'current', content: content.value })
      if (result?.success && !docPath.value) savedAt.value = Date.now()
    }, 500)
    scheduleFileSave()
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

function scheduleFileSave() {
  if (!docPath.value) return
  clearTimeout(fileSaveTimer)
  fileSaveTimer = setTimeout(() => {
    void saveFileNow({ silent: true })
  }, 900)
}

async function saveFileNow({ silent = true } = {}) {
  if (!docPath.value) return true
  if (content.value === lastSaved.value) return true
  const result = await mdSaveDocument({ path: docPath.value, content: content.value })
  if (result?.success) {
    lastSaved.value = content.value
    if (Array.isArray(result.recents)) recents.value = result.recents
    savedAt.value = Date.now()
    return true
  }
  const now = Date.now()
  if (!silent || now - lastSaveErrorAt > 4000) {
    lastSaveErrorAt = now
    showError(result?.error || t('保存失败'))
  }
  return false
}

async function flushPendingSave() {
  if (!docPath.value) return
  clearTimeout(fileSaveTimer)
  if (content.value !== lastSaved.value) await saveFileNow({ silent: true })
}

function rememberDocumentPath(path) {
  try {
    if (path) localStorage.setItem(DOC_KEY, path)
    else localStorage.removeItem(DOC_KEY)
  } catch {
    // 忽略本地存储失败
  }
}

function applyDocument(doc) {
  content.value = doc.content ?? ''
  docPath.value = doc.path || ''
  docName.value = doc.name || ''
  lastSaved.value = content.value
  savedAt.value = Date.now()
  if (Array.isArray(doc.recents)) recents.value = doc.recents
  rememberDocumentPath(docPath.value)
  openMenuVisible.value = false
  nextTick(() => {
    scheduleRender()
    decorateMarkdownPreview(previewScrollRef.value)
    editorRef.value?.focus()
  })
}

function detachDocument() {
  clearTimeout(fileSaveTimer)
  docPath.value = ''
  docName.value = ''
  lastSaved.value = ''
  rememberDocumentPath('')
}

async function openDocument() {
  openMenuVisible.value = false
  await flushPendingSave()
  const result = await mdOpenDocument()
  if (!result || result.canceled) {
    if (Array.isArray(result?.recents)) recents.value = result.recents
    return
  }
  if (!result.success) {
    showError(result.error || t('打开失败'))
    return
  }
  applyDocument(result)
  showSuccess(t('已打开 {name}', { name: result.name }))
}

async function openRecent(item) {
  openMenuVisible.value = false
  if (!item?.path) return
  await flushPendingSave()
  const result = await mdReadDocument(item.path)
  if (!result?.success) {
    showError(result?.error || t('打开失败'))
    const list = await mdListRecents()
    recents.value = list?.recents || []
    return
  }
  applyDocument(result)
  showSuccess(t('已打开 {name}', { name: result.name }))
}

async function saveDocument({ as = false } = {}) {
  if (!as && docPath.value) {
    clearTimeout(fileSaveTimer)
    const ok = await saveFileNow({ silent: false })
    if (ok) showSuccess(t('已保存到文件 {name}', { name: docName.value }))
    return
  }
  const fallbackName = docPath.value || `${docName.value || t('未命名文档')}.md`
  const result = await mdSaveDocumentAs({ defaultPath: fallbackName, content: content.value })
  if (!result || result.canceled) return
  if (!result.success) {
    showError(result.error || t('保存失败'))
    return
  }
  docPath.value = result.path || docPath.value
  docName.value = result.name || docName.value
  lastSaved.value = content.value
  savedAt.value = Date.now()
  if (Array.isArray(result.recents)) recents.value = result.recents
  rememberDocumentPath(docPath.value)
  showSuccess(t('已保存到文件 {name}', { name: docName.value }))
}

function toggleOpenMenu() {
  openMenuVisible.value = !openMenuVisible.value
}

function closeOpenMenuOnOutside(event) {
  if (!openMenuVisible.value) return
  if (openGroupRef.value?.contains(event.target)) return
  openMenuVisible.value = false
}

function jumpToHeading(item, index) {
  editorRef.value?.scrollToLine(item.line)
  const headings = previewScrollRef.value?.querySelectorAll(
    '.md-preview h1, .md-preview h2, .md-preview h3, .md-preview h4, .md-preview h5, .md-preview h6'
  )
  if (!headings?.length) return
  const normalized = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
  const matched = Array.from(headings).find((heading) => normalized(heading.textContent) === normalized(item.text))
  const target = matched || headings[index]
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function onPastedImage(file) {
  if (!file) return
  if (imageUploading.value) {
    showInfo(t('图片正在上传，请稍候'))
    return
  }
  imageUploading.value = true
  try {
    const buffer = await file.arrayBuffer()
    const result = await imageHostUploadData({
      name: file.name || `image-${Date.now()}.png`,
      mime: file.type || 'image/png',
      data: new Uint8Array(buffer)
    })
    const url = result?.results?.find((entry) => entry?.success)?.url
    if (!result?.success || !url) {
      showError(t('图片上传失败：{p0}', { p0: result?.error || '' }))
      return
    }
    editorRef.value?.insertText(`![${t('图片描述')}](${url})`)
    showSuccess(t('图片已上传并插入'))
  } catch (error) {
    showError(t('图片上传失败：{p0}', { p0: error?.message || '' }))
  } finally {
    imageUploading.value = false
  }
}

function onWindowKeydown(event) {
  const mod = event.ctrlKey || event.metaKey
  if (!mod) {
    if (event.key === 'Escape' && openMenuVisible.value) openMenuVisible.value = false
    return
  }
  if (event.altKey) return
  const key = String(event.key || '').toLowerCase()
  if (key === 's') {
    event.preventDefault()
    void saveDocument({ as: event.shiftKey })
  } else if (key === 'o') {
    event.preventDefault()
    void openDocument()
  }
}

function openInlineAi() {
  const selected = editorRef.value?.getSelection?.() || ''
  if (!selected.trim()) {
    showToast(t('请先在编辑器中选中要处理的文本'), 'warning')
    return
  }
  inlineAiText.value = selected
  inlineAiVisible.value = true
}

function applyInlineAi(result) {
  editorRef.value?.insertText(result)
  showSuccess(t('已替换选中内容'))
}

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

async function copyHtml() {
  previewHtml.value = renderMarkdownPreview(docParts.value.body)
  const ok = await copyToClipboard(previewHtml.value)
  if (ok) showSuccess(t('已复制渲染后的 HTML'))
  else showError(t('复制失败'))
}

function loadExample() {
  detachDocument()
  content.value = buildExample()
  showInfo(t('已加载示例内容'))
}

function clearContent() {
  clearVisible.value = false
  detachDocument()
  content.value = ''
  showSuccess(t('已清空编辑内容'))
}

function readLegacyDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY)
  } catch {
    return null
  }
}

onMounted(async () => {
  splitMedia.addEventListener('change', syncSplitDirection)
  document.addEventListener('pointerdown', closeOpenMenuOnOutside)
  window.addEventListener('keydown', onWindowKeydown)

  const list = await mdListRecents()
  if (Array.isArray(list?.recents)) recents.value = list.recents

  const legacy = readLegacyDraft()
  let saved = null
  try {
    if (legacy !== null) {
      await draftImport('markdown', [{ id: 'current', content: legacy, updatedAt: Date.now() }])
      localStorage.removeItem(DRAFT_KEY)
    }
    const page = await draftList('markdown', { limit: 1 })
    saved = page?.items?.[0]?.content ?? null
  } catch {
    // 读取失败时回退到旧本地草稿或示例内容
  }
  const incoming = takeSendResource('/markdown-editor')
  let restored = null
  if (!incoming) {
    let storedPath = ''
    try {
      storedPath = localStorage.getItem(DOC_KEY) || ''
    } catch {
      // 忽略本地存储失败
    }
    if (storedPath) {
      const doc = await mdReadDocument(storedPath)
      if (doc?.success) restored = doc
      else rememberDocumentPath('')
    }
  }
  if (restored) {
    applyDocument(restored)
  } else {
    content.value = incoming?.kind === 'text' ? incoming.text : (saved ?? legacy ?? buildExample())
  }
  draftReady = true
  scheduleRender()
  nextTick(() => {
    decorateMarkdownPreview(previewScrollRef.value)
    editorRef.value?.focus()
  })
})

onUnmounted(() => {
  splitMedia.removeEventListener('change', syncSplitDirection)
  document.removeEventListener('pointerdown', closeOpenMenuOnOutside)
  window.removeEventListener('keydown', onWindowKeydown)
  void flushPendingSave()
  clearTimeout(renderTimer)
  clearTimeout(draftTimer)
  clearTimeout(fileSaveTimer)
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

.md-shell {
  display: flex;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.md-workbench {
  flex: 1;
  min-width: 0;
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

.md-doc-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 240px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.md-dirty-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-color);
}

.md-outline {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 200px;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.md-outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 7px 10px 7px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
  font-size: var(--font-size-dense);
  font-weight: 650;
  color: var(--text-primary);
}

.md-outline-close {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.md-outline-close:hover {
  color: var(--accent-color);
}

.md-outline-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}

.md-outline-heading {
  margin: 6px 4px 4px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
}

.md-outline-empty {
  margin: 4px 4px 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.md-outline-meta {
  padding-bottom: 8px;
  margin-bottom: 6px;
  border-bottom: 1px dashed var(--border-color);
}

.md-meta-row {
  display: flex;
  gap: 8px;
  min-width: 0;
  padding: 2px 4px;
  font-size: var(--font-size-xs);
}

.md-meta-key {
  flex-shrink: 0;
  max-width: 50%;
  overflow: hidden;
  color: var(--text-tertiary);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.md-meta-value {
  overflow: hidden;
  color: var(--text-secondary);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.md-outline-item {
  display: block;
  width: 100%;
  padding: 4px 8px;
  overflow: hidden;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.md-outline-item:hover {
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent-color);
}

.md-open-group {
  position: relative;
  display: inline-flex;
}

.md-open-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.md-open-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 260px;
  max-width: 380px;
  padding: 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.md-open-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-xs);
  text-align: left;
  cursor: pointer;
}

.md-open-item:hover {
  background: rgba(var(--accent-rgb), 0.08);
}

.md-open-action {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  color: var(--accent-color);
}

.md-open-heading {
  margin: 6px 8px 2px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.md-open-empty {
  margin: 4px 8px 6px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.md-open-name {
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.md-open-path {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.btn.is-active {
  border-color: var(--accent-color);
  color: var(--accent-color);
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
