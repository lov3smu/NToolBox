<template>
  <PageLayout tool-path="/html-viewer">
    <template #actions>
      <button class="btn-icon btn-sm" :title="t('格式化')" @click="formatHtml">
        <AppIcon name="unfold-vertical" />
      </button>
      <button class="btn-icon btn-sm" :title="t('压缩')" @click="minifyHtml">
        <AppIcon name="fold-vertical" />
      </button>
      <button class="btn-icon btn-sm" :title="t('复制输入')" @click="copyInput">
        <AppIcon name="copy" />
      </button>
      <button class="btn-icon btn-sm" :title="t('清空')" @click="clearInput">
        <AppIcon name="close" />
      </button>
      <span class="toolbar-sep" />
      <button class="btn btn-primary btn-sm" :title="t('运行预览')" @click="runPreview">
        <AppIcon name="play" />
        {{ t('运行预览') }}
      </button>
      <button class="btn-icon btn-sm" :title="t('复制输出')" @click="copyOutput">
        <AppIcon name="copy" />
      </button>
      <button class="btn-icon btn-sm" :title="t('下载')" @click="downloadHtml">
        <AppIcon name="download" />
      </button>
      <span class="toolbar-sep" />
      <label class="auto-update-label">
        <input v-model="autoUpdate" type="checkbox" />
        <span>{{ t('自动更新') }}</span>
      </label>
      <div class="indent-control">
        <span class="toolbar-label">{{ t('缩进') }}</span>
        <AppSelect v-model="indentSize" :options="indentOptions" size="sm" class="indent-select" />
      </div>
    </template>

    <div class="page-body">
      <div ref="wrapperRef" class="editor-preview-wrapper" :style="{ '--split-ratio': `${splitRatio}%` }">
        <div class="panel editor-panel">
          <div class="panel-header">
            <span class="panel-title">HTML</span>
            <div class="panel-actions size-info">
              {{ t('{chars} 字符 · {lines} 行', { chars: inputSize, lines: lineCount }) }}
              <template v-if="draftSavedTime"> · {{ t('已自动保存 {time}', { time: draftSavedTime }) }}</template>
            </div>
          </div>
          <div class="editor-wrapper">
            <div ref="lineNumbersRef" class="line-numbers">
              <div v-for="n in displayLineCount" :key="n" class="line-number">
                {{ n }}
              </div>
            </div>
            <textarea
              ref="editorRef"
              v-model="htmlInput"
              class="html-editor"
              spellcheck="false"
              @input="onEditorInput"
              @scroll="syncScroll"
              @keydown="onKeyDown"
            />
          </div>
        </div>

        <SplitHandle
          orientation="vertical"
          :resizing="splitResizing"
          :label="t('拖动调整编辑与预览宽度')"
          @pointerdown="startSplitResize"
          @keydown="onSplitKeydown"
        />

        <div class="panel preview-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('预览') }}</span>
          </div>
          <div class="preview-wrapper">
            <!-- 不授予 same-origin：预览脚本无法访问父页面与 electronAPI -->
            <iframe ref="previewFrame" class="preview-frame" sandbox="allow-scripts" :srcdoc="previewDocument" />
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAutoDraft, usePaneResize, useSendReceiver, useToast } from '@/composables'
import SplitHandle from '@/components/SplitHandle.vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { t } from '@/i18n'

import AppIcon from '@/components/AppIcon.vue'
import AppSelect from '@/components/AppSelect.vue'
const { showSuccess, showError, showWarning, showInfo } = useToast()

const htmlInput = ref('')
const { savedTime: draftSavedTime, ready: draftReady } = useAutoDraft('html', htmlInput, {
  onRestore: () => onEditorInput()
})
const previewContent = ref('')
const previewAppearance = ref({
  theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  style: document.documentElement.dataset.themeStyle || 'sapphire'
})
const autoUpdate = ref(true)
const indentSize = ref(2)
const indentOptions = [2, 4]
const displayLineCount = ref(1)

const editorRef = ref(null)
const lineNumbersRef = ref(null)
const previewFrame = ref(null)
const wrapperRef = ref(null)
const {
  size: splitRatio,
  resizing: splitResizing,
  startResize: startSplitResize,
  onKeydown: onSplitKeydown
} = usePaneResize({
  key: 'htmlViewerSplitRatio',
  initial: 50,
  min: 20,
  max: 80,
  unit: 'percent',
  direction: 'horizontal',
  container: () => wrapperRef.value
})

