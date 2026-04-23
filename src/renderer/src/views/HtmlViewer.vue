<template>
  <div
    class="html-viewer-container"
    :style="{ width: Math.min(windowWidth * 0.9, windowWidth) + 'px' }"
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
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        HTML查看器
      </h1>
      <div class="subtitle">
        HTML编辑、查看与美化工具
      </div>
    </header>

    <div class="viewer-content">
      <div class="toolbar">
        <span class="size-info">{{ inputSize }} 字符 | {{ lineCount }} 行</span>
        <div class="tooltip-wrapper">
          <button
            class="btn-icon"
            title="格式化"
            @click="formatHtml"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
            ><path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              d="M6 4v3c0 2-1 2-1 4s1 2 1 4v3M18 4v3c0 2 1 2 1 4s-1 2-1 4v3"
            /></svg>
          </button>
          <span class="tooltip">格式化</span>
        </div>
        <div class="tooltip-wrapper">
          <button
            class="btn-icon"
            title="压缩"
            @click="minifyHtml"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
            ><path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              d="M12 4v6M8 7l4-3l4 3M12 20v-6M8 17l4 3l4-3"
            /></svg>
          </button>
          <span class="tooltip">压缩</span>
        </div>
        <div class="tooltip-wrapper">
          <button
            class="btn-icon"
            title="复制输入"
            @click="copyInput"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
            ><path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9V2z"
            /></svg>
          </button>
          <span class="tooltip">复制输入</span>
        </div>
        <div class="tooltip-wrapper">
          <button
            class="btn-icon"
            title="清空"
            @click="clearInput"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
            ><path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              d="M18 6L6 18M6 6l12 12"
            /></svg>
          </button>
          <span class="tooltip">清空</span>
        </div>
        <span class="divider" />
        <div class="tooltip-wrapper">
          <button
            class="btn-icon"
            title="运行预览"
            @click="runPreview"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
            ><path
              fill="currentColor"
              d="M8 5v14l11-7z"
            /></svg>
          </button>
          <span class="tooltip">运行预览</span>
        </div>
        <div class="tooltip-wrapper">
          <button
            class="btn-icon"
            title="复制输出"
            @click="copyOutput"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
            ><path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              d="M8 17H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2M9 11l3 3 3-3M12 14V2"
            /></svg>
          </button>
          <span class="tooltip">复制输出</span>
        </div>
        <div class="tooltip-wrapper">
          <button
            class="btn-icon"
            title="下载"
            @click="downloadHtml"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
            ><path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
            /></svg>
          </button>
          <span class="tooltip">下载</span>
        </div>
        <span class="divider" />
        <label class="auto-update-label">
          <input
            v-model="autoUpdate"
            type="checkbox"
          >
          <span>自动更新</span>
        </label>
        <div class="indent-control">
          <span>缩进：</span>
          <select
            v-model="indentSize"
            class="indent-select"
          >
            <option :value="2">
              2
            </option>
            <option :value="4">
              4
            </option>
          </select>
        </div>
      </div>

      <div class="editor-preview-wrapper">
        <div class="editor-panel">
          <div class="editor-wrapper">
            <div
              ref="lineNumbersRef"
              class="line-numbers"
            >
              <div
                v-for="n in displayLineCount"
                :key="n"
                class="line-number"
              >
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

        <div class="preview-panel">
          <div class="preview-wrapper">
            <iframe
              ref="previewFrame"
              class="preview-frame"
              :srcdoc="previewContent"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      class="toast"
      :class="{ show: toastVisible, error: toastType === 'error' }"
    >
      <span class="toast-icon">{{ toastType === 'error' ? '!' : '✓' }}</span>
      <span class="toast-message">{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useToast } from '@/composables'

const windowWidth = ref(0)
const { toastVisible, toastMessage, toastType, showToast, showError } = useToast()

function updateWindowWidth() {
  windowWidth.value = window.innerWidth
}

const htmlInput = ref('')
const previewContent = ref('')
const autoUpdate = ref(true)
const indentSize = ref(2)
const displayLineCount = ref(1)

const editorRef = ref(null)
const lineNumbersRef = ref(null)
const previewFrame = ref(null)

