<template>
  <PageLayout tool-path="/yaml-editor">
    <template #actions>
      <button class="btn btn-primary btn-sm" @click="formatYaml">格式化</button>
      <button class="btn btn-secondary btn-sm" @click="compressYaml">压缩</button>
      <button class="btn btn-secondary btn-sm" @click="validateYaml">校验</button>
      <button class="btn btn-secondary btn-sm" @click="yamlToJson">转 JSON</button>
    </template>

    <div class="page-body">
      <div class="editor-layout">
        <div class="panel editor-panel">
          <div class="panel-header">
            <span class="panel-title">YAML 输入</span>
            <div class="panel-actions">
              <button class="btn btn-secondary btn-xs" @click="clearInput">清空</button>
              <button class="btn btn-secondary btn-xs" @click="loadExample">示例</button>
              <button class="btn btn-secondary btn-xs" @click="loadFromFile">文件</button>
            </div>
          </div>
          <div class="editor-wrapper">
            <div class="editor-with-lines">
              <div ref="lineNumbersRef" class="line-numbers">
                <div v-for="n in inputLines" :key="n" class="line-number">
                  {{ n }}
                </div>
              </div>
              <textarea
                ref="textareaRef"
                v-model="yamlInput"
                class="code-editor"
                placeholder="请输入YAML代码..."
                spellcheck="false"
                @input="onInputChange"
                @scroll="syncScroll"
              />
            </div>
          </div>
          <div class="input-stats">
            <span>行数: {{ inputLines }}</span>
            <span>字符: {{ inputChars }}</span>
          </div>
        </div>

        <div class="panel editor-panel">
          <div class="panel-header">
            <span class="panel-title">结果输出</span>
            <div class="segmented">
              <button class="segmented-item" :class="{ active: outputType === 'yaml' }" @click="outputType = 'yaml'">
                YAML
              </button>
              <button class="segmented-item" :class="{ active: outputType === 'json' }" @click="outputType = 'json'">
                JSON
              </button>
              <button class="segmented-item" :class="{ active: outputType === 'tree' }" @click="outputType = 'tree'">
                树形
              </button>
            </div>
            <div class="panel-actions">
              <button class="btn btn-secondary btn-xs" @click="copyOutput">复制</button>
            </div>
          </div>
          <div class="editor-wrapper">
            <div v-if="outputType === 'yaml' || outputType === 'json'" class="editor-with-lines">
              <div ref="outputLineNumbersRef" class="line-numbers">
                <div v-for="n in outputLines" :key="n" class="line-number">
                  {{ n }}
                </div>
              </div>
              <textarea
                ref="outputTextareaRef"
                v-model="outputContent"
                class="code-editor output-editor"
                readonly
                spellcheck="false"
                @scroll="syncOutputScroll"
              />
            </div>
            <div v-else-if="outputType === 'tree'" class="tree-view">
              <div v-if="!parsedData" class="tree-empty">请输入有效的YAML内容</div>
              <div v-else class="tree-content" v-html="treeHtml" />
            </div>
          </div>
          <div class="output-stats">
            <span v-if="outputType === 'yaml' || outputType === 'json'">行数: {{ outputLines }}</span>
            <span v-if="outputType === 'yaml' || outputType === 'json'">字符: {{ outputChars }}</span>
          </div>
        </div>
      </div>

      <div class="status-bar">
        <div class="status-item" :class="statusClass">
          <span class="status-icon">{{ statusIcon }}</span>
          <span class="status-text">{{ statusText }}</span>
        </div>
        <div v-if="errorDetail" class="status-detail">
          {{ errorDetail }}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">YAML 语法说明</span>
        </div>
        <div class="panel-body help-content">
          <p><strong>基本语法：</strong></p>
          <ul>
            <li>使用缩进表示层级关系，缩进空格数不限（通常2或4个空格）</li>
            <li>键值对使用 <code>key: value</code> 格式，冒号后必须有空格</li>
            <li>列表项使用 <code>-</code> 开头，后面有空格</li>
            <li>注释使用 <code>#</code> 开头</li>
          </ul>
          <p><strong>数据类型：</strong></p>
          <ul>
            <li>字符串：可以直接写，或用引号包裹</li>
            <li>数字：直接写数字</li>
            <li>布尔值：<code>true</code> / <code>false</code></li>
            <li>空值：<code>null</code> 或留空</li>
            <li>日期：ISO格式，如 <code>2024-01-01</code></li>
          </ul>
          <p><strong>多行字符串：</strong></p>
          <ul>
            <li><code>|</code> 保留换行符</li>
            <li><code>></code> 将换行符替换为空格</li>
          </ul>
        </div>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from '@/composables'
