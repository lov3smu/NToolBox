<template>
  <PageLayout tool-path="/http-client">
    <div class="page-body devt-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('发送请求') }}</span>
          <span class="panel-hint">{{ t('复用应用网络与代理配置，响应最大 2 MB') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-toolbar">
            <button
              v-for="item in HTTP_METHODS"
              :key="item"
              type="button"
              class="devt-chip"
              :class="{ 'is-active': method === item }"
              :aria-pressed="method === item"
              :disabled="sending"
              @click="method = item"
            >
              {{ item }}
            </button>
          </div>
          <div class="devt-toolbar">
            <AppInput
              v-model="url"
              class="devt-url-input"
              type="text"
              :placeholder="t('输入请求地址，例如 https://api.example.com/users')"
              spellcheck="false"
              @keyup.enter="send"
            />
            <label class="devt-timeout">
              {{ t('超时') }}
              <AppInput v-model.number="timeoutSeconds" type="number" min="1" max="120" />
              <span>s</span>
            </label>
            <button class="btn btn-primary" :disabled="sending" @click="send">
              {{ sending ? t('请求中…') : t('发送请求') }}
            </button>
          </div>
          <div class="devt-toolbar">
            <span class="devt-op-label">{{ t('环境') }}</span>
            <AppSelect
              class="http-env-select"
              :model-value="clientState.activeEnvironmentId"
              :options="environmentOptions"
              @update:model-value="setActiveEnvironment"
            />
            <button type="button" class="btn btn-secondary" @click="envPanelOpen = !envPanelOpen">
              {{ envPanelOpen ? t('收起环境变量') : t('管理环境变量') }}
            </button>
            <button type="button" class="btn btn-secondary" @click="importProjectEnvironment">
              {{ t('从项目导入') }}
            </button>
            <span class="devt-spacer" />
            <span class="devt-hint">{{ t('用 {p0} 引用环境变量', { p0: VARIABLE_SAMPLE }) }}</span>
          </div>
          <div v-if="history.length" class="devt-toolbar">
            <span class="devt-op-label">{{ t('最近请求') }}</span>
            <button
              v-for="(entry, index) in history"
              :key="`${entry.method}-${entry.url}-${index}`"
              type="button"
              class="devt-chip devt-history-item"
              :title="`${entry.method} ${entry.url}`"
              @click="applyHistory(entry)"
            >
              {{ entry.method }} {{ entry.url }}
            </button>
            <button class="btn-icon btn-sm" :title="t('清空历史')" @click="clearHistory">
              <AppIcon name="trash" size="14" />
            </button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('请求集合') }}</span>
          <span class="panel-hint">{{ t('保存常用请求，点击即可回填地址、请求头、请求体与超时') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-toolbar">
            <AppInput
              v-model="requestName"
              class="http-request-name"
              :placeholder="t('请求名称（默认取地址）')"
              spellcheck="false"
            />
            <AppSelect
              class="http-collection-select"
              :model-value="targetCollectionId"
              :options="collectionOptions"
              @update:model-value="targetCollectionId = $event"
            />
            <button type="button" class="btn btn-primary" :disabled="!url.trim()" @click="saveRequest">
              {{ t('保存请求') }}
            </button>
            <button type="button" class="btn btn-secondary" @click="creatingCollection = !creatingCollection">
              {{ t('新建集合') }}
            </button>
          </div>
          <div v-if="creatingCollection" class="devt-toolbar">
            <AppInput
              v-model="newCollectionName"
              class="http-request-name"
              :placeholder="t('集合名称')"
              spellcheck="false"
              @keyup.enter="createCollection"
            />
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!newCollectionName.trim()"
              @click="createCollection"
            >
              {{ t('创建') }}
            </button>
          </div>
          <EmptyState
            v-if="!clientState.collections.length"
            size="sm"
            :description="t('还没有保存的请求；填写请求后点击「保存请求」会创建默认集合')"
          />
          <div v-else class="http-collections">
            <div v-for="collection in clientState.collections" :key="collection.id" class="http-collection">
              <div class="http-collection-head">
                <AppIcon name="folder-open" size="14" />
                <span class="http-collection-name">{{ collection.name }}</span>
                <span class="devt-hint">{{ t('{p0} 个请求', { p0: collection.requests.length }) }}</span>
              </div>
              <div v-if="!collection.requests.length" class="devt-hint http-collection-empty">
                {{ t('集合为空') }}
              </div>
              <div
                v-for="saved in collection.requests"
                :key="saved.id"
                class="http-saved-request"
                role="button"
                tabindex="0"
                :title="saved.url"
                @click="loadRequest(collection, saved)"
                @keyup.enter="loadRequest(collection, saved)"
              >
                <span class="http-method-tag">{{ saved.method }}</span>
                <span class="http-saved-name">{{ saved.name }}</span>
                <span class="http-saved-url">{{ saved.url }}</span>
                <button
                  type="button"
                  class="btn-icon btn-sm"
                  :title="t('删除请求')"
                  @click.stop="removeRequest(collection, saved)"
                >
                  <AppIcon name="trash" size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="envPanelOpen" class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('环境变量') }}</span>
          <span class="panel-hint">{{ envPanelHint }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-toolbar">
            <AppInput
              v-model="environmentName"
              class="http-env-name"
              :placeholder="t('环境名称')"
              spellcheck="false"
              :disabled="!activeEnvironment"
            />
            <button type="button" class="btn btn-secondary" @click="addEnvironment">{{ t('新建环境') }}</button>
            <button type="button" class="btn btn-secondary" :disabled="!activeEnvironment" @click="removeEnvironment">
              {{ t('删除当前环境') }}
            </button>
            <span class="devt-spacer" />
            <span v-if="environmentLineError" class="devt-error">{{ environmentLineError }}</span>
          </div>
          <AppTextarea
            v-model="variablesText"
            class="devt-textarea http-vars-textarea"
            :placeholder="activeEnvironment ? t('baseUrl=https://api.example.com') : t('先新建或选择一个环境')"
            :disabled="!activeEnvironment"
            spellcheck="false"
          />
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('请求选项') }}</span>
          <span class="panel-hint">{{ t('请求头每行一条，格式为「名称: 值」') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-grid">
            <div class="devt-field">
              <span class="field-label">{{ t('请求头') }}</span>
              <AppTextarea v-model="headersText" class="devt-textarea" spellcheck="false" />
            </div>
            <div class="devt-field">
              <span class="field-label">{{ t('请求体') }}</span>
              <AppTextarea
                v-model="body"
                class="devt-textarea"
                :disabled="bodyDisabled"
                :placeholder="bodyDisabled ? t('GET 与 HEAD 请求不包含请求体') : t('可选，支持 JSON、表单或纯文本')"
                spellcheck="false"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('响应') }}</span>
          <span class="panel-hint">{{ responseHint }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div v-if="responseError" class="devt-error">{{ responseError }}</div>
          <EmptyState
            v-else-if="!response"
            size="sm"
            :description="sending ? t('正在等待响应…') : t('填写地址并发送请求后，这里会显示响应内容')"
          />
          <template v-else>
            <div class="devt-status">
              <span class="devt-status-badge" :class="statusClass">HTTP {{ response.status }}</span>
              <span class="devt-stats">
                <span
                  >{{ t('用时') }} <strong>{{ response.elapsedMs }} ms</strong></span
                >
                <span
                  >{{ t('大小') }} <strong>{{ response.size }} B</strong></span
                >
                <span>{{ response.url }}</span>
              </span>
            </div>
            <div v-if="response.truncated" class="devt-note is-warning">{{ t('响应体超过 2 MB，已截断') }}</div>
            <div class="devt-toolbar">
              <div class="devt-tabs">
                <button
                  type="button"
                  class="devt-tab"
                  :class="{ 'is-active': activeTab === 'body' }"
                  @click="activeTab = 'body'"
                >
                  {{ t('响应体') }}
                </button>
                <button
                  type="button"
                  class="devt-tab"
                  :class="{ 'is-active': activeTab === 'headers' }"
                  @click="activeTab = 'headers'"
                >
                  {{ t('响应头') }}
                </button>
              </div>
              <span class="devt-spacer" />
              <template v-if="activeTab === 'body'">
                <label class="devt-check">
                  <input v-model="pretty" type="checkbox" />
                  {{ t('格式化 JSON') }}
                </label>
                <CopyButton :text="displayBody" :label="t('复制响应体')" variant="secondary" size="sm" />
              </template>
            </div>
            <pre v-if="activeTab === 'body'" class="devt-code-block">{{ displayBody || t('响应体为空') }}</pre>
            <div v-else class="devt-headers">
              <div v-for="[name, value] in headerEntries" :key="name" class="devt-header-row">
                <span class="devt-header-name">{{ name }}</span>
                <span class="devt-header-value">{{ value }}</span>
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { computed, onMounted, ref, watch } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { takeSendResource, useToast } from '@/composables'
import CopyButton from '@/components/CopyButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { t } from '@/i18n'
import { HTTP_METHODS, parseHeaderLines } from '@shared/httpClient'
import {
  HTTP_COLLECTION_LIMITS,
  createHttpItemId,
  findHttpEnvironment,
  formatHttpEnvironmentLines,
  normalizeHttpClientState,
  normalizeHttpRequest,
  parseHttpEnvironmentLines,
  substituteHttpVariables
} from '@shared/httpCollections'
import { httpRequest, profilesActiveEnvironment } from '@/api'
import '@/styles/dev-tools.css'
import AppInput from '@/components/AppInput.vue'
import AppSelect from '@/components/AppSelect.vue'
import AppTextarea from '@/components/AppTextarea.vue'

const HISTORY_KEY = 'ntb_http_history'
const HISTORY_LIMIT = 8
const STATE_KEY = 'ntb_http_client_state'
const VARIABLE_SAMPLE = '{{变量名}}'

const { showError, showInfo, showSuccess, showWarning } = useToast()

const method = ref('GET')
const url = ref('')
const timeoutSeconds = ref(30)
const headersText = ref('Accept: */*\nContent-Type: application/json')
const body = ref('')
const sending = ref(false)
const response = ref(null)
const responseError = ref('')
const activeTab = ref('body')
const pretty = ref(true)
const history = ref(loadHistory())

const clientState = ref(loadClientState())
const envPanelOpen = ref(false)
const environmentName = ref('')
const variablesText = ref('')
const environmentLineError = ref('')
const requestName = ref('')
const targetCollectionId = ref('')
const creatingCollection = ref(false)
const newCollectionName = ref('')

const bodyDisabled = computed(() => method.value === 'GET' || method.value === 'HEAD')

const activeEnvironment = computed(() => findHttpEnvironment(clientState.value, clientState.value.activeEnvironmentId))

const environmentOptions = computed(() => [
  { value: '', label: t('无环境') },
  ...clientState.value.environments.map((environment) => ({ value: environment.id, label: environment.name }))
])

const envPanelHint = computed(() => t('每行一条 KEY=VALUE；{{secret:别名}} 由主进程在发送前替换'))

const collectionOptions = computed(() => [
  { value: '', label: t('默认集合') },
  ...clientState.value.collections.map((collection) => ({ value: collection.id, label: collection.name }))
])

const responseHint = computed(() => {
  if (sending.value) return t('请求中…')
  if (responseError.value) return t('请求失败')
  if (!response.value) return t('等待请求')
  return `${response.value.contentType || t('未知类型')}`
})

const statusClass = computed(() => {
  const status = response.value?.status || 0
  if (status >= 200 && status < 300) return 'is-ok'
  if (status >= 400) return 'is-error'
  return 'is-warn'
})

const displayBody = computed(() => {
  if (!response.value) return ''
  const raw = response.value.body || ''
  if (!pretty.value) return raw
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})

const headerEntries = computed(() => Object.entries(response.value?.headers || {}))

function loadClientState() {
  try {
    return normalizeHttpClientState(JSON.parse(localStorage.getItem(STATE_KEY) || 'null'))
  } catch {
    return normalizeHttpClientState(null)
  }
}

function persistState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(clientState.value))
  } catch {
    // 存储不可用时仅保留内存状态
  }
}

