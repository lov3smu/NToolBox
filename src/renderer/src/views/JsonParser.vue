<template>
  <div
    class="json-parser-container"
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
          <polyline points="4 7 4 4 20 4 20 7" />
          <polyline points="4 17 4 20 20 20 20 17" />
          <line
            x1="9"
            y1="12"
            x2="15"
            y2="12"
          />
        </svg>
        JSON解析器
      </h1>
      <div class="subtitle">
        JSON格式化、验证、压缩与JSONPath查询工具
      </div>
    </header>

    <div class="json-content">
      <div class="editor-panel">
        <div class="panel-header">
          <div class="status-area">
            <span :class="['status', validationStatus]">{{ validationMessage }}</span>
            <span class="size-info">{{ inputSize }} 字符 | {{ lineCount }} 行</span>
          </div>
          <div class="panel-actions">
            <div class="tooltip-wrapper">
              <button
                class="btn-icon"
                title="格式化"
                @click="formatJson"
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
                title="折叠全部"
                @click="collapseAll"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                ><path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  d="M6 5L12 9L18 5M6 19L12 15L18 19"
                /></svg>
              </button>
              <span class="tooltip">折叠全部</span>
            </div>
            <div class="tooltip-wrapper">
              <button
                class="btn-icon"
                title="展开全部"
                @click="expandAll"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                ><path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  d="M6 9L12 5L18 9M6 15L12 19L18 15"
                /></svg>
              </button>
              <span class="tooltip">展开全部</span>
            </div>
            <div class="tooltip-wrapper">
              <button
                class="btn-icon"
                title="压缩JSON并复制"
                @click="copyMinified"
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
              <span class="tooltip">压缩JSON并复制</span>
            </div>
            <div class="tooltip-wrapper">
              <button
                class="btn-icon"
                title="压缩转义JSON并复制"
                @click="copyEscaped"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                ><path
                  fill="currentColor"
                  d="M6 17h3l2-4V7H5v6h3l-2 4m8 0h3l2-4V7h-6v6h3l-2 4z"
                /></svg>
              </button>
              <span class="tooltip">压缩转义JSON并复制</span>
            </div>
            <div class="tooltip-wrapper">
              <button
                class="btn-icon"
                title="JSON转XML"
                @click="convertToXml"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                ><path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  d="M8 6l-6 6l6 6M16 6l6 6l-6 6"
                /></svg>
              </button>
              <span class="tooltip">JSON转XML</span>
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
          </div>
        </div>
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
          <div 
            ref="editorRef" 
            class="json-editor"
            contenteditable="true"
            spellcheck="false"
            @input="onEditorInput"
            @keydown="onKeyDown"
            @paste="onPaste"
            @contextmenu.prevent="showContextMenu"
            @scroll="syncScroll"
          />
        </div>
      </div>

      <div class="jsonpath-section">
        <div class="section-header">
          <label>JSONPath查询</label>
        </div>
        <div class="jsonpath-input-row">
          <input
            v-model="jsonPathInput"
            type="text"
            class="input-field jsonpath-input"
            placeholder="输入JSONPath表达式，如：$.data.items[0].name"
          >
          <button
            class="btn btn-primary"
            @click="executeJsonPath"
          >
            查询
          </button>
          <button
            v-if="jsonPathResult !== null"
            class="btn btn-secondary"
            @click="copyJsonPathResult"
          >
            复制结果
          </button>
        </div>
        <div class="jsonpath-hint">
          <span>示例：</span>
          <code @click="setJsonPath('$.')">$. (根对象)</code>
          <code @click="setJsonPath('$.*')">$.* (所有子元素)</code>
          <code @click="setJsonPath('$.data')">$.data (指定属性)</code>
          <code @click="setJsonPath('$.items[*]')">$.items[*] (数组所有元素)</code>
        </div>
        <div
          v-if="jsonPathResult !== null"
          class="jsonpath-result"
        >
          <div class="result-header">
            <span class="result-label">查询结果：</span>
          </div>
          <div class="result-content">
            <pre>{{ jsonPathResultDisplay }}</pre>
          </div>
        </div>
      </div>

      <div class="help-section">
        <div class="help-title">
          JSONPath语法说明
        </div>
        <div class="help-content">
          <table class="syntax-table">
            <thead>
              <tr>
                <th>语法</th>
                <th>说明</th>
                <th>示例</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>$</code></td>
                <td>根对象</td>
                <td>$.name</td>
              </tr>
              <tr>
                <td><code>.</code></td>
                <td>子属性访问</td>
                <td>$.data.name</td>
              </tr>
              <tr>
                <td><code>[]</code></td>
                <td>数组索引或属性访问</td>
                <td>$[0]、$['name']</td>
              </tr>
              <tr>
                <td><code>*</code></td>
                <td>通配符，所有元素</td>
                <td>$.*、$.items[*]</td>
              </tr>
              <tr>
                <td><code>..</code></td>
                <td>递归下降</td>
                <td>$..name</td>
              </tr>
              <tr>
                <td><code>[start:end]</code></td>
                <td>数组切片</td>
                <td>$[0:2]</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div
        v-if="contextMenu.path"
        class="context-menu-item"
        @click="copySelectedPath"
      >
        复制JSONPath: {{ contextMenu.path }}
      </div>
      <div
        class="context-menu-item"
        @click="copySelectedText"
      >
        复制选中内容
      </div>
      <div class="context-menu-separator" />
      <div
        class="context-menu-item"
        @click="formatJson"
      >
        格式化JSON
      </div>
      <div
        class="context-menu-item"
        @click="compressJson"
      >
        压缩JSON
      </div>
    </div>

    <div
      class="toast"
      :class="{ show: toastVisible }"
    >
      <span class="toast-icon">✓</span>
      <span class="toast-message">{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useWindowWidth } from '@/composables'