let updateTimeout = null

const inputSize = computed(() => htmlInput.value.length)
const previewDocument = computed(() => buildPreviewDocument(previewContent.value, previewAppearance.value))
const lineCount = computed(() => {
  if (!htmlInput.value) return 1
  return htmlInput.value.split('\n').length
})

function onEditorInput() {
  displayLineCount.value = htmlInput.value.split('\n').length || 1

  if (autoUpdate.value) {
    clearTimeout(updateTimeout)
    updateTimeout = setTimeout(() => {
      updatePreview()
    }, 300)
  }
}

function onKeyDown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const start = editorRef.value.selectionStart
    const end = editorRef.value.selectionEnd
    const indent = ' '.repeat(indentSize.value)
    htmlInput.value = htmlInput.value.substring(0, start) + indent + htmlInput.value.substring(end)
    nextTick(() => {
      editorRef.value.selectionStart = editorRef.value.selectionEnd = start + indentSize.value
    })
  }
}

function syncScroll() {
  if (lineNumbersRef.value && editorRef.value) {
    lineNumbersRef.value.scrollTop = editorRef.value.scrollTop
  }
}

function runPreview() {
  updatePreview()
  showInfo(t('预览已更新'))
}

function updatePreview() {
  previewContent.value = htmlInput.value
}

function buildPreviewDocument(html, appearance) {
  const theme = appearance.theme
  const rootStyle = window.getComputedStyle(document.documentElement)
  const background = rootStyle.getPropertyValue('--surface').trim() || (theme === 'dark' ? '#1e1e1e' : '#ffffff')
  const color = rootStyle.getPropertyValue('--text-primary').trim() || (theme === 'dark' ? '#e6e6e6' : '#1f2328')
  const style = `<style>:root { color-scheme: ${theme}; } html { background-color: ${background}; } body { color: ${color}; }</style>`

  const head = html.match(/<head(\s[^>]*)?>/i)
  if (head) return html.replace(head[0], head[0] + style)

  const root = html.match(/<html(\s[^>]*)?>/i)
  if (root) return html.replace(root[0], root[0] + '<head>' + style + '</head>')

  const doctype = html.match(/<!doctype[^>]*>/i)
  if (doctype) return html.replace(doctype[0], doctype[0] + style)

  return style + html
}

function handleThemeChange(event) {
  previewAppearance.value = {
    theme: event.detail?.theme === 'dark' ? 'dark' : 'light',
    style: event.detail?.style || document.documentElement.dataset.themeStyle || 'sapphire'
  }
}

function formatHtml() {
  if (!htmlInput.value.trim()) {
    showWarning(t('请输入 HTML 代码'))
    return
  }

  try {
    const formatted = formatHtmlCode(htmlInput.value, indentSize.value)
    htmlInput.value = formatted
    displayLineCount.value = formatted.split('\n').length || 1
    updatePreview()
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.scrollLeft = 0
      }
    })
    showSuccess(t('格式化成功'))
  } catch {
    showError(t('格式化失败'))
  }
}