function setActiveEnvironment(id) {
  clientState.value.activeEnvironmentId = typeof id === 'string' ? id : ''
  persistState()
}

watch(
  activeEnvironment,
  (environment) => {
    environmentName.value = environment?.name || ''
    variablesText.value = environment ? formatHttpEnvironmentLines(environment.variables) : ''
    environmentLineError.value = ''
  },
  { immediate: true }
)

watch([environmentName, variablesText], () => {
  const environment = activeEnvironment.value
  if (!environment) return
  const name = environmentName.value.trim()
  if (name) environment.name = name.slice(0, HTTP_COLLECTION_LIMITS.nameLength)
  const parsed = parseHttpEnvironmentLines(variablesText.value)
  if (parsed.ok) {
    environment.variables = parsed.variables
    environmentLineError.value = ''
  } else {
    environmentLineError.value = t('第 {p0} 行格式无效，应为 KEY=VALUE', { p0: parsed.errors.join('、') })
  }
  persistState()
})

function addEnvironment() {
  if (clientState.value.environments.length >= HTTP_COLLECTION_LIMITS.environments) {
    showWarning(t('最多保存 {p0} 个环境', { p0: HTTP_COLLECTION_LIMITS.environments }))
    return
  }
  const environment = {
    id: createHttpItemId('env'),
    name: t('环境 {p0}', { p0: clientState.value.environments.length + 1 }),
    variables: {}
  }
  clientState.value.environments.push(environment)
  clientState.value.activeEnvironmentId = environment.id
  envPanelOpen.value = true
  persistState()
}