const windowWidth = useWindowWidth()

const jsonInput = ref('')
const validationStatus = ref('')
const validationMessage = ref('等待输入')
const jsonPathInput = ref('')
const jsonPathResult = ref(null)
const parsedJson = ref(null)
const collapsedPaths = ref(new Set())
const displayLineCount = ref(1)
const foldMarkers = ref([])

const toastVisible = ref(false)
const toastMessage = ref('')

const editorRef = ref(null)
const lineNumbersRef = ref(null)

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  path: '',
  selectedText: ''
})

const inputSize = computed(() => jsonInput.value.length)
const lineCount = computed(() => {
  if (!jsonInput.value) return 1
  return jsonInput.value.split('\n').length
})

const jsonPathResultDisplay = computed(() => {
  if (jsonPathResult.value === null) return ''
  if (typeof jsonPathResult.value === 'object') {
    return JSON.stringify(jsonPathResult.value, null, 2)
  }
  return String(jsonPathResult.value)
})

let formatTimeout = null
let isRendering = false
let lastRenderedText = ''

function onEditorInput() {
  if (isRendering) return
  const text = editorRef.value.innerText || ''
  jsonInput.value = text
  jsonPathResult.value = null
  
  clearTimeout(formatTimeout)
  formatTimeout = setTimeout(() => {
    autoFormat()
  }, 800)
  
  displayLineCount.value = (editorRef.value.querySelectorAll('div')?.length) || 1
}

function onKeyDown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    document.execCommand('insertText', false, '  ')
  }
}

function onPaste(e) {
  e.preventDefault()
  const text = e.clipboardData.getData('text/plain')
    .replace(/[▼▶]/g, '')
    .replace(/\u200B/g, '')
  document.execCommand('insertText', false, text)
}

function autoFormat() {
  const input = jsonInput.value.trim()
  if (!input) {
    validationStatus.value = ''
    validationMessage.value = '等待输入'
    parsedJson.value = null
    return
  }
  
  try {
    const parsed = JSON.parse(input)
    const formatted = JSON.stringify(parsed, null, 2)
    if (formatted !== jsonInput.value) {
      renderJson(formatted, parsed)
    }
    parsedJson.value = parsed
    validationStatus.value = 'valid'
    validationMessage.value = 'JSON格式正确'
  } catch (e) {
    if (!parsedJson.value) {
      validationStatus.value = 'error'
      validationMessage.value = `格式错误: ${e.message}`
    }
    renderHighlight(jsonInput.value)
  }
}

function renderJson(text, parsed) {
  if (!editorRef.value) return
  isRendering = true
  lastRenderedText = text
  
  foldMarkers.value = parseFoldMarkers(text)
  const html = highlightJsonWithFolds(text)
  editorRef.value.innerHTML = html
  jsonInput.value = text
  displayLineCount.value = text.split('\n').length
  
  nextTick(() => {
    isRendering = false
    bindFoldEvents()
  })
}

