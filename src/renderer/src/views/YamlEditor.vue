<template>
  <div class="yaml-container" :style="{ width: windowWidth + 'px' }">
    <header>
      <h1>
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        YAML编辑(验证)器
      </h1>
      <div class="subtitle">YAML格式化、校验、转换工具</div>
    </header>

    <div class="yaml-content">
      <div class="editor-layout">
        <div class="editor-panel input-panel">
          <div class="panel-header">
            <span class="panel-title">YAML输入</span>
            <div class="panel-actions">
              <button class="btn-action" @click="clearInput">清空</button>
              <button class="btn-action" @click="loadExample">示例</button>
              <button class="btn-action" @click="loadFromFile">文件</button>
            </div>
          </div>
          <div class="editor-wrapper">
            <div class="editor-with-lines">
              <div class="line-numbers" ref="lineNumbersRef">
                <div v-for="n in inputLines" :key="n" class="line-number">{{ n }}</div>
              </div>
              <textarea
                ref="textareaRef"
                v-model="yamlInput"
                class="code-editor"
                placeholder="请输入YAML代码..."
                spellcheck="false"
                @input="onInputChange"
                @scroll="syncScroll"
              ></textarea>
            </div>
          </div>
          <div class="input-stats">
            <span>行数: {{ inputLines }}</span>
            <span>字符: {{ inputChars }}</span>
          </div>
        </div>

        <div class="editor-panel output-panel">
          <div class="panel-header">
            <span class="panel-title">结果输出</span>
            <div class="panel-actions">
              <button class="btn-action" @click="copyOutput">复制</button>
            </div>
          </div>
          <div class="output-tabs">
            <button class="output-tab" :class="{ active: outputType === 'yaml' }" @click="outputType = 'yaml'">格式化YAML</button>
            <button class="output-tab" :class="{ active: outputType === 'json' }" @click="outputType = 'json'">转换为JSON</button>
            <button class="output-tab" :class="{ active: outputType === 'tree' }" @click="outputType = 'tree'">树形视图</button>
          </div>
          <div class="editor-wrapper">
            <div class="editor-with-lines" v-if="outputType === 'yaml' || outputType === 'json'">
              <div class="line-numbers" ref="outputLineNumbersRef">
                <div v-for="n in outputLines" :key="n" class="line-number">{{ n }}</div>
              </div>
              <textarea
                ref="outputTextareaRef"
                v-model="outputContent"
                class="code-editor output-editor"
                readonly
                spellcheck="false"
                @scroll="syncOutputScroll"
              ></textarea>
            </div>
            <div v-else-if="outputType === 'tree'" class="tree-view">
              <div class="tree-empty" v-if="!parsedData">请输入有效的YAML内容</div>
              <div v-else class="tree-content" v-html="treeHtml"></div>
            </div>
          </div>
          <div class="output-stats">
            <span v-if="outputType === 'yaml' || outputType === 'json'">行数: {{ outputLines }}</span>
            <span v-if="outputType === 'yaml' || outputType === 'json'">字符: {{ outputChars }}</span>
          </div>
        </div>
      </div>

      <div class="action-bar">
        <button class="btn btn-primary" @click="formatYaml">格式化</button>
        <button class="btn btn-secondary" @click="compressYaml">压缩</button>
        <button class="btn btn-secondary" @click="validateYaml">校验</button>
        <button class="btn btn-secondary" @click="yamlToJson">转JSON</button>
      </div>

      <div class="status-bar">
        <div class="status-item" :class="statusClass">
          <span class="status-icon">{{ statusIcon }}</span>
          <span class="status-text">{{ statusText }}</span>
        </div>
        <div class="status-detail" v-if="errorDetail">{{ errorDetail }}</div>
      </div>

      <div class="help-section">
        <div class="help-title">YAML语法说明</div>
        <div class="help-content">
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

    <div class="toast" :class="{ show: toastVisible }">
      <span class="toast-icon">✓</span>
      <span class="toast-message">{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useWindowWidth } from '@/composables'
import * as yaml from 'js-yaml'

const windowWidth = useWindowWidth()

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
const toastVisible = ref(false)
const toastMessage = ref('')
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
    const typeClass = typeof data === 'string' ? 'tree-string' : 
                      typeof data === 'number' ? 'tree-number' : 
                      typeof data === 'boolean' ? 'tree-boolean' : 'tree-value'
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
  const typeClass = typeof val === 'string' ? 'tree-string' : 
                    typeof val === 'number' ? 'tree-number' : 
                    typeof val === 'boolean' ? 'tree-boolean' : 'tree-value'
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
        
        if (beforeColon && afterColon !== '' && !afterColon.startsWith('#') && afterColon !== '|' && afterColon !== '>' && !afterColon.startsWith(':')) {
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
    showToast('请输入YAML内容')
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
    showToast('格式化成功')
  } catch (e) {
    showToast('格式化失败: ' + e.message)
  }
}