function removeEnvironment() {
  const environment = activeEnvironment.value
  if (!environment) return
  clientState.value.environments = clientState.value.environments.filter((item) => item.id !== environment.id)
  clientState.value.activeEnvironmentId = ''
  persistState()
  showInfo(t('已删除环境「{p0}」', { p0: environment.name }))
}

async function importProjectEnvironment() {
  const result = await profilesActiveEnvironment()
  if (!result?.success) {
    showWarning(result?.error || t('导入项目环境失败'))
    return
  }
  const environment = result.environment
  if (!environment) {
    showWarning(t('当前项目还没有可用环境，请先在项目与环境页面配置'))
    return
  }
  const name = (result.project?.name ? `${result.project.name} · ${environment.name}` : environment.name).slice(
    0,
    HTTP_COLLECTION_LIMITS.nameLength
  )
  let local = clientState.value.environments.find((item) => item.name === name)
  if (local) {
    local.variables = { ...environment.variables }
  } else {
    if (clientState.value.environments.length >= HTTP_COLLECTION_LIMITS.environments) {
      showWarning(t('最多保存 {p0} 个环境', { p0: HTTP_COLLECTION_LIMITS.environments }))
      return
    }
    local = { id: createHttpItemId('env'), name, variables: { ...environment.variables } }
    clientState.value.environments.push(local)
  }
  clientState.value.activeEnvironmentId = local.id
  envPanelOpen.value = true
  persistState()
  showSuccess(t('已导入项目环境：{p0}', { p0: name }))
}