function formatHtmlCode(html, indent) {
  const indentStr = ' '.repeat(indent)
  let result = ''
  let depth = 0
  let i = 0

  html = html.replace(/\s+/g, ' ').trim()

  const selfClosing = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
  ]

  function addIndent() {
    result += indentStr.repeat(depth)
  }

  function getTagName(str, start) {
    const match = str.substring(start).match(/^([a-zA-Z][a-zA-Z0-9-]*)/)
    return match ? match[1].toLowerCase() : null
  }

  // 拆开书写，避免 Vite 依赖扫描把源码里的注释字面量当成 HTML 注释剥离
  const commentStart = '<' + '!--'
  const commentEnd = '--' + '>'

  while (i < html.length) {
    if (html[i] === '<') {
      if (html.substring(i, i + 4) === commentStart) {
        const end = html.indexOf(commentEnd, i + 4)
        if (end !== -1) {
          if (result && !result.endsWith('\n')) {
            result += '\n'
          }
          addIndent()
          result += html.substring(i, end + 3)
          i = end + 3
          continue
        }
      }

      if (html[i + 1] === '/') {
        depth = Math.max(0, depth - 1)
        if (result && !result.endsWith('\n')) {
          result += '\n'
        }
        addIndent()
        const end = html.indexOf('>', i)
        result += html.substring(i, end + 1)
        i = end + 1
      } else {
        const tagName = getTagName(html, i + 1)
        const isSelfClosingTag = selfClosing.includes(tagName)

        if (result && !result.endsWith('\n')) {
          result += '\n'
        }
        addIndent()

        const end = html.indexOf('>', i)
        const tagContent = html.substring(i, end + 1)
        const isSelfClosingSyntax = tagContent.endsWith('/>')

        result += tagContent

        if (!isSelfClosingTag && !isSelfClosingSyntax) {
          depth++
        }

        i = end + 1
      }
    } else if (html[i] === ' ') {
      if (result && !result.endsWith('\n') && !result.endsWith(' ')) {
        result += ' '
      }
      i++
    } else {
      result += html[i]
      i++
    }
  }

  return result.trim()
}

function minifyHtml() {
  if (!htmlInput.value.trim()) {
    showWarning(t('请输入 HTML 代码'))
    return
  }

  try {
    const minified = htmlInput.value
      .replace(/\n/g, '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s+>/g, '>')
      .replace(/<\s+/g, '<')
      .trim()
    htmlInput.value = minified
    displayLineCount.value = 1
    updatePreview()
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.scrollLeft = 0
      }
    })
    showSuccess(t('压缩成功'))
  } catch {
    showError(t('压缩失败'))
  }
}

function copyInput() {
  if (!htmlInput.value.trim()) {
    showWarning(t('没有可复制的内容'))
    return
  }
  copyToClipboard(htmlInput.value)
  showSuccess(t('已复制输入'))
}

function copyOutput() {
  if (!previewContent.value.trim()) {
    showWarning(t('没有预览内容'))
    return
  }
  copyToClipboard(previewContent.value)
  showSuccess(t('已复制输出'))
}

function clearInput() {
  htmlInput.value = ''
  previewContent.value = ''
  displayLineCount.value = 1
  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.scrollLeft = 0
      editorRef.value.scrollTop = 0
    }
  })
  showInfo(t('已清空'))
}

function downloadHtml() {
  if (!htmlInput.value.trim()) {
    showWarning(t('没有可下载的内容'))
    return
  }

  const blob = new Blob([htmlInput.value], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'document.html'
  a.click()
  URL.revokeObjectURL(url)
  showSuccess(t('下载成功'))
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showSuccess(t('已复制到剪贴板'))
    })
    .catch(() => {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        showSuccess(t('已复制到剪贴板'))
      } catch {
        showError(t('复制失败'))
      }
      document.body.removeChild(textarea)
    })
}

onMounted(() => {
  displayLineCount.value = 1
  window.addEventListener('ntb-theme-changed', handleThemeChange)
})

useSendReceiver('/html-viewer', draftReady, (resource) => {
  htmlInput.value = resource.text
  nextTick(updatePreview)
})

onUnmounted(() => {
  clearTimeout(updateTimeout)
  window.removeEventListener('ntb-theme-changed', handleThemeChange)
})
</script>

<style scoped>
.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.editor-preview-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.editor-panel {
  flex: 0 0 auto;
  width: var(--split-ratio, 50%);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.preview-panel {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.editor-preview-wrapper > .panel + .panel {
  margin-top: 0;
}

.size-info {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.auto-update-label {
  display: flex;
  align-items: center;
  gap: 5px;
  height: var(--control-height-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.auto-update-label input[type='checkbox'] {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  cursor: pointer;
}

.indent-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.indent-select {
  width: 56px;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  background: var(--surface);
}

.line-numbers {
  width: 44px;
  flex-shrink: 0;
  padding: 12px 0;
  overflow: hidden;
  border-right: 1px solid var(--border-color);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
  line-height: 20.8px;
  text-align: right;
  user-select: none;
}

.line-number {
  padding: 0 8px;
}

.html-editor {
  flex: 1;
  min-width: 0;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  background: var(--surface);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
  line-height: 20.8px;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
}

.preview-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--surface);
}
</style>