function renderHighlight(text) {
  if (!editorRef.value) return
  isRendering = true
  lastRenderedText = text
  
  foldMarkers.value = parseFoldMarkers(text)
  const html = highlightJsonWithFolds(text)
  editorRef.value.innerHTML = html
  displayLineCount.value = text.split('\n').length || 1
  
  nextTick(() => {
    isRendering = false
    bindFoldEvents()
  })
}

function parseFoldMarkers(text) {
  const markers = []
  const stack = []
  let line = 1
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    
    if (char === '\n') {
      line++
      continue
    }
    
    if (char === '{') {
      stack.push({ type: 'object', startLine: line, startPos: i, depth: stack.length })
    } else if (char === '[') {
      stack.push({ type: 'array', startLine: line, startPos: i, depth: stack.length })
    } else if (char === '}') {
      if (stack.length > 0 && stack[stack.length - 1].type === 'object') {
        const marker = stack.pop()
        if (marker.startLine !== line) {
          marker.endLine = line
          marker.endPos = i
          marker.id = `fold-${marker.startLine}-${marker.endLine}`
          markers.unshift(marker)
        }
      }
    } else if (char === ']') {
      if (stack.length > 0 && stack[stack.length - 1].type === 'array') {
        const marker = stack.pop()
        if (marker.startLine !== line) {
          marker.endLine = line
          marker.endPos = i
          marker.id = `fold-${marker.startLine}-${marker.endLine}`
          markers.unshift(marker)
        }
      }
    }
  }
  
  return markers.sort((a, b) => b.depth - a.depth)
}

function highlightJsonWithFolds(text) {
  const lines = text.split('\n')
  const lineStates = new Array(lines.length).fill('show')
  
  for (const marker of foldMarkers.value) {
    const isCollapsed = collapsedPaths.value.has(marker.id)
    if (isCollapsed) {
      for (let i = marker.startLine; i <= marker.endLine; i++) {
        lineStates[i - 1] = marker.id
      }
    }
  }
  
  const startLineMarkers = {}
  for (const marker of foldMarkers.value) {
    if (!startLineMarkers[marker.startLine]) {
      startLineMarkers[marker.startLine] = marker
    } else if (marker.depth < startLineMarkers[marker.startLine].depth) {
      startLineMarkers[marker.startLine] = marker
    }
  }
  
  let result = ''
  const collapsedShown = new Set()
  
  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1
    const state = lineStates[lineIndex]
    
    if (state === 'show') {
      const marker = startLineMarkers[lineNum]
      if (marker && !collapsedPaths.value.has(marker.id)) {
        result += `<div class="fold-line" data-fold-id="${marker.id}">`
        result += `<span class="fold-toggle fold-open visible" data-fold-id="${marker.id}" title="点击折叠"></span>`
        result += highlightLine(line)
        result += '</div>'
      } else {
        result += '<div>'
        result += '<span class="fold-toggle"></span>'
        result += highlightLine(line)
        result += '</div>'
      }
    } else {
      if (!collapsedShown.has(state)) {
        collapsedShown.add(state)
        const marker = foldMarkers.value.find(m => m.id === state)
        if (marker) {
          result += `<div class="fold-line collapsed" data-fold-id="${marker.id}">`
          result += `<span class="fold-toggle fold-closed visible" data-fold-id="${marker.id}" title="点击展开"></span>`
          result += `<span class="hl-${marker.type === 'object' ? 'brace' : 'bracket'}">${marker.type === 'object' ? '{' : '['}</span>`
          result += '<span class="fold-ellipsis">...</span>'
          result += `<span class="hl-${marker.type === 'object' ? 'brace' : 'bracket'}">${marker.type === 'object' ? '}' : ']'}</span>`
          result += '</div>'
        }
      }
    }
  })
  
  return result
}