import * as yaml from 'js-yaml'
import Toast from '@/components/Toast.vue'
import PageLayout from '@/layouts/PageLayout.vue'

const { toastVisible, toastMessage, toastType, showSuccess, showError, showWarning, showInfo } = useToast()

const textareaRef = ref(null)
const lineNumbersRef = ref(null)
const outputTextareaRef = ref(null)
const outputLineNumbersRef = ref(null)

const yamlInput = ref('')
const outputContent = ref('')
const outputType = ref('yaml')
const parsedData = ref(null)
const statusText = ref('等待输入')
const statusClass = ref('status-error')
const statusIcon = ref('')
const errorDetail = ref('')
const treeHtml = ref('')

const inputLines = computed(() => {
  if (!yamlInput.value) return 1
  return yamlInput.value.split('\n').length
})

const inputChars = computed(() => yamlInput.value.length)

function syncScroll() {
  if (textareaRef.value && lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

function syncOutputScroll() {
  if (outputTextareaRef.value && outputLineNumbersRef.value) {
    outputLineNumbersRef.value.scrollTop = outputTextareaRef.value.scrollTop
  }
}

const outputLines = computed(() => {
  if (!outputContent.value) return 1
  return outputContent.value.split('\n').length
})

const outputChars = computed(() => outputContent.value.length)

function renderTree(data, indent = 0) {
  if (data === null) {
    return `<span class="tree-null" style="padding-left:${indent}px">null</span>`
  }

  if (typeof data !== 'object') {
    const typeClass =
      typeof data === 'string'
        ? 'tree-string'
        : typeof data === 'number'
          ? 'tree-number'
          : typeof data === 'boolean'
            ? 'tree-boolean'
            : 'tree-value'
    const display = typeof data === 'string' ? `"${data}"` : String(data)
    return `<span class="${typeClass}" style="padding-left:${indent}px">${display}</span>`
  }

  const isArray = Array.isArray(data)
  const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data)

  let html = ''
  for (const [key, val] of entries) {
    const keyDisplay = isArray ? `[${key}]` : `${key}:`
    html += `<div class="tree-item" style="padding-left:${indent}px">`
    html += `<span class="tree-key">${keyDisplay}</span>`
    if (val !== null && typeof val === 'object') {
      html += renderTree(val, indent + 16)
    } else {
      html += renderValueInline(val)
    }
    html += '</div>'
  }
  return html
}

function renderValueInline(val) {
  if (val === null) return '<span class="tree-null">null</span>'
  const typeClass =
    typeof val === 'string'
      ? 'tree-string'
      : typeof val === 'number'
        ? 'tree-number'
        : typeof val === 'boolean'
          ? 'tree-boolean'
          : 'tree-value'
  const display = typeof val === 'string' ? `"${val}"` : String(val)
  return `<span class="${typeClass}">${display}</span>`
}

function onInputChange() {
  errorDetail.value = ''
  if (!yamlInput.value.trim()) {
    statusText.value = 'YAML内容不能为空'
    statusClass.value = 'status-error'
    parsedData.value = null
    outputContent.value = ''
    treeHtml.value = ''
    return
  }

  try {
    parsedData.value = yaml.load(yamlInput.value, {
      onWarning: (warning) => {
        errorDetail.value = warning.message
      }
    })

    const lines = yamlInput.value.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      if (trimmedLine.startsWith('#') || trimmedLine.startsWith('-') || trimmedLine === '') {
        continue
      }

      if (line.includes(':') && !line.includes(': ')) {
        const colonIndex = line.indexOf(':')
        const beforeColon = line.substring(0, colonIndex).trim()
        const afterColon = line.substring(colonIndex + 1).trim()

        if (
          beforeColon &&
          afterColon !== '' &&
          !afterColon.startsWith('#') &&
          afterColon !== '|' &&
          afterColon !== '>' &&
          !afterColon.startsWith(':')
        ) {
          throw new yaml.YAMLException(`第 ${i + 1} 行：冒号后缺少空格`)
        }
      }
    }

    statusText.value = 'YAML格式正确'
    statusClass.value = 'status-valid'
    updateOutput()
  } catch (e) {
    parsedData.value = null
    statusText.value = 'YAML格式错误'
    statusClass.value = 'status-error'

    let errorMsg = e.message || '未知错误'
    if (e.mark) {
      const lineNum = e.mark.line + 1
      const colNum = e.mark.column + 1
      errorMsg = `第 ${lineNum} 行，第 ${colNum} 列: ${e.reason || e.message}`
    }
    errorDetail.value = errorMsg
    outputContent.value = ''
    treeHtml.value = ''
  }
}