let updateTimeout = null

const inputSize = computed(() => htmlInput.value.length)
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
  showToast('预览已更新')
}

function updatePreview() {
  previewContent.value = htmlInput.value
}

function formatHtml() {
  if (!htmlInput.value.trim()) {
    showError('请输入HTML代码')
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
    showToast('格式化成功')
  } catch (e) {
    showError('格式化失败')
  }
}

function formatHtmlCode(html, indent) {
  const indentStr = ' '.repeat(indent)
  let result = ''
  let depth = 0
  let i = 0
  
  html = html.replace(/\s+/g, ' ').trim()
  
  const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']
  
  function addIndent() {
    result += indentStr.repeat(depth)
  }
  
  function getTagName(str, start) {
    const match = str.substring(start).match(/^([a-zA-Z][a-zA-Z0-9-]*)/)
    return match ? match[1].toLowerCase() : null
  }
  
  while (i < html.length) {
    if (html[i] === '<') {
      if (html.substring(i, i + 4) === '<!--') {
        const end = html.indexOf('-->', i + 4)
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
    showError('请输入HTML代码')
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
    showToast('压缩成功')
  } catch (e) {
    showError('压缩失败')
  }
}

function copyInput() {
  if (!htmlInput.value.trim()) {
    showError('没有可复制的内容')
    return
  }
  copyToClipboard(htmlInput.value)
  showToast('已复制输入')
}

function copyOutput() {
  if (!previewContent.value.trim()) {
    showError('没有预览内容')
    return
  }
  copyToClipboard(previewContent.value)
  showToast('已复制输出')
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
  showToast('已清空')
}

function downloadHtml() {
  if (!htmlInput.value.trim()) {
    showError('没有可下载的内容')
    return
  }
  
  const blob = new Blob([htmlInput.value], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'document.html'
  a.click()
  URL.revokeObjectURL(url)
  showToast('下载成功')
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      showToast('已复制到剪贴板')
    } catch (e) {
      showError('复制失败')
    }
    document.body.removeChild(textarea)
  })
}

onMounted(() => {
  updateWindowWidth()
  window.addEventListener('resize', updateWindowWidth)
  displayLineCount.value = 1
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
  clearTimeout(updateTimeout)
})
</script>

<style scoped>
.html-viewer-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  overflow: hidden;
}

.html-viewer-container header {
  background: var(--primary-gradient);
  color: white;
  padding: 20px 24px 16px;
  text-align: center;
  flex-shrink: 0;
}

.html-viewer-container header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 24px;
  margin-bottom: 6px;
}

.html-viewer-container header h1 .header-icon {
  width: 28px;
  height: 28px;
}

.html-viewer-container header .subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.viewer-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  gap: 8px;
  flex-wrap: wrap;
}

.editor-preview-wrapper {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.editor-panel {
  flex: 1;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.preview-panel {
  flex: 1;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.size-info {
  font-size: 12px;
  color: var(--text-tertiary);
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 8px;
}

.tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 1);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.tooltip {
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  pointer-events: none;
  z-index: 100;
}

.tooltip-wrapper:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.auto-update-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-tertiary);
}

.auto-update-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--primary-color);
}

.indent-control {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.indent-select {
  width: 40px;
  padding: 2px 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: var(--glass-bg);
  cursor: pointer;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: #f5f5f5;
}

.line-numbers {
  width: 50px;
  background: #eee;
  border-right: 1px solid #ddd;
  overflow-y: hidden;
  flex-shrink: 0;
  padding: 12px 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #999;
  text-align: right;
  user-select: none;
}

.line-number {
  padding: 0 8px;
}

.html-editor {
  flex: 1;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #f5f5f5;
  color: #333;
  resize: none;
  outline: none;
  border: none;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
}

.html-editor:focus {
  outline: none;
}

.preview-wrapper {
  flex: 1;
  overflow: hidden;
  background: white;
  border-radius: var(--radius-md);
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  border-radius: var(--radius-md);
}

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--primary-gradient);
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.toast.show {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.toast.error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
}

.toast-icon {
  font-weight: bold;
}
</style>