function highlightLine(line) {
  let result = ''
  let i = 0
  
  while (i < line.length) {
    const char = line[i]
    
    if (char === '"') {
      const start = i
      i++
      while (i < line.length) {
        if (line[i] === '\\' && i + 1 < line.length) {
          i += 2
        } else if (line[i] === '"') {
          i++
          break
        } else {
          i++
        }
      }
      const str = line.substring(start, i)
      
      let j = i
      while (j < line.length && /\s/.test(line[j])) j++
      if (j < line.length && line[j] === ':') {
        result += `<span class="hl-key">${escapeHtml(str)}</span>`
      } else {
        result += `<span class="hl-string">${escapeHtml(str)}</span>`
      }
    } else if (char >= '0' && char <= '9' || (char === '-' && i + 1 < line.length && /[0-9]/.test(line[i + 1]))) {
      const start = i
      if (char === '-') i++
      while (i < line.length && /[0-9.eE+-]/.test(line[i])) i++
      result += `<span class="hl-number">${escapeHtml(line.substring(start, i))}</span>`
    } else if (line.substring(i).startsWith('true')) {
      result += '<span class="hl-boolean">true</span>'
      i += 4
    } else if (line.substring(i).startsWith('false')) {
      result += '<span class="hl-boolean">false</span>'
      i += 5
    } else if (line.substring(i).startsWith('null')) {
      result += '<span class="hl-null">null</span>'
      i += 4
    } else if (char === '{' || char === '}') {
      result += `<span class="hl-brace">${char}</span>`
      i++
    } else if (char === '[' || char === ']') {
      result += `<span class="hl-bracket">${char}</span>`
      i++
    } else if (char === ':') {
      result += `<span class="hl-colon">${char}</span>`
      i++
    } else if (char === ',') {
      result += `<span class="hl-comma">${char}</span>`
      i++
    } else {
      result += escapeHtml(char)
      i++
    }
  }
  
  return result
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function bindFoldEvents() {
  if (!editorRef.value) return
  
  const toggles = editorRef.value.querySelectorAll('.fold-toggle.visible')
  toggles.forEach(toggle => {
    toggle.onclick = (e) => {
      e.stopPropagation()
      const foldId = toggle.getAttribute('data-fold-id')
      if (!foldId) return
      if (collapsedPaths.value.has(foldId)) {
        collapsedPaths.value.delete(foldId)
      } else {
        collapsedPaths.value.add(foldId)
      }
      renderJson(lastRenderedText, parsedJson.value)
    }
  })
}

function formatJson() {
  const input = jsonInput.value.trim()
  if (!input) {
    showToast('请输入JSON数据')
    return
  }
  
  try {
    const parsed = JSON.parse(input)
    const formatted = JSON.stringify(parsed, null, 2)
    renderJson(formatted, parsed)
    parsedJson.value = parsed
    validationStatus.value = 'valid'
    validationMessage.value = 'JSON格式正确'
    showToast('格式化成功')
  } catch (e) {
    validationStatus.value = 'error'
    validationMessage.value = `格式错误: ${e.message}`
    showToast('JSON格式错误')
  }
}

function compressJson() {
  const input = jsonInput.value.trim()
  if (!input) {
    showToast('请输入JSON数据')
    return
  }
  
  try {
    const parsed = JSON.parse(input)
    const compressed = JSON.stringify(parsed)
    renderJson(compressed, parsed)
    parsedJson.value = parsed
    validationStatus.value = 'valid'
    validationMessage.value = 'JSON格式正确'
    showToast('压缩成功')
  } catch (e) {
    validationStatus.value = 'error'
    validationMessage.value = `格式错误: ${e.message}`
    showToast('JSON格式错误')
  }
}

function clearInput() {
  jsonInput.value = ''
  lastRenderedText = ''
  if (editorRef.value) editorRef.value.innerHTML = ''
  parsedJson.value = null
  validationStatus.value = ''
  validationMessage.value = '等待输入'
  jsonPathResult.value = ''
  jsonPathInput.value = ''
  collapsedPaths.value.clear()
  foldMarkers.value = []
  displayLineCount.value = 1
  showToast('已清空')
}

function collapseAll() {
  if (!parsedJson.value) {
    showToast('请先输入有效的JSON数据')
    return
  }
  if (foldMarkers.value.length === 0) {
    showToast('没有可折叠的内容')
    return
  }
  foldMarkers.value.forEach(marker => {
    collapsedPaths.value.add(marker.id)
  })
  renderJson(lastRenderedText, parsedJson.value)
  showToast('已折叠全部')
}

function expandAll() {
  if (!parsedJson.value) {
    showToast('请先输入有效的JSON数据')
    return
  }
  if (collapsedPaths.value.size === 0) {
    showToast('没有折叠的内容')
    return
  }
  collapsedPaths.value.clear()
  renderJson(lastRenderedText, parsedJson.value)
  showToast('已展开全部')
}

function copyMinified() {
  const input = jsonInput.value.trim()
  if (!input) {
    showToast('请输入JSON数据')
    return
  }
  
  try {
    const parsed = JSON.parse(input)
    const minified = JSON.stringify(parsed)
    copyToClipboard(minified)
    showToast('已复制压缩JSON')
  } catch (e) {
    showToast('JSON格式错误')
  }
}

function copyEscaped() {
  const input = jsonInput.value.trim()
  if (!input) {
    showToast('请输入JSON数据')
    return
  }
  
  try {
    const parsed = JSON.parse(input)
    const minified = JSON.stringify(parsed)
    const escaped = JSON.stringify(minified)
    copyToClipboard(escaped)
    showToast('已复制压缩转义JSON')
  } catch (e) {
    showToast('JSON格式错误')
  }
}

function convertToXml() {
  const input = jsonInput.value.trim()
  if (!input) {
    showToast('请输入JSON数据')
    return
  }
  
  try {
    const parsed = JSON.parse(input)
    const xml = jsonToXml(parsed, 'root')
    copyToClipboard(xml)
    showToast('已复制XML')
  } catch (e) {
    showToast('JSON格式错误')
  }
}

function jsonToXml(obj, rootName) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  
  function toXml(value, tagName) {
    if (value === null) return `<${tagName} xsi:nil="true"/>`
    if (typeof value === 'boolean' || typeof value === 'number') {
      return `<${tagName}>${value}</${tagName}>`
    }
    if (typeof value === 'string') {
      const escaped = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
      return `<${tagName}>${escaped}</${tagName}>`
    }
    if (Array.isArray(value)) {
      return value.map(item => toXml(item, tagName)).join('\n  ')
    }
    if (typeof value === 'object') {
      let inner = ''
      for (const key of Object.keys(value)) {
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_')
        inner += '\n  ' + toXml(value[key], safeKey)
      }
      return `<${tagName}>${inner}\n</${tagName}>`
    }
    return `<${tagName}>${String(value)}</${tagName}>`
  }
  
  xml += toXml(obj, rootName)
  return xml
}

