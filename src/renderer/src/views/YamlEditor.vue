<template>
  <PageLayout tool-path="/yaml-editor">
    <template #actions>
      <button class="btn btn-primary btn-sm" @click="formatYaml">{{ t('格式化') }}</button>
      <button class="btn btn-secondary btn-sm" @click="compressYaml">{{ t('压缩') }}</button>
      <button class="btn btn-secondary btn-sm" @click="validateYaml">{{ t('校验') }}</button>
      <button class="btn btn-secondary btn-sm" @click="yamlToJson">{{ t('转 JSON') }}</button>
    </template>

    <div class="page-body">
      <div ref="editorLayoutRef" class="editor-layout" :style="{ '--split-ratio': `${splitRatio}%` }">
        <div class="panel editor-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('YAML 输入') }}</span>
            <div class="panel-actions">
              <button class="btn btn-secondary btn-sm" @click="clearInput">{{ t('清空') }}</button>
              <button class="btn btn-secondary btn-sm" @click="loadExample">{{ t('示例') }}</button>
              <button class="btn btn-secondary btn-sm" @click="loadFromFile">{{ t('文件') }}</button>
            </div>
          </div>
          <div class="editor-wrapper">
            <div class="editor-with-lines">
              <div ref="lineNumbersRef" class="line-numbers">
                <div v-for="n in inputLines" :key="n" class="line-number">
                  {{ n }}
                </div>
              </div>
              <div class="code-stage">
                <pre
                  ref="highlightRef"
                  class="code-highlight"
                  aria-hidden="true"
                ><code v-html="highlightedInput"></code></pre>
                <textarea
                  ref="textareaRef"
                  v-model="yamlInput"
                  class="code-editor"
                  :class="{ 'is-composing': composing }"
                  :placeholder="t('请输入 YAML 代码...')"
                  spellcheck="false"
                  wrap="off"
                  @input="onInputChange"
                  @compositionstart="composing = true"
                  @compositionend="composing = false"
                  @scroll="syncScroll"
                />
              </div>
            </div>
          </div>
          <div class="input-stats">
            <span>{{ t('行数') }}: {{ inputLines }}</span>
            <span>{{ t('字符') }}: {{ inputChars }}</span>
            <span v-if="draftSavedTime">{{ t('已自动保存 {time}', { time: draftSavedTime }) }}</span>
          </div>
        </div>

        <SplitHandle
          orientation="vertical"
          :resizing="splitResizing"
          :label="t('拖动调整输入与输出宽度')"
          @pointerdown="startSplitResize"
          @keydown="onSplitKeydown"
        />

        <div class="panel editor-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('结果输出') }}</span>
            <div class="segmented">
              <button class="segmented-item" :class="{ active: outputType === 'yaml' }" @click="outputType = 'yaml'">
                YAML
              </button>
              <button class="segmented-item" :class="{ active: outputType === 'json' }" @click="outputType = 'json'">
                JSON
              </button>
              <button class="segmented-item" :class="{ active: outputType === 'tree' }" @click="outputType = 'tree'">
                {{ t('树形') }}
              </button>
            </div>
            <div class="panel-actions">
              <button class="btn btn-secondary btn-sm" @click="copyOutput">{{ t('复制') }}</button>
            </div>
          </div>
          <div class="editor-wrapper">
            <div v-if="outputType === 'yaml' || outputType === 'json'" class="editor-with-lines">
              <div ref="outputLineNumbersRef" class="line-numbers">
                <div v-for="n in outputLines" :key="n" class="line-number">
                  {{ n }}
                </div>
              </div>
              <div class="code-stage">
                <pre
                  ref="outputHighlightRef"
                  class="code-highlight"
                  aria-hidden="true"
                ><code v-html="highlightedOutput"></code></pre>
                <textarea
                  ref="outputTextareaRef"
                  v-model="outputContent"
                  class="code-editor output-editor"
                  readonly
                  spellcheck="false"
                  wrap="off"
                  @scroll="syncOutputScroll"
                />
              </div>
            </div>
            <div v-else-if="outputType === 'tree'" class="tree-view">
              <EmptyState v-if="!parsedData" size="xs" :title="t('请输入有效的 YAML 内容')" />
              <div v-else class="tree-content" v-html="treeHtml" />
            </div>
          </div>
          <div class="output-stats">
            <span v-if="outputType === 'yaml' || outputType === 'json'">{{ t('行数') }}: {{ outputLines }}</span>
            <span v-if="outputType === 'yaml' || outputType === 'json'">{{ t('字符') }}: {{ outputChars }}</span>
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
        <button type="button" class="panel-header help-toggle" :aria-expanded="helpOpen" @click="helpOpen = !helpOpen">
          <span class="panel-title">{{ t('YAML 语法说明') }}</span>
          <AppIcon name="chevron-down" class="help-caret" :class="{ open: helpOpen }" />
        </button>
        <div v-show="helpOpen" class="panel-body help-content">
          <p>
            <strong>{{ t('基本语法：') }}</strong>
          </p>
          <ul>
            <li>{{ t('使用缩进表示层级关系，缩进空格数不限（通常 2 或 4 个空格）') }}</li>
            <li>{{ t('键值对使用 {example} 格式，冒号后必须有空格', { example: 'key: value' }) }}</li>
            <li>{{ t('列表项使用 {dash} 开头，后面有空格', { dash: '-' }) }}</li>
            <li>{{ t('注释使用 {hash} 开头', { hash: '#' }) }}</li>
          </ul>
          <p>
            <strong>{{ t('数据类型：') }}</strong>
          </p>
          <ul>
            <li>{{ t('字符串：可以直接写，或用引号包裹') }}</li>
            <li>{{ t('数字：直接写数字') }}</li>
            <li>{{ t('布尔值：{example}', { example: 'true / false' }) }}</li>
            <li>{{ t('空值：{example} 或留空', { example: 'null' }) }}</li>
            <li>{{ t('日期：ISO 格式，如 {example}', { example: '2024-01-01' }) }}</li>
          </ul>
          <p>
            <strong>{{ t('多行字符串：') }}</strong>
          </p>
          <ul>
            <li>{{ t('{symbol} 保留换行符', { symbol: '|' }) }}</li>
            <li>{{ t('{symbol} 将换行符替换为空格', { symbol: '>' }) }}</li>
          </ul>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAutoDraft, usePaneResize, useSendReceiver, useToast } from '@/composables'