function updateOutput() {
  if (!parsedData.value) {
    outputContent.value = ''
    treeHtml.value = ''
    return
  }

  if (outputType.value === 'yaml') {
    try {
      outputContent.value = yaml.dump(parsedData.value, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      })
    } catch (e) {
      outputContent.value = '转换失败: ' + e.message
    }
  } else if (outputType.value === 'json') {
    try {
      outputContent.value = JSON.stringify(parsedData.value, null, 2)
    } catch (e) {
      outputContent.value = '转换失败: ' + e.message
    }
  } else if (outputType.value === 'tree') {
    treeHtml.value = renderTree(parsedData.value)
  }
}

watch(outputType, () => {
  updateOutput()
})

function formatYaml() {
  if (!yamlInput.value.trim()) {
    showWarning('请输入YAML内容')
    return
  }

  try {
    const data = yaml.load(yamlInput.value)
    yamlInput.value = yaml.dump(data, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    })
    onInputChange()
    showSuccess('格式化成功')
  } catch (e) {
    showError('格式化失败: ' + e.message)
  }
}

function compressYaml() {
  if (!yamlInput.value.trim()) {
    showWarning('请输入YAML内容')
    return
  }

  try {
    const data = yaml.load(yamlInput.value)
    yamlInput.value = yaml
      .dump(data, {
        indent: 2,
        flowLevel: 0,
        condenseFlow: true,
        noRefs: true
      })
      .replace(/\n+/g, '\n')
    onInputChange()
    showSuccess('压缩成功')
  } catch (e) {
    showError('压缩失败: ' + e.message)
  }
}

function validateYaml() {
  if (!yamlInput.value.trim()) {
    statusText.value = 'YAML内容不能为空'
    statusClass.value = 'status-error'
    showWarning('请输入YAML内容')
    return
  }

  try {
    yaml.load(yamlInput.value)
    statusText.value = 'YAML格式正确'
    statusClass.value = 'status-valid'
    errorDetail.value = ''
    showSuccess('校验通过，YAML格式正确')
  } catch (e) {
    statusText.value = 'YAML格式错误'
    statusClass.value = 'status-error'

    let errorMsg = e.message || '未知错误'
    if (e.mark) {
      const lineNum = e.mark.line + 1
      const colNum = e.mark.column + 1
      errorMsg = `第 ${lineNum} 行，第 ${colNum} 列: ${e.reason || e.message}`
    }
    errorDetail.value = errorMsg
    showError('校验失败: ' + errorMsg)
  }
}

function yamlToJson() {
  if (!yamlInput.value.trim()) {
    showWarning('请输入YAML内容')
    return
  }

  try {
    const data = yaml.load(yamlInput.value)
    outputType.value = 'json'
    outputContent.value = JSON.stringify(data, null, 2)
    showSuccess('转换成功')
  } catch (e) {
    showError('转换失败: ' + e.message)
  }
}

function clearInput() {
  yamlInput.value = ''
  outputContent.value = ''
  parsedData.value = null
  statusText.value = 'YAML内容不能为空'
  statusClass.value = 'status-error'
  errorDetail.value = ''
  treeHtml.value = ''
  showInfo('已清空')
}