function syncScroll() {
  if (lineNumbersRef.value && editorRef.value) {
    lineNumbersRef.value.scrollTop = editorRef.value.scrollTop
  }
}

function showContextMenu(event) {
  const selection = window.getSelection()
  const selectedText = selection.toString()
  
  let path = ''
  if (editorRef.value && selection.rangeCount > 0 && lastRenderedText) {
    const range = selection.getRangeAt(0)
    const startPos = getTextPosition(editorRef.value, range.startContainer, range.startOffset)
    path = findJsonPathAtPosition(lastRenderedText, startPos)
  }
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    path: path,
    selectedText: selectedText
  }
}

function getTextPosition(root, node, offset) {
  let pos = 0
  const divs = root.querySelectorAll('div')
  
  for (const div of divs) {
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false)
    while (walker.nextNode()) {
      if (walker.currentNode === node) {
        return pos + offset
      }
      pos += walker.currentNode.length
    }
    pos += 1
  }
  
  return 0
}

function findJsonPathAtPosition(text, pos) {
  if (!parsedJson.value) return ''
  
  const pathStack = []
  let i = 0
  
  while (i < text.length) {
    const char = text[i]
    
    if (char === '{') {
      pathStack.push({ type: 'object', key: null })
      i++
    } else if (char === '[') {
      pathStack.push({ type: 'array', index: 0 })
      i++
    } else if (char === '}') {
      pathStack.pop()
      i++
    } else if (char === ']') {
      pathStack.pop()
      i++
    } else if (char === ',') {
      for (let j = pathStack.length - 1; j >= 0; j--) {
        if (pathStack[j].type === 'array') {
          pathStack[j].index++
          break
        } else if (pathStack[j].type === 'object') {
          pathStack[j].key = null
          break
        }
      }
      i++
    } else if (char === '"') {
      const start = i
      i++
      while (i < text.length) {
        if (text[i] === '\\' && i + 1 < text.length) {
          i += 2
        } else if (text[i] === '"') {
          i++
          break
        } else {
          i++
        }
      }
      const strEnd = i
      
      while (i < text.length && /\s/.test(text[i])) i++
      
      if (pos >= start && pos < strEnd) {
        const afterColon = i < text.length && text[i] === ':'
        if (afterColon) {
          const key = text.substring(start + 1, strEnd - 1)
          for (let k = pathStack.length - 1; k >= 0; k--) {
            if (pathStack[k].type === 'object') {
              pathStack[k].key = key
              break
            }
          }
        } else {
          findPrecedingKeySimple(text, strEnd, pathStack)
        }
        break
      }
      
      if (i < text.length && text[i] === ':') {
        const key = text.substring(start + 1, strEnd - 1)
        for (let k = pathStack.length - 1; k >= 0; k--) {
          if (pathStack[k].type === 'object') {
            pathStack[k].key = key
            break
          }
        }
        i++
      }
    } else if (/[0-9-]/.test(char)) {
      const start = i
      if (char === '-') i++
      while (i < text.length && /[0-9.eE+-]/.test(text[i])) i++
      if (pos >= start && pos < i) {
        findPrecedingKeySimple(text, i, pathStack)
        break
      }
    } else if (text.substring(i).startsWith('true')) {
      const end = i + 4
      if (pos >= i && pos < end) {
        findPrecedingKeySimple(text, end, pathStack)
        break
      }
      i += 4
    } else if (text.substring(i).startsWith('false')) {
      const end = i + 5
      if (pos >= i && pos < end) {
        findPrecedingKeySimple(text, end, pathStack)
        break
      }
      i += 5
    } else if (text.substring(i).startsWith('null')) {
      const end = i + 4
      if (pos >= i && pos < end) {
        findPrecedingKeySimple(text, end, pathStack)
        break
      }
      i += 4
    } else {
      i++
    }
    
    if (i >= pos && char !== '"' && char !== '{' && char !== '[') {
      break
    }
  }
  
  if (pathStack.length === 0) return '$'
  
  let path = '$'
  for (const item of pathStack) {
    if (item.type === 'object' && item.key) {
      path += '.' + item.key
    } else if (item.type === 'array') {
      path += '[' + item.index + ']'
    }
  }
  
  return path
}