import * as yaml from 'js-yaml'
import hljs from 'highlight.js/lib/common'
import SplitHandle from '@/components/SplitHandle.vue'
import PageLayout from '@/layouts/PageLayout.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import { t } from '@/i18n'

const { showSuccess, showError, showWarning, showInfo } = useToast()

const textareaRef = ref(null)
const lineNumbersRef = ref(null)
const highlightRef = ref(null)
const outputTextareaRef = ref(null)
const outputLineNumbersRef = ref(null)
const outputHighlightRef = ref(null)
const editorLayoutRef = ref(null)
const {
  size: splitRatio,
  resizing: splitResizing,
  startResize: startSplitResize,
  onKeydown: onSplitKeydown
} = usePaneResize({
  key: 'yamlEditorSplitRatio',
  initial: 50,
  min: 20,
  max: 80,
  unit: 'percent',
  direction: 'horizontal',
  container: () => editorLayoutRef.value
})

const yamlInput = ref('')
const helpOpen = ref(false)
const composing = ref(false)
const { savedTime: draftSavedTime, ready: draftReady } = useAutoDraft('yaml', yamlInput, {
  onRestore: () => onInputChange()
})
const outputContent = ref('')
const outputType = ref('yaml')
const parsedData = ref(null)
const statusText = ref(t('等待输入'))
const statusClass = ref('status-error')
const statusIcon = ref('')
const errorDetail = ref('')
const treeHtml = ref('')

const inputLines = computed(() => {
  if (!yamlInput.value) return 1
  return yamlInput.value.split('\n').length
})

const inputChars = computed(() => yamlInput.value.length)

function highlight(code, language) {
  if (!code) return ''
  try {
    return `${hljs.highlight(code, { language }).value}\n`
  } catch {
    return ''
  }
}

const highlightedInput = computed(() => highlight(yamlInput.value, 'yaml'))

function syncScroll() {
  const textarea = textareaRef.value
  if (!textarea) return
  if (lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textarea.scrollTop
  }
  if (highlightRef.value) {
    highlightRef.value.scrollTop = textarea.scrollTop
    highlightRef.value.scrollLeft = textarea.scrollLeft
  }
}

function syncOutputScroll() {
  const textarea = outputTextareaRef.value
  if (!textarea) return
  if (outputLineNumbersRef.value) {
    outputLineNumbersRef.value.scrollTop = textarea.scrollTop
  }
  if (outputHighlightRef.value) {
    outputHighlightRef.value.scrollTop = textarea.scrollTop
    outputHighlightRef.value.scrollLeft = textarea.scrollLeft
  }
}