function loadExample() {
  yamlInput.value = `# YAML示例
server:
  host: localhost
  port: 8080
  ssl:
    enabled: true
    cert: /path/to/cert.pem

database:
  type: mysql
  host: 127.0.0.1
  port: 3306
  name: myapp
  credentials:
    username: admin
    password: secret123

features:
  - authentication
  - logging
  - caching

logging:
  level: info
  format: "%(time)s - %(level)s - %(message)s"

users:
  - name: alice
    roles: [admin, user]
    active: true
  - name: bob
    roles: [user]
    active: false

settings:
  timeout: 30
  retry_count: 3
  debug: false`
  onInputChange()
  showInfo('已加载示例')
}

function loadFromFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.yaml,.yml'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      yamlInput.value = event.target.result
      onInputChange()
      showInfo('已加载文件: ' + file.name)
    }
    reader.onerror = () => {
      showError('读取文件失败')
    }
    reader.readAsText(file)
  }
  input.click()
}

function copyOutput() {
  const content = outputType.value === 'tree' ? JSON.stringify(parsedData.value, null, 2) : outputContent.value
  if (!content) {
    showWarning('没有可复制的内容')
    return
  }
  navigator.clipboard
    .writeText(content)
    .then(() => {
      showSuccess('已复制到剪贴板')
    })
    .catch(() => {
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        showSuccess('已复制到剪贴板')
      } catch {
        showError('复制失败，请手动复制')
      }
      document.body.removeChild(textarea)
    })
}

onMounted(() => {
  loadExample()
})
</script>

<style scoped>
.page-body {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-layout {
  display: flex;
  gap: 12px;
  height: 480px;
}

.editor-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.editor-panel + .editor-panel {
  margin-top: 0;
}

.panel-header .segmented {
  margin-left: auto;
}

.panel-header .segmented-item {
  height: 22px;
  padding: 0 8px;
  font-size: var(--font-size-xs);
}

.editor-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.editor-with-lines {
  display: flex;
  height: 100%;
}

.line-numbers {
  width: 40px;
  flex-shrink: 0;
  padding: 12px 8px;
  overflow: hidden;
  border-right: 1px solid var(--border-color);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-dense);
  line-height: 20.8px;
  text-align: right;
  user-select: none;
}

.line-number {
  min-height: 20.8px;
}

.code-editor {
  flex: 1;
  height: 100%;
  min-width: 0;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  background: var(--surface);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-dense);
  line-height: 20.8px;
}

.code-editor::placeholder {
  color: var(--text-tertiary);
}

.output-editor {
  background: var(--surface);
}

.tree-view {
  height: 100%;
  padding: 12px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-dense);
  line-height: 1.6;
}

.tree-empty {
  color: var(--text-tertiary);
  text-align: center;
  padding: 20px;
}

.tree-content {
  color: var(--text-primary);
}

.tree-item {
  display: flex;
  align-items: flex-start;
  padding: 2px 0;
  flex-wrap: wrap;
}

.tree-key {
  color: var(--text-primary);
  font-weight: 600;
  margin-right: 8px;
}

.tree-string {
  color: var(--success-dark);
}

.tree-number {
  color: var(--info-dark);
}

.tree-boolean {
  color: var(--warning-dark);
}

.tree-null {
  color: var(--text-tertiary);
}

.input-stats,
.output-stats {
  display: flex;
  gap: 16px;
  padding: 6px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.status-bar {
  padding: 8px 12px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
}

.status-waiting {
  color: var(--text-tertiary);
}

.status-valid {
  color: var(--success-dark);
}

.status-error {
  color: var(--error-dark);
}

.status-detail {
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(var(--error-rgb), 0.08);
  border-radius: var(--radius-sm);
  color: var(--error-dark);
  font-size: var(--font-size-xs);
  font-family: 'Consolas', 'Monaco', monospace;
}

.help-content {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.7;
}

.help-content p {
  margin-bottom: 8px;
}

.help-content ul {
  margin: 8px 0 12px;
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 4px;
}

.help-content code {
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>