function findPrecedingKeySimple(text, valueEnd, pathStack) {
  let i = valueEnd - 1
  
  while (i >= 0 && /\s/.test(text[i])) i--
  if (i < 0) return
  
  if (text[i] === '"') {
    i--
    while (i >= 0) {
      if (text[i] === '\\' && i > 0) {
        i -= 2
      } else if (text[i] === '"') {
        i--
        break
      } else {
        i--
      }
    }
  }
  
  while (i >= 0 && /\s/.test(text[i])) i--
  if (i < 0) return
  
  if (text[i] !== ':') return
  
  i--
  while (i >= 0 && /\s/.test(text[i])) i--
  if (i < 0 || text[i] !== '"') return
  
  const keyEnd = i
  i--
  while (i >= 0) {
    if (text[i] === '\\' && i > 0) {
      i -= 2
    } else if (text[i] === '"') {
      break
    } else {
      i--
    }
  }
  if (i < 0) return
  
  const key = text.substring(i + 1, keyEnd)
  for (let j = pathStack.length - 1; j >= 0; j--) {
    if (pathStack[j].type === 'object') {
      pathStack[j].key = key
      break
    }
  }
}

function copySelectedPath() {
  if (!contextMenu.value.path) {
    showToast('无法获取路径')
    return
  }
  copyToClipboard(contextMenu.value.path)
  hideContextMenu()
}

function copySelectedText() {
  if (!contextMenu.value.selectedText) {
    showToast('没有选中内容')
    return
  }
  copyToClipboard(contextMenu.value.selectedText)
  hideContextMenu()
}

function hideContextMenu() {
  contextMenu.value.show = false
}

function setJsonPath(path) {
  jsonPathInput.value = path
  executeJsonPath()
}

function executeJsonPath() {
  if (!parsedJson.value) {
    showToast('请先输入有效的JSON数据')
    return
  }
  
  const path = jsonPathInput.value.trim()
  if (!path) {
    showToast('请输入JSONPath表达式')
    return
  }
  
  try {
    const result = evaluateJsonPath(parsedJson.value, path)
    jsonPathResult.value = result
    showToast('查询成功')
  } catch (e) {
    jsonPathResult.value = null
    showToast(`查询失败: ${e.message}`)
  }
}