const outputLines = computed(() => {
  if (!outputContent.value) return 1
  return outputContent.value.split('\n').length
})

const outputChars = computed(() => outputContent.value.length)

const highlightedOutput = computed(() => highlight(outputContent.value, outputType.value === 'json' ? 'json' : 'yaml'))

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

// js-yaml 的错误信息为英文，这里映射为中文提示；未覆盖的消息保留原文兜底
const YAML_REASON_TRANSLATIONS = {
  'duplication of %YAML directive': () => t('重复的 %YAML 指令'),
  'YAML directive accepts exactly one argument': () => t('YAML 指令只接受一个参数'),
  'ill-formed argument of the YAML directive': () => t('YAML 指令的参数格式不正确'),
  'unacceptable YAML version of the document': () => t('不支持的 YAML 版本'),
  'TAG directive accepts exactly two arguments': () => t('TAG 指令只接受两个参数'),
  'ill-formed tag handle (first argument) of the TAG directive': () => t('TAG 指令的标签句柄（第一个参数）格式不正确'),
  'ill-formed tag prefix (second argument) of the TAG directive': () => t('TAG 指令的标签前缀（第二个参数）格式不正确'),
  'expected valid JSON character': () => t('期望合法的 JSON 字符'),
  'the stream contains non-printable characters': () => t('内容包含不可打印字符'),
  'cannot merge mappings; the provided source object is unacceptable': () => t('无法合并映射：源对象不可接受'),
  'nested arrays are not supported inside keys': () => t('键中不支持嵌套数组'),
  'duplicated mapping key': () => t('映射键重复'),
  'a line break is expected': () => t('此处应换行'),
  'unexpected end of the document within a single quoted scalar': () => t('单引号字符串意外结束'),
  'unexpected end of the stream within a single quoted scalar': () => t('单引号字符串未闭合'),
  'expected hexadecimal character': () => t('期望十六进制字符'),
  'unknown escape sequence': () => t('未知的转义序列'),
  'unexpected end of the document within a double quoted scalar': () => t('双引号字符串意外结束'),
  'unexpected end of the stream within a double quoted scalar': () => t('双引号字符串未闭合'),
  'missed comma between flow collection entries': () => t('流式集合条目之间缺少逗号'),
  "expected the node content, but found ','": () => t('期望节点内容，却遇到了 “,”'),
  'unexpected end of the stream within a flow collection': () => t('流式集合未闭合'),
  'repeat of a chomping mode identifier': () => t('重复的裁剪模式标识符'),
  'bad explicit indentation width of a block scalar; it cannot be less than one': () =>
    t('块标量的显式缩进宽度无效，不能小于 1'),
  'repeat of an indentation width identifier': () => t('重复的缩进宽度标识符'),
  'tab characters must not be used in indentation': () => t('缩进中不能使用制表符'),
  'bad indentation of a sequence entry': () => t('序列条目的缩进不正确'),
  'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line': () =>
    t('映射键值对不完整：缺少键或值'),
  'a whitespace character is expected after the key-value separator within a block mapping': () =>
    t('键值分隔符后需要有空格'),
  'can not read an implicit mapping pair; a colon is missed': () => t('无法解析映射键值对：缺少冒号'),
  'can not read a block mapping entry; a multiline key may not be an implicit key': () =>
    t('无法解析映射条目：多行键不能作为隐式键'),
  'bad indentation of a mapping entry': () => t('映射条目的缩进不正确'),
  'duplication of a tag property': () => t('重复的标签属性'),
  'unexpected end of the stream within a verbatim tag': () => t('标签未闭合（!<...>）'),
  'named tag handle cannot contain such characters': () => t('命名标签句柄包含非法字符'),
  'tag suffix cannot contain exclamation marks': () => t('标签后缀不能包含感叹号'),
  'tag suffix cannot contain flow indicator characters': () => t('标签后缀不能包含流式指示字符'),
  'duplication of an anchor property': () => t('重复的锚点属性'),
  'name of an anchor node must contain at least one character': () => t('锚点名称不能为空'),
  'name of an alias node must contain at least one character': () => t('别名名称不能为空'),
  'alias node should not have any properties': () => t('别名节点不能带有属性'),
  'directive name must not be less than one character in length': () => t('指令名不能为空'),
  'directives end mark is expected': () => t('缺少指令结束标记（---）'),
  'end of the stream or a document separator is expected': () => t('期望文档结束或文档分隔符（---）'),
  'null byte is not allowed in input': () => t('内容中不允许出现空字节'),
  'expected a single document in the stream, but found more': () => t('只允许一个文档，但发现了多个文档'),
  'code point within a string may not be greater than 0xFFFFFFFF': () => t('字符串中的码点不能大于 0xFFFFFFFF')
}