function createCollection() {
  const name = newCollectionName.value.trim()
  if (!name) return
  if (clientState.value.collections.some((collection) => collection.name === name)) {
    showWarning(t('已存在同名集合'))
    return
  }
  if (clientState.value.collections.length >= HTTP_COLLECTION_LIMITS.collections) {
    showWarning(t('最多保存 {p0} 个集合', { p0: HTTP_COLLECTION_LIMITS.collections }))
    return
  }
  const collection = {
    id: createHttpItemId('col'),
    name: name.slice(0, HTTP_COLLECTION_LIMITS.nameLength),
    requests: []
  }
  clientState.value.collections.push(collection)
  targetCollectionId.value = collection.id
  newCollectionName.value = ''
  creatingCollection.value = false
  persistState()
}

function ensureDefaultCollection() {
  const selected = clientState.value.collections.find((collection) => collection.id === targetCollectionId.value)
  if (selected) return selected
  const first = clientState.value.collections[0]
  if (first) {
    targetCollectionId.value = first.id
    return first
  }
  const collection = { id: createHttpItemId('col'), name: t('常用请求'), requests: [] }
  clientState.value.collections.push(collection)
  targetCollectionId.value = collection.id
  return collection
}

function saveRequest() {
  if (!url.value.trim()) {
    showWarning(t('请输入请求地址'))
    return
  }
  if (headersText.value.length > HTTP_COLLECTION_LIMITS.headersLength) {
    showWarning(t('请求头过长，最多保存 {p0} 字符', { p0: HTTP_COLLECTION_LIMITS.headersLength }))
    return
  }
  if (body.value.length > HTTP_COLLECTION_LIMITS.bodyLength) {
    showWarning(t('请求体过长，最多保存 {p0} 字符', { p0: HTTP_COLLECTION_LIMITS.bodyLength }))
    return
  }
  const collection = ensureDefaultCollection()
  const draft = normalizeHttpRequest({
    name: requestName.value.trim() || url.value.trim(),
    method: method.value,
    url: url.value.trim(),
    headersText: headersText.value,
    body: body.value,
    timeoutSeconds: timeoutSeconds.value
  })
  if (!draft) {
    showWarning(t('请输入请求地址'))
    return
  }
  const saved = { ...draft }
  delete saved.id
  const existing = collection.requests.find((request) => request.name === saved.name)
  if (existing) {
    Object.assign(existing, saved)
  } else {
    if (collection.requests.length >= HTTP_COLLECTION_LIMITS.requestsPerCollection) {
      showWarning(t('每个集合最多保存 {p0} 个请求', { p0: HTTP_COLLECTION_LIMITS.requestsPerCollection }))
      return
    }
    collection.requests.push({ id: createHttpItemId('req'), ...saved })
  }
  persistState()
  showSuccess(t('已保存到「{p0}」', { p0: collection.name }))
}