function evaluateJsonPath(obj, path) {
  if (!path.startsWith('$')) {
    throw new Error('JSONPath必须以$开头')
  }
  
  path = path.substring(1)
  
  if (path === '' || path === '.') {
    return obj
  }
  
  const tokens = tokenizeJsonPath(path)
  let current = obj
  
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined
    }
    
    if (token.type === 'property') {
      if (typeof current !== 'object' || current === null) {
        return undefined
      }
      current = current[token.value]
    } else if (token.type === 'index') {
      if (!Array.isArray(current)) {
        return undefined
      }
      current = current[token.value]
    } else if (token.type === 'wildcard') {
      if (Array.isArray(current)) {
        return current
      } else if (typeof current === 'object' && current !== null) {
        return Object.values(current)
      }
      return undefined
    } else if (token.type === 'slice') {
      if (!Array.isArray(current)) {
        return undefined
      }
      const [start, end] = token.value
      current = current.slice(start, end)
    } else if (token.type === 'recursive') {
      const results = []
      recursiveSearch(current, token.value, results)
      return results
    }
  }
  
  return current
}

function tokenizeJsonPath(path) {
  const tokens = []
  let i = 0
  
  while (i < path.length) {
    if (path[i] === '.') {
      i++
      if (path[i] === '.') {
        i++
        let propName = ''
        while (i < path.length && path[i] !== '.' && path[i] !== '[') {
          propName += path[i]
          i++
        }
        tokens.push({ type: 'recursive', value: propName })
      } else if (path[i] === '*') {
        i++
        tokens.push({ type: 'wildcard' })
      } else {
        let propName = ''
        while (i < path.length && path[i] !== '.' && path[i] !== '[') {
          propName += path[i]
          i++
        }
        if (propName) {
          tokens.push({ type: 'property', value: propName })
        }
      }
    } else if (path[i] === '[') {
      i++
      if (path[i] === '*') {
        i++
        if (path[i] === ']') i++
        tokens.push({ type: 'wildcard' })
      } else if (path[i] === "'") {
        i++
        let propName = ''
        while (i < path.length && path[i] !== "'") {
          propName += path[i]
          i++
        }
        i++
        if (path[i] === ']') i++
        tokens.push({ type: 'property', value: propName })
      } else if (path[i] === '"') {
        i++
        let propName = ''
        while (i < path.length && path[i] !== '"') {
          propName += path[i]
          i++
        }
        i++
        if (path[i] === ']') i++
        tokens.push({ type: 'property', value: propName })
      } else {
        let numStr = ''
        while (i < path.length && /[0-9:]/.test(path[i])) {
          numStr += path[i]
          i++
        }
        if (path[i] === ']') i++
        
        if (numStr.includes(':')) {
          const parts = numStr.split(':')
          const start = parts[0] ? parseInt(parts[0]) : 0
          const end = parts[1] ? parseInt(parts[1]) : undefined
          tokens.push({ type: 'slice', value: [start, end] })
        } else {
          tokens.push({ type: 'index', value: parseInt(numStr) })
        }
      }
    } else {
      i++
    }
  }
  
  return tokens
}

function recursiveSearch(obj, propName, results) {
  if (typeof obj !== 'object' || obj === null) return
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (propName === '' || propName === '*') {
        results.push(item)
      }
      recursiveSearch(item, propName, results)
    }
  } else {
    if (propName === '' || propName === '*') {
      results.push(...Object.values(obj))
    } else if (Object.prototype.hasOwnProperty.call(obj, propName)) {
      results.push(obj[propName])
    }
    for (const key in obj) {
      recursiveSearch(obj[key], propName, results)
    }
  }
}

function copyJsonPathResult() {
  if (jsonPathResult.value === null) {
    showToast('没有可复制的结果')
    return
  }
  const text = typeof jsonPathResult.value === 'object'
    ? JSON.stringify(jsonPathResult.value, null, 2)
    : String(jsonPathResult.value)
  copyToClipboard(text)
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
      showToast('复制失败')
    }
    document.body.removeChild(textarea)
  })
}

function showToast(message) {
  toastMessage.value = message
  toastVisible.value = true
  setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

function handleClickOutside(e) {
  if (contextMenu.value.show && !e.target.closest('.context-menu')) {
    hideContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  clearTimeout(formatTimeout)
})
</script>

<style scoped>
.json-parser-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  overflow: hidden;
}

.json-parser-container header {
  background: var(--primary-gradient);
  color: white;
  padding: 20px 24px 16px;
  text-align: center;
  flex-shrink: 0;
}