const YAML_REASON_PATTERNS = [
  [
    /^there is a previously declared suffix for "(.+)" tag handle$/,
    (match) => t('标签句柄 “{handle}” 已声明过后缀', { handle: match[1] })
  ],
  [/^tag prefix is malformed: (.+)$/, (match) => t('标签前缀格式不正确：{prefix}', { prefix: match[1] })],
  [/^tag name cannot contain such characters: (.+)$/, (match) => t('标签名包含非法字符：{name}', { name: match[1] })],
  [/^tag name is malformed: (.+)$/, (match) => t('标签名格式不正确：{name}', { name: match[1] })],
  [/^undeclared tag handle "(.+)"$/, (match) => t('未声明的标签句柄 “{handle}”', { handle: match[1] })],
  [/^unidentified alias "(.+)"$/, (match) => t('未定义的别名 “{alias}”', { alias: match[1] })],
  [/^unknown tag !<(.+)>$/, (match) => t('未知标签 !<{tag}>', { tag: match[1] })],
  [
    /^unacceptable node kind for !<\?> tag; it should be "(\w+)", not "(\w+)"$/,
    (match) =>
      t('标签 !<?> 的节点类型不正确（应为 {expected}，实际为 {actual}）', { expected: match[1], actual: match[2] })
  ],
  [
    /^unacceptable node kind for !<(.+)> tag; it should be "(\w+)", not "(\w+)"$/,
    (match) =>
      t('标签 !<{tag}> 的节点类型不正确（应为 {expected}，实际为 {actual}）', {
        tag: match[1],
        expected: match[2],
        actual: match[3]
      })
  ],
  [
    /^cannot resolve a node with !<(.+)> explicit tag$/,
    (match) => t('无法解析带 !<{tag}> 显式标签的节点', { tag: match[1] })
  ],
  [/^unacceptable kind of an object to dump (.+)$/, (match) => t('无法序列化该对象类型：{kind}', { kind: match[1] })]
]

function localizeYamlReason(reason) {
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (!text) return t('未知错误')
  const translate = YAML_REASON_TRANSLATIONS[text]
  if (translate) return translate()
  for (const [pattern, build] of YAML_REASON_PATTERNS) {
    const match = pattern.exec(text)
    if (match) return build(match)
  }
  return text
}

function describeYamlError(error) {
  const reason = localizeYamlReason(error?.reason || error?.message)
  if (error?.mark) {
    return t('第 {line} 行，第 {column} 列: {reason}', {
      line: error.mark.line + 1,
      column: error.mark.column + 1,
      reason
    })
  }
  return reason
}

function onInputChange() {
  errorDetail.value = ''
  if (!yamlInput.value.trim()) {
    statusText.value = t('YAML 内容不能为空')
    statusClass.value = 'status-error'
    parsedData.value = null
    outputContent.value = ''
    treeHtml.value = ''
    return
  }

  try {
    parsedData.value = yaml.load(yamlInput.value, {
      onWarning: (warning) => {
        errorDetail.value = describeYamlError(warning)
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
          throw new yaml.YAMLException(t('第 {line} 行：冒号后缺少空格', { line: i + 1 }))
        }
      }
    }

    statusText.value = t('YAML 格式正确')
    statusClass.value = 'status-valid'
    updateOutput()
  } catch (e) {
    parsedData.value = null
    statusText.value = t('YAML 格式错误')
    statusClass.value = 'status-error'
    errorDetail.value = describeYamlError(e)
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
      outputContent.value = t('转换失败: {message}', { message: e.message })
    }
  } else if (outputType.value === 'json') {
    try {
      outputContent.value = JSON.stringify(parsedData.value, null, 2)
    } catch (e) {
      outputContent.value = t('转换失败: {message}', { message: e.message })
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
    showWarning(t('请输入 YAML 内容'))
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
    showSuccess(t('格式化成功'))
  } catch (e) {
    showError(t('格式化失败: {message}', { message: describeYamlError(e) }))
  }
}

function compressYaml() {
  if (!yamlInput.value.trim()) {
    showWarning(t('请输入 YAML 内容'))
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
    showSuccess(t('压缩成功'))
  } catch (e) {
    showError(t('压缩失败: {message}', { message: describeYamlError(e) }))
  }
}