function compressYaml() {
  if (!yamlInput.value.trim()) {
    showToast('请输入YAML内容')
    return
  }

  try {
    const data = yaml.load(yamlInput.value)
    yamlInput.value = yaml.dump(data, {
      indent: 2,
      flowLevel: 0,
      condenseFlow: true,
      noRefs: true
    }).replace(/\n+/g, '\n')
    onInputChange()
    showToast('压缩成功')
  } catch (e) {
    showToast('压缩失败: ' + e.message)
  }
}

function validateYaml() {
  if (!yamlInput.value.trim()) {
    statusText.value = 'YAML内容不能为空'
    statusClass.value = 'status-error'
    showToast('请输入YAML内容')
    return
  }

  try {
    yaml.load(yamlInput.value)
    statusText.value = 'YAML格式正确'
    statusClass.value = 'status-valid'
    errorDetail.value = ''
    showToast('校验通过，YAML格式正确')
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
    showToast('校验失败: ' + errorMsg)
  }
}

function yamlToJson() {
  if (!yamlInput.value.trim()) {
    showToast('请输入YAML内容')
    return
  }

  try {
    const data = yaml.load(yamlInput.value)
    outputType.value = 'json'
    outputContent.value = JSON.stringify(data, null, 2)
    showToast('转换成功')
  } catch (e) {
    showToast('转换失败: ' + e.message)
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
  showToast('已清空')
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
  showToast('已加载示例')
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
      showToast('已加载文件: ' + file.name)
    }
    reader.onerror = () => {
      showToast('读取文件失败')
    }
    reader.readAsText(file)
  }
  input.click()
}

function copyOutput() {
  const content = outputType.value === 'tree' ? JSON.stringify(parsedData.value, null, 2) : outputContent.value
  if (!content) {
    showToast('没有可复制的内容')
    return
  }
  navigator.clipboard.writeText(content).then(() => {
    showToast('已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      showToast('已复制到剪贴板')
    } catch (e) {
      showToast('复制失败，请手动复制')
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

onMounted(() => {
  loadExample()
})
</script>

<style scoped>
.yaml-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  overflow: hidden;
}

.yaml-container header {
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.95) 0%,
    rgba(118, 75, 162, 0.95) 100%
  );
  color: white;
  padding: 30px;
  text-align: center;
  flex-shrink: 0;
}

.yaml-container header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 28px;
  margin-bottom: 10px;
  font-weight: 600;
}

.yaml-container header h1 .header-icon {
  width: 32px;
  height: 32px;
}

.yaml-container header .subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.yaml-content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.editor-layout {
  display: flex;
  gap: 16px;
  height: 600px;
  margin-bottom: 16px;
}

.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(248, 249, 250, 0.6);
  border-bottom: 1px solid var(--border-color);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  border-color: var(--primary-color);
  background: var(--glass-bg-hover);
}

.editor-wrapper {
  flex: 1;
  overflow: hidden;
}

.editor-with-lines {
  display: flex;
  height: 100%;
}

.line-numbers {
  width: 40px;
  background: rgba(248, 249, 250, 0.6);
  border-right: 1px solid var(--border-color);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-tertiary);
  overflow-y: hidden;
  user-select: none;
  padding: 12px 8px;
  text-align: right;
}

.line-number {
  min-height: 20.8px;
}

.code-editor {
  flex: 1;
  height: 100%;
  padding: 12px;
  border: none;
  background: transparent;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  resize: none;
  outline: none;
}

.code-editor::placeholder {
  color: var(--text-tertiary);
}

.output-editor {
  background: rgba(248, 249, 250, 0.3);
}

.output-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.output-tab {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.output-tab:hover {
  border-color: var(--primary-color);
}

.output-tab.active {
  background: var(--primary-gradient);
  color: white;
  border-color: transparent;
}

.tree-view {
  height: 100%;
  padding: 12px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
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
  color: var(--primary-color);
  font-weight: 600;
  margin-right: 8px;
}

.tree-string {
  color: #16a34a;
}

.tree-number {
  color: #2563eb;
}

.tree-boolean {
  color: #d97706;
}

.tree-null {
  color: var(--text-tertiary);
}

.input-stats,
.output-stats {
  padding: 6px 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
  background: rgba(248, 249, 250, 0.6);
}

.action-bar {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.action-bar .btn {
  min-width: 100px;
}

.status-bar {
  padding: 12px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.status-waiting {
  color: var(--text-tertiary);
}

.status-valid {
  color: #16a34a;
}

.status-error {
  color: #dc2626;
}

.status-detail {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: #dc2626;
  font-family: 'Consolas', 'Monaco', monospace;
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

.help-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
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
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>