function loadRequest(collection, saved) {
  method.value = saved.method
  url.value = saved.url
  headersText.value = saved.headersText
  body.value = saved.body
  timeoutSeconds.value = saved.timeoutSeconds
  requestName.value = saved.name
  targetCollectionId.value = collection.id
}

function removeRequest(collection, saved) {
  collection.requests = collection.requests.filter((request) => request.id !== saved.id)
  persistState()
  showInfo(t('已删除请求「{p0}」', { p0: saved.name }))
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => entry && typeof entry.url === 'string' && typeof entry.method === 'string')
      .slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch {
    // 存储不可用时仅保留内存中的历史
  }
}

function remember(requestMethod, requestUrl) {
  history.value = [
    { method: requestMethod, url: requestUrl },
    ...history.value.filter((entry) => entry.method !== requestMethod || entry.url !== requestUrl)
  ].slice(0, HISTORY_LIMIT)
  persistHistory()
}

function applyHistory(entry) {
  method.value = entry.method
  url.value = entry.url
}

function clearHistory() {
  history.value = []
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // 忽略存储异常
  }
}

async function send() {
  if (sending.value) return
  if (!url.value.trim()) {
    showWarning(t('请输入请求地址'))
    return
  }
  const variables = activeEnvironment.value?.variables || {}
  const urlResult = substituteHttpVariables(url.value.trim(), variables)
  const headersResult = substituteHttpVariables(headersText.value, variables)
  const bodyResult = substituteHttpVariables(body.value, variables)
  const missing = [...new Set([...urlResult.missing, ...headersResult.missing, ...bodyResult.missing])]
  if (missing.length) {
    showError(t('缺少环境变量：{p0}', { p0: missing.join('、') }))
    return
  }

  const parsed = parseHeaderLines(headersResult.value)
  if (!parsed.ok) {
    showError(parsed.error === 'headers-too-many' ? t('请求头数量过多') : t('请求头格式无效，应为「名称: 值」'))
    return
  }

  sending.value = true
  responseError.value = ''
  try {
    const result = await httpRequest({
      method: method.value,
      url: urlResult.value,
      headers: parsed.headers,
      body: bodyDisabled.value ? '' : bodyResult.value,
      timeoutMs: timeoutSeconds.value * 1000
    })
    if (result?.success) {
      response.value = result
      activeTab.value = 'body'
      remember(method.value, result.url || urlResult.value)
    } else {
      response.value = null
      responseError.value = result?.error || t('网络请求失败')
    }
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  const incoming = takeSendResource('/http-client')
  if (incoming?.kind === 'text') url.value = incoming.text.trim()
})
</script>