.json-parser-container header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 24px;
  margin-bottom: 6px;
}

.json-parser-container header h1 .header-icon {
  width: 28px;
  height: 28px;
}

.json-parser-container header .subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.json-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  overflow-y: auto;
}

.editor-panel {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 70vh;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: #f5f5f5;
  min-height: 60vh;
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

.json-editor {
  flex: 1;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #f5f5f5;
  color: #333;
  overflow-y: auto;
  outline: none;
  border: none;
}

.json-editor:focus {
  outline: none;
}

.jsonpath-section {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(248, 249, 250, 0.5);
  border-bottom: 1px solid var(--border-color);
}

.status-area {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status.valid {
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
}

.status.error {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
}

.size-info {
  font-size: 12px;
  color: var(--text-tertiary);
}

.panel-actions {
  display: flex;
  gap: 4px;
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

.jsonpath-section .section-header {
  margin-bottom: 12px;
}

.jsonpath-section .section-header label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.jsonpath-input-row {
  display: flex;
  gap: 10px;
}

.input-field {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--glass-bg);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.jsonpath-hint {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--text-tertiary);
  flex-wrap: wrap;
}

.jsonpath-hint code {
  padding: 2px 6px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 4px;
  cursor: pointer;
  color: var(--primary-color);
  font-family: 'Consolas', 'Monaco', monospace;
}

.jsonpath-hint code:hover {
  background: rgba(102, 126, 234, 0.2);
}

.jsonpath-result {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: var(--radius-sm);
}

.result-header {
  margin-bottom: 8px;
}

.result-label {
  font-size: 13px;
  font-weight: 600;
  color: #15803d;
}

.result-content pre {
  margin: 0;
  padding: 8px;
  background: rgba(248, 249, 250, 0.5);
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
  max-height: 200px;
  overflow-y: auto;
}

.btn {
  padding: 10px 20px;
  border: 1px solid var(--primary-color);
  background: var(--primary-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  color: white;
  transition: all 0.2s;
  font-weight: 500;
}

.btn:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.8);
  border-color: rgba(102, 126, 234, 0.8);
}

.btn-secondary {
  background: transparent;
  color: var(--primary-color);
}

.btn-secondary:hover {
  background: rgba(102, 126, 234, 0.1);
}

.help-section {
  background: rgba(248, 249, 250, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
}

.help-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.syntax-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.syntax-table th,
.syntax-table td {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  text-align: left;
}

.syntax-table th {
  background: rgba(248, 249, 250, 0.5);
  font-weight: 600;
  color: var(--text-primary);
}

.syntax-table code {
  padding: 2px 6px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--primary-color);
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
</style>

<style>
.json-editor .hl-key {
  color: #c62828;
}

.json-editor .hl-string {
  color: #1565c0;
}

.json-editor .hl-number {
  color: #2e7d32;
}

.json-editor .hl-boolean {
  color: #0d22aa;
}

.json-editor .hl-null {
  color: #808080;
}

.json-editor .hl-brace {
  color: #333;
  font-weight: bold;
}

.json-editor .hl-bracket {
  color: #333;
  font-weight: bold;
}

.json-editor .hl-colon {
  color: #333;
}

.json-editor .hl-comma {
  color: #333;
}

.json-editor .fold-toggle {
  position: absolute;
  left: -20px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #666;
  cursor: pointer;
  user-select: none;
  font-size: 9px;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 1;
}

.json-editor div:hover .fold-toggle {
  opacity: 1;
}

.json-editor .fold-toggle.visible {
  opacity: 1;
}

.json-editor .fold-toggle::before {
  display: block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  content: '▶';
  font-size: 8px;
}

.json-editor .fold-toggle.fold-open::before {
  transform: rotate(90deg);
}

.json-editor .fold-toggle.fold-closed::before {
  transform: rotate(0deg);
}

.json-editor .fold-toggle:hover {
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
}

.json-editor .fold-line {
  position: relative;
}

.json-editor .fold-line.collapsed {
  background: rgba(102, 126, 234, 0.05);
  border-radius: 2px;
}

.json-editor .fold-ellipsis {
  color: #999;
  font-style: italic;
  padding: 0 2px;
}

.json-editor div {
  white-space: pre;
  min-height: 1.6em;
  position: relative;
  margin-left: 24px;
}
</style>