function validateYaml() {
  if (!yamlInput.value.trim()) {
    statusText.value = t('YAML 内容不能为空')
    statusClass.value = 'status-error'
    showWarning(t('请输入 YAML 内容'))
    return
  }

  try {
    yaml.load(yamlInput.value)
    statusText.value = t('YAML 格式正确')
    statusClass.value = 'status-valid'
    errorDetail.value = ''
    showSuccess(t('校验通过，YAML 格式正确'))
  } catch (e) {
    statusText.value = t('YAML 格式错误')
    statusClass.value = 'status-error'
    const errorMsg = describeYamlError(e)
    errorDetail.value = errorMsg
    showError(t('校验失败: {message}', { message: errorMsg }))
  }
}

function yamlToJson() {
  if (!yamlInput.value.trim()) {
    showWarning(t('请输入 YAML 内容'))
    return
  }

  try {
    const data = yaml.load(yamlInput.value)
    outputType.value = 'json'
    outputContent.value = JSON.stringify(data, null, 2)
    showSuccess(t('转换成功'))
  } catch (e) {
    showError(t('转换失败: {message}', { message: describeYamlError(e) }))
  }
}

function clearInput() {
  yamlInput.value = ''
  outputContent.value = ''
  parsedData.value = null
  statusText.value = t('YAML 内容不能为空')
  statusClass.value = 'status-error'
  errorDetail.value = ''
  treeHtml.value = ''
  showInfo(t('已清空'))
}

function loadExample() {
  yamlInput.value = `# ${t('YAML 示例')}
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
  showInfo(t('已加载示例'))
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
      showInfo(t('已加载文件: {name}', { name: file.name }))
    }
    reader.onerror = () => {
      showError(t('读取文件失败'))
    }
    reader.readAsText(file)
  }
  input.click()
}

function copyOutput() {
  const content = outputType.value === 'tree' ? JSON.stringify(parsedData.value, null, 2) : outputContent.value
  if (!content) {
    showWarning(t('没有可复制的内容'))
    return
  }
  navigator.clipboard
    .writeText(content)
    .then(() => {
      showSuccess(t('已复制到剪贴板'))
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
        showSuccess(t('已复制到剪贴板'))
      } catch {
        showError(t('复制失败，请手动复制'))
      }
      document.body.removeChild(textarea)
    })
}

onMounted(() => {
  loadExample()
})

useSendReceiver('/yaml-editor', draftReady, (resource) => {
  yamlInput.value = resource.text
  onInputChange()
})
</script>

<style scoped>
.page-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.editor-layout {
  display: flex;
  flex: 1;
  min-height: 360px;
}

.editor-panel {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.editor-layout > .editor-panel:first-child {
  flex: 0 0 auto;
  width: var(--split-ratio, 50%);
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
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
  line-height: 20.8px;
  text-align: right;
  user-select: none;
}

.line-number {
  min-height: 20.8px;
}

.code-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  background: var(--surface);
}

.code-highlight {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 12px;
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
  line-height: 20.8px;
  white-space: pre;
  pointer-events: none;
}

.code-highlight code {
  font: inherit;
  white-space: inherit;
}

.code-highlight :deep(.hljs-attr) {
  color: var(--accent-color);
}

.code-highlight :deep(.hljs-string),
.code-highlight :deep(.hljs-template-variable) {
  color: var(--success-dark);
}

.code-highlight :deep(.hljs-number) {
  color: var(--info-dark);
}

.code-highlight :deep(.hljs-literal),
.code-highlight :deep(.hljs-type) {
  color: var(--warning-dark);
}

.code-highlight :deep(.hljs-bullet),
.code-highlight :deep(.hljs-symbol) {
  color: var(--accent-color);
}

.code-highlight :deep(.hljs-comment),
.code-highlight :deep(.hljs-quote) {
  color: var(--text-tertiary);
  font-style: italic;
}

.code-highlight :deep(.hljs-meta) {
  color: var(--text-tertiary);
}

.code-editor {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: transparent;
  caret-color: var(--text-primary);
  white-space: pre;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
  line-height: 20.8px;
}

.code-editor::selection {
  background: rgba(var(--accent-rgb), 0.24);
  color: transparent;
}

.code-editor.is-composing {
  color: var(--text-primary);
  background: var(--surface);
}

.code-editor::placeholder {
  color: var(--text-tertiary);
}

.output-editor {
  background: transparent;
}

.tree-view {
  height: 100%;
  padding: 12px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
  line-height: 1.6;
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
  font-family: var(--font-mono);
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
  border-radius: var(--radius-xs);
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: var(--font-mono);
}
</style>
